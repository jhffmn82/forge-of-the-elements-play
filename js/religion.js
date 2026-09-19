/* =====================================================================
   religion.js - god changes from the mechanics review (2026-09-16,
   DESIGN.md 12 step 8). Grom fist tiers and Iron Hide overhealth;
   Glimmer's Light point and Guiding Light; Murk's Unholy Aura invoke and
   Raise Dead prayer; Reginald's crit and rank 3; Anvil's offering,
   Reforge cap and mote refunds; Vellum's instant Unbound; Wobbles'
   Greater Prayer. Invokes scale +3% per Focus point (combat.js castSelf).
   ===================================================================== */

/* ---------------------------------------------------------------- boon and prayer text */
GODS.grom.boons = ['Iron Flesh: +2 armor per rank, and your fists hit harder as your rank rises (2-5, 3-6, 5-9, 7-12). Every unarmed hit earns 1 piety.',
                   'Staggering Blows: unarmed hits stun 15% of the time.',
                   'Mountain’s Fists: every third unarmed attack in a row strikes as a critical hit and knocks the target back a tile.'];
GODS.glimmer.rule = 'No Shadow: no shadow affinity, enchantments or sigils. Light must be one of your elements.';
GODS.glimmer.boons = ['Mending Light: joining grants 1 Light affinity that does not count toward your cap. All healing and HP regeneration +10%, and +10% damage against undead and shadow creatures, per rank.',
                      'Guiding Light: +5% Smite chance per rank.',
                      'Undying Light: once per floor, a killing blow instead heals you to half your HP.'];
GODS.murk.invoke = 'unholyaura';
GODS.murk.prayers = ['raisedead','corpsefeast'];
GODS.murk.boons = ['Life Drain: kills heal 1 HP per rank, and your undead have +10% HP and damage per rank.',
                   'Undying Servants: Raise Dead brings up a Zombie Bruiser instead of a skeleton.',
                   'Lich-Mother: Raise Dead calls a Lich, and your servant rises again once when it is destroyed.'];
GODS.reginald.rule = 'No surprise attacks and no stealth kills. Refuses Scoundrels and anyone touched by Shadow.';
GODS.reginald.boons = ['Fair Fight: +4 accuracy, +2% crit and +10% damage against elites and bosses, per rank.',
                       'Called Out: elites and bosses that can see you take 15% more damage from you and your allies.',
                       'Champion: while only one enemy is in view you deal 30% more damage and take 20% less.'];
GODS.anvil.boons = ['Smith’s Blessing: +1 weapon damage and enchantments 10% stronger, per rank.',
                    'Second Heat: enchanting or carving a sigil at the Forge has a 30% chance to give back its motes.',
                    'Masterwork: Forge upgrades cost 30% less, and gear can be raised to +4.'];
GODS.vellum.rule = 'No shields, and nothing heavier than light armor. Refuses Fighters and Scoundrels.';
GODS.vellum.boons = ['Deep Well: +8% max mana and +8% spell damage per rank.',
                     'Spell Echo: a spell you cast has a 20% chance to refund its mana.',
                     'Grand Magus: spells cost 25% less mana, and Spell Echo triggers 35% of the time.'];
GODS.wobbles.prayers = ['rolldice2'];
GODS.wobbles.boons[0] = "Lady Luck's Blessing: +3% to your combat effects per rank - and occasional gifts (and pranks) when things get dramatic. Roll the Dice leans good: 60%, +1% per Focus above 10. Never kills you directly.";

PRAYERS.ironhide.desc = '+5 armor for 12 turns, and a shield of 5 + 2 per rank.';
PRAYERS.rampage.desc = '+40% melee damage and 20% faster attacks for 10 turns.';
PRAYERS.raisedead = {name:'Raise Dead', favor:20, rank:2, desc:'The dead rise beside you and fight until destroyed or you leave the floor. One at a time.'};
PRAYERS.offering.desc = 'Offer 10% of your essence (at least 50): +10 piety and favor (x2 at a shrine).';
PRAYERS.reforge.desc = 'Permanently add +1 to your main-hand weapon (not above +3).';
PRAYERS.unbound.desc = 'Your next spell takes no time to cast.';
PRAYERS.rolldice2 = {name:'Greater Prayer', favor:0, rank:4, amusement:40, desc:'Spend 40 amusement: a big roll that can grant gear, rings and amulets. Its bad outcomes are worse too.'};
ABILITIES.unholyaura = {name:'Unholy Aura', cost:8, kind:'self', icon:'pr-unholyaura', divine:true, god:'murk', desc:'Invoke (Mother Murk): for 8 turns enemies within 2 take 5 dark damage (+1 per rank) each turn, and you heal 1 per enemy hit.'};
ABILITIES.temper.desc = 'Invoke (Old Anvil): +2 weapon damage for 12 turns.';
INVOKE_OF.murk = 'unholyaura';
UNDEAD_FORMS = UNDEAD_FORMS.filter(function(u){ return u.name!=='Vampire'; });
if(typeof AMULETS!=='undefined' && AMULETS.fury) AMULETS.fury.desc = 'Rampage for 8 turns: +40% melee damage and 20% faster attacks.';

