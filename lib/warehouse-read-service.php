<?php
declare(strict_types=1);

/** Keep existing grouping semantics while delegating bounded reads to indexed storage. */
final class GpWarehouseReadService
{
    /** Share the facade's transaction-bound repository. */
    public function __construct(private GpWarehouseRepository $repository) {}

    /**
     * @param array<string,mixed> $state
     * @param array<string,mixed> $row
     * @return array<string,mixed> Preserve customer and orphan-order labels.
     */
    private function metadata(array $state, array $row): array
    {
        $id = (int)$row['order_id'];
        if ($id <= 0) return ['key'=>'free','order_id'=>0,'name'=>'سریال‌های آزاد','company'=>'','code'=>'','mobile'=>'','order_number'=>''];
        $order = $state['orders_by_id'][$id] ?? null;
        if ($order === null) return ['key'=>'unknown-'.$id,'order_id'=>$id,'name'=>'سفارش '.((string)($row['order_number'] ?? $id)),'company'=>'','code'=>'','mobile'=>'','order_number'=>(string)($row['order_number'] ?? '')];
        $customer = $state['customers_by_id'][(int)($order['customer_id'] ?? 0)] ?? [];
        return ['key'=>'o-'.$id,'order_id'=>$id,'name'=>trim((string)($customer['name'] ?? $order['customer_name'] ?? 'بدون نام')).' — فاکتور '.((string)($order['number'] ?? $id)), 'company'=>(string)($customer['company'] ?? ''),'code'=>(string)($customer['code'] ?? ''),'mobile'=>(string)($customer['mobile'] ?? ''),'order_number'=>(string)($order['number'] ?? $row['order_number'] ?? '')];
    }

    /**
     * @param array<string,mixed> $state
     * @return array<string,mixed> Index core records once per request.
     */
    private function maps(array $state): array
    {
        $state['orders_by_id'] = []; $state['customers_by_id'] = [];
        foreach ($state['orders'] ?? [] as $row) $state['orders_by_id'][(int)$row['id']] = $row;
        foreach ($state['customers'] ?? [] as $row) $state['customers_by_id'][(int)$row['id']] = $row;
        return $state;
    }

    /**
     * @param array<string,mixed> $state
     * @param list<array<string,mixed>> $counts
     * @return array<int,string> Preserve the full legacy concatenated metadata search text.
     */
    private function searchMetadata(array $state, array $counts, string $query): array
    {
        if ($query === '') return [];
        $texts = [];
        foreach ($counts as $row) {
            $id = (int)$row['order_id'];
            if ($id > 0 && !isset($state['orders_by_id'][$id])) continue;
            $meta = $this->metadata($state, $row);
            $texts[$id] = implode(' ', [$meta['name'], $meta['company'], $meta['code'], $meta['mobile'], $meta['order_number']]);
        }
        return $texts;
    }

    /**
     * @param array<string,mixed> $state
     * @return array<string,mixed> Return counters and sorted groups without serial payloads.
     */
    public function overview(array $state, string $query, string $filter): array
    {
        $state = $this->maps($state); $all = $this->repository->ownershipCounts();
        $free = 0; $assigned = 0;
        foreach ($all as $row) { if ((int)$row['order_id'] === 0) $free += (int)$row['qty']; else $assigned += (int)$row['qty']; }
        $counts = $query === '' && $filter === 'all' ? $all : $this->repository->matchedCounts($query, $filter, $this->searchMetadata($state, $all, $query));
        $groups = []; $matched = 0;
        foreach ($counts as $row) {
            $meta = $this->metadata($state, $row); $key = $meta['key'];
            if (!isset($groups[$key])) $groups[$key] = $meta + ['count'=>0];
            $groups[$key]['count'] += (int)$row['qty']; $matched += (int)$row['qty'];
        }
        $groups = array_values($groups);
        usort($groups, static function (array $a, array $b): int {
            if ($a['key'] === 'free') return -1;
            if ($b['key'] === 'free') return 1;
            return strnatcasecmp($a['name'], $b['name']);
        });
        return ['groups'=>$groups,'total'=>$free+$assigned,'free'=>$free,'assigned'=>$assigned,'matched'=>$matched,'query'=>$query,'filter'=>$filter];
    }

    /**
     * @param array<string,mixed> $state
     * @return array<string,mixed> Read the requested group's page including orphan groups.
     */
    public function group(array $state, string $key, string $query, string $filter, int $offset, int $limit): array
    {
        $state = $this->maps($state); $id = null; $valid = false;
        if ($key === 'free') { $id = 0; $valid = true; }
        elseif (preg_match('/^(o|unknown)-([1-9][0-9]*)$/D', $key, $match)) {
            $id = (int)$match[2];
            $valid = ($match[1] === 'o') === isset($state['orders_by_id'][$id]);
        }
        $page = $valid ? $this->repository->groupPage($query, $filter, $id, $this->searchMetadata($state, $this->repository->ownershipCounts(), $query), $offset, $limit) : ['rows'=>[],'total'=>0];
        return $page + ['offset'=>$offset,'limit'=>$limit,'has_more'=>$offset+count($page['rows'])<$page['total']];
    }

    /**
     * @return array<string,mixed> Provide global counters and bounded mobile substring search.
     */
    public function mobilePage(string $query, int $page, int $limit): array
    {
        $free = 0; $assigned = 0;
        foreach ($this->repository->ownershipCounts() as $row) { if ((int)$row['order_id'] === 0) $free += (int)$row['qty']; else $assigned += (int)$row['qty']; }
        return $this->repository->groupPage($query, 'all', null, [], ($page-1)*$limit, $limit, true) + ['free'=>$free,'assigned'=>$assigned,'page'=>$page,'limit'=>$limit];
    }

    /**
     * @return array<string,mixed> Keep carton serial lists for search and labels without duplicate payloads.
     */
    public function compact(): array
    {
        $cartons = $this->repository->read('cartons'); $stats = []; $byCode = [];
        foreach ($cartons as $carton) {
            $id = (int)$carton['id']; $stats[$id] = ['id'=>$id,'total'=>0,'free'=>0,'levels'=>[]];
            if (!empty($carton['code'])) $byCode[(string)$carton['code']] = $id;
        }
        $shelves = [];
        for ($level=1; $level<=5; $level++) $shelves[$level] = ['n'=>0,'by'=>[]];
        foreach ($this->repository->cartonCounts() as $row) {
            $level = (int)$row['shelf_level']; $qty = (int)$row['qty']; $free = (int)$row['is_free'] === 1;
            if ($free && isset($shelves[$level])) { $shelves[$level]['n'] += $qty; $product=(string)$row['product']; $shelves[$level]['by'][$product]=($shelves[$level]['by'][$product]??0)+$qty; }
            $id = (int)$row['carton_id'];
            if (!isset($stats[$id])) $id = $byCode[(string)$row['carton_code']] ?? 0;
            if (!isset($stats[$id])) continue;
            $stats[$id]['total'] += $qty;
            if ($free) { $stats[$id]['free'] += $qty; if ($level !== 0 && !in_array($level,$stats[$id]['levels'],true)) $stats[$id]['levels'][]=$level; }
        }
        return ['cartons'=>$cartons,'inventory'=>[],'carton_stats'=>array_values($stats),'shelves'=>$shelves,'connected'=>true];
    }
}
