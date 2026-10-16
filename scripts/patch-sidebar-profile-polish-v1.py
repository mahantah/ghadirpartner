#!/usr/bin/env python3
"""Append a scoped navigation profile polish layer to the assembled live app.
Does not modify API routes, MySQL, current navigation destinations or sessions.
"""
from pathlib import Path
import sys

MARK = "GHADIR_SIDEBAR_PROFILE_POLISH_V1_20261017"
root = Path(sys.argv[1]) if len(sys.argv) > 1 else None
if root is None or not (root / "app.html").is_file():
    raise SystemExit("Expected generated web build with app.html")
file = root / "app.html"
s = file.read_text(encoding="utf-8")
if MARK in s:
    if (s.count(MARK) == 1 and "/assets/sidebar-profile-polish-v1.js" in s
            and "/assets/sidebar-profile-polish-v1.css" in s):
        print("Sidebar profile patch already applied")
        raise SystemExit(0)
    raise SystemExit("Partial sidebar profile patch found; refuse to modify")
if ("GHADIR_NAV_MORPH_V1_20261017" not in s or
        s.count("/assets/nav-morph-v1.js") != 1):
    raise SystemExit("Apply the animated nav morph patch first")
if s.count("</head>") != 1 or s.count("</body>") != 1:
    raise SystemExit("Unexpected web document structure")
if "changePasswordBtn" not in s or "logoutbtn" not in s or "sidebar-head" not in s:
    raise SystemExit("Required legacy account controls missing")
head = ('<!-- ' + MARK + ' -->\n'
        '<link rel="stylesheet" href="/assets/sidebar-profile-polish-v1.css?v=20261017p1">\n')
body = '<script src="/assets/sidebar-profile-polish-v1.js?v=20261017p1"></script>\n'
s = s.replace("</head>", head + "</head>", 1)
s = s.replace("</body>", body + "</body>", 1)
if s.count(MARK) != 1 or s.count("sidebar-profile-polish-v1.js") != 1:
    raise SystemExit("Sidebar polish failed consistency check")
file.write_text(s, encoding="utf-8")
print("Sidebar logo/header/profile patch applied to", file)
