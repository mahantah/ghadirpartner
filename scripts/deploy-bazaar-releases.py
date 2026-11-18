"""Privately stage and deploy the administrator's Cafe Bazaar release manager."""

from __future__ import annotations

import io
import json
import os
import re
import ssl
import subprocess
import sys
from collections.abc import Callable
from ftplib import FTP_TLS, error_perm
from importlib import import_module
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Protocol, cast
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]


class RemoteFiles(Protocol):
    """Expose only the existing FTPS client's verified file operations."""

    def read(self, path: str) -> bytes:
        """Read a file privately without logging content."""
        ...

    def publish(self, path: str, data: bytes) -> None:
        """Atomically publish and verify one reviewed code file."""
        ...


class ReleaseStage(Protocol):
    """Describe the bounded source staging facade."""

    def candidate(self, index: bytes, app: bytes) -> dict[str, bytes]:
        """Produce additive entry-point and dependency candidates."""
        ...


class BazaarWebRelease:
    """Coordinate protected-state preflight, live-source staging and rollback."""

    def __init__(
        self, ftp: FTP_TLS, files: RemoteFiles, site: str, cartons: list[str]
    ) -> None:
        self.ftp = ftp
        self.files = files
        self.site = site
        self.cartons = cartons

    def preflight(self) -> None:
        """Abort on protected-carton mismatch or unsupported host capabilities."""
        token = uuid4().hex + uuid4().hex
        name = "__gp_bazaar_preflight_" + uuid4().hex + ".php"
        template = (ROOT / "scripts/bazaar-release-preflight.php").read_text()
        library = (ROOT / "lib/preswitch-carton-integrity.php").read_text()
        if not library.startswith("<?php\n") or "?>" in library:
            raise ValueError("Invalid preflight validator source")
        template = template.replace(
            "// GP_PRESWITCH_INTEGRITY_INLINE_20261021",
            library.removeprefix("<?php\n"),
            1,
        )
        template = template.replace("__PROBE_TOKEN__", token).replace(
            "__PROTECTED_CARTONS__", json.dumps(self.cartons)
        )
        self.ftp.storbinary("STOR /" + name, io.BytesIO(template.encode()))
        try:
            request = Request(
                self.site + "/" + name,
                data=b"",
                headers={"X-GP-Probe-Token": token},
                method="POST",
            )
            try:
                with urlopen(request, timeout=60) as response:
                    result: object = json.loads(response.read())
            except HTTPError as error:
                body: object = json.loads(error.read())
                reason = (
                    body.get("error", "preflight_failed")
                    if isinstance(body, dict)
                    else "preflight_failed"
                )
                raise RuntimeError(
                    f"STOP: production preflight HTTP {error.code}: {reason}"
                ) from None
            if (
                not isinstance(result, dict)
                or result.get("ok") is not True
                or result.get("read_only") is not True
            ):
                raise RuntimeError("STOP: production preflight did not pass")
            print(
                "Protected-carton and server-capability checks passed; database unchanged."
            )
        finally:
            self.ftp.delete("/" + name)

    def verify(self, candidate: dict[str, bytes]) -> None:
        """Check public asset bytes and unauthenticated route rejection after deployment."""
        for path in ("assets/bazaar-releases.js", "assets/bazaar-releases.css"):
            with urlopen(self.site + "/" + path + "?v=1", timeout=30) as response:
                if response.read() != candidate[path]:
                    raise RuntimeError("Public Bazaar asset verification failed")
        with urlopen(self.site + "/app.html", timeout=30) as response:
            if b"GP_BAZAAR_RELEASES_V1" not in response.read():
                raise RuntimeError("Bazaar application loader is missing")
        try:
            with urlopen(self.site + "/api/admin/app-releases", timeout=30):
                raise RuntimeError("Admin release route accepted an anonymous request")
        except HTTPError as error:
            if error.code not in (401, 403):
                raise

    def run(self, apply: bool) -> None:
        """Patch only current live code, preserving exact entry points on any failure."""
        self.preflight()
        stage_type = cast(
            Callable[[Path], ReleaseStage],
            import_module("stage-bazaar-releases").BazaarReleaseStage,
        )
        stage = stage_type(ROOT)
        originals = {path: self.files.read(path) for path in ("index.php", "app.html")}
        candidate = stage.candidate(originals["index.php"], originals["app.html"])
        with TemporaryDirectory(prefix="gp-bazaar-stage-") as directory:
            work = Path(directory)
            for path, data in candidate.items():
                local = work / path
                local.parent.mkdir(parents=True, exist_ok=True)
                local.write_bytes(data)
                if path.endswith(".php"):
                    subprocess.run(
                        ["php", "-l", str(local)], check=True, capture_output=True
                    )
            subprocess.run(
                ["node", "--check", str(work / "assets/bazaar-releases.js")],
                check=True,
                capture_output=True,
            )
            print("Exact live entry-point anchors and staged PHP/JS syntax passed.")
            if not apply:
                return
            for path, original in originals.items():
                if self.files.read(path) != original:
                    raise RuntimeError("STOP: live source changed before deployment")
            before: dict[str, bytes | None] = dict(originals)
            for path in candidate:
                if path in before:
                    continue
                try:
                    before[path] = self.files.read(path)
                except error_perm as error:
                    if not str(error).startswith("550"):
                        raise
                    before[path] = None
            changed: list[str] = []
            try:
                for path, data in candidate.items():
                    changed.append(path)
                    self.files.publish(path, data)
                self.verify(candidate)
            except Exception:
                # Restore entry points first so no user can reach half-restored dependencies.
                for path in [
                    *originals,
                    *(p for p in reversed(changed) if p not in originals),
                ]:
                    previous = before[path]
                    if previous is not None:
                        self.files.publish(path, previous)
                    elif path in changed:
                        try:
                            self.ftp.delete("/" + path)
                        except error_perm:
                            pass
                raise
        print(
            "Bazaar release manager deployed and verified; application database unchanged."
        )


