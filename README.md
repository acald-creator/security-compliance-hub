# Security Compliance Hub

Reusable GitHub Actions that other repositories pin for secret scanning, SAST, SCA, container checks, SBOM signing, and OpenSSF Scorecard.

This is the enforce layer of a DevSecOps portfolio: stamp a repo, pin an immutable hub release, and let CI run the suite. Scoring and Showcase live in a separate operator console, not in this repository.

Current release: **[v0.2.11](https://github.com/acald-creator/security-compliance-hub/releases/tag/v0.2.11)**. New consumers should pin an exact release or commit SHA.

## What it ships

- **Reusable security scan** (`security-scan.yml`) — Gitleaks, TruffleHog, Semgrep, CodeQL, OWASP Dependency-Check, OSV Scanner, Trivy, Hadolint, Syft, Cosign, and OpenSSF Scorecard. Uploads `security-summary.json` (`acald-creator/security-compliance-hub/security-summary/v1`) for dashboard consumers; its contract is documented in [`schemas/security-summary-v1.schema.json`](schemas/security-summary-v1.schema.json).
- **Reusable DevSecOps infinity loop** (`devsecops-infinity.yml`) — plan / code / build / test / release / deploy / operate / monitor, with security gates per phase.
- **Stamp script** — `scripts/setup-repo-security.sh <path>` writes `security.yml`, Dependabot (ecosystems the target actually uses), Lefthook, `SECURITY.md`, and related templates. Always overwrites `security.yml` and `dependabot.yml`. Other files are skipped unless `FORCE_OVERWRITE=1`.
- **Local tool installer** — Lefthook, Trivy, Gitleaks, and Semgrep on Linux or macOS.
- **HTML audit** — `bun run audit:all` walks GitHub repos via Octokit and writes `compliance-report.html` / `compliance-report.json`, including per-control evidence. That is not the Next.js inventory console (`acald-creator/dev-portfolio-dashboard`).
- **Attestation fixture** — `.github/workflows/attestation-fixture.yml` manually exercises build artifact upload, SBOM signing, and SLSA provenance attestation.
- **Published-image fixture** — `.github/workflows/image-verification-fixture.yml` manually builds a deterministic image, publishes it to GHCR, signs it with keyless Cosign, and verifies the resolved digest with a trusted workflow identity.

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
SECURITY_HUB_REF=v0.2.10 ./scripts/setup-repo-security.sh /path/to/target-repo
# commit, push, then:
gh workflow run security.yml --repo acald-creator/<repo> --ref main
```

### Run the integration fixtures

The fixtures are manual integration tests for the two supply-chain paths that
need a real GitHub runner: artifact provenance and published-image verification.
Run the published-image fixture from the hub repository with:

```bash
gh workflow run image-verification-fixture.yml \
  --repo acald-creator/security-compliance-hub \
  --ref main
gh run list --workflow image-verification-fixture.yml \
  --repo acald-creator/security-compliance-hub --limit 1
gh run watch <run-id> --repo acald-creator/security-compliance-hub --exit-status
```

It builds a deterministic `scratch` image, pushes it to GHCR under a unique
fixture tag, signs that tag with keyless Cosign, resolves the published digest,
and verifies the digest against the trusted GitHub Actions certificate identity.
The run therefore exercises the same tag-to-digest boundary a consumer uses in
the `release-verify` and `deploy` phases. The workflow requires a token with
`packages: write` and `id-token: write`; its reusable-workflow caller also
declares `security-events: read` so GitHub can validate the called workflow's
permission contract.

## Using the reusable workflows

Callers need `actions: read`, `contents: read`, `checks: read`,
`issues: read`, `security-events: write`, and `pull-requests: write`.
Pass optional secrets **by name**, not `secrets: inherit` (Semgrep flags
inherit on every consumer).

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
  actions: read
  id-token: write
  contents: read
  checks: read
  issues: read
  # Required by devsecops-infinity's release phase when it signs/publishes an image.
  packages: write
  security-events: write
  pull-requests: write
  # Required by the reusable supply-chain job; needed even when the optional
  # artifact attestation path below is not configured.
  attestations: write

jobs:
  security:
    uses: acald-creator/security-compliance-hub/.github/workflows/security-scan.yml@v0.2.10
    with:
      severity-threshold: HIGH
      compliance-frameworks: openssf,owasp,slsa
      enable-signing: true
      # Optional: attest a built artifact with GitHub's SLSA provenance.
      # artifact-name: build-artifact
      # artifact-path: dist/example
      # require-owasp-dependency-check: true
    secrets:
      NVD_API_KEY: ${{ secrets.NVD_API_KEY }}
      SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

  devsecops:
    uses: acald-creator/security-compliance-hub/.github/workflows/devsecops-infinity.yml@v0.2.10
    with:
      phase: all
      # Required when a published image should be verified during deploy.
      # certificate-identity-regexp: '^https://github.com/OWNER/REPO/.github/workflows/.*@refs/heads/main$'
      # require-image-verification: true
      # image-tag: v1.2.3  # defaults to github.sha
```

### security-scan.yml inputs

| Input | Default | Description |
|---|---|---|
| `repository` | current repo | Repository to scan |
| `severity-threshold` | `HIGH` | Minimum severity that fails supported Semgrep and Trivy gates (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, or `UNKNOWN`) |
| `compliance-frameworks` | `openssf,owasp,slsa` | Comma-separated list of frameworks to check |
| `enable-signing` | `true` | Enable Sigstore SBOM signing |
| `artifact-path` | empty | Optional built artifact path for SLSA provenance attestation; requires `attestations: write` |
| `artifact-name` | empty | Optional artifact uploaded by an earlier caller job; downloaded before using `artifact-path` |
| `require-owasp-dependency-check` | `false` | Fail when OWASP is enabled but `NVD_API_KEY` is unavailable |

Optional secrets: `NVD_API_KEY` (OWASP Dependency-Check NVD feed), `SNYK_TOKEN`, `SONAR_TOKEN`. Without `NVD_API_KEY`, OWASP Dependency-Check is reported as `unknown`; OSV Scanner still runs. Set `require-owasp-dependency-check: true` to fail instead.

Semgrep and Trivy honor `severity-threshold`. OSV Scanner keeps its native exit
policy, and OWASP Dependency-Check requires `NVD_API_KEY` when enabled.

Outputs: `security-score`, `compliance-status`, `vulnerabilities` (comma-separated failed job names, or `none`), `provenance-status`, `owasp-dependency-check-status`, `dependency-scan-status`, `artifact-digest`, `sbom-digest`, and `attestation-url`. The `security-summary` artifact is `security-summary.json`; validate it against [`schemas/security-summary-v1.schema.json`](schemas/security-summary-v1.schema.json).

For a host-level consumer, use the [Nexus mapping](docs/nexus-security-summary-mapping.md). It defines the immutable repository/commit subject key, provenance checks, and the distinction between failure, unknown, not-requested, and not-applicable evidence.

Known limits of this suite:

- Scorecard uploads SARIF to the GitHub Security tab with `publish_results: false` (OpenSSF rejects publishing from a workflow that also grants `id-token` to Cosign). Private-repository consumers must retain the read permissions shown above; without GitHub Advanced Security, the local SARIF is preserved as an artifact and the upload evidence is recorded as `unknown`.
- SAST runs Semgrep locally and preserves its SARIF artifact. In private repositories without GitHub Advanced Security, unavailable CodeQL or Security-tab uploads are recorded as `unknown` and excluded from the score denominator; scanner findings still fail the job.
- SBOM signing and SLSA provenance are separate controls. SBOM signing runs when enabled; SLSA provenance is `not_requested` unless the caller supplies `artifact-path` and grants `attestations: write`.
- The reusable workflow uses GitHub Artifact Attestations for caller-supplied artifacts. It does not infer an artifact from a source checkout.
- For build outputs, the caller should upload an artifact in a job that the security job `needs`, then pass both `artifact-name` and the path inside the downloaded artifact.
- The summary records SHA-256 digests for the attested artifact, SBOM, SBOM signature, and certificate, plus the GitHub attestation ID and URL when provenance is created.
- When `phase: all` reaches deploy for a published image, `certificate-identity-regexp` must be configured; otherwise verification fails closed. Set `require-image-verification: true` to also fail when the expected image has not been published.
- Image release and SBOM attestation honor the selected `image-tag`; deploy resolves that tag once and verifies the resulting immutable digest.
- Dependency scanning reports `not_applicable` when no supported dependency manifest exists, rather than awarding a passing dependency score without evidence.
- If GitHub default CodeQL setup is enabled on the caller, advanced CodeQL is skipped; Semgrep still runs.
- When `openssf` is omitted from `compliance-frameworks`, OpenSSF is reported as `not_requested` and excluded from the score denominator.

### HTML audit evidence

Each repository entry in `compliance-report.json` includes an `evidence` object
with one record per control. Every record has a `status` (`pass`, `fail`,
`unknown`, or `not_applicable`) and a human-readable `reason`.

- `fail` means the API successfully established that the control is missing or disabled.
- `unknown` means the audit could not establish the control state, usually because GitHub permissions or an external API prevented the check. Unknown controls are excluded from the score denominator and make the repository `partial` (or `unknown` when nothing could be evaluated).
- `signed_commits` measures repository enforcement through required-signature protection or an active branch ruleset; it does not infer policy from the latest commit's verification flag.
- The existing `checks` booleans remain in the JSON for compatibility, but consumers that need an auditable result should use `evidence`.

### devsecops-infinity.yml inputs

| Input | Default | Description |
|---|---|---|
| `phase` | (required) | `plan`, `code`, `build`, `test`, `release`, `release-verify`, `deploy`, `operate`, `monitor`, or `all` |
| `registry` | `ghcr.io` | Container registry hostname used by release/deploy Cosign steps |
| `image` | `${{ github.repository }}` | Image path within the registry |
| `image-tag` | `${{ github.sha }}` | Image tag to sign or verify |
| `certificate-identity-regexp` | empty | Required to verify a published image; trusted Cosign certificate identity regexp |
| `certificate-oidc-issuer-regexp` | GitHub Actions issuer | Trusted Cosign OIDC issuer regexp |
| `require-image-verification` | `false` | Fail deploy when a Docker image is expected but unavailable |

The infinity workflow exposes `image-verification-status`, `image-digest`, and
`image-verification-reason` outputs. Status is `verified`, `not_found`,
`failed`, `not_applicable`, or `not_requested`; callers can use these outputs
as policy inputs without scraping workflow logs.

## Versioning

Consumers should pin, in order of preference:

1. **Commit SHA** — `@<40-char-sha>`. Maximum reproducibility.
2. **Exact release tag** — `@v0.2.11`. Immutable once published.
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
| `scripts/lib/compliance.ts` | Pure compliance scoring and evidence-status rules used by the dashboard |

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
│   ├── attestation-fixture.yml     # Manual artifact attestation integration test
│   ├── self-scan.yml               # Hub dogfood
│   ├── ci.yml
│   └── release.yml                 # Semver tag → moving @v0
├── scripts/
│   ├── setup-tools.sh
│   ├── setup-repo-security.sh
│   ├── install-commit-tools.sh
│   ├── compliance-dashboard.ts
│   └── lib/
│       ├── compliance.ts
│       └── compliance.test.ts
├── schemas/
│   └── security-summary-v1.schema.json
├── docs/
│   └── nexus-security-summary-mapping.md
├── templates/                      # SECURITY.md, insights, threat model
├── examples/target-repo-template/  # Copyable consumer files
├── hooks/lefthook.yml
└── CHANGELOG.md
```

## License

This project is released under the [MIT License](LICENSE).
