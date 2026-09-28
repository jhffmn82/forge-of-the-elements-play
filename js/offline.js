/* =====================================================================
   offline.js - make the whole game available offline (2026-09-17).
   sw.js serves from a cache and falls back to it when the network is gone, but its install-time precache
   proved unreliable in the field (the cache came up empty), and caching only what had been fetched meant an
   offline launch was missing whichever monster sheets, atlases and sounds you had not met yet.
   So the page fills the cache itself: it reads precache.json (written by tools/deploy.py - the exact list of
   files the build ships, about 122 MB at Beta 1.3.1) and pulls anything missing, a few at a time, after the game has
   loaded. Same cache name the worker reads, so sw.js answers from it when offline.
   2026-09-27 (1.3.1): only an INSTALLED copy stores the whole list: a home-screen or fullscreen app, or the
   Android APK, whose WebView adds no marker of its own, so the standard '; wv)' WebView token on a top-level
   page identifies it. A browser tab stores only the files it has already loaded: the worker caches everything
   it serves, and a top-level tab (GitHub Pages) also re-stores what its first visit fetched before the worker
   took over. The itch.io frame skips that step (see below).
   Runs only where a service worker is actually registered, i.e. the https build, not the dev server.
   ===================================================================== */
(function(){
  if(!('caches' in window) || !('serviceWorker' in navigator)) return;
  var CACHE = 'astra-temple-v2', BATCH = 8;   /* must match sw.js: the worker removes only obsolete Astra caches */
  /* the APK shows the game as the whole page; in-app WebViews that frame it (the itch.io app) carry '; wv)' too */
  var TOP = window.self===window.top;
  var INSTALLED = (typeof matchMedia==='function' && matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)').matches)
    || navigator.standalone===true || (TOP && /; wv\)/.test(navigator.userAgent||''));
  /* a framed tab (the itch.io page) tops nothing up: a cross-site frame's worker does not share the frame's HTTP
     cache, so re-requesting what the page loaded downloads it all again (measured: 44-51 MB twice). The worker
     still keeps every file it serves, and the embedding page cannot be opened offline anyway. */
  if(!INSTALLED && !TOP) return;
  /* what this page loaded comes from Resource Timing; the art preload alone passes the default 250 entries */
  if(typeof performance!=='undefined' && performance.setResourceTimingBufferSize) performance.setResourceTimingBufferSize(2000);

  function stripQuery(url){ var u=new URL(url, location.href); u.search=''; return u.toString(); }

  /* a visible badge, so you can hand the device over knowing the offline copy finished */
  var badge=null;
  function say(text, done){
    if(!INSTALLED) return;                               /* a browser tab stores its files quietly */
    if(!badge){
      badge=document.createElement('div');
      badge.style.cssText='position:fixed;right:10px;bottom:10px;z-index:60;padding:6px 10px;border-radius:6px;'+
        'background:rgba(16,13,11,.92);border:1px solid #332A24;color:#A79C93;font:12px "IBM Plex Mono",monospace;'+
        'pointer-events:none;max-width:60vw';
      document.body.appendChild(badge);
    }
    badge.textContent=text;
    badge.style.color = done ? '#7FA05A' : '#A79C93';
    if(done) setTimeout(function(){ if(badge){ badge.remove(); badge=null; } }, 6000);
  }

  async function fill(){
    var reg = await navigator.serviceWorker.getRegistration();
    if(!reg) return;                                     /* dev server: nothing to be offline for */
    var list;
    try { var r = await fetch('precache.json', {cache:'no-store'}); if(!r.ok) return; list = await r.json(); }
    catch(e){ return; }
    var cache = await caches.open(CACHE);
    var have = {};
    (await cache.keys()).forEach(function(req){ have[req.url] = 1; });
    var loaded = {};                                     /* file -> the exact URL (?v= and all) this page loaded */
    loaded[stripQuery('index.html')] = location.href;    /* this page is the worker's fallback for any navigation */
    performance.getEntriesByType('resource').forEach(function(e){ loaded[stripQuery(e.name)] = e.name; });
    var todo = list.filter(function(p){ return !have[stripQuery(p)] && (INSTALLED || loaded[stripQuery(p)]); });
    if(!todo.length){
      if(!INSTALLED) return;
      /* an earlier launch (or a worker from before 1.3.1, which precached on install) may have got there
         first - still confirm it, so a device can be handed over knowing it will play with no signal */
      window.OFFLINE_READY = {files: list.length, failed: 0, total: list.length};
      say('Offline copy ready: this device can play with no signal', true);
      return;
    }
    var done = 0, failed = 0;
    say('Storing the game for offline play… 0%');
    for(var i=0; i<todo.length; i+=BATCH){
      await Promise.all(todo.slice(i, i+BATCH).map(async function(path){
        try {
          /* a file this page already loaded is asked for by its exact URL, so the HTTP cache answers (a 304)
             instead of a second download */
          var url = loaded[stripQuery(path)];
          var res = await fetch(url || path, {cache: url ? 'no-cache' : 'no-store'});
          if(res && res.status===200){ await cache.put(stripQuery(path), res.clone()); done++; }
          else failed++;
        } catch(e){ failed++; }
      }));
      await new Promise(function(r){ setTimeout(r, 30); });   /* leave the game some bandwidth */
      say('Storing the game for offline play… '+Math.round((done+failed)/todo.length*100)+'%');
    }
    if(!INSTALLED) return;                               /* a tab's partial copy is not announced */
    window.OFFLINE_READY = {files: done, failed: failed, total: list.length};
    say(failed ? 'Offline copy ready ('+failed+' files missed)' : 'Offline copy ready: this device can play with no signal', true);
    if(typeof log==='function' && done)
      log('This device now has the whole game stored: it plays with no signal at all.', 'c-info');
  }

  /* after the first turn or two, not during loading: the page's load event waits for the artwork preload, so
     a tab also sees every sheet it fetched before the worker took over */
  function afterLoad(fn){ if(document.readyState==='complete') fn(); else window.addEventListener('load', fn, {once:true}); }
  FoteLifecycle.whenReady(function(){ afterLoad(function(){ setTimeout(function(){
    fill().catch(function(error){
      /* Embedded browsers can expose these APIs while denying storage access.
         Offline caching is optional; it must never interrupt the game or leave
         a progress badge claiming a copy is ready when it was not completed. */
      if(badge){badge.remove();badge=null;}
      window.OFFLINE_READY={files:0,failed:0,total:0,unavailable:true};
      console.warn('Offline storage is unavailable in this browser.',error);
    });
  }, 3000); }); });
})();
