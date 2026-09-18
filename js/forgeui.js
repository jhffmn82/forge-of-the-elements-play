/* =====================================================================
   forgeui.js - the Forge's Enchant and Recycle tabs (2026-09-17).
   Enchant: pick a mote, then click the piece of gear to set it into. Each gear card shows what that mote
   would do there; replacing an existing enchantment asks first.
   Recycle: break unwanted gear in your bag down into essence (T0 5, T1 15, T2 40, T3 100, +25% per upgrade
   level, rings and amulets 25, all times the biome's essence multiplier). Unidentified gear is fine.
   ===================================================================== */

var forgeMote = null;
(function(){
  var st=document.createElement('style');
  st.textContent=[
    '.moterow{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 12px}',
    '.moterow button{display:flex;align-items:center;gap:6px;padding:5px 10px}',
    '.moterow button.on{border-color:var(--gold);background:#2A2015;color:var(--gold)}',
    '.enchcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}',
    '.enchcard{display:flex;gap:10px;align-items:flex-start;text-align:left;padding:8px 10px;border:1px solid var(--edge);border-radius:6px;background:#151110;cursor:pointer}',
    '.enchcard:hover:not(.off){border-color:var(--ember)}',
    '.enchcard.off{opacity:.45;cursor:default}',
    '.enchcard .ic{flex:0 0 42px;height:42px;display:flex;align-items:center;justify-content:center}',
    '.enchcard .t{font-size:12px;color:var(--ink)} .enchcard .s{font-size:10.5px;color:var(--dim);text-transform:uppercase;letter-spacing:.08em}',
    '.enchcard .now{font-size:11px;color:var(--ash);margin-top:3px} .enchcard .new{font-size:11px;color:#CFE6B8;margin-top:3px}',
    '.recyc .val{color:var(--gold);font-variant-numeric:tabular-nums;min-width:70px;text-align:right}'
  ].join('\n');
  document.head.appendChild(st);
})();

/* a confirmation that returns to the same Forge tab afterwards (either answer) */
function forgeConfirm(title, text, yesLabel, onYes){
  var tab=forgeTab;
  function back(){ openForge(); forgeTab=tab; renderForge(); }
  openModal(title, '<p>'+text+'</p>', [{label:'Cancel', fn:function(){ back(); }}, {label:yesLabel, cls:'primary', fn:function(){ onYes(); back(); }}]);
}

/* ---------------------------------------------------------------- enchanting */
function enchantTargets(){
  var out=[];
  var w=player.sets[player.activeSet]; if(w && !w.unarmed) out.push({slot:'weapon', label:'Main hand', it:w, text:ENCHANT_TEXT.weapon});
  var ok=typeof offKind==='function' ? offKind() : null;
  if(player.off && player.off!==EMPTY_OFF) out.push({slot:'off', label:'Off hand', it:player.off, text: ok ? ENCHANT_TEXT[ok] : null});
  if(player.armorItem) out.push({slot:'armor', label:'Armor', it:player.armorItem, text:ENCHANT_TEXT.armor});
  return out;
}
function enchantPanelHTML(){
  var have=ELEMENTS.filter(function(el){ return (player.motes[el]||0)>0; });
  if(forgeMote && !(player.motes[forgeMote]>0)) forgeMote=null;
  if(!forgeMote && have.length) forgeMote=have[0];
  var h='<p class="c-info">Choose a mote, then click the gear to set it into. Enchantments grow with your affinity in that element (&times;1 + 0.3 per point).</p>';
  h+='<div class="moterow">'+ELEMENTS.map(function(el){
    var n=player.motes[el]||0;
    return '<button data-emote="'+el+'" class="'+(forgeMote===el?'on':'')+'" '+(n?'':'disabled')+'><span class="dot" style="background:'+AFF_COL[el]+'"></span>'+cap(el)+' &times;'+n+'</button>';
  }).join('')+'</div>';
  if(!forgeMote) return h+'<p class="c-info">You have no motes to set.</p>';
  var el=forgeMote;
  h+='<div class="enchcards">'+enchantTargets().map(function(t, i){
    /* 2026-09-18: an unidentified piece may already hold an enchantment you cannot see, and setting a mote
       would quietly destroy it. The Forge refuses it the same way it refuses to upgrade one. */
    var can=!!t.text && !t.it.unarmed && !t.it.unid, cur=t.it.enchant && !t.it.unid ? t.it.enchant : null;
    var now = cur ? '<div class="now">Now: <span style="color:'+AFF_COL[cur]+'">'+cap(cur)+'</span> &mdash; '+(t.text ? t.text[cur] : '')+'</div>'
                  : '<div class="now">'+(t.it.unid ? 'Unidentified' : 'Not enchanted')+'</div>';
    var why = t.it.unid ? 'The Forge will not work metal you do not know. Identify it first.'
            : t.slot==='off' ? 'A weapon, shield, orb, tome or holy symbol takes an enchantment here. This does not.'
            : 'Cannot be enchanted.';
    var nu = can ? '<div class="new">'+(cur===el ? 'Already '+el : 'With '+el+': '+t.text[el])+'</div>' : '<div class="now c-info">'+why+'</div>';
    return '<div class="enchcard'+(can && cur!==el ? '' : ' off')+'" data-etarget="'+i+'"><span class="ic" data-eicon="'+(t.it.icon||'')+'"></span>'+
      '<div><div class="s">'+t.label+'</div><div class="t">'+gearName(t.it)+'</div>'+now+nu+'</div></div>';
  }).join('')+'</div>';
  return h;
}
function wireEnchantPanel(panel){
  panel.querySelectorAll('[data-emote]').forEach(function(b){ b.onclick=function(){ forgeMote=b.getAttribute('data-emote'); sfx('ui-click'); renderForge(); }; });
  panel.querySelectorAll('[data-eicon]').forEach(function(e){ var n=e.getAttribute('data-eicon'); if(n) e.appendChild(iconCanvas(n, 40, '?')); });
  var targets=enchantTargets();
  panel.querySelectorAll('[data-etarget]').forEach(function(card){
    card.onclick=function(){
      if(card.classList.contains('off')) return;
      var t=targets[+card.getAttribute('data-etarget')], el=forgeMote; if(!t || !el) return;
      var cur=t.it.enchant && !t.it.unid ? t.it.enchant : null;
      var go=function(){ enchantItem(t.slot, el); };
      if(cur) forgeConfirm('Replace the enchantment', 'Your <b>'+gearName(t.it)+'</b> holds <b style="color:'+AFF_COL[cur]+'">'+cap(cur)+'</b>. Setting <b style="color:'+AFF_COL[el]+'">'+cap(el)+'</b> replaces it, and the old enchantment is gone.', 'Replace', go);
      else go();
    };
  });
}

