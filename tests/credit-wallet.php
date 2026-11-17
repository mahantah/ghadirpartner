<?php
declare(strict_types=1);

require_once __DIR__.'/../lib/order-followup.php';

$checkout = new GpCreditCheckout();
$credit = new GpCreditModel();
$wallet = new GpOrderWallet();
$folder = sys_get_temp_dir().'/gp-wallet-test-'.bin2hex(random_bytes(8));
$followup = GpOrderFollowup::configured($folder);
$date = '1405/08/25';
$month = static fn (string $value): string => substr($value, 0, 7);
$state = ['customers' => [['id' => 3, 'monthly_credit' => ['enabled' => true, 'limit' => 200]]]];
$order = [
    'id' => 4, 'customer_id' => 3, 'number' => 'GHP-000004', 'requested_payment_method' => 'mixed',
    'approval_status' => 'در انتظار تأیید', 'status' => 'در انتظار تأیید سفارش', 'estimated_total' => 150,
    'created_at' => $date, 'native_settlement' => ['credit_amount' => 100, 'cash_amount' => 50],
];

/** Keep fixture failures visible even when PHP assertions are disabled. */
function walletCheck(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$checkout->initialize($order, null, 0);
$state['orders'] = [$order];
$balance = $credit->balance($state, 3, '1405/08', $month);
walletCheck($balance['available'] === 100 && $balance['reserved'] === 100 && $balance['outstanding'] === 0, 'Credit was not held separately.');
$order['order_receipt_reviews']['first'] = ['status' => 'approved', 'amount' => 20];
try {
    $checkout->assertApproval($order, 150);
    throw new LogicException('Partial cash enabled preparation.');
} catch (DomainException $error) {
    walletCheck($error->getCode() === 409, 'Expected payment gate.');
}
$order['customer_correction'] = ['status' => 'requested', 'version' => 1, 'reason' => 'اصلاح فیش', 'requested_at' => $date];
$order['status'] = 'نیازمند اصلاح سفارش';
$order['approval_status'] = 'نیازمند اصلاح';
$order['native_settlement']['proofs'] = [
    ['kind' => 'cash', 'proof_token' => 'first', 'proof_mime' => 'image/png'],
    ['kind' => 'cash', 'proof_token' => 'second', 'proof_mime' => 'image/png'],
];
$revision = $order;
unset($revision['native_settlement']['proofs']);
$followup->preserveRevision($order, $revision, ['cash' => ['replacement']], $date);
walletCheck(array_column($revision['native_settlement']['proofs'], 'proof_token') === ['first'], 'Revision lost confirmed evidence.');
$wallet->cancel($state, $order, ['destination' => 'wallet'], 9, $date);
$wallet->cancel($state, $order, ['destination' => 'wallet'], 9, $date);
$state['orders'] = [$order];
walletCheck($wallet->read($state, 3)['balance'] === 20 && $wallet->read($state, 9)['balance'] === 0, 'Cancelling was not isolated and idempotent.');
walletCheck($credit->balance($state, 3, '1405/09', $month)['available'] === 200, 'Cancellation did not release credit.');

$paid = [
    'id' => 17, 'customer_id' => 3, 'number' => 'GHP-000017',
    'status' => 'ثبت شده', 'approval_status' => 'تأیید شده',
    'credit_checkout' => ['cash_required' => 70, 'credit_reserved' => 40, 'wallet_reserved' => 20],
    'irankish_order_payment' => ['receipt' => ['amount' => 50, 'reference' => '123']],
    'order_receipt_reviews' => [
        ['status' => 'approved', 'amount' => 20], ['status' => 'pending', 'amount' => 100],
    ],
    'credit_repayments' => [
        ['status' => 'approved', 'amount' => 10], ['status' => 'pending', 'amount' => 100],
    ],
];
$staffState = ['customer_wallet' => [3 => ['purchase:17' => [
    'source' => 'order_purchase', 'amount' => -20, 'order_id' => 17,
]]]];
$before = $paid;
$wallet->creditStaffCancellation($staffState, $paid, 9, $date);
$paid['status'] = 'لغو شد';
$paid['approval_status'] = 'لغو شد';
$checkout->assertTransition($before, $paid);
$wallet->creditStaffCancellation($staffState, $paid, 9, $date);
walletCheck($paid['customer_credit_cancel']['amount'] === 100
    && count($staffState['customer_wallet'][3]) === 2
    && $wallet->read($staffState, 3)['balance'] === 80
    && $wallet->read($staffState, 9)['balance'] === 0, 'Admin cancellation did not credit confirmed funds exactly once.');
$held = $before;
unset($held['irankish_order_payment'], $held['order_receipt_reviews'], $held['credit_repayments']);
$noDebitState = [];
$wallet->creditStaffCancellation($noDebitState, $held, 9, $date);
walletCheck(!isset($held['customer_credit_cancel']) && $noDebitState === [], 'A mere wallet hold created a refund.');
foreach ([
    ['irankish_order_payment' => ['claim' => 'pending']],
    ['shipment_batches' => [['items' => [['serials' => ['test']]]]]],
] as $blockedFields) {
    $blocked = array_replace($before, $blockedFields);
    try {
        $wallet->creditStaffCancellation($noDebitState, $blocked, 9, $date);
        throw new LogicException('An unsettled or shipped order was allowed to refund.');
    } catch (DomainException $error) {
        walletCheck($error->getCode() === 409 && $noDebitState === [], 'Refund rejection changed the wallet.');
    }
}

$purchase = [
    'id' => 5, 'customer_id' => 3, 'number' => 'GHP-000005', 'requested_payment_method' => 'mixed',
    'approval_status' => 'در انتظار تأیید', 'status' => 'در انتظار تأیید سفارش', 'estimated_total' => 180,
    'created_at' => $date, 'native_settlement' => ['credit_amount' => 150, 'cash_amount' => 10],
];
$checkout->initialize($purchase, null, 20);
$wallet->assertReservation($state, $purchase);
$state['orders'][] = $purchase;
walletCheck($wallet->read($state, 3)['available'] === 0, 'Wallet balance was double spendable.');
$purchase['order_receipt_reviews']['bank'] = ['status' => 'approved', 'amount' => 10];
$checkout->assertApproval($purchase, 180);
$wallet->purchase($state, $purchase, $date);
$wallet->purchase($state, $purchase, $date);
$purchase['approval_status'] = 'تأیید شده';
$purchase['status'] = 'ثبت شده';
$checkout->recordApproval($purchase);
$state['orders'][1] = $purchase;
walletCheck($followup->summary($purchase)['can_submit'], 'Credit repayment was blocked until delivery.');
walletCheck($wallet->read($state, 3)['balance'] === 0, 'Approval did not debit wallet exactly once.');

$state['customer_wallet'][3]['fixture'] = ['amount' => 20];
$repayRequest = ['request_id' => str_repeat('a', 32), 'wallet_amount' => 20];
$followup->submitWithWallet($state, $purchase, $repayRequest, 9, $date);
$followup->submitWithWallet($state, $purchase, $repayRequest, 9, $date);
$state['orders'][1] = $purchase;
$monthEnd = $credit->balance($state, 3, '1405/09', $month);
walletCheck($monthEnd['outstanding'] === 130 && $monthEnd['available'] === 70 && $monthEnd['reserved'] === 0, 'Repayment or month rollover changed debt incorrectly.');
walletCheck($wallet->read($state, 3)['available'] === 0, 'Retry debited the wallet twice.');

$combo = $purchase;
$combo['id'] = 6;
$combo['number'] = 'GHP-000006';
$combo['credit_checkout']['credit_reserved'] = 70;
$combo['credit_repayments'] = [];
$state['orders'] = [$combo];
$state['customer_wallet'][3]['second_fixture'] = ['amount' => 20];
$combinedRequest = [
    'request_id' => str_repeat('b', 32), 'wallet_amount' => 20,
    'files' => [['amount' => 50, 'data' => 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQ1sAAAAASUVORK5CYII=']],
];
$summary = $followup->submitWithWallet($state, $combo, $combinedRequest, 9, $date);
$summary = $followup->submitWithWallet($state, $combo, $combinedRequest, 9, $date);
walletCheck($summary['outstanding'] === 50 && $summary['pending_amount'] === 50 && count($summary['repayments']) === 2, 'Combined wallet and pending bank settlement needs independent ledger entries.');
$state['orders'] = [$combo];
walletCheck($credit->balance($state, 3, '1405/09', $month)['available'] === 150, 'Pending receipts must leave the invoice balance intact.');
$summary = $followup->review($combo, [
    'request_id' => $combinedRequest['request_id'], 'amount' => 50, 'seen' => true,
], 'approve', 2, $date);
walletCheck($summary['settlement_progress']['label'] === 'تسویه کامل', 'Verified cash, wallet and credit repayment did not settle the whole invoice.');

$refund = $order;
$refund['id'] = 7;
$refund['status'] = 'نیازمند اصلاح سفارش';
$refund['approval_status'] = 'نیازمند اصلاح';
$refund['customer_correction']['status'] = 'requested';
unset($refund['customer_credit_cancel']);
$walletBalance = $wallet->read($state, 3)['balance'];
$refundRequest = $wallet->cancel($state, $refund, ['destination' => 'refund'], 9, $date);
walletCheck($refundRequest['status'] === 'pending' && $wallet->read($state, 3)['balance'] === $walletBalance, 'Refund choice credited the wallet.');
$wallet->completeRefund($refund, ['reference' => 'REF-7'], 2, $date);
walletCheck($refund['customer_credit_cancel']['status'] === 'completed' && empty($refund['followup_events']), 'Completed refund was not acknowledged.');

echo "PASS: cash gate, preserved evidence, wallet/refund choice isolation, wallet holds, repayment and rollover\n";
