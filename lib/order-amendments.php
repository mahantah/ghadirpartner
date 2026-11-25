<?php
declare(strict_types=1);

/** Manage customer-approved proposals separately from the live order and its ledgers. */
final class GpOrderAmendments
{
    private const PARTS = ['cash_amount', 'check_amount', 'credit_amount', 'wallet_amount'];
    private const PURCHASE_TYPES = ['serial', 'panel', 'agent'];
    private array $policy;

    /** Reuse the configured follow-up limits for amounts and text. */
    public function __construct(array $policy)
    {
        $this->policy = $policy;
    }

    /** Identify orders with a customer-facing purchase snapshot. */
    public function eligible(array $order): bool
    {
        return (int) ($order['customer_id'] ?? 0) > 0
            && !empty($order['purchase_items'])
            && in_array($order['source'] ?? 'customer', ['', 'customer'], true);
    }

    /** Give staff a prefilled form from the recorded version and expose the latest proposal. */
    public function summary(array $order): array
    {
        $history = $order['amendments'] ?? [];
        $latest = $history ? end($history) : null;
        if ($latest !== null) unset($latest['order_hash'], $latest['request_hash']);
        return [
            'can_propose_amendment' => $this->eligible($order),
            'amendment' => $latest,
            'amendment_basis' => $this->basis($order),
            'amendment_mixed_terms' => $this->mixedTerms($order),
            'amendment_current' => $this->eligible($order) ? $this->current($order) : null,
        ];
    }

    /** Permit precisely the amounts approved by finance for this revision of this order. */
    public function approveMixedTerms(array &$order, string $basis, $input, int $actor, string $now): void
    {
        if (!$this->eligible($order)) {
            throw new DomainException('این سفارش برای اصلاحیهٔ مشتری قابل انتخاب نیست.', 409);
        }
        if (!is_array($input)) throw new DomainException('مبالغ تسویه را وارد کنید.', 422);
        $remaining = $this->policy['max_amount'];
        $terms = [];
        foreach (self::PARTS as $part) {
            $min = in_array($part, ['check_amount', 'credit_amount'], true) ? 1 : 0;
            $max = $part === 'wallet_amount' ? 0 : $remaining;
            $terms[$part] = $this->amount($input[$part] ?? null, $min, $max);
            $remaining -= $terms[$part];
        }
        if (isset($order['agent_settlement_review']) && array_sum($terms) !== (int) ($order['estimated_total'] ?? 0)) {
            throw new DomainException('جمع تسویه باید برابر مبلغ فاکتور عامل فروش باشد.', 422);
        }
        $existing = $this->mixedTerms($order);
        if ($existing === $terms) return;
        if ($basis !== $this->basis($order)) {
            throw new DomainException('سفارش تغییر کرده است. جزئیات را دوباره باز کنید.', 409);
        }
        $order['amendment_mixed_approval'] = [
            'terms' => $terms, 'order_hash' => $this->orderHash($order), 'actor' => $actor, 'at' => $now,
        ];
    }

    /** Return the finance-approved split while it still matches the current order. */
    public function mixedTerms(array $order): ?array
    {
        $approval = $order['amendment_mixed_approval'] ?? [];
        return ($approval['order_hash'] ?? null) === $this->orderHash($order) ? $approval['terms'] : null;
    }

