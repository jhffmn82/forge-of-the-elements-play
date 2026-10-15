;
/* js/persistence/journal.js */
/* Discoveries and achievements belong to this browser, independently of saves. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.FoteJournal=api;
})(globalThis,function(){
  'use strict';
  var KEY='astra-temple-journal',BACKUP=KEY+'-backup',VERSION=1;
  var COUNTS=['highestDepth','maxLevel'],RANKS=['paths','godRanks'];
  var DISCOVERIES=['bosses','godAbilities','combos','enchantments','rings','amulets','sigils','enemies','planes','wins','raceWins'];
  var MAPS=RANKS.concat(DISCOVERIES);
  var RACES=['human','elf','dwarf','fae','gloomling'];
  function raceId(value){return RACES.indexOf(value)>=0?value:'';}
  function count(value){var n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,Math.floor(n))):0;}
  function validKey(value){return typeof value==='string'&&value.length>0&&value.length<=160&&value!=='__proto__'&&value!=='constructor'&&value!=='prototype';}
  function empty(){
    var data={version:VERSION,highestDepth:0,maxLevel:0};
    MAPS.forEach(function(category){data[category]={};});data.completedRuns={};return data;
  }
  function mergeInto(target,source){
    var changed=false;if(!source||typeof source!=='object'||Array.isArray(source))return changed;
    COUNTS.forEach(function(category){var value=count(source[category]);if(value>target[category]){target[category]=value;changed=true;}});
    MAPS.forEach(function(category){
      var values=source[category];if(!values||typeof values!=='object'||Array.isArray(values))return;
      Object.keys(values).forEach(function(key){
        if(!validKey(key))return;
        if(RANKS.indexOf(category)>=0){var n=count(values[key]);if(n>count(target[category][key])){target[category][key]=n;changed=true;}}
        else if(values[key]===true&&target[category][key]!==true){target[category][key]=true;changed=true;}
      });
    });
    var runs=source.completedRuns;
    if(runs&&typeof runs==='object'&&!Array.isArray(runs))Object.keys(runs).forEach(function(id){
      var row=runs[id];if(!validKey(id)||!row||typeof row.won!=='boolean')return;
      var record={won:row.won,cls:validKey(row.cls)?row.cls:'',race:raceId(row.race)};
      if(!Object.prototype.hasOwnProperty.call(target.completedRuns,id)){target.completedRuns[id]=record;changed=true;}
      else{
        var prior=target.completedRuns[id];
        if(!prior.race&&record.race&&prior.won===record.won&&(!prior.cls||!record.cls||prior.cls===record.cls)){prior.race=record.race;changed=true;}
      }
    });return changed;
  }
  function snapshot(data){var copy=empty();mergeInto(copy,data);return copy;}
  function same(a,b){
    var ids=Object.keys(a.completedRuns);
    return ids.length===Object.keys(b.completedRuns).length&&ids.every(function(id){var row=b.completedRuns[id];return row&&row.won===a.completedRuns[id].won&&row.cls===a.completedRuns[id].cls&&row.race===a.completedRuns[id].race;})&&COUNTS.every(function(k){return a[k]===b[k];})&&MAPS.every(function(k){
      var keys=Object.keys(a[k]);return keys.length===Object.keys(b[k]).length&&keys.every(function(id){return a[k][id]===b[k][id];});
    });
  }
  function createStore(storage,options){
    options=options||{};
    var memory=empty(),dirty=false,saved=false,blocked=false,timer=null;
    function refresh(shouldSchedule){
      var documents=[],readable=false,merged=empty();blocked=false;
      [KEY,BACKUP].forEach(function(key){
        try{
          var raw=storage.getItem(key);readable=true;if(!raw)return;
          var doc=JSON.parse(raw);
          if(!doc||typeof doc!=='object'||Array.isArray(doc))return;
          if(doc.version!==VERSION){if(doc.version!==undefined)blocked=true;return;}
          var normalized=snapshot(doc);documents.push(normalized);mergeInto(merged,normalized);
        }catch(e){/* A damaged or inaccessible copy must not discard discoveries. */}
      });
      /* Finished runs are immutable: a stored outcome takes priority over a
         repeated finish of the same run from another tab or an earlier save. */
      mergeInto(merged,memory);memory=merged;
      var complete=documents.some(function(doc){return same(doc,memory);});
      saved=!blocked&&(complete||readable&&!documents.length&&same(memory,empty()));
      dirty=!saved&&!same(memory,empty());
      if(dirty&&!blocked&&shouldSchedule)schedule();
      return snapshot(memory);
    }
    function schedule(){
      if(timer!==null||typeof options.setTimeout!=='function')return;
      timer=options.setTimeout(function(){timer=null;flush();},options.delay===undefined?250:options.delay);
    }
    function change(category,key,value){
      if(COUNTS.indexOf(category)>=0){var n=count(value);if(n<=memory[category])return false;memory[category]=n;}
      else if(MAPS.indexOf(category)>=0&&validKey(key)){
        if(RANKS.indexOf(category)>=0){var rank=count(value);if(rank<=count(memory[category][key]))return false;memory[category][key]=rank;}
        else{if(value!==true||memory[category][key]===true)return false;memory[category][key]=true;}
      }else return false;
      dirty=true;saved=false;return true;
    }
    function record(category,key,value){
      var changed=change(category,key,value===undefined?true:value);if(changed)schedule();return changed;
    }
    function finish(row){
        if(!row||typeof row!=='object'||row.sandbox)return false;
        var changed=false;
        function add(category,key,value){if(change(category,key,value))changed=true;}
        add('highestDepth',null,Math.max(count(row.depth),count(row.floor)));
        add('maxLevel',null,row.level);
        var affinities={};
        (Array.isArray(row.affinities)?row.affinities:[]).forEach(function(a){
          if(!a)return;add('paths',a.element,a.rank);
          if(ELEMENTS.indexOf(a.element)>=0)affinities[a.element]=Math.max(affinities[a.element]||0,count(a.rank));
        });
        /* Combinations unlock automatically. The same finished run must prove
           both ranks; account-wide path maxima may come from different runs. */
        ELEMENTS.forEach(function(primary){
          if(!(affinities[primary]>=3))return;
          ELEMENTS.forEach(function(secondary){
            if(secondary!==primary&&secondary!==OPPOSITE[primary]&&affinities[secondary]>=2)add('combos',primary+'/'+secondary,true);
          });
        });
        if(validKey(row.god))add('godRanks',row.god,row.faithRank);
        var won=row.won===true||row.victory===true||row.outcome==='victory',id=validKey(row.id)?row.id:row.runId;
        var existing=validKey(id)&&Object.prototype.hasOwnProperty.call(memory.completedRuns,id)?memory.completedRuns[id]:null;
        var race=raceId(row.race);
        if(existing){
          // Older journals omitted race. Matching history can fill that gap,
          // but replaying one run cannot credit another race or change its result.
          if(!existing.race&&race&&existing.won===won&&(!existing.cls||!row.cls||existing.cls===row.cls)){
            existing.race=race;dirty=true;saved=false;changed=true;
          }
          race=existing.race;
        }
        if(existing){won=existing.won;}
        var cls=existing?existing.cls:validKey(row.cls)?row.cls:'';
        if(won)add('wins',cls||'unknown',true);
        if(won&&race)add('raceWins',race,true);
        if(validKey(id)&&!Object.prototype.hasOwnProperty.call(memory.completedRuns,id)){
          memory.completedRuns[id]={won:won,cls:cls,race:race};dirty=true;saved=false;changed=true;
        }
        return changed;
    }
    function finishRun(row){refresh(false);var changed=finish(row);if(changed)schedule();return changed;}
    function importHistory(rows){
      refresh(false);
      var changed=false;
      (Array.isArray(rows)?rows:[]).forEach(function(row){
        if(finish(row))changed=true;
      });
      if(changed)schedule();return changed;
    }
    function flush(){
      if(timer!==null){if(typeof options.clearTimeout==='function')options.clearTimeout(timer);timer=null;}
      refresh(false);
      if(blocked){saved=false;return false;}
      if(!dirty)return saved;
      var raw=JSON.stringify(memory);saved=false;
      [KEY,BACKUP].forEach(function(key){try{storage.setItem(key,raw);saved=true;}catch(e){/* Retain memory and retry at the next save boundary. */}});
      dirty=!saved;return saved;
    }
    refresh(true);
    return Object.freeze({read:function(){return refresh(true);},record:record,finishRun:finishRun,importHistory:importHistory,flush:flush,persisted:function(){return saved;}});
  }
  var DEFINITIONS=[];
  function achievement(id,title,description,category,target,key,previous){DEFINITIONS.push({id:id,title:title,description:description,category:category,target:target,key:key||null,previous:previous||null});}
  var DEPTH_TITLES=['The Scenic Route Is Down','Well Below Expectations','No Ground Floor','A Long Way from Lunch','Rock Bottom, Professionally'];
  [5,10,15,20,25].forEach(function(depth,index,tiers){achievement('depth-'+depth,DEPTH_TITLES[index],'Reach dungeon floor '+depth+' in any run.','highestDepth',depth,null,index?'depth-'+tiers[index-1]:null);});
  var LEVEL_TITLES=['Qualified to Worry','A Veteran of Bad Decisions','An Occupational Hazard'];
  [5,10,20].forEach(function(level,index,tiers){achievement('level-'+level,LEVEL_TITLES[index],'Reach character level '+level+' in any run.','maxLevel',level,null,index?'level-'+tiers[index-1]:null);});
  var DEATH_TITLES=['A Short Career in Heroics','Frequent Dier Miles','Death Knows Your Order'];
  [10,50,100].forEach(function(total,index,tiers){achievement('deaths-'+total,DEATH_TITLES[index],'Die in '+total+' different runs. Each run counts once.','deaths',total,null,index?'deaths-'+tiers[index-1]:null);});
  /* 2026-10-12 (launch audit): each name as it reads after "Defeat", and the last boss by the name its three forms share. */
  var BOSSES=[
    {floor:5,name:'Grukk the Warchief',title:'A Change of Chieftain'},
    {floor:10,name:'Morty the Mostly-Dead',title:'Mostly Is No Longer Enough'},
    {floor:15,name:'the Deep Maw',title:'A Bite More Than It Could Chew'},
    {floor:20,name:'the Matron of the Web',title:'Your Web Has Been Cancelled'},
    {floor:25,name:'the Unmaker',title:'Unmaking an Unmaker'}
  ];
  BOSSES.forEach(function(boss,index){achievement('biome-'+(index+1),boss.title,'Defeat '+boss.name+' on floor '+boss.floor+(boss.floor===25?' by beating all three of its forms.':'.'),'bosses',1,String(boss.floor),index?'biome-'+index:null);});
  var VICTORY_TITLES=['Forged and Found',"The Forge's Regular",'Here We Forge Again'];
  [1,3,10].forEach(function(total,index,tiers){achievement('victories-'+total,VICTORY_TITLES[index],(total===1?'Win a run.':'Win '+total+' different runs. Each run counts once.'),'victories',total,null,index?'victories-'+tiers[index-1]:null);});
  var CLASS_TITLES={fighter:'Percussive Maintenance',cleric:'Divine Intervention, Delivered',mage:'A Degree in Destruction',scoundrel:'Crime Pays Dividends',tourist:'Five Stars, Would Survive Again'};
  ['fighter','cleric','mage','scoundrel','tourist'].forEach(function(cls){
    var label=cls.charAt(0).toUpperCase()+cls.slice(1);
    achievement('victory-'+cls,CLASS_TITLES[cls],'Win a run as a '+label+'.','wins',1,cls);
  });
  achievement('all-classes','A Resume Written in Scars','Win at least one run as each of the five classes.','classes',5);
  var RACE_TITLES={human:'Only Human, Somehow',elf:'A Long Life, Briefly Endangered',dwarf:'Short Stature, Long Odds',fae:'Terms and Conditions Apply',gloomling:'A Bright Future in Darkness'};
  RACES.forEach(function(race){
    var name=label(race);
    achievement('victory-race-'+race,RACE_TITLES[race],'Win a run as '+(race==='elf'?'an ':'a ')+name+'.','raceWins',1,race);
  });
  achievement('all-races','The Whole Adventuring Family','Win at least one run as each of the five races: Human, Elf, Dwarf, Fae and Gloomling.','races',RACES.length);
  var ELEMENTS=['fire','water','air','earth','light','shadow'],OPPOSITE={fire:'water',water:'fire',air:'earth',earth:'air',light:'shadow',shadow:'light'};
  var PATH_TITLES={
    fire:['An Unsupervised Spark','Playing with Matches','A Walking Fire Code Violation'],
    water:['Testing the Waters','Cold Comfort','A Very Deep Problem'],
    air:['A Breath of Trouble','Throwing Caution','The Forecast Is You'],
    earth:['A Solid Start','Stubborn as a Boulder','An Immovable Inconvenience'],
    light:['A Glimmer of Sense','Radiant Misconduct','Too Bright to Ignore'],
    shadow:['A Shady Beginning','Comfortably Ominous','The Dark Has a New Manager']
  };
  var COMBO_TITLES={
    'fire/earth':'Lava Is a Contact Sport','fire/air':'Fan Service','fire/light':'A Burning Revelation','fire/shadow':'Dark Roast',
    'water/air':'Shockingly Cold','water/earth':'Frozen Assets','water/light':'Pure Liquid Judgment','water/shadow':'A Chill Down Your Spine',
    'air/fire':'Frictional Employment','air/water':'Ice to Meet You','air/light':'Flash of Bad News','air/shadow':'Surprise Forecast',
    'earth/fire':"Strike While You're Hot",'earth/water':'Mud, Sweat and Tears','earth/light':'Rooted in Righteousness','earth/shadow':'A Toxic Workplace',
    'light/fire':'Smite Makes Right','light/water':'Blessed to Excess','light/air':'Justice Strikes Twice','light/earth':'Stay for the Sermon',
    'shadow/fire':'Smoke and Vanish','shadow/water':'Cold Shoulder, Colder Dagger','shadow/air':'Boo, with Thunder','shadow/earth':'Poisoned Pleasantries'
  };
  function label(id){return id.charAt(0).toUpperCase()+id.slice(1);}
  /* 2026-10-12 (launch audit): rank 6 needs a sixth point in one element. Only a Fae in its court's element and a
     Gloomling in Shadow have the room, and only Saint Glimmer's rank 5 gift adds a sixth point of Light. */
  var SIXTH={fire:'a Fae of the Ember Court',water:'a Fae of the Tide Court',air:'a Fae of the Gale Court',earth:'a Fae of the Stone Court',light:'a rank 5 follower of Saint Glimmer',shadow:'a Gloomling'};
  ELEMENTS.forEach(function(element){
    [1,3,6].forEach(function(rank,index,tiers){achievement('path-'+element+'-'+rank,PATH_TITLES[element][index],'Reach affinity '+rank+' in the '+label(element)+' path'+(rank===6?'. Only '+SIXTH[element]+' can.':' in any run.'),'paths',rank,element,index?'path-'+element+'-'+tiers[index-1]:null);});
    ELEMENTS.forEach(function(secondary){
      if(secondary===element||secondary===OPPOSITE[element])return;
      var requirement=label(element)+' 3 / '+label(secondary)+' 2';
      achievement('combo-'+element+'-'+secondary,COMBO_TITLES[element+'/'+secondary],'Unlock the combination requiring '+requirement+' in the same run.','combos',1,element+'/'+secondary);
    });
  });
  var GODS={grom:'Chad the Unclad',grumbok:'Grumbok, Who Hates Wizards',glimmer:'Saint Glimmer',murk:'Mother Murk',reginald:'Sir Reginald the Unsneaky',anvil:'Old Anvil',vellum:'Vellum, the Open Book',wobbles:'Wobbles, the Giggling Chaos',sylla:'Sylla the Patient'};
  var FAITH_TITLES={grom:"The Emperor's New Armor",grumbok:'No Spells, No Problem',glimmer:'Holier Than Yesterday',murk:"Mother's Favorite Problem",reginald:'Subtlety Has Left the Dungeon',anvil:'A Hammer of Faith',vellum:'Read It and Reap',wobbles:'Certified Chaos Consultant',sylla:'Patience Is a Weapon'};
  Object.keys(GODS).forEach(function(god){achievement('faith-'+god,FAITH_TITLES[god],'Reach faith rank 5 with '+GODS[god]+' in any run.','godRanks',5,god);});
  var BESTIARY_TITLES=['Ask Questions, Then Hit Things','A Field Guide to Regrets','The Encyclopedia of Teeth'];
  [10,25,50].forEach(function(total,index,tiers){achievement('bestiary-'+total,BESTIARY_TITLES[index],'Kill '+total+' different kinds of enemy across your runs.','enemies',total,null,index?'bestiary-'+tiers[index-1]:null);});
  var SIGIL_TITLES=['Signed, Sealed, Incinerated','A Rather Expensive Alphabet'];
  [5,15].forEach(function(total,index,tiers){achievement('sigils-'+total,SIGIL_TITLES[index],'Discover '+total+' different sigils across your runs.','sigils',total,null,index?'sigils-'+tiers[index-1]:null);});
  achievement('first-enchantment','A Little Extra Sparkle','Discover an equipment enchantment.','enchantments',1);
  achievement('all-achievements','The Forge Has No Further Questions','Earn every other achievement.','achievements',DEFINITIONS.length);
  function definitions(){return DEFINITIONS.map(function(definition){return Object.assign({},definition);});}
  function achievements(data){
    data=snapshot(data);
    var results=definitions().filter(function(definition){return definition.category!=='achievements';}).map(function(definition){
      var category=definition.category,values=data[category],current;
      if(COUNTS.indexOf(category)>=0)current=values;
      else if(category==='deaths'||category==='victories')current=Object.keys(data.completedRuns).filter(function(id){return data.completedRuns[id].won===(category==='victories');}).length;
      else if(category==='classes')current=['fighter','cleric','mage','scoundrel','tourist'].filter(function(cls){return data.wins[cls]===true;}).length;
      else if(category==='races')current=RACES.filter(function(race){return data.raceWins[race]===true;}).length;
      else if(definition.key)current=RANKS.indexOf(category)>=0?count(values[definition.key]):values[definition.key]?1:0;
      else if(RANKS.indexOf(category)>=0)current=Object.keys(values).reduce(function(max,key){return Math.max(max,values[key]);},0);
      else current=Object.keys(values).length;
      return Object.assign(definition,{current:Math.min(current,definition.target),unlocked:current>=definition.target});
    });
    var all=definitions().find(function(definition){return definition.category==='achievements';});
    all.current=results.filter(function(result){return result.unlocked;}).length;all.unlocked=all.current===all.target;results.push(all);
    var byId={};results.forEach(function(result){byId[result.id]=result;});
    results.forEach(function(result){result.visible=result.unlocked||result.current>0&&(!result.previous||byId[result.previous].unlocked);});
    return results;
  }
  return Object.freeze({key:KEY,backupKey:BACKUP,version:VERSION,createStore:createStore,definitions:definitions,achievements:achievements});
});

