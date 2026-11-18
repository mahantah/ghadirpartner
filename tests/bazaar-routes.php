<?php
declare(strict_types=1);
if (($argv[1] ?? '') === 'child') {
    $scenario = $argv[2]; $file = $argv[3].'/state.json';
    $_SESSION = ['gp_bazaar_csrf'=>str_repeat('a', 64)];
    $_SERVER['HTTP_X_GP_RELEASE_CSRF'] = $scenario === 'admin-write' ? str_repeat('a', 64) : 'wrong';
    $p = '/api/admin/app-releases'; $m = in_array($scenario, ['admin-write','admin-bad-csrf'], true) ? 'POST' : 'GET';
    /** Fixture auth preserves the production administrator capability contract. */
    function auth(array $roles = []): array { global $scenario; return ['id'=>1,'roles'=>[$scenario === 'customer' ? 'customer' : ($scenario === 'staff' ? 'sales' : 'admin')]]; }
    /** Emit one sanitized fixture response using the same exit semantics as production. */
    function out(array $value): void { echo json_encode(['status'=>200,'value'=>$value], JSON_THROW_ON_ERROR); exit; }
    /** Terminate denied fixture requests before any feature storage is created. */
    function fail(string $message, int $status): void { echo json_encode(['status'=>$status], JSON_THROW_ON_ERROR); exit; }
    /** Supply a synthetic settings request rather than opening a production body or state. */
    function input(): array { return ['action'=>'save_token','token'=>'fixture-token-not-production']; }
    require __DIR__.'/../lib/bazaar-releases-route.php';
    exit;
}
$root = sys_get_temp_dir().'/gp-bazaar-route-'.bin2hex(random_bytes(8)); mkdir($root, 0700);
try {
    foreach (['customer'=>403,'staff'=>403,'admin-bad-csrf'=>403,'admin-read'=>200,'admin-write'=>200] as $scenario => $status) {
        $directory = $root.'/'.$scenario; mkdir($directory);
        $command = escapeshellarg(PHP_BINARY).' '.escapeshellarg(__FILE__).' child '.escapeshellarg($scenario).' '.escapeshellarg($directory);
        $response = json_decode((string) shell_exec($command), true, 512, JSON_THROW_ON_ERROR);
        if ($response['status'] !== $status) throw new RuntimeException('Incorrect authorization/CSRF status: '.$scenario);
        if ($status === 403 && is_dir($directory.'/app-releases')) throw new RuntimeException('Denied request created feature storage');
        if ($scenario === 'admin-read' && !preg_match('/^[a-f0-9]{64}$/D', $response['value']['csrf'])) throw new RuntimeException('Missing admin CSRF token');
        if (strpos(json_encode($response), 'fixture-token') !== false) throw new RuntimeException('Token leaked in route response');
    }
    echo "PASS: admin-only routes, CSRF, denied-write isolation and credential redaction\n";
} finally {
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($iterator as $entry) { if ($entry->isDir()) rmdir($entry->getPathname()); else unlink($entry->getPathname()); }
    rmdir($root);
}
