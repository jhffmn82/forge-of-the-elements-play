/* =====================================================================
   crypt.js - biome 2, the Crypt (floors 6-10), 2026-09-17. See DESIGN.md section 17.
   Monsters: Shambler, Grave Beetle, Skeleton, Bone Archer, Shade, Grave Bloat, Necro-Acolyte.
   Boss: Morty the Mostly-Dead (floor 10) with his phylactery. Crypt props, green soul-fire light,
   poison clouds, Rot, bone wards.
   ===================================================================== */

/* ---------------------------------------------------------------- the bestiary */
(function(){
  var M=MONSTERS;
  M.shambler   = {name:'Shambler', sprite:'m-shambler', col:'#8FA37A', ch:'z', hp:40, dmg:[5,8], acc:60, eva:8, armor:1, speed:100, range:1, xp:22,
                  band:[6,8], w:22, undead:true, rises:true, art:0.95, sfx:'zombie'};
  M.gravebeetle= {name:'Grave Beetle', sprite:'m-grave-beetle', col:'#3E5A3A', ch:'b', hp:40, dmg:[5,8], acc:62, eva:12, armor:3, speed:100, range:1, xp:20,
                  band:[6,8], w:18, fumes:true, living:true, art:0.8, sfx:'slime'};
  M.skeleton.band=[6,10]; M.skeleton.w=18; M.skeleton.boneType=true; M.skeleton.sprite='m-crypt-skeleton';   /* Justin's Crypt sprite set, 2026-09-17 */
  /* 2026-09-17: their arrows are grave-tipped. A 4-7 shot was nothing to a mage with Magic Barrier (-5 from
     ranged) or anyone in real armour, so the threat is the poison rather than the hit. */
  M.bonearcher = {name:'Bone Archer', sprite:'m-bone-archer', col:'#D8CEBC', ch:'a', hp:36, dmg:[5,8], acc:64, eva:16, armor:1, speed:100, range:6, xp:26,
                  band:[7,10], w:14, undead:true, reloads:true, poisons:0.65, art:0.95, sfx:'skeleton'};
  M.shade      = {name:'Shade', sprite:'m-shade', col:'#5A3E7A', ch:'S', hp:40, dmg:[5,8], acc:66, eva:26, armor:0, speed:100, range:1, xp:30,
                  band:[7,10], w:10, undead:true, shadowy:true, phases:true, el:'shadow', art:0.95, sfx:'wisp'};
  M.gravebloat = {name:'Grave Bloat', sprite:'m-grave-bloat', col:'#9FBF7A', ch:'B', hp:75, dmg:[8,11], acc:58, eva:4, armor:2, speed:100, range:1, xp:38,
                  band:[8,10], w:10, undead:true, bursts:true, rots:true, art:1.1, sfx:'zombie'};
  M.acolyte    = {name:'Necro-Acolyte', sprite:'m-necro-acolyte', col:'#6A3E8A', ch:'n', hp:36, dmg:[5,8], acc:62, eva:14, armor:0, speed:100, range:1, xp:40,
                  band:[9,10], w:8, living:true, spellcaster:true, summoner:true, art:0.95, sfx:'shaman'};
  M.morty      = {name:'Morty the Mostly-Dead', sprite:'m-morty', col:'#7A4FB0', ch:'M', hp:170, dmg:[8,13], acc:70, eva:18, armor:3, speed:100, range:1, xp:450,
                  band:[10,10], w:0, boss:true, elite:true, undead:true, spellcaster:true, art:1.2, sfx:'morty'};
  M.phylactery = {name:'Phylactery', sprite:'m-phylactery', col:'#6FE08A', ch:'&', hp:60, dmg:[0,0], acc:0, eva:0, armor:12, speed:100, range:0, xp:60,
                  band:[10,10], w:0, still:true, object:true, art:0.9};
  /* elementalings roam every biome */
  ['emberling','tideling','galeling','stoneling','wisp','lumenling'].forEach(function(k){ if(M[k]) M[k].band=[M[k].band[0], 25]; });
  DROPS.shambler   = {chance:0.12, table:{essence:10, food:4}};
  DROPS.gravebeetle= {chance:0.14, table:{essence:12, sigil:1}};
  DROPS.bonearcher = {chance:0.22, table:{essence:8, gear:6, sigil:1}};
  DROPS.shade      = {chance:0.20, table:{essence:10, sigil:3}};
  DROPS.gravebloat = {chance:0.35, table:{essence:6, gear:5, food:2}};
  DROPS.acolyte    = {chance:0.40, table:{essence:6, sigil:4, gear:4}};
  DROPS.phylactery = {chance:0, table:{essence:1}};
})();
function inCrypt(){ return bidx()===1; }

