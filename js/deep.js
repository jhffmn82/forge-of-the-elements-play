/* =====================================================================
   deep.js - biome 4, the Underdark (floors 16-20): the world side, 2026-09-19. See DESIGN.md section 18.
   - Themed regions, decided before a single room is carved: each floor has one, two or three of drow temple (0),
     spider underdark (1) and volcanic (2), laid out as a noise-warped Voronoi so the borders wander. Floor 20 is
     temple only.
   - Rooms take the shape of their region (Justin, 2026-09-19): temple rooms are proper walled rectangles with doors;
     underdark rooms are smooth, rounded caverns; volcanic rooms are jagged caverns with lava in them. Temple rooms are
     joined by straight built hallways, anything touching a cave by a wandering tunnel. Where a hallway crosses a
     region border its floor and walls change set along a ragged line (js/deeprender.js draws that).
   - Lava (tile LAVA): impassable, sight passes over it, burns whoever ends a turn beside it, lights the room.
   - Scenery by region, sparse: drow shrines, pillar rows, ritual circles and blood fonts in the temple; web nurseries
     full of cocoons in the underdark, web curtains across its tunnels; lava forges and embers in the volcanic caves.
   Rendering (region surfaces, cave rock, lava, the pieces) lives in js/deeprender.js.

   CONTRACT for the creatures side (agreed through the lead, 2026-09-19):
     inDeep()                          true on floors 16-20 (not on a plane); use it behind a typeof guard
     floorMeta.deepRegion              Uint8Array(MW*MH): 0 temple, 1 underdark, 2 volcanic, for every cell (walls take
                                       the region of the open ground they face). deepRegionAt(x,y) reads it.
     room.region                       the region of each room; room.deepTheme: 'altar' | 'pillars' | 'ritual' | 'font' |
                                       'obelisks' | 'nursery' | 'ruin' | 'forge' | undefined (plain)
     props with p.hatch                cocoon-large-1/2 and egg-sac-cluster in web nurseries: yours to burst into
                                       spiderlings (removeProp(p) when they hatch)
     props with p.curtain (p.web)      web curtains across underdark tunnels: they block walking and sight-less movement
                                       until cut (one hit, like a bush) or burned. Let spiders pass them if you like.
     floorMeta.lava                    true when the floor has lava; deepLavaAdjacent(x,y) says whether a cell touches it
     room.barracks (temple barracks)   world.js's populateSpecialMonsters spawns 'goblin'/'archer' there - swap those kinds
                                       for Underdark ones in your spawn() wrapper, as the Caverns do (CAVE_NOSWAP)
     Floor 20 (the Matron of the Web):
     floorMeta.bossArena = {x, y, w, h, throne:{x,y}, circles:[{x,y}, ...]}
                                       tile coords of the hall; throne is the floor cell she holds; each circle is a
                                       2x2 WALKABLE set piece named 'ritual-circle' with its top-left tile at {x,y} - swap
                                       p.name to 'ritual-circle-active' and back (find it with propAt(x,y))
     spawnMatron(floorMeta.bossArena)  creates the Matron after the room population stage
     The hall's EXIT gate opens when she dies (world bossDefeated / exitOpen); stepping in wins the run.
   ===================================================================== */

var LAVA = 21;
LAST_FLOOR = 20;                          /* 2026-09-19: the Underdark is built; floor 15's Maw burrow leads down to 16 */
BIOME_NAMES[3] = 'Underdark';
TILE_NAMES[LAVA] = 'Lava';
TILE_HINTS[LAVA] = 'Impassable. Burns anything that stands beside it; sets webs and grass alight.';
var DEEP_REGIONS = ['temple', 'underdark', 'volcanic'];
var DEEP_STYLE = ['rect', 'smooth', 'jag'];

function inDeep(){ return typeof floorNo!=='undefined' && bidx()===3 && !(floorMeta && floorMeta.plane); }
function deepLavaAdjacent(x, y){ return at(x-1,y)===LAVA || at(x+1,y)===LAVA || at(x,y-1)===LAVA || at(x,y+1)===LAVA; }

/* ---------------------------------------------------------------- the pieces (art in art/map/biome4, map-deep.png)
   w,h: footprint in tiles; b: blocks; flat: lies on the floor (no shadow); light/dim: a light source; tall: rises above
   its footprint (redrawn over whoever stands behind it) */
var DEEP_PIECES = {
  'blood-font':{b:1, light:'#C02030', dim:1}, 'candelabra-tall':{b:1, light:'#FF6A3A'},
  'cocoon-large-1':{b:1, hatch:1}, 'cocoon-large-2':{b:1, hatch:1}, 'egg-sac-cluster':{b:1, hatch:1},
  'drow-altar':{b:1, w:2}, 'drow-altar-blood':{b:1, w:2}, 'drow-obelisk':{b:1}, 'drow-pillar':{b:1}, 'drow-pillar-broken':{b:1},
  'spider-idol':{b:1}, 'lava-forge':{b:1, w:2, light:'#FF7A30'},
  'ritual-circle':{flat:1, w:2, h:2}, 'ritual-circle-active':{flat:1, w:2, h:2, light:'#FF3040', dim:1},
  'stairs-down-drow':{flat:1, w:2, h:2},
  'web-curtain-h':{b:1, br:1, burn:1, web:1, curtain:1, sfx:'step-grass'}, 'web-curtain-v':{b:1, br:1, burn:1, web:1, curtain:1, sfx:'step-grass'},
  'silk-banner-1':{wall:1, b:1}, 'silk-banner-2':{wall:1, b:1}, 'web-corner-1':{wall:1, b:1}, 'web-corner-2':{wall:1, b:1}
};
(function(){
  var clLight = {'candles-scarlet':'#FF5A30', 'basalt-embers':'#FF6A20'};
  ['basalt-embers','candles-scarlet','cocoons-small','obsidian-shards','web-floor'].forEach(function(k){
    for(var v=1; v<=4; v++){ var d={flat:1, cluster:1}; if(clLight[k]){ d.light=clLight[k]; d.dim=1; } if(k==='web-floor'){ d.burn=1; d.web=1; } DEEP_PIECES[k+'-'+v]=d; }
  });
  for(var n in DEEP_PIECES){ var d=DEEP_PIECES[n], p={deep:1}; for(var f in d) if(f!=='w' && f!=='h') p[f]=d[f]; PROPS[n]=p; }
})();
var DEEP_BIG = /^(blood-font|candelabra-tall|cocoon-large|egg-sac|drow-|spider-idol|lava-forge|ritual-circle|stairs-down-drow)/;
function deepPiece(name){ return DEEP_PIECES[name] || null; }
function deepVar(base, n){ return base+'-'+(1+Math.floor(rng()*(n||4))); }
function deepPlace(x, y, name, extra){
  var d=DEEP_PIECES[name]||{}, w=d.w||1, h=d.h||1;
  if(w>1 || h>1) return addSetPiece(x, y, name, w, h, Object.assign({keep:false, deep:1, b:d.b?1:0}, extra||{}));   /* flat pieces (ritual circles) stay walkable */
  return addProp(x, y, name, Object.assign({deep:1}, extra||{}));
}

