<?php
declare(strict_types=1);

require_once __DIR__.'/order-wallet.php';
/** Reject excess credit before the enclosing MySQL transaction commits. */
final class GpMonthlyCreditViolation extends RuntimeException {}
/** Read and validate the small server-owned credit policy. */
final class GpCreditConfigRepository {
    private string $path;
    /** Inject the public policy path, never account credentials. */
    public function __construct(string $path) {$this->path=$path;}
    /** Return validated limits and manager roles. */
    public function load(): array {
        $p=json_decode(file_get_contents($this->path),true,512,JSON_THROW_ON_ERROR);
        if(!is_int($p['maximum_limit']??null)||$p['maximum_limit']<1||($p['manager_roles']??null)!==['admin','finance']||($p['default_enabled']??null)!==false||($p['currency']??null)!=='تومان')throw new RuntimeException('invalid_credit_policy');
        return $p;
    }
}
/** Pure calculation of reservations, monthly purchases and outstanding invoices. */
final class GpCreditModel {
    /** Identify a still-valid credit purchase, including requests awaiting company approval. */
    public function amount(array $o): int {
        if(!empty($o['deleted'])||($o['status']??'')==='لغو شد'||in_array($o['approval_status']??'',['تأیید نشد','رد شده'],true))return 0;
        if (isset($o['credit_checkout'])) return $o['credit_checkout']['credit_reserved'];
        $method=(string)($o['payment_method']??'');
        if (($o['requested_payment_method']??'')==='mixed') {
            $credit=$o['native_settlement']['credit_amount']??0;
            return is_int($credit)?max(0,$credit):0;
        }
        if($method!=='credit'&&($o['payment_status']??'')!=='اعتباری'&&!($method===''&&($o['requested_payment_method']??'')==='credit'))return 0;
        $invoice = max(0, (int)(($o['approval_status'] ?? '') === 'تأیید شده'
            ? ($o['approved_total'] ?? $o['estimated_total'] ?? 0)
            : ($o['estimated_total'] ?? 0)));
        $explicit = $o['native_settlement']['credit_amount'] ?? null;
        if (($o['requested_payment_method'] ?? '') === 'credit' && is_int($explicit) && $explicit > 0) {
            return min($invoice, $explicit);
        }
        return $invoice;
    }
    /** Sum approved payments only, capped at the credit allocation for this invoice. */
    public function repaid(array $order): int {
        $remaining=$this->amount($order);
        $repaid=0;
        foreach($order['credit_repayments']??[] as $payment){
            $amount=$payment['amount']??null;
            if(($payment['status']??'')!=='approved'||!is_int($amount)||$amount<1)continue;
            $part=min($amount,$remaining);
            $repaid+=$part;$remaining-=$part;
        }
        return $repaid;
    }
    /** Preserve previously closed invoices and subtract reviewed repayments from open debt. */
    public function debt(array $o): int {
        return !isset($o['credit_checkout']) && ($o['payment_status']??'')==='تسویه کامل'?0:$this->amount($o)-$this->repaid($o);
    }
    /** Distinguish an open invoice from credit held for a pending request or revision. */
    public function isReserved(array $order): bool
    {
        return in_array($order['approval_status'] ?? '', ['در انتظار تأیید', 'نیازمند اصلاح'], true);
    }

    /** Compute revolving credit using open invoices and reservations from every month. */
    public function balance(array $s, int $id, string $month, callable $monthOf): array
    {
        $customer = [];
        foreach ($s['customers'] ?? [] as $entry) {
            if ((int) ($entry['id'] ?? 0) === $id) $customer = $entry;
        }
        $setting = $customer['monthly_credit'] ?? [];
        $limit = max(0, (int) ($setting['limit'] ?? 0));
        $outstanding = $used = $repaid = $reserved = 0;
        foreach ($s['orders'] ?? [] as $order) {
            if ((int) ($order['customer_id'] ?? 0) !== $id) continue;
            $debt = $this->debt($order);
            if ($this->isReserved($order)) {
                $reserved += $debt;
            } else {
                $outstanding += $debt;
            }
            $amount = $this->amount($order);
            if ($amount > 0 && $monthOf((string) ($order['created_at'] ?? '')) === $month) {
                $used += $amount;
                $repaid += $this->repaid($order);
            }
        }
        $enabled = ($setting['enabled'] ?? false) === true && $customer && empty($customer['deleted']);
        return [
            'enabled' => $enabled, 'limit' => $limit, 'monthly_used' => $used, 'monthly_repaid' => $repaid,
            'outstanding' => $outstanding, 'reserved' => $reserved,
            'available' => $enabled ? max(0, $limit - $outstanding - $reserved) : 0,
            'month' => $month, 'currency' => 'تومان',
        ];
    }

