<?php
declare(strict_types=1);

/** GP_ORDER_RETURN_EXCHANGE_V1_20261026 — return replacement without new sale or qty/total changes. */

function ghadir_order_exchange_pending_by_product(array $order): array {
    $original = [];
    foreach ($order['items'] ?? [] as $it) {
        $p = (string)($it['product'] ?? '');
        foreach ($it['serials'] ?? [] as $sn) {
            $original[strtoupper((string)$sn)] = $p;
        }
    }
    $returned = [];
    foreach ($order['returns'] ?? [] as $ret) {
        foreach ($ret['serials'] ?? [] as $sn) {
            $returned[strtoupper((string)$sn)] = true;
        }
    }
    $counts = [];
    foreach ($returned as $sn => $_) {
        $p = $original[$sn] ?? '';
        if ($p !== '') {
            $counts[$p] = ($counts[$p] ?? 0) + 1;
        }
    }
    foreach ($order['exchanges'] ?? [] as $ex) {
        $p = (string)($ex['product'] ?? '');
        if ($p === '') {
            continue;
        }
        $counts[$p] = ($counts[$p] ?? 0) - count($ex['new_serials'] ?? []);
    }
    $out = [];
    foreach ($counts as $p => $n) {
        if ($n > 0) {
            $out[$p] = $n;
        }
    }
    return $out;
}

function ghadir_order_returned_serials_for_product(array $order, string $product): array {
    $original = [];
    foreach ($order['items'] ?? [] as $it) {
        if ((string)($it['product'] ?? '') !== $product) {
            continue;
        }
        foreach ($it['serials'] ?? [] as $sn) {
            $original[strtoupper((string)$sn)] = true;
        }
    }
    $list = [];
    foreach ($order['returns'] ?? [] as $ret) {
        foreach ($ret['serials'] ?? [] as $sn) {
            $key = strtoupper((string)$sn);
            if (!empty($original[$key])) {
                $list[] = (string)$sn;
            }
        }
    }
    return array_values(array_unique($list));
}

/**
 * @param array<string,mixed> $s
 * @param array<string,mixed> $x
 * @param array<string,mixed> $u
 * @return array<string,mixed>
 */
