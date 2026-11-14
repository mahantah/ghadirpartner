<?php
declare(strict_types=1);

/** Maintain enrollment challenges separately from sign-in and recovery. */
final class GpPortalMembership
{
    /** @var array<string, int|string> */
    private array $policy;

    /** Load and validate the public challenge policy. */
    public function __construct(string $path)
    {
        $raw = file_get_contents($path);
        $config = json_decode($raw === false ? '' : $raw, true, 512, JSON_THROW_ON_ERROR);
        foreach (['valid_seconds', 'resend_seconds', 'max_attempts', 'max_requests_per_ip', 'max_active'] as $key) {
            if (!isset($config[$key]) || !is_int($config[$key]) || $config[$key] < 1) {
                throw new RuntimeException('Invalid enrollment policy.');
            }
        }
        if ($config['resend_seconds'] >= $config['valid_seconds'] ||
            !is_string($config['sms_endpoint'] ?? null) ||
            parse_url($config['sms_endpoint'], PHP_URL_SCHEME) !== 'https') {
            throw new RuntimeException('Invalid enrollment cooldown.');
        }
        $this->policy = $config;
    }

    /** Reserve a challenge before contacting the SMS provider. */
    public function issue(array &$state, string $mobile, string $client, string $code, int $now): bool
    {
        $rows = array_filter($state['portal_membership_codes'] ?? [], static fn (array $row): bool => $row['expires'] > $now);
        $recent = 0;
        foreach ($rows as $row) {
            if ($row['mobile'] === $mobile && $row['issued'] + $this->policy['resend_seconds'] > $now) {
                return false;
            }
            if ($row['client'] === $client) {
                $recent++;
            }
        }
        if ($recent >= $this->policy['max_requests_per_ip'] || count($rows) >= $this->policy['max_active']) {
            return false;
        }
        $rows[] = [
            'mobile' => $mobile, 'client' => $client, 'hash' => password_hash($code, PASSWORD_DEFAULT),
            'issued' => $now, 'expires' => $now + $this->policy['valid_seconds'], 'attempts' => 0, 'used' => false,
        ];
        $state['portal_membership_codes'] = array_values($rows);
        return true;
    }

    /** Consume the newest code once and commit failed attempts with the surrounding write. */
    public function verify(array &$state, string $mobile, string $code, int $now): bool
    {
        $rows = &$state['portal_membership_codes'];
        if (!is_array($rows)) {
            return false;
        }
        for ($index = count($rows) - 1; $index >= 0; $index--) {
            $row = &$rows[$index];
            if ($row['mobile'] !== $mobile) {
                continue;
            }
            if ($row['used'] || $row['expires'] <= $now || $row['attempts'] >= $this->policy['max_attempts']) {
                return false;
            }
            $row['attempts']++;
            if (!password_verify($code, $row['hash'])) {
                return false;
            }
            $row['used'] = true;
            unset($row['hash']);
            return true;
        }
        return false;
    }

    /** Return the retry delay advertised to the client. */
    public function retryAfter(): int
    {
        return (int) $this->policy['resend_seconds'];
    }

    /** Return the default endpoint shared with the installed SMS transport. */
    public function smsEndpoint(): string
    {
        return (string) $this->policy['sms_endpoint'];
    }

    /** Validate the checksum before a manager reviews the applicant's identity. */
    public static function validNationalId(string $value): bool
    {
        if (!preg_match('/^[0-9]{10}$/D', $value) || preg_match('/^(\d)\1{9}$/D', $value)) {
            return false;
        }
        $sum = 0;
        for ($index = 0; $index < 9; $index++) {
            $sum += (int) $value[$index] * (10 - $index);
        }
        $remainder = $sum % 11;
        return (int) $value[9] === ($remainder < 2 ? $remainder : 11 - $remainder);
    }
}
