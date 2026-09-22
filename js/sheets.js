/* =====================================================================
   sheets.js - the Character and Equipment screens, rebuilt (2026-09-17).
   Character: stats and resistances | activated abilities and prayers | every passive, grouped by source.
   Equipment: totals (damage per hit, defences, attributes, resistances) | icon-only gear slots around the
   paper doll, descriptions on hover | the bag. The sheet body scrolls.
   Replaces the Char/Equip branches of panes(); the other sheets still use the older code.
   ===================================================================== */

(function(){
  var st=document.createElement('style');
  st.textContent = [
    '.sheet{width:min(1120px,100%);max-height:100%;overflow:hidden}',
    '.sheet .bodyw{flex:1 1 auto;min-height:0;overflow-y:auto}',
    '.cols3{display:grid;grid-template-columns:minmax(170px,0.9fr) minmax(190px,1.05fr) minmax(200px,1.15fr);gap:14px 20px;align-items:start}',
    '@media (max-width:640px){.cols3{grid-template-columns:1fr}}',
    '.sec{margin:14px 0 6px;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);border-bottom:1px solid var(--edge);padding-bottom:3px}',
    '.sec:first-child{margin-top:0}',
    '.prow{display:grid;grid-template-columns:22px 1fr auto;gap:8px;align-items:baseline;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px}',
    '.prow .n{color:var(--ink)} .prow .d{color:var(--dim);font-size:11px;line-height:1.35} .prow .s{font-size:10.5px;white-space:nowrap}',
    '.prow.off .n{color:var(--ash)} .prow.off{opacity:.55}',
    '.prow .k{color:var(--gold);font-variant-numeric:tabular-nums;font-size:11px}',
    '.arow{display:grid;grid-template-columns:40px 1fr auto;gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05)}',
    '.arow .ic{width:36px;height:36px;border:1px solid var(--edge);border-radius:4px;background:#161210;display:flex;align-items:center;justify-content:center;overflow:hidden}',
    '.arow .n{color:var(--ink);font-size:12.5px} .arow .d{color:var(--dim);font-size:11px;line-height:1.35} .arow .c{font-size:11px;text-align:right;white-space:nowrap}',
    '.arow[draggable=true]{cursor:grab} .arow.locked{opacity:.45}',
    '.res{display:grid;grid-template-columns:repeat(2,1fr);gap:4px 12px;font-size:11.5px}',
    '.res span{display:flex;justify-content:space-between;color:var(--ash)} .res b{font-variant-numeric:tabular-nums}',
    '.gearwrap{display:grid;grid-template-columns:minmax(150px,0.7fr) minmax(300px,1.5fr) minmax(200px,1.15fr);gap:14px 20px;align-items:start}',
    '@media (max-width:640px){.gearwrap{grid-template-columns:1fr} .gearwrap>.gcol-worn{order:-1}}',
    '.gearwrap .kv{font-size:11px;gap:1px 8px} .gearwrap .res{grid-template-columns:1fr 1fr;gap:1px 10px;font-size:11px}',
    '.gearwrap .sec{margin:9px 0 4px}',
    '.keychip{display:inline-flex;align-items:center;gap:5px} .keychip .kart{width:18px;height:18px;display:inline-block}',
    '.gearwrap .invgrid{grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}',
    '.gearwrap .invgrid .cell{max-width:104px;justify-self:stretch}',
    '.gdoll{display:grid;grid-template-columns:72px minmax(110px,1fr) 72px;grid-template-rows:repeat(3,72px);gap:12px 16px;align-items:center;justify-items:center}',
    '.gdoll .art{grid-column:2;grid-row:1/4;align-self:stretch;justify-self:stretch;border:1px dashed var(--edge);border-radius:8px;background:radial-gradient(#2A221C,#141110);display:flex;align-items:flex-end;justify-content:center;overflow:hidden;min-height:250px}',
    '.gslot{position:relative;width:68px;height:68px;border:2px solid var(--edge);border-radius:6px;background:#161210;display:flex;align-items:center;justify-content:center;cursor:pointer}',
    '.gslot .lab{position:absolute;bottom:-14px;left:-10px;right:-10px;text-align:center;font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);pointer-events:none}',
    '.gslot.empty{border-style:dashed;opacity:.55;cursor:copy}',
    '.gslot.cursed{box-shadow:0 0 0 1px #D0605A inset}',
    '.gslot .ench{position:absolute;top:3px;right:3px;width:7px;height:7px;border-radius:50%}',
    '.gslot.over{border-color:var(--gold)!important;background:#2A2015}',
    '.gslot .ph{font-size:22px;color:var(--dim)}',
    '.stowrow{display:flex;align-items:center;gap:12px;margin-top:22px}',
    '.gdoll.over{outline:1px dashed var(--gold);outline-offset:6px;border-radius:10px}'   /* 2026-09-20: the whole doll takes a drop */
  ].join('\n');
  document.head.appendChild(st);
})();

