# -*- coding: utf-8 -*-
"""Show tail of CV-notes (safely, ascii-escaped)."""
raw = open(r"C:\Users\mbark\Projects\ERP_Real_Estate\infra\amplify-data\metrics\CV-notes-2026-10-27.md", "rb").read()
text = raw.decode("utf-8")
lines = text.splitlines()
print(len(lines), "lines; last 8 (ascii-escaped):")
for l in lines[-8:]:
    print(l.encode("ascii", "replace").decode("ascii"))