/* the shared room builders ask for dungeon furniture: the Underdark answers by region (null: nothing here) */
var DEEP_PROP = [
  /* temple */      {'torch-stand':'candelabra-tall', 'brazier-lit':'candelabra-tall', 'brazier-unlit':'drow-pillar-broken', 'banner-stand':null, 'statue':['spider-idol','drow-obelisk'],
                     'table-candle':['candles-scarlet-1','candles-scarlet-2','candles-scarlet-3','candles-scarlet-4'], 'mushrooms':null, 'vines':null, 'bookshelf':'drow-obelisk'},
  /* underdark */   {'torch-stand':null, 'brazier-lit':null, 'brazier-unlit':null, 'banner-stand':null, 'statue':'drow-pillar-broken', 'statue-broken':'drow-pillar-broken',
                     'table-candle':null, 'mushrooms':null, 'vines':null, 'bookshelf':'drow-pillar-broken'},
  /* volcanic */    {'torch-stand':'brazier-lit', 'banner-stand':null, 'statue':'drow-obelisk', 'table-candle':['basalt-embers-1','basalt-embers-2','basalt-embers-3','basalt-embers-4'],
                     'mushrooms':null, 'vines':null, 'bookshelf':'drow-obelisk'}
];


/* ---------------------------------------------------------------- regions */
/* 2026-09-19: how many themes a floor has is 1, 2 or 3 at random (30/40/30). Which ones: volcanic grows likelier
   and the spider caves a little rarer the deeper you go (bfloor 1-4) - placeholder weights, Justin's to tune. */
function deepPlanRegions(){
  var N=MW*MH, R=new Uint8Array(N);
  if(floorMeta.boss) return R;                                  /* floor 20: drow gothic only */
  var bf=bfloor(), roll=rng(), n = roll<0.3 ? 1 : roll<0.7 ? 2 : 3;
  var W=[1.0, 1.3-0.1*bf, 0.45+0.25*bf], kinds=[];
  while(kinds.length<n){
    var tot=0, k; for(k=0;k<3;k++) if(kinds.indexOf(k)<0) tot+=W[k];
    var r=rng()*tot;
    for(k=0;k<3;k++){ if(kinds.indexOf(k)>=0) continue; r-=W[k]; if(r<=0){ kinds.push(k); break; } }
    if(r>0) for(k=2;k>=0;k--) if(kinds.indexOf(k)<0){ kinds.push(k); break; }
  }
  if(n===1){ R.fill(kinds[0]); return R; }
  for(var t=0; t<12; t++){
    /* seeds spread across the width (the map is wide), so borders run roughly north-south and hallways cross them */
    var order=shuffled(kinds), seeds=order.map(function(k, i){ return {k:k, x:(i+0.5)/n*MW + (rng()-0.5)*MW/(n*2), y:ri(6, MH-7), wt:0.85+rng()*0.3}; });
    var s1=Math.floor(rng()*1e6), cnt=[0,0,0];
    for(var y=0;y<MH;y++) for(var x=0;x<MW;x++){
      var wx=x+(caveNoise(x*0.07, y*0.07, s1)-0.5)*18 + (caveNoise(x*0.2, y*0.2, s1+7)-0.5)*4;
      var wy=y+(caveNoise(x*0.07+11, y*0.07, s1+3)-0.5)*14 + (caveNoise(x*0.2+5, y*0.2, s1+9)-0.5)*4;
      var best=0, bd=1e9;
      for(var i=0;i<seeds.length;i++){ var dx=wx-seeds[i].x, dy=(wy-seeds[i].y)*1.2, d=Math.sqrt(dx*dx+dy*dy)/seeds[i].wt; if(d<bd){ bd=d; best=seeds[i].k; } }
      R[idxOf(x,y)]=best; cnt[best]++;
    }
    if(kinds.every(function(k){ return cnt[k] >= N*0.18; })) return R;
  }
  return R;
}

/* ---------------------------------------------------------------- layout */
function deepLayout(){
  if(!inDeep()) return false;
  for(var t=0; t<16; t++){ if(deepTry()){ floorMeta.deepLaid=t+1; return true; } }
  return false;                                                 /* never seen: the BSP rooms take over (all temple) */
}


