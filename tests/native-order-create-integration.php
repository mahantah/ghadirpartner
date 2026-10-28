<?php
declare(strict_types=1);

/** Captures only sanitized route responses. */
final class NativeCreateResult extends Exception
{
    public array $payload;
    /** Retain fixture JSON instead of exiting a web request. */
    public function __construct(array $payload) { parent::__construct('response');$this->payload=$payload; }
}

/** Executes the privately staged creation handler with fixture-only infrastructure. */
final class NativeCreateFixture
{
    public static array $state=[];
    public static array $request=[];
    public static int $commits=0;
    private static string $route='';

    /** Load matching handler source, with no production configuration or customer storage. */
    public static function run(string $staged, string $original): void
    {
        require_once __DIR__.'/../lib/native-order-flow.php';
        require_once __DIR__.'/../lib/customer-price-access.php';
        $p='';$m='';require $original.'/partners/native-r54.php';
        $policy=(new GpOrderPolicyRepository(__DIR__.'/../config/native-order-flow.yaml'))->load();
        $GLOBALS['gpCustomerOrderFlow']=new GpCustomerOrderFlow($policy);
        $source=file_get_contents($staged.'/partners/index.php');
        $start=strpos($source,"if(\$p==='/api/orders/add'){");
        $end=strpos($source,"if(\$p==='/api/customer-order/approve'",$start);
        if ($start===false || $end===false) throw new RuntimeException('Creation handler not found');
        self::$route=substr($source,$start,$end-$start);
        self::$state=['next_order'=>1,'orders'=>[],'settings'=>[],
            'customers'=>[['id'=>7,'name'=>'FIXTURE-CUSTOMER','active'=>true,'visible_price_groups'=>['panel','serial']]],
            'products'=>[['name'=>'I90','available'=>true,'stock'=>5,'serial_required'=>true,'prices'=>['panel_cash'=>101,'serial_1_50'=>117,'serial_51_200'=>110]]],
            'inventory'=>[['serial'=>'FIXTURE-ONLY','order_id'=>0]],'cartons'=>[['code'=>'FIXTURE-ONLY']]];
        $before=self::$state;
        self::$request=['customer_id'=>999,'invoice_type'=>'رسمی','requested_payment_method'=>'credit','settlement_details'=>['terms_accepted'=>true,'commitment_sha256'=>hash('sha256',$policy['credit_commitment'])],
            'items'=>[['product'=>'I90','qty'=>2,'price_key'=>'panel_cash'],['product'=>'I90','qty'=>3,'price_key'=>'serial_1_50']]];
        $order=self::create();
        self::check($order['customer_id']===7,'authenticated customer ownership');
        self::check(count($order['items'])===1 && $order['items'][0]['qty']===5,'shared warehouse row');
        self::check(count($order['purchase_items'])===2 && $order['estimated_total']===553,'exact separate prices and total');
        self::check($order['approval_status']==='در انتظار تأیید' && $order['status']==='در انتظار تأیید سفارش','pending company review');
        self::check($order['native_settlement']['terms_accepted']===true && isset($order['native_settlement']['commitment_sha256']),'persist explicit credit commitment');
        self::check(!isset($order['settlement_details']) && $order['payment_status']==='پرداخت نشده','raw evidence not duplicated and payment not approved');
        self::check(self::$state['inventory']===$before['inventory'] && self::$state['cartons']===$before['cartons'],'no inventory/carton writes');
        self::$request['items'][1]['qty']=4;
        try { self::create();throw new RuntimeException('Combined overstock accepted'); }
        catch (RuntimeException $error) { self::check($error->getCode()===400,'combined stock guard'); }
        self::check(self::$commits===1 && count(self::$state['orders'])===1,'failed creation does not commit');
        self::$request['items'][1]['qty']=3;self::$request['settlement_details']['terms_accepted']=false;
        try { self::create();throw new RuntimeException('Missing consent accepted'); }
        catch (RuntimeException $error) { self::check($error->getCode()===422,'credit consent guard'); }
        self::$request['settlement_details']['terms_accepted']=true;self::$request['invoice_type']='';
        try { self::create();throw new RuntimeException('Missing invoice accepted'); }
        catch (RuntimeException $error) { self::check($error->getCode()===400,'invoice guard'); }
        self::check(self::$commits===1,'all missing-decision requests leave storage unchanged');
        echo "PASS: actual owner creation handler, mixed prices/stock, mandatory consent/invoice, pending review\n";
    }

    private static function create(): array
    {
        global $gpCustomerOrderFlow;
        $p='/api/orders/add';$m='POST';$cfg=[];
        try { eval(self::$route); }
        catch (NativeCreateResult $result) { return $result->payload; }
        throw new RuntimeException('No order response');
    }

    private static function check(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
}
/** Authenticate a synthetic customer without network or cookies. */
function auth(array $roles=[]): array { return ['username'=>'FIXTURE-USER','roles'=>['customer'],'customer_id'=>7]; }
/** Decode a fixture request only. */
function input(): array { return NativeCreateFixture::$request; }
/** Preserve rollback when creation fails validation midway through a transaction. */
function db(bool $write, callable $operation): array {
    $copy=NativeCreateFixture::$state;$result=$operation($copy);
    if ($write) {NativeCreateFixture::$state=$copy;NativeCreateFixture::$commits++;}return $result;
}
/** Match fixture identity values. */
function idx(array $rows, int $id): int {foreach ($rows as $index=>$row) if ($row['id']===$id)return $index;return -1;}
/** Raise a fixture HTTP error instead of exiting PHP. */
function fail(string $message, int $status=400): void {throw new RuntimeException($message,$status);}
/** Capture the synthetic response. */
function out(array $value): void {throw new NativeCreateResult($value);}
/** Preserve active-customer semantics for the fixture. */
function gp_customer_active(array $customer): bool {return !empty($customer['active']);}
/** Use the fixture catalog's shared stock amount. */
function customer_orderable_stock(array $state, string $name): int {return $state['products'][0]['stock'];}
/** Normalize only the synthetic promo code. */
function promo_code_norm(string $code): string {return strtoupper(trim($code));}
/** Keep unrelated sender metadata out of the order fixture. */
function gp_effective_sender(array $state, array $order): array {return [];}
/** Do not target any actual administrator mobile. */
function admin_order_sms_mobiles(array $settings): array {return [];}
/** Supply a fixed creation timestamp, never a dispatch timestamp. */
function now(): string {return 'FIXTURE-CREATION-TIME';}
/** Save only fixture history. */
function hist(array &$order, string $actor, string $text): void {$order['history'][]=['actor'=>$actor,'text'=>$text];}
/** The route's SMS boundary never sends messages in this test. */
function sms_status(array $customer, array $order, string $message, string $kind): void {}
/** Trim fixture-only optional evidence fields. */
function cut_text(string $text, int $limit): string {return substr($text,0,$limit);}
$staged=getenv('GP_STAGED_SOURCE');$original=getenv('GP_OWNER_SOURCE');
if (!$staged || !$original) throw new RuntimeException('Provide staged and original owner source paths for local-only integration tests');
NativeCreateFixture::run($staged,$original);
