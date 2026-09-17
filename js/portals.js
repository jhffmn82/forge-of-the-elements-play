/* =====================================================================
   portals.js - elemental portals and plane floors (2026-09-17). See DESIGN.md section 17.
   One Crypt floor always holds a portal (Light, Shadow or Earth, chosen per run). Stepping through takes
   you to a freshly generated cave floor of that element (planes.js layouts): its own stone, props, hazard,
   three enemy kinds and an elite in the central chamber, and a treasure grotto. The portal home stands
   where you arrived. A plane can be visited once; the Crypt floor waits exactly as you left it.
   Light uses Justin's creatures (art/reference/planes-enemies/Light); Shadow and Earth still use stand-ins.
   ===================================================================== */

var PORTAL = 20;
var PLANE_EL_COL = {light:'#FFE08A', shadow:'#B98CFF', earth:'#9FD86A', fire:'#FF8A3A', water:'#7CC8FF', air:'#E8F4FF'};
var PLANE_TITLE = {light:'the Plane of Light', shadow:'the Plane of Shadow', earth:'the Plane of Earth', fire:'the Plane of Fire', water:'the Plane of Water', air:'the Plane of Air'};

/* ---------------------------------------------------------------- the tile */
var _walkablePortal = walkable;
walkable = function(x,y){ return at(x,y)===PORTAL || _walkablePortal(x,y); };
var _objectTilePortal = objectTile;
objectTile = function(t){ return t===PORTAL || _objectTilePortal(t); };
var _tileSpritePortal = tileSprite;
tileSprite = function(x,y,t){ return t===PORTAL ? objArt('structures','portal-arch') : _tileSpritePortal(x,y,t); };
function portalElement(){ return floorMeta.plane || floorMeta.portal; }
function portalOpen(){ return floorMeta.plane ? true : (floorMeta.portal && !floorMeta.portalUsed); }

/* the swirl inside the arch, animated */
var _drawTelegraphsPortal = drawTelegraphs;
drawTelegraphs = function(now){
  _drawTelegraphsPortal(now);
  var p=floorMeta && floorMeta.portalAt; if(!p || at(p.x,p.y)!==PORTAL || !(revealAll||seen[idxOf(p.x,p.y)])) return;
  if(!portalOpen()) return;
  var col=PLANE_EL_COL[portalElement()]||'#FFFFFF', t=ANIM.reduce ? 0 : (now||0)/1000;
  var cx=(p.x-camX+0.5)*TS, cy=(p.y-camY+0.46)*TS, rx=TS*0.25, ry=TS*0.32;
  ctx.save();
  var g=ctx.createRadialGradient(cx,cy,1,cx,cy,rx*1.2); g.addColorStop(0,'rgba(255,255,255,0.85)'); g.addColorStop(0.35,col); g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.globalAlpha=0.55+0.15*Math.sin(t*2.4); ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,7); ctx.fill();
  ctx.globalAlpha=0.95;
  for(var i=0;i<14;i++){
    var a=t*(1.6+(i%3)*0.4)+i*0.9, rr=(0.25+0.75*((i*37%10)/10)) * (1-((t*0.6+i*0.13)%1)*0.6);
    var px=cx+Math.cos(a)*rx*rr, py=cy+Math.sin(a)*ry*rr, s=Math.max(1.5, TS*0.045);
    ctx.fillStyle = i%3===0 ? '#FFFFFF' : col; ctx.fillRect(px-s/2, py-s/2, s, s);
  }
  ctx.restore();
};
var _gatherLightsPortal = gatherLights;
gatherLights = function(now, prp){
  var L=_gatherLightsPortal(now, prp), p=floorMeta && floorMeta.portalAt;
  if(p && at(p.x,p.y)===PORTAL && portalOpen()) L.push({x:p.x, y:p.y, c:hexRGB(PLANE_EL_COL[portalElement()]||'#FFFFFF'), r:4.2, s:1.0*(ANIM.reduce?1:1+0.1*Math.sin(now/300)), tx:p.x, ty:p.y});
  (floorMeta && floorMeta.planeLights || []).forEach(function(l){ if(revealAll||seen[idxOf(l.x,l.y)]) L.push({x:l.x, y:l.y, c:hexRGB(l.col), r:l.r, s:l.s, tx:l.x, ty:l.y}); });
  return L;
};

/* ---------------------------------------------------------------- placing the portal on its Crypt floor */
var _generatePortal = generate;
generate = function(seed){
  _generatePortal(seed);
  if(!floorMeta.portal || floorMeta.boss) return;
  var cand=rooms.filter(function(r){ return !r.role && !r.pocket && !r.special && r.w>=4 && r.h>=4; });
  cand.sort(function(a,b){ return (Math.abs(b.cx-player.x)+Math.abs(b.cy-player.y))-(Math.abs(a.cx-player.x)+Math.abs(a.cy-player.y)); });
  for(var i=0;i<cand.length;i++){
    var r=cand[i], c={x:r.cx, y:r.y+1};
    if(at(c.x,c.y)===FLOOR && !propAt(c.x,c.y) && !itemAt(c.x,c.y) && !occupied(c.x,c.y)){
      setT(c.x,c.y,PORTAL); floorMeta.portalAt=c; r.role='portal';
      floorMeta.notes.push('Something hums on this floor: <b>a portal to '+PLANE_TITLE[floorMeta.portal]+'</b> stands open.');
      break;
    }
  }
};