function deepPlanRooms(R, boss){
  var ch=[], want = boss ? 3 : ri(7,9);
  function fits(c, margin){
    if(c.x0<2 || c.y0<2 || c.x0+c.w>MW-2 || c.y0+c.h>MH-2) return false;
    for(var i=0;i<ch.length;i++){ var o=ch[i], m=(c.reg===0 && o.reg===0) ? 3 : margin;
      if(c.x0 < o.x0+o.w+m && o.x0 < c.x0+c.w+m && c.y0 < o.y0+o.h+m && o.y0 < c.y0+c.h+m) return false; }
    return true;
  }
  if(boss){
    /* the Matron's hall fills the east of the map; a short approach of built rooms leads to it */
    var hall={reg:0, w:21, h:15, hall:true}; hall.x0=MW-2-hall.w; hall.y0=((MH-hall.h)>>1); hall.x=hall.x0+(hall.w>>1); hall.y=hall.y0+(hall.h>>1);
    ch.push(hall);
    for(var tb=0; tb<500 && ch.length<4; tb++){
      var c0={reg:0, w:ri(5,8), h:ri(4,6)}; c0.x0=ri(2, hall.x0-c0.w-4); c0.y0=ri(2, MH-2-c0.h); c0.x=c0.x0+(c0.w>>1); c0.y=c0.y0+(c0.h>>1);
      if(fits(c0, 2)) ch.push(c0);
    }
    if(ch.length<3) return null;
    ch.sort(function(a,b){ return a.x-b.x; });
    return ch;
  }
  for(var t=0; t<900 && ch.length<want; t++){
    var x=ri(4, MW-5), y=ri(4, MH-5), reg=R[idxOf(x,y)], c={x:x, y:y, reg:reg}, big;
    if(reg===0){ big=rng()<0.2; c.w=big ? ri(9,12) : ri(5,8); c.h=big ? ri(6,8) : ri(4,6); c.x0=x-(c.w>>1); c.y0=y-(c.h>>1); }
    else { big=rng()<(reg===2 ? 0.4 : 0.22); c.rx=big ? ri(5,7) : ri(3,5); c.ry=big ? ri(4,5) : ri(3,4); c.x0=x-c.rx; c.y0=y-c.ry; c.w=2*c.rx+1; c.h=2*c.ry+1; }   /* volcanic caves run bigger: room for the lava */
    if(fits(c, 2)) ch.push(c);
  }
  if(ch.length<5) return null;
  ch.sort(function(a,b){ return a.x-b.x; });
  if(rng()<0.5) ch.reverse();                                  /* the start at one end, the stairs usually at the other */
  return ch;
}
/* an organic chamber: smooth and round for the spider caves, broken and jagged for the volcanic ones */
function deepCarveCave(c, g, G, id, salt){
  var smooth = c.reg===1, x, y, i, cells=[], loc={};
  for(y=c.y0-1; y<=c.y0+c.h; y++) for(x=c.x0-1; x<=c.x0+c.w; x++){
    if(x<2 || y<2 || x>MW-3 || y>MH-3) continue;
    var dx=(x-c.x)/c.rx, dy=(y-c.y)/c.ry, wob;
    if(smooth) wob=(caveNoise(x*0.22, y*0.22, salt)-0.5)*0.45;
    else wob=(caveNoise(x*0.38, y*0.38, salt)-0.5)*0.8 + (0.5-Math.abs(caveNoise(x*0.95, y*0.95, salt+3)*2-1))*0.5;   /* broken, angular bays */
    var d=Math.sqrt(dx*dx+dy*dy)+wob;
    loc[x+','+y] = d<0.8 ? 1 : d<1.12 ? (rng()<0.55?1:0) : 0;
    cells.push({x:x, y:y, d:d});
  }
  /* smooth caves settle for four rounds of the 4-5 rule; jagged ones for one, which leaves the rock broken */
  for(var pass=0; pass<(smooth?4:1); pass++){
    var nl={};
    cells.forEach(function(q){
      var walls=0; for(var oy=-1;oy<=1;oy++) for(var ox=-1;ox<=1;ox++) if(!loc[(q.x+ox)+','+(q.y+oy)]) walls++;
      nl[q.x+','+q.y] = q.d<0.62 ? 1 : (walls>=5 ? 0 : 1);
    });
    loc=nl;
  }
  loc[c.x+','+c.y]=1;
  /* keep the piece joined to the middle */
  var keep={}, q=[[c.x,c.y]]; keep[c.x+','+c.y]=1;
  for(var h=0; h<q.length; h++){ [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(o){ var nx=q[h][0]+o[0], ny=q[h][1]+o[1], k=nx+','+ny; if(!keep[k] && loc[k]){ keep[k]=1; q.push([nx,ny]); } }); }
  var n=0;
  for(var k in keep){ var p=k.split(','), px=+p[0], py=+p[1]; i=idxOf(px,py); g[i]=1; if(G[i]<0){ G[i]=id; n++; } }
  return n;
}
/* joining rooms: a built hallway between temple rooms, a wandering tunnel for anything touching a cave */
function deepHall(g, a, b, vfirst){
  var x=a.x, y=a.y, hf=vfirst ? false : rng()<0.5;
  function dig(){ if(x>=1 && y>=1 && x<MW-1 && y<MH-1) g[idxOf(x,y)]=1; }
  dig();
  if(hf){ while(x!==b.x){ x+=x<b.x?1:-1; dig(); } while(y!==b.y){ y+=y<b.y?1:-1; dig(); } }
  else { while(y!==b.y){ y+=y<b.y?1:-1; dig(); } while(x!==b.x){ x+=x<b.x?1:-1; dig(); } }
}
function deepTunnel(g, a, b, wide){
  var x=a.x, y=a.y, guard=0;
  function dig(cx, cy){ for(var oy=0; oy<(wide?2:1); oy++) for(var ox=0; ox<(wide?2:1); ox++){ var xx=cx+ox, yy=cy+oy; if(xx>=2 && yy>=2 && xx<MW-2 && yy<MH-2) g[idxOf(xx,yy)]=1; } }
  dig(x,y);
  while((x!==b.x || y!==b.y) && guard++<600){
    var dx=b.x-x, dy=b.y-y;
    if(rng()<0.24){ if(Math.abs(dx)>=Math.abs(dy)) y+= rng()<0.5?-1:1; else x+= rng()<0.5?-1:1; }
    else if(dx && (!dy || rng()<Math.abs(dx)/(Math.abs(dx)+Math.abs(dy)))) x+=dx>0?1:-1;
    else y+=dy>0?1:-1;
    x=Math.max(2, Math.min(MW-3, x)); y=Math.max(2, Math.min(MH-3, y));
    dig(x,y);
  }
}
function deepTry(){
  var boss=!!floorMeta.boss, i, x, y, k, N=MW*MH;
  map.fill(WALL); rooms=[];
  var R=deepPlanRegions();
  var ch=deepPlanRooms(R, boss); if(!ch) return false;
  var g=new Uint8Array(N), G=new Int16Array(N).fill(-1), salt=Math.floor(rng()*1e6);
  /* rooms first, each in its region's shape */
  for(k=0;k<ch.length;k++){
    var c=ch[k];
    if(c.reg===0){ for(y=c.y0;y<c.y0+c.h;y++) for(x=c.x0;x<c.x0+c.w;x++) g[idxOf(x,y)]=1; c.n=c.w*c.h; c.ax=c.x0+(c.w>>1); c.ay=c.y0+(c.h>>1); }
    else { c.n=deepCarveCave(c, g, G, k, salt+k*101); c.ax=c.x; c.ay=c.y; }
  }
  /* tunnels: a spanning tree over the rooms plus a loop or two */
  var inTree=[0], edges=[];
  while(inTree.length<ch.length){
    var bA=-1, bB=-1, bD=1e9;
    for(var a=0;a<inTree.length;a++) for(var b=0;b<ch.length;b++){
      if(inTree.indexOf(b)>=0) continue; var ia=inTree[a], d2=Math.hypot(ch[ia].ax-ch[b].ax, (ch[ia].ay-ch[b].ay)*1.3);
      if(boss && ch[b].hall && inTree.length<ch.length-1) d2+=200;   /* the hall is reached last, through the approach */
      if(d2<bD){ bD=d2; bA=ia; bB=b; }
    }
    edges.push([bA,bB]); inTree.push(bB);
  }
  var loops = boss ? 0 : ri(1,2);
  for(var l=0; l<loops*8 && loops>0; l++){
    var p=Math.floor(rng()*ch.length), q=Math.floor(rng()*ch.length);
    if(p===q || edges.some(function(e){ return (e[0]===p&&e[1]===q)||(e[0]===q&&e[1]===p); })) continue;
    if(Math.hypot(ch[p].ax-ch[q].ax, ch[p].ay-ch[q].ay) > 28) continue;
    edges.push([p,q]); loops--;
  }
  edges.forEach(function(e){
    var A=ch[e[0]], B=ch[e[1]];
    if(A.hall || B.hall){ var o=A.hall?B:A, H=A.hall?A:B; deepHall(g, {x:o.ax, y:o.ay}, {x:H.x0+1, y:H.y0+(H.h>>1)}, true); return; }   /* into the hall's west door */
    if(A.reg===0 && B.reg===0) deepHall(g, {x:A.ax, y:A.ay}, {x:B.ax, y:B.ay});
    else deepTunnel(g, {x:A.ax, y:A.ay}, {x:B.ax, y:B.ay}, (A.reg===1 || B.reg===1) && rng()<0.25);
  });
  for(i=0;i<N;i++) map[i]= g[i] ? FLOOR : WALL;
  /* whatever the start cannot reach goes back to rock */
  var reach=caveReach(ch[0].ax, ch[0].ay);
  for(i=0;i<N;i++) if(map[i]===FLOOR && !reach[i]){ map[i]=WALL; G[i]=-1; }
  var open=0; for(i=0;i<N;i++) if(map[i]===FLOOR) open++;
  if(open < (boss ? 330 : 340)) return false;
  for(k=0;k<ch.length;k++) if(!reach[idxOf(ch[k].ax, ch[k].ay)]) return false;
  /* rooms[]: built rooms keep their rectangle; caves are cave rooms (floorMeta.caveRoom, as the Caverns use) */
  floorMeta.caveRoom=G;
  floorMeta.planeLights=floorMeta.planeLights||[];
  var start=null;
  for(k=0;k<ch.length;k++){
    var c2=ch[k], r;
    if(c2.reg===0){ r={x:c2.x0, y:c2.y0, w:c2.w, h:c2.h, cx:c2.x0+(c2.w>>1), cy:c2.y0+(c2.h>>1), id:k, n:c2.n}; if(c2.hall) r.hall=true; }
    else {
      var cnt=0; for(i=0;i<N;i++) if(G[i]===k && map[i]===FLOOR) cnt++;
      if(cnt<12){ for(i=0;i<N;i++) if(G[i]===k) G[i]=-1; if(k===0) return false; continue; }
      r={id:k, cave:true};
    }
    r.region=c2.reg; r.shape=DEEP_STYLE[c2.reg];
    rooms.push(r);
  }
  caveRoomBoxes();
  start=rooms[0];
  /* doors where hallways meet the built rooms */
  rooms.forEach(function(r){
    if(r.cave || r.hall) return;
    for(var kx=r.x;kx<r.x+r.w;kx++){
      if(doorSpot(kx,r.y-1,true) && rng()<0.7) setT(kx,r.y-1,DOOR);
      if(doorSpot(kx,r.y+r.h,true) && rng()<0.7) setT(kx,r.y+r.h,DOOR);
    }
    for(var my=r.y;my<r.y+r.h;my++){
      if(doorSpot(r.x-1,my,false) && rng()<0.7) setT(r.x-1,my,DOOR);
      if(doorSpot(r.x+r.w,my,false) && rng()<0.7) setT(r.x+r.w,my,DOOR);
    }
  });
  /* the regions as laid out; each room's cells take its own region */
  floorMeta.deepRegion=R;
  rooms.forEach(function(r){ deepRoomCells(r).forEach(function(c){ R[idxOf(c.x,c.y)]=r.region; }); });
  /* Beta's lava carver was shadowed by the deepLava tile predicate, so this stage
     never changed terrain. Preserve its candidate shuffle and one draw per room;
     activating carveDeepLavaRoom is a separate content change (see floor-transitions.md). */
  if(!boss){
    var lavaRooms=shuffled(rooms.filter(function(r){ return r.region===2 && r!==start && r.cave && r.n>=22; }));
    for(var li=0;li<lavaRooms.length;li++)rng();
  }
  if(caveUnreachedDeep(start.cx, start.cy)) return false;
  return true;
}
/* walkable ground the start cannot reach (lava and chasm are not ground; doors are) */
function caveUnreachedDeep(sx, sy){
  var d=new Uint8Array(MW*MH), q=[idxOf(sx,sy)]; d[q[0]]=1;
  function ok(t){ return t===FLOOR || t===DOOR || t===BRIDGE || t===WATER; }
  for(var h=0; h<q.length; h++){
    var i=q[h], x=i%MW, y=(i/MW)|0;
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(o){ var nx=x+o[0], ny=y+o[1]; if(!inb(nx,ny)) return; var n=idxOf(nx,ny); if(!d[n] && ok(map[n])){ d[n]=1; q.push(n); } });
  }
  for(var j=0;j<map.length;j++) if((map[j]===FLOOR || map[j]===DOOR) && !d[j]) return true;
  return false;
}
function deepRoomCells(r){
  if(r.cave) return caveRoomCells(r);
  var out=[]; for(var y=r.y;y<r.y+r.h;y++) for(var x=r.x;x<r.x+r.w;x++) if(inb(x,y)) out.push({x:x,y:y}); return out;
}

