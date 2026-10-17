#!/usr/bin/env python3
"""Remove the obsolete always-visible desktop sidebar shell from the LIVE build.

The V5.3.4.38 assembled web app still contains a 282px navy fixed header
and a matching 282px .wrap margin. Closing .topnav never removed that shell.
This additive CSS patch retains the navigation drawer and mobile top bar,
and does not touch any PHP, API, session, roles, business logic or data.
"""
from pathlib import Path
import sys
MARK="GHADIR_REMOVE_LEGACY_DESKTOP_SIDEBAR_SHELL_V1_20261017"
root=Path(sys.argv[1]) if len(sys.argv)>1 else None
if root is None or not (root/"app.html").is_file():
    raise SystemExit("Expected production app.html directory")
app=root/"app.html"
s=app.read_text(encoding="utf-8")
new="/assets/remove-legacy-desktop-sidebar-shell-v1.css?v=20261017s1"
if MARK in s:
    if s.count(MARK)==1 and s.count(new)==1:
        print("Legacy desktop sidebar shell removal already installed")
        sys.exit(0)
    raise SystemExit("Partial legacy shell fix found")
for required in (
    "GHADIR_NAV_MORPH_V1_20261017",
    "GHADIR_DESKTOP_SIDEBAR_COLLAPSE_V3_20261017",
    "GHADIR_CUSTOMER_MODEL_CATALOG_V5_20261017",
    "sidebar-open", "topnav", 'id="logoutbtn"',
    'data-tab="orders"', 'data-tab="inventory"'):
    if required not in s:
        raise SystemExit("Required production feature missing: "+required)
if s.count("</head>")!=1:
    raise SystemExit("Unexpected HTML head")
s=s.replace("</head>", '<!-- '+MARK+' -->\n'
            '<link rel="stylesheet" href="'+new+'">\n</head>',1)
if s.count(new)!=1 or s.count(MARK)!=1:
    raise SystemExit("Legacy shell patch failed checks")
app.write_text(s,encoding="utf-8")
print("Fixed obsolete 282px desktop sidebar shell and reserved margin")
