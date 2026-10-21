<?php
/** Read-only integrity checks. Return fixed reasons/counts, never order/customer data. */
function gp_integrity_key($value): string {
    return strtoupper(trim((string)$value));
}

function gp_integrity_product($value): string {
    $v = strtr(trim((string)$value), ['ك'=>'ک','ي'=>'ی','ى'=>'ی','ة'=>'ه','ۀ'=>'ه','ـ'=>'','–'=>'-','—'=>'-']);
    $v = preg_replace('/\s*-\s*/u', '-', $v);
    return strtolower(preg_replace('/\s+/u', ' ', $v));
}

function gp_integrity_shipped_serials(array $o): array {
    $set = [];
    $batches = $o['shipment_batches'] ?? [];
    $batches[] = ['items'=>$o['exit_items'] ?? []];
    foreach ($batches as $batch) foreach ($batch['items'] ?? [] as $it) {
        foreach ($it['serials'] ?? [] as $sn) $set[gp_integrity_key($sn)] = gp_integrity_product($it['product'] ?? '');
    }
    return $set;
}

function gp_preswitch_carton_integrity(array $s, string $code): array {
    $code = gp_integrity_key($code);
    $report = ['code'=>$code,'ok'=>false,'kind'=>'missing','expected'=>20,
        'actual'=>0,'free'=>0,'allocated'=>0,'shipped'=>0,'detached'=>0,'invalid_links'=>0];
    $cartons = array_values(array_filter($s['cartons'] ?? [], function($c) use($code) {
        return gp_integrity_key($c['code'] ?? '') === $code;
    }));
    if (!$cartons) return $report;
    if (count($cartons) !== 1 || (int)($cartons[0]['id'] ?? 0) < 1) {
        $report['kind'] = 'duplicate_or_invalid_carton'; return $report;
    }
    $carton = $cartons[0]; $cid = (int)$carton['id'];
    foreach ($s['cartons'] ?? [] as $c) {
        if ((int)($c['id'] ?? 0) === $cid && gp_integrity_key($c['code'] ?? '') !== $code) {
            $report['kind'] = 'duplicate_or_invalid_carton'; return $report;
        }
    }
    $rows = []; $serialCounts = [];
    foreach ($s['inventory'] ?? [] as $iv) {
        $sn = gp_integrity_key($iv['serial'] ?? '');
        if ($sn !== '') $serialCounts[$sn] = ($serialCounts[$sn] ?? 0) + 1;
        if ((int)($iv['carton_id'] ?? 0) === $cid || gp_integrity_key($iv['carton_code'] ?? '') === $code) $rows[] = $iv;
        if ((int)($iv['detached_from_carton_id'] ?? 0) === $cid || gp_integrity_key($iv['detached_from_carton_code'] ?? '') === $code) $report['detached']++;
    }
    $report['actual'] = count($rows);
    foreach ($rows as $iv) {
        if ((int)($iv['order_id'] ?? 0) === 0) $report['free']++;
        else $report['allocated']++;
        $linkId = (int)($iv['carton_id'] ?? 0); $linkCode = gp_integrity_key($iv['carton_code'] ?? '');
        if (($linkId > 0 && $linkId !== $cid) || ($linkCode !== '' && $linkCode !== $code)) $report['invalid_links']++;
    }
    if (count($rows) !== 20) {
        $report['kind'] = $report['allocated'] > 0 ? 'count_and_allocated' : 'count_mismatch'; return $report;
    }
    if ($report['invalid_links']) { $report['kind'] = 'invalid_links'; return $report; }
    if ($report['detached']) { $report['kind'] = 'detached_orphan'; return $report; }
    $orders = []; $orderCounts = []; $activeClaims = [];
    foreach ($s['orders'] ?? [] as $o) {
        $oid = (int)($o['id'] ?? 0);
        if ($oid < 1) continue;
        $orders[$oid] = $o; $orderCounts[$oid] = ($orderCounts[$oid] ?? 0) + 1;
        // Delivered orders can retain historical serials after a legitimate return/resale.
        if (!empty($o['deleted']) || in_array($o['status'] ?? '', ['لغو شد','تحویل شد'], true)) continue;
        $sent = gp_integrity_shipped_serials($o);
        if (($o['status'] ?? '') === 'ارسال شد' && empty($o['partial_exit']) && ($o['incomplete_status'] ?? '') !== 'تأیید شده') continue;
        foreach ($o['items'] ?? [] as $it) foreach ($it['serials'] ?? [] as $sn) {
            $key = gp_integrity_key($sn);
            if ($key !== '' && !isset($sent[$key])) $activeClaims[$key][] = $oid;
        }
    }
    $rowSerials = [];
    foreach ($rows as $iv) {
        $sn = gp_integrity_key($iv['serial'] ?? ''); $product = gp_integrity_product($iv['product'] ?? '');
        if ($sn === '' || ($serialCounts[$sn] ?? 0) !== 1) { $report['kind'] = 'duplicate_or_missing_serial'; return $report; }
        $rowSerials[] = $sn;
        if ($product === '' || (!empty($carton['product']) && gp_integrity_product($carton['product']) !== $product)) {
            $report['kind'] = 'product_mismatch'; return $report;
        }
        $oid = (int)($iv['order_id'] ?? 0); $wid = (int)($iv['warehouse_id'] ?? 0);
        if ($oid < 0 || !in_array($wid, [0,1,2], true)) { $report['kind'] = 'invalid_location_or_order'; return $report; }
        if ($oid === 0) {
            if ($wid === 0) { $report['kind'] = 'free_outside_warehouse'; return $report; }
            if (!empty($activeClaims[$sn])) { $report['kind'] = 'unlinked_order_serial'; return $report; }
            continue;
        }
        $o = $orders[$oid] ?? null;
        if (!$o || ($orderCounts[$oid] ?? 0) !== 1 || !empty($o['deleted']) || empty($o['status']) || ($o['status'] ?? '') === 'لغو شد') {
            $report['kind'] = 'invalid_allocation_order'; return $report;
        }
        if (!empty($iv['order_number']) && (string)$iv['order_number'] !== (string)($o['number'] ?? '')) {
            $report['kind'] = 'allocation_number_mismatch'; return $report;
        }
        $matches = 0;
        foreach ($o['items'] ?? [] as $it) {
            $serials = array_map(static function($v) { return gp_integrity_key($v); }, $it['serials'] ?? []);
            if (!in_array($sn, $serials, true)) continue;
            if (gp_integrity_product($it['product'] ?? '') !== $product || count($serials) > (int)($it['qty'] ?? 0) || count(array_unique($serials)) !== count($serials)) {
                $report['kind'] = 'allocation_item_mismatch'; return $report;
            }
            $matches++;
        }
        if ($matches !== 1) { $report['kind'] = 'allocation_serial_mismatch'; return $report; }
        foreach ($activeClaims[$sn] ?? [] as $claim) if ($claim !== $oid) {
            $report['kind'] = 'conflicting_order_allocation'; return $report;
        }
        $shippedSet = gp_integrity_shipped_serials($o);
        $shipped = ($shippedSet[$sn] ?? '') === $product;
        if ($wid > 0 && ($shipped || $o['status'] === 'تحویل شد')) {
            $report['kind'] = 'shipped_still_in_warehouse'; return $report;
        }
        if ($wid === 0) {
            if (!$shipped || !in_array($o['status'], ['ارسال شد','تحویل شد'], true)) {
                $report['kind'] = 'exit_without_shipment'; return $report;
            }
            $report['shipped']++;
        }
    }
    if (array_key_exists('serials', $carton)) {
        $expected = array_map(static function($v) { return gp_integrity_key($v); }, $carton['serials']);
        sort($expected); sort($rowSerials);
        if ($expected !== $rowSerials) { $report['kind'] = 'carton_serial_mismatch'; return $report; }
    }
    $report['ok'] = true; $report['kind'] = 'ok';
    return $report;
}
