;
/* js/platform/offline.js */
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

;
/* js/platform/mobile.js */
/* =====================================================================
   mobile.js - phone and tablet support (2026-09-17).
   The game was laid out for a desktop window. On Android the same page has to be readable and tappable at
   about 360x800 (portrait) or 800x360 (landscape) CSS pixels, so:
     - body.touch turns on the touch stylesheet in demo.html and the overrides below: a 46px top bar with
       short labels, one row of finger-sized hotbar slots, a 52px d-pad and 44px action buttons
     - portrait stacks the strip into rows with the message log as the bottom row; landscape keeps two
       columns and floats the log over the map, where height is the scarce dimension
     - the map zooms in, because at phone size the desktop 20x12 view gives 16px tiles
     - the Sandbox tab is dropped on real touch devices: it is a development tool, not something to hand a
       child. A narrow desktop window gets the phone layout but keeps Sandbox.
   Add ?touch=1 to force the touch layout, ?touch=0 to force it off (that is how it gets tested).
   ===================================================================== */
(function(){
  var q = (location.search.match(/[?&]touch=([01])/) || [])[1];
  var coarse = window.matchMedia && matchMedia('(pointer:coarse)').matches;
  /* any touch device counts, phone or tablet: the kids play on tablets too, and a tablet wants the same
     finger-sized controls even though it has room to spare */
  var DEVICE = q==='1' ? true : q==='0' ? false : !!coarse;
  window.MOBILE = DEVICE;

  /* Both orientations are playable. Rotation is a presentation change, never
     an input-blocking overlay or a request for fullscreen/orientation lock. */
  var orientationBlocked=false,cancelOrientationPress=null;
  window.FoteMobileOrientation=Object.freeze({isBlocked:function(){return false;}});
  function cancelRotatingInput(){
    if(typeof stopTravel==='function')stopTravel();
    if(typeof stopDirectionPad==='function')stopDirectionPad();
    if(cancelOrientationPress)cancelOrientationPress();
  }

  /* the phone layout also comes on in a narrow desktop window, where the desktop bars overflow anyway */
  function wantTouch(){
    if(q==='1') return true;
    if(q==='0') return false;
    return DEVICE || innerWidth <= 760 || innerHeight <= 460;
  }

  /* ---------------- hud.js lays the strip out for a desktop window with !important rules (a 490px middle
     column, one row of eight 52px icon slots, the action buttons in a column). On a phone the strip has to
     stack instead, so those rules are answered here - this stylesheet is appended last, so it wins. */
  (function(){
    var st=document.createElement('style');
    st.textContent=[
      /* one row of hotbar slots in both orientations: eight slots wide, as tall as the row allows */
      'body.touch #hotbar{grid-template-columns:repeat(8,minmax(0,1fr))!important;grid-template-rows:48px!important;gap:5px!important}',
      'body.touch #hotbar .slot{width:auto!important;height:48px!important}',
      'body.touch #hotbar .slot .ico{width:34px!important;height:34px!important}',
      'body.touch #mid{width:auto!important}',
      /* portrait: rows - bars and hotbar, then the d-pad beside the action buttons, then the log */
      '@media (orientation:portrait){',
      ' body.touch #strip{grid-template-columns:minmax(0,1fr)!important;align-items:stretch;gap:6px!important;padding:6px 8px!important;',
      '   padding-bottom:calc(6px + env(safe-area-inset-bottom,0px))!important}',
      ' body.touch #mid{order:1;gap:5px}',
      ' body.touch #ctl{display:flex!important;flex-direction:row;align-items:stretch;justify-content:space-between;gap:8px;order:2}',
      ' body.touch #ctl #fx{display:none}',                    /* the status tags float over the map instead */
      ' body.touch #dpad{grid-template-columns:repeat(3,44px)!important;grid-auto-rows:34px!important;gap:4px!important}',
      /* the log is the bottom row and gets the room the hotbar's second row used to take */
      ' body.touch #log{order:3;grid-column:auto;contain:none;height:clamp(84px,12vh,112px)!important;font-size:calc(12.5px + var(--ui-mobile-text-add,0px));padding:6px 9px}',
      '}',
      /* landscape: two columns, and the log floats over the map because height is what runs out */
      '@media (orientation:landscape){',
      ' body.touch #strip{grid-template-columns:minmax(0,1fr) auto!important}',
      ' body.touch #ctl{display:flex!important;flex-direction:row;align-items:flex-end;gap:6px}',
      ' body.touch #log{position:absolute;z-index:5;left:8px;top:54px;width:min(44%,320px);height:auto!important;',
      '   max-height:72px;contain:none;background:rgba(10,9,8,.55);border:none;pointer-events:none}',
      '}',
      /* ---- the Gear sheet: the doll and the bag side by side, both visible without scrolling.
         sheets.js stacks its three columns below 640px, which pushed the bag off the screen. */
      'body.touch #shade{padding:8px}',
      /* the sheet lives inside #map, so bound it to the map and let its body scroll: at 92vh it ran on under
         the bottom strip, and the last rows of a sheet sat behind the hotbar */
      'body.touch .sheet{width:100%;max-height:100%;min-height:0}',
      'body.touch #shade{align-items:stretch}',
      'body.touch .sheet .bodyw{overscroll-behavior:contain}',
      'body.touch .sheet header{padding:7px 10px}',
      'body.touch .sheet header h2{font-size:calc(16px + var(--ui-mobile-text-add,0px))}',
      'body.touch .sheet .bodyw{padding:10px}',
      /* sheets.js writes three columns in the order totals, worn, bag. On a phone the worn doll and the bag
         share the top row and the totals run full width underneath, so both are on screen at once. */
      'body.touch .gearwrap{grid-template-columns:150px minmax(0,1fr)!important;gap:8px 10px!important}',
      'body.touch .gearwrap>*:nth-child(1){grid-column:1/-1;order:3}',     /* offence / defence totals */
      'body.touch .gearwrap>.gcol-worn{grid-column:1;order:1}',
      'body.touch .gearwrap>*:nth-child(3){grid-column:2;order:2}',        /* the bag, beside the doll */
      'body.touch .gdoll{grid-template-columns:42px 50px 42px!important;grid-template-rows:repeat(3,44px)!important;gap:14px 6px!important}',
      'body.touch .gcol-worn .sec span{display:none}',                     /* the "hover for details" hint is mouse talk */
      'body.touch .gdoll .art{min-height:120px!important}',
      'body.touch .gslot{width:42px!important;height:42px!important;border-width:1px}',
      'body.touch .gslot .lab{bottom:-12px;font-size:calc(7.5px + var(--ui-mobile-text-add,0px))}',
      'body.touch .gslot .ph{font-size:calc(16px + var(--ui-mobile-text-add,0px))}',
      'body.touch .gearwrap .invgrid{grid-template-columns:repeat(4,minmax(34px,1fr))!important;gap:5px}',
      'body.touch .gearwrap .sec{margin:6px 0 3px;font-size:calc(9px + var(--ui-mobile-text-add,0px))}',
      'body.touch .stowrow{margin-top:16px;gap:8px}',
      'body.touch .stowrow span{display:none}',                            /* the caption does not fit a 150px column */
      'body.touch .invgrid{grid-template-columns:repeat(auto-fill,minmax(38px,1fr))}',
      /* 2026-09-18: the tile tooltip followed the pointer, which on a touch screen means it lands exactly
         where the finger is - covering the tile you are trying to walk to. On touch it is pinned to the
         bottom-left corner of the map instead (js/runtime/game.js sets left/top inline, hence !important). */
      'body.touch #tip{left:8px!important;top:auto!important;bottom:8px!important;right:auto!important;',
      '  max-width:min(78%,340px)!important;background:rgba(10,9,8,.93);backdrop-filter:blur(2px);padding:9px 11px!important}',
      /* pinned in a corner it is not fighting for room any more, so the type can come up a notch */
      'body.touch #tip .nm{font-size:calc(16px + var(--ui-mobile-text-add,0px))!important}',
      'body.touch #tip .row{font-size:calc(13px + var(--ui-mobile-text-add,0px))!important}',
      'body.touch #tip .odds{font-size:calc(13.5px + var(--ui-mobile-text-add,0px))!important}',
      '@media (orientation:landscape){ body.touch #tip{bottom:8px!important;left:8px!important} }',
      /* the touch targets in the top bar, and room for them: the game title is not needed mid-run */
      /* 2026-09-18: the menu tabs were too small to hit reliably with a finger. 52px tall, 60px minimum
         width, real padding between them - and the row scrolls sideways on a narrow phone rather than
         shrinking the targets back down. */
      'body.touch #top{min-height:52px!important}',
      'body.touch #tabs{gap:4px!important;overflow-x:auto;scrollbar-width:none;flex:1 1 auto;justify-content:flex-end}',
      'body.touch #tabs::-webkit-scrollbar{display:none}',
      'body.touch #tabs button{min-height:52px!important;min-width:60px;padding:0 16px!important;font-size:calc(13.5px + var(--ui-mobile-text-add,0px))!important;flex:0 0 auto}',
      'body.touch #top button{min-height:48px;padding:8px 12px;font-size:calc(13px + var(--ui-mobile-text-add,0px))}',
      'body.touch #brand h1{display:none}',
      /* the chips (fed, essence, motes, faith) stay one row and scroll sideways if there are too many:
         wrapped, they were taking three lines out of the map */
      'body.touch #hud2{flex-wrap:nowrap!important;gap:5px;font-size:calc(11.5px + var(--ui-mobile-text-add,0px));overflow-x:auto;overflow-y:hidden;',
      '  scrollbar-width:none;min-height:0;padding-bottom:1px}',
      'body.touch #hud2::-webkit-scrollbar{display:none}',
      'body.touch #hud2 .chip{flex:0 0 auto}',
      'body.touch #hud2 .faithchip .meter{display:none}'
    ].join('\n');
    document.head.appendChild(st);
  })();

  /* ---------------- the top bar has to fit about 360 CSS pixels, so its labels get shorter */
  var SHORT = {'Character':'Char', 'Equipment':'Gear', 'Sandbox':'Sand', 'Options':'Opts'};
  function shortenTop(){
    if(!document.body.classList.contains('touch')||(typeof FoteResponsiveHUD!=='undefined'&&FoteResponsiveHUD.isMounted())) return;
    document.querySelectorAll('#tabs button').forEach(function(b){
      var t=b.textContent.trim(); if(SHORT[t]) b.textContent=SHORT[t];
    });
    document.querySelectorAll('#top button').forEach(function(b){
      var t=b.textContent.trim();
      if(/^Sound:/.test(t)) b.textContent = /off/i.test(t) ? '🔇' : '🔊';
      if(/^Music:/.test(t)) b.textContent = /off/i.test(t) ? '♪̸' : '♪';
    });
  }

  /* ---------------- the map zooms in: fewer, bigger tiles than a desktop window wants.
     Portrait is the better shape on a phone - it leaves a near-square map with ~30px tiles, where an
     800x360 landscape gives a letterbox - so each orientation gets its own tile count. */
  function applyZoom(){
    if(typeof ZOOM!=='undefined'){
      var portrait = window.matchMedia && matchMedia('(orientation:portrait)').matches;
      /* at least 15 tiles across and down, so there are 7 squares of warning in every direction */
      ZOOM.phone = portrait ? [15,15] : [16,10];
      if(document.body.classList.contains('touch')){
        if(typeof zoomKey!=='undefined' && zoomKey!=='close' && zoomKey!=='wide') zoomKey='phone';
      } else if(typeof zoomKey!=='undefined' && zoomKey==='phone') zoomKey='normal';
      var sel=document.getElementById('zoom'); if(sel && !sel.querySelector('[value="phone"]')){
        var o=document.createElement('option'); o.value='phone'; o.textContent='Phone'; sel.appendChild(o);
      }
    }
    if(typeof resize==='function') resize();
  }

  /* ---------------- the layout follows the window: a rotate, a keyboard opening, the address bar sliding
     away or a resized desktop window all change which layout fits */
  function sync(){
    var on=wantTouch(), was=document.body.classList.contains('touch');
    document.body.classList.toggle('touch', on);
    if(on && !was) shortenTop();
    applyZoom();
  }
  /* icons are painted at their slot's exact size, so a layout change during a run repaints them (CSS would stretch the old ones) */
  function relayout(){ sync(); if(typeof FoteResponsiveHUD!=='undefined'&&typeof FoteResponsiveHUD.relayout==='function')FoteResponsiveHUD.relayout(); if(typeof abilityBar==='function' && typeof RUN!=='undefined' && RUN && !document.getElementById('loadVeil')) abilityBar(); }
  window.addEventListener('resize', function(){ setTimeout(relayout, 0); });
  window.addEventListener('orientationchange', function(){ cancelRotatingInput();setTimeout(relayout, 120); });
  if(window.screen&&screen.orientation&&typeof screen.orientation.addEventListener==='function')
    screen.orientation.addEventListener('change', function(){ cancelRotatingInput();setTimeout(relayout, 0);setTimeout(relayout, 120); });
  if(window.visualViewport) visualViewport.addEventListener('resize', function(){ setTimeout(relayout, 0); });

  if(DEVICE){
    /* no pinch zoom, no double-tap zoom, no long-press menu on the map */
    document.addEventListener('gesturestart', function(ev){ ev.preventDefault(); });
    document.addEventListener('contextmenu', function(ev){ if(ev.target && ev.target.id==='cv') ev.preventDefault(); });

    /* offline: the kids should be able to play with the phone in aeroplane mode */
    if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function(){});
  }

  /* ---------------- the Gear tab, written for a touch screen rather than squeezed out of the desktop one.
     The desktop sheet is three columns around a paper doll with drag-and-drop; on a tablet that fights every
     rule it has. This is its own markup: big labelled slot tiles, a bag of large cells, the totals folded
     underneath. It keeps sheets.js's hooks (.gslot[data-slot], .cell[data-b], [data-gicon], #dollArt) so
     wireEquip still does the wiring - tap a bag item to equip or use it, tap a worn slot to take it off,
     hold anything to inspect it. */
  (function(){
    if(typeof equipHTML!=='function') return;
    var st=document.createElement('style');
    st.textContent=[
      '.tgear{display:flex;flex-direction:column;gap:12px}',
      '.tgear .tg-sec{font-size:calc(9.5px + var(--ui-mobile-text-add,0px));letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin:0 0 6px}',
      '.tgear .tg-hint{font-size:calc(11.5px + var(--ui-mobile-text-add,0px));color:var(--dim);line-height:1.4;margin:0}',
      /* worn slots in two columns on the left, the bag filling the rest to the right */
      '.tgear .tg-top{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:start}',
      '.tgear .tg-slots{display:grid;grid-template-columns:repeat(2,84px);gap:8px}',
      /* 2026-09-27 (Justin, D1): the character had a 108px column (84px on a narrow phone) for a 275px figure, so the
         main-hand weapon was cut away and the shield halved. It gets a column wide enough for the whole figure beside
         the totals, or a row of its own when the screen is too narrow for both. */
      '.tgear .tg-mid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px;align-items:start}',
      '.tgear .gslot{position:relative;width:auto!important;height:auto!important;min-height:84px;display:flex;',
      '  flex-direction:column;align-items:center;justify-content:flex-start;gap:3px;padding:7px 5px 6px;',
      '  border:1px solid var(--edge);border-radius:8px;background:#161210;cursor:pointer;overflow:hidden}',
      '.tgear .gslot.empty{border-style:dashed;opacity:.6}',
      '.tgear .gslot .ic{width:42px;height:42px;display:flex;align-items:center;justify-content:center}',
      '.tgear .gslot .ic canvas{display:block}',
      '.tgear .gslot .ph{font-size:calc(22px + var(--ui-mobile-text-add,0px));color:var(--dim);line-height:42px}',
      '.tgear .gslot .lab{position:static!important;font-size:calc(8px + var(--ui-mobile-text-add,0px));letter-spacing:.11em;text-transform:uppercase;color:var(--dim)}',
      '.tgear .gslot .nm{font-size:calc(10.5px + var(--ui-mobile-text-add,0px));color:var(--ink);text-align:center;line-height:1.2;max-width:100%;',
      '  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.tgear .gslot.over{border-color:var(--gold);background:#2A2015}',
      '.tgear .tg-portrait{min-height:170px;border:1px dashed var(--edge);border-radius:8px;',
      '  background:radial-gradient(#2A221C,#141110);display:flex;align-items:flex-end;justify-content:center;overflow:hidden}',
      '.tgear .tg-cells{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}',   /* 4 x 4 = the 16 bag slots */
      '.tgear .cell{position:relative;aspect-ratio:1;min-height:56px;border:1px solid var(--edge);border-radius:8px;',
      '  background:#161210;display:flex;align-items:center;justify-content:center}',
      '.tgear .cell.empty{border-style:dashed;opacity:.28}',
      '.tgear .cell b{position:absolute;right:4px;bottom:2px;font-size:calc(10px + var(--ui-mobile-text-add,0px));color:var(--gold);z-index:2}',
      '.tgear .tg-tot{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:4px 18px}',
      '.tgear .tg-tot .kv{font-size:calc(12px + var(--ui-mobile-text-add,0px));gap:2px 10px}',
      '.tgear .pouch{gap:7px}',
      '.tgear .mote{font-size:calc(11.5px + var(--ui-mobile-text-add,0px));padding:3px 10px 3px 7px}',
      '@media (max-width:420px){ .tgear .tg-slots{grid-template-columns:repeat(2,72px)} }'
    ].join('\n');
    document.head.appendChild(st);

    /* two columns, four rows: hands, body, rings, and the ranged weapon */
    var SLOTS = [['main','Main hand','&#9876;'], ['off','Off hand','&#9960;'],
                 ['armor','Armor','&#9960;'],    ['amulet','Amulet','&#9765;'],
                 ['ring0','Ring','&#9675;'],     ['ring1','Ring','&#9675;'],
                 ['stow','Ranged','&#127993;']];
    function wornItem(key){ return (typeof slotItem==='function') ? slotItem(key) : null; }
    function tile(key, label, ph){
      if(innerWidth<600&&innerHeight>innerWidth)label=({main:'Main',off:'Off',amulet:'Neck',stow:'Range'})[key]||label;
      var it = wornItem(key);
      var both = key==='off' && player.twoHanded;
      /* 2026-10-05: a worn Holy Symbol shows its holder's god's disc (sheets.js wornIconName) */
      var icon = it ? ((typeof wornIconName==='function' ? wornIconName(it) : it.icon) || (typeof iconNameForBag==='function' ? iconNameForBag({kind:it.kind, data:it}) : '')) : '';
      var col = it && typeof tierCol==='function' ? tierCol(it) : null;
      return '<div class="gslot'+(it?'':' empty')+'" data-slot="'+key+'"'+(col?' style="border-color:'+col+'"':'')+'>'+
             '<div class="ic"'+(icon?' data-gicon="'+icon+'"':'')+'>'+(it?'':'<span class="ph">'+ph+'</span>')+'</div>'+
             '<span class="lab">'+label+'</span>'+
             '<span class="nm">'+(it ? gearName(it) : both ? 'Both hands' : 'Empty')+'</span></div>';
    }
    function touchEquipHTML(){
      var hr = (typeof hitRange==='function') ? hitRange() : [0,0];
      var cells=player.bag.map(function(it,idx){ return '<div class="cell" data-b="'+idx+'" draggable="true">'+(it.n>1?'<b>'+it.n+'</b>':'')+'</div>'; });
      while(cells.length<BAG_MAX) cells.push('<div class="cell empty"></div>');

      /* top of the sheet, both reachable without scrolling: worn slots two-up on the left, bag on the right */
      var h='<div class="tgear"><div class="tg-top">'+
        '<div><p class="tg-sec">Worn</p><div class="tg-slots">'+
          SLOTS.map(function(s){ return tile(s[0], s[1], s[2]); }).join('')+'</div></div>'+
        '<div><p class="tg-sec">Bag &middot; '+player.bag.length+' / '+BAG_MAX+'</p><div class="tg-cells">'+cells.join('')+'</div>'+
          '<p class="tg-hint">Tap for details. Drag worn gear into the bag to take it off. Drag a bag item outside this panel to drop it.</p></div>'+
      '</div>';

      /* below, scrolled to when wanted: the character and the totals */
      h+='<div class="tg-mid"><div class="tg-portrait" id="dollArt"></div><div class="tg-tot">'+
         '<div><p class="tg-sec">Offense</p>'+kv([['Damage per hit',hr[0]+'-'+hr[1]],['Crit',Math.round(player.crit*100)+'%'],['Crit damage','&times;'+criticalMultiplier().toFixed(2)],
            ['Accuracy',player.acc],['Range',player.range],['Attack speed',playerSpeedPercent('attack')],['Movement speed',playerSpeedPercent('move')],['Spell power','&times;'+spellPower({}).toFixed(2)],['Divine Power','&times;'+divineStrength().toFixed(2)]])+'</div>'+
         '<div><p class="tg-sec">Defense</p>'+kv([['HP',Math.round(player.hp)+' / '+player.maxhp],['Shield',playerShield()],
            ['Armor',player.armor],['Evasion',evaOf(player)],['Block',Math.round(player.block*100)+'%'],['Mana',Math.floor(player.mp)+' / '+player.maxmp],['Stealth',Math.round(stealthScore()*100)+'%']])+'</div>'+
         '</div></div>';

      h+='<div>'+equipResourcesHTML('tg-sec')+'</div>';
      h+='<div><p class="tg-sec">Resistances</p>'+resHTML()+'</div>';
      return h+'</div>';
    }
    var _equipHTMLDesk = equipHTML;
    window.equipHTML = function(){
      var phone=document.body.classList.contains('touch')&&!window.matchMedia('(orientation:landscape) and (min-width:960px) and (min-height:600px)').matches;
      return phone ? touchEquipHTML() : _equipHTMLDesk.apply(this, arguments);
    };
  })();

  /* ---------------- long press = inspect. A finger cannot hover, so the odds card on a monster, the details
     on a bag item and the labels on a gear slot were all unreachable on a phone. Holding still for 420ms
     dispatches a mousemove at that point, which is exactly what the existing hover handlers listen for, and
     the tap that would otherwise follow (a step, an attack, an equip) is swallowed.
     The hotbar is left alone: travel.js already gives its slots a long press of their own. */
  (function(){
    var timer=null, sx=0, sy=0, held=null, closedAt=0;
    function cards(){ return [document.getElementById('tip'), document.getElementById('dtip')]; }
    function dismiss(){
      if(held){ try{ held.dispatchEvent(new MouseEvent('mouseleave', {bubbles:true})); }catch(e){} held=null; }
      cards().forEach(function(el){ if(el) el.style.display='none'; });
    }
    function cancel(){ if(timer){ clearTimeout(timer); timer=null; } }
    cancelOrientationPress=function(){cancel();dismiss();};

    document.addEventListener('pointerdown', function(ev){
      if(orientationBlocked||!document.body.classList.contains('touch')) return;
      if(ev.target.closest&&ev.target.closest('#tip'))return;        /* a tall map card can be scrolled */
      if(held){ dismiss(); closedAt=performance.now(); return; }       /* a tap after a long press only closes it */
      var t=ev.target;
      if(!t || (t.closest && t.closest('#hotbar'))) return;           /* travel.js owns the hotbar's long press */
      if(t.closest && t.closest('#top,#dpad,.sheet header')) return;
      sx=ev.clientX; sy=ev.clientY;
      cancel();
      timer=setTimeout(function(){
        timer=null;if(orientationBlocked)return;held=t;
        try{ t.dispatchEvent(new MouseEvent('mousemove', {clientX:sx, clientY:sy, bubbles:true})); }catch(e){}
        if(navigator.vibrate) try{ navigator.vibrate(12); }catch(e){}
      }, 420);
    }, true);

    document.addEventListener('pointermove', function(ev){
      if(timer && (Math.abs(ev.clientX-sx)>12 || Math.abs(ev.clientY-sy)>12)) cancel();
    }, true);
    ['pointerup','pointercancel','pointerleave'].forEach(function(n){
      document.addEventListener(n, cancel, true);
    });
    /* Cancel the browser's compatibility click at touch release. Map travel
       handles clicks on window capture, before this document click guard. */
    function inspectClickSuppressed(){return !!held || performance.now()-closedAt<400;}
    document.addEventListener('touchend',function(ev){
      if(inspectClickSuppressed())ev.preventDefault();
    },{capture:true,passive:false});
    /* Retain the click guard for pointer input that produces no touch event. */
    document.addEventListener('click', function(ev){
      if(inspectClickSuppressed()){ ev.stopPropagation(); ev.preventDefault(); }
    }, true);
    window.addEventListener('blur', dismiss);
  })();

  function boot(){
    /* the Sandbox tab is a dev tool: drop it on a real touch device, keep it in a narrow desktop window */
    if(DEVICE){
      var b=document.querySelector('#tabs button[data-p="Sand"]'); if(b) b.remove();
      if(typeof openSheet!=='undefined' && openSheet==='Sand' && typeof showSheet==='function') showSheet(null);
    }
    sync();
    /* the audio buttons rewrite their own labels, so shorten them again each time they do */
    if(typeof syncAudioButtons==='function'){
      var _sync=syncAudioButtons;
      window.syncAudioButtons=function(){ var r=_sync.apply(this, arguments); shortenTop(); return r; };
    }
  }
  FoteLifecycle.whenReady(boot);
})();

