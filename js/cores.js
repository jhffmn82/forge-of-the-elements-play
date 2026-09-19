/* =====================================================================
   cores.js - boss cores (2026-09-17).
   A biome's boss drops its core (the Dungeon Core in biome 1). The exit gate stays sealed until you
   bring the core to it: the gate absorbs the core, opens, and your affinity cap rises by 1 for good.
   ===================================================================== */

var CORE_NAMES = ['Dungeon Core', 'Crypt Core', 'Cavern Core', 'Ruin Core', 'Abyss Core'];
function coreName(){ return CORE_NAMES[Math.min(CORE_NAMES.length-1, Math.floor((floorNo-1)/5))]; }

/* the cap counts absorbed cores (an old save whose boss already died counts one) */
affinityCap = function(){
  if(RUN && RUN.cores===undefined) RUN.cores = RUN.bossDead && floorMeta && floorMeta.exitOpen ? 1 : 0;
  return 1 + (RUN ? RUN.cores : 0) + ((RACES[player.race]||{}).capBonus||0);
};

var _bossDefeatedCore = bossDefeated;
bossDefeated = function(e){
  if(RUN.cores===undefined) RUN.cores=0;
  var capBefore = affinityCap();
  var logSaved = log; var skip = /affinity cap rises|The way onward opens/;
  log = function(html, cls){ if(skip.test(html)) return; return logSaved.apply(this, arguments); };
  try{ _bossDefeatedCore(e); } finally { log = logSaved; }
  floorMeta.exitOpen = false;   /* the gate waits for the core */
  var c = nearFree(e.x, e.y, 2) || {x:e.x, y:e.y};
  items.push({x:c.x, y:c.y, kind:'core', name:coreName()});
  log('<b>'+e.base.name+' falls.</b> His <b>'+coreName()+'</b> clatters to the floor, still burning with light. The exit gate will answer to it.','c-kill');
  if(affinityCap()!==capBefore) log('Your affinity cap is now <b>'+affinityCap()+'</b>.','c-kill');
};

/* picking it up */
var _stepOnCore = stepOn;
stepOn = function(){
  var here = items.filter(function(it){ return it.kind==='core' && it.x===player.x && it.y===player.y; });
  here.forEach(function(it){
    removeItem(it); player.core = it.name;
    log('You take up the <b>'+it.name+'</b>. It hums against your ribs. Bring it to the exit gate.','c-kill');
    sfx('pickup-mote'); sparkleFx(player.x, player.y, 'magic', 30);
  });
  return _stepOnCore();
};
var _itemLabelCore = itemLabel;
itemLabel = function(it){ return it && it.kind==='core' ? 'the '+it.name : _itemLabelCore(it); };
var _itemArtNameCore = itemArtName;
itemArtName = function(it){ return it && it.kind==='core' ? (it.name==='Crypt Core' ? 'item-core-crypt' : 'item-core-dungeon') : _itemArtNameCore(it); };
ITEM_FIT.core = 0.52;

/* the sealed gate takes the core */
var _tryMoveCore = tryMove;
tryMove = function(dx, dy){
  var nx=player.x+dx, ny=player.y+dy;
  if(at(nx,ny)===EXIT && !floorMeta.exitOpen){
    if(!player.core){ log('The gate is sealed. It waits for the heart its guardian carried.','c-info'); sfx('door-locked'); return; }
    var name=player.core; player.core=null;
    RUN.cores = (RUN.cores||0) + 1;
    floorMeta.exitOpen = true;
    log('You press the <b>'+name+'</b> into the gate. It drinks the light, and the gate grinds open.','c-kill');
    log('<b>Your affinity cap rises to '+affinityCap()+'.</b> One more element can take root in you.','c-kill');
    sfx('victory'); if(typeof ringFx==='function') ringFx(nx, ny, '#9FD8FF', 4); sparkleFx(nx, ny, 'light', 60);
    computeFOV(); updateUI(); draw(); endTurn();
    return;
  }
  return _tryMoveCore(dx, dy);
};

/* a line in the Equipment keys list while you carry one */
var _equipHTMLCore = equipHTML;
equipHTML = function(){
  var h=_equipHTMLCore();
  if(!player.core) return h;
  var chip='<span class="mote keychip"><span class="kart" data-kicon="item-core-dungeon"></span>'+player.core+'</span>';
  return h.replace(/(<div class="sec">Keys<\/div><div class="pouch">)(<span class="mote">no keys[^<]*<\/span>)?/, '$1'+chip);
};
