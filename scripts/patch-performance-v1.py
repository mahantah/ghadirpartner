#!/usr/bin/env python3
from pathlib import Path
import re, sys

root=Path(sys.argv[1] if len(sys.argv)>1 else ".")
MARK="PERFORMANCE_BOOTSTRAP_V1_20261014"

def read(rel):
    p=root/rel
    if not p.exists():
        raise SystemExit(f"{rel} not found")
    return p,p.read_text(encoding="utf-8")

def write(p,s):
    p.write_text(s,encoding="utf-8")

# ---------- main backend ----------
p,s=read("index.php")
if MARK not in s:
    eager="$PRODUCTS=db(false,fn($s)=>$s['products']);"
    if eager in s:
        s=s.replace(eager,"$PRODUCTS=[]; /* "+MARK+" — products are populated lazily by ghadir_db() */",1)

    anchor="if($p==='/api/me'){$u=auth();out(['id'=>$u['id'],'username'=>$u['username'],'roles'=>$u['roles']]);}"
    bootstrap=r"""
/* PERFORMANCE_BOOTSTRAP_V1_20261014 */
if($p==='/api/bootstrap'&&$m==='GET'){
    $u=auth();
    out(db(false,function($s)use($u){
        $customers=in_array('customer',$u['roles']??[],true)
            ? array_values(array_filter($s['customers']??[],fn($c)=>(int)($c['id']??0)===(int)($u['customer_id']??0)))
            : array_values(array_filter($s['customers']??[],fn($c)=>empty($c['deleted'])));
        $orders=in_array('customer',$u['roles']??[],true)
            ? array_values(array_filter($s['orders']??[],fn($o)=>(int)($o['customer_id']??0)===(int)($u['customer_id']??0)))
            : array_values($s['orders']??[]);
        return [
            'me'=>['id'=>$u['id'],'username'=>$u['username'],'roles'=>$u['roles']],
            'customers'=>$customers,
            'orders'=>$orders,
            'products'=>array_values($s['products']??[]),
            'inventory'=>array_values($s['inventory']??[]),
        ];
    }));
}
if($p==='/api/mobile-bootstrap'&&$m==='GET'){
    $u=auth();
    out(db(false,function($s)use($u){
        $customers=in_array('customer',$u['roles']??[],true)
            ? array_values(array_filter($s['customers']??[],fn($c)=>(int)($c['id']??0)===(int)($u['customer_id']??0)))
            : array_values(array_filter($s['customers']??[],fn($c)=>empty($c['deleted'])));
        $orders=in_array('customer',$u['roles']??[],true)
            ? array_values(array_filter($s['orders']??[],fn($o)=>(int)($o['customer_id']??0)===(int)($u['customer_id']??0)))
            : array_values($s['orders']??[]);
        return [
            'me'=>['id'=>$u['id'],'username'=>$u['username'],'roles'=>$u['roles']],
            'customers'=>$customers,
            'orders'=>$orders,
            'products'=>array_values($s['products']??[]),
        ];
    }));
}
"""
    if "if($p==='/api/bootstrap'&&$m==='GET')" not in s:
        if anchor not in s:
            raise SystemExit("main /api/me anchor not found")
        s=s.replace(anchor,anchor+bootstrap,1)
    elif "if($p==='/api/mobile-bootstrap'&&$m==='GET')" not in s:
        # Existing main bootstrap is already optimized; only add the scanner bundle.
        mb=bootstrap[bootstrap.find("if($p==='/api/mobile-bootstrap'"):]
        s=s.replace(anchor,anchor+"\n/* "+MARK+" */\n"+mb,1)
    if MARK not in s:
        s=s.replace("$PRODUCTS=default_products();", "$PRODUCTS=default_products(); /* "+MARK+" */", 1)
    write(p,s)
else:
    print("main backend performance patch already applied")

