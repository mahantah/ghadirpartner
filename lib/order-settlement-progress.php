<?php
declare(strict_types=1);

require_once __DIR__.'/customer-credit.php';

/** Project the reviewed credit ledger into a display status for automation. */
final class GpOrderSettlementProgress
{
    private GpCreditModel $credit;

    /** Reuse the same accounting model that calculates the customer's balance. */
    public function __construct(GpCreditModel $credit)
    {
        $this->credit = $credit;
    }

    /** Show only confirmed repayments and distinguish a fully credit-funded invoice. */
    public function read(array $order): ?array
    {
        $paid = $this->credit->repaid($order);
        if ($paid === 0) return null;
        $outstanding = $this->credit->debt($order);
        $invoice = max(0, (int) ($order['approved_total'] ?? 0))
            ?: max(0, (int) ($order['estimated_total'] ?? 0));
        $fullCredit = ($order['requested_payment_method'] ?? '') !== 'mixed'
            && $invoice > 0 && $this->credit->amount($order) >= $invoice;
        $settled = $outstanding === 0;
        return [
            'paid' => $paid,
            'outstanding' => $outstanding,
            'settled' => $settled,
            'label' => $settled
                ? ($fullCredit || ($order['payment_status'] ?? '') === 'تسویه کامل' ? 'تسویه کامل' : 'بخش اعتباری تسویه شد')
                : 'پرداخت بخشی',
        ];
    }
}
