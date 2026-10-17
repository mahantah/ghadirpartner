<?php
declare(strict_types=1);

/** Shared invariants for the 18 deploy-guarded I90 cartons. No customer fields. */

function ghadir_protected_carton_codes(): array {
    return [
        'I90-097','I90-098','I90-099','I90-100','I90-101','I90-102','I90-103',
        'I90-109','I90-110','I90-111','I90-112','I90-113','I90-114','I90-115',
        'I90-116','I90-123','I90-124','I90-125',
    ];
}

function ghadir_is_protected_carton_code(?string $code): bool {
    $code = strtoupper(trim((string)$code));
    return $code !== '' && in_array($code, ghadir_protected_carton_codes(), true);
}

function ghadir_protected_carton_lookup(array $s, string $code): ?array {
    $code = strtoupper(trim($code));
    foreach ($s['cartons'] ?? [] as $carton) {
        if (strcasecmp((string)($carton['code'] ?? ''), $code) === 0) {
            return $carton;
        }
    }
    return null;
}

function ghadir_protected_inventory_for(array $s, string $code, int $cartonId): array {
    $rows = [];
    foreach ($s['inventory'] ?? [] as $iv) {
        $linked = ((int)($iv['carton_id'] ?? 0) === $cartonId && $cartonId > 0)
            || strcasecmp((string)($iv['carton_code'] ?? ''), $code) === 0;
        if ($linked) {
            $rows[] = $iv;
        }
    }
    return $rows;
}

function ghadir_protected_detached_count(array $s, string $code, int $cartonId): int {
    $n = 0;
    foreach ($s['inventory'] ?? [] as $iv) {
        $fromCode = strtoupper(trim((string)($iv['detached_from_carton_code'] ?? '')));
        $fromId = (int)($iv['detached_from_carton_id'] ?? 0);
        if ($fromCode === strtoupper($code) || ($cartonId > 0 && $fromId === $cartonId)) {
            $n++;
        }
    }
    return $n;
}

function ghadir_protected_invalid_link_count(array $rows, string $code, int $cartonId): int {
    $n = 0;
    foreach ($rows as $iv) {
        $cid = (int)($iv['carton_id'] ?? 0);
        $cc = trim((string)($iv['carton_code'] ?? ''));
        if (($cid > 0 && $cartonId > 0 && $cid !== $cartonId) || ($cc !== '' && strcasecmp($cc, $code) !== 0)) {
            $n++;
        }
    }
    return $n;
}

function ghadir_protected_carton_inspect(array $s, string $code): array {
    $code = strtoupper(trim($code));
    $expected = 20;
    $carton = ghadir_protected_carton_lookup($s, $code);
    if ($carton === null) {
        return [
            'code' => $code,
            'ok' => false,
            'kind' => 'missing',
            'expected' => $expected,
            'actual' => 0,
            'free' => 0,
            'reserved' => 0,
            'detached' => ghadir_protected_detached_count($s, $code, 0),
            'invalid_links' => 0,
        ];
    }
    $cartonId = (int)($carton['id'] ?? 0);
    $rows = ghadir_protected_inventory_for($s, $code, $cartonId);
    $free = 0;
    $reserved = 0;
    foreach ($rows as $iv) {
        if ((int)($iv['order_id'] ?? 0) === 0) {
            $free++;
        } else {
            $reserved++;
        }
    }
    $actual = count($rows);
    $detached = ghadir_protected_detached_count($s, $code, $cartonId);
    $invalid = ghadir_protected_invalid_link_count($rows, $code, $cartonId);
    $kind = 'ok';
    if ($actual !== $expected && $reserved > 0) {
        $kind = 'count_and_allocated';
    } elseif ($actual !== $expected) {
        $kind = 'count_mismatch';
    } elseif ($reserved > 0) {
        $kind = 'allocated';
    } elseif ($detached > 0) {
        $kind = 'detached_orphan';
    }
    return [
        'code' => $code,
        'ok' => $kind === 'ok',
        'kind' => $kind,
        'expected' => $expected,
        'actual' => $actual,
        'free' => $free,
        'reserved' => $reserved,
        'detached' => $detached,
        'invalid_links' => $invalid,
    ];
}

