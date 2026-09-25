function enchantContext(actor){
  actor=actor||player;var rank=actor&&actor.god?pietyRank(actor.piety||0):0;
  return {anvilRank:actor&&actor.god==='anvil'?rank:0,vellumRank:actor&&actor.god==='vellum'?rank:0};
}
function enchantValues(slot,el,actor){actor=actor||player;return FoteEnchantments.values(slot,el,actor&&actor.aff&&actor.aff[el]||0,enchantContext(actor));}
function gearPassiveBonus(){return FoteEnchantments.gearBonus(enchantContext().vellumRank);}
function enchantGodBonus(){return FoteEnchantments.godBonus(enchantContext());}
function orbRootCrit(target){return infusion('orb')==='earth'&&target&&effectHasTag(target,'root')?enchantValues('orb','earth').critChance:0;}
function criticalMultiplier(){return 1.6+(infusion('orb')==='shadow'?enchantValues('orb','shadow').critMultiplier:0);}

/* ============================================================================
   combat.js - character math, damage, statuses, spells, abilities, monster AI.
   Replaces derive(), applyDamage(), attack(), kill(), tickStatus(), castAt(),
   useAbility(), aiAct(), allyAct(), stepEnt() from game.js.
   ========================================================================== */

function livingMountain(p){return p && p.god==='grom' && pietyRank(p.piety||0)>=5;}
function livingMountainStacks(p){var s=p&&p.st&&p.st.livingmountain;return livingMountain(p)&&s&&s.t>0?Math.max(0,Math.min(10,s.n||0)):0;}
function bodyArmor(p){return p.armorItem || {};}

var FISTS = {name:'Fists', dmg:[1,3], acc:5, hands:1, unarmed:true, icon:'ic-iron-body', kind:'weapon'};
function isScoundrel(){ return player.cls==='scoundrel'; }

/* stat passives (mechanics review 2026-09-16, DESIGN.md section 12) */
var PASSIVES={
  mig:[{at:12,id:'heavyHands',name:'Heavy Hands',d:'+10% melee damage'},
       {at:15,id:'crushing',  name:'Crushing Blows',d:'+25% damage to targets below half HP'},
       {at:18,id:'spellWard', name:'Spell Ward',d:'block spells and abilities in addition to melee and ranged attacks. Without a shield (two-handers, dual wield) you block spells and abilities at 25% + 1% per Might above 10, up to 40%'},
       {at:21,id:'cleaving',  name:'Cleaving Swings',d:'your attacks also hit one other adjacent enemy for half'},
       {at:25,id:'unstoppable',name:'Unstoppable',d:'immune to stun, slow and knockback, +20% melee damage'}],
  agi:[{at:12,id:'lightFeet',name:'Light Feet',d:'+8 evasion'},
       {at:15,id:'deadeye',  name:'Deadeye',d:'+8% crit chance'},
       {at:18,id:'fleet',    name:'Fleet',d:'moving costs 15% less time'},
       {at:21,id:'keenAim',  name:'Keen Aim',d:'your attacks ignore 25% of the target\'s evasion'},
       {at:25,id:'blur',     name:'Blur',d:'hostile direct attacks have 20% less chance to hit you (minimum 15%)'}],
  vit:[{at:12,id:'tough',    name:'Tough',d:'+15% max HP'},
       {at:15,id:'resilient',name:'Resilient',d:'HP regeneration doubles below half HP'},
       {at:18,id:'ironConst',name:'Iron Constitution',d:'statuses on you last half as long'},
       {at:21,id:'fortitude',name:'Fortitude',d:'a hit against you is halved (every 15 turns)'},
       {at:25,id:'bulwark',  name:'Bulwark',d:'immune to critical hits; +5% resistance to non-physical damage'}],
  foc:[{at:12,id:'arcaneStudy',name:'Arcane Study',d:'+10% spell damage'},
       {at:15,id:'meditation',name:'Meditation',d:'+25% mana regeneration'},
       {at:18,id:'tidalMind', name:'Tidal Mind',d:'mana regeneration doubles below half mana'},
       {at:21,id:'magicBarrier',name:'Magic Barrier',d:'-5 damage from single-target ranged attacks'},
       {at:25,id:'archmage',  name:'Archmage',d:'+10% spell damage, +5% crit chance, +20% max mana'}]
};
var AOE_HIT=false;   /* set while resolving area attacks, so Magic Barrier ignores them */
function godRank(){ return player.god ? pietyRank(player.piety||0) : 0; }
function adjacentFoes(){ var n=0; ents.forEach(function(e){ if(e.foe && e.hp>0 && dist(e,player)<=1) n++; }); return n; }
function hasGod(id){ return player.god===id; }

