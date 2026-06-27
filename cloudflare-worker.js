/**
 * Cloudflare Worker – CORS-proxy för aktie-verktyget OCH nyhetsbanderollen.
 *
 * Varför: sidan hämtar aktiekurser från Yahoo Finance och nyhetsrubriker från
 * svenska RSS-flöden. Inget av dem skickar CORS-headers, så webbläsaren
 * blockerar anropen. Den här lilla proxyn lägger på CORS och gör datan stabil
 * och snabb – utan API-nyckel och utan skakiga publika proxyer.
 *
 * Den släpper bara igenom en vitlista av domäner (ingen öppen proxy).
 *
 * ── Deploya (gratis, ~2 min) ─────────────────────────────────────────────
 *  Se de numrerade stegen i chatten. Kort:
 *   1. dash.cloudflare.com → Workers & Pages → Create → Worker → Deploy
 *   2. Edit code → klistra in HELA den här filen → Deploy
 *   3. Kopiera Worker-URL:en (t.ex. https://proxy.DITTNAMN.workers.dev)
 *   4. I index.html, fyll i:  window.PROXY_WORKER = 'https://proxy.DITTNAMN.workers.dev';
 *
 * Anropet sidan gör:  <WORKER_URL>?url=<urlencodad mål-URL>
 */

const ALLOWED = [
  /^https:\/\/query[12]\.finance\.yahoo\.com\//,  // aktier (Yahoo Finance)
  /^https:\/\/www\.dn\.se\//,                      // nyheter: DN
  /^https:\/\/www\.svt\.se\//,                     // nyheter: SVT
  /^https:\/\/feeds\.expressen\.se\//,             // nyheter: Expressen
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const target = new URL(request.url).searchParams.get('url');
    if (!target || !ALLOWED.some((re) => re.test(target))) {
      return new Response('URL ej tillåten.', { status: 400, headers: CORS });
    }

    try {
      const upstream = await fetch(target, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*' },
        cf: { cacheTtl: 60, cacheEverything: true },
      });
      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: {
          ...CORS,
          'Content-Type': upstream.headers.get('Content-Type') || 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=60',
        },
      });
    } catch (err) {
      return new Response('Kunde inte hämta: ' + err, { status: 502, headers: CORS });
    }
  },
};