/* ---------------------------------------------------------------- props and light */
PROPS['sarcophagus']     = {b:1};
PROPS['sarcophagus-open']= {b:1};
PROPS['urn']             = {b:1, br:1};
PROPS['urn-broken']      = {flat:1};
PROPS['soul-brazier']    = {b:1, light:'#7CFFA0'};
PROPS['grave-pillar']    = {b:1};
PROPS['skeleton-niche']  = {b:1};
PROPS['bone-pile']       = {flat:1};
PROPS['coffin']          = {b:1};
PROPS['candelabra']      = {b:1, light:'#9CFFB8'};
if(typeof FLAME_AT!=='undefined'){ FLAME_AT['soul-brazier']={ax:0.5, ay:0.28, size:0.46, wide:1.4, soul:1}; FLAME_AT['candelabra']={ax:0.5, ay:0.14, size:0.16, wide:0.7, soul:1}; }
var CRYPT_PROP = {'brazier-lit':'soul-brazier', 'brazier-unlit':'soul-brazier', 'torch-stand':'candelabra', 'banner-stand':'grave-pillar',
  /* 2026-09-20: 'barrel-explosive' used to map to 'urn' here, swept in beside plain barrels, crates and
     pots when this table was written to re-skin the Crypt. But an explosive barrel carries ex:1 (js/data.js)
     and an urn does not, so the storage room's one gameplay object was silently defused underground. It
     stays a barrel: Justin wants it to go off. Anything added here must be checked the same way - this
     table is for looks, and a prop that does something is not interchangeable with one that does not. */
  'statue':'sarcophagus', 'statue-broken':'sarcophagus-open', 'barrel':'urn', 'crate':'urn', 'crate-supply':'urn', 'pot':'urn',
  'bookshelf':'coffin', 'weapon-rack':'coffin', 'cart':'sarcophagus-open', 'bed-straw':'bone-pile', 'alchemy-table':'sarcophagus', 'table-candle':'candelabra'};
var _addPropCrypt = addProp;
addProp = function(x, y, name, extra){
  if(inCrypt() && CRYPT_PROP[name] && objArt('props', CRYPT_PROP[name])) name=CRYPT_PROP[name];
  var p=_addPropCrypt(x, y, name, extra);
  /* candelabras burn violet or green, fixed per spot */
  if(p && p.name==='candelabra' && inCrypt() && !(extra && extra.light)){ p.violet = hash2(x,y,91)<0.6; p.light = p.violet ? '#B07CFF' : '#7CFFA0'; }
  return p;
};
/* green soul fire */
if(typeof drawPixelFlame==='function'){
  var _propFlameCrypt = propFlame;
  propFlame = function(p, o, px, py, alpha, now){
    var F=FLAME_AT[p.name]; if(!F || !F.soul) return _propFlameCrypt(p, o, px, py, alpha, now);
    SOUL_FIRE=p.violet ? 'violet' : true; try{ return _propFlameCrypt(p, o, px, py, alpha, now); } finally { SOUL_FIRE=false; }
  };
}
var SOUL_FIRE=false;
var _gatherLightsCrypt = gatherLights;
gatherLights = function(now, prp){
  var L=_gatherLightsCrypt(now, prp);
  if(inCrypt()){
    var green=hexRGB('#6FE89A');
    L.forEach(function(l, i){ if(i===0) return; var c=l.c; if(c[0]>0.9 && c[1]>0.5 && c[1]<0.75 && c[2]<0.4){ l.c=green; l.s*=0.85; } });   /* wall sconces burn green */
    (floorMeta.clouds||[]).forEach(function(cl){ if(turn<cl.until && cl.cells.length){ var i0=cl.cells[Math.floor(cl.cells.length/2)]; L.push({x:i0%MW, y:(i0/MW)|0, c:hexRGB('#8CFF6A'), r:2.2, s:0.35, tx:i0%MW, ty:(i0/MW)|0}); } });
  }
  return L;
};

/* ---------------------------------------------------------------- special rooms speak the Crypt's language */
/* base.poisons is the chance a hit from this creature poisons you. The Bone Archer is the one that has it:
   its damage alone stopped mattering once you had armour or Magic Barrier (2026-09-17). */
var _applyDamageCryptPoison = applyDamage;
applyDamage = function(target, amount, type, source){
  var d = _applyDamageCryptPoison(target, amount, type, source);
  if(target===player && d>0 && source && source.base && source.base.poisons && !player.st.poison
     && rng() < source.base.poisons && !(typeof aff==='function' && aff('earth')>=6)){
    applyStatus(player, 'poison', 4, Math.max(2, sDMG ? sDMG(2) : 2));
    log('The arrow is grave-tipped: <b>you are poisoned</b>.','c-you');
  }
  return d;
};
var CRYPT_SWAP = {rat:'gravebeetle', bat:'shambler', goblin:'shambler', archer:'bonearcher', brute:'gravebloat'};
var _spawnCrypt = spawn;
spawn = function(kind, x, y){ if(inCrypt() && CRYPT_SWAP[kind]) kind=CRYPT_SWAP[kind]; return _spawnCrypt(kind, x, y); };

