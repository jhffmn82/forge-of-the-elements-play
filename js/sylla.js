/* =====================================================================
   sylla.js - Sylla the Patient, mother of the brood (2026-09-20).
   The ninth god. Justin's son asked for a spider goddess, and Justin settled
   every line of her; the numbers below are his. The handful he did not set
   are marked PLACEHOLDER and are the only things to argue about.

   She is the patient hunter: web something so it cannot answer, let the venom
   work, and open from the dark. That needs two things the engine did not have:

     1. a `slow` status. The game had Root (no movement at all) and Chill
        (x0.67 speed), but no partial slow, and the web is "rooted, then
        slowed by half". `slow` halves a creature's speed the way Chill
        shaves it, in actCost() and moveCost().
     2. a second boon-rank table. Every other god unlocks boons at 1 / 3 / 5,
        with the third boon doubling as the rank-5 reward. Sylla has three
        boons AND a rank-5 reward, so her boons unlock at 1 / 2 / 3 / 5.
        gods.js asks godBoonRanks() for a god's own table; Saint Glimmer
        takes the same shape in religion.js now that Undying Light has moved
        down to rank 3.

   Art: shrine-sylla (the shrine and the god card), ic-into-the-dark,
   pr-the-brood, pr-venom-burst, st-web, st-bleed - all in the packed set.
   The brood are Underdark Spiderlings (m-spiderling, deepmobs.js), drawn at
   their own art:0.5, which is what "make sure the spiderlings are tiny too"
   asks for.
   ===================================================================== */

/* ---------------------------------------------------------------- tunables */
var SYLLA = {
  webChance:   0.10,   /* per piety rank: 10% at rank 1, 50% at rank 5 */
  webRoot:     2,      /* Justin: "rooted 1 turn". A status is ticked down at the START of the
                          victim's turn, so a 1-turn root is spent before it ever stops a step;
                          2 is one turn of actually being pinned. */
  webSlow:     3,      /* then slowed for 3 turns, starting when the root lets go */
  slowMult:    0.5,    /* "slowed 50%" */
  poisonTurns: 3,      /* anything you web, and a surprise attack or a crit at rank 3 */
  poisonBase:  2,      /* PLACEHOLDER: poison damage a turn = 2 + your piety rank */
  darkTurns:   3,      /* Into the Dark */
  darkPerRank: 0.10,   /* +10% on the strike out of the dark, per rank - rank makes it stronger, never cheaper */
  burstRange:  3,      /* Venom Burst */
  burstBlind:  3,      /* PLACEHOLDER: Justin set the range, not the blind's length */
  broodN:      3,      /* The Brood */
  broodLife:   30,     /* Justin: the spiderlings last 30 turns and then go back into the dark */
  pietyKill:   2, pietyBig:15,   /* the same shape as every other god's kills */
  pietySurprise:1, pietyUnseen:2,/* PLACEHOLDER: per surprise attack, doubled while unseen. Kept small -
                                    Grom's per-hit piety put him a whole biome ahead (gods.js, 2026-09-17). */
  violation:15, sigilViolation:10, fuseViolation:30
};
/* the brood scale with your rank: HP 5+5, damage 2-10 +2 on both ends, armour 2+2, resistance 5%+5% */
function broodStats(r){ return {hp:5+5*r, dmg:[2+2*r, 10+2*r], armor:2+2*r, resist:0.05+0.05*r}; }