function affinityCap(){
  var base = RUN && RUN.bossDead ? 2 : 1;
  return base + ((RACES[player.race]||{}).capBonus||0);
}
function enchantScale(el){return FoteEnchantments.scale(player.aff&&player.aff[el]||0,enchantContext());}
function buff(name){ return player.buffs && player.buffs[name] > 0; }
function itemPlus(it){ return (it && it.plus||0) + (it && it.tier==='Trusty' ? 1 : 0) + (player.race==='dwarf' && it && it.dmg && !it.unarmed ? 1 : 0); }


/* ---------------------------------------------------------------- derived stats */
/* Dual wield (2026-09-17): an off-hand weapon strikes after the main hand for 60% damage, and the proc block
   runs off the OFF-HAND weapon's own enchant, so two differently enchanted daggers give two different procs.
   The cost of the build is the shield slot and steep Agility requirements on daggers. */


function costOf(A){
  var c=A.cost;
  if(player.race==='elf' && !A.tech && !A.divine) c*=0.85;
  if(!A.tech && !A.divine && typeof wandThrift==='function') c*=(1-wandThrift());
  return Math.max(1, Math.round(c*NUM));
}
/* spell-focus items (staves, orbs, wands): the tier sets the base bonus and each upgrade level adds to it.
   A cursed focus turns the base into a penalty, and its negative levels make it worse. */
/* Caster gear has distinct roles (2026-09-16):
   staff - the most spell damage and +1 spell range, and a real weapon, but two-handed
   wand  - a little spell damage; spells cost less mana; the off-hand stays free
   orb   - no damage bonus; spell critical hits (x1.5). A cursed orb is a spell damage penalty instead. */


function focusKey(it){ if(!it) return null; var ic=(it.icon||'').replace(/^item-/,''); return FOCUS_BONUS[ic] ? ic : null; }

function focusBonus(it){
  var k=focusKey(it); if(!k) return (it && it.spell) || 0;
  var F=FOCUS_BONUS[k];
  if(k==='orb') return it.cursed ? -(tierOf(F.curse,it) + F.cursePer*Math.abs(it.plus||0)) : 0;
  return ((it.cursed ? -tierOf(F.base,it) : tierOf(F.base,it)) + F.per*(it.plus||0))*gearPassiveBonus();
}
function wandThrift(){ var w=player.weapon; if(focusKey(w)!=='wand') return 0; var v=tierOf(WAND_THRIFT.base,w)+WAND_THRIFT.per*(w.plus||0); return (w.cursed ? -Math.abs(v) : v)*gearPassiveBonus(); }
function orbCrit(){ var o=player.twoHanded ? null : player.off; if(focusKey(o)!=='orb' || o.cursed) return 0; return (tierOf(ORB_CRIT.base,o)+ORB_CRIT.per*(o.plus||0))*gearPassiveBonus(); }
function staffRange(){ return focusKey(player.weapon)==='staff' ? 1 : 0; }
function spellRange(A){
  if(A.useWeaponRange) return Math.max(1, player.range);
  return A.range ? A.range + (player.rangeBonus||0) + (!A.tech && !A.divine && typeof staffRange==='function' ? staffRange() : 0) : 0;
}
function accOf(e){ return e===player ? player.acc : (e.base.acc + (e.ally?0:0)); }
function evaOf(e){ return e===player ? player.eva : e.base.eva; }
function armorOf(e){ return e===player ? player.armor : Math.max(0, (e.base.armor||0) - (e.st.hollow?e.st.hollow.n:0)); }

/* ---------------------------------------------------------------- damage */

function isWet(e){ return at(e.x,e.y)===WATER || (e.st && e.st.wet); }


function slimeSplit(e){
  e.split=true;
  var c=nearFree(e.x,e.y,1); if(!c) return;
  var half=Math.max(1,Math.floor(e.hp/2)); e.hp-=half;
  var s=spawn(e.kind==='caveslime'?'caveslime':'slime',c.x,c.y); s.hp=s.maxhp=half; s.split=true; s.state='hunt'; s.name=e.kind==='caveslime'?'Basalt Slimelet':'Slimelet'; s.small=true; s.noXp=true;
  log('The slime splits in two!','c-info'); sfx('slime-split');
}

