<?php
declare(strict_types=1);

/** Loads the deliberately JSON-compatible subset of YAML without a production YAML extension. */
final class GpOrderPolicyRepository
{
    private string $path;

    /** Keep the policy location explicit so fixture tests never open production configuration. */
    public function __construct(string $path) { $this->path = $path; }

    /** Read validated policy data; malformed configuration must fail closed. */
    public function load(): array
    {
        $raw = file_get_contents($this->path);
        if ($raw === false) throw new RuntimeException('Order policy is unavailable');
        $policy = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
        if (!is_array($policy)) throw new RuntimeException('Invalid order policy');
        $keys = array_keys($policy); sort($keys);
        $expected = ['credit_commitment', 'maximum_quantity', 'rejection_reason_limit', 'serial_tier_threshold'];
        if ($keys !== $expected || !is_int($policy['maximum_quantity']) || $policy['maximum_quantity'] < 1 ||
            !is_int($policy['serial_tier_threshold']) || $policy['serial_tier_threshold'] < 1 ||
            $policy['serial_tier_threshold'] > $policy['maximum_quantity'] ||
            !is_int($policy['rejection_reason_limit']) || $policy['rejection_reason_limit'] < 1 ||
            !is_string($policy['credit_commitment']) || trim($policy['credit_commitment']) === '') {
            throw new RuntimeException('Invalid order policy');
        }
        return $policy;
    }
}

/** Pure order rules shared by creation, legacy editing guards and company review. */
final class GpCustomerOrderFlow
{
    private array $policy;

    /** Accept only a validated policy from the policy repository. */
    public function __construct(array $policy) { $this->policy = $policy; }

    /** Enforce explicit invoice/payment decisions and a real boolean credit commitment. */
    public function validateRequest(array $request): void
    {
        if (!in_array($request['invoice_type'] ?? '', ['رسمی', 'غیررسمی'], true)) {
            throw new InvalidArgumentException('نوع فاکتور را انتخاب کنید');
        }
        if (isset($request['settlement_details']) && !is_array($request['settlement_details'])) {
            throw new InvalidArgumentException('اطلاعات تسویه معتبر نیست');
        }
        $method = $request['requested_payment_method'] ?? '';
        if (!in_array($method, ['cash', 'check', 'credit', 'online'], true)) {
            throw new InvalidArgumentException('روش تسویه را انتخاب کنید');
        }
        if ($method === 'credit' && (($request['settlement_details']['terms_accepted'] ?? false) !== true)) {
            throw new InvalidArgumentException('پذیرش تعهد تسویه اعتباری الزامی است');
        }
        $items = $request['items'] ?? [];
        if (!is_array($items) || !$items) throw new InvalidArgumentException('حداقل یک کالا الزامی است');
        $quantities = []; $serialQuantities = []; $seen = [];
        foreach ($items as $item) {
            if (!is_array($item)) throw new InvalidArgumentException('قلم سفارش معتبر نیست');
            if (!is_string($item['product'] ?? null) || !is_string($item['price_key'] ?? null)) {
                throw new InvalidArgumentException('مدل و نوع خرید معتبر نیست');
            }
            $name = trim($item['product']);
            $qty = $item['qty'] ?? 0;
            $key = (string)($item['price_key'] ?? '');
            $identity = $name . "\0" . $key;
            if ($name === '' || !is_int($qty) || $qty < 1 || isset($seen[$identity])) {
                throw new InvalidArgumentException('مدل، تعداد یا نوع خرید تکراری معتبر نیست');
            }
            $seen[$identity] = true;
            $quantities[$name] = ($quantities[$name] ?? 0) + $qty;
            if ($quantities[$name] > $this->policy['maximum_quantity']) {
                throw new InvalidArgumentException('مجموع تعداد این مدل بیش از حد مجاز است');
            }
            if (strpos($key, 'serial_') === 0) $serialQuantities[$name] = ($serialQuantities[$name] ?? 0) + $qty;
        }
        foreach ($items as $item) {
            $key = (string)($item['price_key'] ?? '');
            $name = trim((string)$item['product']);
            if (strpos($key, 'serial_') === 0) {
                $expected = $serialQuantities[$name] <= $this->policy['serial_tier_threshold'] ? 'serial_1_50' : 'serial_51_200';
                if ($key !== $expected) throw new InvalidArgumentException('قیمت سریال آزاد باید بر اساس مجموع تعداد همان مدل انتخاب شود');
            }
        }
    }

    /** Preserve one physical warehouse row per model and the exact independently priced breakdown. */
    public function fulfillmentItems(array $purchaseItems): array
    {
        $rows = [];
        foreach ($purchaseItems as $item) {
            $name = $item['product'];
            if (!isset($rows[$name])) {
                $rows[$name] = $item;
                $rows[$name]['purchase_lines'] = [$item];
                continue;
            }
            $row = &$rows[$name];
            $row['qty'] += $item['qty'];
            $row['line_total'] += $item['line_total'];
            $row['purchase_lines'][] = $item;
            $row['price_key'] = 'mixed';
            $row['price_label'] = implode(' + ', array_map(static function (array $line): string {
                return $line['price_label'] . ' (' . $line['qty'] . ')';
            }, $row['purchase_lines']));
            // This is a display average only; invoices use purchase_items and integer line_total values.
            $row['unit_price'] = $row['line_total'] / $row['qty'];
            unset($row);
        }
        return array_values($rows);
    }

    /** Capture the exact server-owned text alongside a credit consent without approving payment. */
    public function creditCommitment(array $request): array
    {
        if (($request['requested_payment_method'] ?? '') !== 'credit') return [];
        return ['terms_accepted' => true, 'commitment_text' => $this->policy['credit_commitment'],
            'commitment_sha256' => hash('sha256', $this->policy['credit_commitment'])];
    }

    /** A final company decision cannot revive a cancelled, rejected or fulfilled order. */
    public function assertPending(array $order): void
    {
        if (($order['approval_status'] ?? '') !== 'در انتظار تأیید' ||
            ($order['status'] ?? '') !== 'در انتظار تأیید سفارش') {
            throw new InvalidArgumentException('این سفارش دیگر در انتظار تأیید شرکت نیست');
        }
    }

    /** Reject a pending order without inventing dispatch dates or changing inventory. */
    public function reject(array $order, string $reason, string $username, string $at): array
    {
        $this->assertPending($order);
        $reason = trim($reason);
        if ($reason === '' || preg_match_all('/./us', $reason) > $this->policy['rejection_reason_limit']) {
            throw new InvalidArgumentException('علت عدم تأیید را با طول مجاز وارد کنید');
        }
        foreach ($order['items'] ?? [] as $item) {
            if (!empty($item['serials'])) throw new InvalidArgumentException('سریال تخصیص‌یافته باید پیش از رد سفارش آزاد شود');
        }
        $order['approval_status'] = 'رد شده';
        $order['status'] = 'لغو شد';
        $order['rejection_reason'] = $reason;
        $order['reviewed_by'] = $username;
        $order['reviewed_at'] = $at;
        $order['updated_at'] = $at;
        return $order;
    }

    /** Legacy editors must not discard purchase prices when editing an aggregated warehouse row. */
    public function assertEditable(array $order): void
    {
        foreach ($order['items'] ?? [] as $item) {
            if (count($item['purchase_lines'] ?? []) > 1) {
                throw new InvalidArgumentException('ویرایش اقلام سفارش ترکیبی نیازمند ثبت سفارش اصلاحی است؛ قیمت‌های مستقل نباید حذف شوند');
            }
        }
    }
}