var STAT_LABEL = {mig:'Might', agi:'Agility', vit:'Vitality', foc:'Focus'};
var RES_TYPES = [['fire','Fire'],['ice','Ice'],['lightning','Lightning'],['poison','Poison'],['light','Light'],['dark','Dark'],['magic','Magic']];
function pct(v){ return (v>0?'+':'')+Math.round(v*100)+'%'; }
function resHTML(){
  return '<div class="res">'+RES_TYPES.map(function(r){
    var m=resistMult(player, r[1]==='Magic'?'magic':r[0]), v=1-m;
    var col = v>0.001 ? 'var(--moss)' : v<-0.001 ? '#D0605A' : 'var(--dim)';
    return '<span>'+r[1]+'<b style="color:'+col+'">'+(m===0?'immune':pct(v))+'</b></span>';
  }).join('')+'</div>';
}
/* what one weapon hit does before the target's armor: weapon dice with Might, melee passives and fire affinity */
function hitRange(){
  var melee = !(player.range>1);
  var mult = 1 + 0.04*(player.stats.mig-10) + (melee && hasP('heavyHands')?0.10:0) + (melee && hasP('unstoppable')?0.20:0) + (melee && buff('rampage')?0.40:0);
  mult = Math.max(0.1, mult);
  var fire = (player.aff && player.aff.fire) || 0;
  return [Math.max(1,Math.round(player.dmg[0]*mult))+fire, Math.max(1,Math.round(player.dmg[1]*mult))+fire];
}
function paintIcon(el, name, size){
  if(!el || !name) return;
  if(objArt('icons', name)) paintArt(el, 'icons', name, size);
  else if(objArt('items', name)) paintArt(el, 'items', name, size);
}

