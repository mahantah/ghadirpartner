<?php
declare(strict_types=1);

$staffMessageRoutes = ['/api/portal-messages/recipients', '/api/portal-messages', '/api/portal-messages/sms'];
$customerMessageRoutes = ['/api/notifications/staff', '/api/notifications/staff/read'];
if (!in_array($p, $staffMessageRoutes, true) && !in_array($p, $customerMessageRoutes, true)) {
    return;
}
$staffRequest = in_array($p, $staffMessageRoutes, true);
$root = $staffRequest ? dirname(__DIR__) : dirname(__DIR__, 2);
require_once $root.'/lib/portal-messages.php';
$actor = auth($staffRequest ? ['admin'] : ['customer']);
$policy = json_decode((string) file_get_contents($root.'/config/portal-messages.yaml'), true, 512, JSON_THROW_ON_ERROR);
$messages = new GpPortalMessages($policy);
header('Cache-Control: no-store');

if (!$staffRequest) {
    $customerId = (int) ($actor['customer_id'] ?? 0);
    if ($customerId < 1 || !is_customer_user($actor) || in_array('admin', $actor['roles'] ?? [], true)) {
        fail('دسترسی به صندوق پیام مشتری مجاز نیست.', 403);
    }
    if ($p === '/api/notifications/staff' && $m === 'GET') {
        out(db(false, static fn (array $state): array => ['items' => $messages->inbox($state, $customerId)]));
    }
    if ($p === '/api/notifications/staff/read' && $m === 'POST') {
        $ids = input()['ids'] ?? null;
        if (!is_array($ids)) {
            fail('شناسه‌های پیام معتبر نیستند.', 422);
        }
        db(true, static function (array &$state) use ($messages, $customerId, $ids): void {
            $messages->markRead($state, $customerId, $ids, now());
        });
        out(['ok' => true]);
    }
    fail('روش درخواست مجاز نیست.', 405);
}

if ($p === '/api/portal-messages/recipients' && $m === 'GET') {
    out(db(false, static fn (array $state): array => array_values(
        $messages->recipients($state, 'is_customer_user', 'clean_mobile')
    )));
}
if ($p === '/api/portal-messages' && $m === 'GET') {
    out(db(false, static fn (array $state): array => array_slice(array_values(array_reverse($state['portal_messages'] ?? [])), 0, 30)));
}
if ($p === '/api/portal-messages' && $m === 'POST') {
    $payload = input();
    try {
        $created = db(true, static fn (array &$state): array => $messages->create(
            $state, $payload, $messages->recipients($state, 'is_customer_user', 'clean_mobile'), (int) $actor['id'], now()
        ));
    } catch (InvalidArgumentException $error) {
        fail($error->getMessage(), 422);
    }
    out($created, 201);
}
if ($p === '/api/portal-messages/sms' && $m === 'POST') {
    $payload = input();
    $id = $payload['id'] ?? null;
    $customerId = $payload['customer_id'] ?? null;
    if (!is_string($id) || !preg_match('/^[a-f0-9]{32}$/D', $id) || !is_int($customerId) || $customerId < 1) {
        fail('شناسهٔ پیام یا گیرنده معتبر نیست.', 422);
    }
    $target = db(true, static fn (array &$state): ?array => $messages->claim($state, $id, $customerId));
    if ($target === null) {
        out(['ok' => true]);
    }
    $accepted = false;
    try {
        $accepted = !empty(sms_send_mobile($target['mobile'], $target['body'], ['kind' => 'portal_message'])['sent']);
    } finally {
        db(true, static function (array &$state) use ($messages, $id, $customerId, $accepted): void {
            $messages->finish($state, $id, $customerId, $accepted);
        });
    }
    out(['ok' => $accepted]);
}
fail('روش درخواست مجاز نیست.', 405);
