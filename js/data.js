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
             blurb:'+1 to all stats. +1 stat point every 3 levels. +25% piety gain.',
             sexes:{m:'human-m', f:'human-f'}},
  elf:      {name:'Elf', mods:{agi:1, foc:2}, speed:110,
             blurb:'+10% speed. Spells cost 15% less mana. +1 range for ranged attacks and spells.',
             sexes:{m:'elf-m', f:'elf-f'}},
  dwarf:    {name:'Dwarf', mods:{mig:1, vit:2}, speed:100,
             blurb:'Weapons and armor gain one effective upgrade. No heavy armor evasion penalty. Forge upgrades cost 25% less.',
             sexes:{m:'dwarf-m', f:'dwarf-f'}},
  fae:      {name:'Fae', mods:{agi:2, foc:1}, speed:100, locked:true, capBonus:1,
             blurb:'Start with 1 affinity in your court\'s element. +1 affinity cap.',
             courts:{fire:'Ember Court', water:'Tide Court', air:'Gale Court', earth:'Stone Court'},
             sexes:{m:'fae-%s-m', f:'fae-%s-f'}},
  gloomling:{name:'Gloomling', mods:{vit:2, foc:1}, speed:100, locked:'shadow', capBonus:1,
             blurb:'Start with Shadow 1. +1 affinity cap, 20% less hunger. Take 25% more light damage.',
             sexes:{m:'gloomling-m', f:'gloomling-f'}}
};

/* ---------------------------------------------------------------- classes */
function W(name, dmg, acc, hands, extra){ var w={name:name, dmg:dmg, acc:acc, hands:hands, kind:'weapon'}; for(var k in (extra||{})) w[k]=extra[k]; return w; }
var WEAPONS = {
  sword:    W('Short Sword',[4,8],0,1,{note:'+5% crit', critBonus:0.05, icon:'item-sword'}),
  dagger:   W('Dagger',[3,6],10,1,{note:'10% faster attacks; +20% surprise damage; fits the off hand', icon:'item-dagger', light:true}),
  mace:     W('Mace',[4,7],-5,1,{note:'ignores 2 armor; more on finer maces', pierce:2, icon:'item-mace'}),
  wand:     W('Wand',[1,3],0,1,{note:'spells cost less mana; a little spell damage', spell:0.10, icon:'item-wand'}),
  longsword:W('Long Sword',[7,12],0,2,{note:'+10% crit', critBonus:0.10, icon:'item-longsword'}),
  axe:      W('Battle Axe',[8,14],-10,2,{note:'+25% damage to targets at half HP or less', executioner:0.25, icon:'item-axe'}),
  bow:      W('Short Bow',[3,8],5,2,{range:6, note:'range 6; up close, your main weapon swings instead', icon:'item-bow'}),
  staff:    W('Oak Staff',[3,6],0,2,{note:'the most spell damage and +1 spell range', spell:0.20, icon:'item-staff'}),
  spear:    W('Spear',[5,9],5,2,{note:'reach: attacks 2 tiles away in a line', reach:2, icon:'item-spear'}),
  censer:   W('Ceremonial Knife',[3,6],0,1,{note:'strengthens your god\'s abilities', light:true, divine:0.15, icon:'item-censer'})
};
var ARMORS = {
  robe:    {name:'Cloth Robe', armor:0, eva:5,  weight:'cloth',  note:'no penalty', icon:'item-robe', kind:'armor'},
  shirt:   {name:'Hawaiian Shirt', armor:0, eva:0,  weight:'cloth',  note:'Bright flowers, bold colors and absolutely no armor.', icon:'item-hawaiian-shirt', kind:'armor'},
  leather: {name:'Leather Armor', armor:1, eva:5, weight:'light', note:'light', icon:'item-leather', kind:'armor'},
  chain:   {name:'Chain Shirt', armor:3, eva:0,  weight:'medium', note:'medium; -10% stealth', icon:'item-chain', kind:'armor'},
  plate:   {name:'Plate Armor', armor:5, eva:-10, weight:'heavy', note:'heavy; -25% stealth', icon:'item-plate', kind:'armor'}
};
var OFFHANDS = {
  buckler: {name:'Buckler', block:0.10, note:'light shield', icon:'item-buckler', kind:'off'},
  kite:    {name:'Kite Shield', block:0.20, eva:-5, note:'heavy shield; -5 evasion', icon:'item-kite', kind:'off'},
  orb:     {name:'Orb', block:0, spell:0.10, note:'raises crit chance', icon:'item-orb', kind:'off'},
  tome:    {name:'Tome', block:0, manaPct:0.15, note:'raises max mana', icon:'item-tome', kind:'off'},
  holy:    {name:'Holy Symbol', block:0, divine:0.15, note:'strengthens your god\'s abilities', icon:'item-holy', kind:'off'},
  /* 2026-09-17: there is no separate off-hand dagger any more. Any light one-handed weapon goes in the off
     hand (see equipFromBag in systems.js), so a plain Dagger from WEAPONS is what the kits hand out and
     what drops. Old saves holding the retired item still work: itemKey resolves it to 'dagger' by name. */
  camera:  {name:'Camera', block:0, note:'takes a lovely picture; does nothing else', icon:'item-holy', kind:'off', joke:true}
};
function clone(o){ return JSON.parse(JSON.stringify(o)); }

