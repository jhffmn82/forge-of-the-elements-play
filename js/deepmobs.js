/* =====================================================================
   deepmobs.js - biome 4, the Underdark (floors 16-20): creatures, Bleed, and the Matron of the Web. 2026-09-19.
   See DESIGN.md section 18. Creatures (Justin's GPT art, packet 07, art/map/biome4/monsters2), animated by
   tools/deepart.py: Drow Blade, Drow Priestess, Drider (elite), Web Spitter, Spiderling, Thought Eater,
   Fire Imp, Ember Spider. The boss is the Matron of the Web (256px art, not animated: moved in code here).

   Contract with the world side (regions, terrain, lava, rooms, the boss hall are built elsewhere):
     floorMeta.deepRegion  Uint8Array(MW*MH): 0 drow temple, 1 spider Underdark, 2 volcanic   (optional)
     room.region           the same per room                                                  (optional)
     floorMeta.bossArena = {x, y, w, h, throne:{x,y}, circles:[{x,y}, ...]}   floor 20; each circle is a 2x2
                           set piece named 'ritual-circle' (top-left x,y). Here its p.name is swapped to
                           'ritual-circle-active' while a ritual channels on it, and back after.
     cocoon props with p.hatch=true (cocoon-large-1/2, cocoons-small-N): burst into Spiderlings here.
     LAVA                  a tile constant; creatures never step onto it (guarded by typeof).
     spawnMatron(arena)    defined here; safe to call more than once (only the first call spawns her).
   Without any of it (the world branch not merged) everything falls back: a mixed roster everywhere, and the
   Matron in the boss room (or the largest room) with no circles, channelling where she stands.
   ALL NUMBERS ARE PLACEHOLDERS for Justin's balance pass. The floor curve in spawn() (+5% HP, +3% damage a
   floor) is on top of the base stats, so at floor 16 a Drow Blade is 30*1.75 = 52 HP and hits 9-13.
   ===================================================================== */

function deepMobsOn(){ return typeof bidx==='function' && bidx()===3 && !(floorMeta && floorMeta.plane); }

/* ---------------------------------------------------------------- the bestiary (placeholders) */
(function(){
  var M=MONSTERS;
  /* region: 0 temple, 1 Underdark, 2 volcanic. deepAI names the special turn (DEEP_AI below). bleeds: chance a
     landed hit opens a Bleed. darksight: sees through a globe of darkness. */
  M.drowblade    = {name:'Drow Blade', sprite:'m-drow-blade', col:'#6A3A5A', ch:'d', hp:90, dmg:[10,14], acc:70, eva:24, armor:3, speed:100, range:1, xp:48,
                    band:[16,20], w:24, region:0, deepAI:'blade', bleeds:0.50, darksight:true, living:true, art:0.95, artLeft:true, sfx:'drow'};
  M.drowpriestess= {name:'Drow Priestess', sprite:'m-drow-priestess', col:'#9A2A4A', ch:'p', hp:70, dmg:[12,17], acc:68, eva:18, armor:1, speed:100, range:1, xp:56,
                    band:[16,20], w:12, region:0, deepAI:'priestess', darksight:true, living:true, spellcaster:true, art:0.95, artLeft:true, sfx:'shaman'};
  M.thoughteater = {name:'Thought Eater', sprite:'m-thought-eater', col:'#C89AD0', ch:'t', hp:55, dmg:[8,11], acc:72, eva:28, armor:0, speed:100, range:1, xp:50,
                    band:[17,20], w:10, region:0, deepAI:'eater', el:'shadow', flying:true, hover:true, living:true, spellcaster:true, art:0.8, artLeft:true, sfx:'imp'};
  M.webspitter   = {name:'Web Spitter', sprite:'m-web-spitter', col:'#4A3A5A', ch:'w', hp:70, dmg:[8,11], acc:68, eva:20, armor:2, speed:100, range:1, xp:40,
                    band:[16,20], w:18, region:1, deepAI:'spitter', bleeds:0.35, living:true, spider:true, art:0.85, artLeft:true, sfx:'spider'};
  M.spiderling   = {name:'Spiderling', sprite:'m-spiderling', col:'#5A3A4A', ch:'s', hp:15, dmg:[3,4], acc:64, eva:26, armor:0, speed:100, range:1, xp:8,
                    band:[16,20], w:16, pack:[3,5], region:1, bleeds:0.30, living:true, spider:true, art:0.5, artLeft:true, sfx:'spider'};
  M.drider       = {name:'Drider', sprite:'m-drider', col:'#3A2A3A', ch:'D', hp:180, dmg:[13,18], acc:70, eva:14, armor:4, speed:100, range:6, xp:120,
                    band:[17,20], w:6, region:1, deepAI:'drider', elite:true, heavy:true, el:'earth', fangs:0.35, darksight:true, living:true, spider:true, art:1.4, artLeft:true, sfx:'brute'};
  M.fireimp      = {name:'Fire Imp', sprite:'m-fire-imp', col:'#E2522B', ch:'i', hp:60, dmg:[12,17], acc:70, eva:30, armor:0, speed:100, range:1, xp:42,
                    band:[16,20], w:18, region:2, deepAI:'imp', el:'fire', flying:true, hover:true, living:true, spellcaster:true, art:0.75, artLeft:true, sfx:'imp'};
  M.emberspider  = {name:'Ember Spider', sprite:'m-ember-spider', col:'#B8482A', ch:'e', hp:90, dmg:[10,13], acc:68, eva:18, armor:3, speed:100, range:1, xp:46,
                    band:[16,20], w:20, region:2, el:'fire', emberBite:0.30, living:true, spider:true, art:0.9, artLeft:true, sfx:'spider'};
  /* the Matron of the Web: tuned by hand for floor 20, so no floor curve (fixed, like the other bosses) */
  M.matron       = {name:'The Matron of the Web', sprite:'m-matron', col:'#8A1A3A', ch:'M', hp:380, dmg:[15,21], acc:74, eva:12, armor:5, speed:100, range:1, xp:900,
                    band:[20,20], w:0, boss:true, elite:true, fixed:true, heavy:true, bleeds:0.5, darksight:true, living:true, spellcaster:true, art:2.1, artLeft:true, sfx:'matron'};
  DROPS.drowblade     = {chance:0.25, table:{essence:10, gear:5, sigil:1}};
  DROPS.drowpriestess = {chance:0.35, table:{essence:8, sigil:3, gear:3, food:1}};
  DROPS.thoughteater  = {chance:0.30, table:{essence:12, sigil:3}};
  DROPS.webspitter    = {chance:0.20, table:{essence:12, food:2}};
  DROPS.spiderling    = {chance:0.04, table:{essence:1}};
  DROPS.drider        = {chance:0.60, table:{essence:6, gear:8, sigil:2}};
  DROPS.fireimp       = {chance:0.25, table:{essence:12, sigil:2}};
  DROPS.emberspider   = {chance:0.22, table:{essence:12, gear:2, food:2}};
  DROPS.matron        = {chance:0, table:{essence:1}};
  /* particles and float colours for blood and silk */
  if(typeof TRAIL!=='undefined'){
    TRAIL.blood = TRAIL.blood || {col:['#E0404A','#9A1A2A','#5A0A18'], size:2.6, rate:1.6, life:520, drift:0.02};
    TRAIL.web   = TRAIL.web   || {col:['#F2F0E8','#C8C4BC','#8A8680'], size:2.0, rate:1.4, life:480, drift:0.01};
  }
  if(typeof DMG_COL!=='undefined' && !DMG_COL.blood) DMG_COL.blood='#E0404A';
})();
var DEEP_KINDS = ['drowblade','drowpriestess','thoughteater','webspitter','spiderling','drider','fireimp','emberspider'];
/* hover-card lines: what each one does, in a sentence */
var DEEP_HINT = {
  drowblade:'A duelist. Its cuts bleed, and it throws globes of darkness it can see through.',
  drowpriestess:'Heals and wards the drow, calls spiderlings, and drinks from the blood bolts she throws. Kill her first.',
  thoughteater:'Saps your mana to heal itself, and half of what it takes tears you as magic damage. With no mana left, it dazes you instead. Fragile.',
  webspitter:'A landed web shot always pins you for a turn, then slows you for three. Its bite can bleed.',
  spiderling:'Weak alone, never alone.',
  drider:'Shoots from range, poisons with its fangs up close, and webs you in place.',
  fireimp:'Hurls a fire bolt every turn from up to 6 tiles; a hit always sets you burning and lights webs and grass. Backs away from melee.',
  emberspider:'Its bite burns.',
  matron:'Channels rituals on the circles: hit her hard, or stun her, to break them. Calls driders and spiderlings.'
};

