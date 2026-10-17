# Ghadir Partner — instructions for coding agents

Persian RTL sales, orders, customers, POS serials, cartons and warehouse software.

## Accurate source of truth
- Production web is assembled from the pinned V5.3.4.38 ZIP plus the ordered patches in `.github/workflows/deploy-final-v53438.yml`. Root `app.html`, `VERSION.txt` and README may be stale. Inspect only the relevant workflow steps and patch files.
- Core: `index.php`, `app.html`, `assets/`, `scripts/`; partner portal `partners/`; scanning `mobile.html`; regression `.github/workflows/ci-web.yml` and `tests/`.

## Mandatory safety
- Create a separate fix/feature branch and PR. No silent merge, force-push, production deploy or production DB write; human approval required.
- Preserve existing access controls, OTP, payments, orders, serial/carton movements, printing and data semantics unless specifically requested.
- Never open/export/commit production customer information, `storage/ghadir_data.json`, `config.php`, `partners/config.php`, credentials, database dumps or backups. Use sanitized fixtures.
- `protected_carton_state_mismatch` / HTTP 500 in the pre-deploy MySQL verification is a blocking safety check. Diagnose read-only; **never bypass it**.
- CI passing does not mean changes are deployed. State what is verified, not assumed.

## Token-efficient workflow
1. Clarify only if essential. Before coding, give one short plan and identify the relevant feature.
2. Search filenames/symbols first (`rg --files`, `rg -n -m 20`). Read **small relevant ranges**, not whole repositories, ZIPs, long embedded base64, logs, or 500-line workflows. Avoid rediscovering already established context.
3. Keep a compact note of the file, function, root cause and invariants. Inspect dependencies only when needed. Prefer a small fix to a new layer of UI overrides.
4. Run the **smallest relevant** syntax/fixture tests while iterating; run all required CI checks before the PR is approved. Return only error excerpts; don't paste entire logs.
5. Final output in Persian: cause, files touched, checks (pass/fail/not run), unresolved risks, PR link. Usually 5–10 lines; expand only on request.

## UI requirements
RTL Persian, Jalali dates, navy `#102a43` and orange `#f58220`; desktop/mobile, keyboard and screen-reader accessible controls. Preserve original actions and counts.

Cursor-specific instructions are in `.cursor/rules/`. Full safe setup and prompts: `docs/CURSOR_WORKFLOW.md`.
