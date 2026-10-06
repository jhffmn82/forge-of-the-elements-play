/* =====================================================================
   cavernmobs.js - biome 3, the Caverns (floors 11-15): creatures and the sub-boss. 2026-09-19.
   Creatures (Justin's GPT art, art/map/biome3/monsters2): Storm Beetle, Spark Jelly, Shock Eel, Myconid
   (and its Shroomlings), Crystal Crawler; Root-bound, Basalt Slime and tier-two elementalings.
   Sub-boss: The Deep Maw (floor 15), a burrowing worm. The world (map, chasms, the arena and its burrow
   mounds) is built elsewhere; the contract with it is:
     floorMeta.bossArena = {x, y, w, h, mounds:[{x,y}, ...]}   (each mound: 2x2 set piece 'worm-burrow-closed', top-left x,y)
     spawnDeepMaw(floorMeta.bossArena)                          (defined here)
     caveBossDown()                                             (defined by the world; called here when the Maw dies)
   Everything here keys off the biome index and floorMeta fields, so floors 1-10 never touch it.
   All numbers are first picks for Justin to tune (see the report of 2026-09-19).
   ===================================================================== */


/* ---------------------------------------------------------------- the bestiary */
(function(){
  var M=MONSTERS;
  /* band = absolute floors. Stats are fixed; later biomes use distinct stronger creatures. */
  M.stormbeetle   = {name:'Storm Beetle', sprite:'m-storm-beetle', col:'#3A4A7A', ch:'b', hp:110, dmg:[9,13], acc:64, eva:8, armor:5, speed:100, range:1, xp:40,
                     band:[11,15], w:22, arcs:true, grounded:true, living:true, art:0.95, artLeft:true, sfx:'slime'};
  M.sparkjelly    = {name:'Spark Jelly', sprite:'m-spark-jelly', col:'#8FD8FF', ch:'j', hp:53, dmg:[4,6], acc:66, eva:28, armor:0, speed:100, range:1, xp:36,
                     band:[12,15], w:12, flying:true, erratic:true, stingChain:true, el:'air', glow:'#7FD0FF', living:true, art:0.85, sfx:'bat'};
  M.shockeel      = {name:'Shock Eel', sprite:'m-shock-eel', col:'#3F7A6A', ch:'e', hp:61, dmg:[6,9], acc:66, eva:18, armor:1, speed:100, range:1, xp:40,
                     band:[11,14], w:0, aquatic:true, el:'air', living:true, art:0.95, artLeft:true, sfx:'slime'};   /* w:0 - placed in water by eelPlacement() */
  M.myconid       = {name:'Myconid', sprite:'m-myconid', col:'#7FA8A0', ch:'f', hp:61, dmg:[6,9], acc:60, eva:10, armor:1, speed:100, range:1, xp:38,
                     band:[11,15], w:16, spores:true, sporeproof:true, el:'earth', living:true, spellcaster:true, art:0.95, artLeft:true, sfx:'shaman'};
  M.shroomling    = {name:'Shroomling', sprite:'m-myconid', col:'#9FC0B0', ch:'f', hp:18, dmg:[4,6], acc:58, eva:12, armor:0, speed:100, range:1, xp:6,
                     band:[0,0], w:0, sporeproof:true, living:true, tiny:true, art:0.5, artLeft:true, sfx:'slime'};
  /* 2026-09-28 (Justin): the Deep Maw's brood. A Myconid in every way but its name and its colours (the Maw's own
     earth-brown and bruised pink); only the Maw calls it up, see mawCallTender */
  M.wormtender    = Object.assign({}, M.myconid, {name:'Worm Tender', hp:55, sprite:'m-worm-tender', col:'#A8705A', band:[0,0], w:0,
                     hint:'Summoned by the Deep Maw. Spore clouds poison and slow creatures inside.'});
  M.crystalcrawler= {name:'Crystal Crawler', sprite:'m-crystal-crawler', col:'#8A6AD0', ch:'c', hp:55, dmg:[6,9], acc:68, eva:20, armor:3, speed:130, range:1, xp:38,
                     band:[13,15], w:9, shatters:true, el:'earth', art:0.95, artLeft:true, sfx:'spider'};   /* the Caverns' one fast creature */
  M.rootbound    = {name:'Root-bound', sprite:'m-rootbound', col:'#879567', ch:'r', hp:77, dmg:[8,12], acc:66, eva:8, armor:3, speed:100, range:1, xp:42,
                     band:[11,15], w:8, living:true, spellcaster:true, caveSpell:'root', castCooldown:500, art:.95, sfx:'shaman',
                     hint:'Casts Earth Root, then closes in to strike while the spell recovers.'};
  /* Old save aliases only. Dungeon vermin remain unchanged on floors 1-5. */
  M.caverat       = Object.assign({}, M.rat, {name:'Cave Rat',hp:42,dmg:[6,9],acc:66,eva:24,speed:135,xp:30,art:.85,band:[11,13],w:0});
  M.cavebat       = Object.assign({}, M.bat, {name:'Grotto Bat',hp:33,dmg:[4,6],acc:66,eva:28,speed:130,xp:28,art:.85,band:[11,12], w:0});
  M.caveslime     = Object.assign({}, M.slime, {name:'Basalt Slime',hp:79,dmg:[7,10],acc:62,armor:5,xp:38,art:1,band:[11,15], w:10,
                     hint:'Splits when wounded. Spits roots.'});
  delete M.caverat.biome; delete M.cavebat.biome; delete M.caveslime.biome;
  /* The Deep Maw: tuned by hand for floor 15, so no floor curve (fixed, like the plane elites) */
  M.deepmaw       = {name:'The Deep Maw', sprite:'m-deep-maw', col:'#B07A4A', ch:'W', hp:720, dmg:[24,34], acc:70, eva:0, armor:4, speed:100, range:1, xp:600,
                     band:[15,15], w:0, boss:true, elite:true, big:2, fixed:true, heavy:true, living:true, art:2.0, bigScale:1.5, artLeft:true, sfx:'maw',
                     hint:'Each eruption summons a Worm Tender by a burrow mound. Maximum 1 Tender alive.'};
  M.mawlimb       = {name:'The Deep Maw', sprite:'m-deep-maw', col:'#B07A4A', ch:'W', hp:9999, dmg:[0,0], acc:0, eva:0, armor:4, speed:100, range:0, xp:0,
                     band:[0,0], w:0, object:true, fixed:true, art:0.1};
  DROPS.stormbeetle   = {chance:0.20, table:{essence:10, gear:3, sigil:1}};
  DROPS.sparkjelly    = {chance:0.20, table:{essence:12, sigil:2}};
  DROPS.shockeel      = {chance:0.30, table:{essence:10, food:3, sigil:1}};
  DROPS.myconid       = {chance:0.30, table:{essence:8, food:3, sigil:3}};
  DROPS.shroomling    = {chance:0, table:{essence:1}};
  DROPS.wormtender    = {chance:0, table:{essence:1}};
  DROPS.crystalcrawler= {chance:0.25, table:{essence:14, gear:3}};
  DROPS.rootbound     = {chance:0.25, table:{essence:10, food:2, sigil:2}};
  DROPS.caverat       = DROPS.rat;
  DROPS.cavebat       = DROPS.bat;
  DROPS.caveslime     = DROPS.slime;
  DROPS.deepmaw       = {chance:0, table:{essence:1}};
  DROPS.mawlimb       = {chance:0, table:{essence:1}};
})();

