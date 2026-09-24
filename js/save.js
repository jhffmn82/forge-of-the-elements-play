/* =====================================================================
   save.js - title screen, saving and loading (2026-09-17).
   A save is a snapshot of every piece of run state (the character, the run, the current floor as it stands),
   graph-encoded so shared objects stay shared (a bag item on the hotbar, the player inside ents).
   Three manual slots plus an autosave written on each new floor, kept in localStorage; any save can be
   exported to a file and imported back. Loading never touches the game's data tables, so a save made
   before a balance change picks up the new rules.
   ===================================================================== */

var SAVE_FORMAT = 'fote-save-1';
var SAVE_SLOTS = ['auto', '1', '2', '3'];
/* run state only: data tables (ABILITIES, SIGILS...) always come from the current code */
var SAVE_KEYS = FoteState.fields;

/* ---------------------------------------------------------------- graph encoding */
function saveEncode(root){return FoteCodec.encode(root,function(value){return value instanceof Node || value instanceof CanvasRenderingContext2D || (window.ImageBitmap && value instanceof ImageBitmap) || (window.AudioNode && value instanceof AudioNode);});}
function saveDecode(root){return FoteCodec.decode(root);}

/* ---------------------------------------------------------------- snapshot and restore */
function saveSnapshot(label){
  // Never persist a half-resolved enemy phase, including unload/recovery saves.
  gameTurns.flush();
  var g=gameState.snapshot();
  var logHtml=[]; var L=$('log'); if(L) for(var i=Math.max(0,L.children.length-40); i<L.children.length; i++) logHtml.push([L.children[i].className, L.children[i].innerHTML]);
  return {format:SAVE_FORMAT, savedAt:new Date().toISOString(), label:label||'',
    summary:{runId:runId(), name:player.name, who:player.who, cls:player.cls, race:player.race, god:player.god||null, level:player.level, floor:floorNo, turns:RUN.turns||turn},
    state:saveEncode(g), rngState:typeof rng.state==='function'?rng.state():null, log:logHtml};
}
function saveApply(data){
  FotePersistence.restore(data,{
    decode:saveDecode,validate:FoteState.validate,state:gameState,
    getRandom:function(){return rng;},setRandom:function(value){rng=value;},
    restoreRandom:function(document,state){rng=mulberry32(Number.isInteger(document.rngState)?document.rngState:((state.worldSeed||1)^(state.turn*2654435761))>>>0);},
    migrations:[restoreRunReferences,migrateXpCurve,repairCoreProgress,repairWallMemorials,
      refreshCavernResidents,refreshEncounterTuning,repairSavedEffectClocks,
      saveMigrateSigils,sigilNamesRefresh,ensureRuneLooks,migrateRangedSlot,hideRetiredSwapSlots,restorePuzzleState],
    recompute:function(){derive(player);}
  });
  gameTurns.cancel();PACING.pending=null;stopTravel();fxClock=0;
  if(typeof SANDBOX!=='undefined')SANDBOX.normalTitle=false;
  /* Presentation is rebuilt only after every migration and validation succeeds. */
  fx=[]; PARTS.length=0; aiming=null; LAST_HIT=null;
  if(typeof modalOpen!=='undefined' && modalOpen && typeof closeModal==='function') closeModal();
  if(typeof SURF_CACHE!=='undefined') SURF_CACHE.key=null;
  var L=$('log'); if(L){ L.innerHTML=''; (data.log||[]).forEach(function(p){ log(p[1], p[0]); }); }
  log('<b>Game loaded.</b> '+player.name+', level '+player.level+', floor '+floorNo+'.','c-kill');
  var ov=$('over'); if(ov) ov.style.display='none';
  closeTitle(); if($('create')) $('create').classList.remove('on');
  if(openSheet) showSheet(openSheet);
  resize(); if(typeof abilityBar==='function') abilityBar(); updateUI(); draw();
  playSceneMusic();
}
function restoreRunReferences(){
  if(player.buffs)delete player.buffs.unbound;
  floorMeta.puzzles=rooms.filter(function(room){return room&&room.puzzle;});
  ents.forEach(function(entity){entity._lx=undefined;entity._ly=undefined;});
  RUN.over=false;
  if(player.off&&!player.off.kind&&player.off.name===EMPTY_OFF.name)player.off=EMPTY_OFF;
}