function ghadir_order_return_exchange(array &$s, array $x, array $u): array {
    ghadir_warehouse_prepare_state($s);
    $oi = idx($s['orders'], $x['id'] ?? 0);
    if ($oi < 0) {
        fail('سفارش پیدا نشد');
    }
    $o = &$s['orders'][$oi];
    if (!in_array($o['status'] ?? '', ['ارسال شد', 'تحویل شد'], true)) {
        fail('تعویض فقط برای سفارش ارسال یا تحویل‌شده مجاز است');
    }

    $product = trim((string)($x['product'] ?? ''));
    $serials = array_values(array_unique(array_filter(
        array_map(fn($v) => strtoupper(trim((string)$v)), (array)($x['serials'] ?? [])),
        fn($v) => $v !== ''
    )));
    if ($product === '' || !$serials) {
        fail('مدل و سریال‌های جایگزین الزامی است');
    }

    $requestId = trim((string)($x['request_id'] ?? ''));
    if ($requestId !== '') {
        foreach ($o['exchanges'] ?? [] as $ex) {
            if ((string)($ex['request_id'] ?? '') === $requestId) {
                return [
                    'ok' => true,
                    'duplicate' => true,
                    'exchange_id' => (int)($ex['id'] ?? 0),
                    'order_id' => (int)$o['id'],
                    'product' => $product,
                    'serials' => $ex['new_serials'] ?? [],
                ];
            }
        }
    }

    $ordered = 0;
    foreach ($o['items'] ?? [] as $it) {
        if ((string)($it['product'] ?? '') === $product) {
            $ordered += (int)($it['qty'] ?? 0);
        }
    }
    if ($ordered < 1) {
        fail('مدل انتخابی در سفارش وجود ندارد');
    }

    $pending = ghadir_order_exchange_pending_by_product($o);
    $eligible = (int)($pending[$product] ?? 0);
    if ($eligible < count($serials)) {
        fail('تعداد جایگزین بیش از مرجوعی تعویض‌نشده است');
    }

    $snapTotal = $o['approved_total'] ?? $o['estimated_total'] ?? null;
    $snapPay = $o['payment_status'] ?? null;
    $snapItems = json_encode($o['items'] ?? [], JSON_UNESCAPED_UNICODE);

    $indexes = [];
    $groups = [];
    foreach ($serials as $sn) {
        if (!valid_serial($product, $sn)) {
            fail('سریال نامعتبر: ' . $sn);
        }
        $matches = [];
        foreach ($s['inventory'] as $k => $iv) {
            if (strtoupper((string)($iv['serial'] ?? '')) === $sn) {
                $matches[] = $k;
            }
        }
        if (count($matches) !== 1) {
            fail('سریال موجود نیست یا تکراری است: ' . $sn);
        }
        $k = $matches[0];
        $iv = $s['inventory'][$k];
        $wid = (int)($iv['warehouse_id'] ?? 0);
        if ((string)($iv['product'] ?? '') !== $product || $wid < 1 || !empty($iv['order_id'])) {
            fail('سریال آزاد و هم‌مدل نیست: ' . $sn);
        }
        $indexes[] = $k;
        $groups[$wid][] = $sn;
    }

    $now = now();
    $oid = (int)$o['id'];
    $onum = (string)$o['number'];
    foreach ($indexes as $k) {
        $s['inventory'][$k]['order_id'] = $oid;
        $s['inventory'][$k]['order_number'] = $onum;
        $s['inventory'][$k]['warehouse_id'] = 0;
        $s['inventory'][$k]['warehouse_last_moved_at'] = $now;
        $s['inventory'][$k]['warehouse_exited_at'] = $now;
        $s['inventory'][$k]['warehouse_exit_order_id'] = $oid;
        $s['inventory'][$k]['warehouse_exit_order_number'] = $onum;
        $s['inventory'][$k]['warehouse_exit_by'] = $u['username'];
        unset(
            $s['inventory'][$k]['returned_from_order_id'],
            $s['inventory'][$k]['returned_from_order_number'],
            $s['inventory'][$k]['returned_at']
        );
    }

    $movementIds = [];
    foreach ($groups as $wid => $ss) {
        $mv = ghadir_warehouse_record(
            $s,
            'sale_out',
            $product,
            $ss,
            (int)$wid,
            0,
            $u['username'],
            $oid,
            $onum,
            'خروج جایگزین مرجوعی سفارش'
        );
        $movementIds[] = (int)($mv['id'] ?? 0);
        $set = array_fill_keys($ss, true);
        foreach ($s['inventory'] as &$iv) {
            if ((int)($iv['order_id'] ?? 0) === $oid && isset($set[(string)($iv['serial'] ?? '')])) {
                $iv['warehouse_exit_movement_id'] = (int)($mv['id'] ?? 0);
            }
        }
        unset($iv);
    }

    $itIdx = -1;
    foreach ($o['items'] ?? [] as $k => $it) {
        if ((string)($it['product'] ?? '') === $product) {
            $itIdx = $k;
            break;
        }
    }
    if ($itIdx >= 0) {
        $cur = array_values($o['items'][$itIdx]['serials'] ?? []);
        foreach ($serials as $sn) {
            if (!in_array($sn, $cur, true)) {
                $cur[] = $sn;
            }
        }
        $o['items'][$itIdx]['serials'] = $cur;
        $o['items'][$itIdx]['qty'] = (int)($o['items'][$itIdx]['qty'] ?? 0);
    }

    if (!isset($s['next_exchange'])) {
        $mx = 0;
        foreach ($s['orders'] as $ord) {
            foreach ($ord['exchanges'] ?? [] as $ex) {
                $mx = max($mx, (int)($ex['id'] ?? 0));
            }
        }
        $s['next_exchange'] = $mx + 1;
    }
    $exchangeId = (int)$s['next_exchange']++;
    $returnedForProduct = ghadir_order_returned_serials_for_product($o, $product);

    $o['exchanges'][] = [
        'id' => $exchangeId,
        'at' => $now,
        'by' => $u['username'],
        'product' => $product,
        'new_serials' => $serials,
        'returned_serials_snapshot' => $returnedForProduct,
        'movement_ids' => $movementIds,
        'request_id' => $requestId,
        'type' => 'return_replacement',
    ];
    $o['updated_at'] = $now;
    hist($o, $u['username'], count($serials) . ' دستگاه ' . $product . ' جایگزین مرجوعی شد (#' . $exchangeId . ')');

    if ($snapTotal !== null && array_key_exists('approved_total', $o)) {
        $o['approved_total'] = $snapTotal;
    }
    if ($snapTotal !== null && array_key_exists('estimated_total', $o)) {
        $o['estimated_total'] = $snapTotal;
    }
    if ($snapPay !== null) {
        $o['payment_status'] = $snapPay;
    }
    if ($snapItems !== false) {
        $decoded = json_decode((string)$snapItems, true);
        if (is_array($decoded)) {
            foreach ($decoded as $i => $itSnap) {
                if (!isset($o['items'][$i])) {
                    continue;
                }
                $o['items'][$i]['qty'] = (int)($itSnap['qty'] ?? $o['items'][$i]['qty'] ?? 0);
            }
        }
    }

    return [
        'ok' => true,
        'exchange_id' => $exchangeId,
        'order_id' => $oid,
        'product' => $product,
        'serials' => $serials,
        'movement_ids' => $movementIds,
    ];
}