/* ---------------------------------------------------------------- who a god refuses */
function refusalText(id){
  var g=GODS[id];
  if(g.refuses && player.race===g.refuses) return g.name+' will not accept a '+RACES[player.race].name+'.';
  if(id==='reginald' && isScoundrel()) return 'Sir Reginald will not take a sneak-thief into his service.';
  if(id==='reginald' && (player.aff.shadow||0)>0) return 'Sir Reginald wants nothing to do with shadow.';
  if(id==='vellum' && (player.cls==='fighter'||player.cls==='scoundrel')) return 'Vellum keeps its pages for casters.';
  if(id==='glimmer' && (player.aff.shadow||0)>0) return 'Saint Glimmer will not touch shadow.';
  if(id==='glimmer' && !canHoldLight()) return 'Saint Glimmer’s light needs room: Light must be able to be one of your two elements.';
  return g.name+' refuses you.';
}
function canHoldLight(){
  var els=Object.keys(player.aff).filter(function(k){ return player.aff[k]>0; });
  if(els.indexOf('light')>=0) return true;
  if(els.indexOf('shadow')>=0) return false;
  return els.length<2;
}
function godRefuses(id){
  var g=GODS[id];
  if(g.refuses && player.race===g.refuses) return true;
  if(id==='reginald' && (isScoundrel() || (player.aff.shadow||0)>0)) return true;
  if(id==='vellum' && (player.cls==='fighter'||player.cls==='scoundrel')) return true;
  if(id==='glimmer' && ((player.aff.shadow||0)>0 || !canHoldLight())) return true;
  return false;
}

/* ---------------------------------------------------------------- Glimmer's Light point */
function grantGlimmerLight(){
  if(player.glimmerLight) return;
  player.glimmerLight=true;
  player.aff.light=(player.aff.light||0)+1;
  if(!player.primary) player.primary='light';
  log('<b>Saint Glimmer</b> kindles a point of <b>Light</b> in you.','c-kill');
}
function takeGlimmerLight(){
  if(!player.glimmerLight) return;
  player.glimmerLight=false;
  player.aff.light=Math.max(0,(player.aff.light||0)-1);
  if(!player.aff.light) delete player.aff.light;
  if(player.primary==='light' && !player.aff.light) player.primary=Object.keys(player.aff)[0]||null;
  log('<b>Saint Glimmer</b> takes back the light he gave you.','c-you');
}
var _totalAffinityRel = totalAffinity;
totalAffinity = function(){ return _totalAffinityRel() - (player && player.glimmerLight ? 1 : 0); };
var _joinGodRel = joinGod;
joinGod = function(id, startPiety){
  if(player.god==='glimmer' && id!=='glimmer') takeGlimmerLight();
  _joinGodRel(id, startPiety);
  if(id==='glimmer') grantGlimmerLight();
  derive(player); updateUI();
};
var _pietyViolationRel = pietyViolation;
pietyViolation = function(what, amount){
  var was=player.god;
  _pietyViolationRel(what, amount);
  if(was==='glimmer' && player.god!=='glimmer') takeGlimmerLight();
};
var _newRunRel = newRun;
newRun = function(seed, choice){
  _newRunRel(seed, choice);
  if(player.cls==='cleric' && player.god==='glimmer'){ grantGlimmerLight(); derive(player); updateUI(); }
};
function smiteBonus(){ return hasGod('glimmer') && godRank()>=3 ? 0.05*godRank() : 0; }