/* ---------------------------------------------------------------- poison clouds and Rot */
function addCloud(cx, cy, r, turns, dmg, source){
  floorMeta.clouds=floorMeta.clouds||[];
  var cells=[];
  for(var y=cy-r;y<=cy+r;y++) for(var x=cx-r;x<=cx+r;x++) if(inb(x,y) && walkable(x,y)) cells.push(idxOf(x,y));
  floorMeta.clouds.push({cells:cells, until:turn+turns, dmg:dmg, src:source||''});
  burst(cx, cy, 'poison', 40, 0.06);
}
function cloudAt(i){ return (floorMeta.clouds||[]).filter(function(c){ return turn<c.until && c.cells.indexOf(i)>=0; })[0]; }
var _endTurnCrypt = endTurn;
endTurn = function(){
  var before=turn;_endTurnCrypt();if(turn===before)return;
  if(!floorMeta || !floorMeta.clouds || !floorMeta.clouds.length || !player || player.hp<=0) return;
  floorMeta.clouds = floorMeta.clouds.filter(function(c){ return turn<c.until; });
  ents.slice().forEach(function(e){
    var c=cloudAt(idxOf(e.x,e.y)); if(!c) return;
    if(e!==player && (e.base.undead || e.base.fumes || e.base.object)) return;   /* the dead don't breathe; beetles live in it */
    var d=applyDamage(e, c.dmg, 'poison', null); floatText(e.x,e.y,String(d),'poison');
    if(e===player){ log('Noxious fumes burn your lungs: '+d+' damage.','c-you'); if(player.hp<=0){  if(player.hp<=0) death(); } }
    else if(e.hp<=0) kill(e, null);
  });
};
var CLOUD_PUFF=null;
function cloudPuff(){
  if(CLOUD_PUFF) return CLOUD_PUFF;
  var c=document.createElement('canvas'); c.width=c.height=64; var g=c.getContext('2d');
  var gr=g.createRadialGradient(28,26,2,32,32,32);
  gr.addColorStop(0,'rgba(170,225,110,0.95)'); gr.addColorStop(0.45,'rgba(120,190,70,0.6)'); gr.addColorStop(0.8,'rgba(80,140,50,0.18)'); gr.addColorStop(1,'rgba(60,110,40,0)');
  g.fillStyle=gr; g.fillRect(0,0,64,64); CLOUD_PUFF=c; return c;
}
var _drawTelegraphsCrypt = drawTelegraphs;
drawTelegraphs = function(now){
  _drawTelegraphsCrypt(now);
  if(!floorMeta) return;
  var t=(now||0)/1000;
  ctx.save();
  (floorMeta.clouds||[]).forEach(function(c){
    if(turn>=c.until) return;
    var fade=Math.min(1, (c.until-turn)/2);
    /* billowing puffs that spill over the cells' edges and drift, not flat squares */
    var puff=cloudPuff();
    c.cells.forEach(function(i){
      if(!(revealAll||seen[i])) return;
      var x=i%MW, y=(i/MW)|0;
      for(var k=0;k<3;k++){
        var h1=hash2(x,y,k*3+1), h2=hash2(x,y,k*3+2), h3=hash2(x,y,k*3+3), sp=ANIM.reduce ? 0 : t*(0.25+h3*0.3);
        var cx=(x-camX+0.5 + (h1-0.5)*0.6 + Math.sin(sp+h2*6.28)*0.12)*TS, cy=(y-camY+0.5 + (h2-0.5)*0.6 + Math.cos(sp*0.8+h1*6.28)*0.1)*TS;
        var r=TS*(0.62+h3*0.3)*(1+0.06*Math.sin(sp*1.7+k));
        ctx.globalAlpha=(0.34+0.08*Math.sin(sp*1.3+h1*6))*fade;
        ctx.drawImage(puff, cx-r, cy-r, r*2, r*2);
      }
    });
    ctx.globalAlpha=1;
  });
  (floorMeta.marks||[]).forEach(function(m){
    if(turn>=m.until) return;
    /* warning glow: a soft pulsing pool per cell with a bright core, no hard squares */
    var rgb=hexRGB(m.col), col='rgb('+Math.round(rgb[0]*255)+','+Math.round(rgb[1]*255)+','+Math.round(rgb[2]*255)+')';
    m.cells.forEach(function(i){
      var x=i%MW, y=(i/MW)|0, cx=(x-camX+0.5)*TS, cy=(y-camY+0.5)*TS, pulse = ANIM.reduce ? 0.6 : 0.45+0.3*Math.sin(t*8+x+y);
      var g=ctx.createRadialGradient(cx,cy,TS*0.05,cx,cy,TS*0.75); g.addColorStop(0,col); g.addColorStop(0.55,col); g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.globalAlpha=pulse*0.55; ctx.fillStyle=g; ctx.fillRect(cx-TS*0.75,cy-TS*0.75,TS*1.5,TS*1.5);
      ctx.globalAlpha=pulse; ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(cx,cy,TS*0.12,0,7); ctx.fill(); ctx.globalAlpha=1;
    });
  });
  ctx.restore();
};
if(typeof STATUS_INFO!=='undefined') STATUS_INFO.rot = {name:'Rot', icon:'st-poison', bad:1, d:'Your wounds won\'t close: no HP regeneration.'};

