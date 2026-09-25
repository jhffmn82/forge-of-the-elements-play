/* Shared runtime foundation: random/geometry helpers, initial state, field of view,
   motion, canvas sizing, tooltips, drag-and-drop, and browser input. Gameplay
   commands, content tables, generation, and rendering are owned by their modules. */

/* ============ helpers ============ */
var $ = function(id){ return document.getElementById(id); };
var clamp = function(v,a,b){ return Math.max(a, Math.min(b, v)); };
function mulberry32(a){ var next=function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };next.state=function(){return a>>>0;};return next; }
var rng = mulberry32(48213);
function ri(a,b){ return a + Math.floor(rng()*(b-a+1)); }
function pick(arr){ return arr[Math.floor(rng()*arr.length)]; }
function entitySize(e){return FoteGeometry.bodySize(e);}
function entityOccupies(e,x,y){return FoteGeometry.bodyContains(e,x,y);}
function entityPoint(e,toward){return FoteGeometry.bodyPoint(e,toward);}
function entityIntersects(e,tiles){return FoteGeometry.bodyIntersects(e,tiles);}
function dist(a,b){return FoteGeometry.bodyDistance(a,b);}
function roll(a,b){ return a + Math.floor(rng()*(b-a+1)); }

/* ============ world data ============ */
var MW=56, MH=34, TS=24;   /* floors trimmed from 64x40 on 2026-09-16 */
var WALL=0, FLOOR=1, DOOR=2, STAIRS=3, CHEST=4, FORGE=5, RUBBLE=6, OPEN=7;   /* DOOR is shut, OPEN is a door standing open */
var BIOMES=[
  {name:'Dungeon', wall:'#6F6559', wall2:'#7D7367', floor:'#201C19', floor2:'#262220'},
  {name:'Crypt',   wall:'#6B6673', wall2:'#787381', floor:'#1E1D23', floor2:'#242229'},
  {name:'Caverns', wall:'#6F6350', wall2:'#7C6F5C', floor:'#1F1B16', floor2:'#26211B'}
];
/* floor within the biome, 1-5 */
function biomeIdx(){ return Math.min(BIOMES.length-1, Math.floor((floorNo-1)/5)); }

var EMPTY_OFF={name:'Empty', block:0, note:'nothing in your off hand'};

function hasP(id){ return !!(player.passives && player.passives[id]); }
function recomputePassives(){
  var got=FoteStats.passivesFor(player.stats,PASSIVES);
  var fresh=Object.keys(got).filter(function(id){return !player.passives||!player.passives[id];});
  player.passives=got;
  return fresh;
}

var AFF_COL={fire:'#E2622B',earth:'#7FA05A',shadow:'#8A6FB0',water:'#62A8D8',air:'#E8B44A',light:'#F2E8DC'};

/* ============ state ============ */
var sigilLook={}, sigilKnown={};
var map, seen, vis, feats, items, ents, rooms=[], spawnedExtra=0, nextSpawn=0;
var floorNo=1, turn=0, revealAll=false, worldSeed=48213, nextId=1, lastDir=[1,0];
var aiming=null, hoverX=-1, hoverY=-1;
/* two independent knobs: NUM changes how big numbers look, LETH changes how deadly fights are */
var NUM=1.0, LETH=1.0;
function sHP(v){ return Math.max(1, Math.round(v*NUM)); }
function sDMG(v){ return Math.max(1, Math.round(v*NUM*LETH)); }
var player={ id:0, ch:'@', x:2, y:2, t:0, st:{}, foe:false, build:'dwarf',
             essence:0, motes:{}, bag:[], hidden:0, level:1, xp:0, xpNext:90, points:0, blurCd:0, fortCd:0 };

function at(x,y){ return (x<0||y<0||x>=MW||y>=MH) ? WALL : map[y*MW+x]; }
function setT(x,y,v){ if(x>=0&&y>=0&&x<MW&&y<MH) map[y*MW+x]=v; }
function biome(){ return BIOMES[Math.min(BIOMES.length-1, Math.floor((floorNo-1)/5))]; }

