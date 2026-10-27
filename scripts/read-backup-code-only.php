<?php
declare(strict_types=1);
/** Stream only application source from the explicitly supplied private host backup. */
final class BackupCodeReader
{
    /** Read exactly the requested bytes from a gzip stream or reject truncation. */
    private function read($stream, int $length): string {
        $data='';
        while(strlen($data)<$length){$chunk=gzread($stream,$length-strlen($data));if($chunk===false||$chunk==='')throw new RuntimeException('truncated_archive');$data.=$chunk;}
        return $data;
    }
    /**
     * Copy only bounded code files; never extract configuration, storage or SQL.
     * @return array{files:int,bytes:int}
     */
    public function copy(string $archive, string $target): array {
        $input=gzopen($archive,'rb');$output=gzopen($target,'wb6');
        if(!$input||!$output)throw new RuntimeException('archive_unavailable');
        $files=0;$bytes=0;$core=[];$longName='';
        try{
            while(!gzeof($input)){
                $header=$this->read($input,512);
                if(trim($header,"\0")==='')break;
                $name=rtrim(substr($header,0,100),"\0");$prefix=rtrim(substr($header,345,155),"\0");
                if($prefix!=='')$name=$prefix.'/'.$name;
                if($longName!==''){$name=$longName;$longName='';}
                $size=octdec(trim(substr($header,124,12),"\0 "));
                $type=$header[156];
                if($type==='L'){
                    if($size>4096)throw new RuntimeException('invalid_long_name');
                    $longName=rtrim($this->read($input,(int)(ceil($size/512)*512)),"\0");
                    continue;
                }
                $position=strpos($name,'homedir/public_html/');
                $relative=$position===false?'':substr($name,$position+strlen('homedir/public_html/'));
                $allowed=preg_match('~^(?:app\.html|index\.php|mobile\.html|VERSION\.txt|(?:assets|lib|partners|scripts)/[A-Za-z0-9_./-]+\.(?:php|js|css|html))$~D',$relative)===1;
                $allowed=$allowed&&!preg_match('~(?:^|/)(?:storage|uploads|Backups|config[^/]*|credentials[^/]*)(?:/|$)~i',$relative)&&strpos($relative,'..')===false&&($type==='0'||$type==="\0")&&$size<=8388608;
                if($allowed){
                    if(strlen($relative)>100)throw new RuntimeException('code_path_too_long');
                    $bytes+=(int)$size;if($bytes>67108864)throw new RuntimeException('code_limit_exceeded');
                    // Rewrite the member name so the output contains only relative code paths.
                    $header=substr_replace($header,str_pad($relative,100,"\0"),0,100);
                    $header=substr_replace($header,str_repeat("\0",155),345,155);
                    $header=substr_replace($header,'        ',148,8);$sum=0;
                    for($i=0;$i<512;$i++)$sum+=ord($header[$i]);
                    $header=substr_replace($header,sprintf('%06o',$sum)."\0 ",148,8);
                    gzwrite($output,$header);$files++;$core[$relative]=true;
                }
                $remaining=(int)(ceil($size/512)*512);
                while($remaining>0){$length=min(65536,$remaining);$chunk=$this->read($input,$length);if($allowed)gzwrite($output,$chunk);$remaining-=$length;}
            }
            if(empty($core['app.html'])||empty($core['index.php']))throw new RuntimeException('application_code_not_found');
            gzwrite($output,str_repeat("\0",1024));
            return ['files'=>$files,'bytes'=>$bytes];
        }finally{gzclose($input);gzclose($output);}
    }
}
if(defined('BACKUP_CODE_TEST'))return;
ini_set('display_errors','0');set_time_limit(300);
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||!hash_equals('__TOKEN__',(string)($_SERVER['HTTP_X_GP_RECONCILE_TOKEN']??''))){http_response_code(403);exit;}
$temp=tempnam(dirname(__DIR__),'gp-code-only-');
try{
    (new BackupCodeReader())->copy('__ARCHIVE__',$temp);
    header('Content-Type:application/gzip');header('Cache-Control:no-store');header('Content-Length:'.filesize($temp));readfile($temp);
}catch(Throwable $error){http_response_code(409);header('Content-Type:application/json');$safe=['truncated_archive','archive_unavailable','invalid_long_name','code_path_too_long','code_limit_exceeded','application_code_not_found'];$reason=in_array($error->getMessage(),$safe,true)?$error->getMessage():'code_extraction_failed';echo json_encode(['ok'=>false,'error'=>$reason,'archive_exists'=>is_file('__ARCHIVE__'),'archive_readable'=>is_readable('__ARCHIVE__')]);}
finally{if(is_string($temp)&&is_file($temp))unlink($temp);}