    /** Copy only scalar credit inputs so PHP references cannot mutate the before snapshot. */
    public function snapshot(array $orders): array {
        $result=[];
        foreach($orders as $o){$copy=[];foreach(['id','customer_id','deleted','status','approval_status','payment_method','requested_payment_method','payment_status','approved_total','estimated_total','created_at','native_settlement','credit_repayments','credit_checkout','order_receipt_reviews','customer_credit_cancel','irankish_order_payment'] as $key)if(array_key_exists($key,$o))$copy[$key]=$o[$key];$result[]=$copy;}
        return $result;
    }
    /** Validate only increasing credit exposure, preserving unrelated existing order operations. */
    public function assertChanges(array $before,array $after,string $month,callable $monthOf): void {
        $checkout = new GpCreditCheckout();
        $old=[];foreach($before['orders']??[] as $o)$old[(int)$o['id']]=$o;
        foreach($after['orders']??[] as $o){
            $prior=$old[(int)$o['id']]??[];
            try {
                $checkout->assertTransition($prior, $o);
            } catch (DomainException $error) {
                throw new GpMonthlyCreditViolation($error->getMessage(), $error->getCode(), $error);
            }
            unset($old[(int) $o['id']]);
            $credit = $o['native_settlement']['credit_amount'] ?? null;
            // Validate a new allocation against the server-priced invoice, never the submitted total.
            if (!$prior && in_array($o['requested_payment_method'] ?? '', ['credit', 'mixed'], true)
                && is_int($credit) && $credit > (int)($o['estimated_total'] ?? 0)) {
                throw new GpMonthlyCreditViolation('مبلغ اعتباری از مبلغ فاکتور بیشتر است');
            }
            $sameCustomer=(int)($prior['customer_id']??0)===(int)($o['customer_id']??0);
            $increase=!$sameCustomer||$this->amount($o)>$this->amount($prior)||$this->debt($o)>$this->debt($prior);
            if(!$increase||$this->amount($o)===0)continue;
            $b=$this->balance($after,(int)$o['customer_id'],$month,$monthOf);
            if(!$b['enabled'])throw new GpMonthlyCreditViolation('خرید اعتباری برای این مشتری غیرفعال است');
            if($b['outstanding']+$b['reserved']>$b['limit'])throw new GpMonthlyCreditViolation('مبلغ سفارش از اعتبار باقی‌مانده مشتری بیشتر است');
        }
        foreach ($old as $removed) {
            if (isset($removed['credit_checkout']) && empty($removed['deleted'])) {
                throw new GpMonthlyCreditViolation('حذف سوابق سفارش اعتباری مجاز نیست.', 409);
            }
        }
    }
}
/** Single facade for transaction validation and selected-customer credit settings. */
final class GpCustomerCredit {
    private GpCreditModel $model;private array $policy;
    /** Inject the pure model and validated configuration. */
    public function __construct(GpCreditModel $model,array $policy){$this->model=$model;$this->policy=$policy;}
    /** Build the shared facade from the repository's public policy. */
    public static function create(): self {return new self(new GpCreditModel(),(new GpCreditConfigRepository(dirname(__DIR__).'/config/customer-credit.yaml'))->load());}
    /** Resolve the existing Iranian calendar, keeping missing dates outside the current month. */
    public function month(string $date): string {return $date===''?'':substr(jalali_date_value($date),0,7);}
    /** Read only the authenticated selected customer's balances. */
    public function balance(array $s,int $id): array {require_once __DIR__.'/native-order-flow.php';$terms=(new GpOrderPolicyRepository(dirname(__DIR__).'/config/native-order-flow.yaml'))->load()['credit_commitment'];return $this->model->balance($s,$id,$this->month(now()),[$this,'month'])+['wallet'=>(new GpOrderWallet())->read($s,$id),'credit_commitment'=>$terms,'credit_commitment_sha256'=>hash('sha256',$terms)];}
    /** Run under the existing MySQL row lock; reject before stock and order state are committed. */
    public function transaction(bool $write,callable $fn) {
        if(!$write)return ghadir_db(false,$fn);
        return ghadir_db(true,function(array &$s)use($fn){$before=['orders'=>$this->model->snapshot($s['orders']??[])];$result=$fn($s);$this->model->assertChanges($before,$s,$this->month(now()),[$this,'month']);return $result;});
    }
    /** Validate and save a deliberate manager setting without altering financial history. */
    public function configure(array &$s,int $id,array $request,string $actor): array {
        if(!is_bool($request['enabled']??null)||!is_int($request['limit']??null)||$request['limit']<0||$request['limit']>$this->policy['maximum_limit'])throw new GpMonthlyCreditViolation('وضعیت و سقف اعتبار معتبر وارد کنید');
        foreach($s['customers'] as &$c)if((int)$c['id']===$id&&empty($c['deleted'])){$c['monthly_credit']=['enabled'=>$request['enabled'],'limit'=>$request['limit'],'updated_by'=>$actor,'updated_at'=>now()];return $this->balance($s,$id);}
        throw new GpMonthlyCreditViolation('مشتری پیدا نشد');
    }
}
