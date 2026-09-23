/* =====================================================================
   statusicons.js - status and buff icons with durations (2026-09-17).
   Your statuses and buffs show as icons along the top-left of the map, each with the turns left;
   hovering one explains it. Hovering an enemy lists its statuses the same way.
   ===================================================================== */

var STATUS_INFO = {
  /* statuses (player.st / enemy.st) */
  burn:   {name:'Burning', icon:'st-burn', bad:1, d:'Takes fire damage every turn.'},
  chill:  {name:'Chilled', icon:'st-chill', bad:1, d:'Acts more slowly; takes more ice damage.'},
  slow:   {name:'Slowed', icon:'st-slow', bad:1, d:'Acts more slowly.'},
  frozen: {name:'Frozen', icon:'st-frozen', bad:1, d:'Can\'t act. A physical hit shatters the ice for double damage.'},
  root:   {name:'Rooted', icon:'st-root', bad:1, d:'Can\'t move, but can still attack.'},
  stun:   {name:'Stunned', icon:'st-stun', bad:1, d:'Can\'t act.'},
  fear:   {name:'Afraid', icon:'st-fear', bad:1, d:'Runs away instead of fighting.'},
  blind:  {name:'Blind', icon:'st-blind', bad:1, d:'Attacks miss far more often.'},
  poison: {name:'Poisoned', icon:'st-poison', bad:1, d:'Takes damage every turn and doesn\'t regenerate.'},
  wet:    {name:'Wet', icon:'ic-tidal-surge', bad:1, d:'Takes more lightning damage; fire goes out.'},
  corrupt:{name:'Corrupted', icon:'ic-shadow-swarm', bad:1, d:'Takes extra dark damage.'},
  hollow: {name:'Hollowed', icon:'ic-shadow-bolt', bad:1, d:'Shadow damage finds its weak spots.'},
  stone:  {name:'Stone skin', icon:'st-stone', d:'Physical hits deal 3 less damage.'},
  aura:   {name:'Unholy Aura', icon:'pr-unholyaura', d:'Enemies next to you take dark damage each turn.'},
  /* buffs (player.buffs) */
  rampage:   {name:'Rampage', icon:'pr-rampage', d:'+40% melee damage and faster attacks.'},
  ironhide:  {name:'Iron Hide', icon:'pr-ironhide', d:'+5 armor and a shield.'},
  ironbody:  {name:'Iron Body', icon:'ic-iron-body', d:'+4 armor; unarmed hits may stun.'},
  laststand: {name:'Last Stand', icon:'pr-laststand', d:'Take 35% less damage.'},
  rally:     {name:'Rally', icon:'pr-rally', d:'+10 accuracy.'},
  temper:    {name:'Temper', icon:'ic-temper', d:'Your weapon counts as +2.'},
  arcaneward:{name:'Ward', icon:'ic-arcane-ward', d:'A ward absorbs damage.'},
  unbound:   {name:'Unbound', icon:'pr-unbound', d:'Your next spell takes no time.'},
  haste:     {name:'Haste', icon:'ic-flame-step', d:'You move and act faster.'},
  cinder:    {name:'Cinder Stride', icon:'ic-flame-step', d:'Faster, leaving fire where you step.'},
  manaflow:  {name:'Mana Flow', icon:'pr-manatide', d:'Mana returns twice as fast.'},
  afterglow: {name:'Afterglow', icon:'ic-heal', d:'Light lingers: you heal 5% of your maximum HP each turn.'},
  thorns:    {name:'Thorns', icon:'st-root', d:'Attackers take damage back.'},
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
  if(e===player){
    for(var b in (player.buffs||{})) if(player.buffs[b]>0) out.push({k:b, t:player.buffs[b]});
    if(player.hidden>0) out.push({k:'hidden', t:player.hidden});
    if(player.levitate>0) out.push({k:'levitate', t:player.levitate});
  }
  return out.map(function(o){
    var I=STATUS_INFO[o.k] || {name:cap(o.k), icon:'', d:''};
    /* Sylla's web starts as Root, then becomes Slow. Show silk in both phases. */
    if(o.k==='root'&&e.syllaWeb>0) I={name:'Webbed',icon:'st-web',bad:1,d:'Pinned in silk. When released, moves and acts at half speed.'};
    return {k:o.k, t:o.t, name:I.name, icon:I.icon, d:I.d, bad:!!I.bad};
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
    return '<div class="sico'+(s.bad?' bad':'')+'" data-si="'+i+'">'+(url?'<img src="'+url+'" alt="">':'<span class="fb">'+s.name.slice(0,3)+'</span>')+'<span class="n">'+s.t+'</span></div>';
  }).join('');
  bar.querySelectorAll('[data-si]').forEach(function(el){
    var s=list[+el.getAttribute('data-si')];
    if(typeof hoverCard==='function') hoverCard(el, function(){ return '<div class="nm">'+s.name+'</div><div class="row"><span>Turns left</span><b>'+s.t+'</b></div><div class="hint">'+s.d+'</div>'; });
  });
}
var _updateUIStatus = updateUI;
updateUI = function(){ var r=_updateUIStatus.apply(this, arguments); renderStatusBar(); return r; };

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
  var rows=list.map(function(s){ var url=statusIconURL(s.icon); return '<div class="tipstat">'+(url?'<img src="'+url+'" alt="">':'')+'<b class="'+(s.bad?'bad':'')+'">'+s.name+'</b><span class="t">'+s.t+' turn'+(s.t===1?'':'s')+'</span></div>'; }).join('');
  var at=h.indexOf('<div class="odds">');
  return at>=0 ? h.slice(0,at)+rows+h.slice(at) : h+rows;
};