/* ---------------------------------------------------------------- stepping on a portal */
var _stepOnPortal = stepOn;
stepOn = function(){
  var r=_stepOnPortal();
  if(at(player.x,player.y)!==PORTAL) return r;
  if(floorMeta.plane){
    confirmBox('Leave '+PLANE_TITLE[floorMeta.plane], (floorMeta.eliteDead ? 'The way home shimmers.' : 'The guardian of this plane still lives.')+' Return to the Crypt? The portal closes behind you.', 'Return', function(){ leavePlane(); });
  } else if(floorMeta.portal && !floorMeta.portalUsed){
    confirmBox('Step through the portal', 'A cave of pure '+floorMeta.portal+' lies beyond: harder than the Crypt, guarded by an elite, with treasure at its end. You can come back through the portal you arrive at.', 'Step through', function(){ enterPlane(floorMeta.portal); });
  } else if(floorMeta.portalUsed) log('The portal has gone dark.','c-info');
  return r;
};

/* ---------------------------------------------------------------- building a plane floor */
var PLANE_PROPS = {
  light:  {decor:['crystal-gold-small','stalagmite-light','crystal-gold-small'], light:'crystal-gold', lightCol:'#FFE08A', rune:'rune-stone-light', center:'sun-dais', stone:null},
  shadow: {decor:['crystal-violet','stalagmite-shadow','stalagmite-shadow'], light:'crystal-violet', lightCol:'#B98CFF', rune:'rune-stone-shadow', center:null, stone:'stepping-stone'},
  earth:  {decor:['fern','root-tangle','glow-mushrooms','fern'], light:'glow-mushrooms', lightCol:'#D8F0A0', rune:'rune-stone-earth', center:null, stone:'mossy-boulder'}
};
['crystal-gold','crystal-gold-small','stalagmite-light','crystal-violet','stalagmite-shadow','fern','root-tangle','glow-mushrooms','stepping-stone','sun-dais'].forEach(function(n){ PROPS[n]=PROPS[n]||{flat:1}; });
PROPS['rune-stone-light']={b:1}; PROPS['rune-stone-shadow']={b:1}; PROPS['rune-stone-earth']={b:1}; PROPS['mossy-boulder']={b:1};
PROPS['stepping-stone']={flat:1};

