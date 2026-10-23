#!/usr/bin/env python3
"""Integrate the reviewed account footer and Uiverse-style morph into a built app.

This only changes generated app.html/CSS/JS; no auth, DB or warehouse files.
"""
from pathlib import Path
from shutil import copy2
import sys

MARK = "GHADIR_PROD_SIDEBAR_CONTROLS_V1_20261023"
NAME = "prod-sidebar-controls-v1"
ROOT = Path(__file__).resolve().parents[1]


def patch(root: Path) -> None:
    html = root / "app.html"
    if not html.is_file():
        raise ValueError("Expected assembled app.html")
    source = html.read_text(encoding="utf-8")
    css = f"/assets/{NAME}.css?v=20261023a1"
    js = f"/assets/{NAME}.js?v=20261023a1"
    if MARK in source:
        if source.count(MARK) != 1 or source.count(css) != 1 or source.count(js) != 1:
            raise ValueError("Partial/duplicate production sidebar patch")
        print("Production sidebar controls already integrated")
        return
    required = (
        "GHADIR_NAV_MORPH_V1_20261017",
        "GHADIR_SIDEBAR_EDGE_PROFILE_V2_20261017",
        "GHADIR_SIDEBAR_REAL_EDGE_V4_20261017",
        'id="changePasswordBtn"',
        'id="logoutbtn"',
        'id="who"',
        "sidebar-open",
    )
    for feature in required:
        if feature not in source:
            raise ValueError("Missing sidebar prerequisite: " + feature)
    if source.count("</head>") != 1 or source.count("</body>") != 1:
        raise ValueError("Unexpected assembled HTML structure")
    for ext in ("css", "js"):
        target = root / "assets" / f"{NAME}.{ext}"
        target.parent.mkdir(parents=True, exist_ok=True)
        copy2(ROOT / "assets" / f"{NAME}.{ext}", target)
    source = source.replace(
        "</head>",
        f'<!-- {MARK} -->\n<link rel="stylesheet" href="{css}">\n</head>', 1,
    ).replace("</body>", f'<script src="{js}"></script>\n</body>', 1)
    if source.count(MARK) != 1 or source.count(css) != 1 or source.count(js) != 1:
        raise ValueError("Production sidebar patch verification failed")
    html.write_text(source, encoding="utf-8")
    print("Production sidebar morph and account footer integrated")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: patch-prod-sidebar-controls-v1.py <assembled-root>")
    patch(Path(sys.argv[1]))
