/* ============================================================================
   create.js - character creation and starting a run at level 1.
   ========================================================================== */

var CHOICE = {race:'dwarf', sex:'m', court:'fire', cls:'fighter', god:'murk', name:''};
/* 2026-09-20: the reroll button worked all along - each race and sex simply had three or four names, so it handed
   back the same two over and over and read as broken. Sixteen apiece now, in each people's own voice. */
var NAMES = {
  human:{m:['Aldric','Tomas','Corvin','Rowan','Edric','Garrick','Halden','Merrick','Orin','Perrin','Quillan','Stefan','Tobias','Ulric','Wendel','Yorick','Ansel','Bertram','Cedric','Dorian','Emeric','Fulke','Godwin','Hamund','Ivo','Jorund','Kester','Leofric','Marlow','Nevin','Osric','Piers','Ranulf','Sigurd','Tancred','Uther','Vance','Wystan','Alaric','Benedict','Caspian','Dunstan','Everard','Florian','Gideon','Hadrian','Isembard','Joscelin','Lucan','Matthias','Neville','Oswin','Percival','Roderick','Silas','Thaddeus','Valen','Warrick','Aubrey','Brand','Conrad','Drustan'],
          f:['Mira','Elsbeth','Isolde','Wren','Adela','Bryony','Corliss','Delia','Ferris','Greta','Hester','Linnet','Marta','Odile','Rosalind','Verity','Alys','Beatrix','Cerys','Dagny','Edith','Fenna','Gwen','Hawise','Ida','Jocasta','Katrin','Lisbet','Maud','Nessa','Orla','Petra','Rhoswen','Sabine','Tamsin','Una','Vivienne','Winifred','Ysolt','Annis','Bronwen','Clemence','Dorothea','Eleanor','Freya','Giselle','Honora','Imogen','Juliana','Lorelei','Margery','Nell','Ottilie','Philippa','Rowena','Sidonie','Temperance','Ursula','Valeria','Wilhelmina','Ada','Blanche','Cora']},
  elf:{m:['Saelis','Thalion','Ereth','Aelric','Caladan','Dathien','Elrowen','Faelar','Ithil','Lathriel','Maeron','Narion','Oriel','Sylvanas','Taeral','Yllestar','Aramil','Belegorn','Cirdan','Daeron','Elathar','Finrael','Galathil','Haldir','Iolas','Kelvhan','Laurelin','Mithrandel','Naeris','Orophin','Quarion','Rhalion','Soveliss','Tarathiel','Uthemar','Varis','Wyndael','Xalvador','Ysgarn','Zaltarish','Aelindel','Beluar','Caeldrim','Durothil','Erendriel','Faenor','Galinndan','Hyrael','Ilphras','Kyrenic','Lirael','Melandrach','Nuvian','Orlanthir','Paeris','Riardon','Sariel','Theodren','Ulmaris','Vaeril','Wrenthal','Yestrel','Zylas','Adran'],
        f:['Ilyra','Nimue','Saelis','Aerith','Celine','Elowen','Faelyn','Idriel','Liriel','Maerwyn','Nythera','Oriane','Sylwen','Thessaly','Vaelia','Yrsa','Alathiel','Bethrynna','Caelynn','Drusilia','Enna','Felosial','Galadria','Hesper','Ithronel','Keyleth','Lia','Meriele','Naivara','Quelenna','Rilaith','Shaeris','Thia','Valanthe','Wynlaith','Xanaphia','Ylwen','Zaleria','Amastacia','Birel','Cyrenne','Dalyra','Eilistra','Faerwyn','Gaelira','Hollis','Ilmadia','Jelenneth','Kelisande','Loralei','Miriel','Nerysa','Ossiane','Peyrith','Quillathe','Rosaith','Sylvara','Tethys','Ulaeth','Vanya','Wenlith','Yathrelle','Zephyra','Ariadne']},
  dwarf:{m:['Thrain','Borin','Dagna','Balin','Durin','Fargrim','Grum','Harbek','Kildrak','Morgran','Norbal','Orsik','Rurik','Thorbek','Ulfgar','Vondal','Adrik','Baern','Brottor','Dain','Eberk','Einkil','Flint','Gardain','Gimlor','Hargrim','Ivaldi','Jarn','Kragg','Lodrin','Magnir','Nordak','Oskar','Radnor','Stonn','Tordek','Urist','Varric','Wulfram','Yorgen','Angrim','Bofur','Dwalin','Farin','Gloin','Hakon','Ingvar','Korvin','Loki','Mundin','Nain','Orvald','Rangrim','Sindri','Torin','Ulvar','Vigmar','Wurf','Brokk','Dolgrin','Eldgrim','Fundin','Gunnar','Halvor'],
          f:['Brynja','Helga','Dagna','Astrid','Bardryn','Eldeth','Fenna','Gunnloda','Hilda','Ilde','Kathra','Liftrasa','Mardred','Riswynn','Torbera','Vistra','Amber','Audhild','Bera','Dagnal','Diesa','Ebba','Gerdrun','Gurdis','Hlin','Ingrid','Jora','Kristryd','Lif','Magna','Nora','Orsa','Ragna','Sif','Thora','Tova','Ulla','Valdis','Yngvild','Anvild','Bruni','Dorna','Eirny','Frida','Gerta','Hildr','Idunn','Kara','Ljot','Marra','Nanna','Oddny','Runa','Signy','Thyra','Ulfhild','Vigdis','Wynna','Asa','Birna','Dalla','Embla','Gunnhild','Halla']},
  fae:{m:['Pip','Thistle','Corrin','Wisp','Bramble','Cinder','Dewdrop','Fennel','Gossamer','Hollyhock','Juniper','Moss','Nettle','Quill','Sorrel','Tamarind','Acorn','Birch','Cobweb','Dusty','Elm','Flicker','Glimmer','Hob','Ivy','Jinx','Kestrel','Larkspur','Mote','Nimble','Oakum','Puck','Quince','Rush','Sedge','Tumble','Ushi','Vetch','Wick','Yarrow','Alder','Bracken','Chestnut','Dapple','Elder','Fig','Gorse','Hawthorn','Ivo','Jasper','Knot','Lichen','Mallow','Nutmeg','Osier','Pebble','Rowan','Sprig','Teasel','Umber','Vervain','Whin','Yew','Zest'],
        f:['Nerissa','Ilka','Briar','Sylph','Aster','Clover','Dandelion','Elowyn','Fern','Hazel','Iris','Lilac','Marigold','Pearl','Saffron','Willow','Amaranth','Bluebell','Calla','Damson','Ember','Foxglove','Gilly','Honey','Ivyrose','Jonquil','Kit','Lark','Meadow','Nixie','Opal','Poppy','Quicksilver','Rue','Sorrel','Tansy','Verbena','Wisteria','Yarrow','Zinnia','Anise','Bryony','Celandine','Dahlia','Eglantine','Flax','Ginger','Heather','Isolde','Jessamine','Kelpie','Lavender','Mistral','Nightshade','Orchid','Primrose','Rosemary','Sage','Thyme','Violet','Wren','Yasmin','Zephyrine','Twill']},
  gloomling:{m:['Vesk','Hollow','Mortis','Ash','Cinder','Dusk','Ember','Grim','Knell','Lament','Murk','Pallor','Rook','Shade','Umbra','Wane','Abyss','Blight','Cairn','Dirge','Eclipse','Fathom','Gallows','Haunt','Ichor','Jet','Kohl','Lurk','Marrow','Nadir','Omen','Pyre','Quiet','Raven','Sepulchre','Tallow','Vale','Wither','Yarrow','Zenith','Bane','Crypt','Draven','Ebon','Fell','Gloam','Husk','Inkwell','Keening','Lorne','Mordant','Nightjar','Ossuary','Pitch','Quell','Rime','Sombre','Thorn','Vane','Wraithe','Yew','Ashling','Brume','Duskin'],
              f:['Vess','Nyx','Pale Anna','Bleak','Cinder','Dolor','Ember','Gloam','Hush','Lethe','Mourn','Nocte','Requiem','Sable','Tenebrae','Vespers','Ashen','Belladonna','Covenna','Dusk','Elegy','Fenwick','Grief','Hollowyn','Isolde','Jet','Kestrel','Lachrymae','Morrow','Nightingale','Obsidia','Perdita','Quietus','Ravenna','Sorrow','Threnody','Umbra','Veil','Wisteria','Yvaine','Zilla','Anguish','Bryn','Cerise','Dimity','Eventide','Fable','Gossamer','Hesper','Ivory','Juniper','Lull','Mira','Nocturne','Ophelia','Pallas','Rue','Solace','Twilight','Vesper','Willow','Yara','Ashvine','Cobweb']}
};