var CLASSES = {
  fighter:  {name:'Fighter', mods:{mig:2,vit:2}, ability:'double', icon:'cls-fighter',
             passive:'Guard: 12% max HP shield; refills out of combat.',
             blurb:'Sword and shield. Double Strike hits twice; Charge closes distance and stuns.',
             kit:{main:'sword', alt:'longsword', armor:'chain', off:'kite'}},
  cleric:   {name:'Cleric', mods:{foc:2,vit:2}, ability:'invoke', icon:'cls-cleric',
             passive:'Starts sworn to a god of your choice (rank 1, 20 piety).',
             blurb:'Start with a god and its invoke ability.',
             kit:{main:'mace', alt:'staff', armor:'leather', off:'holy'}},
  mage:     {name:'Mage', mods:{foc:3,vit:1}, ability:'missile', icon:'cls-mage',
             passive:'Deep Reserves: +30% max mana.',
             blurb:'Magic Missile always hits, ignores resistance and gains damage from affinity.',
             kit:{main:'wand', alt:'staff', armor:'robe', off:'orb'}},
  scoundrel:{name:'Scoundrel', mods:{agi:4}, ability:'sap', icon:'cls-scoundrel',
             passive:'Sneaky: double surprise damage. Halve enemy detection chance and reduce detection range by 2 tiles. Shadowstep requires no adjacent enemies.',
             blurb:'Bow and dagger. Sap disables an enemy and sets up a surprise attack.',
             kit:{main:'dagger', alt:'bow', armor:'leather', off:'dagger'}},
  tourist:  {name:'Tourist', mods:{}, ability:null, icon:'cls-tourist',
             passive:'Well-Traveled: +1 extra stat point every 2 levels.',
             blurb:'Extra XP and stat points. Starts with a dagger, shirt and camera.',
             kit:{main:'dagger', alt:null, armor:'shirt', off:'camera'}, extraFood:2}
};

