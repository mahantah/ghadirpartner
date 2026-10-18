#!/usr/bin/env python3
"""Patch live-built PHP to count only on-premises, unallocated devices.

Runs after patch-performance-v1.py; safe to rerun. No production DB mutations.
"""
from pathlib import Path
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
marker = "GP_PHYSICAL_AVAILABLE_STOCK_V1_20261018"

main = root / "index.php"
portal = root / "partners/index.php"
if not main.is_file() or not portal.is_file():
    raise SystemExit("Both main and partner PHP backends are required")

original_main = (
    "function warehouse_free_stock($s,$product){$n=0;"
    "foreach($s['inventory']??[] as $iv)"
    "if(($iv['product']??'')===$product&&empty($iv['order_id']))$n++;return $n;}"
)
fixed_main = (
    "/* " + marker + " */\n"
    "function warehouse_free_stock($s,$product){$n=0;"
    "foreach($s['inventory']??[] as $iv)"
    "if(($iv['product']??'')===$product"
    "&&(int)($iv['warehouse_id']??0)>0"
    "&&empty($iv['order_id']))$n++;return $n;}"
)

m = main.read_text(encoding="utf-8")
p = portal.read_text(encoding="utf-8")
bootstrap = "if($p==='/api/bootstrap'&&$m==='GET')"
from_stock = (
    "        $free=[];\n"
    "        foreach($s['inventory']??[] as $iv){\n"
    "            if(!empty($iv['order_id']))continue;\n"
)
to_stock = (
    "        /* " + marker + " */\n"
    "        $free=[];\n"
    "        foreach($s['inventory']??[] as $iv){\n"
    "            if((int)($iv['warehouse_id']??0)<1||!empty($iv['order_id']))continue;\n"
)
if marker not in m:
    if m.count(original_main) != 1:
        raise SystemExit("Main stock function structural drift; refusing to patch")
    m = m.replace(original_main, fixed_main, 1)
elif fixed_main not in m:
    raise SystemExit("Main stock patch marker exists but expected code is missing")
if marker not in p:
    if p.count(bootstrap) != 1:
        raise SystemExit("Partner bootstrap missing or duplicated")
    before, after = p.split(bootstrap, 1)
    if after.count(from_stock) != 1:
        raise SystemExit("Partner available-stock loop structural drift; refusing to patch")
    p = before + bootstrap + after.replace(from_stock, to_stock, 1)
elif to_stock not in p:
    raise SystemExit("Partner stock patch marker exists but expected code is missing")

main.write_text(m, encoding="utf-8")
portal.write_text(p, encoding="utf-8")
print("physical available-stock guard applied to main and partner backends")