/* ---------------------------------------------------------------- lava */
/* a channel wandering along the cave's long axis, or a pool; kept two tiles clear of the cave's heart (the Forge or
   the shrine may stand there), off every tunnel mouth, and undone if it would cut any ground off from the start */
function carveDeepLavaRoom(room, start){
  var G=floorMeta.caveRoom, saved=[];
  function inRoom(x,y){ return inb(x,y) && G[idxOf(x,y)]===room.id && at(x,y)===FLOOR; }
  function okCell(x,y){
    if(!inRoom(x,y)) return false;
    for(var oy=-1;oy<=1;oy++) for(var ox=-1;ox<=1;ox++){ var t=at(x+ox,y+oy); if(isDoorish(t)) return false; if(t===FLOOR && G[idxOf(x+ox,y+oy)]!==room.id && (!ox || !oy)) return false; }
    return true;
  }
  function set(x,y){ saved.push(idxOf(x,y)); setT(x,y,LAVA); }
  function undo(){ saved.forEach(function(i){ map[i]=FLOOR; }); saved=[]; }
  var cells=caveRoomCells(room).filter(function(c){ return okCell(c.x,c.y); });
  if(cells.length<6) return false;
  if(rng()<0.6){
    /* a channel: along the long axis, offset from the middle */
    var vert = room.h>room.w, off=(rng()<0.5?-1:1)*ri(1,2), w=rng()<0.35?2:1;
    var a0 = vert ? room.y : room.x, a1 = vert ? room.y+room.h-1 : room.x+room.w-1, b=(vert ? room.cx : room.cy)+off;
    for(var a=a0; a<=a1; a++){
      if(rng()<0.45){ var nb=b+(rng()<0.5?-1:1); if(Math.abs(nb-((vert?room.cx:room.cy)+off))<=1) b=nb; }
      var ww = w + (rng()<0.3 ? 1 : 0);                    /* it swells here and there */
      for(var k=0;k<ww;k++){ var x=vert ? b+k : a, y=vert ? a : b+k; if(okCell(x,y)) set(x,y); }
    }
    if(saved.length<3) undo();                               /* the channel found no room: a pool instead */
  }
  if(!saved.length){ var c=pick(cells); blob(c.x, c.y, ri(4,8), function(x,y){ if(okCell(x,y) && at(x,y)===FLOOR) set(x,y); }); }
  if(saved.length<3){ undo(); return false; }
  /* a ford of bare rock where the channel cut the cave in two; if that is not enough, no lava */
  for(var guard=0; guard<4 && caveUnreachedDeep(start.cx, start.cy); guard++){
    var mid=saved[Math.floor(saved.length/2 + (rng()-0.5)*saved.length*0.5)];
    if(mid===undefined) break;
    var mx=mid%MW, my=(mid/MW)|0;
    for(var oy=-1;oy<=1;oy++) for(var ox=-1;ox<=1;ox++){ var ii=idxOf(mx+ox,my+oy); if(map[ii]===LAVA){ map[ii]=FLOOR; saved.splice(saved.indexOf(ii),1); } }
  }
  if(caveUnreachedDeep(start.cx, start.cy) || saved.length<3){ undo(); return false; }
  /* the cave's heart (where the Forge or a shrine may stand) moves to the ground furthest from the lava: three tiles
     clear of it, or no lava */
  var best=null, bs=-1;
  caveRoomCells(room).forEach(function(c){
    if(at(c.x,c.y)!==FLOOR) return;
    var dl=9; saved.forEach(function(i){ dl=Math.min(dl, Math.max(Math.abs(i%MW-c.x), Math.abs(((i/MW)|0)-c.y))); });
    if(dl<3) return;
    var open=0; for(var oy=-1;oy<=1;oy++) for(var ox=-1;ox<=1;ox++) if(at(c.x+ox,c.y+oy)===FLOOR) open++;
    var sc=open*10+Math.min(dl,5);
    if(sc>bs){ bs=sc; best=c; }
  });
  if(!best || bs<90){ undo(); return false; }
  room.cx=best.x; room.cy=best.y;
  return true;
}

/* ---------------------------------------------------------------- the shared generator, told about the Underdark */
/* stairs (down and up) stand at the end of a short passage cut north into the rock, so the drow stairway's arch sits
   in the rock face at its end; any room shape */


/* the special rooms: the furniture maps through DEEP_PROP; a few kinds become the region's own rooms */


var _decoratePlainDeep = decoratePlain;
decoratePlain = function(r){ if(!inDeep()) return _decoratePlainDeep(r); deepThemeRoom(r, false); };

