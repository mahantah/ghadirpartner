"""Patch observed request and permission failures without changing business data."""
from pathlib import Path


class RequestCachePatch:
    """Apply exact, idempotent fixes to the deployed application HTML."""

    def apply(self, source: str) -> str:
        """Reject unknown source instead of publishing a partial patch."""
        changes = (
            ("showSessionExpired();return await new Promise(()=>{})", "showSessionExpired();throw new Error('نشست منقضی شده است؛ دوباره وارد شوید.')"),
            ("let serialTools=$('customerSerialTools');if(serialTools){let roles=ME.roles||[];", "let serialTools=$('customerSerialTools');if(serialTools){let roles=ME?.roles||[];"),
        )
        for before, after in changes:
            if after in source:
                continue
            if source.count(before) != 1:
                raise ValueError('Unknown request/permission source; refusing partial patch')
            source = source.replace(before, after, 1)
        old = '/assets/warehouse-vault-perf-v1.js?v=1'
        new = '/assets/warehouse-vault-perf-v1.js?v=2'
        if new not in source:
            if source.count(old) != 1:
                raise ValueError('Expected warehouse cache script missing')
            source = source.replace(old, new, 1)
        return source
