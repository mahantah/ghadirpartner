<?php
declare(strict_types=1);
/** Synthetic transport fixture. Optional owner helpers exercise the actual warehouse ledger privately. */
final class PartialDispatchResponse extends Exception
{
    public array $order;
    /** Retain an in-memory response instead of exiting the PHP process. */
    public function __construct(array $order) { parent::__construct('response');$this->order=$order; }
}
/** Keep all database, authentication and HTTP effects in this in-memory test boundary. */
final class PartialDispatchFixture
{
    public static array $state=[];
    public static array $request=[];
    public static array $roles=['admin'];
    /** Run the actual adapter against a transactionally copied synthetic state. */
    public static function call(array $request,string $method='POST'): array {
        self::$request=$request;$p='/api/orders/partial-dispatch';$m=$method;
        try{require __DIR__.'/../lib/partial-dispatch-routes.php';}
        catch(PartialDispatchResponse $response){return ['status'=>200,'order'=>$response->order];}
        catch(RuntimeException $error){return ['status'=>$error->getCode(),'message'=>$error->getMessage()];}
        throw new LogicException('Missing response');
    }
    /** Assert transaction boundaries, exact movements, remaining quantities and payment preservation. */
    public static function run(): void {
        $items=[];$inventory=[];
        foreach(['I90'=>6,'I80'=>3] as $product=>$qty){$serials=[];for($i=1;$i<=$qty;$i++){$serial=$product.'-'.$i;$serials[]=$serial;$inventory[]=['serial'=>$serial,'product'=>$product,'order_id'=>91,'order_number'=>'TEST-91','warehouse_id'=>1];}$items[]=['product'=>$product,'qty'=>$qty,'serials'=>$serials];}
        self::$state=['orders'=>[['id'=>91,'number'=>'TEST-91','approval_status'=>'تأیید شده','status'=>'آماده ارسال','payment_status'=>'بیعانه','approved_total'=>900,'paid_amount'=>300,'payment_details'=>['fixture'=>'unchanged'],'items'=>$items]],'inventory'=>$inventory,'warehouse_movements'=>[],'products'=>[['name'=>'I90','serial_required'=>true],['name'=>'I80','serial_required'=>true]],'cartons'=>[['code'=>'UNRELATED','warehouse_id'=>1]],'sms_outbox'=>[],'payment_transactions'=>[['id'=>1,'amount'=>300]]];
        $before=self::$state;
        $request=['id'=>91,'request_id'=>'fixture-request-0001','reason'=>'تحویل یک سوم با مجوز مدیر','items'=>[['product'=>'I90','qty'=>2,'serials'=>['I90-1','I90-2']],['product'=>'I80','qty'=>1,'serials'=>['I80-1']]],'shipping_type'=>'حضوری'];
        foreach([[],['customer'],['sales'],['prep'],['finance']] as $role){self::$roles=$role;self::check(self::call($request)['status']===403,'only management');}
        self::$roles=['admin'];self::check(self::call($request,'GET')['status']===405,'POST only');
        $badRequests=[array_merge($request,['reason'=>'']),array_merge($request,['items'=>[['product'=>'I90','qty'=>0]]]),array_merge($request,['items'=>[['product'=>'I90','qty'=>'2']]]),array_merge($request,['items'=>[['product'=>'I90','qty'=>7]]]),array_merge($request,['items'=>[['product'=>'I90','qty'=>1],['product'=>'I90','qty'=>1]]]),array_merge($request,['items'=>[['product'=>'UNKNOWN','qty'=>1]]]),array_merge($request,['items'=>[['product'=>'I90','qty'=>6],['product'=>'I80','qty'=>3]]]),array_merge($request,['shipping_type'=>'ماهکس']),array_merge($request,['shipping_type'=>'پیک'])];
        $badRequests[]=array_merge($request,['items'=>[['product'=>'I90','qty'=>1,'serials'=>['I80-1']]]]);
        $badRequests[]=array_merge($request,['items'=>[['product'=>'I90','qty'=>2,'serials'=>['I90-1','I90-1']]]]);
        foreach($badRequests as $bad)self::check(self::call($bad)['status']===422,'invalid release rejected');
        self::check(self::$state===$before,'no mutation before validated authorization');
        self::$state['inventory'][0]['order_id']=999;self::check(self::call($request)['status']===409,'wrong owner');self::check(self::$state['warehouse_movements']===[],'no movements on wrong owner');self::$state=$before;
        $response=self::call($request);self::check($response['status']===200,'release succeeded');$order=$response['order'];
        self::check($order['exit_device_qty']===3&&$order['partial_exit']===true&&$order['status']==='ارسال شد','partial with all serials ready');
        self::check($order['payment_status']==='بیعانه'&&$order['approved_total']===900&&$order['paid_amount']===300&&$order['payment_details']===$before['orders'][0]['payment_details'],'payment unchanged');
        self::check(array_column(array_filter(self::$state['inventory'],static fn(array $row): bool=>$row['warehouse_id']===0),'serial')===['I90-1','I90-2','I80-1'],'exact selected serials leave');
        self::check(count(array_filter(self::$state['inventory'],static fn(array $row): bool=>$row['warehouse_id']===1))===6,'six units still in warehouse');
        self::check($order['items']===$before['orders'][0]['items']&&self::$state['cartons']===$before['cartons']&&self::$state['payment_transactions']===$before['payment_transactions']&&self::$state['sms_outbox']===[],'allocations cartons payment and SMS preserved');
        $after=self::$state;self::check(self::call($request)['status']===200&&self::$state===$after,'identical retry has no second movement');
        self::check(self::call(array_merge($request,['reason'=>'changed']))['status']===409&&self::$state===$after,'idempotency identity cannot change meaning');
        $second=array_merge($request,['request_id'=>'fixture-request-0002','items'=>[['product'=>'I90','qty'=>1,'serials'=>['I90-3']]]]);
        self::check(self::call($second)['status']===200&&self::$state['orders'][0]['exit_device_qty']===4,'second release skips shipped serials');
        self::check(self::$state['inventory'][2]['warehouse_id']===0&&self::$state['inventory'][3]['warehouse_id']===1,'only next ready serial moves');
        $after=self::$state;$final=array_merge($request,['request_id'=>'fixture-request-0003','items'=>[['product'=>'I90','qty'=>3,'serials'=>['I90-4','I90-5','I90-6']],['product'=>'I80','qty'=>2,'serials'=>['I80-2','I80-3']]]]);
        self::check(self::call($final)['status']===422&&self::$state===$after,'cannot release entire remainder through partial exception');
        foreach(['لغو شد','تحویل شد','ثبت شده'] as $status){self::$state['orders'][0]['status']=$status;self::check(self::call($second)['status']===200,'successful retry remains a no-op after status changed');self::check(self::call($final)['status']===422,'invalid order stage');}
        echo "PASS: admin-only one-third delivery, fully ready serials, exact warehouse subset, unchanged payment, repeat safety, ownership rollback and remainder guards\n";
    }
    private static function check(bool $condition,string $message): void { if(!$condition)throw new LogicException($message); }
}
/** Require management authorization at the same transport boundary as production. */
function auth(array $roles=[]): array { if(!array_intersect($roles,PartialDispatchFixture::$roles))fail('forbidden',403);return ['username'=>'fixture-admin']; }
/** Read only the synthetic request object. */
function input(): array { return PartialDispatchFixture::$request; }
/** Commit copied state only when the whole operation succeeds. */
function db(bool $write,callable $operation): array { $copy=PartialDispatchFixture::$state;$result=$operation($copy);if($write)PartialDispatchFixture::$state=$copy;return $result; }
/** Find a synthetic order. */
function idx(array $rows,int $id): int { foreach($rows as $index=>$row)if($row['id']===$id)return $index;return -1; }
/** Raise an HTTP error without outputting or persisting data. */
function fail(string $message,int $status=400): void { throw new RuntimeException($message,$status); }
/** Capture the transport response. */
function out(array $order): void { throw new PartialDispatchResponse($order); }
/** Keep fixture audit time deterministic. */
function now(): string { return '2026-10-29 12:00:00'; }
/** Append an explicit management audit entry. */
function hist(array &$order,string $by,string $action): void { $order['history'][]=['by'=>$by,'action'=>$action,'at'=>now()]; }
/** Match catalog model names for the warehouse boundary. */
function same_product_name(string $left,string $right): bool { return $left===$right; }
/** Canonical model key for the optional real merge helper. */
function product_name_key(string $name): string { return strtoupper(trim($name)); }
if(getenv('GP_PARTIAL_HELPERS'))require (string)getenv('GP_PARTIAL_HELPERS');
else {
    /** Read explicitly recorded previous shipments for the synthetic fixture. */
    function gp_actual_shipped_items(array $order): array { return $order['exit_items']??[]; }
    /** Read ready serials from the synthetic physical rows. */
    function gp_exit_items(array $state,array $order): array { return $order['items']; }
    /** Merge synthetic shipment groups without changing assigned physical rows. */
    function gp_merge_exit_items(array $left,array $right): array { $map=[];foreach(array_merge($left,$right) as $item){$p=$item['product'];$map[$p]=array_merge($map[$p]??[],$item['serials']);}$result=[];foreach($map as $p=>$serials)$result[]=['product'=>$p,'qty'=>count($serials),'serials'=>$serials];return $result; }
    /** Sum the synthetic physical shipment quantity. */
    function gp_exit_device_qty(array $items): int { return array_sum(array_column($items,'qty')); }
    /** Capture the exact requested movement; real-owner ledger is tested separately when available. */
    function ghadir_warehouse_exit_items(array &$state,array &$order,array $items,string $by,string $note): int { $wanted=[];foreach($items as $item)$wanted=array_merge($wanted,$item['serials']);$n=0;foreach($state['inventory'] as &$serial)if(in_array($serial['serial'],$wanted,true)){$serial['warehouse_id']=0;$n++;}unset($serial);$state['warehouse_movements'][]=['items'=>$items,'by'=>$by,'note'=>$note];return $n; }
}
PartialDispatchFixture::run();
