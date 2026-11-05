#!/usr/bin/env python3
"""Download ClinGen gene-disease validity and dosage curations and write data/clingen.json.

ClinGen's website sends no CORS headers, so the page cannot query it directly. This script
(run weekly by .github/workflows/clingen.yml, or by hand) turns the two public CSV downloads
into one compact JSON file served next to index.html. Standard library only.

    python3 tools/build_clingen.py            # writes data/clingen.json
"""
import csv, io, json, os, sys, urllib.request
from datetime import date

VALIDITY = 'https://search.clinicalgenome.org/kb/gene-validity/download'
DOSAGE = 'https://search.clinicalgenome.org/kb/gene-dosage/download'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'clingen.json')


def rows(url, first_col):
    req = urllib.request.Request(url, headers={'User-Agent': 'VariantOne-ClinGen-bundle/1.0'})
    with urllib.request.urlopen(req, timeout=120) as r:
        text = r.read().decode('utf-8-sig')
    rd = list(csv.reader(io.StringIO(text)))
    head = next(i for i, r in enumerate(rd) if r and r[0].strip().upper() == first_col)
    cols = [c.strip().upper() for c in rd[head]]
    out = []
    for r in rd[head + 1:]:
        if not r or r[0].startswith('+++') or len(r) < len(cols):
            continue
        out.append(dict(zip(cols, (c.strip() for c in r))))
    if not out:
        sys.exit(f'No rows parsed from {url}')
    return out


def main():
    genes = {}   # HGNC id -> {"s": symbol, "v": [...validity], "d": [...dosage]}

    def gene(hgnc, sym):
        g = genes.setdefault(hgnc, {'s': sym})
        g['s'] = sym or g['s']
        return g

    for r in rows(VALIDITY, 'GENE SYMBOL'):
        rep = r['ONLINE REPORT'].rsplit('/', 1)[-1]
        gene(r['GENE ID (HGNC)'], r['GENE SYMBOL']).setdefault('v', []).append([
            r['DISEASE LABEL'], r['DISEASE ID (MONDO)'], r['MOI'], r['CLASSIFICATION'],
            r['CLASSIFICATION DATE'][:10], rep, r['GCEP']])
    for r in rows(DOSAGE, 'GENE SYMBOL'):
        gene(r['HGNC ID'], r['GENE SYMBOL'])['d'] = [r['HAPLOINSUFFICIENCY'], r['TRIPLOSENSITIVITY'], r['DATE'][:10]]

    for g in genes.values():
        g.get('v', []).sort(key=lambda x: x[4], reverse=True)
    try:   # leave the file untouched when nothing but the date would change (keeps the weekly job quiet)
        with open(OUT, encoding='utf-8') as f:
            if json.load(f).get('genes') == genes:
                print(f'{OUT}: unchanged ({len(genes)} genes)')
                return
    except (OSError, ValueError):
        pass
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump({'updated': date.today().isoformat(), 'source': 'https://search.clinicalgenome.org', 'genes': genes},
                  f, ensure_ascii=False, separators=(',', ':'))
    print(f'{OUT}: {len(genes)} genes, {sum(len(g.get("v", [])) for g in genes.values())} validity curations, '
          f'{sum(1 for g in genes.values() if "d" in g)} dosage curations')


if __name__ == '__main__':
    main()
