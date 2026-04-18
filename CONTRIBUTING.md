# Contributing

Thanks for improving `security-compliance-hub`. Changes here ship to every
repository that consumes the reusable workflows, so the bar for correctness
and backward compatibility is higher than for a typical application repo.

## Before you start

1. Read [AUDIT.md](AUDIT.md) for the outstanding issues and design context.
2. Install local tooling once: `bash scripts/setup-tools.sh` (installs
   gitleaks, semgrep, trivy, lefthook under `~/.local/bin`).
3. `bun install` to pull dev dependencies.
4. `lefthook install` to activate the pre-commit, commit-msg, and pre-push
   hooks in your local checkout.

## Development loop

| Task | Command |
|---|---|
| Type check | `bunx tsc --noEmit` |
| Lint & format | `bunx @biomejs/biome check .` (add `--write` to autofix) |
| Dependency audit | `bun audit` |
| Shell lint | `shellcheck scripts/*.sh` |
| Workflow lint | `actionlint` |
| Gitleaks (full history) | `gitleaks git --config .gitleaks.toml .` |
| Gitleaks (staged only) | `gitleaks git --pre-commit --staged --config .gitleaks.toml .` |
| Run compliance dashboard | `GITHUB_TOKEN=... bun run audit:all` |

The same checks run in `.github/workflows/ci.yml`; if it passes locally it
should pass in CI.

## Changing reusable workflows

`.github/workflows/security-scan.yml` and `.github/workflows/devsecops-infinity.yml`
are consumed by external repositories via `workflow_call`. Breaking
changes (renamed inputs, removed outputs, changed defaults that alter
behavior) require a **major-version bump** — see
[Versioning](README.md#versioning).

Checklist when editing them:

- [ ] Pin any new action reference to a commit SHA, not a tag.
- [ ] Add an `if:` guard if the step should skip when prerequisites are
      absent (e.g. no Dockerfile, no `package.json`).
- [ ] Add an entry to `CHANGELOG.md` under `## [Unreleased]`.
- [ ] Run the self-scan workflow (`workflow_dispatch`) against the branch
      to confirm the full matrix still passes.

## Adding a new scanner

1. Add the step to the relevant job in `security-scan.yml`. Pin the action
   to a SHA and comment the tag next to it.
2. If the scanner needs inputs, prefer adding them to an existing
   `workflow_call` input rather than adding a new one — consumers pin to
   the hub and every new input is a coordination cost.
3. Update the `aggregate-results` weighting if the new check should affect
   the score, and document the weight in the `CHANGELOG` entry.
4. Add the action reference to `.github/dependabot.yml` update groups if
   it's a GitHub-first-party action; otherwise it will be picked up by the
   default `github-actions` ecosystem rule.

## Adding a new template

Template files live in three places:

- **`templates/`, `hooks/`, `config/`** — the canonical source that
  `scripts/setup-repo-security.sh` fetches via `fetch_file` at runtime.
- **`examples/target-repo-template/`** — human-readable mirror so browsers
  on the repo can see what consumers get.

When you add or change a template file, update **both** locations.

## Commit messages

No strict convention is enforced in the hub (the `commit-msg` hook block is
intentionally empty), but please keep messages focused and explain *why*.
If you're introducing a breaking change, start the subject line with
`BREAKING:` so the release workflow's auto-generated notes flag it.

## Reporting security issues

See [SECURITY.md](SECURITY.md). Do not open public issues for vulnerabilities.