/* sigils cut or renamed since a save was made become their nearest current sigil, and new sigils get a look */
var SIGIL_RENAMED = {mana2:'identify2', steam:'smoke', soulfire:'smoke', mist:'mana', sandstorm:'mire'};
function saveMigrateSigils(){
  function fix(use){ return SIGILS[use] ? use : (SIGIL_RENAMED[use] && SIGILS[SIGIL_RENAMED[use]] ? SIGIL_RENAMED[use] : 'firestorm'); }
  (player.bag||[]).forEach(function(b){ if(b.kind==='sigil' && b.data){ b.data.use=fix(b.data.use); b.uid='sigil:'+b.data.use; b.name=sigilName(b.data.use)||b.name; } });
  (items||[]).forEach(function(it){ if(it.kind==='sigil'){ if(it.use) it.use=fix(it.use); if(it.it && it.it.use) it.it.use=fix(it.it.use); } });
  var used={}; Object.keys(sigilLook||{}).forEach(function(k){ used[sigilLook[k]]=1; });
  var spare=SIGIL_LOOKS.map(function(l){ return cap(l)+' sigil'; }).filter(function(n){ return !used[n]; });
  Object.keys(SIGILS).forEach(function(k){
    if(!sigilLook[k]){ sigilLook[k]=spare.length ? spare.shift() : 'Strange sigil'; sigilKnown[k]=false; if(RUN.sigilLooks) RUN.sigilLooks[k]=sigilLook[k].replace(/ sigil$/,'').toLowerCase(); }
  });
  (player.bag||[]).forEach(function(b){ if(b.kind==='sigil' && b.data) b.name=sigilName(b.data.use); });
}

/* every run has an id, so death can find and delete that run's saves (roguelike: the dead stay dead) */
function runId(){ if(RUN && !RUN.id) RUN.id='run-'+Date.now().toString(36)+'-'+Math.floor(Math.random()*1e6).toString(36); return RUN ? RUN.id : null; }
function saveBelongsToRun(d){
  if(!d || !d.summary) return false;
  if(d.summary.runId) return d.summary.runId===RUN.id;
  /* saves made before run ids: match the character */
  return d.summary.name===player.name && d.summary.cls===player.cls && d.summary.race===player.race;
}
function deleteRunSaves(){
  var gone=0;
  SAVE_SLOTS.concat(['rescue']).forEach(function(s){ if(saveBelongsToRun(readSlot(s))){ deleteSlot(s); gone++; } });
  return gone;
}


/* ---------------------------------------------------------------- the original game's saves, once
   2026-09-22 (Justin): this build goes back to the original address, jhffmn82.github.io/forge-of-the-elements-play/.
   Both addresses share one origin, so the fote-* keys the original game wrote there (saves, rescue, key binds,
   lighting, map zoom, animation speed, audio) sit beside the astra-temple-* keys this build reads. The first launch
   copies each original value into its key here when that key is empty and never touches the originals; a flag makes
   it a one-time pass, so a slot deleted afterwards stays deleted. Copied settings take effect from the next launch. */
var LEGACY_KEYS = [['fote-save-auto','astra-temple-save-auto'],['fote-save-1','astra-temple-save-1'],['fote-save-2','astra-temple-save-2'],
  ['fote-save-3','astra-temple-save-3'],['fote-rescue','astra-temple-rescue'],['fote-binds','astra-temple-binds'],['fote-light','astra-temple-light'],
  ['fote-map-zoom','astra-temple-map-zoom'],['fote-anim-speed','astra-temple-anim-speed'],['fote-audio','astra-temple-audio']];
function importLegacySaves(){
  var copied=0;
  try{
    if(localStorage.getItem('astra-temple-legacy-import')) return 0;
    LEGACY_KEYS.forEach(function(p){ var v=localStorage.getItem(p[0]); if(v!==null && localStorage.getItem(p[1])===null){ localStorage.setItem(p[1], v); copied++; } });
    localStorage.setItem('astra-temple-legacy-import', new Date().toISOString());
  }catch(e){}
  return copied;
}
importLegacySaves();

