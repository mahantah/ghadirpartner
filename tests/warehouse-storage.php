<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/lib/warehouse-storage.php';

/** Provide the existing movement contract using sanitized fixture data only. */
function ghadir_warehouse_record(array &$state, string $type, string $product, array $serials, int $from, int $to, string $by, int $order = 0, string $number = '', string $note = ''): array
{
    $row = ['id' => $state['next_warehouse_movement']++, 'type' => $type, 'product' => $product, 'serials' => $serials, 'qty' => count($serials), 'from_warehouse_id' => $from, 'to_warehouse_id' => $to, 'created_at' => date('Y-m-d H:i:s'), 'created_by' => $by, 'note' => $note];
    $state['warehouse_movements'][] = $row;
    return $row;
}

/** Fail every assertion even when zend.assertions is disabled. */
function verify(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }

/** Adapt only schema DDL so actual repository operations run against a local transactional PDO. */
final class WarehouseTestPdo extends PDO
{
    /** @var list<string> */
    public array $mysqlSchemas = [];
    /** Create an isolated test database without a network listener. */
    public function __construct() { parent::__construct('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]); }
    /** Simulate metadata lookup only; the production trigger is separately checked on MariaDB. */
    public function query(string $query, ?int $fetchMode = null, mixed ...$fetchModeArgs): PDOStatement|false
    {
        if (str_contains($query, 'information_schema.TRIGGERS')) return parent::query('SELECT NULL WHERE 0');
        return parent::query($query);
    }
    /** Translate table declarations only; CRUD, reads, filters and transactions remain unchanged. */
    public function exec(string $statement): int|false
    {
        if (preg_match('/CREATE TABLE IF NOT EXISTS (ghadir_inventory_[a-z]+)/', $statement, $match)) {
            $this->mysqlSchemas[] = $statement;
            $statement = 'CREATE TABLE IF NOT EXISTS ' . $match[1] . ' (record_id INTEGER PRIMARY KEY,row_position INTEGER NOT NULL,serial_key TEXT UNIQUE,product TEXT NOT NULL,warehouse_id INTEGER NOT NULL,order_id INTEGER NOT NULL,order_number TEXT NOT NULL,carton_id INTEGER NOT NULL,record_json TEXT NOT NULL)';
        }
        if (str_starts_with($statement, 'CREATE TRIGGER')) { $this->mysqlSchemas[] = $statement; return 0; }
        return parent::exec($statement);
    }
}

$ledger = new GpWarehouseLedgerIntegrity();
$state = ['warehouse_activated_at' => '2026-10-01 00:00:00', 'inventory' => [
    ['id' => 1, 'serial' => 'TEST-A', 'product' => 'I90', 'warehouse_id' => 1, 'order_id' => 7, 'added_at' => '2026-10-15 09:00:00'],
    ['id' => 2, 'serial' => 'TEST-B', 'product' => 'I90', 'warehouse_id' => 0, 'order_id' => 8, 'added_at' => '2026-10-17 09:00:00'],
    ['id' => 3, 'serial' => 'BASELINE', 'product' => 'I90', 'warehouse_id' => 1, 'order_id' => 0, 'added_at' => '2026-09-20 09:00:00'],
], 'cartons' => [], 'warehouse_movements' => [
    ['id' => 1, 'type' => 'sale_out', 'product' => 'I90', 'serials' => ['TEST-B'], 'qty' => 1, 'from_warehouse_id' => 1, 'to_warehouse_id' => 0, 'created_at' => '2026-10-18 09:00:00'],
], 'next_warehouse_movement' => 2, 'products' => [['name' => 'I90', 'serial_required' => true]], 'users' => []];
$originalInventory = $state['inventory'];
$result = $ledger->repair($state);
verify($result['repaired'] === 2, 'repair should use original dates for current and exited external serials');
verify($state['inventory'] === $originalInventory, 'repair must not change physical stock or ownership');
verify($ledger->repair($state)['repaired'] === 0, 'history repair must be idempotent');
verify($state['warehouse_movements'][1]['created_at'] === '2026-10-15 09:00:00', 'receipt must retain insertion date');
$before = $ledger->serialKeys($state);
$state['inventory'][] = ['id' => 4, 'serial' => 'NEW-C', 'product' => 'I90', 'warehouse_id' => 1, 'order_id' => 7];
verify($ledger->reconcile($before, $state) === 1, 'new external allocation needs a receipt');
verify($ledger->reconcile($before, $state) === 0, 'a receipt must not be recorded twice');
$state['inventory'][] = ['id' => 5, 'serial' => 'OUTSIDE', 'product' => 'I90', 'warehouse_id' => 0, 'order_id' => 9];
verify($ledger->reconcile($before, $state) === 0, 'nonphysical outside rows must not enter stock');

$pdo = new WarehouseTestPdo();
$pdo->exec('CREATE TABLE ghadir_state (id INTEGER PRIMARY KEY,state_json TEXT NOT NULL)');
$policy = json_decode(file_get_contents(dirname(__DIR__) . '/config/warehouse-storage.yaml'), true);
$storage = new GpWarehouseStorage(new GpWarehouseRepository($pdo), $ledger, $policy);
$storage->prepareMigration();
$pdo->beginTransaction();
$core = $storage->migrate($state);
$pdo->prepare('INSERT INTO ghadir_state VALUES (1,?)')->execute([json_encode($core)]);
$pdo->commit();
verify(!isset($core['inventory']) && !isset($core['cartons']) && !isset($core['warehouse_movements']), 'warehouse payloads must leave core storage');
$restored = $core; $storage->hydrate($restored);
verify($restored == $state + ['warehouse_storage_version' => 1], 'migration must preserve every field and collection ordering');
$slim = $storage->readCore(static fn(array $value): bool => !isset($value['inventory']));
verify($slim === true, 'authentication must not load inventory');
$assigned = $storage->readCore(static fn(array $value): array => $value['inventory'], true);
verify(count($assigned) === 4, 'order bootstrap needs only assigned inventory');
$page = $storage->page(['warehouse_id' => 1], 1, 2);
verify($page['total'] === 3 && count($page['rows']) === 2 && $page['rows'][0]['serial'] === 'NEW-C', 'SQL pagination must filter and retain deterministic ordering');
try { $storage->page([], 0, 2); throw new RuntimeException('invalid page accepted'); } catch (InvalidArgumentException $expected) {}
$prior = $storage->snapshot($restored);
$changed = $restored; $changed['inventory'][0]['order_id'] = 11;
$pdo->beginTransaction(); $storage->persist($prior, $changed); $pdo->rollBack();
$readback = $core; $storage->hydrate($readback);
verify($readback['inventory'] === $restored['inventory'], 'failed order write must roll back serial ownership');
$pdo->beginTransaction();
$duplicate = $changed; $duplicate['inventory'][1]['serial'] = 'test-a';
try { $storage->persist($prior, $duplicate); throw new RuntimeException('duplicate accepted'); } catch (RuntimeException $error) { verify($error->getMessage() === 'invalid_or_duplicate_serial', 'duplicate serial must fail before writes'); }
$pdo->rollBack();
// Removing one record and reusing its serial must not overwrite another row through UPSERT.
$replace = $restored; array_shift($replace['inventory']); $replace['inventory'][] = ['id' => 6, 'serial' => 'TEST-A', 'product' => 'I90', 'warehouse_id' => 2];
$pdo->beginTransaction(); $storage->persist($prior, $replace); $pdo->commit();
$readback = $core; $storage->hydrate($readback);
verify($readback['inventory'] === $replace['inventory'], 'serial reuse must preserve independent record identity');
if (isset($argv[1])) file_put_contents($argv[1], implode(";\n", $pdo->mysqlSchemas) . ";\n");
echo "PASS: dated receipt repair, idempotency, exact migration, slim reads, pagination, duplicate rejection, rollback, serial reuse\n";
