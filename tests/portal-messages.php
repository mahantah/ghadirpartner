<?php
declare(strict_types=1);

require_once __DIR__.'/../lib/portal-messages.php';
require_once __DIR__.'/../lib/portal-membership.php';

$service = new GpPortalMessages(['max_recipients' => 3, 'max_title_bytes' => 30, 'max_body_bytes' => 100]);
$state = [];
$audience = [
    1 => ['id' => 1, 'name' => 'A', 'mobile' => '09910000000'],
    2 => ['id' => 2, 'name' => 'B', 'mobile' => ''],
];
$id = str_repeat('a', 32);
$payload = ['id' => $id, 'title' => 'Title', 'body' => 'Body', 'app' => true, 'sms' => true, 'recipients' => [1, 2, 2]];
$created = $service->create($state, $payload, $audience, 9, 'now');
if (count($created['targets']) !== 2 || $created['targets'][2]['sms'] !== 'unavailable' ||
    $service->inbox($state, 3) !== [] || $service->inbox($state, 1)[0]['read'] !== false ||
    $service->claim($state, $id, 1)['mobile'] !== '09910000000' ||
    $service->claim($state, $id, 1) !== null) {
    throw new RuntimeException('Message audience or delivery claim regression.');
}
$service->markRead($state, 1, ['staff:'.$id], 'now');
$service->finish($state, $id, 1, true);
$retry = $service->create($state, $payload, $audience, 9, 'later');
if (!$service->inbox($state, 1)[0]['read'] || $service->inbox($state, 2)[0]['read'] ||
    $retry['targets'][1]['sms'] !== 'accepted' || $retry['created_at'] !== 'now' ||
    !GpPortalMembership::validNationalId('0013542567') ||
    GpPortalMembership::validNationalId('0013542560') ||
    GpPortalMembership::validNationalId('1111111111')) {
    throw new RuntimeException('Read receipt, delivery retry or national ID regression.');
}
echo "Portal messaging and identity fixtures passed.\n";
