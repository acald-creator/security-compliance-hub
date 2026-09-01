export interface ComplianceChecks {
	has_security_md: boolean;
	has_security_workflow: boolean;
	has_dependabot: boolean;
	has_codeql: boolean;
	vulnerability_alerts_enabled: boolean;
	has_branch_protection: boolean;
	signed_commits: boolean;
	openssf_score: number;
}

export type ComplianceCheckName =
	| "has_security_md"
	| "has_security_workflow"
	| "has_dependabot"
	| "has_codeql"
	| "vulnerability_alerts_enabled"
	| "has_branch_protection"
	| "signed_commits"
	| "openssf_score";

export type BooleanCheckName = Exclude<ComplianceCheckName, "openssf_score">;
export type CheckStatus = "pass" | "fail" | "unknown" | "not_applicable";

export interface CheckEvidence {
	status: CheckStatus;
	reason: string;
}

export type ComplianceEvidence = Record<ComplianceCheckName, CheckEvidence>;
export type ComplianceStatus =
	| "compliant"
	| "partial"
	| "non_compliant"
	| "unknown";

export interface ComplianceAssessment {
	score: number;
	status: ComplianceStatus;
}

const BOOLEAN_CHECKS: BooleanCheckName[] = [
	"has_security_md",
	"has_security_workflow",
	"has_dependabot",
	"has_codeql",
	"vulnerability_alerts_enabled",
	"has_branch_protection",
	"signed_commits",
];

export function assessCompliance(
	checks: ComplianceChecks,
	evidence: ComplianceEvidence,
): ComplianceAssessment {
	const evaluatedChecks = BOOLEAN_CHECKS.filter(
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

	return { score, status };
}
