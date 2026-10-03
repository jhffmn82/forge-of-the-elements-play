/* ============================================================================
   boot.js - wire the sandbox, add screen shake, and start at the title screen.
   ========================================================================== */

var GAME_STARTED=false,GAME_START_READY=null;
function startGame(){
  if(GAME_STARTED)return GAME_START_READY;
  GAME_STARTED=true;
  /* sandbox: replace the old preset picker with a new-character button and testing tools */
  var pre=$('preset'); if(pre && pre.parentNode) pre.parentNode.style.display='none';
  var sb=document.querySelector('#mSand .sandbox');
  if(sb){
    var extra=document.createElement('div'); extra.style.display='contents';
    extra.innerHTML='<div class="field"><label>Character</label><button id="bCreate">New character</button></div>'+
      '<div class="field"><label for="jump">Jump to floor</label><select id="jump"><option value="">&mdash;</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></div>'+
      '<div class="field"><label>Motes</label><button id="bMotes">One of each</button></div>'+
      '<div class="field"><label>Essence</label><button id="bEss">+100</button></div>'+
      '<div class="field"><label>Heal</label><button id="bHeal">Full HP and mana</button></div>';
    sb.insertBefore(extra, sb.firstChild);
  }
  $('bCreate').onclick=function(){ showSheet(openSheet); openCreate(); };
  $('jump').onchange=function(){ var n=+this.value; if(!n) return; floorNo=n-1; if(n===1){ floorNo=1; generate(worldSeed+7); player._lx=undefined; floorIntro(); resize(); updateUI(); } else descend(); showSheet(openSheet); this.value=''; };
  $('bMotes').onclick=function(){ ELEMENTS.forEach(function(e){ player.motes[e]=(player.motes[e]||0)+1; }); log('A mote of every element appears in your pouch.','c-good'); updateUI(); refreshSheet(); };
  $('bEss').onclick=function(){ player.essence+=100; updateUI(); refreshSheet(); };
  $('bHeal').onclick=function(){ player.hp=player.maxhp; player.mp=player.maxmp; player.hunger=HUNGER_MAX; updateUI(); };
  $('bNew').onclick=function(){ worldSeed=(worldSeed*48271+11)>>>0; generate(worldSeed); player._lx=undefined; floorIntro(); resize(); updateUI(); };
  $('bSpawn').onclick=function(){
    var c=nearFree(player.x,player.y,4); if(!c) return;
    var m=spawn(rollMonster(), c.x, c.y); m.state='hunt'; log('A '+m.name+' arrives.','c-info'); draw(); updateUI();
  };
  $('bGive').onclick=function(){
    var g=randomGear(), e=bagEntryFor(g);
    if(e && addBag(e[0],e[1],e[2])) log('A <b>'+e[1]+'</b> appears in your bag.','c-good');
    updateUI(); refreshSheet();
  };
  $('bLevel').onclick=function(){ gainXP(player.xpNext-player.xp,{earned:false}); updateUI(); };
  $('bAgain').onclick=function(){ $('over').style.display='none'; openCreate(); };

  /* help sheet */
  var help=$('mHelp');
  if(help) help.innerHTML='<div class="cols">'+
    '<div><p class="sub">Moving</p><div class="kv"><span>Arrows / WASD</span><b>step or attack</b><span>Q E Z C</span><b>diagonals</b><span>Click a tile</span><b>step that way</b><span>. or space</span><b>wait a turn</b><span>r</span><b>rest until healed (searches a little)</b><span>f</span><b>search for hidden doors and traps</b><span>o / Explore</span><b>explore until danger appears; press again to stop</b><span>&gt; / &lt;</span><b>stairs down / up</b><span>Shift+C / click the door</span><b>close a door</b></div></div>'+
    '<div><p class="sub">Acting</p><div class="kv"><span>1 to 8</span><b>hotbar slot</b><span>g</span><b>pick up</b><span>Click a monster</span><b>shoot it (bow out)</b><span>Bump a door, chest, lever</span><b>use it</b><span>Bump the Forge / a shrine</span><b>open it</b></div></div>'+
    '<div><p class="sub">Windows</p><div class="kv"><span>Tab</span><b>character</b><span>i</span><b>bag and gear</b><span>p</span><b>faith and god abilities</b><span>m / n</span><b>sound / music</b><span>esc</span><b>close</b><span>Right-click bag item</span><b>drop it</b></div></div>'+
    '<div><p class="sub">Reading the map</p><div class="kv"><span>Dim tiles</span><b>remembered</b><span>z</span><b>asleep: surprise it</b><span>Key over a head</span><b>key holder</b><span>Bones at a door</span><b>a zoo behind it</b><span>Uneven stones</span><b>a hidden door near</b><span>Tall grass</span><b>blocks sight, burns</b></div></div></div>';

  /* left-click an open door right next to you to shut it; clicking past it still walks through */
  window.addEventListener('click', function(ev){
    if(ev.target!==cv || aiming || !player || (RUN && (RUN.over||RUN.victory))) return;
    var r=cv.getBoundingClientRect();
    var mx=camX+Math.floor((ev.clientX-r.left+camOX)/TS), my=camY+Math.floor((ev.clientY-r.top+camOY)/TS);
    /* something standing in the doorway (an enemy to attack, an ally, an item): let the click act normally */
    if(at(mx,my)===OPEN && Math.max(Math.abs(mx-player.x),Math.abs(my-player.y))===1 && doorClosable(mx,my)){ ev.stopImmediatePropagation(); ev.preventDefault(); closeDoorAt(mx,my); updateUI(); }
  }, true);

  /* right-click an open door beside you to shut it (right-click still cancels aiming first) */
  cv.addEventListener('contextmenu', function(ev){
    if(document.body.classList.contains('touch'))return;
    if(aiming || !player || (RUN && (RUN.over||RUN.victory))) return;
    var r=cv.getBoundingClientRect();
    var mx=camX+Math.floor((ev.clientX-r.left+camOX)/TS), my=camY+Math.floor((ev.clientY-r.top+camOY)/TS);
    if(at(mx,my)===OPEN && doorClosable(mx,my)){ ev.preventDefault(); closeDoorAt(mx,my); updateUI(); }
  });

  var bl=$('bLight');
  if(bl){
    bl.textContent='Lighting: '+(lightingOn()?'on':'off');
    bl.onclick=function(){ try{ localStorage.setItem('astra-temple-light', lightingOn()?'off':'on'); }catch(e){} bl.textContent='Lighting: '+(lightingOn()?'on':'off'); draw(); };
  }

  /* 2026-09-28 (Justin): the run behind the title is not the player's. It used up the first-run tips (newRun in
     create.js), so a real first run never showed them; they now wait for the first run the player begins. */
  window.TIPS_SHOWN=true;
  newRun(Date.now()%1000000, CHOICE);
  window.TIPS_SHOWN=false;
  setMotion(ANIM.mode);
  requestAnimationFrame(resize);
  requestAnimationFrame(fxTick);
  setTimeout(resize, 150);
  GAME_START_READY=preloadArt(function(){FoteLifecycle.ready();openTitle();});
  return GAME_START_READY;
}

