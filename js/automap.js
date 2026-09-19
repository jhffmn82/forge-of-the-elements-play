/* =====================================================================
   automap.js - a Diablo-style map overlay (2026-09-17).
   V (rebindable in Options) or the Map button toggles a faded outline of everything you have explored,
   drawn over the game view: walls, doors, stairs, the Forge and shrine, chests, found traps and you.
   It never shows what you have not seen, and a secret door you have not found still draws as wall.
   ===================================================================== */

var AUTOMAP_ON = false;
(function(){
  var st=document.createElement('style');
  st.textContent=[
    '#automap{position:absolute;inset:0;z-index:5;pointer-events:none;display:none}',
    '#automap.on{display:block}',
    '#automapTag{position:absolute;left:10px;bottom:8px;z-index:6;display:none;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#E8D5A8;',
    '  background:rgba(18,14,11,.7);border:1px solid #5A4630;border-radius:4px;padding:2px 8px;pointer-events:none}',
    '#automapTag.on{display:block}',
    '#bMap.on{border-color:var(--gold);color:var(--gold)}'
  ].join('\n');
  document.head.appendChild(st);
  function mount(){
    var map=$('map'); if(!map) return false;
    if(!$('automap')){ var c=document.createElement('canvas'); c.id='automap'; map.appendChild(c); var t=document.createElement('div'); t.id='automapTag'; t.textContent='Map · V to close'; map.appendChild(t); }
    var tb=$('topbtns');
    if(tb && !$('bMap')){ var b=document.createElement('button'); b.id='bMap'; b.textContent='Map'; b.title='Map overlay (V)'; b.onclick=function(){ toggleAutomap(); }; tb.insertBefore(b, tb.firstChild); }
    return !!(tb && $('bMap'));
  }
  if(!mount()){ var n=0, t=setInterval(function(){ if(mount() || ++n>40) clearInterval(t); }, 100); }
})();

function toggleAutomap(force){
  AUTOMAP_ON = force===undefined ? !AUTOMAP_ON : !!force;
  var c=$('automap'), t=$('automapTag'), b=$('bMap');
  if(c) c.classList.toggle('on', AUTOMAP_ON);
  if(t){ t.classList.toggle('on', AUTOMAP_ON); t.textContent='Map · '+(typeof keyLabel==='function' && typeof bindKey==='function' ? keyLabel(bindKey('map')) : 'V')+' to close'; }
  if(b) b.classList.toggle('on', AUTOMAP_ON);
  if(typeof sfx==='function') sfx(AUTOMAP_ON ? 'ui-open' : 'ui-close');
  drawAutomap();
}

function drawAutomap(){
  if(!AUTOMAP_ON || !map || !seen) return;
  var c=$('automap'), host=$('map'); if(!c || !host) return;
  var W=host.clientWidth, H=host.clientHeight, dpr=window.devicePixelRatio||1;
  if(c.width!==Math.round(W*dpr) || c.height!==Math.round(H*dpr)){ c.width=Math.round(W*dpr); c.height=Math.round(H*dpr); c.style.width=W+'px'; c.style.height=H+'px'; }
  var g=c.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
  /* a light veil so the outline reads over the lit dungeon */
  g.fillStyle='rgba(8,6,5,0.38)'; g.fillRect(0,0,W,H);
  var cell=Math.max(3, Math.floor(Math.min((W-40)/MW, (H-40)/MH))), ox=Math.round((W-cell*MW)/2), oy=Math.round((H-cell*MH)/2);
  function known(i){ return revealAll || seen[i]; }
  function wallish(t){ return t===WALL || t===SECRET; }
  var dots=[];
  for(var y=0;y<MH;y++) for(var x=0;x<MW;x++){
    var i=y*MW+x; if(!known(i)) continue;
    var t=map[i], px=ox+x*cell, py=oy+y*cell;
    if(wallish(t)){
      /* only walls that border explored open ground: an outline, not a block */
      var edge=false;
      for(var dy=-1;dy<=1 && !edge;dy++) for(var dx=-1;dx<=1;dx++){ var nx=x+dx, ny=y+dy; if(nx<0||ny<0||nx>=MW||ny>=MH) continue; var j=ny*MW+nx; if(known(j) && !wallish(map[j])){ edge=true; break; } }
      if(edge){ g.fillStyle='rgba(214,196,160,0.62)'; g.fillRect(px,py,cell,cell); }
      continue;
    }
    g.fillStyle = t===WATER ? 'rgba(80,140,190,0.35)' : t===CHASM ? 'rgba(10,8,8,0.6)' : 'rgba(150,135,110,0.16)';
    g.fillRect(px,py,cell,cell);
    if(t===DOOR || t===OPEN || t===LOCKED || t===SEALED || t===ICEDOOR || t===THORNS) dots.push([px,py, t===LOCKED||t===SEALED ? '#C9A0FF' : '#E0874A', 0.8]);
    else if(t===STAIRS || t===EXIT || t===19) dots.push([px,py,'#F2C94C',1]);
    else if(t===FORGE) dots.push([px,py,'#FF7A3A',1]);
    else if(t===SHRINE) dots.push([px,py,'#B79CFF',1]);
    else if(t===CHEST) dots.push([px,py,'#E8B44A',0.7]);
  }
  (feats||[]).forEach(function(f){ if(f.found && known(f.y*MW+f.x)) dots.push([ox+f.x*cell, oy+f.y*cell, '#D0605A', 0.6]); });
  dots.forEach(function(d){ var s=Math.max(2, Math.round(cell*d[3])); g.fillStyle=d[2]; g.fillRect(d[0]+(cell-s)/2, d[1]+(cell-s)/2, s, s); });
  /* allies and seen foes in view, then you */
  (ents||[]).forEach(function(e){ if(e===player || !vis[e.y*MW+e.x]) return; g.fillStyle=e.ally ? '#7FD08A' : '#E0564A'; var s=Math.max(2,Math.round(cell*0.6)); g.fillRect(ox+e.x*cell+(cell-s)/2, oy+e.y*cell+(cell-s)/2, s, s); });
  var pulse = ANIM.reduce ? 1 : 0.75+0.25*Math.sin(performance.now()/220);
  g.fillStyle='rgba(255,255,255,'+pulse.toFixed(2)+')';
  var ps=Math.max(3, Math.round(cell*1.1)); g.fillRect(ox+player.x*cell+(cell-ps)/2, oy+player.y*cell+(cell-ps)/2, ps, ps);
}
var _drawAutomap = draw;
draw = function(){ var r=_drawAutomap.apply(this, arguments); if(AUTOMAP_ON) drawAutomap(); return r; };

window.addEventListener('keydown', function(ev){
  var tgt=ev.target && ev.target.tagName; if(tgt==='INPUT'||tgt==='SELECT'||tgt==='TEXTAREA') return;
  if(ev.key!=='v' && ev.key!=='V') return;
  if(typeof modalOpen!=='undefined' && modalOpen) return;
  if($('title') && $('title').classList.contains('on')) return;
  if($('create') && $('create').classList.contains('on')) return;
  ev.preventDefault(); toggleAutomap();
});
/* Esc closes the overlay first */
window.addEventListener('keydown', function(ev){ if(ev.key==='Escape' && AUTOMAP_ON){ toggleAutomap(false); } });
