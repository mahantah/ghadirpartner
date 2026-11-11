"""Release reviewed production fixes without publishing private source files."""

from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import os
import re
import secrets
import shutil
import ssl
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from ftplib import FTP_TLS, error_perm
from pathlib import Path
from typing import Protocol, cast
from urllib.request import urlopen


def digest(data: bytes) -> str:
    """Return a stable source fingerprint without revealing its content."""
    return hashlib.sha256(data).hexdigest()


def mapping(value: object) -> dict[str, object]:
    """Validate a configuration mapping at the input boundary."""
    if not isinstance(value, dict) or not all(isinstance(k, str) for k in value):
        raise ValueError("invalid_configuration")
    return cast(dict[str, object], value)


def string(data: dict[str, object], key: str) -> str:
    """Require a nonempty configuration string."""
    value = data.get(key)
    if not isinstance(value, str) or not value:
        raise ValueError("invalid_configuration_string")
    return value


def integer(data: dict[str, object], key: str, minimum: int = 1) -> int:
    """Require a bounded, non-boolean configuration integer."""
    value = data.get(key)
    if type(value) is not int or not minimum <= value <= 1000000:
        raise ValueError("invalid_configuration_integer")
    return value


class PortalR521Payload:
    """Assemble the app's reviewed assets and the compiled web presentation."""

    def __init__(self, project: Path) -> None:
        """Read only the new, versioned presentation sources."""
        self.project = project

    def edit(self, marker: str) -> bytes:
        """Resolve known generated assets and allow literal surgical edits."""
        if marker == "{{GP_PORTAL_R521_PAYLOAD}}":
            return self.render()
        assets = self.project / "assets/portal-r521"
        if marker == "{{GP_PORTAL_R521_WORKER}}":
            return (assets / "sw.js").read_bytes()
        if marker == "{{GP_PORTAL_R521_MANIFEST}}":
            return (assets / "manifest.webmanifest").read_bytes()
        return marker.encode()

    def render(self) -> bytes:
        """Build the reviewed payload without exposing private router source."""
        assets = self.project / "assets/portal-r521"
        policy = mapping(
            json.loads((self.project / "config/portal-r521.yaml").read_text())
        )
        policy["assets"] = {
            asset.stem: "data:image/png;base64,"
            + base64.b64encode(asset.read_bytes()).decode()
            for asset in sorted(assets.glob("*.png"))
        }
        encoded = json.dumps(policy, ensure_ascii=False, separators=(",", ":"))
        encoded = encoded.replace("<", "\\u003c")
        css = (assets / "portal.css").read_text()
        js = (assets / "portal.js").read_text()
        font = base64.b64encode((assets / "vazirmatn.woff").read_bytes()).decode()
        artwork = base64.b64encode((assets / "login.webp").read_bytes()).decode()
        license_text = (assets / "Vazirmatn-OFL.txt").read_text().replace("*/", "* /")
        if "</script" in js.lower() or "</style" in css.lower():
            raise ValueError("invalid_portal_payload")
        return (
            '\n<!-- GP_PORTAL_R521 -->\n<style id="gp-portal-r521-css">\n/*\n'
            + license_text
            + '\n*/\n@font-face{font-family:"Portal Vazirmatn";font-style:normal;'
            + 'font-weight:100 900;font-display:swap;src:url("data:font/woff;base64,'
            + font
            + '") format("woff")}\n:root{--r521-login-art:url("data:image/webp;base64,'
            + artwork
            + '")}\n'
            + css
            + '\n</style>\n<script id="gp-portal-r521-js">\n'
            + "window.GP_PORTAL_R521_POLICY="
            + encoded
            + ";\n"
            + js
            + "\n</script>\n"
        ).encode()


@dataclass(frozen=True)
class Edit:
    """New repair text positioned against an exact private source fingerprint."""

    offset: int
    delete: int
    insert: bytes


@dataclass(frozen=True)
class Target:
    """One approved production path and its immutable expected transformation."""

    path: str
    before: str
    after: str
    edits: tuple[Edit, ...]

    def apply(self, source: bytes) -> bytes:
        """Apply nonoverlapping edits only to the reviewed original bytes."""
        if digest(source) != self.before:
            raise RuntimeError("production_fingerprint_mismatch:" + self.path)
        output = bytearray()
        end = 0
        for edit in self.edits:
            if edit.offset < end or edit.offset + edit.delete > len(source):
                raise RuntimeError("invalid_patch_offsets")
            output.extend(source[end : edit.offset])
            output.extend(edit.insert)
            end = edit.offset + edit.delete
        output.extend(source[end:])
        result = bytes(output)
        if digest(result) != self.after:
            raise RuntimeError("planned_fingerprint_mismatch:" + self.path)
        return result


