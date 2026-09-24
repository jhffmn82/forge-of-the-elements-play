/* Hotbar and HUD have one owner; slot actions and presentation stages are explicit. */
function renderAmuletHotbar(){

  var btns=$('hotbar').querySelectorAll('.slot[data-i]');
  for(var i=0;i<btns.length;i++){
    var idx=+btns[i].getAttribute('data-i'), s=player.hotbar[idx];
    if(!s || s.type!=='amulet' || !player.amulet) continue;
    var a=player.amulet, ready=!(a.charge>0);
    var b=document.createElement('button');
    b.className='slot hasico'; b.setAttribute('data-i', idx); b.title=AMULETS[a.amulet] ? gearName(a) : 'Amulet';
    if(!ready) b.disabled=true;
    b.innerHTML='<span class="ico"></span><span class="k">'+(idx+1)+'</span><span class="n">'+gearName(a)+'</span><span class="c">'+(ready?'ready':a.charge+' turns')+'</span>';
    btns[i].replaceWith(b);
    (function(bb, ii){ bb.onclick=function(){ sfx('ui-click'); pressSlotIndex(ii); };
      bb.oncontextmenu=function(ev){ ev.preventDefault(); player.hotbar[ii]=null; abilityBar(); };
      dragSource(bb, 'hot:'+ii);
      var ico=bb.querySelector('.ico'); if(ico && (objArt('items',a.icon))) paintArt(ico,'items',a.icon,28); })(b, idx);
  }
}

function renderAmuletCharges(){

  var btns=$('hotbar').querySelectorAll('.slot[data-i]');
  for(var i=0;i<btns.length;i++){
    var idx=+btns[i].getAttribute('data-i'), s=player.hotbar[idx], a=player.amulet;
    if(!s || s.type!=='amulet' || !a) continue;
    var c=btns[i].querySelector('.c'); if(!c) continue;
    amuletSync(a);
    c.textContent = aiming && aiming.amulet ? 'aiming...' : a.charges+'/'+amuletCap(a)+' charges'+(a.charges<amuletCap(a) ? ' · '+(amuletKillsNeeded(a)-(a.progress||0))+' kills' : '');
    btns[i].disabled = a.charges<=0;
    if(aiming && aiming.amulet) btns[i].classList.add('armed');
  }
}

function renderHotbarCooldowns(){

  if(!player || !player.hotbar || !$('hotbar')) return;
  $('hotbar').querySelectorAll('.slot[data-i]').forEach(function(b){
    var s=player.hotbar[+b.getAttribute('data-i')];
    if(s && s.type==='ability' && ABILITIES[s.key] && ABILITIES[s.key].cd){ var c=b.querySelector('.c'), left=cdLeft(s.key); if(c) c.textContent = left ? left+' turns' : 'ready'; if(left) b.style.opacity='0.6'; }
  });
}

function bindHotbarCards(){

  if(!$('hotbar') || !player || !player.hotbar) return;
  $('hotbar').querySelectorAll('.slot[data-i]').forEach(function(b){
    var i=+b.getAttribute('data-i');
    b.removeAttribute('title');
    hoverCard(b, function(){ return hotbarCard(i); });
    /* cooldowns and charges still show as a small number, since the text line is hidden */
    var s=player.hotbar[i], c=b.querySelector('.c'), txt=c ? c.textContent : '';
    if(s && (/turns/.test(txt) || s.type==='amulet')){
      var m=txt.match(/(\d+)\s*turns/), a=s.type==='amulet' && player.amulet;
      var count=a ? (a.charges||0)+'/'+(typeof amuletCap==='function' ? amuletCap(a) : AMULET_MAX_CHARGES) : m && m[1];
      if(count!==null && count!==false){ var d=document.createElement('span'); d.className='cdn'; d.textContent=count; b.appendChild(d); }
    }
  });
}

