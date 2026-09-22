/* =====================================================================
   keybind.js - custom key bindings (2026-09-17). Loads before game.js so its keydown listener runs first:
   a custom key is translated into the action's default key (a synthetic keydown the game's handlers
   understand), and a default key whose action was moved elsewhere is swallowed. The Options sheet
   (options.js) edits BINDS.
   ===================================================================== */
var BIND_ACTIONS = [
  ['up','Move up','w'],['down','Move down','s'],['left','Move left','a'],['right','Move right','d'],
  ['ul','Move up-left','q'],['ur','Move up-right','e'],['dl','Move down-left','z'],['dr','Move down-right','c'],
  ['wait','Wait a turn','.'],['rest','Rest','r'],['search','Search','f'],['grab','Pick up','g'],
  ['stairs','Take the stairs','>'],['upstairs','Climb the stairs','<'],['close','Close a door','C'],
  ['h1','Hotbar 1','1'],['h2','Hotbar 2','2'],['h3','Hotbar 3','3'],['h4','Hotbar 4','4'],['h5','Hotbar 5','5'],['h6','Hotbar 6','6'],['h7','Hotbar 7','7'],['h8','Hotbar 8','8'],
  ['char','Character','Tab'],['gear','Equipment','i'],['faith','Faith','p'],['map','Map overlay','v'],['mute','Sound on/off','m'],['music','Music on/off','n']
];
var BINDS = {};
try { BINDS = JSON.parse(localStorage.getItem('astra-temple-binds')||'{}') || {}; } catch(e){ BINDS={}; }
function bindKey(id){ var a=BIND_ACTIONS.filter(function(b){ return b[0]===id; })[0]; return BINDS[id] || (a && a[2]); }
function saveBinds(){ try{ localStorage.setItem('astra-temple-binds', JSON.stringify(BINDS)); }catch(e){} }
function keyLabel(k){ return k===' ' ? 'Space' : k==='Tab' ? 'Tab' : k.length===1 ? (k===k.toUpperCase() && k!==k.toLowerCase() ? 'Shift+'+k : k.toUpperCase()) : k; }

var REBINDING=null;
window.addEventListener('keydown', function(ev){
  if(ev.__fote) return;                                   /* our own translated event */
  var tgt=ev.target && ev.target.tagName; if(tgt==='INPUT' || tgt==='SELECT' || tgt==='TEXTAREA') return;
  if(REBINDING){
    ev.preventDefault(); ev.stopImmediatePropagation();
    if(ev.key==='Escape'){ REBINDING=null; if(typeof refreshSheet==='function') refreshSheet(); return; }
    if(['Shift','Control','Alt','Meta'].indexOf(ev.key)>=0) return;
    var id=REBINDING; REBINDING=null;
    /* a key can only do one thing: whoever had it gets their default back */
    BIND_ACTIONS.forEach(function(b){ if(b[0]!==id && bindKey(b[0])===ev.key) delete BINDS[b[0]]; });
    BINDS[id]=ev.key; if(BINDS[id]===BIND_ACTIONS.filter(function(b){ return b[0]===id; })[0][2]) delete BINDS[id];
    saveBinds(); if(typeof refreshSheet==='function') refreshSheet(); return;
  }
  if(ev.key.indexOf('Arrow')===0) return;
  var custom=null, displaced=false;
  BIND_ACTIONS.forEach(function(b){
    var k=bindKey(b[0]);
    if(k===ev.key && k!==b[2]) custom=b[2];
    if(ev.key===b[2] && k!==b[2]) displaced=true;
  });
  if(custom){
    ev.preventDefault(); ev.stopImmediatePropagation();
    var e2=new KeyboardEvent('keydown', {key:custom, shiftKey:custom==='C' || custom==='>', bubbles:true, cancelable:true});
    e2.__fote=true; (document.activeElement||document.body).dispatchEvent(e2); return;
  }
  if(displaced){ ev.preventDefault(); ev.stopImmediatePropagation(); }
}, true);