/* Request native appearance selectors for the current residents, including
 * sleeping/concealed actors. Existing draw/UI requests cover current objects.
 * This is a startup set, not a list of every floor visited during a run. */
function startupSceneAtlasFiles(){
  var look=typeof playerCastLook==='function'?playerCastLook():player&&player.look;
  if(look){castSheet(look);var spec=AS.cast&&AS.cast[look];if(spec&&spec.doll)atl('cast-'+look+'-doll.webp');}
  var residents=(typeof ents!=='undefined'?ents:[]).concat(floorMeta&&floorMeta.buriedGhouls||[],floorMeta&&floorMeta.maw&&floorMeta.maw.ent||[],floorMeta&&floorMeta.pendingLich&&floorMeta.pendingLich.entity||[]);
  residents.forEach(function(actor){
    if(!actor||actor===player||actor.hp<=0&&!(floorMeta&&floorMeta.pendingLich&&actor===floorMeta.pendingLich.entity))return;
    if(actor.shadowClone){castSheet(actor.cloneLook);return;}
    if(actor.livingFlame){atl('living-flame.webp');return;}
    if(typeof isShadeSummon==='function'&&isShadeSummon(actor)){shadeSummonSheet();return;}
    if(actor.base&&actor.base.sprite)mobSheet(actor.base.sprite);
  });
  return Object.keys(ATL);
}
/* Await only this scene. The atlas owner bounds both requests and decode work;
 * later content retains its native on-demand loading and retry path. */
