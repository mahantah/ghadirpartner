<?php
declare(strict_types=1);

/** Track the server-priced credit checkout and cash reviewed during its initial approval. */
final class GpCreditCheckout
{
    /** Set the cash requirement for new cash-plus-credit orders after authoritative pricing. */
    public function initialize(array &$order, ?array $previous, int $walletAmount): void
    {
        $settlement = $order['native_settlement'] ?? [];
        $cash = $settlement['cash_amount'] ?? 0;
        $credit = $settlement['credit_amount'] ?? 0;
        $method = $order['requested_payment_method'] ?? '';
        if ($method === 'credit' && $credit === 0 && $walletAmount === 0) $credit = (int) $order['estimated_total'];
        if ($method === 'cash' && (isset($previous['credit_checkout']) || $walletAmount > 0)) {
            $cash = (int) $order['estimated_total'] - $walletAmount;
        }
        if (isset($previous['credit_checkout']) || $walletAmount > 0 || $method === 'credit' || ($method === 'mixed'
            && $cash > 0 && $credit > 0 && ($settlement['check_amount'] ?? 0) === 0)) {
            $total = (int) $order['estimated_total'];
            if (!is_int($cash) || !is_int($credit) || $cash < 0 || $credit < 0 || $walletAmount < 0 || $cash !== $total - $credit - $walletAmount
                || ($settlement['check_amount'] ?? 0) !== 0 || !in_array($order['requested_payment_method'], ['mixed', 'cash', 'credit'], true)) {
                throw new DomainException('جمع مبلغ نقدی و اعتباری باید برابر مبلغ نهایی سفارش باشد.', 422);
            }
            $order['credit_checkout'] = ['cash_required' => $cash, 'credit_reserved' => $credit, 'wallet_reserved' => $walletAmount];
            if ($this->summary($order)['cash_confirmed'] > $cash) {
                throw new DomainException('سهم نقدی نمی‌تواند کمتر از فیش‌های تأییدشده باشد.', 409);
            }
        }
    }

    /** Show confirmed initial payment and the amount still awaiting finance review. */
    public function summary(array $order): ?array
    {
        if (!isset($order['credit_checkout'])) return null;
        $required = $order['credit_checkout']['cash_required'];
        $confirmed = 0;
        foreach ($order['order_receipt_reviews'] ?? [] as $review) {
            if (($review['status'] ?? '') === 'approved') $confirmed += $review['amount'];
        }
        return [
            'cash_required' => $required,
            'wallet_amount' => $order['credit_checkout']['wallet_reserved'] ?? 0,
            'cash_confirmed' => $confirmed,
            'cash_remaining' => max(0, $required - $confirmed),
        ];
    }

    /** Reject progression and price edits until the original server-priced split is covered. */
    public function assertApproval(array $order, int $total): void
    {
        $cash = $this->summary($order);
        if ($cash === null) return;
        if ($total !== $order['estimated_total']) {
            throw new DomainException('برای تغییر مبلغ، سفارش را برای اصلاح برگردانید.', 409);
        }
        if ($cash['cash_remaining'] > 0) {
            throw new DomainException('ابتدا فیش‌های سهم نقدی سفارش را تأیید کنید.', 409);
        }
    }

    /** Hand a verified order to the existing preparation and shipping flow. */
    public function recordApproval(array &$order): void
    {
        if (!isset($order['credit_checkout'])) return;
        $credit = $order['credit_checkout']['credit_reserved'];
        $order['payment_method'] = $credit > 0 ? 'credit' : 'cash';
        $order['payment_method_label'] = $credit > 0 ? 'اعتباری' : 'تسویه نقدی یا کیف پول';
        $order['payment_status'] = $credit > 0 ? 'اعتباری' : 'تسویه کامل';
        if ($credit > 0) $order['credit_status'] = 'تأیید شده';
    }

    /** Reject bypasses through status, archive and legacy order mutation routes. */
    public function assertTransition(array $prior, array $order): void
    {
        if (!isset($prior['credit_checkout'])) return;
        if ($prior['customer_id'] !== $order['customer_id'] || !isset($order['credit_checkout'])) {
            throw new DomainException('انتقال یا حذف حساب مالی سفارش مجاز نیست.', 409);
        }
        $cancelled = !empty($order['deleted']) || ($order['status'] ?? '') === 'لغو شد'
            || in_array($order['approval_status'] ?? '', ['رد شده', 'تأیید نشد'], true);
        $wasCancelled = !empty($prior['deleted']) || ($prior['status'] ?? '') === 'لغو شد'
            || in_array($prior['approval_status'] ?? '', ['رد شده', 'تأیید نشد'], true);
        if (!$cancelled && $wasCancelled) {
            throw new DomainException('بازگرداندن سفارش لغوشده به گردش مالی مجاز نیست.', 409);
        }
        if ($cancelled && !$wasCancelled && !isset($order['customer_credit_cancel'])
            && ($this->summary($prior)['cash_confirmed'] > 0 || ($prior['approval_status'] ?? '') === 'تأیید شده')) {
            throw new DomainException('برای لغو سفارش دارای پرداخت تأییدشده از گردش بازگشت وجه استفاده کنید.', 409);
        }
        if (!$cancelled && in_array($order['status'] ?? '', ['در حال آماده سازی', 'آماده ارسال', 'ارسال شد', 'تحویل شد'], true)) {
            if (($order['approval_status'] ?? '') !== 'تأیید شده') {
                throw new DomainException('این سفارش هنوز تأیید نشده است.', 409);
            }
            $this->assertApproval($order, (int) ($order['approved_total'] ?? 0));
        }
    }

    /** Unlock repayments before delivery after acceptance of payment and of the order. */
    public function canRepay(array $order): bool
    {
        if (($order['status'] ?? '') === 'تحویل شد') return true;
        $cash = $this->summary($order);
        return $cash !== null && $cash['cash_remaining'] === 0 && ($order['approval_status'] ?? '') === 'تأیید شده';
    }

    /** Prevent edits that would reverse or overstate a confirmed initial payment. */
    public function assertReceipt(array $order, int $previous, int $amount): void
    {
        $cash = $this->summary($order);
        if ($cash === null) return;
        $confirmed = $cash['cash_confirmed'] - $previous + $amount;
        if ($confirmed > $cash['cash_required']) {
            throw new DomainException('مبلغ ثبت‌شده از سهم نقدی سفارش بیشتر است.', 409);
        }
        if (($order['approval_status'] ?? '') === 'تأیید شده' && $confirmed < $cash['cash_required']) {
            throw new DomainException('این فیش مبنای تأیید سفارش است و تغییر مبلغ آن نیاز به اصلاح مالی سفارش دارد.', 409);
        }
    }
}
