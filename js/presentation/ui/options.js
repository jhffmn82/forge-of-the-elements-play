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
/* Canonical resize brings each multiplied target two tiles closer: landscape
   Far/Normal/Close/Closest target 16/12/10/8 rows; width follows the map panel. */
var MAP_ZOOM_MUL = {far:18/12, normal:14/12, close:1, closest:10/12};
var MAP_ZOOM_DEFAULT=uiUsesTouchInput()&&Math.min(innerWidth,innerHeight)<600?'close':'normal',MAP_ZOOM=MAP_ZOOM_DEFAULT;
try { MAP_ZOOM = localStorage.getItem('astra-temple-map-zoom') || MAP_ZOOM_DEFAULT; } catch(e){}
if(!Object.prototype.hasOwnProperty.call(MAP_ZOOM_MUL,MAP_ZOOM)) MAP_ZOOM=MAP_ZOOM_DEFAULT;

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
    '.binds{display:grid;grid-template-columns:1fr auto 1fr auto;gap:3px 10px;align-items:center;font-size:calc(11.5px + var(--ui-mobile-text-add,0px))}',
    '.binds span{color:var(--ash)}',
    '.binds button{min-width:64px;padding:2px 8px;font-size:calc(11px + var(--ui-mobile-text-add,0px));font-family:var(--mono);background:var(--panel-2);border:1px solid var(--edge);color:var(--gold);border-radius:4px}',
    '.binds button.wait{border-color:var(--gold);background:#2A2015;color:var(--ink)}',
    '.binds button.custom{color:#9FD8FF}',
    '.optrow{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:calc(12px + var(--ui-mobile-text-add,0px));color:var(--ash)}',
    '.optrow input[type=range]{width:140px;accent-color:#B08A48}',
    '#titleSettings .optrow{flex-wrap:wrap}',
    'body.touch #modal .title-settings button{min-height:44px}',
    '.seg{display:inline-flex;border:1px solid var(--edge);border-radius:4px;overflow:hidden}',
    '.seg button{border:0;border-right:1px solid var(--edge);background:var(--panel-2);color:var(--ash);padding:3px 9px;font-size:calc(11px + var(--ui-mobile-text-add,0px));border-radius:0}',
    '.seg button:last-child{border-right:0} .seg button.on{background:#3A2E1C;color:var(--gold)}',
    '.opt-appearance{flex-wrap:wrap;align-items:center}',
    '.opt-appearance>.seg{flex:0 1 auto;flex-wrap:wrap;min-width:0;max-width:100%}',
    '.opt-appearance>.seg button{flex:0 0 auto;min-height:28px;padding:4px 9px;font-size:calc(11px + var(--ui-mobile-text-add,0px));line-height:1.2}',
    '.opt-appearance>.seg button:focus-visible{outline:2px solid var(--gold);outline-offset:2px}',
    '.opt-appearance select{max-width:100%;min-height:32px;padding:5px 28px 5px 9px;border:1px solid var(--edge);border-radius:4px;background:var(--panel-2);color:var(--ink);font:calc(12px + var(--ui-mobile-text-add,0px)) var(--mono)}',
    'body.touch .opt-appearance select{min-height:44px}',
    'body.touch .opt-appearance>.seg button{min-height:34px}',
    '.legend{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font-size:calc(11px + var(--ui-mobile-text-add,0px))} .legend b{color:var(--gold);font-weight:600} .legend span{color:var(--dim)}'
  ].join('\n');
  document.head.appendChild(st);
})();
function segHTML(id, opts, cur, label){ return '<span class="seg" data-seg="'+id+'"'+(label?' role="group" aria-labelledby="'+label+'"':'')+'>'+opts.map(function(o){ var selected=String(o[0])===String(cur);return '<button type="button" data-v="'+o[0]+'" class="'+(selected?'on':'')+'" aria-pressed="'+selected+'">'+o[1]+'</button>'; }).join('')+'</span>'; }
var UI_THEMES={ember:'Ember (Default)',forge:'Forge',vellum:'Vellum - Ivory','vellum-sand':'Vellum - Sand','vellum-ash':'Vellum - Ash',charcoal:'Charcoal',slate:'Slate',obsidian:'Obsidian',runestone:'Runestone'}, UI_TEXT_SIZES={small:'Small',normal:'Standard',large:'Large'};
var UI_PHONE_PAD_SIZES={compact:'Compact',normal:'Normal',large:'Large'};
var UI_STATUS_SIZES={compact:'Compact',normal:'Normal',large:'Large'},UI_STATUS_SIZE='normal';
try{UI_STATUS_SIZE=localStorage.getItem('fote-ui-status-size')||UI_STATUS_SIZE;}catch(e){}
var UI_HOTBAR_LAYOUTS={vertical:'Vertical',horizontal:'Horizontal'};
var UI_PAD_SIDES={left:'Left',right:'Right'},UI_PAD_SIDE='left';
try{var savedPadSide=localStorage.getItem('fote-ui-pad-side');if(Object.prototype.hasOwnProperty.call(UI_PAD_SIDES,savedPadSide))UI_PAD_SIDE=savedPadSide;}catch(e){}
var UI_HUD_MODES={minimal:'Overlay (Default)',classic:'Classic UI'},UI_HUD_MODE='minimal';
try{UI_HUD_MODE=localStorage.getItem('fote-ui-hud-mode')||UI_HUD_MODE;}catch(e){}
// Small windows retain the landscape phone HUD, even with a saved desktop choice.
function uiHudMode(){return UI_HUD_MODE==='classic'&&innerWidth>=960&&innerHeight>=600?'classic':'minimal';}
function uiUsesTouchInput(){
  try{var override=new URLSearchParams(location.search).get('touch');if(override==='0'||override==='1')return override==='1';}catch(e){}
  return !!((typeof MOBILE!=='undefined'&&MOBILE)||(typeof navigator!=='undefined'&&navigator.maxTouchPoints>0)||(typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches));
}
// Explicit preferences win over the device default; boot never writes a choice.
var UI_HIGH_CONTRAST=uiUsesTouchInput();
try{var savedContrast=localStorage.getItem('fote-ui-high-contrast');if(savedContrast==='on'||savedContrast==='off')UI_HIGH_CONTRAST=savedContrast==='on';}catch(e){}
function setHighContrast(on){
  UI_HIGH_CONTRAST=!!on;
  try{localStorage.setItem('fote-ui-high-contrast',UI_HIGH_CONTRAST?'on':'off');}catch(e){}
  if(typeof drawTerrainNow==='function')drawTerrainNow();
  if(typeof draw==='function')draw();
}
function uiHotbarLayout(){return UI_HOTBAR_LAYOUT;}
var UI_HOTBAR_LAYOUT=uiUsesTouchInput()&&Math.min(innerWidth,innerHeight)<600?'vertical':'horizontal',UI_TOUCH_PAD=!(uiUsesTouchInput()&&Math.min(innerWidth,innerHeight)<600);
try{UI_HOTBAR_LAYOUT=localStorage.getItem('fote-ui-hotbar-layout')||UI_HOTBAR_LAYOUT;var savedTouchPad=localStorage.getItem('fote-ui-touch-pad');if(savedTouchPad==='on'||savedTouchPad==='off')UI_TOUCH_PAD=savedTouchPad==='on';}catch(e){}
var UI_OPACITY_DEFAULT=uiUsesTouchInput()&&Math.min(innerWidth,innerHeight)<600?0:100;
var UI_THEME='ember',UI_TEXT_SIZE='normal',UI_OPACITY=UI_OPACITY_DEFAULT,UI_SIDE='left',UI_DESKTOP_PAD=false,UI_PHONE_PAD_SIZE='normal';
try{UI_SIDE=localStorage.getItem('fote-ui-side')||localStorage.getItem('fote-study-pad-side')||UI_SIDE;UI_DESKTOP_PAD=(localStorage.getItem('fote-ui-desktop-pad')||localStorage.getItem('fote-study-desktop-pad'))==='shown';}catch(e){}
if(UI_SIDE!=='left'&&UI_SIDE!=='right')UI_SIDE='left';
if(savedPadSide==='auto')UI_PAD_SIDE=UI_SIDE==='right'?'left':'right';
try{UI_THEME=localStorage.getItem('fote-ui-theme')||UI_THEME;UI_TEXT_SIZE=localStorage.getItem('fote-ui-text')||UI_TEXT_SIZE;UI_OPACITY=Number(localStorage.getItem('fote-ui-opacity')||UI_OPACITY_DEFAULT);UI_PHONE_PAD_SIZE=localStorage.getItem('fote-ui-touch-pad-size')||(localStorage.getItem('fote-ui-phone-pad-size')==='compact'?'compact':'normal');}catch(e){}
function applyUIAppearance(){

  if(!Object.prototype.hasOwnProperty.call(UI_THEMES,UI_THEME))UI_THEME='ember';
  if(!Object.prototype.hasOwnProperty.call(UI_TEXT_SIZES,UI_TEXT_SIZE))UI_TEXT_SIZE='normal';
  if(!Object.prototype.hasOwnProperty.call(UI_STATUS_SIZES,UI_STATUS_SIZE))UI_STATUS_SIZE='normal';
  if(!Object.prototype.hasOwnProperty.call(UI_HUD_MODES,UI_HUD_MODE))UI_HUD_MODE='minimal';
  if(!Object.prototype.hasOwnProperty.call(UI_PHONE_PAD_SIZES,UI_PHONE_PAD_SIZE))UI_PHONE_PAD_SIZE='normal';
  if(!Object.prototype.hasOwnProperty.call(UI_HOTBAR_LAYOUTS,UI_HOTBAR_LAYOUT))UI_HOTBAR_LAYOUT='horizontal';
  if(!Object.prototype.hasOwnProperty.call(UI_PAD_SIDES,UI_PAD_SIDE))UI_PAD_SIDE='left';
  document.body.dataset.uiTheme=UI_THEME;document.body.dataset.uiText=UI_TEXT_SIZE;
  document.body.dataset.uiHudMode=uiHudMode();
  document.body.dataset.uiPhonePad=UI_PHONE_PAD_SIZE;
  document.body.dataset.uiTouchPad=UI_TOUCH_PAD?'on':'off';
  document.body.dataset.uiPadSide=UI_PAD_SIDE;
  document.body.dataset.uiStatusSize=UI_STATUS_SIZE;
  document.body.style.setProperty('--ui-status-scale',UI_STATUS_SIZE==='large'?'1.6':UI_STATUS_SIZE==='compact'?'1':'1.3');
  document.body.style.setProperty('--ui-text-scale',UI_TEXT_SIZE==='large'?'1.12':UI_TEXT_SIZE==='small'?'.9':'1');
  UI_OPACITY=Number.isFinite(UI_OPACITY)?Math.max(0,Math.min(100,UI_OPACITY)):UI_OPACITY_DEFAULT;
  document.body.classList.toggle('ui-paper-faded',false);
  document.body.style.setProperty('--ui-background-opacity','1');
  document.body.style.setProperty('--ui-background-percent','100%');
  applyUIPaintCompatibility();
  var controlColor=getComputedStyle(document.body).getPropertyValue('--ui-log').trim();
  var controlHex=/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(controlColor);
  var controlRGB=controlHex?controlHex[1]:'151210';
  if(controlRGB.length===3)controlRGB=controlRGB.split('').map(function(c){return c+c;}).join('');
  document.body.style.setProperty('--ui-control-background','rgba('+parseInt(controlRGB.slice(0,2),16)+','+parseInt(controlRGB.slice(2,4),16)+','+parseInt(controlRGB.slice(4,6),16)+','+(UI_OPACITY/100)+')');
  if(typeof FoteResponsiveHUD!=='undefined')FoteResponsiveHUD.relayout();
}
/* Older Android browsers can accept a custom property's text but reject its
   color-mix value when a button or panel consumes it. Read this theme's existing
   palette and supply alpha colors; text and icons keep their normal opacity. */
