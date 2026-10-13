#!/usr/bin/env python3
from pathlib import Path
import sys

root=Path(sys.argv[1] if len(sys.argv)>1 else ".")
index=root/"index.php"
app=root/"app.html"
BACK_MARK="WAREHOUSE_SUPPLIER_INVENTORY_API_V2_20261013"
FRONT_MARK="WAREHOUSE_SUPPLIER_DISPLAY_V2_20261013"

if not index.exists() or not app.exists():
    raise SystemExit("index.php/app.html not found")

s=index.read_text(encoding="utf-8")
if BACK_MARK not in s:
    old="if($p==='/api/inventory'&&$m==='GET'){auth();out(db(false,fn($s)=>$s['inventory']));}"
    new="""/* WAREHOUSE_SUPPLIER_INVENTORY_API_V2_20261013 */
if($p==='/api/inventory'&&$m==='GET'){auth();out(db(false,function($s){
    $supplierByCartonId=[];$supplierByCartonCode=[];
    foreach($s['cartons']??[] as $c){
        $supplier=trim((string)($c['supplier']??''));
        if($supplier==='')continue;
        $cid=(int)($c['id']??0);$cc=trim((string)($c['code']??''));
        if($cid>0)$supplierByCartonId[$cid]=$supplier;
        if($cc!=='')$supplierByCartonCode[$cc]=$supplier;
    }
    $rows=$s['inventory']??[];
    foreach($rows as &$iv){
        if(trim((string)($iv['supplier']??''))!=='')continue;
        $cid=(int)($iv['carton_id']??0);$cc=trim((string)($iv['carton_code']??''));
        if($cid>0&&isset($supplierByCartonId[$cid]))$iv['supplier']=$supplierByCartonId[$cid];
        elseif($cc!==''&&isset($supplierByCartonCode[$cc]))$iv['supplier']=$supplierByCartonCode[$cc];
    }
    unset($iv);return $rows;
}));}"""
    if old not in s:
        raise SystemExit("inventory GET route pattern not found")
    s=s.replace(old,new,1)
    index.write_text(s,encoding="utf-8")

a=app.read_text(encoding="utf-8")
if FRONT_MARK not in a:
    a=a.replace(
        'placeholder="جستجو: سریال / IMEI / مشتری / شرکت / کد / موبایل / کالا"',
        'placeholder="جستجو: سریال / IMEI / مشتری / شرکت / کد / موبایل / کالا / تامین‌کننده"',
        1
    )
    old="return [x.product,x.serial,x.imei,x.order_number,owner.name,owner.company,owner.code,owner.mobile,owner.order?owner.order.number:''].join(' ').toLowerCase();"
    new="return [x.product,x.serial,x.imei,x.order_number,x.supplier,owner.name,owner.company,owner.code,owner.mobile,owner.order?owner.order.number:''].join(' ').toLowerCase();"
    if old not in a:
        raise SystemExit("invSearchText pattern not found")
    a=a.replace(old,new,1)

    old='<th>شماره باکس</th><th>مدل</th><th>انبار</th><th>رنگ</th>'
    new='<th>شماره باکس</th><th>مدل</th><th>تامین‌کننده</th><th>انبار</th><th>رنگ</th>'
    if old not in a:
        raise SystemExit("warehouse table header pattern not found")
    a=a.replace(old,new,1)

    post_supplier='<td>${esc(c.product)}${c.supplier?`<div class="small">تامین‌کننده: ${esc(c.supplier)}</div>`:\'\'}</td><td>${esc(location)}</td>'
    base_supplier='<td>${esc(c.product)}</td><td>${esc(location)}</td>'
    new_supplier='<td>${esc(c.product)}</td><td>${c.supplier?`<b>${esc(c.supplier)}</b>`:\'<span class="small">-</span>\'}</td><td>${esc(location)}</td>'
    if post_supplier in a:
        a=a.replace(post_supplier,new_supplier,1)
    elif base_supplier in a:
        a=a.replace(base_supplier,new_supplier,1)
    else:
        raise SystemExit("warehouse row supplier pattern not found")

    post_inv='<div class="inv-product">${esc(x.product)}${x.supplier?`<div class="small">تامین‌کننده: ${esc(x.supplier)}</div>`:\'\'}</div>'
    base_inv='<div class="inv-product">${esc(x.product)}</div>'
    new_inv='<div class="inv-product">${esc(x.product)}<div style="margin-top:5px"><span class="badge">تامین‌کننده: <b>${esc(x.supplier||\'-\')}</b></span></div></div>'
    if post_inv in a:
        a=a.replace(post_inv,new_inv,1)
    elif base_inv in a:
        a=a.replace(base_inv,new_inv,1)
    else:
        raise SystemExit("inventory supplier display pattern not found")

    old_modal='<p class="small">فقط سریال‌های آزاد قابل حذف هستند.</p>'
    new_modal='<p class="small">تامین‌کننده: <b>${esc(c.supplier||\'-\')}</b> — فقط سریال‌های آزاد قابل حذف هستند.</p>'
    if old_modal not in a:
        raise SystemExit("warehouse serial modal supplier pattern not found")
    a=a.replace(old_modal,new_modal,1)

    a=a.replace("$('warehouseBody').innerHTML='<tr><td colspan=\"9\">دسترسی به مخزن امکان‌پذیر نیست.</td></tr>'",
                "$('warehouseBody').innerHTML='<tr><td colspan=\"12\">دسترسی به مخزن امکان‌پذیر نیست.</td></tr>'",1)
    a=a.replace("'<tr><td colspan=\"11\">هنوز کارتنی وارد مخزن نشده است.</td></tr>'",
                "'<tr><td colspan=\"12\">هنوز کارتنی وارد مخزن نشده است.</td></tr>'",1)

    insert=a.find('<section id="warehouse"')
    if insert<0:
        raise SystemExit("warehouse section marker not found")
    a=a[:insert]+'<!-- '+FRONT_MARK+' -->'+a[insert:]
    app.write_text(a,encoding="utf-8")

print("supplier display v2 patch applied")
