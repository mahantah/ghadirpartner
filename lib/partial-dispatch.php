<?php
declare(strict_types=1);

/** Read the finite JSON-compatible YAML policy without a production YAML extension. */
final class PartialDispatchConfigRepository
{
    private string $path;
    /** Inject the public policy location. */
    public function __construct(string $path) { $this->path=$path; }
    /** Validate each tunable before constructing the pure release policy. */
    public function load(): PartialDispatchPolicy {
        $config=json_decode((string)file_get_contents($this->path),true,512,JSON_THROW_ON_ERROR);
        if(!is_array($config)||count($config)!==5)throw new RuntimeException('invalid_partial_dispatch_policy');
        foreach(['maximum_quantity','maximum_reason_bytes'] as $key)if(!is_int($config[$key]??null)||$config[$key]<1||$config[$key]>10000)throw new RuntimeException('invalid_partial_dispatch_policy');
        foreach(['carriers','tracking_carriers','ready_statuses'] as $key){
            if(!is_array($config[$key]??null)||!$config[$key])throw new RuntimeException('invalid_partial_dispatch_policy');
            foreach($config[$key] as $value)if(!is_string($value)||trim($value)==='')throw new RuntimeException('invalid_partial_dispatch_policy');
        }
        if(array_diff($config['tracking_carriers'],$config['carriers']))throw new RuntimeException('invalid_partial_dispatch_policy');
        return new PartialDispatchPolicy($config);
    }
}

