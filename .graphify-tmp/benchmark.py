import json
from pathlib import Path

detect = json.loads(Path('.graphify_detect.json').read_text(encoding='utf-8'))

# Recompute total_words over the filtered file scope
def count_words(p):
    try:
        return len(p.read_text(encoding='utf-8', errors='ignore').split())
    except Exception:
        return 0

exts_doc = {'.md', '.txt', '.html'}
words = 0
allf = [f for v in detect['files'].values() for f in v]
for f in allf:
    p = Path(f)
    if p.suffix.lower() in exts_doc or p.suffix.lower() in {'.py', '.ts', '.js', '.tsx', '.sql'}:
        words += count_words(p)
detect['total_words'] = words
Path('.graphify_detect.json').write_text(json.dumps(detect, indent=2), encoding='utf-8')
print(f'recomputed corpus words: {words:,}')

from graphify.benchmark import run_benchmark, print_benchmark
result = run_benchmark('graphify-out/graph.json', corpus_words=words)
print_benchmark(result)
