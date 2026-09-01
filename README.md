# Security Compliance Hub

Reusable GitHub Actions that other repositories pin for secret scanning, SAST, SCA, container checks, SBOM signing, and OpenSSF Scorecard.

This is the enforce layer of a DevSecOps portfolio: stamp a repo, pin an immutable hub release, and let CI run the suite. Scoring and Showcase live in a separate operator console, not in this repository.

Current release: **[v0.2.5](https://github.com/acald-creator/security-compliance-hub/releases/tag/v0.2.5)**. New consumers should pin an exact release or commit SHA.

## What it ships

- **Reusable security scan** (`security-scan.yml`) — Gitleaks, TruffleHog, Semgrep, CodeQL, OWASP Dependency-Check, OSV Scanner, Trivy, Hadolint, Syft, Cosign, and OpenSSF Scorecard. Uploads `security-summary.json` (`acald-creator/security-compliance-hub/security-summary/v1`) for dashboard consumers.
- **Reusable DevSecOps infinity loop** (`devsecops-infinity.yml`) — plan / code / build / test / release / deploy / operate / monitor, with security gates per phase.
- **Stamp script** — `scripts/setup-repo-security.sh <path>` writes `security.yml`, Dependabot (ecosystems the target actually uses), Lefthook, `SECURITY.md`, and related templates. Always overwrites `security.yml` and `dependabot.yml`. Other files are skipped unless `FORCE_OVERWRITE=1`.
- **Local tool installer** — Lefthook, Trivy, Gitleaks, and Semgrep on Linux or macOS.
- **HTML audit** — `bun run audit:all` walks GitHub repos via Octokit and writes `compliance-report.html` / `compliance-report.json`. That is not the Next.js inventory console (`acald-creator/dev-portfolio-dashboard`).

The hub dogfoods via `.github/workflows/self-scan.yml`, not a root `security.yml`.

## Prerequisites

- [Bun](https://bun.sh/)
- [Git](https://git-scm.com/)
- Bash (Linux or macOS)
- A `GITHUB_TOKEN` for the HTML audit
- Optional: Python 3 (Semgrep via pip); Rust / Cargo or Homebrew (Cocogitto)

## Getting Started

```bash
git clone https://github.com/acald-creator/security-compliance-hub.git
cd security-compliance-hub
bun install
./scripts/setup-tools.sh
lefthook install
```

Stamp another repository:

```bash
SECURITY_HUB_REF=v0.2.5 ./scripts/setup-repo-security.sh /path/to/target-repo
# commit, push, then:
gh workflow run security.yml --repo acald-creator/<repo> --ref main
```

## Using the reusable workflows

Callers need `security-events: write` and `pull-requests: write`. Pass optional secrets **by name**, not `secrets: inherit` (Semgrep flags inherit on every consumer).

```yaml
name: Security Compliance

on:
  push:
    branches: [main, develop]
  pull_request:
  schedule:
    - cron: "0 0 * * 0"
  workflow_dispatch:

permissions:
  id-token: write
  contents: read
  # Required by devsecops-infinity's release phase when it signs/publishes an image.
  packages: write
  security-events: write
  pull-requests: write
  # Required only when artifact-path is configured below.
  attestations: write

jobs:
  security:
    uses: acald-creator/security-compliance-hub/.github/workflows/security-scan.yml@v0.2.5
    with:
      severity-threshold: HIGH
      compliance-frameworks: openssf,owasp,slsa
      enable-signing: true
      # Optional: attest a built artifact with GitHub's SLSA provenance.
      # artifact-path: dist/example
    secrets:
      NVD_API_KEY: ${{ secrets.NVD_API_KEY }}
      SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

  devsecops:
    uses: acald-creator/security-compliance-hub/.github/workflows/devsecops-infinity.yml@v0.2.5
    with:
      phase: all
```

### security-scan.yml inputs

| Input | Default | Description |
|---|---|---|
| `repository` | current repo | Repository to scan |
| `severity-threshold` | `HIGH` | Minimum severity that fails the build |
| `compliance-frameworks` | `openssf,owasp,slsa` | Comma-separated list of frameworks to check |
| `enable-signing` | `true` | Enable Sigstore SBOM signing |
| `artifact-path` | empty | Optional built artifact path for SLSA provenance attestation; requires `attestations: write` |

Optional secrets: `NVD_API_KEY` (OWASP Dependency-Check NVD feed), `SNYK_TOKEN`, `SONAR_TOKEN`. Without `NVD_API_KEY`, that CVE feed is skipped; OSV Scanner still runs.

Outputs: `security-score`, `compliance-status`, and `vulnerabilities` (comma-separated failed job names, or `none`). The `security-summary` artifact is `security-summary.json`.

Known limits of this suite:

- Scorecard uploads SARIF to the GitHub Security tab with `publish_results: false` (OpenSSF rejects publishing from a workflow that also grants `id-token` to Cosign). Do not request `actions: read` on the Scorecard job.
- SBOM signing and SLSA provenance are separate controls. SBOM signing runs when enabled; SLSA provenance is `not_requested` unless the caller supplies `artifact-path` and grants `attestations: write`.
- The reusable workflow uses GitHub Artifact Attestations for caller-supplied artifacts. It does not infer an artifact from a source checkout.
- If GitHub default CodeQL setup is enabled on the caller, advanced CodeQL is skipped; Semgrep still runs.

### devsecops-infinity.yml inputs

| Input | Default | Description |
|---|---|---|
| `phase` | (required) | `plan`, `code`, `build`, `test`, `release`, `deploy`, `operate`, `monitor`, or `all` |
| `registry` | `ghcr.io` | Container registry hostname used by release/deploy Cosign steps |
| `image` | `${{ github.repository }}` | Image path within the registry |

## Versioning

Consumers should pin, in order of preference:

1. **Commit SHA** — `@<40-char-sha>`. Maximum reproducibility.
2. **Exact release tag** — `@v0.2.5`. Immutable once published.
3. **Moving major tag** — `@v0`. Receives non-breaking updates within the major line. Use only when that update policy is acceptable.

Avoid `@main` in production.

### What counts as a breaking change?

Anything that requires consumers to edit their calling workflow:

- Renamed or removed `workflow_call` inputs or outputs.
- Changed default values that alter behavior (for example flipping `enable-signing`).
- Removed jobs whose results were surfaced in outputs.

Non-breaking: bumping a pinned action SHA, adding an optional input with a backward-compatible default, internal refactors that preserve the contract.

A future `@v1` would be a new major line, not the current pin.

## Scripts

| Script | Purpose |
|---|---|
| `scripts/setup-tools.sh` | Install Lefthook, Trivy, Gitleaks, and Semgrep locally |
| `scripts/setup-repo-security.sh [path]` | Stamp a target repository with workflows, templates, hooks, and Dependabot |
| `scripts/install-commit-tools.sh` | Install Cocogitto |
| `scripts/compliance-dashboard.ts` | HTML/JSON audit of GitHub repos for the authenticated user |

```bash
export GITHUB_TOKEN="ghp_..."
bun run audit:all        # write compliance-report.html and compliance-report.json
bun run setup:repo       # stamp a target (same as setup-repo-security.sh)
```

## Project structure

```
security-compliance-hub/
├── .github/workflows/
│   ├── security-scan.yml           # Reusable security suite
│   ├── devsecops-infinity.yml      # Reusable lifecycle workflow
│   ├── self-scan.yml               # Hub dogfood
│   ├── ci.yml
│   └── release.yml                 # Semver tag → moving @v0
├── scripts/
│   ├── setup-tools.sh
│   ├── setup-repo-security.sh
│   ├── install-commit-tools.sh
│   └── compliance-dashboard.ts
├── templates/                      # SECURITY.md, insights, threat model
├── examples/target-repo-template/  # Copyable consumer files
├── hooks/lefthook.yml
└── CHANGELOG.md
```

## License

This project is released under the [MIT License](LICENSE).
