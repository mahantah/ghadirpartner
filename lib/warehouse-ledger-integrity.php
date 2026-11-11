<?php
declare(strict_types=1);

/** Keep physical receipts paired with inventory insertions and their original dates. */
final class GpWarehouseLedgerIntegrity
{
    /**
     * @param array<string, mixed> $state
     * @return array<string, bool> */
    private function receiptKeys(array $state): array
    {
        $keys = [];
        foreach ($state['warehouse_movements'] ?? [] as $movement) {
            if (($movement['type'] ?? '') !== 'receipt') continue;
            foreach ($movement['serials'] ?? [] as $serial) {
                $keys[strtoupper(trim((string)$serial))] = true;
            }
        }
        return $keys;
    }

    /**
     * @param array<string, mixed> $state
     * @return array<string, bool> */
    public function serialKeys(array $state): array
    {
        $keys = [];
        foreach ($state['inventory'] ?? [] as $row) $keys[strtoupper(trim((string)($row['serial'] ?? '')))] = true;
        return $keys;
    }

    /** Record missing receipts only for new physical rows in this transaction.
     *
     * @param array<string, bool> $before
     * @param array<string, mixed> $state
     */
    public function reconcile(array $before, array &$state): int
    {
        $receipts = $this->receiptKeys($state);
        $groups = [];
        foreach ($state['inventory'] ?? [] as $row) {
            $key = strtoupper(trim((string)($row['serial'] ?? '')));
            $warehouse = (int)($row['warehouse_id'] ?? 0);
            if ($key === '' || isset($before[$key]) || isset($receipts[$key]) || $warehouse < 1) continue;
            $product = (string)($row['product'] ?? '');
            $groupKey = $warehouse . '|' . $product;
            if (!isset($groups[$groupKey])) $groups[$groupKey] = ['product' => $product, 'warehouse' => $warehouse, 'serials' => []];
            $groups[$groupKey]['serials'][] = (string)$row['serial'];
        }
        $count = 0;
        foreach ($groups as $group) {
            ghadir_warehouse_record($state, 'receipt', $group['product'], $group['serials'], 0, $group['warehouse'], 'warehouse-integrity', 0, '', 'ثبت ورود سریال جدید همزمان با تخصیص یا ورود فایل');
            $count += count($group['serials']);
        }
        return $count;
    }

    /** Repair only post-activation non-carton receipts supported by a valid insertion timestamp.
     * Existing serial rows, ownership, quantities and existing movements stay unchanged.
     *
     * @param array<string, mixed> $state
     * @return array{repaired:int, skipped:int}
     */
    public function repair(array &$state): array
    {
        $activated = (string)($state['warehouse_activated_at'] ?? '');
        if (!$this->validDate($activated)) throw new RuntimeException('warehouse_activation_date_missing');
        $receipts = $this->receiptKeys($state);
        $initialWarehouse = [];
        foreach ($state['warehouse_movements'] ?? [] as $movement) {
            if ((int)($movement['from_warehouse_id'] ?? 0) < 1) continue;
            foreach ($movement['serials'] ?? [] as $serial) {
                $key = strtoupper(trim((string)$serial));
                $date = (string)($movement['created_at'] ?? '');
                if (!isset($initialWarehouse[$key]) || strcmp($date, $initialWarehouse[$key]['at']) < 0) {
                    $initialWarehouse[$key] = ['warehouse' => (int)$movement['from_warehouse_id'], 'at' => $date];
                }
            }
        }
        $groups = [];
        $skipped = 0;
        foreach ($state['inventory'] ?? [] as $row) {
            $key = strtoupper(trim((string)($row['serial'] ?? '')));
            if ($key === '' || isset($receipts[$key]) || (int)($row['carton_id'] ?? 0) > 0 || (int)($row['detached_from_carton_id'] ?? 0) > 0) continue;
            $date = (string)($row['added_at'] ?? '');
            if (!$this->validDate($date) || strcmp($date, $activated) <= 0 || strcmp($date, date('Y-m-d H:i:s')) > 0) { $skipped++; continue; }
            $warehouse = (int)($initialWarehouse[$key]['warehouse'] ?? $row['warehouse_id'] ?? 0);
            if ($warehouse < 1 || (isset($initialWarehouse[$key]) && strcmp($date, $initialWarehouse[$key]['at']) > 0)) { $skipped++; continue; }
            $product = (string)($row['product'] ?? '');
            if ($product === '') { $skipped++; continue; }
            $groupKey = $warehouse . '|' . $date . '|' . $product;
            if (!isset($groups[$groupKey])) $groups[$groupKey] = ['product' => $product, 'warehouse' => $warehouse, 'at' => $date, 'serials' => []];
            $groups[$groupKey]['serials'][] = (string)$row['serial'];
        }
        $count = 0;
        foreach ($groups as $group) {
            $movement = ghadir_warehouse_record($state, 'receipt', $group['product'], $group['serials'], 0, $group['warehouse'], 'warehouse-integrity-repair', 0, '', 'بازسازی ورود ثبت‌نشده بر اساس تاریخ اصلی ثبت سریال');
            $last = count($state['warehouse_movements']) - 1;
            if ((int)$state['warehouse_movements'][$last]['id'] !== (int)$movement['id']) throw new RuntimeException('receipt_append_mismatch');
            $state['warehouse_movements'][$last]['created_at'] = $group['at'];
            $state['warehouse_movements'][$last]['reconstructed_at'] = date('Y-m-d H:i:s');
            $count += count($group['serials']);
        }
        return ['repaired' => $count, 'skipped' => $skipped];
    }

    /** Validate timestamps before they can affect historical balances. */
    private function validDate(string $date): bool
    {
        $parsed = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $date);
        return $parsed !== false && $parsed->format('Y-m-d H:i:s') === $date;
    }
}
