"""Validate and release the customer authentication repair privately over FTPS."""

from __future__ import annotations

import argparse
import io
import json
import os
import re
import secrets
import ssl
import subprocess
import tempfile
from ftplib import FTP_TLS, error_perm
from pathlib import Path
from typing import cast
from urllib.error import HTTPError
from urllib.request import Request, urlopen


class CustomerAuthPatch:
    """Apply exact scoped edits against the private partner router."""

    def __init__(self, settings: Path) -> None:
        """Load and validate the patch manifest."""
        raw: object = json.loads(settings.read_text())
        if not isinstance(raw, list):
            raise ValueError("invalid_patch_manifest")
        self.operations: list[tuple[bytes, bytes, bytes | None]] = []
        for entry in cast(list[object], raw):
            if not isinstance(entry, list) or len(entry) not in (2, 3):
                raise ValueError("invalid_patch_operation")
            values = cast(list[object], entry)
            if not all(isinstance(value, str) and value for value in values):
                raise ValueError("invalid_patch_text")
            old, new, *scope = [value.encode() for value in cast(list[str], values)]
            self.operations.append((old, new, scope[0] if scope else None))

    def apply(self, source: bytes) -> bytes:
        """Require every reviewed anchor once, preserving all surrounding bytes."""
        for index, (old, new, scope) in enumerate(self.operations):
            start = 0
            end = len(source)
            if scope is not None:
                start = source.find(scope)
                if start < 0 or source.count(scope) != 1:
                    raise ValueError(f"scope_mismatch:{index}")
                end = source.index(b"\nif($p===", start + len(scope))
            segment = source[start:end]
            if segment.count(old) != 1:
                if segment.count(new) == 1:
                    continue
                raise ValueError(f"anchor_mismatch:{index}")
            source = source[:start] + segment.replace(old, new, 1) + source[end:]
        return source


class CustomerAuthRelease:
    """Validate the exact candidate and publish with private backup and rollback."""

    target = "/partners/index.php"
    native = "/partners/native-r54.php"

    def __init__(self, ftp: FTP_TLS, project: Path, patch: CustomerAuthPatch) -> None:
        """Inject the verified connection and reviewed patch."""
        self.ftp, self.project, self.patch = ftp, project, patch

    def read(self, path: str) -> bytes:
        """Read one approved server file without exporting its content."""
        data = io.BytesIO()
        self.ftp.retrbinary("RETR " + path, data.write)
        return data.getvalue()

    def write_verified(self, path: str, data: bytes) -> None:
        """Verify the exact bytes written before they can be used."""
        self.ftp.storbinary("STOR " + path, io.BytesIO(data))
        if self.read(path) != data:
            raise RuntimeError("ftp_readback_mismatch")

    def validate(self, candidate: bytes, native: bytes) -> None:
        """Lint the private files and exercise authentication with synthetic data."""
        with tempfile.TemporaryDirectory(prefix="gp-auth-") as directory:
            router, module = (
                Path(directory) / "index.php",
                Path(directory) / "native-r54.php",
            )
            router.write_bytes(candidate)
            module.write_bytes(native)
            for path in (router, module):
                subprocess.run(
                    ["php", "-l", str(path)], check=True, capture_output=True
                )
            subprocess.run(
                [
                    "php",
                    str(self.project / "tests/customer-auth-release.php"),
                    str(router),
                ],
                check=True,
            )

    def smoke(self, base: str) -> None:
        """Confirm the live routes reject empty inputs without sending SMS."""
        for path, expected in (
            ("/healthz", 200),
            ("/api/native/login-otp/request", 422),
            ("/api/native/login-otp/confirm", 422),
            ("/api/password-reset/request", 400),
            ("/api/password-reset/confirm", 400),
        ):
            request = Request(
                base + path,
                data=None if path == "/healthz" else b"{}",
                headers={
                    "Content-Type": "application/json",
                    "Cache-Control": "no-cache",
                },
            )
            try:
                with urlopen(request, timeout=25) as response:
                    status = response.status
            except HTTPError as error:
                status = error.code
                error.close()
            if status != expected:
                raise RuntimeError(f"route_verification_failed:{path}:{status}")

    def run(self, apply: bool, base: str) -> None:
        """Exercise the candidate, then optionally publish the one changed file."""
        original = self.read(self.target)
        candidate = self.patch.apply(original)
        self.validate(candidate, self.read(self.native))
        if not apply or candidate == original:
            if apply:
                self.smoke(base)
            print("customer_auth_validation_passed")
            return
        nonce = secrets.token_hex(16)
        backup = f"/storage/.gp-auth-{nonce}.php"
        stage = f"/storage/.gp-auth-stage-{nonce}.php"
        protected = b"<?php http_response_code(404); exit; ?>\n"
        self.write_verified(backup, protected + original)
        try:
            self.write_verified(stage, candidate)
            if self.read(self.target) != original:
                raise RuntimeError("production_changed_mid_release")
            self.ftp.rename(stage, self.target)
            try:
                if self.read(self.target) != candidate:
                    raise RuntimeError("live_readback_mismatch")
                self.smoke(base)
            except Exception:
                if self.read(self.target) != candidate:
                    raise RuntimeError("unexpected_rollback_source") from None
                self.write_verified(stage, original)
                self.ftp.rename(stage, self.target)
                if self.read(self.target) != original:
                    raise RuntimeError("rollback_readback_mismatch") from None
                raise
        finally:
            try:
                self.ftp.delete(stage)
            except error_perm:
                pass
        print("customer_auth_published_and_verified")


class Entry:
    """Load the approved repair configuration and run the release facade."""

    @staticmethod
    def run() -> None:
        """Execute a fixture, production inspection or explicit release."""
        parser = argparse.ArgumentParser()
        parser.add_argument("mode", choices=["fixture", "inspect", "apply"])
        parser.add_argument("--source", type=Path)
        args = parser.parse_args()
        project = Path(__file__).resolve().parent.parent
        patch = CustomerAuthPatch(project / "config/customer-auth-release.yaml")
        if args.mode == "fixture":
            if args.source is None:
                parser.error("--source is required in fixture mode")
            candidate = patch.apply(args.source.read_bytes())
            if patch.apply(candidate) != candidate:
                raise RuntimeError("patch_must_be_idempotent")
            args.source.with_suffix(".candidate.php").write_bytes(candidate)
            return
        host = os.environ["FTP_SERVER"]
        if not re.fullmatch(r"[a-zA-Z0-9.-]+", host):
            raise ValueError("invalid_ftp_host")
        with FTP_TLS(context=ssl.create_default_context(), timeout=45) as ftp:
            ftp.connect(host)
            ftp.login(os.environ["FTP_USERNAME"], os.environ["FTP_PASSWORD"])
            ftp.prot_p()
            CustomerAuthRelease(ftp, project, patch).run(
                args.mode == "apply", os.environ["PORTAL_BASE"]
            )


if __name__ == "__main__":
    Entry.run()
