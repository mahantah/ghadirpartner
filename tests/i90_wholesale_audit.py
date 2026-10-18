#!/usr/bin/env python3
"""Synthetic device counts only. No real serials or production state."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "audit-i90-wholesale.py"
spec = importlib.util.spec_from_file_location("i90_audit", SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def row(product, wh, oid=0, serial="TEST-01"):
    return {"product": product, "warehouse_id": wh, "order_id": oid, "serial": serial}


state = {
    "inventory": [
        row("دستگاه کارتخوان I90", 1, 0, "A1"),
        row("I90", 1, 0, "A2"),
        row("I90", 1, 123, "A3"),
        row("I90", 2, 0, "R1"),
        row("I90", 0, 0, "OUT1"),
        row("I80", 1, 0, "OTHER"),
    ],
    "orders": [{"id": 123, "status": "در حال آماده‌سازی"}],
}
a = mod.audit(state, 3)
assert a["quantity_matches"] and not a["requires_serial_level_reconciliation"]
assert a["counts"]["wholesale_total"] == 3
assert a["counts"]["wholesale_free"] == 2
assert a["counts"]["wholesale_reserved"] == 1
assert a["counts"]["retail_total"] == 1
assert a["counts"]["outside_warehouses"] == 1
assert a["system_i90_total_all_locations"] == 5
assert mod.audit(state, 1455)["system_minus_physical"] == -1452
assert not mod.is_i90_product("I900") and not mod.is_i90_product("I80")
assert mod.is_i90_product("I90 4G") and mod.is_i90_product("دستگاه کارتخوان I90")

bad = {"inventory": list(state["inventory"]) + [row("I90", 1, 123, "A1"), row("I90", None, 0, "")],
       "orders": [{"id": 123, "status": "ارسال شد"}]}
b = mod.audit(bad, 4)
assert b["counts"]["duplicate_serial_rows"] == 1
assert b["counts"]["wholesale_shipped_order_still_in_stock"] == 2
assert b["counts"]["missing_serial_rows"] == 1
assert b["counts"]["other_or_unknown_warehouse"] == 1
assert b["requires_serial_level_reconciliation"]
assert "A1" not in json.dumps(b), "Never disclose device serials in audit output"

# Verified 1455 is a count target, not permission to generate or relabel serials.
full = {"inventory": [row("I90", 1, 0, "DEMO-"+str(i)) for i in range(1455)]}
assert mod.audit(full, 1455)["system_minus_physical"] == 0
assert mod.audit(full, 1455)["counts"]["wholesale_total"] == 1455

with tempfile.TemporaryDirectory() as temp:
    file = Path(temp) / "mock.json"
    file.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
    run = subprocess.run([sys.executable, str(SCRIPT), "--input", str(file), "--expected", "1455"],
                         capture_output=True, text=True)
    assert run.returncode == 2
    obj = json.loads(run.stdout)
    assert obj["system_minus_physical"] == -1452
    assert "TEST-" not in run.stdout
print("I90 wholesale count-only reconciliation tests passed")

# User-provided reconciliation: 1605 previously, 150 exited, 1455 remains in wholesale.
assert 1605 - 150 == 1455
recorded = {
    "inventory": [
        row("I90", 1, 0, "ON-"+str(i)) for i in range(1455)
    ] + [
        row("دستگاه کارتخوان I90", 0, 20, "SENT-"+str(i)) for i in range(150)
    ],
    "warehouse_movements": [{
        "id": 10,
        "type": "sale_out",
        "product": "I90",
        "created_at": "2026-10-17 19:48:00",
        "from_warehouse_id": 1,
        "to_warehouse_id": 0,
        "qty": 150,
        "serials": ["SENT-"+str(i) for i in range(150)],
    }],
}
m = mod.outbound_report(recorded, "2026-10-17", 150)
assert m["sale_out_quantity_matches"]
assert m["recorded_sale_out_qty"] == 150
assert m["movement_serials_still_in_wholesale"] == 0
assert not m["needs_review"]
assert mod.audit(recorded, 1455)["quantity_matches"]

# If movement recorded but stock location was not updated, do NOT deduct 150 again.
wrong = {
    "inventory": [row("I90", 1, 0, "ON-"+str(i)) for i in range(1455)] +
                 [row("I90", 1, 20, "SENT-"+str(i)) for i in range(150)],
    "warehouse_movements": recorded["warehouse_movements"],
}
m2 = mod.outbound_report(wrong, "2026-10-17", 150)
assert m2["recorded_sale_out_qty"] == 150
assert m2["movement_serials_still_in_wholesale"] == 150
assert m2["needs_review"]
assert mod.audit(wrong, 1455)["system_minus_physical"] == 150

# A UI-only exit entry is not a physical warehouse movement.
unrecorded = {"inventory": wrong["inventory"], "warehouse_movements": []}
assert mod.outbound_report(unrecorded, "2026-10-17", 150)["recorded_sale_out_qty"] == 0
assert mod.outbound_report(unrecorded, "2026-10-17", 150)["needs_review"]

with tempfile.TemporaryDirectory() as temp:
    file = Path(temp) / "mock_shipments.json"
    file.write_text(json.dumps(recorded, ensure_ascii=False), encoding="utf-8")
    cli = subprocess.run([sys.executable, str(SCRIPT),
                          "--input", str(file), "--expected", "1455",
                          "--previous-count", "1605", "--exit-quantity", "150",
                          "--exit-date", "2026-10-17"],
                         capture_output=True, text=True)
    assert cli.returncode == 0, cli.stdout + cli.stderr
    evidence = json.loads(cli.stdout)["outbound_evidence"]
    assert evidence["recorded_sale_out_qty"] == 150
    assert "SENT-" not in cli.stdout