/* ============ generation ============ */
function carveCorridor(ax,ay,bx,by,force){
  var x=ax, y=ay, steps=[], horizFirst=rng()<0.5;
  if(horizFirst){
    while(x!==bx){ x += x<bx?1:-1; steps.push([x,y]); }
    while(y!==by){ y += y<by?1:-1; steps.push([x,y]); }
  } else {
    while(y!==by){ y += y<by?1:-1; steps.push([x,y]); }
    while(x!==bx){ x += x<bx?1:-1; steps.push([x,y]); }
  }
  for(var i=0;i<steps.length;i++){
    var sx=steps[i][0], sy=steps[i][1];
    if(at(sx,sy)!==WALL){ if(!force && i>0) return; continue; }
    setT(sx,sy,FLOOR);
  }
}
function doorSpot(x,y,horizontalWall){
  if(at(x,y)!==FLOOR) return false;
  if(horizontalWall) return at(x-1,y)===WALL && at(x+1,y)===WALL;
  return at(x,y-1)===WALL && at(x,y+1)===WALL;
}

/* ============ field of view ============ */


/* ============ effects: floating numbers and flying bolts ============ */
var fx=[];
var DMG_COL={phys:'#F2E8DC', fire:'#E2622B', ice:'#62A8D8', lightning:'#E8B44A',
             poison:'#7FA05A', dark:'#8A6FB0', light:'#FFF1CC', magic:'#C9A8FF', heal:'#7FA05A', miss:'#6E635B'};
var fxClock=0;
function fxAt(dur, hold){          /* each effect starts after the one before it */
  var now=performance.now();
  var t=Math.max(now, fxClock);
  fxClock = t + (hold===undefined ? dur*0.55 : hold);
  return t;
}
function floatText(x,y,text,type,big){
  fx.push({k:'t', x:x, y:y, text:text, col:DMG_COL[type]||DMG_COL.phys,
           big:!!big, t0:fxAt(760,120), dur:760, jitter:(rng()-0.5)*0.4});
}
function lungeFx(e, tx, ty){
  var dur=230;
  fx.push({k:'l', e:e, dx:Math.sign(tx-e.x), dy:Math.sign(ty-e.y), t0:fxAt(dur, dur*0.55), dur:dur});
}
function entOffset(e){
  var now=performance.now(), ox=0, oy=0;
  for(var i=0;i<fx.length;i++){
    var f=fx[i];
    if(f.k!=='l' || f.e!==e) continue;
    var p=(now-f.t0)/f.dur;
    if(p<0 || p>=1) continue;
    var amp=Math.sin(p*Math.PI)*TS*0.42;
    ox += f.dx*amp; oy += f.dy*amp;
  }
  return [ox,oy];
}
var fxIdleFrames=0, lastFrame=0;

/* ============ combat ============ */
function hitChance(acc,eva){ return clamp(acc/(acc+eva), 0.15, 0.95); }

/* ============ player actions ============ */
function cancelAim(){ if(!aiming) return; aiming=null; abilityBar(); draw(); }

/* ============ sprites ============ =======================================
   Every creature and character draws from the packed sheets (art/packed, via assets.js). The sandbox's
   "Block art" button turns that off to show the old coloured blocks.
   2026-09-22: the first PixelLab cut-outs (art/sprites/*.png) were still requested here on every launch
   although nothing had drawn them since the sheets arrived - 17 files the published build does not ship,
   so 17 404s a launch. */
