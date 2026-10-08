/* ============================================================================
   ui.js - modals, sprite icons, hotbar, HUD, sheets (Character, Equipment,
   Faith), tooltips, extra keys. Overrides the matching js/runtime/game.js functions.
   ========================================================================== */

(function injectCSS(){
  var css = `
  #modal{position:fixed;inset:0;z-index:90;display:none;align-items:center;justify-content:center;background:rgba(6,5,4,.78);padding:16px}
  #modal.on{display:flex}
  #modal .mbox{width:min(620px,100%);max-height:min(88vh,760px);display:flex;flex-direction:column;background:linear-gradient(180deg,#221D1A,#171310);
    border:1px solid #4A3E34;border-radius:10px;box-shadow:0 24px 60px rgba(0,0,0,.7)}
  #modal .mbox.wide{width:min(880px,100%)}
  #modal header{padding:12px 16px;border-bottom:1px solid var(--edge);display:flex;align-items:center;justify-content:space-between}
  #modal header h2{font-family:var(--display);color:var(--gold);font-size:calc(22px + var(--ui-mobile-text-add,0px));margin:0}
  #modal .mbody{padding:14px 16px;overflow-y:auto;line-height:1.5;font-size:calc(12.5px + var(--ui-mobile-text-add,0px));color:var(--ink)}
  #modal .mbody p{margin:0 0 8px}
  .merchant-summary{position:sticky;top:-14px;z-index:2;display:flex;justify-content:space-between;gap:12px;padding:12px 0;background:var(--panel,#211b16);border-bottom:1px solid var(--edge);margin-bottom:14px}
  .merchant-summary b{color:var(--gold);white-space:nowrap}.merchant-summary span{color:var(--dim)}
  .merchant-section{margin:18px 0 22px}.merchant-section h3{margin:0 0 8px;color:var(--gold);font:calc(18px + var(--ui-mobile-text-add,0px)) var(--display)}
  .merchant-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .merchant-card{display:grid;grid-template-columns:32px minmax(0,1fr) auto 70px;align-items:center;gap:8px;padding:10px;border:1px solid var(--edge);border-radius:6px;background:rgba(0,0,0,.12)}
  .merchant-card.sold{opacity:.55}.merchant-card .merchant-name{line-height:1.35;overflow-wrap:anywhere}.merchant-price{text-align:right;white-space:nowrap;color:var(--gold);font-size:calc(12px + var(--ui-mobile-text-add,0px))}.merchant-price small{display:block;color:var(--dim);font-size:calc(10px + var(--ui-mobile-text-add,0px))}
  .merchant-card button{margin:0;min-height:32px;padding:5px 8px}.merchant-card details{grid-column:2/-1;font-size:calc(12px + var(--ui-mobile-text-add,0px))}.merchant-card summary{cursor:pointer;color:var(--dim)}
  .merchant-card details[open]{padding-top:5px}.merchant-card .pico{display:block}.merchant-card [data-merchant-icon]{display:flex;align-items:center;justify-content:center}
  @media(max-width:850px){.merchant-grid{grid-template-columns:1fr}.merchant-summary{flex-wrap:wrap}.merchant-card{grid-template-columns:28px minmax(0,1fr) auto 62px}}
  #modal footer{padding:10px 16px;border-top:1px solid var(--edge);display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
  #modal footer button.primary, .btn-primary{background:linear-gradient(180deg,#8A4A1E,#5A2E12);border-color:#B8653A;color:#FFE9C8}
  #modal footer button:disabled, button:disabled{opacity:.38;cursor:default;border-color:var(--edge)!important;color:var(--dim)!important}
  .bossbar{position:absolute;left:50%;top:10px;transform:translateX(-50%);z-index:5;width:min(420px,70%);text-align:center;font-family:var(--display);color:#E8B44A;font-size:calc(15px + var(--ui-mobile-text-add,0px));text-shadow:0 1px 3px #000;pointer-events:none}
  .bossbar .bb{height:9px;border:1px solid #5A2E18;background:#1A0E0A;border-radius:4px;overflow:hidden;margin-top:3px}
  .bossbar .bb i{display:block;height:100%;background:linear-gradient(90deg,#8E2F27,#E2622B)}
  .shrine-head{display:grid;grid-template-columns:130px minmax(0,1fr);gap:14px;align-items:start;margin-bottom:12px}
  .shrine-details{min-width:0;overflow-wrap:anywhere}
  .shrine h3,.faith h3{font-family:var(--display);font-size:calc(20px + var(--ui-mobile-text-add,0px));margin:0}
  .boons{margin:0 0 8px 18px;padding:0} .boons li{margin:2px 0}
  .forge-top{display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
  .pouch2{display:flex;gap:6px;flex-wrap:wrap}
  .mslot{width:64px;display:flex;flex-direction:column;align-items:center;gap:1px;padding:5px 2px;border:1px solid var(--edge);border-radius:6px;background:#141110;font-size:calc(10px + var(--ui-mobile-text-add,0px));color:var(--ash)}
  .mslot b{font-size:calc(13px + var(--ui-mobile-text-add,0px));color:var(--ink)} .mslot.none{opacity:.4}
  .forge-info{font-size:calc(12px + var(--ui-mobile-text-add,0px));color:#fff;font-weight:700;display:flex;flex-direction:column;gap:2px} .forge-info .c-info{color:#fff}   /* 2026-09-28 (Justin): bright white and bold; the affinity keeps its element colour, essence its gold */
  .ftabs{display:flex;gap:4px;margin:6px 0 10px} .ftabs button.on{border-color:var(--ember);color:var(--gold);background:#2A2015}
  .frow{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05)}
  .frow .ftext{flex:1} .frow .d, .egrid .d{color:var(--dim);font-size:calc(11px + var(--ui-mobile-text-add,0px));display:block}
  .dot{width:11px;height:11px;border-radius:50%;display:inline-block;flex:0 0 auto;box-shadow:0 0 6px rgba(255,255,255,.2)}
  .egrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px;margin:6px 0 12px}
  .egrid button{text-align:left;display:flex;flex-direction:column;gap:2px}
  .fslot{margin-top:6px}
  .slot .ico{position:absolute;left:5px;top:50%;transform:translateY(-50%);width:28px;height:28px;image-rendering:auto}
  .slot.hasico{padding-left:38px}
  #hud2{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:calc(10.5px + var(--ui-mobile-text-add,0px));color:var(--ash);min-height:16px}
  #hud2 .chip{display:flex;align-items:center;gap:4px;border:1px solid var(--edge);border-radius:12px;padding:1px 8px 1px 4px;background:#151110}
  #hud2 .chip canvas{display:block}
  .hunger{width:90px;height:8px;border:1px solid var(--edge);border-radius:3px;background:#120F0D;position:relative;overflow:hidden}
  .hunger i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#6B5A22,#B89A4A)}
  #hud2 .faithchip{gap:6px;padding:1px 8px 1px 3px;white-space:nowrap;cursor:pointer}
  #hud2 .faithchip .meter{width:70px}
  #hud2 .faithchip .meter.sm{width:40px}
  #hud2 .faithchip .gdot{width:14px;height:14px;border-radius:50%;box-shadow:0 0 6px currentColor;display:inline-block;background:currentColor;opacity:.9}
  #hud2 .faithchip .gname{font-weight:700;letter-spacing:.02em}
  #hud2 .faithchip .rk{color:var(--ink);opacity:.85}
  .meter{width:90px;height:8px;border:1px solid var(--edge);border-radius:3px;background:#120F0D;position:relative;overflow:hidden;display:inline-block;vertical-align:middle}
  .meter.sm{width:48px}
  .meter i{position:absolute;left:0;top:0;bottom:0}
  .fmeter{display:flex;align-items:center;gap:10px;margin:6px 0 10px;font-size:calc(11px + var(--ui-mobile-text-add,0px));color:var(--ash)}
  .fmeter .meter{flex:1;height:10px}
  .slot.prayer-slot{border-color:var(--gc,#8A6FB0)}
  .slot.prayer-slot .c{color:var(--gc,#C9A8FF)}
  .abrow.dragp{cursor:grab}
  .abrow .pico{width:28px;height:28px;flex:none}
  .abrow[data-pr]{grid-template-columns:28px auto 1fr auto;align-items:center}
  #topbtns{display:flex;gap:4px;align-items:center;margin-left:8px}
  #topbtns button{font-size:calc(10.5px + var(--ui-mobile-text-add,0px));padding:3px 7px;white-space:nowrap}
  .tag canvas{vertical-align:middle;margin-right:2px}
  .cell .gear{position:absolute;inset:3px;display:flex;align-items:center;justify-content:center}
  .doll{grid-template-columns:minmax(0,1fr) clamp(110px,26%,150px) minmax(0,1fr)!important}
  @media (min-width:700px){ .equip{grid-template-columns:minmax(300px,1.35fr) minmax(220px,1fr)!important} }
  .dollart{grid-column:2;min-height:190px;grid-row:1/5;align-self:stretch;border:1px dashed var(--edge);border-radius:8px;background:radial-gradient(#2A221C,#141110);display:flex;align-items:flex-end;justify-content:center;overflow:hidden}
  .prayer{font-size:calc(11px + var(--ui-mobile-text-add,0px));padding:3px 8px}
  .faith .who{margin-bottom:6px}
  /* character creation */
  #create{position:fixed;inset:0;z-index:40;background:radial-gradient(ellipse at 50% 20%,#2A1F18,#0B0908 70%);display:none;overflow-y:auto}
  #create.on{display:block}
  #create .wrap{max-width:1100px;margin:0 auto;padding:22px 16px 40px}
  #create h1{font-size:calc(34px + var(--ui-mobile-text-add,0px));text-align:center;margin:6px 0 2px}
  #create .tag2{text-align:center;color:var(--ash);margin-bottom:18px}
  #create .step{margin:16px 0 6px;font-size:calc(10px + var(--ui-mobile-text-add,0px));letter-spacing:.18em;text-transform:uppercase;color:var(--dim)}
  #create .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}
  #create .card{background:#171310;border:1px solid var(--edge);border-radius:8px;padding:10px;cursor:pointer;display:flex;flex-direction:column;gap:4px;text-align:left;color:var(--ink)}
  #create .card:hover{border-color:#6A5040}
  #create .card.on{border-color:var(--ember);background:#241A12;box-shadow:0 0 0 1px rgba(226,98,43,.35) inset}
  #create .card b{font-family:var(--display);font-size:calc(17px + var(--ui-mobile-text-add,0px));color:var(--gold)}
  #create .card span{font-size:calc(11px + var(--ui-mobile-text-add,0px));color:var(--ash);line-height:1.4}
  #create .card .port{height:120px;display:flex;align-items:flex-end;justify-content:center}
  #create .card .class-symbol{height:48px}
  #create .summary{display:grid;grid-template-columns:200px 1fr;gap:18px;align-items:center;background:#141110;border:1px solid var(--edge);border-radius:10px;padding:14px;margin-top:18px}
  #create .summary .big{height:230px;display:flex;align-items:flex-end;justify-content:center}
  #create .summary>div{min-width:0}
  #create .create-sound-note{display:block;max-width:100%;margin:8px 0 0;font-size:calc(11px + var(--ui-mobile-text-add,0px));line-height:1.5;white-space:normal;overflow-wrap:anywhere}
  #create .go{font-size:calc(16px + var(--ui-mobile-text-add,0px));padding:10px 26px;margin-top:10px}
  #create input{width:220px;font-size:calc(14px + var(--ui-mobile-text-add,0px))}
  @media (max-width:640px){ #create .summary{grid-template-columns:1fr} .shrine-head{grid-template-columns:80px minmax(0,1fr);gap:10px} .shrine-head .shrine-art{max-width:80px;overflow:hidden} .shrine-head .shrine-art canvas{max-width:100%;height:auto!important} }
  `;
  var s=document.createElement('style'); s.textContent=css; document.head.appendChild(s);
})();

