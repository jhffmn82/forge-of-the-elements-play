/* =====================================================================
   travel.js - click (or tap) to act, with a cursor that says what a click will do (2026-09-17).
   Built with touch screens in mind (and a later Android port).
   - Click open ground you have seen: walk there, a step a turn, stopping if an enemy comes into view,
     you get hurt, or you spot a trap. Click an item: walk there and pick it up. Click stairs: walk
     there and go down. Click a door, chest, shrine, Forge or lever: walk up and use it.
   - Click an enemy: with a click spell set (right-click or long-press a spell on the hotbar), cast it;
     with a bow, shoot; next to you, attack; otherwise walk toward it.
   - The cursor over the map shows the action: footsteps, a hand, stairs, a bow, the spell, a sword.
   ===================================================================== */

var TRAVEL = null;

/* ---------------------------------------------------------------- cursors */
var CURSOR_URLS = {};
function cursorFor(kind){
  if(CURSOR_URLS[kind] !== undefined) return CURSOR_URLS[kind];
  var glyph = {close:'\u{1F6AA}', door:'\u{1F6AA}', break:'\u{1F528}', move:'\u{1F463}', grab:'\u{1F392}', stairs:'\u{1FA9C}', upstairs:'\u{1FA9C}', shoot:'\u{1F3F9}', cast:'✨', attack:'⚔️', use:'\u{1F449}', inspect:'\u{1F50D}', exit:'\u{1F6AA}'}[kind];
  if(!glyph){ CURSOR_URLS[kind]=null; return null; }
  try{
    var c=document.createElement('canvas'); c.width=32; c.height=32; var g=c.getContext('2d');
    g.font='18px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';   /* 80% of the first pass, so every icon reads the same size */ g.textAlign='center'; g.textBaseline='middle';
    g.shadowColor='rgba(0,0,0,.85)'; g.shadowBlur=3; g.fillText(glyph, 16, 17);
    CURSOR_URLS[kind]='url('+c.toDataURL()+') 16 16, pointer';
  }catch(e){ CURSOR_URLS[kind]=null; }
  return CURSOR_URLS[kind];
}

/* ---------------------------------------------------------------- what a click on a tile means */
function tileAt(ev){ var r=cv.getBoundingClientRect(); return {x:camX+Math.floor((ev.clientX-r.left+camOX)/TS), y:camY+Math.floor((ev.clientY-r.top+camOY)/TS)}; }
function knownTile(x,y){ return inb(x,y) && (revealAll || seen[idxOf(x,y)]); }
/* Player travel can cross a gap while Floating (or carried by Air 3).
   Keep world walkability unchanged for grounded actors and floor generation. */
