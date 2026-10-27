<?php
declare(strict_types=1);
/** Inspect shipment evidence server-side and expose only aggregate counts. */
// GP_PRESWITCH_INTEGRITY_INLINE_20261021

final class ShipmentEvidence
{
    /**
     * Compare linked inventory with shipment snapshots without changing state.
     * @param array<string,mixed> $state Decoded application state.
     * @return array<string,mixed> Sanitized counts and fixed status labels only.
     */
    public function inspect(array $state, string $code): array
    {
        $report = gp_preswitch_allocated_carton_integrity($state, $code);
        $ids = [];
        foreach ($state['cartons'] ?? [] as $carton) {
            if (gp_integrity_key($carton['code'] ?? '') === $code) $ids[] = (int)$carton['id'];
        }
        $linked = [];
        $outside = 0;
        foreach ($state['inventory'] ?? [] as $row) {
            if (!in_array((int)($row['carton_id'] ?? 0), $ids, true) && gp_integrity_key($row['carton_code'] ?? '') !== $code) continue;
            $oid = (int)($row['order_id'] ?? 0);
            if ($oid > 0) $linked[$oid][] = gp_integrity_key($row['serial'] ?? '');
            if ((int)($row['warehouse_id'] ?? -1) === 0) $outside++;
        }
        $statuses = [];
        $snapshots = 0;
        $ordersWithShipHistory = 0;
        $ordersWithCompleteFlag = 0;
        foreach ($state['orders'] ?? [] as $order) {
            $serials = $linked[(int)($order['id'] ?? 0)] ?? [];
            if (!$serials) continue;
            $status = (string)($order['status'] ?? '');
            if (!in_array($status, ['ثبت شده','در حال آماده سازی','آماده ارسال','ارسال شد','تحویل شد','لغو شد'], true)) $status = 'unknown';
            $statuses[$status] = ($statuses[$status] ?? 0) + 1;
            $sent = gp_integrity_shipped_serials($order);
            foreach ($serials as $serial) if (isset($sent[$serial])) $snapshots++;
            foreach ($order['history'] ?? [] as $history) {
                if (strpos((string)($history['action'] ?? ''), '«ارسال شد»') !== false) {
                    $ordersWithShipHistory++;
                    break;
                }
            }
            if (empty($order['partial_exit']) && ($order['incomplete_status'] ?? '') !== 'تأیید شده') $ordersWithCompleteFlag++;
        }
        return ['integrity'=>$report,'outside_warehouse'=>$outside,'linked_orders'=>count($linked),
            'order_status_counts'=>$statuses,'serials_with_shipment_snapshot'=>$snapshots,
            'orders_with_dispatch_history'=>$ordersWithShipHistory,'orders_with_complete_flag'=>$ordersWithCompleteFlag];
    }
}

if (realpath((string)($_SERVER['SCRIPT_FILENAME'] ?? '')) !== __FILE__) return;
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
ini_set('display_errors', '0');
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !hash_equals('__PROBE_TOKEN__', (string)($_SERVER['HTTP_X_GP_PROBE_TOKEN'] ?? ''))) {
    http_response_code(403);
    exit('{"ok":false}');
}
$code = strtoupper(trim((string)($_POST['carton'] ?? '')));
if (!preg_match('/^I90-\d{3}$/D', $code)) { http_response_code(400); exit('{"ok":false}'); }
$pdo = null;
try {
    $config = require __DIR__.'/config.php';
    $db = $config['mysql'];
    $pdo = new PDO('mysql:host='.($db['host'] ?? 'localhost').';port='.($db['port'] ?? 3306).';dbname='.$db['database'].';charset=utf8mb4', $db['username'], $db['password'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    $pdo->exec('SET TRANSACTION READ ONLY');
    $pdo->beginTransaction();
    $row = $pdo->query('SELECT state_json FROM ghadir_state WHERE id=1')->fetch(PDO::FETCH_ASSOC);
    $state = json_decode((string)$row['state_json'], true, 512, JSON_THROW_ON_ERROR);
    $result = (new ShipmentEvidence())->inspect($state, $code);
    $pdo->rollBack();
    echo json_encode(['ok'=>true,'read_only'=>true,'evidence'=>$result], JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    if ($pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo '{"ok":false,"error":"evidence_probe_failed"}';
}