/* Tier-two creature identities. Authored clip geometry lives in ASSETS.mobs. */
var CAVE_ELEMENT_TIERS = [{"old":"emberling","kind":"cinderling","name":"Cinderling","sprite":"m-cinderling","file":"mob-m-cinderling.webp"},{"old":"tideling","kind":"rippleling","name":"Rippleling","sprite":"m-rippleling","file":"mob-m-rippleling.webp"},{"old":"galeling","kind":"gustling","name":"Gustling","sprite":"m-gustling","file":"mob-m-gustling.webp"},{"old":"stoneling","kind":"mossling","name":"Mossling","sprite":"m-mossling","file":"mob-m-mossling.webp"},{"old":"wisp","kind":"duskling","name":"Duskling","sprite":"m-duskling","file":"mob-m-duskling.webp"},{"old":"lumenling","kind":"gleamling","name":"Gleamling","sprite":"m-gleamling","file":"mob-m-gleamling.webp"}];
CAVE_ELEMENT_TIERS.forEach(function(r){
  var old=MONSTERS[r.old];
  MONSTERS[r.kind]=Object.assign({},old,{name:r.name,sprite:r.sprite,hp:r.old==='stoneling'?77:53,dmg:[7,10],acc:old.acc+5,armor:(old.armor||0)+2,xp:55,art:.95,elementTier:2,band:[0,0],w:0});
  DROPS[r.kind]=DROPS[r.old];
});
/* Late-biome members of the same six elemental families. */
var ELEMENTAL_ROOM_KINDS={fire:['emberling','cinderling','pyreling'],water:['tideling','rippleling','tideling3'],air:['galeling','gustling','stormling'],earth:['stoneling','mossling','cragling'],shadow:['wisp','duskling','umbraling'],light:['lumenling','gleamling','dawnling']};
Object.keys(ELEMENTAL_ROOM_KINDS).forEach(function(element){
  var kinds=ELEMENTAL_ROOM_KINDS[element],old=MONSTERS[kinds[0]],second=MONSTERS[kinds[1]],third=kinds[2];
  old.elementTier=1;
  MONSTERS[third]=Object.assign({},second,{name:element==='water'?'Tideling':third[0].toUpperCase()+third.slice(1),sprite:'m-'+(element==='water'?'tideling-tier3':third),hp:element==='earth'?112:78,dmg:[10,14],acc:old.acc+8,armor:(old.armor||0)+3,xp:85,art:1.05,elementTier:3,band:[0,0],w:0});
  DROPS[third]=DROPS[kinds[0]];
  var effect={fire:'Burning',water:'Chill',air:'Stun',earth:'Poison',light:'Blind',shadow:'Fear'}[element];
  kinds.forEach(function(kind){MONSTERS[kind].elementalProcChance=.30;MONSTERS[kind].hint='30% chance to inflict '+effect+' on a landed attack.';});
});

/* special rooms and fallbacks ask for Dungeon kinds by name; in the Caverns they get Caverns ones */
var CAVE_SWAP = {rat:'rootbound', bat:'rootbound', caverat:'rootbound', cavebat:'rootbound', slime:'caveslime', goblin:'stormbeetle', archer:'sparkjelly', brute:'stormbeetle', shaman:'myconid'};
CAVE_ELEMENT_TIERS.forEach(function(r){CAVE_SWAP[r.old]=r.kind;});

/* Keep wounded health proportional and make old saves and repeated visits safe. */
function applyCavernEnemyTuning(e){
  if(!e||!e.foe||e.ally||!e.base||e.base.object||e.hp<=0||e.cavernHp15Adjusted||floorNo<11||floorNo>15||floorMeta.plane||floorMeta.chaosPreview)return;
  var kinds=['stormbeetle','sparkjelly','shockeel','myconid','sporecaller','shroomling','wormtender','crystalcrawler','rootbound','caveslime','deepmaw'].concat(CAVE_ELEMENT_TIERS.map(function(r){return r.kind;}));
  if(kinds.indexOf(e.kind)<0||!Number.isFinite(e.maxhp)||e.maxhp<=0)return;
  var fraction=e.hp/e.maxhp;e.maxhp=Math.max(1,Math.round(e.maxhp*1.15));e.hp=Math.max(1,Math.min(e.maxhp,Math.round(e.maxhp*fraction)));e.cavernHp15Adjusted=true;
}


/* Older saves stored Dungeon copies and the retired Caverns vermin. Preserve
   damage taken, status and timing when refreshing hostile Caverns residents. */
