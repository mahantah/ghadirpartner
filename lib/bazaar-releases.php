<?php
declare(strict_types=1);
require_once __DIR__.'/bazaar-release-config.php';
require_once __DIR__.'/bazaar-release-storage.php';
require_once __DIR__.'/bazaar-release-client.php';
require_once __DIR__.'/bazaar-apk.php';

/** Single facade for admin uploads, token settings and Bazaar release state transitions. */
final class GpBazaarReleases
{
    private GpBazaarReleaseConfig $config;
    private GpBazaarReleaseStorage $storage;
    private GpBazaarApk $verifier;
    private ?Closure $transport;

    /** Inject private storage and a protocol fixture transport when testing. */
    public function __construct(GpBazaarReleaseConfig $config, GpBazaarReleaseStorage $storage, GpBazaarApk $verifier, ?Closure $transport = null)
    {
        $this->config = $config; $this->storage = $storage; $this->verifier = $verifier; $this->transport = $transport;
    }

    /** Compose feature dependencies without opening the customer/order database for writes. */
    public static function configured(string $directory): self
    {
        $config = GpBazaarReleaseConfig::load(dirname(__DIR__).'/config/bazaar-releases.yaml');
        return new self($config, new GpBazaarReleaseStorage($directory), new GpBazaarApk($config));
    }

    /** Return local release metadata and capability flags, never token or filesystem paths. */
    public function summary(): array
    {
        $rows = array_values($this->storage->rows());
        usort($rows, static fn(array $a, array $b): int => strcmp($b['created_at'], $a['created_at']));
        return ['releases'=>$rows,'token_configured'=>$this->secret() !== '', 'environment_token'=>$this->config->environmentSecret() !== '',
            'ready'=>function_exists('openssl_verify') && function_exists('gzinflate') && function_exists('iconv'),
            'network_ready'=>function_exists('curl_init'), 'policy'=>['maximum_apk_bytes'=>$this->config->limit('maximum_apk_bytes'),'chunk_bytes'=>$this->config->limit('chunk_bytes'),'maximum_changelog_chars'=>$this->config->limit('maximum_changelog_chars'),'package_name'=>$this->config->text('package_name')]];
    }

    /** Validate and save a replacement token without returning its value. */
    public function saveToken(string $token): array
    {
        $token = trim($token);
        if (!preg_match('/^[\x21-\x7e]{16,8192}$/D', $token)) throw new DomainException('توکن معتبر پیشخان بازار را وارد کنید.', 422);
        return $this->storage->locked(function () use ($token): array { $this->storage->storeToken($token); return ['configured'=>true]; });
    }

    /** Reserve a bounded upload or reuse an identical verified APK idempotently. */
    public function start(array $request, int $actor): array
    {
        $size = $request['bytes'] ?? null; $digest = $request['sha256'] ?? '';
        if (!is_int($size) || $size < 22 || $size > $this->config->limit('maximum_apk_bytes') || !is_string($digest) || !preg_match('/^[a-f0-9]{64}$/D', $digest)) throw new DomainException('اندازه یا شناسه فایل APK معتبر نیست.', 422);
        $metadata = $this->metadata($request);
        return $this->storage->locked(function () use ($size, $digest, $metadata, $actor): array {
            $rows = $this->storage->rows(); $files = 0; $bytes = 0;
            foreach ($rows as $id => &$row) {
                if ($row['state'] === 'receiving' && time() - $row['created_epoch'] > $this->config->limit('upload_lifetime_seconds')) {
                    if (is_file($this->storage->apk($id))) unlink($this->storage->apk($id));
                    $row['state'] = 'expired'; $row['file_removed'] = true;
                }
                if (!empty($row['file_removed'])) continue;
                if ($row['expected_sha256'] === $digest && $row['bytes'] === $size && is_file($this->storage->apk($id))) {
                    if (!in_array($row['state'], ['receiving','ready','draft','error'], true)) throw new DomainException('این فایل قبلاً برای بررسی ارسال شده است.', 409);
                    $row = array_replace($row, $metadata, ['updated_by'=>$actor]);
                    $this->storage->save($rows);
                    return ['id'=>$id,'received'=>$this->received($id),'state'=>$row['state']];
                }
                $files++; $bytes += $row['bytes'];
            }
            unset($row);
            if ($files >= $this->config->limit('maximum_files') || $bytes + $size > $this->config->limit('maximum_total_bytes')) throw new DomainException('فضای نسخه‌های اپ پر شده است؛ فایل نسخه‌های قدیمی را حذف کنید.', 422);
            $id = bin2hex(random_bytes(16));
            if (file_put_contents($this->storage->apk($id), GpBazaarReleaseStorage::GUARD) !== strlen(GpBazaarReleaseStorage::GUARD)) throw new RuntimeException('Could not reserve APK storage.');
            chmod($this->storage->apk($id), 0600);
            $rows[$id] = $metadata + ['id'=>$id,'state'=>'receiving','bytes'=>$size,'expected_sha256'=>$digest,'created_epoch'=>time(),'created_at'=>gmdate('c'),'updated_by'=>$actor,'file_removed'=>false];
            $this->storage->save($rows);
            return ['id'=>$id,'received'=>0,'state'=>'receiving'];
        });
    }

