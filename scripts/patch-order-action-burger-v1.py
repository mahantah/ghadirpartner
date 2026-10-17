#!/usr/bin/env python3
"""Append order-only hamburger/X animation with no changes to native actions.

This patch modifies compiled production app.html (V5.3.4.38 + patches), NOT
the repository's stale root copy. Original inline action handler remains.
"""
from pathlib import Path
import sys
MARK="GHADIR_ORDER_ACTION_BURGER_V1_20261017"
root=Path(sys.argv[1]) if len(sys.argv)>1 else None
if root is None or not (root/"app.html").is_file():
    raise SystemExit("Expected compiled/live app.html directory")
page=root/"app.html"
s=page.read_text(encoding="utf-8")
css="/assets/order-action-burger-v1.css?v=20261017b1"
js="/assets/order-action-burger-v1.js?v=20261017b1"
if MARK in s:
    if s.count(MARK)==1 and s.count(css)==1 and s.count(js)==1:
        print("Order action burger already installed")
        sys.exit(0)
    raise SystemExit("Partial order action burger reference detected")
for req in ('id="orders"','dots-btn','toggleOrderMenu','closeOrderMenus',
            'data-tab="orders"','data-tab="inventory"','id="logoutbtn"'):
    if req not in s:
        raise SystemExit("Native production action feature missing: "+req)
if s.count("</head>")!=1 or s.count("</body>")!=1:
    raise SystemExit("Invalid HTML document boundary")
s=s.replace("</head>",'<!-- '+MARK+' -->\n<link rel="stylesheet" href="'+css+'">\n</head>',1)
s=s.replace("</body>",'<script src="'+js+'"></script>\n</body>',1)
if s.count(css)!=1 or s.count(js)!=1 or s.count(MARK)!=1:
    raise SystemExit("Failed to validate order action burger patch")
page.write_text(s,encoding="utf-8")
print("Order-only burger/X control activated; native actions preserved")
