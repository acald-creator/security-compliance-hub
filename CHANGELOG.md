# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
See the [Versioning](README.md#versioning) section of the README for how
consumers should pin references to these workflows.

## [Unreleased]

## [0.2.10] - 2026-09-01

- Preserve Scorecard SARIF for private repositories without GitHub Advanced
  Security while recording the unavailable Security-tab upload as unknown.

## [0.2.9] - 2026-09-01

- Grant private-repository read permissions required by CodeQL SARIF uploads
  and OpenSSF Scorecard checks.
- Preserve `contents: read` in the Infinity release job so its checkout can
  run when job-level signing permissions are applied.

## [0.2.8] - 2026-09-01

- Require callers to grant `attestations: write` so the reusable supply-chain
  job can start and GitHub can validate its permission contract.

## [0.2.7] - 2026-09-01

- Add a manual published-image fixture covering GHCR push, keyless signing, and strict digest verification.
- Add a sequential `release-verify` phase so image signing completes before deploy verification.
- Use the selected image tag for SBOM attestations and verify published images by their resolved immutable digest.
- Define the Nexus consumer mapping for `security-summary/v1`, including immutable subject identity and evidence status semantics.

## [0.2.6] - 2026-09-01

- Refresh security action pins and Bun tooling dependencies; migrate the Biome configuration.
- Add optional GitHub Artifact Attestations for caller-supplied build artifacts.
- Support downloading caller-uploaded build artifacts before provenance attestation.
- Require a trusted Cosign certificate identity when verifying published images.
- Add a manual artifact-attestation integration fixture workflow.
- Enforce Semgrep and Trivy severity thresholds and stop swallowing CodeQL failures.
- Report missing OWASP NVD credentials as `unknown` with an opt-in hard-fail policy.
- Add SBOM, signature, certificate, and provenance attestation references to the security summary.
- Mark dependency scanning `not_applicable` when no supported manifest exists and exclude it from scoring.
- Separate SBOM signing status from SLSA provenance status in `security-summary/v1`.
- Make repository stamping fetch the exact release by default, with `SECURITY_HUB_REF` override support.
- Add per-control evidence to the dashboard JSON and distinguish unavailable API checks as `unknown` instead of non-compliant.
- Check signed-commit enforcement through required-signature protection and active branch rulesets rather than the latest commit alone.
- Extract dashboard scoring into a pure module with unit coverage for unknown and not-applicable evidence.
- Publish a JSON Schema for the `security-summary/v1` artifact contract.
- Exclude unrequested OpenSSF checks from the reusable workflow score and report them as `not_requested`.
- Expose machine-readable image verification status, digest, and reason outputs from the infinity workflow.
- Allow the infinity workflow to sign or verify a caller-selected image tag, defaulting to the commit SHA.

## [0.2.5] - 2026-08-22

### Changed
- Consumer `security.yml` passes optional secrets by name instead of
  `secrets: inherit`, which Semgrep flagged on every stamped repo.

## [0.2.4] - 2026-08-21

### Fixed
- Infinity `release-phase` skips Cosign when a Dockerfile exists but the
  image was never published to the registry (same skip as `deploy-phase`).

### Changed
- Consumer `security.yml` template includes `workflow_dispatch`.
- Setup script fills `[OWNER]/[REPO]` in `SECURITY.md` and
  `SECURITY-INSIGHTS.yml`, and only adds Dependabot ecosystems the target
  repo actually uses.

## [0.2.3] - 2026-08-21

### Fixed
- CodeQL analysis no longer fails the SAST job when GitHub default setup
  blocks advanced SARIF (`GITHUB_TOKEN` cannot read the default-setup API).
  Semgrep still runs afterward.

## [0.2.2] - 2026-08-21

### Fixed
- Skip advanced CodeQL when GitHub's default CodeQL setup is enabled (the
  Security tab rejects that SARIF). Semgrep still runs.
- Infinity `monitor-phase` no longer fails the job when `GITHUB_TOKEN` cannot
  read Dependabot alerts (`vulnerability_alerts=read` is not grantable to
  Actions). It logs a skip and still checks code scanning alerts.

### Changed
- First-party Actions in the reusable workflows now use Node 24 runtimes
  (`checkout` v7, `github-script` v9, `setup-python` v7, artifact actions
  v7/v8, CodeQL Action v4). Third-party scanners may still warn until they
  ship Node 24 builds.

## [0.2.1] - 2026-08-21

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
  The Scorecard job does not request `actions: read` (callers typically grant
  `actions: none`, which blocked reusable-workflow startup).

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

[Unreleased]: https://github.com/acald-creator/security-compliance-hub/compare/v0.2.10...HEAD
[0.2.10]: https://github.com/acald-creator/security-compliance-hub/releases/tag/v0.2.10
[0.2.9]: https://github.com/acald-creator/security-compliance-hub/releases/tag/v0.2.9
[0.2.8]: https://github.com/acald-creator/security-compliance-hub/releases/tag/v0.2.8
[0.2.7]: https://github.com/acald-creator/security-compliance-hub/releases/tag/v0.2.7
[0.2.6]: https://github.com/acald-creator/security-compliance-hub/releases/tag/v0.2.6
[0.2.5]: https://github.com/acald-creator/security-compliance-hub/releases/tag/v0.2.5
[0.2.4]: https://github.com/acald-creator/security-compliance-hub/releases/tag/v0.2.4
[0.2.3]: https://github.com/acald-creator/security-compliance-hub/releases/tag/v0.2.3
[0.2.2]: https://github.com/acald-creator/security-compliance-hub/releases/tag/v0.2.2
[0.2.1]: https://github.com/acald-creator/security-compliance-hub/releases/tag/v0.2.1
[0.2.0]: https://github.com/acald-creator/security-compliance-hub/releases/tag/v0.2.0
[0.1.0]: https://github.com/acald-creator/security-compliance-hub/releases/tag/v0.1.0
