/* ============================================================================
   data.js - the rules tables for biome 1 (floors 1-5).
   Loaded after game.js; replaces its demo tables. Numbers follow DESIGN.md.
   ========================================================================== */

var ELEMENTS = ['fire','water','air','earth','light','shadow'];
var OPPOSITE = {fire:'water', water:'fire', air:'earth', earth:'air', light:'shadow', shadow:'light'};
var AFF_COL = {fire:'#E2622B', water:'#62A8D8', air:'#E8D27A', earth:'#7FA05A', light:'#F6E7B0', shadow:'#8A6FB0'};
var EL_DMG  = {fire:'fire', water:'ice', air:'lightning', earth:'poison', light:'light', shadow:'dark'};
var DMG_COL = {phys:'#F2E8DC', fire:'#FF7A38', ice:'#8FD3FF', lightning:'#FFE45C', poison:'#8FC45A', dark:'#B58BFF',
               light:'#FFF1B8', magic:'#D9B8FF', heal:'#7FD08A', miss:'#8A7F74', xp:'#E8B44A'};
function elemToType(el){ return EL_DMG[el] || 'phys'; }
function cap(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1) : s; }

/* ---------------------------------------------------------------- races */
/* Races give bonuses only: the -1 and -2 penalties were a mistake and came out on 2026-09-17, so no
   starting stat is below 10. */
var RACES = {
  human:    {name:'Human', mods:{mig:0,agi:0,vit:0,foc:0}, speed:100,
             blurb:'Adaptable and devout. +1 stat point every 3 levels, piety +25%, and once per biome survives a killing blow at 1 HP.',
             sexes:{m:'human-m', f:'human-f'}},
  elf:      {name:'Elf', mods:{agi:1, foc:2}, speed:110,
             blurb:'Quick and arcane. +10% speed, spells cost 15% less, +1 range on every ranged attack and spell.',
             sexes:{m:'elf-m', f:'elf-f'}},
  dwarf:    {name:'Dwarf', mods:{mig:1, vit:2}, speed:100,
             blurb:'Sturdy masters of the forge. Weapons and armor count as +1, and heavy armor costs no evasion.',
             sexes:{m:'dwarf-m', f:'dwarf-f'}},
  fae:      {name:'Fae', mods:{agi:2, foc:1}, speed:100, locked:true, capBonus:1,
             blurb:'Born of one court\'s element: starts with 1 affinity in it and can hold one more affinity point than other races.',
             courts:{fire:'Ember Court', water:'Tide Court', air:'Gale Court', earth:'Stone Court'},
             sexes:{m:'fae-%s-m', f:'fae-%s-f'}},
  gloomling:{name:'Gloomling', mods:{vit:2, foc:1}, speed:100, locked:'shadow', capBonus:1,
             blurb:'Pale things that walk with shadow. Start with Shadow 1, +1 affinity cap, 20% less hunger. Light healing hurts them.',
             sexes:{m:'gloomling-m', f:'gloomling-f'}}
};

