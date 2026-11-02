#!/usr/bin/env python3
"""Replace only the eNamad assets referenced in assembled production login HTML."""
from __future__ import annotations
import re
import sys
from pathlib import Path

class EnamadV2Patch:
    """Preserve the live app while refreshing its trust seal assets."""

    def apply(self, source: str) -> str:
        """Patch only seal asset references after validating login controls.

        Args:
            source: Existing production app.html.

        Returns:
            Patched HTML; raises ValueError on unexpected document drift.
        """
        for anchor in ('id="login"', 'id="lu"', 'id="lp"', 'id="loginbtn"'):
            if anchor not in source:
                raise ValueError("Missing login anchor: " + anchor)
        if source.count("</body>") < 1 or source.count("</head>") < 1:
            raise ValueError("Missing document boundaries")
        css_url = "/assets/login-enamad-v2.css?v=20261102b"
        js_url = "/assets/login-enamad-v2.js?v=20261102b"
        if css_url in source and js_url in source:
            return source
        if css_url in source or js_url in source:
            raise ValueError("Partial eNamad v2 patch")
        result = re.sub(r'<link\b[^>]*href="/assets/login-enamad-v1\.css\?[^"]*"[^>]*>\s*', '', source)
        result = re.sub(r'<script\b[^>]*src="/assets/login-enamad-v1\.js\?[^"]*"[^>]*></script>\s*', '', result)
        head = result.rfind("</head>")
        result = result[:head] + f'<link rel="stylesheet" href="{css_url}">\n' + result[head:]
        body = result.rfind("</body>")
        result = result[:body] + f'<script src="{js_url}" defer></script>\n' + result[body:]
        if result.count(css_url) != 1 or result.count(js_url) != 1:
            raise ValueError("Seal asset references were not unique")
        return result

def main() -> None:
    """Patch the supplied HTML file without touching unrelated content."""
    if len(sys.argv) != 2:
        raise SystemExit("Usage: patch-login-enamad-v2.py file.html")
    path = Path(sys.argv[1])
    path.write_text(EnamadV2Patch().apply(path.read_text(encoding="utf-8")), encoding="utf-8")

if __name__ == "__main__":
    main()
