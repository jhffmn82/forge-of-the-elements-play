/* Forge of the Elements - interface demo with placeholder art.
   First pass of the rules in DESIGN.md: seeded generation, fog of war,
   time-based turns, accuracy vs evasion, flat armor, affinity riders, statuses. */

/* ============ helpers ============ */
var $ = function(id){ return document.getElementById(id); };
var clamp = function(v,a,b){ return Math.max(a, Math.min(b, v)); };
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
var rng = mulberry32(48213);
function ri(a,b){ return a + Math.floor(rng()*(b-a+1)); }
function pick(arr){ return arr[Math.floor(rng()*arr.length)]; }
function dist(a,b){ return Math.max(Math.abs(a.x-b.x), Math.abs(a.y-b.y)); }
function roll(a,b){ return a + Math.floor(rng()*(b-a+1)); }

/* ============ world data ============ */
var MW=56, MH=34, TS=24;   /* floors trimmed from 64x40 on 2026-09-16 */
var WALL=0, FLOOR=1, DOOR=2, STAIRS=3, CHEST=4, FORGE=5, RUBBLE=6, OPEN=7;   /* DOOR is shut, OPEN is a door standing open */
var BIOMES=[
  {name:'Dungeon', wall:'#6F6559', wall2:'#7D7367', floor:'#201C19', floor2:'#262220'},
  {name:'Crypt',   wall:'#6B6673', wall2:'#787381', floor:'#1E1D23', floor2:'#242229'},
  {name:'Caverns', wall:'#6F6350', wall2:'#7C6F5C', floor:'#1F1B16', floor2:'#26211B'}
];
/* ---- the bestiary --------------------------------------------------------
   biome: which biomes it lives in (0 dungeon, 1 crypt, 2 caverns)
   band:  the floors it appears on WITHIN its biome, 1-5, so one table
          re-reads at every depth instead of listing 25 floors
   w:     relative frequency inside the band
   rare:  never enters the ordinary pool - placed at most once a floor
   el:    its attacks carry that element, and it drops a mote of it        */
var MONSTERS={
  /* --- biome 1: the dungeon --- */
  rat:    {name:'Dungeon Rat',   ch:'r', col:'#8C7A63', hp:6,  dmg:[1,3], acc:56, eva:22, armor:0, speed:130, range:1, xp:6,  biome:[0,2], band:[1,3], w:26, sprite:'rat', art:0.78},
  bat:    {name:'Cave Bat',      ch:'b', col:'#9E8CA8', hp:5,  dmg:[1,3], acc:58, eva:32, armor:0, speed:170, range:1, xp:8,  biome:[0,2], band:[1,2], w:16, erratic:true},
  goblin: {name:'Goblin',        ch:'g', col:'#6F9350', hp:14, dmg:[3,5], acc:60, eva:16, armor:1, speed:100, range:1, xp:12, biome:[0],   band:[1,5], w:26, sprite:'goblin', art:0.96},
  archer: {name:'Goblin Archer', ch:'a', col:'#B8894A', hp:10, dmg:[2,5], acc:62, eva:18, armor:0, speed:100, range:6, xp:14, biome:[0],   band:[2,5], w:20},
  brute:  {name:'Goblin Brute',  ch:'G', col:'#4E7A3C', hp:26, dmg:[5,9], acc:58, eva:10, armor:2, speed:90,  range:1, xp:24, biome:[0],   band:[3,5], w:16},
  slime:  {name:'Rock Slime',    ch:'s', col:'#7C8C9E', hp:22, dmg:[4,7], acc:54, eva:8,  armor:4, speed:70,  range:1, xp:20, biome:[0,2], band:[3,5], w:14},
  shaman: {name:'Goblin Shaman', ch:'h', col:'#C25A3A', hp:16, dmg:[4,8], acc:64, eva:14, armor:0, speed:100, range:5, xp:26, biome:[0],   band:[4,5], w:12, el:'fire'},

  /* --- biome 2: the undead crypt --- */
  shambler:{name:'Shambler',     ch:'z', col:'#8A9070', hp:20, dmg:[3,6], acc:54, eva:6,  armor:1, speed:70,  range:1, xp:14, biome:[1],   band:[1,3], w:24},
  skeleton:{name:'Skeleton',     ch:'k', col:'#D8CEBC', hp:16, dmg:[3,6], acc:62, eva:18, armor:2, speed:100, range:1, xp:18, biome:[1],   band:[1,5], w:26},
  bonebow: {name:'Bone Archer',  ch:'A', col:'#C0B49E', hp:12, dmg:[3,6], acc:64, eva:20, armor:1, speed:100, range:6, xp:22, biome:[1],   band:[2,5], w:18},
  shade:   {name:'Shade',        ch:'S', col:'#8A6FB0', hp:12, dmg:[3,6], acc:64, eva:24, armor:0, speed:110, range:1, xp:18, biome:[1],   band:[2,5], w:16, el:'shadow'},
  wight:   {name:'Crypt Wight',  ch:'W', col:'#6F5AA0', hp:30, dmg:[6,10],acc:66, eva:16, armor:2, speed:100, range:1, xp:34, biome:[1],   band:[4,5], w:12, el:'shadow'},

  /* --- biome 3: the caverns below --- */
  kobold: {name:'Kobold Digger', ch:'d', col:'#A8703C', hp:12, dmg:[2,5], acc:60, eva:20, armor:1, speed:110, range:1, xp:12, biome:[2],   band:[1,3], w:24},
  trog:   {name:'Troglodyte',    ch:'T', col:'#7A8C6A', hp:28, dmg:[5,9], acc:60, eva:12, armor:2, speed:90,  range:1, xp:28, biome:[2],   band:[3,5], w:18},
  hound:  {name:'Magma Hound',   ch:'H', col:'#E2622B', hp:24, dmg:[5,8], acc:66, eva:18, armor:1, speed:130, range:1, xp:32, biome:[2],   band:[4,5], w:14, el:'fire'},

  /* --- elementalings: rare, in every biome, the only mob that hands you a mote --- */
  emberling:{name:'Emberling',    ch:'*', col:'#E2622B', hp:18, dmg:[4,7], acc:66, eva:26, armor:0, speed:120, range:1, xp:30, biome:[0,1,2], band:[1,5], rare:true, el:'fire',   drop:'mote', sprite:'emberling'},
  tideling: {name:'Tideling',     ch:'*', col:'#62A8D8', hp:22, dmg:[3,6], acc:64, eva:24, armor:1, speed:110, range:1, xp:30, biome:[0,1,2], band:[1,5], rare:true, el:'water',  drop:'mote', sprite:'tideling'},
  galeling: {name:'Galeling',     ch:'*', col:'#E8B44A', hp:14, dmg:[4,8], acc:70, eva:34, armor:0, speed:160, range:1, xp:30, biome:[0,1,2], band:[1,5], rare:true, el:'air',    drop:'mote', erratic:true, sprite:'galeling'},
  stoneling:{name:'Stoneling',    ch:'*', col:'#7FA05A', hp:30, dmg:[4,7], acc:60, eva:8,  armor:4, speed:80,  range:1, xp:30, biome:[0,1,2], band:[1,5], rare:true, el:'earth',  drop:'mote', sprite:'stoneling'},
  wisp:     {name:'Gloom Wisp',   ch:'*', col:'#8A6FB0', hp:16, dmg:[4,8], acc:68, eva:30, armor:0, speed:120, range:1, xp:30, biome:[0,1,2], band:[3,5], rare:true, el:'shadow', drop:'mote', sprite:'wisp'},
  lumenling:{name:'Lumenling',    ch:'*', col:'#F2E8DC', hp:20, dmg:[4,7], acc:70, eva:28, armor:0, speed:120, range:1, xp:34, biome:[0,1,2], band:[3,5], rare:true, el:'light',  drop:'mote', sprite:'lumenling'}
};
function depthIn(){ return ((floorNo-1)%5)+1; }          /* floor within the biome, 1-5 */
function biomeIdx(){ return Math.min(BIOMES.length-1, Math.floor((floorNo-1)/5)); }
function rosterFor(d, bi){
  var out=[];
  for(var k in MONSTERS){
    var b=MONSTERS[k];
    if(b.rare || !b.band || b.biome.indexOf(bi)<0) continue;
    if(d < b.band[0] || d > b.band[1]) continue;
    out.push([k, b.w||10]);
  }
  return out;
}
function rollMonster(){
  var roster=rosterFor(depthIn(), biomeIdx());
  if(!roster.length) roster=[['rat',1]];
  var total=0, i;
  for(i=0;i<roster.length;i++) total += roster[i][1];
  var r=rng()*total;
  for(i=0;i<roster.length;i++){ r -= roster[i][1]; if(r<=0) return roster[i][0]; }
  return roster[roster.length-1][0];
}
function rollRare(){
  var d=depthIn(), bi=biomeIdx(), out=[];
  for(var k in MONSTERS){
    var b=MONSTERS[k];
    if(!b.rare || b.biome.indexOf(bi)<0 || d<b.band[0] || d>b.band[1]) continue;
    out.push(k);
  }
  return out.length ? pick(out) : null;
}
var BUILDS={
  dwarf:{ name:'Thrain Stonebeard', who:'Dwarf Fighter', stats:{mig:13,agi:8,vit:14,foc:9}, aff:{earth:1}, speed:100, col:'#E8B44A', sprite:'dwarf',
    weapon:{name:'Rusty Mace', dmg:[3,6], acc:-5, hands:1, note:'ignores 2 armor'},
    alt:{name:'Rusty Battle Axe', dmg:[5,9], acc:-10, hands:2, note:'+25% vs wounded'},
    armor:{name:'Heavy Plate (Earth)', armor:3, eva:-10, note:'+2 armor enchant'},
    off:{name:'Kite Shield (Earth)', block:0.35, note:'+15% block'},   /* shields block */
    classAbility:'double' },
  elf:{ name:'Saelis Duskwarden', who:'Elf Mage', stats:{mig:9,agi:11,vit:8,foc:16}, aff:{fire:1}, speed:110, col:'#62A8D8',
    weapon:{name:'Rusty Wand', dmg:[1,2], acc:0, hands:1, spell:0.10, note:'+10% spell damage'},
    alt:{name:'Oak Staff', dmg:[2,4], acc:0, hands:2, spell:0.20, note:'+20% spell damage'},
    armor:{name:'Robe (Fire)', armor:1, eva:5, note:'attackers singed'},
    off:{name:'Orb (Fire)', block:0, note:'+15% fire spells'},
    classAbility:'missile' },
  human:{ name:'Wren Quickfingers', who:'Human Scoundrel', stats:{mig:10,agi:14,vit:10,foc:10}, aff:{shadow:1}, speed:100, col:'#8A6FB0',
    weapon:{name:'Rusty Dagger', dmg:[2,5], acc:10, hands:1, note:'surprise x1.5'},
    alt:{name:'Short Bow', dmg:[3,6], acc:5, hands:2, range:6, note:'range 6; weak up close'},
    armor:{name:'Leathers (Shadow)', armor:1, eva:5, note:'heal on kill'},
    off:{name:'Off-hand Dagger', block:0, weapon:true, note:'bonus strike 15%'},
    classAbility:'sap' },
  gloom:{ name:'Vess of the Quiet Hollow', who:'Gloomling Cleric of Mother Murk', stats:{mig:9,agi:8,vit:12,foc:13}, aff:{shadow:1}, locked:'shadow', god:'murk',
    speed:100, col:'#8A6FB0', sprite:'gloomling',
    weapon:{name:'Bone Censer', dmg:[3,6], acc:0, hands:1, note:'+10% shadow damage'},
    alt:{name:'Grave Staff', dmg:[2,4], acc:0, hands:2, spell:0.20, note:'+20% spell damage'},
    armor:{name:'Shroud (Shadow)', armor:1, eva:5, note:'shadow-touched cloth'},
    off:{name:'Warding Candle', block:0, note:'+15% shadow spells'},
    classAbility:'invoke' },
  faewater:{ name:'Nerissa of the Tide Court', who:'Fae Scoundrel', stats:{mig:8,agi:16,vit:9,foc:11}, aff:{water:1}, locked:'water',
    speed:100, col:'#62A8D8', sprite:'fae-water',
    weapon:{name:'Rusty Dagger', dmg:[2,5], acc:10, hands:1, note:'surprise x1.5'},
    alt:{name:'Short Bow', dmg:[3,6], acc:5, hands:2, range:6, note:'range 6; weak up close'},
    armor:{name:'Leathers', armor:1, eva:5, note:'light'},
    off:{name:'Off-hand Dagger', block:0, weapon:true, note:'bonus strike 15%'},
    classAbility:'sap' },
  fae:{ name:'Ilka of the Ember Court', who:'Fae Scoundrel', stats:{mig:8,agi:16,vit:9,foc:11}, aff:{fire:1}, locked:'fire',
    speed:100, col:'#E2622B',
    weapon:{name:'Rusty Dagger', dmg:[2,5], acc:10, hands:1, note:'surprise x1.5'},
    alt:{name:'Short Bow', dmg:[3,6], acc:5, hands:2, range:6, note:'range 6; weak up close'},
    armor:{name:'Leathers', armor:1, eva:5, note:'light'},
    off:{name:'Off-hand Dagger', block:0, weapon:true, note:'bonus strike 15%'},
    classAbility:'sap' }
};
/* gods: only the one the demo can start with is wired up so far */
var GODS={
  murk:{ name:'Mother Murk', invoke:'raisedead' }
};
var EMPTY_OFF={name:'Empty', block:0, note:'nothing in your off hand'};
var ABILITIES={
  double:{name:'Double Strike', cost:12, tech:true, kind:'melee2', desc:'Two weapon attacks on an adjacent enemy.'},
  root:{name:'Earth Root', cost:12, kind:'bolt', range:4, type:'phys', base:[9,15], status:{root:2}, desc:'Rock spell: physical damage, roots for 2 turns.'},
  missile:{name:'Magic Missile', cost:7, kind:'bolt', range:6, type:'magic', base:[3,6], always:true, perAffinity:1, desc:'Always hits. Magic damage: nothing resists it. +1 for every point of elemental affinity you hold. No riders.'},
  firebolt:{name:'Firebolt', cost:12, kind:'bolt', range:6, type:'fire', base:[9,15], status:{burn:3}, desc:'Fire damage; sets the target burning.'},
  step:{name:'Flame Step', cost:4, kind:'dash', desc:'Dash up to 3 tiles; enemies beside you are burned.'},
  sap:{name:'Sap', cost:7, tech:true, kind:'bolt', range:5, type:'phys', base:[2,4], status:{stun:3}, desc:'Melee or ranged: knocks the target out for 3 turns.'},
  shadowbolt:{name:'Shadow Bolt', cost:12, kind:'bolt', range:6, type:'dark', base:[9,15], status:{fear:2}, desc:'Dark damage; the target flees in fear.'},
  raisedead:{name:'Raise Dead', cost:8, kind:'summon', range:4, life:20, desc:'Invoke (Mother Murk): a skeleton claws out of the floor and fights for you for 20 turns. One at a time.'},
  vanish:{name:'Vanish', cost:6, kind:'hide', desc:'Slip out of sight for 4 turns; your next hit is a surprise attack.'}
};
var LOOT={
  weapons:[
    {name:'Rusty Sword', dmg:[3,7], acc:0, hands:1, note:'+5% crit'},
    {name:'Rusty Dagger', dmg:[2,5], acc:10, hands:1, note:'surprise x1.5'},
    {name:'Rusty Mace', dmg:[3,6], acc:-5, hands:1, note:'ignores 2 armor'},
    {name:'Rusty Long Sword', dmg:[5,9], acc:0, hands:2, note:'+10% crit'},
    {name:'Short Bow', dmg:[3,6], acc:5, hands:2, range:6, note:'range 6; weak up close'},
    {name:'Oak Staff', dmg:[2,4], acc:0, hands:2, spell:0.20, note:'+20% spell damage'}
  ],
  armors:[
    {name:'Robe', armor:0, eva:5, note:'no penalty'},
    {name:'Leathers', armor:1, eva:5, note:'light'},
    {name:'Chain Shirt', armor:2, eva:0, note:'medium'},
    {name:'Rusty Plate', armor:3, eva:-10, note:'heavy'}
  ],
  sigils:[
    {name:'Light sigil', use:'heal'},
    {name:'Fire sigil', use:'firestorm'},
    {name:'Air sigil', use:'blink'},
    {name:'Earth sigil', use:'stoneskin'},
    {name:'Shadow sigil', use:'vanish'}
  ],
  looks:['Ashen sigil','Coiled sigil','Cracked sigil','Weeping sigil','Humming sigil','Bone sigil','Tarnished sigil','Woven sigil']
};
var PASSIVES={
  mig:[{at:12,id:'heavyHands',name:'Heavy Hands',d:'+10% melee damage'},
       {at:15,id:'crushing',  name:'Crushing Blows',d:'+25% damage to targets below half HP'},
       {at:18,id:'armorMaster',name:'Armor Master',d:'heavy armor evasion penalty halved'},
       {at:21,id:'cleaving',  name:'Cleaving Swings',d:'your attacks also hit one other adjacent enemy for half'},
       {at:25,id:'unstoppable',name:'Unstoppable',d:'immune to stun, +20% melee damage'}],
  agi:[{at:12,id:'lightFeet',name:'Light Feet',d:'+8 evasion'},
       {at:15,id:'deadeye',  name:'Deadeye',d:'+8% crit chance'},
       {at:18,id:'fleet',    name:'Fleet',d:'moving costs 15% less time'},
       {at:21,id:'riposte',  name:'Riposte',d:'a parry has a 50% chance to counterattack'},
       {at:25,id:'blur',     name:'Blur',d:'an attack against you misses outright (every 20 turns)'}],
  vit:[{at:12,id:'tough',    name:'Tough',d:'+15% max HP'},
       {at:15,id:'secondWind',name:'Second Wind',d:'heal 10% of max HP on every new floor'},
       {at:18,id:'ironConst',name:'Iron Constitution',d:'statuses on you last half as long'},
       {at:21,id:'fortitude',name:'Fortitude',d:'a hit against you is halved (every 15 turns)'},
       {at:25,id:'resilient',name:'Resilient',d:'regeneration doubles below half HP'}],
  foc:[{at:12,id:'arcaneStudy',name:'Arcane Study',d:'+10% spell damage'},
       {at:15,id:'meditation',name:'Meditation',d:'+25% mana regeneration'},
       {at:18,id:'deepFocus', name:'Deep Focus',d:'+20% spell damage'},
       {at:21,id:'overflow',  name:'Overflow',d:'a spell that kills refunds half its mana'},
       {at:25,id:'archmage',  name:'Archmage',d:'+50% mana regeneration, spells can crit'}]
};
function hasP(id){ return !!(player.passives && player.passives[id]); }
function recomputePassives(){
  var got={}, list=[];
  for(var k in PASSIVES) PASSIVES[k].forEach(function(p){
    if(player.stats[k] >= p.at){ got[p.id]=true; list.push(p.id); }
  });
  var fresh=[];
  for(var i=0;i<list.length;i++) if(!player.passives || !player.passives[list[i]]) fresh.push(list[i]);
  player.passives=got;
  return fresh;
}
var ELEMENT_ABILS={
  fire:   {2:'firebolt', 4:'step'},
  earth:  {2:'root'},
  shadow: {2:'shadowbolt', 4:'vanish'},
  water:  {2:'root'},
  air:    {2:'firebolt'},
  light:  {2:'firebolt'}
};
var AFF_COL={fire:'#E2622B',earth:'#7FA05A',shadow:'#8A6FB0',water:'#62A8D8',air:'#E8B44A',light:'#F2E8DC'};

