#!/usr/bin/env python3
"""Synthetic reproduction of the suspected 360 surplus; no production data."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"scripts"/"inspect-i90-preswitch-restore.py"
spec=importlib.util.spec_from_file_location("restore_audit", SOURCE)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
assert 1605-150+360 == 1815

codes=["I90-097","I90-098","I90-099","I90-100","I90-101","I90-102",
       "I90-103","I90-109","I90-110","I90-111","I90-112","I90-113",
       "I90-114","I90-115","I90-116","I90-123","I90-124","I90-125"]
cartons=[{"id":i+1,"code":c} for i,c in enumerate(codes)]
before={"cartons":cartons,"inventory":[]}
current={"cartons":cartons,"inventory":[],"warehouse_movements":[]}
for n in range(1455):
    iv={"product":"I90","warehouse_id":1,"serial":"LEGIT-"+str(n),"order_id":0}
    before["inventory"].append(dict(iv))
    current["inventory"].append(dict(iv))
for i in range(360):
    c=i//20+1
    sn="PROTECTED-"+str(i)
    before["inventory"].append({"product":"دستگاه کارتخوان I90","serial":sn,
      "carton_id":c,"warehouse_id":0,"order_id":72})
    current["inventory"].append({"product":"دستگاه کارتخوان I90","serial":sn,
      "carton_id":c,"warehouse_id":1,"order_id":0,
      "returned_at":"2026-10-18 00:05:00","returned_from_order_id":72})
# Another 150 devices were dispatched and remain outside the warehouse.
for i in range(150):
    iv={"product":"I90","warehouse_id":0,"serial":"SHIPPED-"+str(i),"order_id":73}
    before["inventory"].append(dict(iv))
    current["inventory"].append(dict(iv))
current["warehouse_movements"].append({"type":"sale_out","from_warehouse_id":1,
    "to_warehouse_id":0,"qty":150,"serials":["SHIPPED-"+str(i) for i in range(150)]})
found=m.analyze(current,before)
assert found["snapshot_wholesale_i90_count"]==1815
assert found["website_surplus_reported"]==360
assert found["suspected_preswitch_restored_in_wholesale"]==360
assert found["suspected_protected_cartons"]==18
assert found["prior_confirmed_outside_to_wholesale"]==360
assert found["prior_matched_order_unassignment"]==360
assert found["restore_candidates_with_return_movement"]==0
assert found["reconciliation_required"] is True
assert found["do_not_auto_adjust"] is True
assert "PROTECTED-" not in json.dumps(found)

partial=m.analyze(current,None)
assert partial["prior_snapshot_compared"] is False
assert partial["prior_confirmed_outside_to_wholesale"] is None
assert partial["suspected_preswitch_restored_in_wholesale"]==360

# A marked serial with legitimate return movement must be distinguishable.
current["warehouse_movements"].append({"type":"return","from_warehouse_id":0,
   "to_warehouse_id":1,"serials":["PROTECTED-0"]})
assert m.analyze(current,before)["restore_candidates_with_return_movement"]==1

with tempfile.TemporaryDirectory() as temp:
    curr=Path(temp)/"current.json"
    old=Path(temp)/"before.json"
    curr.write_text(json.dumps(current),encoding="utf-8")
    old.write_text(json.dumps(before),encoding="utf-8")
    r=subprocess.run([sys.executable,str(SOURCE),"--current",str(curr),"--before",str(old)],
                     capture_output=True,text=True)
    assert r.returncode==0,r.stderr
    data=json.loads(r.stdout)
    assert data["suspected_preswitch_restored_in_wholesale"]==360
    assert "SHIPPED-" not in r.stdout
    assert "PROTECTED-" not in r.stdout
print("I90 preswitch 360-restoration forensic tests passed")
