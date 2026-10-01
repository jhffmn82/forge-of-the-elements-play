/* =====================================================================
   statusicons.js - status and buff icons with durations (2026-09-17).
   Your statuses and buffs show as icons along the top-left of the map, each with the turns left;
   hovering one explains it. Hovering an enemy lists its statuses the same way.
   ===================================================================== */

var STATUS_INFO = {
  /* statuses (player.st / enemy.st) */
  burn:   {name:'Burning', icon:'st-burn', bad:1, d:'Takes fire damage every turn.'},
  chill:  {name:'Chilled', icon:'st-chill', bad:1, d:'Acts more slowly; takes more frost damage.'},
  slow:   {name:'Slowed', icon:'st-slow', bad:1, d:'Acts more slowly.'},
  frozen: {name:'Frozen', icon:'st-frozen', bad:1, d:'Cannot act; 0 evasion. Damage ends Freeze. Physical hits deal double damage.'},
  root:   {name:'Rooted', icon:'ic-earth-root', bad:1, d:'Cannot move; can attack. 0 evasion.'},
  stun:   {name:'Stunned', icon:'st-stun', bad:1, d:'Cannot act; 0 evasion.'},
  fear:   {name:'Afraid', icon:'st-fear', bad:1, d:'Flees; skips its action if trapped.'},
  blind:  {name:'Blind', icon:'st-blind', bad:1, d:'Attacks miss far more often.'},
  poison: {name:'Poisoned', icon:'st-poison', bad:1, d:'Takes damage every turn and doesn\'t regenerate.'},
  rot:    {name:'Rot', icon:'st-rot', bad:1, d:'No HP regeneration. Healing is halved.'},
  wet:    {name:'Wet', icon:'ic-tidal-surge', bad:1, d:'Takes more lightning damage and less fire damage.'},
  corrupt:{name:'Corrupted', icon:'ic-shadow-swarm', bad:1, d:'Takes 25% more shadow damage. If you kill it, its shade may rise to serve you.'},
  hollow: {name:'Hollowed', icon:'ic-shadow-bolt', bad:1, d:'Takes more damage from every source and has less armor, more with each stack.'},
  stone:  {name:'Stone skin', icon:'st-stone', d:'Immune to Poison, poison damage and Stun. -3 physical damage per hit. Clears Poison and Stun on use.'},
  aura:   {name:'Unholy Aura', icon:'pr-unholyaura', d:'Enemies within 2 tiles take shadow damage each turn, healing you for each enemy hit.'},
  goblinrage:{name:'Goblin Rage',icon:'pr-rampage',d:'+30% movement and action speed for 4 turns.'},
  sporecoat:{name:'Sporecoat',icon:'st-stone',d:'Absorbs damage for up to 3 turns.'},
  boneward:{name:'Bone Ward',icon:'ic-arcane-ward',d:'A Necro-Acolyte\'s ward blocks the next damaging hit.'},
  /* 2026-09-23 (Justin): the Challenge and Coward's Mark show on the foe as debuffs */
  challenged:{name:'Challenged', icon:'st-challenged', bad:1, d:'Must approach you. Takes +25% weapon damage; deals less damage to you from rank 3.'},
  coward:    {name:"Coward's Mark", icon:'st-coward', bad:1, d:'Must approach you. Deals less damage to you; takes +25% weapon damage.'},
  /* buffs (player.buffs) */
  rampage:   {name:'Rampage', icon:'pr-rampage', d:'More melee damage and faster melee attacks.'},
  ironhide:  {name:'Iron Hide', icon:'pr-ironhide', d:'Extra armor and a shield.'},
  ironbody:  {name:'Iron Body', icon:'ic-iron-body', d:'Extra armor, and your unarmed hits may Stun.'},
  laststand: {name:'Last Stand', icon:'pr-laststand', d:'You take half damage.'},
  rally:     {name:'Rally', icon:'pr-rally', d:'+10% damage and spell power.'},
  temper:    {name:'Temper', icon:'ic-temper', d:'Increased weapon damage and armor.'},
  arcaneward:{name:'Ward', icon:'ic-arcane-ward', d:'Absorbs damage.'},
  haste:     {name:'Haste', icon:'ic-flame-step', d:'Movement, attacks and spellcasting are 30% faster.'},
  moltenring:{name:'Molten Ring', icon:'ic-firebolt', d:'Attacks and single-target spells deal 5 additional fire damage.'},
  cinder:    {name:'Cinder Stride', icon:'ic-flame-step', d:'Faster, leaving fire where you step.'},
  manaflow:  {name:'Mana Flow', icon:'pr-manatide', d:'Mana returns twice as fast.'},
  afterglow: {name:'Afterglow', icon:'ic-heal', d:'Heal 5% max HP per turn.'},
  discipline:{name:"Warrior's Discipline", icon:'ic-charge', d:'+2 damage per stack, up to one stack per rank. Every ability you use adds a stack and renews them all.'},   /* 2026-09-29 (Justin): Grumbok rank 5; Charge's icon, no new art */
  thorns:    {name:'Thorns', icon:'ic-earth-root', d:'Enemies that hit you in melee take half the damage back.'},
  regeneration:{name:'Regeneration',icon:'item-honeycake',d:'Heals 1% of your maximum HP each turn.'},
  might:     {name:'Might',icon:'item-meat',d:'Weapon damage is increased by 20%.'},
  poisonward:{name:'Poison Ward',icon:'item-skewer',d:'Poison cannot hurt you.'},
  shadeward: {name:'Shadow Ward',icon:'item-graveplum',d:'Shadow damage is halved.'},
  stormward: {name:'Storm Ward',icon:'item-glowstew',d:'Your light reaches farther, and lightning damage is halved.'},
  fireward:  {name:'Fire Ward',icon:'item-emberpepper',d:'Fire damage is halved.'},
  starward:  {name:'Star Ward',icon:'item-starfruit',d:'Elemental damage is reduced by 20%.'},
  stormform: {name:'Storm Form',icon:'ic-storm-form',d:'Movement and action time halved. Instant cast.'},
  wizardhunter:{name:'Wizard Hunter',icon:'ic-charge',d:'After being hurt by magic, elemental damage or a ranged attack, movement and attacks are faster for 3 turns.'},
  /* other timers on the player */
  hidden:    {name:'Hidden', icon:'st-hidden', d:'Enemies can\'t see you; your next hit is a surprise attack.'},
  stillness: {name:'Stillness', icon:'item-amulet', unit:'steps', d:'Moving costs no time for the remaining steps. Attacking or any other action ends Stillness.'},
  resolve:   {name:'Resolve',icon:'st-stone',d:'Immune to Stun, Root, Freeze and knockback.'},
  snuffed:   {name:'Light Snuffed',icon:'st-blind',bad:1,d:'Light radius reduced to 2 tiles.'},
  levitate:  {name:'Floating', icon:'st-floating', d:'Cross chasms and water; ignore roots, webs, floor traps and ground hazards. Clears roots and webs on use.'}
};