/* ============ state ============ */
var sigilLook={}, sigilKnown={};
function shuffleSigils(){
  sigilLook={}; sigilKnown={};
  var looks=LOOT.looks.slice();
  for(var i=looks.length-1;i>0;i--){ var j=Math.floor(rng()*(i+1)); var t=looks[i]; looks[i]=looks[j]; looks[j]=t; }
  LOOT.sigils.forEach(function(s,i){ sigilLook[s.use]=looks[i%looks.length]; sigilKnown[s.use]=false; });
}
function sigilName(use){
  var real=LOOT.sigils.filter(function(s){ return s.use===use; })[0];
  return sigilKnown[use] ? real.name : sigilLook[use];
}
function identifySigil(use){
  if(sigilKnown[use]) return;
  sigilKnown[use]=true;
  var real=LOOT.sigils.filter(function(s){ return s.use===use; })[0];
  player.bag.forEach(function(b){ if(b.uid==='sigil:'+use) b.name=real.name; });
  log('It was a <b>'+real.name+'</b>. You will know it from now on.','c-kill');
}
var map, seen, vis, feats, items, ents, rooms=[], spawnedExtra=0, nextSpawn=0;
var floorNo=1, turn=0, revealAll=false, worldSeed=48213, nextId=1, lastDir=[1,0];
var aiming=null, hoverX=-1, hoverY=-1;
/* two independent knobs: NUM changes how big numbers look, LETH changes how deadly fights are */
var NUM=1.0, LETH=1.0;
function sHP(v){ return Math.max(1, Math.round(v*NUM)); }
function sDMG(v){ return Math.max(1, Math.round(v*NUM*LETH)); }
function costOf(A){
  var c = A.cost;
  if(player && player.build==='elf' && !A.tech) c *= 0.85;          /* Elf: spells cost 15% less */
  return Math.max(1, Math.round(c*NUM));
}   /* aiming = {i, A} while an ability waits for a target */
var player={ id:0, ch:'@', x:2, y:2, t:0, st:{}, foe:false, build:'dwarf',
             essence:0, motes:{}, bag:[], hidden:0, level:1, xp:0, xpNext:90, points:0, blurCd:0, fortCd:0 };

function at(x,y){ return (x<0||y<0||x>=MW||y>=MH) ? WALL : map[y*MW+x]; }
function setT(x,y,v){ if(x>=0&&y>=0&&x<MW&&y<MH) map[y*MW+x]=v; }
function walkable(x,y){ var t=at(x,y); return t===FLOOR||t===OPEN||t===STAIRS||t===RUBBLE||t===FORGE; }
function opaque(x,y){ var t=at(x,y); return t===WALL || t===DOOR; }   /* a shut door blocks sight */
function biome(){ return BIOMES[Math.min(BIOMES.length-1, Math.floor((floorNo-1)/5))]; }

function derive(p){
  var b=BUILDS[p.build], s=b.stats;
  if(!p.sets) p.sets=[b.weapon, b.alt];
  if(p.activeSet===undefined) p.activeSet=0;
  if(!p.armorItem) p.armorItem=b.armor;
  if(!p.off) p.off=b.off;
  if(!p.aff) p.aff={};
  p.stats=s; p.weapon=p.sets[p.activeSet];
  p.speed=b.speed; p.name=b.name; p.who=b.who; p.col=b.col;
  /* abilities = your class ability, plus whatever your affinity has unlocked */
  var cls = b.classAbility==='invoke' ? (GODS[b.god] && GODS[b.god].invoke) : b.classAbility;
  p.abilities = cls ? [cls] : [];
  for(var el in p.aff){
    var tiers=ELEMENT_ABILS[el]||{};
    for(var t=2;t<=6;t++)
      if(p.aff[el]>=t && tiers[t] && p.abilities.indexOf(tiers[t])<0) p.abilities.push(tiers[t]);
  }
  p.maxhp = sHP((10 + 2*s.vit + p.level) * (hasP('tough')?1.15:1));
  var pool = Math.ceil(10 + s.foc + s.foc/10*p.level);
  if(b.who.indexOf('Mage')>=0) pool = Math.ceil(pool*1.3);          /* Mage class passive: +30% max mana */
  p.maxmp = sHP(pool);
  recomputePassives();
  p.acc = 60 + 2*s.agi + (p.weapon.acc||0);
  var evaPen = p.armorItem.eva||0;
  if(evaPen<0 && hasP('armorMaster')) evaPen = Math.round(evaPen/2);
  p.eva = 10 + 2*s.agi + evaPen + (hasP('lightFeet')?8:0);
  p.armor = p.armorItem.armor;
  p.twoHanded = p.weapon.hands===2;
  p.block = p.twoHanded ? 0 : Math.min(0.5, p.off.block || 0);
  p.parry = (p.twoHanded || !p.off || !p.off.weapon) ? 0 : (0.08 + s.agi/300);
  p.rangeBonus = p.build==='elf' ? 1 : 0;                        /* elf racial: +1 range */
  p.range = p.weapon.range ? p.weapon.range + p.rangeBonus : 1;
  p.crit = 0.06 + (hasP('deadeye')?0.08:0);
  var plus = p.weapon.plus||0;
  p.dmg = [sDMG(p.weapon.dmg[0])+plus, sDMG(p.weapon.dmg[1])+plus];
  p.element = Object.keys(b.aff)[0] || null;
  p.affLevel = p.element ? b.aff[p.element] : 0;
}

/* ============ generation ============ */
function generate(seed){
  rng = mulberry32(seed>>>0);
  map=new Uint8Array(MW*MH); seen=new Uint8Array(MW*MH); vis=new Uint8Array(MW*MH);
  feats=[]; items=[]; ents=[];

  rooms=[]; var leaves=[{x:1,y:1,w:MW-2,h:MH-2}], i, j, x, y;
  for(i=0;i<6;i++){
    var next=[];
    for(j=0;j<leaves.length;j++){
      var L=leaves[j], min=7;
      var horiz = L.w < L.h*1.25 ? true : (L.h < L.w*1.25 ? false : rng()<0.5);
      if(horiz && L.h>min*2){ var cy=ri(min,L.h-min);
        next.push({x:L.x,y:L.y,w:L.w,h:cy},{x:L.x,y:L.y+cy,w:L.w,h:L.h-cy}); }
      else if(!horiz && L.w>min*2){ var cx=ri(min,L.w-min);
        next.push({x:L.x,y:L.y,w:cx,h:L.h},{x:L.x+cx,y:L.y,w:L.w-cx,h:L.h}); }
      else next.push(L);
    }
    if(next.length===leaves.length) break;
    leaves=next;
  }
  for(i=0;i<leaves.length;i++){
    var A=leaves[i];
    var w=ri(4,Math.max(4,A.w-2)), h=ri(3,Math.max(3,A.h-2));
    var rx=A.x+ri(1,Math.max(1,A.w-w-1)), ry=A.y+ri(1,Math.max(1,A.h-h-1));
    for(var b2=ry;b2<ry+h;b2++) for(var a2=rx;a2<rx+w;a2++) setT(a2,b2,FLOOR);
    rooms.push({x:rx,y:ry,w:w,h:h,cx:rx+(w>>1),cy:ry+(h>>1)});
  }
  /* connect each room to its nearest already-connected neighbour, and stop the moment we
     reach existing floor - that is what stops corridors running in useless parallel pairs */
  rooms.sort(function(p,q){ return p.cx-q.cx; });
  var joined=[rooms[0]];
  for(i=1;i<rooms.length;i++){
    var target=rooms[i], best=joined[0], bd=1e9;
    for(j=0;j<joined.length;j++){
      var dd=Math.abs(joined[j].cx-target.cx)+Math.abs(joined[j].cy-target.cy);
      if(dd<bd){ bd=dd; best=joined[j]; }
    }
    carveCorridor(target.cx,target.cy,best.cx,best.cy);
    joined.push(target);
  }
  /* every room must actually be reachable; if a stop-early left one stranded, dig straight through */
  for(i=1;i<rooms.length;i++){
    if(!reachable(rooms[0].cx,rooms[0].cy,rooms[i].cx,rooms[i].cy))
      carveCorridor(rooms[i].cx,rooms[i].cy,rooms[0].cx,rooms[0].cy,true);
  }
  /* doors only where a one-tile corridor meets a room wall */
  for(i=0;i<rooms.length;i++){
    var r=rooms[i];
    for(var k=r.x;k<r.x+r.w;k++){
      if(doorSpot(k,r.y-1,true) && rng()<0.75) setT(k,r.y-1,DOOR);
      if(doorSpot(k,r.y+r.h,true) && rng()<0.75) setT(k,r.y+r.h,DOOR);
    }
    for(var m=r.y;m<r.y+r.h;m++){
      if(doorSpot(r.x-1,m,false) && rng()<0.75) setT(r.x-1,m,DOOR);
      if(doorSpot(r.x+r.w,m,false) && rng()<0.75) setT(r.x+r.w,m,DOOR);
    }
  }
  var first=rooms[0], last=rooms[rooms.length-1];
  setT(last.cx,last.cy,STAIRS);
  var mid=rooms[Math.floor(rooms.length/2)];
  if(floorNo%3===0 || floorNo===1) setT(mid.cx, mid.cy, FORGE);
  for(i=0;i<2;i++){ var rc=pick(rooms), qx=rc.x+ri(0,rc.w-1), qy=rc.y+ri(0,rc.h-1); if(at(qx,qy)===FLOOR) setT(qx,qy,CHEST); }
  for(i=0;i<14;i++){ var rr=pick(rooms), ux=rr.x+ri(0,rr.w-1), uy=rr.y+ri(0,rr.h-1); if(at(ux,uy)===FLOOR) setT(ux,uy,RUBBLE); }

  var open=[];
  for(y=0;y<MH;y++) for(x=0;x<MW;x++) if(at(x,y)===FLOOR) open.push({x:x,y:y});
  for(i=0;i<4+floorNo;i++){ var tf=pick(open); feats.push({x:tf.x,y:tf.y,kind:pick(['spike','fire','web']),found:false}); }
  for(i=0;i<3;i++){ var te=pick(open); items.push({x:te.x,y:te.y,kind:'essence',n:ri(6,14)}); }
  for(i=0;i<2;i++){ var tw=pick(open); var w=pick(LOOT.weapons);
    var copy={}; for(var kk in w) copy[kk]=w[kk];
    if(rng()<0.3) copy.enchant=pick(['fire','earth','shadow','water']);
    copy.plus = rng()<0.5 ? ri(1,3) : 0;
    items.push({x:tw.x,y:tw.y,kind:'weapon',it:copy}); }
  { var ta=pick(open); items.push({x:ta.x,y:ta.y,kind:'armor',it:pick(LOOT.armors)}); }
  for(i=0;i<2;i++){ var ts=pick(open); items.push({x:ts.x,y:ts.y,kind:'sigil',it:pick(LOOT.sigils)}); }
  { var tr=pick(open); items.push({x:tr.x,y:tr.y,kind:'ration'}); }
  for(i=0;i<2;i++){ var tm=pick(open); items.push({x:tm.x,y:tm.y,kind:'mote',el:pick(['fire','earth','shadow','water'])}); }

  player.x=first.cx; player.y=first.cy; player.t=0;
  ents=[player]; spawnedExtra=0; nextSpawn=turn + ri(60,110);
  var count = 10 + floorNo*3;
  for(i=0;i<count;i++){
    var sp=pick(open);
    if(Math.abs(sp.x-player.x)+Math.abs(sp.y-player.y) < 12) continue;
    var m=spawn(rollMonster(), sp.x, sp.y);
    /* sleepers hold the rooms; whatever is out in the corridors is already on the move */
    m.state = inRoom(sp.x,sp.y) ? (rng()<0.85?'asleep':'wander') : 'wander';
  }
  /* at most one elementaling a floor, and not on every floor - it is the
     reason to clear a level rather than dive, because it carries a mote */
  if(rng() < 0.30 + 0.05*depthIn()){
    var rk=rollRare();
    if(rk){
      for(var ra=0; ra<40; ra++){
        var rs=pick(open);
        if(Math.abs(rs.x-player.x)+Math.abs(rs.y-player.y) < 14) continue;
        if(ents.some(function(e){ return e.x===rs.x && e.y===rs.y; })) continue;
        var rm=spawn(rk, rs.x, rs.y); rm.state='wander'; break;
      }
    }
  }
  computeFOV();
}
function carveCorridor(ax,ay,bx,by,force){
  var x=ax, y=ay, steps=[], horizFirst=rng()<0.5;
  if(horizFirst){
    while(x!==bx){ x += x<bx?1:-1; steps.push([x,y]); }
    while(y!==by){ y += y<by?1:-1; steps.push([x,y]); }
  } else {
    while(y!==by){ y += y<by?1:-1; steps.push([x,y]); }
    while(x!==bx){ x += x<bx?1:-1; steps.push([x,y]); }
  }
  for(var i=0;i<steps.length;i++){
    var sx=steps[i][0], sy=steps[i][1];
    if(at(sx,sy)!==WALL){ if(!force && i>0) return; continue; }
    setT(sx,sy,FLOOR);
  }
}
function reachable(ax,ay,bx,by){
  var seenF=new Uint8Array(MW*MH), q=[[ax,ay]];
  seenF[ay*MW+ax]=1;
  while(q.length){
    var c=q.pop(), cx=c[0], cy=c[1];
    if(cx===bx && cy===by) return true;
    var n=[[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]];
    for(var i=0;i<4;i++){
      var nx=n[i][0], ny=n[i][1];
      if(nx<0||ny<0||nx>=MW||ny>=MH) continue;
      if(seenF[ny*MW+nx] || !walkable(nx,ny)) continue;
      seenF[ny*MW+nx]=1; q.push([nx,ny]);
    }
  }
  return false;
}
function doorSpot(x,y,horizontalWall){
  if(at(x,y)!==FLOOR) return false;
  if(horizontalWall) return at(x-1,y)===WALL && at(x+1,y)===WALL;
  return at(x,y-1)===WALL && at(x,y+1)===WALL;
}
function inRoom(x,y){
  for(var i=0;i<rooms.length;i++){
    var r=rooms[i];
    if(x>=r.x && x<r.x+r.w && y>=r.y && y<r.y+r.h) return true;
  }
  return false;
}
function spawn(kind,x,y){
  var b=MONSTERS[kind];
  var e={id:nextId++, kind:kind, name:b.name, ch:b.ch, col:b.col, x:x, y:y,
         hp:sHP(b.hp), maxhp:sHP(b.hp), base:b, t:0, state:'asleep', st:{}, foe:true,
         dmg:[sDMG(b.dmg[0]), sDMG(b.dmg[1])]};
  ents.push(e); return e;
}