/* ---------------------------------------------------------------- modals */
var modalOpen=false, modalOnClose=null;
function ensureModal(){
  var m=$('modal'); if(m) return m;
  m=document.createElement('div'); m.id='modal';
  m.innerHTML='<div class="mbox"><header><h2 id="mTitle"></h2><button id="mX">Close &nbsp;esc</button></header><div class="mbody" id="mBody"></div><footer id="mFoot"></footer></div>';
  document.body.appendChild(m);
  m.addEventListener('click', function(ev){ if(ev.target===m) closeModal(); });
  $('mX').onclick=closeModal;
  return m;
}
function openModal(title, html, buttons, size){
  var m=ensureModal();
  m.querySelector('.mbox').className='mbox'+(size?' '+size:'');
  $('mTitle').innerHTML=title; $('mBody').innerHTML=html;
  var foot=$('mFoot'); foot.innerHTML='';
  (buttons||[]).forEach(function(b){
    if(!b.label) return;
    var el=document.createElement('button'); el.innerHTML=b.label; if(b.cls) el.className=b.cls; if(b.disabled) el.disabled=true;
    el.onclick=function(){ sfx('ui-click'); b.fn(); }; foot.appendChild(el);
  });
  m.classList.add('on'); modalOpen=true; sfx('ui-open');
  var pri=foot.querySelector('.primary'); if(pri) setTimeout(function(){ pri.focus(); }, 30);
}
function closeModal(){ var m=$('modal'); if(m) m.classList.remove('on'); modalOpen=false; sfx('ui-close'); if(modalOnClose){ var f=modalOnClose; modalOnClose=null; f(); } updateUI(); }
function confirmBox(title, text, yesLabel, onYes){
  var btns=[{label:'Cancel', fn:closeModal}];
  if(yesLabel) btns.push({label:yesLabel, cls:'primary', fn:function(){ closeModal(); onYes(); }});
  openModal(title, '<p>'+text+'</p>', btns);
}

/* ---------------------------------------------------------------- art helpers */
/* 2026-09-27 (Justin, equip plan step 8, D14): icons were fitted to their trimmed box through a smoothing filter (a ring
   blown up x4.6) and on phones painted at 72 and shrunk again by CSS, so slots, bag and hotbar were soft. An icon is now
   painted at the size it is shown. Ring and amulet icons in the slots, bag and hotbar fit their atlas cell, so a ring
   keeps its true size beside a sword (D14); every other icon fits its painted box, as before. A whole-number scale (or
   one within a tenth of it) draws nearest neighbour; any other enlargement goes through a whole-number nearest copy
   first, so the one filtered step only shrinks, at 'high' quality. keep: the page sets the canvas's CSS size, so only
   the backing store follows it. */
var ICON_UP=new WeakMap(), ICON_SHOWN={}, ICON_RUNES_SHARP=true;
var STATIC_ART_REQUESTS=new WeakMap(),STATIC_ART_PENDING=new Set(),STATIC_ART_OBSERVER=null;
function cancelStaticArtPaint(el,channel){
  var requests=STATIC_ART_REQUESTS.get(el),request=requests&&requests.get(channel||'art');
  if(!request)return;
  request.active=false;request.cancel.forEach(function(cancel){cancel();});requests.delete(channel||'art');STATIC_ART_PENDING.delete(request);
  if(!requests.size)STATIC_ART_REQUESTS.delete(el);
  if(!STATIC_ART_PENDING.size&&STATIC_ART_OBSERVER){STATIC_ART_OBSERVER.disconnect();STATIC_ART_OBSERVER=null;}
}
/* One mounted host/request owns its callbacks. Subscriptions survive a failed
 * atlas attempt, but a replacement, detached host or changed actor disposes them. */
