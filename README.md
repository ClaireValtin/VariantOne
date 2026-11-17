# VariantOne

One variant, every source, one screen.

**Open it:** https://clairevaltin.github.io/VariantOne/

## What it does

Type a single variant (HGVS such as `VHL c.191G>C`, genomic coordinates such as `3-10142038-G-C`, or an rsID) and VariantOne gathers everything you need to review it on one page:

- **Nomenclature and validation** with VariantValidator
- **Clinical data** from ClinVar and ClinGen (gene–disease validity and dosage)
- **Population frequency** from gnomAD v4.1
- **In-silico predictions** from SpliceAI, Pangolin, CADD, MobiDetails and GeneBe
- **Literature** from PubMed, LitVar2 and PubTator3
- Quick links to Franklin, VarSome, DECIPHER, OMIM, PanelApp, Ensembl and UCSC

The automatic summary supports expert review and ACMG/AMP classification. It does not replace either one.

## How to use

Open the link above in any modern browser. Nothing to install.

Optional API keys (GeneBe, MobiDetails, NCBI) can be added in **Settings** to raise rate limits. They are stored only in your browser.

**Privacy:** only the variant description and its genomic coordinates leave your browser. No patient data is entered or sent.

## Repository contents

- `index.html` – the whole app
- `data/clingen.json` – bundled ClinGen curations, refreshed weekly by a GitHub Action (`tools/build_clingen.py`)
- `relay/variantone-relay.js` – small Cloudflare Worker used for services that block direct browser requests (CADD, LitVar2, PubTator3, GeneBe)

## Disclaimer

**This tool is NOT validated for clinical or diagnostic use.** It is provided for research and educational purposes only, without any warranty.

## License & citation

© 2026 Soufiyan Rehioui. All rights reserved.

You're welcome to explore this code. If you'd like to use, adapt, or share it, please get in touch first: rehiouisoufiyan@gmail.com

If this work helps you, please cite it or link back to this repository.