/* a free cell of this room: floor, nothing on it, not at a door or tunnel mouth, not by lava */
function deepFree(x, y, r){ return at(x,y)===FLOOR && !propAt(x,y) && !itemAt(x,y) && !nearDoor(x,y) && !deepLavaAdjacent(x,y) && (!r || roomAt(x,y)===r) && !(r && x===r.cx && y===r.cy); }
function deepFoot(x, y, w, h, r){ for(var yy=y; yy<y+h; yy++) for(var xx=x; xx<x+w; xx++) if(!deepFree(xx,yy,r)) return false; return true; }
function deepWall(x, y){ return isWallLike(at(x,y)); }
/* a standing piece backed by the rock above its footprint, with open ground in front: it never plugs a way through */
function deepBackedSpot(r, w, h){
  var cells=shuffled(deepRoomCells(r));
  for(var i=0;i<cells.length;i++){
    var c=cells[i]; if(!deepFoot(c.x, c.y, w, h, r)) continue;
    var backed=true; for(var xx=c.x; xx<c.x+w; xx++) if(!deepWall(xx, c.y-1)) backed=false;
    if(!backed) continue;
    var front=0; for(var fx=c.x-1; fx<=c.x+w; fx++) if(at(fx, c.y+h)===FLOOR && !propAt(fx, c.y+h)) front++;
    if(front<w+1) continue;
    if(deepWall(c.x-1, c.y+h-1) && deepWall(c.x+w, c.y+h-1)) continue;   /* a notch: it would seal it */
    return c;
  }
  return null;
}
function deepBacked(r, name, extra){ var d=DEEP_PIECES[name]||{}, s=deepBackedSpot(r, d.w||1, d.h||1); return s ? deepPlace(s.x, s.y, name, extra) : null; }
/* each room's scenery by region: set pieces now and then, plain rooms often (Justin: pieces are occasional) */
function deepThemeRoom(r, special){
  if(r.pocket || r.hall) return;
  var reg=r.region||0, roll=rng(), M=floorMeta, big=r.n>=30, i;
  M.deepDone=M.deepDone||{};
  if(reg===0){
    if(roll<0.16 && !M.deepDone.altar){
      M.deepDone.altar=1; r.deepTheme='altar';
      var al=deepBacked(r, rng()<0.5 ? 'drow-altar' : 'drow-altar-blood');
      if(al){ [-1,2].forEach(function(dx){ if(deepFree(al.x+dx, al.y, r) && deepWall(al.x+dx, al.y-1)) deepPlace(al.x+dx, al.y, rng()<0.6 ? 'spider-idol' : 'candelabra-tall'); }); }
    } else if(roll<0.34 && r.w>=7 && r.h>=5 && !r.cave){
      r.deepTheme='pillars';
      /* two rows of pillars a tile in from the long walls, mirrored, the odd one fallen */
      for(var px=r.x+1; px<=r.x+r.w-2; px+=2){
        var mx=r.x+r.w-1-(px-r.x); if(mx<px) break;
        [r.y+1, r.y+r.h-2].forEach(function(py){
          [px, mx].forEach(function(xx){ if(deepFree(xx,py,r) && !nearDoor(xx,py)) deepPlace(xx, py, rng()<0.2 ? 'drow-pillar-broken' : 'drow-pillar'); });
        });
      }
    } else if(roll<0.44 && big && !M.deepDone.ritual){
      var cs=shuffled(deepRoomCells(r)).filter(function(c){ return deepFoot(c.x-1, c.y-1, 4, 4, r); })[0];
      if(cs){ M.deepDone.ritual=1; r.deepTheme='ritual'; deepPlace(cs.x, cs.y, 'ritual-circle'); }
    } else if(roll<0.54){
      r.deepTheme='font'; deepBacked(r, 'blood-font');
    } else if(roll<0.64 && r.w>=6){
      r.deepTheme='obelisks'; var o1=deepBacked(r, 'drow-obelisk');
      if(o1 && !r.cave){ var ox=r.x+r.w-1-(o1.x-r.x); if(ox!==o1.x && deepFree(ox,o1.y,r) && deepWall(ox,o1.y-1)) deepPlace(ox, o1.y, 'drow-obelisk'); }
    }
  } else if(reg===1){
    if(roll<(special ? 0.9 : 0.38) && (M.deepDone.nursery||0)<2){
      M.deepDone.nursery=(M.deepDone.nursery||0)+1; r.deepTheme='nursery';
      var nc=ri(2, big ? 4 : 3);
      for(i=0;i<nc;i++) deepBacked(r, rng()<0.5 ? 'cocoon-large-1' : 'cocoon-large-2', {hatch:true});
      if(rng()<0.7) deepBacked(r, 'egg-sac-cluster', {hatch:true});
    } else if(roll<0.52){
      r.deepTheme='ruin'; deepBacked(r, 'drow-pillar-broken');
    }
  } else {
    if(roll<0.24 && !M.deepDone.forge && !r.lava){ var lf=deepBacked(r, 'lava-forge'); if(lf){ M.deepDone.forge=1; r.deepTheme='forge'; } }
    else if(roll<0.36){ r.deepTheme='obelisks'; deepBacked(r, 'drow-obelisk'); }
  }
}

/* ---------------------------------------------------------------- after the floor is built: regions for every cell */
/* open ground keeps its region (rooms their own, hallways the laid-out field); rock takes the region of the nearest
   open ground, so a room's walls always match its floor. Pockets carved later (vaults, puzzles) take the field. */
function deepFinishRegions(){
  var R=floorMeta.deepRegion; if(!R) return;
  var N=MW*MH, i, src=floorMeta.deepField || (floorMeta.deepField=R.slice());
  rooms.forEach(function(r){
    if(r.region===undefined){ r.region=src[idxOf(Math.max(0,Math.min(MW-1,r.cx)), Math.max(0,Math.min(MH-1,r.cy)))]; r.shape=DEEP_STYLE[r.region]; }
    deepRoomCells(r).forEach(function(c){ if(!isWallLike(at(c.x,c.y))) R[idxOf(c.x,c.y)]=r.region; });
  });
  var d=new Int16Array(N).fill(-1), q=[];
  for(i=0;i<N;i++) if(!isWallLike(map[i])){ d[i]=0; q.push(i); }
  for(var h=0; h<q.length; h++){
    var c=q[h], x=c%MW, y=(c/MW)|0;
    for(var oy=-1;oy<=1;oy++) for(var ox=-1;ox<=1;ox++){
      var nx=x+ox, ny=y+oy; if(!inb(nx,ny)) continue; var n=idxOf(nx,ny);
      if(d[n]<0){ d[n]=d[c]+1; R[n]=R[c]; q.push(n); }
    }
  }
  /* rock more than a tile from open ground follows the laid-out field, so borders run organically through the rock
     instead of in squares round each room */
  for(i=0;i<N;i++) if(d[i]>=2) R[i]=src[i];
}

