/* =====================================================================
   automap.js - a Diablo-style map overlay (2026-09-17).
   M (rebindable in Options) or the Map button toggles a faded outline of everything you have explored,
   drawn over the game view: walls, doors, stairs, the Forge and shrine, chests, found traps and you.
   It never shows what you have not seen, and a secret door you have not found still draws as wall.
   ===================================================================== */

var AUTOMAP_ON = false, AUTOMAP_RETURN_FOCUS=null;
(function(){
  var st=document.createElement('style');
  st.textContent=[
    '#automap{position:absolute;inset:0;z-index:5;pointer-events:none;display:none}',
    '#automap.on{display:block}',
    '#automapLandmarks{position:absolute;inset:0;z-index:6;pointer-events:none;display:none}',
    '#automapLandmarks.on{display:block}',
    '#automapLandmarks button{position:absolute;box-sizing:border-box;width:36px;height:36px;min-width:0;min-height:0;padding:6px;border:0;border-radius:50%;background:transparent;pointer-events:auto;touch-action:manipulation;cursor:pointer;filter:drop-shadow(0 1px 2px #000)}',
    '#automapLandmarks button:hover,#automapLandmarks button:focus-visible{background:#201a13;outline:1px solid currentColor;outline-offset:-3px}',
    '#automapLandmarks svg{display:block;width:100%;height:100%;overflow:visible;pointer-events:none}',
    '@media(pointer:coarse){#automapLandmarks button{width:44px;height:44px;padding:9px}}',
    '#automapTag{position:absolute;left:10px;bottom:8px;z-index:6;display:none;font-size:calc(11px + var(--ui-mobile-text-add,0px));letter-spacing:.1em;text-transform:uppercase;color:#E8D5A8;',
    '  background:rgba(18,14,11,.7);border:1px solid #5A4630;border-radius:4px;padding:2px 8px;pointer-events:none;max-width:calc(100% - 20px);white-space:nowrap;box-sizing:border-box}',
    '#automapTag.on{display:block}',
    '#bMap.on{border-color:var(--gold);color:var(--gold)}'
  ].join('\n');
  document.head.appendChild(st);
  window.addEventListener('resize',invalidateAutomapLayout);
  function mount(){
    var map=$('map'); if(!map) return false;
    var shortcut=typeof keyLabel==='function'&&typeof bindKey==='function'?keyLabel(bindKey('map')):'M';
    if(!$('automap')){ var c=document.createElement('canvas'); c.id='automap'; map.appendChild(c); var t=document.createElement('div'); t.id='automapTag'; t.textContent=automapHint(); map.appendChild(t); }
    if(!$('automapLandmarks')){var landmarks=document.createElement('div');landmarks.id='automapLandmarks';landmarks.setAttribute('aria-label','Discovered map landmarks');map.appendChild(landmarks);}
    var tb=$('topbtns');
    if(tb && !$('bMap')){ var b=document.createElement('button'); b.id='bMap'; b.textContent='Map'; b.title='Map overlay ('+shortcut+')'; b.onclick=function(){ toggleAutomap(); }; tb.insertBefore(b, tb.firstChild); }
    if($('bMap'))$('bMap').setAttribute('aria-pressed',String(AUTOMAP_ON));
    return !!(tb && $('bMap'));
  }
  if(!mount()){ var n=0, t=setInterval(function(){ if(mount() || ++n>40) clearInterval(t); }, 100); }
})();

