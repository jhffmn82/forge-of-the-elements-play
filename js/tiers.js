/* =====================================================================
   tiers.js - gear tiers T0-T3 (mechanics review 2026-09-16, DESIGN.md 12 step 2).
   T0 is class starting gear, T1 early drops, T2 mid, T3 end game.
   Every item's numbers are rebuilt from (type, tier, plus) by tierNormalize,
   so the older code that reads it.dmg / it.armor / it.block keeps working.
   Quality shows as a name word and a palette color: gray, white, blue, gold.
   Equip requirements (T1+) block equipping; T0 has none.
   ===================================================================== */

var TIER_NAME = ['Worn', '', 'Fine', 'Masterwork'];
var TIER_COL  = ['#9A958F', '#EDE6DA', '#6FA8FF', '#E8B44A'];

var TIER_WEAPON = {
  dagger:   [[2,5],[3,6],[5,9],[7,12]],
  sword:    [[3,7],[4,8],[6,12],[9,16]],
  mace:     [[3,6],[4,7],[6,11],[9,15]],
  spear:    [[4,8],[5,9],[8,14],[11,19]],
  longsword:[[6,11],[7,12],[11,18],[15,25]],
  axe:      [[7,12],[8,14],[12,21],[17,28]],
  bow:      [[2,7],[3,8],[5,12],[7,16]],
  wand:     [[1,3],[1,3],[2,4],[3,5]],
  staff:    [[2,5],[3,6],[5,9],[7,12]],
  censer:   [[2,5],[3,6],[5,9],[7,12]]
};
var MACE_PIERCE = [2,2,3,4];
var TIER_ARMOR = { robe:[0,1,2,3], leather:[2,3,5,7], chain:[3,5,8,11], plate:[4,7,11,15], shirt:[0,0,0,0] };
var TIER_ROBE = { spell:[0.05,0.05,0.10,0.15], spellPer:0.03, mana:[0.05,0.05,0.10,0.10] };
var TIER_BLOCK = { buckler:[0.08,0.10,0.14,0.18], kite:[0.15,0.20,0.25,0.30], holy:[0.04,0.05,0.07,0.09], per:0.02 };
var TIER_OFF = {
  tome:     {field:'manaPct',     base:[0.10,0.10,0.10,0.10], per:0.05},
  holy:     {field:'divine',      base:[0.10,0.15,0.20,0.25], per:0.04},
};
/* caster items: tier value + per upgrade level (tierOf reads these by tier number) */
FOCUS_BONUS = { staff:{base:[0.20,0.25,0.35,0.45], per:0.08}, wand:{base:[0.03,0.05,0.08,0.12], per:0.03},
                orb:{base:[0,0,0,0], per:0, curse:[0.08,0.10,0.15,0.20], cursePer:0.04} };
WAND_THRIFT = {base:[0.08,0.10,0.15,0.20], per:0.03};
ORB_CRIT    = {base:[0.06,0.08,0.12,0.16], per:0.03};
tierOf = function(table, it){ var v=table[tierNum(it)]; return v!==undefined ? v : table[1]; };

