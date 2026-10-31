"""Check the bounded markup patch without loading private production HTML."""
import json
from html.parser import HTMLParser
from pathlib import Path


class OfferCodeFieldTest(HTMLParser):
    """Check one existing input keeps its identity and gains an explicit label/help."""

    def __init__(self) -> None:
        """Initialize collected tags for the public patch fragment."""
        super().__init__()
        self.tags: list[tuple[str, dict[str, str | None]]] = []

    def handle_starttag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        """Collect relevant attributes without browser or network access."""
        self.tags.append((tag, dict(attrs)))

    def run(self) -> None:
        """Verify accessibility, single-input identity, width and missing-code guidance."""
        root = Path(__file__).resolve().parents[1]
        manifest = json.loads((root / "config/offer-code-release.yaml").read_text())
        markup, validation = manifest["operations"]
        self.feed(markup["new"])
        inputs = [attrs for tag, attrs in self.tags if tag == "input"]
        assert len(inputs) == 1
        assert inputs[0]["id"] == "offerPromoCode"
        assert inputs[0]["aria-describedby"] == "offerPromoCodeHint"
        assert any(
            tag == "label" and attrs.get("for") == "offerPromoCode"
            for tag, attrs in self.tags
        )
        assert any(
            attrs.get("id") == "offerPromoCodeHint" for _, attrs in self.tags
        )
        assert any(
            attrs.get("style") == "grid-column:1 / -1" for _, attrs in self.tags
        )
        assert "scrollIntoView" in validation["new"] and ".focus(" in validation["new"]
        assert "promo_code" in validation["new"]
        print("PASS: one labeled full-width code field, help and missing-code focus")


if __name__ == "__main__":
    OfferCodeFieldTest().run()