(function(root){
  if(typeof document==='undefined')return;
  var api=root.FoteJournal,store=api.createStore({
    getItem:function(key){return root.localStorage.getItem(key);},
    setItem:function(key,value){root.localStorage.setItem(key,value);}
  },{setTimeout:root.setTimeout.bind(root),clearTimeout:root.clearTimeout.bind(root)});
  root.FoteJournal=Object.freeze(Object.assign({},api,store,{achievements:function(data){return api.achievements(data||store.read());}}));
  root.addEventListener('storage',function(event){if(event.key===api.key||event.key===api.backupKey||event.key===null)store.read();});
  root.addEventListener('pagehide',function(){store.flush();});
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')store.flush();});
})(globalThis);

;
/* js/engine/journal-adapter.js */
/* Account discoveries belong to successful gameplay commands, never rendering
 * or save serialization. The live run identity excludes the title's preview. */
(function(root){
  'use strict';
  var activeRun=null;
  /* 2026-10-12 (launch audit, Justin's ruling): an achievement earned in play is named once in the log and
     listed on the end screen. known is what this browser already held when the run began, or what a loaded
     save proved, so a load or a reload repeats nothing. fresh holds the titles earned since, for the end screen.
     Both live here and not in the run, so a save never depends on what the browser has seen before. */
  var known=null,fresh=[];
  function held(){var ids={};root.FoteJournal.achievements().forEach(function(a){if(a.unlocked)ids[a.id]=true;});return ids;}
  function announce(changed){
    // The journal answers true only when something changed; only then is the list worth reading again.
    if(!changed||!known)return;
    var run=activeRun;
    root.FoteJournal.achievements().forEach(function(a){
      if(!a.unlocked||known[a.id])return;
      known[a.id]=true;fresh.push(a.title);
      // Said once the command has had its own say (the mote taking root, the floor's name), never between its lines.
      Promise.resolve().then(function(){if(run===activeRun)log('Achievement: <b>'+a.title+'</b>.','c-kill');});
    });
  }
  function active(){
    return !!(root.FoteJournal&&typeof RUN!=='undefined'&&RUN&&RUN===activeRun&&player&&!RUN.sandbox&&
      !(typeof SANDBOX!=='undefined'&&SANDBOX.building));
  }
  function record(category,key,value){
    // Generation can grant devotion before its route checks. Publish only
    // after that candidate is installed; rollback discards this callback.
    afterGeneratedInstall(function(){if(active())announce(root.FoteJournal.record(category,key,value===undefined?true:value));});
  }
  function progress(){
    afterGeneratedInstall(function(){
      if(!active())return;
      var journal=root.FoteJournal;
      announce(journal.record('maxLevel',null,player.level));
      Object.keys(player.aff||{}).forEach(function(element){if(player.aff[element]>0)announce(journal.record('paths',element,player.aff[element]));});
      combosHeld().forEach(function(key){announce(journal.record('combos',key));});
      if(player.god)announce(journal.record('godRanks',player.god,godRank()));
    });
  }
  function location(){
    afterGeneratedInstall(function(){
      if(!active())return;
      announce(root.FoteJournal.record('highestDepth',null,floorNo));
      if(floorMeta&&floorMeta.plane)announce(root.FoteJournal.record('planes',floorMeta.plane));
    });
  }
  function gear(item,hint){
    if(!item)return;
    if(item.ring&&(!item.unid||RUN.ringKnown&&RUN.ringKnown[item.ring]))record('rings',item.ring);
    if(item.amulet&&(!item.unid||RUN.amuletKnown&&RUN.amuletKnown[item.amulet]))record('amulets',item.amulet);
    if(item.unid||!item.enchant)return;
    var kind=item.weapon?'weapon':item.kind||hint;
    if(kind==='off'){
      var key=itemKey(Object.assign({},item));
      kind=['orb','tome','holy'].indexOf(key)>=0?key:item.block>0||key==='buckler'||key==='kite'?'shield':null;
    }
    if(ENCHANT_TEXT[kind]&&ENCHANT_TEXT[kind][item.enchant])record('enchantments',kind+'/'+item.enchant);
  }
  function defeated(entity){
    if(!entity||!entity.foe||entity.ally)return;
    record('enemies',entity.kind);
    if(entity.base&&entity.base.encounterId==='unmaker'){
      ['unmaker-tyrant','unmaker-unbound','unmaker-heart'].forEach(function(kind){record('enemies',kind);});
    }
  }
  function clearedFloor(n,meta){
    if(!meta||meta.plane)return;
    if([5,10,15,20].indexOf(n)>=0&&(meta.bossRewarded||meta.caveWon||meta.matron&&meta.matron.phase==='dead'))record('bosses',String(n));
    if(n===25&&meta.unmakerEncounter&&['defeated','victory'].indexOf(meta.unmakerEncounter.status)>=0)record('bosses','25');
  }
  function observeRun(){
    if(!active())return;
    progress();location();
    Object.keys(sigilKnown||{}).forEach(function(key){if(sigilKnown[key])record('sigils',key);});
    Object.keys(RUN.ringKnown||{}).forEach(function(key){if(RUN.ringKnown[key])record('rings',key);});
    Object.keys(RUN.amuletKnown||{}).forEach(function(key){if(RUN.amuletKnown[key])record('amulets',key);});
    (player.bag||[]).forEach(function(entry){gear(entry.data,entry.kind);});
    (player.sets||[]).forEach(function(item){gear(item,'weapon');});
    [['ranged','weapon'],['armor','armor'],['off','off'],['amulet','amulet'],['ring0','ring'],['ring1','ring']].forEach(function(pair){gear(FoteInventory.slotItem(player,pair[0]),pair[1]);});
    (RUN.planesVisited||[]).forEach(function(element){record('planes',element);});
    clearedFloor(floorNo,floorMeta);
    Object.keys(RUN.floorStash||{}).forEach(function(key){
      var n=Number(key);if(!Number.isInteger(n)||n<1||n>LAST_FLOOR)return;
      record('highestDepth',null,n);clearedFloor(n,RUN.floorStash[key].floorMeta);
    });
    if(RUN.deepestFloor)record('highestDepth',null,RUN.deepestFloor);
    if(RUN.planeStash)clearedFloor(floorNo,RUN.planeStash.floorMeta);
  }
  function start(options){
    activeRun=options&&options.preview?null:RUN;
    known=null;fresh=[];
    // A run that has not taken a turn holds only what it was created with (a Fae's court element), and that is news.
    if(active()&&!turn)known=held();
    observeRun();
    if(active()&&RUN.victory)root.FoteJournal.finishRun(RUN.finishedRecord||runEndRecord(true));
    // What a played save proves is not news: the save is read first and the list is taken after it, in the same queue.
    afterGeneratedInstall(function(){if(active()&&!known)known=held();});
  }
  function finish(historyRecord){
    if(!active())return;
    observeRun();announce(root.FoteJournal.finishRun(historyRecord));root.FoteJournal.flush();
  }
  function earned(){return fresh.slice();}
  root.FoteJournalEvents=Object.freeze({active:active,start:start,record:record,progress:progress,location:location,gear:gear,defeated:defeated,observeRun:observeRun,finish:finish,earned:earned});
})(globalThis);

