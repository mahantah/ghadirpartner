<?php
declare(strict_types=1);

/** Pure facade for canonical scope, eligible amounts and older-client compatibility. */
final class GpOfferProductScope
{
    /** Accept exact catalog names and preserve the legacy one-product request contract. */
    public static function normalize(array $request, array $catalog): array
    {
        $raw = array_key_exists('products', $request) ? $request['products'] : (empty($request['product']) ? [] : [$request['product']]);
        if (!is_array($raw)) throw new InvalidArgumentException('فهرست کالاهای طرح معتبر نیست');
        $known = array_column($catalog, 'name'); $names = [];
        foreach ($raw as $name) {
            if (!is_string($name) || trim($name) === '' || !in_array(trim($name), $known, true)) throw new InvalidArgumentException('یکی از کالاهای طرح معتبر نیست');
            $names[] = trim($name);
        }
        return array_values(array_unique($names));
    }

    /** Validate the total redemption limit; zero retains unlimited legacy behavior. */
    public static function limit(array $request): int
    {
        $raw = $request['max_uses'] ?? 0;
        if (!is_int($raw) || $raw < 0 || $raw > 9007199254740991) throw new InvalidArgumentException('سقف استفاده باید عدد صحیح و نامنفی باشد');
        return $raw;
    }

    /** Count each order once, including older orders that lacked a usage log. */
    public static function usageCount(array $state, int $id): int
    {
        $orders = []; $unlinked = 0;
        foreach ($state['offer_usages'] ?? [] as $row) {
            if ((int)($row['offer_id'] ?? 0) !== $id) continue;
            $orderId = (int)($row['order_id'] ?? 0);
            if ($orderId > 0) $orders[$orderId] = true; else $unlinked++;
        }
        foreach ($state['orders'] ?? [] as $order) if ((int)($order['offer_id'] ?? 0) === $id && (int)($order['id'] ?? 0) > 0) $orders[(int)$order['id']] = true;
        return count($orders) + $unlinked;
    }

    public static function exhausted(array $state, array $offer): bool
    {
        $limit = max(0, (int)($offer['max_uses'] ?? 0));
        return $limit > 0 && self::usageCount($state, (int)($offer['id'] ?? 0)) >= $limit;
    }

    /** New lists are authoritative; legacy single-product offers retain their old meaning. */
    public static function names(array $offer): array
    {
        if (array_key_exists('products', $offer) && is_array($offer['products'])) return array_values($offer['products']);
        $name = trim((string)($offer['product'] ?? ''));
        return $name === '' ? [] : [$name];
    }

    /** Apply the original discount rules only to selected financial rows, with exact integer rounding. */
    public static function discount(array $offer, array $items): int
    {
        $names = self::names($offer); $eligible = 0;
        foreach ($items as $item) if (!$names || in_array($item['product'] ?? '', $names, true)) $eligible += max(0, (int)($item['line_total'] ?? 0));
        $value = max(0, (int)($offer['discount_value'] ?? 0));
        if (($offer['discount_type'] ?? '') === 'amount') return min($eligible, $value);
        if (($offer['discount_type'] ?? '') !== 'percent') return 0;
        $percent = min(100, $value);
        return intdiv($eligible, 100) * $percent + intdiv(($eligible % 100) * $percent, 100);
    }

    /** Old native clients cannot preview multiple-product scopes correctly; web clients keep all offers. */
    public static function visibleToClient(array $offers, array $headers): array
    {
        $native = strpos((string)($headers['HTTP_USER_AGENT'] ?? ''), 'GhadirPartnerNative/') === 0;
        if (!$native || ($headers['HTTP_X_GHADIR_OFFER_PRODUCT_SCOPE'] ?? '') === 'multiple') return $offers;
        return array_values(array_filter($offers, static function(array $offer): bool { return count(self::names($offer)) < 2; }));
    }
}
