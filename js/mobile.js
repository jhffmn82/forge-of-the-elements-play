/* =====================================================================
   mobile.js - phone and tablet support (2026-09-17).
   The game was laid out for a desktop window. On Android the same page has to be readable and tappable at
   about 360x800 (portrait) or 800x360 (landscape) CSS pixels, so:
     - body.touch turns on the touch stylesheet in demo.html and the overrides below: a 46px top bar with
       short labels, one row of finger-sized hotbar slots, a 52px d-pad and 44px action buttons
     - portrait stacks the strip into rows with the message log as the bottom row; landscape keeps two
       columns and floats the log over the map, where height is the scarce dimension
     - the map zooms in, because at phone size the desktop 20x12 view gives 16px tiles
     - the Sandbox tab is dropped on real touch devices: it is a development tool, not something to hand a
       child. A narrow desktop window gets the phone layout but keeps Sandbox.
   Add ?touch=1 to force the touch layout, ?touch=0 to force it off (that is how it gets tested).
   ===================================================================== */
(function(){
  var q = (location.search.match(/[?&]touch=([01])/) || [])[1];
  var coarse = window.matchMedia && matchMedia('(pointer:coarse)').matches;
  /* any touch device counts, phone or tablet: the kids play on tablets too, and a tablet wants the same
     finger-sized controls even though it has room to spare */
  var DEVICE = q==='1' ? true : q==='0' ? false : !!coarse;
  window.MOBILE = DEVICE;

  /* the phone layout also comes on in a narrow desktop window, where the desktop bars overflow anyway */
  function wantTouch(){
    if(q==='1') return true;
    if(q==='0') return false;
    return DEVICE || innerWidth <= 760 || innerHeight <= 460;
  }

  /* ---------------- hud.js lays the strip out for a desktop window with !important rules (a 490px middle
     column, one row of eight 52px icon slots, the action buttons in a column). On a phone the strip has to
     stack instead, so those rules are answered here - this stylesheet is appended last, so it wins. */
  (function(){
    var st=document.createElement('style');
    st.textContent=[
      /* one row of hotbar slots in both orientations: eight slots wide, as tall as the row allows */
      'body.touch #hotbar{grid-template-columns:repeat(8,minmax(0,1fr))!important;grid-template-rows:48px!important;gap:5px!important}',
      'body.touch #hotbar .slot{width:auto!important;height:48px!important}',
      'body.touch #hotbar .slot .ico{width:34px!important;height:34px!important}',
      'body.touch #mid{width:auto!important}',
      /* portrait: rows - bars and hotbar, then the d-pad beside the action buttons, then the log */
      '@media (orientation:portrait){',
      ' body.touch #strip{grid-template-columns:minmax(0,1fr)!important;align-items:stretch;gap:6px!important;padding:6px 8px!important;',
      '   padding-bottom:calc(6px + env(safe-area-inset-bottom,0px))!important}',
      ' body.touch #mid{order:1;gap:5px}',
      ' body.touch #ctl{display:flex!important;flex-direction:row;align-items:stretch;justify-content:space-between;gap:8px;order:2}',
      ' body.touch #ctl #fx{display:none}',                    /* the status tags float over the map instead */
      ' body.touch #dpad{grid-template-columns:repeat(3,44px)!important;grid-auto-rows:34px!important;gap:4px!important}',
      /* the log is the bottom row and gets the room the hotbar's second row used to take */
      ' body.touch #log{order:3;grid-column:auto;contain:none;height:clamp(84px,12vh,112px)!important;font-size:12.5px;padding:6px 9px}',
      '}',
      /* landscape: two columns, and the log floats over the map because height is what runs out */
      '@media (orientation:landscape){',
      ' body.touch #strip{grid-template-columns:minmax(0,1fr) auto!important}',
      ' body.touch #ctl{display:flex!important;flex-direction:row;align-items:flex-end;gap:6px}',
      ' body.touch #log{position:absolute;z-index:5;left:8px;top:54px;width:min(44%,320px);height:auto!important;',
      '   max-height:72px;contain:none;background:rgba(10,9,8,.55);border:none;pointer-events:none}',
      '}',
      /* ---- the Gear sheet: the doll and the bag side by side, both visible without scrolling.
         sheets.js stacks its three columns below 640px, which pushed the bag off the screen. */
      'body.touch #shade{padding:8px}',
      /* the sheet lives inside #map, so bound it to the map and let its body scroll: at 92vh it ran on under
         the bottom strip, and the last rows of a sheet sat behind the hotbar */
      'body.touch .sheet{width:100%;max-height:100%;min-height:0}',
      'body.touch #shade{align-items:stretch}',
      'body.touch .sheet .bodyw{overscroll-behavior:contain}',
      'body.touch .sheet header{padding:7px 10px}',
      'body.touch .sheet header h2{font-size:16px}',
      'body.touch .sheet .bodyw{padding:10px}',
      /* sheets.js writes three columns in the order totals, worn, bag. On a phone the worn doll and the bag
         share the top row and the totals run full width underneath, so both are on screen at once. */
      'body.touch .gearwrap{grid-template-columns:150px minmax(0,1fr)!important;gap:8px 10px!important}',
      'body.touch .gearwrap>*:nth-child(1){grid-column:1/-1;order:3}',     /* offence / defence totals */
      'body.touch .gearwrap>.gcol-worn{grid-column:1;order:1}',
      'body.touch .gearwrap>*:nth-child(3){grid-column:2;order:2}',        /* the bag, beside the doll */
      'body.touch .gdoll{grid-template-columns:42px 50px 42px!important;grid-template-rows:repeat(3,44px)!important;gap:14px 6px!important}',
      'body.touch .gcol-worn .sec span{display:none}',                     /* the "hover for details" hint is mouse talk */
      'body.touch .gdoll .art{min-height:120px!important}',
      'body.touch .gslot{width:42px!important;height:42px!important;border-width:1px}',
      'body.touch .gslot .lab{bottom:-12px;font-size:7.5px}',
      'body.touch .gslot .ph{font-size:16px}',
      'body.touch .gearwrap .invgrid{grid-template-columns:repeat(4,minmax(34px,1fr))!important;gap:5px}',
      'body.touch .gearwrap .sec{margin:6px 0 3px;font-size:9px}',
      'body.touch .stowrow{margin-top:16px;gap:8px}',
      'body.touch .stowrow span{display:none}',                            /* the caption does not fit a 150px column */
      'body.touch .invgrid{grid-template-columns:repeat(auto-fill,minmax(38px,1fr))}',
      /* 2026-09-18: the tile tooltip followed the pointer, which on a touch screen means it lands exactly
         where the finger is - covering the tile you are trying to walk to. On touch it is pinned to the
         bottom-left corner of the map instead (game.js sets left/top inline, hence !important). */
      'body.touch #tip{left:8px!important;top:auto!important;bottom:8px!important;right:auto!important;',
      '  max-width:min(78%,340px)!important;background:rgba(10,9,8,.93);backdrop-filter:blur(2px);padding:9px 11px!important}',
      /* pinned in a corner it is not fighting for room any more, so the type can come up a notch */
      'body.touch #tip .nm{font-size:16px!important}',
      'body.touch #tip .row{font-size:13px!important}',
      'body.touch #tip .odds{font-size:13.5px!important}',
      '@media (orientation:landscape){ body.touch #tip{bottom:8px!important;left:8px!important} }',
      /* the touch targets in the top bar, and room for them: the game title is not needed mid-run */
      /* 2026-09-18: the menu tabs were too small to hit reliably with a finger. 52px tall, 60px minimum
         width, real padding between them - and the row scrolls sideways on a narrow phone rather than
         shrinking the targets back down. */
      'body.touch #top{min-height:52px!important}',
      'body.touch #tabs{gap:4px!important;overflow-x:auto;scrollbar-width:none;flex:1 1 auto;justify-content:flex-end}',
      'body.touch #tabs::-webkit-scrollbar{display:none}',
      'body.touch #tabs button{min-height:52px!important;min-width:60px;padding:0 16px!important;font-size:13.5px!important;flex:0 0 auto}',
      'body.touch #top button{min-height:48px;padding:8px 12px;font-size:13px}',
      'body.touch #brand h1{display:none}',
      /* the chips (fed, essence, motes, faith) stay one row and scroll sideways if there are too many:
         wrapped, they were taking three lines out of the map */
      'body.touch #hud2{flex-wrap:nowrap!important;gap:5px;font-size:11.5px;overflow-x:auto;overflow-y:hidden;',
      '  scrollbar-width:none;min-height:0;padding-bottom:1px}',
      'body.touch #hud2::-webkit-scrollbar{display:none}',
      'body.touch #hud2 .chip{flex:0 0 auto}',
      'body.touch #hud2 .faithchip .meter{display:none}'
    ].join('\n');
    document.head.appendChild(st);
  })();

  /* ---------------- the top bar has to fit about 360 CSS pixels, so its labels get shorter */
  var SHORT = {'Character':'Char', 'Equipment':'Gear', 'Sandbox':'Sand', 'Options':'Opts'};
  function shortenTop(){
    if(!document.body.classList.contains('touch')) return;
    document.querySelectorAll('#tabs button').forEach(function(b){
      var t=b.textContent.trim(); if(SHORT[t]) b.textContent=SHORT[t];
    });
    document.querySelectorAll('#top button').forEach(function(b){
      var t=b.textContent.trim();
      if(/^Sound:/.test(t)) b.textContent = /off/i.test(t) ? '🔇' : '🔊';
      if(/^Music:/.test(t)) b.textContent = /off/i.test(t) ? '♪̸' : '♪';
    });
  }

  /* ---------------- the map zooms in: fewer, bigger tiles than a desktop window wants.
     Portrait is the better shape on a phone - it leaves a near-square map with ~30px tiles, where an
     800x360 landscape gives a letterbox - so each orientation gets its own tile count. */
  function applyZoom(){
    if(typeof ZOOM!=='undefined'){
      var portrait = window.matchMedia && matchMedia('(orientation:portrait)').matches;
      /* at least 15 tiles across and down, so there are 7 squares of warning in every direction */
      ZOOM.phone = portrait ? [15,15] : [16,10];
      if(document.body.classList.contains('touch')){
        if(typeof zoomKey!=='undefined' && zoomKey!=='close' && zoomKey!=='wide') zoomKey='phone';
      } else if(typeof zoomKey!=='undefined' && zoomKey==='phone') zoomKey='normal';
      var sel=document.getElementById('zoom'); if(sel && !sel.querySelector('[value="phone"]')){
        var o=document.createElement('option'); o.value='phone'; o.textContent='Phone'; sel.appendChild(o);
      }
    }
    if(typeof resize==='function') resize();
  }

  /* ---------------- the layout follows the window: a rotate, a keyboard opening, the address bar sliding
     away or a resized desktop window all change which layout fits */
  function sync(){
    var on=wantTouch(), was=document.body.classList.contains('touch');
    document.body.classList.toggle('touch', on);
    /* Wide phones have a separate three-column landscape layout. Smaller landscape
       viewports retain the upright prompt because the touch targets cannot fit. */
    document.body.classList.toggle('needs-portrait', on && innerWidth > innerHeight && innerHeight <= 560 && innerWidth < 740);
    if(on && !was) shortenTop();
    applyZoom();
  }
  window.addEventListener('resize', function(){ setTimeout(sync, 0); });
  window.addEventListener('orientationchange', function(){ setTimeout(sync, 120); });
  if(window.visualViewport) visualViewport.addEventListener('resize', function(){ setTimeout(sync, 0); });

  if(DEVICE){
    /* fullscreen on the first tap: on Android that is what hides the address bar and the navigation bar,
       which is most of the screen a phone has to spare. The orientation is not locked - both ways work. */
    window.addEventListener('pointerdown', function once(){
      window.removeEventListener('pointerdown', once, true);
      var el=document.documentElement;
      try{
        if(!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({navigationUI:'hide'}).catch(function(){});
      }catch(e){}
    }, true);

    /* no pinch zoom, no double-tap zoom, no long-press menu on the map */
    document.addEventListener('gesturestart', function(ev){ ev.preventDefault(); });
    document.addEventListener('contextmenu', function(ev){ if(ev.target && ev.target.id==='cv') ev.preventDefault(); });

    /* offline: the kids should be able to play with the phone in aeroplane mode */
    if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function(){});
  }

  /* ---------------- the Gear tab, written for a touch screen rather than squeezed out of the desktop one.
     The desktop sheet is three columns around a paper doll with drag-and-drop; on a tablet that fights every
     rule it has. This is its own markup: big labelled slot tiles, a bag of large cells, the totals folded
     underneath. It keeps sheets.js's hooks (.gslot[data-slot], .cell[data-b], [data-gicon], #dollArt) so
     wireEquip still does the wiring - tap a bag item to equip or use it, tap a worn slot to take it off,
     hold anything to inspect it. */
  (function(){
    if(typeof equipHTML!=='function') return;
    var st=document.createElement('style');
    st.textContent=[
      '.tgear{display:flex;flex-direction:column;gap:12px}',
      '.tgear .tg-sec{font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin:0 0 6px}',
      '.tgear .tg-hint{font-size:11.5px;color:var(--dim);line-height:1.4;margin:0}',
      /* worn slots in two columns on the left, the bag filling the rest to the right */
      '.tgear .tg-top{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:start}',
      '.tgear .tg-slots{display:grid;grid-template-columns:repeat(2,84px);gap:8px}',
      '.tgear .tg-mid{display:grid;grid-template-columns:108px minmax(0,1fr);gap:12px;align-items:start}',
      '.tgear .gslot{position:relative;width:auto!important;height:auto!important;min-height:84px;display:flex;',
      '  flex-direction:column;align-items:center;justify-content:flex-start;gap:3px;padding:7px 5px 6px;',
      '  border:1px solid var(--edge);border-radius:8px;background:#161210;cursor:pointer;overflow:hidden}',
      '.tgear .gslot.empty{border-style:dashed;opacity:.6}',
      '.tgear .gslot .ic{width:42px;height:42px;display:flex;align-items:center;justify-content:center}',
      '.tgear .gslot .ic canvas{display:block}',
      '.tgear .gslot .ph{font-size:22px;color:var(--dim);line-height:42px}',
      '.tgear .gslot .lab{position:static!important;font-size:8px;letter-spacing:.11em;text-transform:uppercase;color:var(--dim)}',
      '.tgear .gslot .nm{font-size:10.5px;color:var(--ink);text-align:center;line-height:1.2;max-width:100%;',
      '  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.tgear .gslot.over{border-color:var(--gold);background:#2A2015}',
      '.tgear .tg-portrait{min-height:170px;border:1px dashed var(--edge);border-radius:8px;',
      '  background:radial-gradient(#2A221C,#141110);display:flex;align-items:flex-end;justify-content:center;overflow:hidden}',
      '.tgear .tg-cells{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}',   /* 4 x 4 = the 16 bag slots */
      '.tgear .cell{position:relative;aspect-ratio:1;min-height:56px;border:1px solid var(--edge);border-radius:8px;',
      '  background:#161210;display:flex;align-items:center;justify-content:center}',
      '.tgear .cell.empty{border-style:dashed;opacity:.28}',
      '.tgear .cell b{position:absolute;right:4px;bottom:2px;font-size:10px;color:var(--gold);z-index:2}',
      '.tgear .tg-tot{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:4px 18px}',
      '.tgear .tg-tot .kv{font-size:12px;gap:2px 10px}',
      '.tgear .pouch{gap:7px}',
      '.tgear .mote{font-size:11.5px;padding:3px 10px 3px 7px}',
      '@media (max-width:420px){ .tgear .tg-slots{grid-template-columns:repeat(2,72px)} .tgear .tg-mid{grid-template-columns:84px minmax(0,1fr)} }'
    ].join('\n');
    document.head.appendChild(st);

    /* two columns, four rows: hands, body, rings, and the second weapon set */
    var SLOTS = [['main','Main hand','&#9876;'], ['off','Off hand','&#9960;'],
                 ['armor','Armor','&#9960;'],    ['amulet','Amulet','&#9765;'],
                 ['ring0','Ring','&#9675;'],     ['ring1','Ring','&#9675;'],
                 ['stow','Ranged','&#127993;']];
    function wornItem(key){ return (typeof slotItem==='function') ? slotItem(key) : null; }
    function tile(key, label, ph){
      var it = wornItem(key);
      var both = key==='off' && player.twoHanded;
      var icon = it ? (it.icon || (typeof iconNameForBag==='function' ? iconNameForBag({kind:it.kind, data:it}) : '')) : '';
      var col = it && typeof tierCol==='function' ? tierCol(it) : null;
      return '<div class="gslot'+(it?'':' empty')+'" data-slot="'+key+'"'+(col?' style="border-color:'+col+'"':'')+'>'+
             '<div class="ic"'+(icon?' data-gicon="'+icon+'"':'')+'>'+(it?'':'<span class="ph">'+ph+'</span>')+'</div>'+
             '<span class="lab">'+label+'</span>'+
             '<span class="nm">'+(it ? gearName(it) : both ? 'Both hands' : 'Empty')+'</span></div>';
    }
    function touchEquipHTML(){
      var hr = (typeof hitRange==='function') ? hitRange() : [0,0];
      var cells=player.bag.map(function(it,idx){ return '<div class="cell" data-b="'+idx+'" draggable="true">'+(it.n>1?'<b>'+it.n+'</b>':'')+'</div>'; });
      while(cells.length<BAG_MAX) cells.push('<div class="cell empty"></div>');

      /* top of the sheet, both reachable without scrolling: worn slots two-up on the left, bag on the right */
      var h='<div class="tgear"><div class="tg-top">'+
        '<div><p class="tg-sec">Worn</p><div class="tg-slots">'+
          SLOTS.map(function(s){ return tile(s[0], s[1], s[2]); }).join('')+'</div></div>'+
        '<div><p class="tg-sec">Bag &middot; '+player.bag.length+' / '+BAG_MAX+'</p><div class="tg-cells">'+cells.join('')+'</div>'+
          '<p class="tg-hint">Tap an item to read it; its card has Equip and Drop. Hold it and drag it onto a worn slot to equip it, or onto the hotbar to keep it there.</p></div>'+
      '</div>';

      /* below, scrolled to when wanted: the character and the totals */
      h+='<div class="tg-mid"><div class="tg-portrait" id="dollArt"></div><div class="tg-tot">'+
         '<div><p class="tg-sec">Offence</p>'+kv([['Damage per hit',hr[0]+'&ndash;'+hr[1]],['Crit',Math.round(player.crit*100)+'%'],
            ['Accuracy',player.acc],['Range',player.range],['Attack time',actCost(player)],['Spell power','&times;'+spellPower({}).toFixed(2)],['Divine power','&times;'+divineStrength().toFixed(2)]])+'</div>'+
         '<div><p class="tg-sec">Defence</p>'+kv([['HP',Math.round(player.hp)+' / '+player.maxhp],['Shield',playerShield()],
            ['Armor',player.armor],['Evasion',player.eva],['Block',Math.round(player.block*100)+'%'],['Mana',Math.floor(player.mp)+' / '+player.maxmp]])+'</div>'+
         '</div></div>';

      var motes=ELEMENTS.filter(function(m){ return player.motes[m]>0; }).map(function(m){
        return '<span class="mote"><span class="mart" data-mote="'+m+'"></span>'+m+' &times;'+player.motes[m]+'</span>'; }).join('');
      var keys=[['iron','Iron key','item-key-iron'],['crystal','Crystal key','item-key-crystal']].filter(function(k){ return (player.keys[k[0]]||0)>0; })
        .map(function(k){ return '<span class="mote keychip"><span class="kart" data-kicon="'+k[2]+'"></span>'+k[1]+' &times;'+player.keys[k[0]]+'</span>'; }).join('');
      h+='<div><p class="tg-sec">Pouch &middot; '+player.essence+' essence</p><div class="pouch">'+
         (keys||'')+(motes||'')+((keys||motes)?'':'<span class="mote">no keys or motes yet</span>')+'</div></div>';
      h+='<div><p class="tg-sec">Resistances</p>'+resHTML()+'</div>';
      return h+'</div>';
    }
    var _equipHTMLDesk = equipHTML;
    window.equipHTML = function(){
      return document.body.classList.contains('touch') ? touchEquipHTML() : _equipHTMLDesk.apply(this, arguments);
    };
  })();

  /* ---------------- long press = inspect. A finger cannot hover, so the odds card on a monster, the details
     on a bag item and the labels on a gear slot were all unreachable on a phone. Holding still for 420ms
     dispatches a mousemove at that point, which is exactly what the existing hover handlers listen for, and
     the tap that would otherwise follow (a step, an attack, an equip) is swallowed.
     The hotbar is left alone: travel.js already gives its slots a long press of their own. */
  (function(){
    var timer=null, sx=0, sy=0, held=null, heldAt=0, closedAt=0;
    function cards(){ return [document.getElementById('tip'), document.getElementById('dtip')]; }
    function dismiss(){
      if(held){ try{ held.dispatchEvent(new MouseEvent('mouseleave', {bubbles:true})); }catch(e){} held=null; }
      cards().forEach(function(el){ if(el) el.style.display='none'; });
    }
    function cancel(){ if(timer){ clearTimeout(timer); timer=null; } }

    document.addEventListener('pointerdown', function(ev){
      if(!document.body.classList.contains('touch')) return;
      if(held){ dismiss(); closedAt=performance.now(); return; }       /* a tap after a long press only closes it */
      var t=ev.target;
      if(!t || (t.closest && t.closest('#hotbar'))) return;           /* travel.js owns the hotbar's long press */
      if(t.closest && t.closest('#top,#dpad,.sheet header')) return;
      sx=ev.clientX; sy=ev.clientY;
      cancel();
      timer=setTimeout(function(){
        timer=null; held=t; heldAt=performance.now();
        try{ t.dispatchEvent(new MouseEvent('mousemove', {clientX:sx, clientY:sy, bubbles:true})); }catch(e){}
        if(navigator.vibrate) try{ navigator.vibrate(12); }catch(e){}
      }, 420);
    }, true);

    document.addEventListener('pointermove', function(ev){
      if(timer && (Math.abs(ev.clientX-sx)>12 || Math.abs(ev.clientY-sy)>12)) cancel();
    }, true);
    ['pointerup','pointercancel','pointerleave'].forEach(function(n){
      document.addEventListener(n, cancel, true);
    });
    /* the click that ends a long press must not also act on the tile or the item */
    document.addEventListener('click', function(ev){
      var now=performance.now();
      if((held && now-heldAt < 900) || now-closedAt < 400){ ev.stopPropagation(); ev.preventDefault(); }
    }, true);
    window.addEventListener('blur', dismiss);
  })();

  function boot(){
    /* the Sandbox tab is a dev tool: drop it on a real touch device, keep it in a narrow desktop window */
    if(DEVICE){
      var b=document.querySelector('#tabs button[data-p="Sand"]'); if(b) b.remove();
      if(typeof openSheet!=='undefined' && openSheet==='Sand' && typeof showSheet==='function') showSheet(null);
    }
    sync();
    /* the audio buttons rewrite their own labels, so shorten them again each time they do */
    if(typeof syncAudioButtons==='function'){
      var _sync=syncAudioButtons;
      window.syncAudioButtons=function(){ var r=_sync.apply(this, arguments); shortenTop(); return r; };
    }
  }
  FoteLifecycle.whenReady(boot);
})();
