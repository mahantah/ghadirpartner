<?php
// GP_NATIVE_ADDRESS_BOOK_V1_20261020
// Included by the partner router only; uses its existing session and storage layer.
if ($p === '/api/addresses') {
    $u = auth(['customer']);
    $cid = (int)($u['customer_id'] ?? 0);
    if ($cid < 1 || !in_array('customer', $u['roles'] ?? [], true)) fail('حساب مشتری لازم است', 403);
    if ($m === 'GET') {
        out(db(false, function ($s) use ($cid) {
            $ci = idx($s['customers'], $cid);
            if ($ci < 0) fail('مشتری پیدا نشد', 404);
            $rows = $s['customers'][$ci]['delivery_addresses'] ?? [];
            if (!is_array($rows)) fail('اطلاعات آدرس قابل خواندن نیست', 500);
            return array_values($rows);
        }));
    }
    if ($m !== 'POST') fail('روش درخواست نامعتبر است', 405);
    $x = input();
    if (!is_array($x)) fail('اطلاعات آدرس نامعتبر است', 422);
    $remove = array_key_exists('delete_id', $x);
    $id = $remove ? $x['delete_id'] : ($x['id'] ?? '');
    if (!is_string($id) || strlen($id) > 64) fail('شناسه آدرس نامعتبر است', 422);
    $id = trim($id);
    if ($remove && $id === '') fail('شناسه آدرس لازم است', 422);
    $a = [];
    if (!$remove) {
        foreach (['title' => 60, 'province' => 80, 'city' => 80, 'address' => 1000, 'postal_code' => 10] as $key => $max) {
            $v = $x[$key] ?? '';
            if (!is_string($v)) fail('اطلاعات آدرس نامعتبر است', 422);
            $v = trim($v);
            $length = preg_match_all('/./us', $v);
            if ($length === false || $length > $max) fail('طول اطلاعات آدرس بیش از حد مجاز است', 422);
            if ($key !== 'postal_code' && $v === '') fail('عنوان، استان، شهر و آدرس الزامی است', 422);
            $a[$key] = $v;
        }
        $a['postal_code'] = strtr($a['postal_code'], array_combine(
            preg_split('//u', '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', -1, PREG_SPLIT_NO_EMPTY),
            str_split('01234567890123456789')
        ));
        if ($a['postal_code'] !== '' && !preg_match('/^[0-9]{10}$/D', $a['postal_code'])) fail('کدپستی باید ده رقم باشد', 422);
    }
    out(db(true, function (&$s) use ($cid, $remove, $id, $a) {
        $ci = idx($s['customers'], $cid);
        if ($ci < 0) fail('مشتری پیدا نشد', 404);
        $rows = $s['customers'][$ci]['delivery_addresses'] ?? [];
        if (!is_array($rows)) fail('اطلاعات آدرس قابل خواندن نیست', 500);
        $found = null;
        foreach ($rows as $key => $row) {
            if (is_array($row) && $id !== '' && ($row['id'] ?? '') === $id) { $found = $key; break; }
        }
        // Look only in this customer's records for both editing and deletion.
        if ($id !== '' && $found === null) fail('آدرس پیدا نشد', 404);
        if ($remove) {
            unset($rows[$found]);
        } elseif ($found !== null) {
            $rows[$found] = array_replace($rows[$found], $a);
        } else {
            if (count($rows) >= 20) fail('حداکثر ۲۰ آدرس مجاز است', 422);
            $a['id'] = bin2hex(random_bytes(12));
            $rows[] = $a;
        }
        $s['customers'][$ci]['delivery_addresses'] = array_values($rows);
        return $s['customers'][$ci]['delivery_addresses'];
    }));
}
