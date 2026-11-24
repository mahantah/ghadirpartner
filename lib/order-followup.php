<?php
declare(strict_types=1);

require_once __DIR__.'/customer-credit.php';
require_once __DIR__.'/credit-checkout.php';
require_once __DIR__.'/order-settlement-progress.php';
require_once __DIR__.'/order-proof-upload.php';
require_once __DIR__.'/order-edit-review.php';

/** Manage credit repayments and order corrections under the order database lock. */
final class GpOrderFollowup
{
    private GpCreditModel $credit;
    private GpOrderProofUpload $uploads;
    private GpCreditCheckout $checkout;
    private array $policy;

    /** Inject the balance model, transaction-scoped upload store and validated limits. */
    public function __construct(GpCreditModel $credit, GpOrderProofUpload $uploads, array $policy)
    {
        foreach (['max_note_chars', 'max_amount', 'inbox_limit'] as $key) {
            if (!is_int($policy[$key] ?? null) || $policy[$key] < 1) {
                throw new RuntimeException('Invalid order follow-up policy.');
            }
        }
        $this->credit = $credit;
        $this->checkout = new GpCreditCheckout();
        $this->uploads = $uploads;
        $this->policy = $policy;
    }

    /** Build the facade using the same protected proof store as checkout. */
    public static function configured(string $directory): self
    {
        $policy = json_decode((string) file_get_contents(dirname(__DIR__).'/config/order-followup.yaml'), true, 512, JSON_THROW_ON_ERROR);
        return new self(new GpCreditModel(), GpOrderProofUpload::configured($directory), $policy);
    }

    /** Retain all uploaded files once the order transaction commits. */
    public function commit(): void
    {
        $this->uploads->commit();
    }

    /** Locate an order scoped to its customer for any portal action. */
    public function index(array $state, int $id, int $customerId): int
    {
        foreach ($state['orders'] ?? [] as $i => $order) {
            if ((int) ($order['id'] ?? 0) === $id && empty($order['deleted']) &&
                ($customerId === 0 || (int) ($order['customer_id'] ?? 0) === $customerId)) {
                return $i;
            }
        }
        throw new DomainException('سفارش پیدا نشد.', 404);
    }

    /** Return balance and current actions for a specific order. */
    public function summary(array $order): array
    {
        $outstanding = $this->credit->debt($order);
        $pending = $this->pendingAmount($order);
        return [
            'order_id' => (int) $order['id'],
            'number' => (string) ($order['number'] ?? ''),
            'credit_amount' => $this->credit->amount($order),
            'outstanding' => $outstanding,
            'settlement_progress' => (new GpOrderSettlementProgress($this->credit))->read($order),
            'pending_amount' => $pending,
            'submittable_amount' => max(0, $outstanding - $pending),
            'can_submit' => $outstanding > $pending && $this->checkout->canRepay($order),
            'initial_payment' => $this->checkout->summary($order),
            'cancellation' => $order['customer_credit_cancel'] ?? null,
            'can_cancel' => isset($order['credit_checkout']) && ($order['customer_correction']['status'] ?? '') === 'requested',
            'can_return' => $this->canReturn($order),
            'proofs' => $this->orderProofs($order),
            'repayments' => array_values(array_map(static function (array $payment): array {
                unset($payment['submission_hash']);
                return $payment;
            }, $order['credit_repayments'] ?? [])),
            'correction' => $order['customer_correction'] ?? null,
            'order_edit_review' => $order['order_edit_review'] ?? null,
            'agent_settlement_review' => $order['agent_settlement_review'] ?? null,
            'agent_settlement_amounts' => isset($order['agent_settlement_review']) ? $this->settlementAmounts($order) : null,
            'agent_final_review' => $this->isAgentFinalReview($order),
        ];
    }

