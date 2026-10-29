# ERP_Real_Estate — Agent Instructions

Project-wide rules for AI agents working in this repository. Session-by-session history lives in `memory.md`; detailed design docs live in `docs/`.

## Project graph (query BEFORE searching)

A persistent knowledge graph of this codebase exists at `graphify-out/graph.json`
(4,300+ nodes, 14,000+ edges, 266 labeled communities; corpus ≈ 473K words).

Before grepping or mass-reading files to answer "where/how/what" questions about the codebase, **query the graph first** — it answers in ~2K tokens with citations instead of ~10–50K tokens of file scanning:

```
/graphify query "<question>"          # broad map (BFS, nearest neighbors)
/graphify query "<question>" --dfs    # trace one specific dependency path
/graphify path "<Node A>" "<Node B>"  # shortest chain between two concepts
/graphify explain "<node name>"       # everything connected to one node
/graphify query "<question>" --budget 1000   # cap answer at ~N tokens
```

Rules of engagement:

1. Treat graph answers as a **map, not truth**: each edge is tagged EXTRACTED (explicit in source), INFERRED (model-reasoned), or AMBIGUOUS (needs review). Cited `source_file` paths tell you which 2–3 files to actually read and verify.
2. Use the graph to find *entry points* (node labels include community names like "Lease Rules Engine", "Storage S3 API Routes", "Visitor Requests Backend", "Auth Pages"), then read those files for exact current code.
3. Interactive overview: open `graphify-out/graph.html` in a browser. Full audit report: `graphify-out/GRAPH_REPORT.md`.
4. **After finishing a batch of changes**, refresh the graph so the next session sees current structure:

   ```
   /graphify . --update        # incremental: only new/changed files re-extracted
                               # (code-only changes are free — AST pass, no LLM)
   ```

   Or run it in the background while working: `python -m graphify.watch . --debounce 3`
5. Graph questions/answers get saved back into the graph automatically — repeated agent questions become permanent nodes over time.
