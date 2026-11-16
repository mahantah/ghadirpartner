<?php
declare(strict_types=1);

require_once __DIR__.'/irankish-wallet-client.php';
require_once __DIR__.'/order-wallet.php';

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

    /** Show the customer's own recent payments without returning bank tokens. */
    public function report(int $customerId): array
    {
        return ($this->database)(false, static function (array $state) use ($customerId): array {
            $payments = [];
            foreach (array_reverse($state['irankish_wallet_payments'] ?? []) as $item) {
                if ($item['customer_id'] !== $customerId || $item['token'] === '') continue;
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
        if ($row === null || !$this->client->matches($row, $payment)) return false;
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
            $state['customer_wallet'][$payment['customer_id']]['irankish:'.$id] = [
                'amount' => $payment['amount'], 'source' => 'irankish_credit', 'order_id' => 0,
                'number' => '', 'reference' => $reference, 'at' => $now,
            ];
            $state['irankish_wallet_references'][$reference] = $id;
            $current['reference'] = $reference;
            return true;
        });
    }
}
