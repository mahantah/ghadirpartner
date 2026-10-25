#!/usr/bin/env python3
from pathlib import Path
import os
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parents[1]
MENU2 = REPO / 'assets/ui-v53435-menu2.js'
MENU2_REMOTE = '/assets/ui-v53435-menu2.js'
OVERLAY = REPO / 'assets/menu-live-v3.js'
OVERLAY_REMOTE = '/assets/menu-live-v3.js'
REFINE = REPO / 'assets/warehouse-ui-refine-v53438.js'
REFINE_REMOTE = '/assets/warehouse-ui-refine-v53438.js'
APP_REMOTE = '/app.html'
MARKER = b'GP_MENU_LIVE_V3_20261025'
MENU2_MARKER = b'GP_UI_MENU2_20261025'
TAG = b'<!-- ' + MARKER + b' --><script src="/assets/menu-live-v3.js?v=3"></script>\n'
OLD_V2 = b'<!-- GP_CUSTOMER_CHANNEL_OFFERS_V2_20261025 --><script src="/assets/customer-channel-offers-v2.js?v=2"></script>\n'
OLD_V1 = b'<!-- GP_CUSTOMER_CHANNEL_OFFERS_V1_20261025 --><script src="/assets/customer-channel-offers-v1.js?v=1"></script>\n'
ANCHOR = b'</body></html>'
OLD_UI = b'/assets/ui-v53435.js?v=53435'
NEW_UI = b'/assets/ui-v53435-menu2.js?v=2'
OLD_REFINE_Q = b'/assets/warehouse-ui-refine-v53438.js?v=53438ui4'
NEW_REFINE_Q = b'/assets/warehouse-ui-refine-v53438.js?v=53438ui5'
OLD_TABS = (
    "const TAB_ACCESS={dashboard:[],orders:['sales','finance','prep','viewer'],checks:['finance'],"
    "neworder:['sales'],customers:['sales','viewer'],inventory:['sales','prep','viewer'],"
    "warehouse:['prep','viewer'],warehouseDaily:['prep','viewer'],reports:['prep','viewer'],"
    "products:['admin'],salesReports:['sales','viewer'],portalAdmin:['admin'],users:['admin'],"
    "settings:['admin']};"
).encode()
NEW_TABS = (
    "const TAB_ACCESS={dashboard:[],orders:['sales','finance','prep','viewer'],checks:['finance'],"
    "neworder:['sales'],customers:['sales','viewer'],customerAdd:['sales','viewer'],"
    "salesAgents:['sales','viewer'],salesReps:['sales','viewer'],inventory:['sales','prep','viewer'],"
    "warehouse:['prep','viewer'],warehouseDaily:['prep','viewer'],stocktake:['prep','viewer'],"
    "reports:['prep','viewer'],products:['admin'],salesReports:['sales','viewer'],"
    "portalAdmin:['admin'],users:['admin'],settings:['admin']};"
).encode()
OLD_WH = b"let inWarehouse=['inventory','warehouse','reports','products'].includes(t);"
NEW_WH = b"let inWarehouse=['inventory','warehouse','reports','products','warehouseDaily','stocktake'].includes(t);"
CHANNEL_HTML = (
    '<div id="gpChannelBox"><div class="gp-channel-title">این مشتری کدام کانال است؟</div>'
    '<div class="gp-channel-row">'
    '<label><input type="radio" name="gpChannel" value="agent" style="width:auto"> عاملین فروش</label>'
    '<label><input type="radio" name="gpChannel" value="rep" style="width:auto"> نمایندگان</label>'
    '</div><div id="gpRepBox" class="hidden"><div class="small" style="font-weight:800">نقش نمایندگی</div>'
    '<select id="gpRepRole" style="width:100%;margin-top:8px"><option value="">انتخاب کنید</option>'
    '<option value="marketer">بازاریاب</option><option value="sub">زیرمجموعه بازاریاب</option></select>'
    '<div id="gpRepParentBox" class="hidden">'
    '<input id="gpRepParentSearch" style="width:100%;margin-top:8px" placeholder="جستجوی بازاریاب یا زیرمجموعه بازاریاب">'
    '<select id="gpRepParent" style="width:100%;margin-top:6px"><option value="">انتخاب بازاریاب یا زیرمجموعه بازاریاب</option></select>'
    '</div></div></div>'
).encode()
OLD_ADD_OPEN = (
    '<section id="customers" class="tab hidden"><div id="customerAddCard" class="card">'
    '<h3>افزودن دستی مشتری</h3>'
).encode()
NEW_ADD_OPEN = (
    '<section id="customerAdd" class="tab hidden"><div id="customerAddCard" class="card">'
    '<h3>افزودن مشتری جدید</h3>'
).encode() + CHANNEL_HTML
OLD_SPLIT = (
    '</div></div><div class="card"><input id="custSearch" placeholder="جستجو با نام، موبایل یا کد مشتری"'
).encode()
NEW_SPLIT = (
    '</div></div></section><section id="customers" class="tab hidden">'
    '<div class="card"><input id="custSearch" placeholder="جستجو با نام، موبایل یا کد مشتری"'
).encode()
OLD_INV = b'<section id="inventory" class="tab hidden">'
NEW_INV = (
    '<section id="salesAgents" class="tab hidden"><div class="card gp-offers-page-head">'
    '<h3 style="margin:0">عاملین فروش</h3>'
    '<div class="small">طرح‌های فروش این کانال از همین صفحه مدیریت می‌شود.</div></div></section>'
    '<section id="salesReps" class="tab hidden"><div class="card gp-offers-page-head">'
    '<h3 style="margin:0">نمایندگان فروش</h3>'
    '<div class="small">طرح‌های فروش این کانال از همین صفحه مدیریت می‌شود.</div></div></section>'
    '<section id="stocktake" class="tab hidden"></section>'
    '<section id="inventory" class="tab hidden">'
).encode()
CHANNEL_CSS = (
    '<style id="gp-menu-live-v3-inline">'
    '#gpChannelBox{margin:0 0 14px;padding:14px 16px;border:2px solid #f58220;background:#fff7ef;border-radius:14px}'
    '#gpChannelBox .gp-channel-title{font-weight:900;color:#102a43;margin:0 0 8px}'
    '#gpChannelBox .gp-channel-row{display:flex;flex-wrap:wrap;gap:10px 18px}'
    '#gpChannelBox label{display:flex;align-items:center;gap:8px;font-weight:800;margin:0;background:#fff;border:1px solid #f0d2b3;border-radius:10px;padding:8px 12px}'
    '.gp-channel-legacy{display:none!important}'
    '</style></head>'
).encode()


