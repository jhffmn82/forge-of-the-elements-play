/* One decision entry point for every creature. Behaviors never spend time;
 * FoteActors commits exactly one action cost after the selected behavior. */
function canSeePlayer(e){
  if(player.hidden>0)return false;
  if(e&&e.base&&e.base.darksight&&DEEP_RAWVIS)return !!DEEP_RAWVIS[idxOf(e.x,e.y)];
  for(var y=e.y;y<e.y+entitySize(e);y++)for(var x=e.x;x<e.x+entitySize(e);x++)if(inb(x,y)&&vis[idxOf(x,y)])return true;
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
    if(at(x,y)===DOOR){setT(x,y,OPEN);if(vis[idxOf(x,y)]){log('A door swings open.','c-info');sfx('door-open');}return true;}
    if(e.ally&&mx)e.facingLeft=mx<0;e.x=x;e.y=y;
    if(!e.base.flying){
      if(gAt(x,y)===G_GRASS)setG(x,y,G_SHORT);
      var trap=feats.find(function(f){return f.x===x&&f.y===y;});if(trap)triggerTrap(trap,e);
      if(e.hp>0&&plates)pressPlateAt(x,y,e);
    }
    return true;
  }
  return false;
}
function actorFootprintField(e,target){
  var field=new Int32Array(MW*MH).fill(-1),queue=[],n=entitySize(e),options={terrainOnly:true};
  for(var y=target.y-n;y<=target.y+entitySize(target);y++)for(var x=target.x-n;x<=target.x+entitySize(target);x++){
    if(!inb(x,y)||dist({x:x,y:y,base:e.base},target)!==1||!actorFootprintAllowed(e,x,y,options))continue;
    field[idxOf(x,y)]=0;queue.push({x:x,y:y});
  }
  for(var head=0;head<queue.length;head++){
    var p=queue[head];
    FoteActors.neighbors.forEach(function(offset){
      var x=p.x+offset[0],y=p.y+offset[1];
      if(!inb(x,y)||field[idxOf(x,y)]>=0||!actorFootprintAllowed(e,x,y,options))return;
      if(offset[0]&&offset[1]&&!actorFootprintAllowed(e,x,p.y,options)&&!actorFootprintAllowed(e,p.x,y,options))return;
      field[idxOf(x,y)]=field[idxOf(p.x,p.y)]+1;queue.push({x:x,y:y});
    });
  }
  return field;
}
function actorPathStep(e,target,field){
  if(!canActorMove(e))return false;
  field=entitySize(e)>1?actorFootprintField(e,target):(field||bfsFrom(target.x,target.y));
  var step=FoteActors.bestStep(e,function(x,y){return inb(x,y)?field[idxOf(x,y)]:-1;},function(x,y,dx,dy){return actorCellAllowed(e,x,y,dx,dy,{doors:true,avoidFire:true});});
  return step?stepEnt(e,step.dx,step.dy):false;
}
function stepToward(e,x,y){
  if(!canActorMove(e))return false;
  return actorPathStep(e,{x:x,y:y})||stepEnt(e,Math.sign(x-e.x),Math.sign(y-e.y));
}
function chaseStep(e){if(!PDIST)refreshPlayerDistance();return actorPathStep(e,player,PDIST)||stepToward(e,player.x,player.y);}
function allyFollowStep(e){if(!PDIST)refreshPlayerDistance();return actorPathStep(e,player,PDIST)||stepToward(e,player.x,player.y);}
function fleeStep(e,threat){
  if(!canActorMove(e))return false;threat=threat||player;
  var step=FoteActors.bestStep(e,function(x,y){return dist({x:x,y:y},threat);},function(x,y,dx,dy){return actorCellAllowed(e,x,y,dx,dy);},true);
  return step?stepEnt(e,step.dx,step.dy):false;
}
function actorPrepare(context){
  var e=context.actor;
  if(e.challengeT&&--e.challengeT<=0){e.challenged=false;e.cowardMark=false;}
  if(e.smokeLost&&(e.state==='hunt'||!smokeActive()))e.smokeLost=false;
  if(e.kind==='matron'){
    var matron=matronState();
    if(matron&&matron.rit&&(gameEffects.hasTag(e,'stun')||gameEffects.hasTag(e,'frozen')||gameEffects.hasTag(e,'fear')||matron.rit.hp0-e.hp>=matron.rit.need)){
      matronBreak(e,matron);return true;
    }
  }
  if(!e.foe||e.base.boss)return false;
  e.surprised=false;
  if(!MAPVIEW.on&&!FoteActors.blocked(e,gameEffects)&&canSeePlayer(e)&&e.state==='hunt'&&(e._lostFor||0)>=SURPRISE_LOST){
    e._lostFor=0;e.surprised=true;e.lastSeen={x:player.x,y:player.y};
    log('The <b>'+e.name+'</b> spots you!','c-info');if(e.base.sfx)sfx(e.base.sfx+'-alert');return true;
  }
  return false;
}
function actorFinish(context){
  var e=context.actor;if(e.hp<=0||!ents.includes(e))return;
  if(e.foe&&(e.x!==context.x||e.y!==context.y)){
    if(rootG&&rootG[idxOf(e.x,e.y)])applyStatus(e,'root',1);
    if(gameEffects.has(e,'burn')&&combo('fire','air')){
      var damage=Math.max(1,Math.round(e.st.burn.d*resistMult(e,'fire')));
      dealDirectDamage(e,damage,'fire',e.lastHitBy||null,{tags:['periodic','movement']});floatText(e.x,e.y,String(damage),'fire');
      if(e.hp<=0){kill(e,player);return;}
    }
  }
  if(e.foe&&!e.base.boss&&!MAPVIEW.on){
    var see=canSeePlayer(e);if(context.state!=='hunt'&&e.state==='hunt'&&see)e.surprised=true;
    e._lostFor=see?0:e.state==='hunt'?(e._lostFor||0)+1:0;
  }
}
function actorBehavior(name,when,run){return {name:name,when:when,run:run};}
var gameActors=FoteActors.create({
  present:function(e){return ents.includes(e);},cost:function(e){return actCost(e);},before:actorPrepare,after:actorFinish,
  blocked:function(e){return MAPVIEW.on&&e.foe?'map-view':FoteActors.blocked(e,gameEffects);},
  behaviors:[
    actorBehavior('fear',function(e){return gameEffects.hasTag(e,'fear');},function(e){fleeStep(e);return true;}),
    actorBehavior('immovable-object',function(e){return e.parent||e.base.object||e.kind==='mawlimb';},function(){return true;}),
    actorBehavior('morty',function(e){return e.kind==='morty';},function(e){mortyAct(e);return true;}),
    actorBehavior('deep-maw',function(e){return e.kind==='deepmaw';},function(e){mawAct(e);return true;}),
    actorBehavior('matron',function(e){return e.kind==='matron';},function(e){matronAct(e);return true;}),
    actorBehavior('unmaker',function(e){return e.base.encounterId==='unmaker'&&typeof FoteUnmakerEncounter!=='undefined';},function(e){return FoteUnmakerEncounter.act(e);}),
    actorBehavior('shadow-clone',function(e){return e.shadowClone&&typeof FoteShadowClone!=='undefined';},function(e){return FoteShadowClone.act(e);}),
    actorBehavior('living-flame',function(e){return e.ally&&e.rangedAlly;},function(e){livingFlameBehavior(e);return true;}),
    actorBehavior('ally',function(e){return e.ally;},basicAllyBehavior),
    actorBehavior('chaos-preview',function(e){return !!e.base.chaosAI&&typeof FoteChaosEnemies!=='undefined';},function(e){return FoteChaosEnemies.act(e);}),
    actorBehavior('summon-retaliation',function(e){return e.foe&&!e.base.boss;},petRetaliationBehavior),
    actorBehavior('elemental-plane',function(e){return inFwa()&&e.base.fwa;},elementalPlaneBehavior),
    actorBehavior('underdark',function(e){return !!e.base.deepAI;},deepCreatureBehavior),
    actorBehavior('caverns',function(e){return e.base.aquatic||e.base.spores||e.kind==='stormbeetle'||e.kind==='sparkjelly';},caveCreatureBehavior),
    actorBehavior('plane-traits',function(){return !!floorMeta.plane;},planeCreatureBehavior),
    actorBehavior('crypt-traits',function(e){var b=e.base;return b.reloads||b.summoner||b.phases;},cryptCreatureBehavior),
    actorBehavior('ordinary-monster',function(e){return !!e.foe;},basicMonsterBehavior)
  ]
});
function aiAct(e){return gameActions.run('actor',e,null,{},function(event){event.result=gameActors.takeTurn(e);}).result;}
function allyAct(e){return aiAct(e);}
