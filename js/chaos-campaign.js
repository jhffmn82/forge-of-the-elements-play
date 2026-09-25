/* Campaign travel owns the quiet supply room and the five Chaos floors.
 * Authored layouts, actors, floor snapshots and action timing keep their owners. */
(function(root){
  'use strict';
  var pending=null;
  function handles(n){return Number.isInteger(n)&&n>=21&&n<=25;}
  function entry(){return floorMeta&&floorMeta.chaosEntryPreview||null;}
  function prepare(){
    var names=Object.keys(root.CHAOS_ENEMY_ATLAS||{}).concat(['m-unmaker-tyrant','m-unmaker-unbound','m-unmaker-heart']);
    return Promise.all([root.FoteChaosPreviewRenderer.ensureAssets(),root.FoteChaosPreviewArt.ensureAssets('chaos-mixed'),root.FoteChaosEnemyArt.ensureAssets(names),root.FoteChaosCurrentRenderer.ensureAssets()]);
  }
  function currentAt(x,y){
    var meta=floorMeta&&floorMeta.chaosCampaign;if(!meta)return null;
    var direction=meta.upAt&&x===meta.upAt.x&&y===meta.upAt.y?'up':meta.downAt&&x===meta.downAt.x&&y===meta.downAt.y?'down':null;
    if(direction==='up'&&meta.materialGate)return null;
    if(!direction)return null;
    var destination=floorNo+(direction==='up'?-1:1),name=destination===20?'the treasure room':'floor '+destination;
    var point=direction==='up'?meta.upAt:meta.downAt;
    return {x:x,y:y,direction:direction,destinationFloor:destination,targetFloor:destination,dx:Number.isFinite(point.dx)?point.dx:0,dy:Number.isFinite(point.dy)?point.dy:-1,label:'Current to '+name,
      hint:'A magical current carries you through the void to '+name+'. Ride it when you are ready.'};
  }
  function materialPortalInfo(x,y){
    var meta=floorMeta&&floorMeta.chaosCampaign;
    if(!meta||!meta.materialGate||floorNo!==21||x!==meta.upAt.x||y!==meta.upAt.y||at(x,y)!==PORTAL)return null;
    return {x:x,y:y,targetFloor:20,name:'Portal to the Material Plane',label:'Return to the Material Plane',hint:'This elemental gateway leads back to the treasure room beneath floor 20. The way to Chaos remains open.'};
  }
  function materialPortalPrompt(){
    var info=materialPortalInfo(player.x,player.y);if(!info)return false;
    var meta=floorMeta;stopTravel();
    setTimeout(function(){afterTurn(function(){
      if(floorMeta!==meta||player.hp<=0||RUN.over||RUN.victory||!materialPortalInfo(player.x,player.y))return;
      confirmBox(info.label,info.hint,'Step through',function(){if(!gameTurns.busy()&&floorMeta===meta&&materialPortalInfo(player.x,player.y))root.ascend();});
    });},0);return true;
  }
  function landing(preview,region){
    var choices=[],directions=[[0,-1],[1,0],[0,1],[-1,0]],bounds=region.bounds;
    function clear(x,y){return inb(x,y)&&preview.regionByCell[idxOf(x,y)]===region.id&&at(x,y)===FLOOR&&!propAt(x,y);}
    for(var y=bounds.y;y<bounds.y+bounds.h;y++)for(var x=bounds.x;x<bounds.x+bounds.w;x++){
      if(!clear(x,y)||preview.portals.some(function(p){return Math.max(Math.abs(p.x-x),Math.abs(p.y-y))<4;}))continue;
      var pad=true;for(var py=y-1;py<=y+1;py++)for(var px=x-1;px<=x+1;px++)if(!clear(px,py))pad=false;
      if(!pad)continue;
      directions.forEach(function(d){for(var n=2;n<=7;n++){
        var xx=x+d[0]*n,yy=y+d[1]*n;
        if(inb(xx,yy)&&at(xx,yy)===CHASM){choices.push({x:x,y:y,dx:d[0],dy:d[1],distance:n});break;}
        if(!clear(xx,yy))break;
      }});
    }
    choices.sort(function(a,b){return a.distance-b.distance||a.y-b.y||a.x-b.x;});
    if(!choices.length)throw new Error('Chaos island has no clear current landing: '+region.id);
    var point=choices[0];delete point.distance;return point;
  }
  function entryHint(){
    var current=currentAt(player.x,player.y);
    if(current){
      log(current.hint+' '+(document.body.classList.contains('touch')?'Tap it to travel.':'Press <b>'+(current.direction==='up'?'&lt;':'&gt;')+'</b> to ride the current.'),'c-kill');
      stopTravel();var meta=floorMeta;
      setTimeout(function(){afterTurn(function(){
        if(floorMeta!==meta||player.hp<=0||RUN.over||RUN.victory||player.x!==current.x||player.y!==current.y)return;
        confirmBox(current.label,current.hint,'Ride the current',function(){
          if(gameTurns.busy()||floorMeta!==meta||player.x!==current.x||player.y!==current.y)return;
          if(current.direction==='up')root.ascend();else root.descend();
        });
      });},0);return true;
    }
    if(entry()&&at(player.x,player.y)===UPSTAIRS){log('Stairs back to floor 20 and the Matron\'s hall.','c-kill');return true;}
    return false;
  }
  function build(n,seed,options){
    if(!handles(n))throw new Error('Chaos campaign floor must be between 21 and 25.');
    options=options||{};
    if(options.encounters===undefined&&RUN&&RUN.sandbox&&RUN.sandbox.config&&RUN.sandbox.config.location==='chaos-current-preview'&&RUN.sandbox.config.encounters===false)options={encounters:false};
    var clock=player.t,preview;
    if(n===25){root.FoteUnmakerEncounter.install(true);preview=root.FoteUnmakerPreview.build(seed);}
    else preview=root.FoteMixedChaosPreview.build(seed,{campaign:true});
    floorNo=n;floorMeta.floor=n;rng=mulberry32(seed>>>0);
    var up=n===25?{x:preview.spawn.x,y:preview.spawn.y,dx:0,dy:1}:landing(preview,preview.regions[0]),down=null;
    if(n<25){var last=preview.regions[preview.regions.length-1];down=landing(preview,last);}
    if(propAt(up.x,up.y)||at(up.x,up.y)!==FLOOR)throw new Error('Chaos arrival current has no clear landing.');
    setT(up.x,up.y,n===21?PORTAL:UPSTAIRS);floorMeta.upAt=up;
    player.x=up.x;player.y=up.y;preview.spawn={x:up.x,y:up.y};
    if(down){if(propAt(down.x,down.y)||at(down.x,down.y)!==FLOOR)throw new Error('Chaos departure current has no clear landing.');setT(down.x,down.y,STAIRS);}
    floorMeta.chaosCampaign={version:1,upAt:up,downAt:down,materialGate:n===21};
    floorMeta.shrine=false;delete floorMeta.shrineGod;
    if(n<25){
      floorMeta.notes=['Five islands drift in the void. Paired portals link their regions; a magical current on the final island carries you deeper.','There are no god shrines in the Realm of Chaos.'];
      if(options.encounters!==false)root.FoteChaosEncounters.populate(preview,{seed:seed});
    }
    player.t=clock;ents.forEach(function(e){e.t=clock;});
    if(typeof computeFOV==='function')computeFOV();
    return preview;
  }
  function stashEntry(){
    if(!RUN||!entry())return false;
    RUN.chaosEntryStash=FoteTransitions.capture(gameState);return true;
  }
  function refresh(){computeFOV();resize();updateUI();draw();playSceneMusic();}
  function restore(){
    if(!floorMeta||!floorMeta.chaosCampaign)return;
    floorMeta.shrine=false;delete floorMeta.shrineGod;
    if(floorNo===25){root.FoteUnmakerEncounter.install(true);root.FoteUnmakerPreview.repairGates();root.FoteUnmakerEncounter.restore();}
  }
  function restoreEntry(arrival){
    var saved=RUN.chaosEntryStash;if(!saved)return false;
    FoteTransitions.restore(gameState,saved,20);delete RUN.chaosEntryStash;
    presentRestoredFloor(arrival||{x:28,y:13});return true;
  }
  function descend(){
    if(!RUN||floorNo!==20||floorMeta.plane)return false;
    if(entry()){log('The portal leads to floor 21. Step into it to enter the Realm of Chaos.','c-info');return true;}
    if(!floorMeta.exitOpen){log('The Matron\'s gate is still sealed.','c-info');return true;}
    stashFloor();sfx('stairs');player.levitate=0;aiming=null;
    if(!restoreEntry(RUN.chaosEntryStash&&RUN.chaosEntryStash.floorMeta.upAt)){
      root.FoteChaosEntryPreview.build((worldSeed^0x54726561)>>>0);
    }
    log('Beyond the twentieth floor, a quiet treasure room waits before the portal to Chaos.','c-kill');
    refresh();writeSlot('auto','Chaos treasure room');return true;
  }
  function ascend(){
    if(entry()){
      var saved=RUN.floorStash&&RUN.floorStash[20];
      if(!saved){log('The way back to the Matron\'s hall is not available in this scenario.','c-info');return true;}
      stashEntry();sfx('stairs');player.levitate=0;
      restoreFloor(20,findTileIn(saved,EXIT)||findTileIn(saved,STAIRS));
      log('You return to floor 20 and the Matron\'s hall.','c-kill');playSceneMusic();writeSlot('auto','floor 20');return true;
    }
    if(floorNo!==21||!floorMeta.chaosCampaign)return false;
    if(!RUN.chaosEntryStash){log('The upstream current fades before reaching the treasure room.','c-info');return true;}
    stashFloor();sfx('stairs');player.levitate=0;restoreEntry({x:28,y:13});
    log('You step through the elemental gateway into the treasure room.','c-kill');playSceneMusic();writeSlot('auto','Chaos treasure room');return true;
  }
  function enterRealm(){
    if(pending)return pending;
    if(!entry()||!RUN||RUN.over||RUN.victory||player.hp<=0||gameTurns.busy())return Promise.resolve(false);
    var run=RUN,from=floorMeta,hero=player;
    openModal('Entering the Realm of Chaos','The portal is opening…',[]);
    pending=prepare().then(function(){
      if(RUN!==run||floorMeta!==from||player!==hero||player.hp<=0||RUN.over||gameTurns.busy())return false;
      var saved=FoteTransitions.capture(gameState),old={x:player.x,y:player.y,keys:player.keys,id:nextId,ents:ents,rng:rng,random:typeof rng.state==='function'?rng.state():null,piety:player.piety};
      try{
        stashEntry();
        var prior=RUN.floorStash&&RUN.floorStash[21];
        if(prior){restoreFloor(21,prior.floorMeta.upAt);sfx('stairs');}
        else generateNextFloor(false);
      }catch(error){
        FoteTransitions.restore(gameState,saved,20);player.x=old.x;player.y=old.y;player.keys=old.keys;player.piety=old.piety;nextId=old.id;ents=old.ents;
        rng=old.random===null?old.rng:mulberry32(old.random);delete RUN.chaosEntryStash;throw error;
      }
      closeModal();refresh();log('You enter <b>floor 21: the Realm of Chaos</b>. There are no god shrines beyond this point.','c-kill');
      writeSlot('auto','floor 21');return true;
    }).catch(function(error){
      if(RUN===run&&floorMeta===from)openModal('The portal could not open','Your character and the treasure room are unchanged. Please try again.',[{label:'Close',fn:closeModal}]);
      if(root.console&&console.error)console.error(error);return false;
    }).finally(function(){pending=null;});
    return pending;
  }
  root.FoteChaosCampaign=Object.freeze({handles:handles,prepare:prepare,build:build,currentAt:currentAt,currentInfo:currentAt,materialPortalInfo:materialPortalInfo,materialPortalPrompt:materialPortalPrompt,entryHint:entryHint,stashEntry:stashEntry,restore:restore,descend:descend,ascend:ascend,enterRealm:enterRealm});
})(globalThis);
