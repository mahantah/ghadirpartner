<?php
declare(strict_types=1);

/** Captures a JSON route response without HTTP or process exit. */
final class NativeReviewResult extends Exception
{
    public array $payload;
    /** Retain only synthetic response data for assertions. */
    public function __construct(array $payload) { parent::__construct('response'); $this->payload=$payload; }
}

/** In-memory transaction/authorization fixture for the real route adapter. */
final class NativeReviewFixture
{
    public static array $state=[];
    public static array $user=[];
    public static array $request=[];
    public static int $commits=0;

    /** Invoke the actual adapter, preserving rollback semantics when a guard throws. */
    public static function request(string $method, array $request): array
    {
        self::$request=$request;
        $p='/api/customer-order/reject';$m=$method;
        try { require __DIR__.'/../lib/native-order-flow-routes.php'; }
        catch (NativeReviewResult $result) { return ['status'=>200,'payload'=>$result->payload]; }
        catch (RuntimeException $error) { return ['status'=>$error->getCode()]; }
        throw new RuntimeException('No route response');
    }

    /** Execute allowed and forbidden reviews while checking unrelated data stays byte-identical. */
    public static function run(): void
    {
        self::$state=['orders'=>[['id'=>9,'status'=>'در انتظار تأیید سفارش','approval_status'=>'در انتظار تأیید','items'=>[['product'=>'I90','qty'=>1,'serials'=>[]]],'history'=>[]]],
            'inventory'=>[['serial'=>'FIXTURE','order_id'=>0]],'cartons'=>[['code'=>'FIXTURE-ONLY']]];
        $before=self::$state;
        foreach ([[],['customer'],['finance'],['prep']] as $roles) {
            self::$user=['roles'=>$roles,'username'=>'fixture'];
            self::check(self::request('POST',['id'=>9,'reason'=>'reason'])['status']===403,'authorization');
        }
        self::$user=['roles'=>['sales'],'username'=>'fixture-sales'];
        self::check(self::request('GET',[])['status']===405,'POST only');
        self::check(self::request('POST',['id'=>404,'reason'=>'reason'])['status']===404,'missing order');
        self::check(self::request('POST',['id'=>9,'reason'=>''])['status']===422,'reason required');
        self::check(self::$state===$before && self::$commits===0,'failed transaction rollback');
        self::$state['inventory'][0]['order_id']=9;
        self::check(self::request('POST',['id'=>9,'reason'=>'reason'])['status']===409,'inventory ownership guard');
        self::$state=$before;
        $response=self::request('POST',['id'=>9,'reason'=>'عدم تأیید آزمایشی']);
        self::check($response['status']===200 && self::$commits===1,'one review commit');
        self::check($response['payload']['approval_status']==='رد شده' && $response['payload']['rejection_reason']==='عدم تأیید آزمایشی','visible result');
        self::check(self::$state['inventory']===$before['inventory'] && self::$state['cartons']===$before['cartons'],'inventory and cartons untouched');
        self::check(self::request('POST',['id'=>9,'reason'=>'again'])['status']===422 && self::$commits===1,'no repeated final decision');
        echo "PASS: real review route authorization, rollback and inventory guards\n";
    }

    private static function check(bool $condition, string $message): void
    {
        if (!$condition) throw new RuntimeException($message);
    }
}

/** Replace only the server transport/authentication boundary with fixture implementations. */
function auth(array $roles=[]): array {
    if (!array_intersect($roles,NativeReviewFixture::$user['roles'])) fail('forbidden',403);
    return NativeReviewFixture::$user;
}
/** Return the synthetic decoded request. */
function input(): array { return NativeReviewFixture::$request; }
/** Use a copy so thrown guards cannot partially commit a review. */
function db(bool $write, callable $operation): array {
    $copy=NativeReviewFixture::$state;$result=$operation($copy);
    if ($write) { NativeReviewFixture::$state=$copy;NativeReviewFixture::$commits++; }
    return $result;
}
/** Find a fixture row exactly as the server's identity lookup does. */
function idx(array $rows, int $id): int { foreach ($rows as $index=>$row) if ($row['id']===$id) return $index;return -1; }
/** Raise an HTTP failure without touching a live server. */
function fail(string $message, int $status=400): void { throw new RuntimeException($message,$status); }
/** Capture the JSON response for the fixture caller. */
function out(array $payload): void { throw new NativeReviewResult($payload); }
/** Supply a fixed fixture timestamp instead of dispatch or inventory dates. */
function now(): string { return 'FIXTURE-REVIEW-TIME'; }
/** Record only the synthetic order history. */
function hist(array &$order, string $actor, string $text): void { $order['history'][]=['user'=>$actor,'text'=>$text]; }
NativeReviewFixture::run();