function watchStaticArt(el,files,repaint,owns,channel,metadata,onFailure){
  channel=channel||'art';cancelStaticArtPaint(el,channel);
  if(!el)return;
  files=typeof files==='function'?files():files;
  files=(files||[]).filter(function(file,index,all){var job=ATLAS_JOBS.get(file);return all.indexOf(file)===index&&(!job||job.phase!=='ready');});
  var props=metadata&&typeof FoteEnvironmentProps!=='undefined'&&FoteEnvironmentProps;
  var waitingMetadata=props&&props.metadataReady&&props.subscribeMetadata&&!props.metadataReady();
  if(!files.length&&!waitingMetadata)return;
  var requests=STATIC_ART_REQUESTS.get(el);if(!requests)STATIC_ART_REQUESTS.set(el,requests=new Map());
  var request={el:el,child:el.firstChild,active:true,cancel:[],connected:!!el.isConnected};requests.set(channel,request);STATIC_ART_PENDING.add(request);
  function current(){return request.active&&requests.get(channel)===request&&el.firstChild===request.child&&(!owns||owns());}
  function ready(){
    if(!current()||el.isConnected===false){cancelStaticArtPaint(el,channel);return;}
    cancelStaticArtPaint(el,channel);repaint();
  }
  function failed(){
    if(!current()||el.isConnected===false){cancelStaticArtPaint(el,channel);return;}
    if(onFailure){cancelStaticArtPaint(el,channel);onFailure();}
  }
  files.forEach(function(file){request.cancel.push(subscribeAtlas(file,ready,failed));});
  if(waitingMetadata)request.cancel.push(props.subscribeMetadata(ready,failed));
  if(!STATIC_ART_OBSERVER&&typeof MutationObserver==='function'&&document.documentElement){
    STATIC_ART_OBSERVER=new MutationObserver(function(){
      Array.from(STATIC_ART_PENDING).forEach(function(pending){
        if(pending.el.isConnected)pending.connected=true;
        else if(pending.connected){var scopes=STATIC_ART_REQUESTS.get(pending.el);if(scopes)scopes.forEach(function(value,key){if(value===pending)cancelStaticArtPaint(pending.el,key);});}
      });
    });
    STATIC_ART_OBSERVER.observe(document.documentElement,{childList:true,subtree:true});
  }
}
/* the remembered icon box sizes are measured again on their next paint; a rune's own key (no '|') is kept (C4, below) */
var HOTBAR_ICON_REVISION=0;
function forgetIconSizes(){ HOTBAR_ICON_REVISION++;Object.keys(ICON_SHOWN).forEach(function(key){ if(key.indexOf('|')>=0) delete ICON_SHOWN[key]; }); }
function paintIconArt(c, o, w, h, trinket, keep){
  var d=window.devicePixelRatio||1, W=Math.max(1,Math.round(w*d)), H=Math.max(1,Math.round(h*d));
  c.width=W; c.height=H; if(!keep){ c.style.width=(W/d)+'px'; c.style.height=(H/d)+'px'; }
  var f=trinket && o.cell ? Math.min(W,H)/o.cell : Math.min(W/o.sw, H/o.sh)*0.92, n=Math.floor(f+1e-6), src=o;
  if(n>=1 && f-n<n/10) f=n;
  else if(f>1){
    var k=Math.ceil(f), memo=ICON_UP.get(o.img); if(!memo) ICON_UP.set(o.img, memo={});
    var id=o.sx+','+o.sy+','+o.sw+','+o.sh+'x'+k, u=memo[id];
    if(!u){ u=memo[id]=document.createElement('canvas'); u.width=o.sw*k; u.height=o.sh*k; var q=u.getContext('2d'); q.imageSmoothingEnabled=false; q.drawImage(o.img,o.sx,o.sy,o.sw,o.sh,0,0,u.width,u.height); }
    src={img:u, sx:0, sy:0, sw:u.width, sh:u.height}; f/=k;
  }
  var x=c.getContext('2d'), dw=src.sw*f, dh=src.sh*f;
  /* 2026-10-05 (item art): a 128px item picture (environment-items.webp: the foods, the knife, the Crypt core) shrunk to
     under half its size was averaged soft at 'high', softer in a 38px bag cell than the 64px picture it replaced. That
     one case takes the plain filter the floor already draws these pictures through. Every other icon keeps 'high'. */
  x.imageSmoothingEnabled=f<1; x.imageSmoothingQuality=f<0.5 && o.res===2 && o.cell===128 ? 'low' : 'high';
  x.drawImage(src.img, src.sx,src.sy,src.sw,src.sh, Math.round((W-dw)/2), Math.round((H-dh)/2), dw, dh);
}
function paintArtCanvas(el, group, name, size){
  if(!el)return;
  cancelStaticArtPaint(el);cancelStaticArtPaint(el,'chip');
  var o = group==='cast' ? null : (objArt(group,name) || anyObj(name));
  var c=document.createElement('canvas'), d=window.devicePixelRatio||1, S=size||32;
  function watch(){watchStaticArt(el,function(){return packedObjectSources(group,name,true,o);},function(){paintArt(el,group,name,size);},null,'art',true);}
  if(o){
    var trinket=group==='items' && /^item-(ring|amulet)(-|$)/.test(name) && !!((el.classList && el.classList.contains('gear')) || (el.closest && el.closest('#hotbar')));
    /* a canvas the page stretches to its box (touch Gear tiles, the hotbar) is repainted at the size it is shown. For a
       box already on the page that size is remembered per kind of box and window size, so the hotbar's repaint every
       turn forces no layout; a detached one is measured on the next frame, once it has been placed. */
    var legacy=el.isConnected && el.parentNode ? el.className+'<'+String(el.parentNode.className).split(' ')[0]+'@'+innerWidth+'x'+innerHeight+'x'+d+(document.body.classList.contains('touch')?'t':'') : null;
    /* 2026-10-05 (item art, C4): that size outlived the layout it was measured in. The first hotbar paint measured a 44px
       box while the overlay HUD's stylesheet was still reloading (responsive-hud.js mount), the slot then showed at 58 to
       70px, and every later paint reused 44 and let the page stretch it, so every hotbar icon was soft. The body's classes
       are the HUD layout, so they are part of the key, and forgetIconSizes above drops what was measured too early. A
       sigil rune kept the old key, and so the size it had always been painted at. 2026-10-06 (Justin: 'sharper runes in
       hotbar'): ICON_RUNES_SHARP is on, so a rune is painted at its shown size like every other icon; false restores the old path. */
    var key=legacy && (String(name).indexOf('rune-')===0 && !ICON_RUNES_SHARP ? legacy : legacy+'|'+document.body.className), known=key ? ICON_SHOWN[key] : undefined;
    paintIconArt(c, o, known ? known[0] : S, known ? known[1] : S, trinket, !!known);
    el.innerHTML=''; el.appendChild(c);
    var shown=function(){ if(el.isConnected===false||el.firstChild!==c)return;var st=getComputedStyle(c), w=/px$/.test(st.width) && parseFloat(st.width), h=/px$/.test(st.height) && parseFloat(st.height);
      if(!(w>0 && h>0)) return;
      var stretched=Math.abs(w-S)*d>0.5 || Math.abs(h-S)*d>0.5;
      if(key) ICON_SHOWN[key]=stretched && [w,h];
      if(legacy && ICON_SHOWN[legacy]===undefined) ICON_SHOWN[legacy]=stretched && [w,h];   /* the size a rune reads, taken when it always was */
      if(stretched) paintIconArt(c, o, w, h, trinket, true); };
    if(known===undefined){ if(key) shown(); else if(window.requestAnimationFrame) requestAnimationFrame(shown); }
    watch();
    return;
  }
  c.width=S*d; c.height=S*d; c.style.width=S+'px'; c.style.height=S+'px';
  var x=c.getContext('2d'); x.setTransform(d,0,0,d,0,0); x.imageSmoothingEnabled=true;
  if(group==='cast'){
    /* Creation thumbnails share the doll's source and stand selection. A missing
       or failed native doll permits the exact look's approved still fallback. */
    var cm=AS.cast && AS.cast[name],dm=cm && cm.doll,sheet=dollSheetFor(name),native=!!(sheet && sheet.m===dm);
    if(sheet){
      var sm=sheet.m,row=dollStillRow(sheet),ss=S*0.98/sm.stand,sw=sm.cell*ss;
      x.drawImage(sheet.img,0,row*sm.cell,sm.cell,sm.cell,(S-sw)/2,S-(sm.cell-(sm.foot||0))*ss+S*0.02,sw,sw);
    }
    el.innerHTML='';el.appendChild(c);
    var files=[],named=el.getAttribute && el.getAttribute('data-look');
    if(dm && !native)files.push('cast-'+name+'-doll.webp');
    if(cm && !sheet && dollCastFallback(name))files.push('cast-'+name+'.webp');
    var repaint=function(){paintArt(el,group,name,size);};
    watchStaticArt(el,files,repaint,function(){return !named || el.getAttribute('data-look')===name;},null,null,repaint);return;
  } else if(AS.map){
    el.innerHTML='';el.appendChild(c);watch();return;
  }
  el.innerHTML=''; el.appendChild(c);
}
function iconNameForBag(b){
  if(!b) return null;
  if(b.kind==='weapon'||b.kind==='armor'||b.kind==='off'||b.kind==='ring'||b.kind==='amulet') return b.data && b.data.icon;
  if(b.kind==='sigil') return sigilArtName(b.data.use);
  if(b.kind==='food') return FOODS[b.data.food].icon;
  return null;
}
function iconCanvas(name, size, fallbackText){
  var span=document.createElement('span'); span.className='gear';
  var o=name && (objArt('items',name)||anyObj(name));
  if(o){ paintArt(span,'items',name,size); }
  else{
    span.textContent=fallbackText||'?';
    if(name)watchStaticArt(span,function(){return packedObjectSources('items',name,true);},function(){paintArt(span,'items',name,size);},null,'art',true);
  }
  return span;
}
function itemIcon(name, size){ return iconCanvas(null, size, '\u2726'); }

