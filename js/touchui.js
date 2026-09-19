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

    /* ---- sheets fill the screen under the tab row, over the hotbar and d-pad (they were squeezed into the
       map's box, the top 60% of a tablet) */
    'body.touch #shade{position:fixed!important;left:0!important;right:0!important;top:var(--toph,52px)!important;bottom:0!important;',
    '  z-index:60!important;padding:6px 6px calc(6px + env(safe-area-inset-bottom,0px))!important;align-items:stretch!important}',
    'body.touch .sheet{width:100%!important;max-width:none!important;max-height:none!important;height:100%}',

    /* ---- Gear: worn slots and bag squares are the same tile, five across */
    'body.touch .tgear .tg-top{grid-template-columns:minmax(0,1fr)!important;gap:14px!important}',
    'body.touch .tgear .tg-slots,body.touch .tgear .tg-cells{grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:8px!important}',
    'body.touch .tgear .gslot{width:100%!important;height:auto!important;aspect-ratio:1/1;min-height:0!important;padding:4px!important;justify-content:center!important;gap:0!important}',
    'body.touch .tgear .gslot .nm{display:none}',
    'body.touch .tgear .gslot .ic{width:64%!important;height:64%!important}',
    'body.touch .tgear .gslot .ph{font-size:clamp(20px,5vw,30px)!important;line-height:1!important}',
    'body.touch .tgear .gslot .lab{font-size:clamp(8.5px,1.7vw,11px)!important;margin-top:2px}',
    'body.touch .tgear .cell{min-height:0!important}',
    'body.touch .tgear .cell .gear{width:74%;height:74%;display:flex;align-items:center;justify-content:center}',
    'body.touch .tgear .gslot .ic canvas,body.touch .tgear .cell canvas{width:100%!important;height:100%!important;display:block}',
    'body.touch .tgear .cell b{font-size:13px!important}',
    'body.touch .tgear .tg-hint{font-size:13px!important}',
    'body.touch .tgear .tg-sec{font-size:11px!important}',
    'body.touch #bAmHot{margin-top:10px;min-height:44px;padding:0 14px;font-size:14px}',

    /* ---- the hotbar's long-press menu */
    '#hmenu{position:fixed;left:8px;right:8px;z-index:70;background:rgba(18,15,13,.97);border:1px solid var(--edge);border-radius:12px;',
    '  padding:12px;box-shadow:0 8px 30px rgba(0,0,0,.6);display:flex;flex-direction:column;gap:10px;max-width:520px;margin:0 auto}',
    '#hmenu .hm-card .nm{font-size:18px;color:var(--gold);margin-bottom:4px}',
    '#hmenu .hm-card .row,#hmenu .hm-card .hint,#hmenu .hm-card{font-size:14px;line-height:1.4}',
    '#hmenu .hm-card .row{display:flex;justify-content:space-between;gap:12px}',
    '#hmenu .hm-card .row b{color:var(--ink)}',
    '#hmenu .hm-btns{display:flex;flex-wrap:wrap;gap:8px}',
    '#hmenu .hm-btns button{flex:1 1 auto;min-height:48px;font-size:15px;padding:0 14px}',
    '#hmenu .hm-btns button.on{border-color:var(--gold);color:var(--gold)}',

    /* ---- long-press cards: across the screen, on the half away from the finger (see showCard below) */
    'body.touch #dtip{left:8px!important;right:8px!important;max-width:none!important;width:auto!important;font-size:14px;padding:10px 12px!important}',
    'body.touch #dtip .nm{font-size:18px!important}',

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


  /* ---------------- hover cards. A tap on a touch screen fires a (trusted) compatibility mousemove, which opened
     the hover card - and nothing ever sent the mouseleave, so it stayed over the controls. On touch only the
     long press (mobile.js, an untrusted synthetic mousemove) opens a card, and it goes on the half of the
     screen away from the finger. */
  var _showCardTouch = showCard;
  showCard = function(html, ev){
    if(!touch()) return _showCardTouch(html, ev);
    if(ev && ev.isTrusted) return;
    _showCardTouch(html, ev);
    var t=document.getElementById('dtip'); if(!t) return;
    var top=(parseFloat(document.body.style.getPropertyValue('--toph'))||52)+8;
    if(ev && ev.clientY < innerHeight/2){ t.style.top='auto'; t.style.bottom='calc(8px + env(safe-area-inset-bottom,0px))'; }
    else { t.style.bottom='auto'; t.style.top=top+'px'; }
  };
  function hookMapHover(){
    var cv=document.getElementById('cv'); if(!cv || cv._touchHover) return !!cv;
    cv._touchHover=true;
    cv.addEventListener('mousemove', function(ev){ if(touch() && ev.isTrusted) ev.stopImmediatePropagation(); }, true);
    return true;
  }
  hookMapHover();

  /* the top bar's height, for the full-screen sheets and the cards */
  function topH(){ var t=document.getElementById('top'); if(t) document.body.style.setProperty('--toph', t.getBoundingClientRect().bottom+'px'); }
  window.addEventListener('resize', function(){ setTimeout(topH, 50); });
  setTimeout(topH, 300);

  /* gear icons: drawn at 72 on touch and scaled into the square tiles by CSS */
  if(typeof iconCanvas==='function'){
    var _iconCanvasTouch = iconCanvas;
    iconCanvas = function(name, size, fb){
      if(touch() && typeof openSheet!=='undefined' && openSheet==='Equip' && (size||0)<72) size=72;
      return _iconCanvasTouch(name, size, fb);
    };
  }

  /* ---------------- Gear: "Add amulet to hotbar" when the worn amulet has no slot (it was removed) */
  function amuletOnBar(){ return player && player.hotbar && player.hotbar.some(function(h){ return h && h.type==='amulet'; }); }
  if(typeof window.equipHTML==='function'){
    var _equipHTMLTouch = window.equipHTML;
    window.equipHTML = function(){
      var h=_equipHTMLTouch.apply(this, arguments);
      if(!touch() || !player || !player.amulet || amuletOnBar()) return h;
      var mark='</div></div><div><p class="tg-sec">Bag';
      return h.indexOf(mark)>=0 ? h.replace(mark, '</div><button id="bAmHot">Add amulet to hotbar</button></div><div><p class="tg-sec">Bag') : h;
    };
  }
  document.addEventListener('click', function(ev){
    if(!ev.target || ev.target.id!=='bAmHot') return;
    var i=player.hotbar.indexOf(null);
    if(i<0){ log('The hotbar is full. Hold a potion or item slot to remove it first.','c-info'); return; }
    player.hotbar[i]={type:'amulet'}; sfx('ui-click'); abilityBar(); if(typeof refreshSheet==='function') refreshSheet();
  });

  /* ---------------- hotbar long press: a menu with the slot's card and what you can do with it.
     travel.js's own long press toggled the click spell with no way to see or undo it; on touch it is routed
     through this menu instead (its toggle only runs when the menu asks). */
  var menuCall=false;
  if(typeof toggleClickSpell==='function'){
    var _toggleClickTouch = toggleClickSpell;
    toggleClickSpell = function(key){ if(touch() && !menuCall) return; return _toggleClickTouch(key); };
  }
  var hm=null, hmTimer=null, hmX=0, hmY=0, hmSwallow=false;
  function closeHM(){ if(hm){ hm.remove(); hm=null; } }
  function openHM(i){
    closeHM(); var s=player && player.hotbar && player.hotbar[i]; if(!s) return;
    var btns=[];
    if(s.type==='ability' && typeof clickSpellable==='function' && clickSpellable(s.key))
      btns.push(player.clickSpell===s.key ? ['tap','Stop casting this on tap','on'] : ['tap','Cast this when I tap an enemy','']);
    if(s.type==='item' || s.type==='amulet') btns.push(['rm','Remove from hotbar','']);
    btns.push(['x','Close','']);
    hm=document.createElement('div'); hm.id='hmenu';
    var card=(typeof hotbarCard==='function' ? hotbarCard(i) : '').replace(/<div class="hint">[^<]*(Right-click|Key \d|Drag )[^<]*<\/div>/g,'');
    hm.innerHTML='<div class="hm-card">'+card+'</div><div class="hm-btns">'+
      btns.map(function(b){ return '<button data-a="'+b[0]+'" class="'+b[2]+'">'+b[1]+'</button>'; }).join('')+'</div>';
    document.body.appendChild(hm);
    var hb=document.getElementById('hotbar'), r=hb ? hb.getBoundingClientRect() : null;
    if(r && r.top > innerHeight*0.4) hm.style.bottom=(innerHeight-r.top+8)+'px'; else hm.style.top=((r?r.bottom:60)+8)+'px';
    hm.addEventListener('click', function(ev){
      var b=ev.target.closest('button'); if(!b) return;
      var a=b.getAttribute('data-a');
      if(a==='tap'){ menuCall=true; try{ toggleClickSpell(s.key); } finally { menuCall=false; } }
      if(a==='rm'){ player.hotbar[i]=null; abilityBar(); sfx('ui-click'); }
      closeHM();
    });
    if(navigator.vibrate) try{ navigator.vibrate(12); }catch(e){}
  }
  window.openHotbarMenu = openHM;
  document.addEventListener('pointerdown', function(ev){
    if(hm && !hm.contains(ev.target)){ closeHM(); hmSwallow=true; setTimeout(function(){ hmSwallow=false; }, 450); return; }
    if(!touch()) return;
    var slot=ev.target.closest && ev.target.closest('#hotbar .slot[data-i]'); if(!slot) return;
    hmX=ev.clientX; hmY=ev.clientY;
    clearTimeout(hmTimer);
    hmTimer=setTimeout(function(){ hmTimer=null; hmSwallow=true; openHM(+slot.getAttribute('data-i')); }, 450);
  }, true);
  document.addEventListener('pointermove', function(ev){ if(hmTimer && (Math.abs(ev.clientX-hmX)>12 || Math.abs(ev.clientY-hmY)>12)){ clearTimeout(hmTimer); hmTimer=null; } }, true);
  ['pointerup','pointercancel'].forEach(function(n){ document.addEventListener(n, function(){
    if(hmTimer){ clearTimeout(hmTimer); hmTimer=null; }
    if(hmSwallow) setTimeout(function(){ hmSwallow=false; }, 350);    /* some browsers send no click after a long hold */
  }, true); });
  /* the tap that ends a long press (or closes the menu) must not also fire the slot or step on the map */
  document.addEventListener('click', function(ev){
    var slot=ev.target.closest && ev.target.closest('#hotbar .slot'); if(slot) slot._longPress=false;   /* travel.js's flag */
    if(hmSwallow && !(hm && hm.contains(ev.target))){ hmSwallow=false; ev.stopImmediatePropagation(); ev.preventDefault(); }
  }, true);
  document.addEventListener('contextmenu', function(ev){ if(touch() && ev.target.closest && ev.target.closest('#hotbar')) ev.preventDefault(); });

  var n=0, t=setInterval(function(){ var a=hookDpad(), m=moveMap(), c=hookMapHover(); if((a && m && c) || ++n>60) clearInterval(t); }, 100);
})();
