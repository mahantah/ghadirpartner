#!/usr/bin/env python3
from pathlib import Path
import re, sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
storage = root / "lib" / "storage.php"
index = root / "index.php"

s = storage.read_text(encoding="utf-8")

new_exit = r'''function ghadir_warehouse_exit_order(array &$s,array &$order,string $by): int {
    // PARTIAL_SHIPMENT_PER_SERIAL_20261010
    ghadir_warehouse_prepare_state($s);
    $groups=[];$n=0;$oid=(int)($order['id']??0);$now=date('Y-m-d H:i:s');
    foreach($s['inventory'] as &$iv) {
        if ((int)($iv['order_id']??0)!==$oid) continue;
        $wid=(int)($iv['warehouse_id']??0);
        if ($wid<1) continue;

        // هر سریال فقط در همان لحظه‌ای که واقعاً از انبار خارج می‌شود ثبت خروج می‌خورد.
        if ((int)($iv['warehouse_exit_order_id']??0)===$oid && !empty($iv['warehouse_exited_at'])) continue;

        $product=(string)($iv['product']??'نامشخص');
        $key=$wid.'|'.$product;
        if(!isset($groups[$key])) $groups[$key]=['warehouse_id'=>$wid,'product'=>$product,'serials'=>[]];
        $groups[$key]['serials'][]=(string)($iv['serial']??'');
        $iv['warehouse_id']=0;
        $iv['warehouse_last_moved_at']=$now;
        $iv['warehouse_exited_at']=$now;
        $iv['warehouse_exit_order_id']=$oid;
        $iv['warehouse_exit_order_number']=(string)($order['number']??'');
        $iv['warehouse_exit_by']=$by;
        $n++;
    }
    unset($iv);

    $batchSerials=[];$batchGroups=[];
    foreach($groups as $g) {
        $mv=ghadir_warehouse_record($s,'sale_out',$g['product'],$g['serials'],$g['warehouse_id'],0,$by,$oid,(string)($order['number']??''),'خروج سفارش');
        $batchSerials=array_merge($batchSerials,$g['serials']);
        $batchGroups[]=['product'=>$g['product'],'warehouse_id'=>$g['warehouse_id'],'qty'=>count($g['serials']),'movement_id'=>(int)($mv['id']??0)];
        $set=array_fill_keys($g['serials'],true);
        foreach($s['inventory'] as &$iv) {
            if ((int)($iv['order_id']??0)===$oid && isset($set[(string)($iv['serial']??'')])) {
                $iv['warehouse_exit_movement_id']=(int)($mv['id']??0);
            }
        }
        unset($iv);
    }

    if($n>0) {
        $order['warehouse_exit_at']=$now;
        if(!isset($order['warehouse_exit_batches'])||!is_array($order['warehouse_exit_batches'])) $order['warehouse_exit_batches']=[];
        $order['warehouse_exit_batches'][]=[
            'at'=>$now,
            'by'=>$by,
            'qty'=>$n,
            'serials'=>array_values(array_unique($batchSerials)),
            'groups'=>$batchGroups,
        ];
    }
    return $n;
}'''

s, n = re.subn(
    r"function\\s+ghadir_warehouse_exit_order\\s*\\([^)]*\\)\\s*(?::\\s*int)?\\s*\\{.*?\\}\\s*function\\s+ghadir_state_prepare",
    new_exit + "\n\nfunction ghadir_state_prepare",
    s,
    count=1,
    flags=re.S,
)
if n != 1:
    raise SystemExit("could not patch ghadir_warehouse_exit_order")
storage.write_text(s, encoding="utf-8")

s = index.read_text(encoding="utf-8")

new_summary = """function inventory_summary($s){$map=[];foreach($s['products']??[] as $p)$map[$p['name']]=['product'=>$p['name'],'serial_required'=>!empty($p['serial_required']),'incoming'=>0,'current'=>0,'reserved'=>0,'outgoing'=>0,'cartons'=>0];foreach($s['inventory']??[] as $iv){$n=$iv['product']??'نامشخص';if(!isset($map[$n]))$map[$n]=['product'=>$n,'serial_required'=>true,'incoming'=>0,'current'=>0,'reserved'=>0,'outgoing'=>0,'cartons'=>0];$map[$n]['incoming']++;$wid=(int)($iv['warehouse_id']??0);$oid=(int)($iv['order_id']??0);if($wid>0){if($oid>0)$map[$n]['reserved']++;else $map[$n]['current']++;}else{$map[$n]['outgoing']++;}}$cartons=[];foreach($s['cartons']??[] as $c){$n=$c['product']??'نامشخص';if(!isset($cartons[$n]))$cartons[$n]=0;$cartons[$n]++;}foreach($map as $n=>&$r){$r['cartons']=$cartons[$n]??0;$r['balance_ok']=$r['incoming']===($r['current']+$r['reserved']+$r['outgoing']);}return array_values($map);}
"""
s, n = re.subn(r"function inventory_summary\(\$s\)\{.*?\}return array_values\(\$map\);\}\nfunction warehouse_free_stock", new_summary + "function warehouse_free_stock", s, count=1, flags=re.S)
if n != 1:
    raise SystemExit("could not patch inventory_summary")