def quote(value):
    return '"' + str(value).replace('\\', '\\\\').replace('"', '\\"') + '"'


def ftp(commands, temp):
    host = os.environ.get('FTP_SERVER', '')
    username = os.environ.get('FTP_USERNAME', '')
    password = os.environ.get('FTP_PASSWORD', '')
    if not host or username.lower() != 'deploy@ghadirpartner.ir' or not password:
        raise RuntimeError('STOP: invalid production FTPS release identity')
    private = temp / 'private-lftp-script'
    private.write_text('\n'.join([
        'set cmd:fail-exit yes', 'set ftp:ssl-force true',
        'set ftp:ssl-protect-data true', 'set ssl:verify-certificate true',
        'set net:max-retries 2', 'open -p 21 ' + quote(host),
        'user ' + quote(username) + ' ' + quote(password),
        *commands, 'bye',
    ]) + '\n')
    private.chmod(0o600)
    try:
        subprocess.run(['lftp', '-f', str(private)], check=True, timeout=180)
    finally:
        private.unlink(missing_ok=True)


def replace_once(raw: bytes, old: bytes, new: bytes, label: str) -> bytes:
    if raw.count(old) != 1:
        raise RuntimeError(f'STOP: {label} not unique ({raw.count(old)})')
    return raw.replace(old, new, 1)


def patch_html(raw: bytes) -> bytes:
    if MARKER in raw and TAG.strip() in raw and NEW_UI in raw:
        raise RuntimeError('STOP: menu live v3 already linked')
    if b'menu-live-v3.js' in raw:
        raise RuntimeError('STOP: v3 script already present')
    if b'shamsi-calendar-table-v1.js' not in raw:
        raise RuntimeError('STOP: calendar overlay missing; refuse to patch')
    if b'warehouseNavGroup' not in raw:
        raise RuntimeError('STOP: expected live navigation shell missing')
    if b'ui-v53435.js' not in raw and NEW_UI not in raw:
        raise RuntimeError('STOP: expected menu builder reference missing')

    if OLD_UI in raw:
        raw = replace_once(raw, OLD_UI, NEW_UI, 'ui-v53435 script')
    elif NEW_UI not in raw:
        raise RuntimeError('STOP: cannot retarget menu builder')

    if OLD_REFINE_Q in raw:
        raw = replace_once(raw, OLD_REFINE_Q, NEW_REFINE_Q, 'refine cache buster')
    elif NEW_REFINE_Q not in raw and b'warehouse-ui-refine-v53438.js' in raw:
        raw = raw.replace(
            b'warehouse-ui-refine-v53438.js?v=53438ui4',
            b'warehouse-ui-refine-v53438.js?v=53438ui5',
            1,
        )

    if OLD_TABS in raw:
        raw = replace_once(raw, OLD_TABS, NEW_TABS, 'TAB_ACCESS')
    elif b"customerAdd:['sales','viewer']" not in raw:
        raise RuntimeError('STOP: TAB_ACCESS block not found')

    if OLD_WH in raw:
        raw = replace_once(raw, OLD_WH, NEW_WH, 'warehouse active tabs')

    if OLD_ADD_OPEN in raw:
        raw = replace_once(raw, OLD_ADD_OPEN, NEW_ADD_OPEN, 'customer add section')
    elif b'id="gpChannelBox"' not in raw:
        raise RuntimeError('STOP: customer add card not found')

    if OLD_SPLIT in raw and b'<section id="customerAdd"' in raw:
        raw = replace_once(raw, OLD_SPLIT, NEW_SPLIT, 'kartabl split')

    if b'id="salesAgents"' not in raw:
        if raw.count(OLD_INV) < 1:
            raise RuntimeError('STOP: inventory section missing')
        raw = raw.replace(OLD_INV, NEW_INV, 1)

    if b'id="gp-menu-live-v3-inline"' not in raw:
        if raw.count(b'</head>') != 1:
            raise RuntimeError('STOP: head close not unique')
        raw = raw.replace(b'</head>', CHANNEL_CSS, 1)

    if OLD_V2 in raw:
        raw = raw.replace(OLD_V2, TAG, 1)
    elif OLD_V1 in raw:
        raw = raw.replace(OLD_V1, TAG, 1)
    elif MARKER not in raw:
        if raw.count(ANCHOR) != 1:
            raise RuntimeError('STOP: app.html closing body not unique')
        raw = raw.replace(ANCHOR, TAG + ANCHOR, 1)
    return raw


