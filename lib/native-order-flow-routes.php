<?php
declare(strict_types=1);
require_once __DIR__ . '/native-order-flow.php';

// Instantiate policy only on affected routes; login and unrelated warehouse reads stay independent.
if (!in_array($p, ['/api/orders/add', '/api/orders/edit', '/api/customer-order/approve', '/api/customer-order/reject'], true)) return;
$gpCustomerOrderFlow = new GpCustomerOrderFlow((new GpOrderPolicyRepository(dirname(__DIR__) . '/config/native-order-flow.yaml'))->load());
if ($p !== '/api/customer-order/reject') return;
if ($m !== 'POST') fail('روش درخواست مجاز نیست', 405);
$user = auth(['admin', 'sales']);
$request = input();
if (!is_int($request['id'] ?? null) || $request['id'] < 1 || !is_string($request['reason'] ?? null)) fail('شناسه سفارش و علت معتبر الزامی است', 422);
$order = db(true, static function (array &$state) use ($gpCustomerOrderFlow, $user, $request): array {
    $index = idx($state['orders'], $request['id'] ?? 0);
    if ($index < 0) fail('سفارش پیدا نشد', 404);
    try {
        $rejected = $gpCustomerOrderFlow->reject($state['orders'][$index], (string)($request['reason'] ?? ''), $user['username'], now());
    } catch (InvalidArgumentException $error) { fail($error->getMessage(), 422); }
    // Pending orders should own no stock. Refuse inconsistent data rather than orphaning serials.
    foreach ($state['inventory'] ?? [] as $serial) {
        if ((int)($serial['order_id'] ?? 0) === (int)$rejected['id']) fail('سفارش سریال تخصیص‌یافته دارد؛ ابتدا آن را آزاد کنید', 409);
    }
    hist($rejected, $user['username'], 'سفارش توسط شرکت تأیید نشد: ' . $rejected['rejection_reason']);
    $state['orders'][$index] = $rejected;
    return $rejected;
});
out($order);