/* ---------------------------------------------------------------- damage rules */
var _applyDamageCrypt = applyDamage;
applyDamage = function(target, amount, type, source){
  if(target && target!==player && target.base){
    /* skeletons: blades and arrows slip between the bones, blunt force shatters them */
    if(target.base.boneType && type==='phys' && source===player){
      var k=typeof itemKey==='function' ? itemKey(player.weapon) : null;
      if(player.weapon.unarmed || k==='mace') amount*=1.5;
      else if(k==='dagger' || k==='bow' || k==='spear') amount*=0.5;
    }
    /* shades: weapons pass through them */
    if(target.base.phases && type==='phys') amount*=0.5;
    /* the phylactery: only light and fire really hurt it */
    if(target.base.object && target.kind==='phylactery') amount *= (type==='light'||type==='fire') ? 2 : 0.25;
    /* a bone ward swallows one hit */
    if(target.boneWard && amount>0){ target.boneWard=false; floatText(target.x,target.y,'ward','miss'); if(vis[idxOf(target.x,target.y)]) log('A bone ward shatters around the '+target.name+'.','c-info'); return 0; }
    target._lastType=type;
  }
  var d=_applyDamageCrypt(target, amount, type, source);
  if(target===player && source && source.base && d>0){
    if(source.base.phases){ var drain=Math.min(Math.floor(player.mp), 4); if(drain>0){ player.mp-=drain; floatText(player.x,player.y,'-'+drain+' mp','magic'); } }
    if(source.base.rots){ applyStatus(player,'rot',20); }   /* through applyStatus, so Iron Constitution halves it (2026-09-22) */
  }
  return d;
};
/* ---------------------------------------------------------------- attacks: beetle fumes, archer pins */
var _attackCrypt = attack;
attack = function(att, def, mult, label){
  var hp0 = def ? def.hp : 0;
  var r=_attackCrypt(att, def, mult, label);
  if(att===player && def && def.base && def.base.fumes && dist(att,def)<=1 && def.hp>0 && (def._fumeAt||-9)<turn-1){
    def._fumeAt=turn; addCloud(def.x, def.y, 1, 5, sDMG(2+Math.floor(floorNo/3)), 'beetle');
    log('The <b>Grave Beetle</b> vents a cloud of noxious fumes!','c-you'); sfx('trap-gas');
  }
  if(att && att.base && att.base.reloads && def===player && dist(att,def)>1){
    att.reloading=true;
    if(player.hp<hp0){ applyStatus(player,'root',1); log('An arrow pins you in place.','c-you'); }
  }
  return r;
};

/* ---------------------------------------------------------------- monster turns */
var _aiActCrypt = aiAct;
aiAct = function(e){
  var b=e.base||{};
  if(b.object){ e.t+=actCost(e); return; }
  if(e.kind==='morty') return mortyAct(e);
  if(e.state==='hunt' && !e.st.stun && !e.st.frozen){
    /* Bone Archer: a turn to nock */
    if(b.reloads && e.reloading){ e.reloading=false; if(vis[idxOf(e.x,e.y)]) log('The <b>Bone Archer</b> nocks an arrow.','c-info'); e.t+=actCost(e); return; }
    /* Necro-Acolyte: keep away, summon, ward, curse */
    if(b.summoner && canSeePlayer(e)){
      var d=dist(e,player);
      e.sumCd=(e.sumCd||0)-1; e.wardCd=(e.wardCd||0)-1;
      var minion=ents.filter(function(o){ return o.id===e.minion && o.hp>0; })[0];
      if(!minion && e.sumCd<=0){
        var c=nearFree(e.x,e.y,2); if(c){ var sk=_spawnCrypt('skeleton', c.x, c.y); sk.state='hunt'; sk.noXp=true; e.minion=sk.id; e.sumCd=6; setClip(e,'attack'); sfx('shaman-cast'); sparkleFx(c.x,c.y,'dark',24); log('The <b>Necro-Acolyte</b> calls a Skeleton up out of the floor.','c-you'); e.t+=actCost(e); return; }
      }
      if(e.wardCd<=0){
        var warded=0; ents.forEach(function(o){ if(o.foe && o.base.undead && dist(o,e)<=4 && !o.boneWard){ o.boneWard=true; warded++; } });
        e.wardCd=5; if(warded){ setClip(e,'attack'); if(vis[idxOf(e.x,e.y)]) log('The <b>Necro-Acolyte</b> wraps the dead in bone wards.','c-info'); e.t+=actCost(e); return; }
      }
      if(d<=3 && fleeStep(e)){ e.t+=actCost(e); return; }
      e.boltCd=(e.boltCd||0)-1;
      if(d<=5 && e.boltCd<=0 && clearShot(e,player)){   /* 2026-09-22: no grave bolt through its own skeletons */
        e.boltCd=3; setClip(e,'attack'); boltFx(e.x,e.y,player.x,player.y,'dark');
        if(rng()<hostileHitChance(hitChance(b.acc+8, player.eva),true)){ var gd=applyDamage(player, roll(3,6)+Math.floor(floorNo/2), 'dark', e); floatText(player.x,player.y,String(gd),'dark'); log('The <b>Necro-Acolyte</b>\'s grave bolt hits you: '+gd+'.','c-you'); if(player.hp<=0) kill(player,e); }
        else log('A grave bolt misses.','c-miss');
        e.t+=actCost(e); return;
      }
    }
    /* Shade: drifts through doors and thin walls */
    if(b.phases && !e.st.root){
      var d2=dist(e,player);
      if(d2<=1){ attack(e,player); e.t+=actCost(e); return; }
      var best=null, bd=d2;
      [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]].forEach(function(o){
        var nx=e.x+o[0], ny=e.y+o[1]; if(!inb(nx,ny) || nx<1||ny<1||nx>=MW-1||ny>=MH-1 || occupied(nx,ny) || at(nx,ny)===CHASM) return;
        var t=at(nx,ny), thin = walkable(nx,ny) || t===DOOR || (t===WALL && [[1,0],[-1,0],[0,1],[0,-1]].some(function(q){ return walkable(nx+q[0],ny+q[1]); }));
        if(!thin) return; var dd=dist({x:nx,y:ny}, player); if(dd<bd){ bd=dd; best={x:nx,y:ny}; }
      });
      if(best && (canSeePlayer(e) || d2<=10)){ e.x=best.x; e.y=best.y; e.t+=actCost(e); return; }
    }
  }
  return _aiActCrypt(e);
};

