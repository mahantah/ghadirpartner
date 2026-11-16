<?php
declare(strict_types=1);

require_once __DIR__.'/credit-checkout.php';

/** Record confirmed customer funds in the wallet ledger. */
final class GpOrderWallet
{
    /** Project the customer's wallet from audited transactions visible to that customer. */
    public function read(array $state, int $customerId, int $exceptOrder = 0, bool $staff = false): array
    {
        $entries = array_values($state['customer_wallet'][$customerId] ?? []);
        $balance = array_sum(array_column($entries, 'amount'));
        if (!$staff) {
            foreach ($entries as &$entry) {
                if (($entry['source'] ?? '') === 'manual_credit') {
                    unset($entry['note'], $entry['actor_id']);
                }
            }
            unset($entry);
        }
        $reserved = 0;
        foreach ($state['orders'] ?? [] as $order) {
            if ((int) ($order['customer_id'] ?? 0) !== $customerId || (int) $order['id'] === $exceptOrder
                || !in_array($order['approval_status'] ?? '', ['در انتظار تأیید', 'نیازمند اصلاح'], true)
                || !empty($order['deleted']) || ($order['status'] ?? '') === 'لغو شد') continue;
            $reserved += $order['credit_checkout']['wallet_reserved'] ?? 0;
        }
        return [
            'balance' => $balance, 'reserved' => $reserved, 'available' => max(0, $balance - $reserved),
            'transactions' => array_reverse($entries),
        ];
    }

    /** Record a positive staff credit once under the wallet ledger's write lock. */
    public function creditManually(array &$state, int $customerId, array $request, int $actor, string $now, array $policy): void
    {
        $maxAmount = $policy['max_amount'] ?? null;
        $maxNoteChars = $policy['max_note_chars'] ?? null;
        if (!is_int($maxAmount) || $maxAmount < 1 || !is_int($maxNoteChars) || $maxNoteChars < 1) {
            throw new RuntimeException('Invalid wallet credit policy.');
        }
        $amount = $request['amount'] ?? null;
        if (!is_int($amount) || $amount < 1 || $amount > $maxAmount) {
            throw new DomainException('مبلغ معتبر به تومان وارد کنید.', 422);
        }
        $note = is_string($request['note'] ?? null) ? trim($request['note']) : '';
        if ($note === '' || mb_strlen($note, 'UTF-8') > $maxNoteChars) {
            throw new DomainException('علت افزایش موجودی را بررسی کنید.', 422);
        }
        $requestId = $request['request_id'] ?? null;
        if (!is_string($requestId) || !preg_match('/^[a-f0-9]{32}$/D', $requestId)) {
            throw new DomainException('شناسه درخواست معتبر نیست.', 422);
        }

        $key = 'manual:'.$requestId;
        $saved = $state['customer_wallet'][$customerId][$key] ?? null;
        if ($saved !== null) {
            if ($saved['amount'] !== $amount || $saved['note'] !== $note || $saved['actor_id'] !== $actor) {
                throw new DomainException('درخواست افزایش موجودی قبلاً با مشخصات دیگری ثبت شده است.', 409);
            }
            return;
        }
        $state['customer_wallet'][$customerId][$key] = [
            'amount' => $amount, 'source' => 'manual_credit', 'order_id' => 0, 'number' => '',
            'note' => $note, 'actor_id' => $actor, 'at' => $now,
        ];
    }

    /** Validate new reservations against wallet funds held by all other open orders. */
    public function assertReservation(array $state, array $order): void
    {
        $amount = $order['credit_checkout']['wallet_reserved'] ?? 0;
        if ($amount > 0 && $amount > $this->read($state, (int) $order['customer_id'], (int) $order['id'])['available']) {
            throw new DomainException('موجودی قابل استفاده کیف پول کافی نیست.', 409);
        }
    }

    /** Convert a valid hold into one wallet debit when the order is approved. */
    public function purchase(array &$state, array $order, string $now): void
    {
        $amount = $order['credit_checkout']['wallet_reserved'] ?? 0;
        if ($amount === 0) return;
        $customerId = (int) $order['customer_id'];
        $key = 'purchase:'.$order['id'];
        if (isset($state['customer_wallet'][$customerId][$key])) return;
        $this->assertReservation($state, $order);
        $state['customer_wallet'][$customerId][$key] = [
            'amount' => -$amount, 'source' => 'order_purchase', 'order_id' => (int) $order['id'],
            'number' => (string) $order['number'], 'at' => $now,
        ];
    }

