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
/** Mirror the authenticated editor's callback contract using synthetic state. */
function db(bool $write, callable $operation): array
{
    if (!$write) throw new LogicException('Order edit must use a write transaction.');
    return $operation($GLOBALS['edited_order_fixture']);
}

function idx(array $orders, int $id): int
{
    foreach ($orders as $index => $order) if ($order['id'] === $id) return $index;
    return -1;
}

function now(): string { return '1405-08-24 11:00:00'; }

function hist(array &$order, string $actor, string $note): void { $order['history'][] = [$actor, $note]; }

$GLOBALS['edited_order_fixture'] = ['orders' => [$base]];
$stored = gp_staff_order_edit_transaction(['id' => 4], ['username' => 'fixture'], static function (array &$sample): array {
    $sample['orders'][0]['notes'] = 'اصلاح سفارش';
    return $sample['orders'][0];
});
$assert($stored === $GLOBALS['edited_order_fixture']['orders'][0], 'Review must be stored and returned in the same write.');
$assert($stored['order_edit_review']['version'] === 1 && count($stored['history']) === 1, 'Edited order was not marked.');
unset($GLOBALS['edited_order_fixture']);

$edition = $base;
$edition['notes'] = 'توضیح ویرایش‌شده';
$assert(GpOrderEditReview::record($base, $edition, $now), 'A real edit must start review.');
$assert($edition['order_edit_review']['stage'] === $base['status'], 'The order stage at edit time is required.');
$assert($workflow->alerts(['orders' => [$edition]], true, true)['count'] === 1, 'An edit must raise a single alert.');
GpOrderEditReview::confirm($edition, 'settlement', 1, $now);
$assert($workflow->alerts(['orders' => [$edition]], true, false)['count'] === 0, 'Finance already reviewed this version.');
$assert($workflow->alerts(['orders' => [$edition]], false, true)['count'] === 1, 'Shipping review is still pending.');
GpOrderEditReview::confirm($edition, 'shipping', 1, $now);
$assert($workflow->alerts(['orders' => [$edition]], true, true)['count'] === 0, 'Two confirmations resolve the alert.');
$unchanged = $edition;
$unchanged['updated_at'] = '1405-08-25 09:00:00';
$assert(!GpOrderEditReview::record($edition, $unchanged, $now), 'Timestamp-only edits must not reopen the review.');
$revised = $edition;
$revised['shipping_type'] = 'باربری';
$assert(GpOrderEditReview::record($edition, $revised, $now), 'A later edit must reopen both reviews.');
$assert($revised['order_edit_review']['checked'] === [], 'Previous checks cannot approve a changed order.');
$denied(static function () use (&$revised, $now) {
    GpOrderEditReview::confirm($revised, 'shipping', 1, $now);
}, 409);

$shipped = $base + [
    'purchase_items' => [['product' => 'Original', 'qty' => 1, 'unit_price' => 800, 'price_key' => 'serial_1_50']],
    'shipping_type' => 'پیک', 'exit_items' => [['serial' => 'TEST']],
    'payment_status' => 'تسویه کامل', 'invoice_type' => 'غیررسمی',
];
$originalShipped = $shipped;
$review = $workflow->amendments();
$revision = [
    'basis' => $review->summary($shipped)['amendment_basis'],
    'request_id' => str_repeat('f', 32), 'note' => 'اصلاح فاکتور',
    'proposal' => [
        'items' => [['product' => 'Replacement', 'quantity' => 1, 'unit' => 600, 'type' => 'panel', 'switch' => 'ایرانکیش']],
        'total' => 600, 'invoice' => 'رسمی', 'shipping' => 'باربری', 'address' => 'Fixture',
        'settlement' => ['cash_amount' => 600, 'check_amount' => 0, 'credit_amount' => 0, 'wallet_amount' => 0],
    ],
];
$proposal = $workflow->proposeAmendment($shipped, $revision, $now);
$assert($proposal['difference'] === -200, 'The shipped order may receive a separate price adjustment.');
$assert($workflow->proposeAmendment($shipped, $revision, $now) === $proposal, 'Retry must not create a second version.');
$denied(static function () use ($review, &$shipped, $now) {
    $review->decide($shipped, 'old-version', 'accepted', $now);
}, 409);
$assert($review->decide($shipped, $proposal['id'], 'accepted', $now)['status'] === 'accepted', 'Customer acceptance must be recorded.');
$assert($workflow->alerts(['orders' => [$shipped]], true, true)['items'][0]['kind'] === 'amendment_accepted', 'Accepted amendment must be queued.');
$review->check($shipped, $proposal['id'], 'finance', $now);
$assert($workflow->alerts(['orders' => [$shipped]], true, false)['count'] === 0, 'Finance review must close only its own work.');
$assert($workflow->alerts(['orders' => [$shipped]], false, true)['count'] === 1, 'Shipping review must remain open.');
$review->check($shipped, $proposal['id'], 'shipping', $now);
unset($shipped['amendments']);
$assert($shipped === $originalShipped, 'Proposal and reviews must preserve the original order and ledgers.');

