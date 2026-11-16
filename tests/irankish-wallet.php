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
    'max_rials' => 999999999999,
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
