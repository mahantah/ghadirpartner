#!/usr/bin/env python3
"""Patch only the reviewed private production page to use compact warehouse reads."""

import argparse
import hashlib
import json
from pathlib import Path


class WarehouseReadPatcher:
    """Preserve unrelated live code and fail closed when the source changes."""

    def __init__(self, policy: Path) -> None:
        """Load the expected source hash from the release policy."""
        self.policy: dict[str, str] = json.loads(policy.read_text())

    @staticmethod
    def replace(source: str, before: str, after: str) -> str:
        """Replace one verified anchor and reject ambiguous source text."""
        if source.count(before) != 1:
            raise ValueError(f"Missing or repeated anchor: {before[:70]}")
        return source.replace(before, after, 1)

    def patch(self, root: Path) -> None:
        """Update the source only after all anchors and its identity pass."""
        path = root / "app.html"
        if hashlib.sha256(path.read_bytes()).hexdigest() != self.policy["app_sha256"]:
            raise ValueError("Production app source changed")
        source = path.read_text()
        source = self.replace(
            source,
            "WH=await req('/api/warehouse');",
            "WH=await req('/api/warehouse/compact');",
        )
        start = source.index(" let shelf={1:{n:0,by:{}},")
        end = source.index(" $('shelfSummary').innerHTML=", start)
        source = (
            source[:start]
            + " let shelf=WH.shelves,stats=new Map((WH.carton_stats||[]).map(st=>[Number(st.id),st]));\n"
            + source[end:]
        )
        source = self.replace(
            source,
            "let inv=WH.inventory||[],cartons=WH.cartons||[]",
            "let cartons=WH.cartons||[]",
        )
        source = self.replace(
            source,
            "let st=stats.get(Number(c.id))||{items:[],freeItems:[]},items=st.items,freeItems=st.freeItems,free=freeItems.length,used=items.length-free,levels=[...new Set(freeItems.map(x=>x.shelf_level).filter(Boolean))]",
            "let st=stats.get(Number(c.id))||{total:0,free:0,levels:[]},free=st.free,used=st.total-free,levels=st.levels",
        )
        source = self.replace(
            source,
            "let free=(WH.inventory||[]).filter(x=>x.carton_id===id&&!x.order_id).length,options=",
            "let free=(WH.carton_stats||[]).find(x=>Number(x.id)===Number(id))?.free||0,options=",
        )
        source = self.replace(
            source,
            "function openWarehouseSerials(id){",
            "function gpOpenWarehouseSerialsLoaded(id){",
        )
        anchor = "async function deleteWarehouseSerial(cartonId,serial)"
        wrapper = """let GP_WH_DETAIL_SEQ=0;
/** Fetch only this carton's serial page; closing or replacing the modal cancels rendering. */
async function openWarehouseSerials(id){
 const seq=++GP_WH_DETAIL_SEQ;
 modal('<div class="card small">در حال دریافت سریال‌های کارتن…</div>');
 $('modalbody').dataset.warehouseDetail=String(seq);
 try{
  let rows=[],page=1,total=0;
  do{
   const data=await req('/api/inventory/page?carton_id='+encodeURIComponent(id)+'&page='+page);
   if(seq!==GP_WH_DETAIL_SEQ||$('modal').classList.contains('hidden')||$('modalbody').dataset.warehouseDetail!==String(seq))return;
   if(!Array.isArray(data.rows)||!Number.isInteger(data.total)||data.total<0||!Number.isInteger(data.limit)||data.limit<1)throw new Error('پاسخ انبار نامعتبر است');
   rows.push(...data.rows);total=data.total;page++;
   if(!data.rows.length&&rows.length<total)throw new Error('دریافت سریال‌های کارتن کامل نشد');
  }while(rows.length<total);
  WH.inventory=rows;
  gpOpenWarehouseSerialsLoaded(id);
 }catch(error){
  if(seq===GP_WH_DETAIL_SEQ&&!$('modal').classList.contains('hidden')&&$('modalbody').dataset.warehouseDetail===String(seq))modal('<div class="card small">'+esc(error.message||error)+'</div><button class="btnlight" onclick="closeModal()">بستن</button>');
 }
}
"""
        source = self.replace(source, anchor, wrapper + anchor)
        source = self.replace(
            source,
            "const inventory=(state&&state.inventory)||((typeof INV!=='undefined'&&Array.isArray(INV))?INV:[]);",
            "const inventory=(state&&state.supplier_hints)||(state&&state.inventory)||((typeof INV!=='undefined'&&Array.isArray(INV))?INV:[]);",
        )
        path.write_text(source)


def main() -> None:
    """Apply the explicitly requested private production patch."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path)
    parser.add_argument(
        "--policy",
        type=Path,
        default=Path(__file__).resolve().parents[1]
        / "config/warehouse-indexed-reads-release.json",
    )
    args = parser.parse_args()
    WarehouseReadPatcher(args.policy).patch(args.root)


if __name__ == "__main__":
    main()
