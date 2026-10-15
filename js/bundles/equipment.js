;
/* js/engine/inventory-adapter.js */
/* Single inventory/equipment command boundary. UI callbacks pass indices or
 * slots; validation and capacity checks precede the mutation and turn commit. */
function inventorySlotPolicy(){return {capacity:BAG_MAX,empty:EMPTY_OFF,ranged:isRangedWeapon,
  normalize:function(item){return tierNormalize(fixNegativePlus(Object.assign({},item)));},
  forbidden:equipmentForbidden,meets:meetsReq};}
function inventoryFailure(plan){
  var messages={missing:'That item is no longer in your bag.',full:'Your bag is full.',slot:'That item does not fit there.',
    'main-slot':'That is not a weapon.','armor-slot':'That is not armor.','ring-slot':'That is not a ring.','amulet-slot':'That is not an amulet.',
    'ranged-slot':'Only a bow goes there.','bow-offhand':'A bow needs both hands. It goes in your ranged slot.',
    'off-slot':'Only a light weapon, shield or focus fits your off hand.','both-hands':'Both hands are on the '+player.weapon.name+'.'};
  if(plan.error==='forbidden')return refuseDivine();
  if(plan.error==='cursed'){cursedBlock(plan.item);return false;}
  if(plan.error==='requirements'){reqBlock(plan.item);return false;}
  log(messages[plan.error]||'That action cannot be completed.','c-info');sfx(plan.error==='full'?'inventory-full':'ui-error');return false;
}
function gearBagIcon(kind){return kind==='weapon'?'⚔':kind==='ring'?'○':kind==='amulet'?'☥':'⛨';}
function addBag(icon,name,extra,onFailure){
  extra=extra||{};var kind=FoteInventory.bagKind(extra.kind,extra.data),isGear=FoteInventory.gear(kind);
  var uid=extra.uid||(!isGear?name:null),existing=uid&&player.bag.find(function(b){return b.uid===uid;});
  if(existing){existing.n++;return existing;}
  // Multi-item pickup reports a shared refusal once after trying every item.
  if(player.bag.length>=BAG_MAX){(onFailure||inventoryFailure)({error:'full'});return null;}
  if(isGear)tierNormalize(fixNegativePlus(extra.data));
  var entry={icon:icon,name:name,n:1,uid:uid||'g'+nextId++,kind:kind,data:extra.data};player.bag.push(entry);
  if(isGear&&typeof FoteJournalEvents!=='undefined')FoteJournalEvents.gear(entry.data,entry.kind);
  if(isGear&&typeof noteMasterwork==='function')noteMasterwork(entry.data);
  return entry;
}
function normalizeLoadedInventory(){
  player.bag.forEach(function(entry){
    if(FoteInventory.gear(entry.kind))tierNormalize(fixNegativePlus(entry.data));
  });
}
function bagEntryFor(it){
  if(FoteInventory.gear(it.kind))return [gearBagIcon(it.kind),gearName(it.it),{kind:it.kind,data:it.it}];
  if(it.kind==='sigil')return ['✦',sigilName(it.use),{kind:'sigil',data:{use:it.use},uid:'sigil:'+it.use}];
  if(it.kind==='food')return ['🍖',FOODS[it.food].name,{kind:'food',data:{food:it.food},uid:'food:'+it.food}];
  return null;
}
function dropBagItem(index){
  if(gameTurns.busy())return false;
  var b=player.bag[index];if(!b)return false;
  var it=FoteInventory.gear(b.kind)?{kind:b.kind,it:b.data}:b.kind==='sigil'?{kind:'sigil',use:b.data.use}:b.kind==='food'?{kind:'food',food:b.data.food}:null;
  if(!it)return false;it.x=player.x;it.y=player.y;items.push(it);consume(index);log('You drop '+itemLabel(it)+'.','c-info');rareRoomFoodDropped(it);offeringGearDropped(it);return true;
}
function commitEquipment(plan){
  var item=plan.item;Object.assign(item,plan.normalized);
  if(plan.offhandWeapon)offHandWeapon(item);
  else if((plan.slot==='main'||plan.slot==='ranged')&&item.weapon){
    item.kind='weapon';delete item.weapon;delete item.block;
    var authored=WEAPONS[itemKey(item)];if(authored&&authored.note)item.note=authored.note;else delete item.note;
  }
  player.bag.splice(plan.index,1);
  if(plan.slot==='main'){player.sets=[item,null];player.activeSet=0;}
  else if(plan.slot==='armor')player.armorItem=item;
  else if(plan.slot.indexOf('ring')===0){if(!player.rings)player.rings=[null,null];player.rings[+plan.slot.slice(-1)]=item;}
  else player[plan.slot]=item;
  if(plan.slot==='ranged')player._rangedHotbarPending=true;
  if(plan.stowOff)player.off=EMPTY_OFF;
  plan.displaced.forEach(function(o){addBag(gearBagIcon(o.kind),gearName(o.item),{kind:o.kind,data:o.item});});
  if(plan.slot==='amulet'&&player.hotbar&&!player.hotbar.some(function(h){return h&&h.type==='amulet';})){
    var index=player.hotbar.findIndex(function(h){return !h;});if(index>=0)player.hotbar[index]={type:'amulet'};
  }
  onPutOn(item);derive(player);refreshBagNames();
  var text=plan.slot==='ranged'?'You sling the <b>'+gearName(item)+'</b> across your back. It answers anything out of reach.':
    plan.slot.indexOf('ring')===0?'You slip on the <b>'+gearName(item)+'</b>.':
    plan.slot==='amulet'?'You fasten the <b>'+gearName(item)+'</b>. Use it from the hotbar.':
    plan.slot==='armor'?'You put on the <b>'+gearName(item)+'</b>.':'You take up the <b>'+gearName(item)+'</b>.';
  log(text,'c-good');sfx(['main','off','ranged'].indexOf(plan.slot)>=0?'equip-weapon':'equip-armor');
  if(plan.stowOff)log('Both hands are on the '+item.name+', so the '+plan.displaced[plan.displaced.length-1].item.name+' goes into your bag.','c-info');
  endTurn();return true;
}
function equipFromBag(index,slot){if(gameTurns.busy())return false;var plan=FoteInventory.planEquip(player,index,slot,inventorySlotPolicy());return plan.error?inventoryFailure(plan):commitEquipment(plan);}
function useBagItem(index){
  if(gameTurns.busy())return false;
  var entry=player.bag[index];if(!entry)return false;
  if(FoteInventory.gear(entry.kind))return equipFromBag(index);
  if(entry.kind==='food')return useBagFood(index);
  if(entry.kind==='sigil')return useBagSigil(index);
  return false;
}
function removeEquipment(slot,spendTurn){
  if(gameTurns.busy())return false;
  var item=FoteInventory.slotItem(player,slot);if(!item||item===EMPTY_OFF||item.unarmed)return false;
  if(FoteInventory.curseBinds(item))return inventoryFailure({error:'cursed',item:item});
  if(player.bag.length>=BAG_MAX)return inventoryFailure({error:'full'});
  var kind=slot==='ranged'||slot==='main'?'weapon':slot.indexOf('ring')===0?'ring':slot;
  if(slot.indexOf('ring')===0)player.rings[+slot.slice(-1)]=null;
  else if(slot==='main')player.sets[0]=FISTS;
  else if(slot==='armor')player.armorItem=null;
  else player[slot]=slot==='off'?EMPTY_OFF:null;
  addBag(gearBagIcon(kind),gearName(item),{kind:kind,data:item});derive(player);
  log('You '+(slot==='ranged'?'unsling':'take off')+' the '+gearName(item)+'.','c-info');if(spendTurn)endTurn();return true;
}
function takeOffRing(slot){return removeEquipment('ring'+slot,true);}
function takeOffAmulet(){return removeEquipment('amulet',true);}
function unequipRanged(){return removeEquipment('ranged',false);}
function breakCurse(item,options){
  var change=FoteInventory.cleanse(item);if(!change)return false;Object.assign(item,change);
  if(typeof FoteJournalEvents!=='undefined')FoteJournalEvents.gear(item);
  tierNormalize(item);
  if(!(options&&options.deferRefresh)){derive(player);refreshBagNames();}
  log('The curse on your <b>'+gearName(item)+'</b> breaks.','c-kill');sfx('puzzle-solved');return true;
}
function cleanseCarriedCurses(){
  var gear=new Set(wornGear().concat(player.sets||[],player.offSets||[]));
  (player.bag||[]).forEach(function(entry){if(entry.data)gear.add(entry.data);});
  var count=0;gear.forEach(function(item){if(breakCurse(item,{deferRefresh:true}))count++;});
  if(count){derive(player);refreshBagNames();}return count;
}
/* Old saves may carry the retired second main/offhand set. Preserve every
 * distinct item, even when migration temporarily exceeds bag capacity. */
