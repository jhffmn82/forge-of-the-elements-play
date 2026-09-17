/* =====================================================================
   combos.js - the 24 two-element combinations (mechanics review 2026-09-16,
   DESIGN.md 12 step 7). A combo unlocks at primary 3 / secondary 2, in
   that order; 3/3 unlocks both orders. Mostly passive; aimed at ranged
   enemies, elites and bosses, disengaging and attrition.
   ===================================================================== */

var COMBOS = {
  'fire/earth':  {name:'Magma Answer',  d:'When a ranged attack or spell hurts you, lava erupts under the attacker: Rooted 1 turn and Burning.'},
  'fire/air':    {name:'Fanned Flames', d:'Burning enemies take their burn damage again each time they move.'},
  'fire/light':  {name:'Purging Flame', d:'Enemies you set Burning are also Blinded.'},
  'fire/shadow': {name:'Black Flame',   d:'Burning on enemies ignores fire resistance, and each tick adds a Hollow stack.'},
  'water/air':   {name:'Squall',        d:'Enemies you Chill are pushed 1 tile away from you.'},
  'water/earth': {name:'Permafrost',    d:'Rooted enemies gain a Chill stack each turn they stay rooted.'},
  'water/light': {name:'Clear Waters',  d:'When Ice Armor absorbs damage, heal 25% of the amount absorbed.'},
  'water/shadow':{name:'Numbing Dark',  d:'Your attacks and spells against Chilled enemies count as surprise attacks.'},
  'air/fire':    {name:'Friction',      d:'Every 3rd weapon hit in a row on the same target sets it Burning.'},
  'air/shadow':  {name:'Windwalker',    d:'When an enemy hits you in melee, you step 1 tile away at once (every 5 turns).'},
  'air/water':   {name:'Riptide',       d:'Your weapon hits push enemies 1 tile; slammed into a wall or creature, they are Chilled.'},
  'air/light':   {name:'Glint',         d:'Your critical hits Blind the target for 1 turn.'},
  'earth/fire':  {name:'Molten Orbs',   d:'Every 50 turns a molten orb forms (max 3). An orb absorbs the next attack on you (10 + Focus above 10), then bursts for that much fire to adjacent enemies.'},
  'earth/light': {name:'Radiant Roots', d:'Rooted enemies are also Blinded.'},
  'earth/shadow':{name:'Blight',        d:'Poisoned enemies deal 20% less damage.'},
  'earth/water': {name:'Silt Shield',   d:'Max Ice Armor +3 per Earth point, refilling twice as fast out of combat.'},
  'light/fire':  {name:'Searing Light', d:'Smite procs set the target Burning.'},
  'light/water': {name:'Holy Water',    d:'Healing beyond your max HP becomes Ice Armor (up to its max).'},
  'light/air':   {name:'Swift Judgment',d:'Smite procs strike twice.'},
  'light/earth': {name:'Beacon Root',   d:'A Smite proc against an enemy with a ranged attack Roots it for 1 turn.'},
  'shadow/fire': {name:'Smolder',       d:'Killing a Burning enemy hides you for 2 turns.'},
  'shadow/water':{name:'Frostshade',    d:'Surprise attacks Freeze the target at once (bosses: 2 Chill stacks).'},
  'shadow/air':  {name:'Shadow Gust',   d:'After a surprise attack, your next step takes no time.'},
  'shadow/earth':{name:'Venom Strike',  d:'Surprise attacks poison the target (10% of max HP a turn for 3 turns).'}
};
function combo(a, b){ return aff(a)>=3 && aff(b)>=2; }
function combosHeld(){ return Object.keys(COMBOS).filter(function(k){ var p=k.split('/'); return combo(p[0],p[1]); }); }

