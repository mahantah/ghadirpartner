<?php
/** Restore missing serial-only exit evidence from delivered orders; never infer dates. */
require_once __DIR__.'/preswitch-carton-integrity.php';

final class LegacyExitMetadata
{
    /** @var list<string> Explicit protected cartons for this reconciliation. */
    private array $codes;
    /**
     * Validate the finite set of protected carton codes before inspecting state.
     * @param list<string> $codes Explicitly authorized protected cartons.
     */
    public function __construct(array $codes)
    {
        $this->codes = $codes;
        if (!$codes || count(array_unique($codes)) !== count($codes)) throw new RuntimeException('invalid_target_codes');
        foreach ($codes as $code) if (!preg_match('/^I90-\d{3}$/D', $code)) throw new RuntimeException('invalid_target_codes');
    }

    /**
     * Add only missing exit_items for fully delivered and physically exited orders.
     * @param array<string,mixed> $source Original state, left unchanged.
     * @return array{state:array<string,mixed>,changed:bool,units:int,orders:int}
     */
    public function reconcile(array $source): array
    {
        $next = $source;
        $orderIds = [];
        foreach ($this->codes as $code) {
            $report = gp_preswitch_allocated_carton_integrity($source, $code);
            if ($report['ok']) continue;
            if ($report['kind'] !== 'exit_without_shipment' || $report['actual'] !== $report['expected'] || $report['free'] !== 0 || $report['allocated'] !== $report['actual']) throw new RuntimeException('unexpected_carton_state');
            $cid = 0;
            foreach ($source['cartons'] as $carton) if (gp_integrity_key($carton['code'] ?? '') === $code) $cid = (int)$carton['id'];
            foreach ($source['inventory'] as $row) {
                if ((int)($row['carton_id'] ?? 0) !== $cid && gp_integrity_key($row['carton_code'] ?? '') !== $code) continue;
                $oid = (int)($row['order_id'] ?? 0);
                if ($oid < 1 || (int)($row['warehouse_id'] ?? -1) !== 0) throw new RuntimeException('invalid_exited_rows');
                $orderIds[$oid] = true;
            }
        }
        $units = 0;
        $changedOrders = 0;
        $required = [];
        foreach ($source['orders'] ?? [] as $order) {
            if (!isset($orderIds[(int)($order['id'] ?? 0)])) continue;
            foreach ($order['items'] ?? [] as $item) foreach ($item['serials'] ?? [] as $serial) $required[gp_integrity_key($serial)] = true;
        }
        $inventory = [];
        // Index only relevant serials while still detecting duplicates anywhere in inventory.
        foreach ($source['inventory'] ?? [] as $row) {
            $key = gp_integrity_key($row['serial'] ?? '');
            if (isset($required[$key])) $inventory[$key][] = $row;
        }
        foreach (array_keys($orderIds) as $oid) {
            $indexes = [];
            foreach ($source['orders'] ?? [] as $index => $order) if ((int)($order['id'] ?? 0) === $oid) $indexes[] = $index;
            if (count($indexes) !== 1) throw new RuntimeException('order_missing_or_duplicate');
            $index = $indexes[0];
            $order = $source['orders'][$index];
            if (($order['status'] ?? '') !== 'تحویل شد' || !empty($order['deleted']) || !empty($order['partial_exit'])) throw new RuntimeException('not_missing_complete_legacy_exit');
            $items = [];
            $matched = [];
            $products = [];
            foreach ($order['items'] ?? [] as $item) {
                $serials = $item['serials'] ?? [];
                if (!$serials) continue;
                if (count($serials) !== (int)($item['qty'] ?? 0)) throw new RuntimeException('incomplete_order_serials');
                foreach ($serials as $serial) {
                    $key = gp_integrity_key($serial);
                    $rows = $inventory[$key] ?? [];
                    if ($key === '' || isset($matched[$key]) || count($rows) !== 1) throw new RuntimeException('duplicate_or_missing_serial');
                    $row = $rows[0];
                    if ((int)($row['order_id'] ?? 0) !== $oid || (int)($row['warehouse_id'] ?? -1) !== 0 || gp_integrity_product($row['product'] ?? '') !== gp_integrity_product($item['product'] ?? '')) throw new RuntimeException('serial_not_exited_for_order');
                    if (!empty($row['order_number']) && (string)$row['order_number'] !== (string)($order['number'] ?? '')) throw new RuntimeException('allocation_number_mismatch');
                    $matched[$key] = true;
                    $products[$key] = gp_integrity_product($item['product'] ?? '');
                }
                $items[] = ['product'=>$item['product'],'qty'=>count($serials),'serials'=>$serials];
            }
            foreach ($source['inventory'] as $row) {
                if ((int)($row['order_id'] ?? 0) === $oid && (!isset($matched[gp_integrity_key($row['serial'] ?? '')]) || (int)($row['warehouse_id'] ?? -1) !== 0)) throw new RuntimeException('unmatched_order_allocation');
            }
            if (!$matched) throw new RuntimeException('no_verified_exit_serials');
            $recorded = [];
            foreach ($order['exit_items'] ?? [] as $item) {
                $serials = $item['serials'] ?? [];
                if (!$serials || count($serials) !== (int)($item['qty'] ?? 0)) throw new RuntimeException('invalid_existing_exit_metadata');
                foreach ($serials as $serial) {
                    $key = gp_integrity_key($serial);
                    if (!isset($matched[$key]) || isset($recorded[$key]) || $products[$key] !== gp_integrity_product($item['product'] ?? '')) throw new RuntimeException('invalid_existing_exit_metadata');
                    $recorded[$key] = true;
                }
            }
            $missing = [];
            $added = 0;
            foreach ($items as $item) {
                $serials = array_values(array_filter($item['serials'], static function($serial) use ($recorded): bool {
                    return !isset($recorded[gp_integrity_key($serial)]);
                }));
                if (!$serials) continue;
                $missing[] = ['product'=>$item['product'],'qty'=>count($serials),'serials'=>$serials];
                $added += count($serials);
            }
            if (!$added) continue;
            $changedOrders++;
            $next['orders'][$index]['exit_items'] = array_merge($order['exit_items'] ?? [], $missing);
            $units += $added;
            $next['inventory_reconciliations'][] = ['event'=>'legacy_delivered_exit_metadata_reconciled',
                'at'=>date('Y-m-d H:i:s'),'order_id'=>$oid,'units'=>$added,
                'inventory_unchanged'=>true,'dispatch_date_known'=>false,
                'evidence'=>'delivered_order_and_exact_outside_inventory_serials',
                'serial_set_hash'=>hash('sha256', implode("\n", array_keys($matched)))];
        }
        foreach ($this->codes as $code) if (!gp_preswitch_allocated_carton_integrity($next, $code)['ok']) throw new RuntimeException('post_reconciliation_integrity_failed');
        return ['state'=>$next,'changed'=>$changedOrders > 0,'units'=>$units,'orders'=>$changedOrders];
    }
}
