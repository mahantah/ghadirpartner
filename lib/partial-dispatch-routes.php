<?php
declare(strict_types=1);
if($p!=='/api/orders/partial-dispatch')return;
if($m!=='POST')fail('روش درخواست مجاز نیست',405);
$user=auth(['admin']);
require_once __DIR__.'/partial-dispatch.php';
$service=new PartialDispatchService(new PartialDispatchRepository(),(new PartialDispatchConfigRepository(dirname(__DIR__).'/config/partial-dispatch.yaml'))->load());
try{$order=$service->dispatch(input(),(string)$user['username']);}
catch(InvalidArgumentException $error){fail($error->getMessage(),422);}
out($order);
