/* Release history and title-screen freshness checks. Saves are never cleared. */
var FOTE_VERSION = 'Beta 1.1';
/* Keep newest first; describe only changes already present in this build. */
var FOTE_PATCHES = [
  {version:'Beta 1.1', notes:[
    "Rebuilt the core engine to make combat, equipment, summons and turn timing more consistent while preserving the existing interface and artwork.",
    "Improved Caverns terrain rendering to reduce stutter when exploring new areas.",
    "Unified status-effect rules so frost counts as a slow for Unstoppable and webs count as roots for abilities that benefit from rooted enemies.",
    "Strengthened save validation and recovery while retaining support for existing characters and explored floors.",
    "Fixed repeated hits against multipart enemies from a single area attack, surfaced Maw rendering, and canceled Echo casts creating extra sigils.",
    "Softened hotbar background colors so ability artwork stands out more clearly.",
    "Strengthened Shadow Swarm and made its health, damage and lifetime scale with Spell Power. Its shades now share the darker, translucent summon artwork and benefit from Murk’s Grave Strength.",
    "Barricade inspect cards now describe flammable wood instead of a nearby mechanism.",
    "Fixed touch inventory cards closing before Drop or Use could activate.",
    "Corrected Ring of Mending’s exaggerated healing tooltip to show its actual regeneration rate.",
    "Added Nature’s Bounty, a craftable sigil that creates a Honeycake, Mushroom Skewer, and Moonberry Tart nearby.",
    "Restored food satiety so meals fill the hunger bar as much as they originally did.",
    "Prayers now have explicit ability icons, including new artwork for Bone Spear and Vellum’s divine attacks.",
    "Shades raised by shadow weapon enchantments now use the animated shade sprite with darker, translucent coloring.",
    "Levers now show an interaction cursor and an inspect card explaining their purpose and whether they have already been pulled.",
    "Added readable patch history and update checks under the version-number button. Removed Exit Game and Install App from the title menu; browser installation remains available through browser controls. Updates preserve saves.",
    "Reworked divine abilities around Divine Power. Invocations spend mana; prayers spend divine favor. God restrictions prevent forbidden actions, and Clerics keep their chosen god.",
    "Grom now permits only holy symbols, rings and amulets. Reworked divine buffs, summons and favor rewards so their strength follows the chosen god and equipment.",
    "Vellum now offers Communion, repeatable divine attacks, stronger equipment passives and chances for knockback and free casting. Two-handed weapons and bows are forbidden.",
    "Wobbles now gains amusement during combat, slowly loses it during quiet exploration, and spends it on powers. High amusement brings rewards; an empty bar invites mischief.",
    "Rebalanced armor, shield, orb and tome enchantments to offer more defensive and offensive choices. All attacks and spells share critical-hit chance and critical damage.",
    "Forge enchant descriptions show scaling formulas; equipped items show their current bonuses. Divine Power now appears below Spell Power on character sheets.",
    "Raised advanced spell costs, strengthened enemies in selected biomes, and increased hunger drain to improve resource planning and late-game difficulty.",
    "Added area previews and lingering impact highlights for targeted area spells. Shortened Vanishing and made offensive spellcasting break concealment.",
    "Reworked puzzle interactions, added guardian shutoff switches, made barricades block entry, and gave levitation and elemental solutions clearer practical roles. Crystal rewards are inspected by hovering.",
    "Strengthened Living Flame, extended its duration, added splash attacks and replaced its art with a smaller animated fire elemental. Burning effects now use translucent animated flames.",
    "Enemies now react to summon attacks. Sylla webs apply Bleed and count as Root for Earth mastery, while her poison abilities retain their own effects.",
    "Added ambient dungeon loops and more dramatic boss music, including a replacement Crypt theme. Title and character-selection music remain unchanged.",
    "Improved hotbar readability, fixed amulet charge displays and floating firepit shadows, corrected descriptions, and consolidated superseded god and enchantment implementations."
]},
  {version:'Beta 1.0', notes:['Initial beta release.']}
];
var foteVersionState = {message:'Checking for updates…', latest:null, pending:null};
function foteBuild(){ return (document.querySelector('meta[name="fote-build"]')||{}).content||'dev'; }
function paintVersionStatus(){
  ['versionStatus','versionPanelStatus'].forEach(function(id){ var el=document.getElementById(id); if(el)el.textContent=(id==='versionPanelStatus'?FOTE_VERSION+' · ':'')+foteVersionState.message; });
  var b=document.getElementById('versionInstall'); if(b)b.hidden=!foteVersionState.latest;
}
function checkGameVersion(){
  if(foteVersionState.pending)return foteVersionState.pending;
  if(foteBuild()==='dev'){ foteVersionState.message='Development build'; paintVersionStatus(); return Promise.resolve(); }
  foteVersionState.message='Checking for updates…'; paintVersionStatus();
  foteVersionState.pending=(async function(){
    var controller=typeof AbortController==='function'?new AbortController():null;
    var timer=controller?setTimeout(function(){controller.abort();},8000):null;
    try{
      var r=await fetch('build.json?t='+Date.now(),{cache:'no-store',signal:controller?controller.signal:undefined});
      if(!r.ok)throw new Error('Unavailable');
      var b=await r.json(); if(!b||typeof b.built!=='string'||!b.built)throw new Error('Invalid build');
      foteVersionState.latest=b.built!==foteBuild()?b:null;
      foteVersionState.message=foteVersionState.latest?'Update available — open Version to install':'Up to date';
    }catch(e){ foteVersionState.latest=null; foteVersionState.message='Unable to check for updates. Your installed copy is available.'; }
    finally{ if(timer)clearTimeout(timer); foteVersionState.pending=null; paintVersionStatus(); }
  })();
  return foteVersionState.pending;
}
function showVersion(){
  var html='<p id="versionPanelStatus" role="status"></p><button id="versionInstall" hidden>Install update</button><button id="versionCheck">Check again</button>';
  FOTE_PATCHES.forEach(function(p){ html+='<section><h3>'+p.version+'</h3><ul>'+p.notes.map(function(n){return '<li>'+n+'</li>';}).join('')+'</ul></section>'; });
  openModal('Version',html,[{label:'Close',fn:closeModal}]);
  document.getElementById('modal').style.zIndex='70';
  document.getElementById('versionInstall').onclick=function(){forceUpdate(this);};
  document.getElementById('versionCheck').onclick=checkGameVersion;
  paintVersionStatus();
}
async function forceUpdate(btn){
  await checkGameVersion(); var b=foteVersionState.latest; if(!b)return;
  if(btn){btn.disabled=true;btn.textContent='Installing…';}
  try{
    if(navigator.serviceWorker){var regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.filter(function(r){return r.scope===new URL('./',location.href).href;}).map(function(r){return r.unregister();}));}
    if(window.caches){var ks=await caches.keys();await Promise.all(ks.filter(function(k){return k.indexOf('astra-temple-')===0;}).map(function(k){return caches.delete(k);}));}
    var url=new URL(location.href);url.searchParams.set('b',b.built);location.replace(url.href);
  }catch(e){ if(btn){btn.disabled=false;btn.textContent='Retry update';} foteVersionState.message='Update could not be installed. Please try again.';paintVersionStatus(); }
}
/* Installed apps may return from suspension without rebuilding the title menu. */
document.addEventListener('visibilitychange',function(){var t=document.getElementById('title');if(!document.hidden&&t&&t.classList.contains('on'))checkGameVersion();});
window.addEventListener('load',function(){var t=document.getElementById('title');if(t&&t.classList.contains('on'))checkGameVersion();});