    /** Cancel a returned order once and release its reservations through the order status. */
    public function cancel(array &$state, array &$order, array $request, int $actor, string $now): array
    {
        $choice = $request['destination'] ?? '';
        if (isset($order['customer_credit_cancel'])) {
            if ($order['customer_credit_cancel']['destination'] !== $choice) {
                throw new DomainException('روش بازگشت وجه قبلاً ثبت شده است.', 409);
            }
            return $order['customer_credit_cancel'];
        }

        $checkout = (new GpCreditCheckout())->summary($order);
        if ($checkout === null || ($order['customer_correction']['status'] ?? '') !== 'requested'
            || ($order['status'] ?? '') !== 'نیازمند اصلاح سفارش' || !empty($order['approved_at'])) {
            throw new DomainException('لغو از این مسیر فقط برای سفارش در انتظار اصلاح امکان‌پذیر است.', 409);
        }
        $amount = $checkout['cash_confirmed'];
        if ($amount === 0 ? $choice !== 'none' : !in_array($choice, ['wallet', 'refund'], true)) {
            throw new DomainException('روش بازگشت وجه را انتخاب کنید.', 422);
        }
        $cancel = [
            'destination' => $choice, 'amount' => $amount, 'created_at' => $now, 'created_by' => $actor,
            'status' => $choice === 'refund' ? 'pending' : 'completed',
        ];
        $order['customer_credit_cancel'] = $cancel;
        $order['customer_correction']['status'] = 'cancelled';
        $order['status'] = 'لغو شد';
        $order['approval_status'] = 'رد شده';
        $order['updated_at'] = $now;
        if ($choice === 'wallet') {
            $state['customer_wallet'][(int) $order['customer_id']]['cancel:'.$order['id']] = [
                'amount' => $amount, 'source' => 'order_cancellation', 'order_id' => (int) $order['id'],
                'number' => (string) $order['number'], 'at' => $now,
            ];
        } elseif ($choice === 'refund') {
            $order['followup_events']['refund:'.$order['id']] = [
                'kind' => 'refund', 'id' => (string) $order['id'], 'created_at' => $now,
            ];
        }
        return $cancel;
    }

    /** Consume confirmed wallet funds and credit the invoice's repayment ledger together. */
    public function repay(array &$state, array &$order, string $key, int $amount, int $actor, string $now): void
    {
        $id = (int) $order['customer_id'];
        if ($amount < 1 || $amount > $this->read($state, $id)['available']) {
            throw new DomainException('موجودی کیف پول برای این پرداخت کافی نیست.', 409);
        }
        $state['customer_wallet'][$id]['repayment:'.$order['id'].':'.$key] = [
            'amount' => -$amount, 'source' => 'credit_repayment', 'order_id' => (int) $order['id'],
            'number' => (string) $order['number'], 'at' => $now,
        ];
        $order['credit_repayments'][$key] = [
            'id' => $key, 'amount' => $amount, 'claimed_amount' => $amount, 'status' => 'approved',
            'source' => 'wallet', 'proofs' => [], 'created_by' => $actor, 'created_at' => $now,
            'reviewed_at' => $now,
        ];
    }

    /** Record completion only after finance confirms an external refund reference. */
    public function completeRefund(array &$order, array $request, int $actor, string $now): void
    {
        $refund = &$order['customer_credit_cancel'];
        if (($refund['destination'] ?? '') !== 'refund') {
            throw new DomainException('درخواست بازگشت وجه پیدا نشد.', 404);
        }
        if ($refund['status'] === 'completed') return;
        $reference = $request['reference'] ?? null;
        if (!is_string($reference) || trim($reference) === '' || strlen($reference) > 200) {
            throw new DomainException('مرجع واریز وجه را وارد کنید.', 422);
        }
        $refund['status'] = 'completed';
        $refund['reference'] = trim($reference);
        $refund['reviewed_by'] = $actor;
        $refund['reviewed_at'] = $now;
        unset($order['followup_events']['refund:'.$order['id']]);
    }
}
