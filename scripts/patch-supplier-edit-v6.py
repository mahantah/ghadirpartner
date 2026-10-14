#!/usr/bin/env python3
from pathlib import Path
import sys

root=Path(sys.argv[1] if len(sys.argv)>1 else ".")
index=root/"index.php"
app=root/"app.html"
BACK_MARK="WAREHOUSE_SUPPLIER_EDIT_V6_20261014"
FRONT_MARK="WAREHOUSE_SUPPLIER_EDIT_UI_V6_20261014"

if not index.exists() or not app.exists():
    raise SystemExit("index.php/app.html not found")

s=index.read_text(encoding="utf-8")
if BACK_MARK not in s:
    start=s.find("if($p==='/api/inventory/edit')")
    end=s.find("if($p==='/api/inventory/import'",start)
    if start<0 or end<0:
        raise SystemExit("inventory edit route not found")
    new_route="""/* WAREHOUSE_SUPPLIER_EDIT_V6_20261014 */
if($p==='/api/inventory/edit'){
    $u=auth(['prep']);$x=input();
    out(db(true,function(&$s)use($x,$u){
        $i=idx($s['inventory'],$x['id']??0);
        if($i<0)fail('سریال پیدا نشد');
        $oldSerial=(string)($s['inventory'][$i]['serial']??'');
        $newSerial=strtoupper(trim((string)($x['serial']??$oldSerial)));
        if($newSerial==='')fail('سریال نمی‌تواند خالی باشد');
        foreach($s['inventory'] as $k=>$iv){
            if($k!==$i && strcasecmp((string)($iv['serial']??''),$newSerial)===0)fail('این سریال قبلاً در مخزن ثبت شده است');
        }
        $s['inventory'][$i]['serial']=$newSerial;
        $s['inventory'][$i]['imei']=trim((string)($x['imei']??''));
        $supplierChanged=array_key_exists('supplier',$x);
        $supplier=$supplierChanged?trim((string)$x['supplier']):trim((string)($s['inventory'][$i]['supplier']??''));
        if($supplierChanged)$s['inventory'][$i]['supplier']=$supplier;
        $cartonId=(int)($s['inventory'][$i]['carton_id']??0);
        if($cartonId>0){
            foreach($s['cartons'] as &$c){
                if((int)($c['id']??0)!==$cartonId)continue;
                if($supplierChanged)$c['supplier']=$supplier;
                if($oldSerial!==$newSerial && isset($c['serials']) && is_array($c['serials'])){
                    foreach($c['serials'] as &$sn)if(strcasecmp((string)$sn,$oldSerial)===0)$sn=$newSerial;
                    unset($sn);
                }
                break;
            }
            unset($c);
            if($supplierChanged){
                foreach($s['inventory'] as &$iv)if((int)($iv['carton_id']??0)===$cartonId)$iv['supplier']=$supplier;
                unset($iv);
            }
        }
        if($oldSerial!==$newSerial){
            foreach($s['orders']??[] as &$o){
                foreach($o['items']??[] as &$it){
                    if(!isset($it['serials'])||!is_array($it['serials']))continue;
                    foreach($it['serials'] as &$sn)if(strcasecmp((string)$sn,$oldSerial)===0)$sn=$newSerial;
                    unset($sn);
                }
                unset($it);
            }
            unset($o);
        }
        $s['inventory'][$i]['edited_at']=now();
        $s['inventory'][$i]['edited_by']=$u['username'];
        return $s['inventory'][$i];
    }));
}
"""
    s=s[:start]+new_route+s[end:]
    anchor="if($p==='/api/warehouse/carton/delete')"
    pos=s.find(anchor)
    if pos<0:
        raise SystemExit("warehouse carton delete route not found")
    carton_route="""if($p==='/api/warehouse/carton/supplier'&&$m==='POST'){
    $u=auth(['prep']);$x=input();
    out(db(true,function(&$s)use($x,$u){
        $cid=(int)($x['carton_id']??0);
        $supplier=trim((string)($x['supplier']??''));
        if($cid<1)fail('باکس نامعتبر است');
        $found=false;
        foreach($s['cartons'] as &$c)if((int)($c['id']??0)===$cid){
            $c['supplier']=$supplier;
            $c['supplier_edited_at']=now();
            $c['supplier_edited_by']=$u['username'];
            $found=true;break;
        }
        unset($c);
        if(!$found)fail('باکس پیدا نشد',404);
        $n=0;
        foreach($s['inventory'] as &$iv)if((int)($iv['carton_id']??0)===$cid){
            $iv['supplier']=$supplier;
            $iv['edited_at']=now();
            $iv['edited_by']=$u['username'];
            $n++;
        }
        unset($iv);
        return ['ok'=>true,'carton_id'=>$cid,'supplier'=>$supplier,'updated_serials'=>$n];
    }));
}
"""
    s=s[:pos]+carton_route+s[pos:]
    index.write_text(s,encoding="utf-8")

