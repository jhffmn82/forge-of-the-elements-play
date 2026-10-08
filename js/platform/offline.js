/* Installed copies stage a complete revision before advertising offline readiness.
 * Ordinary browser tabs retain lightweight caching of resources already loaded.
 * sw.js shares the scoped active-revision pointer and never lets a verification
 * request succeed through an older offline fallback. No save data is involved. */
(function(){
  if(!('caches' in window) || !('serviceWorker' in navigator)) return;
  var CACHE = 'astra-temple-v2', BATCH = 4;   /* shared control/partial cache; keep background bandwidth modest */
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
        'background:rgba(16,13,11,.92);border:1px solid #332A24;color:#A79C93;font:calc(12px + var(--ui-mobile-text-add,0px)) "IBM Plex Mono",monospace;'+
        'pointer-events:none;max-width:60vw';
      document.body.appendChild(badge);
    }
    badge.textContent=text;
    badge.style.color = done ? '#7FA05A' : '#A79C93';
    if(done) setTimeout(function(){ if(badge){ badge.remove(); badge=null; } }, 6000);
  }

  var SCOPE=new URL('./',location.href).href;
  var POINTER=new URL('__fote_offline_revision__',SCOPE).href;
  function pageBuild(){return (document.querySelector('meta[name="fote-build"]')||{}).content||'dev';}
  function announceClient(){
    var worker=navigator.serviceWorker.controller;
    if(worker)worker.postMessage({type:'fote-offline-client',built:pageBuild(),installed:INSTALLED});
  }
  announceClient();
  if(navigator.serviceWorker.addEventListener)navigator.serviceWorker.addEventListener('controllerchange',announceClient);
  async function verifiedFetch(path,built){
    var url=new URL(path,location.href);url.searchParams.set('fote-offline-verify',built);
    var response=await fetch(url.href,{cache:'no-store'});
    if(!response||response.status!==200||response.headers.get('X-Fote-Offline-Verified')!==built)
      throw new Error('Offline file was not verified from the network: '+path);
    return response;
  }
  function snapshotRequest(type,record){
    return new Promise(function(resolve,reject){
      var worker=navigator.serviceWorker.controller;if(!worker){reject(new Error('No active offline worker'));return;}
      var channel=new MessageChannel(),timer=setTimeout(function(){channel.port1.close();var error=new Error('Offline request outcome unknown');error.outcome='unknown';reject(error);},30000);
      channel.port1.onmessage=function(ev){clearTimeout(timer);channel.port1.close();if(ev.data&&ev.data.ok)resolve();else{var error=new Error('Offline request rejected');error.outcome=ev.data&&ev.data.rejected?'rejected':'unknown';reject(error);}};
      worker.postMessage({type:type,record:record},[channel.port2]);
    });
  }
  async function completedSnapshot(cache,built){
    var entry=await cache.match(new URL('__fote_offline_build__/'+encodeURIComponent(built),SCOPE).href);
    var record=entry&&await entry.json();
    if(!record||record.built!==built||typeof record.cache!=='string'||record.cache.indexOf('astra-temple-revision-'+encodeURIComponent(SCOPE)+'-')!==0)return null;
    var stored=await caches.open(record.cache),receipt=await stored.match(new URL('__fote_offline_complete__',SCOPE).href);
    if(!receipt||(await receipt.json()).built!==built)return null;
    var files=JSON.parse(record.files),present={};(await stored.keys()).forEach(function(req){present[req.url]=1;});
    return files.every(function(p){return present[stripQuery(p)];})?record:null;
  }
  function incomplete(total,failed,message){
    window.OFFLINE_READY={files:0,failed:failed,total:total,ready:false};
    say(message||'Offline copy incomplete. Reconnect and reopen the game to retry.',false);
  }
  async function fill(){
    var reg=await navigator.serviceWorker.getRegistration();if(!reg)return;
    var cache=await caches.open(CACHE),have={};
    (await cache.keys()).forEach(function(req){have[req.url]=1;});
    if(!INSTALLED){
      var response;try{response=await fetch('precache.json',{cache:'no-store'});if(!response.ok)return;}catch(e){return;}
      var list=await response.json();if(!Array.isArray(list))return;
      var loaded={};loaded[stripQuery('index.html')]=location.href;
      performance.getEntriesByType('resource').forEach(function(e){loaded[stripQuery(e.name)]=e.name;});
      var todo=list.filter(function(p){return !have[stripQuery(p)]&&loaded[stripQuery(p)];});
      for(var i=0;i<todo.length;i+=BATCH){
        await Promise.all(todo.slice(i,i+BATCH).map(async function(path){
          try{var res=await fetch(loaded[stripQuery(path)],{cache:'no-cache'});if(res&&res.status===200)await cache.put(stripQuery(path),res.clone());}catch(e){}
        }));
        await new Promise(function(resolve){setTimeout(resolve,30);});
      }
      return;
    }
    var built=pageBuild(),manifest,build,list,previous;
    if(built==='dev')return;
    announceClient();
    previous=await completedSnapshot(cache,built);
    if(previous){
      var storedFiles=JSON.parse(previous.files).length;
      window.OFFLINE_READY={files:storedFiles,failed:0,total:storedFiles,built:built,ready:true};
      say('Offline copy ready: this device can play with no signal',true);return;
    }
    try{
      build=await (await verifiedFetch('build.json',built)).json();
      if(build.built!==built){incomplete(0,0,'A newer game is available. Reload online before storing it offline.');return;}
      manifest=await verifiedFetch('precache.json',built);list=await manifest.clone().json();
      if(!Array.isArray(list)||!list.length||!list.includes('index.html'))throw new Error('Invalid offline manifest');
      if(list.some(function(p){var url=new URL(p,SCOPE);return typeof p!=='string'||url.href.indexOf(SCOPE)!==0||url.search||url.hash;}))throw new Error('Invalid offline path');
      list=Array.from(new Set(list)).sort();
    }catch(e){incomplete(0,1);return;}
    var signature=JSON.stringify(list),prefix='astra-temple-revision-'+encodeURIComponent(SCOPE)+'-';
    var attempt=typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
    var name=prefix+encodeURIComponent(built)+'-'+attempt,record={built:built,cache:name,files:signature};
    try{await snapshotRequest('fote-offline-stage',record);}catch(e){incomplete(list.length,1);return;}
    var staged=await caches.open(name);
    // An unfinished revision is revalidated in full. Merely finding its URLs is
    // not evidence of freshness, even if an interrupted earlier attempt wrote them.
    var done=0,failed=0;
    say('Storing the game for offline play… 0%',false);
    for(var i=0;i<list.length;i+=BATCH){
      await Promise.all(list.slice(i,i+BATCH).map(async function(path){
        try{
          var res=path==='precache.json'?manifest.clone():await verifiedFetch(path,built);
          // The HTML stamp detects a release crossing even if a CDN serves an old shell.
          if((path==='index.html'||path==='demo.html')&&!(await res.clone().text()).includes('name="fote-build" content="'+built+'"'))throw new Error('Offline shell revision mismatch');
          await staged.put(stripQuery(path),res.clone());done++;
        }catch(e){failed++;}
      }));
      await new Promise(function(resolve){setTimeout(resolve,30);});
      say('Storing the game for offline play… '+Math.round((done+failed)/list.length*100)+'%',false);
    }
    if(!failed){
      try{
        var finalBuild=await (await verifiedFetch('build.json',built)).json();
        var finalList=await (await verifiedFetch('precache.json',built)).json();
        if(finalBuild.built!==built||JSON.stringify(Array.from(new Set(finalList)).sort())!==signature)throw new Error('Build changed while storing offline copy');
      }catch(e){failed++;}
    }
    if(failed){try{await snapshotRequest('fote-offline-abort',record);}catch(e){}window.OFFLINE_READY={files:done,failed:failed,total:list.length,built:built,ready:false};say('Offline copy incomplete. Reconnect and reopen the game to retry.',false);return;}
    // A single pointer write commits the completed snapshot. Until then the worker
    // retains the previous coherent revision, and a newer open page cannot mix it in.
    await staged.put(new URL('__fote_offline_complete__',SCOPE).href,new Response(JSON.stringify({built:built}),{headers:{'Content-Type':'application/json'}}));
    // A timeout has an unknown commit outcome. The worker owns safe cleanup;
    // the page never deletes a stage that might already have been committed.
    try{await snapshotRequest('fote-offline-commit',record);}catch(e){incomplete(list.length,1);return;}
    window.OFFLINE_READY={files:list.length,failed:0,total:list.length,built:built,ready:true};
    say('Offline copy ready: this device can play with no signal',true);
    if(typeof log==='function')log('This device now has the whole game stored for offline play.','c-info');

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
