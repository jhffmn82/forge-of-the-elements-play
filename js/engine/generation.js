/* Deterministic floor orchestration. Domain stages are explicit dependencies;
 * module evaluation never wraps or reassigns the generation entry point. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.FoteGeneration=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  var sessions=new WeakMap();
  /* This is an in-memory fork, not serialization: functions, undefined values,
   * graph aliases and carried object identities survive installation. Builders
   * still use compatibility globals, but those globals address the candidate.
   * Preflight every reconciliation before writing any existing live object. */
  function forkGraph(value,shared){
    var originals=new Map(),copies=new Map(),immutable=new Set(shared||[]);
    immutable.forEach(function(record){if(!record||typeof record!=='object'||!Object.isFrozen(record)||Reflect.ownKeys(record).some(function(key){var d=Object.getOwnPropertyDescriptor(record,key);return !('value' in d)||(d.value&&typeof d.value==='object');}))throw new Error('Generation shared records must be frozen scalar records.');});
    function fork(v){
      if(!v||typeof v!=='object')return v;
      if(immutable.has(v))return v;
      if(originals.has(v))return originals.get(v);
      var tag=Object.prototype.toString.call(v),copy;
      if(tag==='[object ArrayBuffer]')copy=ArrayBuffer.prototype.slice.call(v,0);
      else if(ArrayBuffer.isView(v))copy=tag==='[object DataView]'?new DataView(fork(v.buffer),v.byteOffset,v.byteLength):new v.constructor(fork(v.buffer),v.byteOffset,v.length);
      else if(tag==='[object Map]')copy=new Map();
      else if(tag==='[object Set]')copy=new Set();
      else if(tag==='[object Date]')copy=new Date(Date.prototype.getTime.call(v));
      else copy=Array.isArray(v)?[]:Object.create(Object.getPrototypeOf(v));
      originals.set(v,copy);copies.set(copy,v);
      if(ArrayBuffer.isView(v)||tag==='[object Date]'||tag==='[object ArrayBuffer]')return copy;
      if(tag==='[object Map]'){Map.prototype.forEach.call(v,function(item,key){copy.set(fork(key),fork(item));});return copy;}
      if(tag==='[object Set]'){Set.prototype.forEach.call(v,function(item){copy.add(fork(item));});return copy;}
      Reflect.ownKeys(v).forEach(function(key){
        var d=Object.getOwnPropertyDescriptor(v,key);
        if(!('value' in d))throw new Error('Generation state contains an accessor: '+String(key));
        Object.defineProperty(copy,key,{value:fork(d.value),enumerable:d.enumerable,writable:true,configurable:!(Array.isArray(v)&&key==='length')});
      });
      return copy;
    }
    var candidate=fork(value);
    function install(value){
      var visited=new Map(),plans=[];
      function resolve(v){
        if(!v||typeof v!=='object')return v;
        if(immutable.has(v))return v;
        if(visited.has(v))return visited.get(v);
        // A new actor may refer directly to an immutable catalog definition.
        // It was never part of the candidate and must not be rewritten.
        if(originals.has(v))return v;
        var target=copies.get(v)||v,old=copies.has(v),tag=Object.prototype.toString.call(v);
        visited.set(v,target);
        if(tag==='[object ArrayBuffer]'){
          if(old){if(target.byteLength!==v.byteLength)throw new Error('Generation changed a carried buffer size.');plans.push(function(){Uint8Array.prototype.set.call(new Uint8Array(target),new Uint8Array(v));});}
          return target;
        }
        if(ArrayBuffer.isView(v)){
          var backing=resolve(v.buffer);
          if(!old&&backing!==v.buffer){target=tag==='[object DataView]'?new DataView(backing,v.byteOffset,v.byteLength):new v.constructor(backing,v.byteOffset,v.length);visited.set(v,target);}
          return target;
        }
        if(tag==='[object Date]'){if(old)plans.push(function(){Date.prototype.setTime.call(target,Date.prototype.getTime.call(v));});return target;}
        if(tag==='[object Map]'){
          var entries=Array.from(v,function(pair){return [resolve(pair[0]),resolve(pair[1])];});
          plans.push(function(){Map.prototype.clear.call(target);entries.forEach(function(pair){Map.prototype.set.call(target,pair[0],pair[1]);});});return target;
        }
        if(tag==='[object Set]'){
          var entries=Array.from(v,resolve);plans.push(function(){Set.prototype.clear.call(target);entries.forEach(function(item){Set.prototype.add.call(target,item);});});return target;
        }
        var keys=Reflect.ownKeys(v),remove=old?Reflect.ownKeys(target).filter(function(key){return !Object.prototype.hasOwnProperty.call(v,key);}):[],writes=[];
        remove.forEach(function(key){if(!Object.getOwnPropertyDescriptor(target,key).configurable)throw new Error('Generation cannot remove a carried read-only field: '+String(key));});
        keys.forEach(function(key){
          var d=Object.getOwnPropertyDescriptor(v,key),item=resolve(d.value),prior=Object.getOwnPropertyDescriptor(target,key);
          if(prior&&'value' in prior&&Object.is(prior.value,item))return;
          if(old&&prior&&!prior.writable)throw new Error('Generation cannot change a carried read-only field: '+String(key));
          if(old&&!prior&&!Object.isExtensible(target))throw new Error('Generation cannot extend a carried record.');
          writes.push([key,item,prior||{writable:true,enumerable:d.enumerable,configurable:true}]);
        });
        plans.push(function(){remove.forEach(function(key){delete target[key];});writes.forEach(function(write){Object.defineProperty(target,write[0],Object.assign({},write[2],{value:write[1]}));});});
        return target;
      }
      var installed=resolve(value);plans.forEach(function(apply){apply();});return installed;
    }
    return {candidate:candidate,install:install,originalOf:function(copy){return copies.get(copy);}};
  }
  function afterInstall(state,fn,key){
    var session=sessions.get(state);
    if(!session){fn();return;}
    if(key!==undefined){if(session.afterKeys.has(key))return;session.afterKeys.add(key);}
    session.after.push(fn);
  }
  function transaction(config,build){
    if(sessions.has(config.state))return build();
    var previous=config.state.snapshot(),random=config.getRandom(),fork=forkGraph(previous,config.shared),session={after:[],afterKeys:new Set()},result;
    sessions.set(config.state,session);
    try{
      config.state.replace(fork.candidate);
      config.setRandom(config.forkRandom(random));
      result=build();
      config.validate(config.state.snapshot());
      var installed=fork.install({state:config.state.snapshot(),result:result});
      config.state.replace(installed.state);result=installed.result;
    }catch(error){config.state.replace(previous);config.setRandom(random);throw error;}
    finally{sessions.delete(config.state);}
    // Presentation cannot make a valid installed floor into a rejected build.
    var failures=[];session.after.forEach(function(fn){try{fn();}catch(error){failures.push(error);}});
    if(failures.length){var error=new Error('Generated floor installed, but presentation failed.');error.code='GENERATION_PRESENTATION_FAILED';error.cause=failures[0];error.errors=failures;throw error;}
    return result;
  }
  function validateFloor(state,dimensions){
    var size=dimensions(state),length=size.width*size.height;
    ['map','seen','vis','ground','fireT','propGrid'].forEach(function(key){if(!ArrayBuffer.isView(state[key])||state[key].length!==length)throw new Error('Generated floor has an invalid '+key+' array.');});
    ['ents','rooms','items','props','feats'].forEach(function(key){if(!Array.isArray(state[key]))throw new Error('Generated floor has no '+key+' list.');});
    var p=state.player;
    if(!p||!state.ents.includes(p)||!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.y<0||p.x>=size.width||p.y>=size.height)throw new Error('Generated floor has no valid player arrival.');
    if(!state.floorMeta||state.floorMeta.floor!==state.floorNo)throw new Error('Generated floor metadata does not match its destination.');
    return state;
  }
  function validateRequiredRoutes(targets){
    targets.forEach(function(target){
      if(target.required&&target.reachable!==true){
        var error=new Error('Generated floor has no reachable '+target.kind+'.');
        error.code='GENERATION_ROUTE_FAILED';error.target=target;error.targets=targets;throw error;
      }
    });
  }
  /* Decorative growth may close a room mouth even when each new plant has
   * several open neighbors. Reopen only the minimum new blockers on routes
   * that were valid before growth; existing obstacles are never candidates. */
  function blockingPlants(view){
    var size=view.width*view.height,plants=new Set(view.plants),remove=new Set(),dirs=[[1,0],[-1,0],[0,1],[0,-1]],start=view.y*view.width+view.x;
    view.before.filter(function(target){return target.required&&target.reachable===true;}).forEach(function(target){
      if(view.after.some(function(current){return current.required&&current.kind===target.kind&&current.reachable===true;}))return;
      var goal=target.y*view.width+target.x,cost=new Int32Array(size).fill(-1),parent=new Int32Array(size).fill(-1),queue={},head=0,tail=0;
      cost[start]=0;queue[tail++]=start;
      while(head<tail){
        var i=queue[head];delete queue[head++];if(i===goal)break;
        dirs.forEach(function(d){
          var x=i%view.width+d[0],y=Math.floor(i/view.width)+d[1];if(x<0||y<0||x>=view.width||y>=view.height)return;
          var j=y*view.width+x,newPlant=plants.has(j)&&view.reach[j]>=0;
          if(!view.passable[j]&&!newPlant)return;
          var extra=newPlant&&!remove.has(j)?1:0,next=cost[i]+extra;
          if(cost[j]>=0&&cost[j]<=next)return;
          cost[j]=next;parent[j]=i;if(extra)queue[tail++]=j;else queue[--head]=j;
        });
      }
      if(cost[goal]<0)return;
      for(var step=goal;step!==start;step=parent[step])if(plants.has(step))remove.add(step);
    });
    return Array.from(remove);
  }
  /* Contracts observe the candidate graph, including in-place writes. Typed
   * arrays cannot be frozen safely; comparing a private checkpoint also catches
   * a retained builder that writes through a compatibility alias. */
  function sameGraph(a,b,pairs,reverse,originalOf,depth){
    if(Object.is(a,b))return true;
    if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
    if(depth>0&&originalOf(a)&&originalOf(a)!==b)return false;
    if(pairs.has(a))return pairs.get(a)===b;
    if(reverse.has(b))return false;
    var tag=Object.prototype.toString.call(a);if(tag!==Object.prototype.toString.call(b))return false;
    pairs.set(a,b);reverse.set(b,a);
    if(tag==='[object ArrayBuffer]'||ArrayBuffer.isView(a)){
      var av=tag==='[object ArrayBuffer]'?new Uint8Array(a):new Uint8Array(a.buffer,a.byteOffset,a.byteLength);
      var bv=tag==='[object ArrayBuffer]'?new Uint8Array(b):new Uint8Array(b.buffer,b.byteOffset,b.byteLength);
      return av.length===bv.length&&av.every(function(v,i){return v===bv[i];});
    }
    if(tag==='[object Date]')return Date.prototype.getTime.call(a)===Date.prototype.getTime.call(b);
    if(tag==='[object Map]'||tag==='[object Set]'){
      var ae=Array.from(a),be=Array.from(b);return ae.length===be.length&&ae.every(function(v,i){return sameGraph(v,be[i],pairs,reverse,originalOf,depth+1);});
    }
    var keys=Reflect.ownKeys(a),other=Reflect.ownKeys(b);
    return keys.length===other.length&&keys.every(function(key){return Object.prototype.hasOwnProperty.call(b,key)&&sameGraph(a[key],b[key],pairs,reverse,originalOf,depth+1);});
  }
  function stageCheckpoint(ownership,stage){
    var before=ownership.read(),writes=new Set(stage.writes===undefined?ownership.defaultWrites:stage.writes),protectedValues={},append={};
    writes.forEach(function(key){if(!Object.prototype.hasOwnProperty.call(before,key))throw new Error('Unknown generation domain: '+key);});
    Object.keys(before).forEach(function(key){if(!writes.has(key))protectedValues[key]=before[key];});
    Object.keys(stage.appends||{}).forEach(function(key){
      var rule=stage.appends[key];
      if(!writes.has(key)||!Array.isArray(before[key])||!rule||!Number.isInteger(rule.min)||!Number.isInteger(rule.max)||rule.min<0||rule.max<rule.min)throw new Error('Invalid generation append contract: '+key);
      var fork=forkGraph(before[key]);append[key]={array:before[key],values:before[key].slice(),copy:fork.candidate,originalOf:fork.originalOf};
    });
    var checkedValues={};Object.keys(protectedValues).forEach(function(key){if(!(ownership.referenceOnly||[]).includes(key))checkedValues[key]=protectedValues[key];});
    var checkpoint=forkGraph(checkedValues),copy=checkpoint.candidate;
    return function(){
      var after=ownership.read(),added={};
      Object.keys(protectedValues).forEach(function(key){
        var referenceChanged=after[key]!==protectedValues[key],referenceOnly=(ownership.referenceOnly||[]).includes(key);
        if(referenceOnly?referenceChanged:(ownership.identities||[]).includes(key)&&referenceChanged||!sameGraph(copy[key],after[key],new Map(),new Map(),checkpoint.originalOf,0)){
          var error=new Error('Generation stage '+stage.name+' changed unowned domain '+key+'.');error.code='GENERATION_OWNERSHIP_FAILED';throw error;
        }
      });
      Object.keys(append).forEach(function(key){
        var prior=append[key],current=after[key],rule=stage.appends[key],count=current&&current.length-prior.values.length;
        if(current!==prior.array||!Array.isArray(current)||count<rule.min||count>rule.max||prior.values.some(function(value,i){return current[i]!==value;})||
          !sameGraph(prior.copy,current.slice(0,prior.values.length),new Map(),new Map(),prior.originalOf,0)){
          var error=new Error('Generation stage '+stage.name+' violated append-only domain '+key+'.');error.code='GENERATION_OWNERSHIP_FAILED';throw error;
        }
        added[key]=current.slice(prior.values.length);
      });
      if(stage.validate)stage.validate(added);
    };
  }
  function create(config){
    var layoutStages=config.layoutStages.slice(),finishStages=config.finishStages.slice();
    var names=new Set();
    layoutStages.concat(finishStages).forEach(function(stage){
      if(!stage.name||typeof stage.run!=='function'||names.has(stage.name))throw new Error('Invalid or duplicate generation stage: '+stage.name);
      names.add(stage.name);
    });
    function runStages(stages,seed){for(var i=0;i<stages.length;i++){
      var stage=stages[i],check=config.ownership?stageCheckpoint(config.ownership,stage):null;
      stage.run(seed);if(check)check();
    }}
    function generate(seed){
      config.begin();
      try{
        var clock=config.clock();
        var accepted=false;
        for(var attempt=0;attempt<8;attempt++){
          if(config.attempt((seed+attempt*7919)>>>0)){
            config.commit(clock);
            accepted=true;
            break;
          }
        }
        if(!accepted)throw new Error('Floor generation exhausted all 8 layout attempts.');
        runStages(layoutStages,seed);
      }finally{config.end();}
      runStages(finishStages,seed);
    }
    return Object.freeze({generate:generate,stageNames:Object.freeze(Array.from(names))});
  }
  return Object.freeze({create:create,transaction:transaction,afterInstall:afterInstall,validateFloor:validateFloor,validateRequiredRoutes:validateRequiredRoutes,blockingPlants:blockingPlants});
});
