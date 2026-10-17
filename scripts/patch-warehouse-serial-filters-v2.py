#!/usr/bin/env python3
"""Replace the unsafe V1 inventory filter script/CSS in the assembled web app.

V2 preserves all inventory API calls and records, and guarantees that
unfiltered customer serials remain visible. Also removes the closed nav
element from layout after the exit transition on iOS.
"""
from pathlib import Path
import sys

MARK="GHADIR_CUSTOMER_SERIAL_RESTORE_NAV_GHOST_V2_20261017"
root=Path(sys.argv[1]) if len(sys.argv)>1 else None
if root is None or not (root/"app.html").is_file():
    raise SystemExit("Expected deployed/assembled app.html")
file=root/"app.html"
s=file.read_text(encoding="utf-8")
if MARK in s:
    if s.count(MARK)==1 and "warehouse-serial-filters-v2.js" in s and "warehouse-serial-filters-v2.css" in s:
        print("V2 inventory UI and closed-nav cleanup already applied")
        sys.exit(0)
    raise SystemExit("Incomplete V2 install: abort")
if "GHADIR_WAREHOUSE_SERIAL_FILTERS_GHOST_V1_20261017" not in s:
    raise SystemExit("Expected V1 UI patch marker not found")
pairs=[
 ("/assets/warehouse-serial-filters-v1.css?v=20261017f1",
  "/assets/warehouse-serial-filters-v2.css?v=20261017f2"),
 ("/assets/warehouse-serial-filters-v1.js?v=20261017f1",
  "/assets/warehouse-serial-filters-v2.js?v=20261017f2"),
]
for old,new in pairs:
    if s.count(old)!=1:
        raise SystemExit("Unexpected or duplicate asset reference: "+old)
    s=s.replace(old,new,1)
if s.count("</head>")!=1:raise SystemExit("Unexpected HTML head")
s=s.replace("</head>","<!-- "+MARK+" -->\n</head>",1)
if s.count(MARK)!=1 or s.count("/assets/warehouse-serial-filters-v1.js")!=0:
    raise SystemExit("V2 consistency check failed")
file.write_text(s,encoding="utf-8")
print("Restored customer serial visibility and removed closed nav compositor")
