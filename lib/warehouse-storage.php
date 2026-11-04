<?php
declare(strict_types=1);
require_once __DIR__ . '/warehouse-repository.php';
require_once __DIR__ . '/warehouse-ledger-integrity.php';

/** Single facade for legacy callbacks, indexed inventory and safe warehouse migration. */
final class GpWarehouseStorage
{
    private GpWarehouseRepository $repository;
    private GpWarehouseLedgerIntegrity $ledger;
    /**
     * @var array<string, mixed> */
    private array $policy;
    private const COLLECTIONS = ['inventory', 'cartons', 'warehouse_movements'];

    /**
     * @param array<string, mixed> $policy Inject I/O and validated deployment policy. */
    public function __construct(GpWarehouseRepository $repository, GpWarehouseLedgerIntegrity $ledger, array $policy)
    {
        if (($policy['version'] ?? 0) !== 1 || !is_int($policy['page_size'] ?? null) || !is_int($policy['max_page_size'] ?? null) || $policy['page_size'] < 1 || $policy['max_page_size'] < $policy['page_size'] || !is_array($policy['core_read_paths'] ?? null)) throw new RuntimeException('invalid_warehouse_storage_policy');
        $this->repository = $repository; $this->ledger = $ledger; $this->policy = $policy;
    }

    /** Create the facade using the existing authenticated database connection. */
    public static function create(PDO $pdo): self
    {
        static $policy = null;
        if ($policy === null) {
            $raw = file_get_contents(dirname(__DIR__) . '/config/warehouse-storage.yaml');
            $policy = $raw === false ? null : json_decode($raw, true);
            if (!is_array($policy)) throw new RuntimeException('warehouse_storage_policy_missing');
        }
        return new self(new GpWarehouseRepository($pdo), new GpWarehouseLedgerIntegrity(), $policy);
    }

    /** Read authentication and lightweight APIs without loading warehouse collections.
     *
     * @param callable(array<string, mixed>): mixed $reader
     * @return mixed
     */
    public function readCore(callable $reader, bool $orders = false)
    {
        return $this->repository->core(function (array $state) use ($reader, $orders) {
            if (!$this->isSplit($state)) ghadir_state_prepare($state);
            elseif (function_exists('normalize_state_users')) normalize_state_users($state);
            if ($orders) $this->hydrateOrderInventory($state);
            if (isset($state['products']) && is_array($state['products'])) $GLOBALS['PRODUCTS'] = $state['products'];
            return $reader($state);
        });
    }

    /** Configured default number of serials for the opt-in paginated API. */
    public function defaultPageSize(): int { return $this->policy['page_size']; }

    /**
     * @param array<string, mixed> $state
     * @return array<string, mixed> */
    public function ledgerData(array $state): array
    {
        $current = []; $free = []; $reserved = [];
        foreach ($this->repository->summary() as $row) {
            $warehouse = (int)$row['warehouse_id']; $product = (string)$row['product'];
            $current[$warehouse][$product] = (int)$row['qty'];
            $reserved[$warehouse][$product] = (int)$row['reserved'];
            $free[$warehouse][$product] = (int)$row['qty'] - (int)$row['reserved'];
        }
        $movements = $this->repository->read('warehouse_movements');
        foreach ($movements as &$movement) unset($movement['serials']);
        unset($movement);
        return ['warehouses' => $state['warehouses'] ?? [], 'activated_at' => $state['warehouse_activated_at'] ?? '', 'baseline' => $state['warehouse_baseline'] ?? [], 'movements' => $movements, 'current' => $current, 'free' => $free, 'reserved' => $reserved, 'products' => array_values(array_filter($state['products'] ?? [], static fn(array $product): bool => !empty($product['serial_required'])))];
    }

    /**
     * @param array<string, mixed> $state */
    public function isSplit(array $state): bool { return ($state['warehouse_storage_version'] ?? 0) === 1; }

    /**
     * @param array<string, mixed> $state Hydrate only after the atomic migration marker exists. */
    public function hydrate(array &$state): void
    {
        if (!$this->isSplit($state)) return;
        foreach (self::COLLECTIONS as $collection) $state[$collection] = $this->repository->read($collection);
    }

