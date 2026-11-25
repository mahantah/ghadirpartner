<?php
declare(strict_types=1);

if (!in_array($p, ['/api/native/account-access', '/api/native/account-bank', '/api/native/account-users', '/api/native/account-users/code', '/api/native/account-users/revoke'], true)) return;
if (!in_array($m, ['GET', 'POST'], true) || ($m === 'GET' && in_array($p, ['/api/native/account-users/code', '/api/native/account-users/revoke'], true))) {
    fail('روش درخواست مجاز نیست.', 405);
}
header('Cache-Control: no-store');
require_once __DIR__.'/portal-account.php';
require_once __DIR__.'/portal-membership.php';
$actor = auth(['customer']);
if ($p === '/api/native/account-access') {
    if ($m !== 'GET') fail('روش درخواست مجاز نیست.', 405);
    out(['access_level' => empty($actor['portal_delegate_owner']) ? 'manager' : ($actor['portal_access_level'] ?? 'legacy')]);
}
$actorId = (int) $actor['id'];
$accounts = new GpPortalAccount();
$membership = new GpPortalMembership(dirname(__DIR__).'/config/portal-membership.yaml');
$scope = 'delegate:'.$actorId;
$body = $m === 'POST' ? input() : [];
if (!is_array($body)) fail('درخواست معتبر نیست.', 422);
if ($m === 'POST' && strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '', 2)[0])) !== 'application/json') {
    fail('فرمت درخواست معتبر نیست.', 415);
}

if ($p === '/api/native/account-users/code') {
    $mobile = $body['mobile'] ?? null;
    if (!is_string($mobile) || !preg_match('/^09[0-9]{9}$/D', $mobile)) fail('شماره همراه معتبر وارد کنید.', 422);
    $token = trim((string) ($cfg['homa_api_token'] ?? ''));
    $endpoint = trim((string) ($cfg['homa_api_endpoint'] ?? $membership->smsEndpoint()));
    $sender = trim((string) ($cfg['homa_sender_id'] ?? $cfg['homa_sender_number'] ?? ''));
    if ($token === '' || $endpoint === '' || !function_exists('curl_init')) fail('ارسال پیامک در دسترس نیست.', 503);
    $code = (string) random_int(100000, 999999);
    $client = hash('sha256', (string) ($_SERVER['REMOTE_ADDR'] ?? ''));
    $issued = db(true, static function (array &$state) use ($accounts, $membership, $actorId, $scope, $client, $mobile, $code): bool {
        try {
            $accounts->ownerId($state, $actorId);
            $accounts->assertAvailable($state, $mobile);
            return $membership->issue($state, $mobile, $client, $code, time(), $scope);
        } catch (DomainException $error) {
            fail($error->getMessage(), $error->getCode());
        }
    });
    if (!$issued) fail('برای دریافت کد جدید کمی صبر کنید.', 429);
    $send = homa_token_send($endpoint, $token, $mobile, 'کد تأیید دسترسی به حساب قدیر پارتنر: '.$code, $sender);
    if (empty($send['meta']['ok'])) fail('ارسال کد تأیید انجام نشد.', 503);
    out(['ok' => true, 'retry_after' => $membership->retryAfter()]);
}

$result = db($m === 'POST', static function (array &$state) use ($p, $m, $actorId, $scope, $body, $accounts, $membership): ?array {
    try {
        $customerId = $accounts->ownerId($state, $actorId);
        if ($p === '/api/native/account-bank') {
            return $m === 'GET' ? $accounts->bank($state, $customerId) : $accounts->saveBank($state, $customerId, $body);
        }
        if ($m === 'GET') return $accounts->delegates($state, $customerId);
        if ($p === '/api/native/account-users/revoke') {
            $id = $body['id'] ?? null;
            if (!is_int($id) || $id < 1) fail('کاربر معتبر نیست.', 422);
            $accounts->revoke($state, $customerId, $id);
            return ['ok' => true];
        }
        $name = $body['name'] ?? null;
        $mobile = $body['mobile'] ?? null;
        $code = $body['otp'] ?? null;
        $password = $body['password'] ?? null;
        if (!is_string($name) || strlen(trim($name)) < 3 || strlen($name) > 200) fail('نام کاربر معتبر نیست.', 422);
        if (!is_string($mobile) || !preg_match('/^09[0-9]{9}$/D', $mobile)) fail('شماره همراه معتبر نیست.', 422);
        if (!is_string($password) || strlen($password) < 8 || strlen($password) > 72 || strpos($password, "\0") !== false) fail('رمز ورود کاربر معتبر نیست.', 422);
        if (!is_string($code) || !preg_match('/^[0-9]{6}$/D', $code)) fail('کد تأیید باید ۶ رقم باشد.', 422);
        $access = $body['access_level'] ?? 'viewer';
        if (!is_string($access) || !in_array($access, ['viewer', 'sales', 'finance'], true)) fail('سطح دسترسی معتبر نیست.', 422);
        $accounts->assertAvailable($state, $mobile);
        if (!$membership->verify($state, $mobile, $code, time(), $scope)) return null;
        return $accounts->addDelegate($state, $actorId, $customerId, trim($name), $mobile, $password, $access);
    } catch (DomainException $error) {
        fail($error->getMessage(), $error->getCode());
    }
});
if ($result === null) fail('کد تأیید اشتباه است یا اعتبار آن تمام شده است.', 422);
out($result);