    /** Record a customer's claimed payment without applying it to the balance. */
    public function submit(array &$order, array $request, int $actor, string $now): array
    {
        $key = $this->requestKey($request);
        $files = $request['files'] ?? null;
        if (!is_array($files) || !$files || array_values($files) !== $files) {
            throw new DomainException('تصویر یا PDF فیش را ضمیمه کنید.', 422);
        }
        $separate = !array_key_exists('amount', $request);
        $amounts = [];
        $total = 0;
        if ($separate) {
            foreach ($files as $file) {
                if (!is_array($file)) throw new DomainException('مبلغ هر فیش را وارد کنید.', 422);
                $amount = $this->amount($file);
                if ($amount > PHP_INT_MAX - $total) throw new DomainException('جمع مبالغ معتبر نیست.', 422);
                $total += $amount;
                $amounts[] = $amount;
            }
        } else {
            $total = $this->amount($request);
            $amounts[] = $total;
        }
        $fingerprint = hash('sha256', serialize([$amounts, $files]));
        $prior = $order['credit_repayments'][$key] ?? null;
        if ($prior !== null) {
            if (isset($prior['submission_hash']) && !hash_equals($prior['submission_hash'], $fingerprint)) {
                throw new DomainException('این فیش قبلاً ثبت شده است. برای واریز جدید، جزئیات سفارش را دوباره باز کنید.', 409);
            }
            return $this->summary($order);
        }
        $summary = $this->summary($order);
        if (!$summary['can_submit'] || $total > $summary['submittable_amount']) {
            throw new DomainException('پس از تأیید اولیه سفارش می‌توانید تا سقف مانده پس از کسر فیش‌های در انتظار بررسی، فیش جدید ارسال کنید.', 409);
        }
        $existingHashes = [];
        foreach ($order['credit_repayments'] ?? [] as $repayment) {
            if (($repayment['status'] ?? '') === 'rejected') continue;
            foreach ($repayment['proofs'] ?? [] as $proof) {
                if (!empty($proof['proof_hash'])) $existingHashes[] = $proof['proof_hash'];
            }
        }
        $proofs = $this->uploads->storeSelection('cash', $files, $existingHashes, $separate);
        $groups = $separate ? array_map(static fn (array $proof): array => [$proof], $proofs) : [$proofs];
        foreach ($groups as $index => $documents) {
            $id = $index === 0 ? $key : bin2hex(random_bytes(16));
            $order['credit_repayments'][$id] = [
                'id' => $id, 'status' => 'pending', 'claimed_amount' => $amounts[$index], 'amount' => 0,
                'proofs' => $documents, 'source' => 'customer', 'created_at' => $now, 'created_by' => $actor,
                'submission_hash' => $fingerprint,
            ];
            $this->event($order, 'credit_proof', $id, $now);
        }
        return $this->summary($order);
    }

    /** Apply a chosen wallet payment and register any bank receipts atomically. */
    public function submitWithWallet(array &$state, array &$order, array $request, int $actor, string $now): array
    {
        $walletAmount = $request['wallet_amount'] ?? null;
        if (!is_int($walletAmount) || $walletAmount < 1 || $walletAmount > $this->policy['max_amount']) {
            throw new DomainException('مبلغ پرداخت از کیف پول معتبر نیست.', 422);
        }
        $key = $this->requestKey($request);
        $walletKey = substr(hash('sha256', 'wallet:'.$key), 0, 32);
        $hash = hash('sha256', serialize([$walletAmount, $request['files'] ?? []]));
        $previous = $order['credit_repayments'][$walletKey] ?? null;
        if ($previous !== null) {
            if (($previous['submission_hash'] ?? '') !== $hash) {
                throw new DomainException('این درخواست با مبلغ یا مدارک دیگری ثبت شده است.', 409);
            }
            return $this->summary($order);
        }
        if (isset($order['credit_repayments'][$key])) {
            throw new DomainException('این شناسه قبلاً برای فیش واریزی ثبت شده است.', 409);
        }
        $summary = $this->summary($order);
        if (!$summary['can_submit'] || $walletAmount > $summary['submittable_amount']) {
            throw new DomainException('پرداخت از کیف پول از مبلغ قابل تسویه بیشتر است.', 409);
        }
        if (!is_array($request['files'] ?? [])) {
            throw new DomainException('مدارک پرداخت معتبر نیست.', 422);
        }
        (new GpOrderWallet())->repay($state, $order, $walletKey, $walletAmount, $actor, $now);
        $order['credit_repayments'][$walletKey]['submission_hash'] = $hash;
        if (!empty($request['files'])) {
            unset($request['amount']);
            return $this->submit($order, $request, $actor, $now);
        }
        return $this->summary($order);
    }

