/* Progression arithmetic and kill eligibility, without actor or presentation globals. */
(function(root){
  'use strict';
  function devotion(amount,c){return amount*(1+(c.race==='human'?.25:0)+(c.race===c.lovedRace?.25:0)+(c.cls==='cleric'?.25:0));}
  function piety(amount,c){return devotion(amount,c)*Math.pow(1.3,Math.max(0,c.biome||0));}
  function favor(amount,c){return devotion(amount,c)*c.divine;}
  function experience(amount,cls){return cls==='tourist'?Math.round(amount*1.25):amount;}
  function statPoints(character,level){return 1+(character.cls==='tourist'&&level%2===0?1:0)+(character.race==='human'&&level%3===0?1:0);}
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
      if((c.playerKill||c.allyKill&&c.servant)&&c.foe&&!c.undead&&c.rank>0)out.healingRanks=c.rank;
    }
    else if(c.god==='reginald'){if(c.playerKill&&c.awake)out.piety=2+bonus;}
    else if(c.god==='vellum'){if(c.playerKill&&c.castThisTurn)out.piety=2+bonus;}
    else if(c.god==='wobbles')out.piety=c.big?15:2;
    else if(c.god==='sylla'&&(c.playerKill||c.taggedPlayerKill||c.allyKill)&&c.held)out.piety=c.syllaKill+(c.big?c.syllaBig:0);
    return out;
  }
  var api=Object.freeze({devotion:devotion,piety:piety,favor:favor,experience:experience,statPoints:statPoints,killReward:killReward});
  root.FoteProgression=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
