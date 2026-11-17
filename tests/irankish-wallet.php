<?php
declare(strict_types=1);

require_once __DIR__.'/../lib/irankish-wallet.php';

$key = openssl_pkey_new(['private_key_bits' => 2048]);
if ($key === false) throw new RuntimeException('Fixture RSA key generation failed.');
$config = [
    'gateway' => 'https://ikc.shaparak.ir',
    'terminal_id' => '02000001', 'acceptor_id' => '992180000000001',
    'pass_phrase' => '001122334455AABB', 'public_key' => openssl_pkey_get_details($key)['key'],
    'purchase_suffix' => '00', 'rsa_padding' => 'pkcs1',
    'callback' => 'https://ghadirpartner.ir/partners/api/wallet/irankish/callback',
    'max_rials' => 999999999999, 'token_lifetime_seconds' => 600,
];
$state = ['customers' => [['id' => 1], ['id' => 2]]];
$bank = [];
$confirmed = 0;
$transport = static function (string $path, array $body) use (&$bank, &$confirmed, $key): array {
    if ($path === '/api/v3/tokenization/make') {
        $payment = $body['request'];
        $envelope = $body['authenticationEnvelope'];
        if (!openssl_private_decrypt(hex2bin($envelope['data']), $decoded, $key, OPENSSL_PKCS1_PADDING)) {
            throw new LogicException('Unable to decrypt fixture envelope.');
        }
        $iv = hex2bin($envelope['iv']);
        $aes = substr($decoded, 0, 16);
        $expected = openssl_encrypt(hex2bin('02000001001122334455AABB00000000250000'), 'aes-128-cbc', $aes, OPENSSL_RAW_DATA, $iv);
        if (substr($decoded, 16) !== hash('sha256', $expected, true) || $payment['amount'] !== 2500 || $payment['transactionType'] !== 'Purchase') {
            throw new LogicException('Tokenization format or currency mismatch.');
        }
        $bank = [
            'requestId' => $payment['requestId'], 'terminalId' => $payment['terminalId'], 'acceptorId' => $payment['acceptorId'],
            'tokenIdentity' => 'AB123', 'amount' => 2500, 'responseCode' => '00', 'isReversed' => false, 'isVerified' => false,
            'retrievalReferenceNumber' => '123456789012', 'systemTraceAuditNumber' => '000001',
        ];
        return ['status' => true, 'responseCode' => '00', 'result' => ['token' => 'AB123']];
    }
    if ($path === '/api/v3/confirmation/purchase') {
        if ($body['retrievalReferenceNumber'] !== $bank['retrievalReferenceNumber'] || $body['tokenIdentity'] !== $bank['tokenIdentity']) {
            throw new LogicException('Confirmation used unbound identifiers.');
        }
        $confirmed++;
        $bank['isVerified'] = true;
        throw new RuntimeException('Fixture confirmation response lost.');
    }
    if ($path !== '/api/v3/inquiry/single' || $body['requestId'] !== $bank['requestId'] || $body['findOption'] !== 3) {
        throw new LogicException('Unexpected inquiry.');
    }
    return ['status' => true, 'responseCode' => '00', 'result' => [$bank]];
};
$database = static function (bool $write, Closure $callback) use (&$state) {
    $candidate = $state;
    $result = $callback($candidate);
    if ($write) $state = $candidate;
    return $result;
};
$service = new GpIranKishWallet(new GpIranKishWalletClient($config, $transport), $database);
$now = '2026-11-16 14:00:00';
$started = $service->start(1, 250, $now);
$id = $bank['requestId'];
if ($started['token'] !== 'AB123' || $service->report(1)['balance'] !== 0 || $service->report(2)['payments'] !== []
    || $service->reconcile($id, 2, '', $now) || $service->reconcile($id, 0, 'wrong-token', $now)) {
    throw new LogicException('Wallet credited early or payment ownership was not enforced.');
}
$bank['amount'] = 1;
if ($service->reconcile($id, 1, '', $now) || $confirmed !== 0) throw new LogicException('Incorrect amount was confirmed.');
$bank['amount'] = '000000002500';
$bank['isReversed'] = true;
if ($service->reconcile($id, 1, '', $now)) throw new LogicException('Reversed payment was accepted.');
$bank['isReversed'] = false;
try {
    $service->reconcile($id, 0, 'AB123', $now);
    throw new LogicException('The lost bank confirmation response was not simulated.');
} catch (RuntimeException $error) {
    if ($error->getMessage() !== 'Fixture confirmation response lost.' || $service->report(1)['balance'] !== 0) throw $error;
}
if (!$service->reconcile($id, 1, '', $now) || !$service->reconcile($id, 0, 'AB123', $now)
    || $confirmed !== 1 || $service->report(1)['balance'] !== 250
    || $service->report(1)['payments'][0]['reference'] !== '123456789012' || $service->report(2)['balance'] !== 0) {
    throw new LogicException('Confirmed payment was not posted exactly once.');
}
echo "Iran Kish envelope, amount checks, ownership and wallet posting passed.\n";