    private function pendingAmount(array $order): int
    {
        $amount = 0;
        foreach ($order['credit_repayments'] ?? [] as $payment) {
            if (($payment['status'] ?? '') === 'pending') {
                $amount += max(0, (int) ($payment['claimed_amount'] ?? 0));
            }
        }
        return $amount;
    }

    /** Approve, reject or manually record a payment once, using the verified amount. */
    public function review(array &$order, array $request, string $action, int $actor, string $now): array
    {
        $key = $this->requestKey($request);
        $existing = $order['credit_repayments'][$key] ?? null;
        if ($action === 'manual') {
            if (isset($order['credit_checkout']) && !$this->checkout->canRepay($order)) {
                throw new DomainException('تسویه اعتبار پس از تأیید اولیه سفارش امکان‌پذیر است.', 409);
            }
            if ($existing !== null) {
                return $this->summary($order);
            }
            if (in_array($order['approval_status'] ?? '', ['نیازمند اصلاح', 'رد شده'], true)) {
                throw new DomainException('ابتدا وضعیت سفارش را مشخص کنید.', 409);
            }
            $existing = [
                'id' => $key, 'claimed_amount' => 0, 'proofs' => [], 'source' => 'staff',
                'created_at' => $now, 'created_by' => $actor,
            ];
        } elseif ($existing === null) {
            throw new DomainException('فیش پیدا نشد.', 404);
        } elseif ($action === 'adjust') {
            if ($existing['status'] !== 'approved' || ($existing['source'] ?? '') === 'wallet') {
                throw new DomainException('فقط مبلغ تسویه تأییدشده قابل اصلاح است.', 409);
            }
            $previousAmount = $request['previous_amount'] ?? null;
            if (!is_int($previousAmount) || $previousAmount !== $existing['amount']) {
                throw new DomainException('مبلغ تسویه تغییر کرده است. سفارش را دوباره باز کنید.', 409);
            }
        } elseif ($existing['status'] !== 'pending') {
            return $this->summary($order);
        }
        if ($action === 'approve' && ($request['seen'] ?? null) !== true) {
            throw new DomainException('مشاهده فیش را پیش از تأیید ثبت کنید.', 422);
        }
        $note = $this->note($request, $action !== 'approve');
        $amount = $action === 'reject' ? 0 : $this->amount($request);
        $prior = $action === 'adjust' ? $existing['amount'] : 0;
        if ($amount > $this->credit->debt($order) + $prior) {
            throw new DomainException('مبلغ ثبت‌شده از مانده بدهی سفارش بیشتر است.', 409);
        }
        if ($action === 'adjust') {
            $existing['adjustments'][] = ['before' => $prior, 'after' => $amount, 'by' => $actor, 'at' => $now, 'note' => $note];
        }
        $order['credit_repayments'][$key] = array_merge($existing, [
            'status' => $action === 'reject' ? 'rejected' : 'approved', 'amount' => $amount,
            'review_note' => $note, 'reviewed_by' => $actor, 'reviewed_at' => $now,
        ]);
        unset($order['followup_events']['credit_proof:'.$key]);
        return $this->summary($order);
    }