/** Plan only an explicitly selected subset of ready, unshipped serials. No I/O or mutation. */
final class PartialDispatchPolicy
{
    private array $config;
    /** Inject validated quantity, reason and carrier policy. */
    public function __construct(array $config) { $this->config=$config; }
    /** Validate and normalize a management-authorized request before opening a transaction. */
    public function request(array $request): array {
        if(!is_int($request['id']??null)||$request['id']<1)throw new InvalidArgumentException('سفارش معتبر نیست');
        if(!is_string($request['request_id']??null)||!preg_match('/^[a-zA-Z0-9-]{16,64}$/D',$request['request_id']))throw new InvalidArgumentException('شناسه ثبت معتبر نیست');
        $reason=$request['reason']??null;
        if(!is_string($reason)||trim($reason)===''||strlen($reason)>$this->config['maximum_reason_bytes'])throw new InvalidArgumentException('علت مجوز تحویل بخشی را وارد کنید');
        $rows=$request['items']??null;
        if(!is_array($rows)||!$rows||count($rows)>$this->config['maximum_quantity'])throw new InvalidArgumentException('تعداد تحویل هر مدل را مشخص کنید');
        $items=[];$requestedSerials=[];
        foreach($rows as $row){
            if(!is_array($row)||!is_string($row['product']??null)||trim($row['product'])===''||!is_int($row['qty']??null)||$row['qty']<1||$row['qty']>$this->config['maximum_quantity'])throw new InvalidArgumentException('تعداد تحویل معتبر نیست');
            $product=trim($row['product']);
            if(isset($items[$product]))throw new InvalidArgumentException('هر مدل را فقط یک بار انتخاب کنید');
            $serials=$row['serials']??null;
            if(!is_array($serials)||count($serials)!==$row['qty'])throw new InvalidArgumentException('سریال‌های انتخاب‌شده را دوباره بررسی کنید');
            $cleanSerials=[];
            foreach($serials as $serial){
                if(!is_string($serial)||trim($serial)===''||strlen($serial)>200)throw new InvalidArgumentException('سریال انتخاب‌شده معتبر نیست');
                $key=strtoupper(trim($serial));
                if(isset($requestedSerials[$key]))throw new InvalidArgumentException('سریال انتخاب‌شده تکراری است');
                $requestedSerials[$key]=true;$cleanSerials[]=$key;
            }
            $items[$product]=['qty'=>$row['qty'],'serials'=>$cleanSerials];
        }
        ksort($items);
        $shipping=$request['shipping_type']??null;$tracking=$request['tracking_code']??'';
        $courierName=$request['courier_name']??'';$courierPhone=$request['courier_phone']??'';
        if(!is_string($shipping)||!in_array($shipping,$this->config['carriers'],true)||!is_string($tracking)||strlen($tracking)>400||!is_string($courierName)||strlen($courierName)>480||!is_string($courierPhone)||strlen($courierPhone)>128)throw new InvalidArgumentException('مشخصات ارسال معتبر نیست');
        if(in_array($shipping,$this->config['tracking_carriers'],true)&&trim($tracking)==='')throw new InvalidArgumentException('کد پیگیری الزامی است');
        if($shipping==='پیک'&&(trim($courierName)===''||trim($courierPhone)===''))throw new InvalidArgumentException('نام و شماره تماس پیک الزامی است');
        $clean=['id'=>$request['id'],'request_id'=>$request['request_id'],'reason'=>trim($reason),'items'=>$items,'shipping_type'=>$shipping,'tracking_code'=>trim($tracking),'courier_name'=>$shipping==='پیک'?trim($courierName):'','courier_phone'=>$shipping==='پیک'?trim($courierPhone):''];
        $clean['fingerprint']=hash('sha256',json_encode($clean,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
        return $clean;
    }
    /** Select first ready serials per model, requiring a real unshipped remainder afterward. */
    public function plan(array $order,array $ready,array $shipped,array $request): array {
        if(($order['approval_status']??'')!=='تأیید شده'||!in_array($order['status']??'',$this->config['ready_statuses'],true)||!empty($order['deleted']))throw new InvalidArgumentException('سفارش باید تأیید شده و در مرحله آماده‌سازی یا ارسال بخشی باشد');
        $previous=[];$allSerials=[];$shippedByProduct=[];
        foreach($shipped as $item)foreach($item['serials']??[] as $serial){$key=strtoupper(trim($serial));if(isset($previous[$key]))throw new InvalidArgumentException('سریال خروج تکراری است');$previous[$key]=true;$shippedByProduct[$item['product']]=($shippedByProduct[$item['product']]??0)+1;}
        $ordered=[];$remaining=0;
        foreach($order['items']??[] as $item){
            $product=(string)($item['product']??'');$qty=(int)($item['qty']??0);
            if($product===''||$qty<1||isset($ordered[$product]))throw new InvalidArgumentException('ردیف فیزیکی سفارش معتبر نیست');
            $ordered[$product]=$qty;$left=$qty-($shippedByProduct[$product]??0);
            if($left<0)throw new InvalidArgumentException('مقدار خروج قبلی معتبر نیست');
            $remaining+=$left;
        }
        foreach($shippedByProduct as $product=>$count)if(!isset($ordered[$product]))throw new InvalidArgumentException('مدل خروج قبلی در سفارش نیست');
        $available=[];
        foreach($ready as $item){
            $product=(string)($item['product']??'');
            if(!isset($ordered[$product]))throw new InvalidArgumentException('مدل آماده‌شده در سفارش نیست');
            foreach($item['serials']??[] as $serial){
                $key=strtoupper(trim($serial));if($key===''||isset($allSerials[$key]))throw new InvalidArgumentException('سریال آماده تکراری است');$allSerials[$key]=true;
                if(!isset($previous[$key]))$available[$product][$key]=$serial;
            }
        }
        $batch=[];$total=0;
        foreach($request['items'] as $product=>$selection){
            $qty=$selection['qty'];
            if(!isset($ordered[$product])||$qty>$ordered[$product]-($shippedByProduct[$product]??0)||$qty>count($available[$product]??[]))throw new InvalidArgumentException('تعداد انتخاب‌شده بیش از بار آماده و ارسال‌نشده است');
            $serials=[];foreach($selection['serials'] as $key){if(!isset($available[$product][$key]))throw new InvalidArgumentException('سریال انتخاب‌شده دیگر آماده و ارسال‌نشده نیست؛ سفارش را تازه‌سازی کنید');$serials[]=$available[$product][$key];}$batch[]=['product'=>$product,'qty'=>$qty,'serials'=>$serials];$total+=$qty;
        }
        if($total<1||$total>=$remaining)throw new InvalidArgumentException('این مجوز فقط برای بخشی از بار است؛ تحویل کل مانده از مسیر تسویه انجام می‌شود');
        return ['items'=>$batch,'qty'=>$total,'remaining_qty'=>$remaining-$total];
    }
}

/** Use the existing transaction and warehouse ledger; do not invent payment or serial movements. */
final class PartialDispatchRepository
{
    /** Atomically record the explicit management decision and precisely one warehouse batch. */
    public function dispatch(array $request,string $username,PartialDispatchPolicy $policy): array {
        return db(true,static function(array &$state)use($request,$username,$policy): array {
            $index=idx($state['orders'],$request['id']);if($index<0)fail('سفارش پیدا نشد',404);
            $order=&$state['orders'][$index];
            foreach($order['shipment_batches']??[] as $previous)if(($previous['request_id']??'')===$request['request_id']){
                if(!hash_equals((string)($previous['request_fingerprint']??''),$request['fingerprint']))fail('شناسه ثبت برای درخواست دیگری استفاده شده است',409);
                return $order;
            }
            $shipped=gp_actual_shipped_items($order);
            $plan=$policy->plan($order,gp_exit_items($state,$order),$shipped,$request);
            $wanted=[];
            foreach($plan['items'] as $item)foreach($item['serials'] as $serial)$wanted[strtoupper(trim($serial))]=$item['product'];
            $matched=[];
            foreach($state['inventory']??[] as $serial){
                $key=strtoupper(trim((string)($serial['serial']??'')));if(!isset($wanted[$key]))continue;
                if(isset($matched[$key])||(int)($serial['order_id']??0)!==$request['id']||(int)($serial['warehouse_id']??0)<1||!same_product_name((string)($serial['product']??''),$wanted[$key]))fail('مالکیت یا محل انبار سریال انتخاب‌شده معتبر نیست',409);
                $matched[$key]=true;
            }
            if(count($matched)!==$plan['qty'])fail('همه سریال‌های انتخاب‌شده در انبار سفارش موجود نیستند',409);
            $moved=ghadir_warehouse_exit_items($state,$order,$plan['items'],$username,'تحویل بخشی با مجوز مدیریت');
            if($moved!==$plan['qty'])throw new RuntimeException('partial_dispatch_warehouse_count_mismatch');
            $at=now();
            $batch=['at'=>$at,'by'=>$username,'items'=>$plan['items'],'qty'=>$plan['qty'],'shipping_type'=>$request['shipping_type'],'tracking_code'=>$request['tracking_code'],'courier_name'=>$request['courier_name'],'courier_phone'=>$request['courier_phone'],'request_id'=>$request['request_id'],'request_fingerprint'=>$request['fingerprint'],'management_partial_release'=>true,'release_reason'=>$request['reason'],'payment_status_at_release'=>$order['payment_status']??''];
            $order['shipment_batches'][]=$batch;
            $order['exit_items']=gp_merge_exit_items($shipped,$plan['items']);$order['exit_device_qty']=gp_exit_device_qty($order['exit_items']);
            $order['partial_exit']=true;$order['status']='ارسال شد';$order['incomplete_status']='تأیید شده';$order['incomplete_approved_by']=$username;$order['incomplete_approved_at']=$at;$order['partial_exit_at']=$at;$order['partial_exit_by']=$username;
            $order['shipping_type']=$request['shipping_type'];$order['tracking_code']=$request['tracking_code'];
            $order['courier_name']=$request['courier_name'];$order['courier_phone']=$request['courier_phone'];$order['updated_at']=$at;
            hist($order,$username,'تحویل بخشی با مجوز مدیریت: '.$plan['qty'].' دستگاه؛ مانده '.$plan['remaining_qty'].' دستگاه. علت: '.$request['reason']);
            return $order;
        });
    }
}

/** The only entry to the management partial-delivery operation. */
final class PartialDispatchService
{
    private PartialDispatchRepository $repository;
    private PartialDispatchPolicy $policy;
    /** Inject I/O and pure rules independently. */
    public function __construct(PartialDispatchRepository $repository,PartialDispatchPolicy $policy) { $this->repository=$repository;$this->policy=$policy; }
    /** Preserve the idempotency identity while validating the complete release request. */
    public function dispatch(array $request,string $username): array { return $this->repository->dispatch($this->policy->request($request),$username,$this->policy); }
}
