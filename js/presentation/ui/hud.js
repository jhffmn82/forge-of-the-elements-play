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
    '#log{height:auto!important;min-height:0;contain:size;align-self:stretch;font-size:calc(12px + var(--ui-mobile-text-add,0px))}',
    '#mid{width:720px!important;justify-content:flex-start;gap:6px}',   /* reserve room for every status chip; the log yields first */
    '#bars{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}',
    '#mid .bar{height:20px}',
    '#mid .bar span{font-size:calc(12.5px + var(--ui-mobile-text-add,0px));padding:0 7px}',
    /* the chips fit one row under the bars: short meters, favor shown as a number only */
    '#hud2{flex-wrap:nowrap;gap:5px;font-size:calc(12.5px + var(--ui-mobile-text-add,0px));color:var(--ink);justify-content:flex-start;min-width:0;max-width:100%}',
    '#hud2 .chip{padding:2px 7px 2px 4px;gap:4px;white-space:nowrap;flex:0 0 auto;box-sizing:border-box}',
    '#hud2 .hunger{width:52px}',
    '#hud2 .faithchip{gap:5px;min-width:max-content;flex:0 0 auto}',
    '#hud2 .faithchip .meter{width:40px;flex:0 1 40px;min-width:14px}',
    '#hud2 .motechip{gap:3px;font-size:calc(11.5px + var(--ui-mobile-text-add,0px))}',
    '#hud2 .motechip .dot{margin-right:1px}',
    '#hud2 .faithchip .meter.sm{display:none}',
    '#hotbar{grid-template-columns:repeat(8,52px)!important;grid-template-rows:52px!important;min-height:0!important;gap:5px;flex:0 0 auto}',
    /* 2026-09-28 (Justin picked style D): a dark well, the ability's colour as a soft inner glow instead of a coloured border,
       and a shadow under each icon so it stands off the well */
    '#hotbar .slot{padding:0;align-items:center;justify-content:center;width:52px;height:52px;border:0;border-radius:8px;background:#141110;box-shadow:inset 0 0 0 1px #3a322b,inset 0 0 12px -2px var(--c,transparent),0 2px 3px rgba(0,0,0,.6)}',
    '#hotbar .slot .ico canvas{filter:brightness(var(--icon-exposure,1)) drop-shadow(0 0 1px #000) drop-shadow(0 2px 2px rgba(0,0,0,.8))}',
    '#hotbar .slot .k{color:#cbbba1;font-weight:600;text-shadow:0 1px 1px #000}',
    '#hotbar .slot.armed,#hotbar .slot.over{box-shadow:inset 0 0 0 2px var(--gold),inset 0 0 12px -2px var(--c,transparent),0 2px 3px rgba(0,0,0,.6)}',
    '#hotbar .slot:hover:not(:disabled){box-shadow:inset 0 0 0 1px var(--ember),inset 0 0 12px -2px var(--c,transparent),0 2px 3px rgba(0,0,0,.6)}',
    '#hotbar .slot .n,#hotbar .slot .c{display:none}',
    /* 2026-09-20: Justin - the icons sat small and off to one side. The art was painted at 28px into a 38px box
       that was never centred on its contents, so every slot looked lop-sided. The box is centred, fills most of
       the slot, and the canvas inside stretches to it (painted at 64 below, so it stays sharp). */
    '#hotbar .slot .ico{left:50%;top:50%;transform:translate(-50%,-50%);width:44px;height:44px;display:flex;align-items:center;justify-content:center}',
    '#hotbar .slot .ico canvas{width:100%!important;height:100%!important;display:block}',
    '#hotbar .slot .k{top:2px;left:4px;right:auto;font-size:calc(9px + var(--ui-mobile-text-add,0px))}',
    '#hotbar .slot .cdn{position:absolute;right:3px;bottom:2px;font-size:calc(9px + var(--ui-mobile-text-add,0px));color:var(--gold);text-shadow:0 1px 2px #000}',
    '#hotbar .slot.oncd .ico canvas{filter:brightness(var(--icon-exposure,1)) grayscale(1) brightness(.45) drop-shadow(0 0 1px #000)}',
    '#hotbar .slot.oncd::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:conic-gradient(rgba(0,0,0,.62) calc(var(--cdp,0) * 1%),rgba(0,0,0,0) 0)}',
    '#hotbar .slot .cdn.cdbig{left:0;right:0;top:50%;bottom:auto;transform:translateY(-50%);text-align:center;font-size:calc(20px + var(--ui-mobile-text-add,0px));font-weight:700;color:#fff;text-shadow:0 0 3px #000,0 1px 2px #000;z-index:2}',
    '#hotbar .slot.cdready{animation:cdready .7s ease-out}',
    '@keyframes cdready{0%{box-shadow:inset 0 0 0 2px #ffe08a,0 0 12px 2px rgba(255,210,110,.85)}100%{box-shadow:inset 0 0 0 1px #3a322b,inset 0 0 12px -2px var(--c,transparent),0 2px 3px rgba(0,0,0,.6)}}',
    '@media (prefers-reduced-motion:reduce){#hotbar .slot.cdready{animation:none}}',
    '#ctl{display:grid!important;grid-template-columns:auto auto;grid-template-rows:auto 1fr;gap:5px 8px;align-items:center;align-content:center}',
    '#ctl #fx{grid-column:1/-1;max-width:none;justify-content:flex-start}',
    /* narrower windows keep 8 in a row with smaller slots; the chips drop their labels */
    '@media (max-width:1200px){#strip{grid-template-columns:minmax(220px,1fr) minmax(0,620px) auto!important} #mid{width:620px!important}}',
    '@media (max-width:980px){#strip{grid-template-columns:minmax(180px,1fr) minmax(0,480px) auto!important} #mid{width:480px!important} #hotbar{grid-template-columns:repeat(8,45px)!important;grid-template-rows:45px!important;gap:4px} #hotbar .slot{width:45px;height:45px} #hotbar .slot .ico{width:38px;height:38px} #hud2{flex-wrap:wrap;font-size:calc(12px + var(--ui-mobile-text-add,0px));gap:3px} #hud2 .chip{padding:2px 4px 2px 3px} #hud2 .hunger{width:28px} #hud2 .motechip{font-size:calc(11px + var(--ui-mobile-text-add,0px));gap:2px} #hud2 .faithchip{gap:3px} #hud2 .faithchip .meter{width:24px}}',
    '@media (max-width:760px){#mid{width:380px!important} #hotbar{grid-template-columns:repeat(8,37px)!important;grid-template-rows:37px!important} #hotbar .slot{width:37px;height:37px} #hotbar .slot .ico{width:31px;height:31px} #hud2 .faithchip .meter{display:none}}',
    '@media (max-width:640px){#strip{grid-template-columns:1fr auto!important} #log{grid-column:1/-1;contain:none;height:clamp(70px,12vh,110px)!important}}'
  ].join('\n');
  document.head.appendChild(st);
})();

