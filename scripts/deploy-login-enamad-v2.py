"""Safely publish only the approved login seal assets and live HTML references."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import cast
from urllib.error import URLError
from urllib.request import Request, urlopen


@dataclass(frozen=True)
class ReleasePaths:
    """Versioned public paths that prevent changes to the currently loaded v2."""

    css_remote: str
    js_remote: str
    site_url: str

    @classmethod
    def load(cls, path: Path) -> ReleasePaths:
        """Read validated release destinations from the shared seal YAML.

        Args:
            path: JSON-subset YAML configuration.

        Returns:
            Exact remote asset paths and public verification URL.
        """
        raw: object = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            raise TypeError("Release config must be an object")
        config = cast(dict[str, object], raw)
        css, js, site = (
            config.get("css_asset_url"),
            config.get("js_asset_url"),
            config.get("site_url"),
        )
        if not all(isinstance(value, str) for value in (css, js, site)):
            raise TypeError("Release destinations must be strings")
        css_path = cast(str, css).split("?", 1)[0]
        js_path = cast(str, js).split("?", 1)[0]
        if (
            re.fullmatch(r"/assets/login-enamad-v2-\d{8}\.css", css_path) is None
            or re.fullmatch(r"/assets/login-enamad-v2-\d{8}\.js", js_path) is None
            or site != "https://ghadirpartner.ir/app.html"
        ):
            raise ValueError("Unexpected Enamad production destinations")
        return cls(css_path, js_path, site)


class FtpsClient:
    """Run isolated, authenticated FTPS operations without logging secrets."""

    def __init__(self, host: str, username: str, password: str) -> None:
        """Validate the restricted production deployment identity."""
        if not host or username.casefold() != "deploy@ghadirpartner.ir" or not password:
            raise ValueError("STOP: production FTPS identity is unavailable")
        self.host = host
        self.username = username
        self.password = password

    @staticmethod
    def quote(value: str | Path) -> str:
        """Protect file paths and credentials from the lftp command parser."""
        return '"' + str(value).replace("\\", "\\\\").replace('"', '\\"') + '"'

    def run(self, commands: list[str], directory: Path) -> None:
        """Execute a short FTPS batch with strict TLS and failure handling.

        Args:
            commands: lftp operations for the production host.
            directory: Private temporary workspace for the command script.
        """
        private = directory / "private-lftp-script"
        private.write_text(
            "\n".join(
                [
                    "set cmd:fail-exit yes",
                    "set ftp:ssl-force true",
                    "set ftp:ssl-protect-data true",
                    "set ssl:verify-certificate yes",
                    "set net:max-retries 2",
                    "open -p 21 " + self.quote(self.host),
                    "user "
                    + self.quote(self.username)
                    + " "
                    + self.quote(self.password),
                    *commands,
                    "bye",
                ]
            )
            + "\n",
            encoding="utf-8",
        )
        private.chmod(0o600)
        try:
            subprocess.run(["lftp", "-f", str(private)], check=True, timeout=180)
        finally:
            private.unlink(missing_ok=True)


class EnamadRelease:
    """Facade for a reversible login-only deployment."""

    def __init__(self, client: FtpsClient, paths: ReleasePaths, root: Path) -> None:
        """Inject the authenticated FTP client, URLs and checked-out source."""
        self.client = client
        self.paths = paths
        self.root = root

    def health(self) -> None:
        """Abort before any write when the public application health check fails."""
        health_url = self.paths.site_url.removesuffix("/app.html") + "/healthz"
        request = Request(health_url, headers={"Cache-Control": "no-cache"})
        with urlopen(request, timeout=30) as response:
            if response.status != 200:
                raise RuntimeError("STOP: production health check failed")

    def verify_public(self) -> None:
        """Confirm visitors receive both versioned references after publication."""
        expected = (
            self.paths.css_remote + "?v=1",
            self.paths.js_remote + "?v=1",
            "data-enamad-trust-url=",
        )
        for attempt in range(3):
            try:
                request = Request(
                    self.paths.site_url
                    + "?seal-release="
                    + os.environ.get("GITHUB_RUN_ID", "verify"),
                    headers={"Cache-Control": "no-cache"},
                )
                with urlopen(request, timeout=30) as response:
                    page = response.read().decode("utf-8")
                if all(text in page for text in expected):
                    return
            except (OSError, UnicodeError, URLError):
                pass
            if attempt < 2:
                time.sleep(2)
        raise RuntimeError("Public HTML did not expose the approved Enamad assets")

    def rollback_if_needed(
        self, directory: Path, original: bytes, updated: bytes
    ) -> None:
        """Restore the old HTML only if it is still the exact version we wrote."""
        current = directory / "app-after-error"
        try:
            self.client.run(
                [f"get /app.html -o {self.client.quote(current)}"], directory
            )
            if current.read_bytes() == original:
                return
            if current.read_bytes() != updated:
                raise RuntimeError("STOP: live HTML changed; manual recovery required")
            restore_stage = "/app.html.enamad-rollback-" + os.environ["GITHUB_RUN_ID"]
            original_file = directory / "app-original"
            self.client.run(
                [
                    f"put {self.client.quote(original_file)} -o {restore_stage}",
                    f"mv {restore_stage} /app.html",
                ],
                directory,
            )
            print("ROLLBACK: original production app.html restored")
        except Exception as error:
            raise RuntimeError("CRITICAL: rollback needs operator review") from error

    def deploy(self) -> None:
        """Back up live HTML, stage isolated assets and atomically swap references."""
        self.health()
        run_id = os.environ.get("GITHUB_RUN_ID", "")
        if not run_id.isdigit():
            raise ValueError("A GitHub Actions run identifier is required")
        local_assets = (
            (self.root / "assets/login-enamad-v2.css", self.paths.css_remote),
            (self.root / "assets/login-enamad-v2.js", self.paths.js_remote),
        )
        for local, _ in local_assets:
            if not local.is_file():
                raise FileNotFoundError(local)
        with tempfile.TemporaryDirectory(prefix="ghadir-enamad-release-") as name:
            temp = Path(name)
            before = temp / "app-original"
            self.client.run([f"get /app.html -o {self.client.quote(before)}"], temp)
            original = before.read_bytes()
            after = temp / "app-patched"
            after.write_bytes(original)
            subprocess.run(
                [
                    sys.executable,
                    str(self.root / "scripts/patch-login-enamad-v2.py"),
                    str(after),
                ],
                check=True,
                timeout=30,
            )
            updated = after.read_bytes()
            backup_dir = f"/storage/Backups/release-snapshots/LOGIN_ENAMAD_{run_id}"
            self.client.run(
                [
                    f"mkdir -p {backup_dir}",
                    f"put {self.client.quote(before)} -o {backup_dir}/app.html",
                ],
                temp,
            )
            for local, remote in local_assets:
                readback = temp / ("verified-" + local.name)
                self.client.run(
                    [
                        f"put {self.client.quote(local)} -o {remote}",
                        f"get {remote} -o {self.client.quote(readback)}",
                    ],
                    temp,
                )
                if readback.read_bytes() != local.read_bytes():
                    raise RuntimeError("STOP: staged Enamad asset differs from source")
            drift = temp / "app-before-swap"
            self.client.run([f"get /app.html -o {self.client.quote(drift)}"], temp)
            if drift.read_bytes() != original:
                raise RuntimeError("STOP: production HTML changed during release")
            if updated == original:
                self.verify_public()
                print("SUCCESS: Enamad login seal was already current")
                return
            stage = f"/app.html.enamad-stage-{run_id}"
            try:
                self.client.run(
                    [
                        f"put {self.client.quote(after)} -o {stage}",
                        f"mv {stage} /app.html",
                    ],
                    temp,
                )
                readback_html = temp / "app-verified"
                self.client.run(
                    [f"get /app.html -o {self.client.quote(readback_html)}"], temp
                )
                if readback_html.read_bytes() != updated:
                    raise RuntimeError("STOP: deployed HTML readback mismatch")
                self.verify_public()
                self.health()
            except Exception:
                self.rollback_if_needed(temp, original, updated)
                raise
        print("SUCCESS: compact Enamad seal deployed and public HTML verified")


def main() -> None:
    """Execute only the explicitly selected production release operation."""
    if sys.argv[1:] != ["deploy"]:
        raise SystemExit("Usage: deploy-login-enamad-v2.py deploy")
    root = Path(__file__).resolve().parents[1]
    config = ReleasePaths.load(root / "config/login-enamad.yaml")
    client = FtpsClient(
        os.environ.get("FTP_SERVER", ""),
        os.environ.get("FTP_USERNAME", ""),
        os.environ.get("FTP_PASSWORD", ""),
    )
    EnamadRelease(client, config, root).deploy()


if __name__ == "__main__":
    main()