function hitSfx(att, def, crit, blocked){
  if(blocked) return 'block';
  if(crit) return 'hit-crit';
  if(def===player && player.armor>=3) return 'hit-armor';
  if(def!==player && (def.base.armor||0)>=3) return 'hit-armor';
  return 'hit-flesh';
}
var LAST_HIT=null;
/* Light mastery's smite: 3-6 plus one per Light point. Briefly reverted on 2026-09-18 when the Light 6
   Glimmer dagger build looked like a runaway at 150 damage a turn - but that was measured against a
   SKELETON, and skeletons are undead: light damage takes x1.5 against them and Consecration doubles to 18
   a turn. Against living targets the same build is last in the table. The scaling is back. combos.js's
   light-air double smite uses this too. */
function smiteDamage(){ return roll(3,6) + ((player.aff && player.aff.light) || 0); }

function hostileHitChance(ch,projectile){if(projectile&&deflectProjectile())return 0;return hasP('blur') ? Math.max(0.15,ch*0.8) : ch;}


/* ---------------------------------------------------------------- statuses */
/* Hollowing (Shadow 6): n stacks are added, n=0 only refreshes a stack the target already carries - a
   melee shadow build keeps its own Hollow alive by swinging. 5 stacks, 5 turns; each is +5% damage taken
   (elements.js) and -1 armor (armorOf, above). 2026-09-18: this was an empty stub, so every call did
   nothing and a melee shadow build never saw a single stack. */
function addHollow(e, n){
  if(!e || !e.st) return;
  var h=e.st.hollow;
  if(!h && !n) return;
  gameEffects.apply(e,'hollow',5,undefined,{data:{n:Math.min(5,(h?h.n:0)+(n||0))},durationModifiers:false,refresh:'replace'});
}
/* ---------------------------------------------------------------- healing
   2026-09-18: every heal used to be written inline as player.hp = Math.min(maxhp, hp + n), which threw the
   overflow away. Holy Water (light/water) wanted that overflow, so it had been reverse-engineering it by
   intercepting floatText and parsing the "+N" string against a mark updated in endTurn - it worked, but any
   heal that did not draw a float silently skipped the combo. healPlayer() is the single path now: it clamps,
   and it RETURNS the part that did not fit. Callers keep their own float text. */


/* ---------------------------------------------------------------- death */

function burnDmg(){ return sDMG(2 + ((player && player.aff && player.aff.fire)||0)); }   /* Burning: 2 + 1 per Fire point */
function TRAIL_EL(el){ return {fire:'fire',water:'ice',air:'lightning',earth:'earth',light:'light',shadow:'dark'}[el]||'magic'; }
function raiseShade(e){
  var shades=ents.filter(function(o){ return o.ally && o.shade; });
  if(shades.length>=2){ shades.sort(function(a,b){ return a.hp-b.hp; }); ents=ents.filter(function(o){ return o!==shades[0]; }); }
  var s=spawn(e.kind, e.x, e.y);
  s.foe=false; s.ally=true; s.shade=true; s.state='ally'; s.name='Shade of '+e.base.name; s.col='#8A6FB0';
  s.maxhp=s.hp=Math.max(1,Math.round(e.maxhp/2)); s.dmg=[Math.max(1,Math.round(e.dmg[0]/2)), Math.max(1,Math.round(e.dmg[1]/2))];
  log('Its shade rises and serves you.','c-good'); sparkleFx(e.x,e.y,'dark',20);
}


/* ---------------------------------------------------------------- abilities */

function divineStrength(){
  var w=player.weapon||{},o=player.twoHanded?{}:(player.off||{});
  return 1+((w.cursed?0:w.divine||0)+(o.cursed?0:o.divine||0))*gearPassiveBonus();
}
function divineDuration(n){ return n; }


/* targeting: bolts stop at the first creature or wall in the way */
function boltPath(ax,ay,bx,by){
  var pts=[], x=ax, y=ay, dx=Math.abs(bx-ax), dy=Math.abs(by-ay), sx=ax<bx?1:-1, sy=ay<by?1:-1, err=dx-dy;
  var source=ents.find(function(e){return entityOccupies(e,ax,ay);});
  while(!(x===bx && y===by)){
    var e2=2*err; if(e2>-dy){ err-=dy; x+=sx; } if(e2<dx){ err+=dx; y+=sy; }
    pts.push({x:x,y:y});
    if(opaque(x,y) && !(x===bx&&y===by)) break;
    if(occupied(x,y,source) && !(x===bx&&y===by) && !(x===player.x&&y===player.y)) break;
  }
  return pts;
}
/* 2026-09-22 (Justin): a shooter has a clear shot only when nothing stands between it and its target. Enemies do not
   loose a projectile through their own ranks; the player's arrow hits whatever is in front. Clouds and lobbed
   sprays are not projectiles and do not use this. */
