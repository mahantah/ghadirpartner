"""Add the Bazaar manager to exact live entry points without publishing private source."""

from html.parser import HTMLParser
from pathlib import Path


class BodyLocator(HTMLParser):
    """Locate real body tags while ignoring print-template strings inside scripts."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.positions: list[tuple[int, int]] = []

    def handle_endtag(self, tag: str) -> None:
        """Record only structural body end tags reported by the HTML tokenizer."""
        if tag == "body":
            self.positions.append(self.getpos())


class BazaarReleaseStage:
    """Produce a bounded additive candidate against the current owner-hosted application."""

    route_anchor = b"if($p==='/api/reports/customers'&&$m==='GET')"
    route = b"require __DIR__.'/lib/bazaar-releases-route.php';\n"
    marker = b"GP_BAZAAR_RELEASES_V1"
    loader = (
        b"<!-- GP_BAZAAR_RELEASES_V1 -->\n"
        b'<link rel="stylesheet" href="/assets/bazaar-releases.css?v=1">\n'
        b'<script defer src="/assets/bazaar-releases.js?v=1"></script>\n'
    )
    dependencies = (
        "config/bazaar-releases.yaml",
        "assets/bazaar-releases.js",
        "assets/bazaar-releases.css",
        "lib/bazaar-release-config.php",
        "lib/bazaar-release-storage.php",
        "lib/bazaar-release-client.php",
        "lib/bazaar-apk.php",
        "lib/bazaar-releases.php",
        "lib/bazaar-releases-route.php",
    )

    def __init__(self, repository: Path) -> None:
        self.repository = repository

    def patch_index(self, source: bytes) -> bytes:
        """Install one guarded router after existing authentication helpers are defined."""
        if source.count(self.route) == 1:
            return source
        if (
            b"bazaar-releases-route.php" in source
            or source.count(self.route_anchor) != 1
        ):
            raise ValueError("STOP: production API anchor mismatch")
        return source.replace(self.route_anchor, self.route + self.route_anchor, 1)

    def patch_app(self, source: bytes) -> bytes:
        """Link only the new feature assets, preserving all private application markup."""
        if source.count(self.loader) == 1:
            return source
        if self.marker in source or b"bazaar-releases.js" in source:
            raise ValueError("STOP: production HTML feature marker mismatch")
        text = source.decode("utf-8")
        locator = BodyLocator()
        locator.feed(text)
        if len(locator.positions) != 1:
            raise ValueError("STOP: production HTML anchor mismatch")
        line, column = locator.positions[0]
        lines = text.splitlines(keepends=True)
        offset = len(
            ("".join(lines[: line - 1]) + lines[line - 1][:column]).encode("utf-8")
        )
        return source[:offset] + self.loader + source[offset:]

    def candidate(self, index: bytes, app: bytes) -> dict[str, bytes]:
        """Return exact entry-point candidates and public feature dependencies only."""
        return {
            **{
                path: (self.repository / path).read_bytes()
                for path in self.dependencies
            },
            "index.php": self.patch_index(index),
            "app.html": self.patch_app(app),
        }
