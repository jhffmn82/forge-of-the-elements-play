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
  var glyph = {close:'\u{1F6AA}', door:'\u{1F6AA}', break:'\u{1F528}', move:'\u{1F463}', grab:'\u{1F392}', stairs:'\u{1FA9C}', upstairs:'\u{1FA9C}', shoot:'\u{1F3F9}', cast:'✨', attack:'⚔️', use:'\u{1F449}', exit:'\u{1F6AA}'}[kind];
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
  if(!(player.levitate>0 || (typeof aff==='function' && aff('air')>=3))) return false;
  var p=propAt(x,y); return !(p && p.b);
}
function useTile(t){ return t===DOOR || t===CHEST || t===SHRINE || t===FORGE || t===LOCKED || t===SEALED || t===ICEDOOR || t===THORNS || t===TOLL || (t===EXIT && !floorMeta.exitOpen); }
function clickSpellReady(foe){
  var k=player.clickSpell; if(!k || player.abilities.indexOf(k)<0) return false;
  var A=ABILITIES[k]; if(!A) return false;
  return dist(player, foe) <= Math.max(1, spellRange(A)) && vis[idxOf(foe.x,foe.y)];
}
function clickIntent(x, y){
  if(!player || player.hp<=0 || !knownTile(x,y)) return null;
  var foe=ents.filter(function(e){ return e.foe && e.x===x && e.y===y && (revealAll||vis[idxOf(x,y)]); })[0];
  if(foe){
    if(clickSpellReady(foe)) return {kind:'cast', foe:foe};
    if(player.range>1 && dist(player,foe)<=player.range) return {kind:'shoot', foe:foe};
    if(dist(player,foe)<=1) return {kind:'attack', foe:foe};
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
  var pr=propAt(x,y); if(pr && pr.br && !pr.hoard) return {kind:'break'};
  if(t===EXIT) return {kind: floorMeta.exitOpen ? 'exit' : 'use'};
  if(t===DOOR || t===OPEN || t===LOCKED || t===SEALED || t===ICEDOOR || t===THORNS || t===TOLL) return {kind:'door'};
  if(useTile(t) || (propAt(x,y) && propAt(x,y).lever)) return {kind:'use'};
  if(items.some(function(it){ return it.x===x && it.y===y && it.kind!=='heart' && it.kind!=='managlobe'; })) return {kind:'grab'};
  if(travelWalkable(x,y) || passable(x,y) || t===OPEN) return {kind:'move'};
  return null;
}

/* ---------------------------------------------------------------- paths over what you know */
function travelPath(tx, ty, stopAdjacent){
  var W=MW, prev=new Int32Array(MW*MH).fill(-1), start=idxOf(player.x,player.y), goal=idxOf(tx,ty), q=[start], h=0;
  prev[start]=start;
  var knownTrap={}; feats.forEach(function(f){ if(f.found) knownTrap[idxOf(f.x,f.y)]=1; });
  while(h<q.length){
    var i=q[h++]; if(i===goal) break;
    var x=i%W, y=(i/W)|0;
    if(stopAdjacent && Math.max(Math.abs(x-tx),Math.abs(y-ty))<=1 && i!==start){ goal=i; break; }
    for(var dy=-1;dy<=1;dy++) for(var dx=-1;dx<=1;dx++){
      if(!dx && !dy) continue; var nx=x+dx, ny=y+dy; if(!inb(nx,ny)) continue; var ni=idxOf(nx,ny);
      if(prev[ni]>=0 || !knownTile(nx,ny)) continue;
      var t=at(nx,ny), isGoal = ni===goal;
      var ok = travelWalkable(nx,ny) || t===DOOR || t===OPEN || (isGoal && (useTile(t) || t===EXIT));
      if(!ok || (knownTrap[ni] && !isGoal)) continue;
      if(!isGoal && ents.some(function(e){ return e!==player && e.x===nx && e.y===ny && !e.ally; })) continue;
      prev[ni]=i; q.push(ni);
    }
  }
  if(prev[goal]<0) return null;
  var path=[], c=goal; while(c!==start){ path.push(c); c=prev[c]; }
  return path.reverse().map(function(i){ return {x:i%W, y:(i/W)|0}; });
}

/* ---------------------------------------------------------------- walking */
function visibleFoeIds(){ return ents.filter(function(e){ return e.foe && vis[idxOf(e.x,e.y)] && e.state!=='asleep'; }).map(function(e){ return e.id; }); }
var TRAVEL_TIMER=null;
function queueTravel(ms){clearTimeout(TRAVEL_TIMER);TRAVEL_TIMER=setTimeout(function(){TRAVEL_TIMER=null;travelStep();},ms);}
function stopTravel(why){clearTimeout(TRAVEL_TIMER);TRAVEL_TIMER=null;if(TRAVEL){ TRAVEL=null; if(why) log(why,'c-info'); } }
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
    if(!window.STEP_HINT){ window.STEP_HINT=true; log('With an enemy in sight you take one step at a time &mdash; click again to keep going.','c-info'); }
  }
  TRAVEL={path:path, then:then, hp:player.hp, foes:visibleFoeIds(), traps:feats.filter(function(f){ return f.found; }).length};
  travelStep();
}
function travelStep(){
  var T=TRAVEL; if(!T) return;
  if(uiOpen() || RUN.over || player.hp<=0){ stopTravel(); return; }
  if(typeof animBusy==='function' && animBusy()){ queueTravel(30); return; }
  /* what stops a walk */
  if(player.hp < T.hp){ stopTravel('You stop: you are hurt.'); return; }
  var foes=visibleFoeIds().filter(function(id){ return T.foes.indexOf(id)<0; });
  if(foes.length){ var f=ents.filter(function(e){ return e.id===foes[0]; })[0]; stopTravel('You stop: '+(f ? 'a '+f.name : 'something')+' comes into view.'); return; }
  if(feats.filter(function(f){ return f.found; }).length > T.traps){ stopTravel('You stop: you spotted a trap.'); return; }
  var step=T.path.shift();
  if(!step){ var then=T.then; TRAVEL=null; if(then) then(); return; }
  var dx=step.x-player.x, dy=step.y-player.y;
  if(Math.max(Math.abs(dx),Math.abs(dy))!==1){ stopTravel(); return; }
  var bx=player.x, by=player.y, bt=turn;
  lastDir=[dx,dy]; tryMove(dx,dy);
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
}