function projectileLine(source,target,options){
  options=options||{};var targets=[],origins=[],preferred=options.target;
  for(var y=target.y;y<target.y+entitySize(target);y++)for(var x=target.x;x<target.x+entitySize(target);x++){
    if(options.visible&&!(revealAll||inb(x,y)&&vis[idxOf(x,y)]))continue;
    if(Number.isFinite(options.range)&&dist(source,{x:x,y:y})>options.range)continue;
    targets.push({x:x,y:y});
  }
  targets.sort(function(a,b){var ap=preferred&&a.x===preferred.x&&a.y===preferred.y,bp=preferred&&b.x===preferred.x&&b.y===preferred.y;return (bp?1:0)-(ap?1:0)||dist(a,source)-dist(b,source)||a.y-b.y||a.x-b.x;});
  for(var sy=source.y;sy<source.y+entitySize(source);sy++)for(var sx=source.x;sx<source.x+entitySize(source);sx++)origins.push({x:sx,y:sy});
  for(var i=0;i<targets.length;i++){
    var to=targets[i];origins.sort(function(a,b){return dist(a,to)-dist(b,to)||a.y-b.y||a.x-b.x;});
    for(var j=0;j<origins.length;j++){
      var from=origins[j],path=boltPath(from.x,from.y,to.x,to.y),end=path[path.length-1];
      if(end&&entityOccupies(target,end.x,end.y))return {from:from,to:to,path:path};
    }
  }
  return null;
}
function clearShot(a,b){return !!projectileLine(a,b);}
function previewPath(ax,ay,bx,by,A){
  if(A.kind!=='bolt') return;
  var pts=boltPath(ax,ay,bx,by); ctx.globalAlpha=0.35; ctx.fillStyle='#E8B44A';
  for(var i=0;i<pts.length-1;i++) ctx.fillRect((pts[i].x-camX+0.5)*TS-1.5,(pts[i].y-camY+0.5)*TS-1.5,3,3);
  ctx.globalAlpha=1;
}


/* ---------------------------------------------------------------- monster AI */
var PDIST=null;
function refreshPlayerDistance(){ PDIST=bfsFrom(player.x,player.y); }

/* 2026-09-18: a surprise attack lands on anything that has not noticed you - asleep, or awake but not hunting
   you - and on something that noticed you only on its last turn (the door you just opened): it is still
   catching up, so your next swing or spell is a surprise. Once hit, it knows. */
