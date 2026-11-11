<?php
declare(strict_types=1);

/**
 * One-time, token-gated and strictly read-only diagnostic for the 18 protected I90 cartons.
 * Deliberately does not open a backup, change a state revision, or print serials/order IDs.
 * Deploy only as an ephemeral root-level probe, then remove it immediately.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const GP_PROTECTED_DIAG_TOKEN = '__GP_READONLY_DIAG_TOKEN__';
const GP_PROTECTED_CODES = [
    'I90-097', 'I90-098', 'I90-099', 'I90-100', 'I90-101', 'I90-102',
    'I90-103', 'I90-109', 'I90-110', 'I90-111', 'I90-112', 'I90-113',
    'I90-114', 'I90-115', 'I90-116', 'I90-123', 'I90-124', 'I90-125',
];

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' ||
    !hash_equals(GP_PROTECTED_DIAG_TOKEN, (string)($_SERVER['HTTP_X_GP_READONLY_TOKEN'] ?? ''))) {
    http_response_code(403);
    echo '{"ok":false,"error":"forbidden"}';
    exit;
}

try {
    // config.php is loaded on the production host only; its contents are never emitted.
    $cfg = require __DIR__ . '/config.php';
    $db = $cfg['mysql'] ?? [];
    $pdo = new PDO(
        'mysql:host=' . ($db['host'] ?? 'localhost') .
        ';port=' . (int)($db['port'] ?? 3306) .
        ';dbname=' . ($db['database'] ?? '') .
        ';charset=' . ($db['charset'] ?? 'utf8mb4'),
        (string)($db['username'] ?? ''),
        (string)($db['password'] ?? ''),
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
    // One SELECT only. No CREATE, UPDATE, DELETE, backup or other side effects.
    $row = $pdo->query('SELECT state_json, revision FROM ghadir_state WHERE id=1')->fetch();
    if (!$row) {
        throw new RuntimeException('state_unavailable');
    }
    $state = json_decode((string)$row['state_json'], true);
    if (!is_array($state) || !is_array($state['inventory'] ?? null) ||
        !is_array($state['cartons'] ?? null)) {
        throw new RuntimeException('state_invalid');
    }

    $cartonIndex = [];
    foreach ($state['cartons'] as $carton) {
        $code = strtoupper(trim((string)($carton['code'] ?? '')));
        if (in_array($code, GP_PROTECTED_CODES, true)) {
            $cartonIndex[$code][] = $carton;
        }
    }

    $counts = [];
    $mismatchCount = 0;
    $totalActual = 0;
    $totalReserved = 0;
    foreach (GP_PROTECTED_CODES as $code) {
        $found = $cartonIndex[$code] ?? [];
        $identityValid = count($found) === 1 && (int)($found[0]['id'] ?? 0) > 0;
        $cartonId = $identityValid ? (int)$found[0]['id'] : 0;
        $actual = 0;
        $free = 0;
        $distinctOrders = [];
        $identityConflict = 0;
        if ($identityValid) {
            foreach ($state['inventory'] as $item) {
                $itemCode = strtoupper(trim((string)($item['carton_code'] ?? '')));
                $byCode = $itemCode === $code;
                $byId = (int)($item['carton_id'] ?? 0) === $cartonId;
                if (!$byCode && !$byId) {
                    continue;
                }
                $actual++;
                $orderId = (int)($item['order_id'] ?? 0);
                if ($orderId === 0) {
                    $free++;
                } else {
                    $distinctOrders[$orderId] = true;
                }
                if ($byId && $itemCode !== '' && $itemCode !== $code) {
                    $identityConflict++;
                }
            }
        }
        $reserved = $actual - $free;
        $kind = !$identityValid ? 'missing_or_duplicate_carton' :
            ($actual !== 20 ? 'count_mismatch' :
                ($free !== 20 ? 'allocated' :
                    ($identityConflict > 0 ? 'identity_conflict' : 'ok')));
        if ($kind !== 'ok') {
            $mismatchCount++;
        }
        $totalActual += $actual;
        $totalReserved += $reserved;
        $counts[] = [
            'code' => $code,
            'kind' => $kind,
            'actual' => $actual,
            'free' => $free,
            'reserved' => $reserved,
            'distinct_order_references' => count($distinctOrders),
            'identity_conflicts' => $identityConflict,
        ];
    }

    echo json_encode([
        'ok' => true,
        'read_only' => true,
        'safety_passed' => $mismatchCount === 0,
        'revision' => (int)$row['revision'],
        'protected_cartons_expected' => count(GP_PROTECTED_CODES),
        'cartons_with_mismatch' => $mismatchCount,
        'protected_inventory_actual' => $totalActual,
        'protected_inventory_reserved' => $totalReserved,
        'cartons' => $counts,
    ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (Throwable $exception) {
    // Never disclose SQL exception text, connection settings, serials or state JSON.
    http_response_code(500);
    echo '{"ok":false,"read_only":true,"error":"diagnostic_unavailable"}';
}
