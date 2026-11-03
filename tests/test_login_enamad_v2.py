"""Regression checks for safe login seal references on assembled HTML."""

from __future__ import annotations

import unittest
from pathlib import Path
from runpy import run_path
from typing import ClassVar, Protocol, cast


class PatchFacade(Protocol):
    """The small production patch interface exercised by these tests."""

    def apply(self, source: str) -> str:
        """Return HTML with the seal references installed."""


class LoginEnamadPatchTests(unittest.TestCase):
    """Ensure asset injection does not alter credentials or duplicate tags."""

    patch: ClassVar[PatchFacade]

    @classmethod
    def setUpClass(cls) -> None:
        """Load the production patch without importing unrelated modules."""
        script = (
            Path(__file__).resolve().parents[1] / "scripts/patch-login-enamad-v2.py"
        )
        patch_class = cast(type[PatchFacade], run_path(str(script))["EnamadV2Patch"])
        cls.patch = patch_class()

    def fixture(self, version: str = "") -> str:
        """Build a sanitized login with optional previously installed seal assets."""
        css = (
            f'<link rel="stylesheet" href="/assets/login-enamad-{version}.css?v=old">'
            if version
            else ""
        )
        js = (
            f'<script src="/assets/login-enamad-{version}.js?v=old" defer></script>'
            if version
            else ""
        )
        return (
            f"<html><head>{css}</head><body>"
            '<div id="login"><div class="automation-login-card">'
            '<input id="lu"><input id="lp"><button id="loginbtn">ورود</button>'
            "</div></div>"
            "<script>function doLogin(){return 'UNCHANGED_AUTH';}</script>"
            f"{js}</body></html>"
        )

    def test_install_and_upgrade_are_idempotent(self) -> None:
        """An absent, v1 or v2 seal receives the current assets only once."""
        for version in ("", "v1", "v2"):
            with self.subTest(version=version):
                source = self.fixture(version)
                result = self.patch.apply(source)
                self.assertEqual(result, self.patch.apply(result))
                self.assertEqual(result.count("login-enamad-v2.css?v=20261103card"), 1)
                self.assertEqual(result.count("login-enamad-v2.js?v=20261103card"), 1)
                self.assertIn("data-enamad-trust-url=", result)
                self.assertIn("data-enamad-logo-url=", result)
                self.assertIn('data-enamad-desktop-width="64"', result)
                self.assertEqual(result.count("UNCHANGED_AUTH"), 1)
                self.assertIn('<input id="lu"><input id="lp">', result)
                self.assertEqual(result.count("login-enamad-v1."), 0)

    def test_partial_or_duplicate_installation_fails_closed(self) -> None:
        """Do not mutate unexpected or partially installed production HTML."""
        partial = self.fixture().replace(
            "</head>",
            '<link rel="stylesheet" href="/assets/login-enamad-v2.css?v=old"></head>',
        )
        duplicate = self.fixture("v2").replace(
            "</head>",
            '<link rel="stylesheet" href="/assets/login-enamad-v1.css?v=old"></head>',
        )
        for source in (partial, duplicate, "<html></html>"):
            with self.subTest(source=source[:70]), self.assertRaises(ValueError):
                self.patch.apply(source)


if __name__ == "__main__":
    unittest.main()