function offGuard(e){
  if(!e || e===player) return false;
  if(e.state==='throne') return false;
  return e.state!=='hunt' || e.caughtOff===turn;
}
function basicMonsterBehavior(e){
  if(e.hp<=0)return true;

  var see = canSeePlayer(e), d=dist(e,player);
  if(e.state==='throne'){
    /* He holds the throne until you walk in - that is the staging. But the room check alone let you stand in
       the corridor and shoot him to death for free, since nothing outside the room could ever wake him
       (Justin, 2026-09-23). Anything that has actually hurt him ends the staging too. */
    var rm=roomAt(player.x,player.y);
    if((see && d<=7 && rm && rm.role==='boss') || e.hp<e.maxhp){ e.state='hunt'; log('<b>'+e.name+'</b> rises from his throne with a roar!','c-you'); sfx('warchief-roar'); playMusic('boss');
      ents.forEach(function(o){ if(o.guard) o.state='hunt'; }); SHAKE=8; }
     return true;
  }
  if(e.state==='asleep'){
    var notice = noticeChance(e, see, d, true);
    if(rng()<notice){ e.state='hunt'; e.caughtOff=turn; log(e.name+' notices you.','c-info'); if(e.base.sfx) sfx(e.base.sfx+'-alert'); }
     return true;
  }
  if(see && (e.state==='hunt' || e.challenged || rng()<noticeChance(e, see, d, false))) { if(e.state!=='hunt'){ e.caughtOff=turn; if(e.base.sfx) sfx(e.base.sfx+'-alert'); } e.state='hunt'; e.lastSeen={x:player.x,y:player.y}; }
  if(e.state==='hunt'){
    /* the boss */
    if(e.base.boss && bossTurn(e, see, d)){  return true; }
    /* casters */
    if(e.base.caster && see && d<=e.base.castRange){
      e.castCd=(e.castCd||0)-1;
      if(e.castCd<=0 && clearShot(e,player)){   /* a shaman behind its own goblins holds the bolt */
        e.castCd=e.base.castEvery; setClip(e,'attack'); sfx('shaman-cast');
        boltFx(e.x,e.y,player.x,player.y,'fire');
        if(rng() < hostileHitChance(hitChance(e.base.acc+10, player.eva),true)){
          var fd=applyDamage(player, roll(5,8)+floorNo, 'fire', e); floatText(player.x,player.y,String(fd),'fire'); var brn=rng()<0.5; if(brn) applyStatus(player,'burn',3,sDMG(2));
          log(e.name+' hurls a firebolt &mdash; <b>'+fd+'</b> fire'+(brn?', burning':'')+'.','c-you');
          if(player.hp<=0) kill(player,e);
        } else { log(e.name+'\'s firebolt misses.','c-miss'); floatText(player.x,player.y,'miss','miss'); }
         return true;
      }
      if(d<=2&&fleeStep(e))return true;
    }
    /* archers keep their distance */
    if(e.base.kiter && d<=1 && rng()<0.5 && fleeStep(e)){  return true; }
    if(e.base.range>1 && d<=e.base.range && see && d>1){
      var path=boltPath(e.x,e.y,player.x,player.y), end=path[path.length-1];
      if(end && end.x===player.x && end.y===player.y){ attack(e,player);  return true; }
    }
    if(d<=1){ attack(e,player);  return true; }
    var guard=ents.filter(function(o){ return o.ally && dist(o,e)<=1; })[0];
    if(guard && (guard.taunt || rng()<0.6)){ attack(e,guard);  return true; }
    if(!canActorMove(e)){  return true; }
    if(e.base.erratic && rng()<0.35){ stepEnt(e, ri(-1,1), ri(-1,1));  return true; }
    if(see || e.challenged) chaseStep(e);
    else if(e.lastSeen){ stepToward(e, e.lastSeen.x, e.lastSeen.y); if(e.x===e.lastSeen.x && e.y===e.lastSeen.y){ e.lastSeen=null; e.state='wander'; } }
    else chaseStep(e);
  } else {
    if(!e.goal || (e.x===e.goal.x && e.y===e.goal.y) || rng()<0.04){
      var tries=0, gx, gy;
      do{ gx=ri(1,MW-2); gy=ri(1,MH-2); tries++; } while(!walkable(gx,gy) && tries<40);
      e.goal={x:gx,y:gy};
    }
    stepToward(e, e.goal.x, e.goal.y);
  }


  return true;
}
/* Grukk fights in a fixed, learnable rotation. Every big attack is telegraphed on the floor a turn or two
   ahead (e.windup, drawn by drawTelegraphs) and can be walked out of:
     Ground Slam - marks radius 2 around him, lands 2 turns later: heavy damage and a stun.
     Charge      - marks a straight line toward you, lands next turn. Dodge it and he hits the wall, dazed 2 turns (+50% damage taken).
     Shockwave   - below a third of his health every slam is followed by a ring 3-4 tiles out: step back in close.
   Between them he cleaves whatever stands next to him. */
