"""Patch inline smart-list MutationObserver in production app.html (page freeze)."""

SMART_REFRESH_OLD = (
    "function refresh(){document.querySelectorAll('.tablewrap,.price-table-wrap,.admin-price-wrap')"
    ".forEach(w=>{if(w.dataset.smartList==='1'&&!w.querySelector('table')){w.dataset.smartList='';"
    "if(w._smartTool){w._smartTool.remove();w._smartTool=null}}installOne(w);if(w._smartTool)apply(w)})}"
)

SMART_REFRESH_NEW = (
    "let smartListBusy=0;function refresh(){if(smartListBusy)return;smartListBusy=1;try{"
    "document.querySelectorAll('.tablewrap,.price-table-wrap,.admin-price-wrap').forEach(w=>{"
    "if(w.dataset.smartList==='1'&&!w.querySelector('table')){w.dataset.smartList='';"
    "if(w._smartTool){w._smartTool.remove();w._smartTool=null}}installOne(w);if(w._smartTool)apply(w)})}"
    "finally{smartListBusy=0}}"
)

SMART_OBS_OLD = (
    "const smartRoot=document.querySelector('.wrap')||document.body;new MutationObserver(muts=>{"
    "let useful=muts.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&"
    "(n.matches?.('table,.tablewrap,tbody,tr')||n.querySelector?.('table,.tablewrap'))));"
    "if(!useful)return;clearTimeout(timer);timer=setTimeout(refresh,450)}).observe(smartRoot,"
    "{subtree:true,childList:true});"
)

SMART_OBS_NEW = (
    "const smartRoot=document.querySelector('.wrap')||document.body;new MutationObserver(muts=>{"
    "if(smartListBusy)return;let useful=muts.some(m=>m.type==='childList'&&[...m.addedNodes].some("
    "n=>n.nodeType===1&&!(n.classList&&n.classList.contains('smart-list-tools'))&&"
    "(n.matches?.('table,.tablewrap,tbody')||n.querySelector?.('table,.tablewrap'))));"
    "if(!useful)return;clearTimeout(timer);timer=setTimeout(refresh,700)}).observe(smartRoot,"
    "{subtree:true,childList:true});"
)

MARKER = 'GP_SMART_LIST_PERF_HOTFIX_V1_20261026'

BOOT_HEAD_OLD = (
    "async function boot(){\n let core;try{core=await req('/api/bootstrap')}catch(e){return}\n applyBootstrapData(core);"
)
BOOT_HEAD_NEW = (
    "async function boot(){\n window.__gpBusy=true;\n let core;try{core=await req('/api/bootstrap')}"
    "catch(e){window.__gpBusy=false;return}\n try{\n applyBootstrapData(core);"
)
BOOT_TAIL_OLD = (
    "if(!window.GP_NOTIF_TIMER)window.GP_NOTIF_TIMER=setInterval(()=>"
    "{if(document.visibilityState==='visible')pollNotif()},30000);\n}"
)
BOOT_TAIL_NEW = (
    "if(!window.GP_NOTIF_TIMER)window.GP_NOTIF_TIMER=setInterval(()=>"
    "{if(document.visibilityState==='visible')pollNotif()},30000);\n}finally{window.__gpBusy=false;}\n}"
)


def patch_boot_busy_html(text: str) -> str:
    if 'window.__gpBusy=true;\n let core;try{core=await req' in text:
        return text
    if BOOT_HEAD_OLD not in text:
        raise RuntimeError('STOP: boot busy head anchor missing')
    if BOOT_TAIL_OLD not in text:
        raise RuntimeError('STOP: boot busy tail anchor missing')
    text = text.replace(BOOT_HEAD_OLD, BOOT_HEAD_NEW, 1)
    text = text.replace(BOOT_TAIL_OLD, BOOT_TAIL_NEW, 1)
    return text


def patch_smart_list_html(text: str) -> str:
    if MARKER in text:
        raise RuntimeError('STOP: smart-list perf hotfix already applied')
    if SMART_REFRESH_OLD not in text:
        raise RuntimeError('STOP: smart-list refresh anchor missing')
    if SMART_OBS_OLD not in text:
        raise RuntimeError('STOP: smart-list observer anchor missing')
    text = text.replace(SMART_REFRESH_OLD, SMART_REFRESH_NEW, 1)
    text = text.replace(SMART_OBS_OLD, SMART_OBS_NEW, 1)
    anchor = "window.refreshSmartListTools=refresh;"
    idx = text.find(anchor)
    if idx < 0:
        raise RuntimeError('STOP: refreshSmartListTools anchor missing')
    note = f'/* {MARKER} */\n'
    if note not in text:
        line_start = text.rfind('\n', 0, idx) + 1
        text = text[:line_start] + note + text[line_start:]
    return patch_boot_busy_html(text)