/* ---------------------------------------------------------------- deaths: shamblers rise, bloats burst */
var _killCrypt = kill;
kill = function(e, by){
  if(!e || e===player) return _killCrypt(e, by);
  var b=e.base||{};
  if(b.rises && !e.risen && e._lastType!=='fire' && e._lastType!=='light' && !(e.st && e.st.burn) && ents.indexOf(e)>=0){
    ents=ents.filter(function(x){ return x!==e; });
    floorMeta.corpses=floorMeta.corpses||[];
    floorMeta.corpses.push({x:e.x, y:e.y, at:turn+3, kind:e.kind, maxhp:e.maxhp});
    if(vis[idxOf(e.x,e.y)]) log('The <b>Shambler</b> collapses... and twitches. Finish it, or burn it.','c-info');
    fx.push({k:'d', e:{x:e.x, y:e.y, col:e.col, sprite:b.sprite, art:b.art, flip:(player.x<e.x)!==!!b.artLeft}, t0:Math.max(performance.now(), fxClock)+60, dur:900});
    return;
  }
  if(b.bursts && ents.indexOf(e)>=0){
    addCloud(e.x, e.y, 1, 5, sDMG(3+Math.floor(floorNo/3)), 'bloat');
    if(vis[idxOf(e.x,e.y)]) log('The <b>Grave Bloat</b> bursts in a cloud of rot!','c-you');
    sfx('trap-gas');
  }
  if(inCrypt() && b.living!==false && !b.object){ floorMeta.deathSpots=floorMeta.deathSpots||[]; floorMeta.deathSpots.push({x:e.x,y:e.y}); if(floorMeta.deathSpots.length>12) floorMeta.deathSpots.shift(); }
  if(e.kind==='morty') return mortyDies(e, by);
  if(e.kind==='phylactery') phylacteryBreaks(e);
  return _killCrypt(e, by);
};
/* a corpse that isn't finished gets back up */
var _endTurnCorpse = endTurn;
endTurn = function(){
  _endTurnCorpse();
  if(!floorMeta || !floorMeta.corpses || !floorMeta.corpses.length) return;
  floorMeta.corpses = floorMeta.corpses.filter(function(c){
    var i=idxOf(c.x,c.y);
    if(fireT[i]>0 || (holyG && holyG[i])){ if(vis[i]) log('The corpse burns away for good.','c-good'); return false; }
    if(turn<c.at) return true;
    var spot = occupied(c.x,c.y) ? nearFree(c.x,c.y,2) : {x:c.x,y:c.y};
    if(!spot) return true;
    var z=_spawnCrypt(c.kind, spot.x, spot.y); z.risen=true; z.hp=Math.max(1,Math.round(c.maxhp/2)); z.state='hunt';
    if(vis[idxOf(spot.x,spot.y)]) log('The <b>Shambler</b> drags itself back up!','c-you');
    return false;
  });
};
/* stepping on a corpse (or hitting its tile) finishes it */
var _tryMoveCorpse = tryMove;
tryMove = function(dx, dy){
  var nx=player.x+dx, ny=player.y+dy, cs=floorMeta && floorMeta.corpses;
  if(cs && cs.length){
    var hit=cs.filter(function(c){ return c.x===nx && c.y===ny; })[0];
    if(hit && !occupied(nx,ny)){
      floorMeta.corpses=cs.filter(function(c){ return c!==hit; });
      setClip(player,'melee'); lungeFx(player,nx,ny); sfx('skeleton-death');
      log('You smash the corpse. It stays down.','c-good'); endTurn(); return;
    }
  }
  return _tryMoveCorpse(dx, dy);
};