/* ---------------------------------------------------------------- tunables (placeholders, all of them) */
var BLEED   = {turns:4, base:3, per:0.25};                 /* 2026-09-23 (Justin): 3 + 0.25 per floor (7 at floor 16), 4 turns; it ignores armour */
var GLOBE   = {r:1, turns:5, cd:[10,14], first:[1,3]};     /* 3x3 of darkness on you for 5 turns */
var PRIEST  = {healPct:0.30, healFlat:10, healCd:4, ward:8, wardTurns:8, wardCd:7, callCd:9, callN:[1,2], capEach:2, capFloor:8, range:6};
var WEBSHOT = {cd:4, range:5, pin:1, slow:3};
var DRIDER  = {webCd:6, poison:[4,3]};                     /* fangs: poison 4 turns, 3 a turn */
var SAP     = {cd:3, range:6, base:6, per:0.5, heal:2};    /* drains 6 + half the floor in MP (14 at 16); heals 2 HP per MP */
var IMP     = {cd:1, range:6, burn:1.0};    /* 2026-09-23 (Justin): a bolt every turn, and a hit always burns */
var MATRON  = {phase:[0.66, 0.33], ritTurns:3, ritBreak:0.08, ritEvery:[8,6,5], tithe:[18,26], titheCap:0.30, titheHeal:2,
               venom:[12,18], venomCap:0.30, venomCd:5, webCd:5, broodDriders:2, broodSpiderlings:[2,3]};

/* ---------------------------------------------------------------- helpers */
function deepVis(x,y){ return !!(revealAll || (vis && vis[idxOf(x,y)])); }
function deepShot(e){ var path=boltPath(e.x,e.y,player.x,player.y), end=path[path.length-1]; return !!(end && end.x===player.x && end.y===player.y); }

/* the floor's region at a tile, or -1 when the world has not told us */
function deepRegionAt(x,y){
  var R=floorMeta && floorMeta.deepRegion;
  if(R && R.length===MW*MH && inb(x,y)) return R[idxOf(x,y)];
  var r=roomAt(x,y); if(r && r.region!==undefined && r.region!==null) return r.region;
  return -1;
}
function deepHasRegions(){ return !!((floorMeta && floorMeta.deepRegion) || rooms.some(function(r){ return r.region!==undefined && r.region!==null; })); }
var DEEP_CAP = {drider:2};                                 /* elites a floor (placeholder) */
function deepPool(region){
  var out=[];
  DEEP_KINDS.forEach(function(k){
    var b=MONSTERS[k]; if(!b || !b.w || floorNo<b.band[0] || floorNo>b.band[1]) return; if(region>=0 && b.region!==region) return;
    if(DEEP_CAP[k] && ents.filter(function(o){ return o.kind===k; }).length>=DEEP_CAP[k]) return;
    out.push([k, b.w]);
  });
  return out;
}
/* the same step fleeStep() takes, without taking it */
function deepCanFlee(e){
  var nb=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]], bd=dist(e,player);
  for(var i=0;i<nb.length;i++){ var nx=e.x+nb[i][0], ny=e.y+nb[i][1]; if(!walkable(nx,ny)||occupied(nx,ny)||deepLava(nx,ny)) continue; if(dist({x:nx,y:ny},player)>bd) return true; }
  return false;
}
function deepLava(x,y){ return typeof LAVA!=='undefined' && inb(x,y) && at(x,y)===LAVA; }
function deepHurt(t, n, type, src, why){
  if(!t || t.hp<=0) return 0;
  var d=applyDamage(t, n, type, src);
  floatText(t.x, t.y, String(d), type==='dark' ? 'dark' : type);
  if(t===player){ if(why) log(why+': <b>'+d+'</b>.','c-you'); if(player.hp<=0) kill(player, src); }
  else if(t.hp<=0) kill(t, src);
  return d;
}

/* ---------------------------------------------------------------- spawning: the roster by region
   rollMonster() has no idea where the monster will stand, so floors 16-20 roll from the whole Underdark roster
   and, once the floor is built, every creature standing in the wrong region is swapped for one that lives there
   (a pack for a pack kind, one creature otherwise; key holders and guards are left alone). Later single spawns
   (wanderers) are swapped on the spot. Summons skip all of it (deepSpawnRaw). */
var DEEP_SWAP = {goblin:'drowblade', archer:'webspitter', brute:'drider', shaman:'drowpriestess', rat:'spiderling', bat:'spiderling'};
var DEEP_GEN=false;


