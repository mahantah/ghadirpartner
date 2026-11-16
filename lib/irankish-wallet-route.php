<?php
declare(strict_types=1);

if (!in_array($p, ['/api/wallet/irankish', '/api/wallet/irankish/callback'], true)) return;

require_once __DIR__.'/irankish-wallet.php';
header('Cache-Control: no-store');
$walletCallback = $p === '/api/wallet/irankish/callback';
if ($walletCallback && $m !== 'POST') fail('روش درخواست مجاز نیست.', 405);
if (!$walletCallback && !in_array($m, ['GET', 'POST'], true)) fail('روش درخواست مجاز نیست.', 405);
$walletCustomerId = 0;
if (!$walletCallback) {
    $walletUser = auth();
    if (!is_customer_user($walletUser) || user_has_staff_role($walletUser)
        || ($walletCustomerId = (int) ($walletUser['customer_id'] ?? 0)) < 1) fail('دسترسی مجاز نیست.', 403);
}

try {
    $walletClient = GpIranKishWalletClient::configured(dirname(__DIR__).'/config/irankish-wallet.yaml');
    if ($walletClient === null) {
        if (!$walletCallback && $m === 'GET') out(['enabled' => false]);
        fail('شارژ آنلاین فعال نیست.', 503);
    }
    $walletGateway = new GpIranKishWallet($walletClient, Closure::fromCallable('db'));
    if ($walletCallback) {
        $walletId = $_POST['requestId'] ?? $_POST['RequestId'] ?? '';
        $walletToken = $_POST['token'] ?? '';
        if (is_string($walletId) && preg_match('/^[a-f0-9]{20}$/D', $walletId) && is_string($walletToken)) {
            $walletGateway->reconcile($walletId, 0, $walletToken, now());
        }
        header('Location: /partners/?wallet=return#gpIranKishWallet', true, 303);
        exit;
    }
    if ($m === 'GET') out(['enabled' => true] + $walletGateway->report($walletCustomerId));
    if (strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '', 2)[0])) !== 'application/json') {
        fail('فرمت درخواست معتبر نیست.', 415);
    }
    $walletInput = input();
    $walletAction = $walletInput['action'] ?? null;
    if ($walletAction === 'start' && is_int($walletInput['amount'] ?? null)) {
        out($walletGateway->start($walletCustomerId, $walletInput['amount'], now()));
    }
    if ($walletAction === 'recheck' && is_string($walletInput['id'] ?? null) && preg_match('/^[a-f0-9]{20}$/D', $walletInput['id'])) {
        out(['credited' => $walletGateway->reconcile($walletInput['id'], $walletCustomerId, '', now())]);
    }
    fail('درخواست شارژ معتبر نیست.', 422);
} catch (DomainException $error) {
    fail($error->getMessage(), $error->getCode());
} catch (Throwable $error) {
    if ($walletCallback) {
        header('Location: /partners/?wallet=return#gpIranKishWallet', true, 303);
        exit;
    }
    fail('پاسخ ایران‌کیش دریافت نشد. وضعیت پرداخت را دوباره بررسی کنید.', 502);
}
