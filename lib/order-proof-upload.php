<?php
declare(strict_types=1);

/** Attach customer payment documents using the existing private proof format. */
final class GpOrderProofUpload
{
    private string $directory;
    private array $policy;
    private array $written = [];

    /** Set the protected directory and validate upload limits. */
    public function __construct(string $directory, array $policy)
    {
        foreach (['max_encoded_bytes', 'max_dimension', 'max_per_kind', 'max_batch_bytes'] as $key) {
            if (!isset($policy[$key]) || !is_int($policy[$key]) || $policy[$key] < 1) {
                throw new RuntimeException('Invalid order proof policy.');
            }
        }
        $this->directory = $directory;
        $this->policy = $policy;
    }

    /** Load the validated policy beside the order routes. */
    public static function configured(string $directory): self
    {
        $policy = json_decode((string) file_get_contents(dirname(__DIR__).'/config/order-proof-upload.yaml'), true, 512, JSON_THROW_ON_ERROR);
        return new self($directory, $policy);
    }

    /** Record a missing proof from clients using the single-file request. */
    public function attach(array &$state, int $customerId, int $orderId, string $kind, string $encoded, string $now): array
    {
        return $this->attachBatch($state, $customerId, $orderId, $kind, [$encoded], $now, true);
    }

    /** Append a whole selection to a customer-owned order. */
    public function attachBatch(array &$state, int $customerId, int $orderId, string $kind, array $files, string $now, bool $legacy = false): array
    {
        foreach ($state['orders'] ?? [] as $index => $order) {
            if ((int) ($order['id'] ?? 0) === $orderId && (int) ($order['customer_id'] ?? 0) === $customerId && empty($order['deleted'])) {
                return $this->append($state['orders'][$index], $kind, $files, $now, $legacy);
            }
        }
        throw new DomainException('سفارش پیدا نشد.', 404);
    }

    /** Store checkout evidence as part of the new order transaction. */
    public function appendCheckout(array &$order, array $selection, string $now): void
    {
        $totalBytes = 0;
        foreach ($selection as $kind => $files) {
            if (!in_array($kind, ['cash', 'check'], true) || !is_array($files)) {
                throw new DomainException('نوع مدرک معتبر نیست.', 422);
            }
            foreach ($files as $encoded) {
                if (!is_string($encoded)) {
                    throw new DomainException('فایل معتبر نیست.', 422);
                }
                $totalBytes += strlen($encoded);
            }
        }
        if ($totalBytes > $this->policy['max_batch_bytes']) {
            throw new DomainException('حجم مجموع فایل‌ها بیش از حد مجاز است.', 413);
        }
        foreach ($selection as $kind => $files) {
            $this->append($order, $kind, $files, $now);
        }
    }

    /** Roll back private files when the order write fails. */
    public function cleanup(): void
    {
        foreach ($this->written as $path) {
            @unlink($path);
        }
        $this->written = [];
    }

