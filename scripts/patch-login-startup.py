"""Patch the current deployed HTML without replacing unrelated live hotfixes."""
from pathlib import Path
import sys

MARKER = '// LOGIN_STARTUP_GUARD_20261016'
ANCHOR = "  if(key==='accounts')loadRegistrationRequests();"
GUARD = "  if(!ME || !has('admin') || portalSection.classList.contains('hidden'))return;"


def patch(source):
    if MARKER in source:
        if GUARD not in source:
            raise ValueError('Login guard marker exists but guard is missing')
        return source
    if source.count(ANCHOR) != 1:
        raise ValueError('Expected exactly one portalAdminView accounts loader; refusing patch')
    return source.replace(ANCHOR, '  ' + MARKER + '\n' + GUARD + '\n' + ANCHOR)


if __name__ == '__main__':
    path = Path(sys.argv[1])
    source = path.read_text(encoding='utf-8')
    updated = patch(source)
    path.write_text(updated, encoding='utf-8')