/* ---------------------------------------------------------------- classes */
function W(name, dmg, acc, hands, extra){ var w={name:name, dmg:dmg, acc:acc, hands:hands, kind:'weapon'}; for(var k in (extra||{})) w[k]=extra[k]; return w; }
var WEAPONS = {
  sword:    W('Short Sword',[4,8],0,1,{note:'+5% crit', critBonus:0.05, icon:'item-sword'}),
  dagger:   W('Dagger',[3,6],10,1,{note:'surprise attacks x1.5; off-hand eligible', icon:'item-dagger', light:true}),
  mace:     W('Mace',[4,7],-5,1,{note:'ignores 2 armor', pierce:2, icon:'item-mace'}),
  wand:     W('Wand',[1,3],0,1,{note:'spells cost less mana; a little spell damage', spell:0.10, icon:'item-wand'}),
  longsword:W('Long Sword',[7,12],0,2,{note:'+10% crit', critBonus:0.10, icon:'item-longsword'}),
  axe:      W('Battle Axe',[8,14],-10,2,{note:'+25% damage to wounded targets', executioner:0.25, icon:'item-axe'}),
  bow:      W('Short Bow',[3,8],5,2,{range:6, note:'range 6; weak up close', icon:'item-bow'}),
  staff:    W('Oak Staff',[3,6],0,2,{note:'the most spell damage and +1 spell range', spell:0.20, icon:'item-staff'}),
  spear:    W('Spear',[5,9],5,2,{note:'reach: attacks 2 tiles away in a line', reach:2, icon:'item-spear'}),
  censer:   W('Bone Censer',[3,6],0,1,{note:'+15% Invoke and prayer strength', divine:0.15, icon:'item-censer'})
};
var ARMORS = {
  robe:    {name:'Cloth Robe', armor:0, eva:5,  weight:'cloth',  note:'no penalty', icon:'item-robe', kind:'armor'},
  shirt:   {name:'Loud Shirt', armor:0, eva:0,  weight:'cloth',  note:'very loud, very brave', icon:'item-robe', kind:'armor'},
  leather: {name:'Leather Armor', armor:1, eva:5, weight:'light', note:'light', icon:'item-leather', kind:'armor'},
  chain:   {name:'Chain Shirt', armor:3, eva:0,  weight:'medium', note:'medium', icon:'item-chain', kind:'armor'},
  plate:   {name:'Plate Armor', armor:5, eva:-10, weight:'heavy', note:'heavy', icon:'item-plate', kind:'armor'}
};
var OFFHANDS = {
  buckler: {name:'Buckler', block:0.10, note:'10% block', icon:'item-buckler', kind:'off'},
  kite:    {name:'Kite Shield', block:0.20, eva:-5, note:'20% block, -5 evasion', icon:'item-kite', kind:'off'},
  orb:     {name:'Orb', block:0, spell:0.10, note:'spell critical hits', icon:'item-orb', kind:'off'},
  tome:    {name:'Tome', block:0, manaPct:0.15, note:'+15% max mana', icon:'item-tome', kind:'off'},
  holy:    {name:'Holy Symbol', block:0, divine:0.15, note:'+15% Invoke and prayer strength', icon:'item-holy', kind:'off'},
  /* 2026-09-17: there is no separate off-hand dagger any more. Any light one-handed weapon goes in the off
     hand (see equipFromBag in systems.js), so a plain Dagger from WEAPONS is what the kits hand out and
     what drops. Old saves holding the retired item still work: itemKey resolves it to 'dagger' by name. */
  camera:  {name:'Camera', block:0, note:'takes a lovely picture. does nothing else.', icon:'item-holy', kind:'off', joke:true}
};
function clone(o){ return JSON.parse(JSON.stringify(o)); }

var CLASSES = {
  fighter:  {name:'Fighter', mods:{mig:2,vit:2}, ability:'double', icon:'cls-fighter',
             passive:'Shield Training: +15% block while carrying a shield.',
             blurb:'Sword and board. Double Strike, and a shield that actually stops things.',
             kit:{main:'sword', alt:'longsword', armor:'chain', off:'kite'}},
  cleric:   {name:'Cleric', mods:{foc:2,vit:2}, ability:'invoke', icon:'cls-cleric',
             passive:'Starts sworn to a god of your choice (rank 1, 20 piety).',
             blurb:'Chooses a god at the start. Invoke is that god\'s everyday miracle.',
             kit:{main:'mace', alt:'staff', armor:'leather', off:'holy'}},
  mage:     {name:'Mage', mods:{foc:3,vit:1}, ability:'missile', icon:'cls-mage',
             passive:'Deep Reserves: +30% max mana.',
             blurb:'Magic Missile: always hits, nothing resists it, grows with every affinity point.',
             kit:{main:'wand', alt:'staff', armor:'robe', off:'orb'}},
  scoundrel:{name:'Scoundrel', mods:{agi:4}, ability:'sap', icon:'cls-scoundrel',
             passive:'Sneaky: surprise attacks +50% damage; spots traps more easily.',
             blurb:'Bow and dagger. Sap knocks a target out, and a knocked-out target takes a surprise attack.',
             kit:{main:'dagger', alt:'bow', armor:'leather', off:'dagger'}},
  tourist:  {name:'Tourist', mods:{}, ability:null, icon:'cls-tourist',
             passive:'Well-Traveled: +1 extra stat point every 2 levels.',
             blurb:'No training, a loud shirt and a camera that does nothing. Grows faster than anyone.',
             kit:{main:'dagger', alt:null, armor:'shirt', off:'camera'}, extraFood:2}
};