/* ---------------------------------------------------------------- statuses */
var _applyStatusCombo = applyStatus;
applyStatus = function(e, key, turns, extra){
  var had = e && e.st && e.st[key];
  _applyStatusCombo(e, key, turns, extra);
  if(!e || e===player || !e.foe || e.hp<=0 || !e.st[key] || had) return;
  if(key==='burn' && combo('fire','light')) _applyStatusCombo(e,'blind',Math.max(1,turns));
  if(key==='root' && combo('earth','light')) _applyStatusCombo(e,'blind',Math.max(1,turns));
};
var _addChillCombo = addChill;
addChill = function(e){
  _addChillCombo(e);
  if(!e || e===player || !e.foe || e.hp<=0 || !combo('water','air') || e.base.boss) return;
  var kx=e.x+Math.sign(e.x-player.x), ky=e.y+Math.sign(e.y-player.y);
  if((kx!==e.x || ky!==e.y) && walkable(kx,ky) && !occupied(kx,ky)){ e.x=kx; e.y=ky; }
};

/* Black Flame: burn ticks ignore fire resistance and hollow the target */
var BLACK_TICK=false;
var _resistMultCombo = resistMult;
resistMult = function(target, type){ if(BLACK_TICK && type==='fire') return 1; return _resistMultCombo(target, type); };
var _tickStatusCombo = tickStatus;
tickStatus = function(e){
  var black = e && e!==player && e.foe && e.st && e.st.burn && combo('fire','shadow');
  BLACK_TICK=!!black;
  var r=_tickStatusCombo(e);
  BLACK_TICK=false;
  if(black && r!==false && e.hp>0){ var h=e.st.hollow; e.st.hollow={t:5, n:Math.min(5,(h?h.n:0)+1)}; }
  return r;
};

/* ---------------------------------------------------------------- enemies moving: Fanned Flames; Permafrost */
var _aiActCombo = aiAct;
aiAct = function(e){
  var ox=e.x, oy=e.y;
  _aiActCombo(e);
  if(ents.indexOf(e)<0 || e.hp<=0) return;
  if((e.x!==ox || e.y!==oy) && e.st.burn && combo('fire','air')){
    var bd=Math.max(1,Math.round(e.st.burn.d*resistMult(e,'fire'))); e.hp-=bd; floatText(e.x,e.y,String(bd),'fire');
    if(e.hp<=0) kill(e,player);
  }
};

/* ---------------------------------------------------------------- damage in and out */
var _applyDamageCombo = applyDamage;
applyDamage = function(target, amount, type, source){
  /* Blight: poisoned enemies hit softer */
  if(source && source.foe && source.st && source.st.poison && combo('earth','shadow')) amount*=0.8;
  if(target!==player) return _applyDamageCombo(target, amount, type, source);
  /* Molten Orbs absorb the next attack */
  if(player.orbs>0 && source && source.foe && amount>0){
    var cap=Math.max(5, 10+(player.stats.foc-10)), soak=Math.min(cap, amount);
    amount-=soak; player.orbs--;
    log('A molten orb bursts, soaking '+Math.round(soak)+'.','c-good'); burst(player.x,player.y,'fire',24,0.06);
    ents.slice().forEach(function(o){ if(o.foe && dist(o,player)<=1){ var od=_applyDamageCombo(o, cap, 'fire', player); floatText(o.x,o.y,String(od),'fire'); if(o.hp<=0) kill(o,player); } });
    if(amount<=0) return 0;
  }
  var ice0=player.iceArmor||0;
  var d=_applyDamageCombo(target, amount, type, source);
  /* Clear Waters */
  var soaked=ice0-(player.iceArmor||0);
  if(soaked>0 && combo('water','light')){ var h=Math.max(1,Math.round(soaked*0.25)); player.hp=Math.min(player.maxhp, player.hp+h); }
  /* Magma Answer: ranged attackers and casters */
  if(d>0 && source && source.foe && source.hp>0 && combo('fire','earth') && (dist(source,player)>1 || type!=='phys')){
    _applyStatusCombo(source,'root',1); _applyStatusCombo(source,'burn',3,burnDmg());
    burst(source.x,source.y,'fire',18,0.06); log('Lava erupts under '+source.name+'.','c-fire');
  }
  player._hpMark=player.hp;
  return d;
};

