#!/usr/bin/env python3
from pathlib import Path
import sys

root=Path(sys.argv[1] if len(sys.argv)>1 else ".")
index=root/"index.php"
MARK="WAREHOUSE_RETAIL_DETACH_CARTON_V1_20261015"

if not index.exists():
    raise SystemExit("index.php not found")

s=index.read_text(encoding="utf-8")
if MARK in s:
    print("retail carton detach v1 already applied")
    raise SystemExit(0)

start=s.find("if($p==='/api/warehouse/transfer'&&$m==='POST')")
end=s.find("if($p==='/api/order/return'&&$m==='POST')",start)
if start<0 or end<0:
    raise SystemExit("warehouse transfer route not found")

route=r"""/* WAREHOUSE_RETAIL_DETACH_CARTON_V1_20261015 */
if($p==='/api/warehouse/transfer'&&$m==='POST'){
    $u=auth(['prep']);$x=input();
    out(db(true,function(&$s)use($x,$u){
        ghadir_warehouse_prepare_state($s);
        $from=(int)($x['from_warehouse_id']??0);
        $to=(int)($x['to_warehouse_id']??0);
        $code=strtoupper(trim((string)($x['code']??'')));
        $note=trim((string)($x['note']??''));
        if(!in_array($from,[1,2],true)||!in_array($to,[1,2],true)||$from===$to)fail('مبدأ و مقصد انتقال معتبر نیست');
        if($code==='')fail('شماره باکس یا سریال را وارد کنید');

        $indexes=[];$cartonId=0;$label=$code;
        foreach($s['cartons']??[] as $ct)if(strcasecmp((string)($ct['code']??''),$code)===0){
            $cartonId=(int)($ct['id']??0);
            $label='باکس '.$ct['code'];
            foreach($s['inventory'] as $k=>$iv)
                if((int)($iv['carton_id']??0)===$cartonId&&(int)($iv['warehouse_id']??0)===$from)$indexes[]=$k;
            break;
        }
        if(!$indexes){
            foreach($s['inventory'] as $k=>$iv)if(strcasecmp((string)($iv['serial']??''),$code)===0){
                if((int)($iv['warehouse_id']??0)!==$from)fail('این سریال در انبار مبدأ انتخاب‌شده نیست');
                $indexes[]=$k;$label='سریال '.$iv['serial'];break;
            }
        }
        if(!$indexes)fail('باکس یا سریال در انبار مبدأ پیدا نشد');

        $cartonSupplier=[];
        foreach($s['cartons']??[] as $ct){
            $cid=(int)($ct['id']??0);
            if($cid>0)$cartonSupplier[$cid]=trim((string)($ct['supplier']??''));
        }

        $groups=[];$serials=[];$detachedByCarton=[];
        foreach($indexes as $k){
            $iv=&$s['inventory'][$k];
            $p=(string)($iv['product']??'نامشخص');
            $sn=(string)($iv['serial']??'');
            $oldCartonId=(int)($iv['carton_id']??0);
            $oldCartonCode=trim((string)($iv['carton_code']??''));

            if($from===1&&$to===2&&$oldCartonId>0){
                if(trim((string)($iv['supplier']??''))===''&&!empty($cartonSupplier[$oldCartonId]))
                    $iv['supplier']=$cartonSupplier[$oldCartonId];

                $detachedByCarton[$oldCartonId][]=$sn;
                $iv['detached_from_carton_id']=$oldCartonId;
                $iv['detached_from_carton_code']=$oldCartonCode;
                $iv['detached_from_carton_at']=now();
                $iv['detached_from_carton_by']=$u['username'];
                $iv['carton_id']=0;
                $iv['carton_code']='';
                $iv['shelf_level']=0;
            }

            $iv['warehouse_id']=$to;
            $iv['warehouse_last_moved_at']=now();
            $groups[$p][]=$sn;
            $serials[]=$sn;
            unset($iv);
        }

        foreach($groups as $p=>$ss)
            ghadir_warehouse_record($s,'transfer',$p,$ss,$from,$to,$u['username'],0,'',$note!==''?$note:$label);

        $cartonRemaining=[];
        if($detachedByCarton){
            foreach($s['cartons'] as &$ct){
                $cid=(int)($ct['id']??0);
                if(empty($detachedByCarton[$cid]))continue;
                $remove=array_fill_keys(array_map(fn($v)=>strtoupper((string)$v),$detachedByCarton[$cid]),true);
                $ct['serials']=array_values(array_filter($ct['serials']??[],fn($sn)=>empty($remove[strtoupper((string)$sn)])));
                $ct['warehouse_id']=count($ct['serials'])>0?1:0;
                $ct['last_split_at']=now();
                $ct['last_split_by']=$u['username'];
                $ct['last_split_to_warehouse_id']=2;
                $ct['last_split_count']=count($detachedByCarton[$cid]);
                if(count($ct['serials'])===0)$ct['emptied_at']=now();
                $cartonRemaining[(string)($ct['code']??$cid)]=count($ct['serials']);
            }
            unset($ct);
        }elseif($cartonId){
            foreach($s['cartons'] as &$ct)if((int)($ct['id']??0)===$cartonId){
                $ids=[];
                foreach($s['inventory'] as $iv)
                    if((int)($iv['carton_id']??0)===$cartonId&&(int)($iv['warehouse_id']??0)>0)$ids[(int)$iv['warehouse_id']]=1;
                $ct['warehouse_id']=count($ids)===1?(int)array_key_first($ids):0;
                break;
            }
            unset($ct);
        }

        return [
            'ok'=>true,
            'moved'=>count($serials),
            'label'=>$label,
            'serials'=>$serials,
            'detached_from_carton'=>array_sum(array_map('count',$detachedByCarton)),
            'carton_remaining'=>$cartonRemaining
        ];
    }));
}
"""

s=s[:start]+route+s[end:]
index.write_text(s,encoding="utf-8")
print("retail carton detach v1 patch applied")
