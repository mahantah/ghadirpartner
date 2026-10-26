#!/usr/bin/env python3
"""Insert /api/order/exchange route into live warehouse PHP when missing."""
from pathlib import Path

MARKER = 'GP_ORDER_RETURN_EXCHANGE_V1_20261026'
ROUTE = f"""/* {MARKER} */
if($p==='/api/order/exchange'&&$m==='POST'){{
 require_once __DIR__.'/order-return-exchange.php'; /* /lib/order-return-exchange.php */
 $u=auth(['prep']);$x=input();
 out(db(true,function(&$s)use($x,$u){{return ghadir_order_return_exchange($s,$x,$u);}}));
}}
"""


def patch_warehouse_php(text: str) -> str:
    if MARKER in text:
        return text
    if '/api/order/exchange' in text:
        raise RuntimeError('STOP: exchange route exists without marker')
    anchor = text.find("/api/order/return")
    if anchor < 0:
        raise RuntimeError('STOP: /api/order/return anchor missing in warehouse PHP')
    for next_route in (
        "if($p==='/api/warehouse/stock-summary'",
        "if($p==='/api/warehouse/import'",
        "if($p==='/api/warehouse/carton/delete'",
    ):
        at = text.find(next_route, anchor)
        if at > anchor:
            return text[:at] + ROUTE + text[at:]
    end = text.find('}));}', anchor)
    if end < 0:
        raise RuntimeError('STOP: could not locate end of return route block')
    return text[: end + 5] + '\n' + ROUTE + text[end + 5 :]


def index_php_needs_patch(text: str) -> bool:
    if MARKER in text or '/api/order/exchange' in text:
        return False
    return "if($p==='/api/order/return'" in text


def patch_index_php(text: str) -> str:
    if not index_php_needs_patch(text):
        return text
    if '/api/order/exchange' in text and 'order-return-exchange.php' in text:
        return text
    needle = "require_once __DIR__.'/lib/storage.php';"
    if needle not in text:
        raise RuntimeError('STOP: storage require anchor missing in index.php')
    extra = (
        "\nrequire_once __DIR__.'/lib/order-return-exchange.php';"
        f" /* {MARKER} helper */\n"
    )
    if "order-return-exchange.php" not in text:
        text = text.replace(needle, needle + extra, 1)
    anchor = text.find("if($p==='/api/order/exchange'")
    if anchor >= 0:
        return text
    ret = text.find("if($p==='/api/order/return'")
    if ret < 0:
        raise RuntimeError('STOP: order return route missing in index.php')
    end = text.find('}));}', ret)
    if end < 0:
        raise RuntimeError('STOP: return route end not found in index.php')
    route = (
        f"\nif($p==='/api/order/exchange'&&$m==='POST'){{$u=auth(['prep']);$x=input();"
        "out(db(true,function(&$s)use($x,$u){return ghadir_order_return_exchange($s,$x,$u);}));}}\n"
    )
    return text[: end + 5] + route + text[end + 5 :]


def patch_app_html(text: str) -> str:
    marker_comment = f'<!-- {MARKER} -->'
    if marker_comment in text:
        raise RuntimeError('STOP: exchange overlay already linked')
    if 'order-return-exchange-v1.js' in text:
        raise RuntimeError('STOP: exchange script already present')
    anchor = 'portal-orders-polish-v4.js?v=1'
    if anchor not in text:
        raise RuntimeError('STOP: portal orders polish v4 anchor missing')
    tag = (
        f'{marker_comment}'
        '<link rel="stylesheet" href="/assets/order-return-exchange-v1.css?v=1">'
        '<script src="/assets/order-return-exchange-v1.js?v=1"></script>\n'
    )
    idx = text.index(anchor)
    line_end = text.find('</script>', idx)
    if line_end < 0:
        raise RuntimeError('STOP: polish script tag malformed')
    line_end += len('</script>')
    return text[:line_end] + '\n' + tag + text[line_end:]
