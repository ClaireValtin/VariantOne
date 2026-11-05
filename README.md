# VariantOne

One variant, every source, one screen. Paste an HGVS and VariantOne shows, side by side:

| Card | Source | How it is reached |
|---|---|---|
| Nomenclature | VariantValidator (GRCh38, MANE Select by default) | direct |
| ClinVar | NCBI E-utilities — exact match on canonical SPDI (indels included, repeat-aware) or on `cdna_change` (the transcript prefix ClinVar sometimes adds is stripped); same-codon variants for PS1/PM5; haplotype records | direct |
| GeneBe | automatic ACMG criteria and score | relay |
| gnomAD v4.1 | joint AF, AC/AN, homozygotes, FAF95 max, genetic ancestry groups (Middle Eastern highlighted), filters | direct |
| Splicing | SpliceAI-lookup and Pangolin (Broad), MANE transcript | direct |
| In-silico | CADD v1.7 (relay, falls back to MobiDetails), REVEL, AlphaMissense, BayesDel, phyloP, all MobiDetails predictions | relay / direct |
| Gene | ClinGen gene–disease validity and dosage, gnomAD constraint, VCEP specification | bundled `data/clingen.json` / direct |
| Literature | LitVar2 (by rsID), PubTator3, PubMed titles; PubMed search when the relay is down | relay / direct |
| Links | Atelier ACMG worksheet, Franklin, VarSome, DECIPHER, UCSC, Ensembl, LOVD, GeneReviews, PanelApp, CSpec | — |

Accepted input: `NM_000551.4:c.191G>C`, `NM_000551.4(VHL):c.191G>C`, `VHL c.191G>C`, `NC_000003.12:g.10142038G>C`,
`3-10142038-G-C` (GRCh38), `rs5030809`. The URL keeps the variant (`…/VariantOne/#NM_000551.4%3Ac.191G%3EC`) so a
lookup can be bookmarked or sent to a colleague. **Copy summary** puts a plain-text summary on the clipboard.

Only variant descriptions and genomic coordinates leave the browser; no patient data is entered. Settings (relay URLs,
optional GeneBe / MobiDetails / NCBI keys), the theme and the recent-variant list are stored in this browser only.

## Files

- `index.html` — the whole app (annotation code adapted from SangerScope).
- `data/clingen.json` — ClinGen validity and dosage curations. ClinGen sends no CORS headers, so the data is bundled.
  `.github/workflows/clingen.yml` refreshes it every Monday (and on demand: Actions → *Refresh ClinGen data* → Run
  workflow). By hand: `python3 tools/build_clingen.py`.
- `relay/variantone-relay.js` — Cloudflare Worker shared with SangerScope: GeneBe, CADD, LitVar2 and PubTator3.

## The relay: one worker for SangerScope and VariantOne

No new worker is needed. `relay/variantone-relay.js` is SangerScope's GeneBe relay with three extra read-only routes
(CADD, LitVar2, PubTator3). GeneBe requests are handled exactly as before, so SangerScope keeps working.

1. https://dash.cloudflare.com → **Workers & Pages** → **sangerscope-genebe** → **Edit code**.
2. Select everything, paste the contents of `relay/variantone-relay.js` → **Deploy**.
3. Nothing to change in VariantOne: its default relay is already `https://sangerscope-genebe.rehiouisoufiyan.workers.dev`.
   Both apps live on `https://clairevaltin.github.io`, which the worker already allows.

The worker refuses other websites (403) and unknown paths (404), stores and logs nothing, and lets Cloudflare cache the
CADD / literature answers for a day. Free plan: 100,000 requests/day, shared by both apps.

Until the new code is deployed, the CADD score comes from MobiDetails and the literature card falls back to a PubMed
search; GeneBe works either way.

## GitHub Pages

Settings → Pages → Deploy from branch → `main` / root. The site will be https://clairevaltin.github.io/VariantOne/. Allow the workflow to push the ClinGen refresh:
Settings → Actions → General → Workflow permissions → *Read and write*.

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 (GeneBe is reached directly from `localhost`; `file://` cannot load the ClinGen data).

For laboratory use with expert review: automatic summaries and GeneBe criteria support, but never replace, ACMG/AMP
classification by the lab.
