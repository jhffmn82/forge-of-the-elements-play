/* Run milestones produce state changes and their presentation directly. */
// Compact authored entry notices at display time, including cached/save floors.
// Unknown instructions and the raw notes used by generators remain unchanged.
var FLOOR_ENTRY_NOTICES={
  'Bones and claw marks litter one doorway. A crowd of monsters sleeps behind it.':'Monster zoo: sleeping enemies.',
  'An iron door confines a room packed with sleeping monsters.':'Locked zoo: packed with sleeping monsters.',
  'One room swallows light. Only Light or Fire affinity cuts through it.':'Dark room: Light or Fire reveals it.',
  '<b>A crystal vault</b> glints somewhere on this floor. Its crystal key lies about; inside, you may take one treasure.':'Crystal vault: find key; choose one treasure.',
  '<b>Chasm vault.</b> A chasm splits a side room with treasure beyond. Floating would carry you over.':'Chasm vault: levitation crosses the gap.',
  '<b>Drowned cellar.</b> A flooded cellar: swimming across is possible, but the cold water takes its toll.':'Drowned cellar: cold water hurts; levitate across.',
  '<b>Burning chamber.</b> ':'Burning chamber.',
  '<b>Frozen hoard.</b> Treasure sealed in blocks of ice. Weapons only glance off them; fire will melt them.':'Frozen hoard: Fire melts the ice.',
  '<b>Everburning door.</b> A doorway wreathed in flame that never dies. Water would put it out.':'Everburning door: Water puts out the flames.',
  '<b>Scalding baths.</b> ':'Scalding baths.',
  '<b>Spike gauntlet.</b> A room bristling with spikes. Skin of stone would shrug them off.':'Spike gauntlet: Stoneskin protects against spikes.',
  '<b>Stone sentinels.</b> Two stone sentinels guard a hoard. They let their own kind pass.':'Stone sentinels: pass as stone.',
  '<b>Lightless room.</b> A room of perfect darkness, and the smell of old blood. Light would show what waits in it.':'Lightless room: Light reveals it.',
  '<b>Sentry gallery.</b> Statues with glowing eyes watch over a gallery. Unseen, you could pass.':'Sentry gallery: pass unseen.',
  '<b>Silent library.</b> A hushed library. Any sound here would wake what keeps it.':'Silent library: noise wakes its keeper.',
  'A chasm splits the caverns. Rope bridges cross it; the drop does not forgive.':'Rope bridges cross the chasm.',
  'Five islands drift in the void, linked by paired portals. A magical current on the last island carries you deeper.':'Chaos: paired portals link five islands. Final current leads deeper.',
  'There are no god shrines in the Realm of Chaos.':'No shrines in Chaos.',
  "The Unmaker's Crucible, the last floor. You are safe here until you open the gate.":"Unmaker's Crucible: safe until you open the gate.",
  'Open the entrance gate when you are ready; it seals behind you for the fight. Defeat all three forms of the Unmaker to reach the Forge of the Elements.':'Entrance gate seals behind you. Defeat all three forms to reach the Forge.'
};
function floorEntryNote(note){
  if(Object.prototype.hasOwnProperty.call(FLOOR_ENTRY_NOTICES,note))return FLOOR_ENTRY_NOTICES[note];
  if(typeof PLANE_TITLE!=='undefined'){
    var element=Object.keys(PLANE_TITLE).find(function(el){return note==='Something hums on this floor: <b>a portal to '+PLANE_TITLE[el]+'</b> stands open.';});
    if(element)return cap(element)+' portal open.';
  }
  return note;
}
function floorIntro(){
  log('<b>'+biomeName()+' · Floor '+floorNo+'</b>.','c-kill');
  if(floorMeta.forge) log('<b>Elemental Forge</b>.','c-kill');
  if(floorMeta.shrine) log('<b>'+GODS[RUN.shrineGod].name+' shrine</b>.','c-kill');
  if(floorMeta.vault) log('Iron vault: key carried by a monster.','c-info');
  if(floorMeta.boss&&!inCaverns()&&!inDeep()&&!floorMeta.unmakerPreview) log(inCrypt() ? '<b>Morty\'s hall.</b> Break his phylactery to keep him dead.' : '<b>Warchief\'s hall.</b> Bring his core to the gate.','c-you');
  (floorMeta.notes||[]).forEach(function(n){ log(floorEntryNote(n),'c-info'); });
  playSceneMusic();

 if(floorMeta.boss&&inCaverns())log('<b>Deep Maw\'s hall.</b> Burrows cover the ground.','c-you');
 if(inDeep()){
  if(floorMeta.boss)log('<b>Matron\'s hall.</b>','c-you');
  else if(bfloor()===1)log('Silk rustles in the dark.','c-info');
  if(deepMobsOn()&&floorMeta.boss)log('Break her rituals before they finish.','c-you');
 }
}
function bossDefeated(e){
 if(typeof FoteUnmakerEncounter!=='undefined'&&FoteUnmakerEncounter.onDefeated(e))return;
 if(floorMeta.bossRewarded)return;floorMeta.bossRewarded=true;
 if(RUN.cores===undefined)RUN.cores=0;var capBefore=affinityCap();

  RUN.bossDead=true; floorMeta.exitOpen=false;
  dropBossCore(e);
  for(var i=0;i<4;i++){ var c=coreDropSpot(e); items.push(i===0?{x:c.x,y:c.y,kind:'essence',n:60}:i===1?{x:c.x,y:c.y,kind:'mote',el:pick(ELEMENTS)}:(function(){ var g=randomGear(); g.x=c.x; g.y=c.y; g.it.plus=rollEnhancement(1); g.it.tier=Math.max(2,tierNum(g.it)); tierNormalize(g.it); return g; })()); }
  explosionFx(e.x,e.y); playSceneMusic();
  ents.forEach(function(o){ if(o.foe && o.guard) applyStatus(o,'fear',6); });

 log('<b>'+coreName()+'</b> dropped. Bring it to the exit gate.','c-kill');
 if(affinityCap()!==capBefore)log('Affinity cap: <b>'+affinityCap()+'</b>.','c-kill');
}
function caveExitSpot(x,y,radius){
  var reachable=coreReachableTiles();
  for(var r=0;r<=radius;r++)for(var dy=-r;dy<=r;dy++)for(var dx=-r;dx<=r;dx++){
    if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
    var nx=x+dx,ny=y+dy;
    if(inb(nx,ny)&&reachable.has(nx+','+ny)&&at(nx,ny)===FLOOR&&walkable(nx,ny)&&!occupied(nx,ny)&&!itemAt(nx,ny))return {x:nx,y:ny};
  }
  return null;
}
function caveFallbackExitSpot(){
  var best=null,distance=Infinity;
  coreReachableTiles().forEach(function(key){
    var xy=key.split(',').map(Number),x=xy[0],y=xy[1],d=Math.max(Math.abs(x-player.x),Math.abs(y-player.y));
    // Loot may share an exit. Solid props, actors and disconnected rooms may not.
    if(at(x,y)===FLOOR&&walkable(x,y)&&!occupied(x,y)&&!items.some(function(it){return it.x===x&&it.y===y&&it.kind==='core';})&&d<distance){best={x:x,y:y};distance=d;}
  });
  return best;
}
function caveBossDown(){
    if(!RUN || RUN.victory || RUN.over || !floorMeta || floorMeta.caveWon) return;
    floorMeta.caveWon=true; RUN.bossDead=true;
    var A=floorMeta.bossArena, spot=null;
    if(A)spot=caveExitSpot(A.x+Math.floor(A.w/2),A.y+Math.floor(A.h/2),6);
    if(!spot)spot=caveExitSpot(player.x,player.y,4);
    if(!spot)spot=caveFallbackExitSpot();
    if(spot){ setT(spot.x, spot.y, EXIT); floorMeta.exitOpen=false; floorMeta.caveExit=spot; if(typeof sparkleFx==='function') sparkleFx(spot.x,spot.y,'earth',30); }
    log(floorNo<LAST_FLOOR?'Bring the Cavern Core to the burrow to enter the Underdark.':'Bring the Cavern Core to the burrow to leave the Caverns.','c-kill');
    if(!spot)log('Burrow blocked: clear a reachable floor tile.','c-info');
    if(typeof draw==='function') draw();
  }
