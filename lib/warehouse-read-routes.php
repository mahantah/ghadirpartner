<?php
declare(strict_types=1);

if (!isset($p, $m)) return;

/* Existing clients retain the overview/group response contract. */
if (in_array($p, ['/api/inventory/overview', '/api/inventory/group', '/api/warehouse/compact'], true) && $m === 'GET') {
    auth();
    $result = gp_core_db(function (array $state) use ($p): ?array {
        $storage = GpWarehouseStorage::create(ghadir_mysql_pdo());
        if (!$storage->isSplit($state)) return null;
        $query = mb_strtolower(trim((string)($_GET['q'] ?? '')), 'UTF-8');
        $filter = (string)($_GET['filter'] ?? 'all');
        if ($p === '/api/warehouse/compact') return $storage->compactWarehouse();
        if ($p === '/api/inventory/overview') return $storage->inventoryOverview($state, $query, $filter);
        $key = trim((string)($_GET['key'] ?? ''));
        if ($key === '') fail('گروه موجودی مشخص نشده');
        return $storage->inventoryGroup($state, $key, $query, $filter, max(0, (int)($_GET['offset'] ?? 0)), max(20, min(250, (int)($_GET['limit'] ?? 100))));
    });
    if ($result !== null) out($result);
    if ($p === '/api/warehouse/compact') fail('جداسازی انبار هنوز فعال نشده است', 503);
}

/* These routes keep authentication identical to the existing inventory API. */
if (in_array($p, ['/api/inventory/page', '/api/inventory/search'], true) && $m === 'GET') {
    auth();
    $page = filter_var($_GET['page'] ?? 1, FILTER_VALIDATE_INT);
    $limit = filter_var($_GET['limit'] ?? GpWarehouseStorage::create(ghadir_mysql_pdo())->defaultPageSize(), FILTER_VALIDATE_INT);
    if ($page === false || $limit === false) fail('صفحه یا تعداد نتایج نامعتبر است', 422);
    $filters = [];
    foreach (['product', 'serial'] as $key) if (isset($_GET[$key])) $filters[$key] = (string)$_GET[$key];
    foreach (['warehouse_id', 'order_id', 'carton_id'] as $key) {
        if (!isset($_GET[$key])) continue;
        $value = filter_var($_GET[$key], FILTER_VALIDATE_INT);
        if ($value === false) fail('فیلتر انبار نامعتبر است', 422);
        $filters[$key] = $value;
    }
    try {
        out(gp_core_db(function (array $state) use ($filters, $page, $limit, $p): array {
            $storage = GpWarehouseStorage::create(ghadir_mysql_pdo());
            if (!$storage->isSplit($state)) fail('جداسازی انبار هنوز فعال نشده است', 503);
            if ($p === '/api/inventory/search') return $storage->mobilePage(mb_strtolower(trim((string)($_GET['q'] ?? '')), 'UTF-8'), $page, $limit);
            return $storage->page($filters, $page, $limit);
        }));
    } catch (InvalidArgumentException $error) { fail('صفحه یا تعداد نتایج نامعتبر است', 422); }
}

if ($p === '/api/warehouses' && $m === 'GET') {
    auth();
    $ledger = gp_core_db(function (array $state): ?array {
        $storage = GpWarehouseStorage::create(ghadir_mysql_pdo());
        return $storage->isSplit($state) ? $storage->ledgerData($state) : null;
    });
    if ($ledger !== null) out($ledger);
}
