<?php
return [
    'timezone' => 'Asia/Tehran',
    'warehouse_connected' => false,
    // پرتال و اتوماسیون اصلی یک Data مشترک دارند؛ نشست‌های ورود همچنان جدا و ایمن‌اند.
    'storage' => dirname(__DIR__) . '/storage',
    // برای اتصال واقعی، آدرس API و توکن پنل پیامک در این دو مقدار قرار می‌گیرد.
    'sms_endpoint' => '',
    'sms_token' => '',
    // خالی بودن این مقدار، درگاه آزمایشی داخلی را فعال نگه می‌دارد.
    'payment_endpoint' => '',
];