# ---------- main web UI ----------
p,s=read("app.html")
if MARK not in s:
    old_refresh="async function refresh(){[CUST,ORD,PROD,INV]=await Promise.all([req('/api/customers'),req('/api/orders'),req('/api/products'),req('/api/inventory')]);renderProductDatalist();renderCustOptions();renderCustomers();renderOrders();renderDash();if($('checkBody'))renderChecks()}"
    new_refresh="async function refresh(){let b=await req('/api/bootstrap');CUST=b.customers||[];ORD=b.orders||[];PROD=b.products||[];INV=b.inventory||[];renderProductDatalist();renderCustOptions();renderCustomers();renderOrders();renderDash();if($('checkBody'))renderChecks()}"
    if old_refresh in s:
        s=s.replace(old_refresh,new_refresh,1)

    if "await refresh();addItem();setInterval(pollNotif,4000)" in s:
        s=s.replace("await refresh();addItem();setInterval(pollNotif,4000)","await refresh();addItem()",1)

    # The endpoint currently always returns [] and each poll forced a full state decode.
    s=s.replace("setInterval(()=>{if(!$('warehouseDaily')?.classList.contains('hidden'))loadWarehouseLedger()},15000);",
                "setInterval(()=>{if(!document.hidden&&!$('warehouseDaily')?.classList.contains('hidden'))loadWarehouseLedger()},30000);",1)

    # Whole-body mutation observers became expensive once the serial list grew.
    s=s.replace("new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});",
                "/* "+MARK+" — whole-body mobile observer removed; resize/orientation + initial sync are sufficient */",1)

    supplier_observe="const obs=new MutationObserver(gpScheduleSupplierDisplay);\n  obs.observe(document.body,{childList:true,subtree:true});\n  document.addEventListener('click',gpScheduleSupplierDisplay,true);"
    supplier_repl="const obs=new MutationObserver(gpScheduleSupplierDisplay);\n  [document.getElementById('warehouseBody'),document.getElementById('inventoryGroups')].filter(Boolean).forEach(root=>obs.observe(root,{childList:true,subtree:true}));\n  /* "+MARK+" — global click observer removed */"
    if supplier_observe in s:
        s=s.replace(supplier_observe,supplier_repl,1)

    pos=s.lower().rfind("</body>")
    if pos<0: raise SystemExit("main </body> not found")
    s=s[:pos]+f"\n<!-- {MARK} -->\n"+s[pos:]
    write(p,s)
else:
    print("main UI performance patch already applied")

# ---------- partners backend ----------
p,s=read("partners/index.php")
if MARK not in s:
    eager="$PRODUCTS=db(false,fn($s)=>$s['products']);"
    if eager in s:
        s=s.replace(eager,"$PRODUCTS=[]; /* "+MARK+" — products are populated lazily by ghadir_db() */",1)

    me_anchor="if($p==='/api/me'){$u=auth();$customer=null;if(!empty($u['customer_id']))$customer=db(false,function($s)use($u){$i=idx($s['customers'],$u['customer_id']);return $i<0?null:$s['customers'][$i];});out(['id'=>$u['id'],'username'=>$u['username'],'roles'=>$u['roles'],'customer_id'=>(int)($u['customer_id']??0),'customer'=>$customer,'alternate_mobile'=>$u['alternate_mobile']??'']);}"
    bootstrap=r"""
/* PERFORMANCE_BOOTSTRAP_V1_20261014 */
if($p==='/api/bootstrap'&&$m==='GET'){
    $u=auth();
    out(db(false,function($s)use($u){
        $customer=null;
        if(!empty($u['customer_id'])){
            $ci=idx($s['customers']??[],$u['customer_id']);
            if($ci>=0)$customer=$s['customers'][$ci];
        }
        $isCustomer=in_array('customer',$u['roles']??[],true);
        $customers=$isCustomer
            ? ($customer?[$customer]:[])
            : array_values(array_filter($s['customers']??[],fn($x)=>empty($x['deleted'])));
        $orders=$isCustomer
            ? array_values(array_filter($s['orders']??[],fn($o)=>(int)($o['customer_id']??0)===(int)($u['customer_id']??0)))
            : array_values($s['orders']??[]);

        $free=[];
        foreach($s['inventory']??[] as $iv){
            if(!empty($iv['order_id']))continue;
            $name=(string)($iv['product']??'');
            if($name!=='')$free[$name]=($free[$name]??0)+1;
        }

        $catalog=[];
        foreach($s['products']??[] as $i=>$prod){
            $x=$prod;
            $x['price']=(int)($x['price']??($i<3?[12500000,11500000,10800000][$i]:0));
            $x['stock']=!empty($x['serial_required'])?(int)($free[$x['name']]??0):(int)($x['stock']??($i<3?[120,75,40][$i]:0));
            $x['stock_source']=!empty($x['serial_required'])?'warehouse':'manual';
            $x['available']=!empty($x['serial_required'])?true:(array_key_exists('available',$x)?(bool)$x['available']:$i<3);
            $x['description']=$x['description']??'تأمین عمده با ضمانت اصالت و پشتیبانی قدیر پرداخت';
            $defaults=['panel_cash'=>$x['price'],'panel_7d'=>0,'panel_1m'=>0,'serial_1_50'=>0,'serial_51_200'=>0,'sales_agent'=>0];
            $x['prices']=array_map('intval',array_merge($defaults,is_array($x['prices']??null)?$x['prices']:[]));
            $x['credit_available']=!empty($x['credit_available']);
            $catalog[]=$x;
        }

        $all=$s['special_offers']??[];
        if(in_array('admin',$u['roles']??[]))$offers=array_values(array_reverse($all));
        else{
            $today=date('Y-m-d');$cid=(int)($u['customer_id']??0);
            $offers=array_values(array_filter(array_reverse($all),fn($o)=>!empty($o['active'])&&(($o['start_date']??'')===''||$o['start_date']<=$today)&&(($o['end_date']??'')===''||$o['end_date']>=$today)&&(($o['audience']??'all')==='all'||in_array($cid,array_map('intval',$o['customer_ids']??[]),true))));
        }

        return [
            'me'=>[
                'id'=>$u['id'],'username'=>$u['username'],'roles'=>$u['roles'],
                'customer_id'=>(int)($u['customer_id']??0),'customer'=>$customer,
                'alternate_mobile'=>$u['alternate_mobile']??''
            ],
            'customers'=>$customers,'orders'=>$orders,'catalog'=>$catalog,'offers'=>$offers
        ];
    }));
}
"""
    if "if($p==='/api/bootstrap'&&$m==='GET')" not in s:
        if me_anchor not in s:
            raise SystemExit("partners /api/me anchor not found")
        s=s.replace(me_anchor,me_anchor+bootstrap,1)
    if MARK not in s:
        s=s.replace("$PRODUCTS=[];", "$PRODUCTS=[]; /* "+MARK+" */", 1)
    write(p,s)
