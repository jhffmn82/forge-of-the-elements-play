/* Service worker (2026-09-17, revised 2026-09-27 for Beta 1.3.1).

   Two jobs:
   1. OFFLINE: every file the network delivers is kept in the cache, so whatever a player has already loaded
      reloads with no signal. Installing no longer downloads the whole build: the 705 files dist/precache.json
      lists (written by tools/deploy.py) come to about 122 MB at Beta 1.3.1, and every browser tab that
      registered this worker used to pull all of them on its first visit. Only an installed copy (home-screen
      app, the Android APK) stores the full list; js/offline.js does that from the page, a few files at a time.
   2. UPDATES: network first. Whenever the device can reach the server it takes the fresh copy, so a patch
      arrives on the next launch with no reinstall; the cache answers only when the network does not.

   demo.html loads every script with a fresh ?v= tag, so cache keys drop the query - otherwise each load
   would store another copy and nothing would ever match offline.
*/
var CACHE = 'astra-temple-v2';   /* 1.3.1: art became .webp, so every stored v1 file is stale; activate deletes v1 (~176 MB on installed phones) and an installed copy re-stores the ~122 MB build */

function key(url){ var u = new URL(url, location.href); u.search = ''; return u.toString(); }

self.addEventListener('install', function(){ self.skipWaiting(); });

self.addEventListener('activate', function(ev){
  ev.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){ return k.indexOf('astra-temple-')===0 && k!==CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener('fetch', function(ev){
  var req = ev.request;
  if(req.method!=='GET' || new URL(req.url).origin!==location.origin) return;
  /* A cached manifest cannot establish whether the installed game is current. */
  if(new URL(req.url).pathname===new URL('build.json',location.href).pathname){
    ev.respondWith(fetch(req,{cache:'no-store'}).catch(function(){return new Response('offline',{status:503});}));
    return;
  }
  ev.respondWith(
    /* 2026-09-19: always ask the server first. GitHub Pages marks every file cacheable for 10 minutes and the
       fetch went through that HTTP cache, so a device could open a copy up to 10 minutes old - longer on an
       iPad home-screen app. 'no-cache' revalidates: an unchanged file is a tiny 304, a changed one comes fresh. */
    /* the page itself: re-requested by URL (some Safari versions refuse to copy a navigation request with
       options, and the failure fell through to the cached, old page) and never from the HTTP cache */
    (req.mode==='navigate' ? fetch(req.url, {cache:'no-store', credentials:'same-origin'}) : fetch(req, {cache:'no-cache'})).then(function(res){
      if(res && res.status===200){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(key(req.url), copy); });
      }
      return res;
    }).catch(function(){
      return caches.open(CACHE).then(function(c){ return c.match(key(req.url)); }).then(function(hit){
        if(hit) return hit;
        /* a navigation with nothing cached for it still gets the game shell */
        if(req.mode==='navigate') return caches.open(CACHE).then(function(c){ return c.match(key('index.html')); });
        return new Response('offline', {status:503, headers:{'Content-Type':'text/plain'}});
      });
    })
  );
});