    /** Record or resend a proposal without touching operational totals, payments or shipping. */
    public function propose(array &$order, array $request, string $key, string $reason, string $now): array
    {
        if (!$this->eligible($order)) throw new DomainException('این سفارش برای اصلاحیهٔ مشتری قابل انتخاب نیست.', 409);
        $proposal = $this->validate($request['proposal'] ?? null, $this->shipping($order) !== '');
        $basis = $request['basis'] ?? '';
        $fingerprint = hash('sha256', serialize([$proposal, $reason, $basis]));
        $history = $order['amendments'] ?? [];
        if (isset($history[$key])) {
            if ($history[$key]['request_hash'] !== $fingerprint) {
                throw new DomainException('این درخواست قبلاً با اطلاعات دیگری ثبت شده است.', 409);
            }
            return $history[$key];
        }
        if ($basis !== $this->basis($order)) {
            throw new DomainException('سفارش یا اصلاحیه تغییر کرده است. جزئیات را دوباره باز کنید.', 409);
        }
        $settlement = $proposal['settlement'];
        if ($settlement['check_amount'] > 0 && $settlement['credit_amount'] > 0 && $settlement !== $this->mixedTerms($order)) {
            throw new DomainException('ترکیب چک و اعتبار فقط با تأیید همین مبالغ توسط امور مالی مجاز است.', 422);
        }
        $previousKey = array_key_last($history);
        if ($previousKey !== null && $history[$previousKey]['status'] === 'pending') {
            $history[$previousKey]['status'] = 'superseded';
        }
        if ($previousKey !== null && $history[$previousKey]['status'] === 'accepted'
            && (empty($history[$previousKey]['checked']['finance']) || empty($history[$previousKey]['checked']['shipping']))) {
            throw new DomainException('قبل از ارسال اصلاحیهٔ تازه، پیگیری نسخهٔ تأییدشده را تکمیل کنید.', 409);
        }
        $current = $this->current($order);
        $proposal += [
            'id' => $key, 'version' => count($history) + 1, 'status' => 'pending',
            'reason' => $reason, 'sent_at' => $now, 'previous_total' => $current['total'],
            'difference' => $proposal['total'] - $current['total'], 'checked' => [],
            'order_hash' => $this->orderHash($order), 'request_hash' => $fingerprint,
        ];
        $history[$key] = $proposal;
        $order['amendments'] = $history;
        return $proposal;
    }

    /** Accept or reject exactly the latest proposal using the authenticated order owner. */
    public function decide(array &$order, string $id, string $decision, string $now): array
    {
        $entry = &$this->latest($order, $id);
        if ($entry['status'] === $decision) return $entry;
        if ($entry['status'] !== 'pending' || $entry['order_hash'] !== $this->orderHash($order)) {
            throw new DomainException('سفارش یا اصلاحیه تغییر کرده است. جزئیات جدید را بررسی کنید.', 409);
        }
        $entry['status'] = $decision;
        $entry['decided_at'] = $now;
        return $entry;
    }

    /** Track manual accounting and dispatch follow-up independently after customer acceptance. */
    public function check(array &$order, string $id, string $part, string $now): array
    {
        $entry = &$this->latest($order, $id);
        if ($entry['status'] !== 'accepted') {
            throw new DomainException('ابتدا مشتری باید اصلاحیه را تأیید کند.', 409);
        }
        $entry['checked'][$part] ??= $now;
        return $entry;
    }

    /** Emit one staff queue item until the relevant follow-up is recorded. */
    public function alert(array $order, bool $finance, bool $sales): ?array
    {
        $history = $order['amendments'] ?? [];
        $entry = $history ? end($history) : null;
        if (($entry['status'] ?? '') !== 'accepted' || !(($finance && empty($entry['checked']['finance']))
            || ($sales && empty($entry['checked']['shipping'])))) return null;
        return [
            'kind' => 'amendment_accepted', 'created_at' => $entry['decided_at'],
            'order_id' => (int) $order['id'], 'number' => (string) ($order['number'] ?? ''),
        ];
    }

    private function &latest(array &$order, string $id): array
    {
        if ($id === '' || array_key_last($order['amendments'] ?? []) !== $id) {
            throw new DomainException('نسخهٔ جدیدتری از اصلاحیه وجود دارد.', 409);
        }
        return $order['amendments'][$id];
    }

    private function current(array $order): array
    {
        return [
            'total' => (int) (($order['approved_total'] ?? 0) ?: ($order['estimated_total'] ?? 0)),
            'invoice' => (string) ($order['invoice_type'] ?? ''),
            'shipping' => $this->shipping($order),
            'address' => (string) ($order['shipping_address'] ?? $order['address'] ?? ''),
            'items' => array_values(array_map(static function (array $row): array {
                $type = (string) ($row['price_key'] ?? '');
                if (strpos($type, 'serial_') === 0) $type = 'serial';
                if (strpos($type, 'panel_') === 0) $type = 'panel';
                if ($type === 'sales_agent') $type = 'agent';
                return [
                    'product' => (string) ($row['product'] ?? $row['name'] ?? ''),
                    'quantity' => (int) ($row['qty'] ?? 0),
                    'unit' => (int) ($row['unit_price'] ?? $row['price'] ?? 0),
                    'type' => $type, 'switch' => (string) ($row['panel_switch'] ?? ''),
                ];
            }, $order['purchase_items'] ?? [])),
            'settlement' => array_combine(self::PARTS, array_map(static function (string $part) use ($order): int {
                return (int) ($order['native_settlement'][$part] ?? 0);
            }, self::PARTS)),
        ];
    }

