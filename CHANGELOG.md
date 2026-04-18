# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
See the [Versioning](README.md#versioning) section of the README for how
consumers should pin references to these workflows.

## [Unreleased]

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
- `lefthook.yml`: replaced non-existent `bun audit` claim — Bun 1.3.12 ships
  `bun audit` natively, so the pre-push hook uses it directly again.
- `hooks/lefthook.yml`: replaced invalid `placeholder: true` with a working
  pre-push `bun audit`; switched gitleaks to
  `gitleaks git --pre-commit --staged` so full history is not rescanned on
  every commit; removed empty `commit-msg: commands:` block that broke
  `lefthook validate`.

## [0.1.0] - 2026-04-18

Initial baseline after the AUDIT.md resolution pass. Not yet tagged — this
entry will be filled when the first `v0.1.0` tag is cut.