/* ---------------------------------------------------------------- the god */
GODS.sylla = {
  name:'Sylla the Patient', title:'mother of the brood', sprite:'shrine-sylla', color:'#B81A3A',
  rule:'No fire: no fire affinity, fire enchantments or fire sigils, and nothing of hers set alight. No shields, and nothing heavier than leather.',
  invoke:'intothedark', prayers:['the-brood','venom-burst'],
  /* 2026-09-20: Justin - three boons, at ranks 1, 3 and 5, with poison on attack as the one at 3. The separate
     "surprise attacks and crits poison" boon is folded away; Venomtouch covers the poison. */
  boonRanks:[1,3,5],
  boons:['Web on Hit: every hit has a 10% chance per rank to web what you strike - rooted for a turn, then moving at half speed for three.',
         'Venomtouch: your attacks poison - weapon, bow or spell. +1 poison damage per rank against anything that already carries a status, and anything you web is poisoned for 3 turns.',
         'The Long Patience: every status you inflict lasts one round longer.'],
  gain:'Kills of the webbed, the rooted and the poisoned, and every surprise attack - worth more while nothing can see you.'
};
ABILITIES.intothedark = {name:'Into the Dark', cost:8, kind:'self', icon:'ic-into-the-dark', divine:true, god:'sylla',
  desc:'Invoke (Sylla): you vanish for 3 turns and everything hunting you loses the trail. Your first strike out of the dark is a surprise attack, +10% damage per piety rank.'};
INVOKE_OF.sylla = 'intothedark';
PRAYERS['the-brood']   = {name:'The Brood', favor:20, rank:2, desc:'Three spiderlings tear up out of the floor and fight for you. Their bites web and poison, and they grow with your rank.'};
PRAYERS['venom-burst'] = {name:'Venom Burst', favor:25, rank:4, desc:'Every enemy within 3 tiles is poisoned and blinded.'};

/* the web icon covers both halves of it; Bleed finally has the icon it was waiting for (deepmobs.js) */
if(typeof STATUS_INFO!=='undefined'){
  STATUS_INFO.slow = {name:'Webbed', icon:'st-web', bad:1, d:'Tangled in silk: moves and acts at half speed.'};
  if(STATUS_INFO.bleed) STATUS_INFO.bleed.icon='st-bleed';
}
if(typeof DMG_COL!=='undefined' && !DMG_COL.web) DMG_COL.web='#F2F0E8';

/* ---------------------------------------------------------------- helpers */
function syllaOn(){ return hasGod('sylla'); }
function syllaStatused(e){
  var s=e && e.st; if(!s) return false;
  for(var k in s){ if(k.indexOf('imm_')===0) continue; if(s[k] && (s[k].t===undefined || s[k].t>0)) return true; }
  return false;
}
function syllaPoison(t, turns, r){
  if(!t || t.hp<=0 || t===player) return;
  applyStatus(t, 'poison', turns||SYLLA.poisonTurns, sDMG(SYLLA.poisonBase + (r===undefined ? godRank() : r)));
  floatText(t.x, t.y, 'poisoned', 'poison');
}
/* the web: pinned for a turn, then half speed for three. The slow is held back in e.syllaWeb and laid on
   when the root lets go (tickStatus below), so the two halves read as one effect instead of stacking. */
function syllaWeb(t, r){
  if(!t || t.hp<=0 || t===player) return;
  r = (r===undefined ? godRank() : r);
  applyStatus(t, 'root', SYLLA.webRoot);
  t.syllaWeb = SYLLA.webSlow;
  floatText(t.x, t.y, 'webbed', 'web');
  if(typeof sparkleFx==='function') sparkleFx(t.x, t.y, (typeof TRAIL!=='undefined' && TRAIL.web) ? 'web' : 'magic', 12);
  if(r>=3) syllaPoison(t, SYLLA.poisonTurns, r);   /* Venomtouch: what you web, you poison */
}

/* ---------------------------------------------------------------- the slow status
   Chill already scales speed inside actCost(); slow is the same idea one step harder, and it has to reach
   moveCost() as well or a slowed player would still walk at full pace. */
var _actCostSyl = actCost;
actCost = function(e){
  var c=_actCostSyl(e);
  if(e && e.st && e.st.slow) c=Math.round(c/SYLLA.slowMult);
  return c;
};
var _moveCostSyl = moveCost;
moveCost = function(){
  var c=_moveCostSyl();
  if(player && player.st && player.st.slow) c=Math.round(c/SYLLA.slowMult);
  return c;
};
var _clearBadSyl = clearBad;
clearBad = function(){ _clearBadSyl(); delete player.st.slow; player.syllaWeb=0; };

