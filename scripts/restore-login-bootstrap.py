#!/usr/bin/env python3
"""Repair the orphan async prefix in live HTML without changing auth or shipping."""

import sys
from pathlib import Path


class LoginBootstrapRepair:
    """Restore main-script execution after replacement of an async details renderer."""

    @staticmethod
    def repair(source: str) -> str:
        """Remove exactly one known orphan prefix, or reject unexpected source.

        Args:
            source: Existing production HTML containing the reviewed details patch.

        Returns:
            HTML with only the orphan declaration modifier removed.
        """
        broken = "async /* GP_ORDER_DETAILS_V2_20261020 */"
        fixed = "/* GP_ORDER_DETAILS_V2_20261020 */"
        if source.count(broken) != 1:
            raise ValueError("Expected one known orphan async prefix")
        return source.replace(broken, fixed, 1)


if __name__ == "__main__":
    target = Path(sys.argv[1])
    target.write_text(
        LoginBootstrapRepair.repair(target.read_text(encoding="utf-8")),
        encoding="utf-8",
    )
