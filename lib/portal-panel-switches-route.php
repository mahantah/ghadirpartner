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
out(['options' => GpPortalPanelSwitches::published()->options()]);