function preloadArt(done){
  var veil=document.createElement('div'); veil.id='loadVeil';
  veil.setAttribute('data-fote-startup','');
  veil.style.cssText='position:fixed;inset:0;z-index:99;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#0B0A09;color:#A79C93;font:14px sans-serif';
  var title=document.createElement('h1'); title.textContent='Forge of the Elements'; veil.appendChild(title);
  var status=document.createElement('p'); status.setAttribute('role','status'); veil.appendChild(status);
  var retry=document.createElement('button'); retry.textContent='Retry loading'; retry.hidden=true; veil.appendChild(retry);
  document.body.appendChild(veil);
  var scriptsReady=new Promise(function(resolve){
    if(document.readyState==='complete') resolve();
    else window.addEventListener('load',resolve,{once:true});
  });
  var resolveReady,rejectReady,finished=false,loading=false,completion=new Promise(function(resolve,reject){resolveReady=resolve;rejectReady=reject;});
  async function awaitFiles(files){
    if(typeof setAtlasProtectedFiles==='function')setAtlasProtectedFiles(files);
    var loaded=0;await Promise.all(files.map(function(file){return atlReady(file,{retry:true}).then(function(){loaded++;status.textContent='Loading this scene '+loaded+' / '+files.length;});}));
  }
  async function attempt(){
    if(loading||finished)return;loading=true;
    retry.hidden=true; status.textContent='Lighting the torches…';
    try{
      if(!window.ASSETS||!Array.isArray(ASSETS.files)||!ASSETS.files.length)throw Error('The artwork manifest could not be loaded.');
      await scriptsReady;await awaitFiles(startupSceneAtlasFiles());
      // Environment sources have their own caches. Prepare them in order and
      // request only current terrain, instead of decoding all biomes and Chaos.
      await FoteEnvironmentProps.ensureAssets();await FoteEnvironmentDeco.ensureAssets();await FoteEnvironmentVegetation.ensureAssets();await FoteEnvironmentTerrain.ensureAssets();
      if(typeof FoteChaosCampaign!=='undefined'&&floorMeta&&(floorMeta.chaosCampaign||floorMeta.chaosPreview||floorMeta.chaosEntryPreview)){status.textContent='Preparing this part of the Realm of Chaos…';await FoteChaosCampaign.prepare();}
      if(typeof FotePortraitAnimation!=='undefined'&&typeof FotePortraitAnimation.retry==='function')await FotePortraitAnimation.retry(player.look);
      if(document.fonts)await document.fonts.ready;
      var previous=null,stable=false;
      for(var pass=0;pass<6;pass++){
        var files=startupSceneAtlasFiles().sort();await awaitFiles(files);
        await new Promise(function(resolve){requestAnimationFrame(function(){resize();draw();requestAnimationFrame(resolve);});});
        var discovered=startupSceneAtlasFiles().sort().join('|');
        if(discovered===files.join('|')&&discovered===previous){stable=true;break;}previous=discovered;
      }
      if(!stable)throw Error('This scene is still requesting artwork. Retry loading.');
      finished=true;
      try{done();if(typeof setAtlasProtectedFiles==='function')setAtlasProtectedFiles([]);veil.remove();resolveReady();}catch(error){veil.remove();rejectReady(error);}
    }catch(error){status.textContent='Could not prepare this scene: '+String(error.message||error)+' Retry loading.';retry.hidden=false;}
    finally{loading=false;}
  }
  retry.onclick=attempt; attempt();
  return completion;
}
