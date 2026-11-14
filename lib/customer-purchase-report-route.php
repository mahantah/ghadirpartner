<?php
declare(strict_types=1);

if ($p !== '/api/reports/customer-purchases' || $m !== 'GET') {
    return;
}

auth(['admin']);
require_once __DIR__.'/customer-purchase-report.php';
$rawCustomer = $_GET['customer_id'] ?? '';
$customerId = is_string($rawCustomer) ? filter_var($rawCustomer, FILTER_VALIDATE_INT) : false;
$range = [];
foreach (['from', 'to'] as $key) {
    $input = $_GET[$key] ?? '';
    $value = is_string($input) ? normalize_jalali_input($input) : '';
    if ($input !== '' && ($value === '' || !preg_match('~^[0-9]{4}/(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])$~D', $value))) {
        fail('بازهٔ تاریخ شمسی معتبر نیست', 422);
    }
    $range[$key] = $value;
}
if ($customerId === false || $customerId < 1 || ($range['from'] !== '' && $range['to'] !== '' && $range['from'] > $range['to'])) {
    fail('مشتری یا بازهٔ تاریخ معتبر نیست', 422);
}
$report = new GpCustomerPurchaseReport(new GpCreditModel(), 'order_sales_amount', 'jalali_date_value');
$result = db(false, fn (array $state): ?array => $report->forCustomer(
    $state, $customerId, jalali_date_value(now()), $range['from'], $range['to']
));
if ($result === null) {
    fail('مشتری پیدا نشد', 404);
}
out($result);
