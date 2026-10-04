from pathlib import Path
import sys
p=Path(sys.argv[1]);s=p.read_text()
def replace(old,new):
    global s
    if s.count(old)!=1:raise SystemExit('Source mismatch: expected unique hook')
    s=s.replace(old,new)
replace("require __DIR__.'/native-r51-inbox.php';","require __DIR__.'/native-r51-inbox.php';\nrequire __DIR__.'/native-r54.php';")
replace("$paymentLabels=['cash'=>'نقد','check'=>'اعتباری با چک','online'=>'آنلاین'];","$paymentLabels=['cash'=>'نقد','check'=>'اعتباری با چک','credit'=>'درخواست اعتبار','online'=>'آنلاین'];")
replace("        hist($o,$u['username'],$history);$s['orders'][]=$o;", """        unset($o['native_settlement']);
        if($isCustomer){
            $o['native_settlement']=gp_r54_settlement($x,$u,$o);
            $d=$o['native_settlement'];
            if($d){
                $summary=' | اطلاعات تسویه (نیازمند بررسی مالی): ';
                foreach(['tracking_number'=>'پیگیری','check_number'=>'صیادی','bank_name'=>'بانک','due_date'=>'سررسید'] as $key=>$label)if(!empty($d[$key]))$summary.=$label.': '.$d[$key].' ؛ ';
                if(!empty($d['proof_token']))$summary.='تصویر رسید: https://ghadirpartner.ir/partners/api/native/proof?token='.$d['proof_token'];
                $o['notes']=($o['notes']??'').$summary;
            }
        }
        unset($o['settlement_details']);
        hist($o,$u['username'],$history);$s['orders'][]=$o;""")
p.write_text(s)