    private function orderHash(array $order): string
    {
        return hash('sha256', serialize([$this->current($order), $order['status'] ?? '',
            $order['payment_status'] ?? '', $order['customer_id'] ?? 0]));
    }

    private function shipping(array $order): string
    {
        return trim((string) ($order['shipping_type'] ?? ''));
    }

    private function basis(array $order): string
    {
        $last = array_key_last($order['amendments'] ?? []);
        return hash('sha256', serialize([$this->orderHash($order), $last, $order['amendments'][$last] ?? null, $order['amendment_mixed_approval'] ?? null]));
    }

    private function validate($input, bool $shippingRequired): array
    {
        if (!is_array($input) || !is_array($input['items'] ?? null)
            || !$input['items'] || count($input['items']) > $this->policy['inbox_limit']) {
            throw new DomainException('اقلام اصلاحیه را بررسی کنید.', 422);
        }
        $items = [];
        $subtotal = 0;
        foreach ($input['items'] as $row) {
            if (!is_array($row) || !in_array($row['type'] ?? '', self::PURCHASE_TYPES, true)) {
                throw new DomainException('نوع خرید هر کالا را انتخاب کنید.', 422);
            }
            $quantity = $this->amount($row['quantity'] ?? null, 1, 2147483647);
            $unit = $this->amount($row['unit'] ?? null, 0, intdiv($this->policy['max_amount'] - $subtotal, $quantity));
            $subtotal += $unit * $quantity;
            $items[] = [
                'product' => $this->text($row['product'] ?? null, true),
                'quantity' => $quantity,
                'unit' => $unit,
                'type' => $row['type'], 'switch' => $this->text($row['switch'] ?? '', false),
            ];
        }
        $total = $this->amount($input['total'] ?? null, 0, $this->policy['max_amount']);
        $remaining = $total;
        $settlement = [];
        $parts = $input['settlement'] ?? null;
        if (!is_array($parts)) throw new DomainException('مبالغ تسویه را وارد کنید.', 422);
        foreach (self::PARTS as $part) {
            $settlement[$part] = $this->amount($parts[$part] ?? null, 0, $remaining);
            $remaining -= $settlement[$part];
        }
        if ($remaining !== 0 || !in_array($input['invoice'] ?? '', ['رسمی', 'غیررسمی'], true)) {
            throw new DomainException('نوع فاکتور و برابری جمع تسویه با مبلغ نهایی را بررسی کنید.', 422);
        }
        if ($settlement['check_amount'] > 0 && $settlement['wallet_amount'] > 0) {
            throw new DomainException('چک با کیف پول ترکیب نمی‌شود.', 422);
        }
        return [
            'items' => $items, 'total' => $total, 'settlement' => $settlement, 'invoice' => $input['invoice'],
            'shipping' => $this->text($input['shipping'] ?? null, $shippingRequired),
            'address' => $this->text($input['address'] ?? '', false),
        ];
    }

    private function text($value, bool $required): string
    {
        $value = is_string($value) ? trim($value) : '';
        if (($required && $value === '') || mb_strlen($value) > $this->policy['max_note_chars']) {
            throw new DomainException('متن یکی از فیلدهای اصلاحیه را بررسی کنید.', 422);
        }
        return $value;
    }

    private function amount($value, int $minimum, int $maximum): int
    {
        if (!is_int($value) || $value < $minimum || $value > $maximum) {
            throw new DomainException('تعداد کالا، مبلغ یا جمع تسویه معتبر نیست.', 422);
        }
        return $value;
    }
}
