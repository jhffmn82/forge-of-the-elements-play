/* update.js - never run a stale build (2026-09-19).
   The iPad kept opening an old copy even after reloads: a service worker and Safari's own cache can both hand
   back the page from before a publish. tools/publish.py stamps each build into the page
   (<meta name="fote-build">) and into build.json. On load this asks the server, past every cache, which build
   is live; if the page is older, it drops the service worker and the cached copy (never the saves - those live
   in localStorage, which is left alone) and reloads once. The build shows in the corner of the title screen,
   so you can see at a glance which one a device is running. */
(function(){
  var meta=document.querySelector('meta[name="fote-build"]'), mine=meta ? meta.getAttribute('content') : 'dev';

  /* the title screen rebuilds its own markup, so the stamp lives outside it and just follows it on and off */
  var d=document.createElement('div'); d.id='buildTag';
  d.style.cssText='position:fixed;right:12px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:46;display:none;'+
    'font:12px "IBM Plex Mono",monospace;color:rgba(242,217,160,.55);pointer-events:none';
  d.textContent='build '+(mine==='dev' ? 'dev' : mine.slice(0,16));
  function show(){ var t=document.getElementById('title'); if(!d.parentNode && document.body) document.body.appendChild(d); d.style.display = t && t.classList.contains('on') ? 'block' : 'none'; }
  setInterval(show, 500);

  if(mine==='dev' || !window.fetch) return;              /* the dev server always serves fresh files */
  window.addEventListener('load', function(){
    fetch('build.json?t='+Date.now(), {cache:'no-store'}).then(function(r){ return r.ok ? r.json() : null; }).then(async function(b){
      if(!b || !b.built || b.built===mine) return;
      var tried=null; try{ tried=sessionStorage.getItem('fote-upd'); }catch(e){}
      if(tried===b.built) return;                          /* one attempt per build, never a reload loop */
      try{ sessionStorage.setItem('fote-upd', b.built); }catch(e){}
      try{
        if(navigator.serviceWorker){ var regs=await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(function(r){ return r.unregister(); })); }
        if(window.caches){ var ks=await caches.keys(); await Promise.all(ks.filter(function(k){ return k.indexOf('fote')===0; }).map(function(k){ return caches.delete(k); })); }
      }catch(e){}
      location.replace(location.pathname+'?b='+(b.epoch||Date.now()));
    }).catch(function(){});                                /* offline: play the copy we have */
  });
})();
