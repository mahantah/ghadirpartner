<?php
declare(strict_types=1);

if ($p !== '/api/customer-consignments') return;

$actor = auth(['admin', 'sales']);
if (!in_array($m, ['GET', 'POST'], true)) fail('روش درخواست مجاز نیست.', 405);
header('Cache-Control: no-store');
require_once __DIR__.'/customer-consignments.php';
$policy = json_decode((string) file_get_contents(dirname(__DIR__).'/config/customer-consignments.yaml'), true, 512, JSON_THROW_ON_ERROR);
$consignments = new GpCustomerConsignments($policy);
if ($m === 'GET') {
    out(db(false, static fn (array $state): array => $consignments->report($state)));
}
$contentType = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '', 2)[0]));
if ($contentType !== 'application/json') fail('فرمت درخواست معتبر نیست.', 415);
$request = input();
if (!is_array($request)) fail('درخواست معتبر نیست.', 422);
$result = db(true, static function (array &$state) use ($consignments, $request, $actor): array {
    try {
        return ['record' => $consignments->record($state, $request, (int) $actor['id'], now())];
    } catch (DomainException $error) {
        return ['message' => $error->getMessage(), 'status' => $error->getCode()];
    }
});
if (isset($result['status'])) fail($result['message'], $result['status']);
out($result['record']);
