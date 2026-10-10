#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
app = root / "app.html"
index = root / "index.php"

if not app.exists() or not index.exists():
    raise SystemExit("app.html or index.php not found")

# --- UI report: render each physical shipment batch on its own actual date.
a = app.read_text(encoding="utf-8")
ui_marker = "PARTIAL_SHIPMENT_BATCH_REPORT_20261010"
if ui_marker not in a:
    start = a.find("function exitMeta(o){")
    end = a.find("function closeJPickers(){", start)
    if start < 0 or end < 0:
        raise SystemExit("exit report UI block not found")
    new_ui = r'''/* PARTIAL_SHIPMENT_BATCH_REPORT_20261010 */
function exitMeta(o){let h=(o.history||[]).filter(x=>String(x.action||'').includes('«ارسال شد»')).slice(-1)[0];if(h)return{at:h.at,by:h.by};if(['ارسال شد','تحویل شد'].includes(o.status))return{at:o.updated_at,by:''};return{at:'',by:''}}
function exitItemQty(it){let ss=Array.isArray(it?.serials)?it.serials.filter(Boolean):[];return ss.length||Math.max(0,Number(it?.qty||0))}
function exitEvents(o){
  let batches=Array.isArray(o.shipment_batches)?o.shipment_batches.filter(b=>b&&b.at&&Array.isArray(b.items)&&b.items.length):[];
  if(batches.length){
    let seen=new Set(),events=[];
    batches.slice().sort((a,b)=>String(a.at||'').localeCompare(String(b.at||''))).forEach(b=>{
      let items=[];
      (b.items||[]).forEach(it=>{
        let raw=Array.isArray(it.serials)?it.serials.filter(Boolean):[],serials=[];
        raw.forEach(sn=>{let k=String(sn).trim().toUpperCase();if(k&&!seen.has(k)){seen.add(k);serials.push(sn)}});
        let qty=serials.length||(raw.length?0:Math.max(0,Number(it.qty||0)));
        if(qty>0)items.push({...it,serials,qty});
      });
      if(items.length)events.push({o,m:{at:b.at,by:b.by||''},items,shipping_type:b.shipping_type||o.shipping_type||'',tracking_code:b.tracking_code||''});
    });
    if(events.length)return events;
  }
  let m=exitMeta(o);if(!m.at)return[];
  let items=Array.isArray(o.exit_items)&&o.exit_items.length?o.exit_items:(o.items||[]);
  return [{o,m,items:items.map(it=>({...it,qty:exitItemQty(it)})).filter(it=>Number(it.qty)>0),shipping_type:o.shipping_type||'',tracking_code:o.tracking_code||''}];
}
let EXIT_SORT={key:'date',dir:'desc'};
function setExitSort(key){if(EXIT_SORT.key===key)EXIT_SORT.dir=EXIT_SORT.dir==='asc'?'desc':'asc';else{EXIT_SORT.key=key;EXIT_SORT.dir=key==='date'||key==='qty'?'desc':'asc'};renderExitReport()}
function exitSortIcon(key){return EXIT_SORT.key!==key?'↕':(EXIT_SORT.dir==='asc'?'▲':'▼')}
function updateExitSortIcons(){['date','order','customer','product','qty','shipping','by'].forEach(k=>{let e=$('sort_'+k);if(e)e.textContent=exitSortIcon(k)})}
function exitRows(){let f=normJ($('repFrom').value),t=normJ($('repTo').value),ship=$('repShip').value,all=[];ORD.forEach(o=>all.push(...exitEvents(o)));return all.map(x=>({...x,j:jalaliDate(x.m.at)})).filter(x=>(!f||x.j>=f)&&(!t||x.j<=t)&&(!ship||x.shipping_type===ship))}
function renderExitReport(){let base=exitRows(),rows=[];base.forEach(x=>(x.items||[]).forEach(it=>{let qty=exitItemQty(it);if(qty>0)rows.push({...x,it:{...it,qty},c:customerById(x.o.customer_id)})}));let val=(x,k)=>k==='date'?x.m.at:k==='order'?x.o.number:k==='customer'?[x.o.customer_name,x.c.company,x.c.code,x.c.mobile].join(' '):k==='product'?x.it.product:k==='qty'?+x.it.qty:k==='shipping'?(x.shipping_type||''):k==='by'?(x.m.by||''):'';rows.sort((a,b)=>{let av=val(a,EXIT_SORT.key),bv=val(b,EXIT_SORT.key),cmp=EXIT_SORT.key==='qty'?(av-bv):String(av).localeCompare(String(bv),'fa',{numeric:true,sensitivity:'base'});return EXIT_SORT.dir==='asc'?cmp:-cmp});updateExitSortIcons();$('repCount').textContent=`${rows.length} ردیف خروج`; $('repBody').innerHTML=rows.map(x=>`<tr><td>${esc(x.j)}</td><td><b>${esc(x.o.number)}</b></td><td>${esc(x.o.customer_name)}<div class="small">${esc(x.c.code||'')}</div></td><td><div class="item-summary-name">${esc(x.it.product)}</div></td><td><div class="item-summary-qty">${x.it.qty}</div></td><td>${esc(x.shipping_type||'-')}</td><td>${esc(x.m.by||'-')}</td></tr>`).join('')||'<tr><td colspan="7">موردی در این بازه نیست.</td></tr>'}
'''
    a = a[:start] + new_ui + a[end:]
    app.write_text(a, encoding="utf-8")

