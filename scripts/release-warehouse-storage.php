<?php
declare(strict_types=1);

/** Apply a privately staged warehouse release using the host's CLI, never an HTTP endpoint. */
final class GpWarehouseRelease
{
    private string $root;
    private string $stage;
    private string $report;
    private string $phase = 'preflight';
    /**
     * @var array<string, mixed> */
    private array $manifest;
    /**
     * @var array<string, string|null> */
    private array $originalFiles = [];

    /** Resolve only the explicitly supplied application root and adjacent private bundle. */
    public function __construct(string $root, string $directory)
    {
        $resolved = realpath($root);
        if ($resolved === false || !is_file($resolved . '/config.php')) throw new RuntimeException('application_root_missing');
        $this->root = $resolved; $this->stage = $directory . '/candidate'; $this->report = $directory . '/report.json';
        $manifest = json_decode((string)file_get_contents($directory . '/manifest.json'), true);
        if (!is_array($manifest) || !isset($manifest['original'], $manifest['candidate'], $manifest['protected_cartons'], $manifest['drain_seconds'])) throw new RuntimeException('release_manifest_invalid');
        $this->manifest = $manifest;
    }

    /** Identify the failed operation without disclosing record content. */
    public function phase(): string { return $this->phase; }

    /** Record fixed status and aggregate counts only, never customer, serial or credential values.
     *
     * @param array<string, mixed> $details
     */
    public function status(string $status, array $details = []): void
    {
        $data = ['status' => $status, 'at' => date('c')] + $details;
        if (file_put_contents($this->report, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX) === false) throw new RuntimeException('release_report_failed');
        chmod($this->report, 0600);
    }

    /** Reject concurrent edits and invalid PHP before making any live change. */
    private function verifyFiles(): void
    {
        foreach ($this->manifest['original'] as $name => $hash) {
            $this->validPath($name);
            if (!hash_equals($hash, (string)hash_file('sha256', $this->root . '/' . $name))) throw new RuntimeException('source_hash_mismatch');
        }
        foreach ($this->manifest['candidate'] as $name => $hash) {
            $this->validPath($name);
            $path = $this->stage . '/' . $name;
            if (!hash_equals($hash, (string)hash_file('sha256', $path))) throw new RuntimeException('candidate_hash_mismatch');
            if (substr($name, -4) === '.php' && !token_get_all((string)file_get_contents($path), TOKEN_PARSE)) throw new RuntimeException('empty_php_candidate');
        }
    }

    /** Bound every copied file to the reviewed relative application paths. */
    private function validPath(string $path): void
    {
        if (strpos($path, '..') !== false || !preg_match('~^(?:index\.php|app\.html|(?:lib|assets|config)/[A-Za-z0-9._-]+)$~D', $path)) throw new RuntimeException('release_path_invalid');
    }