/* requirements: T1..T3 (T0 none). 'any' = either stat is enough */
var TIER_REQ = {
  plate:    {all:{mig:[0,14,17,21], vit:[0,12,15,18]}},
  chain:    {all:{mig:[0,12,15,18], vit:[0,11,13,16]}},
  /* 2026-09-17: one stat per weapon (damage still scales with Might for all of them); the short sword is the flexible one */
  longsword:{any:['mig'], v:[0,13,16,21]}, axe:{any:['mig'], v:[0,13,16,21]},
  mace:     {any:['mig'], v:[0,12,15,20]}, spear:{any:['mig'], v:[0,12,15,20]},
  sword:    {any:['mig','agi'], v:[0,11,14,18]},
  dagger:   {any:['agi'], v:[0,12,16,21]},   /* a tier 3 dagger wants 21 Agility, in either hand */
  bow:      {any:['agi'], v:[0,11,14,18]},
  staff:    {any:['foc'], v:[0,12,15,21]},
  wand:     {any:['foc'], v:[0,11,14,18]}, orb:{any:['foc'], v:[0,11,14,18]}, tome:{any:['foc'], v:[0,11,14,18]},
  holy:     {any:['vit','foc'], v:[0,11,14,18]}, censer:{any:['vit','foc'], v:[0,11,14,18]},
  buckler:  {any:['mig','vit'], v:[0,11,14,18]}, kite:{any:['mig','vit'], v:[0,11,14,18]}
};
var STAT_NAME = {mig:'Might', agi:'Agility', vit:'Vitality', foc:'Focus'};
/* Owner-settled depth milestones: [depth, plain, masterwork]. Fine is the remainder. */
var QUALITY_CURVE = [[1,0.9,0],[5,0.5,0],[10,0,0.10],[15,0,0.25],[20,0,0.40],[25,0,0.40]];
function qualityOdds(depth){
  var d=Math.max(1,Math.min(25,depth)), a=QUALITY_CURVE[0], b=a;
  for(var i=1;i<QUALITY_CURVE.length;i++){ b=QUALITY_CURVE[i]; if(d<=b[0]) break; a=b; }
  var t=b[0]===a[0]?0:(d-a[0])/(b[0]-a[0]);
  var plain=a[1]+(b[1]-a[1])*t, master=a[2]+(b[2]-a[2])*t;
  return [plain,1-plain-master,master];
}
function rollEnhancement(minimum){
  var plus=minimum||0;
  while(plus<3 && rng()<1/3) plus++;
  return plus;
}

/* ---------------------------------------------------------------- identity */
function itemKey(it){
  if(!it || it===EMPTY_OFF || it.unarmed || it.joke || it.kind==='ring' || it.kind==='amulet' || it.name==='Loud Shirt') return null;
  if(it.key) return it.key;
  var k=null;
  var tables=[['off',OFFHANDS],['armor',ARMORS],['weapon',WEAPONS]];
  for(var i=0;i<tables.length && !k;i++){ var T=tables[i][1]; for(var n in T){ if(T[n].name===it.name && (!it.kind || it.kind===tables[i][0] || tables[i][0]==='weapon')){ k=n; break; } } }
  if(!k){ var ic=(it.icon||'').replace(/^item-/,''); if(WEAPONS[ic]||ARMORS[ic]||OFFHANDS[ic]) k=ic; }
  if(k) it.key=k;
  return k;
}
/* 2026-09-20: this read every tier string except 'Trusty' as tier 1, so Justin's upgrade prices of
   2026-09-18 (Fine 1.5x, Masterwork 2x) never applied to an item whose tier was still a string - and the
   obsolete 'Trusty' collected the 1.5x that belongs to Fine. Both forms are live: newRun() deals kit gear
   'Rusty', bossDefeated() and the altar set 'Trusty', world.js deals both, and tierNormalize writes a
   number. Every name the game has ever written is mapped here. */