    /** Record staff review of a checkout receipt separately from credit repayments. */
    public function reviewOrderReceipt(array &$order, array $request, string $action, int $actor, string $now): array
    {
        $token = $request['token'] ?? null;
        $receipts = array_column($this->orderProofs($order), null, 'proof_token');
        if (!is_string($token) || ($receipts[$token]['kind'] ?? '') !== 'cash') {
            throw new DomainException('فیش واریزی این سفارش پیدا نشد.', 404);
        }
        if (isset($order['customer_credit_cancel'])) {
            throw new DomainException('تغییر فیش سفارش لغوشده مجاز نیست.', 409);
        }
        $existing = $order['order_receipt_reviews'][$token] ?? [];
        $status = $existing['status'] ?? 'pending';
        $isAdjustment = $action === 'adjust_order_receipt';
        if ($isAdjustment) {
            if ($status !== 'approved' || ($request['previous_amount'] ?? null) !== ($existing['amount'] ?? null)) {
                throw new DomainException('وضعیت یا مبلغ فیش تغییر کرده است. جزئیات را دوباره باز کنید.', 409);
            }
        } elseif ($status !== 'pending') {
            return $this->summary($order);
        }
        $rejected = $action === 'reject_order_receipt';
        if (!$rejected && !$isAdjustment && ($request['seen'] ?? null) !== true) {
            throw new DomainException('ابتدا پیش‌نمایش فیش را باز کنید.', 422);
        }
        $note = $this->note($request, $rejected || $isAdjustment);
        $amount = $rejected ? 0 : $this->amount($request);
        $this->checkout->assertReceipt($order, (int) ($existing['amount'] ?? 0), $amount);
        $record = ['status' => $rejected ? 'rejected' : 'approved', 'amount' => $amount,
            'review_note' => $note, 'reviewed_by' => $actor, 'reviewed_at' => $now];
        $entry = $record + ['action' => $action, 'previous_amount' => $existing['amount'] ?? null];
        $record['history'] = array_merge($existing['history'] ?? [], [$entry]);
        $order['order_receipt_reviews'][$token] = $record;
        return $this->summary($order);
    }

    /** Request corrections only before stock allocation, delivery or a confirmed repayment. */
    public function returnOrder(array &$order, array $request, int $actor, string $now): array
    {
        $key = $this->requestKey($request);
        if (($order['customer_correction']['request_id'] ?? '') === $key) {
            return $this->summary($order);
        }
        if (!$this->canReturn($order)) {
            throw new DomainException('این سفارش در مرحله‌ای نیست که بتوان آن را برای اصلاح برگرداند.', 409);
        }
        $reason = $this->note($request, true);
        $version = (int) ($order['customer_correction']['version'] ?? 0) + 1;
        $terms = null;
        if (isset($order['agent_settlement_review'])) {
            $amounts = $request['settlement_amounts'] ?? null;
            if (!is_array($amounts)) throw new DomainException('مبالغ پیشنهادی تسویه را وارد کنید.', 422);
            $terms = $this->agentTerms($order, $amounts);
            $order['agent_settlement_review']['status'] = 'awaiting_customer';
        }
        $order['customer_correction'] = [
            'version' => $version, 'request_id' => $key, 'status' => 'requested',
            'reason' => $reason, 'requested_at' => $now, 'requested_by' => $actor,
        ];
        if ($terms !== null) $order['customer_correction']['settlement_amounts'] = $terms;
        $order['approval_status'] = 'نیازمند اصلاح';
        $order['status'] = 'نیازمند اصلاح سفارش';
        foreach (array_keys($order['followup_events'] ?? []) as $event) {
            if (strpos($event, 'revision:') === 0) unset($order['followup_events'][$event]);
        }
        return $this->summary($order);
    }

    /** Verify a revision targets the owner's current correction and has no reserved inventory. */
    public function revisionIndex(array $state, int $id, int $customerId, int $version): int
    {
        $index = $this->index($state, $id, $customerId);
        $correction = $state['orders'][$index]['customer_correction'] ?? [];
        if (($correction['version'] ?? 0) !== $version || ($correction['status'] ?? '') !== 'requested'
            || ($state['orders'][$index]['status'] ?? '') !== 'نیازمند اصلاح سفارش'
            || !empty($state['orders'][$index]['exit_items'])
            || $this->hasAllocatedStock($state['orders'][$index])) {
            throw new DomainException('درخواست اصلاح تغییر کرده است. سفارش را دوباره باز کنید.', 409);
        }
        return $index;
    }

