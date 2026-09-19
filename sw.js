/* Service worker (2026-09-17).

   Two jobs:
   1. OFFLINE: on install, pull down every file the build contains (dist/precache.json, written by
      tools/deploy.py - about 22 MB, 300 files) so the game runs with no network at all. Caching only what
      had been fetched meant an offline launch was missing whichever monster sheets, atlases and sounds you
      had not happened to meet yet.
   2. UPDATES: network first. Whenever the device can reach the server it takes the fresh copy, so a patch
      arrives on the next launch with no reinstall; the cache answers only when the network does not.

   demo.html loads every script with a fresh ?v= tag, so cache keys drop the query - otherwise each load
   would store another copy and nothing would ever match offline.
*/
var CACHE = 'fote-v4';   /* 2026-09-19: v4 fetches the page itself by URL, never from any cache */

function key(url){ var u = new URL(url, location.href); u.search = ''; return u.toString(); }

self.addEventListener('install', function(ev){
  self.skipWaiting();
  ev.waitUntil((async function(){
    var cache = await caches.open(CACHE);
    var list = [];
    try {
      var res = await fetch('precache.json', {cache:'no-store'});
      if(res.ok) list = await res.json();
    } catch(e){}
    if(!list.length) list = ['', 'index.html', 'demo.html', 'game.js', 'manifest.json'];
    /* in batches: 300 parallel requests on a phone is a good way to have several of them fail */
    for(var i=0; i<list.length; i+=12){
      await Promise.all(list.slice(i, i+12).map(async function(path){
        try {
          var r = await fetch(path, {cache:'no-store'});
          if(r && r.status===200) await cache.put(key(path), r.clone());
        } catch(e){}                                   /* a missing file must not fail the install */
      }));
    }
    try { var root = await fetch('./', {cache:'no-store'}); if(root.ok) await cache.put(key('./'), root.clone()); } catch(e){}
  })());
});

self.addEventListener('activate', function(ev){
  ev.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener('fetch', function(ev){
  var req = ev.request;
  if(req.method!=='GET' || new URL(req.url).origin!==location.origin) return;
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