def main() -> None:
    """Use existing deployment credentials only from the production environment."""
    if sys.argv[1:] not in (["inspect"], ["apply"]):
        raise SystemExit("Specify inspect or apply")
    policy: object = json.loads((ROOT / "config/bazaar-web-release.yaml").read_text())
    if not isinstance(policy, dict):
        raise TypeError("Invalid release policy")
    site, host, port, timeout = (
        policy.get(k) for k in ("site", "ftp_host", "ftp_port", "ftp_timeout")
    )
    if (
        site != "https://ghadirpartner.ir"
        or not isinstance(host, str)
        or not re.fullmatch(r"[a-z0-9.-]+", host)
        or type(port) is not int
        or port != 21
        or type(timeout) is not int
        or not 1 <= timeout <= 60
    ):
        raise ValueError("Invalid production release endpoint")
    cartons = policy.get("protected_cartons")
    if (
        not isinstance(cartons, list)
        or not cartons
        or not all(
            isinstance(code, str) and re.fullmatch(r"I90-\d{3}", code)
            for code in cartons
        )
    ):
        raise ValueError("Invalid protected-carton configuration")
    values: dict[str, str] = {}
    for key in ("username", "password"):
        reference = policy.get(key)
        match = (
            re.fullmatch(r"\$\{([A-Z_]+)\}", reference)
            if isinstance(reference, str)
            else None
        )
        if match is None or not os.environ.get(match.group(1)):
            raise ValueError("Missing production credential environment reference")
        values[key] = os.environ[match.group(1)]
    with FTP_TLS(context=ssl.create_default_context(), timeout=timeout) as ftp:
        ftp.connect(host, port)
        ftp.login(user=values["username"], passwd=values["password"])
        ftp.prot_p()
        factory = cast(
            Callable[[FTP_TLS, str], RemoteFiles],
            import_module("release-portal-phase-one").PhaseOneRelease,
        )
        BazaarWebRelease(ftp, factory(ftp, site), site, cast(list[str], cartons)).run(
            sys.argv[1] == "apply"
        )


if __name__ == "__main__":
    main()
