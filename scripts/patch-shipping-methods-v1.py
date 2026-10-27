#!/usr/bin/env python3
"""Add shipping fields to the canonical build without changing dispatch logic."""

from __future__ import annotations

import json
import sys
from pathlib import Path


class ShippingPatch:
    """Apply guarded, repeatable shipping changes to an assembled production tree."""

    MARKER = "GP_SHIPPING_METHODS_V1_20261027"

    def __init__(self, root: Path, config: Path) -> None:
        """Load and validate the deliberately small YAML shipping configuration."""
        self.root = root
        values: dict[str, list[str]] = {}
        key = ""
        for line in config.read_text(encoding="utf-8").splitlines():
            if line.startswith("  - "):
                values[key].append(line[4:])
            elif line.endswith(":"):
                key = line[:-1]
                values[key] = []
            elif line.startswith("courier_method: "):
                values["courier_method"] = [line.split(": ", 1)[1]]
            else:
                raise ValueError("Unsupported shipping YAML syntax")
        if set(values) != {"methods", "tracking_methods", "courier_method"}:
            raise ValueError("Missing or unknown shipping configuration")
        self.methods = values["methods"]
        self.tracking = values["tracking_methods"]
        self.courier = values["courier_method"][0]
        if (
            len(set(self.methods)) != len(self.methods)
            or not self.tracking
            or not set(self.tracking).issubset(self.methods)
            or self.courier not in self.methods
            or any(
                not value or any(c in value for c in "'<>\\\"")
                for group in values.values()
                for value in group
            )
        ):
            raise ValueError("Invalid shipping methods")

    @staticmethod
    def replace(source: str, old: str, new: str, count: int = 1) -> str:
        """Reject unexpected source rather than silently producing a partial patch."""
        if source.count(old) != count:
            raise ValueError(f"Expected {count} shipping anchors: {old[:90]}")
        return source.replace(old, new)

    @staticmethod
    def array(values: list[str]) -> str:
        """Encode the shared string array for both PHP and JavaScript."""
        return "[" + ",".join("'" + value + "'" for value in values) + "]"

    def apply(self) -> None:
        """Validate all anchors before writing the backend and frontend together."""
        html_path, php_path = self.root / "app.html", self.root / "index.php"
        html, php = html_path.read_text(), php_path.read_text()
        if self.MARKER in html and self.MARKER in php:
            return
        if self.MARKER in html or self.MARKER in php:
            raise ValueError("Incomplete shipping patch")
        html = self.replace(
            html,
            "['چاپار','تیپاکس','پیک','حضوری','کالارسان','کاراپست']",
            self.array(self.methods),
        )
        html = self.replace(
            html,
            "<option>کاراپست</option>",
            "<option>کاراپست</option><option>ماهکس</option><option>ترمینال</option>",
        )
        html = self.replace(
            html,
            "needs=['تیپاکس','چاپار'].includes(carrier)",
            "needs=" + self.array(self.tracking) + ".includes(carrier)",
        )
        html = self.replace(
            html,
            "$('trackingWrap')?.classList.toggle('hidden',!needs)",
            "$('trackingWrap')?.classList.toggle('hidden',!needs);$('courierWrap')?.classList.toggle('hidden',carrier!=="
            + json.dumps(self.courier, ensure_ascii=False)
            + ")",
        )
        html = self.replace(
            html, "کد مرسوله تیپاکس / چاپار", "کد پیگیری تیپاکس / چاپار / ماهکس"
        )
        html = self.replace(
            html, "برای تیپاکس و چاپار هنگام", "برای تیپاکس، چاپار و ماهکس هنگام"
        )
        fields = """<div id="courierWrap" class="hidden" style="margin-top:8px"><label for="courierName">نام پیک</label><input id="courierName" autocomplete="name" maxlength="120" value="${esc(o.courier_name||'')}"><label for="courierPhone">شماره تماس پیک</label><input id="courierPhone" type="tel" dir="ltr" autocomplete="tel" maxlength="32" value="${esc(o.courier_phone||'')}"></div>"""
        html = self.replace(
            html,
            '</small></div></div><div id="cancelSelectWrap"',
            "</small></div>" + fields + '</div><div id="cancelSelectWrap"',
        )
        html = self.replace(
            html,
            "cancel_reason:cr,cancel_note:cn",
            "courier_name:isCancel?'':($('courierName')?.value.trim()||''),courier_phone:isCancel?'':($('courierPhone')?.value.trim()||''),cancel_reason:cr,cancel_note:cn",
        )
        php = self.replace(php, "['تیپاکس','چاپار']", self.array(self.tracking), 3)
        php = self.replace(
            php,
            "برای ارسال با تیپاکس یا چاپار، کد مرسوله الزامی است",
            "برای ارسال با تیپاکس، چاپار یا ماهکس، کد پیگیری الزامی است",
        )
        php = self.replace(
            php,
            "ثبت کد مرسوله برای تیپاکس یا چاپار فعال است",
            "ثبت کد مرسوله برای تیپاکس، چاپار یا ماهکس فعال است",
        )
        anchor = "   if($new==='ارسال شد'&&$shipping==='')fail('نوع ارسال الزامی است');"
        validation = """
   $courierName=trim((string)($x['courier_name']??($o['courier_name']??'')));
   $courierPhone=trim((string)($x['courier_phone']??($o['courier_phone']??'')));
   if(strlen($courierName)>480||strlen($courierPhone)>128)fail('مشخصات پیک بیش از حد طولانی است');
   if($new==='ارسال شد'&&$shipping==='پیک'&&($courierName===''||$courierPhone===''))fail('نام و شماره تماس پیک الزامی است');
"""
        php = self.replace(php, anchor, anchor + validation)
        php = self.replace(
            php,
            "'shipping_type'=>$shipping,'tracking_code'=>$tracking]",
            "'shipping_type'=>$shipping,'tracking_code'=>$tracking,'courier_name'=>$shipping==='پیک'?$courierName:'','courier_phone'=>$shipping==='پیک'?$courierPhone:'']",
            2,
        )
        php = self.replace(
            php,
            "   if($shipping!=='')$o['shipping_type']=$shipping;",
            "   if($shipping!=='')$o['shipping_type']=$shipping;\n   if($shipping==='پیک'){$o['courier_name']=$courierName;$o['courier_phone']=$courierPhone;}",
        )
        html_path.write_text(html + "\n<!-- " + self.MARKER + " -->\n")
        php_path.write_text(php.replace("<?php", "<?php\n/* " + self.MARKER + " */", 1))


if __name__ == "__main__":
    ShippingPatch(
        Path(sys.argv[1]),
        Path(__file__).resolve().parents[1] / "config/shipping-methods.yaml",
    ).apply()
