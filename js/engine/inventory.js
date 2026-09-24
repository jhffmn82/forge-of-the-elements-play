/* Inventory plans are pure. Validation happens before any item leaves a slot
 * or any material is spent; the adapter commits a successful plan once. */
(function(root){
  'use strict';
  var gearKinds=['weapon','armor','off','ring','amulet'];
  function gear(kind){return gearKinds.indexOf(kind)>=0;}
  function bagKind(kind,item){return kind==='off'&&item&&(item.weapon||item.kind==='weapon')?'weapon':kind;}
  function slotItem(actor,slot){
    if(slot==='main')return (actor.sets||[])[actor.activeSet||0]||null;
    if(slot==='armor')return actor.armorItem||null;
    if(slot==='ring0'||slot==='ring1')return (actor.rings||[])[+slot.slice(-1)]||null;
    return actor[slot]||null;
  }
  function defaultSlot(actor,entry){
    if(entry.kind==='weapon')return entry.data&&(entry.data.range||0)>1?'ranged':'main';
    if(entry.kind==='ring')return !(actor.rings||[])[0]?'ring0':!(actor.rings||[])[1]?'ring1':'ring0';
    return entry.kind;
  }
  function planEquip(actor,index,requested,policy){
    var entry=(actor.bag||[])[index];if(!entry||!entry.data)return {error:'missing'};
    var item=policy.normalize(entry.data),slot=requested==='stow'?'ranged':requested||defaultSlot(actor,entry);
    if(slot==='main'&&entry.kind==='weapon'&&policy.ranged(item))slot='ranged';
    var kind=bagKind(entry.kind,item);
    if(slot==='ranged'&&(kind!=='weapon'||!policy.ranged(item)))return {error:'ranged-slot'};
    if(slot==='main'&&kind!=='weapon')return {error:'main-slot'};
    if(slot==='armor'&&kind!=='armor')return {error:'armor-slot'};
    if((slot==='ring0'||slot==='ring1')&&kind!=='ring')return {error:'ring-slot'};
    if(slot==='amulet'&&kind!=='amulet')return {error:'amulet-slot'};
    if(slot==='off'){
      if(policy.ranged(item))return {error:'bow-offhand'};
      if(!(kind==='off'||kind==='weapon'&&item.hands!==2&&item.light))return {error:'off-slot'};
      if(actor.twoHanded)return {error:'both-hands'};
    }
    if(['main','off','armor','ranged','ring0','ring1','amulet'].indexOf(slot)<0)return {error:'slot'};
    if(policy.forbidden(slot,item))return {error:'forbidden'};
    if(!policy.meets(item))return {error:'requirements',item:item};
    var current=slotItem(actor,slot),displaced=[];
    function present(it){return it&&it!==policy.empty&&!it.unarmed;}
    if(present(current)&&current.cursed)return {error:'cursed',item:current};
    if(present(current))displaced.push({item:current,kind:slot==='main'||slot==='ranged'?'weapon':slot.indexOf('ring')===0?'ring':slot});
    var stowOff=slot==='main'&&item.hands===2&&present(actor.off)&&(actor.off.block||actor.off.weapon);
    if(slot==='main'&&item.hands===2&&present(actor.off)&&actor.off.cursed)return {error:'cursed',item:actor.off};
    if(stowOff)displaced.push({item:actor.off,kind:'off'});
    if(actor.bag.length-1+displaced.length>policy.capacity)return {error:'full'};
    return {slot:slot,index:index,entry:entry,item:entry.data,normalized:item,displaced:displaced,stowOff:!!stowOff,offhandWeapon:slot==='off'&&kind==='weapon'};
  }
  function planCraft(actor,recipe,key,cost,capacity){
    if(!recipe)return {error:'recipe'};
    var need={};(recipe.motes||[]).forEach(function(el){need[el]=(need[el]||0)+1;});
    for(var el in need)if((actor.motes[el]||0)<need[el])return {error:'motes',need:need};
    if(!Number.isFinite(cost)||cost<0)return {error:'cost'};
    if(cost>(actor.essence||0))return {error:'essence',cost:cost};
    var stack=actor.bag.find(function(b){return b.uid==='sigil:'+key;});
    if(!stack&&actor.bag.length>=capacity)return {error:'full'};
    return {need:need,cost:cost,stack:stack||null,key:key};
  }
  function consumeMaterials(motes,need){var next=Object.assign({},motes);for(var el in need){next[el]-=need[el];if(next[el]<=0)delete next[el];}return next;}
  function cleanse(item){if(!item||!item.cursed)return null;return {cursed:false,unid:false,plus:item.kind==='ring'?0:Math.max(0,item.plus||0)};}
  var api=Object.freeze({gear:gear,bagKind:bagKind,slotItem:slotItem,defaultSlot:defaultSlot,planEquip:planEquip,planCraft:planCraft,consumeMaterials:consumeMaterials,cleanse:cleanse});
  root.FoteInventory=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
