<?php
declare(strict_types=1);
/* Restore non-exchange order-137 item serials from the repair backup; keep H9 PRO as repaired. */
const GP_ORDER_137_RESTORE = 137;
const GP_ORDER_137_RESTORE_TOKEN = '__RESTORE_TOKEN__';
const GP_H9_PRODUCT = 'MOREFUN - H9 PRO';

function gp_order137_restore_find_order(array $state): int {
    foreach ($state['orders'] ?? [] as $i => $o) {
        if ((int)($o['id'] ?? 0) === GP_ORDER_137_RESTORE) {
            return $i;
        }
    }
    return -1;
}

function gp_order137_restore_latest_backup(string $dir): ?string {
    if (!is_dir($dir)) {
        return null;
    }
    $best = null;
    $bestM = 0;
    foreach (scandir($dir) ?: [] as $name) {
        if (!str_starts_with($name, 'ghadir-pre-order-137-exchange-repair-') || !str_ends_with($name, '.json')) {
            continue;
        }
        $path = $dir . '/' . $name;
        $m = (int)@filemtime($path);
        if ($m >= $bestM) {
            $bestM = $m;
            $best = $path;
        }
    }
    return $best;
}

/** @return array<string,mixed> */
function gp_order137_restore_plan(array $state, array $backupState): array {
    $oi = gp_order137_restore_find_order($state);
    $boi = gp_order137_restore_find_order($backupState);
    if ($oi < 0 || $boi < 0) {
        throw new RuntimeException('order_not_found');
    }
    $work = json_decode(json_encode($state, JSON_THROW_ON_ERROR), true, 512, JSON_THROW_ON_ERROR);
    $changedLines = [];
    foreach ($work['orders'][$oi]['items'] ?? [] as $i => $it) {
        $product = (string)($it['product'] ?? '');
        if ($product === GP_H9_PRODUCT) {
            continue;
        }
        $before = array_values($it['serials'] ?? []);
        $fromBackup = array_values($backupState['orders'][$boi]['items'][$i]['serials'] ?? []);
        if ($fromBackup && $fromBackup !== $before) {
            $work['orders'][$oi]['items'][$i]['serials'] = $fromBackup;
            $changedLines[] = ['index' => $i, 'product' => $product, 'count' => count($fromBackup)];
        }
    }
    return [
        'order_id' => GP_ORDER_137_RESTORE,
        'number' => (string)($work['orders'][$oi]['number'] ?? ''),
        'eligible' => (bool)$changedLines,
        'changed_lines' => $changedLines,
        'h9_serials' => (function () use ($work, $oi) {
            foreach ($work['orders'][$oi]['items'] ?? [] as $it) {
                if ((string)($it['product'] ?? '') === GP_H9_PRODUCT) {
                    return array_values($it['serials'] ?? []);
                }
            }
            return [];
        })(),
        'inventory_unchanged' => true,
        'state' => $work,
    ];
}

function gp_order137_restore_handle(string $mode, int $expectedRevision = 0): array {
    $cfg = require __DIR__ . '/config.php';
    $mysql = $cfg['mysql'] ?? [];
    if (!is_array($mysql) || empty($mysql['username']) || empty($mysql['database'])) {
        throw new RuntimeException('configuration_invalid');
    }
    $backupPath = gp_order137_restore_latest_backup(__DIR__ . '/storage/Backups');
    if (!$backupPath || !is_readable($backupPath)) {
        throw new RuntimeException('repair_backup_missing');
    }
    $backupState = json_decode((string)file_get_contents($backupPath), true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($backupState)) {
        throw new RuntimeException('repair_backup_invalid');
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
        $plan = gp_order137_restore_plan($state, $backupState);
        if ($mode === 'inspect') {
            unset($plan['state']);
            return array_merge([
                'ok' => true,
                'mode' => 'inspect',
                'revision' => $revision,
                'backup' => basename($backupPath),
            ], $plan);
        }
        if (!$write) {
            throw new RuntimeException('invalid_mode');
        }
        if ($expectedRevision < 1 || $expectedRevision !== $revision) {
            throw new RuntimeException('revision_changed');
        }
        if (!$plan['eligible']) {
            $pdo->commit();
            return ['ok' => true, 'mode' => 'already_restored', 'revision' => $revision];
        }
        $newState = $plan['state'];
        $oi = gp_order137_restore_find_order($newState);
        $newState['orders'][$oi]['updated_at'] = date('Y-m-d H:i:s');
        $newState['orders'][$oi]['history'][] = [
            'at' => date('Y-m-d H:i:s'),
            'by' => 'system-repair',
            'action' => 'بازگردانی سریال اقلام بدون تعویض سفارش #137 پس از repair',
        ];
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
            'backup' => basename($backupPath),
        ], $plan);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

if (!defined('GP_ORDER_137_RESTORE_TEST_MODE')) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    $token = (string)($_SERVER['HTTP_X_GP_RESTORE_TOKEN'] ?? '');
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST'
        || empty($_SERVER['HTTPS']) || $_SERVER['HTTPS'] === 'off'
        || strlen(GP_ORDER_137_RESTORE_TOKEN) !== 64
        || !hash_equals(GP_ORDER_137_RESTORE_TOKEN, $token)) {
        http_response_code(403);
        echo '{"ok":false,"error":"forbidden"}';
        exit;
    }
    $mode = (string)($_POST['mode'] ?? '');
    if (!in_array($mode, ['inspect', 'apply'], true)) {
        http_response_code(400);
        echo '{"ok":false,"error":"invalid_mode"}';
        exit;
    }
    try {
        $expected = (int)($_POST['expected_revision'] ?? 0);
        echo json_encode(gp_order137_restore_handle($mode, $expected), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
    }
}
