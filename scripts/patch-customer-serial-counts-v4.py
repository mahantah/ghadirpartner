#!/usr/bin/env python3
"""Preserve customer serial counts on the inventory page.

Only updates the JavaScript asset reference in the existing live app.html.
Does not change inventory data, APIs, customer access, or the base UI.
"""
from pathlib import Path
import sys

MARK="GHADIR_CUSTOMER_SERIAL_COUNTS_V4_20261017"
root=Path(sys.argv[1]) if len(sys.argv)>1 else None
if root is None or not (root/"app.html").is_file():
    raise SystemExit("Expected deployed app.html directory")
app=root/"app.html"
s=app.read_text(encoding="utf-8")
old="/assets/warehouse-serial-filters-v3.js?v=20261017m3"
new="/assets/warehouse-serial-filters-v4.js?v=20261017c4"
if MARK in s:
    if s.count(MARK)==1 and s.count(new)==1:
        print("Customer serial counter V4 already installed")
        sys.exit(0)
    raise SystemExit("Partial V4 installation found")
if ("GHADIR_CUSTOMER_SERIAL_MODEL_OPTIONS_V3_20261017" not in s or
        s.count(old)!=1 or s.count("</head>")!=1):
    raise SystemExit("Expected V3 UI version missing or HTML structure changed")
s=s.replace(old,new,1)
s=s.replace("</head>","<!-- "+MARK+" -->\n</head>",1)
if s.count(MARK)!=1 or s.count(new)!=1:
    raise SystemExit("Customer serial counter V4 patch consistency error")
app.write_text(s,encoding="utf-8")
print("Customer serial summary counts stabilized")
