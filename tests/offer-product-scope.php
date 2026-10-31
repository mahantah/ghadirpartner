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
        echo "PASS: multi/single/all eligibility, exact rounding/caps, validation and native compatibility\n";
    }
    /** Identify an invariant failure without exposing any real customer or order. */
    private static function check(bool $condition,string $message): void {if(!$condition)throw new RuntimeException($message);}
}
OfferProductScopeTest::run();
