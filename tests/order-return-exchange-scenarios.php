#!/usr/bin/env php
<?php
declare(strict_types=1);
/**
 * Synthetic in-memory scenarios for return replacement (no production data).
 */
$root = dirname(__DIR__);
require_once $root . '/lib/storage.php';

function init_state(): array {
    return [
        'users' => [],
        'customers' => [],
        'orders' => [],
        'inventory' => [],
        'cartons' => [],
        'notifications' => [],
        'products' => [],
        'warehouse_movements' => [],
        'next_customer' => 1,
        'next_order' => 1,
        'next_serial' => 1,
        'next_carton' => 1,
        'next_notification' => 1,
        'next_warehouse_movement' => 1,
        'settings' => [],
    ];
}

function idx(array $a, $id): int {
    foreach ($a as $i => $x) {
        if ((int)($x['id'] ?? 0) === (int)$id) {
            return $i;
        }
    }
    return -1;
}
function fail($m, $c = 400): never {
    throw new RuntimeException((string)$m, (int)$c);
}
function now(): string {
    return date('Y-m-d H:i:s');
}
function hist(array &$o, string $by, string $a): void {
    $o['history'][] = ['at' => now(), 'by' => $by, 'action' => $a];
}
function valid_serial(string $p, string $s): bool {
    if ($p === 'MOREFUN - H9 PRO') {
        return (bool)preg_match('/^P125[0-9]{6}$/u', $s);
    }
    if ($p === 'OTHER MODEL') {
        return (bool)preg_match('/^X999[0-9]{6}$/u', $s);
    }
    return false;
}

require_once $root . '/lib/order-return-exchange.php';

function base_state(): array {
    $s = init_state();
    $s['next_order'] = 100;
    $s['next_serial'] = 1000;
    $s['products'] = [
        ['name' => 'MOREFUN - H9 PRO', 'pattern' => '^P125[0-9]{6}$', 'example' => 'P125000000', 'serial_required' => true],
        ['name' => 'OTHER MODEL', 'pattern' => '^X999[0-9]{6}$', 'example' => 'X999000000', 'serial_required' => true],
    ];
    $s['orders'] = [[
        'id' => 137,
        'number' => 'GHP-000137',
        'customer_id' => 1,
        'customer_name' => 'Test Customer',
        'status' => 'ارسال شد',
        'payment_status' => 'تسویه کامل',
        'approved_total' => 40000000,
        'items' => [['product' => 'MOREFUN - H9 PRO', 'qty' => 4, 'serials' => ['P125000001', 'P125000002', 'P125000003', 'P125000004']]],
        'returns' => [['at' => now(), 'by' => 'prep', 'warehouse_id' => 1, 'reason' => 'test', 'serials' => ['P125000001', 'P125000002', 'P125000003', 'P125000004']]],
        'exchanges' => [],
        'history' => [],
    ]];
    foreach (['P125000001', 'P125000002', 'P125000003', 'P125000004'] as $i => $sn) {
        $s['inventory'][] = ['id' => 100 + $i, 'product' => 'MOREFUN - H9 PRO', 'serial' => $sn, 'warehouse_id' => 1, 'order_id' => 0];
    }
    foreach (['P125000101', 'P125000102', 'P125000103', 'P125000104', 'P125000105'] as $i => $sn) {
        $s['inventory'][] = ['id' => 200 + $i, 'product' => 'MOREFUN - H9 PRO', 'serial' => $sn, 'warehouse_id' => ($i % 2) + 1, 'order_id' => 0];
    }
    $s['inventory'][] = ['id' => 300, 'product' => 'OTHER MODEL', 'serial' => 'X999000001', 'warehouse_id' => 1, 'order_id' => 0];
    $s['inventory'][] = ['id' => 301, 'product' => 'MOREFUN - H9 PRO', 'serial' => 'P125000999', 'warehouse_id' => 0, 'order_id' => 99, 'order_number' => 'GHP-000099'];
    return $s;
}

function assert_true(bool $cond, string $msg): void {
    if (!$cond) {
        throw new RuntimeException('FAIL: ' . $msg);
    }
}

function free_count(array $s, string $product): int {
    $n = 0;
    foreach ($s['inventory'] as $iv) {
        if (($iv['product'] ?? '') === $product && (int)($iv['warehouse_id'] ?? 0) > 0 && empty($iv['order_id'])) {
            $n++;
        }
    }
    return $n;
}

$u = ['username' => 'prep-test'];
$passed = 0;

