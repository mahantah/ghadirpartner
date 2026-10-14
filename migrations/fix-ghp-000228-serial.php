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
if($oldInOrder===0&&$newInOrder===1)return;
if($oldInOrder!==1)throw new RuntimeException('GHP-000228 old serial count mismatch');
if(stripos($product,'H9 PRO')===false)throw new RuntimeException('GHP-000228 serial is not H9 PRO');
if(!preg_match('/^P125[0-9]{6}$/',$new))throw new RuntimeException('GHP-000228 new serial format invalid');
if($countExact($s,$new)!==0)throw new RuntimeException('GHP-000228 new serial already exists');

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
$repaired=true;
