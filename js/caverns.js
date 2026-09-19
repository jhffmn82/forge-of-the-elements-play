/* =====================================================================
   caverns.js - biome 3, the Caverns (floors 11-15), 2026-09-19. See DESIGN.md section 6.
   - Layout: cellular-automata chambers joined by narrow meandering tunnels (the chokepoints), instead of BSP rooms.
     Each chamber is a "cave room": rooms[] keeps its bounding box for the shared code, and floorMeta.caveRoom says
     which cells really belong to it, so roomAt / edgeCells / interiorCells follow the rock instead of the box.
   - Chasms: a rift splits a chamber from wall to wall and is crossed by a rope bridge (BRIDGE tiles); some chambers
     have a pit to walk around. Everything walkable is checked reachable from the start, or the chasm is undone.
   - Scenery: small walkable clusters, a few tall pieces per chamber, floor decals and wall features (drawn by
     js/cavernrender.js), glowing mushrooms, crystals and pools as the light.
   - Floor 15: a big open arena with 3-5 closed worm burrows for the Deep Maw (the creature agent's spawnDeepMaw).
     Killing the boss there wins the run.
   ===================================================================== */

function inCaverns(){ return typeof floorNo!=='undefined' && bidx()===2 && !(floorMeta && floorMeta.plane); }

/* ---------------------------------------------------------------- the pieces (art in art/map/biome3, map-cave.png)
   w,h: footprint in tiles; b: blocks; flat: lies on the floor (walkable); light/dim: a light source */
var CAVE_PIECES = {
  'stalagmite-tall-1':{b:1}, 'stalagmite-tall-2':{b:1}, 'stalagmite-tall-3':{b:1},
  'stalagmite-group-1':{b:1, w:2}, 'stalagmite-group-2':{b:1, w:2},
  'giant-mushroom-1':{b:1, light:'#4FE0D0'}, 'giant-mushroom-2':{b:1, light:'#A070FF'}, 'giant-mushroom-3':{b:1, light:'#FFB050'},
  'mushroom-pair-1':{b:1, w:2, light:'#E8C070'}, 'mushroom-pair-2':{b:1, w:2, light:'#60E0D0'},
  'geode-1':{b:1, w:2, light:'#40D0E0', dim:1}, 'geode-2':{b:1, w:2, light:'#9A70FF', dim:1},
  'pylon-1':{b:1, light:'#B090FF'}, 'pylon-2':{b:1, light:'#9FE8FF'},
  'glowing-pool-1':{b:1, w:2, h:2, light:'#5A7CFF'}, 'glowing-pool-2':{b:1, w:2, h:2, light:'#40E0D0'},
  'mine-cart':{b:1, br:1, loot:0.35, sfx:'crate-break'}, 'mine-support':{b:1, w:2},
  'worm-burrow-closed':{b:1, w:2, h:2}, 'worm-burrow-open':{b:1, w:2, h:2},
  'kobold-campfire':{b:1, light:'#FF9A40'}, 'kobold-crate':{b:1, br:1, burn:1, loot:0.40, sfx:'crate-break'},
  'kobold-bedroll-1':{flat:1, burn:1}, 'kobold-bedroll-2':{flat:1, burn:1}, 'kobold-pickaxe':{flat:1}
};
(function(){
  var clLight = {'small-mushrooms':['#70D0C0','#A080F0','#FFB060','#80D8B8'], 'glow-moss':['#50D8B0','#50D8B0','#50D8B0','#50D8B0'],
                 'crystal-shards':['#60D8F0','#A070F0','#60D0F0','#9080F0']};
  ['small-mushrooms','glow-moss','crystal-shards','rubble','lost-miner','cave-pearls'].forEach(function(k){
    for(var v=1; v<=4; v++){ var d={flat:1, cluster:1}; if(clLight[k]){ d.light=clLight[k][v-1]; d.dim=1; } CAVE_PIECES['cl-'+k+'-'+v]=d; }
  });
  for(var n in CAVE_PIECES){ var d=CAVE_PIECES[n], p={cave:1}; for(var f in d) if(f!=='w' && f!=='h') p[f]=d[f]; PROPS[n]=p; }
})();
function cavePiece(name){ return CAVE_PIECES[name] || null; }
function caveVariant(base, n){ return base+'-'+(1+Math.floor(rng()*n)); }

/* the shared room builders ask for dungeon furniture: the Caverns answer with their own */
var CAVE_PROP = {
  'torch-stand':['giant-mushroom-1','giant-mushroom-2','giant-mushroom-3','pylon-1','pylon-2'],
  'brazier-lit':['kobold-campfire'], 'brazier-unlit':['kobold-campfire'], 'table-candle':['cl-crystal-shards-1','cl-crystal-shards-3'],
  'barrel':['kobold-crate'], 'crate':['kobold-crate'], 'crate-supply':['kobold-crate'], 'pot':['kobold-crate'],
  'bookshelf':['stalagmite-tall-1','stalagmite-tall-2','stalagmite-tall-3'], 'statue':['stalagmite-tall-1','stalagmite-tall-2','stalagmite-tall-3'],
  'statue-broken':['stalagmite-tall-3'], 'banner-stand':['stalagmite-tall-2'], 'weapon-rack':['mine-cart'], 'cart':['mine-cart'], 'alchemy-table':['mine-cart'],
  'bed-straw':['cl-rubble-1','cl-rubble-2'], 'rubble':['cl-rubble-1','cl-rubble-2','cl-rubble-3','cl-rubble-4'],
  'bones':['cl-lost-miner-1','cl-lost-miner-2','cl-lost-miner-3','cl-rubble-2'], 'chains':['cl-rubble-3','cl-rubble-4'],
  'mushrooms':['cl-small-mushrooms-1','cl-small-mushrooms-2','cl-small-mushrooms-3','cl-small-mushrooms-4'],
  'vines':['cl-glow-moss-1','cl-glow-moss-2','cl-glow-moss-3','cl-glow-moss-4']
};
var _addPropCave = addProp;
addProp = function(x, y, name, extra){
  if(inCaverns() && CAVE_PROP[name] && !(extra && (extra.keep || extra.tablet || extra.lever || extra.prisoner))) name=pick(CAVE_PROP[name]);
  return _addPropCave(x, y, name, extra);
};