/* ============ field of view ============ */
var OCT=[[1,0,0,1],[0,1,1,0],[0,-1,1,0],[-1,0,0,1],[-1,0,0,-1],[0,-1,-1,0],[0,1,-1,0],[1,0,0,-1]];
function computeFOV(radius){
  radius = radius || 9;
  vis.fill(0);
  vis[player.y*MW+player.x]=1; seen[player.y*MW+player.x]=1;
  for(var i=0;i<OCT.length;i++) castLight(player.x,player.y,1,1,0,OCT[i][0],OCT[i][1],OCT[i][2],OCT[i][3],radius);
}
function castLight(cx,cy,row,start,end,xx,xy,yx,yy,radius){
  if(start<end) return;
  var newStart=start;
  for(var i=row;i<=radius;i++){
    var blocked=false;
    for(var dx=-i, dy=-i; dx<=0; dx++){
      var lSlope=(dx-0.5)/(dy+0.5), rSlope=(dx+0.5)/(dy-0.5);
      if(start<rSlope) continue; else if(end>lSlope) break;
      var X=cx+dx*xx+dy*xy, Y=cy+dx*yx+dy*yy;
      if(X<0||Y<0||X>=MW||Y>=MH) continue;
      if(dx*dx+dy*dy <= radius*radius){ vis[Y*MW+X]=1; seen[Y*MW+X]=1; }
      if(blocked){
        if(opaque(X,Y)){ newStart=rSlope; continue; }
        blocked=false; start=newStart;
      } else if(opaque(X,Y) && i<radius){
        blocked=true; castLight(cx,cy,i+1,start,lSlope,xx,xy,yx,yy,radius); newStart=rSlope;
      }
    }
    if(blocked) break;
  }
}

/* ============ effects: floating numbers and flying bolts ============ */
var fx=[];
var DMG_COL={phys:'#F2E8DC', fire:'#E2622B', ice:'#62A8D8', lightning:'#E8B44A',
             poison:'#7FA05A', dark:'#8A6FB0', light:'#FFF1CC', magic:'#C9A8FF', heal:'#7FA05A', miss:'#6E635B'};
function elemToType(el){
  return el==='fire'?'fire':el==='water'?'ice':el==='air'?'lightning':
         el==='earth'?'poison':el==='shadow'?'dark':el==='light'?'light':'phys';
}
var fxClock=0;
function fxAt(dur, hold){          /* each effect starts after the one before it */
  var now=performance.now();
  var t=Math.max(now, fxClock);
  fxClock = t + (hold===undefined ? dur*0.55 : hold);
  return t;
}
function floatText(x,y,text,type,big){
  fx.push({k:'t', x:x, y:y, text:text, col:DMG_COL[type]||DMG_COL.phys,
           big:!!big, t0:fxAt(760,120), dur:760, jitter:(rng()-0.5)*0.4});
}
function boltFx(ax,ay,bx,by,type){
  var d=dist({x:ax,y:ay},{x:bx,y:by});
  var dur=130+42*d;
  fx.push({k:'b', ax:ax, ay:ay, bx:bx, by:by, col:DMG_COL[type]||DMG_COL.phys,
           t0:fxAt(dur, dur*0.8), dur:dur});
}
function lungeFx(e, tx, ty){
  var dur=230;
  fx.push({k:'l', e:e, dx:Math.sign(tx-e.x), dy:Math.sign(ty-e.y), t0:fxAt(dur, dur*0.55), dur:dur});
}
function entOffset(e){
  var now=performance.now(), ox=0, oy=0;
  for(var i=0;i<fx.length;i++){
    var f=fx[i];
    if(f.k!=='l' || f.e!==e) continue;
    var p=(now-f.t0)/f.dur;
    if(p<0 || p>=1) continue;
    var amp=Math.sin(p*Math.PI)*TS*0.42;
    ox += f.dx*amp; oy += f.dy*amp;
  }
  return [ox,oy];
}
function drawCorpse(f, p){
  var px=(f.e.x-camX)*TS, py=(f.e.y-camY)*TS;
  var art = spriteOn && f.e.sprite ? MOB_ART[f.e.sprite] : null;
  var fade=1-p, squash=-0.55*p;
  if(drawSprite(art, px, py+TS*0.08*p, fade, f.e.art, {breath:squash, flash: p<0.25 ? (0.25-p)*3 : 0})) return;
  ctx.globalAlpha=fade;
  var hgt=TS*0.72*(1+squash);
  ctx.fillStyle=f.e.col; roundRect(px+TS*0.14, py+TS*0.82-hgt, TS*0.72, hgt, TS*0.16); ctx.fill();
  ctx.globalAlpha=1;
}
function drawFX(){
  var now=performance.now(), keep=[];
  for(var i=0;i<fx.length;i++){
    var f=fx[i], p=(now-f.t0)/f.dur;
    if(p>=1) continue;
    keep.push(f);
    if(f.k==='d'){ drawCorpse(f, Math.max(0,p)); continue; }   /* stays standing until its death plays */
    if(p<0) continue;                 /* queued, not started yet */
    if(f.k==='l') continue;           /* lunges are drawn with their entity */
    if(f.k==='t'){
      var px=(f.x-camX+0.5+f.jitter)*TS, py=(f.y-camY)*TS;
      if(px<-TS||py<-TS||px>viewW*TS+TS||py>viewH*TS+TS) continue;
      var rise=TS*0.9*p;
      ctx.globalAlpha = p<0.75 ? 1 : (1-p)/0.25;
      ctx.font='700 '+Math.round(TS*(f.big?0.62:0.48))+'px "IBM Plex Mono",monospace';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle='rgba(0,0,0,.75)'; ctx.fillText(f.text, px+1, py+TS*0.45-rise+1);
      ctx.fillStyle=f.col; ctx.fillText(f.text, px, py+TS*0.45-rise);
      ctx.globalAlpha=1;
    } else {
      var x=(f.ax+(f.bx-f.ax)*p-camX+0.5)*TS, y=(f.ay+(f.by-f.ay)*p-camY+0.5)*TS;
      ctx.globalAlpha=0.9;
      ctx.fillStyle=f.col;
      ctx.fillRect(x-TS*0.11, y-TS*0.11, TS*0.22, TS*0.22);
      ctx.globalAlpha=0.35;
      var tx=(f.ax+(f.bx-f.ax)*Math.max(0,p-0.12)-camX+0.5)*TS, ty=(f.ay+(f.by-f.ay)*Math.max(0,p-0.12)-camY+0.5)*TS;
      ctx.fillRect(tx-TS*0.07, ty-TS*0.07, TS*0.14, TS*0.14);
      ctx.globalAlpha=1;
    }
  }
  fx=keep;
}
var fxIdleFrames=0, lastFrame=0;
function fxTick(t){
  /* breathing and slides need a steady ~30 fps; with reduced motion only effects animate */
  var live = fx.length>0 || !ANIM.reduce;
  if(live){ if(!t || t-lastFrame>=33){ lastFrame=t||0; draw(); } fxIdleFrames=3; }
  else if(fxIdleFrames>0){ fxIdleFrames--; draw(); }
  requestAnimationFrame(fxTick);
}

/* ============ combat ============ */
function hitChance(acc,eva){ return clamp(acc/(acc+eva), 0.15, 0.95); }
function accOf(e){ return e===player ? player.acc : e.base.acc; }
function evaOf(e){ return e===player ? player.eva : e.base.eva; }
function armorOf(e){ return e===player ? player.armor : e.base.armor; }

function applyDamage(target, amount, type, source){
  var d=amount;
  if(type==='phys'){
    var flat = armorOf(target);
    if(target===player && player.aff.earth) flat += player.aff.earth;   /* stone skin */
    if(target===player && player.st.stone) flat += 3;
    if(source===player && player.weapon.note.indexOf('ignores')>=0) flat -= 2;
    flat = Math.max(0, Math.min(flat, amount*0.5));   /* flat cuts never remove more than half a hit */
    d -= flat;
  }
  d=Math.max(1, Math.round(d));
  target.hp -= d;
  target._hit = Math.max(performance.now(), fxClock);   /* flash when the queued lunge or bolt connects */
  return d;
}
function attack(att, def, mult, label){
  mult = mult || 1;
  var ch=hitChance(accOf(att), evaOf(def));
  if(att===player && player.range>1 && dist(att,def)<=1) ch *= 0.7;   /* bow at melee range */
  if(att.st && att.st.blind) ch *= 0.6;                               /* dazzled: swinging half blind */
  var who = att===player ? 'You' : att.name;
  var foe = def===player ? 'you' : def.name;
  if(def===player && hasP('blur') && player.blurCd<=0){
    player.blurCd=20; log('You blur aside.','c-good'); floatText(def.x,def.y,'miss','miss'); return;
  }
  if(def===player && player.parry && dist(att,def)<=1 && rng()<player.parry){
    log('You parry '+att.name+'.','c-good');
    if(player.stats.agi>=21 && rng()<0.5){ log('Riposte!','c-good'); attack(player, att, 0.5, 'Riposte'); }
    return;
  }
  var blocked = (def===player && player.block && rng()<player.block);
  var ranged = (att.base && att.base.range>1 && dist(att,def)>1) || (att===player && player.range>1 && dist(att,def)>1);
  if(ranged) boltFx(att.x,att.y,def.x,def.y,'phys');
  else lungeFx(att, def.x, def.y);
  if(rng() > ch){
    log(who+' misses '+foe+' <span class="roll">('+Math.round(ch*100)+'% to hit)</span>','c-miss');
    floatText(def.x, def.y, 'miss', 'miss'); return;
  }
  var dr = att===player ? player.dmg : (att.dmg || att.base.dmg);
  var base = roll(dr[0], dr[1]) * mult;
  if(att===player){
    base *= 1 + 0.03*(player.stats.mig-10);
    if(hasP('heavyHands')) base *= 1.10;
    if(hasP('unstoppable')) base *= 1.20;
    if(hasP('crushing') && def.hp <= def.maxhp/2) base *= 1.25;
  }
  if(att===player && player.range>1 && dist(att,def)<=1) base *= 0.6;
  var crit = rng() < (att===player ? player.crit : 0.06); if(crit) base *= 1.6;
  var surprise=false;
  if(att===player && (def.state==='asleep' || def.st.stun || player.hidden>0)){ base *= 1.5; surprise=true; }
  if(blocked) base *= 0.25;
  if(def===player && hasP('fortitude') && player.fortCd<=0){ player.fortCd=15; base *= 0.5;
    log('Fortitude blunts the blow.','c-good'); }
  var phys=applyDamage(def, base, 'phys', att), extra=0, note='', el=null;
  if(att===player){
    /* the weapon's enchantment is what adds elemental damage - affinity only scales it */
    var ench = player.weapon.enchant;
    if(ench){
      el=ench;
      var a=player.aff[ench]||0;
      extra = Math.round(base*0.2*(1+0.3*a));
      if(rng() < 0.10*(1+0.3*a)){
        if(ench==='fire'){ def.st.burn={t:3,d:sDMG(2)}; note=' <span class="c-fire">burning</span>'; }
        else if(ench==='earth'){ def.st.root={t:2}; note=' rooted'; }
        else if(ench==='shadow'){ def.st.fear={t:2}; note=' afraid'; }
        else if(ench==='water'){ def.st.chill={t:3}; note=' chilled'; }
      }
    }
    /* Fire's tier 1 passive is the one flat elemental rider, and only for Fire */
    if(player.aff.fire){ el = el || 'fire'; extra += player.aff.fire; }
    if(extra>0) def.hp -= extra;
  }
  if(att!==player && att.base && att.base.el){
    /* elemental monsters hit with their element, and sometimes leave its mark */
    el = att.base.el;
    extra = Math.max(1, Math.round(base*0.25));
    if(rng() < 0.22){
      if(el==='fire'){ def.st.burn={t:3,d:sDMG(2)}; note=' <span class="c-fire">burning</span>'; }
      else if(el==='water'){ def.st.chill={t:3}; note=' chilled'; }
      else if(el==='earth'){ def.st.root={t:2}; note=' rooted'; }
      else if(el==='shadow'){ def.st.fear={t:2}; note=' shaken'; }
      else if(el==='air'){ def.st.stun={t:1}; note=' stunned'; }
      else if(el==='light'){ def.st.blind={t:2}; note=' dazzled'; }  /* blind: accuracy penalty below */
    }
    def.hp -= extra;
  }
  var elTxt = extra>0 ? ' <span class="c-fire">+'+extra+' '+el+'</span>' : '';
  floatText(def.x, def.y, String(phys+extra), extra>0 ? elemToType(el) : 'phys', crit);
  log((label?label+': ':'')+who+' hit '+foe+' <span class="roll">('+Math.round(ch*100)+'%'
      +(crit?', crit':'')+(surprise?', surprise':'')+(blocked?', blocked':'')+')</span> &mdash; '+phys+' phys'+elTxt
      +' = <b>'+(phys+extra)+'</b>'+note, att===player?'c-hit':'c-you');
  if(def.hp<=0) kill(def, att);
  else if(att===player && hasP('cleaving') && !label){
    var other=ents.filter(function(o){ return o.foe && o!==def && dist(player,o)<=1; })[0];
    if(other){ log('Your swing carries into '+other.name+'.','c-info'); attack(player, other, 0.5, 'Cleave'); }
  }
}
function kill(e, by){
  if(e===player){ death(); return; }
  ents = ents.filter(function(x){ return x!==e; });
  if(vis[e.y*MW+e.x] || revealAll)
    fx.push({k:'d', e:{x:e.x, y:e.y, col:e.col, ch:e.ch, sprite:e.base.sprite, art:e.base.art},
             t0:Math.max(performance.now(), fxClock)+80, dur:450});
  log(e.name+' dies.','c-kill');
  if(by===player || (by && by.ally)){
    gainXP(Math.round((e.base.xp||10) * (1 + floorNo*0.10)));
    if(by===player && player.armorItem.note.indexOf('heal on kill')>=0)
      player.hp=Math.min(player.maxhp, player.hp+Math.max(1,Math.round(player.maxhp*0.02)));
  }
  if(e.base.drop==='mote' && e.base.el){
    items.push({x:e.x, y:e.y, kind:'mote', el:e.base.el});
    log('It collapses into a <b>'+e.base.el+' mote</b>.','c-kill');
  }
  if(rng()<0.35) items.push({x:e.x,y:e.y,kind:'essence',n:ri(3,9)});
}
function gainXP(n){
  player.xp += n;
  while(player.xp >= player.xpNext){
    player.xp -= player.xpNext; player.level++; player.points++;
    player.xpNext = Math.round(player.xpNext*1.35);
    var old=player.maxhp; derive(player);
    player.hp += (player.maxhp-old); player.mp=player.maxmp;
    log('<b>Level '+player.level+'.</b> +1 stat point banked.','c-kill');
  }
}
function applyStatus(e,key,turns,extra){
  if(e===player){
    if(key==='stun' && hasP('unstoppable')){ log('Unstoppable: the stun fails.','c-good'); return; }
    if(hasP('ironConst')) turns=Math.max(1,Math.round(turns/2));
  }
  e.st[key] = extra ? {t:turns,d:extra} : {t:turns};
}
function tickStatus(e){
  var s=e.st;
  if(s.burn){ e.hp -= s.burn.d; e._hit=performance.now(); floatText(e.x, e.y, String(s.burn.d), 'fire');
    if(e===player) log('Burning: '+s.burn.d+' fire damage.','c-you');
    s.burn.t--; if(s.burn.t<=0) delete s.burn;
    if(e.hp<=0){ kill(e,null); return false; } }
  ['root','chill','stun','fear','stone','blind'].forEach(function(k){ if(s[k]){ s[k].t--; if(s[k].t<=0) delete s[k]; } });
  return true;
}
function death(){
  $('overT').textContent='You died';
  $('overP').textContent='Floor '+floorNo+' - '+turn+' turns - level '+player.level;
  $('over').style.display='flex';
}

