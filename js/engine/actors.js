(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FoteActors=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var neighbors=Object.freeze([[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]].map(Object.freeze));
  function movementAllowed(actor,effects){return actor&&actor.hp>0&&!(actor.tomb>0)&&!effects.hasTag(actor,'root')&&!effects.hasTag(actor,'stun')&&!effects.hasTag(actor,'frozen')&&!effects.hasTag(actor,'stone');}
  function blocked(actor,effects){if(actor.tomb>0)return 'tomb';for(var tag of ['stun','frozen','stone'])if(effects.hasTag(actor,tag))return tag;return null;}
  function bestStep(origin,score,allowed,maximize){
    var best=null,value=score(origin.x,origin.y);
    if(!Number.isFinite(value)||value<0)value=maximize?-Infinity:Infinity;
    neighbors.forEach(function(offset){var x=origin.x+offset[0],y=origin.y+offset[1];if(!allowed(x,y,offset[0],offset[1]))return;var candidate=score(x,y);if(!Number.isFinite(candidate)||candidate<0)return;if(maximize?candidate>value:candidate<value){value=candidate;best={x:x,y:y,dx:offset[0],dy:offset[1]};}});
    return best;
  }
  function candidates(dx,dy){return [[dx,dy],[dx,0],[0,dy]].filter(function(offset,index,list){return (offset[0]||offset[1])&&!list.slice(0,index).some(function(other){return offset[0]===other[0]&&offset[1]===other[1];});});}
  function create(ports){
    function takeTurn(actor){
      if(!actor||actor.hp<=0||!ports.present(actor))return false;
      var context={actor:actor,from:actor.t,x:actor.x,y:actor.y,state:actor.state,handled:false,behavior:null};
      try{
        if(ports.before&&ports.before(context)){context.handled=true;return true;}
        var reason=ports.blocked(actor);
        if(reason){context.handled=true;context.behavior=reason;if(ports.onBlocked)ports.onBlocked(context);return true;}
        for(var entry of ports.behaviors){
          if(entry.when&&!entry.when(actor,context))continue;
          if(entry.run(actor,context)){context.handled=true;context.behavior=entry.name;break;}
        }
        return context.handled;
      }finally{
        /* Only this boundary spends actor time; content handlers describe an action. */
        actor.t=context.from+Math.max(1,ports.cost(actor)||1);
        if(ports.after)ports.after(context);
      }
    }
    return Object.freeze({takeTurn:takeTurn});
  }
  return Object.freeze({create:create,movementAllowed:movementAllowed,blocked:blocked,bestStep:bestStep,candidates:candidates,neighbors:neighbors});
});