/* ---------------------------------------------------------------- gods */
var GODS = {
  "grom": {
    "name": "Chad the Unclad",
    "refuses": "dwarf",
    "title": "god of the bare fist",
    "sprite": "shrine-grom",
    "color": "#C98A5A",
    "rule": "No Dwarves. Equip only Holy Symbols, rings and amulets.",
    "invoke": "ironbody",
    "prayers": [
      "ironhide",
      "pummel"
    ],
    "boons": [
      "Iron Flesh: +2 armor, +10% movement speed and +10% evasion per rank. Fists gain damage with rank and can parry.",
      "Staggering Blows: unarmed hits have a 15% chance to stun for 1 turn, and you punch 10% faster per rank.",
      "Living Mountain: unarmed attacks add a stack, even on misses (max 10). Each gives +2% crit, +2% accuracy and +2 damage. Attacks refresh all stacks for 6 turns; Divine Power extends this."
    ],
    "gain": "Damaging unarmed hits, plus kills while your hands are empty; elites and bosses grant extra."
  },
  "grumbok": {
    "name": "Grumbok, Who Hates Wizards",
    "title": "god of honest violence",
    "sprite": "shrine-grumbok",
    "color": "#B8453A",
    "rule": "No spells, wands or sigils.",
    "invoke": "bellow",
    "prayers": [
      "rampage",
      "trollblood"
    ],
    "boons": [
      "Thick Hide: +4% resistance to magic and elemental damage and +20% HP regeneration per rank.",
      "Wizard Hunter: taking magic, elemental or ranged damage grants +5% movement and attack speed per rank for 3 turns.",
      "Warrior's Discipline: -1 turn ability cooldown per rank (minimum 1). Abilities grant +2 damage for 6 turns, up to one stack per rank."
    ],
    "gain": "Kills, extra for spellcasters and elemental creatures."
  },
  "glimmer": {
    "name": "Saint Glimmer",
    "title": "saint of mending light",
    "sprite": "shrine-glimmer",
    "color": "#F6E7B0",
    "refuses": "gloomling",
    "rule": "No Shadow affinity, enchantments, spells or sigils. Requires room for Light affinity.",
    "invoke": "heal",
    "prayers": [
      "consecrate",
      "sanctuary"
    ],
    "boons": [
      "Mending Light: +10% healing and HP regeneration per rank, and +10% weapon damage per rank against undead and shadow creatures.",
      "Guiding Light: +5% Smite chance per rank.",
      "Kindled: +1 Light affinity, outside your affinity cap."
    ],
    "gain": "Kills, extra for undead and shadow creatures.",
    "boonRanks": [
      1,
      3,
      5
    ]
  },
  "murk": {
    "name": "Mother Murk",
    "title": "mother of the quiet dead",
    "sprite": "shrine-murk",
    "color": "#8A6FB0",
    "loves": "gloomling",
    "rule": "No Light: no Light affinity, enchantments, spells or sigils.",
    "invoke": "unholyaura",
    "prayers": [
      "raisedead",
      "bonespear"
    ],
    "boons": [
      "Life Drain: your direct hits have a 10% chance per rank to deal 2 shadow damage per rank, scaled by Divine Power. Heal yourself for the damage dealt.",
      "Grave Strength: summons gain Life Drain and +5% HP, movement speed, attack speed and damage per rank, scaled by Divine Power. Their Life Drain heals them.",
      "Lich: your servant becomes a Lich and revives once, after 1 turn, at half HP. Gain +2% Divine Power per Vitality above 10."
    ],
    "gain": "Kills of the living, extra for kills by your undead."
  },
  "reginald": {
    "name": "Sir Reginald the Unsneaky",
    "title": "patron of the fair fight",
    "sprite": "shrine-reginald",
    "color": "#9FB0C0",
    "rule": "Wake enemies within 8 tiles. No Scoundrels or Shadow affinity, enchantments, spells or sigils.",
    "invoke": "challenge",
    "prayers": [
      "laststand",
      "lance"
    ],
    "boons": [
      "Fair Fight: +4 accuracy and +2% crit per rank, and +10% weapon damage per rank against elites and bosses.",
      "Coward's Mark: ranged attackers must approach for 5 turns. They deal 5% less damage per rank and take +25% weapon damage.",
      "Wall of One: each adjacent enemy beyond the first grants -10% damage taken and +10% damage dealt (max 3)."
    ],
    "gain": "Kills of enemies that see you coming, extra for elites and bosses."
  },
  "anvil": {
    "name": "Old Anvil",
    "title": "the smith below",
    "sprite": "shrine-anvil",
    "color": "#E8B44A",
    "tithe": true,
    "rule": "No restrictions.",
    "invoke": "temper",
    "prayers": [
      "fieldsmelt",
      "anviltoll"
    ],
    "boons": [
      "Smith's Blessing: +1 weapon damage and 10% stronger enchantments per rank.",
      "Second Heat: enchanting or carving a sigil has a 30% chance to give its motes back, rising to 50% at rank 5.",
      "Masterwork: Forge upgrades cost 30% less, and gear can be raised to +4."
    ],
    "gain": "Spending essence anywhere, and enchanting or upgrading gear at the Forge."
  },
  "vellum": {
    "name": "Vellum, the Open Book",
    "title": "keeper of every spell ever spoken",
    "sprite": "shrine-vellum",
    "color": "#7FA8FF",
    "loves": "elf",
    "rule": "No shields, bows, staves or other two-handed weapons, and no armor heavier than leather.",
    "invoke": "arcaneward",
    "prayers": [
      "arcanelance",
      "arcanenova"
    ],
    "boons": [
      "Arcane Attunement: the bonuses and enchantments on your gear are 5% stronger per rank.",
      "Repelling Force: weapon hits and single-target spells have a 10% chance per rank to knock the enemy back 2 tiles.",
      "Perfect Invocation: gain Divine Power equal to your bonus Spell Power."
    ],
    "gain": "Spell kills, mana spent on spells and mana globes picked up. Communion earns Favor from damaging attacks."
  },
  "wobbles": {
    "name": "Wobbles, the Giggling Chaos",
    "title": "god of whatever happens next",
    "sprite": "shrine-wobbles",
    "color": "#D98BD0",
    "chaos": true,
    "rule": "No restrictions or tithes.",
    "invoke": "rolldice",
    "prayers": [
      "luckystreak",
      "rolldice2"
    ],
    "boons": [
      "Lady Luck: +3% per rank to your crit, evasion, parry, block and enchantment chances.",
      "Favorite Toy: +10% chance that Roll the Dice and Tempt Fate go your way, rising to +20% at rank 5.",
      "Last Laugh: survive a killing blow at 1 HP once per floor. Gain healing, invisibility or a ward."
    ],
    "gain": "Kills and new floors earn piety. Combat raises Amusement; quiet turns lower it. Low Amusement favors pranks, high Amusement favors rewards; either can happen at any level. Pranks add 50 Amusement; rewards spend 50. Tempt Fate also costs Amusement."
  },
  "sylla": {
    "name": "Sylla the Patient",
    "title": "mother of the brood",
    "sprite": "shrine-sylla",
    "color": "#B81A3A",
    "rule": "No Fire: no Fire affinity, enchantments, spells or sigils, and nothing set alight. No shields, and nothing heavier than leather.",
    "invoke": "intothedark",
    "prayers": [
      "the-brood",
      "venom-burst"
    ],
    "boonRanks": [
      1,
      3,
      5
    ],
    "boons": [
      "Web on Hit: each hit has a 10% chance per rank to web the target, which Roots it for 1 turn, slows it by half for 3 more and makes it Bleed.",
      "Venomtouch: your weapon, bow and spell hits inflict Poison for 3 turns, and deal +1 poison damage per rank to anything already suffering a status.",
      "The Long Patience: every status you inflict lasts 1 turn longer."
    ],
    "gain": "Kills of the webbed, the rooted and the poisoned, and every surprise attack. A surprise attack from hiding counts double."
  }
};
var PIETY_RANKS = [0, 100, 390, 1099, 2636];   /* 2026-09-23 (Justin): ranks 3-5 cost 30% more per rank (x1.3^(rank-2)); piety gain grows 30% per biome, favor does not */   /* rank 1 on joining; ranks 2-5 at these totals. 2026-09-17: doubled monster density made ranks come
   too fast (rank 3 by floor 3); now about rank 2 by floor 3, rank 3 early in biome 2, and rank 5 is a late-run goal */
/* what each rank unlocks: 1 passive (grows every rank), 2 first prayer, 3 signature boon, 4 second prayer, 5 capstone passive */
var BOON_RANKS = [1, 3, 5];
function pietyRank(p){ var r=1; for(var i=1;i<PIETY_RANKS.length;i++) if(p>=PIETY_RANKS[i]) r=i+1; return Math.min(5,r); }