function deepRegionalize(){
  if(!deepHasRegions()) return 0;
  var done=[], swapped=0;
  var list=ents.filter(function(e){ return e.foe && e.base && e.base.region!==undefined && !e.keyholder && !e.guard && !e.base.boss && !e.owner; });
  list.forEach(function(e){
    if(done.indexOf(e)>=0 || ents.indexOf(e)<0) return;
    var R=deepRegionAt(e.x,e.y);
    if(R<0 || e.base.region===R){ done.push(e); return; }
    var group=[e].concat(e.base.pack ? list.filter(function(o){ return o!==e && done.indexOf(o)<0 && o.kind===e.kind && ents.indexOf(o)>=0 && dist(o,e)<=2; }) : []);
    group.forEach(function(o){ done.push(o); });
    var pool=deepPool(R); if(!pool.length) return;
    var k=weightedMonster(pool), b=MONSTERS[k], n=b.pack ? Math.min(b.pack[1], Math.max(group.length, b.pack[0])) : 1, st=e.state, x=e.x, y=e.y;
    ents=ents.filter(function(o){ return group.indexOf(o)<0; });
    for(var q=0;q<n;q++){ var s=q===0 ? {x:x,y:y} : nearFree(x,y,2); if(!s || deepLava(s.x,s.y)) break; var m=deepSpawnRaw(k, s.x, s.y); m.state=st; done.push(m); }
    swapped++;
  });
  return swapped;
}


/* no creature walks into lava (the world adds the tile; walkable() may already refuse it) */


/* ---------------------------------------------------------------- Bleed
   Damage every turn for a few turns (ignores armour), dealt by drow blades, spiders and the Matron. Any heal
   stops it: healPlayer() is the one path for heals (potions, Heal, afterglow, lifesteal...), and a heart
   picked up off the floor counts too. Natural regeneration, well under 1 HP a turn and nothing at all while a
   hunter can see you, does not. */
function inflictBleed(t, src, turns){
  if(!t || t.hp<=0 || (t!==player && !(t.base && t.base.living))) return;
  var fresh=!(t.st && t.st.bleed);
  applyStatus(t, 'bleed', turns||BLEED.turns, sDMG(BLEED.base + floorNo*BLEED.per));
  if(fresh){ floatText(t.x, t.y, 'bleeding', 'blood'); if(t===player) log('You are <b>bleeding</b>. Any healing will close the wound.','c-you'); }
}
function deepStanch(t){ if(t && t.st && t.st.bleed){ delete t.st.bleed; if(t===player) log('The bleeding stops.','c-good'); else if(deepVis(t.x,t.y)) log('The '+t.name+' stops bleeding.','c-info'); } }

/* 2026-09-20: this used to tell natural regeneration from a real heal by size (n>=1), which works only
   while max HP stays small - regen is maxhp*0.002 a turn, so anything over 500 max HP would have started
   stanching its own wounds. healPlayer's second argument now says so outright. */


if(typeof STATUS_INFO!=='undefined'){
  /* no bleed icon was drawn yet: the bleeding-heart icon stands in (flagged for Justin) */
  STATUS_INFO.bleed = {name:'Bleeding', icon:'pr-corpsefeast', bad:1, d:'Loses HP every turn. Any healing stops it.'};
  STATUS_INFO.wardshield = {name:'Blood Ward', icon:'ic-arcane-ward', d:'A priestess\'s ward absorbs damage.'};
}

/* ---------------------------------------------------------------- hits: bleed, fangs, ember bite */


/* a priestess's Blood Ward soaks damage before it lands */


/* ---------------------------------------------------------------- globes of darkness
   floorMeta.dark = [{cells:[tile indexes], until:turn}]. Like the Sigil of Smoke: standing inside, you see one
   tile; outside, you cannot see into it. Drow (darksight) see through it, so a blade fights on in the dark
   while archers and casters that need your eyes on them lose you. */
var DEEP_RAWVIS=null;
function deepDarkActive(){ return ((floorMeta && floorMeta.dark) || []).filter(function(g){ return turn<g.until; }); }
function throwDarkness(e){
  var cells=[];
  for(var dy=-GLOBE.r;dy<=GLOBE.r;dy++) for(var dx=-GLOBE.r;dx<=GLOBE.r;dx++){ var x=player.x+dx, y=player.y+dy; if(inb(x,y) && at(x,y)!==WALL) cells.push(idxOf(x,y)); }
  floorMeta.dark=deepDarkActive().concat([{cells:cells, until:turn+GLOBE.turns}]);
  setClip(e,'attack'); boltFx(e.x,e.y,player.x,player.y,'dark'); sfx('shaman-cast');
  burst(player.x, player.y, 'dark', 40, 0.08);
  log('The <b>Drow Blade</b> flings a <b>globe of darkness</b> over you. You can barely see past your own hands - but the drow can.','c-you');
  computeFOV();
}
function inDeepDark(x,y){ var i=idxOf(x,y); return deepDarkActive().some(function(g){ return g.cells.indexOf(i)>=0; }); }


function drawDarknessTelegraphs(now){

  var G=deepDarkActive(); if(!G.length) return;
  var t=(now||0)/1000;
  ctx.save();
  G.forEach(function(g){
    var fade=Math.min(1, (g.until-turn)/1.5);
    g.cells.forEach(function(i){
      if(!(revealAll||seen[i])) return;
      var x=i%MW, y=(i/MW)|0, cx=(x-camX+0.5)*TS, cy=(y-camY+0.5)*TS;
      if(cx<-TS || cy<-TS || cx>cv.width+TS || cy>cv.height+TS) return;
      var wob=ANIM.reduce ? 0 : Math.sin(t*1.1+x*0.9+y*1.7)*0.05;
      var gr=ctx.createRadialGradient(cx,cy,TS*0.1,cx,cy,TS*0.85);
      gr.addColorStop(0,'rgba(6,2,10,'+((0.82+wob)*fade).toFixed(3)+')'); gr.addColorStop(0.6,'rgba(14,4,22,'+((0.7+wob)*fade).toFixed(3)+')'); gr.addColorStop(1,'rgba(20,6,30,0)');
      ctx.fillStyle=gr; ctx.fillRect(cx-TS*0.85, cy-TS*0.85, TS*1.7, TS*1.7);
    });
  });
  ctx.restore();

}

/* ---------------------------------------------------------------- webs: pinned for a turn (you can still attack) */
function webShot(e, who){
  setClip(e,'attack'); boltFx(e.x,e.y,player.x,player.y,'web'); sfx('trap-web');
  if(rng() < hostileHitChance(hitChance(e.base.acc+8, player.eva),true)){
    applyStatus(player, 'root', WEBSHOT.pin);
    player.syllaWeb=WEBSHOT.slow;   /* tickStatus applies the slow as soon as the one-turn pin ends */
    if(gAt(player.x,player.y)!==G_WEB) setG(player.x, player.y, G_WEB);
    burst(player.x, player.y, 'web', 22, 0.05); floatText(player.x, player.y, 'webbed', 'phys');
    log('The <b>'+(who||e.name)+'</b> spits sticky webbing over you: <b>pinned</b> for a turn, then slowed for three.','c-you');
  } else {
    var c=nearFree(player.x, player.y, 1); if(c) setG(c.x, c.y, G_WEB);
    log('The '+(who||e.name)+'\'s web splatters beside you.','c-miss');
  }
}

