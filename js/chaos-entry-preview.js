/* The quiet supply room between the Matron's floor and the Realm of Chaos.
 * Uses ordinary dungeon tiles, loot and portal artwork; no bespoke renderer. */
(function(root){
  'use strict';
  function active(){return floorMeta&&floorMeta.chaosEntryPreview||null;}
  function portalInfo(x,y){
    var entry=active();
    return entry&&x===entry.portal.x&&y===entry.portal.y&&at(x,y)===PORTAL?
      {name:'Portal to the Realm of Chaos',hint:'Leads to floor 21. Gather the supplies before stepping through; there are no god shrines beyond this room.'}:null;
  }
  function resetMotion(entity){entity._lx=undefined;entity._ly=undefined;delete entity._clip;if(typeof MOTION_STATE!=='undefined')MOTION_STATE.delete(entity);}
  function clearPresentation(){
    if(typeof stopTravel==='function')stopTravel();
    if(typeof PACING!=='undefined')PACING.pending=null;
    if(typeof fx!=='undefined')fx=[];if(typeof PARTS!=='undefined')PARTS.length=0;
    if(typeof fxClock!=='undefined')fxClock=0;
    if(typeof aiming!=='undefined')aiming=null;if(typeof BOWAIM!=='undefined')BOWAIM=null;
    if(typeof hoverX!=='undefined')hoverX=-1;if(typeof hoverY!=='undefined')hoverY=-1;
    if(typeof DEEP_AT!=='undefined')DEEP_AT=-1;if(typeof DEEP_RC!=='undefined')DEEP_RC=false;
    if(typeof resetGeneratedSurface==='function')resetGeneratedSurface(worldSeed);
  }
  function livingCompanions(){return (ents||[]).filter(function(e){return e!==player&&e.ally&&e.hp>0;});}
  function placeCompanions(companions){
    var reserved=new Set(ents.filter(function(e){return e.hp>0;}).map(function(e){return idxOf(e.x,e.y);}));
    companions.forEach(function(e){
      var cells=[];
      for(var y=0;y<MH;y++)for(var x=0;x<MW;x++)if(at(x,y)===FLOOR&&!propAt(x,y)&&!reserved.has(idxOf(x,y)))cells.push({x:x,y:y});
      cells.sort(function(a,b){return Math.max(Math.abs(a.x-player.x),Math.abs(a.y-player.y))-Math.max(Math.abs(b.x-player.x),Math.abs(b.y-player.y))||a.y-b.y||a.x-b.x;});
      if(!cells.length)throw new Error('The destination has no safe companion landing.');
      e.x=cells[0].x;e.y=cells[0].y;resetMotion(e);reserved.add(idxOf(e.x,e.y));ents.push(e);
    });
  }
  function build(seed){
    if(!player)throw new Error('Create the character before entering the Chaos supply room.');
    if(typeof gameTurns!=='undefined'&&gameTurns.busy())throw new Error('Finish the current turn before entering the Chaos supply room.');
    var companions=livingCompanions();
    seed=Number.isFinite(seed)?seed>>>0:92521;
    resetMapDimensions();var size=MW*MH;
    floorNo=20;worldSeed=seed;
    map=new Uint8Array(size).fill(WALL);seen=new Uint8Array(size);vis=new Uint8Array(size);
    ground=new Uint8Array(size);fireT=new Uint8Array(size);if(typeof fireSrc!=='undefined')fireSrc=new Uint8Array(size);
    props=[];propGrid=new Int16Array(size).fill(-1);feats=[];items=[];ents=[player];rooms=[];
    chestKind={};levers=[];plates=null;altars={};groundReset();spawnedExtra=99;nextSpawn=1e9;
    var room={id:0,x:20,y:10,w:16,h:13,cx:28,cy:16,role:'start',shape:'rect'};
    rooms.push(room);
    for(var y=room.y+1;y<room.y+room.h-1;y++)for(var x=room.x+1;x<room.x+room.w-1;x++)map[idxOf(x,y)]=FLOOR;
    var entry={version:1,seed:seed,spawn:{x:28,y:20},portal:{x:28,y:12},destinationFloor:21};
    map[idxOf(entry.portal.x,entry.portal.y)]=PORTAL;
    map[idxOf(entry.spawn.x,entry.spawn.y)]=UPSTAIRS;
    floorMeta={floor:20,biome:0,boss:false,forge:false,shrine:false,portal:'light',portalUsed:false,portalAt:entry.portal,
      upAt:entry.spawn,exitOpen:false,keyHolder:false,puzzles:[],searched:{},planeLights:[],chaosEntryPreview:entry,
      notes:['A quiet treasure room lies beneath the twentieth floor. Gather the supplies, then enter the portal to floor 21.','There are no god shrines in the Realm of Chaos.']};
    // Loot has its own stream, leaving the run's combat and item RNG untouched.
    var choose=mulberry32(seed^0x54726561),cells=[];
    for(var yy=14;yy<=19;yy++)for(var xx=22;xx<=33;xx++)if(xx!==28)cells.push({x:xx,y:yy});
    for(var n=cells.length-1;n>0;n--){var swap=Math.floor(choose()*(n+1)),held=cells[n];cells[n]=cells[swap];cells[swap]=held;}
    function put(item){var c=cells.pop();item.x=c.x;item.y=c.y;items.push(item);}
    for(var e=0;e<4;e++)put({kind:'essence',n:250,scaled:true});
    [['weapon',WEAPONS,['sword','dagger','mace','longsword','axe','bow','staff','wand','spear','censer']],
      ['armor',ARMORS,['leather','chain','plate','robe']],['off',OFFHANDS,['buckler','kite','orb','tome','holy']]].forEach(function(group){
      var keys=group[2].filter(function(key){return !!group[1][key];}),key=keys[Math.floor(choose()*keys.length)];
      var gear=JSON.parse(JSON.stringify(group[1][key]));gear.key=key;gear.kind=group[0];gear.tier=3;gear.plus=3;gear.cursed=false;gear.unid=false;
      delete gear.cursedOff;tierNormalize(gear);put({kind:group[0],it:gear});
    });
    ELEMENTS.forEach(function(el){put({kind:'mote',el:el});put({kind:'mote',el:el});});
    for(var f=0;f<4;f++)put({kind:'food',food:'ration'});
    player.x=entry.spawn.x;player.y=entry.spawn.y;resetMotion(player);placeCompanions(companions);clearPresentation();
    return entry;
  }
  function enterPortal(){
    if(!portalInfo(player.x,player.y)||typeof FoteChaosCampaign==='undefined')return Promise.resolve(false);
    return FoteChaosCampaign.enterRealm();
  }
  function prompt(){
    if(!portalInfo(player.x,player.y))return false;
    stopTravel();confirmBox('Enter the Realm of Chaos','The portal leads to <b>floor 21</b>. Collect any supplies you want to carry before leaving. There are no god shrines in Chaos.','Step through',enterPortal);
    return true;
  }
  root.FoteChaosEntryPreview=Object.freeze({active:active,build:build,portalInfo:portalInfo,prompt:prompt,enterPortal:enterPortal});
})(typeof window!=='undefined'?window:globalThis);
