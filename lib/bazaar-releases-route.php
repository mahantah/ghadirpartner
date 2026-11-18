<?php
declare(strict_types=1);

if (!in_array($p, ['/api/admin/app-releases','/api/admin/app-releases/chunk'], true)) return;
$actor = auth(['admin']);
if (!in_array('admin', $actor['roles'] ?? [], true)) fail('مدیریت نسخه‌های اپ فقط برای مدیر مجاز است.', 403);
require_once __DIR__.'/bazaar-releases.php';
header('Cache-Control: no-store');
if ($m !== 'GET' && $m !== 'POST') fail('روش درخواست مجاز نیست.', 405);
if (!isset($_SESSION['gp_bazaar_csrf'])) $_SESSION['gp_bazaar_csrf'] = bin2hex(random_bytes(32));
$csrf = $_SESSION['gp_bazaar_csrf'];
if ($m === 'POST' && (!is_string($_SERVER['HTTP_X_GP_RELEASE_CSRF'] ?? null) || !hash_equals($csrf, $_SERVER['HTTP_X_GP_RELEASE_CSRF']))) fail('نشست فرم منقضی شده است؛ صفحه را دوباره باز کنید.', 403);
session_write_close();
try {
    $service = GpBazaarReleases::configured(dirname($file).'/app-releases');
    if ($m === 'GET') {
        if ($p !== '/api/admin/app-releases') fail('مسیر درخواست معتبر نیست.', 404);
        out($service->summary() + ['csrf'=>$csrf]);
    }
    if ($p === '/api/admin/app-releases/chunk') {
        $upload = $_FILES['chunk'] ?? null; $id = $_POST['id'] ?? ''; $offset = $_POST['offset'] ?? '';
        if (!is_string($id) || !is_string($offset) || !preg_match('/^\d{1,10}$/D', $offset) || !is_array($upload) || ($upload['error'] ?? -1) !== UPLOAD_ERR_OK || !is_string($upload['tmp_name'] ?? null) || !is_uploaded_file($upload['tmp_name'])) fail('بخش فایل دریافت نشد؛ محدودیت بارگذاری سرور را بررسی کنید.', 422);
        $config = GpBazaarReleaseConfig::load(dirname(__DIR__).'/config/bazaar-releases.yaml');
        if (filesize($upload['tmp_name']) > $config->limit('chunk_bytes')) fail('بخش فایل بیش از حد بزرگ است.', 422);
        out($service->chunk($id, (int) $offset, (string) file_get_contents($upload['tmp_name'])));
    }
    $request = input(); $action = $request['action'] ?? ''; $id = $request['id'] ?? '';
    if (!is_string($action) || !is_string($id)) fail('درخواست معتبر نیست.', 422);
    if ($action === 'save_token') {
        if (!is_string($request['token'] ?? null)) fail('توکن معتبر نیست.', 422);
        out($service->saveToken($request['token']));
    }
    if ($action === 'start') out($service->start($request, (int) $actor['id']));
    if ($action === 'finish') out($service->finish($id));
    if ($action === 'refresh') out($service->refresh());
    if ($action === 'remove_file') out($service->removeFile($id));
    if (in_array($action, ['draft','review','publish'], true)) {
        $config = GpBazaarReleaseConfig::load(dirname(__DIR__).'/config/bazaar-releases.yaml');
        if (function_exists('set_time_limit')) set_time_limit($config->limit('operation_timeout_seconds'));
        out($service->publish($id, $action));
    }
    fail('عملیات درخواست‌شده معتبر نیست.', 422);
} catch (DomainException $error) { fail($error->getMessage(), in_array($error->getCode(), [403,404,409,422,502,503], true) ? $error->getCode() : 422); }
catch (Throwable $error) { fail('عملیات مدیریت نسخه انجام نشد؛ پیش از ارسال مجدد، وضعیت بازار را بررسی کنید.', 500); }
