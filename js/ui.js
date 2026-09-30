/* ============================================================================
   ui.js - modals, sprite icons, hotbar, HUD, sheets (Character, Equipment,
   Faith), tooltips, extra keys. Overrides the matching game.js functions.
   ========================================================================== */

(function injectCSS(){
  var css = `
  #modal{position:fixed;inset:0;z-index:90;display:none;align-items:center;justify-content:center;background:rgba(6,5,4,.78);padding:16px}
  #modal.on{display:flex}
  #modal .mbox{width:min(620px,100%);max-height:min(88vh,760px);display:flex;flex-direction:column;background:linear-gradient(180deg,#221D1A,#171310);
    border:1px solid #4A3E34;border-radius:10px;box-shadow:0 24px 60px rgba(0,0,0,.7)}
  #modal .mbox.wide{width:min(880px,100%)}
  #modal header{padding:12px 16px;border-bottom:1px solid var(--edge);display:flex;align-items:center;justify-content:space-between}
  #modal header h2{font-family:var(--display);color:var(--gold);font-size:22px;margin:0}
  #modal .mbody{padding:14px 16px;overflow-y:auto;line-height:1.5;font-size:12.5px;color:var(--ink)}
  #modal .mbody p{margin:0 0 8px}
  #modal footer{padding:10px 16px;border-top:1px solid var(--edge);display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
  #modal footer button.primary, .btn-primary{background:linear-gradient(180deg,#8A4A1E,#5A2E12);border-color:#B8653A;color:#FFE9C8}
  #modal footer button:disabled, button:disabled{opacity:.38;cursor:default;border-color:var(--edge)!important;color:var(--dim)!important}
  .bossbar{position:absolute;left:50%;top:10px;transform:translateX(-50%);z-index:5;width:min(420px,70%);text-align:center;font-family:var(--display);color:#E8B44A;font-size:15px;text-shadow:0 1px 3px #000;pointer-events:none}
  .bossbar .bb{height:9px;border:1px solid #5A2E18;background:#1A0E0A;border-radius:4px;overflow:hidden;margin-top:3px}
  .bossbar .bb i{display:block;height:100%;background:linear-gradient(90deg,#8E2F27,#E2622B)}
  .shrine{display:grid;grid-template-columns:130px 1fr;gap:14px;align-items:start}
  .shrine h3,.faith h3{font-family:var(--display);font-size:20px;margin:0}
  .boons{margin:0 0 8px 18px;padding:0} .boons li{margin:2px 0}
  .forge-top{display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
  .pouch2{display:flex;gap:6px;flex-wrap:wrap}
  .mslot{width:64px;display:flex;flex-direction:column;align-items:center;gap:1px;padding:5px 2px;border:1px solid var(--edge);border-radius:6px;background:#141110;font-size:10px;color:var(--ash)}
  .mslot b{font-size:13px;color:var(--ink)} .mslot.none{opacity:.4}
  .forge-info{font-size:12px;color:#fff;font-weight:700;display:flex;flex-direction:column;gap:2px} .forge-info .c-info{color:#fff}   /* 2026-09-28 (Justin): bright white and bold; the affinity keeps its element colour, essence its gold */
  .ftabs{display:flex;gap:4px;margin:6px 0 10px} .ftabs button.on{border-color:var(--ember);color:var(--gold);background:#2A2015}
  .frow{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05)}
  .frow .ftext{flex:1} .frow .d, .egrid .d{color:var(--dim);font-size:11px;display:block}
  .dot{width:11px;height:11px;border-radius:50%;display:inline-block;flex:0 0 auto;box-shadow:0 0 6px rgba(255,255,255,.2)}
  .egrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px;margin:6px 0 12px}
  .egrid button{text-align:left;display:flex;flex-direction:column;gap:2px}
  .fslot{margin-top:6px}
  .slot .ico{position:absolute;left:5px;top:50%;transform:translateY(-50%);width:28px;height:28px;image-rendering:auto}
  .slot.hasico{padding-left:38px}
  #hud2{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:10.5px;color:var(--ash);min-height:16px}
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
  .fmeter{display:flex;align-items:center;gap:10px;margin:6px 0 10px;font-size:11px;color:var(--ash)}
  .fmeter .meter{flex:1;height:10px}
  .slot.prayer-slot{border-color:var(--gc,#8A6FB0)}
  .slot.prayer-slot .c{color:var(--gc,#C9A8FF)}
  .abrow.dragp{cursor:grab}
  .abrow .pico{width:28px;height:28px;flex:none}
  .abrow[data-pr]{grid-template-columns:28px auto 1fr auto;align-items:center}
  #topbtns{display:flex;gap:4px;align-items:center;margin-left:8px}
  #topbtns button{font-size:10.5px;padding:3px 7px;white-space:nowrap}
  .tag canvas{vertical-align:middle;margin-right:2px}
  .cell .gear{position:absolute;inset:3px;display:flex;align-items:center;justify-content:center}
  .doll{grid-template-columns:minmax(0,1fr) clamp(110px,26%,150px) minmax(0,1fr)!important}
  @media (min-width:700px){ .equip{grid-template-columns:minmax(300px,1.35fr) minmax(220px,1fr)!important} }
  .dollart{grid-column:2;min-height:190px;grid-row:1/5;align-self:stretch;border:1px dashed var(--edge);border-radius:8px;background:radial-gradient(#2A221C,#141110);display:flex;align-items:flex-end;justify-content:center;overflow:hidden}
  .prayer{font-size:11px;padding:3px 8px}
  .faith .who{margin-bottom:6px}
  /* character creation */
  #create{position:fixed;inset:0;z-index:40;background:radial-gradient(ellipse at 50% 20%,#2A1F18,#0B0908 70%);display:none;overflow-y:auto}
  #create.on{display:block}
  #create .wrap{max-width:1100px;margin:0 auto;padding:22px 16px 40px}
  #create h1{font-size:34px;text-align:center;margin:6px 0 2px}
  #create .tag2{text-align:center;color:var(--ash);margin-bottom:18px}
  #create .step{margin:16px 0 6px;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--dim)}
  #create .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}
  #create .card{background:#171310;border:1px solid var(--edge);border-radius:8px;padding:10px;cursor:pointer;display:flex;flex-direction:column;gap:4px;text-align:left;color:var(--ink)}
  #create .card:hover{border-color:#6A5040}
  #create .card.on{border-color:var(--ember);background:#241A12;box-shadow:0 0 0 1px rgba(226,98,43,.35) inset}
  #create .card b{font-family:var(--display);font-size:17px;color:var(--gold)}
  #create .card span{font-size:11px;color:var(--ash);line-height:1.4}
  #create .card .port{height:120px;display:flex;align-items:flex-end;justify-content:center}
  #create .summary{display:grid;grid-template-columns:200px 1fr;gap:18px;align-items:center;background:#141110;border:1px solid var(--edge);border-radius:10px;padding:14px;margin-top:18px}
  #create .summary .big{height:230px;display:flex;align-items:flex-end;justify-content:center}
  #create .go{font-size:16px;padding:10px 26px;margin-top:10px}
  #create input{width:220px;font-size:14px}
  @media (max-width:640px){ #create .summary{grid-template-columns:1fr} .shrine{grid-template-columns:1fr} }
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
var ICON_UP=new WeakMap(), ICON_SHOWN={};
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
  x.imageSmoothingEnabled=f<1; x.imageSmoothingQuality='high';
  x.drawImage(src.img, src.sx,src.sy,src.sw,src.sh, Math.round((W-dw)/2), Math.round((H-dh)/2), dw, dh);
}
function paintArtCanvas(el, group, name, size){
  var o = group==='cast' ? null : (objArt(group,name) || anyObj(name));
  var c=document.createElement('canvas'), d=window.devicePixelRatio||1, S=size||32;
  if(o){
    var trinket=group==='items' && /^item-(ring|amulet)(-|$)/.test(name) && !!((el.classList && el.classList.contains('gear')) || (el.closest && el.closest('#hotbar')));
    /* a canvas the page stretches to its box (touch Gear tiles, the hotbar) is repainted at the size it is shown. For a
       box already on the page that size is remembered per kind of box and window size, so the hotbar's repaint every
       turn forces no layout; a detached one is measured on the next frame, once it has been placed. */
    var key=el.isConnected && el.parentNode ? el.className+'<'+String(el.parentNode.className).split(' ')[0]+'@'+innerWidth+'x'+innerHeight+'x'+d+(document.body.classList.contains('touch')?'t':'') : null, known=key ? ICON_SHOWN[key] : undefined;
    paintIconArt(c, o, known ? known[0] : S, known ? known[1] : S, trinket, !!known);
    el.innerHTML=''; el.appendChild(c);
    var shown=function(){ var st=getComputedStyle(c), w=/px$/.test(st.width) && parseFloat(st.width), h=/px$/.test(st.height) && parseFloat(st.height);
      if(!(w>0 && h>0)) return;
      var stretched=Math.abs(w-S)*d>0.5 || Math.abs(h-S)*d>0.5;
      if(key) ICON_SHOWN[key]=stretched && [w,h];
      if(stretched) paintIconArt(c, o, w, h, trinket, true); };
    if(known===undefined){ if(key) shown(); else if(window.requestAnimationFrame) requestAnimationFrame(shown); }
    return;
  }
  c.width=S*d; c.height=S*d; c.style.width=S+'px'; c.style.height=S+'px';
  var x=c.getContext('2d'); x.setTransform(d,0,0,d,0,0); x.imageSmoothingEnabled=true;
  if(group==='cast'){
    /* 2026-09-22 (Justin): character selection draws the 256px doll cut-out (cast-<look>-doll.webp, the paper doll's
       sheet), feet on the box's floor. The old portraits.webp is archived (2026-09-27): while a doll is unavailable the
       look's own map-sheet still stands in (the character never disappears) and the doll retries. */
    var cm=AS.cast && AS.cast[name], dm=cm && cm.doll, di=dm && atl('cast-'+name+'-doll.webp');
    if(di){ var ds=S*0.98/dm.stand, dw=dm.cell*ds; x.drawImage(di,0,0,dm.cell,dm.cell,(S-dw)/2,S-(dm.cell-(dm.foot||0))*ds+S*0.02,dw,dw); el.innerHTML=''; el.appendChild(c); return; }
    var si=cm && cm.static_row!=null && atl('cast-'+name+'.webp');
    if(si){ var ss=S*0.98/cm.stand, sw=cm.cell*ss; x.drawImage(si,0,cm.static_row*cm.cell,cm.cell,cm.cell,(S-sw)/2,S-(cm.cell-(cm.foot||0))*ss+S*0.02,sw,sw); }
    if(dm){ setTimeout(function(){ if(el.isConnected) paintArt(el,group,name,size); }, 300); if(!si) return; }
  } else if(AS.map){ setTimeout(function(){ if(el.isConnected && !el.querySelector('canvas')){ paintArt(el,group,name,size); } }, 500); return; }
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
  else span.textContent=fallbackText||'?';
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
    tb.innerHTML='<button id="bMute" title="Sound on/off (m)">Sound</button><button id="bMusic" title="Music on/off (n)">Music</button>';
    top.appendChild(tb);
  }
})();
SHEETS.Faith='Faith';
function hudResourceCard(kind){
  function number(n){return Math.round(n||0).toLocaleString('en-US');}
  function escape(s){return String(s).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});}
  function row(label,value){return '<div class="row"><span>'+label+'</span><b>'+value+'</b></div>';}
  if(kind==='hp')return '<div class="nm">Health</div>'+row('HP',number(player.hp)+' / '+number(player.maxhp))+(playerShield()>0?row('Shield',number(playerShield()))+'<div class="hint">'+escape(shieldParts().join(', '))+'. Shields absorb damage before HP.</div>':'');
  if(kind==='mp')return '<div class="nm">Mana</div>'+row('MP',number(Math.floor(player.mp))+' / '+number(player.maxmp))+'<div class="hint">Used to cast spells and abilities that cost mana.</div>';
  if(kind==='xp')return '<div class="nm">Experience</div>'+row('Level',player.level)+row('XP',number(player.xp)+' / '+number(player.xpNext))+'<div class="hint">'+(player.level>=20?'Maximum level reached. Further XP still counts toward your run total.':number(Math.max(0,player.xpNext-player.xp))+' XP to the next level.')+'</div>';
  if(kind==='stock')return '<div class="nm">Essence &amp; keys</div>'+row('Essence',number(player.essence))+row('Iron keys',number(player.keys&&player.keys.iron))+row('Crystal keys',number(player.keys&&player.keys.crystal))+'<div class="hint">Essence pays for crafting, upgrades and enchantments at a forge. Keys open locked doors on the floor where you find them.</div>';
  if(kind==='motes')return '<div class="nm">Elemental motes</div>'+['fire','water','earth','air','light','shadow'].map(function(k){return row(cap(k),number(player.motes[k]));}).join('')+'<div class="hint">Infuse carried motes when claiming a boss core or at a forge. Open Gear to see your pouch.</div>';
  if(kind==='amusement'){
    var mood=Math.max(0,Math.min(100,player.amusement||0)),odds=wobblesMoodOdds(mood);
    return '<div class="nm">Amusement '+number(mood)+'%</div>'+row('Prank chance / turn',(odds.prank*100).toFixed(3)+'%')+row('Reward chance / turn',(odds.reward*100).toFixed(3)+'%')+'<div class="hint">Combat raises Amusement; quiet drains it. Pranks raise it by 50; rewards spend 50, within 0 to 100. These chances use Amusement, not Favor.</div>';
  }
  if(kind==='hunger'){
    var state=player.hunger<=0?'Starving':player.hunger<300?'Hungry':'Fed';
    return '<div class="nm">Hunger: '+state+'</div><div class="row"><span>Hunger</span><b>'+number(player.hunger)+' / '+number(HUNGER_MAX)+'</b></div><div class="hint">Eat food from your bag to restore hunger.</div>';
  }
  if(!player.god)return '<div class="nm">No god followed</div>';
  var god=GODS[player.god],rank=godRank(),next=PIETY_RANKS[rank];
  if(kind==='piety')return '<div class="nm">Piety</div><div class="hint">'+escape(god.name)+'</div><div class="row"><span>God rank</span><b>'+rank+' / 5</b></div><div class="row"><span>Piety</span><b>'+number(player.piety)+(next?' / '+number(next):'')+'</b></div><div class="hint">'+(next?number(Math.max(0,next-player.piety))+' more piety to reach rank '+(rank+1)+'.':'Maximum god rank reached.')+'</div>';
  return '<div class="nm">Favor</div><div class="row"><span>Favor</span><b>'+number(player.favor)+' / 100</b></div><div class="hint">Spent on divine abilities that cost Favor. It is earned alongside piety.</div>';
}
function bindHudResourceCard(element,kind){
  if(!element)return;
  element.removeAttribute('title');element.setAttribute('aria-describedby','dtip');
  element.querySelectorAll('[title]').forEach(function(child){child.removeAttribute('title');});
  if(element._hudResourceCard===kind)return;
  element._hudResourceCard=kind;if(element.tabIndex<0)element.tabIndex=0;
  hoverCard(element,function(){return hudResourceCard(kind);});
  element.addEventListener('focus',function(){var r=element.getBoundingClientRect();showCard(hudResourceCard(kind),{clientX:r.left,clientY:r.bottom,isTrusted:false});});
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
  el.innerHTML=b.name+intent+'<div class="bb"><i style="width:'+Math.max(0,Math.round(b.hp/b.maxhp*100))+'%"></i></div>';
}
function bars(){
  bossBar();
  $('hFloor').textContent=floorNo; $('hBiome').textContent=(floorMeta && floorMeta.plane ? (PLANE_THEMES[floorMeta.plane]||{}).name : biomeName()); $('hTurn').textContent=turn;
  var shield=playerShield(), hpPct=clamp(player.hp/player.maxhp,0,1)*100, shPct=Math.min(100-hpPct, shield/player.maxhp*100);
  if(hpPct+shield/player.maxhp*100>100){ hpPct=Math.max(0, 100*player.hp/(player.hp+shield)); shPct=100-hpPct; }
  $('hpFill').style.width=hpPct+'%';
  var sf=$('shFill'); if(sf){ sf.style.left=hpPct+'%'; sf.style.width=(shield>0?shPct:0)+'%'; }
  $('hpTxt').textContent=Math.max(0,Math.round(player.hp))+'/'+player.maxhp+(shield>0?' +'+Math.round(shield):'');
  $('hpTxt').title = shield>0 ? 'Shield '+Math.round(shield)+': absorbs damage before your HP ('+shieldParts().join(', ')+')' : '';
  $('mpFill').style.width=(clamp(player.mp/player.maxmp,0,1)*100)+'%';
  $('mpTxt').textContent=Math.floor(player.mp)+'/'+player.maxmp;
  $('xpFill').style.width=(clamp(player.xp/player.xpNext,0,1)*100)+'%';
  /* 2026-09-28 (Justin): the bar shows only the level; '777/1500' crushed it onto two rows on small screens. The
     fill still shows progress, and the exact numbers are on hover. */
  $('xpBar').title=player.xp+' / '+player.xpNext+' XP';
  $('lvTxt').textContent='LV '+player.level;
  var tags=[];
  var labels={burn:'burning',chill:'chilled',frozen:'frozen',root:'rooted',stun:'stunned',fear:'afraid',blind:'blind',poison:'poisoned',stone:'stone skin',wet:'wet',aura:'unholy aura',corrupt:'corrupt'};
  for(var k in player.st){ if(k.indexOf('imm_')===0) continue; tags.push('<span class="tag t-'+k+'">'+(labels[k]||k)+' '+player.st[k].t+'</span>'); }
  for(var b in player.buffs){ if(player.buffs[b]>0) tags.push('<span class="tag t-hidden">'+b+' '+player.buffs[b]+'</span>'); }
  if(player.hidden>0) tags.push('<span class="tag t-hidden">hidden '+player.hidden+'</span>');
  if(player.levitate>0) tags.push('<span class="tag t-chill">floating '+player.levitate+'</span>');
  $('fx').innerHTML=tags.join('');
  if(typeof FoteResponsiveHUD!=='undefined'&&FoteResponsiveHUD.isMounted()){FoteResponsiveHUD.renderReadouts();return;}
  var hud=$('hud2'); if(!hud) return;
  var hp=player.hunger/HUNGER_MAX, hl = player.hunger<=0 ? 'Starving' : player.hunger<300 ? 'Hungry' : 'Fed';
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
    var am=Math.round(player.amusement||0);
    var nx=PIETY_RANKS[r]||null, pv=PIETY_RANKS[r-1]||0, pp=nx ? clamp(((player.piety||0)-pv)/(nx-pv),0,1) : 1;
    return h+'<span class="rk">R'+r+'</span>'+
      '<span class="meter" title="Piety '+Math.round(player.piety||0)+(nx?' / '+nx+' for rank '+(r+1):' (max rank)')+'"><i style="width:'+Math.round(pp*100)+'%;background:linear-gradient(90deg,'+hexA(g.color,0.55)+','+g.color+')"></i></span>'+
      '<span class="rk" title="Amusement: drama raises it, quiet drains it">☺ '+am+'</span>'+
      '<span class="meter sm" title="Amusement '+am+' / 100"><i style="width:'+am+'%;background:linear-gradient(90deg,#8A4FB0,'+g.color+')"></i></span></span>';
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
  "lance": "ic-radiant-lance",
  "bonespear": "pr-bonespear",
  "arcanelance": "pr-arcanelance",
  "luckystreak": "ic-roll-dice",
  "arcanenova": "pr-arcanenova"
};
function prayerIcon(pid){pid=prayerId(pid);return PRAYER_ICONS[pid]||'pr-'+pid;}
function prayerCost(pid){ var P=PRAYERS[pid]; return P.favor ? P.favor+' Favor' : P.essence ? P.essence+' essence' : P.amusement ? P.amusement+' Amusement' : 'prayer'; }

/* every ability or prayer you gain drops into the first empty hotbar slot once; clearing a slot keeps it cleared */


/* ---------------------------------------------------------------- hotbar with icons */
function renderHotbarSlots(){
  syncHotbar();
  var html='', i, s;
  for(i=0;i<8;i++){
    s=player.hotbar[i];
    if(!s){ html+='<div class="slot empty" data-i="'+i+'"><span class="k">'+(i+1)+'</span><span class="n">empty</span></div>'; continue; }
    if(s.type==='ability'){
      var A=ABILITIES[s.key], off = (A.favor ? (player.favor||0)<A.favor : player.mp<costOf(A)) ? ' disabled' : '';
      var armed = (aiming && player.abilities[aiming.i]===s.key) ? ' armed' : '';
      html+='<button class="slot hasico'+armed+'" data-i="'+i+'" data-ico="'+(A.icon||'')+'"'+off+' title="'+(typeof liveDesc==='function' ? liveDesc(A) : A.desc).replace(/"/g,'&quot;')+'">'+
            '<span class="ico"></span><span class="k">'+(i+1)+'</span><span class="n">'+A.name+'</span><span class="c">'+(A.favor ? A.favor+' Favor' : costOf(A)+' mana')+'</span></button>';
    } else if(s.type==='prayer'){
      var PR=PRAYERS[s.key], gcol=GODS[player.god] ? GODS[player.god].color : '#8A6FB0';
      html+='<button class="slot hasico prayer-slot" style="--gc:'+gcol+'" data-i="'+i+'" data-ico="'+prayerIcon(s.key)+'"'+(canPray(s.key)?'':' disabled')+' title="'+(typeof prayerLive==='function' ? prayerLive(PR) : PR.desc).replace(/"/g,'&quot;')+'">'+
            '<span class="ico"></span><span class="k">'+(i+1)+'</span><span class="n">'+PR.name+'</span><span class="c">'+prayerCost(s.key)+'</span></button>';
    } else if(s.type==='amulet'){
      html+='<button class="slot" data-i="'+i+'"><span class="k">'+(i+1)+'</span><span class="n">Amulet</span></button>';   /* filled in by gear.js */
    } else if(s.type==='ranged'){
      var rw=player.ranged, rn=rw ? (typeof gearName==='function' ? gearName(rw) : rw.name) : 'no bow';
      html+='<button class="slot hasico" data-i="'+i+'" data-ico="'+((rw&&rw.icon)||'')+'"'+(rw?'':' disabled')+' title="Shoot your '+rn.replace(/"/g,'&quot;')+'"><span class="ico"></span>'+
            '<span class="k">'+(i+1)+'</span><span class="n">'+rn+'</span><span class="c">shoot</span></button>';
    } else if(s.type==='swap'){
      var stow=player.sets[1-player.activeSet];
      html+='<button class="slot hasico" data-i="'+i+'" data-ico="ic-swap" title="Weapon swapping is gone; this slot does nothing."><span class="ico"></span>'+
            '<span class="k">'+(i+1)+'</span><span class="n">'+(stow?stow.name:'nothing stowed')+'</span><span class="c">weapon swap</span></button>';
    } else {
      var it=s.ref, n=it.n>1 ? ' &times;'+it.n : '';
      /* 2026-09-27: a stack shows its count in the corner badge the cooldowns use (items never have one) */
      html+='<button class="slot hasico" data-i="'+i+'" data-bagico="1" title="'+it.name+'"><span class="ico"></span>'+
            '<span class="k">'+(i+1)+'</span><span class="n">'+it.name+n+'</span><span class="c">'+it.kind+'</span>'+(it.n>1 ? '<span class="cdn">'+it.n+'</span>' : '')+'</button>';
    }
  }
  $('hotbar').innerHTML=html;
  var btns=$('hotbar').querySelectorAll('.slot[data-i]');
  for(i=0;i<btns.length;i++){
    (function(b){
      var idx=+b.getAttribute('data-i'), ico=b.querySelector('.ico');
      if(ico){ var nm=b.getAttribute('data-ico'); if(b.getAttribute('data-bagico')) nm=iconNameForBag(player.hotbar[idx].ref);
        if(nm){ var o=objArt('icons',nm)||objArt('items',nm); if(o) paintArt(ico, objArt('icons',nm)?'icons':'items', nm, 28); } }
      b.onclick=function(){ sfx('ui-click'); pressSlotIndex(idx); };
      /* right-click clears items and amulets; abilities and prayers always keep a slot (drag to rearrange) */
      b.oncontextmenu=function(ev){ ev.preventDefault(); var hs=player.hotbar[idx]; if(hs && hs.type!=='ability' && hs.type!=='prayer'){ player.hotbar[idx]=null; abilityBar(); } };
      if(player.hotbar[idx]) dragSource(b, 'hot:'+idx);
      dropTarget(b, function(tag){ hotbarDrop(idx, tag); });
    })(btns[i]);
  }
}
function hotbarDrop(idx, tag){
  var bi=bagIndexFromTag(tag);
  if(bi>=0 && player.bag[bi]) hotbarPut(idx, {type:'item', ref:player.bag[bi]});
  else if(tag==='ranged') hotbarPut(idx, {type:'ranged'});
  else if(tag==='weapons') hotbarPut(idx, {type:'swap'});
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
  var e=ents.find(function(o){return entityOccupies(o,mx,my)&&o!==player&&!actorConcealed(o);});
  if(e && e.parent) e=e.parent;   /* a big elite's other cells report the creature itself, not its proxy */
  if(e && (revealAll||vis[idxOf(mx,my)])){
    if(e.ally) return '<div class="nm">'+e.name+'</div><div class="row"><span>HP</span><b>'+Math.max(0,e.hp)+' / '+e.maxhp+'</b></div><div class="hint enemy-lore">'+enemyLore(e)+'</div><div class="hint">Fights for you.</div>';
    var ch=Math.round(hitChance(player.acc,evaOf(e))*100), back=Math.round(hitChance(e.base.acc,evaOf(player))*100);
    var lo=Math.max(1,Math.round(player.dmg[0]-Math.min(armorOf(e),player.dmg[0]*0.5))), hi=Math.max(1,Math.round(player.dmg[1]-Math.min(armorOf(e),player.dmg[1]*0.5)));
    var st=Object.keys(e.st).filter(function(k){ return k.indexOf('imm_')!==0; }).map(function(k){ return '<span class="tag t-'+k+'">'+k+'</span>'; }).join(' ');
    return '<div class="nm">'+e.name+'</div>'+
      '<div class="hint enemy-lore">'+enemyLore(e)+'</div>'+
      '<div class="row"><span>HP</span><b>'+Math.max(0,e.hp)+' / '+e.maxhp+'</b></div>'+
      '<div class="row"><span>Armor &middot; Evasion</span><b>'+armorOf(e)+' &middot; '+evaOf(e)+'</b></div>'+
      (e.base.el?'<div class="row"><span>Element</span><b style="color:'+AFF_COL[e.base.el]+'">'+cap(e.base.el)+'</b></div>':'')+
      '<div class="row"><span>State</span><b>'+(e.st.stun?'stunned':e.st.frozen?'frozen':e.state==='throne'?'on his throne':({hunt:'hunting',wander:'wandering'}[e.state]||e.state))+'</b></div>'+
      (e.keyholder?'<div class="row"><span>Carries</span><b>an iron key</b></div>':'')+
      (st?'<div style="margin-top:4px">'+st+'</div>':'')+
      (e.base.hint?'<div class="hint">'+e.base.hint+'</div>':'')+
      '<div class="odds">You hit <em>'+ch+'%</em> for '+lo+'-'+hi+'. It hits you <em>'+back+'%</em>.</div>';
  }
  var it=items.filter(function(i){ return i.x===mx && i.y===my; })[0];
  if(it){
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
    if(p.previewPortal&&typeof FoteChaosPreview!=='undefined'){
      var gateway=FoteChaosPreview.atPortal(mx,my);
      if(gateway)return '<div class="nm">'+gateway.label+'</div><div class="hint">A two-way portal to another island on this floor. Step onto it to travel.</div>';
    }
    var lever=leverDetails(p);
    if(lever){
      var action=document.body.classList.contains('touch')?'Tap':'Click';
      return '<div class="nm">'+lever.name+'</div><div class="row"><span>State</span><b>'+
        (lever.used?'Already pulled':'Ready to pull')+'</b></div><div class="hint">'+
        (lever.used?lever.result:action+' or bump this lever to '+lever.effect+'.')+'</div>';
    }
    var pn=({'urn-group':'urns','stack-group':p.kinds && p.kinds.indexOf('pot')>=0 && p.kinds.indexOf('crate')<0 ? 'pots' : 'crates and barrels','urn-shattered':'broken urn','urn-tall':'urn','urn-squat':'urn','urn-ornate':'urn','barrel-explosive':'powder barrel','altar-spikes':'sacrifice altar','drow-altar-blood':'sacrifice altar'})[p.name] || p.name.replace(/-/g,' ');
    var hint = p.ex ? 'Explodes when broken or burned.' : p.br ? 'Breakable. Might hold something.' : p.tablet ? 'A broken tablet. Read it.' :
      p.altar ? 'Offer blood for rewards.' : p.prisoner ? 'Someone is locked inside. Let them out and hope they are grateful.' : p.name==='elemental-lock' ? 'Wants one '+p.element+' mote.' : p.drink ? 'Drink from it.' :
      p.bush ? 'Cut it down. Sometimes a heart is tucked underneath.' : '';
    /* 2026-09-19: Justin - scenery you cannot do anything with gets no card at all */
    if(!hint) return '';
    return '<div class="nm">'+cap(pn)+'</div><div class="hint">'+hint+'</div>';
  }
  var tr=feats.filter(function(f){ return f.x===mx && f.y===my && (f.found||revealAll); })[0];
  if(tr) return '<div class="nm">'+trapName(tr.kind)+' trap</div><div class="hint">Walk around it.</div>';
  var t=at(mx,my);
  /* Map cards belong to things you can inspect or use, not terrain. */
  if([2,3,4,5,7,9,10,11,12,13,14,18,19,20].indexOf(t)<0) return '';
  var label=TILE_NAMES[t]||'Floor';
  if(t===SHRINE) label='Shrine to '+GODS[RUN.shrineGod].name;
  if(typeof PORTAL!=='undefined' && t===PORTAL && floorMeta.portal && typeof PLANE_TITLE!=='undefined') label='Portal to '+PLANE_TITLE[floorMeta.portal];
  var tileHint=t===EXIT ? (floorMeta.exitOpen ? 'Open. Step through to go on.' : 'Sealed. Bring '+bossNameForFloor().replace(/^The /,'the ')+'\'s '+coreName()+' here to open it.') : TILE_HINTS[t];
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
  var tgt=ev.target.tagName;
  var editing=tgt==='INPUT'||tgt==='SELECT'||tgt==='TEXTAREA';
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
  if(k==='m'){ audioInit(); toggleMute(); syncAudioButtons(); ev.stopImmediatePropagation(); return; }
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
  var n=0,restRun=RUN,restPlayer=player,restId=++REST_SEQUENCE,alarms=restAlarms(),hunters=restHunters(); log('You rest...','c-info');
  (function step(){
    if(restId!==REST_SEQUENCE || RUN!==restRun || player!==restPlayer || uiOpen())return;
    if(turnSequenceBusy()){afterTurn(function(){setTimeout(step,0);});return;}
    if(n++>=150 || player.hp<=0) return;
    if(player.hp>=player.maxhp && player.mp>=player.maxmp){ log('Rested.','c-good'); return; }
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