function enterPlane(el){
  closeModal && modalOpen && closeModal();
  var from={x:player.x, y:player.y}, fromFloor=floorNo;
  floorMeta.portalUsed=true;
  stashFloor();
  RUN.planeStash=RUN.floorStash[floorNo]; delete RUN.floorStash[floorNo];
  RUN.planeFrom=from; RUN.planesVisited=(RUN.planesVisited||[]).concat([el]);
  buildPlaneFloor(el, (worldSeed ^ 0x7A11E5 ^ floorNo*131)>>>0);
  sfx('stairs'); SHAKE=6;
  log('You step through the portal into <b>'+PLANE_TITLE[el]+'</b>.','c-kill');
  log(PLANE_HAZARD_TEXT[el],'c-info');
  if(typeof writeSlot==='function') writeSlot('auto','plane');
}
var PLANE_HAZARD_TEXT = {
  light: 'Gold light pulses through the cave: when stones start to glow, get into the shade of a crystal or pillar before the flare.',
  shadow:'Darkness presses in: you see only a short way here, and further in the violet glow of the crystals.',
  earth: 'The cave groans: when dust starts to trickle, step off the marked stones before the rocks fall.'
};
function buildPlaneFloor(el, seed){
  var m=makePlaneMap(el, seed), W=MW, H=MH, K=PLANE_PROPS[el];
  map=new Uint8Array(W*H); seen=new Uint8Array(W*H); vis=new Uint8Array(W*H);
  ground=new Uint8Array(W*H); fireT=new Uint8Array(W*H); if(typeof fireSrc!=='undefined') fireSrc=new Uint8Array(W*H);
  propGrid=new Int16Array(W*H).fill(-1); props=[]; feats=[]; items=[]; ents=[player]; rooms=[]; chestKind={}; levers=[]; plates=null; altars={};
  if(typeof groundReset==='function') groundReset();
  spawnedExtra=99; nextSpawn=1e9;
  floorMeta={floor:floorNo, biome:bidx(), plane:el, exitOpen:false, keyHolder:false, notes:[], planeLights:[], puzzles:[], searched:{}};
  var rr=mulberry32(seed^0x51A5E);
  var decorN=0;
  for(var y=0;y<H;y++) for(var x=0;x<W;x++){
    var v=m.grid[y*W+x], i=y*W+x;
    if(v===PL.ROCK){ map[i]=WALL; continue; }
    map[i] = v===PL.WATER ? WATER : FLOOR;
    if(v===PL.ENTRY){ map[i]=PORTAL; floorMeta.portalAt={x:x,y:y}; }
    else if(v===PL.DECOR){ (floorMeta._anchors=floorMeta._anchors||[]).push({x:x,y:y}); if(el==='earth' && rr()<0.5) addProp(x,y,K.decor[(decorN++)%K.decor.length]); }   /* Earth keeps some plants; rock and crystal formations are terrain */
    else if(v===PL.LIGHT){ if(el==='earth'){ addProp(x,y,K.light); floorMeta.planeLights.push({x:x,y:y,col:K.lightCol,r:3.4,s:0.8}); } }
    else if(v===PL.BLOCK && K.stone){ addProp(x,y,K.stone); }
    else if(v===PL.RUNE){
      /* the rune stone spans two cells where there is room, and its sprite carries its own shadow */
      /* the stone is as big as it looks: two cells wide and two deep where there is room, and all of it blocks */
      function runeFree(cx, cy){ return inb(cx,cy) && m.grid[cy*W+cx]!==PL.ROCK && !propAt(cx,cy) && map[idxOf(cx,cy)]===FLOOR; }
      /* the stone is drawn two cells across, so it needs a 2x2 block of floor: look nearby for one */
      var spot=null;
      for(var rr2=0; rr2<=3 && !spot; rr2++) for(var oy2=-rr2; oy2<=rr2 && !spot; oy2++) for(var ox2=-rr2; ox2<=rr2; ox2++){
        var bx=x+ox2, by=y+oy2;
        if([[0,0],[1,0],[0,1],[1,1]].every(function(o){ return runeFree(bx+o[0], by+o[1]); })){ spot={x:bx, y:by}; break; }
      }
      if(spot && typeof addSetPiece==='function') addSetPiece(spot.x, spot.y, K.rune, 2, 2, {keep:true});
      else addProp(x, y, K.rune, {keep:true});   /* nowhere for the big one: a single cell instead */
      var lit=spot || {x:x, y:y};
      floorMeta.planeLights.push({x:lit.x+(spot?0.5:0), y:lit.y+(spot?0.5:0), col:K.lightCol, r:3.2, s:0.75});
    }
    else if(v===PL.TREASURE){ map[i]=CHEST; chestKind[i]='chest-plane'; floorMeta.treasureAt={x:x,y:y}; }
  }
  /* seal any pocket of floor the cave generator left walled off, so nothing unreachable shows on the map */
  (function(){
    var seenP=new Uint8Array(MW*MH), q=[m.entry.x+m.entry.dx, m.entry.y+m.entry.dy];
    if(map[idxOf(q[0],q[1])]===WALL){ q=[m.entry.x, m.entry.y]; }
    seenP[idxOf(q[0],q[1])]=1;
    for(var h=0; h<q.length; h+=2){
      var qx=q[h], qy=q[h+1];
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(o){
        var nx=qx+o[0], ny=qy+o[1]; if(!inb(nx,ny)) return; var i=idxOf(nx,ny);
        if(seenP[i] || map[i]===WALL) return; seenP[i]=1; q.push(nx,ny);
      });
    }
    var sealed=0;
    for(var i2=0;i2<map.length;i2++){ if(map[i2]!==WALL && !seenP[i2]){ map[i2]=WALL; sealed++; } }
  })();
  /* centerpieces */
  if(K.center){   /* the centerpiece spans 2x2 and can be stood on */
    for(var cy2=m.center.y; cy2<=m.center.y+1; cy2++) for(var cx2=m.center.x; cx2<=m.center.x+1; cx2++){ var ci=idxOf(cx2,cy2); if(map[ci]!==FLOOR) map[ci]=FLOOR; var cp=propAt(cx2,cy2); if(cp) removeProp(cp); }
    var cpc=addSetPiece(m.center.x, m.center.y, K.center, 2, 2, {keep:true}); if(cpc){ cpc.b=0; cpc.flat=1; }

  }
  if(el==='shadow'){ for(var yy=m.center.y-2;yy<=m.center.y+2;yy++) for(var xx=m.center.x-4;xx<=m.center.x+4;xx++){ if(inb(xx,yy) && map[idxOf(xx,yy)]===FLOOR && rr()<0.5 && [[1,0],[-1,0],[0,1],[0,-1]].some(function(o){ return at(xx+o[0],yy+o[1])===WATER; })) addProp(xx,yy,'stepping-stone'); } }
  if(el==='shadow'){ floorMeta.planeLights.push({x:m.center.x,y:m.center.y,col:'#7A4FE0',r:5,s:0.9}); }
  if(el==='light'){ floorMeta.planeLights.push({x:m.center.x+0.5,y:m.center.y+0.5,col:'#FFF4DC',r:6,s:0.9}); }
  floorMeta.centerAt=m.center;
  if(typeof ptPlanFeatures==='function' && PT_MAT[el]) ptPlanFeatures(rr);   /* outcrop, spring, wall formations (planeterrain.js) */
  delete floorMeta._anchors;
  player.x=m.entry.x+m.entry.dx; player.y=m.entry.y+m.entry.dy; player._lx=undefined;
  if(!walkable(player.x,player.y)){ player.x=m.entry.x; player.y=m.entry.y; }
  /* the plane's creatures: 3 kinds, and the elite at the heart of the cave */
  var roster=PLANE_ROSTER[el], open=[];
  for(var j=0;j<W*H;j++){ var ox=j%W, oy=(j/W)|0; if(walkable(ox,oy) && !propAt(ox,oy) && map[j]!==PORTAL && Math.abs(ox-player.x)+Math.abs(oy-player.y)>9) open.push({x:ox,y:oy}); }
  var n=12+bfloor()*2;
  for(var k=0;k<n && open.length;k++){
    var c=open.splice(Math.floor(rr()*open.length),1)[0];
    var kind=roster.mobs[Math.floor(rr()*roster.mobs.length)], e=spawn(kind, c.x, c.y);
    e.state = rr()<0.6 ? 'asleep' : 'wander';
    if(kind==='umbralhound'){ var c2=nearFree(c.x,c.y,2); if(c2){ var e2=spawn(kind,c2.x,c2.y); e2.state=e.state; } }
  }
  var cc=nearFree(m.center.x, m.center.y+2, 3) || m.center;
  var elite=spawn(roster.elite, cc.x, cc.y); elite.state='asleep'; elite.elite=true; floorMeta.eliteId=elite.id;
  if(roster.elite==='mountainheart') setupHeart(elite);
  computeFOV(); resize(); updateUI(); draw();
  playMusic('boss');
}
function leavePlane(){
  var st=RUN.planeStash; if(!st){ log('The portal flickers but nothing happens.','c-info'); return; }
  RUN.floorStash=RUN.floorStash||{};
  RUN.floorStash[floorNo]=st; RUN.planeStash=null;
  restoreFloor(floorNo, RUN.planeFrom);
  floorMeta.portalUsed=true;
  log('You step back into the '+biomeName()+'. Behind you the portal gutters and goes dark.','c-kill');
  playMusic('dungeon');
  if(typeof writeSlot==='function') writeSlot('auto','floor '+floorNo);
}
/* the plane's treasure */
var _openChestPlane = openChest;
openChest = function(x,y){
  if(chestKind[idxOf(x,y)]!=='chest-plane') return _openChestPlane(x,y);
  var el=floorMeta.plane;
  setT(x,y,FLOOR); sfx('chest-open'); sparkleFx(x,y,'light',40);
  addProp(x,y,'chest-wood-open',{flat:false, b:false, openChest:true});
  var loot=[];
  for(var g=0; g<2; g++){ var gear=randomGear(); if(gear.it){ if(gear.it.tier!==undefined) gear.it.tier=Math.min(3,(typeof gear.it.tier==='number'?gear.it.tier:1)+1); if(gear.kind==='weapon'||gear.kind==='armor') gear.it.enchant=el; gear.it.cursed=false; } loot.push(gear); }
  var motes=2+(rng()<0.5?1:0); for(var mt=0;mt<motes;mt++) loot.push({kind:'mote', el:el});
  loot.push({kind:'essence', n:Math.round((80+rng()*40)*(typeof essenceMult==='function'?essenceMult():1))});
  loot.forEach(function(it){ var c=nearFree(x,y,2)||{x:x,y:y}; it.x=c.x; it.y=c.y; items.push(it); });
  log('The rune chest opens: treasure of '+PLANE_TITLE[el]+'.','c-kill');
  stepOn();
};
/* no stragglers wander into a plane */
var _wanderPlane = wanderingSpawn;
wanderingSpawn = function(){ if(floorMeta && floorMeta.plane) return; return _wanderPlane(); };
var _descendPlane = descend;
descend = function(fell){ if(floorMeta && floorMeta.plane){ log('There are no stairs in '+PLANE_TITLE[floorMeta.plane]+'. The portal is the way home.','c-info'); return; } return _descendPlane(fell); };

