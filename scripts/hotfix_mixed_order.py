"""Guarded two-file mixed-settlement hotfix for the owner's production PHP."""

from __future__ import annotations

import hashlib
import io
import json
import os
import re
import secrets
import ssl
import sys
from dataclasses import dataclass
from ftplib import FTP_TLS
from pathlib import Path
from typing import Protocol, cast
from urllib.request import urlopen


@dataclass(frozen=True)
class TargetFile:
    """An allowlisted PHP dependency and its exact pre/post SHA-256 digests."""

    path: str
    before_sha256: str
    after_sha256: str


@dataclass(frozen=True)
class ReleaseSettings:
    """Validated release settings; only credential placeholders resolve from env."""

    host: str
    username: str
    password: str
    port: int
    ftp_timeout: int
    health_url: str
    health_timeout: int
    files: tuple[TargetFile, ...]

    @classmethod
    def load(cls, path: Path) -> ReleaseSettings:
        """Load finite release settings and reject additional production targets.

        Args:
            path: Repository-owned JSON-compatible YAML manifest.

        Returns:
            A validated immutable configuration.
        """
        root = _mapping(json.loads(path.read_text(encoding="utf-8")))
        ftp = _mapping(root.get("ftps"))
        health = _mapping(root.get("health"))
        raw_files = root.get("files")
        if not isinstance(raw_files, list) or len(raw_files) != 2:
            raise ValueError("invalid_target_count")
        parsed: list[TargetFile] = []
        for raw in raw_files:
            item = _mapping(raw)
            source = _string(item, "path")
            before = _string(item, "before_sha256")
            after = _string(item, "after_sha256")
            if not re.fullmatch(r"[0-9a-f]{64}", before) or not re.fullmatch(r"[0-9a-f]{64}", after):
                raise ValueError("invalid_digest")
            if before == after:
                raise ValueError("unchanged_target")
            parsed.append(TargetFile(source, before, after))
        required = ("lib/customer-credit.php", "lib/native-order-flow.php")
        if tuple(file.path for file in parsed) != required:
            raise ValueError("invalid_target_paths_or_order")
        health_url = _string(health, "url")
        if not health_url.startswith("https://"):
            raise ValueError("health_https_required")
        port = _positive_int(ftp, "port")
        ftp_timeout = _positive_int(ftp, "timeout_seconds")
        health_timeout = _positive_int(health, "timeout_seconds")
        if port > 65535 or ftp_timeout > 300 or health_timeout > 300:
            raise ValueError("invalid_connection_limit")
        return cls(
            host=_environment_ref(_string(ftp, "host")),
            username=_environment_ref(_string(ftp, "username")),
            password=_environment_ref(_string(ftp, "password")),
            port=port,
            ftp_timeout=ftp_timeout,
            health_url=health_url,
            health_timeout=health_timeout,
            files=tuple(parsed),
        )


def _mapping(value: object) -> dict[str, object]:
    if not isinstance(value, dict) or not all(isinstance(k, str) for k in value):
        raise ValueError("invalid_config_object")
    return cast(dict[str, object], value)


def _string(mapping: dict[str, object], key: str) -> str:
    value = mapping.get(key)
    if not isinstance(value, str) or not value:
        raise ValueError("invalid_config_string")
    return value


def _positive_int(mapping: dict[str, object], key: str) -> int:
    value = mapping.get(key)
    if type(value) is not int or value <= 0:
        raise ValueError("invalid_config_integer")
    return value


def _environment_ref(reference: str) -> str:
    match = re.fullmatch(r"\$\{([A-Z_][A-Z0-9_]*)\}", reference)
    if match is None:
        raise ValueError("invalid_environment_reference")
    secret = os.environ.get(match.group(1), "")
    if not secret:
        raise ValueError("missing_deployment_secret")
    return secret


