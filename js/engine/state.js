/* Authoritative run state. Presentation keeps a compatibility view during migration. */
(function(root, factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else {root.FoteState=api;root.gameState=api.create();root.gameState.expose(root);}
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const fields=Object.freeze(['player','RUN','floorNo','turn','revealAll','worldSeed','nextId','lastDir','spawnedExtra','nextSpawn',
    'map','seen','vis','feats','items','ents','rooms','ground','fireT','fireSrc','props','propGrid','chestKind','floorMeta',
    'levers','plates','altars','iceG','rootG','holyG','sigilLook','sigilKnown','LAST_CHOICE']);
  function create(initial={}){
    let values=Object.assign(Object.create(null),initial),revision=0;
    return {
      get revision(){return revision;},
      get(key){return values[key];},
      set(key,value){if(!fields.includes(key))throw new Error('Unknown run field: '+key);values[key]=value;return value;},
      snapshot(){const copy={};for(const key of fields)if(values[key]!==undefined)copy[key]=values[key];return copy;},
      replace(next){const copy=Object.create(null);for(const key of fields)if(next[key]!==undefined)copy[key]=next[key];values=copy;revision++;},
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
    if(!ArrayBuffer.isView(state.map)||state.map.length!==56*34)throw new Error('Invalid floor map.');
    for(const key of ['seen','vis'])if(!ArrayBuffer.isView(state[key])||state[key].length!==state.map.length)throw new Error('Invalid visibility map.');
    return state;
  }
  return Object.freeze({fields,create,validate});
});