$order = [
    'id' => 7, 'customer_id' => 1, 'estimated_total' => 500, 'status' => 'در انتظار تأیید سفارش',
    'requested_payment_method' => 'mixed', 'native_settlement' => ['check_amount' => 100, 'credit_amount' => 50],
];
(new GpIranKishOrderPayment())->initialize($order, null, ['cash_online' => true, 'cash_amount' => 250], 0);
$state['orders'][] = $order;
$orderAttempt = $service->startOrder(1, 7, $now)['id'];
if ($service->orderLaunch($orderAttempt)['token'] !== 'AB123' || $service->report(1)['balance'] !== 250
    || count($service->report(1)['payments']) !== 1 || $service->reconcile($orderAttempt, 2, '', $now)) {
    throw new LogicException('Order launch, ownership or ledger separation failed.');
}
$bank['retrievalReferenceNumber'] = '123456789013';
try {
    $service->reconcile($orderAttempt, 0, 'AB123', $now);
    throw new LogicException('Expected an interrupted confirmation.');
} catch (RuntimeException $error) {
    if ($error->getMessage() !== 'Fixture confirmation response lost.') throw $error;
}
if (($state['orders'][0]['irankish_order_payment']['claim'] ?? '') !== $orderAttempt) {
    throw new LogicException('Confirmation claim was not persisted before bank I/O.');
}
$result = $service->recheckOrder(1, 7, $now);
$summary = (new GpCreditCheckout())->summary($state['orders'][0]);
if ($result['receipt']['reference'] !== '123456789013' || $summary['cash_remaining'] !== 100
    || $summary['cash_confirmed'] !== 250 || $service->report(1)['balance'] !== 250
    || !$service->reconcile($orderAttempt, 0, 'AB123', $now) || $confirmed !== 2
    || empty($service->startOrder(1, 7, $now)['confirmed'])) {
    throw new LogicException('Order reconciliation did not post exactly once to the cash portion.');
}
echo "Iran Kish order allocation, interrupted confirmation and separate wallet balance passed.\n";