    /** Append one bounded chunk, accepting an exact replay after a network interruption. */
    public function chunk(string $id, int $offset, string $bytes): array
    {
        if ($offset < 0 || $bytes === '' || strlen($bytes) > $this->config->limit('chunk_bytes')) throw new DomainException('بخش بارگذاری معتبر نیست.', 422);
        return $this->storage->locked(function () use ($id, $offset, $bytes): array {
            $rows = $this->storage->rows(); $row = $this->row($rows, $id);
            if ($row['state'] !== 'receiving' || time() - $row['created_epoch'] > $this->config->limit('upload_lifetime_seconds')) throw new DomainException('این بارگذاری فعال نیست؛ فایل را دوباره انتخاب کنید.', 409);
            $received = $this->received($id);
            if ($offset + strlen($bytes) > $row['bytes'] || $offset > $received) throw new DomainException('ترتیب یا اندازه بخش بارگذاری معتبر نیست.', 409);
            $handle = fopen($this->storage->apk($id), 'r+b');
            if ($handle === false) throw new RuntimeException('Upload file is unavailable.');
            try {
                fseek($handle, strlen(GpBazaarReleaseStorage::GUARD) + $offset);
                if ($offset < $received) {
                    if ($offset + strlen($bytes) > $received || !hash_equals($bytes, (string) fread($handle, strlen($bytes)))) throw new DomainException('بخش تکراری فایل با نسخه قبلی مطابقت ندارد.', 409);
                } elseif (fwrite($handle, $bytes) !== strlen($bytes)) throw new RuntimeException('Upload chunk could not be written.');
            } finally { fclose($handle); clearstatcache(true, $this->storage->apk($id)); }
            return ['id'=>$id,'received'=>$this->received($id)];
        });
    }

    /** Verify size, file hash, signing identity and manifest before making the APK publishable. */
    public function finish(string $id): array
    {
        return $this->storage->locked(function () use ($id): array {
            $rows = $this->storage->rows(); $row = $this->row($rows, $id);
            if ($row['state'] !== 'receiving') { if (isset($row['sha256'])) return $row; throw new DomainException('این بارگذاری قابل تکمیل نیست.', 409); }
            if ($this->received($id) !== $row['bytes']) throw new DomainException('بارگذاری فایل هنوز کامل نشده است.', 422);
            try {
                $verified = $this->storage->temporaryApk($id, function (string $path) use ($row): array {
                    if (!hash_equals($row['expected_sha256'], (string) hash_file('sha256', $path))) throw new DomainException('محتوای فایل با فایل انتخاب‌شده مطابقت ندارد.', 422);
                    return $this->verifier->verify($path);
                });
                $row = array_replace($row, $verified, ['state'=>'ready','error'=>'']);
            } catch (Throwable $error) {
                $row['state'] = 'error'; $row['error'] = $error instanceof DomainException ? $error->getMessage() : 'بررسی فایل انجام نشد.';
                $rows[$id] = $row; $this->storage->save($rows); throw $error;
            }
            $rows[$id] = $row; $this->storage->save($rows);
            return $row;
        });
    }

    /** Read Bazaar's current state without creating, uploading or committing a release. */
    public function refresh(): array
    {
        $client = $this->client(); $result = [];
        foreach (['draft','committed','published'] as $endpoint) {
            $response = $client->request($endpoint); $packages = $client->packages($response);
            $result[$endpoint] = ['packages'=>array_map(static fn(array $p): array => array_intersect_key($p, array_flip(['version_code','version_name','apk_size','sha1_hash'])), $packages), 'auto_publish'=>(bool) ($response['release']['auto_publish'] ?? false)];
        }
        return $result;
    }

