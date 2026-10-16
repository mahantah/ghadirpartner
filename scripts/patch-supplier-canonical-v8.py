#!/usr/bin/env python3
from pathlib import Path
import sys

root=Path(sys.argv[1] if len(sys.argv)>1 else ".")
index=root/"index.php"
app=root/"app.html"
BACK="SUPPLIER_CANONICAL_BACKEND_V8_20261016"
FRONT="SUPPLIER_CANONICAL_UI_V8_20261016"

if not index.exists() or not app.exists():
    raise SystemExit("index.php/app.html not found")

s=index.read_text(encoding="utf-8")

st=s.find("if($p==='/api/inventory'&&$m==='GET')")
en=s.find("if($p==='/api/scan')",st)
if st<0 or en<0:
    raise SystemExit("inventory GET route not found")
inv_get=f"""/* {BACK} */
if($p==='/api/inventory'&&$m==='GET'){{auth();out(db(false,function($s){{
    $byId=[];$byCode=[];
    foreach($s['cartons']??[] as $c){{
        $supplier=trim((string)($c['supplier']??''));
        if($supplier==='')continue;
        $id=(int)($c['id']??0);$code=strtoupper(trim((string)($c['code']??'')));
        if($id>0)$byId[$id]=$supplier;
        if($code!=='')$byCode[$code]=$supplier;
    }}
    $rows=$s['inventory']??[];
    foreach($rows as &$iv){{
        $supplier=trim((string)($iv['supplier']??''));
        if($supplier===''){{
            $cid=(int)($iv['carton_id']??0);$cc=strtoupper(trim((string)($iv['carton_code']??'')));
            $dcid=(int)($iv['detached_from_carton_id']??0);$dcc=strtoupper(trim((string)($iv['detached_from_carton_code']??'')));
            if($cid>0&&isset($byId[$cid]))$supplier=$byId[$cid];
            elseif($cc!==''&&isset($byCode[$cc]))$supplier=$byCode[$cc];
            elseif($dcid>0&&isset($byId[$dcid]))$supplier=$byId[$dcid];
            elseif($dcc!==''&&isset($byCode[$dcc]))$supplier=$byCode[$dcc];
            if($supplier!=='')$iv['supplier']=$supplier;
        }}
    }}
    unset($iv);return $rows;
}}));}}
"""
s=s[:st]+inv_get+s[en:]

rs=s.find("if($p==='/api/warehouse/import'||$p==='/api/warehouse/import-file')")
re_=s.find("if($p==='/api/warehouse/carton/delete')",rs)
if rs<0 or re_<0:
    raise SystemExit("warehouse import route not found")
block=s[rs:re_]
if "$supplier=trim((string)($x['supplier']??''));" not in block:
    block=block.replace("$prod=$x['product']??'';","$prod=$x['product']??'';$supplier=trim((string)($x['supplier']??''));",1)
if "'supplier'=>$supplier" not in block.split("$s['cartons'][]=$c;",1)[0]:
    block=block.replace("'color'=>$x['color']??'',","'color'=>$x['color']??'','supplier'=>$supplier,",1)
parts=block.split("$s['cartons'][]=$c;",1)
if len(parts)==2 and "'supplier'=>$supplier" not in parts[1]:
    block=block.replace("'carton_code'=>$code,","'carton_code'=>$code,'supplier'=>$supplier,",1)
s=s[:rs]+block+s[re_:]

