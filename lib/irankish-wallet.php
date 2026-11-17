<?php
declare(strict_types=1);

require_once __DIR__.'/irankish-wallet-client.php';
require_once __DIR__.'/order-wallet.php';
require_once __DIR__.'/credit-checkout.php';
require_once __DIR__.'/irankish-order-payment.php';
require_once __DIR__.'/irankish-checkout.php';

/** Coordinate the Iran Kish payment with the existing customer wallet ledger. */
final class GpIranKishWallet
{
    private GpIranKishWalletClient $client;
    private Closure $database;

    /** Inject the payment client and the application's transaction boundary. */
    public function __construct(GpIranKishWalletClient $client, Closure $database)
    {
        $this->client = $client;
        $this->database = $database;
    }

    /** Reserve a merchant request and save the token before exposing it to the browser. */
    public function start(int $customerId, int $amount, string $now): array
    {
        $id = bin2hex(random_bytes(10));
        $rials = $this->client->rials($amount);
        $created = ($this->database)(true, static function (array &$state) use ($customerId, $amount, $rials, $id, $now): bool {
            foreach ($state['customers'] ?? [] as $customer) {
                if ((int) ($customer['id'] ?? 0) === $customerId && empty($customer['deleted'])) {
                    $state['irankish_wallet_payments'][$id] = [
                        'id' => $id, 'customer_id' => $customerId, 'amount' => $amount,
                        'rials' => $rials, 'token' => '', 'at' => $now,
                    ];
                    return true;
                }
            }
            return false;
        });
        if (!$created) throw new DomainException('مشتری فعال پیدا نشد.', 404);
        $token = $this->client->tokenize($id, $rials);
        ($this->database)(true, static function (array &$state) use ($id, $token): void {
            $state['irankish_wallet_payments'][$id]['token'] = $token;
        });
        return ['url' => $this->client->paymentUrl(), 'token' => $token];
    }

    /** Create a bank attempt after the order route has validated and priced the draft. */
    public function startCheckout(int $customerId, int $amount, string $fingerprint, string $now): array
    {
        $id = bin2hex(random_bytes(10));
        $rials = $this->client->rials($amount);
        $time = time();
        $attempt = ($this->database)(true, function (array &$state) use ($id, $customerId, $amount, $rials, $fingerprint, $time, $now): array {
            foreach (array_reverse($state['irankish_wallet_payments'] ?? []) as $existing) {
                if (($existing['checkout'] ?? '') === $fingerprint && $existing['customer_id'] === $customerId
                    && empty($existing['submitted_order_id']) && empty($existing['returned_to_wallet'])
                    && (!empty($existing['reference']) || $existing['expires_at'] > $time)) return $existing;
            }
            return $state['irankish_wallet_payments'][$id] = [
                'id' => $id, 'customer_id' => $customerId, 'amount' => $amount, 'rials' => $rials,
                'checkout' => $fingerprint, 'token' => '', 'at' => $now,
                'expires_at' => $time + $this->client->tokenLifetime(),
            ];
        });
        if ($attempt['id'] === $id) {
            try {
                $token = $this->client->tokenize($id, $rials);
                ($this->database)(true, static function (array &$state) use ($id, $token): void {
                    $state['irankish_wallet_payments'][$id]['token'] = $token;
                });
            } catch (Throwable $error) {
                ($this->database)(true, static function (array &$state) use ($id): void {
                    unset($state['irankish_wallet_payments'][$id]);
                });
                throw $error;
            }
        } elseif ($attempt['token'] === '') {
            throw new DomainException('درخواست درگاه در حال آماده شدن است. دوباره تلاش کنید.', 409);
        }
        return ['checkout_id' => $attempt['id'], 'confirmed' => !empty($attempt['reference'])];
    }

    /** Reconcile a checkout without creating an order or exposing its bank token. */
    public function recheckCheckout(int $customerId, string $id, string $now): array
    {
        $checkout = new GpIranKishCheckout();
        $payment = ($this->database)(false, static fn (array $state): array => $checkout->owned($state, $id, $customerId));
        $returned = !empty($payment['returned_to_wallet']);
        $confirmed = !$returned && (!empty($payment['reference']) || $this->reconcile($id, $customerId, '', $now));
        return ['confirmed' => $confirmed, 'expired' => $returned || (!$confirmed && $payment['expires_at'] <= time())];
    }

    /** Release a confirmed draft payment back into the authenticated customer's wallet. */
    public function returnCheckoutToWallet(int $customerId, string $id, string $now): array
    {
        $checkout = new GpIranKishCheckout();
        return ($this->database)(true, static function (array &$state) use ($checkout, $id, $customerId, $now): array {
            try {
                $checkout->returnToWallet($state, $id, $customerId, $now);
                return ['credited' => true];
            } catch (DomainException $error) {
                return ['error' => $error];
            }
        });
    }

