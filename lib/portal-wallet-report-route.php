<?php
declare(strict_types=1);

if ($p !== '/api/reports/portal-wallet' || $m !== 'GET') {
    return;
}

auth(['admin', 'finance']);
header('Cache-Control: no-store');
require_once __DIR__.'/order-wallet.php';
$rawCustomer = $_GET['customer_id'] ?? null;
if ($rawCustomer === null) {
    out(db(false, static function (array $state): array {
        $rows = [];
        foreach ($state['customers'] ?? [] as $customer) {
            if (!empty($customer['deleted']) || (int) ($customer['id'] ?? 0) < 1) continue;
            $rows[] = [
                'id' => (int) $customer['id'],
                'name' => (string) ($customer['name'] ?? ''),
                'company' => (string) ($customer['company'] ?? ''),
                'code' => (string) ($customer['code'] ?? ''),
            ];
        }
        return $rows;
    }));
}

$customerId = is_string($rawCustomer) ? filter_var($rawCustomer, FILTER_VALIDATE_INT) : false;
if ($customerId === false || $customerId < 1) {
    fail('شناسهٔ مشتری معتبر نیست.', 422);
}
$result = db(false, static function (array $state) use ($customerId): ?array {
    foreach ($state['customers'] ?? [] as $customer) {
        if ((int) ($customer['id'] ?? 0) === $customerId && empty($customer['deleted'])) {
            return (new GpOrderWallet())->read($state, $customerId);
        }
    }
    return null;
});
if ($result === null) {
    fail('مشتری پیدا نشد.', 404);
}
out($result);
