# Repository Audit: security-compliance-hub

**Date:** 2026-04-11
**Auditor:** Claude Code
**Scope:** Full repository — workflows, scripts, configuration, templates

---

## Overview

This is a centralized DevSecOps toolkit providing reusable GitHub Actions workflows, setup scripts, and templates for security scanning and compliance checks across repositories. It uses Bun runtime, TypeScript, Biome for linting, and Lefthook for git hooks.

---

## CRITICAL Issues

### 1. README.md is the Gitleaks README, not the project's README

- **File:** `README.md`
- **Detail:** The entire README is a verbatim copy of the Gitleaks project documentation. There is no actual documentation for security-compliance-hub itself — no setup instructions, architecture overview, or usage guide.
- **Impact:** Contributors and consumers cannot understand what this project does or how to use it.
- **Fix:** Replace with project-specific documentation.

### 2. Missing dependency: `@octokit/rest`

- **File:** `scripts/compliance-dashboard.ts:1`
- **Detail:** The script imports `@octokit/rest`, but it is not listed in `package.json` under `dependencies` or `devDependencies`.
- **Impact:** Running `bun scripts/compliance-dashboard.ts` (the `audit:all` npm script) will fail at import time.
- **Fix:** Run `bun add @octokit/rest` or `bun add -d @octokit/rest`.

### 3. Three scripts referenced in `package.json` do not exist

- **File:** `package.json:8-10`
- **Detail:** The following npm scripts reference files that are not in the repository:
  - `report` -> `./scripts/generate-compliance-report.sh`
  - `scan:local` -> `./scanners/full-scan.sh`
  - `update:policies` -> `./scripts/update-security-baseline.sh`
- **Impact:** Three of the five npm scripts are broken.
- **Fix:** Create the missing scripts or remove the dead references from `package.json`.

---

## HIGH Issues

### 4. Unpinned GitHub Actions — supply chain risk

- **File:** `.github/workflows/security-scan.yml`
- **Lines:** 63, 105, 133
- **Detail:** Several actions use mutable branch tags instead of SHA-pinned references:
  - `trufflehog@main`
  - `Dependency-Check_Action@main`
  - `trivy-action@master`
- **Impact:** Any upstream commit is automatically trusted. A compromised upstream repository can execute arbitrary code in your CI pipeline.
- **Fix:** Pin all actions to full commit SHAs (e.g., `trufflehog@<sha>`).

### 5. CodeQL `analyze` without `init`

- **File:** `.github/workflows/security-scan.yml:87`
- **Detail:** The `sast-scan` job calls `github/codeql-action/analyze@v3` without a prior `github/codeql-action/init@v3` step. The analyze action requires an initialized CodeQL database.
- **Impact:** The SAST analysis step will always fail.
- **Fix:** Add a `codeql-action/init@v3` step before the analyze step, specifying the target languages.

### 6. `aggregate-results` references `supply-chain` but does not list it in `needs`

- **File:** `.github/workflows/security-scan.yml:250`
- **Detail:** The `needs` array is `[secret-scan, sast-scan, dependency-scan, container-scan, openssf-scorecard, owasp-check]`, but the score calculation script on lines 295-299 and the report template on line 335 reference `needs.supply-chain.result`.
- **Impact:** GitHub Actions will produce an invalid context error when `enable-signing` is true.
- **Fix:** Add `supply-chain` to the `needs` array of `aggregate-results`.

### 7. OpenSSF Scorecard output format mismatch

- **File:** `.github/workflows/security-scan.yml:213-219`
- **Detail:** The Scorecard action is configured with `results_format: json` (producing `scorecard.json`), but the subsequent upload step references `scorecard.sarif`.
- **Impact:** The SARIF upload step will fail because the file does not exist.
- **Fix:** Change `results_format` to `sarif` or change the upload path to `scorecard.json`.

### 8. Container scan `if` condition will never match

