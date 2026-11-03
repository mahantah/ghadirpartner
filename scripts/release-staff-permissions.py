"""Fingerprint-guarded FTPS release for the automation staff-role interface."""

from __future__ import annotations

import argparse
import difflib
import hashlib
import io
import json
import os
import re
import secrets
import ssl
import subprocess
import sys
from dataclasses import dataclass
from ftplib import FTP_TLS
from pathlib import Path
from typing import Protocol, cast
from urllib.request import urlopen


def digest(payload: bytes) -> str:
    """Calculate the exact byte-level release fingerprint."""
    return hashlib.sha256(payload).hexdigest()


def mapping(value: object) -> dict[str, object]:
    """Require a string-keyed manifest mapping."""
    if not isinstance(value, dict) or not all(isinstance(key, str) for key in value):
        raise ValueError("invalid_release_manifest")
    return cast(dict[str, object], value)


def string(item: dict[str, object], key: str) -> str:
    """Read a nonempty, strictly typed manifest string."""
    value = item.get(key)
    if not isinstance(value, str) or not value:
        raise ValueError("invalid_release_string")
    return value


def positive_integer(item: dict[str, object], key: str) -> int:
    """Read a strictly positive connection limit."""
    value = item.get(key)
    if type(value) is not int or not (0 < value <= 300):
        raise ValueError("invalid_release_integer")
    return value


@dataclass(frozen=True)
class Target:
    """One allowlisted public UI file with pinned pre/post fingerprints."""

    path: str
    before: str
    after: str


@dataclass(frozen=True)
class Settings:
    """Validated production release policy and transport configuration."""

    host: str
    port: int
    timeout: int
    username: str
    password: str
    health_url: str
    health_timeout: int
    old_ref: str
    checkout_sha: str
    targets: tuple[Target, Target]
    before_script: str
    after_script: str

    @classmethod
    def load(cls, path: Path, require_after: bool) -> Settings:
        """Load only the two fixed UI targets and environment-bound FTP secrets."""
        root = mapping(json.loads(path.read_text(encoding="utf-8")))
        ftp = mapping(root.get("ftps"))
        health = mapping(root.get("health"))
        asset = mapping(root.get("asset"))
        app = mapping(root.get("app"))
        host = string(ftp, "host")
        if not re.fullmatch(r"[A-Za-z0-9.-]{1,253}", host):
            raise ValueError("invalid_ftps_hostname")
        before_script = string(app, "before_script_ref")
        after_script = string(app, "after_script_ref")
        if not before_script.startswith(
            "/assets/kartabl-sync-v1.js?"
        ) or not after_script.startswith(before_script + "&"):
            raise ValueError("invalid_cache_bust_reference")
        target_items = ((asset, "assets/kartabl-sync-v1.js"), (app, "app.html"))
        targets: list[Target] = []
        for item, path_name in target_items:
            if string(item, "path") != path_name:
                raise ValueError("unexpected_release_file")
            before = string(item, "before_sha256")
            after_value = item.get("after_sha256")
            if not isinstance(after_value, str) or (require_after and not after_value):
                raise ValueError("missing_target_fingerprint")
            if not re.fullmatch(r"[0-9a-f]{64}", before) or (
                after_value and not re.fullmatch(r"[0-9a-f]{64}", after_value)
            ):
                raise ValueError("invalid_target_fingerprint")
            targets.append(Target(path_name, before, after_value))
        source_ref = string(root, "source_ref")
        checkout_sha = string(asset, "checkout_sha256")
        if not re.fullmatch(r"[0-9a-f]{40}", source_ref) or not re.fullmatch(
            r"[0-9a-f]{64}", checkout_sha
        ):
            raise ValueError("invalid_source_reference")
        health_url = string(health, "url")
        if not health_url.startswith("https://ghadirpartner.ir/"):
            raise ValueError("invalid_health_endpoint")

        def credential(key: str) -> str:
            """Resolve only ${ENV} credential placeholders."""
            ref = string(ftp, key)
            matched = re.fullmatch(r"\$\{([A-Z][A-Z0-9_]*)\}", ref)
            if not matched or not os.environ.get(matched.group(1)):
                raise ValueError("missing_ftp_secret")
            return os.environ[matched.group(1)]

        port = positive_integer(ftp, "port")
        if port > 65535:
            raise ValueError("invalid_ftp_port")
        return cls(
            host,
            port,
            positive_integer(ftp, "timeout_seconds"),
            credential("username"),
            credential("password"),
            health_url,
            positive_integer(health, "timeout_seconds"),
            source_ref,
            checkout_sha,
            (targets[0], targets[1]),
            before_script,
            after_script,
        )