$home = sys_get_temp_dir().'/gp-irankish-'.bin2hex(random_bytes(8));
$configDirectory = $home.'/public_html/config';
mkdir($configDirectory, 0700, true);
$policyPath = $configDirectory.'/wallet.yaml';
$settingsPath = $home.'/irankish-wallet-settings.json';
copy(__DIR__.'/../config/irankish-wallet.yaml', $policyPath);
try {
    if (GpIranKishWalletClient::configured($policyPath) !== null) {
        throw new LogicException('Wallet must be disabled without host settings.');
    }
    file_put_contents($settingsPath, json_encode([
        'enabled' => '1', 'terminal_id' => $config['terminal_id'], 'acceptor_id' => $config['acceptor_id'],
        'pass_phrase' => $config['pass_phrase'], 'purchase_suffix' => '00', 'rsa_padding' => 'pkcs1',
        'public_key' => $config['public_key'],
    ], JSON_THROW_ON_ERROR));
    chmod($settingsPath, 0644);
    try {
        GpIranKishWalletClient::configured($policyPath);
        throw new LogicException('Wallet accepted a broadly readable settings file.');
    } catch (RuntimeException $error) {
        if ($error->getMessage() !== 'Iran Kish private settings must be a private, regular file.') throw $error;
    }
    chmod($settingsPath, 0600);
    clearstatcache(true, $settingsPath);
    $client = GpIranKishWalletClient::configured($policyPath);
    if ($client === null || $client->rials(250) !== 2500) throw new LogicException('Private host settings did not load.');
    putenv('GP_IKC_WALLET_ENABLED=0');
    if (GpIranKishWalletClient::configured($policyPath) !== null) {
        throw new LogicException('Explicit host environment must override the private file.');
    }
} finally {
    putenv('GP_IKC_WALLET_ENABLED');
    if (is_file($settingsPath)) unlink($settingsPath);
    unlink($policyPath);
    rmdir($configDirectory);
    rmdir(dirname($configDirectory));
    rmdir($home);
}
echo "Private host configuration, file permissions and environment precedence passed.\n";

$checkout = new GpIranKishCheckout();
$draft = $order;
$draft['id'] = 8;
$request = ['customer_id' => 1, 'notes' => 'fixture'];
$fingerprint = $checkout->fingerprint($request, $draft, 0, 0);
$prepaid = $service->startCheckout(1, 250, $fingerprint, $now)['checkout_id'];
if ($service->startCheckout(1, 250, $fingerprint, $now)['checkout_id'] !== $prepaid
    || $service->orderLaunch($prepaid)['token'] !== 'AB123'
    || count($state['orders']) !== 1) {
    throw new LogicException('Checkout published an order or requested an extra token before payment.');
}
try {
    $checkout->apply($state, $draft, $prepaid, $fingerprint);
    throw new LogicException('An unpaid checkout was accepted.');
} catch (DomainException $error) {
    if ($error->getCode() !== 409) throw $error;
}
$bank['retrievalReferenceNumber'] = '123456789014';
$bank['isVerified'] = true;
if (!$service->returnFromOrderBank($prepaid, $now) || !$service->recheckCheckout(1, $prepaid, $now)['confirmed']
    || count($state['orders']) !== 1 || $service->report(1)['balance'] !== 250) {
    throw new LogicException('Bank return did not verify independently from publishing the order.');
}
$checkout->apply($state, $draft, $prepaid, $fingerprint);
$state['orders'][] = $draft;
if ($draft['irankish_order_payment']['receipt']['reference'] !== '123456789014'
    || $checkout->completed($state, $prepaid, 1)['id'] !== 8
    || !isset($service->returnCheckoutToWallet(1, $prepaid, $now)['error'])) {
    throw new LogicException('The confirmed checkout was not consumed exactly once.');
}
$abandoned = $service->startCheckout(1, 250, str_repeat('d', 64), $now)['checkout_id'];
$bank['retrievalReferenceNumber'] = '123456789015';
$bank['isVerified'] = true;
if (!$service->returnFromOrderBank($abandoned, $now)) throw new LogicException('Unable to confirm abandoned fixture.');
$service->returnCheckoutToWallet(1, $abandoned, $now);
$service->returnCheckoutToWallet(1, $abandoned, $now);
if ($service->report(1)['balance'] !== 500 || $service->recheckCheckout(1, $abandoned, $now)['confirmed']) {
    throw new LogicException('Abandoned checkout was not released to the wallet exactly once.');
}
echo "Iran Kish checkout stays private until a confirmed payment is applied exactly once.\n";
