#!/usr/bin/env python3
from pathlib import Path
import re, sys

root=Path(sys.argv[1] if len(sys.argv)>1 else ".")
index=root/"index.php"
app=root/"app.html"

BACK_MARK="ORDER_SERIAL_CARTON_META_API_20261011"
FRONT_MARK="ORDER_SERIAL_CARTON_DISPLAY_FIX_20261011"

s=index.read_text(encoding="utf-8")
if BACK_MARK not in s:
    anchor="if($p==='/api/inventory'&&$m==='GET')"
    pos=s.find(anchor)
    if pos<0:
        raise SystemExit("inventory GET route anchor not found")
    endpoint=r'''/* ORDER_SERIAL_CARTON_META_API_20261011 */
if($p==='/api/order/serial-meta'&&$m==='GET'){
    auth();
    $oid=(int)($_GET['id']??0);
    if($oid<1) fail('شماره سفارش نامعتبر است');
    out(db(false,function($s)use($oid){
        $order=null;
        foreach($s['orders']??[] as $o) if((int)($o['id']??0)===$oid){$order=$o;break;}
        if(!$order) fail('سفارش پیدا نشد',404);

        $wanted=[];
        foreach($order['items']??[] as $it){
            foreach($it['serials']??[] as $sn){
                $k=strtoupper(trim((string)$sn));
                if($k!=='') $wanted[$k]=(string)($it['product']??'');
            }
        }

        $cartById=[];$cartBySerial=[];
        foreach($s['cartons']??[] as $c){
            $cid=(int)($c['id']??0);
            $code=trim((string)($c['code']??($c['manufacturer_box_no']??'')));
            if($cid>0 && $code!=='') $cartById[$cid]=$code;
            if($code!=='') foreach($c['serials']??[] as $sn){
                $k=strtoupper(trim((string)$sn));
                if($k!=='') $cartBySerial[$k]=$code;
            }
        }

        $rows=[];
        foreach($s['inventory']??[] as $iv){
            $sn=trim((string)($iv['serial']??''));
            $k=strtoupper($sn);
            if($k==='' || ((int)($iv['order_id']??0)!==$oid && !isset($wanted[$k]))) continue;
            $cid=(int)($iv['carton_id']??0);
            $cc=trim((string)($iv['carton_code']??''));
            if($cc==='' && $cid>0 && isset($cartById[$cid])) $cc=$cartById[$cid];
            if($cc==='' && isset($cartBySerial[$k])) $cc=$cartBySerial[$k];
            $rows[$k]=[
                'id'=>(int)($iv['id']??0),
                'serial'=>$sn,
                'product'=>(string)($iv['product']??($wanted[$k]??'')),
                'warehouse_id'=>(int)($iv['warehouse_id']??0),
                'order_id'=>(int)($iv['order_id']??0),
                'order_number'=>(string)($iv['order_number']??''),
                'carton_id'=>$cid,
                'carton_code'=>$cc,
                'shelf_level'=>(int)($iv['shelf_level']??0),
                'imei'=>(string)($iv['imei']??''),
                'added_at'=>(string)($iv['added_at']??''),
                'warehouse_last_moved_at'=>(string)($iv['warehouse_last_moved_at']??''),
                'warehouse_exited_at'=>(string)($iv['warehouse_exited_at']??''),
            ];
        }

        foreach($wanted as $k=>$product){
            if(isset($rows[$k])) continue;
            $cc=$cartBySerial[$k]??'';
            $rows[$k]=[
                'id'=>0,'serial'=>$k,'product'=>$product,'warehouse_id'=>0,
                'order_id'=>$oid,'order_number'=>(string)($order['number']??''),
                'carton_id'=>0,'carton_code'=>$cc,'shelf_level'=>0,'imei'=>'',
                'missing_inventory'=>true,
            ];
        }
        return ['order_id'=>$oid,'order_number'=>(string)($order['number']??''),'rows'=>array_values($rows)];
    }));
}

'''
    s=s[:pos]+endpoint+s[pos:]
    index.write_text(s,encoding="utf-8")

