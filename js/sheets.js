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
    '.prow{display:grid;grid-template-columns:22px minmax(0,1fr);gap:8px;align-items:baseline;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px}',
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
    '.gearwrap .invgrid{grid-template-columns:repeat(5,minmax(0,1fr));gap:0}',
    '.gearwrap .invgrid .cell{border-radius:0}',
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
var RES_TYPES = [['fire','Fire'],['ice','Frost'],['lightning','Lightning'],['poison','Poison'],['light','Light'],['dark','Shadow'],['magic','Magic']];
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
  var range=weaponDamageRange(1,!((player.weapon&&player.weapon.range)>1));
  var fire = (player.aff && player.aff.fire) || 0;
  return [range[0]+fire,range[1]+fire];
}
function paintIcon(el, name, size){
  if(!el || !name) return;
  if(objArt('icons', name)) paintArt(el, 'icons', name, size);
  else if(objArt('items', name)) paintArt(el, 'items', name, size);
}

/* ---------------------------------------------------------------- Character */
function charHTML(){
  var h='<div class="cols3">';
  /* left: who, attributes, affinity, combat, resistances */
  h+='<div><h2 class="head">'+player.name+'</h2><div class="who">'+player.who+' &middot; Level '+player.level+
     (player.points?' &middot; <span style="color:var(--gold)">'+player.points+' unspent</span>':'')+'</div>';
  h+='<div class="sec">Attributes</div><div class="grid4">'+statBox('Might',player.stats.mig,'mig')+statBox('Agility',player.stats.agi,'agi')+statBox('Vitality',player.stats.vit,'vit')+statBox('Focus',player.stats.foc,'foc')+'</div>';
  var pips=Object.keys(player.aff).filter(function(e){ return player.aff[e]>0; }).map(function(e){
    var n=player.aff[e], dots=''; for(var i=0;i<6;i++) dots+='<span class="pip" style="'+(i<n?'background:'+AFF_COL[e]+';border-color:'+AFF_COL[e]:'')+(i===5?';opacity:.5':'')+'"></span>';
    return '<div class="aff"><span class="nm">'+cap(e)+'</span><span class="pips">'+dots+'</span><span style="color:var(--dim)">'+n+'</span></div>';
  }).join('');
  h+='<div class="sec">Affinity ('+totalAffinity()+' / '+affinityCap()+')</div>'+(pips || '<div class="c-info" style="font-size:11.5px">None yet. Carry a mote to the Elemental Forge.</div>');
  var hr=hitRange();
  h+='<div class="sec">Combat</div>'+kv([['HP',Math.round(player.hp)+' / '+player.maxhp+(playerShield()?' <span style="color:#9FD8FF">+'+playerShield()+'</span>':'')],['Mana',Math.floor(player.mp)+' / '+player.maxmp],
    ['Damage per hit',hr[0]+'-'+hr[1]],['Crit',Math.round(player.crit*100)+'%'],['Crit damage','&times;'+criticalMultiplier().toFixed(2)],['Accuracy',player.acc],['Evasion',evaOf(player)],['Armor',player.armor],
    ['Block',Math.round(player.block*100)+'%'],['Parry',Math.round(player.parry*100)+'%'],['Spell power','&times;'+spellPower({}).toFixed(2)],['Divine Power','&times;'+divineStrength().toFixed(2)],['Range',player.range],
    ['Attack speed',playerSpeedPercent('attack')],['Movement speed',playerSpeedPercent('move')],['XP',player.xp+' / '+player.xpNext]]);
  h+='<div class="sec">Resistances</div>'+resHTML()+'</div>';

  /* middle: activated abilities, prayers, amulet */
  h+='<div><div class="sec">Abilities <span style="text-transform:none;letter-spacing:0">(drag onto the hotbar)</span></div>';
  if(!player.abilities.length) h+='<div class="c-info" style="font-size:11.5px">No active abilities yet.</div>';
  player.abilities.forEach(function(k){
    var A=ABILITIES[k]; if(!A) return;
    h+='<div class="arow" data-ab="'+k+'" draggable="true"><span class="ic" data-icon="'+(A.icon||'')+'"></span><div><div class="n">'+A.name+'</div>'+actionDetailsHTML(abilityDetails(A,k))+'</div></div>';
  });
  if(player.god){
    var g=GODS[player.god];
    h+='<div class="sec">Abilities &middot; <span style="color:'+g.color+';text-transform:none;letter-spacing:0">'+g.name+'</span></div>';
    (g.prayers||[]).forEach(function(pid){
      var P=PRAYERS[pid]; if(!P) return; var ok=godRank()>=P.rank; if(!ok) return;
      h+='<div class="arow'+(ok?'':' locked')+'" data-pr="'+pid+'"'+(ok?' draggable="true"':'')+'><span class="ic" data-icon="'+prayerIcon(pid)+'"></span><div><div class="n">'+P.name+'</div>'+actionDetailsHTML(prayerDetails(P,pid))+'</div></div>';
    });
  }
  if(player.amulet && typeof AMULETS!=='undefined' && AMULETS[player.amulet.amulet]){
    var a=player.amulet, known=!a.unid || (RUN.amuletKnown||{})[a.amulet];
    h+='<div class="sec">Amulet</div><div class="arow"><span class="ic" data-icon="'+a.icon+'"></span><span><span class="n">'+gearName(a)+'</span>'+(known?actionDetailsHTML(amuletDetails(a)):'<div class="d">Unidentified amulet.</div>')+'</span><span class="c" style="color:var(--gold)">'+(a.charges!==undefined?a.charges+' charges':'')+'</span></div>';
  }
  h+='</div>';

  /* right: every passive, by source */
  h+='<div>';
  h+='<div class="sec">Class &amp; race</div>';
  h+='<div class="prow"><span class="k">&#9670;</span><span><span class="n">'+CLASSES[player.cls].name+'</span><div class="d">'+CLASSES[player.cls].passive+'</div></span></div>';
  h+='<div class="prow"><span class="k">&#9670;</span><span><span class="n">'+RACES[player.race].name+'</span><div class="d">'+RACES[player.race].blurb+'</div></span></div>';
  var earned=[]; for(var sk0 in PASSIVES) PASSIVES[sk0].forEach(function(p){ if(player.stats[sk0]>=p.at) earned.push(p); });
  if(earned.length) h+='<div class="sec">Attributes</div>';
  for(var sk in PASSIVES){
    PASSIVES[sk].forEach(function(p){
      var on=player.stats[sk]>=p.at; if(!on) return;
      h+='<div class="prow"><span class="k">'+p.at+'</span><span><span class="n">'+p.name+'</span><div class="d">'+p.d+'</div></span></div>';
    });
  }
  var els=Object.keys(player.aff).filter(function(e){ return player.aff[e]>0; });
  if(els.length){
    h+='<div class="sec">Elements</div>';
    els.forEach(function(e){
      var n=player.aff[e];
      h+='<div class="prow"><span class="k" style="color:'+AFF_COL[e]+'">'+n+'</span><span><span class="n">'+cap(e)+' '+n+'</span><div class="d">'+(typeof t1Text==='function' ? t1Text(e,n) : (T1_TEXT[e]||''))+'</div></span></div>';   /* 2026-09-23 (Justin): the live total at this affinity */
      [3,6].forEach(function(r){
        if(typeof RANK_TEXT==='undefined' || !RANK_TEXT[r][e]) return;
        var on=n>=r; if(!on) return;
        h+='<div class="prow"><span class="k" style="color:'+AFF_COL[e]+'">'+r+'</span><span><span class="n">'+cap(e)+' '+r+' mastery</span><div class="d">'+(typeof rankLive==='function' ? rankLive(r,e) : RANK_TEXT[r][e])+'</div></span></div>';
      });
    });
    if(typeof COMBOS!=='undefined') combosHeld().forEach(function(k){
      var C=COMBOS[k], pr=k.split('/');
      h+='<div class="prow"><span class="k" style="color:'+AFF_COL[pr[0]]+'">&#10022;</span><span><span class="n">'+C.name+'</span><div class="d">'+C.d+' ('+cap(pr[0])+' 3 / '+cap(pr[1])+' 2)</div></span></div>';
    });
  }
  if(player.god){
    var G=GODS[player.god], rk=godRank();
    h+='<div class="sec">Faith &middot; rank '+rk+'</div>';
    G.boons.forEach(function(b, i){
      var at=BOON_RANKS[i]||i+1, on=rk>=at, parts=b.split(': '), nm=parts.length>1?parts.shift():'Boon'; if(!on) return;
      h+='<div class="prow"><span class="k" style="color:'+G.color+'">'+at+'</span><span><span class="n">'+nm+'</span><div class="d">'+parts.join(': ')+'</div></span></div>';
    });
  }
  var gear=[];
  (player.rings||[]).forEach(function(r){ if(r) gear.push([gearName(r), ringSummary(r)]); });
  var w=player.weapon;
  if(w && !w.unarmed && (w.note || w.enchant)) gear.push([gearName(w), (w.note||'')+(w.enchant && !w.unid ? ' &middot; '+enchantLive('weapon',w.enchant) : '')]);
  var ar=player.armorItem;
  if(ar && ar.enchant && !ar.unid) gear.push([gearName(ar), enchantLive('armor',ar.enchant)]);
  var of=player.off;
  if(of && of!==EMPTY_OFF && of.enchant && typeof offKind==='function' && offKind() && ENCHANT_TEXT[offKind()]) gear.push([gearName(of), (typeof enchantLive==='function' ? enchantLive(offKind(), of.enchant) : ENCHANT_TEXT[offKind()][of.enchant])]);
  if(gear.length){
    h+='<div class="sec">Gear</div>';
    gear.forEach(function(g){ h+='<div class="prow"><span class="k">&#9679;</span><span><span class="n">'+g[0]+'</span><div class="d">'+g[1]+'</div></span></div>'; });
  }
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
/* Desktop and touch inventory share the same live resource counts. Zeroes stay
 * visible here because the minimal HUD leaves resources in the inventory. */
function equipResourcesHTML(sectionClass){
  sectionClass=sectionClass||'sec';
  function count(n){return Math.round(n||0).toLocaleString('en-US');}
  var motes=ELEMENTS.map(function(m){return '<span class="mote"><span class="mart" data-mote="'+m+'"></span>'+cap(m)+' &times;'+count(player.motes&&player.motes[m])+'</span>';}).join('');
  var keys=[['iron','Iron key','item-key-iron'],['crystal','Crystal key','item-key-crystal']].map(function(k){
    return '<span class="mote keychip"><span class="kart" data-kicon="'+k[2]+'"></span>'+k[1]+' &times;'+count(player.keys&&player.keys[k[0]])+'</span>';
  }).join('');
  return '<div class="'+sectionClass+'">Keys</div><div class="pouch">'+keys+'</div>'+
    '<div class="'+sectionClass+'">Pouch &middot; '+count(player.essence)+' essence</div><div class="pouch">'+motes+'</div>';
}
function equipHTML(){
  var w=player.weapon, off=player.twoHanded?null:player.off, ar=player.armorItem, r=player.rings||[null,null], stow=player.ranged;
  var hr=hitRange(), h='<div class="gearwrap">';
  /* left: totals */
  h+='<div><div class="sec">Offense</div>'+kv([['Damage per hit',hr[0]+'-'+hr[1]],['Crit',Math.round(player.crit*100)+'%'],['Crit damage','&times;'+criticalMultiplier().toFixed(2)],['Accuracy',player.acc],['Range',player.range],['Attack speed',playerSpeedPercent('attack')],['Movement speed',playerSpeedPercent('move')],['Spell power','&times;'+spellPower({}).toFixed(2)],['Divine Power','&times;'+divineStrength().toFixed(2)]]);
  h+='<div class="sec">Defense</div>'+kv([['HP',Math.round(player.hp)+' / '+player.maxhp],['Shield',playerShield()],['Armor',player.armor],['Evasion',evaOf(player)],['Block',Math.round(player.block*100)+'%'],['Parry',Math.round(player.parry*100)+'%'],['Mana',Math.floor(player.mp)+' / '+player.maxmp],['Stealth',Math.round(stealthScore()*100)+'%']]);
  h+='<div class="sec">Attributes</div><div class="res">'+['mig','agi','vit','foc'].map(function(k){ return '<span>'+STAT_LABEL[k]+'<b>'+player.stats[k]+'</b></span>'; }).join('')+'</div>';
  h+='<div class="sec">Resistances</div>'+resHTML()+'</div>';
  /* middle: doll and slots */
  h+='<div class="gcol-worn"><div class="sec">Worn <span style="text-transform:none;letter-spacing:0">(hover for details, drag from the bag to equip)</span></div><div class="gdoll">'+
     slotHTML('main','Main hand', w && !w.unarmed ? w : null, '&#9876;')+'<div class="art" id="dollArt"></div>'+slotHTML('off', player.twoHanded?'Both hands':'Off hand', off, '&#9960;')+
     slotHTML('armor','Armor', ar, '&#9960;')+slotHTML('amulet','Amulet', player.amulet, '&#9765;')+
     slotHTML('ring0','Ring', r[0], '&#9675;')+slotHTML('ring1','Ring', r[1], '&#9675;')+'</div>'+
     '<div class="stowrow">'+slotHTML('stow','Ranged', stow, '&#127993;')+'<span class="c-info" style="font-size:11px">'+(stow?'Fires by itself at anything more than a tile away.':'A bow here fires by itself at anything more than a tile away.')+'</span></div></div>';
  /* right: bag and pouch */
  var cells=player.bag.map(function(it,idx){ return '<div class="cell" data-b="'+idx+'" draggable="true">'+(it.n>1?'<b>'+it.n+'</b>':'')+'</div>'; });
  while(cells.length<BAG_MAX) cells.push('<div class="cell empty"></div>');
  h+='<div><div class="sec">Bag ('+player.bag.length+' / '+BAG_MAX+')</div><div class="invgrid">'+cells.join('')+'</div>'+
     equipResourcesHTML()+'</div>';
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
  var empty={main:'Main hand: drag a weapon here.', off:'Off hand: a shield, focus or light weapon.', armor:'Armor: drag body armor here.', amulet:'Amulet: activated from the hotbar; kills build charges.', ring0:'Ring: works passively while worn.', ring1:'Ring: works passively while worn.', stow:'Ranged: a bow here shoots anything out of reach.'};
  if(!it) return '<div class="nm">'+(key==='off' && player.twoHanded ? 'Both hands on the '+player.weapon.name : 'Empty')+'</div><div class="hint">'+empty[key]+'</div>';
  if(key==='main' || key==='stow') return weaponCard(it, key==='main');
  if(key==='armor') return armorCard(it, true);
  if(key==='amulet' || key==='ring0' || key==='ring1') return trinketCard(it);
  /* 2026-09-22 (Justin): the card showed Block twice - the shield's own (from bagCard) and the wearer's total with Might
     and the Fighter's bonus - under the same label. The total is named for what it is. */
  return bagCard({kind:'off', data:it}) + (player.block?'<div class="row"><span>Your block</span><b>'+Math.round(player.block*100)+'%</b></div>':'') + (player.parry?'<div class="row"><span>Your parry</span><b>'+Math.round(player.parry*100)+'%</b></div>':'');
}
function wireEquip(root){
  /* the doll box is wider now, so the figure is drawn bigger to match (2026-09-17) */
  if(typeof paintDoll==='function') paintDoll($('dollArt'), 210); else paintArt($('dollArt'),'cast',playerCastLook(),210);
  root.querySelectorAll('[data-mote]').forEach(function(e){ paintArt(e,'items','mote-'+e.getAttribute('data-mote'),16); });
  root.querySelectorAll('[data-kicon]').forEach(function(e){ paintArt(e,'items',e.getAttribute('data-kicon'),18); });
  root.querySelectorAll('[data-gicon]').forEach(function(e){ var n=e.getAttribute('data-gicon'); if(n) e.appendChild(iconCanvas(n, 42, '?')); });
  root.querySelectorAll('.gslot[data-slot]').forEach(function(el){
    var key=el.getAttribute('data-slot');
    hoverCard(el, function(){ return slotCard(key); });
    el.onclick=function(){
      hideCard();
      if(key==='stow'){ if(typeof unequipRanged==='function') unequipRanged(); }
      else if(key==='amulet'){ if(player.amulet) takeOffAmulet(); }
      else if(key==='ring0' || key==='ring1'){ if(slotItem(key)) takeOffRing(key==='ring0'?0:1); }
      updateUI(); refreshSheet();
    };
    if(key==='main' && slotItem('main')) dragSource(el, 'weapons');
    /* 2026-09-20: Justin - an equipped bow could not be put on the hotbar. The ranged slot is a drag source now,
       and the hotbar takes 'ranged' (js/rangedslot.js), where pressing it shoots instead of equipping. */
    if(key==='stow' && slotItem('stow')) dragSource(el, 'ranged');
    /* 2026-09-27: the worn amulet drags onto any hotbar slot (the hotbar already takes 'amulet'; touchui.js does the same by finger) */
    if(key==='amulet' && slotItem('amulet')) dragSource(el, 'amulet');
    if(slotItem(key) && ['main','stow','amulet'].indexOf(key)<0) dragSource(el, 'worn:'+key);
    dropTarget(el, function(tag){ var bi=bagIndexFromTag(tag); if(bi<0) return; hideCard();
      equipFromBag(bi, key==='stow' ? 'ranged' : key); updateUI(); refreshSheet(); });
  });
  /* 2026-09-20: Justin - "dropping onto the paperdoll should be the same as clicking to equip, instead of just
     dragging onto the equipped item slot". A drop anywhere on the doll - the figure, the gaps between the slots -
     equips the dragged bag item into its natural slot. The slots themselves still take their own drop and stop it
     here, so dropping a light weapon on the off hand still means the off hand. */
  var bag=root.querySelector('.invgrid, .tg-cells');
  if(bag) dropTarget(bag, function(tag){
    var key=tag==='weapons'?'main':tag==='ranged'?'stow':tag==='amulet'?'amulet':tag.indexOf('worn:')===0?tag.slice(5):null;
    if(key) takeOffSlot(key);
  });
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
    cel.onclick=function(){ hideCard(); useBagItem(bi); refreshSheet(); };
    cel.oncontextmenu=function(ev){ ev.preventDefault(); dropFromBag(bi); };
    hoverCard(cel, function(){ return bagCard(player.bag[bi]); });
    dragSource(cel, 'bag:'+bi);
  });
}
/* the bag's Drop: right-click, or a drag let go outside the window (game.js, touchui.js) */
function dropFromBag(bi){ hideCard(); dropBagItem(bi); updateUI(); refreshSheet(); }
function takeOffSlot(key){
  hideCard();
  var slot=key==='stow'?'ranged':key;
  if(['main','off','armor','amulet','ring0','ring1','ranged'].indexOf(slot)<0) return false;
  var result=removeEquipment(slot,slot!=='ranged');
  updateUI();refreshSheet();return result;
}

/* ---------------------------------------------------------------- take over the two panes */


/* the controls sheet is called Options */
if(typeof SHEETS!=='undefined') SHEETS.Help='Options';
(function(){ var tabs=$('tabs'); if(tabs && !tabs.querySelector('[data-p="Help"]')){ var b=document.createElement('button'); b.setAttribute('data-p','Help'); b.textContent='Options'; tabs.appendChild(b); } })();