- **File:** `.github/workflows/security-scan.yml:128`
- **Detail:** `contains(fromJSON('["Dockerfile", "docker-compose.yml"]'), github.event.head_commit.modified)` — `head_commit.modified` is an array of filenames, not a single string. The `contains()` function checks if the first argument contains the second, but passing an array as the second argument does not work as intended.
- **Impact:** The container scan job will never trigger.
- **Fix:** Use a different approach, e.g., check if any modified file matches using `github.event.head_commit.modified` with a proper filter, or use `paths` filters on the workflow trigger.

### 9. Deprecated action versions

- **Files:** `.github/workflows/security-scan.yml`, `.github/workflows/devsecops-infinity.yml`
- **Detail:**
  - `actions/upload-artifact@v3` and `actions/download-artifact@v3` — v3 is deprecated; v4 is the current major version.
  - `returntocorp/semgrep-action@v1` — the organization was renamed to `semgrep`; the correct reference is `semgrep/semgrep-action`.
- **Impact:** Deprecated actions may stop working and do not receive security patches.
- **Fix:** Update to `actions/upload-artifact@v4`, `actions/download-artifact@v4`, and `semgrep/semgrep-action@v1`.

### 10. XSS in HTML report generation

- **File:** `scripts/compliance-dashboard.ts:154-161`
- **Detail:** Repository names (`r.full_name`, `r.name`) are interpolated directly into HTML template literals without escaping. A repository with a name containing `<script>` or other HTML will be rendered as live markup.
- **Impact:** If the generated report is opened in a browser, malicious repository names could execute arbitrary JavaScript.
- **Fix:** HTML-escape all interpolated values before inserting them into the template.

---

## MEDIUM Issues

### 11. `devsecops-infinity.yml` test phase checks file instead of directory

- **File:** `.github/workflows/devsecops-infinity.yml:107`
- **Detail:** `if [ -f "tests/security" ]` checks whether `tests/security` is a regular file. It would typically be a directory.
- **Impact:** Security tests are silently skipped even when a `tests/security/` directory exists.
- **Fix:** Change `-f` to `-d`.

### 12. `bun audit` is not a valid command

- **File:** `lefthook.yml:40`
- **Detail:** Bun does not have an `audit` subcommand. This pre-push hook command will always fail.
- **Impact:** Every `git push` will be blocked if Lefthook is installed.
- **Fix:** Remove the hook, or replace with a valid alternative (e.g., `bunx audit-ci` or `npm audit`).

### 13. `install-commit-tools.sh` lacks `set -e` and uses `sudo`

- **File:** `scripts/install-commit-tools.sh`
- **Detail:**
  - Unlike `setup-tools.sh` and `setup-repo-security.sh`, this script does not use `set -e`, so errors are silently ignored.
  - It uses `sudo mv cog /usr/local/bin/` for the Linux path, while `setup-tools.sh` consistently installs to `$HOME/.local/bin` without sudo.
- **Impact:** Inconsistent behavior; silent failures; requires root privileges unnecessarily on Linux.
- **Fix:** Add `set -e` and install to `$HOME/.local/bin` for consistency.

### 14. Overly broad gitleaks allowlist

- **File:** `.gitleaks.toml:8-20`
- **Detail:** The allowlist excludes entire file categories:
  - All Markdown files in `docs/`
  - All GitHub Actions workflow files
  - All `*.example.*` and `*.template.*` files
  - Any string matching `\$\{\{[^}]+\}\}` (all GitHub Actions expressions)
- **Impact:** Real secrets accidentally committed in these locations will not be detected.
- **Fix:** Narrow the allowlist to specific known false positives rather than broad categories.

### 15. Excessive use of `any` types

- **File:** `scripts/compliance-dashboard.ts:23, 56, 105, 154`
- **Detail:** The script uses `any` in four places despite `strict: true` in `tsconfig.json`.
- **Impact:** Undermines type safety; bugs from incorrect API response shapes will not be caught at compile time.
- **Fix:** Define proper interfaces for the Octokit response types and report structures.

