#!/usr/bin/env python3
"""Force the assembled admin sidebar panel to obey its open/closed CSS state.

Apply to a generated build or live app.html downloaded via FTPS.
This is UI-only; it does not touch sessions, permissions, data or APIs.
"""
from pathlib import Path
import sys

MARK="GHADIR_DESKTOP_SIDEBAR_COLLAPSE_V3_20261017"
root=Path(sys.argv[1]) if len(sys.argv)>1 else None
if root is None or not (root/"app.html").is_file():
    raise SystemExit("Expected existing app.html")
p=root/"app.html"
s=p.read_text(encoding="utf-8")
if MARK in s:
    if s.count(MARK)==1 and "sidebar-collapse-v3.css" in s:
        print("Desktop sidebar collapse CSS already integrated")
        sys.exit(0)
    raise SystemExit("Partial or duplicate collapse patch; abort")
for needed in ("GHADIR_NAV_MORPH_V1_20261017",
               "GHADIR_SIDEBAR_EDGE_PROFILE_V2_20261017",
               "sidebar-open", "nav-toggle", "sidebar-head",
               'id="changePasswordBtn"', 'id="logoutbtn"'):
    if needed not in s:
        raise SystemExit("Missing required existing UI: "+needed)
if s.count("</head>")!=1:
    raise SystemExit("Unexpected HTML structure")
s=s.replace("</head>",
            '<!-- '+MARK+' -->\n'
            '<link rel="stylesheet" href="/assets/sidebar-collapse-v3.css?v=20261017c1">\n'
            '</head>',1)
if s.count(MARK)!=1 or s.count("sidebar-collapse-v3.css")!=1:
    raise SystemExit("Output check failed")
p.write_text(s,encoding="utf-8")
print("Desktop and mobile sidebar collapse fix installed")