/* ---------------------------------------------------------------- HUD */
(function buildHud(){
  var mid=$('mid'); if(mid && !$('hud2')){ var h=document.createElement('div'); h.id='hud2'; mid.insertBefore(h, $('hotbar')); }
  var tabs=$('tabs');
  if(tabs && !tabs.querySelector('[data-p="Faith"]')){
    var fb=document.createElement('button'); fb.setAttribute('data-p','Faith'); fb.textContent='Faith';
    tabs.insertBefore(fb, tabs.querySelector('[data-p="Sand"]'));
  }
  var body=document.querySelector('#shade .bodyw');
  if(body && !$('mFaith')){ var f=document.createElement('div'); f.id='mFaith'; f.className='msec'; body.insertBefore(f, $('mSand')); }
  var top=$('top');
  if(top && !$('topbtns')){
    var tb=document.createElement('div'); tb.id='topbtns';
    tb.innerHTML='<button id="bMute" title="Sound on/off (v)">Sound</button><button id="bMusic" title="Music on/off (n)">Music</button>';
    top.appendChild(tb);
  }
})();
SHEETS.Faith='Faith';
function hudResourceCard(kind){
  function number(n){return Math.round(n||0).toLocaleString('en-US');}
  function escape(s){return String(s).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});}
  function row(label,value){return '<div class="row"><span>'+label+'</span><b>'+value+'</b></div>';}
  if(kind==='character')return '<div class="nm">Character</div>'+row('Level',number(player.level))+(player.god?row(escape(GODS[player.god].name),'Rank '+godRank()):'')+(player.points>0?row('Unspent points',number(player.points)):'')+'<div class="hint">Open attributes and passives.</div>';
  if(kind==='points')return '<div class="nm">Attribute points</div>'+row('Unspent',number(player.points))+'<div class="hint">Open Character to spend them.</div>';
  if(kind==='inventory')return '<div class="nm">Inventory</div>'+row('Bag',(player.bag||[]).length+' / '+BAG_MAX)+'<div class="hint">Open equipment, items and motes.</div>';
  if(kind==='faith')return '<div class="nm">Faith</div>'+(player.god?row(escape(GODS[player.god].name),'Rank '+godRank()):'<div class="hint">No god followed.</div>')+'<div class="hint">Open divine abilities and offerings.</div>';
  if(kind==='menu')return '<div class="nm">Menu</div><div class="hint">Character, Inventory, Faith, Options and combat log.</div>';
  if(kind==='options')return '<div class="nm">Options</div><div class="hint">Controls, display and audio.</div>';
  if(kind==='history')return '<div class="nm">Combat log</div><div class="hint">Read the full log.</div>';
  if(kind==='history-close')return '<div class="nm">Close log</div><div class="hint">Return to the dungeon.</div>';
  if(kind==='sound')return '<div class="nm">Sound</div>'+row('Audio',AUDIO.muted?'Off':'On')+'<div class="hint">'+(AUDIO.muted?'Unmute':'Mute')+' game audio.</div>';
  if(kind==='map')return '<div class="nm">Map</div><div class="hint">'+(typeof AUTOMAP_ON!=='undefined'&&AUTOMAP_ON?'Hide the map overlay.':'Show the explored dungeon.')+'</div>';
  if(kind==='explore'){
    var exploring=typeof autoExploreActive==='function'&&autoExploreActive(),complete=typeof floorMeta!=='undefined'&&floorMeta&&floorMeta.exploreComplete;
    return '<div class="nm">'+(exploring?'Stop exploring':complete?'Next floor':'Explore')+'</div><div class="hint">'+(exploring?'Stop travelling.':complete?'Walk to the stairs and descend.':'Walk through unexplored areas.')+'</div>';
  }
  if(kind.indexOf('move:')===0)return '<div class="nm">Move '+escape(kind.slice(5))+'</div><div class="hint">Move one tile.</div>';
  if(kind==='search')return '<div class="nm">Wait and search</div><div class="hint">Spend a turn searching nearby.</div>';
  if(kind==='pickup')return '<div class="nm">Pick up</div><div class="hint">Collect items underfoot. Uses one turn.</div>';
  if(kind==='hp')return '<div class="nm">Health</div>'+row('HP',number(player.hp)+' / '+number(player.maxhp))+(playerShield()>0?row('Shield',number(playerShield()))+'<div class="hint">'+escape(shieldParts().join(', '))+'. Shields absorb damage before HP.</div>':'');
  if(kind==='mp')return '<div class="nm">Mana</div>'+row('Mana',number(Math.floor(player.mp))+' / '+number(player.maxmp));
  if(kind==='xp')return '<div class="nm">Experience</div>'+row('Level',player.level)+row('XP',number(player.xp)+' / '+number(player.xpNext))+'<div class="hint">'+(player.level>=20?'Maximum level reached. Further XP still counts toward your run total.':number(Math.max(0,player.xpNext-player.xp))+' XP to the next level.')+'</div>';
  if(kind==='stock')return '<div class="nm">Essence &amp; keys</div>'+row('Essence',number(player.essence))+row('Iron keys',number(player.keys&&player.keys.iron))+row('Crystal keys',number(player.keys&&player.keys.crystal))+'<div class="hint">Essence pays for crafting, upgrades and enchantments at a forge. Keys open locked doors on the floor where you find them.</div>';
  if(kind==='motes')return '<div class="nm">Elemental motes</div>'+['fire','water','earth','air','light','shadow'].map(function(k){return row(cap(k),number(player.motes[k]));}).join('')+'<div class="hint">Infuse carried motes when claiming a boss core or at a forge. Open Gear to see your pouch.</div>';
  if(kind==='amusement'){
    var mood=Math.max(0,Math.min(100,player.amusement||0));
    return '<div class="nm">Amusement '+number(mood)+'%</div>'+actionDetailsHTML(wobblesPassiveDetails());
  }
  if(kind==='hunger'){
    var state=player.hunger<=0?'Starving':player.hunger<300?'Hungry':'Full';
    return '<div class="nm">Hunger: '+state+'</div><div class="row"><span>Hunger</span><b>'+number(player.hunger)+' / '+number(HUNGER_MAX)+'</b></div><div class="hint">Eat food from your bag to restore hunger.</div>';
  }
  if(!player.god)return '<div class="nm">No god followed</div>';
  var god=GODS[player.god],rank=godRank(),next=PIETY_RANKS[rank];
  if(kind==='piety')return '<div class="nm">Piety</div><div class="hint">'+escape(god.name)+'</div><div class="row"><span>God rank</span><b>'+rank+' / 5</b></div><div class="row"><span>Piety</span><b>'+number(player.piety)+(next?' / '+number(next):'')+'</b></div><div class="hint">'+(next?number(Math.max(0,next-player.piety))+' more piety to reach rank '+(rank+1)+'.':'Maximum god rank reached.')+'</div>';
  return '<div class="nm">Favor</div><div class="row"><span>Favor</span><b>'+number(player.favor)+' / 100</b></div><div class="hint">Spent on divine abilities that cost Favor. It is earned alongside piety.</div>';
}
function bindHudResourceCard(element,kind){
  if(!element)return;
  function isNavigation(){return !!element.closest('#studyNav,#studySheetTabs');}
  element.removeAttribute('title');
  element.querySelectorAll('[title]').forEach(function(child){child.removeAttribute('title');});
  // Menu commands and sheet tabs already name their action. Shared controls
  // such as Map may move between the HUD and menu when the layout changes.
  if(isNavigation()){element.removeAttribute('aria-describedby');return;}
  setHudAttribute(element,'aria-describedby','dtip');
  if(element._hudResourceCard===kind)return;
  element._hudResourceCard=kind;if(element.tabIndex<0)element.tabIndex=0;
  hoverCard(element,function(){return isNavigation()?null:hudResourceCard(kind);});
  element.addEventListener('focus',function(){if(isNavigation()||document.body.classList.contains('touch'))return;var r=element.getBoundingClientRect();showCard(hudResourceCard(kind),{clientX:r.left,clientY:r.bottom,isTrusted:false});});
  element.addEventListener('blur',hideCard);
  element.addEventListener('click',hideCard);
}
function syncAudioButtons(){
  if($('bMute')) $('bMute').textContent = AUDIO.muted ? 'Sound: off' : 'Sound: on';
  if($('bMusic')) $('bMusic').textContent = AUDIO.musicOn ? 'Music: on' : 'Music: off';
  if(typeof FoteResponsiveHUD!=='undefined')FoteResponsiveHUD.syncAudioButton();
}
if($('bMute')) $('bMute').onclick=function(){ audioInit(); toggleMute(); syncAudioButtons(); };
if($('bMusic')) $('bMusic').onclick=function(){ audioInit(); toggleMusic(); syncAudioButtons(); };
syncAudioButtons();

/* HUD values update often; avoid replacing text nodes or invalidating layout
   when the displayed value has not changed. These helpers own no game state. */
