#!/usr/bin/env python3
"""Inject the official eNamad seal into the *live* Ghadir Partner login page.

Changes only references to isolated assets in the current production app.html;
does not replace the login markup, handlers, OTP, sessions or databases.
"""
from __future__ import annotations

from pathlib import Path
import sys

MARKER = "GP_LOGIN_ENAMAD_SEAL_V1_20261102"
CSS = "/assets/login-enamad-v1.css?v=20261102a"
JS = "/assets/login-enamad-v1.js?v=20261102a"


class LoginEnamadPatch:
    """Idempotent, fail-closed patch for the current assembled app HTML."""

    def apply(self, html: str) -> str:
        """Insert the two assets after validating the current login structure.

        Args:
            html: Current HTML downloaded from the production server.

        Returns:
            Patched HTML with CSS and JS references.
        """
        if MARKER in html:
            if html.count(MARKER) == 1 and html.count(CSS) == 1 and html.count(JS) == 1:
                return html
            raise ValueError("Partial login eNamad installation")
        if html.count('id="login"') != 1:
            raise ValueError("Expected exactly one login container")
        for control in ('id="lu"', 'id="lp"', 'id="loginbtn"'):
            if control not in html:
                raise ValueError("Expected credential control missing: " + control)
        # The live compiled page contains HTML snippets inside scripts and
        # templates, so closing tag strings may occur more than once. Only
        # the last real document boundaries are safe insertion points.
        head_at = html.rfind("</head>")
        body_at = html.rfind("</body>")
        if head_at < 0 or body_at < 0 or head_at >= body_at:
            raise ValueError("Production HTML document boundary missing")
        result = html[:body_at] + f'<script src="{JS}" defer></script>\n' + html[body_at:]
        head_at = result.rfind("</head>")
        result = result[:head_at] + f'<!-- {MARKER} -->\n<link rel="stylesheet" href="{CSS}">\n' + result[head_at:]
        return result


def main() -> None:
    """Patch a supplied on-disk production HTML file."""
    if len(sys.argv) != 2:
        raise SystemExit("Usage: patch-login-enamad-v1.py path/to/app.html")
    path = Path(sys.argv[1])
    before = path.read_text(encoding="utf-8")
    after = LoginEnamadPatch().apply(before)
    path.write_text(after, encoding="utf-8")


if __name__ == "__main__":
    main()