/* ---------------------------------------------------------------- monster turns */
var DEEP_AI = {
  /* Drow Blade: a duelist; every so often it blinds you with a globe of darkness, then keeps cutting */
  blade: function(e, d){
    e.globeCd=(e.globeCd===undefined ? ri(GLOBE.first[0],GLOBE.first[1]) : e.globeCd)-1;
    if(e.globeCd<=0 && d>=2 && d<=5 && !inDeepDark(player.x,player.y) && deepShot(e)){
      if(e.hp<=0)return true;e.globeCd=ri(GLOBE.cd[0],GLOBE.cd[1]); throwDarkness(e);  return true;
    }
    return false;
  },
  /* Drow Priestess: heal a hurt drow, call spiderlings, ward the one closest to you, then blood bolts from range
     (she drinks what she spills). She keeps her distance. */
  priestess: function(e, d){
    e.healCd=(e.healCd||0)-1; e.wardCd=(e.wardCd===undefined ? 2 : e.wardCd)-1; e.callCd=(e.callCd===undefined ? 1 : e.callCd)-1;
    var near=function(o){ return o!==player && o.foe && o.hp>0 && !o.parent && dist(o,e)<=PRIEST.range; };
    var hurt=ents.filter(function(o){ return near(o) && o.hp<o.maxhp*0.65 && o.base && !o.base.object; }).sort(function(a,z){ return a.hp/a.maxhp - z.hp/z.maxhp; })[0];
    if(hurt && e.healCd<=0){
      if(e.hp<=0)return true;e.healCd=PRIEST.healCd; setClip(e,'attack'); sfx('shaman-cast');
      var h=Math.min(Math.round(hurt.maxhp*PRIEST.healPct), sHP(PRIEST.healFlat+floorNo));
      hurt.hp=Math.min(hurt.maxhp, hurt.hp+h); floatText(hurt.x, hurt.y, '+'+h, 'heal'); sparkleFx(hurt.x, hurt.y, 'blood', 20); deepStanch(hurt);
      if(deepVis(e.x,e.y)) log('The <b>Drow Priestess</b> '+(hurt===e ? 'mends her own wounds' : 'mends the '+hurt.name)+' with blood magic (+'+h+').','c-info');
       return true;
    }
    if(e.callCd<=0){
      var mine=ents.filter(function(o){ return o.kind==='spiderling' && o.owner===e.id; }).length;
      var all=ents.filter(function(o){ return o.kind==='spiderling'; }).length;
      if(mine<PRIEST.capEach && all<PRIEST.capFloor){
        if(e.hp<=0)return true;e.callCd=PRIEST.callCd; setClip(e,'attack'); sfx('shaman-cast');
        var n=Math.min(ri(PRIEST.callN[0],PRIEST.callN[1]), PRIEST.capEach-mine), got=0;
        for(var k=0;k<n;k++){ var c=nearFree(e.x,e.y,1) || nearFree(e.x,e.y,2); if(!c || deepLava(c.x,c.y)) break; var s=deepSpawnRaw('spiderling', c.x, c.y); s.state='hunt'; s.noXp=true; s.owner=e.id; s.t=e.t; sparkleFx(c.x,c.y,'web',14); got++; }
        if(got && deepVis(e.x,e.y)) log('The <b>Drow Priestess</b> hisses a prayer and '+(got>1 ? got+' <b>Spiderlings</b> scuttle' : 'a <b>Spiderling</b> scuttles')+' out of the dark to her.','c-info');
         return true;
      }
    }
    if(e.wardCd<=0){
      var front=ents.filter(function(o){ return near(o) && o!==e && o.base && !o.base.object && !o.st.wardshield && o.state==='hunt'; }).sort(function(a,z){ return dist(a,player)-dist(z,player); })[0];
      if(front){
        if(e.hp<=0)return true;e.wardCd=PRIEST.wardCd; setClip(e,'attack'); sfx('shaman-cast');
        front.st.wardshield={t:PRIEST.wardTurns, n:sDMG(PRIEST.ward+floorNo*0.5)};
        ringFx(front.x, front.y, '#C0203A', 1); sparkleFx(front.x, front.y, 'blood', 16);
        if(deepVis(e.x,e.y)) log('The <b>Drow Priestess</b> wraps the '+front.name+' in a <b>blood ward</b>.','c-info');
         return true;
      }
    }
    if(d<=2 && canActorMove(e) && deepCanFlee(e)){ if(e.hp<=0)return true;fleeStep(e);  return true; }
    if(d>=2 && d<=PRIEST.range && deepShot(e)){
      if(e.hp<=0)return true;setClip(e,'attack'); boltFx(e.x,e.y,player.x,player.y,'blood'); sfx('shaman-cast');
      if(rng()<hostileHitChance(hitChance(e.base.acc+6, player.eva),true)){
        var bd=deepHurt(player, roll(e.dmg[0], e.dmg[1]), 'dark', e, 'The <b>Drow Priestess</b>\'s blood bolt hits you');
        if(bd>0 && e.hp>0 && e.hp<e.maxhp){ var hh=Math.min(bd, e.maxhp-e.hp); e.hp+=hh; floatText(e.x,e.y,'+'+hh,'heal'); }
      } else { log('The Drow Priestess\'s blood bolt misses.','c-miss'); floatText(player.x,player.y,'miss','miss'); }
       return true;
    }
    return false;
  },
  /* Thought Eater: saps your mana to heal itself (dazes you if you have none), lashes your mind otherwise */
  eater: function(e, d){
    e.sapCd=(e.sapCd===undefined ? 1 : e.sapCd)-1;
    if(d<=2 && canActorMove(e) && deepCanFlee(e)){ if(e.hp<=0)return true;fleeStep(e);  return true; }
    if(d>=2 && d<=SAP.range && deepShot(e)){
      if(e.hp<=0)return true;setClip(e,'attack'); boltFx(e.x,e.y,player.x,player.y,'magic'); sfx('shaman-cast');
      if(rng() >= hostileHitChance(hitChance(e.base.acc+10, player.eva),true)){ log('The Thought Eater\'s '+(e.sapCd<=0 ? 'mana sap' : 'lash')+' slides off your mind.','c-miss'); floatText(player.x,player.y,'miss','miss'); if(e.sapCd<=0) e.sapCd=1;  return true; }
      if(e.sapCd<=0){
        e.sapCd=SAP.cd;
        if(player.mp>=1){
          var n=Math.min(Math.floor(player.mp), sDMG(SAP.base+floorNo*SAP.per)); player.mp-=n;
          var h=Math.min(e.maxhp-e.hp, Math.round(n*SAP.heal)); e.hp+=h;
          floatText(player.x,player.y,'-'+n+' mp','magic'); if(h>0) floatText(e.x,e.y,'+'+h,'heal');
          log('The <b>Thought Eater</b> saps <b>'+n+' mana</b> out of your head'+(h>0 ? ' and swells (+'+h+' HP)' : '')+'.','c-you');
          /* 2026-09-23 (Justin): the sap hurts too - half the mana taken lands as magic damage (past armour, Spell Ward may turn it) */
          if(n>0) deepHurt(player, Math.round(n*0.5), 'magic', e, 'The <b>Thought Eater</b> feeds on the torn thoughts');
        } else {
          applyStatus(player,'stun',1); floatText(player.x,player.y,'dazed','magic');
          log('The <b>Thought Eater</b> finds no mana left to eat and rattles your empty mind: <b>dazed</b> for a turn.','c-you');
        }
      } else deepHurt(player, roll(e.dmg[0], e.dmg[1]), 'magic', e, 'The <b>Thought Eater</b> lashes your mind');
       return true;
    }
    return false;
  },
  /* Web Spitter: pins you from range every few turns, then comes in to bite */
  spitter: function(e, d){
    e.webCd=(e.webCd===undefined ? 1 : e.webCd)-1;
    if(e.webCd<=0 && d>=2 && d<=WEBSHOT.range && !player.st.root && deepShot(e)){
      if(e.hp<=0)return true;e.webCd=WEBSHOT.cd; webShot(e);  return true;
    }
    return false;
  },
  /* Drider: the bow is its ordinary ranged attack (base range 6); the web every few turns */
  drider: function(e, d){
    e.webCd=(e.webCd===undefined ? 3 : e.webCd)-1;
    if(e.webCd<=0 && d>=2 && d<=WEBSHOT.range && !player.st.root && deepShot(e)){
      if(e.hp<=0)return true;e.webCd=DRIDER.webCd; webShot(e);  return true;
    }
    return false;
  },
  /* Fire Imp: fire bolts that burn you and light webs and grass around you; it flits back from melee */
  imp: function(e, d){
    e.boltCd=(e.boltCd===undefined ? 1 : e.boltCd)-1;
    if(e.boltCd<=0 && d>=2 && d<=IMP.range && deepShot(e)){
      if(e.hp<=0)return true;e.boltCd=IMP.cd; setClip(e,'attack'); boltFx(e.x,e.y,player.x,player.y,'fire'); sfx('shaman-cast');
      if(rng()<hostileHitChance(hitChance(e.base.acc+6, player.eva),true)){
        var fd=deepHurt(player, roll(e.dmg[0], e.dmg[1]), 'fire', e, 'The <b>Fire Imp</b>\'s fire bolt hits you');
        if(player.hp>0 && rng()<IMP.burn){ applyStatus(player,'burn',3,sDMG(2)); log('You are <span class="c-fire">burning</span>.','c-you'); }
        ignite(player.x, player.y, null);
      } else {
        log('The Fire Imp\'s fire bolt misses and splashes the floor.','c-miss');
        var c=nearFree(player.x,player.y,1); if(c) ignite(c.x, c.y, null);
      }
       return true;
    }
    if(d<=1 && canActorMove(e) && deepCanFlee(e)){ if(e.hp<=0)return true;fleeStep(e);  return true; }   /* 2026-09-23 (Justin): it fights from range, so it always backs off when it can */
    return false;
  }
};

