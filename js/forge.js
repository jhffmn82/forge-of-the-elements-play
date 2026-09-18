/* ============================================================================
   forge.js - the Elemental Forge: fuse motes into affinity, enchant gear, craft sigils.
   ========================================================================== */

var T1_TEXT = {
  fire:'+1 fire damage on every hit, per point',
  water:'Ice Armor: absorbs 3 damage per point, recharges out of combat',
  air:'+10% movement speed per point',
  earth:'Stone Skin: -1 physical damage per hit, per point',
  light:'10% chance per point that your hits Smite for bonus light damage',
  shadow:'+5% crit chance per point against enemies that can\'t see you'
};
var ENCHANT_TEXT = {
  weapon:{fire:'10% of each hit as fire (+3% per Fire point); 5% Burning chance per Fire point', water:'15% chance to Chill (+5% per Water point)',
          air:'5% chance per Air point (min 5%) of an instant extra attack', earth:'15% chance to Root (grows with Earth)',
          light:'+10 accuracy (grows with Light); +25% vs undead and shadow', shadow:'5% chance per Shadow point (min 5%): +25% dark damage and Corrupt; +1 damage to Hollowed targets'},
  armor: {fire:'+10% fire resistance (grows with Fire)', water:'+8 evasion (grows with Water)', air:'+10% lightning resistance (grows with Air)',
          earth:'+2 armor (grows with Earth)', light:'+50% HP regeneration (grows with Light)', shadow:'+5% stealth per Shadow point (min 5%)'}
};
var forgeTab='fuse';

function fuseCheck(el){
  var aff=player.aff, total=totalAffinity(), capv=affinityCap(), have=(player.motes[el]||0)>0;
  if(!have) return 'You have no '+el+' mote.';
  if(total>=capv) return 'Affinity cap reached ('+capv+'). Defeat the biome boss to raise it.';
  var els=Object.keys(aff).filter(function(k){ return aff[k]>0; });
  if(!aff[el] && els.length>=2) return 'You already hold two elements.';
  for(var i=0;i<els.length;i++) if(OPPOSITE[els[i]]===el) return cap(el)+' is the opposite of your '+els[i]+'.';
  var primary=player.primary || els[0];
  if(primary && el!==primary && (aff[el]||0)+1 > (aff[primary]||0)) return 'Your secondary element can never outgrow your primary ('+primary+').';
  if(RACES[player.race].locked && primary && !aff[el] && els.length===1 && false) return '';
  return null;
}
function fuseMote(el){
  var why=fuseCheck(el); if(why){ log(why,'c-info'); sfx('ui-error'); return; }
  if(player.god==='glimmer' && el==='shadow') pietyViolation('you taking Shadow into yourself', 30);
  if(player.god==='murk' && el==='light') pietyViolation('you taking Light into yourself', 30);
  player.motes[el]--; if(player.motes[el]<=0) delete player.motes[el];
  if(!Object.keys(player.aff).length) player.primary=el;
  player.aff[el]=(player.aff[el]||0)+1;
  var before=player.abilities.slice();
  derive(player); player.iceArmor=player.iceArmorMax;
  log('The Forge burns the mote into you. <b>'+cap(el)+' '+player.aff[el]+'</b>: '+T1_TEXT[el]+'.','c-kill');
  sfx('forge-fuse'); sparkleFx(player.x,player.y,TRAIL_EL(el),50); ringFx(player.x,player.y,AFF_COL[el],3);
  player.abilities.forEach(function(k){ if(before.indexOf(k)<0){ log('<b>New spell: '+ABILITIES[k].name+'</b> &mdash; '+ABILITIES[k].desc,'c-kill'); sfx('new-ability'); } });
  player.hotbar=null; updateUI(); renderForge();
}
function enchantItem(slot, el){
  if(!(player.motes[el]>0)){ log('You have no '+el+' mote.','c-info'); return; }
  var item = slot==='weapon' ? player.weapon : player.armorItem;
  if(!item || item.unarmed){ log('Nothing to enchant there.','c-info'); return; }
  if(item.enchant===el){ log('Your '+gearName(item)+' already carries '+el+'. A second mote would change nothing.','c-info'); sfx('ui-error'); return; }
  player.motes[el]--; if(player.motes[el]<=0) delete player.motes[el];
  item.enchant=el;
  if(player.god==='anvil') gainPiety(20);
  godConductEquip(slot==='weapon'?'weapon':'armor', item);
  derive(player);
  log('The Forge sets <b>'+el+'</b> into your '+gearName(item)+': '+ENCHANT_TEXT[slot][el]+' (&times;'+enchantScale(el).toFixed(1)+' from your affinity).','c-kill');
  sfx('forge-enchant'); sparkleFx(player.x,player.y,TRAIL_EL(el),40);
  updateUI(); renderForge();
}
function craftSigil(key){
  var s=SIGILS[key], need={};
  s.motes.forEach(function(m){ need[m]=(need[m]||0)+1; });
  for(var m in need) if((player.motes[m]||0)<need[m]){ log('You need '+s.motes.join(' + ')+' motes.','c-info'); return; }
  if(player.bag.length>=BAG_MAX && !player.bag.some(function(b){ return b.uid==='sigil:'+key; })){ log('Your bag is full.','c-info'); return; }
  for(var m2 in need){ player.motes[m2]-=need[m2]; if(player.motes[m2]<=0) delete player.motes[m2]; }
  sigilKnown[key]=true;
  player.bag.forEach(function(b){ if(b.kind==='sigil' && b.data.use===key) b.name=s.name; });
  addBag('\u2726', s.name, {kind:'sigil', data:{use:key}, uid:'sigil:'+key});
  log('You carve a <b>'+s.name+'</b>: '+s.desc,'c-kill'); sfx('forge-craft'); sparkleFx(player.x,player.y,'fire',24);
  updateUI(); renderForge();
}

