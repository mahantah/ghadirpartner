<?php
declare(strict_types=1);

require __DIR__.'/order-shipping-receipts-route.php';

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
            if ($customerId > 0) {
                $summary['wallet'] = (new GpOrderWallet())->read($state, $customerId);
                unset($summary['order_edit_review'], $summary['amendment_basis'], $summary['amendment_current'], $summary['can_propose_amendment'], $summary['amendment_mixed_terms'], $summary['agent_cash_pending']);
            }
            if (!$finance && $customerId === 0) unset($summary['repayments'], $summary['outstanding'], $summary['pending_amount'], $summary['submittable_amount'], $summary['settlement_progress'], $summary['proofs'], $summary['initial_payment'], $summary['cancellation']);
            return $summary;
        } catch (DomainException $error) {
            fail($error->getMessage(), $error->getCode());
        }
    }));
}
if ($p !== '/api/order-followup' || $m !== 'POST') fail('روش درخواست مجاز نیست.', 405);
$action = $request['action'] ?? '';
$editReviewPart = null;
if ($action === 'confirm_edited_settlement' && $finance) $editReviewPart = 'settlement';
if ($action === 'confirm_edited_shipping' && $sales) $editReviewPart = 'shipping';
$receiptActions = ['approve_order_receipt', 'reject_order_receipt', 'adjust_order_receipt'];
$amendmentPart = null;
if ($action === 'check_amendment_finance' && $finance) $amendmentPart = 'finance';
if ($action === 'check_amendment_shipping' && $sales) $amendmentPart = 'shipping';
if (!($amendmentPart !== null || $editReviewPart !== null || ($customerId > 0 && in_array($action, ['submit', 'cancel_credit_order', 'accept_amendment', 'reject_amendment'], true)) || ($sales && in_array($action, ['return', 'ack_revision', 'propose_amendment'], true))
    || ($finance && in_array($action, array_merge(['approve', 'reject', 'manual', 'adjust', 'complete_refund', 'approve_amendment_mixed_terms'], $receiptActions), true)))) fail('عملیات مجاز نیست.', 403);
$actorId = (int) $actor['id'];

/** Save the correction message alongside the order mutation so customers receive the reason once. */
$sendCorrection = static function (array &$state, array $order, array $summary, int $actorId): void
{
    $id = (int) $order['customer_id'];
    $config = json_decode((string) file_get_contents(dirname(__DIR__).'/config/portal-messages.yaml'), true, 512, JSON_THROW_ON_ERROR);
    $messages = new GpPortalMessages($config);
    $audience = $messages->recipients($state, 'is_customer_user', 'clean_mobile');
    if (!isset($audience[$id])) fail('حساب امن مشتری برای دریافت درخواست اصلاح پیدا نشد.', 409);
    $instructions = "\nبرای اصلاح و ارسال دوباره، سفارش را از بخش «سفارش‌های من» باز کنید.";
    $reason = mb_strcut($summary['correction']['reason'], 0, $config['max_body_bytes'] - strlen($instructions)).$instructions;
    $messages->create($state, [
        'id' => $summary['correction']['request_id'], 'title' => 'اصلاح سفارش '.$order['number'], 'body' => $reason,
        'recipients' => [$id], 'app' => true, 'sms' => false,
    ], $audience, $actorId, now());
};