### 16. OWASP ZAP scans `localhost:8080` with no service running

- **File:** `.github/workflows/security-scan.yml:235`
- **Detail:** The ZAP baseline scan targets `http://localhost:8080`, but no service is started in the workflow job.
- **Impact:** The DAST scan will always fail with a connection refused error.
- **Fix:** Either start a service before scanning, or make the target URL configurable via a workflow input.

### 17. Example templates are empty placeholders

- **Directory:** `examples/target-repo-template/`
- **Detail:** Five of six template files contain only `<!-- Placeholder file: original resource not available. -->`:
  - `SECURITY.md`
  - `SECURITY-INSIGHTS.yml`
  - `lefthook.yml`
  - `config/.gitleaks.toml`
  - `config/cog.toml`
- **Impact:** Users who run `setup-repo-security.sh` against the hub repo get non-functional template files.
- **Fix:** Populate these with real, usable template content.

---

## LOW Issues

### 18. No `SECURITY.md` in the hub repo itself

- **Detail:** The repository provides security compliance tooling for other repos but has no security policy of its own.
- **Fix:** Add a `SECURITY.md` with vulnerability reporting instructions.

### 19. No tests

- **Detail:** Zero test files exist anywhere in the repository. The test hook in `lefthook.yml` is commented out.
- **Fix:** Add tests for at least the compliance dashboard logic and the shell scripts.

### 20. `setup-tools.sh` PATH export is not idempotent

- **File:** `scripts/setup-tools.sh:14-15`
- **Detail:** The script appends `export PATH="$LOCAL_BIN:$PATH"` to `.bashrc` and `.zshrc` every time it runs, even though line 13 already checks if the path is present. However, re-running after a shell restart will append again because the check runs in the current session while the append targets the rc file.
- **Fix:** Check the rc file content (e.g., `grep`) before appending.

### 21. `@types/bun` pinned to `latest`

- **File:** `package.json:13`
- **Detail:** Using `"latest"` as a version specifier means every `bun install` can pull a different version.
- **Impact:** Non-reproducible builds; potential breakage from unexpected type changes.
- **Fix:** Pin to a specific version (e.g., `"^1.x.x"`).

### 22. No commit message enforcement

- **File:** `lefthook.yml:18-30`
- **Detail:** All three `commit-msg` hook options (bash script, commitlint, Cocogitto) are commented out.
- **Impact:** Despite including Cocogitto tooling and a `cog.toml` template, conventional commits are not enforced.
- **Fix:** Uncomment and configure one of the options.

### 23. `devsecops-infinity.yml` release phase references undefined env vars

- **File:** `.github/workflows/devsecops-infinity.yml:134-135, 140-142`
- **Detail:** `${{ env.REGISTRY }}` and `${{ env.IMAGE }}` are used in the `cosign sign` and `cosign attest` commands, but these environment variables are never defined in the workflow.
- **Impact:** The release and deploy phases will fail with empty strings in the image references.
- **Fix:** Add workflow inputs for registry and image, or define them as environment variables at the workflow or job level.

### 24. `.gitignore` has malformed glob

- **File:** `.gitignore:16`
- **Detail:** `_.log` appears to be a typo — the intended pattern is likely `*.log`.
- **Fix:** Change `_.log` to `*.log`.

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 3     |
| High     | 7     |
| Medium   | 7     |
| Low      | 7     |
| **Total**| **24**|

## Recommended Priority

1. Replace `README.md` with real project documentation
2. Add `@octokit/rest` to dependencies
3. Create or remove the 3 missing scripts in `package.json`
4. Pin all GitHub Actions to commit SHAs
5. Fix broken workflow steps (CodeQL init, Scorecard format, container scan condition)
6. Populate placeholder template files
7. Add a `SECURITY.md` for the hub repo itself
8. Add basic test coverage