function migrateRangedSlot(){
  if(!player)return;var sets=player.sets||[],active=player.activeSet||0,main=sets[active]||sets[0]||FISTS;
  if(player.ranged===undefined)player.ranged=null;
  if(isRangedWeapon(main))main=sets.find(function(item){return item&&!isRangedWeapon(item);})||FISTS;
  // Older two-handed equips hid focuses in the offhand slot instead of stowing them.
  var hiddenOff=main.hands===2?player.off:null;if(hiddenOff)player.off=EMPTY_OFF;
  var retained=new Set([main,player.ranged,player.off,player.armorItem,player.amulet].concat(player.rings||[]));
  (player.bag||[]).forEach(function(b){if(b.data)retained.add(b.data);});
  function preserve(item,kind){if(!item||item===EMPTY_OFF||item.unarmed||retained.has(item))return;retained.add(item);
    if(kind==='weapon'&&isRangedWeapon(item)&&!player.ranged){player.ranged=item;return;}
    kind=FoteInventory.bagKind(kind,item);player.bag.push({kind:kind,data:item,name:gearName(item),icon:gearBagIcon(kind),n:1,uid:'g'+nextId++});}
  sets.forEach(function(item){preserve(item,'weapon');});
  (player.offSets||[]).forEach(function(item){preserve(item,'off');});
  preserve(hiddenOff,'off');
  player.sets=[main,null];player.activeSet=0;delete player.offSets;
  player.bag.forEach(function(entry){entry.kind=FoteInventory.bagKind(entry.kind,entry.data);});
}

