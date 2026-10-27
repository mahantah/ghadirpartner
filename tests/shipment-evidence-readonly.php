<?php
declare(strict_types=1);
require __DIR__.'/../lib/preswitch-carton-integrity.php';
require __DIR__.'/../scripts/shipment-evidence-readonly.php';
$state = ['cartons'=>[['id'=>1,'code'=>'I90-098','product'=>'I90']], 'inventory'=>[], 'orders'=>[
    ['id'=>1,'number'=>'PRIVATE','status'=>'تحویل شد','items'=>[['product'=>'I90','qty'=>20,'serials'=>[]]],'history'=>[['action'=>'وضعیت به «ارسال شد» تغییر کرد']]]
]];
for ($i=0;$i<20;$i++) {
    $sn='PRIVATE-'.$i;
    $state['inventory'][]=['serial'=>$sn,'product'=>'I90','carton_id'=>1,'carton_code'=>'I90-098','warehouse_id'=>0,'order_id'=>1];
    $state['orders'][0]['items'][0]['serials'][]=$sn;
}
$before=serialize($state);
$service=new ShipmentEvidence();
$result=$service->inspect($state,'I90-098');
if ($result['outside_warehouse']!==20 || $result['serials_with_shipment_snapshot']!==0 || $result['orders_with_dispatch_history']!==1 || $result['integrity']['kind']!=='exit_without_shipment') throw new RuntimeException('legacy evidence failed');
if (str_contains(json_encode($result),'PRIVATE') || serialize($state)!==$before) throw new RuntimeException('privacy or mutation');
$state['orders'][0]['exit_items']=$state['orders'][0]['items'];
$result=$service->inspect($state,'I90-098');
if ($result['serials_with_shipment_snapshot']!==20 || !$result['integrity']['ok']) throw new RuntimeException('snapshot evidence failed');
echo "PASS: read-only evidence distinguishes a legacy dispatch from an explicit shipment snapshot without exposing private values\n";
