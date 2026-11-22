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

if (($_GET['refunds'] ?? '') === '1') {
    out(db($writeWallet, static function (array &$state) use ($writeWallet, $walletRequest, $walletActor): array {
        $wallet = new GpOrderWallet();
        if (!$writeWallet) return $wallet->refundQueue($state);
        $action = $walletRequest['action'] ?? '';
        $actorId = (int) $walletActor['id'];
        try {
            if (($walletRequest['kind'] ?? '') === 'order' && $action === 'paid') {
                $id = $walletRequest['order_id'] ?? null;
                if (!is_int($id) || $id < 1) fail('شناسه سفارش معتبر نیست.', 422);
                foreach ($state['orders'] ?? [] as $index => $order) {
                    if ((int) $order['id'] === $id) {
                        $wallet->completeRefund($state['orders'][$index], $walletRequest, $actorId, now());
                        return $wallet->refundQueue($state);
                    }
                }
                fail('سفارش پیدا نشد.', 404);
            }
            $id = $walletRequest['customer_id'] ?? null;
            $key = $walletRequest['request_id'] ?? null;
            if (($walletRequest['kind'] ?? '') !== 'wallet' || !is_int($id) || $id < 1
                || !is_string($key) || !preg_match('/^[a-f0-9]{32}$/D', $key)
                || !in_array($action, ['approve', 'reject', 'paid'], true)) {
                fail('درخواست عودت معتبر نیست.', 422);
            }
            $wallet->reviewWalletRefund($state, $id, $key, $action, $walletRequest, $actorId, now());
            return $wallet->refundQueue($state);
        } catch (DomainException $error) {
            fail($error->getMessage(), $error->getCode());
        }
    }));
    return;
}

$rawCustomer = $_GET['customer_id'] ?? null;
if (!$writeWallet && $rawCustomer === null) {
    $query = $_GET['q'] ?? '';
    if (!is_string($query) || strlen($query) > 240 || !preg_match('//u', $query)) {
        fail('عبارت جست‌وجو معتبر نیست.', 422);
    }
    out(db(false, static function (array $state) use ($query): array {
        $normalize = static function (string $value): string {
            return trim(strtr($value, [
                'ي' => 'ی', 'ك' => 'ک', '‌' => ' ',
                '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
                '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
                '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
                '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
            ]));
        };
        $term = $normalize($query);
        $rows = [];
        foreach ($state['customers'] ?? [] as $customer) {
            if (!empty($customer['deleted']) || (int) ($customer['id'] ?? 0) < 1) continue;
            if ($term !== '') {
                $searchable = implode(' ', array_map($normalize, [
                    (string) ($customer['name'] ?? ''), (string) ($customer['company'] ?? ''),
                    (string) ($customer['code'] ?? ''), (string) ($customer['mobile'] ?? ''),
                ]));
                if (stripos($searchable, $term) === false) continue;
            }
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