/* ---------------------------------------------------------------- the monsters
   2026-09-19: rollMonster (world.js) read every monster's band as an absolute floor and ignored the biome, so
   game.js's rosterFor() convention (band = floor WITHIN the biome, biome = which biomes) never applied. A monster
   with a biome list now appears only in those biomes, its band read inside the biome (rosterFor's rule); monsters
   with no biome list keep the old absolute bands, so biomes 1 and 2 roll exactly as before.
   The three biome-1 creatures game.js had placed in the Caverns too (rat, bat, rock slime) are tagged again, so
   floors 11-14 are populated before the Caverns bestiary lands. (rosterFor itself throws on a monster without a
   biome list, so the same rule is written out here.) */
/* 2026-09-19 (merge): the Caverns have their own bat and slime now (js/cavernmobs.js), and Dungeon rats in packs
   swamped floors 11-13, so the biome-1 three stay in biome 1. */
(function(){ ['rat','bat','slime'].forEach(function(k){ if(MONSTERS[k] && !MONSTERS[k].biome) MONSTERS[k].biome=[0]; }); })();
function caveRoster(){
  var bi=bidx(), bf=bfloor(), out=[];
  for(var k in MONSTERS){
    var b=MONSTERS[k]; if(b.rare || !b.w || !b.band) continue;
    if(b.biome){
      if(b.biome.indexOf(bi)<0) continue;
      var within=b.band[1]<=5;                            /* 1-5: floors inside the biome; larger: absolute floors */
      if(within ? (bf<b.band[0] || bf>b.band[1]) : (floorNo<b.band[0] || floorNo>b.band[1])) continue;
    } else if(floorNo<b.band[0] || floorNo>b.band[1]) continue;
    out.push([k, b.w]);
  }
  return out;
}
var _rollMonsterCave = rollMonster;
rollMonster = function(){
  var pool=caveRoster(); if(!pool.length) return _rollMonsterCave();
  var tot=0, i; for(i=0;i<pool.length;i++) tot+=pool[i][1];
  var r=rng()*tot; for(i=0;i<pool.length;i++){ r-=pool[i][1]; if(r<=0) return pool[i][0]; }
  return pool[pool.length-1][0];
};
/* barracks, dark rooms and vault guards ask for goblins: in the Caverns they get whatever lives here */
var CAVE_NOSWAP=false;
var _spawnCave = spawn;
spawn = function(kind, x, y){
  if(inCaverns() && !CAVE_NOSWAP && /^(goblin|archer|brute|shaman)$/.test(kind)){
    var pool=caveRoster().filter(function(p){ return !MONSTERS[p[0]].boss; });
    if(pool.length) kind = kind==='brute' ? pool.slice().sort(function(a,b){ return MONSTERS[b[0]].hp-MONSTERS[a[0]].hp; })[0][0] : pool[Math.floor(rng()*pool.length)][0];
  }
  return _spawnCave(kind, x, y);
};

/* ---------------------------------------------------------------- noise and small helpers */
function caveNoise(wx, wy, s){
  var x0=Math.floor(wx), y0=Math.floor(wy), fx=wx-x0, fy=wy-y0; fx=fx*fx*(3-2*fx); fy=fy*fy*(3-2*fy);
  var a=hash2(x0,y0,s), b=hash2(x0+1,y0,s), c=hash2(x0,y0+1,s), d=hash2(x0+1,y0+1,s);
  return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy;
}
function caveOpen(t){ return t===FLOOR || t===BRIDGE || t===WATER; }
/* every walkable-ground cell reachable from (sx,sy), four ways, over floor, water and bridges */
function caveReach(sx, sy){
  var d=new Uint8Array(MW*MH), q=[idxOf(sx,sy)]; d[q[0]]=1;
  for(var h=0; h<q.length; h++){
    var i=q[h], x=i%MW, y=(i/MW)|0;
    if(x>0 && !d[i-1] && caveOpen(map[i-1])){ d[i-1]=1; q.push(i-1); }
    if(x<MW-1 && !d[i+1] && caveOpen(map[i+1])){ d[i+1]=1; q.push(i+1); }
    if(y>0 && !d[i-MW] && caveOpen(map[i-MW])){ d[i-MW]=1; q.push(i-MW); }
    if(y<MH-1 && !d[i+MW] && caveOpen(map[i+MW])){ d[i+MW]=1; q.push(i+MW); }
  }
  return d;
}
function caveUnreached(sx, sy){ var d=caveReach(sx,sy); for(var i=0;i<map.length;i++) if(caveOpen(map[i]) && !d[i]) return true; return false; }

