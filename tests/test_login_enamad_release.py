"""Non-network tests for protected Enamad release configuration."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from runpy import run_path
from typing import ClassVar, Protocol, cast


class ReleaseConfigFacade(Protocol):
    """Typed interface to the production release configuration."""

    css_remote: str
    js_remote: str

    @classmethod
    def load(cls, path: Path) -> ReleaseConfigFacade:
        """Load a validated release configuration."""


class FtpsClientFacade(Protocol):
    """Typed interface to the production FTPS identity validation."""

    username: str

    def __init__(self, host: str, username: str, password: str) -> None:
        """Validate the configured FTP identity."""


class EnamadReleaseTests(unittest.TestCase):
    """Confirm production destinations cannot drift to unrelated files."""

    release_config: ClassVar[type[ReleaseConfigFacade]]
    ftps_client: ClassVar[type[FtpsClientFacade]]
    config: ClassVar[dict[str, object]]

    @classmethod
    def setUpClass(cls) -> None:
        """Load the code and public configuration without connecting to FTP."""
        root = Path(__file__).resolve().parents[1]
        module = run_path(str(root / "scripts/deploy-login-enamad-v2.py"))
        cls.release_config = cast(type[ReleaseConfigFacade], module["ReleasePaths"])
        cls.ftps_client = cast(type[FtpsClientFacade], module["FtpsClient"])
        cls.config = cast(
            dict[str, object],
            json.loads((root / "config/login-enamad.yaml").read_text(encoding="utf-8")),
        )

    def test_validated_paths(self) -> None:
        """Approved paths are isolated from the active v2 asset names."""
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "settings.yaml"
            path.write_text(json.dumps(self.config), encoding="utf-8")
            settings = self.release_config.load(path)
            self.assertEqual(
                settings.css_remote,
                "/assets/login-enamad-v2-20261103.css",
            )
            self.assertEqual(
                settings.js_remote,
                "/assets/login-enamad-v2-20261103.js",
            )

    def test_invalid_deployment_destinations_are_rejected(self) -> None:
        """Never allow badge publishing to overwrite the application itself."""
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "settings.yaml"
            for update in (
                {"css_asset_url": "/app.html"},
                {"js_asset_url": "/assets/login-enamad-v2.js?v=old"},
                {"site_url": "https://another-site.example/app.html"},
            ):
                with self.subTest(update=update), self.assertRaises(ValueError):
                    path.write_text(
                        json.dumps({**self.config, **update}),
                        encoding="utf-8",
                    )
                    self.release_config.load(path)

    def test_production_ftp_username_preserves_actual_case(self) -> None:
        """Accept cPanel account casing without rewriting the login identity."""
        account = "Deploy@ghadirpartner.ir"
        client = self.ftps_client("ftp.example.test", account, "fixture-not-a-secret")
        self.assertEqual(client.username, account)

    def test_non_deployment_ftp_accounts_are_rejected(self) -> None:
        """Do not broaden deployment access beyond the approved FTP account."""
        with self.assertRaises(ValueError):
            self.ftps_client("ftp.example.test", "admin@ghadirpartner.ir", "fixture")


if __name__ == "__main__":
    unittest.main()
