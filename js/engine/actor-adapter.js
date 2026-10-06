/* One decision entry point for every creature. Behaviors never spend time;
 * FoteActors commits exactly one action cost after the selected behavior. */
function canSeePlayer(e){
  if(player.hidden>0||e.st&&e.st.blind)return false;
  var sight=e&&e.base&&e.base.darksight&&typeof DEEP_RAWVIS!=='undefined'&&DEEP_RAWVIS?DEEP_RAWVIS:
    typeof BLIND_RAWVIS!=='undefined'&&BLIND_RAWVIS?BLIND_RAWVIS:vis;
  for(var y=e.y;y<e.y+entitySize(e);y++)for(var x=e.x;x<e.x+entitySize(e);x++)if(inb(x,y)&&sight[idxOf(x,y)]&&
    (typeof FoteEnemyTeamwork==='undefined'||FoteEnemyTeamwork.openLine({x:x,y:y},player)))return true;
  return false;
}
function canActorMove(e){
  var base=e&&e.base||{};
  if(typeof FoteChaosEnemies!=='undefined'&&FoteChaosEnemies.holdsPosition(e))return false;
  return FoteActors.movementAllowed(e,gameEffects)&&!base.still&&!base.object&&!e.parent&&e.kind!=='mawlimb';
}
function actorFootprintAllowed(e,x,y,options,context){
  options=options||{};
  var n=entitySize(e);
  for(var yy=y;yy<y+n;yy++)for(var xx=x;xx<x+n;xx++){
    if(!inb(xx,yy,context)||!options.terrainOnly&&occupied(xx,yy,e))return false;
    if(typeof FoteChaosEnemies!=='undefined'&&!FoteChaosEnemies.cellAllowed(e,xx,yy))return false;
    var crucibleGate=typeof FoteUnmakerPreview!=='undefined'&&FoteUnmakerPreview.gateAt(xx,yy);
    if(crucibleGate&&!crucibleGate.open)return false;
    var tile=at(xx,yy,context);
    if(!(walkable(xx,yy,context)||(n===1&&options.doors&&tile===DOOR))||tile===CHASM||deepLava(xx,yy))return false;
    if(e.base.aquatic&&!eelWater(xx,yy))return false;
    if(options.avoidFire&&(context?context.fireT:fireT)[idxOf(xx,yy,context)]>0&&e.base.el!=='fire')return false;
  }
  return true;
}
function actorCornerCellAllowed(e,x,y,options,context){
  // Companions may round furniture on open floor, as the player does. The
  // destination still uses full collision; walls, pillars and gaps stay solid.
  if(!e.ally)return walkable(x,y,context);
  if(!inb(x,y,context)||at(x,y,context)===CHASM||deepLava(x,y))return false;
  if(options&&options.avoidFire&&(context?context.fireT:fireT)[idxOf(x,y,context)]>0&&e.base.el!=='fire')return false;
  if(walkable(x,y,context))return true;
  var prop=typeof propAt==='function'&&propAt(x,y,context);
  return !!(prop&&prop.b&&!prop.pillar&&!prop.set&&typeof terrainRules!=='undefined'&&terrainRules.walkable(at(x,y,context),false,(context?context.floorMeta:floorMeta).exitOpen));
}
function actorCellAllowed(e,x,y,dx,dy,options){
  if(!actorFootprintAllowed(e,x,y,options))return false;
  if(dx&&dy){
    if(entitySize(e)===1){if(!actorCornerCellAllowed(e,e.x+dx,e.y,options)&&!actorCornerCellAllowed(e,e.x,e.y+dy,options))return false;}
    else if(!actorFootprintAllowed(e,e.x+dx,e.y,options)&&!actorFootprintAllowed(e,e.x,e.y+dy,options))return false;
  }
  return true;
}
function stepEnt(e,dx,dy){
  if(!canActorMove(e))return false;
  var choices=FoteActors.candidates(dx,dy);
  for(var i=0;i<choices.length;i++){
    var mx=choices[i][0],my=choices[i][1],x=e.x+mx,y=e.y+my;
    if(!actorCellAllowed(e,x,y,mx,my,{doors:true}))continue;
    if(at(x,y)===DOOR){setT(x,y,OPEN);computeFOV();if(vis[idxOf(x,y)]){log('A door swings open.','c-info');sfx('door-open',{from:{x:x,y:y}});}return true;}
    if(mx)e.facingLeft=mx<0;e.x=x;e.y=y;   /* 2026-09-28 (Justin: 'zombie sprites move backwards'): every creature faces the way it steps, not only allies */
    if(!e.base.flying){
      if(gAt(x,y)===G_GRASS)setG(x,y,G_SHORT);
      var trap=feats.find(function(f){return f.x===x&&f.y===y;});if(trap)triggerTrap(trap,e);
      if(e.hp>0&&ents.includes(e)&&plates)pressPlateAt(x,y,e);
    }
    return true;
  }
  return false;
}
function actorFootprintField(e,target,options){
  var mapWidth=MW,mapHeight=MH,frame=typeof FRAME_MAP!=='undefined'&&FRAME_MAP;
  var width=frame?FRAME_MW:mapWidth,height=frame?FRAME_MH:mapHeight;
  var context=typeof geometryQueryContext==='function'?geometryQueryContext(width,height,frame):null;
  var field=new Int32Array(mapWidth*mapHeight).fill(-1),judged=new Int8Array(mapWidth*mapHeight),queue=[],n=entitySize(e),neighbors=FoteActors.neighbors;
  options=Object.assign({terrainOnly:true,doors:true},options||{});
  // Bounds and indices stay fixed during this synchronous search. Keep the
  // frame view used by inb/idxOf, without reading run-state getters per edge.
  function inside(x,y){return x>=0&&y>=0&&x<width&&y<height;}
  /* 2026-09-27 (Justin: "even non visible monsters are slowing down performance"). A search judges each cell
   * once; a wall used to be judged again by every neighbour, for every wanderer, every turn. Nothing changes
   * during one search, so the field and every step taken from it are the same. */
  function allowed(x,y){var i=y*width+x;if(!judged[i])judged[i]=actorFootprintAllowed(e,x,y,options,context)?1:2;return judged[i]===1;}
  for(var y=target.y-n;y<=target.y+entitySize(target);y++)for(var x=target.x-n;x<=target.x+entitySize(target);x++){
    if(!inside(x,y)||dist({x:x,y:y,base:e.base},target)!==1||!allowed(x,y))continue;
    // A diagonal behind two walls is not a reachable place beside the target.
    // Use the same corner rule as the eventual movement step.
    if(n===1&&entitySize(target)===1&&x!==target.x&&y!==target.y&&!actorCornerCellAllowed(e,x,target.y,options,context)&&!actorCornerCellAllowed(e,target.x,y,options,context))continue;
    field[y*width+x]=0;queue.push({x:x,y:y});
  }
  for(var head=0;head<queue.length;head++){
    var p=queue[head];
    // A per-actor route only needs the gradient back to this actor. The shared
    // player field has no origin coordinates and still covers the whole floor.
    if(p.x===e.x&&p.y===e.y)break;
    var nextDistance=field[p.y*width+p.x]+1;
    for(var k=0;k<neighbors.length;k++){
      var dx=neighbors[k][0],dy=neighbors[k][1],nx=p.x+dx,ny=p.y+dy,index=ny*width+nx;
      if(!inside(nx,ny)||field[index]>=0||!allowed(nx,ny))continue;
      if(dx&&dy){
        if(n===1&&e.ally){if(!actorCornerCellAllowed(e,nx,p.y,options,context)&&!actorCornerCellAllowed(e,p.x,ny,options,context))continue;}
        else if(!allowed(nx,p.y)&&!allowed(p.x,ny))continue;
      }
      field[index]=nextDistance;queue.push({x:nx,y:ny});
    }
  }
  return field;
}
function actorPathStep(e,target,field){
  if(!canActorMove(e))return false;
  field=entitySize(e)>1||e.base.aquatic?actorFootprintField(e,target):(field||actorFootprintField(e,target));
  // Equally short routes should close toward the destination, not favor the
  // cardinal neighbors simply because they appear first in the shared list.
  function select(){return FoteActors.bestStep(e,function(x,y){return inb(x,y)?field[idxOf(x,y)]:-1;},function(x,y,dx,dy){return actorCellAllowed(e,x,y,dx,dy,{doors:true,avoidFire:true});},false,function(x,y){return (x-target.x)*(x-target.x)+(y-target.y)*(y-target.y);});}
  var step=select();
  if(!step&&dist(e,target)>1){
    // The shared field ignores bodies. If its next step is occupied, route around
    // the obstruction instead of repeatedly walking straight into it.
    field=actorFootprintField(e,target,{terrainOnly:false,doors:true,avoidFire:true});step=select();
  }
  return step?stepEnt(e,step.dx,step.dy):false;
}
function stepToward(e,x,y){
  if(!canActorMove(e))return false;
  return actorPathStep(e,{x:x,y:y})||stepEnt(e,Math.sign(x-e.x),Math.sign(y-e.y));
}
function chaseStep(e){
  if(!canSeePlayer(e))return typeof FoteEnemyPerception!=='undefined'?FoteEnemyPerception.investigate(e):e.lastSeen&&stepToward(e,e.lastSeen.x,e.lastSeen.y);
  if(typeof FoteEnemyPerception!=='undefined')FoteEnemyPerception.remember(e,player,'sight');
  if(!PDIST||PDIST.targetX!==player.x||PDIST.targetY!==player.y)refreshPlayerDistance();return actorPathStep(e,player,PDIST)||stepToward(e,player.x,player.y);
}
function allyFollowStep(e){
  if(!PDIST||PDIST.targetX!==player.x||PDIST.targetY!==player.y)refreshPlayerDistance();
  var field=entitySize(e)>1||e.base.aquatic||PDIST[idxOf(e.x,e.y)]<0?actorFootprintField(e,player):PDIST,distance=field[idxOf(e.x,e.y)];
  // Stay within two legal steps, rather than two tiles through a wall.
  // The field's zero is a reachable tile adjacent to the player.
  if(distance>=0&&distance<=1)return false;
  return actorPathStep(e,player,field)||stepToward(e,player.x,player.y);
}
function allyArrivalSpot(e){
    // Search outward through legal movement cells. A random tile in a square
    // can put an ally across a wall, ahead of the player's exploration.
    var queue=[{x:player.x,y:player.y,steps:0}],visited=new Set([idxOf(player.x,player.y)]);
    for(var head=0;head<queue.length;head++){
      var p=queue[head],probe=Object.assign({},e,{x:p.x,y:p.y});
      if(p.steps>0&&!occupied(p.x,p.y)&&!feats.some(function(f){return f.x===p.x&&f.y===p.y;}))return p;
      if(p.steps>=4)continue;
      FoteActors.neighbors.forEach(function(d){
        var x=p.x+d[0],y=p.y+d[1],index=idxOf(x,y);
        if(visited.has(index)||!actorCellAllowed(probe,x,y,d[0],d[1],{terrainOnly:true,avoidFire:true}))return;
        visited.add(index);queue.push({x:x,y:y,steps:p.steps+1});
      });
    }
    return null;
  }
