#!/usr/bin/env python3
"""Surgical live-site patches for per-customer catalog price visibility."""
from __future__ import annotations

MARKER = 'GP_CUSTOMER_PRICE_ACCESS_20261025'

HELPERS = r'''function customerPriceGroups(c){let raw=c&&(c.visible_price_groups||c.price_groups||c.allowed_price_groups);if(raw==null)return['agent','panel','serial'];if(typeof raw==='string')raw=raw.split(/[,|]/);if(!Array.isArray(raw))return[];let map={agent:'agent',sales_agent:'agent','عامل فروش':'agent',panel:'panel','ثبت در پنل':'panel',serial:'serial','سریال آزاد':'serial'};return[...new Set(raw.map(x=>map[String(x).trim()]||map[String(x).trim().toLowerCase()]).filter(Boolean))]}
function priceGroupLabel(k){return({agent:'عامل فروش',panel:'ثبت در پنل',serial:'سریال آزاد'})[k]||k}
function readPriceGroups(prefix){return['agent','panel','serial'].filter(k=>{let el=$(prefix+'_'+k);return el&&el.checked})}
function priceGroupChecks(prefix,selected){return[['agent','عامل فروش'],['panel','ثبت در پنل'],['serial','سریال آزاد']].map(([k,l])=>`<label style="display:flex;gap:8px;align-items:center;font-weight:700;margin-top:6px"><input id="${prefix}_${k}" type="checkbox" style="width:auto" ${selected.includes(k)?'checked':''}> ${l}</label>`).join('')}
'''

ADD_BOX = (
    '</textarea><div class="mutedbox" style="margin-top:8px"><!-- ' + MARKER + ' -->'
    '<div class="small" style="font-weight:700;margin-bottom:4px">قیمت‌های قابل مشاهده در پرتال</div>'
    '<label style="display:flex;align-items:center;gap:8px;font-weight:700"><input id="cp_agent" type="checkbox" style="width:auto" checked> عامل فروش</label>'
    '<label style="display:flex;align-items:center;gap:8px;font-weight:700;margin-top:6px"><input id="cp_panel" type="checkbox" style="width:auto" checked> ثبت در پنل</label>'
    '<label style="display:flex;align-items:center;gap:8px;font-weight:700;margin-top:6px"><input id="cp_serial" type="checkbox" style="width:auto" checked> سریال آزاد</label>'
    '</div><button id="addCustomerBtn" style="margin-top:8px">ثبت مشتری</button>'
)

EDIT_BOX = (
    '</textarea><div class="mutedbox" style="margin-top:8px"><!-- ' + MARKER + ' -->'
    '<div class="small" style="font-weight:700">قیمت‌های قابل مشاهده در پرتال</div>'
    '${priceGroupChecks(\'ep\',customerPriceGroups(c))}</div>'
    '<div class="toolbar" style="margin-top:8px"><button onclick="saveCustomer(${id})">ذخیره</button>'
)

PORTAL_HELPERS = r'''function visiblePriceGroups(){if(typeof isCustomer==='function'&&!isCustomer())return['agent','panel','serial'];let raw=me&&me.customer&&(me.customer.visible_price_groups||me.customer.price_groups||me.customer.allowed_price_groups);if(raw==null)return['agent','panel','serial'];if(typeof raw==='string')raw=raw.split(/[,|]/);if(!Array.isArray(raw))return[];let map={agent:'agent',sales_agent:'agent','عامل فروش':'agent',panel:'panel','ثبت در پنل':'panel',serial:'serial','سریال آزاد':'serial'};return[...new Set(raw.map(x=>map[String(x).trim()]||map[String(x).trim().toLowerCase()]).filter(Boolean))]}
function priceKeyGroup(k){return String(k||'').startsWith('panel')?'panel':(k==='sales_agent'||k==='agent'?'agent':'serial')}
'''


def _once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'STOP: {label} matched {count} times')
    return text.replace(old, new, 1)


