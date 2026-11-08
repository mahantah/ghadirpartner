"""Inspect the actual generated XLSX bytes using synthetic serials only."""

from __future__ import annotations

import io
import subprocess
import zipfile
from pathlib import Path
from xml.etree import ElementTree

result = subprocess.run(
    ["php", str(Path(__file__).with_name("test-export.php")), "--xlsx"],
    check=True,
    capture_output=True,
)
with zipfile.ZipFile(io.BytesIO(result.stdout)) as workbook:
    sheet = ElementTree.fromstring(workbook.read("xl/worksheets/sheet1.xml"))
namespace = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
cells = sheet.findall("s:sheetData/s:row/s:c", namespace)
assert [cell.attrib["r"] for cell in cells] == ["A1", "A2"]
assert [cell.findtext("s:is/s:t", namespaces=namespace) for cell in cells] == [
    "00001234567890123456",
    "A-02",
]
assert all(cell.attrib.get("t") == "inlineStr" for cell in cells)
assert not sheet.findall(".//s:f", namespace)
print("PASS: XLSX contains only selected serial text cells with exact values")
