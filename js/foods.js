/* foods.js - one everyday food, and rare foods that grant a buff (2026-09-19).
   Justin: four plain foods were clutter. Now every food you find is a Ration, except that one in five is a special
   food instead: four that turn up anywhere, and one of each biome's own that only grows there. A special food
   fills some hunger and grants a buff; only one food buff runs at a time (a new one replaces it). Old saves'
   bread and small rations still eat as before; they just no longer drop. Numbers are placeholders for the
   balance pass. */
var FOOD_SPECIAL_CHANCE = 0.2;
var FOOD_BUFFS = ['regeneration','manaflow','haste','might','poisonward','shadeward','stormward','fireward','starward'];
Object.assign(FOODS, {
  ration:     {name:'Ration', nutrition:700, icon:'item-ration'},
  /* anywhere */
  honeycake:  {name:'Honeycake', nutrition:400, icon:'item-bread', buff:'regeneration', turns:30, desc:'Regeneration: 2% of your HP a turn for 30 turns.'},
  moontart:   {name:'Moonberry Tart', nutrition:400, icon:'item-bread', buff:'manaflow', turns:40, desc:'Mana returns twice as fast for 40 turns.'},
  figs:       {name:'Sugared Figs', nutrition:300, icon:'item-bread', buff:'haste', turns:20, desc:'Haste: you move 30% faster for 20 turns.'},
  meat:       {name:'Roast Meat', nutrition:550, icon:'item-meat', buff:'might', turns:30, desc:'Might: +20% weapon damage for 30 turns.'},
  /* one per biome, found only there */
  skewer:     {name:'Mushroom Skewer', nutrition:400, icon:'item-meat', biome:0, buff:'poisonward', turns:60, desc:'Poison hurts you half as much for 60 turns.'},
  graveplum:  {name:'Grave Plum', nutrition:300, icon:'item-bread', biome:1, buff:'shadeward', turns:60, desc:'Shadow hurts you half as much for 60 turns.'},
  glowstew:   {name:'Glowcap Stew', nutrition:500, icon:'item-ration', biome:2, buff:'stormward', turns:60, desc:'Your light reaches further, and lightning hurts you half as much, for 60 turns.'},
  emberpepper:{name:'Ember Pepper', nutrition:250, icon:'item-meat', biome:3, buff:'fireward', turns:60, desc:'Fire hurts you half as much for 60 turns.'},
  starfruit:  {name:'Starfruit', nutrition:400, icon:'item-bread', biome:4, buff:'starward', turns:60, desc:'Every element hurts you 20% less for 60 turns.'}
});
/* what a food drop turns out to be */
function randomFood(){
  if(rng()>=FOOD_SPECIAL_CHANCE) return 'ration';
  var b=typeof bidx==='function' ? bidx() : 0, planar=!!(floorMeta && floorMeta.plane);
  var pool=Object.keys(FOODS).filter(function(k){ var f=FOODS[k]; return f.buff && (f.biome===undefined || (!planar && f.biome===b)); });
  return pool.length ? pool[Math.floor(rng()*pool.length)] : 'ration';
}
/* eating one */
function eatFoodBuff(fd){
  if(!fd || !fd.buff || !player.buffs) return;
  FOOD_BUFFS.forEach(function(k){ if(k!==fd.buff && player.buffs[k]>0 && player._foodBuff===k) player.buffs[k]=0; });   /* one food buff at a time */
  player.buffs[fd.buff]=Math.max(player.buffs[fd.buff]||0, fd.turns); player._foodBuff=fd.buff;
  derive(player);
  log('<b>'+fd.name+'</b>: '+fd.desc,'c-good');
  if(typeof sparkleFx==='function') sparkleFx(player.x, player.y, fd.buff==='might'||fd.buff==='fireward' ? 'fire' : fd.buff==='manaflow'||fd.buff==='shadeward' ? 'magic' : 'heal', 18);
}
/* the buffs themselves */
var _deriveFood = derive;
derive = function(p){ _deriveFood(p); if(p===player && p.buffs && p.buffs.might>0 && p.dmg){ p.dmg=[Math.round(p.dmg[0]*1.2), Math.round(p.dmg[1]*1.2)]; } };
var _resistMultFood = resistMult;
resistMult = function(target, type){
  var m=_resistMultFood(target, type);
  if(target!==player || !player.buffs || type==='phys') return m;
  var B=player.buffs;
  if(B.poisonward>0 && type==='poison') m*=0.5;
  if(B.shadeward>0 && type==='dark') m*=0.5;
  if(B.stormward>0 && type==='lightning') m*=0.5;
  if(B.fireward>0 && type==='fire') m*=0.5;
  if(B.starward>0 && type!=='magic') m*=0.8;
  return m;
};
var _endTurnFood = endTurn;
endTurn = function(){
  var r=_endTurnFood.apply(this, arguments);
  if(player && player.buffs && player.buffs.regeneration>0 && player.hp>0 && player.hp<player.maxhp){
    var h=Math.max(1, Math.round(player.maxhp*0.02)); healPlayer(h);
  }
  return r;
};
var _gatherLightsFood = gatherLights;
gatherLights = function(now, prp){
  var L=_gatherLightsFood(now, prp);
  if(player && player.buffs && player.buffs.stormward>0 && prp) L.push({x:prp.x, y:prp.y, c:hexRGB('#9FE8FF'), r:8, s:0.3, tx:player.x, ty:player.y});
  return L;
};
/* the food buffs in the status bar (stand-in icons until the food art arrives) */
if(typeof STATUS_INFO!=='undefined') Object.assign(STATUS_INFO, {
  regeneration:{name:'Regeneration', icon:'ic-heal', d:'You heal 2% of your HP each turn.'},
  might:       {name:'Might', icon:'pr-rampage', d:'+20% weapon damage.'},
  poisonward:  {name:'Poison Ward', icon:'st-poison', d:'Poison hurts you half as much.'},
  shadeward:   {name:'Shade Ward', icon:'ic-shadow-bolt', d:'Shadow hurts you half as much.'},
  stormward:   {name:'Glowcap', icon:'ic-chain-lightning', d:'Your light reaches further; lightning hurts you half as much.'},
  fireward:    {name:'Fire Ward', icon:'ic-firebolt', d:'Fire hurts you half as much.'},
  starward:    {name:'Starfruit', icon:'ic-arcane-ward', d:'Every element hurts you 20% less.'}
});