    /** Stage the exact APK or submit it for review, preserving foreign drafts and retry state. */
    public function publish(string $id, string $mode): array
    {
        if (!in_array($mode, ['draft','review','publish'], true)) throw new DomainException('عملیات انتشار معتبر نیست.', 422);
        $client = $this->client();
        return $this->storage->locked(function () use ($id, $mode, $client): array {
            $rows = $this->storage->rows(); $row = $this->row($rows, $id);
            if (!isset($row['sha256']) || !empty($row['file_removed']) || !in_array($row['state'], ['ready','draft','error','working','submitted','published'], true)) throw new DomainException('ابتدا فایل APK را کامل بارگذاری و تأیید کنید.', 422);
            $row['state'] = 'working'; $row['error'] = ''; $rows[$id] = $row; $this->storage->save($rows);
            try {
                foreach (['published','committed'] as $endpoint) {
                    $packages = $client->packages($client->request($endpoint));
                    if ($this->matches($packages, $row)) {
                        $row['state'] = $endpoint === 'published' ? 'published' : 'submitted';
                        $rows[$id] = $row; $this->storage->save($rows); return $row;
                    }
                    foreach ($packages as $package) if ($package['version_code'] >= $row['version_code']) throw new DomainException('این شماره نسخه یا نسخهٔ جدیدتر در بازار وجود دارد؛ شماره نسخه را افزایش دهید.', 409);
                }
                $draft = $client->request('draft'); $packages = $client->packages($draft);
                if ($packages && !$this->matches($packages, $row)) throw new DomainException('پیش‌نویس دیگری در بازار وجود دارد؛ تغییری در آن داده نشد.', 409);
                if (($draft['type'] ?? '') === 'not-exists') $client->request('create', 'POST');
                if (!$packages) {
                    $uploaded = $this->storage->temporaryApk($id, function (string $path) use ($row, $client): array {
                        if (!hash_equals($row['sha256'], (string) hash_file('sha256', $path))) throw new DomainException('فایل ذخیره‌شده تغییر کرده است؛ ارسال متوقف شد.', 422);
                        return $client->request('upload', 'POST', [], $path);
                    });
                    if (!isset($uploaded['package']) || !is_array($uploaded['package']) || !$this->matches([$uploaded['package']], $row)) throw new DomainException('اطلاعات فایل بارگذاری‌شده در بازار تطابق ندارد؛ ارسال برای بررسی متوقف شد.', 502);
                }
                if (!$this->matches($client->packages($client->request('draft')), $row)) throw new DomainException('پیش‌نویس بازار تغییر کرده است؛ وضعیت آن را بررسی کنید.', 409);
                $row['state'] = 'draft';
                if ($mode !== 'draft') {
                    $client->request('commit', 'POST', ['changelog_fa'=>$row['changelog_fa'],'changelog_en'=>$row['changelog_en'],'developer_note'=>$row['developer_note'],'staged_rollout_percentage'=>$this->config->limit('staged_rollout_percentage'),'auto_publish'=>$mode === 'publish']);
                    $row['state'] = 'submitted'; $row['auto_publish'] = $mode === 'publish';
                }
                $row['last_operation_at'] = gmdate('c'); $rows[$id] = $row; $this->storage->save($rows);
                return $row;
            } catch (Throwable $error) {
                $row['state'] = 'error'; $row['error'] = $error instanceof DomainException ? $error->getMessage() : 'نتیجه عملیات قطعی نیست؛ وضعیت بازار را بررسی کنید.';
                $rows[$id] = $row; $this->storage->save($rows); throw $error;
            }
        });
    }

    /** Delete only a local APK copy while preserving its release history and all Bazaar state. */
    public function removeFile(string $id): array
    {
        return $this->storage->locked(function () use ($id): array {
            $rows = $this->storage->rows(); $row = $this->row($rows, $id);
            if (is_file($this->storage->apk($id)) && !unlink($this->storage->apk($id))) throw new RuntimeException('Removing local APK failed.');
            $row['file_removed'] = true; $rows[$id] = $row; $this->storage->save($rows);
            return ['removed'=>true];
        });
    }

    private function metadata(array $request): array
    {
        $result = [];
        foreach (['changelog_fa','changelog_en','developer_note'] as $key) {
            $text = $request[$key] ?? '';
            if (!is_string($text) || preg_match_all('/./us', $text, $ignored) === false || count($ignored[0]) > $this->config->limit('maximum_changelog_chars')) throw new DomainException('توضیحات نسخه معتبر نیست یا بیش از حد طولانی است.', 422);
            $result[$key] = trim($text);
        }
        if ($result['changelog_fa'] === '') throw new DomainException('توضیحات فارسی نسخه را بنویسید.', 422);
        return $result;
    }

    private function row(array $rows, string $id): array
    {
        $this->storage->apk($id);
        if (!isset($rows[$id])) throw new DomainException('نسخه پیدا نشد.', 404);
        return $rows[$id];
    }

    private function received(string $id): int
    {
        $size = filesize($this->storage->apk($id));
        if ($size === false || $size < strlen(GpBazaarReleaseStorage::GUARD)) throw new RuntimeException('Upload data is missing.');
        return $size - strlen(GpBazaarReleaseStorage::GUARD);
    }

    private function matches(array $packages, array $row): bool
    {
        return count($packages) === 1 && ($packages[0]['version_code'] ?? null) === $row['version_code'] && ($packages[0]['version_name'] ?? '') === $row['version_name'] && ($packages[0]['sha1_hash'] ?? '') === $row['sha1'];
    }

    private function secret(): string { return $this->config->environmentSecret() ?: $this->storage->token(); }
    private function client(): GpBazaarReleaseClient { return new GpBazaarReleaseClient($this->config, $this->secret(), $this->transport); }
}