/* the Shade is invisible past 2 tiles in the dark (and inside walls) */
var _drawShade = draw;
draw = function(){
  var hidden=[];
  if(ents && vis && player){
    ents.forEach(function(e){
      if(!e.base || !e.base.phases || revealAll) return;
      var i=idxOf(e.x,e.y), rm=roomAt(e.x,e.y);
      if(vis[i] && dist(e,player)>2 && (at(e.x,e.y)===WALL || (rm && rm.dark))){ hidden.push(i); vis[i]=0; }
    });
  }
  try{ return _drawShade.apply(this, arguments); } finally { hidden.forEach(function(i){ vis[i]=1; }); }
};

/* ---------------------------------------------------------------- Morty's hall */
function buildMortyHall(r){
  r.role='boss';
  if(r.hall) return;   /* the composed hall (js/cryptset.js) already placed Morty, his phylactery and the gate */
  floorMeta.bossAt={x:r.cx, y:r.y+2};
  floorMeta.phylAt={x:r.cx, y:r.y};
  /* pillars to hide behind from the Bone Nova */
  [[-3,-1],[3,-1],[-3,2],[3,2]].forEach(function(o){ var x=r.cx+o[0], y=r.cy+o[1]; if(x>r.x && x<r.x+r.w-1 && y>r.y && y<r.y+r.h-1) addProp(x, y, 'grave-pillar', {keep:true}); });
  decorateEdges(r, ['soul-brazier','sarcophagus','soul-brazier','candelabra'], 6);
  var gx=r.cx, gy=r.y+r.h-1;
  setT(gx,gy,EXIT); floorMeta.exitAt={x:gx,y:gy};
  for(var i=0;i<6;i++){ var c=pick(interiorCells(r)); if(c) setG(c.x,c.y,pick([G_BONES,G_BONES,G_MOSS])); }
}
var _populateCrypt = populateSpecialMonsters;
populateSpecialMonsters = function(){
  if(!inCrypt() || !floorMeta.boss) return _populateCrypt();
  var bossRoom=rooms.filter(function(r){ return r.role==='boss'; })[0];
  rooms.forEach(function(r){ if(r.role==='boss') r.role='boss-crypt'; });
  _populateCrypt();
  if(bossRoom){
    bossRoom.role='boss';
    var m=_spawnCrypt('morty', floorMeta.bossAt.x, floorMeta.bossAt.y); m.state='throne'; m.elite=true; floorMeta.bossId=m.id;
    var pa=floorMeta.phylAt; if(occupied(pa.x,pa.y) || !walkable(pa.x,pa.y)) pa=nearFree(pa.x,pa.y,2);
    if(pa){ var ph=_spawnCrypt('phylactery', pa.x, pa.y); ph.state='still'; floorMeta.phylId=ph.id; }
    var cells=shuffled(interiorCells(bossRoom)).filter(function(p){ return walkable(p.x,p.y) && !occupied(p.x,p.y); });
    for(var q=0;q<2 && cells.length;q++){ var c=cells.pop(); var s=_spawnCrypt('skeleton', c.x, c.y); s.state='asleep'; s.guard=true; }
  }
};

