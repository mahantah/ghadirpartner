# Ghadir Partner — coding-agent instructions

Scope: this repository is the Persian (RTL) Ghadir Partner sales, orders, customers, POS terminal serials, cartons, and warehouse automation system.

## Source of truth
- **Do not assume root `app.html`, root `VERSION.txt`, or the README version equals production.**
- The production web release is assembled from the pinned `GhadirPartner-Web-V5.3.4.38-*.zip` plus an ordered series of `scripts/patch-*.py` and assets specified in `.github/workflows/deploy-final-v53438.yml`. Review that workflow before editing a production feature.
- Inspect the latest commit, relevant tests and actual code paths before proposing a fix. Keep patching idempotent, fail closed if build anchors drift, and retain the full existing feature set.
- Relevant areas: `index.php` (PHP backend), `app.html` and `assets/` (admin UI), `partners/` (partner portal), `mobile.html` (mobile scanning), `tests/`, `scripts/`, and `.github/workflows/ci-web.yml` (regression suite).

## Nonnegotiable safety
1. Work on a **feature/fix branch and open a pull request**. Never force-push `main`, silently merge, or trigger any production workflow. Production release needs explicit human authorization.
2. Preserve existing sales, customer, order, warehouse, QR/carton, login/OTP, serial, access-control and printing behavior unless the task explicitly changes a feature.
3. Treat `storage/ghadir_data.json`, `config.php`, `partners/config.php`, credentials, backups, database dumps, logs, customer/phone/serial exports and production secrets as sensitive. Do not read, print, upload, paste into PR descriptions or commit them; use sanitized fixtures. Honor `.gitignore`.
4. **Never bypass inventory/carton integrity checks.** Recent deployments have failed at `Snapshot and verify MySQL before deployment` with `protected_carton_state_mismatch` / HTTP 500. Investigate that failure read-only, identify the real state mismatch with authorized operators, and seek approval before any corrective write. Do not disable the pre-switch guard or overwrite live databases.
5. Do not assume a successful PR or CI run proves a release is live. Verify deployment checks separately, and never state that production was changed unless verified.

## Implementation and validation
- For UI: Persian RTL, proper Jalali-date handling, responsive desktop/mobile, navy `#102a43` and orange `#f58220`, accessible icon names/tooltips/keyboard focus; keep visible behavior and user permissions consistent.
- Prefer narrow, reviewable patches over additive overrides piled on top of broken CSS. Identify source-of-truth layout rules first.
- Run applicable `node --check`, `python3 -m py_compile`, PHP syntax checks when PHP changes, and browser/regression fixtures in `tests/`. Wait for `.github/workflows/ci-web.yml` before requesting a merge.
- Finish with: changed files, preserved behaviors, tests (passed/failed/not run), rollback notes, any remaining uncertainty, and a link to the PR.

For Cursor-specific policies see `.cursor/rules/` and `docs/CURSOR_WORKFLOW.md`.
