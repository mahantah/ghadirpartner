<?php
declare(strict_types=1);
/** Read only the selected order's physical delivery data, without exporting financial evidence or state. */
final class PartialDeliveryViewRepository
{
    /** Use the existing read-only transaction boundary for one manager-authorized order. */
    public function find(int $id): array {
        return db(false,static function(array $state)use($id): array {
            $index=idx($state['orders'],$id);if($index<0)fail('سفارش پیدا نشد',404);
            $order=$state['orders'][$index];$ready=[];
            foreach(gp_exit_items($state,$order) as $item)$ready[(string)$item['product']]=$item['serials'];
            $items=[];
            foreach($order['items']??[] as $item)$items[]=['product'=>(string)($item['product']??''),'qty'=>(int)($item['qty']??0),'serials'=>$ready[(string)($item['product']??'')]??[]];
            return ['id'=>(int)$order['id'],'number'=>(string)($order['number']??''),'customer_name'=>(string)($order['customer_name']??''),'approval_status'=>(string)($order['approval_status']??''),'status'=>(string)($order['status']??''),'payment_status'=>(string)($order['payment_status']??''),'deleted'=>!empty($order['deleted']),'items'=>$items,'exit_items'=>gp_actual_shipped_items($order)];
        });
    }
}
/** Web snapshot facade: current serial readiness is read before the manager chooses a subset. */
final class PartialDeliveryViewService
{
    private PartialDeliveryViewRepository $repository;
    /** Inject the existing state's read-only repository. */
    public function __construct(PartialDeliveryViewRepository $repository) { $this->repository=$repository; }
    /** Refuse invalid identifiers before reading production data. */
    public function find(int $id): array { if($id<1)throw new InvalidArgumentException('سفارش معتبر نیست');return $this->repository->find($id); }
}