def patch_app_html(text: str) -> str:
    if MARKER in text:
        raise RuntimeError('STOP: app.html already has price-access marker')
    required = [
        '</textarea><button id="addCustomerBtn" style="margin-top:8px">ثبت مشتری</button>',
        'function renderCustomers(){',
        '${p?`<div class="small">زیرمجموعه: ${esc(p.name)}</div>`:\'\'}</td>',
        '</textarea><div class="toolbar" style="margin-top:8px"><button onclick="saveCustomer(${id})">ذخیره</button>',
        ',parent_marketer_id:parent})});closeModal();toast(\'مشتری ویرایش شد\')',
        ',parent_marketer_id:parent})});$(\'caddmsg\').className=\'ok\'',
        '$(\'isMarketer\').checked=false;$(\'hasMarketer\').checked=false;toggleMarketerPicker();',
    ]
    missing = [item for item in required if item not in text]
    if missing:
        raise RuntimeError('STOP: live app.html missing anchors: ' + '; '.join(missing[:3]))
    text = _once(
        text,
        '</textarea><button id="addCustomerBtn" style="margin-top:8px">ثبت مشتری</button>',
        ADD_BOX,
        'add-customer price box',
    )
    text = _once(text, 'function renderCustomers(){', HELPERS + 'function renderCustomers(){', 'helpers')
    text = _once(
        text,
        '${p?`<div class="small">زیرمجموعه: ${esc(p.name)}</div>`:\'\'}</td>',
        '${p?`<div class="small">زیرمجموعه: ${esc(p.name)}</div>`:\'\'}<div class="small">${esc(customerPriceGroups(c).map(priceGroupLabel).join(\' • \')||\'بدون دسترسی قیمت\')}</div></td>',
        'customer list prices',
    )
    text = _once(
        text,
        '</textarea><div class="toolbar" style="margin-top:8px"><button onclick="saveCustomer(${id})">ذخیره</button>',
        EDIT_BOX,
        'edit-customer price box',
    )
    text = _once(
        text,
        ',parent_marketer_id:parent})});closeModal();toast(\'مشتری ویرایش شد\')',
        ',parent_marketer_id:parent,visible_price_groups:readPriceGroups(\'ep\')})});closeModal();toast(\'مشتری ویرایش شد\')',
        'saveCustomer payload',
    )
    text = _once(
        text,
        ',parent_marketer_id:parent})});$(\'caddmsg\').className=\'ok\'',
        ',parent_marketer_id:parent,visible_price_groups:readPriceGroups(\'cp\')})});$(\'caddmsg\').className=\'ok\'',
        'addCustomer payload',
    )
    text = _once(
        text,
        '$(\'isMarketer\').checked=false;$(\'hasMarketer\').checked=false;toggleMarketerPicker();',
        '$(\'isMarketer\').checked=false;$(\'hasMarketer\').checked=false;[\'cp_agent\',\'cp_panel\',\'cp_serial\'].forEach(id=>{if($(id))$(id).checked=true});toggleMarketerPicker();',
        'addCustomer reset',
    )
    if text.count(MARKER) != 2:
        raise RuntimeError('STOP: app.html marker count unexpected')
    return text


