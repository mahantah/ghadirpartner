<?php
declare(strict_types=1);
/** Fixture responses keep all address writes in memory, never in production storage. */
final class PortalAddressResponse extends Exception {
    public array $payload;
    /** Retain the synthetic API result without terminating the test process. */
    public function __construct(array $payload) {parent::__construct('fixture response');$this->payload=$payload;}
}
/** Exercise the actual owner handler against two isolated customer accounts. */
final class PortalAddressFixture {
    public static array $state=[];
    public static array $request=[];
    public static array $user=[];
    private static string $handler='';
    /** Read only the handler source; every operation below uses fixture-only infrastructure. */
    public static function run(string $web): void {
        $source=file_get_contents($web.'/partners/native-r51-core.php');
        $start=strpos($source,"if(\$p==='/api/addresses'){");$end=strpos($source,"if(\$p==='/api/purchased-devices'){",$start===false?0:$start);
        if($start===false||$end===false)throw new RuntimeException('address_fixture_handler_missing');
        self::$handler=substr($source,$start,$end-$start);
        $p='';$m='';require_once $web.'/partners/native-r51-core.php';
        self::$state=['customers'=>[['id'=>7,'address'=>'MAIN-A'],['id'=>8,'delivery_addresses'=>[['id'=>'OTHER','title'=>'OTHER','address'=>'OTHER']]]]];
        self::$user=['roles'=>['customer'],'customer_id'=>7];
        self::check(self::call('GET',[])===[],'empty list');
        $data=['title'=>'دفتر آزمایشی','province'=>'تهران','city'=>'تهران','address'=>'نشانی آزمایشی','postal_code'=>'1234567890'];
        $rows=self::call('POST',$data);self::check(count($rows)===1,'create');$id=$rows[0]['id'];
        self::check(self::call('GET',[])===$rows,'reload persistence');
        $data['id']=$id;$data['address']='نشانی ویرایش‌شده';$rows=self::call('POST',$data);
        self::check($rows[0]['address']===$data['address'],'edit');
        self::check(gp_address_snapshot(self::$state['customers'][0],$id)['address']===$data['address'],'checkout snapshot');
        $before=self::$state;$data['id']='OTHER';self::fails(static function()use($data):void{self::call('POST',$data);},404);
        self::fails(static function():void{gp_address_snapshot(self::$state['customers'][0],'OTHER');},422);
        self::check(self::$state===$before,'cross-account rollback');
        self::$user=['roles'=>['sales'],'customer_id'=>7];self::fails(static function():void{self::call('GET',[]);},403);
        self::$user=['roles'=>['customer'],'customer_id'=>7];
        self::fails(static function():void{self::call('POST',['title'=>'incomplete']);},422);
        self::fails(static function():void{self::call('PUT',[]);},405);
        self::check(self::call('POST',['delete_id'=>$id])===[],'delete');
        self::check(self::$state['customers'][1]===$before['customers'][1],'other account unchanged');
        echo "PASS: real address create/read/edit/delete, validation, account isolation and checkout snapshot\n";
    }
    /** Invoke only the address route, with no HTTP requests or production authentication. */
    public static function call(string $method,array $request): array {
        self::$request=$request;$p='/api/addresses';$m=$method;
        try{eval(self::$handler);}catch(PortalAddressResponse $result){return $result->payload;}
        throw new RuntimeException('address_fixture_no_response');
    }
    /** Fail with a test name rather than printing address fixture contents. */
    private static function check(bool $condition,string $name): void {if(!$condition)throw new RuntimeException('address_fixture_'.$name);}
    /** Verify rejection status and preserve unexpected exceptions. */
    private static function fails(callable $operation,int $status): void {
        try{$operation();}catch(RuntimeException $error){if($error->getCode()===$status)return;throw $error;}
        throw new RuntimeException('address_fixture_expected_rejection');
    }
}
/** Fake authentication restricts the fixture to the same customer role as production. */
function auth(array $roles): array {if(!array_intersect($roles,PortalAddressFixture::$user['roles']))fail('fixture forbidden',403);return PortalAddressFixture::$user;}
/** The fixture commits a copied array only after a successful callback. */
function db(bool $write,callable $callback): array {$copy=PortalAddressFixture::$state;$result=$callback($copy);if($write)PortalAddressFixture::$state=$copy;return $result;}
/** Supply synthetic request data only. */
function input(): array {return PortalAddressFixture::$request;}
/** Capture the fixture response instead of exiting. */
function out(array $payload): void {throw new PortalAddressResponse($payload);}
/** Preserve the real route's failure status without emitting private diagnostics. */
function fail(string $message,int $status=422): void {throw new RuntimeException($message,$status);}
/** Resolve synthetic customer ids as the real adapter expects. */
function idx(array $rows,int $id): int {foreach($rows as $i=>$row)if((int)$row['id']===$id)return $i;return -1;}
// __ADDRESS_FIXTURE_ENTRY__
$owner=getenv('GP_ADDRESS_OWNER_SOURCE');
if($owner!==false&&$owner!=='')PortalAddressFixture::run($owner);
else echo "SKIP: owner-source behavioral fixture runs privately on the host before publication\n";
