# -*- coding: utf-8 -*-
"""Extract all raster images from the PFE report into a flat folder."""
import os
from pypdf import PdfReader

SRC = r"C:\Users\mbark\Downloads\main (1).pdf"
OUT = r"C:\Users\mbark\Projects\ERP_Real_Estate\infra\amplify-data\metrics\pfe-img"
os.makedirs(OUT, exist_ok=True)

r = PdfReader(SRC)
n = 0
for i, page in enumerate(r.pages):
    for img in page.images:
        fork = f"p{i + 1:02d}_{img.name}"
        with open(os.path.join(OUT, fork), "wb") as f:
            f.write(img.data)
        n += 1
print("extracted:", n, "->", OUT)
