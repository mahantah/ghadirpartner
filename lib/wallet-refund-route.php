<?php
declare(strict_types=1);

if ($p !== '/api/wallet/refunds') return;
$actor = auth(['customer']);
if (!is_customer_user($actor) || user_has_staff_role($actor) || (int) ($actor['customer_id'] ?? 0) < 1) {
    fail('دسترسی مجاز نیست.', 403);
}
if (!in_array($m, ['GET', 'POST'], true)) fail('روش درخواست مجاز نیست.', 405);
header('Cache-Control: no-store');
require_once __DIR__.'/order-wallet.php';
require_once __DIR__.'/portal-account.php';
$wallet = new GpOrderWallet();
$customerId = (int) $actor['customer_id'];
if (!empty($actor['portal_delegate_owner'])) fail('فقط صاحب حساب می‌تواند درخواست عودت ثبت کند.', 403);
if ($m === 'GET') {
    out(db(false, static fn (array $state): array => $wallet->refundRequests($state, $customerId)));
    return;
}
$contentType = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '', 2)[0]));
if ($contentType !== 'application/json') fail('فرمت درخواست معتبر نیست.', 415);
$request = input();
if (!is_array($request)) fail('درخواست معتبر نیست.', 422);
$policy = json_decode((string) file_get_contents(dirname(__DIR__).'/config/order-followup.yaml'), true, 512, JSON_THROW_ON_ERROR);
out(db(true, static function (array &$state) use ($wallet, $actor, $request, $policy): array {
    try {
        $accounts = new GpPortalAccount();
        $customerId = $accounts->ownerId($state, (int) $actor['id']);
        return $wallet->requestRefund($state, $customerId, $request, now(), $policy);
    } catch (DomainException $error) {
        fail($error->getMessage(), $error->getCode());
    }
}));
