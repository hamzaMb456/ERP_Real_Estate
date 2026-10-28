# -*- coding: utf-8 -*-
from pypdf import PdfReader

for lang in ("FR", "EN"):
    path = rf"C:\Users\mbark\Downloads\Hamza_MBARKI_Resume_{lang}_FullStack_DevOps.pdf"
    r = PdfReader(path)
    txt = "\n".join((p.extract_text() or "") for p in r.pages)
    f = txt.replace("\n", " ").replace(" ", "").lower()
    needles = {
        "Certifications (AWS/Hashgraph/OPTIMIZI)": ("awsacademy" in f and "hashgraph" in f and ("attestationdestage" in f or "internshipattestation" in f)),
        "badge 20h": ("20h" in f or "20hours" in f),
        "dates exactes OPTIMIZI": ("16janv" in f or "jan16" in f),
        "7ML+RAG": ("7mod" in f or "7ml" in f) and "rag" in f,
        "99 tests smoke+unit": ("99testsverts(smoke+unitaires)" in f or "99smoke+unittests" in f),
        "Sonar 74,8% / 88k": ("74.8%" in f or "74,8%" in f) and "88k" in f,
        "Trivy images/containers 0CVE": ("images&containers" in f or "image&container" in f),
        "Prometheus/Pushgateway/Grafana": ("prometheus" in f and "pushgateway" in f and "grafana" in f),
        "MAE/C-index/AUC": ("14.95" in f or "14,95" in f) and ("c-index" in f) and ("0.83" in f or "0,83" in f),
        "ERP 23stacks/147req": ("23stacks" in f and "147req/s" in f),
        "Kinesis+CloudWatch": ("kinesis" in f and "cloudwatch" in f),
        "Forcka MongoDB": ("forkina" in f and "mongodb" in f),
        "Azure absent de Forkina": "forkinary" not in f.replace("académiques", "") ,  # cheap guard
    }
    moji = [x for x in ["Ã©", "Ã¨", "Ã ", "Ã‰"] if x in txt]
    print(f"=== {lang} — {len(r.pages)} page(s) | mojibake: {moji if moji else 'none'}")
    for k, ok in needles.items():
        print(f"  [{'OK' if ok else 'MISS'}] {k}")