/* ---------------------------------------------------------------- Character */
function charHTML(){
  var h='<div class="cols3">';
  /* left: who, attributes, affinity, derived, resistances */
  h+='<div><h2 class="head">'+player.name+'</h2><div class="who">'+player.who+' &middot; Level '+player.level+
     (player.points?' &middot; <span style="color:var(--gold)">'+player.points+' unspent</span>':'')+'</div>';
  h+='<div class="sec">Attributes</div><div class="grid4">'+statBox('Might',player.stats.mig,'mig')+statBox('Agility',player.stats.agi,'agi')+statBox('Vitality',player.stats.vit,'vit')+statBox('Focus',player.stats.foc,'foc')+'</div>';
  var pips=Object.keys(player.aff).filter(function(e){ return player.aff[e]>0; }).map(function(e){
    var n=player.aff[e], dots=''; for(var i=0;i<6;i++) dots+='<span class="pip" style="'+(i<n?'background:'+AFF_COL[e]+';border-color:'+AFF_COL[e]:'')+(i===5?';opacity:.5':'')+'"></span>';
    return '<div class="aff"><span class="nm">'+cap(e)+'</span><span class="pips">'+dots+'</span><span style="color:var(--dim)">'+n+'</span></div>';
  }).join('');
  h+='<div class="sec">Affinity ('+totalAffinity()+' / '+affinityCap()+')</div>'+(pips || '<div class="c-info" style="font-size:11.5px">None yet. Carry a mote to the Elemental Forge (floor '+RUN.forgeFloor+').</div>');
  var hr=hitRange();
  h+='<div class="sec">Derived</div>'+kv([['HP',Math.round(player.hp)+' / '+player.maxhp+(playerShield()?' <span style="color:#9FD8FF">+'+playerShield()+'</span>':'')],['Mana',Math.floor(player.mp)+' / '+player.maxmp],
    ['Damage per hit',hr[0]+'&ndash;'+hr[1]],['Crit',Math.round(player.crit*100)+'%'],['Accuracy',player.acc],['Evasion',player.eva],['Armor',player.armor],
    ['Block',Math.round(player.block*100)+'%'],['Parry',Math.round(player.parry*100)+'%'],['Spell power','&times;'+spellPower({}).toFixed(2)],['Range',player.range],
    ['Action time',actCost(player)],['Move time',moveCost()],['XP',player.xp+' / '+player.xpNext]]);
  h+='<div class="sec">Resistances</div>'+resHTML()+'</div>';

  /* middle: activated abilities, prayers, amulet */
  h+='<div><div class="sec">Abilities <span style="text-transform:none;letter-spacing:0">(drag onto the hotbar)</span></div>';
  if(!player.abilities.length) h+='<div class="c-info" style="font-size:11.5px">No active abilities yet.</div>';
  player.abilities.forEach(function(k){
    var A=ABILITIES[k]; if(!A) return;
    var cost = A.cd ? (typeof cdLeft==='function' && cdLeft(k) ? cdLeft(k)+' turns' : A.cd+'-turn cooldown') : costOf(A)+' mana';
    h+='<div class="arow" data-ab="'+k+'" draggable="true"><span class="ic" data-icon="'+(A.icon||'')+'"></span><span><span class="n">'+A.name+'</span><div class="d">'+A.desc+'</div></span><span class="c" style="color:var(--ice)">'+cost+'</span></div>';
  });
  if(player.god){
    var g=GODS[player.god];
    h+='<div class="sec">Prayers &middot; <span style="color:'+g.color+';text-transform:none;letter-spacing:0">'+g.name+'</span></div>';
    (g.prayers||[]).forEach(function(pid){
      var P=PRAYERS[pid]; if(!P) return; var ok=godRank()>=P.rank; if(!ok) return;
      h+='<div class="arow'+(ok?'':' locked')+'" data-pr="'+pid+'"'+(ok?' draggable="true"':'')+'><span class="ic" data-icon="'+prayerIcon(pid)+'"></span><span><span class="n">'+P.name+'</span><div class="d">'+P.desc+'</div></span><span class="c" style="color:var(--gold)">'+(ok?prayerCost(pid):'rank '+P.rank)+'</span></div>';
    });
  }
  if(player.amulet && typeof AMULETS!=='undefined' && AMULETS[player.amulet.amulet]){
    var a=player.amulet, known=!a.unid || (RUN.amuletKnown||{})[a.amulet];
    h+='<div class="sec">Amulet</div><div class="arow"><span class="ic" data-icon="'+a.icon+'"></span><span><span class="n">'+gearName(a)+'</span><div class="d">'+(known?AMULETS[a.amulet].desc:'Use it to learn what it does.')+'</div></span><span class="c" style="color:var(--gold)">'+(a.charges!==undefined?a.charges+' ch.':'')+'</span></div>';
  }
  h+='</div>';

  /* right: every passive, by source */
  h+='<div>';
  h+='<div class="sec">Class &amp; race</div>';
  h+='<div class="prow"><span class="k">&#9670;</span><span><span class="n">'+CLASSES[player.cls].name+'</span><div class="d">'+CLASSES[player.cls].passive+'</div></span><span></span></div>';
  h+='<div class="prow"><span class="k">&#9670;</span><span><span class="n">'+RACES[player.race].name+'</span><div class="d">'+RACES[player.race].blurb+'</div></span><span></span></div>';
  var earned=[]; for(var sk0 in PASSIVES) PASSIVES[sk0].forEach(function(p){ if(player.stats[sk0]>=p.at) earned.push(p); });
  if(earned.length) h+='<div class="sec">Attributes</div>';
  for(var sk in PASSIVES){
    PASSIVES[sk].forEach(function(p){
      var on=player.stats[sk]>=p.at; if(!on) return;
      h+='<div class="prow'+(on?'':' off')+'"><span class="k">'+p.at+'</span><span><span class="n">'+p.name+'</span><div class="d">'+p.d+(on?'':' &middot; needs '+STAT_LABEL[sk]+' '+p.at)+'</div></span><span class="s" style="color:'+(on?'var(--moss)':'var(--dim)')+'">'+(on?'on':(p.at-player.stats[sk])+' to go')+'</span></div>';
    });
  }
  var els=Object.keys(player.aff).filter(function(e){ return player.aff[e]>0; });
  if(els.length){
    h+='<div class="sec">Elements</div>';
    els.forEach(function(e){
      var n=player.aff[e];
      h+='<div class="prow"><span class="k" style="color:'+AFF_COL[e]+'">1</span><span><span class="n">'+cap(e)+' 1</span><div class="d">'+(T1_TEXT[e]||'')+'</div></span><span class="s" style="color:var(--moss)">on</span></div>';
      [3,6].forEach(function(r){
        if(typeof RANK_TEXT==='undefined' || !RANK_TEXT[r][e]) return;
        var on=n>=r; if(!on) return;
        h+='<div class="prow'+(on?'':' off')+'"><span class="k" style="color:'+AFF_COL[e]+'">'+r+'</span><span><span class="n">'+cap(e)+' '+r+'</span><div class="d">'+RANK_TEXT[r][e]+'</div></span><span class="s" style="color:'+(on?'var(--moss)':'var(--dim)')+'">'+(on?'on':'rank '+r)+'</span></div>';
      });
    });
    if(typeof COMBOS!=='undefined') combosHeld().forEach(function(k){
      var C=COMBOS[k], pr=k.split('/');
      h+='<div class="prow"><span class="k" style="color:'+AFF_COL[pr[0]]+'">&#10022;</span><span><span class="n">'+C.name+'</span><div class="d">'+C.d+' ('+cap(pr[0])+' 3 / '+cap(pr[1])+' 2)</div></span><span class="s" style="color:var(--moss)">on</span></div>';
    });
  }
  if(player.god){
    var G=GODS[player.god], rk=godRank();
    h+='<div class="sec">Faith &middot; rank '+rk+'</div>';
    G.boons.forEach(function(b, i){
      var at=BOON_RANKS[i]||i+1, on=rk>=at, parts=b.split(': '), nm=parts.length>1?parts.shift():'Boon'; if(!on) return;
      h+='<div class="prow'+(on?'':' off')+'"><span class="k" style="color:'+G.color+'">'+at+'</span><span><span class="n">'+nm+'</span><div class="d">'+parts.join(': ')+'</div></span><span class="s" style="color:'+(on?'var(--moss)':'var(--dim)')+'">'+(on?'on':'rank '+at)+'</span></div>';
    });
  }
  var gear=[];
  (player.rings||[]).forEach(function(r){ if(r) gear.push([gearName(r), r.unid ? 'Strength unknown until it is identified.' : (RINGS[r.ring].desc+' '+ringLine(r))]); });
  var w=player.weapon;
  if(w && !w.unarmed && (w.note || w.enchant)) gear.push([gearName(w), (w.note||'')+(w.enchant && !w.unid ? ' &middot; '+ENCHANT_TEXT.weapon[w.enchant] : '')]);
  var ar=player.armorItem;
  if(ar && ar.enchant && !ar.unid) gear.push([gearName(ar), ENCHANT_TEXT.armor[ar.enchant]]);
  var of=player.off;
  if(of && of!==EMPTY_OFF && of.enchant && typeof offKind==='function' && offKind() && ENCHANT_TEXT[offKind()]) gear.push([gearName(of), (typeof enchantLive==='function' ? enchantLive(offKind(), of.enchant) : ENCHANT_TEXT[offKind()][of.enchant])]);
  if(gear.length){
    h+='<div class="sec">Gear</div>';
    gear.forEach(function(g){ h+='<div class="prow"><span class="k">&#9679;</span><span><span class="n">'+g[0]+'</span><div class="d">'+g[1]+'</div></span><span></span></div>'; });
  }
  h+='<div class="c-info" style="font-size:11px;margin-top:10px;color:var(--dim)">Training attributes, attuning to elements and serving a god reveal more.</div>'
  h+='</div></div>';
  return h;
}
function wireChar(root){
  root.querySelectorAll('[data-icon]').forEach(function(e){ paintIcon(e, e.getAttribute('data-icon'), 32); });
  root.querySelectorAll('.arow[data-ab]').forEach(function(r){ dragSource(r, 'abil:'+r.getAttribute('data-ab')); });
  root.querySelectorAll('.arow[data-pr][draggable]').forEach(function(r){ dragSource(r, 'pray:'+r.getAttribute('data-pr')); });
  root.querySelectorAll('.plus').forEach(function(b){ b.onclick=function(ev){ ev.stopPropagation(); spendPoint(b.getAttribute('data-s')); }; });
}

