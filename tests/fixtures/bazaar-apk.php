<?php
declare(strict_types=1);

/** Create a freshly signed miniature APK with a disposable key; no production key is used. */
final class GpBazaarApkFixture
{
    /** Generate a v2 APK independently of the production verifier. */
    public static function create(string $directory, int $version = 543094, string $package = 'ir.ghadirpartner.portalapp', bool $debug = false): array
    {
        $key = openssl_pkey_new(['private_key_bits'=>2048,'private_key_type'=>OPENSSL_KEYTYPE_RSA]);
        $csr = openssl_csr_new(['commonName'=>'Disposable APK fixture'], $key, ['digest_alg'=>'sha256']);
        $certificate = openssl_csr_sign($csr, null, $key, 1, ['digest_alg'=>'sha256']);
        openssl_x509_export($certificate, $pem);
        $der = self::der($pem); $public = self::der(openssl_pkey_get_details($key)['key']);
        $path = $directory.'/fixture.apk';
        $zip = new ZipArchive(); $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $zip->addFromString('AndroidManifest.xml', self::manifest($version, $package, $debug));
        $zip->addFromString('classes.dex', 'Disposable fixture, not an installable application.'); $zip->close();
        $raw = (string) file_get_contents($path); $eocd = strrpos($raw, "PK\x05\x06");
        $central = unpack('Vn', substr($raw, $eocd + 16, 4))['n'];
        $sections = [substr($raw, 0, $central),substr($raw, $central, $eocd - $central),substr($raw, $eocd)];
        $hashes = ''; $count = 0;
        foreach ($sections as $section) for ($p = 0; $p < strlen($section); $p += 1048576) {
            $chunk = substr($section, $p, 1048576); $hashes .= hash('sha256', "\xa5".pack('V', strlen($chunk)).$chunk, true); $count++;
        }
        $digest = hash('sha256', "\x5a".pack('V', $count).$hashes, true);
        $signed = self::lp(self::lp(pack('V', 0x0103).self::lp($digest))).self::lp(self::lp($der)).self::lp('').self::lp('');
        openssl_sign($signed, $signature, $key, OPENSSL_ALGO_SHA256);
        $signer = self::lp($signed).self::lp(self::lp(pack('V', 0x0103).self::lp($signature))).self::lp($public);
        $v2 = self::lp(self::lp($signer));
        $pairs = pack('V2', strlen($v2) + 4, 0).pack('V', 0x7109871a).$v2;
        $size = strlen($pairs) + 24;
        $block = pack('V2', $size, 0).$pairs.pack('V2', $size, 0).'APK Sig Block 42';
        $end = substr_replace($sections[2], pack('V', $central + strlen($block)), 16, 4);
        file_put_contents($path, $sections[0].$block.$sections[1].$end);
        return ['path'=>$path,'certificate_sha256'=>openssl_x509_fingerprint($certificate, 'sha256')];
    }

    private static function lp(string $value): string { return pack('V', strlen($value)).$value; }
    private static function der(string $pem): string { return (string) base64_decode((string) preg_replace('/-----[^-]+-----|\s/', '', $pem), true); }

    private static function manifest(int $version, string $package, bool $debug): string
    {
        $strings = ['manifest','package',$package,'versionCode','versionName','1.0-test','application','debuggable'];
        $offsets = ''; $text = '';
        foreach ($strings as $value) { $offsets .= pack('V', strlen($text)); $text .= chr(strlen($value)).chr(strlen($value)).$value."\0"; }
        while (strlen($text) % 4) $text .= "\0";
        $pool = pack('vvVVVVVV', 1, 28, 28 + strlen($offsets) + strlen($text), count($strings), 0, 256, 28 + strlen($offsets), 0).$offsets.$text;
        $attribute = static fn(int $name, int $type, int $value): string => pack('VVVvCCV', 0xffffffff, $name, $type === 3 ? $value : 0xffffffff, 8, 0, $type, $value);
        $start = static function (int $name, string $attrs) : string {
            return pack('vvVVVVVvvvvvv', 0x102, 16, 36 + strlen($attrs), 1, 0xffffffff, 0xffffffff, $name, 20, 20, intdiv(strlen($attrs), 20), 0, 0, 0).$attrs;
        };
        $end = static fn(int $name): string => pack('vvVVVVV', 0x103, 16, 24, 1, 0xffffffff, 0xffffffff, $name);
        $body = $pool.$start(0, $attribute(1, 3, 2).$attribute(3, 0x10, $version).$attribute(4, 3, 5)).$start(6, $attribute(7, 0x12, $debug ? 1 : 0)).$end(6).$end(0);
        return pack('vvV', 3, 8, strlen($body) + 8).$body;
    }
}