var BOSS_ROTATION = [['cleave','cleave','slam','cleave','cleave','charge'], ['cleave','slam','cleave','charge']];
function tilesWithin(cx, cy, rMin, rMax){
  var out=[];
  for(var y=cy-rMax;y<=cy+rMax;y++) for(var x=cx-rMax;x<=cx+rMax;x++){
    var d=Math.max(Math.abs(x-cx),Math.abs(y-cy));
    if(d>=rMin && d<=rMax && inb(x,y) && walkable(x,y)) out.push([x,y]);
  }
  return out;
}
function chargeLine(e){
  var dx=Math.sign(player.x-e.x), dy=Math.sign(player.y-e.y), out=[], x=e.x, y=e.y;
  if(!dx && !dy) return out;
  for(var i=0;i<8;i++){ x+=dx; y+=dy; if(!inb(x,y) || !walkable(x,y) || (propAt(x,y)&&propAt(x,y).b)) break; out.push([x,y]); }
  return out;
}
function hitTiles(e, tiles, dmg, label, extra){
  var hitAny=false; AOE_HIT=true;
  tiles.forEach(function(t){
    burst(t[0],t[1],'earth',4,0.04);
    var victims=(player.x===t[0]&&player.y===t[1]) ? [player] : [];
    ents.forEach(function(o){ if(o!==e && o.x===t[0] && o.y===t[1] && (o.ally)) victims.push(o); });
    victims.forEach(function(v){
      var d=applyDamage(v, roll(dmg[0],dmg[1]), 'phys', e); floatText(v.x,v.y,String(d),'phys',true); hitAny=true;
      if(extra) extra(v);
      if(v===player){ log('<b>'+label+'</b> catches you for '+d+'.','c-you'); if(player.hp<=0) kill(player,e); }
      else if(v.hp<=0) kill(v,e);
    });
  });
  AOE_HIT=false;
  return hitAny;
}
function bossTurn(e, see, d){
  var pct=e.hp/e.maxhp;
  e.phase=e.phase||0;
  if(e.dazed>0){ e.dazed--; if(e.dazed===0) log('Grukk shakes off the daze.','c-info'); return true; }
  /* a telegraphed attack resolves when its countdown runs out */
  if(e.windup){
    if(e.windup.kind==='charge'&&!canActorMove(e)){e.windup=null;return true;}
    e.windup.due--;
    if(e.windup.due>0) return true;
    var w=e.windup; e.windup=null;
    setClip(e,'attack');
    if(w.kind==='slam' || w.kind==='ring'){
      sfx('warchief-slam'); SHAKE=w.kind==='slam'?14:10;
      hitTiles(e, w.tiles, w.kind==='slam'?[16,24]:[12,18], w.kind==='slam'?'Ground Slam':'The shockwave', function(v){ applyStatus(v,'stun',1); });
      log(w.kind==='slam' ? '<b>Grukk brings the axe down.</b> The floor cracks.' : 'A shockwave rolls outward.','c-you');
      if(w.kind==='slam' && e.phase>=2){ e.windup={kind:'ring', tiles:tilesWithin(e.x,e.y,3,4), due:2}; log('<b>The ground heaves.</b> A shockwave is building &mdash; get close to him.','c-you'); }
    } else if(w.kind==='charge'){
      sfx('warchief-roar'); SHAKE=10;
      var path=w.tiles, stopAt=null, hit=false;
      for(var i=0;i<path.length;i++){
        var t=path[i];
        if(player.x===t[0] && player.y===t[1]){ hit=true; break; }
        if(occupied(t[0],t[1])){ ents.forEach(function(o){ if(o.ally && o.x===t[0] && o.y===t[1]){ var ad=applyDamage(o, roll(14,20),'phys',e); floatText(o.x,o.y,String(ad),'phys'); if(o.hp<=0) kill(o,e); } }); if(occupied(t[0],t[1])) break; }
        stopAt=t;
      }
      if(stopAt){ e.x=stopAt[0]; e.y=stopAt[1]; }
      if(hit){ var cd=applyDamage(player, roll(14,20), 'phys', e); floatText(player.x,player.y,String(cd),'phys',true); log('<b>Grukk\'s charge</b> slams into you for '+cd+'.','c-you'); if(player.hp<=0) kill(player,e); }
      else { e.dazed=2; log('<b>Grukk thunders past and crashes into the wall!</b> He is dazed &mdash; strike now.','c-kill'); sparkleFx(e.x,e.y,'lightning',20); }
    }
    return true;
  }
  if((e.phase===0 && pct<0.66) || (e.phase===1 && pct<0.33)){
    e.phase++; log('<b>Grukk</b> bellows for help!'+(e.phase===2?' He is enraged: every slam now sends out a shockwave.':''),'c-you'); sfx('warchief-roar'); SHAKE=10;
    for(var j=0;j<2;j++){ var c=nearFree(e.x,e.y,3); if(c){ var g=spawn(j===0?'goblin':'archer',c.x,c.y); g.state='hunt'; g.noXp=false; sparkleFx(c.x,c.y,'earth',10); } }
    return true;
  }
  if(!see) return false;
  var rot=BOSS_ROTATION[e.phase>=1?1:0];
  var step=rot[(e.rot||0)%rot.length];
  if(step==='slam' && d<=3){
    e.rot=(e.rot||0)+1;
    e.windup={kind:'slam', tiles:tilesWithin(e.x,e.y,0,2), due:2};
    setClip(e,'attack'); sfx('warchief-roar');
    log('<b>Grukk raises his axe overhead!</b> Get out of the marked ground.','c-you');
    return true;
  }
  if(step==='charge' && d>=2&&canActorMove(e)){
    var line=chargeLine(e);
    if(line.length>=2){
      e.rot=(e.rot||0)+1;
      e.windup={kind:'charge', tiles:line, due:1};
      log('<b>Grukk lowers his head and paws the ground.</b> Step out of his path.','c-you');
      return true;
    }
  }
  if(d<=1){
    e.rot=(e.rot||0)+1;
    /* the great axe cleaves everything beside him */
    attack(e,player);
    ents.forEach(function(o){ if(o.ally && dist(o,e)<=1) attack(e,o,0.8); });
    return true;
  }
  if(step!=='cleave' && d>3) { /* too far for a slam: close in first, keeping the slam next in line */ }
  return false;
}


