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
var ENCHANT_TEXT = FoteEnchantments.formulaTable();
var forgeTab='fuse';


function openForge(){
  sfx('forge-open'); forgeTab='fuse';
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
  } else if(forgeTab==='enchant'){h+=enchantPanelHTML();} else if(forgeTab==='recycle'){h+=recyclePanelHTML();} else {
    h+='<p class="c-info">Carve motes into sigils. Crafted sigils are always identified. Each recipe lists its essence and mote cost.</p>';
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
  wireForgePanels(body);
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
