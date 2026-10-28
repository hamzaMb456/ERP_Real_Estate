# -*- coding: utf-8 -*-
from pypdf import PdfReader

r = PdfReader(r'C:\Users\mbark\Downloads\Hamza_MBARKI_Resume_FR_FullStack_DevOps.pdf')
t2 = (r.pages[1].extract_text() or '').strip()
print(len(t2), 'chars on page 2:')
print(t2)
