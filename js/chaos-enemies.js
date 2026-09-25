/* Local Chaos combat content. All numbers are provisional endgame tuning.
 * The ordinary actor scheduler, damage pipeline and status clock own timing;
 * this module only describes one enemy decision and finite floor hazards. */
(function(root){
  'use strict';
  var groups={
    'prism-archives':['prism-seer','folded-horror','rift-skitter','lens-bearer'],
    'rot-hollows':['plague-bloat','brood-carrier','bile-spitter','rotling'],
    'cinder-bastion':['horned-reaver','gorehound','ironbound','chain-reaver'],
    'violet-warrens':['lash-dancer','razor-dancer','silk-weaver','hookfang']
  };
  var content={
    'prism-seer':{name:'Prism Seer',hp:225,dmg:[18,26],acc:76,eva:22,armor:2,speed:95,art:1.05,spellcaster:true},
    'folded-horror':{name:'Folded Horror',hp:270,dmg:[27,38],acc:73,eva:14,armor:4,speed:85,art:1.18},
    'rift-skitter':{name:'Rift Skitter',hp:225,dmg:[15,23],acc:75,eva:33,armor:1,speed:135,art:.75},
    'lens-bearer':{name:'Lens Bearer',hp:225,dmg:[11,15],acc:69,eva:15,armor:4,speed:90,art:1.05},
    'plague-bloat':{name:'Plague Bloat',hp:390,dmg:[30,42],acc:70,eva:9,armor:3,speed:65,art:1.28},
    'brood-carrier':{name:'Brood Carrier',hp:285,dmg:[14,21],acc:69,eva:12,armor:3,speed:85,art:1.14},
    'bile-spitter':{name:'Bile Spitter',hp:225,dmg:[9,15],acc:73,eva:20,armor:2,speed:95,art:.9},
    'rotling':{name:'Rotling',hp:63,dmg:[11,15],acc:70,eva:26,armor:0,speed:125,art:.64,rots:true},
    'horned-reaver':{name:'Horned Reaver',hp:263,dmg:[27,38],acc:75,eva:18,armor:4,speed:95,art:1.08},
    'gorehound':{name:'Gorehound',hp:225,dmg:[21,30],acc:74,eva:24,armor:3,speed:110,art:1.0},
    'ironbound':{name:'Ironbound',hp:368,dmg:[18,26],acc:71,eva:10,armor:9,speed:75,art:1.16},
    'chain-reaver':{name:'Chain Reaver',hp:225,dmg:[17,26],acc:77,eva:21,armor:3,speed:95,art:1.03},
    'lash-dancer':{name:'Lash Dancer',hp:225,dmg:[18,26],acc:78,eva:29,armor:2,speed:110,art:1.02},
    'razor-dancer':{name:'Razor Dancer',hp:225,dmg:[18,26],acc:77,eva:31,armor:2,speed:130,art:.95},
    'silk-weaver':{name:'Silk Weaver',hp:225,dmg:[9,15],acc:74,eva:22,armor:2,speed:90,art:.93},
    'hookfang':{name:'Hookfang',hp:240,dmg:[24,33],acc:74,eva:18,armor:4,speed:100,art:1.04}
  };
  var immunities={
    'prism-seer':['blind'],'folded-horror':['fear'],'rift-skitter':['slow'],'lens-bearer':['stun'],
    'plague-bloat':['poison','slow'],'brood-carrier':['poison','fear'],'bile-spitter':['poison','blind'],'rotling':['poison','fear'],
    'horned-reaver':['fear'],'gorehound':['fear'],'ironbound':['stun','knockback'],'chain-reaver':['root'],
    'lash-dancer':['fear'],'razor-dancer':['slow'],'silk-weaver':['root'],'hookfang':['fear']
  };
  // Reuse the recorded creature voices. The shared combat and death pipelines
  // play these on the animation's impact frame; no per-turn vocal loops.
  var voices={
    'prism-seer':'wisp','folded-horror':'mimic','rift-skitter':'imp','lens-bearer':'elementaling',
    'plague-bloat':'zombie','brood-carrier':'slime','bile-spitter':'slime','rotling':'imp',
    'horned-reaver':'brute','gorehound':'hound','ironbound':'golem','chain-reaver':'brute',
    'lash-dancer':'drow','razor-dancer':'drow','silk-weaver':'spider','hookfang':'spider'
  };
  // Rewards remain stable across difficulty tuning and older sandbox saves.
  var rewards={'prism-seer':68,'folded-horror':81,'rift-skitter':68,'lens-bearer':68,
    'plague-bloat':117,'brood-carrier':86,'bile-spitter':68,'rotling':19,
    'horned-reaver':79,'gorehound':68,'ironbound':110,'chain-reaver':68,
    'lash-dancer':68,'razor-dancer':68,'silk-weaver':68,'hookfang':72};
  Object.keys(groups).forEach(function(biome){groups[biome].forEach(function(slug){
    var row=content[slug],kind='chaos-'+slug;row.sfx=voices[slug];
    if(slug==='lash-dancer'||slug==='razor-dancer'){row.spawnInvisible=true;}
    row.statusImmunities=immunities[slug];
    MONSTERS[kind]=Object.assign({sprite:'m-'+kind,ch:row.name.charAt(0),col:biome==='rot-hollows'?'#A0C85A':biome==='prism-archives'?'#84CCEE':biome==='cinder-bastion'?'#D97555':'#C998E8',
      range:1,xp:rewards[slug],band:[99,99],w:0,living:true,artLeft:false,chaosAI:true,chaosBiome:biome},row);
    DROPS[kind]={chance:.22,table:{essence:12,gear:3,food:2}};
  });});
  if(typeof STATUS_INFO!=='undefined'){
    STATUS_INFO.chaoslens={name:'Lens Shield',icon:'ic-arcane-ward',d:'A finite lens shield absorbs damage. It cannot stack and expires after four world turns.'};
    STATUS_INFO.chaosbrace={name:'Iron Brace',icon:'ic-arcane-ward',d:'Stays in place and takes 45% less damage for two world turns. Still vulnerable.'};
  }
  var elements=['fire','ice','lightning'];
  function sound(name,volume){if(typeof sfx==='function')sfx(name,{vol:volume===undefined?.7:volume});}
  function castSound(element){return element==='poison'?'status-poison':element==='web'?'trap-web':element+'-cast';}
  function active(){return !!(floorMeta&&floorMeta.chaosPreview);}
  function state(){return floorMeta.chaosCombat||(floorMeta.chaosCombat={version:1,damageVersion:2,hazards:[],nextHazard:1});}
  function regionAt(x,y){return active()&&inb(x,y)?floorMeta.chaosPreview.regionByCell[idxOf(x,y)]:null;}
  function sameRegion(a,b){return !!regionAt(a.x,a.y)&&regionAt(a.x,a.y)===regionAt(b.x,b.y);}
  function now(){return worldNow();}
  function kindsForBiome(biome){return (groups[biome]||[]).map(function(slug){return 'chaos-'+slug;});}
  function spawnEnemy(kind,x,y,options){
    options=options||{};var base=MONSTERS[kind],region=regionAt(x,y);
    if(!active()||!base||!base.chaosAI||!region||!walkable(x,y)||at(x,y)===PORTAL||occupied(x,y)||options.regionId&&options.regionId!==region)return null;
    // spawnRaw remains the sole actor constructor. Its incidental castCd roll
    // is isolated so authoring a preview cannot consume combat/loot randomness.
    var previous=rng,e;
    try{rng=mulberry32((floorMeta.chaosPreview.seed^x*73856093^y*19349663^nextId)>>>0);e=spawnRaw(kind,x,y);}finally{rng=previous;}
    e.state=options.state||'asleep';e.castCd=options.castCd===undefined?1:options.castCd;e.chaosRegionId=region;
    e.chaosCooldown=now()+100;e.chaosNextElement='fire';e.chaosBorn=0;e.beta11Balanced=true;
    if(options.offspring){e.noXp=true;e.noReward=true;e.chaosOwnerId=options.ownerId;}
    return e;
  }
  function land(x,y,region){return inb(x,y)&&regionAt(x,y)===region&&walkable(x,y)&&at(x,y)!==CHASM&&at(x,y)!==PORTAL;}
  function line(e,target,max){
    if(!sameRegion(e,target)||dist(e,target)>max)return [];
    var path=boltPath(e.x,e.y,target.x,target.y),out=[];
    for(var i=0;i<path.length;i++){var p=path[i];if(!land(p.x,p.y,regionAt(e.x,e.y)))break;out.push([p.x,p.y]);if(ents.some(function(o){return o!==e&&o.hp>0&&o.x===p.x&&o.y===p.y;}))break;}
    return out;
  }
  function reaches(tiles,target){return tiles.some(function(t){return t[0]===target.x&&t[1]===target.y;});}
  function targetFor(e){
    var candidates=[player].concat(ents.filter(function(o){return o!==player&&o.ally&&o.hp>0;})).filter(function(o){return o.hp>0&&sameRegion(e,o)&&(o===player?canSeePlayer(e):dist(e,o)<=6&&clearShot(e,o));});
    candidates.sort(function(a,b){
      var wound=e.kind==='chaos-razor-dancer'?(gameEffects.has(b,'bleed')?1:0)-(gameEffects.has(a,'bleed')?1:0):0;
      return wound||dist(e,a)-dist(e,b)||(a===player?-1:1);
    });return candidates[0]||null;
  }
  // Alert only this pack and nearby same-island allies; recipients do not
  // relay alerts, so one fight cannot wake every island or track a hidden player.
  function alertPack(e,target){
    if(!active()||!e||!e.base||!e.base.chaosAI||!target)return;
    var region=regionAt(e.x,e.y);if(!region||region!==regionAt(target.x,target.y))return;
    e.chaosAlerted=true;
    ents.forEach(function(ally){
      if(!ally.foe||ally.hp<=0||!ally.base||!ally.base.chaosAI||regionAt(ally.x,ally.y)!==region)return;
      var grouped=e.chaosEncounterGroup!==undefined&&ally.chaosEncounterGroup===e.chaosEncounterGroup;
      if(ally!==e&&!grouped&&dist(e,ally)>6)return;
      ally.state='hunt';ally.chaosAlerted=true;ally._lostFor=0;
      ally.lastSeen={x:target.x,y:target.y};
    });
  }
  function onDamaged(event){
    var e=event.target,source=event.source==='player'?player:event.source;
    if(event.damage>0&&e&&e.base&&e.base.chaosAI&&source&&(source===player||source.ally))alertPack(e,source);
  }
  function victims(tiles){return [player].concat(ents.filter(function(o){return o!==player&&o.ally;})).filter(function(o){return o.hp>0&&reaches(tiles,o);});}
  function physical(e,target,mult,label){var result=attack(e,target,mult,label);return !!(result&&result.landed);}
  function afflict(e,target,key,turns){
    return gameEffects.apply(target,key,turns,undefined,{data:{sourceId:e.id,sourceX:e.x,sourceY:e.y}});
  }
  function direct(e,target,amount,type,area){
    var damage=applyDamage(target,amount,type,e,{tags:area?['area']:[]});floatText(target.x,target.y,String(damage),type,true);
    if(target===player&&damage>0)log(e.name+' deals '+damage+' '+type+' damage.','c-you');if(target.hp<=0)kill(target,e);return damage;
  }
  function projectileVictim(e,w){
    var region=regionAt(e.x,e.y);
    for(var i=0;i<w.tiles.length;i++){
      var t=w.tiles[i];if(!land(t[0],t[1],region))return null;
      var victim=ents.find(function(o){return o!==e&&o.hp>0&&o.x===t[0]&&o.y===t[1];});
      if(player.hp>0&&player.x===t[0]&&player.y===t[1])victim=player;
      if(victim)return victim===player||victim.ally?victim:null;
    }return null;
  }
  function spellLands(e,target){
    var chance=hitChance(accOf(e),evaOf(target));if(gameEffects.has(e,'blind'))chance*=.6;
    return target===player?!combatRoll(1-hostileHitChance(chance,true),true):rng()<chance;
  }
  function area(cx,cy,r,region){var out=[];for(var y=cy-r;y<=cy+r;y++)for(var x=cx-r;x<=cx+r;x++)if(land(x,y,region))out.push([x,y]);return out;}
  function poison(e,w,damage){
    var combat=state(),tiles=w.tiles.filter(function(t){return land(t[0],t[1],e.chaosRegionId);});if(!tiles.length)return;
    // One patch per source and eight per floor bound overlap and save size.
    combat.hazards=combat.hazards.filter(function(h){return h.sourceId!==e.id;});
    combat.hazards.push({id:combat.nextHazard++,sourceId:e.id,regionId:e.chaosRegionId,tiles:tiles,bornAt:now(),expiresAt:now()+300,damage:sDMG(damage),poisonTurns:w.poisonTurns||0,type:'poison',x:w.origin.x,y:w.origin.y});
    if(combat.hazards.length>8)combat.hazards.shift();tiles.forEach(function(t){burst(t[0],t[1],'poison',3,.03);});
  }
  function pull(e,target){
    if(gameEffects.blocked(target,'knockback'))return;
    for(var n=0;n<2&&dist(e,target)>1;n++){
      var dx=Math.sign(e.x-target.x),dy=Math.sign(e.y-target.y),x=target.x+dx,y=target.y+dy;
      if(!land(x,y,regionAt(target.x,target.y))||occupied(x,y)||dx&&dy&&!walkable(target.x+dx,target.y)&&!walkable(target.x,target.y+dy))break;
      target.x=x;target.y=y;
    }
  }
  function release(e,w){
    revealActor(e);setClip(e,'attack');e.chaosCooldown=now()+500;
    // Physical specials already get their voice from attack(). Non-physical
    // releases need an audible cast even when their projectile misses.
    if(w.kind==='chaos-ray'||w.kind==='chaos-web')sound(castSound(w.element));
    else if(w.kind==='chaos-vent'||w.kind==='chaos-bile')sound('trap-gas');
    else if(w.kind==='chaos-brood')sound('slime-split',.65);
    var victim;
    if(w.kind==='chaos-ray'||w.kind==='chaos-harpoon'||w.kind==='chaos-web'){
      victim=projectileVictim(e,w);var end=w.tiles[w.tiles.length-1];boltFx(e.x,e.y,end[0],end[1],w.element);
      if(victim){
        if(w.kind==='chaos-harpoon'){if(physical(e,victim,1.15,'Harpoon')&&victim.hp>0)pull(e,victim);}
        else if(spellLands(e,victim)){
          if(w.kind==='chaos-ray'){var damage=direct(e,victim,sDMG(36),w.element,false);if(damage>0&&victim.hp>0&&w.element==='ice')afflict(e,victim,'frozen',1);}
          else if(!gameEffects.hasTag(victim,'root')&&!gameEffects.hasTag(victim,'slow')){
            var web=gameEffects.apply(victim,'web',1);if(web.applied)victim.syllaWeb=3;
          }
        }else floatText(victim.x,victim.y,'miss','miss');
      }
      if(w.kind==='chaos-ray'){e.chaosElementIndex=((e.chaosElementIndex||0)+1)%elements.length;e.chaosNextElement=elements[e.chaosElementIndex];e.chaosCooldown=now()+600;}
    }else if(w.kind==='chaos-vent'||w.kind==='chaos-bile'){
      if(w.kind!=='chaos-bile'||w.aim&&reaches(line(e,w.aim,5),w.aim)){
        if(w.aim)boltFx(e.x,e.y,w.aim.x,w.aim.y,'poison');
        poison(e,w,w.kind==='chaos-vent'||w.poisonTurns?14:11);
      }
      if(e.kind==='chaos-brood-carrier')e.chaosLastSpecial='cloud';
    }
    else if(w.kind==='chaos-brood'){
      e.chaosLastSpecial='brood';
      var living=ents.filter(function(o){return o.hp>0&&o.chaosOwnerId===e.id;}).length;
      if((e.chaosBorn||0)<4&&living<2){var cell=w.tiles.find(function(t){return land(t[0],t[1],e.chaosRegionId)&&!occupied(t[0],t[1]);});if(cell){var child=spawnEnemy('chaos-rotling',cell[0],cell[1],{offspring:true,ownerId:e.id,state:'hunt',regionId:e.chaosRegionId});if(child){e.chaosBorn=(e.chaosBorn||0)+1;child.t=Math.max(player.t,now()+100);}}}
    }else{
      // Reaching blows still obey the ordinary line and cover checks.
      victims(w.tiles).forEach(function(target){if(!reaches(line(e,target,2),target))return;var hit=physical(e,target,w.kind==='chaos-lash'?1.1:1.35,w.label);if(hit&&target.hp>0){
        if(w.kind==='chaos-lash')applyStatus(target,'bleed',3,sDMG(8));
        if(w.kind==='chaos-reach')afflict(e,target,'fear',2);
        if(w.kind==='chaos-cleave')afflict(e,target,'stun',1);
      }});
    }
  }
  function blink(e,target){
    if(!canActorMove(e)||e.chaosBlinkNeedsAttack)return false;
    var queue=[{x:e.x,y:e.y,n:0}],seenCells=new Set([idxOf(e.x,e.y)]),choices=[],region=e.chaosRegionId;
    for(var n=0;n<queue.length;n++){var p=queue[n];if(p.n>=3)continue;
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){var x=p.x+d[0],y=p.y+d[1],i=idxOf(x,y);if(!land(x,y,region)||occupied(x,y)||seenCells.has(i))return;seenCells.add(i);var next={x:x,y:y,n:p.n+1};queue.push(next);
        if(vis[i]&&clearShot(e,next)&&dist(next,target)<=dist(e,target)&&dist(next,target)>1)choices.push(next);
      });
    }
    choices.sort(function(a,b){return Math.abs(dist(a,target)-2)-Math.abs(dist(b,target)-2)||b.n-a.n||a.y-b.y||a.x-b.x;});if(!choices.length)return false;
    var to=choices[0],concealed=actorConcealed(e);if(!concealed)sparkleFx(e.x,e.y,'light',10);e.x=to.x;e.y=to.y;e._lx=undefined;e._ly=undefined;if(typeof MOTION_STATE!=='undefined')MOTION_STATE.delete(e);if(!concealed)sparkleFx(e.x,e.y,'light',10);
    sound('vanish',.5);e.chaosBlinkNeedsAttack=true;e.chaosCooldown=now()+500;return true;
  }
  function immediate(e,kind,tiles,label,element,extra){
    if(!tiles.length)return false;
    release(e,Object.assign({kind:'chaos-'+kind,tiles:tiles,label:label,element:element||'phys',origin:{x:e.x,y:e.y}},extra||{}));return true;
  }
  function rangedAttack(e,target){
    if(e.kind!=='chaos-prism-seer'&&e.kind!=='chaos-bile-spitter')return false;
    var range=e.kind==='chaos-prism-seer'?6:5,tiles=line(e,target,range);
    if(!reaches(tiles,target))return false;
    var type=e.kind==='chaos-prism-seer'?e.chaosNextElement:'poison';
    revealActor(e);setClip(e,'attack');sound(castSound(type));boltFx(e.x,e.y,target.x,target.y,type);
    if(spellLands(e,target)){
      var damage=direct(e,target,sDMG(e.kind==='chaos-prism-seer'?24:15),type,false);
      if(damage>0&&target.hp>0&&e.kind==='chaos-bile-spitter'&&now()>=(e.chaosDebuffReadyAt||0)){afflict(e,target,'blind',2);e.chaosDebuffReadyAt=now()+300;}
    }
    else floatText(target.x,target.y,'miss','miss');return true;
  }
  function approach(e,target){
    // Prefer a nearby free attack square instead of filing in behind the
    // nearest ally. Existing pathfinding still owns walls, traps and movement.
    if(!canActorMove(e))return false;
    var choices=area(target.x,target.y,1,e.chaosRegionId).filter(function(t){return !occupied(t[0],t[1])&&!(t[0]===target.x&&t[1]===target.y);});
    choices.sort(function(a,b){return dist(e,{x:a[0],y:a[1]})-dist(e,{x:b[0],y:b[1]});});
    return choices.length&&stepToward(e,choices[0][0],choices[0][1])||stepToward(e,target.x,target.y);
  }
  function leap(e,target){
    if(!canActorMove(e)||dist(e,target)<2||dist(e,target)>5||!sameRegion(e,target))return false;
    var path=boltPath(e.x,e.y,target.x,target.y),region=e.chaosRegionId,previous={x:e.x,y:e.y};
    if(path.length<2||path[path.length-1].x!==target.x||path[path.length-1].y!==target.y)return false;
    for(var n=0;n<path.length;n++){
      var p=path[n],dx=p.x-previous.x,dy=p.y-previous.y;
      if(!land(p.x,p.y,region)||dx&&dy&&!land(previous.x+dx,previous.y,region)&&!land(previous.x,previous.y+dy,region))return false;
      if(n<path.length-1&&occupied(p.x,p.y))return false;
      previous=p;
    }
    var to=path[path.length-2],from=typeof renderPos==='function'?renderPos(e):{x:e.x,y:e.y};
    revealActor(e);e.x=to.x;e.y=to.y;e.chaosCooldown=now()+400;
    // Reuse renderer-owned interpolation and its finite turn deadline. The
    // ordinary attack clip winds up in flight and its impact lands with the leap.
    if(typeof motionState==='function'&&typeof ANIM!=='undefined'&&!ANIM.reduce){
      var motion=motionState(e),start=Math.max(performance.now(),typeof fxClock==='number'?fxClock:0),duration=Math.max(180,Math.round(MOVE_MS*1.65));
      Object.assign(motion,{x:e.x,y:e.y,fx:from.x,fy:from.y,mt:start,dur:duration,lin:true,hopHeight:5});
      if(typeof fxClock==='number')fxClock=Math.max(fxClock,start+duration-(CLIP_WINDUP.attack||0));
    }
    physical(e,target,1.2,'Pounce');return true;
  }
  function special(e,target){
    var d=dist(e,target),region=e.chaosRegionId,tiles;
    switch(e.kind){
      case 'chaos-prism-seer':tiles=line(e,target,6);if(reaches(tiles,target))return immediate(e,'ray',tiles,'fires a '+e.chaosNextElement+' ray',e.chaosNextElement);break;
      case 'chaos-folded-horror':tiles=line(e,target,2);if(reaches(tiles,target))return immediate(e,'reach',tiles,'Heavy Reach');break;
      case 'chaos-rift-skitter':if(d>=2&&d<=5)return blink(e,target);break;
      case 'chaos-lens-bearer':
        var ally=ents.filter(function(o){return o!==e&&o.foe&&o.hp>0&&o.kind!=='chaos-lens-bearer'&&sameRegion(e,o)&&dist(e,o)<=4&&!gameEffects.has(o,'chaoslens')&&clearShot(e,o);}).sort(function(a,b){return dist(a,target)-dist(b,target)||a.id-b.id;})[0];
        if(ally){revealActor(e);gameEffects.apply(ally,'chaoslens',4,undefined,{durationModifiers:false,refresh:'replace',data:{n:sHP(35),sourceId:e.id}});if(!actorConcealed(ally))boltFx(e.x,e.y,ally.x,ally.y,'light');setClip(e,'attack');sound('light-cast',.55);e.chaosCooldown=now()+500;return true;}break;
      case 'chaos-plague-bloat':if(d<=2)return immediate(e,'vent',area(e.x,e.y,1,region),'vents poison','poison');break;
      case 'chaos-brood-carrier':
        var canBrood=d<=6&&(e.chaosBorn||0)<4&&ents.filter(function(o){return o.hp>0&&o.chaosOwnerId===e.id;}).length<2;
        if((!canBrood||e.chaosLastSpecial==='brood')&&d<=5&&clearShot(e,target))return immediate(e,'bile',area(target.x,target.y,1,region),'launches infectious poison','poison',{aim:{x:target.x,y:target.y},poisonTurns:4});
        if(canBrood){tiles=area(e.x,e.y,1,region).filter(function(t){return !occupied(t[0],t[1]);});if(tiles.length)return immediate(e,'brood',[tiles[0]],'releases a Rotling','poison');}break;
      case 'chaos-bile-spitter':if(d>=2&&d<=5&&clearShot(e,target))return immediate(e,'bile',area(target.x,target.y,1,region),'spits a bile patch','poison',{aim:{x:target.x,y:target.y}});break;
      case 'chaos-horned-reaver':if(d<=1){var dx=Math.sign(target.x-e.x),dy=Math.sign(target.y-e.y);tiles=area(e.x,e.y,1,region).filter(function(t){return (t[0]-e.x)*dx+(t[1]-e.y)*dy>0;});return immediate(e,'cleave',tiles,'Frontal Cleave');}break;
      case 'chaos-gorehound':
        return leap(e,target);
      case 'chaos-ironbound':if(d<=4){gameEffects.apply(e,'chaosbrace',2,undefined,{durationModifiers:false,refresh:'replace'});e.chaosCooldown=now()+700;setClip(e,'attack');sound('hit-armor',.55);floatText(e.x,e.y,'braced','phys');return true;}break;
      case 'chaos-chain-reaver':if(d>=2){tiles=line(e,target,6);if(reaches(tiles,target))return immediate(e,'harpoon',tiles,'casts its hooked harpoon');}break;
      case 'chaos-lash-dancer':tiles=line(e,target,2);if(reaches(tiles,target))return immediate(e,'lash',tiles,'lashes with a barbed whip','blood');break;
      case 'chaos-silk-weaver':if(d>=2&&!gameEffects.hasTag(target,'root')&&!gameEffects.hasTag(target,'slow')){tiles=line(e,target,5);if(reaches(tiles,target))return immediate(e,'web',tiles,'casts a silver web','web');}break;
    }return false;
  }
  function act(e){
    if(!active()||!e||!e.foe||!e.base||!e.base.chaosAI)return false;
    e.chaosRegionId=regionAt(e.x,e.y);e.chaosNextElement=e.chaosNextElement||elements[e.chaosElementIndex||0];
    // Old sandbox saves can carry queued warnings. Discard that intent and
    // make one fresh decision against the current target and legal terrain.
    if(e.windup&&e.windup.chaos)e.windup=null;
    if(gameEffects.has(e,'chaosbrace'))return true;
    if(e.state!=='hunt'){
      var wasAsleep=e.state==='asleep';basicMonsterBehavior(e);
      if(e.state==='hunt')alertPack(e,player);
      // Sleeping notice does no movement/attack; wandering behavior may
      // already have acted, and must not gain a second action on discovery.
      if(e.state!=='hunt'||!wasAsleep)return true;
    }
    var target=targetFor(e);
    if(!target){if(e.lastSeen&&sameRegion(e,e.lastSeen))stepToward(e,e.lastSeen.x,e.lastSeen.y);return true;}
    if(!e.chaosAlerted)alertPack(e,target);
    e.lastSeen={x:target.x,y:target.y};var d=dist(e,target);
    if(now()>=(e.chaosCooldown||0)&&special(e,target))return true;
    var reach=e.kind==='chaos-lash-dancer'||e.kind==='chaos-folded-horror'?2:1;
    if(d<=reach&&reaches(line(e,target,reach),target)){
      var hit=physical(e,target,e.kind==='chaos-razor-dancer'&&gameEffects.has(target,'bleed')?1.3:1);
      if(hit&&target.hp>0&&e.kind==='chaos-rift-skitter'&&now()>=(e.chaosDebuffReadyAt||0)){afflict(e,target,'slow',2);e.chaosDebuffReadyAt=now()+300;}
      e.chaosBlinkNeedsAttack=false;return true;
    }
    if(rangedAttack(e,target))return true;
    if((e.kind==='chaos-prism-seer'||e.kind==='chaos-bile-spitter'||e.kind==='chaos-silk-weaver')&&d<3&&fleeStep(e,target))return true;
    if(d>1)approach(e,target);return true;
  }
  function holdsPosition(e){return !!(active()&&e&&e.base&&e.base.chaosAI&&gameEffects.has(e,'chaosbrace'));}
  function cellAllowed(e,x,y){return !(active()&&e&&e.base&&e.base.chaosAI)||regionAt(x,y)===regionAt(e.x,e.y)&&at(x,y)!==PORTAL;}
  function damageRules(event){
    if(!active()||!event.target||!event.target.st)return true;
    var e=event.target;if(gameEffects.has(e,'chaosbrace'))event.amount*=.55;
    var shield=e.st.chaoslens;
    if(shield&&shield.t>0&&event.amount>0){var absorbed=Math.min(Math.max(0,shield.n||0),event.amount);shield.n-=absorbed;event.amount-=absorbed;if(absorbed)floatText(e.x,e.y,'-'+Math.round(absorbed),'light');if(shield.n<=0)gameEffects.remove(e,'chaoslens','depleted');if(event.amount<=0){event.amount=0;event.reason='lens-shield';return false;}}
    return true;
  }
  function globalPulse(clock){
    if(!active()||!floorMeta.chaosCombat)return;var combat=state();if(combat.lastPulse===clock)return;combat.lastPulse=clock;
    combat.hazards=combat.hazards.filter(function(h){return h.expiresAt>=clock;});
    [player].concat(ents.filter(function(e){return e!==player&&e.ally;})).forEach(function(victim){
      if(victim.hp<=0)return;
      var patches=combat.hazards.filter(function(h){return h.bornAt<clock&&h.regionId===regionAt(victim.x,victim.y)&&reaches(h.tiles,victim);}).sort(function(a,b){return b.damage-a.damage;});if(!patches.length)return;
      var h=patches[0],source=ents.find(function(e){return e.id===h.sourceId;})||{name:'The poison cloud',foe:true,hp:0,base:{},x:h.x,y:h.y};
      var damage=direct(source,victim,h.damage,'poison',true);
      // Overlap pays direct damage once, but an infectious carrier cloud still
      // applies its shared status when a stronger ordinary patch overlaps it.
      var poisonTurns=patches.reduce(function(turns,patch){return Math.max(turns,patch.poisonTurns||0);},0);
      if(damage>0&&victim.hp>0&&poisonTurns>0)gameEffects.apply(victim,'poison',poisonTurns,undefined,{data:{damageScale:1.5}});
    });
    combat.hazards=combat.hazards.filter(function(h){return h.expiresAt>clock;});
  }
  root.FoteChaosEnemies=Object.freeze({kindsForBiome:kindsForBiome,spawn:spawnEnemy,act:act,holdsPosition:holdsPosition,cellAllowed:cellAllowed,damageRules:damageRules,onDamaged:onDamaged,globalPulse:globalPulse});
})(typeof window!=='undefined'?window:globalThis);