function refreshCavernResidents(){
  if(!inCaverns())return;
  var residents=ents.slice(),buried=floorMeta.maw&&floorMeta.maw.ent;
  if(buried&&residents.indexOf(buried)<0)residents.push(buried);
  residents.forEach(function(e){
    if(!e.foe||e.ally||e.hp<=0||!e.base)return;
    var appearanceSprite=e.base.sprite,tier=CAVE_ELEMENT_TIERS.filter(function(r){return r.old===e.kind;})[0];
    if(tier){var oldRatio=e.hp/Math.max(1,e.maxhp), newer=MONSTERS[tier.kind];e.kind=tier.kind;e.name=newer.name;e.base=newer;e.maxhp=sHP(newer.hp);e.hp=Math.max(1,Math.ceil(e.maxhp*oldRatio));e.dmg=newer.dmg.map(sDMG);if(e.base.sprite!==appearanceSprite)FoteContent.appearanceChanged(floorMeta);return;}
    var vermin=['rat','bat','caverat','cavebat'].indexOf(e.kind)>=0;
    if(vermin&&(e.owner||e.parent||e.summoned||e.shade))return;
    var kind=vermin?'rootbound':e.kind==='slime'?'caveslime':e.kind;
    if(kind!=='rootbound'&&kind!=='caveslime'&&kind!=='sparkjelly'&&kind!=='deepmaw')return;
    var b=MONSTERS[kind];if(e.base.hp===b.hp&&e.kind===kind)return;
    var ratio=e.hp/Math.max(1,e.maxhp);e.kind=kind;e.base=b;e.dmg=b.dmg.map(sDMG);
    if(vermin){e.ch=b.ch;e.col=b.col;}
    if(!e.small){e.maxhp=sHP(b.hp);e.hp=Math.max(1,Math.ceil(e.maxhp*ratio));e.name=b.name;}
    if(e.base.sprite!==appearanceSprite)FoteContent.appearanceChanged(floorMeta);
  });
  residents.forEach(applyCavernEnemyTuning);
}

/* ---------------------------------------------------------------- helpers */
function caveVis(x,y){ return !!(revealAll || (vis && vis[idxOf(x,y)])); }
/* lightning damage with its float and log line; returns the damage dealt */
function caveZap(t, n, src, why, type){
  if(!t || t.hp<=0) return 0;
  var d=applyDamage(t, n, type||'lightning', src);
  floatText(t.x, t.y, String(d), type||'lightning');
  if(t===player){ if(why) log(why+': '+combatDamageNumber(d,type||'lightning')+'.','c-you'); if(player.hp<=0) kill(player, src); }
  else if(t.hp<=0) kill(t, src && src.foe ? null : src);
  return d;
}
function eelWater(x,y){
  if(!inb(x,y)) return false;
  var t=at(x,y);
  return t===WATER || (typeof DEEPWATER!=='undefined' && t===DEEPWATER) || (typeof DEEP_WATER!=='undefined' && t===DEEP_WATER);
}

/* ---------------------------------------------------------------- damage rules */


/* ---------------------------------------------------------------- attacks: beetle arcs, jelly chains, eel splash */


/* Storm Beetle: its hit sets every Storm Beetle within 3 tiles crackling, and if another one is standing
   next to you the arc jumps into you too: 3-5 lightning, once a turn however many beetles there are
   (2026-09-19 sim: two arcs per hit per beetle was 25 a turn from three beetles on a level 14 fighter).
   Fight them one at a time, or away from each other. */
var BEETLE_ARC = [3,5];
function caveCombatSide(e){return e===player||e.ally?'ally':e.foe?'foe':null;}
function caveOpponents(source,target){var side=caveCombatSide(source),other=caveCombatSide(target);return !!side&&!!other&&side!==other;}
function beetleArc(b){
  if(floorMeta._arcTurn===turn) return;
  var side=caveCombatSide(b);if(!side)return;
  var others=ents.filter(function(o){ return o!==b && o.hp>0 && o.base && o.base.arcs && caveCombatSide(o)===side && dist(o,b)<=3; });
  if(!others.length) return;
  floorMeta._arcTurn=turn;
  others.forEach(function(o){ boltFx(b.x,b.y,o.x,o.y,'lightning'); });
  var opponents=[player].concat(ents.filter(function(o){return o!==player;})).filter(function(o){return o.hp>0&&caveOpponents(b,o);}),near=null,target=null;
  for(var i=0;i<others.length&&!target;i++){target=opponents.find(function(o){return dist(others[i],o)<=1;});if(target)near=others[i];}
  if(near){ boltFx(near.x,near.y,target.x,target.y,'lightning'); caveZap(target, FoteActors.inheritedAbilityDamage(near,sDMG(roll(BEETLE_ARC[0],BEETLE_ARC[1]))), near, 'Beetle Arc'); }
  else if(caveVis(b.x,b.y)) log('Storm Beetles: Arc.','c-info');
  sfx('lightning-hit',{from:b});
}
/* Spark Jelly: the sting jumps to up to two more targets within 2 tiles of whatever it stung */
function jellyChain(j, first){
  if(!caveOpponents(j,first))return;
  var hit=[first], from=first;
  for(var k=0;k<2;k++){
    var nx=ents.filter(function(o){ return hit.indexOf(o)<0 && o!==j && o.hp>0 && o.base && caveOpponents(j,o) && !o.base.object && !o.parent && !o.base.stingChain && dist(o,from)<=2 && caveVis(o.x,o.y); })
               .sort(function(a,z){ return dist(a,from)-dist(z,from); })[0];
    if(!nx) break;
    boltFx(from.x,from.y,nx.x,nx.y,'lightning');
    caveZap(nx, FoteActors.inheritedAbilityDamage(j,sDMG(roll(3,5))), j, nx===player ? 'Spark Jelly chain' : null);
    hit.push(nx); from=nx;
  }
  if(hit.length>1 && caveVis(j.x,j.y)) log('Spark Jelly: '+(hit.length-1)+' chain hits.','c-info');
}

/* ---------------------------------------------------------------- monster turns */
var SHROOM_CAP_EACH = 2, SHROOM_CAP_FLOOR = 6;

/* Myconids and Sporecallers share the same summons, ownership and live caps. */
function sproutShroomlings(e,cells,count,clock){
  var sprouts=[];
  if(e.hp<=0)return sprouts;
  var mine=ents.filter(function(o){return o.hp>0&&o.kind==='shroomling'&&o.owner===e.id;}).length;
  var all=ents.filter(function(o){return o.hp>0&&o.kind==='shroomling';}).length;
  cells=cells.filter(function(c){return inb(c.x,c.y)&&walkable(c.x,c.y)&&at(c.x,c.y)!==CHASM&&!occupied(c.x,c.y);});
  var limit=Math.min(count,SHROOM_CAP_EACH-mine,SHROOM_CAP_FLOOR-all);
  while(sprouts.length<limit&&cells.length){
    var c=cells.length===1?cells[0]:pick(cells);
    cells=cells.filter(function(o){return o.x!==c.x||o.y!==c.y;});
    var s=spawn('shroomling',c.x,c.y);s.state='hunt';s.noLoot=true;s.owner=e.id;s.t=clock===undefined?e.t:clock;applyCavernEnemyTuning(s);
    sparkleFx(c.x,c.y,'poison',16);sprouts.push(s);
  }
  return sprouts;
}

