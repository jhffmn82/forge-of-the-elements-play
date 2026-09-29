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
  frozen: {name:'Frozen', icon:'st-frozen', bad:1, d:'Can\'t act. Evasion is 0. Any damage breaks the ice; a physical hit shatters it for double damage.'},
  root:   {name:'Rooted', icon:'ic-earth-root', bad:1, d:'Can\'t move, but can still attack. Evasion is 0.'},
  stun:   {name:'Stunned', icon:'st-stun', bad:1, d:'Can\'t act. Evasion is 0.'},
  fear:   {name:'Afraid', icon:'st-fear', bad:1, d:'Flees instead of fighting, and cowers in place when there is nowhere to run.'},
  blind:  {name:'Blind', icon:'st-blind', bad:1, d:'Attacks miss far more often.'},
  poison: {name:'Poisoned', icon:'st-poison', bad:1, d:'Takes damage every turn and doesn\'t regenerate.'},
  wet:    {name:'Wet', icon:'ic-tidal-surge', bad:1, d:'Takes more lightning damage and less fire damage.'},
  corrupt:{name:'Corrupted', icon:'ic-shadow-swarm', bad:1, d:'Takes 25% more shadow damage. If you kill it, its shade may rise to serve you.'},
  hollow: {name:'Hollowed', icon:'ic-shadow-bolt', bad:1, d:'Takes more damage from every source and has less armor, more with each stack.'},
  stone:  {name:'Stone skin', icon:'st-stone', d:'Physical hits deal 3 less damage.'},
  aura:   {name:'Unholy Aura', icon:'pr-unholyaura', d:'Enemies within 2 tiles take shadow damage each turn, healing you for each enemy hit.'},
  /* 2026-09-23 (Justin): the Challenge and Coward's Mark show on the foe as debuffs */
  challenged:{name:'Challenged', icon:'st-challenged', bad:1, d:'Called out: it must come to you and fight. You deal it 25% more damage and, from rank 3, take less from it.'},
  coward:    {name:"Coward's Mark", icon:'st-coward', bad:1, d:'It struck from afar, so Sir Reginald marked it. It must come to you, deals you less damage and takes 25% more from you.'},
  /* buffs (player.buffs) */
  rampage:   {name:'Rampage', icon:'pr-rampage', d:'More melee damage and faster melee attacks.'},
  ironhide:  {name:'Iron Hide', icon:'pr-ironhide', d:'Extra armor and a shield.'},
  ironbody:  {name:'Iron Body', icon:'ic-iron-body', d:'Extra armor, and your unarmed hits may Stun.'},
  laststand: {name:'Last Stand', icon:'pr-laststand', d:'You take half damage.'},
  rally:     {name:'Rally', icon:'pr-rally', d:'+10% damage and spell power.'},
  temper:    {name:'Temper', icon:'ic-temper', d:'Your weapon hits harder and your armor is thicker.'},
  arcaneward:{name:'Ward', icon:'ic-arcane-ward', d:'A ward absorbs damage.'},
  haste:     {name:'Haste', icon:'ic-flame-step', d:'Movement, attacks and spellcasting are 30% faster.'},
  moltenring:{name:'Molten Ring', icon:'ic-firebolt', d:'Attacks and single-target spells deal 5 additional fire damage.'},
  cinder:    {name:'Cinder Stride', icon:'ic-flame-step', d:'Faster, leaving fire where you step.'},
  manaflow:  {name:'Mana Flow', icon:'pr-manatide', d:'Mana returns twice as fast.'},
  afterglow: {name:'Afterglow', icon:'ic-heal', d:'Light lingers: you heal 5% of your max HP each turn.'},
  discipline:{name:"Warrior's Discipline", icon:'ic-charge', d:'+2 damage per stack, up to one stack per rank. Every ability you use adds a stack and renews them all.'},   /* 2026-09-29 (Justin): Grumbok rank 5; Charge's icon, no new art */
  thorns:    {name:'Thorns', icon:'ic-earth-root', d:'Enemies that hit you in melee take half the damage back.'},
  /* other timers on the player */
  hidden:    {name:'Hidden', icon:'st-hidden', d:'Enemies can\'t see you; your next hit is a surprise attack.'},
  levitate:  {name:'Floating', icon:'ic-storm-form', d:'Cross chasms and water; floor traps don\'t trigger.'}
};