;
/* js/platform/touchui.js */
/* touchui.js - the tablet layout (2026-09-18, round 1 of the touch rebuild). Loaded after mobile.js, so its
   stylesheet lands last and wins.
   - Stairs / Grab / Search / Close / Swap buttons are gone on touch: stairs and pickups happen by walking onto
     them, and the d-pad's centre button now waits AND searches (quietly - it only speaks when it finds something).
   - Portrait bottom: bars, chips and the hotbar run full width; under them the log sits on the left and a
     bigger d-pad on the right.
   - Hotbar: one row of eight square slots, the icon filling the slot (repainted at a larger size so it stays sharp).
   - Top bar: Sound/Music live in Opts, so their buttons go; Map joins the tab row; the tabs share the width
     evenly so none can be pushed off a narrow screen. */
(function(){
  function touch(){ return document.body && document.body.classList.contains('touch'); }

  var st=document.createElement('style');
  st.textContent=[
    /* ---- d-pad: a real thumb target. --dp is one button */
    'body.touch{--dp:clamp(46px,9vw,62px)}',
    'body.touch #dpad{grid-template-columns:repeat(3,var(--dp))!important;grid-auto-rows:var(--dp)!important;gap:5px!important}',
    'body.touch #dpad button{font-size:calc(var(--dp)*.42 + var(--ui-mobile-text-add,0px))!important;min-height:0!important;padding:0!important;border-radius:10px}',
    'body.touch #dpad button[data-d="5"]{font-size:calc(var(--dp)*.36 + var(--ui-mobile-text-add,0px))!important;color:var(--gold)}',

    /* ---- portrait: hotbar row full width, then log (left) | d-pad (right) */
    '@media (orientation:portrait){',
    ' body.touch #strip{grid-template-columns:minmax(0,1fr) auto!important;grid-template-rows:auto auto;gap:8px!important}',
    ' body.touch #mid{grid-column:1/-1;grid-row:1;order:0}',
    ' body.touch #log{grid-column:1;grid-row:2;order:0;height:auto!important;min-height:0;contain:size;align-self:stretch;',
    '   font-size:calc(clamp(14px,2.2vw,16px) + var(--ui-mobile-text-add,0px));line-height:1.35;padding:7px 10px}',
    ' body.touch #ctl{grid-column:2;grid-row:2;order:0;display:flex!important;justify-content:flex-end;align-items:center}',
    '}',
    /* landscape keeps its two columns; the d-pad just sits a little smaller there because height is what runs out */
    '@media (orientation:landscape){ body.touch{--dp:clamp(40px,8vh,52px)} }',

    /* ---- hotbar: square slots, icon fills the slot */
    'body.touch #hotbar{grid-template-rows:auto!important;gap:6px!important;order:-1}',   /* hotbar first, above the bars */
    'body.touch #hotbar .slot{height:auto!important;aspect-ratio:1/1;max-height:96px;padding:0!important;border-radius:9px}',
    'body.touch #hotbar .slot .ico{width:86%!important;height:86%!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important}',
    'body.touch #hotbar .slot .ico canvas{width:100%!important;height:100%!important;display:block}',
    'body.touch #hotbar .slot .k{display:none}',                         /* number keys mean nothing without a keyboard */
    'body.touch #hotbar .slot.empty .n{display:none}',
    'body.touch #hotbar .slot .cdn.cdbig{font-size:calc(clamp(16px,3.8vw,24px) + var(--ui-mobile-text-add,0px))!important;right:0!important;bottom:auto!important}',
    'body.touch #hotbar .slot .cdn{font-size:calc(clamp(12px,2.6vw,17px) + var(--ui-mobile-text-add,0px))!important;right:5px!important;bottom:3px!important;',
    '  background:rgba(10,9,8,.7);border-radius:6px;padding:0 4px}',

    /* ---- top bar: tabs share the row evenly; nothing overflows off the right edge */
    'body.touch #topbtns{display:none!important}',
    'body.touch #brand{flex:0 0 auto;min-width:0}',
    'body.touch #tabs{overflow:visible!important;justify-content:stretch!important;gap:4px!important;flex:1 1 auto;min-width:0}',
    'body.touch #tabs button.on{color:var(--gold)!important}',
    'body.touch #tabs button{flex:1 1 0!important;min-width:0!important;padding:0 2px!important;font-size:calc(clamp(13.5px,3.3vw,17px) + var(--ui-mobile-text-add,0px))!important;color:var(--ash);',
    '  white-space:nowrap;overflow:hidden;text-overflow:clip}',
    '@media (max-width:480px){ body.touch #brand{display:none} }',  /* phone: the floor number is in the chips row */

    /* ---- sheets fill the screen under the tab row, over the hotbar and d-pad (they were squeezed into the
       map's box, the top 60% of a tablet) */
    'body.touch #shade{position:fixed!important;left:0!important;right:0!important;top:var(--toph,52px)!important;bottom:0!important;',
    '  z-index:60!important;padding:6px 6px calc(6px + env(safe-area-inset-bottom,0px))!important;align-items:stretch!important}',
    'body.touch .sheet{width:100%!important;max-width:none!important;max-height:none!important;height:100%}',

    /* ---- Gear: two worn columns beside five bag columns, sharing a tile size. */
    'body.touch .tgear .tg-top{grid-template-columns:repeat(7,minmax(0,1fr))!important;gap:6px!important;width:100%;max-width:624px}',
    'body.touch .tgear .tg-top>div{min-width:0}',
    'body.touch .tgear .tg-top>div:first-child{grid-column:span 2}',
    'body.touch .tgear .tg-top>div:last-child{grid-column:span 5}',
    'body.touch .tgear .tg-slots{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important}',
    'body.touch .tgear .tg-cells{grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:0!important}',
    'body.touch .tgear .tg-cells .cell{border-radius:0}',
    'body.touch .tgear .gslot{width:100%!important;height:auto!important;aspect-ratio:1/1;min-height:0!important;padding:2px!important;justify-content:center!important;gap:0!important}',
    'body.touch .tgear .gslot .nm{display:none}',
    'body.touch .tgear .gslot .ic{width:64%!important;height:64%!important}',
    'body.touch .tgear .gslot .ph{font-size:calc(clamp(18px,4vmin,30px) + var(--ui-mobile-text-add,0px))!important;line-height:1!important}',
    'body.touch .tgear .gslot .lab{font-size:calc(clamp(7px,1.4vmin,10px) + var(--ui-mobile-text-add,0px))!important;letter-spacing:0;line-height:1.1;margin-top:2px;white-space:nowrap}',
    'body.touch .tgear .cell{min-height:0!important}',
    /* Occupied bag cells drag directly; empty cells and gaps still scroll. */
    'body.touch .tgear .cell[data-b]{touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}',
    'body.touch .tgear .cell .gear{width:74%;height:74%;display:flex;align-items:center;justify-content:center}',
    'body.touch .tgear .gslot .ic canvas,body.touch .tgear .cell canvas{width:100%!important;height:100%!important;display:block}',
    'body.touch .tgear .cell b{font-size:calc(13px + var(--ui-mobile-text-add,0px))!important}',
    'body.touch .tgear .tg-hint{font-size:calc(13px + var(--ui-mobile-text-add,0px))!important}',
    'body.touch .tgear .tg-sec{font-size:calc(11px + var(--ui-mobile-text-add,0px))!important}',
    'body.touch #bAmHot{margin-top:10px;min-height:44px;width:100%;max-width:100%;padding:4px;font-size:calc(12px + var(--ui-mobile-text-add,0px));white-space:normal}',

    /* Keep every title action reachable even on a short phone screen. 2026-09-28: the menu sits at the bottom, under
       the logo painted into the title art (it ends about 31% down), instead of stretching over it. */
    '@media (max-height:560px){',
    ' body.touch #title .menu{top:auto;bottom:max(12px,env(safe-area-inset-bottom,0px));transform:none;overflow-y:auto;justify-content:flex-end;gap:6px}',
    ' body.touch #title .menu button{font-size:calc(20px + var(--ui-mobile-text-add,0px));min-height:44px;padding:6px 14px;flex-shrink:0}',
    '}',
    /* Landscape: vitals and controls | map and hotbar | menus and combat log.
       Keep the existing elements and handlers; sheets stay inside the map. */
    '@media (orientation:landscape) and (min-width:600px){',
    ' body.touch #app{display:grid!important;box-sizing:border-box;grid-template-columns:clamp(136px,15vw,164px) minmax(0,1fr) clamp(136px,17vw,208px);grid-template-rows:90px auto minmax(0,1fr) 48px;gap:4px;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)}',
    ' body.touch #strip,body.touch #mid,body.touch #ctl{display:contents!important}',
    ' body.touch #map{grid-column:2;grid-row:1/4;min-width:0;min-height:0;overflow:hidden}',
    ' body.touch #hotbar{grid-column:2;grid-row:4;align-self:stretch;grid-template-rows:1fr!important;gap:4px!important;order:0;margin:0;min-width:0}',
    ' body.touch #hotbar .slot{height:100%!important;min-width:0;aspect-ratio:auto;max-height:48px}',
    ' body.touch #hotbar .slot .ico{width:86%!important;height:auto!important;aspect-ratio:1;max-height:44px;max-width:44px}',
    ' body.touch #dpad{grid-column:1;grid-row:3/5;align-self:end;justify-self:stretch;grid-template-columns:repeat(3,minmax(44px,1fr))!important;grid-auto-rows:52px!important;gap:2px!important}',
    ' body.touch #app:has(#shade.on) #dpad{opacity:.45}',
    ' body.touch #fx{display:none!important}',
    ' body.touch #top{grid-column:3;grid-row:1;align-self:start;min-height:0!important;min-width:0;padding:0!important;border:0}',
    ' body.touch #brand{display:none!important}',
    ' body.touch #tabs{display:grid!important;grid-template-columns:repeat(3,minmax(44px,1fr));gap:2px!important;align-self:stretch}',
    ' body.touch #tabs button{height:44px;min-height:44px!important;min-width:0!important;padding:0 1px!important;font-size:calc(clamp(11px,1.3vw,13px) + var(--ui-mobile-text-add,0px))!important;letter-spacing:0}',
    ' body.touch #tabs #bMap{grid-column:span 2}',
    ' body.touch #tabs:has(button[data-p="Sand"]) #bMap{grid-column:auto}',
    ' body.touch #app #bars{grid-column:1;grid-row:1;display:grid!important;grid-template-columns:1fr;gap:3px}',
    ' body.touch #app #bars .bar{height:28px!important}',
    ' body.touch #app #bars .bar span{font-size:calc(12px + var(--ui-mobile-text-add,0px))!important;padding:0 5px!important}',
    ' body.touch #app #hud2{grid-column:1;grid-row:2;display:flex!important;flex-wrap:wrap!important;align-content:start;justify-content:flex-start;gap:3px;max-height:80px;overflow:auto;font-size:calc(11px + var(--ui-mobile-text-add,0px))}',
    ' body.touch #app #hud2 .chip{padding:2px 4px!important;font-size:calc(11px + var(--ui-mobile-text-add,0px))!important;max-width:100%;overflow-x:auto}',
    ' body.touch #app #ctl{display:contents!important}',
    ' body.touch #app #log{grid-column:3;grid-row:2/5;display:flex!important;position:static!important;width:auto!important;height:auto!important;max-height:none!important;min-height:0;contain:size;pointer-events:auto;overflow:auto;font-size:calc(12px + var(--ui-mobile-text-add,0px));line-height:1.3;padding:6px;background:#151110;border:1px solid var(--edge)}',
    ' body.touch #app #map #shade{position:absolute!important;inset:0!important;padding:0!important}',
    ' body.touch #shade .cols3{grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))}',
    /* Ability details need the whole row; costs belong beneath the name. */
    ' body.touch #shade .arow{grid-template-columns:36px minmax(0,1fr);gap:4px 10px;align-items:start}',
    ' body.touch #shade .arow>.ic{grid-column:1;grid-row:1/3}',
    ' body.touch #shade .arow>span:nth-child(2){display:contents}',
    ' body.touch #shade .arow .n{grid-column:2;grid-row:1;min-width:0}',
    ' body.touch #shade .arow>.c{grid-column:2;grid-row:2;text-align:left;white-space:normal}',
    ' body.touch #shade .arow .d{grid-column:1/-1;grid-row:3;min-width:0}',
    ' body.touch #shade .abrow[data-pr]{grid-template-columns:28px auto minmax(0,1fr);gap:4px 10px;align-items:start}',
    ' body.touch #shade .abrow[data-pr]>.pico{grid-column:1;grid-row:1/3}',
    ' body.touch #shade .abrow[data-pr]>.k{grid-column:2;grid-row:1}',
    ' body.touch #shade .abrow[data-pr]>span:nth-child(3){display:contents}',
    ' body.touch #shade .abrow[data-pr]>span:nth-child(3)>span{grid-column:3;grid-row:1}',
    ' body.touch #shade .abrow[data-pr]>.prayer{grid-column:3;grid-row:2;justify-self:start;white-space:normal}',
    ' body.touch #shade .abrow[data-pr] .d{grid-column:1/-1;grid-row:3;min-width:0}',
    ' body.touch #shade .optgrid{grid-template-columns:minmax(0,1fr)}',
    ' body.touch #shade .optrow{flex-wrap:wrap}',
    ' body.touch #shade .tgear .tg-tot{grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr))}',
    ' body.touch.gearopen #hotbar{z-index:65}',
    ' body.touch #dtip{max-height:calc(100dvh - 24px);overflow:auto}',
    '}',
    /* Fit all four rows above the hotbar on short landscape phone screens. */
    '@media (orientation:landscape) and (min-width:600px) and (max-height:560px){',
    ' body.touch #app #dpad{height:100%;max-height:240px;grid-template-rows:repeat(3,minmax(44px,1fr))!important;grid-auto-rows:auto!important}',
    ' body.touch .tgear .tg-top{max-width:calc(clamp(36px,(100dvh - 174px)/4,54px)*7 + 36px)}',
    '}',

    /* ---- the hotbar's long-press menu */
    'body.touch #hotbar .slot{touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}',
    'body.touch #hotbar .slot.lifted{transform:scale(.92);opacity:.45}',
    'body.touch #hotbar .slot.over{border-color:var(--gold)!important;box-shadow:0 0 0 2px rgba(232,180,74,.5) inset}',
    '#hotGhost{position:fixed;z-index:80;pointer-events:none;transform:scale(1.12);opacity:.95;box-shadow:0 8px 24px rgba(0,0,0,.6);margin:0}',
    '#hotGhost .ico{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:86%;height:86%}',
    '#hotGhost .ico canvas{width:100%!important;height:100%!important;display:block}',
    '#hotGhost .k,#hotGhost .n,#hotGhost .c,#hotGhost .cdn,#hotGhost .clickmark{display:none}',
    /* Gear keeps the hotbar on screen (and only the hotbar), so a bag item can be dragged onto it */
    'body.touch.gearopen #bars,body.touch.gearopen #hud2,body.touch.gearopen #log,body.touch.gearopen #ctl{display:none!important}',
    'body.touch.gearopen #shade{bottom:var(--hotb,0px)!important}',
    'body.touch .tgear .cell.lifted,body.touch .tgear .gslot.lifted{opacity:.4}',
    '#hmenu{position:fixed;left:8px;right:8px;z-index:70;background:rgba(18,15,13,.97);border:1px solid var(--edge);border-radius:12px;',
    '  padding:12px;box-shadow:0 8px 30px rgba(0,0,0,.6);display:flex;flex-direction:column;gap:10px;max-width:520px;margin:0 auto}',
    '#hmenu .hm-card .nm{font-size:calc(18px + var(--ui-mobile-text-add,0px));color:var(--gold);margin-bottom:4px}',
    '#hmenu .hm-card .row,#hmenu .hm-card .hint,#hmenu .hm-card{font-size:calc(14px + var(--ui-mobile-text-add,0px));line-height:1.4}',
    '#hmenu .hm-card .row{display:flex;justify-content:space-between;gap:12px}',
    '#hmenu .hm-card .row b{color:var(--ink)}',
    '#hmenu .hm-btns{display:flex;flex-wrap:wrap;gap:8px}',
    '#hmenu .hm-btns button{flex:1 1 auto;min-height:48px;font-size:calc(15px + var(--ui-mobile-text-add,0px));padding:0 14px}',
    '#hmenu .hm-btns button.on{border-color:var(--gold);color:var(--gold)}',

    /* ---- long-press cards: across the screen, on the half away from the finger (see showCard below) */
    /* 2026-09-22 (Justin): the card sits bottom-left, above the hotbar, over the empty lower part of the sheet, where it can be read; it carries the item's buttons */
    'body.touch #dtip{left:var(--cardx,8px)!important;right:auto!important;top:auto!important;bottom:var(--cardb,8px)!important;width:var(--cardw,min(440px,calc(100vw - 16px)))!important;max-width:none!important;font-size:calc(14px + var(--ui-mobile-text-add,0px));padding:10px 12px!important;z-index:85!important;pointer-events:auto!important}',   /* over the docked hotbar and tabs (60) */
    'body.touch #dtip .tc-btns{display:flex;gap:8px;margin-top:10px}',
    'body.touch #dtip .tc-btns button{flex:1 1 auto;min-height:44px;font-size:calc(15px + var(--ui-mobile-text-add,0px))}',
    'body.touch #dtip .nm{font-size:calc(18px + var(--ui-mobile-text-add,0px))!important}',

    /* ---- one type size up across the strip (2026-09-18: it had room to spare) */
    'body.touch #mid .bar{height:26px!important}',
    'body.touch #mid .bar span{font-size:calc(clamp(14px,2.4vw,16px) + var(--ui-mobile-text-add,0px))!important;padding:0 9px!important}',
    'body.touch #hud2{font-size:calc(clamp(13px,2.1vw,15px) + var(--ui-mobile-text-add,0px))!important}',
    'body.touch #hud2 .chip{padding:3px 9px 3px 5px!important}',
    'body.touch #tip .nm{font-size:calc(18px + var(--ui-mobile-text-add,0px))!important}',
    'body.touch #tip .row{font-size:calc(14.5px + var(--ui-mobile-text-add,0px))!important}',
    'body.touch #tip .odds{font-size:calc(15px + var(--ui-mobile-text-add,0px))!important}',
    /* Portrait map cards use the free board between the HUD and controls. */
    '@media (orientation:portrait){ body.touch #tip{position:fixed;left:var(--maptip-x,8px)!important;top:var(--maptip-y,8px)!important;bottom:auto!important;right:auto!important;width:var(--maptip-w,calc(100vw - 16px));max-width:none!important;max-height:var(--maptip-h,50dvh);box-sizing:border-box;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;pointer-events:auto;z-index:60} }',
    'body.touch .sheet{font-size:calc(15px + var(--ui-mobile-text-add,0px))}',
    /* Exit: a browser will not let a page (or an installed web app) close itself, so on a phone or tablet the
       button could only fail. Home / swipe away closes it there. */
    'body.touch #tExit,body.touch #oExit{display:none!important}',
    /* Opts: key bindings mean nothing without a keyboard, and they pushed Audio/Display (map zoom) below the fold */
    'body.touch .optgrid{grid-template-columns:1fr!important}',
    'body.touch .optgrid>div:first-child{display:none}',
    'body.touch .optrow{font-size:calc(14px + var(--ui-mobile-text-add,0px));padding:8px 0}',
    'body.touch .seg button{padding:8px 12px;font-size:calc(13px + var(--ui-mobile-text-add,0px))}',
    'body.touch .sheet header h2{font-size:calc(18px + var(--ui-mobile-text-add,0px))!important}'
  ].join('\n');
  document.head.appendChild(st);

  /* hotbar icons are painted at 28px by ui.js; on touch they are drawn at 72 and scaled down by CSS instead */


  /* the d-pad centre: wait and search in one press. Capture phase, so js/runtime/game.js's plain wait never runs. */
  function hookDpad(){
    var dp=document.getElementById('dpad'); if(!dp || dp._touchWait) return !!dp;
    dp._touchWait=true;
    /* The pad owns held pointer directions; browser panning must not steal
       that gesture halfway through a step. Other map gestures stay unchanged. */
    dp.style.touchAction='none';
    dp.querySelectorAll('button[data-d]').forEach(function(b){b.style.touchAction='none';});
    var c=dp.querySelector('[data-d="5"]'); if(c){ if(!c.querySelector('svg'))c.innerHTML='&#9906;'; c.title='Wait and search'; }
    dp.addEventListener('click', function(ev){
      var b=ev.target.closest && ev.target.closest('button'); if(!b) return;
      // Landscape keeps the controls visible beside sheets, but browsing a
      // menu must never spend a turn or move the character underneath it.
      if(typeof uiOpen==='function' && uiOpen()){ ev.stopImmediatePropagation(); ev.preventDefault(); return; }
      /* while aiming, the d-pad cancels the aim instead of stepping (autoaim.js) */
      if(typeof aiming!=='undefined' && aiming){ ev.stopImmediatePropagation(); ev.preventDefault(); cancelAim(); return; }
      if(b.getAttribute('data-d')!=='5') return;
      ev.stopImmediatePropagation(); ev.preventDefault();
      if(typeof modalOpen!=='undefined' && modalOpen) return;
      if(!player || player.hp<=0) return;
      if(typeof searchAround==='function') searchAround(false, true); else endTurn();
    }, true);
    return true;
  }

  /* Map moves from the (hidden) top buttons into the tab row */
  function moveMap(){
    if(typeof FoteResponsiveHUD!=='undefined'&&FoteResponsiveHUD.isMounted())return true;
    var b=document.getElementById('bMap'), tabs=document.getElementById('tabs');
    if(!b || !tabs) return false;
    if(!touch()) return false;
    if(b.parentNode!==tabs) tabs.appendChild(b);
    return true;
  }


  /* ---------------- hover cards. A tap on a touch screen fires a (trusted) compatibility mousemove, which opened
     the hover card - and nothing ever sent the mouseleave, so it stayed over the controls. On touch only the
     long press (mobile.js, an untrusted synthetic mousemove) opens a card, and it goes on the half of the
     screen away from the finger. */
  function hookMapHover(){
    var cv=document.getElementById('cv'); if(!cv || cv._touchHover) return !!cv;
    cv._touchHover=true;
    cv.addEventListener('mousemove', function(ev){ if(touch() && ev.isTrusted) ev.stopImmediatePropagation(); }, true);
    cv.addEventListener('mousemove', function(ev){
      if(touch()&&!ev.isTrusted){mapTipPoint={x:ev.clientX,y:ev.clientY};placeMapTip();var tip=document.getElementById('tip');if(tip)tip.scrollTop=0;}
    });
    return true;
  }
  var mapTipPoint=null;
  function placeMapTip(){
    var tip=document.getElementById('tip');
    if(!touch()||innerWidth>innerHeight||!tip||tip.style.display==='none')return;
    var board=document.getElementById('map').getBoundingClientRect(),gap=8;
    var left=Math.max(gap,board.left+gap),right=Math.min(innerWidth-gap,board.right-gap);
    var top=Math.max(gap,board.top+gap),bottom=Math.min(innerHeight-gap,board.bottom-gap);
    var obstacles=[],spans=[[left,right]];
    function collect(ids,above){
      ids.forEach(function(id){
        var el=document.getElementById(id);if(!el||!el.getClientRects().length)return;
        var r=el.getBoundingClientRect();
        if(!r.width||!r.height||r.right<=left||r.left>=right)return;
        obstacles.push({rect:r,above:above});
        if(r.left-gap-left>=220)spans.push([left,r.left-gap]);
        if(right-r.right-gap>=220)spans.push([r.right+gap,right]);
      });
    }
    collect(['top','studyHud','studyActionBar','statusbar'],true);
    collect(['hotbar','dpad','studySearch','studyPickup'],false);
    /* A short phone may have more readable space beside the action rail than
       below it. Prefer a card that fits, then the largest scrollable area. */
    var best=null;
    spans.forEach(function(span){
      var width=Math.min(340,span[1]-span[0]),x=span[0]+(span[1]-span[0]-width)/2,t=top,b=bottom;
      obstacles.forEach(function(o){var r=o.rect;if(r.right<=x||r.left>=x+width)return;if(o.above)t=Math.max(t,r.bottom+gap);else b=Math.min(b,r.top-gap);});
      var height=Math.max(0,b-t);
      tip.style.setProperty('--maptip-w',width+'px');tip.style.setProperty('--maptip-h',height+'px');
      var fits=tip.scrollHeight<=tip.clientHeight,score=fits?width:width*height;
      if(!best||fits&&!best.fits||fits===best.fits&&score>best.score)best={x:x,width:width,top:t,bottom:b,height:height,fits:fits,score:score};
    });
    tip.style.setProperty('--maptip-x',best.x+'px');tip.style.setProperty('--maptip-w',best.width+'px');
    tip.style.setProperty('--maptip-h',best.height+'px');
    var y=mapTipPoint&&mapTipPoint.y<(best.top+best.bottom)/2?best.bottom-tip.offsetHeight:best.top;
    tip.style.setProperty('--maptip-y',Math.max(best.top,y)+'px');
  }
  window.addEventListener('resize',function(){setTimeout(placeMapTip,80);});
  hookMapHover();

  /* the top bar's height, for the full-screen sheets and the cards */
  function topH(){ var t=document.getElementById('top'); if(t) document.body.style.setProperty('--toph', t.getBoundingClientRect().bottom+'px'); }
  window.addEventListener('resize', function(){ setTimeout(topH, 50); });
  setTimeout(topH, 300);

  /* gear icons are painted at the size their tile shows them (ui.js paintIconArt), not at 72 and shrunk by CSS (2026-09-27) */

  /* ---------------- Gear: "Add amulet to hotbar" when the worn amulet has no slot (it was removed) */
  function amuletOnBar(){ return player && player.hotbar && player.hotbar.some(function(h){ return h && h.type==='amulet'; }); }
  if(typeof window.equipHTML==='function'){
    var _equipHTMLTouch = window.equipHTML;
    window.equipHTML = function(){
      var h=_equipHTMLTouch.apply(this, arguments);
      if(!touch() || !player || !player.amulet || amuletOnBar()) return h;
      var mark='</div></div><div><p class="tg-sec">Bag';
      return h.indexOf(mark)>=0 ? h.replace(mark, '</div><button id="bAmHot">Add amulet to hotbar</button></div><div><p class="tg-sec">Bag') : h;
    };
  }
  document.addEventListener('click', function(ev){
    if(!ev.target || ev.target.id!=='bAmHot') return;
    var i=player.hotbar.indexOf(null);
    if(i<0){ log('The hotbar is full. Hold an item slot to remove it first.','c-info'); return; }
    player.hotbar[i]={type:'amulet'}; sfx('ui-click'); abilityBar(); if(typeof refreshSheet==='function') refreshSheet();
  });

  /* ---------------- hotbar long press: a menu with the slot's card and what you can do with it.
     travel.js's own long press toggled the click spell with no way to see or undo it; on touch it is routed
     through this menu instead (its toggle only runs when the menu asks). */
  var hm=null, hmTimer=null, hmX=0, hmY=0, hmSwallow=false, hmPointerId=null;
  function closeHM(){ if(hm){ hm.remove(); hm=null; } }
  function placeHM(){
    if(!hm)return;
    var hb=document.getElementById('hotbar'),r=hb?hb.getBoundingClientRect():null;
    hm.style.left='8px';hm.style.right='8px';
    if(r&&document.body.classList.contains('study-hotbar-vertical')){
      if(r.left>innerWidth-r.right)hm.style.right=(innerWidth-r.left+8)+'px';
      else hm.style.left=(r.right+8)+'px';
      hm.style.top='8px';hm.style.bottom='auto';
      hm.style.maxHeight=Math.max(0,innerHeight-16)+'px';
    }else if(r&&r.top>innerHeight*.4){
      hm.style.top='auto';hm.style.bottom=(innerHeight-r.top+8)+'px';
      hm.style.maxHeight=Math.max(0,r.top-16)+'px';
    }else{
      var top=(r?r.bottom:60)+8;
      hm.style.bottom='auto';hm.style.top=top+'px';
      hm.style.maxHeight=Math.max(0,innerHeight-top-8)+'px';
    }
  }
  /* Re-measure after the responsive HUD has moved on rotation/resize. */
  window.addEventListener('resize',function(){if(hm)setTimeout(placeHM,80);});
  function openHM(i){
    closeHM(); var s=player && player.hotbar && player.hotbar[i]; if(!s) return;
    var btns=[];
    if(s.type==='ability' && typeof clickSpellable==='function' && clickSpellable(s.key))
      btns.push(player.clickSpell===s.key ? ['tap','Stop casting this on tap','on'] : ['tap','Cast this when you tap an enemy','']);
    if(s.type==='item' || s.type==='amulet' || s.type==='ranged') btns.push(['rm','Remove from hotbar','']);
    btns.push(['x','Close','']);
    hm=document.createElement('div'); hm.id='hmenu';
    var card=(typeof hotbarCard==='function' ? hotbarCard(i) : '').replace(/<div class="hint">[^<]*(Right-click|Key \d|Drag )[^<]*<\/div>/g,'');
    hm.innerHTML='<div class="hm-card">'+card+'</div><div class="hm-btns">'+
      btns.map(function(b){ return '<button data-a="'+b[0]+'" class="'+b[2]+'">'+b[1]+'</button>'; }).join('')+'</div>';
    document.body.appendChild(hm);
    placeHM();
    hm.addEventListener('click', function(ev){
      var b=ev.target.closest('button'); if(!b) return;
      var a=b.getAttribute('data-a');
      if(a==='tap')toggleClickSpell(s.key,true);
      if(a==='rm'){ player.hotbar[i]=null; abilityBar(); sfx('ui-click'); }
      closeHM();
    });
    if(navigator.vibrate) try{ navigator.vibrate(12); }catch(e){}
  }
  window.openHotbarMenu = openHM;
  /* one gesture for the slot: hold it and it lifts. Drag it onto another slot and let go to swap them;
     let go without moving and the menu opens. The browser's own long-press drag is switched off on the
     hotbar (draggable=false, touch-action:none), because it fought this for the same press. */
  var lift=null;      /* {slot, i, x, y, moved, ghost, over} while a slot is held */
  function slotAt(x,y){ var el=document.elementFromPoint(x,y); return el && el.closest ? el.closest('#hotbar .slot[data-i]') : null; }
  function dollAt(x,y){ if(x==null) return null; var el=document.elementFromPoint(x,y); return el && el.closest ? el.closest('.gdoll, .tg-portrait, .tg-mid') : null; }
  /* 2026-09-20: Justin - on touch you could not drop a bag item onto a worn slot, only on the doll, and the doll
     equips a weapon into the main hand. So a dagger could never reach the off hand. A drop on a worn slot now goes
     to THAT slot (js/presentation/ui/sheets.js already does this with the mouse). */
  function wornSlotAt(x,y){ if(x==null) return null; var el=document.elementFromPoint(x,y); return el && el.closest ? el.closest('.gslot[data-slot]') : null; }
  function endLift(){
    if(!lift) return;
    if(lift.ghost) lift.ghost.remove();
    lift.slot.classList.remove('lifted');
    if(lift.over) lift.over.classList.remove('over');
    lift=null;
  }
  function cancelHotbarHold(){
    clearTimeout(hmTimer);hmTimer=null;hmPointerId=null;
    endLift();hmSwallow=false;
  }
  document.addEventListener('pointerdown', function(ev){
    if(hm && !hm.contains(ev.target)){ closeHM(); hmSwallow=true; setTimeout(function(){ hmSwallow=false; }, 450); return; }
    if(!touch()) return;
    var slot=ev.target.closest && ev.target.closest('#hotbar .slot[data-i]'); if(!slot) return;
    /* A second finger must not steal or release an existing hold/drag. */
    if(hmPointerId!==null && hmPointerId!==ev.pointerId) return;
    hmPointerId=ev.pointerId;
    hmX=ev.clientX; hmY=ev.clientY;
    clearTimeout(hmTimer); endLift();
    hmTimer=setTimeout(function(){
      hmTimer=null; hmSwallow=true;
      lift={slot:slot, i:+slot.getAttribute('data-i'), x:hmX, y:hmY, moved:false, ghost:null, over:null};
      slot.classList.add('lifted');
      if(navigator.vibrate) try{ navigator.vibrate(12); }catch(e){}
    }, 420);
  }, true);
  document.addEventListener('pointermove', function(ev){
    if(hmPointerId!==null && hmPointerId!==ev.pointerId) return;
    if(hmTimer && (Math.abs(ev.clientX-hmX)>12 || Math.abs(ev.clientY-hmY)>12)){ clearTimeout(hmTimer); hmTimer=null; }
    if(!lift) return;
    if(!lift.moved && Math.abs(ev.clientX-lift.x)<10 && Math.abs(ev.clientY-lift.y)<10) return;
    ev.preventDefault();
    if(!lift.moved){
      lift.moved=true;
      var g=lift.slot.cloneNode(true), r=lift.slot.getBoundingClientRect();
      g.id='hotGhost'; g.style.width=r.width+'px'; g.style.height=r.height+'px';
      /* the clone's canvas comes over blank: copy the painted icon across */
      var src=lift.slot.querySelector('canvas'), dst=g.querySelector('canvas');
      if(src && dst){ dst.width=src.width; dst.height=src.height; dst.getContext('2d').drawImage(src,0,0); }
      document.body.appendChild(g); lift.ghost=g;
    }
    lift.ghost.style.left=(ev.clientX-lift.ghost.offsetWidth/2)+'px';
    lift.ghost.style.top=(ev.clientY-lift.ghost.offsetHeight/2)+'px';
    var over=slotAt(ev.clientX, ev.clientY);
    if(over===lift.slot) over=null;
    if(over!==lift.over){ if(lift.over) lift.over.classList.remove('over'); lift.over=over; if(over) over.classList.add('over'); }
  }, {capture:true, passive:false});
  ['pointerup','pointercancel'].forEach(function(n){ document.addEventListener(n, function(ev){
    if(hmPointerId!==null && hmPointerId!==ev.pointerId) return;
    if(n==='pointercancel'){cancelHotbarHold();return;}
    hmPointerId=null;
    if(hmTimer){ clearTimeout(hmTimer); hmTimer=null; }
    if(turnSequenceBusy()){if(lift)endLift();if(hmSwallow)setTimeout(function(){hmSwallow=false;},350);return;}
    if(lift){
      var L=lift;
      if(n==='pointerup' && L.moved && L.over){
        var j=+L.over.getAttribute('data-i'), t=player.hotbar[j];
        player.hotbar[j]=player.hotbar[L.i]; player.hotbar[L.i]=t;
        endLift(); sfx('ui-click'); abilityBar();
      } else if(n==='pointerup' && L.moved && releasedOutside('#hotbar', L.x, L.y, ev.clientX, ev.clientY)){
        endLift(); sfx('ui-click'); hotbarRemove(L.i);          /* 2026-09-27: let go off the bar, it comes off */
      } else if(n==='pointerup' && !L.moved){ endLift(); openHM(L.i); }
      else endLift();
    }
    if(hmSwallow) setTimeout(function(){ hmSwallow=false; }, 350);    /* some browsers send no click after a long hold */
  }, true); });
  window.addEventListener('blur',function(){cancelHotbarHold();closeHM();});
  document.addEventListener('lostpointercapture',function(ev){if(hmPointerId!==null && hmPointerId===ev.pointerId)cancelHotbarHold();},true);
  /* ---------------- Gear, Char and Faith + hotbar together. While one is open on touch, the strip shows only the hotbar and the
     sheet stops just above it. Bag items drag immediately; a tap still reads their card. The worn amulet,
     abilities (Char) and prayers (Faith) retain their hold-and-drag gesture. */
  window.addEventListener('resize', function(){ setTimeout(syncTouchSheet,60); });

  var bl=null, blTimer=null, blSwallow=false;        /* {src, entry, x, y, moved, ghost, over, pointerId} */
  function bagEntry(el){
    if(el.matches('.cell[data-b]')){ var it=player.bag[+el.getAttribute('data-b')]; return it ? {type:'item', ref:it} : null; }
    if(el.matches('.gslot[data-slot]')){
      var key=el.getAttribute('data-slot');
      return slotItem(key) ? {type:'equipment',slot:key,ref:slotItem(key)} : null;
    }
    var ab=el.getAttribute('data-ab'); if(ab && player.abilities.indexOf(ab)>=0) return {type:'ability', key:ab};
    var pr=el.getAttribute('data-pr'); if(pr && el.getAttribute('draggable')==='true') return {type:'prayer', key:pr};
    return null;
  }
  function endBL(){
    if(!bl) return;
    if(bl.ghost) bl.ghost.remove();
    bl.src.classList.remove('lifted');
    if(bl.over) bl.over.classList.remove('over');
    if(bl.worn) bl.worn.classList.remove('over');
    try{ if(bl.src.hasPointerCapture && bl.src.hasPointerCapture(bl.pointerId)) bl.src.releasePointerCapture(bl.pointerId); }catch(e){}
    bl=null;
  }
  function hideCards(){
    if(typeof hideCard==='function') hideCard();
    var tp=document.getElementById('tip'); if(tp) tp.style.display='none';
    /* mobile.js is still holding its long press open: a pointerdown is what closes it */
    try{ document.body.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, clientX:-50, clientY:-50})); }catch(e){}
  }
  document.addEventListener('pointerdown', function(ev){
    if(ev.clientX>=0)blSwallow=false;
    if(!touch() || !document.body.classList.contains('gearopen') || ev.clientX<0) return;
    var src=ev.target.closest && ev.target.closest('#shade .cell[data-b], #shade .gslot[data-slot], #shade [data-ab], #shade [data-pr]'); if(!src) return;
    var e0=bagEntry(src); if(!e0) return;
    var x=ev.clientX, y=ev.clientY;
    clearTimeout(blTimer); endBL();
    function begin(){
      blTimer=null;bl={src:src,entry:e0,x:x,y:y,moved:false,ghost:null,over:null,pointerId:ev.pointerId};
      try{ if(src.setPointerCapture && ev.pointerId!==undefined) src.setPointerCapture(ev.pointerId); }catch(e){}
    }
    if(src.matches('.cell[data-b], .gslot[data-slot]'))begin();else blTimer=setTimeout(begin,420);
    bl0={x:x, y:y};
  }, true);
  var bl0=null;
  document.addEventListener('pointermove', function(ev){
    if(blTimer && bl0 && (Math.abs(ev.clientX-bl0.x)>12 || Math.abs(ev.clientY-bl0.y)>12)){ clearTimeout(blTimer); blTimer=null; }
    if(!bl) return;
    if(bl.pointerId!==undefined && ev.pointerId!==bl.pointerId) return;
    if(!bl.moved && Math.abs(ev.clientX-bl.x)<10 && Math.abs(ev.clientY-bl.y)<10) return;
    ev.preventDefault();
    if(!bl.moved){
      bl.moved=true;blSwallow=true; hideCards();
      var hs=document.querySelector('#hotbar .slot'), r=(hs||bl.src).getBoundingClientRect(), g=document.createElement('div');   /* slot-sized, even from a wide row */
      g.id='hotGhost'; g.className='slot'; g.style.width=r.width+'px'; g.style.height=r.height+'px';
      var src=bl.src.querySelector('canvas');
      if(src){ var c=document.createElement('canvas'); c.width=src.width; c.height=src.height; c.getContext('2d').drawImage(src,0,0);
        c.style.cssText='position:absolute;left:13%;top:13%;width:74%;height:74%'; g.appendChild(c); }
      document.body.appendChild(g); bl.ghost=g; bl.src.classList.add('lifted');
    }
    bl.lx=ev.clientX; bl.ly=ev.clientY;
    bl.ghost.style.left=(ev.clientX-bl.ghost.offsetWidth/2)+'px';
    bl.ghost.style.top=(ev.clientY-bl.ghost.offsetHeight/2)+'px';
    var over=slotAt(ev.clientX, ev.clientY);
    if(over!==bl.over){ if(bl.over) bl.over.classList.remove('over'); bl.over=over; if(over) over.classList.add('over'); }
    var worn=bl.entry && bl.entry.type==='item' ? wornSlotAt(ev.clientX, ev.clientY) : null;
    if(worn!==bl.worn){ if(bl.worn) bl.worn.classList.remove('over'); bl.worn=worn; if(worn) worn.classList.add('over'); }
  }, {capture:true, passive:false});
  ['pointerup','pointercancel'].forEach(function(n){ document.addEventListener(n, function(ev){
    if(bl && bl.pointerId!==undefined && ev.pointerId!==bl.pointerId) return;
    if(blTimer){ clearTimeout(blTimer); blTimer=null; }
    if(!bl) return;
    if(n==='pointercancel')blSwallow=false;
    if(turnSequenceBusy()){endBL();return;}
    var B=bl;
    var release=document.elementFromPoint(ev.clientX,ev.clientY);
    if(n==='pointerup' && B.moved && B.entry.type==='equipment' && release && release.closest('.tg-cells, .invgrid') && slotItem(B.entry.slot)===B.entry.ref){
      endBL();hideCards();takeOffSlot(B.entry.slot);
    } else if(n==='pointerup' && B.moved && B.over){
      var dock=B.entry.type==='equipment'?({stow:'ranged',amulet:'amulet'}[B.entry.slot]):null;
      if(B.entry.type!=='equipment'||dock){hotbarPut(+B.over.getAttribute('data-i'), dock?{type:dock}:B.entry);sfx('ui-click');}
      endBL(); if(typeof refreshSheet==='function') refreshSheet();
    } else if(n==='pointerup' && B.moved && B.entry.type==='item' && wornSlotAt(B.lx, B.ly) && player.bag.indexOf(B.entry.ref)>=0){
      var wel=wornSlotAt(B.lx, B.ly), wslot=wel.getAttribute('data-slot'), wbi=player.bag.indexOf(B.entry.ref);
      endBL(); hideCards();
      if(typeof equipFromBag==='function' && wslot) equipFromBag(wbi, wslot==='stow' ? 'ranged' : wslot);
      else useBagItem(wbi);
      sfx('ui-click');
      if(typeof updateUI==='function') updateUI(); if(typeof refreshSheet==='function') refreshSheet();
    } else if(n==='pointerup' && B.moved && B.entry.type==='item' && dollAt(B.lx, B.ly) && player.bag.indexOf(B.entry.ref)>=0){
      /* 2026-09-20: Justin - dropping on the paper doll equips, the same as tapping the item (js/presentation/ui/sheets.js) */
      var bi=player.bag.indexOf(B.entry.ref);
      endBL(); hideCards(); useBagItem(bi); sfx('ui-click');
      if(typeof updateUI==='function') updateUI(); if(typeof refreshSheet==='function') refreshSheet();
    } else if(n==='pointerup' && B.moved && B.entry.type==='item' && player.bag.indexOf(B.entry.ref)>=0 && releasedOutside('.sheet, #hotbar', B.x, B.y, B.lx, B.ly)){
      /* 2026-09-27: let go outside the Gear window, the item is dropped: the card's Drop, by finger */
      var dbi=player.bag.indexOf(B.entry.ref);
      endBL(); hideCards(); dropFromBag(dbi); sfx('ui-click');
    } else endBL();
  }, true); });
  window.addEventListener('blur',function(){clearTimeout(blTimer);blTimer=null;endBL();blSwallow=false;});
  document.addEventListener('lostpointercapture',function(ev){if(bl && bl.pointerId===ev.pointerId)endBL();},true);
  /* once a slot or bag item is lifted, the finger drags it rather than scrolling the page */
  document.addEventListener('touchmove', function(ev){ if((bl && bl.moved) || (lift && lift.moved) || bl || lift) ev.preventDefault(); }, {passive:false});

  /* no native drag on the touch hotbar */
  document.addEventListener('dragstart', function(ev){ if(touch() && ev.target.closest && ev.target.closest('#hotbar, #shade')) ev.preventDefault(); }, true);


  /* the tap that ends a long press (or closes the menu) must not also fire the slot or step on the map */
  document.addEventListener('click', function(ev){
    if(blSwallow && ev.detail>0){blSwallow=false;ev.stopImmediatePropagation();ev.preventDefault();return;}
    var slot=ev.target.closest && ev.target.closest('#hotbar .slot'); if(slot) slot._longPress=false;   /* travel.js's flag */
    if(hmSwallow && !(hm && hm.contains(ev.target))){ hmSwallow=false; ev.stopImmediatePropagation(); ev.preventDefault(); }
  }, true);
  document.addEventListener('contextmenu', function(ev){ if(touch() && ev.target.closest && ev.target.closest('#hotbar')) ev.preventDefault(); });

  /* ---- 2026-09-22 (Justin): on the tablet, holding a bag item to read it dropped it (a long press fires the
     browser's contextmenu, which the mouse wiring uses for "drop"), and a tap equipped it before it could be read.
     On touch a tap on a bag item or a worn slot opens its card; the card carries the actions (Equip or Use, Drop;
     Take off); a long press never drops; hold-and-drag onto a worn slot or the hotbar still equips or docks. */
  (function(){
    window.addEventListener('resize',function(){var t=document.getElementById('dtip');if(touch()&&t&&t.style.display!=='none')setTimeout(placeTouchCard,80);});
    function verb(it){ return it.kind==='weapon'?'Equip':it.kind==='armor'?'Wear':it.kind==='off'?'Take up':it.kind==='food'?'Eat':'Use'; }
    function openCard(el, bi, slot){
      try{ el.dispatchEvent(new MouseEvent('mousemove', {clientX:0, clientY:0, bubbles:true})); }catch(e){ return; }   /* the hover card, placed by showCard above */
      var t=document.getElementById('dtip'); if(!t || t.style.display==='none') return;
      var btns=document.createElement('div'); btns.className='tc-btns';
      function add(label, fn){ var b=document.createElement('button'); b.textContent=label; b.onclick=function(ev){ ev.stopPropagation(); hideCard(); fn(); sfx('ui-click'); if(typeof updateUI==='function') updateUI(); if(typeof refreshSheet==='function') refreshSheet(); }; btns.appendChild(b); }
      if(bi!==null){ var it=player.bag[bi]; if(!it) return; add(verb(it), function(){ useBagItem(bi); }); add('Drop', function(){ dropBagItem(bi); }); }
      else if(slotItem(slot)) add('Take off', function(){takeOffSlot(slot);});
      if(btns.children.length) t.appendChild(btns);
    }
    /* a tap reads; the mouse wiring's tap-to-equip and long-press-to-drop never run on touch */
    document.addEventListener('click', function(ev){
      if(!touch() || !ev.target.closest) return;
      if(ev.target.closest('#dtip')) return;
      var cel=ev.target.closest('.cell[data-b]'), gs=cel?null:ev.target.closest('.gslot[data-slot]');
      if(!cel && !gs) return;
      ev.stopImmediatePropagation(); ev.preventDefault();
      if(cel) openCard(cel, +cel.getAttribute('data-b'), null); else openCard(gs, null, gs.getAttribute('data-slot'));
    }, true);
    document.addEventListener('contextmenu', function(ev){
      if(touch() && ev.target.closest && ev.target.closest('.cell[data-b], .gslot[data-slot], .eslot')){ ev.stopImmediatePropagation(); ev.preventDefault(); }
    }, true);
    /* a touch anywhere off the card closes it */
    document.addEventListener('pointerdown', function(ev){
      if(!touch() || ev.clientX<0) return;
      var t=document.getElementById('dtip'); if(t && t.style.display!=='none' && !(ev.target.closest && ev.target.closest('#dtip'))) hideCard();
    }, true);
  })();

  var n=0, t=setInterval(function(){ var a=hookDpad(), m=moveMap(), c=hookMapHover(); if((a && m && c) || ++n>600) clearInterval(t);   /* up to a minute: the art takes a while to load */ }, 100);
})();