class RolePatch:
    """Pure, context-anchored source transformation preserving unrelated live edits."""

    def apply(self, old: bytes, corrected: bytes, live: bytes) -> tuple[bytes, int]:
        """Apply the repository's exact grouped diff to unique live context anchors."""
        original_lines = old.decode("utf-8").splitlines(keepends=True)
        corrected_lines = corrected.decode("utf-8").splitlines(keepends=True)
        groups = list(
            difflib.SequenceMatcher(
                None, original_lines, corrected_lines, autojunk=False
            ).get_grouped_opcodes(3)
        )
        if len(groups) != 3:
            raise RuntimeError("unexpected_patch_structure")
        output = live.decode("utf-8")
        for group in groups:
            before = "".join(original_lines[group[0][1] : group[-1][2]])
            after = "".join(corrected_lines[group[0][3] : group[-1][4]])
            if not before or output.count(before) != 1:
                raise RuntimeError("production_patch_anchor_mismatch")
            output = output.replace(before, after, 1)
        for forbidden in ("#users .checks", "#modal .checks", "el.checked = (u.roles"):
            if forbidden in output:
                raise RuntimeError("stale_role_block_remains")
        return output.encode("utf-8"), len(groups)


class Remote(Protocol):
    """Narrow, injectable transport for two presentation files."""

    def download(self, path: str) -> bytes:
        """Download an allowlisted file without logging contents."""

    def upload(self, path: str, data: bytes) -> None:
        """Write only a temporary staging file."""

    def replace(self, source: str, destination: str) -> None:
        """Atomically rename a verified temporary file."""

    def delete(self, path: str) -> None:
        """Delete a temporary file owned by this run."""


class FtpsRemote:
    """Explicit TLS session verified against the hosting certificate hostname."""

    def __init__(self, settings: Settings) -> None:
        """Authenticate only through configured HTTPS-equivalent TLS trust."""
        self._ftp = FTP_TLS(
            context=ssl.create_default_context(), timeout=settings.timeout
        )
        self._ftp.connect(settings.host, settings.port)
        self._ftp.login(settings.username, settings.password)
        self._ftp.prot_p()

    def download(self, path: str) -> bytes:
        """Return source bytes solely to runner memory."""
        data = io.BytesIO()
        self._ftp.retrbinary("RETR /" + path, data.write)
        return data.getvalue()

    def upload(self, path: str, data: bytes) -> None:
        """Stage public UI bytes in an unpredictable temporary filename."""
        self._ftp.storbinary("STOR /" + path, io.BytesIO(data))

    def replace(self, source: str, destination: str) -> None:
        """Perform an FTP RNFR/RNTO on the hosting server."""
        self._ftp.rename("/" + source, "/" + destination)

    def delete(self, path: str) -> None:
        """Remove an owned temporary stage from its known directory."""
        self._ftp.delete("/" + path)

    def close(self) -> None:
        """Release the authenticated FTPS session."""
        self._ftp.close()


class Health:
    """Read-only public health endpoint client."""

    def healthy(self, url: str, timeout: int) -> bool:
        """Return whether production currently responds with HTTP 200."""
        try:
            with urlopen(url, timeout=timeout) as response:
                return int(response.status) == 200
        except OSError:
            return False


