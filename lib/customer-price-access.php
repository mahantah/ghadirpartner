<?php
declare(strict_types=1);

function ghadir_price_group_keys(): array {
    return [
        'agent' => ['sales_agent'],
        'panel' => ['panel_cash', 'panel_7d', 'panel_1m'],
        'serial' => ['serial_1_50', 'serial_51_200'],
    ];
}

function ghadir_normalize_price_group(string $raw): ?string {
    $v = trim(mb_strtolower($raw));
    return match ($v) {
        'agent', 'sales_agent', 'عامل فروش', 'عامل' => 'agent',
        'panel', 'پنل', 'ثبت در پنل' => 'panel',
        'serial', 'آزاد', 'سریال آزاد', 'سریال' => 'serial',
        default => null,
    };
}

function ghadir_normalize_price_groups(mixed $raw): array {
    if (is_string($raw)) {
        $text = trim($raw);
        $raw = ($text !== '' && str_starts_with($text, '[')) ? (json_decode($text, true) ?: []) : preg_split('/[,\|]/', $text);
    }
    if (!is_array($raw)) return [];
    $out = [];
    foreach ($raw as $item) {
        $group = ghadir_normalize_price_group((string) $item);
        if ($group !== null && !in_array($group, $out, true)) $out[] = $group;
    }
    return $out;
}

function ghadir_customer_price_groups(?array $customer): array {
    if (!is_array($customer)) return ['agent', 'panel', 'serial'];
    foreach (['visible_price_groups', 'price_groups', 'allowed_price_groups'] as $key) {
        if (array_key_exists($key, $customer) && $customer[$key] !== null) {
            return ghadir_normalize_price_groups($customer[$key]);
        }
    }
    return ['agent', 'panel', 'serial'];
}

function ghadir_price_key_group(string $key): string {
    if (str_starts_with($key, 'panel')) return 'panel';
    if ($key === 'sales_agent' || $key === 'agent') return 'agent';
    return 'serial';
}

function ghadir_price_key_allowed(string $key, array $groups): bool {
    return in_array(ghadir_price_key_group($key), $groups, true);
}

function ghadir_filter_prices(array $prices, array $groups): array {
    $keep = [];
    foreach ($groups as $group) {
        foreach (ghadir_price_group_keys()[$group] ?? [] as $key) $keep[$key] = true;
    }
    foreach ($prices as $key => $value) {
        if (!isset($keep[$key])) $prices[$key] = 0;
    }
    return $prices;
}

function ghadir_apply_customer_price_groups(array &$customer, mixed $raw): void {
    $customer['visible_price_groups'] = ghadir_normalize_price_groups($raw);
    unset($customer['customer_level'], $customer['level'], $customer['tier']);
}
