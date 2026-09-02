# Repository Audit: security-compliance-hub

**Original audit:** 2026-04-11 (Claude Code)
**0.1.0 close-out:** 2026-04-18
**0.2 status:** 2026-09-01 — `v0.2.6` is published; post-release main work includes the published-image verification fixture

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
19. Tests — dashboard scoring/evidence and HTML escaping are covered by Bun unit tests; workflow integration fixtures remain a future item.
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
| Repositories without dependency manifests received a passing dependency score | Fixed: OSV is skipped as `not_applicable` and excluded from the score denominator |
| Dashboard: no pagination; Dependabot/alerts/protection/signing/OpenSSF never queried | Implemented, with per-control evidence and explicit `unknown` results for unavailable APIs |
| Dashboard: API failures looked like control failures; signing checked only the latest commit | Fixed: `compliance-report.json` distinguishes `pass`, `fail`, `unknown`, and `not_applicable`; signing now checks repository enforcement |
| Deploy image verification had no machine-readable result for downstream policy | Fixed: infinity workflow exposes verification status, inspected digest, and reason outputs |
| Infinity image signing/verification only supported the current commit tag | Fixed: callers can provide `image-tag`; the commit SHA remains the default |
| Nested SLSA generic generator `base64-subjects` is still a commit SHA, not artifact hashes | **Resolved for caller-supplied artifacts** — GitHub Artifact Attestations now emits provenance when `artifact-path` and `attestations: write` are provided; source-only scans remain `not_requested` |
| Gitleaks Action license on some orgs | **Open** — personal public repos OK with `GITHUB_TOKEN` |
| Nexus evidence mapping | **In progress** — `security-summary/v1` has a checked-in JSON Schema; consumer field mapping remains to be implemented in the portfolio Nexus layer |
| Published-image verification fixture | **Resolved on main** — manual GHCR build, keyless Cosign signing, tag-to-digest resolution, and trusted-identity verification passed end-to-end |
| Self-scan dogfood: TruffleHog BASE==HEAD, OSV missing `runs:`, OWASP NVD key, Scorecard publish | Fixed in `v0.2.1` |

---

## Recommended next work

1. Map `security-summary/v1` fields into the portfolio Nexus consumer, including required fields, optional evidence, and `unknown` / `not_applicable` handling.
2. Stamp the hub onto 5–10 public original repositories, not every fork, and collect their summary artifacts as consumer fixtures.
3. Cut the next release after the post-`v0.2.6` workflow changes are reviewed; include the published-image fixture and sequential `release-verify` phase.