/* ---------------------------------------------------------------- gods */
var GODS = {
  grom:     {name:'Grom the Unclad', title:'god of the bare fist', sprite:'shrine-grom', color:'#C98A5A',
             rule:'No weapons or shields. Cloth armor only.', invoke:'ironbody', prayers:['ironhide','pummel'],
             boons:['Iron Flesh: +1 unarmed damage and +1 armor per rank.','Staggering Blows: unarmed hits stun 15% of the time.','Mountain’s Fists: every third unarmed attack in a row strikes as a critical hit and knocks the target back a tile.'],
             gain:'Unarmed kills.'},
  grumbok:  {name:'Grumbok, Who Hates Wizards', title:'god of honest violence', sprite:'shrine-grumbok', color:'#B8453A',
             rule:'No spells, wands or magic sigils. Techniques are fine.', invoke:'bellow', prayers:['rampage','trollblood'],
             boons:['Thick Hide: take 8% less elemental and magic damage, and regenerate HP 25% faster, per rank.','Wizard Hunter: killing a spellcaster restores 10% of your max HP.','Spellbreaker: enemy spells deal half damage to you, and each one that hurts you doubles your next melee hit.'],
             gain:'Kills, extra for killing spellcasters.'},
  glimmer:  {name:'Saint Glimmer', title:'saint of mending light', sprite:'shrine-glimmer', color:'#F6E7B0', refuses:'gloomling',
             rule:'No Shadow: no shadow affinity, enchantments or sigils.', invoke:'heal', prayers:['consecrate','sanctuary'],
             boons:['Mending Light: all healing and HP regeneration +10%, and +10% damage against undead and shadow creatures, per rank.','Purifying Touch: Heal also cleanses Burning, Poison, Chill, Fear, Blind, Stun and Root.','Undying Light: once per floor, a killing blow instead heals you to half your HP.'],
             gain:'Kills, extra for undead and shadow creatures.'},
  murk:     {name:'Mother Murk', title:'mother of the quiet dead', sprite:'shrine-murk', color:'#8A6FB0', loves:'gloomling',
             rule:'No Light: no light affinity, enchantments or sigils.', invoke:'raisedead', prayers:['unholyaura','corpsefeast'],
             boons:['Life Drain: kills heal 1 HP per rank, and your undead have +10% HP and damage per rank.','Undying Servants: Raise Dead brings up a Zombie Bruiser instead of a skeleton.','Lich-Mother: Raise Dead calls a Lich, and your servant rises again once when it is destroyed.'],
             gain:'Kills of the living, extra for kills by your undead.'},
  reginald: {name:'Sir Reginald the Unsneaky', title:'patron of the fair fight', sprite:'shrine-reginald', color:'#9FB0C0',
             rule:'No surprise attacks and no stealth kills.', invoke:'challenge', prayers:['laststand','rally'],
             boons:['Fair Fight: +4 accuracy and +10% damage against elites and bosses, per rank.','Called Out: a Challenged enemy takes +20% damage from everyone.','Champion: while only one enemy is in view you deal 30% more damage and take 20% less.'],
             gain:'Kills of enemies that see you coming, extra for elites and bosses.'},
  anvil:    {name:'Old Anvil', title:'the smith below', sprite:'shrine-anvil', color:'#E8B44A', tithe:true,
             rule:'No rule. Old Anvil wants essence.', invoke:'temper', prayers:['offering','reforge'],
             boons:['Smith\'s Blessing: +1 weapon damage and enchantments 10% stronger, per rank.','Second Heat: the Forge lets you enchant twice per visit.','Masterwork: Forge upgrades cost 30% less, and gear can be raised to +4.'],
             gain:'Offering essence (prayer, better at a shrine) and enchanting at the Forge.'},
  vellum:   {name:'Vellum, the Open Book', title:'keeper of every spell ever spoken', sprite:'shrine-vellum', color:'#7FA8FF', loves:'elf',
             rule:'No shields, and nothing heavier than light armor. A caster keeps their hands and shoulders free.', invoke:'arcaneward', prayers:['manatide','unbound'],
             boons:['Deep Well: +8% max mana and +8% spell damage per rank.','Spell Echo: a spell you cast has a 20% chance to refund its mana.','Archmage: spells cost 25% less mana, and Spell Echo triggers 35% of the time.'],
             gain:'Kills made with spells, and 1 piety for every 20 mana you spend.'},
  wobbles:  {name:'Wobbles, the Giggling Chaos', title:'god of whatever happens next', sprite:'shrine-wobbles', color:'#D98BD0', chaos:true,
             rule:'No rule and no tithe. The cost is that you never know.', invoke:'rolldice', prayers:['rolldice2'],
             boons:['Amused: occasional gifts (and pranks) when things get dramatic; gifts get better as amusement rises. Never kills you directly.','Favourite Toy: interventions lean helpful more often.','Beloved Toy: once per floor, Wobbles snatches you from a killing blow with a random rescue.'],
             gain:'Drama: low HP, big fights, elites. Boredom drains it.'}
};
var PIETY_RANKS = [0, 100, 300, 650, 1200];   /* rank 1 on joining; ranks 2-5 at these totals. 2026-09-17: doubled monster density made ranks come
   too fast (rank 3 by floor 3); now about rank 2 by floor 3, rank 3 early in biome 2, and rank 5 is a late-run goal */