@dataclass(frozen=True)
class Settings:
    """Validated release scope, secret references and transport limits."""

    host: str
    port: int
    timeout: int
    username: str
    password: str
    health_url: str
    health_timeout: int
    backup_directory: str
    targets: tuple[Target, ...]

    @classmethod
    def load(cls, path: Path) -> Settings:
        """Load an approved release scope and resolve environment credentials."""
        data = mapping(json.loads(path.read_text()))
        ftp, health = mapping(data.get("ftps")), mapping(data.get("health"))
        host = string(ftp, "host")
        if not re.fullmatch(r"[A-Za-z0-9.-]{1,253}", host):
            raise ValueError("invalid_host")
        url = string(health, "url")
        if url != "https://ghadirpartner.ir/healthz":
            raise ValueError("invalid_health_url")
        backup = string(data, "backup_directory")
        if backup != "storage/release-backups":
            raise ValueError("invalid_backup_directory")
        raw_targets = data.get("targets")
        if not isinstance(raw_targets, list):
            raise ValueError("invalid_targets")
        targets: list[Target] = []
        for raw in raw_targets:
            item = mapping(raw)
            edits = item.get("edits")
            if not isinstance(edits, list):
                raise ValueError("invalid_edits")
            parsed: list[Edit] = []
            for raw_edit in edits:
                edit = mapping(raw_edit)
                inserted = edit.get("insert")
                if not isinstance(inserted, str):
                    raise ValueError("invalid_insertion")
                parsed.append(
                    Edit(
                        integer(edit, "offset", 0),
                        integer(edit, "delete", 0),
                        PortalR521Payload(path.parent.parent).edit(inserted),
                    )
                )
            before, after = string(item, "before_sha256"), string(item, "after_sha256")
            if not all(re.fullmatch(r"[0-9a-f]{64}", h) for h in (before, after)):
                raise ValueError("invalid_hash")
            targets.append(Target(string(item, "path"), before, after, tuple(parsed)))
        allowed = {
            "partners/sw.js",
            "partners/manifest.webmanifest",
            "partners/portal.html",
        }
        if path.name != "portal-r521-release.yaml":
            raise ValueError("unknown_release_configuration")
        if (
            len(targets) != len(allowed)
            or {t.path for t in targets} != allowed
            or targets[-1].path != "partners/portal.html"
        ):
            raise ValueError("invalid_release_scope_or_order")

        def secret(key: str) -> str:
            """Resolve only explicit environment references."""
            match = re.fullmatch(r"\$\{([A-Z][A-Z0-9_]*)\}", string(ftp, key))
            if not match or not os.environ.get(match.group(1)):
                raise ValueError("missing_ftp_secret")
            return os.environ[match.group(1)]

        return cls(
            host,
            integer(ftp, "port"),
            integer(ftp, "timeout_seconds"),
            secret("username"),
            secret("password"),
            url,
            integer(health, "timeout_seconds"),
            backup,
            tuple(targets),
        )


class Remote(Protocol):
    """Transport boundary for source-only deployment; no database operations."""

    def download(self, path: str) -> bytes:
        """Read a known deployment file into private runner memory."""

    def upload(self, path: str, data: bytes) -> None:
        """Upload a release-owned staging or protected backup file."""

    def replace(self, source: str, destination: str) -> None:
        """Atomically replace one reviewed path."""

    def delete(self, path: str) -> None:
        """Remove only this run's disposable stage."""

    def mkdir(self, path: str) -> None:
        """Create a private backup directory when absent."""