function caveCreatureBehavior(e){
  var b=e.base||{};
  if(b.aquatic && e.state!=='asleep'){eelAct(e);return true;}
  if(e.state==='hunt' && (e.stormCharge || canSeePlayer(e))){
    if(b.caveSpell && caveSpellAct(e,player)) return true;
    if(e.kind==='stormbeetle' && stormBeetleAct(e)) return true;
    if(e.kind==='sparkjelly' && sparkJellyAct(e)) return true;
  }
  if(b.spores && e.state==='hunt' && canSeePlayer(e)){
    if(myconidAct(e)) return true;
  }
  return false;

}

/* Caverns casters share the authored spell, action, projectile and status paths.
   Returning false leaves the normal pursuit/melee behavior its full action. */
function caveSpellAct(e,target){
  var b=e.base||{},A=ABILITIES[b.caveSpell];
  if(e.hp<=0||e.state!=='hunt'&&!(e.ally&&e.shade)||!target||target.hp<=0||!A||A.kind!=='bolt'||
     e.caveSpellReadyAt>worldNow()||dist(e,target)>A.range||!clearShot(e,target))return false;
  e.caveSpellReadyAt=worldNow()+b.castCooldown;
  var tags=['spell','single-target','projectile','ranged'];
  gameActions.run('spell',e,target,{ability:A,tags:tags},function(event){
    if(target.x!==e.x)e.facingLeft=target.x<e.x;
    var sheet=AS.mobs&&AS.mobs[b.sprite];
    setClip(e,sheet&&sheet.clips&&sheet.clips.cast?'cast':'attack');sfx(A.el+'-cast',{from:e});
    boltFx(e.x,e.y,target.x,target.y,A.type==='phys'&&A.el==='earth'?'earth':A.type);
    var chance=hitChance(accOf(e)+10,evaOf(target))*(e.st.blind?.6:1);
    if(target===player)chance=hostileHitChance(chance,true);
    var hit=A.always||(target===player?!combatRoll(1-chance,true):rng()<chance);
    if(!hit){floatText(target.x,target.y,'miss','miss');log(e.name+'\'s '+A.name+' misses.','c-miss');return;}
    event.landed=true;
    event.damage=applyDamage(target,FoteActors.inheritedAbilityDamage(e,sDMG(roll(A.base[0],A.base[1]))),A.type,e,{ability:A,actionId:event.actionId,tags:tags});
    floatText(target.x,target.y,String(event.damage),A.type);
    if(target.hp>0&&A.status)Object.keys(A.status).forEach(function(key){
      gameEffects.apply(target,key,A.status[key],undefined,{sourceAffinity:{}});
    });
    log(combatText(e.name)+': '+combatText(A.name)+' → '+(target===player?'you':combatText(target.name))+': '+combatDamageNumber(event.damage,A.type)+'.',target===player?'c-you':'c-hit');
    if(target.hp<=0)kill(target,e);
  });
  return true;
}

/* A visible wind-up gives one action to leave the beetle's fixed charge lane. */
function stormBeetleAct(e){
  if(!canActorMove(e)){ e.stormCharge=null; return false; }
  if(e.stormCharge){
    if(turn<=e.stormChargeAt){  return true; }
    if(e.hp<=0)return true;var path=e.stormCharge; e.stormCharge=null; e.stormChargeAt=0; e.stormReady=turn+5;
    floorMeta.marks=(floorMeta.marks||[]).filter(function(m){return m.kind!=='storm'+e.id;});
    setClip(e,'attack'); sfx('lightning-cast',{from:e});
    for(var k=0;k<path.length;k++){
      var p=path[k];
      if(!walkable(p.x,p.y) || occupied(p.x,p.y)) break;
      stepEnt(e,p.x-e.x,p.y-e.y);
      if(e.hp<=0 || e.x!==p.x || e.y!==p.y) break;
    }
    if(e.hp>0){
      var cells=tilesWithin(e.x,e.y,0,1).map(function(p){return idxOf(p[0],p[1]);});
      floorMeta.shockClouds=(floorMeta.shockClouds||[]).concat([{cells:cells,until:turn+3}]);
      burst(e.x,e.y,'lightning',24,.06);
      log('<b>Storm Beetle:</b> static field!','c-you');
    }
     return true;
  }
  var d=dist(e,player);
  if(d<2 || d>5 || turn<(e.stormReady||0)) return false;
  var lane=boltPath(e.x,e.y,player.x,player.y), last=lane[lane.length-1];
  if(!last || last.x!==player.x || last.y!==player.y) return false;
  if(e.hp<=0)return true;e.stormCharge=lane.filter(function(p){return p.x!==e.x||p.y!==e.y;}).slice(0,5);
  e.stormChargeAt=turn;
  floorMeta.marks=(floorMeta.marks||[]).concat([{cells:e.stormCharge.map(function(p){return idxOf(p.x,p.y);}),col:'#7FD8FF',until:turn+2,kind:'storm'+e.id}]);
  setClip(e,'attack'); sfx('lightning-cast',{from:e});
  log('<b>Storm Beetle charging:</b> leave its lane!','c-you',{priority:'warning'});
   return true;
}
function sparkJellyAct(e){
  var d=dist(e,player); if(d<=1 || d>5 || turn<(e.sparkReady||0)) return false;
  var path=boltPath(e.x,e.y,player.x,player.y), last=path[path.length-1];
  if(!last || last.x!==player.x || last.y!==player.y) return false;
  if(e.hp<=0)return true;e.sparkReady=turn+3; setClip(e,'attack'); sfx('lightning-cast',{from:e});
  recordHostileAttack(e,player,['attack','spell','ranged']);
  boltFx(e.x,e.y,player.x,player.y,'lightning');
  if(rng()<hostileHitChance(hitChance(accOf(e)+5,evaOf(player)),true)){
    caveZap(player,sDMG(roll(5,8)),e,'Spark Jelly bolt');
  }else{ floatText(player.x,player.y,'miss','miss'); log('Spark Jelly misses.','c-miss'); }
   return true;
}

function turnShockClouds(context){
  if(!floorMeta || !player || player.hp<=0)return;
  floorMeta.shockClouds=(floorMeta.shockClouds||[]).filter(function(c){return turn<c.until;});
  [player].concat(ents.filter(function(e){return e.ally&&e.hp>0;})).forEach(function(e){
    if(!floorMeta.shockClouds.some(function(c){return c.cells.indexOf(idxOf(e.x,e.y))>=0;}))return;
    caveZap(e,sDMG(roll(6,10)),null,e===player?'Static field':null);
    if(e.hp>0 && !e.st.stun && rng()<.25)applyStatus(e,'stun',1);
  });

}

