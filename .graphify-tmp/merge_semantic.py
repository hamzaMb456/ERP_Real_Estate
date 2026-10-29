import json
from pathlib import Path

base = Path('.graphify-tmp/semantic')
cached = Path('.graphify_cached.json')
cached_data = json.loads(cached.read_text(encoding='utf-8')) if cached.exists() else {'nodes': [], 'edges': [], 'hyperedges': []}

all_nodes, all_edges, all_hyperedges = [], [], []
ok, bad = [], []
for i in range(1, 38):
    p = base / f'chunk_{i:02d}.json'
    if not p.exists():
        bad.append((i, 'missing'))
        continue
    try:
        d = json.loads(p.read_text(encoding='utf-8'))
        assert 'nodes' in d and 'edges' in d
    except Exception as e:
        bad.append((i, f'invalid: {e}'))
        continue
    ok.append(i)
    all_nodes.extend(d.get('nodes', []))
    all_edges.extend(d.get('edges', []))
    all_hyperedges.extend(d.get('hyperedges', []))

print(f'chunks ok: {len(ok)}, bad: {len(bad)}')
for i, why in bad:
    print(f'  BAD chunk {i}: {why}')

# Dedupe nodes by id
seen = set()
deduped = []
for n in all_nodes:
    if n and n.get('id') and n['id'] not in seen:
        seen.add(n['id'])
        deduped.append(n)

merged = {
    'nodes': cached_data['nodes'] + deduped,
    'edges': cached_data['edges'] + all_edges,
    'hyperedges': cached_data.get('hyperedges', []) + all_hyperedges,
    'input_tokens': 0,
    'output_tokens': 0,
}
Path('.graphify_semantic.json').write_text(json.dumps(merged, indent=2), encoding='utf-8')
print(f'semantic merged: {len(merged["nodes"])} unique nodes, {len(merged["edges"])} edges, {len(merged["hyperedges"])} hyperedges')

# Part C: merge AST + semantic
ast = json.loads(Path('.graphify_ast.json').read_text(encoding='utf-8'))
seen_ast = {n['id'] for n in ast['nodes']}
merged_nodes = list(ast['nodes'])
for n in merged['nodes']:
    if n['id'] not in seen_ast:
        merged_nodes.append(n)
        seen_ast.add(n['id'])

final = {
    'nodes': merged_nodes,
    'edges': ast['edges'] + merged['edges'],
    'hyperedges': merged.get('hyperedges', []),
    'input_tokens': 0,
    'output_tokens': 0,
}
Path('.graphify_extract.json').write_text(json.dumps(final, indent=2), encoding='utf-8')
print(f'FINAL extract: {len(final["nodes"])} nodes, {len(final["edges"])} edges ({len(ast["nodes"])} AST + {len(merged["nodes"])} semantic), {len(final["hyperedges"])} hyperedges')
