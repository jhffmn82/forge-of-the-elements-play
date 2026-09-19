/* mapview.js - Sandbox map mode (2026-09-19).
   For looking at level design: monsters stand still and cannot hurt you, the fog of war is off, a depth picker
   jumps to any floor (1 to the last built floor) or an elemental plane, Reroll lays the same floor out again,
   and clicking a tile moves you straight there.
   A run that has used map mode never saves - it cannot overwrite anyone's autosave or slots. */
var MAPVIEW = {on:false};

function mapviewSetOn(on){
  MAPVIEW.on=on;
  if(on && RUN) RUN.mapViewed=true;
  revealAll=on ? true : revealAll;
  var b=$('bMapMode'); if(b) b.textContent='Map mode: '+(on?'on':'off');
  var rv=$('bReveal'); if(rv) rv.textContent = revealAll ? 'Reveal: on' : 'Reveal: off';
  log(on ? '<b>Map mode.</b> Monsters stand still, you cannot be hurt, the fog is off. Click a tile to go there. This run will not be saved.'
         : 'Map mode off. (This run still will not be saved.)', 'c-info');
  if(typeof computeFOV==='function') computeFOV();
  draw(); updateUI();
}
function mapviewGo(reroll){
  if(!player || !RUN) return;
  if(!MAPVIEW.on) mapviewSetOn(true);
  var v=$('mvDepth') ? $('mvDepth').value : String(floorNo);
  var seed=(Date.now() ^ Math.floor(Math.random()*1e9))>>>0;
  if(!reroll && MAPVIEW.last===v && MAPVIEW.seed) seed=MAPVIEW.seed;
  MAPVIEW.last=v; MAPVIEW.seed=seed;
  if(/^plane:/.test(v)){
    var el=v.slice(6);
    if(typeof buildPlaneFloor!=='function' || typeof PLANE_ROSTER==='undefined' || !PLANE_ROSTER[el]){ log('That plane is not built yet.','c-info'); return; }
    floorNo=Math.max(6, Math.min(10, floorNo));   /* planes hang off the Crypt */
    buildPlaneFloor(el, seed);
  } else {
    floorNo=parseInt(v,10)||1; worldSeed=seed; generate(worldSeed);
  }
  player._lx=undefined; revealAll=true;
  if(typeof floorIntro==='function') floorIntro();
  computeFOV(); resize(); updateUI(); draw();
  log('<b>Map mode:</b> '+(/^plane:/.test(v) ? 'the '+v.slice(6)+' plane' : 'floor '+floorNo+' ('+(BIOME_NAMES[bidx()]||'')+')')+'.','c-info');
}

/* the controls, added to the Sandbox sheet */
(function(){
  function mount(){
    var rv=$('bReveal'); if(!rv || $('bMapMode')) return !!rv;
    var field=rv.closest('.field');
    var opts=''; for(var f=1; f<=(typeof LAST_FLOOR!=='undefined'?LAST_FLOOR:10); f++){ var b=Math.floor((f-1)/5); opts+='<option value="'+f+'">Floor '+f+' &middot; '+(BIOME_NAMES[b]||'')+'</option>'; }
    ['light','shadow','earth'].forEach(function(el){ opts+='<option value="plane:'+el+'">Plane of '+el.charAt(0).toUpperCase()+el.slice(1)+'</option>'; });
    field.insertAdjacentHTML('afterend', '<div class="field"><label>Map mode</label><button id="bMapMode">Map mode: off</button></div>'+
      '<div class="field"><label for="mvDepth">Depth</label><select id="mvDepth">'+opts+'</select> <button id="bMvGo">Go</button> <button id="bMvReroll">Reroll</button></div>');
    $('bMapMode').onclick=function(){ mapviewSetOn(!MAPVIEW.on); };
    $('bMvGo').onclick=function(){ mapviewGo(false); };
    $('bMvReroll').onclick=function(){ mapviewGo(true); };
    return true;
  }
  var n=0, t=setInterval(function(){ if(mount() || ++n>300) clearInterval(t); }, 200);
})();

/* monsters stand still */
var _aiActMapview = aiAct;
aiAct = function(e){ if(MAPVIEW.on){ e.t += (typeof actCost==='function' ? actCost(e) : 100); return; } return _aiActMapview(e); };
/* you cannot be hurt */
var _applyDamageMapview = applyDamage;
applyDamage = function(e, n, type, src){ if(MAPVIEW.on && e===player) return 0; return _applyDamageMapview.apply(this, arguments); };
/* never save a map-mode run */
var _writeSlotMapview = writeSlot;
writeSlot = function(){ if(RUN && RUN.mapViewed) return false; return _writeSlotMapview.apply(this, arguments); };
/* click a tile to go there (travel.js owns map clicks; this answers first while map mode is on) */
var _handleMapClickMapview = handleMapClick;
handleMapClick = function(ev){
  if(!MAPVIEW.on || !player) return _handleMapClickMapview(ev);
  var p=tileAt(ev), x=p.x, y=p.y; if(!inb(x,y)) return true;
  var spot = (walkable(x,y) && !occupied(x,y)) ? {x:x,y:y} : nearFree(x,y,2);
  if(spot){ player.x=spot.x; player.y=spot.y; player._lx=undefined; player._mt=null; computeFOV(); draw(); }
  return true;
};