/* ---------------------------------------------------------------- layout: chambers, cellular automata, tunnels */
function cavePlan(boss){
  var ch=[], i;
  if(boss){
    ch.push({x:ri(5,7), y:ri(9,MH-10), rx:3, ry:3});
    ch.push({x:ri(15,19), y:ri(7,10), rx:ri(3,4), ry:ri(2,3)});
    ch.push({x:ri(15,20), y:ri(23,26), rx:ri(3,4), ry:ri(2,3)});
    ch.push({x:MW-16, y:MH>>1, rx:12, ry:9, arena:true});     /* the Deep Maw's hall: about 24 x 18 of open ground */
    return ch;
  }
  var want=ri(7,9);
  for(var t=0; t<600 && ch.length<want; t++){
    var big=rng()<0.22, c={rx: big ? ri(7,9) : ri(4,7), ry: big ? ri(5,6) : ri(3,4)};
    c.x=ri(2+c.rx, MW-3-c.rx); c.y=ri(2+c.ry, MH-3-c.ry);
    var ok=true;
    for(i=0;i<ch.length && ok;i++){ var o=ch[i], dx=(c.x-o.x)/(c.rx+o.rx+2), dy=(c.y-o.y)/(c.ry+o.ry+2); if(dx*dx+dy*dy<1) ok=false; }
    if(ok) ch.push(c);
  }
  if(ch.length<5) return null;
  ch.sort(function(a,b){ return a.x-b.x; });
  if(rng()<0.5) ch.reverse();                                  /* the start is at one end, the stairs usually at the other */
  return ch;
}
function caveTunnel(grid, a, b, wide){
  var x=a.x, y=a.y, guard=0;
  function dig(cx, cy){
    for(var oy=0; oy<(wide?2:1); oy++) for(var ox=0; ox<(wide?2:1); ox++){
      var xx=cx+ox, yy=cy+oy; if(xx>=1 && yy>=1 && xx<MW-1 && yy<MH-1) grid[idxOf(xx,yy)]=1;
    }
  }
  dig(x,y);
  while((x!==b.x || y!==b.y) && guard++<500){
    var dx=b.x-x, dy=b.y-y;
    if(rng()<0.22){                                          /* a sideways wander so tunnels never run ruler-straight */
      if(Math.abs(dx)>=Math.abs(dy)) y+= rng()<0.5?-1:1; else x+= rng()<0.5?-1:1;
    } else if(dx && (!dy || rng()<Math.abs(dx)/(Math.abs(dx)+Math.abs(dy)))) x+=dx>0?1:-1;
    else y+=dy>0?1:-1;
    x=Math.max(1, Math.min(MW-2, x)); y=Math.max(1, Math.min(MH-2, y));
    dig(x,y);
  }
}
function caveLayout(){
  if(bidx()!==2) return false;
  for(var t=0; t<14; t++){ if(caveTry()){ caveDecorate(); return true; } }
  return false;                                               /* never: the BSP rooms take over rather than no floor */
}
function caveTry(){
  var boss=!!floorMeta.boss, i, x, y, k;
  map.fill(WALL); rooms=[];
  var ch=cavePlan(boss); if(!ch) return false;
  var salt=Math.floor(rng()*1e6), N=MW*MH;
  var E=new Float32Array(N).fill(99), own=new Int16Array(N).fill(-1);
  for(y=1;y<MH-1;y++) for(x=1;x<MW-1;x++){
    i=idxOf(x,y);
    var wob=(caveNoise(x*0.3, y*0.3, salt)-0.5)*0.55;
    for(k=0;k<ch.length;k++){ var c=ch[k], dx=(x-c.x)/c.rx, dy=(y-c.y)/c.ry, d=Math.sqrt(dx*dx+dy*dy)+wob; if(d<E[i]){ E[i]=d; own[i]=k; } }
  }
  function core(i2){ return own[i2]>=0 && ch[own[i2]].arena ? 0.78 : 0.6; }
  var g=new Uint8Array(N);
  for(i=0;i<N;i++){ x=i%MW; y=(i/MW)|0; if(x<1||y<1||x>MW-2||y>MH-2) continue; g[i] = E[i]<core(i) ? 1 : E[i]<1.2 ? (rng()<0.66?1:0) : 0; }
  /* four rounds of the 4-5 rule: rock where five or more of the nine cells are rock */
  for(var pass=0; pass<4; pass++){
    var n2=new Uint8Array(N);
    for(y=1;y<MH-1;y++) for(x=1;x<MW-1;x++){
      i=idxOf(x,y); var walls=0;
      for(var oy=-1;oy<=1;oy++) for(var ox=-1;ox<=1;ox++) if(!g[i+oy*MW+ox]) walls++;
      n2[i] = walls>=5 ? 0 : 1;
      if(E[i]<core(i)*0.8) n2[i]=1;
      if(E[i]>1.5) n2[i]=0;
    }
    g=n2;
  }
  /* each chamber's anchor: its open cell nearest the centre */
  var anchors=[];
  for(k=0;k<ch.length;k++){
    var c2=ch[k], best=null, bd=1e9;
    for(y=Math.max(1,c2.y-3); y<=Math.min(MH-2,c2.y+3); y++) for(x=Math.max(1,c2.x-3); x<=Math.min(MW-2,c2.x+3); x++){
      if(!g[idxOf(x,y)]) continue; var dd=Math.abs(x-c2.x)+Math.abs(y-c2.y); if(dd<bd){ bd=dd; best={x:x,y:y}; }
    }
    if(!best){ best={x:c2.x, y:c2.y}; for(var oy2=-1;oy2<=1;oy2++) for(var ox2=-1;ox2<=1;ox2++) g[idxOf(c2.x+ox2,c2.y+oy2)]=1; }
    anchors.push(best);
  }
  /* tunnels: a spanning tree over the chambers plus a loop or two, mostly one tile wide (the chokepoints) */
  var inTree=[0], edges=[];
  while(inTree.length<ch.length){
    var bA=-1, bB=-1, bD=1e9;
    for(var a=0;a<inTree.length;a++) for(var b=0;b<ch.length;b++){
      if(inTree.indexOf(b)>=0) continue; var ia=inTree[a], d2=Math.hypot(ch[ia].x-ch[b].x, (ch[ia].y-ch[b].y)*1.3);
      if(boss && ch[b].arena && ch[ia].x<10) d2+=100;         /* the start never opens straight onto the arena */
      if(d2<bD){ bD=d2; bA=ia; bB=b; }
    }
    edges.push([bA,bB]); inTree.push(bB);
  }
  var loops = boss ? 1 : ri(1,2);
  for(var l=0; l<loops*6 && loops>0; l++){
    var p=Math.floor(rng()*ch.length), q=Math.floor(rng()*ch.length);
    if(p===q || edges.some(function(e){ return (e[0]===p&&e[1]===q)||(e[0]===q&&e[1]===p); })) continue;
    if(boss && (ch[p].arena||ch[q].arena) && (p===0||q===0)) continue;
    if(Math.hypot(ch[p].x-ch[q].x, ch[p].y-ch[q].y) > 30) continue;
    edges.push([p,q]); loops--;
  }
  edges.forEach(function(e){ caveTunnel(g, anchors[e[0]], anchors[e[1]], rng()<0.3); });
  /* whatever the start cannot reach goes back to rock */
  for(i=0;i<N;i++) map[i]= g[i] ? FLOOR : WALL;
  var reach=caveReach(anchors[0].x, anchors[0].y);
  for(i=0;i<N;i++) if(map[i]===FLOOR && !reach[i]) map[i]=WALL;
  var open=0; for(i=0;i<N;i++) if(map[i]===FLOOR) open++;
  if(open < (boss ? 400 : 480)) return false;
  /* chambers: the cells inside each one's wobbly ellipse; tunnel cells belong to none */
  var G=new Int16Array(N).fill(-1), cnt=new Int32Array(ch.length);
  for(i=0;i<N;i++) if(map[i]===FLOOR && own[i]>=0 && E[i]<1.3){ G[i]=own[i]; cnt[own[i]]++; }
  var keep=[]; for(k=0;k<ch.length;k++) keep.push(cnt[k]>=12 && reach[idxOf(anchors[k].x, anchors[k].y)]);
  if(!keep[0]) return false;
  if(boss && !keep[ch.length-1]) return false;
  var idMap={}, nid=0; for(k=0;k<ch.length;k++) if(keep[k]) idMap[k]=nid++;
  for(i=0;i<N;i++) if(G[i]>=0) G[i] = keep[G[i]] ? idMap[G[i]] : -1;
  if(nid < (boss ? 4 : 5)) return false;
  floorMeta.caveRoom=G;
  floorMeta.planeLights=floorMeta.planeLights||[];
  for(k=0;k<ch.length;k++){ if(!keep[k]) continue; var r={id:idMap[k], cave:true}; if(ch[k].arena) r.arena=true; rooms.push(r); }
  caveRoomBoxes();
  /* chasms: a rift with a bridge on most floors, sometimes a pit to walk round (never in the boss arena) */
  var start=rooms[0];
  var riftRooms=shuffled(rooms.filter(function(r){ return r!==start && !r.arena && r.n>=36; }));
  if(!boss && rng()<0.85){ for(var ri2=0; ri2<riftRooms.length; ri2++){ if(caveRift(riftRooms[ri2], start)){ riftRooms[ri2].rift=true; floorMeta.caveRift=true; break; } } }
  var pitRooms=shuffled(rooms.filter(function(r){ return r!==start && !r.arena && !r.rift && r.n>=40; }));
  if(pitRooms.length && rng()<(boss ? 0.5 : 0.45)) caveVoidPit(pitRooms[0], start);
  caveRoomBoxes();
  if(caveUnreached(start.cx, start.cy)) return false;
  if(floorMeta.caveRift) floorMeta.notes.push('A chasm splits the caverns. Rope bridges cross it; the drop does not forgive.');
  return true;
}
/* bounding boxes and centres from the cell map (a centre is the cell deepest inside its chamber, never chasm) */
function caveRoomBoxes(){
  var G=floorMeta.caveRoom, N=MW*MH, i, depth=new Int16Array(N).fill(-1), q=[];
  rooms.forEach(function(r){ if(!r.cave) return; r.x=MW; r.y=MH; r.w=0; r.h=0; r.n=0; r._x1=0; r._y1=0; });
  var byId={}; rooms.forEach(function(r){ if(r.cave) byId[r.id]=r; });
  for(i=0;i<N;i++){
    var r=byId[G[i]]; if(!r) continue; var x=i%MW, y=(i/MW)|0;
    if(x<r.x) r.x=x; if(y<r.y) r.y=y; if(x>r._x1) r._x1=x; if(y>r._y1) r._y1=y;
    if(map[i]===FLOOR) r.n++;
  }
  rooms.forEach(function(r){ if(!r.cave) return; r.w=r._x1-r.x+1; r.h=r._y1-r.y+1; delete r._x1; delete r._y1; });
  /* depth: steps from the nearest cell that is not this chamber's floor */
  for(i=0;i<N;i++){ if(G[i]>=0 && map[i]===FLOOR){ var x2=i%MW, y2=(i/MW)|0, edge=false;
      for(var oy=-1;oy<=1 && !edge;oy++) for(var ox=-1;ox<=1;ox++){ var j=idxOf(x2+ox,y2+oy); if(!inb(x2+ox,y2+oy) || G[j]!==G[i] || map[j]!==FLOOR){ edge=true; break; } }
      if(edge){ depth[i]=0; q.push(i); } } }
  for(var h=0; h<q.length; h++){
    var c=q[h], cx=c%MW, cy=(c/MW)|0;
    for(var oy2=-1;oy2<=1;oy2++) for(var ox2=-1;ox2<=1;ox2++){
      if(!inb(cx+ox2,cy+oy2)) continue; var n=idxOf(cx+ox2,cy+oy2);
      if(depth[n]<0 && G[n]===G[c] && map[n]===FLOOR){ depth[n]=depth[c]+1; q.push(n); }
    }
  }
  rooms.forEach(function(r){
    if(!r.cave) return;
    var best=-1, bi=-1, mx=r.x+r.w/2, my=r.y+r.h/2;
    for(var y=r.y;y<r.y+r.h;y++) for(var x=r.x;x<r.x+r.w;x++){
      var k=idxOf(x,y); if(G[k]!==r.id || map[k]!==FLOOR) continue;
      var sc=depth[k]*10 - Math.abs(x-mx) - Math.abs(y-my);
      if(sc>best){ best=sc; bi=k; }
    }
    if(bi>=0){ r.cx=bi%MW; r.cy=(bi/MW)|0; }
  });
}
function caveRoomCells(r){
  var out=[], G=floorMeta.caveRoom; if(!G) return out;
  for(var y=r.y;y<r.y+r.h;y++) for(var x=r.x;x<r.x+r.w;x++) if(G[idxOf(x,y)]===r.id) out.push({x:x,y:y});
  return out;
}