/* ---------------------------------------------------------------- Morty the Mostly-Dead */
function mortyHall(){ return rooms.filter(function(r){ return r.role==='boss'; })[0]; }
function mortyAct(e){
  if(e.st.stun || e.st.frozen){ e.t+=actCost(e); return; }
  if(!tickStatus(e)){ return; }
  var see=canSeePlayer(e), d=dist(e,player), hall=mortyHall(), rm=roomAt(player.x,player.y);
  if(e.state==='throne'){
    if(see && d<=8 && rm && rm===hall){
      e.state='hunt'; e.turnN=0; log('<b>Morty the Mostly-Dead</b> adjusts his crown. "Ah! A visitor! Do stay. Forever, ideally."','c-you'); sfx('morty-intro'); playMusic('boss');
      ents.forEach(function(o){ if(o.guard) o.state='hunt'; });
    }
    e.t+=actCost(e); return;
  }
  e.turnN=(e.turnN||0)+1;
  /* a channelled Bone Nova resolves or keeps building */
  if(e.channel){
    if(e.channelHp - e.hp >= 20){ e.channel=0; floorMeta.marks=[]; log('You break Morty\'s concentration! The Bone Nova fizzles.','c-good'); e.t+=actCost(e); return; }
    if(--e.channel>0){ log('Morty\'s bones glow brighter...','c-you'); e.t+=actCost(e); return; }
    floorMeta.marks=[];
    ringFx(e.x,e.y,'#8CFF6A',8); SHAKE=10; sfx('shaman-cast');
    var targets=ents.filter(function(o){ return o!==e && !o.foe && vis[idxOf(o.x,o.y)]; }).concat(see ? [player] : []);
    targets.forEach(function(t){ var raw=roll(10,16)+Math.floor(floorNo/2);
      if(t===player) raw=Math.min(raw, Math.round(player.maxhp*0.35));   /* never a one-shot */
      var nd=applyDamage(t, raw, 'dark', e); floatText(t.x,t.y,String(nd),'dark'); if(t===player){ log('The <b>Bone Nova</b> tears through you: '+nd+'!','c-you'); if(player.hp<=0) kill(player,e); } else if(t.hp<=0) kill(t,e); });
    if(!see) log('The Bone Nova breaks harmlessly against the pillar.','c-good');
    e.t+=actCost(e); return;
  }
  /* Grave Grasp erupts */
  if(e.grasp && turn>=e.grasp.at){
    var cells=e.grasp.cells; e.grasp=null; floorMeta.marks=(floorMeta.marks||[]).filter(function(m){ return m.kind!=='grasp'; });
    cells.filter(function(v,k,a){ return a.indexOf(v)===k; }).forEach(function(i){ var x=i%MW, y=(i/MW)|0; burst(x,y,'dark',10,0.05); ents.forEach(function(t){ if(t.x===x && t.y===y && t!==e && !(t.foe)){ var gd=applyDamage(t, roll(8,12), 'dark', e); floatText(t.x,t.y,String(gd),'dark'); applyStatus(t,'root',1); if(t===player){ log('Grave hands burst from the floor and grab you: '+gd+'!','c-you'); if(player.hp<=0) kill(player,e); } } }); });
  }
  /* blink away from melee, or every few turns */
  e.blinkCd=(e.blinkCd||0)-1;
  if((d<=1 && e.blinkCd<=0) || e.turnN%6===0){
    var spots=hall ? interiorCells(hall).filter(function(p){ return walkable(p.x,p.y) && !occupied(p.x,p.y) && dist(p,player)>=4; }) : [];
    if(spots.length){ var s=pick(spots); sparkleFx(e.x,e.y,'dark',30); e.x=s.x; e.y=s.y; e._lx=undefined; sparkleFx(e.x,e.y,'dark',30); e.blinkCd=4; if(vis[idxOf(e.x,e.y)]||true) log('Morty vanishes in a puff of grave dust and reappears across the hall.','c-info'); e.t+=actCost(e); return; }
  }
  if(!see){ chaseStep(e); e.t+=actCost(e); return; }
  /* Bone Nova every 9 turns */
  if(e.turnN%9===0){
    e.channel=2; e.channelHp=e.hp;
    var ring=[]; for(var y=e.y-6;y<=e.y+6;y++) for(var x=e.x-6;x<=e.x+6;x++) if(inb(x,y) && walkable(x,y) && vis[idxOf(x,y)] && Math.abs(x-e.x)+Math.abs(y-e.y)>=5 && Math.abs(x-e.x)+Math.abs(y-e.y)<=6) ring.push(idxOf(x,y));
    floorMeta.marks=[{cells:ring, col:'#8CFF6A', until:turn+3, kind:'nova'}];
    setClip(e,'attack'); log('<b>Morty</b> raises his staff and begins a <b>Bone Nova</b>! Get out of his sight, or hit him hard.','c-you'); sfx('shaman-cast');
    e.t+=actCost(e); return;
  }
  /* Grave Grasp every 4 turns */
  if(e.turnN%4===1 && !e.grasp){
    var gc=[idxOf(player.x,player.y)];
    for(var k=0;k<5;k++){ var gx=player.x+ri(-2,2), gy=player.y+ri(-2,2); if(inb(gx,gy) && walkable(gx,gy)) gc.push(idxOf(gx,gy)); }
    e.grasp={cells:gc, at:turn+2};
    floorMeta.marks=(floorMeta.marks||[]).concat([{cells:gc, col:'#B070FF', until:turn+2, kind:'grasp'}]);
    setClip(e,'attack'); log('<b>Morty</b> points at the floor around you. "Hands, please!" Step off the marked stones.','c-you');
    e.t+=actCost(e); return;
  }
  /* soul bolts at range, otherwise keep his distance. 2026-09-22 (Justin): the boss may cast over his skeletons - the
     clear-lane rule for shooters stops at the Necro-Acolyte */
  if(d>=2 && d<=7){
    setClip(e,'attack'); boltFx(e.x,e.y,player.x,player.y,'dark'); sfx('shaman-cast');
    if(rng()<hostileHitChance(hitChance(e.base.acc, player.eva),true)){ var sd=applyDamage(player, roll(6,10)+Math.floor(floorNo/2), 'dark', e); floatText(player.x,player.y,String(sd),'dark'); log('Morty\'s soul bolt hits you: '+sd+'.','c-you'); if(player.hp<=0) kill(player,e); }
    else log('Morty\'s soul bolt misses.','c-miss');
    e.t+=actCost(e); return;
  }
  if(d<=1){ attack(e,player); e.t+=actCost(e); return; }
  chaseStep(e); e.t+=actCost(e);
}
function mortyDies(e, by){
  var ph=ents.filter(function(o){ return o.id===floorMeta.phylId && o.hp>0; })[0];
  if(ph){
    ents=ents.filter(function(x){ return x!==e; });
    floorMeta.mortyReturn={at:turn+3, maxhp:e.maxhp};
    sparkleFx(e.x,e.y,'dark',60);
    log('Morty crumbles to dust... and the phylactery on the altar pulses. <b>"Oh, I\'ll be right back."</b> Break the phylactery!','c-you');
    return;
  }
  return _killCrypt(e, by);
}
function phylacteryBreaks(ph){
  sparkleFx(ph.x,ph.y,'light',60); SHAKE=8; sfx('puzzle-solved');
  log('<b>The phylactery shatters!</b> Morty can\'t come back now.','c-kill');
  var m=ents.filter(function(o){ return o.kind==='morty'; })[0];
  var spots=(floorMeta.deathSpots||[]).slice(-4);
  if(m || floorMeta.mortyReturn){
    log('"NO! Everyone up! EVERYONE!"','c-you');
    spots.forEach(function(s){ var c=occupied(s.x,s.y) ? nearFree(s.x,s.y,2) : s; if(c){ var z=_spawnCrypt('shambler', c.x, c.y); z.state='hunt'; z.risen=true; z.noXp=true; } });
  }
}
var _endTurnMorty = endTurn;
endTurn = function(){
  _endTurnMorty();
  var R=floorMeta && floorMeta.mortyReturn; if(!R || turn<R.at) return;
  floorMeta.mortyReturn=null;
  var pa=floorMeta.phylAt, c=pa ? (occupied(pa.x,pa.y+1) ? nearFree(pa.x,pa.y+1,3) : {x:pa.x,y:pa.y+1}) : null;
  if(!c) return;
  var m=_spawnCrypt('morty', c.x, c.y); m.state='hunt'; m.elite=true; m.hp=Math.round(R.maxhp*0.6); m.maxhp=R.maxhp; m.turnN=1; floorMeta.bossId=m.id;
  for(var i=0;i<2;i++){ var s=nearFree(c.x,c.y,2); if(s){ var sk=_spawnCrypt('skeleton', s.x, s.y); sk.state='hunt'; sk.noXp=true; } }
  sparkleFx(c.x,c.y,'dark',60); log('<b>Morty re-forms from the phylactery!</b> "Where were we?" Two Skeletons climb out beside him.','c-you');
};