/* ---------------------------------------------------------------- plane creatures */
var PLANE_ROSTER = {
  light:  {mobs:['dawnsentinel','halowisp','prismscarab'], elite:'radiantwarden'},
  shadow: {mobs:['stalker','gloommoth','umbralhound'], elite:'nightwarden'},
  earth:  {mobs:['burrower','crystalgolem','mosstroll'], elite:'mountainheart'}
};
(function(){
  var M=MONSTERS;
  function mk(o){ o.band=[0,0]; o.w=0; o.speed=o.speed||100; o.range=o.range||1; return o; }
  /* Light (Justin's creatures, 2026-09-17) */
  M.dawnsentinel = mk({name:'Dawn Sentinel', sprite:'m-dawn-sentinel', col:'#F6E7B0', ch:'D', hp:32, dmg:[6,9], acc:66, eva:12, armor:5, xp:42, reflects:true, art:1.05});
  M.halowisp     = mk({name:'Halo Wisp', sprite:'m-halo-wisp', col:'#FFE08A', ch:'w', hp:14, dmg:[2,4], acc:60, eva:34, armor:0, xp:30, healer:true, flying:true, el:'light', art:0.75});
  M.prismscarab  = mk({name:'Prism Scarab', sprite:'m-prism-scarab', col:'#C8F0FF', ch:'p', hp:22, dmg:[4,7], acc:66, eva:14, armor:3, xp:36, range:4, prism:true, el:'light', art:0.85});
  M.radiantwarden= mk({name:'Radiant Warden', sprite:'m-radiant-warden', col:'#FFD24A', ch:'R', hp:150, dmg:[9,14], acc:72, eva:18, armor:5, xp:300, elite:true, brands:true, el:'light', art:1.3});
  M.stalker      = mk({name:'Stalker', sprite:'m-stalker', col:'#2A2436', ch:'s', hp:26, dmg:[6,10], acc:70, eva:24, armor:1, xp:40, lurks:true, shadowy:true, art:1.0});
  M.gloommoth    = mk({name:'Gloom Moth', sprite:'m-gloom-moth', col:'#6A4F8A', ch:'m', hp:16, dmg:[3,5], acc:62, eva:30, armor:0, xp:30, snuffs:true, flying:true, erratic:true, art:0.85});
  M.umbralhound  = mk({name:'Umbral Hound', sprite:'m-umbral-hound', col:'#2A2436', ch:'h', hp:24, dmg:[5,8], acc:66, eva:20, armor:1, xp:34, howls:true, shadowy:true, art:0.95});
  M.nightwarden  = mk({name:'Night Warden', sprite:'m-night-warden', col:'#B8B0D8', ch:'W', hp:140, dmg:[9,14], acc:72, eva:20, armor:4, xp:300, elite:true, moonbound:true, shadowy:true, art:1.2});
  M.burrower     = mk({name:'Burrower', sprite:'m-burrower', col:'#8A6A4A', ch:'b', hp:28, dmg:[6,9], acc:64, eva:10, armor:3, xp:38, burrows:true, art:0.95});
  M.crystalgolem = mk({name:'Crystal Golem', sprite:'m-crystal-golem', col:'#9A8AC0', ch:'G', hp:40, dmg:[7,11], acc:60, eva:4, armor:10, xp:46, shatters:true, el:'earth', art:1.05});
  M.mosstroll    = mk({name:'Moss Troll', sprite:'m-moss-troll', col:'#6F8A44', ch:'T', hp:44, dmg:[7,12], acc:62, eva:8, armor:2, xp:46, regenerates:true, living:true, art:1.1});
  M.mountainheart= mk({name:'Heart of the Mountain', sprite:'m-mountain-heart', col:'#C08A40', ch:'M', hp:180, dmg:[10,15], acc:68, eva:0, armor:6, xp:320, elite:true, big:2, still:true, el:'earth', art:1.9});
  M.crystalnode  = mk({name:'Crystal Node', sprite:'m-crystal-golem', col:'#C8A0FF', ch:'*', hp:30, dmg:[0,0], acc:0, eva:0, armor:3, xp:20, object:true, art:0.6});
  ['dawnsentinel','halowisp','prismscarab','radiantwarden','stalker','gloommoth','umbralhound','nightwarden','burrower','crystalgolem','mosstroll','mountainheart','crystalnode'].forEach(function(k){ DROPS[k]=DROPS[k]||{chance:0.3, table:{essence:8, sigil:2, gear:3}}; });
})();

