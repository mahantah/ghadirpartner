<?php
declare(strict_types=1);

require_once __DIR__.'/order-proof-upload.php';

/** Store order shipping documents through the existing private attachment client. */
final class GpOrderShippingReceipts
{
    private GpOrderProofUpload $uploads;
    /** @var array<string, mixed> */
    private array $policy;

    /** Inject the protected attachment client and validate the bounded receipt policy. */
    public function __construct(GpOrderProofUpload $uploads, array $policy)
    {
        foreach (['max_receipts_per_order', 'max_carrier_chars', 'max_tracking_chars', 'max_note_chars', 'image_dimension', 'jpeg_quality'] as $key) {
            if (!isset($policy[$key]) || !is_int($policy[$key]) || $policy[$key] < 1) {
                throw new RuntimeException('Invalid shipping receipt policy.');
            }
        }
        if (!isset($policy['staff_roles']) || !is_array($policy['staff_roles']) || !$policy['staff_roles']
            || array_filter($policy['staff_roles'], static fn ($role): bool => !is_string($role) || $role === 'customer')) {
            throw new RuntimeException('Invalid shipping receipt permissions.');
        }
        $this->uploads = $uploads;
        $this->policy = $policy;
    }

    /** Construct the facade alongside the existing private order proof directory. */
    public static function configured(string $directory): self
    {
        $policy = json_decode((string) file_get_contents(dirname(__DIR__).'/config/order-shipping-receipts.yaml'), true, 512, JSON_THROW_ON_ERROR);
        return new self(GpOrderProofUpload::configured($directory), $policy);
    }

    /** Apply the configured staff capability to both receipt reads and writes. */
    public function staff(array $roles): bool
    {
        return (bool) array_intersect($roles, $this->policy['staff_roles']);
    }

    /** Locate a live order and enforce customer ownership before any document access. */
    public function index(array $state, int $orderId, int $customerId): int
    {
        foreach ($state['orders'] ?? [] as $index => $order) {
            if ((int) ($order['id'] ?? 0) === $orderId && empty($order['deleted'])
                && ($customerId === 0 || (int) ($order['customer_id'] ?? 0) === $customerId)) {
                return $index;
            }
        }
        throw new DomainException('سفارش پیدا نشد.', 404);
    }

    /** Return attachment metadata without loading images into the orders list. */
    public function summary(array $order): array
    {
        $receipts = [];
        foreach ($order['shipping_receipts'] ?? [] as $receipt) {
            $public = array_intersect_key($receipt, array_flip(['id', 'carrier', 'tracking_code', 'note', 'created_at']));
            $public['files'] = array_map(static fn (array $proof): array =>
                array_intersect_key($proof, array_flip(['proof_token', 'proof_mime', 'note'])), $receipt['files']);
            $receipts[] = $public;
        }
        $uploadPolicy = json_decode((string) file_get_contents(dirname(__DIR__).'/config/order-proof-upload.yaml'), true, 512, JSON_THROW_ON_ERROR);
        return ['order_id' => (int) $order['id'], 'receipts' => $receipts, 'policy' => $this->policy,
            'upload' => $uploadPolicy];
    }

    /** Append a complete receipt once, retaining earlier shipments and retry identity. */
    public function append(array &$order, array $request, int $actorId, string $now): array
    {
        $id = $request['request_id'] ?? '';
        if (!is_string($id) || !preg_match('/^[a-f0-9]{32}$/D', $id)) {
            throw new DomainException('شناسه رسید معتبر نیست.', 422);
        }
        $carrier = $this->text($request, 'carrier', $this->policy['max_carrier_chars']);
        $tracking = $this->text($request, 'tracking_code', $this->policy['max_tracking_chars']);
        $note = $this->text($request, 'note', $this->policy['max_note_chars']);
        $files = $request['files'] ?? null;
        if ($carrier === '' || !is_array($files) || !$files || array_values($files) !== $files) {
            throw new DomainException('نام پیک یا باربری و فایل رسید را وارد کنید.', 422);
        }
        $fingerprint = hash('sha256', json_encode([$carrier, $tracking, $note, $files], JSON_THROW_ON_ERROR));
        $previous = $order['shipping_receipts'][$id] ?? null;
        if ($previous !== null) {
            if (!hash_equals($previous['fingerprint'], $fingerprint)) {
                throw new DomainException('این شناسه برای رسید دیگری ثبت شده است.', 409);
            }
            return $this->summary($order);
        }
        if (count($order['shipping_receipts'] ?? []) >= $this->policy['max_receipts_per_order']) {
            throw new DomainException('تعداد رسیدهای این سفارش به حد مجاز رسیده است.', 422);
        }
        $stored = $this->uploads->storeSelection('shipping', $files);
        $order['shipping_receipts'][$id] = [
            'id' => $id, 'carrier' => $carrier, 'tracking_code' => $tracking, 'note' => $note,
            'created_at' => $now, 'created_by' => $actorId, 'fingerprint' => $fingerprint, 'files' => $stored,
        ];
        return $this->summary($order);
    }

    /** Resolve a token only when it belongs to a shipping receipt on the selected order. */
    public function document(array $order, string $token): array
    {
        foreach ($order['shipping_receipts'] ?? [] as $receipt) {
            foreach ($receipt['files'] as $proof) {
                if (hash_equals($proof['proof_token'], $token)) return $this->uploads->read($proof);
            }
        }
        throw new DomainException('رسید ارسال پیدا نشد.', 404);
    }

    /** Retain private files after the database transaction has committed. */
    public function commit(): void
    {
        $this->uploads->commit();
    }

    private function text(array $request, string $key, int $limit): string
    {
        $value = $request[$key] ?? '';
        if (!is_string($value) || mb_strlen($value) > $limit) {
            throw new DomainException('اطلاعات رسید را بررسی کنید.', 422);
        }
        return trim($value);
    }
}
