/* =====================================================================
   offline.js - make the whole game available offline (2026-09-17).
   sw.js serves from a cache and falls back to it when the network is gone, but its install-time precache
   proved unreliable in the field (the cache came up empty), and caching only what had been fetched meant an
   offline launch was missing whichever monster sheets, atlases and sounds you had not met yet.
   So the page fills the cache itself: it reads precache.json (written by tools/deploy.py - the exact list of
   files the build ships, about 22 MB) and pulls anything missing, a few at a time, after the game has
   loaded. Same cache name the worker reads, so sw.js answers from it when offline.
   Runs only where a service worker is actually registered, i.e. the https build, not the dev server.
   ===================================================================== */
(function(){
  if(!('caches' in window) || !('serviceWorker' in navigator)) return;
  var CACHE = 'fote-v2', BATCH = 8;

  function stripQuery(url){ var u=new URL(url, location.href); u.search=''; return u.toString(); }

  async function fill(){
    var reg = await navigator.serviceWorker.getRegistration();
    if(!reg) return;                                     /* dev server: nothing to be offline for */
    var list;
    try { var r = await fetch('precache.json', {cache:'no-store'}); if(!r.ok) return; list = await r.json(); }
    catch(e){ return; }
    var cache = await caches.open(CACHE);
    var have = {};
    (await cache.keys()).forEach(function(req){ have[req.url] = 1; });
    var todo = list.filter(function(p){ return !have[stripQuery(p)]; });
    if(!todo.length) return;
    var done = 0, failed = 0;
    for(var i=0; i<todo.length; i+=BATCH){
      await Promise.all(todo.slice(i, i+BATCH).map(async function(path){
        try {
          var res = await fetch(path, {cache:'no-store'});
          if(res && res.status===200){ await cache.put(stripQuery(path), res.clone()); done++; }
          else failed++;
        } catch(e){ failed++; }
      }));
      await new Promise(function(r){ setTimeout(r, 30); });   /* leave the game some bandwidth */
    }
    window.OFFLINE_READY = {files: done, failed: failed, total: list.length};
    if(typeof log==='function' && done)
      log('This device now has the whole game stored: it plays with no signal at all.', 'c-info');
  }

  /* after the first turn or two, not during loading */
  window.addEventListener('load', function(){ setTimeout(function(){ fill(); }, 3000); });
})();
