<?php
declare(strict_types=1);
/** Check shared-host capabilities and protected cartons without exporting application state. */
// GP_PRESWITCH_INTEGRITY_INLINE_20261021
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
ini_set('display_errors', '0');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || !hash_equals('__PROBE_TOKEN__', (string) ($_SERVER['HTTP_X_GP_PROBE_TOKEN'] ?? ''))) { http_response_code(403); exit('{"ok":false}'); }
$pdo = null;
try {
    foreach (['curl_init','openssl_verify','openssl_x509_fingerprint','iconv','gzinflate'] as $capability) if (!function_exists($capability)) throw new RuntimeException('missing_server_capability');
    if (PHP_INT_SIZE < 8) throw new RuntimeException('unsupported_server_integer_size');
    $config = require __DIR__.'/config.php'; $db = $config['mysql'];
    $pdo = new PDO('mysql:host='.($db['host'] ?? 'localhost').';port='.($db['port'] ?? 3306).';dbname='.$db['database'].';charset=utf8mb4', $db['username'], $db['password'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    $pdo->exec('SET TRANSACTION READ ONLY'); $pdo->beginTransaction();
    $record = $pdo->query('SELECT state_json FROM ghadir_state WHERE id=1')->fetch(PDO::FETCH_ASSOC);
    $state = json_decode((string) $record['state_json'], true, 512, JSON_THROW_ON_ERROR);
    $cartons = json_decode('__PROTECTED_CARTONS__', true, 512, JSON_THROW_ON_ERROR);
    foreach ($cartons as $code) if (!gp_preswitch_allocated_carton_integrity($state, $code)['ok']) throw new RuntimeException('protected_carton_state_mismatch');
    $pdo->rollBack();
    echo json_encode(['ok'=>true,'read_only'=>true,'protected_cartons'=>count($cartons),'capabilities'=>true], JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    if ($pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
    $allowed = ['protected_carton_state_mismatch','missing_server_capability','unsupported_server_integer_size'];
    http_response_code(500);
    echo json_encode(['ok'=>false,'error'=>in_array($error->getMessage(), $allowed, true) ? $error->getMessage() : 'preflight_failed'], JSON_THROW_ON_ERROR);
}