function ghadir_protected_carton_report(array $s): array {
    $out = [];
    foreach (ghadir_protected_carton_codes() as $code) {
        $out[] = ghadir_protected_carton_inspect($s, $code);
    }
    return $out;
}

function ghadir_protected_carton_first_mismatch(array $s): ?array {
    foreach (ghadir_protected_carton_report($s) as $row) {
        if (empty($row['ok'])) {
            return $row;
        }
    }
    return null;
}

function ghadir_protected_codes_for_inventory_indexes(array $s, array $indexes): array {
    $codes = [];
    foreach ($indexes as $k) {
        $iv = $s['inventory'][$k] ?? [];
        foreach (['carton_code', 'detached_from_carton_code'] as $field) {
            $c = strtoupper(trim((string)($iv[$field] ?? '')));
            if (ghadir_is_protected_carton_code($c)) {
                $codes[] = $c;
            }
        }
        $cid = (int)($iv['carton_id'] ?? 0);
        $detId = (int)($iv['detached_from_carton_id'] ?? 0);
        foreach ($s['cartons'] ?? [] as $ct) {
            $id = (int)($ct['id'] ?? 0);
            $cc = strtoupper(trim((string)($ct['code'] ?? '')));
            if (($id === $cid || $id === $detId) && ghadir_is_protected_carton_code($cc)) {
                $codes[] = $cc;
            }
        }
    }
    return array_values(array_unique($codes));
}

function ghadir_protected_should_detach_retail(string $cartonCode): bool {
    return !ghadir_is_protected_carton_code($cartonCode);
}

function ghadir_protected_fail(string $message): void {
    if (function_exists('fail')) {
        fail($message);
    }
    throw new RuntimeException($message);
}

function ghadir_protected_transfer_guard(array $s, string $code, int $cartonId, array $indexes): void {
    $codes = ghadir_protected_codes_for_inventory_indexes($s, $indexes);
    if (ghadir_is_protected_carton_code($code)) {
        $codes[] = strtoupper(trim($code));
        $codes = array_values(array_unique($codes));
    }
    if (!$codes) {
        return;
    }
    if ($cartonId < 1) {
        $which = $codes[0];
        ghadir_protected_fail('سریال کارتن محافظت‌شده '.$which.' را نمی‌توان جدا از باکس منتقل کرد');
    }
}

function ghadir_protected_refuse_if_code(array $s, string $code, string $op): void {
    $code = strtoupper(trim($code));
    if (ghadir_is_protected_carton_code($code)) {
        ghadir_protected_fail('کارتن محافظت‌شده '.$code.' را نمی‌توان در عملیات '.$op.' تغییر داد');
    }
    foreach ($s['inventory'] ?? [] as $iv) {
        if (strcasecmp((string)($iv['serial'] ?? ''), $code) !== 0) {
            continue;
        }
        $cc = strtoupper(trim((string)($iv['carton_code'] ?? '')));
        if (ghadir_is_protected_carton_code($cc)) {
            ghadir_protected_fail('سریال کارتن محافظت‌شده '.$cc.' را نمی‌توان در عملیات '.$op.' تغییر داد');
        }
        $cid = (int)($iv['carton_id'] ?? 0);
        foreach ($s['cartons'] ?? [] as $ct) {
            if ((int)($ct['id'] ?? 0) === $cid && ghadir_is_protected_carton_code((string)($ct['code'] ?? ''))) {
                ghadir_protected_fail('سریال کارتن محافظت‌شده '.$ct['code'].' را نمی‌توان در عملیات '.$op.' تغییر داد');
            }
        }
        return;
    }
}

function ghadir_protected_refuse_carton_id(array $s, int $cartonId, string $op): void {
    if ($cartonId < 1) {
        return;
    }
    foreach ($s['cartons'] ?? [] as $ct) {
        if ((int)($ct['id'] ?? 0) === $cartonId && ghadir_is_protected_carton_code((string)($ct['code'] ?? ''))) {
            ghadir_protected_fail('کارتن محافظت‌شده '.$ct['code'].' را نمی‌توان در عملیات '.$op.' تغییر داد');
        }
    }
}
