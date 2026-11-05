/*
 * VariantOne relay (Cloudflare Worker) — CADD, LitVar2 and PubTator3.
 *
 * Why: these three services send no CORS headers, so a page on GitHub Pages cannot read their answers.
 * This worker forwards a short list of read-only GET requests server-side and returns the answer with
 * CORS headers for your site only.
 *
 * What passes through: variant descriptions only (genomic coordinates such as 3:10142038_G_C, rsIDs,
 * "VHL p.Arg64Pro"). No patient data. The worker stores and logs nothing; answers are cached by
 * Cloudflare's edge for a day to spare the upstream services.
 *
 *   /cadd/<version>/<chr>:<pos>[_<ref>_<alt>]   → https://cadd.gs.washington.edu/api/v1.0/<version>/…
 *   /litvar2-api/variant/…                       → https://www.ncbi.nlm.nih.gov/research/litvar2-api/variant/…
 *   /pubtator3-api/search/?text=…                → https://www.ncbi.nlm.nih.gov/research/pubtator3-api/search/…
 *
 * Settings (Cloudflare dashboard → the worker → Settings → Variables and Secrets):
 *   ALLOWED_ORIGINS  (text, optional)  comma-separated page origins allowed to use the relay.
 *                                      Default: https://clairevaltin.github.io
 */
const ROUTES = [
  {re: /^\/cadd\/(GRCh3[78]-v1\.[67])\/([0-9XYMT]{1,2}):(\d{1,9})(_[ACGTN]{1,200}_[ACGTN]{1,200})?$/i,
   to: m => `https://cadd.gs.washington.edu/api/v1.0/${m[1]}/${m[2]}:${m[3]}${m[4] || ''}`},
  {re: /^\/litvar2-api\/variant\/(autocomplete\/|get\/[^/]+(\/publications)?\/?)$/,
   to: (m, url) => `https://www.ncbi.nlm.nih.gov/research${url.pathname}${url.search}`},
  {re: /^\/pubtator3-api\/(search\/|publications\/export\/biocjson)$/,
   to: (m, url) => `https://www.ncbi.nlm.nih.gov/research${url.pathname}${url.search}`},
];

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGINS || 'https://clairevaltin.github.io').split(',').map(s => s.trim()).filter(Boolean);
    const origin = request.headers.get('origin') || '';
    const ok = allowed.includes(origin);
    const cors = ok ? {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
      'vary': 'Origin',
    } : {'vary': 'Origin'};
    const reply = (status, text) => new Response(text, {status, headers: {...cors, 'content-type': 'text/plain'}});

    if (!ok) return reply(403, 'Origin not allowed');
    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors});
    if (request.method !== 'GET') return reply(405, 'Method not allowed');

    const url = new URL(request.url);
    let target = null;
    for (const r of ROUTES) { const m = url.pathname.match(r.re); if (m) { target = r.to(m, url); break; } }
    if (!target) return reply(404, 'Not found');

    let res;
    try {
      res = await fetch(target, {
        headers: {'accept': 'application/json', 'user-agent': 'VariantOne-relay/1.0'},
        cf: {cacheTtl: 86400, cacheEverything: true},
      });
    } catch (e) {
      return reply(502, 'Upstream unreachable: ' + e.message);
    }
    return new Response(res.body, {status: res.status, headers: {...cors, 'content-type': res.headers.get('content-type') || 'application/json'}});
  },
};
