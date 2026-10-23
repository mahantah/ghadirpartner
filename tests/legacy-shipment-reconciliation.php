<?php
require_once __DIR__.'/../lib/legacy-shipment-reconciliation.php';

function legacyState(): array {
    $inventory=[];$serials=[];
    for($n=0;$n<20;$n++) {
        $sn='FAKE-I90-097-'.str_pad((string)$n,3,'0',STR_PAD_LEFT);$serials[]=$sn;
        $inventory[]=['serial'=>$sn,'carton_id'=>97,'carton_code'=>'I90-097',
            'product'=>'دستگاه کارتخوان I90','warehouse_id'=>0,
            'order_id'=>333,'order_number'=>'FAKE-333'];
    }
    return ['cartons'=>[['id'=>97,'code'=>'I90-097','product'=>'دستگاه کارتخوان I90','serials'=>$serials]],
        'inventory'=>$inventory,'orders'=>[['id'=>333,'number'=>'FAKE-333','status'=>'تحویل شد',
            'updated_at'=>'2026-10-01 09:12:00',
            'items'=>[['product'=>'دستگاه کارتخوان I90','qty'=>20,'serials'=>$serials]]]]];
}
function ensure($v,string $message): void {if(!$v)throw new RuntimeException($message);}
function rejected(callable $mutate): void {
    $s=legacyState();$mutate($s);$before=serialize($s);
    try {gp_legacy_shipment_reconcile_i90_097($s);} catch(RuntimeException $e) {
        ensure($before===serialize($s),'must not mutate rejected state');return;
    }
    throw new RuntimeException('unsafe state was accepted');
}
$s=legacyState();
ensure(gp_preswitch_allocated_carton_integrity($s,'I90-097')['kind']==='exit_without_shipment','legacy mismatch must block');
$frozen=serialize($s);$plan=gp_legacy_shipment_reconcile_i90_097($s);
ensure($frozen===serialize($s),'planner must not change input');
ensure($plan['changed']===true && $plan['units']===20,'expected one 20-unit repair');
ensure($plan['state']['inventory']===$s['inventory'] && $plan['state']['cartons']===$s['cartons'],'must not change stock');
ensure($plan['state']['orders'][0]['status']==='تحویل شد','must not change order status');
ensure(($plan['state']['orders'][0]['shipment_batches'][0]['date_provenance']??'')==='order_updated_at_estimate_not_verified_dispatch_date','date provenance');
ensure(gp_preswitch_allocated_carton_integrity($plan['state'],'I90-097')['ok']===true,'guard must pass with repaired evidence');
$again=gp_legacy_shipment_reconcile_i90_097($plan['state']);
ensure($again['changed']===false && $again['state']===$plan['state'],'must be idempotent');
rejected(function(&$s){$s['orders'][0]['status']='در حال آماده سازی';});
rejected(function(&$s){$s['orders'][0]['updated_at']='';});
rejected(function(&$s){$s['inventory'][0]['warehouse_id']=1;});
rejected(function(&$s){$s['inventory'][0]['order_id']=444;});
rejected(function(&$s){$s['inventory'][0]['order_id']=0;});
rejected(function(&$s){$s['orders'][0]['items'][0]['serials'][0]='FAKE-WRONG';});
rejected(function(&$s){$s['orders'][0]['shipment_batches']=[['items'=>[]]];});
rejected(function(&$s){$s['inventory'][1]['serial']=$s['inventory'][0]['serial'];});
rejected(function(&$s){$s['orders'][0]['items'][0]['qty']=19;});
rejected(function(&$s){$s['orders'][0]['deleted']=true;});
echo "PASS: legacy shipment reconciliation; 10 invalid cases rejected\n";
