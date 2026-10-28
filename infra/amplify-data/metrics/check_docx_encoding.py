# -*- coding: utf-8 -*-
"""Locate exact mojibake markers in the docx text, encoding-independent output."""
import docx

for lang in ("FR", "EN"):
    d = docx.Document(rf"C:\Users\mbark\Downloads\Hamza_MBARKI_Resume_{lang}_FullStack_DevOps.docx")
    print("=" * 10, lang, "=" * 10)
    for i, p in enumerate(d.paragraphs):
        t = p.text
        if any(ord(c) > 127 for c in t):
            # show codepoints above ASCII in escaped form
            esc = t.encode("unicode_escape").decode("ascii")
            bad = [hex(ord(c)) for c in t if ord(c) > 0x2590]  # not normal Latin-1 accents? dump all >0xFF
            weird = [hex(ord(c)) for c in t if 0x80 <= ord(c) <= 0xFF]  # normal accents are in 0xC0-0xFF...
            # Instead: flag chars in U+0080-U+00C1 range (Ã zone) which should be rare in French
            sus = [hex(ord(c)) for c in t if 0x80 <= ord(c) <= 0xC1]
            if sus:
                print(f"para {i} SUSPICIOUS {sus}")
                print("   esc:", esc[:150])
