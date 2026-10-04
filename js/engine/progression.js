/* Progression arithmetic and kill eligibility, without actor or presentation globals. */
(function(root){
  'use strict';
  function devotion(amount,c){return amount*(1+(c.race==='human'?.25:0)+(c.race===c.lovedRace?.25:0)+(c.cls==='cleric'?.25:0));}
  function depthMultiplier(c,earned){
    var biome=Math.max(0,c.biome||0);
    // Extra late-run devotion applies to earned positive rewards only. Planes
    // retain their parent's depth, but are not the material Realm of Chaos.
    var late=earned!==false?(biome===3?2:biome===4&&!c.plane?4:1):1;
    return Math.pow(1.3,biome)*late;
  }
  function piety(amount,c){return devotion(amount,c)*depthMultiplier(c,amount>0);}
  function favor(amount,c){return devotion(amount,c)*c.divine;}
  function experience(amount,cls){return cls==='tourist'?Math.round(amount*1.25):amount;}
  function statPoints(character,level){return 1+(character.cls==='tourist'&&level%2===0?1:0)+(character.race==='human'&&level%3===0?1:0);}
  function wobblesOutcome(baseReward,rank){
    var base=Math.max(0,Math.min(1,baseReward)),conversion=rank>=3?Math.min(1,.05*rank):0;
    return {baseReward:base,rank:rank,conversion:conversion,reward:base+(1-base)*conversion};
  }
  function wobblesMoodOutcome(raw,rank){
    var conversion=wobblesOutcome(0,rank).conversion;
    return {prank:raw.prank*(1-conversion),reward:raw.reward+raw.prank*conversion,conversion:conversion};
  }
  function freezePool(pool){return Object.freeze(pool.map(Object.freeze));}
  var wobblesPolicy=Object.freeze({restoration:.5,resourceThreshold:.8,greaterRestorationChance:.35,
    giftPools:Object.freeze({passive:freezePool([{kind:'sigil',weight:1},{kind:'mote',weight:1},{kind:'essence',weight:1}]),
      greater:freezePool([{kind:'mote',weight:50,count:2},{kind:'sigil',weight:25},{kind:'ring',weight:12.5},{kind:'amulet',weight:12.5}]),
      invoke:freezePool([{kind:'mote',weight:50},{kind:'essence',weight:25},{kind:'ring',weight:12.5},{kind:'amulet',weight:12.5}])}),
    pranks:Object.freeze([{kind:'food',weight:25},{kind:'transmute',weight:25},{kind:'teleport',weight:20},{kind:'summon',weight:15},
      {kind:'blind',weight:5,turns:6},{kind:'chill',weight:5,turns:6},{kind:'root',weight:5,turns:6}].map(Object.freeze))});
  function wobblesRules(){return wobblesPolicy;}
  function wobblesResources(view){
    function chance(current,maximum){return maximum>0&&current<maximum*wobblesPolicy.resourceThreshold?Math.max(0,Math.min(1,1-current/maximum)):0;}
    return {healthChance:chance(view.hp,view.maxhp),manaChance:chance(view.mp,view.maxmp),
      healthAmount:Math.round(Math.max(0,view.maxhp)*wobblesPolicy.restoration),manaAmount:Math.round(Math.max(0,view.maxmp)*wobblesPolicy.restoration)};
  }
  function wobblesPrank(roll,available){
    var pool=wobblesPolicy.pranks.filter(function(p){return !available||available[p.kind]!==false;}),sum=pool.reduce(function(n,p){return n+p.weight;},0),choice=roll*sum;
    for(var i=0;i<pool.length;i++){choice-=pool[i].weight;if(choice<0)return pool[i];}
    return pool[pool.length-1]||null;
  }
  function wobblesGift(roll,pool){
    var gifts=wobblesPolicy.giftPools[pool||'invoke'],choice=roll*gifts.reduce(function(n,g){return n+g.weight;},0),gift=gifts[gifts.length-1];
    for(var i=0;i<gifts.length;i++){choice-=gifts[i].weight;if(choice<0){gift=gifts[i];break;}}
    return {kind:gift.kind,count:gift.count||1};
  }
  function killReward(c){
    var out={piety:0,healingRanks:0};
    if(c.noReward||!c.god)return out;
    var bonus=c.big?15:0;
    if(c.god==='grom'){if(c.playerKill&&c.unarmed)out.piety=2+bonus;}
    else if(c.god==='grumbok'){if(c.playerKill||c.allyKill)out.piety=(c.spellcaster||c.element?5:2)+bonus;}
    else if(c.god==='glimmer'){if(c.playerKill||c.allyKill)out.piety=(c.undead||c.shadowy?4:2)+bonus;}
    else if(c.god==='murk'){
      if(c.allyKill&&c.servant)out.piety=4+bonus;
      else if((c.playerKill||c.allyKill)&&!c.undead)out.piety=2+bonus;
      /* 2026-09-29 (Justin): Life Drain no longer heals on a kill; it is a 10% chance on a hit (murkLifeDrain in gods.js) */
    }
    else if(c.god==='reginald'){if(c.playerKill&&c.awake)out.piety=2+bonus;}
    else if(c.god==='vellum'){if(c.playerKill&&c.spellKill)out.piety=2+bonus;}
    else if(c.god==='wobbles')out.piety=c.big?15:2;
    else if(c.god==='sylla'&&(c.playerKill||c.taggedPlayerKill||c.allyKill)&&c.held)out.piety=c.syllaKill+(c.big?c.syllaBig:0);
    return out;
  }
  var api=Object.freeze({devotion:devotion,depthMultiplier:depthMultiplier,piety:piety,favor:favor,experience:experience,statPoints:statPoints,wobblesGift:wobblesGift,wobblesOutcome:wobblesOutcome,wobblesMoodOutcome:wobblesMoodOutcome,wobblesRules:wobblesRules,wobblesResources:wobblesResources,wobblesPrank:wobblesPrank,killReward:killReward});
  root.FoteProgression=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
