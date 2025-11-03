import { Octokit } from "@octokit/rest";
import { createWriteStream } from "fs";

const octokit = new Octokit({
	auth: process.env.GITHUB_TOKEN,
});

async function auditAllRepos() {
	const { data: repos } = await octokit.repos.listForAuthenticatedUser({
		per_page: 100,
		sort: "updated",
	});

	const report = {
		timestamp: new Date().toISOString(),
		total_repos: repos.length,
		compliance_summary: {
			compliant: 0,
			partial: 0,
			non_compliant: 0,
		},
		repos: [] as any[],
	};

	for (const repo of repos) {
		console.log(`Scanning ${repo.full_name}...`);

		const compliance = await checkRepoCompliance(repo);
		report.repos.push({
			name: repo.name,
			full_name: repo.full_name,
			compliance,
		});

		if (compliance.score >= 80) {
			report.compliance_summary.compliant++;
		} else if (compliance.score >= 50) {
			report.compliance_summary.partial++;
		} else {
			report.compliance_summary.non_compliant++;
		}
	}

	// Generate HTML report
	const html = generateHTMLReport(report);
	const stream = createWriteStream("compliance-report.html");
	stream.write(html);
	stream.end();

	console.log(`\n✅ Compliance report generated: compliance-report.html`);
	console.log(
		`Summary: ${report.compliance_summary.compliant} compliant, ${report.compliance_summary.partial} partial, ${report.compliance_summary.non_compliant} non-compliant`,
	);
}

async function checkRepoCompliance(repo: any) {
	const checks = {
		has_security_md: false,
		has_security_workflow: false,
		has_dependabot: false,
		has_codeql: false,
		vulnerability_alerts_enabled: false,
		has_branch_protection: false,
		signed_commits: false,
		openssf_score: 0,
	};

	// Check for security files
	try {
		await octokit.repos.getContent({
			owner: repo.owner.login,
			repo: repo.name,
			path: "SECURITY.md",
		});
		checks.has_security_md = true;
	} catch {}

	// Check for security workflow
	try {
		const { data: workflows } = await octokit.actions.listRepoWorkflows({
			owner: repo.owner.login,
			repo: repo.name,
		});
		checks.has_security_workflow = workflows.workflows.some(
			(w: any) =>
				w.path.includes("security") ||
				w.name.toLowerCase().includes("security"),
		);
	} catch {}

	// Calculate score
	const score =
		(Object.values(checks).filter(Boolean).length /
			Object.keys(checks).length) *
		100;

	return {
		score,
		checks,
		status:
			score >= 80 ? "compliant" : score >= 50 ? "partial" : "non_compliant",
	};
}

function generateHTMLReport(report: any) {
	return `
<!DOCTYPE html>
<html>
<head>
  <title>Security Compliance Report</title>
  <style>
    body { font-family: system-ui; max-width: 1200px; margin: 0 auto; padding: 20px; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
    .card { padding: 20px; border-radius: 8px; }
    .compliant { background: #10B98120; }
    .partial { background: #F59E0B20; }
    .non-compliant { background: #EF444420; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Security Compliance Report</h1>
  <p>Generated: ${report.timestamp}</p>
  
  <div class="summary">
    <div class="card compliant">
      <h2>${report.compliance_summary.compliant}</h2>
      <p>Compliant</p>
    </div>
    <div class="card partial">
      <h2>${report.compliance_summary.partial}</h2>
      <p>Partial</p>
    </div>
    <div class="card non-compliant">
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
    <tbody>
      ${report.repos
				.map(
					(r: any) => `
        <tr>
          <td><a href="https://github.com/${r.full_name}">${r.name}</a></td>
          <td>${r.compliance.score.toFixed(0)}%</td>
          <td><span class="badge ${r.compliance.status}">${r.compliance.status}</span></td>
          <td><a href="https://github.com/${r.full_name}/security">View Details</a></td>
        </tr>
      `,
				)
				.join("")}
    </tbody>
  </table>
</body>
</html>
  `;
}

// Run the audit
await auditAllRepos();