/* 2026-09-22 (Justin): "dramatically increase the number of randomly generated names". Sixty-four curated names per race
   and sex above, and a syllable generator per race below: a reroll draws a curated name three times in five and a
   built one otherwise, so the button has thousands of names behind it and stays in each race's voice. */
var NAME_BANKS = {
  human:{a:['Al','Bel','Cor','Dur','Ed','Fal','Gar','Hal','Is','Jor','Kel','Lor','Mar','Ner','Os','Per','Ros','Ser','Tal','Ul','Ver','Wil'],
         b:['an','ber','dan','en','er','in','is','lin','mer','on','ric','ryn','ten','ton','ver','win'],
         m:['','an','ar','ic','in','on','us','d','n','r','s','th'], f:['a','e','ia','ie','is','wen','yn','ys']},
  elf:{a:['Ae','Cael','Dae','El','Fae','Gal','Il','Lae','Lir','Mae','Nae','Ory','Quel','Sae','Syl','Thae','Vae','Yl'],
       b:['la','le','li','lo','na','ni','ra','re','ri','ro','tha','the','thi','va','ve','vi'],
       m:['n','r','s','th','l','dir','mar','ril','an','ael','ion','ir'], f:['a','e','el','ia','ith','wen','yn','ys']},
  dwarf:{a:['Bal','Bor','Dag','Dur','Far','Gim','Grum','Har','Kil','Mor','Nor','Or','Rur','Thor','Ulf','Von','Bram','Dol'],
         b:['ak','ar','ek','gar','gin','grim','im','in','li','na','or','rak','rik','ulf','un','ur'],
         m:['','d','k','n','r','th','ak','in','or','ur'], f:['a','da','hild','ja','na','ra','va','ya']},
  fae:{a:['Bram','Bri','Clo','Dew','Fen','Gos','Hol','Ju','Lil','Mar','Mos','Net','Pip','Quil','Sor','Tam','Wil','Wis'],
       b:['ber','bel','den','dle','kin','let','ling','low','mer','nel','pin','ret','sel','ter','thi','wick'],
       m:['','kin','le','let','ling','ock','s','y','o','et','in'], f:['a','bell','ette','ie','la','ley','wyn','y']},
  gloomling:{a:['Ash','Bleak','Cin','Dol','Dus','Em','Gloam','Grim','Hol','Knell','Lam','Mor','Murk','Noc','Pal','Sab','Umb','Ves'],
             b:['ar','en','er','id','is','or','ra','re','ren','ric','ris','rok','sha','ten','ul','ver'],
             m:['','k','n','r','s','th','x','ar','en','is','ost'], f:['a','e','ia','is','ith','na','ra','yx']}
};
function buildName(race, sex){
  var B=NAME_BANKS[race]||NAME_BANKS.human, n=pick(B.a)+pick(B.b);
  if(rng()<0.35 && n.length<=6){ var extra=pick(B.b); if(n.slice(-extra.length)!==extra) n+=extra; }
  var ends=sex==='f'?B.f:B.m, vowelEnd=/[aeiouy]$/.test(n), tail=pick(ends);
  /* a consonant seam takes a vowel-led ending (Borrikth, Osinr: no); a vowel seam drops the doubled vowel */
  if(!vowelEnd && /^[^aeiouy]/.test(tail)){ var v=ends.filter(function(e){ return e===''||/^[aeiouy]/.test(e); }); tail=v.length?pick(v):''; }
  if(vowelEnd && /^[aeiouy]/.test(tail)) n=n.replace(/[aeiouy]$/,'');
  if((n+tail).length>10) tail='';
  n=(n+tail).toLowerCase().replace(/([a-z])+/g,'$1$1').replace(/([aeiouy])/g,'$1');
  return n.charAt(0).toUpperCase()+n.slice(1);
}
/* an off-hand kit slot may name a weapon: these two helpers are what classes.js and the creation screen
   ask, now that there is no separate off-hand dagger item (2026-09-17) */
