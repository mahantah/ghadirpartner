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
$payload = input();
$orderId = $payload['order_id'] ?? null;
$kind = $payload['kind'] ?? null;
$image = $payload['image_base64'] ?? null;
$files = $payload['files'] ?? null;
if (!is_int($orderId) || $orderId < 1 || !is_string($kind) || ($files === null ? (!is_string($image) || $image === '') : !is_array($files))) {
    fail('شماره سفارش و فایل‌ها را بررسی کنید.', 422);
}
$upload = GpOrderProofUpload::configured(dirname($file).'/native-proofs');
try {
    $result = db(true, static function (array &$state) use ($upload, $customerId, $orderId, $kind, $image, $files): array {
        try {
            return $files === null
                ? $upload->attach($state, $customerId, $orderId, $kind, $image, now())
                : $upload->attachBatch($state, $customerId, $orderId, $kind, $files, now());
        } catch (DomainException $error) {
            fail($error->getMessage(), $error->getCode());
        }
    });
    $upload->commit();
    out($result);
} catch (Throwable $error) {
    $upload->cleanup();
    error_log('Native order proof upload failed: '.get_class($error));
    fail('ذخیرهٔ فایل‌ها انجام نشد. دوباره تلاش کنید.', 503);
}
