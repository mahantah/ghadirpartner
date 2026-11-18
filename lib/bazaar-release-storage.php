<?php
declare(strict_types=1);

/** Isolate release files and credentials from the production order/customer database. */
final class GpBazaarReleaseStorage
{
    public const GUARD = "<?php http_response_code(404); exit; __halt_compiler();\n";
    private string $directory;

    /** Create a private, non-listable directory whose stored files always execute a deny guard. */
    public function __construct(string $directory)
    {
        $this->directory = $directory;
        if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) throw new RuntimeException('Release storage is unavailable.');
        if (!is_file($directory.'/.htaccess')) file_put_contents($directory.'/.htaccess', "Require all denied\nDeny from all\n");
        if (!is_file($directory.'/index.php')) file_put_contents($directory.'/index.php', self::GUARD);
    }

    /** Serialize stateful release operations without blocking unrelated automation endpoints. */
    public function locked(Closure $operation): array
    {
        $path = $this->directory.'/lock.php';
        if (!is_file($path)) file_put_contents($path, self::GUARD);
        $lock = fopen($path, 'r+b');
        if ($lock === false) throw new RuntimeException('Release lock is unavailable.');
        if (!flock($lock, LOCK_EX | LOCK_NB)) { fclose($lock); throw new DomainException('عملیات دیگری برای نسخه‌های اپ در حال انجام است؛ کمی بعد دوباره تلاش کنید.', 409); }
        try { return $operation(); } finally { flock($lock, LOCK_UN); fclose($lock); }
    }

    /** Read only this feature's guarded metadata file. */
    public function rows(): array
    {
        return $this->readJson('history.php', []);
    }

    /** Atomically commit history independently of the live sales database. */
    public function save(array $rows): void
    {
        $this->writeJson('history.php', $rows);
    }

    /** Return a protected file path for a validated random release identifier. */
    public function apk(string $id): string
    {
        if (!preg_match('/^[a-f0-9]{32}$/D', $id)) throw new DomainException('شناسه نسخه معتبر نیست.', 422);
        return $this->directory.'/'.$id.'.php';
    }

    /** Read an environment fallback token without placing it in release history or logs. */
    public function token(): string
    {
        $settings = $this->readJson('token.php', []);
        return is_string($settings['secret'] ?? null) ? $settings['secret'] : '';
    }

    /** Persist only an explicitly provided token behind an executable denial guard. */
    public function storeToken(string $token): void
    {
        $this->writeJson('token.php', ['secret'=>$token]);
    }

    /** Extract the verified APK into a short-lived system temporary file for cURL. */
    public function temporaryApk(string $id, Closure $operation): array
    {
        $path = tempnam(sys_get_temp_dir(), 'gp-bazaar-');
        if ($path === false) throw new RuntimeException('Temporary APK storage is unavailable.');
        chmod($path, 0600);
        try {
            $source = fopen($this->apk($id), 'rb'); $target = fopen($path, 'wb');
            if ($source === false || $target === false) throw new RuntimeException('Release file is unavailable.');
            try {
                if (fread($source, strlen(self::GUARD)) !== self::GUARD || stream_copy_to_stream($source, $target) === false) throw new RuntimeException('Protected APK data is invalid.');
            } finally { fclose($source); fclose($target); }
            return $operation($path);
        } finally { unlink($path); }
    }

    private function readJson(string $name, array $fallback): array
    {
        $path = $this->directory.'/'.$name;
        if (!is_file($path)) return $fallback;
        $bytes = (string) file_get_contents($path);
        if (substr($bytes, 0, strlen(self::GUARD)) !== self::GUARD) throw new RuntimeException('Protected release state is invalid.');
        $value = json_decode(substr($bytes, strlen(self::GUARD)), true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($value)) throw new RuntimeException('Release state is invalid.');
        return $value;
    }

    private function writeJson(string $name, array $value): void
    {
        $path = $this->directory.'/'.$name; $staged = $path.'.'.bin2hex(random_bytes(8)).'.php';
        try {
            $bytes = self::GUARD.json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
            if (file_put_contents($staged, $bytes) !== strlen($bytes)) throw new RuntimeException('Writing release metadata failed.');
            chmod($staged, 0600);
            if (!rename($staged, $path)) throw new RuntimeException('Publishing release metadata failed.');
        } finally { if (is_file($staged)) unlink($staged); }
    }
}
