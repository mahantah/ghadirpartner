<?php
declare(strict_types=1);

/** Track the server-priced credit checkout and cash reviewed during its initial approval. */
final class GpCreditCheckout
{
    /** Flag new agent orders before any checkout can reserve or collect money. */
    public function startAgentReview(array &$order, array $settlement): void
    {
        foreach ($order['purchase_items'] ?? [] as $item) {
            if (($item['price_key'] ?? '') !== 'sales_agent') continue;
            if (($settlement['cash_online'] ?? false) === true || ($settlement['wallet_amount'] ?? 0) > 0) {
                throw new DomainException('پرداخت آنلاین و کیف پول پس از بررسی تسویه عامل فروش در دسترس است.', 409);
            }
            $order['agent_settlement_review'] = [
                'status' => 'staff_review',
                'reason' => is_string($settlement['agent_change_reason'] ?? null) ? trim($settlement['agent_change_reason']) : '',
            ];
            return;
        }
    }

    /** Set the cash requirement for new cash-plus-credit orders after authoritative pricing. */
    public function initialize(array &$order, ?array $previous, int $walletAmount): void
    {
        $settlement = $order['native_settlement'] ?? [];
        $cash = $settlement['cash_amount'] ?? 0;
        $check = $settlement['check_amount'] ?? 0;
        $credit = $settlement['credit_amount'] ?? 0;
        $method = $order['requested_payment_method'] ?? '';
        // A returned agent order has already passed the exact quote and credit commitment checks.
        $terms = $previous['customer_correction']['settlement_amounts'] ?? [];
        $agentMixed = ($previous['agent_settlement_review']['status'] ?? '') === 'awaiting_customer'
            && $method === 'mixed' && is_int($check) && $check > 0 && is_int($credit) && $credit > 0
            && $cash === ($terms['cash_amount'] ?? null) && $check === ($terms['check_amount'] ?? null)
            && $credit === ($terms['credit_amount'] ?? null) && $walletAmount === 0 && ($terms['wallet_amount'] ?? null) === 0;
        if ($method === 'credit' && $credit === 0 && $walletAmount === 0) $credit = (int) $order['estimated_total'];
        if ($method === 'cash' && (isset($previous['credit_checkout']) || $walletAmount > 0)) {
            $cash = (int) $order['estimated_total'] - $walletAmount;
        }
        if ($agentMixed || isset($previous['credit_checkout']) || $walletAmount > 0 || $method === 'credit' || ($method === 'mixed'
            && $cash > 0 && $credit > 0 && $check === 0)) {
            $total = (int) $order['estimated_total'];
            $chequePortion = $agentMixed ? $check : 0;
            if (!is_int($cash) || !is_int($credit) || $cash < 0 || $credit < 0 || $walletAmount < 0
                || $cash !== $total - $credit - $walletAmount - $chequePortion
                || (!$agentMixed && $check !== 0) || !in_array($method, ['mixed', 'cash', 'credit'], true)) {
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
        $confirmed = $this->confirmedCash($order);
        return [
            'cash_required' => $required,
            'wallet_amount' => $order['credit_checkout']['wallet_reserved'] ?? 0,
            'cash_confirmed' => $confirmed,
            'cash_remaining' => max(0, $required - $confirmed),
        ];
    }

    /** Count confirmed cash even when an agent order's credit reservation has not started. */
    public function confirmedCash(array $order): int
    {
        $confirmed = (int) ($order['irankish_order_payment']['receipt']['amount'] ?? 0);
        foreach ($order['order_receipt_reviews'] ?? [] as $review) {
            if (($review['status'] ?? '') === 'approved') $confirmed += $review['amount'];
        }
        return $confirmed;
    }

    /** Reject progression and price edits until the original server-priced split is covered. */
    public function assertApproval(array $order, int $total): void
    {
        if (isset($order['agent_settlement_review'])) {
            if (($order['agent_settlement_review']['status'] ?? '') !== 'customer_resubmitted') {
                throw new DomainException('ابتدا شرایط تسویه را برای مشتری ارسال کنید و منتظر ارسال دوباره بمانید.', 409);
            }
            if ($total !== (int) $order['estimated_total']) {
                throw new DomainException('مبلغ تأیید نهایی باید با فاکتور ارسال‌شده به مشتری برابر باشد.', 409);
            }
        }
        $cash = $this->summary($order);
        if ($cash === null) return;
        if ($total !== $order['estimated_total']) {
            throw new DomainException('برای تغییر مبلغ، سفارش را برای اصلاح برگردانید.', 409);
        }
        if ($cash['cash_remaining'] > 0) {
            throw new DomainException('ابتدا سهم نقدی سفارش را تسویه و تأیید کنید.', 409);
        }
    }

    /** Hand a verified order to the existing preparation and shipping flow. */
    public function recordApproval(array &$order): void
    {
        if (!isset($order['credit_checkout'])) return;
        // Legacy approval still accounts for the cheque portion of a mixed order.
        if (($order['native_settlement']['check_amount'] ?? 0) > 0) return;
        $credit = $order['credit_checkout']['credit_reserved'];
        $order['payment_method'] = $credit > 0 ? 'credit' : 'cash';
        $order['payment_method_label'] = $credit > 0 ? 'اعتباری' : 'تسویه نقدی یا کیف پول';
        $order['payment_status'] = $credit > 0 ? 'اعتباری' : 'تسویه کامل';
        if ($credit > 0) $order['credit_status'] = 'تأیید شده';
    }

    /** Reject bypasses through status, archive and legacy order mutation routes. */
    public function assertTransition(array $prior, array $order): void
    {
        if (isset($prior['agent_settlement_review']) && empty($order['deleted'])
            && (($order['approval_status'] ?? '') === 'تأیید شده'
                || in_array($order['status'] ?? '', ['در حال آماده سازی', 'آماده ارسال', 'ارسال شد', 'تحویل شد'], true))) {
            $this->assertApproval($prior, (int) ($order['approved_total'] ?? 0));
        }
        if (!isset($prior['credit_checkout'])) return;
        if ($prior['customer_id'] !== $order['customer_id'] || !isset($order['credit_checkout'])) {
            throw new DomainException('انتقال یا حذف حساب مالی سفارش مجاز نیست.', 409);
        }
        $cancelled = !empty($order['deleted']) || ($order['status'] ?? '') === 'لغو شد'
            || in_array($order['approval_status'] ?? '', ['رد شده', 'تأیید نشد'], true);
        $wasCancelled = !empty($prior['deleted']) || ($prior['status'] ?? '') === 'لغو شد'
            || in_array($prior['approval_status'] ?? '', ['رد شده', 'تأیید نشد'], true);
        $bank = $prior['irankish_order_payment'] ?? [];
        if (!empty($bank['claim']) && ($cancelled || ($order['status'] ?? '') === 'نیازمند اصلاح سفارش')) {
            throw new DomainException('ابتدا نتیجه پرداخت آنلاین را بررسی کنید.', 409);
        }
        if (!empty($bank['receipt']) && ($order['irankish_order_payment']['receipt'] ?? null) !== $bank['receipt']) {
            throw new DomainException('رسید ایران‌کیش قابل تغییر نیست.', 409);
        }
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
        if (($order['approval_status'] ?? '') !== 'تأیید شده') return false;
        if ($cash !== null) return $cash['cash_remaining'] === 0;
        return ($order['requested_payment_method'] ?? '') === 'credit'
            && ($order['payment_status'] ?? '') === 'اعتباری'
            && ($order['credit_status'] ?? '') === 'تأیید شده';
    }

    /** Prevent edits that would reverse or overstate a confirmed initial payment. */
    public function assertReceipt(array $order, int $previous, int $amount): void
    {
        $cash = $this->summary($order);
        if ($cash === null) return;
        $confirmed = $cash['cash_confirmed'] - $previous + $amount;
        $bank = $order['irankish_order_payment'] ?? [];
        $onlineReserved = empty($bank['receipt']) ? (int) ($bank['amount'] ?? 0) : 0;
        if ($confirmed > $cash['cash_required'] - $onlineReserved) {
            throw new DomainException('مبلغ ثبت‌شده از سهم نقدی سفارش بیشتر است.', 409);
        }
        if (($order['approval_status'] ?? '') === 'تأیید شده' && $confirmed < $cash['cash_required']) {
            throw new DomainException('این فیش مبنای تأیید سفارش است و تغییر مبلغ آن نیاز به اصلاح مالی سفارش دارد.', 409);
        }
    }
}
