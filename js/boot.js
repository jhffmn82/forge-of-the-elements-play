/* ============================================================================
   boot.js - wire the sandbox, add screen shake, and start at the title screen.
   ========================================================================== */

(function(){
  /* screen shake wraps the renderer */
  var baseDraw = draw;
  window.draw = function(){
    if(SHAKE>0.5 && !ANIM.reduce){
      ctx.save(); ctx.translate((Math.random()-0.5)*SHAKE, (Math.random()-0.5)*SHAKE); baseDraw(); ctx.restore();
      SHAKE*=0.86;
    } else { SHAKE=0; baseDraw(); }
  };

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
  $('bLevel').onclick=function(){ gainXP(player.xpNext-player.xp); updateUI(); };
  $('bAgain').onclick=function(){ $('over').style.display='none'; openCreate(); };
  $('bStairs').onclick=function(){ if(at(player.x,player.y)===STAIRS) descend(); else log('No stairs here.','c-info'); };
  $('bGrab').onclick=function(){ if(grab()) endTurn(); };
  $('bClose').onclick=function(){ closeAdjacentDoors(); updateUI(); };
  $('bSwap').onclick=function(){ swapWeapon(); };

  /* help sheet */
  var help=$('mHelp');
  if(help) help.innerHTML='<div class="cols">'+
    '<div><p class="sub">Moving</p><div class="kv"><span>Arrows / WASD</span><b>step or attack</b><span>Q E Z C</span><b>diagonals</b><span>Click a tile</span><b>step that way</b><span>. or space</span><b>wait a turn</b><span>r</span><b>rest until healed (searches a little)</b><span>f</span><b>search for hidden doors and traps</b><span>&gt;</span><b>take the stairs</b><span>Shift+C / click the door</span><b>close a door</b></div></div>'+
    '<div><p class="sub">Acting</p><div class="kv"><span>1 &ndash; 8</span><b>hotbar slot</b><span>g</span><b>pick up</b><span>x</span><b>swap weapon sets</b><span>Click a monster</span><b>shoot it (bow out)</b><span>Bump a door, chest, lever</span><b>use it</b><span>Bump the Forge / a shrine</span><b>open it</b></div></div>'+
    '<div><p class="sub">Windows</p><div class="kv"><span>Tab</span><b>character</b><span>i</span><b>bag and gear</b><span>p</span><b>faith and prayers</b><span>m / n</span><b>sound / music</b><span>esc</span><b>close</b><span>Right-click bag item</span><b>drop it</b></div></div>'+
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
    if(aiming || !player || (RUN && (RUN.over||RUN.victory))) return;
    var r=cv.getBoundingClientRect();
    var mx=camX+Math.floor((ev.clientX-r.left+camOX)/TS), my=camY+Math.floor((ev.clientY-r.top+camOY)/TS);
    if(at(mx,my)===OPEN && doorClosable(mx,my)){ ev.preventDefault(); closeDoorAt(mx,my); updateUI(); }
  });

  var bl=$('bLight');
  if(bl){
    bl.textContent='Lighting: '+(lightingOn()?'on':'off');
    bl.onclick=function(){ try{ localStorage.setItem('fote-light', lightingOn()?'off':'on'); }catch(e){} bl.textContent='Lighting: '+(lightingOn()?'on':'off'); draw(); };
  }

  loadSprites();
  newRun(Date.now()%1000000, CHOICE);
  setMotion('auto');
  requestAnimationFrame(resize);
  requestAnimationFrame(fxTick);
  setTimeout(resize, 150);
  /* load every sprite sheet before the game shows, so nothing flashes up as a placeholder square */
  preloadArt(openTitle);
})();

function preloadArt(done){
  var files=(window.ASSETS && ASSETS.files) || [], left=files.length, finished=false;
  var veil=document.createElement('div');
  veil.id='loadVeil';
  veil.style.cssText='position:fixed;inset:0;z-index:99;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#0B0A09;color:#A79C93;font:12px "IBM Plex Mono",monospace;letter-spacing:.08em';
  veil.innerHTML='<div style="font:700 26px Grenze Gotisch,serif;color:#E8B44A">Forge of the Elements</div><div id="loadTxt">LIGHTING THE TORCHES&hellip;</div>'+
    '<div style="width:220px;height:6px;border:1px solid #332A24;border-radius:3px;overflow:hidden"><i id="loadBar" style="display:block;height:100%;width:0;background:linear-gradient(90deg,#6B5A22,#E8B44A)"></i></div>';
  document.body.appendChild(veil);
  function finish(){ if(finished) return; finished=true; veil.remove(); draw(); done(); }
  function tick(){ left--; var pct=files.length ? Math.round((files.length-left)/files.length*100) : 100; var bar=document.getElementById('loadBar'); if(bar) bar.style.width=pct+'%'; if(left<=0) finish(); }
  if(!files.length){ finish(); return; }
  files.forEach(function(f){
    var im=atl(f);
    if(ATL[f].complete && ATL[f].naturalWidth){ tick(); return; }
    ATL[f].addEventListener('load', tick, {once:true});
    ATL[f].addEventListener('error', tick, {once:true});
  });
  setTimeout(finish, 20000);   /* never trap the player behind a slow file */
}