/* ---------------------------------------------------------------- recycling */
var RECYCLE_TIER = [5, 15, 40, 100];
function recycleValue(b){
  if(!b || !b.data) return 0;
  var d=b.data, mult=typeof essenceMult==='function' ? essenceMult() : 1, v;
  if(b.kind==='ring' || b.kind==='amulet') v=25;
  else if(b.kind==='weapon' || b.kind==='armor' || b.kind==='off'){
    if(d.joke || d.name==='Loud Shirt') v=1;
    else { var t=typeof tierNum==='function' ? tierNum(d) : 1; v=RECYCLE_TIER[t]*(1+0.25*Math.max(0, d.plus||0)); }
  } else return 0;
  return Math.max(1, Math.round(v*mult));
}
function recyclePanelHTML(){
  var list=player.bag.map(function(b, i){ return {b:b, i:i, v:recycleValue(b)}; }).filter(function(o){ return o.v>0; });
  var h='<p class="c-info">Break gear you carry down into essence. Better and upgraded gear gives more. Unidentified gear is fine; the Forge doesn\'t care what it was.</p>';
  if(!list.length) return h+'<p class="c-info">Nothing in your bag to recycle.</p>';
  var total=list.reduce(function(a,o){ return a+o.v; }, 0);
  h+=list.map(function(o){
    return '<div class="frow recyc"><span class="ic" data-ricon="'+(iconNameForBag(o.b)||'')+'"></span><div class="ftext"><b>'+o.b.name+'</b></div><span class="val">+'+o.v+' essence</span><button data-recycle="'+o.i+'">Recycle</button></div>';
  }).join('');
  h+='<div class="frow"><div class="ftext c-info">Everything above: <b style="color:var(--gold)">+'+total+' essence</b></div><button data-recycle-all="1">Recycle all</button></div>';
  return h;
}
function recycleAt(i){
  var b=player.bag[i], v=recycleValue(b); if(!v) return;
  player.bag.splice(i,1); player.essence+=v;
  log('The Forge melts down your <b>'+b.name+'</b>: +'+v+' essence.','c-good'); sfx('forge-craft');
}
function wireRecyclePanel(panel){
  panel.querySelectorAll('[data-ricon]').forEach(function(e){ var n=e.getAttribute('data-ricon'); if(n) e.appendChild(iconCanvas(n, 28, '?')); });
  panel.querySelectorAll('[data-recycle]').forEach(function(b){ b.onclick=function(){ recycleAt(+b.getAttribute('data-recycle')); updateUI(); renderForge(); }; });
  var all=panel.querySelector('[data-recycle-all]');
  if(all) all.onclick=function(){
    var n=player.bag.filter(function(b){ return recycleValue(b)>0; }).length, tot=player.bag.reduce(function(a,b){ return a+recycleValue(b); },0);
    forgeConfirm('Recycle all', 'Melt down <b>'+n+'</b> piece'+(n>1?'s':'')+' of gear from your bag for <b>'+tot+' essence</b>?', 'Recycle', function(){
      for(var i=player.bag.length-1;i>=0;i--) if(recycleValue(player.bag[i])>0){ var b=player.bag[i]; player.essence+=recycleValue(b); player.bag.splice(i,1); }
      log('The Forge melts down '+n+' pieces of gear: +'+tot+' essence.','c-good'); sfx('forge-craft');
      updateUI();
    });
  };
}

/* ---------------------------------------------------------------- hook the Forge window */
var _renderForgeUI = renderForge;
renderForge = function(){
  var tab=forgeTab;
  _renderForgeUI();
  var body=$('forgeBody'); if(!body) return;
  var tabs=body.querySelector('.ftabs');
  if(tabs && !tabs.querySelector('[data-ft="recycle"]')){
    var rb=document.createElement('button'); rb.setAttribute('data-ft','recycle'); rb.textContent='Recycle'; if(tab==='recycle') rb.className='on';
    rb.onclick=function(){ forgeTab='recycle'; sfx('ui-click'); renderForge(); };
    tabs.appendChild(rb);
  }
  var panel=body.querySelector('.fpanel'); if(!panel) return;
  if(tab==='enchant'){ panel.innerHTML=enchantPanelHTML(); wireEnchantPanel(panel); }
  else if(tab==='recycle'){ panel.innerHTML=recyclePanelHTML(); wireRecyclePanel(panel); }
};
