#!/usr/bin/env python3
"""Keep the menu icon on the drawer edge and restore visible profile controls.

Applies to the *built* V5.3.4.38 + patches app.html and to a fetched live copy.
No customer data, auth endpoint, order or warehouse action is touched.
"""
from pathlib import Path
import sys

MARK = "GHADIR_SIDEBAR_EDGE_PROFILE_V2_20261017"
root = Path(sys.argv[1]) if len(sys.argv)>1 else None
if root is None or not (root / "app.html").is_file():
    raise SystemExit("Expected generated app.html directory")
app = root / "app.html"
s = app.read_text(encoding="utf-8")
if MARK in s:
    if s.count(MARK) == 1 and "sidebar-edge-profile-v2.js" in s and "sidebar-edge-profile-v2.css" in s:
        print("Sidebar edge/profile V2 already installed")
        sys.exit(0)
    raise SystemExit("Partial sidebar V2 patch detected; refuse to write")
if ("GHADIR_NAV_MORPH_V1_20261017" not in s
        or "GHADIR_SIDEBAR_PROFILE_POLISH_V1_20261017" not in s
        or "MOBILE_UI_OPTIMIZATION_V1_20261014" not in s):
    raise SystemExit("Apply previous menu, profile and mobile UI patches first")
if s.count("</head>") != 1 or s.count("</body>") != 1:
    raise SystemExit("Unexpected HTML document structure")
if "changePasswordBtn" not in s or "logoutbtn" not in s:
    raise SystemExit("Original user account actions not found")

# Prevent the prior mobile UI observer from pulling the profile back into the
# desktop header. It must remain in the same sidebar on *all* viewport widths.
# Original DOM node IDs and click handlers are retained.
old = """    if(mobile){
      if(user.parentElement!==nav)nav.appendChild(user);
      user.classList.add('mobile-nav-userbox');
    }else{
      if(user.parentElement!==header)header.appendChild(user);
      user.classList.remove('mobile-nav-userbox');
    }"""
new = """    // GHADIR_SIDEBAR_EDGE_PROFILE_USERBOX_V2_20261017
    if(user.parentElement!==nav)nav.appendChild(user);
    user.classList.add('mobile-nav-userbox');"""
if s.count(old) != 1:
    raise SystemExit("Mobile userbox routing drifted, aborting without changes")
s = s.replace(old, new, 1)
s = s.replace(
    "</head>",
    '<!-- ' + MARK + ' -->\n'
    '<link rel="stylesheet" href="/assets/sidebar-edge-profile-v2.css?v=20261017e1">\n</head>',
    1
)
s = s.replace(
    "</body>",
    '<script src="/assets/sidebar-edge-profile-v2.js?v=20261017e1"></script>\n</body>',
    1
)
if s.count(MARK) != 1 or s.count("GHADIR_SIDEBAR_EDGE_PROFILE_USERBOX_V2_20261017") != 1:
    raise SystemExit("Sidebar V2 consistency failure")
app.write_text(s, encoding="utf-8")
print("Visible profile and edge toggle V2 installed in", app)
