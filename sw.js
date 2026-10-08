/* Network-first browser cache plus complete installed-game revision snapshots.
 * js/platform/offline.js stages and commits snapshots through one scoped pointer.
 * Requests used to verify a snapshot never fall back to cached bytes. */
var CACHE='astra-temple-v2';
var SCOPE=new URL('./',location.href).href;
var POINTER=new URL('__fote_offline_revision__',SCOPE).href;
var BUILD_PREFIX=new URL('__fote_offline_build__/',SCOPE).href;
var STAGE_PREFIX=new URL('__fote_offline_stage__/',SCOPE).href;
var COMMIT_QUEUE=Promise.resolve();
var CLIENT_PREFIX=new URL('__fote_offline_client__/',SCOPE).href;
function key(url){var u=new URL(url,location.href);u.search='';u.hash='';return u.toString();}
function unavailable(){return new Response('offline',{status:503,headers:{'Content-Type':'text/plain'}});}
async function rememberClient(id,record){
  if(!id||!record||typeof record.built!=='string')return;
  var cache=await caches.open(CACHE),address=CLIENT_PREFIX+encodeURIComponent(id),old=await cache.match(address);
  var prior=old&&await old.json();
  // Navigation knows the shell's actual stamp; the page adds installed mode.
  if(record.installed===undefined&&prior)record.installed=prior.installed;
  await cache.put(address,new Response(JSON.stringify(record),{headers:{'Content-Type':'application/json'}}));
}
async function rememberNavigation(ev,response){
  if(ev.request.mode!=='navigate'||!response||response.status!==200)return response;
  var text=await response.clone().text(),match=/<meta\s+name=["']fote-build["']\s+content=["']([^"']+)["']/.exec(text);
  if(match)await rememberClient(ev.resultingClientId||ev.clientId,{built:match[1]});
  return response;
}
self.addEventListener('install',function(){self.skipWaiting();});
self.addEventListener('activate',function(ev){
  ev.waitUntil(caches.keys().then(function(names){
    // Revision snapshots have their own scoped lifecycle. Preserve them across
    // worker updates; only the obsolete pre-snapshot caches retire here.
    return Promise.all(names.filter(function(name){return /^astra-temple-v\d+$/.test(name)&&name!==CACHE;}).map(function(name){return caches.delete(name);}));
  }).then(function(){return self.clients.claim();}));
});
async function commitRevision(record,clientId){
  var prefix='astra-temple-revision-'+encodeURIComponent(SCOPE)+'-';
  if(!record||typeof record.built!=='string'||!Number.isFinite(Date.parse(record.built))||typeof record.cache!=='string'||record.cache.indexOf(prefix)!==0)throw new Error('Invalid revision');
  var cache=await caches.open(CACHE),client=await cache.match(CLIENT_PREFIX+encodeURIComponent(clientId));
  if(!client||(await client.json()).built!==record.built)throw new Error('Client revision changed');
  var snapshot=await caches.open(record.cache),receipt=await snapshot.match(new URL('__fote_offline_complete__',SCOPE).href);
  if(!receipt||(await receipt.json()).built!==record.built)throw new Error('Incomplete revision');
  var files=JSON.parse(record.files);if(!Array.isArray(files)||!files.includes('index.html'))throw new Error('Invalid files');
  for(var file of files)if(new URL(file,SCOPE).href.indexOf(SCOPE)!==0||!(await snapshot.match(key(file))))throw new Error('Missing revision file');
  var activeReply=await cache.match(POINTER),active=activeReply&&await activeReply.json();
  var oldReply=await cache.match(BUILD_PREFIX+encodeURIComponent(record.built)),old=oldReply&&await oldReply.json();
  await cache.put(BUILD_PREFIX+encodeURIComponent(record.built),new Response(JSON.stringify(record)));
  if(!active||Date.parse(record.built)>=Date.parse(active.built)){
    var selected=Object.assign({},record,{previousBuilt:active&&active.built!==record.built?active.built:active&&active.previousBuilt});
    await cache.put(POINTER,new Response(JSON.stringify(selected)));active=selected;
  }
  // Commits are serialized in this worker. Pending staging attempts have no
  // build-index entry and are never swept by another tab's commit.
  var keep=new Set([active.built,active.previousBuilt,record.built]);
  if(self.clients.matchAll){
    var clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(var live of clients){var saved=await cache.match(CLIENT_PREFIX+encodeURIComponent(live.id));if(saved)keep.add((await saved.json()).built);}
  }
  for(var request of await cache.keys())if(request.url.indexOf(BUILD_PREFIX)===0){
    var prior=await(await cache.match(request.url)).json();
    if(!keep.has(prior.built)){await caches.delete(prior.cache);await cache.delete(request.url);}
  }
  if(old&&old.cache!==record.cache)await caches.delete(old.cache);
}
async function discardStage(record,clientId){
  if(!record||typeof record.cache!=='string')return false;
  var cache=await caches.open(CACHE),address=STAGE_PREFIX+encodeURIComponent(record.cache),entry=await cache.match(address),stage=entry&&await entry.json();
  if(!stage||stage.clientId!==clientId||stage.cache.indexOf('astra-temple-revision-'+encodeURIComponent(SCOPE)+'-')!==0)return false;
  // A failed acknowledgement can follow a successful index/pointer write. Never
  // delete a referenced snapshot, even when its owner has since disappeared.
  for(var request of await cache.keys())if(request.url===POINTER||request.url.indexOf(BUILD_PREFIX)===0){
    var saved=await cache.match(request.url);if(saved&&(await saved.json()).cache===stage.cache){await cache.delete(address);return false;}
  }
  await caches.delete(stage.cache);await cache.delete(address);return true;
}
async function beginStage(record,clientId){
  var prefix='astra-temple-revision-'+encodeURIComponent(SCOPE)+'-';
  if(!record||typeof record.built!=='string'||typeof record.cache!=='string'||record.cache.indexOf(prefix)!==0)throw new Error('Invalid stage');
  var cache=await caches.open(CACHE);
  // Liveness is authoritative: a slow live tab keeps its stage. Bound removals
  // per attempt and leave untracked/other-scope caches alone.
  if(self.clients.matchAll){
    var live=new Set((await self.clients.matchAll({type:'window',includeUncontrolled:true})).map(function(client){return client.id;})),removed=0;
    for(var request of await cache.keys())if(request.url.indexOf(STAGE_PREFIX)===0&&removed<8){
      var entry=await cache.match(request.url),stage=entry&&await entry.json();
      if(stage&&!live.has(stage.clientId)&&await discardStage(stage,stage.clientId))removed++;
    }
  }
  var address=STAGE_PREFIX+encodeURIComponent(record.cache);
  if(await cache.match(address)||(await caches.keys()).includes(record.cache))throw new Error('Stage already exists');
  await cache.put(address,new Response(JSON.stringify({built:record.built,cache:record.cache,clientId:clientId})));
}
self.addEventListener('message',function(ev){
  var data=ev.data;if(!data||!ev.source||!ev.source.id)return;
  if(data.type==='fote-offline-client'&&typeof data.built==='string')
    ev.waitUntil(rememberClient(ev.source.id,{built:data.built,installed:data.installed===true}));
  if(['fote-offline-stage','fote-offline-abort','fote-offline-commit'].includes(data.type)){
    var reply=ev.ports&&ev.ports[0];
    COMMIT_QUEUE=COMMIT_QUEUE.catch(function(){}).then(async function(){
      try{
        if(data.type==='fote-offline-stage')await beginStage(data.record,ev.source.id);
        else if(data.type==='fote-offline-abort')await discardStage(data.record,ev.source.id);
        else{
          await commitRevision(data.record,ev.source.id);
          await(await caches.open(CACHE)).delete(STAGE_PREFIX+encodeURIComponent(data.record.cache));
        }
        if(reply)reply.postMessage({ok:true});
      }catch(error){
        var discarded=false;
        if(data.type==='fote-offline-commit')try{discarded=await discardStage(data.record,ev.source.id);}catch(ignore){}
        if(reply)reply.postMessage({ok:false,rejected:discarded});
      }
    });
    ev.waitUntil(COMMIT_QUEUE);
  }
});
async function snapshotFor(cache,built){
  if(!built)return null;
  var entry=await cache.match(BUILD_PREFIX+encodeURIComponent(built)),record=entry&&await entry.json();
  var prefix='astra-temple-revision-'+encodeURIComponent(SCOPE)+'-';
  if(!record||typeof record.cache!=='string'||record.cache.indexOf(prefix)!==0)return null;
  var snapshot=await caches.open(record.cache),receipt=await snapshot.match(new URL('__fote_offline_complete__',SCOPE).href);
  return receipt&&(await receipt.json()).built===built?snapshot:null;
}
async function clientRecord(cache,id){var response=id&&await cache.match(CLIENT_PREFIX+encodeURIComponent(id));return response&&await response.json();}
async function fallback(ev){
  var req=ev.request,cache=await caches.open(CACHE),pointer=await cache.match(POINTER),active=pointer&&await pointer.json();
  var client=await clientRecord(cache,ev.clientId),built=req.mode==='navigate'?active&&active.built:client&&client.built;
  var snapshot=await snapshotFor(cache,built);
  if(snapshot){
    var hit=await snapshot.match(key(req.url));if(!hit&&req.mode==='navigate')hit=await snapshot.match(key('index.html'));
    if(hit)return rememberNavigation(ev,hit);
  }
  // A claimed legacy client has no trustworthy loaded-build identity. It must
  // reload a complete shell before borrowing any active revision's assets.
  if(active&&(!client||req.mode==='navigate')||client&&client.installed)return unavailable();
  var hit=await cache.match(key(req.url));if(!hit&&req.mode==='navigate')hit=await cache.match(key('index.html'));
  return hit?rememberNavigation(ev,hit):unavailable();
}
self.addEventListener('fetch',function(ev){
  var req=ev.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==location.origin)return;
  var verification=url.searchParams.get('fote-offline-verify');
  if(verification!==null){
    // The response marker also makes an old controlling worker fail closed:
    // offline.js will not accept its unmarked cached response as verification.
    ev.respondWith(fetch(req,{cache:'no-store'}).then(function(res){
      if(!res||res.status!==200)return res||unavailable();
      var headers=new Headers(res.headers);headers.set('X-Fote-Offline-Verified',verification);
      return new Response(res.body,{status:res.status,statusText:res.statusText,headers:headers});
    }).catch(unavailable));return;
  }
  if(url.pathname===new URL('build.json',location.href).pathname){
    ev.respondWith(fetch(req,{cache:'no-store'}).catch(unavailable));return;
  }
  ev.respondWith((async function(){
    try{
      if(req.mode!=='navigate'){
        var control=await caches.open(CACHE),client=await clientRecord(control,ev.clientId);
        if(client&&client.installed){
          var snapshot=await snapshotFor(control,client.built),pinned=snapshot&&await snapshot.match(key(req.url));
          if(pinned)return pinned;
        }
      }
      var res=req.mode==='navigate'?await fetch(req.url,{cache:'no-store',credentials:'same-origin'}):await fetch(req,{cache:'no-cache'});
      if(res&&res.status===200){
        var copy=res.clone();ev.waitUntil(caches.open(CACHE).then(function(cache){return cache.put(key(req.url),copy);}));
        return rememberNavigation(ev,res);
      }
      return res;
    }catch(e){return fallback(ev);}
  })());
});
