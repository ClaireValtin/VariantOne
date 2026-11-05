/*
 * Combined relay for SangerScope and VariantOne (Cloudflare Worker).
 * Paste this over the existing "sangerscope-genebe" worker: GeneBe keeps working exactly as before for
 * SangerScope, and VariantOne gets CADD, LitVar2 and PubTator3 through the same worker.
 *
 * Why: these services send no CORS headers (GeneBe only accepts localhost and genebe.net), so a page on
 * GitHub Pages cannot read their answers. The worker forwards an allow-list of requests server-side and
 * returns the answer with CORS headers for your site only.
 *
 * What passes through: variant descriptions only (genomic coordinates, rsIDs, "VHL p.Arg64Pro").
 * No reads, traces or patient data. The worker stores and logs nothing.
 *
 *   /cloud/api-public/v1/variant(s)              → https://api.genebe.net/…   (GET, POST)  — SangerScope & VariantOne
 *   /cadd/<version>/<chr>:<pos>[_<ref>_<alt>]    → https://cadd.gs.washington.edu/api/v1.0/<version>/…  (GET)
 *   /litvar2-api/variant/…                        → https://www.ncbi.nlm.nih.gov/research/litvar2-api/variant/…  (GET)
 *   /pubtator3-api/search/?text=…                 → https://www.ncbi.nlm.nih.gov/research/pubtator3-api/search/…  (GET)
 *
 * Settings (Cloudflare dashboard → the worker → Settings → Variables and Secrets):
 *   ALLOWED_ORIGINS  (text, optional)    comma-separated page origins allowed to use the relay.
 *                                        Default: https://clairevaltin.github.io
 *   GENEBE_USER      (secret, optional)  GeneBe account e-mail  } fallback for users who entered no key of their
 *   GENEBE_KEY       (secret, optional)  GeneBe API key         } own. Not recommended: anyone who can call the relay
 *                                                                  (the Origin check stops browsers, not scripts) would
 *                                                                  spend this account's GeneBe quota.
 */
const GENEBE = /^\/cloud\/api-public\/v1\/variants?$/;   // /variant (GET, one variant) and /variants (POST, batch)
const READ_ONLY = [   // GET only; answers cached by Cloudflare for a day to spare the upstream services
  {re: /^\/cadd\/(GRCh3[78]-v1\.[67])\/([0-9XYMT]{1,2}):(\d{1,9})(_[ACGTN]{1,200}_[ACGTN]{1,200})?$/i,
   to: m => `https://cadd.gs.washington.edu/api/v1.0/${m[1]}/${m[2]}:${m[3]}${m[4] || ''}`},
  {re: /^\/litvar2-api\/variant\/(autocomplete\/|get\/[^/]+(\/publications)?\/?)$/,
   to: (m, url) => `https://www.ncbi.nlm.nih.gov/research${url.pathname}${url.search}`},
  {re: /^\/pubtator3-api\/search\/$/,
   to: (m, url) => `https://www.ncbi.nlm.nih.gov/research${url.pathname}${url.search}`},
];

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGINS || 'https://clairevaltin.github.io').split(',').map(s => s.trim()).filter(Boolean);
    const origin = request.headers.get('origin') || '';
    const ok = allowed.includes(origin);
    const cors = ok ? {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
      'access-control-max-age': '86400',
      'vary': 'Origin',
    } : {'vary': 'Origin'};
    const reply = (status, text) => new Response(text, {status, headers: {...cors, 'content-type': 'text/plain'}});
    const pass = res => new Response(res.body, {status: res.status, headers: {...cors, 'content-type': res.headers.get('content-type') || 'application/json'}});

    if (!ok) return reply(403, 'Origin not allowed');
    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors});
    const url = new URL(request.url);

    // GeneBe (unchanged from SangerScope's relay/genebe-relay.js)
    if (GENEBE.test(url.pathname)) {
      if (request.method !== 'GET' && request.method !== 'POST') return reply(405, 'Method not allowed');
      const headers = {'accept': 'application/json'};
      if (request.method === 'POST') headers['content-type'] = 'application/json';
      // The user's own key (entered in the app's Settings) always wins; the worker's key is only a fallback.
      if (request.headers.get('authorization')) headers.authorization = request.headers.get('authorization');
      else if (env.GENEBE_USER && env.GENEBE_KEY) headers.authorization = 'Basic ' + btoa(`${env.GENEBE_USER}:${env.GENEBE_KEY}`);
      try {
        return pass(await fetch('https://api.genebe.net' + url.pathname + url.search, {
          method: request.method, headers, body: request.method === 'POST' ? await request.text() : undefined,
        }));
      } catch (e) { return reply(502, 'GeneBe unreachable: ' + e.message); }
    }

    // CADD, LitVar2, PubTator3
    let target = null;
    for (const r of READ_ONLY) { const m = url.pathname.match(r.re); if (m) { target = r.to(m, url); break; } }
    if (!target) return reply(404, 'Not found');
    if (request.method !== 'GET') return reply(405, 'Method not allowed');
    try {
      return pass(await fetch(target, {
        headers: {'accept': 'application/json', 'user-agent': 'VariantOne-relay/1.0'},
        cf: {cacheTtl: 86400, cacheEverything: true},
      }));
    } catch (e) { return reply(502, 'Upstream unreachable: ' + e.message); }
  },
};