function setHudText(el,value){if(el&&el.textContent!==String(value))el.textContent=String(value);}
function setHudAttribute(el,name,value){if(el&&el.getAttribute(name)!==String(value))el.setAttribute(name,String(value));}
function setHudStyle(el,name,value){if(el&&el.style.getPropertyValue(name)!==String(value))el.style.setProperty(name,String(value));}
function setHudClass(el,name,on){if(el&&el.classList.contains(name)!==!!on)el.classList.toggle(name,!!on);}
function activeBossEncounter(){
  if(!player || player.hp<=0 || (RUN && (RUN.over||RUN.victory)))return null;
  return ents.filter(function(e){return e.hp>0 && e.base && e.base.boss && e.state!=='throne';})[0]||null;
}
function bossBar(){
  var b=activeBossEncounter();
  var el=$('bossbar');
  if(!b){ if(el) el.style.display='none'; return; }
  if(!el){ el=document.createElement('div'); el.id='bossbar'; el.className='bossbar'; $('map').appendChild(el); }
  el.style.display='block';
  var warning=b.windup&&(b.windup.unmaker?{cleave:'GREAT CLEAVE',rupture:'RUPTURE',beam:'PRISM LANCE',ring:'INVERSION PULSE',pulse:'DISCORD PULSE '+b.windup.beat+'/2'}[b.windup.kind]:{slam:'GROUND SLAM in '+b.windup.due,ring:'SHOCKWAVE in '+b.windup.due,charge:'CHARGE!'}[b.windup.kind]);
  var intent = b.dazed>0 ? ' &middot; <span style="color:#E8D27A">DAZED</span>' : warning ? ' &middot; <span style="color:#FF7A5A">'+warning+'</span>' : '';
  if(!el.querySelector('.bb'))el.innerHTML='<span class="boss-label"></span><div class="bb"><i></i></div>';
  var label=b.name+intent;if(el._bossLabel!==label){el.querySelector('.boss-label').innerHTML=label;el._bossLabel=label;}
  setHudStyle(el.querySelector('.bb i'),'width',Math.max(0,Math.round(b.hp/b.maxhp*100))+'%');
}
function bars(){
  bossBar();
  setHudText($('hFloor'),floorNo);setHudText($('hBiome'),floorMeta && floorMeta.plane ? (PLANE_THEMES[floorMeta.plane]||{}).name : biomeName());setHudText($('hTurn'),turn);
  var shield=playerShield(), hpPct=clamp(player.hp/player.maxhp,0,1)*100, shPct=Math.min(100-hpPct, shield/player.maxhp*100);
  if(hpPct+shield/player.maxhp*100>100){ hpPct=Math.max(0, 100*player.hp/(player.hp+shield)); shPct=100-hpPct; }
  setHudStyle($('hpFill'),'width',hpPct+'%');
  var sf=$('shFill'); if(sf){setHudStyle(sf,'left',hpPct+'%');setHudStyle(sf,'width',(shield>0?shPct:0)+'%');}
  setHudText($('hpTxt'),Math.max(0,Math.round(player.hp))+'/'+player.maxhp+(shield>0?' +'+Math.round(shield):''));
  setHudAttribute($('hpTxt'),'title',shield>0 ? 'Shield '+Math.round(shield)+': absorbs damage before your HP ('+shieldParts().join(', ')+')' : '');
  setHudStyle($('mpFill'),'width',(clamp(player.mp/player.maxmp,0,1)*100)+'%');
  setHudText($('mpTxt'),Math.floor(player.mp)+'/'+player.maxmp);
  setHudStyle($('xpFill'),'width',(clamp(player.xp/player.xpNext,0,1)*100)+'%');
  /* 2026-09-28 (Justin): the bar shows only the level; '777/1500' crushed it onto two rows on small screens. The
     fill still shows progress, and the exact numbers are on hover. */
  if(!$('xpBar')._hudResourceCard)setHudAttribute($('xpBar'),'title',player.xp+' / '+player.xpNext+' XP');
  if(!document.body.classList.contains('study-classic'))setHudText($('lvTxt'),'LV '+player.level);
  var tags=[];
  var labels={burn:'burning',chill:'chilled',frozen:'frozen',root:'rooted',stun:'stunned',fear:'afraid',blind:'blind',poison:'poisoned',stone:'stone skin',wet:'wet',aura:'unholy aura',corrupt:'corrupt'};
  for(var k in player.st){ if(k.indexOf('imm_')===0) continue; tags.push('<span class="tag t-'+k+'">'+(labels[k]||k)+' '+player.st[k].t+'</span>'); }
  for(var b in player.buffs){ if(player.buffs[b]>0) tags.push('<span class="tag t-hidden">'+b+' '+player.buffs[b]+'</span>'); }
  if(player.hidden>0) tags.push('<span class="tag t-hidden">hidden '+player.hidden+'</span>');
  if(player.levitate>0) tags.push('<span class="tag t-chill">floating '+player.levitate+'</span>');
  var fx=$('fx'),tagHTML=tags.join('');if(fx._hudTags!==tagHTML){fx.innerHTML=tagHTML;fx._hudTags=tagHTML;}
  if(typeof FoteResponsiveHUD!=='undefined'&&FoteResponsiveHUD.isMounted()){FoteResponsiveHUD.renderReadouts();return;}
  var hud=$('hud2'); if(!hud) return;
  var hp=player.hunger/HUNGER_MAX, hl = player.hunger<=0 ? 'Starving' : player.hunger<300 ? 'Hungry' : 'Full';
  var h='<span class="chip" title="Hunger">'+hl+' <span class="hunger"><i style="width:'+Math.round(hp*100)+'%"></i></span></span>';
  if(player.stillness>0) h+='<span class="chip" style="color:#9FD8FF" title="Time is frozen: moving is free">\u23F8 stillness '+player.stillness+'</span>';
  if(player.keys && (player.keys.iron||player.keys.crystal)) h+='<span class="chip" id="keychip">\u{1F5DD} '+((player.keys.iron||0)+(player.keys.crystal||0))+'</span>';
  h+='<span class="chip" title="Essence">\u25C6 '+player.essence+'</span>';
  var mc=Object.keys(player.motes).filter(function(m){ return player.motes[m]>0; });
  if(mc.length) h+='<span class="chip" title="Motes">'+mc.map(function(m){ return '<span class="dot" style="background:'+AFF_COL[m]+';width:8px;height:8px"></span>'+player.motes[m]; }).join(' ')+'</span>';
  if(player.god) h+=faithChipHTML();
  hud.innerHTML=h;
}

/* ---------------------------------------------------------------- ring and amulet slots on the doll */
function trinketSlots(){
  if(typeof RINGS==='undefined') return eslot('Amulet', null, '')+eslot('Rings', null, '');
  var r=player.rings||[null,null], a=player.amulet;
  function one(label, it, key, sub){
    return '<div class="eslot" data-tr="'+key+'"><span class="l">'+label+'</span>'+(it?'<span class="v"'+(it.cursed&&!it.unid?' style="color:#D0605A"':'')+'>'+gearName(it)+'</span>':'<span class="v none">empty</span>')+
      '<span class="l" style="text-transform:none;letter-spacing:.02em;color:var(--ash)">'+sub+'</span></div>';
  }
  if(a && typeof amuletSync==='function') amuletSync(a);
  var aSub = a ? (a.charges!==undefined ? a.charges+'/'+amuletCap(a)+' charges'+(a.charges<amuletCap(a)?' &middot; next in '+(a.unid?'?':amuletKillsNeeded(a)-(a.progress||0))+' kills':'') : '') : 'activated; kills build charges';
  return one('Amulet', a, 'amulet', aSub)+
    one('Ring', r[0], 'ring0', r[0] ? (r[0].unid ? 'strength unknown' : ringLine(r[0])) : 'passive')+
    one('Ring', r[1], 'ring1', r[1] ? (r[1].unid ? 'strength unknown' : ringLine(r[1])) : 'passive');
}

/* shield points on top of HP: Water's ice armor plus any active ward (Arcane Ward, Amulet of Thorns) */

/* 2026-09-22 (Justin): the HP bar's shield tooltip named ice armor whatever the source; a Fighter's is Guard */


/* ---------------------------------------------------------------- faith in the HUD */
function faithChipHTML(){
  var g=GODS[player.god], r=godRank();
  var h='<span class="chip faithchip" title="'+g.name+': open with P" style="color:'+g.color+'" onclick="showSheet(\'Faith\')">'+
        '<span class="gdot"></span>';   /* 2026-09-22 (Justin): no name on the chip - it is the hover title, and the row needs the room */
  if(g.chaos){
    var am=Math.round(player.amusement||0), favor=Math.round(player.favor||0);
    var nx=PIETY_RANKS[r]||null, pv=PIETY_RANKS[r-1]||0, pp=nx ? clamp(((player.piety||0)-pv)/(nx-pv),0,1) : 1;
    return h+'<span class="rk">R'+r+'</span>'+
      '<span class="meter" title="Piety '+Math.round(player.piety||0)+(nx?' / '+nx+' for rank '+(r+1):' (max rank)')+'"><i style="width:'+Math.round(pp*100)+'%;background:linear-gradient(90deg,'+hexA(g.color,0.55)+','+g.color+')"></i></span>'+
      '<span class="rk" title="Amusement">☺ '+am+'</span>'+
      '<span class="meter sm" title="Amusement '+am+' / 100"><i style="width:'+am+'%;background:linear-gradient(90deg,#8A4FB0,'+g.color+')"></i></span>'+
      '<span class="rk" title="Favor, spent on your god\'s abilities">\u2726 '+favor+'</span>'+
      '<span class="meter sm" title="Favor '+favor+' / 100"><i style="width:'+favor+'%;background:linear-gradient(90deg,#6B5A22,#E8D27A)"></i></span></span>';
  }
  var next=PIETY_RANKS[r]||null, prev=PIETY_RANKS[r-1]||0, pct=next ? clamp(((player.piety||0)-prev)/(next-prev),0,1) : 1, fav=Math.round(player.favor||0);
  return h+'<span class="rk">R'+r+'</span>'+
    '<span class="meter" title="Piety '+Math.round(player.piety||0)+(next?' / '+next+' for rank '+(r+1):' (max rank)')+'"><i style="width:'+Math.round(pct*100)+'%;background:linear-gradient(90deg,'+hexA(g.color,0.55)+','+g.color+')"></i></span>'+
    '<span class="rk" title="Favor, spent on your god\'s abilities">\u2726 '+fav+'</span>'+
    '<span class="meter sm" title="Favor '+fav+' / 100"><i style="width:'+fav+'%;background:linear-gradient(90deg,#6B5A22,#E8D27A)"></i></span></span>';
}
var PRAYER_ICONS={
  "ironhide": "pr-ironhide",
  "pummel": "pr-pummel",
  "rampage": "pr-rampage",
  "trollblood": "pr-trollblood",
  "consecrate": "pr-consecrate",
  "sanctuary": "pr-sanctuary",
  "laststand": "pr-laststand",
  "rally": "pr-rally",
  "rolldice2": "pr-rolldice2",
  "raisedead": "pr-raisedead",
  "the-brood": "pr-the-brood",
  "venom-burst": "pr-venom-burst",
  "fieldsmelt": "pr-offering",
  "anviltoll": "pr-reforge",
  "lance": "pr-lance",
  "bonespear": "pr-bonespear",
  "manaward": "ic-arcane-ward",
  "luckystreak": "pr-luckystreak",
  "arcaneblink": "pr-arcaneblink"
};
function prayerIcon(pid){pid=prayerId(pid);return PRAYER_ICONS[pid]||'pr-'+pid;}
function prayerCost(pid){ var P=PRAYERS[prayerId(pid)]; return P.health ? prayerHealthCost(pid)+' HP' : P.favor ? P.favor+' Favor' : P.essence ? P.essence+' essence' : P.amusement ? P.amusement+' Amusement' : 'prayer'; }