    /** Reuse the original order identity, confirmation context and payment documents on resubmission. */
    public function preserveRevision(array $previous, array &$order, array $newFiles, string $now): void
    {
        if (isset($previous['agent_settlement_review'])) {
            $order['agent_settlement_review'] = $previous['agent_settlement_review'];
            $order['agent_settlement_review']['status'] = 'customer_resubmitted';
        }
        foreach (['number', 'created_at', 'created_by', 'history', 'credit_repayments', 'followup_events', 'customer_correction', 'correction_history', 'order_receipt_reviews'] as $key) {
            if (array_key_exists($key, $previous)) $order[$key] = $previous[$key];
        }
        $proofs = $previous['native_settlement']['proofs'] ?? [];
        $order['correction_history'][] = [
            'version' => $previous['customer_correction']['version'],
            'reason' => $previous['customer_correction']['reason'],
            'requested_at' => $previous['customer_correction']['requested_at'],
            'resubmitted_at' => $now,
            'previous_items' => $previous['purchase_items'] ?? [],
            'previous_total' => $previous['estimated_total'] ?? 0,
            'previous_proofs' => $proofs,
        ];
        foreach ($proofs as $proof) {
            $kind = $proof['kind'] ?? '';
            $method = $order['requested_payment_method'] ?? '';
            $confirmed = isset($previous['credit_checkout']) && $kind === 'cash'
                && ($previous['order_receipt_reviews'][$proof['proof_token']]['status'] ?? '') === 'approved';
            if ($confirmed && !empty($proof['proof_hash'])
                && in_array($proof['proof_hash'], array_column($order['native_settlement']['proofs'] ?? [], 'proof_hash'), true)) {
                throw new DomainException('این فیش قبلاً تأیید شده است. فقط فیش جدید را بارگذاری کنید.', 409);
            }
            if (!$confirmed && (isset($newFiles[$kind]) || ($kind !== $method && ($method !== 'mixed'
                || (int) ($order['native_settlement'][$kind.'_amount'] ?? 0) < 1)))) continue;
            $order['native_settlement']['proofs'][] = $proof;
        }
        $current = $order['native_settlement']['proofs'][0] ?? null;
        if ($current !== null) {
            $order['native_settlement']['proof_token'] = $current['proof_token'];
            $order['native_settlement']['proof_mime'] = $current['proof_mime'];
        }
        $order['customer_correction']['status'] = 'resubmitted';
        $order['customer_correction']['resubmitted_at'] = $now;
        $this->event($order, 'revision', (string) $order['customer_correction']['version'], $now);
        GpOrderEditReview::record($previous, $order, $now);
    }

    /** Reject a changed quote before attaching proof, reserving wallet or opening the bank gateway. */
    public function assertAgentRevision(array $prior, array $order, array $settlement): void
    {
        $terms = $prior['customer_correction']['settlement_amounts'] ?? null;
        if ($terms === null) return;
        $this->agentTerms($prior, $settlement);
        foreach ($terms as $field => $amount) {
            $enabled = substr($field, 0, -strlen('_amount')).'_enabled';
            if ($amount !== ($settlement[$field] ?? 0) || ($amount > 0 && ($settlement[$enabled] ?? false) !== true)) {
                throw new DomainException('مبالغ تسویه باید مطابق شرایط اعلام‌شده توسط شرکت باشد.', 409);
            }
        }
        if ($prior['estimated_total'] !== $order['estimated_total']) {
            throw new DomainException('مبلغ فاکتور تغییر کرده است. برای دریافت شرایط جدید با شرکت تماس بگیرید.', 409);
        }
        if ($this->settlementItems($prior) !== $this->settlementItems($order)) {
            throw new DomainException('اقلام فاکتور باید مطابق سفارش بررسی‌شده باشند.', 409);
        }
    }