function death(){
 if(lastLaugh())return;
 if(RUN.over)return;
 var endedRun=RUN;RUN.over=true;setClip(player,'death');sfx('player-death');stopMusic();
 finishRunHistory(false);
 setTimeout(function(){if(RUN===endedRun&&RUN.over)showEnd(false);},1300);
 runId();if(deleteRunSaves())log('Death is final. Run saves deleted.','c-you');
}
function renderEndSummary(won){
  var el=$('over'); if(!el) return;
  var record=runEndRecord(won),ui=FoteRunHistoryUI,esc=ui.escape,n=ui.number;
  el.classList.add('end-screen');el.setAttribute('role','dialog');el.setAttribute('aria-labelledby','overT');
  $('overT').textContent=won?'The Forge of the Elements is restored':'Your journey ends here';
  var body=$('overP');if(body.tagName==='P'){var replacement=document.createElement('div');replacement.id='overP';body.replaceWith(replacement);body=replacement;}
  body.innerHTML='<div class="end-elements" aria-hidden="true">'+['#f57a40','#7ac9f4','#bcb2fa','#acb573','#ffe298','#b286ce'].map(function(col){return '<span style="--element:'+col+'"></span>';}).join('')+'</div>'+
    '<div class="end-name">'+esc(record.name)+'</div><div class="run-build">'+ui.build(record)+'</div>'+
    '<p class="end-story">'+(won?'You defeated the Unmaker and restored balance to the material plane. Fire, water, air, earth, light and shadow burn in harmony once more. Your work is done.':'Floor '+record.floor+' of the '+esc(record.biome)+' claimed another adventurer. Your journey is remembered.')+'</p>'+
    '<b class="end-score">'+(record.scoreUnavailable?'Unknown':n(record.score))+'<small>'+(record.earningsEstimated?'Estimated final score':'Final score')+(record.sandbox?' · sandbox':'')+'</small></b>'+
    '<div class="end-stats">'+[['Deepest floor',record.depth],['Level',record.level],['Bosses defeated',record.bosses],['Enemies defeated',n(record.kills)],['Turns',n(record.turns)],['Faith',record.faithRank?'Rank '+record.faithRank:'None']].map(function(pair){return '<span><small>'+pair[0]+'</small><b>'+pair[1]+'</b></span>';}).join('')+'</div>'+
    '<div class="end-affinities">'+esc(record.faith||'No patron')+'<br>'+record.affinities.map(function(a){return esc(cap(a.element))+' '+a.rank;}).join(' · ')+'</div>'+ui.breakdown(record)+
    (record.sandbox?'<p class="run-note">Sandbox run: not added to Previous Runs.</p>':RUN.historySaved===false?'<p class="run-note">Local storage is unavailable. This result is kept for this session only.</p>':'');
  el.style.display='flex';
}
function renderEndActions(won){
  var box=document.querySelector('#over .box'); if(!box) return;
  var actions=box.querySelector('.end-actions');if(!actions){actions=document.createElement('div');actions.className='end-actions';box.appendChild(actions);}
  if($('bAgain'))actions.appendChild($('bAgain'));
  var old=$('bSaveWin'); if(old) old.remove();
  var history=$('bHistoryEnd');if(!history){history=document.createElement('button');history.id='bHistoryEnd';history.textContent='Previous Runs';actions.appendChild(history);}history.onclick=function(){openRunHistory('end');};
  var report=$('bReportEnd');if(!report){report=document.createElement('button');report.id='bReportEnd';report.textContent='Run report';actions.appendChild(report);}report.onclick=function(){FoteRunHistoryUI.openReport(runEndRecord(won),'end');};
  var tb=$('bTitleEnd'); if(!tb){ tb=document.createElement('button'); tb.id='bTitleEnd'; tb.textContent='Title screen';actions.appendChild(tb); }
  tb.onclick=function(){ $('over').style.display='none'; openTitle(); };
  if(won){
    var b=document.createElement('button'); b.id='bSaveWin'; b.textContent='Save this character'; b.style.marginLeft='8px';
    b.onclick=function(){
      /* never overwrite another character: the first empty slot, or this run's own slot */
      var slot=['1','2','3'].filter(function(k){ var d=readSlot(k); return !d || saveBelongsToRun(d); })[0];
      if(!slot){ b.textContent='All slots full: free one in Load Game'; b.disabled=true; return; }
      if(writeSlot(slot,'victory')){ b.textContent='Saved to slot '+slot; b.disabled=true; }
    };
    actions.insertBefore(b, tb);
  }
}
function showEnd(won){
  renderEndSummary(won);renderEndActions(won);
  // A previous ending may have been scrolled to its buttons on a short phone.
  var box=document.querySelector('#over .box');if(box)box.scrollTop=0;
}