/* every ability or prayer you gain drops into the first empty hotbar slot once; clearing a slot keeps it cleared */


/* ---------------------------------------------------------------- hotbar with icons */
function renderHotbarSlots(){
  syncHotbar();
  var bar=$('hotbar');if(!bar)return;
  var layout=[HOTBAR_ICON_REVISION,innerWidth,innerHeight,window.devicePixelRatio||1,document.body.className,document.body.dataset.uiText||''].join('|');
  for(var i=0;i<8;i++){
    var s=player.hotbar[i],b=bar.children[i],tag=s?'BUTTON':'DIV';
    if(!b||b.tagName!==tag){
      var replacement=document.createElement(tag.toLowerCase());replacement.className='slot';replacement.setAttribute('data-i',i);
      replacement.innerHTML=(s?'<span class="ico"></span>':'')+'<span class="k">'+(i+1)+'</span><span class="n"></span>'+(s?'<span class="c"></span>':'');
      if(b)b.replaceWith(replacement);else bar.appendChild(replacement);b=replacement;
      (function(button,index){
        button.onclick=function(){sfx('ui-click');pressSlotIndex(index);};
        button._hotbarContext=function(ev){ev.preventDefault();var slot=player.hotbar[index];if(slot&&slot.type!=='ability'&&slot.type!=='prayer'){player.hotbar[index]=null;abilityBar();}};
        button.oncontextmenu=button._hotbarContext;
        if(s)dragSource(button,'hot:'+index);
        dropTarget(button,function(tag){hotbarDrop(index,tag);});
      })(b,i);
    }
    var name='empty',line='',icon='',group='icons',disabled=false,armed=false;
    if(s){
      if(s.type==='ability'){
        var A=ABILITIES[s.key];name=A.name;icon=A.icon||'';
        disabled=A.favor?(player.favor||0)<A.favor:player.mp<costOf(A);
        armed=!!(aiming&&player.abilities[aiming.i]===s.key);
        line=A.favor?A.favor+' Favor':costOf(A)+' mana';
      }else if(s.type==='prayer'){
        name=PRAYERS[s.key].name;icon=prayerIcon(s.key);disabled=!canPray(s.key);line=prayerCost(s.key);
        var color=GODS[player.god]?GODS[player.god].color:'#8A6FB0';setHudStyle(b,'--gc',color);
      }else if(s.type==='amulet'){
        var a=player.amulet;name=a?gearName(a):'Amulet';icon=a&&a.icon||'';group='items';
        disabled=!a||(a.charges||0)<=0;armed=!!(aiming&&aiming.amulet);
      }else if(s.type==='ranged'){
        var rw=player.ranged;name=rw?(typeof gearName==='function'?gearName(rw):rw.name):'no bow';icon=rw&&rw.icon||'';line='shoot';disabled=!rw;
      }else{
        var it=s.ref;name=it.name+(it.n>1?' ×'+it.n:'');icon=iconNameForBag(it);line=it.kind;
      }
    }
    setHudClass(b,'empty',!s);setHudClass(b,'hasico',!!s);setHudClass(b,'prayer-slot',!!s&&s.type==='prayer');setHudClass(b,'armed',armed);
    if(s&&b.disabled!==disabled)b.disabled=disabled;
    if(!s||s.type!=='prayer')b.style.removeProperty('--gc');
    setHudText(b.querySelector('.n'),name);b._hotbarBaseLine=line;
    if(!s||!['ability','prayer','amulet'].includes(s.type))setHudText(b.querySelector('.c'),line);
    var ico=b.querySelector('.ico'),iconKey=[group,icon,layout].join('|');
    if(ico&&b._hotbarIconKey!==iconKey){
      var identity=group+'|'+icon;if(b._hotbarArtIdentity!==identity){b.style.removeProperty('--c');b._hotbarArtIdentity=identity;}
      b._hotbarIconKey=iconKey;
      if(icon)paintArt(ico,group,icon,28);
      else{cancelStaticArtPaint(ico);cancelStaticArtPaint(ico,'chip');ico.replaceChildren();b.style.removeProperty('--c');b.style.removeProperty('--icon-exposure');b.removeAttribute('data-icon-family');}
    }
  }
  while(bar.children.length>8)bar.lastElementChild.remove();
}

function hotbarDrop(idx, tag){
  var bi=bagIndexFromTag(tag);
  if(bi>=0 && player.bag[bi]) hotbarPut(idx, {type:'item', ref:player.bag[bi]});
  else if(tag==='ranged') hotbarPut(idx, {type:'ranged'});
  else if(tag==='amulet') hotbarPut(idx, {type:'amulet'});
  else if(tag.indexOf('abil:')===0) hotbarPut(idx, {type:'ability', key:tag.slice(5)});
  else if(tag.indexOf('pray:')===0) hotbarPut(idx, {type:'prayer', key:tag.slice(5)});
  else if(tag.indexOf('hot:')===0){ var from=+tag.slice(4); if(from!==idx){ var t=player.hotbar[idx]; player.hotbar[idx]=player.hotbar[from]; player.hotbar[from]=t; abilityBar(); } }
}

/* ---------------------------------------------------------------- sheets */
function showSheet(name){
  openSheet = (openSheet===name) ? null : name;
  var buttons=document.querySelectorAll('#tabs button');
  for(var i=0;i<buttons.length;i++) buttons[i].classList.toggle('on', buttons[i].getAttribute('data-p')===openSheet);
  $('shade').classList.toggle('on', !!openSheet);
  sfx(openSheet?'ui-open':'ui-close');
  if(openSheet){
    $('sheetTitle').textContent=SHEETS[openSheet];
    ['Char','Equip','Faith','Sand','Help'].forEach(function(n){ var e=$('m'+n); if(e) e.classList.toggle('on', n===openSheet); });
    refreshSheet();
    var body=$('shade').querySelector('.bodyw');if(body)body.scrollTop=0;
  }
  if(typeof FoteResponsiveHUD!=='undefined')FoteResponsiveHUD.syncSheet();
}
function refreshSheet(){
  if(!openSheet) return;
  panes();
  var pl=document.querySelectorAll('.plus');
  for(var i=0;i<pl.length;i++) pl[i].onclick=(function(b){ return function(ev){ ev.stopPropagation(); spendPoint(b.getAttribute('data-s')); }; })(pl[i]);
}
function spendPoint(key){
  if(player.points<=0) return;
  if(player.stats[key]>=25){ log('That attribute is at its maximum.','c-info'); return; }
  player.stats[key]++; player.points--;
  var fresh=recomputePassives();
  derive(player);
  log('You train '+{mig:'Might',agi:'Agility',vit:'Vitality',foc:'Focus'}[key]+'.','c-good'); sfx('stat-point');
  fresh.forEach(function(id){ for(var k in PASSIVES) PASSIVES[k].forEach(function(p){ if(p.id===id){ log('<b>New passive: '+p.name+'</b> ('+p.d+')','c-kill'); sfx('new-ability'); } }); });
  updateUI(); refreshSheet();
}


/* ---------------------------------------------------------------- inspect */
var TILE_NAMES = {0:'Wall',1:'Floor',2:'Closed door',3:'Stairs down',4:'Chest',5:'Elemental Forge',6:'Rubble',7:'Open door',8:'Chasm',9:'Locked iron door',
  10:'Shrine',11:'Ice-sealed door',12:'Thorn-choked doorway',13:'The gate onward',14:'Spiked door',15:'Wall',16:'Shallow water',17:'Bridge',18:'Sealed door',
  19:'Stairs up',20:'Portal'};
var TILE_HINTS = {5:'Bump it to fuse motes, craft sigils or enchant and upgrade gear.',9:'Needs this floor\'s iron key.',10:'Bump it to learn about the god, swear to them or pray.',11:'Fire melts it. Blows crack it slowly.',
  12:'Fire clears it; pushing through hurts.',14:'Costs half your current HP to pass. Real treasure behind.',16:'Slows you. Puts out fire. Lightning hurts more here.',
  8:'A sheer drop. Float across or find a bridge.',18:'Something on this floor opens it. Bump it for a clue.',3:'Leads down to the next floor.',13:'Opens when the floor boss falls.',
  19:'Leads back up to the floor above.',20:'A doorway between worlds. Step in to cross over.'};
