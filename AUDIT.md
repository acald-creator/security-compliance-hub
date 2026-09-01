# Repository Audit: security-compliance-hub

**Original audit:** 2026-04-11 (Claude Code)
**0.1.0 close-out:** 2026-04-18
**0.2 status:** 2026-08-21 — remaining consumer-contract work on `revamp/0.2-consumer-contract`

This file is a working log, not a forever-open bug list. Items marked **resolved** shipped in `0.1.0` unless noted.

---

## Overview

Centralized DevSecOps toolkit: reusable GitHub Actions, setup scripts, and templates. Bun, TypeScript, Biome, Lefthook.

---

## Original CRITICAL — resolved in 0.1.0

1. README was the Gitleaks README — replaced with project docs.
2. Missing `@octokit/rest` — added to `package.json`.
3. Dead npm scripts (`report`, `scan:local`, `update:policies`) — removed.

## Original HIGH — resolved in 0.1.0

4. Unpinned trufflehog / dependency-check / trivy — SHA-pinned.
5. CodeQL `analyze` without `init` — `init` added.
6. `aggregate-results` missing `supply-chain` in `needs` — added.
7. Scorecard JSON vs SARIF filename — SARIF.
8. Container-scan `if:` never matched — runtime file detection.
9. `upload-artifact@v3` / Semgrep action org — v4 + Semgrep CLI.
10. XSS in HTML report — `escapeHtml`.

## Original MEDIUM / LOW — resolved in 0.1.0 unless noted

11. `tests/security` `-f` vs `-d` — fixed.
12. `bun audit` — valid on Bun 1.2+; pre-push uses it.
13. `install-commit-tools.sh` `set -e` and no sudo — fixed.
14. Gitleaks allowlist narrowed.
15. `any` types in dashboard — Octokit typing.
16. ZAP against localhost — removed from reusable workflow (caller must boot the app).
17. Example templates populated from `templates/`.
18. Hub `SECURITY.md` added.
19. Tests — **open until 0.2** (`scripts/lib/html.test.ts` started).
20. `setup-tools.sh` PATH append — grep rc files.
21. `@types/bun` pinned to `^1.3.1`.
22. Commit-msg enforcement still optional (documented).
23. Infinity `REGISTRY`/`IMAGE` inputs — added.
24. `.gitignore` `*.log` — fixed.

---

## Remaining (0.2 consumer contract)

These blocked stamping the hub onto portfolio repos and later Nexus:

| Item | Status on this branch |
|------|------------------------|
| CodeQL 5-language matrix fails / Semgrep ×5 | Fixed: detect languages, Semgrep once |
| Self-scan / push comments on missing issue | Fixed: PR-only comment |
| `vulnerabilities` output never set | Fixed |
| No machine-readable summary for dashboard/Nexus | Fixed: `security-summary.json` v1 |
| Scorecard `publish_results` on private repos | Fixed: public only |
| Remaining Actions still on moving tags | SHA-pinned in reusable workflows |
| Infinity: no Bun, OPA always, Cosign always | Skip/install guards |
| Deploy Cosign verification accepted any certificate identity and issuer | Fixed: published images require a trusted identity; issuer defaults to GitHub Actions |
| Scanner failures were swallowed by CodeQL/Semgrep/Trivy behavior | Fixed: CodeQL and Semgrep failures fail SAST; Trivy exits non-zero at the configured threshold |
| Missing NVD credentials appeared as successful OWASP compliance | Fixed: OWASP evidence is `unknown`; `require-owasp-dependency-check` can make it fail closed |
| Dashboard: no pagination; Dependabot/alerts/protection/signing/OpenSSF never queried | Implemented |
| Nested SLSA generic generator `base64-subjects` is still a commit SHA, not artifact hashes | **Resolved for caller-supplied artifacts** — GitHub Artifact Attestations now emits provenance when `artifact-path` and `attestations: write` are provided; source-only scans remain `not_requested` |
| Gitleaks Action license on some orgs | **Open** — personal public repos OK with `GITHUB_TOKEN` |
| Nexus evidence mapping | **Open** — see portfolio `docs/system-workflow.md` Layer 4 |
| Self-scan dogfood: TruffleHog BASE==HEAD, OSV missing `runs:`, OWASP NVD key, Scorecard publish | Fixed in `v0.2.1` |

---

## Recommended next after 0.2 merge

1. Tag `v0.2.0` only after CI (and a `workflow_dispatch` self-scan) is green.
2. Stamp onto 5–10 public originals, not every fork.
3. Run the manual attestation fixture and add a published-image fixture for strict Cosign verification.
4. Then expand Underground Nexus as a host-level consumer of `security-summary/v1`.