/* ---------------------------------------------------------------- abilities */
var ABILITIES = {
  "double": {
    "name": "Double Strike",
    "cost": 7,
    "tech": true,
    "kind": "melee2",
    "icon": "ic-double-strike",
    "sfx": "double-strike",
    "desc": "Hit an adjacent enemy twice in one attack."
  },
  "missile": {
    "name": "Magic Missile",
    "cost": 6,
    "kind": "bolt",
    "range": 6,
    "type": "magic",
    "base": [
      3,
      6
    ],
    "always": true,
    "perAffinity": 1,
    "icon": "ic-magic-missile",
    "el": "magic",
    "desc": "Always hits and ignores resistance. +1 magic damage per affinity point."
  },
  "sap": {
    "name": "Sap",
    "cost": 7,
    "cd": 8,
    "tech": true,
    "kind": "bolt",
    "range": 2,
    "type": "phys",
    "base": [
      2,
      4
    ],
    "status": {
      "stun": 3
    },
    "icon": "ic-sap",
    "desc": "Stun for 3 turns (6 if unaware). The waking hit is a surprise critical. Target then becomes immune to Stun."
  },
  "firebolt": {
    "name": "Firebolt",
    "cost": 20,
    "kind": "bolt",
    "range": 6,
    "type": "fire",
    "base": [
      14,
      22
    ],
    "status": {
      "burn": 3
    },
    "icon": "ic-firebolt",
    "el": "fire",
    "desc": "Deal fire damage and inflict Burning for 3 turns. Ignites grass; destroys thorns."
  },
  "frostshard": {
    "name": "Frost Shard",
    "cost": 20,
    "kind": "bolt",
    "range": 6,
    "type": "ice",
    "base": [
      14,
      22
    ],
    "status": {
      "chill": 3
    },
    "icon": "ic-frost-shard",
    "el": "water",
    "desc": "Deal frost damage and apply Chill. Freeze at 4 stacks (3 at Water 6)."
  },
  "spark": {
    "name": "Spark",
    "cost": 20,
    "kind": "bolt",
    "range": 6,
    "type": "lightning",
    "base": [
      14,
      22
    ],
    "icon": "ic-spark",
    "el": "air",
    "desc": "Deal lightning damage; 5% Stun chance per Air point. +50% damage to Wet targets or targets in water.",
    "stunChance": 0
  },
  "root": {
    "name": "Earth Root",
    "cost": 20,
    "kind": "bolt",
    "range": 4,
    "type": "phys",
    "base": [
      14,
      22
    ],
    "status": {
      "root": 2
    },
    "icon": "ic-earth-root",
    "el": "earth",
    "desc": "Deal physical damage and Root for 2 turns."
  },
  "smite": {
    "name": "Lightfall",
    "cost": 20,
    "kind": "bolt",
    "range": 4,
    "type": "light",
    "base": [
      14,
      22
    ],
    "icon": "ic-smite",
    "el": "light",
    "desc": "Deal light damage; 10% Blind chance per Light point. +50% damage to undead and shadow creatures.",
    "blindChance": 0
  },
  "shadowbolt": {
    "name": "Shadow Bolt",
    "cost": 20,
    "kind": "bolt",
    "range": 6,
    "type": "dark",
    "base": [
      14,
      22
    ],
    "status": {
      "fear": 2
    },
    "icon": "ic-shadow-bolt",
    "el": "shadow",
    "desc": "Deal shadow damage and inflict Fear for 2 turns."
  },
  "ironbody": {
    "name": "Iron Body",
    "instant": true,
    "cost": 8,
    "kind": "self",
    "icon": "ic-iron-body",
    "divine": true,
    "god": "grom",
    "desc": "+4 armor and a 30% chance for your unarmed hits to stun, for 12 turns. Grows with Divine Power. Takes no turn."
  },
  "bellow": {
    "name": "Bellow",
    "cost": 8,
    "kind": "self",
    "icon": "ic-bellow",
    "divine": true,
    "god": "grumbok",
    "tech": true,
    "desc": "Stun every enemy within 3 tiles for 1 turn and heal 10% of max HP, plus 2% per rank. Grows with Divine Power."
  },
  "heal": {
    "name": "Heal",
    "cost": 8,
    "kind": "self",
    "icon": "ic-heal",
    "divine": true,
    "god": "glimmer",
    "desc": "Heal 10% of max HP, plus 2% per rank, up to 40% of max HP. Grows with Divine Power."
  },
  "raisedead": {
    "name": "Raise Dead",
    "cost": 8,
    "kind": "summon",
    "range": 4,
    "life": 22,
    "icon": "ic-raise-dead",
    "divine": true,
    "god": "murk",
    "desc": "Summon one undead servant."
  },
  "arcaneward": {
    "name": "Communion",
    "cost": 8,
    "kind": "self",
    "icon": "ic-arcane-ward",
    "divine": true,
    "god": "vellum",
    "desc": "Gain a shield and Communion for 8 turns: each action that deals damage earns 1 Favor per rank. Grows with Divine Power."
  },
  "challenge": {
    "name": "Challenge",
    "cost": 6,
    "kind": "bolt",
    "range": 6,
    "type": "none",
    "icon": "ic-challenge",
    "divine": true,
    "god": "reginald",
    "desc": "Force one enemy to approach. Deal +25% weapon damage to it."
  },
  "temper": {
    "name": "Temper",
    "cost": 8,
    "kind": "self",
    "icon": "ic-temper",
    "divine": true,
    "god": "anvil",
    "desc": "+2 weapon damage and +4 armor for 12 turns. Grows with Divine Power. Takes no turn."
  },
  "rolldice": {
    "name": "Roll the Dice",
    "cost": 8,
    "kind": "self",
    "icon": "ic-roll-dice",
    "divine": true,
    "god": "wobbles",
    "desc": "Trigger a random reward or prank."
  },
  "shadowstep": {
    "name": "Shadowstep",
    "cost": 0,
    "cd": 15,
    "kind": "self",
    "tech": true,
    "icon": "ic-shadowstep",
    "desc": "Hide for 3 turns and break pursuit. Requires no adjacent enemies."
  },
  "charge": {
    "name": "Charge",
    "cost": 0,
    "cd": 20,
    "kind": "charge",
    "range": 6,
    "tech": true,
    "icon": "ic-charge",
    "desc": "Charge up to 5 tiles in a straight line. Always hits an enemy target. Stun adjacent enemies at your destination for 2 turns."
  },
  "fireball": {
    "name": "Fireball",
    "cost": 70,
    "kind": "blast",
    "range": 6,
    "radius": 2,
    "type": "fire",
    "el": "fire",
    "icon": "ic-fireball",
    "desc": "Deal fire damage and inflict Burning in a 5x5 area centered on a visible tile."
  },
  "frostcone": {
    "name": "Frost Cone",
    "cost": 70,
    "kind": "cone",
    "range": 6,
    "type": "ice",
    "el": "water",
    "icon": "ic-tidal-surge",
    "desc": "A cone of frost 6 tiles long: frost damage, Chill and a 1-tile knockback."
  },
  "chainbolt": {
    "name": "Chain Lightning",
    "cost": 70,
    "kind": "chain",
    "range": 6,
    "type": "lightning",
    "el": "air",
    "icon": "ic-chain-lightning",
    "desc": "Lightning jumps from the target to 4 more enemies within 3 tiles, each jump 75% of the last."
  },
  "earthquake": {
    "name": "Earthquake",
    "cost": 70,
    "kind": "quake",
    "radius": 5,
    "type": "phys",
    "el": "earth",
    "icon": "ic-earthquake",
    "desc": "Deal physical damage within 5 tiles, including to your summons. Does not hit you."
  },
  "radiantbeam": {
    "name": "Radiant Beam",
    "cost": 70,
    "kind": "beam",
    "range": 6,
    "type": "light",
    "el": "light",
    "icon": "ic-radiant-lance",
    "desc": "A beam 3 tiles wide along a row, column or diagonal: light damage (+50% to undead and shadow), 5% Blind per Light point."
  },
  "shadowswarm": {
    "name": "Shadow Swarm",
    "cost": 70,
    "kind": "swarm",
    "range": 6,
    "type": "dark",
    "el": "shadow",
    "icon": "ic-shadow-swarm",
    "summon": {"hp": 10, "damage": 10, "duration": 5},
    "desc": "Summon up to nine Shades in a 3x3 area for 5 turns. Each has 10 HP and hits for 10 shadow damage, all growing with spell power. A new swarm replaces the old one."
  },
  "livingflame": {
    "name": "Living Flame",
    "cost": 100,
    "kind": "lflame",
    "range": 6,
    "type": "fire",
    "el": "fire",
    "icon": "ic-living-flame",
    "desc": "Summon a Living Flame for 30 turns. Damages adjacent enemies on arrival; fires at range 6. Every third shot splashes nearby enemies. Uses one of 2 summon slots."
  },
  "glacialtomb": {
    "name": "Glacial Tomb",
    "cost": 100,
    "base": [32,48],
    "radius": 1,
    "kind": "tomb",
    "range": 6,
    "type": "ice",
    "el": "water",
    "icon": "ic-glacial-tomb",
    "desc": "Imprison an enemy, unable to act or take damage: 10 turns (elites 6, bosses 2). Deal 32-48 frost damage to adjacent enemies. Self-cast: 3 turns, then restore 25% max HP and mana."
  },
  "stormform": {
    "name": "Storm Form",
    "cost": 100,
    "kind": "storm",
    "type": "lightning",
    "el": "air",
    "icon": "ic-storm-form",
    "desc": "Takes no time to cast. For 6 turns you move and act twice as fast."
  },
  "upheaval": {
    "name": "Upheaval",
    "cost": 100,
    "base": [24,36],
    "kind": "upheaval",
    "range": 7,
    "type": "phys",
    "el": "earth",
    "icon": "ic-upheaval",
    "desc": "Create up to 7 walls in a line for 20 turns. Deal 24-36 physical damage and Root creatures within 2 tiles for 2 turns. Hits your summons; does not hit you."
  },
  "dawn": {
    "name": "Dawn",
    "cost": 100,
    "base": [24,36],
    "kind": "dawn",
    "type": "light",
    "el": "light",
    "icon": "ic-dawn",
    "desc": "Deal 24-36 light damage and Blind visible enemies for 3 turns. Reveal all enemies for 20 turns."
  },
  "umbral": {
    "name": "Umbral Passage",
    "cost": 100,
    "kind": "umbral",
    "type": "dark",
    "el": "shadow",
    "icon": "ic-umbral-passage",
    "desc": "Teleport to an explored tile with no adjacent enemies; hide for 2 turns. Leave a shadow that casts Shadow Bolt and follows between floors. Lasts until destroyed or recast."
  },
  "unholyaura": {
    "name": "Unholy Aura",
    "cost": 8,
    "kind": "self",
    "icon": "pr-unholyaura",
    "divine": true,
    "god": "murk",
    "desc": "For 8 turns, deal 4 shadow damage per rank per turn to enemies within 2 tiles; heal 1 HP per enemy hit. Scales with Divine Power."
  },
  "intothedark": {
    "name": "Into the Dark",
    "cost": 8,
    "kind": "self",
    "icon": "ic-into-the-dark",
    "divine": true,
    "god": "sylla",
    "desc": "Hide for 3 turns and break pursuit. Your next hit from hiding deals +10% damage per rank."
  }
};
var ELEMENT_ABILS = {fire:{2:'firebolt'}, water:{2:'frostshard'}, air:{2:'spark'}, earth:{2:'root'}, light:{2:'smite'}, shadow:{2:'shadowbolt'}};
var INVOKE_OF = {
  "grom": "ironbody",
  "grumbok": "bellow",
  "glimmer": "heal",
  "murk": "unholyaura",
  "reginald": "challenge",
  "anvil": "temper",
  "vellum": "arcaneward",
  "wobbles": "rolldice",
  "sylla": "intothedark"
};

