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
  webRoot:     1,      /* Justin: "rooted 1 turn", and one turn is what this buys. It used to say 2,
                          written when a status was ticked down before the victim ever acted; js/ticks.js
                          fixed that on 2026-09-18 and the golden fixtures confirmed it - a root of n
                          denies exactly n actions - so 2 was pinning for two. Justin, 2026-09-20: "ok 1". */
  webSlow:     3,      /* then slowed for 3 turns, starting when the root lets go */
  slowMult:    0.5,    /* "slowed 50%" */
  poisonTurns: 3,      /* Venomtouch and Venom Burst */
  webBleedTurns: 3,   /* Bleeding caused by Sylla's web */
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
  gameEffects.applyWeb(t,{rootTurns:SYLLA.webRoot,slowTurns:SYLLA.webSlow,bleedTurns:SYLLA.webBleedTurns,bleedDamage:Math.max(1,Math.round((SYLLA.poisonBase+r)*divineStrength()))});
  floatText(t.x, t.y, 'webbed', 'web');
  if(typeof sparkleFx==='function') sparkleFx(t.x, t.y, (typeof TRAIL!=='undefined' && TRAIL.web) ? 'web' : 'magic', 12);
  floatText(t.x,t.y,'bleeding','blood');
}

/* ---------------------------------------------------------------- the slow status
   Chill already scales speed inside actCost(); slow is the same idea one step harder, and it has to reach
   moveCost() as well or a slowed player would still walk at full pace. */


var _clearBadSyl = clearBad;
clearBad = function(){ _clearBadSyl(); delete player.st.slow; player.syllaWeb=0; };

/* ---------------------------------------------------------------- boons 2 and 3, and the brood's toughness
   Venomtouch and Fangs in the Dark both answer one landed blow, and a blow is one LAST_HIT: combat.js sets it
   just before the damage goes in, for a swing, a shot and a spell alike, so hooking applyDamage catches all
   three with the target's statuses still as they were before this hit. _syl marks a LAST_HIT already paid out,
   so a smite proc or the venom's own damage cannot trigger it a second time. */


/* ---------------------------------------------------------------- boon 1, the brood's bite, Into the Dark's opener */


/* a spiderling's bite is the same web you throw, and venom on top: they are Sylla's own children */
function broodBite(def){
  var r=Math.max(1, godRank());
  if(rng() < .5) syllaWeb(def, r);
  else syllaPoison(def, SYLLA.poisonTurns, r);
}

/* ---------------------------------------------------------------- the invoke */


/* ---------------------------------------------------------------- the prayers */
function prayTheBrood(){
  if(!canPray('the-brood')){ log('You cannot offer that prayer right now.','c-info'); sfx('ui-error'); return; }
  var old=ents.filter(function(e){return e.broodling;});
  var previous=ents;
  ents=ents.filter(function(e){return !e.broodling;});
  if(!nearFree(player.x,player.y,3)){ents=previous;log('There is no room for the brood.','c-info');return;}
  var r=godRank(), S=broodStats(r), got=0;
  for(var i=0;i<SYLLA.broodN;i++){
    var c=nearFree(player.x,player.y,1) || nearFree(player.x,player.y,2) || nearFree(player.x,player.y,3);
    if(!c) break;
    /* deepSpawnRaw skips the Underdark's region swap, so a spiderling stays a spiderling on floors 16-20 */
    var s=(typeof deepSpawnRaw==='function' ? deepSpawnRaw : spawn)('spiderling', c.x, c.y);
    s.foe=false; s.ally=true; s.state='ally'; s.broodling=true; s.noXp=true; s.name='Spiderling';
    s.maxhp=s.hp=Math.round(S.hp*divineStrength()); s.dmg=[Math.round(S.dmg[0]*divineStrength()), Math.round(S.dmg[1]*divineStrength())]; s.syllaResist=S.resist;
    s.base=Object.assign({}, s.base, {armor:S.armor});          /* armorOf() reads the base, so give it its own */
    s.t=player.t; s.life=fullDivineDuration(SYLLA.broodLife);   /* they are called, not kept */
    sparkleFx(c.x, c.y, (typeof TRAIL!=='undefined' && TRAIL.web) ? 'web' : 'dark', 18);
    got++;
  }
  if(!got){ents=previous;log('There is no room for the brood.','c-info');return;}
  player.favor -= PRAYERS['the-brood'].favor;
  sfx('pray'); setClip(player,'cast'); ringFx(player.x, player.y, GODS.sylla.color, 2.5); sfx('summon');
  log('<b>The Brood.</b> '+got+' spiderling'+(got>1?'s':'')+' scuttle out of the dark for '+SYLLA.broodLife+' turns: '+S.hp+' HP, '+S.dmg[0]+'-'+S.dmg[1]+', armour '+S.armor+', '+Math.round(S.resist*100)+'% resistance.','c-good');
  endTurn();
}
function prayVenomBurst(){
  if(!canPray('venom-burst'))return;player.favor-=25;sfx('pray');setClip(player,'cast');ringFx(player.x,player.y,'#91B856',3);sparkleFx(player.x,player.y,'poison',40);
  ents.slice().forEach(function(e){if(e.foe&&e.hp>0&&dist(e,player)<=3){spellHit(e,VENOM_BURST,Math.round(roll(5*godRank(),5*godRank()+6)*divineStrength()),'poison');if(e.hp>0){syllaPoison(e,3,godRank());applyStatus(e,'blind',3);}finishHit(e);}});endTurn();
}

/* ---------------------------------------------------------------- piety */


/* ---------------------------------------------------------------- her rule
   No fire (affinity, enchantment, sigil, spell or a torch put to the grass), no shields, nothing heavier
   than leather. The amounts match the other gods' violations in gods.js. */
function syllaFireSigil(use){
  var S = (typeof SIGILS!=='undefined') && SIGILS[use];
  if(!S || !S.motes) return false;
  if(S.motes.length >= ELEMENTS.length) return false;      /* the grand sigils take one of everything */
  return S.motes.indexOf('fire') >= 0;
}


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


/* Named floor-generation stages; ordered by generation-adapter.js. */
function resetGeneratedConcealment(seed){  if(player) player.syllaDark=0; return; }
