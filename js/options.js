/* =====================================================================
   options.js - the Options sheet (2026-09-17): key bindings, audio, display and animation speed.
   Bindings: a custom key is translated into the action's default key before any other handler sees it
   (a synthetic keydown), and a default key whose action was moved elsewhere is swallowed. Arrow keys
   always move. Settings persist in localStorage.
   ===================================================================== */

/* ---------------------------------------------------------------- animation speed */
var ANIM_SPEED = 1;
try { ANIM_SPEED = parseFloat(localStorage.getItem('astra-temple-anim-speed')) || 1; } catch(e){}
var BASE_MOVE_MS = MOVE_MS, BASE_CLIP_MS = Object.assign({}, CLIP_MS), BASE_WINDUP = Object.assign({}, CLIP_WINDUP);
function applyAnimSpeed(){
  MOVE_MS = Math.round(BASE_MOVE_MS/ANIM_SPEED);
  for(var k in BASE_CLIP_MS) CLIP_MS[k] = k==='idle' ? BASE_CLIP_MS[k] : Math.max(16, Math.round(BASE_CLIP_MS[k]/ANIM_SPEED));
  for(var w in BASE_WINDUP) CLIP_WINDUP[w] = Math.round(BASE_WINDUP[w]/ANIM_SPEED);
}
applyAnimSpeed();
var _fxAtOpt = fxAt;
fxAt = function(dur, hold, unseen){ return _fxAtOpt(dur/ANIM_SPEED, hold===undefined ? undefined : hold/ANIM_SPEED, unseen); };
/* effects carry their own duration: shorten each one as it is queued */
function speedFxList(){
  if(!fx || fx._sp) return;
  fx.push = function(){ for(var i=0;i<arguments.length;i++){ var o=arguments[i]; if(o && o.dur && !o._sc){ o.dur=o.dur/ANIM_SPEED; o._sc=1; } } return Array.prototype.push.apply(this, arguments); };
  fx._sp = true;
}


/* ---------------------------------------------------------------- map zoom (2026-09-18)
   A multiplier on however many tiles the current view wants (desktop, phone portrait or landscape), so it
   stacks with the layout's own choice instead of replacing it. Closer = fewer, bigger tiles. */
var MAP_ZOOM_MUL = {far:1.3, normal:1, close:0.8, closest:0.65}, MAP_ZOOM='normal';
try { MAP_ZOOM = localStorage.getItem('astra-temple-map-zoom') || 'normal'; } catch(e){}
if(!MAP_ZOOM_MUL[MAP_ZOOM]) MAP_ZOOM='normal';

/* Map art is a display preference shared by ordinary Options and Sandbox. */
try{spriteOn=localStorage.getItem('astra-temple-map-art')!=='block';}catch(e){}
function setMapArt(mode){
  spriteOn=mode!=='block';
  try{localStorage.setItem('astra-temple-map-art',spriteOn?'sprite':'block');}catch(e){}
  var button=$('bArt');if(button)button.textContent=spriteOn?'Art: sprites':'Art: blocks';
  if(typeof player!=='undefined'&&player&&typeof map!=='undefined'&&map&&typeof vis!=='undefined'&&vis&&typeof seen!=='undefined'&&seen)draw();
}
if($('bArt'))$('bArt').textContent=spriteOn?'Art: sprites':'Art: blocks';

