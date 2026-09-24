/* =====================================================================
   hud.js - a roomier layout (2026-09-17).
   - Bottom strip: the log runs the strip's full height on the left; next to it the HP / MP / level bars, the fed,
     essence and faith chips, and a one-row hotbar of 8 icon-only slots are stacked; the d-pad sits at the right
     edge. Hovering a hotbar slot shows its name, cost and description.
   - 2026-09-22: Justin - the Stairs / Grab / Search button column is gone (the keys and the map do those jobs),
     and the centre column takes the room it used.
   ===================================================================== */

(function(){
  var st=document.createElement('style');
  st.textContent=[
    /* bottom strip: log (full height) | bars, chips and hotbar stacked | d-pad */
    '#strip{grid-template-columns:minmax(220px,1fr) minmax(0,720px) auto!important;align-items:stretch}',
    '#log{height:auto!important;min-height:0;contain:size;align-self:stretch;font-size:12px}',
    '#mid{width:720px!important;justify-content:flex-start;gap:6px}',   /* reserve room for every status chip; the log yields first */
    '#bars{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}',
    '#mid .bar{height:20px}',
    '#mid .bar span{font-size:12.5px;padding:0 7px}',
    /* the chips fit one row under the bars: short meters, favor shown as a number only */
    '#hud2{flex-wrap:nowrap;gap:5px;font-size:12.5px;color:var(--ink);justify-content:flex-start;min-width:0;max-width:100%}',
    '#hud2 .chip{padding:2px 7px 2px 4px;gap:4px;white-space:nowrap;flex:0 0 auto;box-sizing:border-box}',
    '#hud2 .hunger{width:52px}',
    '#hud2 .faithchip{gap:5px;min-width:max-content;flex:0 0 auto}',
    '#hud2 .faithchip .meter{width:40px;flex:0 1 40px;min-width:14px}',
    '#hud2 .motechip{gap:3px;font-size:11.5px}',
    '#hud2 .motechip .dot{margin-right:1px}',
    '#hud2 .faithchip .meter.sm{display:none}',
    '#hotbar{grid-template-columns:repeat(8,52px)!important;grid-template-rows:52px!important;min-height:0!important;gap:5px;flex:0 0 auto}',
    '#hotbar .slot{padding:0;align-items:center;justify-content:center;width:52px;height:52px;border-width:2px;background:rgba(25,21,18,.25)}',
    '#hotbar .slot .n,#hotbar .slot .c{display:none}',
    /* 2026-09-20: Justin - the icons sat small and off to one side. The art was painted at 28px into a 38px box
       that was never centred on its contents, so every slot looked lop-sided. The box is centred, fills most of
       the slot, and the canvas inside stretches to it (painted at 64 below, so it stays sharp). */
    '#hotbar .slot .ico{left:50%;top:50%;transform:translate(-50%,-50%);width:44px;height:44px;display:flex;align-items:center;justify-content:center}',
    '#hotbar .slot .ico canvas{width:100%!important;height:100%!important;display:block}',
    '#hotbar .slot .k{top:2px;left:4px;right:auto;font-size:9px}',
    '#hotbar .slot .cdn{position:absolute;right:3px;bottom:2px;font-size:9px;color:var(--gold);text-shadow:0 1px 2px #000}',
    '#ctl{display:grid!important;grid-template-columns:auto auto;grid-template-rows:auto 1fr;gap:5px 8px;align-items:center;align-content:center}',
    '#ctl #fx{grid-column:1/-1;max-width:none;justify-content:flex-start}',
    /* narrower windows keep 8 in a row with smaller slots; the chips drop their labels */
    '@media (max-width:1200px){#strip{grid-template-columns:minmax(220px,1fr) minmax(0,620px) auto!important} #mid{width:620px!important}}',
    '@media (max-width:980px){#strip{grid-template-columns:minmax(180px,1fr) minmax(0,480px) auto!important} #mid{width:480px!important} #hotbar{grid-template-columns:repeat(8,45px)!important;grid-template-rows:45px!important;gap:4px} #hotbar .slot{width:45px;height:45px} #hotbar .slot .ico{width:38px;height:38px} #hud2{flex-wrap:wrap;font-size:12px;gap:3px} #hud2 .chip{padding:2px 4px 2px 3px} #hud2 .hunger{width:28px} #hud2 .motechip{font-size:11px;gap:2px} #hud2 .faithchip{gap:3px} #hud2 .faithchip .meter{width:24px}}',
    '@media (max-width:760px){#mid{width:380px!important} #hotbar{grid-template-columns:repeat(8,37px)!important;grid-template-rows:37px!important} #hotbar .slot{width:37px;height:37px} #hotbar .slot .ico{width:31px;height:31px} #hud2 .faithchip .meter{display:none}}',
    '@media (max-width:640px){#strip{grid-template-columns:1fr auto!important} #log{grid-column:1/-1;contain:none;height:clamp(70px,12vh,110px)!important}}'
  ].join('\n');
  document.head.appendChild(st);
})();

