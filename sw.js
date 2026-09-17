/* Service worker (2026-09-17): network first, cache as the fallback.
   demo.html loads every script with a fresh ?v= tag so a reload always picks up new code, so the cache is
   keyed on the URL with its query stripped - otherwise every load would store a new copy and nothing would
   ever match when the phone is offline. Patches always win when the network is there; when it is not, the
   last version that loaded is what the kids get. */
var CACHE = 'fote-v1';

self.addEventListener('install', function(ev){ self.skipWaiting(); });
self.addEventListener('activate', function(ev){
  ev.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

function key(req){ var u=new URL(req.url); u.search=''; return u.toString(); }

self.addEventListener('fetch', function(ev){
  var req=ev.request;
  if(req.method!=='GET' || new URL(req.url).origin!==location.origin) return;
  ev.respondWith(
    fetch(req).then(function(res){
      if(res && res.status===200) caches.open(CACHE).then(function(c){ c.put(key(req), res.clone()); });
      return res;
    }).catch(function(){
      return caches.open(CACHE).then(function(c){ return c.match(key(req)); }).then(function(hit){
        return hit || new Response('offline', {status:503, headers:{'Content-Type':'text/plain'}});
      });
    })
  );
});