/* An ally following you used to take a greedy step toward your tile (stepToward), which walks straight into
   a wall whenever you are round a corner - get separated and your servant never finds you again. PDIST is
   the BFS distance field from the player that the monster AI already uses, so allies walk down it. */

function basicAllyBehavior(e){
  if(e.hp<=0)return true;if(e.life!==undefined && !e.shade){

    if(e.life<=0){ ents=ents.filter(function(o){ return o!==e; }); log('Your '+e.name+' crumbles back into the floor.','c-info'); return true; }
  }

  var target=null, best=99;
  ents.forEach(function(o){ if(!o.foe || !actorVisible(o)) return true; var d=dist(e,o); if(d<best && d<=8){ best=d; target=o; } });
  if(target && target.x!==e.x) e.facingLeft=target.x<e.x;
  /* a raised Lich is a caster, not a brawler: it throws shadow bolts from range and backs away when
     something closes on it (2026-09-17 - the form's caster field was never wired up before) */
  if(target && e.castSpell && best>=2 && best<=6){
    e.castCd=(e.castCd||0)-1;
    if(e.castCd<=0 && clearShot(e,target)){   /* nor does your Lich bolt through you or another creature */
      e.castCd=2; setClip(e,'attack');
      if(typeof boltFx==='function') boltFx(e.x, e.y, target.x, target.y, 'shadow');
      var ld=applyDamage(target, roll(e.dmg[0], e.dmg[1]), 'dark', e);
      floatText(target.x, target.y, String(ld), 'dark');
      log('Your '+e.name+' hurls a shadow bolt &mdash; <b>'+ld+'</b> dark.','c-good');
      if(target.hp<=0) kill(target, e);
       return true;
    }
  }
  if(target && e.castSpell && best<=1 && canActorMove(e) && fleeStep(e,target))return true;
  if(target && best<=1){ attack(e, target); }
  else if(target && canActorMove(e)){
    var ox=e.x, oy=e.y;
    if(dist(e,player)>7) allyFollowStep(e);            /* left too far behind: catch up first */
    else {
      stepToward(e, target.x, target.y);
      if(e.x===ox && e.y===oy) allyFollowStep(e);      /* the direct step was blocked: path instead */
    }
  }
  else if(dist(e,player)>2 && canActorMove(e)){ allyFollowStep(e); }


  return true;
}


function nearestFoe(range){
  var best=null, bd=99;
  ents.forEach(function(e){ if(!e.foe || !actorVisible(e)) return; var d=dist(player,e); if(d<=range && d<bd){ best=e; bd=d; } });
  return best;
}

function armorDeflectChance(){return bodyArmor(player).enchant==='air'?enchantValues('armor','air').deflect:0;}
function deflectProjectile(){
  if(!combatRoll(armorDeflectChance(),true))return false;
  floatText(player.x,player.y,'deflected','miss');sfx('miss');return true;
}

/* Pet damage can draw aggro even while the player is hidden or out of sight. */
function petRetaliationBehavior(e){
  if(!e.petAggressor || canSeePlayer(e))return false;
  var pet=ents.find(function(o){return o.id===e.petAggressor && o.ally && o.hp>0;});
  if(!pet){delete e.petAggressor;return false;}
  e.state='hunt';e.lastSeen={x:pet.x,y:pet.y};
  var d=dist(e,pet);
  if(d<=1 || e.base.range>1 && d<=e.base.range && clearShot(e,pet))attack(e,pet);
  else if(canActorMove(e))stepToward(e,pet.x,pet.y);
  return true;
}