/* what each rank unlocks: 1 passive (grows every rank), 2 first prayer, 3 signature boon, 4 second prayer, 5 capstone passive */
var BOON_RANKS = [1, 3, 5];
function pietyRank(p){ var r=1; for(var i=1;i<PIETY_RANKS.length;i++) if(p>=PIETY_RANKS[i]) r=i+1; return Math.min(5,r); }

/* ---------------------------------------------------------------- abilities */
var ABILITIES = {
  /* class */
  double:  {name:'Double Strike', cost:12, tech:true, kind:'melee2', icon:'ic-double-strike', sfx:'double-strike',
            desc:'Two weapon attacks on an adjacent enemy in one turn.'},
  missile: {name:'Magic Missile', cost:6, kind:'bolt', range:6, type:'magic', base:[5,8], always:true, perAffinity:1, icon:'ic-magic-missile', el:'magic',
            desc:'Always hits. Magic damage that nothing resists. +1 damage for every affinity point you hold.'},
  sap:     {name:'Sap', cost:7, tech:true, kind:'bolt', range:1, useWeaponRange:true, type:'phys', base:[2,4], status:{stun:3}, icon:'ic-sap',
            desc:'Melee or ranged: knocks the target out for 3 turns (6 if it was unaware). A knocked-out target takes surprise attacks.'},
  /* elements, tier 2 (12 mana, range 6 except Earth Root and Lightfall at 4) */
  firebolt:  {name:'Firebolt', cost:12, kind:'bolt', range:6, type:'fire', base:[9,15], status:{burn:3}, icon:'ic-firebolt', el:'fire',
              desc:'Fire damage and sets the target Burning. Ignites grass and burns thorns.'},
  frostshard:{name:'Frost Shard', cost:12, kind:'bolt', range:6, type:'ice', base:[9,15], status:{chill:3}, icon:'ic-frost-shard', el:'water',
              desc:'Ice damage and Chill. Three Chills freeze the target solid.'},
  spark:     {name:'Spark', cost:12, kind:'bolt', range:6, type:'lightning', base:[9,15], stunChance:0.35, icon:'ic-spark', el:'air',
              desc:'Lightning damage with a 35% chance to stun. +50% against targets standing in water.'},
  root:      {name:'Earth Root', cost:12, kind:'bolt', range:4, type:'phys', base:[9,15], status:{root:2}, icon:'ic-earth-root', el:'earth',
              desc:'Rock spell: Physical damage and roots the target for 2 turns.'},
  smite:     {name:'Lightfall', cost:12, kind:'bolt', range:4, type:'light', base:[9,15], blindChance:0.5, icon:'ic-smite', el:'light',
              desc:'Light damage with a 50% chance to Blind. +50% against undead and shadow creatures.'},
  shadowbolt:{name:'Shadow Bolt', cost:12, kind:'bolt', range:6, type:'dark', base:[9,15], status:{fear:2}, icon:'ic-shadow-bolt', el:'shadow',
              desc:'Dark damage and the target flees in Fear.'},
  /* invokes (Cleric, by god) */
  ironbody:  {name:'Iron Body', cost:8, kind:'self', icon:'ic-iron-body', divine:true, god:'grom', desc:'Invoke (Grom): +4 armor for 6 turns and your unarmed hits stun 30%.'},
  bellow:    {name:'Bellow', cost:8, kind:'self', icon:'ic-bellow', divine:true, god:'grumbok', tech:true, desc:'Invoke (Grumbok): enemies within 3 are stunned for 1 turn and you heal 10% of max HP.'},
  heal:      {name:'Heal', cost:8, kind:'self', icon:'ic-heal', divine:true, god:'glimmer', desc:'Invoke (Saint Glimmer): restore 25% of max HP (+5% per piety rank).'},
  raisedead: {name:'Raise Dead', cost:8, kind:'summon', range:4, life:22, icon:'ic-raise-dead', divine:true, god:'murk', desc:'Invoke (Mother Murk): the dead rise to fight for you. One at a time.'},
  arcaneward:{name:'Arcane Ward', cost:8, kind:'self', icon:'ic-arcane-ward', divine:true, god:'vellum', desc:'Invoke (Vellum): a ward absorbs damage equal to 25% of your max mana (+5% per piety rank) for 10 turns.'},
  challenge: {name:'Challenge', cost:6, kind:'bolt', range:6, type:'none', icon:'ic-challenge', divine:true, god:'reginald', desc:'Invoke (Sir Reginald): mark an enemy. You deal +25% damage to it and it must come for you.'},
  temper:    {name:'Temper', cost:8, kind:'self', icon:'ic-temper', divine:true, god:'anvil', desc:'Invoke (Old Anvil): your weapon counts as +2 for 12 turns.'},
  rolldice:  {name:'Roll the Dice', cost:8, kind:'self', icon:'ic-roll-dice', divine:true, god:'wobbles', desc:'Invoke (Wobbles): something happens. Probably good.'}
};
var ELEMENT_ABILS = {fire:{2:'firebolt'}, water:{2:'frostshard'}, air:{2:'spark'}, earth:{2:'root'}, light:{2:'smite'}, shadow:{2:'shadowbolt'}};
var INVOKE_OF = {grom:'ironbody', grumbok:'bellow', glimmer:'heal', murk:'raisedead', reginald:'challenge', anvil:'temper', vellum:'arcaneward', wobbles:'rolldice'};

