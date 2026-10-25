<?php
if (!function_exists('ghadir_price_group_keys')) {
function ghadir_price_group_keys() {
    return array(
        'agent' => array('sales_agent'),
        'panel' => array('panel_cash', 'panel_7d', 'panel_1m'),
        'serial' => array('serial_1_50', 'serial_51_200'),
    );
}

function ghadir_lower($raw) {
    $raw = (string) $raw;
    return function_exists('mb_strtolower') ? mb_strtolower($raw) : strtolower($raw);
}

function ghadir_normalize_price_group($raw) {
    $v = trim(ghadir_lower($raw));
    $map = array(
        'agent' => 'agent', 'sales_agent' => 'agent', 'عامل فروش' => 'agent', 'عامل' => 'agent',
        'panel' => 'panel', 'پنل' => 'panel', 'ثبت در پنل' => 'panel',
        'serial' => 'serial', 'آزاد' => 'serial', 'سریال آزاد' => 'serial', 'سریال' => 'serial',
    );
    return isset($map[$v]) ? $map[$v] : null;
}

function ghadir_normalize_price_groups($raw) {
    if (is_string($raw)) {
        $text = trim($raw);
        if ($text !== '' && isset($text[0]) && $text[0] === '[') {
            $decoded = json_decode($text, true);
            $raw = is_array($decoded) ? $decoded : array();
        } else {
            $raw = preg_split('/[,|]/', $text);
        }
    }
    if (!is_array($raw)) return array();
    $out = array();
    foreach ($raw as $item) {
        $group = ghadir_normalize_price_group((string) $item);
        if ($group !== null && !in_array($group, $out, true)) $out[] = $group;
    }
    return $out;
}

function ghadir_customer_price_groups($customer) {
    if (!is_array($customer)) return array('agent', 'panel', 'serial');
    foreach (array('visible_price_groups', 'price_groups', 'allowed_price_groups') as $key) {
        if (array_key_exists($key, $customer) && $customer[$key] !== null) {
            return ghadir_normalize_price_groups($customer[$key]);
        }
    }
    return array('agent', 'panel', 'serial');
}

function ghadir_price_key_group($key) {
    if (strpos($key, 'panel') === 0) return 'panel';
    if ($key === 'sales_agent' || $key === 'agent') return 'agent';
    return 'serial';
}

function ghadir_price_key_allowed($key, $groups) {
    return in_array(ghadir_price_key_group($key), $groups, true);
}

function ghadir_filter_prices($prices, $groups) {
    $keep = array();
    $map = ghadir_price_group_keys();
    foreach ($groups as $group) {
        if (!isset($map[$group])) continue;
        foreach ($map[$group] as $key) $keep[$key] = true;
    }
    foreach ($prices as $key => $value) {
        if (!isset($keep[$key])) $prices[$key] = 0;
    }
    return $prices;
}

function ghadir_apply_customer_price_groups(&$customer, $raw) {
    $customer['visible_price_groups'] = ghadir_normalize_price_groups($raw);
    unset($customer['customer_level'], $customer['level'], $customer['tier']);
}
}
