#!/usr/bin/env python3
"""Owner-approved narrow release. Never reads config, credentials or MySQL into artifacts."""
from pathlib import Path
import os, subprocess, sys, shutil, hashlib

ROOT = Path(__file__).resolve().parents[1]
TEMP = Path(os.environ['RUNNER_TEMP'])
BEFORE, AFTER = TEMP/'login-before', TEMP/'login-after'
BASE = '2a8bea41a0625d84373aaa4e73e14ca2108bd05f'
FILES = ['lib/staff-login-otp.php', 'assets/staff-login-otp.css', 'assets/staff-login-otp.js', 'app.html']

def transfer(commands):
    def quote(value):
        return '"' + value.replace('\\', '\\\\').replace('"', '\\"') + '"'
    script = '\n'.join([
        'set cmd:fail-exit yes', 'set net:max-retries 2', 'set net:timeout 25',
        'set ftp:ssl-force true', 'set ftp:ssl-protect-data true',
        'set ssl:verify-certificate yes',
        'open -p 21 '+quote(os.environ['FTP_SERVER']),
        'user '+quote(os.environ['FTP_USERNAME'])+' '+quote(os.environ['FTP_PASSWORD']),
        *commands, 'bye', ''])
    # Never echo connection material or raw remote responses into CI logs.
    result = subprocess.run(['lftp'], input=script, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError('Secure file transfer failed; private connection output withheld')

def public_get(path, dest):
    subprocess.run(['curl','-fsS','--max-time','30','-H','Cache-Control: no-cache',
                    'https://ghadirpartner.ir/'+path,'-o',str(dest)], check=True)

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def verify_public(folder, tag):
    for name in ['app.html','assets/staff-login-otp.css','assets/staff-login-otp.js']:
        check = TEMP/('verify-'+Path(name).name)
        public_get(name+'?release='+tag, check)
        if digest(check) != digest(folder/name):
            raise RuntimeError('Public file differs from expected release: '+name)
    health = TEMP/'health.json'
    public_get('healthz', health)
    if 'V5.3.4.38' not in health.read_text():
        raise RuntimeError('Unexpected health version')

if sys.argv[1] == 'download':
    transfer([f'get /{name} -o "{BEFORE/name}"' for name in FILES])
    # Refuse unreviewed server drift. Only known public repository code is retained.
    for name in FILES[:-1]:
        expected = subprocess.check_output(['git','show',BASE+':'+name],cwd=ROOT)
        if (BEFORE/name).read_bytes() != expected:
            raise RuntimeError('Live code drift; no files uploaded: '+name)
    public_get('app.html',TEMP/'public-app.html')
    if digest(BEFORE/'app.html') != digest(TEMP/'public-app.html'):
        raise RuntimeError('Downloaded app differs from public app; abort')
    public_get('assets/ghadir-logo-transparent.svg',TEMP/'logo.svg')
    if digest(TEMP/'logo.svg') != digest(ROOT/'assets/ghadir-logo-transparent.svg'):
        raise RuntimeError('Live logo differs; abort')
    html = (BEFORE/'app.html').read_text()
    for anchor in ['SUPPLIER_CANONICAL_UI_V8_20261016','GHADIR_STAFF_LOGIN_OTP_UI_V1_20261016']:
        if anchor not in html: raise RuntimeError('Missing baseline anchor')
    shutil.copytree(BEFORE,AFTER)
    for name in FILES[:-1]: shutil.copy2(ROOT/name,AFTER/name)
    for name in ['staff-login-otp.css','staff-login-otp.js']:
        old = f'/assets/{name}?v=20261016b2"'
        if html.count(old) != 1: raise RuntimeError('Unexpected cache reference')
        html = html.replace(old,f'/assets/{name}?v=20261016b3"',1)
    (AFTER/'app.html').write_text(html)
    print('Baseline verified; code-only rollback snapshot prepared. No database access.')
elif sys.argv[1] == 'publish':
    if not all((AFTER/p).is_file() and (BEFORE/p).is_file() for p in FILES):
        raise RuntimeError('Missing validated snapshot')
    started = False
    try:
        # Re-read to avoid overwriting a concurrent change after snapshot creation.
        for name in FILES:
            check=TEMP/'drift-check'
            transfer([f'get /{name} -o "{check}"'])
            if digest(check) != digest(BEFORE/name): raise RuntimeError('Concurrent live edit; abort')
        # Stage all replacements before atomic per-file renames, HTML last.
        suffix = os.environ['GITHUB_RUN_ID']
        for name in FILES:
            transfer([f'put "{AFTER/name}" -o /{name}.stage-{suffix}.php'])
        started = True
        for name in FILES:
            transfer([f'mv /{name}.stage-{suffix}.php /{name}'])
        verify_public(AFTER, suffix)
        check=TEMP/'verified-helper.php'
        transfer([f'get /lib/staff-login-otp.php -o "{check}"'])
        if digest(check) != digest(AFTER/'lib/staff-login-otp.php'):
            raise RuntimeError('Server helper differs from release')
        print('Targeted release verified: helper, CSS, JS, HTML cache tags and health. Real OTP not tested.')
    except Exception:
        if started:
            print('Verification failed; restoring saved code files.')
            transfer([f'put "{BEFORE/name}" -o /{name}' for name in FILES])
            verify_public(BEFORE, os.environ['GITHUB_RUN_ID']+'-rollback')
            print('Rollback verified.')
        raise
else:
    raise SystemExit('Expected download or publish')
