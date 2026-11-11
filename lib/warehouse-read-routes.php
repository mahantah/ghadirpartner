<?php
declare(strict_types=1);

if (!isset($p, $m)) return;

/* These routes keep authentication identical to the existing inventory API. */
if ($p === '/api/inventory/page' && $m === 'GET') {
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
        out(gp_core_db(function (array $state) use ($filters, $page, $limit): array {
            $storage = GpWarehouseStorage::create(ghadir_mysql_pdo());
            if (!$storage->isSplit($state)) fail('جداسازی انبار هنوز فعال نشده است', 503);
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