function drawShockCloudTelegraphs(now){
  if(!floorMeta)return;
  ctx.save();
  // The fixed charge lane uses the established ground glow. The resolved
  // field below keeps its blue/white electrical discharges.
  (floorMeta.marks||[]).forEach(function(m){
    if(!/^storm\d+$/.test(m.kind)||turn>=m.until)return;
    drawGroundWarning(m.cells,m.col,now,1);
  });
  (floorMeta.shockClouds||[]).forEach(function(c){
    if(turn>=c.until||!c.cells.length)return;
    // The established warning glow keeps the whole charged footprint readable
    // between discharges. Slower breathing distinguishes residue from a warning.
    drawGroundWarning(c.cells,'#82c9f5',(now||0)*.2,.55);
    drawFieldMist(c.cells,'#badfff',now,.16);
    ctx.lineCap='round';ctx.lineJoin='round';
    c.cells.forEach(function(i,n){
      if(!(revealAll||vis[i])||n%2)return;
      var tick=ANIM.reduce?0:(now||0)+hash2(i,n,821)*620,beat=Math.floor(tick/620),age=(tick%620)/620;
      var x=(i%MW-camX+.28+hash2(i,beat,823)*.44)*TS,y=(Math.floor(i/MW)-camY+.42+hash2(i,beat,827)*.3)*TS;
      var angle=hash2(i,beat,829)*Math.PI*2,dx=Math.cos(angle)*TS*.72,dy=Math.sin(angle)*TS*.4;
      ctx.globalAlpha=ANIM.reduce?.8:.48+.42*Math.pow(1-age,2);
      ctx.beginPath();ctx.moveTo(x-dx*.5,y-dy*.5);ctx.lineTo(x-dx*.12+dy*.2,y-dy*.12-dx*.14);ctx.lineTo(x+dx*.14-dy*.2,y+dy*.14+dx*.12);ctx.lineTo(x+dx*.5,y+dy*.5);
      ctx.moveTo(x+dx*.14-dy*.2,y+dy*.14+dx*.12);ctx.lineTo(x+dx*.08-dy*.35,y+dy*.08+dx*.29);
      ctx.strokeStyle='#5badea';ctx.lineWidth=Math.max(2.5,TS*.055);ctx.globalAlpha*=.4;ctx.stroke();
      ctx.globalAlpha/=.4;ctx.strokeStyle='#e2f6ff';ctx.lineWidth=Math.max(.9,TS*.018);ctx.stroke();
      // The air palette survives only as a few warm pinpricks at the discharge tips.
      if(n%6===0){ctx.globalAlpha*=.45;ctx.fillStyle=TRAIL.lightning.col[2];ctx.beginPath();ctx.arc(x+dx*.5,y+dy*.5,Math.max(.65,TS*.012),0,7);ctx.fill();}
    });
  });ctx.restore();
}

/* Myconid: lobs a spore cloud onto you every few turns (poison, and it slows you while you stand in it),
   and sprouts Shroomlings (two each, six a floor). Up close it just swats. */
function myconidAct(e){
  var d=dist(e,player);
  e.sporeCd=(e.sporeCd===undefined ? 1 : e.sporeCd)-1;
  e.sproutCd=(e.sproutCd===undefined ? 3 : e.sproutCd)-1;
  if(d>=2 && d<=5 && e.sporeCd<=0){   /* it lobs them: close in and it just swats */
    if(e.hp<=0)return true;e.sporeCd=4;
    if(player.x!==e.x)e.facingLeft=player.x<e.x;
    setClip(e,'attack'); sfx('trap-gas',{from:e});
    boltFx(e.x,e.y,player.x,player.y,'poison');
    addCloud(player.x, player.y, 1, 5, sDMG(2+Math.floor(floorNo/4)), 'spores');
    floorMeta.clouds[floorMeta.clouds.length-1].owner=e.id;   /* so the Deep Maw's death can settle its Worm Tenders' clouds */
    log('<b>'+e.base.name+':</b> leave the spores!','c-you',{priority:'warning'});
     return true;
  }
  if(e.sproutCd<=0 && d>1){
    var c=nearFree(player.x,player.y,1);
    if(c&&sproutShroomlings(e,[c],1).length){
      e.sproutCd=6;if(player.x!==e.x)e.facingLeft=player.x<e.x;setClip(e,'attack');
      if(caveVis(e.x,e.y)) log(e.base.name+': Shroomling summoned.','c-info');
       return true;
    }
  }
  return false;
}
/* spores slow: standing in a spore cloud chills you (one stack at a time, it never freezes) */

function turnCaveSpores(context){
  if(!floorMeta || !player || player.hp<=0 || typeof cloudAt!=='function') return;
  var c=cloudAt(idxOf(player.x,player.y));
  /* 2026-09-22 (Justin): spores slow, they do not chill - a real Slowed status through applyStatus, so Unstoppable
     refuses it and it wears its own icon rather than the snowflake */
  if(c && c.src==='spores' && !player.st.slow && !player.st.frozen && !(typeof aff==='function' && aff('earth')>=6)){
    var before=player.st.slow; applyStatus(player,'slow',2); if(player.st.slow && player.st.slow!==before){ player.st.slow.mult=0.8; floatText(player.x,player.y,'slowed','poison'); }   /* 20% slower, about what one chill stack did */
  }

}

/* Shock Eel: lives in water and only moves through it. Mostly under the surface (drawn faint). Every few
   turns it lights up the water around it: the connected water within 4 tiles is marked for one turn, then
   everything standing in it takes lightning (and anything in water is Wet: +50% lightning). */
