#!/usr/bin/env python3
"""Show a visible price-edit action on every existing customer row."""
from __future__ import annotations

MARKER = 'GP_CUSTOMER_PRICE_ACCESS_EDIT_V2_20261025'

ROW_OLD = (
    '${p?`<div class="small">زیرمجموعه: ${esc(p.name)}</div>`:\'\'}'
    '<div class="small">${esc(customerPriceGroups(c).map(priceGroupLabel).join(\' • \')||\'بدون دسترسی قیمت\')}</div></td>'
)
ROW_NEW = (
    '${p?`<div class="small">زیرمجموعه: ${esc(p.name)}</div>`:\'\'}'
    '<div class="small">${esc(customerPriceGroups(c).map(priceGroupLabel).join(\' • \')||\'بدون دسترسی قیمت\')}</div>'
    '<button type="button" class="btnlight" style="margin-top:6px;padding:6px 10px" onclick="event.stopPropagation();openCustomerPriceEdit(${c.id})">ویرایش قیمت</button></td>'
)

MODAL_OLD = (
    'function openCustomerEdit(id){let c=customerById(id),parent=marketerParent(c),marketers=marketerList().filter(x=>x.id!==id);'
    'modal(`<h3>ویرایش مشتری</h3>'
)
MODAL_NEW = (
    'function openCustomerPriceEdit(id){let c=customerById(id);if(!c||!c.id){alert(\'مشتری پیدا نشد\');return}'
    'modal(`<h3>ویرایش قیمت ' + '${esc(c.name)}</h3>'
    '<div class="mutedbox"><!-- ' + MARKER + ' -->'
    '<div class="small" style="font-weight:700">قیمت‌های قابل مشاهده در پرتال</div>'
    '${priceGroupChecks(\'ep\',customerPriceGroups(c))}</div>'
    '<div class="toolbar" style="margin-top:10px">'
    '<button onclick="saveCustomerPrices(${id})">ذخیره قیمت</button>'
    '<button class="btnlight" onclick="openCustomerEdit(${id})">سایر مشخصات</button>'
    '<button class="btnlight" onclick="closeModal()">بستن</button></div>`)}'
    'async function saveCustomerPrices(id){try{await req(\'/api/customers/edit\',{method:\'POST\',headers:{\'Content-Type\':\'application/json\'},'
    'body:JSON.stringify({id,visible_price_groups:readPriceGroups(\'ep\')})});closeModal();toast(\'دسترسی قیمت ذخیره شد\');await refresh()}'
    'catch(e){alert(e.message)}}'
    'function openCustomerEdit(id){let c=customerById(id),parent=marketerParent(c),marketers=marketerList().filter(x=>x.id!==id);'
    'modal(`<h3>ویرایش مشتری</h3>'
    '<div class="mutedbox" style="margin-bottom:8px"><div class="small" style="font-weight:700">قیمت‌های قابل مشاهده در پرتال</div>'
    '${priceGroupChecks(\'ep\',customerPriceGroups(c))}</div>'
)

BOTTOM_OLD = (
    '</textarea><div class="mutedbox" style="margin-top:8px"><!-- GP_CUSTOMER_PRICE_ACCESS_20261025 -->'
    '<div class="small" style="font-weight:700">قیمت‌های قابل مشاهده در پرتال</div>'
    '${priceGroupChecks(\'ep\',customerPriceGroups(c))}</div>'
    '<div class="toolbar" style="margin-top:8px"><button onclick="saveCustomer(${id})">ذخیره</button>'
)
BOTTOM_NEW = '</textarea><div class="toolbar" style="margin-top:8px"><button onclick="saveCustomer(${id})">ذخیره</button>'


def _once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'STOP: {label} matched {count} times')
    return text.replace(old, new, 1)


def patch_app_html(text: str) -> str:
    if MARKER in text:
        raise RuntimeError('STOP: edit-v2 marker already present')
    if 'function customerPriceGroups(c)' not in text:
        raise RuntimeError('STOP: price-access helpers missing; deploy v1 first')
    text = _once(text, ROW_OLD, ROW_NEW, 'customer row price edit')
    text = _once(text, MODAL_OLD, MODAL_NEW, 'price-only editor')
    text = _once(text, BOTTOM_OLD, BOTTOM_NEW, 'move edit prices to top')
    if text.count(MARKER) != 1:
        raise RuntimeError('STOP: unexpected v2 marker count')
    if 'openCustomerPriceEdit' not in text or 'saveCustomerPrices' not in text:
        raise RuntimeError('STOP: price-only editor missing after patch')
    return text