/* prayers cost favor, not mana */
var PRAYERS = {
  ironhide:   {name:'Iron Hide', favor:10, rank:2, desc:'+5 armor for 12 turns.'},
  pummel:     {name:'Pummel', favor:25, rank:4, desc:'Your next 3 unarmed hits deal double damage and stun.'},
  rampage:    {name:'Rampage', favor:10, rank:2, desc:'+40% melee damage and +20% speed for 10 turns.'},
  trollblood: {name:'Trollblood', favor:25, rank:4, desc:'Heal 40% of max HP and remove all statuses.'},
  consecrate: {name:'Consecrate', favor:10, rank:2, desc:'Cleanse your statuses; undead and shadow creatures within 3 take 8 light damage and flee.'},
  sanctuary:  {name:'Sanctuary', favor:25, rank:4, desc:'Every enemy within 5 is Feared for 4 turns.'},
  corpsefeast:{name:'Corpse Feast', favor:25, rank:4, desc:'Heal 30% of max HP; your undead are fully restored.'},
  laststand:  {name:'Last Stand', favor:10, rank:2, desc:'Take 35% less damage for 10 turns.'},
  rally:      {name:'Rally', favor:25, rank:4, desc:'Heal 25% of max HP, remove statuses, +10 accuracy for 10 turns.'},
  offering:   {name:'Offering', favor:0, rank:2, essence:15, desc:'Offer 15 essence: +10 piety and favor (x2 at a shrine).'},
  reforge:    {name:'Reforge', favor:25, rank:4, desc:'Permanently add +1 to your main-hand weapon.'},
  manatide:   {name:'Mana Tide', favor:10, rank:2, desc:'Restore 50% of your max mana.'},
  unbound:    {name:'Unbound', favor:25, rank:4, desc:'For 6 turns your spells and techniques cost no mana.'},
  rolldice2:  {name:'Big Roll', favor:0, rank:2, amusement:30, desc:'Spend 30 amusement for a big random intervention.'}
};

