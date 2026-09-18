/* ============================================================================
   combat.js - character math, damage, statuses, spells, abilities, monster AI.
   Replaces derive(), applyDamage(), attack(), kill(), tickStatus(), castAt(),
   useAbility(), aiAct(), allyAct(), stepEnt() from game.js.
   ========================================================================== */

var FISTS = {name:'Fists', dmg:[1,3], acc:5, hands:1, unarmed:true, icon:'ic-iron-body', kind:'weapon'};
function isScoundrel(){ return player.cls==='scoundrel'; }

/* stat passives (mechanics review 2026-09-16, DESIGN.md section 12) */
PASSIVES={
  mig:[{at:12,id:'heavyHands',name:'Heavy Hands',d:'+10% melee damage'},
       {at:15,id:'crushing',  name:'Crushing Blows',d:'+25% damage to targets below half HP'},
       {at:18,id:'armorMaster',name:'Armor Master',d:'heavy armor evasion penalty halved'},
       {at:21,id:'cleaving',  name:'Cleaving Swings',d:'your attacks also hit one other adjacent enemy for half'},
       {at:25,id:'unstoppable',name:'Unstoppable',d:'immune to stun, +20% melee damage'}],
  agi:[{at:12,id:'lightFeet',name:'Light Feet',d:'+8 evasion'},
       {at:15,id:'deadeye',  name:'Deadeye',d:'+8% crit chance'},
       {at:18,id:'fleet',    name:'Fleet',d:'moving costs 15% less time'},
       {at:21,id:'keenAim',  name:'Keen Aim',d:'your attacks ignore 25% of the target\'s evasion'},
       {at:25,id:'blur',     name:'Blur',d:'an attack against you misses outright (every 20 turns)'}],
  vit:[{at:12,id:'tough',    name:'Tough',d:'+15% max HP'},
       {at:15,id:'resilient',name:'Resilient',d:'HP regeneration doubles below half HP'},
       {at:18,id:'ironConst',name:'Iron Constitution',d:'statuses on you last half as long'},
       {at:21,id:'fortitude',name:'Fortitude',d:'a hit against you is halved (every 15 turns)'},
       {at:25,id:'bulwark',  name:'Bulwark',d:'immune to critical hits; +5% resistance to non-physical damage'}],
  foc:[{at:12,id:'arcaneStudy',name:'Arcane Study',d:'+10% spell damage'},
       {at:15,id:'meditation',name:'Meditation',d:'+25% mana regeneration'},
       {at:18,id:'tidalMind', name:'Tidal Mind',d:'mana regeneration doubles below half mana'},
       {at:21,id:'magicBarrier',name:'Magic Barrier',d:'-5 damage from single-target ranged attacks'},
       {at:25,id:'archmage',  name:'Archmage',d:'+10% spell damage, +5% crit, +20% max mana'}]
};
var AOE_HIT=false;   /* set while resolving area attacks, so Magic Barrier ignores them */
function godRank(){ return player.god ? pietyRank(player.piety||0) : 0; }
function hasGod(id){ return player.god===id; }
function totalAffinity(){ var t=0; for(var k in player.aff) t+=player.aff[k]||0; return t; }
function affinityCap(){
  var base = RUN && RUN.bossDead ? 2 : 1;
  return base + ((RACES[player.race]||{}).capBonus||0);
}
function enchantScale(el){ return (1 + 0.3*((player.aff && player.aff[el])||0)) * (player.god==='anvil' ? 1 + 0.10*pietyRank(player.piety||0) : 1); }
function buff(name){ return player.buffs && player.buffs[name] > 0; }
function itemPlus(it){ return (it && it.plus||0) + (it && it.tier==='Trusty' ? 1 : 0) + (player.race==='dwarf' && it && !it.unarmed ? 1 : 0); }
function gearName(it){
  if(!it) return 'nothing';
  var n=(it.tier && it.tier!=='Rusty' ? it.tier+' ' : '') + it.name;
  if(it.plus) n+=(it.plus<0 ? ' −'+Math.abs(it.plus) : ' +'+it.plus);   /* a cursed item is -3, never "+-3" */
  if(it.enchant) n+=' of '+cap(it.enchant);
  return n;
}

/* ---------------------------------------------------------------- derived stats */
/* Dual wield (2026-09-17): an off-hand weapon strikes after the main hand for 60% damage, and the proc block
   runs off the OFF-HAND weapon's own enchant, so two differently enchanted daggers give two different procs.
   The cost of the build is the shield slot and steep Agility requirements on daggers. */
