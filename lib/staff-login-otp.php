<?php
declare(strict_types=1);
/* GHADIR_STAFF_LOGIN_OTP_V1_20261016
 * Separate sign-in OTP flow. Never reuse the password-reset OTP endpoint:
 * password reset mutates password_hash; this endpoint only creates a session.
 * No schema migration: OTP records are in the existing canonical MySQL state.
 */
function ghadir_staff_otp_user(array $state, string $identity): ?array {
    $mobile = clean_mobile($identity);
    $matches = [];
    foreach ($state['users'] ?? [] as $u) {
        if (empty($u['active']) || !user_has_staff_role($u)) continue;
        $nameMatches = strcasecmp((string)($u['username'] ?? ''), $identity) === 0;
        $phoneMatches = preg_match('/^09\d{9}$/', $mobile)
            && clean_mobile($u['mobile'] ?? '') === $mobile;
        if ($nameMatches || $phoneMatches) $matches[(int)($u['id'] ?? 0)] = $u;
    }
    // No silent selection of another user's account on mobile-number conflicts.
    return count($matches) === 1 ? reset($matches) : null;
}
function ghadir_staff_login_otp_route(string $path, string $method): void {
    if ($method !== 'POST' || !in_array($path, ['/api/staff-login-otp/request', '/api/staff-login-otp/verify'], true)) return;
    header('Cache-Control: no-store, max-age=0');
    if (!empty($_SESSION['staff_otp_block_until']) && $_SESSION['staff_otp_block_until'] > time()) {
        fail('تلاش بیش از حد مجاز؛ چند دقیقه دیگر دوباره امتحان کنید', 429);
    }
    $x = input();
    $identity = trim((string)($x['identity'] ?? ''));
    if ($identity === '' || strlen($identity) > 100) fail('نام کاربری یا شماره موبایل معتبر وارد کنید', 400);
    if ($path === '/api/staff-login-otp/request') {
        // Throttle even unknown identities in the current session.
        if ((int)($_SESSION['staff_otp_last_request'] ?? 0) + 30 > time()) fail('برای دریافت کد جدید کمی صبر کنید', 429);
        $_SESSION['staff_otp_last_request'] = time();
        unset($_SESSION['staff_otp_request_id']);
        $code = (string)random_int(100000, 999999);
        $tag = hash('sha256', session_id());
        $created = db(true, function (&$s) use ($identity, $code, $tag) {
            $u = ghadir_staff_otp_user($s, $identity);
            if (!$u) return null;
            $mobile = clean_mobile($u['mobile'] ?? '');
            if (!preg_match('/^09\d{9}$/', $mobile)) return null;
            $uid = (int)$u['id'];
            if (!isset($s['staff_login_otp_requests']) || !is_array($s['staff_login_otp_requests'])) $s['staff_login_otp_requests'] = [];
            foreach (array_reverse($s['staff_login_otp_requests']) as $r) {
                if ((int)($r['user_id'] ?? 0) !== $uid) continue;
                if (($r['status'] ?? '') === 'sent' && strtotime((string)($r['created_at'] ?? '')) > time() - 60) return null;
                break;
            }
            $s['staff_login_otp_requests'] = array_values(array_filter(
                $s['staff_login_otp_requests'],
                static fn($r) => strtotime((string)($r['created_at'] ?? '')) > time() - 86400
            ));
            if (count($s['staff_login_otp_requests']) > 2000) $s['staff_login_otp_requests'] = array_slice($s['staff_login_otp_requests'], -2000);
            $id = (int)($s['next_staff_login_otp'] ?? 1);
            $s['next_staff_login_otp'] = $id + 1;
            $s['staff_login_otp_requests'][] = [
                'id' => $id, 'user_id' => $uid, 'session_tag' => $tag,
                'otp_hash' => password_hash($code, PASSWORD_DEFAULT),
                'status' => 'pending', 'attempts' => 0,
                'expires_at' => date('Y-m-d H:i:s', time() + 300), 'created_at' => now()
            ];
            return ['id' => $id, 'mobile' => $mobile];
        });
        // A uniform response for unknown users, inactive users and accounts with no mobile.
        $generic = ['ok' => true, 'message' => 'اگر حساب فعال و شماره موبایل ثبت‌شده باشد، کد ورود ارسال می‌شود.'];
        if (!$created) out($generic);
        $send = sms_send_mobile($created['mobile'], 'کد ورود به اتوماسیون قدیر پارتنر: ' . $code . ' — اعتبار ۵ دقیقه',
            ['kind' => 'staff_login_otp', 'vars' => ['otp' => $code]]);
        $sent = !empty($send['sent']);
        db(true, function (&$s) use ($created, $sent) {
            foreach ($s['staff_login_otp_requests'] ?? [] as &$r) {
                if ((int)($r['id'] ?? 0) !== $created['id']) continue;
                $r['status'] = $sent ? 'sent' : 'sms_failed';
                if (!$sent) unset($r['otp_hash']);
                break;
            }
            unset($r);
        });
        if ($sent) $_SESSION['staff_otp_request_id'] = $created['id'];
        out($generic);
    }
    $otp = trim((string)($x['otp'] ?? ''));
    if (!preg_match('/^[0-9]{6}$/', $otp)) fail('کد شش‌رقمی معتبر وارد کنید', 400);
    $requestId = (int)($_SESSION['staff_otp_request_id'] ?? 0);
    if ($requestId < 1) fail('ابتدا کد ورود دریافت کنید', 400);
    $tag = hash('sha256', session_id());
    $result = db(true, function (&$s) use ($identity, $otp, $tag, $requestId) {
        $u = ghadir_staff_otp_user($s, $identity);
        if (!$u) return ['status' => 'invalid'];
        foreach ($s['staff_login_otp_requests'] ?? [] as &$r) {
            if ((int)($r['id'] ?? 0) !== $requestId || (int)($r['user_id'] ?? 0) !== (int)$u['id']) continue;
            if (!hash_equals((string)($r['session_tag'] ?? ''), $tag) || ($r['status'] ?? '') !== 'sent') return ['status' => 'invalid'];
            if (strtotime((string)($r['expires_at'] ?? '')) < time()) {
                $r['status'] = 'expired'; unset($r['otp_hash']); return ['status' => 'expired'];
            }
            if ((int)($r['attempts'] ?? 0) >= 5) {
                $r['status'] = 'locked'; unset($r['otp_hash']); return ['status' => 'locked'];
            }
            ++$r['attempts'];
            if (!password_verify($otp, (string)($r['otp_hash'] ?? ''))) {
                if ($r['attempts'] >= 5) { $r['status'] = 'locked'; unset($r['otp_hash']); }
                return ['status' => 'invalid'];
            }
            $r['status'] = 'used'; $r['used_at'] = now(); unset($r['otp_hash']);
            return ['status' => 'ok', 'uid' => (int)$u['id']];
        }
        unset($r);
        return ['status' => 'invalid'];
    });
    if (($result['status'] ?? '') !== 'ok') {
        $_SESSION['staff_otp_failed'] = (int)($_SESSION['staff_otp_failed'] ?? 0) + 1;
        if ($_SESSION['staff_otp_failed'] >= 5) $_SESSION['staff_otp_block_until'] = time() + 300;
        fail('کد نامعتبر یا منقضی شده است؛ در صورت نیاز کد جدید بگیرید', 400);
    }
    unset($_SESSION['staff_otp_request_id'], $_SESSION['staff_otp_failed'], $_SESSION['staff_otp_block_until'], $_SESSION['login_failures'], $_SESSION['login_block_until']);
    session_regenerate_id(true);
    $_SESSION['uid'] = $result['uid'];
    out(['ok' => true]);
}