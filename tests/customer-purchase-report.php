<?php
declare(strict_types=1);

require_once __DIR__.'/../lib/customer-purchase-report.php';

$report = new GpCustomerPurchaseReport(
    new GpCreditModel(),
    static fn (array $order): int => $order['approved_total'] ?? 0,
    static fn (string $date): string => substr($date, 0, 10)
);
$purchased = [
    'customer_id' => 1, 'number' => 'GHP-1', 'created_at' => '1405/08/08',
    'approval_status' => 'تأیید شده', 'approved_total' => 400,
    'requested_payment_method' => 'mixed', 'native_settlement' => ['credit_amount' => 100],
    'items' => [['product' => 'I90', 'qty' => 2]],
];
$state = [
    'customers' => [['id' => 1, 'monthly_credit' => ['enabled' => true, 'limit' => 500]], ['id' => 2]],
    'orders' => [
        $purchased,
        array_replace($purchased, ['number' => 'GHP-2', 'created_at' => '1405/08/10', 'approval_status' => 'در انتظار تأیید']),
        array_replace($purchased, ['number' => 'GHP-3', 'status' => 'لغو شد']),
        array_replace($purchased, ['number' => 'GHP-4', 'customer_id' => 2]),
        array_replace($purchased, ['number' => 'GHP-5', 'created_at' => '1405/07/10']),
        array_replace($purchased, ['number' => 'GHP-6', 'deleted' => true]),
    ],
];
$result = $report->forCustomer($state, 1, '1405/08/23', '1405/08/01', '1405/08/30');
if (
    $result === null ||
    $result['counts'] !== ['purchased' => 1, 'pending' => 1, 'cancelled' => 1, 'other' => 0] ||
    $result['total_amount'] !== 400 ||
    $result['products'] !== ['I90' => 2] ||
    array_column($result['orders'], 'number') !== ['GHP-2', 'GHP-1', 'GHP-3'] ||
    $result['credit']['monthly_used'] !== 200 ||
    $result['credit']['outstanding'] !== 300 ||
    $result['credit']['reserved'] !== 100 ||
    $result['credit']['available'] !== 200 ||
    $report->forCustomer($state, 3, '1405/08/23', '', '') !== null
) {
    throw new RuntimeException('Customer purchase report does not reconcile with the fixture.');
}
echo "Customer purchase report fixture passed.\n";