/* prayers cost favor, not mana */
var PRAYERS = {
  "ironhide": {
    "name": "Iron Hide",
    "instant": true,
    "favor": 10,
    "rank": 2,
    "desc": "+5 armor and a shield for 12 turns. Grows with Divine Power. Takes no turn."
  },
  "pummel": {
    "name": "Pummel",
    "instant": true,
    "favor": 25,
    "rank": 4,
    "desc": "Your next 3 unarmed hits deal +100% damage and stun for 1 turn. Grows with Divine Power. Takes no turn."
  },
  "rampage": {
    "name": "Rampage",
    "favor": 10,
    "rank": 2,
    "desc": "+20% melee damage and +10% melee attack speed, plus 4% and 2% per rank, for 10 turns. Grows with Divine Power. Takes no turn."
  },
  "trollblood": {
    "name": "Trollblood",
    "favor": 25,
    "rank": 4,
    "desc": "Heal 20% of max HP plus 5% per rank, and cleanse yourself. Grows with Divine Power."
  },
  "consecrate": {
    "name": "Consecrate",
    "favor": 10,
    "rank": 2,
    "desc": "Cleanse yourself and deal 8 light damage to every undead and shadow creature within 3 tiles. Grows with Divine Power. Takes no turn."
  },
  "sanctuary": {
    "name": "Holy Ground",
    "favor": 25,
    "rank": 4,
    "desc": "Bless the ground within 3 tiles for 10 turns and Fear enemies there for 4 turns. It heals and protects you and your allies, and burns enemies."
  },
  "laststand": {
    "name": "Last Stand",
    "favor": 10,
    "rank": 2,
    "desc": "Use at half HP or less: take 50% less damage for 10 turns. Takes no turn."
  },
  "rally": {
    "name": "Rally",
    "favor": 25,
    "rank": 4,
    "desc": "You and every ally in sight heal 25% of max HP and cleanse, then deal +10% damage for 10 turns."
  },
  "rolldice2": {
    "name": "Tempt Fate",
    "favor": 0,
    "rank": 4,
    "amusement": 40,
    "desc": "80% reward chance (85% at rank 5): full healing, motes or gear. Otherwise: ambush, HP loss, teleport or, rarely, lose half your essence."
  },
  "raisedead": {
    "name": "Raise Dead",
    "favor": 20,
    "rank": 2,
    "desc": "Summon one undead servant until destroyed or you leave the floor."
  },
  "the-brood": {
    "name": "The Brood",
    "favor": 20,
    "rank": 2,
    "desc": "Summon up to 3 spiderlings for 30 turns. Their bites web or poison, and they grow with rank and Divine Power."
  },
  "venom-burst": {
    "name": "Venom Burst",
    "favor": 25,
    "rank": 4,
    "desc": "Poison damage to every enemy within 3 tiles, then Poison and Blind for 3 turns. Grows with rank and Divine Power."
  },
  "fieldsmelt": {
    "name": "Field Smelt",
    "rank": 2,
    "favor": 5,
    "desc": "Recycle one carried item for full essence value. Requires being out of combat. Instant."
  },
  "anviltoll": {
    "name": "Anvil's Toll",
    "rank": 4,
    "favor": 20,
    "desc": "Attack all enemies within 2 tiles. Hits knock back 2 tiles and Stun for 1 turn."
  },
  "lance": {
    "name": "Lance",
    "rank": 4,
    "favor": 20,
    "desc": "Strike every enemy in a straight line up to 5 tiles long with your weapon."
  },
  "bonespear": {
    "name": "Bone Spear",
    "rank": 4,
    "health": 5,
    "desc": "Shadow damage to every enemy in a line up to 6 tiles long, scaled by rank and Divine Power. Costs 5 HP; must leave at least 1 HP. No cooldown."
  },
  "arcanelance": {
    "name": "Arcane Lance",
    "rank": 2,
    "favor": 5,
    "desc": "Magic damage to one enemy within 6 tiles. Grows with rank and Divine Power. Costs 5 Favor. No cooldown."
  },
  "luckystreak": {
    "name": "Lucky Streak",
    "rank": 2,
    "favor": 10,
    "desc": "For 8 turns, once per turn, reroll a failed hit, crit, evasion, block, parry or enchantment roll. Takes no turn."
  },
  "arcanenova": {
    "name": "Arcane Nova",
    "rank": 4,
    "favor": 20,
    "desc": "Magic damage to every enemy in a 3x3 area within 6 tiles. Grows with rank and Divine Power."
  }
};