function applyUIPaintCompatibility(){
  var supportsMix=typeof CSS!=='undefined'&&typeof CSS.supports==='function'&&CSS.supports('color','color-mix(in srgb, black 50%, transparent)');
  var hadFallback=document.body.classList.contains('ui-color-fallback');
  document.body.classList.toggle('ui-color-fallback',!supportsMix);
  if(supportsMix){
    if(hadFallback)['--ui-surface','--ui-header-face','--ui-button-face','--ui-panel-tint','--ui-panel-2-tint','--ui-log-tint'].forEach(function(name){document.body.style.removeProperty(name);});
    return;
  }
  if(typeof getComputedStyle!=='function')return;
  var style=getComputedStyle(document.body),alpha=1;
  function color(name,fallback){
    var value=style.getPropertyValue(name).trim(),match=/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(value);
    var hex=match?match[1]:fallback;
    if(hex.length===3)hex=hex.split('').map(function(c){return c+c;}).join('');
    return 'rgba('+parseInt(hex.slice(0,2),16)+','+parseInt(hex.slice(2,4),16)+','+parseInt(hex.slice(4,6),16)+','+alpha+')';
  }
  var panel=color('--ui-panel','1b1715'),raised=color('--ui-raised','2d251f'),second=color('--ui-panel-2','221d1a'),log=color('--ui-log','151210');
  document.body.style.setProperty('--ui-surface',panel);
  document.body.style.setProperty('--ui-header-face','linear-gradient('+second+','+panel+')');
  document.body.style.setProperty('--ui-button-face','linear-gradient('+raised+','+second+')');
  document.body.style.setProperty('--ui-panel-tint',panel);
  document.body.style.setProperty('--ui-panel-2-tint',second);
  document.body.style.setProperty('--ui-log-tint',log);
}
applyUIAppearance();
// Re-read the loaded palette before the first real UI appears.
if(typeof FoteLifecycle!=='undefined')FoteLifecycle.whenReady(applyUIAppearance);
function resetUITheme(){
  UI_THEME='ember';UI_OPACITY=UI_OPACITY_DEFAULT;
  try{localStorage.setItem('fote-ui-theme',UI_THEME);localStorage.setItem('fote-ui-opacity',String(UI_OPACITY));}catch(e){}
  applyUIAppearance();
}
function appearanceSegments(id,label,choices,value){
  return '<div class="optrow opt-appearance"><span id="'+id+'Label">'+label+'</span>'+segHTML(id,Object.keys(choices).map(function(k){return[k,choices[k]];}),value,id+'Label')+'</div>';
}
function appearanceDropdown(id,label,choices,value){
  return '<label class="optrow opt-appearance"><span>'+label+'</span><select id="'+id+'">'+Object.keys(choices).map(function(k){return '<option value="'+k+'"'+(k===value?' selected':'')+'>'+choices[k]+'</option>';}).join('')+'</select></label>';
}
function setTouchPadVisible(on){
  UI_TOUCH_PAD=!!on;
  if(typeof stopDirectionPad==='function')stopDirectionPad();
  try{localStorage.setItem('fote-ui-touch-pad',UI_TOUCH_PAD?'on':'off');}catch(e){}
  applyUIAppearance();
}
var UI_APPEARANCE_CHOICES={uiHudMode:UI_HUD_MODES,uiSide:{left:'Left',right:'Right'},uiPadSide:UI_PAD_SIDES,uiHotbarLayout:UI_HOTBAR_LAYOUTS,uiPhonePadSize:UI_PHONE_PAD_SIZES,uiStatusSize:UI_STATUS_SIZES,uiTheme:UI_THEMES,uiTextSize:UI_TEXT_SIZES};
function setAppearanceSetting(id,value){
  if(!Object.prototype.hasOwnProperty.call(UI_APPEARANCE_CHOICES,id)||!Object.prototype.hasOwnProperty.call(UI_APPEARANCE_CHOICES[id],value))return false;
  var key;
  if(id==='uiHudMode'){UI_HUD_MODE=value;key='fote-ui-hud-mode';}
  if(id==='uiSide'){UI_SIDE=value;key='fote-ui-side';}
  if(id==='uiPadSide'){UI_PAD_SIDE=value;key='fote-ui-pad-side';}
  if(id==='uiHotbarLayout'){UI_HOTBAR_LAYOUT=value;key='fote-ui-hotbar-layout';}
  if(id==='uiPhonePadSize'){UI_PHONE_PAD_SIZE=value;key='fote-ui-touch-pad-size';}
  if(id==='uiStatusSize'){UI_STATUS_SIZE=value;key='fote-ui-status-size';}
  if(id==='uiTheme'){UI_THEME=value;key='fote-ui-theme';}
  if(id==='uiTextSize'){UI_TEXT_SIZE=value;key='fote-ui-text';}
  try{localStorage.setItem(key,value);}catch(e){}
  applyUIAppearance();return true;
}
function settingsHTML(){
  var touch=uiUsesTouchInput(),phone=touch&&Math.min(innerWidth,innerHeight)<600;
  function row(id,label,choices,value,hint){return '<div class="optrow"><span id="'+id+'Label">'+label+'</span>'+segHTML(id,choices,value,id+'Label')+'</div>'+(hint?'<div class="c-info">'+hint+'</div>':'');}
  var bindings='<details id="uiKeyBindings" class="opt-section-details"'+(touch?'':' open')+'><summary>Keyboard controls</summary><div class="c-info">Select a binding, then press a key. Esc cancels.</div><div class="binds">';
  BIND_ACTIONS.forEach(function(b){var k=bindKey(b[0]);bindings+='<span>'+b[1]+'</span><button data-bind="'+b[0]+'" class="'+(REBINDING===b[0]?'wait':BINDS[b[0]]?'custom':'')+'">'+(REBINDING===b[0]?'press a key':keyLabel(k))+'</button>';});
  bindings+='</div><div class="optrow"><button id="bindReset">Reset keyboard controls</button></div><div class="c-info">Arrow keys always move. Esc closes windows.</div></details>';
  var h='<div class="opt-how-to"><button type="button" id="howToPlay">How to play</button><span class="c-info">Movement, turns, items and character growth.</span></div><div class="optgrid">';
  h+='<section class="opt-section"><div class="sec">Interface</div>'+row(touch?'touchPad':'desktopPad','Movement pad',[['on','On'],['off','Off']],(touch?UI_TOUCH_PAD:UI_DESKTOP_PAD)?'on':'off',phone?'With the pad off, Search stays available beside the hotbar.':'');
  if(innerWidth>=960&&innerHeight>=600)h+=appearanceSegments('uiHudMode','Interface layout',UI_HUD_MODES,UI_HUD_MODE);
  h+=appearanceDropdown('uiTheme','Theme',UI_THEMES,UI_THEME)+appearanceSegments('uiTextSize','Text size',UI_TEXT_SIZES,UI_TEXT_SIZE)+appearanceSegments('uiStatusSize','Status size',UI_STATUS_SIZES,UI_STATUS_SIZE)+appearanceSegments('uiSide','Status position',{left:'Left',right:'Right'},UI_SIDE)+
    '<label class="optrow ui-opacity-row"><span>Button transparency <output id="uiOpacityValue" for="uiOpacity">'+(100-UI_OPACITY)+'%</output></span><input type="range" id="uiOpacity" min="0" max="100" step="5" value="'+(100-UI_OPACITY)+'" aria-label="Button transparency" aria-describedby="uiOpacityHint"></label><div id="uiOpacityHint" class="c-info">Fades hotbar and map action button backgrounds; panels, text and icons stay solid.</div><div class="optrow"><button type="button" id="resetUITheme">Reset theme and transparency</button></div></section>';
  h+='<section class="opt-section"><div class="sec">Map</div>'+row('mapzoom','Map zoom',[['far','Far'],['normal','Normal'],['close','Close'],['closest','Closest']],MAP_ZOOM)+
    row('highContrast','High contrast',[['on','On'],['off','Off']],UI_HIGH_CONTRAST?'on':'off','Brightens characters and ground items. On by default on mobile.')+
    row('light','Lighting',[['on','On'],['off','Off']],(typeof lightingOn==='function'?lightingOn():true)?'on':'off')+
    row('mapart','Map art',[['sprite','Sprites'],['block','Blocks']],spriteOn?'sprite':'block')+
    row('motion','Ambient motion',[['auto','Auto'],['on','On'],['off','Off']],ANIM.mode,'Sway, flicker and bobbing. Auto follows your device motion preference.')+
    row('speed','Animation speed',[[1,'1&times;'],[1.5,'1.5&times;'],[2,'2&times;'],[3,'3&times;']],ANIM_SPEED)+'</section>';
  h+='<section class="opt-section"><div class="sec">Controls</div>'+appearanceSegments('uiHotbarLayout',phone?'Landscape hotbar':'Hotbar layout',UI_HOTBAR_LAYOUTS,UI_HOTBAR_LAYOUT)+(phone?'<div class="c-info">Portrait uses two rows. Landscape uses your chosen layout.</div>':'')+

    appearanceSegments('uiPadSide','Pad position',UI_PAD_SIDES,UI_PAD_SIDE)+appearanceSegments('uiPhonePadSize','Pad size',UI_PHONE_PAD_SIZES,UI_PHONE_PAD_SIZE)+'</section>';
  h+='<section class="opt-section"><div class="sec">Audio</div>'+row('mute','Sound',[[0,'On'],[1,'Off']],AUDIO.muted?1:0)+row('music','Music',[[1,'On'],[0,'Off']],AUDIO.musicOn?1:0)+
    '<label class="optrow"><span>Effects volume</span><input type="range" id="volSfx" min="0" max="100" value="'+Math.round((AUDIO.vol.sfx||0)*100)+'"></label><label class="optrow"><span>Music volume</span><input type="range" id="volMusic" min="0" max="100" value="'+Math.round((AUDIO.vol.music||0)*100)+'"></label></section>'+bindings;
  h+='<details id="uiMapGuide" class="opt-section-details"><summary>Reading the map</summary><div class="legend"><b>Dim tiles</b><span>remembered, not in sight</span><b>z over a head</b><span>asleep: surprise it</span><b>Key over a head</b><span>it carries a key</span><b>Bones at a door</b><span>a monster zoo behind it</span><b>Uneven stones</b><span>a hidden door nearby ('+(touch?'use Search':'search with '+keyLabel(bindKey('search')))+')</span><b>Tall grass</b><span>blocks sight, burns</span></div></details></div>';
  return h;
}
function optionsHTML(){return settingsHTML();}
function refreshOptions(settingsRoot){
  var title=$('titleSettings'),isTitle=title&&typeof modalOpen!=='undefined'&&modalOpen;
  var root=settingsRoot||(isTitle?title:$('mHelp'));
  var disclosureState=root?Array.from(root.querySelectorAll('.opt-section-details[id]')).map(function(e){return {id:e.id,open:e.open};}):[];
  var active=document.activeElement,selector='',scroller=root&&(root.closest('.bodyw')||root.parentElement),scroll=scroller?scroller.scrollTop:0;
  if(root){
    if(root.contains(active)){
      if(active.id)selector='#'+active.id;
      else if(active.hasAttribute('data-bind'))selector='[data-bind="'+active.getAttribute('data-bind')+'"]';
      else if(active.hasAttribute('data-v')&&active.closest('[data-seg]'))selector='[data-seg="'+active.closest('[data-seg]').getAttribute('data-seg')+'"] [data-v="'+active.getAttribute('data-v')+'"]';
    }
  }
  if(isTitle&&root===title){
    root.innerHTML=settingsHTML();wireSettings(root);
  }else if(typeof refreshSheet==='function')refreshSheet();
  if(root&&root.id)root=$(root.id)||root;
  if(root)scroller=root.closest('.bodyw')||root.parentElement;
  disclosureState.forEach(function(e){var detail=root&&root.querySelector('#'+e.id);if(detail)detail.open=e.open;});
  var focus=root&&selector&&root.querySelector(selector);if(focus)focus.focus({preventScroll:true});
  if(scroller)scroller.scrollTop=scroll;
}
function wireSettings(root){
  var guide=root.querySelector('#howToPlay');
  if(guide)guide.onclick=function(){
    if(typeof FoteGettingStarted!=='undefined')FoteGettingStarted.show(root.id==='titleSettings'&&typeof openTitleSettings==='function'?openTitleSettings:null);
  };
  var resetTheme=root.querySelector('#resetUITheme');
  if(resetTheme)resetTheme.onclick=function(){resetUITheme();sfx('ui-click');refreshOptions(root);};
  var theme=root.querySelector('#uiTheme');
  if(theme)theme.onchange=function(){if(setAppearanceSetting('uiTheme',theme.value)){sfx('ui-click');refreshOptions(root);}};
  var opacity=root.querySelector('#uiOpacity');
  if(opacity)opacity.oninput=function(){UI_OPACITY=100-Number(opacity.value);applyUIAppearance();root.querySelector('#uiOpacityValue').textContent=(100-UI_OPACITY)+'%';try{localStorage.setItem('fote-ui-opacity',String(UI_OPACITY));}catch(e){}};
  root.querySelectorAll('[data-bind]').forEach(function(b){ b.onclick=function(ev){ ev.stopPropagation(); REBINDING=b.getAttribute('data-bind'); refreshOptions(); }; });
  var rb=root.querySelector('#bindReset'); if(rb) rb.onclick=function(){ BINDS={}; REBINDING=null; saveBinds(); refreshOptions(); };
  root.querySelectorAll('[data-seg]').forEach(function(seg){
    var id=seg.getAttribute('data-seg');
    seg.querySelectorAll('button').forEach(function(b){ b.onclick=function(){
      var v=b.getAttribute('data-v');
      if(Object.prototype.hasOwnProperty.call(UI_APPEARANCE_CHOICES,id)){
        if(setAppearanceSetting(id,v)){sfx('ui-click');refreshOptions(root);}return;
      }
      if(id==='mute'){ audioInit(); if((v==='1')!==AUDIO.muted) toggleMute(); if(typeof syncAudioButtons==='function') syncAudioButtons(); }
      if(id==='music'){ audioInit(); if((v==='1')!==AUDIO.musicOn) toggleMusic(); if(typeof syncAudioButtons==='function') syncAudioButtons(); }
      if(id==='light'){ try{ localStorage.setItem('astra-temple-light', v); }catch(e){} var bl=$('bLight'); if(bl) bl.textContent='Lighting: '+v; draw(); }
      if(id==='motion'){ if(typeof setMotion==='function') setMotion(v); }
      if(id==='mapart')setMapArt(v);
      if(id==='desktopPad'){UI_DESKTOP_PAD=v==='on'||v==='shown';try{localStorage.setItem('fote-ui-desktop-pad',UI_DESKTOP_PAD?'shown':'hidden');}catch(e){}if(typeof FoteResponsiveHUD!=='undefined')FoteResponsiveHUD.relayout();}
      if(id==='touchPad')setTouchPadVisible(v==='on');

      if(id==='highContrast')setHighContrast(v==='on');
      if(id==='mapzoom'){ MAP_ZOOM=v; try{ localStorage.setItem('astra-temple-map-zoom', v); }catch(e){} resize(); }
      if(id==='speed'){ ANIM_SPEED=parseFloat(v)||1; try{ localStorage.setItem('astra-temple-anim-speed', String(ANIM_SPEED)); }catch(e){} applyAnimSpeed(); }
      sfx('ui-click'); refreshOptions(root);
    }; });
  });
  var vs=root.querySelector('#volSfx'); if(vs) vs.oninput=function(){ AUDIO.vol.sfx=vs.value/100; if(AUDIO.sfxBus) AUDIO.sfxBus.gain.value=AUDIO.vol.sfx; audioSave(); };
  var vm=root.querySelector('#volMusic'); if(vm) vm.oninput=function(){ AUDIO.vol.music=vm.value/100; if(AUDIO.musicBus && AUDIO.musicOn) AUDIO.musicBus.gain.value=AUDIO.vol.music; audioSave(); };
}
function wireOptions(root){wireSettings(root);}
