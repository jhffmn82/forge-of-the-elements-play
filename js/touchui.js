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
    /* Occupied bag cells drag directly; empty cells and gaps still scroll. */
    'body.touch .tgear .cell[data-b]{touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}',
    'body.touch .tgear .cell .gear{width:74%;height:74%;display:flex;align-items:center;justify-content:center}',
    'body.touch .tgear .gslot .ic canvas,body.touch .tgear .cell canvas{width:100%!important;height:100%!important;display:block}',
    'body.touch .tgear .cell b{font-size:13px!important}',
    'body.touch .tgear .tg-hint{font-size:13px!important}',
    'body.touch .tgear .tg-sec{font-size:11px!important}',
    'body.touch #bAmHot{margin-top:10px;min-height:44px;padding:0 14px;font-size:14px}',
    /* Tablet inventory: keep worn gear and the complete bag together instead
       of stretching five phone-sized columns into enormous square tiles. */
    '@media(min-width:600px){',
    ' body.touch .tgear .tg-top{grid-template-columns:176px minmax(0,1fr)!important;gap:18px!important}',
    ' body.touch .tgear .tg-slots{grid-template-columns:repeat(2,84px)!important}',
    ' body.touch .tgear .tg-cells{grid-template-columns:repeat(5,minmax(56px,84px))!important;justify-content:start}',
    ' body.touch .tgear .gslot{width:84px!important;height:84px!important;aspect-ratio:1}',
    ' body.touch .tgear .cell{max-width:84px}',
    '}',

    /* Wide phone landscape: controls | map + hotbar | menus, vitals and log.
       Flatten layout containers only; retain the same elements and their event handlers. */
    '@media (orientation:landscape) and (min-width:740px) and (max-height:560px){',
    ' body.touch #title .menu{top:12px;bottom:12px;overflow-y:auto;justify-content:center;gap:6px}',
    ' body.touch #title .menu button{font-size:20px;min-height:44px;padding:6px 14px;flex-shrink:0}',
    ' body.touch #app{display:grid!important;box-sizing:border-box;grid-template-columns:140px minmax(352px,1fr) 190px;grid-template-rows:92px 82px 62px minmax(0,1fr) 54px;gap:6px;padding:6px max(6px,env(safe-area-inset-right)) 6px max(6px,env(safe-area-inset-left))}',
    ' body.touch #strip,body.touch #mid,body.touch #ctl{display:contents!important}',
    ' body.touch #map{grid-column:2;grid-row:1/5;min-width:0;min-height:0;overflow:hidden}',
    ' body.touch #hotbar{grid-column:2;grid-row:5;align-self:stretch;grid-template-rows:1fr!important;gap:4px!important;order:0;margin:0;min-width:0}',
    ' body.touch #hotbar .slot{height:100%!important;min-width:0;aspect-ratio:auto;max-height:54px}',
    ' body.touch #hotbar .slot .ico{width:44px!important;height:44px!important}',
    ' body.touch #dpad{grid-column:1;grid-row:1/-1;align-self:center;justify-self:center;grid-template-columns:repeat(3,44px)!important;grid-auto-rows:44px!important;gap:3px!important}',
    ' body.touch #fx{position:static!important;grid-column:1;grid-row:1;align-self:start;display:flex!important;max-width:100%;justify-content:center;pointer-events:auto;max-height:86px;overflow:auto}',
    ' body.touch #top{grid-column:3;grid-row:1;min-height:0!important;min-width:0;padding:0!important;border:0}',
    ' body.touch #brand{display:none!important}',
    ' body.touch #tabs{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px!important;align-self:stretch}',
    ' body.touch #tabs button{min-height:44px!important;min-width:0!important;padding:0 2px!important;font-size:13px!important;letter-spacing:0}',
    ' body.touch #bars{grid-column:3;grid-row:2;grid-template-columns:1fr;gap:3px}',
    ' body.touch #bars .bar{height:25px!important}',
    ' body.touch #bars .bar span{font-size:13px!important}',
    ' body.touch #hud2{grid-column:3;grid-row:3;display:flex;flex-wrap:wrap!important;align-content:start;justify-content:flex-start;gap:3px;overflow:auto;font-size:11px}',
    ' body.touch #hud2 .chip{padding:2px 4px;font-size:11px}',
    ' body.touch #log{grid-column:3;grid-row:4/6;position:static!important;width:auto!important;height:auto!important;max-height:none!important;min-height:0;contain:size;pointer-events:auto;overflow:auto;font-size:12px;line-height:1.3;padding:6px;background:#151110;border:1px solid var(--edge)}',
    ' body.touch #shade{top:6px!important;bottom:6px!important;left:6px!important;right:6px!important}',
    ' body.touch.gearopen #shade{bottom:66px!important}',
    ' body.touch.gearopen #hotbar{z-index:65}',
    ' body.touch #dtip{max-height:calc(100dvh - 24px);overflow:auto}',
    '}',

    /* ---- the hotbar's long-press menu */
    'body.touch #hotbar .slot{touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}',
    'body.touch #hotbar .slot.lifted{transform:scale(.92);opacity:.45}',
    'body.touch #hotbar .slot.over{border-color:var(--gold)!important;box-shadow:0 0 0 2px rgba(232,180,74,.5) inset}',
    '#hotGhost{position:fixed;z-index:80;pointer-events:none;transform:scale(1.12);opacity:.95;box-shadow:0 8px 24px rgba(0,0,0,.6);margin:0}',
    '#hotGhost .ico{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:86%;height:86%}',
    '#hotGhost .ico canvas{width:100%!important;height:100%!important;display:block}',
    '#hotGhost .k,#hotGhost .n,#hotGhost .c,#hotGhost .cdn,#hotGhost .clickmark{display:none}',
    /* Gear keeps the hotbar on screen (and only the hotbar), so a bag item can be dragged onto it */
    'body.touch.gearopen #bars,body.touch.gearopen #hud2,body.touch.gearopen #log,body.touch.gearopen #ctl{display:none!important}',
    'body.touch.gearopen #shade{bottom:var(--hotb,0px)!important}',
    'body.touch .tgear .cell.lifted,body.touch .tgear .gslot.lifted{opacity:.4}',
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
    /* 2026-09-22 (Justin): the card sits bottom-left, above the hotbar, over the empty lower part of the sheet, where it can be read; it carries the item's buttons */
    'body.touch #dtip{left:8px!important;right:auto!important;top:auto!important;bottom:var(--cardb,8px)!important;width:min(440px,calc(100vw - 16px))!important;max-width:none!important;font-size:14px;padding:10px 12px!important;z-index:85!important;pointer-events:auto!important}',   /* over the docked hotbar and tabs (60) */
    'body.touch #dtip .tc-btns{display:flex;gap:8px;margin-top:10px}',
    'body.touch #dtip .tc-btns button{flex:1 1 auto;min-height:44px;font-size:15px}',
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
    if(s.type==='item' || s.type==='amulet' || s.type==='ranged') btns.push(['rm','Remove from hotbar','']);
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
  /* one gesture for the slot: hold it and it lifts. Drag it onto another slot and let go to swap them;
     let go without moving and the menu opens. The browser's own long-press drag is switched off on the
     hotbar (draggable=false, touch-action:none), because it fought this for the same press. */
  var lift=null;      /* {slot, i, x, y, moved, ghost, over} while a slot is held */
  function slotAt(x,y){ var el=document.elementFromPoint(x,y); return el && el.closest ? el.closest('#hotbar .slot[data-i]') : null; }
  function dollAt(x,y){ if(x==null) return null; var el=document.elementFromPoint(x,y); return el && el.closest ? el.closest('.gdoll, .tg-portrait, .tg-mid') : null; }
  /* 2026-09-20: Justin - on touch you could not drop a bag item onto a worn slot, only on the doll, and the doll
     equips a weapon into the main hand. So a dagger could never reach the off hand. A drop on a worn slot now goes
     to THAT slot (js/sheets.js already does this with the mouse). */
  function wornSlotAt(x,y){ if(x==null) return null; var el=document.elementFromPoint(x,y); return el && el.closest ? el.closest('.gslot[data-slot]') : null; }
  function endLift(){
    if(!lift) return;
    if(lift.ghost) lift.ghost.remove();
    lift.slot.classList.remove('lifted');
    if(lift.over) lift.over.classList.remove('over');
    lift=null;
  }
  document.addEventListener('pointerdown', function(ev){
    if(hm && !hm.contains(ev.target)){ closeHM(); hmSwallow=true; setTimeout(function(){ hmSwallow=false; }, 450); return; }
    if(!touch()) return;
    var slot=ev.target.closest && ev.target.closest('#hotbar .slot[data-i]'); if(!slot) return;
    hmX=ev.clientX; hmY=ev.clientY;
    clearTimeout(hmTimer); endLift();
    hmTimer=setTimeout(function(){
      hmTimer=null; hmSwallow=true;
      lift={slot:slot, i:+slot.getAttribute('data-i'), x:hmX, y:hmY, moved:false, ghost:null, over:null};
      slot.classList.add('lifted');
      if(navigator.vibrate) try{ navigator.vibrate(12); }catch(e){}
    }, 420);
  }, true);
  document.addEventListener('pointermove', function(ev){
    if(hmTimer && (Math.abs(ev.clientX-hmX)>12 || Math.abs(ev.clientY-hmY)>12)){ clearTimeout(hmTimer); hmTimer=null; }
    if(!lift) return;
    if(!lift.moved && Math.abs(ev.clientX-lift.x)<10 && Math.abs(ev.clientY-lift.y)<10) return;
    ev.preventDefault();
    if(!lift.moved){
      lift.moved=true;
      var g=lift.slot.cloneNode(true), r=lift.slot.getBoundingClientRect();
      g.id='hotGhost'; g.style.width=r.width+'px'; g.style.height=r.height+'px';
      /* the clone's canvas comes over blank: copy the painted icon across */
      var src=lift.slot.querySelector('canvas'), dst=g.querySelector('canvas');
      if(src && dst){ dst.width=src.width; dst.height=src.height; dst.getContext('2d').drawImage(src,0,0); }
      document.body.appendChild(g); lift.ghost=g;
    }
    lift.ghost.style.left=(ev.clientX-lift.ghost.offsetWidth/2)+'px';
    lift.ghost.style.top=(ev.clientY-lift.ghost.offsetHeight/2)+'px';
    var over=slotAt(ev.clientX, ev.clientY);
    if(over===lift.slot) over=null;
    if(over!==lift.over){ if(lift.over) lift.over.classList.remove('over'); lift.over=over; if(over) over.classList.add('over'); }
  }, {capture:true, passive:false});
  ['pointerup','pointercancel'].forEach(function(n){ document.addEventListener(n, function(ev){
    if(hmTimer){ clearTimeout(hmTimer); hmTimer=null; }
    if(turnSequenceBusy()){if(lift)endLift();return;}
    if(lift){
      var L=lift;
      if(n==='pointerup' && L.moved && L.over){
        var j=+L.over.getAttribute('data-i'), t=player.hotbar[j];
        player.hotbar[j]=player.hotbar[L.i]; player.hotbar[L.i]=t;
        endLift(); sfx('ui-click'); abilityBar();
      } else if(n==='pointerup' && !L.moved){ endLift(); openHM(L.i); }
      else endLift();
    }
    if(hmSwallow) setTimeout(function(){ hmSwallow=false; }, 350);    /* some browsers send no click after a long hold */
  }, true); });
  /* ---------------- Gear, Char and Faith + hotbar together. While one is open on touch, the strip shows only the hotbar and the
     sheet stops just above it. Bag items drag immediately; a tap still reads their card. The worn amulet,
     abilities (Char) and prayers (Faith) retain their hold-and-drag gesture. */
  function gearMode(){
    var on = touch() && typeof openSheet!=='undefined' && (openSheet==='Equip' || openSheet==='Char' || openSheet==='Faith');
    document.body.classList.toggle('gearopen', on);
    if(typeof resize==='function') resize();
    var st=document.getElementById('strip');
    if(on && st) document.body.style.setProperty('--hotb', Math.max(0, innerHeight - st.getBoundingClientRect().top)+'px');
  }
  var _showSheetTouch = showSheet;
  showSheet = function(){ var r=_showSheetTouch.apply(this, arguments); gearMode(); return r; };
  window.addEventListener('resize', function(){ setTimeout(gearMode, 60); });

  var bl=null, blTimer=null, blSwallow=false;        /* {src, entry, x, y, moved, ghost, over, pointerId} */
  function bagEntry(el){
    if(el.matches('.cell[data-b]')){ var it=player.bag[+el.getAttribute('data-b')]; return it ? {type:'item', ref:it} : null; }
    if(el.matches('.gslot[data-slot="amulet"]')) return player.amulet ? {type:'amulet'} : null;
    /* 2026-09-20: the equipped bow drags onto the hotbar too, where pressing it shoots (js/rangedslot.js) */
    if(el.matches('.gslot[data-slot="stow"]')) return (typeof isRangedWeapon==='function' && isRangedWeapon(player.ranged)) ? {type:'ranged'} : null;
    var ab=el.getAttribute('data-ab'); if(ab && player.abilities.indexOf(ab)>=0) return {type:'ability', key:ab};
    var pr=el.getAttribute('data-pr'); if(pr && el.getAttribute('draggable')==='true') return {type:'prayer', key:pr};
    return null;
  }
  function endBL(){
    if(!bl) return;
    if(bl.ghost) bl.ghost.remove();
    bl.src.classList.remove('lifted');
    if(bl.over) bl.over.classList.remove('over');
    if(bl.worn) bl.worn.classList.remove('over');
    try{ if(bl.src.hasPointerCapture && bl.src.hasPointerCapture(bl.pointerId)) bl.src.releasePointerCapture(bl.pointerId); }catch(e){}
    bl=null;
  }
  function hideCards(){
    if(typeof hideCard==='function') hideCard();
    var tp=document.getElementById('tip'); if(tp) tp.style.display='none';
    /* mobile.js is still holding its long press open: a pointerdown is what closes it */
    try{ document.body.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true, clientX:-50, clientY:-50})); }catch(e){}
  }
  document.addEventListener('pointerdown', function(ev){
    if(ev.clientX>=0)blSwallow=false;
    if(!touch() || !document.body.classList.contains('gearopen') || ev.clientX<0) return;
    var src=ev.target.closest && ev.target.closest('.tgear .cell[data-b], .tgear .gslot[data-slot="amulet"], .tgear .gslot[data-slot="stow"], #shade [data-ab], #shade [data-pr]'); if(!src) return;
    var e0=bagEntry(src); if(!e0) return;
    var x=ev.clientX, y=ev.clientY;
    clearTimeout(blTimer); endBL();
    function begin(){
      blTimer=null;bl={src:src,entry:e0,x:x,y:y,moved:false,ghost:null,over:null,pointerId:ev.pointerId};
      try{ if(src.setPointerCapture && ev.pointerId!==undefined) src.setPointerCapture(ev.pointerId); }catch(e){}
    }
    if(src.matches('.tgear .cell[data-b]'))begin();else blTimer=setTimeout(begin,420);
    bl0={x:x, y:y};
  }, true);
  var bl0=null;
  document.addEventListener('pointermove', function(ev){
    if(blTimer && bl0 && (Math.abs(ev.clientX-bl0.x)>12 || Math.abs(ev.clientY-bl0.y)>12)){ clearTimeout(blTimer); blTimer=null; }
    if(!bl) return;
    if(bl.pointerId!==undefined && ev.pointerId!==bl.pointerId) return;
    if(!bl.moved && Math.abs(ev.clientX-bl.x)<10 && Math.abs(ev.clientY-bl.y)<10) return;
    ev.preventDefault();
    if(!bl.moved){
      bl.moved=true;blSwallow=true; hideCards();
      var hs=document.querySelector('#hotbar .slot'), r=(hs||bl.src).getBoundingClientRect(), g=document.createElement('div');   /* slot-sized, even from a wide row */
      g.id='hotGhost'; g.className='slot'; g.style.width=r.width+'px'; g.style.height=r.height+'px';
      var src=bl.src.querySelector('canvas');
      if(src){ var c=document.createElement('canvas'); c.width=src.width; c.height=src.height; c.getContext('2d').drawImage(src,0,0);
        c.style.cssText='position:absolute;left:13%;top:13%;width:74%;height:74%'; g.appendChild(c); }
      document.body.appendChild(g); bl.ghost=g; bl.src.classList.add('lifted');
    }
    bl.lx=ev.clientX; bl.ly=ev.clientY;
    bl.ghost.style.left=(ev.clientX-bl.ghost.offsetWidth/2)+'px';
    bl.ghost.style.top=(ev.clientY-bl.ghost.offsetHeight/2)+'px';
    var over=slotAt(ev.clientX, ev.clientY);
    if(over!==bl.over){ if(bl.over) bl.over.classList.remove('over'); bl.over=over; if(over) over.classList.add('over'); }
    var worn=bl.entry && bl.entry.type==='item' ? wornSlotAt(ev.clientX, ev.clientY) : null;
    if(worn!==bl.worn){ if(bl.worn) bl.worn.classList.remove('over'); bl.worn=worn; if(worn) worn.classList.add('over'); }
  }, {capture:true, passive:false});
  ['pointerup','pointercancel'].forEach(function(n){ document.addEventListener(n, function(ev){
    if(bl && bl.pointerId!==undefined && ev.pointerId!==bl.pointerId) return;
    if(blTimer){ clearTimeout(blTimer); blTimer=null; }
    if(!bl) return;
    if(n==='pointercancel')blSwallow=false;
    if(turnSequenceBusy()){endBL();return;}
    var B=bl;
    if(n==='pointerup' && B.moved && B.over){
      hotbarPut(+B.over.getAttribute('data-i'), B.entry); sfx('ui-click');
      endBL(); if(typeof refreshSheet==='function') refreshSheet();
    } else if(n==='pointerup' && B.moved && B.entry.type==='item' && wornSlotAt(B.lx, B.ly) && player.bag.indexOf(B.entry.ref)>=0){
      var wel=wornSlotAt(B.lx, B.ly), wslot=wel.getAttribute('data-slot'), wbi=player.bag.indexOf(B.entry.ref);
      endBL(); hideCards();
      if(typeof equipFromBag==='function' && wslot) equipFromBag(wbi, wslot==='stow' ? 'ranged' : wslot);
      else useBagItem(wbi);
      sfx('ui-click');
      if(typeof updateUI==='function') updateUI(); if(typeof refreshSheet==='function') refreshSheet();
    } else if(n==='pointerup' && B.moved && B.entry.type==='item' && dollAt(B.lx, B.ly) && player.bag.indexOf(B.entry.ref)>=0){
      /* 2026-09-20: Justin - dropping on the paper doll equips, the same as tapping the item (js/sheets.js) */
      var bi=player.bag.indexOf(B.entry.ref);
      endBL(); hideCards(); useBagItem(bi); sfx('ui-click');
      if(typeof updateUI==='function') updateUI(); if(typeof refreshSheet==='function') refreshSheet();
    } else endBL();
  }, true); });
  window.addEventListener('blur',function(){clearTimeout(blTimer);blTimer=null;endBL();blSwallow=false;});
  document.addEventListener('lostpointercapture',function(ev){if(bl && bl.pointerId===ev.pointerId)endBL();},true);
  /* once a slot or bag item is lifted, the finger drags it rather than scrolling the page */
  document.addEventListener('touchmove', function(ev){ if((bl && bl.moved) || (lift && lift.moved) || bl || lift) ev.preventDefault(); }, {passive:false});

  /* no native drag on the touch hotbar */
  document.addEventListener('dragstart', function(ev){ if(touch() && ev.target.closest && ev.target.closest('#hotbar, #shade')) ev.preventDefault(); }, true);


  /* the tap that ends a long press (or closes the menu) must not also fire the slot or step on the map */
  document.addEventListener('click', function(ev){
    if(blSwallow && ev.detail>0){blSwallow=false;ev.stopImmediatePropagation();ev.preventDefault();return;}
    var slot=ev.target.closest && ev.target.closest('#hotbar .slot'); if(slot) slot._longPress=false;   /* travel.js's flag */
    if(hmSwallow && !(hm && hm.contains(ev.target))){ hmSwallow=false; ev.stopImmediatePropagation(); ev.preventDefault(); }
  }, true);
  document.addEventListener('contextmenu', function(ev){ if(touch() && ev.target.closest && ev.target.closest('#hotbar')) ev.preventDefault(); });

  /* ---- 2026-09-22 (Justin): on the tablet, holding a bag item to read it dropped it (a long press fires the
     browser's contextmenu, which the mouse wiring uses for "drop"), and a tap equipped it before it could be read.
     On touch a tap on a bag item or a worn slot opens its card; the card carries the actions (Equip or Use, Drop;
     Take off); a long press never drops; hold-and-drag onto a worn slot or the hotbar still equips or docks. */
  (function(){
    function placeCard(){
      var hb=document.getElementById('hotbar'), r=hb && hb.offsetParent ? hb.getBoundingClientRect() : null;
      document.body.style.setProperty('--cardb', (r && r.top<innerHeight && r.height>0 ? Math.round(innerHeight-r.top)+8 : 8)+'px');
    }
    var _showCardTouch=showCard;
    showCard=function(html, ev){ var r=_showCardTouch.apply(this, arguments); if(touch()) placeCard(); return r; };
    function verb(it){ return it.kind==='weapon'?'Equip':it.kind==='armor'?'Wear':it.kind==='off'?'Take up':it.kind==='food'?'Eat':'Use'; }
    function openCard(el, bi, slot){
      try{ el.dispatchEvent(new MouseEvent('mousemove', {clientX:0, clientY:0, bubbles:true})); }catch(e){ return; }   /* the hover card, placed by showCard above */
      var t=document.getElementById('dtip'); if(!t || t.style.display==='none') return;
      var btns=document.createElement('div'); btns.className='tc-btns';
      function add(label, fn){ var b=document.createElement('button'); b.textContent=label; b.onclick=function(ev){ ev.stopPropagation(); hideCard(); fn(); sfx('ui-click'); if(typeof updateUI==='function') updateUI(); if(typeof refreshSheet==='function') refreshSheet(); }; btns.appendChild(b); }
      if(bi!==null){ var it=player.bag[bi]; if(!it) return; add(verb(it), function(){ useBagItem(bi); }); add('Drop', function(){ dropBagItem(bi); }); }
      else if(slot==='stow' && typeof unequipRanged==='function') add('Take off', unequipRanged);
      else if(slot==='amulet' && player.amulet) add('Take off', takeOffAmulet);
      else if((slot==='ring0'||slot==='ring1') && slotItem(slot)) add('Take off', function(){ takeOffRing(slot==='ring0'?0:1); });
      if(btns.children.length) t.appendChild(btns);
    }
    /* a tap reads; the mouse wiring's tap-to-equip and long-press-to-drop never run on touch */
    document.addEventListener('click', function(ev){
      if(!touch() || !ev.target.closest) return;
      if(ev.target.closest('#dtip')) return;
      var cel=ev.target.closest('.cell[data-b]'), gs=cel?null:ev.target.closest('.gslot[data-slot]');
      if(!cel && !gs) return;
      ev.stopImmediatePropagation(); ev.preventDefault();
      if(cel) openCard(cel, +cel.getAttribute('data-b'), null); else openCard(gs, null, gs.getAttribute('data-slot'));
    }, true);
    document.addEventListener('contextmenu', function(ev){
      if(touch() && ev.target.closest && ev.target.closest('.cell[data-b], .gslot[data-slot], .eslot')){ ev.stopImmediatePropagation(); ev.preventDefault(); }
    }, true);
    /* a touch anywhere off the card closes it */
    document.addEventListener('pointerdown', function(ev){
      if(!touch() || ev.clientX<0) return;
      var t=document.getElementById('dtip'); if(t && t.style.display!=='none' && !(ev.target.closest && ev.target.closest('#dtip'))) hideCard();
    }, true);
  })();

  var n=0, t=setInterval(function(){ var a=hookDpad(), m=moveMap(), c=hookMapHover(); if((a && m && c) || ++n>600) clearInterval(t);   /* up to a minute: the art takes a while to load */ }, 100);
})();
