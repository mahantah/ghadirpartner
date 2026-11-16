<?php
declare(strict_types=1);

/** Exchange authenticated IPG requests with the documented Iran Kish v3 API. */
final class GpIranKishWalletClient
{
    private array $config;
    private ?Closure $transport;

    /** Inject validated settings and an optional transport for protocol fixtures. */
    public function __construct(array $config, ?Closure $transport = null)
    {
        $this->config = $config;
        $this->transport = $transport;
    }

    /** Resolve the host's payment settings only when the feature has been explicitly enabled. */
    public static function configured(string $path): ?self
    {
        $config = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        $privateSettings = null;
        foreach (['enabled', 'terminal_id', 'acceptor_id', 'pass_phrase', 'purchase_suffix', 'rsa_padding', 'public_key_path'] as $key) {
            if (!preg_match('/^\$\{([A-Z_]+)\}$/D', $config[$key] ?? '', $name)) {
                throw new RuntimeException('Invalid Iran Kish environment reference.');
            }
            $config[$key] = getenv($name[1]);
            if ($config[$key] === false) {
                $privateSettings = $privateSettings ?? self::privateSettings($path, $config['private_settings_file']);
                $config[$key] = $privateSettings[$key] ?? false;
            }
            if ($key === 'enabled' && $config[$key] !== '1') return null;
        }
        if (!preg_match('/^\d{8}$/D', (string) $config['terminal_id'])
            || !preg_match('/^\d{15}$/D', (string) $config['acceptor_id'])
            || !preg_match('/^[a-f0-9]{16}$/iD', (string) $config['pass_phrase'])
            || !in_array($config['purchase_suffix'], ['none', '00'], true)
            || !in_array($config['rsa_padding'], ['pkcs1', 'oaep'], true)
            || $config['gateway'] !== 'https://ikc.shaparak.ir'
            || !preg_match('~^https://[a-z0-9.-]+/partners/api/wallet/irankish/callback$~D', $config['callback'] ?? '')
            || !is_int($config['max_rials']) || $config['max_rials'] < 10 || $config['max_rials'] > 999999999999
            || !is_int($config['token_lifetime_seconds'] ?? null) || $config['token_lifetime_seconds'] < 1
            || !is_int($config['request_timeout_seconds']) || $config['request_timeout_seconds'] < 1
            || !function_exists('curl_init')) {
            throw new RuntimeException('Invalid Iran Kish wallet configuration.');
        }
        $keyPath = $config['public_key_path'];
        if ($keyPath !== false) {
            if (!is_string($keyPath) || substr($keyPath, 0, 1) !== '/' || !is_readable($keyPath)) {
                throw new RuntimeException('Invalid Iran Kish public key file.');
            }
            $config['public_key'] = (string) file_get_contents($keyPath);
        } else {
            $config['public_key'] = $privateSettings['public_key'] ?? '';
        }
        if (!openssl_pkey_get_public($config['public_key'])) throw new RuntimeException('Invalid Iran Kish public key.');
        return new self($config);
    }

    /** Read settings from the hosting account home, above the deployed web root. */
    private static function privateSettings(string $policyPath, string $filename): array
    {
        if (!preg_match('/^[a-z0-9-]+\.json$/D', $filename)) {
            throw new RuntimeException('Invalid Iran Kish private settings filename.');
        }
        $filename = dirname($policyPath, 3).'/'.$filename;
        if (!file_exists($filename) && !is_link($filename)) return [];
        if (is_link($filename) || !is_file($filename) || !is_readable($filename)
            || (fileperms($filename) & 0077) !== 0) {
            throw new RuntimeException('Iran Kish private settings must be a private, regular file.');
        }
        $settings = json_decode((string) file_get_contents($filename), true, 32, JSON_THROW_ON_ERROR);
        if (!is_array($settings)) throw new RuntimeException('Invalid Iran Kish private settings.');
        foreach ($settings as $value) {
            if (!is_string($value)) throw new RuntimeException('Invalid Iran Kish private settings value.');
        }
        return $settings;
    }

    /** Validate the portal amount in tomans and return the documented rial amount. */
    public function rials(int $tomans): int
    {
        if ($tomans < 1 || $tomans > intdiv($this->config['max_rials'], 10)) {
            throw new DomainException('مبلغ پرداخت به تومان معتبر نیست.', 422);
        }
        return $tomans * 10;
    }

    /** Limit token reuse to the issuance interval agreed with Iran Kish. */
    public function tokenLifetime(): int
    {
        return $this->config['token_lifetime_seconds'];
    }

    /** Produce the page URL for a browser form containing only the token. */
    public function paymentUrl(): string
    {
        return $this->config['gateway'].'/iuiv3/IPG/Index/';
    }

