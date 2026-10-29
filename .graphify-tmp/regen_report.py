import json
from graphify.build import build_from_json
from graphify.cluster import score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from graphify.export import to_json, to_html
from pathlib import Path

extraction = json.loads(Path('.graphify_extract.json').read_text(encoding='utf-8'))
detection = json.loads(Path('.graphify_detect.json').read_text(encoding='utf-8'))
analysis = json.loads(Path('.graphify_analysis.json').read_text(encoding='utf-8'))
labels_raw = json.loads(Path('.graphify-tmp/labels.json').read_text(encoding='utf-8'))
labels = {int(k): v for k, v in labels_raw.items()}

G = build_from_json(extraction)
communities = {int(k): v for k, v in analysis['communities'].items()}
cohesion = {int(k): v for k, v in analysis['cohesion'].items()}
tokens = {'input': extraction.get('input_tokens', 0), 'output': extraction.get('output_tokens', 0)}

questions = suggest_questions(G, communities, labels)
report = generate(G, communities, cohesion, labels, analysis['gods'], analysis['surprises'], detection, tokens, '.', suggested_questions=questions)
Path('graphify-out/GRAPH_REPORT.md').write_text(report, encoding='utf-8')
to_json(G, communities, 'graphify-out/graph.json')
Path('.graphify_labels.json').write_text(json.dumps({str(k): v for k, v in labels.items()}), encoding='utf-8')
print('Report updated with community labels')

if G.number_of_nodes() > 5000:
    print(f'Graph has {G.number_of_nodes()} nodes - too large for HTML viz. Use Obsidian vault instead.')
else:
    to_html(G, communities, 'graphify-out/graph.html', community_labels=labels or None)
    print('graph.html written - open in any browser, no server needed')
