<?php
require __DIR__.'/../lib/legacy-exit-metadata.php';
/** Build a delivered two-carton fixture with deliberately absent exit metadata. */
function exitFixture(): array {
    $s=['cartons'=>[],'inventory'=>[],'orders'=>[['id'=>7,'number'=>'TEST-7','status'=>'تحویل شد','created_at'=>'2020-01-01','updated_at'=>'2020-02-02','items'=>[['product'=>'I90','qty'=>40,'serials'=>[]]],'history'=>[]]]];
    foreach (['I90-098','I90-099'] as $c=>$code) {
        $s['cartons'][]=['id'=>$c+1,'code'=>$code,'product'=>'I90'];
        for ($i=0;$i<20;$i++) {
            $sn='MOCK-'.$c.'-'.$i;
            $s['inventory'][]=['serial'=>$sn,'product'=>'I90','warehouse_id'=>0,'order_id'=>7,'order_number'=>'TEST-7','carton_id'=>$c+1,'carton_code'=>$code];
            $s['orders'][0]['items'][0]['serials'][]=$sn;
        }
    }
    return $s;
}
/** Assert repair eligibility and reject invalid evidence without source mutation. */
function checkExit(array $s, bool $eligible): void {
    $before=serialize($s);
    try {$result=(new LegacyExitMetadata(['I90-098','I90-099']))->reconcile($s);$passed=true;}
    catch (RuntimeException $e) {$passed=false;}
    if ($passed!==$eligible || serialize($s)!==$before) throw new RuntimeException('eligibility or mutation failure');
    if (!$eligible) return;
    $next=$result['state'];
    if (serialize($next['inventory'])!==serialize($s['inventory']) || serialize($next['cartons'])!==serialize($s['cartons'])) throw new RuntimeException('inventory changed');
    $originalOrder=$s['orders'][0];$repairedOrder=$next['orders'][0];unset($repairedOrder['exit_items']);
    if ($originalOrder!==$repairedOrder || isset($next['orders'][0]['shipment_batches'])) throw new RuntimeException('dates or other order fields changed');
    if (!$result['changed'] || $result['units']!==40 || count($next['orders'][0]['exit_items'][0]['serials'])!==40) throw new RuntimeException('incomplete metadata');
    $again=(new LegacyExitMetadata(['I90-098','I90-099']))->reconcile($next);
    if ($again['changed'] || $again['state']!==$next) throw new RuntimeException('not idempotent');
    if ($next['inventory_reconciliations'][0]['dispatch_date_known']!==false) throw new RuntimeException('invented date');
}
checkExit(exitFixture(),true);
$s=exitFixture();$s['orders'][0]['status']='ارسال شد';checkExit($s,false);
$s=exitFixture();$s['orders'][0]['deleted']=true;checkExit($s,false);
$s=exitFixture();$s['orders'][0]['partial_exit']=true;checkExit($s,false);
$s=exitFixture();$s['inventory'][0]['warehouse_id']=1;checkExit($s,false);
$s=exitFixture();$s['inventory'][0]['order_id']=8;checkExit($s,false);
$s=exitFixture();$s['inventory'][0]['order_number']='OTHER';checkExit($s,false);
$s=exitFixture();$s['inventory'][0]['product']='I80';checkExit($s,false);
$s=exitFixture();$s['inventory'][]=$s['inventory'][0];checkExit($s,false);
$s=exitFixture();$s['orders'][0]['items'][0]['qty']=41;checkExit($s,false);
$s=exitFixture();array_pop($s['orders'][0]['items'][0]['serials']);checkExit($s,false);
$s=exitFixture();$s['orders'][]=$s['orders'][0];checkExit($s,false);
$s=exitFixture();$s['orders'][0]['exit_items']=[['product'=>'I90','serials'=>['OTHER']]];checkExit($s,false);
$s=exitFixture();$s['inventory'][]=['serial'=>'EXTRA','product'=>'I90','order_id'=>7,'warehouse_id'=>0];checkExit($s,false);
$s=exitFixture();$s['orders'][0]['shipment_batches']=[['at'=>'2020-02-01','items'=>[['product'=>'I90','serials'=>['MOCK-0-0']]]]];
$before=$s['orders'][0]['shipment_batches'];$r=(new LegacyExitMetadata(['I90-098','I90-099']))->reconcile($s);
if ($r['state']['orders'][0]['shipment_batches']!==$before) throw new RuntimeException('legacy batch rewritten');
echo "PASS: 15 legacy metadata scenarios, unchanged counts/dates, idempotence and refusal of incomplete evidence\n";

if (preg_match('/function __construct\(\s*(?:private|public|protected) /',file_get_contents(__DIR__.'/../lib/legacy-exit-metadata.php'))) throw new RuntimeException('PHP 8 constructor promotion is incompatible with production PHP 7.4');

$s=exitFixture();
$s['orders'][0]['exit_items']=[['product'=>'I90','qty'=>20,'serials'=>array_slice($s['orders'][0]['items'][0]['serials'],0,20)]];
$existing=$s['orders'][0]['exit_items'][0];
$r=(new LegacyExitMetadata(['I90-098','I90-099']))->reconcile($s);
if ($r['units']!==20 || $r['state']['orders'][0]['exit_items'][0]!==$existing || count($r['state']['orders'][0]['exit_items'])!==2) throw new RuntimeException('existing legacy evidence must be preserved verbatim');
if (!gp_preswitch_allocated_carton_integrity($r['state'],'I90-099')['ok']) throw new RuntimeException('remaining carton not reconciled');
echo "PASS: existing exit evidence retained verbatim; only missing serials appended\n";

$s=exitFixture();
$complete=$s['orders'][0];$complete['id']=8;$complete['number']='TEST-8';
$missing=[];$done=[];
foreach ($s['inventory'] as $i=>&$row) {
    if ($i%2===0) {$row['order_id']=8;$row['order_number']='TEST-8';$done[]=$row['serial'];}
    else $missing[]=$row['serial'];
} unset($row);
$complete['items'][0]['serials']=$done;$complete['items'][0]['qty']=20;
$complete['exit_items']=$complete['items'];
$s['orders'][0]['items'][0]['serials']=$missing;$s['orders'][0]['items'][0]['qty']=20;
$s['orders'][]=$complete;
$r=(new LegacyExitMetadata(['I90-098','I90-099']))->reconcile($s);
if ($r['orders']!==1 || $r['units']!==20 || $r['state']['orders'][1]!==$complete) throw new RuntimeException('mixed carton must leave fully recorded order untouched');
echo "PASS: mixed cartons preserve already recorded orders and reconcile only missing order evidence\n";