function eelAct(e){
  if(e.hp<=0)return;
  var see=canSeePlayer(e), d=dist(e,player);
  if(see && e.state!=='hunt'){ e.state='hunt'; e.caughtOff=turn; }
  /* a charge that was marked last turn goes off now */
  if(e.zap){
    var z=e.zap; e.zap=null; floorMeta.marks=(floorMeta.marks||[]).filter(function(m){ return m.kind!=='eel'+e.id; });
    if(turn<=z.at+1){
      setClip(e,'attack'); e._surfT=turn; sfx('lightning-hit',{from:e}); SHAKE=Math.max(SHAKE||0,3);
      z.cells.forEach(function(i){ if(rng()<0.35) burst(i%MW, (i/MW)|0, 'lightning', 5, 0.05); });
      var hitAny=false;
      ents.slice().forEach(function(t){
        if(t===e || !t.base && t!==player) return;
        if(t!==player && (t.base.aquatic || t.base.object || t.parent)) return;
        if(z.cells.indexOf(idxOf(t.x,t.y))<0) return;
        hitAny=true; caveZap(t, roll(e.dmg[0], e.dmg[1]), e, t===player ? 'Shock Eel water' : null);
      });
      if(!hitAny && caveVis(e.x,e.y)) log('Shock Eel: no hits.','c-info');
       return;
    }
  }
  var onLand=!eelWater(e.x,e.y);
  if(e.state==='hunt'){
    if(see && d<=1 && !e.st.fear){ attack(e,player);  return; }
    e.zapCd=(e.zapCd===undefined ? 2 : e.zapCd)-1;
    if(!onLand && e.zapCd<=0 && d<=6){
      var cells=eelField(e, 4);
      var playerIn=see&&cells.indexOf(idxOf(player.x,player.y))>=0;
      var allyIn=ents.some(function(o){ return o.ally && cells.indexOf(idxOf(o.x,o.y))>=0&&FoteEnemyTeamwork.openLine(e,o); });
      if(playerIn || allyIn){
        e.zapCd=5; e.zap={cells:cells, at:turn+1}; e._surfT=turn;
        floorMeta.marks=(floorMeta.marks||[]).concat([{cells:cells, col:'#7FD8FF', until:turn+1, kind:'eel'+e.id}]);
        setClip(e,'attack');
        log('<b>Shock Eel charging:</b> leave the water!','c-you',{priority:'warning'});
         return;
      }
    }
  }
  /* move: only through water; stranded on land, it flops back to the nearest water */
  if(canActorMove(e)){
    var nb=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]], best=null, bd=1e9;
    var goal = e.state==='hunt' ? (see?player:e.lastSeen) : (e.goal || null);
    if(!goal || (e.goal && e.x===e.goal.x && e.y===e.goal.y) || (e.state!=='hunt' && rng()<0.1)){
      var opts=eelField(e, 5); if(opts.length){ var gi=opts[Math.floor(rng()*opts.length)]; e.goal={x:gi%MW, y:(gi/MW)|0}; goal=e.goal; }
    }
    for(var i=0;i<nb.length;i++){
      var nx=e.x+nb[i][0], ny=e.y+nb[i][1];
      if(!eelWater(nx,ny) || occupied(nx,ny)) continue;
      var dd = goal ? Math.max(Math.abs(goal.x-nx), Math.abs(goal.y-ny)) + 0.01*(Math.abs(goal.x-nx)+Math.abs(goal.y-ny)) : rng();
      if(e.st.fear) dd=-dd;
      if(dd<bd){ bd=dd; best={x:nx,y:ny}; }
    }
    var here = goal ? Math.max(Math.abs(goal.x-e.x), Math.abs(goal.y-e.y)) : 1e9;
    if(best && (onLand || bd<here || e.state!=='hunt')){ e.x=best.x; e.y=best.y; }
  }

}
/* the water connected to the eel within r tiles (through water, 8-way) */
function eelField(e, r){
  var out=[], seenW={}, q=[e.x, e.y];
  if(!eelWater(e.x,e.y)) return out;
  seenW[idxOf(e.x,e.y)]=1; out.push(idxOf(e.x,e.y));
  for(var h=0; h<q.length; h+=2){
    var x=q[h], y=q[h+1];
    for(var dy=-1;dy<=1;dy++) for(var dx=-1;dx<=1;dx++){
      var nx=x+dx, ny=y+dy; if(!inb(nx,ny)) continue; var i=idxOf(nx,ny);
      if(seenW[i] || !eelWater(nx,ny) || Math.max(Math.abs(nx-e.x),Math.abs(ny-e.y))>r) continue;
      seenW[i]=1; out.push(i); q.push(nx,ny);
    }
  }
  return out;
}
/* eels go into the floor's pools: one per body of water of 8+ tiles, up to three a floor, never in sight */
function eelPlacement(){
  if(!floorMeta || floorMeta.eelsPlaced || !inCaverns() || floorNo>14 || !map) return;
  floorMeta.eelsPlaced=true;
  var done={}, bodies=[];
  for(var i=0;i<MW*MH;i++){
    var x=i%MW, y=(i/MW)|0; if(done[i] || !eelWater(x,y)) continue;
    var cells=[], q=[i]; done[i]=1;
    while(q.length){ var c=q.pop(); cells.push(c); var cx=c%MW, cy=(c/MW)|0;
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(o){ var nx=cx+o[0], ny=cy+o[1]; if(!inb(nx,ny)) return; var j=idxOf(nx,ny); if(!done[j] && eelWater(nx,ny)){ done[j]=1; q.push(j); } }); }
    if(cells.length>=8) bodies.push(cells);
  }
  bodies.sort(function(a,z){ return z.length-a.length; });
  var placed=0;
  bodies.forEach(function(cells){
    if(placed>=3 || rng()>0.75) return;
    var free=cells.filter(function(c){ var x=c%MW, y=(c/MW)|0; return !(roomAt(x,y)&&(roomAt(x,y).chestAmbush||roomAt(x,y).merchant)) && !occupied(x,y) && !(vis && vis[c]) && !(player && dist(player,{x:x,y:y})<8); });
    if(!free.length) return;
    var c=free[Math.floor(rng()*free.length)], e=spawn('shockeel', c%MW, (c/MW)|0);
    e.state = rng()<0.5 ? 'asleep' : 'wander'; e.t=player ? player.t : 0; placed++;
  });
}


/* ---------------------------------------------------------------- drawing */


/* the Maw stands on its 2x2 block (its entity sits on the top-left tile; planeterrain.js draws base.big
   creatures across their whole footprint) and rises out of the ground when it erupts */
function prepareMawActor(job){
  var e=job.entity;if(!e||e.kind!=='deepmaw')return;
  var px=job.x, py=job.y;
  var now=performance.now(), p=e._rise ? Math.min(1, (now-e._rise)/500) : 1, ease=1-Math.pow(1-p,3);
  var ground=py+TS*2, bob=ANIM.reduce ? 0 : Math.sin(now/260)*TS*0.03;
  ctx.save();
  ctx.beginPath(); ctx.rect(px-TS*3, py-TS*5, TS*8, ground-(py-TS*5)); ctx.clip();
  ctx.translate(0, (1-ease)*TS*2.2 + bob);
  return function(){ctx.restore();};
}

