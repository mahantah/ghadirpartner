<?php
declare(strict_types=1);

/** Exchange only documented HTTPS requests with Bazaar; never retry a mutating call blindly. */
final class GpBazaarReleaseClient
{
    private GpBazaarReleaseConfig $config;
    private string $secret;
    private ?Closure $transport;

    /** Inject server-only authentication and an optional fixture transport. */
    public function __construct(GpBazaarReleaseConfig $config, string $secret, ?Closure $transport = null)
    {
        if ($secret === '' || strlen($secret) > 8192 || preg_match('/[\r\n]/', $secret)) throw new DomainException('ابتدا توکن API پیشخان بازار را تنظیم کنید.', 422);
        $this->config = $config; $this->secret = $secret; $this->transport = $transport;
    }

    /** Perform one request and return only a validated protocol response. */
    public function request(string $endpoint, string $method = 'GET', array $payload = [], ?string $apk = null): array
    {
        $url = $this->config->endpoint($endpoint);
        if ($this->transport !== null) {
            $response = ($this->transport)($endpoint, $method, $payload, $apk);
        } else {
            if (!function_exists('curl_init')) throw new DomainException('افزونه cURL روی سرور فعال نیست.', 503);
            $curl = curl_init($url);
            if ($curl === false) throw new RuntimeException('Bazaar transport could not start.');
            $headers = [$this->config->text('auth_header').': '.$this->secret, 'Accept: application/json'];
            $fields = $apk === null ? json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE) : ['architecture'=>'all','apk'=>new CURLFile($apk, 'application/vnd.android.package-archive', 'app-release.apk')];
            if ($apk === null) $headers[] = 'Content-Type: application/json';
            $options = [CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>$this->config->limit('timeout_seconds'),CURLOPT_TIMEOUT=>$this->config->limit('timeout_seconds'),CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_HTTPHEADER=>$headers,CURLOPT_CUSTOMREQUEST=>$method];
            if ($method !== 'GET') $options[CURLOPT_POSTFIELDS] = $fields;
            curl_setopt_array($curl, $options);
            try {
                $raw = curl_exec($curl); $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
                if ($raw === false || $status < 200 || $status >= 300) {
                    if ($status === 403 || $status === 401) throw new DomainException('بازار توکن این برنامه را نپذیرفت؛ توکن را بررسی کنید.', 422);
                    if ($status === 429) throw new DomainException('تعداد درخواست‌ها به بازار زیاد شده است؛ ابتدا وضعیت بازار را بررسی و بعد دوباره اقدام کنید.', 409);
                    throw new DomainException('پاسخ قطعی از بازار دریافت نشد؛ پیش از تکرار ارسال، وضعیت بازار را بررسی کنید.', 502);
                }
                try { $response = json_decode((string) $raw, true, 512, JSON_THROW_ON_ERROR); }
                catch (JsonException $error) { throw new DomainException('پاسخ بازار قابل پردازش نیست؛ وضعیت رهانش را در پیشخان بررسی کنید.', 502); }
            } finally { curl_close($curl); }
        }
        if (!is_array($response) || !in_array($response['type'] ?? '', ['success','not-exists'], true) || ($method !== 'GET' && ($response['type'] ?? '') !== 'success')) throw new DomainException('بازار عملیات را تأیید نکرد؛ وضعیت رهانش را در پیشخان بررسی کنید.', 502);
        return $response;
    }

    /** Extract a bounded package list from a documented release response. */
    public function packages(array $response): array
    {
        if (($response['type'] ?? '') === 'not-exists') return [];
        $packages = $response['release']['packages'] ?? null;
        if (!is_array($packages) || count($packages) > 100) throw new DomainException('اطلاعات رهانش بازار کامل نیست.', 502);
        foreach ($packages as $package) if (!is_array($package) || !is_int($package['version_code'] ?? null)) throw new DomainException('اطلاعات نسخه در بازار معتبر نیست.', 502);
        return $packages;
    }
}
