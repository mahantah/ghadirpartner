<?php
declare(strict_types=1);
/* One-time repair: order GHP-000137 item serials after pre-V2 exchanges. Inventory untouched. */
const GP_ORDER_137_EXCHANGE_REPAIR = 137;
const GP_ORDER_137_REPAIR_TOKEN = '__REPAIR_TOKEN__';

require_once __DIR__ . '/lib/order-return-exchange.php';

function gp_order137_find_order(array $state): int {
    foreach ($state['orders'] ?? [] as $i => $o) {
        if ((int)($o['id'] ?? 0) === GP_ORDER_137_EXCHANGE_REPAIR) {
            return $i;
        }
    }
    return -1;
}

/** @return array<string,mixed> */
function gp_order137_repair_plan(array $state): array {
    $oi = gp_order137_find_order($state);
    if ($oi < 0) {
        throw new RuntimeException('order_not_found');
    }
    $beforeOrder = $state['orders'][$oi];
    $work = json_decode(json_encode($state, JSON_THROW_ON_ERROR), true, 512, JSON_THROW_ON_ERROR);
    $order = &$work['orders'][$oi];
    $itemsChanged = ghadir_order_repair_exchange_item_serials($order, $work['inventory'] ?? []);
    $exPatched = 0;
    foreach (($beforeOrder['exchanges'] ?? []) as $i => $exBefore) {
        $exAfter = $order['exchanges'][$i] ?? [];
        if (($exBefore['returned_serials_replaced'] ?? []) !== ($exAfter['returned_serials_replaced'] ?? [])) {
            $exPatched++;
        }
    }
    return [
        'order_id' => GP_ORDER_137_EXCHANGE_REPAIR,
        'number' => (string)($order['number'] ?? ''),
        'eligible' => $itemsChanged || $exPatched > 0,
        'items_changed' => $itemsChanged,
        'exchanges_patched' => $exPatched,
        'before_items' => $beforeOrder['items'] ?? [],
        'after_items' => $order['items'] ?? [],
        'exchanges' => $order['exchanges'] ?? [],
        'inventory_unchanged' => true,
        'state' => $work,
    ];
}

function gp_order137_handle(string $mode, int $expectedRevision = 0): array {
    $cfg = require __DIR__ . '/config.php';
    $mysql = $cfg['mysql'] ?? [];
    if (!is_array($mysql) || empty($mysql['username']) || empty($mysql['database'])) {
        throw new RuntimeException('configuration_invalid');
    }
    $pdo = new PDO(
        'mysql:host=' . ($mysql['host'] ?? 'localhost') . ';port=' . (int)($mysql['port'] ?? 3306)
            . ';dbname=' . $mysql['database'] . ';charset=' . ($mysql['charset'] ?? 'utf8mb4'),
        (string)$mysql['username'],
        (string)($mysql['password'] ?? ''),
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
    $write = $mode === 'apply';
    try {
        if ($write) {
            $pdo->beginTransaction();
        }
        $row = $pdo->query('SELECT state_json,revision FROM ghadir_state WHERE id=1' . ($write ? ' FOR UPDATE' : ''))->fetch();
        if (!$row) {
            throw new RuntimeException('state_missing');
        }
        $revision = (int)$row['revision'];
        $state = json_decode((string)$row['state_json'], true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($state)) {
            throw new RuntimeException('state_invalid');
        }
        $plan = gp_order137_repair_plan($state);
        if ($mode === 'inspect') {
            unset($plan['state']);
            return array_merge(['ok' => true, 'mode' => 'inspect', 'revision' => $revision], $plan);
        }
        if ($mode === 'verify') {
            $oi = gp_order137_find_order($state);
            $items = $state['orders'][$oi]['items'] ?? [];
            $pending = ghadir_order_exchange_pending_by_product($state['orders'][$oi]);
            return [
                'ok' => empty($pending),
                'mode' => 'verify',
                'revision' => $revision,
                'pending' => $pending,
                'items' => $items,
            ];
        }
        if (!$write) {
            throw new RuntimeException('invalid_mode');
        }
        if ($expectedRevision < 1 || $expectedRevision !== $revision) {
            throw new RuntimeException('revision_changed');
        }
        if (!$plan['eligible']) {
            $pdo->commit();
            return ['ok' => true, 'mode' => 'already_aligned', 'revision' => $revision];
        }
        $newState = $plan['state'];
        $oi = gp_order137_find_order($newState);
        $newState['orders'][$oi]['updated_at'] = date('Y-m-d H:i:s');
        if (!isset($newState['orders'][$oi]['history']) || !is_array($newState['orders'][$oi]['history'])) {
            $newState['orders'][$oi]['history'] = [];
        }
        $newState['orders'][$oi]['history'][] = [
            'at' => date('Y-m-d H:i:s'),
            'by' => 'system-repair',
            'action' => 'هم‌ترازسازی سریال‌های سفارش پس از تعویض مرجوعی (repair #137)',
        ];
        $dir = __DIR__ . '/storage/Backups';
        if (!is_dir($dir) && !mkdir($dir, 0750, true)) {
            throw new RuntimeException('backup_directory_failed');
        }
        $backup = $dir . '/ghadir-pre-order-137-exchange-repair-' . date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.json';
        $oldUmask = umask(0077);
        try {
            $wrote = file_put_contents($backup, (string)$row['state_json'], LOCK_EX);
        } finally {
            umask($oldUmask);
        }
        if ($wrote !== strlen((string)$row['state_json']) || !chmod($backup, 0600)) {
            throw new RuntimeException('backup_failed');
        }
        $encoded = json_encode($newState, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $checksum = hash('sha256', $encoded);
        $newRevision = $revision + 1;
        $update = $pdo->prepare('UPDATE ghadir_state SET state_json=?,revision=?,checksum=?,updated_at=NOW() WHERE id=1 AND revision=?');
        $update->execute([$encoded, $newRevision, $checksum, $revision]);
        if ($update->rowCount() !== 1) {
            throw new RuntimeException('revision_changed');
        }
        $audit = $pdo->prepare('INSERT INTO ghadir_state_audit (revision,checksum,bytes) VALUES (?,?,?)');
        $audit->execute([$newRevision, $checksum, strlen($encoded)]);
        $pdo->commit();
        unset($plan['state']);
        return array_merge([
            'ok' => true,
            'mode' => 'applied',
            'revision' => $newRevision,
            'backup_created' => true,
            'inventory_unchanged' => true,
        ], $plan);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

if (!defined('GP_ORDER_137_REPAIR_TEST_MODE')) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    @ini_set('display_errors', '0');
    $token = (string)($_SERVER['HTTP_X_GP_REPAIR_TOKEN'] ?? '');
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST'
        || empty($_SERVER['HTTPS']) || $_SERVER['HTTPS'] === 'off'
        || strlen(GP_ORDER_137_REPAIR_TOKEN) !== 64
        || !hash_equals(GP_ORDER_137_REPAIR_TOKEN, $token)) {
        http_response_code(403);
        echo '{"ok":false,"error":"forbidden"}';
        exit;
    }
    $mode = (string)($_POST['mode'] ?? '');
    if (!in_array($mode, ['inspect', 'apply', 'verify'], true)) {
        http_response_code(400);
        echo '{"ok":false,"error":"invalid_mode"}';
        exit;
    }
    try {
        $expected = (int)($_POST['expected_revision'] ?? 0);
        echo json_encode(gp_order137_handle($mode, $expected), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
    }
}