/* the plane hazards */
function planeTick(){
  var el=floorMeta && floorMeta.plane; if(!el || !player || player.hp<=0) return;
  floorMeta.hz=(floorMeta.hz||0)+1;
  var marks=floorMeta.marks=(floorMeta.marks||[]).filter(function(mk){ return turn<mk.until; });
  var pending=floorMeta.hazardPending;
  if(pending && turn>=pending.at){
    floorMeta.hazardPending=null; floorMeta.marks=marks.filter(function(mk){ return mk.kind!=='hazard'; });
    pending.cells.forEach(function(i){
      var x=i%MW, y=(i/MW)|0;
      burst(x,y, el==='light'?'light':'earth', 8, 0.05);
      ents.slice().forEach(function(t){
        if(t.x!==x || t.y!==y) return;
        if(t!==player && t.base && (PLANE_ROSTER[el].mobs.indexOf(t.kind)>=0 || t.kind===PLANE_ROSTER[el].elite)) return;
        var hd=applyDamage(t, roll(5,8)+Math.floor(floorNo/2), el==='light'?'light':'phys', null); floatText(t.x,t.y,String(hd), el==='light'?'light':'phys');
        if(el==='light') applyStatus(t,'blind',2);
        if(t===player){ log(el==='light' ? 'The floor flares with blinding light: '+hd+'!' : 'Rocks crash down on you: '+hd+'!','c-you'); if(player.hp<=0){ heroicResolve(); if(player.hp<=0) death(); } }
        else if(t.hp<=0) kill(t, null);
      });
    });
    if(el==='earth') SHAKE=7;
  }
  var every = el==='light' ? 4 : el==='earth' ? 6 : 0;
  if(every && floorMeta.hz%every===0 && !floorMeta.hazardPending){
    var cells=[];
    if(el==='light'){
      /* a few blotches of glowing floor around you; crystal and stone shade is safe */
      for(var b=0;b<3;b++){ var bx=player.x+ri(-5,5), by=player.y+ri(-4,4); for(var y=by-1;y<=by+1;y++) for(var x=bx-2;x<=bx+2;x++){ if(!inb(x,y) || !walkable(x,y)) continue; var shade=[[1,0],[-1,0],[0,1],[0,-1]].some(function(o){ var p=propAt(x+o[0],y+o[1]); return p && /crystal|stalagmite|rune|dais/.test(p.name); }); if(!shade && rng()<0.8) cells.push(idxOf(x,y)); } }
      if(rng()<0.6) cells.push(idxOf(player.x,player.y));
    } else {
      for(var k=0;k<7;k++){ var x2=player.x+ri(-3,3), y2=player.y+ri(-3,3); if(inb(x2,y2) && walkable(x2,y2)) cells.push(idxOf(x2,y2)); }
    }
    cells=cells.filter(function(v,i,a){ return a.indexOf(v)===i; });
    floorMeta.hazardPending={cells:cells, at:turn+2};
    floorMeta.marks.push({cells:cells, col: el==='light' ? '#FFD84A' : '#B08A5A', until:turn+2, kind:'hazard'});
    log(el==='light' ? 'Gold light gathers in the stones around you...' : 'Dust trickles from the cave roof...','c-you');
  }
}
var _endTurnPlane = endTurn;
endTurn = function(){ _endTurnPlane(); planeTick(); planeCreaturesTick(); };
/* Shadow: darkness closes in, except near the violet crystals */
var _computeFOVPlane = computeFOV;
computeFOV = function(radius){
  if(floorMeta && floorMeta.plane==='shadow'){
    var lit=(floorMeta.planeLights||[]).some(function(l){ return Math.abs(l.x-player.x)<=2 && Math.abs(l.y-player.y)<=2; });
    radius = player.snuffed>0 ? 2 : (lit ? 8 : 5);   /* dark, but far enough to read the room; a snuffed light still blinds you */
  } else if(player && player.snuffed>0) radius=Math.min(radius||9, 2);
  return _computeFOVPlane(radius);
};
function inMoonlight(e){ return (floorMeta.planeLights||[]).some(function(l){ return Math.abs(l.x-e.x)<=2 && Math.abs(l.y-e.y)<=2; }); }

