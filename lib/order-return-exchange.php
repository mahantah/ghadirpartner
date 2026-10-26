<?php
declare(strict_types=1);

/** GP_ORDER_RETURN_EXCHANGE_V1_20261026 — return replacement without new sale or qty/total changes.
 *  GP_ORDER_RETURN_EXCHANGE_V2_20261026 — replace returned serials in order items (not append). */

/** @return array<string,string> serial (upper) => product */
function ghadir_order_serial_product_map(array $order): array {
    $map = [];
    foreach ($order['items'] ?? [] as $it) {
        $p = (string)($it['product'] ?? '');
        if ($p === '') {
            continue;
        }
        foreach ($it['serials'] ?? [] as $sn) {
            $map[strtoupper((string)$sn)] = $p;
        }
    }
    foreach ($order['exchanges'] ?? [] as $ex) {
        $p = (string)($ex['product'] ?? '');
        if ($p === '') {
            continue;
        }
        foreach (array_merge(
            (array)($ex['returned_serials_replaced'] ?? []),
            (array)($ex['new_serials'] ?? []),
            (array)($ex['returned_serials_snapshot'] ?? [])
        ) as $sn) {
            $key = strtoupper((string)$sn);
            if ($key !== '' && !isset($map[$key])) {
                $map[$key] = $p;
            }
        }
    }
    return $map;
}

/** @return array<string,true> */
function ghadir_order_replaced_returned_serials(array $order, string $product = ''): array {
    $set = [];
    foreach ($order['exchanges'] ?? [] as $ex) {
        if ($product !== '' && (string)($ex['product'] ?? '') !== $product) {
            continue;
        }
        foreach ($ex['returned_serials_replaced'] ?? [] as $sn) {
            $set[strtoupper((string)$sn)] = true;
        }
    }
    return $set;
}

function ghadir_order_unreplaced_returned_serials(array $order, string $product): array {
    $map = ghadir_order_serial_product_map($order);
    $replaced = ghadir_order_replaced_returned_serials($order, $product);
    $out = [];
    foreach ($order['returns'] ?? [] as $ret) {
        foreach ($ret['serials'] ?? [] as $sn) {
            $key = strtoupper((string)$sn);
            if (($map[$key] ?? '') !== $product || !empty($replaced[$key])) {
                continue;
            }
            $out[] = (string)$sn;
        }
    }
    return array_values(array_unique($out));
}