/* rank 5, The Long Patience: every status you put on an enemy runs a round longer */
var _applyStatusSyl = applyStatus;
applyStatus = function(e, key, turns, extra){
  if(e && e!==player && e.foe && syllaOn() && godRank()>=5 && turns>0) turns=turns+1;
  return _applyStatusSyl(e, key, turns, extra);
};
/* the held-back half of the web goes on the moment the root expires */
var _tickStatusSyl = tickStatus;
tickStatus = function(e){
  var r=_tickStatusSyl(e);
  if(r!==false && e && e.hp>0 && e.syllaWeb>0 && !(e.st && e.st.root)){ var n=e.syllaWeb; e.syllaWeb=0; applyStatus(e, 'slow', n); }
  return r;
};

/* ---------------------------------------------------------------- boons 2 and 3, and the brood's toughness
   Venomtouch and Fangs in the Dark both answer one landed blow, and a blow is one LAST_HIT: combat.js sets it
   just before the damage goes in, for a swing, a shot and a spell alike, so hooking applyDamage catches all
   three with the target's statuses still as they were before this hit. _syl marks a LAST_HIT already paid out,
   so a smite proc or the venom's own damage cannot trigger it a second time. */
var _applyDamageSyl = applyDamage;
applyDamage = function(target, amount, type, source){
  if(target && target.syllaResist>0 && amount>0) amount *= (1 - target.syllaResist);
  var d=_applyDamageSyl(target, amount, type, source);
  if(!syllaOn() || !target || target===player || target.ally || target.hp===undefined) return d;
  var L=LAST_HIT;
  if(!L || L.att!==player || L.def!==target || L._syl) return d;
  L._syl=true;
  /* 2026-09-20: Venomtouch is the rank 3 boon now (Justin: "the boon at 3 was supposed to be poison on attack").
     From rank 3 every strike of yours poisons, and it bites harder against anything already suffering. */
  var r=godRank();
  if(r>=3 && target.hp>0){
    syllaPoison(target, SYLLA.poisonTurns, r);
    if(syllaStatused(target) && target.hp>0){
      var vd=_applyDamageSyl(target, r, 'poison', player);        /* +1 poison damage per rank */
      if(vd>0) floatText(target.x, target.y, String(vd), 'poison');
    }
  }
  return d;
};

/* ---------------------------------------------------------------- boon 1, the brood's bite, Into the Dark's opener */
var _attackSyl = attack;
attack = function(att, def, mult, label){
  mult = mult || 1;
  var dark = (att===player && syllaOn() && player.syllaDark>0 && def && def.hp>0) ? player.syllaDark : 0;
  if(dark) mult *= 1 + SYLLA.darkPerRank*dark;
  var hp0 = def ? def.hp : 0;
  var r = _attackSyl(att, def, mult, label);
  if(dark){ player.syllaDark=0; log('<b>Into the Dark.</b> You come out of the black: +'+Math.round(SYLLA.darkPerRank*dark*100)+'% on the strike.','c-good'); }
  if(!def || !(def.hp < hp0)) return r;                            /* it missed, or nothing landed */
  if(att===player && syllaOn()){
    var gr=godRank();
    if(gr>0 && def.hp>0 && rng() < SYLLA.webChance*gr) syllaWeb(def, gr);
    if(LAST_HIT && LAST_HIT.att===player && LAST_HIT.def===def && LAST_HIT.surprise)
      gainPiety(player.hidden>0 ? SYLLA.pietyUnseen : SYLLA.pietySurprise);
  }
  if(att && att.broodling && def!==player && def.hp>0) broodBite(def);
  return r;
};
/* a spiderling's bite is the same web you throw, and venom on top: they are Sylla's own children */
function broodBite(def){
  var r=Math.max(1, godRank());
  if(rng() < SYLLA.webChance*r) syllaWeb(def, r);
  else syllaPoison(def, SYLLA.poisonTurns, r);   /* PLACEHOLDER: Justin said "web on attack and poison", not how often */
}