    /**
     * @param array<string, mixed> $state
     * @return array<string, mixed> Capture a copy-on-write transaction snapshot. */
    public function snapshot(array $state): array
    {
        $copy = [];
        foreach (self::COLLECTIONS as $collection) $copy[$collection] = $state[$collection] ?? [];
        return $copy;
    }

    /**
     * @param array<string, mixed> $before
     * @param array<string, mixed> $after Pair all new physical rows with receipts. */
    public function reconcile(array $before, array &$after): int
    {
        return $this->ledger->reconcile($this->ledger->serialKeys($before), $after);
    }

    /**
     * @param array<string, mixed> $before
     * @param array<string, mixed> $after
     * @return array<string, mixed> */
    public function persist(array $before, array $after): array
    {
        if (!$this->isSplit($after)) return $after;
        foreach (self::COLLECTIONS as $collection) $this->repository->sync($collection, $before[$collection] ?? [], $after[$collection] ?? []);
        foreach (self::COLLECTIONS as $collection) unset($after[$collection]);
        return $after;
    }

    /** Create empty indexed tables before starting the migration transaction. */
    public function prepareMigration(): void { $this->repository->createSchema(); $this->repository->installLegacyWriterGuard(); }

    /**
     * @param array<string, mixed> $state
     * @return array{repaired:int,skipped:int} */
    public function repairHistory(array &$state): array { return $this->ledger->repair($state); }

    /**
     * @param array<string, mixed> $state
     * @return array<string, mixed> Prove an exact round trip before committing the split. */
    public function migrate(array $state): array
    {
        if ($this->isSplit($state)) throw new RuntimeException('warehouse_already_split');
        foreach (self::COLLECTIONS as $collection) {
            if ($this->repository->read($collection)) throw new RuntimeException('warehouse_shadow_tables_not_empty');
            $rows = $state[$collection] ?? [];
            $this->repository->sync($collection, [], $rows);
            if (GpWarehouseRepository::encode($this->repository->read($collection)) !== GpWarehouseRepository::encode($rows)) throw new RuntimeException('warehouse_roundtrip_mismatch');
        }
        $state['warehouse_storage_version'] = 1;
        foreach (self::COLLECTIONS as $collection) unset($state[$collection]);
        return $state;
    }

    /**
     * @param array<string, mixed> $state Return only inventory attached to orders for existing order decorators. */
    public function hydrateOrderInventory(array &$state): void
    {
        if ($this->isSplit($state)) $state['inventory'] = $this->repository->read('inventory', true);
    }

    /** Whether an explicitly audited read endpoint needs no warehouse collections. */
    public function isCorePath(string $path): bool { return in_array($path, $this->policy['core_read_paths'], true); }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed> */
    public function page(array $filters, int $page, int $limit): array
    {
        if ($page < 1 || $limit < 1 || $limit > $this->policy['max_page_size'] || $page > intdiv(PHP_INT_MAX, $limit)) throw new InvalidArgumentException('invalid_inventory_page');
        return $this->repository->page($filters, $limit, ($page - 1) * $limit) + ['page' => $page, 'limit' => $limit];
    }

}

/**
     * @param callable(array<string, mixed>): mixed $reader
     * @return mixed Read only core state. */
function gp_core_db(callable $reader)
{
    return GpWarehouseStorage::create(ghadir_mysql_pdo())->readCore($reader);
}

/**
     * @param callable(array<string, mixed>): mixed $reader
     * @return mixed Read assigned serials for order decorators. */
function gp_order_read(callable $reader)
{
    return GpWarehouseStorage::create(ghadir_mysql_pdo())->readCore($reader, true);
}

/**
     * @param callable(array<string, mixed>): mixed $reader
     * @return mixed Route audited lightweight reads. */
function gp_read_db(callable $reader)
{
    $storage = GpWarehouseStorage::create(ghadir_mysql_pdo());
    $path = (string)(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET' && $storage->isCorePath($path)) return $storage->readCore($reader);
    return ghadir_db(false, $reader);
}
