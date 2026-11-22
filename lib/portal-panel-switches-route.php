<?php
declare(strict_types=1);

if ($p !== '/api/native/panel-switches') {
    return;
}
auth(['customer']);
if ($m !== 'GET') {
    fail('روش درخواست مجاز نیست.', 405);
}
require_once __DIR__.'/portal-panel-switches.php';
$policy = GpPortalPanelSwitches::published();
out(db(false, static function (array $state) use ($policy): array {
    return ['options' => $policy->options(), 'products' => (object) $policy->productOptions($state['products'] ?? [])];
}));
