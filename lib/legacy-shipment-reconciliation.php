<?php
/** Reconstruct a *missing* legacy shipment snapshot for one independently verified carton. */
require_once __DIR__.'/preswitch-carton-integrity.php';

function gp_legacy_shipment_reconcile_i90_097(array $source): array {
    $code='I90-097';
    $before=gp_preswitch_allocated_carton_integrity($source,$code);
    if ($before['ok']) return ['changed'=>false,'state'=>$source,'units'=>20];
    if ($before['kind']!=='exit_without_shipment' || $before['actual']!==20 ||
        $before['free']!==0 || $before['allocated']!==20) {
        throw new RuntimeException('unexpected_carton_state');
    }
    $carton=null;
    foreach ($source['cartons']??[] as $c) {
        if (gp_integrity_key($c['code']??'')===$code) {
            if ($carton!==null) throw new RuntimeException('duplicate_carton');
            $carton=$c;
        }
    }
    if ($carton===null || (int)($carton['id']??0)<1) throw new RuntimeException('carton_missing');
    $cid=(int)$carton['id'];$rows=[];$serials=[];$oid=null;
    foreach ($source['inventory']??[] as $iv) {
        if (gp_integrity_key($iv['carton_code']??'')!==$code && (int)($iv['carton_id']??0)!==$cid) continue;
        $sn=gp_integrity_key($iv['serial']??'');$linked=(int)($iv['order_id']??0);
        if ($sn==='' || isset($serials[$sn]) || $linked<1 ||
            (int)($iv['warehouse_id']??-1)!==0 ||
            (int)($iv['carton_id']??0)!==$cid || gp_integrity_key($iv['carton_code']??'')!==$code ||
            ($oid!==null && $oid!==$linked)) throw new RuntimeException('invalid_allocated_rows');
        $oid=$linked;$serials[$sn]=gp_integrity_product($iv['product']??'');$rows[]=$iv;
    }
    if (count($rows)!==20 || count($serials)!==20) throw new RuntimeException('invalid_allocated_count');
    $orderIndex=null;
    foreach ($source['orders']??[] as $i=>$order) {
        if ((int)($order['id']??0)!==$oid) continue;
        if ($orderIndex!==null) throw new RuntimeException('duplicate_order');
        $orderIndex=$i;
    }
    if ($orderIndex===null) throw new RuntimeException('order_missing');
    $order=$source['orders'][$orderIndex];
    if (($order['status']??'')!=='تحویل شد' || !empty($order['deleted']) ||
        !empty($order['shipment_batches']) || !empty($order['exit_items'])) {
        throw new RuntimeException('shipment_already_present_or_not_delivered');
    }
    foreach ($rows as $iv) {
        if (!empty($iv['order_number']) && (string)$iv['order_number']!==(string)($order['number']??'')) {
            throw new RuntimeException('order_number_mismatch');
        }
    }
    $at=(string)($order['updated_at']??'');
    if (!preg_match('/^\d{4}-\d\d-\d\d(?:[ T]\d\d:\d\d(?::\d\d)?)?$/',$at)) {
        throw new RuntimeException('reference_date_missing');
    }
    $matched=[];$batchItems=[];
    foreach ($order['items']??[] as $it) {
        $chosen=[];$raw=$it['serials']??[];
        if (!is_array($raw) || count($raw)>(int)($it['qty']??0)) throw new RuntimeException('invalid_order_items');
        $unique=[];
        foreach ($raw as $value) {
            $sn=gp_integrity_key($value);
            if ($sn==='' || isset($unique[$sn])) throw new RuntimeException('duplicate_order_serial');
            $unique[$sn]=true;
            if (!isset($serials[$sn])) continue;
            if (isset($matched[$sn]) || gp_integrity_product($it['product']??'')!==$serials[$sn]) {
                throw new RuntimeException('serial_product_or_order_mismatch');
            }
            $matched[$sn]=true;$chosen[]=$value;
        }
        if ($chosen) $batchItems[]=['product'=>$it['product'],'qty'=>count($chosen),'serials'=>$chosen];
    }
    if (count($matched)!==20) throw new RuntimeException('not_all_serials_in_order');
    $next=$source;
    $next['orders'][$orderIndex]['shipment_batches']=[[
        'at'=>$at,'by'=>'','shipping_type'=>(string)($order['shipping_type']??''),
        'items'=>$batchItems,
        'reconciled_legacy'=>true,'reconciled_at'=>date('Y-m-d H:i:s'),
        'date_provenance'=>'order_updated_at_estimate_not_verified_dispatch_date',
    ]];
    $next['inventory_reconciliations'][]=[
        'event'=>'i90_097_legacy_shipment_snapshot_reconstructed',
        'at'=>date('Y-m-d H:i:s'),'carton_code'=>$code,'units'=>20,
        'order_id'=>$oid,'inventory_unchanged'=>true,
        'date_provenance'=>'order_updated_at_estimate_not_verified_dispatch_date',
        'serial_set_hash'=>hash('sha256',implode("\n",array_keys($serials))),
    ];
    if (serialize($source['inventory']??[])!==serialize($next['inventory']??[]) ||
        serialize($source['cartons']??[])!==serialize($next['cartons']??[])) {
        throw new RuntimeException('inventory_must_not_change');
    }
    $after=gp_preswitch_allocated_carton_integrity($next,$code);
    if (!$after['ok'] || $after['shipped']!==20 || $after['free']!==0) {
        throw new RuntimeException('post_reconciliation_integrity_failed');
    }
    return ['changed'=>true,'state'=>$next,'units'=>20];
}