/* ---------------------------------------------------------------- the dressing pass: flat clusters and wall pieces */
function deepNearBig(x, y){
  for(var i=0;i<props.length;i++){ var q=props[i]; if(!DEEP_BIG.test(q.name) || q.wall) continue;
    if(x>=q.x-1 && x<=q.x+(q.w||1) && y>=q.y-1 && y<=q.y+(q.h||1)) return true; }
  return false;
}
function deepWallSide(x, y){ return deepWall(x-1,y) || deepWall(x+1,y) || deepWall(x,y-1) || deepWall(x,y+1); }
function deepScatterOK(x, y, r){ return deepFree(x,y,r) && deepWallSide(x,y) && !deepNearBig(x,y) && !feats.some(function(f){ return f.x===x && f.y===y; }); }
/* a streak of 2-3 clusters along the foot of a wall (never one alone) */
function deepStreak(r, base, minN, maxN){
  var starts=shuffled(deepRoomCells(r).filter(function(c){ return deepScatterOK(c.x,c.y,r); }));
  for(var t=0; t<starts.length && t<12; t++){
    var run=[starts[t]], want=ri(minN,maxN), key={}; key[starts[t].x+','+starts[t].y]=1;
    for(var g=0; g<20 && run.length<want; g++){
      var from=run[run.length-1], nb=[[1,0],[-1,0],[0,1],[0,-1]].map(function(o){ return {x:from.x+o[0], y:from.y+o[1]}; })
        .filter(function(c){ return !key[c.x+','+c.y] && deepScatterOK(c.x,c.y,r); });
      if(!nb.length) break; var nx=nb[Math.floor(rng()*nb.length)]; key[nx.x+','+nx.y]=1; run.push(nx);
    }
    if(run.length<minN) continue;
    var v=Math.floor(rng()*4);
    run.forEach(function(c, i){ deepPlace(c.x, c.y, base+'-'+(1+(v+i)%4)); });
    return run.length;
  }
  return 0;
}
/* organic growth (webs on the floor): a joined patch of 3-5 tiles anywhere in the room, or nothing */
function deepPatch(r, base){
  var cells=shuffled(deepRoomCells(r).filter(function(c){ return deepFree(c.x,c.y,r) && !deepNearBig(c.x,c.y); }));
  var s=cells[0]; if(!s) return 0;
  var patch=[s], key={}, want=ri(3,5); key[s.x+','+s.y]=1;
  for(var t=0; t<30 && patch.length<want; t++){
    var f=patch[Math.floor(rng()*patch.length)], d=[[1,0],[-1,0],[0,1],[0,-1]][Math.floor(rng()*4)], nx=f.x+d[0], ny=f.y+d[1];
    if(key[nx+','+ny] || !deepFree(nx,ny,r) || deepNearBig(nx,ny)) continue;
    key[nx+','+ny]=1; patch.push({x:nx, y:ny});
  }
  if(patch.length<3) return 0;
  patch.forEach(function(c){ deepPlace(c.x, c.y, deepVar(base)); });
  return patch.length;
}
/* a wall piece hung on the face above a room's floor; corners for webs */
function deepWallPiece(r, name, corner){
  var cells=shuffled(deepRoomCells(r).filter(function(c){
    if(at(c.x,c.y)!==FLOOR || nearDoor(c.x,c.y) || !deepWall(c.x,c.y-1) || at(c.x,c.y-1)===SECRET || propAt(c.x,c.y-1) || deepWall(c.x,c.y-2)===false) return false;
    if(corner) return deepWall(c.x-1,c.y) || deepWall(c.x+1,c.y);
    return !deepWall(c.x-1,c.y) && !deepWall(c.x+1,c.y) && deepWall(c.x-1,c.y-1) && deepWall(c.x+1,c.y-1);
  }));
  var c=cells[0]; if(!c) return null;
  return deepPlace(c.x, c.y-1, name, {wall:true, flipX: corner ? deepWall(c.x+1,c.y) : false});
}
function deepDress(){
  var M=floorMeta, TH=M.deepKinds || (M.deepKinds={temple:rng()<0.5 ? ['candles-scarlet'] : rng()<0.5 ? ['obsidian-shards'] : ['candles-scarlet','obsidian-shards'],
                                                      volcanic:rng()<0.6 ? ['basalt-embers'] : ['basalt-embers','obsidian-shards']});
  rooms.forEach(function(r){
    if(r.pocket || r.hall || r.w<3 || r.h<3) return;
    var reg=r.region||0;
    if(reg===0){
      if(rng()<(r.deepTheme ? 0.6 : 0.35)) deepStreak(r, pick(TH.temple), 2, 3);
      if(rng()<0.4){ var b1=deepWallPiece(r, 'silk-banner-'+(1+Math.floor(rng()*2)), false);
        if(b1 && !r.cave && rng()<0.6){ var mx=r.x+r.w-1-(b1.x-r.x); if(mx!==b1.x && at(mx,b1.y+1)===FLOOR && deepWall(mx,b1.y) && !propAt(mx,b1.y) && !nearDoor(mx,b1.y+1)) deepPlace(mx, b1.y, b1.name, {wall:true}); } }
    } else if(reg===1){
      var nurse=r.deepTheme==='nursery';
      if(nurse || rng()<0.3) deepPatch(r, 'web-floor');
      if(nurse && rng()<0.8) deepStreak(r, 'cocoons-small', 2, 3);
      var nw = nurse ? ri(1,3) : (rng()<0.5 ? 1 : 0);
      for(var i=0;i<nw;i++) deepWallPiece(r, 'web-corner-'+(1+Math.floor(rng()*2)), true);
    } else {
      if(rng()<(r.lava ? 0.55 : 0.35)) deepStreak(r, pick(TH.volcanic), 2, 3);
    }
  });
  /* big pieces stand alone */
  var before=props.length;
  props=props.filter(function(p){ return !(DEEP_PIECES[p.name] && DEEP_PIECES[p.name].cluster && deepNearBig(p.x,p.y)); });
  if(props.length!==before) rebuildPropGrid();
}
/* web curtains across the spider caves' narrow tunnels: one blow cuts one, fire takes it */
function deepCurtains(){
  var want=ri(1,3), n=0, placed=[];
  var cells=[];
  for(var y=2;y<MH-2;y++) for(var x=2;x<MW-2;x++){
    if(at(x,y)!==FLOOR || roomAt(x,y) || deepRegionAt(x,y)!==1 || propAt(x,y) || itemAt(x,y) || occupied(x,y)) continue;
    if(feats.some(function(f){ return f.x===x && f.y===y; })) continue;
    var ns = deepWall(x-1,y) && deepWall(x+1,y) && at(x,y-1)===FLOOR && at(x,y+1)===FLOOR;   /* a north-south passage */
    var ew = deepWall(x,y-1) && deepWall(x,y+1) && at(x-1,y)===FLOOR && at(x+1,y)===FLOOR;
    if(!ns && !ew) continue;
    var near=false; for(var oy=-2;oy<=2;oy++) for(var ox=-2;ox<=2;ox++){ var t=at(x+ox,y+oy); if(isDoorish(t) || t===STAIRS || t===UPSTAIRS || t===CHEST || (typeof PORTAL!=='undefined' && t===PORTAL)) near=true; }
    if(near) continue;
    cells.push({x:x, y:y, ns:ns});
  }
  cells=shuffled(cells);
  for(var i=0;i<cells.length && n<want;i++){
    var c=cells[i]; if(placed.some(function(p){ return Math.abs(p.x-c.x)+Math.abs(p.y-c.y)<6; })) continue;
    if(deepPlace(c.x, c.y, c.ns ? 'web-curtain-h' : 'web-curtain-v', {keep:false})){ placed.push(c); n++; }
  }
}
/* lava lights: one every few cells of each flow, pulsing (js/deeprender.js adds them) */
function deepLavaLights(){
  var L=[], seenL=new Uint8Array(MW*MH);
  for(var i=0;i<map.length;i++){
    if(map[i]!==LAVA || seenL[i]) continue;
    var q=[i], cells=[]; seenL[i]=1;
    for(var h=0; h<q.length; h++){ var c=q[h], x=c%MW, y=(c/MW)|0; cells.push([x,y]);
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(o){ var nx=x+o[0], ny=y+o[1]; if(!inb(nx,ny)) return; var n=idxOf(nx,ny); if(!seenL[n] && map[n]===LAVA){ seenL[n]=1; q.push(n); } }); }
    var k=Math.max(1, Math.round(cells.length/4));
    for(var j=0;j<k;j++){ var cc=cells[Math.floor((j+0.5)*cells.length/k)]; L.push({x:cc[0], y:cc[1], ph:hash2(cc[0],cc[1],7)*6.28}); }
  }
  floorMeta.lavaLights=L;
}