function deepCreatureBehavior(e){
  var b=e.base||{};
  if(b.deepAI && DEEP_AI[b.deepAI] && e.state==='hunt' && canSeePlayer(e)){
    if(DEEP_AI[b.deepAI](e, dist(e,player))) return true;
  }
  return false;

}

/* ---------------------------------------------------------------- cocoons hatch
   A cocoon the world tagged p.hatch bursts when you come within 2 tiles of it in sight: the prop goes, webbing
   is left on its tiles, and Spiderlings pour out (3-5 from a big one, 2-3 from a small cluster). */
function deepHatchTick(){
  if(!deepMobsOn() || typeof props==='undefined' || !props.length || !player || player.hp<=0) return;
  var hatch=props.filter(function(p){ return p.hatch && !p.hatched; });
  hatch.forEach(function(p){
    var w=p.w||1, h=p.h||1, near=false, seenIt=false;
    for(var y=p.y;y<p.y+h;y++) for(var x=p.x;x<p.x+w;x++){ if(vis[idxOf(x,y)]) seenIt=true; if(dist(player,{x:x,y:y})<=2) near=true; }
    if(!near || !seenIt) return;
    p.hatched=true;
    removeProp(p);
    var big=/large|sac/.test(p.name), n=big ? ri(3,5) : ri(2,3), got=0;   /* placeholders */
    for(var yy=p.y;yy<p.y+h;yy++) for(var xx=p.x;xx<p.x+w;xx++){ if(inb(xx,yy) && walkable(xx,yy) && gAt(xx,yy)===G_NONE) setG(xx,yy,G_WEB); burst(xx,yy,'web',26,0.08); }
    for(var k=0;k<n;k++){
      var c=(k===0 && walkable(p.x,p.y) && !occupied(p.x,p.y)) ? {x:p.x,y:p.y} : (nearFree(p.x,p.y,1) || nearFree(p.x,p.y,2));
      if(!c || deepLava(c.x,c.y)) continue;
      var s=deepSpawnRaw('spiderling', c.x, c.y); s.state='hunt'; s.t=player.t; s.caughtOff=turn; got++;
    }
    sfx('trap-web'); SHAKE=Math.max(SHAKE||0, 3);
    log('A cocoon splits open with a wet tearing sound, and '+(got>1 ? '<b>'+got+' Spiderlings</b> spill' : 'a <b>Spiderling</b> spills')+' out of it!','c-you');
  });
}


/* ---------------------------------------------------------------- The Matron of the Web (floor 20)
   Vex's ritual mechanic, kept (DESIGN.md 18). She waits on her throne until you step into the hall, then:
     ritual  - every few turns she drops onto a ritual circle (the one furthest from you) and channels for 3
               turns; the circle lights up (red) and the boss bar counts down. Deal 8% of her health in that
               time, or stun / freeze / frighten her, and it breaks (she reels, stunned a turn). If it finishes:
               Blood Tithe - a blood drain on you wherever you are (up to 30% of your max HP, and a bleed),
               healing her twice what it took; or Brood Call - a Drider and Spiderlings crawl out at the circle.
     venom   - a 3x3 on your tile marked red, landing two turns later: poison.
     web     - pins you a turn. Up close her bite bleeds.
     phases  - at 66% and 33% she shrieks and summons a Drider and Spiderlings.
   floorMeta.matron keeps her state (ids and plain data, so it saves and loads). */