function toggleAutomap(force){
  var wasOn=AUTOMAP_ON;
  AUTOMAP_ON = force===undefined ? !AUTOMAP_ON : !!force;
  if(AUTOMAP_ON&&!wasOn){AUTOMAP_RETURN_FOCUS=document.activeElement;AUTOMAP_LAYOUT_DIRTY=true;}
  var c=$('automap'), t=$('automapTag'), b=$('bMap'), landmarks=$('automapLandmarks');
  if(c) c.classList.toggle('on', AUTOMAP_ON);
  if(landmarks)landmarks.classList.toggle('on',AUTOMAP_ON);
  if(t){ t.classList.toggle('on', AUTOMAP_ON); t.textContent=automapHint(); }
  if(b){b.classList.toggle('on', AUTOMAP_ON);b.setAttribute('aria-pressed',String(AUTOMAP_ON));}
  if(typeof sfx==='function') sfx(AUTOMAP_ON ? 'ui-open' : 'ui-close');
  drawAutomap();
  if(AUTOMAP_ON&&!wasOn){var first=landmarks&&landmarks.firstChild;if(first&&first.focus)first.focus({preventScroll:true});}
  else if(!AUTOMAP_ON&&wasOn){
    var restore=AUTOMAP_RETURN_FOCUS&&AUTOMAP_RETURN_FOCUS.isConnected&&AUTOMAP_RETURN_FOCUS!==document.body?AUTOMAP_RETURN_FOCUS:b;
    if(restore&&restore.focus)restore.focus({preventScroll:true});
    var active=document.activeElement;
    if(active&&active.closest&&active.closest('#automapLandmarks')){if(b&&b.focus)b.focus({preventScroll:true});else if(active.blur)active.blur();}
    AUTOMAP_RETURN_FOCUS=null;
  }
}

function automapKnown(i){ return revealAll || seen[i]; }
function automapWall(t){ return t===WALL || t===SECRET; }
function automapWallEdge(x,y){
  for(var dy=-1;dy<=1;dy++) for(var dx=-1;dx<=1;dx++){
    var nx=x+dx, ny=y+dy;
    if(nx<0||ny<0||nx>=MW||ny>=MH) continue;
    var i=ny*MW+nx;
    if(automapKnown(i) && !automapWall(map[i])) return true;
  }
  return false;
}

function automapHint(){return typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches?'Tap a symbol to walk':'Map · select a symbol to walk nearby';}

/* Landmarks share the map's discovery rule. A multi-cell portal is one symbol,
   and its first discovered cell is enough to mark the known object. */
var AUTOMAP_SYMBOLS={
  down:{label:'Stairs down',color:'#F2CF68',path:'M3 19h6v-5h5V9h7 M5 3v7m-3-3 3 3 3-3'},
  up:{label:'Stairs up',color:'#F2CF68',path:'M3 19h6v-5h5V9h7 M5 10V3m-3 3 3-3 3 3'},
  shrine:{label:'Shrine',color:'#CCACFF',path:'M4 20h16M6 17h12M8 17v-5h8v5M5 12h14M12 2l2 4-2 4-2-4z'},
  forge:{label:'Forge',color:'#FFAD63',path:'M3 7h18l-3 5h-5v5h4v3H7v-3h3v-5H6zM7 3l2 2m8-2-2 2'},
  portal:{label:'Portal',color:'#80DDDA',path:'M5 21V10a7 7 0 0 1 14 0v11M3 21h18M14 8c-5-2-7 6-3 8 3 2 6-3 2-4'},
  exit:{label:'Exit',color:'#F2CF68',path:'M5 21V3h13v18M3 21h18M8 6h7v15M12 13h1'}
};
function automapLandmark(x,y,t){
  var kind=t===STAIRS?'down':typeof UPSTAIRS!=='undefined'&&t===UPSTAIRS?'up':t===SHRINE?'shrine':t===FORGE?'forge':typeof PORTAL!=='undefined'&&t===PORTAL?'portal':t===EXIT?'exit':null;
  if(!kind)return null;
  var portal=kind==='portal'&&typeof FoteChaosPreview!=='undefined'&&FoteChaosPreview.atPortal(x,y);
  var p={kind:kind,x:portal?portal.x:x,y:portal?portal.y:y,w:portal?portal.w||1:1,h:portal?portal.h||1:1};
  p.id=kind+':'+p.x+':'+p.y;return p;
}
function automapLandmarkKnown(p){
  for(var y=p.y;y<p.y+p.h;y++)for(var x=p.x;x<p.x+p.w;x++)if(inb(x,y)&&automapKnown(idxOf(x,y)))return true;
  return false;
}
/* Destination clicks only walk. The existing safe destination planner avoids
   traps, hazards and intermediate portals; the ordinary travel owner retains
   its enemy, injury and newly spotted trap stops. No arrival callback uses the
   object or changes floors. */