/* ---------------------------------------------------------------- chasms */
/* a rift two or three tiles wide runs across a chamber until it meets rock at both ends, wandering a little;
   a rope bridge crosses it near the middle (and a second one on a long rift). Undone if anything is cut off. */
function caveRift(room, start){
  var vert = room.w>=9 && (room.h<9 || rng()<0.75);
  if(!vert && room.h<9) return false;
  var w=ri(2,3), along0 = vert ? room.cy : room.cx, cross0 = (vert ? room.cx : room.cy) + ri(-2,2) - (w>>1);
  function C(a, b){ return vert ? {x:b, y:a} : {x:a, y:b}; }
  var rows=[];
  [1,-1].forEach(function(dir){
    var a=along0 + (dir<0 ? -1 : 0), b=cross0, n=0;
    while(n++<16){
      var all=true, ok=true;
      for(var k=0;k<w;k++){ var p=C(a,b+k); if(p.x<2 || p.y<2 || p.x>MW-3 || p.y>MH-3){ ok=false; break; } if(at(p.x,p.y)!==WALL) all=false; }
      if(!ok || all) break;
      rows.push({a:a, b:b});
      a+=dir; if(rng()<0.4){ var nb=b+(rng()<0.5?-1:1); if(Math.abs(nb-cross0)<=2) b=nb; }
    }
  });
  if(rows.length<5) return false;
  var saved=[];
  function set(p, t){ var i=idxOf(p.x,p.y); saved.push([i, map[i]]); map[i]=t; }
  function undo(){ for(var s=saved.length-1;s>=0;s--) map[saved[s][0]]=saved[s][1]; }
  rows.forEach(function(r){ for(var k=0;k<w;k++){ var p=C(r.a, r.b+k); if(at(p.x,p.y)===FLOOR) set(p, CHASM); } });
  /* a bridge row: every cell of the row is chasm and there is solid floor at both ends */
  var cands=rows.filter(function(r){
    for(var k=0;k<w;k++){ var p=C(r.a,r.b+k); if(at(p.x,p.y)!==CHASM) return false; }
    var e1=C(r.a, r.b-1), e2=C(r.a, r.b+w); return at(e1.x,e1.y)===FLOOR && at(e2.x,e2.y)===FLOOR;
  }).sort(function(p,q){ return Math.abs(p.a-along0)-Math.abs(q.a-along0); });
  if(!cands.length){ undo(); return false; }
  function bridge(r){ r.bridged=true; for(var k=0;k<w;k++) set(C(r.a,r.b+k), BRIDGE); }
  bridge(cands[0]);
  var far=cands.filter(function(r){ return Math.abs(r.a-cands[0].a)>=6; });
  if(far.length && rows.length>=11 && rng()<0.5) bridge(far[far.length-1]);
  /* anything the rift cut off gets a bridge of its own, or the rift is undone */
  for(var guard=0; guard<4; guard++){
    var d=caveReach(start.cx, start.cy), cut=false, i;
    for(i=0;i<map.length;i++) if(caveOpen(map[i]) && !d[i]){ cut=true; break; }
    if(!cut) return true;
    var fix=cands.filter(function(r){ if(r.bridged) return false; var e1=C(r.a,r.b-1), e2=C(r.a,r.b+w); return !!d[idxOf(e1.x,e1.y)] !== !!d[idxOf(e2.x,e2.y)]; })[0];
    if(!fix) break;
    bridge(fix);
  }
  undo(); return false;
}
/* a pit in the middle of a chamber: open ground all round it, so it is walked round, not crossed */
function caveVoidPit(room, start){
  var G=floorMeta.caveRoom;
  function solid(x,y){ for(var oy=-1;oy<=1;oy++) for(var ox=-1;ox<=1;ox++){ var t=at(x+ox,y+oy); if(t!==FLOOR || G[idxOf(x+ox,y+oy)]!==room.id) return false; } return true; }
  var cells=caveRoomCells(room).filter(function(c){ return solid(c.x,c.y) && Math.abs(c.x-room.cx)+Math.abs(c.y-room.cy)>=2; });
  if(cells.length<6) return false;
  var c=pick(cells), saved=[];
  blob(c.x, c.y, ri(4,8), function(x,y){ if(at(x,y)===FLOOR && solid(x,y)){ saved.push(idxOf(x,y)); setT(x,y,CHASM); } });
  if(saved.length<3 || caveUnreached(start.cx, start.cy)){ saved.forEach(function(i){ map[i]=FLOOR; }); return false; }
  room.pit=true; return true;
}