    private function settlementItems(array $order): array
    {
        $lines = [];
        foreach ($order['purchase_items'] ?? [] as $item) {
            $lines[] = [(string) ($item['product'] ?? $item['name'] ?? ''), (int) ($item['qty'] ?? 0),
                (string) ($item['price_key'] ?? ''), (int) ($item['line_total'] ?? 0), (string) ($item['panel_switch'] ?? '')];
        }
        sort($lines);
        return $lines;
    }

    private function settlementAmounts(array $order): array
    {
        $details = $order['native_settlement'] ?? [];
        $total = (int) ($order['estimated_total'] ?? 0);
        $method = $order['requested_payment_method'] ?? '';
        return [
            'cash_amount' => (int) ($details['cash_amount'] ?? ($method === 'cash' ? $total : 0)),
            'check_amount' => (int) ($details['check_amount'] ?? ($method === 'check' ? $total : 0)),
            'credit_amount' => (int) ($details['credit_amount'] ?? ($method === 'credit' ? $total : 0)),
            'wallet_amount' => (int) ($order['credit_checkout']['wallet_reserved'] ?? 0),
        ];
    }

    private function agentTerms(array $order, array $input): array
    {
        $amounts = [];
        $remaining = (int) $order['estimated_total'];
        foreach (array_keys($this->settlementAmounts($order)) as $field) {
            $amount = $input[$field] ?? 0;
            if (!is_int($amount) || $amount < 0 || $amount > min($remaining, $this->policy['max_amount'])) {
                throw new DomainException('مبالغ تسویه باید معتبر و برابر مبلغ فاکتور باشند.', 422);
            }
            $amounts[$field] = $amount;
            $remaining -= $amount;
        }
        if ($remaining !== 0 || ($amounts['check_amount'] > 0 && ($amounts['credit_amount'] > 0 || $amounts['wallet_amount'] > 0))) {
            throw new DomainException('جمع تسویه باید برابر فاکتور باشد و چک با اعتبار یا کیف پول ترکیب نمی‌شود.', 422);
        }
        if ($amounts['cash_amount'] < ($this->checkout->summary($order)['cash_confirmed'] ?? 0)) {
            throw new DomainException('سهم نقدی نمی‌تواند کمتر از مبلغ تأییدشده باشد.', 409);
        }
        return $amounts;
    }

    /** Build staff alerts from active reviews instead of copying customer data into a second queue. */
    public function alerts(array $state, bool $showCredit, bool $showCorrections): array
    {
        $items = [];
        foreach ($state['orders'] ?? [] as $order) {
            if (!empty($order['deleted'])) continue;
            $reviewAlert = GpOrderEditReview::alert($order, $showCredit, $showCorrections);
            $decisionAlert = false;
            $agentStatus = $order['agent_settlement_review']['status'] ?? '';
            if ($showCorrections && (($agentStatus === 'staff_review' && $this->canReturn($order)) || $this->isAgentFinalReview($order))) {
                $decisionAlert = true;
                $kind = $agentStatus === 'staff_review' ? 'agent_settlement' : 'agent_final_review';
                $items[] = ['kind' => $kind, 'created_at' => (string) ($order['updated_at'] ?? $order['created_at']),
                    'order_id' => (int) $order['id'], 'number' => (string) $order['number']];
            }
            foreach ($order['followup_events'] ?? [] as $event) {
                if ($agentStatus !== '' && $event['kind'] === 'revision') continue;
                if (in_array($event['kind'], ['credit_proof', 'refund'], true) ? !$showCredit : !$showCorrections) continue;
                if ($event['kind'] === 'revision') $decisionAlert = true;
                $items[] = $event + ['order_id' => (int) $order['id'], 'number' => (string) $order['number']];
            }
            if (!$decisionAlert && $reviewAlert !== null) $items[] = $reviewAlert;
        }
        usort($items, static fn (array $a, array $b): int => strcmp($b['created_at'], $a['created_at']));
        return ['count' => count($items), 'items' => array_slice($items, 0, $this->policy['inbox_limit'])];
    }

