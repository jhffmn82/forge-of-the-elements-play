/* Read-only item views. Cards normalize a copy, never an equipped item. */
function gearCardView(item){return item?tierNormalize(Object.assign({},item)):null;}
function weaponCard(item,worn){
  var w=gearCardView(item);if(!w)return '';
  var h;
  if(w.unid){
    h='<div class="nm">'+gearName(w)+'</div><div class="row"><span>Damage</span><b>?</b></div>'+
      '<div class="row"><span>Hands</span><b>'+(w.hands||1)+'</b></div>'+(w.range?'<div class="row"><span>Range</span><b>'+w.range+'</b></div>':'')+unidHint(w);
  }else{
    var plus=itemPlus(w);
    h='<div class="nm">'+gearName(w)+'</div>'+
      '<div class="row"><span>Damage</span><b>'+(w.dmg[0]+plus)+'&ndash;'+(w.dmg[1]+plus)+'</b></div>'+
      '<div class="row"><span>Accuracy</span><b>'+(w.acc>=0?'+':'')+(w.acc||0)+'</b></div>'+
      '<div class="row"><span>Hands</span><b>'+(w.hands||1)+'</b></div>'+
      (w.range?'<div class="row"><span>Range</span><b>'+(w.range+(player.rangeBonus||0))+'</b></div>':'')+
      (w.enchant?'<div class="row"><span>Enchant</span><b style="color:'+AFF_COL[w.enchant]+'">'+cap(w.enchant)+'</b></div><div class="hint">'+enchantLive('weapon',w.enchant)+'</div>':'')+
      (w.divine?'<div class="row"><span>Invoke &amp; prayer strength</span><b>+'+Math.round(w.divine*gearPassiveBonus()*100)+'%</b></div>':'')+
      (w.note?'<div class="hint">'+w.note+'</div>':'')+focusRows(w)+
      (w.cursed?'<div class="hint" style="color:#D0605A">Cursed: it will not leave your hand until the curse is broken.</div>':'');
  }
  return tierTint(h,w)+(worn?'':reqRow(w));
}
function armorCard(item,worn){
  var a=gearCardView(item);if(!a)return '';
  var h;
  if(a.unid)h='<div class="nm">'+gearName(a)+'</div><div class="row"><span>Armor</span><b>?</b></div><div class="row"><span>Evasion</span><b>'+(a.eva||0)+'</b></div>'+unidHint(a);
  else{
    h='<div class="nm">'+gearName(a)+'</div>'+
      '<div class="row"><span>Armor</span><b>'+(a.armor+itemPlus(a))+'</b></div>'+
      '<div class="row"><span>Evasion</span><b>'+((a.eva||0)>=0?'+':'')+(a.eva||0)+'</b></div>'+
      (a.enchant?'<div class="row"><span>Enchant</span><b style="color:'+AFF_COL[a.enchant]+'">'+cap(a.enchant)+'</b></div><div class="hint">'+enchantLive('armor',a.enchant)+'</div>':'')+
      '<div class="hint">'+(a.note||'')+'</div>'+(a.cursed?'<div class="hint" style="color:#D0605A">Cursed: you cannot take it off until the curse is broken.</div>':'');
    if(itemKey(a)==='robe')h+='<div class="row"><span>Spell damage</span><b>+'+Math.round(robeSpell(a)*gearPassiveBonus()*100)+'%</b></div><div class="row"><span>Max mana</span><b>+'+Math.round(TIER_ROBE.mana[tierNum(a)]*gearPassiveBonus()*100)+'%</b></div>';
  }
  return tierTint(h,a)+(worn?'':reqRow(a));
}
function offhandCard(item){
  var d=gearCardView(item),h='';if(!d)return h;
  if(!d.unid&&focusKey(d))h='<div class="nm">'+gearName(d)+'</div>'+focusRows(d)+(d.cursed?'<div class="hint" style="color:#D0605A">Cursed.</div>':'');
  else if(d.unid||d.cursed)h='<div class="nm">'+gearName(d)+'</div><div class="hint">'+(d.unid?'':d.note||'')+'</div>'+unidHint(d)+(d.cursed&&!d.unid?'<div class="hint" style="color:#D0605A">Cursed.</div>':'');
  else h=d.weapon?weaponCard(d)+'<div class="hint">Off-hand strike: 60% damage.</div>':'<div class="nm">'+gearName(d)+'</div><div class="hint">'+(d.note||'')+'</div>';
  if(d.enchant&&!d.unid){
    var slot=d.block>0?'shield':(d.icon||'').replace(/^item-/,'');
    if(ENCHANT_TEXT[slot])h+='<div class="row"><span>Infusion</span><b style="color:'+AFF_COL[d.enchant]+'">'+cap(d.enchant)+'</b></div><div class="hint">'+enchantLive(slot,d.enchant)+'</div>';
  }
  h=tierTint(h,d);
  if(!d.unid){
    var key=itemKey(d);
    if(TIER_BLOCK[key])h+='<div class="row"><span>Block</span><b>'+Math.round((d.block+TIER_BLOCK.per*(d.plus||0))*100)+'%</b></div>';
    if(key==='tome')h+='<div class="row"><span>Max mana</span><b>+'+Math.round(d.manaPct*gearPassiveBonus()*100)+'%</b></div>';
    if(key==='holy')h+='<div class="row"><span>Invoke &amp; prayer strength</span><b>+'+Math.round(d.divine*gearPassiveBonus()*100)+'%</b></div><div class="row"><span>Buff duration</span><b>+'+Math.round(holyDurationPct(d)*100)+'%</b></div>';
    if(d.kind==='off'&&d.weapon)h+='<div class="row"><span>Off-hand strike</span><b>60% damage, own procs</b></div>';
  }
  return h+reqRow(d);
}
function trinketCard(item){
  if(!item)return '';
  if(item.kind==='ring'){
    var known=!item.unid||RUN.ringKnown[item.ring];
    return '<div class="nm">'+gearName(item)+'</div>'+(known?'<div class="hint">'+RINGS[item.ring].desc+'</div>':'')+
      (!item.unid?'<div class="row"><span>Effect</span><b'+(item.cursed?' style="color:#D0605A"':'')+'>'+ringLine(item)+'</b></div>':'')+
      (item.cursed&&!item.unid?'<div class="hint" style="color:#D0605A">Cursed: it will not come off until the curse is broken.</div>':'')+unidHint(item);
  }
  if(!amuletOk(item))return '<div class="nm">'+gearName(item)+'</div><div class="hint">This amulet has lost its power.</div>';
  var state=FoteGear.amuletState(item,amuletKillsNeeded(item)),cap=amuletCap(item),knownAmulet=!item.unid||RUN.amuletKnown[item.amulet];
  return '<div class="nm">'+gearName(item)+'</div>'+(knownAmulet?'<div class="hint">'+AMULETS[item.amulet].desc+'</div><div class="row"><span>Kills per charge</span><b>'+(item.unid?'?':amuletKillsNeeded(item))+'</b></div>':'')+
    '<div class="row"><span>Charges</span><b>'+state.charges+' / '+cap+'</b></div>'+
    (state.charges<cap&&!item.unid?'<div class="row"><span>Next charge</span><b>'+(amuletKillsNeeded(item)-(state.progress||0))+' more kills</b></div>':'')+
    (item.cursed&&!item.unid?'<div class="hint" style="color:#D0605A">Cursed: charges build 30% slower, every use costs 10% of your current HP, and it will not come off.</div>':'')+unidHint(item)+
    '<div class="hint">Holds '+cap+' charge'+(cap>1?'s':'')+' at level '+state.level+'; using it often raises its level (up to 3). Kills build charges; elites and bosses count 3.</div>';
}
function bagCard(entry){
  if(!entry)return '';
  if(entry.kind==='weapon')return weaponCard(entry.data);
  if(entry.kind==='armor')return armorCard(entry.data);
  if(entry.kind==='off')return offhandCard(entry.data);
  if(entry.kind==='ring'||entry.kind==='amulet')return trinketCard(entry.data);
  if(entry.kind==='sigil'){var known=sigilKnown[entry.data.use];return '<div class="nm">'+entry.name+'</div><div class="hint">'+(known?SIGILS[entry.data.use].desc:'Unidentified.')+'</div>';}
  if(entry.kind==='food'){var f=FOODS[entry.data.food];return '<div class="nm">'+f.name+'</div><div class="hint">'+(f.desc?f.desc+' ':'')+'Restores '+f.nutrition+' hunger'+(f.heal?', heals '+Math.round(f.heal*100)+'%':'')+'.</div>';}
  return '<div class="nm">'+entry.name+'</div>';
}
