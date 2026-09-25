/* Local Prism Archives layout. Uses the existing floor, doors, props and portal
 * tiles; launch controls, rendering and action timing remain with their owners. */
(function(root){
  'use strict';
  var capturing=false;
  function active(){return floorMeta&&floorMeta.chaosPreview||null;}
  function onLand(x,y){var preview=active();return !!(preview&&inb(x,y)&&preview.landMask[idxOf(x,y)]);}
  function regionAt(x,y){var preview=active();return preview&&inb(x,y)?preview.regionByCell[idxOf(x,y)]||null:null;}
  function atPortal(x,y){var preview=active();return preview&&at(x,y)===PORTAL?preview.portals.find(function(p){return x>=p.x&&x<p.x+(p.w||1)&&y>=p.y&&y<p.y+(p.h||1);})||null:null;}

  function resetMotion(entity){
    entity._lx=undefined;entity._ly=undefined;delete entity._clip;
    if(typeof MOTION_STATE!=='undefined')MOTION_STATE.delete(entity);
  }
  function clearPresentation(){
    if(typeof stopTravel==='function')stopTravel();
    if(typeof PACING!=='undefined')PACING.pending=null;
    if(typeof fx!=='undefined')fx=[];
    if(typeof PARTS!=='undefined')PARTS.length=0;
    if(typeof fxClock!=='undefined')fxClock=0;
    if(typeof aiming!=='undefined')aiming=null;
    if(typeof BOWAIM!=='undefined')BOWAIM=null;
    if(typeof hoverX!=='undefined')hoverX=-1;
    if(typeof hoverY!=='undefined')hoverY=-1;
    if(typeof camX!=='undefined')camX=Math.max(0,Math.min(MW-viewW,player.x-(viewW>>1)));
    if(typeof camY!=='undefined')camY=Math.max(0,Math.min(MH-viewH,player.y-(viewH>>1)));
    if(typeof camOX!=='undefined')camOX=0;
    if(typeof camOY!=='undefined')camOY=0;
  }

  // Authored layouts share only installation, safe scenery and portal plumbing.
  // Floor generation and each biome's geometry remain with their own module.
  function begin(definition,seed){
    if(!player)throw new Error('Create the preview character before building '+definition.name+'.');
    if(typeof gameTurns!=='undefined'&&gameTurns.busy())throw new Error('Finish the current turn before building the preview.');
    if(definition.width&&definition.height){
      if(typeof setMapDimensions!=='function')throw new Error('Map dimensions must be installed before the combined Chaos preview.');
      setMapDimensions(definition.width,definition.height);
    }else if(typeof resetMapDimensions==='function')resetMapDimensions();
    if(MW<54||MH<33)throw new Error(definition.name+' requires at least the existing 56 by 34 floor.');
    seed=Number.isFinite(seed)?seed>>>0:92421;
    var size=MW*MH;
    floorNo=21;worldSeed=seed;
    map=new Uint8Array(size).fill(CHASM);seen=new Uint8Array(size);vis=new Uint8Array(size);
    ground=new Uint8Array(size);fireT=new Uint8Array(size);
    if(typeof fireSrc!=='undefined')fireSrc=new Uint8Array(size);
    props=[];propGrid=new Int16Array(size).fill(-1);feats=[];items=[];ents=[player];rooms=[];
    chestKind={};levers=[];plates=null;altars={};groundReset();
    // The ordinary wandering-spawn cap is 3+floorNo, so this is permanent.
    spawnedExtra=99;nextSpawn=1e9;
    var preview={version:2,biome:definition.biome,name:definition.name,seed:seed,
      regions:[],portals:[],focals:[],landmarks:[],decor:[],landMask:new Array(size).fill(0),regionByCell:new Array(size).fill(null),
      spawn:{x:definition.spawn.x,y:definition.spawn.y},currentRegion:definition.regionId,visits:{}};
    preview.visits[definition.regionId]=1;
    floorMeta={floor:floorNo,biome:4,boss:false,forge:false,shrine:false,portal:'light',portalUsed:false,impassableVoid:true,
      exitOpen:false,keyHolder:false,notes:[definition.name+': '+(definition.islandCount===5?'five':'three')+' islands linked by paired portals.','The void is impassable. Paired gateways take you between islands.'],puzzles:[],searched:{},planeLights:[],chaosPreview:preview};
    return preview;
  }
  function finish(preview){
    if(capturing)return preview;
    player.x=preview.spawn.x;player.y=preview.spawn.y;player.keys={iron:0,crystal:0};
    resetMotion(player);clearPresentation();
    if(typeof resetGeneratedSurface==='function')resetGeneratedSurface(preview.seed);
    return preview;
  }
  // Read an approved authored layout without moving the live character or
  // clearing presentation. Restore every temporary floor reference even when
  // authoring fails; only the final composed installation invalidates caches.
  function capture(builder,seed){
    if(capturing)throw new Error('Nested Chaos layout capture is not supported.');
    var keys=['MW','MH','floorNo','worldSeed','map','seen','vis','ground','fireT','fireSrc','props','propGrid','feats','items','ents','rooms','chestKind','levers','plates','altars','iceG','rootG','holyG','spawnedExtra','nextSpawn','floorMeta','rng'];
    var saved=keys.map(function(key){return {key:key,exists:Object.prototype.hasOwnProperty.call(root,key),value:root[key]};});
    capturing=true;
    try{
      root.rng=mulberry32((seed>>>0)^0x43617074);
      var preview=builder(seed);
      return JSON.parse(JSON.stringify({preview:preview,map:Array.from(map),props:props,rooms:rooms,planeLights:floorMeta.planeLights,width:MW,height:MH}));
    }finally{
      saved.forEach(function(entry){if(entry.exists)root[entry.key]=entry.value;else delete root[entry.key];});
      capturing=false;
    }
  }
  function scenery(preview,x,y,name,extra,w,h){
    if(!onLand(x,y)||at(x,y)!==FLOOR)throw new Error('Invalid preview prop placement: '+name+' at '+x+','+y);
    var options=Object.assign({keep:true,burn:0,br:0,loot:0,ex:0,altar:0,drink:0,melt:0,web:0,previewDecor:true},extra||{});
    var placed=w?addSetPiece(x,y,name,w,h,options):addProp(x,y,name,options);
    if(!placed)throw new Error('Could not place preview prop '+name+'.');
    preview.decor.push({kind:name,regionId:regionAt(x,y),x:x,y:y,w:w||1,h:h||1,variant:(preview.seed+x*17+y*31)%4});
    return placed;
  }
  function portal(preview,artName,id,pairId,regionId,x,y,arrival,destinationId,label){
    for(var yy=y;yy<y+2;yy++)for(var xx=x;xx<x+2;xx++){
      if(!onLand(xx,yy)||regionAt(xx,yy)!==regionId||at(xx,yy)!==FLOOR||propAt(xx,yy))throw new Error('Invalid preview portal placement.');
    }
    var endpoint={id:id,pairId:pairId,regionId:regionId,x:x,y:y,w:2,h:2,arrival:arrival,destinationId:destinationId,label:label};
    scenery(preview,x,y,artName,{artName:artName,previewPortal:id,previewLabel:label,b:0,flat:0,noShadow:true},2,2);
    for(var py=y;py<y+2;py++)for(var px=x;px<x+2;px++)map[idxOf(px,py)]=PORTAL;
    preview.portals.push(endpoint);return endpoint;
  }
  function build(seed){
    var preview=begin({biome:'prism-archives',name:'Prism Archives',spawn:{x:8,y:9},regionId:'index-court'},seed);
    seed=preview.seed;
    var focalChoices=[{artName:'prism-lens',label:'Crystal lens'},{artName:'prism-astrolabe',label:'Astral astrolabe'},
      {artName:'prism-lectern',label:'Floating-book lectern'},{artName:'prism-tree',label:'Prism tree'}];
    // Use an independent seeded stream: scenery selection never consumes the
    // gameplay random sequence, and an island cannot repeat another's focal.
    var choose=mulberry32(seed^0x50726973);
    for(var choice=focalChoices.length-1;choice>0;choice--){var swap=Math.floor(choose()*(choice+1)),held=focalChoices[choice];focalChoices[choice]=focalChoices[swap];focalChoices[swap]=held;}

    function rect(x,y,w,h,fn){for(var yy=y;yy<y+h;yy++)for(var xx=x;xx<x+w;xx++)fn(xx,yy);}
    function region(id,name,bounds,footprints,spawn,height){
      var entry={id:id,name:name,bounds:bounds,height:height,spawn:spawn,palette:'prism'};preview.regions.push(entry);
      footprints.forEach(function(r){rect(r[0],r[1],r[2],r[3],function(x,y){
        var i=idxOf(x,y);if(preview.regionByCell[i]&&preview.regionByCell[i]!==id)throw new Error('Preview islands overlap.');
        map[i]=FLOOR;preview.landMask[i]=1;preview.regionByCell[i]=id;
      });});return entry;
    }
    function room(id,regionId,name,x,y,w,h,doors){
      rooms.push({id:rooms.length,x:x,y:y,w:w,h:h,cx:x+(w>>1),cy:y+(h>>1),special:'library',previewId:id,regionId:regionId});
      rect(x,y,w,h,function(xx,yy){if(xx===x||yy===y||xx===x+w-1||yy===y+h-1)map[idxOf(xx,yy)]=WALL;});
      doors.forEach(function(d){map[idxOf(d[0],d[1])]=DOOR;});
      preview.landmarks.push({id:id,kind:'room',regionId:regionId,x:x,y:y,w:w,h:h,label:name});
    }
    function prop(x,y,name,extra,w,h){
      // Archive furniture is scenery: it cannot burn, break, produce loot or
      // inherit an interactive shrine/fountain effect from its artwork.
      var options=Object.assign({keep:true,burn:0,br:0,loot:0,ex:0,altar:0,drink:0,melt:0,web:0,previewDecor:true},extra||{});
      if(name==='bookshelf'){options.artName='prism-bookcase';options.previewLabel='Prism bookcase';}
      return scenery(preview,x,y,name,options,w,h);
    }
    function line(x,y,n,dx,dy,name){for(var i=0;i<n;i++)prop(x+i*dx,y+i*dy,name);}
    function light(x,y,col,r){floorMeta.planeLights.push({x:x,y:y,col:col,r:r||3.1,s:.55});}
    function focal(x,y){
      var selected=focalChoices[preview.focals.length];
      prop(x,y,'prism-focal',{artName:selected.artName,previewLabel:selected.label,previewFocal:true,b:1,flat:0,noShadow:true},2,2);
      preview.focals.push({regionId:regionAt(x,y),x:x,y:y,w:2,h:2,artName:selected.artName,label:selected.label});
    }
    function prismPortal(id,pairId,regionId,x,y,arrival,destinationId,label){
      return portal(preview,'prism-portal',id,pairId,regionId,x,y,arrival,destinationId,label);
    }

    // Index Court: a reading hall surrounded by open galleries. The Prism
    // Atelier is a small annex reached by an exposed, three-tile land bridge.
    region('index-court','Index Court',{x:3,y:2,w:21,h:14},
      [[3,4,12,10],[5,2,8,2],[5,14,8,2],[15,8,4,3],[19,6,5,7]],preview.spawn,3);
    room('reading-hall','index-court','The Reading Hall',5,5,8,8,[[5,9],[12,9],[8,5],[9,12]]);
    room('catalogue-alcove','index-court','Catalogue Alcove',6,2,6,4,[[8,5]]);
    room('lens-atelier','index-court','Prism Atelier',19,6,5,7,[[19,9]]);
    preview.landmarks.push({id:'lens-bridge',kind:'bridge',regionId:'index-court',x:14,y:8,w:6,h:3,label:'Atelier Causeway'});
    line(6,6,2,1,0,'bookshelf');line(10,6,2,1,0,'bookshelf');
    line(6,11,2,1,0,'bookshelf');line(10,11,2,1,0,'bookshelf');
    prop(8,8,'table-candle',{light:'#F0DCAB'});prop(10,9,'table-candle',{light:'#BBD8FF'});
    prop(7,3,'bookshelf');prop(10,3,'bookshelf');
    prop(3,5,'grave-pillar');prop(14,5,'grave-pillar');prop(3,12,'grave-pillar');prop(14,12,'grave-pillar');
    prop(6,14,'crystal-gold-small');prop(11,14,'crystal-water-small');
    focal(20,7);prop(20,11,'crystal-water-small');prop(22,11,'crystal-gold-small');
    light(8,8,'#F3DFAD',4);light(21,8,'#9DD7FA',3.5);

    // Refraction Galleries: two long stacks with an open transverse court,
    // offset entrances and broad balconies at the north and south ends.
    region('refraction-galleries','Refraction Galleries',{x:34,y:1,w:20,h:17},
      [[37,3,15,13],[34,7,3,6],[40,1,9,2],[52,7,2,6],[40,16,9,2]],{x:36,y:10},4);
    room('upper-gallery','refraction-galleries','Spectrum Gallery',39,3,11,5,[[44,7],[48,7],[44,3]]);
    room('lower-gallery','refraction-galleries','The Mirrored Stacks',38,10,13,5,[[43,10],[45,10],[44,14]]);
    line(40,4,3,1,0,'bookshelf');line(45,4,3,1,0,'bookshelf');
    prop(40,6,'table-candle',{light:'#C6E6FE'});prop(46,6,'crystal-water-small');
    line(39,11,3,1,0,'bookshelf');line(46,11,4,1,0,'bookshelf');
    prop(39,13,'table-candle',{light:'#F1DBA5'});prop(46,13,'table-candle',{light:'#C6E6FE'});
    focal(42,16);
    prop(37,4,'grave-pillar');prop(51,4,'grave-pillar');prop(37,14,'grave-pillar');prop(51,14,'grave-pillar');
    prop(41,1,'crystal-water-small');prop(47,1,'crystal-gold-small');
    prop(41,17,'crystal-gold-small');prop(47,17,'crystal-water-small');
    prop(53,8,'statue');prop(53,11,'statue');
    light(44,8,'#C7E8FF',4);light(44,12,'#F1DDB6',3.5);

    // Astral Repository: a compact circular reading route around the raised
    // index, with two open side wings and recessed shelves at every corner.
    region('astral-repository','Astral Repository',{x:18,y:22,w:22,h:11},
      [[21,22,16,11],[18,25,3,5],[37,25,3,5]],{x:37,y:27},5);
    room('great-index','astral-repository','The Great Index',25,24,9,7,[[25,27],[33,27],[29,24],[29,30]]);
    focal(28,26);
    prop(26,25,'bookshelf');prop(32,25,'bookshelf');prop(26,29,'bookshelf');prop(32,29,'bookshelf');
    line(22,23,2,1,0,'bookshelf');line(35,23,2,0,1,'bookshelf');
    line(22,31,2,1,0,'bookshelf');line(35,30,2,0,1,'bookshelf');
    prop(22,26,'table-candle',{light:'#C6E6FE'});prop(35,28,'table-candle',{light:'#F1DBA5'});
    prop(18,25,'crystal-gold-small');prop(18,29,'crystal-water-small');
    prop(27,22,'grave-pillar');prop(31,22,'grave-pillar');prop(27,32,'grave-pillar');prop(31,32,'grave-pillar');
    light(29,27,'#E7DEFF',4.2);light(22,27,'#9FDFFF',3);

    prismPortal('index-gate','index-gallery','index-court',21,9,{x:20,y:9},'gallery-west','To Refraction Galleries');
    prismPortal('gallery-west','index-gallery','refraction-galleries',34,9,{x:36,y:10},'index-gate','To Index Court');
    prismPortal('gallery-east','gallery-repository','refraction-galleries',47,5,{x:46,y:5},'repository-gate','To Astral Repository');
    prismPortal('repository-gate','gallery-repository','astral-repository',38,26,{x:37,y:27},'gallery-east','To Refraction Galleries');
    return finish(preview);
  }

  function legalArrival(x,y,regionId,reserved){
    if(!onLand(x,y)||regionAt(x,y)!==regionId||reserved.has(idxOf(x,y)))return false;
    if(at(x,y)!==FLOOR&&at(x,y)!==OPEN)return false;
    return !propAt(x,y);
  }
  function travelPortal(value){
    var preview=active();if(!preview)return false;
    if(typeof gameTurns!=='undefined'&&gameTurns.busy())return false;
    var id=typeof value==='string'?value:value&&value.id;
    var source=preview.portals.find(function(p){return p.id===id;});
    if(!source||atPortal(player.x,player.y)!==source)return false;
    var destination=preview.portals.find(function(p){return p.id===source.destinationId;});
    if(!destination||destination.destinationId!==source.id)return false;
    var reserved=new Set(ents.filter(function(e){return e!==player&&e.hp>0;}).map(function(e){return idxOf(e.x,e.y);})),arrival=destination.arrival;
    if(!legalArrival(arrival.x,arrival.y,destination.regionId,reserved)){
      var alternatives=[];
      for(var ay=0;ay<MH;ay++)for(var ax=0;ax<MW;ax++)if(legalArrival(ax,ay,destination.regionId,reserved))alternatives.push({x:ax,y:ay});
      alternatives.sort(function(a,b){return Math.abs(a.x-arrival.x)+Math.abs(a.y-arrival.y)-Math.abs(b.x-arrival.x)-Math.abs(b.y-arrival.y)||a.y-b.y||a.x-b.x;});
      if(!alternatives.length)return false;arrival=alternatives[0];
    }
    var from={x:player.x,y:player.y};player.x=arrival.x;player.y=arrival.y;reserved.add(idxOf(player.x,player.y));resetMotion(player);
    // Reserve existing creatures as well as each selected arrival. Releasing
    // one companion's old cell never opens another creature's occupied cell.
    ents.filter(function(e){return e!==player&&e.ally&&e.hp>0;}).forEach(function(e){
      var old=idxOf(e.x,e.y);if(!ents.some(function(other){return other!==e&&other.hp>0&&other.x===e.x&&other.y===e.y;}))reserved.delete(old);
      var cells=[];
      for(var y=0;y<MH;y++)for(var x=0;x<MW;x++)if(legalArrival(x,y,destination.regionId,reserved))cells.push({x:x,y:y});
      cells.sort(function(a,b){return Math.abs(a.x-player.x)+Math.abs(a.y-player.y)-Math.abs(b.x-player.x)-Math.abs(b.y-player.y)||a.y-b.y||a.x-b.x;});
      if(!cells.length){reserved.add(old);return;}
      e.x=cells[0].x;e.y=cells[0].y;e.t=player.t;reserved.add(idxOf(e.x,e.y));resetMotion(e);
    });
    preview.currentRegion=destination.regionId;preview.visits[destination.regionId]=(preview.visits[destination.regionId]||0)+1;
    clearPresentation();
    // The caller spends one action after leaving the current entry callback.
    // No floor is regenerated, and seen/vis/map remain the same objects.
    return {from:from,to:{x:player.x,y:player.y},portal:source,destination:destination,spentAction:true};
  }
  root.FoteChaosPreview=Object.freeze({active:active,onLand:onLand,regionAt:regionAt,build:build,atPortal:atPortal,travelPortal:travelPortal,
    authoring:Object.freeze({begin:begin,finish:finish,scenery:scenery,portal:portal,capture:capture})});
})(typeof window!=='undefined'?window:globalThis);