var spriteOn=true;
var OS_REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
var ANIM={ mode:'auto', reduce: OS_REDUCE };
function setMotion(mode){
  ANIM.mode=mode; ANIM.reduce = mode==='off' || (mode==='auto' && OS_REDUCE);
  var b=document.getElementById('bMotion');
  if(b) b.textContent = 'Motion: '+(mode==='auto' ? (OS_REDUCE?'auto (off)':'auto (on)') : mode);
}
function faceOf(dx,dy){
  if(Math.abs(dx)>Math.abs(dy)) return dx<0 ? 'west' : 'east';
  if(dy) return dy<0 ? 'north' : 'south';
  return null;
}
/* ---- motion: tile-to-tile slides, idle breathing, hit flash and shake ---- */
var MOVE_MS=170;
/* Presentation state is renderer-owned. Drawing never writes interpolation fields to actors. */
var MOTION_STATE=new WeakMap();
function motionState(e){
  var s=MOTION_STATE.get(e);
  if(!s || s.floor!==floorMeta){s={x:e.x,y:e.y,fx:e.x,fy:e.y,mt:0,floor:floorMeta};MOTION_STATE.set(e,s);}
  return s;
}
function motionActive(e,now){var s=MOTION_STATE.get(e);return !!(s && s.mt && now-s.mt<(s.dur||MOVE_MS));}
/* how far through its slide a figure is: 1 when it is standing still, below 0 while a slide waits to start */
function slideFrac(e,now){var s=MOTION_STATE.get(e);return (s && s.mt) ? (now-s.mt)/(s.dur||MOVE_MS) : 1;}
function renderPos(e){
  var now=performance.now(),s=motionState(e);
  if(e.x!==s.x || e.y!==s.y){
    var cur=slideAt(e,now),jump=Math.max(Math.abs(e.x-cur.x),Math.abs(e.y-cur.y));
    /* 2026-09-22 (Justin: walking stuttered). A step taken while the last slide is still running continues from
       where the figure is drawn, at a steady pace: the slide lasts in proportion to the distance left and runs
       linear instead of easing to a stop at every tile. A step from rest keeps its ease in and out. */
    var chained=!!(s.mt && now-s.mt<(s.dur||MOVE_MS) && jump<=3);
    s.fx=cur.x;s.fy=cur.y;s.x=e.x;s.y=e.y;s.lin=chained;s.hopHeight=1;
    s.dur=chained?Math.round(MOVE_MS*Math.max(0.5,jump)):MOVE_MS;
    s.mt=(ANIM.reduce || jump>3)?0:(e!==player && typeof fxClock==='number'?Math.max(now,fxClock):now);
  }
  return slideAt(e,now);
}
function slideAt(e,now){
  var s=motionState(e);
  if(!s.mt) return {x:s.x,y:s.y,hop:0};
  var p=(now-s.mt)/(s.dur||MOVE_MS);
  if(p<0) return {x:s.fx,y:s.fy,hop:0};
  if(p>=1){s.mt=0;return {x:s.x,y:s.y,hop:0};}
  var q=s.lin?p:(p<0.5?2*p*p:1-Math.pow(-2*p+2,2)/2);
  return {x:s.fx+(s.x-s.fx)*q,y:s.fy+(s.y-s.fy)*q,hop:Math.sin(p*Math.PI)*(s.hopHeight||1)};
}
function breathOf(e){
  if(ANIM.reduce) return 0;
  var phase=((e.id||0)*2.399)%6.283;
  return 0.06*Math.sin(performance.now()/(e.state==='asleep'?700:380)+phase);
}
function hitP(e){ if(!e._hit) return -1; var p=(performance.now()-e._hit)/220; return (p<0||p>=1) ? -1 : p; }
function flashOf(e){ var p=hitP(e); return p<0 ? 0 : 0.85*(1-p); }
function shakeOf(e){ var p=hitP(e); return (p<0||ANIM.reduce) ? 0 : Math.sin(p*38)*TS*0.06*(1-p); }