/* ---------------------------------------------------------------- The Deep Maw
   Loop (all per turn, driven from endTurn so it runs while the Maw is out of the world):
     dormant - waits under the arena until you step into it
     under   - one turn below ground, then it picks where to come up and marks it (red):
               a ring around one of the burrow mounds, or a 3x3 on the spot where you are standing
     warn    - two turns later it erupts through the marked tiles and bites everything on them
     up      - it stays out for 3 turns (2 below half health): the window to hit it. It bites anything
               touching it. Then it dives, and the loop starts again.
   Below half health each eruption on you also marks the ring around the nearest mound (flying rubble).
   Each eruption also calls up a Worm Tender beside a burrow mound while fewer than MAW.tenderMax are alive. */
var MAW = {bite:[48,64], biteCap:0.40, rubble:[20,28], warnTurns:2, upTurns:3, upTurnsHurt:2, tenderMax:1};
function spawnDeepMaw(arena){
  if(!arena || !floorMeta) return null;
  var mounds=(arena.mounds||[]).filter(function(m){ return m && inb(m.x,m.y); });
  var sx=mounds.length ? mounds[0].x : arena.x+Math.floor(arena.w/2), sy=mounds.length ? mounds[0].y : arena.y+Math.floor(arena.h/2);
  var e=spawn('deepmaw', sx, sy);
  ents=ents.filter(function(o){ return o!==e; });                 /* it starts underground: out of the world */
  e.state='hunt'; e.elite=true; e.big=true; e.st={};
  applyCavernEnemyTuning(e);
  floorMeta.bossId=e.id;
  floorMeta.maw={phase:'dormant', arena:arena, mounds:mounds, ent:e, limbs:[], n:0, at:0, cells:[], rubble:[]};
  return e;
}
function mawState(){ return floorMeta && floorMeta.maw && floorMeta.maw.phase!=='dead' ? floorMeta.maw : null; }
function mawInArena(M, p, pad){ var a=M.arena; pad=pad||0; return p.x>=a.x-pad && p.y>=a.y-pad && p.x<a.x+a.w+pad && p.y<a.y+a.h+pad; }
function mawRing(m){   /* the walkable tiles around a 2x2 mound */
  var out=[]; for(var y=m.y-1;y<=m.y+2;y++) for(var x=m.x-1;x<=m.x+2;x++){ if(x>=m.x && x<=m.x+1 && y>=m.y && y<=m.y+1) continue; if(inb(x,y) && walkable(x,y)) out.push(idxOf(x,y)); }
  return out;
}
function mawBodyFits(x,y,M){
  for(var yy=y;yy<=y+1;yy++) for(var xx=x;xx<=x+1;xx++){ if(!inb(xx,yy) || !walkable(xx,yy) || !mawInArena(M,{x:xx,y:yy})) return false; }
  return true;
}
function mawNearestMound(M, p){ var best=null, bd=1e9; M.mounds.forEach(function(m){ var d=Math.max(Math.abs(m.x+0.5-p.x), Math.abs(m.y+0.5-p.y)); if(d<bd){ bd=d; best=m; } }); return best; }
function mawPlan(M){
  var e=M.ent, hurt=e.hp<e.maxhp/2, pick3 = M.mounds.length && (M.n===0 || (!hurt && M.n%3===2));
  var target=e.lastSeen&&e.teamSearchUntil>worldNow()?e.lastSeen:null;
  M.rubble=[]; M.site=null;
  if(!pick3&&target){
    /* A 3x3 on the last sighting or footfall; the marked attack never retargets. */
    var cx=target.x, cy=target.y, spots=[];
    [[-1,-1],[0,-1],[-1,0],[0,0]].forEach(function(o){ if(mawBodyFits(cx+o[0], cy+o[1], M)) spots.push({x:cx+o[0], y:cy+o[1]}); });
    if(spots.length){
      var s=spots[Math.floor(rng()*spots.length)], cells=[];
      for(var y=cy-1;y<=cy+1;y++) for(var x=cx-1;x<=cx+1;x++) if(inb(x,y) && walkable(x,y)) cells.push(idxOf(x,y));
      M.site={x:s.x, y:s.y, mound:null}; M.cells=cells;
      if(hurt && M.mounds.length){ var nm=mawNearestMound(M, target); if(nm) M.rubble=mawRing(nm).filter(function(i){ return cells.indexOf(i)<0; }); }
    }
  }
  if(!M.site){
    if(!M.mounds.length){ M.cells=[]; return false; }
    var m=M.n===0&&target ? mawNearestMound(M, target) : M.mounds[Math.floor(rng()*M.mounds.length)];
    M.site={x:m.x, y:m.y, mound:m}; M.cells=mawRing(m);
  }
  floorMeta.marks=(floorMeta.marks||[]).filter(function(k){ return k.kind!=='maw'; })
    .concat([{cells:M.cells.concat(M.rubble), col:'#FF3A2A', until:turn+MAW.warnTurns, kind:'maw'}]);
  M.phase='warn'; M.at=turn+MAW.warnTurns;
  SHAKE=Math.max(SHAKE||0, 4); sfx('trap-gas',{from:M.site});
  var sc=M.site.mound ? {x:M.site.x+0.5, y:M.site.y+0.5} : target;
  burst(Math.round(sc.x), Math.round(sc.y), 'earth', 26, 0.07);
  log('<b>Maw surfacing:</b> leave the red tiles!','c-you',{priority:'warning'});
  return true;
}
function mawErupt(M){
  var e=M.ent, hurt=e.hp<e.maxhp/2;
  floorMeta.marks=(floorMeta.marks||[]).filter(function(k){ return k.kind!=='maw'; });
  SHAKE=10; sfx('explosion',{from:M.site});
  /* the bite */
  ents.slice().forEach(function(t){
    if(t===e || t.parent===e) return;
    var i=idxOf(t.x,t.y), onBite=M.cells.indexOf(i)>=0, onRubble=M.rubble.indexOf(i)>=0;
    if(!onBite && !onRubble) return;
    var raw = onBite ? roll(MAW.bite[0], MAW.bite[1]) : roll(MAW.rubble[0], MAW.rubble[1]);
    if(t===player) raw=Math.min(raw, Math.round(player.maxhp*MAW.biteCap));   /* never a one-shot */
    /* earth, not phys: armour barely matters against a worm the size of a room coming up under you */
    caveZap(t, sDMG(raw), e, t===player ? (onBite ? 'Maw bite' : 'Maw rubble') : null, 'earth');
  });
  M.cells.concat(M.rubble).forEach(function(i){ if(rng()<0.5) burst(i%MW, (i/MW)|0, 'earth', 8, 0.06); });
  if(player.hp<=0) return;
  /* come up */
  var s=M.site;
  if(s.mound){
    var mp=props.filter(function(p){ return p.x===s.mound.x && p.y===s.mound.y && /worm-burrow/.test(p.name); })[0];
    if(mp&&mp.name!=='worm-burrow-open'){mp.name='worm-burrow-open';FoteContent.appearanceChanged(floorMeta);}
  }
  e.x=s.x; e.y=s.y; e._lx=undefined; e._ly=undefined; e.t=player.t; e._rise=performance.now(); e.state='hunt';
  if(ents.indexOf(e)<0) ents.push(e);
  M.limbs=[];
  [[1,0],[0,1],[1,1]].forEach(function(o){
    var l=spawnRaw('mawlimb', s.x+o[0], s.y+o[1]); l.parent=e; l.name=e.name; l.noXp=true; l.state='hunt'; l.t=player.t; M.limbs.push(l);
  });
  /* anything standing where the body comes up is thrown clear */
  ents.slice().forEach(function(t){
    if(t===e || t.parent===e) return;
    if(t.x<s.x || t.x>s.x+1 || t.y<s.y || t.y>s.y+1) return;
    var c=nearFree(t.x,t.y,1) || nearFree(t.x,t.y,2) || nearFree(t.x,t.y,3);
    if(c){ t.x=c.x; t.y=c.y; t._lx=undefined; t._ly=undefined; if(t===player){ log('You are thrown clear.','c-you'); computeFOV(); } }
  });
  ringFx(s.x+1, s.y+1, '#C08A50', 3);
  M.phase='up'; M.at=turn+(hurt ? MAW.upTurnsHurt : MAW.upTurns); M.n++;
  log('<b>Maw exposed.</b> Attack before it dives!','c-you'); sfx('maw-intro',{from:e});
  mawCallTender(M);
}
/* 2026-09-28 (Justin): a Worm Tender climbs out beside a burrow mound (the mound itself is solid) from a random
   mound with a free tile around it. XP and kill effects but no loot (noLoot, like the other summoned adds; Justin 2026-09-28); M.tenders keeps their ids
   so the Maw's death can take them and their Shroomlings with it (death-adapter.js). */