/* ---------------------------------------------------------------- the corpse stays visible (2026-09-18)
   A shambler that "collapses and twitches" was only a log line: the death animation played, faded out, and
   the tile looked empty - so there was nothing to see, walk onto or hit. The body now lies there (the last
   frame of its death clip, or its sprite on its side) until it is finished, burned or gets back up, and it
   twitches on the turn before it rises. */
function drawLyingCorpse(c, now){
  var i=idxOf(c.x,c.y); if(!(revealAll || seen[i])) return;
  var b=MONSTERS[c.kind] || {}, ms = spriteOn && b.sprite ? mobSheet(b.sprite) : null; if(!ms) return;
  var px=(c.x-camX)*TS, py=(c.y-camY)*TS, lit=(revealAll||vis[i]) ? 1 : memA(0.45);
  var m=ms.m, cell=m.cell, box=m.box||[0,0,cell,cell], s=TS*(b.art||0.9)/Math.max(box[3], box[2]*0.8);
  var twitch = turn>=c.at-1 && !ANIM.reduce ? Math.sin(now/55)*TS*0.02 : 0;
  ctx.save(); ctx.globalAlpha=0.92*lit; ctx.imageSmoothingEnabled=true;
  if(m.clips.death){
    var d=m.clips.death;
    ctx.drawImage(ms.img, (d.frames-1)*cell, d.row*cell, cell, cell, px+TS/2-(box[0]+box[2]/2)*s+twitch, py+TS*0.97-(box[1]+box[3])*s, cell*s, cell*s);
  } else {
    var srow=m.static_row!==undefined ? m.static_row : (m.clips.idle ? m.clips.idle.row : 0), fx0=px+TS/2, fy0=py+TS*0.95;
    ctx.translate(fx0+twitch, fy0); ctx.rotate(Math.PI*0.5); ctx.translate(-fx0, -fy0);
    ctx.drawImage(ms.img, 0, srow*cell, cell, cell, px+TS/2-(box[0]+box[2]/2)*s, py+TS*0.97-(box[1]+box[3])*s, cell*s, cell*s);
  }
  ctx.restore();
}
var _drawTelegraphsCorpse = drawTelegraphs;
drawTelegraphs = function(now){
  _drawTelegraphsCorpse(now);
  if(floorMeta && floorMeta.corpses && floorMeta.corpses.length){ var t=performance.now(); floorMeta.corpses.forEach(function(c){ drawLyingCorpse(c, t); }); }
};