$mixedDraft = $originalShipped;
$mixedTerms = ['cash_amount' => 300, 'check_amount' => 400, 'credit_amount' => 100, 'wallet_amount' => 0];
$mixedProposal = $revision;
$mixedProposal['basis'] = $review->summary($mixedDraft)['amendment_basis'];
$mixedProposal['proposal']['settlement'] = $mixedTerms;
$mixedProposal['proposal']['total'] = 800;
$denied(static function () use ($workflow, &$mixedDraft, $mixedProposal, $now) {
    $workflow->proposeAmendment($mixedDraft, $mixedProposal, $now);
}, 422);
$review->approveMixedTerms($mixedDraft, $mixedProposal['basis'], $mixedTerms, 9, $now);
$review->approveMixedTerms($mixedDraft, $mixedProposal['basis'], $mixedTerms, 9, $now);
$mixedProposal['basis'] = $review->summary($mixedDraft)['amendment_basis'];
$altered = $mixedProposal;
$altered['proposal']['settlement']['cash_amount']--;
$altered['proposal']['settlement']['credit_amount']++;
$denied(static function () use ($workflow, &$mixedDraft, $altered, $now) {
    $workflow->proposeAmendment($mixedDraft, $altered, $now);
}, 422);
$changedOrder = $mixedDraft;
$changedOrder['shipping_type'] = 'باربری';
$assert($review->summary($changedOrder)['amendment_mixed_terms'] === null, 'A changed order must require new authorization.');
$approvedProposal = $workflow->proposeAmendment($mixedDraft, $mixedProposal, $now);
$assert($approvedProposal['settlement'] === $mixedTerms, 'Only the exact authorized terms may be proposed.');
unset($mixedDraft['amendments'], $mixedDraft['amendment_mixed_approval']);
$assert($mixedDraft === $originalShipped, 'Authorization must not alter the ledger or original order.');

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
    $settlementProgress = new GpOrderSettlementProgress($credit);
    $pendingCredit = array_replace($base, [
        'approval_status' => 'در انتظار تأیید', 'payment_status' => 'پرداخت نشده', 'approved_total' => 0,
        'status' => 'در انتظار تأیید سفارش',
    ]);
    $assert($settlementProgress->read($pendingCredit) === [
        'awaiting_approval' => true, 'label' => 'اعتباری · در انتظار تأیید',
    ], 'Pending credit order was shown as ordinary unpaid.');
    $pendingMixed = array_replace($pendingCredit, ['requested_payment_method' => 'mixed']);
    $assert($settlementProgress->read($pendingMixed)['label'] === 'ترکیبی با اعتبار · در انتظار تأیید', 'Mixed credit request was mislabeled.');
    foreach ([
        ['requested_payment_method' => 'cash'],
        ['approval_status' => 'رد شده'],
        ['approval_status' => 'تأیید شده'],
        ['status' => 'لغو شد'],
    ] as $change) {
        $assert($settlementProgress->read(array_replace($pendingCredit, $change)) === null, 'Unrelated payment inherited the pending credit label.');
    }
    $display = $settlementProgress->read($order);
    $assert($display === [
        'paid' => 330, 'outstanding' => 470, 'settled' => false, 'label' => 'پرداخت بخشی',
    ], 'Order settlement display did not use approved repayments and audited adjustments.');
    $onlyPending = array_merge($base, ['credit_repayments' => [
        ['status' => 'pending', 'amount' => 500], ['status' => 'rejected', 'amount' => 300],
    ]]);
    $assert($settlementProgress->read($onlyPending) === null, 'Unconfirmed slips changed the displayed status.');
    $paid = array_merge($base, ['credit_repayments' => [['status' => 'approved', 'amount' => 800]]]);
    $assert($settlementProgress->read($paid)['label'] === 'تسویه کامل', 'A fully repaid credit invoice remained partial.');
    $mixed = array_merge($paid, ['requested_payment_method' => 'mixed', 'approved_total' => 1000]);
    $assert($settlementProgress->read($mixed)['label'] === 'بخش اعتباری تسویه شد', 'Mixed payment incorrectly showed full settlement.');
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

    $agent = $base;
    $agent['requested_payment_method'] = 'mixed';
    $agent['purchase_items'] = [['product' => 'Agent POS', 'price_key' => 'sales_agent', 'qty' => 1, 'line_total' => 800]];
    $agent['status'] = 'در انتظار تأیید سفارش';
    $agent['approval_status'] = 'در انتظار تأیید';
    $agent['native_settlement'] = ['cash_amount' => 320, 'check_amount' => 480];
    $checkout = new GpCreditCheckout();
    $checkout->startAgentReview($agent, ['agent_change_reason' => 'درخواست سهم نقد بیشتر']);
    $assert($workflow->alerts(['orders' => [$agent]], false, true)['items'][0]['kind'] === 'agent_settlement', 'Agent order did not generate a staff alert.');
    $denied(static fn () => $checkout->assertApproval($agent, 800), 409);
    $terms = ['cash_amount' => 400, 'check_amount' => 400, 'credit_amount' => 0, 'wallet_amount' => 0];
    $agentReviewRequest = ['request_id' => $correction, 'note' => 'شرایط جدید', 'settlement_amounts' => $terms];
    $workflow->returnOrder($agent, $agentReviewRequest, 2, $now);
    $assert($agent['customer_correction']['settlement_amounts'] === $terms
        && $workflow->alerts(['orders' => [$agent]], false, true)['count'] === 0, 'Approved terms did not go back to the customer.');
    $agentRevised = $agent;
    $agentRevised['status'] = 'در انتظار تأیید سفارش';
    $agentRevised['approval_status'] = 'در انتظار تأیید';
    $agentRevised['native_settlement'] = $terms;
    $resubmittedTerms = $terms + ['cash_enabled' => true, 'check_enabled' => true];
    $denied(static fn () => $workflow->assertAgentRevision($agent, $agentRevised, array_replace($resubmittedTerms, ['cash_amount' => 410, 'check_amount' => 390])), 409);
    $workflow->assertAgentRevision($agent, $agentRevised, $resubmittedTerms);
    $workflow->preserveRevision($agent, $agentRevised, [], $now);
    $assert($workflow->alerts(['orders' => [$agentRevised]], false, true)['items'][0]['kind'] === 'agent_final_review', 'Resubmitted agent order did not send the final staff alert.');
    $denied(static fn () => $checkout->assertApproval($agentRevised, 810), 409);
    $checkout->assertApproval($agentRevised, 800);
} finally {
    $upload->cleanup();
    if (is_dir($directory)) rmdir($directory);
}

echo "Post-delivery evidence, confirmed balance, manual auditing and order correction passed.\n";