else:
    print("partners backend performance patch already applied")

# ---------- partners portal ----------
p,s=read("partners/portal.html")
if MARK not in s:
    old_prefix="async function boot(){try{me=await api('/api/me')}catch(e){return}"
    new_prefix="async function boot(){try{let __b=await api('/api/bootstrap');me=__b.me;window.__gpPortalBootstrap=__b}catch(e){return}"
    if old_prefix not in s:
        raise SystemExit("partners boot prefix not found")
    s=s.replace(old_prefix,new_prefix,1)

    m=re.search(r"async function loadAll\(\)\{\[customers,orders,catalog,offers\]=await Promise\.all\(\[api\('/api/customers'\),api\('/api/orders'\),api\('/api/catalog'\),api\('/api/offers'\)\]\);(?P<body>.*?)\}",s,re.S)
    if not m:
        raise SystemExit("partners loadAll not found")
    body=m.group('body')
    new_load="async function loadAll(){let b=window.__gpPortalBootstrap||await api('/api/bootstrap');window.__gpPortalBootstrap=null;customers=b.customers||[];orders=b.orders||[];catalog=b.catalog||[];offers=b.offers||[];"+body+"}"
    s=s[:m.start()]+new_load+s[m.end():]


    pos=s.lower().rfind("</body>")
    if pos<0: raise SystemExit("partners </body> not found")
    s=s[:pos]+f"\n<!-- {MARK} -->\n"+s[pos:]
    write(p,s)
else:
    print("partners portal performance patch already applied")

# ---------- mobile scanner ----------
p,s=read("mobile.html")
if MARK not in s:
    old=r"""async function boot(){
 try{
   let me=await req('/api/me');if(!(me.roles||[]).includes('prep')){throw new Error('این بخش فقط برای واحد انبار فعال است')}
   $('loginCard').classList.add('hidden');$('scanApp').classList.remove('hidden');
   [ORD,CUST,PROD]=await Promise.all([req('/api/orders'),req('/api/customers'),req('/api/products')]);
   renderOrders();
 }catch(e){}
}"""
    new=r"""async function boot(){
 try{
   let b=await req('/api/mobile-bootstrap'),me=b.me||{};if(!(me.roles||[]).includes('prep')){throw new Error('این بخش فقط برای واحد انبار فعال است')}
   $('loginCard').classList.add('hidden');$('scanApp').classList.remove('hidden');
   ORD=b.orders||[];CUST=b.customers||[];PROD=b.products||[];
   renderOrders();
 }catch(e){}
}"""
    if old not in s:
        raise SystemExit("mobile boot not found")
    s=s.replace(old,new,1)
    pos=s.lower().rfind("</body>")
    if pos<0: raise SystemExit("mobile </body> not found")
    s=s[:pos]+f"\n<!-- {MARK} -->\n"+s[pos:]
    write(p,s)
else:
    print("mobile scanner performance patch already applied")

print("performance v1 patch applied")
