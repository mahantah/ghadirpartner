<?php
declare(strict_types=1);

/** Validate the JSON-compatible YAML policy without requiring a shared-host YAML extension. */
final class GpBazaarReleaseConfig
{
    /** @var array<string,mixed> */
    private array $policy;

    /** Reject unsafe endpoints, raw secrets and unbounded upload settings. */
    public function __construct(array $policy)
    {
        $expected = ['api_base','api_secret','auth_header','package_name','certificate_sha256','maximum_apk_bytes','chunk_bytes','maximum_files','maximum_total_bytes','upload_lifetime_seconds','timeout_seconds','operation_timeout_seconds','maximum_changelog_chars','staged_rollout_percentage','endpoints'];
        $actual = array_keys($policy); sort($actual); sort($expected);
        if ($actual !== $expected
            || ($policy['api_base'] ?? '') !== 'https://api.pishkhan.cafebazaar.ir/v1/'
            || ($policy['auth_header'] ?? '') !== 'CAFEBAZAAR-PISHKHAN-API-SECRET'
            || !is_string($policy['api_secret']) || !preg_match('/^\$\{([A-Z][A-Z0-9_]*)\}$/D', $policy['api_secret'])
            || !is_string($policy['package_name']) || !preg_match('/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/D', $policy['package_name'])
            || !is_string($policy['certificate_sha256']) || !preg_match('/^[a-f0-9]{64}$/D', $policy['certificate_sha256'])) {
            throw new RuntimeException('Invalid Bazaar release policy.');
        }
        $bounds = ['maximum_apk_bytes'=>[1,67108864],'chunk_bytes'=>[65536,1048576],'maximum_files'=>[1,100], 'maximum_total_bytes'=>[1,1073741824],'upload_lifetime_seconds'=>[60,86400],'timeout_seconds'=>[1,60],'operation_timeout_seconds'=>[30,300],'maximum_changelog_chars'=>[1,10000],'staged_rollout_percentage'=>[1,100]];
        foreach ($bounds as $key => $range) {
            if (!is_int($policy[$key]) || $policy[$key] < $range[0] || $policy[$key] > $range[1]) throw new RuntimeException('Invalid Bazaar policy limit.');
        }
        $paths = ['draft'=>'apps/releases/last-uncommitted/','committed'=>'apps/releases/last-committed/','published'=>'apps/releases/last-published/','create'=>'apps/releases/','upload'=>'apps/releases/upload/','commit'=>'apps/releases/commit/'];
        if (!is_array($policy['endpoints']) || count($policy['endpoints']) !== count($paths)) throw new RuntimeException('Invalid Bazaar endpoints.');
        foreach ($paths as $key => $value) if (($policy['endpoints'][$key] ?? null) !== $value) throw new RuntimeException('Invalid Bazaar endpoint.');
        if ($policy['maximum_total_bytes'] < $policy['maximum_apk_bytes']) throw new RuntimeException('Invalid Bazaar storage budget.');
        $this->policy = $policy;
    }

    /** Load deployment policy from the app's versioned configuration. */
    public static function load(string $path): self
    {
        $policy = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($policy)) throw new RuntimeException('Missing Bazaar policy.');
        return new self($policy);
    }

    /** Return a validated integer limit. */
    public function limit(string $name): int
    {
        if (!isset($this->policy[$name]) || !is_int($this->policy[$name])) throw new LogicException('Unknown Bazaar limit.');
        return $this->policy[$name];
    }

    /** Return a validated text policy value. */
    public function text(string $name): string
    {
        if (!isset($this->policy[$name]) || !is_string($this->policy[$name])) throw new LogicException('Unknown Bazaar text setting.');
        return $this->policy[$name];
    }

    /** Resolve only documented endpoints on the official host. */
    public function endpoint(string $name): string
    {
        if (!isset($this->policy['endpoints'][$name])) throw new LogicException('Unknown Bazaar endpoint.');
        return $this->text('api_base').$this->policy['endpoints'][$name];
    }

    /** Read an optional environment credential without exposing it to the browser. */
    public function environmentSecret(): string
    {
        preg_match('/^\$\{([A-Z][A-Z0-9_]*)\}$/D', $this->text('api_secret'), $matches);
        $value = getenv($matches[1]);
        return $value === false ? '' : trim($value);
    }
}
