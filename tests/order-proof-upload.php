<?php
declare(strict_types=1);

require_once __DIR__.'/../lib/order-proof-upload.php';

$directory = sys_get_temp_dir().'/gp-proof-'.bin2hex(random_bytes(8));
$policy = json_decode(file_get_contents(__DIR__.'/../config/order-proof-upload.yaml'), true, 512, JSON_THROW_ON_ERROR);
$service = new GpOrderProofUpload($directory, $policy);
$image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jQ1sAAAAASUVORK5CYII=';
$order = ['id'=>4, 'customer_id'=>3, 'requested_payment_method'=>'mixed', 'native_settlement'=>['cash_amount'=>100, 'check_amount'=>200], 'payment_status'=>'در انتظار بررسی'];
$state = ['orders'=>[$order]];
try {
    foreach ([[6, 'cash', $image, 404], [3, 'credit', $image, 422], [3, 'check', 'invalid', 422]] as [$customer, $kind, $value, $status]) {
        try {
            $service->attach($state, $customer, 4, $kind, $value, '');
            throw new RuntimeException('Invalid upload was accepted.');
        } catch (DomainException $error) {
            if ($error->getCode() !== $status) {
                throw $error;
            }
        }
    }
    $service->attach($state, 3, 4, 'check', $image, '');
    $service->attach($state, 3, 4, 'cash', $image, '');
    $service->attach($state, 3, 4, 'check', $image, '');
    $settlement = $state['orders'][0]['native_settlement'];
    if (array_column($settlement['proofs'], 'kind') !== ['check', 'cash'] ||
        $state['orders'][0]['payment_status'] !== $order['payment_status'] ||
        count(glob($directory.'/*.php')) !== 2) {
        throw new RuntimeException('Proof retry or payment state regression.');
    }
    $pdf = base64_encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
    $anotherImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
    $result = $service->attachBatch($state, 3, 4, 'check', [$pdf, $anotherImage], '');
    $retry = $service->attachBatch($state, 3, 4, 'check', [$pdf, $anotherImage], '');
    if ($result['count'] !== 3 || $retry['count'] !== 3 ||
        array_column($state['orders'][0]['native_settlement']['proofs'], 'proof_mime') !== [
            'image/png', 'image/png', 'application/pdf', 'image/png',
        ] || count(glob($directory.'/*.php')) !== 4) {
        throw new RuntimeException('Batch must append distinct files without replacing prior proofs.');
    }
    $checkoutService = new GpOrderProofUpload($directory, $policy);
    $checkout = $order;
    try {
        $checkoutService->appendCheckout($checkout, ['cash' => [$pdf], 'check' => ['invalid']], '');
        throw new RuntimeException('Invalid checkout batch was accepted.');
    } catch (DomainException $error) {
        if ($error->getCode() !== 422) {
            throw $error;
        }
        $checkoutService->cleanup();
        if (count(glob($directory.'/*.php')) !== 4) {
            throw new RuntimeException('Failed checkout left a private file behind.');
        }
    }
    $checkout = $order;
    $checkoutService->appendCheckout($checkout, ['cash' => [$pdf, $image], 'check' => [$image]], '');
    if (array_column($checkout['native_settlement']['proofs'], 'kind') !== ['cash', 'cash', 'check']) {
        throw new RuntimeException('Checkout lost a selected payment proof.');
    }
} finally {
    foreach (glob($directory.'/*.php') ?: [] as $proof) {
        unlink($proof);
    }
    if (is_dir($directory)) {
        rmdir($directory);
    }
}
echo "Order proof ownership, validation, multiple files, checkout and retry passed.\n";