a=app.read_text(encoding="utf-8")
if FRONT_MARK not in a:
    # Replace the existing serial lookup/source block. Supports both lazy live build and repository build.
    start=a.find("/* SERIAL_LOCATION_DISPLAY_FIX_20261011 */")
    if start<0:
        start=a.find("function invBySerial(s,orderId=0)")
    if start<0:
        raise SystemExit("invBySerial start not found")
    end=a.find("function orderItemSerials(o,it)",start)
    if end<0:
        raise SystemExit("orderItemSerials anchor not found")

    block=r'''/* SERIAL_LOCATION_DISPLAY_FIX_20261011 */
/* ORDER_SERIAL_CARTON_DISPLAY_FIX_20261011 */
const ORDER_SERIAL_META=new Map();
async function ensureOrderSerialMeta(orderId){
  const id=Number(orderId||0);if(!id)return;
  try{
    const data=await req('/api/order/serial-meta?id='+encodeURIComponent(id));
    const map=new Map();
    (data?.rows||[]).forEach(v=>{
      const k=String(v?.serial||'').trim().toUpperCase();
      if(k)map.set(k,v);
    });
    ORDER_SERIAL_META.set(id,map);
  }catch(e){console.warn('order serial meta',e)}
}
function invBySerial(s,orderId=0){
  const key=String(s||'').trim().toUpperCase(),oid=Number(orderId||0),om=ORDER_SERIAL_META.get(oid);
  if(om?.has(key))return om.get(key);
  let rows=[];
  if(typeof INV_BY_SERIAL!=='undefined')rows=(INV_BY_SERIAL.get(key)||[]).slice();
  if(!rows.length&&Array.isArray(INV))rows=INV.filter(v=>String(v.serial||'').trim().toUpperCase()===key);
  return rows.sort((a,b)=>(Number(b.order_id||0)===oid?4:0)+(b.carton_code?2:0)+(b.shelf_level?1:0)-((Number(a.order_id||0)===oid?4:0)+(a.carton_code?2:0)+(a.shelf_level?1:0)))[0]||null;
}
function serialSource(iv){
  if(!iv)return 'شماره کارتن ثبت نشده';
  const carton=String(iv.carton_code||'').trim();
  const wid=Number(iv.warehouse_id||0);
  if(carton)return wid===0?`کارتن ${carton} — خارج شده`:`کارتن ${carton}`;
  if(iv.shelf_level)return `قفسه ${iv.shelf_level} — شماره کارتن ثبت نشده`;
  if(wid===0)return 'خارج شده — شماره کارتن ثبت نشده';
  if(wid===1)return 'انبار عمده — شماره کارتن ثبت نشده';
  if(wid===2)return 'انبار خرده تهرانپارس — شماره کارتن ثبت نشده';
  return 'شماره کارتن ثبت نشده';
}
'''
    a=a[:start]+block+a[end:]

    # Order details: fetch only that order's lightweight serial metadata before rendering.
    pat="function openOrderDetails(id){"
    if pat not in a:
        raise SystemExit("openOrderDetails function not found")
    a=a.replace(pat,"async function openOrderDetails(id){await ensureOrderSerialMeta(id);",1)

    # Prep modal also shows source/location. Make original function async.
    pat2="function openPrep(id){"
    if pat2 not in a:
        raise SystemExit("openPrep function not found")
    a=a.replace(pat2,"async function openPrep(id){await ensureOrderSerialMeta(id);",1)

    # Existing auto-scan wrapper must await the async prep renderer.
    oldwrap="const baseOpenPrep=openPrep;openPrep=function(id){baseOpenPrep(id);bindAutoSerialInputs(id)};"
    if oldwrap in a:
        a=a.replace(oldwrap,"const baseOpenPrep=openPrep;openPrep=async function(id){await baseOpenPrep(id);bindAutoSerialInputs(id)};",1)

    app.write_text(a,encoding="utf-8")

print("order serial carton display patch applied")