/* ---------------------------------------------------------------- the shared room code, told about caves */
var _roomAtCave = roomAt;
roomAt = function(x, y){
  var G=floorMeta && floorMeta.caveRoom;
  if(!G || G.length!==MW*MH) return _roomAtCave(x, y);
  if(x>=0 && y>=0 && x<MW && y<MH){
    var k=G[y*MW+x];
    if(k>=0) for(var i=0;i<rooms.length;i++){ var r=rooms[i]; if(r.cave && r.id===k) return r; }
  }
  for(var j=0;j<rooms.length;j++){ var q=rooms[j]; if(!q.cave && x>=q.x && x<q.x+q.w && y>=q.y && y<q.y+q.h) return q; }   /* vaults and puzzle pockets */
  return null;
};
function caveWallAt(x,y){ return isWallLike(at(x,y)); }
var _edgeCellsCave = edgeCells;
edgeCells = function(r){
  if(!r || !r.cave) return _edgeCellsCave(r);
  return caveRoomCells(r).filter(function(c){
    var x=c.x, y=c.y;
    if(at(x,y)!==FLOOR || propAt(x,y) || nearDoor(x,y) || (x===r.cx && y===r.cy)) return false;
    return caveWallAt(x-1,y) || caveWallAt(x+1,y) || caveWallAt(x,y-1) || caveWallAt(x,y+1);
  });
};
var _interiorCellsCave = interiorCells;
interiorCells = function(r){
  if(!r || !r.cave) return _interiorCellsCave(r);
  return caveRoomCells(r).filter(function(c){
    var x=c.x, y=c.y;
    if(at(x,y)!==FLOOR || propAt(x,y) || (x===r.cx && y===r.cy)) return false;
    return !(caveWallAt(x-1,y) || caveWallAt(x+1,y) || caveWallAt(x,y-1) || caveWallAt(x,y+1));
  });
};
/* stairs stand in the chamber itself: no dead-end hallway cut straight through the rock */
var _carveDeadEndCave = carveDeadEnd;
carveDeadEnd = function(room){ if(room && room.cave) return null; return _carveDeadEndCave(room); };

