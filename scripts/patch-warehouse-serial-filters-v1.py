#!/usr/bin/env python3
"""Scoped UI-only filters for warehouse cartons/serials and cleanup of
redundant bulk-label card, plus closed-sidebar backing compositor fix.

Patch the assembled V5.3.4.38 + cumulative patches app.html, not the stale
root app.html. This never edits PHP, MySQL, label API, or warehouse data.
"""
from pathlib import Path
import sys

MARK = "GHADIR_WAREHOUSE_SERIAL_FILTERS_GHOST_V1_20261017"
root = Path(sys.argv[1]) if len(sys.argv)>1 else None
if root is None or not (root/"app.html").is_file():
    raise SystemExit("Expected built app.html directory")
p=root/"app.html"
s=p.read_text(encoding="utf-8")
if MARK in s:
    if s.count(MARK)==1 and "warehouse-serial-filters-v1.js" in s:
        print("Warehouse filters/ghost patch already present")
        sys.exit(0)
    raise SystemExit("Incomplete patch marker found")
for req in ('id="warehouseBody"','id="inventoryGroups"',
            "GHADIR_SIDEBAR_REAL_EDGE_V4_20261017",
            'id="changePasswordBtn"','id="logoutbtn"',
            "چاپ و دانلود یکجای لیبل سریال‌ها"):
    if req not in s:
        raise SystemExit("Required existing DOM missing: "+req)
if s.count("</head>")!=1 or s.count("</body>")!=1:
    raise SystemExit("Unexpected HTML structure")
s=s.replace("</head>",
            '<!-- '+MARK+' -->\n'
            '<link rel="stylesheet" href="/assets/warehouse-serial-filters-v1.css?v=20261017f1">\n</head>',1)
s=s.replace("</body>",
            '<script src="/assets/warehouse-serial-filters-v1.js?v=20261017f1"></script>\n</body>',1)
if s.count(MARK)!=1 or s.count("warehouse-serial-filters-v1.js")!=1:
    raise SystemExit("Output consistency error")
p.write_text(s,encoding="utf-8")
print("Warehouse model and date filters, unused label card cleanup, and overlay fix installed")
