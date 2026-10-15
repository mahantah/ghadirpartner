<?php
/* One-time production migration: fully return and cancel GHP-000219. */
require_once __DIR__.'/lib/storage.php';

$orderNo='GHP-000219';
$by='system-fix-20261015';
$reason='بار برگشت خورده';
$note='مرجوعی کامل بار و لغو سفارش طبق دستور مدیریت';
$now=date('Y-m-d H:i:s');

$oi=-1;
foreach($s['orders']??[] as $i=>$x){
    if((string)($x['number']??'')===$orderNo){$oi=$i;break;}
}
if($oi<0) throw new RuntimeException('GHP-000219 not found');
$o=&$s['orders'][$oi];
$oid=(int)($o['id']??0);

if(($o['status']??'')==='لغو شد'){
    $still=0;
    foreach($s['inventory']??[] as $iv) if((int)($iv['order_id']??0)===$oid) $still++;
    if($still===0){
        if(isset($pdo)&&$pdo->inTransaction()) $pdo->commit();
        echo json_encode(['ok'=>true,'order'=>$orderNo,'already_cancelled'=>true,'assigned_remaining'=>0],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
        exit;
    }
}

$serialSet=[];
foreach($o['items']??[] as $it){
    foreach($it['serials']??[] as $sn){
        $k=strtoupper(trim((string)$sn));
        if($k!=='') $serialSet[$k]=true;
    }
}
if(!$serialSet) throw new RuntimeException('GHP-000219 has no serials to reconcile');

$movementById=[];
foreach($s['warehouse_movements']??[] as $mv){
    $mid=(int)($mv['id']??0);
    if($mid>0) $movementById[$mid]=$mv;
}

$findSourceWarehouse=function(array $iv) use (&$s,$movementById,$oid){
    $mid=(int)($iv['warehouse_exit_movement_id']??0);
    if($mid>0 && isset($movementById[$mid])){
        $w=(int)($movementById[$mid]['from_warehouse_id']??0);
        if(in_array($w,[1,2],true)) return $w;
    }
    $sn=strtoupper(trim((string)($iv['serial']??'')));
    foreach(array_reverse($s['warehouse_movements']??[]) as $mv){
        if(($mv['type']??'')!=='sale_out' || (int)($mv['order_id']??0)!==$oid) continue;
        foreach($mv['serials']??[] as $x){
            if(strtoupper(trim((string)$x))===$sn){
                $w=(int)($mv['from_warehouse_id']??0);
                if(in_array($w,[1,2],true)) return $w;
            }
        }
    }
    foreach(array_reverse($s['orders'][$GLOBALS['oi']]['warehouse_exit_batches']??[]) as $b){
        $has=false;
        foreach($b['serials']??[] as $x) if(strtoupper(trim((string)$x))===$sn){$has=true;break;}
        if(!$has) continue;
        $groups=$b['groups']??[];
        if(count($groups)===1){
            $w=(int)($groups[0]['warehouse_id']??0);
            if(in_array($w,[1,2],true)) return $w;
        }
    }
    return 0;
};

$backupDir=__DIR__.'/storage/Backups';
@mkdir($backupDir,0750,true);
$backupName='ghadir-pre-cancel-ghp-000219-'.date('Ymd-His').'.json';
$backupRaw=json_encode($s,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT|JSON_INVALID_UTF8_SUBSTITUTE);
if($backupRaw===false || file_put_contents($backupDir.'/'.$backupName,$backupRaw,LOCK_EX)===false) throw new RuntimeException('backup failed');

ghadir_warehouse_prepare_state($s);

$returnGroups=[];
$returnSerialsByWarehouse=[];
$returnedNow=0;
$releasedReserved=0;
$alreadyFree=0;

foreach($s['inventory'] as &$iv){
    $sn=strtoupper(trim((string)($iv['serial']??'')));
    if(!isset($serialSet[$sn])) continue;

    $rowOrder=(int)($iv['order_id']??0);
    $wid=(int)($iv['warehouse_id']??0);

    if($rowOrder===$oid && $wid===0){
        $dest=$findSourceWarehouse($iv);
        if(!in_array($dest,[1,2],true)) throw new RuntimeException('source warehouse not found for returned serial');
        $product=(string)($iv['product']??'نامشخص');
        $key=$dest.'|'.$product;
        if(!isset($returnGroups[$key])) $returnGroups[$key]=['warehouse_id'=>$dest,'product'=>$product,'serials'=>[]];
        $returnGroups[$key]['serials'][]=(string)($iv['serial']??'');
        $returnSerialsByWarehouse[$dest][]=(string)($iv['serial']??'');

        $iv['order_id']=0;
        $iv['order_number']='';
        $iv['warehouse_id']=$dest;
        unset($iv['warehouse_exited_at'],$iv['warehouse_exit_order_id'],$iv['warehouse_exit_order_number'],$iv['warehouse_exit_by'],$iv['warehouse_exit_movement_id']);
        $iv['returned_from_order_id']=$oid;
        $iv['returned_from_order_number']=$orderNo;
        $iv['returned_at']=$now;
        $iv['warehouse_last_moved_at']=$now;
        $returnedNow++;
    } elseif($rowOrder===$oid && $wid>0){
        $iv['order_id']=0;
        $iv['order_number']='';
        $iv['released_from_cancelled_order_id']=$oid;
        $iv['released_from_cancelled_order_number']=$orderNo;
        $iv['released_at']=$now;
        $releasedReserved++;
    } elseif($rowOrder===0 && $wid>0){
        $alreadyFree++;
    } elseif($rowOrder!==0 && $rowOrder!==$oid){
        throw new RuntimeException('an order serial is currently assigned to another order');
    }
}
unset($iv);

foreach($returnGroups as $g){
    ghadir_warehouse_record(
        $s,'return',$g['product'],$g['serials'],0,$g['warehouse_id'],$by,$oid,$orderNo,$reason
    );
}

foreach($returnSerialsByWarehouse as $wid=>$serials){
    if(!$serials) continue;
    $o['returns'][]=[
        'at'=>$now,
        'by'=>$by,
        'warehouse_id'=>(int)$wid,
        'reason'=>$reason,
        'serials'=>array_values(array_unique($serials))
    ];
}

$stillAssigned=0;
foreach($s['inventory']??[] as $iv) if((int)($iv['order_id']??0)===$oid) $stillAssigned++;
if($stillAssigned!==0) throw new RuntimeException('assigned inventory remains after cancellation');

$allReturned=[];
foreach($o['returns']??[] as $rr){
    foreach($rr['serials']??[] as $sn){
        $k=strtoupper(trim((string)$sn));
        if($k!=='') $allReturned[$k]=true;
    }
}
foreach($s['inventory']??[] as $iv){
    if((int)($iv['returned_from_order_id']??0)===$oid){
        $k=strtoupper(trim((string)($iv['serial']??'')));
        if($k!=='') $allReturned[$k]=true;
    }
}

$o['return_status']=count($allReturned)>=count($serialSet)?'مرجوع کامل':'مرجوع جزئی';
$o['returned_count']=count($allReturned);
if($o['return_status']!=='مرجوع کامل') throw new RuntimeException('return is not complete after reconciliation');

$o['status']='لغو شد';
if(array_key_exists('approval_status',$o)) $o['approval_status']='لغو شد';
$o['shipping_type']='';
$o['cancel_reason']=$reason;
$o['cancel_note']=$note;
$o['cancelled_by']=$by;
$o['cancelled_at']=$now;
$o['updated_at']=$now;
$o['history']=is_array($o['history']??null)?$o['history']:[];
$o['history'][]=[
    'at'=>$now,
    'by'=>$by,
    'action'=>'بار برگشت خورده؛ '.$returnedNow.' دستگاه مرجوع شد، '.$releasedReserved.' سریال رزروشده آزاد شد و سفارش لغو شد'
];

$encoded=json_encode($s,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);
if($encoded===false) throw new RuntimeException('encode failed');
$rev=(int)($r['revision']??0)+1;
$checksum=hash('sha256',$encoded);

$st=$pdo->prepare('UPDATE ghadir_state SET state_json=?,revision=?,checksum=?,updated_at=NOW() WHERE id=1');
$st->execute([$encoded,$rev,$checksum]);
$st=$pdo->prepare('INSERT INTO ghadir_state_audit (revision,checksum,bytes) VALUES (?,?,?)');
$st->execute([$rev,$checksum,strlen($encoded)]);
$pdo->commit();

echo json_encode([
    'ok'=>true,
    'order'=>$orderNo,
    'status'=>$o['status'],
    'return_status'=>$o['return_status'],
    'serial_count'=>count($serialSet),
    'returned_now'=>$returnedNow,
    'released_reserved'=>$releasedReserved,
    'already_free'=>$alreadyFree,
    'returned_count'=>$o['returned_count'],
    'assigned_remaining'=>$stillAssigned,
    'revision'=>$rev,
    'backup'=>$backupName
],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
exit;
