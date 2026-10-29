import json, math
from pathlib import Path

detect = json.loads(Path('.graphify_detect.json').read_text(encoding='utf-8'))
files = detect['files']
img_exts = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'}

code = sorted(files.get('code', []))
docs = sorted(files.get('document', []))
imgs = sorted(files.get('image', []))

chunks = []

# Docs: ~18 per chunk
DOC_SIZE = 18
for i in range(0, len(docs), DOC_SIZE):
    chunks.append(('doc', docs[i:i + DOC_SIZE]))

# Images: batch of 9 (mostly small figures from one report)
IMG_SIZE = 9
for i in range(0, len(imgs), IMG_SIZE):
    chunks.append(('img', imgs[i:i + IMG_SIZE]))

# Code: ~24 per chunk, directory-adjacent so same module lands together
CODE_SIZE = 24
for i in range(0, len(code), CODE_SIZE):
    chunks.append(('code', code[i:i + CODE_SIZE]))

total = len(chunks)
out = []
for idx, (kind, fl) in enumerate(chunks, 1):
    rel = ['" + Path(f).relative_to(Path.cwd()).as_posix() + "' for f in []]
    listing = '\n'.join(Path(f).resolve().relative_to(Path.cwd()).as_posix() for f in fl)
    p = Path(f'.graphify-tmp/chunks/chunk_{idx:02d}.txt')
    p.parent.mkdir(exist_ok=True)
    p.write_text(listing, encoding='utf-8')
    out.append({'n': idx, 'kind': kind, 'files': len(fl), 'path': str(p)})

Path('.graphify-tmp/chunks/index.json').write_text(json.dumps(out, indent=2), encoding='utf-8')

code_chunks = [c for c in out if c['kind'] == 'code']
doc_chunks = [c for c in out if c['kind'] == 'doc']
img_chunks = [c for c in out if c['kind'] == 'img']
print(f'Chunks: {total} total -> code {len(code_chunks)} ({sum(c["files"] for c in code_chunks)} files), '
      f'docs {len(doc_chunks)} ({sum(c["files"] for c in doc_chunks)}), '
      f'images {len(img_chunks)} ({sum(c["files"] for c in img_chunks)})')
agents = math.ceil((len(docs) + len(imgs) + len(code)) / 22)
print(f'Estimate: ~{agents} agent-equivalents, ~45s per parallel batch')
