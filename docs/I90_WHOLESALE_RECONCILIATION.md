# I90 wholesale inventory reconciliation (2026-10-18)

Verified physical count supplied by warehouse: **1,455 devices, wholesale only (warehouse_id = 1)**. This is a reconciliation target, NOT a replacement for `inventory` serial records. Retail (warehouse_id = 2) is separate and must not be adjusted to force this figure.

Run the read-only script **locally on a trusted host** with an already accessible canonical state snapshot:

```bash
python3 scripts/audit-i90-wholesale.py --input /secure/local/state.json --expected 1455
```

The file must have an `inventory` array as in the canonical `state_json`. Never commit, upload to ChatGPT, email, or print that file. Script prints **counts only**, grouped as wholesale free/reserved, retail, outside warehouses and integrity anomalies. Exit code 0 means count matches and no detectable anomalies; 2 means a discrepancy or anomaly; 1 means invalid input. Even exit 0 does not verify which physical devices exist.

To reconcile any difference, perform an authorized serial-by-serial physical scan of wholesale I90 devices and compare it **locally** to the system's warehouse-1 I90 serials and order/dispatch/return movement records. Investigate discrepancies in the previously automatically restored 360 protected-carton serials. Check receipt, dispatch, return, transfer and carton references before making an individually audited correction. Never bulk-insert, delete or reclassify placeholder serials based solely on 1,455; no direct production writes or automatic guard bypass.

This audit does not change business data or deploy to production.
