"""Check the actual embedded fonts preserve all ten Persian digit glyph mappings."""

import base64
import hashlib
import io
import json
import re
from pathlib import Path

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTFont

source = (Path(__file__).parent / "candidate/app.html").read_text()
style = source.split('<style id="gp-persian-digits-v1-css">', 1)[1].split(
    "</style>", 1
)[0]
fonts = re.findall(r"data:font/woff;base64,([A-Za-z0-9+/=]+)", style)
assert len(fonts) == 1
provenance = json.loads((Path(__file__).parent / "font-source.json").read_text())
for encoded in fonts:
    font = TTFont(io.BytesIO(base64.b64decode(encoded)))
    assert "Tanha" in font["name"].getDebugName(4)
    cmap = font.getBestCmap()
    assert cmap is not None
    assert set(cmap) == set(range(48, 58)) | set(range(0x660, 0x66A)) | set(
        range(0x6F0, 0x6FA)
    )
    for index in range(10):
        assert cmap[48 + index] == cmap[0x660 + index] == cmap[0x6F0 + index]
        glyphs = font.getGlyphSet()
        pen = DecomposingRecordingPen(glyphs)
        glyphs[cmap[0x6F0 + index]].draw(pen)
        actual = hashlib.sha256(
            json.dumps(pen.value, separators=(",", ":")).encode()
        ).hexdigest()
        assert actual == provenance["persian_digit_outline_sha256"][index]
print("ok: Tanha glyphs preserved; every digit maps to the supplied Persian shape")
