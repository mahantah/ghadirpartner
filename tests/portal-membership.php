<?php
declare(strict_types=1);

require_once __DIR__.'/../lib/portal-membership.php';

$service = new GpPortalMembership(__DIR__.'/../config/portal-membership.yaml');
$state = [];
$mobile = '09910000000';
$other = '09910000001';
$time = 1000;
if (
    !$service->issue($state, $mobile, 'first', '123456', $time) ||
    $service->issue($state, $mobile, 'second', '111111', $time + 1) ||
    $service->verify($state, $other, '123456', $time + 2) ||
    $service->verify($state, $mobile, '111111', $time + 3) ||
    !$service->verify($state, $mobile, '123456', $time + 4) ||
    $service->verify($state, $mobile, '123456', $time + 5) ||
    !$service->issue($state, $mobile, 'first', '222222', $time + 60) ||
    $service->verify($state, $mobile, '222222', $time + 360) ||
    !$service->issue($state, $mobile, 'first', '333333', $time + 361)
) {
    throw new RuntimeException('Enrollment OTP failed cooldown, ownership, expiry or replay checks.');
}
for ($attempt = 0; $attempt < 5; $attempt++) {
    if ($service->verify($state, $mobile, '444444', $time + 362)) {
        throw new RuntimeException('Enrollment OTP accepted an incorrect code.');
    }
}
if ($service->verify($state, $mobile, '333333', $time + 363)) {
    throw new RuntimeException('Enrollment OTP ignored the attempt limit.');
}
echo "Enrollment OTP fixture passed.\n";
