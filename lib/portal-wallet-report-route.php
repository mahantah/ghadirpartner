<?php
declare(strict_types=1);

if ($p !== '/api/reports/portal-wallet' || !in_array($m, ['GET', 'POST'], true)) {
    return;
}

$walletActor = auth(['admin', 'finance']);
header('Cache-Control: no-store');
require_once __DIR__.'/order-wallet.php';
$writeWallet = $m === 'POST';
$walletRequest = [];
$walletPolicy = [];
if ($writeWallet) {
    $contentType = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '', 2)[0]));
    if ($contentType !== 'application/json') fail('فرمت درخواست معتبر نیست.', 415);
    $walletRequest = input();
    if (!is_array($walletRequest)) fail('درخواست معتبر نیست.', 422);
    $walletPolicy = json_decode((string) file_get_contents(dirname(__DIR__).'/config/order-followup.yaml'), true, 512, JSON_THROW_ON_ERROR);
}

$rawCustomer = $_GET['customer_id'] ?? null;
if (!$writeWallet && $rawCustomer === null) {
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

$customerId = $writeWallet
    ? ($walletRequest['customer_id'] ?? null)
    : (is_string($rawCustomer) ? filter_var($rawCustomer, FILTER_VALIDATE_INT) : false);
if (!is_int($customerId) || $customerId < 1) {
    fail('شناسهٔ مشتری معتبر نیست.', 422);
}
$result = db($writeWallet, static function (array &$state) use ($customerId, $writeWallet, $walletRequest, $walletPolicy, $walletActor): array {
    foreach ($state['customers'] ?? [] as $customer) {
        if ((int) ($customer['id'] ?? 0) === $customerId && empty($customer['deleted'])) {
            $wallet = new GpOrderWallet();
            if ($writeWallet) {
                try {
                    $wallet->creditManually($state, $customerId, $walletRequest, (int) $walletActor['id'], now(), $walletPolicy);
                } catch (DomainException $error) {
                    fail($error->getMessage(), $error->getCode());
                }
            }
            return $wallet->read($state, $customerId, 0, true);
        }
    }
    fail('مشتری پیدا نشد.', 404);
});
out($result);