var TIER_BY_NAME = {Worn:0, Rusty:1, '':1, Plain:1, Trusty:2, Fine:2, Masterwork:3};
function tierNum(it){
  if(!it) return 1;
  if(typeof it.tier==='number') return Math.max(0, Math.min(3, it.tier));
  var t=TIER_BY_NAME[it.tier];
  return t===undefined ? 1 : t;
}
function tierCol(it){ return (it && itemKey(it)) ? TIER_COL[tierNum(it)] : null; }
/* rebuild an item's numbers from its type, tier and plus (safe to call any time) */
function tierNormalize(it){
  var k=itemKey(it); if(!k) return it;
  if(k==='censer'){it.name='Ceremonial Knife';it.icon='item-censer';}
  var t=tierNum(it), lvl=it.plus||0; it.tier=t;
  if(TIER_WEAPON[k] && (it.kind!=='off' || it.weapon)){
    var b=TIER_WEAPON[k][t], per=tierPer(it);
    it.dmg=[b[0]+lvl*(per[0]-1), b[1]+lvl*(per[1]-1)];   /* derive adds the plus once more */
    if(k==='mace') it.pierce=MACE_PIERCE[t];
    if(k==='censer') it.divine=TIER_OFF.holy.base[t]+TIER_OFF.holy.per*lvl;
  }
  if(TIER_ARMOR[k]){
    it.armor=TIER_ARMOR[k][t];
    it.eva = k==='leather' ? 5+2*lvl : k==='plate' ? -10 : k==='robe' ? 5 : 0;
  }
  if(TIER_BLOCK[k]){ it.block=TIER_BLOCK[k][t]; it.eva = k==='kite' ? -5 : 0; }
  if(TIER_OFF[k]){ var O=TIER_OFF[k]; it[O.field]=Math.max(0, O.base[t]+O.per*lvl); }
  if(k==='holy'||k==='censer') it.note='Divine Focus: strengthens Invokes and prayers.';
  return it;
}
function tierPer(w){
  var t=tierNum(w), p=[1, t+1];
  if((w.hands||1)===2) p=[Math.round(p[0]*1.5), Math.round(p[1]*1.5)];
  return p;
}
function allGear(){
  var out=[];
  if(!player) return out;
  (player.sets||[]).forEach(function(s){ if(s) out.push(s); });
  if(player.ranged && out.indexOf(player.ranged)<0) out.push(player.ranged);
  if(player.armorItem) out.push(player.armorItem);
  if(player.off && player.off!==EMPTY_OFF) out.push(player.off);
  (player.bag||[]).forEach(function(b){ if(b.data && (b.kind==='weapon'||b.kind==='armor'||b.kind==='off')) out.push(b.data); });
  return out;
}

/* ---------------------------------------------------------------- requirements */
function gearReq(it){
  var k=itemKey(it); if(!k || !TIER_REQ[k]) return null;
  var t=tierNum(it); if(t===0) return null;
  var R=TIER_REQ[k];
  if(R.all){ var parts=[]; for(var s in R.all) if(R.all[s][t]) parts.push({stat:s, v:Math.min(21,R.all[s][t])}); return {all:parts}; }
  return {any:R.any, v:Math.min(21,R.v[t])};
}
function meetsReq(it){
  var r=gearReq(it); if(!r) return true;
  var st=player.stats;
  if(r.all) return r.all.every(function(p){ return st[p.stat]>=p.v; });
  return r.any.some(function(s){ return st[s]>=r.v; });
}
function reqText(it){
  var r=gearReq(it); if(!r) return '';
  if(r.all) return r.all.map(function(p){ return STAT_NAME[p.stat]+' '+p.v; }).join(', ');
  return r.any.map(function(s){ return STAT_NAME[s]; }).join(' or ')+' '+r.v;
}
function reqRow(it){
  var r=gearReq(it); if(!r) return '';
  var ok=meetsReq(it);
  return '<div class="row"><span>Requires</span><b style="color:'+(ok?'#9FC08A':'#D0605A')+'">'+reqText(it)+'</b></div>';
}
function reqBlock(it){
  if(!it || meetsReq(it)) return false;
  var r=gearReq(it), stats=r.all ? r.all.map(function(p){ return p.stat; }) : r.any;
  var why = stats.length===1 ? ({mig:'strong', agi:'nimble', vit:'hardy', foc:'focused'})[stats[0]] : null;
  log((why ? 'You are not '+why+' enough to use the <b>' : 'You can&rsquo;t use the <b>')+gearName(it)+'</b> yet. It needs '+reqText(it)+'.','c-info'); sfx('ui-error');
  return true;
}
var _useBagItemTier = useBagItem;
useBagItem = function(idx){
  var b=player.bag[idx];
  if(b && (b.kind==='weapon'||b.kind==='armor'||b.kind==='off') && reqBlock(tierNormalize(b.data))) return;
  return _useBagItemTier(idx);
};
var _equipFromBagTier = equipFromBag;
equipFromBag = function(idx, slot){
  var b=player.bag[idx];
  if(b && (b.kind==='weapon'||b.kind==='armor'||b.kind==='off') && reqBlock(tierNormalize(b.data))) return;
  return _equipFromBagTier(idx, slot);
};

