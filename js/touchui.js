/* touchui.js - the tablet layout (2026-09-18, round 1 of the touch rebuild). Loaded after mobile.js, so its
   stylesheet lands last and wins.
   - Stairs / Grab / Search / Close / Swap buttons are gone on touch: stairs and pickups happen by walking onto
     them, and the d-pad's centre button now waits AND searches (quietly - it only speaks when it finds something).
   - Portrait bottom: bars, chips and the hotbar run full width; under them the log sits on the left and a
     bigger d-pad on the right.
   - Hotbar: one row of eight square slots, the icon filling the slot (repainted at a larger size so it stays sharp).
   - Top bar: Sound/Music live in Opts, so their buttons go; Map joins the tab row; the tabs share the width
     evenly so none can be pushed off a narrow screen. */
(function(){
  function touch(){ return document.body && document.body.classList.contains('touch'); }

  var st=document.createElement('style');
  st.textContent=[
    /* ---- action buttons: gone */
    'body.touch #extra{display:none!important}',

    /* ---- d-pad: a real thumb target. --dp is one button */
    'body.touch{--dp:clamp(46px,9vw,62px)}',
    'body.touch #dpad{grid-template-columns:repeat(3,var(--dp))!important;grid-auto-rows:var(--dp)!important;gap:5px!important}',
    'body.touch #dpad button{font-size:calc(var(--dp)*.42)!important;min-height:0!important;padding:0!important;border-radius:10px}',
    'body.touch #dpad button[data-d="5"]{font-size:calc(var(--dp)*.36)!important;color:var(--gold)}',

    /* ---- portrait: hotbar row full width, then log (left) | d-pad (right) */
    '@media (orientation:portrait){',
    ' body.touch #strip{grid-template-columns:minmax(0,1fr) auto!important;grid-template-rows:auto auto;gap:8px!important}',
    ' body.touch #mid{grid-column:1/-1;grid-row:1;order:0}',
    ' body.touch #log{grid-column:1;grid-row:2;order:0;height:auto!important;min-height:0;contain:size;align-self:stretch;',
    '   font-size:clamp(14px,2.2vw,16px);line-height:1.35;padding:7px 10px}',
    ' body.touch #ctl{grid-column:2;grid-row:2;order:0;display:flex!important;justify-content:flex-end;align-items:center}',
    '}',
    /* landscape keeps its two columns; the d-pad just sits a little smaller there because height is what runs out */
    '@media (orientation:landscape){ body.touch{--dp:clamp(40px,8vh,52px)} }',

    /* ---- hotbar: square slots, icon fills the slot */
    'body.touch #hotbar{grid-template-rows:auto!important;gap:6px!important;order:-1}',   /* hotbar first, above the bars */
    'body.touch #hotbar .slot{height:auto!important;aspect-ratio:1/1;max-height:96px;padding:0!important;border-radius:9px}',
    'body.touch #hotbar .slot .ico{width:86%!important;height:86%!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important}',
    'body.touch #hotbar .slot .ico canvas{width:100%!important;height:100%!important;display:block}',
    'body.touch #hotbar .slot .k{display:none}',                         /* number keys mean nothing without a keyboard */
    'body.touch #hotbar .slot.empty .n{display:none}',
    'body.touch #hotbar .slot .cdn{font-size:clamp(12px,2.6vw,17px)!important;right:5px!important;bottom:3px!important;',
    '  background:rgba(10,9,8,.7);border-radius:6px;padding:0 4px}',

    /* ---- top bar: tabs share the row evenly; nothing overflows off the right edge */
    'body.touch #topbtns{display:none!important}',
    'body.touch #brand{flex:0 0 auto;min-width:0}',
    'body.touch #tabs{overflow:visible!important;justify-content:stretch!important;gap:4px!important;flex:1 1 auto;min-width:0}',
    'body.touch #tabs button.on{color:var(--gold)!important}',
    'body.touch #tabs button{flex:1 1 0!important;min-width:0!important;padding:0 2px!important;font-size:clamp(13.5px,3.3vw,17px)!important;color:var(--ash);',
    '  white-space:nowrap;overflow:hidden;text-overflow:clip}',
    '@media (max-width:480px){ body.touch #brand{display:none} }',  /* phone: the floor number is in the chips row */

    /* ---- one type size up across the strip (2026-09-18: it had room to spare) */
    'body.touch #mid .bar{height:26px!important}',
    'body.touch #mid .bar span{font-size:clamp(14px,2.4vw,16px)!important;padding:0 9px!important}',
    'body.touch #hud2{font-size:clamp(13px,2.1vw,15px)!important}',
    'body.touch #hud2 .chip{padding:3px 9px 3px 5px!important}',
    'body.touch #tip .nm{font-size:18px!important}',
    'body.touch #tip .row{font-size:14.5px!important}',
    'body.touch #tip .odds{font-size:15px!important}',
    'body.touch .sheet{font-size:15px}',
    /* Exit: a browser will not let a page (or an installed web app) close itself, so on a phone or tablet the
       button could only fail. Home / swipe away closes it there. */
    'body.touch #tExit,body.touch #oExit{display:none!important}',
    /* Opts: key bindings mean nothing without a keyboard, and they pushed Audio/Display (map zoom) below the fold */
    'body.touch .optgrid{grid-template-columns:1fr!important}',
    'body.touch .optgrid>div:first-child{display:none}',
    'body.touch .optrow{font-size:14px;padding:8px 0}',
    'body.touch .seg button{padding:8px 12px;font-size:13px}',
    'body.touch .sheet header h2{font-size:18px!important}'
  ].join('\n');
  document.head.appendChild(st);

  /* hotbar icons are painted at 28px by ui.js; on touch they are drawn at 72 and scaled down by CSS instead */
  var _paintArtTouch = paintArt;
  paintArt = function(el, group, name, size){
    if(touch() && el && el.closest && el.closest('#hotbar') && (size||32) < 72) size = 72;
    return _paintArtTouch(el, group, name, size);
  };

  /* the d-pad centre: wait and search in one press. Capture phase, so game.js's plain wait never runs. */
  function hookDpad(){
    var dp=document.getElementById('dpad'); if(!dp || dp._touchWait) return !!dp;
    dp._touchWait=true;
    var c=dp.querySelector('[data-d="5"]'); if(c){ c.innerHTML='&#9906;'; c.title='Wait and search'; }   /* a magnifier-ish ring */
    dp.addEventListener('click', function(ev){
      var b=ev.target.closest && ev.target.closest('button'); if(!b) return;
      /* while aiming, the d-pad cancels the aim instead of stepping (autoaim.js) */
      if(typeof aiming!=='undefined' && aiming){ ev.stopImmediatePropagation(); ev.preventDefault(); cancelAim(); return; }
      if(b.getAttribute('data-d')!=='5') return;
      ev.stopImmediatePropagation(); ev.preventDefault();
      if(typeof modalOpen!=='undefined' && modalOpen) return;
      if(!player || player.hp<=0) return;
      if(typeof searchAround==='function') searchAround(false, true); else endTurn();
    }, true);
    return true;
  }

  /* Map moves from the (hidden) top buttons into the tab row */
  function moveMap(){
    var b=document.getElementById('bMap'), tabs=document.getElementById('tabs');
    if(!b || !tabs) return false;
    if(!touch()) return false;
    if(b.parentNode!==tabs) tabs.appendChild(b);
    return true;
  }

  var n=0, t=setInterval(function(){ var a=hookDpad(), m=moveMap(); if((a && m) || ++n>60) clearInterval(t); }, 100);
})();
