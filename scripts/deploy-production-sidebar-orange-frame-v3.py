#!/usr/bin/env python3
"""Guarded FTPS release: remove only the sidebar switch's visual orange frame.

Uploads one CSS file and replaces only its cache-busting URL in live app.html.
Never reads or writes production application data or database records.
"""
from pathlib import Path
import os
import subprocess
import sys
import tempfile


CSS_PATH = Path('assets/production-sidebar-placement-v2.css')
OLD_CSS_URL = b'/assets/production-sidebar-placement-v2.css?v=2'
NEW_CSS_URL = b'/assets/production-sidebar-placement-v2.css?v=3'
APP_REMOTE = '/app.html'
CSS_REMOTE = '/assets/production-sidebar-placement-v2.css'

MAIN_INSERT = b'''  /* Keep the animated three bars, remove only the orange tile/frame behind. */
  border: 0 !important;
  box-shadow: none !important;
  outline: 0 !important;
  background: #102a43 !important;
'''
HOVER_INSERT = b'''#app #gpSidebarSwitch:hover,
#app #gpSidebarSwitch:active {
  border: 0 !important;
  box-shadow: none !important;
  outline: 0 !important;
  background: #102a43 !important;
}

'''


def expected_old_css(new_css: bytes) -> bytes:
    """Prove source change is strictly the approved visual block."""
    for block in (MAIN_INSERT, HOVER_INSERT):
        if new_css.count(block) != 1:
            raise ValueError('STOP: missing or duplicated approved sidebar CSS block')
        new_css = new_css.replace(block, b'', 1)
    if not new_css.startswith(b'/* GHADIR_PRODUCTION_SIDEBAR_PLACEMENT_V2_20261024'):
        raise ValueError('STOP: unexpected stylesheet')
    return new_css


def expected_new_html(old_html: bytes) -> bytes:
    for marker in (b'id="app"', OLD_CSS_URL,
                   b'/assets/production-sidebar-placement-v2.js?v=2'):
        if old_html.count(marker) != 1:
            raise ValueError('STOP: missing or duplicated existing HTML marker')
    if NEW_CSS_URL in old_html:
        raise ValueError('STOP: cache-busted CSS URL already published')
    return old_html.replace(OLD_CSS_URL, NEW_CSS_URL, 1)


def quote(value):
    return '"' + str(value).replace('\\', '\\\\').replace('"', '\\"') + '"'


def ftp(commands, temp: Path):
    host = os.environ.get('FTP_SERVER', '')
    username = os.environ.get('FTP_USERNAME', '')
    password = os.environ.get('FTP_PASSWORD', '')
    if not host or username.lower() != 'deploy@ghadirpartner.ir' or not password:
        raise RuntimeError('STOP: invalid production FTPS deployment identity')
    auth_script = temp / 'private-lftp-script'
    auth_script.write_text('\n'.join([
        'set cmd:fail-exit yes', 'set ftp:ssl-force true',
        'set ftp:ssl-protect-data true', 'set ssl:verify-certificate true',
        'set net:max-retries 2', 'open -p 21 ' + quote(host),
        'user ' + quote(username) + ' ' + quote(password),
        *commands, 'bye',
    ]) + '\n')
    auth_script.chmod(0o600)
    try:
        subprocess.run(['lftp', '-f', str(auth_script)], check=True, timeout=150)
    finally:
        auth_script.unlink(missing_ok=True)


def deploy():
    new_css = CSS_PATH.read_bytes()
    old_css_expected = expected_old_css(new_css)
    with tempfile.TemporaryDirectory(prefix='ghadir-sidebar-frame-v3-') as temp_name:
        temp = Path(temp_name)
        html_before, css_before = temp / 'app-before', temp / 'css-before'
        ftp([f'get {APP_REMOTE} -o {quote(html_before)}',
             f'get {CSS_REMOTE} -o {quote(css_before)}'], temp)
        html_original = html_before.read_bytes()
        if css_before.read_bytes() != old_css_expected:
            raise RuntimeError('STOP: live CSS differs from the approved V2 baseline')
        updated_html = expected_new_html(html_original)
        html_after = temp / 'app-after'
        html_after.write_bytes(updated_html)

        # Recheck both live files immediately before writing (no overwrite on drift).
        html_prewrite, css_prewrite = temp / 'app-prewrite', temp / 'css-prewrite'
        ftp([f'get {APP_REMOTE} -o {quote(html_prewrite)}',
             f'get {CSS_REMOTE} -o {quote(css_prewrite)}'], temp)
        if html_prewrite.read_bytes() != html_original or css_prewrite.read_bytes() != old_css_expected:
            raise RuntimeError('STOP: live HTML or CSS changed before deployment')
        try:
            ftp([f'put {quote(CSS_PATH.resolve())} -o {CSS_REMOTE}',
                 f'put {quote(html_after)} -o {APP_REMOTE}'], temp)
            html_verify, css_verify = temp / 'app-verify', temp / 'css-verify'
            ftp([f'get {APP_REMOTE} -o {quote(html_verify)}',
                 f'get {CSS_REMOTE} -o {quote(css_verify)}'], temp)
            if html_verify.read_bytes() != updated_html or css_verify.read_bytes() != new_css:
                raise RuntimeError('STOP: production readback does not match proposed files')
        except Exception:
            print('ERROR: rolling back both HTML and CSS to pre-release bytes', file=sys.stderr)
            try:
                ftp([f'put {quote(css_before)} -o {CSS_REMOTE}',
                     f'put {quote(html_before)} -o {APP_REMOTE}'], temp)
                print('ROLLBACK: original sidebar CSS and HTML restored', file=sys.stderr)
            except Exception:
                print('CRITICAL: rollback failed; manual recovery required', file=sys.stderr)
            raise
    print('SUCCESS: orange sidebar frame removed, CSS cache URL bumped to v3')
    print('UNCHANGED: JavaScript, authentication, orders, stock, cartons and database')


if __name__ == '__main__':
    if sys.argv[1:] != ['deploy']:
        raise SystemExit('Usage: deploy-production-sidebar-orange-frame-v3.py deploy')
    deploy()
