"""Repair observed cache revision variable drift without touching persisted state."""


class StorageCacheRevisionPatch:
    """Unify the version checked and assigned by the request-local read cache."""

    def apply(self, source: str) -> str:
        """Accept the known drift or already-correct code; reject unknown variants."""
        if source.count('function ghadir_mysql_db(bool $write, callable $fn) {') != 1:
            raise ValueError('Unknown storage adapter')
        if 'static $readCacheRev = null;' not in source:
            raise ValueError('Revision-aware cache missing')
        if '$readRevision' in source:
            expected = ('static $readRevision = null;',
                        "$readRevision = (int)$row['revision'];",
                        '$readRevision = $revision;')
            if any(source.count(anchor) != 1 for anchor in expected):
                raise ValueError('Unknown cache revision drift')
            source = source.replace('    static $readRevision = null;\n', '', 1)
            source = source.replace('$readRevision =', '$readCacheRev =')
        for anchor in ("$readCacheRev = (int)$row['revision'];", '$readCacheRev = $revision;'):
            if source.count(anchor) != 1:
                raise ValueError('Incomplete cache revision assignments')
        return source
