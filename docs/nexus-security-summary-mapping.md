# Nexus mapping for `security-summary/v1`

This document defines the host-level consumer contract for the machine-readable
summary emitted by `security-scan.yml`. The summary is evidence for one
repository revision; it is not a mutable repository health record.

## Ingestion boundary

The Nexus consumer should accept a summary only after it has:

1. Downloaded the `security-summary.json` file from the named `security-summary`
   workflow artifact.
2. Validated the complete document against
   [`schemas/security-summary-v1.schema.json`](../schemas/security-summary-v1.schema.json).
3. Confirmed that `repository` and `sha` identify the expected GitHub repository
   and revision for the workflow run.
4. Retained the source artifact and its ingest-time digest alongside the parsed
   projection. A summary is addressed by repository and commit, never by a
   mutable `latest` name.

The schema validates shape and allowed values. It does not prove that an
artifact came from a trusted workflow run, so the Nexus adapter must perform
that GitHub/API provenance check before accepting evidence into a trusted view.

## Field mapping

| Hub field | Nexus projection | Meaning |
|---|---|---|
| `schema` | `evidence_schema` | Contract identifier; must equal `acald-creator/security-compliance-hub/security-summary/v1` |
| `repository` | `subject.repository` | GitHub `OWNER/REPOSITORY` subject |
| `sha` | `subject.revision` | Exact 40-character commit SHA |
| `score` | `assessment.score` | 0–100 aggregate score; useful for sorting and display, not sufficient for a pass decision |
| `failed` | `assessment.failed_controls` | Comma-separated failed job names, or `none`; split into an array without changing names |
| `compliance.*` | `frameworks.*` | OpenSSF, OWASP, and SLSA framework-level status |
| `evidence.*` | `evidence.*` | SBOM, provenance, dependency, attestation, and digest evidence |
| `jobs.*` | `controls.*` | Individual workflow job result for audit detail |

The projection may add `ingested_at`, `source_artifact_digest`, and the
workflow-run identifier. Those are Nexus metadata, not fields to be added to
the versioned hub summary.

## Status semantics

Preserve the source status instead of collapsing every non-pass value into a
failure:

- `success`, `passed`, and `attested` are positive evidence.
- `failure` and `failed` are negative evidence.
- `unknown` means the control could not be evaluated; it must remain visible
  and must not be treated as a pass.
- `not_requested` means the caller did not enable that framework or evidence
  path. It is not a failure and should remain distinct from `unknown`.
- `not_applicable` means the control does not apply to the repository, such as
  dependency scanning without a supported manifest. It should be excluded
  from a denominator when calculating a derived score.
- `skipped` and `cancelled` are workflow results and should remain available in
  `controls.*` for auditability rather than being silently rewritten.

A conservative derived decision is:

```text
fail     if failed != none or any required control is failure/failed
unknown  if no failure is present but required evidence is unknown/cancelled
pass     only when required controls have positive evidence
```

The required-control set belongs to the consuming Nexus policy. The hub
summary must remain an observation, so a consumer should store both the raw
statuses and its policy version with any derived decision.

## Immutable identity and retention

Use the pair `(subject.repository, subject.revision)` as the logical subject
key. Multiple workflow runs for the same commit may exist; retain the
workflow-run identity and source artifact digest so the consumer can explain
which observation it selected. A mutable branch projection such as `main` may
be maintained for convenience, but it must point to a revision-keyed record
and must not replace it.

The digest fields in `evidence` are SHA-256 values for their respective
artifacts. They are evidence references and must not be recomputed as BLAKE3
keys or treated as interchangeable with the Nexus store's internal object
hash.

## Example consumer envelope

The following is a projection shape, not a second version of the hub schema:

```json
{
  "kind": "security-evidence",
  "evidence_schema": "acald-creator/security-compliance-hub/security-summary/v1",
  "subject": {
    "repository": "OWNER/REPOSITORY",
    "revision": "40-character-commit-sha"
  },
  "assessment": {
    "score": 87,
    "failed_controls": [],
    "decision": "unknown",
    "policy_version": "nexus-policy/v1"
  },
  "frameworks": {},
  "evidence": {},
  "controls": {},
  "metadata": {
    "workflow_run_id": 123456789,
    "source_artifact_digest": "sha256:...",
    "ingested_at": "2026-09-01T00:00:00Z"
  }
}
```

The abbreviated values above are illustrative. The raw validated summary is
the authoritative evidence; the envelope is a query-friendly Nexus view.