/* icon art as data URLs, so tooltips (HTML strings) can show them too */
var STATUS_ICON_URL = {};
function statusIconURL(icon){
  if(STATUS_ICON_URL[icon]!==undefined) return STATUS_ICON_URL[icon];
  var o=objArt('icons', icon) || (typeof anyObj==='function' && anyObj(icon));
  if(!o || !o.img || !(o.img.complete===undefined || o.img.complete)) return '';
  try{
    // Keep the atlas crop at native resolution. HUDs and tooltips choose their
    // display size without enlarging a pre-shrunk 32-pixel thumbnail.
    var c=document.createElement('canvas'); c.width=c.height=Math.max(o.sw,o.sh); var g=c.getContext('2d');
    g.drawImage(o.img, o.sx, o.sy, o.sw, o.sh, Math.floor((c.width-o.sw)/2), Math.floor((c.height-o.sh)/2), o.sw, o.sh);
    STATUS_ICON_URL[icon]=c.toDataURL();
  }catch(e){ STATUS_ICON_URL[icon]=''; }
  return STATUS_ICON_URL[icon];
}
function statusList(e){
  var out=[];
  if(!e) return out;
  for(var k in (e.st||{})){ if(k.indexOf('imm_')===0) continue; var s=e.st[k]; if(!s || !(s.t>0)) continue; out.push({k:k, t:s.t}); }
  if(e!==player && e.challenged) out.push({k:e.cowardMark?'coward':'challenged', t:e.challengeUntil>player.t?Math.ceil((e.challengeUntil-player.t)/100):e.challengeT||0});   /* a Cleric's Challenge has no timer: 0 shows no count */
  if(e.boneWard)out.push({k:'boneward',t:0});
  if(e!==player&&e.rallyUntil>player.t)out.push({k:'rally',t:Math.ceil((e.rallyUntil-player.t)/100)});
  if(e===player){
    for(var b in (player.buffs||{})) if(b!=='hardened'&&player.buffs[b]>0) out.push({k:b, t:player.buffs[b]});
    if(player.hidden>0) out.push({k:'hidden', t:player.hidden});
    if(player.levitate>0) out.push({k:'levitate', t:player.levitate});
    if(player.stillness>0)out.push({k:'stillness',t:player.stillness});
    if(player.snuffed>0)out.push({k:'snuffed',t:player.snuffed});
    if(player.resolveUntil>player.t)out.push({k:'resolve',t:Math.ceil((player.resolveUntil-player.t)/100)});
    if(player.stormUntil>player.t)out.push({k:'stormform',t:Math.ceil((player.stormUntil-player.t)/100)});
    if(player.wizardHunterUntil>player.t)out.push({k:'wizardhunter',t:Math.ceil((player.wizardHunterUntil-player.t)/100)});
  }
  return out.map(function(o){
    var I=STATUS_INFO[o.k] || {name:cap(o.k), icon:'ic-arcane-ward', d:''};
    /* Sylla's web starts as Root, then becomes Slow. Show silk in both phases. */
    if(o.k==='root'&&(e.syllaWeb>0||e.st.root.effect==='web')) I={name:'Webbed',icon:'st-web',bad:1,d:'Cannot move; 0 evasion. Movement and action speed halved after release.'};
    if(o.k==='slow'&&e.st.slow.effect==='web')I={name:'Webbed',icon:'st-web',bad:1,d:'Movement and action speed halved.'};
    if(o.k==='stillness'){
      var amulet=e.amulet,look=typeof RUN!=='undefined'&&RUN.amuletLook&&RUN.amuletLook.stillness;
      I=Object.assign({},I,{icon:amulet&&amulet.amulet==='stillness'&&amulet.icon||look&&'item-amulet-'+look||I.icon});
    }
    if(o.k==='rally'&&e!==player)I=Object.assign({},I,{d:'Rallied: attacks deal 10% more damage.'});
    if(o.k==='stone'&&e!==player) I={name:'Petrified',icon:'st-stone',bad:1,d:'Can\'t move or act. Evasion is 0.'};
    if(o.k==='livingmountain'||o.k==='discipline') I=Object.assign({},I,{name:I.name+' ×'+(e.st[o.k].n||0)});
    return {k:o.k, t:o.t, unit:I.unit||'turns', stacks:o.k==='livingmountain'?Math.min(10,e.st.livingmountain.n||0):o.k==='discipline'?(e.st.discipline.n||0):0, name:I.name, icon:I.icon, d:I.d, bad:!!I.bad};
  });
}

