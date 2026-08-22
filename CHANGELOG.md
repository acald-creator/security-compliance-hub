# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
See the [Versioning](README.md#versioning) section of the README for how
consumers should pin references to these workflows.

## [Unreleased]

### Fixed
- Grant `pull-requests: write` on the hub self-scan workflow so the reusable
  `aggregate-results` job can start (GitHub rejects called jobs whose
  permissions exceed the caller).
- Remove nested `slsa-github-generator` calls that passed `GITHUB_TOKEN` as a
  named secret, which caused reusable-workflow `startup_failure` (including
  weekly self-scan).
- TruffleHog no longer passes default-branch as `base` on schedule/dispatch,
  which made BASE==HEAD and failed without scanning.
- OSV Scanner uses `google/osv-scanner-action/osv-scanner-action` v2.5.1; the
  repo-root v1 pin had no `runs:` and the job never started.
- OWASP Dependency-Check no longer runs without `NVD_API_KEY` (NVD rejects an
  empty key, docker exit 13). The job still requires `SECURITY.md`; CVE
  scanning stays on OSV. The unused `Dependency-Check_Action` step is gone.
- Scorecard `publish_results` is off in this suite: OpenSSF rejects workflows
  that also grant `id-token` to Cosign. SARIF still uploads to the Security tab.

## [0.2.0] - 2026-08-21

### Added
- `security-scan.yml` uploads `security-summary.json` (schema
  `acald-creator/security-compliance-hub/security-summary/v1`) for dashboard
  and Nexus consumers. The `vulnerabilities` workflow output is now populated.
- `scripts/lib/html.ts` plus a Bun unit test for HTML escaping.
- `compliance-report.json` alongside the HTML audit report.

### Changed
- CodeQL runs once with detected languages instead of a five-language matrix
  that failed on repos without those languages (and ran Semgrep five times).
- PR comments from `aggregate-results` only run on `pull_request` (weekly
  self-scan no longer tries to comment on a missing issue).
- Scorecard `publish_results` is limited to public repositories.
- Remaining third-party Actions in the reusable workflows are SHA-pinned.
- Consumer templates stay pinned to `@v0` (from 2026-04-18 unreleased work).
- `devsecops-infinity.yml` installs Bun before `bunx`, skips Cosign/OPA when
  the caller has no image or policies, and uses `bun audit` instead of
  `audit-ci` / `nancy`.
- `compliance-dashboard.ts` paginates GitHub, and actually checks Dependabot,
  vulnerability alerts, branch protection, signed commits, and OpenSSF.

### Fixed
- `aggregate-results` `outputs` / `permissions` stay distinct; `if: always()`
  is preserved so skipped signing jobs still produce a score.

## [0.1.0] - 2026-04-18

First tagged release. Resolves the items from `AUDIT.md` and establishes
the CI/release plumbing that future versions build on.

### Added
- `.gitleaksignore` for historical README findings (placeholders from the
  original Gitleaks sample README living in commit `3004309`).
- `.github/dependabot.yml` tracking `github-actions` + `npm` ecosystems.
- `.github/workflows/ci.yml` — biome, tsc, `bun audit`, actionlint, gitleaks
  full-history, and shellcheck on `scripts/*.sh`.
- `.github/workflows/release.yml` — tag-driven GitHub Release + moving
  `v{major}` tag maintenance.
- `.github/workflows/self-scan.yml` — weekly dogfood of `security-scan.yml`
  against this repo itself.
- `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md` (hub's own).
- `templates/THREAT_MODEL.md` — starter threat-model template that
  `devsecops-infinity.yml` plan-phase expects target repos to provide.

### Changed
- `scripts/setup-repo-security.sh`: derive `owner/repo` from `origin` remote
  when `GITHUB_REPOSITORY` is unset (previously only worked inside GitHub
  Actions).
- Narrowed the root `.gitleaks.toml` allowlist so real leaks under `docs/`,
  `.github/workflows/`, and `*.example.*` are no longer hidden.

### Fixed
- `security-scan.yml`: added CodeQL `init` step, corrected OpenSSF Scorecard
  format/filename, replaced broken `container-scan` `if:` guard with runtime
  file detection, added `supply-chain` to `aggregate-results` `needs`, pinned
  trufflehog / dependency-check / trivy-action to commit SHAs, upgraded
  `upload/download-artifact` to v4, removed ZAP step (unusable in a reusable
  workflow).
- `devsecops-infinity.yml`: fixed `-f` vs `-d` on `tests/security`, declared
  `registry`/`image` inputs so `REGISTRY`/`IMAGE` are defined, installed
  cosign in `deploy-phase`, removed ZAP step, upgraded `upload-artifact` to
  v4.
- `compliance-dashboard.ts`: HTML-escape all interpolated repo fields (was
  XSS-able), added proper Octokit typing throughout, fail-fast on missing
  `GITHUB_TOKEN`.
- `lefthook.yml`: Bun 1.3.12 ships `bun audit` natively, so the pre-push
  hook uses it directly.
- `hooks/lefthook.yml`: replaced invalid `placeholder: true` with a working
  pre-push `bun audit`; switched gitleaks to
  `gitleaks git --pre-commit --staged` so full history is not rescanned on
  every commit; removed empty `commit-msg: commands:` block that broke
  `lefthook validate`.

[Unreleased]: https://github.com/acald-creator/security-compliance-hub/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/acald-creator/security-compliance-hub/releases/tag/v0.2.0
[0.1.0]: https://github.com/acald-creator/security-compliance-hub/releases/tag/v0.1.0
