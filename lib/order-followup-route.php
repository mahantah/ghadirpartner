<?php
declare(strict_types=1);

if (!in_array($p, ['/api/order-followup', '/api/order-followup/alerts', '/api/order-followup/document'], true)) return;

require_once __DIR__.'/order-followup.php';
require_once __DIR__.'/portal-messages.php';
$actor = auth();
$roles = $actor['roles'] ?? [];
$finance = (bool) array_intersect($roles, ['admin', 'finance']);
$sales = (bool) array_intersect($roles, ['admin', 'sales']);
$customerId = is_customer_user($actor) && !user_has_staff_role($actor) ? (int) ($actor['customer_id'] ?? 0) : 0;
if (!$finance && !$sales && $customerId < 1) fail('دسترسی مجاز نیست.', 403);
header('Cache-Control: no-store');
$followup = GpOrderFollowup::configured(dirname($file).'/native-proofs');
if ($p === '/api/order-followup/alerts' && $m === 'GET') {
    if (!$finance && !$sales) fail('دسترسی مجاز نیست.', 403);
    out(db(false, static fn (array $state): array => $followup->alerts($state, $finance, $sales)));
}
$request = $m === 'POST' ? input() : [];
$orderId = $m === 'POST' ? ($request['order_id'] ?? null) : filter_input(INPUT_GET, 'order_id', FILTER_VALIDATE_INT);
if (!is_int($orderId) || $orderId < 1) fail('شماره سفارش معتبر نیست.', 422);

if ($m === 'GET') {
    out(db(false, static function (array $state) use ($followup, $orderId, $customerId, $p, $finance): array {
        try {
            $order = $state['orders'][$followup->index($state, $orderId, $customerId)];
            if ($p === '/api/order-followup/document') {
                if (!$finance && $customerId === 0) fail('دسترسی به مدرک مالی مجاز نیست.', 403);
                $token = $_GET['token'] ?? '';
                if (!is_string($token)) fail('فایل پیدا نشد.', 404);
                return $followup->document($order, $token);
            }
            $summary = $followup->summary($order);
            if (!$finance && $customerId === 0) unset($summary['repayments'], $summary['outstanding'], $summary['proofs']);
            return $summary;
        } catch (DomainException $error) {
            fail($error->getMessage(), $error->getCode());
        }
    }));
}
if ($p !== '/api/order-followup' || $m !== 'POST') fail('روش درخواست مجاز نیست.', 405);
$action = $request['action'] ?? '';
$receiptActions = ['approve_order_receipt', 'reject_order_receipt', 'adjust_order_receipt'];
if (!(($customerId > 0 && $action === 'submit') || ($sales && in_array($action, ['return', 'ack_revision'], true))
    || ($finance && in_array($action, array_merge(['approve', 'reject', 'manual', 'adjust'], $receiptActions), true)))) fail('عملیات مجاز نیست.', 403);
$actorId = (int) $actor['id'];

$result = db(true, static function (array &$state) use ($followup, $request, $action, $receiptActions, $actorId, $orderId, $customerId): array {
    try {
        $index = $followup->index($state, $orderId, $customerId);
        $order = &$state['orders'][$index];
        if ($action === 'submit') return $followup->submit($order, $request, $actorId, now());
        if ($action === 'return') {
            $summary = $followup->returnOrder($order, $request, $actorId, now());
            $id = (int) $order['customer_id'];
            $config = json_decode((string) file_get_contents(dirname(__DIR__).'/config/portal-messages.yaml'), true, 512, JSON_THROW_ON_ERROR);
            $messages = new GpPortalMessages($config);
            $audience = $messages->recipients($state, 'is_customer_user', 'clean_mobile');
            if (!isset($audience[$id])) fail('حساب امن مشتری برای دریافت درخواست اصلاح پیدا نشد.', 409);
            $instructions = "\nبرای اصلاح و ارسال دوباره، سفارش را از بخش «سفارش‌های من» باز کنید.";
            $reason = mb_strcut($summary['correction']['reason'], 0, $config['max_body_bytes'] - strlen($instructions)).$instructions;
            $messageId = $summary['correction']['request_id'];
            $messages->create($state, [
                'id' => $messageId, 'title' => 'اصلاح سفارش '.$order['number'], 'body' => $reason,
                'recipients' => [$id], 'app' => true, 'sms' => false,
            ], $audience, $actorId, now());
            return $summary;
        }
        if ($action === 'ack_revision') {
            $version = $request['version'] ?? 0;
            if (!is_int($version) || $version !== ($order['customer_correction']['version'] ?? null)) {
                fail('نسخه سفارش تغییر کرده است.', 409);
            }
            unset($order['followup_events']['revision:'.$version]);
            return ['ok' => true];
        }
        if (in_array($action, $receiptActions, true)) {
            return $followup->reviewOrderReceipt($order, $request, $action, $actorId, now());
        }
        return $followup->review($order, $request, $action, $actorId, now());
    } catch (DomainException $error) {
        fail($error->getMessage(), $error->getCode());
    } catch (InvalidArgumentException $error) {
        fail($error->getMessage(), 422);
    }
});
$followup->commit();
if (!$finance && $customerId === 0) unset($result['proofs'], $result['repayments'], $result['outstanding']);
out($result);