/* ============ rendering ============ */
var ZOOM={close:[15,9], normal:[20,12], wide:[26,15]}, zoomKey='normal';
var cv=$('cv'), ctx=cv.getContext('2d'), camX=0, camY=0, viewW=20, viewH=14;
function resize(){
  var box=$('map').getBoundingClientRect();
  var W=Math.max(140, box.width), H=Math.max(110, box.height);
  /* how many tiles we try to show across and down - fewer tiles, bigger tiles */
  var z=ZOOM[zoomKey]||ZOOM.normal;
  /* Opts > Map zoom (options.js) scales that. It lives here, not in a wrapper, because the map's
     ResizeObserver below holds this function itself - a wrapper was skipped whenever a sheet closed. */
  var zm=(typeof MAP_ZOOM_MUL!=='undefined' && MAP_ZOOM_MUL[MAP_ZOOM]) || 1;
  if(zm!==1) z=[Math.max(7, Math.round(z[0]*zm)), Math.max(6, Math.round(z[1]*zm))];
  TS = clamp(Math.floor(Math.min(W/z[0], H/z[1])), 14, 72);
  viewW = clamp(Math.floor(W/TS), 8, MW);
  viewH = clamp(Math.floor(H/TS), 6, MH);
  var dpr=window.devicePixelRatio||1;
  cv.width=viewW*TS*dpr; cv.height=viewH*TS*dpr;
  cv.style.width=(viewW*TS)+'px'; cv.style.height=(viewH*TS)+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.imageSmoothingEnabled=false;
  if(typeof draw==="function") draw();   /* the resize observer can fire before render.js has loaded */
}
var camOX=0, camOY=0;
function atTile(mx,my,fn){
  var px=(mx-camX)*TS, py=(my-camY)*TS;
  if(px<=-TS||py<=-TS||px>viewW*TS+TS||py>viewH*TS+TS) return;
  fn(px,py);
}
function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function glyph(ch,px,py,col){ ctx.fillStyle=col; ctx.font='600 '+Math.round(TS*0.58)+'px "IBM Plex Mono",monospace';
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(ch,px+TS/2,py+TS/2); }
function mark(ch,px,py,col){ ctx.fillStyle=col; ctx.font='600 '+Math.max(8,Math.round(TS*0.36))+'px "IBM Plex Mono",monospace';
  ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillText(ch,px,py); }

/* ---------- hover cards for gear ---------- */
var dtip=null;
function ensureDtip(){
  if(dtip) return dtip;
  dtip=document.createElement('div');
  dtip.id='dtip'; document.body.appendChild(dtip);
  return dtip;
}

function showCard(html, ev){
  var t=ensureDtip();
  t.innerHTML=html; t.style.display='block';
  var x=Math.min(ev.clientX+14, window.innerWidth-t.offsetWidth-10);
  var y=Math.min(ev.clientY+14, window.innerHeight-t.offsetHeight-10);
  t.style.left=Math.max(6,x)+'px'; t.style.top=Math.max(6,y)+'px';
}
function hideCard(){ if(dtip) dtip.style.display='none'; }
function hoverCard(el, htmlFn){
  el.addEventListener('mousemove', function(ev){ showCard(htmlFn(), ev); });
  el.addEventListener('mouseleave', function(ev){
    /* Touch compatibility mouse events must not dismiss an actionable card
       between pointerup and its button click. Outside taps close it explicitly. */
    if(ev.isTrusted&&document.body.classList.contains('touch'))return;
    hideCard();
  });
}

/* ============ interface ============ */
var SHEETS={Char:'Character', Equip:'Equipment', Sand:'Sandbox', Help:'Keys'};
var openSheet=null;
function log(html, cls){
  var d=document.createElement('div'); d.className=cls||'c-info'; d.innerHTML=html;
  var L=$('log'); L.appendChild(d);
  while(L.children.length>90) L.removeChild(L.firstChild);
  L.scrollTop=L.scrollHeight;
}
/* redraw the open sheet in place - showSheet() toggles, so calling it to refresh closed the menu */
/* ---- drag and drop ------------------------------------------------------
   Anything draggable writes a short tag into the payload:
     bag:N     an inventory cell        abil:KEY  an ability off the sheet
     hot:N     a hotbar slot            weapons   the weapon pair          */
function dragSource(el, tag){
  el.setAttribute('draggable','true');
  el.ondragstart=function(ev){ ev.dataTransfer.setData('text/plain', tag); ev.dataTransfer.effectAllowed='move'; };
}
function dropTarget(el, take){
  el.ondragover=function(ev){ ev.preventDefault(); ev.dataTransfer.dropEffect='move'; el.classList.add('over'); };
  el.ondragleave=function(){ el.classList.remove('over'); };
  el.ondrop=function(ev){
    ev.preventDefault(); ev.stopPropagation(); el.classList.remove('over');
    take(ev.dataTransfer.getData('text/plain')||'');
  };
}
function bagIndexFromTag(tag){
  return tag.indexOf('bag:')===0 ? +tag.slice(4) : -1;
}

