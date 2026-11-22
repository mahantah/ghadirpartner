<?php
declare(strict_types=1);

require_once __DIR__.'/credit-checkout.php';
require_once __DIR__.'/portal-account.php';

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

    /** Return the customer's own requests without the bank account or staff audit fields. */
    public function refundRequests(array $state, int $customerId): array
    {
        return array_values(array_map(static fn (array $row): array => array_intersect_key(
            $row, array_flip(['request_id', 'amount', 'status', 'reference', 'at'])
        ), $state['wallet_refund_requests'][$customerId] ?? []));
    }

    /** Register a request exactly once without debiting the wallet. */
    public function requestRefund(array &$state, int $customerId, array $request, string $now, array $policy): array
    {
        $key = $request['request_id'] ?? null;
        $amount = $request['amount'] ?? null;
        $limit = $policy['max_amount'] ?? null;
        if (!is_int($limit) || $limit < 1) throw new RuntimeException('Invalid wallet refund policy.');
        if (!is_string($key) || !preg_match('/^[a-f0-9]{32}$/D', $key)
            || !is_int($amount) || $amount < 1 || $amount > $limit) {
            throw new DomainException('مبلغ یا شماره شبای درخواست معتبر نیست.', 422);
        }
        $saved = $state['wallet_refund_requests'][$customerId][$key] ?? null;
        if ($saved !== null) {
            if ($saved['amount'] !== $amount) {
                throw new DomainException('درخواست عودت با مشخصات دیگری ثبت شده است.', 409);
            }
            return ['request_id' => $key, 'status' => $saved['status']];
        }
        $bank = (new GpPortalAccount())->bank($state, $customerId);
        $destination = $bank['iban'];
        if ($destination === '' || $bank['bank_name'] === '') {
            throw new DomainException('ابتدا شماره شبا و نام بانک را در ویرایش اطلاعات ثبت کنید.', 422);
        }
        foreach ($state['wallet_refund_requests'][$customerId] ?? [] as $row) {
            if (in_array($row['status'], ['pending', 'approved'], true)) {
                throw new DomainException('درخواست عودت قبلی هنوز باز است.', 409);
            }
        }
        if ($amount > $this->read($state, $customerId)['available']) {
            throw new DomainException('موجودی قابل استفاده کیف پول کافی نیست.', 409);
        }
        $state['wallet_refund_requests'][$customerId][$key] = [
            'request_id' => $key, 'amount' => $amount, 'destination' => $destination, 'bank_name' => $bank['bank_name'],
            'status' => 'pending', 'at' => $now,
        ];
        return ['request_id' => $key, 'status' => 'pending'];
    }

    /** List wallet requests and bank refunds from cancelled orders in the finance queue. */
    public function refundQueue(array $state): array
    {
        $rows = [];
        $customers = array_column($state['customers'] ?? [], 'name', 'id');
        foreach ($state['wallet_refund_requests'] ?? [] as $id => $refunds) {
            foreach ($refunds as $row) {
                $rows[] = $row + ['kind' => 'wallet', 'customer_id' => (int) $id, 'customer' => $customers[$id] ?? ''];
            }
        }
        foreach ($state['orders'] ?? [] as $order) {
            $row = $order['customer_credit_cancel'] ?? [];
            if (($row['destination'] ?? '') !== 'refund') continue;
            $id = (int) ($order['customer_id'] ?? 0);
            $rows[] = array_replace($row, ['kind' => 'order', 'order_id' => (int) $order['id'],
                'number' => $order['number'] ?? '', 'customer_id' => $id, 'customer' => $customers[$id] ?? '',
                'destination' => '', 'at' => $row['at'] ?? $order['updated_at'] ?? '']);
        }
        usort($rows, static function (array $left, array $right): int {
            $priority = static fn (array $row): int => in_array($row['status'], ['pending', 'approved'], true) ? 0 : 1;
            return ($priority($left) <=> $priority($right)) ?: strcmp($right['at'], $left['at']);
        });
        return $rows;
    }

    /** Apply staff review under the wallet write lock and debit only on approval. */
    public function reviewWalletRefund(array &$state, int $customerId, string $key, string $action, array $request, int $actor, string $now): void
    {
        if (!isset($state['wallet_refund_requests'][$customerId][$key])) {
            throw new DomainException('درخواست عودت پیدا نشد.', 404);
        }
        $row = &$state['wallet_refund_requests'][$customerId][$key];
        if ($action === 'approve' && $row['status'] === 'approved') return;
        if ($action === 'reject' && $row['status'] === 'rejected') return;
        if ($action === 'paid' && $row['status'] === 'paid') return;
        if (in_array($action, ['approve', 'reject'], true) && $row['status'] === 'pending') {
            if ($action === 'approve') {
                if ($row['amount'] > $this->read($state, $customerId)['available']) {
                    throw new DomainException('موجودی قابل استفاده کیف پول کافی نیست.', 409);
                }
                $state['customer_wallet'][$customerId]['refund:'.$key] = [
                    'amount' => -$row['amount'], 'source' => 'wallet_refund', 'order_id' => 0,
                    'number' => '', 'at' => $now,
                ];
            }
            $row['status'] = $action === 'approve' ? 'approved' : 'rejected';
            $row['reviewed_at'] = $now;
            $row['reviewed_by'] = $actor;
            return;
        }
        if ($action === 'paid' && $row['status'] === 'approved') {
            $reference = $request['reference'] ?? null;
            if (!is_string($reference) || trim($reference) === '' || strlen($reference) > 200) {
                throw new DomainException('مرجع واریز وجه را وارد کنید.', 422);
            }
            $row['status'] = 'paid';
            $row['reference'] = trim($reference);
            $row['paid_at'] = $now;
            $row['paid_by'] = $actor;
            return;
        }
        throw new DomainException('این اقدام برای وضعیت فعلی درخواست مجاز نیست.', 409);
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

        if (!empty($order['irankish_order_payment']['claim'])) {
            throw new DomainException('ابتدا نتیجه پرداخت آنلاین را بررسی کنید.', 409);
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
        $cancel = $this->recordCancellation($state, $order, $choice, $amount, $actor, $now);
        $order['customer_correction']['status'] = 'cancelled';
        $order['status'] = 'لغو شد';
        $order['approval_status'] = 'رد شده';
        $order['updated_at'] = $now;
        return $cancel;
    }

    /** Return confirmed funds while the existing admin cancellation holds the order lock. */
    public function creditStaffCancellation(array &$state, array &$order, int $actor, string $now): void
    {
        if (isset($order['customer_credit_cancel'])) return;
        $checkout = (new GpCreditCheckout())->summary($order);
        if ($checkout === null) return;
        if (!empty($order['irankish_order_payment']['claim'])) {
            throw new DomainException('ابتدا نتیجه پرداخت آنلاین را بررسی کنید.', 409);
        }
        if (!empty($order['shipment_batches']) || !empty($order['exit_items'])) {
            throw new DomainException('سفارش دارای خروج یا ارسال از این مسیر قابل لغو نیست.', 409);
        }
        $id = (int) $order['id'];
        $customerId = (int) ($order['customer_id'] ?? 0);
        if ($customerId < 1) return;
        $entries = $state['customer_wallet'][$customerId] ?? [];
        $debit = $entries['purchase:'.$id] ?? [];
        $walletPaid = ($debit['source'] ?? '') === 'order_purchase' && ($debit['order_id'] ?? 0) === $id
            ? max(0, -(int) $debit['amount']) : 0;
        $creditRemaining = (int) ($order['credit_checkout']['credit_reserved'] ?? 0);
        $repaid = 0;
        foreach ($order['credit_repayments'] ?? [] as $payment) {
            $paymentAmount = $payment['amount'] ?? null;
            if (($payment['status'] ?? '') !== 'approved' || !is_int($paymentAmount) || $paymentAmount < 1) continue;
            $confirmed = min($paymentAmount, $creditRemaining);
            $repaid += $confirmed;
            $creditRemaining -= $confirmed;
        }
        $amount = $checkout['cash_confirmed'] + $walletPaid + $repaid;
        if ($amount > 0) $this->recordCancellation($state, $order, 'wallet', $amount, $actor, $now);
    }

    private function recordCancellation(array &$state, array &$order, string $choice, int $amount, int $actor, string $now): array
    {
        $cancel = [
            'destination' => $choice, 'amount' => $amount, 'created_at' => $now, 'created_by' => $actor,
            'status' => $choice === 'refund' ? 'pending' : 'completed',
        ];
        $order['customer_credit_cancel'] = $cancel;
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