/* ============ player actions ============ */
function actCost(e){
  var c = Math.round(10000/(e===player?player.speed:e.base.speed));
  return c;
}
function moveCost(){ return Math.round(actCost(player) * (hasP('fleet')?0.85:1)); }
function addBag(icon,name,extra){
  var uid=(extra && extra.uid) || name;
  var hit=player.bag.filter(function(b){ return b.uid===uid; })[0];
  if(hit){ hit.n++; return; }
  var entry={icon:icon,name:name,n:1,uid:uid};
  if(extra){ entry.kind=extra.kind; entry.data=extra.data; }
  player.bag.push(entry);
}
/* drop an item on a doll slot to wear it; slot is 'main', 'off' or 'armor' */
function equipFromBag(idx, slot){
  var it=player.bag[idx];
  if(!it) return;
  if(slot==='main'){
    if(it.kind!=='weapon'){ log('The '+it.name+' is not a weapon.','c-info'); return; }
    useBagItem(idx); return;
  }
  if(slot==='armor'){
    if(it.kind!=='armor'){ log('The '+it.name+' is not armor.','c-info'); return; }
    useBagItem(idx); return;
  }
  if(slot==='off'){
    if(it.kind==='off'){
      if(player.twoHanded){ log('Both hands are on the '+player.weapon.name+'.','c-info'); return; }
      var prev=player.off; player.off=it.data; player.bag.splice(idx,1);
      addBag('\u26E8', prev.name, {kind:'off', data:prev});
      derive(player); log('You take up the <b>'+it.name+'</b>.','c-good'); endTurn(); return;
    }
    if(it.kind!=='weapon'){ log('The '+it.name+' will not go in your off hand.','c-info'); return; }
    if(it.data.hands===2){ log('The '+it.name+' needs both hands.','c-info'); return; }
    if(player.twoHanded){ log('Both hands are on the '+player.weapon.name+'.','c-info'); return; }
    var old=player.off;
    player.off={name:it.data.name, block:0, weapon:true, dmg:it.data.dmg, hands:1, note:'off-hand weapon; parry'};
    player.bag.splice(idx,1);
    addBag('\u26E8', old.name, {kind:'off', data:old});
    derive(player);
    log('You take the <b>'+it.name+'</b> in your off hand.','c-good');
    endTurn(); return;
  }
}
function enforceHands(){
  if(!player.twoHanded || !player.off || player.off===EMPTY_OFF) return;
  if(!(player.off.block || player.off.weapon)) return;
  var prev=player.off;
  player.off=EMPTY_OFF; derive(player);
  addBag('\u26E8', prev.name, {kind:'off', data:prev});
  log('Both hands are on the '+player.weapon.name+' &mdash; the '+prev.name+' goes into your bag.','c-info');
}
function useBagItem(idx){
  var it=player.bag[idx]; if(!it) return;
  if(it.kind==='off'){
    if(player.twoHanded){ log('Both hands are on the '+player.weapon.name+'.','c-info'); return; }
    var prevOff=player.off; player.off=it.data; derive(player);
    player.bag.splice(idx,1); addBag('\u26E8', prevOff.name, {kind:'off', data:prevOff});
    log('You take up the <b>'+it.name+'</b>.','c-good'); endTurn(); return;
  }
  if(it.kind==='weapon'){
    var old=player.sets[player.activeSet];
    player.sets[player.activeSet]=it.data; derive(player);
    player.bag.splice(idx,1); addBag('\u2694', old.name, {kind:'weapon', data:old});
    log('You equip the <b>'+it.name+'</b>.','c-good');
    enforceHands();
    endTurn(); return;
  }
  if(it.kind==='armor'){
    var oldA=player.armorItem; player.armorItem=it.data; derive(player);
    player.bag.splice(idx,1); addBag('\u26E8', oldA.name, {kind:'armor', data:oldA});
    log('You put on the <b>'+it.name+'</b>.','c-good'); endTurn(); return;
  }
  if(it.kind==='ration'){
    var h=Math.max(1,Math.round(player.maxhp*0.15));
    player.hp=Math.min(player.maxhp,player.hp+h); floatText(player.x,player.y,'+'+h,'heal');
    consume(idx); log('You eat a ration. +'+h+' HP.','c-good'); endTurn(); return;
  }
  if(it.kind==='sigil'){
    var known=sigilKnown[it.data.use];
    if(it.data.use==='stoneskin'){ player.st.stone={t:12}; log('Your skin turns to stone.','c-good'); }
    else if(it.data.use==='vanish'){ player.hidden=6;
      ents.forEach(function(e){ if(e.foe && e.state==='hunt' && rng()<0.9) e.state='wander'; });
      log('Shadows swallow you.','c-good'); }
    else if(it.data.use==='heal'){ var q=Math.max(1,Math.round(player.maxhp*0.35));
      player.hp=Math.min(player.maxhp,player.hp+q); floatText(player.x,player.y,'+'+q,'heal');
      log('The Light sigil mends you. +'+q+' HP.','c-good'); }
    else if(it.data.use==='firestorm'){
      ents.forEach(function(e){ if(e.foe && dist(player,e)<=3){ var fd=sDMG(6); e.hp-=fd;
        boltFx(player.x,player.y,e.x,e.y,'fire'); floatText(e.x,e.y,String(fd),'fire'); e.st.burn={t:3,d:sDMG(2)};
        log('Firestorm scorches '+e.name+'.','c-fire'); if(e.hp<=0) kill(e,player); } });
    } else if(it.data.use==='blink'){
      var spots=[];
      for(var y=0;y<MH;y++) for(var x=0;x<MW;x++)
        if(walkable(x,y) && vis[y*MW+x] && dist(player,{x:x,y:y})<=6 && !ents.some(function(e){return e.x===x&&e.y===y;}))
          spots.push({x:x,y:y});
      if(spots.length){ var s=pick(spots); player.x=s.x; player.y=s.y; log('You blink away.','c-good'); }
    }
    if(!known) identifySigil(it.data.use);
    consume(idx); endTurn(); return;
  }
}
function consume(idx){
  var it=player.bag[idx];
  if(it.n>1) it.n--; else player.bag.splice(idx,1);
}
function tryMove(dx,dy){
  var f=faceOf(dx,dy); if(f) player.face=f;
  if(player.st.root){ log('You are rooted in place.','c-info'); endTurn(); return; }
  if(player.st.stun){ log('You are stunned.','c-info'); endTurn(); return; }
  var nx=player.x+dx, ny=player.y+dy;
  var foe=ents.filter(function(e){ return e.foe && e.x===nx && e.y===ny; })[0];
  if(foe){
    attack(player, foe);
    if(player.off.note.indexOf('bonus strike')>=0 && rng()<0.15 && foe.hp>0){
      log('Off-hand dagger follows up.','c-info'); attack(player, foe, 0.6);
    }
    player.hidden=0; endTurn(); return;
  }
  var friend=ents.filter(function(e){ return e.ally && e.x===nx && e.y===ny; })[0];
  if(friend){ friend.x=player.x; friend.y=player.y; player.x=nx; player.y=ny; player.movedThisTurn=true; stepOn(); endTurn(); return; }
  if(at(nx,ny)===DOOR){ setT(nx,ny,OPEN); log('You open the door.','c-info'); computeFOV(); endTurn(); return; }
  if(at(nx,ny)===CHEST){ openChest(nx,ny); endTurn(); return; }
  if(!walkable(nx,ny)) return;
  player.x=nx; player.y=ny; player.movedThisTurn=true; stepOn(); endTurn();
}
function openChest(x,y){
  setT(x,y,FLOOR);
  var r=rng();
  if(r<0.25){ var el=pick(['fire','earth','shadow','water']);
    player.motes[el]=(player.motes[el]||0)+1; log('The chest holds a <b>'+el+' mote</b>.','c-kill'); }
  else if(r<0.70){ var n=ri(12,28); player.essence+=n; log('The chest holds <b>'+n+' essence</b>.','c-kill'); }
  else if(r<0.88){ addBag('\u2726','Unknown sigil'); log('The chest holds an <b>unknown sigil</b>.','c-kill'); }
  else { log('A mimic! The chest bites.','c-you'); var m=spawn('shade',x,y); m.name='Mimic'; m.state='hunt'; }
}
function itemLabel(it){
  if(it.kind==='essence') return it.n+' essence';
  if(it.kind==='mote') return it.el+' mote';
  if(it.kind==='ration') return 'a ration';
  if(it.kind==='sigil') return sigilName(it.it.use);
  return it.it.name;
}
function grab(){
  var got=false;
  for(var i=items.length-1;i>=0;i--){
    var it=items[i];
    if(it.x!==player.x || it.y!==player.y) continue;
    if(it.kind==='essence' || it.kind==='mote'){ continue; }   /* those pick themselves up */
    if(player.bag.length>=12){ log('Your bag is full.','c-info'); return false; }
    items.splice(i,1); got=true;
    if(it.kind==='weapon') addBag('\u2694', it.it.name, {kind:'weapon', data:it.it});
    else if(it.kind==='armor') addBag('\u26E8', it.it.name, {kind:'armor', data:it.it});
    else if(it.kind==='sigil') addBag('\u2726', sigilName(it.it.use),
      {kind:'sigil', data:it.it, uid:'sigil:'+it.it.use});
    else if(it.kind==='ration') addBag('\u{1F356}', 'Ration', {kind:'ration'});
    log('You pick up <b>'+itemLabel(it)+'</b>.','c-good');
  }
  if(!got) log('Nothing here to pick up.','c-info');
  return got;
}
function stepOn(){
  for(var i=items.length-1;i>=0;i--){
    var it=items[i];
    if(it.x===player.x && it.y===player.y){
      if(it.kind==='essence'){ items.splice(i,1); player.essence+=it.n; log('Picked up '+it.n+' essence.','c-good'); }
      else if(it.kind==='mote'){ items.splice(i,1); player.motes[it.el]=(player.motes[it.el]||0)+1;
        log('Picked up a <b>'+it.el+' mote</b>.','c-kill'); }
      else log('You see <b>'+itemLabel(it)+'</b> here. <span class="roll">(g to pick up)</span>','c-info');
    }
  }
  var tr=feats.filter(function(f){ return f.x===player.x && f.y===player.y; })[0];
  if(tr) triggerTrap(tr, player);
  var t=at(player.x,player.y);
  if(t===FORGE) useForge();
  if(t===STAIRS) descend();
}
function triggerTrap(tr,e){
  feats = feats.filter(function(f){ return f!==tr; });
  if(tr.kind==='spike'){ var d=applyDamage(e, ri(4,9), 'phys', null); applyStatus(e,'root',2); floatText(e.x,e.y,String(d),'phys');
    log((e===player?'You step on':'The '+e.name+' steps on')+' a spike trap &mdash; '+d+' damage, rooted.', e===player?'c-you':'c-info'); }
  else if(tr.kind==='fire'){ var f=applyDamage(e, ri(3,6), 'fire', null); applyStatus(e,'burn',3,3); floatText(e.x,e.y,String(f),'fire');
    log('A fire vent erupts &mdash; '+f+' damage, burning.', e===player?'c-you':'c-info'); }
  else { applyStatus(e,'root',3); log('Webs! '+(e===player?'You are':'The '+e.name+' is')+' stuck.','c-info'); }
  if(e.hp<=0) kill(e,null);
}
function affinityCap(){ return Math.min(5, 1 + Math.floor((floorNo+1)/2)); }   /* demo stand-in for the boss-kill cap */
function useForge(){
  var have=Object.keys(player.motes).filter(function(m){ return player.motes[m]>0; });
  if(!have.length){ log('The Forge is cold. Bring it a mote.','c-info'); return; }
  var total=0; for(var e in player.aff) total+=player.aff[e];
  if(total>=affinityCap()){
    var el2=have[0];
    if(player.weapon.enchant===el2){ log('Your '+player.weapon.name+' already burns with '+el2+'.','c-info'); return; }
    player.motes[el2]--; if(player.motes[el2]<=0) delete player.motes[el2];
    player.weapon.enchant=el2; derive(player);
    log('The Forge sets <b>'+el2+'</b> into your '+player.weapon.name+'. <span class="roll">(affinity capped at '+affinityCap()+')</span>','c-kill');
    updateUI(); return;
  }
  /* prefer an element you already carry an affinity for, else start a second one (max two elements) */
  var mine=have.filter(function(m){ return player.aff[m]; });
  var el = mine.length ? mine[0] : (Object.keys(player.aff).length<2 ? have[0] : null);
  if(!el){ log('You already hold two elements; that mote will not take.','c-info'); return; }
  if(!player.aff[el]) log('Your first element. <b>'+el+'</b> becomes your primary.','c-kill');
  player.motes[el]--; if(player.motes[el]<=0) delete player.motes[el];
  player.aff[el]=(player.aff[el]||0)+1;
  var before=player.abilities.slice();
  derive(player);
  log('The Forge burns the mote into you. <b>'+el+' '+player.aff[el]+'</b>.','c-kill');
  player.hotbar=null;
  player.abilities.forEach(function(k){
    if(before.indexOf(k)<0) log('<b>New ability: '+ABILITIES[k].name+'</b> &mdash; '+ABILITIES[k].desc,'c-kill');
  });
  updateUI();
}
function descend(){
  floorNo++; worldSeed=(worldSeed*1664525+1013904223)>>>0;
  log('You descend to floor '+floorNo+'.','c-kill');
  if(hasP('secondWind')){
    var sw=Math.max(1,Math.round(player.maxhp*0.10));
    player.hp=Math.min(player.maxhp, player.hp+sw);
    log('Second Wind: +'+sw+' HP.','c-good');
  }
  generate(worldSeed); resize();
}
function nearestFoe(range){
  var best=null, bd=99;
  ents.forEach(function(e){
    if(!e.foe || !vis[e.y*MW+e.x]) return;
    var d=dist(player,e); if(d<=range && d<bd){ best=e; bd=d; }
  });
  return best;
}
function useAbility(i){
  var key=player.abilities[i]; if(!key) return;
  var A=ABILITIES[key];
  if(player.mp < costOf(A)){ log('Not enough mana for '+A.name+' ('+costOf(A)+').','c-info'); return; }
  if(A.kind==='summon' && ents.some(function(e){ return e.ally; })){
    log('Your skeleton still stands.','c-info'); return;
  }
  if(A.kind==='bolt' || A.kind==='dash' || A.kind==='summon'){
    if(aiming && aiming.i===i){ cancelAim(); return; }   /* press again to cancel */
    aiming={i:i, A:A};
    log('<b>'+A.name+'</b> &mdash; click a target'+(A.range?' within '+spellRange(A)+' tiles':'')+', or press esc.','c-info');
    abilityBar(); draw(); return;
  }
  if(A.kind==='melee2'){
    var m=nearestFoe(1); if(!m){ log('Nothing adjacent to strike.','c-info'); return; }
    player.mp-=costOf(A); attack(player,m,1,A.name); if(m.hp>0) attack(player,m,1,A.name);
  } else if(A.kind==='heal'){
    player.mp-=costOf(A); var h=Math.max(1,Math.round(player.maxhp*A.pct));
    player.hp=Math.min(player.maxhp, player.hp+h); floatText(player.x,player.y,'+'+h,'heal');
    log('Second Wind restores '+h+' HP.','c-good');
  } else if(A.kind==='hide'){
    player.mp-=costOf(A); player.hidden=4;
    ents.forEach(function(e){ if(e.foe && e.state==='hunt' && rng()<0.8) e.state='wander'; });
    log('You melt into the shadows.','c-good');
  }
  endTurn();
}
function cancelAim(){ if(!aiming) return; aiming=null; abilityBar(); draw(); }
function spellRange(A){ return A.range ? A.range + (player.rangeBonus||0) : 0; }
function inRange(x,y){
  if(!aiming) return false;
  if(aiming.A.kind==='dash') return dist(player,{x:x,y:y})<=3;
  return dist(player,{x:x,y:y}) <= spellRange(aiming.A) && (revealAll || vis[y*MW+x]);
}
function castAt(x,y){
  var cf=faceOf(x-player.x, y-player.y); if(cf) player.face=cf;
  if(!aiming) return false;
  var A=aiming.A, i=aiming.i;
  if(!inRange(x,y)){ log('Out of range.','c-info'); return false; }
  if(A.kind==='dash'){
    var dx=Math.sign(x-player.x), dy=Math.sign(y-player.y);
    if(!dx && !dy){ log('Pick a direction to dash.','c-info'); return false; }
    aiming=null; player.mp-=costOf(A); lastDir=[dx,dy];
    var moved=0;
    for(var s=0;s<3;s++){
      var nx=player.x+dx, ny=player.y+dy;
      var blocked=ents.some(function(e){ return e.foe && e.x===nx && e.y===ny; });
      if(!walkable(nx,ny) || blocked) break;
      player.x=nx; player.y=ny; moved++;
    }
    ents.forEach(function(e){ if(e.foe && dist(player,e)<=1) e.st.burn={t:3,d:3}; });
    log('Flame Step: dashed '+moved+' tiles, scorching everything beside you.','c-fire');
    stepOn(); endTurn(); return true;
  }
  if(A.kind==='summon'){
    if(!walkable(x,y) || ents.some(function(o){ return o.x===x && o.y===y; })){
      log('The dead need an empty patch of floor.','c-info'); return false;
    }
    aiming=null; player.mp-=costOf(A);
    var sk=spawn('skeleton', x, y);
    sk.foe=false; sk.ally=true; sk.life=A.life; sk.state='ally';
    sk.name='Risen Skeleton'; sk.col='#BFD8B0';
    log('Mother Murk answers. A <b>skeleton</b> claws its way up out of the floor.','c-good');
    endTurn(); return true;
  }
  var f=ents.filter(function(e){ return e.foe && e.x===x && e.y===y; })[0];
  if(!f){ log('Nothing to hit there.','c-info'); return false; }
  aiming=null; player.mp-=costOf(A);
  /* two pools that multiply: character (Focus, passives) and items (wand, staff, orb) */
  var charPool = 0.04*(player.stats.foc-10) + (hasP('arcaneStudy')?0.10:0) + (hasP('deepFocus')?0.20:0);
  var itemPool = (player.weapon.spell||0) + ((player.off && player.off.spell)||0);
  var pow = (1+charPool) * (1+itemPool);
  var base=Math.round(sDMG(roll(A.base[0],A.base[1]))*pow);
  if(A.perAffinity){                     /* Magic Missile: +1 per affinity point, in any element, after Focus */
    var pts=0; for(var ak in player.aff) pts += player.aff[ak]||0;
    base += A.perAffinity*pts;
  }
  var shotType = A.type==='element' ? elemToType(player.element) : (A.type==='phys'?'phys':A.type);
  boltFx(player.x, player.y, f.x, f.y, shotType);
  if(A.always || rng() < hitChance(player.acc+10, evaOf(f))){
    var type = A.type==='element' ? (player.element||'phys') : A.type;
    var spellCrit = hasP('archmage') && rng()<player.crit;
    if(spellCrit) base=Math.round(base*1.6);
    var d=applyDamage(f, base, type==='phys'?'phys':'elem', player);
    floatText(f.x, f.y, String(d), shotType, spellCrit);
    if(A.status) for(var k in A.status) f.st[k] = (k==='burn') ? {t:A.status[k],d:3} : {t:A.status[k]};
    log(A.name+' hits '+f.name+' &mdash; <b>'+d+'</b> '+type+(A.status?' + '+Object.keys(A.status)[0]:''),'c-hit');
    if(f.hp<=0){
      kill(f,player);
      if(hasP('overflow')){ var back=Math.round(costOf(A)/2);
        player.mp=Math.min(player.maxmp, player.mp+back); log('Overflow returns '+back+' mana.','c-good'); }
    }
  } else { log(A.name+' misses '+f.name+'.','c-miss'); floatText(f.x,f.y,'miss','miss'); }
  endTurn(); return true;
}

