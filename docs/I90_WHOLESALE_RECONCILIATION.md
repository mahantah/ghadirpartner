# I90 wholesale inventory reconciliation (2026-10-18)

Verified physical count supplied by warehouse: **1,455 devices, wholesale only (warehouse_id = 1)**. This is a reconciliation target, NOT a replacement for `inventory` serial records. Retail (warehouse_id = 2) is separate and must not be adjusted to force this figure.

Run the read-only script **locally on a trusted host** with an already accessible canonical state snapshot:

```bash
python3 scripts/audit-i90-wholesale.py --input /secure/local/state.json --expected 1455
```

The file must have an `inventory` array as in the canonical `state_json`. Never commit, upload to ChatGPT, email, or print that file. Script prints **counts only**, grouped as wholesale free/reserved, retail, outside warehouses and integrity anomalies. Exit code 0 means count matches and no detectable anomalies; 2 means a discrepancy or anomaly; 1 means invalid input. Even exit 0 does not verify which physical devices exist.

To reconcile any difference, perform an authorized serial-by-serial physical scan of wholesale I90 devices and compare it **locally** to the system's warehouse-1 I90 serials and order/dispatch/return movement records. Investigate discrepancies in the previously automatically restored 360 protected-carton serials. Check receipt, dispatch, return, transfer and carton references before making an individually audited correction. Never bulk-insert, delete or reclassify placeholder serials based solely on 1,455; no direct production writes or automatic guard bypass.

This audit does not change business data or deploy to production.

## Confirmed outbound explanation (2026-10-17)

The operator reported that the website showed **1,605** I90 devices in wholesale
before a **150-device outbound entry at the end of 2026-10-17**.
The expected quantity immediately afterward, absent other activity, is **1,455**.

Check that the 150 devices were recorded as real wholesale warehouse movements
and that their individual inventory records actually left warehouse 1.
Do **not** register the exit twice or subtract 150 from an already-correct number.

```bash
python3 scripts/audit-i90-wholesale.py --input /secure/local/state.json --expected 1455 \
    --previous-count 1605 --exit-quantity 150 --exit-date 2026-10-17
```

The sanitized `outbound_evidence` checks `warehouse_movements` with `type=sale_out`,
`from_warehouse_id=1`, `to_warehouse_id=0` on the server-recorded date.
It reports whether 150 were recorded, whether associated serials still appear in wholesale,
or whether exit records have no serial references. The date recorded by the server may differ
from the operator's date near midnight. If 150 devices were logged through another
movement type (such as transfer or adjustment) or order history only, investigate
that legitimate path rather than fabricating `sale_out` movements.

**No change is authorized by this document.** Use a verified backup and inspect the
related receipts, returns and order changes before deciding whether the issue is
a presentation bug, an un-applied exit, or inconsistent historical state.