try {
    $s = base_state();
    $beforeFree = free_count($s, 'MOREFUN - H9 PRO');
    $o = &$s['orders'][0];
    $qty = $o['items'][0]['qty'];
    $total = $o['approved_total'];
    $r = ghadir_order_return_exchange($s, ['id' => 137, 'product' => 'MOREFUN - H9 PRO', 'serials' => ['P125000101', 'P125000102', 'P125000103', 'P125000104'], 'request_id' => 'req-full-4'], $u);
    assert_true($r['ok'] === true, 'four replace ok');
    assert_true(count($o['exchanges']) === 1, 'one exchange');
    assert_true(in_array('P125000101', $o['items'][0]['serials'], true), 'new serial on order');
    assert_true($o['items'][0]['qty'] === $qty, 'qty unchanged');
    assert_true($o['approved_total'] === $total, 'total unchanged');
    assert_true(free_count($s, 'MOREFUN - H9 PRO') === $beforeFree - 4, 'inventory reduced by 4');
    $passed++;
    echo "OK: replace 4 devices\n";
} catch (Throwable $e) {
    echo "ERR replace 4: {$e->getMessage()}\n";
    exit(1);
}

try {
    $s = base_state();
    ghadir_order_return_exchange($s, ['id' => 137, 'product' => 'MOREFUN - H9 PRO', 'serials' => ['P125000101', 'P125000102'], 'request_id' => 'req-partial-a'], $u);
    ghadir_order_return_exchange($s, ['id' => 137, 'product' => 'MOREFUN - H9 PRO', 'serials' => ['P125000103', 'P125000104'], 'request_id' => 'req-partial-b'], $u);
    assert_true(count($s['orders'][0]['exchanges']) === 2, 'two partial exchanges');
    assert_true(ghadir_order_exchange_pending_by_product($s['orders'][0]) === [], 'no pending left');
    $passed++;
    echo "OK: partial 2+2\n";
} catch (Throwable $e) {
    echo "ERR partial: {$e->getMessage()}\n";
    exit(1);
}

try {
    $s = base_state();
    try {
        ghadir_order_return_exchange($s, ['id' => 137, 'product' => 'MOREFUN - H9 PRO', 'serials' => ['P125000101', 'P125000102', 'P125000103', 'P125000104', 'P125000105']], $u);
        throw new RuntimeException('should reject 5th');
    } catch (RuntimeException $e) {
        assert_true(str_contains($e->getMessage(), 'تعداد'), 'over quota message');
    }
    assert_true(count($s['orders'][0]['exchanges'] ?? []) === 0, 'no exchange saved on fail');
    $passed++;
    echo "OK: reject 5th device\n";
} catch (Throwable $e) {
    echo "ERR over quota: {$e->getMessage()}\n";
    exit(1);
}

try {
    $s = base_state();
    try {
        ghadir_order_return_exchange($s, ['id' => 137, 'product' => 'MOREFUN - H9 PRO', 'serials' => ['P125000999']], $u);
        throw new RuntimeException('assigned serial should fail');
    } catch (RuntimeException $e) {
        assert_true(str_contains($e->getMessage(), 'آزاد') || str_contains($e->getMessage(), 'هم‌مدل'), 'assigned serial blocked');
    }
    $passed++;
    echo "OK: reject assigned serial\n";
} catch (Throwable $e) {
    echo "ERR assigned: {$e->getMessage()}\n";
    exit(1);
}

try {
    $s = base_state();
    try {
        ghadir_order_return_exchange($s, ['id' => 137, 'product' => 'MOREFUN - H9 PRO', 'serials' => ['X999000001']], $u);
        throw new RuntimeException('wrong model should fail');
    } catch (RuntimeException $e) {
        assert_true(
            str_contains($e->getMessage(), 'هم‌مدل')
            || str_contains($e->getMessage(), 'آزاد')
            || str_contains($e->getMessage(), 'نامعتبر'),
            'wrong model blocked: ' . $e->getMessage()
        );
    }
    $passed++;
    echo "OK: reject wrong model\n";
} catch (Throwable $e) {
    echo "ERR wrong model: {$e->getMessage()}\n";
    exit(1);
}

try {
    $s = base_state();
    try {
        ghadir_order_return_exchange($s, ['id' => 137, 'product' => 'MOREFUN - H9 PRO', 'serials' => ['P125NOPE1']], $u);
        throw new RuntimeException('missing serial should fail');
    } catch (RuntimeException $e) {
        assert_true(true, 'missing serial');
    }
    $passed++;
    echo "OK: reject missing serial\n";
} catch (Throwable $e) {
    echo "ERR missing: {$e->getMessage()}\n";
    exit(1);
}

try {
    $s = base_state();
    $r1 = ghadir_order_return_exchange($s, ['id' => 137, 'product' => 'MOREFUN - H9 PRO', 'serials' => ['P125000101', 'P125000102'], 'request_id' => 'dup-req-1'], $u);
    $mov1 = count($s['warehouse_movements']);
    $r2 = ghadir_order_return_exchange($s, ['id' => 137, 'product' => 'MOREFUN - H9 PRO', 'serials' => ['P125000103'], 'request_id' => 'dup-req-1'], $u);
    assert_true(!empty($r2['duplicate']), 'duplicate request_id');
    assert_true(count($s['warehouse_movements']) === $mov1, 'no extra movement on duplicate');
    $passed++;
    echo "OK: idempotent request_id\n";
} catch (Throwable $e) {
    echo "ERR idempotent: {$e->getMessage()}\n";
    exit(1);
}

echo "ALL {$passed} scenario groups passed\n";