function swapWeapon(){
  player.activeSet = 1 - player.activeSet;
  derive(player);
  log('You ready your <b>'+player.weapon.name+'</b>.','c-info');
  enforceHands();
  endTurn();
}
function shootAt(e){
  if(player.range<=1) return false;
  if(dist(player,e) > player.range || !vis[e.y*MW+e.x]) return false;
  attack(player, e, 1, player.weapon.name);
  player.hidden=0; endTurn(); return true;
}

/* ============ allies ============ */
function allyAct(e){
  if(!tickStatus(e)) return;
  e.life--;
  if(e.life<=0){
    ents=ents.filter(function(o){ return o!==e; });
    log('Your skeleton crumbles back into the floor.','c-info');
    return;
  }
  if(e.st.stun){ e.t+=actCost(e); return; }
  var target=null, best=99;
  ents.forEach(function(o){
    if(!o.foe || !vis[o.y*MW+o.x]) return;
    var d=dist(e,o); if(d<best && d<=7){ best=d; target=o; }
  });
  if(target && best<=1){ attack(e, target); }
  else if(target && !e.st.root){ stepEnt(e, Math.sign(target.x-e.x), Math.sign(target.y-e.y)); }
  else if(dist(e,player)>2 && !e.st.root){ stepEnt(e, Math.sign(player.x-e.x), Math.sign(player.y-e.y)); }
  e.t+=actCost(e);
}

/* ============ monsters ============ */
function aiAct(e){
  if(!tickStatus(e)) return;
  if(e.st.stun){ e.t+=actCost(e); return; }
  var canSee = vis[e.y*MW+e.x] && player.hidden<=0;
  if(e.state==='asleep'){
    if(canSee && dist(e,player)<=7 && rng()<0.6){ e.state='hunt'; log(e.name+' notices you.','c-info'); }
    else if(dist(e,player)<=3 && rng()<0.25){ e.state='hunt'; log(e.name+' stirs.','c-info'); }
    e.t+=actCost(e); return;
  }
  if(e.st.fear){ stepEnt(e, Math.sign(e.x-player.x), Math.sign(e.y-player.y)); e.t+=actCost(e); return; }
  if(canSee) e.state='hunt';
  if(e.state==='hunt'){
    var d=dist(e,player);
    if(e.base.range>1 && d<=e.base.range && canSee){ attack(e,player); e.t+=actCost(e); return; }
    if(d<=1){ attack(e,player); e.t+=actCost(e); return; }
    var guard=ents.filter(function(o){ return o.ally && dist(o,e)<=1; })[0];
    if(guard){ attack(e,guard); e.t+=actCost(e); return; }
    if(e.st.root){ e.t+=actCost(e); return; }
    if(e.base.erratic && rng()<0.35){   /* bats and galelings do not close in a straight line */
      stepEnt(e, ri(-1,1), ri(-1,1)); e.t+=actCost(e); return;
    }
    stepEnt(e, Math.sign(player.x-e.x), Math.sign(player.y-e.y));
  } else {
    if(!e.goal || (e.x===e.goal.x && e.y===e.goal.y) || rng()<0.04){
      var tries=0, gx, gy;
      do{ gx=ri(1,MW-2); gy=ri(1,MH-2); tries++; } while(!walkable(gx,gy) && tries<40);
      e.goal={x:gx,y:gy};
    }
    stepEnt(e, Math.sign(e.goal.x-e.x), Math.sign(e.goal.y-e.y));
  }
  e.t+=actCost(e);
}
function stepEnt(e,dx,dy){
  var tries=[[dx,dy],[dx,0],[0,dy]];
  for(var i=0;i<tries.length;i++){
    var mx=tries[i][0], my=tries[i][1];
    if(!mx && !my) continue;
    var nx=e.x+mx, ny=e.y+my;
    if(at(nx,ny)===DOOR){        /* monsters shoulder doors open, which costs them the turn */
      setT(nx,ny,OPEN);
      if(vis[ny*MW+nx]) log('A door swings open.','c-info');
      return;
    }
    if(!walkable(nx,ny)) continue;
    var taken=ents.some(function(o){ return o.x===nx && o.y===ny; });
    if(taken) continue;
    e.x=nx; e.y=ny;
    var tr=feats.filter(function(f){ return f.x===nx && f.y===ny; })[0];
    if(tr) triggerTrap(tr,e);
    return;
  }
}

/* ============ turn loop ============ */
function endTurn(){
  if(player.hidden>0) player.hidden--;
  tickStatus(player);
  player.t += (player.movedThisTurn ? moveCost() : actCost(player));
  player.movedThisTurn=false;
  turn++;
  if(player.blurCd>0) player.blurCd--;
  if(player.fortCd>0) player.fortCd--;
  if(player.hp>0){
    ents.slice().forEach(function(e){
      if(!e.foe && !e.ally) return;
      var guard=0;
      while(e.t < player.t && guard++ < 4 && ents.indexOf(e)>=0) (e.ally ? allyAct : aiAct)(e);
    });
    var mpRate = (0.15 + 0.015*Math.max(0,player.stats.foc-10)) / 100;   /* share of max per turn */
    mpRate *= 1 + (hasP('meditation')?0.25:0) + (hasP('archmage')?0.5:0);  /* character pool: bonuses add */
    var hpRate = (0.04 + 0.005*Math.max(0,player.stats.vit-10)) / 100;
    if(hasP('resilient') && player.hp < player.maxhp/2) hpRate *= 2;
    if(player.element==='light') hpRate *= 1 + 0.10*player.affLevel;
    player.mp = Math.min(player.maxmp, player.mp + player.maxmp*mpRate);
    player.hp = Math.min(player.maxhp, player.hp + player.maxhp*hpRate);
  }
  wanderingSpawn();
  computeFOV(); draw(); updateUI();
}
function wanderingSpawn(){
  if(turn < nextSpawn) return;
  nextSpawn = turn + ri(70,130);
  var alive=ents.filter(function(e){ return e.foe; }).length;
  var cap = 10 + floorNo*3;
  if(spawnedExtra >= 5 + floorNo || alive >= cap) return;   /* a floor only ever gives up so much XP */
  var spots=[], x, y;
  for(y=0;y<MH;y++) for(x=0;x<MW;x++){
    if(!walkable(x,y) || vis[y*MW+x]) continue;
    if(dist(player,{x:x,y:y}) < 12) continue;
    if(ents.some(function(e){ return e.x===x && e.y===y; })) continue;
    spots.push({x:x,y:y});
  }
  if(!spots.length) return;
  var s=pick(spots);
  var kind = (rng()<0.08 && rollRare()) || rollMonster();
  var m=spawn(kind, s.x, s.y);
  m.state='wander'; spawnedExtra++;
  log(m.base.rare ? 'Something bright drifts, far off.' : 'Something moves, far off.',
      m.base.rare ? 'c-kill' : 'c-info');
}

/* ============ sprites ============ =======================================
   The concept art, turned around by PixelLab and cut to 128px. The map still
   draws blocks for everything else, so this is a toggle, not a commitment.  */
var SPRITES={}, spriteOn=true;
/* sprites drawn with one facing (toward the right); mirrored when the character faces left */
var SINGLE_ART={};
/* frame animations generated from a sprite (PixelLab animate-with-text-v3): name -> {frames:[Image], ms per frame} */
var ANIM_ART={};
function loadAnim(key, clip, count, ms){
  var list=[];
  for(var i=0;i<count;i++){ var im=new Image(); im.src='art/sprites/anim/'+key+'-'+clip+'-'+i+'.png'; list.push(im); }
  ANIM_ART[key]=ANIM_ART[key]||{}; ANIM_ART[key][clip]={frames:list, ms:ms};
}
function animFrame(key, clip, phase){
  var a=ANIM_ART[key] && ANIM_ART[key][clip];
  if(!a) return null;
  var n=a.frames.length, i=Math.floor((performance.now()+(phase||0))/a.ms)%n;
  var im=a.frames[i];
  return (im.complete && im.naturalWidth) ? im : null;
}
var OS_REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
var ANIM={ mode:'auto', reduce: OS_REDUCE };
function setMotion(mode){
  ANIM.mode=mode; ANIM.reduce = mode==='off' || (mode==='auto' && OS_REDUCE);
  var b=document.getElementById('bMotion');
  if(b) b.textContent = 'Motion: '+(mode==='auto' ? (OS_REDUCE?'auto (off)':'auto (on)') : mode);
}
var MOB_ART={};
function loadSprites(){
  ['dwarf','gloomling'].forEach(function(who){
    SPRITES[who]={};
    ['south','east','north','west'].forEach(function(d){
      var im=new Image();
      im.onload=function(){ draw(); };
      im.src='art/sprites/'+who+'-'+d+'.png';
      SPRITES[who][d]=im;
    });
  });
  loadAnim('fae-water','idle',8,140);
  ['fae-water'].forEach(function(k){
    var im=new Image(); im.onload=function(){ draw(); }; im.src='art/sprites/'+k+'.png'; SINGLE_ART[k]=im;
  });
  /* monsters need one facing only - they are read, not steered */
  ['goblin','rat','emberling','tideling','galeling','stoneling','wisp','lumenling'].forEach(function(m){
    var im=new Image();
    im.onload=function(){ draw(); };
    im.src='art/sprites/mob-'+m+'.png';
    MOB_ART[m]=im;
  });
}
function playerSprite(){
  var key=BUILDS[player.build] && BUILDS[player.build].sprite;
  if(!key) return null;
  var face=player.face||'south';
  if(SPRITES[key]) return {im:SPRITES[key][face], flip:false};
  var idle = ANIM.reduce ? null : animFrame(key,'idle');
  if(idle) return {im:idle, flip:face==='west', animated:true};
  if(SINGLE_ART[key]) return {im:SINGLE_ART[key], flip:face==='west'};
  return null;
}
function faceOf(dx,dy){
  if(Math.abs(dx)>Math.abs(dy)) return dx<0 ? 'west' : 'east';
  if(dy) return dy<0 ? 'north' : 'south';
  return null;
}
/* draw a sprite standing on a tile: feet on the floor, head over the row above */
function whiteOf(im){                 /* a white silhouette of the sprite, for hit flashes */
  if(im._white) return im._white;
  var c=document.createElement('canvas'); c.width=im.naturalWidth; c.height=im.naturalHeight;
  var g2=c.getContext('2d'); g2.drawImage(im,0,0);
  g2.globalCompositeOperation='source-in'; g2.fillStyle='#fff'; g2.fillRect(0,0,c.width,c.height);
  im._white=c; return c;
}
function drawSprite(im, px, py, alpha, scale, o){
  if(!im || !im.complete || !im.naturalWidth) return false;
  o = o || {};
  /* one tile, one figure: it stands inside its square, feet on the floor line.
     scale lets a rat be smaller than a goblin without redrawing the art */
  var h=TS*1.04*(scale||1), w=h*im.naturalWidth/im.naturalHeight;
  if(w>TS*1.04){ h*=TS*1.04/w; w=TS*1.04; }
  var sy = 1 + (o.breath||0);                     /* idle breathing / death squash, anchored at the feet */
  ctx.save();
  ctx.globalAlpha = alpha===undefined ? 1 : alpha;
  ctx.translate(px+TS/2, py+TS);
  if(o.flip) ctx.scale(-1,1);
  ctx.imageSmoothingEnabled = h < im.naturalHeight;   /* smooth when shrinking, crisp pixels when enlarging */
  ctx.drawImage(im, -w/2, -h*sy, w, h*sy);
  if(o.flash>0){ ctx.globalAlpha = (alpha===undefined?1:alpha)*o.flash; ctx.drawImage(whiteOf(im), -w/2, -h*sy, w, h*sy); }
  ctx.restore();
  ctx.imageSmoothingEnabled=false;
  return true;
}

/* ---- motion: tile-to-tile slides, idle breathing, hit flash and shake ---- */
var MOVE_MS=170;
function renderPos(e){
  var now=performance.now();
  if(e._lx===undefined){ e._lx=e.x; e._ly=e.y; e._fx=e.x; e._fy=e.y; e._mt=0; }
  if(e.x!==e._lx || e.y!==e._ly){
    var cur=slideAt(e, now);
    var jump=Math.max(Math.abs(e.x-cur.x), Math.abs(e.y-cur.y));
    e._fx=cur.x; e._fy=cur.y; e._lx=e.x; e._ly=e.y;
    e._mt = (ANIM.reduce || jump>3) ? 0 : now;       /* teleports and new floors snap */
  }
  return slideAt(e, now);
}
function slideAt(e, now){
  if(!e._mt) return {x:e._lx===undefined?e.x:e._lx, y:e._ly===undefined?e.y:e._ly, hop:0};
  var p=(now-e._mt)/MOVE_MS;
  if(p>=1){ e._mt=0; return {x:e._lx, y:e._ly, hop:0}; }
  var q = p<0.5 ? 2*p*p : 1-Math.pow(-2*p+2,2)/2;
  return {x:e._fx+(e._lx-e._fx)*q, y:e._fy+(e._ly-e._fy)*q, hop:Math.sin(p*Math.PI)};
}
function breathOf(e){
  if(ANIM.reduce) return 0;
  if(e._ph===undefined) e._ph=((e.id||0)*2.399)%6.283;
  var slow = e.state==='asleep' ? 700 : 380;            /* ~2.4 s breath awake, ~4.4 s asleep */
  return 0.06*Math.sin(performance.now()/slow + e._ph);
}
function hitP(e){ if(!e._hit) return -1; var p=(performance.now()-e._hit)/220; return (p<0||p>=1) ? -1 : p; }
function flashOf(e){ var p=hitP(e); return p<0 ? 0 : 0.85*(1-p); }
function shakeOf(e){ var p=hitP(e); return (p<0||ANIM.reduce) ? 0 : Math.sin(p*38)*TS*0.06*(1-p); }