    /** Resolve a token only inside the already authorized order. */
    public function document(array $order, string $token): array
    {
        $sets = [$this->orderProofs($order)];
        foreach ($order['credit_repayments'] ?? [] as $payment) $sets[] = $payment['proofs'];
        foreach ($sets as $files) {
            foreach ($files as $file) {
                if ($file['proof_token'] === $token) return $this->uploads->read($file);
            }
        }
        throw new DomainException('فایل پیدا نشد.', 404);
    }

    private function orderProofs(array $order): array
    {
        $settlement = $order['native_settlement'] ?? [];
        $proofs = $settlement['proofs'] ?? [];
        if (!$proofs && !empty($settlement['proof_token'])) {
            $proofs[] = [
                'kind' => $settlement['kind'] ?? (($order['requested_payment_method'] ?? '') === 'check' ? 'check' : 'cash'),
                'proof_token' => $settlement['proof_token'],
                'proof_mime' => $settlement['proof_mime'] ?? 'image/jpeg',
            ];
        }
        return array_values(array_map(static function (array $proof) use ($order): array {
            $review = $order['order_receipt_reviews'][$proof['proof_token'] ?? ''] ?? [];
            if ($review) {
                $proof['review'] = array_intersect_key($review, array_flip(['status', 'amount', 'review_note']));
            }
            return $proof;
        }, $proofs));
    }

    private function canReturn(array $order): bool
    {
        return in_array($order['status'] ?? '', ['در انتظار تأیید سفارش', 'ثبت شده'], true)
            && (int) ($order['customer_id'] ?? 0) > 0
            && in_array($order['source'] ?? '', ['customer', ''], true)
            && empty($order['irankish_order_payment']['claim'])
            && !empty($order['purchase_items']) && empty($order['approved_at'])
            && empty($order['exit_items']) && ($order['payment_status'] ?? '') !== 'تسویه کامل' && $this->credit->repaid($order) === 0
            && !$this->hasAllocatedStock($order);
    }

    private function isAgentFinalReview(array $order): bool
    {
        return ($order['agent_settlement_review']['status'] ?? '') === 'customer_resubmitted'
            && ($order['approval_status'] ?? '') === 'در انتظار تأیید'
            && ($order['status'] ?? '') === 'در انتظار تأیید سفارش';
    }

    private function hasAllocatedStock(array $order): bool
    {
        return (bool) array_filter($order['items'] ?? [], static fn (array $item): bool => !empty($item['serials']));
    }

    private function amount(array $request): int
    {
        $amount = $request['amount'] ?? null;
        if (!is_int($amount) || $amount < 1 || $amount > $this->policy['max_amount']) {
            throw new DomainException('مبلغ معتبر به تومان وارد کنید.', 422);
        }
        return $amount;
    }

    private function note(array $request, bool $required): string
    {
        $note = is_string($request['note'] ?? null) ? trim($request['note']) : '';
        if (($required && $note === '') || mb_strlen($note) > $this->policy['max_note_chars']) {
            throw new DomainException('توضیحات عملیات را بررسی کنید.', 422);
        }
        return $note;
    }

    private function requestKey(array $request): string
    {
        $key = $request['request_id'] ?? null;
        if (!is_string($key) || !preg_match('/^[a-f0-9]{32}$/D', $key)) {
            throw new DomainException('شناسه درخواست معتبر نیست.', 422);
        }
        return $key;
    }

    private function event(array &$order, string $kind, string $id, string $now): void
    {
        $order['followup_events'][$kind.':'.$id] = ['kind' => $kind, 'id' => $id, 'created_at' => $now];
    }
}
