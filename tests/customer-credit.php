<?php
declare(strict_types=1);
require dirname(__DIR__).'/lib/customer-credit.php';
$model=new GpCreditModel();$monthOf=static function(string $s): string{return substr($s,0,7);};
$customer=['id'=>1,'monthly_credit'=>['enabled'=>true,'limit'=>100]];
$order=['id'=>1,'customer_id'=>1,'requested_payment_method'=>'credit','payment_method'=>'','approval_status'=>'در انتظار تأیید','status'=>'در انتظار تأیید سفارش','estimated_total'=>30,'created_at'=>'1405/07/01','payment_status'=>'پرداخت نشده'];
$state=['customers'=>[$customer],'orders'=>[$order]];
$b=$model->balance($state,1,'1405/08',$monthOf);if($b['available']!==70||$b['monthly_used']!==0||$b['reserved']!==30)throw new Exception('prior_debt');
$next=$order;$next['id']=2;$next['estimated_total']=70;$next['created_at']='1405/08/01';$after=$state;$after['orders'][]=$next;
$model->assertChanges($state,$after,'1405/08',$monthOf);
$after['orders'][1]['estimated_total']=71;
try{$model->assertChanges($state,$after,'1405/08',$monthOf);throw new LogicException('over_limit_accepted');}catch(GpMonthlyCreditViolation $e){}
$after['orders'][1]['estimated_total']=70;$after['customers'][0]['monthly_credit']['enabled']=false;
try{$model->assertChanges($state,$after,'1405/08',$monthOf);throw new LogicException('disabled_accepted');}catch(GpMonthlyCreditViolation $e){}
$state['orders'][0]['status']='لغو شد';if($model->balance($state,1,'1405/08',$monthOf)['available']!==100)throw new Exception('cancel_reservation');
$state['orders'][0]=$order;$state['orders'][0]['payment_status']='تسویه کامل';if($model->balance($state,1,'1405/08',$monthOf)['available']!==100)throw new Exception('repayment');
$state['orders'][0]['created_at']='1405/08/01';if($model->balance($state,1,'1405/08',$monthOf)['available']!==70)throw new Exception('monthly_quota_recycled');
$state['orders'][0]['approval_status']='رد شده';if($model->balance($state,1,'1405/08',$monthOf)['available']!==100)throw new Exception('rejected_reservation');
$state['orders'][0]=$order;$ref=&$state['orders'][0];$snapshot=$model->snapshot($state['orders']);$ref['estimated_total']=99;if($snapshot[0]['estimated_total']!==30)throw new Exception('reference_leak');unset($ref);
$unrelated=$state;$unrelated['orders'][0]['status']='ارسال شد';$unrelated['customers'][0]['monthly_credit']['enabled']=false;$model->assertChanges($state,$unrelated,'1405/08',$monthOf);
$unrelated['orders'][0]['payment_method']='cash';$unrelated['orders'][0]['requested_payment_method']='cash';$unrelated['orders'][0]['estimated_total']=1000;$model->assertChanges($state,$unrelated,'1405/08',$monthOf);
echo "PASS: debt carry, monthly quota, pending reservation, cancellation/rejection, repayment, cash independence, immutable snapshot\n";
/** Fake the storage boundary: commit only when the entire callback succeeds. */
function ghadir_db(bool $write,callable $fn){global $fixtureState;$copy=unserialize(serialize($fixtureState));$result=$fn($copy);if($write)$fixtureState=$copy;return $result;}
/** Supply a deterministic solar-month fixture clock. */
function now(): string{return '1405/08/09';}
/** Keep the fixture independent of the production calendar and timezone. */
function jalali_date_value(string $date): string{return $date;}
$fixtureState=['customers'=>[$customer],'orders'=>[$order]];
$facade=new GpCustomerCredit($model,(new GpCreditConfigRepository(dirname(__DIR__).'/config/customer-credit.yaml'))->load());
try{$facade->transaction(true,static function(array &$s)use($next){$s['orders'][]=array_merge($next,['estimated_total'=>71]);$s['inventory'][]=['marker'=>'must_not_commit'];return true;});throw new LogicException('transaction accepted');}catch(GpMonthlyCreditViolation $e){}
if(count($fixtureState['orders'])!==1||isset($fixtureState['inventory']))throw new Exception('rejected_write_committed');
$facade->transaction(true,static function(array &$s)use($next){$s['orders'][]=$next;return true;});
try{$facade->transaction(true,static function(array &$s)use($next){$copy=$next;$copy['id']=3;$copy['estimated_total']=1;$s['orders'][]=$copy;return true;});throw new LogicException('second reservation exceeded limit');}catch(GpMonthlyCreditViolation $e){}
if(count($fixtureState['orders'])!==2)throw new Exception('duplicate_reservation_committed');
echo "PASS: transactional rollback, sequential reservations cannot exceed capacity\n";
/** Capture endpoint output without HTTP or production state. */
final class CreditFixtureResponse extends RuntimeException {public array $data;/** Inject the expected JSON payload. */public function __construct(array $data){parent::__construct('response');$this->data=$data;}}
/** Existing auth stand-in enforces the same role contract. */
function auth(array $roles=[]): array {global $fixtureUser;if($roles&&!array_intersect($roles,$fixtureUser['roles']))throw new RuntimeException('forbidden',403);return $fixtureUser;}
/** Read the controlled synthetic request. */
function input(): array {global $fixtureRequest;return $fixtureRequest;}
/** Capture JSON output. */
function out(array $data): void {throw new CreditFixtureResponse($data);}
/** Capture validation failures. */
function fail(string $message,int $status=400): void {throw new RuntimeException($message,$status);}
$p='/api/customer-credit';$m='GET';$_GET=['id'=>999];$fixtureUser=['customer_id'=>1,'roles'=>['customer'],'username'=>'fixture'];
try{include dirname(__DIR__).'/lib/customer-credit-routes.php';throw new LogicException('missing response');}catch(CreditFixtureResponse $e){if($e->data['outstanding']!==100)throw new LogicException('customer identity bypass');}
$m='POST';$fixtureRequest=['id'=>1,'enabled'=>true,'limit'=>200];
foreach([['customer'],['sales']] as $roles){$fixtureUser['roles']=$roles;try{include dirname(__DIR__).'/lib/customer-credit-routes.php';throw new LogicException('unauthorized settings accepted');}catch(RuntimeException $e){if($e->getCode()!==403)throw $e;}}
$fixtureUser['roles']=['finance'];try{include dirname(__DIR__).'/lib/customer-credit-routes.php';throw new LogicException('missing finance response');}catch(CreditFixtureResponse $e){if($e->data['limit']!==200)throw new LogicException('finance setting not saved');}
if($fixtureState['customers'][0]['monthly_credit']['updated_by']!=='fixture')throw new LogicException('missing setting actor');
echo "PASS: customer isolation, manager-only activation and limits, financial settings actor\n";
/** Mirror each website's authenticated transaction entrypoint. */
function db(bool $write,callable $fn){return $write?GpCustomerCredit::create()->transaction(true,$fn):ghadir_db(false,$fn);}