/* Legacy save names share current metadata; they never retain old mechanics. */
PRAYERS.manatide=PRAYERS.arcanelance;
PRAYERS.unbound=PRAYERS.arcanenova;
PRAYERS.corpsefeast=PRAYERS.bonespear;
PRAYERS.offering=PRAYERS.fieldsmelt;
PRAYERS.reforge=PRAYERS.anviltoll;

/* ---------------------------------------------------------------- prayer and invoke cooldowns
   THE NUMBERS ARE JUSTIN'S. Every prayer and every god's invoke can wait a number of turns before it can be used
   again, counted on the same clock as Shadowstep and Charge. 0 means no cooldown, which is how they all played
   before Beta 1.3.1. The wait starts when the prayer or invoke is paid for; the hotbar, its hover card and the
   Faith tab then show "ready in N". This table is the only place these numbers are read from (gods.js). */
var DIVINE_COOLDOWNS = {
  prayers: {
    ironhide:18, pummel:5,                 /* Chad the Unclad (grom) */
    rampage:15, trollblood:20,              /* Grumbok */
    consecrate:8, sanctuary:15,            /* Saint Glimmer (sanctuary is Holy Ground) */
    raisedead:20, bonespear:0,             /* Mother Murk */
    laststand:15, lance:2,                 /* Sir Reginald */
    fieldsmelt:20, anviltoll:8,            /* Old Anvil */
    arcanelance:0, arcanenova:8,           /* Vellum */
    luckystreak:12, rolldice2:20,           /* Wobbles (rolldice2 is Tempt Fate) */
    'the-brood':20, 'venom-burst':8        /* Sylla */
  },
  invokes: {                              /* the Cleric's invoke for each god (INVOKE_OF) */
    ironbody:18, bellow:0, heal:0, unholyaura:12, challenge:0, temper:18, arcaneward:12, rolldice:0, intothedark:5
  }
};

