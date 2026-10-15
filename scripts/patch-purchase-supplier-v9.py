#!/usr/bin/env python3
from pathlib import Path
import sys

root=Path(sys.argv[1] if len(sys.argv)>1 else '.')
index=root/'index.php'
app=root/'app.html'
BACK='WAREHOUSE_PURCHASE_SUPPLIER_V9_20261015'
FRONT='WAREHOUSE_PURCHASE_SUPPLIER_UI_V9_20261015'
if not index.exists() or not app.exists(): raise SystemExit('index.php/app.html not found')

s=index.read_text(encoding='utf-8')
rs=s.find("if($p==='/api/warehouse/import'||$p==='/api/warehouse/import-file')")
re=s.find("if($p==='/api/warehouse/carton/delete')",rs)
if rs<0 or re<0: raise SystemExit('warehouse import route bounds not found')
b=s[rs:re]
if "$supplier=trim((string)($x['supplier']??''));" not in b:
    b=b.replace("$prod=$x['product']??'';","$prod=$x['product']??'';$supplier=trim((string)($x['supplier']??''));",1)
if "'supplier'=>$supplier" not in b:
    b=b.replace("'product'=>$prod,'color'=>$x['color']??'',","'product'=>$prod,'color'=>$x['color']??'','supplier'=>$supplier,",1)
invpos=b.find("'carton_id'=>$id,'carton_code'=>$code")
if invpos<0: raise SystemExit('inventory carton fields missing')
pre=b[invpos:b.find('ghadir_warehouse_record',invpos) if b.find('ghadir_warehouse_record',invpos)>=0 else len(b)]
if "'supplier'=>$supplier" not in pre:
    b=b[:invpos]+b[invpos:].replace("'carton_id'=>$id,'carton_code'=>$code,","'carton_id'=>$id,'carton_code'=>$code,'supplier'=>$supplier,",1)
if BACK not in b: b='/* '+BACK+' */'+b
s=s[:rs]+b+s[re:]

# Resolve supplier for every inventory API row from its own field or source carton.
ig=s.find("if($p==='/api/inventory'&&$m==='GET')")
if ig<0: raise SystemExit('inventory GET route not found')
ie=s.find("\nif(",ig+1)
if ie<0: ie=len(s)
ib=s[ig:ie]
if 'PURCHASE_SUPPLIER_RESOLVE_V9' not in ib:
    resolved="""if($p==='/api/inventory'&&$m==='GET'){auth();out(db(false,function($s){
    /* PURCHASE_SUPPLIER_RESOLVE_V9 */
    $byId=[];$byCode=[];
    foreach($s['cartons']??[] as $c){
        $v=trim((string)($c['supplier']??''));if($v==='')continue;
        $id=(int)($c['id']??0);$code=strtoupper(trim((string)($c['code']??'')));
        if($id>0)$byId[$id]=$v;if($code!=='')$byCode[$code]=$v;
    }
    $rows=$s['inventory']??[];
    foreach($rows as &$iv){
        $v=trim((string)($iv['supplier']??''));
        if($v===''){
            $cid=(int)($iv['carton_id']??0);$cc=strtoupper(trim((string)($iv['carton_code']??'')));
            $dcid=(int)($iv['detached_from_carton_id']??0);$dcc=strtoupper(trim((string)($iv['detached_from_carton_code']??'')));
            if($cid>0&&isset($byId[$cid]))$v=$byId[$cid];
            elseif($cc!==''&&isset($byCode[$cc]))$v=$byCode[$cc];
            elseif($dcid>0&&isset($byId[$dcid]))$v=$byId[$dcid];
            elseif($dcc!==''&&isset($byCode[$dcc]))$v=$byCode[$dcc];
            if($v!=='')$iv['supplier']=$v;
        }
    }
    unset($iv);return $rows;
}));}"""
    s=s[:ig]+resolved+s[ie:]
index.write_text(s,encoding='utf-8')

a=app.read_text(encoding='utf-8')
if 'id="whSupplier"' not in a:
    old='<input id="whColor" placeholder="رنگ">'
    if old not in a: raise SystemExit('whColor input missing')
    a=a.replace(old,old+'<input id="whSupplier" placeholder="تامین‌کننده خرید">',1)
else:
    a=a.replace('id="whSupplier" placeholder="نام تامین‌کننده"','id="whSupplier" placeholder="تامین‌کننده خرید"',1)

mf=a.find('async function saveWarehouseCarton()')
ff=a.find('async function saveWarehouseFile()',mf)
if mf<0 or ff<0: raise SystemExit('warehouse save functions missing')
seg=a[mf:ff]
if "supplier:$('whSupplier').value.trim()" not in seg:
    seg=seg.replace("color:$('whColor').value.trim(),","color:$('whColor').value.trim(),supplier:$('whSupplier').value.trim(),",1)
a=a[:mf]+seg+a[ff:]

ff=a.find('async function saveWarehouseFile()')
nf=a.find('function openWarehouseSerials',ff)
seg=a[ff:nf]
if "fd.append('supplier',$('whSupplier').value.trim())" not in seg:
    seg=seg.replace("fd.append('color',$('whColor').value.trim());","fd.append('color',$('whColor').value.trim());fd.append('supplier',$('whSupplier').value.trim());",1)
a=a[:ff]+seg+a[nf:]

sf=a.find('function invSearchText')
rf=a.find('function renderInventory',sf)
if sf>=0 and rf>sf:
    seg=a[sf:rf]
    if 'x.supplier' not in seg: seg=seg.replace('return [','return [x.supplier,',1)
    a=a[:sf]+seg+a[rf:]

rf=a.find('function renderInventory')
imp=a.find('async function importInventory',rf)
if rf>=0 and imp>rf:
    seg=a[rf:imp]
    if 'gp-purchase-supplier-v9' not in seg:
        old='<div class="inv-product">${esc(x.product)}</div>'
        new='<div class="inv-product">${esc(x.product)}<div class="gp-purchase-supplier-v9 small" style="margin-top:4px">تامین‌کننده خرید: <b>${esc(x.supplier||\'-\')}</b></div></div>'
        if old in seg: seg=seg.replace(old,new,1)
    a=a[:rf]+seg+a[imp:]

ow=a.find('function openWarehouseSerials')
dw=a.find('async function deleteWarehouseSerial',ow)
if ow>=0 and dw>ow:
    seg=a[ow:dw]
    if 'تامین‌کننده خرید:' not in seg:
        seg=seg.replace('<p class="small">فقط سریال‌های آزاد قابل حذف هستند.</p>','<p class="small">تامین‌کننده خرید: <b>${esc(c.supplier||\'-\')}</b> — فقط سریال‌های آزاد قابل حذف هستند.</p>',1)
    a=a[:ow]+seg+a[dw:]

if FRONT not in a:
    p=a.lower().rfind('</body>')
    if p<0: raise SystemExit('</body> missing')
    a=a[:p]+'<!-- '+FRONT+' -->\n'+a[p:]
app.write_text(a,encoding='utf-8')
print('purchase supplier v9 applied')