/* ============ rendering ============ */
var ZOOM={close:[15,9], normal:[20,12], wide:[26,15]}, zoomKey='normal';
var cv=$('cv'), ctx=cv.getContext('2d'), camX=0, camY=0, viewW=20, viewH=14;
function resize(){
  var box=$('map').getBoundingClientRect();
  var W=Math.max(140, box.width), H=Math.max(110, box.height);
  /* how many tiles we try to show across and down - fewer tiles, bigger tiles */
  var z=ZOOM[zoomKey]||ZOOM.normal;
  TS = clamp(Math.floor(Math.min(W/z[0], H/z[1])), 14, 72);
  viewW = clamp(Math.floor(W/TS), 8, MW);
  viewH = clamp(Math.floor(H/TS), 6, MH);
  var dpr=window.devicePixelRatio||1;
  cv.width=viewW*TS*dpr; cv.height=viewH*TS*dpr;
  cv.style.width=(viewW*TS)+'px'; cv.style.height=(viewH*TS)+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.imageSmoothingEnabled=false;
  draw();
}
function draw(){
  if(!map) return;
  var B=biome(), x, y;
  var prp=renderPos(player);
  var camFX=clamp(prp.x-(viewW>>1), 0, Math.max(0,MW-viewW));
  var camFY=clamp(prp.y-(viewH>>1), 0, Math.max(0,MH-viewH));
  camX=Math.floor(camFX); camY=Math.floor(camFY);
  camOX=(camFX-camX)*TS; camOY=(camFY-camY)*TS;
  ctx.fillStyle='#0B0A09'; ctx.fillRect(0,0,viewW*TS,viewH*TS);
  ctx.save(); ctx.translate(-camOX, -camOY);
  for(y=0;y<=viewH;y++) for(x=0;x<=viewW;x++){
    var mx=camX+x, my=camY+y, idx=my*MW+mx;
    if(mx>=MW || my>=MH) continue;
    var lit = revealAll || vis[idx], known = revealAll || seen[idx];
    if(!known) continue;
    var t=map[idx], px=x*TS, py=y*TS, hash=((mx*31+my*17)%7)/7;
    ctx.globalAlpha = lit ? 1 : 0.34;
    ctx.fillStyle = (t===WALL) ? (hash>0.5?B.wall2:B.wall) : (hash>0.6?B.floor2:B.floor);
    ctx.fillRect(px,py,TS,TS);
    if(t===WALL){
      ctx.fillStyle='rgba(255,255,255,.10)'; ctx.fillRect(px,py,TS,Math.max(2,TS*0.12));
      ctx.fillStyle='rgba(0,0,0,.32)'; ctx.fillRect(px,py+TS-Math.max(2,TS*0.18),TS,Math.max(2,TS*0.18));
    }
    else { ctx.strokeStyle='rgba(255,255,255,.03)'; ctx.strokeRect(px+0.5,py+0.5,TS-1,TS-1); }
    if(t===DOOR){   /* shut: a solid slab filling the frame */
      ctx.fillStyle='#6B4B2A'; ctx.fillRect(px+TS*0.06,py+TS*0.06,TS*0.88,TS*0.88);
      ctx.fillStyle='#53381F'; ctx.fillRect(px+TS*0.06,py+TS*0.46,TS*0.88,TS*0.08);
      ctx.fillStyle='#E8B44A'; ctx.fillRect(px+TS*0.70,py+TS*0.44,TS*0.13,TS*0.13);
    }
    if(t===OPEN){   /* open: jambs at the sides, floor between them */
      ctx.fillStyle='#6B4B2A'; ctx.fillRect(px,py+TS*0.06,TS*0.2,TS*0.88);
      ctx.fillStyle='#53381F'; ctx.fillRect(px+TS*0.8,py+TS*0.06,TS*0.2,TS*0.88);
    }
    if(t===STAIRS){ ctx.fillStyle='#120F0D'; ctx.fillRect(px+TS*0.12,py+TS*0.12,TS*0.76,TS*0.76); glyph('>',px,py,'#E8B44A'); }
    if(t===CHEST){ ctx.fillStyle='#7A5A2A'; ctx.fillRect(px+TS*0.16,py+TS*0.26,TS*0.68,TS*0.48);
                   ctx.fillStyle='#E8B44A'; ctx.fillRect(px+TS*0.16,py+TS*0.44,TS*0.68,TS*0.09); }
    if(t===FORGE){ ctx.fillStyle='#3A2018'; ctx.fillRect(px+TS*0.1,py+TS*0.1,TS*0.8,TS*0.8);
                   ctx.fillStyle='#E2622B'; ctx.fillRect(px+TS*0.26,py+TS*0.34,TS*0.48,TS*0.46); glyph('\u2692',px,py,'#F2E8DC'); }
    if(t===RUBBLE){ ctx.fillStyle='rgba(0,0,0,.35)';
                    ctx.fillRect(px+TS*0.24,py+TS*0.42,TS*0.22,TS*0.2); ctx.fillRect(px+TS*0.54,py+TS*0.3,TS*0.18,TS*0.2); }
    ctx.globalAlpha=1;
  }
  feats.forEach(function(f){
    if(!(revealAll||f.found) || !(revealAll||vis[f.y*MW+f.x])) return;
    atTile(f.x,f.y,function(px,py){ ctx.strokeStyle='#B8453A'; ctx.lineWidth=1.5; ctx.beginPath();
      ctx.moveTo(px+TS*0.2,py+TS*0.8); ctx.lineTo(px+TS*0.5,py+TS*0.2); ctx.lineTo(px+TS*0.8,py+TS*0.8);
      ctx.closePath(); ctx.stroke(); ctx.lineWidth=1; });
  });
  items.forEach(function(it){
    if(!(revealAll||seen[it.y*MW+it.x])) return;
    atTile(it.x,it.y,function(px,py){
      if(it.kind==='essence'){ ctx.fillStyle='#4A8FBF'; ctx.beginPath(); ctx.arc(px+TS/2,py+TS/2,TS*0.17,0,7); ctx.fill(); }
      else if(it.kind==='weapon'){ glyph('/',px,py,'#C9BFB2'); }
      else if(it.kind==='armor'){ glyph('[',px,py,'#9FB0C0'); }
      else if(it.kind==='sigil'){ glyph('?',px,py,'#E8B44A'); }
      else if(it.kind==='ration'){ glyph('%',px,py,'#C08A4A'); }
      else { ctx.fillStyle=AFF_COL[it.el]||'#888'; ctx.beginPath();
        ctx.moveTo(px+TS/2,py+TS*0.2); ctx.lineTo(px+TS*0.8,py+TS/2);
        ctx.lineTo(px+TS/2,py+TS*0.8); ctx.lineTo(px+TS*0.2,py+TS/2); ctx.closePath(); ctx.fill(); }
    });
  });
  ents.forEach(function(e){
    if(e===player || !(revealAll||vis[e.y*MW+e.x])) return;
    var off=entOffset(e), rp=renderPos(e);
    atTile(rp.x,rp.y,function(px0,py0){
      var px=px0+off[0]+shakeOf(e), py=py0+off[1]-rp.hop*TS*0.16;
      ctx.fillStyle='rgba(0,0,0,.35)'; ctx.beginPath();
      ctx.ellipse(px0+TS/2,py0+TS*0.84,TS*0.28,TS*0.12,0,0,7); ctx.fill();
      var art = spriteOn && e.base.sprite ? MOB_ART[e.base.sprite] : null;
      if(!drawSprite(art, px, py, 1, e.base.art, {breath:breathOf(e), flash:flashOf(e)})){
        var bb=breathOf(e)*TS*0.6;
        ctx.fillStyle=e.col; roundRect(px+TS*0.14,py+TS*0.1-bb,TS*0.72,TS*0.72+bb,TS*0.16); ctx.fill();
        glyph(e.ch,px,py,'#120F0D');
        if(flashOf(e)>0){ ctx.globalAlpha=flashOf(e); ctx.fillStyle='#FFFFFF';
          roundRect(px+TS*0.14,py+TS*0.1-bb,TS*0.72,TS*0.72+bb,TS*0.16); ctx.fill(); ctx.globalAlpha=1; }
      }
      ctx.fillStyle='#120F0D'; ctx.fillRect(px+TS*0.14,py+TS-3,TS*0.72,2);
      ctx.fillStyle = e.hp/e.maxhp>0.5 ? '#7FA05A' : '#C7503F';
      ctx.fillRect(px+TS*0.14,py+TS-3,TS*0.72*clamp(e.hp/e.maxhp,0,1),2);
      if(e.ally){
        ctx.strokeStyle='#7FA05A'; ctx.lineWidth=2; ctx.beginPath();
        ctx.ellipse(px+TS/2,py+TS*0.86,TS*0.34,TS*0.13,0,0,7); ctx.stroke(); ctx.lineWidth=1;
        mark(String(e.life),px+TS*0.74,py+TS*0.24,'#7FA05A');
      }
      if(e.state==='asleep') mark('z',px+TS*0.72,py+TS*0.26,'#F2E8DC');
      if(e.st.burn) mark('*',px+TS*0.1,py+TS*0.3,'#E2622B');
      if(e.st.root) mark('#',px+TS*0.1,py+TS*0.3,'#7FA05A');
      if(e.st.stun) mark('!',px+TS*0.1,py+TS*0.3,'#E8B44A');
      if(e.st.fear) mark('~',px+TS*0.1,py+TS*0.3,'#8A6FB0');
    });
  });
  if(aiming){
    var A=aiming.A, reach = A.kind==='dash' ? 3 : spellRange(A);
    for(var ty=camY;ty<camY+viewH;ty++) for(var tx=camX;tx<camX+viewW;tx++){
      if(dist(player,{x:tx,y:ty})>reach || (tx===player.x&&ty===player.y)) continue;
      if(!(revealAll||vis[ty*MW+tx])) continue;
      atTile(tx,ty,function(px,py){ ctx.fillStyle='rgba(226,98,43,.10)'; ctx.fillRect(px,py,TS,TS); });
    }
    if(hoverX>=0){
      var ok=inRange(hoverX,hoverY);
      var onFoe=ents.some(function(e){ return e.foe && e.x===hoverX && e.y===hoverY; });
      if(A.kind==='summon' && ok && (!walkable(hoverX,hoverY) || ents.some(function(o){ return o.x===hoverX && o.y===hoverY; }))) ok=false;
      var col = !ok ? '#B8453A' : (onFoe || A.kind==='dash' || A.kind==='summon' ? '#E8B44A' : '#8A7F74');
      atTile(hoverX,hoverY,function(px,py){
        ctx.strokeStyle=col; ctx.lineWidth=2;
        ctx.strokeRect(px+1,py+1,TS-2,TS-2);
        ctx.fillStyle = ok ? 'rgba(232,180,74,.16)' : 'rgba(184,69,58,.16)';
        ctx.fillRect(px+1,py+1,TS-2,TS-2);
        var c=TS*0.22;
        ctx.beginPath();
        ctx.moveTo(px+1,py+1+c); ctx.lineTo(px+1,py+1); ctx.lineTo(px+1+c,py+1);
        ctx.moveTo(px+TS-1-c,py+1); ctx.lineTo(px+TS-1,py+1); ctx.lineTo(px+TS-1,py+1+c);
        ctx.moveTo(px+TS-1,py+TS-1-c); ctx.lineTo(px+TS-1,py+TS-1); ctx.lineTo(px+TS-1-c,py+TS-1);
        ctx.moveTo(px+1+c,py+TS-1); ctx.lineTo(px+1,py+TS-1); ctx.lineTo(px+1,py+TS-1-c);
        ctx.stroke(); ctx.lineWidth=1;
      });
    }
  }
  var poff=entOffset(player);
  atTile(prp.x,prp.y,function(px0,py0){
    var px=px0+poff[0]+shakeOf(player), py=py0+poff[1]-prp.hop*TS*0.16;
    ctx.fillStyle='rgba(232,180,74,.13)'; ctx.beginPath(); ctx.arc(px0+TS/2,py0+TS/2,TS*0.54,0,7); ctx.fill();
    var fade = player.hidden>0 ? 0.55 : 1;
    var sp = spriteOn ? playerSprite() : null;
    if(sp && drawSprite(sp.im, px, py, fade, 1, {flip:sp.flip, breath:sp.animated?0:breathOf(player), flash:flashOf(player)})) return;
    ctx.globalAlpha = fade;
    ctx.fillStyle=player.col; roundRect(px+TS*0.14,py+TS*0.1,TS*0.72,TS*0.72,TS*0.16); ctx.fill();
    glyph('@',px,py,'#120F0D');
    if(flashOf(player)>0){ ctx.globalAlpha=flashOf(player); ctx.fillStyle='#FFFFFF';
      roundRect(px+TS*0.14,py+TS*0.1,TS*0.72,TS*0.72,TS*0.16); ctx.fill(); }
    ctx.globalAlpha=1;
  });
  drawFX();
  ctx.restore();
}
var camOX=0, camOY=0;
function atTile(mx,my,fn){
  var px=(mx-camX)*TS, py=(my-camY)*TS;
  if(px<=-TS||py<=-TS||px>viewW*TS+TS||py>viewH*TS+TS) return;
  fn(px,py);
}
function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function glyph(ch,px,py,col){ ctx.fillStyle=col; ctx.font='600 '+Math.round(TS*0.58)+'px "IBM Plex Mono",monospace';
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(ch,px+TS/2,py+TS/2); }
function mark(ch,px,py,col){ ctx.fillStyle=col; ctx.font='600 '+Math.max(8,Math.round(TS*0.36))+'px "IBM Plex Mono",monospace';
  ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillText(ch,px,py); }

/* ---------- placeholder item art: small canvas icons, same chunky style as the map ---------- */
function iconKind(name){
  var n=(name||'').toLowerCase();
  if(n.indexOf('bow')>=0) return 'bow';
  if(n.indexOf('axe')>=0) return 'axe';
  if(n.indexOf('staff')>=0) return 'staff';
  if(n.indexOf('wand')>=0) return 'wand';
  if(n.indexOf('mace')>=0) return 'mace';
  if(n.indexOf('dagger')>=0) return 'dagger';
  if(n.indexOf('sword')>=0) return 'sword';
  if(n.indexOf('shield')>=0) return 'shield';
  if(n.indexOf('orb')>=0) return 'orb';
  if(n.indexOf('sigil')>=0) return 'sigil';
  if(n.indexOf('ration')>=0) return 'ration';
  if(n.indexOf('plate')>=0||n.indexOf('robe')>=0||n.indexOf('leather')>=0||n.indexOf('chain')>=0) return 'armor';
  return 'item';
}
function itemIcon(name, size, tint){
  var c=document.createElement('canvas'), S=size||26, d=window.devicePixelRatio||1;
  c.width=S*d; c.height=S*d; c.style.width=S+'px'; c.style.height=S+'px';
  var x=c.getContext('2d'); x.setTransform(d,0,0,d,0,0); x.imageSmoothingEnabled=false;
  var steel=tint||'#C9BFB2', wood='#7A5A34', gold='#E8B44A', k=iconKind(name), u=S/16;
  function R(px,py,w,h,col){ x.fillStyle=col; x.fillRect(Math.round(px*u),Math.round(py*u),Math.max(1,Math.round(w*u)),Math.max(1,Math.round(h*u))); }
  if(k==='sword'){ R(7,2,2,9,steel); R(5,10,6,1.5,gold); R(7.5,11.5,1,3,wood); }
  else if(k==='dagger'){ R(7,4,2,6,steel); R(5.5,10,5,1.2,gold); R(7.5,11,1,3,wood); }
  else if(k==='mace'){ R(7.5,7,1,7,wood); R(5.5,2.5,5,4,steel); R(4.5,3.5,7,2,steel); }
  else if(k==='axe'){ R(7.5,3,1.2,11,wood); R(8.5,3,4,5,steel); R(3.5,3,4,5,steel); }
  else if(k==='staff'){ R(7.5,3,1.2,11,wood); R(6,1.5,4,3,'#62A8D8'); }
  else if(k==='wand'){ R(7.5,6,1.2,8,wood); R(6.5,3.5,3,3,'#E2622B'); }
  else if(k==='bow'){ x.strokeStyle=wood; x.lineWidth=Math.max(1.5,1.6*u); x.beginPath();
    x.arc(S*0.62,S*0.5,S*0.36,Math.PI*0.62,Math.PI*1.38); x.stroke();
    x.strokeStyle='#E8E0D4'; x.lineWidth=Math.max(1,u); x.beginPath();
    x.moveTo(S*0.36,S*0.13); x.lineTo(S*0.36,S*0.87); x.stroke(); }
  else if(k==='shield'){ R(4,3,8,6,steel); x.fillStyle=steel; x.beginPath();
    x.moveTo(4*u,9*u); x.lineTo(12*u,9*u); x.lineTo(8*u,14*u); x.closePath(); x.fill(); R(7.5,4,1,7,gold); }
  else if(k==='orb'){ x.fillStyle='#62A8D8'; x.beginPath(); x.arc(S/2,S/2,S*0.28,0,7); x.fill();
    x.fillStyle='rgba(255,255,255,.35)'; x.beginPath(); x.arc(S*0.42,S*0.42,S*0.09,0,7); x.fill(); }
  else if(k==='armor'){ R(4.5,3,7,8,'#9FB0C0'); R(3,4,2,4,'#9FB0C0'); R(11,4,2,4,'#9FB0C0'); R(6.5,11,3,2,'#7C8C9E'); }
  else if(k==='sigil'){ x.fillStyle=gold; x.beginPath();
    x.moveTo(S/2,S*0.15); x.lineTo(S*0.68,S*0.5); x.lineTo(S/2,S*0.85); x.lineTo(S*0.32,S*0.5); x.closePath(); x.fill();
    R(7.5,6,1,4,'#2A2015'); }
  else if(k==='ration'){ R(4,6,8,5,'#C08A4A'); R(5,5,6,2,'#8C6232'); }
  else { R(5,5,6,6,steel); }
  return c;
}

