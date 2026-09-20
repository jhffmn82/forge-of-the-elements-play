/* ============================================================================
   create.js - character creation and starting a run at level 1.
   ========================================================================== */

var CHOICE = {race:'dwarf', sex:'m', court:'fire', cls:'fighter', god:'murk', name:''};
/* 2026-09-20: the reroll button worked all along - each race and sex simply had three or four names, so it handed
   back the same two over and over and read as broken. Sixteen apiece now, in each people's own voice. */
var NAMES = {
  human:{m:['Aldric','Tomas','Corvin','Rowan','Edric','Garrick','Halden','Merrick','Orin','Perrin','Quillan','Stefan','Tobias','Ulric','Wendel','Yorick'],
         f:['Mira','Elsbeth','Isolde','Wren','Adela','Bryony','Corliss','Delia','Ferris','Greta','Hester','Linnet','Marta','Odile','Rosalind','Verity']},
  elf:{m:['Saelis','Thalion','Ereth','Aelric','Caladan','Dathien','Elrowen','Faelar','Ithil','Lathriel','Maeron','Narion','Oriel','Sylvanas','Taeral','Yllestar'],
       f:['Ilyra','Nimue','Saelis','Aerith','Celine','Elowen','Faelyn','Idriel','Liriel','Maerwyn','Nythera','Oriane','Sylwen','Thessaly','Vaelia','Yrsa']},
  dwarf:{m:['Thrain','Borin','Dagna','Balin','Durin','Fargrim','Grum','Harbek','Kildrak','Morgran','Norbal','Orsik','Rurik','Thorbek','Ulfgar','Vondal'],
         f:['Brynja','Helga','Dagna','Astrid','Bardryn','Eldeth','Fenna','Gunnloda','Hilda','Ilde','Kathra','Liftrasa','Mardred','Riswynn','Torbera','Vistra']},
  fae:{m:['Pip','Thistle','Corrin','Wisp','Bramble','Cinder','Dewdrop','Fennel','Gossamer','Hollyhock','Juniper','Moss','Nettle','Quill','Sorrel','Tamarind'],
       f:['Nerissa','Ilka','Briar','Sylph','Aster','Clover','Dandelion','Elowyn','Fern','Hazel','Iris','Lilac','Marigold','Pearl','Saffron','Willow']},
  gloomling:{m:['Vesk','Hollow','Mortis','Ash','Cinder','Dusk','Ember','Grim','Knell','Lament','Murk','Pallor','Rook','Shade','Umbra','Wane'],
             f:['Vess','Nyx','Pale Anna','Bleak','Cinder','Dolor','Ember','Gloam','Hush','Lethe','Mourn','Nocte','Requiem','Sable','Tenebrae','Vespers']}
};
/* an off-hand kit slot may name a weapon: these two helpers are what classes.js and the creation screen
   ask, now that there is no separate off-hand dagger item (2026-09-17) */
function offKitItem(key){ return OFFHANDS[key] || WEAPONS[key] || null; }
/* turn a light weapon into an off-hand weapon: it keeps its damage, tier, upgrades and enchantment */
function offHandWeapon(d){
  d.kind='off'; d.weapon=true; d.block=0;
  d.eva=3 + 0.5*Math.max(0, d.plus||0);
  d.note='off-hand: a second strike every melee attack, with its own on-hit effects';
  return d;
}

/* 2026-09-20: Justin - "the random name button does nothing". It did fire; it just drew from a list of three or
   four and handed back the name already in the box about a third of the time, three times running often enough
   to look broken. A reroll now always lands on a different name (and survives a race with no list at all). */