function travelWalkable(x,y){
  if(walkable(x,y)) return true;
  if(!inb(x,y) || at(x,y)!==CHASM || !player) return false;
  if(floorMeta&&floorMeta.impassableVoid)return false;
  if(!(player.levitate>0 || (typeof aff==='function' && aff('air')>=3))) return false;
  var p=propAt(x,y); return !(p && p.b);
}
function useTile(t){ return t===DOOR || t===CHEST || t===SHRINE || t===FORGE || t===LOCKED || t===SEALED || t===ICEDOOR || t===THORNS || t===TOLL || (t===EXIT && !floorMeta.exitOpen); }
function clickSpellReady(foe){
  var k=player.clickSpell; if(!k || player.abilities.indexOf(k)<0) return false;
  var A=ABILITIES[k]; if(!A) return false;
  return dist(player, foe) <= Math.max(1, spellRange(A)) && actorVisible(foe);
}
function clickIntent(x, y){
  if(!player || player.hp<=0 || !knownTile(x,y)) return null;
  var foe=foeAt(x,y);if(foe&&!actorVisible(foe))foe=null;
  if(foe){
    if(clickSpellReady(foe)) return {kind:'cast', foe:foe};
    if(dist(player,foe)<=1) return {kind:'attack', foe:foe};
    if(reachLen()>=2 && reachDir(foe)) return {kind:'attack', foe:foe};
    if(player.range>1 && dist(player,foe)<=player.range) return {kind:'shoot', foe:foe};
    return {kind:'move', foe:foe};
  }
  var t=at(x,y);
  if(x===player.x && y===player.y){
    if(items.some(function(it){ return it.x===x && it.y===y && it.kind!=='heart' && it.kind!=='managlobe'; })) return {kind:'grab'};
    if(t===STAIRS) return {kind:'stairs'};
    if(typeof UPSTAIRS!=='undefined' && t===UPSTAIRS) return {kind:'upstairs'};
    return null;
  }
  if(t===STAIRS) return {kind:'stairs'};
  if(typeof UPSTAIRS!=='undefined' && t===UPSTAIRS) return {kind:'upstairs'};
  if(t===OPEN && Math.max(Math.abs(x-player.x),Math.abs(y-player.y))===1 && doorClosable(x,y)) return {kind:'close'};
  var pr=propAt(x,y), lever=leverDetails(pr);
  var restorationForge=typeof FoteUnmakerEncounter!=='undefined'&&FoteUnmakerEncounter.forgeInfo(x,y);
  if(restorationForge)return {kind:restorationForge.ready?'use':'inspect',restorationForge:restorationForge};
  if(lever) return {kind:lever.used?'inspect':'use',lever:pr};
  if(pr && pr.br && !pr.hoard) return {kind:'break'};
  if(t===EXIT) return {kind: floorMeta.exitOpen ? 'exit' : 'use'};
  if(t===DOOR || t===OPEN || t===LOCKED || t===SEALED || t===ICEDOOR || t===THORNS || t===TOLL) return {kind:'door'};
  if(useTile(t)) return {kind:'use'};
  if(items.some(function(it){ return it.x===x && it.y===y && it.kind!=='heart' && it.kind!=='managlobe'; })) return {kind:'grab'};
  if(travelWalkable(x,y) || passable(x,y) || t===OPEN) return {kind:'move'};
  return null;
}

/* ---------------------------------------------------------------- paths over what you know */
function travelPath(tx, ty, stopAdjacent, explore){
  var W=MW, prev=new Int32Array(MW*MH).fill(-1), start=idxOf(player.x,player.y), goal=explore&&!explore.destination?-1:idxOf(tx,ty), q=[start], h=0;
  prev[start]=start;
  var knownTrap={}; feats.forEach(function(f){ if(f.found) knownTrap[idxOf(f.x,f.y)]=1; });
  while(h<q.length){
    var i=q[h++]; if(i===goal) break;
    var x=i%W, y=(i/W)|0;
    if(explore && !explore.destination && i!==start && exploreFrontier(x,y,explore)){ goal=i; break; }
    if(stopAdjacent && Math.max(Math.abs(x-tx),Math.abs(y-ty))<=1 && i!==start){ goal=i; break; }
    for(var dy=-1;dy<=1;dy++) for(var dx=-1;dx<=1;dx++){
      if(!dx && !dy) continue; var nx=x+dx, ny=y+dy; if(!inb(nx,ny)) continue; var ni=idxOf(nx,ny);
      if(prev[ni]>=0 || !knownTile(nx,ny)) continue;
      var t=at(nx,ny), isGoal = ni===goal;
      var ok = travelWalkable(nx,ny) || t===DOOR || t===OPEN || (isGoal && (useTile(t) || t===EXIT));
      if(!ok || (knownTrap[ni] && (!isGoal||explore))) continue;
      if(explore && (!exploreWalkable(nx,ny) || travelHazard(nx,ny)))continue;
      if(!isGoal && ents.some(function(e){ return e!==player && entityOccupies(e,nx,ny) && !e.ally && (explore?actorVisible(e):!actorConcealed(e)); })) continue;
      prev[ni]=i; q.push(ni);
    }
  }
  if(goal<0 || prev[goal]<0) return null;
  var path=[], c=goal; while(c!==start){ path.push(c); c=prev[c]; }
  return path.reverse().map(function(i){ return {x:i%W, y:(i/W)|0}; });
}

