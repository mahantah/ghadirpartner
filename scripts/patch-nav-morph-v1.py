#!/usr/bin/env python3
"""Add animated hamburger/X navigation to the built web app, no DB changes.

The deployed page is assembled from the 5.3.4.38 ZIP plus UI patches; do not
assume the stale app.html in the GitHub repository root is the live page.
"""
from pathlib import Path
import sys

MARKER = "GHADIR_NAV_MORPH_V1_20261017"
root = Path(sys.argv[1]) if len(sys.argv)>1 else None
if root is None or not (root/"app.html").is_file():
    raise SystemExit("Expected built app.html directory")
entry = root/"app.html"
content = entry.read_text(encoding="utf-8")
if MARKER in content:
    if content.count(MARKER) == 1 and "/assets/nav-morph-v1.js" in content:
        print("Navigation morph patch already applied")
        raise SystemExit(0)
    raise SystemExit("Partial navigation morph patch found")
if content.count("</head>") != 1 or content.count("</body>") != 1:
    raise SystemExit("Unexpected HTML document structure")
if "nav-toggle" not in content or "sidebar-head" not in content or "sidebar-open" not in content:
    raise SystemExit("Expected existing navigation not found; refuse to patch")
style = (
    "<!-- " + MARKER + " -->\n"
    '<link rel="stylesheet" href="/assets/nav-morph-v1.css?v=20261017a1">\n'
)
script = '<script src="/assets/nav-morph-v1.js?v=20261017a1"></script>\n'
content = content.replace("</head>", style + "</head>", 1)
content = content.replace("</body>", script + "</body>", 1)
if content.count(MARKER) != 1 or content.count("nav-morph-v1.js") != 1:
    raise SystemExit("Navigation output check failed")
entry.write_text(content, encoding="utf-8")
print("Navigation morph UI installed in", entry)