class FtpsRemote:
    """Certificate-verified FTPS client using existing production secrets."""

    def __init__(self, settings: Settings) -> None:
        """Connect using the configured host and existing deployment identity."""
        self._ftp = FTP_TLS(
            context=ssl.create_default_context(), timeout=settings.timeout
        )
        self._ftp.connect(settings.host, settings.port)
        self._ftp.login(settings.username, settings.password)
        self._ftp.prot_p()

    def download(self, path: str) -> bytes:
        """Download without printing private source or credentials."""
        output = io.BytesIO()
        self._ftp.retrbinary("RETR /" + path, output.write)
        return output.getvalue()

    def upload(self, path: str, data: bytes) -> None:
        """Write an exact byte sequence over the encrypted data channel."""
        self._ftp.storbinary("STOR /" + path, io.BytesIO(data))

    def replace(self, source: str, destination: str) -> None:
        """Use server-side rename without a delete gap."""
        self._ftp.rename("/" + source, "/" + destination)

    def delete(self, path: str) -> None:
        """Delete a known temporary stage, never a production target."""
        self._ftp.delete("/" + path)

    def mkdir(self, path: str) -> None:
        """Create the directory, accepting an already-existing directory only."""
        try:
            self._ftp.mkd("/" + path)
        except error_perm:
            current = self._ftp.pwd()
            self._ftp.cwd("/" + path)
            self._ftp.cwd(current)

    def close(self) -> None:
        """Close the authenticated transport."""
        self._ftp.close()


class Validator:
    """Run syntax and sanitized regression fixtures against private candidate bytes."""

    def __init__(self, project: Path) -> None:
        """Inject the checkout containing only public repair instructions and tests."""
        self.project = project

    def validate(self, candidates: dict[str, bytes]) -> None:
        """Validate in an ephemeral directory; never export source as an artifact."""
        with tempfile.TemporaryDirectory(prefix="gp-reviewed-") as name:
            root = Path(name)
            for path, payload in candidates.items():
                target = root / "candidate" / path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(payload)
                command = (
                    ["php", "-l"]
                    if path.endswith(".php")
                    else ["node", "--check"]
                    if path.endswith(".js")
                    else []
                )
                if command:
                    subprocess.run(
                        [*command, str(target)], check=True, capture_output=True
                    )
            shutil.copyfile(
                self.project / "tests/portal-r521/test-portal.cjs",
                root / "test-portal.cjs",
            )
            subprocess.run(["node", str(root / "test-portal.cjs")], check=True)
            browser = shutil.which("google-chrome") or shutil.which("chromium")
            if not browser:
                raise RuntimeError("missing_portal_browser")
            for viewport in ("390,844", "1280,850"):
                result = subprocess.run(
                    [
                        browser,
                        "--headless=new",
                        "--no-sandbox",
                        "--disable-gpu",
                        "--disable-dev-shm-usage",
                        "--no-first-run",
                        "--virtual-time-budget=12000",
                        "--window-size=" + viewport,
                        "--dump-dom",
                        (root / "browser.html").as_uri(),
                    ],
                    check=True,
                    capture_output=True,
                    timeout=45,
                )
                if b"GP_PORTAL_R521_PASS</output>" not in result.stdout:
                    match = re.search(rb"GP_PORTAL_R521_FAIL:[^<]+", result.stdout)
                    if match:
                        print(match.group(0).decode(errors="replace"), file=sys.stderr)
                    raise RuntimeError("portal_browser_regression")


class Health:
    """Read-only availability check independent from the file transport."""

    def healthy(self, url: str, timeout: int) -> bool:
        """Check that the existing health route responds successfully."""
        try:
            with urlopen(url, timeout=timeout) as response:
                return int(response.status) == 200
        except OSError:
            return False