function castBoltTarget(x,y){
  var cf=faceOf(x-player.x, y-player.y); if(cf) player.face=cf;
  if(!aiming) return false;
  var A=aiming.A, key=player.abilities[aiming.i];
  /* 2026-09-18: inRange() folds distance, bounds and line of sight together; say which one failed. */
  if(!inRange(x,y)){ log(((revealAll||vis[idxOf(x,y)]) ? 'Out of range.' : 'You cannot see that tile.'),'c-info'); sfx('ui-error'); return false; }
  if(A.kind==='summon') return castRaiseDead(x,y,A);
  var path=boltPath(player.x,player.y,x,y), end=path.length?path[path.length-1]:{x:x,y:y};
  var f=foeAt(end.x,end.y);
  var terrain = !f && (at(end.x,end.y)===ICEDOOR || at(end.x,end.y)===THORNS || propAt(end.x,end.y) || gAt(end.x,end.y)===G_GRASS);
  if(key==='challenge'){ if(!f){ log('Challenge whom?','c-info'); return false; } }
  if(!f && !(terrain && (A.type==='fire'||A.type==='phys'||A.type==='ice'||A.type==='lightning'))){ log(path.length && end.x!==x ? 'Something is in the way.' : 'Nothing to hit there.','c-info'); return false; }
  aiming=null; spendSpellMana(A);
  if(!A.tech && !A.divine && typeof spellConduct==='function') spellConduct(A);
  setClip(player, A.tech && A.useWeaponRange && player.range<=1 ? 'melee' : 'cast');
  if(key==='challenge'){
    ents.forEach(function(e){if(!e.cowardMark)e.challenged=false;});
    f.challenged=true; f.challengeBoost = false; f.state='hunt'; f.challengeT=0;
    log('You challenge '+f.name+'. It must face you.','c-good'); sfx('shrine-open'); ringFx(f.x,f.y,'#E8B44A',1.2);
    endTurn(); return true;
  }
  var ptype = A.type==='magic'?'magic':A.type==='phys'?(A.el==='earth'?'earth':'phys'):A.type==='ice'?'ice':A.type==='dark'?'dark':A.type;
  sfx(A.el==='fire'?'fire-cast':A.el==='water'?'ice-cast':A.el==='air'?'lightning-cast':A.el==='earth'?'earth-cast':A.el==='light'?'light-cast':A.el==='shadow'?'shadow-cast':A.type==='magic'?'magic-missile':'sap');
  boltFx(player.x, player.y, end.x, end.y, ptype, {arrow: key==='sap' && player.range>1});
  if(!f){
    /* spells against the world */
    if(A.type==='fire') { ignite(end.x,end.y,'player'); burnWorld(end.x,end.y); }
    if(A.type==='ice' && at(end.x,end.y)===WATER){ setG(end.x,end.y,G_ICE); }
    if(propAt(end.x,end.y) && (A.type==='phys'||A.type==='lightning')) damageProp(propAt(end.x,end.y), 'player', A.type);
    endTurn(); return true;
  }
  var hit = A.always || combatRoll(hitChance(player.acc+10, evaOf(f)),true);
  if(!hit){ log(A.name+' misses '+f.name+'.','c-miss'); floatText(f.x,f.y,'miss','miss'); endTurn(); return true; }
  var dmgType = A.type==='magic' ? 'magic' : A.type;
  var base;
  if(A.tech){ base = roll(A.base[0],A.base[1]) + Math.floor((player.dmg[0]+player.dmg[1])/4); }
  else base = Math.round((sDMG(roll(A.base[0],A.base[1])) + (A.perAffinity ? A.perAffinity*totalAffinity() : 0)) * spellPower(A));   /* affinity adds before spell power */
  if(key==='smite' && (f.base.undead||f.base.shadowy)) base=Math.round(base*1.5);
  if(player.aff.fire && !A.divine) base += player.aff.fire;   /* Kindled: +1 per Fire point on spells too */
  var wasAsleep=f.state==='asleep'||offGuard(f);
  var hitEvent=resolveSpellStrike(f,A,base,dmgType,{bolt:true}),d=hitEvent.damage,crit=hitEvent.hit.crit;
  floatText(f.x,f.y,String(d),dmgType==='phys'?'phys':dmgType,crit);
  var note='';
  if(A.status){ for(var k in A.status){
    if(k==='chill') { addChill(f); note+=' chilled'; }
    else if(k==='stun' && key==='sap'){ if(f.stunImmune){ f.state='hunt'; note+=' (already Sapped)'; } else { applyStatus(f,'stun', wasAsleep?6:A.status.stun); f.state='hunt'; note+=' knocked out'; } }
    else { applyStatus(f,k,A.status[k], k==='burn'?sDMG(3):undefined); note+=' '+k; } } }
  if(A.stunChance && rng()<A.stunChance){ applyStatus(f,'stun',1); note+=' stunned'; }
  if(A.blindChance && rng()<A.blindChance){ applyStatus(f,'blind',2); note+=' blinded'; }
  if(A.type==='fire'){ ignite(f.x,f.y,'player'); }
  if(f.state==='asleep' && key!=='sap') f.state='hunt';
  if(key==='sap'&&f.hp>0&&f.st.stun&&!f.stunImmune){f.sapped=true;f.stunImmune=true;}
  if(d>0)playerHitRewards(f,true);
  log(A.name+' hits '+f.name+' &mdash; <b>'+d+'</b> '+(dmgType==='phys'?'physical':dmgType)+(crit?' (crit)':'')+note,'c-hit');
  if(f.hp<=0){
    kill(f,player);
  }
  endTurn(); return true;
}