/* Explore selects reachable edges of the map the player has actually seen.
   Unknown cells are never read to choose a destination. Its steps run through
   the same TRAVEL timer, movement entry, and afterTurn boundary as click travel. */
function exploreWalkable(x,y){
  var t=at(x,y),pr=propAt(x,y);
  // No paid interactions, fragile floating crossings, exits or puzzle switches.
  if(t===CHASM || t===EXIT || typeof PORTAL!=='undefined'&&t===PORTAL || useTile(t)&&t!==DOOR)return false;
  if(pr && (pr.b || pr.br || pr.lever || pr.puzzleSwitch || pr.altar || pr.prisoner || pr.drink || pr.portal))return false;
  if(typeof plates!=='undefined'&&plates&&!plates.solved&&plates.cells.some(function(p){return p.x===x&&p.y===y;}))return false;
  return travelWalkable(x,y)||t===DOOR||t===OPEN;
}
function exploreFrontier(x,y,state){
  if(state.visited[idxOf(x,y)])return false;
  if(at(x,y)===DOOR)return true;
  for(var dy=-1;dy<=1;dy++)for(var dx=-1;dx<=1;dx++){
    var nx=x+dx,ny=y+dy;
    if(!inb(nx,ny)||knownTile(nx,ny))continue;
    // A hidden tile behind two touching walls cannot be revealed from here.
    // Use the sight rule, but never inspect terrain the player has not seen.
    if(FoteGeometry.traceLine({x:x,y:y},{x:nx,y:ny},function(bx,by){
      return knownTile(bx,by)&&opaque(bx,by);
    }).clear)return true;
  }
  return false;
}
function travelHazard(x,y){
  if(!knownTile(x,y))return false;
  var i=idxOf(x,y),clock=typeof worldNow==='function'?worldNow():player.t;
  if(typeof fireT!=='undefined'&&fireT&&fireT[i] || typeof rootG!=='undefined'&&rootG&&rootG[i] || typeof iceG!=='undefined'&&iceG&&iceG[i])return true;
  if(typeof G_WEB!=='undefined'&&gAt(x,y)===G_WEB)return true;
  if(typeof deepLava==='function'&&deepLava(x,y))return true;
  if(typeof fwaIsLava==='function'&&[[0,-1],[1,0],[0,1],[-1,0]].some(function(d){return knownTile(x+d[0],y+d[1])&&fwaIsLava(x+d[0],y+d[1]);}))return true;
  if(typeof fwaDeepAt==='function'&&fwaDeepAt(x,y) || typeof fwaVentAt==='function'&&fwaVentAt(x,y))return true;
  var room=typeof puzzleRoomAt==='function'&&puzzleRoomAt(x,y);
  if(room&&!room.puzzle.solved&&(['sentries','sentinels'].indexOf(room.puzzle.kind)>=0||room.puzzle.kind==='baths'&&!(room.cooledUntil>turn)))return true;
  if(typeof cloudAt==='function'&&cloudAt(i))return true;
  if(['webGround','greenTrail'].some(function(key){var f=(floorMeta[key]||{})[i];return f&&f.expiresAt>clock;}))return true;
  if((floorMeta.sporeGrowth||{})[i])return true;
  if((floorMeta.sporeFields||[]).some(function(f){return (!f.expiresAt||f.expiresAt>clock)&&f.cells.indexOf(i)>=0;}))return true;
  if((floorMeta.marks||[]).some(function(m){return m.until>=turn&&m.cells.indexOf(i)>=0;}))return true;
  return !!(floorMeta.chaosCombat&&floorMeta.chaosCombat.hazards||[]).some(function(h){return h.expiresAt>clock&&h.tiles.some(function(p){return p[0]===x&&p[1]===y;});});
}
function autoExploreActive(){return !!(TRAVEL&&TRAVEL.explore);}
function travelStateChanged(){window.dispatchEvent(new CustomEvent('fote:travel-state',{detail:{exploring:autoExploreActive()}}));}
function syncExploreButton(button){
  if(!button)return;
  var active=autoExploreActive(),stairs=!!(floorMeta&&floorMeta.exploreComplete);
  button.textContent=active?'Stop':stairs?'Next floor':'Explore';
  button.dataset.exploreMode=stairs?'stairs':'explore';button.setAttribute('aria-pressed',String(active));
  button.title=(active?'Stop travelling':stairs?'Walk to the stairs down and descend':'Explore nearby unseen areas')+(typeof bindKey==='function'?' ('+keyLabel(bindKey('explore'))+')':'');
}
function bindExploreButton(button){
  if(!button||button.dataset.autoExplore)return;
  button.dataset.autoExplore='true';button.disabled=false;
  function sync(){syncExploreButton(button);}
  button.addEventListener('click',function(ev){ev.preventDefault();ev.stopPropagation();toggleAutoExplore();});
  window.addEventListener('fote:travel-state',sync);sync();
}
function exploreStopReason(T){
  if(ents.some(function(e){return e.foe&&e.hp>0&&actorVisible(e);}))return 'You stop exploring: an enemy is in sight.';
  if(['root','stun','frozen','fear','poison','burn','bleed','rot'].some(function(k){return player.st&&player.st[k];}))return 'You stop exploring: deal with your condition first.';
  if(travelHazard(player.x,player.y))return 'You stop exploring: you are standing in danger.';
  if(T&&T.alarms.some(function(f){return feats.indexOf(f)<0;}))return 'You stop exploring: an alarm sounds nearby.';
  return null;
}
function exploreDownstairs(T){
  var best=null,length=Infinity;
  for(var y=0;y<MH;y++)for(var x=0;x<MW;x++){
    if(!knownTile(x,y)||at(x,y)!==STAIRS)continue;
    var point={x:x,y:y},path=travelPath(x,y,false,Object.assign({},T,{destination:point}));
    if(path&&path.length<length){best=point;length=path.length;}
  }
  return best;
}
function toggleAutoExplore(){
  if(autoExploreActive()){stopTravel();return false;}
  if(!player||player.hp<=0||uiOpen()||RUN.over||RUN.victory||typeof turnSequenceBusy==='function'&&turnSequenceBusy())return false;
  stopTravel();if(typeof stopRest==='function')stopRest();
  if(typeof aiming!=='undefined'&&aiming)cancelAim();
  var why=exploreStopReason();if(why){log(why,'c-info');return false;}
  var T={path:[],explore:true,visited:{},hp:player.hp,foes:[],traps:feats.filter(function(f){return f.found;}).length,
    floor:floorMeta,run:RUN,hero:player,alarms:feats.filter(function(f){return f.kind==='alarm'&&Math.max(Math.abs(f.x-player.x),Math.abs(f.y-player.y))<=12;})};
  T.visited[idxOf(player.x,player.y)]=true;
  if(floorMeta.exploreComplete){
    // Opening a route since the last search makes Explore available again.
    var remaining=travelPath(null,null,false,T);
    if(remaining&&remaining.length)delete floorMeta.exploreComplete;
    else{
      T.destination=exploreDownstairs(T);
      if(!T.destination){log('No safely reachable stairs down.','c-info');travelStateChanged();return false;}
    }
  }
  TRAVEL=T;travelStateChanged();travelStep();return autoExploreActive();
}

