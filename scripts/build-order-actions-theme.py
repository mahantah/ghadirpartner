#!/usr/bin/env python3
"""Build finite order-menu design tokens from validated JSON-compatible YAML."""

import argparse
import json
from pathlib import Path


class OrderActionsThemeBuilder:
    """Keep presentation settings separate from the existing native menu behavior."""

    def __init__(self, root: Path) -> None:
        """Initialize the repository containing policy and scoped styles.

        Args:
            root: Repository root, never a live application directory.
        """
        self.root = root

    def build(self, check: bool) -> None:
        """Validate tokens and write or check the deterministic CSS prefix.

        Args:
            check: Compare without modifying the generated stylesheet.
        """
        raw: object = json.loads(
            (self.root / "config/order-actions-theme.yaml").read_text()
        )
        if not isinstance(raw, dict) or set(raw) != {
            "navy",
            "orange",
            "width_px",
            "blur_px",
            "duration_ms",
        }:
            raise ValueError("Invalid order action theme")
        if raw["navy"] != "#102a43" or raw["orange"] != "#f58220":
            raise ValueError("Invalid brand colors")
        for key, lower, upper in (
            ("width_px", 200, 280),
            ("blur_px", 0, 2),
            ("duration_ms", 0, 500),
        ):
            if type(raw[key]) is not int or not lower <= raw[key] <= upper:
                raise ValueError("Invalid theme dimension")
        path = self.root / "assets/order-action-burger-v1.css"
        source = path.read_text()
        marker = "/* GHADIR_ORDER_ACTION_BURGER_V1_20261017"
        body = source[source.index(marker) :]
        prefix = (
            "/* Generated tokens: scripts/build-order-actions-theme.py */\n"
            "body > .order-menu.open:not(.customer-menu){"
            f"--gp-action-navy:{raw['navy']};--gp-action-orange:{raw['orange']};"
            f"--gp-action-width:{raw['width_px']}px;--gp-action-blur:{raw['blur_px']}px;"
            f"--gp-action-duration:{raw['duration_ms']}ms;" + "}\n"
        )
        result = prefix + body
        if check:
            if source != result:
                raise ValueError("Order action theme asset is stale")
        else:
            path.write_text(result)


def main() -> None:
    """Build the presentation asset, optionally checking reproducibility."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    arguments = parser.parse_args()
    OrderActionsThemeBuilder(Path(__file__).resolve().parents[1]).build(arguments.check)


if __name__ == "__main__":
    main()
