#!/usr/bin/env python3
"""Sanitized render/patch regression; never reads customer state or config."""
from pathlib import Path
import subprocess
import tempfile
import re
import sys

repo=Path(__file__).resolve().parents[1]
patch=repo/"scripts/patch-order-details-v2.py"
js=(repo/"assets/order-details-v2.js").read_text().rstrip()
css=(repo/"assets/order-details-v2.css").read_text().rstrip()

def verify(source):
    assert js in source and css in source
    assert "async /* GP_ORDER_DETAILS_V2_" not in source, "Async declaration prefix must not become a standalone expression"
    assert source.count("function openOrderDetails(")==1
    assert source.count("function closeOrderDetails(")==1
    assert "data-od2-payment-details" in source
    assert "data-od2-check-details" in source
    with tempfile.TemporaryDirectory() as d:
        for i,script in enumerate(re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>",source,re.S)):
            if not script.strip():continue
            target=Path(d)/("inline-"+str(i)+".js")
            target.write_text(script)
            subprocess.run(["node","--check",str(target)],check=True,capture_output=True)

if len(sys.argv)>1:
    candidates=list(Path(sys.argv[1]).rglob("app.html"))
    assert len(candidates)==1, "Expected one canonical app.html"
    verify(candidates[0].read_text())
    print("PASS: complete canonical build includes details v2 and both financial entry points")
    raise SystemExit(0)

original=(repo/"app.html").read_text().replace("function openOrderDetails(id){", "async function openOrderDetails(id){", 1)
with tempfile.TemporaryDirectory() as d:
    target=Path(d)/"app.html"
    target.write_text(original)
    subprocess.run([sys.executable,str(patch),d],check=True)
    updated=target.read_text()
    verify(updated)
    for name,end in [("async function savePay(id)","function renderChecks()"),
                     ("async function approveOrderCheck(id)","const baseToggleOrderMenu")]:
        # Compare the complete unchanged finance action region, not just labels.
        start=original.index(name);finish=original.index(end,start)
        assert original[start:finish] in updated
    subprocess.run([sys.executable,str(patch),d],check=True)
    assert updated==target.read_text(), "Patch must be idempotent"
    for bad in [original.replace("function openOrderDetails(id){","function renamedDetails(id){"),
                original+"\nfunction closeOrderDetails(){}",
                original.replace("__NEVER_PRESENT__","")+"\n/* GP_ORDER_DETAILS_V2_20261020 */"]:
        target.write_text(bad)
        result=subprocess.run([sys.executable,str(patch),d],capture_output=True)
        assert result.returncode!=0
        assert target.read_text()==bad, "Rejected patch must not partially write"
print("PASS: syntax, original finance actions, idempotence and fail-closed patch guards")
