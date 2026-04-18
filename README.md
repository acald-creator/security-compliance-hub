# Security Compliance Hub

A centralized DevSecOps toolkit that provides reusable GitHub Actions workflows, local security tooling, and a compliance dashboard for auditing repositories. It is designed to be consumed by other repositories as a single source of truth for security scanning, policy enforcement, and supply-chain integrity.

## Features

- **Reusable security scanning workflow** -- secret detection (Gitleaks, TruffleHog), SAST (Semgrep, CodeQL), dependency scanning (OWASP Dependency-Check, OSV Scanner), container scanning (Trivy, Hadolint), SBOM generation and signing (Syft, Cosign), SLSA provenance, and OpenSSF Scorecard.
- **DevSecOps infinity loop workflow** -- models the full plan/code/build/test/release/deploy/operate/monitor lifecycle with security gates at every phase.
- **Local tool installer** -- one script to install Lefthook, Trivy, Gitleaks, and Semgrep on Linux or macOS.
- **Repository setup script** -- provisions a target repository with security workflows, Dependabot config, git hooks, and security policy templates in a single command.
- **Compliance dashboard** -- a TypeScript script (runs on Bun) that audits every repository for a GitHub user via the Octokit API and generates an HTML compliance report.
- **Git hooks via Lefthook** -- pre-commit hooks for Biome linting/formatting, Gitleaks secret scanning, and Semgrep static analysis; pre-push hook for dependency auditing.
- **Template files** -- ready-to-copy examples for target repositories including security workflow, SECURITY.md, SECURITY-INSIGHTS.yml, Lefthook config, and Cocogitto config.

## Prerequisites

- [Bun](https://bun.sh/) (runtime for TypeScript scripts and package management)
- [Git](https://git-scm.com/)
- Bash shell (Linux or macOS)
- A `GITHUB_TOKEN` environment variable for the compliance dashboard and workflow secrets
- Optional: Python 3 (for Semgrep installation via pip)
- Optional: Rust / Cargo or Homebrew (for Cocogitto installation)

## Getting Started

Clone the repository and install dependencies:

```bash
git clone https://github.com/acald-creator/security-compliance-hub.git
cd security-compliance-hub
bun install
```

Install the local security tools (Lefthook, Trivy, Gitleaks, Semgrep):

```bash
./scripts/setup-tools.sh
```

Activate the pre-commit hooks in this repository:

```bash
lefthook install
```

## Using the Reusable Workflows

The two reusable workflows are designed to be called from any repository via `workflow_call`. Add a workflow file to the consuming repository (for example `.github/workflows/security.yml`):

```yaml
name: Security Compliance

on:
  push:
    branches: [main, develop]
  pull_request:
  schedule:
    - cron: "0 0 * * 0" # Weekly scan

permissions:
  id-token: write
  contents: write
  security-events: write

jobs:
  security:
    uses: acald-creator/security-compliance-hub/.github/workflows/security-scan.yml@main
    with:
      severity-threshold: HIGH          # HIGH, MEDIUM, or LOW
      compliance-frameworks: openssf,owasp,slsa
      enable-signing: true
    secrets: inherit

  devsecops:
    uses: acald-creator/security-compliance-hub/.github/workflows/devsecops-infinity.yml@main
    with:
      phase: all    # or: plan, code, build, test, release, deploy, operate, monitor
    secrets: inherit
```

### security-scan.yml inputs

| Input | Default | Description |
|---|---|---|
| `repository` | current repo | Repository to scan |
| `severity-threshold` | `HIGH` | Minimum severity that fails the build |
| `compliance-frameworks` | `openssf,owasp,slsa` | Comma-separated list of frameworks to check |
| `enable-signing` | `true` | Enable Sigstore SBOM signing and SLSA provenance |

The workflow produces three outputs: `security-score`, `compliance-status`, and `vulnerabilities`.

### devsecops-infinity.yml inputs

| Input | Default | Description |
|---|---|---|
| `phase` | (required) | Phase to run: `plan`, `code`, `build`, `test`, `release`, `deploy`, `operate`, `monitor`, or `all` |
| `registry` | `ghcr.io` | Container registry hostname used by release/deploy cosign steps |
| `image` | `${{ github.repository }}` | Image path within the registry |

## Versioning

Consumers should pin to one of the following refs, in order of preference:

1. **Moving major tag** — `@v1`, `@v2`, etc. Receives non-breaking updates
   (bug fixes, new non-breaking features) within a major line. Maintained
   automatically by `.github/workflows/release.yml` whenever a semver tag
   is cut.
2. **Exact release tag** — `@v1.2.3`. Immutable once published. Safer for
   regulated environments but requires manual bumps.
3. **Commit SHA** — `@<40-char-sha>`. Maximum reproducibility; never
   moves. Use when you cannot tolerate any upstream drift.

Avoid `@main` in production. `main` can contain in-progress or breaking
changes between releases.

### What counts as a breaking change?

Anything that requires consumers to edit their calling workflow:

- Renamed or removed `workflow_call` inputs or outputs.
- Changed default values that alter behavior (e.g. flipping
  `enable-signing` default).
- Removed jobs whose results were surfaced in outputs.

Non-breaking:

- Bumping a pinned action SHA.
- Adding a new optional input with a backward-compatible default.
- Internal refactors that preserve the input/output contract.

## Available Scripts

| Script | Purpose |
|---|---|
| `scripts/setup-tools.sh` | Installs Lefthook, Trivy, Gitleaks, and Semgrep locally |
| `scripts/setup-repo-security.sh [path]` | Provisions a target repository with security workflows, templates, hooks, and Dependabot config |
| `scripts/install-commit-tools.sh` | Installs Cocogitto for conventional commit enforcement |
| `scripts/compliance-dashboard.ts` | Audits all repositories for the authenticated GitHub user and generates `compliance-report.html` |

### npm scripts (via `bun run`)

```bash
bun run audit:all        # Run the compliance dashboard
bun run setup:repo       # Provision a target repo with security config
```

## Running the Compliance Dashboard

Set your GitHub token and run the dashboard:

```bash
export GITHUB_TOKEN="ghp_..."
bun run audit:all
```

This scans every repository for the authenticated user, checks for SECURITY.md, security workflows, Dependabot, CodeQL, branch protection, and commit signing, then writes an HTML report to `compliance-report.html`.

## Project Structure

```
security-compliance-hub/
├── .github/workflows/
│   ├── security-scan.yml           # Reusable security scanning suite
│   └── devsecops-infinity.yml      # Reusable DevSecOps lifecycle workflow
├── scripts/
│   ├── setup-tools.sh              # Local tool installer
│   ├── setup-repo-security.sh      # Target repo provisioning
│   ├── install-commit-tools.sh     # Cocogitto installer
│   └── compliance-dashboard.ts     # Repo compliance auditor
├── examples/
│   └── target-repo-template/       # Template files for target repos
│       ├── SECURITY.md
│       ├── SECURITY-INSIGHTS.yml
│       ├── lefthook.yml
│       └── config/
│           └── cog.toml
├── lefthook.yml                    # Pre-commit and pre-push hook config
├── biome.json                      # Biome linter/formatter config
├── package.json
├── tsconfig.json
└── LICENSE
```

## License

This project is released under the [MIT License](LICENSE).