var CLERIC_KITS={wobbles:'censer',sylla:'censer',murk:'censer',glimmer:'censer',grom:'symbol',grumbok:'symbol',reginald:'symbol',anvil:'symbol',vellum:'symbol'};
function startingKit(c){
  if(c.cls!=='cleric') return CLASSES[c.cls].kit;
  var kit=Object.assign({},CLASSES.cleric.kit);
  kit.alt=null;
  kit.armor={grom:null,grumbok:'leather',glimmer:'leather',murk:'robe',reginald:'leather',anvil:'chain',vellum:'robe',wobbles:kit.armor,sylla:kit.armor}[c.god];
  kit.main=CLERIC_KITS[c.god]==='censer'?'sword':'mace';
  kit.off=CLERIC_KITS[c.god]==='censer'?'censer':'holy';
  if(c.god==='grom'){kit.main=null;kit.armor=null;kit.alt=null;}
  return kit;
}
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
/* 2026-09-22 audit: what a shrine would refuse, creation refuses too (a Gloomling starts with Shadow 1, an Ember-court Fae with Fire 1) */
function creationRefuses(c, g){
  var G=GODS[g]; if(!G) return true;
  if(G.refuses && G.refuses===c.race) return true;
  if(g==='reginald' && (c.cls==='scoundrel' || c.race==='gloomling')) return true;
  if(g==='glimmer' && c.race==='gloomling') return true;

  if(g==='sylla' && c.race==='fae' && c.court==='fire') return true;
  return false;
}
function rollName(c){
  var list=(NAMES[c.race]||{})[c.sex] || (NAMES[c.race]||{}).m || ['Adventurer'];
  var other=list.filter(function(n){ return n!==c.name; });
  if(NAME_BANKS[c.race] && rng()<0.4){ var built=buildName(c.race, c.sex); if(built!==c.name && built.length>=3) return built; }
  return pick(other.length ? other : list);
}
function lookFor(c){ var s=RACES[c.race].sexes[c.sex]; return c.race==='fae' ? s.replace('%s', c.court) : s; }
function statsFor(c){
  var s={mig:10,agi:10,vit:10,foc:10}, rm=RACES[c.race].mods, cm=CLASSES[c.cls].mods;
  for(var k in s){ s[k]+= (rm[k]||0) + (cm[k]||0) + (c.race==='human'?1:0); }
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
  var h='<div class="wrap"><h1>Forge of the Elements</h1><div class="tag2">Descend twenty floors, from the Dungeon to the Underdark, fuse elemental motes at the Forge, and bring down each biome&rsquo;s lord.</div>';
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
      var G=GODS[g], bad=creationRefuses(c, g);
      h+='<button class="card'+(c.god===g?' on':'')+'" data-god="'+g+'" '+(bad?'disabled style="opacity:.4"':'')+'><div class="port" data-shrine="'+G.sprite+'"></div><b style="color:'+G.color+'">'+G.name+'</b><span><b style="font-family:inherit;font-size:11px;color:var(--ink)">Rule:</b> '+G.rule+'</span><span>Invoke: '+ABILITIES[G.invoke].name+'</span>'+(bad?'<span class="c-you">Refuses '+RACES[c.race].name+'s.</span>':'')+(G.loves===c.race?'<span class="c-good">Loves '+RACES[c.race].name+'s: +25% piety gain.</span>':'')+'</button>';
    });
    h+='</div>';
  }
  var st=statsFor(c), C2=CLASSES[c.cls], kit=startingKit(c);
  var kitNames=[kit.main&&WEAPONS[kit.main].name, kit.alt&&WEAPONS[kit.alt].name, kit.armor&&ARMORS[kit.armor].name, kit.off&&offKitItem(kit.off).name].filter(Boolean);
  if(c.cls==='cleric' && c.god==='grom') kitNames=['Fists (Grom forbids weapons and body armour)','Holy Symbol'];
  h+='<div class="summary"><div class="big" id="bigPort"></div><div>'+
     '<div class="step" style="margin-top:0">3 &middot; Name</div><input id="cname" type="text" maxlength="24" value="'+c.name.replace(/"/g,'')+'"> <button id="reroll">Random</button>'+
     '<div class="who" style="margin-top:8px;font-size:13px">'+RACES[c.race].name+' '+C2.name+(c.cls==='cleric'?' of '+GODS[c.god].name:'')+(c.race==='fae'?' &middot; '+RACES.fae.courts[c.court]:'')+'</div>'+
     '<div class="kv" style="max-width:420px"><span>Might</span><b>'+st.mig+'</b><span>Agility</span><b>'+st.agi+'</b><span>Vitality</span><b>'+st.vit+'</b><span>Focus</span><b>'+st.foc+'</b>'+
     '<span>Starting kit</span><b style="text-align:left">'+kitNames.join(', ')+'</b><span>Passive</span><b style="text-align:left;font-weight:400">'+C2.passive+'</b></div>'+
     '<button class="go btn-primary" id="begin">Enter the Dungeon</button> <span class="c-info" style="font-size:11px;margin-left:8px">Sound and music start with your first click. M mutes, N toggles music.</span></div></div></div>';
  el.innerHTML=h;
  el.querySelectorAll('[data-race]').forEach(function(b){ b.onclick=function(){ sfx('ui-click'); c.race=b.getAttribute('data-race'); c.name=''; if(creationRefuses(c, c.god)) c.god='murk'; renderCreate(); }; });
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
function createRunCharacter(choice){
  var kit=kitFor(choice);
  function item(table,key){if(!key)return null;return Object.assign(clone(table[key]),{key:key,tier:0,plus:0});}
  var off=kit.off?(OFFHANDS[kit.off]?item(OFFHANDS,kit.off):offHandWeapon(item(WEAPONS,kit.off))):EMPTY_OFF;
  var p={id:0,ch:'@',x:2,y:2,t:0,st:{},foe:false,buffs:{},
    race:choice.race,cls:choice.cls,sex:choice.sex,court:choice.court,look:lookFor(choice),name:(choice.name||'Adventurer').trim()||'Adventurer',
    stats:statsFor(choice),level:1,xp:0,xpNext:xpToNext(1),points:choice.cls==='tourist'?1:0,
    blurCd:0,fortCd:0,hidden:0,essence:choice.cls==='tourist'?30:0,motes:{},aff:{},primary:null,
    keys:{iron:0,crystal:0},hunger:1200,sets:[item(WEAPONS,kit.main),null],activeSet:0,
    ranged:null,armorItem:item(ARMORS,kit.armor),off:off,rings:[null,null],amulet:null,
    bag:[],hotbar:null,god:choice.cls==='cleric'?choice.god:null,piety:choice.cls==='cleric'?20:0,
    favor:choice.cls==='cleric'?20:0,amusement:50,levitate:0,face:'south',kit:choice.kit,cds:{}};
  if(choice.race==='fae'){p.aff[choice.court]=1;p.primary=choice.court;}
  if(choice.race==='gloomling'){p.aff.shadow=1;p.primary='shadow';}
  var alt=item(WEAPONS,kit.alt);if(isRangedWeapon(alt))p.ranged=alt;
  return {actor:p,bagWeapon:alt&&!p.ranged?alt:null};
}
function newRun(seed,choice){
  gameTurns.cancel();PACING.pending=null;stopTravel();fxClock=0;
  choice=choice||LAST_CHOICE||CHOICE;LAST_CHOICE=JSON.parse(JSON.stringify(choice));
  if(typeof SANDBOX!=='undefined')SANDBOX.normalTitle=false;
  if(typeof MAPVIEW!=='undefined')MAPVIEW.on=false;
  worldSeed=seed>>>0;rng=mulberry32(worldSeed);newRunState(worldSeed);
  RUN.xpCurveVersion=XP_CURVE_VERSION;
  floorNo=1;turn=0;revealAll=false;aiming=null;PARTS.length=0;fx=[];speedFxList();
  var created=createRunCharacter(choice);player=created.actor;
  shuffleSigils();ensureTrinketLooks();
  addBag('🍖','Ration',{kind:'food',data:{food:'ration'},uid:'food:ration'});
  player.bag[0].n=1+(CLASSES[choice.cls].extraFood||0);
  if(created.bagWeapon)addBag('⚔',gearName(created.bagWeapon),{kind:'weapon',data:created.bagWeapon});
  syncGlimmerLight();derive(player);
  player.hp=player.maxhp;player.mp=player.maxmp;player.guard=player.guardMax||0;player.iceArmor=player.iceArmorMax;
  generate(worldSeed);player._lx=undefined;RUN.over=false;
  if($('bReveal'))$('bReveal').textContent='Reveal: off';
  $('over').style.display='none';$('log').innerHTML='';
  log('<b>'+player.name+'</b>, '+player.who+', enters the Dungeon.','c-kill');
  if(!window.TIPS_SHOWN){
    window.TIPS_SHOWN=true;
    log('Move with the arrow keys or WASD (Q E Z C for diagonals), or click a tile. Bump enemies to attack. <b>1-8</b> use your hotbar, <b>g</b> picks up, <b>r</b> rests, <b>p</b> opens Faith, <b>i</b> your bag, <b>Tab</b> your character.','c-info');
    log('Hover anything on the map to inspect it. Traps show once you spot them; Agility helps.','c-info');
  }
  floorIntro();resize();updateUI();
}