function inspectHTML(mx,my){
  if(!inb(mx,my) || !(revealAll||seen[idxOf(mx,my)])) return '';
  if(playerBlind()&&!vis[idxOf(mx,my)])return '';
  var e=ents.find(function(o){return entityOccupies(o,mx,my)&&o!==player&&!actorConcealed(o);});
  if(e && e.parent) e=e.parent;   /* a big elite's other cells report the creature itself, not its proxy */
  if(e && (revealAll||vis[idxOf(mx,my)])){
    var tinyHint=e.base&&e.base.tiny?'<div class="hint">Tiny: does not block ranged targeting.</div>':'';
    if(e.merchantRoom!==undefined)return '<div class="nm">'+e.name+'</div><div class="hint">A traveling Myconid trader. Offers rare sigils, elemental motes and Masterwork equipment for essence.</div><div class="hint">Click or approach to browse the stock.</div>';
    if(e.hungrySpiderRoom!==undefined&&!e.foe&&!e.ally)return '<div class="nm">'+e.name+'</div><div class="hint">Hungry... everything dead.</div><div class="hint">It watches you without attacking.</div>';
    if(e.ally) return '<div class="nm">'+e.name+'</div><div class="row"><span>HP</span><b>'+Math.max(0,Math.round(e.hp))+' / '+Math.round(e.maxhp)+'</b></div><div class="hint enemy-lore">'+enemyLore(e)+'</div>'+tinyHint+'<div class="hint">Fights for you.</div>'+(e.shade&&shadeAbilityHint(e)?'<div class="hint">'+shadeAbilityHint(e)+'</div>':'');
    var ch=Math.round(hitChance(player.acc,evaOf(e))*100), back=Math.round(hitChance(accOf(e),evaOf(player))*100);
    var lo=Math.max(1,Math.round(player.dmg[0]-Math.min(armorOf(e),player.dmg[0]*0.5))), hi=Math.max(1,Math.round(player.dmg[1]-Math.min(armorOf(e),player.dmg[1]*0.5)));
    var st=Object.keys(e.st).filter(function(k){ return k.indexOf('imm_')!==0; }).map(function(k){ return '<span class="tag t-'+k+'">'+k+'</span>'; }).join(' ');
    var physicalHint=typeof FoteGreenSlime!=='undefined'&&FoteGreenSlime.traitsHint(e)||e.base.hint;
    return '<div class="nm">'+e.name+'</div>'+
      '<div class="hint enemy-lore">'+enemyLore(e)+'</div>'+
      tinyHint+
      '<div class="row"><span>HP</span><b>'+Math.max(0,Math.round(e.hp))+' / '+Math.round(e.maxhp)+'</b></div>'+
      '<div class="row"><span>Armor &middot; Evasion</span><b>'+armorOf(e)+' &middot; '+evaOf(e)+'</b></div>'+
      (e.base.el?'<div class="row"><span>Element</span><b style="color:'+AFF_COL[e.base.el]+'">'+cap(e.base.el)+'</b></div>':'')+
      '<div class="row"><span>State</span><b>'+(e.st.stun?'stunned':e.st.frozen?'frozen':e.state==='throne'?'on his throne':({hunt:'hunting',wander:'wandering'}[e.state]||e.state))+'</b></div>'+
      (e.keyholder?'<div class="row"><span>Carries</span><b>an iron key</b></div>':'')+
      (st?'<div style="margin-top:4px">'+st+'</div>':'')+
      (physicalHint?'<div class="hint">'+physicalHint+'</div>':'')+
      '<div class="odds">You hit <em>'+ch+'%</em> for '+lo+'-'+hi+'. It hits you <em>'+back+'%</em>.</div>';
  }
  var it=items.filter(function(i){ return i.x===mx && i.y===my; })[0];
  if(it){
    if(it.crystal){
      var type={weapon:'Weapon',armor:'Armor',off:'Off-hand equipment',ring:'Ring',amulet:'Amulet',sigil:'Sigil',essence:'Essence',mote:'Elemental mote',food:'Food',key:'Key'}[it.kind]||'Treasure';
      return '<div class="nm">'+type+'</div><div class="hint">Choose one treasure; the others shatter.</div>';
    }
    if(it.kind==='weapon') return weaponCard(it.it);
    if(it.kind==='armor') return armorCard(it.it);
    if(it.kind==='off') return bagCard({kind:'off',data:it.it});
    /* 1.3.2 ruling 4 (Justin 2026-09-28): a mote says what it is for; a player who dies before floor 3 never met a Forge */
    return '<div class="nm">'+cap(itemLabel(it))+'</div><div class="hint">'+(it.kind==='sigil'&&!sigilKnown[it.use]?'Unidentified sigil.':it.kind==='mote'?'Infuse it after picking up a boss core, or at an Elemental Forge, for permanent affinity. Forges on the third or fourth floor of each biome also enchant gear and craft sigils.':'')+'</div>';
  }
  var p=propAt(mx,my);
  var restorationForge=typeof FoteUnmakerEncounter!=='undefined'&&FoteUnmakerEncounter.forgeInfo(mx,my);
  if(restorationForge)return '<div class="nm">'+restorationForge.name+'</div><div class="hint">'+restorationForge.hint+'</div>';
  if(p){
    if(p.cleansingShrine)return '<div class="nm">Cleansing Shrine</div><div class="hint">'+(p.used?'Its blessing is spent.':'Interact to remove every curse from carried and equipped items.')+'</div>';
    if(p.offeringBowl)return '<div class="nm">Offering bowl</div><div class="hint">Interact to read the inscription. Stand beside the bowl and drop five pieces of gear or sigils at its feet to receive a scroll.</div>';
    if(p.previewPortal&&typeof FoteChaosPreview!=='undefined'){
      var gateway=FoteChaosPreview.atPortal(mx,my);
      if(gateway)return '<div class="nm">'+gateway.label+'</div><div class="hint">A two-way portal to another island on this floor. Step onto it to travel.</div>';
    }
    if(p.eventRoom!==undefined){
      var eventRoom=rooms.find(function(r){return r.id===p.eventRoom;}),event=eventRoom&&eventRoom.uncommonEvent;
      if(event)return '<div class="nm">'+({'portcullis-cache':'Portcullis lever','funeral-bell':'Crypt funeral bell','crystal-resonance':'Resonating crystal','silk-survivor':'Silk-wrapped survivor'})[event.kind]+'</div><div class="hint">'+(event.used?'Its work is done.':({'portcullis-cache':'Pull to open the guarded equipment cache.','funeral-bell':'Ring for an offering. Acolytes will answer.','crystal-resonance':'Touch to restore Mana and release an elemental mote. The sound attracts nearby enemies.','silk-survivor':'Free the traveler for two special foods and a mapping sigil. Escort him to the upstairs for a ring or amulet. Beware the surrounding webs.'})[event.kind])+'</div>';
    }
    var lever=leverDetails(p);
    if(lever){
      var action=document.body.classList.contains('touch')?'Tap':'Click';
      return '<div class="nm">'+lever.name+'</div><div class="row"><span>State</span><b>'+
        (lever.used?'Already pulled':'Ready to pull')+'</b></div><div class="hint">'+
        (lever.used?lever.result:action+' or bump this lever to '+lever.effect+'.')+'</div>';
    }
    if(p.sentry||p.sentinel||p.guardianStatue){
      var guardianRoom=puzzleRoomAt(p.x,p.y),quiet=guardianRoom&&guardianRoom.puzzle.solved;
      var sentry=p.sentry||guardianRoom&&guardianRoom.puzzle.kind==='sentries';
      return '<div class="nm">'+(sentry?'Stone Sentry':'Stone Sentinel')+'</div><div class="hint">'+(quiet?'Dormant guardian.':sentry?'Fires at visible targets. Pillars block its bolts; concealment, Shadow mastery or the lever lets you pass.':'Awakens on entry. Stoneskin or Earth mastery lets you pass; the lever disables it.')+'</div>';
    }
    var pn=({'urn-group':'urns','stack-group':p.kinds && p.kinds.indexOf('pot')>=0 && p.kinds.indexOf('crate')<0 ? 'pots' : 'crates and barrels','urn-shattered':'broken urn','urn-tall':'urn','urn-squat':'urn','urn-ornate':'urn','barrel-explosive':'powder barrel','altar-spikes':'sacrifice altar','drow-altar-blood':'sacrifice altar'})[p.name] || p.name.replace(/-/g,' ');
    var hint = p.breakReward ? 'A blade is embedded in the moss-covered stone.' : p.merchantId!==undefined ? 'Browse the merchant stock. Purchases cost essence.' : p.ritual&&p.prisoner ? 'Captive: '+p.captiveHp+'/'+p.captiveMaxhp+' HP. The ritual drains 2 HP per round. Free them or interrupt the priestess.' : p.ex ? 'Explodes when broken or burned.' : p.br ? 'Breakable. Might hold something.' : p.tablet ? 'A broken tablet. Read it.' :
      p.altar ? 'Offer blood for rewards.' : p.prisoner ? 'Someone is locked inside. Let them out and hope they are grateful.' : p.name==='elemental-lock' ? 'Wants one '+p.element+' mote.' : p.drink ? 'Drink from it.' :
      p.bush ? 'Cut it down. Sometimes a heart is tucked underneath.' : '';
    /* 2026-09-19: Justin - scenery you cannot do anything with gets no card at all */
    if(!hint) return '';
    return '<div class="nm">'+cap(pn)+'</div><div class="hint">'+hint+'</div>';
  }
  var tr=feats.filter(function(f){ return f.x===mx && f.y===my && (f.found||revealAll); })[0];
  if(tr) return '<div class="nm">'+trapName(tr.kind)+' trap</div><div class="hint">Walk around it.</div>';
  var poisonTrail=typeof FoteGreenSlime!=='undefined'&&FoteGreenSlime.trailAt(mx,my);
  if(poisonTrail)return '<div class="nm">'+poisonTrail.name+'</div><div class="hint">'+poisonTrail.damage+' poison damage per turn. '+poisonTrail.turns+' turns left.'+
    (poisonTrail.side==='ally'?' Harms foes only.':poisonTrail.side==='foe'?' Harms you and your allies.':'')+' Levitation avoids it.</div>';
  var t=at(mx,my);
  /* Map cards belong to things you can inspect or use, not terrain. */
  if([2,3,4,5,7,9,10,11,12,13,14,18,19,20].indexOf(t)<0) return '';
  var label=TILE_NAMES[t]||'Floor';
  if(t===CHEST&&chestKind[idxOf(mx,my)]==='chest-gold')label='Gold chest';
  if(t===SHRINE) label='Shrine to '+GODS[RUN.shrineGod].name;
  if(typeof PORTAL!=='undefined' && t===PORTAL && floorMeta.portal && typeof PLANE_TITLE!=='undefined') label='Portal to '+PLANE_TITLE[floorMeta.portal];
  var tileHint=t===EXIT ? (floorMeta.exitOpen ? 'Open. Step through to go on.' : 'Sealed. Bring '+bossNameForFloor().replace(/^The /,'the ')+'\'s '+coreName()+' here to open it.') : TILE_HINTS[t];
  if(t===CHEST&&enhancedChestAt(mx,my)){label='Enhanced gold chest';tileHint='Contains two equipment items, each raised one quality tier, up to the highest tier.';}
  if(t===CHEST){var vault=roomAt(mx,my);if(vault&&vault.greedyVault)tileHint='One of two gold chests. The floor around their platforms looks unstable.';}
  var chaosCurrent=typeof FoteChaosCampaign!=='undefined'&&FoteChaosCampaign.currentInfo(mx,my);
  if(chaosCurrent){label=chaosCurrent.label;tileHint=chaosCurrent.hint;}
  var crucibleGate=typeof FoteUnmakerPreview!=='undefined'&&FoteUnmakerPreview.gateInfo(mx,my);
  if(crucibleGate){label=crucibleGate.name;tileHint=crucibleGate.hint;}
  if(t===PORTAL&&typeof FoteChaosPreview!=='undefined'&&FoteChaosPreview.active()){
    var linked=FoteChaosPreview.atPortal(mx,my);if(linked){label=linked.label;tileHint='A two-way portal to another island on this floor. Step onto it to travel.';}
  }
  var chaosEntryPortal=typeof FoteChaosEntryPreview!=='undefined'&&FoteChaosEntryPreview.portalInfo(mx,my);
  if(chaosEntryPortal){label=chaosEntryPortal.name;tileHint=chaosEntryPortal.hint;}
  var materialPortal=typeof FoteChaosCampaign!=='undefined'&&FoteChaosCampaign.materialPortalInfo(mx,my);
  if(materialPortal){label=materialPortal.name;tileHint=materialPortal.hint;}
  var puzzleDoor=t===SEALED&&puzzleAtDoor(mx,my);
  if(puzzleDoor&&puzzleDoor.puzzle.kind==='barricade'&&!puzzleDoor.puzzle.solved){label='Wooden barricade';tileHint='A wooden barricade. It looks flammable.';}
  return '<div class="nm">'+label+'</div>'+
    (tileHint?'<div class="hint">'+tileHint+'</div>':'')+
    '<div class="row"><span>'+(vis[idxOf(mx,my)]?'In sight':'From memory')+'</span><b>'+mx+','+my+'</b></div>';
}

