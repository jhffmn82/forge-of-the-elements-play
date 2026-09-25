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
  player.bag.forEach(function(b){if(b.kind==='sigil'&&b.data.use===key)b.name=recipe.name;});
  addBag('✦',recipe.name,{kind:'sigil',data:{use:key},uid:'sigil:'+key});secondHeat(before);
  log('You carve a <b>'+recipe.name+'</b>: '+recipe.desc,'c-kill');sfx('forge-craft');sparkleFx(player.x,player.y,'fire',24);
  finishForge('Carved: <b>'+recipe.name+'</b> &mdash; '+recipe.desc);return true;
}
function upgradeItem(item){
  if(item&&item.unid){log('The Forge will not work metal you do not know. <b>Identify it first.</b>','c-info');sfx('ui-error');return false;}
  if(!item||!upgradeable(item)||!allUpgradeTargets().some(function(t){return t.it===item;})){log('That item cannot be upgraded.','c-info');return false;}
  var cost=upgradeCost(item);if(cost===null){log('That is as strong as the Forge can make it.','c-info');return false;}
  if(player.essence<cost){log('You need '+cost+' essence.','c-info');sfx('ui-error');return false;}
  spendEssence(cost,{deferStats:true});var cursed=!!item.cursed;
  if(cursed)Object.assign(item,FoteInventory.cleanse(item));else {item.plus=(item.plus||0)+1;item.unid=false;}
  if(item.kind==='ring')RUN.ringKnown[item.ring]=true;
  if(player.god==='anvil')gainPiety(10,undefined,{deferStats:true});
  var receipt=cursed?'The Forge burns the curse out of your <b>'+gearName(item)+'</b>.':'The Forge hammers your <b>'+gearName(item)+'</b> stronger.';
  log(receipt,'c-kill');sfx('forge-enchant');sparkleFx(player.x,player.y,'fire',30);finishForge(receipt);return true;
}

function fuseCheck(el){
  if(forbiddenElement(el))return GODS[player.god].name+' forbids '+cap(el)+'.';
  var aff=player.aff, total=totalAffinity(), capv=affinityCap(), have=(player.motes[el]||0)>0;
  if(!have) return 'You have no '+el+' mote.';
  if(total>=capv) return 'Affinity cap reached ('+capv+'). Defeat the biome boss to raise it.';
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
  log('The Forge burns the mote into you. <b>'+cap(el)+' '+player.aff[el]+'</b>: '+t1Text(el, player.aff[el])+'.','c-kill');
  sfx('forge-fuse'); sparkleFx(player.x,player.y,TRAIL_EL(el),50); ringFx(player.x,player.y,AFF_COL[el],3);
  player.abilities.forEach(function(k){ if(before.indexOf(k)<0){ log('<b>New spell: '+ABILITIES[k].name+'</b> &mdash; '+(typeof liveDesc==='function' ? liveDesc(ABILITIES[k]) : ABILITIES[k].desc),'c-kill'); sfx('new-ability'); } });
  player.hotbar=null; updateUI(); renderForge();
  forgeSay('The <b>'+cap(el)+'</b> mote takes root in you: affinity <b>'+player.aff[el]+'</b>.');return true;
}
