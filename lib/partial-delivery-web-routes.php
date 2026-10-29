<?php
declare(strict_types=1);
if($p!=='/api/orders/partial-dispatch-view')return;
if($m!=='GET')fail('روش درخواست مجاز نیست',405);
auth(['admin']);
require_once __DIR__.'/partial-delivery-web.php';
$id=filter_var($_GET['id']??null,FILTER_VALIDATE_INT);
try{$result=(new PartialDeliveryViewService(new PartialDeliveryViewRepository()))->find($id===false?0:$id);}
catch(InvalidArgumentException $error){fail($error->getMessage(),422);}
out($result);