/* ---------------------------------------------------------------- keys */
window.addEventListener('keydown', function(ev){
  if(typeof FoteResponsiveHUD!=='undefined'&&FoteResponsiveHUD.hasOverlay())return;
  var tgt=ev.target.tagName;
  var editing=tgt==='INPUT'||tgt==='SELECT'||tgt==='TEXTAREA'||(tgt==='BUTTON'&&ev.target.closest('[data-seg]'));
  if($('create') && $('create').classList.contains('on')) { if(!editing)ev.stopImmediatePropagation(); return; }
  if(modalOpen){
    if(ev.key==='Escape'){closeModal();ev.preventDefault();}
    else if(ev.key==='Tab'){
      var modal=$('modal'),focusable=Array.from(modal.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')).filter(function(el){return !el.disabled&&el.tabIndex>=0&&el.getClientRects().length;});
      var first=focusable[0],last=focusable[focusable.length-1],outside=!modal.contains(document.activeElement);
      if(ev.shiftKey&&(document.activeElement===first||outside)){if(last)last.focus();ev.preventDefault();}
      else if(!ev.shiftKey&&(document.activeElement===last||outside)){if(first)first.focus();ev.preventDefault();}
    }else if(!editing&&tgt!=='BUTTON'&&tgt!=='A'){
      if(ev.key==='Enter'){var pri=document.querySelector('#mFoot .primary');if(pri)pri.click();}
      ev.preventDefault();
    }
    ev.stopImmediatePropagation();return;
  }
  if(editing)return;
  if(RUN && (RUN.over || RUN.victory)){ ev.stopImmediatePropagation(); return; }
  var k=ev.key;
  if(k==='v'){ audioInit(); toggleMute(); syncAudioButtons(); ev.stopImmediatePropagation(); return; }
  if(k==='n'){ audioInit(); toggleMusic(); syncAudioButtons(); ev.stopImmediatePropagation(); return; }
  if(openSheet && k!=='Escape' && k!=='p' && k!=='i' && k!=='Tab') return;
  if(k==='p'){ showSheet('Faith'); ev.stopImmediatePropagation(); return; }
  if(k==='i'){ showSheet('Equip'); ev.stopImmediatePropagation(); return; }
  if(k==='Tab'){ ev.preventDefault(); showSheet('Char'); ev.stopImmediatePropagation(); return; }
  if(k==='r'){ rest(); ev.stopImmediatePropagation(); return; }
  if(k==='C'){ closeAdjacentDoors(); updateUI(); ev.stopImmediatePropagation(); return; }
  if(k==='>' || k==='.' && ev.shiftKey){ if(at(player.x,player.y)===STAIRS) descend(); else log('No stairs here.','c-info'); ev.stopImmediatePropagation(); return; }
}, true);
var REST_SEQUENCE=0;
function stopRest(){REST_SEQUENCE++;}
/* 2026-09-28 (Justin): resting ran on through an alarm, so you "arrived" to a bell that rang many turns in. Rest now
   also stops when a bell rings within earshot (12 spaces, the reach of the Beta 1.4 sound falloff) or a creature that
   close starts hunting. An alarm is a one-use trap: one that has rung is gone from feats. */
var REST_EARSHOT=12;
function restAlarms(){ return feats.filter(function(f){ return f.kind==='alarm' && Math.max(Math.abs(f.x-player.x),Math.abs(f.y-player.y))<=REST_EARSHOT; }); }
function restHunters(){ return ents.filter(function(e){ return e.foe && e.hp>0 && e.state==='hunt'; }); }
function rest(){
  if(ents.some(function(e){ return e.foe && actorVisible(e); })){ log('You cannot rest with enemies in sight.','c-info'); return; }
  var n=0,restRun=RUN,restPlayer=player,restId=++REST_SEQUENCE,alarms=restAlarms(),hunters=restHunters(); log('You rest...','c-info',{transient:false});
  (function step(){
    if(restId!==REST_SEQUENCE || RUN!==restRun || player!==restPlayer || uiOpen())return;
    if(turnSequenceBusy()){afterTurn(function(){setTimeout(step,0);});return;}
    if(n++>=150 || player.hp<=0) return;
    if(player.hp>=player.maxhp && player.mp>=player.maxmp){ log('Rested.','c-good',{transient:false}); return; }
    if(ents.some(function(e){ return e.foe && actorVisible(e); })){ log('Something approaches! You stop resting.','c-you'); return; }
    if(alarms.some(function(f){ return feats.indexOf(f)<0; })){ log('The alarm bell rouses you. You stop resting.','c-you'); return; }
    if(restHunters().some(function(e){ return hunters.indexOf(e)<0 && dist(e,player)<=REST_EARSHOT; })){ log('Something nearby is on the hunt. You stop resting.','c-you'); return; }
    hunters=restHunters();
    if(player.hunger<300 && n>1){ log('You are too hungry to rest well.','c-info'); return; }
    if(typeof searchAround==='function') searchAround(true, true); else endTurn();   /* resting searches at half chance */
    /* Schedule only the next rest action. A save flush finishes the current
       action without recursively simulating the entire rest before saving. */
    afterTurn(function(){setTimeout(step,0);});
  })();
}