function rollName(c){
  var list=(NAMES[c.race]||{})[c.sex] || (NAMES[c.race]||{}).m || ['Adventurer'];
  var other=list.filter(function(n){ return n!==c.name; });
  return pick(other.length ? other : list);
}
function lookFor(c){ var s=RACES[c.race].sexes[c.sex]; return c.race==='fae' ? s.replace('%s', c.court) : s; }
function statsFor(c){
  var s={mig:10,agi:10,vit:10,foc:10}, rm=RACES[c.race].mods, cm=CLASSES[c.cls].mods;
  for(var k in s){ s[k]+= (rm[k]||0) + (cm[k]||0); }
  return s;
}
function openCreate(){
  var el=$('create');
  if(!el){ el=document.createElement('div'); el.id='create'; document.body.appendChild(el); }
  el.classList.add('on');
  playMusic('title');
  renderCreate();
}
function renderCreate(){
  var el=$('create'), c=CHOICE;
  if(!c.name) c.name=rollName(c);
  var h='<div class="wrap"><h1>Forge of the Elements</h1><div class="tag2">Descend five floors of the Dungeon, fuse elemental motes at the Forge, and bring down Grukk the Warchief.</div>';
  h+='<div class="step">1 &middot; Race</div><div class="cards">';
  Object.keys(RACES).forEach(function(r){
    var R=RACES[r], look=lookFor({race:r, sex:c.sex, court:c.court});
    h+='<button class="card'+(c.race===r?' on':'')+'" data-race="'+r+'"><div class="port" data-look="'+look+'"></div><b>'+R.name+'</b><span>'+R.blurb+'</span></button>';
  });
  h+='</div><div class="step">Appearance</div><div class="cards" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">'+
     ['m','f'].map(function(s){ return '<button class="card'+(c.sex===s?' on':'')+'" data-sex="'+s+'"><b>'+(s==='m'?'Masculine':'Feminine')+'</b></button>'; }).join('')+'</div>';
  if(c.race==='fae'){
    h+='<div class="step">Fae court (your locked element)</div><div class="cards">';
    Object.keys(RACES.fae.courts).forEach(function(el2){
      h+='<button class="card'+(c.court===el2?' on':'')+'" data-court="'+el2+'"><div class="port" data-look="'+RACES.fae.sexes[c.sex].replace('%s',el2)+'"></div><b style="color:'+AFF_COL[el2]+'">'+RACES.fae.courts[el2]+'</b><span>'+cap(el2)+' 1 from the start: '+T1_TEXT[el2]+'.</span></button>';
    });
    h+='</div>';
  }
  h+='<div class="step">2 &middot; Class</div><div class="cards">';
  Object.keys(CLASSES).forEach(function(k){
    var C=CLASSES[k], ab=C.ability ? (C.ability==='invoke' ? 'Invoke (by god)' : ABILITIES[C.ability].name) : 'no ability';
    /* each class has its own card art (cls-*); the ability's icon is the fallback if it is missing */
    var ic = C.icon && objArt('icons', C.icon) ? C.icon
           : C.ability && C.ability!=='invoke' ? ABILITIES[C.ability].icon
           : C.ability==='invoke' ? 'ic-pray' : 'ic-wait';
    h+='<button class="card'+(c.cls===k?' on':'')+'" data-cls="'+k+'"><div class="port" style="height:48px" data-icon="'+ic+'"></div><b>'+C.name+'</b><span>'+C.blurb+'</span><span style="color:var(--gold)">'+ab+'</span></button>';
  });
  h+='</div>';
  if(c.cls==='cleric'){
    h+='<div class="step">Your god</div><div class="cards">';
    Object.keys(GODS).forEach(function(g){
      var G=GODS[g], bad=G.refuses===c.race;
      h+='<button class="card'+(c.god===g?' on':'')+'" data-god="'+g+'" '+(bad?'disabled style="opacity:.4"':'')+'><div class="port" data-shrine="'+G.sprite+'"></div><b style="color:'+G.color+'">'+G.name+'</b><span><b style="font-family:inherit;font-size:11px;color:var(--ink)">Rule:</b> '+G.rule+'</span><span>Invoke: '+ABILITIES[G.invoke].name+'</span>'+(bad?'<span class="c-you">Refuses '+RACES[c.race].name+'s.</span>':'')+(G.loves===c.race?'<span class="c-good">Loves '+RACES[c.race].name+'s: +25% piety gain.</span>':'')+'</button>';
    });
    h+='</div>';
  }
  var st=statsFor(c), C2=CLASSES[c.cls], kit=C2.kit;
  var kitNames=[kit.main&&WEAPONS[kit.main].name, kit.alt&&WEAPONS[kit.alt].name, kit.armor&&ARMORS[kit.armor].name, kit.off&&offKitItem(kit.off).name].filter(Boolean);
  if(c.cls==='cleric' && c.god==='grom') kitNames=['Fists (Grom forbids weapons)','Cloth Robe','Holy Symbol'];
  h+='<div class="summary"><div class="big" id="bigPort"></div><div>'+
     '<div class="step" style="margin-top:0">3 &middot; Name</div><input id="cname" type="text" maxlength="24" value="'+c.name.replace(/"/g,'')+'"> <button id="reroll">Random</button>'+
     '<div class="who" style="margin-top:8px;font-size:13px">'+RACES[c.race].name+' '+C2.name+(c.cls==='cleric'?' of '+GODS[c.god].name:'')+(c.race==='fae'?' &middot; '+RACES.fae.courts[c.court]:'')+'</div>'+
     '<div class="kv" style="max-width:420px"><span>Might</span><b>'+st.mig+'</b><span>Agility</span><b>'+st.agi+'</b><span>Vitality</span><b>'+st.vit+'</b><span>Focus</span><b>'+st.foc+'</b>'+
     '<span>Starting kit</span><b style="text-align:left">'+kitNames.join(', ')+'</b><span>Passive</span><b style="text-align:left;font-weight:400">'+C2.passive+'</b></div>'+
     '<button class="go btn-primary" id="begin">Enter the Dungeon</button> <span class="c-info" style="font-size:11px;margin-left:8px">Sound and music start with your first click. M mutes, N toggles music.</span></div></div></div>';
  el.innerHTML=h;
  el.querySelectorAll('[data-race]').forEach(function(b){ b.onclick=function(){ sfx('ui-click'); c.race=b.getAttribute('data-race'); c.name=''; if(GODS[c.god].refuses===c.race) c.god='murk'; renderCreate(); }; });
  el.querySelectorAll('[data-sex]').forEach(function(b){ b.onclick=function(){ sfx('ui-click'); c.sex=b.getAttribute('data-sex'); c.name=''; renderCreate(); }; });
  el.querySelectorAll('[data-court]').forEach(function(b){ b.onclick=function(){ sfx('ui-click'); c.court=b.getAttribute('data-court'); renderCreate(); }; });
  el.querySelectorAll('[data-cls]').forEach(function(b){ b.onclick=function(){ sfx('ui-click'); c.cls=b.getAttribute('data-cls'); renderCreate(); }; });
  el.querySelectorAll('[data-god]').forEach(function(b){ b.onclick=function(){ if(b.disabled) return; sfx('ui-click'); c.god=b.getAttribute('data-god'); renderCreate(); }; });
  el.querySelectorAll('[data-look]').forEach(function(p){ paintArt(p,'cast',p.getAttribute('data-look'),118); });
  el.querySelectorAll('[data-icon]').forEach(function(p){ paintArt(p,'icons',p.getAttribute('data-icon'),44); });
  el.querySelectorAll('[data-shrine]').forEach(function(p){ paintArt(p,'structures',p.getAttribute('data-shrine'),110); });
  paintArt($('bigPort'),'cast',lookFor(c),220);
  $('cname').oninput=function(){ c.name=this.value; };
  $('reroll').onclick=function(){ sfx('ui-click'); c.name=rollName(c); renderCreate(); };
  $('begin').onclick=function(){ audioInit(); sfx('ui-click'); $('create').classList.remove('on'); newRun(Date.now()%1000000, CHOICE); };
}

/* ---------------------------------------------------------------- a new run */
function newRun(seed, choice){
  choice = choice || window.LAST_CHOICE || CHOICE;
  window.LAST_CHOICE = JSON.parse(JSON.stringify(choice));
  seed = seed>>>0;
  worldSeed = seed;
  rng = mulberry32(seed);
  newRunState(seed);
  floorNo=1; turn=0; revealAll=false; aiming=null; PARTS.length=0; fx=[];
  if($('bReveal')) $('bReveal').textContent='Reveal: off';
  var c=choice, C=CLASSES[c.cls], kit=C.kit;
  function gear(table, key){ if(!key) return null; var g=clone(table[key]); g.tier='Rusty'; g.plus=0; return g; }
  /* an off-hand kit slot names either an off-hand item (shield, orb) or a light weapon (two daggers) */
  function offKitGear(key){
    if(!key) return EMPTY_OFF;
    if(OFFHANDS[key]) return gear(OFFHANDS, key) || EMPTY_OFF;
    var w=gear(WEAPONS, key); if(!w) return EMPTY_OFF;
    return offHandWeapon(w);
  }
  var p = {id:0, ch:'@', x:2, y:2, t:0, st:{}, foe:false, buffs:{},
    race:c.race, cls:c.cls, sex:c.sex, court:c.court, look:lookFor(c), name:(c.name||'Adventurer').trim()||'Adventurer',
    stats:statsFor(c), level:1, xp:0, xpNext:90, points:0, blurCd:0, fortCd:0, hidden:0,
    essence: c.cls==='tourist' ? 30 : 0, motes:{}, aff:{}, primary:null, keys:{iron:0, crystal:0}, hunger:1200,
    sets:[gear(WEAPONS,kit.main), null], activeSet:0, ranged:(function(){ var a=gear(WEAPONS,kit.alt); return (a && (a.range||0)>1) ? a : null; })(),
    armorItem:gear(ARMORS,kit.armor), off:offKitGear(kit.off),
    bag:[], hotbar:null, god:null, piety:0, favor:0, amusement:40, levitate:0, face:'south' };
  if(c.cls==='cleric' && c.god==='grom'){ p.sets=[null,null]; p.armorItem=gear(ARMORS,'robe'); }
  var R=RACES[c.race];
  if(c.race==='fae'){ p.aff[c.court]=1; p.primary=c.court; }
  if(c.race==='gloomling'){ p.aff.shadow=1; p.primary='shadow'; }
  player = p;
  shuffleSigils();
  addBag('\u{1F356}','Ration',{kind:'food', data:{food:'ration'}, uid:'food:ration'});
  player.bag[0].n = 1 + (C.extraFood||0);
  if(c.cls==='cleric'){ player.god=c.god; player.piety=20; player.favor=20; }
  derive(player); player.hp=player.maxhp; player.mp=player.maxmp; player.iceArmor=player.iceArmorMax;
  $('over').style.display='none';
  $('log').innerHTML='';
  RUN.over=false;
  generate(worldSeed);
  player._lx=undefined;
  log('<b>'+player.name+'</b>, '+player.who+', enters the Dungeon.','c-kill');
  if(!window.TIPS_SHOWN){
    window.TIPS_SHOWN=true;
    log('Move with the arrow keys or WASD (Q E Z C for diagonals), or click a tile. Bump enemies to attack. <b>1-8</b> use your hotbar, <b>g</b> picks up, <b>r</b> rests, <b>p</b> opens Faith, <b>i</b> your bag, <b>Tab</b> your character.','c-info');
    log('Hover anything on the map to inspect it. Traps show once you spot them; Agility helps.','c-info');
  }
  floorIntro();
  resize(); updateUI();
}