/* damage rules for plane creatures */
var _applyDamagePlane = applyDamage;
applyDamage = function(target, amount, type, source){
  var b=target && target.base;
  if(b && target!==player){
    if(target.parent){ return applyDamage(target.parent, amount, type, source); }                                   /* the Heart's other tiles */
    if(b.big && (floorMeta.heartNodes||[]).some(function(id){ return ents.some(function(o){ return o.id===id && o.hp>0; }); })){
      if(source===player && vis[idxOf(target.x,target.y)] && !target._immuneMsg){ target._immuneMsg=turn; log('The <b>Heart of the Mountain</b> drinks strength from its crystal nodes. Break them first.','c-info'); }
      return 0;
    }
    if(b.moonbound && !inMoonlight(target)){ if(source===player) log('Your blow passes through shadow: the <b>Night Warden</b> can only be hurt in the crystals\' light.','c-info'); return 0; }
    if(b.burrows && target.burrowed) return 0;
    if(b.blocksFirst && target._blockTurn!==turn && amount>0){ target._blockTurn=turn; floatText(target.x,target.y,'block','miss'); if(vis[idxOf(target.x,target.y)]) log('The <b>Zealot Knight</b> takes the blow on its shield.','c-info'); return 0; }
    if(b.regenerates && (type==='fire' || (target.st && target.st.burn))) target._burnedAt=turn;
    if(b.reflects && source===player && (type!=='phys' || dist(target,player)>1) && amount>1){
      var back=Math.round(amount*0.5); amount-=back;
      var rd=_applyDamagePlane(player, back, type, target); floatText(player.x,player.y,String(rd),'light'); log('The <b>'+target.name+'</b> reflects '+rd+' back at you.','c-you');
    }
    if(b.brands && target.brand && source===player) target.brand.stored += amount;
  }
  var d=_applyDamagePlane(target, amount, type, source);
  if(target===player && source && source.base){
    if(source.base.snuffs){ player.snuffed=5; log('The <b>Gloom Moth</b> smothers your light.','c-you'); computeFOV(); }
    if(source.base.lurks && !source._struck){ source._struck=true; }
  }
  return d;
};
var _attackPlane = attack;
attack = function(att, def, mult, label){
  if(att && att.base && att.base.prism && def===player && dist(att,player)>1 && !att._splitting){
    var other=ents.filter(function(o){ return o!==player && !o.foe && o.hp>0 && dist(o,player)<=3 && canSeeFrom(att,o); })[0];
    att._splitting=true;
    try{
      if(typeof boltFx==='function') boltFx(att.x, att.y, player.x, player.y, 'light', {});
      var r=_attackPlane(att, player, (mult||1)*(other?0.7:1), label);
      if(other){ if(typeof boltFx==='function') boltFx(att.x, att.y, other.x, other.y, 'light', {}); _attackPlane(att, other, (mult||1)*0.7, label); if(vis[idxOf(att.x,att.y)]) log('The <b>Prism Scarab</b> splits its beam between you and '+other.name+'.','c-info'); }
      return r;
    } finally { att._splitting=false; }
  }
  if(att && att.base && att.base.lurks && !att._struck && def===player){ mult=(mult||1)*2; att._struck=true; log('The <b>Stalker</b> strikes from the dark!','c-you'); }
  return _attackPlane(att, def, mult, label);
};