function fleeStep(e,threat){
  if(!canActorMove(e))return false;threat=threat||player;
  var step=FoteActors.bestStep(e,function(x,y){return dist({x:x,y:y},threat);},function(x,y,dx,dy){return actorCellAllowed(e,x,y,dx,dy);},true);
  return step?stepEnt(e,step.dx,step.dy):false;
}
function actorPrepare(context){
  var e=context.actor;
  if(typeof FoteEnemyPerception!=='undefined'&&FoteEnemyPerception.libraryDormant(e))return true;
  if(e.shadowClone)e.cloneAction=null;
  if(e.pebbleSlam&&(e.state!=='hunt'||FoteActors.blocked(e,gameEffects)||e.x!==e.pebbleSlam.fromX||e.y!==e.pebbleSlam.fromY))clearPebbleSlam(e);
  if(e.smokeLost&&(e.state==='hunt'||!smokeActive()))e.smokeLost=false;
  if(e.kind==='matron'){
    var matron=matronState();
    if(matron&&matron.rit&&(gameEffects.hasTag(e,'stun')||gameEffects.hasTag(e,'frozen')||gameEffects.hasTag(e,'fear')||matron.rit.hp0-e.hp>=matron.rit.need)){
      matronBreak(e,matron);return true;
    }
  }
  if(!e.foe||e.base.boss)return false;
  context.sawPlayer=canSeePlayer(e);
  e.surprised=false;
  return false;
}
function actorFinish(context){
  var e=context.actor;if(e.hp<=0||!ents.includes(e))return;
  if(typeof FoteGreenSlime!=='undefined')FoteGreenSlime.moved(e,context.x,context.y);
  if((e.x!==context.x||e.y!==context.y)&&typeof FoteEnemyFields!=='undefined')FoteEnemyFields.enter(e);
  if((e.x!==context.x||e.y!==context.y)&&typeof FoteSporecaller!=='undefined'){
    FoteSporecaller.trample(e);if(e.hp<=0)return;
  }
  if(e.foe&&(e.x!==context.x||e.y!==context.y)){
    if(rootG&&rootG[idxOf(e.x,e.y)]&&!gameEffects.airborne(e))applyStatus(e,'root',1);
  }
  if(e.foe&&!e.base.boss&&!MAPVIEW.on){
    var see=canSeePlayer(e);
    // Move first, then notice from the resulting position. This also catches
    // the step around a corner, rather than waiting for another actor action.
    if(see&&e.state==='wander'&&(e.x!==context.x||e.y!==context.y)&&typeof FoteEnemyPerception!=='undefined'){
      if(FoteEnemyPerception.notice(e))e.surprised=true;
    }
    if(see&&e.state==='hunt'){
      if(typeof FoteEnemyPerception!=='undefined')FoteEnemyPerception.remember(e,player,'sight');
      if(context.state!=='hunt')e.surprised=true;
      else if(!FoteActors.blocked(e,gameEffects)&&(!context.sawPlayer||(e._lostFor||0)>=SURPRISE_LOST)){
        e.surprised=true;
        log('The <b>'+e.name+'</b> spots you!','c-info');if(e.base.sfx)sfx(e.base.sfx+'-alert',{from:e});
      }
    }
    e._lostFor=see?0:e.state==='hunt'?(e._lostFor||0)+1:0;
  }
}
function actorBehavior(name,when,run){return {name:name,when:when,run:run};}
var gameActors=FoteActors.create({
  present:function(e){return ents.includes(e);},
  cost:actCost,before:actorPrepare,after:actorFinish,
  blocked:function(e){return MAPVIEW.on&&e.foe?'map-view':FoteActors.blocked(e,gameEffects);},
  behaviors:[
    actorBehavior('hungry-spider',function(e){return typeof hungrySpiderAct==='function'&&hungrySpiderAct(e);},function(){return true;}),
    actorBehavior('escapee',function(e){return !!e.escapee;},escapeeAct),
    actorBehavior('prison-pursuit',function(e){return !!e.prisonTarget;},prisonPursuit),
    actorBehavior('fear',function(e){return gameEffects.hasTag(e,'fear');},function(e){var threat=canSeePlayer(e)?player:e.lastSeen;if(threat)fleeStep(e,threat);return true;}),
    actorBehavior('immovable-object',function(e){return e.parent||e.base.object||e.kind==='mawlimb';},function(){return true;}),
    actorBehavior('ritual-channel',function(e){return e.kind==='drowpriestess';},ritualChannel),
    actorBehavior('perception',function(e){return e.foe&&!e.ally&&typeof FoteEnemyPerception!=='undefined';},function(e){return FoteEnemyPerception.takeTurn(e);}),
    actorBehavior('morty',function(e){return e.kind==='morty';},function(e){mortyAct(e);return true;}),
    actorBehavior('deep-maw',function(e){return e.kind==='deepmaw';},function(e){mawAct(e);return true;}),
    actorBehavior('matron',function(e){return e.kind==='matron';},function(e){matronAct(e);return true;}),
    actorBehavior('unmaker',function(e){return e.base.encounterId==='unmaker'&&typeof FoteUnmakerEncounter!=='undefined';},function(e){return FoteUnmakerEncounter.act(e);}),
    actorBehavior('shadow-clone',function(e){return e.shadowClone&&typeof FoteShadowClone!=='undefined';},function(e){return FoteShadowClone.act(e);}),
    actorBehavior('living-flame',function(e){return e.ally&&e.rangedAlly;},function(e){livingFlameBehavior(e);return true;}),
    actorBehavior('ally',function(e){return e.ally;},basicAllyBehavior),
    actorBehavior('chaos-preview',function(e){return !!e.base.chaosAI&&typeof FoteChaosEnemies!=='undefined';},function(e){return FoteChaosEnemies.act(e);}),
    actorBehavior('local-teamwork',function(e){return typeof FoteEnemyTeamwork!=='undefined'&&!!FoteEnemyTeamwork.family(e);},function(e){return FoteEnemyTeamwork.takeTurn(e);}),
    actorBehavior('summon-retaliation',function(e){return e.foe&&!e.base.boss;},petRetaliationBehavior),
    actorBehavior('sporecaller',function(e){return !!e.base.sporecaller;},function(e){return FoteSporecaller.act(e);}),
    actorBehavior('elemental-plane',function(e){return (inFwa()||e.planeEncounter)&&e.base.fwa;},elementalPlaneBehavior),
    actorBehavior('underdark',function(e){return !!e.base.deepAI;},deepCreatureBehavior),
    actorBehavior('caverns',function(e){return e.base.aquatic||e.base.spores||e.base.caveSpell||e.kind==='stormbeetle'||e.kind==='sparkjelly';},caveCreatureBehavior),
    actorBehavior('plane-traits',function(e){return !!floorMeta.plane||!!e.planeEncounter;},planeCreatureBehavior),
    actorBehavior('crypt-traits',function(e){var b=e.base;return b.reloads||b.summoner||b.phases;},function(e){return cryptCreatureBehavior(e);}),
    actorBehavior('ordinary-monster',function(e){return !!e.foe;},basicMonsterBehavior)
  ]
});
function aiAct(e){return gameActions.run('actor',e,null,{},function(event){event.result=gameActors.takeTurn(e);}).result;}
function allyAct(e){return aiAct(e);}
