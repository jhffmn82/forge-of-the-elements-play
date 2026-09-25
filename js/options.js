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
fxAt = function(dur, hold){ return _fxAtOpt(dur/ANIM_SPEED, hold===undefined ? undefined : hold/ANIM_SPEED); };
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
    '.seg{display:inline-flex;border:1px solid var(--edge);border-radius:4px;overflow:hidden}',
    '.seg button{border:0;border-right:1px solid var(--edge);background:var(--panel-2);color:var(--ash);padding:3px 9px;font-size:11px;border-radius:0}',
    '.seg button:last-child{border-right:0} .seg button.on{background:#3A2E1C;color:var(--gold)}',
    '.legend{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font-size:11px} .legend b{color:var(--gold);font-weight:600} .legend span{color:var(--dim)}'
  ].join('\n');
  document.head.appendChild(st);
})();
function segHTML(id, opts, cur){ return '<span class="seg" data-seg="'+id+'">'+opts.map(function(o){ return '<button data-v="'+o[0]+'" class="'+(String(o[0])===String(cur)?'on':'')+'">'+o[1]+'</button>'; }).join('')+'</span>'; }
function optionsHTML(){
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
     '<div class="optrow"><span>Effects volume</span><input type="range" id="volSfx" min="0" max="100" value="'+Math.round((AUDIO.vol.sfx||0)*100)+'"></div>'+
     '<div class="optrow"><span>Music volume</span><input type="range" id="volMusic" min="0" max="100" value="'+Math.round((AUDIO.vol.music||0)*100)+'"></div>'+
     '<div class="sec">Display</div>'+
     (window.MOBILE && window.FoteMobileOrientation ? '<div class="optrow"><span>Orientation</span>'+segHTML('orientation', [['portrait','Portrait'],['landscape','Landscape']], FoteMobileOrientation.getPreference())+'</div><p id="orientationStatus" role="status" style="font-size:12px;color:var(--ash);line-height:1.4">'+FoteMobileOrientation.getStatus()+'</p>' : '')+
     '<div class="optrow"><span>Map zoom</span>'+segHTML('mapzoom', [['far','Far'],['normal','Normal'],['close','Close'],['closest','Closest']], MAP_ZOOM)+'</div>'+
     '<div class="optrow"><span>Dynamic lighting</span>'+segHTML('light', [['on','On'],['off','Off']], lightOn?'on':'off')+'</div>'+
     '<div class="optrow"><span>Motion (sway, flicker, bob)</span>'+segHTML('motion', [['auto','Auto'],['on','On'],['off','Off']], ANIM.mode)+'</div>'+
     '<div class="optrow"><span>Animation speed</span>'+segHTML('speed', [[1,'1&times;'],[1.5,'1.5&times;'],[2,'2&times;'],[3,'3&times;']], ANIM_SPEED)+'</div>'+
     '<div class="sec">Reading the map</div><div class="legend">'+
     '<b>Dim tiles</b><span>remembered, not in sight</span><b>z over a head</b><span>asleep: surprise it</span><b>Key over a head</b><span>it carries a key</span>'+
     '<b>Bones at a door</b><span>a monster zoo behind it</span><b>Uneven stones</b><span>a hidden door nearby (search with F)</span><b>Tall grass</b><span>blocks sight, burns</span></div></div></div>';
  return h;
}
function wireOptions(root){
  root.querySelectorAll('[data-bind]').forEach(function(b){ b.onclick=function(ev){ ev.stopPropagation(); REBINDING=b.getAttribute('data-bind'); refreshSheet(); }; });
  var rb=$('bindReset'); if(rb) rb.onclick=function(){ BINDS={}; saveBinds(); refreshSheet(); };
  root.querySelectorAll('[data-seg]').forEach(function(seg){
    var id=seg.getAttribute('data-seg');
    seg.querySelectorAll('button').forEach(function(b){ b.onclick=function(){
      var v=b.getAttribute('data-v');
      if(id==='mute'){ audioInit(); if((v==='1')!==AUDIO.muted) toggleMute(); if(typeof syncAudioButtons==='function') syncAudioButtons(); }
      if(id==='music'){ audioInit(); if((v==='1')!==AUDIO.musicOn) toggleMusic(); if(typeof syncAudioButtons==='function') syncAudioButtons(); }
      if(id==='light'){ try{ localStorage.setItem('astra-temple-light', v); }catch(e){} var bl=$('bLight'); if(bl) bl.textContent='Lighting: '+v; draw(); }
      if(id==='motion'){ if(typeof setMotion==='function') setMotion(v); }
      if(id==='mapzoom'){ MAP_ZOOM=v; try{ localStorage.setItem('astra-temple-map-zoom', v); }catch(e){} resize(); }
      if(id==='speed'){ ANIM_SPEED=parseFloat(v)||1; try{ localStorage.setItem('astra-temple-anim-speed', String(ANIM_SPEED)); }catch(e){} applyAnimSpeed(); }
      if(id==='orientation' && window.FoteMobileOrientation) FoteMobileOrientation.setPreference(v);
      sfx('ui-click'); refreshSheet();
    }; });
  });
  var vs=$('volSfx'); if(vs) vs.oninput=function(){ AUDIO.vol.sfx=vs.value/100; if(AUDIO.sfxBus) AUDIO.sfxBus.gain.value=AUDIO.vol.sfx; audioSave(); };
  var vm=$('volMusic'); if(vm) vm.oninput=function(){ AUDIO.vol.music=vm.value/100; if(AUDIO.musicBus && AUDIO.musicOn) AUDIO.musicBus.gain.value=AUDIO.vol.music; audioSave(); };
}
