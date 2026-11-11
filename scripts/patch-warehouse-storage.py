#!/usr/bin/env python3
"""Apply reviewed, bounded warehouse changes to a private copy of current production code."""

import argparse
import hashlib
import json
from pathlib import Path


class WarehouseStoragePatcher:
    """Patch exact source hashes and preserve all unrelated production code."""

    def __init__(self, policy: Path) -> None:
        """Load reviewed source identities.

        Args:
            policy: JSON manifest containing original production hashes.
        """
        self._policy = json.loads(policy.read_text())

    def _replace(self, source: str, before: str, after: str) -> str:
        """Replace exactly one known anchor or stop before any file is written."""
        if source.count(before) != 1:
            raise ValueError(f"Ambiguous or missing patch anchor: {before[:70]}")
        return source.replace(before, after, 1)

    def patch(self, root: Path) -> None:
        """Patch both files only after every source identity and anchor is verified.

        Args:
            root: Private production code directory, never the public repository root.
        """
        files = {name: (root / name).read_text() for name in self._policy["sources"]}
        for name, expected in self._policy["sources"].items():
            if hashlib.sha256((root / name).read_bytes()).hexdigest() != expected:
                raise ValueError(f"Production source changed: {name}")
        storage = files["lib/storage.php"]
        storage = self._replace(
            storage,
            "declare(strict_types=1);",
            "declare(strict_types=1);\nrequire_once __DIR__.'/warehouse-storage.php';",
        )
        storage = self._replace(
            storage,
            "    ghadir_mysql_ensure_schema($pdo);",
            "    // Runtime reads must not issue DDL; schema creation belongs to migrations.",
        )
        storage = self._replace(
            storage,
            "        if ($write) $pdo->beginTransaction();",
            "        $pdo->beginTransaction();",
        )
        storage = self._replace(
            storage,
            "        ghadir_state_prepare($s);\n        if (isset($s['products'])",
            "        $warehouse = GpWarehouseStorage::create($pdo);\n        $warehouse->hydrate($s);\n        ghadir_state_prepare($s);\n        $warehouseBefore = $warehouse->snapshot($s);\n        if (isset($s['products'])",
        )
        storage = self._replace(
            storage,
            "        $r = $fn($s);",
            "        if (!$write) $pdo->commit();\n        $r = $fn($s);",
        )
        storage = self._replace(
            storage,
            "        if ($write) {\n            ghadir_state_prepare($s);",
            "        if ($write) {\n            ghadir_state_prepare($s);\n            $warehouse->reconcile($warehouseBefore, $s);\n            $persisted = $warehouse->persist($warehouseBefore, $s);",
        )
        # Only the MySQL encoder persists the split; the committed read cache remains hydrated.
        start = storage.index("function ghadir_mysql_db(")
        tail = storage[start:]
        tail = self._replace(
            tail, "$encoded = json_encode($s,", "$encoded = json_encode($persisted,"
        )
        tail = self._replace(
            tail, "if ($write && $pdo->inTransaction())", "if ($pdo->inTransaction())"
        )
        storage = storage[:start] + tail
        index = files["index.php"]
        index = self._replace(index, ":ghadir_db(false,$fn);}", ":gp_read_db($fn);}")
        index = self._replace(
            index,
            "$u=db(false,function($s){foreach($s['users']",
            "$u=gp_core_db(function($s){foreach($s['users']",
        )
        index = self._replace(
            index,
            "require_once __DIR__.'/lib/warehouse-v53438.php';",
            "require_once __DIR__.'/lib/warehouse-read-routes.php';\nrequire_once __DIR__.'/lib/warehouse-v53438.php';",
        )
        for route, mode in [
            ("/api/mobile-bootstrap", False),
            ("/api/bootstrap", True),
            ("/api/orders", True),
        ]:
            start = index.index("if($p==='" + route + "'&&$m==='GET')")
            next_route = index.find("\nif($p===", start + 1)
            end = len(index) if next_route < 0 else next_route
            block = index[start:end]
            block = self._replace(
                block,
                "out(db(false,function($s)use($u)",
                "out("
                + ("gp_order_read" if mode else "gp_core_db")
                + "(function($s)use($u)",
            )
            index = index[:start] + block + index[end:]
        for name, content in [("lib/storage.php", storage), ("index.php", index)]:
            (root / name).write_text(content)


def main() -> None:
    """Patch the explicitly supplied private source directory."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path)
    parser.add_argument(
        "--policy",
        type=Path,
        default=Path(__file__).resolve().parents[1]
        / "config/warehouse-storage-release.json",
    )
    arguments = parser.parse_args()
    WarehouseStoragePatcher(arguments.policy).patch(arguments.root)


if __name__ == "__main__":
    main()
