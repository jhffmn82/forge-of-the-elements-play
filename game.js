/* game.js - the original single-file prototype.
   71 of its functions are declared again by the js/ modules that load after it, so those copies never
   ran; they were removed on 2026-09-18. What remains is still load-bearing: the canvas and sprite
   loader, tile and geometry helpers (at, dist, faceOf, mulberry32, hitChance), the passive table, the
   drag-and-drop plumbing, and log() - which the modules wrap rather than replace. */
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
var map, seen, vis, feats, items, ents, rooms=[], spawnedExtra=0, nextSpawn=0;
var floorNo=1, turn=0, revealAll=false, worldSeed=48213, nextId=1, lastDir=[1,0];
var aiming=null, hoverX=-1, hoverY=-1;
/* two independent knobs: NUM changes how big numbers look, LETH changes how deadly fights are */
var NUM=1.0, LETH=1.0;
function sHP(v){ return Math.max(1, Math.round(v*NUM)); }
function sDMG(v){ return Math.max(1, Math.round(v*NUM*LETH)); }
var player={ id:0, ch:'@', x:2, y:2, t:0, st:{}, foe:false, build:'dwarf',
             essence:0, motes:{}, bag:[], hidden:0, level:1, xp:0, xpNext:90, points:0, blurCd:0, fortCd:0 };

function at(x,y){ return (x<0||y<0||x>=MW||y>=MH) ? WALL : map[y*MW+x]; }
function setT(x,y,v){ if(x>=0&&y>=0&&x<MW&&y<MH) map[y*MW+x]=v; }
function biome(){ return BIOMES[Math.min(BIOMES.length-1, Math.floor((floorNo-1)/5))]; }


/* ============ generation ============ */
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
function doorSpot(x,y,horizontalWall){
  if(at(x,y)!==FLOOR) return false;
  if(horizontalWall) return at(x-1,y)===WALL && at(x+1,y)===WALL;
  return at(x,y-1)===WALL && at(x,y+1)===WALL;
}

/* ============ field of view ============ */
var OCT=[[1,0,0,1],[0,1,1,0],[0,-1,1,0],[-1,0,0,1],[-1,0,0,-1],[0,-1,-1,0],[0,1,-1,0],[1,0,0,-1]];
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
var fxIdleFrames=0, lastFrame=0;

/* ============ combat ============ */
function hitChance(acc,eva){ return clamp(acc/(acc+eva), 0.15, 0.95); }


/* ============ player actions ============ */
/* drop an item on a doll slot to wear it; slot is 'main', 'off' or 'armor' */
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
function cancelAim(){ if(!aiming) return; aiming=null; abilityBar(); draw(); }


/* ============ allies ============ */

/* ============ monsters ============ */

/* ============ turn loop ============ */

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

/* ---------- hover cards for gear ---------- */
var dtip=null;
function ensureDtip(){
  if(dtip) return dtip;
  dtip=document.createElement('div');
  dtip.id='dtip'; document.body.appendChild(dtip);
  return dtip;
}
function elLabel(e){ return e ? (' <span style="color:'+(AFF_COL[e]||'#fff')+'">'+e+'</span>') : ''; }
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
function hotbarPut(i, entry){
  for(var j=0;j<8;j++) if(j!==i && player.hotbar[j] && entry &&
      player.hotbar[j].type===entry.type &&
      player.hotbar[j].key===entry.key && player.hotbar[j].ref===entry.ref) player.hotbar[j]=null;
  player.hotbar[i]=entry;
  abilityBar();
}
function kv(pairs){ return '<div class="kv">'+pairs.map(function(p){ return '<span>'+p[0]+'</span><b>'+p[1]+'</b>'; }).join('')+'</div>'; }
function statBox(n,v,key){
  var plus = (player.points>0 && key) ? ' <button class="plus" data-s="'+key+'">+</button>' : '';
  return '<div class="stat"><span>'+n+'</span><b>'+v+plus+'</b></div>';
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
/* boot moved to js/boot.js */