/* the hotbar's icons are painted large and scaled down by the CSS above, so they stay crisp at any slot size
   (touchui.js does the same at 72 for finger-sized slots) */
var _paintArtHud = paintArt;
paintArt = function(el, group, name, size){
  if(el && el.closest && el.closest('#hotbar') && (size||32) < 64) size = 64;
  return _paintArtHud(el, group, name, size);
};

/* hover details for hotbar slots */
function hotbarCard(i){
  var s=player.hotbar && player.hotbar[i];
  if(!s) return '<div class="nm">Empty slot '+(i+1)+'</div><div class="hint">Drag an ability, prayer or bag item here.</div>';
  if(s.type==='ability'){
    var A=ABILITIES[s.key]; if(!A) return '';
    var cost = A.cd ? (typeof cdLeft==='function' && cdLeft(s.key) ? 'ready in '+cdLeft(s.key)+' turns' : A.cd+'-turn cooldown') : A.favor ? A.favor+' Favor' : costOf(A)+' mana';
    return '<div class="nm">'+A.name+'</div><div class="row"><span>Cost</span><b>'+cost+'</b></div>'+(A.range?'<div class="row"><span>Range</span><b>'+spellRange(A)+'</b></div>':'')+'<div class="hint">'+(A.kind==='swarm' && typeof liveDesc==='function' ? liveDesc(A) : A.desc)+'</div><div class="hint">Key '+(i+1)+'</div>';
  }
  if(s.type==='prayer'){
    var P=PRAYERS[s.key]; if(!P) return '';
    return '<div class="nm">'+P.name+'</div><div class="row"><span>Cost</span><b>'+prayerCost(s.key)+'</b></div><div class="row"><span>Needs</span><b>rank '+P.rank+'</b></div><div class="hint">'+P.desc+'</div><div class="hint">Key '+(i+1)+'</div>';
  }
  if(s.type==='amulet') return player.amulet && typeof trinketCard==='function' ? trinketCard(player.amulet) : '<div class="nm">Amulet</div>';
  if(s.type==='ranged'){
    var rw=player.ranged;
    if(!rw) return '<div class="nm">Ranged</div><div class="hint">Your ranged slot is empty. Sling a bow and this slot shoots it.</div>';
    return '<div class="nm">'+gearName(rw)+'</div><div class="row"><span>Range</span><b>'+player.range+'</b></div>'+
           (player.rangedDmg ? '<div class="row"><span>Damage</span><b>'+player.rangedDmg[0]+'&ndash;'+player.rangedDmg[1]+'</b></div>' : '')+
           '<div class="hint">Press to draw on the nearest enemy in reach; press again to loose.</div><div class="hint">Key '+(i+1)+'</div>';
  }
  if(s.type==='swap'){ return '<div class="nm">Nothing here</div><div class="hint">Weapon swapping is gone: a bow in your ranged slot fires by itself at anything out of reach.</div>'; }
  if(s.ref) return bagCard(s.ref)+'<div class="hint">Key '+(i+1)+'</div>';
  return '';
}
var _abilityBarHud = abilityBar;
abilityBar = function(){
  _abilityBarHud();
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
};

/* compact chips: "Fed" needs no label (the meter says it; Hungry and Starving still show), motes get a tighter chip */
var _updateUIHud = updateUI;
updateUI = function(){
  var r=_updateUIHud.apply(this, arguments);
  var hud=$('hud2'); if(!hud) return r;
  var hc=hud.querySelector('.chip[title="Hunger"]');
  if(hc && hc.firstChild && hc.firstChild.nodeType===3 && /^Fed\s*$/.test(hc.firstChild.nodeValue)){ hc.removeChild(hc.firstChild); hc.title='Fed'; }
  var mc=hud.querySelector('.chip[title="Motes"]'); if(mc) mc.classList.add('motechip');
  return r;
};

/* ---------------------------------------------------------------- icon backgrounds (2026-09-20)
   Justin: "all of the icons need a background color (thematic) that provides contrast to the icon... I'd assign each
   icon a color that contrasts with the icon" - light purple behind Sylla's dark spider, white behind Glimmer's gold,
   and so on. Rather than hand-painting seventy pairs, each icon's own art is read once: its opaque pixels give a mean
   hue and lightness, and the chip takes that hue at the opposite end of the scale, with a deeper rim of the same
   family. A handful of hand-picked pairs below win over the measurement where Justin named one. */
