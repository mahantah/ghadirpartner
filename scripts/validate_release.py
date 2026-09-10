import re, stat, sys, zipfile
from pathlib import Path, PurePosixPath

def version(raw):
    m=re.match(r'^V?(\d+)\.(\d+)\.(\d+)\.(\d+)(?:[-\s]|$)',raw.strip())
    if not m: raise ValueError('Invalid release version')
    return tuple(map(int,m.groups()))

def validate(archive,destination):
    name=Path(archive).name
    if str(archive)!=name or not re.fullmatch(r'GhadirPay-GitHub-V[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+[A-Za-z0-9.-]*\.zip',name):
        raise ValueError('Select an exact WEB ZIP filename in repository root')
    if any(word in name.lower() for word in ['android','native','apk']): raise ValueError('Android package rejected')
    with zipfile.ZipFile(archive) as z:
        names=z.namelist()
        if len(names)!=len(set(names)): raise ValueError('Duplicate ZIP entries')
        for info in z.infolist():
            p=PurePosixPath(info.filename)
            if p.is_absolute() or '..' in p.parts or '\\' in info.filename or stat.S_ISLNK(info.external_attr>>16): raise ValueError('Unsafe ZIP entry')
            if any(x.lower() in ['storage','config.php','.github','.git','.cpanel.yml'] or x.lower().startswith('.env') for x in p.parts): raise ValueError('Protected entry: '+info.filename)
            if p.suffix.lower() in ['.sql','.zip','.apk']: raise ValueError('Unexpected data/archive entry')
        required=['VERSION.txt','index.php','app.html','partners/index.php','partners/portal.html','lib/storage.php']
        if any(f not in names for f in required): raise ValueError('Missing release file')
        raw=z.read('VERSION.txt').decode().strip()
        if version(raw)<(5,3,2,1): raise ValueError('Release is below current safe baseline')
        if "return 'mysql';" not in z.read('lib/storage.php').decode(): raise ValueError('MySQL-only guard missing')
        z.extractall(destination)
    return raw

if __name__=='__main__':
    if sys.argv[1]=='--compare':
        if version(Path(sys.argv[2]).read_text())<version(Path(sys.argv[3]).read_text()): raise SystemExit('BLOCKED: release is older than production')
    else: print(validate(sys.argv[1],sys.argv[2]))
