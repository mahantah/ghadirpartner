<?php
declare(strict_types=1);

if ($p !== '/api/native/order-proof') {
    return;
}
$actor = auth(['customer']);
$customerId = (int) ($actor['customer_id'] ?? 0);
if ($customerId < 1 || !is_customer_user($actor) || user_has_staff_role($actor)) {
    fail('دسترسی مجاز نیست.', 403);
}
if ($m !== 'POST') {
    fail('روش درخواست مجاز نیست.', 405);
}
header('Cache-Control: no-store');
require_once __DIR__.'/order-proof-upload.php';
$policy = json_decode((string) file_get_contents(dirname(__DIR__).'/config/order-proof-upload.yaml'), true, 512, JSON_THROW_ON_ERROR);
$payload = input();
$orderId = $payload['order_id'] ?? null;
$kind = $payload['kind'] ?? null;
$image = $payload['image_base64'] ?? null;
if (!is_int($orderId) || $orderId < 1 || !is_string($kind) || !is_string($image) || $image === '') {
    fail('شماره سفارش و تصویر را بررسی کنید.', 422);
}
$upload = new GpOrderProofUpload(dirname($file).'/native-proofs', $policy);
try {
    out(db(true, static fn (array &$state): array => $upload->attach($state, $customerId, $orderId, $kind, $image, now())));
} catch (DomainException $error) {
    $upload->cleanup();
    fail($error->getMessage(), $error->getCode());
} catch (Throwable $error) {
    $upload->cleanup();
    error_log('Native order proof upload failed: '.get_class($error));
    fail('ذخیرهٔ تصویر انجام نشد. دوباره تلاش کنید.', 503);
}
