<?php
declare(strict_types=1);

/** Store staff messages and delivery state for each selected customer. */
final class GpPortalMessages
{
    private array $policy;

    /** Validate the configured message and audience limits. */
    public function __construct(array $policy)
    {
        foreach (['max_recipients', 'max_title_bytes', 'max_body_bytes'] as $key) {
            if (!is_int($policy[$key] ?? null) || $policy[$key] < 1) {
                throw new RuntimeException('Invalid message policy.');
            }
        }
        $this->policy = $policy;
    }

    /** Return active customer accounts eligible for a new message. */
    public function recipients(array $state, callable $isCustomer, callable $normalizeMobile): array
    {
        $accounts = [];
        foreach ($state['users'] ?? [] as $user) {
            if (!empty($user['active']) && $isCustomer($user)) {
                $accounts[(int) ($user['customer_id'] ?? 0)] = true;
            }
        }
        $result = [];
        foreach ($state['customers'] ?? [] as $customer) {
            $id = (int) $customer['id'];
            if ($id < 1 || !isset($accounts[$id]) || !empty($customer['deleted']) || ($customer['active'] ?? true) === false) {
                continue;
            }
            $mobile = $normalizeMobile($customer['mobile'] ?? '');
            $result[$id] = [
                'id' => $id, 'name' => (string) ($customer['name'] ?? ''),
                'mobile' => preg_match('/^09[0-9]{9}$/D', $mobile) ? $mobile : '',
            ];
        }
        return $result;
    }

    /** Record the exact audience once and queue SMS delivery independently. */
    public function create(array &$state, array $input, array $audience, int $actor, string $now): array
    {
        $id = $input['id'] ?? null;
        $title = is_string($input['title'] ?? null) ? trim($input['title']) : '';
        $body = is_string($input['body'] ?? null) ? trim($input['body']) : '';
        $ids = $input['recipients'] ?? null;
        $app = ($input['app'] ?? null) === true;
        $sms = ($input['sms'] ?? null) === true;
        if (!is_string($id) || !preg_match('/^[a-f0-9]{32}$/D', $id) ||
            $title === '' || strlen($title) > $this->policy['max_title_bytes'] ||
            $body === '' || strlen($body) > $this->policy['max_body_bytes'] ||
            !is_array($ids) || !$ids || count($ids) > $this->policy['max_recipients'] || (!$app && !$sms)) {
            throw new InvalidArgumentException('عنوان، متن، مسیر ارسال و تعداد گیرندگان را بررسی کنید.');
        }
        $targets = [];
        foreach ($ids as $recipient) {
            if (!is_int($recipient) || !isset($audience[$recipient])) {
                throw new InvalidArgumentException('یکی از گیرنده‌ها حساب فعال ندارد.');
            }
            $customer = $audience[$recipient];
            $targets[$recipient] = $customer + [
                'read_at' => null, 'sms' => !$sms ? 'off' : ($customer['mobile'] === '' ? 'unavailable' : 'queued'),
            ];
        }
        $existing = $state['portal_messages'][$id] ?? null;
        if ($existing !== null) {
            if ($existing['actor'] !== $actor || $existing['title'] !== $title || $existing['body'] !== $body ||
                $existing['app'] !== $app || $existing['sms'] !== $sms ||
                array_keys($existing['targets']) !== array_keys($targets)) {
                throw new InvalidArgumentException('شناسهٔ ارسال قبلاً استفاده شده است.');
            }
            return $existing;
        }
        return $state['portal_messages'][$id] = [
            'id' => $id, 'actor' => $actor, 'title' => $title, 'body' => $body,
            'created_at' => $now, 'app' => $app, 'sms' => $sms, 'targets' => $targets,
        ];
    }

    /** Claim a queued SMS before calling the provider to prevent duplicate sends. */
    public function claim(array &$state, string $id, int $customerId): ?array
    {
        if (($state['portal_messages'][$id]['targets'][$customerId]['sms'] ?? '') !== 'queued') {
            return null;
        }
        $state['portal_messages'][$id]['targets'][$customerId]['sms'] = 'sending';
        $message = $state['portal_messages'][$id];
        return ['mobile' => $message['targets'][$customerId]['mobile'], 'body' => $message['title']."\n".$message['body']];
    }

    /** Finalize a previously claimed SMS with the provider result. */
    public function finish(array &$state, string $id, int $customerId, bool $accepted): void
    {
        if (($state['portal_messages'][$id]['targets'][$customerId]['sms'] ?? '') === 'sending') {
            $state['portal_messages'][$id]['targets'][$customerId]['sms'] = $accepted ? 'accepted' : 'failed';
        }
    }

    /** Project only messages addressed to the authenticated customer. */
    public function inbox(array $state, int $customerId): array
    {
        $items = [];
        foreach (array_reverse($state['portal_messages'] ?? []) as $message) {
            if ($message['app'] && isset($message['targets'][$customerId])) {
                $items[] = [
                    'id' => 'staff:'.$message['id'], 'kind' => 'staff', 'title' => $message['title'],
                    'body' => $message['body'], 'created_at' => $message['created_at'],
                    'read' => $message['targets'][$customerId]['read_at'] !== null,
                ];
            }
        }
        return $items;
    }

    /** Mark only messages belonging to this customer as read. */
    public function markRead(array &$state, int $customerId, array $ids, string $now): void
    {
        foreach ($ids as $value) {
            if (!is_string($value) || !preg_match('/^staff:([a-f0-9]{32})$/D', $value, $match)) {
                continue;
            }
            $id = $match[1];
            if (!empty($state['portal_messages'][$id]['app']) && isset($state['portal_messages'][$id]['targets'][$customerId])) {
                $state['portal_messages'][$id]['targets'][$customerId]['read_at'] ??= $now;
            }
        }
    }
}
