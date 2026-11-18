<?php
declare(strict_types=1);
require_once __DIR__.'/../lib/bazaar-releases.php';
require_once __DIR__.'/fixtures/bazaar-apk.php';

$assert = static function (bool $value, string $reason): void { if (!$value) throw new RuntimeException($reason); };
$denied = static function (Closure $operation, string $reason) use ($assert): void { try { $operation(); } catch (DomainException $error) { $assert($error->getCode() >= 400, 'Expected bounded user error'); return; } throw new RuntimeException($reason); };
$root = sys_get_temp_dir().'/gp-bazaar-tests-'.bin2hex(random_bytes(8)); mkdir($root, 0700);
try {
    $fixture = GpBazaarApkFixture::create($root);
    $policy = json_decode((string) file_get_contents(__DIR__.'/../config/bazaar-releases.yaml'), true, 512, JSON_THROW_ON_ERROR);
    $policy['certificate_sha256'] = $fixture['certificate_sha256'];
    $config = new GpBazaarReleaseConfig($policy); $verifier = new GpBazaarApk($config);
    $identity = $verifier->verify($fixture['path']);
    $assert($identity['version_code'] === 543094 && $identity['package_name'] === $policy['package_name'], 'Read signed manifest metadata');
    $raw = (string) file_get_contents($fixture['path']);
    $tampered = $raw; $tampered[45] = chr(ord($tampered[45]) ^ 1); file_put_contents($root.'/tampered.apk', $tampered);
    $denied(static fn(): array => $verifier->verify($root.'/tampered.apk'), 'Reject modified signed bytes');
    $wrong = new GpBazaarApk(new GpBazaarReleaseConfig(array_replace($policy, ['certificate_sha256'=>str_repeat('0', 64)])));
    $denied(static fn(): array => $wrong->verify($fixture['path']), 'Reject foreign signing key');
    $foreignDirectory = $root.'/foreign'; mkdir($foreignDirectory);
    $foreign = GpBazaarApkFixture::create($foreignDirectory, 543095, 'example.other.app');
    $foreignVerifier = new GpBazaarApk(new GpBazaarReleaseConfig(array_replace($policy, ['certificate_sha256'=>$foreign['certificate_sha256']])));
    $denied(static fn(): array => $foreignVerifier->verify($foreign['path']), 'Reject wrong app manifest');
    $debugDirectory = $root.'/debug'; mkdir($debugDirectory);
    $debug = GpBazaarApkFixture::create($debugDirectory, 543095, $policy['package_name'], true);
    $debugVerifier = new GpBazaarApk(new GpBazaarReleaseConfig(array_replace($policy, ['certificate_sha256'=>$debug['certificate_sha256']])));
    $denied(static fn(): array => $debugVerifier->verify($debug['path']), 'Reject debug builds');
    $storage = new GpBazaarReleaseStorage($root.'/private'); $mutations = []; $packages = []; $draft = false; $committed = false; $published = false; $commitBody = [];
    $transport = static function (string $endpoint, string $method, array $payload, ?string $apk) use (&$mutations, &$packages, &$draft, &$committed, &$published, &$commitBody, $identity): array {
        if ($method === 'POST') $mutations[] = $endpoint;
        if ($endpoint === 'create') { $draft = true; return ['type'=>'success']; }
        if ($endpoint === 'upload') { if ($apk === null) throw new RuntimeException('Missing upload'); $packages = [['version_code'=>$identity['version_code'],'version_name'=>$identity['version_name'],'sha1_hash'=>hash_file('sha1', $apk)]]; return ['type'=>'success','package'=>$packages[0]]; }
        if ($endpoint === 'commit') { $committed = true; $commitBody = $payload; return ['type'=>'success']; }
        $exists = $endpoint === 'draft' ? $draft : ($endpoint === 'committed' ? $committed : $published);
        return $exists ? ['type'=>'success','release'=>['packages'=>$packages]] : ['type'=>'not-exists'];
    };
    $service = new GpBazaarReleases($config, $storage, $verifier, $transport);
    $assert(!$service->summary()['token_configured'], 'Initial token status');
    $service->saveToken('fixture-secret-not-real');
    $assert(strpos(json_encode($service->summary()), 'fixture-secret') === false, 'Never return API token');
    $assert(strpos((string) file_get_contents($root.'/private/token.php'), GpBazaarReleaseStorage::GUARD) === 0, 'Credentials have an executable denial guard');
    $request = ['bytes'=>strlen($raw),'sha256'=>hash('sha256', $raw),'changelog_fa'=>'تغییرات آزمایشی','changelog_en'=>'Test release','developer_note'=>'Fixture'];
    $upload = $service->start($request, 1); $id = $upload['id']; $half = intdiv(strlen($raw), 2);
    $service->chunk($id, 0, substr($raw, 0, $half));
    $service->chunk($id, 0, substr($raw, 0, $half));
    $denied(static fn(): array => $service->chunk($id, 0, str_repeat('x', $half)), 'Reject changed replay');
    $denied(static fn(): array => $service->finish($id), 'Reject incomplete upload');
    $service->chunk($id, $half, substr($raw, $half));
    $result = $service->finish($id); $assert($result['state'] === 'ready', 'Complete verified upload');
    $reuse = $service->start($request, 1); $assert($reuse['id'] === $id, 'Reuse identical local file');
    $service->publish($id, 'draft'); $service->publish($id, 'draft');
    $assert($mutations === ['create','upload'], 'Do not upload identical remote draft twice');
    $service->publish($id, 'review');
    $assert($commitBody['auto_publish'] === false && $commitBody['changelog_fa'] === 'تغییرات آزمایشی', 'Review preserves metadata and manual publication');
    $before = $mutations; $service->publish($id, 'review'); $assert($mutations === $before, 'Recover submitted state without duplicate POST');
    $committed = false; $packages = [['version_code'=>1,'version_name'=>'other','sha1_hash'=>'different']];
    $denied(static fn(): array => $service->publish($id, 'publish'), 'Preserve foreign remote draft');
    $assert($mutations === $before, 'Never overwrite foreign draft');
    $service->removeFile($id); $assert(!is_file($storage->apk($id)) && $service->summary()['releases'][0]['file_removed'], 'Remove only local APK while keeping history');
    $assert($mutations === $before, 'Local deletion never contacts Bazaar');
    $denied(static fn(): array => $service->start(array_replace($request, ['bytes'=>$policy['maximum_apk_bytes'] + 1]), 1), 'Enforce file budget');
    $assert(file_get_contents($root.'/private/history.php') !== false, 'Store independent release history');
    echo "PASS: APK signatures/digests, manifest identity, replay-safe chunks, private token, draft preservation, review/retry state and local-only deletion\n";
} finally {
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($iterator as $file) { if ($file->isDir()) rmdir($file->getPathname()); else unlink($file->getPathname()); }
    rmdir($root);
}
