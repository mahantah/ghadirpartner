# Archived GitHub Actions workflows

This directory preserves the original content of **36 retired workflow definitions** from the 2026-10-17 cleanup.

These YAML files are **inactive** because GitHub Actions only discovers workflow definitions placed directly in `.github/workflows/`.

## Active workflows

- `.github/workflows/deploy-final-v53438.yml` — the single canonical production web release. Normally **manually dispatched**; contains backup, deployment, verification, and rollback.
- `.github/workflows/ci-web.yml` — centralized regression CI with all 14 previously independent test jobs.
- `.github/workflows/build-android-r6.yml` — Android R6 package build for the main repo.
- `.github/workflows/check-public-performance.yml` — on-demand public performance diagnostics.

The Android R2 project remains independently maintained in `mahantah/ghadirpartner-android-r2` with its own build workflow.

## Restore an archived workflow

Review the archived YAML and current code first. If genuinely needed, copy the reviewed file back to `.github/workflows/` on a pull request, test, and merge. **Do not reactivate old one-off production hotfixes blindly:** they may use outdated application assumptions, database state or FTP paths.

History remains available via GitHub commit history. Do not delete production release scripts or packaging assets as part of this workflow-only cleanup.
