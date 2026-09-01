import { describe, expect, test } from "bun:test";
import {
	assessCompliance,
	type CheckEvidence,
	type ComplianceChecks,
	type ComplianceEvidence,
} from "./compliance.ts";

const pass: CheckEvidence = { status: "pass", reason: "test pass" };

function makeChecks(): ComplianceChecks {
	return {
		has_security_md: true,
		has_security_workflow: true,
		has_dependabot: true,
		has_codeql: true,
		vulnerability_alerts_enabled: true,
		has_branch_protection: true,
		signed_commits: true,
		openssf_score: 0,
	};
}

function makeEvidence(): ComplianceEvidence {
	return {
		has_security_md: pass,
		has_security_workflow: pass,
		has_dependabot: pass,
		has_codeql: pass,
		vulnerability_alerts_enabled: pass,
		has_branch_protection: pass,
		signed_commits: pass,
		openssf_score: pass,
	};
}

describe("assessCompliance", () => {
	test("excludes unknown controls from the score but marks the result partial", () => {
		const checks = makeChecks();
		const evidence = makeEvidence();
		evidence.has_codeql = { status: "unknown", reason: "API unavailable" };
		evidence.has_dependabot = { status: "fail", reason: "Missing config" };
		checks.has_dependabot = false;

		const result = assessCompliance(checks, evidence);

		expect(result.score).toBeCloseTo(83.333, 2);
		expect(result.status).toBe("partial");
	});

	test("reports unknown when no control can be evaluated", () => {
		const checks = makeChecks();
		const evidence = makeEvidence();
		for (const key of Object.keys(evidence) as Array<
			keyof ComplianceEvidence
		>) {
			evidence[key] = { status: "unknown", reason: "API unavailable" };
		}

		const result = assessCompliance(checks, evidence);

		expect(result.score).toBe(0);
		expect(result.status).toBe("unknown");
	});

	test("does not call a repository compliant when Scorecard evidence is unknown", () => {
		const result = assessCompliance(makeChecks(), {
			...makeEvidence(),
			openssf_score: { status: "unknown", reason: "Scorecard unavailable" },
		});

		expect(result.score).toBe(100);
		expect(result.status).toBe("partial");
	});

	test("excludes not-applicable controls from the score", () => {
		const checks = makeChecks();
		const evidence = makeEvidence();
		evidence.has_dependabot = {
			status: "not_applicable",
			reason: "No dependency manifest",
		};
		checks.has_dependabot = false;

		const result = assessCompliance(checks, evidence);

		expect(result.score).toBe(100);
		expect(result.status).toBe("compliant");
	});
});
