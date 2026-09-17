/* =====================================================================
   hud.js - a roomier layout (2026-09-17).
   - Bottom strip: the log runs the strip's full height on the left; next to it the HP / MP / level bars, the fed,
     essence and faith chips, and a one-row hotbar of 8 icon-only slots are stacked; the d-pad and a column of
     action buttons sit at the right edge. Hovering a hotbar slot shows its name, cost and description.
   ===================================================================== */

(function(){
  var st=document.createElement('style');
  st.textContent=[
    /* bottom strip: log (full height) | bars, chips and hotbar stacked | d-pad and a column of action buttons */
    '#strip{grid-template-columns:minmax(220px,1fr) auto auto!important;align-items:stretch}',
    '#log{height:auto!important;min-height:0;contain:size;align-self:stretch;font-size:12px}',
    '#mid{width:490px!important;justify-content:flex-start;gap:6px}',   /* the hotbar (8 x 52 + gaps) plus room for a full chip row */
    '#bars{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}',
    '#mid .bar{height:20px}',
    '#mid .bar span{font-size:12.5px;padding:0 7px}',
    /* the chips fit one row under the bars: short meters, favor shown as a number only */
    '#hud2{flex-wrap:nowrap;gap:5px;font-size:12.5px;color:var(--ink);justify-content:space-between}',
    '#hud2 .chip{padding:2px 7px 2px 4px;gap:4px;white-space:nowrap}',
    '#hud2 .hunger{width:52px}',
    '#hud2 .faithchip{gap:5px;min-width:0;flex:0 1 auto}',
    '#hud2 .faithchip .meter{width:40px;flex:0 1 40px;min-width:14px}',
    '#hud2 .motechip{gap:3px;font-size:11.5px}',
    '#hud2 .motechip .dot{margin-right:1px}',
    '#hud2 .faithchip .meter.sm{display:none}',
    '#hotbar{grid-template-columns:repeat(8,52px)!important;grid-template-rows:52px!important;min-height:0!important;gap:5px;flex:0 0 auto}',
    '#hotbar .slot{padding:0;align-items:center;justify-content:center;width:52px;height:52px}',
    '#hotbar .slot .n,#hotbar .slot .c{display:none}',
    '#hotbar .slot .ico{left:50%;top:50%;transform:translate(-50%,-50%);width:38px;height:38px}',
    '#hotbar .slot .k{top:2px;left:4px;right:auto;font-size:9px}',
    '#hotbar .slot .cdn{position:absolute;right:3px;bottom:2px;font-size:9px;color:var(--gold);text-shadow:0 1px 2px #000}',
    '#ctl{display:grid!important;grid-template-columns:auto auto;grid-template-rows:auto 1fr;gap:5px 8px;align-items:center;align-content:center}',
    '#ctl #fx{grid-column:1/-1;max-width:none;justify-content:flex-start}',
    '#extra{display:flex!important;flex-direction:column;flex-wrap:nowrap;gap:3px;max-width:none}',
    '#extra button{padding:3px 10px;white-space:nowrap;font-size:11px}',
    '#bClose{display:none!important}',   /* closing a door stays on Shift+C and right-click */
    /* narrower windows keep 8 in a row with smaller slots; the chips drop their labels */
    '@media (max-width:980px){#mid{width:430px!important} #hotbar{grid-template-columns:repeat(8,45px)!important;grid-template-rows:45px!important;gap:4px} #hotbar .slot{width:45px;height:45px} #hotbar .slot .ico{width:32px;height:32px} #hud2{font-size:12px} #hud2 .hunger{width:40px} #hud2 .faithchip .meter{width:30px}}',
    '@media (max-width:760px){#mid{width:350px!important} #hotbar{grid-template-columns:repeat(8,37px)!important;grid-template-rows:37px!important} #hotbar .slot{width:37px;height:37px} #hotbar .slot .ico{width:26px;height:26px} #hud2 .faithchip .meter{display:none}}',
    '@media (max-width:640px){#strip{grid-template-columns:1fr auto!important} #log{grid-column:1/-1;contain:none;height:clamp(70px,12vh,110px)!important}}'
  ].join('\n');
  document.head.appendChild(st);
})();

/* hover details for hotbar slots */
function hotbarCard(i){
  var s=player.hotbar && player.hotbar[i];
  if(!s) return '<div class="nm">Empty slot '+(i+1)+'</div><div class="hint">Drag an ability, prayer or bag item here.</div>';
  if(s.type==='ability'){
    var A=ABILITIES[s.key]; if(!A) return '';
    var cost = A.cd ? (typeof cdLeft==='function' && cdLeft(s.key) ? 'ready in '+cdLeft(s.key)+' turns' : A.cd+'-turn cooldown') : costOf(A)+' mana';
    return '<div class="nm">'+A.name+'</div><div class="row"><span>Cost</span><b>'+cost+'</b></div>'+(A.range?'<div class="row"><span>Range</span><b>'+spellRange(A)+'</b></div>':'')+'<div class="hint">'+A.desc+'</div><div class="hint">Key '+(i+1)+'</div>';
  }
  if(s.type==='prayer'){
    var P=PRAYERS[s.key]; if(!P) return '';
    return '<div class="nm">'+P.name+'</div><div class="row"><span>Cost</span><b>'+prayerCost(s.key)+'</b></div><div class="row"><span>Needs</span><b>rank '+P.rank+'</b></div><div class="hint">'+P.desc+'</div><div class="hint">Key '+(i+1)+'</div>';
  }
  if(s.type==='amulet') return player.amulet && typeof trinketCard==='function' ? trinketCard(player.amulet) : '<div class="nm">Amulet</div>';
  if(s.type==='swap'){ var stow=player.sets[1-player.activeSet]; return '<div class="nm">Swap weapons</div><div class="hint">'+(stow?'Draw your '+gearName(stow)+'.':'Nothing stowed.')+' Costs a turn.</div>'; }
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
      var m=txt.match(/(\d+)\s*turns/); if(m){ var d=document.createElement('span'); d.className='cdn'; d.textContent=m[1]; b.appendChild(d); }
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