    /**
     * @param array<string, mixed> $state Retain the repository's blocking protected-carton check. */
    private function integrity(array $state): void
    {
        foreach ($this->manifest['protected_cartons'] as $code) {
            if (empty(gp_preswitch_allocated_carton_integrity($state, $code)['ok'])) throw new RuntimeException('protected_carton_state_mismatch');
        }
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed> */
    private function state(array $row): array
    {
        $raw = (string)$row['state_json'];
        if (!hash_equals((string)$row['checksum'], hash('sha256', $raw))) throw new RuntimeException('state_checksum_mismatch');
        $state = json_decode($raw, true);
        if (!is_array($state) || !isset($state['inventory'], $state['cartons'], $state['warehouse_movements'])) throw new RuntimeException('legacy_state_shape_mismatch');
        return $state;
    }

    /** Publish one file by same-directory atomic rename with a private rollback copy. */
    private function publish(string $name): void
    {
        $target = $this->root . '/' . $name;
        if (!array_key_exists($name, $this->originalFiles)) {
            $this->originalFiles[$name] = is_file($target) ? (string)file_get_contents($target) : null;
            if ($this->originalFiles[$name] !== null) {
                $backup = dirname($this->stage) . '/rollback/' . $name;
                if (!is_dir(dirname($backup)) && !mkdir(dirname($backup), 0700, true)) throw new RuntimeException('rollback_directory_failed');
                if (file_put_contents($backup, $this->originalFiles[$name], LOCK_EX) === false) throw new RuntimeException('rollback_backup_failed');
                chmod($backup, 0600);
            }
        }
        $temporary = $target . '.gp-warehouse-stage';
        if (!copy($this->stage . '/' . $name, $temporary) || !chmod($temporary, 0644) || !rename($temporary, $target)) throw new RuntimeException('publish_failed');
        if (!hash_equals($this->manifest['candidate'][$name], (string)hash_file('sha256', $target))) throw new RuntimeException('publish_readback_failed');
        if (function_exists('opcache_invalidate')) opcache_invalidate($target, true);
    }

    /** Restore availability even when deployment failed; a restoration failure takes precedence. */
    private function restoreAccess(string $path, string $contents): void
    {
        if (file_put_contents($path, $contents, LOCK_EX) === false) throw new RuntimeException('maintenance_restore_failed');
    }

    /** Execute a check or one atomic migration; report aggregate evidence only. */
    public function run(string $mode): void
    {
        if (!in_array($mode, ['check', 'probe', 'apply'], true)) throw new RuntimeException('release_mode_invalid');
        $this->verifyFiles();
        global $cfg;
        $cfg = require $this->root . '/config.php';
        date_default_timezone_set((string)($cfg['timezone'] ?? 'Asia/Tehran'));
        require_once $this->stage . '/lib/storage.php';
        require_once dirname($this->stage) . '/preswitch-carton-integrity.php';
        $pdo = ghadir_mysql_pdo();
        $storage = GpWarehouseStorage::create($pdo);
        $row = $pdo->query('SELECT state_json,revision,checksum FROM ghadir_state WHERE id=1')->fetch();
        if (!is_array($row)) throw new RuntimeException('state_missing');
        $state = $this->state($row);
        $this->integrity($state);
        $originalSerials = hash('sha256', GpWarehouseRepository::encode($state['inventory']));
        $repair = $storage->repairHistory($state);
        if ($originalSerials !== hash('sha256', GpWarehouseRepository::encode($state['inventory']))) throw new RuntimeException('repair_changed_inventory');
        $counts = ['serials' => count($state['inventory']), 'cartons' => count($state['cartons']), 'movements' => count($state['warehouse_movements']), 'repair' => $repair, 'core_bytes_before' => strlen((string)$row['state_json'])];
        if ($mode === 'check') { $this->status('preflight_passed', $counts); return; }
        $this->phase = 'prepare_schema';
        $storage->prepareMigration();
        if ($mode === 'probe') {
            $this->phase = 'probe_migration';
            $pdo->beginTransaction();
            try {
                $row = $pdo->query('SELECT state_json,revision,checksum FROM ghadir_state WHERE id=1 FOR UPDATE')->fetch();
                if (!is_array($row)) throw new RuntimeException('state_missing');
                $state = $this->state($row); $this->integrity($state);
                $storage->repairHistory($state);
                $storage->migrate($state);
                $this->status('probe_passed', $counts);
            } finally {
                $pdo->rollBack();
            }
            return;
        }
        $maintenance = $this->root . '/.htaccess';
        $originalHtaccess = (string)file_get_contents($maintenance);
        $maintenanceActive = false; $committed = false;
        try {
            if (file_put_contents($maintenance, "# GP_WAREHOUSE_MAINTENANCE\nRewriteEngine On\nRewriteRule ^ - [R=503,L]\nErrorDocument 503 \"Warehouse upgrade in progress. Please retry shortly.\"\n" . $originalHtaccess, LOCK_EX) === false) throw new RuntimeException('maintenance_failed');
            $maintenanceActive = true;
            $this->status('maintenance', $counts);
            // Shared hosts can close idle MySQL sessions during the HTTP drain.
            $remaining = (int)$this->manifest['drain_seconds'];
            $timeout = (int)$pdo->query('SELECT @@wait_timeout')->fetchColumn();
            $heartbeat = max(1, intdiv($timeout, 2));
            while ($remaining > 0) {
                $pause = min($remaining, $heartbeat);
                sleep($pause);
                $pdo->query('SELECT 1')->fetchColumn();
                $remaining -= $pause;
            }
            $this->phase = 'lock_core';
            $this->verifyFiles();
            $pdo->beginTransaction();
            $row = $pdo->query('SELECT state_json,revision,checksum FROM ghadir_state WHERE id=1 FOR UPDATE')->fetch();
            if (!is_array($row)) throw new RuntimeException('state_missing');
            $state = $this->state($row); $this->integrity($state);
            $serialHash = hash('sha256', GpWarehouseRepository::encode($state['inventory']));
            $cartonHash = hash('sha256', GpWarehouseRepository::encode($state['cartons']));
            $repair = $storage->repairHistory($state);
            if ($serialHash !== hash('sha256', GpWarehouseRepository::encode($state['inventory'])) || $cartonHash !== hash('sha256', GpWarehouseRepository::encode($state['cartons']))) throw new RuntimeException('repair_changed_inventory');
            $this->phase = 'migrate_collections';
            $core = $storage->migrate($state);
            $roundtrip = $core; $storage->hydrate($roundtrip); $this->integrity($roundtrip);
            if ($serialHash !== hash('sha256', GpWarehouseRepository::encode($roundtrip['inventory'])) || $cartonHash !== hash('sha256', GpWarehouseRepository::encode($roundtrip['cartons']))) throw new RuntimeException('migration_hash_mismatch');
            $this->phase = 'publish_files';
            foreach (array_keys($this->manifest['candidate']) as $name) $this->publish($name);
            $this->phase = 'commit_core';
            $encoded = GpWarehouseRepository::encode($core); $checksum = hash('sha256', $encoded); $revision = (int)$row['revision'] + 1;
            $pdo->prepare('UPDATE ghadir_state SET state_json=?,checksum=?,revision=?,updated_at=NOW() WHERE id=1')->execute([$encoded, $checksum, $revision]);
            $pdo->prepare('INSERT INTO ghadir_state_audit (revision,checksum,bytes) VALUES (?,?,?)')->execute([$revision, $checksum, strlen($encoded)]);
            $pdo->commit(); $committed = true;
            $this->status('applied', $counts + ['core_bytes_after' => strlen($encoded), 'revision' => $revision, 'inventory_hash_verified' => true, 'carton_hash_verified' => true]);
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            if (!$committed) {
                foreach ($this->originalFiles as $name => $content) {
                    $path = $this->root . '/' . $name;
                    if ($content === null) { if (is_file($path) && !unlink($path)) throw new RuntimeException('rollback_failed'); }
                    elseif (file_put_contents($path, $content, LOCK_EX) === false) throw new RuntimeException('rollback_failed');
                    if (function_exists('opcache_invalidate')) opcache_invalidate($path, true);
                }
            }
            throw $error;
        } finally {
            if ($maintenanceActive) $this->restoreAccess($maintenance, $originalHtaccess);
        }
    }
}

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
if (defined('GP_WAREHOUSE_RELEASE_TEST')) return;
$release = null;
try {
    $mode = (string)($argv[1] ?? 'check');
    $release = new GpWarehouseRelease((string)($argv[2] ?? dirname(__DIR__) . '/public_html'), __DIR__);
    $release->run($mode);
} catch (Throwable $error) {
    $safe = ['application_root_missing','release_manifest_invalid','source_hash_mismatch','candidate_hash_mismatch','release_path_invalid','protected_carton_state_mismatch','state_checksum_mismatch','legacy_state_shape_mismatch','state_missing','repair_changed_inventory','maintenance_failed','publish_failed','publish_readback_failed','rollback_failed','maintenance_restore_failed','warehouse_already_split','warehouse_shadow_tables_not_empty','warehouse_roundtrip_mismatch','warehouse_guard_definition_mismatch','invalid_or_duplicate_warehouse_id','invalid_or_duplicate_serial','product_index_too_long','warehouse_activation_date_missing','empty_inventory_serial','warehouse_transaction_required','invalid_warehouse_record','warehouse_json_encode_failed','migration_hash_mismatch'];
    $reason = in_array($error->getMessage(), $safe, true) ? $error->getMessage() : 'release_failed';
    if ($release instanceof GpWarehouseRelease) $release->status('blocked', ['error' => $reason, 'phase' => $release->phase(), 'exception' => get_class($error), 'sqlstate' => $error instanceof PDOException ? (string)($error->errorInfo[0] ?? '') : null, 'driver_code' => $error instanceof PDOException ? (int)($error->errorInfo[1] ?? 0) : null]);
    fwrite(STDERR, $reason . "\n"); exit(1);
}
