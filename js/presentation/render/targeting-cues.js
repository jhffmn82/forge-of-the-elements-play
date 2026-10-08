/* Quiet reach tint, the original target square, and the spell's own footprint.
 * Range is a reach cue, not a promise that a spell accepts every destination.
 * The casting owner supplies reach; silhouettes and remembered terrain must
 * never disclose a concealed actor through this presentation-only pass. */
function drawTargetingCues(){
  if(!aiming||!player||player.hp<=0)return;
  var A=aiming.A,all=revealAll&&!playerBlind(),V=vis,S=seen;
  function known(x,y){return inb(x,y)&&(all||V[idxOf(x,y)]||A.kind==='umbral'&&S[idxOf(x,y)]);}
  var left=Math.max(0,camX),right=Math.min(MW-1,camX+viewW),
      top=Math.max(0,camY),bottom=Math.min(MH-1,camY+viewH);
  ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  ctx.setLineDash([]);ctx.lineCap='round';ctx.lineJoin='round';
  for(var y=top;y<=bottom;y++)for(var x=left;x<=right;x++){
    if(x===player.x&&y===player.y||!known(x,y)||!inRange(x,y))continue;
    var px=(x-camX)*TS,py=(y-camY)*TS,remembered=!all&&!V[idxOf(x,y)];
    ctx.fillStyle=remembered?'rgba(195,188,171,.07)':'rgba(226,98,43,.10)';
    ctx.fillRect(px,py,TS,TS);
  }
  if(known(hoverX,hoverY)){
    var ok=inRange(hoverX,hoverY),lit=all||V[idxOf(hoverX,hoverY)],
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
