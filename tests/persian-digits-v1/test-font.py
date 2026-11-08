"""Check the actual embedded fonts preserve all ten Persian digit glyph mappings."""

import base64
import io
import re
from pathlib import Path

from fontTools.ttLib import TTFont

source = (Path(__file__).parent / "candidate/app.html").read_text()
style = source.split('<style id="gp-persian-digits-v1-css">', 1)[1].split(
    "</style>", 1
)[0]
fonts = re.findall(r"data:font/woff;base64,([A-Za-z0-9+/=]+)", style)
assert len(fonts) == 2
for encoded in fonts:
    font = TTFont(io.BytesIO(base64.b64decode(encoded)))
    cmap = font.getBestCmap()
    assert cmap is not None
    assert set(cmap) == set(range(48, 58)) | set(range(0x660, 0x66A)) | set(
        range(0x6F0, 0x6FA)
    )
    for index in range(10):
        assert cmap[48 + index] == cmap[0x660 + index] == cmap[0x6F0 + index]
print("ok: regular and bold fonts map every ASCII digit to its Persian glyph")
