<?php
// Shared by root automation and /partners. Requires existing auth(), db(), input(), out().
function gp_inbox_feed(array $s, array $u): array {
    $cid=(int)($u['customer_id']??0);
    if($cid<=0 || !in_array('customer',$u['roles']??[],true)) return [];
    $rows=[]; $today=date('Y-m-d');
    foreach($s['special_offers']??[] as $o){
        if(empty($o['active']) || (($o['start_date']??'')!=='' && $o['start_date']>$today) || (($o['end_date']??'')!=='' && $o['end_date']<$today))continue;
        if(($o['audience']??'all')!=='all' && !in_array($cid,array_map('intval',$o['customer_ids']??[]),true))continue;
        $body=(string)($o['description']??'');
        if(($o['discount_value']??0)>0)$body.="\nتخفیف: ".$o['discount_value'].(($o['discount_type']??'')==='percent'?'٪':' تومان');
        if(!empty($o['promo_code']))$body.="\nکد طرح: ".$o['promo_code'];
        if(!empty($o['end_date']))$body.="\nاعتبار تا: ".$o['end_date'];
        $revision=substr(hash('sha256',json_encode([$o['title']??'',$body,$o['discount_type']??'', $o['discount_value']??0])),0,12);
        $rows[]=['id'=>'offer:'.(int)$o['id'].':'.$revision,'kind'=>'offer','title'=>(string)($o['title']??'طرح فروش'),'body'=>$body,'offer_id'=>(int)$o['id'],'created_at'=>$o['updated_at']??$o['created_at']??$o['start_date']??''];
    }
    foreach($s['notifications']??[] as $n){
        if(($n['kind']??'')!=='portal_message')continue;
        if(($n['audience']??'')!=='all' && !in_array($cid,array_map('intval',$n['customer_ids']??[]),true))continue;
        $rows[]=['id'=>'message:'.(int)$n['id'],'kind'=>'message','title'=>(string)$n['title'],'body'=>(string)$n['body'],'created_at'=>$n['created_at']];
    }
    foreach($s['orders']??[] as $o){
        if((int)($o['customer_id']??0)!==$cid)continue;
        $rev=substr(hash('sha256',json_encode([$o['status']??'',$o['payment_status']??''])),0,12);
        $rows[]=['id'=>'order:'.(int)$o['id'].':'.$rev,'kind'=>'order','title'=>'سفارش '.($o['number']??''),'body'=>'وضعیت: '.($o['status']??'')."\nپرداخت: ".($o['payment_status']??''),'order_id'=>(int)$o['id'],'created_at'=>$o['updated_at']??$o['created_at']??''];
    }
    $read=$s['settings']['portal_inbox_read'][(string)$cid]??[];
    foreach($rows as &$row)$row['read']=isset($read[$row['id']]);unset($row);
    usort($rows,fn($a,$b)=>strcmp((string)$b['created_at'],(string)$a['created_at'])?:strcmp($b['id'],$a['id']));
    return array_slice($rows,0,200);
}
if($p==='/api/notifications' && $m==='GET'){
    $u=auth(['customer']);out(db(false,fn($s)=>['items'=>gp_inbox_feed($s,$u)]));
}
if($p==='/api/notifications/read' && $m==='POST'){
    $u=auth(['customer']);$x=input();$requested=$x['ids']??[];if(!is_array($requested)||count($requested)>200)fail('فهرست اعلان معتبر نیست');
    out(db(true,function(&$s)use($u,$requested){$rows=gp_inbox_feed($s,$u);$allowed=array_column($rows,'id');$cid=(string)(int)$u['customer_id'];
        $read=$s['settings']['portal_inbox_read'][$cid]??[];
        foreach($requested as $id)if(is_string($id)&&in_array($id,$allowed,true))$read[$id]=now();
        // Keep receipt state bounded and scoped to the authenticated customer.
        $s['settings']['portal_inbox_read'][$cid]=array_intersect_key($read,array_flip($allowed));return ['ok'=>true];}));
}
if($p==='/api/portal-messages' && $m==='GET'){
    auth(['admin']);out(db(false,fn($s)=>array_values(array_reverse(array_filter($s['notifications']??[],fn($n)=>($n['kind']??'')==='portal_message')))));
}
if($p==='/api/portal-messages' && $m==='POST'){
    $u=auth(['admin']);$x=input();$title=trim((string)($x['title']??''));$body=trim((string)($x['body']??''));$audience=$x['audience']??'selected';
    if($title===''||$body===''||strlen($title)>300||strlen($body)>12000)fail('عنوان و متن پیام معتبر وارد کنید');
    if(!in_array($audience,['all','selected'],true))fail('مخاطب معتبر نیست');
    $ids=$x['customer_ids']??[];if(!is_array($ids)||count($ids)>1000)fail('مخاطب معتبر نیست');$ids=array_values(array_unique(array_filter(array_map('intval',$ids),fn($id)=>$id>0)));
    if($audience==='selected'&&!$ids)fail('حداقل یک مشتری انتخاب کنید');
    out(db(true,function(&$s)use($u,$title,$body,$audience,$ids){
        $valid=array_map('intval',array_column(array_filter($s['customers']??[],fn($c)=>empty($c['deleted'])),'id'));
        if($audience==='selected'&&array_diff($ids,$valid))fail('یکی از مشتریان معتبر نیست');
        $id=max((int)($s['next_notification']??1),1+max(array_merge([0],array_map('intval',array_column($s['notifications']??[],'id')))));
        $row=['id'=>$id,'kind'=>'portal_message','title'=>$title,'body'=>$body,'audience'=>$audience,'customer_ids'=>$ids,'created_at'=>now(),'created_by'=>$u['username']??''];
        $s['notifications'][]=$row;$s['next_notification']=$id+1;return ['ok'=>true,'id'=>$id];}));
}