    /** Create or resume the bank attempt for the order's exact saved online allocation. */
    public function startOrder(int $customerId, int $orderId, string $now): array
    {
        $this->recheckOrder($customerId, $orderId, $now);
        $orders = new GpIranKishOrderPayment();
        $time = time();
        $id = bin2hex(random_bytes(10));
        $attempt = ($this->database)(true, function (array &$state) use ($orders, $customerId, $orderId, $id, $time, $now): array {
            $index = $orders->index($state, $orderId, $customerId);
            $order = &$state['orders'][$index];
            $online = &$order['irankish_order_payment'];
            if (!empty($online['receipt'])) return ['confirmed' => true];
            if (!$orders->payable($order) || !empty($online['claim'])) {
                throw new DomainException('پرداخت جدید برای این سفارش در دسترس نیست. وضعیت پرداخت را بررسی کنید.', 409);
            }
            $current = $state['irankish_wallet_payments'][$online['attempt'] ?? ''] ?? null;
            if ($current !== null && $time < $current['expires_at']) {
                if ($current['token'] === '') throw new DomainException('درخواست درگاه در حال آماده شدن است. دوباره تلاش کنید.', 409);
                return $current;
            }
            $online['attempt'] = $id;
            $state['irankish_wallet_payments'][$id] = [
                'id' => $id, 'order_id' => $orderId, 'customer_id' => $customerId,
                'amount' => $online['amount'], 'rials' => $this->client->rials($online['amount']),
                'token' => '', 'at' => $now, 'expires_at' => $time + $this->client->tokenLifetime(),
            ];
            return $state['irankish_wallet_payments'][$id];
        });
        if (isset($attempt['confirmed'])) return $attempt;
        if ($attempt['id'] === $id) {
            try {
                $token = $this->client->tokenize($id, $attempt['rials']);
                ($this->database)(true, static function (array &$state) use ($id, $token): void {
                    $state['irankish_wallet_payments'][$id]['token'] = $token;
                });
            } catch (Throwable $error) {
                ($this->database)(true, static function (array &$state) use ($id): void {
                    if (($state['irankish_wallet_payments'][$id]['token'] ?? null) === '') {
                        unset($state['irankish_wallet_payments'][$id]);
                    }
                });
                throw $error;
            }
        }
        return ['id' => $attempt['id']];
    }

    /** Retry the last attempt or the durable confirmation claim after returning from the bank. */
    public function recheckOrder(int $customerId, int $orderId, string $now): array
    {
        $orders = new GpIranKishOrderPayment();
        $order = ($this->database)(false, static fn (array $state): array =>
            $state['orders'][$orders->index($state, $orderId, $customerId)]);
        $online = $order['irankish_order_payment'] ?? [];
        $id = $online['claim'] ?? $online['attempt'] ?? null;
        if ($id !== null && empty($online['receipt'])) {
            $this->reconcile($id, $customerId, '', $now);
            $order = ($this->database)(false, static fn (array $state): array =>
                $state['orders'][$orders->index($state, $orderId, $customerId)]);
            $online = $order['irankish_order_payment'] ?? [];
        }
        return [
            'amount' => $orders->payable($order) ? $online['amount'] : 0,
            'receipt' => $online['receipt'] ?? null,
            'pending' => !empty($online['claim']),
        ];
    }

    /** Find a browser checkout by its opaque link without exposing order details. */
    public function orderLaunch(string $id): ?array
    {
        $orders = new GpIranKishOrderPayment();
        return ($this->database)(false, function (array $state) use ($id, $orders): ?array {
            $attempt = $state['irankish_wallet_payments'][$id] ?? [];
            if (empty($attempt['token']) || ($attempt['expires_at'] ?? 0) <= time() || isset($attempt['reference'])) return null;
            if (!empty($attempt['checkout'])) return ['url' => $this->client->paymentUrl(), 'token' => $attempt['token']];
            if (empty($attempt['order_id'])) return null;
            try {
                $order = $state['orders'][$orders->index($state, $attempt['order_id'], $attempt['customer_id'])];
            } catch (DomainException $error) {
                return null;
            }
            $online = $order['irankish_order_payment'] ?? [];
            if (!$orders->payable($order) || !empty($online['claim']) || ($online['attempt'] ?? '') !== $id) return null;
            return ['url' => $this->client->paymentUrl(), 'token' => $attempt['token']];
        });
    }

    /** Identify the order callback without including any bank or account details in its response. */
    public function isOrderAttempt(string $id): bool
    {
        return ($this->database)(false, static fn (array $state): bool =>
            !empty($state['irankish_wallet_payments'][$id]['order_id']) || !empty($state['irankish_wallet_payments'][$id]['checkout']));
    }