function offHandIsWeapon(){
  var o = player && player.off;
  return !!(o && o !== EMPTY_OFF && o.weapon && !player.twoHanded);
}

;
/* js/engine/forge-adapter.js */
/* Forge commands validate their complete transaction before spending resources.
 * Every successful operation has one stats/description refresh and one receipt. */
function forgeTarget(slot){
  if(slot==='weapon')return player.weapon&&!player.weapon.unarmed?{slot:slot,item:player.weapon,kind:'weapon'}:null;
  if(slot==='ranged')return isRangedWeapon(player.ranged)?{slot:slot,item:player.ranged,kind:'weapon'}:null;
  if(slot==='armor')return player.armorItem?{slot:slot,item:player.armorItem,kind:'armor'}:null;
  if(slot==='off'&&player.off&&player.off!==EMPTY_OFF)return {slot:slot,item:player.off,kind:offHandIsWeapon()?'weapon':offKind()};
  return null;
}
function enchantTargets(){
  var labels={weapon:'Main hand',off:'Off hand',ranged:'Ranged',armor:'Armor'};
  return ['weapon','off','ranged','armor'].map(forgeTarget).filter(Boolean).map(function(t){return {slot:t.slot,label:labels[t.slot],it:t.item,text:t.kind?ENCHANT_TEXT[t.kind]:null};});
}
function finishForge(html){derive(player);refreshBagNames();updateUI();renderForge();forgeSay(html);}
function enchantItem(slot,element){
  if(ELEMENTS.indexOf(element)<0)return false;
  if(forbiddenElement(element))return refuseDivine();
  var target=forgeTarget(slot),item=target&&target.item;
  if(!target||!target.kind){log('Nothing to enchant there.','c-info');return false;}
  if(item.unid){log('The Forge will not work metal you do not know. <b>Identify it first.</b>','c-info');sfx('ui-error');return false;}
  if(!(player.motes[element]>0)){log('You have no '+element+' mote.','c-info');return false;}
  if(item.enchant===element){log('Your '+gearName(item)+' already carries '+element+'. A second mote would change nothing.','c-info');sfx('ui-error');return false;}
  var before=Object.assign({},player.motes);player.motes=FoteInventory.consumeMaterials(player.motes,{[element]:1});
  item.enchant=element;
  if(typeof FoteJournalEvents!=='undefined')FoteJournalEvents.record('enchantments',target.kind+'/'+element);
  if(player.god==='anvil')gainPiety(20,undefined,{deferStats:true});
  if(item.cursed)breakCurse(item,{deferRefresh:true});
  secondHeat(before);
  log('The Forge sets <b>'+element+'</b> into your '+gearName(item)+': '+enchantLive(target.kind,element),'c-kill');
  sfx('forge-enchant');sparkleFx(player.x,player.y,TRAIL_EL(element),40);
  finishForge('Your <b>'+gearName(item)+'</b> takes the '+cap(element)+' enchantment.');return true;
}
function craftSigil(key){
  var recipe=SIGILS[key],cost=recipe&&Number.isFinite(recipe.cost)?recipe.cost:sigilEssence(key);
  var plan=FoteInventory.planCraft(player,recipe,key,cost,BAG_MAX);
  if(plan.error){
    if(plan.error==='full')return inventoryFailure(plan);
    if(plan.error==='motes')log('You need '+recipe.motes.join(' + ')+' motes.','c-info');
    else if(plan.error==='essence')log('Carving a <b>'+recipe.name+'</b> takes <b>'+cost+' essence</b>; you have '+(player.essence||0)+'.','c-info');
    else log('That sigil cannot be carved.','c-info');sfx('ui-error');return false;
  }
  var before=Object.assign({},player.motes);player.motes=FoteInventory.consumeMaterials(player.motes,plan.need);
  if(plan.cost)spendEssence(plan.cost,{deferStats:true});
  sigilKnown[key]=true;
  if(typeof FoteJournalEvents!=='undefined')FoteJournalEvents.record('sigils',key);
  player.bag.forEach(function(b){if(b.kind==='sigil'&&b.data.use===key)b.name=recipe.name;});
  addBag('✦',recipe.name,{kind:'sigil',data:{use:key},uid:'sigil:'+key});secondHeat(before);
  log('You carve a <b>'+recipe.name+'</b>: '+recipe.desc,'c-kill');sfx('forge-craft');sparkleFx(player.x,player.y,'fire',24);
  finishForge('Carved: <b>'+recipe.name+'</b>. '+recipe.desc);return true;
}
function upgradeItem(item){
  if(item&&item.unid){log('The Forge will not work metal you do not know. <b>Identify it first.</b>','c-info');sfx('ui-error');return false;}
  if(!item||!upgradeable(item)||!allUpgradeTargets().some(function(t){return t.it===item;})){log('That item cannot be upgraded.','c-info');return false;}
  var cost=upgradeCost(item);if(cost===null){log('That is as strong as the Forge can make it.','c-info');return false;}
  if(player.essence<cost){log('You need '+cost+' essence.','c-info');sfx('ui-error');return false;}
  spendEssence(cost,{deferStats:true});var cursed=!!item.cursed;
  if(cursed)Object.assign(item,FoteInventory.cleanse(item));else {item.plus=(item.plus||0)+1;item.unid=false;}
  tierNormalize(item);
  if(item.kind==='ring')RUN.ringKnown[item.ring]=true;
  if(typeof FoteJournalEvents!=='undefined')FoteJournalEvents.gear(item);
  if(player.god==='anvil')gainPiety(10,undefined,{deferStats:true});
  var receipt=cursed?'The Forge burns the curse out of your <b>'+gearName(item)+'</b>.':'The Forge hammers your <b>'+gearName(item)+'</b> stronger.';
  log(receipt,'c-kill');sfx('forge-enchant');sparkleFx(player.x,player.y,'fire',30);finishForge(receipt);return true;
}