/* ---------------------------------------------------------------- scenery */
function caveFree(x, y){ return at(x,y)===FLOOR && !propAt(x,y) && !itemAt(x,y); }
function caveFootFree(x, y, w, h, room){
  var G=floorMeta.caveRoom;
  for(var yy=y; yy<y+h; yy++) for(var xx=x; xx<x+w; xx++){
    if(!caveFree(xx,yy) || nearDoor(xx,yy) || (room && G[idxOf(xx,yy)]!==room.id) || (room && xx===room.cx && yy===room.cy)) return false;
  }
  return true;
}
/* a tall or wide piece stands against the rock (the tiles above its footprint are wall), leaving the middle open */
function caveTallSpot(room, w, h){
  var cells=shuffled(caveRoomCells(room));
  for(var i=0;i<cells.length;i++){
    var c=cells[i];
    if(!caveFootFree(c.x, c.y, w, h, room)) continue;
    var backed=false; for(var xx=c.x; xx<c.x+w; xx++) if(caveWallAt(xx, c.y-1)) backed=true;
    if(!backed && !(caveWallAt(c.x-1,c.y) || caveWallAt(c.x+w,c.y))) continue;
    /* keep the ground in front clear: never plug a passage */
    var front=0; for(var fx=c.x-1; fx<=c.x+w; fx++) if(at(fx, c.y+h)===FLOOR) front++;
    if(front<w+1) continue;
    return c;
  }
  return null;
}
function cavePlace(x, y, name){
  var d=CAVE_PIECES[name]||{}, w=d.w||1, h=d.h||1;
  if(w>1 || h>1) return addSetPiece(x, y, name, w, h, {keep:false, cave:1});
  return addProp(x, y, name);
}
var CAVE_TALL = [['stalagmite-tall',3,3], ['giant-mushroom',3,2.2], ['pylon',2,1], ['stalagmite-group',2,1.2], ['geode',2,0.9], ['mushroom-pair',2,1], ['mine-cart',0,0.6], ['mine-support',0,0.4]];
function caveTallPiece(room){
  var tot=CAVE_TALL.reduce(function(a,t){ return a+t[2]; },0), r=rng()*tot, t=CAVE_TALL[0];
  for(var i=0;i<CAVE_TALL.length;i++){ r-=CAVE_TALL[i][2]; if(r<=0){ t=CAVE_TALL[i]; break; } }
  var name = t[1] ? caveVariant(t[0], t[1]) : t[0], d=CAVE_PIECES[name];
  var s=caveTallSpot(room, d.w||1, d.h||1);
  return s ? cavePlace(s.x, s.y, name) : null;
}
/* the per-floor pass while laying out: decals, wall features, a waterfall, walkable clusters */
function caveDecorate(){
  var salt=Math.floor(rng()*1e6), deco={decals:[], walls:[]}, x, y, i;
  floorMeta.caveDeco=deco;
  /* 2026-09-19: no lichen or spore-drift: stamped a tile at a time they read as stray snowflakes */
  var DEC=[['dc-puddle',3]];   /* mineral veins also read as single spidery stamps */
  for(y=1;y<MH-1;y++) for(x=1;x<MW-1;x++){
    if(at(x,y)!==FLOOR) continue;
    var n=caveNoise(x*0.28, y*0.28, salt);
    if(n<0.58 || hash2(x,y,salt+3)>0.2) continue;
    var kind=DEC[Math.floor(caveNoise(x*0.12+9, y*0.12, salt+7)*DEC.length*0.999)];
    deco.decals.push({x:x, y:y, n:kind[0]+'-'+(1+Math.floor(hash2(x,y,salt+5)*kind[1]))});
  }
  /* wall features on cliff faces (rock with open ground below), never two side by side */
  var fallDone = rng()>0.5;
  for(y=2;y<MH-2;y++) for(x=2;x<MW-2;x++){
    if(!caveWallAt(x,y) || at(x,y+1)!==FLOOR) continue;
    if(deco.walls.some(function(w){ return Math.abs(w.x-x)<=1 && Math.abs(w.y-y)<=1; })) continue;
    if(!fallDone && at(x,y+2)===FLOOR && at(x-1,y+1)===FLOOR && at(x+1,y+1)===FLOOR && caveWallAt(x-1,y) && caveWallAt(x+1,y) && rng()<0.08){
      /* the waterfall pours into a little pool at its foot */
      fallDone=true; deco.walls.push({x:x, y:y, n:'wf-waterfall-1', fall:true});
      setT(x,y+1,WATER); blob(x, y+2, ri(2,4), function(xx,yy){ if(at(xx,yy)===FLOOR && Math.abs(xx-x)<=2) setT(xx,yy,WATER); });
      floorMeta.planeLights.push({x:x, y:y+1.2, col:'#6FE0F0', r:3.4, s:0.7});
      continue;
    }
    var h=hash2(x,y,salt+11); if(h>0.09) continue;
    var r=hash2(x,y,salt+13), name = r<0.55 ? 'wf-stalactite-drapery-'+(1+Math.floor(hash2(x,y,salt+17)*3)) : r<0.85 ? 'wf-glowworm-curtain-'+(1+Math.floor(hash2(x,y,salt+19)*2)) : 'wf-fossil-'+(1+Math.floor(hash2(x,y,salt+23)*2));
    deco.walls.push({x:x, y:y, n:name});
    if(/glowworm/.test(name)) floorMeta.planeLights.push({x:x, y:y+0.9, col:/-2$/.test(name) ? '#FFC870' : '#7FE8D8', r:2.6, s:0.45});
  }
  /* clusters: a few small groups per chamber, mostly along the walls */
  var CL=[['small-mushrooms',3],['crystal-shards',2],['rubble',3],['cave-pearls',0.6],['lost-miner',0.5]], miners=0;   /* glow moss grows in streaks, below */
  rooms.forEach(function(room){
    if(!room.cave) return;
    var groups = room.arena ? ri(2,4) : Math.min(5, 1 + Math.floor(room.n/28) + (rng()<0.5?1:0));
    var edge=shuffled(caveRoomCells(room).filter(function(c){ return caveFree(c.x,c.y) && (caveWallAt(c.x-1,c.y)||caveWallAt(c.x+1,c.y)||caveWallAt(c.x,c.y-1)||caveWallAt(c.x,c.y+1)); }));
    var inner=shuffled(caveRoomCells(room).filter(function(c){ return caveFree(c.x,c.y); }));
    for(var g=0; g<groups; g++){
      var c=(rng()<0.75 ? edge.pop() : inner.pop()) || edge.pop(); if(!c) break;
      var tot=CL.reduce(function(a,t){ return a+t[1]; },0), rr=rng()*tot, kind=CL[0][0];
      for(var k=0;k<CL.length;k++){ rr-=CL[k][1]; if(rr<=0){ kind=CL[k][0]; break; } }
      if(kind==='lost-miner' && miners++>=1) kind='rubble';
      var n2 = kind==='lost-miner' ? 1 : ri(1,3), px=c.x, py=c.y;
      for(var m=0; m<n2; m++){
        if(caveFree(px,py) && floorMeta.caveRoom[idxOf(px,py)]===room.id) addProp(px, py, caveVariant('cl-'+kind, 4));
        var nb=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1]][Math.floor(rng()*6)]; px+=nb[0]; py+=nb[1];
      }
    }
    /* 2026-09-19: glow moss creeps along the foot of the rock in a streak, now and then - one tuft alone in
       the middle of a chamber read as a stray snowflake */
    if(rng()<0.35){
      var isEdge=function(x,y){ return caveFree(x,y) && floorMeta.caveRoom[idxOf(x,y)]===room.id && (caveWallAt(x-1,y)||caveWallAt(x+1,y)||caveWallAt(x,y-1)||caveWallAt(x,y+1)); };
      var st=edge.pop(), len=ri(3,6), used={};
      for(var q=0; st && q<len; q++){
        addProp(st.x, st.y, caveVariant('cl-glow-moss', 4)); used[st.x+','+st.y]=1;
        var nxt=[[1,0],[-1,0],[0,1],[0,-1]].map(function(d){ return {x:st.x+d[0], y:st.y+d[1]}; })
          .filter(function(c2){ return !used[c2.x+','+c2.y] && isEdge(c2.x,c2.y); });
        st = nxt.length ? nxt[Math.floor(rng()*nxt.length)] : null;
      }
    }
  });
}
/* ordinary chambers: a tall piece or two against the rock, sometimes a kobold camp. Kept sparse: open ground to fight on. */
var _decoratePlainCave = decoratePlain;
decoratePlain = function(r){
  if(!r || !r.cave || !inCaverns()) return _decoratePlainCave(r);
  if(rng()<0.6) caveTallPiece(r);
  if(r.n>=50 && rng()<0.35) caveTallPiece(r);
  if(!floorMeta.koboldCamp && r.role!=='start' && r.n>=30 && rng()<0.35) caveKoboldCamp(r);
  if(!floorMeta.cavePool && r.n>=45 && rng()<0.2){ var s=caveTallSpot(r, 2, 2); if(s){ cavePlace(s.x, s.y, caveVariant('glowing-pool', 2)); floorMeta.cavePool=true; } }
};
function caveKoboldCamp(r){
  var cells=shuffled(interiorCells(r)).filter(function(c){ return caveFootFree(c.x, c.y, 1, 1, r); });
  for(var i=0;i<cells.length;i++){
    var c=cells[i], around=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]].map(function(o){ return {x:c.x+o[0], y:c.y+o[1]}; }).filter(function(p){ return caveFootFree(p.x,p.y,1,1,r); });
    if(around.length<5) continue;
    cavePlace(c.x, c.y, 'kobold-campfire');
    around=shuffled(around);
    /* 2026-09-19: no bedrolls - the art read poorly on the cave floor */
    cavePlace(around[2].x, around[2].y, rng()<0.5 ? 'kobold-crate' : 'kobold-pickaxe');
    floorMeta.koboldCamp={x:c.x, y:c.y};
    return true;
  }
  return false;
}