/* ---------------------------------------------------------------- names and colors */
var _gearNameTier = gearName;
gearName = function(it){
  if(!it || !itemKey(it)) return _gearNameTier(it);
  var t=tierNum(it), saved=it.tier;
  it.tier=undefined;
  var n=_gearNameTier(it);
  it.tier=saved;
  return (TIER_NAME[t] ? TIER_NAME[t]+' ' : '')+n;
};
function tierTint(html, it){
  var c=tierCol(it); if(!c || !html) return html;
  return html.replace('<div class="nm">', '<div class="nm" style="color:'+c+'"><span class="tierpip" style="background:'+c+'"></span>');
}
var _weaponCardTier = weaponCard;
weaponCard = function(w, worn){ if(w) tierNormalize(w); return tierTint(_weaponCardTier(w, worn), w) + (w && !worn ? reqRow(w) : ''); };
var _armorCardTier = armorCard;
armorCard = function(a, worn){
  if(a) tierNormalize(a);
  var h=_armorCardTier(a, worn);
  if(a && a.armor===0 && itemPlus(a)) h=h.replace('<span>Armor</span><b>0</b>', '<span>Armor</span><b>'+itemPlus(a)+'</b>');
  if(a && itemKey(a)==='robe' && !a.unid) h+='<div class="row"><span>Spell damage</span><b>+'+Math.round(robeSpell(a)*gearPassiveBonus()*100)+'%</b></div><div class="row"><span>Max mana</span><b>+'+Math.round(TIER_ROBE.mana[tierNum(a)]*gearPassiveBonus()*100)+'%</b></div>';
  return tierTint(h, a) + (a && !worn ? reqRow(a) : '');
};
var _bagCardTier = bagCard;
bagCard = function(it){
  if(it && it.data && (it.kind==='weapon'||it.kind==='armor'||it.kind==='off')) tierNormalize(it.data);
  var h=_bagCardTier(it);
  if(it && it.kind==='off' && it.data){
    var d=it.data, k=itemKey(d), extra='';
    if(!d.unid){
      if(TIER_BLOCK[k]) extra+='<div class="row"><span>Block</span><b>'+Math.round((d.block+TIER_BLOCK.per*(d.plus||0))*100)+'%</b></div>';
      if(k==='tome') extra+='<div class="row"><span>Max mana</span><b>+'+Math.round(d.manaPct*gearPassiveBonus()*100)+'%</b></div>';
      if(k==='holy') extra+='<div class="row"><span>Invoke &amp; prayer strength</span><b>+'+Math.round(d.divine*gearPassiveBonus()*100)+'%</b></div>';
      if(d.kind==='off' && d.weapon) extra+='<div class="row"><span>Off-hand strike</span><b>60% damage, own procs</b></div>';
    }
    h=tierTint(h, d)+extra+reqRow(d);
  }
  return h;
};
/* bag cells and worn slots pick up the tier color */
var _panesTier = panes;
panes = function(){
  _panesTier();
  if(openSheet!=='Equip' || !$('mEquip')) return;
  $('mEquip').querySelectorAll('.cell[data-b]').forEach(function(cel){
    var b=player.bag[+cel.getAttribute('data-b')];
    var c=b && b.data && (b.kind==='weapon'||b.kind==='armor'||b.kind==='off') ? tierCol(b.data) : null;
    if(c){ cel.style.borderColor=c; cel.style.boxShadow='inset 0 0 0 1px '+c+'55'; }
    if(b && b.data && (b.kind==='weapon'||b.kind==='armor'||b.kind==='off') && !meetsReq(b.data)) cel.style.opacity='0.55';
  });
  var map={main:player.weapon, off:player.off, armor:player.armorItem};
  $('mEquip').querySelectorAll('.eslot[data-eq]').forEach(function(es){
    var it=map[es.getAttribute('data-eq')], v=es.querySelector('.v'), c=tierCol(it);
    if(v && c) v.style.color=c;
  });
};
(function(){ var st=document.createElement('style'); st.textContent='.tierpip{display:inline-block;width:7px;height:7px;border-radius:2px;margin-right:6px;vertical-align:1px}'; document.head.appendChild(st); })();

