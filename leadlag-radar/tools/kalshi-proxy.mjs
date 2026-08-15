#!/usr/bin/env node
// Tiny CORS bridge for Kalshi market data. Zero dependencies.
//
// Why: the Radar polls Kalshi's public REST API for strikes and yes/no prices.
// If Kalshi's API does not send Access-Control-Allow-Origin headers, a browser
// page cannot read it directly. Run this next to the tool:
//
//   node leadlag-radar/tools/kalshi-proxy.mjs
//
// then in the Radar's settings the poller automatically retries through
// http://localhost:8787 when the direct call fails.
//
// GET-only, market-data-only, no auth, no order routing. It forwards exactly
// one host and only /trade-api/v2/ paths.

import http from 'node:http';
import https from 'node:https';

const UPSTREAM = 'api.elections.kalshi.com';
const PORT = parseInt(process.env.PORT || '8787', 10);

const server = http.createServer((req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  if (req.method !== 'GET' || !req.url.startsWith('/trade-api/v2/')) {
    res.writeHead(403, cors); return res.end('forbidden: GET /trade-api/v2/* only');
  }
  const upstream = https.request(
    { hostname: UPSTREAM, path: req.url, method: 'GET', headers: { accept: 'application/json', 'user-agent': 'leadlag-radar-proxy' } },
    up => {
      res.writeHead(up.statusCode || 502, { ...cors, 'content-type': up.headers['content-type'] || 'application/json' });
      up.pipe(res);
    }
  );
  upstream.on('error', e => { res.writeHead(502, cors); res.end(JSON.stringify({ error: String(e) })); });
  upstream.end();
});

server.listen(PORT, () => console.log(`kalshi-proxy: http://localhost:${PORT} → https://${UPSTREAM} (GET /trade-api/v2/* only)`));
