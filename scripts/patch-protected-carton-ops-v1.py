#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
MARK = "WAREHOUSE_PROTECTED_CARTON_OPS_V1_20261017"
lib_src = Path(__file__).resolve().parents[1] / "lib" / "protected-cartons.php"
lib_dst = root / "lib" / "protected-cartons.php"
if not lib_src.is_file():
    raise SystemExit("lib/protected-cartons.php missing in repository")
lib_dst.parent.mkdir(parents=True, exist_ok=True)
lib_dst.write_text(lib_src.read_text(encoding="utf-8"), encoding="utf-8")

candidates = [root / "index.php", root / "lib" / "warehouse-v53438.php"]
changed = False
for target in candidates:
    if not target.exists():
        continue
    s = target.read_text(encoding="utf-8")
    if MARK in s:
        print("protected carton ops v1 already applied to " + str(target))
        changed = True
        continue
    original = s

    req = "require_once __DIR__.'/lib/storage.php';"
    req_alt = "require_once __DIR__.'/storage.php';"
    inject = "require_once __DIR__.'/lib/protected-cartons.php';"
    inject_alt = "require_once __DIR__.'/protected-cartons.php';"
    if req in s and inject not in s:
        s = s.replace(req, req + inject, 1)
    elif req_alt in s and inject_alt not in s:
        s = s.replace(req_alt, req_alt + inject_alt, 1)

    detach = "if($from===1&&$to===2&&$oldCartonId>0){"
    detach_fix = "if($from===1&&$to===2&&$oldCartonId>0&&ghadir_protected_should_detach_retail($oldCartonCode!==''?$oldCartonCode:$code)){"
    if detach in s:
        s = s.replace(detach, detach_fix, 1)

    transfer_fail = "if(!$indexes)fail('باکس یا سریال در انبار مبدأ پیدا نشد');"
    transfer_guard = (
        transfer_fail
        + "/* "
        + MARK
        + " */ghadir_protected_transfer_guard($s,$code,$cartonId,$indexes);"
    )
    if transfer_fail in s and MARK not in s:
        s = s.replace(transfer_fail, transfer_guard, 1)

    alloc_needle = "$code=strtoupper(trim((string)($x['code']??'')));if($product===''||$code==='')fail('مدل و شماره باکس یا سریال الزامی است');"
    alloc_fix = "$code=strtoupper(trim((string)($x['code']??'')));if($product===''||$code==='')fail('مدل و شماره باکس یا سریال الزامی است');ghadir_protected_refuse_if_code($s,$code,'allocate');"
    if alloc_needle in s:
        s = s.replace(alloc_needle, alloc_fix, 1)

    del_carton = "if($i<0)fail('باکس پیدا نشد');$id=$s['cartons'][$i]['id'];"
    del_carton_fix = "if($i<0)fail('باکس پیدا نشد');$id=$s['cartons'][$i]['id'];ghadir_protected_refuse_carton_id($s,(int)$id,'carton-delete');"
    if del_carton in s:
        s = s.replace(del_carton, del_carton_fix, 1)

    del_inv = "if($i<0)fail('سریال پیدا نشد');"
    del_inv_fix = "if($i<0)fail('سریال پیدا نشد');ghadir_protected_refuse_if_code($s,(string)($s['inventory'][$i]['serial']??''),'inventory-delete');"
    if "/api/inventory/delete" in s and del_inv in s:
        s = s.replace(del_inv, del_inv_fix, 1)

    if MARK not in s:
        s = "<?php /* " + MARK + " */ ?>\n" + s if s.startswith("<?php") else s
        if s.startswith("<?php"):
            s = s.replace("<?php", "<?php /* " + MARK + " */", 1)

    if s != original:
        target.write_text(s, encoding="utf-8")
        print("protected carton ops v1 patch applied to " + str(target))
        changed = True

if not changed:
    raise SystemExit("protected carton ops v1: no live PHP target found")
