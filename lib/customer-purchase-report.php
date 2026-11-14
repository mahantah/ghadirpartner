<?php
declare(strict_types=1);

require_once __DIR__.'/customer-credit.php';

/** Summarize existing orders and credit for one customer. */
final class GpCustomerPurchaseReport
{
    private GpCreditModel $credit;
    private Closure $saleAmount;
    private Closure $jalaliDate;

    /** Inject the existing sales and calendar rules used by automation. */
    public function __construct(GpCreditModel $credit, callable $saleAmount, callable $jalaliDate)
    {
        $this->credit = $credit;
        $this->saleAmount = Closure::fromCallable($saleAmount);
        $this->jalaliDate = Closure::fromCallable($jalaliDate);
    }

    /**
     * Return purchase totals, product counts and the current credit snapshot.
     *
     * @param array<string, mixed> $state
     * @return array<string, mixed>|null
     */
    public function forCustomer(array $state, int $customerId, string $today, string $from, string $to): ?array
    {
        $customer = null;
        foreach ($state['customers'] ?? [] as $candidate) {
            if ((int) ($candidate['id'] ?? 0) === $customerId) {
                $customer = $candidate;
                break;
            }
        }
        if ($customer === null || !empty($customer['deleted'])) {
            return null;
        }

        $orders = [];
        $counts = ['purchased' => 0, 'pending' => 0, 'cancelled' => 0, 'other' => 0];
        $products = [];
        $history = [];
        $total = 0;
        foreach ($state['orders'] ?? [] as $order) {
            if ((int) ($order['customer_id'] ?? 0) !== $customerId || !empty($order['deleted'])) {
                continue;
            }
            $orders[] = $order;
            $date = ($this->jalaliDate)((string) ($order['created_at'] ?? ''));
            if ($date === '' || ($from !== '' && $date < $from) || ($to !== '' && $date > $to)) {
                continue;
            }
            $approval = $order['approval_status'] ?? '';
            $history[] = [
                'number' => (string) ($order['number'] ?? $order['id'] ?? ''),
                'date' => $date,
                'status' => (string) ($order['status'] ?? ''),
                'approval' => (string) $approval,
                'amount' => max(0, (int) ($order['approved_total'] ?? $order['estimated_total'] ?? 0)),
            ];
            if (($order['status'] ?? '') === 'لغو شد' || in_array($approval, ['لغو شد', 'رد شده', 'تأیید نشد'], true)) {
                $counts['cancelled']++;
                continue;
            }
            if ($approval === 'در انتظار تأیید') {
                $counts['pending']++;
                continue;
            }
            $amount = (int) ($this->saleAmount)($order);
            if ($amount <= 0) {
                $counts['other']++;
                continue;
            }
            $counts['purchased']++;
            $total += $amount;
            foreach ($order['items'] ?? [] as $item) {
                $product = trim((string) ($item['product'] ?? ''));
                $quantity = (int) ($item['qty'] ?? 0);
                if ($product !== '' && $quantity > 0) {
                    $products[$product] = ($products[$product] ?? 0) + $quantity;
                }
            }
        }
        arsort($products);
        usort($history, static fn (array $a, array $b): int => strcmp($b['date'], $a['date']));
        return [
            'counts' => $counts,
            'total_amount' => $total,
            'products' => $products,
            'orders' => $history,
            'credit' => $this->credit->balance(
                ['customers' => [$customer], 'orders' => $orders],
                $customerId,
                substr($today, 0, 7),
                fn (string $date): string => substr(($this->jalaliDate)($date), 0, 7)
            ),
        ];
    }
}