    /** Validate a complete selection before writing and preserve earlier evidence. */
    private function append(array &$order, string $kind, array $files, string $now, bool $legacy = false): array
    {
        if (!in_array($kind, ['cash', 'check'], true)) {
            throw new DomainException('نوع مدرک معتبر نیست.', 422);
        }
        $method = $order['requested_payment_method'] ?? '';
        $settlement = $order['native_settlement'] ?? [];
        if (($method !== $kind && ($method !== 'mixed' || (int) ($settlement[$kind.'_amount'] ?? 0) < 1)) ||
            in_array($order['status'] ?? '', ['لغو شد', 'رد شد', 'رد شده'], true) ||
            in_array($order['approval_status'] ?? '', ['رد شد', 'رد شده'], true)) {
            throw new DomainException('برای این سفارش امکان افزودن این مدرک وجود ندارد.', 409);
        }
        $proofs = $settlement['proofs'] ?? [];
        if (!$proofs && !empty($settlement['proof_token'])) {
            $proofs[] = [
                'kind' => $settlement['kind'] ?? ($method === 'check' ? 'check' : 'cash'),
                'proof_token' => $settlement['proof_token'],
                'proof_mime' => $settlement['proof_mime'] ?? 'image/jpeg',
            ];
        }
        $matching = array_values(array_filter($proofs, static fn (array $proof): bool =>
            ($proof['kind'] ?? '') === $kind && !empty($proof['proof_token'])
        ));
        if ($legacy && $matching) {
            return ['ok' => true, 'kind' => $kind, 'count' => count($matching)];
        }
        if (!$files || array_values($files) !== $files || count($files) > $this->policy['max_per_kind']) {
            throw new DomainException('تعداد فایل‌ها را بررسی کنید.', 422);
        }
        $hashes = [];
        foreach ($matching as $proof) {
            if (!empty($proof['proof_hash'])) {
                $hashes[$proof['proof_hash']] = true;
            }
        }
        $validated = [];
        $totalBytes = 0;
        foreach ($files as $encoded) {
            if (!is_string($encoded)) {
                throw new DomainException('فایل معتبر نیست.', 422);
            }
            $totalBytes += strlen($encoded);
            if ($totalBytes > $this->policy['max_batch_bytes']) {
                throw new DomainException('حجم مجموع فایل‌ها بیش از حد مجاز است.', 413);
            }
            [$bytes, $mime] = $this->decode($encoded);
            $hash = hash('sha256', $bytes);
            if (!isset($hashes[$hash])) {
                $validated[$hash] = [$bytes, $mime];
                $hashes[$hash] = true;
            }
        }
        $count = count($matching) + count($validated);
        if ($count > $this->policy['max_per_kind']) {
            throw new DomainException('حداکثر '. $this->policy['max_per_kind'].' فایل برای هر نوع مدرک مجاز است.', 422);
        }
        if (!$validated) {
            return ['ok' => true, 'kind' => $kind, 'count' => $count];
        }
        foreach ($validated as $hash => [$bytes, $mime]) {
            $proofs[] = $this->store($kind, $bytes, $mime, $hash);
        }
        $settlement['proofs'] = $proofs;
        $settlement['proof_token'] = $proofs[0]['proof_token'];
        $settlement['proof_mime'] = $proofs[0]['proof_mime'];
        $settlement['proof_updated_at'] = $now;
        $order['native_settlement'] = $settlement;
        return ['ok' => true, 'kind' => $kind, 'count' => $count];
    }

    /** Accept decoded photos and bounded PDF documents, checking bytes instead of file names. */
    private function decode(string $encoded): array
    {
        if (strlen($encoded) > $this->policy['max_encoded_bytes']) {
            throw new DomainException('حجم فایل بیش از حد مجاز است.', 413);
        }
        $bytes = base64_decode($encoded, true);
        if ($bytes !== false && preg_match('/^%PDF-[12]\.[0-9]/D', $bytes) &&
            preg_match('/%%EOF[\x00\t\n\f\r ]*$/D', substr($bytes, -1024))) {
            return [$bytes, 'application/pdf'];
        }
        $info = $bytes === false ? false : @getimagesizefromstring($bytes);
        if (!$info || !in_array($info['mime'] ?? '', ['image/jpeg', 'image/png'], true) ||
            max($info[0], $info[1]) > $this->policy['max_dimension']) {
            throw new DomainException('فقط عکس یا فایل PDF معتبر را انتخاب کنید.', 422);
        }
        return [$bytes, $info['mime']];
    }

    /** Store each document in the existing private proof format. */
    private function store(string $kind, string $bytes, string $mime, string $hash): array
    {
        if (!is_dir($this->directory) && !@mkdir($this->directory, 0750, true) && !is_dir($this->directory)) {
            throw new RuntimeException('Cannot create private proof directory.');
        }
        $token = bin2hex(random_bytes(24));
        $path = $this->directory.'/'.$token.'.php';
        $this->written[] = $path;
        $content = "<?php http_response_code(404); exit; ?>\n".$bytes;
        if (file_put_contents($path, $content, LOCK_EX) !== strlen($content)) {
            throw new RuntimeException('Cannot store private proof.');
        }
        @chmod($path, 0640);
        return ['kind' => $kind, 'proof_token' => $token, 'proof_mime' => $mime, 'proof_hash' => $hash];
    }
}