/* ---------------------------------------------------------------- attacks: Friction, Riptide, Glint, surprise combos, Windwalker */
var _attackCombo = attack;
attack = function(att, def, mult, label){
  if(!def) return _attackCombo(att, def, mult, label);
  var numb = att===player && def.st && def.st.chill && combo('water','shadow') && !(player.hidden>0);
  if(numb) player.hidden=1;
  var hp0=def.hp, php0=player.hp;
  _attackCombo(att, def, mult, label);
  if(numb) player.hidden=0;
  var H=LAST_HIT, landed = H && H.def===def && def.hp<hp0;
  if(att===player){
    if(landed) afterPlayerHit(def, H);
    else if(player.friction) player.friction.n=0;
  }
  if(att!==player && def===player && att.foe && dist(att,player)<=1 && player.hp<php0 && player.hp>0 && combo('air','shadow') && !(player.windCd>turn)){
    var best=null, bd=0;
    for(var dy=-1;dy<=1;dy++) for(var dx=-1;dx<=1;dx++){ var nx=player.x+dx, ny=player.y+dy; if((dx||dy) && walkable(nx,ny) && !occupied(nx,ny)){ var dd=dist({x:nx,y:ny},att); if(dd>bd){ bd=dd; best={x:nx,y:ny}; } } }
    if(best && bd>1){ player.x=best.x; player.y=best.y; player.windCd=turn+5; log('Windwalker: you slip away.','c-good'); computeFOV(); }
  }
};
function afterPlayerHit(def, H){
  var alive=def.hp>0 && ents.indexOf(def)>=0;
  if(H.crit && alive && combo('air','light')) _applyStatusCombo(def,'blind',1);
  if(H.surprise && alive){
    if(combo('shadow','water')){ if(def.base.boss){ addChill(def); addChill(def); } else { delete def.st.imm_frozen; _applyStatusCombo(def,'frozen',2); floatText(def.x,def.y,'frozen','ice'); } }
    if(combo('shadow','earth') && typeof applyPoison==='function') applyPoison(def);
  }
  if(H.surprise && combo('shadow','air')) player.freeStep=true;
  if(!H.spell && H.melee!==false){
    if(combo('air','fire') && alive){
      var fr=player.friction && player.friction.def===def ? player.friction : (player.friction={def:def, n:0});
      fr.n++; if(fr.n>=3){ fr.n=0; _applyStatusCombo(def,'burn',3,burnDmg()); floatText(def.x,def.y,'friction','fire'); }
    }
    if(combo('air','water') && alive && H.melee && !def.base.boss){
      var kx=def.x+Math.sign(def.x-player.x), ky=def.y+Math.sign(def.y-player.y);
      if(walkable(kx,ky) && !occupied(kx,ky)){ def.x=kx; def.y=ky; } else addChill(def);
    }
  }
}
var _castAtCombo = castAt;
castAt = function(x,y){
  var f=ents.filter(function(e){ return e.foe && e.x===x && e.y===y; })[0];
  var numb = f && f.st.chill && combo('water','shadow') && !(player.hidden>0);
  if(numb) player.hidden=1;
  var hp0=f ? f.hp : 0;
  LAST_HIT=null;
  var r=_castAtCombo(x,y);
  if(numb && player.hidden===1) player.hidden=0;
  if(r && f && LAST_HIT && LAST_HIT.def===f && f.hp<hp0) afterPlayerHit(f, LAST_HIT);
  return r;
};