/* the hotbar's icons are painted large and scaled down by the CSS above, so they stay crisp at any slot size
   (touchui.js does the same at 72 for finger-sized slots) */


/* hover details for hotbar slots */
function buildHotbarCard(i){
  var s=player.hotbar && player.hotbar[i];
  if(!s) return '<div class="nm">Empty slot '+(i+1)+'</div><div class="hint">Drag an ability or bag item here.</div>';
  if(s.type==='ability'){
    var A=ABILITIES[s.key]; if(!A) return '';
    return '<div class="nm">'+A.name+'</div>'+actionDetailsHTML(abilityDetails(A,s.key))+'<div class="hint">Key '+(i+1)+'</div>';
  }
  if(s.type==='prayer'){
    var P=PRAYERS[s.key]; if(!P) return '';
    return '<div class="nm">'+P.name+'</div>'+actionDetailsHTML(prayerDetails(P,s.key))+'<div class="hint">Key '+(i+1)+'</div>';
  }
  if(s.type==='amulet') return player.amulet && typeof trinketCard==='function' ? trinketCard(player.amulet) : '<div class="nm">Amulet</div>';
  if(s.type==='ranged'){
    var rw=player.ranged;
    if(!rw) return '<div class="nm">Ranged</div><div class="hint">Equip a bow to shoot.</div>';
    return '<div class="nm">'+gearName(rw)+'</div><div class="row"><span>Range</span><b>'+player.range+'</b></div>'+
           (player.rangedDmg ? '<div class="row"><span>Damage</span><b>'+player.rangedDmg[0]+'-'+player.rangedDmg[1]+'</b></div>' : '')+
           '<div class="hint">Press to aim; press again to fire.</div><div class="hint">Key '+(i+1)+'</div>';
  }
  if(s.ref) return bagCard(s.ref)+'<div class="hint">Key '+(i+1)+'</div>';
  return '';
}


