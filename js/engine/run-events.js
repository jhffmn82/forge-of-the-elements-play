/* Run milestones produce state changes and their presentation directly. */
function floorIntro(){
  log('<b>Floor '+floorNo+'</b> of the '+biomeName()+'.'+(bfloor()===1 && floorNo>1 ? ' The air turns cold and still.' : ''),'c-kill');
  if(floorMeta.forge) log('You feel heat in the stones. <b>The Elemental Forge</b> is on this floor.','c-kill');
  if(floorMeta.shrine) log('A distant hum of prayer: a <b>shrine to '+GODS[RUN.shrineGod].name+'</b> is on this floor.','c-kill');
  if(floorMeta.vault) log('Somewhere an iron vault is locked. Its key walks with one of the monsters.','c-info');
  if(floorMeta.boss&&!inCaverns()&&!inDeep()&&!floorMeta.unmakerPreview) log('<b>The Warchief\'s hall.</b> Grukk waits on his throne. Kill him to open the way on.','c-you');
  (floorMeta.notes||[]).forEach(function(n){ log(n,'c-info'); });
  playSceneMusic();

 if(floorMeta.boss&&inCaverns())log('<b>The Deep Maw\'s hall.</b> The ground here is riddled with burrows. Something vast moves under the stone.','c-you');
 if(inDeep()){
  if(floorMeta.boss)log('<b>The Matron\'s hall.</b> Candles burn scarlet before the idol of the spider goddess. Ritual circles wait on the floor.','c-you');
  else if(bfloor()===1)log('Warm air rises from below, and somewhere silk rustles in the dark.','c-info');
  if(deepMobsOn()&&floorMeta.boss)log('<b>The Matron\'s hall.</b> Ritual circles glow faintly in the dark. Break her rituals before they finish.','c-you');
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

 log('<b>'+e.base.name+' falls.</b> '+(e.kind==='matron'?'Her':'His')+' <b>'+coreName()+'</b> clatters to the floor, still burning with light. The exit gate will answer to it.','c-kill');
 if(affinityCap()!==capBefore)log('Your affinity cap is now <b>'+affinityCap()+'</b>.','c-kill');
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
    log(floorNo<LAST_FLOOR?'<b>The Deep Maw is dead.</b> Warm air rises through its burrow from the Underdark. Bring the Cavern Core to the opening to clear the way down.':'<b>The Deep Maw is dead.</b> Bring the Cavern Core to its burrow to clear the way out of the Caverns.','c-kill');
    if(!spot)log('The burrow cannot open while every reachable floor tile is occupied.','c-info');
    if(typeof draw==='function') draw();
  }
function death(){
 if(lastLaugh())return;
 if(RUN.over)return;
 var endedRun=RUN;RUN.over=true;setClip(player,'death');sfx('player-death');stopMusic();
 finishRunHistory(false);
 setTimeout(function(){if(RUN===endedRun&&RUN.over)showEnd(false);},1300);
 runId();if(deleteRunSaves())log('Death is final: this character&rsquo;s saves crumble to dust.','c-you');
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
    '<b class="end-score">'+n(record.score)+'<small>Final score'+(record.sandbox?' · sandbox':'')+'</small></b>'+
    '<div class="end-stats">'+[['Deepest floor',record.depth],['Level',record.level],['Bosses defeated',record.bosses],['Enemies defeated',n(record.kills)],['Turns',n(record.turns)],['Faith',record.faithRank?'Rank '+record.faithRank:'None']].map(function(pair){return '<span><small>'+pair[0]+'</small><b>'+pair[1]+'</b></span>';}).join('')+'</div>'+
    '<div class="end-affinities">'+esc(record.faith||'No patron')+'<br>'+record.affinities.map(function(a){return esc(cap(a.element))+' '+a.rank;}).join(' · ')+'</div>'+ui.breakdown(record)+
    (record.sandbox?'<p class="run-note">Sandbox run — not added to Previous Runs.</p>':RUN.historySaved===false?'<p class="run-note">Local storage is unavailable. This result is kept for this session only.</p>':'');
  el.style.display='flex';
}
function renderEndActions(won){
  var box=document.querySelector('#over .box'); if(!box) return;
  var actions=box.querySelector('.end-actions');if(!actions){actions=document.createElement('div');actions.className='end-actions';box.appendChild(actions);}
  if($('bAgain'))actions.appendChild($('bAgain'));
  var old=$('bSaveWin'); if(old) old.remove();
  var history=$('bHistoryEnd');if(!history){history=document.createElement('button');history.id='bHistoryEnd';history.textContent='Previous Runs';actions.appendChild(history);}history.onclick=function(){openRunHistory('end');};
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