old_return = "$iv['warehouse_id']=$wid;$iv['returned_from_order_id']=(int)$o['id'];"
new_return = "$iv['warehouse_id']=$wid;unset($iv['warehouse_exited_at'],$iv['warehouse_exit_order_id'],$iv['warehouse_exit_order_number'],$iv['warehouse_exit_by'],$iv['warehouse_exit_movement_id']);$iv['returned_from_order_id']=(int)$o['id'];"
if new_return not in s:
    if old_return not in s:
        raise SystemExit("could not patch return lifecycle")
    s = s.replace(old_return, new_return, 1)

new_unassign = """if($p==='/api/order/serial/unassign'||$p==='/api/order/serials/unassign-product'){$u=auth(['prep']);$x=input();out(db(true,function(&$s)use($x,$u,$p){$oi=idx($s['orders'],$x['id']??0);if($oi<0)fail('سفارش پیدا نشد');foreach($s['orders'][$oi]['items'] as &$it)if($it['product']===($x['product']??'')){$remove=$p==='/api/order/serial/unassign'?[$x['serial']]:$it['serials'];foreach($s['inventory'] as $iv)if(in_array($iv['serial'],$remove,true)&&(int)($iv['order_id']??0)===(int)$s['orders'][$oi]['id']&&(int)($iv['warehouse_id']??0)<1)fail('سریال خروج‌خورده را نمی‌توان مستقیم آزاد کرد؛ ابتدا مرجوعی سفارش را ثبت کنید');$it['serials']=array_values(array_filter($it['serials'],fn($sn)=>!in_array($sn,$remove,true)));foreach($s['inventory'] as &$iv)if(in_array($iv['serial'],$remove,true)){$iv['order_id']=0;$iv['order_number']='';}unset($iv);hist($s['orders'][$oi],$u['username'],count($remove).' سریال آزاد شد');return $s['orders'][$oi];}fail('کالا پیدا نشد');}));}
"""
s, n = re.subn(
    r"if\(\$p==='/api/order/serial/unassign'\|\|\$p==='/api/order/serials/unassign-product'\)\{.*?\}\nif\(\$p==='/api/inventory/delete'\)",
    new_unassign + "if($p==='/api/inventory/delete')",
    s,
    count=1,
    flags=re.S,
)
if n != 1:
    raise SystemExit("could not patch order serial unassign")

old_inv_unassign = "if($p==='/api/inventory/unassign'){$u=auth(['prep']);$x=input();db(true,function(&$s)use($x){$i=idx($s['inventory'],$x['id']??0);if($i<0)fail('سریال پیدا نشد');$sn=$s['inventory'][$i]['serial'];$oid=$s['inventory'][$i]['order_id'];foreach($s['orders'] as &$o)if($o['id']==$oid)foreach($o['items'] as &$it)$it['serials']=array_values(array_filter($it['serials'],fn($v)=>$v!==$sn));$s['inventory'][$i]['order_id']=0;$s['inventory'][$i]['order_number']='';});out(['ok'=>true]);}"
new_inv_unassign = "if($p==='/api/inventory/unassign'){$u=auth(['prep']);$x=input();db(true,function(&$s)use($x){$i=idx($s['inventory'],$x['id']??0);if($i<0)fail('سریال پیدا نشد');if((int)($s['inventory'][$i]['warehouse_id']??0)<1)fail('سریال خروج‌خورده را نمی‌توان مستقیم آزاد کرد؛ ابتدا مرجوعی سفارش را ثبت کنید');$sn=$s['inventory'][$i]['serial'];$oid=$s['inventory'][$i]['order_id'];foreach($s['orders'] as &$o)if($o['id']==$oid)foreach($o['items'] as &$it)$it['serials']=array_values(array_filter($it['serials'],fn($v)=>$v!==$sn));$s['inventory'][$i]['order_id']=0;$s['inventory'][$i]['order_number']='';});out(['ok'=>true]);}"
if new_inv_unassign not in s:
    if old_inv_unassign not in s:
        raise SystemExit("could not patch inventory unassign")
    s = s.replace(old_inv_unassign, new_inv_unassign, 1)

index.write_text(s, encoding="utf-8")
print("partial shipment per-serial patch applied")
