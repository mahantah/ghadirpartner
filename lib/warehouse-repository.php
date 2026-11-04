<?php
declare(strict_types=1);

/** Persist warehouse collections as indexed rows inside the existing MySQL transaction. */
final class GpWarehouseRepository
{
    private PDO $pdo;
    private const TABLES = ['inventory' => 'ghadir_inventory_serials', 'cartons' => 'ghadir_inventory_cartons', 'warehouse_movements' => 'ghadir_inventory_movements'];

    /** Use the same connection and transaction as orders and customer credit. */
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }

    /** Create shadow tables before, never during, a data transaction. */
    public function createSchema(): void
    {
        foreach (self::TABLES as $table) {
            $this->pdo->exec("CREATE TABLE IF NOT EXISTS $table (
                record_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
                row_position BIGINT UNSIGNED NOT NULL,
                serial_key VARCHAR(191) COLLATE utf8mb4_bin NULL,
                product VARCHAR(191) NOT NULL DEFAULT '',
                warehouse_id INT NOT NULL DEFAULT 0,
                order_id BIGINT NOT NULL DEFAULT 0,
                order_number VARCHAR(191) NOT NULL DEFAULT '',
                carton_id BIGINT NOT NULL DEFAULT 0,
                record_json LONGTEXT NOT NULL,
                UNIQUE KEY serial_unique (serial_key),
                KEY warehouse_product (warehouse_id,product),
                KEY order_serial (order_id,serial_key),
                KEY carton_serial (carton_id,serial_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin");
        }
    }

    /** Read core and any dependent indexed rows from one consistent database snapshot.
     *
     * @param callable(array<string, mixed>): mixed $reader
     * @return mixed
     */
    public function core(callable $reader)
    {
        $owns = !$this->pdo->inTransaction();
        if ($owns) $this->pdo->beginTransaction();
        try {
            $raw = $this->pdo->query('SELECT state_json FROM ghadir_state WHERE id=1')->fetchColumn();
            if (!is_string($raw)) throw new RuntimeException('core_state_missing');
            $result = $reader($this->decode($raw));
            if ($owns) $this->pdo->commit();
            return $result;
        } catch (Throwable $error) {
            if ($owns && $this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $error;
        }
    }

    /** Block old workers from overwriting split state with freshly defaulted empty warehouse arrays. */
    public function installLegacyWriterGuard(): void
    {
        $existing = $this->pdo->query("SELECT ACTION_STATEMENT FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME='ghadir_warehouse_split_guard'")->fetchColumn();
        $body = "BEGIN IF JSON_UNQUOTE(JSON_EXTRACT(OLD.state_json,'$.warehouse_storage_version'))='1' AND (COALESCE(JSON_UNQUOTE(JSON_EXTRACT(NEW.state_json,'$.warehouse_storage_version')),'0')<>'1' OR JSON_CONTAINS_PATH(NEW.state_json,'one','$.inventory','$.cartons','$.warehouse_movements')) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='legacy_warehouse_writer_blocked'; END IF; END";
        if (is_string($existing)) {
            if (preg_replace('/\s+/', '', strtolower($existing)) !== preg_replace('/\s+/', '', strtolower($body))) throw new RuntimeException('warehouse_guard_definition_mismatch');
            return;
        }
        $this->pdo->exec('CREATE TRIGGER ghadir_warehouse_split_guard BEFORE UPDATE ON ghadir_state FOR EACH ROW ' . $body);
    }

    /**
     * @return list<array<string, mixed>> Read in original list order. */
    public function read(string $collection, bool $assignedOnly = false): array
    {
        $table = $this->table($collection);
        $where = $assignedOnly ? " WHERE order_id <> 0 OR order_number <> ''" : '';
        $rows = $this->pdo->query("SELECT record_json FROM $table$where ORDER BY row_position");
        $out = [];
        while ($raw = $rows->fetchColumn()) $out[] = $this->decode((string)$raw);
        return $out;
    }

    /**
     * @param list<array<string, mixed>> $before
     * @param list<array<string, mixed>> $after */
    public function sync(string $collection, array $before, array $after): void
    {
        if (!$this->pdo->inTransaction()) throw new RuntimeException('warehouse_transaction_required');
        $table = $this->table($collection);
        $old = $this->index($before);
        $new = $this->index($after);
        $delete = $this->pdo->prepare("DELETE FROM $table WHERE record_id=?");
        // Delete removed keys before inserting a replacement that reuses a serial.
        foreach ($old as $id => $entry) {
            if (!isset($new[$id]) || $new[$id]['json'] !== $entry['json'] || $new[$id]['position'] !== $entry['position']) $delete->execute([$id]);
        }
        $upsert = $this->pdo->prepare("INSERT INTO $table (record_id,row_position,serial_key,product,warehouse_id,order_id,order_number,carton_id,record_json)
            VALUES (?,?,?,?,?,?,?,?,?)");
        foreach ($new as $id => $entry) {
            if (isset($old[$id]) && $old[$id]['json'] === $entry['json'] && $old[$id]['position'] === $entry['position']) continue;
            $row = $entry['row'];
            $serial = $collection === 'inventory' ? strtoupper(trim((string)($row['serial'] ?? ''))) : null;
            if ($serial === '') throw new RuntimeException('empty_inventory_serial');
            $upsert->execute([$id, $entry['position'], $serial, (string)($row['product'] ?? ''), (int)($row['warehouse_id'] ?? 0), (int)($row['order_id'] ?? 0), (string)($row['order_number'] ?? ''), (int)($row['carton_id'] ?? 0), $entry['json']]);
        }
    }

    /**
     * @param array<string, mixed> $filters
     * @return array{rows:list<array<string, mixed>>,total:int} */
    public function page(array $filters, int $limit, int $offset): array
    {
        $clauses = []; $params = [];
        foreach (['product', 'warehouse_id', 'order_id', 'carton_id'] as $key) {
            if (!array_key_exists($key, $filters)) continue;
            $clauses[] = "$key = ?"; $params[] = $filters[$key];
        }
        if (isset($filters['serial'])) { $clauses[] = 'serial_key = ?'; $params[] = strtoupper(trim((string)$filters['serial'])); }
        $where = $clauses ? ' WHERE ' . implode(' AND ', $clauses) : '';
        $total = $this->pdo->prepare('SELECT COUNT(*) FROM ghadir_inventory_serials' . $where);
        $total->execute($params);
        $query = $this->pdo->prepare('SELECT record_json FROM ghadir_inventory_serials' . $where . ' ORDER BY row_position DESC LIMIT ' . $limit . ' OFFSET ' . $offset);
        $query->execute($params);
        $rows = [];
        while ($raw = $query->fetchColumn()) $rows[] = $this->decode((string)$raw);
        return ['rows' => $rows, 'total' => (int)$total->fetchColumn()];
    }

    /**
     * @return list<array<string, mixed>> Calculate current balances without loading serial payloads. */
    public function summary(): array
    {
        return $this->pdo->query('SELECT warehouse_id,product,COUNT(*) qty,SUM(CASE WHEN order_id>0 THEN 1 ELSE 0 END) reserved FROM ghadir_inventory_serials WHERE warehouse_id>0 GROUP BY warehouse_id,product')->fetchAll();
    }

    /**
     * @return list<array<string, mixed>> Count ownership without decoding serial payloads.
     */
    public function ownershipCounts(): array
    {
        return $this->pdo->query('SELECT order_id,order_number,COUNT(*) qty,MIN(row_position) first_position FROM ghadir_inventory_serials GROUP BY order_id,order_number ORDER BY first_position')->fetchAll();
    }

    /**
     * @param array<int,string> $metadataMatches Legacy search text for known order IDs.
     * @return array{sql:string,params:list<int|string>} Build parameterized legacy substring search.
     */
    private function searchWhere(string $query, string $filter, ?int $orderId, array $metadataMatches, bool $mobile): array
    {
        $clauses = []; $params = [];
        if ($filter === 'free') $clauses[] = 'order_id=0';
        if ($filter === 'assigned') $clauses[] = 'order_id<>0';
        if ($orderId !== null) { $clauses[] = $orderId === 0 ? 'order_id<=0' : 'order_id=?'; if ($orderId !== 0) $params[] = $orderId; }
        if ($query !== '') {
            $columns = $mobile ? ['product','serial','carton_code','order_number'] : ['product','serial','imei','order_number','supplier'];
            $expressions = [];
            foreach ($columns as $column) $expressions[] = "CASE WHEN UPPER(JSON_TYPE(JSON_EXTRACT(record_json,'$." . $column . "')))='NULL' THEN '' ELSE COALESCE(JSON_UNQUOTE(JSON_EXTRACT(record_json,'$." . $column . "')),'') END";
            $needle = '%' . strtr($query, ['!' => '!!', '%' => '!%', '_' => '!_']) . '%';
            $parts = [];
            if ($mobile) {
                foreach ($expressions as $expression) { $parts[] = "LOWER($expression) LIKE ? ESCAPE '!'"; $params[] = $needle; }
            } else {
                $metadata = 'CASE';
                foreach ($metadataMatches as $id => $text) { $metadata .= ' WHEN order_id=? THEN ?'; $params[] = $id; $params[] = $text; }
                // Orphan labels depend on the row's original order number, not current order metadata.
                $fallback = "CONCAT('سفارش ',order_number,'    ',order_number)";
                $metadata = $metadataMatches ? $metadata . ' ELSE ' . $fallback . ' END' : $fallback;
                $expressions[] = $metadata;
                $parts[] = "LOWER(CONCAT_WS(' '," . implode(',', $expressions) . ")) LIKE ? ESCAPE '!'";
                $params[] = $needle;
            }
            $clauses[] = '(' . implode(' OR ', $parts) . ')';
        }
        return ['sql' => $clauses ? ' WHERE ' . implode(' AND ', $clauses) : '', 'params' => $params];
    }

    /**
     * @param array<int,string> $metadataMatches
     * @return list<array<string, mixed>> Aggregate matched groups without materializing serials.
     */
    public function matchedCounts(string $query, string $filter, array $metadataMatches): array
    {
        $where = $this->searchWhere($query, $filter, null, $metadataMatches, false);
        $statement = $this->pdo->prepare('SELECT order_id,order_number,COUNT(*) qty,MIN(row_position) first_position FROM ghadir_inventory_serials' . $where['sql'] . ' GROUP BY order_id,order_number ORDER BY first_position');
        $statement->execute($where['params']);
        return $statement->fetchAll();
    }

    /**
     * @param array<int,string> $metadataMatches
     * @return array{rows:list<array<string,mixed>>,total:int}
     */
    public function groupPage(string $query, string $filter, ?int $orderId, array $metadataMatches, int $offset, int $limit, bool $mobile = false): array
    {
        $where = $this->searchWhere($query, $filter, $orderId, $metadataMatches, $mobile);
        $count = $this->pdo->prepare('SELECT COUNT(*) FROM ghadir_inventory_serials' . $where['sql']);
        $count->execute($where['params']);
        $statement = $this->pdo->prepare('SELECT record_json FROM ghadir_inventory_serials' . $where['sql'] . ' ORDER BY row_position DESC LIMIT ' . $limit . ' OFFSET ' . $offset);
        $statement->execute($where['params']);
        $rows = [];
        while ($raw = $statement->fetchColumn()) $rows[] = $this->decode((string)$raw);
        return ['rows' => $rows, 'total' => (int)$count->fetchColumn()];
    }

    /**
     * @return list<array<string,mixed>> Project only dimensions needed by carton and shelf counters.
     */
    public function cartonCounts(): array
    {
        return $this->pdo->query("SELECT carton_id,COALESCE(JSON_UNQUOTE(JSON_EXTRACT(record_json,'$.carton_code')),'') carton_code,COALESCE(JSON_EXTRACT(record_json,'$.shelf_level'),0) shelf_level,product,CASE WHEN order_id=0 THEN 1 ELSE 0 END is_free,COUNT(*) qty FROM ghadir_inventory_serials GROUP BY carton_id,carton_code,shelf_level,product,is_free")->fetchAll();
    }

    /** Validate only known table names, never interpolate request input. */
    private function table(string $collection): string
    {
        if (!isset(self::TABLES[$collection])) throw new RuntimeException('unknown_warehouse_collection');
        return self::TABLES[$collection];
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, array{row:array<string, mixed>,json:string,position:int}> */
    private function index(array $rows): array
    {
        $out = []; $serials = [];
        foreach (array_values($rows) as $position => $row) {
            $id = (int)($row['id'] ?? 0);
            if ($id < 1 || isset($out[$id])) throw new RuntimeException('invalid_or_duplicate_warehouse_id');
            if (isset($row['serial'])) {
                $serial = strtoupper(trim((string)$row['serial']));
                if (strlen($serial) > 191 || isset($serials[$serial])) throw new RuntimeException('invalid_or_duplicate_serial');
                $serials[$serial] = true;
            }
            if (strlen((string)($row['product'] ?? '')) > 191) throw new RuntimeException('product_index_too_long');
            $out[$id] = ['row' => $row, 'json' => self::encode($row), 'position' => $position];
        }
        return $out;
    }

    /**
     * @param array<mixed> $value Encode the original fields without a lossy schema conversion. */
    public static function encode(array $value): string
    {
        $json = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        if (!is_string($json)) throw new RuntimeException('warehouse_json_encode_failed');
        return $json;
    }

    /**
     * @return array<string, mixed> Reject invalid payloads rather than silently dropping records. */
    private function decode(string $json): array
    {
        $row = json_decode($json, true);
        if (!is_array($row)) throw new RuntimeException('invalid_warehouse_record');
        return $row;
    }
}
