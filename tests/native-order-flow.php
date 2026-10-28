<?php
declare(strict_types=1);
require_once __DIR__.'/../lib/native-order-flow.php';

/** Runs independent, in-memory order and review transitions without production services. */
final class NativeOrderFlowTest
{
    private int $checks = 0;
    private GpCustomerOrderFlow $service;
    private array $policy;

    /** Use the checked-in public policy, never production config or customer data. */
    public function __construct()
    {
        $this->policy = (new GpOrderPolicyRepository(__DIR__.'/../config/native-order-flow.yaml'))->load();
        $this->service = new GpCustomerOrderFlow($this->policy);
    }

    private function check(bool $condition, string $message): void
    {
        if (!$condition) throw new RuntimeException($message);
        $this->checks++;
    }

    private function fails(callable $operation, string $message): void
    {
        try { $operation(); } catch (InvalidArgumentException $error) { $this->checks++; return; }
        throw new RuntimeException($message);
    }

    private function request(): array
    {
        return ['invoice_type'=>'رسمی', 'requested_payment_method'=>'credit', 'settlement_details'=>['terms_accepted'=>true,'commitment_sha256'=>hash('sha256',$this->policy['credit_commitment'])],
            'items'=>[['product'=>'I90','qty'=>2,'price_key'=>'panel_cash'], ['product'=>'I90','qty'=>3,'price_key'=>'serial_1_50']]];
    }

    /** Exercise cart validation, exact prices, review outcomes and fail-closed transitions. */
    public function run(): void
    {
        $request = $this->request(); $this->service->validateRequest($request);
        foreach (['cash','check','credit'] as $method) {
            $request['requested_payment_method']=$method; $this->service->validateRequest($request); $this->checks++;
        }
        $request=$this->request();unset($request['invoice_type']);
        $this->fails(function () use ($request): void { $this->service->validateRequest($request); }, 'implicit invoice');
        foreach ([false, 'true', 'false', 1, null] as $acceptance) {
            $request=$this->request();$request['settlement_details']['terms_accepted']=$acceptance;
            $this->fails(function () use ($request): void { $this->service->validateRequest($request); }, 'non-boolean consent');
        }
        $request=$this->request();unset($request['settlement_details']['commitment_sha256']);
        $this->fails(function () use ($request): void { $this->service->validateRequest($request); }, 'legacy consent cannot claim new wording');
        $request=$this->request();$request['settlement_details']['commitment_sha256']=hash('sha256','old text');
        $this->fails(function () use ($request): void { $this->service->validateRequest($request); }, 'stale consent revision');
        $request=$this->request();$request['items'][]=$request['items'][0];
        $this->fails(function () use ($request): void { $this->service->validateRequest($request); }, 'duplicate option');
        $request=$this->request();$request['items'][1]['qty']=51;
        $this->fails(function () use ($request): void { $this->service->validateRequest($request); }, 'wrong serial tier');
        $request['items'][1]['price_key']='serial_51_200';$this->service->validateRequest($request);
        $request['items'][0]['qty']=999;
        $this->fails(function () use ($request): void { $this->service->validateRequest($request); }, 'split quantity limit');
        $purchase=[['product'=>'I90','qty'=>2,'price_key'=>'panel_cash','price_label'=>'پنل','unit_price'=>101,'line_total'=>202,'serials'=>[]],
            ['product'=>'I90','qty'=>3,'price_key'=>'serial_1_50','price_label'=>'آزاد','unit_price'=>117,'line_total'=>351,'serials'=>[]]];
        $physical=$this->service->fulfillmentItems($purchase);
        $this->check(count($physical)===1 && $physical[0]['qty']===5, 'one physical model row');
        $this->check($physical[0]['line_total']===553 && $physical[0]['purchase_lines']===$purchase, 'exact integer financial rows');
        $this->check($physical[0]['serials']===[], 'no serial allocation during creation');
        $snapshot=$this->service->creditCommitment($this->request());
        $this->check($snapshot['terms_accepted']===true && hash('sha256',$snapshot['commitment_text'])===$snapshot['commitment_sha256'], 'server consent snapshot');
        $pending=['id'=>1,'approval_status'=>'در انتظار تأیید','status'=>'در انتظار تأیید سفارش','items'=>$physical,'created_at'=>'fixture-created','payment_status'=>'پرداخت نشده'];
        $rejected=$this->service->reject($pending,'عدم امکان تأمین','fixture-sales','fixture-reviewed');
        $this->check($rejected['status']==='لغو شد' && $rejected['approval_status']==='رد شده', 'explicit rejection');
        $this->check($rejected['rejection_reason']==='عدم امکان تأمین', 'visible reason');
        $this->check($rejected['items']===$pending['items'] && $rejected['created_at']===$pending['created_at'] && $rejected['payment_status']===$pending['payment_status'], 'no stock/date/payment mutation');
        $this->fails(function () use ($rejected): void { $this->service->assertPending($rejected); }, 'cannot approve a rejected order');
        $this->fails(function () use ($pending): void { $this->service->reject($pending,'  ','s','at'); }, 'reason required');
        $assigned=$pending;$assigned['items'][0]['serials']=['FIXTURE-SERIAL'];
        $this->fails(function () use ($assigned): void { $this->service->reject($assigned,'reason','s','at'); }, 'allocated serial protected');
        $this->fails(function () use ($pending): void { $this->service->assertEditable($pending); }, 'legacy edit cannot lose mixed prices');
        $this->service->assertEditable(['items'=>[$purchase[0]]]);
        echo 'PASS: '.$this->checks." order-flow checks\n";
    }
}
(new NativeOrderFlowTest())->run();
