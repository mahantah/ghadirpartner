<?php
declare(strict_types=1);

require_once __DIR__.'/../lib/order-shipping-receipts.php';

$directory = sys_get_temp_dir().'/gp-shipping-'.bin2hex(random_bytes(8));
$upload = GpOrderProofUpload::configured($directory);
$policy = json_decode((string) file_get_contents(__DIR__.'/../config/order-shipping-receipts.yaml'), true, 512, JSON_THROW_ON_ERROR);
$service = new GpOrderShippingReceipts($upload, $policy);
$png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQ1sAAAAASUVORK5CYII=';
$assert = static function (bool $ok, string $reason): void {
    if (!$ok) throw new RuntimeException($reason);
};
$denied = static function (callable $operation, int $status) use ($assert): void {
    try {
        $operation();
    } catch (DomainException $error) {
        $assert($error->getCode() === $status, $error->getMessage());
        return;
    }
    throw new RuntimeException('Expected receipt operation to be denied.');
};
$order = ['id' => 4, 'customer_id' => 3, 'status' => 'ارسال شد', 'estimated_total' => 800,
    'native_settlement' => ['credit_amount' => 800], 'payment_status' => 'اعتباری',
    'items' => [['product' => 'fixture', 'qty' => 1]]];
$before = $order;
$request = ['request_id' => str_repeat('a', 32), 'carrier' => 'کالارسان', 'tracking_code' => 'TEST-42',
    'note' => 'رسید ارسال نخست', 'files' => [$png, base64_encode("%PDF-1.7\n%%EOF\n")]];
try {
    $assert($service->summary($order)['receipts'] === [], 'Old orders need a migration.');
    $assert($service->staff(['prep']) && $service->staff(['sales']), 'Shipping staff lost access.');
    $assert(!$service->staff(['customer']) && !$service->staff(['viewer']), 'Unprivileged actor gained access.');
    $state = ['orders' => [$order, ['id' => 5, 'customer_id' => 8, 'deleted' => true]]];
    $assert($service->index($state, 4, 3) === 0, 'Owner cannot read receipts.');
    $denied(static fn () => $service->index($state, 4, 8), 404);
    $denied(static fn () => $service->index($state, 5, 0), 404);

    $result = $service->append($order, $request, 1, '2026-11-17 19:00:00');
    $service->commit();
    $assert(count($result['receipts']) === 1 && count($result['receipts'][0]['files']) === 2, 'Mixed photo/PDF receipt lost.');
    $token = $result['receipts'][0]['files'][0]['proof_token'];
    $pdfToken = $result['receipts'][0]['files'][1]['proof_token'];
    $assert(!isset($result['receipts'][0]['created_by']) && !isset($result['receipts'][0]['files'][0]['proof_hash']), 'Private metadata leaked.');
    $assert($service->document($order, $token)['data'] === $png, 'Photo bytes changed.');
    $assert($service->document($order, $pdfToken)['mime'] === 'application/pdf', 'PDF receipt cannot be read.');
    $assert(count($service->append($order, $request, 1, '2026-11-17 19:01:00')['receipts']) === 1, 'Retry created duplicate receipts.');
    $changed = $request;
    $changed['carrier'] = 'پیک';
    $denied(static function () use ($service, &$order, $changed): void {
        $service->append($order, $changed, 1, '2026-11-17 19:01:00');
    }, 409);
    $denied(static fn () => $service->document($before, $token), 404);
    $denied(static fn () => $service->document($order, str_repeat('b', 48)), 404);
    $second = $request;
    $second['request_id'] = str_repeat('b', 32);
    $second['carrier'] = 'پیک';
    $service->append($order, $second, 2, '2026-11-17 19:02:00');
    $service->commit();
    $assert(count($service->summary($order)['receipts']) === 2, 'A later shipment replaced the first.');
    $business = $order;
    unset($business['shipping_receipts']);
    $assert($business === $before, 'Shipping receipt altered money, status, or inventory.');
    $bad = $second;
    $bad['request_id'] = str_repeat('c', 32);
    $bad['files'] = ['not-a-receipt'];
    $denied(static function () use ($service, &$order, $bad): void {
        $service->append($order, $bad, 1, '2026-11-17 19:03:00');
    }, 422);
    $assert(count($service->summary($order)['receipts']) === 2, 'Invalid receipt partly changed the order.');
    $limit = $policy;
    $limit['max_receipts_per_order'] = 2;
    $bounded = new GpOrderShippingReceipts($upload, $limit);
    $denied(static function () use ($bounded, &$order, $bad, $png): void {
        $bad['files'] = [$png];
        $bounded->append($order, $bad, 1, '2026-11-17 19:03:00');
    }, 422);
    echo "Shipping receipts preserve owner access, retry identity, multiple shipments, PDFs, and financial state.\n";
} finally {
    $upload->cleanup();
    foreach (glob($directory.'/*.php') ?: [] as $path) unlink($path);
    if (is_dir($directory)) rmdir($directory);
}