    /** Reconcile the opaque merchant return using authoritative bank data. */
    public function returnFromOrderBank(string $id, string $now): bool
    {
        $payment = ($this->database)(false, static fn (array $state): array =>
            $state['irankish_wallet_payments'][$id] ?? []);
        return (!empty($payment['checkout']) || !empty($payment['order_id']))
            && $this->reconcile($id, (int) $payment['customer_id'], '', $now);
    }

    /** Show the customer's own recent payments without returning bank tokens. */
    public function report(int $customerId): array
    {
        return ($this->database)(false, static function (array $state) use ($customerId): array {
            $payments = [];
            foreach (array_reverse($state['irankish_wallet_payments'] ?? []) as $item) {
                if ($item['customer_id'] !== $customerId || $item['token'] === '' || !empty($item['order_id']) || !empty($item['checkout'])) continue;
                $payments[] = array_intersect_key($item, array_flip(['id', 'amount', 'at', 'reference']));
                if (count($payments) === 20) break;
            }
            return [
                'balance' => (new GpOrderWallet())->read($state, $customerId)['available'],
                'payments' => $payments,
            ];
        });
    }

    /** Recover a payment from an authenticated customer or a callback with the original token. */
    public function reconcile(string $id, int $customerId, string $callbackToken, string $now): bool
    {
        $payment = ($this->database)(false, static fn (array $state): ?array => $state['irankish_wallet_payments'][$id] ?? null);
        if ($payment === null || $payment['token'] === ''
            || ($customerId > 0 ? $payment['customer_id'] !== $customerId : !hash_equals($payment['token'], $callbackToken))) return false;
        if (isset($payment['reference'])) return true;
        $row = $this->client->inquiry($id);
        if ($row === null) return false;
        $isOrder = !empty($payment['order_id']);
        if ($isOrder && ($row['isReversed'] ?? null) === true
            && $this->client->matches(array_replace($row, ['isReversed' => false]), $payment)) {
            $this->changeOrderClaim($payment, false);
            return false;
        }
        if (!$this->client->matches($row, $payment)) return false;
        if ($isOrder && !$this->changeOrderClaim($payment, true)) return false;
        if (($row['isVerified'] ?? null) === false) {
            $this->client->confirm($row);
            $row = $this->client->inquiry($id);
        }
        if ($row === null || ($row['isVerified'] ?? null) !== true || !$this->client->matches($row, $payment)) return false;
        $reference = $row['retrievalReferenceNumber'];
        return ($this->database)(true, static function (array &$state) use ($id, $payment, $reference, $now): bool {
            $current = &$state['irankish_wallet_payments'][$id];
            if (isset($current['reference'])) return $current['reference'] === $reference;
            if (isset($state['irankish_wallet_references'][$reference])) return false;
            if (!empty($payment['order_id'])) {
                $orders = new GpIranKishOrderPayment();
                $index = $orders->index($state, $payment['order_id'], $payment['customer_id']);
                $order = &$state['orders'][$index];
                $online = &$order['irankish_order_payment'];
                if (($online['claim'] ?? '') !== $id) return false;
                $online['receipt'] = ['amount' => $payment['amount'], 'reference' => $reference, 'at' => $now];
                unset($online['claim']);
            } elseif (empty($payment['checkout'])) {
                $state['customer_wallet'][$payment['customer_id']]['irankish:'.$id] = [
                'amount' => $payment['amount'], 'source' => 'irankish_credit', 'order_id' => 0,
                    'number' => '', 'reference' => $reference, 'at' => $now,
                ];
            }
            $state['irankish_wallet_references'][$reference] = $id;
            $current['reference'] = $reference;
            $current['verified_at'] = $now;
            return true;
        });
    }

    private function changeOrderClaim(array $payment, bool $claim): bool
    {
        $orders = new GpIranKishOrderPayment();
        return ($this->database)(true, static function (array &$state) use ($orders, $payment, $claim): bool {
            try {
                $index = $orders->index($state, $payment['order_id'], $payment['customer_id']);
            } catch (DomainException $error) {
                return false;
            }
            $order = &$state['orders'][$index];
            if (!$orders->payable($order)) return false;
            $online = &$order['irankish_order_payment'];
            $id = $payment['id'];
            if (!$claim) {
                if (($online['claim'] ?? '') === $id) unset($online['claim']);
                if (($online['attempt'] ?? '') === $id) unset($online['attempt']);
                return false;
            }
            if (($online['claim'] ?? null) === $id) return true;
            if (!empty($online['claim']) || ($online['attempt'] ?? '') !== $id || $online['amount'] !== $payment['amount']) {
                return false;
            }
            $online['claim'] = $id;
            return true;
        });
    }

}
