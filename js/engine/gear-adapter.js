/* Item creation and charge progression have one owner. */
function ringPower(item){return FoteGear.ringPower(item);}
function amuletCap(item){return FoteGear.amuletCapacity(item);}
function amuletKillsNeeded(item){return FoteGear.amuletKills(item,AMULETS[item.amulet].kills);}
function amuletSync(item){Object.assign(item,FoteGear.amuletState(item,amuletKillsNeeded(item)));}
function makeRing(type,cursed){
  ensureTrinketLooks();type=type||pick(Object.keys(RINGS));
  var plus=cursed?-ri(1,3):(rng()<.7?0:1);
  return {kind:'ring',ring:type,name:RINGS[type].name,plus:plus,cursed:!!cursed,unid:true,icon:'item-ring-'+RUN.ringLook[type]};
}
function makeAmulet(type,cursed){
  ensureTrinketLooks();
  if(!type){
    RUN.amuletsSeen=RUN.amuletsSeen||{};
    var all=Object.keys(AMULETS),fresh=all.filter(function(key){return !RUN.amuletsSeen[key];});
    type=pick(fresh.length?fresh:all);RUN.amuletsSeen[type]=1;
  }
  // Keep the established seeded loot stream; amulet upgrades now come from use.
  if(!cursed)rng();
  return {kind:'amulet',amulet:type,name:AMULETS[type].name,plus:0,level:1,cursed:!!cursed,unid:true,charges:1,progress:0,charge:0,uses:0,icon:'item-amulet-'+RUN.amuletLook[type]};
}
function transmutationKind(item,hint){
  if(!item||item.unarmed||item===EMPTY_OFF)return null;
  if(item.ring&&RINGS[item.ring])return 'ring';
  if(item.amulet&&AMULETS[item.amulet])return 'amulet';
  if(item.weapon||item.kind==='weapon')return 'weapon';
  return ['armor','off'].indexOf(item.kind||hint)>=0?item.kind||hint:null;
}
function transmutationCatalog(kind){return {weapon:WEAPONS,armor:ARMORS,off:OFFHANDS,ring:RINGS,amulet:AMULETS}[kind]||{};}
function transmutationKey(item,kind){
  if(kind==='ring')return item.ring;if(kind==='amulet')return item.amulet;
  var table=transmutationCatalog(kind),key=item.key;
  if(key&&table[key])return key;
  return Object.keys(table).find(function(k){return table[k].name===item.name;})||Object.keys(table).find(function(k){return table[k].icon===item.icon;})||null;
}
function transmutationKeys(item,kind){
  var key=transmutationKey(item,kind);if(!key)return [];
  return Object.keys(transmutationCatalog(kind)).filter(function(k){return k!==key;});
}
function transmutedGear(item,kind,key){
  var table=transmutationCatalog(kind),base=table[key];if(!base)return null;
  var source=Object.assign({},item);source[kind==='ring'?'ring':kind==='amulet'?'amulet':'key']=transmutationKey(item,kind);
  if(kind==='ring'||kind==='amulet'){
    var looks=kind==='ring'?RUN.ringLook:RUN.amuletLook;
    base={name:base.name,icon:'item-'+kind+'-'+looks[key]};
  }
  var next=FoteGear.transmute(source,kind,key,base);if(!next)return null;
  if(kind==='amulet'){
    // Missing legacy charge fields describe an already-depleted item here;
    // transformation never manufactures a charge or resets recharge progress.
    if(next.charges===undefined)next.charges=(item.charge||0)>0?0:1;
    if(next.progress===undefined)next.progress=0;
    amuletSync(next);
  }else if(kind!=='ring')tierNormalize(next);
  return next;
}
function rollEquipmentCandidate(){
  var roll=rng(),gear;
  if(roll<.5){var w=pick(['sword','dagger','mace','longsword','axe','bow','staff','wand','spear','censer']);gear={kind:'weapon',it:clone(WEAPONS[w])};}
  else if(roll<.8){var a=pick(['leather','chain','plate','robe']);gear={kind:'armor',it:clone(ARMORS[a])};}
  else {var o=pick(['buckler','kite','orb','tome','holy']);gear={kind:'off',it:clone(OFFHANDS[o])};}
  rng(); // Reserved quality draw from existing seeds. Final quality is rolled after selection.
  gear.it.plus=rollEnhancement(0);
  if(gear.kind!=='off'&&rng()<.15+floorNo*.03)gear.it.enchant=pick(ELEMENTS);
  return gear;
}
function randomGear(){
  var gear;
  for(var attempt=0;attempt<20;attempt++){
    var roll=rng(),cursed=rng()<.15;
    // Retain rejected trinket draws and their discovery ledger for save-seed compatibility.
    if(roll<.12){makeRing(null,cursed);continue;}
    if(roll<.20){makeAmulet(null,cursed);continue;}
    gear=rollEquipmentCandidate();gear.it.unid=true;
    if(cursed){gear.it.cursed=true;gear.it.plus=-ri(1,3);delete gear.it.enchant;if(gear.kind==='off')gear.it.cursedOff=true;}
    break;
  }
  if(!gear)gear=rollEquipmentCandidate();
  gear.it.tier=rollTier();tierNormalize(gear.it);return gear;
}
function spendAmulet(item){
  amuletSync(item);item.charges=Math.max(0,item.charges-1);amuletSync(item);
  var first=item.unid&&!RUN.amuletKnown[item.amulet];RUN.amuletKnown[item.amulet]=true;
  item.uses=(item.uses||0)+1;useCount(item,'amulet');refreshBagNames();
  if(first)log('It is an <b>'+AMULETS[item.amulet].name+'</b>!','c-kill');
  if(item.cursed){var cost=Math.max(1,Math.round(player.hp*.10));dealDirectDamage(player,cost,'dark',null,{tags:['cost','curse']});floatText(player.x,player.y,String(cost),'dark');log('The cursed amulet drinks '+cost+' HP.','c-you');}
  var level=item.level||1;
  if(level<3&&item.uses>=AMULET_LEVEL_USES[level]){
    item.level=level+1;amuletSync(item);refreshBagNames();
    log('Your <b>'+gearName(item)+'</b> has grown used to you: it now holds '+item.level+' charges.','c-kill');sfx('piety-rank');
  }
}
function gearName(item){
  if(!item)return 'nothing';
  if(item.kind==='ring'){
    ensureTrinketLooks();
    if(item.unid&&!RUN.ringKnown[item.ring])return cap(RUN.ringLook[item.ring])+' ring';
    if(item.unid)return item.name+' ?';
    return item.name+' '+((item.plus||0)>=0?'+':'')+(item.plus||0)+(item.cursed?' (cursed)':'');
  }
  if(item.kind==='amulet'){
    ensureTrinketLooks();
    if(item.unid&&!RUN.amuletKnown[item.amulet])return cap(RUN.amuletLook[item.amulet])+' amulet';
    if(item.unid)return item.name+' ?';
    if(AMULETS[item.amulet])return item.name+' ('+['I','II','III'][Math.max(0,Math.min(2,(item.level||1)-1))]+')'+(item.cursed?' (cursed)':'');
    return item.name+(item.plus?' +'+item.plus:'')+(item.cursed?' (cursed)':'');
  }
  var key=itemKey(Object.assign({},item)),prefix=key?(TIER_NAME[tierNum(item)]||''):(item.tier&&item.tier!=='Rusty'?item.tier:'');
  var name=(prefix?prefix+' ':'')+item.name;
  if(item.unid)return name+' ?';
  if(item.plus)name+=item.plus<0?' −'+Math.abs(item.plus):' +'+item.plus;
  if(item.enchant)name+=' of '+cap(item.enchant);
  return name+(item.cursed?' (cursed)':'');
}
function itemLabel(item){
  if(item.kind==='core')return 'the '+item.name;
  if(item.kind==='heart')return 'a heart (+25% HP)';
  if(item.kind==='managlobe')return 'a mana globe (+25% mana)';
  if(item.kind==='essence')return Math.round(item.n*essenceMult())+' essence';
  if(item.kind==='mote')return 'a '+item.el+' mote';
  if(item.kind==='key')return 'an '+item.key+' key';
  if(item.kind==='food')return FOODS[item.food].name;
  if(item.kind==='sigil')return sigilName(item.use);
  return gearName(item.it);
}
function offKind(){
  var item=player.twoHanded?null:player.off;
  if(!item||item===EMPTY_OFF||item.joke)return null;
  var key=(item.icon||'').replace(/^item-/,'');
  if(key==='orb'||key==='tome'||key==='holy')return key;
  return item.block>0||key==='buckler'||key==='kite'?'shield':null;
}
