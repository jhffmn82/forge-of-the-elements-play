/* vegetation.js - plants grow where plants would grow (2026-09-19).
   Justin: art pieces are for now and then; vegetation should be used generously, in clusters - around water, in
   groups, in themed rooms, never dotted about at random. The Dungeon's grass used to be 2-4 blobs dropped in
   random rooms. Now every room has a mood (lush, some, bare) and a moisture field decides where things grow:
   wettest beside water and puddles, then along the foot of the walls and in corners, shaped by smooth noise so
   growth comes in joined masses. Most of it is short grass (you can see over it); tall grass - which hides you and
   blocks sight - only fills the wettest cores of lush rooms. Corridors get the odd weed along the wall.
   It also marks where bushes, ferns and flowers belong (floorMeta.vegSpots) for the vegetation art pack; until that
   art arrives nothing is drawn for them. Gardens keep their own planting. Dungeon only for now: the Crypt and the
   Caverns get theirs with the vegetation pack. */
var VEG = {
  mood: [['lush',0.30], ['some',0.40], ['bare',0.30]],
  damp:  {lush:0.22, some:0.06, bare:0},        /* how damp the whole room is */
  short: {lush:0.30, some:0.50, bare:0.80},     /* moisture needed for short grass */
  tall:  {lush:0.62, some:0.82, bare:9},        /* ... and for tall grass */
  spot:  {lush:0.50, some:0.70, bare:9}         /* ... and for a plant (bush / fern / flowers) */
};
function vegNoise(x, y, s){ return typeof ptVal==='function' ? ptVal(x, y, s) : hash2(Math.floor(x), Math.floor(y), s); }
function vegGrow(){
  if(typeof map==='undefined' || !map || !ground || bidx()!==0 || (floorMeta && floorMeta.plane)) return;
  var salt=Math.floor(rng()*1e6), N=MW*MH, i, x, y;
  /* the old random blobs go (gardens keep theirs) */
  var inGarden=new Uint8Array(N);
  rooms.forEach(function(r){ if(r.special!=='garden') return; for(var yy=r.y;yy<r.y+r.h;yy++) for(var xx=r.x;xx<r.x+r.w;xx++) if(inb(xx,yy)) inGarden[idxOf(xx,yy)]=1; });
  for(i=0;i<N;i++) if(!inGarden[i] && (ground[i]===G_GRASS || ground[i]===G_SHORT)) ground[i]=0;
  /* distance to water, out to 4 */
  var wet=new Uint8Array(N).fill(9), q=[];
  for(i=0;i<N;i++) if(map[i]===WATER || ground[i]===G_PUDDLE){ wet[i]=0; q.push(i); }
  for(var h=0; h<q.length; h++){ var c=q[h], cx=c%MW, cy=(c/MW)|0; if(wet[c]>=4) continue;
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){ var nx=cx+d[0], ny=cy+d[1]; if(!inb(nx,ny)) return; var ni=idxOf(nx,ny); if(wet[ni]>wet[c]+1){ wet[ni]=wet[c]+1; q.push(ni); } }); }
  function wallN(x,y){ var n=0; for(var dy=-1;dy<=1;dy++) for(var dx=-1;dx<=1;dx++) if((dx||dy) && isWallLike(at(x+dx,y+dy))) n++; return n; }
  function free(x,y){ return at(x,y)===FLOOR && !ground[idxOf(x,y)] && !propAt(x,y) && Math.max(Math.abs(x-player.x),Math.abs(y-player.y))>1; }
  function moisture(x,y){
    var i2=idxOf(x,y), w=wet[i2]<9 ? Math.max(0, 1-wet[i2]*0.22) : 0, n=wallN(x,y);
    var wall = n>=5 ? 0.42 : n>=3 ? 0.34 : n>=1 ? 0.22 : 0;          /* corners are dampest */
    var patch = (vegNoise(x*0.33, y*0.33, salt+1)-0.5)*0.55 + (vegNoise(x*0.9, y*0.9, salt+2)-0.5)*0.2;
    return Math.max(w, wall) + patch + (w>0 && wall>0 ? 0.1 : 0);
  }
  var spots=[], inRoom=new Uint8Array(N);
  rooms.forEach(function(r){
    for(var yy=r.y;yy<r.y+r.h;yy++) for(var xx=r.x;xx<r.x+r.w;xx++) if(inb(xx,yy)) inRoom[idxOf(xx,yy)]=1;
    if(r.special==='garden') return;
    var t=VEG.mood.reduce(function(a,m){ return a+m[1]; },0), rr=rng()*t, mood='some';
    for(var k=0;k<VEG.mood.length;k++){ rr-=VEG.mood[k][1]; if(rr<=0){ mood=VEG.mood[k][0]; break; } }
    if(r.role==='start' && mood==='lush') mood='some';
    if(r.role==='boss') mood='bare';
    r.greenery=mood;
    for(yy=r.y;yy<r.y+r.h;yy++) for(xx=r.x;xx<r.x+r.w;xx++){
      if(!free(xx,yy)) continue;
      var m=moisture(xx,yy)+VEG.damp[mood];
      if(m>=VEG.tall[mood]) setG(xx,yy,G_GRASS);
      else if(m>=VEG.short[mood]) setG(xx,yy,G_SHORT);
      if(m>=VEG.spot[mood] && wallN(xx,yy)>=1 && hash2(xx,yy,salt+5)<0.35) spots.push({x:xx, y:yy, mood:mood, wet:wet[idxOf(xx,yy)]<3});
    }
  });
  /* corridors: the odd weed where the floor meets the wall */
  for(y=1;y<MH-1;y++) for(x=1;x<MW-1;x++){
    i=idxOf(x,y); if(inRoom[i] || !free(x,y) || !wallN(x,y)) continue;
    if(vegNoise(x*0.5, y*0.5, salt+3)>0.72 && hash2(x,y,salt+4)<0.6) setG(x,y,G_SHORT);
  }
  floorMeta.vegSpots=spots;
}
var _generateVeg = generate;
generate = function(seed){ var r=_generateVeg.apply(this, arguments); try{ vegGrow(); }catch(e){ if(window.console) console.warn('vegetation', e); } return r; };
