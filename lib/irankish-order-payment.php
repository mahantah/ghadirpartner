<?php
declare(strict_types=1);

/** Keep the server-priced cash requirement and bank receipt on the order. */
final class GpIranKishOrderPayment
{
    /** Validate the requested online portion against the customer order's priced split. */
    public function initialize(array &$order, ?array $prior, array $details, int $wallet): void
    {
        $online = $details['cash_online'] ?? false;
        if (!is_bool($online)) throw new DomainException('روش نقدی معتبر نیست.', 422);
        $settlement = $order['native_settlement'] ?? [];
        $check = $settlement['check_amount'] ?? 0;
        $credit = $settlement['credit_amount'] ?? 0;
        $previous = $prior['irankish_order_payment'] ?? null;
        if ($previous === null && !$online) return;
        if (!is_int($check) || $check < 0 || !is_int($credit) || $credit < 0) {
            throw new DomainException('مبالغ سایر روش‌های تسویه معتبر نیستند.', 422);
        }
        $total = (int) $order['estimated_total'];
        if (($check > 0 && $wallet > 0) || $wallet > $total || $credit > $total - $wallet
            || $check > $total - $wallet - $credit) {
            throw new DomainException('ترکیب مبالغ تسویه سفارش معتبر نیست.', 422);
        }
        $required = $total - $check - $credit - $wallet;
        $amount = $online ? ($details['cash_amount'] ?? null) : 0;
        if ($online && (!in_array($order['requested_payment_method'], ['cash', 'mixed'], true)
            || !is_int($amount) || $amount < 1 || $amount > $required)) {
            throw new DomainException('مبلغ پرداخت آنلاین باید در محدوده سهم نقدی سفارش باشد.', 422);
        }
        if ($previous !== null && !empty($previous['claim'])) {
            throw new DomainException('ابتدا نتیجه پرداخت آنلاین را بررسی کنید.', 409);
        }
        $receipt = $previous['receipt'] ?? null;
        if ($receipt !== null && $online && $amount !== $receipt['amount']) {
            throw new DomainException('مبلغ پرداخت آنلاین تأییدشده قابل تغییر نیست.', 409);
        }
        $order['credit_checkout'] = [
            'cash_required' => $required, 'credit_reserved' => $credit, 'wallet_reserved' => $wallet,
        ];
        $order['irankish_order_payment'] = ['amount' => $receipt['amount'] ?? $amount, 'receipt' => $receipt];
        $cash = (new GpCreditCheckout())->summary($order);
        if ($cash['cash_confirmed'] > $required - ($receipt === null ? $amount : 0)) {
            throw new DomainException('سهم نقدی از پرداخت‌های ثبت‌شده کمتر است.', 409);
        }
    }

    /** Accept a bank confirmation only while the original order remains payable. */
    public function payable(array $order): bool
    {
        $payment = $order['irankish_order_payment'] ?? [];
        return empty($order['deleted']) && empty($order['approved_at']) && empty($payment['receipt'])
            && ($payment['amount'] ?? 0) > 0
            && in_array($order['status'] ?? '', ['در انتظار تأیید سفارش', 'ثبت شده'], true)
            && !in_array($order['approval_status'] ?? '', ['تأیید شده', 'رد شده', 'تأیید نشد'], true);
    }

    /** Return the current customer's order index without exposing another customer's payment. */
    public function index(array $state, int $orderId, int $customerId): int
    {
        foreach ($state['orders'] ?? [] as $index => $order) {
            if ((int) $order['id'] === $orderId && (int) $order['customer_id'] === $customerId && empty($order['deleted'])) {
                return $index;
            }
        }
        throw new DomainException('سفارش پیدا نشد.', 404);
    }
}
