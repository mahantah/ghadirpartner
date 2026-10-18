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