/* the hotbar is its own list now: abilities land in it automatically, but you
   can drop a bag item or the weapon pair on any slot and rearrange it freely */
function hotbarPut(i, entry){
  for(var j=0;j<8;j++) if(j!==i && player.hotbar[j] && entry &&
      player.hotbar[j].type===entry.type &&
      player.hotbar[j].key===entry.key && player.hotbar[j].ref===entry.ref) player.hotbar[j]=null;
  player.hotbar[i]=entry;
  abilityBar();
}
function kv(pairs){ return '<div class="kv">'+pairs.map(function(p){ return '<span>'+p[0]+'</span><b>'+p[1]+'</b>'; }).join('')+'</div>'; }
function statBox(n,v,key){
  var plus = (player.points>0 && key) ? ' <button class="plus" data-s="'+key+'">+</button>' : '';
  return '<div class="stat"><span>'+n+'</span><b>'+v+plus+'</b></div>';
}
function eslot(label,name,sub,el,key){
  return '<div class="eslot'+(el?' el-'+el:'')+'"'+(key?' data-eq="'+key+'"':'')+'><span class="l">'+label+'</span>'+
    (name?'<span class="v">'+name+'</span>':'<span class="v none">empty</span>')+
    (sub?'<span class="l" style="text-transform:none;letter-spacing:.02em;color:var(--ash)">'+sub+'</span>':'')+'</div>';
}
function passiveList(){
  var names={mig:'Might',agi:'Agility',vit:'Vitality',foc:'Focus'}, out='';
  for(var k in PASSIVES){
    var next=null;
    PASSIVES[k].forEach(function(p){
      if(player.stats[k] >= p.at)
        out += '<div class="abrow"><span class="k">'+p.at+'</span><span><span style="color:var(--ink)">'+p.name+
               '</span><div class="d">'+p.d+'</div></span><span style="color:var(--moss)">on</span></div>';
      else if(!next) next=p;
    });
    if(next) out += '<div class="abrow" style="opacity:.5"><span class="k">'+next.at+'</span><span>'+
      '<span style="color:var(--ash)">'+next.name+'</span><div class="d">needs '+names[k]+' '+next.at+'</div></span>'+
      '<span style="color:var(--dim)">'+(next.at-player.stats[k])+' to go</span></div>';
  }
  return out;
}
function renderPlayerUI(){
  abilityBar(); bars(); panes();
  var pl=document.querySelectorAll('.plus');
  for(var i=0;i<pl.length;i++)
    pl[i].onclick=(function(b){ return function(ev){ ev.stopPropagation(); spendPoint(b.getAttribute('data-s')); }; })(pl[i]);
}

/* tooltip */
var tip=$('tip');
cv.addEventListener('mouseleave', function(){ tip.style.display='none'; hoverX=-1; hoverY=-1; if(aiming) draw(); });
cv.addEventListener('mousemove', function(ev){
  var r=cv.getBoundingClientRect();
  if(!seen || !vis || !map || !player){ tip.style.display='none'; return; }   /* the map can be mid-rebuild */
  var mx=camX+Math.floor((ev.clientX-r.left+camOX)/TS), my=camY+Math.floor((ev.clientY-r.top+camOY)/TS);
  if(mx!==hoverX || my!==hoverY){ hoverX=mx; hoverY=my; if(aiming) draw(); }
  var html=''; try{ html=inspectHTML(mx,my); }catch(err){ html=''; }
  if(!html){ tip.style.display='none'; return; }
  tip.innerHTML=html; tip.style.display='block';
  var box=$('map').getBoundingClientRect();
  var x=Math.min(ev.clientX-box.left+14, box.width-tip.offsetWidth-8);
  var y=Math.min(ev.clientY-box.top+14, box.height-tip.offsetHeight-8);
  tip.style.left=Math.max(6,x)+'px'; tip.style.top=Math.max(6,y)+'px';
});

/* ============ input ============ */
var KEYS={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],
  w:[0,-1],s:[0,1],a:[-1,0],d:[1,0],q:[-1,-1],e:[1,-1],z:[-1,1],c:[1,1]};
