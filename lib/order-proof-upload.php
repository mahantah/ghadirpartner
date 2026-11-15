<?php
declare(strict_types=1);

/** Attach a missing customer payment image using the existing private proof format. */
final class GpOrderProofUpload
{
    private string $directory;
    private array $policy;
    private ?string $written = null;

    /** Set the protected directory and validate upload limits. */
    public function __construct(string $directory, array $policy)
    {
        foreach (['max_encoded_bytes', 'max_dimension'] as $key) {
            if (!isset($policy[$key]) || !is_int($policy[$key]) || $policy[$key] < 1) {
                throw new RuntimeException('Invalid order proof policy.');
            }
        }
        $this->directory = $directory;
        $this->policy = $policy;
    }

    /** Record one missing proof inside the order database transaction. */
    public function attach(array &$state, int $customerId, int $orderId, string $kind, string $encoded, string $now): array
    {
        if (!in_array($kind, ['cash', 'check'], true)) {
            throw new DomainException('نوع مدرک معتبر نیست.', 422);
        }
        foreach ($state['orders'] ?? [] as $index => $order) {
            if ((int) ($order['id'] ?? 0) === $orderId && (int) ($order['customer_id'] ?? 0) === $customerId && empty($order['deleted'])) {
                return $this->attachTo($state['orders'][$index], $kind, $encoded, $now);
            }
        }
        throw new DomainException('سفارش پیدا نشد.', 404);
    }

    /** Roll back a private file when the order write fails. */
    public function cleanup(): void
    {
        if ($this->written !== null) {
            @unlink($this->written);
        }
    }

    /** Validate order eligibility and append without replacing earlier evidence. */
    private function attachTo(array &$order, string $kind, string $encoded, string $now): array
    {
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
        foreach ($proofs as $proof) {
            if (($proof['kind'] ?? '') === $kind && !empty($proof['proof_token'])) {
                return ['ok' => true, 'kind' => $kind];
            }
        }
        if (strlen($encoded) > $this->policy['max_encoded_bytes']) {
            throw new DomainException('حجم تصویر بیش از حد مجاز است.', 413);
        }
        $bytes = base64_decode($encoded, true);
        $info = $bytes === false ? false : @getimagesizefromstring($bytes);
        if (!$info || !in_array($info['mime'] ?? '', ['image/jpeg', 'image/png'], true) ||
            max($info[0], $info[1]) > $this->policy['max_dimension']) {
            throw new DomainException('تصویر معتبر نیست.', 422);
        }
        if (!is_dir($this->directory) && !@mkdir($this->directory, 0750, true) && !is_dir($this->directory)) {
            throw new RuntimeException('Cannot create private proof directory.');
        }
        $token = bin2hex(random_bytes(24));
        $this->written = $this->directory.'/'.$token.'.php';
        $content = "<?php http_response_code(404); exit; ?>\n".$bytes;
        if (file_put_contents($this->written, $content, LOCK_EX) !== strlen($content)) {
            throw new RuntimeException('Cannot store private proof.');
        }
        @chmod($this->written, 0640);
        $proofs[] = ['kind' => $kind, 'proof_token' => $token, 'proof_mime' => $info['mime']];
        $settlement['proofs'] = $proofs;
        $settlement['proof_token'] = $proofs[0]['proof_token'];
        $settlement['proof_mime'] = $proofs[0]['proof_mime'];
        $settlement['proof_updated_at'] = $now;
        $order['native_settlement'] = $settlement;
        return ['ok' => true, 'kind' => $kind];
    }
}
