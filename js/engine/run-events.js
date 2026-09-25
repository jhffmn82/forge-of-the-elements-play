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

  RUN.bossDead=true; floorMeta.exitOpen=true;
  for(var i=0;i<4;i++){ var c=nearFree(e.x,e.y,2)||{x:e.x,y:e.y}; items.push(i===0?{x:c.x,y:c.y,kind:'essence',n:60}:i===1?{x:c.x,y:c.y,kind:'mote',el:pick(ELEMENTS)}:(function(){ var g=randomGear(); g.x=c.x; g.y=c.y; g.it.plus=rollEnhancement(1); g.it.tier=Math.max(2,tierNum(g.it)); tierNormalize(g.it); return g; })()); }
  explosionFx(e.x,e.y); playSceneMusic();
  ents.forEach(function(o){ if(o.foe && o.guard) applyStatus(o,'fear',6); });

 floorMeta.exitOpen=false;
 var c=nearFree(e.x,e.y,2)||{x:e.x,y:e.y};items.push({x:c.x,y:c.y,kind:'core',name:coreName()});
 log('<b>'+e.base.name+' falls.</b> '+(e.kind==='matron'?'Her':'His')+' <b>'+coreName()+'</b> clatters to the floor, still burning with light. The exit gate will answer to it.','c-kill');
 if(affinityCap()!==capBefore)log('Your affinity cap is now <b>'+affinityCap()+'</b>.','c-kill');
}
function caveBossDown(){
    if(!RUN || RUN.victory || RUN.over || !floorMeta || floorMeta.caveWon) return;
    floorMeta.caveWon=true; RUN.bossDead=true;
    var A=floorMeta.bossArena, spot=null;
    if(A){ var c={x:A.x+Math.floor(A.w/2), y:A.y+Math.floor(A.h/2)}; spot=(walkable(c.x,c.y) && !occupied(c.x,c.y)) ? c : nearFree(c.x,c.y,6); }
    if(!spot) spot=nearFree(player.x,player.y,4);
    if(spot){ setT(spot.x, spot.y, EXIT); floorMeta.exitOpen=true; floorMeta.caveExit=spot; if(typeof sparkleFx==='function') sparkleFx(spot.x,spot.y,'earth',30); }
    log(floorNo<LAST_FLOOR?'<b>The Deep Maw is dead.</b> Its burrow gapes open, and warm air breathes up from far below: the way down into the Underdark. Gather what it left, then step in.':'<b>The Deep Maw is dead.</b> Its burrow gapes open: the way up and out of the Caverns. Gather what it left, then step in.','c-kill');
    if(!spot){var completedRun=RUN;setTimeout(function(){if(RUN===completedRun&&!RUN.over&&!RUN.victory)victory();},1500);}
    if(typeof draw==='function') draw();
  }
function death(){
 if(lastLaugh())return;
 if(RUN.over)return;
 var endedRun=RUN;RUN.over=true;setClip(player,'death');sfx('player-death');stopMusic();
 setTimeout(function(){if(RUN===endedRun&&RUN.over)showEnd(false);},1300);
 runId();if(deleteRunSaves())log('Death is final: this character&rsquo;s saves crumble to dust.','c-you');
}
function renderEndSummary(won){
  var el=$('over'); if(!el) return;
  $('overT').textContent = won ? 'The '+biomeName()+' is behind you' : 'You died';
  $('overP').innerHTML = (won ? (floorNo>=10 ? player.name+' laid Morty the Mostly-Dead to rest for good. The Caverns wait below.<br><br>' : player.name+' cut through the Dungeon and threw down Grukk the Warchief. The Crypt waits below.<br><br>') :
    'Floor '+floorNo+' of the '+biomeName()+' claimed '+player.name+'.<br><br>') +
    '<b>'+player.who+'</b> &middot; level '+player.level+' &middot; '+RUN.turns+' turns &middot; '+RUN.kills+' kills'+
    (player.god ? '<br>Piety with '+GODS[player.god].name+': rank '+godRank() : '') +
    '<br>Affinity: '+(Object.keys(player.aff).map(function(k){ return cap(k)+' '+player.aff[k]; }).join(', ')||'none');
  el.style.display='flex';


  if(won && floorNo>=LAST_FLOOR && inCaverns()){
    var tt=$('overT'); if(tt) tt.textContent='The Caverns are behind you';
    var p=$('overP'); if(p) p.innerHTML=p.innerHTML.replace(/^[\s\S]*?<br><br>/, player.name+' brought down the Deep Maw in the dark beneath the world. The Caverns are behind you.<br><br>');
  }


  if(won && floorNo>=LAST_FLOOR && inDeep()){
    var tt=$('overT'); if(tt) tt.textContent='The Underdark is behind you';
    var p=$('overP'); if(p) p.innerHTML=p.innerHTML.replace(/^[\s\S]*?<br><br>/, player.name+' cut down the Matron of the Web beneath her goddess\'s idol. The Underdark is behind you.<br><br>');
  }
  if(won&&floorMeta.unmakerEncounter&&floorMeta.unmakerEncounter.status==='victory'){
    $('overT').textContent='The Forge of the Elements is restored';
    $('overP').innerHTML=$('overP').innerHTML.replace(/^[\s\S]*?<br><br>/,player.name+' defeated the Unmaker and restored balance to the material plane. The elements burn in harmony once more.<br><br>');
  }
}
function renderEndActions(won){

  var box=document.querySelector('#over .box'); if(!box) return;
  var old=$('bSaveWin'); if(old) old.remove();
  var tb=$('bTitleEnd'); if(!tb){ tb=document.createElement('button'); tb.id='bTitleEnd'; tb.textContent='Title screen'; tb.style.marginLeft='8px'; box.appendChild(tb); }
  tb.onclick=function(){ $('over').style.display='none'; openTitle(); };
  if(won){
    var b=document.createElement('button'); b.id='bSaveWin'; b.textContent='Save this character'; b.style.marginLeft='8px';
    b.onclick=function(){
      /* never overwrite another character: the first empty slot, or this run's own slot */
      var slot=['1','2','3'].filter(function(k){ var d=readSlot(k); return !d || saveBelongsToRun(d); })[0];
      if(!slot){ b.textContent='All slots full: free one in Load Game'; b.disabled=true; return; }
      if(writeSlot(slot,'victory')){ b.textContent='Saved to slot '+slot; b.disabled=true; }
    };
    box.insertBefore(b, tb);
  }
}
function showEnd(won){renderEndSummary(won);renderEndActions(won);}
