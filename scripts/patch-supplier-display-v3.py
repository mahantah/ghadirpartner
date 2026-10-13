#!/usr/bin/env python3
from pathlib import Path
import sys

root=Path(sys.argv[1] if len(sys.argv)>1 else ".")
index=root/"index.php"
app=root/"app.html"
BACK_MARK="WAREHOUSE_SUPPLIER_INVENTORY_API_V3_20261013"
FRONT_MARK="WAREHOUSE_SUPPLIER_DISPLAY_V3_20261013"

if not index.exists() or not app.exists():
    raise SystemExit("index.php/app.html not found")

s=index.read_text(encoding="utf-8")
if BACK_MARK not in s:
    old="if($p==='/api/inventory'&&$m==='GET'){auth();out(db(false,fn($s)=>$s['inventory']));}"
    if old in s:
        new="""/* WAREHOUSE_SUPPLIER_INVENTORY_API_V3_20261013 */
if($p==='/api/inventory'&&$m==='GET'){auth();out(db(false,function($s){
    $byId=[];$byCode=[];
    foreach($s['cartons']??[] as $c){
        $v=trim((string)($c['supplier']??''));
        if($v==='')continue;
        $id=(int)($c['id']??0);$code=trim((string)($c['code']??''));
        if($id>0)$byId[$id]=$v;
        if($code!=='')$byCode[$code]=$v;
    }
    $rows=$s['inventory']??[];
    foreach($rows as &$iv){
        if(trim((string)($iv['supplier']??''))!=='')continue;
        $id=(int)($iv['carton_id']??0);$code=trim((string)($iv['carton_code']??''));
        if($id>0&&isset($byId[$id]))$iv['supplier']=$byId[$id];
        elseif($code!==''&&isset($byCode[$code]))$iv['supplier']=$byCode[$code];
    }
    unset($iv);return $rows;
}));}"""
        s=s.replace(old,new,1)
    elif "WAREHOUSE_SUPPLIER_INVENTORY_API_V2_20261013" in s:
        s=s.replace("WAREHOUSE_SUPPLIER_INVENTORY_API_V2_20261013",BACK_MARK,1)
    else:
        raise SystemExit("inventory GET route not found")
    index.write_text(s,encoding="utf-8")

a=app.read_text(encoding="utf-8")
if FRONT_MARK not in a:
    a=a.replace(
        'placeholder="جستجو: سریال / IMEI / مشتری / شرکت / کد / موبایل / کالا"',
        'placeholder="جستجو: سریال / IMEI / مشتری / شرکت / کد / موبایل / کالا / تامین‌کننده"',
        1
    )

    fn=a.find("function invSearchText")
    fn_end=a.find("function renderInventory",fn)
    if fn<0 or fn_end<0:
        raise SystemExit("invSearchText function not found")
    seg=a[fn:fn_end]
    if "x.supplier" not in seg:
        rp=seg.find("return [")
        if rp<0:
            raise SystemExit("invSearchText return array not found")
        seg=seg[:rp+8]+"x.supplier,"+seg[rp+8:]
        a=a[:fn]+seg+a[fn_end:]

    old='<th>شماره باکس</th><th>مدل</th><th>انبار</th><th>رنگ</th>'
    if old in a:
        a=a.replace(old,'<th>شماره باکس</th><th>مدل</th><th>تامین‌کننده</th><th>انبار</th><th>رنگ</th>',1)
    elif '<th>شماره باکس</th><th>مدل</th><th>تامین‌کننده</th><th>انبار</th>' not in a:
        raise SystemExit("warehouse supplier header not found")

    post='<td>${esc(c.product)}${c.supplier?`<div class="small">تامین‌کننده: ${esc(c.supplier)}</div>`:\'\'}</td><td>${esc(location)}</td>'
    base='<td>${esc(c.product)}</td><td>${esc(location)}</td>'
    target='<td>${esc(c.product)}</td><td>${c.supplier?`<b>${esc(c.supplier)}</b>`:\'<span class="small">-</span>\'}</td><td>${esc(location)}</td>'
    if post in a:
        a=a.replace(post,target,1)
    elif base in a:
        a=a.replace(base,target,1)
    elif target not in a:
        raise SystemExit("warehouse supplier row not found")

    post_inv='<div class="inv-product">${esc(x.product)}${x.supplier?`<div class="small">تامین‌کننده: ${esc(x.supplier)}</div>`:\'\'}</div>'
    base_inv='<div class="inv-product">${esc(x.product)}</div>'
    target_inv='<div class="inv-product">${esc(x.product)}<div style="margin-top:5px"><span class="badge">تامین‌کننده: <b>${esc(x.supplier||\'-\')}</b></span></div></div>'
    if post_inv in a:
        a=a.replace(post_inv,target_inv,1)
    elif base_inv in a:
        a=a.replace(base_inv,target_inv,1)
    elif target_inv not in a:
        raise SystemExit("inventory supplier row not found")

    old_modal='<p class="small">فقط سریال‌های آزاد قابل حذف هستند.</p>'
    target_modal='<p class="small">تامین‌کننده: <b>${esc(c.supplier||\'-\')}</b> — فقط سریال‌های آزاد قابل حذف هستند.</p>'
    if old_modal in a:
        a=a.replace(old_modal,target_modal,1)
    elif target_modal not in a:
        raise SystemExit("warehouse supplier modal not found")

    a=a.replace('colspan="9">دسترسی به مخزن امکان‌پذیر نیست.','colspan="12">دسترسی به مخزن امکان‌پذیر نیست.',1)
    a=a.replace('colspan="11">هنوز کارتنی وارد مخزن نشده است.','colspan="12">هنوز کارتنی وارد مخزن نشده است.',1)

    insert=a.find('<section id="warehouse"')
    if insert<0:
        raise SystemExit("warehouse section marker not found")
    a=a[:insert]+'<!-- '+FRONT_MARK+' -->'+a[insert:]
    app.write_text(a,encoding="utf-8")

print("supplier display v3 patch applied")