a=app.read_text(encoding="utf-8")
if FRONT_MARK not in a:
    start=a.find("function editInv(id){")
    end=a.find("async function unassignInv",start)
    if start<0 or end<0:
        raise SystemExit("inventory edit UI functions not found")
    ui="""/* WAREHOUSE_SUPPLIER_EDIT_UI_V6_20261014 */
function gpInvSupplierValue(x){
  let supplier=String((x&&x.supplier)||'').trim();
  if(supplier)return supplier;
  try{
    if(typeof WH!=='undefined'&&WH){
      let c=(WH.cartons||[]).find(function(z){return (+x.carton_id>0&&+z.id===+x.carton_id)||(x.carton_code&&String(z.code||'').toUpperCase()===String(x.carton_code).toUpperCase())});
      if(c&&String(c.supplier||'').trim())return String(c.supplier).trim();
      let iv=(WH.inventory||[]).find(function(z){return String(z.serial||'').toUpperCase()===String(x.serial||'').toUpperCase()});
      if(iv&&String(iv.supplier||'').trim())return String(iv.supplier).trim();
    }
  }catch(e){}
  return '';
}
function editInv(id){
  let x=INV.find(function(z){return z.id===id});if(!x)return;
  let supplier=gpInvSupplierValue(x);
  let cartonNote=+x.carton_id>0?'<div class="small" style="margin-top:6px;color:#64748b">تغییر تامین‌کننده برای این سریال، روی همه سریال‌های همین باکس نیز اعمال می‌شود.</div>':'';
  let html='<h3>ویرایش سریال</h3><p><b>'+esc(x.product)+'</b></p><div class="grid">'+
    '<div><div class="small">سریال</div><input id="eis" class="code" value="'+esc(x.serial)+'" style="width:100%"></div>'+
    '<div><div class="small">IMEI اختیاری — دقیقاً ۱۵ رقم</div><input id="eimei" class="code" inputmode="numeric" maxlength="15" value="'+esc(x.imei||'')+'" placeholder="مثال: 867561081858787" style="width:100%"></div>'+
    '<div style="grid-column:1/-1"><div class="small">تامین‌کننده</div><input id="eisupplier" value="'+esc(supplier)+'" placeholder="نام تامین‌کننده" style="width:100%">'+cartonNote+'</div></div>'+
    '<div class="toolbar" style="margin-top:10px"><button onclick="saveInv('+id+')">ذخیره</button><button class="btnlight" onclick="closeModal()">بستن</button></div>';
  modal(html);
}
async function saveInv(id){
  let imei=$('eimei').value.trim(),supplier=$('eisupplier').value.trim();
  if(imei&&!/^\\d{15}$/.test(imei)){alert('IMEI در صورت ورود باید دقیقاً ۱۵ رقم عددی باشد');return}
  try{
    await req('/api/inventory/edit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:id,serial:$('eis').value,imei:imei,supplier:supplier})});
    closeModal();toast('اطلاعات سریال و تامین‌کننده ویرایش شد');
    await refresh();await loadInventory();
    try{if(typeof loadWarehouse==='function'&&document.getElementById('warehouse')&&!document.getElementById('warehouse').classList.contains('hidden'))await loadWarehouse()}catch(e){}
  }catch(e){alert(e.message)}
}
function editWarehouseSupplier(id){
  let c=(typeof WH!=='undefined'&&WH?(WH.cartons||[]):[]).find(function(x){return +x.id===+id});if(!c)return;
  modal('<h3>ویرایش تامین‌کننده باکس</h3><p><b>'+esc(c.code||'')+'</b> — '+esc(c.product||'')+'</p><div><div class="small">نام تامین‌کننده</div><input id="ewhsupplier" value="'+esc(c.supplier||'')+'" placeholder="نام تامین‌کننده" style="width:100%"></div><div class="small" style="margin-top:7px;color:#64748b">این تغییر روی تمام سریال‌های همین باکس اعمال می‌شود.</div><div class="toolbar" style="margin-top:10px"><button onclick="saveWarehouseSupplier('+id+')">ذخیره</button><button class="btnlight" onclick="closeModal()">بستن</button></div>');
}
async function saveWarehouseSupplier(id){
  try{
    let supplier=$('ewhsupplier').value.trim();
    await req('/api/warehouse/carton/supplier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({carton_id:id,supplier:supplier})});
    closeModal();toast('تامین‌کننده باکس و سریال‌های آن ویرایش شد');
    await loadWarehouse();await loadInventory();
  }catch(e){alert(e.message)}
}
"""
    a=a[:start]+ui+a[end:]

    needle="cell.innerHTML=supplier?('<b>'+esc2(supplier)+'</b>'):'<span class=\"small\">—</span>';"
    if needle in a:
        repl=needle+"if(typeof has==='function'&&has('prep')){const eb=document.createElement('button');eb.className='btnlight';eb.style.cssText='margin-top:5px;padding:5px 8px;font-size:11px';eb.textContent='ویرایش';eb.onclick=function(){editWarehouseSupplier(Number(c.id)||0)};cell.appendChild(document.createElement('br'));cell.appendChild(eb);}"
        a=a.replace(needle,repl,1)
    else:
        needle2='<button class="btnlight" onclick="openWarehouseSerials('+chr(36)+'{c.id})">سریال‌ها</button>'
        if needle2 in a:
            a=a.replace(needle2,needle2+'<button class="btnlight" onclick="editWarehouseSupplier('+chr(36)+'{c.id})">ویرایش تامین‌کننده</button>',1)

    app.write_text(a,encoding="utf-8")

print("supplier edit v6 patch applied")
