import json
from pathlib import Path

detect = json.loads(Path('.graphify_detect.json').read_text(encoding='utf-8'))
all_files = [f for files in detect['files'].values() for f in files]

# Code files are handled by AST; only non-code files need semantic extraction
code_exts = {'.py','.ts','.js','.go','.rs','.java','.cpp','.c','.rb','.swift','.kt','.cs','.scala','.php','.cc','.cxx','.hpp','.h','.kts','.lua','.toc','.yml','.yaml','.json','.toml','.ini','.cfg','.sh','.ps1','.sql','.css','.scss','.html','.vue','.jsx','.tsx','.lock','.mod|.graphql'}
non_code = [f for f in all_files if Path(f).suffix.lower() not in code_exts]

try:
    from graphify.cache import check_semantic_cache
    cached_nodes, cached_edges, cached_hyperedges, uncached = check_semantic_cache(all_files)
except Exception:
    cached_nodes, cached_edges, cached_hyperedges = [], [], []
    uncached = non_code

Path('.graphify_uncached.txt').write_text('\n'.join(uncached), encoding='utf-8')
if cached_nodes or cached_edges or cached_hyperedges:
    Path('.graphify_cached.json').write_text(
        json.dumps({'nodes': cached_nodes, 'edges': cached_edges, 'hyperedges': cached_hyperedges}),
        encoding='utf-8')
print(f'{len(all_files)} total, {len(all_files)-len(uncached)} cached, {len(uncached)} need semantic extraction')
print(f'docs: {len([f for f in uncached if "image" not in f.lower()])}, images: {len([f for f in uncached if Path(f).suffix.lower() in {".png",".jpg",".jpeg",".webp",".gif",".svg"}])}')