function bindHotbarClickSpells(){

  if(!$('hotbar') || !player || !player.hotbar) return;
  $('hotbar').querySelectorAll('.slot[data-i]').forEach(function(b){
    var s=player.hotbar[+b.getAttribute('data-i')];
    if(!s || s.type!=='ability' || !clickSpellable(s.key)) return;
    b.oncontextmenu=function(ev){ ev.preventDefault(); toggleClickSpell(s.key); };
    var timer=null;
    b.addEventListener('touchstart', function(){ timer=setTimeout(function(){ timer=null; b._longPress=true; toggleClickSpell(s.key); }, 550); }, {passive:true});
    b.addEventListener('click', function(ev){ if(b._longPress){ b._longPress=false; ev.stopImmediatePropagation(); ev.preventDefault(); } }, true);
    b.addEventListener('touchend', function(){ if(timer){ clearTimeout(timer); timer=null; } });
    if(player.clickSpell===s.key){ var m=document.createElement('span'); m.className='clickmark'; m.textContent='◎'; m.title='Your click spell'; b.appendChild(m); }
  });
}

function renderTouchHotbar(){

    if(document.body.classList.contains('touch')) document.querySelectorAll('#hotbar .slot').forEach(function(b){ b.setAttribute('draggable','false'); });
    return;
  }

function syncHotbar(){
  /* 2026-09-18: learning an ability, changing god or class and the forge all reset the hotbar (hotbar=null)
     so it rebuilds from abilities and prayers - which silently dropped the amulet and any potions on it.
     The last layout is remembered, and after a rebuild those entries go back to their old slots. */
  var rebuilt = !player.hotbar, prev = player._hotPrev || [];

  var i, s;
  if(!player.hotbar) player.hotbar=[null,null,null,null,null,null,null,null];
  var prayers = (typeof prayerList==='function' ? prayerList() : []).filter(function(pid){ return godRank()>=PRAYERS[pid].rank; });
  for(i=0;i<8;i++){
    s=player.hotbar[i]; if(!s) continue;
    if(s.type==='ability' && player.abilities.indexOf(s.key)<0) player.hotbar[i]=null;
    if(s.type==='prayer' && prayers.indexOf(s.key)<0) player.hotbar[i]=null;
    if(s.type==='item' && player.bag.indexOf(s.ref)<0) player.hotbar[i]=null;
  }
  if(!player.hotKnown) player.hotKnown={};
  /* every ability and prayer you know keeps a slot: one that is missing goes back into the first empty slot */
  function offer(type, key){
    player.hotKnown[type.charAt(0)+':'+key]=true;
    for(var j=0;j<8;j++){ var h=player.hotbar[j]; if(h && h.type===type && h.key===key) return; }
    for(var j2=0;j2<8;j2++) if(!player.hotbar[j2]){ player.hotbar[j2]={type:type, key:key}; return; }
  }
  player.abilities.forEach(function(k){ offer('ability', k); });
  prayers.forEach(function(pid){ offer('prayer', pid); });

  if(rebuilt){
    var fresh=player.hotbar.slice(), out=[null,null,null,null,null,null,null,null];
    function same(x,y){ return x && y && x.type===y.type && x.key===y.key && x.ref===y.ref; }
    function valid(h){
      if(!h) return false;
      if(h.type==='item') return player.bag.indexOf(h.ref)>=0;
      if(h.type==='amulet') return !!player.amulet;
      if(h.type==='ranged') return true;                       /* the bow slot is the player's own choice: it survives a rebuild (2026-09-20) */
      return fresh.some(function(f){ return same(f,h); });     /* abilities and prayers: still known */
    }
    prev.forEach(function(h, i){ if(i<8 && valid(h) && !out.some(function(o){ return same(o,h); })) out[i]=h; });
    fresh.forEach(function(f){                                   /* whatever is new goes in the first free slot */
      if(!f || out.some(function(o){ return same(o,f); })) return;
      var j=out.indexOf(null); if(j>=0) out[j]=f;
    });
    player.hotbar=out;
  }
  for(var i=0;i<8;i++){ var s=player.hotbar[i]; if(s && s.type==='amulet' && !player.amulet) player.hotbar[i]=null; }
  if(player.amulet){
    var id='m:'+(player.amulet.uidA || (player.amulet.uidA='a'+(nextId++)));
    if(!player.hotKnown[id]){
      player.hotKnown[id]=true;
      if(!player.hotbar.some(function(s){ return s && s.type==='amulet'; })){ for(var j=0;j<8;j++) if(!player.hotbar[j]){ player.hotbar[j]={type:'amulet'}; break; } }
    }
  }
  player._hotPrev = player.hotbar.slice();
}