function automapWalkTo(p){
  if(!AUTOMAP_ON||!player||player.hp<=0||!p||p.floor!==floorMeta||p.map!==map||!automapLandmarkKnown(p)||uiOpen()||RUN.over||RUN.victory||typeof animBusy==='function'&&animBusy())return false;
  stopTravel();if(typeof stopRest==='function')stopRest();
  if(typeof aiming!=='undefined'&&aiming||typeof BOWAIM!=='undefined'&&BOWAIM)cancelAim();
  var near=Math.max(Math.max(p.x-player.x,0,player.x-(p.x+p.w-1)),Math.max(p.y-player.y,0,player.y-(p.y+p.h-1)))<=1;
  if(near){toggleAutomap(false);return true;}
  var path=null;
  if(p.w===1&&p.h===1)path=travelPath(p.x,p.y,true,{destination:p});
  else for(var y=p.y-1;y<=p.y+p.h;y++)for(var x=p.x-1;x<=p.x+p.w;x++){
    if(x>=p.x&&x<p.x+p.w&&y>=p.y&&y<p.y+p.h||!knownTile(x,y)||!exploreWalkable(x,y))continue;
    var route=travelPath(x,y,false,{destination:{x:x,y:y}});
    if(route&&(!path||route.length<path.length))path=route;
  }
  if(!path){log('No safe route to that landmark.','c-info');return false;}
  toggleAutomap(false);startTravel(path);return true;
}
var AUTOMAP_LANDMARK_STATE={floor:null,map:null,key:'',buttons:{},placed:[]};
var AUTOMAP_LAYOUT_DIRTY=true,AUTOMAP_LAYOUT_FRAME=0,AUTOMAP_LAYOUT_OBSERVER=null,AUTOMAP_LAYOUT_WATCHED=[],AUTOMAP_CLASS_OBSERVER=null;
function invalidateAutomapLayout(){
  AUTOMAP_LAYOUT_DIRTY=true;
  if(AUTOMAP_ON&&!AUTOMAP_LAYOUT_FRAME&&typeof requestAnimationFrame==='function')AUTOMAP_LAYOUT_FRAME=requestAnimationFrame(function(){AUTOMAP_LAYOUT_FRAME=0;if(AUTOMAP_ON)drawAutomap();});
}
function automapRectClear(r,W,H,blocked){
  return r.left>=0&&r.top>=0&&r.right<=W&&r.bottom<=H&&blocked.every(function(b){return r.right<=b.left||r.left>=b.right||r.bottom<=b.top||r.top>=b.bottom;});
}
function automapBlockedAreas(W,H){
  var host=$('map'),bounds=host&&host.getBoundingClientRect&&host.getBoundingClientRect(),blocked=[];
  if(!bounds)return blocked;
  if(!AUTOMAP_LAYOUT_OBSERVER&&typeof ResizeObserver==='function')AUTOMAP_LAYOUT_OBSERVER=new ResizeObserver(invalidateAutomapLayout);
  if(!AUTOMAP_CLASS_OBSERVER&&typeof MutationObserver==='function'&&document.body){AUTOMAP_CLASS_OBSERVER=new MutationObserver(invalidateAutomapLayout);AUTOMAP_CLASS_OBSERVER.observe(document.body,{attributes:true,attributeFilter:['class']});}
  /* Read each HUD/control rectangle once per layout change. Idle map animation
     reuses the resulting positions and never measures one rectangle per icon. */
  ['studyHud','studyDepth','studyPortrait','bars','hud2','dpad','hotbar','studyActionBar','studyInventoryIcon','statusbar','studyPickup','studyRecentLog'].forEach(function(id){
    var node=$(id);if(!node||!node.getBoundingClientRect)return;
    if(AUTOMAP_LAYOUT_OBSERVER&&AUTOMAP_LAYOUT_WATCHED.indexOf(node)<0){AUTOMAP_LAYOUT_WATCHED.push(node);AUTOMAP_LAYOUT_OBSERVER.observe(node);}
    if(node.hidden)return;
    var r=node.getBoundingClientRect();if(!r.width||!r.height)return;
    var style=typeof getComputedStyle==='function'?getComputedStyle(node):null;if(style&&(style.display==='none'||style.visibility==='hidden'||style.opacity==='0'))return;
    var b={left:Math.max(0,r.left-bounds.left-4),top:Math.max(0,r.top-bounds.top-4),right:Math.min(W,r.right-bounds.left+4),bottom:Math.min(H,r.bottom-bounds.top+4)};
    if(b.right>b.left&&b.bottom>b.top)blocked.push(b);
  });return blocked;
}
function positionAutomapHint(W,H,blocked){
  var hint=$('automapTag');if(!hint||!hint.getBoundingClientRect)return;
  hint.style.visibility='';hint.textContent=automapHint();
  var r=hint.getBoundingClientRect(),w=r.width,h=r.height;if(!w||!h)return;
  var chosen=null;
  for(var y=H-h-8;y>=8&&!chosen;y-=h+8){
    var xs=[10,W-w-10,(W-w)/2];
    for(var i=0;i<xs.length;i++){
      var box={left:xs[i],top:y,right:xs[i]+w,bottom:y+h};
      if(automapRectClear(box,W,H,blocked)){chosen=box;break;}
    }
  }
  if(!chosen){hint.style.visibility='hidden';return;}
  hint.style.left=chosen.left+'px';hint.style.top=chosen.top+'px';hint.style.bottom='auto';
  blocked.push({left:chosen.left-4,top:chosen.top-4,right:chosen.right+4,bottom:chosen.bottom+4});
}
function automapPlaceLandmarks(points,frame,W,H,size,blocked){
  blocked=blocked||[];
  var placed=[],half=size/2;
  points.forEach(function(p){
    var ax=frame.ox+(p.x+p.w/2)*frame.cell,ay=frame.oy+(p.y+p.h/2)*frame.cell,chosen=null;
    /* Keep touch targets apart; a short leader preserves the exact tile when
       two discovered landmarks sit closer than a finger's width. */
    for(var ring=0;ring<=8&&!chosen;ring++)for(var step=0;step<(ring?8*ring:1);step++){
      var angle=step*Math.PI*2/(8*ring||1),r=ring*(size/2+2);
      var x=Math.max(half,Math.min(W-half,ax+Math.cos(angle)*r)),y=Math.max(half,Math.min(H-half,ay+Math.sin(angle)*r));
      if(automapRectClear({left:x-half,top:y-half,right:x+half,bottom:y+half},W,H,blocked)&&placed.every(function(q){return Math.abs(x-q.cx)>=size+2||Math.abs(y-q.cy)>=size+2;})){chosen={cx:x,cy:y,ax:ax,ay:ay,point:p};break;}
    }
    if(!chosen)for(var yy=half;yy<=H-half&&!chosen;yy+=size+2)for(var xx=half;xx<=W-half;xx+=size+2){
      if(automapRectClear({left:xx-half,top:yy-half,right:xx+half,bottom:yy+half},W,H,blocked)&&placed.every(function(q){return Math.abs(xx-q.cx)>=size+2||Math.abs(yy-q.cy)>=size+2;})){chosen={cx:xx,cy:yy,ax:ax,ay:ay,point:p};break;}
    }
    placed.push(chosen||{cx:ax,cy:ay,ax:ax,ay:ay,point:p});
  });return placed;
}
function syncAutomapLandmarks(points,frame,W,H,g){
  var host=$('automapLandmarks');if(!host)return;
  var size=typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches?44:36;
  var state=AUTOMAP_LANDMARK_STATE,key=[W,H,size,frame.cell,frame.ox,frame.oy].join(':')+'|'+points.map(function(p){return p.id;}).join('|');
  if(AUTOMAP_LAYOUT_DIRTY||state.floor!==floorMeta||state.map!==map||state.key!==key){
    var blocked=automapBlockedAreas(W,H);positionAutomapHint(W,H,blocked);
    AUTOMAP_LAYOUT_DIRTY=false;state.floor=floorMeta;state.map=map;state.key=key;state.placed=automapPlaceLandmarks(points,frame,W,H,size,blocked);
    var kept={};
    state.placed.forEach(function(at){
      var p=at.point,art=AUTOMAP_SYMBOLS[p.kind],button=state.buttons[p.id];
      if(!button){
        button=document.createElement('button');button.type='button';button.setAttribute('data-game-ui','true');
        button.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="'+art.path+'"/></svg>';
        button.onclick=function(ev){ev.preventDefault();ev.stopPropagation();automapWalkTo(this._landmark);};host.appendChild(button);
      }
      p.floor=floorMeta;p.map=map;button._landmark=p;
      button.setAttribute('aria-label','Walk to '+(p.label||art.label));button.title='Walk to '+(p.label||art.label);
      button.style.color=art.color;button.style.left=(at.cx-size/2)+'px';button.style.top=(at.cy-size/2)+'px';kept[p.id]=button;
    });
    Object.keys(state.buttons).forEach(function(id){if(!kept[id])state.buttons[id].remove();});state.buttons=kept;
  }
  g.save();g.strokeStyle='rgba(235,213,170,.75)';g.lineWidth=1;
  state.placed.forEach(function(p){if(Math.hypot(p.cx-p.ax,p.cy-p.ay)<3)return;g.beginPath();g.moveTo(p.ax,p.ay);g.lineTo(p.cx,p.cy);g.stroke();g.fillStyle='#EBD5AA';g.fillRect(p.ax-1,p.ay-1,2,2);});g.restore();
}
function automapFrame(W,H){
  /* Fit the explored outline into the middle of the view, with smaller tiles. */
  var left=player.x, right=player.x, top=player.y, bottom=player.y;
  for(var y=0;y<MH;y++) for(var x=0;x<MW;x++){
    var i=y*MW+x;
    if(!automapKnown(i) || (automapWall(map[i]) && !automapWallEdge(x,y))) continue;
    left=Math.min(left,x); right=Math.max(right,x); top=Math.min(top,y); bottom=Math.max(bottom,y);
  }
  var cell=Math.min(18,W*.64/(right-left+1),H*.64/(bottom-top+1));
  return {cell:cell,ox:W/2-(left+right+1)*cell/2,oy:H/2-(top+bottom+1)*cell/2,
    bounds:{left:left,top:top,right:right+1,bottom:bottom+1}};
}
function drawBaseAutomap(){
  if(!AUTOMAP_ON || !map || !seen) return;
  var c=$('automap'), host=$('map'); if(!c || !host) return;
  var W=host.clientWidth, H=host.clientHeight, dpr=window.devicePixelRatio||1;
  if(c.width!==Math.round(W*dpr) || c.height!==Math.round(H*dpr)){ c.width=Math.round(W*dpr); c.height=Math.round(H*dpr); c.style.width=W+'px'; c.style.height=H+'px'; }
  var g=c.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
  /* a light veil so the outline reads over the lit dungeon */
  g.fillStyle='rgba(8,6,5,0.38)'; g.fillRect(0,0,W,H);
  var frame=automapFrame(W,H), cell=frame.cell, ox=frame.ox, oy=frame.oy;
  var dots=[],landmarks=[],marked={};
  for(var y=0;y<MH;y++) for(var x=0;x<MW;x++){
    var i=y*MW+x; if(!automapKnown(i)) continue;
    var t=map[i], px=ox+x*cell, py=oy+y*cell;
    if(automapWall(t)){
      /* only walls that border explored open ground: an outline, not a block */
      if(automapWallEdge(x,y)){ g.fillStyle='rgba(214,196,160,0.62)'; g.fillRect(px,py,cell,cell); }
      continue;
    }
    g.fillStyle = t===WATER ? 'rgba(80,140,190,0.35)' : t===CHASM ? 'rgba(10,8,8,0.6)' : 'rgba(150,135,110,0.16)';
    g.fillRect(px,py,cell,cell);
    var landmark=automapLandmark(x,y,t);
    if(landmark&&!marked[landmark.id]){landmarks.push(landmark);marked[landmark.id]=true;}
    if(t===DOOR || t===OPEN || t===LOCKED || t===SEALED || t===ICEDOOR || t===THORNS) dots.push([px,py, t===LOCKED||t===SEALED ? '#C9A0FF' : '#E0874A', 0.8]);
    else if(t===CHEST) dots.push([px,py,'#E8B44A',0.7]);
  }
  (feats||[]).forEach(function(f){ if(f.found && automapKnown(f.y*MW+f.x)) dots.push([ox+f.x*cell, oy+f.y*cell, '#D0605A', 0.6]); });
  dots.forEach(function(d){ var s=Math.max(2, Math.round(cell*d[3])); g.fillStyle=d[2]; g.fillRect(d[0]+(cell-s)/2, d[1]+(cell-s)/2, s, s); });
  /* allies and seen foes in view, then you */
  (ents||[]).forEach(function(e){ if(e===player || !actorVisible(e)) return; g.fillStyle=e.ally ? '#7FD08A' : '#E0564A'; var s=Math.max(2,Math.round(cell*0.6)); g.fillRect(ox+e.x*cell+(cell-s)/2, oy+e.y*cell+(cell-s)/2, s, s); });
  var pulse = ANIM.reduce ? 1 : 0.75+0.25*Math.sin(performance.now()/220);
  g.fillStyle='rgba(255,255,255,'+pulse.toFixed(2)+')';
  var ps=Math.max(3, Math.round(cell*1.1)); g.fillRect(ox+player.x*cell+(cell-ps)/2, oy+player.y*cell+(cell-ps)/2, ps, ps);
  var trueForge=floorMeta&&floorMeta.unmakerPreview&&floorMeta.unmakerPreview.trueForge;
  if(trueForge){var finalForge={id:'forge:final',kind:'forge',label:'Forge of the Elements',x:trueForge.x,y:trueForge.y,w:trueForge.w,h:trueForge.h};if(automapLandmarkKnown(finalForge))landmarks.push(finalForge);}
  syncAutomapLandmarks(landmarks,frame,W,H,g);
  return frame;
}


window.addEventListener('keydown', function(ev){
  var tgt=ev.target && ev.target.tagName; if(tgt==='INPUT'||tgt==='SELECT'||tgt==='TEXTAREA') return;
  if(ev.key!=='m' && ev.key!=='M') return;
  if((typeof modalOpen!=='undefined' && modalOpen) || openSheet) return;
  if($('title') && $('title').classList.contains('on')) return;
  if($('create') && $('create').classList.contains('on')) return;
  ev.preventDefault(); toggleAutomap();
});
/* Esc closes the overlay first */
window.addEventListener('keydown', function(ev){ if(ev.key==='Escape' && AUTOMAP_ON){ toggleAutomap(false); } });
