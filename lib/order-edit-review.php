<?php
declare(strict_types=1);

/** Track staff review against a specific version of an edited order. */
final class GpOrderEditReview
{
    private const GROUPS = [
        'اقلام سفارش' => ['items', 'purchase_items', 'panels', 'fros'],
        'مشتری و توضیحات' => ['customer_id', 'customer_name', 'notes'],
        'مبلغ و نحوه تسویه' => ['estimated_total', 'approved_total', 'requested_payment_method', 'payment_method', 'native_settlement', 'payment_details'],
        'نحوه ارسال' => ['shipping_type', 'shipping_method', 'shipping_address', 'address', 'delivery_type', 'address_id', 'tracking_code', 'carrier'],
    ];
    private const CHECKS = ['settlement', 'shipping'];

    /** Start a new review only when the saved order has actually changed. */
    public static function record(array $before, array &$after, string $at): bool
    {
        $changed = [];
        foreach (self::GROUPS as $label => $keys) {
            $fields = array_fill_keys($keys, true);
            if (array_intersect_key($before, $fields) != array_intersect_key($after, $fields)) {
                $changed[] = $label;
            }
        }
        if ($changed === []) {
            if (isset($before['order_edit_review'])) $after['order_edit_review'] = $before['order_edit_review'];
            return false;
        }
        $after['order_edit_review'] = [
            'version' => (int) ($before['order_edit_review']['version'] ?? 0) + 1,
            'edited_at' => $at,
            'stage' => (string) ($before['status'] ?? ''),
            'changed' => $changed,
            'checked' => [],
        ];
        return true;
    }

    /** Reject stale confirmations and preserve any earlier confirmation of this version. */
    public static function confirm(array &$order, string $part, int $version, string $at): void
    {
        if (!in_array($part, self::CHECKS, true)) throw new DomainException('نوع بررسی معتبر نیست.', 422);
        $review = $order['order_edit_review'] ?? null;
        if (!is_array($review) || $version < 1 || $version !== ($review['version'] ?? null)) {
            throw new DomainException('سفارش دوباره ویرایش شده است. جزئیات نسخهٔ جدید را باز کنید.', 409);
        }
        $order['order_edit_review']['checked'][$part] ??= $at;
    }

    /** Keep one actionable alert while an authorized review is outstanding. */
    public static function alert(array $order, bool $finance, bool $sales): ?array
    {
        $review = $order['order_edit_review'] ?? null;
        if (!is_array($review) || !(($finance && empty($review['checked']['settlement']))
            || ($sales && empty($review['checked']['shipping'])))) {
            return null;
        }
        return [
            'kind' => 'order_edit_review', 'created_at' => $review['edited_at'],
            'order_id' => (int) $order['id'], 'number' => (string) ($order['number'] ?? ''),
        ];
    }
}

/** Observe the native editor inside its existing write transaction. */
function gp_staff_order_edit_transaction(array $request, array $actor, callable $edit): array
{
    return db(true, static function (array &$state) use ($request, $actor, $edit): array {
        $index = idx($state['orders'], $request['id'] ?? 0);
        $before = $index >= 0 ? $state['orders'][$index] : null;
        $result = $edit($state);
        if ($before !== null && GpOrderEditReview::record($before, $state['orders'][$index], now())) {
            $order = &$state['orders'][$index];
            hist($order, $actor['username'], 'سفارش ویرایش شد؛ تسویه و نحوه ارسال دوباره بررسی شوند.');
            if (is_array($result) && (int) ($result['id'] ?? 0) === (int) $order['id']) return $order;
        }
        return $result;
    });
}
