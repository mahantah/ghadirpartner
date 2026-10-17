#!/usr/bin/env python3
"""Add real-width aligned, background-free menu button to the assembled web app.
Idempotent UI-only patch; depends on current nav V3 and preserves all actions.
"""
from pathlib import Path
import sys
MARK="GHADIR_SIDEBAR_REAL_EDGE_V4_20261017"
root=Path(sys.argv[1]) if len(sys.argv)>1 else None
if root is None or not (root/"app.html").is_file():
    raise SystemExit("Expected built app.html")
app=root/"app.html"
s=app.read_text(encoding="utf-8")
if MARK in s:
    if s.count(MARK)==1 and "sidebar-real-edge-v4.js" in s and "sidebar-real-edge-v4.css" in s:
        print("Real-edge nav V4 already applied")
        sys.exit(0)
    raise SystemExit("Partial real-edge UI found")
for required in (
 "GHADIR_NAV_MORPH_V1_20261017",
 "GHADIR_SIDEBAR_EDGE_PROFILE_V2_20261017",
 "GHADIR_DESKTOP_SIDEBAR_COLLAPSE_V3_20261017",
 'id="changePasswordBtn"', 'id="logoutbtn"', "sidebar-open"):
    if required not in s:
        raise SystemExit("Existing navigation prerequisite missing: "+required)
if s.count("</head>") != 1 or s.count("</body>") != 1:
    raise SystemExit("Unexpected HTML structure")
s=s.replace("</head>",'<!-- '+MARK+' -->\n'
            '<link rel="stylesheet" href="/assets/sidebar-real-edge-v4.css?v=20261017r1">\n'
            '</head>',1)
s=s.replace("</body>",'<script src="/assets/sidebar-real-edge-v4.js?v=20261017r1"></script>\n'
            '</body>',1)
if s.count(MARK)!=1 or s.count("sidebar-real-edge-v4.js")!=1:
    raise SystemExit("Output verification failed")
app.write_text(s,encoding="utf-8")
print("Real sidebar-edge icon V4 installed")
