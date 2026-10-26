/* The game's service worker (1.7 sw.js, O1): a network-first browser cache, plus the installed copy's complete
 * revision snapshots that src/platform/offline.js stores and commits.
 * - Every same-origin GET goes to the network first and a copy is kept in the control cache; with no network the
 *   copy answers.
 * - An installed page whose build has a complete snapshot loads its files from that snapshot (fast, and the same
 *   revision as its page); with no network a navigation opens the active snapshot's page.
 * - A request carrying ?forge-offline-verify=<build> always goes to the network and is marked, so offline.js never
 *   stores an old cached copy as the new revision. build.json is never answered from a cache.
 * Registered only by a stamped release build (index.html meta forge-build); the dev server's pages never use it. */
importScripts('offline-protocol.js');   // the names shared with the page (self.FORGE_OFFLINE)
var P = self.FORGE_OFFLINE;
var CACHE = P.CACHE;
var SCOPE = new URL('./', self.location.href).href;
var POINTER = new URL(P.POINTER, SCOPE).href;
var CLIENTS = new URL(P.CLIENTS, SCOPE).href;
var RECEIPT = new URL(P.RECEIPT, SCOPE).href;
var PREFIX = P.REVISION;
var OLD_CONTROL = new RegExp('^' + P.PREFIX + 'v[0-9]+$');   // an earlier control cache (forge2-v<n>)

function key(url) { var u = new URL(url, self.location.href); u.search = ''; u.hash = ''; return u.toString(); }
function unavailable() { return new Response('offline', { status: 503, headers: { 'Content-Type': 'text/plain' } }); }
async function json(cache, url) { var r = await cache.match(url); return r ? r.json() : null; }

async function rememberClient(id, built) {
  if (!id || typeof built !== 'string') return;
  var cache = await caches.open(CACHE);
  await cache.put(CLIENTS + encodeURIComponent(id), new Response(JSON.stringify({ built: built })));
}
async function rememberNavigation(ev, res) {
  if (ev.request.mode !== 'navigate' || !res || res.status !== 200) return res;
  var m = /<meta\s+name=["']forge-build["']\s+content=["']([^"']+)["']/.exec(await res.clone().text());
  if (m) await rememberClient(ev.resultingClientId || ev.clientId, m[1]);
  return res;
}
/** The complete snapshot of a build, or null (its receipt names the build: a half-stored one has none). */
async function snapshotFor(built) {
  if (!built) return null;
  var name = PREFIX + encodeURIComponent(built);
  if (!(await caches.keys()).includes(name)) return null;
  var snap = await caches.open(name), receipt = await json(snap, RECEIPT);
  return receipt && receipt.built === built ? snap : null;
}

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (ev) {
  ev.waitUntil(caches.keys().then(function (names) {
    return Promise.all(names.filter(function (n) { return OLD_CONTROL.test(n) && n !== CACHE; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('message', function (ev) {
  var d = ev.data;
  if (d && d.type === P.CLIENT_MESSAGE && ev.source && ev.source.id) ev.waitUntil(rememberClient(ev.source.id, d.built));
});

async function fallback(ev) {
  var req = ev.request, control = await caches.open(CACHE), active = await json(control, POINTER);
  var client = ev.clientId ? await json(control, CLIENTS + encodeURIComponent(ev.clientId)) : null;
  var snap = await snapshotFor(req.mode === 'navigate' ? active && active.built : client && client.built);
  if (snap) {
    var hit = await snap.match(key(req.url));
    if (!hit && req.mode === 'navigate') hit = await snap.match(key('index.html'));
    if (hit) return rememberNavigation(ev, hit);
  }
  var kept = await control.match(key(req.url));
  if (!kept && req.mode === 'navigate') kept = await control.match(key('index.html'));
  return kept ? rememberNavigation(ev, kept) : unavailable();
}

self.addEventListener('fetch', function (ev) {
  var req = ev.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  var verify = url.searchParams.get(P.VERIFY);
  if (verify !== null) {
    ev.respondWith(fetch(req, { cache: 'no-store' }).then(function (res) {
      if (!res || res.status !== 200) return res || unavailable();
      var headers = new Headers(res.headers); headers.set(P.VERIFIED, verify);
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers: headers });
    }).catch(unavailable));
    return;
  }
  if (url.pathname === new URL('build.json', SCOPE).pathname) { ev.respondWith(fetch(req, { cache: 'no-store' }).catch(unavailable)); return; }
  ev.respondWith((async function () {
    if (req.mode !== 'navigate' && ev.clientId) {
      var control = await caches.open(CACHE), client = await json(control, CLIENTS + encodeURIComponent(ev.clientId));
      var snap = client && await snapshotFor(client.built), pinned = snap && await snap.match(key(req.url));
      if (pinned) return pinned;
    }
    try {
      var res = req.mode === 'navigate' ? await fetch(req.url, { cache: 'no-store', credentials: 'same-origin' }) : await fetch(req, { cache: 'no-cache' });
      if (res && res.status === 200) {
        var copy = res.clone();
        ev.waitUntil(caches.open(CACHE).then(function (c) { return c.put(key(req.url), copy); }));
        return rememberNavigation(ev, res);
      }
      return res;
    } catch (e) { return fallback(ev); }
  })());
});