/* ---------------------------------------------------------------- Equipment */
function slotHTML(key, label, it, placeholder){
  if(!it || it===EMPTY_OFF) return '<div class="gslot empty" data-slot="'+key+'"><span class="ph">'+placeholder+'</span><span class="lab">'+label+'</span></div>';
  var col=(typeof tierCol==='function' && tierCol(it)) || 'var(--edge)';
  var ench=it.enchant && !it.unid ? '<span class="ench" style="background:'+AFF_COL[it.enchant]+'"></span>' : '';
  return '<div class="gslot'+(it.cursed && !it.unid?' cursed':'')+'" data-slot="'+key+'" style="border-color:'+col+'"><span class="icon" data-gicon="'+(it.icon||'')+'"></span>'+ench+'<span class="lab">'+label+'</span></div>';
}
function equipHTML(){
  var w=player.weapon, off=player.twoHanded?null:player.off, ar=player.armorItem, r=player.rings||[null,null], stow=player.ranged;
  var hr=hitRange(), h='<div class="gearwrap">';
  /* left: totals */
  h+='<div><div class="sec">Offense</div>'+kv([['Damage per hit',hr[0]+'&ndash;'+hr[1]],['Crit',Math.round(player.crit*100)+'%'],['Accuracy',player.acc],['Range',player.range],['Attack time',actCost(player)],['Spell power','&times;'+spellPower({}).toFixed(2)]]);
  h+='<div class="sec">Defense</div>'+kv([['HP',Math.round(player.hp)+' / '+player.maxhp],['Shield',playerShield()],['Armor',player.armor],['Evasion',player.eva],['Block',Math.round(player.block*100)+'%'],['Parry',Math.round(player.parry*100)+'%'],['Mana',Math.floor(player.mp)+' / '+player.maxmp]]);
  h+='<div class="sec">Attributes</div><div class="res">'+['mig','agi','vit','foc'].map(function(k){ return '<span>'+STAT_LABEL[k]+'<b>'+player.stats[k]+'</b></span>'; }).join('')+'</div>';
  h+='<div class="sec">Resistances</div>'+resHTML()+'</div>';
  /* middle: doll and slots */
  h+='<div class="gcol-worn"><div class="sec">Worn <span style="text-transform:none;letter-spacing:0">(hover for details, drag from the bag to equip)</span></div><div class="gdoll">'+
     slotHTML('main','Main hand', w && !w.unarmed ? w : null, '&#9876;')+'<div class="art" id="dollArt"></div>'+slotHTML('off', player.twoHanded?'Both hands':'Off hand', off, '&#9960;')+
     slotHTML('armor','Armor', ar, '&#9960;')+slotHTML('amulet','Amulet', player.amulet, '&#9765;')+
     slotHTML('ring0','Ring', r[0], '&#9675;')+slotHTML('ring1','Ring', r[1], '&#9675;')+'</div>'+
     '<div class="stowrow">'+slotHTML('stow','Ranged', stow, '&#127993;')+'<span class="c-info" style="font-size:11px">'+(stow?'Fires by itself at anything more than a tile away.':'A bow here fires without swapping.')+'</span></div></div>';
  /* right: bag and pouch */
  var cells=player.bag.map(function(it,idx){ return '<div class="cell" data-b="'+idx+'" draggable="true">'+(it.n>1?'<b>'+it.n+'</b>':'')+'</div>'; });
  while(cells.length<BAG_MAX) cells.push('<div class="cell empty"></div>');
  var motes=ELEMENTS.filter(function(m){ return player.motes[m]>0; }).map(function(m){ return '<span class="mote"><span class="mart" data-mote="'+m+'"></span>'+m+' &times;'+player.motes[m]+'</span>'; }).join('');
  var keyChips=[['iron','Iron key','item-key-iron'],['crystal','Crystal key','item-key-crystal']].filter(function(k){ return (player.keys[k[0]]||0)>0; })
    .map(function(k){ return '<span class="mote keychip"><span class="kart" data-kicon="'+k[2]+'"></span>'+k[1]+' &times;'+player.keys[k[0]]+'</span>'; }).join('');
  h+='<div><div class="sec">Bag ('+player.bag.length+' / '+BAG_MAX+')</div><div class="invgrid">'+cells.join('')+'</div>'+
     '<div class="sec">Keys</div><div class="pouch">'+(keyChips||'<span class="mote">no keys &middot; they open locked doors on the floor where you find them</span>')+'</div>'+
     '<div class="sec">Pouch &middot; '+player.essence+' essence</div>'+
     '<div class="pouch">'+(motes||'<span class="mote">no motes yet</span>')+'</div></div>';
  return h+'</div>';
}
function slotItem(key){
  if(key==='main') return player.weapon && !player.weapon.unarmed ? player.weapon : null;
  if(key==='off') return player.twoHanded ? null : (player.off===EMPTY_OFF ? null : player.off);
  if(key==='armor') return player.armorItem;
  if(key==='amulet') return player.amulet;
  if(key==='ring0') return (player.rings||[])[0];
  if(key==='ring1') return (player.rings||[])[1];
  if(key==='stow') return player.ranged;
  return null;
}
function slotCard(key){
  var it=slotItem(key);
  var empty={main:'Main hand: drag a weapon here.', off:'Off hand: a shield, focus, or light weapon.', armor:'Armor.', amulet:'Amulet: activated from the hotbar; kills build charges.', ring0:'Ring: works passively while worn.', ring1:'Ring: works passively while worn.', stow:'Ranged: a bow here shoots anything out of reach, with no swapping.'};
  if(!it) return '<div class="nm">'+(key==='off' && player.twoHanded ? 'Both hands on the '+player.weapon.name : 'Empty')+'</div><div class="hint">'+empty[key]+'</div>';
  if(key==='main' || key==='stow') return weaponCard(it, key==='main');
  if(key==='armor') return armorCard(it, true);
  if(key==='amulet' || key==='ring0' || key==='ring1') return trinketCard(it);
  return bagCard({kind:'off', data:it}) + (player.block?'<div class="row"><span>Block</span><b>'+Math.round(player.block*100)+'%</b></div>':'') + (player.parry?'<div class="row"><span>Parry</span><b>'+Math.round(player.parry*100)+'%</b></div>':'');
}
/* 2026-09-21: a finger cannot drag, so on touch a light weapon - the one kind of bag item with two homes - is placed
   in two taps: tap it, then tap Main hand or Off hand. Everything else still goes to its natural slot on one tap. */