/* ---------------------------------------------------------------- sigils (crafted at the Forge, found unidentified) */
var SIGILS = {
  firestorm:{name:'Fire sigil', motes:['fire'], desc:'Flames burst out to 3 tiles: 8 fire damage and Burning.'},
  mana:     {name:'Water sigil', motes:['water'], desc:'Restore 50% of your mana.'},
  levitate: {name:'Air sigil', motes:['air'], desc:'Float for 25 turns: cross chasms and water, ignore floor traps.'},
  stoneskin:{name:'Earth sigil', motes:['earth'], desc:'Stone skin: -3 physical damage per hit for 15 turns.'},
  heal:     {name:'Light sigil', motes:['light'], desc:'Heal 35% of max HP. (Hurts Gloomlings.)'},
  vanish:   {name:'Shadow sigil', motes:['shadow'], desc:'Vanish for 6 turns; enemies lose track of you.'},
  identify: {name:'Sigil of Knowing', motes:['light','shadow'], desc:'Identify every sigil you carry.'},
  mapping:  {name:'Sigil of the Deep Map', motes:['shadow','earth'], desc:'Reveal this floor\'s layout.'},
  blink:    {name:'Sigil of Blinking', motes:['air','shadow'], desc:'Teleport to a spot you can see within 6 tiles.'}
};
var SIGIL_LOOKS = ['ashen','coiled','cracked','weeping','humming','bone','tarnished','woven','gilded'];

/* ---------------------------------------------------------------- food */
var FOODS = {
  ration:{name:'Ration', nutrition:700, icon:'item-ration'},
  bread: {name:'Bread', nutrition:450, icon:'item-bread'},
  smallration:{name:'Small Ration', nutrition:350, icon:'item-ration'},
  meat:  {name:'Roast Meat', nutrition:550, heal:0.10, icon:'item-meat'}
};
var HUNGER_MAX = 1500;

/* ---------------------------------------------------------------- traps */
var TRAPS = {
  dart:    {name:'Dart', sprite:'trap-dart', minFloor:1},
  web:     {name:'Web', sprite:'trap-web', minFloor:1, once:true},
  alarm:   {name:'Alarm', sprite:'trap-alarm', minFloor:1, once:true},
  fire:    {name:'Fire vent', sprite:'trap-fire', minFloor:2},
  frost:   {name:'Frost jet', sprite:'trap-frost', minFloor:2},
  spark:   {name:'Spark plate', sprite:'trap-spark', minFloor:3},
  teleport:{name:'Teleport rune', sprite:'trap-teleport', minFloor:3},
  gas:     {name:'Gas vent', sprite:'trap-gas', minFloor:3},
  pit:     {name:'Pit', sprite:'trap-pit', minFloor:4, once:true}
};