/* ---------------------------------------------------------------- slots */
function slotKey(s){ return 'astra-temple-save-'+s; }
function readSlot(s){
  try{
    var raw = s==='rescue' ? localStorage.getItem('astra-temple-rescue') : localStorage.getItem(slotKey(s));
    if(!raw) return null; var d=JSON.parse(raw);
    if(s==='rescue') d.summary=d.summary||{}, d.savedAt=d.savedAt||'';
    return d;
  }catch(e){ return null; }
}
function writeSlot(s, label){
  if(gameTurns.running()){afterTurn(function(){writeSlot(s,label);});return true;}
  gameTurns.flush();
  if(!player || !RUN){ return false; }
  if(RUN.over){ log('The dead cannot be saved.','c-info'); return false; }
  try{ localStorage.setItem(slotKey(s), JSON.stringify(saveSnapshot(label))); return true; }
  catch(e){ log('Saving failed: '+String(e.message||e)+'. Try exporting to a file.','c-you'); return false; }
}
function saveTo(s){ if(writeSlot(s)){ log('<b>Saved</b> to '+(s==='auto'?'the autosave':'slot '+s)+'.','c-good'); sfx('ui-click'); return true; } return false; }
function loadFrom(s){
  var d=readSlot(s); if(!d){ log('That slot is empty.','c-info'); return; }
  try{ saveApply(d); sfx('ui-click'); }
  catch(e){ console.error(e); alert('That save could not be loaded: '+(e.message||e)); }
}
function deleteSlot(s){ try{ localStorage.removeItem(s==='rescue' ? 'astra-temple-rescue' : slotKey(s)); }catch(e){} }
function slotSummary(d){
  if(!d) return '<span class="c-info">Empty</span>';
  var s=d.summary||{}, when=d.savedAt ? new Date(d.savedAt) : null;
  return '<b>'+(s.name||'?')+'</b> &middot; '+(s.race?cap(s.race)+' ':'')+(s.cls?cap(s.cls):'')+' &middot; level '+(s.level||'?')+' &middot; floor '+(s.floor||'?')+
    (s.god && GODS[s.god] ? ' &middot; '+GODS[s.god].name.split(',')[0] : '')+(when && !isNaN(when) ? '<div class="when">'+when.toLocaleString()+'</div>' : '');
}
function exportSave(){
  gameTurns.flush();
  if(!player || !RUN) return;
  if(RUN.over){log('The dead cannot be saved.','c-info');return;}
  var blob=new Blob([JSON.stringify(saveSnapshot('export'))], {type:'application/json'});
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='fote-'+(player.name||'save').replace(/[^A-Za-z0-9]+/g,'-').toLowerCase()+'-L'+player.level+'-F'+floorNo+'.json';
  document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function importSave(){
  var inp=document.createElement('input'); inp.type='file'; inp.accept='.json,application/json';
  inp.onchange=function(){
    var f=inp.files && inp.files[0]; if(!f) return;
    var rd=new FileReader();
    rd.onload=function(){ try{ saveApply(JSON.parse(rd.result)); }catch(e){ console.error(e); alert('That file could not be loaded: '+(e.message||e)); } };
    rd.readAsText(f);
  };
  inp.click();
}

/* autosave on every new floor */


/* ---------------------------------------------------------------- title screen */
(function(){
  var st=document.createElement('style');
  st.textContent=[
    '#title{position:fixed;inset:0;z-index:45;display:none;background:#0B0908 url(art/title/title.jpg) center/cover no-repeat}',
    '#title.on{display:block}',
    '#title::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(8,6,5,.72) 0%,rgba(8,6,5,.25) 38%,rgba(8,6,5,0) 60%);pointer-events:none}',
    '#title .menu{position:absolute;z-index:1;left:clamp(16px,6vw,90px);top:52%;display:flex;flex-direction:column;gap:10px;width:min(300px,calc(100vw - 32px))}',
    '#title .menu button{font-family:var(--display);font-size:24px;letter-spacing:.02em;text-align:left;padding:9px 18px;color:#F2D9A0;',
    '  background:rgba(20,15,12,.82);border:1px solid #5A4630;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.5)}',
    '#title .menu button:hover:not(:disabled),#title .menu button:focus-visible{border-color:#E8B44A;color:#FFE7B0;background:rgba(42,30,20,.9);outline:none}',
    '#title .menu button:disabled{opacity:.4;cursor:default}',
    '#title .menu .sub{font-family:var(--mono);font-size:11px;color:var(--ash);display:block;letter-spacing:0}',
    '#title .panel{position:absolute;z-index:2;left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,calc(100vw - 32px));max-height:calc(100vh - 40px);overflow-y:auto;',
    '  background:rgba(18,14,11,.96);border:1px solid #5A4630;border-radius:8px;padding:18px 20px;box-shadow:0 10px 40px rgba(0,0,0,.7)}',
    '#title .panel h2{font-family:var(--display);color:var(--gold);font-size:26px;margin:0 0 10px}',
    '#title .panel p{color:var(--ash);line-height:1.55;margin:0 0 10px;font-size:12.5px}',
    '.slots{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}',
    '.slotrow{display:grid;grid-template-columns:70px 1fr auto;gap:10px;align-items:center;padding:8px 10px;border:1px solid var(--edge);border-radius:5px;background:#151110;font-size:12px}',
    '.slotrow .nm{color:var(--gold);font-size:11px;text-transform:uppercase;letter-spacing:.1em}',
    '.slotrow .when{color:var(--dim);font-size:10.5px;margin-top:2px}',
    '.slotrow .act{display:flex;gap:5px}',
    '.slotrow .act button{padding:3px 9px;font-size:11px}',
    '.panelfoot{display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap}'
  ].join('\n');
  document.head.appendChild(st);
})();

function openTitle(){
  var el=$('title');
  if(!el){ el=document.createElement('div'); el.id='title'; document.body.appendChild(el); }
  el.classList.add('on');
  if($('create')) $('create').classList.remove('on');
  playMusic('menu');   /* the vocal song; character creation plays the instrumental intro (Justin, 2026-09-22) */
  renderTitleMenu();
}
/* a browser only lets a page close a window it opened itself: try, and otherwise say goodbye so the tab can be closed */
function exitGame(){
  if(typeof stopMusic==='function') stopMusic();
  try{ window.close(); }catch(e){}
  setTimeout(function(){
    var el=$('title'); if(!el) return;
    el.innerHTML='<div class="panel" style="text-align:center"><h2>Farewell</h2><p>The forge fire banks low. Your saves are kept in this browser; close this tab or window whenever you like.</p>'+
      '<div class="panelfoot" style="justify-content:center"><button id="tBack">Back to the title</button></div></div>';
    $('tBack').onclick=function(){ playMusic('menu'); renderTitleMenu(); };
  }, 150);
}
function closeTitle(){ var el=$('title'); if(el) el.classList.remove('on'); }
function latestSave(){
  var best=null, bestSlot=null;
  SAVE_SLOTS.forEach(function(s){ var d=readSlot(s); if(d && d.summary && typeof d.savedAt==='string' && Number.isFinite(Date.parse(d.savedAt)) && (!best || d.savedAt>best.savedAt)){ best=d; bestSlot=s; } });
  return bestSlot;
}
function renderTitleMenu(){
  var el=$('title'), last=latestSave(), lastD=last ? readSlot(last) : null;
  el.innerHTML='<div class="menu">'+
    (last ? '<button id="tContinue">Continue<span class="sub">'+(lastD.summary.name||'')+' &middot; level '+lastD.summary.level+' &middot; floor '+lastD.summary.floor+'</span></button>' : '')+
    '<button id="tNew">New Game</button>'+
    '<button id="tLoad">Load Game</button>'+
    '<button id="tAbout">About</button>'+
    '<button id="tUpdate">Version &middot; '+(typeof FOTE_VERSION==='string'?FOTE_VERSION:'Beta 1.1')+'<span id="versionStatus" class="sub" role="status"></span></button></div>';
  if($('tContinue')) $('tContinue').onclick=function(){ audioInit(); loadFrom(last); };
  $('tNew').onclick=function(){ audioInit(); sfx('ui-click'); closeTitle(); openCreate(); };
  $('tLoad').onclick=function(){ audioInit(); sfx('ui-click'); renderLoadPanel(); };
  $('tAbout').onclick=function(){ audioInit(); sfx('ui-click'); renderAbout(); };
  $('tUpdate').onclick=function(){ audioInit(); sfx('ui-click'); if(typeof showVersion==='function') showVersion(); };
  if(typeof checkGameVersion==='function') checkGameVersion();
  var first=el.querySelector('.menu button'); if(first) first.focus();
}
function slotRows(mode){
  var rows=SAVE_SLOTS.map(function(s){ return {s:s, d:readSlot(s)}; });
  var rescue=readSlot('rescue'); if(rescue && mode==='load') rows.push({s:'rescue', d:rescue});
  return '<div class="slots">'+rows.map(function(r){
    var name = r.s==='auto' ? 'Autosave' : r.s==='rescue' ? 'Recovered' : 'Slot '+r.s;
    var act='';
    if(mode==='load') act = r.d ? '<button data-load="'+r.s+'">Load</button><button data-del="'+r.s+'" title="Delete this save">&times;</button>' : '';
    else if(r.s!=='auto' && r.s!=='rescue') act = '<button data-save="'+r.s+'">'+(r.d?'Overwrite':'Save')+'</button>';
    return '<div class="slotrow"><span class="nm">'+name+'</span><span>'+slotSummary(r.d)+'</span><span class="act">'+act+'</span></div>';
  }).join('')+'</div>';
}
function renderLoadPanel(){
  var el=$('title');
  el.innerHTML='<div class="panel"><h2>Load Game</h2>'+slotRows('load')+
    '<div class="panelfoot"><button id="tImport">Import from file&hellip;</button><button id="tBack">Back</button></div></div>';
  el.querySelectorAll('[data-load]').forEach(function(b){ b.onclick=function(){ loadFrom(b.getAttribute('data-load')); }; });
  el.querySelectorAll('[data-del]').forEach(function(b){ b.onclick=function(){ if(confirm('Delete this save? This cannot be undone.')){ deleteSlot(b.getAttribute('data-del')); renderLoadPanel(); } }; });
  $('tImport').onclick=importSave;
  $('tBack').onclick=renderTitleMenu;
}
function renderAbout(){
  var el=$('title');
  el.innerHTML='<div class="panel"><h2>About</h2>'+
    '<p><b>Forge of the Elements</b> is a turn-based roguelike. Pick a race and a class and descend twenty floors: the Dungeon, the Crypt, the Caverns and the Underdark, each held by its own lord, with portals to the six elemental planes along the way. Carry elemental motes to the Forge to shape your gear and your magic, swear yourself to a god, and take at most two elements into yourself.</p>'+
    '<p>Everything happens in turns: you act, then the dungeon answers. Hover anything for details. Tab opens your character, I your gear, P your faith, Esc closes windows. Key bindings, sound, lighting and animation speed live in the Options tab, along with saving.</p>'+
    '<h3>Credits</h3>'+
    '<p>Created by <b>Justin Hoffman</b>: design, story, world, balance, and the direction of every creature, map and sound in it. The title theme, <i>Strike the Steel</i>, and the end-credits song, <i>To Bind the Flame</i>, are written by Justin.</p>'+
    '<p>Creature and map art painted to his direction with ChatGPT image generation and brought to life with PixelLab; score with Google Lyria; sound effects with ElevenLabs; code written with Claude and OpenAI Codex. Storybook in spirit, hand-picked throughout.</p>'+
    '<div class="panelfoot"><span></span><button id="tBack">Back</button></div></div>';
  $('tBack').onclick=renderTitleMenu;
}

/* ---------------------------------------------------------------- Options: save / load section */
var _optionsHTMLSave = optionsHTML;
optionsHTML = function(){
  var h=_optionsHTMLSave();
  var dead = RUN && RUN.over;
  return '<div class="sec">Save game</div>'+(dead ? '<p class="c-info" style="font-size:11.5px">The dead cannot be saved.</p>' : slotRows('save'))+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px"><button id="oExport"'+(dead?' disabled':'')+'>Export to file</button><button id="oImport">Import from file</button><button id="oTitle">Quit to title</button><button id="oExit">Exit game</button></div>'+h;
};
var _wireOptionsSave = wireOptions;
wireOptions = function(root){
  _wireOptionsSave(root);
  root.querySelectorAll('[data-save]').forEach(function(b){ b.onclick=function(){ if(saveTo(b.getAttribute('data-save'))) refreshSheet(); }; });
  var ex=$('oExport'); if(ex) ex.onclick=exportSave;
  var im=$('oImport'); if(im) im.onclick=importSave;
  var ox=$('oExit'); if(ox) ox.onclick=function(){ confirmBox('Exit game', 'Unsaved progress since your last save is lost.', 'Exit', function(){ closeModal(); if(openSheet) showSheet(openSheet); openTitle(); exitGame(); }); };
  var tt=$('oTitle'); if(tt) tt.onclick=function(){ confirmBox('Quit to title', 'Unsaved progress since your last save is lost.', 'Quit', function(){ closeModal(); if(openSheet) showSheet(openSheet); openTitle(); }); };
};

/* the end screen: a winner can save the character to carry on later */
