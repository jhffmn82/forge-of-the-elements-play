/* One decision entry point for every creature. Behaviors never spend time;
 * FoteActors commits exactly one action cost after the selected behavior. */
function canSeePlayer(e){
  if(player.hidden>0||e.st&&e.st.blind)return false;
  var sight=e&&e.base&&e.base.darksight&&typeof DEEP_RAWVIS!=='undefined'&&DEEP_RAWVIS?DEEP_RAWVIS:vis;
  for(var y=e.y;y<e.y+entitySize(e);y++)for(var x=e.x;x<e.x+entitySize(e);x++)if(inb(x,y)&&sight[idxOf(x,y)]&&
    (typeof FoteEnemyTeamwork==='undefined'||FoteEnemyTeamwork.openLine({x:x,y:y},player)))return true;
  return false;
}
function canActorMove(e){
  var base=e&&e.base||{};
  if(typeof FoteChaosEnemies!=='undefined'&&FoteChaosEnemies.holdsPosition(e))return false;
  return FoteActors.movementAllowed(e,gameEffects)&&!base.still&&!base.object&&!e.parent&&e.kind!=='mawlimb';
}
function actorFootprintAllowed(e,x,y,options){
  options=options||{};
  var n=entitySize(e);
  for(var yy=y;yy<y+n;yy++)for(var xx=x;xx<x+n;xx++){
    if(!inb(xx,yy)||!options.terrainOnly&&occupied(xx,yy,e))return false;
    if(typeof FoteChaosEnemies!=='undefined'&&!FoteChaosEnemies.cellAllowed(e,xx,yy))return false;
    var crucibleGate=typeof FoteUnmakerPreview!=='undefined'&&FoteUnmakerPreview.gateAt(xx,yy);
    if(crucibleGate&&!crucibleGate.open)return false;
    var tile=at(xx,yy);
    if(!(walkable(xx,yy)||(n===1&&options.doors&&tile===DOOR))||tile===CHASM||deepLava(xx,yy))return false;
    if(e.base.aquatic&&!eelWater(xx,yy))return false;
    if(options.avoidFire&&fireT[idxOf(xx,yy)]>0&&e.base.el!=='fire')return false;
  }
  return true;
}
function actorCellAllowed(e,x,y,dx,dy,options){
  if(!actorFootprintAllowed(e,x,y,options))return false;
  if(dx&&dy){
    if(entitySize(e)===1){if(!walkable(e.x+dx,e.y)&&!walkable(e.x,e.y+dy))return false;}
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
      if(e.hp>0&&plates)pressPlateAt(x,y,e);
    }
    return true;
  }
  return false;
}
function actorFootprintField(e,target,options){
  var field=new Int32Array(MW*MH).fill(-1),judged=new Int8Array(MW*MH),queue=[],n=entitySize(e),neighbors=FoteActors.neighbors;
  options=Object.assign({terrainOnly:true,doors:true},options||{});
  /* 2026-09-27 (Justin: "even non visible monsters are slowing down performance"). A search judges each cell
   * once; a wall used to be judged again by every neighbour, for every wanderer, every turn. Nothing changes
   * during one search, so the field and every step taken from it are the same. */
  function allowed(x,y){var i=idxOf(x,y);if(!judged[i])judged[i]=actorFootprintAllowed(e,x,y,options)?1:2;return judged[i]===1;}
  for(var y=target.y-n;y<=target.y+entitySize(target);y++)for(var x=target.x-n;x<=target.x+entitySize(target);x++){
    if(!inb(x,y)||dist({x:x,y:y,base:e.base},target)!==1||!allowed(x,y))continue;
    field[idxOf(x,y)]=0;queue.push({x:x,y:y});
  }
  for(var head=0;head<queue.length;head++){
    var p=queue[head];
    // A per-actor route only needs the gradient back to this actor. The shared
    // player field has no origin coordinates and still covers the whole floor.
    if(p.x===e.x&&p.y===e.y)break;
    for(var k=0;k<neighbors.length;k++){
      var dx=neighbors[k][0],dy=neighbors[k][1],nx=p.x+dx,ny=p.y+dy;
      if(!inb(nx,ny)||field[idxOf(nx,ny)]>=0||!allowed(nx,ny))continue;
      if(dx&&dy&&!allowed(nx,p.y)&&!allowed(p.x,ny))continue;
      field[idxOf(nx,ny)]=field[idxOf(p.x,p.y)]+1;queue.push({x:nx,y:ny});
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
function allyFollowStep(e){if(!PDIST||PDIST.targetX!==player.x||PDIST.targetY!==player.y)refreshPlayerDistance();return actorPathStep(e,player,PDIST)||stepToward(e,player.x,player.y);}
function fleeStep(e,threat){
  if(!canActorMove(e))return false;threat=threat||player;
  var step=FoteActors.bestStep(e,function(x,y){return dist({x:x,y:y},threat);},function(x,y,dx,dy){return actorCellAllowed(e,x,y,dx,dy);},true);
  return step?stepEnt(e,step.dx,step.dy):false;
}
function actorPrepare(context){
  var e=context.actor;
  if(e.shadowClone)e.cloneAction=null;
  if(e.pebbleSlam&&(e.state!=='hunt'||FoteActors.blocked(e,gameEffects)||e.x!==e.pebbleSlam.fromX||e.y!==e.pebbleSlam.fromY))clearPebbleSlam(e);
  if(e.challengeT&&--e.challengeT<=0){e.challenged=false;e.cowardMark=false;}
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
    if(gameEffects.has(e,'burn')&&combo('fire','air')){
      var damage=Math.max(1,Math.round(e.st.burn.d*resistMult(e,'fire')));
      dealDirectDamage(e,damage,'fire',e.lastHitBy||null,{tags:['periodic','movement']});floatText(e.x,e.y,String(damage),'fire');
      if(e.hp<=0){kill(e,player);return;}
    }
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
    actorBehavior('fear',function(e){return gameEffects.hasTag(e,'fear');},function(e){var threat=canSeePlayer(e)?player:e.lastSeen;if(threat)fleeStep(e,threat);return true;}),
    actorBehavior('immovable-object',function(e){return e.parent||e.base.object||e.kind==='mawlimb';},function(){return true;}),
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
    actorBehavior('elemental-plane',function(e){return inFwa()&&e.base.fwa;},elementalPlaneBehavior),
    actorBehavior('underdark',function(e){return !!e.base.deepAI;},deepCreatureBehavior),
    actorBehavior('caverns',function(e){return e.base.aquatic||e.base.spores||e.kind==='stormbeetle'||e.kind==='sparkjelly';},caveCreatureBehavior),
    actorBehavior('plane-traits',function(){return !!floorMeta.plane;},planeCreatureBehavior),
    actorBehavior('crypt-traits',function(e){var b=e.base;return b.reloads||b.summoner||b.phases;},function(e){return cryptCreatureBehavior(e);}),
    actorBehavior('ordinary-monster',function(e){return !!e.foe;},basicMonsterBehavior)
  ]
});
function aiAct(e){return gameActions.run('actor',e,null,{},function(event){event.result=gameActors.takeTurn(e);}).result;}
function allyAct(e){return aiAct(e);}