/* ---------------------------------------------------------------- sigils (crafted at the Forge, found unidentified) */
var SIGILS = {
  firestorm:{name:'Fire sigil', motes:['fire'], desc:'Deal 8 + floor number fire damage and inflict Burning on enemies within 3 tiles.'},
  mana:     {name:'Water sigil', motes:['water'], desc:'Restore 50% of your mana.'},
  levitate: {name:'Air sigil', motes:['air'], desc:'Clear roots and webs. Float for 25 turns: cross chasms and water; ignore roots, webs, floor traps and ground hazards.'},
  stoneskin:{name:'Earth sigil', motes:['earth'], desc:'Clear Poison and Stun. For 15 turns: immune to both and poison damage; -3 physical damage per hit.'},
  heal:     {name:'Light sigil', motes:['light'], desc:'Heal 35% of max HP, then 5% a turn for 15 turns.'},
  vanish:   {name:'Shadow sigil', motes:['shadow'], desc:'Vanish for 5 turns; enemies lose track of you.'},
  identify: {name:'Sigil of Knowing', motes:['light','shadow'], desc:'Identify every sigil you carry.'},
  mapping:  {name:'Sigil of the Deep Map', motes:['shadow','earth'], desc:'Reveal this floor\'s layout.'},
  blink:    {name:'Sigil of Blinking', motes:['air','shadow'], desc:'Teleport to a random spot you can see, 3 to 6 tiles away.'}
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
  'pot':{b:1,br:1,loot:0.45,sfx:'pot-break'}, 'bush':{b:1,br:1,burn:1,loot:0.25,sfx:'step-grass',bush:1}, 'barrel-explosive':{b:1,br:1,ex:1,burn:1},
  'brazier-lit':{b:1,light:'#FF9A40'}, 'brazier-unlit':{b:1}, 'torch-stand':{b:1,light:'#FFB050'},
  'bones':{flat:1}, 'weapon-rack':{b:1}, 'bookshelf':{b:1,burn:1}, 'cage':{b:1}, 'statue':{b:1}, 'statue-broken':{b:1},
  'mushrooms':{flat:1,light:'#6FB7FF',dim:1}, 'vines':{flat:1,burn:1}, 'ice-block':{b:1,br:1,melt:1}, 'altar-spikes':{b:1,altar:1},
  'alchemy-table':{b:1}, 'fountain':{b:1,drink:1}, 'bed-straw':{flat:1,burn:1}, 'table-candle':{b:1,light:'#FFC870',dim:1},
  'cart':{b:1,br:1,burn:1}, 'chains':{flat:1}, 'rubble':{flat:1}, 'web':{flat:1,burn:1,web:1}, 'banner-stand':{b:1,burn:1},
  'shrine':{b:1}, 'pillar':{b:1}, 'elemental-lock':{b:1}, 'lever-up':{b:1}, 'lever-down':{b:1}, 'boss-throne':{b:1}
};