es=s.find("if($p==='/api/inventory/edit')")
ee=s.find("if($p==='/api/inventory/import'",es)
if es>=0 and ee>es:
    edit_route="""if($p==='/api/inventory/edit'){
    $u=auth(['prep']);$x=input();
    out(db(true,function(&$s)use($x,$u){
        $i=idx($s['inventory'],$x['id']??0);
        if($i<0)fail('سریال پیدا نشد');
        $oldSerial=(string)($s['inventory'][$i]['serial']??'');
        $newSerial=strtoupper(trim((string)($x['serial']??$oldSerial)));
        if($newSerial==='')fail('سریال نمی‌تواند خالی باشد');
        foreach($s['inventory'] as $k=>$iv)if($k!==$i&&strcasecmp((string)($iv['serial']??''),$newSerial)===0)fail('این سریال قبلاً در مخزن ثبت شده است');
        $s['inventory'][$i]['serial']=$newSerial;
        $s['inventory'][$i]['imei']=trim((string)($x['imei']??''));
        if(array_key_exists('supplier',$x)){
            $supplier=trim((string)$x['supplier']);
            $s['inventory'][$i]['supplier']=$supplier;
            $cid=(int)($s['inventory'][$i]['carton_id']??0);
            if($cid>0){
                foreach($s['cartons'] as &$c)if((int)($c['id']??0)===$cid){$c['supplier']=$supplier;break;}
                unset($c);
                foreach($s['inventory'] as &$iv)if((int)($iv['carton_id']??0)===$cid)$iv['supplier']=$supplier;
                unset($iv);
            }
        }
        if($oldSerial!==$newSerial){
            foreach($s['cartons'] as &$c)foreach($c['serials']??[] as &$sn)if(strcasecmp((string)$sn,$oldSerial)===0)$sn=$newSerial;
            unset($sn,$c);
            foreach($s['orders']??[] as &$o)foreach($o['items']??[] as &$it)foreach($it['serials']??[] as &$sn)if(strcasecmp((string)$sn,$oldSerial)===0)$sn=$newSerial;
            unset($sn,$it,$o);
        }
        $s['inventory'][$i]['edited_at']=now();$s['inventory'][$i]['edited_by']=$u['username'];
        return $s['inventory'][$i];
    }));
}
"""
    s=s[:es]+edit_route+s[ee:]

anchor="if($p==='/api/warehouse/carton/delete')"
pos=s.find(anchor)
if pos<0:
    raise SystemExit("carton delete anchor missing")
if "/api/warehouse/carton/supplier" not in s[max(0,pos-5000):pos]:
    route="""if($p==='/api/warehouse/carton/supplier'&&$m==='POST'){
    $u=auth(['prep']);$x=input();
    out(db(true,function(&$s)use($x,$u){
        $cid=(int)($x['carton_id']??0);$supplier=trim((string)($x['supplier']??''));
        if($cid<1)fail('باکس نامعتبر است');
        $found=false;
        foreach($s['cartons'] as &$c)if((int)($c['id']??0)===$cid){$c['supplier']=$supplier;$found=true;break;}
        unset($c);
        if(!$found)fail('باکس پیدا نشد',404);
        $n=0;
        foreach($s['inventory'] as &$iv)if((int)($iv['carton_id']??0)===$cid){$iv['supplier']=$supplier;$n++;}
        unset($iv);
        return ['ok'=>true,'carton_id'=>$cid,'supplier'=>$supplier,'updated_serials'=>$n];
    }));
}
"""
    s=s[:pos]+route+s[pos:]

index.write_text(s,encoding="utf-8")

a=app.read_text(encoding="utf-8")
if 'id="whSupplier"' not in a:
    a=a.replace('<input id="whColor" placeholder="رنگ"></div>',
                '<input id="whColor" placeholder="رنگ"><input id="whSupplier" placeholder="نام تامین‌کننده"></div>',1)
if "supplier:$('whSupplier').value.trim()" not in a:
    a=a.replace("color:$('whColor').value.trim(),capacity:+$('whCapacity').value",
                "color:$('whColor').value.trim(),supplier:$('whSupplier').value.trim(),capacity:+$('whCapacity').value",1)
if "fd.append('supplier',$('whSupplier').value.trim())" not in a:
    a=a.replace("fd.append('color',$('whColor').value.trim());fd.append('capacity'",
                "fd.append('color',$('whColor').value.trim());fd.append('supplier',$('whSupplier').value.trim());fd.append('capacity'",1)

