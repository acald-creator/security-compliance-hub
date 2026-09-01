import { createWriteStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { Octokit } from "@octokit/rest";
import { escapeHtml } from "./lib/html.ts";

type RepoListItem = Awaited<
	ReturnType<Octokit["repos"]["listForAuthenticatedUser"]>
>["data"][number];

interface ComplianceChecks {
	has_security_md: boolean;
	has_security_workflow: boolean;
	has_dependabot: boolean;
	has_codeql: boolean;
	vulnerability_alerts_enabled: boolean;
	has_branch_protection: boolean;
	signed_commits: boolean;
	openssf_score: number;
}

type ComplianceCheckName =
	| "has_security_md"
	| "has_security_workflow"
	| "has_dependabot"
	| "has_codeql"
	| "vulnerability_alerts_enabled"
	| "has_branch_protection"
	| "signed_commits"
	| "openssf_score";

type BooleanCheckName = Exclude<ComplianceCheckName, "openssf_score">;
type CheckStatus = "pass" | "fail" | "unknown" | "not_applicable";

interface CheckEvidence {
	status: CheckStatus;
	reason: string;
}

type ComplianceEvidence = Record<ComplianceCheckName, CheckEvidence>;

type ComplianceStatus = "compliant" | "partial" | "non_compliant" | "unknown";

interface ComplianceResult {
	score: number;
	checks: ComplianceChecks;
	evidence: ComplianceEvidence;
	status: ComplianceStatus;
}

interface RepoReportEntry {
	name: string;
	full_name: string;
	compliance: ComplianceResult;
}

interface ComplianceReport {
	timestamp: string;
	total_repos: number;
	compliance_summary: {
		compliant: number;
		partial: number;
		non_compliant: number;
		unknown: number;
	};
	repos: RepoReportEntry[];
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
	console.error("❌ GITHUB_TOKEN environment variable is required.");
	process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

async function auditAllRepos(): Promise<void> {
	const repos = await octokit.paginate(octokit.repos.listForAuthenticatedUser, {
		per_page: 100,
		sort: "updated",
		affiliation: process.env.AUDIT_AFFILIATION ?? "owner",
	});

	const report: ComplianceReport = {
		timestamp: new Date().toISOString(),
		total_repos: repos.length,
		compliance_summary: {
			compliant: 0,
			partial: 0,
			non_compliant: 0,
			unknown: 0,
		},
		repos: [],
	};

	for (const repo of repos) {
		console.log(`Scanning ${repo.full_name}...`);

		const compliance = await checkRepoCompliance(repo);
		report.repos.push({
			name: repo.name,
			full_name: repo.full_name,
			compliance,
		});

		if (compliance.status === "compliant") {
			report.compliance_summary.compliant++;
		} else if (compliance.status === "partial") {
			report.compliance_summary.partial++;
		} else if (compliance.status === "unknown") {
			report.compliance_summary.unknown++;
		} else {
			report.compliance_summary.non_compliant++;
		}
	}

	const html = generateHTMLReport(report);
	const stream = createWriteStream("compliance-report.html");
	stream.write(html);
	stream.end();
	await writeFile(
		"compliance-report.json",
		`${JSON.stringify(report, null, 2)}\n`,
	);

	console.log(`\n✅ Compliance report generated: compliance-report.html`);
	console.log(`✅ JSON report generated: compliance-report.json`);
	console.log(
		`Summary: ${report.compliance_summary.compliant} compliant, ${report.compliance_summary.partial} partial, ${report.compliance_summary.non_compliant} non-compliant, ${report.compliance_summary.unknown} unknown`,
	);
}

function errorStatus(error: unknown): number | undefined {
	if (typeof error !== "object" || error === null || !("status" in error)) {
		return undefined;
	}
	const status = error.status;
	return typeof status === "number" ? status : undefined;
}

function unavailableEvidence(
	error: unknown,
	notFoundReason: string,
	unknownReason: string,
): CheckEvidence {
	const status = errorStatus(error);
	if (status === 404) {
		return { status: "fail", reason: notFoundReason };
	}
	return {
		status: "unknown",
		reason: status
			? `${unknownReason} (GitHub API returned ${status})`
			: `${unknownReason} (GitHub API request failed)`,
	};
}

async function fileEvidence(
	owner: string,
	repo: string,
	path: string,
): Promise<CheckEvidence> {
	try {
		await octokit.repos.getContent({ owner, repo, path });
		return { status: "pass", reason: `${path} exists` };
	} catch (error) {
		return unavailableEvidence(
			error,
			`${path} is missing`,
			`Could not check ${path}`,
		);
	}
}

async function anyFileEvidence(
	owner: string,
	repo: string,
	paths: string[],
): Promise<CheckEvidence> {
	const results = await Promise.all(
		paths.map((path) => fileEvidence(owner, repo, path)),
	);
	const found = results.find((result) => result.status === "pass");
	if (found) {
		return found;
	}
	const unavailable = results.find((result) => result.status === "unknown");
	if (unavailable) {
		return unavailable;
	}
	return {
		status: "fail",
		reason: `None of ${paths.join(", ")} exist`,
	};
}

function setBooleanCheck(
	checks: ComplianceChecks,
	evidence: ComplianceEvidence,
	key: BooleanCheckName,
	value: CheckEvidence,
): void {
	evidence[key] = value;
	checks[key] = value.status === "pass";
}

async function signedCommitEnforcementEvidence(
	owner: string,
	repo: string,
	branch: string,
): Promise<CheckEvidence> {
	try {
		await octokit.request(
			"GET /repos/{owner}/{repo}/branches/{branch}/protection/required_signatures",
			{ owner, repo, branch },
		);
		return {
			status: "pass",
			reason: `Required commit signatures are enabled on ${branch}`,
		};
	} catch (error) {
		if (errorStatus(error) !== 404) {
			return unavailableEvidence(
				error,
				`Required commit signatures are not enabled on ${branch}`,
				`Could not check required commit signatures on ${branch}`,
			);
		}
	}

	try {
		const response = await octokit.request(
			"GET /repos/{owner}/{repo}/rulesets",
			{ owner, repo, includes_parents: true },
		);
		type Ruleset = {
			id: number;
			enforcement?: string;
			target?: string;
			rules?: Array<{ type?: string }>;
		};
		const summaries = response.data as Ruleset[];
		const rulesets = await Promise.all(
			summaries.map(async (summary) => {
				const detail = await octokit.request(
					"GET /repos/{owner}/{repo}/rulesets/{ruleset_id}",
					{
						owner,
						repo,
						ruleset_id: summary.id,
						includes_parents: true,
					},
				);
				return detail.data as Ruleset;
			}),
		);
		const enforced = rulesets.some((ruleset) => {
			if (ruleset.enforcement !== "active") {
				return false;
			}
			if (ruleset.target && ruleset.target !== "branch") {
				return false;
			}
			return ruleset.rules?.some((rule) => rule.type === "required_signatures");
		});
		return enforced
			? {
					status: "pass",
					reason: "An active branch ruleset requires signed commits",
				}
			: {
					status: "fail",
					reason: "No active branch ruleset requires signed commits",
				};
	} catch (error) {
		return unavailableEvidence(
			error,
			"No active branch ruleset requires signed commits",
			"Could not check branch rulesets for signed-commit enforcement",
		);
	}
}

async function checkRepoCompliance(
	repo: RepoListItem,
): Promise<ComplianceResult> {
	const owner = repo.owner.login;
	const name = repo.name;

	const checks: ComplianceChecks = {
		has_security_md: false,
		has_security_workflow: false,
		has_dependabot: false,
		has_codeql: false,
		vulnerability_alerts_enabled: false,
		has_branch_protection: false,
		signed_commits: false,
		openssf_score: 0,
	};
	const evidence: ComplianceEvidence = {
		has_security_md: { status: "unknown", reason: "Not checked" },
		has_security_workflow: { status: "unknown", reason: "Not checked" },
		has_dependabot: { status: "unknown", reason: "Not checked" },
		has_codeql: { status: "unknown", reason: "Not checked" },
		vulnerability_alerts_enabled: { status: "unknown", reason: "Not checked" },
		has_branch_protection: { status: "unknown", reason: "Not checked" },
		signed_commits: { status: "unknown", reason: "Not checked" },
		openssf_score: { status: "unknown", reason: "Not checked" },
	};

	setBooleanCheck(
		checks,
		evidence,
		"has_security_md",
		await fileEvidence(owner, name, "SECURITY.md"),
	);
	setBooleanCheck(
		checks,
		evidence,
		"has_dependabot",
		await anyFileEvidence(owner, name, [
			".github/dependabot.yml",
			".github/dependabot.yaml",
		]),
	);

	try {
		const { data: workflows } = await octokit.actions.listRepoWorkflows({
			owner,
			repo: name,
		});
		setBooleanCheck(checks, evidence, "has_security_workflow", {
			status: workflows.workflows.some(
				(w) =>
					w.path.toLowerCase().includes("security") ||
					w.name.toLowerCase().includes("security"),
			)
				? "pass"
				: "fail",
			reason: workflows.workflows.some(
				(w) =>
					w.path.toLowerCase().includes("security") ||
					w.name.toLowerCase().includes("security"),
			)
				? "A security workflow is configured"
				: "No security workflow is configured",
		});
		setBooleanCheck(checks, evidence, "has_codeql", {
			status: workflows.workflows.some((w) =>
				w.path.toLowerCase().includes("codeql"),
			)
				? "pass"
				: "fail",
			reason: workflows.workflows.some((w) =>
				w.path.toLowerCase().includes("codeql"),
			)
				? "A CodeQL workflow is configured"
				: "No CodeQL workflow is configured",
		});
	} catch (error) {
		setBooleanCheck(
			checks,
			evidence,
			"has_security_workflow",
			unavailableEvidence(
				error,
				"No security workflow is configured",
				"Could not list repository workflows",
			),
		);
		setBooleanCheck(
			checks,
			evidence,
			"has_codeql",
			unavailableEvidence(
				error,
				"No CodeQL workflow is configured",
				"Could not check for a CodeQL workflow",
			),
		);
	}

	try {
		const response = await octokit.request(
			"GET /repos/{owner}/{repo}/vulnerability-alerts",
			{ owner, repo: name },
		);
		setBooleanCheck(checks, evidence, "vulnerability_alerts_enabled", {
			status: response.status === 204 ? "pass" : "fail",
			reason:
				response.status === 204
					? "Dependabot vulnerability alerts are enabled"
					: `Vulnerability alerts API returned HTTP ${response.status}`,
		});
	} catch (error) {
		setBooleanCheck(
			checks,
			evidence,
			"vulnerability_alerts_enabled",
			unavailableEvidence(
				error,
				"Dependabot vulnerability alerts are disabled",
				"Could not check Dependabot vulnerability alerts",
			),
		);
	}

	let defaultBranch: string | undefined;
	try {
		const { data: details } = await octokit.repos.get({ owner, repo: name });
		defaultBranch = details.default_branch;
		await octokit.repos.getBranchProtection({
			owner,
			repo: name,
			branch: details.default_branch,
		});
		setBooleanCheck(checks, evidence, "has_branch_protection", {
			status: "pass",
			reason: `Branch protection is enabled on ${details.default_branch}`,
		});
	} catch (error) {
		setBooleanCheck(
			checks,
			evidence,
			"has_branch_protection",
			unavailableEvidence(
				error,
				"Branch protection is not enabled on the default branch",
				"Could not check branch protection",
			),
		);
	}

	if (defaultBranch) {
		setBooleanCheck(
			checks,
			evidence,
			"signed_commits",
			await signedCommitEnforcementEvidence(owner, name, defaultBranch),
		);
	} else {
		setBooleanCheck(checks, evidence, "signed_commits", {
			status: "unknown",
			reason: "Could not determine the default branch",
		});
	}

	try {
		const scorecard = await fetch(
			`https://api.securityscorecards.dev/projects/github.com/${owner}/${name}`,
		);
		if (scorecard.ok) {
			const body = (await scorecard.json()) as { score?: number };
			if (typeof body.score === "number") {
				checks.openssf_score = body.score;
				evidence.openssf_score = {
					status: "pass",
					reason: `OpenSSF Scorecard score: ${body.score}/10`,
				};
			} else {
				evidence.openssf_score = {
					status: "unknown",
					reason: "OpenSSF Scorecard response did not include a score",
				};
			}
		} else {
			evidence.openssf_score = {
				status: "unknown",
				reason: `OpenSSF Scorecard API returned HTTP ${scorecard.status}`,
			};
		}
	} catch (error) {
		evidence.openssf_score = unavailableEvidence(
			error,
			"OpenSSF Scorecard data is unavailable",
			"Could not query OpenSSF Scorecard",
		);
	}

	const booleanChecks: BooleanCheckName[] = [
		"has_security_md",
		"has_security_workflow",
		"has_dependabot",
		"has_codeql",
		"vulnerability_alerts_enabled",
		"has_branch_protection",
		"signed_commits",
	];
	const evaluatedChecks = booleanChecks.filter(
		(key) =>
			evidence[key].status !== "unknown" &&
			evidence[key].status !== "not_applicable",
	);
	const passed = evaluatedChecks.filter((key) => checks[key] === true).length;
	let score =
		evaluatedChecks.length === 0 ? 0 : (passed / evaluatedChecks.length) * 100;
	if (checks.openssf_score > 0 && evidence.openssf_score.status === "pass") {
		score = (score + checks.openssf_score * 10) / 2;
	}

	const hasUnknown = Object.values(evidence).some(
		(check) => check.status === "unknown",
	);
	const status: ComplianceStatus =
		evaluatedChecks.length === 0 && hasUnknown
			? "unknown"
			: hasUnknown
				? "partial"
				: score >= 80
					? "compliant"
					: score >= 50
						? "partial"
						: "non_compliant";

	return { score, checks, evidence, status };
}

function generateHTMLReport(report: ComplianceReport): string {
	const rows = report.repos
		.map((r) => {
			const name = escapeHtml(r.name);
			const fullName = escapeHtml(r.full_name);
			const status = r.compliance.status;
			const statusLabel = escapeHtml(status);
			const score = r.compliance.score.toFixed(0);
			const unknownEvidence = Object.values(r.compliance.evidence).filter(
				(evidence) => evidence.status === "unknown",
			).length;
			const evidenceLabel =
				unknownEvidence === 0 ? "complete" : `${unknownEvidence} unknown`;
			return `
        <tr>
          <td><a href="https://github.com/${fullName}">${name}</a></td>
          <td>${score}%</td>
          <td><span class="badge ${statusLabel}">${statusLabel}</span></td>
          <td>${evidenceLabel}</td>
          <td><a href="https://github.com/${fullName}/security">View Details</a></td>
        </tr>`;
		})
		.join("");

	const timestamp = escapeHtml(report.timestamp);

	return `<!DOCTYPE html>
<html>
<head>
  <title>Security Compliance Report</title>
  <style>
    body { font-family: system-ui; max-width: 1200px; margin: 0 auto; padding: 20px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
    .card { padding: 20px; border-radius: 8px; }
    .compliant { background: #10B98120; }
    .partial { background: #F59E0B20; }
    .non_compliant { background: #EF444420; }
    .unknown { background: #6B728020; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Security Compliance Report</h1>
  <p>Generated: ${timestamp}</p>

  <div class="summary">
    <div class="card compliant">
      <h2>${report.compliance_summary.compliant}</h2>
      <p>Compliant</p>
    </div>
    <div class="card partial">
      <h2>${report.compliance_summary.partial}</h2>
      <p>Partial</p>
    </div>
    <div class="card non_compliant">
      <h2>${report.compliance_summary.non_compliant}</h2>
      <p>Non-Compliant</p>
    </div>
    <div class="card unknown">
      <h2>${report.compliance_summary.unknown}</h2>
      <p>Unknown</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Repository</th>
        <th>Score</th>
        <th>Status</th>
        <th>Evidence</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>${rows}
    </tbody>
  </table>
</body>
</html>
`;
}

await auditAllRepos();
