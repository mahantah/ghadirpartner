"""Replace only the eNamad assets referenced in assembled production login HTML."""

from __future__ import annotations

import html
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import cast
from urllib.parse import parse_qs, urlparse


@dataclass(frozen=True)
class EnamadSettings:
    """Validated badge endpoints and responsive sizes."""

    trust_url: str
    logo_url: str
    desktop_width_px: int
    mobile_width_px: int

    @classmethod
    def load(cls, path: Path) -> EnamadSettings:
        """Read the JSON-subset YAML config, rejecting mismatched trust links.

        Args:
            path: Location of the deployment settings.

        Returns:
            Validated Enamad settings.
        """
        raw: object = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            raise TypeError("Enamad config must be a mapping")
        values = cast(dict[str, object], raw)
        if set(values) != {
            "trust_url",
            "logo_url",
            "desktop_width_px",
            "mobile_width_px",
        }:
            raise ValueError("Unexpected Enamad settings")
        trust, logo = values["trust_url"], values["logo_url"]
        desktop, mobile = values["desktop_width_px"], values["mobile_width_px"]
        if not isinstance(trust, str) or not isinstance(logo, str):
            raise TypeError("Enamad URLs must be strings")
        if (
            type(desktop) is not int
            or type(mobile) is not int
            or not 40 <= mobile <= desktop <= 80
        ):
            raise ValueError("Enamad image widths are invalid")
        trust_parts, logo_parts = urlparse(trust), urlparse(logo)
        for parsed in (trust_parts, logo_parts):
            if (
                parsed.scheme != "https"
                or parsed.netloc != "trustseal.enamad.ir"
                or parsed.fragment
            ):
                raise ValueError("Use only the official HTTPS Enamad endpoint")
        if trust_parts.path != "/" or logo_parts.path != "/logo.aspx":
            raise ValueError("Unexpected Enamad paths")
        trust_query = parse_qs(trust_parts.query, strict_parsing=True)
        logo_query = parse_qs(logo_parts.query, strict_parsing=True)
        if (
            set(trust_query) != {"id", "Code"}
            or trust_query != logo_query
            or len(trust_query["id"]) != 1
            or not trust_query["id"][0].isdigit()
            or len(trust_query["Code"]) != 1
            or not trust_query["Code"][0].isalnum()
        ):
            raise ValueError("Enamad trust link and image do not match")
        return cls(trust, logo, desktop, mobile)


class EnamadV2Patch:
    """Preserve the live app while refreshing its trust seal assets."""

    def __init__(self) -> None:
        """Load validated public seal settings from the repository."""
        config_path = Path(__file__).resolve().parents[1] / "config/login-enamad.yaml"
        self.settings = EnamadSettings.load(config_path)

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
        css_url = "/assets/login-enamad-v2.css?v=20261103card"
        js_url = "/assets/login-enamad-v2.js?v=20261103card"
        if css_url in source and js_url in source:
            if (
                source.count(css_url) != 1
                or source.count(js_url) != 1
                or source.count("data-enamad-trust-url=") != 1
                or source.count("data-enamad-logo-url=") != 1
            ):
                raise ValueError("Incomplete current Enamad integration")
            return source
        if css_url in source or js_url in source:
            raise ValueError("Partial eNamad v2 patch")
        result, old_css = re.subn(
            r'<link\b[^>]*href="/assets/login-enamad-v[12]\.css\?[^"]*"[^>]*>\s*',
            "",
            source,
        )
        result, old_js = re.subn(
            r'<script\b[^>]*src="/assets/login-enamad-v[12]\.js\?[^"]*"[^>]*></script>\s*',
            "",
            result,
        )
        if old_css != old_js or old_css > 1:
            raise ValueError("Unexpected number of existing eNamad references")
        head = result.rfind("</head>")
        result = (
            result[:head]
            + f'<link rel="stylesheet" href="{css_url}">\n'
            + result[head:]
        )
        body = result.rfind("</body>")
        data = self.settings
        script = (
            f'<script src="{js_url}" defer'
            f' data-enamad-trust-url="{html.escape(data.trust_url, quote=True)}"'
            f' data-enamad-logo-url="{html.escape(data.logo_url, quote=True)}"'
            f' data-enamad-desktop-width="{data.desktop_width_px}"'
            f' data-enamad-mobile-width="{data.mobile_width_px}"></script>\n'
        )
        result = result[:body] + script + result[body:]
        if result.count(css_url) != 1 or result.count(js_url) != 1:
            raise ValueError("Seal asset references were not unique")
        return result


def main() -> None:
    """Patch the supplied HTML file without touching unrelated content."""
    if len(sys.argv) != 2:
        raise SystemExit("Usage: patch-login-enamad-v2.py file.html")
    path = Path(sys.argv[1])
    path.write_text(
        EnamadV2Patch().apply(path.read_text(encoding="utf-8")), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
