<?php
declare(strict_types=1);
require_once __DIR__.'/../lib/offer-product-scope.php';
/** Synthetic financial rows prove nonselected products never receive the plan discount. */
final class OfferProductScopeTest {
    /** Exercise multi, legacy, all-product, validation and old-client contracts. */
    public static function run(): void {
        $catalog=[['name'=>'I90'],['name'=>'M3P'],['name'=>'V77']];
        $scope=GpOfferProductScope::normalize(['products'=>['I90','M3P','I90']],$catalog);
        self::check($scope===['I90','M3P'],'canonical scope');
        $items=[['product'=>'I90','line_total'=>101],['product'=>'M3P','line_total'=>200],['product'=>'V77','line_total'=>900]];
        $offer=['products'=>$scope,'discount_type'=>'percent','discount_value'=>10];
        self::check(GpOfferProductScope::discount($offer,$items)===30,'selected percentage only and floor');
        $offer['discount_type']='amount';$offer['discount_value']=1000;
        self::check(GpOfferProductScope::discount($offer,$items)===301,'fixed amount capped to selected rows');
        self::check(GpOfferProductScope::discount(['product'=>'V77','discount_type'=>'percent','discount_value'=>10],$items)===90,'legacy single product');
        self::check(GpOfferProductScope::discount(['products'=>[],'discount_type'=>'percent','discount_value'=>10],$items)===120,'all products');
        self::check(GpOfferProductScope::discount(['products'=>['UNKNOWN'],'discount_type'=>'percent','discount_value'=>10],$items)===0,'no eligible rows');
        foreach([['products'=>'I90'],['products'=>['UNKNOWN']],['products'=>[7]]] as $bad){try{GpOfferProductScope::normalize($bad,$catalog);throw new LogicException('invalid scope accepted');}catch(InvalidArgumentException $error){}}
        self::check(GpOfferProductScope::normalize(['product'=>'I90'],$catalog)===['I90'],'legacy request');
        $offers=[['id'=>1,'products'=>['I90','M3P']],['id'=>2,'product'=>'I90']];
        self::check(count(GpOfferProductScope::visibleToClient($offers,['HTTP_USER_AGENT'=>'GhadirPartnerNative/5.4.3.3-r5.16 Android']))===1,'old client must not misprice multi');
        self::check(count(GpOfferProductScope::visibleToClient($offers,['HTTP_USER_AGENT'=>'GhadirPartnerNative/5.4.3.3-r5.17 Android','HTTP_X_GHADIR_OFFER_PRODUCT_SCOPE'=>'multiple']))===2,'capable native client');
        self::check(count(GpOfferProductScope::visibleToClient($offers,['HTTP_USER_AGENT'=>'Mozilla']))===2,'web offers unchanged');
        $state=['orders'=>[['id'=>10,'offer_id'=>7],['id'=>11,'offer_id'=>7],['id'=>12,'offer_id'=>8]],'offer_usages'=>[['offer_id'=>7,'order_id'=>10],['offer_id'=>7,'order_id'=>10],['offer_id'=>7,'order_id'=>13]]];
        self::check(GpOfferProductScope::usageCount($state,7)===3,'historical and new orders counted once');
        self::check(GpOfferProductScope::exhausted($state,['id'=>7,'max_uses'=>3]),'global limit exhausted');
        self::check(!GpOfferProductScope::exhausted($state,['id'=>7,'max_uses'=>4]),'last redemption available');
        self::check(!GpOfferProductScope::exhausted($state,['id'=>7]),'legacy unlimited');
        foreach([-1,'5',1.5,[],true] as $bad){try{GpOfferProductScope::limit(['max_uses'=>$bad]);throw new LogicException('invalid limit accepted');}catch(InvalidArgumentException $error){}}
        self::check(GpOfferProductScope::limit(['max_uses'=>0])===0,'unlimited limit');
        echo "PASS: multi/single/all eligibility, exact rounding/caps, validation and native compatibility\n";
    }
    /** Identify an invariant failure without exposing any real customer or order. */
    private static function check(bool $condition,string $message): void {if(!$condition)throw new RuntimeException($message);}
}
OfferProductScopeTest::run();

/** Exercise the actual bounded deletion routes with synthetic transactional state. */
final class OfferRouteResult extends RuntimeException { public $payload; public function __construct($payload){parent::__construct('result');$this->payload=$payload;} }
function auth(array $roles): array {if(!in_array('admin',$GLOBALS['fixture_roles'],true))throw new RuntimeException('unauthorized');return ['roles'=>$GLOBALS['fixture_roles']];}
function input(): array {return $GLOBALS['fixture_input'];}
function fail($message,$status=400): void {throw new RuntimeException((string)$status);}
function idx(array $rows,$id): int {foreach($rows as $i=>$row)if((int)$row['id']===(int)$id)return $i;return -1;}
function now(): string {return '2026-10-31 12:00:00';}
function db(bool $write,callable $fn){$copy=$GLOBALS['fixture_state'];$result=$fn($copy);if($write)$GLOBALS['fixture_state']=$copy;return $result;}
function out($value): void {throw new OfferRouteResult($value);}
$manifest=json_decode(file_get_contents(__DIR__.'/../config/offer-product-scope-release.yaml'),true,512,JSON_THROW_ON_ERROR);
foreach(['index.php','partners/index.php'] as $file){
    $matches=array_values(array_filter($manifest['operations'],static function($op)use($file){return $op['file']===$file&&strpos($op['new'],"if(\$p==='/api/offers/delete'")===0;}));
    if(count($matches)!==1)throw new RuntimeException('deletion route not unique');
    $route=substr($matches[0]['new'],0,strpos($matches[0]['new'],"if(\$p==='/api/offers/save'"));
    $p='/api/offers/delete';$m='POST';$GLOBALS['fixture_roles']=['admin'];$GLOBALS['fixture_input']=['id'=>7];
    $GLOBALS['fixture_state']=['special_offers'=>[['id'=>7,'active'=>true]],'orders'=>[['id'=>10,'offer_id'=>7]],'offer_usages'=>[['offer_id'=>7,'order_id'=>10]]];
    $original=$GLOBALS['fixture_state'];
    try{eval($route);throw new LogicException('no result');}catch(OfferRouteResult $result){if(empty($result->payload['ok']))throw new RuntimeException('delete failed');}
    $state=$GLOBALS['fixture_state'];if(empty($state['special_offers'][0]['deleted'])||$state['special_offers'][0]['active']||$state['orders']!==$original['orders']||$state['offer_usages']!==$original['offer_usages'])throw new RuntimeException('deletion changed history');
    foreach([['roles'=>['customer'],'input'=>['id'=>7],'error'=>'unauthorized'],['roles'=>['admin'],'input'=>['id'=>'7'],'error'=>'422'],['roles'=>['admin'],'input'=>['id'=>99],'error'=>'404']] as $case){
        $GLOBALS['fixture_roles']=$case['roles'];$GLOBALS['fixture_input']=$case['input'];$before=$GLOBALS['fixture_state'];
        try{eval($route);throw new LogicException('invalid deletion accepted');}catch(RuntimeException $error){if($error->getMessage()!==$case['error'])throw $error;}
        if($GLOBALS['fixture_state']!==$before)throw new RuntimeException('failed deletion changed state');
    }
}
echo "PASS: both actual delete routes enforce admin, validate ids and preserve order/usage history\n";