var placingBag=-1;
function wireEquip(root){
  placingBag=-1;
  /* the doll box is wider now, so the figure is drawn bigger to match (2026-09-17) */
  if(typeof paintDoll==='function') paintDoll($('dollArt'), 210); else paintArt($('dollArt'),'cast',player.look,210);
  root.querySelectorAll('[data-mote]').forEach(function(e){ paintArt(e,'items','mote-'+e.getAttribute('data-mote'),16); });
  root.querySelectorAll('[data-kicon]').forEach(function(e){ paintArt(e,'items',e.getAttribute('data-kicon'),18); });
  root.querySelectorAll('[data-gicon]').forEach(function(e){ var n=e.getAttribute('data-gicon'); if(n) e.appendChild(iconCanvas(n, 42, '?')); });
  root.querySelectorAll('.gslot[data-slot]').forEach(function(el){
    var key=el.getAttribute('data-slot');
    hoverCard(el, function(){ return slotCard(key); });
    el.onclick=function(){
      hideCard();
      if(placingBag>=0 && (key==='main' || key==='off')){ var pb=placingBag; placingBag=-1; equipFromBag(pb, key); updateUI(); refreshSheet(); return; }
      if(key==='stow'){ if(typeof unequipRanged==='function') unequipRanged(); }
      else if(key==='amulet'){ if(player.amulet) takeOffAmulet(); }
      else if(key==='ring0' || key==='ring1'){ if(slotItem(key)) takeOffRing(key==='ring0'?0:1); }
      updateUI(); refreshSheet();
    };
    if(key==='main' && slotItem('main')) dragSource(el, 'weapons');
    /* 2026-09-20: Justin - an equipped bow could not be put on the hotbar. The ranged slot is a drag source now,
       and the hotbar takes 'ranged' (js/rangedslot.js), where pressing it shoots instead of equipping. */
    if(key==='stow' && slotItem('stow')) dragSource(el, 'ranged');
    dropTarget(el, function(tag){ var bi=bagIndexFromTag(tag); if(bi<0) return; hideCard();
      equipFromBag(bi, key==='stow' ? 'ranged' : key); updateUI(); refreshSheet(); });
  });
  /* 2026-09-20: Justin - "dropping onto the paperdoll should be the same as clicking to equip, instead of just
     dragging onto the equipped item slot". A drop anywhere on the doll - the figure, the gaps between the slots -
     equips the dragged bag item into its natural slot. The slots themselves still take their own drop and stop it
     here, so dropping a light weapon on the off hand still means the off hand. */
  var doll=root.querySelector('.gdoll');
  if(doll) dropTarget(doll, function(tag){
    var bi=bagIndexFromTag(tag); if(bi<0 || !player.bag[bi]) return;
    hideCard(); useBagItem(bi); updateUI(); refreshSheet();
  });
  root.querySelectorAll('.cell[data-b]').forEach(function(cel){
    var bi=+cel.getAttribute('data-b'), it=player.bag[bi];
    cel.style.cursor='pointer';
    cel.appendChild(iconCanvas(iconNameForBag(it), 38, it.icon||'?'));
    var c=it && it.data && (it.kind==='weapon'||it.kind==='armor'||it.kind==='off') && typeof tierCol==='function' ? tierCol(it.data) : null;
    if(c){ cel.style.borderColor=c; }
    if(c && typeof meetsReq==='function' && !meetsReq(it.data)) cel.style.opacity='0.55';
    cel.onclick=function(){
      hideCard();
      var d=it && it.kind==='weapon' && it.data, twoHomes = d && d.light && d.hands!==2 && document.body.classList.contains('touch');
      if(twoHomes){
        if(placingBag===bi){ placingBag=-1; refreshSheet(); return; }
        placingBag=bi; cel.classList.add('over');
        root.querySelectorAll('.gslot[data-slot="main"], .gslot[data-slot="off"]').forEach(function(s){ s.classList.add('over'); });
        var hint=root.querySelector('.tg-hint'); if(hint) hint.textContent='Tap Main hand or Off hand to place the '+gearName(d)+', or tap it again to cancel.';
        return;
      }
      useBagItem(bi); refreshSheet();
    };
    cel.oncontextmenu=function(ev){ ev.preventDefault(); hideCard(); dropBagItem(bi); updateUI(); refreshSheet(); };
    hoverCard(cel, function(){ return bagCard(player.bag[bi]); });
    dragSource(cel, 'bag:'+bi);
  });
}

/* ---------------------------------------------------------------- take over the two panes */
var _panesSheets = panes;
panes = function(){
  if(openSheet==='Char' && $('mChar')){ $('mChar').innerHTML=charHTML(); wireChar($('mChar')); return; }
  if(openSheet==='Equip' && $('mEquip')){ $('mEquip').innerHTML=equipHTML(); wireEquip($('mEquip')); return; }
  return _panesSheets();
};


/* the controls sheet is called Options */
if(typeof SHEETS!=='undefined') SHEETS.Help='Options';
(function(){ var tabs=$('tabs'); if(tabs && !tabs.querySelector('[data-p="Help"]')){ var b=document.createElement('button'); b.setAttribute('data-p','Help'); b.textContent='Options'; tabs.appendChild(b); } })();
