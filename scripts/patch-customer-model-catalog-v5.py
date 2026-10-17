#!/usr/bin/env python3
"""Expand the customer serial model dropdown using registered device models.

This patch swaps only the JS file reference of the V4 inventory filter.
All models are read from already-loaded client-side state; no database,
API route, login, access role, or serial record is changed.
"""
from pathlib import Path
import sys

MARK = "GHADIR_CUSTOMER_MODEL_CATALOG_V5_20261017"
root = Path(sys.argv[1]) if len(sys.argv)>1 else None
if root is None or not (root/"app.html").is_file():
    raise SystemExit("Expected built app.html directory")
page=root/"app.html"
s=page.read_text(encoding="utf-8")
old="/assets/warehouse-serial-filters-v4.js?v=20261017c4"
new="/assets/warehouse-serial-filters-v5.js?v=20261017m5"
if MARK in s:
    if s.count(MARK)==1 and s.count(new)==1:
        print("Customer model catalog V5 already installed")
        sys.exit(0)
    raise SystemExit("Partial customer model catalog V5 reference")
if ("GHADIR_CUSTOMER_SERIAL_COUNTS_V4_20261017" not in s or
        s.count(old)!=1 or s.count("</head>")!=1):
    raise SystemExit("Expected production V4 customer filter missing")
s=s.replace(old,new,1)
s=s.replace("</head>","<!-- "+MARK+" -->\n</head>",1)
if s.count(MARK)!=1 or s.count(new)!=1 or old in s:
    raise SystemExit("V5 consistency check failed")
page.write_text(s,encoding="utf-8")
print("Serial-tracked product models added to customer serial dropdown")
