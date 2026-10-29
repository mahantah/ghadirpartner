<?php
declare(strict_types=1);
/** Capture a synthetic read response without accessing a live database. */
final class WebPartialViewResponse extends Exception
{
    public array $payload;
    /** Retain the explicitly whitelisted snapshot for assertions. */
    public function __construct(array $payload) { parent::__construct('response');$this->payload=$payload; }
}
/** Verify the actual selected-order GET adapter is manager-only and read-only. */
final class WebPartialViewFixture
{
    public static array $roles=['admin'];
    public static array $state=['orders'=>[['id'=>91,'number'=>'FIXTURE-91','customer_name'=>'Synthetic','approval_status'=>'تأیید شده','status'=>'آماده ارسال','payment_status'=>'بیعانه','items'=>[['product'=>'I90','qty'=>9,'serials'=>['A','B','C']]],'exit_items'=>[],'payment_details'=>['private_fixture'=>'not exported'],'history'=>[['private_fixture'=>'not exported']]]],'inventory'=>[['private_fixture'=>'not exported']],'cartons'=>[['private_fixture'=>'not exported']]];
    public static int $reads=0;
    /** Invoke the real route with fabricated HTTP query/authentication boundaries. */
    public static function request(string $method,string $id): array {
        $p='/api/orders/partial-dispatch-view';$m=$method;$_GET=['id'=>$id];
        try{require __DIR__.'/../lib/partial-delivery-web-routes.php';}
        catch(WebPartialViewResponse $response){return ['status'=>200,'payload'=>$response->payload];}
        catch(RuntimeException $error){return ['status'=>$error->getCode()];}
        throw new LogicException('Missing route response');
    }
    /** Assert roles, input validation, field minimization and zero state changes. */
    public static function run(): void {
        $before=self::$state;
        foreach([[],['prep'],['sales'],['finance'],['customer']] as $roles){self::$roles=$roles;self::check(self::request('GET','91')['status']===403,'manager authorization');}
        self::check(self::$reads===0,'unauthorized request read state');self::$roles=['admin'];
        self::check(self::request('POST','91')['status']===405,'GET only');
        self::check(self::request('GET','bad')['status']===422,'invalid identifier');
        self::check(self::request('GET','999')['status']===404,'missing order');
        $response=self::request('GET','91');self::check($response['status']===200,'read succeeded');
        self::check($response['payload']['id']===91&&$response['payload']['items'][0]['serials']===['A','B','C'],'ready physical serials retained');
        self::check(!isset($response['payload']['payment_details'])&&!isset($response['payload']['history'])&&!isset($response['payload']['inventory']),'no unrelated private fields exported');
        self::check(self::$state===$before,'read-only transaction changed state');
        echo "PASS: real web snapshot route authorization, GET-only semantics, minimal physical data and no writes\n";
    }
    private static function check(bool $condition,string $message): void { if(!$condition)throw new LogicException($message); }
}
/** Enforce the exact role required by the real adapter. */
function auth(array $roles=[]): array { if(!array_intersect($roles,WebPartialViewFixture::$roles))fail('forbidden',403);return ['username'=>'fixture']; }
/** Refuse any accidental write through the read adapter. */
function db(bool $write,callable $operation): array { if($write)throw new LogicException('Write attempted by snapshot');WebPartialViewFixture::$reads++;return $operation(WebPartialViewFixture::$state); }
/** Find a fabricated order. */
function idx(array $rows,int $id): int { foreach($rows as $index=>$row)if($row['id']===$id)return $index;return -1; }
/** Return the prepared physical rows from the fixture. */
function gp_exit_items(array $state,array $order): array { return $order['items']; }
/** Return already dispatched rows from the fixture. */
function gp_actual_shipped_items(array $order): array { return $order['exit_items']; }
/** Raise a captured HTTP error instead of exiting. */
function fail(string $message,int $status=400): void { throw new RuntimeException($message,$status); }
/** Capture the JSON response. */
function out(array $payload): void { throw new WebPartialViewResponse($payload); }
WebPartialViewFixture::run();