function fuseCheck(el){
  if(forbiddenElement(el))return GODS[player.god].name+' forbids '+cap(el)+'.';
  var aff=player.aff, total=totalAffinity(), capv=affinityCap(), have=(player.motes[el]||0)>0;
  if(!have) return 'You have no '+el+' mote.';
  if(total>=capv) return 'Affinity cap reached ('+capv+'). Pick up a boss core to raise it.';
  var els=Object.keys(aff).filter(function(k){ return aff[k]>0; });
  if(!aff[el] && els.length>=2) return 'You already hold two elements.';
  for(var i=0;i<els.length;i++) if(OPPOSITE[els[i]]===el) return cap(el)+' is the opposite of your '+els[i]+'.';
  var primary=player.primary || els[0];
  if(primary && el!==primary && (aff[el]||0)+1 > (aff[primary]||0)) return 'Your secondary element can never outgrow your primary ('+primary+').';
  return null;
}
function fuseMote(el){
  if(ELEMENTS.indexOf(el)<0)return false;
  var why=fuseCheck(el); if(why){ log(why,'c-info'); sfx('ui-error'); return false; }

  player.motes[el]--; if(player.motes[el]<=0) delete player.motes[el];
  if(!Object.keys(player.aff).length) player.primary=el;
  player.aff[el]=(player.aff[el]||0)+1;
  var before=player.abilities.slice();
  derive(player); player.iceArmor=player.iceArmorMax;
  if(typeof FoteJournalEvents!=='undefined')FoteJournalEvents.progress();
  log('The mote takes root in you. <b>'+cap(el)+' '+player.aff[el]+'</b>: '+t1Text(el, player.aff[el])+'.','c-kill');
  sfx('forge-fuse'); sparkleFx(player.x,player.y,TRAIL_EL(el),50);
  if(typeof infuseFx==='function') infuseFx(el); else ringFx(player.x,player.y,AFF_COL[el],3);   /* 2026-10-12: the power-up plays on the map once the forge's panel closes (fx.js) */
  player.abilities.forEach(function(k){ if(before.indexOf(k)<0){ log('Learned <b>'+ABILITIES[k].name+'</b>.','c-kill'); sfx('new-ability'); } });
  player.hotbar=null; updateUI(); renderForge();
  forgeSay('The <b>'+cap(el)+'</b> mote takes root in you: affinity <b>'+player.aff[el]+'</b>.');return true;
}

