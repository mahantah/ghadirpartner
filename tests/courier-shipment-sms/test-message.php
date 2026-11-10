<?php

declare(strict_types=1);

/** Extract one existing function without booting the live router or storage layer. */
function fixtureFunction(string $source, string $name): string
{
    $start = strpos($source, 'function ' . $name . '(');
    if ($start === false) {
        throw new RuntimeException('missing_function:' . $name);
    }
    $tokens = token_get_all('<?php ' . substr($source, $start));
    $code = '';
    $depth = 0;
    $opened = false;
    foreach ($tokens as $token) {
        if (is_array($token)) {
            if ($token[0] !== T_OPEN_TAG) {
                $code .= $token[1];
            }
            continue;
        }
        $code .= $token;
        if ($token === '{') {
            $opened = true;
            $depth++;
        } elseif ($token === '}' && $opened && --$depth === 0) {
            return $code;
        }
    }
    throw new RuntimeException('unterminated_function');
}

/** Assert sanitized business outcomes without dumping message or router source. */
function verify(bool $condition, string $reason): void
{
    if (!$condition) {
        throw new RuntimeException($reason);
    }
}

/** Isolated in-memory repository; this fixture never opens production state. */
function db(bool $write, callable $callback): ?array
{
    return $callback($GLOBALS['fixtureState']);
}

/** Preserve the synthetic valid destination without reaching a contact service. */
function clean_mobile(string $value): string
{
    return trim($value);
}

/** Deterministic fixture timestamp. */
function now(): string
{
    return '2026-11-10 00:00:00';
}

/** Capture the exact gateway payload without making any network call. */
function homa_token_send(
    string $url,
    string $token,
    string $mobile,
    string $message,
    string $sender
): array {
    verify(
        $url === 'https://example.invalid/never-called',
        'unexpected_gateway'
    );
    $GLOBALS['fixtureSent'][] = ['mobile' => $mobile, 'message' => $message];
    return [
        'meta' => ['ok' => true, 'result_code' => 'fixture'],
        'resp' => '{}',
        'http' => 200,
        'err' => '',
        'auth' => 'fixture',
    ];
}

$source = file_get_contents(__DIR__ . '/candidate/index.php');
verify(is_string($source), 'missing_candidate');
$start = strpos($source, '/** Validated message labels');
$end = strpos(
    $source,
    'function sms_template_vars_for_order(',
    $start === false ? 0 : $start
);
verify($start !== false && $end !== false, 'missing_facade');
eval(substr($source, $start, $end - $start));
foreach (
    [
        'sms_template_definitions',
        'sms_template_config_from_state',
        'sms_template_render_text',
        'sms_template_vars_for_order',
        'sms_send_mobile',
        'sms_status',
    ]
    as $function
) {
    eval(fixtureFunction($source, $function));
}
verify(function_exists('curl_init'), 'fixture_requires_curl_extension');
$cfg = [
    'homa_api_token' => 'fixture',
    'homa_api_endpoint' => 'https://example.invalid/never-called',
    'homa_sender_id' => 'fixture',
];
$customer = ['mobile' => '09120000000', 'name' => 'مشتری نمونه'];
$order = [
    'id' => 1,
    'number' => 'FIXTURE-001',
    'shipping_type' => 'پیک',
    'courier_name' => 'پیک نمونه',
    'courier_phone' => '09121112222',
    'status' => 'ارسال شد',
    'items' => [],
];

foreach (
    [
        null,
        ['text' => 'سفارش {order_number} ارسال شد.', 'enabled' => true],
        [
            'text' => 'پیک: {courier_name} تماس: {courier_phone}',
            'enabled' => true,
        ],
        ['text' => 'پیک: {courier_name}', 'enabled' => true],
    ]
    as $saved
) {
    $GLOBALS['fixtureState'] = [
        'settings' => [
            'sms_templates' => $saved === null ? [] : ['shipped' => $saved],
        ],
        'sms_outbox' => [],
    ];
    $GLOBALS['fixtureSent'] = [];
    $result = sms_status($customer, $order, 'fallback', 'shipped');
    verify(
        !empty($result['sent']) && count($GLOBALS['fixtureSent']) === 1,
        'shipment_sent_once'
    );
    $message = $GLOBALS['fixtureSent'][0]['message'];
    verify(
        substr_count($message, $order['courier_name']) === 1,
        'courier_name_once'
    );
    verify(
        substr_count($message, $order['courier_phone']) === 1,
        'courier_phone_once'
    );
    verify(
        $GLOBALS['fixtureState']['sms_outbox'][0]['message'] === $message,
        'outbox_matches_gateway'
    );
    verify(
        $GLOBALS['fixtureSent'][0]['mobile'] === $customer['mobile'],
        'recipient_unchanged'
    );
}
$GLOBALS['fixtureState'] = ['settings' => [], 'sms_outbox' => []];
$GLOBALS['fixtureSent'] = [];
$carrierOrder = array_merge($order, [
    'shipping_type' => 'تیپاکس',
    'tracking_code' => 'TRACK-001',
]);
sms_status($customer, $carrierOrder, 'fallback', 'shipped');
$message = $GLOBALS['fixtureSent'][0]['message'];
verify(strpos($message, 'TRACK-001') !== false, 'tracking_preserved');
verify(
    strpos($message, $order['courier_phone']) === false,
    'stale_courier_not_leaked'
);
sms_status($customer, $order, 'fallback', 'ready');
verify(
    strpos($GLOBALS['fixtureSent'][1]['message'], $order['courier_phone']) ===
        false,
    'other_kinds_unchanged'
);
$GLOBALS['fixtureState']['settings']['sms_templates']['shipped'] = [
    'text' => 'ارسال شد',
    'enabled' => false,
];
$GLOBALS['fixtureSent'] = [];
$result = sms_status($customer, $order, 'fallback', 'shipped');
verify(
    !empty($result['disabled']) && $GLOBALS['fixtureSent'] === [],
    'disabled_template_preserved'
);
$malformed = array_merge($order, ['courier_name' => [], 'courier_phone' => []]);
$vars = sms_template_vars_for_order($customer, $malformed);
verify($vars['courier_suffix'] === '', 'malformed_fields_ignored');
$vars = sms_template_vars_for_order($customer, $carrierOrder);
verify(
    $vars['courier_name'] === '' && $vars['courier_phone'] === '',
    'non_courier_vars_empty'
);
echo "ok: default/saved templates include courier once; tracking, disabled settings, recipient and outbox preserved; gateway mocked\n";