;
/* js/presentation/ui/journal-content.js */
/* Browser journal reference content. Read current authored tables only when a
 * section opens; never derive a preview hero, identify an item, or load art. */
(function(root){
  'use strict';
  function esc(value){return String(value===undefined?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function para(value){return value?'<p>'+esc(value)+'</p>':'';}
  function facts(rows){return '<dl>'+rows.filter(function(row){return row[1]!==undefined&&row[1]!==null;}).map(function(row){return '<dt>'+esc(row[0])+'</dt><dd>'+esc(row[1])+'</dd>';}).join('')+'</dl>';}
  function list(rows){return '<ul>'+rows.map(function(row){return '<li>'+esc(row)+'</li>';}).join('')+'</ul>';}
  function title(value){return value.charAt(0).toUpperCase()+value.slice(1);}
  function percent(value){return Number((value*100).toFixed(2))+'%';}
  function units(value,unit){return value+' '+unit+(Number(value)===1?'':'s');}
  function known(data,category,key){return !!(data[category]&&data[category][key]);}
  function locked(name,group,requirement){return {title:name,group:group,locked:true,requirement:requirement};}
  function entry(name,group,html){return {title:name,group:group,html:html};}
  var sections=[
    ['stats','Stats & unlocks'],['equipment','Equipment'],['paths','Elemental paths'],
    ['combos','Elemental combinations'],['enchantments','Enchantments'],['gods','Gods'],
    ['rings','Rings'],['amulets','Amulets'],['sigils','Sigils'],['bestiary','Bestiary']
  ];

  function statEntries(){
    var basics={
      mig:['Might','Each point above 10 adds 4% to your weapon damage bonus, including ranged weapons. Each point above 10 also adds 2 percentage points to shield block chance, up to its cap. Might meets requirements for heavier weapons and armor.'],
      agi:['Agility','Each point adds 2 accuracy and 2 evasion. Each point above 10 adds 2 percentage points of critical chance. Agility also improves parrying, stealth and trap or secret spotting, and meets requirements for light weapons and bows.'],
      vit:['Vitality','Raises maximum HP with your level. Each point above 10 adds 1 percentage point of nonphysical resistance and 0.02% of maximum HP to normal regeneration per world turn. Vitality meets requirements for armor, shields and sacred equipment.'],
      foc:['Focus','Raises maximum Mana with your level. Each point above 10 adds 4% to your spell damage bonus and 0.05% of maximum Mana to regeneration per world turn. Focus meets requirements for spellcasting equipment and sacred equipment.']
    };
    var result=Object.keys(basics).map(function(key){
      var row=basics[key];
      return entry(row[0],'Attributes',para(row[1])+list(PASSIVES[key].map(function(p){return row[0]+' '+p.at+', '+p.name+': '+p.d;})));
    });
    var details=[
      ['HP','Health remaining. Reaching zero ends the run. Before bonuses, maximum HP is 10 + Vitality × (1 + level ÷ 5), rounded. Shields absorb eligible damage before HP.'],
      ['Mana','Spent by spells and some abilities. Before bonuses, maximum Mana is Focus × (1 + level ÷ 5), rounded up. Mana regenerates as world time passes.'],
      ['HP regeneration','Normal recovery starts at 0.20% of maximum HP per world turn, plus 0.02% per Vitality above 10. Normal recovery pauses during combat, starvation, Poison and Rot. Other healing sources have their own conditions.'],
      ['Mana regeneration','Normal recovery starts at 0.60% of maximum Mana per world turn, plus 0.05% per Focus above 10. Focus passives and equipment can improve this.'],
      ['Damage per hit','Weapon damage after Might and other unconditional bonuses, before the target’s defenses. Critical hits, surprise, elemental effects and bonuses against particular targets can change the result.'],
      ['Accuracy','Improves the chance that an attack lands against the target’s Evasion. Base accuracy is 60 + twice Agility, before equipment and other effects.'],
      ['Evasion','Reduces attackers’ chance to hit. Base evasion is 10 + twice Agility, before armor, passives and other effects.'],
      ['Hit chance','The ordinary attack chance is 75% + 0.75% × (Accuracy − 80) − 0.75% × (Evasion − 30), limited to 15–95%. Abilities, statuses and special defenses may modify this.'],
      ['Crit','Critical-hit chance starts at 6%, plus 2 percentage points per Agility above 10. Equipment, passives and effects can add to it.'],
      ['Crit damage','A critical hit normally deals ×1.60 damage. Agility 15 and Agility 21 each add 0.25 to that multiplier. Some equipment and powers change it further.'],
      ['Armor','Ordinary physical hits first lose half your armor, rounded up, to a maximum of half the incoming hit. Armor then reduces the remaining damage by 2% per point, up to 50%. Heavy attacks bypass the first flat reduction. Armor piercing reduces effective armor.'],
      ['Block','Chance to block an eligible attack. Shields add their own block chance, 2 percentage points per upgrade, and 2 per Might above 10, normally capped at 75%. Spell Ward expands what you can block.'],
      ['Parry','A separate defense against eligible melee attacks. Wielding an off-hand weapon gives 8% + Agility ÷ 3 percentage points of parry chance. Some powers grant other ways to parry.'],
      ['Spell power','Multiplies spell damage. Focus and its passives form the character bonus; casting equipment adds its own bonuses.'],
      ['Divine Power','Strengthens divine invocations and prayers according to each ability’s rules. Sacred equipment provides the basic bonus; individual gods can alter it. It is separate from Spell power.'],
      ['Range','The reach of an attack or spell in tiles. Bows have their own range; spears reach two tiles in a line. Race, equipment and individual powers can extend range.'],
      ['Attack speed','How quickly weapon attacks spend world time. Higher speed allows more attacks while enemies act. Movement and casting can have different modifiers.'],
      ['Movement speed','How quickly steps spend world time. Higher speed gives enemies less time between your steps. It does not by itself describe spell or attack timing.'],
      ['Casting speed','How quickly casting spends world time. Spell timing, equipment and special effects can differ from movement and weapon attacks.'],
      ['Stealth','Reduces the chance an unaware enemy notices you. Agility, class, armor and special effects affect stealth; distance also matters. Enemies already hunting you are not made unaware by a higher stealth score.'],
      ['Trap and secret spotting','Your chance to notice hidden hazards or doors while exploring. Agility and some equipment improve discovery. Deliberate searching can reveal what ordinary movement missed.'],
      ['Cooldowns','An ability may need time before it can be used again, even if you can pay its resource cost. The ability’s description states its cooldown and whether it is measured in world time or paid actions.'],
      ['Resistances','Reduce damage of their listed type: Fire, Frost, Lightning, Poison, Light, Shadow and Magic. A positive percentage reduces damage; a negative percentage means vulnerability. Immunity prevents that damage type. Physical damage is handled by armor and other physical defenses.'],
      ['Shields, Guard and Ice Armor','Protective pools can absorb damage without losing HP. They have separate capacities, recharge rules and eligible damage types.'],
      ['XP and level','Experience advances your level and awards stat points. The level cap is 20.'],
      ['Hunger','Falls as world time passes. Food restores it, up to the maximum. Starvation stops normal HP regeneration and eventually harms you.'],
      ['Affinity and affinity cap','Affinity measures your investment in an element. You can hold at most two elements, never opposites. A secondary element cannot exceed the primary. Boss cores raise the total affinity cap.'],
      ['Piety, rank and Favor','Piety is lasting progress with the current god; rank unlocks rewards. Favor is the separate resource spent on prayers and is capped at 100. Rank thresholds: '+PIETY_RANKS.map(function(n,i){return (i+1)+' at '+n;}).join('; ')+'.'],
      ['Amusement','Wobbles’ separate measure of interest in your actions, from 0 to 100. It can influence his interventions. It is separate from Piety and Favor.'],
      ['Essence','Currency used for equipment upgrades, sigil crafting, purchases and other services. It belongs to the current run.'],
      ['Depth','The deepest main-dungeon floor reached. Visiting a side plane does not create an extra numbered dungeon floor.']
    ];
    return result.concat(details.map(function(row){return entry(row[0],'Combat & resources',para(row[1]));}));
  }

  function equipmentEntries(){
    var result=[entry('Equipment quality and upgrades','Basics',para('Equipment comes in Worn, Plain, Fine and Masterwork quality. Each quality has its own base values and requirements. Upgrades are separate, up to +3.')),
      entry('Hands and identification','Basics',para('Two-handed main weapons occupy both hands. Light one-handed weapons can go in the off hand; an off-hand weapon strikes at 60% damage. The ranged slot carries a bow. Unidentified finds hide their upgrade, curse and enchantment details until learned.'))];
    [['Weapons',WEAPONS],['Armor',ARMORS],['Off hands',OFFHANDS]].forEach(function(group){
      if(group[0]==='Weapons')result.push(entry(FISTS.name,'Weapons',para('Used when your hands are empty. Base damage '+FISTS.dmg.join('–')+'; accuracy modifier +'+FISTS.acc+'. Unarmed combat can be changed by divine powers.')));
      Object.keys(group[1]).forEach(function(key){
        var item=group[1][key],html=para(item.note),rows=[];
        if(item.hands)rows.push(['Hands',item.hands]);
        if(item.range)rows.push(['Base range',units(item.range,'tile')]);
        if(item.acc!==undefined)rows.push(['Accuracy modifier',item.acc]);
        if(item.light)rows.push(['Off-hand use','Light one-handed weapon']);
        html+=facts(rows);
        if(TIER_WEAPON[key]||TIER_ARMOR[key]||TIER_BLOCK[key]||TIER_REQ[key]){
          html+='<ul>'+[0,1,2,3].map(function(tier){
            var copy=Object.assign({},item,{key:key,tier:tier,plus:0});tierNormalize(copy);
            var values=[],req=reqText(copy);
            if(TIER_WEAPON[key])values.push(TIER_WEAPON[key][tier].join('–')+' damage');
            if(TIER_ARMOR[key])values.push(TIER_ARMOR[key][tier]+' armor');
            if(copy.eva)values.push((copy.eva>0?'+':'')+copy.eva+' evasion');
            if(TIER_BLOCK[key])values.push(percent(TIER_BLOCK[key][tier])+' block');
            if(FOCUS_BONUS[key]&&key!=='orb')values.push('+'+percent(FOCUS_BONUS[key].base[tier])+' spell damage');
            if(key==='orb')values.push('+'+percent(ORB_CRIT.base[tier])+' critical chance, +'+ORB_ACC.base[tier]+' accuracy');
            if(key==='wand')values.push(percent(WAND_THRIFT.base[tier])+' less spell Mana cost');
            if(key==='robe')values.push('+'+percent(TIER_ROBE.spell[tier])+' spell damage, +'+percent(TIER_ROBE.mana[tier])+' maximum Mana');
            if(key==='buckler')values.push(percent(TIER_BUCKLER_DEFLECT.base[tier])+' chance to deflect ranged attacks');
            if(key==='chain')values.push('+'+percent(TIER_CHAIN_RESIST.base[tier])+' elemental resistance');
            if(key==='tome')values.push('+'+percent(TIER_OFF.tome.base[tier])+' maximum Mana');
            if(key==='holy'||key==='censer')values.push('+'+percent(TIER_OFF.holy.base[tier])+' Divine Power');
            if(key==='mace')values.push('ignores '+MACE_PIERCE[tier]+' armor');
            return '<li><b>'+esc(TIER_NAME[tier]||'Plain')+':</b> '+esc(values.join('; '))+'. '+esc(req?'Requires '+req+'.':'No attribute requirement.')+'</li>';
          }).join('')+'</ul>';
        }
        result.push(entry(item.name,group[0],html));
      });
    });
    return result;
  }

  function actionText(action,cooldown,details){
    var rows=[];
    if(Array.isArray(action.base))rows.push(['Base damage',action.base.join('–')+(action.type?' '+({phys:'physical',ice:'frost',dark:'shadow'}[action.type]||action.type):'')]);
    if(action.cost)rows.push(['Base cost',action.cost+' Mana']);
    if(action.favor)rows.push(['Cost',action.favor+' Favor']);
    if(action.health)rows.push(['Base cost',action.health+' HP']);
    if(action.essence)rows.push(['Cost',action.essence+' Essence']);
    if(action.amusement)rows.push(['Cost',action.amusement+' Amusement']);
    if(action.range)rows.push(['Base range',units(action.range,'tile')]);
    if(cooldown===undefined)cooldown=action.cd;
    if(cooldown!==undefined)rows.push(['Base cooldown',cooldown?units(cooldown,'turn'):'None']);
    if(action.instant)rows.push(['Timing','Instant']);
    return para(action.desc)+facts(rows.concat(details||[]));
  }
  var FIRST_PATH={
    fire:{name:'Fire Affinity',text:'Your direct hits deal extra fire damage.',scaling:'+1 fire damage per Fire affinity point.'},
    water:{name:'Ice Armor',text:'Absorbs damage before you lose HP. Recovers 1 point per turn after 5 turns without losing HP.',scaling:'Shield capacity is 3 × Water affinity.'},
    air:{name:'Air Affinity',text:'Move faster.',scaling:'+10% movement speed per Air affinity point.'},
    earth:{name:'Stone Skin',text:'Reduces physical damage from ordinary hits. Heavy attacks bypass this protection.',scaling:'Subtract 1 damage per Earth affinity point. Combined with armor, this flat reduction cannot remove more than half the hit.'},
    light:{name:'Smite on Hit',text:'Weapon and single-target spell hits can trigger an extra light strike.',scaling:'10% chance per Light point. Deals 3–6 + Light affinity damage; no Spell power multiplier.'},
    shadow:{name:'Life Drain',text:'Direct hits can deal extra shadow damage and heal you for the damage it deals.',scaling:'10% chance per Shadow point, up to 100%. Deals 2 × Shadow affinity damage; no Spell power multiplier.'}
  };
  function pathSpellText(key,data){
    var action=Object.assign({},ABILITIES[key]),area=['blast','cone','chain','quake','beam'].indexOf(action.kind)>=0;
    if(area&&!action.base)action.base=AOE_BASE;
    if(key==='frostshard')action.desc='Deal frost damage and apply Chill.';
    var areaScaling=data.paths&&data.paths.fire?'(Base damage + Fire affinity) × Spell power.':'Base damage × Spell power.';
    var scaling=area||key==='glacialtomb'||key==='upheaval'?areaScaling:'Base damage × Spell power.';
    var details=[];
    switch(key){
      case 'firebolt':details.push(['Burning','3 fire damage per turn for 3 turns. Does not scale with affinity or Spell power.']);break;
      case 'frostshard':details.push(['Chill','Builds toward freezing the target at 4 stacks.']);break;
      case 'spark':details.push(['Stun','5% chance per Air affinity point; lasts 1 turn.']);break;
      case 'root':details.push(['Root','2 turns; 1 against bosses.']);break;
      case 'smite':details.push(['Blind','10% chance per Light affinity point; lasts 2 turns.'],['Undead & shadow creatures','+50% damage.']);break;
      case 'shadowbolt':details.push(['Fear','2 turns; 1 against bosses.']);break;
      case 'fireball':details.push(['Burning','(2 + Fire affinity) × Spell power damage per turn for 3 turns.']);break;
      case 'frostcone':details.push(['Cone','6 tiles long; applies Chill and knocks back 1 tile.']);break;
      case 'chainbolt':details.push(['Jumps','Up to 5 targets, each within 4 tiles of the last. No damage falloff between jumps.']);break;
      case 'earthquake':details.push(['Area','Within 5 tiles of you. Can hit your summons.']);break;
      case 'radiantbeam':details.push(['Blind','5% chance per Light affinity point; lasts 2 turns.'],['Undead & shadow creatures','+50% damage.']);break;
      case 'shadowswarm':
        scaling='Each Shade has 10 × Spell power HP, deals 10 × Spell power shadow damage, and lasts 5 × Spell power turns.';
        details.push(['Summons','Up to 9 Shades. Replaces your previous swarm.']);break;
      case 'livingflame':
        scaling='28 × Spell power HP; shots deal 5–9 × Spell power fire damage. Arrival damage: '+areaScaling.replace('Base damage','14–22');
        details.push(['Duration','30 turns.'],['Shots','Range 6; every third shot splashes for half damage.'],['Burning','22% chance per shot; 2 + Fire affinity damage per turn for 3 turns.']);break;
      case 'glacialtomb':details.push(['Imprisonment','10 turns; 6 for elites; 2 for bosses. Damage hits adjacent enemies.']);break;
      case 'stormform':
        scaling='Doubles movement and action speed. Duration starts at 6 turns and increases with beneficial-effect duration bonuses; no Air affinity or Spell power multiplier.';break;
      case 'upheaval':details.push(['Ridge','Up to 7 tiles wide for 20 turns. Target range stays at 7 tiles.'],['Root','2 turns; 1 against bosses. Can affect your summons.']);break;
      case 'dawn':details.push(['Blind','3 turns.'],['Reveal','All enemies for 20 turns.']);break;
      case 'umbral':
        scaling='The shadow copies your weapons and combat stats when cast. No separate affinity or Spell power multiplier.';
        details.push(['Destination','Explored, open ground with no adjacent enemy.'],['Shadow','Lasts until destroyed or replaced by your next cast.']);break;
    }
    if(action.kind==='bolt')scaling+=' Focus and casting equipment increase Spell power.';
    details.unshift(['Scaling',scaling]);
    return actionText(action,undefined,details);
  }
  function pathPassiveText(el,rank){
    var text=RANK_TEXT[rank][el],colon=text.indexOf(':'),description=text.slice(colon+1).trim(),rows=[];
    if(rank===6){
      if(el==='fire')rows.push(['Spread Burning','2 + Fire affinity damage per turn for 3 turns.']);
      if(el==='air')description='15% of stationary attacks and spells take no time. Lightning damage also has a separate 15% chance to Stun for 1 turn. Immune to lightning.';
      if(el==='light'){
        description='Light spells and Smites bless the ground for 3 turns. It heals you and your allies, damages enemies and protects against nonphysical damage. Immune to light.';
        rows.push(['Healing','2% of maximum HP × Spell power per turn.'],['Enemy damage','(3 + Light affinity) × Spell power per turn; doubled against undead and shadow creatures.'],['Protection','+15 percentage points of nonphysical resistance × Spell power, up to 75% total resistance. Existing stronger resistance is preserved.']);
      }
    }
    return {name:text.slice(0,colon),html:para(description)+facts(rows)};
  }
  function pathEntries(data){
    var result=[];
    ELEMENTS.forEach(function(el){
      for(var rank=1;rank<=6;rank++){
        var label=title(el)+' '+rank,group=title(el),reached=data.paths&&data.paths[el]||0;
        if(reached<rank){result.push(locked(label,group,'Reach '+label+' in a run to discover this milestone.'));continue;}
        var ability=ELEMENT_ABILS[el][rank],name,html;
        if(rank===1){var first=FIRST_PATH[el];name=first.name;html=para(first.text)+facts([['Scaling',first.scaling]]);}
        else if(ability&&ABILITIES[ability]){name=ABILITIES[ability].name;html=pathSpellText(ability,data);}
        else{var passive=pathPassiveText(el,rank);name=passive.name;html=passive.html;}
        result.push(entry(label+' · '+name,group,html));
      }
    });return result;
  }
  function comboEntries(data){
    var result=Object.keys(COMBOS).map(function(key){
      var pair=key.split('/'),threshold=title(pair[0])+' 3 / '+title(pair[1])+' 2';
      return known(data,'combos',key)?Object.assign(entry(COMBOS[key].name,'Discovered combinations',para(COMBOS[key].d)),{requirement:threshold}):
        locked(threshold,'Undiscovered combinations','Hold '+threshold+' in a run. The reverse order is a different combination.');
    });
    return result.filter(function(e){return !e.locked;}).concat(result.filter(function(e){return e.locked;}));
  }
  function enchantmentEntries(data){
    var labels={weapon:'Weapons',armor:'Armor',shield:'Shields',orb:'Orbs',tome:'Tomes',holy:'Holy Symbols'},result=[];
    Object.keys(ENCHANT_TEXT).forEach(function(kind){ELEMENTS.forEach(function(el){
      var name=title(el)+' enchantment',group=labels[kind]||title(kind);
      result.push(known(data,'enchantments',kind+'/'+el)?entry(name,group,para(FoteEnchantments.formula(kind,el))):locked(name,group,'Enchant this equipment type with '+title(el)+', or identify an item carrying this enchantment.'));
    });});return result;
  }
  function godEntries(data){
    var result=[];
    Object.keys(GODS).forEach(function(key){
      var god=GODS[key],group=god.name,ranks=godBoonRanks(god),highest=data.godRanks&&data.godRanks[key]||0;
      result.push(entry(god.name,group,para(god.title)+para(god.summary)+facts([['Conduct',god.rule],['Piety gained from',god.gain]])));
      var invoke=god.invoke,ranked=[];
      if(invoke&&ABILITIES[invoke])result.push(known(data,'godAbilities','invoke:'+invoke)?entry('Cleric invocation: '+ABILITIES[invoke].name,group,actionText(ABILITIES[invoke],DIVINE_COOLDOWNS.invokes[invoke])):locked('Cleric invocation',group,'Successfully use this god’s invocation during a run.'));
      god.boons.forEach(function(boon,i){
        var rank=ranks[i]||i+1;
        ranked.push({rank:rank,entry:highest>=rank?entry('Rank '+rank+' boon',group,para(boon)):locked('Rank '+rank+' boon',group,'Reach faith rank '+rank+' with '+god.name+'.')});
      });
      (god.prayers||[]).forEach(function(key){
        var prayer=PRAYERS[key];if(!prayer)return;
        var id=typeof prayerId==='function'?prayerId(key):key;
        ranked.push({rank:prayer.rank,entry:known(data,'godAbilities','pray:'+id)?entry('Rank '+prayer.rank+' prayer: '+prayer.name,group,actionText(prayer,DIVINE_COOLDOWNS.prayers[id])+para('Requires faith rank '+prayer.rank+'.')):locked('Rank '+prayer.rank+' prayer',group,'Successfully use this prayer during a run.')});
      });
      ranked.sort(function(a,b){return a.rank-b.rank;}).forEach(function(row){result.push(row.entry);});
    });return result;
  }
  function ringEntries(data){
    return Object.keys(RINGS).map(function(key,i){
      if(!known(data,'rings',key))return locked('Undiscovered ring '+(i+1),'Rings','Identify or recognize this ring type in a run.');
      var ring=RINGS[key],value=ring.step+(ring.base||0),base=ring.pct?percent(value):String(value),extra='';
      if(key==='mending'){base=Number(value.toFixed(3))+'% of maximum HP per world turn';extra='Works while fed and not Poisoned; Rot prevents healing. A cursed Mending ring stops HP regeneration.';}
      else if(key==='wizardry'){base='+'+percent(value)+' maximum Mana; +'+percent(value/2)+' spell damage';}
      else if(key==='striking'){base='+'+value+' weapon damage; +'+value+'% critical chance';}
      else if(key==='accuracy'){base='+'+value+' accuracy; +'+percent(ring.critPer)+' critical chance';}
      else if(key==='sustenance'){base=percent(value)+' less hunger; food buffs last '+percent(ring.foodPer)+' longer';}
      else base+=' '+ring.unit.replace(/^%\s*/,ring.pct?'':'% ');
      return entry(ring.name,'Rings',para(ring.desc)+facts([['Ordinary +0 ring',base]])+para(extra)+para('A +0 ring has one point of power; each upgrade adds one. Cursed rings have negative power.'));
    });
  }
  function amuletEntries(data){
    return Object.keys(AMULETS).map(function(key,i){
      if(!known(data,'amulets',key))return locked('Undiscovered amulet '+(i+1),'Amulets','Use or identify this amulet type in a run.');
      var amulet=AMULETS[key];
      return entry(amulet.name,'Amulets',para(amulet.desc)+facts([['Charge capacity','1 at level I; 2 at level II; '+AMULET_MAX_CHARGES+' at level III'],['Base recharge',units(amulet.kills,'kill')+' per charge'],['Base range',amulet.range?units(amulet.rangeBy?amulet.rangeBy[0]:amulet.range,'tile'):null]])+para('Elites and bosses count as three kills. Cursed amulets require 30% more kills and unleash a trap instead of their power.'));
    });
  }
  function sigilEntries(data){
    return Object.keys(SIGILS).map(function(key,i){
      if(!known(data,'sigils',key))return locked('Undiscovered sigil '+(i+1),'Sigils','Cast, craft or identify this sigil during a run.');
      var sigil=SIGILS[key];
      return entry(sigil.name,'Sigils',para(sigil.desc)+facts([['Recipe',sigil.motes.map(title).join(' + ')],['Crafting cost',sigilEssence(key)+' Essence']])+para('A consumable power. Appearances change each run.'));
    });
  }

  function enemyLocation(key,monster){
    var plane=Object.keys(PLANE_ROSTER).find(function(el){var roster=PLANE_ROSTER[el];return roster.elite===key||roster.mobs.indexOf(key)>=0;});
    if(key==='crystalnode')plane='earth';
    if(plane)return {order:20+ELEMENTS.indexOf(plane),name:PLANE_THEMES[plane].name+' ('+title(plane)+' plane)'};
    var chaos={'prism-archives':[5,'Prism Archives'],'rot-hollows':[6,'Rot Hollows'],'cinder-bastion':[7,'Cinder Bastion'],'violet-warrens':[8,'Violet Warrens']};
    if(chaos[monster.chaosBiome])return {order:chaos[monster.chaosBiome][0],name:chaos[monster.chaosBiome][1]+' (Chaos)'};
    if(key.indexOf('unmaker-')===0)return {order:9,name:'Crucible (Chaos)'};
    if(monster.elementTier)return {order:monster.elementTier===1?0:monster.elementTier,suborder:1,name:monster.elementTier===1?'Dungeon and Crypt (elemental creatures)':monster.elementTier===2?'Caverns (elemental creatures)':'Underdark (elemental creatures)'};
    if(key==='mimic')return {order:0,suborder:2,name:'Dungeon and treasure rooms'};
    var specials={warchief:0,shroomling:2,wormtender:2,mawlimb:2};
    var biome=specials[key];
    if(biome===undefined&&monster.band&&monster.band[0]>=1&&monster.band[0]<=25)biome=Math.floor((monster.band[0]-1)/5);
    if(biome===undefined)return {order:30,name:'Other encounters'};
    return {order:biome,name:['Dungeon (depths 1–5)','Crypt (depths 6–10)','Caverns (depths 11–15)','Underdark (depths 16–20)','Chaos (depths 21–25)'][biome]};
  }
  function bestiaryEntries(data){
    var rows=Object.keys(data.enemies||{}).filter(function(key){return data.enemies[key]&&MONSTERS[key];}).map(function(key){
      var monster=MONSTERS[key],location=enemyLocation(key,monster),traits=[];
      [['boss','Boss'],['elite','Elite'],['undead','Undead'],['flying','Flying'],['spellcaster','Spellcaster'],['heavy','Heavy'],['tiny','Tiny']].forEach(function(pair){if(monster[pair[0]])traits.push(pair[1]);});
      if(monster.el)traits.push(title(monster.el)+' element');
      var html=para(enemyLore({kind:key,base:monster}))+para(monster.hint!==enemyLore({kind:key,base:monster})?monster.hint:'')+facts([
        ['Base HP',monster.hp],['Base attack damage',monster.dmg&&monster.dmg.join('–')],['Accuracy',monster.acc],['Evasion',monster.eva],['Armor',monster.armor||0],['Speed',monster.speed],['Attack range',units(Number.isFinite(monster.range)?monster.range:1,'tile')],['XP',monster.xp],['Traits',traits.join(', ')||null],['Status immunities',monster.statusImmunities&&monster.statusImmunities.map(title).join(', ')]
      ]);
      var result=entry(monster.name,location.name,html);
      result.enemyKey=key;result.sprite=monster.sprite||null;result.glyph=monster.ch||'?';
      return {key:key,location:location,entry:result};
    });
    rows.sort(function(a,b){return a.location.order-b.location.order||(a.location.suborder||0)-(b.location.suborder||0)||a.location.name.localeCompare(b.location.name)||a.entry.title.localeCompare(b.entry.title);});
    return rows.map(function(row){return row.entry;});
  }
  var builders={stats:statEntries,equipment:equipmentEntries,paths:pathEntries,combos:comboEntries,enchantments:enchantmentEntries,gods:godEntries,rings:ringEntries,amulets:amuletEntries,sigils:sigilEntries,bestiary:bestiaryEntries};
  root.FoteJournalContent=Object.freeze({
    sections:function(){return sections.map(function(row){return {id:row[0],label:row[1]};});},
    entries:function(section,data){return builders[section]?builders[section](data||{}):[];}
  });
})(typeof globalThis!=='undefined'?globalThis:this);

;
/* js/presentation/ui/journal.js */
/* The journal reads account knowledge, never changes the current run's knowledge. */
(function(root){
  'use strict';
  var selected='achievements',referenceSection='stats',releaseThumbnails=null,journalOrigin=null,expandedCategories=new Set();
  function escape(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function plain(html){var node=document.createElement('div');node.innerHTML=html||'';return node.textContent||'';}
  function importHistory(){
    var history=FoteRunHistory.createStore({getItem:function(key){return localStorage.getItem(key);},setItem:function(){}});
    FoteJournal.importHistory(history.read());
  }
  function paintEnemyThumbnail(host,sprite){
    if(!host.isConnected)return;
    var spec=AS.mobs&&AS.mobs[sprite]||root.CHAOS_ENEMY_ATLAS&&root.CHAOS_ENEMY_ATLAS[sprite]||root.UNMAKER_ATLAS&&root.UNMAKER_ATLAS[sprite];
    if(!spec){host.dataset.artState='unavailable';return;}
    var file=spec.file||'mob-'+sprite+'.webp',img=atl(file);
    if(!img){
      host.dataset.artState='pending';
      watchStaticArt(host,[file],function(){paintEnemyThumbnail(host,sprite);},null,'journal',false,function(){host.dataset.artState='unavailable';});
      return;
    }
    // One authored still, or the first idle frame. This borrows the atlas and
    // native icon reduction without starting creature animations or lighting.
    var row=Number.isInteger(spec.static_row)?spec.static_row:spec.clips&&spec.clips.idle?spec.clips.idle.row:0;
    var box=spec.box||[0,0,spec.cell,spec.cell],canvas=document.createElement('canvas');
    paintIconArt(canvas,{img:img,sx:box[0],sy:row*spec.cell+box[1],sw:box[2],sh:box[3]},48,48,false,false);
    host.replaceChildren(canvas);host.dataset.artState='ready';
  }
  function openJournal(requested){
    if(releaseThumbnails)releaseThumbnails();
    if(typeof stopTravel==='function')stopTravel();
    var origin=document.activeElement;
    if(origin&&origin!==document.body&&!origin.closest('#modal'))journalOrigin=origin;
    importHistory();FoteJournal.flush();
    var data=FoteJournal.read(),achievements=FoteJournal.achievements(data),earned=achievements.filter(function(a){return a.unlocked;}).length;
    var sections=FoteJournalContent.sections().filter(function(s){return s.id!=='bestiary';});
    var tabs=[{id:'achievements',label:'Achievements'},{id:'encyclopedia',label:'Encyclopedia'},{id:'bestiary',label:'Bestiary'},{id:'runs',label:'Previous Runs'}];
    if(requested==='encyclopedia')selected=referenceSection;
    else if(typeof requested==='string'&&(tabs.some(function(t){return t.id===requested;})||sections.some(function(s){return s.id===requested;})))selected=requested;
    function currentTab(){return ['achievements','bestiary','runs'].indexOf(selected)>=0?selected:'encyclopedia';}
    if(currentTab()==='encyclopedia')referenceSection=selected;
    openModal('Journal',
      '<div class="journal-intro">'+
      '<div class="journal-totals"><span><b>'+data.highestDepth+'</b>Deepest floor</span><span><b>'+earned+' / '+achievements.length+'</b>Achievements</span><span><b>'+Object.keys(data.enemies).length+'</b>Creatures</span></div></div>'+
      (!FoteJournal.persisted()?'<p class="journal-storage" role="status">Browser storage is unavailable. New progress is remembered for this session only.</p>':'')+
      '<div class="journal-tabs" role="tablist" aria-label="Journal sections">'+tabs.map(function(t){return '<button type="button" role="tab" id="journalTab-'+t.id+'" data-journal-tab="'+t.id+'" aria-controls="journalPanel">'+t.label+'</button>';}).join('')+'</div>'+
      '<div id="journalPanel" role="tabpanel"><div id="journalControls" class="journal-controls"><label id="journalCategoryLabel">Section<select id="journalSection">'+sections.map(function(s){return '<option value="'+escape(s.id)+'"'+(s.id===referenceSection?' selected':'')+'>'+escape(s.label)+'</option>';}).join('')+'</select></label>'+
      '<label>Search<input id="journalSearch" type="search" placeholder="Search this section" autocomplete="off"></label>'+
      '<label id="journalGroupLabel" hidden>Location<select id="journalGroup"><option value="">All locations</option></select></label></div>'+
      '<p id="journalCount" class="journal-count" role="status" aria-live="polite"></p><div id="journalEntries"></div></div>',
      [{label:'Close journal',fn:closeModal}],'journal-modal');
    var section=$('journalSection'),search=$('journalSearch'),group=$('journalGroup'),entries=[],thumbnailObserver=null,thumbnailHosts=[],renderedSection=null,renderedQuery='';
    function clearThumbnails(){
      if(thumbnailObserver){thumbnailObserver.disconnect();thumbnailObserver=null;}
      thumbnailHosts.forEach(function(host){cancelStaticArtPaint(host,'journal');});thumbnailHosts=[];
    }
    releaseThumbnails=clearThumbnails;
    modalOnClose=function(){clearThumbnails();if(releaseThumbnails===clearThumbnails)releaseThumbnails=null;if(journalOrigin&&journalOrigin.isConnected)journalOrigin.focus({preventScroll:true});};
    function showThumbnails(){
      thumbnailHosts=Array.from($('journalEntries').querySelectorAll('.journal-enemy-sprite'));
      if(!thumbnailHosts.length)return;
      if(typeof IntersectionObserver==='function'){
        var observer=new IntersectionObserver(function(changes){
          if(thumbnailObserver!==observer)return;
          changes.forEach(function(change){
          if(!change.isIntersecting||!change.target.getClientRects().length)return;
          observer.unobserve(change.target);paintEnemyThumbnail(change.target,change.target.dataset.sprite);
        });},{root:$('mBody')});
        thumbnailObserver=observer;
        thumbnailHosts.forEach(function(host){thumbnailObserver.observe(host);});
      }else thumbnailHosts.forEach(function(host){if(host.closest('.journal-category').open)paintEnemyThumbnail(host,host.dataset.sprite);});
    }
    function prepare(){
      var tab=currentTab();
      document.querySelectorAll('[data-journal-tab]').forEach(function(button){var on=button.dataset.journalTab===tab;button.setAttribute('aria-selected',String(on));button.tabIndex=on?0:-1;});
      $('journalPanel').setAttribute('aria-labelledby','journalTab-'+tab);
      $('journalCategoryLabel').hidden=tab!=='encyclopedia';
      $('journalControls').hidden=tab==='runs';
      $('journalCount').hidden=tab==='runs';
      if(tab==='encyclopedia'){referenceSection=selected;section.value=selected;}
      entries=selected==='achievements'?achievements.filter(function(a){return a.visible;}).concat(achievements.filter(function(a){return !a.visible;})):selected==='runs'?[]:FoteJournalContent.entries(selected,data);
      var locations=[];entries.forEach(function(e){if(e.group&&locations.indexOf(e.group)<0)locations.push(e.group);});
      group.innerHTML='<option value="">All locations</option>'+locations.map(function(name){return '<option>'+escape(name)+'</option>';}).join('');
      $('journalGroupLabel').hidden=selected!=='bestiary'||!locations.length;
      render();
    }
    function rememberCategories(){
      if(!renderedSection||renderedQuery)return;
      $('journalEntries').querySelectorAll('.journal-category').forEach(function(category){
        var key=renderedSection+'/'+category.dataset.journalCategory;
        if(category.open)expandedCategories.add(key);else expandedCategories.delete(key);
      });
    }
    function render(){
      // Native toggle events are queued; save the current state before replacing
      // the nodes when a player immediately changes sections.
      rememberCategories();renderedSection=selected;renderedQuery=search.value.trim();
      clearThumbnails();
      if(selected==='runs'){
        var history=FoteRunHistoryUI.historyContent();
        $('journalEntries').innerHTML=history.html;
        FoteRunHistoryUI.bindHistory($('journalEntries'),history.rows);
        return;
      }
      var query=search.value.trim().toLocaleLowerCase(),location=group.value;
      var filtered=entries.filter(function(e){
        if(selected==='bestiary'&&location&&e.group!==location)return false;
        if(selected==='achievements'&&!e.visible)return !query||'???'.includes(query);
        return !query||[e.title,e.group,e.requirement,e.description,plain(e.html)].join(' ').toLocaleLowerCase().includes(query);
      });
      $('journalCount').textContent=filtered.length+' of '+entries.length+' entries';
      var html='',lastGroup=null;
      if(selected==='achievements'){
        /* earned first, then in progress, then undiscovered, each keeping its order (Justin, 2026-10-15: "shouldn't the
           journal show the achievements you've earned up top and indicated you've earned them via a white title?") */
        var rank=function(a){return a.unlocked?0:a.visible?1:2;};
        filtered=filtered.map(function(a,i){return {a:a,i:i};}).sort(function(x,y){return rank(x.a)-rank(y.a)||x.i-y.i;}).map(function(x){return x.a;});
        html='<div class="journal-achievements">'+filtered.map(function(a){
          if(!a.visible)return '<article class="journal-achievement journal-undiscovered"><span class="journal-state">Undiscovered</span><h3>???</h3></article>';
          var current=Math.min(a.current,a.target);
          return '<article class="journal-achievement'+(a.unlocked?' earned':'')+'"><div class="journal-achievement-top"><span class="journal-state">'+(a.unlocked?'Earned':'In progress')+'</span><span>'+current+' / '+a.target+'</span></div><h3>'+escape(a.title)+'</h3><p>'+escape(a.description)+'</p><progress max="'+a.target+'" value="'+current+'" aria-label="'+escape(a.title)+'"></progress></article>';
        }).join('')+'</div>';
      }else filtered.forEach(function(e){
        if(e.group!==lastGroup){
          if(lastGroup!==null)html+='</div></details>';
          lastGroup=e.group;
          html+='<details class="journal-category" data-journal-category="'+escape(e.group)+'"'+(query||expandedCategories.has(selected+'/'+e.group)?' open':'')+'><summary class="journal-group">'+escape(e.group)+'</summary><div class="journal-category-entries">';
        }
        if(e.locked){html+='<article class="journal-entry journal-locked"><h4>'+escape(e.title)+'</h4><p>'+escape(e.requirement||'Undiscovered')+'</p></article>';return;}
        var heading=escape(e.title);
        if(e.enemyKey)heading='<span class="journal-enemy-heading"><span class="journal-enemy-sprite" data-enemy="'+escape(e.enemyKey)+'" data-sprite="'+escape(e.sprite||'')+'" aria-hidden="true">'+escape(e.glyph)+'</span><span>'+heading+'</span></span>';
        html+='<details class="journal-entry"><summary>'+heading+'</summary><div class="journal-detail">'+(e.html||'')+(e.requirement?'<p class="journal-requirement">'+escape(e.requirement)+'</p>':'')+'</div></details>';
      });
      if(lastGroup!==null)html+='</div></details>';
      $('journalEntries').innerHTML=filtered.length?html:'<p class="journal-empty">'+(query?'No discovered information matches this search.':selected==='bestiary'?'Your bestiary is empty. Defeat an enemy to record it here.':'No entries yet.')+'</p>';
      var categorySection=selected;
      $('journalEntries').querySelectorAll('.journal-category').forEach(function(category){
        category.ontoggle=function(){
          if(!category.isConnected)return;
          if(category.open&&typeof IntersectionObserver!=='function')category.querySelectorAll('.journal-enemy-sprite').forEach(function(host){paintEnemyThumbnail(host,host.dataset.sprite);});
          if(query)return;
          var key=categorySection+'/'+category.dataset.journalCategory;
          if(category.open)expandedCategories.add(key);else expandedCategories.delete(key);
        };
      });
      showThumbnails();
    }
    function selectTab(tab){selected=tab==='encyclopedia'?referenceSection:tab;search.value='';prepare();}
    document.querySelectorAll('[data-journal-tab]').forEach(function(button,index){
      button.onclick=function(){selectTab(button.dataset.journalTab);};
      button.onkeydown=function(event){
        var next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:-1;
        if(next<0)return;event.preventDefault();selectTab(tabs[next].id);$('journalTab-'+tabs[next].id).focus();
      };
    });
    section.onchange=function(){selected=section.value;search.value='';prepare();};search.oninput=render;group.onchange=render;
    prepare();$('mX').focus();
  }
  var style=document.createElement('style');
  style.textContent=[
    '#modal .journal-modal{width:min(920px,calc(100vw - 24px));max-height:calc(100dvh - 24px)}',
    '.journal-modal .mbody{overflow-y:auto;min-height:0}',
    '.journal-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:16px}.journal-tabs button{min-height:44px;padding:8px 4px;font:var(--text-12) var(--mono)}#modal .journal-tabs button[aria-selected="true"]{border-color:var(--gold);color:var(--gold);background:var(--panel-2,#221d1a)}#modal .journal-tabs button:focus-visible{outline:2px solid var(--gold);outline-offset:2px}',
    '.journal-controls[hidden]{display:none}.journal-undiscovered{min-height:100px;display:flex;flex-direction:column;justify-content:center;border-style:dashed}.journal-undiscovered .journal-state{font-size:var(--text-10);color:var(--dim)}.journal-undiscovered h3{color:var(--dim)}',
    '.journal-intro p,.journal-hint,.journal-count{color:var(--ash);line-height:1.6;font-size:var(--text-12)}',
    '.journal-intro p{margin:0 0 12px}.journal-totals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;border-block:1px solid var(--edge);padding:12px 0;font-size:var(--text-10);color:var(--ash)}',
    '.journal-totals b{display:block;margin-bottom:5px;color:var(--gold);font-size:var(--text-16);font-variant-numeric:tabular-nums}',
    '.journal-controls{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 10px}.journal-controls label{display:flex;flex:1 1 190px;flex-direction:column;gap:5px;color:var(--ash);font-size:var(--text-12)}',
    '.journal-controls label[hidden]{display:none}.journal-controls input,.journal-controls select{width:100%;box-sizing:border-box;min-height:44px;border:1px solid var(--edge);border-radius:4px;background:var(--panel-2,#221d1a);color:var(--ink);padding:8px;font:var(--text-14) var(--mono)}',
    '.journal-count{font-size:var(--text-10);margin:5px 0 12px}.journal-hint{margin:0}',
    '.journal-achievements{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.journal-achievement{border:1px solid var(--edge);border-radius:5px;padding:13px;background:var(--panel-2,#221d1a)}',
    '.journal-achievement.earned{border-color:var(--gold)}.journal-achievement-top{display:flex;justify-content:space-between;gap:10px;font-size:var(--text-10);color:var(--ash)}',
    '.journal-achievement.earned .journal-state{color:var(--gold)}.journal-achievement h3{margin:10px 0 6px;color:var(--ink);font:var(--text-20) var(--display)}',
    '.journal-achievement p{margin:0 0 12px;color:var(--ash);font-size:var(--text-12);line-height:1.55}.journal-achievement progress{width:100%;height:5px;accent-color:var(--gold);display:block}',
    '.journal-category{margin:10px 0;border-bottom:1px solid var(--edge)}.journal-group{color:var(--gold);font:var(--text-20) var(--display);padding:10px 4px;min-height:44px;box-sizing:border-box;cursor:pointer;overflow-wrap:anywhere}.journal-category-entries{padding-bottom:8px}.journal-entry{border:1px solid var(--edge);border-radius:4px;margin:7px 0;overflow-wrap:anywhere}',
    '.journal-entry summary{padding:12px;min-height:44px;box-sizing:border-box;cursor:pointer;font-size:var(--text-14);color:var(--ink)}',
    '.journal-enemy-heading{display:inline-flex;align-items:center;gap:12px;vertical-align:middle;max-width:calc(100% - 22px)}.journal-enemy-heading>span:last-child{min-width:0}',
    '.journal-enemy-sprite{display:inline-flex;align-items:center;justify-content:center;flex:0 0 48px;width:48px;height:48px;border-radius:4px;background:rgba(0,0,0,.18);color:var(--gold);font:24px var(--mono);overflow:hidden}.journal-enemy-sprite canvas{display:block;width:48px;height:48px}',
    '.journal-detail{padding:0 14px 12px;font-size:var(--text-12);line-height:1.65;color:var(--ash)}.journal-detail p{margin:8px 0}.journal-detail h4{color:var(--ink)}',
    '.journal-detail dl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:5px 15px}.journal-detail dd{margin:0;color:var(--ink)}.journal-detail table{width:100%;border-collapse:collapse}.journal-detail td,.journal-detail th{text-align:left;border-bottom:1px solid var(--edge);padding:6px;vertical-align:top}',
    '.journal-locked{padding:12px;border-style:dashed}.journal-locked h4{margin:0;color:var(--ash);font-size:var(--text-12);font-weight:normal}.journal-locked p,.journal-requirement{color:var(--dim);font-size:var(--text-12);margin:6px 0 0}',
    '.journal-storage{color:#e5b785;font-size:var(--text-12);line-height:1.5}.journal-empty{padding:22px 4px;color:var(--ash);line-height:1.6}',
    '@media(max-width:560px){.journal-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}.journal-achievements{grid-template-columns:1fr}.journal-controls label{flex:1 1 45%;min-width:0}.journal-controls #journalGroupLabel{flex-basis:100%}.journal-totals{gap:6px}}'
  ].join('\n');
  document.head.appendChild(style);
  root.openJournal=openJournal;
  FoteLifecycle.whenReady(importHistory);
})(globalThis);

