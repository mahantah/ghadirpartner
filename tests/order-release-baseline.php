<?php
declare(strict_types=1);

define('ORDER_RELEASE_BASELINE_TEST', true);
require dirname(__DIR__) . '/scripts/inspect-order-release-baseline.php';

$root = sys_get_temp_dir() . '/gp-release-inspection-' . bin2hex(random_bytes(6));
mkdir($root, 0700);
$source = 'original order source';
$patched = 'patched order source';
file_put_contents($root . '/index.php', $source);
$manifest = [
    'before_files' => ['index.php' => hash('sha256', $source)],
    'expected_files' => ['index.php' => hash('sha256', $patched)],
    'operations' => [['file' => 'index.php', 'old' => 'original', 'new' => 'patched', 'count' => 1]],
];

try {
    $result = (new OrderReleaseBaselineInspection($root, ['native_order' => $manifest]))->inspect();
    $files = $result['manifests']['native_order']['files'];
    $anchors = $result['manifests']['native_order']['anchors'];
    if ($result['ok'] !== true || $result['read_only'] !== true
        || $files['index.php']['matches_before'] !== true
        || $files['index.php']['matches_expected_patch'] !== true
        || $anchors[0]['found'] !== 1 || $anchors[0]['required'] !== 1
        || file_get_contents($root . '/index.php') !== $source) {
        throw new RuntimeException('baseline_check_failed');
    }

    $manifest['operations'][0]['count'] = 2;
    $mismatch = (new OrderReleaseBaselineInspection($root, ['native_order' => $manifest]))->inspect();
    if ($mismatch['manifests']['native_order']['anchors'][0]['found'] !== 1
        || $mismatch['manifests']['native_order']['files']['index.php']['matches_expected_patch'] !== false
        || file_get_contents($root . '/index.php') !== $source) {
        throw new RuntimeException('anchor_check_failed');
    }

    $manifest['expected_files'] = ['config.php' => hash('sha256', $source)];
    try {
        (new OrderReleaseBaselineInspection($root, ['native_order' => $manifest]))->inspect();
        throw new RuntimeException('unexpected_allowlist_success');
    } catch (RuntimeException $exception) {
        if ($exception->getMessage() !== 'invalid_manifest') {
            throw $exception;
        }
    }
} finally {
    unlink($root . '/index.php');
    rmdir($root);
}

echo "PASS: production order release baseline inspection is read-only and allowlisted\n";
