"""Stage and publish the phase-one portal changes using the configured FTPS account."""

from __future__ import annotations

import io
import json
import os
import re
import ssl
import subprocess
import sys
from ftplib import FTP_TLS, error_perm
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.error import HTTPError
from urllib.request import urlopen
from uuid import uuid4

from importlib import import_module

ROOT = Path(__file__).resolve().parents[1]


class PhaseOneRelease:
    """Publish dependencies first and restore previous entry points on verification failure."""

    def __init__(self, ftp: FTP_TLS, site: str) -> None:
        """Use a verified connection and the configured portal origin."""
        self.ftp = ftp
        self.site = site.rstrip("/")

    def read(self, path: str) -> bytes:
        """Read a deployment file without printing its content."""
        content = io.BytesIO()
        self.ftp.retrbinary("RETR /" + path, content.write)
        return content.getvalue()

    def publish(self, path: str, data: bytes) -> None:
        """Verify staging bytes before replacing a file by rename."""
        directory, _, _ = path.rpartition("/")
        staging = (
            (directory + "/" if directory else "") + ".phase-" + uuid4().hex + ".php"
        )
        try:
            # The staging suffix is executable, so HTML or JS is guarded while temporary.
            guarded = (
                data
                if data.startswith(b"<?php")
                else b"<?php http_response_code(404);exit;?>" + data
            )
            self.ftp.storbinary("STOR /" + staging, io.BytesIO(guarded))
            if self.read(staging) != guarded:
                raise RuntimeError("staging verification failed for " + path)
            if guarded != data:
                self.ftp.storbinary("STOR /" + staging, io.BytesIO(data))
            self.ftp.rename("/" + staging, "/" + path)
        finally:
            try:
                self.ftp.delete("/" + staging)
            except error_perm:
                pass

    def verify(self, staged: Path, sidebar_assets: tuple[str, ...]) -> None:
        """Check public asset bytes and require the private report routes to reject anonymous access."""
        app = (staged / "app.html").read_text()
        for asset in (
            "customer-purchase-report.js",
            "portal-messages.js",
            "portal-phase-two-navigation.js",
            "portal-phase-two.css",
            *sidebar_assets,
        ):
            match = re.search(
                r'["\x27](/assets/' + re.escape(asset) + r'[^"\x27]*)', app
            )
            if not match:
                raise RuntimeError("missing asset loader: " + asset)
            with urlopen(self.site + match[1], timeout=20) as response:
                if response.read() != (staged / "assets" / asset).read_bytes():
                    raise RuntimeError("public asset mismatch: " + asset)
        for route in (
            "/api/portal-messages/templates",
            "/api/reports/customer-purchases",
            "/api/portal-messages",
            "/partners/api/notifications/staff",
        ):
            try:
                with urlopen(self.site + route, timeout=20):
                    raise RuntimeError(
                        "private route accepted anonymous request: " + route
                    )
            except HTTPError as error:
                if error.code not in (401, 403):
                    raise

    def run(self, apply: bool) -> None:
        """Prepare and lint the exact live candidate, then apply when explicitly invoked."""
        module = import_module("stage-customer-purchase-report")
        stage = module.CustomerPurchaseReportStage
        sidebar_assets: tuple[str, ...] = stage.sidebar_assets
        entries = (
            *(f"assets/{name}" for name in sidebar_assets),
            "index.php",
            "app.html",
            "partners/index.php",
            "partners/privacy.html",
        )
        with TemporaryDirectory() as directory:
            work = Path(directory)
            source, staged = work / "source", work / "staged"
            (source / "partners").mkdir(parents=True)
            originals = {path: self.read(path) for path in entries}
            for path, data in originals.items():
                (source / path).parent.mkdir(parents=True, exist_ok=True)
                (source / path).write_bytes(data)
            stage(ROOT).stage(source, staged, source / "partners/index.php")
            privacy = (source / "partners/privacy.html").read_text()
            note = "<p>در عضویت، کد ملی برای بررسی هویت توسط مدیر و شماره همراه برای ارسال کد تأیید دریافت می‌شود. وضعیت خواندن پیام‌های داخل برنامه برای پیگیری پیام‌ها ثبت می‌شود.</p>"
            if note not in privacy:
                if privacy.count("</main>") != 1:
                    raise RuntimeError("privacy notice anchor mismatch")
                privacy = privacy.replace("</main>", note + "\n</main>", 1)
            (staged / "partners/privacy.html").write_text(privacy)
            for php_path in staged.rglob("*.php"):
                subprocess.run(
                    ["php", "-l", str(php_path)], check=True, capture_output=True
                )
            for name in sidebar_assets:
                subprocess.run(
                    ["node", "--check", str(staged / "assets" / name)], check=True
                )
            subprocess.run(
                ["node", str(ROOT / "tests/portal-sidebar.cjs"), str(staged)],
                check=True,
            )
            print("Live anchors and PHP syntax verified.")
            if not apply:
                return
            for path in entries:
                if self.read(path) != originals[path]:
                    raise RuntimeError(
                        "live entry point changed before publication: " + path
                    )
            for folder in ("/partners/lib",):
                try:
                    self.ftp.mkd(folder)
                except error_perm:
                    self.ftp.cwd(folder)
                    self.ftp.cwd("/")
            for file in sorted(staged.rglob("*")):
                if file.is_file():
                    path = file.relative_to(staged).as_posix()
                    if path not in entries:
                        self.publish(path, file.read_bytes())
            replaced = []
            try:
                for path in entries:
                    data = (staged / path).read_bytes()
                    self.publish(path, data)
                    replaced.append(path)
                    if self.read(path) != data:
                        raise RuntimeError("entry point verification failed: " + path)
                self.verify(staged, sidebar_assets)
            except Exception:
                for path in reversed(replaced):
                    self.publish(path, originals[path])
                raise
            print("Published and verified phase-one routes and assets.")


def main() -> None:
    """Run inspection or application using the existing production configuration."""
    if sys.argv[1:] not in (["inspect"], ["apply"]):
        raise SystemExit("Specify inspect or apply.")
    config = json.loads((ROOT / "config/portal-privacy-release.yaml").read_text())
    with FTP_TLS(
        context=ssl.create_default_context(), timeout=config["ftp_timeout"]
    ) as ftp:
        ftp.connect(config["ftp_host"], config["ftp_port"])
        ftp.login(os.environ["FTP_USERNAME"], os.environ["FTP_PASSWORD"])
        ftp.prot_p()
        site = config["portal_url"].rsplit("/partners/", 1)[0]
        PhaseOneRelease(ftp, site).run(sys.argv[1] == "apply")


if __name__ == "__main__":
    main()
