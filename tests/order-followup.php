<?php
declare(strict_types=1);

require_once __DIR__.'/../lib/order-followup.php';

$directory = sys_get_temp_dir().'/gp-followup-'.bin2hex(random_bytes(8));
$credit = new GpCreditModel();
$upload = GpOrderProofUpload::configured($directory);
$policy = json_decode((string) file_get_contents(__DIR__.'/../config/order-followup.yaml'), true, 512, JSON_THROW_ON_ERROR);
$workflow = new GpOrderFollowup($credit, $upload, $policy);
$monthOf = static fn (string $date): string => substr($date, 0, 7);
$now = '1405-08-24 11:00:00';
$png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQ1sAAAAASUVORK5CYII=';
$key = str_repeat('a', 32);
$manual = str_repeat('b', 32);
$correction = str_repeat('c', 32);
$base = [
    'id' => 4, 'number' => 'GHP-000004', 'customer_id' => 3, 'requested_payment_method' => 'credit',
    'estimated_total' => 800, 'approved_total' => 800, 'status' => 'ارسال شد',
    'approval_status' => 'تأیید شده', 'created_at' => $now, 'native_settlement' => ['credit_amount' => 800],
];
$state = [
    'customers' => [['id' => 3, 'monthly_credit' => ['limit' => 1000, 'enabled' => true]]],
    'orders' => [$base],
];
$order = &$state['orders'][0];
$assert = static function (bool $result, string $message): void {
    if (!$result) throw new RuntimeException($message);
};
$denied = static function (callable $action, int $code) use ($assert): void {
    try {
        $action();
    } catch (DomainException $error) {
        $assert($error->getCode() === $code, $error->getMessage());
        return;
    }
    throw new RuntimeException('Expected operation to be rejected.');
};
try {
    $request = ['request_id' => $key, 'amount' => 300, 'files' => [
        ['data' => $png, 'note' => 'رسید اول'],
        ['data' => base64_encode("%PDF-1.7\n%%EOF\n"), 'note' => 'رسید دوم'],
    ]];
    $denied(static function () use ($workflow, &$order, $request, $now) { $workflow->submit($order, $request, 1, $now); }, 409);
    $denied(static fn () => $workflow->index($state, 4, 8), 404);
    $order['status'] = 'تحویل شد';
    $workflow->submit($order, $request, 1, $now);
    $workflow->submit($order, $request, 1, $now);
    $pending = $credit->balance($state, 3, '1405-08', $monthOf);
    $assert($pending['outstanding'] === 800 && $pending['available'] === 200, 'Pending money altered credit.');
    $assert($workflow->alerts($state, true, false)['count'] === 1, 'Retry produced duplicate alerts.');
    $proof = $order['credit_repayments'][$key]['proofs'][0];
    $assert($proof['note'] === 'رسید اول' && $workflow->document($order, $proof['proof_token'])['data'] === $png, 'Saved preview did not match evidence.');
    $denied(static function () use ($workflow, &$order, $key, $now) {
        $workflow->review($order, ['request_id' => $key, 'amount' => 250], 'approve', 2, $now);
    }, 422);
    $approval = ['request_id' => $key, 'amount' => 250, 'seen' => true];
    $workflow->review($order, $approval, 'approve', 2, $now);
    $workflow->review($order, $approval, 'approve', 2, $now);
    $balance = $credit->balance($state, 3, '1405-08', $monthOf);
    $assert($balance['outstanding'] === 550 && $balance['available'] === 450, 'Approved amount was not applied once.');
    $assert($workflow->alerts($state, true, false)['count'] === 0, 'Reviewed alert remained in the queue.');
    $workflow->review($order, ['request_id' => $manual, 'amount' => 100, 'note' => 'تسویه حضوری'], 'manual', 2, $now);
    $workflow->review($order, ['request_id' => $manual, 'amount' => 80, 'previous_amount' => 100, 'note' => 'اصلاح مبلغ'], 'adjust', 2, $now);
    $assert($credit->debt($order) === 470 && count($order['credit_repayments'][$manual]['adjustments']) === 1, 'Manual adjustment lost the audit or balance.');
    $receiptToken = $proof['proof_token'];
    $firstReceipt = $base;
    $firstReceipt['native_settlement']['proof_token'] = $receiptToken;
    $firstReceipt['native_settlement']['proof_mime'] = $proof['proof_mime'];
    $receiptInput = ['token' => $receiptToken, 'amount' => 55];
    $denied(static function () use ($workflow, &$firstReceipt, $receiptInput, $now) {
        $workflow->reviewOrderReceipt($firstReceipt, $receiptInput, 'approve_order_receipt', 2, $now);
    }, 422);
    $assert($workflow->document($firstReceipt, $receiptToken)['data'] === $png, 'Legacy checkout receipt cannot be opened.');
    $result = $workflow->reviewOrderReceipt($firstReceipt, $receiptInput + ['seen' => true], 'approve_order_receipt', 2, $now);
    $assert($result['proofs'][0]['review']['status'] === 'approved' && $credit->debt($firstReceipt) === 800, 'Checkout proof approval changed credit debt.');
    $adjusted = $workflow->reviewOrderReceipt($firstReceipt, [
        'token' => $receiptToken, 'amount' => 65, 'previous_amount' => 55, 'note' => 'اصلاح مبلغ فیش',
    ], 'adjust_order_receipt', 2, $now);
    $assert($adjusted['proofs'][0]['review']['amount'] === 65 && count($firstReceipt['order_receipt_reviews'][$receiptToken]['history']) === 2, 'Receipt adjustment lost audit history.');
    $rejectedReceipt = $base;
    $rejectedReceipt['native_settlement']['proofs'] = [$proof];
    $rejected = $workflow->reviewOrderReceipt($rejectedReceipt, ['token' => $receiptToken, 'note' => 'ناخوانا'],
        'reject_order_receipt', 2, $now);
    $assert($rejected['proofs'][0]['review']['status'] === 'rejected', 'Checkout receipt rejection was not saved.');
    $multi = array_merge($base, ['status' => 'تحویل شد']);
    $batchKey = str_repeat('d', 32);
    $nextKey = str_repeat('e', 32);
    $batch = ['request_id' => $batchKey, 'files' => [
        ['data' => $png, 'amount' => 125, 'note' => 'فیش اول'],
        ['data' => base64_encode("%PDF-1.7\n%%EOF\n"), 'amount' => 200, 'note' => 'فیش دوم'],
    ]];
    $new = $workflow->submit($multi, $batch, 1, $now);
    $assert(array_column($new['repayments'], 'claimed_amount') === [125, 200]
        && array_map(static fn ($entry) => count($entry['proofs']), $new['repayments']) === [1, 1]
        && $new['pending_amount'] === 325 && $new['submittable_amount'] === 475 && $new['outstanding'] === 800,
        'Separate amounts or reserved balance were not applied.');
    $assert(count($workflow->submit($multi, $batch, 1, $now)['repayments']) === 2, 'Batch retry duplicated receipts.');
    $next = ['request_id' => $nextKey, 'files' => [
        ['data' => base64_encode("%PDF-1.6\n%%EOF\n"), 'amount' => 475],
    ]];
    $assert(count($workflow->submit($multi, $next, 1, $now)['repayments']) === 3, 'A pending receipt blocked another payment.');
    $workflow->review($multi, ['request_id' => $batchKey, 'amount' => 125, 'seen' => true], 'approve', 2, $now);
    $assert($credit->debt($multi) === 675 && $multi['credit_repayments'][$batchKey]['status'] === 'approved', 'One approval affected other receipts.');
    $changed = $batch;
    $changed['files'][0]['amount'] = 100;
    $denied(static function () use ($workflow, &$multi, $changed, $now) {
        $workflow->submit($multi, $changed, 1, $now);
    }, 409);
    $assert($multi['credit_repayments'][$batchKey]['amount'] === 125, 'Customer overwrote an approved receipt.');
    $returned = array_merge($base, [
        'id' => 5, 'status' => 'در انتظار تأیید سفارش', 'approval_status' => 'در انتظار تأیید',
        'purchase_items' => [['product' => 'Original']], 'native_settlement' => [],
    ]);
    $workflow->returnOrder($returned, ['request_id' => $correction, 'note' => 'کالا ناموجود است.'], 2, $now);
    $assert($workflow->revisionIndex(['orders' => [$returned]], 5, 3, 1) === 0, 'Returned order was not available to its owner.');
    $revised = ['id' => 5, 'customer_id' => 3, 'purchase_items' => [['product' => 'Replacement']], 'status' => 'در انتظار تأیید سفارش'];
    $workflow->preserveRevision($returned, $revised, [], $now);
    $assert($revised['number'] === $base['number'] && $revised['customer_correction']['status'] === 'resubmitted'
        && $workflow->alerts(['orders' => [$revised]], false, true)['count'] === 1, 'Resubmission changed identity or missed the staff alert.');
} finally {
    $upload->cleanup();
    if (is_dir($directory)) rmdir($directory);
}

echo "Post-delivery evidence, confirmed balance, manual auditing and order correction passed.\n";
