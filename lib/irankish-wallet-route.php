<?php
declare(strict_types=1);

if (!in_array($p, ['/api/wallet/irankish', '/api/wallet/irankish/callback', '/api/orders/irankish', '/api/orders/irankish/launch', '/api/orders/irankish/result'], true)) return;

require_once __DIR__.'/irankish-wallet.php';
header('Cache-Control: no-store');
$walletCallback = $p === '/api/wallet/irankish/callback';
$orderPayment = $p === '/api/orders/irankish';
$orderLaunch = $p === '/api/orders/irankish/launch';
$orderReturn = $p === '/api/orders/irankish/result';
if ($orderLaunch && $m !== 'GET') fail('روش درخواست مجاز نیست.', 405);
if ($orderReturn && $m !== 'GET') fail('روش درخواست مجاز نیست.', 405);
if ($walletCallback && !in_array($m, ['POST', 'GET'], true)) fail('روش درخواست مجاز نیست.', 405);
if (!$walletCallback && !in_array($m, ['GET', 'POST'], true)) fail('روش درخواست مجاز نیست.', 405);
$walletCustomerId = 0;
if (!$walletCallback && !$orderLaunch && !$orderReturn) {
    $walletUser = auth();
    if (!is_customer_user($walletUser) || user_has_staff_role($walletUser)
        || ($walletCustomerId = (int) ($walletUser['customer_id'] ?? 0)) < 1) fail('دسترسی مجاز نیست.', 403);
}

if ($walletCallback || $orderReturn || $orderLaunch) session_write_close();