# --- Excel report: intercept export route and build rows from shipment_batches.
s = index.read_text(encoding="utf-8")
php_marker = "PARTIAL_SHIPMENT_BATCH_EXPORT_20261010"
if php_marker not in s:
    anchor = "if(strpos($p,'/export/')===0)"
    pos = s.find(anchor)
    if pos < 0:
        raise SystemExit("export route anchor not found")
    php = r'''
/* PARTIAL_SHIPMENT_BATCH_EXPORT_20261010 */
function gp_exit_report_unique_items_v40(array $items,array &$seen): array {
    $out=[];
    foreach($items as $it){
        $serials=[];$raw=is_array($it['serials']??null)?$it['serials']:[];
        foreach($raw as $sn){
            $sn=trim((string)$sn);$key=strtoupper($sn);
            if($key===''||isset($seen[$key]))continue;
            $seen[$key]=true;$serials[]=$sn;
        }
        $qty=count($serials);
        if($qty<1 && !$raw)$qty=max(0,(int)($it['qty']??0));
        if($qty>0)$out[]=['product'=>(string)($it['product']??''),'qty'=>$qty,'serials'=>$serials];
    }
    return $out;
}
function gp_exit_report_events_v40(array $s,array $o): array {
    $batches=is_array($o['shipment_batches']??null)?$o['shipment_batches']:[];
    $batches=array_values(array_filter($batches,fn($b)=>is_array($b)&&!empty($b['at'])&&!empty($b['items'])&&is_array($b['items'])));
    if($batches){
        usort($batches,fn($a,$b)=>strcmp((string)($a['at']??''),(string)($b['at']??'')));
        $seen=[];$events=[];
        foreach($batches as $b){
            $items=gp_exit_report_unique_items_v40($b['items'],$seen);
            if(!$items)continue;
            $events[]=[
                'at'=>(string)$b['at'],
                'by'=>(string)($b['by']??''),
                'shipping_type'=>(string)($b['shipping_type']??($o['shipping_type']??'')),
                'items'=>$items,
            ];
        }
        if($events)return $events;
    }
    $at='';$by='';
    foreach($o['history']??[] as $h)if(strpos((string)($h['action']??''),'«ارسال شد»')!==false){$at=(string)($h['at']??'');$by=(string)($h['by']??'');}
    if($at===''&&in_array($o['status']??'',['ارسال شد','تحویل شد'],true))$at=(string)($o['updated_at']??'');
    if($at==='')return [];
    $items=function_exists('gp_actual_shipped_items')?gp_actual_shipped_items($o):[];
    if(!$items&&function_exists('gp_exit_items'))$items=gp_exit_items($s,$o);
    if(!$items)return [];
    $seen=[];$items=gp_exit_report_unique_items_v40($items,$seen);
    return $items?[['at'=>$at,'by'=>$by,'shipping_type'=>(string)($o['shipping_type']??''),'items'=>$items]]:[];
}
if($p==='/export/exit.xlsx'){
    $guard=auth();
    $s=db(false,function($x)use($guard){
        if(in_array('customer',$guard['roles']??[],true))$x['orders']=array_values(array_filter($x['orders']??[],fn($o)=>(int)($o['customer_id']??0)===(int)($guard['customer_id']??0)));
        return $x;
    });
    $from=trim((string)($_GET['from']??''));$to=trim((string)($_GET['to']??''));$ship=trim((string)($_GET['ship']??''));
    $sort=trim((string)($_GET['sort']??'date'));$dir=strtolower(trim((string)($_GET['dir']??'desc')))==='asc'?'asc':'desc';
    $allowed=['date','order','customer','product','qty','shipping','by'];if(!in_array($sort,$allowed,true))$sort='date';
    $data=[];
    foreach($s['orders']??[] as $o){
        $ci=idx($s['customers']??[],$o['customer_id']??0);$c=$ci<0?[]:$s['customers'][$ci];
        foreach(gp_exit_report_events_v40($s,$o) as $ev){
            $j=jalali_date_value($ev['at']??'');if($j==='')continue;
            if($from!==''&&$j<$from)continue;if($to!==''&&$j>$to)continue;
            if($ship!==''&&($ev['shipping_type']??'')!==$ship)continue;
            foreach($ev['items']??[] as $it){
                $qty=max(0,(int)($it['qty']??0));if($qty<1)continue;
                $data[]=[
                    'date'=>$ev['at']??'','jdate'=>$j,'order'=>$o['number']??'','customer'=>$o['customer_name']??'',
                    'customer_code'=>$c['code']??'','product'=>$it['product']??'','qty'=>$qty,
                    'shipping'=>$ev['shipping_type']??'','by'=>$ev['by']??''
                ];
            }
        }
    }
    usort($data,function($a,$b)use($sort,$dir){
        $av=$a[$sort]??'';$bv=$b[$sort]??'';
        $cmp=$sort==='qty'?((int)$av<=>(int)$bv):strnatcasecmp((string)$av,(string)$bv);
        return $dir==='asc'?$cmp:-$cmp;
    });
    $rows=[['تاریخ خروج','شماره سفارش','مشتری','کد مشتری','کالا / مدل','تعداد خروج','روش ارسال','ثبت‌کننده']];
    foreach($data as $r)$rows[]=[$r['jdate'],$r['order'],$r['customer'],$r['customer_code'],$r['product'],(int)$r['qty'],$r['shipping'],$r['by']];
    xlsx_out('ghadir-exit-report.xlsx',$rows);
}

'''
    s = s[:pos] + php + s[pos:]
    index.write_text(s, encoding="utf-8")

print("partial shipment batch reporting patch applied")