/* ---------- hover cards for gear ---------- */
var dtip=null;
function ensureDtip(){
  if(dtip) return dtip;
  dtip=document.createElement('div');
  dtip.id='dtip'; document.body.appendChild(dtip);
  return dtip;
}
function elLabel(e){ return e ? (' <span style="color:'+(AFF_COL[e]||'#fff')+'">'+e+'</span>') : ''; }
function weaponCard(w, worn){
  var plus=w.plus?' +'+w.plus:'';
  var rows='<div class="row"><span>Damage</span><b>'+(sDMG(w.dmg[0])+(w.plus||0))+'&ndash;'+(sDMG(w.dmg[1])+(w.plus||0))+'</b></div>'+
    '<div class="row"><span>Accuracy</span><b>'+(w.acc>=0?'+':'')+w.acc+'</b></div>'+
    '<div class="row"><span>Hands</span><b>'+(w.hands||1)+'</b></div>'+
    (w.range?'<div class="row"><span>Range</span><b>'+w.range+'</b></div>':'')+
    (w.enchant?'<div class="row"><span>Enchant</span><b>'+w.enchant+' &times;'+(1+0.3*(player.aff[w.enchant]||0)).toFixed(1)+'</b></div>':'')+
    '<div class="hint">'+w.note+'</div>';
  if(worn) rows+='<div class="hint" style="color:var(--moss)">Equipped</div>';
  return '<div class="nm">'+w.name+plus+elLabel(w.enchant)+'</div>'+rows;
}
function armorCard(a, worn){
  return '<div class="nm">'+a.name+elLabel(a.enchant)+'</div>'+
    '<div class="row"><span>Armor</span><b>'+a.armor+'</b></div>'+
    '<div class="row"><span>Evasion</span><b>'+(a.eva>=0?'+':'')+a.eva+'</b></div>'+
    '<div class="hint">'+a.note+'</div>'+(worn?'<div class="hint" style="color:var(--moss)">Worn</div>':'');
}
function bagCard(it){
  if(it.kind==='weapon') return weaponCard(it.data);
  if(it.kind==='armor') return armorCard(it.data);
  if(it.kind==='ration') return '<div class="nm">Ration</div><div class="hint">Eat it: heals 15% of max HP.</div>';
  if(it.kind==='sigil'){
    var known=sigilKnown[it.data.use];
    return '<div class="nm">'+it.name+'</div><div class="hint">'+
      (known ? 'Known: '+it.data.use : 'Unidentified. Use it to find out what it does.')+'</div>';
  }
  return '<div class="nm">'+it.name+'</div>';
}
function showCard(html, ev){
  var t=ensureDtip();
  t.innerHTML=html; t.style.display='block';
  var x=Math.min(ev.clientX+14, window.innerWidth-t.offsetWidth-10);
  var y=Math.min(ev.clientY+14, window.innerHeight-t.offsetHeight-10);
  t.style.left=Math.max(6,x)+'px'; t.style.top=Math.max(6,y)+'px';
}
function hideCard(){ if(dtip) dtip.style.display='none'; }
function hoverCard(el, htmlFn){
  el.addEventListener('mousemove', function(ev){ showCard(htmlFn(), ev); });
  el.addEventListener('mouseleave', hideCard);
}

/* ============ interface ============ */
var SHEETS={Char:'Character', Equip:'Equipment', Sand:'Sandbox', Help:'Keys'};
var openSheet=null;
function log(html, cls){
  var d=document.createElement('div'); d.className=cls||'c-info'; d.innerHTML=html;
  var L=$('log'); L.appendChild(d);
  while(L.children.length>90) L.removeChild(L.firstChild);
  L.scrollTop=L.scrollHeight;
}
/* redraw the open sheet in place - showSheet() toggles, so calling it to refresh closed the menu */
function refreshSheet(){
  if(!openSheet) return;
  panes();
  var pl=document.querySelectorAll('.plus');
  for(var i=0;i<pl.length;i++)
    pl[i].onclick=(function(b){ return function(ev){ ev.stopPropagation(); spendPoint(b.getAttribute('data-s')); }; })(pl[i]);
}
function showSheet(name){
  openSheet = (openSheet===name) ? null : name;
  var buttons=document.querySelectorAll('#tabs button');
  for(var i=0;i<buttons.length;i++)
    buttons[i].classList.toggle('on', buttons[i].getAttribute('data-p')===openSheet);
  $('shade').classList.toggle('on', !!openSheet);
  if(openSheet){
    $('sheetTitle').textContent=SHEETS[openSheet];
    ['Char','Equip','Sand','Help'].forEach(function(n){ $('m'+n).classList.toggle('on', n===openSheet); });
    panes();
    var pl=document.querySelectorAll('.plus');
    for(var i=0;i<pl.length;i++)
      pl[i].onclick=(function(b){ return function(ev){ ev.stopPropagation(); spendPoint(b.getAttribute('data-s')); }; })(pl[i]);
  }
}
function bars(){
  $('hFloor').textContent=floorNo; $('hBiome').textContent=biome().name; $('hTurn').textContent=turn;
  $('hpFill').style.width=(clamp(player.hp/player.maxhp,0,1)*100)+'%';
  $('hpTxt').textContent=Math.max(0,Math.round(player.hp))+'/'+player.maxhp;
  $('mpFill').style.width=(clamp(player.mp/player.maxmp,0,1)*100)+'%';
  $('mpTxt').textContent=Math.floor(player.mp)+'/'+player.maxmp;
  $('xpFill').style.width=(clamp(player.xp/player.xpNext,0,1)*100)+'%';
  $('xpTxt').textContent=player.xp+'/'+player.xpNext;
  $('lvTxt').textContent='LV '+player.level;
  var tags=[];
  for(var k in player.st) tags.push('<span class="tag t-'+k+'">'+k+' '+player.st[k].t+'</span>');
  if(player.hidden>0) tags.push('<span class="tag t-hidden">hidden '+player.hidden+'</span>');
  if(hasP('blur') && player.blurCd>0) tags.push('<span class="tag t-hidden">blur '+player.blurCd+'</span>');
  if(hasP('fortitude') && player.fortCd>0) tags.push('<span class="tag t-hidden">fort '+player.fortCd+'</span>');
  $('fx').innerHTML=tags.join('');
}
/* ---- drag and drop ------------------------------------------------------
   Anything draggable writes a short tag into the payload:
     bag:N     an inventory cell        abil:KEY  an ability off the sheet
     hot:N     a hotbar slot            weapons   the weapon pair          */
function dragSource(el, tag){
  el.setAttribute('draggable','true');
  el.ondragstart=function(ev){ ev.dataTransfer.setData('text/plain', tag); ev.dataTransfer.effectAllowed='move'; };
}
function dropTarget(el, take){
  el.ondragover=function(ev){ ev.preventDefault(); ev.dataTransfer.dropEffect='move'; el.classList.add('over'); };
  el.ondragleave=function(){ el.classList.remove('over'); };
  el.ondrop=function(ev){
    ev.preventDefault(); ev.stopPropagation(); el.classList.remove('over');
    take(ev.dataTransfer.getData('text/plain')||'');
  };
}
function bagIndexFromTag(tag){
  return tag.indexOf('bag:')===0 ? +tag.slice(4) : -1;
}

/* the hotbar is its own list now: abilities land in it automatically, but you
   can drop a bag item or the weapon pair on any slot and rearrange it freely */
function syncHotbar(){
  var i, s;
  if(!player.hotbar) player.hotbar=[null,null,null,null,null,null,null,null];
  for(i=0;i<8;i++){
    s=player.hotbar[i];
    if(!s) continue;
    if(s.type==='ability' && player.abilities.indexOf(s.key)<0) player.hotbar[i]=null;
    if(s.type==='item' && player.bag.indexOf(s.ref)<0) player.hotbar[i]=null;
  }
  player.abilities.forEach(function(k){
    for(var j=0;j<8;j++){ var h=player.hotbar[j]; if(h && h.type==='ability' && h.key===k) return; }
    for(var j2=0;j2<8;j2++) if(!player.hotbar[j2]){ player.hotbar[j2]={type:'ability',key:k}; return; }
  });
}
function hotbarPut(i, entry){
  for(var j=0;j<8;j++) if(j!==i && player.hotbar[j] && entry &&
      player.hotbar[j].type===entry.type &&
      player.hotbar[j].key===entry.key && player.hotbar[j].ref===entry.ref) player.hotbar[j]=null;
  player.hotbar[i]=entry;
  abilityBar();
}
function pressSlotIndex(i){
  var s=player.hotbar && player.hotbar[i];
  if(!s) return;
  if(s.type==='ability'){
    var ai=player.abilities.indexOf(s.key);
    if(ai>=0) useAbility(ai);
    return;
  }
  if(s.type==='swap'){ swapWeapon(); return; }
  if(s.type==='item'){
    var bi=player.bag.indexOf(s.ref);
    if(bi<0){ player.hotbar[i]=null; abilityBar(); return; }
    useBagItem(bi); updateUI();
  }
}
function abilityBar(){
  syncHotbar();
  var html='', i, s;
  for(i=0;i<8;i++){
    s=player.hotbar[i];
    if(!s){ html+='<div class="slot empty" data-i="'+i+'"><span class="k">'+(i+1)+'</span><span class="n">empty</span></div>'; continue; }
    if(s.type==='ability'){
      var A=ABILITIES[s.key], off = player.mp<costOf(A) ? ' disabled' : '';
      var armed = (aiming && player.abilities[aiming.i]===s.key) ? ' armed' : '';
      html+='<button class="slot'+armed+'" data-i="'+i+'"'+off+' title="'+A.desc+'">'+
            '<span class="k">'+(i+1)+'</span><span class="n">'+A.name+'</span>'+
            '<span class="c">'+costOf(A)+' mana</span></button>';
    } else if(s.type==='swap'){
      var stow=player.sets[1-player.activeSet];
      html+='<button class="slot" data-i="'+i+'" title="Draw the stowed weapon (costs a turn)">'+
            '<span class="k">'+(i+1)+'</span><span class="n">&#8646; '+stow.name+'</span>'+
            '<span class="c">weapon swap</span></button>';
    } else {
      var it=s.ref, n=it.n>1 ? ' &times;'+it.n : '';
      html+='<button class="slot" data-i="'+i+'" data-icon="'+it.name+'" title="'+it.name+'">'+
            '<span class="k">'+(i+1)+'</span><span class="row"><span class="ic"></span>'+
            '<span class="n">'+it.name+n+'</span></span></button>';
    }
  }
  $('hotbar').innerHTML=html;
  var btns=$('hotbar').querySelectorAll('.slot[data-i]');
  for(i=0;i<btns.length;i++){
    (function(b){
      var idx=+b.getAttribute('data-i');
      var ic=b.getAttribute('data-icon');
      if(ic){ var holder=b.querySelector('.ic'); if(holder) holder.appendChild(itemIcon(ic, 18)); }
      b.onclick=function(){ pressSlotIndex(idx); };
      b.oncontextmenu=function(ev){ ev.preventDefault(); if(player.hotbar[idx]){ player.hotbar[idx]=null; abilityBar(); } };
      if(player.hotbar[idx]) dragSource(b, 'hot:'+idx);
      dropTarget(b, function(tag){
        var bi=bagIndexFromTag(tag);
        if(bi>=0 && player.bag[bi]) hotbarPut(idx, {type:'item', ref:player.bag[bi]});
        else if(tag==='weapons') hotbarPut(idx, {type:'swap'});
        else if(tag.indexOf('abil:')===0) hotbarPut(idx, {type:'ability', key:tag.slice(5)});
        else if(tag.indexOf('hot:')===0){
          var from=+tag.slice(4);
          if(from!==idx){ var t=player.hotbar[idx]; player.hotbar[idx]=player.hotbar[from]; player.hotbar[from]=t; abilityBar(); }
        }
      });
    })(btns[i]);
  }
}
function kv(pairs){ return '<div class="kv">'+pairs.map(function(p){ return '<span>'+p[0]+'</span><b>'+p[1]+'</b>'; }).join('')+'</div>'; }
function statBox(n,v,key){
  var plus = (player.points>0 && key) ? ' <button class="plus" data-s="'+key+'">+</button>' : '';
  return '<div class="stat"><span>'+n+'</span><b>'+v+plus+'</b></div>';
}
function spendPoint(key){
  if(player.points<=0) return;
  BUILDS[player.build].stats[key]++; player.points--;
  var fresh=recomputePassives();
  derive(player);
  log('You train '+key.toUpperCase()+'.','c-good');
  fresh.forEach(function(id){
    for(var k in PASSIVES) PASSIVES[k].forEach(function(p){
      if(p.id===id) log('<b>New passive: '+p.name+'</b> &mdash; '+p.d,'c-kill');
    });
  });
  updateUI(); refreshSheet();
}
function eslot(label,name,sub,el,key){
  return '<div class="eslot'+(el?' el-'+el:'')+'"'+(key?' data-eq="'+key+'"':'')+'><span class="l">'+label+'</span>'+
    (name?'<span class="v">'+name+'</span>':'<span class="v none">empty</span>')+
    (sub?'<span class="l" style="text-transform:none;letter-spacing:.02em;color:var(--ash)">'+sub+'</span>':'')+'</div>';
}
function passiveList(){
  var names={mig:'Might',agi:'Agility',vit:'Vitality',foc:'Focus'}, out='';
  for(var k in PASSIVES){
    var next=null;
    PASSIVES[k].forEach(function(p){
      if(player.stats[k] >= p.at)
        out += '<div class="abrow"><span class="k">'+p.at+'</span><span><span style="color:var(--ink)">'+p.name+
               '</span><div class="d">'+p.d+'</div></span><span style="color:var(--moss)">on</span></div>';
      else if(!next) next=p;
    });
    if(next) out += '<div class="abrow" style="opacity:.5"><span class="k">'+next.at+'</span><span>'+
      '<span style="color:var(--ash)">'+next.name+'</span><div class="d">needs '+names[k]+' '+next.at+'</div></span>'+
      '<span style="color:var(--dim)">'+(next.at-player.stats[k])+' to go</span></div>';
  }
  return out;
}
function panes(){
  if(openSheet!=='Char' && openSheet!=='Equip') return;
  var a=player.affLevel, el=player.element;
  var t1 = el==='earth' ? '&minus;'+a+' physical per hit'
         : el==='fire'  ? '+'+a+' fire per hit'
         : el==='shadow'? '+'+(a*10)+'% surprise damage' : '&mdash;';
  if(openSheet==='Char'){
    var pips=Object.keys(player.aff).map(function(e){
      var n=player.aff[e], dots='';
      for(var i=0;i<5;i++) dots+='<span class="pip" style="'+(i<n?'background:'+AFF_COL[e]+';border-color:'+AFF_COL[e]:'')+'"></span>';
      return '<div class="aff"><span class="nm">'+e.charAt(0).toUpperCase()+e.slice(1)+'</span><span class="pips">'+dots+
             '</span><span style="color:var(--dim)">'+n+'/5</span></div>';
    }).join('');
    $('mChar').innerHTML='<div class="cols">'+
      '<div><h2 class="head">'+player.name+'</h2><div class="who">'+player.who+' &middot; Level '+player.level+
        (player.points?' &middot; <span style="color:var(--gold)">'+player.points+' unspent</span>':'')+'</div>'+
        '<p class="sub">Attributes</p><div class="grid4">'+
        statBox('Might',player.stats.mig,'mig')+statBox('Agility',player.stats.agi,'agi')+
        statBox('Vitality',player.stats.vit,'vit')+statBox('Focus',player.stats.foc,'foc')+'</div>'+
        '<p class="sub" style="margin-top:10px">Affinity</p>'+pips+'</div>'+
      '<div><p class="sub">Derived</p>'+kv([['Accuracy',player.acc],['Evasion',player.eva],['Armor',player.armor],
        ['Block',Math.round(player.block*100)+'%'],['Weapon damage',player.dmg[0]+'&ndash;'+player.dmg[1]],
        ['Speed',player.speed],['Weapon enchant',player.weapon.enchant||'none'],
      [(el?el.charAt(0).toUpperCase()+el.slice(1)+' T1':'Affinity'),t1],
        ['Enchant scale','&times;'+(1+0.3*a).toFixed(1)],['XP',player.xp+' / '+player.xpNext]])+'</div>'+
      '<div><p class="sub">Passives</p>'+passiveList()+'</div>'+
    '<div><p class="sub">Abilities</p>'+player.abilities.map(function(k,i){
          var A=ABILITIES[k];
          return '<div class="abrow" data-ab="'+k+'" draggable="true"><span class="k">'+(i+1)+'</span><span><span style="color:var(--ink)">'+A.name+
                 '</span><div class="d">'+A.desc+'</div></span><span style="color:var(--ice)">'+costOf(A)+'</span></div>';
        }).join('')+'</div></div>';
  }
  if(openSheet==='Char'){
    var abEls=$('mChar').querySelectorAll('.abrow[data-ab]');
    for(var ai2=0; ai2<abEls.length; ai2++)
      dragSource(abEls[ai2], 'abil:'+abEls[ai2].getAttribute('data-ab'));
  }
  if(openSheet==='Equip'){
    var w=player.weapon, ar=player.armorItem, of=player.off;
    var stow=player.sets[1-player.activeSet];
    var doll='<div class="doll">'+
      eslot('Main hand', w.name, w.dmg[0]+'&ndash;'+w.dmg[1]+' dmg'+(player.twoHanded?' &middot; two-handed':''), el, 'main')+
      '<div class="body">@</div>'+
      eslot('Off hand', player.twoHanded ? 'Empty' : of.name,
            player.twoHanded ? 'both hands on the '+w.name : of.note, el, 'off')+
      eslot('Armor', ar.name, ar.armor+' armor', el, 'armor')+
      eslot('Amulet', null)+
      eslot('Ring I', null)+
      eslot('Ring II', null)+'</div>'+
      '<p class="sub" style="margin-top:10px">Stowed set <span style="color:var(--dim)">(click to draw it)</span></p>'+
      '<div id="stowSlot">'+eslot('Swap to', stow.name, stow.dmg[0]+'&ndash;'+stow.dmg[1]+' dmg'+(stow.range?' &middot; range '+stow.range:''), null)+'</div>'+
      (player.parry?'<p class="sub" style="margin-top:10px">Parry</p>'+kv([['Chance',Math.round(player.parry*100)+'%']]):'');
    var cells=player.bag.map(function(it,idx){
      var act = it.kind==='weapon'?'equip':it.kind==='armor'?'wear':'use';
      return '<div class="cell" data-b="'+idx+'" draggable="true" title="'+it.name+
             ' - click to '+act+', drag to the hotbar">'+(it.n>1?'<b>'+it.n+'</b>':'')+'</div>'; });
    while(cells.length<12) cells.push('<div class="cell empty"></div>');
    var motes=Object.keys(player.motes).map(function(m){
      return '<span class="mote"><i style="background:'+(AFF_COL[m]||'#888')+'"></i>'+m+' &times;'+player.motes[m]+'</span>'; }).join('');
    $('mEquip').innerHTML='<div class="equip"><div><p class="sub">Worn</p>'+doll+'</div><div>'+
      '<p class="sub">Bag</p><div class="invgrid">'+cells.join('')+'</div>'+
      '<p class="sub" style="margin-top:10px">Mote pouch &middot; '+player.essence+' essence</p>'+
      '<div class="pouch">'+(motes||'<span class="mote">no motes yet</span>')+'</div></div></div>';
    var cellEls=$('mEquip').querySelectorAll('.cell[data-b]');
    for(var ci=0;ci<cellEls.length;ci++){
      (function(el){
        var bi=+el.getAttribute('data-b'), it=player.bag[bi];
        el.style.cursor='pointer';
        el.appendChild(itemIcon(it.name, 26));
        el.onclick=function(){ hideCard(); useBagItem(bi); refreshSheet(); };
        hoverCard(el, function(){ return bagCard(player.bag[bi]); });
        dragSource(el, 'bag:'+bi);
      })(cellEls[ci]);
    }
    var slotEls=$('mEquip').querySelectorAll('.eslot');
    if(slotEls[0]) hoverCard(slotEls[0], function(){ return weaponCard(player.weapon, true); });
    if(slotEls[1]) hoverCard(slotEls[1], function(){ return '<div class="nm">'+player.off.name+'</div>'+
      (player.block?'<div class="row"><span>Block</span><b>'+Math.round(player.block*100)+'%</b></div>':'')+
      (player.parry?'<div class="row"><span>Parry</span><b>'+Math.round(player.parry*100)+'%</b></div>':'')+
      '<div class="hint">'+player.off.note+'</div>'; });
    if(slotEls[2]) hoverCard(slotEls[2], function(){ return armorCard(player.armorItem, true); });
    var stowEl=$('stowSlot');
    if(stowEl) hoverCard(stowEl, function(){ return weaponCard(player.sets[1-player.activeSet]); });
    if(stowEl){ stowEl.style.cursor='pointer'; stowEl.title='Draw this weapon (costs a turn)';
      stowEl.onclick=function(){ hideCard(); swapWeapon(); refreshSheet(); }; }
    var wslot=$('mEquip').querySelector('.eslot');
    if(wslot){ wslot.style.cursor='grab'; dragSource(wslot, 'weapons');
      wslot.title='Drag an item here to equip it, or drag this to the hotbar for a swap slot'; }
    /* the paper doll takes drops: bag item -> worn */
    var eqEls=$('mEquip').querySelectorAll('.eslot[data-eq]');
    for(var qi=0;qi<eqEls.length;qi++){
      (function(el){
        var key=el.getAttribute('data-eq');
        dropTarget(el, function(tag){
          var bi=bagIndexFromTag(tag);
          if(bi<0) return;
          hideCard(); equipFromBag(bi, key); updateUI(); refreshSheet();
        });
      })(eqEls[qi]);
    }
    /* and the bag takes drops back off the hotbar is not needed - the hotbar only
       points at bag items - but abilities can be dragged out of the sheet below */
  }
}
function updateUI(){
  abilityBar(); bars(); panes();
  var pl=document.querySelectorAll('.plus');
  for(var i=0;i<pl.length;i++)
    pl[i].onclick=(function(b){ return function(ev){ ev.stopPropagation(); spendPoint(b.getAttribute('data-s')); }; })(pl[i]);
}