(function(){
  var st=document.createElement('style');
  st.textContent=[
    '#statusbar{position:absolute;left:8px;top:8px;z-index:6;display:flex;flex-wrap:wrap;gap:4px;max-width:60%;pointer-events:none}',
    '#statusbar .sico{pointer-events:auto;position:relative;width:34px;height:34px;border-radius:6px;border:1px solid #6B8A5A;background:rgba(18,15,13,.82);display:flex;align-items:center;justify-content:center}',
    '#statusbar .sico.bad{border-color:#A04A3A}',
    '#statusbar .sico img{width:26px;height:26px;image-rendering:auto}',
    '#statusbar .sico .n{position:absolute;right:2px;bottom:0;font-size:11px;font-weight:700;color:#fff;text-shadow:0 0 2px #000,0 1px 2px #000}',
    '#statusbar .sico .stacks{position:absolute;left:1px;top:0;padding:0 2px;border-radius:3px;background:rgba(18,15,13,.85);font-size:12px;font-weight:700;color:var(--gold);text-shadow:0 1px 2px #000}',
    '#statusbar .sico .fb{font-size:10px;color:var(--ash)}',
    '#fx{display:none!important}',
    '.tipstat{display:flex;align-items:center;gap:6px;margin-top:3px;font-size:11.5px}',
    '.tipstat img{width:18px;height:18px;image-rendering:auto}',
    '.tipstat b{color:var(--ink)} .tipstat .bad{color:#E08070} .tipstat .t{color:var(--dim)}'
  ].join('\n');
  document.head.appendChild(st);
  function mount(){ var m=$('map'); if(!m) return false; if(!$('statusbar')){ var d=document.createElement('div'); d.id='statusbar'; m.appendChild(d); } return true; }
  if(!mount()){ var n=0, t=setInterval(function(){ if(mount() || ++n>40) clearInterval(t); }, 100); }
})();

