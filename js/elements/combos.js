/* =====================================================================
   combos.js - the 24 two-element combinations (mechanics review 2026-09-16,
   docs/design/game-design.md 12 step 7). A combo unlocks at primary 3 / secondary 2, in
   that order; 3/3 unlocks both orders. Mostly passive; aimed at ranged
   enemies, elites and bosses, disengaging and attrition.
   ===================================================================== */

var COMBOS = {
  'fire/earth':  {name:'Magma Answer',  d:'Taking ranged or spell damage Roots the attacker for 3 turns and inflicts Burning. Bosses: Root 1 turn.'},
  'fire/air':    {name:'Fanned Flames', d:'Your critical weapon and spell hits inflict Burning for 3 turns.'},
  'fire/light':  {name:'Purging Flame', d:'Applying or refreshing Burning also Blinds the enemy for that application’s duration.'},
  'fire/shadow': {name:'Black Flame',   d:'Your surprise weapon and spell hits inflict Burning and Corruption for 3 turns.'},
  'water/air':   {name:'Chill Arc',     get d(){var a=FoteDamage.chillArc({water:3,air:3});return 'Chill from your weapon or spell hits arcs half the landed hit as lightning to up to '+a.targets+' nearby foes within '+a.range+' tiles. Ground and non-damaging Chill do not arc.';}},
  'water/earth': {name:'Permafrost',    d:'Rooted enemies gain a Chill stack each turn they stay rooted.'},
  'water/light': {name:'Clear Waters',  get d(){return 'Your weapon and spell hits against Frozen enemies deal '+(FoteDamage.frozenHoly().damageMultiplier*100)+'% of the landed damage again as Holy damage. Holy resistance applies.';}},
  'water/shadow':{name:'Numbing Dark',  d:'Attacks and spells against Chilled enemies count as surprise attacks.'},
  'air/fire':    {name:'Friction',      d:'Your weapon and spell hits against Burning enemies are critical hits. Accuracy still applies.'},
  'air/shadow':  {name:'Storm Ambush',  d:'Your weapon and spell hits against Stunned enemies are critical hits. Accuracy still applies.'},
  'air/water':   {name:'Frozen Current',get d(){return 'Your damage arcs leave frozen ground under each enemy hit for '+FoteDamage.frozenArcGround({air:3,water:3}).duration+' turns. Grounded foes gain Chill each turn.';}},
  'air/light':   {name:'Glint',         get d(){return 'Your critical weapon and single-target spell hits Blind for '+FoteDamage.glint().duration+' turns.';}},
  'earth/fire':  {name:'Forge Heat',    d:'Weapon and single-target spell hits grant +2 damage and armor (max 5 stacks). Expires after 3 turns without a hit.'},
  'earth/light': {name:'Radiant Roots', d:'Applying or refreshing Root also Blinds for that application’s duration.'},
  'earth/shadow':{name:'Blight',        d:'Poisoned enemies deal 20% less damage.'},
  'earth/water': {name:'Silt Shield',   get d(){return 'Max Ice Armor +3 per Earth point. Your weapon hits restore '+FoteDamage.siltShield().restore+' Ice Armor, up to its maximum.';}},
  'light/fire':  {name:'Searing Light', d:'Your Smites set the target Burning.'},
  'light/water': {name:'Holy Water',    d:'Healing beyond your max HP becomes Ice Armor (up to its max).'},
  'light/air':   {name:'Swift Judgment',d:'Your Smites strike twice.'},
  'light/earth': {name:'Beacon Root',   get d(){return 'Your Smites Root ranged attackers and casters for '+FoteEffects.beaconRoot().duration+' turns. Bosses: 1 turn.';}},
  'shadow/fire': {name:'Smoke',         d:'When a Burning enemy dies, become Hidden for 3 turns.'},
  'shadow/water':{name:'Frostshade',    d:'Surprise attacks Freeze the target at once (bosses: 2 Chill stacks).'},
  'shadow/air':  {name:'Shadow Shock',  get d(){return 'Your surprise weapon and spell hits Stun for '+FoteDamage.shadowStun().duration+' turns. Bosses: 1 turn.';}},
  'shadow/earth':{name:'Venom Strike',  get d(){var r=FoteDamage.surprisePoison();return 'Your surprise weapon and spell hits deal '+(r.damageMultiplier*100)+'% of the landed damage again as Poison and Poison for '+r.duration+' turns. Poison resistance and immunity apply.';}}
};
function combo(a, b, view){ var affinity=view&&view.aff; return affinity ? (affinity[a]||0)>=3 && (affinity[b]||0)>=2 : aff(a)>=3 && aff(b)>=2; }
function combosHeld(){ return Object.keys(COMBOS).filter(function(k){ var p=k.split('/'); return combo(p[0],p[1]); }); }

/* ---------------------------------------------------------------- statuses */
/* Fanned Flames resolves from primary critical damage in damage-adapter.
 * Friction resolves before primary damage in the shared action crit owner. */


/* ---------------------------------------------------------------- damage in and out */


/* Glint, Shadow Shock and Venom Strike resolve from captured primary hits
 * in the shared damage owner. */


function afterPlayerHit(def, H){
  var alive=def.hp>0 && ents.indexOf(def)>=0;
  if(H.surprise && alive){
    if(combo('shadow','water')){ if(def.base.boss){ addChill(def,{hit:H}); addChill(def,{hit:H}); } else { delete def.st.imm_frozen; applyStatus(def,'frozen',2); floatText(def.x,def.y,'frozen','ice'); } }
  }
}
/* 2026-09-23 (audit): the spell paths ask this; the cast wrapper below still sets hidden=1 so the crit side follows */
function numbingDark(f){ return !!(f && f.st && f.st.chill && combo('water','shadow')); }


/* Smite procs: Searing Light, Swift Judgment, Beacon Root */
function onSmiteProc(def,actionId){
  var extra=0;
  if(combo('light','fire')) applyStatus(def,'burn',3,burnDmg());
  if(def.hp>0 && combo('light','earth') && (def.base.range>1 || def.base.caster || def.base.spellcaster)) applyStatus(def,'root',FoteEffects.beaconRoot().duration);
  if(combo('light','air')){ extra=applyDamage(def,smiteDamage(),'light',player,{tags:['proc','smite'],actionId:actionId}); sparkleFx(def.x,def.y,'light',10); }
  return extra;
}

/* Smoke resolves from hostile Burning deaths in death-adapter. */


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
      log('<b>The forge heat is white-hot.</b> +'+(2*FORGE_HEAT_MAX)+' damage and armor.','c-good');
  }
}


/* ---------------------------------------------------------------- the turn: Forge Heat and Permafrost */


function turnComboAfterAction(context){
  /* Forge Heat cools three turns after the last blow landed */
  if(player.forgeHeat){
    if(--player.forgeHeat.t <= 0){ player.forgeHeat=null; derive(player); log('The forge heat fades.','c-info'); }
  }
  if(combo('water','earth')) ents.slice().forEach(function(e){ if(e.foe && e.hp>0 && e.st.root) addChill(e); });

}
/* Holy Water: overheal becomes Ice Armor. Heals report themselves as "+N" heal numbers. */
/* Holy Water: overheal becomes Ice Armor. healPlayer() hands back exactly the part that did not fit, so
   this no longer has to parse a "+N" float against a mark kept in endTurn (2026-09-18). */


/* ---------------------------------------------------------------- the character sheet */