/* ---------------------------------------------------------------- walking */
function visibleFoeIds(){ return ents.filter(function(e){ return e.foe && actorVisible(e) && e.state!=='asleep'; }).map(function(e){ return e.id; }); }
var TRAVEL_TIMER=null;
function queueTravel(ms){clearTimeout(TRAVEL_TIMER);TRAVEL_TIMER=setTimeout(function(){TRAVEL_TIMER=null;travelStep();},ms);}
function stopTravel(why){clearTimeout(TRAVEL_TIMER);TRAVEL_TIMER=null;if(TRAVEL){ TRAVEL=null;travelStateChanged();if(why) log(why,'c-info'); } }
/* 2026-09-20: Justin - a misclick during a fight was killing people. Clicking a tile several steps off while
   something is awake and watching used to walk the whole route, so a finger that meant "shoot that" instead
   strolled past two monsters and took a free hit from each. With any awake foe in sight a click is now worth
   exactly one step along the path: the walk stops there and you choose again. Nothing in sight walks as before. */
function travelOneStep(){ return visibleFoeIds().length > 0; }
function startTravel(path, then){
  stopTravel();
  if(!path || !path.length){ if(then) then(); return; }
  if(path.length>1 && travelOneStep()){
    path=path.slice(0,1);
    if(!window.STEP_HINT){ window.STEP_HINT=true; log('With an enemy in sight, you take one step at a time. Click again to keep going.','c-info'); }
  }
  TRAVEL={path:path, then:then, hp:player.hp, foes:visibleFoeIds(), traps:feats.filter(function(f){ return f.found; }).length};
  travelStep();
}
function travelStep(){
  var T=TRAVEL; if(!T) return;
  if(uiOpen() || RUN.over || player.hp<=0){ stopTravel(); return; }
  if(T.explore&&(T.floor!==floorMeta||T.run!==RUN||T.hero!==player)){stopTravel();return;}
  if(typeof animBusy==='function' && animBusy()){ queueTravel(30); return; }
  /* what stops a walk */
  if(player.hp < T.hp){ stopTravel('You stop: you are hurt.'); return; }
  var foes=visibleFoeIds().filter(function(id){ return T.foes.indexOf(id)<0; });
  if(foes.length){ var f=ents.filter(function(e){ return e.id===foes[0]; })[0]; stopTravel('You stop: '+(f ? 'a '+f.name : 'something')+' comes into view.'); return; }
  if(feats.filter(function(f){ return f.found; }).length > T.traps){ stopTravel('You stop: you spotted a trap.'); return; }
  if(T.explore){
    var why=exploreStopReason(T);if(why){stopTravel(why);return;}
    if(T.destination&&at(T.destination.x,T.destination.y)!==STAIRS){stopTravel('The stairs are no longer there.');return;}
    T.path=T.destination?travelPath(T.destination.x,T.destination.y,false,T):travelPath(null,null,false,T);
    if(!T.path||!T.path.length){
      if(T.destination){
        var arrived=player.x===T.destination.x&&player.y===T.destination.y;
        stopTravel(arrived?null:'No safely reachable stairs down.');if(arrived){descend();travelStateChanged();}
      }else{floorMeta.exploreComplete=true;stopTravel('No more safely reachable areas to explore.');}
      return;
    }
  }
  var step=T.path.shift();
  if(!step){ var then=T.then; TRAVEL=null; if(then) then(); return; }
  var dx=step.x-player.x, dy=step.y-player.y;
  if(Math.max(Math.abs(dx),Math.abs(dy))!==1){ stopTravel(); return; }
  if(T.explore&&travelHazard(step.x,step.y)){stopTravel('You stop exploring: the way is dangerous.');return;}
  var bx=player.x, by=player.y, bt=turn;
  lastDir=[dx,dy]; tryMove(dx,dy);
  return afterTurn(function(){
  if(TRAVEL!==T)return;
  if(player.hp<T.hp){stopTravel('You stop: you are hurt.');return;}
  if(T.explore){
    if(player.x===bx&&player.y===by&&!(turn!==bt&&at(step.x,step.y)===OPEN)){stopTravel();return;}
    if(player.x!==bx||player.y!==by)T.visited[idxOf(player.x,player.y)]=true;
    queueTravel(ANIM.reduce?0:Math.max(20,MOVE_MS*.35));return;
  }
  /* an interaction at the end (door, chest...) happens on the bump itself */
  if(!T.path.length && (player.x!==step.x || player.y!==step.y)){ var th=T.then; TRAVEL=null; if(th && turn===bt) th(); return; }
  if(player.x===bx && player.y===by){
    if(turn===bt){ stopTravel(); return; }
    if(at(step.x,step.y)===OPEN){ T.path.unshift(step); queueTravel(ANIM.reduce ? 0 : 60); return; }
    stopTravel(); return;
  }
  T.hp=Math.min(T.hp, player.hp);
  if(!T.path.length){ var then2=T.then; TRAVEL=null; if(then2) then2(); return; }
  queueTravel(ANIM.reduce ? 0 : Math.max(20, MOVE_MS*0.35));
  });
}

