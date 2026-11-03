<?php
declare(strict_types=1);

/** Read-only fingerprint and patch-anchor inspection of the active owner code. */
final class OrderReleaseBaselineInspection
{
    private string $root;
    /** @var array<string,array<string,mixed>> */
    private array $manifests;

    private const ALLOWED_FILES = [
        'index.php', 'partners/index.php', 'partners/native-r54.php',
        'lib/storage.php', 'app.html', 'partners/portal.html',
        'lib/native-order-flow.php', 'lib/native-order-flow-routes.php',
        'config/native-order-flow.yaml', 'lib/customer-credit.php',
        'lib/customer-credit-routes.php', 'config/customer-credit.yaml',
        'assets/customer-credit.js',
    ];

    /**
     * Initialize the read-only release inspector.
     *
     * @param string $root Temporary private mirror of the production web root.
     * @param array<string,array<string,mixed>> $manifests Verified finite release manifests.
     */
    public function __construct(string $root, array $manifests)
    {
        $this->root = $root;
        $this->manifests = $manifests;
    }

    /**
     * Inspect current file hashes and simulate anchor replacements without publishing.
     *
     * @return array<string,mixed> Files, hashed candidates and anchor counts only.
     */
    public function inspect(): array
    {
        $results = [];
        foreach ($this->manifests as $name => $manifest) {
            $before = $manifest['before_files'] ?? null;
            $expected = $manifest['expected_files'] ?? null;
            $operations = $manifest['operations'] ?? null;
            if (!is_array($before) || !is_array($expected) || !is_array($operations)) {
                throw new RuntimeException('invalid_manifest');
            }
            $files = [];
            $staged = [];
            foreach ($expected as $path => $expectedHash) {
                if (!is_string($path) || !in_array($path, self::ALLOWED_FILES, true)
                    || !is_string($expectedHash) || !preg_match('/^[0-9a-f]{64}$/D', $expectedHash)) {
                    throw new RuntimeException('invalid_manifest');
                }
                $full = $this->root . '/' . $path;
                $content = is_file($full) ? file_get_contents($full) : false;
                if ($content === false && is_file($full)) {
                    throw new RuntimeException('unreadable_source');
                }
                $actualHash = $content !== false ? hash('sha256', $content) : null;
                $files[$path] = [
                    'sha256' => $actualHash,
                    'expected_before' => $before[$path] ?? null,
                    'matches_before' => isset($before[$path]) && $actualHash === $before[$path],
                    'matches_release' => $actualHash === $expectedHash,
                ];
                if (isset($before[$path]) && $content !== false) {
                    $staged[$path] = $content;
                }
            }
            $original = $staged;
            $anchors = [];
            foreach ($operations as $index => $operation) {
                if (!is_array($operation) || !isset($operation['file'], $operation['old'], $operation['new'], $operation['count'])
                    || !is_string($operation['file']) || !array_key_exists($operation['file'], $before)
                    || !is_string($operation['old']) || $operation['old'] === '' || !is_string($operation['new'])
                    || !is_int($operation['count']) || $operation['count'] < 1) {
                    throw new RuntimeException('invalid_manifest');
                }
                $file = $operation['file'];
                $found = isset($staged[$file]) ? substr_count($staged[$file], $operation['old']) : 0;
                $anchors[] = [
                    'operation' => $index,
                    'file' => $file,
                    'found' => $found,
                    'required' => $operation['count'],
                    'original_old_count' => isset($original[$file]) ? substr_count($original[$file], $operation['old']) : 0,
                    'original_new_count' => isset($original[$file]) ? substr_count($original[$file], $operation['new']) : 0,
                ];
                if ($found === $operation['count']) {
                    $staged[$file] = str_replace($operation['old'], $operation['new'], $staged[$file]);
                }
            }
            foreach ($staged as $path => $content) {
                $files[$path]['patched_sha256'] = hash('sha256', $content);
                $files[$path]['matches_expected_patch'] = hash('sha256', $content) === $expected[$path];
            }
            $results[$name] = ['files' => $files, 'anchors' => $anchors];
        }
        return ['ok' => true, 'read_only' => true, 'manifests' => $results];
    }
}

if (defined('ORDER_RELEASE_BASELINE_TEST')) {
    return;
}
if (PHP_SAPI !== 'cli' || count($argv) !== 2 || !is_dir($argv[1])) {
    http_response_code(403);
    exit(1);
}
try {
    /** @var array<string,array<string,mixed>> $manifests */
    $manifests = [
        'native_order' => json_decode(file_get_contents(__DIR__ . '/../config/native-order-release.yaml'), true, 512, JSON_THROW_ON_ERROR),
        'customer_credit' => json_decode(file_get_contents(__DIR__ . '/../config/customer-credit-release.yaml'), true, 512, JSON_THROW_ON_ERROR),
    ];
    echo json_encode((new OrderReleaseBaselineInspection($argv[1], $manifests))->inspect(), JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT);
} catch (Throwable $error) {
    fwrite(STDERR, "inspection_failed\n");
    exit(1);
}
