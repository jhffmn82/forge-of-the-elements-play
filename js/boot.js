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

  /* help sheet */
  var help=$('mHelp');
  if(help) help.innerHTML='<div class="cols">'+
    '<div><p class="sub">Moving</p><div class="kv"><span>Arrows / WASD</span><b>step or attack</b><span>Q E Z C</span><b>diagonals</b><span>Click a tile</span><b>step that way</b><span>. or space</span><b>wait a turn</b><span>r</span><b>rest until healed (searches a little)</b><span>f</span><b>search for hidden doors and traps</b><span>&gt; / &lt;</span><b>stairs down / up</b><span>Shift+C / click the door</span><b>close a door</b></div></div>'+
    '<div><p class="sub">Acting</p><div class="kv"><span>1 &ndash; 8</span><b>hotbar slot</b><span>g</span><b>pick up</b><span>Click a monster</span><b>shoot it (bow out)</b><span>Bump a door, chest, lever</span><b>use it</b><span>Bump the Forge / a shrine</span><b>open it</b></div></div>'+
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

  newRun(Date.now()%1000000, CHOICE);
  setMotion('auto');
  requestAnimationFrame(resize);
  requestAnimationFrame(fxTick);
  setTimeout(resize, 150);
  /* load every sprite sheet before the game shows, so nothing flashes up as a placeholder square */
  preloadArt(openTitle);
})();

/* A failed or undecoded required atlas must never reveal an incomplete scene. */
function preloadArt(done){
  var files=(window.ASSETS && ASSETS.files)||[];
  var veil=document.createElement('div'); veil.id='loadVeil';
  veil.style.cssText='position:fixed;inset:0;z-index:99;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#0B0A09;color:#A79C93;font:14px sans-serif';
  var title=document.createElement('h1'); title.textContent='Forge of the Elements'; veil.appendChild(title);
  var status=document.createElement('p'); status.setAttribute('role','status'); veil.appendChild(status);
  var retry=document.createElement('button'); retry.textContent='Retry loading'; retry.hidden=true; veil.appendChild(retry);
  document.body.appendChild(veil);
  var scriptsReady=new Promise(function(resolve){
    if(document.readyState==='complete') resolve();
    else window.addEventListener('load',resolve,{once:true});
  });
  function imageReady(file){
    atl(file); var img=ATL[file];
    return new Promise(function(resolve,reject){
      function clean(){ img.removeEventListener('load',loaded); img.removeEventListener('error',failed); }
      function failed(){ clean(); reject(new Error(file)); }
      function loaded(){
        clean();
        if(!img.naturalWidth) return reject(new Error(file));
        Promise.resolve(typeof img.decode==='function'?img.decode():undefined).then(resolve,function(){reject(new Error(file));});
      }
      if(img.complete){ if(img.naturalWidth) loaded(); else failed(); }
      else { img.addEventListener('load',loaded); img.addEventListener('error',failed); }
    });
  }
  var failed=[];
  function attempt(){
    retry.hidden=true; status.textContent='Lighting the torches…';
    failed.forEach(function(file){delete ATL[file];}); failed=[];
    if(!files.length){status.textContent='The artwork manifest could not be loaded. Reload to try again.';return;}
    var loaded=0;
    Promise.all(files.map(function(file){return imageReady(file).then(function(){
      loaded++;status.textContent='Loading artwork '+loaded+' / '+files.length;
    },function(){failed.push(file);});})).then(function(){
      if(failed.length){status.textContent='Could not load '+failed.length+' artwork file(s). Check your connection and retry.';retry.hidden=false;return;}
      return scriptsReady.then(function(){return document.fonts?document.fonts.ready:undefined;}).then(function(){
        return new Promise(function(resolve){requestAnimationFrame(function(){resize();draw();requestAnimationFrame(resolve);});});
      }).then(function(){done();veil.remove();});
    }).catch(function(){status.textContent='The scene could not be prepared. Retry loading.';retry.hidden=false;});
  }
  retry.onclick=attempt; attempt();
}