    /** Get a token for a standard purchase identified by a stored merchant reference. */
    public function tokenize(string $id, int $rials): string
    {
        $response = $this->post('/api/v3/tokenization/make', [
            'authenticationEnvelope' => $this->envelope($rials),
            'request' => [
                'transactionType' => 'Purchase', 'terminalId' => $this->config['terminal_id'],
                'acceptorId' => $this->config['acceptor_id'], 'amount' => $rials,
                'revertUri' => $this->config['callback'], 'requestId' => $id, 'requestTimestamp' => time(),
            ],
        ]);
        $token = $response['result']['token'] ?? '';
        if (($response['status'] ?? null) !== true || ($response['responseCode'] ?? null) !== '00'
            || !is_string($token) || !preg_match('/^[a-z0-9]{1,48}$/iD', $token)) {
            throw new RuntimeException('Iran Kish did not issue a valid token.');
        }
        return $token;
    }

    /** Read the bank's authoritative transaction record for the merchant's request. */
    public function inquiry(string $id): ?array
    {
        $response = $this->post('/api/v3/inquiry/single', [
            'passPhrase' => $this->config['pass_phrase'], 'terminalId' => $this->config['terminal_id'],
            'requestId' => $id, 'findOption' => 3,
        ]);
        $row = $response['result'] ?? null;
        if (is_array($row) && isset($row[0]) && count($row) === 1) $row = $row[0];
        if (($response['status'] ?? null) !== true || ($response['responseCode'] ?? null) !== '00'
            || !is_array($row)) return null;
        return $row;
    }

    /** Confirm the bank transaction whose identifiers came from the inquiry response. */
    public function confirm(array $row): void
    {
        $this->post('/api/v3/confirmation/purchase', [
            'terminalId' => $this->config['terminal_id'], 'tokenIdentity' => $row['tokenIdentity'],
            'retrievalReferenceNumber' => $row['retrievalReferenceNumber'],
            'systemTraceAuditNumber' => $row['systemTraceAuditNumber'],
        ]);
    }

    /** Bind the bank response to the original token, merchant, customer payment and amount. */
    public function matches(array $row, array $payment): bool
    {
        return ($row['requestId'] ?? null) === $payment['id']
            && ($row['tokenIdentity'] ?? null) === $payment['token']
            && ($row['terminalId'] ?? null) === $this->config['terminal_id']
            && ($row['acceptorId'] ?? null) === $this->config['acceptor_id']
            && (is_int($row['amount'] ?? null) || (is_string($row['amount'] ?? null) && ctype_digit($row['amount'])))
            && (int) $row['amount'] === $payment['rials']
            && ($row['responseCode'] ?? null) === '00'
            && ($row['isReversed'] ?? null) === false
            && is_string($row['retrievalReferenceNumber'] ?? null)
            && preg_match('/^\d{12}$/D', $row['retrievalReferenceNumber'])
            && is_string($row['systemTraceAuditNumber'] ?? null)
            && preg_match('/^\d{1,6}$/D', $row['systemTraceAuditNumber']);
    }

    private function envelope(int $rials): array
    {
        $key = random_bytes(16);
        $iv = random_bytes(16);
        // The diagram and example disagree about this suffix, so use the terminal's agreed variant.
        $suffix = $this->config['purchase_suffix'] === '00' ? '00' : '';
        $bytes = hex2bin($this->config['terminal_id'].$this->config['pass_phrase'].str_pad((string) $rials, 12, '0', STR_PAD_LEFT).$suffix);
        $encrypted = openssl_encrypt($bytes, 'aes-128-cbc', $key, OPENSSL_RAW_DATA, $iv);
        $padding = $this->config['rsa_padding'] === 'oaep' ? OPENSSL_PKCS1_OAEP_PADDING : OPENSSL_PKCS1_PADDING;
        if ($encrypted === false || !openssl_public_encrypt($key.hash('sha256', $encrypted, true), $envelope, $this->config['public_key'], $padding)) {
            throw new RuntimeException('Iran Kish envelope creation failed.');
        }
        return ['iv' => strtoupper(bin2hex($iv)), 'data' => strtoupper(bin2hex($envelope))];
    }

    private function post(string $path, array $payload): array
    {
        if ($this->transport !== null) return ($this->transport)($path, $payload);
        $json = json_encode($payload, JSON_THROW_ON_ERROR);
        $connection = curl_init($this->config['gateway'].$path);
        curl_setopt_array($connection, [
            CURLOPT_POST => true, CURLOPT_POSTFIELDS => $json, CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
            CURLOPT_TIMEOUT => $this->config['request_timeout_seconds'], CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        $body = curl_exec($connection);
        $status = curl_getinfo($connection, CURLINFO_HTTP_CODE);
        curl_close($connection);
        if ($status !== 200 || !is_string($body)) throw new RuntimeException('Iran Kish service unavailable.');
        $response = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($response)) throw new RuntimeException('Invalid Iran Kish response.');
        return $response;
    }
}