function offHandSwing(foe){
  if(!foe || foe.hp<=0 || !player.off || !player.off.weapon || player.twoHanded) return;
  var main=player.weapon;
  player.weapon=player.off;
  try{ attack(player, foe, 0.6); } finally { player.weapon=main; }
}
function derive(p){
  var race=RACES[p.race]||RACES.human, cls=CLASSES[p.cls]||CLASSES.fighter, s=p.stats;
  if(!p.buffs) p.buffs={};
  p.weapon = p.sets[p.activeSet] || FISTS;
  if(hasGod('grom') && !p.weapon.unarmed) {}   /* the rule is enforced as piety loss, not blocked */
  p.speed = race.speed;
  p.name = p.name || 'Adventurer';
  p.who = race.name+' '+cls.name + (p.god ? ' of '+GODS[p.god].name : '');
  /* abilities: class ability, then element unlocks */
  var clsAb = cls.ability==='invoke' ? (p.god ? INVOKE_OF[p.god] : null) : cls.ability;
  p.abilities = clsAb ? [clsAb] : [];
  for(var el in p.aff){
    var tiers=ELEMENT_ABILS[el]||{};
    for(var t=2;t<=6;t++) if(p.aff[el]>=t && tiers[t] && p.abilities.indexOf(tiers[t])<0) p.abilities.push(tiers[t]);
  }
  recomputePassives();
  /* 2026-09-17: HP is Vitality-driven and scales with level, so the early game is lethal and VIT is the
     defensive stat: 10 + VIT*(1 + level/5). VIT 12 -> 24 at level 1, 46 at 10; max VIT 25 -> 135 at 20. */
  p.maxhp = sHP((10 + s.vit * (1 + p.level/5)) * (hasP('tough')?1.15:1));
  /* 2026-09-17: mana mirrors the HP curve without the flat base, so Focus is the caster's stat the way
     Vitality is the fighter's: Focus x (1 + level/5). Focus 12 -> 14 at level 1, 36 at 10, 60 at 20. */
  var pool = Math.ceil(s.foc * (1 + p.level/5));
  if(p.cls==='mage') pool = Math.ceil(pool*1.3);
  if(hasP('archmage')) pool = Math.ceil(pool*1.2);
  if(p.off && p.off.manaPct) pool = Math.ceil(pool*(1+p.off.manaPct));
  if(p.god==='vellum') pool = Math.ceil(pool*(1+0.08*pietyRank(p.piety||0)));
  p.maxmp = sHP(pool);
  var rank=godRank();
  p.acc = 60 + 2*s.agi + (p.weapon.acc||0) + (hasGod('reginald')?4*rank:0) + (p.weapon.enchant==='light'?Math.round(10*enchantScale('light')):0) + (buff('rally')?10:0);
  var arm=p.armorItem||ARMORS.robe;
  var evaPen = arm.eva||0;
  if(evaPen<0 && (hasP('armorMaster') || p.race==='dwarf')) evaPen = p.race==='dwarf' ? 0 : Math.round(evaPen/2);
  p.eva = 10 + 2*s.agi + evaPen + ((p.off&&p.off.eva)||0) + (hasP('lightFeet')?8:0) + (arm.enchant==='water'?Math.round(8*enchantScale('water')):0);
  p.armor = (arm.armor||0) + (arm.armor>0 ? itemPlus(arm) : 0) + (arm.enchant==='earth'?Math.round(2*enchantScale('earth')):0)
          + (hasGod('grom')?rank:0) + (buff('ironbody')?4:0) + (buff('ironhide')?5:0);
  p.twoHanded = p.weapon.hands===2;
  var shield = p.off && p.off.block>0 && !p.twoHanded;
  /* Might braces a shield: +1% block per point above 10 (2026-09-17). Needs a shield - it is about holding
     one, not about being strong in general. */
  p.block = shield ? Math.min(0.75, p.off.block + (p.cls==='fighter'?0.15:0) + 0.02*Math.max(0, s.mig-10)) : 0;
  p.parry = (p.twoHanded || !p.off || !p.off.weapon) ? 0 : (0.08 + s.agi/300);
  p.rangeBonus = p.race==='elf' ? 1 : 0;
  p.range = p.weapon.range ? p.weapon.range + p.rangeBonus : 1;
  p.crit = 0.06 + 0.02*(s.agi-10) + (hasP('deadeye')?0.08:0) + (hasP('archmage')?0.05:0) + (p.weapon.critBonus||0);
  var plus = itemPlus(p.weapon) + (hasGod('anvil')?rank:0) + (buff('temper')?2:0) + (p.weapon.unarmed && hasGod('grom') ? rank : 0);
  p.dmg = [sDMG(p.weapon.dmg[0])+plus, sDMG(p.weapon.dmg[1])+plus];
  p.element = p.primary || Object.keys(p.aff)[0] || null;
  p.affLevel = p.element ? p.aff[p.element] : 0;
  p.iceArmorMax = (p.aff.water||0)*3;
  if(p.iceArmor===undefined) p.iceArmor=p.iceArmorMax;
  p.iceArmor=Math.min(p.iceArmor, p.iceArmorMax);
}
function costOf(A){
  if(player.buffs && player.buffs.unbound>0) return 0;
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
var FOCUS_BONUS = { staff:{base:{Rusty:0.25, Trusty:0.35}, per:0.08}, wand:{base:{Rusty:0.05, Trusty:0.08}, per:0.03},
                    orb:{base:{Rusty:0, Trusty:0}, per:0, curse:{Rusty:0.10, Trusty:0.15}, cursePer:0.04} };
var WAND_THRIFT = {base:{Rusty:0.10, Trusty:0.15}, per:0.03};
var ORB_CRIT = {base:{Rusty:0.08, Trusty:0.12}, per:0.03};
function focusKey(it){ if(!it) return null; var ic=(it.icon||'').replace(/^item-/,''); return FOCUS_BONUS[ic] ? ic : null; }
function tierOf(table, it){ return table[it.tier]!==undefined ? table[it.tier] : table.Rusty; }
function focusBonus(it){
  var k=focusKey(it); if(!k) return (it && it.spell) || 0;
  var F=FOCUS_BONUS[k];
  if(k==='orb') return it.cursed ? -(tierOf(F.curse,it) + F.cursePer*Math.abs(it.plus||0)) : 0;
  return (it.cursed ? -tierOf(F.base,it) : tierOf(F.base,it)) + F.per*(it.plus||0);
}
function wandThrift(){ var w=player.weapon; if(focusKey(w)!=='wand') return 0; var v=tierOf(WAND_THRIFT.base,w)+WAND_THRIFT.per*(w.plus||0); return w.cursed ? -Math.abs(v) : v; }
function orbCrit(){ var o=player.twoHanded ? null : player.off; if(focusKey(o)!=='orb' || o.cursed) return 0; return tierOf(ORB_CRIT.base,o)+ORB_CRIT.per*(o.plus||0); }
function staffRange(){ return focusKey(player.weapon)==='staff' ? 1 : 0; }
function spellRange(A){
  if(A.useWeaponRange) return Math.max(1, player.range);
  return A.range ? A.range + (player.rangeBonus||0) + (!A.tech && !A.divine && typeof staffRange==='function' ? staffRange() : 0) : 0;
}
function accOf(e){ return e===player ? player.acc : (e.base.acc + (e.ally?0:0)); }
function evaOf(e){ return e===player ? player.eva : e.base.eva; }
function armorOf(e){ return e===player ? player.armor : Math.max(0, (e.base.armor||0) - (e.st.hollow?e.st.hollow.n:0)); }

/* ---------------------------------------------------------------- damage */
function resistMult(target, type){
  var m=1;
  if(type==='phys') return 1;
  if(target===player){
    var arm=player.armorItem||{};
    if((arm.enchant==='fire'||arm.enchant==='air') && elemToType(arm.enchant)===type) m-=0.10*enchantScale(arm.enchant);   /* only fire and air armor resist */
    if(hasGod('grumbok')) m-=Math.min(0.4, 0.08*godRank());
    if(player.aff.water && type==='ice') m-=0.05*player.aff.water;
    m -= 0.01*Math.max(0, player.stats.vit-10) + (hasP('bulwark')?0.05:0);   /* Vitality: 1% per point above 10 */
    if(type==='magic') m=Math.max(m, 0.75);
    if(player.race==='gloomling' && type==='light') m+=0.25;
    if(player.race==='fae' && player.court && elemToType(OPPOSITE[player.court])===type) m+=0.25;
  } else {
    var b=target.base;
    if(type==='magic') return 1;
    if(b.el && elemToType(b.el)===type) m-=0.5;
    if(b.el && elemToType(OPPOSITE[b.el])===type) m+=0.5;
    if((b.undead||b.shadowy) && type==='light') m+=0.5;
  }
  if(isWet(target)){ if(type==='lightning') m+=0.5; if(type==='fire') m-=0.25; }
  if(type==='ice' && target.st && target.st.chill) m+=0.25;   /* Chilled: +25% ice damage */
  return Math.max(0, m);
}
function isWet(e){ return at(e.x,e.y)===WATER || (e.st && e.st.wet); }
function applyDamage(target, amount, type, source){
  var d=amount;
  /* Magic Barrier (Focus 21): -5 from single-target ranged attacks, applied with the other flat reductions */
  var barrier = (target===player && hasP('magicBarrier') && !AOE_HIT && source && source!=='player' && source.foe && dist(source,player)>1) ? 5 : 0;
  if(type==='phys'){
    var arm = armorOf(target);
    if(source===player && player.weapon.pierce) arm -= player.weapon.pierce;
    if(source && source.base && source.base.pierce) arm -= source.base.pierce;
    arm = Math.max(0, arm);
    var flat = Math.ceil(arm/2) + barrier;
    if(target===player && player.aff.earth) flat += player.aff.earth;
    if(target===player && player.st.stone) flat += 3;
    d = Math.max(1, d - flat) * (1 - Math.min(0.5, 0.02*arm));
    if(target.st && target.st.frozen){ d *= (target!==player && (player.aff.water||0)>=3) ? 2.5 : 2;   /* Water 3 Shatter: +50% more */
      delete target.st.frozen; if(target!==player) target.st.imm_frozen={t:3}; floatText(target.x,target.y,'shatter','ice'); }
  } else {
    var rm = resistMult(target, type);
    if(target===player && rm<1) rm = Math.max(0.25, rm);    /* total resistance capped at 75% */
    d = Math.max(0, d - barrier) * rm;
    if(d>0 && target.st && target.st.frozen){ delete target.st.frozen; if(target!==player) target.st.imm_frozen={t:3}; }
  }
  if(target===player){
    if(buff('laststand')) d*=0.65;
    if(player.ward>0 && d>0){ if(!(player.buffs.arcaneward>0)) player.ward=0; else { var wa=Math.min(player.ward, d); player.ward-=wa; d-=wa; if(wa>0) floatText(player.x,player.y,'-'+Math.round(wa),'magic'); if(player.ward<=0) log('Your Arcane Ward shatters.','c-info'); } }
    if(player.iceArmor>0 && d>0){ var ab=Math.min(player.iceArmor, d); player.iceArmor-=ab; d-=ab; if(ab>0) floatText(player.x,player.y,'-'+Math.round(ab),'ice'); }
    if(player.hideShield>0 && d>0){ var hs=Math.min(player.hideShield, d); player.hideShield-=hs; d-=hs; if(hs>0) floatText(player.x,player.y,'-'+Math.round(hs),'phys'); }   /* Grom's Iron Hide */
    if(player.mward>0 && d>0){ var mw=Math.min(player.mward, d); player.mward-=mw; d-=mw; if(mw>0) floatText(player.x,player.y,'-'+Math.round(mw),'magic'); }   /* Light tome's Mana Ward */
    if(player.guard>0 && d>0){ var gb=Math.min(player.guard, d); player.guard-=gb; d-=gb; if(gb>0) floatText(player.x,player.y,'-'+Math.round(gb),'phys'); }   /* Fighter's guard */
  }
  if(target.challenged && target.challengeBoost) d*=1.2;
  if(target.dazed>0) d*=1.5;
  d=Math.max(type==='phys'||d>0 ? 1 : 0, Math.round(d));
  target.hp -= d;
  target._hit = Math.max(performance.now(), fxClock);
  if(target===player && d>0){ setClip(player,'hurt'); sfx('player-hurt',{at:target._hit}); if(typeof onPlayerHurt==='function') onPlayerHurt(d); }
  else if(target!==player && d>0 && target.base && typeof setClip==='function' && !target._clip) setClip(target,'hurt');
  if(target===player && target.hp<=0) heroicResolve();
  if(target!==player && target.base.splits && !target.split && target.hp>0 && target.hp<target.maxhp/2) slimeSplit(target);
  return d;
}
function heroicResolve(){
  if(player.race!=='human') return;
  var key='b'+Math.floor((floorNo-1)/5);
  RUN.resolve = RUN.resolve || {};
  if(RUN.resolve[key]) return;
  RUN.resolve[key]=true; player.hp=1;
  log('<b>Heroic Resolve.</b> You refuse to fall. (Once per biome.)','c-kill');
  sparkleFx(player.x,player.y,'light',30);
}
function slimeSplit(e){
  e.split=true;
  var c=nearFree(e.x,e.y,1); if(!c) return;
  var half=Math.max(1,Math.floor(e.hp/2)); e.hp-=half;
  var s=spawn('slime',c.x,c.y); s.hp=s.maxhp=half; s.split=true; s.state='hunt'; s.name='Slimelet'; s.small=true; s.noXp=true;
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
/* Light mastery's smite: a flat 3-6. Scaling it with Light points was tried on 2026-09-18 and reverted
   the same day - it pushed the Light 6 Glimmer dagger build to 150 damage a turn, 64% clear of anything
   else. The affinity buys the proc CHANCE (10% per point); the hit itself stays small on purpose.
   combos.js's light-air double smite uses this too. */
function smiteDamage(){ return roll(3,6); }

function attack(att, def, mult, label){
  mult = mult || 1;
  LAST_HIT=null;
  if(!def || def.hp<=0) return;
  /* 2026-09-17: ask the weapon in hand, not the player's best range. With a dedicated bow slot the bow only
     occupies player.weapon while a shot is being taken (js/rangedslot.js), so a sword swing is never
     treated as a shot and never eats the bow's up-close penalty. */
  var ranged = (att.base && att.base.range>1 && dist(att,def)>1) || (att===player && ((player.weapon&&player.weapon.range)||1)>1 && dist(att,def)>1);
  var ch=hitChance(accOf(att), evaOf(def) * (att===player && hasP('keenAim') ? 0.75 : 1));
  if(att===player) player.lastAttack=true;
  if(att===player && ((player.weapon&&player.weapon.range)||1)>1 && dist(att,def)<=1) ch *= 0.7;
  if(att.st && att.st.blind) ch *= 0.6;
  if(def===player && typeof luckBonus==='function') ch -= luckBonus();   /* Lady Luck's Blessing: blows slide off */
  if(def.st && (def.st.frozen || def.st.stun)) ch = 1;
  var who = att===player ? 'You' : att.name;
  var foe = def===player ? 'you' : def.name;
  var tAt = fxClock;
  if(att===player) setClip(player, ranged ? 'ranged' : 'melee');
  else setClip(att, 'attack');
  var tSwing = Math.max(performance.now(), fxClock);   /* the release or swing frame, after the clip's windup */
  if(ranged){ boltFx(att.x,att.y,def.x,def.y,'phys',{arrow:true}); sfx('bow-shot',{at:tSwing}); }
  else { lungeFx(att, def.x, def.y); sfx('swing',{at:tSwing}); }
  if(att!==player && att.base.sfx) sfx(att.base.sfx+'-attack',{at:tSwing});
  if(def===player && hasP('blur') && player.blurCd<=0){ player.blurCd=20; log('You blur aside.','c-good'); floatText(def.x,def.y,'miss','miss'); return; }
  if(def===player && player.parry && dist(att,def)<=1 && rng()<player.parry){
    log('You parry '+att.name+'.','c-good'); sfx('parry'); floatText(def.x,def.y,'parry','miss');
    if(att.hp>0){ log('Riposte!','c-good'); attack(player, att, 0.5, 'Riposte'); }
    return;
  }
  var blocked = (def===player && player.block && rng()<player.block);
  if(rng() > ch){
    log(who+' miss'+(att===player?'':'es')+' '+foe+' <span class="roll">('+Math.round(ch*100)+'% to hit)</span>','c-miss');
    floatText(def.x, def.y, 'miss', 'miss'); sfx('miss'); if(def.state==='asleep' && att===player) def.state='hunt'; return;
  }
  var dr = att===player ? player.dmg : (att.dmg || att.base.dmg);
  var base = roll(dr[0], dr[1]) * mult;
  var surprise=false, crit=false;
  if(att===player){
    var melee = !ranged;
    /* two pools: gear bonuses add together, stat + ability bonuses add together, then the pools multiply */
    /* 2026-09-17: Might is 4% per point above 10, mirroring Focus's 4% spell damage. It covers every weapon
       attack, bows included - drawing a heavy bow is strength, not nimbleness. Spells stay with Focus. */
    var gearPool = 0, statPool = 0.04*(player.stats.mig-10);
    if(player.weapon.executioner && def.hp <= def.maxhp/2) gearPool += player.weapon.executioner;
    if(melee && hasP('heavyHands')) statPool += 0.10;
    if(melee && hasP('unstoppable')) statPool += 0.20;
    if(melee && buff('rampage')) statPool += 0.40;
    if(hasP('crushing') && def.hp <= def.maxhp/2) statPool += 0.25;
    if(def.challenged) statPool += 0.25;
    if(hasGod('glimmer') && (def.base.undead||def.base.shadowy)) statPool += 0.10*godRank();
    if(hasGod('reginald') && (def.elite||def.base.elite||def.base.boss)) statPool += 0.10*godRank();
    base *= Math.max(0.1, 1+gearPool) * Math.max(0.1, 1+statPool);
    if(player.range>1 && dist(att,def)<=1) base *= 0.6;
    if(player.weapon.unarmed && player.pummel>0){ base*=2; player.pummel--; applyStatus(def,'stun',1); }
    var unaware = def.state==='asleep' || def.st.stun || def.st.frozen || player.hidden>0 || (typeof smokeAmbush==='function' && smokeAmbush(def)) || def.surprised;
    var critCh = player.crit + (unaware && player.aff.shadow ? 0.05*player.aff.shadow : 0);
    crit = rng() < critCh;
    if(unaware){ surprise=true; base *= isScoundrel() ? 2.0 : 1.5; if(player.weapon.name.indexOf('Dagger')>=0) base*=1.2;
      if(hasGod('reginald')) pietyViolation('a surprise attack', 12); }
  } else {
    crit = !(def===player && hasP('bulwark')) && rng() < 0.05;
  }
  if(crit) base *= 1.6;
  if(blocked){ if(typeof onShieldBlock==='function') onShieldBlock(att, def, base); base *= 0.25; }
  if(def===player && hasP('fortitude') && player.fortCd<=0){ player.fortCd=15; base *= 0.5; log('Fortitude blunts the blow.','c-good'); }
  LAST_HIT={att:att, def:def, crit:crit, surprise:surprise, melee:!ranged};
  /* 2026-09-18: two different kinds of number used to share one variable. `extra` is damage still to be
     taken off at the end of the block; `applied` is damage applyDamage has ALREADY taken off (the Light
     mastery smite, and the light-air combo). Mixing them meant a smite proc was subtracted twice on any
     weapon that was not light-enchanted, while a light-enchanted weapon skipped the subtraction entirely
     and silently dropped the fire-affinity bonus and the enchant's own +25% against undead. */
  var phys=applyDamage(def, base, 'phys', att), extra=0, applied=0, note='', el=null;
  sfx(hitSfx(att,def,crit,blocked), {at:def._hit});
  if(att===player){
    var ench = player.weapon.enchant;
    if(ench){
      /* weapon infusions (review step 5): chances are 5% per point in the element unless noted.
         2026-09-18: only the earth line read enchantScale(), so Old Anvil's "enchantments 10% stronger per
         rank" quietly applied to one element out of six - an earth weapon got +50% root chance at rank 5 and
         a fire, water, shadow or air weapon got nothing. `am` is his multiplier on its own, applied to every
         line; the affinity curves themselves are untouched, so nothing changes for anyone else. */
      var sc=enchantScale(ench), pts=(player.aff[ench]||0);
      var am = (player.god==='anvil' ? 1 + 0.10*godRank() : 1);
      var roll1 = function(c){ return (typeof pRoll==='function' ? pRoll(c) : rng()<c); };
      el=ench;
      if(ench==='fire'){ extra+=Math.round(base*(0.10+0.03*pts)*am); if(roll1(0.05*pts*am)){ applyStatus(def,'burn',3,burnDmg()); note=' <span class="c-fire">burning</span>'; } }
      if(ench==='water' && roll1((0.15+0.05*pts)*am)){ addChill(def); note=' chilled'; }
      if(ench==='earth' && roll1(0.15*sc)){ applyStatus(def,'root',2); note=' rooted'; }
      if(ench==='light' && (def.base.undead||def.base.shadowy)) extra+=Math.round(base*0.25*am);
      if(ench==='shadow'){ if(def.st.hollow) extra+=1;
        if(roll1(Math.max(0.05,0.05*pts)*am)){
          extra+=Math.round(base*0.25*am); applyStatus(def,'corrupt',3); note=' <span style="color:#B58BFF">corrupted</span>';
          /* the enchant's bite IS this build's dark damage, so at Shadow 6 it is what stacks Hollow.
             Spells stack it through the applyDamage wrapper in elements.js; this is the melee half. */
          if(typeof aff==='function' && aff('shadow')>=6) addHollow(def, 1);
        } }
      if(ench==='air' && roll1(Math.max(0.05,0.05*pts)*am) && !label && def.hp>0){ note=' (gust: extra attack)'; pendingExtra=def; }
    }
    if(player.aff.fire){ el = el || 'fire'; extra += player.aff.fire; }
    if(player.aff.light && rng() < 0.10*player.aff.light + (typeof smiteBonus==='function' ? smiteBonus() : 0)){
      var sm=applyDamage(def, smiteDamage(), 'light', player); applied+=sm; el = el || 'light';
      /* the light-air combo fires a second smite, so count it before the log line is written: what the
         note reports is the whole smite, not just the first half of it (2026-09-18) */
      if(typeof onSmiteProc==='function'){ var sm2=onSmiteProc(def)||0; applied+=sm2; sm+=sm2; }
      /* Light 6 Consecration used to fire off light SPELLS only, which made it the one rank 6 capstone a
         melee build could not use - and Light 6 is the one most likely to be reached by a melee build,
         since Glimmer's free Light point (religion.js) gets a normal race there a biome early. The smite
         sanctifies the ground it strikes now, so the capstone answers a swing as well as a spell. */
      if(typeof holyG!=='undefined' && holyG && typeof aff==='function' && aff('light')>=6 && inb(def.x,def.y))
        holyG[idxOf(def.x,def.y)]=3;
      note+=' <span style="color:#FFF1B8">smite '+sm+'</span>';
      if(rng()<0.10*player.aff.light) applyStatus(def,'blind',2); sparkleFx(def.x,def.y,'light',10);
    }
    if(player.aff.shadow && def.hp>0) addHollow(def, 0);
    if(player.weapon.unarmed && hasGod('grom') && def.hp>0 && rng() < (buff('ironbody')?0.3:0) + (godRank()>=3?0.15:0)){ applyStatus(def,'stun',1); note+=' staggered'; }
    if(extra>0) { def.hp -= extra; }
  }
  if(att!==player && att.base && att.base.el){
    el = att.base.el;
    var add = Math.max(1, Math.round(base*0.25*resistMult(def, elemToType(el))));
    if(rng() < 0.22){
      if(el==='fire'){ applyStatus(def,'burn',3,sDMG(2)); note=' <span class="c-fire">burning</span>'; }
      else if(el==='water'){ addChill(def); note=' chilled'; }
      else if(el==='earth'){ applyStatus(def,'root',2); note=' rooted'; }
      else if(el==='shadow'){ applyStatus(def,'fear',2); note=' shaken'; }
      else if(el==='air'){ applyStatus(def,'stun',1); note=' stunned'; }
      else if(el==='light'){ applyStatus(def,'blind',2); note=' dazzled'; }
    }
    def.hp -= add; extra=add;
  }
  if(att.lifesteal && att.ally){ att.hp=Math.min(att.maxhp, att.hp+Math.round(phys*0.3)); }
  var total=phys+extra+applied;
  var bonus=extra+applied;
  var elTxt = bonus>0 ? ' <span class="c-fire">+'+bonus+(el?' '+el:'')+'</span>' : '';
  floatText(def.x, def.y, String(total), bonus>0 && el ? elemToType(el) : 'phys', crit);
  log((label?label+': ':'')+who+' hit '+foe+' <span class="roll">('+Math.round(ch*100)+'%'
      +(crit?', crit':'')+(surprise?', surprise':'')+(blocked?', blocked':'')+')</span> &mdash; <b>'+total+'</b>'+elTxt+note,
      att===player?'c-hit':'c-you');
  if(def!==player && def.state==='asleep') def.state='hunt';
  if(def!==player && def.living && rng()<0.3) setG(def.x,def.y,G_BLOOD);
  if(def.hp<=0){ kill(def, att); }
  else if(att===player && hasP('cleaving') && !label){
    var other=ents.filter(function(o){ return o.foe && o!==def && dist(player,o)<=1; })[0];
    if(other){ log('Your swing carries into '+other.name+'.','c-info'); attack(player, other, 0.5, 'Cleave'); }
  }
  if(att===player && pendingExtra && pendingExtra===def && def.hp>0){ pendingExtra=null; attack(player, def, 1, 'Gust'); }
  pendingExtra=null;
}
var pendingExtra=null;

/* ---------------------------------------------------------------- statuses */
function applyStatus(e,key,turns,extra){
  if(!e || e.hp<=0) return;
  if(e===player){
    if(key==='stun' && hasP('unstoppable')){ log('Unstoppable: the stun fails.','c-good'); return; }
    if(hasP('ironConst')) turns=Math.max(1,Math.round(turns/2));
  } else {
    if(e.base.boss && (key==='stun'||key==='fear'||key==='root'||key==='frozen')) turns=1;
    if(e.st['imm_'+key]) return;
  }
  var cur=e.st[key];
  if(key==='burn'){ if(at(e.x,e.y)===WATER) return; e.st.burn={t:Math.max(turns, cur?cur.t:0), d:extra||sDMG(2)}; }
  else e.st[key] = {t:Math.max(turns, cur&&cur.t||0), d:extra};
  if(key==='burn') sfx('status-burn'); else if(key==='stun') sfx('status-stun'); else if(key==='fear') sfx('status-fear');
}
function addChill(e){
  var c=e.st.chill; var n=(c?c.n:0)+1;
  if(n>=3){ delete e.st.chill; applyStatus(e,'frozen',2); if(e!==player) e.st.imm_frozen={t:5}; sfx('status-freeze'); floatText(e.x,e.y,'frozen','ice'); }
  else e.st.chill={t:4, n:n};
}
/* Hollowing (Shadow 6): n stacks are added, n=0 only refreshes a stack the target already carries - a
   melee shadow build keeps its own Hollow alive by swinging. 5 stacks, 5 turns; each is +5% damage taken
   (elements.js) and -1 armor (armorOf, above). 2026-09-18: this was an empty stub, so every call did
   nothing and a melee shadow build never saw a single stack. */
function addHollow(e, n){
  if(!e || !e.st) return;
  var h=e.st.hollow;
  if(!h && !n) return;
  e.st.hollow = {t:5, n: Math.min(5, (h?h.n:0) + (n||0))};
}
/* ---------------------------------------------------------------- healing
   2026-09-18: every heal used to be written inline as player.hp = Math.min(maxhp, hp + n), which threw the
   overflow away. Holy Water (light/water) wanted that overflow, so it had been reverse-engineering it by
   intercepting floatText and parsing the "+N" string against a mark updated in endTurn - it worked, but any
   heal that did not draw a float silently skipped the combo. healPlayer() is the single path now: it clamps,
   and it RETURNS the part that did not fit. Callers keep their own float text. */
function healPlayer(n){
  if(!player || !(n > 0)) return 0;
  var before = player.hp;
  player.hp = Math.min(player.maxhp, player.hp + n);
  return Math.max(0, n - (player.hp - before));
}

function tickStatus(e){
  var s=e.st;
  if(at(e.x,e.y)===WATER){ if(s.burn){ delete s.burn; floatText(e.x,e.y,'hiss','ice'); } s.wet={t:3}; }
  if(fireT && fireT[idxOf(e.x,e.y)]>0 && !(e===player && player.aff.fire>=6) && !(e.base && e.base.el==='fire')) applyStatus(e,'burn',3,sDMG(2));
  if(s.burn){
    var bd=Math.max(1,Math.round(s.burn.d*resistMult(e,'fire'))); e.hp -= bd; e._hit=performance.now(); floatText(e.x, e.y, String(bd), 'fire');
    if(e===player) log('Burning: '+bd+' fire damage.','c-you');
    s.burn.t--; if(s.burn.t<=0) delete s.burn;
    if(gAt(e.x,e.y)===G_GRASS || gAt(e.x,e.y)===G_SHORT) ignite(e.x,e.y, e===player?'player':null);
    if(e.hp<=0){ if(e===player){ heroicResolve(); if(player.hp<=0){ kill(e,null); return false; } } else { kill(e, e.lastHitBy||null); return false; } }
  }
  if(s.poison){ var pd=s.poison.d||2; e.hp-=pd; floatText(e.x,e.y,String(pd),'poison'); s.poison.t--; if(s.poison.t<=0) delete s.poison; if(e.hp<=0){ if(e===player){ heroicResolve(); if(player.hp<=0){ kill(e,null); return false; } } else { kill(e,null); return false; } } }
  if(s.aura && e===player){
    ents.forEach(function(o){ if(o.foe && dist(o,player)<=2){ var ad=applyDamage(o,s.aura.d||3,'dark',player); floatText(o.x,o.y,String(ad),'dark'); healPlayer(1); if(o.hp<=0) kill(o,player); } });
  }
  for(var k in s){
    if(k==='burn'||k==='poison') continue;
    if(s[k] && s[k].t!==undefined){ s[k].t--; if(s[k].t<=0){ var was=k; delete s[k]; if(was==='fear' && e!==player) s.imm_fear={t:5}; } }
  }
  return true;
}

/* ---------------------------------------------------------------- death */
function kill(e, by){
  if(e===player){ death(); return; }
  if(ents.indexOf(e)<0) return;
  ents = ents.filter(function(x){ return x!==e; });
  var seenIt = vis[idxOf(e.x,e.y)] || revealAll;
  if(seenIt) fx.push({k:'d', e:{x:e.x, y:e.y, col:e.col, sprite:e.base.sprite, art:e.base.art, flip: (player.x<e.x) !== !!e.base.artLeft},
                      t0:Math.max(performance.now(), fxClock)+60, dur:900});
  if(e.base.sfx) sfx(e.base.sfx+'-death', {at:fxClock});
  if(e.ally){ log(e.name+' falls.','c-info'); return; }
  log(e.name+' dies.','c-kill');
  var byPlayerSide = by===player || (by && by.ally) || by==='player';
  RUN.kills++;
  if(byPlayerSide && !e.noXp){
    gainXP(Math.round((e.base.xp||10) * (1 + floorNo*0.10)));
  }
  if(typeof godOnKill==='function') godOnKill(e, by);
  if(e.keyholder){ items.push({x:e.x,y:e.y,kind:'key',key:'iron'}); log('It drops an <b>iron key</b>.','c-kill'); }
  if(e.base.drop==='mote' && e.base.el){ items.push({x:e.x, y:e.y, kind:'mote', el:e.base.el}); log('It collapses into a <b>'+e.base.el+' mote</b>.','c-kill'); sparkleFx(e.x,e.y, TRAIL_EL(e.base.el), 26); }
  else if(typeof rollDrops==='function') rollDrops(e, byPlayerSide);
  else if(rng()<0.35) items.push({x:e.x,y:e.y,kind:'essence',n:ri(3,8)+floorNo});
  if(e.st.corrupt && byPlayerSide && !e.base.boss && !e.elite) raiseShade(e);
  if(e.base.boss) bossDefeated(e);
}
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
function bossDefeated(e){
  RUN.bossDead=true; floorMeta.exitOpen=true;
  log('<b>Grukk the Warchief falls.</b> The way onward opens.','c-kill');
  log('Your affinity cap rises to <b>'+affinityCap()+'</b>.','c-kill');
  for(var i=0;i<4;i++){ var c=nearFree(e.x,e.y,2)||{x:e.x,y:e.y}; items.push(i===0?{x:c.x,y:c.y,kind:'essence',n:60}:i===1?{x:c.x,y:c.y,kind:'mote',el:pick(ELEMENTS)}:(function(){ var g=randomGear(); g.x=c.x; g.y=c.y; if(g.it.plus!==undefined) g.it.plus=3; g.it.tier='Trusty'; return g; })()); }
  explosionFx(e.x,e.y); playMusic('dungeon');
  ents.forEach(function(o){ if(o.foe && o.guard) applyStatus(o,'fear',6); });
}
function gainXP(n){
  player.xp += n;
  floatText(player.x,player.y,'+'+n+' xp','xp');
  if(player.level>=20){ player.xp=Math.min(player.xp, player.xpNext-1); return; }
  while(player.xp >= player.xpNext && player.level<20){
    player.xp -= player.xpNext; player.level++; player.points++;
    if(player.cls==='tourist' && player.level%2===0) player.points++;
    if(player.race==='human' && player.level%3===0) player.points++;
    player.xpNext = typeof xpToNext==='function' ? xpToNext(player.level) : Math.round(player.xpNext*1.35);
    var old=player.maxhp; derive(player);
    player.hp += (player.maxhp-old); player.mp=player.maxmp;
    log('<b>Level '+player.level+'.</b> Stat point'+(player.points>1?'s':'')+' to spend in the Character sheet.','c-kill');
    sfx('level-up'); sparkleFx(player.x,player.y,'light',40); ringFx(player.x,player.y,'#E8B44A',2.5);
  }
}

/* ---------------------------------------------------------------- abilities */
function useAbility(i){
  var key=player.abilities[i]; if(!key) return;
  var A=ABILITIES[key];
  if(player.mp < costOf(A)){ log('Not enough mana for '+A.name+' ('+costOf(A)+').','c-info'); sfx('no-mana'); return; }
  if(A.kind==='summon' && ents.some(function(e){ return e.ally && e.undeadServant; })){ log('Your servant still stands.','c-info'); return; }
  if(A.kind==='bolt' || A.kind==='dash' || A.kind==='summon'){
    if(aiming && aiming.i===i){ cancelAim(); return; }
    aiming={i:i, A:A};
    log('<b>'+A.name+'</b> &mdash; click a target within '+spellRange(A)+' tiles, or press Esc.','c-info');
    abilityBar(); draw(); return;
  }
  if(A.kind==='melee2'){
    var m=nearestFoe(1); if(!m){ log('Nothing adjacent to strike.','c-info'); return; }
    player.mp-=costOf(A); sfx('double-strike'); attack(player,m,1,A.name); if(m.hp>0) attack(player,m,1,A.name);
    endTurn(); return;
  }
  if(A.kind==='self'){ if(castSelf(key, A)===false) return; endTurn(); return; }
}
function castSelf(key, A){
  var r=godRank(), div=1 + ((player.weapon.divine||0) + ((player.off&&player.off.divine)||0)) + 0.03*Math.max(0, player.stats.foc-10);   /* invokes: +3% per Focus above 10 */
  if(A.divine && key!=='bellow') { player.mp-=costOf(A); setClip(player,'cast'); }
  if(key==='ironbody'){ player.buffs.ironbody=6; derive(player); log('Iron Body: your skin turns hard as iron.','c-good'); sfx('earth-cast'); sparkleFx(player.x,player.y,'earth',20); }
  else if(key==='bellow'){ player.mp-=costOf(A); setClip(player,'melee'); sfx('warchief-roar');
    ents.forEach(function(e){ if(e.foe && dist(e,player)<=3) applyStatus(e,'stun',1); });
    var h=Math.round(player.maxhp*0.10*div); healPlayer(h); floatText(player.x,player.y,'+'+h,'heal'); ringFx(player.x,player.y,'#B8453A',3.5);
    log('You bellow. Everything nearby reels.','c-good'); }
  else if(key==='heal'){ var hh=Math.round(player.maxhp*(0.25+0.05*r)*div*(1+0.10*r)); healPlayer(hh);
    floatText(player.x,player.y,'+'+hh,'heal'); sparkleFx(player.x,player.y,'heal',30); sfx('heal');
    if(player.race==='gloomling'){ /* refused, but just in case */ }
    log('Saint Glimmer mends you. +'+hh+' HP.','c-good'); }
  else if(key==='arcaneward'){ player.buffs.arcaneward=10; player.ward=Math.round(player.maxmp*(0.25+0.05*r)*div); log('Arcane Ward: '+player.ward+' damage will break on the ward first.','c-good'); sfx("cast-generic"); ringFx(player.x,player.y,'#7FA8FF',2); }
  else if(key==='temper'){ player.buffs.temper=12; derive(player); log('Old Anvil tempers your '+player.weapon.name+': +2 for 12 turns.','c-good'); sfx('forge-enchant'); sparkleFx(player.x,player.y,'fire',20); }
  else if(key==='rolldice'){ sfx('wobbles-giggle'); wobblesIntervention(false); }
  return true;
}

/* targeting: bolts stop at the first creature or wall in the way */
function boltPath(ax,ay,bx,by){
  var pts=[], x=ax, y=ay, dx=Math.abs(bx-ax), dy=Math.abs(by-ay), sx=ax<bx?1:-1, sy=ay<by?1:-1, err=dx-dy;
  while(!(x===bx && y===by)){
    var e2=2*err; if(e2>-dy){ err-=dy; x+=sx; } if(e2<dx){ err+=dx; y+=sy; }
    pts.push({x:x,y:y});
    if(opaque(x,y) && !(x===bx&&y===by)) break;
    if(occupied(x,y) && !(x===bx&&y===by) && !(x===player.x&&y===player.y)) break;
  }
  return pts;
}
function previewPath(ax,ay,bx,by,A){
  if(A.kind!=='bolt') return;
  var pts=boltPath(ax,ay,bx,by); ctx.globalAlpha=0.35; ctx.fillStyle='#E8B44A';
  for(var i=0;i<pts.length-1;i++) ctx.fillRect((pts[i].x-camX+0.5)*TS-1.5,(pts[i].y-camY+0.5)*TS-1.5,3,3);
  ctx.globalAlpha=1;
}
function inRange(x,y){
  if(!aiming) return false;
  if(aiming.A.kind==='dash') return dist(player,{x:x,y:y})<=3;
  return dist(player,{x:x,y:y}) <= spellRange(aiming.A) && inb(x,y) && (revealAll || vis[idxOf(x,y)]);
}
function spellPower(A){
  var charPool = 0.04*(player.stats.foc-10) + (hasP('arcaneStudy')?0.10:0) + (hasP('archmage')?0.10:0);
  var arm=player.armorItem||{}, itemPool = focusBonus(player.weapon) + (player.twoHanded ? 0 : focusBonus(player.off));
  var godPool = player.god==='vellum' ? 0.08*godRank() : 0;
  return Math.max(0.3,(1+charPool+godPool)) * (1+itemPool);
}
function castAt(x,y){
  var cf=faceOf(x-player.x, y-player.y); if(cf) player.face=cf;
  if(!aiming) return false;
  var A=aiming.A, key=player.abilities[aiming.i];
  /* 2026-09-18: inRange() folds distance, bounds and line of sight together; say which one failed. */
  if(!inRange(x,y)){ log(((revealAll||vis[idxOf(x,y)]) ? 'Out of range.' : 'You cannot see that tile.'),'c-info'); sfx('ui-error'); return false; }
  if(A.kind==='summon') return castRaiseDead(x,y,A);
  var path=boltPath(player.x,player.y,x,y), end=path.length?path[path.length-1]:{x:x,y:y};
  var f=ents.filter(function(e){ return e.foe && e.x===end.x && e.y===end.y; })[0];
  var terrain = !f && (at(end.x,end.y)===ICEDOOR || at(end.x,end.y)===THORNS || propAt(end.x,end.y) || gAt(end.x,end.y)===G_GRASS);
  if(key==='challenge'){ if(!f){ log('Challenge whom?','c-info'); return false; } }
  if(!f && !(terrain && (A.type==='fire'||A.type==='phys'||A.type==='ice'||A.type==='lightning'))){ log(path.length && end.x!==x ? 'Something is in the way.' : 'Nothing to hit there.','c-info'); return false; }
  aiming=null; player.mp-=costOf(A);
  if(!A.tech && !A.divine && typeof spellConduct==='function') spellConduct(A);
  setClip(player, A.tech && A.useWeaponRange && player.range<=1 ? 'melee' : 'cast');
  if(key==='challenge'){
    ents.forEach(function(e){ e.challenged=false; });
    f.challenged=true; f.challengeBoost = false; f.state='hunt'; f.challengeT=12;
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
  var hit = A.always || rng() < hitChance(player.acc+10, evaOf(f));
  if(!hit){ log(A.name+' misses '+f.name+'.','c-miss'); floatText(f.x,f.y,'miss','miss'); endTurn(); return true; }
  var dmgType = A.type==='magic' ? 'magic' : A.type;
  var base;
  if(A.tech){ base = roll(A.base[0],A.base[1]) + Math.floor((player.dmg[0]+player.dmg[1])/4); }
  else base = Math.round((sDMG(roll(A.base[0],A.base[1])) + (A.perAffinity ? A.perAffinity*totalAffinity() : 0)) * spellPower(A));   /* affinity adds before spell power */
  if(key==='smite' && (f.base.undead||f.base.shadowy)) base=Math.round(base*1.5);
  if(player.aff.fire && !A.divine) base += player.aff.fire;   /* Kindled: +1 per Fire point on spells too */
  var unaware = f.state==='asleep' || f.st.stun || f.st.frozen || player.hidden>0;
  var crit = rng() < player.crit + (unaware&&player.aff.shadow?0.05*player.aff.shadow:0);   /* spells use the normal crit chance */
  if(crit) base=Math.round(base*1.6);
  else if(!A.tech && !A.divine && rng()<orbCrit()){ crit=true; base=Math.round(base*1.5); }
  var wasAsleep = f.state==='asleep';
  LAST_HIT={att:player, def:f, crit:crit, surprise:unaware, spell:true};
  var d=applyDamage(f, base, dmgType==='phys'?'phys':dmgType, player);
  if(!A.tech && !A.divine && typeof spellOnHit==='function') spellOnHit(f, d, crit, A);
  f.lastHitBy=player;
  floatText(f.x, f.y, String(d), dmgType==='phys'?'phys':dmgType, crit);
  var note='';
  if(A.status){ for(var k in A.status){
    if(k==='chill') { addChill(f); note+=' chilled'; }
    else if(k==='stun' && key==='sap'){ if(f.stunImmune){ f.state='hunt'; note+=' (immune to stuns now)'; } else { applyStatus(f,'stun', wasAsleep?6:A.status.stun); f.state='hunt'; note+=' knocked out'; } }
    else { applyStatus(f,k,A.status[k], k==='burn'?sDMG(3):undefined); note+=' '+k; } } }
  if(A.stunChance && rng()<A.stunChance){ applyStatus(f,'stun',1); note+=' stunned'; }
  if(A.blindChance && rng()<A.blindChance){ applyStatus(f,'blind',2); note+=' blinded'; }
  if(A.type==='fire'){ ignite(f.x,f.y,'player'); }
  if(f.state==='asleep' && key!=='sap') f.state='hunt';
  log(A.name+' hits '+f.name+' &mdash; <b>'+d+'</b> '+(dmgType==='phys'?'physical':dmgType)+(crit?' (crit)':'')+note,'c-hit');
  if(f.hp<=0){
    kill(f,player);
  }
  endTurn(); return true;
}
function castRaiseDead(x,y,A){
  if(!walkable(x,y) || occupied(x,y)){ log('The dead need an empty patch of floor.','c-info'); return false; }
  aiming=null; player.mp-=costOf(A); setClip(player,'cast');
  var r=godRank(), form=UNDEAD_FORMS.filter(function(u){ return u.rank<=r; }).pop() || UNDEAD_FORMS[0];
  var boost=1+0.10*r, sk=spawn('skeleton', x, y);
  sk.foe=false; sk.ally=true; sk.undeadServant=true; sk.state='ally'; sk.name=form.name; sk.col='#BFD8B0';
  sk.maxhp=sk.hp=Math.round((form.hp + 2*player.level)*boost);
  sk.dmg=[Math.round((form.dmg[0]+Math.floor(player.level/3))*boost), Math.round((form.dmg[1]+Math.floor(player.level/3))*boost)];
  sk.life=Math.round(A.life*boost); sk.taunt=!!form.taunt; sk.lifesteal=!!form.lifesteal; sk.big=form.taunt;
  sk.castSpell=form.caster||null; sk.castCd=0;
  if(form.sprite) sk.base=Object.assign({}, sk.base, {sprite:form.sprite, name:form.name, art:form.art||sk.base.art});
  log('Mother Murk answers. A <b>'+form.name+'</b> claws its way up out of the floor.','c-good');
  sfx('summon'); sparkleFx(x,y,'dark',24);
  endTurn(); return true;
}

/* ---------------------------------------------------------------- monster AI */
var PDIST=null;
function refreshPlayerDistance(){ PDIST=bfsFrom(player.x,player.y); }
function canSeePlayer(e){
  if(player.hidden>0) return false;
  if(!vis[idxOf(e.x,e.y)]) return false;
  return true;
}
function aiAct(e){
  if(!tickStatus(e)) return;
  if(e.challengeT && --e.challengeT<=0) e.challenged=false;
  if(e.st.stun || e.st.frozen){ e.t+=actCost(e); return; }
  var see = canSeePlayer(e), d=dist(e,player);
  if(e.state==='throne'){
    var rm=roomAt(player.x,player.y);
    if(see && d<=7 && rm && rm.role==='boss'){ e.state='hunt'; log('<b>'+e.name+'</b> rises from his throne with a roar!','c-you'); sfx('warchief-roar'); playMusic('boss');
      ents.forEach(function(o){ if(o.guard) o.state='hunt'; }); SHAKE=8; }
    e.t+=actCost(e); return;
  }
  if(e.state==='asleep'){
    var notice = noticeChance(e, see, d, true);
    if(rng()<notice){ e.state='hunt'; log(e.name+' notices you.','c-info'); if(e.base.sfx) sfx(e.base.sfx+'-alert'); }
    e.t+=actCost(e); return;
  }
  if(e.st.fear){ fleeStep(e); e.t+=actCost(e); return; }
  if(see && (e.state==='hunt' || e.challenged || rng()<noticeChance(e, see, d, false))) { if(e.state!=='hunt' && e.base.sfx) sfx(e.base.sfx+'-alert'); e.state='hunt'; e.lastSeen={x:player.x,y:player.y}; }
  if(e.state==='hunt'){
    /* the boss */
    if(e.base.boss && bossTurn(e, see, d)){ e.t+=actCost(e); return; }
    /* casters */
    if(e.base.caster && see && d<=e.base.castRange){
      e.castCd=(e.castCd||0)-1;
      if(e.castCd<=0){
        e.castCd=e.base.castEvery; setClip(e,'attack'); sfx('shaman-cast');
        boltFx(e.x,e.y,player.x,player.y,'fire');
        if(rng() < hitChance(e.base.acc+10, player.eva)){
          var fd=applyDamage(player, roll(5,8)+floorNo, 'fire', e); floatText(player.x,player.y,String(fd),'fire'); var brn=rng()<0.5; if(brn) applyStatus(player,'burn',3,sDMG(2));
          log(e.name+' hurls a firebolt &mdash; <b>'+fd+'</b> fire'+(brn?', burning':'')+'.','c-you');
          if(player.hp<=0) kill(player,e);
        } else { log(e.name+'\'s firebolt misses.','c-miss'); floatText(player.x,player.y,'miss','miss'); }
        e.t+=actCost(e); return;
      }
      if(d<=2){ fleeStep(e); e.t+=actCost(e); return; }
    }
    /* archers keep their distance */
    if(e.base.kiter && d<=1 && rng()<0.5 && fleeStep(e)){ e.t+=actCost(e); return; }
    if(e.base.range>1 && d<=e.base.range && see && d>1){
      var path=boltPath(e.x,e.y,player.x,player.y), end=path[path.length-1];
      if(end && end.x===player.x && end.y===player.y){ attack(e,player); e.t+=actCost(e); return; }
    }
    if(d<=1){ attack(e,player); e.t+=actCost(e); return; }
    var guard=ents.filter(function(o){ return o.ally && dist(o,e)<=1; })[0];
    if(guard && (guard.taunt || rng()<0.6)){ attack(e,guard); e.t+=actCost(e); return; }
    if(e.st.root){ e.t+=actCost(e); return; }
    if(e.base.erratic && rng()<0.35){ stepEnt(e, ri(-1,1), ri(-1,1)); e.t+=actCost(e); return; }
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
  e.t+=actCost(e);
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
  if(step==='charge' && d>=2){
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
function chaseStep(e){
  if(!PDIST) refreshPlayerDistance();
  var best=null, bd=PDIST[idxOf(e.x,e.y)]; if(bd<0) bd=999;
  var nb=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  for(var i=0;i<nb.length;i++){
    var nx=e.x+nb[i][0], ny=e.y+nb[i][1];
    if(!inb(nx,ny)) continue;
    var t=at(nx,ny), pd=PDIST[idxOf(nx,ny)];
    if(pd<0 || pd>=bd) continue;
    if(!(walkable(nx,ny) || t===DOOR)) continue;
    if(occupied(nx,ny)) continue;
    if(fireT[idxOf(nx,ny)]>0 && !(e.base.el==='fire')) continue;
    if(nb[i][0]&&nb[i][1] && (!walkable(e.x+nb[i][0],e.y) && !walkable(e.x,e.y+nb[i][1]))) continue;
    best=nb[i]; bd=pd;
  }
  if(best) stepEnt(e, best[0], best[1]); else stepToward(e, player.x, player.y);
}
function stepToward(e,tx,ty){ stepEnt(e, Math.sign(tx-e.x), Math.sign(ty-e.y)); }
function fleeStep(e){
  var nb=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]], best=null, bd=dist(e,player);
  for(var i=0;i<nb.length;i++){ var nx=e.x+nb[i][0], ny=e.y+nb[i][1]; if(!walkable(nx,ny)||occupied(nx,ny)) continue; var dd=dist({x:nx,y:ny},player); if(dd>bd){ bd=dd; best=nb[i]; } }
  if(best){ stepEnt(e,best[0],best[1]); return true; }
  return false;
}
function stepEnt(e,dx,dy){
  var tries=[[dx,dy],[dx,0],[0,dy]];
  for(var i=0;i<tries.length;i++){
    var mx=tries[i][0], my=tries[i][1];
    if(!mx && !my) continue;
    var nx=e.x+mx, ny=e.y+my;
    if(at(nx,ny)===DOOR){ setT(nx,ny,OPEN); if(vis[idxOf(nx,ny)]){ log('A door swings open.','c-info'); sfx('door-open'); } return; }
    if(!walkable(nx,ny)) continue;
    if(occupied(nx,ny)) continue;
    if(at(nx,ny)===CHASM) continue;
    e.x=nx; e.y=ny;
    if(e.base && !e.base.flying){
      if(gAt(nx,ny)===G_GRASS) setG(nx,ny,G_SHORT);
      var tr=feats.filter(function(f){ return f.x===nx && f.y===ny; })[0];
      if(tr) triggerTrap(tr,e);
      if(plates) pressPlateAt(nx,ny,e);
    }
    return;
  }
}
/* An ally following you used to take a greedy step toward your tile (stepToward), which walks straight into
   a wall whenever you are round a corner - get separated and your servant never finds you again. PDIST is
   the BFS distance field from the player that the monster AI already uses, so allies walk down it. */
function allyFollowStep(e){
  if(!PDIST) refreshPlayerDistance();
  var here=PDIST[idxOf(e.x,e.y)];
  if(here===undefined || here<0){ stepToward(e, player.x, player.y); return; }   /* not connected: do what it can */
  var nb=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]], best=null, bd=here;
  for(var i=0;i<nb.length;i++){
    var nx=e.x+nb[i][0], ny=e.y+nb[i][1];
    if(!inb(nx,ny) || occupied(nx,ny)) continue;
    if(!walkable(nx,ny) && at(nx,ny)!==DOOR) continue;
    var d=PDIST[idxOf(nx,ny)];
    if(d>=0 && d<bd){ bd=d; best=nb[i]; }
  }
  if(best) stepEnt(e, best[0], best[1]);
  else stepToward(e, player.x, player.y);
}
function allyAct(e){
  if(!tickStatus(e)) return;
  if(e.life!==undefined && !e.shade){
    e.life--;
    if(e.life<=0){ ents=ents.filter(function(o){ return o!==e; }); log('Your '+e.name+' crumbles back into the floor.','c-info'); return; }
  }
  if(e.st.stun || e.st.frozen){ e.t+=actCost(e); return; }
  var target=null, best=99;
  ents.forEach(function(o){ if(!o.foe || !vis[idxOf(o.x,o.y)]) return; var d=dist(e,o); if(d<best && d<=8){ best=d; target=o; } });
  /* a raised Lich is a caster, not a brawler: it throws shadow bolts from range and backs away when
     something closes on it (2026-09-17 - the form's caster field was never wired up before) */
  if(target && e.castSpell && best>=2 && best<=6){
    e.castCd=(e.castCd||0)-1;
    if(e.castCd<=0){
      e.castCd=2; setClip(e,'attack');
      if(typeof boltFx==='function') boltFx(e.x, e.y, target.x, target.y, 'shadow');
      var ld=applyDamage(target, roll(e.dmg[0], e.dmg[1]), 'dark', e);
      floatText(target.x, target.y, String(ld), 'dark');
      log('Your '+e.name+' hurls a shadow bolt &mdash; <b>'+ld+'</b> dark.','c-good');
      if(target.hp<=0) kill(target, e);
      e.t+=actCost(e); return;
    }
  }
  if(target && e.castSpell && best<=1 && !e.st.root){ fleeStep(e); e.t+=actCost(e); return; }
  if(target && best<=1){ attack(e, target); }
  else if(target && !e.st.root){
    var ox=e.x, oy=e.y;
    if(dist(e,player)>7) allyFollowStep(e);            /* left too far behind: catch up first */
    else {
      stepToward(e, target.x, target.y);
      if(e.x===ox && e.y===oy) allyFollowStep(e);      /* the direct step was blocked: path instead */
    }
  }
  else if(dist(e,player)>2 && !e.st.root){ allyFollowStep(e); }
  e.t+=actCost(e);
}
function actCost(e){
  var sp = e===player ? player.speed : e.base.speed;
  if(e.st && e.st.chill) sp*=0.67;
  var c = 10000/sp;
  if(e===player){
    c *= 1 - 0.02*(player.stats.agi-10);                          /* Agility: -2% per point above 10 on non-movement actions */
    if(player.lastAttack){
      var wn=(player.weapon.name||'');
      if(player.weapon.unarmed) c *= 0.80;                          /* unarmed attacks -20% time */
      else if(/Dagger/.test(wn)) c *= 0.90;                         /* daggers -10% */
      if(buff('rampage')) c *= 0.80;                                /* Grumbok's Rampage: -20% attack time */
    }
    c = Math.max(40, c);
  }
  return Math.round(c);
}
function moveCost(){
  /* movement ignores Agility and attack speed (Air and Fleet handle it) */
  var sp=player.speed; if(player.st && player.st.chill) sp*=0.67;
  var c=(10000/sp) * (hasP('fleet')?0.85:1) / (1+0.10*(player.aff.air||0));
  if(at(player.x,player.y)===WATER && !player.levitate) c*=1.25;
  return Math.round(c);
}
function nearestFoe(range){
  var best=null, bd=99;
  ents.forEach(function(e){ if(!e.foe || !vis[idxOf(e.x,e.y)]) return; var d=dist(player,e); if(d<=range && d<bd){ best=e; bd=d; } });
  return best;
}
