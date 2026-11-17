<?php
declare(strict_types=1);

/** Record customer consignments and returns in the existing locked state transaction. */
final class GpCustomerConsignments
{
    private int $maxQuantity;
    private int $maxNoteBytes;

    /** Accept validated, server-owned limits for each record. */
    public function __construct(array $policy)
    {
        $quantity = $policy['max_quantity'] ?? null;
        $note = $policy['max_note_bytes'] ?? null;
        if (!is_int($quantity) || $quantity < 1 || !is_int($note) || $note < 1) {
            throw new RuntimeException('Invalid consignment policy.');
        }
        $this->maxQuantity = $quantity;
        $this->maxNoteBytes = $note;
    }

    /** Return only identifiers and labels needed by the staff form and register. */
    public function report(array $state): array
    {
        $customers = [];
        foreach ($state['customers'] ?? [] as $customer) {
            if (!empty($customer['deleted']) || (int) ($customer['id'] ?? 0) < 1) continue;
            $customers[] = [
                'id' => (int) $customer['id'],
                'name' => (string) ($customer['name'] ?? ''),
                'code' => (string) ($customer['code'] ?? ''),
            ];
        }
        $products = [];
        foreach ($state['products'] ?? [] as $item) {
            if (empty($item['deleted']) && !empty($item['name'])) $products[] = (string) $item['name'];
        }
        $records = array_values(array_reverse($state['customer_consignments'] ?? []));
        return ['customers' => $customers, 'products' => array_values(array_unique($products)), 'records' => $records];
    }

    /** Save a delivery or an incremental return, with idempotency for interrupted client responses. */
    public function record(array &$state, array $request, int $actor, string $at): array
    {
        $key = $this->key($request['request_id'] ?? null);
        $quantity = $request['quantity'] ?? null;
        $note = $request['note'] ?? '';
        if (!is_int($quantity) || $quantity < 1 || $quantity > $this->maxQuantity
            || !is_string($note) || strlen($note) > $this->maxNoteBytes) {
            throw new DomainException('تعداد یا توضیحات معتبر نیست.', 422);
        }
        $event = ['quantity' => $quantity, 'note' => trim($note), 'actor_id' => $actor, 'at' => $at];
        if (($request['action'] ?? null) === 'send') {
            return $this->send($state, $request, $key, $event);
        }
        if (($request['action'] ?? null) !== 'return') {
            throw new DomainException('عملیات معتبر نیست.', 422);
        }
        $id = $this->key($request['id'] ?? null);
        $saved = $state['customer_consignments'][$id] ?? null;
        if ($saved === null) throw new DomainException('ثبت امانی پیدا نشد.', 404);
        if (isset($saved['returns'][$key])) {
            $this->assertRetry($saved['returns'][$key], $event);
            return $saved;
        }
        if ($quantity > $saved['remaining']) {
            throw new DomainException('تعداد برگشتی بیشتر از مانده کالا است.', 409);
        }
        $saved['remaining'] -= $quantity;
        $saved['returns'][$key] = $event;
        return $state['customer_consignments'][$id] = $saved;
    }

    private function send(array &$state, array $request, string $key, array $event): array
    {
        $customerId = $request['customer_id'] ?? null;
        $product = $request['product'] ?? null;
        if (!is_int($customerId) || $customerId < 1 || !is_string($product) || $product === '') {
            throw new DomainException('مشتری و کالا را انتخاب کنید.', 422);
        }
        $event += ['customer_id' => $customerId, 'product' => $product];
        $saved = $state['customer_consignments'][$key] ?? null;
        if ($saved !== null) {
            $this->assertRetry($saved, $event);
            return $saved;
        }
        $name = '';
        foreach ($state['customers'] ?? [] as $customer) {
            if ((int) ($customer['id'] ?? 0) === $customerId && empty($customer['deleted'])) {
                $name = (string) ($customer['name'] ?? '');
                break;
            }
        }
        if ($name === '') throw new DomainException('مشتری فعال پیدا نشد.', 404);
        $catalogued = false;
        foreach ($state['products'] ?? [] as $item) {
            if (($item['name'] ?? '') === $product && empty($item['deleted'])) {
                $catalogued = true;
                break;
            }
        }
        if (!$catalogued) throw new DomainException('کالا پیدا نشد.', 404);
        return $state['customer_consignments'][$key] = $event + [
            'id' => $key, 'customer_name' => $name, 'remaining' => $event['quantity'], 'returns' => [],
        ];
    }

    /** Check that a retry repeats the original operation and content even when its time differs. */
    private function assertRetry(array $saved, array $event): void
    {
        unset($event['at']);
        foreach ($event as $name => $value) {
            if (($saved[$name] ?? null) !== $value) {
                throw new DomainException('شناسه درخواست برای عملیات دیگری استفاده شده است.', 409);
            }
        }
    }

    /** A client-supplied key never controls record content or inventory identifiers. */
    private function key($value): string
    {
        if (!is_string($value) || preg_match('/^[a-f0-9]{32}$/D', $value) !== 1) {
            throw new DomainException('شناسه درخواست معتبر نیست.', 422);
        }
        return $value;
    }
}
