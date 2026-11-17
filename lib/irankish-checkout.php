<?php
declare(strict_types=1);

/** Bind a confirmed purchase to the exact priced checkout that requested it. */
final class GpIranKishCheckout
{
    /** Match an opaque checkout ID without accepting numeric or truncated identifiers. */
    public static function validId($id): bool
    {
        return is_string($id) && preg_match('/^[a-f0-9]{20}$/D', $id) === 1;
    }

    /** Bind the checkout to its owner, decisions, and server-priced goods. */
    public function fingerprint(array $request, array $order, int $revisionId, int $revisionVersion): string
    {
        return hash('sha256', json_encode([
            $request, $order['purchase_items'] ?? $order['items'], $order['estimated_total'],
            $order['credit_checkout'], $revisionId, $revisionVersion,
        ], JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE));
    }

    /** Find the previously completed order when a client retries after losing its response. */
    public function completed(array $state, string $id, int $customerId): ?array
    {
        $payment = $this->owned($state, $id, $customerId);
        if (empty($payment['submitted_order_id'])) return null;
        $orders = new GpIranKishOrderPayment();
        return $state['orders'][$orders->index($state, $payment['submitted_order_id'], $customerId)];
    }

    /** Attach payment and claim it in the same transaction that submits the order. */
    public function apply(array &$state, array &$order, string $id, string $fingerprint): void
    {
        $payment = $this->owned($state, $id, (int) $order['customer_id']);
        if (!empty($payment['submitted_order_id']) || !empty($payment['returned_to_wallet']) || !hash_equals($payment['checkout'], $fingerprint)
            || $payment['amount'] !== ($order['irankish_order_payment']['amount'] ?? null)) {
            throw new DomainException('اطلاعات سفارش پس از پرداخت تغییر کرده است.', 409);
        }
        if (empty($payment['reference'])) {
            throw new DomainException('ابتدا نتیجه پرداخت آنلاین را تأیید کنید.', 409);
        }
        $order['irankish_order_payment']['receipt'] = [
            'amount' => $payment['amount'], 'reference' => $payment['reference'], 'at' => $payment['verified_at'],
        ];
        $state['irankish_wallet_payments'][$id]['submitted_order_id'] = (int) $order['id'];
    }

    /** Credit a paid draft that the customer chooses to abandon, at most once. */
    public function returnToWallet(array &$state, string $id, int $customerId, string $now): void
    {
        $payment = $this->owned($state, $id, $customerId);
        if (!empty($payment['returned_to_wallet'])) return;
        if (empty($payment['reference']) || !empty($payment['submitted_order_id'])) {
            throw new DomainException('این پرداخت برای برگشت به کیف پول در دسترس نیست.', 409);
        }
        $state['customer_wallet'][$customerId]['irankish:'.$id] = [
            'amount' => $payment['amount'], 'source' => 'irankish_credit', 'order_id' => 0,
            'number' => '', 'reference' => $payment['reference'], 'at' => $now,
        ];
        $state['irankish_wallet_payments'][$id]['returned_to_wallet'] = true;
    }

    /** Expose only this customer's payment to checkout and reconciliation. */
    public function owned(array $state, string $id, int $customerId): array
    {
        $payment = $state['irankish_wallet_payments'][$id] ?? [];
        if (empty($payment['checkout']) || $payment['customer_id'] !== $customerId) {
            throw new DomainException('پرداخت سفارش پیدا نشد.', 404);
        }
        return $payment;
    }
}
