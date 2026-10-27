#!/usr/bin/env python3
"""Replace the details renderer in the canonical build; no server/data writes."""
from pathlib import Path
import sys
import re

repo = Path(__file__).resolve().parents[1]
root = Path(sys.argv[1] if len(sys.argv)>1 else ".")
path = root / "app.html"
source = path.read_text(encoding="utf-8")
js = (repo / "assets/order-details-v2.js").read_text(encoding="utf-8").rstrip()
css = (repo / "assets/order-details-v2.css").read_text(encoding="utf-8").rstrip()
mark = "GP_ORDER_DETAILS_V2_20261020"
if mark in source:
    if js in source and css in source and 'data-od2-payment-details' in source and 'data-od2-check-details' in source:
        print("Order details v2 already applied")
        raise SystemExit(0)
    raise SystemExit("Refusing an incomplete or different order-details patch")
pattern = r"(?:async\s+)?function openOrderDetails\(id\)\{.*?\nfunction closeOrderDetails\(\)\{\$\('orderDetailOverlay'\)\.classList\.add\('hidden'\)\}"
matches = list(re.finditer(pattern, source, re.S))
if len(matches)!=1:
    raise SystemExit("Expected one original order-details renderer")
match = matches[0]
updated = source[:match.start()] + js + source[match.end():]
pay_start = updated.index("function openPay(id)")
pay_end = updated.index("async function savePay(id)", pay_start)
pay = updated[pay_start:pay_end]
anchor = "${check}<div class="
if pay.count(anchor)!=1:
    raise SystemExit("Expected one payment-dialog evidence anchor")
pay = pay.replace(anchor, """${check}<button type="button" class="btnlight" data-od2-payment-details onclick="closeModal();openOrderDetails(${Number(o.id)},'payment')">مشاهده اطلاعات پرداخت و مدارک مشتری</button><div class=""", 1)
updated = updated[:pay_start] + pay + updated[pay_end:]
check_start = updated.index("function renderChecks()")
check_end = updated.index("async function approveOrderCheck(id)", check_start)
checks = updated[check_start:check_end]
anchor = """<td>${ok?'<span class="ok">"""
button = """<td><button type="button" class="btnlight" data-od2-check-details onclick="openOrderDetails(${Number(o.id)},'payment')">مدارک و جزئیات</button> ${ok?'<span class="ok">"""
if checks.count(anchor)!=1:
    raise SystemExit("Expected one cheque details action anchor")
checks = checks.replace(anchor, button, 1)
updated = updated[:check_start] + checks + updated[check_end:]
if updated.count("</head>")!=1:
    raise SystemExit("Expected one HTML head")
updated = updated.replace("</head>", "<style>\n"+css+"\n</style>\n</head>", 1)
if len(re.findall(r"function openOrderDetails\(", updated))!=1 or len(re.findall(r"function closeOrderDetails\(", updated))!=1:
    raise SystemExit("Duplicate order-details handlers")
path.write_text(updated, encoding="utf-8")
print("Order details v2 and read-only payment evidence added")
