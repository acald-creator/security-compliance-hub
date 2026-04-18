# Security Policy

## Supported Versions

This repository hosts reusable GitHub Actions workflows and tooling. Only the
`main` branch is supported; consumers should pin to a tagged release or
commit SHA (see README).

| Version | Supported          |
|---------|--------------------|
| main    | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it
responsibly. **Do not open a public issue.**

1. Report the issue privately via
   [GitHub Security Advisories](https://github.com/acald-creator/security-compliance-hub/security/advisories/new).
2. Include a description of the vulnerability, reproduction steps, affected
   workflow or script, and any potential impact.
3. You will receive an acknowledgment within **72 hours**.
4. We will work with you to understand and address the issue before any
   public disclosure.

## Disclosure Policy

We follow coordinated disclosure. Please allow up to **90 days** for a fix
before publishing details publicly.

## Scope

In scope:

- Reusable workflows under `.github/workflows/`
- Scripts under `scripts/`
- Template files under `templates/`, `hooks/`, `config/`, `examples/`

Out of scope:

- Issues in upstream actions we call (report those to their maintainers).
- Configuration choices made by repositories that consume these workflows.
