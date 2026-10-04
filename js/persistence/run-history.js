/* Finished runs are immutable local records, independent of live save slots. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.FoteRunHistory=api;
})(globalThis,function(){
  'use strict';
  var KEY='astra-temple-run-history',BACKUP=KEY+'-backup',VERSION=1,SCORE_VERSION=2;
  function count(value){return Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,Math.floor(Number(value)||0)));}
  function text(value){return typeof value==='string'?value:'';}
  function score(record){
    var parts={xp:count(record.xpGained),essence:count(record.essenceGained),turns:Math.max(1,count(record.turns)),depth:count(record.depth),level:count(record.level),faithRank:count(record.faithRank),multiplier:record.won?2:1};
    var total=((parts.xp+parts.essence)/parts.turns*parts.depth+parts.level+parts.faithRank)*parts.multiplier;
    return {version:SCORE_VERSION,total:Math.min(Number.MAX_SAFE_INTEGER,Math.round(total)),parts:parts};
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
    ['name','race','cls','who','god','faith','biome','finishedAt','buildVersion','cause'].forEach(function(k){r[k]=text(row[k]);});
    r.finishedAt=r.finishedAt||text(row.date);r.name=r.name||'Unknown adventurer';
    ['level','kills','turns','bosses','faithRank'].forEach(function(k){r[k]=count(row[k]);});
    var hasEarnings=Number.isFinite(row.xpGained)&&row.xpGained>=0&&Number.isFinite(row.essenceGained)&&row.essenceGained>=0;
    if(hasEarnings){r.xpGained=count(row.xpGained);r.essenceGained=count(row.essenceGained);}
    r.earningsEstimated=row.earningsEstimated===true;
    r.floor=count(row.floor);r.depth=Math.max(r.floor,count(row.depth));r.affinities=Array.isArray(row.affinities)?row.affinities.filter(function(a){return a&&typeof a.element==='string';}).map(function(a){return{element:a.element,rank:count(a.rank)};}):[];
    if(Array.isArray(row.gear))r.gear=row.gear.filter(function(g){return g&&typeof g.slot==='string'&&typeof g.name==='string';}).map(function(g){return {slot:g.slot,name:g.name};});
    else delete r.gear;
    if(Number.isFinite(row.score)&&row.score>=0){r.score=Math.floor(row.score);r.scoreVersion=count(row.scoreVersion);}
    else if(hasEarnings){var result=score(r);r.score=result.total;r.scoreVersion=result.version;r.scoreParts=result.parts;}
    else{r.score=0;r.scoreVersion=0;r.scoreUnavailable=true;delete r.scoreParts;}
    return r;
  }
  function damageCause(event){
    var tags=event.tags||new Set(),label={phys:'physical',dark:'shadow',ice:'frost'}[event.type]||event.type||'unknown';
    var causes={starvation:'Starvation',fall:'Falling into a chasm',drowning:'Drowning',sacrifice:'A blood sacrifice',spikes:'A spiked door',thorns:'Thorns',curse:'A cursed item',bleed:'Bleeding',burn:'Burning',poison:'Poison'};
    for(var key in causes)if(tags.has(key))return causes[key];
    var source=event.source&&typeof event.source==='object'?(event.source.name||event.source.base&&event.source.base.name):'';
    if(tags.has('reflected'))return 'Reflected '+label+' damage'+(source?' from '+source:'');
    if(source)return source+' ('+label+' damage)';
    return label.charAt(0).toUpperCase()+label.slice(1)+' damage';
  }
  function report(record){
    var r=normalize(record);if(!r)return '';
    function line(value){return String(value||'').replace(/[\r\n\t]+/g,' ');}
    function cap(value){value=line(value);return value?value.charAt(0).toUpperCase()+value.slice(1):'Not recorded';}
    var rows=['Forge of the Elements'+(r.buildVersion?' — '+line(r.buildVersion):'')+' — Run report',
      line(r.name)+' — '+(r.won?'Victory':'Fallen')+(r.sandbox?' (sandbox)':''),
      'Build: '+(line(r.who)||cap(r.race)+' '+cap(r.cls)),
      'Race: '+cap(r.race)+' | Class: '+cap(r.cls)+' | Level: '+r.level,
      'Affinities: '+(r.affinities.length?r.affinities.map(function(a){return cap(a.element)+' '+a.rank;}).join(', '):'None recorded'),
      'Patron: '+line(r.faith||r.god||'No patron')+(r.faithRank?' (rank '+r.faithRank+')':''),
      'Deepest floor: '+r.depth+' | Final floor: '+r.floor+(r.biome?' ('+line(r.biome)+')':''),
      'Kills: '+r.kills+' | Bosses: '+r.bosses+' | Turns: '+r.turns,
      'Score: '+(r.scoreUnavailable?'Not recorded':r.score)+(r.earningsEstimated?' (estimated)':'')];
    if(!r.won)rows.push('Cause of death: '+line(r.cause||'Not recorded'));
    rows.push('Gear:');
    if(!r.gear)rows.push('  Not recorded for this older run.');
    else if(!r.gear.length)rows.push('  None');
    else r.gear.forEach(function(g){rows.push('  '+line(g.slot)+': '+line(g.name));});
    if(r.finishedAt)rows.push('Finished: '+line(r.finishedAt));
    return rows.join('\n');
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
  function sort(rows){return rows.slice().sort(function(a,b){return Number(b.won)-Number(a.won)||Number(b.scoreVersion===SCORE_VERSION)-Number(a.scoreVersion===SCORE_VERSION)||b.scoreVersion-a.scoreVersion||b.score-a.score||String(b.finishedAt).localeCompare(String(a.finishedAt))||a.id.localeCompare(b.id);});}
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
  return Object.freeze({key:KEY,backupKey:BACKUP,version:VERSION,scoreVersion:SCORE_VERSION,score:score,normalize:normalize,decode:decode,sort:sort,createStore:createStore,report:report,damageCause:damageCause});
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
    var earnings=ensureRunEarnings(),depth=deepest(),record={id:runId(),name:player.name,who:player.who,race:player.race,cls:player.cls,level:player.level,floor:floorNo,depth:depth,
      xpGained:earnings.xp,essenceGained:earnings.essence,earningsEstimated:!!earnings.legacyBaseline,
      biome:biomeName(),kills:RUN.kills||0,turns:RUN.turns||0,bosses:bossCount(depth),god:player.god||'',faith:player.god&&GODS[player.god]?GODS[player.god].name:'No patron',faithRank:player.god?godRank():0,
      affinities:Object.keys(player.aff||{}).filter(function(el){return player.aff[el]>0;}).map(function(el){return{element:el,rank:player.aff[el]};}),
      gear:[['main','Main hand'],['off',player.twoHanded?'Off hand (stowed)':'Off hand'],['ranged','Ranged weapon'],['armor','Armor'],['ring0','Ring 1'],['ring1','Ring 2'],['amulet','Amulet']].map(function(pair){
        var item=typeof FoteInventory!=='undefined'?FoteInventory.slotItem(player,pair[0]):null;
        return item&&item.name&&item!==root.EMPTY_OFF?{slot:pair[1],name:typeof gearName==='function'?gearName(item):item.name}:null;
      }).filter(Boolean),
      cause:!won&&RUN.lastDamage&&RUN.lastDamage.lethal?RUN.lastDamage.cause:'',
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
    if(record.scoreUnavailable)return '<p class="run-note">This older record has no saved score or earnings totals.</p>';
    if(!p)return '<p class="run-note">No breakdown was saved for this score.</p>';
    if(record.scoreVersion===FoteRunHistory.scoreVersion){
      var rows=[['Total XP earned',p.xp],['Total essence earned',p.essence],['Turns',p.turns],['Deepest floor reached',p.depth],['Character level',p.level],['God rank',p.faithRank],['Victory multiplier','×'+p.multiplier]];
      return '<details class="run-breakdown"><summary>How this score was earned</summary><dl>'+rows.map(function(pair){return '<dt>'+pair[0]+'</dt><dd>'+(typeof pair[1]==='string'?escaped(pair[1]):number(pair[1]))+'</dd>';}).join('')+'</dl><p>Add the XP and essence you earned, divide by turns, multiply by the deepest floor, then add your level and god rank. A win doubles the total. Spending essence never lowers your score.</p>'+(record.earningsEstimated?'<p>This run started before the game kept track of earnings, so its early XP is an estimate and its early essence counts only what was left in the pouch.</p>':'')+'</details>';
    }
    if(record.scoreVersion!==1)return '<p class="run-note">Score recorded under different scoring rules.</p>';
    return '<details class="run-breakdown"><summary>How this score was earned</summary><dl>'+[['Depth reached',p.depth],['Character level',p.level],['Campaign bosses',p.bosses],['Enemies defeated',p.kills],['Victory',p.victory]].map(function(pair){return '<dt>'+pair[0]+'</dt><dd>'+number(pair[1])+'</dd>';}).join('')+'</dl><p>1,000 per floor reached · 100 per level · 2,500 per campaign boss · 5 per kill (first 500) · 25,000 for victory. Time does not affect your score.</p></details>';
  }
  function build(record){return escaped(record.who||[cap(record.race),cap(record.cls)].filter(Boolean).join(' '));}
  function openReport(record,origin){
    var returnToHistory=origin==='history-title'||origin==='history-end';
    function back(){if(returnToHistory)openHistory(origin==='history-end'?'end':'title');else{var button=document.getElementById('bReportEnd');if(button)button.focus();}}
    openModal('Run report','<p class="run-note">Copy this report to share your build and how the run ended.</p><textarea id="runReportText" class="run-report-text" readonly aria-label="Run report"></textarea><p id="runReportNotice" class="run-note" role="status" aria-live="polite"></p>',[
      {label:'Copy report',cls:'primary',fn:function(){
        var field=document.getElementById('runReportText'),notice=document.getElementById('runReportNotice');
        function select(){field.focus({preventScroll:true});field.select();field.setSelectionRange(0,field.value.length);}
        function copied(){notice.textContent='Report copied.';}
        function fallback(){select();notice.textContent='Copy unavailable. Text selected; use your device’s Copy command.';}
        // Embedded hosts may deny the Clipboard API. Copy the selected report
        // during the click, while browsers still grant a user gesture.
        select();
        try{if(document.execCommand&&document.execCommand('copy')){copied();return;}}catch(error){}
        if(!root.navigator||!navigator.clipboard||typeof navigator.clipboard.writeText!=='function'){fallback();return;}
        try{navigator.clipboard.writeText(field.value).then(copied,fallback);}catch(error){fallback();}
      }},
      {label:returnToHistory?'Back to Previous Runs':'Back to summary',fn:closeModal}
    ],'run-history-modal');
    document.getElementById('runReportText').value=FoteRunHistory.report(record);
    modalOnClose=back;
  }
  function openHistory(origin){
    var rows=store.read(),html='<p class="run-note">Victories lead the list. Runs scored under older rules come after current ones. Finished runs are kept in this browser; sandbox runs are left out.</p>';
    if(!rows.length)html+='<div class="run-empty"><b>Your story starts here.</b><p>Finish a run to earn a place in these records.</p></div>';
    else {
      var previousGroup=null,rank=0;
      rows.forEach(function(r,index){
        var current=r.scoreVersion===FoteRunHistory.scoreVersion,group=String(r.won)+'-'+r.scoreVersion,date=new Date(r.finishedAt),when=isNaN(date.getTime())?'':date.toLocaleDateString();
        if(group!==previousGroup){if(previousGroup!==null)html+='</ol>';rank=0;html+='<h3 class="run-group">'+(r.won?'Victories':'Other runs')+(current?'':' · earlier scoring')+'</h3><ol class="run-history">';previousGroup=group;}
        html+='<li class="run-entry'+(r.won?' winner':'')+'"><div class="run-entry-heading"><span class="run-rank">'+(++rank)+'</span><div><span class="run-outcome">'+(r.won?'Victory':'Fallen')+'</span><strong>'+escaped(r.name)+'</strong><span class="run-build">'+build(r)+'</span></div><b class="run-points">'+(r.scoreUnavailable?'Unknown':number(r.score))+'<small>'+(current?(r.earningsEstimated?'estimated score':'score'):'earlier score')+'</small></b></div><p>Level '+r.level+' · deepest floor '+r.depth+' · '+number(r.kills)+' kills · '+number(r.turns)+' turns</p><p>'+escaped(r.faith||'No patron')+(r.faithRank?' · rank '+r.faithRank:'')+(when?' · '+escaped(when):'')+'</p>'+breakdown(r)+'<button class="run-report-button" data-run-report="'+index+'">Run report</button></li>';
      });html+='</ol>';
    }
    openModal('Previous Runs',html,[{label:origin==='end'?'Back to summary':'Back to title',fn:closeModal}],'run-history-modal');
    document.querySelectorAll('[data-run-report]').forEach(function(button){button.onclick=function(){openReport(rows[Number(button.getAttribute('data-run-report'))],origin==='end'?'history-end':'history-title');};});
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
    '.run-group{margin:22px 0 8px;color:var(--gold);font-size:16px}.run-group+.run-history{margin-top:0}',
    '.run-history{list-style:none;margin:14px 0 0;padding:0;display:flex;flex-direction:column;gap:12px}.run-entry{border:1px solid var(--edge);border-radius:6px;padding:14px;background:#14110e}.run-entry.winner{border-color:#8b6c35;background:linear-gradient(120deg,#2a2112,#14110e)}',
    '.run-entry-heading{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:10px;align-items:center}.run-rank{color:var(--dim)}.run-outcome{display:block;text-transform:uppercase;font-size:10px;letter-spacing:.12em;color:var(--ash)}.winner .run-outcome{color:var(--gold)}.run-entry strong{display:block;color:var(--ink);font-family:var(--display);font-size:22px;overflow-wrap:anywhere}.run-build{display:block;font-size:11px;color:var(--ash)}',
    '.run-points{color:var(--gold);font-size:21px;text-align:right}.run-points small{display:block;color:var(--dim);font-size:10px;font-weight:normal}.run-entry p{font-size:11px;line-height:1.6;color:var(--ash);margin:10px 0 0}',
    '.run-breakdown{font-size:11px;color:var(--ash);text-align:left;margin-top:12px}.run-breakdown summary{cursor:pointer;min-height:28px;display:list-item;align-content:center}.run-breakdown dl{display:grid;grid-template-columns:1fr auto;gap:5px;margin:8px 0}.run-breakdown dd{margin:0;color:var(--ink)}.run-breakdown p{font-size:10px;line-height:1.6}',
    '#modal .mbox.run-history-modal{width:min(680px,calc(100vw - 24px))}',
    '.run-report-button{margin-top:12px;min-height:36px}.run-report-text{box-sizing:border-box;width:100%;height:clamp(130px,45vh,360px);resize:vertical;background:var(--panel,#181410);color:var(--ink);border:1px solid var(--edge);border-radius:4px;padding:10px;font:12px/1.6 var(--mono);white-space:pre-wrap;overflow-wrap:anywhere}',
    '@media(max-height:560px){#over.end-screen .box{padding:14px 20px}.end-score{font-size:42px;margin:8px 0}.end-stats{margin:10px 0}.end-story{margin:8px 0}}'
  ].join('\n');document.head.appendChild(style);
  root.finishRunHistory=finish;root.runEndRecord=summary;root.openRunHistory=openHistory;
  root.FoteRunHistoryUI=Object.freeze({escape:escaped,number:number,build:build,breakdown:breakdown,openReport:openReport});
  if(typeof FoteLifecycle!=='undefined')FoteLifecycle.whenReady(function(){
    gameDamage.on('damageApplied',function(event){if(RUN&&event.target===player&&event.damage>0)RUN.lastDamage={cause:FoteRunHistory.damageCause(event),lethal:player.hp<=0};});
  });
})(globalThis);