function matronState(){ return floorMeta && floorMeta.matron && floorMeta.matron.phase!=='dead' ? floorMeta.matron : null; }
function matronEnt(){ var M=matronState(); if(!M) return null; for(var i=0;i<ents.length;i++) if(ents[i].id===M.id) return ents[i]; return null; }
function matronInArena(M, p){ var a=M.arena; return p.x>=a.x && p.y>=a.y && p.x<a.x+a.w && p.y<a.y+a.h; }
function matronFallbackArena(){
  var r=rooms.filter(function(o){ return o.role==='boss'; })[0];
  if(!r) r=rooms.slice().sort(function(a,z){ return z.w*z.h - a.w*a.h; })[0];
  if(!r) return null;
  var th=floorMeta.bossAt && roomAt(floorMeta.bossAt.x, floorMeta.bossAt.y)===r ? floorMeta.bossAt : {x:r.cx!==undefined ? r.cx : r.x+(r.w>>1), y:r.y+1};
  return {x:r.x, y:r.y, w:r.w, h:r.h, throne:{x:th.x, y:th.y}, circles:[], fallback:true};
}
function spawnMatron(arena){
  if(!floorMeta || floorMeta.matron) return null;
  var A=arena || matronFallbackArena(); if(!A) return null;
  var th=A.throne || {x:A.x+(A.w>>1), y:A.y+1};
  var c=(walkable(th.x,th.y) && !occupied(th.x,th.y)) ? th : nearFree(th.x,th.y,2) || nearFree(th.x,th.y,4);
  if(!c) return null;
  var e=deepSpawnRaw('matron', c.x, c.y); e.state='throne'; e.elite=true; floorMeta.bossId=e.id;
  floorMeta.matron={id:e.id, phase:0, arena:{x:A.x, y:A.y, w:A.w, h:A.h}, throne:{x:c.x, y:c.y}, circles:(A.circles||[]).map(function(o){ return {x:o.x, y:o.y}; }),
                    fallback:!!A.fallback, rit:null, nextRit:0, venom:null, venomCd:3, webCd:2, n:0};
  /* her honour guard: two blades and a priestess, asleep by the throne */
  ['drowblade','drowblade','drowpriestess'].forEach(function(k){
    var s=nearFree(c.x, c.y, 3); if(!s || deepLava(s.x,s.y)) return;
    var g=deepSpawnRaw(k, s.x, s.y); g.state='asleep'; g.guard=true;
  });
  return e;
}
/* the world may hand over its arena after she was already placed in the fallback room: move her onto it */
function matronRehome(){
  var M=floorMeta && floorMeta.matron, A=floorMeta && floorMeta.bossArena;
  if(!M || !M.fallback || !A) return;
  var e=matronEnt(); if(!e || e.state!=='throne') return;
  M.arena={x:A.x, y:A.y, w:A.w, h:A.h}; M.circles=(A.circles||[]).map(function(o){ return {x:o.x, y:o.y}; }); M.fallback=false;
  var th=A.throne || {x:A.x+(A.w>>1), y:A.y+1}, c=(walkable(th.x,th.y) && !occupied(th.x,th.y)) ? th : nearFree(th.x,th.y,2);
  if(c){ e.x=c.x; e.y=c.y; M.throne={x:c.x, y:c.y}; }
}


