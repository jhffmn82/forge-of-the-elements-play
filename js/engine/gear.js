/* Item resource rules shared by progression and read-only cards. */
(function(root){
  'use strict';
  function ringPower(item){return !item?0:item.cursed?(item.plus||-1):(item.plus||0)+1;}
  function amuletCapacity(item){return Math.max(1,Math.min(3,item.level||1));}
  function amuletKills(item,base){return Math.max(2,Math.round(base*(item.cursed?1.3:1)));}
  function amuletState(item,kills){
    var level=item.level||1,charges=item.charges===undefined?1:item.charges,progress=item.charges===undefined?0:item.progress;
    charges=Math.min(charges,amuletCapacity({level:level}));
    return {level:level,charges:charges,progress:progress,charge:charges>0?0:Math.max(1,kills-(progress||0))};
  }
  var api=Object.freeze({ringPower:ringPower,amuletCapacity:amuletCapacity,amuletKills:amuletKills,amuletState:amuletState});
  root.FoteGear=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