/* ---------------------------------------------------------------- Grom: fists by rank, armor, punch piety, Iron Hide */
var GROM_FISTS = [[1,3],[2,5],[3,6],[5,9],[5,9],[7,12]];
var _deriveRel = derive;
derive = function(p){
  _deriveRel(p);
  if(p!==player) return;
  var r=godRank();
  if(hasGod('grom')){
    p.armor += r;   /* base gives +1 per rank; Iron Flesh is +2 */
    if(p.weapon && p.weapon.unarmed){
      var f=GROM_FISTS[Math.min(5,r)];
      p.dmg=[p.dmg[0]-r-sDMG(1)+sDMG(f[0]), p.dmg[1]-r-sDMG(3)+sDMG(f[1])];
    }
  }
  if(hasGod('reginald')) p.crit += 0.02*r;
  if(PRAYERS.offering) PRAYERS.offering.essence = Math.max(50, Math.round((p.essence||0)*0.10));
};
var _attackRel = attack;
attack = function(att, def, mult, label){
  var hp0 = def ? def.hp : 0;
  _attackRel(att, def, mult, label);
  /* 2026-09-17: Grom's piety is paid per unarmed KILL in godOnKill now (2, 15 for an elite). Paying per
     hit as well put him a whole biome ahead of every other god. */
};
var _usePrayerRel = usePrayer;
usePrayer = function(pid){
  if(pid==='offering' && PRAYERS.offering) PRAYERS.offering.essence = Math.max(50, Math.round((player.essence||0)*0.10));
  if(pid==='reforge' && player.weapon && (player.weapon.plus||0)>=3){ log('Old Anvil will not reforge past +3.','c-info'); sfx('ui-error'); return; }
  if(pid==='raisedead') return prayRaiseDead();
  if(pid==='unbound'){
    if(!canPray(pid)){ log('You cannot offer that prayer right now.','c-info'); sfx('ui-error'); return; }
    player.favor-=PRAYERS.unbound.favor; player.unboundNext=true;
    sfx('pray'); setClip(player,'cast'); ringFx(player.x,player.y,GODS.vellum.color,2.5); sparkleFx(player.x,player.y,'magic',30);
    log('<b>Unbound.</b> Your next spell will take no time.','c-good'); updateUI(); return;
  }
  if(pid==='rolldice2'){
    if(!canPray(pid)){ log('You cannot offer that prayer right now.','c-info'); sfx('ui-error'); return; }
    player.amusement-=PRAYERS.rolldice2.amusement; sfx('pray'); setClip(player,'cast');
    greaterPrayer(); endTurn(); return;
  }
  var hid=player.hideShield;
  _usePrayerRel(pid);
  if(pid==='ironhide'){ player.hideShield=(hid||0)+5+2*godRank(); log('A shield of '+Math.round(player.hideShield)+' hardens over your skin.','c-good'); updateUI(); }
};
var _playerShieldRel = playerShield;
playerShield = function(){ return _playerShieldRel() + Math.max(0, Math.floor(player.hideShield||0)); };

/* ---------------------------------------------------------------- Murk: Unholy Aura invoke, Raise Dead prayer */
var _castSelfRel = castSelf;
castSelf = function(key, A){
  if(key==='unholyaura'){
    var div=1 + ((player.weapon.divine||0) + ((player.off&&player.off.divine)||0)) + 0.03*Math.max(0, player.stats.foc-10);
    player.mp-=costOf(A); setClip(player,'cast');
    player.st.aura={t:8, d:Math.round((5+godRank())*div)};
    sparkleFx(player.x,player.y,'dark',40); sfx('shadow-cast');
    log('An unholy aura seeps from you ('+player.st.aura.d+' a turn).','c-good');
    return true;
  }
  if(key==='rolldice'){ WOBBLE_BONUS=0.01*Math.max(0, player.stats.foc-10); var r=_castSelfRel(key, A); WOBBLE_BONUS=0; return r; }
  return _castSelfRel(key, A);
};
var WOBBLE_BONUS=0;
function prayRaiseDead(){
  if(!canPray('raisedead')){ log('You cannot offer that prayer right now.','c-info'); sfx('ui-error'); return; }
  if(ents.some(function(e){ return e.ally && e.undeadServant; })){ log('Your servant still stands.','c-info'); return; }
  var c=nearFree(player.x,player.y,1)||nearFree(player.x,player.y,2);
  if(!c){ log('There is no room for the dead to rise.','c-info'); return; }
  player.favor-=PRAYERS.raisedead.favor;
  sfx('pray'); ringFx(player.x,player.y,GODS.murk.color,2.5);
  var mp=player.mp;
  castRaiseDead(c.x, c.y, {cost:0, life:22});   /* spends no mana; ends the turn */
  player.mp=mp;
  ents.forEach(function(e){ if(e.ally && e.undeadServant){ e.life=undefined; if(e.t<player.t-200) e.t=player.t; } });
}
/* a prayed servant has no timer */
var _castRaiseDeadRel = castRaiseDead;
castRaiseDead = function(x, y, A){
  var r=_castRaiseDeadRel(x, y, A);
  ents.forEach(function(e){ if(e.ally && e.undeadServant) e.life=undefined; });
  return r;
};

/* ---------------------------------------------------------------- Reginald rank 3: Called Out */
var _applyDamageRel = applyDamage;
applyDamage = function(target, amount, type, source){
  if(target && target!==player && hasGod('reginald') && godRank()>=3 && (source===player || source==='player' || (source && source.ally)) &&
     (target.elite || (target.base && (target.base.elite || target.base.boss))) && target.state==='hunt') amount*=1.15;
  return _applyDamageRel(target, amount, type, source);
};