function openForge(){
  sfx('forge-open'); forgeTab = Object.keys(player.motes).length ? 'fuse' : 'fuse';
  openModal('The Elemental Forge', '<div id="forgeBody"></div>', [{label:'Leave the Forge', fn:closeModal}], 'wide');
  renderForge();
}
function renderForge(){
  var body=$('forgeBody'); if(!body) return;
  var pouch = ELEMENTS.map(function(el){
    var n=player.motes[el]||0;
    return '<div class="mslot'+(n?'':' none')+'" data-el="'+el+'"><span class="mart" data-art="mote-'+el+'"></span><b>'+n+'</b><span>'+cap(el)+'</span></div>';
  }).join('');
  var affLine = Object.keys(player.aff).length ? Object.keys(player.aff).map(function(k){ return '<span style="color:'+AFF_COL[k]+'">'+cap(k)+' '+player.aff[k]+(k===player.primary?' (primary)':'')+'</span>'; }).join(' &middot; ') : 'none yet';
  var h='<div class="forge-top"><div class="pouch2">'+pouch+'</div><div class="forge-info">'+
        '<div>Affinity: <b>'+affLine+'</b></div><div>Cap: <b>'+totalAffinity()+' / '+affinityCap()+'</b>'+' <span class="c-info">(rises when you give a boss core to the exit gate)</span>'+'</div>'+
        '<div>Essence: <b>'+player.essence+'</b></div></div></div>'+
        '<div class="ftabs">'+['fuse','enchant','upgrade','craft'].map(function(t){ return '<button data-ft="'+t+'" class="'+(forgeTab===t?'on':'')+'">'+{fuse:'Fuse',enchant:'Enchant',upgrade:'Upgrade',craft:'Craft sigils'}[t]+'</button>'; }).join('')+'</div><div class="fpanel">';
  if(forgeTab==='fuse'){
    h+='<p class="c-info">Burn a mote into yourself for a point of affinity. Two elements at most, never opposites, and the second can never outgrow the first. Permanent.</p>';
    ELEMENTS.forEach(function(el){
      var why=fuseCheck(el), cur=player.aff[el]||0, nextT=cur+1;
      var unlock = nextT===1 ? T1_TEXT[el] : nextT===2 ? 'Tier 2 spell: '+ABILITIES[ELEMENT_ABILS[el][2]].name+' &mdash; '+ABILITIES[ELEMENT_ABILS[el][2]].desc : 'Tier '+nextT+' (a later biome)';
      h+='<div class="frow"><span class="dot" style="background:'+AFF_COL[el]+'"></span><div class="ftext"><b>'+cap(el)+' '+cur+' &rarr; '+nextT+'</b><div class="d">'+unlock+'</div>'+
         (why?'<div class="d c-you">'+why+'</div>':'')+'</div><button data-fuse="'+el+'" '+(why?'disabled':'')+'>Fuse</button></div>';
    });
  } else if(forgeTab==='upgrade' && typeof upgradePanelHTML==='function'){
    h+=upgradePanelHTML();
  } else if(forgeTab==='enchant'){
    h+='<p class="c-info">Set a mote into your gear. Every enchantment works a little on its own and grows with your affinity in that element (&times;1 + 0.3 per point). Re-enchanting replaces it.</p>';
    [['weapon', player.weapon], ['armor', player.armorItem]].forEach(function(pair){
      var slot=pair[0], it=pair[1];
      h+='<div class="fslot"><b>'+(slot==='weapon'?'Main hand':'Armor')+':</b> '+(it&&!it.unarmed ? gearName(it) : '<span class="c-info">nothing to enchant</span>')+'</div><div class="egrid">';
      ELEMENTS.forEach(function(el){
        var ok=(player.motes[el]||0)>0 && it && !it.unarmed;
        h+='<button data-ench="'+slot+':'+el+'" '+(ok?'':'disabled')+' title="'+ENCHANT_TEXT[slot][el]+'"><span class="dot" style="background:'+AFF_COL[el]+'"></span>'+cap(el)+
           '<span class="d">'+ENCHANT_TEXT[slot][el]+'</span></button>';
      });
      h+='</div>';
    });
  } else {
    h+='<p class="c-info">Carve motes into sigils. Crafted sigils are always identified.</p>';
    Object.keys(SIGILS).forEach(function(k){
      var s=SIGILS[k], need={}, ok=true; s.motes.forEach(function(m){ need[m]=(need[m]||0)+1; });
      for(var m in need) if((player.motes[m]||0)<need[m]) ok=false;
      h+='<div class="frow">'+s.motes.map(function(m){ return '<span class="dot" style="background:'+AFF_COL[m]+'"></span>'; }).join('')+
         '<div class="ftext"><b>'+s.name+'</b><div class="d">'+s.desc+'</div></div><button data-craft="'+k+'" '+(ok?'':'disabled')+'>Craft</button></div>';
    });
  }
  body.innerHTML=h+'</div>';
  body.querySelectorAll('[data-ft]').forEach(function(b){ b.onclick=function(){ forgeTab=b.getAttribute('data-ft'); sfx('ui-click'); renderForge(); }; });
  body.querySelectorAll('[data-fuse]').forEach(function(b){ b.onclick=function(){ var el=b.getAttribute('data-fuse');
    confirmBox('Fuse '+el, 'Permanently gain <b>'+cap(el)+' '+((player.aff[el]||0)+1)+'</b>. This cannot be undone.', 'Fuse', function(){ fuseMote(el); }); }; });
  body.querySelectorAll('[data-up]').forEach(function(b){ b.onclick=function(){ var t=allUpgradeTargets()[+b.getAttribute('data-up')]; if(t) upgradeItem(t.it); }; });
  body.querySelectorAll('[data-ench]').forEach(function(b){ b.onclick=function(){ var p=b.getAttribute('data-ench').split(':'); enchantItem(p[0],p[1]); }; });
  body.querySelectorAll('[data-craft]').forEach(function(b){ b.onclick=function(){ craftSigil(b.getAttribute('data-craft')); }; });
  body.querySelectorAll('[data-art]').forEach(function(el){ paintArt(el, 'items', el.getAttribute('data-art'), 30); });
}