/* ---------------------------------------------------------------- after the whole floor is built */
var _generateCave = generate;
generate = function(seed){
  _generateCave(seed);
  if(!inCaverns() || !map) return;
  /* no grass underground: the shared patches become moss; standing water glows */
  for(var i=0;i<ground.length;i++){ if(ground[i]===G_GRASS) ground[i]=G_MOSS; else if(ground[i]===G_SHORT) ground[i]=0; }
  floorMeta.planeLights=floorMeta.planeLights||[];
  floorMeta.ptPool={};
  var seenW=new Uint8Array(MW*MH);
  for(var j=0;j<map.length;j++){
    if(map[j]!==WATER) continue;
    floorMeta.ptPool[j]=1;
    if(seenW[j]) continue;
    var q=[j], sx=0, sy=0; seenW[j]=1;
    for(var h=0; h<q.length; h++){ var c=q[h], cx=c%MW, cy=(c/MW)|0; sx+=cx; sy+=cy;
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(o){ var nx=cx+o[0], ny=cy+o[1]; if(!inb(nx,ny)) return; var n=idxOf(nx,ny); if(!seenW[n] && map[n]===WATER){ seenW[n]=1; q.push(n); } }); }
    floorMeta.planeLights.push({x:sx/q.length, y:sy/q.length, col:'#5FE0E0', r:Math.min(5, 2.6+q.length*0.25), s:0.75});
  }
};