function mawCallTender(M){
  /* only its own brood counts: a Shade of Worm Tender raised by a corrupt kill is the player's, with a new id */
  var brood=M.tenders||[];
  if(ents.filter(function(o){ return brood.indexOf(o.id)>=0 && o.hp>0 && !o.ally; }).length>=MAW.tenderMax) return;
  var free=function(i){ return !occupied(i%MW, (i/MW)|0); }, o=Math.floor(rng()*M.mounds.length);
  for(var k=0;k<M.mounds.length;k++){
    var spots=mawRing(M.mounds[(o+k)%M.mounds.length]).filter(free);
    if(!spots.length) continue;
    var i=spots[Math.floor(rng()*spots.length)], t=spawnRaw('wormtender', i%MW, (i/MW)|0);
    t.state='hunt'; t.noLoot=true;applyCavernEnemyTuning(t); (M.tenders||(M.tenders=[])).push(t.id);
    burst(t.x, t.y, 'earth', 20, 0.06);
    log('<b>Worm Tender summoned!</b>','c-you');
    return;
  }
}
function mawDive(M){
  var e=M.ent;
  ents=ents.filter(function(o){ return o!==e && o.parent!==e; });
  M.limbs=[];
  burst(e.x+0.5|0, e.y+0.5|0, 'earth', 30, 0.08); SHAKE=Math.max(SHAKE||0, 5);
  M.phase='under'; M.at=turn+1;
  log('<b>Maw dives.</b> Watch the floor.','c-info');
}
function mawTick(){
  var M=mawState(); if(!M || !player || player.hp<=0) return;
  var e=M.ent; if(!e) return;
  if(e.hp<=0){ return; }
  if(M.phase==='dormant'){
    if(mawInArena(M, player, 0)){
      M.phase='under'; M.at=turn;
      log('<b>Maw approaching underground.</b>','c-you');
      if(typeof playMusic==='function') playMusic('boss'); SHAKE=6;
    } else return;
  }
  if(M.phase==='under' && turn>=M.at){ if(!mawPlan(M)) M.at=turn+1; return; }
  if(M.phase==='warn'){
    if(turn>=M.at) mawErupt(M);
    else { var c=M.site.mound ? {x:M.site.x, y:M.site.y} : {x:M.site.x, y:M.site.y}; burst(c.x, c.y, 'earth', 10, 0.05); SHAKE=Math.max(SHAKE||0, 3); }
    return;
  }
  if(M.phase==='up' && turn>=M.at) mawDive(M);
}


/* surfaced: it bites whatever is touching it (you first, then your allies) */
function mawTouching(e, o){ return o.x>=e.x-1 && o.x<=e.x+2 && o.y>=e.y-1 && o.y<=e.y+2; }
function mawAct(e){
  if(e.hp<=0)return;var M=mawState();
  if(e.st.stun || e.st.frozen || !M || M.phase!=='up'){  return; }
  var tgt = canSeePlayer(e)&&mawTouching(e, player) ? player : ents.filter(function(o){ return o.ally && o.hp>0 && mawTouching(e,o); })[0];
  if(tgt){ setClip(e,'attack'); attack(e, tgt); }

}

/* Named floor-generation stages; ordered by generation-adapter.js. */
function placeGeneratedCavernEels(seed){eelPlacement();}

/* Named character presentation passes; composed by render-adapter.js. */

function drawCavernActor(job){
  var e=job.entity;if(!e||e===player||!e.kind)return;
  if(e.kind==='mawlimb')return true;
  if(e.kind==='shockeel'&&eelWater(e.x,e.y)&&!revealAll&&(e._surfT===undefined||turn-e._surfT>=2)){
    var options=Object.assign({},job.options||{});options.alpha=(options.alpha===undefined?1:options.alpha)*.42;
    job.options=options;job.y+=TS*.1;
  }
}