/* ---------------------------------------------------------------- vegetation by region (vegetation.js grows the others)
   underdark: the violet cave grass in joined masses along the damp walls, fungus clumps; volcanic: sparse ashweed in
   little stands of three or four; temple: none (clean gothic stone). */
var _vegGrowDeep = vegGrow;
vegGrow = function(){
  if(!inDeep()) return _vegGrowDeep.apply(this, arguments);
  deepFinishRegions();
  var salt=Math.floor(rng()*1e6), N=MW*MH, spots=[], i, x, y;
  for(i=0;i<N;i++) if(ground[i]===G_GRASS || ground[i]===G_SHORT || ground[i]===G_MOSS) ground[i]=0;
  function wallN(x,y){ var n=0; for(var dy=-1;dy<=1;dy++) for(var dx=-1;dx<=1;dx++) if((dx||dy) && isWallLike(at(x+dx,y+dy))) n++; return n; }
  function free(x,y){ return at(x,y)===FLOOR && !ground[idxOf(x,y)] && !propAt(x,y) && !deepLavaAdjacent(x,y) && Math.max(Math.abs(x-player.x),Math.abs(y-player.y))>1; }
  rooms.forEach(function(r){
    if(r.region!==1 || r.role==='boss') return;
    var mood = rng()<0.3 ? 'bare' : rng()<0.6 ? 'some' : 'lush';
    if(r.role==='start' && mood==='lush') mood='some';
    r.greenery=mood; if(mood==='bare') return;
    deepRoomCells(r).forEach(function(c){
      if(!free(c.x,c.y)) return;
      var n=wallN(c.x,c.y), m=(n>=3 ? 0.36 : n>=1 ? 0.24 : 0) + (vegNoise(c.x*0.33, c.y*0.33, salt+1)-0.5)*0.6 + (mood==='lush' ? 0.16 : 0);
      if(m>0.62 && mood==='lush') setG(c.x,c.y,G_GRASS);
      else if(m>0.34) setG(c.x,c.y,G_SHORT);
      if(m>0.3 && n>=1 && hash2(c.x,c.y,salt+5)<0.2) spots.push({x:c.x, y:c.y, kind:'fungus'});
    });
  });
  /* the tunnels through the spider caves: the odd tuft where the floor meets the wall */
  for(y=1;y<MH-1;y++) for(x=1;x<MW-1;x++){
    if(roomAt(x,y) || deepRegionAt(x,y)!==1 || !free(x,y) || !wallN(x,y)) continue;
    if(vegNoise(x*0.5, y*0.5, salt+3)>0.7 && hash2(x,y,salt+4)<0.6) setG(x,y,G_SHORT);
  }
  /* ashweed: a stand of 3-4 along a volcanic wall in some rooms */
  rooms.forEach(function(r){
    if(r.region!==2 || rng()>0.45) return;
    var cells=shuffled(deepRoomCells(r).filter(function(c){ return free(c.x,c.y) && wallN(c.x,c.y)>=1; }));
    var s=cells[0]; if(!s) return;
    var stand=[s], key={}; key[s.x+','+s.y]=1;
    for(var t=0; t<24 && stand.length<ri(3,4); t++){
      var f=stand[Math.floor(rng()*stand.length)], d=[[1,0],[-1,0],[0,1],[0,-1]][Math.floor(rng()*4)], nx=f.x+d[0], ny=f.y+d[1];
      if(key[nx+','+ny] || !free(nx,ny) || roomAt(nx,ny)!==r) continue; key[nx+','+ny]=1; stand.push({x:nx,y:ny});
    }
    if(stand.length>=3) stand.forEach(function(c){ spots.push({x:c.x, y:c.y, kind:'ashweed'}); });
  });
  /* 2026-09-20: Justin - one piece of vegetation per tile. The Deep grows its own greenery, so it needs the same
     rule vegetation.js got: a fungus or ashweed spot is deduped, never sits on a prop, and clears the grass under
     it - the clump is the tile's growth, not a second layer over a tuft. */
  var spotSeenDeep={};
  spots=spots.filter(function(sp){ var i2=idxOf(sp.x,sp.y); if(spotSeenDeep[i2] || propAt(sp.x,sp.y)) return false; spotSeenDeep[i2]=1; return true; });
  spots.forEach(function(sp){ var i2=idxOf(sp.x,sp.y); if(ground[i2]===G_GRASS || ground[i2]===G_SHORT) ground[i2]=0; });
  /* fungus glows faintly: a dim violet light for about one clump in three */
  floorMeta.planeLights=floorMeta.planeLights||[];
  spots.forEach(function(sp){ if(sp.kind==='fungus' && hash2(sp.x,sp.y,salt+9)<0.35) floorMeta.planeLights.push({x:sp.x, y:sp.y+0.2, col:'#A77CFF', r:2.2, s:0.22}); });
  floorMeta.vegSpots=spots;
};

/* ---------------------------------------------------------------- the last word on a new floor */


/* ---------------------------------------------------------------- lava burns */
/* 2026-09-19: whoever ends a turn beside lava (orthogonally) takes fire damage; grass and webs beside it catch.
   The number is a placeholder for the balance pass. */
function deepLavaDmg(){ return sDMG(3 + Math.floor(floorNo/5)); }
function deepLavaBurn(e){
  if(!e || e.hp<=0 || !deepLavaAdjacent(e.x,e.y)) return false;
  if(e===player && player.levitate>0) return false;
  var d=applyDamage(e, deepLavaDmg(), 'fire', null); floatText(e.x, e.y, String(d), 'fire');
  if(e===player){ if(!floorMeta.lavaWarned){ floorMeta.lavaWarned=1; log('The lava beside you <b>scorches</b> you. Do not stand next to it.','c-you'); } }
  return true;
}
function deepLavaIgnite(){
  for(var i=0;i<map.length;i++){
    if(map[i]!==LAVA) continue; var x=i%MW, y=(i/MW)|0;
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(o){
      var nx=x+o[0], ny=y+o[1]; if(!inb(nx,ny)) return; var n=idxOf(nx,ny), g=ground[n], p=propAt(nx,ny);
      if(fireT[n]) return;
      if(g===G_GRASS || g===G_SHORT || g===G_WEB || (p && (p.burn || p.web))) ignite(nx, ny, null);
    });
  }
}

function turnDeepLavaEnemies(context){
  if(!inDeep()||!floorMeta.lava||player.hp<=0)return;
  ents.slice().forEach(function(e){ if(e!==player && e.hp>0 && ents.indexOf(e)>=0 && deepLavaBurn(e) && e.hp<=0) kill(e, null); });
  deepLavaIgnite();

}