def _digest(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


class RemoteFileClient(Protocol):
    """Minimal I/O boundary for an authenticated FTPS production repository."""

    def download(self, path: str) -> bytes:
        """Read an exact remote file without printing its contents."""

    def upload(self, path: str, data: bytes) -> None:
        """Stage bytes in a randomly named temporary remote file."""

    def replace(self, source: str, destination: str) -> None:
        """Atomically rename a verified stage over its destination."""

    def delete(self, path: str) -> None:
        """Remove an owned temporary stage file, if it exists."""


class FtpsClient:
    """Explicit TLS transport with server-certificate validation enabled."""

    def __init__(self, settings: ReleaseSettings) -> None:
        """Open an authenticated FTPS connection using existing CI secrets."""
        self._ftp = FTP_TLS(context=ssl.create_default_context(), timeout=settings.ftp_timeout)
        self._ftp.connect(settings.host, settings.port)
        self._ftp.login(settings.username, settings.password)
        self._ftp.prot_p()

    def download(self, path: str) -> bytes:
        """Return remote file bytes only to the runner's process memory."""
        chunks = io.BytesIO()
        self._ftp.retrbinary("RETR /" + path, chunks.write)
        return chunks.getvalue()

    def upload(self, path: str, data: bytes) -> None:
        """Upload a staged file, never directly overwrite live PHP."""
        self._ftp.storbinary("STOR /" + path, io.BytesIO(data))

    def replace(self, source: str, destination: str) -> None:
        """Rename a staged file to a live path via the server's FTP rename."""
        self._ftp.rename("/" + source, "/" + destination)

    def delete(self, path: str) -> None:
        """Delete only this release's random temporary files."""
        self._ftp.delete("/" + path)

    def close(self) -> None:
        """Close the FTP session without retaining credentials or source bytes."""
        try:
            self._ftp.quit()
        except OSError:
            self._ftp.close()


class HealthClient:
    """Production health check isolated from file publication logic."""

    def is_healthy(self, url: str, timeout: int) -> bool:
        """Check the existing public health endpoint without modifying state."""
        try:
            with urlopen(url, timeout=timeout) as response:
                return response.status == 200
        except OSError:
            return False


class HealthProbe(Protocol):
    """Read-only health-check boundary injected into the release facade."""

    def is_healthy(self, url: str, timeout: int) -> bool:
        """Return whether the current production server is healthy."""


class MixedSettlementHotfix:
    """One facade for a finite, guarded, reversible two-PHP-file release."""

    def __init__(self, remote: RemoteFileClient, health: HealthProbe, settings: ReleaseSettings, sources: Path) -> None:
        """Inject the FTPS gateway, health client, configuration, and checkout."""
        self._remote = remote
        self._health = health
        self._settings = settings
        self._sources = sources

    def release(self) -> tuple[str, ...]:
        """Publish only matching old versions, credit first; roll back on failure.

        Returns:
            The relative PHP paths actually updated; an empty tuple is idempotent.

        Raises:
            RuntimeError: If a fingerprint, rename, readback, or health guard fails.
        """
        original: dict[str, bytes] = {}
        new_bytes: dict[str, bytes] = {}
        pending: list[TargetFile] = []
        for target in self._settings.files:
            source = (self._sources / target.path).read_bytes()
            if _digest(source) != target.after_sha256:
                raise RuntimeError("checkout_sha256_mismatch")
            live = self._remote.download(target.path)
            existing = _digest(live)
            if existing == target.after_sha256:
                continue
            if existing != target.before_sha256:
                raise RuntimeError("production_sha256_mismatch")
            original[target.path] = live
            new_bytes[target.path] = source
            pending.append(target)
        if not pending:
            return ()
        if not self._health.is_healthy(self._settings.health_url, self._settings.health_timeout):
            raise RuntimeError("production_unhealthy_before_release")

        token = secrets.token_hex(16)
        stage_paths = {
            target.path: "lib/.gp-mixed-" + token + "-" + target.path.rsplit("/", 1)[-1] + ".stage"
            for target in pending
        }
        created: set[str] = set()
        applied: list[TargetFile] = []
        try:
            for target in pending:
                stage = stage_paths[target.path]
                created.add(stage)
                self._remote.upload(stage, new_bytes[target.path])
                if _digest(self._remote.download(stage)) != target.after_sha256:
                    raise RuntimeError("stage_readback_mismatch")

            self._verify_atomic_replace(token, created)
            for target in pending:
                if _digest(self._remote.download(target.path)) != target.before_sha256:
                    raise RuntimeError("production_changed_during_release")
                applied.append(target)
                # Record intent before RNTO: the server may rename, then lose the reply.
                self._remote.replace(stage_paths[target.path], target.path)
                if _digest(self._remote.download(target.path)) != target.after_sha256:
                    raise RuntimeError("publication_readback_mismatch")
            if not self._health.is_healthy(self._settings.health_url, self._settings.health_timeout):
                raise RuntimeError("production_unhealthy_after_release")
            return tuple(target.path for target in applied)
        except Exception as release_error:
            try:
                self._rollback(applied, original, token, created)
            except Exception as rollback_error:
                raise RuntimeError("rollback_failed") from rollback_error
            raise RuntimeError("release_aborted_and_rolled_back") from release_error
        finally:
            for stage in created:
                try:
                    self._remote.delete(stage)
                except Exception:
                    # The stage is random, never a live path; cleanup must not mask rollback.
                    pass

    def _verify_atomic_replace(self, token: str, created: set[str]) -> None:
        """Prove the FTP server can replace an existing file using only dummy data."""
        old = "lib/.gp-mixed-" + token + "-rename-old.probe"
        new = "lib/.gp-mixed-" + token + "-rename-new.probe"
        created.update((old, new))
        self._remote.upload(old, b"previous")
        self._remote.upload(new, b"next")
        self._remote.replace(new, old)
        if self._remote.download(old) != b"next":
            raise RuntimeError("non_atomic_ftp_rename")

    def _rollback(self, applied: list[TargetFile], originals: dict[str, bytes], token: str, created: set[str]) -> None:
        """Restore original source bytes in reverse order without touching the DB."""
        for target in reversed(applied):
            current_digest = _digest(self._remote.download(target.path))
            if current_digest == target.before_sha256:
                continue
            if current_digest != target.after_sha256:
                raise RuntimeError("rollback_unexpected_live_source")
            restore = "lib/.gp-mixed-" + token + "-" + target.path.rsplit("/", 1)[-1] + ".rollback"
            created.add(restore)
            self._remote.upload(restore, originals[target.path])
            if _digest(self._remote.download(restore)) != target.before_sha256:
                raise RuntimeError("rollback_stage_mismatch")
            self._remote.replace(restore, target.path)
            if _digest(self._remote.download(target.path)) != target.before_sha256:
                raise RuntimeError("rollback_readback_mismatch")


class HotfixEntry:
    """CLI entrypoint, with no business logic beyond dependency construction."""

    @staticmethod
    def run() -> int:
        """Validate CI settings and execute the guarded production release."""
        try:
            base = Path(__file__).resolve().parent.parent
            settings = ReleaseSettings.load(base / "config/mixed-settlement-hotfix.yaml")
            remote = FtpsClient(settings)
            try:
                changed = MixedSettlementHotfix(remote, HealthClient(), settings, base).release()
                print(json.dumps({"ok": True, "updated": changed, "database_changed": False}))
            finally:
                remote.close()
            return 0
        except Exception as error:
            # Only a finite error category may reach public CI logs, never private code.
            safe = {"checkout_sha256_mismatch", "production_sha256_mismatch", "production_unhealthy_before_release",
                    "stage_readback_mismatch", "production_changed_during_release", "publication_readback_mismatch",
                    "production_unhealthy_after_release", "release_aborted_and_rolled_back", "rollback_failed"}
            message = str(error) if str(error) in safe else "deployment_guard_failed"
            print(json.dumps({"ok": False, "error": message}), file=sys.stderr)
            return 1


if __name__ == "__main__":
    raise SystemExit(HotfixEntry.run())