/* Smite procs: Searing Light, Swift Judgment, Beacon Root */
function onSmiteProc(def){
  var extra=0;
  if(def.hp>0 && combo('light','fire')) _applyStatusCombo(def,'burn',3,burnDmg());
  if(def.hp>0 && combo('light','earth') && (def.base.range>1 || def.base.caster)) _applyStatusCombo(def,'root',1);
  if(def.hp>0 && combo('light','air')){ extra=applyDamage(def, roll(3,6), 'light', player); sparkleFx(def.x,def.y,'light',10); }
  return extra;
}

/* ---------------------------------------------------------------- kills: Smolder */
var _killCombo = kill;
kill = function(e, by){
  var smolder = e && e!==player && e.foe && e.st && e.st.burn && combo('shadow','fire') && (by===player || by==='player') && ents.indexOf(e)>=0;
  _killCombo(e, by);
  if(smolder){ player.hidden=Math.max(player.hidden||0, 3); log('Smolder: you vanish into the smoke.','c-good'); }
};

/* ---------------------------------------------------------------- the turn: orbs, Silt Shield, Permafrost, Holy Water, Shadow Gust */
var _deriveCombo = derive;
derive = function(p){
  _deriveCombo(p);
  if(p!==player) return;
  if(combo('earth','water')){ p.iceArmorMax += 3*aff('earth'); }
};
var _moveCostCombo = moveCost;
moveCost = function(){ return player.freeStep ? 0 : _moveCostCombo(); };
var _endTurnCombo = endTurn;
endTurn = function(){
  if(!player || player.hp<=0) return _endTurnCombo();
  var stepped = player.movedThisTurn && player.freeStep;
  var before=turn;
  _endTurnCombo();
  if(stepped) player.freeStep=false;
  if(!player || player.hp<=0 || turn===before) return;
  var fighting=ents.some(function(e){ return e.foe && e.state==='hunt' && vis[idxOf(e.x,e.y)]; });
  if(combo('earth','fire')){
    player.orbT=(player.orbT||0)+1;
    if((player.orbs||0)<3 && player.orbT>=50){ player.orbT=0; player.orbs=(player.orbs||0)+1; log('A molten orb forms and circles you ('+player.orbs+').','c-good'); }
  }
  if(combo('earth','water') && !fighting && player.iceArmor<player.iceArmorMax) player.iceArmor=Math.min(player.iceArmorMax, player.iceArmor+0.25);
  if(combo('water','earth')) ents.slice().forEach(function(e){ if(e.foe && e.hp>0 && e.st.root) addChill(e); });
  player._hpMark=player.hp;
};
/* Holy Water: overheal becomes Ice Armor. Heals report themselves as "+N" heal numbers. */
var _floatTextCombo = floatText;
floatText = function(x, y, text, type, big){
  if(type==='heal' && player && x===player.x && y===player.y && combo('light','water')){
    var n=parseInt(String(text).replace('+',''),10), gained=player.hp-(player._hpMark===undefined?player.hp:player._hpMark);
    var over=n-gained;
    if(over>0 && player.iceArmor<player.iceArmorMax){ player.iceArmor=Math.min(player.iceArmorMax, player.iceArmor+over); }
    player._hpMark=player.hp;
  }
  return _floatTextCombo(x, y, text, type, big);
};

/* ---------------------------------------------------------------- the character sheet */
var _panesCombo = panes;
panes = function(){
  _panesCombo();
  if(openSheet!=='Char' || !$('mChar')) return;
  var held=combosHeld(); if(!held.length) return;
  var add=held.map(function(k){ var C=COMBOS[k], p=k.split('/'); return '<div style="font-size:11px;margin:2px 0"><b style="color:'+AFF_COL[p[0]]+'">'+C.name+'</b> <span style="color:var(--dim)">('+cap(p[0])+' 3 / '+cap(p[1])+' 2)</span> <span style="color:var(--ash)">'+C.d+'</span></div>'; }).join('');
  var subs=$('mChar').querySelectorAll('.sub');
  for(var i=0;i<subs.length;i++) if(/^Race/.test(subs[i].textContent)){ subs[i].insertAdjacentHTML('beforebegin', add); break; }
};