header_old='<th>شماره باکس</th><th>مدل</th><th>انبار</th><th>رنگ</th>'
if header_old in a:
    a=a.replace(header_old,'<th>شماره باکس</th><th>مدل</th><th>تامین‌کننده</th><th>انبار</th><th>رنگ</th>',1)

base_row='<td>${esc(c.product)}</td><td>${esc(location)}</td>'
sup_row='<td>${esc(c.product)}${c.supplier?`<div class="small">تامین‌کننده: ${esc(c.supplier)}</div>`:\'\'}</td><td>${esc(location)}</td>'
target_row='<td>${esc(c.product)}</td><td><b>${esc(c.supplier||\'-\')}</b></td><td>${esc(location)}</td>'
if base_row in a:
    a=a.replace(base_row,target_row,1)
elif sup_row in a:
    a=a.replace(sup_row,target_row,1)
a=a.replace('colspan="11">هنوز کارتنی','colspan="12">هنوز کارتنی',1)

fn=a.find("function invSearchText")
fn_end=a.find("function renderInventory",fn)
if fn>=0 and fn_end>fn:
    seg=a[fn:fn_end]
    if "x.supplier" not in seg:
        seg=seg.replace("return [x.product,x.serial,x.imei,x.order_number,",
                        "return [x.product,x.serial,x.imei,x.order_number,x.supplier,",1)
        a=a[:fn]+seg+a[fn_end:]

base='<div class="inv-product">${esc(x.product)}</div>'
with_small='<div class="inv-product">${esc(x.product)}${x.supplier?`<div class="small">تامین‌کننده: ${esc(x.supplier)}</div>`:\'\'}</div>'
target='<div class="inv-product">${esc(x.product)}<div class="small" style="margin-top:4px">تامین‌کننده: <b>${esc(x.supplier||\'-\')}</b></div></div>'
if base in a:
    a=a.replace(base,target,1)
elif with_small in a:
    a=a.replace(with_small,target,1)

if "function editWarehouseSupplier(" not in a:
    insert=a.find("async function deleteWarehouseSerial")
    helper="""function editWarehouseSupplier(id){let c=(WH.cartons||[]).find(x=>+x.id===+id);if(!c)return;modal(`<h3>ویرایش تامین‌کننده</h3><p><b>${esc(c.code)}</b> — ${esc(c.product)}</p><input id="ewhsupplier" value="${esc(c.supplier||'')}" placeholder="نام تامین‌کننده" style="width:100%"><div class="small" style="margin-top:7px">این نام برای تمام سریال‌های همین باکس ذخیره می‌شود.</div><div class="toolbar" style="margin-top:10px"><button onclick="saveWarehouseSupplier(${id})">ذخیره</button><button class="btnlight" onclick="closeModal()">بستن</button></div>`)}
async function saveWarehouseSupplier(id){try{let supplier=$('ewhsupplier').value.trim();await req('/api/warehouse/carton/supplier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({carton_id:id,supplier})});closeModal();toast('تامین‌کننده ذخیره شد');await loadWarehouse();await loadInventory()}catch(e){alert(e.message)}}
"""
    a=a[:insert]+helper+a[insert:]

needle='<button class="btnlight" onclick="openWarehouseSerials(${c.id})">سریال‌ها</button>'
if needle in a and 'onclick="editWarehouseSupplier(${c.id})"' not in a:
    a=a.replace(needle,needle+'<button class="btnlight" onclick="editWarehouseSupplier(${c.id})">ویرایش تامین‌کننده</button>',1)

if FRONT not in a:
    pos=a.lower().rfind("</body>")
    a=a[:pos]+f"<!-- {FRONT} -->\n"+a[pos:]

app.write_text(a,encoding="utf-8")
print("canonical supplier v8 applied")
