/* Single inventory/equipment command boundary. UI callbacks pass indices or
 * slots; validation and capacity checks precede the mutation and turn commit. */
function inventorySlotPolicy(){return {capacity:BAG_MAX,empty:EMPTY_OFF,ranged:isRangedWeapon,
  normalize:function(item){return tierNormalize(fixNegativePlus(Object.assign({},item)));},
  forbidden:equipmentForbidden,meets:meetsReq};}
function inventoryFailure(plan){
  var messages={missing:'That item is no longer in your bag.',full:'Your bag is full.',slot:'That item does not fit there.',
    'main-slot':'That is not a weapon.','armor-slot':'That is not armor.','ring-slot':'That is not a ring.','amulet-slot':'That is not an amulet.',
    'ranged-slot':'Only a bow or another weapon with reach goes there.','bow-offhand':'A bow needs both hands. It goes in your ranged slot.',
    'off-slot':'Only a light weapon, shield or focus fits your off hand.','both-hands':'Both hands are on the '+player.weapon.name+'.'};
  if(plan.error==='forbidden')return refuseDivine();
  if(plan.error==='cursed'){cursedBlock(plan.item);return false;}
  if(plan.error==='requirements'){reqBlock(plan.item);return false;}
  log(messages[plan.error]||'That action cannot be completed.','c-info');sfx(plan.error==='full'?'inventory-full':'ui-error');return false;
}
function gearBagIcon(kind){return kind==='weapon'?'⚔':kind==='ring'?'○':kind==='amulet'?'☥':'⛨';}
function addBag(icon,name,extra){
  extra=extra||{};var kind=FoteInventory.bagKind(extra.kind,extra.data),isGear=FoteInventory.gear(kind);
  var uid=extra.uid||(!isGear?name:null),existing=uid&&player.bag.find(function(b){return b.uid===uid;});
  if(existing){existing.n++;return existing;}
  if(player.bag.length>=BAG_MAX){inventoryFailure({error:'full'});return null;}
  var entry={icon:icon,name:name,n:1,uid:uid||'g'+nextId++,kind:kind,data:extra.data};player.bag.push(entry);return entry;
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
  if(!it)return false;it.x=player.x;it.y=player.y;items.push(it);consume(index);log('You drop '+itemLabel(it)+'.','c-info');return true;
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
  if(plan.stowOff)log('Both hands are on the '+item.name+' &mdash; the '+plan.displaced[plan.displaced.length-1].item.name+' goes into your bag.','c-info');
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
function putOnRing(index,slot){return equipFromBag(index,slot===undefined?undefined:'ring'+slot);}
function putOnAmulet(index){return equipFromBag(index,'amulet');}
function removeEquipment(slot,spendTurn){
  if(gameTurns.busy())return false;
  var item=FoteInventory.slotItem(player,slot);if(!item||item===EMPTY_OFF||item.unarmed)return false;
  if(item.cursed)return inventoryFailure({error:'cursed',item:item});
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
function swapWeapon(){log('Your '+(isRangedWeapon(player.ranged)?gearName(player.ranged)+' is always ready: attack anything further than a tile away and you shoot it.':'ranged weapon slot is empty. A bow there fires without swapping.'),'c-info');}
function breakCurse(item,options){
  var change=FoteInventory.cleanse(item);if(!change)return false;Object.assign(item,change);
  if(!(options&&options.deferRefresh)){derive(player);refreshBagNames();}
  log('The curse on your <b>'+gearName(item)+'</b> breaks.','c-kill');sfx('puzzle-solved');return true;
}
/* Old saves may carry the retired second main/offhand set. Preserve every
 * distinct item, even when migration temporarily exceeds bag capacity. */
function migrateRangedSlot(){
  if(!player)return;var sets=player.sets||[],active=player.activeSet||0,main=sets[active]||sets[0]||FISTS;
  if(player.ranged===undefined)player.ranged=null;
  if(isRangedWeapon(main))main=sets.find(function(item){return item&&!isRangedWeapon(item);})||FISTS;
  var retained=new Set([main,player.ranged,player.off,player.armorItem,player.amulet].concat(player.rings||[]));
  (player.bag||[]).forEach(function(b){if(b.data)retained.add(b.data);});
  function preserve(item,kind){if(!item||item===EMPTY_OFF||item.unarmed||retained.has(item))return;retained.add(item);
    if(kind==='weapon'&&isRangedWeapon(item)&&!player.ranged){player.ranged=item;return;}
    kind=FoteInventory.bagKind(kind,item);player.bag.push({kind:kind,data:item,name:gearName(item),icon:gearBagIcon(kind),n:1,uid:'g'+nextId++});}
  sets.forEach(function(item){preserve(item,'weapon');});
  (player.offSets||[]).forEach(function(item){preserve(item,'off');});
  player.sets=[main,null];player.activeSet=0;delete player.offSets;
  player.bag.forEach(function(entry){entry.kind=FoteInventory.bagKind(entry.kind,entry.data);});
}

function offHandIsWeapon(){
  var o = player && player.off;
  return !!(o && o !== EMPTY_OFF && o.weapon && !player.twoHanded);
}
