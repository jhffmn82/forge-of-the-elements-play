/* Release history and title-screen freshness checks. Saves are never cleared. */
var FOTE_VERSION = 'Beta 1.2';
/* Keep newest first; describe only changes already present in this build. */
var FOTE_PATCHES = [
  {version:'Beta 1.2', notes:[
    "Replaced the Caverns' chirping ambience with a quieter underground music loop, and gave Chaos demons creature voices and sounds for their special attacks.",
    "Myconids now rest in place between actions. Crates, pots, urns and mushroom groups use fixed artwork so their pieces no longer disappear or overlap unpredictably.",
    "Defeated creatures leave their bodies on the floor for a while. These remains survive saving and returning to a floor without obstructing movement.",
    "Softened the Water realm's forced movement. Sirens no longer take away your turn, and groups of pulling enemies must give you time to recover.",
    "Strengthened the Deep Maw's attacks and health to make the Caverns finale more demanding.",
    "Boss cores now expand your elemental infusion limit as soon as you pick them up. Opening the exit still uses the core, and existing characters retain their progress.",
    "Corrected holy-symbol enchantment tooltips and replaced the obscured Root status icon with clear artwork.",
    "Character and equipment screens now show movement and attack speed as percentages. Chad's Living Mountain also displays its current stack count beside its remaining duration.",
    "Focused Chad's Living Mountain on offensive momentum, removing its extra defensive bonuses. Pummel activates instantly without advancing enemies.",
    "Armor still softens physical blows, but no longer erases small hits so easily. Accuracy and Evasion now have a stronger effect on whether attacks land.",
    "Deadeye and Keen Aim now also increase critical-hit damage, giving Agility builds stronger offensive rewards as they develop. The bonus applies to attacks and spells alike.",
    "Poison damage now respects the victim's resistance. Follow-up effects no longer report misleading zero damage after an enemy has already been killed.",
    "Improved enemy routes around bushes and crowded passages, including approaches from diagonal tiles.",
    "Added a craftable Sigil of Haste and strengthened Molten Ring with fire damage on attacks while its effect lasts.",
    "Every enemy now has a short lore description on its hover card, replacing detailed implementation notes with a sense of who inhabits these realms.",
    "Fixed the Matron's exit rejecting the Ruin Core. Existing saves can now unlock the gate normally and continue into the treasure room before Chaos.",
    "Opened the Realm of Chaos beyond the Matron, extending the adventure through the final encounter and the Forge of the Elements.",
    "Added a quiet treasure room before entering Chaos, with essence, Masterwork equipment, elemental motes and rations to prepare for the last biome.",
    "Chaos floors mix five floating islands drawn from four distinct realms. Portals connect islands, magical currents carry you between floors, and a dedicated elemental gateway marks the crossing to the material plane.",
    "Added animated Chaos demons with distinct attacks, status effects and immunities. Enemy groups react together to make late-game encounters more demanding.",
    "Chaos contains no god shrines; your existing faith and powers remain with you.",
    "Added the Unmaker's three-form final encounter, dedicated animation and battle music, a preparation forge and gates tied to the battle. His larger body occupies the full space shown and can be targeted across it.",
    "The Heart of Discord calls Chaos demons into the fight. Boss attack warnings use colored areas without numbers printed on the floor.",
    "Defeating the Unmaker opens the way to the Forge. Interact with it when you are ready to retire and finish the run, or keep exploring.",
    "Fixed Fear so affected players retreat, and preserved explored floors, treasure and encounter state when traveling or continuing a saved run.",
    "Strengthened Ring of Mending's regeneration and corrected its healing conversion so its displayed benefit matches actual healing each global round.",
    "Umbral Passage now leaves a shadow copy of your character to cast Shadow Bolt. It inherits your combat stats, follows you between floors, and remains until killed or replaced by another Passage."
  ]},
  {version:'Beta 1.1', notes:[
    "Improved terrain loading by removing an obsolete image request and waiting for artwork to finish loading before drawing it.",
    "Added a craftable Sigil of Transmutation for turning equipment into a different random item of the same category while preserving its quality, upgrades and existing enchantment. Canceling the selection keeps the sigil or Echo charge.",
    "Chad’s followers now use underwear versions of their existing character sprites, including movement and combat animations. Ordinary character appearances are preserved.",
    "The god of the bare fist is now Chad the Unclad. Existing characters retain their devotion and progression.",
    "Chad now refuses new dwarf worshippers. Existing dwarf followers remain loadable with their faith and equipment intact.",
    "Chad’s Living Mountain now builds strength with repeated punches, improving defense, accuracy, evasion, critical chance and damage. Divine Power helps that momentum last longer. This replaces Hardened and the old fist and body enchantments with a stronger reward for sustained melee combat.",
    "Chad’s Iron Body, Iron Hide and Pummel now activate instantly without giving enemies a turn. Their mana and Favor costs remain unchanged, and descriptions explain the timing.",
    "Extended Iron Body and strengthened Chad’s unarmored fighting style with rank-based movement and evasion bonuses, barehanded parrying, and faster punches at higher ranks.",
    "Restored direct touch dragging from inventory to the hotbar or equipment slots. Tapping still inspects an item, and releasing a drag does not use it.",
    "Made tablet inventory slots compact and arranged worn gear beside the bag so equipment stays accessible on iPad-sized screens.",
    "Fixed extra movement and actions after releasing controls during enemy animations. Busy-time key presses, taps and clicks are discarded instead of replayed later.",
    "Click-to-walk now stops immediately after taking damage during an enemy turn.",
    "Replaced Morty’s boss theme with a more driving orchestral loop and subtle crypt ambience to give the fight a stronger sense of menace.",
    "Pet movement no longer pauses your next action or the enemy sequence. Companions follow smoothly while their attacks remain animated.",
    "Enemies now finish each visible move or attack before the next creature acts, making crowded fights easier to follow. Turn order and creature speeds are unchanged.",
    "Removed duplicate terrain redraws that caused Caverns stutter. Travel, resting and saves now wait for a complete enemy turn.",
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
    "Chad now permits only holy symbols, rings and amulets. Reworked divine buffs, summons and favor rewards so their strength follows the chosen god and equipment.",
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
