<?php
require_once __DIR__.'/../lib/preswitch-carton-integrity.php';

function fixture(): array {
    $rows = [];
    for ($i=0; $i<20; $i++) $rows[] = ['id'=>$i+1,'serial'=>'MOCK-097-'.$i,
        'product'=>'دستگاه كارتخوان I90','warehouse_id'=>1,'order_id'=>0,'carton_id'=>1,'carton_code'=>'I90-097'];
    return ['cartons'=>[['id'=>1,'code'=>'I90-097','product'=>'دستگاه کارتخوان I90',
        'serials'=>array_column($rows,'serial')]],'inventory'=>$rows,'orders'=>[]];
}
function allocated(int $qty=20): array {
    $s=fixture();$sn=[];
    for ($i=0;$i<$qty;$i++) {$s['inventory'][$i]['order_id']=7;$s['inventory'][$i]['order_number']='TEST-7';$sn[]=$s['inventory'][$i]['serial'];}
    $s['orders']=[['id'=>7,'number'=>'TEST-7','status'=>'در حال آماده سازی',
        'items'=>[['product'=>'دستگاه کارتخوان I90','qty'=>20,'serials'=>$sn]]]];
    return $s;
}
function check(array $s, string $reason='ok'): void {
    static $n=0;
    $before=serialize($s);$r=gp_preswitch_carton_integrity($s,'I90-097');
    if ($r['kind']!==$reason || $r['ok']!==($reason==='ok')) throw new RuntimeException($reason.' expected, got '.json_encode($r));
    if (serialize($s)!==$before) throw new RuntimeException('state mutated');
    if (strpos(json_encode($r),'MOCK-')!==false || strpos(json_encode($r),'TEST-7')!==false) throw new RuntimeException('private data leaked');
    $n++;echo 'case '.$n.': '.$reason."\n";
}
check(fixture());check(allocated());check(allocated(7));
$s=allocated();$s['orders'][0]['status']='ارسال شد';$s['orders'][0]['exit_items']=$s['orders'][0]['items'];
foreach($s['inventory'] as &$iv)$iv['warehouse_id']=0;unset($iv);
check($s);$s['orders'][0]['status']='تحویل شد';check($s);
$s=allocated();$s['orders'][0]['status']='ارسال شد';$s['orders'][0]['partial_exit']=true;
$s['orders'][0]['shipment_batches']=[['items'=>[['product'=>'دستگاه کارتخوان I90','serials'=>array_column(array_slice($s['inventory'],0,5),'serial')]]]];
for($i=0;$i<5;$i++)$s['inventory'][$i]['warehouse_id']=0;
check($s);
$s=allocated();$old=$s['orders'][0];$old['id']=6;$old['status']='تحویل شد';$s['orders'][]=$old;check($s); // historical return/resale
$s=fixture();$s['inventory'][0]['warehouse_id']=2;check($s);
$s=fixture();$s['inventory'][0]['carton_code']=' i90-097 ';check($s);
$s=fixture();array_pop($s['cartons']);check($s,'missing');
$s=fixture();$s['cartons'][]=$s['cartons'][0];check($s,'duplicate_or_invalid_carton');
$s=fixture();$s['cartons'][]=['id'=>1,'code'=>'OTHER'];check($s,'duplicate_or_invalid_carton');
$s=fixture();array_pop($s['inventory']);check($s,'count_mismatch');
$s=allocated();array_pop($s['inventory']);check($s,'count_and_allocated');
$s=fixture();$s['inventory'][]=$s['inventory'][0];check($s,'count_mismatch');
$s=fixture();$s['inventory'][0]['carton_code']='I90-098';check($s,'invalid_links');
$s=fixture();$s['inventory'][0]['carton_id']=2;check($s,'invalid_links');
$s=fixture();$s['inventory'][0]['detached_from_carton_id']=1;check($s,'detached_orphan');
$s=fixture();$s['inventory'][1]['serial']=$s['inventory'][0]['serial'];check($s,'duplicate_or_missing_serial');
$s=fixture();$extra=$s['inventory'][0];$extra['carton_id']=0;$extra['carton_code']='';$s['inventory'][]=$extra;check($s,'duplicate_or_missing_serial');
$s=fixture();unset($s['inventory'][0]['serial']);check($s,'duplicate_or_missing_serial');
$s=fixture();$s['inventory'][0]['product']='I80';check($s,'product_mismatch');
$s=fixture();$s['inventory'][0]['warehouse_id']=3;check($s,'invalid_location_or_order');
$s=fixture();$s['inventory'][0]['warehouse_id']=0;check($s,'free_outside_warehouse');
$s=allocated();$s['inventory'][0]['order_id']=0;check($s,'unlinked_order_serial');
$s=allocated();$s['orders']=[];check($s,'invalid_allocation_order');
$s=allocated();$s['orders'][]=$s['orders'][0];check($s,'invalid_allocation_order');
$s=allocated();$s['orders'][0]['status']='لغو شد';check($s,'invalid_allocation_order');
$s=allocated();$s['orders'][0]['deleted']=true;check($s,'invalid_allocation_order');
$s=allocated();$s['inventory'][0]['order_number']='OTHER';check($s,'allocation_number_mismatch');
$s=allocated();$s['orders'][0]['items'][0]['qty']=19;check($s,'allocation_item_mismatch');
$s=allocated();$s['orders'][0]['items'][0]['serials'][]=$s['inventory'][0]['serial'];check($s,'allocation_item_mismatch');
$s=allocated();$s['orders'][0]['items'][0]['product']='I80';check($s,'allocation_item_mismatch');
$s=allocated();array_shift($s['orders'][0]['items'][0]['serials']);check($s,'allocation_serial_mismatch');
$s=allocated();$s['orders'][0]['items'][]=$s['orders'][0]['items'][0];check($s,'allocation_serial_mismatch');
$s=allocated();$other=$s['orders'][0];$other['id']=8;$s['orders'][]=$other;check($s,'conflicting_order_allocation');
$s=allocated();$other=$s['orders'][0];$other['id']=8;$other['status']='ارسال شد';$other['partial_exit']=true;$s['orders'][]=$other;check($s,'conflicting_order_allocation');
$s=allocated();$s['inventory'][0]['warehouse_id']=0;check($s,'exit_without_shipment');
$s=allocated();$s['orders'][0]['exit_items']=$s['orders'][0]['items'];check($s,'shipped_still_in_warehouse');
$s=fixture();array_pop($s['cartons'][0]['serials']);check($s,'carton_serial_mismatch');
echo "PASS: 40 read-only warehouse integrity scenarios\n";