var ICON_BG_FIXED = {
  'pr-the-brood':   ['#CDB6E8','#4A2A6E'],   /* dark spider on light purple */
  'ic-into-the-dark':['#CDB6E8','#4A2A6E'],
  'pr-venom-burst': ['#CFE6B4','#2F5A2A'],
  'ic-heal':        ['#FFFFFF','#8A6A20'],   /* Saint Glimmer: gold art on white */
  'pr-consecrate':  ['#FFFFFF','#8A6A20'],
  'pr-sanctuary':   ['#FFFFFF','#8A6A20']
};
var ICON_BG_CACHE = {};
function iconBG(name){
  if(!name) return null;
  if(ICON_BG_FIXED[name]) return ICON_BG_FIXED[name];
  if(ICON_BG_CACHE[name]!==undefined) return ICON_BG_CACHE[name];
  var o=(typeof objArt==='function' && (objArt('icons',name) || (typeof anyObj==='function' && anyObj(name))));
  if(!o || !o.img || !o.img.complete || !o.img.naturalWidth) return null;      /* not loaded yet: try again later */
  var out=null;
  try{
    var c=document.createElement('canvas'); c.width=o.sw; c.height=o.sh;
    var g=c.getContext('2d'); g.drawImage(o.img, o.sx, o.sy, o.sw, o.sh, 0, 0, o.sw, o.sh);
    var D=g.getImageData(0,0,o.sw,o.sh).data, r=0, gg=0, b=0, n=0, lum=0;
    for(var i=0;i<D.length;i+=4){ if(D[i+3]<150) continue; r+=D[i]; gg+=D[i+1]; b+=D[i+2]; n++;
      lum += (0.2126*D[i] + 0.7152*D[i+1] + 0.0722*D[i+2]); }
    if(!n) return (ICON_BG_CACHE[name]=null);
    r/=n; gg/=n; b/=n; lum/=n;
    var mx=Math.max(r,gg,b), mn=Math.min(r,gg,b), d2=mx-mn, h=0;
    if(d2){ h = mx===r ? ((gg-b)/d2+(gg<b?6:0)) : mx===gg ? ((b-r)/d2+2) : ((r-gg)/d2+4); h*=60; }
    var sat = mx ? d2/mx : 0;
    function hsl(hh, ss, ll){
      ss=Math.max(0,Math.min(1,ss)); ll=Math.max(0,Math.min(1,ll));
      var cc=(1-Math.abs(2*ll-1))*ss, xx=cc*(1-Math.abs(((hh/60)%2)-1)), m=ll-cc/2, t;
      t = hh<60?[cc,xx,0]:hh<120?[xx,cc,0]:hh<180?[0,cc,xx]:hh<240?[0,xx,cc]:hh<300?[xx,0,cc]:[cc,0,xx];
      return '#'+[t[0],t[1],t[2]].map(function(v){ return ('0'+Math.round((v+m)*255).toString(16)).slice(-2); }).join('');
    }
    var pale = lum < 140;                                     /* dark art wants a light chip, and the other way round */
    var fill = pale ? hsl(h, Math.min(0.45, sat*0.7+0.12), 0.78) : hsl(h, Math.min(0.5, sat*0.6+0.1), 0.18);
    var rim  = pale ? hsl(h, Math.min(0.6, sat*0.8+0.2), 0.3)  : hsl(h, Math.min(0.7, sat*0.9+0.2), 0.62);
    out=[fill, rim];
  }catch(e){ out=null; }
  return (ICON_BG_CACHE[name]=out);
}
/* paint the chip behind every hotbar icon, on the desktop bar and the touch one */
function iconChipFor(el, name){
  var bg=iconBG(name);
  var slot=el && el.closest ? el.closest('.slot, .gslot, .hbslot') : null;
  if(!slot) return;
  if(!bg){ setTimeout(function(){ if(el.isConnected) iconChipFor(el, name); }, 400); return; }
  /* Subtle hotbar color; keep equipment chips at their existing contrast. */
  slot.style.background=hexA(bg[0], slot.closest('#hotbar') ? 0.25 : 0.5);
  slot.style.borderColor=bg[1];
  slot.style.boxShadow='inset 0 0 0 1px rgba(0,0,0,0.35)';
}
var _paintArtChip = paintArt;
paintArt = function(el, group, name, size){
  var r=_paintArtChip(el, group, name, size);
  try{
    if(el && el.classList && el.classList.contains('ico') && group!=='cast') iconChipFor(el, name);
  }catch(e){}
  return r;
};