/* ---------------------------------------------------------------- monsters, biome 1 */
var MONSTERS = {
  rat:     {name:'Dungeon Rat', sprite:'m-rat', col:'#8C7A63', ch:'r', hp:8, dmg:[4,5], acc:56, eva:22, armor:0, speed:100, range:1, xp:4,
            band:[1,3], w:26, pack:[2,3], art:0.75, sfx:'rat', living:true},
  bat:     {name:'Cave Bat', sprite:'m-bat', col:'#9E8CA8', ch:'b', hp:8, dmg:[2,3], acc:58, eva:44, armor:0, speed:170, range:1, xp:6,
            band:[1,2], w:6, erratic:true, flying:true, art:0.7, sfx:'bat', living:true},
  goblin:  {name:'Goblin', sprite:'m-goblin', col:'#6F9350', ch:'g', hp:16, dmg:[5,7], acc:60, eva:16, armor:1, speed:100, range:1, xp:8,
            band:[1,5], w:26, art:0.9, sfx:'goblin', living:true, artLeft:true},
  archer:  {name:'Goblin Archer', sprite:'m-goblin-archer', col:'#B8894A', ch:'a', hp:14, dmg:[3,5], acc:60, eva:18, armor:0, speed:100, range:6, xp:10,
            band:[2,5], w:18, kiter:true, art:0.9, sfx:'goblin', living:true, artLeft:true},
  brute:   {name:'Goblin Brute', sprite:'m-goblin-brute', col:'#4E7A3C', ch:'G', hp:30, dmg:[5,8], acc:58, eva:10, armor:2, speed:100, range:1, xp:18,hint:'Unblocked melee hits can push the target 1 tile. 4-turn cooldown; no extra damage.',
            band:[3,5], w:14, art:1.05, sfx:'brute', living:true, artLeft:true},
  slime:   {name:'Rock Slime', sprite:'m-rock-slime', col:'#7C8C9E', ch:'s', hp:24, dmg:[4,6], acc:54, eva:8, armor:3, speed:70, range:1, xp:16, rootSpit:true,
            band:[2,4], w:12, splits:true, art:0.8, artLeft:true, sfx:'slime',
            hint:'Regenerates 2 HP per turn. Damage at full HP splits it into two slimes sharing its remaining HP. Either can split again at full HP.'},
  pebbleslime:{name:'Pebble Slime', sprite:'m-slime', col:'#7C8C9E', ch:'s', hp:10, dmg:[2,3], acc:54, eva:8, armor:0, speed:70, range:1, xp:8,
            band:[1,1], biome:[0], w:12, pebbleSlam:true, art:0.65, sfx:'slime',
            hint:'Marks a tile before striking. Move off the mark.'},
  shaman:  {name:'Goblin Shaman', sprite:'m-goblin-shaman', col:'#C25A3A', ch:'h', hp:16, dmg:[3,5], acc:64, eva:14, armor:0, speed:100, range:1, xp:18,
            band:[3,5], w:10, caster:'firebolt', castRange:6, castEvery:4, el:'fire', art:0.9, sfx:'shaman', living:true, spellcaster:true, artLeft:true},
  skeleton:{name:'Skeleton', sprite:'m-skeleton', col:'#D8CEBC', ch:'k', hp:16, dmg:[3,5], acc:62, eva:18, armor:2, speed:100, range:1, xp:18,
            band:[9,9], w:0, undead:true, art:0.95, sfx:'skeleton'},
  mimic:   {name:'Mimic', sprite:'m-mimic', col:'#8A5A2A', ch:'m', hp:30, dmg:[5,8], acc:64, eva:10, armor:3, speed:100, range:1, xp:30,
            band:[9,9], w:0, art:0.85, sfx:'mimic'},
  warchief:{name:'Grukk the Warchief', sprite:'m-goblin-warchief', col:'#A8452A', ch:'W', hp:143, dmg:[7,12], acc:68, eva:14, armor:3, speed:100, range:1, xp:220,
            band:[9,9], w:0, boss:true, elite:true, art:1.35, sfx:'warchief', living:true, artLeft:true},
  /* elementalings: rare, drop a mote */
  emberling:{name:'Emberling', sprite:'m-emberling', col:'#E2622B', ch:'*', hp:16, dmg:[3,5], acc:62, eva:22, armor:0, speed:100, range:1, xp:21, band:[2,5], rare:true, el:'fire', drop:'mote', art:0.7, sfx:'elementaling'},
  tideling: {name:'Dropling', sprite:'m-tideling', col:'#62A8D8', ch:'*', hp:16, dmg:[3,5], acc:60, eva:20, armor:1, speed:100, range:1, xp:21, band:[2,5], rare:true, el:'water', drop:'mote', art:0.7, sfx:'elementaling'},
  galeling: {name:'Puffling', sprite:'m-galeling', col:'#E8D27A', ch:'*', hp:14, dmg:[3,5], acc:64, eva:30, armor:0, speed:140, range:1, xp:21, band:[2,5], rare:true, el:'air', drop:'mote', erratic:true, flying:true, art:0.7, sfx:'elementaling'},
  stoneling:{name:'Pebbling', sprite:'m-stoneling', col:'#7FA05A', ch:'*', hp:20, dmg:[3,5], acc:56, eva:8, armor:3, speed:100, range:1, xp:21, band:[2,5], rare:true, el:'earth', drop:'mote', art:0.7, sfx:'elementaling'},
  wisp:     {name:'Inking', sprite:'m-wisp', col:'#8A6FB0', ch:'*', hp:16, dmg:[3,5], acc:64, eva:26, armor:0, speed:100, range:1, xp:21, band:[3,5], rare:true, el:'shadow', drop:'mote', shadowy:true, art:0.7, sfx:'elementaling'},
  lumenling:{name:'Glimmerling', sprite:'m-lumenling', col:'#F6E7B0', ch:'*', hp:16, dmg:[3,5], acc:64, eva:24, armor:0, speed:100, range:1, xp:24, band:[3,5], rare:true, el:'light', drop:'mote', art:0.7, sfx:'elementaling'}
};
/* ---------------------------------------------------------------- drop tables
   chance: odds that a kill drops anything at all (the Ring of Luck raises it). Then one pick from table,
   weighted: essence (currency), gear (a random weapon, armor, off-hand, ring or amulet), sigil, food.
   Elementalings always drop their mote instead; the boss has his own hoard. */
var DROPS = {
  rat:     {chance:0.10, table:{essence:8, food:4}},
  bat:     {chance:0.08, table:{essence:18, sigil:1}},
  goblin:  {chance:0.18, table:{essence:12, gear:4, sigil:1, food:4}},
  archer:  {chance:0.20, table:{essence:10, gear:6, sigil:1}},
  brute:   {chance:0.35, table:{essence:4, gear:5, food:2}},
  slime:   {chance:0.15, table:{essence:16, sigil:1}},
  pebbleslime:{chance:0.15, table:{essence:16, sigil:1}},
  shaman:  {chance:0.35, table:{essence:6, sigil:3, gear:4}},
  skeleton:{chance:0.25, table:{essence:4, gear:6}},
  mimic:   {chance:1.00, table:{gear:6, essence:4}}
};

/* summoned forms for Mother Murk's Raise Dead, by piety rank */
var UNDEAD_FORMS = [
  {rank:1, kind:'skeleton', name:'Risen Skeleton', hp:14, dmg:[3,6]},
  {rank:5, kind:'skeleton', name:'Lich', hp:26, dmg:[5,9], caster:'shadowbolt', sprite:'m-lich', art:1.0}
];
