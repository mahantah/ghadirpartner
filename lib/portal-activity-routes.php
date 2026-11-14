<?php
declare(strict_types=1);

if ($p !== '/api/portal-activity' && $p !== '/api/reports/portal-activity') {
    return;
}

$report = $p === '/api/reports/portal-activity';
$actor = auth($report ? ['admin'] : ['customer']);
if (!$report && (!is_customer_user($actor) || in_array('admin', $actor['roles'] ?? [], true))) {
    fail('دسترسی به فعالیت مشتری مجاز نیست.', 403);
}
if ($m !== ($report ? 'GET' : 'POST')) {
    fail('روش درخواست مجاز نیست.', 405);
}
header('Cache-Control: no-store');
require_once __DIR__.'/portal-activity.php';
$policy = json_decode((string) file_get_contents(dirname(__DIR__).'/config/portal-activity.yaml'), true, 512, JSON_THROW_ON_ERROR);
$activity = new GpPortalActivity(ghadir_mysql_pdo(), $policy);
try {
    if ($report) {
        $activity->install();
        $result = $activity->report(time());
        $performance = db(false, static function (array $state) use ($result, $policy): array {
            $customers = array_fill_keys(array_column($result['customers'], 'customer_id'), []);
            foreach ($state['customers'] ?? [] as $customer) {
                if (isset($customers[$customer['id']]) && empty($customer['deleted'])) {
                    $customers[$customer['id']] = ['name' => $customer['name'], 'orders' => 0, 'purchases' => 0];
                }
            }
            $zone = new DateTimeZone($policy['timezone']);
            $from = (new DateTimeImmutable('today', $zone))->modify('-'.($policy['history_days'] - 1).' days')->format('Y-m-d');
            foreach ($state['orders'] ?? [] as $order) {
                $id = (int) ($order['customer_id'] ?? 0);
                if (empty($customers[$id]) || !empty($order['deleted']) ||
                    (string) ($order['created_at'] ?? '') < $from) {
                    continue;
                }
                $customers[$id]['orders']++;
                if (in_array($order['status'] ?? '', ['ارسال شد', 'تحویل شد'], true)) {
                    $customers[$id]['purchases']++;
                }
            }
            return $customers;
        });
        foreach ($result['customers'] as $index => $customer) {
            $details = $performance[$customer['customer_id']] ?? [];
            if (!$details) {
                unset($result['customers'][$index]);
                continue;
            }
            $result['customers'][$index] += $details;
        }
        $result['customers'] = array_values($result['customers']);
        out($result);
    }
    $payload = input();
    $channel = $payload['channel'] ?? '';
    $lines = $payload['cart'] ?? null;
    if (!is_string($channel) || ($lines !== null && !is_array($lines)) || (int) ($actor['customer_id'] ?? 0) < 1) {
        fail('دادهٔ فعالیت معتبر نیست.', 422);
    }
    $customerId = (int) $actor['customer_id'];
    try {
        $activity->record($customerId, $channel, $lines, time());
    } catch (PDOException $error) {
        if ($error->getCode() !== '42S02') {
            throw $error;
        }
        $activity->install();
        $activity->record($customerId, $channel, $lines, time());
    }
    out(['ok' => true, 'heartbeat_seconds' => $policy['heartbeat_seconds']]);
} catch (InvalidArgumentException $error) {
    fail($error->getMessage(), 422);
} catch (PDOException $error) {
    error_log('Portal activity storage error: '.$error->getCode());
    fail('ثبت فعالیت موقتاً در دسترس نیست.', 503);
}