function pressSlotIndex(i){
  var s=player.hotbar && player.hotbar[i];
  if(!s) return;
  if(s.type==='ability'){ var ai=player.abilities.indexOf(s.key); if(ai>=0) useAbility(ai); return; }
  if(s.type==='prayer'){ usePrayer(s.key); updateUI(); return; }
  if(s.type==='amulet'){useAmulet();updateUI();return;}
  /* 2026-09-20: the equipped bow can live on the hotbar; pressing it shoots (js/rangedslot.js) */
  if(s.type==='ranged'){ if(typeof bowSlotPress==='function') bowSlotPress(); return; }
  if(s.type==='item'){
    var bi=player.bag.indexOf(s.ref);
    if(bi<0){ player.hotbar[i]=null; abilityBar(); return; }
    var ranged=s.ref.kind==='weapon'&&isRangedWeapon(s.ref.data)?s.ref.data:null;
    useBagItem(bi);updateUI();
    if(ranged&&player.ranged===ranged){player.hotbar[i]={type:'ranged'};abilityBar();}
  }
}

function abilityBar(){renderHotbarSlots();renderAmuletHotbar();renderAmuletCharges();renderHotbarCooldowns();bindHotbarCards();bindHotbarClickSpells();renderTouchHotbar();}

function compactHUDChips(){

  var hud=$('hud2'); if(!hud) return;
  var hc=hud.querySelector('.chip[title="Hunger"]');
  if(hc && hc.firstChild && hc.firstChild.nodeType===3 && /^Fed\s*$/.test(hc.firstChild.nodeValue)){ hc.removeChild(hc.firstChild); hc.title='Fed'; }
  var mc=hud.querySelector('.chip[title="Motes"]'); if(mc) mc.classList.add('motechip');
  return;
}

function updateUI(){renderPlayerUI();compactHUDChips();renderStatusBar();}
/* Refresh combat feedback between actors without rebuilding inventory/hotbar. */
function updateTurnUI(){bars();compactHUDChips();renderStatusBar();}

function paintArt(el,group,name,size){
 if(el&&el.closest&&el.closest('#hotbar'))size=Math.max(size||32,document.body.classList.contains('touch')?72:64);
 var result=paintArtCanvas(el,group,name,size);
 if(el&&el.classList&&el.classList.contains('ico')&&group!=='cast')iconChipFor(el,name);
 return result;
}

function hotbarCard(i){
  var h=buildHotbarCard(i),s=player.hotbar&&player.hotbar[i];
  if(s && s.type==='ability' && clickSpellable(s.key))
    h+='<div class="hint">'+(player.clickSpell===s.key ? 'Your click spell. Right-click or long-press to unset.' : 'Right-click or long-press: click enemies to cast this.')+'</div>';
  return h;
}

/* Only the selected sheet is rendered. Superseded character/equipment panes are removed. */
function renderFaithPane(){
    $('mFaith').innerHTML=faithHTML();
    /* 2026-09-20: paint the god's own statue at the top of the sheet */
    var fart=$('mFaith').querySelector('.faith-art');
    if(fart && player.god && GODS[player.god]) paintArt(fart, 'structures', GODS[player.god].sprite, 96);
    $('mFaith').querySelectorAll('.prayer').forEach(function(b){ b.onclick=function(){ var pid=b.getAttribute('data-p'); showSheet('Faith'); usePrayer(pid); updateUI(); }; });
    $('mFaith').querySelectorAll('.abrow[data-pr]').forEach(function(row){
      var pid=row.getAttribute('data-pr'), ic=row.querySelector('.pico');
      if(ic) paintArt(ic, 'icons', prayerIcon(pid), 28);
      if(godRank()>=PRAYERS[pid].rank){ row.classList.add('dragp'); dragSource(row, 'pray:'+pid); row.title='Drag onto the hotbar'; }
    });
    return;
  }
var SHEET_RENDERERS={
 Char:{id:'mChar',html:charHTML,wire:wireChar},
 Equip:{id:'mEquip',html:equipHTML,wire:wireEquip},
 Faith:{id:'mFaith',render:renderFaithPane},
 Help:{id:'mHelp',html:optionsHTML,wire:wireOptions}
};
function panes(){
 var spec=SHEET_RENDERERS[openSheet];if(!spec)return;
 var element=$(spec.id);if(!element)return;
 if(spec.render){spec.render();return;}
 element.innerHTML=spec.html();spec.wire(element);
}
