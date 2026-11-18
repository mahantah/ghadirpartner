<?php
declare(strict_types=1);

/** Bounds-checked binary reads for the APK signing block and Android manifest. */
final class GpBazaarBinary
{
    /** Read a bounded little-endian integer. */
    public static function u32(string $data, int $offset): int
    {
        if ($offset < 0 || $offset + 4 > strlen($data)) throw new DomainException('ساختار فایل APK معتبر نیست.', 422);
        return unpack('Vvalue', substr($data, $offset, 4))['value'];
    }

    /** Read a bounded little-endian short. */
    public static function u16(string $data, int $offset): int
    {
        if ($offset < 0 || $offset + 2 > strlen($data)) throw new DomainException('ساختار فایل APK معتبر نیست.', 422);
        return unpack('vvalue', substr($data, $offset, 2))['value'];
    }

    /** APK files are bounded below four GiB; reject larger or overflowing sizes. */
    public static function u64(string $data, int $offset): int
    {
        if (self::u32($data, $offset + 4) !== 0) throw new DomainException('اندازه بلوک امضا مجاز نیست.', 422);
        return self::u32($data, $offset);
    }

    /** Consume one complete length-prefixed signing record. */
    public static function take(string $data, int &$offset): string
    {
        $length = self::u32($data, $offset); $offset += 4;
        if ($length > strlen($data) - $offset) throw new DomainException('بلوک امضای APK ناقص است.', 422);
        $value = substr($data, $offset, $length); $offset += $length;
        return $value;
    }

    /** Decode a complete sequence without silently ignoring trailing bytes. */
    public static function sequence(string $data): array
    {
        $offset = 0; $values = [];
        while ($offset < strlen($data)) $values[] = self::take($data, $offset);
        return $values;
    }
}

/** Verify this app's RSA/SHA-256 v2 signatures and full-file Android content digests. */
final class GpBazaarApk
{
    private GpBazaarReleaseConfig $config;

    /** Bind verification to the existing app package and signing certificate. */
    public function __construct(GpBazaarReleaseConfig $config) { $this->config = $config; }

    /** Verify an actual APK before its version metadata can enter release history. */
    public function verify(string $path): array
    {
        $size = filesize($path);
        if ($size === false || $size < 22 || $size > $this->config->limit('maximum_apk_bytes')) throw new DomainException('اندازه فایل APK مجاز نیست.', 422);
        $data = (string) file_get_contents($path);
        $eocd = $this->eocd($data);
        $central = GpBazaarBinary::u32($data, $eocd + 16);
        $centralSize = GpBazaarBinary::u32($data, $eocd + 12);
        if ($central + $centralSize !== $eocd || $central < 32 || substr($data, $central - 16, 16) !== 'APK Sig Block 42') throw new DomainException('فایل باید APK معتبر با امضای نسخهٔ ۲ باشد.', 422);
        $blockSize = GpBazaarBinary::u64($data, $central - 24);
        $block = $central - $blockSize - 8;
        if ($block < 0 || GpBazaarBinary::u64($data, $block) !== $blockSize) throw new DomainException('بلوک امضای فایل معتبر نیست.', 422);
        $position = $block + 8; $v2 = null;
        while ($position < $central - 24) {
            $length = GpBazaarBinary::u64($data, $position); $position += 8;
            if ($length < 4 || $length > $central - 24 - $position) throw new DomainException('اندازه رکورد امضا معتبر نیست.', 422);
            if (GpBazaarBinary::u32($data, $position) === 0x7109871a) {
                if ($v2 !== null) throw new DomainException('بلوک امضای تکراری مجاز نیست.', 422);
                $v2 = substr($data, $position + 4, $length - 4);
            }
            $position += $length;
        }
        if ($position !== $central - 24 || $v2 === null) throw new DomainException('امضای نسخهٔ ۲ پیدا نشد.', 422);
        $offset = 0; $signerBytes = GpBazaarBinary::take($v2, $offset);
        if ($offset !== strlen($v2)) throw new DomainException('ساختار امضا معتبر نیست.', 422);
        $signers = GpBazaarBinary::sequence($signerBytes);
        if (count($signers) !== 1) throw new DomainException('این فایل باید با یک گواهی امضا شده باشد.', 422);
        $this->signer($signers[0], $data, $block, $central, $eocd);
        $manifest = $this->manifest($data, $central, $eocd);
        $identity = $this->identity($manifest);
        if ($identity['package_name'] !== $this->config->text('package_name') || $identity['debuggable']) throw new DomainException('فقط نسخهٔ انتشار برنامهٔ قدیر پارتنر مجاز است.', 422);
        unset($identity['debuggable']);
        return $identity + ['sha256'=>hash('sha256', $data),'sha1'=>hash('sha1', $data),'bytes'=>$size,'certificate_sha256'=>$this->config->text('certificate_sha256')];
    }

