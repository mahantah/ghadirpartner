#!/usr/bin/env python3
from pathlib import Path
import re, sys

root=Path(sys.argv[1] if len(sys.argv)>1 else ".")
index=root/"index.php"
app=root/"app.html"

s=index.read_text(encoding="utf-8")
marker="SERIAL_CONTINUATION_WAREHOUSE_FIX_20261011"
if marker not in s:
    changed=0
    reps=[
      ("'product'=>$x['product'],'serial'=>$sn,'added_at'=>now()","'product'=>$x['product'],'serial'=>$sn,'warehouse_id'=>1,'added_at'=>now()"),
      ("'product'=>$prod,'serial'=>$sn,'added_at'=>now()","'product'=>$prod,'serial'=>$sn,'warehouse_id'=>1,'added_at'=>now()"),
    ]
    for old,new in reps:
        if old in s:
            s=s.replace(old,new)
            changed+=1
    if changed<1:
        raise SystemExit("could not find manual/order import inventory creation pattern")
    # Mark the hotfix without affecting routing.
    pos=s.find("if($p==='/api/scan')")
    if pos<0: raise SystemExit("scan route not found")
    s=s[:pos]+"/* SERIAL_CONTINUATION_WAREHOUSE_FIX_20261011 */\n"+s[pos:]
    index.write_text(s,encoding="utf-8")

a=app.read_text(encoding="utf-8")
marker2="SERIAL_LOCATION_DISPLAY_FIX_20261011"
if marker2 not in a:
    live_inv="function invBySerial(s,orderId=0){let rows=(INV_BY_SERIAL.get(String(s||'').trim().toUpperCase())||[]).slice();return rows.sort((a,b)=>(Number(b.order_id||0)===Number(orderId)?4:0)+(b.carton_code?2:0)+(b.shelf_level?1:0)-((Number(a.order_id||0)===Number(orderId)?4:0)+(a.carton_code?2:0)+(a.shelf_level?1:0)))[0]||null}"
    live_inv_new="/* SERIAL_LOCATION_DISPLAY_FIX_20261011 */\nfunction invBySerial(s,orderId=0){let key=String(s||'').trim().toUpperCase(),rows=(typeof INV_BY_SERIAL!=='undefined'?(INV_BY_SERIAL.get(key)||[]):[]).slice();if(!rows.length&&Array.isArray(INV))rows=INV.filter(v=>String(v.serial||'').trim().toUpperCase()===key);return rows.sort((a,b)=>(Number(b.order_id||0)===Number(orderId)?4:0)+(b.carton_code?2:0)+(b.shelf_level?1:0)-((Number(a.order_id||0)===Number(orderId)?4:0)+(a.carton_code?2:0)+(a.shelf_level?1:0)))[0]||null}"
    repo_inv="function invBySerial(s,orderId=0){let rows=INV.filter(v=>String(v.serial||'').toUpperCase()===String(s||'').toUpperCase());return rows.sort((a,b)=>(Number(b.order_id||0)===Number(orderId)?4:0)+(b.carton_code?2:0)+(b.shelf_level?1:0)-((Number(a.order_id||0)===Number(orderId)?4:0)+(a.carton_code?2:0)+(a.shelf_level?1:0)))[0]||null}"
    repo_inv_new="/* SERIAL_LOCATION_DISPLAY_FIX_20261011 */\nfunction invBySerial(s,orderId=0){let key=String(s||'').trim().toUpperCase(),rows=Array.isArray(INV)?INV.filter(v=>String(v.serial||'').trim().toUpperCase()===key):[];return rows.sort((a,b)=>(Number(b.order_id||0)===Number(orderId)?4:0)+(b.carton_code?2:0)+(b.shelf_level?1:0)-((Number(a.order_id||0)===Number(orderId)?4:0)+(a.carton_code?2:0)+(a.shelf_level?1:0)))[0]||null}"
    if live_inv in a:
        a=a.replace(live_inv,live_inv_new,1)
    elif repo_inv in a:
        a=a.replace(repo_inv,repo_inv_new,1)
    else:
        raise SystemExit("invBySerial pattern not found")

    oldsrc="function serialSource(iv){if(!iv)return 'محل نامشخص';if(iv.carton_code)return `کارتن ${iv.carton_code}`;if(iv.shelf_level)return `قفسه ${iv.shelf_level}`;return 'ورود دستی'}"
    newsrc="function serialSource(iv){if(!iv)return 'سریال ثبت‌شده — محل انبار ثبت نشده';if(Number(iv.warehouse_id||0)===0)return 'خارج شده';if(iv.carton_code)return `کارتن ${iv.carton_code}`;if(iv.shelf_level)return `قفسه ${iv.shelf_level}`;if(Number(iv.warehouse_id||0)===1)return 'انبار عمده — ورود دستی';if(Number(iv.warehouse_id||0)===2)return 'انبار خرده تهرانپارس — ورود دستی';return 'ورود دستی'}"
    if oldsrc not in a: raise SystemExit("serialSource pattern not found")
    a=a.replace(oldsrc,newsrc,1)
    app.write_text(a,encoding="utf-8")

print("serial continuation warehouse/location patch applied")