/* ---------------------------------------------------------------- Anvil rank 3: Second Heat refunds motes */
function secondHeat(before){
  if(!hasGod('anvil') || godRank()<3 || rng()>=0.30) return;
  var back=0;
  for(var k in before){ var lost=before[k]-(player.motes[k]||0); if(lost>0){ player.motes[k]=(player.motes[k]||0)+lost; back+=lost; } }
  if(back) log('<b>Second Heat.</b> Old Anvil hands your mote'+(back>1?'s':'')+' back.','c-good');
}
var _enchantItemRel = enchantItem;
enchantItem = function(slot, el){ var b=Object.assign({}, player.motes); _enchantItemRel(slot, el); secondHeat(b); if(typeof renderForge==='function') renderForge(); updateUI(); };
var _craftSigilRel = craftSigil;
craftSigil = function(key){ var b=Object.assign({}, player.motes); _craftSigilRel(key); secondHeat(b); if(typeof renderForge==='function') renderForge(); updateUI(); };

/* ---------------------------------------------------------------- Vellum: Unbound makes the next spell instant */
var _spellConductRel = spellConduct;
spellConduct = function(A){ player.castingSpell=true; return _spellConductRel(A); };
var _endTurnRel = endTurn;
endTurn = function(){
  if(player && player.unboundNext && player.castingSpell){
    player.unboundNext=false; FREE_ACTION=true;
    log('Unbound: the spell costs you no time.','c-good');
  }
  if(player) player.castingSpell=false;
  return _endTurnRel();
};

/* ---------------------------------------------------------------- Wobbles: Greater Prayer */
function greaterPrayer(){
  var good = rng() < 0.6 + (godRank()>=3 ? 0.1 : 0);
  sfx('wobbles-giggle');
  function drop(it){ var c=nearFree(player.x,player.y,1)||{x:player.x,y:player.y}; it.x=c.x; it.y=c.y; items.push(it); }
  if(good){
    var o=pick(['gear','ring','amulet','restore','motes']);
    if(o==='gear'){ var g=randomGear(); if(g.it){ g.it.tier=Math.min(3, (typeof rollTier==='function' ? rollTier() : 1)+1); g.it.cursed=false; if((g.it.plus||0)<1) g.it.plus=1; } drop(g); log('<b>Wobbles roars with laughter.</b> Something fine clatters to the floor.','c-kill'); }
    else if(o==='ring' && typeof makeRing==='function'){ drop({kind:'ring', it:makeRing(null,false)}); log('<b>Wobbles roars with laughter.</b> A ring rolls to your feet.','c-kill'); }
    else if(o==='amulet' && typeof makeAmulet==='function'){ drop({kind:'amulet', it:makeAmulet(null,false)}); log('<b>Wobbles roars with laughter.</b> An amulet drops from nowhere.','c-kill'); }
    else if(o==='restore'){ player.hp=player.maxhp; player.mp=player.maxmp; clearBad(); sparkleFx(player.x,player.y,'heal',50); log('<b>Wobbles roars with laughter.</b> You are made whole.','c-kill'); }
    else { var a=pick(ELEMENTS), b=pick(ELEMENTS); player.motes[a]=(player.motes[a]||0)+1; player.motes[b]=(player.motes[b]||0)+1; log('<b>Wobbles roars with laughter.</b> Two motes, '+a+' and '+b+', tumble into your pouch.','c-kill'); }
  } else {
    var bad=pick(['ambush','bleed','poor','scatter']);
    if(bad==='ambush'){ for(var i=0;i<3;i++){ var c=nearFree(player.x,player.y,3); if(c){ var m=spawn(pick(['goblin','brute','archer']),c.x,c.y); m.state='hunt'; m.noXp=true; } } log('<b>Wobbles cackles.</b> An ambush!','c-you'); }
    else if(bad==='bleed'){ player.hp=Math.max(1, Math.round(player.hp/2)); applyStatus(player,'blind',4); log('<b>Wobbles cackles.</b> Half your blood, and your sight, are gone.','c-you'); }
    else if(bad==='poor'){ var lost=Math.round(player.essence*0.5); player.essence-=lost; log('<b>Wobbles cackles.</b> '+lost+' essence vanishes.','c-you'); }
    else { var spots=[]; for(var y=0;y<MH;y++) for(var x=0;x<MW;x++) if(walkable(x,y)&&!occupied(x,y)&&inRoom(x,y)) spots.push({x:x,y:y});
      var s=pick(spots); if(s){ player.x=s.x; player.y=s.y; player._lx=undefined; } ents.forEach(function(e){ if(e.foe && dist(e,player)<=16){ e.state='hunt'; e.lastSeen={x:player.x,y:player.y}; } });
      log('<b>Wobbles cackles.</b> You land somewhere new, and everything nearby heard you.','c-you'); }
    player.hp=Math.max(1,player.hp);
  }
  computeFOV();
}