class StaffPermissionsRelease:
    """Single release facade for staging, verification and automatic rollback."""

    def __init__(
        self, settings: Settings, remote: Remote, health: Health, project: Path
    ) -> None:
        """Inject policy, source checkout, FTPS and health dependencies."""
        self.settings = settings
        self.remote = remote
        self.health = health
        self.project = project

    def prepare(self) -> tuple[dict[str, bytes], dict[str, bytes], int]:
        """Validate hashes and compute exactly the expected live changes, read-only."""
        old_source = subprocess.run(
            ["git", "show", self.settings.old_ref + ":assets/kartabl-sync-v1.js"],
            capture_output=True,
            check=True,
        ).stdout
        new_source = (self.project / "assets/kartabl-sync-v1.js").read_bytes()
        if digest(new_source) != self.settings.checkout_sha:
            raise RuntimeError("checkout_fingerprint_mismatch")
        before = {
            target.path: self.remote.download(target.path)
            for target in self.settings.targets
        }
        if any(
            digest(before[target.path]) != target.before
            for target in self.settings.targets
        ):
            if all(
                target.after and digest(before[target.path]) == target.after
                for target in self.settings.targets
            ):
                return before, before, 0
            raise RuntimeError("production_fingerprint_mismatch")
        changed_asset, count = RolePatch().apply(
            old_source, new_source, before[self.settings.targets[0].path]
        )
        original_app = before[self.settings.targets[1].path]
        old_ref = self.settings.before_script.encode("ascii")
        if original_app.count(old_ref) != 1:
            raise RuntimeError("production_html_anchor_mismatch")
        changed_app = original_app.replace(
            old_ref, self.settings.after_script.encode("ascii"), 1
        )
        return (
            before,
            {
                self.settings.targets[0].path: changed_asset,
                self.settings.targets[1].path: changed_app,
            },
            count,
        )

    def inspect(self) -> dict[str, object]:
        """Publish only plan fingerprints for review; never touch production files."""
        before, planned, count = self.prepare()
        return {
            "ok": True,
            "patch_groups": count,
            "before": {key: digest(value) for key, value in before.items()},
            "planned": {key: digest(value) for key, value in planned.items()},
            "database_changed": False,
        }

    def release(self) -> dict[str, object]:
        """Guarded two-file publication; restore exact previous bytes on failures."""
        before, planned, count = self.prepare()
        if count == 0:
            return {"ok": True, "updated": [], "database_changed": False}
        if any(digest(planned[t.path]) != t.after for t in self.settings.targets):
            raise RuntimeError("planned_fingerprint_mismatch")
        if not self.health.healthy(
            self.settings.health_url, self.settings.health_timeout
        ):
            raise RuntimeError("unhealthy_before_release")
        token = secrets.token_hex(16)
        temporary: set[str] = set()
        stages: dict[str, str] = {}
        applied: list[Target] = []
        try:
            for target in self.settings.targets:
                directory = (
                    target.path.rsplit("/", 1)[0] + "/" if "/" in target.path else ""
                )
                stage = (
                    directory
                    + ".gp-staff-"
                    + token
                    + "-"
                    + target.path.rsplit("/", 1)[-1]
                    + ".stage"
                )
                stages[target.path] = stage
                temporary.add(stage)
                self.remote.upload(stage, planned[target.path])
                if digest(self.remote.download(stage)) != target.after:
                    raise RuntimeError("stage_readback_mismatch")
                old_probe = directory + ".gp-staff-" + token + "-old.probe"
                new_probe = directory + ".gp-staff-" + token + "-new.probe"
                temporary.update((old_probe, new_probe))
                self.remote.upload(old_probe, b"old")
                self.remote.upload(new_probe, b"new")
                self.remote.replace(new_probe, old_probe)
                if self.remote.download(old_probe) != b"new":
                    raise RuntimeError("atomic_replace_unsupported")
            for target in self.settings.targets:
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
                "updated": [t.path for t in applied],
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
                    directory = (
                        target.path.rsplit("/", 1)[0] + "/"
                        if "/" in target.path
                        else ""
                    )
                    restore = (
                        directory
                        + ".gp-staff-"
                        + token
                        + "-restore-"
                        + target.path.rsplit("/", 1)[-1]
                        + ".stage"
                    )
                    temporary.add(restore)
                    self.remote.upload(restore, before[target.path])
                    if digest(self.remote.download(restore)) != target.before:
                        raise RuntimeError("rollback_stage_mismatch")
                    self.remote.replace(restore, target.path)
                    if digest(self.remote.download(target.path)) != target.before:
                        raise RuntimeError("rollback_readback_mismatch")
            except Exception as rollback_error:
                raise RuntimeError("rollback_failed") from rollback_error
            raise RuntimeError("publication_reverted") from error
        finally:
            for item in temporary:
                try:
                    self.remote.delete(item)
                except Exception:
                    # An inaccessible random stage must not hide the publication result.
                    pass


class Entry:
    """Safe CLI facade for GitHub Actions preflight and approved publication."""

    @staticmethod
    def run() -> int:
        """Perform either a strictly read-only inspection or a guarded release."""
        parser = argparse.ArgumentParser()
        parser.add_argument("--mode", choices=("inspect", "apply"), required=True)
        arguments = parser.parse_args()
        project = Path(__file__).resolve().parent.parent
        try:
            settings = Settings.load(
                project / "config/staff-permissions-release.yaml",
                arguments.mode == "apply",
            )
            remote = FtpsRemote(settings)
            try:
                release = StaffPermissionsRelease(settings, remote, Health(), project)
                print(
                    json.dumps(
                        release.inspect()
                        if arguments.mode == "inspect"
                        else release.release()
                    )
                )
            finally:
                remote.close()
            return 0
        except Exception as error:
            allowed = {
                "production_fingerprint_mismatch",
                "production_patch_anchor_mismatch",
                "production_html_anchor_mismatch",
                "checkout_fingerprint_mismatch",
                "planned_fingerprint_mismatch",
                "unhealthy_before_release",
                "stage_readback_mismatch",
                "atomic_replace_unsupported",
                "production_changed_mid_release",
                "live_readback_mismatch",
                "unhealthy_after_release",
                "publication_reverted",
                "rollback_failed",
                "unexpected_patch_structure",
                "stale_role_block_remains",
            }
            message = str(error) if str(error) in allowed else "guarded_release_failed"
            print(json.dumps({"ok": False, "error": message}), file=sys.stderr)
            return 1


if __name__ == "__main__":
    raise SystemExit(Entry.run())