$result = db(true, static function (array &$state) use ($followup, $request, $action, $receiptActions, $editReviewPart, $amendmentPart, $actorId, $orderId, $customerId, $sendCorrection): array {
    try {
        $index = $followup->index($state, $orderId, $customerId);
        $order = &$state['orders'][$index];
        if ($action === 'approve_amendment_mixed_terms') {
            $basis = $request['basis'] ?? null;
            if (!is_string($basis)) fail('نسخهٔ سفارش معتبر نیست.', 422);
            $amendments = $followup->amendments();
            $amendments->approveMixedTerms($order, $basis, $request['settlement'] ?? null, $actorId, now());
            return ['order_id' => $orderId] + $amendments->summary($order);
        }
        if ($action === 'propose_amendment') {
            $proposal = $followup->proposeAmendment($order, $request, now());
            $id = (int) $order['customer_id'];
            $config = json_decode((string) file_get_contents(dirname(__DIR__).'/config/portal-messages.yaml'), true, 512, JSON_THROW_ON_ERROR);
            $messages = new GpPortalMessages($config);
            $audience = $messages->recipients($state, 'is_customer_user', 'clean_mobile');
            if (!isset($audience[$id])) fail('حساب مشتری برای دریافت اصلاحیه در دسترس نیست.', 409);
            $messages->create($state, [
                'id' => $proposal['id'], 'title' => 'اصلاحیهٔ سفارش '.$order['number'],
                'body' => 'اصلاحیهٔ شماره '.$proposal['version'].' با مبلغ نهایی '.number_format($proposal['total'])." تومان. برای مشاهده و اعلام نظر، جزئیات سفارش را از «سفارش‌های من» باز کنید.",
                'recipients' => [$id], 'app' => true, 'sms' => false,
            ], $audience, $actorId, now());
            return ['order_id' => $orderId] + $followup->amendments()->summary($order);
        }
        if ($amendmentPart !== null || in_array($action, ['accept_amendment', 'reject_amendment'], true)) {
            $id = $request['amendment_id'] ?? null;
            if (!is_string($id)) fail('شناسهٔ اصلاحیه معتبر نیست.', 422);
            $amendments = $followup->amendments();
            $entry = $amendmentPart !== null
                ? $amendments->check($order, $id, $amendmentPart, now())
                : $amendments->decide($order, $id, $action === 'accept_amendment' ? 'accepted' : 'rejected', now());
            unset($entry['order_hash'], $entry['request_hash']);
            return ['order_id' => $orderId, 'amendment' => $entry];
        }
        if ($editReviewPart !== null) {
            $version = $request['version'] ?? null;
            if (!is_int($version)) fail('نسخهٔ سفارش معتبر نیست.', 422);
            GpOrderEditReview::confirm($order, $editReviewPart, $version, now());
            return ['order_id' => $orderId, 'order_edit_review' => $order['order_edit_review']];
        }
        if ($action === 'submit') {
            $summary = isset($request['wallet_amount'])
                ? $followup->submitWithWallet($state, $order, $request, $actorId, now())
                : $followup->submit($order, $request, $actorId, now());
            return $summary + ['wallet' => (new GpOrderWallet())->read($state, $customerId)];
        }
        if ($action === 'cancel_credit_order') {
            (new GpOrderWallet())->cancel($state, $order, $request, $actorId, now());
            return $followup->summary($order);
        }
        if ($action === 'complete_refund') {
            (new GpOrderWallet())->completeRefund($order, $request, $actorId, now());
            return $followup->summary($order);
        }
        if ($action === 'return') {
            $summary = $followup->returnOrder($order, $request, $actorId, now());
            $sendCorrection($state, $order, $summary, $actorId);
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
            $token = $request['token'] ?? '';
            $wasPending = is_string($token) && ($order['order_receipt_reviews'][$token]['status'] ?? 'pending') === 'pending';
            $summary = $followup->reviewOrderReceipt($order, $request, $action, $actorId, now());
            if ($action === 'reject_order_receipt' && $wasPending && $summary['can_return']
                && ($summary['initial_payment']['cash_remaining'] ?? 0) > 0
                && ($order['order_receipt_reviews'][$token]['status'] ?? '') === 'rejected') {
                $summary = $followup->returnOrder($order, [
                    'request_id' => bin2hex(random_bytes(16)), 'note' => $order['order_receipt_reviews'][$token]['review_note'],
                ], $actorId, now());
                $sendCorrection($state, $order, $summary, $actorId);
            }
            return $summary;
        }
        return $followup->review($order, $request, $action, $actorId, now());
    } catch (DomainException $error) {
        fail($error->getMessage(), $error->getCode());
    } catch (InvalidArgumentException $error) {
        fail($error->getMessage(), 422);
    }
});
$followup->commit();
if (!$finance && $customerId === 0) unset($result['proofs'], $result['repayments'], $result['outstanding'], $result['pending_amount'], $result['submittable_amount'], $result['settlement_progress']);
out($result);
