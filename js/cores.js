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

/* Old saves may have crossed completed biome gates before cores were tracked.
   A carried core at an already-open exit is also treated as absorbed: this is
   the state produced by the Deep Maw burrow before the gate/core rules met. */
function repairCoreProgress(){
  if(!RUN || !player) return false;
  var changed=false, completedBefore=Math.max(0,Math.min(4,Math.floor((floorNo-1)/5)));
  if((RUN.cores||0)<completedBefore){ RUN.cores=completedBefore; changed=true; }
  if(player.core && floorMeta && floorMeta.exitOpen){
    RUN.cores=Math.max(RUN.cores||0, completedBefore+1);
    player.core=null; changed=true;
  }
  return changed;
}

function absorbCoreAtGate(nx, ny){
  var name=player.core; if(!name) return false;
  player.core=null; RUN.cores=(RUN.cores||0)+1; floorMeta.exitOpen=true;
  log('You press the <b>'+name+'</b> into the gate. It drinks the light, and the gate grinds open.','c-kill');
  log('<b>Your affinity cap rises to '+affinityCap()+'.</b> One more element can take root in you.','c-kill');
  sfx('victory'); if(typeof ringFx==='function') ringFx(nx,ny,'#9FD8FF',4); sparkleFx(nx,ny,'light',60);
  computeFOV(); updateUI(); draw(); return true;
}


/* picking it up */


var _itemArtNameCore = itemArtName;
itemArtName = function(it){ return it && it.kind==='core' ? (it.name==='Crypt Core' ? 'item-core-crypt' : 'item-core-dungeon') : _itemArtNameCore(it); };
ITEM_FIT.core = 0.52;

/* the sealed gate takes the core */


/* a line in the Equipment keys list while you carry one */
var _equipHTMLCore = equipHTML;
equipHTML = function(){
  var h=_equipHTMLCore();
  if(!player.core) return h;
  var chip='<span class="mote keychip"><span class="kart" data-kicon="item-core-dungeon"></span>'+player.core+'</span>';
  return h.replace(/(<div class="sec">Keys<\/div><div class="pouch">)(<span class="mote">no keys[^<]*<\/span>)?/, '$1'+chip);
};

/* Named travel and entry stages; ordered by transition-adapter.js. */
function entryCollectCores(){
  var here = items.filter(function(it){ return it.kind==='core' && it.x===player.x && it.y===player.y; });
  here.forEach(function(it){
    removeItem(it); player.core = it.name;
    log('You take up the <b>'+it.name+'</b>. It hums against your ribs. Bring it to the exit gate.','c-kill');
    sfx('pickup-mote'); sparkleFx(player.x, player.y, 'magic', 30);
  });
}

function moveCoreGate(dx,dy){
  var nx=player.x+dx, ny=player.y+dy;
  if(at(nx,ny)===EXIT && player.core){
    var wasOpen=!!floorMeta.exitOpen;
    absorbCoreAtGate(nx,ny);
    if(!wasOpen){ endTurn(); return true; }
    /* An already-open burrow absorbs the core and continues downstairs. */
  } else if(at(nx,ny)===EXIT && !floorMeta.exitOpen){
    log('The gate is sealed. It waits for the heart its guardian carried.','c-info'); sfx('door-locked'); return true;
  }
  return false;
}
