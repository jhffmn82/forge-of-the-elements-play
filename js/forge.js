/* ============================================================================
   forge.js - the Elemental Forge: fuse motes into affinity, enchant gear, craft sigils.
   ========================================================================== */

var T1_TEXT = {
  fire:'+1 fire damage on every hit, per point',
  water:'Ice Armor: absorbs 3 damage per point, recharges out of combat',
  air:'+10% movement speed per point',
  earth:'Stone Skin: -1 physical damage per hit, per point',
  light:'10% chance per point that your hits Smite: 3-6 light damage, +1 per Light point',
  shadow:'+5% crit chance per point against enemies that can\'t see you'
};
/* 2026-09-23 (Justin): the sheet's element lines show the live total at the current affinity, not only the rate */
var T1_LIVE = {
  fire:   function(n){ return '+'+n+' fire damage on every hit (1 per point)'; },
  water:  function(n){ return 'Ice Armor: absorbs '+(3*n)+' damage (3 per point), recharges out of combat'; },
  air:    function(n){ return '+'+(10*n)+'% movement speed (10% per point)'; },
  earth:  function(n){ return 'Stone Skin: -'+n+' physical damage per hit (1 per point)'; },
  light:  function(n){ return (10*n)+'% chance that your hits Smite: '+(3+n)+'-'+(6+n)+' light damage (10% and +1 per point)'; },
  shadow: function(n){ return '+'+(5*n)+'% crit chance against enemies that can\'t see you (5% per point)'; }
};
function t1Text(e, n){ return (T1_LIVE[e] && n>0) ? T1_LIVE[e](n) : (T1_TEXT[e]||''); }
var ENCHANT_TEXT = {
  weapon:{fire:'10% of each hit as fire (+3% per Fire point); 5% Burning chance per Fire point', water:'15% chance to Chill (+5% per Water point)',
          air:'5% chance per Air point (min 5%) of an instant extra attack', earth:'15% chance to Root (grows with Earth)',
          light:'+10 accuracy (grows with Light); +25% vs undead and shadow', shadow:'5% chance per Shadow point (min 5%): +25% dark damage and Corrupt; +1 damage to Hollowed targets'},
  armor: {fire:"Resistance to fire: 10% +5% per Fire mastery; maximum HP +5% +3% per Fire mastery.",
water:"Resistance to water: 10% +5% per Water mastery; evasion +8 +2.4 per Water mastery.",
air:"Resistance to air: 10% +5% per Air mastery; ranged projectile deflection 5% +3% per Air mastery (excludes area effects).",
earth:"Resistance to earth: 10% +5% per Earth mastery; armor +1 +0.3 per Earth mastery.",
light:"Resistance to light: 10% +5% per Light mastery; HP regeneration +50% +15% per Light mastery.",
shadow:"Resistance to shadow: 10% +5% per Shadow mastery; stealth +5% per Shadow mastery (minimum 5%)."}
};
var forgeTab='fuse';

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
  if(RACES[player.race].locked && primary && !aff[el] && els.length===1 && false) return '';
  return null;
}
function fuseMote(el){
  var why=fuseCheck(el); if(why){ log(why,'c-info'); sfx('ui-error'); return; }

  player.motes[el]--; if(player.motes[el]<=0) delete player.motes[el];
  if(!Object.keys(player.aff).length) player.primary=el;
  player.aff[el]=(player.aff[el]||0)+1;
  var before=player.abilities.slice();
  derive(player); player.iceArmor=player.iceArmorMax;
  log('The Forge burns the mote into you. <b>'+cap(el)+' '+player.aff[el]+'</b>: '+t1Text(el, player.aff[el])+'.','c-kill');
  sfx('forge-fuse'); sparkleFx(player.x,player.y,TRAIL_EL(el),50); ringFx(player.x,player.y,AFF_COL[el],3);
  player.abilities.forEach(function(k){ if(before.indexOf(k)<0){ log('<b>New spell: '+ABILITIES[k].name+'</b> &mdash; '+(typeof liveDesc==='function' ? liveDesc(ABILITIES[k]) : ABILITIES[k].desc),'c-kill'); sfx('new-ability'); } });
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
  var ess = (typeof sigilEssence==='function') ? sigilEssence(key) : 0;
  if(ess > (player.essence||0)){ log('Carving a <b>'+s.name+'</b> takes <b>'+ess+' essence</b>; you have '+(player.essence||0)+'.','c-info'); sfx('ui-error'); return; }
  if(player.bag.length>=BAG_MAX && !player.bag.some(function(b){ return b.uid==='sigil:'+key; })){ log('Your bag is full.','c-info'); return; }
  for(var m2 in need){ player.motes[m2]-=need[m2]; if(player.motes[m2]<=0) delete player.motes[m2]; }
  if(ess){ if(typeof spendEssence==='function') spendEssence(ess); else player.essence-=ess; }
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
        '<div>Essence: <b style="color:var(--gold);font-size:15px">'+player.essence+'</b></div></div></div>'+
        '<div class="ftabs">'+['fuse','enchant','upgrade','craft'].map(function(t){ return '<button data-ft="'+t+'" class="'+(forgeTab===t?'on':'')+'">'+{fuse:'Fuse',enchant:'Enchant',upgrade:'Upgrade',craft:'Craft sigils'}[t]+'</button>'; }).join('')+'</div><div class="fpanel">';
  if(forgeTab==='fuse'){
    h+='<p class="c-info">Burn a mote into yourself for a point of affinity. Two elements at most, never opposites, and the second can never outgrow the first. Permanent.</p>';
    ELEMENTS.forEach(function(el){
      var why=fuseCheck(el), cur=player.aff[el]||0, nextT=cur+1;
      var unlock = nextT===1 ? t1Text(el, 1) : nextT===2 ? 'Tier 2 spell: '+ABILITIES[ELEMENT_ABILS[el][2]].name+' &mdash; '+ABILITIES[ELEMENT_ABILS[el][2]].desc : 'Tier '+nextT+' (a later biome)';
      h+='<div class="frow"><span class="dot" style="background:'+AFF_COL[el]+'"></span><div class="ftext"><b>'+cap(el)+' '+cur+' &rarr; '+nextT+'</b><div class="d">'+unlock+'</div>'+
         (why?'<div class="d c-you">'+why+'</div>':'')+'</div><button data-fuse="'+el+'" '+(why?'disabled':'')+'>Fuse</button></div>';
    });
  } else if(forgeTab==='upgrade' && typeof upgradePanelHTML==='function'){
    h+=upgradePanelHTML();
  } else if(forgeTab==='enchant'){
    h+='<p class="c-info">Set a mote into your gear. Each enchantment shows its base effect and how it grows with matching mastery. Re-enchanting replaces it.</p>';
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
    h+='<p class="c-info">Carve motes into sigils. Crafted sigils are always identified. The carving costs essence as well as motes: 100 for one mote, 200 for two, 500 for Ascension, 5000 for Wisdom.</p>';
    Object.keys(SIGILS).forEach(function(k){
      var s=SIGILS[k], need={}, ok=true; s.motes.forEach(function(m){ need[m]=(need[m]||0)+1; });
      for(var m in need) if((player.motes[m]||0)<need[m]) ok=false;
      var ess=(typeof sigilEssence==='function') ? sigilEssence(k) : 0;
      if(ess > (player.essence||0)) ok=false;
      h+='<div class="frow">'+s.motes.map(function(m){ return '<span class="dot" style="background:'+AFF_COL[m]+'"></span>'; }).join('')+
         '<div class="ftext"><b>'+s.name+'</b><div class="d">'+s.desc+'</div></div>'+
         '<span class="val" style="white-space:nowrap">'+ess+' essence</span>'+
         '<button data-craft="'+k+'" '+(ok?'':'disabled')+'>Craft</button></div>';
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

/* ---------------------------------------------------------------- the Forge says what it did (2026-09-20)
   Justin: "when crafting or anything at the forge, some sort of acknowledgement should pop up that you crafted
   something". The Forge's own panel covers the message log, so the line it wrote went unseen. Every fuse, enchant,
   upgrade and carving now leaves a banner across the top of the panel for a few seconds. */
function forgeSay(html, kind){
  var body=document.querySelector('.fpanel') || document.getElementById('forgeBody') || document.querySelector('#shade .sheet');
  if(!body) return;
  var el=document.getElementById('forgeSaid');
  if(!el){
    el=document.createElement('div'); el.id='forgeSaid';
    el.style.cssText='margin:0 0 8px;padding:8px 10px;border-radius:6px;border:1px solid var(--gold);'+
      'background:linear-gradient(180deg,rgba(232,180,74,.18),rgba(232,180,74,.06));color:var(--ink);font-size:13px';
    body.insertBefore(el, body.firstChild);
  }
  el.style.borderColor = kind==='bad' ? '#D0605A' : 'var(--gold)';
  el.innerHTML=html;
  clearTimeout(el._t); el._t=setTimeout(function(){ if(el && el.parentNode) el.remove(); }, 6000);
}
var _craftSigilSay = craftSigil;
craftSigil = function(key){
  var before=(player.bag||[]).length, r=_craftSigilSay.apply(this, arguments);
  var S=(typeof SIGILS!=='undefined' && SIGILS[key]); if(S && (player.bag||[]).length!==before) forgeSay('Carved: <b>'+S.name+'</b> &mdash; '+S.desc);
  return r;
};
var _fuseMoteSay = fuseMote;
fuseMote = function(el){
  var b=(player.aff&&player.aff[el])||0, r=_fuseMoteSay.apply(this, arguments), a=(player.aff&&player.aff[el])||0;
  if(a>b) forgeSay('The <b>'+cap(el)+'</b> mote takes root in you: affinity <b>'+a+'</b>.');
  return r;
};
var _enchantItemSay = enchantItem;
enchantItem = function(slot, el){
  var r=_enchantItemSay.apply(this, arguments);
  var it = slot==='ranged' ? player.ranged : slot==='off' ? player.off : slot==='armor' ? player.armorItem : player.weapon;
  if(it && it.enchant===el) forgeSay('Your <b>'+gearName(it)+'</b> takes the '+cap(el)+' enchantment.');
  return r;
};
if(typeof upgradeItem==='function'){
  var _upgradeItemSay = upgradeItem;
  upgradeItem = function(it){
    var was=it && (it.plus||0), wasCursed=it && it.cursed, r=_upgradeItemSay.apply(this, arguments);
    if(it && wasCursed && !it.cursed) forgeSay('The Forge burns the curse out of your <b>'+gearName(it)+'</b>.');
    else if(it && (it.plus||0)>was) forgeSay('Your <b>'+gearName(it)+'</b> comes off the anvil stronger.');
    return r;
  };
}
