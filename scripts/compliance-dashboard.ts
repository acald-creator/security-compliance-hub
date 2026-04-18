import { createWriteStream } from "node:fs";
import { Octokit } from "@octokit/rest";

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

type ComplianceStatus = "compliant" | "partial" | "non_compliant";

interface ComplianceResult {
	score: number;
	checks: ComplianceChecks;
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
	};
	repos: RepoReportEntry[];
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
	console.error("❌ GITHUB_TOKEN environment variable is required.");
	process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

const HTML_ESCAPES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
};

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

async function auditAllRepos(): Promise<void> {
	const { data: repos } = await octokit.repos.listForAuthenticatedUser({
		per_page: 100,
		sort: "updated",
	});

	const report: ComplianceReport = {
		timestamp: new Date().toISOString(),
		total_repos: repos.length,
		compliance_summary: {
			compliant: 0,
			partial: 0,
			non_compliant: 0,
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
		} else {
			report.compliance_summary.non_compliant++;
		}
	}

	const html = generateHTMLReport(report);
	const stream = createWriteStream("compliance-report.html");
	stream.write(html);
	stream.end();

	console.log(`\n✅ Compliance report generated: compliance-report.html`);
	console.log(
		`Summary: ${report.compliance_summary.compliant} compliant, ${report.compliance_summary.partial} partial, ${report.compliance_summary.non_compliant} non-compliant`,
	);
}

async function checkRepoCompliance(
	repo: RepoListItem,
): Promise<ComplianceResult> {
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

	try {
		await octokit.repos.getContent({
			owner: repo.owner.login,
			repo: repo.name,
			path: "SECURITY.md",
		});
		checks.has_security_md = true;
	} catch {
		// SECURITY.md not present — leave check false.
	}

	try {
		const { data: workflows } = await octokit.actions.listRepoWorkflows({
			owner: repo.owner.login,
			repo: repo.name,
		});
		checks.has_security_workflow = workflows.workflows.some(
			(w) =>
				w.path.includes("security") ||
				w.name.toLowerCase().includes("security"),
		);
		checks.has_codeql = workflows.workflows.some((w) =>
			w.path.toLowerCase().includes("codeql"),
		);
	} catch {
		// Workflow listing failed (private repo without permission, etc.).
	}

	const booleanChecks: Array<keyof ComplianceChecks> = [
		"has_security_md",
		"has_security_workflow",
		"has_dependabot",
		"has_codeql",
		"vulnerability_alerts_enabled",
		"has_branch_protection",
		"signed_commits",
	];
	const passed = booleanChecks.filter((key) => checks[key] === true).length;
	const score = (passed / booleanChecks.length) * 100;

	const status: ComplianceStatus =
		score >= 80 ? "compliant" : score >= 50 ? "partial" : "non_compliant";

	return { score, checks, status };
}

function generateHTMLReport(report: ComplianceReport): string {
	const rows = report.repos
		.map((r) => {
			const name = escapeHtml(r.name);
			const fullName = escapeHtml(r.full_name);
			const status = r.compliance.status;
			const statusLabel = escapeHtml(status);
			const score = r.compliance.score.toFixed(0);
			return `
        <tr>
          <td><a href="https://github.com/${fullName}">${name}</a></td>
          <td>${score}%</td>
          <td><span class="badge ${statusLabel}">${statusLabel}</span></td>
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
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
    .card { padding: 20px; border-radius: 8px; }
    .compliant { background: #10B98120; }
    .partial { background: #F59E0B20; }
    .non_compliant { background: #EF444420; }
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
  </div>

  <table>
    <thead>
      <tr>
        <th>Repository</th>
        <th>Score</th>
        <th>Status</th>
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