/* ---------------------------------------------------------------- the invoke */
var _castSelfSyl = castSelf;
castSelf = function(key, A){
  if(key==='intothedark'){
    var r=godRank();
    player.mp -= costOf(A); setClip(player,'cast');
    player.hidden = Math.max(player.hidden||0, SYLLA.darkTurns);
    ents.forEach(function(e){ if(e.foe && e.state==='hunt'){ e.state='wander'; e.lastSeen=null; } });
    player.syllaDark = r;
    sfx('vanish'); sparkleFx(player.x, player.y, 'dark', 30); ringFx(player.x, player.y, GODS.sylla.color, 2.5);
    log('<b>Into the Dark.</b> The dark closes over you for '+SYLLA.darkTurns+' turns; nothing can keep your trail. Your next strike comes out of it'+
        (r ? ' (+'+Math.round(SYLLA.darkPerRank*r*100)+'%)' : '')+'.','c-good');
    return true;
  }
  return _castSelfSyl(key, A);
};

/* ---------------------------------------------------------------- the prayers */
function prayTheBrood(){
  if(!canPray('the-brood')){ log('You cannot offer that prayer right now.','c-info'); sfx('ui-error'); return; }
  var r=godRank(), S=broodStats(r), got=0;
  for(var i=0;i<SYLLA.broodN;i++){
    var c=nearFree(player.x,player.y,1) || nearFree(player.x,player.y,2) || nearFree(player.x,player.y,3);
    if(!c) break;
    /* deepSpawnRaw skips the Underdark's region swap, so a spiderling stays a spiderling on floors 16-20 */
    var s=(typeof deepSpawnRaw==='function' ? deepSpawnRaw : spawn)('spiderling', c.x, c.y);
    s.foe=false; s.ally=true; s.state='ally'; s.broodling=true; s.noXp=true; s.name='Spiderling';
    s.maxhp=s.hp=S.hp; s.dmg=[S.dmg[0], S.dmg[1]]; s.syllaResist=S.resist;
    s.base=Object.assign({}, s.base, {armor:S.armor});          /* armorOf() reads the base, so give it its own */
    s.t=player.t; s.life=SYLLA.broodLife;   /* they are called, not kept */
    sparkleFx(c.x, c.y, (typeof TRAIL!=='undefined' && TRAIL.web) ? 'web' : 'dark', 18);
    got++;
  }
  if(!got){ log('There is no room for the brood.','c-info'); return; }
  player.favor -= PRAYERS['the-brood'].favor;
  sfx('pray'); setClip(player,'cast'); ringFx(player.x, player.y, GODS.sylla.color, 2.5); sfx('summon');
  log('<b>The Brood.</b> '+got+' spiderling'+(got>1?'s':'')+' scuttle out of the dark for '+SYLLA.broodLife+' turns: '+S.hp+' HP, '+S.dmg[0]+'-'+S.dmg[1]+', armour '+S.armor+', '+Math.round(S.resist*100)+'% resistance.','c-good');
  endTurn();
}
function prayVenomBurst(){
  if(!canPray('venom-burst')){ log('You cannot offer that prayer right now.','c-info'); sfx('ui-error'); return; }
  player.favor -= PRAYERS['venom-burst'].favor;
  var r=godRank(), n=0;
  sfx('pray'); setClip(player,'cast'); ringFx(player.x, player.y, GODS.sylla.color, 3.5);
  sparkleFx(player.x, player.y, 'poison', 40);
  ents.forEach(function(e){
    if(!e.foe || dist(e,player) > SYLLA.burstRange) return;
    syllaPoison(e, SYLLA.poisonTurns, r); applyStatus(e, 'blind', SYLLA.burstBlind); n++;
  });
  log('<b>Venom Burst.</b> A hiss of venom goes out around you'+(n ? ': '+n+' poisoned and blinded.' : ', and finds nothing.'),'c-good');
  endTurn();
}
var _usePrayerSyl = usePrayer;
usePrayer = function(pid){
  if(pid==='the-brood') return prayTheBrood();
  if(pid==='venom-burst') return prayVenomBurst();
  return _usePrayerSyl(pid);
};