/* ---------------------------------------------------------------- props */
/* b: blocks movement, br: breakable, ex: explodes, burn: flammable, light: casts light, flat: lies on the floor */
var PROPS = {
  'barrel':{b:1,br:1,burn:1,loot:0.35,sfx:'crate-break'}, 'crate':{b:1,br:1,burn:1,loot:0.40,sfx:'crate-break'},
  'pot':{b:1,br:1,loot:0.45,sfx:'pot-break'}, 'barrel-explosive':{b:1,br:1,ex:1,burn:1},
  'brazier-lit':{b:1,light:'#FF9A40'}, 'brazier-unlit':{b:1}, 'torch-stand':{b:1,light:'#FFB050'},
  'bones':{flat:1}, 'weapon-rack':{b:1}, 'bookshelf':{b:1,burn:1}, 'cage':{b:1}, 'statue':{b:1}, 'statue-broken':{b:1},
  'mushrooms':{flat:1,light:'#6FB7FF',dim:1}, 'vines':{flat:1,burn:1}, 'ice-block':{b:1,br:1,melt:1}, 'altar-spikes':{b:1,altar:1},
  'alchemy-table':{b:1}, 'fountain':{b:1,drink:1}, 'bed-straw':{flat:1,burn:1}, 'table-candle':{b:1,light:'#FFC870',dim:1},
  'cart':{b:1,br:1,burn:1}, 'chains':{flat:1}, 'rubble':{flat:1}, 'web':{flat:1,burn:1,web:1}, 'banner-stand':{b:1,burn:1},
  'shrine':{b:1}, 'pillar':{b:1}, 'elemental-lock':{b:1}, 'lever-up':{b:1}, 'lever-down':{b:1}, 'boss-throne':{b:1}
};

/* ---------------------------------------------------------------- monsters, biome 1 */
var MONSTERS = {
  rat:     {name:'Dungeon Rat', sprite:'m-rat', col:'#8C7A63', ch:'r', hp:7, dmg:[2,4], acc:56, eva:22, armor:0, speed:100, range:1, xp:6,
            band:[1,3], w:26, pack:[2,3], art:0.75, sfx:'rat', living:true},
  bat:     {name:'Cave Bat', sprite:'m-bat', col:'#9E8CA8', ch:'b', hp:6, dmg:[2,4], acc:58, eva:32, armor:0, speed:170, range:1, xp:8,
            band:[1,2], w:6, erratic:true, flying:true, art:0.7, sfx:'bat', living:true},
  goblin:  {name:'Goblin', sprite:'m-goblin', col:'#6F9350', ch:'g', hp:15, dmg:[4,6], acc:60, eva:16, armor:1, speed:100, range:1, xp:12,
            band:[1,5], w:26, art:0.9, sfx:'goblin', living:true, artLeft:true},
  archer:  {name:'Goblin Archer', sprite:'m-goblin-archer', col:'#B8894A', ch:'a', hp:11, dmg:[3,5], acc:60, eva:18, armor:0, speed:100, range:6, xp:14,
            band:[2,5], w:18, kiter:true, art:0.9, sfx:'goblin', living:true},
  brute:   {name:'Goblin Brute', sprite:'m-goblin-brute', col:'#4E7A3C', ch:'G', hp:30, dmg:[7,11], acc:58, eva:10, armor:2, speed:100, range:1, xp:26,
            band:[3,5], w:14, art:1.05, sfx:'brute', living:true},
  slime:   {name:'Rock Slime', sprite:'m-slime', col:'#7C8C9E', ch:'s', hp:24, dmg:[5,8], acc:54, eva:8, armor:4, speed:70, range:1, xp:20,
            band:[2,5], w:12, splits:true, art:0.8, sfx:'slime'},
  shaman:  {name:'Goblin Shaman', sprite:'m-goblin-shaman', col:'#C25A3A', ch:'h', hp:16, dmg:[4,6], acc:64, eva:14, armor:0, speed:100, range:1, xp:26,
            band:[3,5], w:10, caster:'firebolt', castRange:6, castEvery:4, el:'fire', art:0.9, sfx:'shaman', living:true, spellcaster:true},
  skeleton:{name:'Skeleton', sprite:'m-skeleton', col:'#D8CEBC', ch:'k', hp:16, dmg:[4,7], acc:62, eva:18, armor:2, speed:100, range:1, xp:18,
            band:[9,9], w:0, undead:true, art:0.95, sfx:'skeleton'},
  mimic:   {name:'Mimic', sprite:'m-mimic', col:'#8A5A2A', ch:'m', hp:28, dmg:[6,9], acc:64, eva:10, armor:3, speed:100, range:1, xp:30,
            band:[9,9], w:0, art:0.85, sfx:'mimic'},
  warchief:{name:'Grukk the Warchief', sprite:'m-goblin-warchief', col:'#A8452A', ch:'W', hp:110, dmg:[7,12], acc:68, eva:14, armor:3, speed:100, range:1, xp:220,
            band:[9,9], w:0, boss:true, elite:true, art:1.35, sfx:'warchief', living:true},
  /* elementalings: rare, drop a mote */
  emberling:{name:'Emberling', sprite:'m-emberling', col:'#E2622B', ch:'*', hp:16, dmg:[4,6], acc:62, eva:22, armor:0, speed:100, range:1, xp:30, band:[2,5], rare:true, el:'fire', drop:'mote', art:0.7, sfx:'elementaling'},
  tideling: {name:'Dropling', sprite:'m-tideling', col:'#62A8D8', ch:'*', hp:20, dmg:[3,6], acc:60, eva:20, armor:1, speed:100, range:1, xp:30, band:[2,5], rare:true, el:'water', drop:'mote', art:0.7, sfx:'elementaling'},
  galeling: {name:'Puffling', sprite:'m-galeling', col:'#E8D27A', ch:'*', hp:12, dmg:[3,6], acc:64, eva:30, armor:0, speed:140, range:1, xp:30, band:[2,5], rare:true, el:'air', drop:'mote', erratic:true, flying:true, art:0.7, sfx:'elementaling'},
  stoneling:{name:'Pebbling', sprite:'m-stoneling', col:'#7FA05A', ch:'*', hp:24, dmg:[4,6], acc:56, eva:8, armor:3, speed:100, range:1, xp:30, band:[2,5], rare:true, el:'earth', drop:'mote', art:0.7, sfx:'elementaling'},
  wisp:     {name:'Inking', sprite:'m-wisp', col:'#8A6FB0', ch:'*', hp:15, dmg:[4,7], acc:64, eva:26, armor:0, speed:100, range:1, xp:30, band:[3,5], rare:true, el:'shadow', drop:'mote', shadowy:true, art:0.7, sfx:'elementaling'},
  lumenling:{name:'Glimmerling', sprite:'m-lumenling', col:'#F6E7B0', ch:'*', hp:18, dmg:[4,7], acc:64, eva:24, armor:0, speed:100, range:1, xp:34, band:[3,5], rare:true, el:'light', drop:'mote', art:0.7, sfx:'elementaling'}
};
/* ---------------------------------------------------------------- drop tables
   chance: odds that a kill drops anything at all (the Ring of Luck raises it). Then one pick from table,
   weighted: essence (currency), gear (a random weapon, armor, off-hand, ring or amulet), sigil, food.
   Elementalings always drop their mote instead; the boss has his own hoard. */