/* compact chips: "Fed" needs no label (the meter says it; Hungry and Starving still show), motes get a tighter chip */


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
/* Slot accents describe the visible icon's family, not its average paint color.
   Dark silhouettes get a small foreground lift; the authored art, scale and
   native well stay intact. Unknown objects are classified by appearance only:
   consulting a shuffled sigil/jewelry effect here would reveal identification. */
var HOTBAR_ICON_EXPOSURE = {
  'ic-into-the-dark':2, 'ic-shadow-swarm':1.6, 'ic-shadowstep':1.4,
  'ic-umbral-passage':1.3, 'ic-shadow-bolt':1.15
};
function hotbarIconPresentation(name){
  if(!name)return null;
  var family='',color='',exposure=HOTBAR_ICON_EXPOSURE[name]||1;
  if(name.indexOf('rune-')===0){
    var bind=typeof BIND_RUNES!=='undefined'&&BIND_RUNES.indexOf(name.slice(5))>=0;
    family=bind?'sigil-bind':'sigil';color=bind?'#C5A0FF':'#83D8FF';
  }else if(typeof ABILITIES!=='undefined'){
    var keys=Object.keys(ABILITIES);
    for(var i=0;i<keys.length;i++){
      var a=ABILITIES[keys[i]];if(a.icon!==name)continue;
      if(a.god&&typeof GODS!=='undefined'&&GODS[a.god]){family='faith-'+a.god;color=GODS[a.god].color;}
      else if(a.el){
        family='element-'+a.el;
        var type={water:'ice',air:'lightning',earth:'poison',shadow:'dark'}[a.el]||a.el;
        color=typeof DMG_COL!=='undefined'&&DMG_COL[type];
        if(!color)color=typeof AFF_COL!=='undefined'&&AFF_COL[a.el]||'#BFA1E2';
      }else{family='martial';color='#9FB0C0';}
      break;
    }
  }
  if(!family&&typeof GODS!=='undefined'&&typeof prayerIcon==='function'){
    var gods=Object.keys(GODS);
    for(var g=0;g<gods.length&&!family;g++){
      var god=GODS[gods[g]],prayers=god.prayers||[];
      for(var p=0;p<prayers.length;p++)if(prayerIcon(prayers[p])===name){family='faith-'+gods[g];color=god.color;break;}
    }
  }
  /* Retained/legacy prayers can have art even when no current god offers them. */
  if(!family&&typeof PRAYERS!=='undefined'&&typeof prayerIcon==='function'){
    var prayerKeys=Object.keys(PRAYERS);
    for(var q=0;q<prayerKeys.length;q++)if(prayerIcon(prayerKeys[q])===name){family='prayer';color='#E8B44A';break;}
  }
  if(!family&&typeof FOODS!=='undefined'){
    var foods=Object.keys(FOODS);
    for(var f=0;f<foods.length;f++)if(FOODS[foods[f]].icon===name){family='provision';color='#D6A45F';break;}
  }
  if(!family&&/^item-(ring|amulet)(-|$)/.test(name)){family='trinket';color='#B9A5D5';}
  if(!family&&name.indexOf('item-')===0){family='equipment';color='#9FB0C0';}
  if(!family)return null;
  return {family:family,color:ICON_BG_FIXED[name]?ICON_BG_FIXED[name][1]:color,exposure:exposure};
}
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
  if(el)cancelStaticArtPaint(el,'chip');
  var slot=el && el.closest ? el.closest('.slot, .gslot, .hbslot') : null;
  if(!slot) return;
  if(slot.closest('#hotbar')){
    var presentation=hotbarIconPresentation(name);
    slot.style.setProperty('--icon-exposure',presentation?presentation.exposure:1);
    slot.setAttribute('data-icon-family',presentation?presentation.family:'other');
    if(presentation){
      slot.style.setProperty('--c',presentation.color);
      slot.style.background='';slot.style.borderColor='';slot.style.boxShadow='';
      return;
    }
  }
  var bg=iconBG(name);
  if(!bg){
    watchStaticArt(el,function(){return packedObjectSources('icons',name,true);},function(){iconChipFor(el,name);},function(){return el.closest('.slot, .gslot, .hbslot')===slot;},'chip',true);
    return;
  }
  /* The hotbar draws style D from its stylesheet and only needs the colour; equipment chips keep their tinted fill */
  if(slot.closest('#hotbar')){ slot.style.setProperty('--c', bg[1]); slot.style.background=''; slot.style.borderColor=''; slot.style.boxShadow=''; return; }
  slot.style.background=hexA(bg[0], 0.5);
  slot.style.borderColor=bg[1];
  slot.style.boxShadow='inset 0 0 0 1px rgba(0,0,0,0.35)';
}
