import json, os
from pathlib import Path

detect = json.loads(Path('.graphify_detect.json').read_text(encoding='utf-8'))

def keep(f):
    rel = os.path.relpath(f, '.').replace('\\', '/')
    return not rel.startswith('ai-job-search/')

detect['files'] = {k: [f for f in v if keep(f)] for k, v in detect.get('files', {}).items()}
detect['total_files'] = sum(len(v) for v in detect['files'].values())
Path('.graphify_detect.json').write_text(json.dumps(detect, indent=2), encoding='utf-8')

for k, v in detect['files'].items():
    print(f'{k}: {len(v)}')
print('total_files:', detect['total_files'])
print('total_words:', detect.get('total_words'))