function matronCircleProp(c){ return c ? props.filter(function(p){ return p.x===c.x && p.y===c.y && /^ritual-circle/.test(p.name); })[0] : null; }
function matronCircleCells(c){ var out=[]; for(var y=c.y;y<=c.y+1;y++) for(var x=c.x;x<=c.x+1;x++) if(inb(x,y)) out.push(idxOf(x,y)); return out; }
function matronWake(e, M){
  e.state='hunt'; e.caughtOff=-1; M.nextRit=turn+4;
  ents.forEach(function(o){ if(o.guard && o.foe) o.state='hunt'; });
  log('<b>The Matron of the Web</b> uncoils from her throne, eight legs unfolding. "Another offering walks in on its own."','c-you');
  sfx('matron-intro'); if(typeof playMusic==='function') playMusic('boss'); SHAKE=8;
}
function matronStartRitual(e, M){
  var kinds = M.phase>=2 ? ['tithe','brood','tithe'] : ['tithe','brood'], kind=kinds[M.n%kinds.length];
  var circle=null, spot=null;
  if(canActorMove(e)&&M.circles.length){
    var cs=M.circles.slice().sort(function(a,z){ return dist(z,player)-dist(a,player); });
    for(var i=0;i<cs.length && !spot;i++){
      var free=matronCircleCells(cs[i]).map(function(k){ return {x:k%MW, y:(k/MW)|0}; })
        .filter(function(p){ return (p.x===e.x && p.y===e.y) || (walkable(p.x,p.y) && !occupied(p.x,p.y)); });
      if(free.length){ circle=cs[i]; spot=free[0]; }
    }
  }
  if(spot && !(spot.x===e.x && spot.y===e.y)){
    sparkleFx(e.x, e.y, 'web', 30); boltFx(e.x, e.y, spot.x, spot.y, 'web');
    e.x=spot.x; e.y=spot.y; e._lx=undefined; e._ly=undefined; sparkleFx(e.x, e.y, 'blood', 30);
  }
  var cells = circle ? matronCircleCells(circle) : (function(){ var o=[]; for(var y=e.y-1;y<=e.y+1;y++) for(var x=e.x-1;x<=e.x+1;x++) if(inb(x,y) && walkable(x,y)) o.push(idxOf(x,y)); return o; })();
  M.rit={kind:kind, at:turn+MATRON.ritTurns, hp0:e.hp, need:Math.max(1, Math.round(e.maxhp*MATRON.ritBreak)), circle:circle, cells:cells};
  var p=matronCircleProp(circle); if(p) p.name='ritual-circle-active';
  floorMeta.marks=(floorMeta.marks||[]).filter(function(k){ return k.kind!=='matron-rit'; }).concat([{cells:cells, col:'#D0203A', until:M.rit.at, kind:'matron-rit'}]);
  M.n++; M.nextRit=turn+MATRON.ritTurns+MATRON.ritEvery[Math.min(2,M.phase)];
  setClip(e,'attack'); sfx('shaman-cast'); SHAKE=Math.max(SHAKE||0, 4); ringFx(e.x, e.y, '#D0203A', 2);
  var nm = kind==='tithe' ? 'Blood Tithe' : 'Brood Call';
  log('The Matron '+(circle ? 'drops onto a ritual circle on a line of silk' : 'rears up')+' and begins the <b>'+nm+'</b>! '+
      'Break it: <b>'+M.rit.need+' damage in '+MATRON.ritTurns+' turns</b>, or stun her.','c-you');
  return true;
}
function matronEndRitual(M){
  var p=matronCircleProp(M.rit && M.rit.circle); if(p) p.name='ritual-circle';
  floorMeta.marks=(floorMeta.marks||[]).filter(function(k){ return k.kind!=='matron-rit'; });
  M.rit=null;
}
function matronBreak(e, M){
  matronEndRitual(M);
  applyStatus(e, 'stun', 1); floatText(e.x, e.y, 'broken!', 'magic', true);
  ringFx(e.x, e.y, '#FFFFFF', 2); sfx('parry');
  log('<b>You break the Matron\'s ritual!</b> The circle gutters out and she reels.','c-good');
}
function matronBrood(e, driders, spiders, why){
  var got=[];
  var dAlive=ents.filter(function(o){ return o.kind==='drider'; }).length;
  for(var i=0;i<driders && dAlive<MATRON.broodDriders;i++,dAlive++){
    var c=nearFree(e.x,e.y,2) || nearFree(e.x,e.y,3); if(!c || deepLava(c.x,c.y)) break;
    var d=deepSpawnRaw('drider', c.x, c.y); d.state='hunt'; d.noXp=true; d.t=player.t; sparkleFx(c.x,c.y,'web',24); got.push('a <b>Drider</b>');
  }
  var n=0;
  for(var k=0;k<spiders;k++){
    if(ents.filter(function(o){ return o.kind==='spiderling'; }).length>=PRIEST.capFloor) break;
    var s=nearFree(e.x,e.y,2); if(!s || deepLava(s.x,s.y)) break;
    var sp=deepSpawnRaw('spiderling', s.x, s.y); sp.state='hunt'; sp.noXp=true; sp.t=player.t; sparkleFx(s.x,s.y,'web',12); n++;
  }
  if(n) got.push((n>1 ? n : 'a')+' <b>Spiderling'+(n>1?'s':'')+'</b>');
  var who=got.join(' and ');
  log(why+(got.length ? ' '+who.charAt(0).toUpperCase()+who.slice(1)+' crawl'+(got.length===1 && n<=1 ? 's' : '')+' out of the webs to her.' : ' Nothing answers.'),'c-you');
}
function matronFinish(e, M){
  var R=M.rit; matronEndRitual(M);
  SHAKE=10; ringFx(e.x, e.y, '#D0203A', 6); sfx('explosion');
  if(R.kind==='tithe'){
    var raw=Math.min(roll(MATRON.tithe[0], MATRON.tithe[1]), Math.round(player.maxhp*MATRON.titheCap));   /* never a one-shot */
    boltFx(player.x, player.y, e.x, e.y, 'blood'); burst(player.x, player.y, 'blood', 40, 0.08);
    var d=deepHurt(player, raw, 'dark', e, 'The <b>Blood Tithe</b> tears the blood out of you');
    if(player.hp>0) inflictBleed(player, e, 3);
    var h=Math.min(e.maxhp-e.hp, d*MATRON.titheHeal); if(h>0){ e.hp+=h; floatText(e.x, e.y, '+'+h, 'heal'); log('The Matron drinks it: <b>+'+h+'</b> health.','c-you'); }
  } else {
    matronBrood(e, 1, ri(MATRON.broodSpiderlings[0], MATRON.broodSpiderlings[1]), 'The <b>Brood Call</b> is answered.');
  }
}
/* venom rain lands on its own clock (endTurn), so stunning her does not stop what is already falling */
function matronVenomTick(){
  var M=matronState(); if(!M || !M.venom || turn<M.venom.at || !player || player.hp<=0) return;
  var V=M.venom, e=matronEnt(); M.venom=null;
  floorMeta.marks=(floorMeta.marks||[]).filter(function(k){ return k.kind!=='matron-venom'; });
  sfx('trap-gas');
  V.cells.forEach(function(i){ if(rng()<0.6) burst(i%MW, (i/MW)|0, 'poison', 10, 0.05); });
  ents.slice().forEach(function(t){
    if(t!==player && !t.ally) return;
    if(V.cells.indexOf(idxOf(t.x,t.y))<0) return;
    var raw=roll(MATRON.venom[0], MATRON.venom[1]); if(t===player) raw=Math.min(raw, Math.round(player.maxhp*MATRON.venomCap));
    deepHurt(t, raw, 'poison', e, t===player ? 'The <b>venom rain</b> splashes over you' : null);
    if(t.hp>0) applyStatus(t, 'poison', 3, sDMG(3));
  });
}
function matronAct(e){
  /* Status expiry belongs to the world scheduler, never this creature action. */
  var reeled=!!(e.st.stun || e.st.frozen || e.st.fear), held=!!(e.st.stun || e.st.frozen);
  if(e.hp<=0)return;var M=matronState(); if(!M){  return; }
  var see=canSeePlayer(e), d=dist(e,player);
  if(e.state==='throne' || e.state==='asleep'){
    if(matronInArena(M, player) || (see && d<=7)) matronWake(e, M);
     return;
  }
  if(e.state!=='hunt') e.state='hunt';
  if(M.rit && (reeled || M.rit.hp0-e.hp>=M.rit.need)){ matronBreak(e, M);  return; }
  if(held || e.st.stun || e.st.frozen){  return; }
  /* phase shrieks */
  var pct=e.hp/e.maxhp;
  if(M.phase<2 && pct<MATRON.phase[M.phase]){
    M.phase++; setClip(e,'attack'); sfx('matron-intro'); SHAKE=10; ringFx(e.x, e.y, '#8A1A3A', 4);
    matronBrood(e, 1, M.phase===1 ? 2 : 3, '<b>The Matron shrieks</b>, and the webs overhead shake.');
     return;
  }
  if(M.rit){
    if(turn>=M.rit.at) matronFinish(e, M);
    else { burst(e.x, e.y, 'blood', 12, 0.05); if(deepVis(e.x,e.y)) log('The Matron\'s chant rises. <b>'+(M.rit.at-turn)+'</b> turn'+(M.rit.at-turn===1?'':'s')+' left ('+Math.max(0,M.rit.hp0-e.hp)+'/'+M.rit.need+' damage to break it).','c-you'); }
     return;
  }
  if(turn>=M.nextRit && matronStartRitual(e, M)){  return; }
  M.venomCd--; M.webCd--;
  if(!M.venom && M.venomCd<=0 && see && d>=2){
    var cells=[]; for(var y=player.y-1;y<=player.y+1;y++) for(var x=player.x-1;x<=player.x+1;x++) if(inb(x,y) && walkable(x,y)) cells.push(idxOf(x,y));
    M.venom={cells:cells, at:turn+2}; M.venomCd=MATRON.venomCd;
    floorMeta.marks=(floorMeta.marks||[]).filter(function(k){ return k.kind!=='matron-venom'; }).concat([{cells:cells, col:'#FF3A2A', until:turn+2, kind:'matron-venom'}]);
    setClip(e,'attack'); sfx('trap-gas'); boltFx(e.x, e.y, player.x, player.y, 'poison');
    log('The Matron spits a spray of <b>venom</b> high into the air above you. <b>Move off the red!</b>','c-you');
     return;
  }
  if(M.webCd<=0 && see && d>=2 && d<=6 && !player.st.root && deepShot(e)){ M.webCd=MATRON.webCd; webShot(e, 'Matron');  return; }
  if(d<=1){ attack(e, player);  return; }
  var guard=ents.filter(function(o){ return o.ally && dist(o,e)<=1; })[0];
  if(guard){ attack(e, guard);  return; }
  if(canActorMove(e)) chaseStep(e);

}


