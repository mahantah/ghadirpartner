<?php
declare(strict_types=1);

if ($m !== 'POST' || !in_array($p, ['/api/native/membership/code', '/api/native/membership/register'], true)) {
    return;
}

require_once dirname(__DIR__, 2).'/lib/portal-membership.php';
header('Cache-Control: no-store');
$membership = new GpPortalMembership(dirname(__DIR__, 2).'/config/portal-membership.yaml');
$payload = input();
$mobile = $payload['mobile'] ?? '';
if (!is_string($mobile) || !preg_match('/^09[0-9]{9}$/D', $mobile)) {
    fail('شماره همراه معتبر وارد کنید.', 422);
}

if ($p === '/api/native/membership/code') {
    $token = trim((string) ($cfg['homa_api_token'] ?? ''));
    $endpoint = trim((string) ($cfg['homa_api_endpoint'] ?? $membership->smsEndpoint()));
    if ($token === '' || $endpoint === '' || !function_exists('curl_init')) {
        fail('سرویس پیامک عضویت در دسترس نیست.', 503);
    }
    $sender = trim((string) ($cfg['homa_sender_id'] ?? $cfg['homa_sender_number'] ?? ''));
    $code = (string) random_int(100000, 999999);
    $client = hash('sha256', (string) ($_SERVER['REMOTE_ADDR'] ?? ''));
    $issued = db(true, static fn (array &$state): bool => $membership->issue($state, $mobile, $client, $code, time()));
    if (!$issued) {
        fail('برای دریافت کد جدید کمی صبر کنید.', 429);
    }
    // Use the configured transport without recording the enrollment code in the SMS outbox.
    $send = homa_token_send($endpoint, $token, $mobile, 'کد تأیید عضویت قدیر پارتنر: '.$code, $sender);
    if (empty($send['meta']['ok'])) {
        fail('ارسال کد عضویت انجام نشد. کمی بعد دوباره تلاش کنید.', 503);
    }
    out(['ok' => true, 'retry_after' => $membership->retryAfter()]);
}

$code = $payload['otp'] ?? '';
$password = $payload['password'] ?? '';
$name = $payload['name'] ?? '';
$details = [];
foreach (['company', 'city', 'address'] as $key) {
    $value = $payload[$key] ?? '';
    if (!is_string($value) || strlen($value) > 500) {
        fail('اطلاعات عضویت معتبر نیست.', 422);
    }
    $details[$key] = trim($value);
}
if (!is_string($code) || !preg_match('/^[0-9]{6}$/D', $code) ||
    !is_string($password) || strlen($password) < 8 || strlen($password) > 72 || strpos($password, "\0") !== false ||
    !is_string($name) || strlen(trim($name)) < 3 || strlen($name) > 200) {
    fail('نام، کد تأیید و رمز ورود معتبر وارد کنید.', 422);
}
$status = db(true, static function (array &$state) use ($membership, $mobile, $code, $password, $name, $details): string {
    if (!$membership->verify($state, $mobile, $code, time())) {
        return 'invalid_code';
    }
    if (mobile_identity_in_use($state, $mobile)) {
        return 'existing';
    }
    foreach ($state['registration_requests'] ?? [] as $request) {
        if (clean_mobile($request['mobile'] ?? '') === $mobile && ($request['status'] ?? 'pending') === 'pending') {
            return 'pending';
        }
    }
    $state['registration_requests'][] = $details + [
        'id' => $state['next_registration']++, 'name' => trim($name), 'mobile' => $mobile,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT), 'mobile_verified_at' => now(),
        'status' => 'pending', 'created_at' => now(), 'reviewed_at' => '', 'reviewed_by' => '',
    ];
    return 'created';
});
if ($status === 'invalid_code') {
    fail('کد تأیید اشتباه است یا اعتبار آن تمام شده است.', 422);
}
if ($status === 'existing') {
    fail('این شماره به یک حساب متصل است. از صفحهٔ ورود استفاده کنید.', 409);
}
if ($status === 'pending') {
    out(['ok' => true, 'status' => 'pending']);
}
out(['ok' => true, 'status' => 'pending'], 201);