function renderStatusBar(){
  if(typeof hideCard==='function')hideCard();
  var bar=$('statusbar'); if(!bar || !player) return;
  var list=statusList(player);
  bar.innerHTML=list.map(function(s, i){
    var url=statusIconURL(s.icon);
    return '<div class="sico'+(s.bad?' bad':'')+'" data-si="'+i+'" aria-label="'+s.name+(s.t>0?', '+s.t+' '+s.unit:'')+'">'+(url?'<img src="'+url+'" alt="">':'<span class="fb">'+s.name.slice(0,3)+'</span>')+(s.stacks?'<span class="stacks">×'+s.stacks+'</span>':'')+'<span class="n">'+(s.t>0?s.t:'')+'</span></div>';
  }).join('');
  bar.querySelectorAll('[data-si]').forEach(function(el){
    var s=list[+el.getAttribute('data-si')];
    if(typeof hoverCard==='function') hoverCard(el, function(){ return '<div class="nm">'+s.name+'</div>'+(s.stacks?'<div class="row"><span>Stacks</span><b>'+s.stacks+' / 10</b></div>':'')+(s.t>0?'<div class="row"><span>'+cap(s.unit)+' left</span><b>'+s.t+'</b></div>':'')+'<div class="hint">'+s.d+'</div>'; });
  });
  if(typeof FoteResponsiveHUD!=='undefined')FoteResponsiveHUD.renderStatusMeter();
}


/* hovering an enemy lists its statuses */
var _inspectHTMLStatus = inspectHTML;
inspectHTML = function(mx, my){
  var h=_inspectHTMLStatus(mx, my); if(!h) return h;
  var e=ents.filter(function(o){ return o.x===mx && o.y===my && o!==player; })[0];
  if(!e || !(revealAll||vis[idxOf(mx,my)])) return h;
  var list=statusList(e);
  /* drop the old plain-text tag line; the icon rows replace it */
  h=h.replace(/<div style="margin-top:4px">(<span class="tag[^>]*>[^<]*<\/span>\s*)+<\/div>/, '');
  if(!list.length) return h;
  var rows=list.map(function(s){ var url=statusIconURL(s.icon); return '<div class="tipstat">'+(url?'<img src="'+url+'" alt="">':'')+'<b class="'+(s.bad?'bad':'')+'">'+s.name+'</b>'+(s.t>0?'<span class="t">'+s.t+' turn'+(s.t===1?'':'s')+'</span>':'')+'</div>'; }).join('');
  var at=h.indexOf('<div class="odds">');
  return at>=0 ? h.slice(0,at)+rows+h.slice(at) : h+rows;
};

STATUS_INFO.communion={name:'Communion',icon:'ic-arcane-ward',d:'Damaging attacks earn Favor once per action, even after the shield breaks.'};
