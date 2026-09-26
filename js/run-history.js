/* Finished runs are immutable local records, independent of live save slots. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.FoteRunHistory=api;
})(globalThis,function(){
  'use strict';
  var KEY='astra-temple-run-history',BACKUP=KEY+'-backup',VERSION=1;
  function count(value){return Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,Math.floor(Number(value)||0)));}
  function text(value){return typeof value==='string'?value:'';}
  function score(record){
    var parts={depth:count(record.depth)*1000,level:count(record.level)*100,bosses:count(record.bosses)*2500,kills:Math.min(500,count(record.kills))*5,victory:record.won?25000:0};
    return {version:1,total:Object.keys(parts).reduce(function(n,key){return n+parts[key];},0),parts:parts};
  }
  function legacyId(row){
    var source=JSON.stringify([row.name,row.race,row.cls,row.finishedAt||row.date,row.floor,row.level,row.turns,row.kills,row.score,row.won||row.victory]),hash=2166136261;
    for(var i=0;i<source.length;i++)hash=Math.imul(hash^source.charCodeAt(i),16777619);
    return 'legacy-'+(hash>>>0).toString(36);
  }
  function normalize(row){
    if(!row||typeof row!=='object'||Array.isArray(row))return null;
    var r=Object.assign({},row);
    r.id=text(row.id)||text(row.runId)||legacyId(row);r.won=row.won===true||row.victory===true||row.outcome==='victory';
    ['name','race','cls','who','god','faith','biome','finishedAt','buildVersion'].forEach(function(k){r[k]=text(row[k]);});
    r.finishedAt=r.finishedAt||text(row.date);r.name=r.name||'Unknown adventurer';
    ['level','kills','turns','bosses','faithRank'].forEach(function(k){r[k]=count(row[k]);});
    r.floor=count(row.floor);r.depth=Math.max(r.floor,count(row.depth));r.affinities=Array.isArray(row.affinities)?row.affinities.filter(function(a){return a&&typeof a.element==='string';}).map(function(a){return{element:a.element,rank:count(a.rank)};}):[];
    if(Number.isFinite(row.score)&&row.score>=0){r.score=Math.floor(row.score);r.scoreVersion=count(row.scoreVersion);}
    else{var result=score(r);r.score=result.total;r.scoreVersion=result.version;r.scoreParts=result.parts;}
    return r;
  }
  function decode(raw){
    if(!raw)return [];
    var doc=JSON.parse(raw),rows=Array.isArray(doc)?doc:doc&&doc.records;
    if(!Array.isArray(rows)||!Array.isArray(doc)&&doc.version!==undefined&&doc.version!==VERSION)throw Error('Unsupported run history format.');
    return rows.map(normalize).filter(Boolean);
  }
  function merge(){
    var byId=new Map();
    Array.prototype.slice.call(arguments).forEach(function(rows){(rows||[]).forEach(function(r){if(r&&!byId.has(r.id))byId.set(r.id,r);});});
    return Array.from(byId.values());
  }
  function sort(rows){return rows.slice().sort(function(a,b){return Number(b.won)-Number(a.won)||b.score-a.score||String(b.finishedAt).localeCompare(String(a.finishedAt))||a.id.localeCompare(b.id);});}
  function createStore(storage){
    var memory=[],persisted=false,blocked=false;
    function read(){
      var lists=[];blocked=false;
      [KEY,BACKUP].forEach(function(key){try{var raw=storage.getItem(key);if(raw)lists.push(decode(raw));}catch(e){if(e.message==='Unsupported run history format.')blocked=true;}});
      memory=merge.apply(null,lists.concat([memory]));return sort(memory);
    }
    function persist(){
      if(blocked){persisted=false;return false;}
      var raw=JSON.stringify({version:VERSION,records:memory}),saved=false;
      [KEY,BACKUP].forEach(function(key){try{storage.setItem(key,raw);saved=true;}catch(e){}});
      persisted=saved;return saved;
    }
    return {
      read:read,
      add:function(record){read();var found=memory.find(function(r){return r.id===record.id;});if(!found){found=normalize(record);memory.push(found);}persist();return {record:found,saved:persisted};},
      persisted:function(){return persisted;}
    };
  }
  return Object.freeze({key:KEY,backupKey:BACKUP,version:VERSION,score:score,normalize:normalize,decode:decode,sort:sort,createStore:createStore});
});

(function(root){
  if(typeof document==='undefined')return;
  var store=FoteRunHistory.createStore({getItem:function(key){return localStorage.getItem(key);},setItem:function(key,value){localStorage.setItem(key,value);}});
  function escaped(value){return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});}
  function number(value){return Number(value||0).toLocaleString();}
  function deepest(){
    var depth=floorNo;
    Object.keys(RUN.floorStash||{}).forEach(function(key){var n=Number(key);if(Number.isInteger(n)&&n>=1&&n<=LAST_FLOOR)depth=Math.max(depth,n);});
    return Math.min(LAST_FLOOR,Math.max(depth,RUN.deepestFloor||0));
  }
  function bossCount(depth){
    var defeated=new Set();
    for(var n=5;n<=20;n+=5)if(depth>n)defeated.add(n);
    function inspect(n,meta){if(meta&&!meta.plane&&(meta.bossRewarded||meta.caveWon||meta.matron&&meta.matron.phase==='dead')&&[5,10,15,20].indexOf(n)>=0)defeated.add(n);if(meta&&meta.unmakerEncounter&&['defeated','victory'].indexOf(meta.unmakerEncounter.status)>=0)defeated.add(25);}
    inspect(floorNo,floorMeta);Object.keys(RUN.floorStash||{}).forEach(function(key){inspect(Number(key),RUN.floorStash[key].floorMeta);});
    return defeated.size;
  }
  function snapshot(won){
    var depth=deepest(),record={id:runId(),name:player.name,who:player.who,race:player.race,cls:player.cls,level:player.level,floor:floorNo,depth:depth,
      biome:biomeName(),kills:RUN.kills||0,turns:RUN.turns||0,bosses:bossCount(depth),god:player.god||'',faith:player.god&&GODS[player.god]?GODS[player.god].name:'No patron',faithRank:player.god?godRank():0,
      affinities:Object.keys(player.aff||{}).filter(function(el){return player.aff[el]>0;}).map(function(el){return{element:el,rank:player.aff[el]};}),
      won:!!won,finishedAt:new Date().toISOString(),buildVersion:typeof FOTE_VERSION==='undefined'?'':FOTE_VERSION,sandbox:!!RUN.sandbox};
    var result=FoteRunHistory.score(record);record.score=result.total;record.scoreVersion=result.version;record.scoreParts=result.parts;return record;
  }
  function finish(won){
    if(!RUN||!player)return null;
    var record=RUN.finishedRecord||snapshot(won);
    if(RUN.sandbox){RUN.finishedRecord=record;return record;}
    var result=store.add(record);RUN.finishedRecord=result.record;RUN.historySaved=result.saved;return result.record;
  }
  function summary(won){return RUN.finishedRecord||snapshot(won);}
  function breakdown(record){
    var p=record.scoreParts;
    if(!p)return '<p class="run-note">Score recorded under an earlier scoring version.</p>';
    return '<details class="run-breakdown"><summary>How this score was earned</summary><dl>'+[['Depth reached',p.depth],['Character level',p.level],['Campaign bosses',p.bosses],['Enemies defeated',p.kills],['Victory',p.victory]].map(function(pair){return '<dt>'+pair[0]+'</dt><dd>'+number(pair[1])+'</dd>';}).join('')+'</dl><p>1,000 per floor reached · 100 per level · 2,500 per campaign boss · 5 per kill (first 500) · 25,000 for victory. Time does not affect your score.</p></details>';
  }
  function build(record){return escaped(record.who||[cap(record.race),cap(record.cls)].filter(Boolean).join(' '));}
  function openHistory(origin){
    var rows=store.read(),html='<p class="run-note">Victories lead the list, then score. Finished runs are kept in this browser; sandbox runs are excluded.</p>';
    if(!rows.length)html+='<div class="run-empty"><b>Your story starts here.</b><p>Finish a run to earn a place in these records.</p></div>';
    else html+='<ol class="run-history">'+rows.map(function(r,i){var date=new Date(r.finishedAt),when=isNaN(date.getTime())?'':date.toLocaleDateString();return '<li class="run-entry'+(r.won?' winner':'')+'"><div class="run-entry-heading"><span class="run-rank">'+(i+1)+'</span><div><span class="run-outcome">'+(r.won?'Victory':'Fallen')+'</span><strong>'+escaped(r.name)+'</strong><span class="run-build">'+build(r)+'</span></div><b class="run-points">'+number(r.score)+'<small>score</small></b></div><p>Level '+r.level+' · deepest floor '+r.depth+' · '+number(r.kills)+' kills · '+number(r.turns)+' turns</p><p>'+escaped(r.faith||'No patron')+(r.faithRank?' · rank '+r.faithRank:'')+(when?' · '+escaped(when):'')+'</p>'+breakdown(r)+'</li>';}).join('')+'</ol>';
    openModal('Previous Runs',html,[{label:origin==='end'?'Back to summary':'Back to title',fn:closeModal}],'run-history-modal');
    modalOnClose=function(){var button=document.getElementById(origin==='end'?'bHistoryEnd':'tHistory');if(button)button.focus();};
  }
  var style=document.createElement('style');style.textContent=[
    '#over.end-screen{position:fixed;inset:0;z-index:80;padding:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));overflow:auto;background:radial-gradient(ellipse at 50% 22%,rgba(83,60,28,.65),rgba(10,8,7,.96) 65%);box-sizing:border-box}',
    '#over.end-screen .box{width:min(690px,100%);max-height:100%;overflow:auto;box-sizing:border-box;padding:clamp(16px,3vw,30px);border:1px solid #6a5031;border-radius:10px;background:linear-gradient(155deg,#251b13,#100e0c);box-shadow:0 12px 65px #0008}',
    '#over.end-screen h2{color:var(--gold);font-size:clamp(24px,4vw,36px);line-height:1.15;margin:8px 0 12px}',
    '.end-elements{display:flex;justify-content:center;gap:12px;margin:0 0 8px}.end-elements span{width:10px;height:10px;border-radius:50%;background:var(--element);box-shadow:0 0 14px var(--element)}',
    '.end-name{font-family:var(--display);font-size:24px;color:var(--ink)}.end-story{line-height:1.55;color:var(--ash);font-size:13px;margin:12px 0}',
    '.end-score{display:block;font-family:var(--display);font-size:clamp(45px,8vw,70px);line-height:1.15;color:var(--gold);margin:14px 0}.end-score small{display:block;font:11px var(--mono);text-transform:uppercase;letter-spacing:.2em;color:var(--ash)}',
    '.end-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:16px 0}.end-stats span{display:flex;flex-direction:column;gap:5px;padding:9px 5px;border:1px solid var(--edge);border-radius:5px;background:#0d0b09}.end-stats small{color:var(--ash);font-size:10px;text-transform:uppercase}.end-stats b{color:var(--ink);font-size:15px}',
    '.end-affinities{font-size:12px;line-height:1.7;color:var(--ash);margin:8px 0 12px}.end-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:16px}.end-actions button{min-height:44px;margin:0!important}',
    '.run-note{color:var(--ash);font-size:12px;line-height:1.55}.run-empty{text-align:center;padding:35px 10px;color:var(--gold)}.run-empty p{color:var(--ash)}',
    '.run-history{list-style:none;margin:14px 0 0;padding:0;display:flex;flex-direction:column;gap:12px}.run-entry{border:1px solid var(--edge);border-radius:6px;padding:14px;background:#14110e}.run-entry.winner{border-color:#8b6c35;background:linear-gradient(120deg,#2a2112,#14110e)}',
    '.run-entry-heading{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:10px;align-items:center}.run-rank{color:var(--dim)}.run-outcome{display:block;text-transform:uppercase;font-size:10px;letter-spacing:.12em;color:var(--ash)}.winner .run-outcome{color:var(--gold)}.run-entry strong{display:block;color:var(--ink);font-family:var(--display);font-size:22px;overflow-wrap:anywhere}.run-build{display:block;font-size:11px;color:var(--ash)}',
    '.run-points{color:var(--gold);font-size:21px;text-align:right}.run-points small{display:block;color:var(--dim);font-size:10px;font-weight:normal}.run-entry p{font-size:11px;line-height:1.6;color:var(--ash);margin:10px 0 0}',
    '.run-breakdown{font-size:11px;color:var(--ash);text-align:left;margin-top:12px}.run-breakdown summary{cursor:pointer;min-height:28px;display:list-item;align-content:center}.run-breakdown dl{display:grid;grid-template-columns:1fr auto;gap:5px;margin:8px 0}.run-breakdown dd{margin:0;color:var(--ink)}.run-breakdown p{font-size:10px;line-height:1.6}',
    '#modal .mbox.run-history-modal{width:min(680px,calc(100vw - 24px))}',
    '@media(max-height:560px){#over.end-screen .box{padding:14px 20px}.end-score{font-size:42px;margin:8px 0}.end-stats{margin:10px 0}.end-story{margin:8px 0}}'
  ].join('\n');document.head.appendChild(style);
  root.finishRunHistory=finish;root.runEndRecord=summary;root.openRunHistory=openHistory;
  root.FoteRunHistoryUI=Object.freeze({escape:escaped,number:number,build:build,breakdown:breakdown});
})(globalThis);
