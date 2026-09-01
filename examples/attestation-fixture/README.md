# Attestation fixture

The repository-level [`attestation-fixture.yml`](../../.github/workflows/attestation-fixture.yml)
is a manual integration test for the reusable security workflow.

It exercises this path:

1. Build a deterministic file.
2. Upload it as a workflow artifact.
3. Download it inside the reusable security workflow.
4. Generate and sign an SBOM.
5. Create a GitHub Artifact Attestation for the file.
6. Report the provenance status in `security-summary.json`.

Run it with `workflow_dispatch` after the changes are available on the target
branch. The caller grants `attestations: write` only to the attestation job.
