/* Authoritative run state. Presentation keeps a compatibility view during migration. */
(function(root, factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else {root.FoteState=api;root.gameState=api.create();root.gameState.expose(root);}
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const defaultDimensions=Object.freeze({width:56,height:34});
  const maxDimensions=Object.freeze({width:128,height:96});
  function dimensions(state){
    state=state||{};
    if(state.MW===undefined&&state.MH===undefined)return defaultDimensions;
    if(!Number.isInteger(state.MW)||!Number.isInteger(state.MH)||state.MW<8||state.MH<6||state.MW>maxDimensions.width||state.MH>maxDimensions.height)throw new Error('Invalid map dimensions.');
    return {width:state.MW,height:state.MH};
  }
  const fields=Object.freeze(['MW','MH','player','RUN','floorNo','turn','revealAll','worldSeed','nextId','lastDir','spawnedExtra','nextSpawn',
    'map','seen','vis','feats','items','ents','rooms','ground','fireT','fireSrc','props','propGrid','chestKind','floorMeta',
    'levers','plates','altars','iceG','rootG','holyG','sigilLook','sigilKnown','LAST_CHOICE']);
  function create(initial={}){
    const size=dimensions(initial);
    let values=Object.assign(Object.create(null),initial,{MW:size.width,MH:size.height}),revision=0;
    return {
      get revision(){return revision;},
      get(key){return values[key];},
      dimensions(candidate){return dimensions(candidate===undefined?values:candidate);},
      set(key,value){if(!fields.includes(key))throw new Error('Unknown run field: '+key);values[key]=value;return value;},
      snapshot(){const copy={};for(const key of fields)if(values[key]!==undefined)copy[key]=values[key];return copy;},
      replace(next){const size=dimensions(next),copy=Object.create(null);for(const key of fields)if(next[key]!==undefined)copy[key]=next[key];copy.MW=size.width;copy.MH=size.height;values=copy;revision++;},
      expose(target){
        for(const key of fields){
          const existing=Object.getOwnPropertyDescriptor(target,key);
          if(existing&&!existing.configurable)throw new Error('Run state must be installed before '+key);
          if(existing&&'value' in existing&&existing.value!==undefined)values[key]=existing.value;
          Object.defineProperty(target,key,{enumerable:true,configurable:true,get:()=>values[key],set:value=>{values[key]=value;}});
        }
      }
    };
  }
  function validate(state){
    if(!state||typeof state!=='object')throw new Error('Save has no run state.');
    const p=state.player;
    if(!p||!p.stats||!p.aff||!Array.isArray(p.sets))throw new Error('Save has no complete character.');
    for(const key of ['hp','mp','x','y','level','t'])if(!Number.isFinite(p[key]))throw new Error('Invalid character '+key+'.');
    if(!Number.isInteger(state.floorNo)||state.floorNo<1||!Number.isFinite(state.turn))throw new Error('Invalid floor or turn.');
    if(!Array.isArray(state.ents)||!state.ents.includes(p))throw new Error('Save lost the player entity reference.');
    if(!Array.isArray(state.rooms)||!Array.isArray(state.items)||!Array.isArray(state.props))throw new Error('Incomplete floor objects.');
    const size=dimensions(state);
    if(!ArrayBuffer.isView(state.map)||state.map.length!==size.width*size.height)throw new Error('Invalid floor map.');
    for(const key of ['seen','vis'])if(!ArrayBuffer.isView(state[key])||state[key].length!==state.map.length)throw new Error('Invalid visibility map.');
    return state;
  }
  return Object.freeze({fields,create,validate,dimensions,defaultDimensions,maxDimensions});
});
