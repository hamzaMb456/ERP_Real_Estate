import json
from collections import Counter
from pathlib import Path

analysis = json.loads(Path('.graphify_analysis.json').read_text(encoding='utf-8'))
extraction = json.loads(Path('.graphify_extract.json').read_text(encoding='utf-8'))

label_of = {n['id']: n.get('label', n['id']) for n in extraction['nodes']}
communities = {int(k): v for k, v in analysis['communities'].items()}

sizes = sorted(((cid, [i for i in members if i in label_of]) for cid, members in communities.items()), key=lambda x: -len(x[1]))
lines = []
for cid, members in sizes:
    topterms = Counter()
    for i in members:
        lab = label_of[i].lower()
        for w in lab.replace('-', ' ').replace('_', ' ').replace('.', ' ').split():
            if len(w) > 3:
                topterms[w] += 1
    top_labels = [label_of[i] for i in members[:8]]
    lines.append(f'{cid}\t{len(members)}\t{"; ".join(top_labels)[:220]}')

Path('.graphify-tmp/community_summary.tsv').write_text('\n'.join(lines), encoding='utf-8')
print(f'{len(sizes)} communities written to .graphify-tmp/community_summary.tsv')
big = [s for s in sizes if len(s[1]) >= 15]
print(f'communities >= 15 nodes: {len(big)} covering {sum(len(m) for _, m in big)} nodes')