/* ---------------------------------------------------------------- the click itself */
function castClickSpell(foe){
  var i=player.abilities.indexOf(player.clickSpell); if(i<0) return false;
  if(aiming) cancelAim();
  useAbility(i);
  if(aiming){ castAt(foe.x, foe.y); return true; }
  return false;
}
function handleMapClick(ev){
  var p=tileAt(ev), it=clickIntent(p.x, p.y);
  if(!it) return false;
  stopTravel();
  if(it.kind==='cast'){ castClickSpell(it.foe); return true; }
  if(it.kind==='shoot') return false;            /* the game's own click shoots */
  if(it.kind==='close'){ closeDoorAt(p.x, p.y); return true; }
  if(it.kind==='break'){
    var near=function(){ return Math.max(Math.abs(p.x-player.x),Math.abs(p.y-player.y))===1; };
    var hit=function(){ if(near() && propAt(p.x,p.y)){ lastDir=[p.x-player.x, p.y-player.y]; tryMove(p.x-player.x, p.y-player.y); } };
    if(near()) hit(); else startTravel(travelPath(p.x, p.y, true), hit);
    return true;
  }
  if(it.kind==='attack'){ var dx=it.foe.x-player.x, dy=it.foe.y-player.y; lastDir=[dx,dy]; tryMove(dx,dy); return true; }
  if(it.foe){ startTravel(travelPath(it.foe.x, it.foe.y, true)); return true; }
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
    if(ev.target!==cv || aiming || uiOpen() || !player || (RUN && RUN.over)) return;
    if(handleMapClick(ev)){ ev.stopImmediatePropagation(); ev.preventDefault(); updateUI(); }
  }, true);
  /* any key or a click elsewhere stops a walk */
  window.addEventListener('keydown', function(){ if(TRAVEL) stopTravel(); }, true);
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
  if(!clickSpellable(key)){ log('Only Magic Missile, Sap and the rank 2 bolts can be click spells.','c-info'); return; }
  player.clickSpell = player.clickSpell===key ? null : key;
  log(player.clickSpell ? 'Clicking an enemy now casts <b>'+ABILITIES[key].name+'</b>.' : 'Clicking an enemy no longer casts a spell.','c-info');
  sfx('ui-click'); abilityBar();
}
var _abilityBarTravel = abilityBar;
abilityBar = function(){
  _abilityBarTravel();
  if(!$('hotbar') || !player || !player.hotbar) return;
  $('hotbar').querySelectorAll('.slot[data-i]').forEach(function(b){
    var s=player.hotbar[+b.getAttribute('data-i')];
    if(!s || s.type!=='ability' || !clickSpellable(s.key)) return;
    b.oncontextmenu=function(ev){ ev.preventDefault(); toggleClickSpell(s.key); };
    var timer=null;
    b.addEventListener('touchstart', function(){ timer=setTimeout(function(){ timer=null; b._longPress=true; toggleClickSpell(s.key); }, 550); }, {passive:true});
    b.addEventListener('click', function(ev){ if(b._longPress){ b._longPress=false; ev.stopImmediatePropagation(); ev.preventDefault(); } }, true);
    b.addEventListener('touchend', function(){ if(timer){ clearTimeout(timer); timer=null; } });
    if(player.clickSpell===s.key){ var m=document.createElement('span'); m.className='clickmark'; m.textContent='◎'; m.title='Your click spell'; b.appendChild(m); }
  });
};
(function(){
  var st=document.createElement('style');
  st.textContent='#hotbar .slot .clickmark{position:absolute;left:3px;bottom:1px;font-size:12px;color:#9FD8FF;text-shadow:0 0 4px #3A8FD0}';
  document.head.appendChild(st);
})();
var _hotbarCardTravel = hotbarCard;
hotbarCard = function(i){
  var h=_hotbarCardTravel(i), s=player.hotbar && player.hotbar[i];
  if(s && s.type==='ability' && clickSpellable(s.key))
    h+='<div class="hint">'+(player.clickSpell===s.key ? 'Your click spell. Right-click or long-press to unset.' : 'Right-click or long-press: click enemies to cast this.')+'</div>';
  return h;
};