def patch_portal_html(text: str) -> str:
    if MARKER in text:
        raise RuntimeError('STOP: portal.html already has price-access marker')
    if 'function renderCatalog(){' not in text or 'function priceOptions(' not in text:
        raise RuntimeError('STOP: live portal.html missing catalog helpers')
    text = _once(
        text,
        'function priceCell(v){',
        '/* ' + MARKER + ' */\n' + PORTAL_HELPERS + 'function priceCell(v){',
        'portal helpers',
    )
    text = _once(
        text,
        'let x=p.prices||{},opts=Object.entries(PRICE_LABELS).filter(([k])=>Number(x[k]||0)>0);',
        'let x=p.prices||{},allowed=visiblePriceGroups(),opts=Object.entries(PRICE_LABELS).filter(([k])=>Number(x[k]||0)>0&&allowed.includes(priceKeyGroup(k)));',
        'priceOptions filter',
    )
    old_head = (
        '<th rowspan="2">نام کالا</th><th colspan="3" class="panel-head">ثبت در پنل شرکت</th>'
        '<th colspan="3" class="serial-head">سریال آزاد</th><th rowspan="2">اعتباری</th>'
        '<th rowspan="2">وضعیت موجودی</th><th rowspan="2">سفارش</th></tr>'
        '<tr><th>نقد</th><th>هفت‌روزه</th><th>یک‌ماهه</th><th>۱ تا ۵۰</th><th>۵۱ تا ۲۰۰</th><th>عامل فروش</th>'
    )
    new_head = (
        '${(function(){let g=visiblePriceGroups(),h1=\'<th rowspan="2">نام کالا</th>\',h2=\'\';'
        'if(g.includes(\'panel\')){h1+=\'<th colspan="3" class="panel-head">ثبت در پنل شرکت</th>\';h2+=\'<th>نقد</th><th>هفت‌روزه</th><th>یک‌ماهه</th>\';}'
        'if(g.includes(\'serial\')){h1+=`<th colspan="${g.includes(\'agent\')?3:2}" class="serial-head">سریال آزاد</th>`;h2+=\'<th>۱ تا ۵۰</th><th>۵۱ تا ۲۰۰</th>\';}'
        'if(g.includes(\'agent\')){if(!g.includes(\'serial\'))h1+=\'<th class="serial-head">عامل فروش</th>\';h2+=\'<th>عامل فروش</th>\';}'
        'h1+=\'<th rowspan="2">اعتباری</th><th rowspan="2">وضعیت موجودی</th><th rowspan="2">سفارش</th>\';'
        'return h1+\'</tr><tr>\'+h2;})()}'
    )
    text = _once(text, old_head, new_head, 'catalog headers')
    old_cells = (
        '<td data-label="نقد پنل">${priceCell(x.panel_cash||p.price)}</td>'
        '<td data-label="هفت‌روزه">${priceCell(x.panel_7d)}</td>'
        '<td data-label="یک‌ماهه">${priceCell(x.panel_1m)}</td>'
        '<td data-label="سریال ۱ تا ۵۰">${priceCell(x.serial_1_50)}</td>'
        '<td data-label="سریال ۵۱ تا ۲۰۰">${priceCell(x.serial_51_200)}</td>'
        '<td data-label="عامل فروش">${priceCell(x.sales_agent)}</td>'
    )
    new_cells = (
        '${visiblePriceGroups().includes(\'panel\')?`<td data-label="نقد پنل">${priceCell(x.panel_cash||p.price)}</td><td data-label="هفت‌روزه">${priceCell(x.panel_7d)}</td><td data-label="یک‌ماهه">${priceCell(x.panel_1m)}</td>`:\'\'}'
        '${visiblePriceGroups().includes(\'serial\')?`<td data-label="سریال ۱ تا ۵۰">${priceCell(x.serial_1_50)}</td><td data-label="سریال ۵۱ تا ۲۰۰">${priceCell(x.serial_51_200)}</td>`:\'\'}'
        '${visiblePriceGroups().includes(\'agent\')?`<td data-label="عامل فروش">${priceCell(x.sales_agent)}</td>`:\'\'}'
    )
    text = _once(text, old_cells, new_cells, 'catalog cells')
    return text


def _insert_require(text: str) -> str:
    if 'customer-price-access.php' in text:
        return text
    for old in (
        "require_once __DIR__.'/lib/storage.php';",
        "require_once dirname(__DIR__).'/lib/storage.php';",
    ):
        if text.count(old) == 1:
            require = (
                "require_once __DIR__.'/lib/customer-price-access.php';"
                if "__DIR__.'/lib/storage.php'" in old
                else "require_once dirname(__DIR__).'/lib/customer-price-access.php';"
            )
            return text.replace(old, old + "\n" + require, 1)
    raise RuntimeError('STOP: could not insert customer-price-access require')