;
/* js/engine/gear-adapter.js */
/* Item creation and charge progression have one owner. */
function makeEscortReward(){return rng()<.5?{kind:'ring',it:makeRing(null,false)}:{kind:'amulet',it:makeAmulet(null,false)};}
function makeExpeditionReward(){var ring=makeRing(null,false);ring.plus=Math.max(2,ring.plus||0);return {kind:'ring',it:ring};}
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
  return FoteGear.transmutationKeys(kind,key,transmutationCatalog(kind));
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
/* 2026-10-14 (Justin): weapons and off-hands come in four build pools, each equally likely whatever the hero's
   class, because building stays open ended: "warrior (buckler, kite, mace, ax, spear), skirmisher (bow, dagger,
   shortsword), mage (staff, wand, orb, tome) cleric (cerimonial knife, holy symbol)", and "What I wanted is for
   each of the 'pools' to be equally likely. The reason being that some items like chain or mail are equivalent
   or wand + orb vs staff." A drop picks a pool, then an item in it. The Long Sword was named in no pool; it sits
   with the warrior's. Armor: a third heavy (Plate or Chain, half each), a third Leather, a third Cloth
   ("it should really be 1/3 (plate or chain, 1/3 leather, 1/3 cloth"). */
var GEAR_POOLS=[
  [['off','buckler'],['off','kite'],['weapon','mace'],['weapon','axe'],['weapon','spear'],['weapon','longsword']],
  [['weapon','bow'],['weapon','dagger'],['weapon','sword']],
  [['weapon','staff'],['weapon','wand'],['off','orb'],['off','tome']],
  [['weapon','censer'],['off','holy']]
];
function rollArmorKey(){ var r=rng()*3; return r<1 ? (rng()<.5?'plate':'chain') : r<2 ? 'leather' : 'robe'; }
function rollEquipmentCandidate(){
  var roll=rng(),gear;
  if(roll>=.5&&roll<.8){gear={kind:'armor',it:clone(ARMORS[rollArmorKey()])};}
  else {var p=pick(pick(GEAR_POOLS));gear={kind:p[0],it:clone((p[0]==='off'?OFFHANDS:WEAPONS)[p[1]])};}
  rng(); // Reserved quality draw from existing seeds. Final quality is rolled after selection.
  gear.it.plus=rollEnhancement(0);
  if(gear.kind!=='off'&&rng()<.15+floorNo*.03)gear.it.enchant=pick(ELEMENTS);
  return gear;
}
/* 2026-10-14 (Justin): gear volume by biome, so builds finish in biome 4 without swamping the early floors.
   About 3 pieces a floor in biomes 1-3 and 6 in biome 4 (all Masterwork there). GEAR_RATE is the share of gear
   rolls that stay gear: floor gear outside puzzle rooms (thinGeneratedGear), chest gear and kill gear. */
var GEAR_RATE=[0.45,0.4,0.5,1,1];
function gearRate(){ return GEAR_RATE[Math.max(0,Math.min(GEAR_RATE.length-1,Math.floor((floorNo-1)/5)))]; }
/* 2026-10-14 (Justin): a Masterwork drop that matches a Masterwork piece the hero has already picked up rerolls once,
   so a build fills out without more items. Daggers and Ceremonial Knives are wanted twice (one in each hand):
   "players may want 2 daggers or 2 cerimonial knives". RUN.mwFound counts pickups by item key. */
