# -*- coding: utf-8 -*-
"""Extract full text + image inventory from the PFE report."""
from pypdf import PdfReader

r = PdfReader(r"C:\Users\mbark\Downloads\main (1).pdf")

parts = []
imgs = []
for i, page in enumerate(r.pages):
    parts.append(f"\n===== PAGE {i + 1} =====\n")
    parts.append(page.extract_text() or "")
    try:
        for img in page.images:
            name = img.name
            # only record raster images (skip duplicate inline floats info later)
            imgs.append((i + 1, name, len(img.data)))
    except Exception as e:
        imgs.append((i + 1, f"<error: {e}>", 0))

out = open(r"C:\Users\mbark\Projects\ERP_Real_Estate\infra\amplify-data\metrics\pfe-report-text.txt", "w", encoding="utf-8")
out.write("".join(parts))
out.close()

lines = f"total images: {len(imgs)}\n"
for p, n, s in imgs:
    lines += f"page {p}: {n} ({s / 1024:.0f} KB)\n"
open(r"C:\Users\mbark\Projects\ERP_Real_Estate\infra\amplify-data\metrics\pfe-report-images.txt", "w", encoding="utf-8", errors="replace").write(lines)
print("text saved;", len(imgs), "raster image refs")
