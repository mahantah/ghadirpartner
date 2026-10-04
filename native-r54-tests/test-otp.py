from pathlib import Path
import json, subprocess, tempfile
root=Path(__file__).parent
with tempfile.TemporaryDirectory() as folder:
    state=Path(folder)/'state.json'
    initial={'users':[{'id':1,'active':True,'roles':['customer'],'mobile':'09121234567'}],'settings':{}}
    def reset():state.write_text(json.dumps(initial))
    def read():return json.loads(state.read_text())
    def call(route,**body):
        result=subprocess.run(['php',str(root/'otp-harness.php'),str(state),'/api/native/login-otp/'+route,json.dumps(body)],check=True,capture_output=True,text=True)
        return json.loads(result.stdout)
    reset()
    assert call('request',mobile='09121234567')['ok']
    code=read()['test_last_code']
    assert call('request',mobile='09121234567')['status']==429
    assert call('confirm',mobile='09121234567',otp=code)['ok']
    assert 'error' in call('confirm',mobile='09121234567',otp=code), 'OTP was replayed'
    reset();call('request',mobile='09121234567');code=read()['test_last_code']
    wrong='000000' if code!='000000' else '111111'
    for _ in range(5):assert 'error' in call('confirm',mobile='09121234567',otp=wrong)
    assert 'error' in call('confirm',mobile='09121234567',otp=code), 'Attempt limit bypassed'
    assert call('request',mobile='09121234567')['status']==429
    reset();call('request',mobile='09121234567');s=read();code=s['test_last_code']
    for row in s['settings']['native_login_otp'].values():row['expires']=0
    state.write_text(json.dumps(s))
    assert 'error' in call('confirm',mobile='09121234567',otp=code), 'Expired code accepted'
    reset();assert call('request',mobile='09121111111')['ok'];assert read().get('test_sms_count',0)==0
    assert 'error' in call('confirm',mobile='09121111111',otp='123456')
    print('OTP: success, replay rejection, cooldown, five-attempt lock, expiry and unknown-account checks passed')
