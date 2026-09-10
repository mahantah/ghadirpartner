from pathlib import Path
import yaml
root=Path('.github/workflows');files=list(root.glob('*.y*ml'))
assert len(files)==3,'Only the three approved workflows may remain'
for p in files:
    raw=p.read_text();doc=yaml.safe_load(raw);events=doc.get('on',doc.get(True))
    assert isinstance(events,dict),'Use explicit trigger mappings'
    if p.name=='workflow-safety-audit.yml':
        assert set(events)<= {'push','pull_request','workflow_dispatch'}
    else:
        assert set(events)=={'workflow_dispatch'},f'{p}: manual trigger required'
    if p.name.startswith('build-android-portal-'):
        assert doc.get('permissions')=={'contents':'read'}
        assert all(term not in raw.lower() for term in ['lftp','ftp_server','workflow_run','workflow_call','repository_dispatch','git push','gh workflow run'])
    elif p.name=='deploy-web-manual-safe.yml':
        assert 'storage/**' in raw and 'config.php' in raw and '--delete' not in raw.replace('# - No --delete: server-only runtime files are retained.','')
        assert 'validate_release.py' in raw and '--compare' in raw
    else: assert p.name=='workflow-safety-audit.yml','Unexpected workflow: '+p.name
print('Workflow safety audit passed')
