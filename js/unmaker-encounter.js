/* The Unmaker uses the ordinary actor, damage, status and turn pipelines.
 * Phase-two pylons are independent, save-backed world hazards, never actors. */
(function(root){
  'use strict';
  var unsubscribe=null;
  var retirementTimer=null,retirementQueued=null,retirementPrompt=null,retirementOnClose=null;
  var forms=[
    {kind:'unmaker-tyrant',name:'The Unmaker — Crowned Tyrant',dmg:[42,62],armor:10,speed:100,col:'#DFAC75'},
    {kind:'unmaker-unbound',name:'The Unmaker — The Unbound',dmg:[32,48],armor:7,speed:110,col:'#BFA0F0'},
    {kind:'unmaker-heart',name:'The Unmaker — Heart of Discord',dmg:[44,62],armor:5,speed:110,col:'#F4D5FF'}
  ];
  var elements=['fire','ice','lightning','light','dark'];
  var summonKinds=['chaos-horned-reaver','chaos-prism-seer','chaos-gorehound','chaos-lash-dancer','chaos-rotling'];
  var pylonSites=[{x:42,y:34,art:'crystal-air',color:'#91ECFF',label:'I'},
    {x:54,y:34,art:'crystal-violet',color:'#D2AEFF',label:'II'},
    {x:48,y:43,art:'crystal-gold',color:'#FFE193',label:'III'}];
  var hints=[
    'Calls Chaos demons throughout every form, keeping at most three alive. Closes up to four clear tiles with Shoulder Rush. Great Cleave marks a forward arc two tiles deep; circle his flank. Immune to Fear and Stun. Blind, Root and Slow remain effective.',
    'Three floating crystal pylons independently mark and fire Prism Lances. Their charge bars shrink over two world turns; the beams stay where first aimed. The Unbound alternates Rupture circles and Inversion Pulse while demons keep arriving. Step out of marked tiles or behind cover; floating pylons do not block movement. Immune to Fear and Stun.',
    'Calls Chaos demons throughout every form, keeping at most three alive. Discord Pulse hits the red tiles first, then the violet tiles; both beats give a response action. Immune to Fear and Stun.'
  ];
  forms.forEach(function(form,index){
    MONSTERS[form.kind]=Object.assign({hp:4500,acc:85,eva:24,range:1,xp:1500,band:[99,99],w:0,
      sprite:'m-'+form.kind,ch:'U',boss:true,living:true,encounterId:'unmaker',unmakerPhase:index+1,
      statusImmunities:['fear','stun'],footprint:2,big:2,art:1.8,artLeft:false},form);
    DROPS[form.kind]={chance:0,table:{}};
    if(typeof DEEP_HINT!=='undefined')DEEP_HINT[form.kind]=hints[index];
  });
  function state(){return floorMeta&&floorMeta.unmakerEncounter||null;}
  function boss(){var s=state();return s&&ents.find(function(e){return e.id===s.bossId&&e.hp>0;})||null;}
  function owns(e){return !!(e&&e.base&&e.base.encounterId==='unmaker');}
  function clock(){return worldNow();}
  function animation(e,name,clip){e.unmakerAnimation=name;e.unmakerAnimationAt=performance.now();setClip(e,clip||'attack');}
  function arenaCell(x,y){
    var d=floorMeta&&floorMeta.unmakerPreview,p=inb(x,y)&&propAt(x,y);
    return !!(d&&inb(x,y)&&y>d.rearSeal.y&&y<d.entryGate.y&&floorMeta.chaosPreview.regionByCell[idxOf(x,y)]==='crucible'&&
      [FLOOR,OPEN].indexOf(at(x,y))>=0&&!(p&&p.b));
  }
  function clearLine(a,b){return clearShot(a,b);}
  function bodyFits(e,x,y){
    for(var yy=y;yy<y+entitySize(e);yy++)for(var xx=x;xx<x+entitySize(e);xx++)if(!arenaCell(xx,yy)||occupied(xx,yy,e))return false;
    return true;
  }
  function party(){return ents.filter(function(e){return e.hp>0&&(e===player||e.ally);});}
  function start(d){
    d=d||floorMeta.unmakerPreview;if(!d||d.gates.phase!=='ready'||player.hp<=0||state()&&state().status==='active')return false;
    var friends=party(),spots=[],anchor={x:47,y:48};
    for(var y=44;y<=50;y++)for(var x=42;x<=53;x++)if(arenaCell(x,y)&&!ents.some(function(e){return e.hp>0&&!friends.includes(e)&&e.x===x&&e.y===y;}))spots.push({x:x,y:y});
    spots.sort(function(a,b){return dist(a,anchor)-dist(b,anchor)||b.y-a.y||a.x-b.x;});
    if(spots.length<friends.length||!bodyFits({base:MONSTERS[forms[0].kind]},d.bossStart.x,d.bossStart.y))return false;
    friends.sort(function(a,b){return a===player?-1:b===player?1:a.id-b.id;});
    friends.forEach(function(e,index){e.x=spots[index].x;e.y=spots[index].y;e._lx=undefined;e._ly=undefined;});
    var e=spawnRaw(forms[0].kind,d.bossStart.x,d.bossStart.y);
    e.state='hunt';e.beta11Balanced=true;e.noReward=true;e.lastSeen={x:player.x,y:player.y};e.unmakerPhase=1;
    floorMeta.unmakerEncounter={version:1,status:'active',bossId:e.id,phase:1,warning:null,majorReadyAt:clock()+300,
      rushReadyAt:clock(),summonReadyAt:clock(),summoned:0,summonIds:[],majorCycle:0,elementIndex:0,basicCycle:0};
    floorMeta.boss=true;floorMeta.bossRewarded=false;RUN.bossDead=false;floorMeta.exitOpen=false;
    stopTravel();animation(e,'arrival','cast');sparkleFx(e.x,e.y,'magic',32);playSceneMusic();return true;
  }
  function phaseFor(e){return e.hp<=e.maxhp*.30?3:e.hp<=e.maxhp*.65?2:1;}
  function clearPylons(s){
    s.pylons=[];s.pylonPulseAt=null;
    floorMeta.planeLights=(floorMeta.planeLights||[]).filter(function(light){return !light.unmakerPylon;});
  }
  function ensurePylons(s){
    if(s.phase!==2||s.status!=='active'){clearPylons(s);return;}
    if(!Array.isArray(s.pylons)||s.pylons.length!==3){
      s.pylons=pylonSites.map(function(site,index){return {id:index,x:site.x,y:site.y,readyAt:clock()+100*(index+1),warning:null};});
      s.pylonPulseAt=clock();
    }
    floorMeta.planeLights=(floorMeta.planeLights||[]).filter(function(light){return !light.unmakerPylon;});
    s.pylons.forEach(function(p){floorMeta.planeLights.push({x:p.x,y:p.y,col:pylonSites[p.id].color,r:2.2,s:.8,unmakerPylon:true});});
  }
  function updatePhase(e,quiet){
    var s=state();if(!s||s.status!=='active'||!owns(e)||e.id!==s.bossId||e.hp<=0)return false;
    var phase=phaseFor(e),changed=phase!==s.phase,form=forms[phase-1];
    if(!changed&&e.kind===form.kind)return false;
    e.kind=form.kind;e.base=MONSTERS[form.kind];e.name=form.name;e.col=form.col;e.unmakerPhase=phase;
    e.dmg=form.dmg.map(function(d){return sDMG(d);});s.phase=phase;
    if(changed){
      s.warning=null;e.windup=null;s.majorReadyAt=clock()+200;s.summonReadyAt=clock();
      ensurePylons(s);
      if(!quiet){animation(e,'transition','cast');burst(e.x,e.y,phase===2?'magic':'light',38,.08);
        log(phase===2?'The armor breaks apart. <b>The Unbound</b> unfurls its crystal wings. <b>Three Prism Pylons awaken</b> — their beams charge independently!':'The body shatters. The <b>Heart of Discord</b> calls demons through the breach.','c-kill');}
    }
    return changed;
  }
  function install(enabled){
    cancelRetirementPrompt();
    FoteUnmakerPreview.registerEncounter(enabled===false?null:start);
    if(!unsubscribe&&typeof gameDamage!=='undefined')unsubscribe=gameDamage.on('damageApplied',function(event){if(event.damage>0&&owns(event.target))updatePhase(event.target);});
    return true;
  }
  function restore(){
    var s=state(),ownPromptOpen=s&&retirementPrompt===s&&modalOpen;
    if(!ownPromptOpen)cancelRetirementPrompt();
    if(!s)return false;
    if(s.status==='active'){
      var e=boss();if(!e)return false;
      updatePhase(e,true);var form=forms[s.phase-1];e.kind=form.kind;e.base=MONSTERS[form.kind];e.name=form.name;e.unmakerPhase=s.phase;
      // Old saves may contain a boss-fired phase-two lance. Retire that old
      // pattern without damaging anyone; the new pylons receive a full warning.
      if(s.phase===2&&s.warning&&s.warning.kind==='beam')s.warning=null;
      ensurePylons(s);
      e.dmg=form.dmg.map(function(d){return sDMG(d);});e.windup=s.warning;e.state='hunt';e.beta11Balanced=true;
      // Saves from the one-cell preview may leave an edge against a pillar.
      // Repair only an invalid footprint; transformations keep their anchor.
      if(!bodyFits(e,e.x,e.y)){
        var land=[];for(var y=0;y<MH;y++)for(var x=0;x<MW;x++)if(bodyFits(e,x,y))land.push({x:x,y:y});
        land.sort(function(a,b){return Math.abs(a.x-e.x)+Math.abs(a.y-e.y)-Math.abs(b.x-e.x)-Math.abs(b.y-e.y)||a.y-b.y||a.x-b.x;});
        if(land.length){e.x=land[0].x;e.y=land[0].y;e._lx=undefined;e._ly=undefined;s.warning=null;e.windup=null;}
      }
      floorMeta.boss=true;floorMeta.unmakerPreview.layoutOnly=false;floorMeta.unmakerPreview.encounterImplemented=true;
    }
    // A saved or legacy death prompt never resumes itself. The Forge remains
    // available for an explicit interaction, including after a declined choice.
    if(s.status!=='active')clearPylons(s);
    if(s.status==='defeated'&&!ownPromptOpen)s.retirementPending=false;
    return true;
  }
  function targetFor(e){
    var candidates=party().filter(function(t){return t!==player||canSeePlayer(e);});
    candidates.sort(function(a,b){return dist(e,a)-dist(e,b)||(a===player?-1:1);});
    if(candidates.length){e.lastSeen={x:candidates[0].x,y:candidates[0].y};return candidates[0];}
    return null;
  }
  function direct(e,target,amount,type){
    var damage=applyDamage(target,sDMG(amount),type,e,{tags:['area','unmaker']});floatText(target.x,target.y,String(damage),type,true);
    if(target===player&&damage>0)log(e.name+' deals '+damage+' '+type+' damage.','c-you');if(target.hp<=0)kill(target,e);return damage;
  }
  function spell(e,target){
    var s=state(),type=elements[s.elementIndex++%elements.length],chance=hitChance(accOf(e),evaOf(target));
    if(gameEffects.has(e,'blind'))chance*=.6;
    var origin=entityPoint(e,target);animation(e,'bolt','cast');boltFx(origin.x,origin.y,target.x,target.y,type);
    var landed=target===player?!combatRoll(1-hostileHitChance(chance,true),true):rng()<chance;
    if(landed)direct(e,target,s.phase===3?49:42,type);else floatText(target.x,target.y,'miss','miss');
  }
  function tilesAround(origin,minimum,maximum){
    var tiles=[];for(var y=origin.y-maximum;y<origin.y+entitySize(origin)+maximum;y++)for(var x=origin.x-maximum;x<origin.x+entitySize(origin)+maximum;x++){
      var p={x:x,y:y},d=dist(origin,p);if(d>=minimum&&d<=maximum&&arenaCell(x,y)&&clearLine(origin,p))tiles.push([x,y]);
    }return tiles;
  }
  function legalStep(from,to,e){
    if(!arenaCell(to.x,to.y)||entityOccupies(e,to.x,to.y))return false;
    if(ents.some(function(other){return other!==player&&other!==e&&other.foe&&other.hp>0&&entityOccupies(other,to.x,to.y);} ))return false;
    var dx=to.x-from.x,dy=to.y-from.y;return !(dx&&dy&&!arenaCell(from.x+dx,from.y)&&!arenaCell(from.x,from.y+dy));
  }
  function pendingTiles(exclude){
    var s=state(),tiles=[];if(!s)return tiles;
    if(s.warning&&s.warning!==exclude)tiles=tiles.concat(s.warning.tiles||[]);
    (s.pylons||[]).forEach(function(p){if(p.warning&&p.warning!==exclude)tiles=tiles.concat(p.warning.tiles);});return tiles;
  }
  function safePattern(tiles,e,fixed){
    // Leave a reachable response even where a wall, actor or island edge cuts
    // off the obvious escape. Gaps are fixed when the warning is shown.
    fixed=fixed||[];var held=new Set(fixed.map(function(t){return idxOf(t[0],t[1]);}));
    var marked=new Set(tiles.concat(fixed).map(function(t){return idxOf(t[0],t[1]);}));
    tiles.concat(fixed).forEach(function(t){
      var origin={x:t[0],y:t[1]},choices=[];
      for(var dy=-1;dy<=1;dy++)for(var dx=-1;dx<=1;dx++)if(dx||dy){var p={x:t[0]+dx,y:t[1]+dy};if(legalStep(origin,p,e))choices.push(p);}
      if(choices.some(function(p){return !marked.has(idxOf(p.x,p.y));}))return;
      choices=choices.filter(function(p){return !held.has(idxOf(p.x,p.y));});
      choices.sort(function(a,b){return dist(a,e)-dist(b,e);});
      if(choices.length)marked.delete(idxOf(choices[0].x,choices[0].y));else if(!held.has(idxOf(t[0],t[1])))marked.delete(idxOf(t[0],t[1]));
    });return tiles.filter(function(t){return marked.has(idxOf(t[0],t[1]));});
  }
  function planPulse(e){return {tiles:safePattern(tilesAround(e,1,1),e),outer:safePattern(tilesAround(e,2,4),e),origin:{x:e.x,y:e.y}};}
  function warn(e,kind,target){
    var s=state(),tiles=[],outer=null,origin={x:e.x,y:e.y};
    if(kind==='cleave'){
      var dx=Math.sign(target.x-e.x),dy=Math.sign(target.y-e.y);
      tiles=safePattern(tilesAround(e,1,2).filter(function(t){return (t[0]-e.x)*dx+(t[1]-e.y)*dy>0;}),e);
    }else if(kind==='rupture'){
      origin={x:target.x,y:target.y};
      for(var y=target.y-1;y<=target.y+1;y++)for(var x=target.x-1;x<=target.x+1;x++)if(arenaCell(x,y))tiles.push([x,y]);
      tiles=safePattern(tiles,e,pendingTiles());
    }else if(kind==='ring')tiles=safePattern(tilesAround(e,2,5),e,pendingTiles());
    else {var pulse=planPulse(e);tiles=pulse.tiles;outer=pulse.outer;}
    if(!tiles.length)return false;
    var w={unmaker:true,kind:kind,tiles:tiles,outer:outer,origin:origin,armedTurn:turn,beat:1,due:1};s.warning=w;e.windup=w;
    animation(e,kind==='pulse'?'pulse-inner':kind,'cast');log('<b>'+({cleave:'Great Cleave — circle his flank!',rupture:'Rupture — leave the marked circle!',ring:'Inversion Pulse — advance into the inner gap!',pulse:'Discord Pulse — red first, violet second. Step out, then return!'})[kind]+'</b>','c-info');return true;
  }
  function release(e){
    var s=state(),w=s.warning;if(!w||turn<=w.armedTurn)return true;
    var marked=new Set(w.tiles.map(function(t){return idxOf(t[0],t[1]);})),type=w.kind==='cleave'?'phys':w.kind==='ring'?'lightning':'magic';
    animation(e,w.kind==='pulse'?(w.beat===1?'pulse-inner':'pulse-outer'):w.kind,'cast');
    w.tiles.forEach(function(t){burst(t[0],t[1],type,2,.02);});
    party().slice().forEach(function(target){if(marked.has(idxOf(target.x,target.y))&&(w.origin.x===target.x&&w.origin.y===target.y||clearLine(w.origin,target)))direct(e,target,w.kind==='cleave'?76:66,type);});
    if(w.kind==='pulse'&&w.beat===1){w.tiles=w.outer;w.outer=null;w.beat=2;w.armedTurn=turn;return true;}
    s.warning=null;e.windup=null;s.majorReadyAt=clock()+400;return true;
  }
  function beamTiles(p,target){
    var dx=target.x-p.x,dy=target.y-p.y;if(!dx&&!dy)dy=-1;
    var scale=40/Math.max(Math.abs(dx),Math.abs(dy));
    var path=[{x:p.x,y:p.y}].concat(boltPathRaw(p.x,p.y,Math.round(p.x+dx*scale),Math.round(p.y+dy*scale))),tiles=[];
    for(var i=0;i<path.length;i++){if(!arenaCell(path[i].x,path[i].y))break;tiles.push([path[i].x,path[i].y]);}return tiles;
  }
  function pylonTarget(p,e){
    var targets=party().filter(function(t){return t!==player||canSeePlayer(e);});
    targets.sort(function(a,b){return dist(p,a)-dist(p,b)||(a===player?-1:1);});return targets[0]||null;
  }
  function pulsePylons(now){
    var s=state(),e=boss();if(!s||s.status!=='active'||s.phase!==2||!e||player.hp<=0)return;
    if(s.pylonPulseAt!==null&&s.pylonPulseAt!==undefined&&now<=s.pylonPulseAt)return;
    s.pylonPulseAt=now;
    (s.pylons||[]).forEach(function(p){
      if(s.status!=='active'||s.phase!==2||e.hp<=0||player.hp<=0)return;
      var w=p.warning;if(!w||now<w.fireAt||turn<=w.armedTurn)return;
      var marked=new Set(w.tiles.map(function(t){return idxOf(t[0],t[1]);}));
      w.tiles.forEach(function(t){burst(t[0],t[1],'light',3,.025);});
      fx.push({k:'beam',tiles:w.tiles.slice(),col:pylonSites[p.id].color,t0:performance.now(),dur:ANIM.reduce?180:320});
      party().slice().forEach(function(target){
        if(!marked.has(idxOf(target.x,target.y)))return;
        var path=boltPathRaw(p.x,p.y,target.x,target.y);
        if(path.every(function(t){return arenaCell(t.x,t.y);}))direct(e,target,48,'light');
      });
      p.warning=null;p.readyAt=now+500;
    });
    if(player.hp<=0)return;
    (s.pylons||[]).forEach(function(p){
      if(s.status!=='active'||s.phase!==2||e.hp<=0)return;
      if(p.warning||now<p.readyAt)return;
      var target=pylonTarget(p,e);if(!target){p.readyAt=now+100;return;}
      var tiles=safePattern(beamTiles(p,target),e,pendingTiles());
      if(!tiles.length){p.readyAt=now+100;return;}
      p.warning={kind:'pylon-beam',tiles:tiles,origin:{x:p.x,y:p.y},armedTurn:turn,fireAt:now+200};
      log('<b>Prism Pylon '+pylonSites[p.id].label+'</b> charges a beam — two world turns.','c-info');
    });
  }
  function rush(e,target){
    var s=state();if(s.phase!==1||clock()<s.rushReadyAt||dist(e,target)<2||dist(e,target)>7||!canActorMove(e)||!clearLine(e,target))return false;
    var steps=0;for(var i=0;i<4&&dist(e,target)>1;i++){
      var edge=entityPoint(e,target),dx=Math.sign(target.x-edge.x),dy=Math.sign(target.y-edge.y),nx=e.x+dx,ny=e.y+dy;
      if(!actorCellAllowed(e,nx,ny,dx,dy)||!bodyFits(e,nx,ny))break;e.x=nx;e.y=ny;steps++;
    }
    if(!steps)return false;s.rushReadyAt=clock()+400;animation(e,'rush','melee');
    if(dist(e,target)<=1)attack(e,target,1.15,'Shoulder Rush');return true;
  }
  function summon(e){
    var s=state();if(!s||s.status!=='active'||clock()<s.summonReadyAt)return false;
    var live=ents.filter(function(a){return a.hp>0&&a.unmakerOwnerId===e.id;});if(live.length>=3)return false;
    var spots=[];for(var y=e.y-4;y<=e.y+4;y++)for(var x=e.x-4;x<=e.x+4;x++)if(arenaCell(x,y)&&!occupied(x,y)&&dist(e,{x:x,y:y})>=2&&dist(player,{x:x,y:y})>=2)spots.push({x:x,y:y});
    spots.sort(function(a,b){return dist(a,player)-dist(b,player)||a.y-b.y||a.x-b.x;});
    var born=0;while(spots.length&&live.length+born<3&&born<2){
      var p=spots.shift(),kind=summonKinds[s.summoned%summonKinds.length],add=FoteChaosEnemies.spawn(kind,p.x,p.y,{state:'hunt',offspring:true,ownerId:e.id,castCd:0});
      if(!add)continue;add.unmakerOwnerId=e.id;add.chaosAlerted=true;add.lastSeen={x:player.x,y:player.y};add.t=clock()+100;
      s.summoned++;(s.summonIds||(s.summonIds=[])).push(add.id);born++;burst(add.x,add.y,'dark',20,.06);
    }
    if(!born)return false;s.summonReadyAt=clock()+400;animation(e,'summon','cast');log('The Unmaker tears open a breach. <b>Chaos demons answer.</b>','c-you');return true;
  }
  function act(e){
    var s=state();if(!s||s.status!=='active'||!owns(e)||e.hp<=0)return false;
    updatePhase(e);if(s.warning)return release(e);
    if(summon(e))return true;
    var target=targetFor(e);if(!target){if(e.lastSeen)stepToward(e,e.lastSeen.x,e.lastSeen.y);return true;}
    var distance=dist(e,target),clear=clearLine(e,target);
    if(clock()>=s.majorReadyAt&&clear){
      if(s.phase===1&&distance<=2&&warn(e,'cleave',target))return true;
      if(s.phase===2&&distance<=8){var kind=s.majorCycle++%2?'ring':'rupture';if(warn(e,kind,target))return true;}
      if(s.phase===3&&distance<=4&&warn(e,'pulse',target))return true;
    }
    if(rush(e,target))return true;
    if(distance<=1){animation(e,'melee','melee');if(s.phase===3&&s.basicCycle++%2)spell(e,target);else attack(e,target,1,s.phase===2?'Unbound Lash':undefined);return true;}
    if(s.phase>=2&&distance<=7&&clear){spell(e,target);return true;}
    stepToward(e,target.x,target.y);return true;
  }
  function onDefeated(e){
    var s=state();if(!s||s.status!=='active'||!owns(e)||e.id!==s.bossId||e.hp>0)return false;
    s.warning=null;e.windup=null;s.status='defeated';clearPylons(s);var removed=new Set([e.id].concat(s.summonIds||[]));
    ents=ents.filter(function(a){if(a.unmakerOwnerId===e.id){removed.add(a.id);burst(a.x,a.y,'magic',12,.04);return false;}return true;});
    if(floorMeta.chaosCombat)floorMeta.chaosCombat.hazards=(floorMeta.chaosCombat.hazards||[]).filter(function(h){return !removed.has(h.sourceId);});
    floorMeta.marks=(floorMeta.marks||[]).filter(function(m){return !m.unmaker&&!removed.has(m.sourceId);});
    floorMeta.bossRewarded=true;RUN.bossDead=true;animation(e,'death','death');burst(e.x,e.y,'light',70,.1);
    FoteUnmakerPreview.completeEncounter();playSceneMusic();log('<b>The Unmaker falls.</b> The way to the Forge of the Elements is open. Use the Forge when you are ready to restore balance.','c-kill');
    s.retirementPending=false;return true;
  }
  function cancelRetirementPrompt(){
    if(retirementTimer!==null)clearTimeout(retirementTimer);
    retirementTimer=null;retirementQueued=null;retirementPrompt=null;
    if(typeof modalOnClose!=='undefined'&&modalOnClose===retirementOnClose)modalOnClose=null;
    retirementOnClose=null;
  }
  function chooseRetirement(retire,expected){
    var s=state();if(!s||s!==expected||s.status!=='defeated'||RUN.over||RUN.victory||player.hp<=0)return false;
    s.retirementPending=false;s.retirementChoice=retire?'retire':'explore';
    var closeOwn=retirementPrompt===s;cancelRetirementPrompt();if(closeOwn&&modalOpen)closeModal();
    if(!retire){log('Your journey continues. Use the Forge again when you are ready to retire.','c-info');return true;}
    s.forgeRestored=true;s.retired=true;s.status='victory';
    log('<b>You restore the Forge of the Elements and retire. Balance returns to the material plane.</b>','c-kill');victory();return true;
  }
  function showRetirementPrompt(s){
    if(state()!==s||s.status!=='defeated'||!s.retirementPending||retirementPrompt===s)return false;
    retirementPrompt=s;retirementQueued=null;s.retirementOffered=true;
    stopTravel();
    openModal('Forge of the Elements',
      '<p>The elements gather at your touch. Would you like to restore balance and retire?</p><p><b>Retire</b> restores balance and ends this run with victory. <b>Keep exploring</b> leaves the run open; use this Forge again when you are ready.</p>',[
        {label:'Keep exploring',fn:function(){chooseRetirement(false,s);}},
        {label:'Retire',cls:'primary',fn:function(){chooseRetirement(true,s);}}
      ]);
    // Escape and the close button mean "keep exploring", never consent to win.
    retirementOnClose=function(){if(state()===s&&s.status==='defeated'&&s.retirementPending){s.retirementPending=false;s.retirementChoice='explore';}retirementPrompt=null;retirementOnClose=null;};
    modalOnClose=retirementOnClose;return true;
  }
  function queueRetirementPrompt(s){
    if(!s||retirementQueued===s||retirementPrompt===s)return;
    retirementQueued=s;var run=RUN,hero=player;
    function ready(){
      retirementTimer=null;
      if(state()!==s||RUN!==run||player!==hero||s.status!=='defeated'||!s.retirementPending||RUN.over||RUN.victory||player.hp<=0){if(retirementQueued===s)retirementQueued=null;return;}
      if(gameTurns.busy()){afterTurn(ready);return;}
      var now=performance.now(),until=now;
      if(typeof ANIM!=='undefined'&&!ANIM.reduce){
        until=Math.max(until,typeof fxClock==='number'?fxClock:0);
        if(typeof fx!=='undefined')fx.forEach(function(effect){if(effect.k==='d'&&Number.isFinite(effect.t0)&&Number.isFinite(effect.dur))until=Math.max(until,effect.t0+effect.dur);});
      }
      if(until>now||modalOpen){retirementTimer=setTimeout(ready,Math.max(30,Math.min(250,until-now||100)));return;}
      showRetirementPrompt(s);
    }
    // Finish the explicit interaction's action before showing its choice.
    retirementTimer=setTimeout(ready,0);
  }
  function forgeInfo(x,y){
    var d=floorMeta&&floorMeta.unmakerPreview,f=d&&d.trueForge,s=state();
    if(!f||x<f.x||y<f.y||x>=f.x+f.w||y>=f.y+f.h)return null;
    var near=!!player&&Math.max(Math.max(f.x-player.x,0,player.x-(f.x+f.w-1)),Math.max(f.y-player.y,0,player.y-(f.y+f.h-1)))<=1;
    return {name:'Forge of the Elements',x:f.x,y:f.y,w:f.w,h:f.h,near:near,ready:!!(s&&s.status==='defeated'),
      hint:s&&s.status==='defeated'?'Click or tap the Forge from beside it to restore balance and choose whether to retire.':'The restoration Forge awaits the Unmaker\'s defeat.'};
  }
  function interactForge(x,y){
    var f=forgeInfo(x,y),s=state();if(!f||!f.near||!f.ready||!s||player.hp<=0||RUN.over||RUN.victory||modalOpen)return false;
    s.retirementPending=true;s.retirementReason='forge-interaction';queueRetirementPrompt(s);return true;
  }
  function drawTelegraphs(now){
    var s=state();if(!s||s.status!=='active')return;var w=s.warning;
    function paint(tiles,second){if(!tiles)return;tiles.forEach(function(t){if(!(revealAll||vis[idxOf(t[0],t[1])]))return;
      var x=(t[0]-camX)*TS,y=(t[1]-camY)*TS;ctx.fillStyle=second?'rgba(149,95,245,.19)':'rgba(245,69,46,.32)';ctx.fillRect(x+1,y+1,TS-2,TS-2);
      ctx.strokeStyle=second?'#C397FF':'#FFAA78';ctx.lineWidth=Math.max(1,TS*.045);ctx.strokeRect(x+2,y+2,TS-4,TS-4);
    });}
    ctx.save();if(w){paint(w.outer,true);paint(w.tiles,false);}
    (s.pylons||[]).forEach(function(p){
      var site=pylonSites[p.id],warning=p.warning;
      if(warning)warning.tiles.forEach(function(t){
        if(!(revealAll||vis[idxOf(t[0],t[1])]))return;
        var x=(t[0]-camX)*TS,y=(t[1]-camY)*TS;
        ctx.globalAlpha=.25;ctx.fillStyle=site.color;ctx.fillRect(x+2,y+2,TS-4,TS-4);ctx.globalAlpha=1;
        ctx.strokeStyle=site.color;ctx.lineWidth=Math.max(1,TS*.045);ctx.setLineDash([TS*.12,TS*.07]);ctx.strokeRect(x+3,y+3,TS-6,TS-6);ctx.setLineDash([]);
        // Insets distinguish a pylon beam from the boss's solid red area.
        ctx.beginPath();ctx.moveTo(x+TS*.38,y+TS*.5);ctx.lineTo(x+TS*.62,y+TS*.5);ctx.stroke();
      });
      if(!(revealAll||vis[idxOf(p.x,p.y)]))return;
      var px=(p.x-camX)*TS,py=(p.y-camY)*TS;
      ctx.strokeStyle=site.color;ctx.lineWidth=Math.max(1,TS*.04);ctx.beginPath();ctx.ellipse(px+TS*.5,py+TS*.83,TS*.35,TS*.13,0,0,Math.PI*2);ctx.stroke();
      drawObj(objArt('props',site.art),px,py,{feet:true,fit:.98,alpha:.92});
      var label=site.label;
      ctx.font='bold '+Math.max(11,Math.round(TS*.22))+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.lineWidth=Math.max(3,TS*.07);ctx.strokeStyle='#241E35';ctx.strokeText(label,px+TS*.5,py-TS*.25);ctx.fillStyle=site.color;ctx.fillText(label,px+TS*.5,py-TS*.25);
      if(warning){
        var remaining=Math.max(0,Math.min(1,(warning.fireAt-clock())/200));
        ctx.fillStyle='rgba(30,25,43,.8)';ctx.fillRect(px+TS*.13,py-TS*.10,TS*.74,TS*.08);
        ctx.fillStyle=site.color;ctx.fillRect(px+TS*.15,py-TS*.08,TS*.70*remaining,TS*.04);
      }
    });ctx.restore();
  }
  root.FoteUnmakerEncounter=Object.freeze({install:install,start:start,act:act,updatePhase:updatePhase,onDefeated:onDefeated,
    forgeInfo:forgeInfo,interactForge:interactForge,restore:restore,drawTelegraphs:drawTelegraphs,state:state,boss:boss,summon:summon,planPulse:planPulse,pulsePylons:pulsePylons});
})(typeof window!=='undefined'?window:globalThis);