function canSeeFrom(a,b){ var path=boltPath(a.x,a.y,b.x,b.y), end=path[path.length-1]; return end && end.x===b.x && end.y===b.y; }
function planeCreaturesTick(){
  if(!floorMeta || !floorMeta.plane || !player) return;
  if(player.snuffed>0){ player.snuffed--; if(player.snuffed===0){ log('Your light steadies.','c-info'); computeFOV(); } }
  ents.slice().forEach(function(e){
    var b=e.base||{};
    if(b.regenerates && e.hp>0 && e.hp<e.maxhp && !(e._burnedAt>turn-5)){ e.hp=Math.min(e.maxhp, e.hp+4); }
  });
}

var _aiActPlane = aiAct;
aiAct = function(e){
  var b=e.base||{};
  if(!floorMeta || !floorMeta.plane) return _aiActPlane(e);
  if(e.parent || b.object){ e.t+=actCost(e); return; }
  var see=canSeePlayer(e), d=dist(e,player);
  if(e.state==='hunt' && !e.st.stun && !e.st.frozen){
    if(b.healer){
      e.healCd=(e.healCd||0)-1;
      var hurt=ents.filter(function(o){ return o.foe && o!==e && o.hp<o.maxhp && dist(o,e)<=4; }).sort(function(a,z){ return a.hp/a.maxhp-z.hp/z.maxhp; })[0];
      if(hurt && e.healCd<=0){ var h=Math.min(hurt.maxhp-hurt.hp, 8); hurt.hp+=h; floatText(hurt.x,hurt.y,'+'+h,'heal'); sparkleFx(hurt.x,hurt.y,'light',16); e.healCd=2; e.t+=actCost(e); return; }
      if(d<=3 && fleeStep(e)){ e.t+=actCost(e); return; }
    }
    if(b.howls && !e.howled && see){ e.howled=true; log('The <b>Umbral Hound</b> howls! Everything in the dark turns toward you.','c-you'); ents.forEach(function(o){ if(o.foe && o.state!=='hunt' && dist(o,e)<=14){ o.state='hunt'; o.lastSeen={x:player.x,y:player.y}; } }); e.t+=actCost(e); return; }
    if(b.burrows){
      e.bCd=(e.bCd||0)-1;
      if(!e.burrowed && d>2 && e.bCd<=0){ e.burrowed=true; e.bCd=6; if(vis[idxOf(e.x,e.y)]) log('The <b>Burrower</b> dives into the ground.','c-info'); e.t+=actCost(e); return; }
      if(e.burrowed){
        if(d<=1 || e.bCd<=3){ var sp=nearFree(player.x,player.y,1); if(sp){ e.x=sp.x; e.y=sp.y; } e.burrowed=false; SHAKE=4; log('The <b>Burrower</b> bursts up beside you!','c-you'); e.t+=actCost(e); return; }
        var nx=e.x+Math.sign(player.x-e.x), ny=e.y+Math.sign(player.y-e.y); if(inb(nx,ny) && at(nx,ny)!==WALL && !occupied(nx,ny)){ e.x=nx; e.y=ny; }
        e.t+=actCost(e); return;
      }
    }
    if(b.moonbound){
      e.tpCd=(e.tpCd||0)-1;
      if(e.tpCd<=0 || (d<=1 && inMoonlight(e))){
        var shadows=[]; for(var y=player.y-7;y<=player.y+7;y++) for(var x=player.x-7;x<=player.x+7;x++){ if(inb(x,y) && walkable(x,y) && !occupied(x,y) && dist({x:x,y:y},player)>=2 && dist({x:x,y:y},player)<=4) shadows.push({x:x,y:y}); }
        if(shadows.length){ var s2=pick(shadows); sparkleFx(e.x,e.y,'dark',24); e.x=s2.x; e.y=s2.y; e._lx=undefined; e.tpCd=3; log('The <b>Night Warden</b> steps through the shadows.','c-info'); e.t+=actCost(e); return; }
      }
    }
    if(b.brands){
      e.brandCd=(e.brandCd||0)-1;
      if(e.brand && turn>=e.brand.at){
        var dmg=Math.min(Math.round(e.brand.stored), Math.round(player.maxhp*0.4)); var los=canSeePlayer(e); e.brand=null;
        if(los && dmg>0){ var bd=applyDamage(player, dmg, 'light', e); floatText(player.x,player.y,String(bd),'light'); log('<b>Judgment!</b> The brand burns you for the harm you dealt: '+bd+'.','c-you'); if(player.hp<=0) kill(player,e); }
        else log('You broke the '+e.name+'\'s line of sight: the brand fades harmlessly.','c-good');
        e.t+=actCost(e); return;
      }
      if(!e.brand && e.brandCd<=0 && see){ e.brand={at:turn+3, stored:0}; e.brandCd=7; setClip(e,'attack'); log('The <b>'+e.name+'</b> brands you with judgment. The next 3 turns of harm you deal it will return to you, unless you break its line of sight.','c-you'); e.t+=actCost(e); return; }
    }
  }
  if(b.still){
    if(e.state!=='hunt'){ if(see && d<=6){ e.state='hunt'; log('<b>'+e.name+'</b> wakes with a rumble.','c-you'); SHAKE=6; } e.t+=actCost(e); return; }
    if(heartTouching(e)){ attack(e,player); }
    e.t+=actCost(e); return;
  }
  return _aiActPlane(e);
};
/* the Stalker is unseen until it is next to you; a burrowed Burrower is unseen too */
/* creatures that are out of sight (a lurking Stalker, a burrowed Burrower, the limbs of a big elite) are simply not
   drawn. They used to be hidden by clearing their tile's visibility, which also unlit the tile and left a black square. */