/* icon art as data URLs, so tooltips (HTML strings) can show them too */
var STATUS_ICON_URL = {};
function statusIconURL(icon){
  if(STATUS_ICON_URL[icon]!==undefined) return STATUS_ICON_URL[icon];
  var o=objArt('icons', icon) || (typeof anyObj==='function' && anyObj(icon));
  if(!o || !o.img || !(o.img.complete===undefined || o.img.complete)) return '';
  try{
    var c=document.createElement('canvas'); c.width=32; c.height=32; var g=c.getContext('2d'); g.imageSmoothingEnabled=false;
    g.drawImage(o.img, o.sx, o.sy, o.sw, o.sh, 0, 0, 32, 32);
    STATUS_ICON_URL[icon]=c.toDataURL();
  }catch(e){ STATUS_ICON_URL[icon]=''; }
  return STATUS_ICON_URL[icon];
}
function statusList(e){
  var out=[];
  if(!e) return out;
  for(var k in (e.st||{})){ if(k.indexOf('imm_')===0) continue; var s=e.st[k]; if(!s || !(s.t>0)) continue; out.push({k:k, t:s.t}); }
  if(e!==player && e.challenged) out.push({k:e.cowardMark?'coward':'challenged', t:e.challengeT||0});   /* a Cleric's Challenge has no timer: 0 shows no count */
  if(e===player){
    for(var b in (player.buffs||{})) if(b!=='hardened'&&player.buffs[b]>0) out.push({k:b, t:player.buffs[b]});
    if(player.hidden>0) out.push({k:'hidden', t:player.hidden});
    if(player.levitate>0) out.push({k:'levitate', t:player.levitate});
  }
  return out.map(function(o){
    var I=STATUS_INFO[o.k] || {name:cap(o.k), icon:'', d:''};
    /* Sylla's web starts as Root, then becomes Slow. Show silk in both phases. */
    if(o.k==='root'&&e.syllaWeb>0) I={name:'Webbed',icon:'st-web',bad:1,d:'Pinned in silk: can\'t move, and evasion is 0. Once free, moves and acts at half speed.'};
    if(o.k==='stone'&&e!==player) I={name:'Petrified',icon:'st-stone',bad:1,d:'Can\'t move or act. Evasion is 0.'};
    if(o.k==='livingmountain'||o.k==='discipline') I=Object.assign({},I,{name:I.name+' ×'+(e.st[o.k].n||0)});
    return {k:o.k, t:o.t, stacks:o.k==='livingmountain'?Math.min(10,e.st.livingmountain.n||0):o.k==='discipline'?(e.st.discipline.n||0):0, name:I.name, icon:I.icon, d:I.d, bad:!!I.bad};
  });
}

(function(){
  var st=document.createElement('style');
  st.textContent=[
    '#statusbar{position:absolute;left:8px;top:8px;z-index:6;display:flex;flex-wrap:wrap;gap:4px;max-width:60%;pointer-events:none}',
    '#statusbar .sico{pointer-events:auto;position:relative;width:34px;height:34px;border-radius:6px;border:1px solid #6B8A5A;background:rgba(18,15,13,.82);display:flex;align-items:center;justify-content:center}',
    '#statusbar .sico.bad{border-color:#A04A3A}',
    '#statusbar .sico img{width:26px;height:26px;image-rendering:pixelated}',
    '#statusbar .sico .n{position:absolute;right:2px;bottom:0;font-size:11px;font-weight:700;color:#fff;text-shadow:0 0 2px #000,0 1px 2px #000}',
    '#statusbar .sico .stacks{position:absolute;left:1px;top:0;padding:0 2px;border-radius:3px;background:rgba(18,15,13,.85);font-size:12px;font-weight:700;color:var(--gold);text-shadow:0 1px 2px #000}',
    '#statusbar .sico .fb{font-size:10px;color:var(--ash)}',
    '#fx{display:none!important}',
    '.tipstat{display:flex;align-items:center;gap:6px;margin-top:3px;font-size:11.5px}',
    '.tipstat img{width:18px;height:18px;image-rendering:pixelated}',
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
    return '<div class="sico'+(s.bad?' bad':'')+'" data-si="'+i+'">'+(url?'<img src="'+url+'" alt="">':'<span class="fb">'+s.name.slice(0,3)+'</span>')+(s.stacks?'<span class="stacks">×'+s.stacks+'</span>':'')+'<span class="n">'+s.t+'</span></div>';
  }).join('');
  bar.querySelectorAll('[data-si]').forEach(function(el){
    var s=list[+el.getAttribute('data-si')];
    if(typeof hoverCard==='function') hoverCard(el, function(){ return '<div class="nm">'+s.name+'</div>'+(s.stacks?'<div class="row"><span>Stacks</span><b>'+s.stacks+' / 10</b></div>':'')+'<div class="row"><span>Turns left</span><b>'+s.t+'</b></div><div class="hint">'+s.d+'</div>'; });
  });
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