/* ---------------------------------------------------------------- the sheet */
(function(){
  var st=document.createElement('style');
  st.textContent=[
    '.optgrid{display:grid;grid-template-columns:minmax(260px,1.2fr) minmax(220px,1fr);gap:14px 26px;align-items:start}',
    '@media (max-width:640px){.optgrid{grid-template-columns:1fr}}',
    '.binds{display:grid;grid-template-columns:1fr auto 1fr auto;gap:3px 10px;align-items:center;font-size:11.5px}',
    '.binds span{color:var(--ash)}',
    '.binds button{min-width:64px;padding:2px 8px;font-size:11px;font-family:var(--mono);background:var(--panel-2);border:1px solid var(--edge);color:var(--gold);border-radius:4px}',
    '.binds button.wait{border-color:var(--gold);background:#2A2015;color:var(--ink)}',
    '.binds button.custom{color:#9FD8FF}',
    '.optrow{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;color:var(--ash)}',
    '.optrow input[type=range]{width:140px;accent-color:#B08A48}',
    '#titleSettings .optrow{flex-wrap:wrap}',
    'body.touch #modal .title-settings button{min-height:44px}',
    '.seg{display:inline-flex;border:1px solid var(--edge);border-radius:4px;overflow:hidden}',
    '.seg button{border:0;border-right:1px solid var(--edge);background:var(--panel-2);color:var(--ash);padding:3px 9px;font-size:11px;border-radius:0}',
    '.seg button:last-child{border-right:0} .seg button.on{background:#3A2E1C;color:var(--gold)}',
    '.legend{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font-size:11px} .legend b{color:var(--gold);font-weight:600} .legend span{color:var(--dim)}'
  ].join('\n');
  document.head.appendChild(st);
})();
function segHTML(id, opts, cur){ return '<span class="seg" data-seg="'+id+'">'+opts.map(function(o){ return '<button data-v="'+o[0]+'" class="'+(String(o[0])===String(cur)?'on':'')+'">'+o[1]+'</button>'; }).join('')+'</span>'; }
var UI_THEMES={ember:'Ember (Default)',forge:'Forge',vellum:'Vellum - Ivory','vellum-sand':'Vellum - Sand','vellum-ash':'Vellum - Ash',charcoal:'Charcoal',slate:'Slate',obsidian:'Obsidian',runestone:'Runestone'}, UI_TEXT_SIZES={small:'Small',normal:'Standard',large:'Large'};
var UI_THEME='ember',UI_TEXT_SIZE='normal',UI_OPACITY=100,UI_SIDE='left',UI_DESKTOP_PAD=false;
try{UI_SIDE=localStorage.getItem('fote-ui-side')||localStorage.getItem('fote-study-pad-side')||'left';UI_DESKTOP_PAD=(localStorage.getItem('fote-ui-desktop-pad')||localStorage.getItem('fote-study-desktop-pad'))==='shown';}catch(e){}
if(UI_SIDE!=='right')UI_SIDE='left';
try{UI_THEME=localStorage.getItem('fote-ui-theme')||UI_THEME;UI_TEXT_SIZE=localStorage.getItem('fote-ui-text')||UI_TEXT_SIZE;UI_OPACITY=Number(localStorage.getItem('fote-ui-opacity')||100);}catch(e){}
function applyUIAppearance(){
  if(!UI_THEMES[UI_THEME])UI_THEME='ember';
  if(!UI_TEXT_SIZES[UI_TEXT_SIZE])UI_TEXT_SIZE='normal';
  document.body.dataset.uiTheme=UI_THEME;document.body.dataset.uiText=UI_TEXT_SIZE;
  document.body.style.setProperty('--ui-text-scale',UI_TEXT_SIZE==='large'?'1.12':UI_TEXT_SIZE==='small'?'.9':'1');
  UI_OPACITY=Number.isFinite(UI_OPACITY)?Math.max(10,Math.min(100,UI_OPACITY)):100;
  document.body.classList.toggle('ui-paper-faded',UI_THEME.indexOf('vellum')===0&&UI_OPACITY<65);
  document.body.style.setProperty('--ui-background-opacity',String(UI_OPACITY/100));
  document.body.style.setProperty('--ui-background-percent',UI_OPACITY+'%');
  if(typeof FoteResponsiveHUD!=='undefined')FoteResponsiveHUD.relayout();
}
applyUIAppearance();
function appearanceSelect(id,label,choices,value){
  return '<label class="optrow"><span>'+label+'</span><select id="'+id+'">'+Object.keys(choices).map(function(k){return '<option value="'+k+'"'+(k===value?' selected':'')+'>'+choices[k]+'</option>';}).join('')+'</select></label>';
}
function settingsHTML(){
  var h='<div class="optgrid"><div><div class="sec">Key bindings <span style="text-transform:none;letter-spacing:0">(click, then press a key; Esc cancels)</span></div><div class="binds">';
  BIND_ACTIONS.forEach(function(b){
    var k=bindKey(b[0]);
    h+='<span>'+b[1]+'</span><button data-bind="'+b[0]+'" class="'+(REBINDING===b[0]?'wait':BINDS[b[0]]?'custom':'')+'">'+(REBINDING===b[0]?'press a key':keyLabel(k))+'</button>';
  });
  h+='</div><div style="margin-top:8px;display:flex;gap:8px;align-items:center"><button id="bindReset">Reset to defaults</button><span class="c-info" style="font-size:11px">Arrow keys always move. Esc closes windows.</span></div></div>';
  var lightOn = typeof lightingOn==='function' ? lightingOn() : true;
  h+='<div><div class="sec">Audio</div>'+
     '<div class="optrow"><span>Sound</span>'+segHTML('mute', [[0,'On'],[1,'Off']], AUDIO.muted?1:0)+'</div>'+
     '<div class="optrow"><span>Music</span>'+segHTML('music', [[1,'On'],[0,'Off']], AUDIO.musicOn?1:0)+'</div>'+
     '<label class="optrow"><span>Effects volume</span><input type="range" id="volSfx" min="0" max="100" value="'+Math.round((AUDIO.vol.sfx||0)*100)+'"></label>'+
     '<label class="optrow"><span>Music volume</span><input type="range" id="volMusic" min="0" max="100" value="'+Math.round((AUDIO.vol.music||0)*100)+'"></label>'+
     '<div class="sec">Display</div>'+
     appearanceSelect('uiSide','Status / log side',{left:'Left',right:'Right'},UI_SIDE)+
     (!(typeof MOBILE!=='undefined'&&MOBILE)?'<div class="optrow"><span>Movement pad</span>'+segHTML('desktopPad', [['shown','Shown'],['hidden','Hidden']],UI_DESKTOP_PAD?'shown':'hidden')+'</div>':'')+
     appearanceSelect('uiTheme','UI theme',UI_THEMES,UI_THEME)+
     appearanceSelect('uiTextSize','Text size',UI_TEXT_SIZES,UI_TEXT_SIZE)+
     '<label class="optrow ui-opacity-row"><span>UI transparency <output id="uiOpacityValue" for="uiOpacity">'+(100-UI_OPACITY)+'%</output></span><input type="range" id="uiOpacity" min="0" max="90" step="5" value="'+(100-UI_OPACITY)+'" aria-label="UI transparency" aria-describedby="uiOpacityHint"></label><div id="uiOpacityHint" class="c-info">Fades panel and button backgrounds. Text, icons and bars stay solid.</div>'+
     '<div class="optrow"><span>Map zoom</span>'+segHTML('mapzoom', [['far','Far'],['normal','Normal'],['close','Close'],['closest','Closest']], MAP_ZOOM)+'</div>'+
     '<div class="optrow"><span>Block art</span>'+segHTML('mapart', [['block','On'],['sprite','Off']], spriteOn?'sprite':'block')+'</div>'+
     '<div class="optrow"><span>Dynamic lighting</span>'+segHTML('light', [['on','On'],['off','Off']], lightOn?'on':'off')+'</div>'+
     '<div class="optrow"><span>Motion (sway, flicker, bob)</span>'+segHTML('motion', [['auto','Auto'],['on','On'],['off','Off']], ANIM.mode)+'</div>'+
     '<div class="optrow"><span>Animation speed</span>'+segHTML('speed', [[1,'1&times;'],[1.5,'1.5&times;'],[2,'2&times;'],[3,'3&times;']], ANIM_SPEED)+'</div>'+
     '<div class="sec">Reading the map</div><div class="legend">'+
     '<b>Dim tiles</b><span>remembered, not in sight</span><b>z over a head</b><span>asleep: surprise it</span><b>Key over a head</b><span>it carries a key</span>'+
     '<b>Bones at a door</b><span>a monster zoo behind it</span><b>Uneven stones</b><span>a hidden door nearby (search with F)</span><b>Tall grass</b><span>blocks sight, burns</span></div></div></div>';
  return h;
}
function optionsHTML(){return settingsHTML();}
function refreshOptions(){
  var root=$('titleSettings');
  if(root&&typeof modalOpen!=='undefined'&&modalOpen){
    var active=document.activeElement,selector='',scroll=root.parentElement.scrollTop;
    if(root.contains(active)){
      if(active.id)selector='#'+active.id;
      else if(active.hasAttribute('data-bind'))selector='[data-bind="'+active.getAttribute('data-bind')+'"]';
      else if(active.hasAttribute('data-v')&&active.closest('[data-seg]'))selector='[data-seg="'+active.closest('[data-seg]').getAttribute('data-seg')+'"] [data-v="'+active.getAttribute('data-v')+'"]';
    }
    root.innerHTML=settingsHTML();wireSettings(root);
    var focus=selector&&root.querySelector(selector);if(focus)focus.focus({preventScroll:true});
    root.parentElement.scrollTop=scroll;
  }else if(typeof refreshSheet==='function')refreshSheet();
}
function wireSettings(root){
  var side=root.querySelector('#uiSide');
  if(side)side.onchange=function(){UI_SIDE=side.value==='right'?'right':'left';try{localStorage.setItem('fote-ui-side',UI_SIDE);}catch(e){}if(typeof FoteResponsiveHUD!=='undefined')FoteResponsiveHUD.relayout();};
  var theme=root.querySelector('#uiTheme'),text=root.querySelector('#uiTextSize');
  if(theme)theme.onchange=function(){UI_THEME=theme.value;try{localStorage.setItem('fote-ui-theme',UI_THEME);}catch(e){}applyUIAppearance();};
  if(text)text.onchange=function(){UI_TEXT_SIZE=text.value;try{localStorage.setItem('fote-ui-text',UI_TEXT_SIZE);}catch(e){}applyUIAppearance();};
  var opacity=root.querySelector('#uiOpacity');
  if(opacity)opacity.oninput=function(){UI_OPACITY=100-Number(opacity.value);applyUIAppearance();root.querySelector('#uiOpacityValue').textContent=(100-UI_OPACITY)+'%';try{localStorage.setItem('fote-ui-opacity',String(UI_OPACITY));}catch(e){}};
  root.querySelectorAll('[data-bind]').forEach(function(b){ b.onclick=function(ev){ ev.stopPropagation(); REBINDING=b.getAttribute('data-bind'); refreshOptions(); }; });
  var rb=root.querySelector('#bindReset'); if(rb) rb.onclick=function(){ BINDS={}; REBINDING=null; saveBinds(); refreshOptions(); };
  root.querySelectorAll('[data-seg]').forEach(function(seg){
    var id=seg.getAttribute('data-seg');
    seg.querySelectorAll('button').forEach(function(b){ b.onclick=function(){
      var v=b.getAttribute('data-v');
      if(id==='mute'){ audioInit(); if((v==='1')!==AUDIO.muted) toggleMute(); if(typeof syncAudioButtons==='function') syncAudioButtons(); }
      if(id==='music'){ audioInit(); if((v==='1')!==AUDIO.musicOn) toggleMusic(); if(typeof syncAudioButtons==='function') syncAudioButtons(); }
      if(id==='light'){ try{ localStorage.setItem('astra-temple-light', v); }catch(e){} var bl=$('bLight'); if(bl) bl.textContent='Lighting: '+v; draw(); }
      if(id==='motion'){ if(typeof setMotion==='function') setMotion(v); }
      if(id==='mapart')setMapArt(v);
      if(id==='desktopPad'){UI_DESKTOP_PAD=v==='shown';try{localStorage.setItem('fote-ui-desktop-pad',UI_DESKTOP_PAD?'shown':'hidden');}catch(e){}if(typeof FoteResponsiveHUD!=='undefined')FoteResponsiveHUD.relayout();}
      if(id==='mapzoom'){ MAP_ZOOM=v; try{ localStorage.setItem('astra-temple-map-zoom', v); }catch(e){} resize(); }
      if(id==='speed'){ ANIM_SPEED=parseFloat(v)||1; try{ localStorage.setItem('astra-temple-anim-speed', String(ANIM_SPEED)); }catch(e){} applyAnimSpeed(); }
      sfx('ui-click'); refreshOptions();
    }; });
  });
  var vs=root.querySelector('#volSfx'); if(vs) vs.oninput=function(){ AUDIO.vol.sfx=vs.value/100; if(AUDIO.sfxBus) AUDIO.sfxBus.gain.value=AUDIO.vol.sfx; audioSave(); };
  var vm=root.querySelector('#volMusic'); if(vm) vm.oninput=function(){ AUDIO.vol.music=vm.value/100; if(AUDIO.musicBus && AUDIO.musicOn) AUDIO.musicBus.gain.value=AUDIO.vol.music; audioSave(); };
}
function wireOptions(root){wireSettings(root);}