class Release:
    """Facade for pinned preparation, private rollback storage and publication."""

    guard = b"<?php http_response_code(404); exit; ?>\n"

    def __init__(
        self, settings: Settings, remote: Remote, validator: Validator, health: Health
    ) -> None:
        """Inject transport and validation dependencies to keep policy testable."""
        self.settings, self.remote, self.validator, self.health = (
            settings,
            remote,
            validator,
            health,
        )

    def prepare(self) -> tuple[dict[str, bytes], dict[str, bytes]]:
        """Read approved source files and validate the exact planned output."""
        before = {t.path: self.remote.download(t.path) for t in self.settings.targets}
        if all(digest(before[t.path]) == t.after for t in self.settings.targets):
            return before, before
        planned = {t.path: t.apply(before[t.path]) for t in self.settings.targets}
        self.validator.validate(planned)
        return before, planned

    def run(self, apply: bool) -> dict[str, object]:
        """Inspect without writes, or publish after verified backups with rollback."""
        before, planned = self.prepare()
        changed = [
            t for t in self.settings.targets if before[t.path] != planned[t.path]
        ]
        if not apply or not changed:
            return {
                "ok": True,
                "mode": "inspect" if not apply else "apply",
                "pending": [t.path for t in changed],
                "hashes": {p: digest(b) for p, b in planned.items()},
                "database_changed": False,
            }
        if not self.health.healthy(
            self.settings.health_url, self.settings.health_timeout
        ):
            raise RuntimeError("unhealthy_before_release")
        token = secrets.token_hex(16)
        backup = self.settings.backup_directory + "/" + token
        self.remote.mkdir(self.settings.backup_directory)
        self.remote.mkdir(backup)
        stages: dict[str, str] = {}
        applied: list[Target] = []
        try:
            for target in changed:
                protected = self.guard + before[target.path]
                backup_path = backup + "/" + target.path.replace("/", "_") + ".php"
                self.remote.upload(backup_path, protected)
                if self.remote.download(backup_path) != protected:
                    raise RuntimeError("backup_readback_mismatch")
                directory = target.path.rpartition("/")[0]
                stage = (
                    (directory + "/" if directory else "")
                    + ".gp-reviewed-"
                    + token
                    + "-"
                    + target.path.rpartition("/")[2]
                    + ".php"
                )
                stages[target.path] = stage
                self.remote.upload(stage, planned[target.path])
                if digest(self.remote.download(stage)) != target.after:
                    raise RuntimeError("stage_readback_mismatch")
            # Recheck all targets before publishing after concurrent edits.
            if any(digest(self.remote.download(t.path)) != t.before for t in changed):
                raise RuntimeError("production_changed_mid_release")
            for target in changed:
                if digest(self.remote.download(target.path)) != target.before:
                    raise RuntimeError("production_changed_mid_release")
                applied.append(target)
                self.remote.replace(stages[target.path], target.path)
                if digest(self.remote.download(target.path)) != target.after:
                    raise RuntimeError("live_readback_mismatch")
            if not self.health.healthy(
                self.settings.health_url, self.settings.health_timeout
            ):
                raise RuntimeError("unhealthy_after_release")
            return {
                "ok": True,
                "updated": [t.path for t in changed],
                "backup": backup,
                "hashes": {p: digest(b) for p, b in planned.items()},
                "database_changed": False,
            }
        except Exception as error:
            try:
                for target in reversed(applied):
                    current = digest(self.remote.download(target.path))
                    if current == target.before:
                        continue
                    if current != target.after:
                        raise RuntimeError("unexpected_rollback_source")
                    stage = stages[target.path]
                    self.remote.upload(stage, before[target.path])
                    if digest(self.remote.download(stage)) != target.before:
                        raise RuntimeError("rollback_stage_mismatch")
                    self.remote.replace(stage, target.path)
                    if digest(self.remote.download(target.path)) != target.before:
                        raise RuntimeError("rollback_readback_mismatch")
            except Exception as rollback_error:
                raise RuntimeError("rollback_failed") from rollback_error
            raise RuntimeError("publication_reverted") from error
        finally:
            for stage in stages.values():
                try:
                    self.remote.delete(stage)
                except (OSError, error_perm):
                    pass


class Entry:
    """Command entry point exposing the single release facade."""

    @staticmethod
    def run() -> int:
        """Execute the requested approved mode and emit source-free status only."""
        parser = argparse.ArgumentParser()
        parser.add_argument("--mode", choices=("inspect", "apply"), required=True)
        parser.add_argument(
            "--config",
            choices=("portal-r521-release.yaml",),
            default="portal-r521-release.yaml",
        )
        args = parser.parse_args()
        project = Path(__file__).resolve().parent.parent
        try:
            settings = Settings.load(project / "config" / args.config)
            remote = FtpsRemote(settings)
            try:
                print(
                    json.dumps(
                        Release(settings, remote, Validator(project), Health()).run(
                            args.mode == "apply"
                        )
                    )
                )
            finally:
                remote.close()
            return 0
        except Exception as error:
            message = str(error)
            permitted = (
                "production_fingerprint_mismatch:",
                "planned_fingerprint_mismatch:",
                "production_changed_mid_release",
                "unhealthy_",
                "backup_readback_mismatch",
                "stage_readback_mismatch",
                "live_readback_mismatch",
                "publication_reverted",
                "rollback_failed",
            )
            print(
                json.dumps(
                    {
                        "ok": False,
                        "error": message
                        if message.startswith(permitted)
                        else type(error).__name__,
                    }
                ),
                file=sys.stderr,
            )
            return 1


if __name__ == "__main__":
    raise SystemExit(Entry.run())
