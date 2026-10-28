#!/usr/bin/env python3
"""Check source-only archive filtering and extraction with fabricated fixtures."""

import io
import json
import subprocess
import tarfile
import tempfile
from pathlib import Path

repo = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as name:
    root = Path(name)
    archive_path = root / "full.tar.gz"
    with tarfile.open(archive_path, "w:gz") as archive:
        for path, content in [
            ("app.html", b"APP"),
            ("index.php", b"PHP"),
            ("assets/theme.css", b"CSS"),
            ("config.php", b"SECRET"),
            ("lib/config.php", b"SECRET"),
            ("storage/data.php", b"PRIVATE"),
            ("mysql/data.sql", b"PRIVATE"),
        ]:
            entry = tarfile.TarInfo("backup/homedir/public_html/" + path)
            entry.size = len(content)
            archive.addfile(entry, io.BytesIO(content))
    script = root / "fixture.php"
    script.write_text("""<?php
define('BACKUP_CODE_TEST',true);
define('CORRECT_SOURCE_TEST',true);
require $argv[1].'/scripts/read-backup-code-only.php';
require $argv[1].'/scripts/recover-correct-source-server.php';
(new BackupCodeReader())->copy($argv[2].'/full.tar.gz',$argv[2].'/code.tar.gz');
$service=new CorrectSourceRecovery(['expected_files'=>['app.html'=>'','index.php'=>'','assets/theme.css'=>'','config/native-order-flow.yaml'=>hash('sha256','{}')],'public_files'=>['config/native-order-flow.yaml'],'public_file_contents'=>['config/native-order-flow.yaml'=>base64_encode('{}')]]);
$method=new ReflectionMethod($service,'extract');$method->setAccessible(true);
mkdir($argv[2].'/stage');$method->invoke($service,$argv[2].'/code.tar.gz',$argv[2].'/stage');
$public=new ReflectionMethod($service,'stagePublicFiles');$public->setAccessible(true);$public->invoke($service,$argv[2].'/stage');
""")
    subprocess.run(["php", str(script), str(repo), str(root)], check=True)
    with tarfile.open(root / "code.tar.gz") as archive:
        assert set(archive.getnames()) == {"app.html", "index.php", "assets/theme.css"}
    assert (root / "stage/app.html").read_bytes() == b"APP"
    assert not (root / "stage/config.php").exists()
    assert (root / "stage/config/native-order-flow.yaml").read_text() == "{}"
manifest = json.loads((repo / "config/correct-backup-recovery.json").read_text())
assert len(manifest["expected_files"]) == 128
assert manifest["public_files"] == [
    "lib/native-order-flow.php", "lib/native-order-flow-routes.php", "config/native-order-flow.yaml"
]
assert all(
    "config" not in Path(path).name.lower()
    and not path.startswith("storage/")
    and ".." not in path.split("/")
    for path in manifest["expected_files"]
)
assert all(
    operation["file"] in manifest["expected_files"] and operation["count"] > 0
    for operation in manifest["operations"]
)
print(
    "PASS: source-only filtering, safe private extraction, finite patch manifest; no database restoration"
)
