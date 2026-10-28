"""Verify public patch bounds and optionally the owner's matching private source locally."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import subprocess
import tempfile
from pathlib import Path


class NativeOrderPatchTest:
    """Keep private source out of CI while validating every public replacement contract."""

    def __init__(self) -> None:
        """Locate the public package without relying on process working directory."""
        self.root = Path(__file__).resolve().parents[1]

    def run(self) -> None:
        """Validate manifest paths/hashes and fail-closed application when source is supplied."""
        manifest = json.loads(
            (self.root / "config/native-order-flow-patch.json").read_text()
        )
        assert set(manifest["before_files"]) == {"index.php", "partners/index.php"}
        assert set(manifest["expected_files"]) == {
            "index.php",
            "partners/index.php",
            "lib/native-order-flow.php",
            "lib/native-order-flow-routes.php",
            "config/native-order-flow.yaml",
        }
        for operation in manifest["operations"]:
            assert (
                operation["file"] in manifest["before_files"]
                and operation["count"] == 1
            )
            assert operation["old"] != operation["new"]
        for name in set(manifest["expected_files"]) - set(manifest["before_files"]):
            assert (
                hashlib.sha256((self.root / name).read_bytes()).hexdigest()
                == manifest["expected_files"][name]
            )
        source_env = os.environ.get("GP_OWNER_SOURCE")
        if source_env:
            spec = importlib.util.spec_from_file_location(
                "native_patch", self.root / "scripts/patch-native-order-flow.py"
            )
            assert spec and spec.loader
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            with tempfile.TemporaryDirectory() as temporary:
                output = Path(temporary)
                actual = module.NativeOrderFlowPatcher(self.root).apply(
                    Path(source_env), output
                )
                assert actual == manifest
                for name in ["index.php", "partners/index.php"]:
                    assert (
                        hashlib.sha256((output / name).read_bytes()).hexdigest()
                        == manifest["expected_files"][name]
                    )
                    subprocess.run(
                        ["php", "-l", str(output / name)],
                        check=True,
                        capture_output=True,
                    )
                try:
                    module.NativeOrderFlowPatcher(self.root).apply(output, output)
                except ValueError:
                    pass
                else:
                    raise AssertionError("Already-patched source must be rejected")
        print(
            "PASS: bounded native order patch, public dependencies and optional owner-source syntax"
        )


if __name__ == "__main__":
    NativeOrderPatchTest().run()