var MASTERWORK_PAIRS={dagger:true,censer:true};
function masterworkWanted(it){
  var k=itemKey(it); if(!k||typeof RUN==='undefined'||!RUN) return true;
  return ((RUN.mwFound||{})[k]||0) < (MASTERWORK_PAIRS[k]?2:1);
}
function noteMasterwork(it){
  if(!it||tierNum(it)<3||typeof RUN==='undefined'||!RUN) return;
  var k=itemKey(it); if(!k||it._mwFoundKey===k) return;
  // Equipment displacement and drop/re-pick also pass through addBag. Keep the
  // acquisition stamp on the saved item so one physical piece counts once.
  it._mwFoundKey=k;
  RUN.mwFound=RUN.mwFound||{}; RUN.mwFound[k]=(RUN.mwFound[k]||0)+1;
}
function curseGear(gear){gear.it.cursed=true;gear.it.plus=-ri(1,3);delete gear.it.enchant;if(gear.kind==='off')gear.it.cursedOff=true;}
function randomGear(){
  var gear;
  for(var attempt=0;attempt<20;attempt++){
    var roll=rng(),cursed=rng()<.15;
    // Retain rejected trinket draws and their discovery ledger for save-seed compatibility.
    if(roll<.12){makeRing(null,cursed);continue;}
    if(roll<.20){makeAmulet(null,cursed);continue;}
    gear=rollEquipmentCandidate();gear.it.unid=true;
    if(cursed)curseGear(gear);
    break;
  }
  if(!gear)gear=rollEquipmentCandidate();
  gear.it.tier=rollTier();
  if(gear.it.tier>=3&&!masterworkWanted(gear.it)){
    var again=rollEquipmentCandidate();again.it.unid=gear.it.unid;if(gear.it.cursed)curseGear(again);again.it.tier=3;gear=again;
  }
  tierNormalize(gear.it);return gear;
}
function spendAmulet(item){
  amuletSync(item);item.charges=Math.max(0,item.charges-1);amuletSync(item);
  var first=item.unid&&!RUN.amuletKnown[item.amulet];RUN.amuletKnown[item.amulet]=true;
  if(typeof FoteJournalEvents!=='undefined')FoteJournalEvents.gear(item);
  item.uses=(item.uses||0)+1;useCount(item,'amulet');refreshBagNames();
  if(first)log('It is an <b>'+AMULETS[item.amulet].name+'</b>!','c-kill');
  var level=item.level||1;
  if(level<3&&item.uses>=AMULET_LEVEL_USES[level]){
    item.level=level+1;amuletSync(item);refreshBagNames();
    log('Your <b>'+gearName(item)+'</b> has grown used to you: it now holds '+item.level+' charges, and its power grows.','c-kill');sfx('piety-rank');
  }
}
function gearName(item){
  if(!item)return 'nothing';
  if(item.kind==='ring'){
    ensureTrinketLooks();
    if(item.unid&&!RUN.ringKnown[item.ring])return cap(RUN.ringLook[item.ring])+' ring';
    if(item.unid)return item.name+' ?';
    var plus=item.cursed?ringPower(item):(item.plus||0);
    return item.name+' '+(plus>=0?'+':'')+plus+(item.cursed?' (cursed)':'');
  }
  if(item.kind==='amulet'){
    ensureTrinketLooks();
    if(item.unid&&!RUN.amuletKnown[item.amulet])return cap(RUN.amuletLook[item.amulet])+' amulet';
    if(item.unid)return item.name+' ?';
    if(AMULETS[item.amulet])return item.name+' ('+['I','II','III'][Math.max(0,Math.min(2,(item.level||1)-1))]+')'+(item.cursed?' (cursed)':'');
    return item.name+(item.plus?' +'+item.plus:'')+(item.cursed?' (cursed)':'');
  }
  var key=itemKey(Object.assign({},item)),prefix='';
  // Transmutation retains quality on Cameras and shirts too. Their lack of
  // scaling stats must not turn a numeric tier into an apparent item count.
  if(key||typeof item.tier==='number'&&item.tier!==0)prefix=TIER_NAME[tierNum(item)]||'';
  else if(typeof item.tier==='string'&&item.tier!=='Rusty')prefix=item.tier;
  var name=(prefix?prefix+' ':'')+item.name;
  if(item.unid)return name+' ?';
  if(item.plus)name+=item.plus<0?' −'+Math.abs(item.plus):' +'+item.plus;
  if(item.enchant)name+=' of '+cap(item.enchant);
  return name+(item.cursed?' (cursed)':'');
}
function itemLabel(item){
  if(item.kind==='relic')return item.name;
  if(item.kind==='core')return 'the '+item.name;
  if(item.kind==='heart')return 'a heart (heals 25% of max HP)';
  if(item.kind==='managlobe')return 'a mana globe (restores 25% of max mana)';
  if(item.kind==='essence')return Math.round(item.n*essenceMult())+' essence';
  if(item.kind==='mote')return (/^[aeiou]/.test(item.el)?'an ':'a ')+item.el+' mote';
  if(item.kind==='key')return (/^[aeiou]/.test(item.key)?'an ':'a ')+item.key+' key';
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

;
/* js/engine/gear-cards.js */
/* Read-only item views. Cards normalize a copy, never an equipped item. */
function gearCardView(item){return item?tierNormalize(Object.assign({},item)):null;}
function passiveNumber(value){return String(Number(gearPassiveValue(value).toFixed(2)));}
function weaponPassiveNote(w){
  if(w.executioner)return '+'+passiveNumber(w.executioner*100)+'% damage to targets at half HP or less';
  if(w.pierce)return 'ignores '+passiveNumber(w.pierce)+' armor';
  if(w.critBonus)return '+'+passiveNumber(w.critBonus*100)+'% crit chance';
  return w.note||'';
}
function weaponCard(item,worn){
  var w=gearCardView(item);if(!w)return '';
  var h;
  if(w.unid){
    h='<div class="nm">'+gearName(w)+'</div><div class="row"><span>Damage</span><b>?</b></div>'+
      '<div class="row"><span>Hands</span><b>'+(w.hands||1)+'</b></div>'+(w.range?'<div class="row"><span>Range</span><b>'+w.range+'</b></div>':'')+unidHint(w);
  }else{
    var plus=itemPlus(w);
    h='<div class="nm">'+gearName(w)+'</div>'+
      '<div class="row"><span>Damage</span><b>'+(w.dmg[0]+plus)+(w.dmg[0]+plus<0?' to ':'-')+(w.dmg[1]+plus)+'</b></div>'+
      '<div class="row"><span>Accuracy</span><b>'+(w.acc>=0?'+':'')+passiveNumber(w.acc)+'</b></div>'+
      '<div class="row"><span>Hands</span><b>'+(w.hands||1)+'</b></div>'+
      (w.range?'<div class="row"><span>Range</span><b>'+(w.range+(player.rangeBonus||0))+'</b></div>':'')+
      (w.enchant?'<div class="row"><span>Enchant</span><b style="color:'+AFF_COL[w.enchant]+'">'+cap(w.enchant)+'</b></div><div class="hint">'+enchantLive('weapon',w.enchant)+'</div>':'')+
      (w.divine?'<div class="row"><span>Divine Power</span><b>+'+Math.round(w.divine*gearPassiveBonus()*100)+'%</b></div>':'')+
      (w.note?'<div class="hint">'+weaponPassiveNote(w)+'</div>':'')+focusRows(w)+
      (w.cursed?'<div class="hint" style="color:#D0605A">Cursed: cannot unequip until cleansed.</div>':'');
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
      '<div class="row"><span>Evasion</span><b>'+((a.eva||0)>=0?'+':'')+passiveNumber(a.eva)+'</b></div>'+
      (a.enchant?'<div class="row"><span>Enchant</span><b style="color:'+AFF_COL[a.enchant]+'">'+cap(a.enchant)+'</b></div><div class="hint">'+enchantLive('armor',a.enchant)+'</div>':'')+
      '<div class="hint">'+(a.note||'')+'</div>'+(a.cursed?'<div class="hint" style="color:#D0605A">Cursed: cannot unequip until cleansed.</div>':'');
    if(itemKey(a)==='chain'&&chainResist(a)>0)h+='<div class="row"><span>Elemental resistance</span><b>+'+Math.round(chainResist(a)*100)+'%</b></div>';
    if(itemKey(a)==='robe')h+='<div class="row"><span>Spell damage</span><b>+'+Math.round(robeSpell(a)*gearPassiveBonus()*100)+'%</b></div><div class="row"><span>Max Mana</span><b>+'+Math.round(TIER_ROBE.mana[tierNum(a)]*gearPassiveBonus()*100)+'%</b></div>';
  }
  return tierTint(h,a)+(worn?'':reqRow(a));
}
function offhandCard(item){
  var d=gearCardView(item),h='';if(!d)return h;
  if(!d.unid&&focusKey(d))h='<div class="nm">'+gearName(d)+'</div>'+focusRows(d)+(d.cursed?'<div class="hint" style="color:#D0605A">Cursed: cannot unequip until cleansed.</div>':'');
  else if(d.unid||d.cursed)h='<div class="nm">'+gearName(d)+'</div><div class="hint">'+(d.unid?'':d.note||'')+'</div>'+unidHint(d)+(d.cursed&&!d.unid?'<div class="hint" style="color:#D0605A">Cursed: cannot unequip until cleansed.</div>':'');
  else h=d.weapon?weaponCard(d):'<div class="nm">'+gearName(d)+'</div><div class="hint">'+(d.note||'')+'</div>';
  if(d.enchant&&!d.unid){
    var key=itemKey(d),slot=key==='holy'?'holy':d.block>0?'shield':key;
    if(ENCHANT_TEXT[slot])h+='<div class="row"><span>Enchant</span><b style="color:'+AFF_COL[d.enchant]+'">'+cap(d.enchant)+'</b></div><div class="hint">'+enchantLive(slot,d.enchant)+'</div>';
  }
  h=tierTint(h,d);
  if(!d.unid){
    var key=itemKey(d);
    if(TIER_BLOCK[key])h+='<div class="row"><span>Block</span><b>'+Math.round((d.block+TIER_BLOCK.per*(d.plus||0))*100)+'%</b></div>';
    if(key==='buckler'&&bucklerDeflect(d)>0)h+='<div class="row"><span>Deflect ranged attacks</span><b>'+Math.round(bucklerDeflect(d)*100)+'%</b></div>';
    if(key==='tome')h+='<div class="row"><span>Max Mana</span><b>+'+Math.round(d.manaPct*gearPassiveBonus()*100)+'%</b></div>';
    if(key==='holy')h+='<div class="row"><span>Divine Power</span><b>+'+Math.round(d.divine*gearPassiveBonus()*100)+'%</b></div><div class="row"><span>Buff duration</span><b>+'+Math.round(holyDurationPct(d)*100)+'%</b></div>';
    if(d.kind==='off'&&d.weapon)h+='<div class="row"><span>Off-hand strike</span><b>60% damage</b></div>';
  }
  return h+reqRow(d);
}
function trinketCard(item){
  if(!item)return '';
  if(item.kind==='ring'){
    var known=!item.unid||RUN.ringKnown[item.ring];
    return '<div class="nm">'+gearName(item)+'</div>'+(known?'<div class="hint">'+ringDescription(item)+'</div>':'')+
      (!item.unid?'<div class="row"><span>Effect</span><b'+(item.cursed?' style="color:#D0605A"':'')+'>'+ringLine(item)+'</b></div>':'')+
      (item.cursed&&!item.unid?'<div class="hint" style="color:#D0605A">Cursed: cannot unequip until cleansed.</div>':'')+unidHint(item);
  }
  if(!amuletOk(item))return '<div class="nm">'+gearName(item)+'</div><div class="hint">This amulet has lost its power.</div>';
  var state=FoteGear.amuletState(item,amuletKillsNeeded(item)),cap=amuletCap(item),knownAmulet=!item.unid||RUN.amuletKnown[item.amulet];
  return '<div class="nm">'+gearName(item)+'</div>'+(knownAmulet?actionDetailsHTML(amuletDetails(item))+'<div class="row"><span>Kills per charge</span><b>'+(item.unid?'?':amuletKillsNeeded(item))+'</b></div>':'')+
    '<div class="row"><span>Charges</span><b>'+state.charges+' / '+cap+'</b></div>'+
    (state.charges<cap&&!item.unid?'<div class="row"><span>Next charge</span><b>'+Math.max(1,amuletKillsNeeded(item)-(state.progress||0))+' more kill'+(Math.max(1,amuletKillsNeeded(item)-(state.progress||0))===1?'':'s')+'</b></div>':'')+
    (item.cursed&&!item.unid?'<div class="hint" style="color:#D0605A">Cursed: +30% kills per charge. Cannot unequip until cleansed.</div>':'')+unidHint(item)+
    '<div class="hint">Level '+state.level+' / 3. Use to level up; kills recharge. Elites and bosses count as 3.</div>';
}
function bagCard(entry){
  if(!entry)return '';
  if(entry.kind==='weapon')return weaponCard(entry.data);
  if(entry.kind==='armor')return armorCard(entry.data);
  if(entry.kind==='off')return offhandCard(entry.data);
  if(entry.kind==='ring'||entry.kind==='amulet')return trinketCard(entry.data);
  /* 2026-10-12 (launch audit): a known sigil the wearer's god will refuse says so on its card, in the words of the refusal itself */
  if(entry.kind==='sigil'){var known=sigilKnown[entry.data.use],barred=known?sigilForbidden(entry.data.use):'';return '<div class="nm">'+entry.name+'</div>'+(known?actionDetailsHTML(sigilDetails(entry.data.use)):'<div class="hint">Unidentified sigil.</div>')+(barred?'<div class="hint" style="color:#D0605A">'+barred+'</div>':'');}
  if(entry.kind==='food'){var f=FOODS[entry.data.food],long=f.buff&&typeof foodBuffTurns==='function'?foodBuffTurns(f.turns):0;return '<div class="nm">'+f.name+'</div><div class="hint">'+(f.desc?f.desc+' ':'')+(long>f.turns?'Your ring stretches it to '+long+' turns. ':'')+'Restores '+f.nutrition+' hunger'+(f.heal?', heals '+Math.round(f.heal*100)+'% max HP':'')+'.</div>';}
  return '<div class="nm">'+entry.name+'</div>';
}

