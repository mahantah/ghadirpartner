<?php
declare(strict_types=1);

// Run the real return action against a two-customer fixture with no external delivery.
$p = '/api/order-followup';
$m = 'POST';
$file = sys_get_temp_dir().'/ghadir-correction-test/state.json';
$testState = [
    'orders' => [[
        'id' => 8, 'number' => 'GHP-000008', 'customer_id' => 1,
        'status' => 'در انتظار تأیید سفارش', 'approval_status' => 'در انتظار تأیید',
        'purchase_items' => [['product' => 'Fixture']],
    ]],
    'customers' => [['id' => 1, 'name' => 'Owner'], ['id' => 2, 'name' => 'Other']],
    'users' => [
        ['id' => 1, 'roles' => ['customer'], 'active' => true, 'customer_id' => 1],
        ['id' => 2, 'roles' => ['customer'], 'active' => true, 'customer_id' => 2],
    ],
];

/** Authenticate a scoped staff user without contacting the host. */
function auth(): array { return ['id' => 9, 'roles' => ['sales']]; }
/** Check the role shape used by the production audience filter. */
function is_customer_user(array $actor): bool { return in_array('customer', $actor['roles'], true); }
/** Identify the native sales role in the fixture. */
function user_has_staff_role(array $actor): bool { return !is_customer_user($actor); }
/** Keep the fixture independent of the date when CI runs. */
function now(): string { return '1405-08-24 11:00:00'; }
/** Supply the validated request through the production action parser. */
function input(): array {
    return ['order_id' => 8, 'action' => 'return', 'request_id' => str_repeat('c', 32), 'note' => 'کالا باید جایگزین شود.'];
}
/** Reuse the audience's callback contract without a live customer number. */
function clean_mobile(string $value): string { return $value; }
/** Execute against the isolated test state. */
function db(bool $write, callable $callback): array {
    global $testState;
    return $callback($testState);
}
/** Surface production validation as a failing assertion. */
function fail(string $message, int $status): void { throw new RuntimeException($message, $status); }
/** Verify the return state and the exact recipient before completing the fixture. */
function out(array $result): void {
    global $testState;
    $message = $testState['portal_messages'][str_repeat('c', 32)] ?? [];
    if (($result['correction']['status'] ?? '') !== 'requested' || ($message['app'] ?? false) !== true
        || array_keys($message['targets'] ?? []) !== [1]
        || strpos($message['body'], 'کالا باید جایگزین شود.') !== 0) {
        throw new RuntimeException('The correction and its owner notification must be committed together.');
    }
    echo "Order return route sent the correction message only to its owner.\n";
    exit;
}

require __DIR__.'/../lib/order-followup-route.php';
throw new RuntimeException('Order return route did not send a response.');
