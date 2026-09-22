/* ============================================================================
   ui.js - modals, sprite icons, hotbar, HUD, sheets (Character, Equipment,
   Faith), tooltips, extra keys. Overrides the matching game.js functions.
   ========================================================================== */

(function injectCSS(){
  var css = `
  #modal{position:fixed;inset:0;z-index:30;display:none;align-items:center;justify-content:center;background:rgba(6,5,4,.78);padding:16px}
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
  .forge-info{font-size:12px;color:var(--ash);display:flex;flex-direction:column;gap:2px}
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
function paintArt(el, group, name, size){
  var o = group==='cast' ? null : (objArt(group,name) || anyObj(name));
  var c=document.createElement('canvas'), d=window.devicePixelRatio||1, S=size||32;
  c.width=S*d; c.height=S*d; c.style.width=S+'px'; c.style.height=S+'px';
  var x=c.getContext('2d'); x.setTransform(d,0,0,d,0,0); x.imageSmoothingEnabled=true;
  if(group==='cast'){
    var pt=AS.portraits && AS.portraits.items[name], pimg=pt && atl('portraits.png');
    if(pimg){ var pc=AS.portraits.cell, sc=S/pc*1.1; x.drawImage(pimg,pt[0],pt[1],pc,pc,(S-pc*sc)/2,S-pc*sc+S*0.02,pc*sc,pc*sc); }
    else if(pt){ setTimeout(function(){ if(el.isConnected) paintArt(el,group,name,size); }, 300); return; }
  } else if(o){
    var s=Math.min(S/o.sw, S/o.sh)*0.92; x.drawImage(o.img,o.sx,o.sy,o.sw,o.sh,(S-o.sw*s)/2,(S-o.sh*s)/2,o.sw*s,o.sh*s);
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
function syncAudioButtons(){
  if($('bMute')) $('bMute').textContent = AUDIO.muted ? 'Sound: off' : 'Sound: on';
  if($('bMusic')) $('bMusic').textContent = AUDIO.musicOn ? 'Music: on' : 'Music: off';
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
  var intent = b.dazed>0 ? ' &mdash; <span style="color:#E8D27A">DAZED</span>' : b.windup ? ' &mdash; <span style="color:#FF7A5A">'+({slam:'GROUND SLAM in '+b.windup.due, ring:'SHOCKWAVE in '+b.windup.due, charge:'CHARGE!'}[b.windup.kind]||'')+'</span>' : '';
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
  $('hpTxt').title = shield>0 ? 'Shield '+Math.round(shield)+': absorbs damage before your HP (ice armor'+(player.ward>0?', ward':'')+')' : '';
  $('mpFill').style.width=(clamp(player.mp/player.maxmp,0,1)*100)+'%';
  $('mpTxt').textContent=Math.floor(player.mp)+'/'+player.maxmp;
  $('xpFill').style.width=(clamp(player.xp/player.xpNext,0,1)*100)+'%';
  $('xpTxt').textContent=player.xp+'/'+player.xpNext;
  $('lvTxt').textContent='LV '+player.level;
  var tags=[];
  var labels={burn:'burning',chill:'chilled',frozen:'frozen',root:'rooted',stun:'stunned',fear:'afraid',blind:'blind',poison:'poisoned',stone:'stone skin',wet:'wet',aura:'unholy aura',corrupt:'corrupt'};
  for(var k in player.st){ if(k.indexOf('imm_')===0) continue; tags.push('<span class="tag t-'+k+'">'+(labels[k]||k)+' '+player.st[k].t+'</span>'); }
  for(var b in player.buffs){ if(player.buffs[b]>0) tags.push('<span class="tag t-hidden">'+b+' '+player.buffs[b]+'</span>'); }
  if(player.hidden>0) tags.push('<span class="tag t-hidden">hidden '+player.hidden+'</span>');
  if(player.levitate>0) tags.push('<span class="tag t-chill">floating '+player.levitate+'</span>');
  $('fx').innerHTML=tags.join('');
  var hud=$('hud2'); if(!hud) return;
  var hp=player.hunger/HUNGER_MAX, hl = player.hunger<=0 ? 'Starving' : player.hunger<300 ? 'Hungry' : 'Fed';
  var h='<span class="chip" title="Hunger">'+hl+' <span class="hunger"><i style="width:'+Math.round(hp*100)+'%"></i></span></span>';
  if(player.stillness>0) h+='<span class="chip" style="color:#9FD8FF" title="Time is frozen: moving is free">\u23F8 stillness '+player.stillness+'</span>';
  if(player.keys && (player.keys.iron||player.keys.crystal)) h+='<span class="chip" id="keychip">\u{1F5DD} '+(player.keys.iron||0)+'</span>';
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
  var aSub = a ? (a.charges!==undefined ? a.charges+'/3 charges'+(a.charges<3?' &middot; next in '+(amuletKillsNeeded(a)-(a.progress||0))+' kills':'') : '') : 'activated; kills build charges';
  return one('Amulet', a, 'amulet', aSub)+
    one('Ring', r[0], 'ring0', r[0] ? (r[0].unid ? 'strength unknown' : ringLine(r[0])) : 'passive')+
    one('Ring', r[1], 'ring1', r[1] ? (r[1].unid ? 'strength unknown' : ringLine(r[1])) : 'passive');
}

/* shield points on top of HP: Water's ice armor plus any active ward (Arcane Ward, Amulet of Thorns) */
function playerShield(){ return Math.max(0,Math.floor(player.iceArmor||0)) + ((player.buffs && player.buffs.arcaneward>0) ? Math.max(0,player.ward||0) : 0); }

/* ---------------------------------------------------------------- faith in the HUD */
function faithChipHTML(){
  var g=GODS[player.god], r=godRank();
  var h='<span class="chip faithchip" title="'+g.name+' \u2014 open with P" style="color:'+g.color+'" onclick="showSheet(\'Faith\')">'+
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
    '<span class="rk" title="Favor, spent on prayers">\u2726 '+fav+'</span>'+
    '<span class="meter sm" title="Favor '+fav+' / 100"><i style="width:'+fav+'%;background:linear-gradient(90deg,#6B5A22,#E8D27A)"></i></span></span>';
}
function prayerIcon(pid){ return objArt('icons','pr-'+pid) ? 'pr-'+pid : 'ic-pray'; }
function prayerCost(pid){ var P=PRAYERS[pid]; return P.favor ? P.favor+' favor' : P.essence ? P.essence+' essence' : P.amusement ? P.amusement+' amusement' : 'prayer'; }

/* every ability or prayer you gain drops into the first empty hotbar slot once; clearing a slot keeps it cleared */
function syncHotbar(){
  var i, s;
  if(!player.hotbar) player.hotbar=[null,null,null,null,null,null,null,null];
  var prayers = (typeof prayerList==='function' ? prayerList() : []).filter(function(pid){ return godRank()>=PRAYERS[pid].rank; });
  for(i=0;i<8;i++){
    s=player.hotbar[i]; if(!s) continue;
    if(s.type==='ability' && player.abilities.indexOf(s.key)<0) player.hotbar[i]=null;
    if(s.type==='prayer' && prayers.indexOf(s.key)<0) player.hotbar[i]=null;
    if(s.type==='item' && player.bag.indexOf(s.ref)<0) player.hotbar[i]=null;
  }
  if(!player.hotKnown) player.hotKnown={};
  /* every ability and prayer you know keeps a slot: one that is missing goes back into the first empty slot */
  function offer(type, key){
    player.hotKnown[type.charAt(0)+':'+key]=true;
    for(var j=0;j<8;j++){ var h=player.hotbar[j]; if(h && h.type===type && h.key===key) return; }
    for(var j2=0;j2<8;j2++) if(!player.hotbar[j2]){ player.hotbar[j2]={type:type, key:key}; return; }
  }
  player.abilities.forEach(function(k){ offer('ability', k); });
  prayers.forEach(function(pid){ offer('prayer', pid); });
}
function pressSlotIndex(i){
  var s=player.hotbar && player.hotbar[i];
  if(!s) return;
  if(s.type==='ability'){ var ai=player.abilities.indexOf(s.key); if(ai>=0) useAbility(ai); return; }
  if(s.type==='prayer'){ usePrayer(s.key); updateUI(); return; }
  if(s.type==='swap'){ swapWeapon(); return; }
  /* 2026-09-20: the equipped bow can live on the hotbar; pressing it shoots (js/rangedslot.js) */
  if(s.type==='ranged'){ if(typeof bowSlotPress==='function') bowSlotPress(); return; }
  if(s.type==='item'){
    var bi=player.bag.indexOf(s.ref);
    if(bi<0){ player.hotbar[i]=null; abilityBar(); return; }
    useBagItem(bi); updateUI();
  }
}

/* ---------------------------------------------------------------- hotbar with icons */
function abilityBar(){
  syncHotbar();
  var html='', i, s;
  for(i=0;i<8;i++){
    s=player.hotbar[i];
    if(!s){ html+='<div class="slot empty" data-i="'+i+'"><span class="k">'+(i+1)+'</span><span class="n">empty</span></div>'; continue; }
    if(s.type==='ability'){
      var A=ABILITIES[s.key], off = (A.favor ? (player.favor||0)<A.favor : player.mp<costOf(A)) ? ' disabled' : '';
      var armed = (aiming && player.abilities[aiming.i]===s.key) ? ' armed' : '';
      html+='<button class="slot hasico'+armed+'" data-i="'+i+'" data-ico="'+(A.icon||'')+'"'+off+' title="'+A.desc.replace(/"/g,'&quot;')+'">'+
            '<span class="ico"></span><span class="k">'+(i+1)+'</span><span class="n">'+A.name+'</span><span class="c">'+(A.favor ? A.favor+' Favor' : costOf(A)+' mana')+'</span></button>';
    } else if(s.type==='prayer'){
      var PR=PRAYERS[s.key], gcol=GODS[player.god] ? GODS[player.god].color : '#8A6FB0';
      html+='<button class="slot hasico prayer-slot" style="--gc:'+gcol+'" data-i="'+i+'" data-ico="'+prayerIcon(s.key)+'"'+(canPray(s.key)?'':' disabled')+' title="'+PR.desc.replace(/"/g,'&quot;')+'">'+
            '<span class="ico"></span><span class="k">'+(i+1)+'</span><span class="n">'+PR.name+'</span><span class="c">'+prayerCost(s.key)+'</span></button>';
    } else if(s.type==='amulet'){
      html+='<button class="slot" data-i="'+i+'"><span class="k">'+(i+1)+'</span><span class="n">Amulet</span></button>';   /* filled in by gear.js */
    } else if(s.type==='ranged'){
      var rw=player.ranged, rn=rw ? (typeof gearName==='function' ? gearName(rw) : rw.name) : 'no bow';
      html+='<button class="slot hasico" data-i="'+i+'" data-ico="'+((rw&&rw.icon)||'')+'"'+(rw?'':' disabled')+' title="Shoot your '+rn.replace(/"/g,'&quot;')+'"><span class="ico"></span>'+
            '<span class="k">'+(i+1)+'</span><span class="n">'+rn+'</span><span class="c">shoot</span></button>';
    } else if(s.type==='swap'){
      var stow=player.sets[1-player.activeSet];
      html+='<button class="slot hasico" data-i="'+i+'" data-ico="ic-swap" title="Draw the stowed weapon (costs a turn)"><span class="ico"></span>'+
            '<span class="k">'+(i+1)+'</span><span class="n">'+(stow?stow.name:'nothing stowed')+'</span><span class="c">weapon swap</span></button>';
    } else {
      var it=s.ref, n=it.n>1 ? ' &times;'+it.n : '';
      html+='<button class="slot hasico" data-i="'+i+'" data-bagico="1" title="'+it.name+'"><span class="ico"></span>'+
            '<span class="k">'+(i+1)+'</span><span class="n">'+it.name+n+'</span><span class="c">'+it.kind+'</span></button>';
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
      dropTarget(b, function(tag){
        var bi=bagIndexFromTag(tag);
        if(bi>=0 && player.bag[bi]) hotbarPut(idx, {type:'item', ref:player.bag[bi]});
        else if(tag==='ranged') hotbarPut(idx, {type:'ranged'});
        else if(tag==='weapons') hotbarPut(idx, {type:'swap'});
        else if(tag==='amulet') hotbarPut(idx, {type:'amulet'});
        else if(tag.indexOf('abil:')===0) hotbarPut(idx, {type:'ability', key:tag.slice(5)});
        else if(tag.indexOf('pray:')===0) hotbarPut(idx, {type:'prayer', key:tag.slice(5)});
        else if(tag.indexOf('hot:')===0){ var from=+tag.slice(4); if(from!==idx){ var t=player.hotbar[idx]; player.hotbar[idx]=player.hotbar[from]; player.hotbar[from]=t; abilityBar(); } }
      });
    })(btns[i]);
  }
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
  }
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
  fresh.forEach(function(id){ for(var k in PASSIVES) PASSIVES[k].forEach(function(p){ if(p.id===id){ log('<b>New passive: '+p.name+'</b> &mdash; '+p.d,'c-kill'); sfx('new-ability'); } }); });
  updateUI(); refreshSheet();
}
function panes(){
  if(openSheet==='Faith'){
    $('mFaith').innerHTML=faithHTML();
    /* 2026-09-20: paint the god's own statue at the top of the sheet */
    var fart=$('mFaith').querySelector('.faith-art');
    if(fart && player.god && GODS[player.god]) paintArt(fart, 'structures', GODS[player.god].sprite, 96);
    $('mFaith').querySelectorAll('.prayer').forEach(function(b){ b.onclick=function(){ var pid=b.getAttribute('data-p'); showSheet('Faith'); usePrayer(pid); updateUI(); }; });
    $('mFaith').querySelectorAll('.abrow[data-pr]').forEach(function(row){
      var pid=row.getAttribute('data-pr'), ic=row.querySelector('.pico');
      if(ic) paintArt(ic, objArt('icons',prayerIcon(pid)) ? 'icons' : 'icons', prayerIcon(pid), 28);
      if(godRank()>=PRAYERS[pid].rank){ row.classList.add('dragp'); dragSource(row, 'pray:'+pid); row.title='Drag onto the hotbar'; }
    });
    return;
  }
  if(openSheet!=='Char' && openSheet!=='Equip') return;
  if(openSheet==='Char'){
    var pips=Object.keys(player.aff).map(function(e){
      var n=player.aff[e], dots='';
      for(var i=0;i<5;i++) dots+='<span class="pip" style="'+(i<n?'background:'+AFF_COL[e]+';border-color:'+AFF_COL[e]:'')+'"></span>';
      return '<div class="aff"><span class="nm">'+cap(e)+'</span><span class="pips">'+dots+'</span><span style="color:var(--dim)">'+n+'</span></div>'+
             '<div class="abrow" style="border:0;padding:0 0 4px"><span></span><span class="d" style="color:var(--dim);font-size:11px">T1: '+T1_TEXT[e]+'</span><span></span></div>';
    }).join('') || '<div class="c-info" style="font-size:11.5px">None yet. Carry a mote to the Elemental Forge (floor '+RUN.forgeFloor+').</div>';
    $('mChar').innerHTML='<div class="cols">'+
      '<div><h2 class="head">'+player.name+'</h2><div class="who">'+player.who+' &middot; Level '+player.level+
        (player.points?' &middot; <span style="color:var(--gold)">'+player.points+' unspent</span>':'')+'</div>'+
        '<p class="sub">Attributes</p><div class="grid4">'+
        statBox('Might',player.stats.mig,'mig')+statBox('Agility',player.stats.agi,'agi')+statBox('Vitality',player.stats.vit,'vit')+statBox('Focus',player.stats.foc,'foc')+'</div>'+
        '<p class="sub" style="margin-top:10px">Affinity ('+totalAffinity()+' / '+affinityCap()+')</p>'+pips+
        '<p class="sub" style="margin-top:10px">Race &amp; class</p><div style="font-size:11px;color:var(--ash);line-height:1.45">'+RACES[player.race].blurb+'<br>'+CLASSES[player.cls].passive+'</div></div>'+
      '<div><p class="sub">Derived</p>'+kv([['HP',Math.round(player.hp)+' / '+player.maxhp],['Mana',Math.floor(player.mp)+' / '+player.maxmp],['Accuracy',player.acc],['Evasion',player.eva],['Armor',player.armor],
        ['Block',Math.round(player.block*100)+'%'],['Parry',Math.round(player.parry*100)+'%'],['Weapon damage',player.dmg[0]+'&ndash;'+player.dmg[1]],['Crit',Math.round(player.crit*100)+'%'],
        ['Spell power','&times;'+spellPower({}).toFixed(2)],['Range',player.range],['Speed',Math.round(player.speed)],['XP',player.xp+' / '+player.xpNext]])+'</div>'+
      '<div><p class="sub">Passives</p>'+passiveList()+'</div>'+
      '<div><p class="sub">Abilities</p>'+(player.abilities.map(function(k,i){
          var A=ABILITIES[k];
          return '<div class="abrow" data-ab="'+k+'" draggable="true"><span class="k">'+(i+1)+'</span><span><span style="color:var(--ink)">'+A.name+
                 '</span><div class="d">'+A.desc+'</div></span><span style="color:var(--ice)">'+costOf(A)+'</span></div>';
        }).join('') || '<div class="c-info" style="font-size:11.5px">No active abilities.</div>')+'</div></div>';
    var abEls=$('mChar').querySelectorAll('.abrow[data-ab]');
    for(var ai2=0; ai2<abEls.length; ai2++) dragSource(abEls[ai2], 'abil:'+abEls[ai2].getAttribute('data-ab'));
    return;
  }
  /* equipment */
  var w=player.weapon, ar=player.armorItem||ARMORS.robe, of=player.off||EMPTY_OFF;
  var stow=player.sets[1-player.activeSet];
  var el=w.enchant;
  var doll='<div class="doll">'+
    eslot('Main hand', gearName(w), player.dmg[0]+'&ndash;'+player.dmg[1]+' dmg'+(player.twoHanded?' &middot; two-handed':'')+(w.note?' &middot; '+w.note:''), el, 'main')+
    '<div class="dollart" id="dollArt"></div>'+
    eslot('Off hand', player.twoHanded ? 'Empty' : gearName(of), player.twoHanded ? 'both hands on the '+w.name : (of.note||''), of.enchant, 'off')+
    eslot('Armor', gearName(ar), player.armor+' armor total'+(ar.note?' &middot; '+ar.note:''), ar.enchant, 'armor')+
    trinketSlots()+'</div>'+
    '<p class="sub" style="margin-top:10px">Stowed set <span style="color:var(--dim)">(click to draw it)</span></p>'+
    '<div id="stowSlot">'+eslot('Swap to', stow?gearName(stow):null, stow?stow.dmg[0]+'&ndash;'+stow.dmg[1]+' dmg'+(stow.range?' &middot; range '+stow.range:''):'', stow&&stow.enchant)+'</div>';
  var cells=player.bag.map(function(it,idx){
    var act = it.kind==='weapon'?'equip':it.kind==='armor'?'wear':it.kind==='off'?'take up':it.kind==='food'?'eat':'use';
    return '<div class="cell" data-b="'+idx+'" draggable="true" title="'+it.name+' - click to '+act+', right-click to drop, drag to the hotbar">'+(it.n>1?'<b>'+it.n+'</b>':'')+'</div>'; });
  while(cells.length<BAG_MAX) cells.push('<div class="cell empty"></div>');
  var motes=ELEMENTS.filter(function(m){ return player.motes[m]>0; }).map(function(m){
    return '<span class="mote"><span class="mart" data-mote="'+m+'"></span>'+m+' &times;'+player.motes[m]+'</span>'; }).join('');
  $('mEquip').innerHTML='<div class="equip"><div><p class="sub">Worn</p>'+doll+'</div><div>'+
    '<p class="sub">Bag ('+player.bag.length+' / '+BAG_MAX+')</p><div class="invgrid">'+cells.join('')+'</div>'+
    '<p class="sub" style="margin-top:10px">Pouch &middot; '+player.essence+' essence'+(player.keys.iron?' &middot; '+player.keys.iron+' iron key':'')+'</p>'+
    '<div class="pouch">'+(motes||'<span class="mote">no motes yet</span>')+'</div></div></div>';
  if(typeof paintDoll==='function') paintDoll($('dollArt'),150); else paintArt($('dollArt'),'cast',player.look,150);
  $('mEquip').querySelectorAll('[data-mote]').forEach(function(e){ paintArt(e,'items','mote-'+e.getAttribute('data-mote'),16); });
  var cellEls=$('mEquip').querySelectorAll('.cell[data-b]');
  for(var ci=0;ci<cellEls.length;ci++){
    (function(cel){
      var bi=+cel.getAttribute('data-b'), it=player.bag[bi];
      cel.style.cursor='pointer';
      var nm=iconNameForBag(it); cel.appendChild(iconCanvas(nm, 38, it.icon||'?'));
      cel.onclick=function(){ hideCard(); useBagItem(bi); refreshSheet(); };
      cel.oncontextmenu=function(ev){ ev.preventDefault(); hideCard(); dropBagItem(bi); updateUI(); refreshSheet(); };
      hoverCard(cel, function(){ return bagCard(player.bag[bi]); });
      dragSource(cel, 'bag:'+bi);
    })(cellEls[ci]);
  }
  var slotEls=$('mEquip').querySelectorAll('.eslot');
  if(slotEls[0]) hoverCard(slotEls[0], function(){ return weaponCard(player.weapon, true); });
  if(slotEls[1]) hoverCard(slotEls[1], function(){ return '<div class="nm">'+gearName(player.off||EMPTY_OFF)+'</div>'+
    (player.block?'<div class="row"><span>Your block</span><b>'+Math.round(player.block*100)+'%</b></div>':'')+
    (player.parry?'<div class="row"><span>Your parry</span><b>'+Math.round(player.parry*100)+'%</b></div>':'')+
    '<div class="hint">'+((player.off||{}).note||'')+'</div>'; });
  if(slotEls[2]) hoverCard(slotEls[2], function(){ return armorCard(player.armorItem, true); });
  $('mEquip').querySelectorAll('.eslot[data-tr]').forEach(function(ts){
    var key=ts.getAttribute('data-tr'), get=function(){ return key==='amulet' ? player.amulet : (player.rings||[])[key==='ring0'?0:1]; };
    hoverCard(ts, function(){ var it=get(); return it ? trinketCard(it) : '<div class="nm">'+(key==='amulet'?'Amulet':'Ring')+'</div><div class="hint">'+(key==='amulet'?'Activated from the hotbar, then recharges.':'Works passively while worn.')+' Drag one here from your bag.</div>'; });
    ts.style.cursor='pointer';
    ts.onclick=function(){ if(!get()) return; hideCard(); if(key==='amulet') takeOffAmulet(); else takeOffRing(key==='ring0'?0:1); updateUI(); refreshSheet(); };
    dropTarget(ts, function(tag){ var bi=bagIndexFromTag(tag); if(bi<0) return; hideCard(); equipFromBag(bi, key); updateUI(); refreshSheet(); });
    if(key==='amulet' && player.amulet) dragSource(ts, 'amulet');   /* drag the worn amulet onto a hotbar slot */
  });
  var stowEl=$('stowSlot');
  if(stowEl && stow){ hoverCard(stowEl, function(){ return weaponCard(player.sets[1-player.activeSet]); });
    stowEl.style.cursor='pointer'; stowEl.title='Draw this weapon (costs a turn)'; stowEl.onclick=function(){ hideCard(); swapWeapon(); refreshSheet(); }; }
  var wslot=$('mEquip').querySelector('.eslot');
  if(wslot){ wslot.style.cursor='grab'; dragSource(wslot, 'weapons'); }
  $('mEquip').querySelectorAll('.eslot[data-eq]').forEach(function(eq){
    var key=eq.getAttribute('data-eq');
    dropTarget(eq, function(tag){ var bi=bagIndexFromTag(tag); if(bi<0) return; hideCard(); equipFromBag(bi, key); updateUI(); refreshSheet(); });
  });
}
function weaponCard(w, worn){
  if(!w) return '';
  var plus=itemPlus(w);
  /* 2026-09-20: an unidentified piece gives nothing away - not its damage, not its enchantment. That is the
     whole point of carrying it into a fight (or reading a Sigil of Knowledge). */
  if(w.unid) return '<div class="nm">'+gearName(w)+'</div>'+
    '<div class="row"><span>Damage</span><b>?</b></div>'+
    '<div class="row"><span>Hands</span><b>'+(w.hands||1)+'</b></div>'+
    (w.range?'<div class="row"><span>Range</span><b>'+(w.range+(player.rangeBonus||0))+'</b></div>':'')+
    (typeof unidHint==='function' ? unidHint(w) : '')+
    '<div class="hint">'+(worn?'':'click to equip')+'</div>';
  return '<div class="nm">'+gearName(w)+'</div>'+
    '<div class="row"><span>Damage</span><b>'+(w.dmg[0]+plus)+'&ndash;'+(w.dmg[1]+plus)+'</b></div>'+
    '<div class="row"><span>Accuracy</span><b>'+(w.acc>=0?'+':'')+(w.acc||0)+'</b></div>'+
    '<div class="row"><span>Hands</span><b>'+(w.hands||1)+'</b></div>'+
    (w.range?'<div class="row"><span>Range</span><b>'+(w.range+(player.rangeBonus||0))+'</b></div>':'')+
    (w.enchant?'<div class="row"><span>Enchant</span><b style="color:'+AFF_COL[w.enchant]+'">'+cap(w.enchant)+'</b></div><div class="hint">'+(typeof enchantLive==='function' ? enchantLive('weapon', w.enchant) : ENCHANT_TEXT.weapon[w.enchant])+'</div>':'')+
    (w.divine?'<div class="row"><span>Invoke &amp; prayer strength</span><b>+'+Math.round(w.divine*100)+'%</b></div>':'')+
    (w.divine?'<div class="row"><span>Beneficial prayer duration</span><b>+'+((w.plus||0)>=3?2:1)+' turns</b></div>':'')+
    '<div class="hint">'+(w.note||'')+(worn?'':' &middot; click to equip')+'</div>';
}
function armorCard(a, worn){
  if(!a) return '';
  if(a.unid) return '<div class="nm">'+gearName(a)+'</div>'+
    '<div class="row"><span>Armor</span><b>?</b></div>'+
    (typeof unidHint==='function' ? unidHint(a) : '')+
    '<div class="hint">'+(worn?'':'click to equip')+'</div>';
  return '<div class="nm">'+gearName(a)+'</div>'+
    '<div class="row"><span>Armor</span><b>'+(a.armor+(a.armor>0?itemPlus(a):0))+'</b></div>'+
    '<div class="row"><span>Evasion</span><b>'+((a.eva||0)>=0?'+':'')+(a.eva||0)+'</b></div>'+
    (a.enchant?'<div class="row"><span>Enchant</span><b style="color:'+AFF_COL[a.enchant]+'">'+cap(a.enchant)+'</b></div><div class="hint">'+(typeof enchantLive==='function' ? enchantLive('armor', a.enchant) : ENCHANT_TEXT.armor[a.enchant])+'</div>':'')+
    '<div class="hint">'+(a.note||'')+'</div>';
}
function bagCard(it){
  if(!it) return '';
  if(it.kind==='weapon') return weaponCard(it.data);
  if(it.kind==='armor') return armorCard(it.data);
  if(it.kind==='off') return it.data.weapon?weaponCard(it.data)+'<div class="hint">Off-hand strike: 60% damage.</div>':'<div class="nm">'+gearName(it.data)+'</div><div class="hint">'+(it.data.note||'')+'</div>';
  if(it.kind==='sigil'){ var k=sigilKnown[it.data.use]; return '<div class="nm">'+it.name+'</div><div class="hint">'+(k?SIGILS[it.data.use].desc:'Unidentified. Use it to learn what it does.')+'</div>'; }
  if(it.kind==='food'){ var f=FOODS[it.data.food]; return '<div class="nm">'+f.name+'</div><div class="hint">'+(f.desc ? f.desc+' Also eases hunger.' : 'Eat to stave off hunger'+(f.heal?' and heal a little':'')+'.')+'</div>'; }
  return '<div class="nm">'+it.name+'</div>';
}

/* ---------------------------------------------------------------- inspect */
var TILE_NAMES = {0:'Wall',1:'Floor',2:'Closed door',3:'Stairs down',4:'Chest',5:'Elemental Forge',6:'Rubble',7:'Open door',8:'Chasm',9:'Locked iron door',
  10:'Shrine',11:'Ice-sealed door',12:'Thorn-choked doorway',13:'The gate onward',14:'Spiked door',15:'Wall',16:'Shallow water',17:'Bridge',18:'Sealed door',
  19:'Stairs up',20:'Portal'};
var TILE_HINTS = {5:'Bump it to fuse motes, enchant gear or craft sigils.',9:'Needs this floor\'s iron key.',10:'Bump it to learn about the god.',11:'Fire melts it. Blows crack it slowly.',
  12:'Fire clears it; pushing through hurts.',14:'Costs half your current HP to pass. Real treasure behind.',16:'Slows you. Puts out fire. Lightning hurts more here.',
  8:'A sheer drop. Float across or find a bridge.',18:'Opened by a mechanism nearby.',3:'Step on it to descend.',13:'Opens when the floor boss falls.',
  19:'Step on it to climb back to the floor above.',20:'Step in to cross into the plane beyond. Its guardian holds a treasure grotto.'};
function inspectHTML(mx,my){
  if(!inb(mx,my) || !(revealAll||seen[idxOf(mx,my)])) return '';
  var e=ents.filter(function(o){ return o.x===mx && o.y===my && o!==player; })[0];
  if(e && e.parent) e=e.parent;   /* a big elite's other cells report the creature itself, not its proxy */
  if(e && (revealAll||vis[idxOf(mx,my)])){
    if(e.ally) return '<div class="nm">'+e.name+'</div><div class="row"><span>HP</span><b>'+Math.max(0,e.hp)+' / '+e.maxhp+'</b></div><div class="hint">Fights for you.</div>';
    var ch=Math.round(hitChance(player.acc,e.base.eva)*100), back=Math.round(hitChance(e.base.acc,player.eva)*100);
    var lo=Math.max(1,Math.round(player.dmg[0]-Math.min(armorOf(e),player.dmg[0]*0.5))), hi=Math.max(1,Math.round(player.dmg[1]-Math.min(armorOf(e),player.dmg[1]*0.5)));
    var st=Object.keys(e.st).filter(function(k){ return k.indexOf('imm_')!==0; }).map(function(k){ return '<span class="tag t-'+k+'">'+k+'</span>'; }).join(' ');
    return '<div class="nm">'+e.name+'</div>'+
      '<div class="row"><span>HP</span><b>'+Math.max(0,e.hp)+' / '+e.maxhp+'</b></div>'+
      '<div class="row"><span>Armor &middot; Evasion</span><b>'+armorOf(e)+' &middot; '+e.base.eva+'</b></div>'+
      (e.base.el?'<div class="row"><span>Element</span><b style="color:'+AFF_COL[e.base.el]+'">'+cap(e.base.el)+'</b></div>':'')+
      '<div class="row"><span>State</span><b>'+(e.st.stun?'knocked out':e.st.frozen?'frozen':e.state==='throne'?'on his throne':e.state)+'</b></div>'+
      (e.keyholder?'<div class="row"><span>Carries</span><b>an iron key</b></div>':'')+
      (st?'<div style="margin-top:4px">'+st+'</div>':'')+
      '<div class="odds">You hit <em>'+ch+'%</em> for '+lo+'&ndash;'+hi+'. It hits you <em>'+back+'%</em>.</div>';
  }
  var it=items.filter(function(i){ return i.x===mx && i.y===my; })[0];
  if(it){
    if(it.kind==='weapon') return weaponCard(it.it);
    if(it.kind==='armor') return armorCard(it.it);
    if(it.kind==='off') return bagCard({kind:'off',data:it.it});
    return '<div class="nm">'+cap(itemLabel(it))+'</div><div class="hint">'+(it.kind==='sigil'&&!sigilKnown[it.use]?'Unidentified sigil.':it.kind==='mote'?'Fuse, enchant or craft with it at the Forge.':'')+'</div>';
  }
  var p=propAt(mx,my);
  if(p){
    var pn=({'urn-group':'urns','stack-group':p.kinds && p.kinds.indexOf('pot')>=0 && p.kinds.indexOf('crate')<0 ? 'pots' : 'crates and barrels','urn-shattered':'broken urn','urn-tall':'urn','urn-squat':'urn','urn-ornate':'urn'})[p.name] || p.name.replace(/-/g,' ');
    var hint = p.ex ? 'Explodes when broken or burned.' : p.br ? 'Breakable. Might hold something.' : p.lever ? 'A lever. Pull it.' : p.tablet ? 'A broken tablet. Read it.' :
      p.altar ? 'A sacrifice altar. Offer blood for rewards.' : p.prisoner ? 'Something is locked inside.' : p.name==='elemental-lock' ? 'Wants a '+p.element+' mote.' : p.drink ? 'Drink from it.' :
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
  var tileHint=t===EXIT ? 'Opens when '+bossNameForFloor()+' falls.' : TILE_HINTS[t];
  return '<div class="nm">'+label+'</div>'+
    (tileHint?'<div class="hint">'+tileHint+'</div>':'')+
    '<div class="row"><span>'+(vis[idxOf(mx,my)]?'In sight':'From memory')+'</span><b>'+mx+','+my+'</b></div>';
}

/* ---------------------------------------------------------------- keys */
window.addEventListener('keydown', function(ev){
  var tgt=ev.target.tagName;
  if(tgt==='INPUT'||tgt==='SELECT'||tgt==='TEXTAREA') return;
  if($('create') && $('create').classList.contains('on')) { ev.stopImmediatePropagation(); return; }
  if(modalOpen){
    if(ev.key==='Escape'){ closeModal(); }
    else if(ev.key==='Enter'){ var pri=document.querySelector('#mFoot .primary'); if(pri) pri.click(); }
    ev.stopImmediatePropagation(); ev.preventDefault(); return;
  }
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
function rest(){
  if(ents.some(function(e){ return e.foe && vis[idxOf(e.x,e.y)]; })){ log('You cannot rest with enemies in sight.','c-info'); return; }
  var n=0; log('You rest...','c-info');
  (function step(){
    if(n++>=150 || player.hp<=0) return;
    if(player.hp>=player.maxhp && player.mp>=player.maxmp){ log('Rested.','c-good'); return; }
    if(ents.some(function(e){ return e.foe && vis[idxOf(e.x,e.y)]; })){ log('Something approaches! You stop resting.','c-you'); return; }
    if(player.hunger<300 && n>1){ log('You are too hungry to rest well.','c-info'); return; }
    if(typeof searchAround==='function') searchAround(true, true); else endTurn();   /* resting searches at half chance */
    if(n%10===0) setTimeout(step, 0); else step();
  })();
}
