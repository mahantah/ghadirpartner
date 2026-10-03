from pathlib import Path
import sys

p = Path(sys.argv[1])
s = p.read_text()
def replace(old, new):
    global s
    if s.count(old) != 1:
        raise SystemExit('Unsupported live source; refusing ambiguous patch')
    s = s.replace(old, new, 1)

replace("$m=$_SERVER['REQUEST_METHOD'];", "$m=$_SERVER['REQUEST_METHOD'];\nrequire __DIR__.'/native-r51-core.php';\nrequire __DIR__.'/native-r51-inbox.php';")
replace("$u=auth(['sales','customer']);$x=input();$isCustomer=in_array('customer',$u['roles']??[]);", "$u=auth(['sales','customer']);$x=input();$isCustomer=in_array('customer',$u['roles']??[]);\n    if($isCustomer&&!gp_order_window())fail(gp_order_window_message(),409);")
replace("$id=$s['next_order']++;$c=$s['customers'][$ci];$o=$x;", "$id=$s['next_order']++;$c=$s['customers'][$ci];$o=$x;\n        if($isCustomer){$o['delivery_address']=gp_address_snapshot($c,(string)($x['address_id']??''));$o['shipping_address']=implode(' - ',array_filter([$o['delivery_address']['province']??'',$o['delivery_address']['city']??'',$o['delivery_address']['address']??'']));$o['notes']=trim((string)($x['notes']??'')).' | آدرس تحویل: '.$o['shipping_address'];}")
replace("return array_values(array_filter($orders,fn($o)=>(int)($o['customer_id']??0)===(int)($u['customer_id']??0)));", "return array_map('gp_customer_visible_order',array_values(array_filter($orders,fn($o)=>(int)($o['customer_id']??0)===(int)($u['customer_id']??0))));")
replace("[$o,$c,$set,$sender]=$d;header", "[$o,$c,$set,$sender]=$d;if(isset($o['delivery_address']))$c=array_merge($c,$o['delivery_address']);header")
p.write_text(s)
print('Applied R5.1 additions; existing pricing, offers, OTP and cancellation routes preserved')