/* ---------------------------------------------------------------- derived numbers */
function robeSpell(a){ return TIER_ROBE.spell[tierNum(a)] + TIER_ROBE.spellPer*Math.max(0,(a.plus||0)); }
var _deriveTier = derive;
derive = function(p){
  if(p===player) allGear().forEach(tierNormalize);
  _deriveTier(p);
  if(p!==player) return;
  var w=p.weapon;
  /* dwarves count as +1 at the weapon's full per-level rate */
  if(w && !w.unarmed && itemKey(w) && p.race==='dwarf'){ var per=tierPer(w); p.dmg=[p.dmg[0]+per[0]-1, p.dmg[1]+per[1]-1]; }
  var arm=p.armorItem;
  if(arm && itemKey(arm) && arm.armor===0) p.armor += Math.max(0, itemPlus(arm));
  /* shields: tier block + 2% per level + 2% per point of Might above 10 (Might braces the shield, 2026-09-17;
     stats cap at 25, so a maxed Might is +30% and a real shield build blocks nearly everything),
     60% cap. This is the live formula - combat.js sets p.block first and this wrapper runs after it. */
  var o=p.off, sh = o && o!==EMPTY_OFF && o.block>0 && !p.twoHanded;
  p.block = sh ? Math.min(0.75, o.block + TIER_BLOCK.per*(o.plus||0)
                              + (p.cls==='fighter' && typeof FIGHTER_NO_BLOCK==='undefined' ? 0.15 : 0)
                              + 0.02*Math.max(0, (p.stats&&p.stats.mig||10)-10)) : 0;
  /* tomes carry their own per-level mana; undo upgrade.js's older +5%/level */
  if(o && o!==EMPTY_OFF && !p.twoHanded && o.manaPct && (o.plus||0)) p.maxmp=Math.round(p.maxmp/(1+0.05*o.plus));
  if(arm && itemKey(arm)==='robe') p.maxmp=Math.round(p.maxmp*(1+TIER_ROBE.mana[tierNum(arm)]*gearPassiveBonus()));
  if(p.hp>p.maxhp) p.hp=p.maxhp;
  if(p.mp>p.maxmp) p.mp=p.maxmp;
};
/* robe spell damage joins the gear pool */
var _spellPowerTier = spellPower;
spellPower = function(A){
  var m=_spellPowerTier(A), arm=player.armorItem;
  if(arm && itemKey(arm)==='robe' && !arm.cursed){
    var pool=focusBonus(player.weapon) + (player.twoHanded ? 0 : focusBonus(player.off));
    m *= Math.max(0.1, 1+pool+robeSpell(arm)*gearPassiveBonus()) / Math.max(0.1, 1+pool);
  }
  return m;
};

/* ---------------------------------------------------------------- drops by depth */
function rollTier(){
  var odds=qualityOdds(floorNo), r=rng();
  return r<odds[0] ? 1 : r<odds[0]+odds[1] ? 2 : 3;
}
var _randomGearTier = randomGear;
randomGear = function(){
  var g=_randomGearTier();
  if(g && g.it && (g.kind==='weapon'||g.kind==='armor'||g.kind==='off')){ g.it.tier=rollTier(); tierNormalize(g.it); }
  return g;
};

/* ---------------------------------------------------------------- starting kits are T0 */
var _newRunTier = newRun;
newRun = function(seed, choice){
  _newRunTier(seed, choice);
  allGear().forEach(function(it){ it.tier=0; it.plus=0; tierNormalize(it); });
  derive(player); player.hp=player.maxhp; player.mp=player.maxmp;
  updateUI();
};