/* ---------------------------------------------------------------- piety */
var _godOnKillSyl = godOnKill;
godOnKill = function(e, by){
  _godOnKillSyl(e, by);
  if(!syllaOn() || !e) return;
  var byPlayer = by===player || by==='player', byAlly = by && by.ally;
  if(!(byPlayer || byAlly)) return;
  var s=e.st||{}, held = s.slow || s.root || s.poison || e.syllaWeb>0;
  if(!held) return;
  var big = e.elite || (e.base && (e.base.elite || e.base.boss));
  gainPiety(SYLLA.pietyKill + (big ? SYLLA.pietyBig : 0));
};

/* ---------------------------------------------------------------- her rule
   No fire (affinity, enchantment, sigil, spell or a torch put to the grass), no shields, nothing heavier
   than leather. The amounts match the other gods' violations in gods.js. */
function syllaFireSigil(use){
  var S = (typeof SIGILS!=='undefined') && SIGILS[use];
  if(!S || !S.motes) return false;
  if(S.motes.length >= ELEMENTS.length) return false;      /* the grand sigils take one of everything */
  return S.motes.indexOf('fire') >= 0;
}
var _godConductEquipSyl = godConductEquip;
godConductEquip = function(kind, data){
  var r=_godConductEquipSyl(kind, data);
  if(syllaOn() && data){
    if(data.enchant==='fire') pietyViolation('fire-touched gear', SYLLA.violation);
    if(kind==='off' && data.block>0) pietyViolation('you carrying a shield', SYLLA.violation);
    if(kind==='armor' && data.weight && data.weight!=='cloth' && data.weight!=='light')
      pietyViolation('you wearing armor heavier than leather', SYLLA.violation);
  }
  return r;
};
var _spellConductSyl = spellConduct;
spellConduct = function(A){
  if(syllaOn() && A && (A.el==='fire' || A.type==='fire')) pietyViolation('fire magic', SYLLA.violation);
  return _spellConductSyl(A);
};
var _sigilConductSyl = sigilConduct;
sigilConduct = function(use){
  if(syllaOn() && syllaFireSigil(use)) pietyViolation('a fire sigil', SYLLA.sigilViolation);
  return _sigilConductSyl(use);
};
var _fuseMoteSyl = fuseMote;
fuseMote = function(el){
  if(syllaOn() && el==='fire' && !fuseCheck(el)) pietyViolation('you taking Fire into yourself', SYLLA.fuseViolation);
  return _fuseMoteSyl(el);
};
/* "she will not have you setting things alight": once a turn, so a single fire spell is not billed twice */
var _igniteSyl = ignite;
ignite = function(x, y, src){
  if(src==='player' && syllaOn() && player.syllaBurnT!==turn && inb(x,y) && !fireT[idxOf(x,y)]){
    var g=gAt(x,y), p=propAt(x,y);
    if(g===G_GRASS || g===G_SHORT || (typeof G_WEB!=='undefined' && g===G_WEB) || (p && p.burn)){
      player.syllaBurnT=turn; pietyViolation('you setting the world alight', SYLLA.sigilViolation);
    }
  }
  return _igniteSyl(x, y, src);
};
/* fire in you already: she wants no part of it, the way Saint Glimmer wants no part of shadow */
var _godRefusesSyl = godRefuses;
godRefuses = function(id){ return (id==='sylla' && (player.aff.fire||0)>0) ? true : _godRefusesSyl(id); };
var _refusalTextSyl = refusalText;
refusalText = function(id){
  if(id==='sylla' && (player.aff.fire||0)>0) return 'Sylla will not take fire into her brood.';
  return _refusalTextSyl(id);
};

/* ---------------------------------------------------------------- housekeeping
   Into the Dark's opener and a half-thrown web do not survive leaving the floor or abandoning her. */
var _joinGodSyl = joinGod;
joinGod = function(id, startPiety){
  var r=_joinGodSyl(id, startPiety);
  if(id!=='sylla'){ player.syllaDark=0; }
  return r;
};
var _generateSyl = generate;
generate = function(seed){ var r=_generateSyl.apply(this, arguments); if(player) player.syllaDark=0; return r; };