def patch_refine(raw: bytes) -> bytes:
    old = "setGpMenuLabel(b,'لیست قیمت')".encode()
    new = "setGpMenuLabel(b,'قیمت و موجودی')".encode()
    if new in raw and old not in raw:
        return raw
    if old not in raw:
        raise RuntimeError('STOP: expected refine price-list label missing')
    if raw.count(old) != 1:
        raise RuntimeError('STOP: refine price-list label not unique')
    return raw.replace(old, new, 1)


def deploy():
    menu2 = MENU2.read_bytes()
    overlay = OVERLAY.read_bytes()
    for blob, needles in (
        (menu2, (MENU2_MARKER, 'قیمت و موجودی'.encode(), 'افزودن مشتری جدید'.encode(),
                 'کارتابل مشتریان'.encode(), 'عاملین فروش'.encode(), b'customerAdd')),
        (overlay, (MARKER, b'sales_channel', b'gpRepParent', b'interceptNavClick',
                   'اضافه کردن محصول جدید'.encode(), 'زیرمجموعه بازاریاب'.encode())),
    ):
        for needle in needles:
            if needle not in blob:
                raise RuntimeError('STOP: asset incomplete: ' + needle.decode('utf-8', 'replace'))

    with tempfile.TemporaryDirectory(prefix='gp-menu-v3-') as name:
        temp = Path(name)
        before = temp / 'app-before'
        ftp([f'get {APP_REMOTE} -o {quote(before)}'], temp)
        original = before.read_bytes()
        updated = patch_html(original)
        after = temp / 'app-after'
        after.write_bytes(updated)

        refine_before = temp / 'refine-before'
        ftp([f'get {REFINE_REMOTE} -o {quote(refine_before)}'], temp)
        refine_updated = patch_refine(refine_before.read_bytes())
        refine_after = temp / 'refine-after'
        refine_after.write_bytes(refine_updated)

        ftp([f'put {quote(MENU2)} -o {MENU2_REMOTE}'], temp)
        ftp([f'put {quote(OVERLAY)} -o {OVERLAY_REMOTE}'], temp)
        ftp([f'put {quote(refine_after)} -o {REFINE_REMOTE}'], temp)
        for remote, local in (
            (MENU2_REMOTE, MENU2),
            (OVERLAY_REMOTE, OVERLAY),
        ):
            readback = temp / (Path(remote).name + '-readback')
            ftp([f'get {remote} -o {quote(readback)}'], temp)
            if readback.read_bytes() != local.read_bytes():
                raise RuntimeError('STOP: asset readback mismatch for ' + remote)
        refine_read = temp / 'refine-readback'
        ftp([f'get {REFINE_REMOTE} -o {quote(refine_read)}'], temp)
        if refine_read.read_bytes() != refine_updated:
            raise RuntimeError('STOP: refine readback mismatch')

        prewrite = temp / 'app-prewrite'
        ftp([f'get {APP_REMOTE} -o {quote(prewrite)}'], temp)
        if prewrite.read_bytes() != original:
            raise RuntimeError('STOP: live app.html changed during staging')
        try:
            ftp([f'put {quote(after)} -o {APP_REMOTE}'], temp)
            html_read = temp / 'app-readback'
            ftp([f'get {APP_REMOTE} -o {quote(html_read)}'], temp)
            if html_read.read_bytes() != updated:
                raise RuntimeError('STOP: production HTML readback mismatch')
        except Exception:
            try:
                ftp([f'put {quote(before)} -o {APP_REMOTE}'], temp)
                print('ROLLBACK: previous app.html restored', file=sys.stderr)
            except Exception:
                print('CRITICAL: automatic rollback failed', file=sys.stderr)
            raise
    print('SUCCESS: menu live v3 replaced the live menu builder')


if __name__ == '__main__':
    if sys.argv[1:] != ['deploy']:
        raise SystemExit('Usage: deploy-production-menu-live-v3.py deploy')
    deploy()