/* the boss bar says what she is channelling and how close you are to breaking it */
var _bossBarDeep = bossBar;
bossBar = function(){
  _bossBarDeep();
  var M=matronState(), e=M && matronEnt(), el=$('bossbar');
  if(!M || !M.rit || !e || !el || el.style.display==='none') return;
  var nm=M.rit.kind==='tithe' ? 'BLOOD TITHE' : 'BROOD CALL', left=Math.max(0, M.rit.at-turn);
  el.innerHTML=el.innerHTML.replace('<div class="bb">', ' &mdash; <span style="color:#FF5A6A">'+nm+' in '+left+' &middot; break it '+Math.max(0,M.rit.hp0-e.hp)+'/'+M.rit.need+'</span><div class="bb">');
};
/* her death: the circles go dark, her brood scatters, and the hall's exit is there to take her core to */
function deepEnsureExit(e){
  var ex=floorMeta.exitAt;
  if(ex && at(ex.x,ex.y)===EXIT) return;
  for(var i=0;i<MW*MH;i++) if(map[i]===EXIT){ floorMeta.exitAt={x:i%MW, y:(i/MW)|0}; return; }
  var M=floorMeta.matron, th=(M && M.throne) || {x:e.x, y:e.y}, c=nearFree(th.x, th.y, 2) || nearFree(e.x, e.y, 3);
  if(!c) return;
  setT(c.x, c.y, EXIT); floorMeta.exitAt={x:c.x, y:c.y};
  log('Behind the throne, the webs part over a stair leading up and out of the Underdark.','c-kill');
}


/* ---------------------------------------------------------------- drawing
   The Matron is one still (256px, not animated): she breathes and sways in code, and while she channels she
   rises on her silk with a red glow under her. Hovering creatures (the imp, the thought eater) bob. */


/* weak generated clips (see tools/deepart.py): these death clips darken or morph instead of falling, so the
   game's own topple-and-fade plays; the ember spider's idle and attack drift dark in their last frames */
var DEEP_TOPPLE = {'m-web-spitter':1, 'm-drider':1, 'm-thought-eater':1};
var DEEP_TRIM = {'m-ember-spider':{idle:5, attack:6}, 'm-spiderling':{idle:4, hurt:2}};
(function trimDeepClips(){
  if(!(typeof AS!=='undefined' && AS && AS.mobs)){ setTimeout(trimDeepClips, 200); return; }
  for(var k in DEEP_TRIM){ var m=AS.mobs[k]; if(!m) continue; for(var c in DEEP_TRIM[k]) if(m.clips[c]) m.clips[c].frames=Math.min(m.clips[c].frames, DEEP_TRIM[k][c]); }
})();


/* ---------------------------------------------------------------- words: hover cards and the boss floor */
var _inspectHTMLDeepMobs = inspectHTML;
inspectHTML = function(mx, my){
  var h=_inspectHTMLDeepMobs(mx, my);
  if(!inb(mx,my)) return h;
  var e=ents.filter(function(o){ return o.x===mx && o.y===my && o!==player; })[0];
  if(e && h && e.base && DEEP_HINT[e.kind] && actorVisible(e)){
    if(e.kind==='matron') h=h.replace('on his throne','on her throne');
    var line='<div class="hint">'+DEEP_HINT[e.kind]+'</div>', at2=h.indexOf('<div class="odds">');
    return at2>=0 ? h.slice(0,at2)+line+h.slice(at2) : h+line;
  }
  if(!h && !e){
    var p=propAt(mx,my) || props.filter(function(q){ return q.hatch && !q.hatched && mx>=q.x && my>=q.y && mx<q.x+(q.w||1) && my<q.y+(q.h||1); })[0];
    if(p && p.hatch && !p.hatched && (revealAll||seen[idxOf(mx,my)])) return '<div class="nm">Cocoon</div><div class="hint">Something twitches inside. It will burst if you come close.</div>';
  }
  return h;
};


/* Named floor-generation stages; ordered by generation-adapter.js. */
function regionalizeGeneratedDeep(seed){if(deepMobsOn()){
    try{ deepRegionalize(); }catch(err){ if(window.console) console.error(err); }
    try{ matronRehome(); }catch(err){ if(window.console) console.error(err); }
  }
  return;
}

/* Named character presentation passes; composed by render-adapter.js. */

function prepareUnderdarkActor(job){
  var e=job.entity,px=job.x,py=job.y;if(!e||e===player||!e.base)return;
  var now=performance.now(),still=ANIM.reduce;
  if(e.kind==='matron'){
    var M=matronState(),chan=!!(M&&M.rit),ph=(e.id||0)*.7;
    var breathe=still?0:Math.sin(now/520+ph),sway=still?0:Math.sin(now/1300+ph)*.018;
    var lift=chan?TS*(.22+(still?0:.05*Math.sin(now/300))):0;ctx.save();
    if(chan){
      var cx=px+TS/2,cy=py+TS*.85,g=ctx.createRadialGradient(cx,cy,TS*.1,cx,cy,TS*1.5);
      g.addColorStop(0,'rgba(220,30,50,'+(.45+(still?0:.15*Math.sin(now/180)))+')');g.addColorStop(1,'rgba(120,0,20,0)');
      ctx.fillStyle=g;ctx.fillRect(cx-TS*1.5,cy-TS*1.5,TS*3,TS*3);
      ctx.strokeStyle='rgba(235,230,220,0.55)';ctx.lineWidth=Math.max(1,TS*.03);ctx.beginPath();ctx.moveTo(cx,py-TS*3);ctx.lineTo(cx,py-lift+TS*.1);ctx.stroke();
    }
    var fx0=px+TS/2,fy0=py+TS;ctx.translate(fx0,fy0-lift);ctx.rotate(sway);ctx.scale(1+.012*breathe,1-.018*breathe);ctx.translate(-fx0,-fy0);
    return function(){ctx.restore();};
  }
  if(e.base.hover){var bob=still?0:Math.sin(now/280+(e.id||0))*TS*.05;ctx.save();ctx.translate(0,bob-TS*.06);return function(){ctx.restore();};}
}