def _patch_catalog(text: str) -> str:
    prices = "$p['prices']=array_map('intval',array_merge($defaults,is_array($p['prices']??null)?$p['prices']:[]));"
    filtered = "$p['prices']=ghadir_filter_prices(array_map('intval',array_merge($defaults,is_array($p['prices']??null)?$p['prices']:[])),$groups);"
    if prices not in text:
        if filtered in text:
            return text
        raise RuntimeError('STOP: catalog prices assignment not found')
    text = text.replace(prices, filtered)
    start = "if($p==='/api/catalog'&&$m==='GET'){auth();out(db(false,function($s){"
    started = "if($p==='/api/catalog'&&$m==='GET'){$u=auth();out(db(false,function($s)use($u){"
    groups = "$groups=in_array('customer',$u['roles']??[],true)?ghadir_customer_price_groups((function($s,$u){$i=idx($s['customers'],$u['customer_id']??0);return $i<0?null:$s['customers'][$i];})($s,$u)):['agent','panel','serial'];"
    if start in text:
        text = text.replace(start, started + groups, 1)
    elif started in text and groups not in text:
        text = text.replace(started, started + groups, 1)
    elif groups in text:
        pass
    else:
        raise RuntimeError('STOP: catalog GET opener not found')
    return text


def _patch_customers(text: str) -> str:
    import re
    apply_edit = "if(array_key_exists('visible_price_groups',$x))ghadir_apply_customer_price_groups($c,$x['visible_price_groups']);"
    match = re.search(
        r"foreach\(\['name','mobile'[^\]]*is_marketer'[^\]]*\] as \$k\)if\(array_key_exists\(\$k,\$x\)\)\$c\[\$k\]=\$x\[\$k\];",
        text,
    )
    if not match:
        raise RuntimeError('STOP: customers/edit whitelist not found')
    whitelist = match.group(0)
    if apply_edit not in text:
        text = text.replace(whitelist, whitelist + apply_edit)
    add_anchor = "$s['customers'][]=$x;return $x;});out($r);}"
    apply_add = "if(array_key_exists('visible_price_groups',$x))ghadir_apply_customer_price_groups($x,$x['visible_price_groups']);$s['customers'][]=$x;return $x;});out($r);}"
    if apply_add not in text:
        if text.count(add_anchor) < 1:
            raise RuntimeError('STOP: customers/add persist anchor not found')
        text = text.replace(add_anchor, apply_add, 1)
    native = "if($p==='/api/native/customer-access'&&$m==='POST')"
    if native not in text:
        insert = (
            "if($p==='/api/native/customer-access'&&$m==='POST'){$u=auth(['sales']);$x=input();out(db(true,function(&$s)use($x){"
            "$i=idx($s['customers'],$x['id']??$x['customer_id']??0);if($i<0)fail('مشتری پیدا نشد',404);"
            "ghadir_apply_customer_price_groups($s['customers'][$i],$x['visible_price_groups']??[]);return $s['customers'][$i];}));}"
        )
        delete = "if($p==='/api/customers/delete')"
        if delete not in text:
            raise RuntimeError('STOP: customers/delete not found for native insert')
        text = text.replace(delete, insert + delete, 1)
    return text


def _patch_orders(text: str) -> str:
    old = "$priceKey=trim((string)($it['price_key']??''));"
    check = "$priceKey=trim((string)($it['price_key']??''));if($isCustomer&&$priceKey!==''&&!ghadir_price_key_allowed($priceKey,ghadir_customer_price_groups($s['customers'][$ci])))fail('این نوع قیمت برای حساب شما فعال نیست');"
    if check in text:
        return text
    if old not in text:
        return text
    return text.replace(old, check)


def patch_php(text: str) -> str:
    text = _insert_require(text)
    text = _patch_catalog(text)
    text = _patch_customers(text)
    text = _patch_orders(text)
    if 'ghadir_apply_customer_price_groups' not in text:
        raise RuntimeError('STOP: PHP price-access apply missing after patch')
    return text
