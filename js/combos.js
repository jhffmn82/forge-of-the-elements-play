/* =====================================================================
   combos.js - the 24 two-element combinations (mechanics review 2026-09-16,
   DESIGN.md 12 step 7). A combo unlocks at primary 3 / secondary 2, in
   that order; 3/3 unlocks both orders. Mostly passive; aimed at ranged
   enemies, elites and bosses, disengaging and attrition.
   ===================================================================== */

var COMBOS = {
  'fire/earth':  {name:'Magma Answer',  d:'When a ranged attack or spell hurts you, lava erupts under the attacker: Rooted 1 turn and Burning.'},
  'fire/air':    {name:'Fanned Flames', d:'Burning enemies take their burn damage again each time they move.'},
  'fire/light':  {name:'Purging Flame', d:'Enemies you set Burning are also Blinded.'},
  'fire/shadow': {name:'Black Flame',   d:'Burning on enemies ignores fire resistance, and each tick adds a Hollow stack.'},
  'water/air':   {name:'Squall',        d:'Enemies you Chill are pushed 1 tile away from you.'},
  'water/earth': {name:'Permafrost',    d:'Rooted enemies gain a Chill stack each turn they stay rooted.'},
  'water/light': {name:'Clear Waters',  d:'When Ice Armor absorbs damage, heal 25% of the amount absorbed.'},
  'water/shadow':{name:'Numbing Dark',  d:'Your attacks and spells against Chilled enemies count as surprise attacks.'},
  'air/fire':    {name:'Friction',      d:'Every 3rd weapon hit in a row on the same target sets it Burning.'},
  'air/shadow':  {name:'Windwalker',    d:'When an enemy hits you in melee, you step 1 tile away at once (every 5 turns).'},
  'air/water':   {name:'Riptide',       d:'Your weapon hits push enemies 1 tile; slammed into a wall or creature, they are Chilled.'},
  'air/light':   {name:'Glint',         d:'Your critical hits Blind the target for 1 turn.'},
  'earth/fire':  {name:'Forge Heat',    d:'Every blow you land stokes the heat: +2 damage and +2 armour per stack, up to 5. The heat fades three turns after you stop swinging.'},
  'earth/light': {name:'Radiant Roots', d:'Rooted enemies are also Blinded.'},
  'earth/shadow':{name:'Blight',        d:'Poisoned enemies deal 20% less damage.'},
  'earth/water': {name:'Silt Shield',   d:'Max Ice Armor +3 per Earth point, refilling twice as fast out of combat.'},
  'light/fire':  {name:'Searing Light', d:'Smite procs set the target Burning.'},
  'light/water': {name:'Holy Water',    d:'Healing beyond your max HP becomes Ice Armor (up to its max).'},
  'light/air':   {name:'Swift Judgment',d:'Smite procs strike twice.'},
  'light/earth': {name:'Beacon Root',   d:'A Smite proc against an enemy with a ranged attack Roots it for 1 turn.'},
  'shadow/fire': {name:'Smolder',       d:'Killing a Burning enemy hides you for 2 turns.'},
  'shadow/water':{name:'Frostshade',    d:'Surprise attacks Freeze the target at once (bosses: 2 Chill stacks).'},
  'shadow/air':  {name:'Shadow Gust',   d:'After a surprise attack, your next step takes no time.'},
  'shadow/earth':{name:'Venom Strike',  d:'Surprise attacks poison the target (10% of max HP a turn for 3 turns).'}
};
function combo(a, b){ return aff(a)>=3 && aff(b)>=2; }
function combosHeld(){ return Object.keys(COMBOS).filter(function(k){ var p=k.split('/'); return combo(p[0],p[1]); }); }

/* ---------------------------------------------------------------- statuses */
/* ---------------------------------------------------------------- enemies moving: Fanned Flames; Permafrost */


/* ---------------------------------------------------------------- damage in and out */


/* ---------------------------------------------------------------- attacks: Friction, Riptide, Glint, surprise combos, Windwalker */