/* ---------------------------------------------------------------- web curtains: cut with one blow, burned by fire */

function cutWebCurtain(p,src,type){
  removeProp(p); sfx('step-grass',{vol:0.5});
  if(typeof burst==='function') burst(p.x, p.y, 'ice', 12, 0.04);
  if(type==='fire') setG(p.x, p.y, G_ASH);
  log('You cut through the web.','c-info');
  computeFOV();

}

/* ---------------------------------------------------------------- floor 20: the Matron of the Web's hall */
function buildDeepHall(r){
  r.role='boss';
  var x0=r.x, y0=r.y, w=r.w, h=r.h, ax=x0+(w>>1);             /* w is odd: ax is the axis of symmetry */
  function mir(x){ return 2*ax-x; }
  function put(x, y, name, extra){ return deepPlace(x, y, name, Object.assign({keep:true}, extra||{})); }
  var throne={x:ax, y:y0+2};
  floorMeta.bossAt=throne;
  /* the idol of the spider goddess behind the throne, candelabras either side, altars at the far corners of the dais */
  put(ax, y0, 'spider-idol');
  put(ax-2, y0, 'candelabra-tall'); put(mir(ax-2), y0, 'candelabra-tall');
  put(x0+3, y0, 'drow-altar-blood'); put(mir(x0+3)-1, y0, 'drow-altar-blood');
  put(x0+1, y0+1, 'blood-font'); put(mir(x0+1), y0+1, 'blood-font');
  /* four ritual circles, mirrored, walkable */
  var circles=[];
  [[x0+4, y0+5], [x0+4, y0+10]].forEach(function(c){
    [c[0], mir(c[0])-1].forEach(function(cx){ if(put(cx, c[1], 'ritual-circle')) circles.push({x:cx, y:c[1]}); });
  });
  /* two rows of pillars flanking the aisle */
  [y0+4, y0+7, y0+10, y0+13].forEach(function(py, i){
    [ax-3, ax+3].forEach(function(px){ if(py<y0+h-1) put(px, py, (i===3 && px<ax) ? 'drow-pillar-broken' : 'drow-pillar'); });
  });
  put(x0, y0+h-1, 'candelabra-tall'); put(x0+w-1, y0+h-1, 'candelabra-tall');
  /* the way out: a gate in the south wall, sealed until she falls */
  setT(ax, y0+h, EXIT); floorMeta.exitAt={x:ax, y:y0+h};
  floorMeta.bossArena={x:x0, y:y0, w:w, h:h, throne:throne, circles:circles};
  for(var i=0;i<6;i++){ var c2=pick(interiorCells(r)); if(c2 && !propAt(c2.x,c2.y)) setG(c2.x,c2.y,G_BLOOD); }
}


/* the stand-in is not base.boss: its death opens the gate the way a boss's does */


/* floor 15's burrow now leads down into the Underdark, not out of the world */


/* ---------------------------------------------------------------- words */


/* ---------------------------------------------------------------- hover cards */
var _inspectHTMLDeep = inspectHTML;
inspectHTML = function(mx, my){
  if(inDeep() && inb(mx,my) && (revealAll||seen[idxOf(mx,my)])){
    var p=propAt(mx,my), e=ents.some(function(o){ return o!==player && o.x===mx && o.y===my && (revealAll||vis[idxOf(mx,my)]); });
    if(p && p.curtain && !e) return '<div class="nm">Web curtain</div><div class="hint">Blocks the way. One blow cuts it; fire burns it away.</div>';
  }
  return _inspectHTMLDeep.apply(this, arguments);
};

/* Named floor-generation stages; ordered by generation-adapter.js. */
function finishGeneratedDeep(seed){

  if(!inDeep() || !map) return;
  if(!floorMeta.deepRegion){ floorMeta.deepRegion=new Uint8Array(MW*MH); rooms.forEach(function(q){ q.region=0; q.shape='rect'; }); }   /* BSP fallback: all temple */
  deepFinishRegions();
  if(!floorMeta.boss){ deepDress(); deepCurtains(); }
  else if(floorMeta.bossArena){
    /* the Matron's hall is a stage: no traps on it */
    var A=floorMeta.bossArena; feats=feats.filter(function(f){ return !(f.x>=A.x && f.x<A.x+A.w && f.y>=A.y && f.y<A.y+A.h); });
  }
  /* no grass beside lava; it would only burn */
  for(var i=0;i<map.length;i++){ if(map[i]!==LAVA) continue; var x=i%MW, y=(i/MW)|0;
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(o){ var n=idxOf(x+o[0],y+o[1]); if(inb(x+o[0],y+o[1]) && (ground[n]===G_GRASS || ground[n]===G_SHORT)) ground[n]=0; }); }
  /* standing water has no place in the volcanic caves (the shared generator drops pools anywhere) */
  for(var wi=0; wi<map.length; wi++) if(map[wi]===WATER && floorMeta.deepRegion[wi]===2 && !(roomAt(wi%MW,(wi/MW)|0)||{}).pocket) map[wi]=FLOOR;
  deepLavaLights();
  if(typeof lightRulesPass==='function'){ try{ lightRulesPass(); }catch(e){} }
  /* deepDress() lays its props down after the greenery grew, so a clump can end up under one: the tile keeps the
     prop and loses the clump (2026-09-20, one piece of vegetation per tile) */
  if(floorMeta.vegSpots) floorMeta.vegSpots=floorMeta.vegSpots.filter(function(sp){ return !propAt(sp.x,sp.y); });
  if(typeof vegRemember==='function'){ try{ vegRemember(); }catch(e){} }
  if(typeof SURF_CACHE!=='undefined') SURF_CACHE.key=null;
  return;
}

/* Named travel and entry stages; ordered by transition-adapter.js. */
function moveDeepTerrain(dx,dy){
  if(inDeep() && player){
    var nx=player.x+dx, ny=player.y+dy;
    if(at(nx,ny)===LAVA && !ents.some(function(e){ return e.foe && e.x===nx && e.y===ny; })){ log('Molten rock. You cannot cross it.','c-info'); return true; }
    if(at(nx,ny)===EXIT && !floorMeta.exitOpen && floorMeta.boss){ log('The gate is sealed. It opens when the Matron of the Web is dead.','c-info'); sfx('door-locked'); return true; }
  }
  return false;
}

/* Named floor-content helpers; selected by content-adapter.js. */
function carveDeepPassage(room){
  var cells=shuffled(deepRoomCells(room)).filter(function(c){ return at(c.x,c.y)===FLOOR && !propAt(c.x,c.y) && isWallLike(at(c.x,c.y-1)) && !deepLavaAdjacent(c.x,c.y) && !(c.x===room.cx && c.y===room.cy); });
  for(var t=0; t<cells.length; t++){
    var c=cells[t], len=ri(2,4), ok=true, run=[];
    for(var i=1;i<=len && ok;i++){
      var y=c.y-i;
      if(y<2 || at(c.x,y)!==WALL || at(c.x-1,y)!==WALL || at(c.x+1,y)!==WALL) ok=false; else run.push({x:c.x, y:y});
    }
    var ey=c.y-len-1;
    if(!ok || ey<1 || at(c.x,ey)!==WALL || at(c.x-1,ey)!==WALL || at(c.x+1,ey)!==WALL) continue;
    run.forEach(function(p){ setT(p.x,p.y,FLOOR); });
    return run[run.length-1];
  }
  return null;
}