var DROPS = {
  rat:     {chance:0.10, table:{essence:8, food:2}},
  bat:     {chance:0.08, table:{essence:18, sigil:1}},
  goblin:  {chance:0.18, table:{essence:12, gear:4, sigil:1, food:2}},
  archer:  {chance:0.20, table:{essence:10, gear:6, sigil:1}},
  brute:   {chance:0.35, table:{essence:4, gear:5, food:1}},
  slime:   {chance:0.15, table:{essence:16, sigil:1}},
  shaman:  {chance:0.35, table:{essence:6, sigil:3, gear:4}},
  skeleton:{chance:0.25, table:{essence:4, gear:6}},
  mimic:   {chance:1.00, table:{gear:6, essence:4}}
};

/* summoned forms for Mother Murk's Raise Dead, by piety rank */
var UNDEAD_FORMS = [
  {rank:1, kind:'skeleton', name:'Risen Skeleton', hp:14, dmg:[3,6]},
  {rank:3, kind:'skeleton', name:'Zombie Bruiser', hp:30, dmg:[4,7], taunt:true, sprite:'m-zombie-bruiser', art:1.05},
  {rank:4, kind:'skeleton', name:'Vampire', hp:22, dmg:[5,9], lifesteal:true},
  {rank:5, kind:'skeleton', name:'Lich', hp:26, dmg:[5,9], caster:'shadowbolt', sprite:'m-lich', art:1.0}   /* casts at range 6; must out-do the Bruiser */
];