window.addEventListener('keydown', function(ev){
  var tgt=ev.target.tagName;
  if(typeof uiOpen==='function'&&uiOpen()&&!openSheet)return;
  if(tgt==='INPUT'||tgt==='SELECT') return;
  var k=ev.key;
  if(k==='Escape'){ if(aiming) cancelAim(); else if(openSheet) showSheet(openSheet); return; }
  if(player.hp<=0 || openSheet) return;
  if(KEYS[k]){ ev.preventDefault();
    if(aiming){ cancelAim(); return; }
    lastDir=KEYS[k]; tryMove(KEYS[k][0],KEYS[k][1]); return; }
  if(k==='.'||k===' '){ ev.preventDefault(); log('You wait.','c-info'); endTurn(); return; }
  if(k==='>'){ if(at(player.x,player.y)===STAIRS) descend(); else log('No stairs here.','c-info'); return; }
  if(k==='g'){ if(grab()) endTurn(); return; }
  if(k==='x'){ swapWeapon(); return; }
  if('12345678'.indexOf(k)>=0) pressSlotIndex(+k-1);
});
var DIRS={1:[-1,1],2:[0,1],3:[1,1],4:[-1,0],6:[1,0],7:[-1,-1],8:[0,-1],9:[1,-1]};
$('dpad').addEventListener('click', function(ev){
  var b=ev.target.closest('button'); if(!b) return;
  var d=b.getAttribute('data-d');
  if(d==='5'){ endTurn(); return; }
  lastDir=DIRS[d]; tryMove(lastDir[0],lastDir[1]);
});
cv.addEventListener('click', function(ev){
  var r=cv.getBoundingClientRect();
  var mx=camX+Math.floor((ev.clientX-r.left+camOX)/TS), my=camY+Math.floor((ev.clientY-r.top+camOY)/TS);
  if(aiming){ castAt(mx,my); return; }
  var foe=foeAt(mx,my);
  if(foe && player.range>1 && dist(player,foe)<=player.range && vis[my*MW+mx]){shootAt(foe,{x:mx,y:my});return;}
  var dx=Math.sign(mx-player.x), dy=Math.sign(my-player.y);
  if(dx||dy){ lastDir=[dx,dy]; tryMove(dx,dy); }
});
cv.addEventListener('contextmenu', function(ev){ if(aiming){ ev.preventDefault(); cancelAim(); } });
$('tabs').addEventListener('click', function(ev){
  var b=ev.target.closest('button[data-p]'); if(!b) return;
  showSheet(b.getAttribute('data-p'));
});
$('close').onclick=function(){ showSheet(openSheet); };
$('shade').addEventListener('click', function(ev){ if(ev.target===$('shade')) showSheet(openSheet); });

$('bReveal').onclick=function(){
  revealAll=!revealAll;
  $('bReveal').textContent = revealAll ? 'Reveal: on' : 'Reveal: off';
  log(revealAll ? 'Map revealed - fog of war is off until you turn it back.' : 'Fog of war back on.','c-info');
  draw();
};
$('zoom').onchange=function(){ zoomKey=this.value; resize(); };

$('bMotion').onclick=function(){
  setMotion(ANIM.mode==='auto' ? (ANIM.reduce?'on':'off') : ANIM.mode==='on' ? 'off' : 'auto');
  log('Motion: '+(ANIM.reduce?'off':'on')+'.','c-info');
};
$('bArt').onclick=function(){ spriteOn=!spriteOn; log(spriteOn?'Sprites on.':'Block art on.','c-info'); draw(); };

$('preset').onchange=function(){ player.build=$('preset').value; newRun(worldSeed); };
$('numScale').onchange=function(){ NUM=parseFloat(this.value); newRun(worldSeed); };
$('lethal').onchange=function(){ LETH=parseFloat(this.value); newRun(worldSeed); };

window.addEventListener('resize', resize);
if(window.ResizeObserver) new ResizeObserver(resize).observe($('map'));

/* ============ boot ============ */
/* boot moved to js/boot.js */