try {
    $walletClient = GpIranKishWalletClient::configured(dirname(__DIR__).'/config/irankish-wallet.yaml');
    if ($walletClient === null) {
        if (!$walletCallback && !$orderLaunch && !$orderReturn && $m === 'GET') out(['enabled' => false]);
        fail($orderPayment || $orderLaunch ? 'پرداخت آنلاین سفارش فعال نیست.' : 'شارژ آنلاین فعال نیست.', 503);
    }
    $walletGateway = new GpIranKishWallet($walletClient, Closure::fromCallable('db'));
    if ($orderLaunch) {
        $checkoutId = $_GET['id'] ?? '';
        $checkout = is_string($checkoutId) && preg_match('/^[a-f0-9]{20}$/D', $checkoutId)
            ? $walletGateway->orderLaunch($checkoutId) : null;
        if ($checkout === null) fail('لینک پرداخت معتبر نیست. از داخل سفارش دوباره تلاش کنید.', 404);
        $target = htmlspecialchars($checkout['url'], ENT_QUOTES, 'UTF-8');
        $bankToken = htmlspecialchars($checkout['token'], ENT_QUOTES, 'UTF-8');
        header('Content-Type: text/html; charset=utf-8');
        header('Referrer-Policy: no-referrer');
        $nonce = bin2hex(random_bytes(16));
        header("Content-Security-Policy: script-src 'nonce-$nonce'; default-src 'none'; form-action https://ikc.shaparak.ir; frame-ancestors 'none'; base-uri 'none'");
        echo '<!doctype html><html lang="fa" dir="rtl"><title>پرداخت سفارش</title>'
            .'<meta name="viewport" content="width=device-width, initial-scale=1">'
            .'<main><h1>پرداخت سفارش قدیر پارتنر</h1><form method="post" action="'.$target.'">'
            .'<input type="hidden" name="tokenIdentity" value="'.$bankToken.'">'
            .'<button type="submit">ورود به درگاه ایران‌کیش</button></form></main>'
            .'<script nonce="'.$nonce.'">document.forms[0].submit()</script></html>';
        exit;
    }
    if ($orderReturn) {
        $id = $_GET['id'] ?? null;
        $verified = GpIranKishCheckout::validId($id) && $walletGateway->returnFromOrderBank($id, now());
        header('Content-Type: text/html; charset=utf-8');
        header('Referrer-Policy: no-referrer');
        header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
        $message = $verified ? 'پرداخت تأیید شد.' : 'پرداخت هنوز تأیید نشده است.';
        echo '<!doctype html><html lang="fa" dir="rtl"><title>نتیجه پرداخت قدیر پارتنر</title>'
            .'<meta name="viewport" content="width=device-width, initial-scale=1">'
            .'<main><h1>'.$message.'</h1><p><a href="ghadirpartner://checkout/return">بازگشت به اپ قدیر پارتنر</a></p>'
            .'<p><a href="/partners/">ورود به سایت قدیر پارتنر</a></p></main></html>';
        exit;
    }
    if ($walletCallback) {
        $bankReturn = array_change_key_case($_POST + $_GET, CASE_LOWER);
        $walletId = $bankReturn['requestid'] ?? '';
        $walletToken = $bankReturn['tokenidentity'] ?? $bankReturn['token'] ?? '';
        if (GpIranKishCheckout::validId($walletId) && $walletGateway->isOrderAttempt($walletId)) {
            header('Location: /partners/api/orders/irankish/result?id='.$walletId, true, 303);
            exit;
        }
        if (GpIranKishCheckout::validId($walletId) && is_string($walletToken)) {
            $walletGateway->reconcile($walletId, 0, $walletToken, now());
        }
        header('Location: /partners/?wallet=return#gpIranKishWallet', true, 303);
        exit;
    }
    if ($m === 'GET') {
        if ($orderPayment) out(['enabled' => true]);
        out(['enabled' => true] + $walletGateway->report($walletCustomerId));
    }
    if (strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '', 2)[0])) !== 'application/json') {
        fail('فرمت درخواست معتبر نیست.', 415);
    }
    $walletInput = input();
    $walletAction = $walletInput['action'] ?? null;
    if ($orderPayment) {
        if (in_array($walletAction, ['recheck_checkout', 'return_checkout_to_wallet'], true)) {
            $id = $walletInput['checkout_id'] ?? null;
            if (!GpIranKishCheckout::validId($id)) fail('شناسه پرداخت معتبر نیست.', 422);
            if ($walletAction === 'recheck_checkout') out($walletGateway->recheckCheckout($walletCustomerId, $id, now()));
            $returned = $walletGateway->returnCheckoutToWallet($walletCustomerId, $id, now());
            if (isset($returned['error'])) throw $returned['error'];
            out($returned);
        }
        $orderId = $walletInput['order_id'] ?? null;
        if (!is_int($orderId) || $orderId < 1) fail('شماره سفارش معتبر نیست.', 422);
        if ($walletAction === 'start') out($walletGateway->startOrder($walletCustomerId, $orderId, now()));
        if ($walletAction === 'recheck') out($walletGateway->recheckOrder($walletCustomerId, $orderId, now()));
        fail('عملیات پرداخت معتبر نیست.', 422);
    }
    if ($walletAction === 'start' && is_int($walletInput['amount'] ?? null)) {
        out($walletGateway->start($walletCustomerId, $walletInput['amount'], now()));
    }
    if ($walletAction === 'recheck' && is_string($walletInput['id'] ?? null) && preg_match('/^[a-f0-9]{20}$/D', $walletInput['id'])) {
        out(['credited' => !$walletGateway->isOrderAttempt($walletInput['id'])
            && $walletGateway->reconcile($walletInput['id'], $walletCustomerId, '', now())]);
    }
    fail('درخواست شارژ معتبر نیست.', 422);
} catch (DomainException $error) {
    fail($error->getMessage(), $error->getCode());
} catch (Throwable $error) {
    if ($orderReturn) {
        header('Location: /partners/api/orders/irankish/result', true, 303);
        exit;
    }
    if ($walletCallback) {
        header('Location: /partners/?wallet=return#gpIranKishWallet', true, 303);
        exit;
    }
    fail('پاسخ ایران‌کیش دریافت نشد. وضعیت پرداخت را دوباره بررسی کنید.', 502);
}