function ghadir_order_exchange_pending_by_product(array $order): array {
    $map = ghadir_order_serial_product_map($order);
    $counts = [];
    foreach ($order['returns'] ?? [] as $ret) {
        foreach ($ret['serials'] ?? [] as $sn) {
            $key = strtoupper((string)$sn);
            $p = $map[$key] ?? '';
            if ($p !== '') {
                $counts[$p] = ($counts[$p] ?? 0) + 1;
            }
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
    return ghadir_order_unreplaced_returned_serials($order, $product);
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
    $returnedForProduct = ghadir_order_unreplaced_returned_serials($o, $product);
    $replaceBatch = array_slice($returnedForProduct, 0, count($serials));
    if (count($replaceBatch) < count($serials)) {
        fail('سریال مرجوعی برای جایگزینی پیدا نشد');
    }

    if ($itIdx >= 0) {
        $cur = array_values($o['items'][$itIdx]['serials'] ?? []);
        $remove = array_fill_keys(array_map(fn($v) => strtoupper((string)$v), $replaceBatch), true);
        $cur = array_values(array_filter(
            $cur,
            fn($sn) => !isset($remove[strtoupper((string)$sn)])
        ));
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

    $o['exchanges'][] = [
        'id' => $exchangeId,
        'at' => $now,
        'by' => $u['username'],
        'product' => $product,
        'new_serials' => $serials,
        'returned_serials_replaced' => $replaceBatch,
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

/** Backfill returned_serials_replaced on exchanges recorded before V2. */
function ghadir_order_backfill_exchange_replaced(array &$order): int {
    if (!isset($order['exchanges']) || !is_array($order['exchanges'])) {
        return 0;
    }
    $map = ghadir_order_serial_product_map($order);
    $used = [];
    $patched = 0;
    foreach ($order['exchanges'] as $i => $ex) {
        $product = (string)($ex['product'] ?? '');
        $newSerials = array_values($ex['new_serials'] ?? []);
        $need = count($newSerials);
        if ($product === '' || $need < 1) {
            continue;
        }
        $existing = array_values($ex['returned_serials_replaced'] ?? []);
        if (count($existing) === $need) {
            foreach ($existing as $sn) {
                $used[strtoupper((string)$sn)] = true;
            }
            continue;
        }
        $batch = [];
        foreach ($order['returns'] ?? [] as $ret) {
            foreach ($ret['serials'] ?? [] as $sn) {
                $key = strtoupper((string)$sn);
                if (($map[$key] ?? '') !== $product || !empty($used[$key])) {
                    continue;
                }
                $batch[] = (string)$sn;
                $used[$key] = true;
                if (count($batch) >= $need) {
                    break 2;
                }
            }
        }
        if (count($batch) !== $need) {
            continue;
        }
        $order['exchanges'][$i]['returned_serials_replaced'] = $batch;
        $patched++;
    }
    return $patched;
}

/**
 * Align items[].serials with post-exchange reality (inventory on order, else logical swap).
 * Does not modify inventory, totals, or qty.
 *
 * @param array<string,mixed> $order
 * @param array<int,array<string,mixed>> $inventory
 */
function ghadir_order_repair_exchange_item_serials(array &$order, array $inventory): bool {
    $exPatched = ghadir_order_backfill_exchange_replaced($order);
    $oid = (int)($order['id'] ?? 0);
    $changed = $exPatched > 0;
    if (!isset($order['items']) || !is_array($order['items'])) {
        return $changed;
    }
    $exchangeProducts = [];
    foreach ($order['exchanges'] ?? [] as $ex) {
        $p = (string)($ex['product'] ?? '');
        if ($p !== '') {
            $exchangeProducts[$p] = true;
        }
    }
    if (!$exchangeProducts) {
        return $changed;
    }
    foreach ($order['items'] as $i => $it) {
        $product = (string)($it['product'] ?? '');
        if ($product === '' || empty($exchangeProducts[$product])) {
            continue;
        }
        $qty = (int)($it['qty'] ?? 0);
        $before = array_values($it['serials'] ?? []);
        $fromInv = [];
        foreach ($inventory as $iv) {
            if ((int)($iv['order_id'] ?? 0) !== $oid) {
                continue;
            }
            if ((string)($iv['product'] ?? '') !== $product) {
                continue;
            }
            if ((int)($iv['warehouse_id'] ?? 0) > 0) {
                continue;
            }
            $fromInv[] = (string)($iv['serial'] ?? '');
        }
        $seen = [];
        $target = [];
        foreach ($fromInv as $sn) {
            $key = strtoupper(trim($sn));
            if ($key === '' || isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $target[] = $sn;
        }
        if (!$target) {
            $cur = $before;
            foreach ($order['exchanges'] ?? [] as $ex) {
                if ((string)($ex['product'] ?? '') !== $product) {
                    continue;
                }
                $remove = array_fill_keys(
                    array_map(fn($v) => strtoupper((string)$v), (array)($ex['returned_serials_replaced'] ?? [])),
                    true
                );
                $cur = array_values(array_filter(
                    $cur,
                    fn($sn) => !isset($remove[strtoupper((string)$sn)])
                ));
                foreach ($ex['new_serials'] ?? [] as $sn) {
                    if (!in_array($sn, $cur, true)) {
                        $cur[] = $sn;
                    }
                }
            }
            $target = $cur;
        }
        if ($qty > 0 && count($target) > $qty) {
            $target = array_slice($target, 0, $qty);
        }
        if ($target !== $before) {
            $order['items'][$i]['serials'] = $target;
            $changed = true;
        }
    }
    return $changed;
}
