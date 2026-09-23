/* update.js - never run a stale build (2026-09-19).
   The iPad kept opening an old copy even after reloads: a service worker and Safari's own cache can both hand
   back the page from before a publish. tools/publish.py stamps each build into the page
   (<meta name="fote-build">) and into build.json. On load this asks the server, past every cache, which build
   is live; if the page is older, it drops the service worker and the cached copy (never the saves - those live
   in localStorage, which is left alone) and reloads once. The build shows in the corner of the title screen,
   so you can see at a glance which one a device is running. */
/* The released version, shown on the title screen ahead of the build stamp. The build stamp answers "which
   copy is this device running"; this answers "which release is it" - the one a player quotes in a bug report
   (Justin, 2026-09-23). Bump it by hand on a release. */
var FOTE_VERSION = 'Beta 1.0';

(function(){
  var meta=document.querySelector('meta[name="fote-build"]'), mine=meta ? meta.getAttribute('content') : 'dev';

  /* the title screen rebuilds its own markup, so the stamp lives outside it and just follows it on and off */
  var d=document.createElement('div'); d.id='buildTag';
  d.style.cssText='position:fixed;right:12px;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:46;display:none;'+
    'font:12px "IBM Plex Mono",monospace;color:rgba(242,217,160,.55);pointer-events:none';
  d.textContent=FOTE_VERSION+' · build '+(mine==='dev' ? 'dev' : mine.slice(0,16));
  function show(){ var t=document.getElementById('title'); if(!d.parentNode && document.body) document.body.appendChild(d); d.style.display = t && t.classList.contains('on') ? 'block' : 'none'; }
  setInterval(show, 500);

  if(mine==='dev' || !window.fetch) return;              /* the dev server always serves fresh files */
  window.addEventListener('load', function(){
    fetch('build.json?t='+Date.now(), {cache:'no-store'}).then(function(r){ return r.ok ? r.json() : null; }).then(async function(b){
      if(!b || !b.built || b.built===mine) return;
      var tried=null; try{ tried=sessionStorage.getItem('astra-temple-upd'); }catch(e){}
      if(tried===b.built) return;                          /* one attempt per build, never a reload loop */
      try{ sessionStorage.setItem('astra-temple-upd', b.built); }catch(e){}
      try{
        if(navigator.serviceWorker){ var regs=await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.filter(function(r){return r.scope===new URL('./',location.href).href;}).map(function(r){ return r.unregister(); })); }
        if(window.caches){ var ks=await caches.keys(); await Promise.all(ks.filter(function(k){ return k.indexOf('astra-temple-')===0; }).map(function(k){ return caches.delete(k); })); }
      }catch(e){}
      location.replace(location.pathname+'?b='+(b.epoch||Date.now()));
    }).catch(function(){});                                /* offline: play the copy we have */
  });
})();

/* 2026-09-22 (Justin): an Update button on the title screen. It asks the server for build.json past every cache,
   and if that build is not the one running it drops the service worker and the app caches and reloads on the new
   build, exactly as the automatic check does, but on demand: an installed app that has sat closed for a while
   gets the latest build without waiting for the worker to notice. */
function forceUpdate(btn){
  var mine=(document.querySelector('meta[name="fote-build"]')||{}).content||'';
  function say(t){ if(btn) btn.textContent=t; }
  say('Checking\u2026');
  if(!window.fetch){ say('Update'); return; }
  fetch('build.json?t='+Date.now(), {cache:'no-store'}).then(function(r){ return r.ok ? r.json() : null; }).then(async function(b){
    if(!b || !b.built){ say('Could not reach the server'); setTimeout(function(){ say('Update'); }, 2500); return; }
    if(b.built===mine){ say('Up to date ('+b.built+')'); setTimeout(function(){ say('Update'); }, 4000); return; }
    say('Updating to '+b.built+'\u2026');
    try{
      if(navigator.serviceWorker){ var regs=await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(function(r){ return r.unregister(); })); }
      if(window.caches){ var ks=await caches.keys(); await Promise.all(ks.filter(function(k){ return k.indexOf('astra-temple-')===0; }).map(function(k){ return caches.delete(k); })); }
    }catch(e){}
    location.replace(location.pathname+'?b='+(b.epoch||Date.now()));
  }).catch(function(){ say('Offline: playing the copy you have'); setTimeout(function(){ say('Update'); }, 4000); });
}

