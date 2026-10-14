<?php
/* One-time state migration for GHP-000228. Expects $s, $repaired and current transaction from caller. */
$orderNo='GHP-000228';
$old='P125111726';
$new='P125111730';

$countExact=function($v,$needle) use (&$countExact){
    $n=0;
    if(is_array($v)){
        foreach($v as $x)$n+=$countExact($x,$needle);
        return $n;
    }
    return is_string($v)&&strcasecmp($v,$needle)===0?1:0;
};
$replaceExact=function(&$v,$old,$new,&$count) use (&$replaceExact){
    if(is_array($v)){
        foreach($v as &$x)$replaceExact($x,$old,$new,$count);
        unset($x);
        return;
    }
    if(is_string($v)&&strcasecmp($v,$old)===0){$v=$new;$count++;}
};

$oi=-1;
foreach($s['orders']??[] as $i=>$o)if((string)($o['number']??'')===$orderNo){$oi=$i;break;}
if($oi<0)throw new RuntimeException('GHP-000228 not found');
$oid=(int)($s['orders'][$oi]['id']??0);

$oldInOrder=0;$newInOrder=0;$product='';
foreach($s['orders'][$oi]['items']??[] as $it){
    foreach($it['serials']??[] as $sn){
        if(strcasecmp((string)$sn,$old)===0){$oldInOrder++;$product=(string)($it['product']??'');}
        if(strcasecmp((string)$sn,$new)===0)$newInOrder++;
    }
}
if($oldInOrder===0&&$newInOrder===1){
    if(isset($pdo)&&$pdo->inTransaction())$pdo->commit();
    echo json_encode(['ok'=>true,'order'=>$orderNo,'old'=>$old,'new'=>$new,'changed'=>false,'already'=>true],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    exit;
}
if($oldInOrder!==1)throw new RuntimeException('GHP-000228 old serial count mismatch');
if(stripos($product,'H9 PRO')===false)throw new RuntimeException('GHP-000228 serial is not H9 PRO');
if(!preg_match('/^P125[0-9]{6}$/',$new))throw new RuntimeException('GHP-000228 new serial format invalid');
if($countExact($s,$new)!==0){
    $oldIdx=[];$newIdx=[];$newOrders=[];
    foreach($s['inventory']??[] as $i=>$iv){
        if(strcasecmp((string)($iv['serial']??''),$old)===0)$oldIdx[]=$i;
        if(strcasecmp((string)($iv['serial']??''),$new)===0)$newIdx[]=$i;
    }
    foreach($s['orders']??[] as $j=>$o)foreach($o['items']??[] as $it)foreach($it['serials']??[] as $sn)
        if(strcasecmp((string)$sn,$new)===0)$newOrders[]=$j;

    if(count($oldIdx)!==1)throw new RuntimeException('GHP-000228 old inventory row count mismatch');
    if(count($newIdx)!==1)throw new RuntimeException('GHP-000228 new inventory row count mismatch');
    if(count($newOrders)!==0)throw new RuntimeException('GHP-000228 new serial is already assigned to another order');

    $oldRow=$s['inventory'][$oldIdx[0]];
    $newRow=$s['inventory'][$newIdx[0]];
    if((int)($oldRow['order_id']??0)!==$oid)throw new RuntimeException('GHP-000228 old serial is not assigned to target order');
    if((int)($oldRow['warehouse_id']??0)!==0)throw new RuntimeException('GHP-000228 old serial is not exited as expected');
    if((int)($newRow['order_id']??0)!==0)throw new RuntimeException('GHP-000228 new serial is not free');
    if((int)($newRow['warehouse_id']??0)<1)throw new RuntimeException('GHP-000228 new serial is not in warehouse');
    if((string)($oldRow['product']??'')!==(string)($newRow['product']??''))throw new RuntimeException('GHP-000228 serial products differ');
    if((int)($oldRow['carton_id']??0)!==(int)($newRow['carton_id']??0))throw new RuntimeException('GHP-000228 serials are not in the same source carton');

    $dir=__DIR__.'/storage/Backups';@mkdir($dir,0750,true);
    $name='ghadir-pre-swap-ghp-000228-serial-'.date('Ymd-His').'.json';
    $raw=json_encode($s,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT|JSON_INVALID_UTF8_SUBSTITUTE);
    if($raw===false||file_put_contents($dir.'/'.$name,$raw,LOCK_EX)===false)throw new RuntimeException('GHP-000228 backup failed');

    $orderChanged=0;
    $replaceExact($s['orders'][$oi],$old,$new,$orderChanged);
    if($orderChanged<1)throw new RuntimeException('GHP-000228 order serial reference was not replaced');

    $swapFields=['order_id','order_number','warehouse_id','warehouse_last_moved_at','warehouse_exited_at','warehouse_exit_order_id','warehouse_exit_order_number','warehouse_exit_by','warehouse_exit_movement_id'];
    foreach($swapFields as $k){
        $oh=array_key_exists($k,$s['inventory'][$oldIdx[0]]);$nh=array_key_exists($k,$s['inventory'][$newIdx[0]]);
        $ov=$oh?$s['inventory'][$oldIdx[0]][$k]:null;$nv=$nh?$s['inventory'][$newIdx[0]][$k]:null;
        if($nh)$s['inventory'][$oldIdx[0]][$k]=$nv;else unset($s['inventory'][$oldIdx[0]][$k]);
        if($oh)$s['inventory'][$newIdx[0]][$k]=$ov;else unset($s['inventory'][$newIdx[0]][$k]);
    }

    $movementChanged=0;
    foreach($s['warehouse_movements']??[] as &$mv){
        if(($mv['type']??'')!=='sale_out'||(int)($mv['order_id']??0)!==$oid)continue;
        foreach($mv['serials']??[] as &$sn)if(strcasecmp((string)$sn,$old)===0){$sn=$new;$movementChanged++;}
        unset($sn);
    }
    unset($mv);

    $s['orders'][$oi]['history']=is_array($s['orders'][$oi]['history']??null)?$s['orders'][$oi]['history']:[];
    $s['orders'][$oi]['history'][]=['at'=>date('Y-m-d H:i:s'),'by'=>'system-fix-20261014','action'=>'اصلاح سریال فاکتور: '.$old.' با '.$new.' جایگزین شد'];
    $s['orders'][$oi]['updated_at']=date('Y-m-d H:i:s');

    $verifyOldOrder=$countExact($s['orders'][$oi],$old);
    $verifyNewOrder=$countExact($s['orders'][$oi],$new);
    if($verifyOldOrder!==0||$verifyNewOrder<1)throw new RuntimeException('GHP-000228 order verification after swap failed');
    if((int)($s['inventory'][$oldIdx[0]]['order_id']??0)!==0||(int)($s['inventory'][$oldIdx[0]]['warehouse_id']??0)<1)throw new RuntimeException('GHP-000228 old serial was not returned to free stock');
    if((int)($s['inventory'][$newIdx[0]]['order_id']??0)!==$oid||(int)($s['inventory'][$newIdx[0]]['warehouse_id']??0)!==0)throw new RuntimeException('GHP-000228 new serial was not moved to exited order');

    $encoded=json_encode($s,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);
    if($encoded===false)throw new RuntimeException('GHP-000228 encode failed');
    $rev=(int)($r['revision']??0)+1;
    $checksum=hash('sha256',$encoded);
    $st=$pdo->prepare('UPDATE ghadir_state SET state_json=?,revision=?,checksum=?,updated_at=NOW() WHERE id=1');
    $st->execute([$encoded,$rev,$checksum]);
    $st=$pdo->prepare('INSERT INTO ghadir_state_audit (revision,checksum,bytes) VALUES (?,?,?)');
    $st->execute([$rev,$checksum,strlen($encoded)]);
    $pdo->commit();

    echo json_encode([
        'ok'=>true,'order'=>$orderNo,'status'=>(string)($s['orders'][$oi]['status']??''),
        'old'=>$old,'new'=>$new,'changed'=>true,'action'=>'swap_existing_serial',
        'order_refs_changed'=>$orderChanged,'sale_out_refs_changed'=>$movementChanged,
        'old_inventory_id'=>(int)($s['inventory'][$oldIdx[0]]['id']??0),
        'new_inventory_id'=>(int)($s['inventory'][$newIdx[0]]['id']??0),
        'carton_code'=>(string)($s['inventory'][$newIdx[0]]['carton_code']??''),
        'revision'=>$rev,'backup'=>$name
    ],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    exit;
}

$invRows=0;
foreach($s['inventory']??[] as $iv){
    if(strcasecmp((string)($iv['serial']??''),$old)!==0)continue;
    $invRows++;
    if((int)($iv['order_id']??0)!==$oid)throw new RuntimeException('GHP-000228 inventory order mismatch');
}
if($invRows!==1)throw new RuntimeException('GHP-000228 inventory row count mismatch');

$dir=__DIR__.'/storage/Backups';@mkdir($dir,0750,true);
$name='ghadir-pre-fix-ghp-000228-serial-'.date('Ymd-His').'.json';
$raw=json_encode($s,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT|JSON_INVALID_UTF8_SUBSTITUTE);
if($raw===false||file_put_contents($dir.'/'.$name,$raw,LOCK_EX)===false)throw new RuntimeException('GHP-000228 backup failed');

$before=$countExact($s,$old);
$changed=0;$replaceExact($s,$old,$new,$changed);
if($changed!==$before||$changed<2||$countExact($s,$old)!==0)throw new RuntimeException('GHP-000228 replacement verification failed');

$newOrderCount=0;
foreach($s['orders'][$oi]['items']??[] as $it)foreach($it['serials']??[] as $sn)if(strcasecmp((string)$sn,$new)===0)$newOrderCount++;
if($newOrderCount!==1)throw new RuntimeException('GHP-000228 new serial order link invalid');

$s['orders'][$oi]['history']=is_array($s['orders'][$oi]['history']??null)?$s['orders'][$oi]['history']:[];
$s['orders'][$oi]['history'][]=['at'=>date('Y-m-d H:i:s'),'by'=>'system-fix-20261014','action'=>'اصلاح سریال '.$old.' به '.$new];
$s['orders'][$oi]['updated_at']=date('Y-m-d H:i:s');
$encoded=json_encode($s,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);
if($encoded===false)throw new RuntimeException('GHP-000228 encode failed');
$rev=(int)($r['revision']??0)+1;
$checksum=hash('sha256',$encoded);
$st=$pdo->prepare('UPDATE ghadir_state SET state_json=?,revision=?,checksum=?,updated_at=NOW() WHERE id=1');
$st->execute([$encoded,$rev,$checksum]);
$st=$pdo->prepare('INSERT INTO ghadir_state_audit (revision,checksum,bytes) VALUES (?,?,?)');
$st->execute([$rev,$checksum,strlen($encoded)]);
$pdo->commit();
echo json_encode(['ok'=>true,'order'=>$orderNo,'product'=>$product,'old'=>$old,'new'=>$new,'changed'=>true,'replaced'=>$changed,'revision'=>$rev,'backup'=>$name],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
exit;
