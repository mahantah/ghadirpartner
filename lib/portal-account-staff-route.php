<?php
declare(strict_types=1);

if ($p !== '/api/customer-accounts/access') return;
if ($m !== 'GET') fail('روش درخواست مجاز نیست.', 405);
auth(['admin']);
header('Cache-Control: no-store');
require_once __DIR__.'/portal-account.php';

$customerId = filter_var($_GET['customer_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
if ($customerId === false) fail('شناسه مشتری معتبر نیست.', 422);
$accounts = new GpPortalAccount();
$profile = db(false, static function (array $state) use ($accounts, $customerId): ?array {
    foreach ($state['customers'] ?? [] as $customer) {
        if ((int) $customer['id'] !== $customerId || !empty($customer['deleted'])) continue;
        return ['bank' => $accounts->bank($state, $customerId), 'users' => $accounts->delegates($state, $customerId)];
    }
    return null;
});
if ($profile === null) fail('مشتری پیدا نشد.', 404);
out($profile);