    private function eocd(string $data): int
    {
        for ($offset = strlen($data) - 22; $offset >= max(0, strlen($data) - 65557); $offset--) {
            if (substr($data, $offset, 4) !== "PK\x05\x06") continue;
            if ($offset + 22 + GpBazaarBinary::u16($data, $offset + 20) !== strlen($data)) continue;
            if (GpBazaarBinary::u32($data, $offset + 4) !== 0 || GpBazaarBinary::u16($data, $offset + 8) !== GpBazaarBinary::u16($data, $offset + 10)) throw new DomainException('ZIP چندبخشی مجاز نیست.', 422);
            return $offset;
        }
        throw new DomainException('ساختار ZIP فایل APK معتبر نیست.', 422);
    }

    private function signer(string $signer, string $data, int $block, int $central, int $eocd): void
    {
        $p = 0; $signed = GpBazaarBinary::take($signer, $p); $signatures = GpBazaarBinary::sequence(GpBazaarBinary::take($signer, $p)); $public = GpBazaarBinary::take($signer, $p);
        if ($p !== strlen($signer)) throw new DomainException('رکورد امضا معتبر نیست.', 422);
        $signature = null; $signatureIds = [];
        foreach ($signatures as $record) {
            $id = GpBazaarBinary::u32($record, 0); $signatureIds[] = $id; $q = 4; $bytes = GpBazaarBinary::take($record, $q);
            if ($q !== strlen($record)) throw new DomainException('رکورد امضا ناقص است.', 422);
            if ($id === 0x0103) $signature = $bytes;
        }
        $key = openssl_pkey_get_public($this->pem('PUBLIC KEY', $public));
        if ($signature === null || $key === false || openssl_verify($signed, $signature, $key, OPENSSL_ALGO_SHA256) !== 1) throw new DomainException('امضای دیجیتال فایل معتبر نیست.', 422);
        $q = 0; $digests = GpBazaarBinary::sequence(GpBazaarBinary::take($signed, $q)); $certs = GpBazaarBinary::sequence(GpBazaarBinary::take($signed, $q)); GpBazaarBinary::take($signed, $q);
        // Current apksigner appends an empty reserved field inside the authenticated signed data.
        if ($q < strlen($signed) && GpBazaarBinary::take($signed, $q) !== '') throw new DomainException('فیلد رزرو امضا معتبر نیست.', 422);
        if ($q !== strlen($signed) || !$certs) throw new DomainException('اطلاعات گواهی معتبر نیست.', 422);
        $certificate = $this->pem('CERTIFICATE', $certs[0]);
        $details = openssl_pkey_get_details(openssl_pkey_get_public($certificate));
        if (openssl_x509_fingerprint($certificate, 'sha256') !== $this->config->text('certificate_sha256') || !$details || trim($details['key']) !== trim($this->pem('PUBLIC KEY', $public))) throw new DomainException('گواهی امضا با نسخه‌های قبلی برنامه تطابق ندارد.', 422);
        $digestIds = []; $expected = null;
        foreach ($digests as $record) {
            $id = GpBazaarBinary::u32($record, 0); $digestIds[] = $id; $r = 4; $bytes = GpBazaarBinary::take($record, $r);
            if ($r !== strlen($record)) throw new DomainException('چکیده امضا معتبر نیست.', 422);
            if ($id === 0x0103) $expected = $bytes;
        }
        if ($digestIds !== $signatureIds || $expected === null) throw new DomainException('فهرست الگوریتم‌های امضا تطابق ندارد.', 422);
        $end = substr($data, $eocd); $end = substr_replace($end, pack('V', $block), 16, 4);
        $chunkDigests = ''; $count = 0;
        foreach ([substr($data, 0, $block),substr($data, $central, $eocd - $central),$end] as $section) {
            for ($i = 0; $i < strlen($section); $i += 1048576) {
                $chunk = substr($section, $i, 1048576); $chunkDigests .= hash('sha256', "\xa5".pack('V', strlen($chunk)).$chunk, true); $count++;
            }
        }
        if (!hash_equals($expected, hash('sha256', "\x5a".pack('V', $count).$chunkDigests, true))) throw new DomainException('محتوای APK پس از امضا تغییر کرده است.', 422);
    }

    private function pem(string $label, string $data): string
    {
        return '-----BEGIN '.$label."-----\n".chunk_split(base64_encode($data), 64, "\n").'-----END '.$label."-----\n";
    }

    private function manifest(string $data, int $central, int $eocd): string
    {
        $p = $central; $manifest = null;
        while ($p < $eocd) {
            if (substr($data, $p, 4) !== "PK\x01\x02") throw new DomainException('فهرست ZIP معتبر نیست.', 422);
            $nameLength = GpBazaarBinary::u16($data, $p + 28); $extra = GpBazaarBinary::u16($data, $p + 30); $comment = GpBazaarBinary::u16($data, $p + 32);
            if (substr($data, $p + 46, $nameLength) === 'AndroidManifest.xml') {
                if ($manifest !== null) throw new DomainException('مانیفست تکراری مجاز نیست.', 422);
                $local = GpBazaarBinary::u32($data, $p + 42); $compressed = GpBazaarBinary::u32($data, $p + 20); $plain = GpBazaarBinary::u32($data, $p + 24); $method = GpBazaarBinary::u16($data, $p + 10);
                if (substr($data, $local, 4) !== "PK\x03\x04" || $plain > 1048576 || $compressed > 1048576) throw new DomainException('مانیفست APK معتبر نیست.', 422);
                $start = $local + 30 + GpBazaarBinary::u16($data, $local + 26) + GpBazaarBinary::u16($data, $local + 28);
                $raw = substr($data, $start, $compressed);
                $manifest = $method === 0 ? $raw : ($method === 8 ? gzinflate($raw, 1048576) : false);
                if (!is_string($manifest) || strlen($manifest) !== $plain) throw new DomainException('استخراج مانیفست انجام نشد.', 422);
            }
            $p += 46 + $nameLength + $extra + $comment;
        }
        if ($p !== $eocd || $manifest === null) throw new DomainException('مانیفست APK پیدا نشد.', 422);
        return $manifest;
    }

