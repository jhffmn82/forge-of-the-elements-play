/* Pure action timing and displayed shield pools. Rounding is part of the rules. */
(function(root){
  'use strict';
  function action(c){
    if(c.player&&c.free)return 0;
    var cost=10000/(c.speed*(1-(c.chill||0)));
    if(c.player){
      cost*=1-.02*(c.agility-10);
      if(c.attacking){
        if(c.unarmed)cost*=.80;
        else if(c.dagger)cost*=.90;
        if(c.grom&&c.unarmed&&c.rank>=3)cost/=1+.10*c.rank;
        if(c.rampage)cost/=1+(.10+.02*c.rank)*c.divine;   /* 2026-09-29 (Justin): 10% +2% per rank (was 20%) */
        if(c.hunter)cost/=1+.05*c.rank*c.divine;
      }
      if(c.casting)cost*=1-(c.tomeReduction||0);
      cost=Math.max(40,cost);
    }
    cost=Math.round(cost);
    if(c.player&&c.storm)cost=Math.max(20,Math.round(cost*.5));
    if(c.player&&c.holyAir)cost=Math.max(40,Math.round(cost*(1-c.holyReduction)));
    if(c.slow)cost=Math.round(cost/c.slow);
    return cost;
  }
  function movement(c){
    if(c.freeStep)return 0;
    var cost=10000/(c.speed*(1-(c.chill||0)))*(c.fleet?.85:1)/(1+.10*(c.air||0));
    if(c.water&&!c.levitate)cost*=1.25;
    if(c.grom&&c.rank>=1)cost/=1+.10*c.rank;
    if(c.hunter)cost/=1+.05*c.rank*c.divine;
    cost=Math.round(cost);
    if(c.storm)cost=Math.round(cost*.5);
    if(c.slow)cost=Math.round(cost/c.slow);
    return cost;
  }
  function manaWard(rule,rank,divine){
    return {shield:Math.max(0,Math.round(rule.shieldPerRank*rank*divine)),duration:rule.duration,manaPerHP:rule.manaPerHP};
  }
  function shields(actor,raw){
    var buffs=actor.buffs||{};
    function amount(value){value=Math.max(0,value||0);return raw?value:Math.floor(value);}
    return [
      {key:'iceArmor',name:'Ice Armor',amount:amount(actor.iceArmor)},
      {key:'ward',name:'Ward',amount:buffs.arcaneward>0||buffs.communion>0?Math.max(0,actor.ward||0):0},
      {key:'manaWard',name:'Mana Ward',amount:buffs.manaward>0?amount(actor.manaWard):0},
      {key:'mward',name:'Tome Ward',amount:amount(actor.mward)},
      {key:'guard',name:'Guard',amount:amount(actor.guard)},
      {key:'hideShield',name:'Iron Hide',amount:amount(actor.hideShield)}
    ];
  }
  function shieldTotal(actor,keys){return shields(actor,true).reduce(function(total,pool){return total+(!keys||keys.indexOf(pool.key)>=0?pool.amount:0);},0);}
  var api=Object.freeze({action:action,movement:movement,shields:shields,shieldTotal:shieldTotal,manaWard:manaWard});
  root.FoteCosts=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
