<?php
declare(strict_types=1);
define('GHADIR_I90_TEST_MODE',true);
require __DIR__.'/../scripts/i90-preswitch-restore-once.php';

function row_i90(string $serial,int $wid,int $orderId=0, int $cartonId=0): array {
 return ['product'=>'دستگاه کارتخوان I90','serial'=>$serial,'warehouse_id'=>$wid,
  'order_id'=>$orderId,'carton_id'=>$cartonId];
}
function assert_throws(callable $fn, string $reason): void {
 try { $fn(); } catch(RuntimeException $e) {
   if($e->getMessage()!==$reason)throw new RuntimeException('Wrong reject: '.$e->getMessage());
   return;
 }
 throw new RuntimeException('Expected fail closed: '.$reason);
}
$codes=GP_I90_CARTONS;$cartons=[];$current=['inventory'=>[],'orders'=>[],'warehouse_movements'=>[],'cartons'=>[]];
$before=['inventory'=>[],'orders'=>[],'warehouse_movements'=>[],'cartons'=>[]];
foreach($codes as $i=>$code){$cartons[]=['id'=>$i+1,'code'=>$code];}
$current['cartons']=$cartons;$before['cartons']=$cartons;
for($n=0;$n<1455;$n++){
 $v=row_i90('ON-'.$n,1);
 $current['inventory'][]=$v;$before['inventory'][]=$v;
}
for($n=0;$n<16;$n++) {
 $v=row_i90('RETAIL-'.$n,2);
 $current['inventory'][]=$v;$before['inventory'][]=$v;
}
for($n=0;$n<360;$n++){
 $sn='RESTORED-'.$n;
 $id=intdiv($n,20)+1;
 $old=row_i90($sn,0,321,$id);
 $cur=row_i90($sn,1,0,$id);
 $cur['returned_from_order_id']=321;
 $cur['returned_at']=GP_I90_RETURN_AT;
 $before['inventory'][]=$old;
 $current['inventory'][]=$cur;
}
for($n=0;$n<150;$n++) {
 $v=row_i90('SHIP-'.$n,0,444);
 $before['inventory'][]=$v;$current['inventory'][]=$v;
}
$current['warehouse_movements'][]=['type'=>'sale_out','created_at'=>'2026-10-17 19:00:00',
 'from_warehouse_id'=>1,'to_warehouse_id'=>0,'qty'=>150,
 'serials'=>array_map(fn($n)=>'SHIP-'.$n, range(0,149))];
$plan=gp_i90_plan($current,$before);
if($plan['restored']!==360||$plan['cartons']!==18||
   $plan['wholesale_before']!==1815||$plan['wholesale_after']!==1455||
   $plan['retail']!==16||count($plan['indexes'])!==360)
  throw new RuntimeException('Repair plan count mismatch');
foreach($plan['indexes'] as $index) $current['inventory'][$index]['warehouse_id']=0;
if(gp_i90_inventory_count($current,1)!==1455||
   gp_i90_inventory_count($current,2)!==16)
 throw new RuntimeException('Invariant failure after simulated correction');
assert_throws(fn()=>gp_i90_plan($current,$before),'live_stock_changed_reaudit_required');
foreach($plan['indexes'] as $index) $current['inventory'][$index]['warehouse_id']=1;
$bad=$current;
$bad['warehouse_movements'][]=['created_at'=>'2026-10-18 03:00:00','serials'=>['RESTORED-0']];
assert_throws(fn()=>gp_i90_plan($bad,$before),'candidate_has_later_warehouse_movement');
$bad=$before;
foreach($bad['inventory'] as &$iv)if($iv['serial']==='RESTORED-0'){$iv['order_id']=999;break;}
unset($iv);
assert_throws(fn()=>gp_i90_plan($current,$bad),'prior_state_mismatch');
$bad=$current;
$bad['orders'][]=['items'=>[['serials'=>['RESTORED-1']]]];
assert_throws(fn()=>gp_i90_plan($bad,$before),'candidate_reused_in_current_orders');
$bad=$current;
$bad['inventory'][1455]['serial']='RESTORED-0';
assert_throws(fn()=>gp_i90_plan($bad,$before),'candidate_serial_missing_or_duplicate');
$bad=$current;
$bad['inventory_reconciliations'][]=['event'=>'preswitch_i90_360_reversal_v1'];
assert_throws(fn()=>gp_i90_plan($bad,$before),'already_repaired');
$bad=$current;
$bad['inventory'][1455+16]['returned_at']='2026-10-17 20:35:13';
assert_throws(fn()=>gp_i90_plan($bad,$before),'wrong_restore_count');
echo "I90 360-device guarded restoration reversal tests passed\n";
