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
        if(c.rampage)cost/=1+.20*c.divine;
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
    if(c.hunter)cost/=1+.05*c.rank*c.divine;
    cost=Math.round(cost);
    if(c.storm)cost=Math.round(cost*.5);
    if(c.slow)cost=Math.round(cost/c.slow);
    return cost;
  }
  function shields(actor){
    var buffs=actor.buffs||{};
    return [
      {key:'iceArmor',name:'Ice Armor',amount:Math.max(0,Math.floor(actor.iceArmor||0))},
      {key:'ward',name:'Ward',amount:buffs.arcaneward>0||buffs.communion>0?Math.max(0,actor.ward||0):0},
      {key:'mward',name:'Tome Ward',amount:Math.max(0,Math.floor(actor.mward||0))},
      {key:'guard',name:'Guard',amount:Math.max(0,Math.floor(actor.guard||0))},
      {key:'hideShield',name:'Iron Hide',amount:Math.max(0,Math.floor(actor.hideShield||0))}
    ];
  }
  var api=Object.freeze({action:action,movement:movement,shields:shields});
  root.FoteCosts=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
