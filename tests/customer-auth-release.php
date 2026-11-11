<?php

declare(strict_types=1);

final class RouteReply extends RuntimeException
{
    /** @param array<string, mixed> $payload */
    public function __construct(public readonly int $status, public readonly array $payload = [])
    {
        parent::__construct();
    }
}

final class AuthFixture
{
    /** @var array<string, mixed> */
    public static array $state = [];
    /** @var array<string, string> */
    public static array $input = [];
    public static string $code = '';
    public static int $sends = 0;
    public static bool $smsAvailable = true;

    /** @param array<string, string> $payload */
    public function request(string $source, string $path, array $payload): RouteReply
    {
        self::$input = $payload;
        $p = $path;
        $m = 'POST';
        $anchor = "if(\$p==='$path'&&\$m==='POST'){";
        $offset = strpos($source, $anchor);
        self::expect($offset !== false, 'missing_route');
        $end = strpos($source, "\nif(\$p===", $offset + strlen($anchor));
        try {
            eval(substr($source, $offset, $end === false ? null : $end - $offset));
        } catch (RouteReply $reply) {
            return $reply;
        }
        throw new RuntimeException('route_did_not_respond');
    }

    public static function expect(bool $condition, string $failure): void
    {
        if (!$condition) {
            throw new RuntimeException($failure);
        }
    }

    public function run(string $router, string $native): void
    {
        $mobile = '09000000000';
        $login = '/api/native/login-otp/';
        $reset = '/api/password-reset/';
        $otpDispatcher = "if((\$m==='POST'&&in_array(\$p,['{$login}request','{$login}confirm'],true))";
        self::expect(substr_count($router, $otpDispatcher) === 1, 'missing_post_dispatcher');
        self::$state = [
            'users' => [['id' => 8, 'active' => true, 'roles' => ['customer'], 'mobile' => $mobile]],
            'customers' => [],
            'settings' => [],
            'next_password_reset' => 1,
            'password_reset_requests' => [],
        ];

        foreach (['request', 'confirm'] as $action) {
            self::expect($this->request($native, $login . $action, [])->status === 422, 'otp_input');
            self::expect($this->request($router, $reset . $action, [])->status === 400, 'reset_input');
        }
        self::expect(self::$sends === 0, 'unexpected_sms_on_invalid_input');
        self::expect($this->request($native, $login . 'request', ['mobile' => $mobile])->status === 200, 'otp_request');
        self::expect(self::$sends === 1, 'otp_send_count');
        $loginInput = ['mobile' => $mobile, 'otp' => self::$code];
        self::expect($this->request($native, $login . 'confirm', $loginInput)->status === 200, 'otp_confirmation');
        self::expect($_SESSION['uid'] === 8, 'otp_session_missing');
        self::expect($this->request($native, $login . 'confirm', $loginInput)->status === 400, 'otp_replay');

        self::$smsAvailable = false;
        self::expect($this->request($router, $reset . 'request', ['mobile' => $mobile])->status === 503, 'reset_provider_failure');
        self::expect(self::$state['password_reset_requests'][0]['status'] === 'sms_failed', 'reset_failure_not_persisted');
        self::expect(!isset(self::$state['password_reset_requests'][0]['otp_hash']), 'failed_reset_hash_kept');
        self::$smsAvailable = true;
        self::expect($this->request($router, $reset . 'request', ['mobile' => $mobile])->status === 200, 'reset_request');
        self::expect(self::$state['password_reset_requests'][1]['status'] === 'otp_sent', 'reset_send_not_persisted');
        $resetInput = ['mobile' => $mobile, 'otp' => self::$code, 'password' => 'fixture-password'];
        $wrongInput = $resetInput;
        $wrongInput['otp'] = self::$code === '123456' ? '654321' : '123456';
        self::expect($this->request($router, $reset . 'confirm', $wrongInput)->status === 400, 'reset_wrong_otp');
        self::expect(self::$state['password_reset_requests'][1]['attempts'] === 1, 'reset_attempt_not_persisted');
        self::expect($this->request($router, $reset . 'confirm', $resetInput)->status === 200, 'reset_confirmation');
        self::expect(password_verify($resetInput['password'], self::$state['users'][0]['password_hash']), 'reset_password_not_saved');
        self::expect($this->request($router, $reset . 'confirm', $resetInput)->status === 400, 'reset_replay');

        self::expect($this->request($router, $reset . 'request', ['mobile' => $mobile])->status === 200, 'reset_reissue');
        for ($attempt = 0; $attempt < 5; ++$attempt) {
            $wrongInput['otp'] = self::$code === '123456' ? '654321' : '123456';
            self::expect($this->request($router, $reset . 'confirm', $wrongInput)->status === 400, 'reset_attempt_status');
        }
        $resetInput['otp'] = self::$code;
        self::expect($this->request($router, $reset . 'confirm', $resetInput)->status === 429, 'reset_attempt_limit');
    }
}

/** @return array<string, string> */
function input(): array
{
    return AuthFixture::$input;
}

/** @param callable(array<string, mixed>&): mixed $callback */
function db(bool $write, callable $callback): mixed
{
    $working = AuthFixture::$state;
    $result = $callback($working);
    if ($write) {
        AuthFixture::$state = $working;
    }

    return $result;
}

/** @param array<string, mixed> $body */
function out(array $body): never
{
    throw new RouteReply(200, $body);
}

function fail(string $message, int $status = 400): never
{
    throw new RouteReply($status, ['message' => $message]);
}

function now(): string
{
    return date('Y-m-d H:i:s');
}

function clean_mobile(string $mobile): string
{
    return trim($mobile);
}

/** @param array<string, mixed> $user */
function is_customer_user(array $user): bool
{
    return in_array('customer', $user['roles'], true);
}

/** @param array<string, mixed> $state @param array<string, mixed> $user @return list<string> */
function user_mobile_keys(array $state, array $user): array
{
    return [$user['mobile']];
}

/** @param array<string, mixed> $state @param array<string, mixed> $user */
function customer_login_score(array $state, array $user, string $mobile): int
{
    return 1;
}

/** @param list<array<string, mixed>> $rows */
function idx(array $rows, int $id): int
{
    foreach ($rows as $index => $row) {
        if ($row['id'] === $id) {
            return $index;
        }
    }

    return -1;
}

function sms_template_enabled(string $kind): bool
{
    return true;
}

/** @param array{vars: array{otp: string}} $metadata @return array{sent: bool} */
function sms_send_mobile(string $mobile, string $message, array $metadata): array
{
    AuthFixture::$code = $metadata['vars']['otp'];
    ++AuthFixture::$sends;

    return ['sent' => AuthFixture::$smsAvailable];
}

/** @param array{sent: bool} $send */
function sms_public_failure_message(array $send): string
{
    return 'synthetic SMS provider failure';
}

session_start();
$router = file_get_contents($argv[1]);
$native = file_get_contents(dirname($argv[1]) . '/native-r54.php');
if ($router === false || $native === false) {
    throw new RuntimeException('candidate_sources_unreadable');
}
(new AuthFixture())->run($router, $native);
echo "Synthetic login OTP and password reset flows passed.\n";