/* ---------------------------------------------------------------- the click itself */
function castClickSpell(foe,selected){
  var i=player.abilities.indexOf(player.clickSpell); if(i<0) return false;
  if(aiming) cancelAim();
  useAbility(i);
  if(aiming){var target=selected&&entityOccupies(foe,selected.x,selected.y)?selected:autoAimPoint(foe)||entityPoint(foe,player);castAt(target.x,target.y);return true;}
  return false;
}
function handleMapClick(ev){
  var p=tileAt(ev), it=clickIntent(p.x, p.y);
  if(!it) return false;
  stopTravel();
  if(it.kind==='inspect') return true;
  if(it.restorationForge){
    var forge=it.restorationForge;
    if(forge.near)FoteUnmakerEncounter.interactForge(p.x,p.y);
    else{
      var approaches=[];
      for(var fy=forge.y-1;fy<=forge.y+forge.h;fy++)for(var fx=forge.x-1;fx<=forge.x+forge.w;fx++){
        if(fx>=forge.x&&fx<forge.x+forge.w&&fy>=forge.y&&fy<forge.y+forge.h)continue;
        if(!knownTile(fx,fy)||!travelWalkable(fx,fy))continue;
        var route=travelPath(fx,fy,false);if(route)approaches.push(route);
      }
      approaches.sort(function(a,b){return a.length-b.length;});
      if(approaches.length)startTravel(approaches[0]);else log('You can\'t find a way to the Forge.','c-info');
    }
    return true;
  }
  if(it.lever){
    var nearLever=function(){return Math.max(Math.abs(p.x-player.x),Math.abs(p.y-player.y))===1;};
    var pullLever=function(){
      if(nearLever() && propAt(p.x,p.y)===it.lever){lastDir=[p.x-player.x,p.y-player.y];tryMove(lastDir[0],lastDir[1]);}
    };
    if(nearLever()) pullLever(); else startTravel(travelPath(p.x,p.y,true),pullLever);
    return true;
  }
  if(it.kind==='cast'){castClickSpell(it.foe,p);return true;}
  if(it.kind==='shoot') return false;            /* the game's own click shoots */
  if(it.kind==='close'){ closeDoorAt(p.x, p.y); return true; }
  if(it.kind==='break'){
    var near=function(){ return Math.max(Math.abs(p.x-player.x),Math.abs(p.y-player.y))===1; };
    var hit=function(){ if(near() && propAt(p.x,p.y)){ lastDir=[p.x-player.x, p.y-player.y]; tryMove(p.x-player.x, p.y-player.y); } };
    if(near()) hit(); else startTravel(travelPath(p.x, p.y, true), hit);
    return true;
  }
  if(it.kind==='attack'){var edge=entityPoint(it.foe,player),dx=edge.x-player.x,dy=edge.y-player.y;lastDir=[dx,dy];tryMove(dx,dy);return true;}
  if(it.foe){var goal=entityPoint(it.foe,player);startTravel(travelPath(goal.x,goal.y,true));return true;}
  var x=p.x, y=p.y;
  if(it.kind==='grab' && x===player.x && y===player.y){ if(grab()) endTurn(); return true; }
  if(it.kind==='stairs' && x===player.x && y===player.y){ descend(); return true; }
  if(it.kind==='upstairs' && x===player.x && y===player.y){ ascend(); return true; }
  var path=travelPath(x, y, false);
  if(!path){ log('You can\'t find a way there.','c-info'); return true; }
  if(it.kind==='grab') startTravel(path, function(){ if(player.x===x && player.y===y && grab()) endTurn(); });
  else if(it.kind==='stairs') startTravel(path, function(){ if(player.x===x && player.y===y && at(x,y)===STAIRS) descend(); });
  else if(it.kind==='upstairs') startTravel(path, function(){ if(player.x===x && player.y===y && at(x,y)===UPSTAIRS) ascend(); });
  else startTravel(path);   /* doors, chests, shrines: the last step bumps them */
  return true;
}
setTimeout(function(){   /* registered after boot.js, so its door-closing click still comes first */
  window.addEventListener('click', function(ev){
    if(TRAVEL&&!(ev.target.closest&&ev.target.closest('[data-auto-explore]')))stopTravel();
    if(ev.target!==cv || aiming || uiOpen() || !player || (RUN && RUN.over)) return;
    if(handleMapClick(ev)){ ev.stopImmediatePropagation(); ev.preventDefault(); updateUI(); }
  }, true);
  /* any key or a click elsewhere stops a walk */
  window.addEventListener('keydown', function(ev){
    var tag=ev.target&&ev.target.tagName;
    if(ev.key==='o'&&!ev.altKey&&!ev.ctrlKey&&!ev.metaKey&&tag!=='INPUT'&&tag!=='SELECT'&&tag!=='TEXTAREA'&&!uiOpen()){
      ev.preventDefault();ev.stopImmediatePropagation();if(!ev.repeat)toggleAutoExplore();return;
    }
    if(TRAVEL)stopTravel();
  }, true);
  window.addEventListener('pointerdown',function(ev){if(TRAVEL&&!(ev.target.closest&&ev.target.closest('[data-auto-explore]')))stopTravel();},true);
  document.addEventListener('visibilitychange',function(){if(document.hidden)stopTravel();});
  cv.addEventListener('mousemove', function(ev){
    if(aiming){ cv.style.cursor=''; return; }
    var p=tileAt(ev), it=clickIntent(p.x, p.y);
    cv.style.cursor = it ? (cursorFor(it.kind) || 'pointer') : '';
  });
  cv.addEventListener('mouseleave', function(){ cv.style.cursor=''; });
}, 0);

/* ---------------------------------------------------------------- the click spell, set from the hotbar */
/* only the single-target basics can be click spells: Magic Missile, Sap and the rank 2 bolts */
var CLICK_SPELLS = ['missile','sap','firebolt','frostshard','spark','root','smite','shadowbolt'];
function clickSpellable(key){ return CLICK_SPELLS.indexOf(key)>=0 && !!ABILITIES[key]; }
function toggleClickSpell(key){
  if(!clickSpellable(key)){ log('Only Magic Missile, Sap and the rank 2 element abilities can be click abilities.','c-info'); return; }
  player.clickSpell = player.clickSpell===key ? null : key;
  log(player.clickSpell ? 'Clicking an enemy now casts <b>'+ABILITIES[key].name+'</b>.' : 'Clicking an enemy no longer uses an ability.','c-info');
  sfx('ui-click'); abilityBar();
}


(function(){
  var st=document.createElement('style');
  st.textContent='#hotbar .slot .clickmark{position:absolute;left:3px;bottom:1px;font-size:12px;color:#9FD8FF;text-shadow:0 0 4px #3A8FD0}';
  document.head.appendChild(st);
})();