/* ---------------------------------------------------------------- floor 15: the Deep Maw's arena
   Interface with the creature agent (agreed 2026-09-19):
     floorMeta.bossArena = {x, y, w, h, mounds:[{x,y}, ...]}   tile coords; each mound is a 2x2 set piece named
                                                             'worm-burrow-closed' with its top-left tile at {x,y}
     spawnDeepMaw(floorMeta.bossArena)                      called once the floor is built, if it is defined
     'worm-burrow-open'                                     the erupted burrow, registered as a set piece (swap p.name)
     caveBossDown()                                         wins the run; also fires by itself when the last living
                                                             monster with base.boss dies on floor 15 */
function buildCaveArena(r){
  r.role='boss';
  var G=floorMeta.caveRoom, mounds=[], centre={x:r.cx, y:r.cy};
  floorMeta.bossAt=centre;
  function spotOK(x, y){
    for(var yy=y-1; yy<=y+2; yy++) for(var xx=x-1; xx<=x+2; xx++){
      if(at(xx,yy)!==FLOOR || G[idxOf(xx,yy)]!==r.id || propAt(xx,yy)) return false;
    }
    if(Math.max(Math.abs(x+0.5-centre.x), Math.abs(y+0.5-centre.y))<3) return false;
    return !mounds.some(function(m){ return Math.max(Math.abs(m.x-x), Math.abs(m.y-y))<5; });
  }
  var want=ri(3,5), cells=shuffled(caveRoomCells(r));
  for(var i=0;i<cells.length && mounds.length<want;i++){
    var c=cells[i]; if(!spotOK(c.x,c.y)) continue;
    if(addSetPiece(c.x, c.y, 'worm-burrow-closed', 2, 2, {keep:true, cave:1, mound:true})) mounds.push({x:c.x, y:c.y});
  }
  floorMeta.bossArena={x:r.x, y:r.y, w:r.w, h:r.h, mounds:mounds};
  decorateEdges(r, ['torch-stand'], 4, true);                 /* glowing mushrooms and crystal pylons round the walls */
  floorMeta.planeLights.push({x:centre.x, y:centre.y, col:'#7A9CB0', r:7, s:0.35});   /* a faint cold light over the hall */
}
var _buildBossRoomCave = buildBossRoom;
buildBossRoom = function(r){ if(inCaverns() && r && r.cave) return buildCaveArena(r); return _buildBossRoomCave(r); };
var _populateCave = populateSpecialMonsters;
populateSpecialMonsters = function(){
  if(!inCaverns() || !floorMeta.boss) return _populateCave();
  var arena=rooms.filter(function(r){ return r.role==='boss'; })[0];
  rooms.forEach(function(r){ if(r.role==='boss') r.role='boss-cave'; });   /* no Warchief and goblin guards here */
  _populateCave();
  if(arena) arena.role='boss';
  if(!floorMeta.bossArena) return;
  if(typeof spawnDeepMaw==='function') spawnDeepMaw(floorMeta.bossArena);
  else caveStandInBoss();
};
/* until the Deep Maw exists: an elite stand-in so the arena, the fight and the victory can be played end to end */
function caveStandInBoss(){
  var kind = MONSTERS.trog ? 'trog' : 'brute', b=floorMeta.bossAt, c=walkable(b.x,b.y) && !occupied(b.x,b.y) ? b : nearFree(b.x,b.y,3);
  if(!c) return null;
  CAVE_NOSWAP=true; var m; try{ m=spawn(kind, c.x, c.y); } finally { CAVE_NOSWAP=false; }
  m.name='The Deep Maw (stand-in)'; m.elite=true; m.caveBoss=true; m.state='asleep';
  m.maxhp=m.hp=Math.round(m.hp*3);                            /* placeholder toughness, not a balance number */
  floorMeta.bossId=m.id;
  return m;
}
function caveBossesLeft(){ return ents.filter(function(e){ return e.foe && e.hp>0 && ((e.base && e.base.boss) || e.caveBoss); }).length; }
function caveBossDown(){
  if(!RUN || RUN.victory || RUN.over || !floorMeta || floorMeta.caveWon) return;
  floorMeta.caveWon=true; RUN.bossDead=true;
  log('<b>The Deep Maw is dead.</b> The caverns fall silent.','c-kill');
  setTimeout(function(){ if(RUN && !RUN.over && !RUN.victory) victory(); }, 1500);
}
var _killCave = kill;
kill = function(e, by){
  var boss = e && e!==player && ((e.base && e.base.boss) || e.caveBoss);
  var r=_killCave.apply(this, arguments);
  if(boss && floorNo===LAST_FLOOR && inCaverns() && ents.indexOf(e)<0 && !caveBossesLeft()) caveBossDown();
  return r;
};

/* ---------------------------------------------------------------- words */
var _floorIntroCave = floorIntro;
floorIntro = function(){
  if(!inCaverns()) return _floorIntroCave();
  var logSaved=log, skip=/Warchief's hall/;
  log=function(html, cls){ if(skip.test(html)) return; return logSaved.apply(this, arguments); };
  try{ _floorIntroCave(); } finally { log=logSaved; }
  if(floorMeta.boss) log('<b>The Deep Maw\'s hall.</b> The ground here is riddled with burrows. Something vast moves under the stone.','c-you');
};
var _showEndCave = showEnd;
showEnd = function(won){
  _showEndCave(won);
  if(won && floorNo>=LAST_FLOOR && inCaverns()){
    var tt=$('overT'); if(tt) tt.textContent='The Caverns are behind you';
    var p=$('overP'); if(p) p.innerHTML=p.innerHTML.replace(/^[\s\S]*?<br><br>/, player.name+' brought down the Deep Maw in the dark beneath the world. The Caverns are behind you.<br><br>');
  }
};

/* the sandbox's floor jump reaches every built floor */
setTimeout(function(){
  var s=typeof $==='function' ? $('jump') : null; if(!s) return;
  for(var n=s.options.length; n<=LAST_FLOOR; n++){ var o=document.createElement('option'); o.textContent=String(n); s.appendChild(o); }
}, 0);
