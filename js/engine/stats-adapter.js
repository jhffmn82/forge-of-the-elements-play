/* Compatibility boundary for the existing sheets and action handlers.
 * Normalize authored gear explicitly, compute without mutation, then commit once. */
function statContent(){
  return {races:RACES,classes:CLASSES,gods:GODS,passives:PASSIVES,rings:RINGS,
    invokes:INVOKE_OF,elementAbilities:ELEMENT_ABILS,pietyRanks:PIETY_RANKS,
    fists:FISTS,orbCrit:ORB_CRIT,robe:TIER_ROBE,blockPer:TIER_BLOCK.per,
    gromFists:GROM_FISTS,numberScale:NUM,lethality:LETH,enchantments:FoteEnchantments,gear:FoteGear};
}
function normalizeActorGear(actor){
  if(actor===player)enforceDivineEquipment(actor);
  if(!actor.buffs)actor.buffs={};
  if(!actor.rings)actor.rings=[null,null];
  var gear=(actor.sets||[]).concat([actor.ranged,actor.armorItem,actor.off]);
  (actor.bag||[]).forEach(function(entry){if(['weapon','armor','off'].indexOf(entry.kind)>=0)gear.push(entry.data);});
  var seen=new Set();
  gear.forEach(function(item){if(item&&item!==EMPTY_OFF&&!seen.has(item)){seen.add(item);tierNormalize(item);}});
}
function derive(actor){
  if(!actor)return;
  normalizeActorGear(actor);
  var result=FoteStats.computeWithRanged(actor,statContent());
  Object.keys(result).forEach(function(key){actor[key]=result[key];});
  if(Number.isFinite(actor.hp))actor.hp=Math.min(actor.hp,actor.maxhp);
  if(Number.isFinite(actor.mp))actor.mp=Math.min(actor.mp,actor.maxmp);
  actor.guard=actor.guard===undefined?actor.guardMax:Math.min(actor.guard,actor.guardMax);
  actor.iceArmor=actor.iceArmor===undefined?actor.iceArmorMax:Math.min(actor.iceArmor,actor.iceArmorMax);
  // Legacy spell execution consumes these chances from the authored ability.
  if(actor===player){ABILITIES.spark.stunChance=.05*(actor.aff.air||0);ABILITIES.smite.blindChance=.10*(actor.aff.light||0);}
}