    private function identity(string $data): array
    {
        $strings = []; $identity = ['package_name'=>'','version_name'=>'','version_code'=>0,'debuggable'=>false]; $p = 8;
        if (GpBazaarBinary::u16($data, 0) !== 3 || GpBazaarBinary::u32($data, 4) !== strlen($data)) throw new DomainException('مانیفست باینری معتبر نیست.', 422);
        while ($p < strlen($data)) {
            $type = GpBazaarBinary::u16($data, $p); $header = GpBazaarBinary::u16($data, $p + 2); $size = GpBazaarBinary::u32($data, $p + 4);
            if ($size < $header || $header < 8 || $p + $size > strlen($data)) throw new DomainException('رکورد مانیفست معتبر نیست.', 422);
            if ($type === 1) {
                $count = GpBazaarBinary::u32($data, $p + 8); $flags = GpBazaarBinary::u32($data, $p + 16); $start = GpBazaarBinary::u32($data, $p + 20);
                if ($count > 50000 || $header + 4 * $count > $size) throw new DomainException('جدول متن مانیفست معتبر نیست.', 422);
                for ($i = 0; $i < $count; $i++) {
                    $offset = $p + $start + GpBazaarBinary::u32($data, $p + $header + 4 * $i);
                    if ($flags & 256) {
                        $length = $this->utfLength($data, $offset); $length = $this->utfLength($data, $offset);
                        $strings[] = substr($data, $offset, $length);
                    } else {
                        $length = GpBazaarBinary::u16($data, $offset); $offset += 2;
                        if ($length & 32768) { $length = (($length & 32767) << 16) | GpBazaarBinary::u16($data, $offset); $offset += 2; }
                        $text = iconv('UTF-16LE', 'UTF-8', substr($data, $offset, 2 * $length));
                        if ($text === false) throw new DomainException('متن مانیفست معتبر نیست.', 422);
                        $strings[] = $text;
                    }
                }
            }
            if ($type === 0x102) {
                $tag = $strings[GpBazaarBinary::u32($data, $p + $header + 4)] ?? '';
                $attributeStart = GpBazaarBinary::u16($data, $p + $header + 8); $attributeSize = GpBazaarBinary::u16($data, $p + $header + 10); $count = GpBazaarBinary::u16($data, $p + $header + 12);
                if ($attributeSize < 20 || $header + $attributeStart + $attributeSize * $count > $size) throw new DomainException('ویژگی مانیفست معتبر نیست.', 422);
                for ($i = 0; $i < $count; $i++) {
                    $a = $p + $header + $attributeStart + $i * $attributeSize;
                    $key = $strings[GpBazaarBinary::u32($data, $a + 4)] ?? ''; $raw = GpBazaarBinary::u32($data, $a + 8); $kind = ord($data[$a + 15]); $value = GpBazaarBinary::u32($data, $a + 16);
                    if ($raw !== 0xffffffff || $kind === 3) $value = $strings[$raw !== 0xffffffff ? $raw : $value] ?? '';
                    if ($tag === 'manifest' && $key === 'package' && is_string($value)) $identity['package_name'] = $value;
                    if ($tag === 'manifest' && $key === 'versionName' && is_string($value)) $identity['version_name'] = $value;
                    if ($tag === 'manifest' && $key === 'versionCode' && is_int($value)) $identity['version_code'] = $value;
                    if ($tag === 'application' && $key === 'debuggable') $identity['debuggable'] = $value !== 0 && $value !== '';
                }
            }
            $p += $size;
        }
        if ($identity['version_code'] < 1 || $identity['version_code'] > 2147483647 || !preg_match('/^[A-Za-z0-9._+-]{1,80}$/D', $identity['version_name'])) throw new DomainException('شماره یا نام نسخهٔ APK معتبر نیست.', 422);
        return $identity;
    }

    private function utfLength(string $data, int &$offset): int
    {
        if ($offset >= strlen($data)) throw new DomainException('متن مانیفست ناقص است.', 422);
        $value = ord($data[$offset++]);
        if ($value & 128) { if ($offset >= strlen($data)) throw new DomainException('متن مانیفست ناقص است.', 422); $value = (($value & 127) << 8) | ord($data[$offset++]); }
        return $value;
    }
}