var _drawCharacterPlane = drawCharacter;
drawCharacter = function(e, px, py, opts){
  if(e && e!==player && !revealAll && floorMeta && floorMeta.plane){
    var b=e.base||{};
    if((b.lurks && dist(e,player)>1) || (b.burrows && e.burrowed) || e.parent) return true;   /* nothing drawn, tile still lit */
  }
  return _drawCharacterPlane(e, px, py, opts);
};

/* ---------------------------------------------------------------- 2x2: the Heart of the Mountain */
function setupHeart(h){
  /* the main body sits on its top-left tile; three hollow limbs fill the rest and pass any damage to it */
  h.size=2;
  [[1,0],[0,1],[1,1]].forEach(function(o){
    var x=h.x+o[0], y=h.y+o[1];
    if(!inb(x,y)) return;
    if(!walkable(x,y)) setT(x,y,FLOOR);
    var p=propAt(x,y); if(p) removeProp(p);
    var limb=spawn('crystalnode', x, y); limb.parent=h; limb.name=h.name; limb.noXp=true; limb.state='hunt'; limb.hp=limb.maxhp=9999;
  });
  /* its crystal nodes around the chamber */
  floorMeta.heartNodes=[];
  for(var i=0;i<3;i++){
    var c=nearFree(h.x+ri(-5,5), h.y+ri(-4,4), 3); if(!c) continue;
    var n=spawn('crystalnode', c.x, c.y); n.state='hunt'; floorMeta.heartNodes.push(n.id);
  }
}
function heartTouching(h){ return [[0,0],[1,0],[0,1],[1,1]].some(function(o){ return Math.max(Math.abs(h.x+o[0]-player.x), Math.abs(h.y+o[1]-player.y))<=1; }); }
var _killPlane = kill;
kill = function(e, by){
  if(e && e.parent){ return; }
  if(e && e.base && e.base.big){ ents=ents.filter(function(o){ return o.parent!==e; }); }
  if(e && e.base && e.base.shatters && ents.indexOf(e)>=0){
    ents.forEach(function(o){ if(o!==e && dist(o,e)<=1 && (o===player || !o.foe)){ var sd=applyDamage(o, 6, 'phys', null); floatText(o.x,o.y,String(sd),'phys'); if(o===player) log('Crystal shards fly: '+sd+'.','c-you'); } });
    burst(e.x,e.y,'earth',30,0.08);
  }
  if(e && e.kind==='crystalnode' && (floorMeta.heartNodes||[]).indexOf(e.id)>=0){
    var left=(floorMeta.heartNodes||[]).filter(function(id){ return id!==e.id && ents.some(function(o){ return o.id===id && o.hp>0; }); }).length;
    log(left ? 'A crystal node shatters. '+left+' left.' : '<b>The last crystal node shatters!</b> The Heart of the Mountain is exposed.','c-kill');
  }
  if(e && e.elite && floorMeta && floorMeta.plane && e.id===floorMeta.eliteId){ floorMeta.eliteDead=true; setTimeout(function(){ log('The guardian of '+PLANE_TITLE[floorMeta.plane]+' falls. The treasure grotto lies open.','c-kill'); }, 0); }
  return _killPlane(e, by);
};
/* TODO(2x2 art): the Heart is still drawn on one tile; draw it across all four when its final sprite exists */
