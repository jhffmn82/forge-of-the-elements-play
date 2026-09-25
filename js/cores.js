/* =====================================================================
   cores.js - boss cores (2026-09-17).
   A biome's boss drops its core (the Dungeon Core in biome 1). The exit gate stays sealed until you
   bring the core to it. Picking up each core raises your affinity cap permanently;
   the gate consumes the carried core only to open the way onward.
   ===================================================================== */

var CORE_NAMES = ['Dungeon Core', 'Crypt Core', 'Cavern Core', 'Ruin Core', 'Abyss Core'];
function coreName(){ return CORE_NAMES[Math.min(CORE_NAMES.length-1, Math.floor((floorNo-1)/5))]; }

/* The cap counts claimed cores; old absorbed-core counts seed the name ledger. */
affinityCap = function(){
  if(RUN && RUN.cores===undefined) RUN.cores = RUN.bossDead && floorMeta && floorMeta.exitOpen ? 1 : 0;
  return 1 + (RUN ? RUN.cores : 0) + ((RACES[player.race]||{}).capBonus||0);
};

function coreClaims(){
  if(!Array.isArray(RUN.coreClaims))RUN.coreClaims=CORE_NAMES.slice(0,Math.max(0,RUN.cores||0));
  return RUN.coreClaims;
}
function claimCore(name,announce){
  if(!RUN||CORE_NAMES.indexOf(name)<0)return false;
  var claims=coreClaims();if(claims.indexOf(name)>=0)return false;
  claims.push(name);RUN.cores=(RUN.cores||0)+1;
  if(announce)log('<b>Your affinity cap rises to '+affinityCap()+'.</b> One more element can take root in you.','c-kill');
  return true;
}

/* Old saves may have crossed completed biome gates before cores were tracked.
   Loading claims carried cores but never consumes them: an earlier floor's open
   gate must not take a later core while the player backtracks to a forge. */
function repairCoreProgress(){
  if(!RUN || !player) return false;
  var changed=false,legacy=!Array.isArray(RUN.coreClaims),completedBefore=Math.max(0,Math.min(4,Math.floor((floorNo-1)/5)));
  if(legacy&&(RUN.cores||0)<completedBefore){RUN.cores=completedBefore;changed=true;}
  coreClaims();
  if(player.core&&claimCore(player.core,false))changed=true;
  return changed;
}

function absorbCoreAtGate(nx, ny){
  var name=player.core;
  if(!name||floorNo%5!==0||floorMeta.plane||name!==coreName())return false;
  claimCore(name,true); // Supports legacy carried cores before the load migration.
  player.core=null; floorMeta.exitOpen=true;
  log('You press the <b>'+name+'</b> into the gate. It drinks the light, and the gate grinds open.','c-kill');
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
    claimCore(it.name,true);
    sfx('pickup-mote'); sparkleFx(player.x, player.y, 'magic', 30);
  });
}

function moveCoreGate(dx,dy){
  var nx=player.x+dx, ny=player.y+dy;
  if(at(nx,ny)===EXIT && player.core){
    var wasOpen=!!floorMeta.exitOpen;
    if(!absorbCoreAtGate(nx,ny)){
      if(wasOpen)return false;
      log('This gate does not answer to the core you carry.','c-info');sfx('door-locked');return true;
    }
    if(!wasOpen){ endTurn(); return true; }
    /* An already-open burrow absorbs the core and continues downstairs. */
  } else if(at(nx,ny)===EXIT && !floorMeta.exitOpen){
    log('The gate is sealed. It waits for the heart its guardian carried.','c-info'); sfx('door-locked'); return true;
  }
  return false;
}