function afterPlayerHit(def, H){
  var alive=def.hp>0 && ents.indexOf(def)>=0;
  if(H.crit && alive && combo('air','light')) applyStatus(def,'blind',1);
  if(H.surprise && alive){
    if(combo('shadow','water')){ if(def.base.boss){ addChill(def); addChill(def); } else { delete def.st.imm_frozen; applyStatus(def,'frozen',2); floatText(def.x,def.y,'frozen','ice'); } }
    if(combo('shadow','earth') && typeof applyPoison==='function') applyPoison(def, false, 3);   /* the card says 3 turns (2026-09-22 audit) */
  }
  if(H.surprise && combo('shadow','air')) player.freeStep=true;
  if(!H.spell && H.melee!==false){
    if(combo('air','fire') && alive){
      var fr=player.friction && player.friction.def===def ? player.friction : (player.friction={def:def, n:0});
      fr.n++; if(fr.n>=3){ fr.n=0; applyStatus(def,'burn',3,burnDmg()); floatText(def.x,def.y,'friction','fire'); }
    }
    if(combo('air','water') && alive && H.melee && !def.base.boss){
      var kx=def.x+Math.sign(def.x-player.x), ky=def.y+Math.sign(def.y-player.y);
      if(walkable(kx,ky) && !occupied(kx,ky)){ def.x=kx; def.y=ky; } else addChill(def);
    }
  }
}
/* 2026-09-23 (audit): the spell paths ask this; the cast wrapper below still sets hidden=1 so the crit side follows */
function numbingDark(f){ return !!(f && f.st && f.st.chill && combo('water','shadow')); }


/* Smite procs: Searing Light, Swift Judgment, Beacon Root */
function onSmiteProc(def){
  var extra=0;
  if(def.hp>0 && combo('light','fire')) applyStatus(def,'burn',3,burnDmg());
  if(def.hp>0 && combo('light','earth') && (def.base.range>1 || def.base.caster || def.base.spellcaster)) applyStatus(def,'root',1);   /* 2026-09-22 audit: spellcasters are ranged attackers too */
  if(def.hp>0 && combo('light','air')){ extra=applyDamage(def, smiteDamage(), 'light', player); sparkleFx(def.x,def.y,'light',10); }
  return extra;
}

/* ---------------------------------------------------------------- kills: Smolder */


/* ---------------------------------------------------------------- Forge Heat (earth/fire)
   2026-09-18: replaces Molten Orbs, which formed one orb every 50 turns that any single attack ate the
   turn after it appeared - about 25 damage absorbed per 50 turns, against per-hit or per-turn effects on
   every other 3/3 combo. Now every blow that LANDS stokes the heat: +2 damage and +2 armour a stack, five
   stacks maximum, and the whole lot cools three turns after you stop swinging. A dual-wielder reaches the
   cap in under two turns, a two-hander in five; the ceiling is the same either way. */
var FORGE_HEAT_MAX = 5, FORGE_HEAT_TURNS = 3;
function forgeHeatStacks(){ return (player && player.forgeHeat) ? player.forgeHeat.n : 0; }
function stokeForgeHeat(){
  if(!combo('earth','fire')) return;
  var was = forgeHeatStacks();
  player.forgeHeat = {n: Math.min(FORGE_HEAT_MAX, was+1), t: FORGE_HEAT_TURNS};
  if(player.forgeHeat.n !== was){
    derive(player);
    if(player.forgeHeat.n === FORGE_HEAT_MAX && was === FORGE_HEAT_MAX-1)
      log('<b>The forge heat is white-hot.</b> +'+(2*FORGE_HEAT_MAX)+' damage and armour.','c-good');
  }
}


/* ---------------------------------------------------------------- the turn: orbs, Silt Shield, Permafrost, Holy Water, Shadow Gust */


function turnComboAfterAction(context){  var fighting=ents.some(function(e){ return e.foe && e.state==='hunt' && vis[idxOf(e.x,e.y)]; });
  /* Forge Heat cools three turns after the last blow landed */
  if(player.forgeHeat){
    if(--player.forgeHeat.t <= 0){ player.forgeHeat=null; derive(player); log('The forge heat fades.','c-info'); }
  }
  if(combo('earth','water') && !fighting && player.iceArmor<player.iceArmorMax) player.iceArmor=Math.min(player.iceArmorMax, player.iceArmor+context.cost/100);   /* "refilling twice as fast": the base refill is one a turn (2026-09-22 audit) */
  if(combo('water','earth')) ents.slice().forEach(function(e){ if(e.foe && e.hp>0 && e.st.root) addChill(e); });

}
/* Holy Water: overheal becomes Ice Armor. Heals report themselves as "+N" heal numbers. */
/* Holy Water: overheal becomes Ice Armor. healPlayer() hands back exactly the part that did not fit, so
   this no longer has to parse a "+N" float against a mark kept in endTurn (2026-09-18). */


/* ---------------------------------------------------------------- the character sheet */
