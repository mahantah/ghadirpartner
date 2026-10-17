#!/usr/bin/env python3
"""Fix customer-serial model dropdown in assembled live web app.

Replaces only the JS reference of previous V2 serial filter implementation;
CSS, authorization, print features, database and API endpoints are unchanged.
"""
from pathlib import Path
import sys

MARK="GHADIR_CUSTOMER_SERIAL_MODEL_OPTIONS_V3_20261017"
root=Path(sys.argv[1]) if len(sys.argv)>1 else None
if root is None or not (root/"app.html").is_file():
    raise SystemExit("Expected deployed app.html")
app=root/"app.html"
s=app.read_text(encoding="utf-8")
if MARK in s:
    if s.count(MARK)==1 and "/assets/warehouse-serial-filters-v3.js?v=20261017m3" in s:
        print("Inventory model selection V3 already installed")
        sys.exit(0)
    raise SystemExit("Partial V3 installation found")
if "GHADIR_CUSTOMER_SERIAL_RESTORE_NAV_GHOST_V2_20261017" not in s:
    raise SystemExit("Expected previously published V2 customer serial fix")
old="/assets/warehouse-serial-filters-v2.js?v=20261017f2"
new="/assets/warehouse-serial-filters-v3.js?v=20261017m3"
if s.count(old)!=1 or s.count("</head>")!=1:
    raise SystemExit("Unexpected V2 asset reference or HTML head")
s=s.replace(old,new,1)
s=s.replace("</head>","<!-- "+MARK+" -->\n</head>",1)
if s.count(new)!=1 or s.count(MARK)!=1:
    raise SystemExit("V3 consistency check failed")
app.write_text(s,encoding="utf-8")
print("Customer serial model options refresh installed")