/* tooltip */
var tip=$('tip');
cv.addEventListener('mouseleave', function(){ tip.style.display='none'; hoverX=-1; hoverY=-1; if(aiming) draw(); });
cv.addEventListener('mousemove', function(ev){
  var r=cv.getBoundingClientRect();
  if(!seen || !vis || !map || !player){ tip.style.display='none'; return; }   /* the map can be mid-rebuild */
  var mx=camX+Math.floor((ev.clientX-r.left+camOX)/TS), my=camY+Math.floor((ev.clientY-r.top+camOY)/TS);
  if(mx!==hoverX || my!==hoverY){ hoverX=mx; hoverY=my; if(aiming) draw(); }
  var html=''; try{ html=inspectHTML(mx,my); }catch(err){ html=''; }
  if(!html){ tip.style.display='none'; return; }
  tip.innerHTML=html; tip.style.display='block';
  var box=$('map').getBoundingClientRect();
  var x=Math.min(ev.clientX-box.left+14, box.width-tip.offsetWidth-8);
  var y=Math.min(ev.clientY-box.top+14, box.height-tip.offsetHeight-8);
  tip.style.left=Math.max(6,x)+'px'; tip.style.top=Math.max(6,y)+'px';
});
function inspectHTML(mx,my){
  if(mx<0||my<0||mx>=MW||my>=MH) return '';
  if(!(revealAll||seen[my*MW+mx])) return '';
  var e=ents.filter(function(o){ return o.foe && o.x===mx && o.y===my; })[0];
  if(e && (revealAll||vis[my*MW+mx])){
    var ch=Math.round(hitChance(player.acc,e.base.eva)*100);
    var back=Math.round(hitChance(e.base.acc,player.eva)*100);
    var lo=Math.max(1,Math.round(player.dmg[0]-Math.min(e.base.armor,player.dmg[0]*0.5))),
        hi=Math.max(1,Math.round(player.dmg[1]-Math.min(e.base.armor,player.dmg[1]*0.5)));
    var st=Object.keys(e.st).map(function(k){ return '<span class="tag t-'+k+'">'+k+'</span>'; }).join(' ');
    return '<div class="nm">'+e.name+'</div>'+
      '<div class="row"><span>HP</span><b>'+Math.max(0,e.hp)+' / '+e.maxhp+'</b></div>'+
      '<div class="row"><span>Armor &middot; Evasion</span><b>'+e.base.armor+' &middot; '+e.base.eva+'</b></div>'+
      '<div class="row"><span>Speed</span><b>'+e.base.speed+'</b></div>'+
      '<div class="row"><span>State</span><b>'+(e.st.stun?'knocked out':e.state)+'</b></div>'+
      (st?'<div style="margin-top:4px">'+st+'</div>':'')+
      '<div class="odds">You hit <em>'+ch+'%</em> for '+lo+'&ndash;'+hi+'. It hits you <em>'+back+'%</em>.</div>';
  }
  var names={0:'Wall',1:'Floor',2:'Closed door',3:'Stairs down',4:'Chest',5:'Elemental Forge',6:'Rubble',7:'Open door'};
  var it=items.filter(function(i){ return i.x===mx && i.y===my; })[0];
  var tr=feats.filter(function(f){ return f.x===mx && f.y===my && (f.found||revealAll); })[0];
  if(it && it.kind==='weapon') return weaponCard(it.it);
  if(it && it.kind==='armor') return armorCard(it.it);
  if(it && it.kind==='sigil') return '<div class="nm">'+sigilName(it.it.use)+'</div><div class="row"><span>Unidentified</span><b>?</b></div>';
  var label = tr ? 'Trap: '+tr.kind : it ? (it.kind==='mote'? it.el+' mote' : it.kind==='ration' ? 'Ration' : it.n+' essence') : (names[at(mx,my)]||'Floor');
  return '<div class="nm">'+label+'</div><div class="row"><span>'+(vis[my*MW+mx]?'In sight':'From memory')+
         '</span><b>'+mx+','+my+'</b></div>';
}

/* ============ input ============ */
var KEYS={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],
  w:[0,-1],s:[0,1],a:[-1,0],d:[1,0],q:[-1,-1],e:[1,-1],z:[-1,1],c:[1,1]};
window.addEventListener('keydown', function(ev){
  var tgt=ev.target.tagName;
  if(tgt==='INPUT'||tgt==='SELECT') return;
  var k=ev.key;
  if(k==='Escape'){ if(aiming) cancelAim(); else if(openSheet) showSheet(openSheet); return; }
  if(player.hp<=0 || openSheet) return;
  if(KEYS[k]){ ev.preventDefault();
    if(aiming){ cancelAim(); return; }
    lastDir=KEYS[k]; tryMove(KEYS[k][0],KEYS[k][1]); return; }
  if(k==='.'||k===' '){ ev.preventDefault(); log('You wait.','c-info'); endTurn(); return; }
  if(k==='>'){ if(at(player.x,player.y)===STAIRS) descend(); else log('No stairs here.','c-info'); return; }
  if(k==='g'){ if(grab()) endTurn(); return; }
  if(k==='x'){ swapWeapon(); return; }
  if('12345678'.indexOf(k)>=0) pressSlotIndex(+k-1);
});
var DIRS={1:[-1,1],2:[0,1],3:[1,1],4:[-1,0],6:[1,0],7:[-1,-1],8:[0,-1],9:[1,-1]};
$('dpad').addEventListener('click', function(ev){
  var b=ev.target.closest('button'); if(!b) return;
  var d=b.getAttribute('data-d');
  if(d==='5'){ endTurn(); return; }
  lastDir=DIRS[d]; tryMove(lastDir[0],lastDir[1]);
});
cv.addEventListener('click', function(ev){
  var r=cv.getBoundingClientRect();
  var mx=camX+Math.floor((ev.clientX-r.left+camOX)/TS), my=camY+Math.floor((ev.clientY-r.top+camOY)/TS);
  if(aiming){ castAt(mx,my); return; }
  var foe=ents.filter(function(e){ return e.foe && e.x===mx && e.y===my; })[0];
  if(foe && player.range>1 && dist(player,foe)<=player.range && vis[my*MW+mx]){ shootAt(foe); return; }
  var dx=Math.sign(mx-player.x), dy=Math.sign(my-player.y);
  if(dx||dy){ lastDir=[dx,dy]; tryMove(dx,dy); }
});
cv.addEventListener('contextmenu', function(ev){ if(aiming){ ev.preventDefault(); cancelAim(); } });
$('tabs').addEventListener('click', function(ev){
  var b=ev.target.closest('button[data-p]'); if(!b) return;
  showSheet(b.getAttribute('data-p'));
});
$('close').onclick=function(){ showSheet(openSheet); };
$('shade').addEventListener('click', function(ev){ if(ev.target===$('shade')) showSheet(openSheet); });
$('bStairs').onclick=function(){ if(at(player.x,player.y)===STAIRS) descend(); else log('No stairs here.','c-info'); };
$('bGrab').onclick=function(){ if(grab()) endTurn(); };
$('bSwap').onclick=function(){ swapWeapon(); };
$('bNew').onclick=function(){ var s=parseInt($('seed').value,10); newRun(isNaN(s)?Date.now()%100000:s); };
$('bReveal').onclick=function(){
  revealAll=!revealAll;
  $('bReveal').textContent = revealAll ? 'Reveal: on' : 'Reveal: off';
  log(revealAll ? 'Map revealed - fog of war is off until you turn it back.' : 'Fog of war back on.','c-info');
  draw();
};
$('zoom').onchange=function(){ zoomKey=this.value; resize(); };
$('bGive').onclick=function(){
  /* a spare piece of kit, so the paper doll has something to accept */
  var weapon = rng()<0.6;
  var it = weapon ? pick(LOOT.weapons) : pick(LOOT.armors);
  var copy={}; for(var k in it) copy[k]=it[k];
  if(weapon){ copy.plus = ri(0,3); if(rng()<0.5) copy.enchant=pick(['fire','earth','shadow','water']); }
  addBag(weapon?'\u2694':'\u26E8', copy.name, {kind:weapon?'weapon':'armor', data:copy, uid:copy.name+(copy.plus||0)+(copy.enchant||'')});
  log('A <b>'+copy.name+'</b> appears in your bag &mdash; open Equipment and drag it onto the doll.','c-good');
  updateUI();
};
$('bMotion').onclick=function(){
  setMotion(ANIM.mode==='auto' ? (ANIM.reduce?'on':'off') : ANIM.mode==='on' ? 'off' : 'auto');
  log('Motion: '+(ANIM.reduce?'off':'on')+'.','c-info');
};
$('bArt').onclick=function(){ spriteOn=!spriteOn; log(spriteOn?'Sprites on.':'Block art on.','c-info'); draw(); };
$('bLevel').onclick=function(){ gainXP(player.xpNext-player.xp); updateUI(); };
$('bSpawn').onclick=function(){
  var spots=[], x, y;
  for(y=0;y<MH;y++) for(x=0;x<MW;x++){
    var d=dist(player,{x:x,y:y});
    var free=!ents.some(function(e){ return e.x===x && e.y===y; });
    if(at(x,y)===FLOOR && d>3 && d<9 && free) spots.push({x:x,y:y});
  }
  if(!spots.length) return;
  var p=pick(spots), m=spawn(pick(['goblin','archer','slime','shade']),p.x,p.y);
  m.state='hunt'; log('A '+m.name+' arrives.','c-info'); draw(); updateUI();
};
$('preset').onchange=function(){ player.build=$('preset').value; newRun(worldSeed); };
$('numScale').onchange=function(){ NUM=parseFloat(this.value); newRun(worldSeed); };
$('lethal').onchange=function(){ LETH=parseFloat(this.value); newRun(worldSeed); };
$('bAgain').onclick=function(){ newRun(Date.now()%100000); };
window.addEventListener('resize', resize);
if(window.ResizeObserver) new ResizeObserver(resize).observe($('map'));

/* ============ boot ============ */
function newRun(seed){
  floorNo=1; turn=0; revealAll=false;
  if($('bReveal')) $('bReveal').textContent='Reveal: off';
  player.essence=0; player.motes={}; player.st={}; player.hidden=0;
  player.level=1; player.xp=0; player.xpNext=90; player.points=0; player.blurCd=0; player.fortCd=0;
  player.aff={};
  var startEl=BUILDS[player.build].locked;   /* only Fae and Gloomlings are born with an element */
  if(startEl) player.aff[startEl]=1;
  player.sets=null; player.activeSet=0; player.armorItem=null; player.off=null; player.hotbar=null;
  player.bag=[{icon:'\u{1F356}',name:'Ration',n:3},{icon:'\u2726',name:'Light sigil (heal)',n:2}];
  derive(player);
  player.hp=player.maxhp; player.mp=player.maxmp;
  $('over').style.display='none';
  $('log').innerHTML='';
  worldSeed=seed>>>0;
  rng=mulberry32(worldSeed); shuffleSigils();
  generate(worldSeed);
  player.face='south';
  log('<b>'+player.name+'</b> enters the dungeon. Seed '+seed+'.','c-kill');
  log('Sigils look different every run &mdash; use one to learn what it does.','c-info');
  resize(); updateUI();
}
/* boot moved to js/boot.js */
