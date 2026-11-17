<?php
declare(strict_types=1);

if (!in_array($p, ['/api/order-shipping-receipts', '/api/order-shipping-receipts/document'], true)) return;

require_once __DIR__.'/order-shipping-receipts.php';
$actor = auth();
$shipping = GpOrderShippingReceipts::configured(dirname($file).'/native-proofs');
$customerId = is_customer_user($actor) && !user_has_staff_role($actor) ? (int) ($actor['customer_id'] ?? 0) : 0;
$staff = $customerId === 0 && $shipping->staff($actor['roles'] ?? []);
if (!$staff && $customerId < 1) fail('دسترسی مجاز نیست.', 403);
header('Cache-Control: no-store');
if ($m !== 'GET' && ($m !== 'POST' || $p !== '/api/order-shipping-receipts')) fail('روش درخواست مجاز نیست.', 405);
if ($m === 'POST' && !$staff) fail('بارگذاری رسید ارسال فقط برای کارکنان مجاز است.', 403);
$request = $m === 'POST' ? input() : [];
$orderId = $m === 'POST' ? ($request['order_id'] ?? null) : filter_input(INPUT_GET, 'order_id', FILTER_VALIDATE_INT);
if (!is_int($orderId) || $orderId < 1) fail('شماره سفارش معتبر نیست.', 422);
$token = $_GET['token'] ?? '';
if (!is_string($token)) fail('فایل پیدا نشد.', 404);
$result = db($m === 'POST', static function (array &$state) use ($shipping, $customerId, $orderId, $m, $p, $request, $actor, $token): array {
    try {
        $index = $shipping->index($state, $orderId, $customerId);
        if ($m === 'POST') return $shipping->append($state['orders'][$index], $request, (int) $actor['id'], now());
        if ($p === '/api/order-shipping-receipts/document') return $shipping->document($state['orders'][$index], $token);
        return $shipping->summary($state['orders'][$index]);
    } catch (DomainException $error) {
        return ['shipping_error' => $error->getMessage(), 'shipping_status' => $error->getCode()];
    }
});
if (isset($result['shipping_error'])) fail($result['shipping_error'], $result['shipping_status']);
if ($m === 'POST') $shipping->commit();
out($result);
