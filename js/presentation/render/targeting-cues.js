/* Quiet reach tint, the original target square, and the spell's own footprint.
 * Range is a reach cue, not a promise that a spell accepts every destination.
 * The casting owner supplies reach; silhouettes and remembered terrain must
 * never disclose a concealed actor through this presentation-only pass. */
function drawTargetingCues(){
  if(!aiming||!player||player.hp<=0)return;
  var A=aiming.A,all=revealAll&&!playerBlind(),V=sceneVisibility(),S=seen;
  function known(x,y){return inb(x,y)&&(all||V[idxOf(x,y)]||A.kind==='umbral'&&S[idxOf(x,y)]);}
  var left=Math.max(0,camX),right=Math.min(MW-1,camX+viewW),
      top=Math.max(0,camY),bottom=Math.min(MH-1,camY+viewH);
  ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  ctx.setLineDash([]);ctx.lineCap='round';ctx.lineJoin='round';
  for(var y=top;y<=bottom;y++)for(var x=left;x<=right;x++){
    if(x===player.x&&y===player.y||!known(x,y)||!inRange(x,y,V))continue;
    var px=(x-camX)*TS,py=(y-camY)*TS,remembered=!all&&!V[idxOf(x,y)];
    ctx.fillStyle=remembered?'rgba(195,188,171,.07)':'rgba(226,98,43,.10)';
    ctx.fillRect(px,py,TS,TS);
  }
  if(known(hoverX,hoverY)){
    var ok=inRange(hoverX,hoverY,V),lit=all||V[idxOf(hoverX,hoverY)],
        hx=(hoverX-camX)*TS,hy=(hoverY-camY)*TS;
    ctx.fillStyle=ok?'rgba(232,180,74,.16)':'rgba(184,69,58,.16)';
    ctx.fillRect(hx+1,hy+1,TS-2,TS-2);
    // Area geometry remains owned by the existing effect preview. Do not
    // query its occupancy-dependent detail on remembered Umbral ground.
    if(ok&&lit&&typeof previewPath==='function')previewPath(player.x,player.y,hoverX,hoverY,A);
    ctx.globalAlpha=1;ctx.lineWidth=Math.max(1.25,Math.min(2,TS*.055));
    ctx.strokeStyle=!lit?'#D8D0BF':ok?'#F0C76F':'#D66D5E';
    ctx.strokeRect(hx+1,hy+1,TS-2,TS-2);
  }
  ctx.restore();
}

/* Both line and area previews use the same scene visibility as the target
 * square. The shared footprint geometry remains with the cast rules. */
function previewPath(ax,ay,x,y,A){
  if(A.kind==='bolt'){
    var points=boltPath(ax,ay,x,y);ctx.globalAlpha=.35;ctx.fillStyle='#E8B44A';
    for(var i=0;i<points.length-1;i++)ctx.fillRect((points[i].x-camX+.5)*TS-1.5,(points[i].y-camY+.5)*TS-1.5,3,3);
    ctx.globalAlpha=1;
  }
  if(!['blast','aoe','lflame','cone','beam','tomb','upheaval'].includes(A.kind))return;
  var walls=A.kind==='upheaval'?upheavalWallTiles(x,y):[],center=A.kind==='tomb'?foeAt(x,y):null,visible=sceneVisibility();
  ctx.save();ctx.lineWidth=1;
  effectFootprint(A,x,y,visible).forEach(function(p){
    if(!visible[idxOf(p[0],p[1])])return;
    var wall=walls.some(function(w){return w[0]===p[0]&&w[1]===p[1];}),tomb=A.kind==='tomb'&&(center?entityOccupies(center,p[0],p[1]):p[0]===x&&p[1]===y);
    ctx.fillStyle=wall?'rgba(177,141,82,.55)':tomb?'rgba(165,225,255,.55)':A.kind==='tomb'?'rgba(115,195,245,.20)':'rgba(240,175,70,.20)';
    ctx.strokeStyle=tomb?'rgba(225,250,255,.95)':A.kind==='tomb'?'rgba(150,220,255,.8)':'rgba(255,205,110,.8)';
    var px=(p[0]-camX)*TS,py=(p[1]-camY)*TS;ctx.fillRect(px,py,TS,TS);ctx.strokeRect(px+1,py+1,TS-2,TS-2);
  });
  ctx.restore();
}
