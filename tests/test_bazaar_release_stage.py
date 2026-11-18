"""Exercise additive private-source staging using sanitized synthetic entry points."""

import importlib.util
import sys
import unittest
from pathlib import Path
from typing import Protocol, cast

ROOT = Path(__file__).resolve().parents[1]


class Stage(Protocol):
    """Expose the patch operations being tested without weakening type checks."""

    def patch_index(self, source: bytes) -> bytes:
        """Patch the authenticated API dispatch."""
        ...

    def patch_app(self, source: bytes) -> bytes:
        """Patch the HTML loader."""
        ...


class StageFactory(Protocol):
    """Describe the stage dependency constructor."""

    def __call__(self, repository: Path) -> Stage:
        """Construct a stage against a repository root."""
        ...


spec = importlib.util.spec_from_file_location(
    "bazaar_stage_fixture", ROOT / "scripts/stage-bazaar-releases.py"
)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
factory = cast(StageFactory, module.BazaarReleaseStage)


class BazaarStageTest(unittest.TestCase):
    """Reject ambiguous live anchors and preserve exact non-feature bytes."""

    def test_index_is_additive_and_idempotent(self) -> None:
        """Never replace the stale public root with a reconstructed application."""
        original = b"<?php\n/* private owner source fixture */\nif($p==='/api/reports/customers'&&$m==='GET'){fixture();}\n"
        stage = factory(ROOT)
        patched = stage.patch_index(original)
        self.assertEqual(
            patched.replace(
                b"require __DIR__.'/lib/bazaar-releases-route.php';\n", b""
            ),
            original,
        )
        self.assertEqual(stage.patch_index(patched), patched)

    def test_html_preserves_original_handlers(self) -> None:
        """Append only feature assets before the unique closing body."""
        original = b'<html><body><div id="app">Owner fixture</div><script>existingHandler()</script></body></html>'
        stage = factory(ROOT)
        patched = stage.patch_app(original)
        self.assertIn(b"existingHandler()", patched)
        self.assertEqual(patched.count(b"GP_BAZAAR_RELEASES_V1"), 1)
        self.assertEqual(stage.patch_app(patched), patched)

    def test_unknown_or_duplicate_anchors_stop(self) -> None:
        """Do not guess at production source when a live anchor differs."""
        stage = factory(ROOT)
        for source in (
            b"<?php missing router",
            b"if($p==='/api/reports/customers'&&$m==='GET')" * 2,
        ):
            with self.assertRaises(ValueError):
                stage.patch_index(source)
        for source in (b"<html>no closing body", b"</body></body>"):
            with self.assertRaises(ValueError):
                stage.patch_app(source)


if __name__ == "__main__":
    unittest.main()
