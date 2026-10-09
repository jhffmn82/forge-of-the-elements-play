/* ============================================================================
   fx.js - projectiles with particle trails, impact bursts, embers, explosions,
   death animations. Replaces js/runtime/game.js boltFx(), drawCorpse() and drawFX().
   ========================================================================== */

var PARTS = [];
var FX_LAST = performance.now();
var TRAIL = {
  phys:     {col:['#D8CFC0','#8A7F74'], size:1.6, rate:0.6, life:260, drift:0},
  fire:     {col:['#FFD36A','#FF7A30','#C0391B'], size:3.2, rate:2.2, life:420, drift:-0.012, glow:'#FF7A30'},
  ice:      {col:['#E8F8FF','#8FD3FF','#4FA0E0'], size:2.4, rate:1.6, life:520, drift:0.002, glow:'#8FD3FF'},
  lightning:{col:['#FFFFFF','#FFE45C','#FFF1A0'], size:2.0, rate:1.4, life:180, drift:0, glow:'#FFE45C', jag:true},
  poison:   {col:['#B7E07A','#6FA040','#4E7A2A'], size:2.6, rate:1.4, life:520, drift:0.01, glow:'#8FC45A'},
  earth:    {col:['#A8865A','#6E5A3E','#C0A070'], size:2.8, rate:1.2, life:480, drift:0.03},
  light:    {col:['#FFFFFF','#FFF1B8','#FFD86A'], size:2.6, rate:2.0, life:460, drift:-0.006, glow:'#FFF1B8'},
  dark:     {col:['#D0A8FF','#8A5AC8','#3A2060'], size:3.0, rate:2.0, life:560, drift:-0.004, glow:'#B58BFF'},
  magic:    {col:['#FFFFFF','#D9B8FF','#9A6AF0'], size:2.4, rate:2.2, life:420, drift:-0.004, glow:'#D9B8FF'},
  heal:     {col:['#DFFFE0','#7FD08A'], size:2.2, rate:1, life:700, drift:-0.02, glow:'#7FD08A'}
};
function trailPalette(type,fallback){
  return Object.prototype.hasOwnProperty.call(TRAIL,type) ? TRAIL[type] : TRAIL[fallback||'phys'];
}

function particle(x,y,o){
  if(ANIM.reduce && !o.force) return;
  if(PARTS.length>900) PARTS.shift();
  PARTS.push({x:x,y:y,vx:o.vx||0,vy:o.vy||0,life:o.life||400,max:o.life||400,col:o.col||'#FFF',size:o.size||2,grav:o.grav||0,glow:!!o.glow,shrink:o.shrink!==false});
}
function burst(tx,ty,type,n,spread){
  var t=trailPalette(type); n=n||14; spread=spread||0.06;
  for(var i=0;i<n;i++){
    var a=Math.random()*Math.PI*2, s=Math.random()*spread;
    particle(tx+0.5, ty+0.5, {vx:Math.cos(a)*s, vy:Math.sin(a)*s + (t.drift||0)*4, life:t.life*(0.6+Math.random()*0.8),
      col:t.col[Math.floor(Math.random()*t.col.length)], size:t.size*(0.7+Math.random()*0.8), glow:!!t.glow, grav:type==='earth'?0.0006:0});
  }
}
function emitFire(x,y){
  if(Math.random()<0.25) particle(x+0.3+Math.random()*0.4, y+0.75, {vx:(Math.random()-0.5)*0.004, vy:-0.012-Math.random()*0.01, life:500+Math.random()*300,
    col:Math.random()<0.5?'#FFB040':'#FF6A20', size:1.6+Math.random()*1.6, glow:true});
}
function explosionFx(x,y){
  burst(x,y,'fire',46,0.14); burst(x,y,'earth',18,0.1);
  for(var i=0;i<14;i++){ var a=Math.random()*6.28; particle(x+0.5,y+0.5,{vx:Math.cos(a)*0.03, vy:Math.sin(a)*0.03-0.01, life:900, col:'rgba(60,55,50,0.7)', size:6+Math.random()*6, shrink:false}); }
  SHAKE=Math.max(SHAKE, 10);
}
function sparkleFx(x,y,type,n){ burst(x,y,type||'heal',n||18,0.035); }
var SHAKE=0;

/* projectiles: queued in order with everything else via fxAt */
function boltFx(ax,ay,bx,by,type,opts){
  var d=Math.max(1, Math.max(Math.abs(bx-ax), Math.abs(by-ay)));
  var discharge=type==='lightning'&&opts&&opts.staticDischarge&&!opts.arrow;
  /* an arrow is loosed, not lobbed: about a third of the flight time of a spell bolt (2026-09-18) */
  var dur=discharge?(ANIM.reduce?180:260):(opts && opts.arrow) ? 45+18*d : 110+55*d;
  var el = type==='phys' && opts && opts.arrow ? 'arrow' : type;
  var bolt={k:discharge?'arc':'p', ax:ax, ay:ay, bx:bx, by:by, type:type, arrow: !!(opts&&opts.arrow), explosion:!!(opts&&opts.explosion), dur:dur, hit:false, sfxHit: opts&&opts.sfxHit, silentHit:!!(opts&&opts.silentHit)};
  if(type==='lightning')bolt.seed=Math.floor(Math.random()*2147483647);
  // Secondary discharges share the hit's presentation clock without holding
  // input or extending the turn for each extra enemy in a group.
  bolt.t0=fxAt(dur, discharge?0:dur*0.85, discharge||!turnAnimationEffectVisible(bolt));
  fx.push(bolt);
}

/* Both player and enemy beams draw their actual affected cells. Keep gaps in
 * the footprint, and let the existing animation clock handle cast windup. */
function beamFx(tiles,type,opts){
  opts=opts||{};
  var palette=trailPalette(type,'magic');
  var beam={k:'beam',tiles:tiles.map(function(t){return t.slice();}),col:opts.col||palette.glow||palette.col[0],dur:opts.dur||(ANIM.reduce?180:320)};
  beam.t0=fxAt(beam.dur,beam.dur*.65,!tiles.some(function(t){return inb(t[0],t[1])&&(revealAll||vis[idxOf(t[0],t[1])]);}));
  fx.push(beam);
}

/* World-space static discharges: an elapsed-time phase changes their jagged
 * path and forks, independently of render FPS. Endpoints stay on cell centers;
 * the ordinary camera transform and zoom are applied only when painting. */
function dischargeNoise(seed,phase,index){
  var n=Math.imul((seed||1)^(phase*374761393),668265263)^Math.imul(index+17,1274126177);
  n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;
}
function lightningDischargePaths(f,p,reach){
  var dx=(f.bx-f.ax)*reach,dy=(f.by-f.ay)*reach,length=Math.hypot(dx,dy),nx=length?-dy/length:0,ny=length?dx/length:1;
  var phase=ANIM.reduce?0:Math.floor(p*9),segments=Math.max(5,Math.ceil(length*3)),points=[],forks=[];
  for(var i=0;i<=segments;i++){
    var q=i/segments,offset=i&&i<segments?(dischargeNoise(f.seed,phase,i)-.5)*.48*Math.sin(q*Math.PI):0;
    points.push([f.ax+.5+dx*q+nx*offset,f.ay+.5+dy*q+ny*offset]);
  }
  if(!ANIM.reduce)for(var j=0;j<2;j++){
    var at=Math.max(1,Math.min(segments-1,Math.round(segments*(.3+j*.37)))),base=points[at],side=j?1:-1;
    var spread=.2+dischargeNoise(f.seed,phase,segments+j)*.25,forward=.1+dischargeNoise(f.seed,phase,segments+j+2)*.16;
    forks.push([base,[base[0]+nx*side*spread+dx/(length||1)*forward,base[1]+ny*side*spread+dy/(length||1)*forward],
      [base[0]+nx*side*spread*.6+dx/(length||1)*forward*2,base[1]+ny*side*spread*.6+dy/(length||1)*forward*2]]);
  }
  return {trunk:points,forks:forks,phase:phase};
}
function drawLightningDischarge(f,p,reach){
  var paths=lightningDischargePaths(f,p,reach),fade=Math.min(1,(1-p)*1.5);
  var flicker=ANIM.reduce?.85:.65+.35*dischargeNoise(f.seed,paths.phase,91);
  function path(points){ctx.beginPath();points.forEach(function(point,index){var x=(point[0]-camX)*TS,y=(point[1]-camY)*TS;if(index)ctx.lineTo(x,y);else ctx.moveTo(x,y);});}
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';ctx.lineJoin='round';
  path(paths.trunk);ctx.globalAlpha=fade*.2;ctx.strokeStyle='#C8DFFF';ctx.lineWidth=Math.max(3,TS*.13);ctx.stroke();
  ctx.globalAlpha=fade*flicker;ctx.strokeStyle='#F4EBA8';ctx.lineWidth=Math.max(1.4,TS*.045);ctx.stroke();
  ctx.strokeStyle='#FFFFFF';ctx.lineWidth=Math.max(.7,TS*.016);ctx.stroke();
  ctx.globalAlpha=fade*flicker*.6;ctx.strokeStyle='#D2E9FF';ctx.lineWidth=Math.max(.7,TS*.021);
  paths.forks.forEach(function(points){path(points);ctx.stroke();});ctx.restore();
}

function drawCorpse(f, p, opacity){
  opacity=opacity===undefined?1:opacity;
  var px=(f.e.x-camX)*TS, py=(f.e.y-camY)*TS;
  if(!spriteOn){
    ctx.save();ctx.globalAlpha=opacity*(f.remains?1:1-p);ctx.fillStyle=f.e.col||'#7C6654';ctx.fillRect(px+TS*.18,py+TS*.6,TS*.64,TS*.2);ctx.restore();return;
  }
  if(f.e.livingFlame){drawLivingFlame(f.e,px,py,{alpha:opacity*(1-p),flip:f.e.flip});return;}
  var ms = spriteOn && f.e.sprite ? (f.e.shade?shadeSummonSheet():mobSheet(f.e.sprite)) : null;
  if(f.e.shade)opacity*=.62;
  if(ms && ms.m.clips.death){
    var c=ms.m.clips.death, cell=ms.m.cell, fr=Math.min(c.frames-1, Math.floor(p*c.frames*1.05)), box=ms.m.box||[0,0,cell,cell];
    var target=TS*(f.e.art||0.9), s=target/Math.max(box[3], box[2]*0.8);
    var dx=px+TS/2-(box[0]+box[2]/2)*s, dy=py+TS*0.97-(box[1]+box[3])*s;
    ctx.save(); ctx.globalAlpha = opacity*(f.remains?1:p<0.75?1:(1-p)/0.25); ctx.imageSmoothingEnabled=spriteSheetSmoothing(ms,s);
    if(f.e.flip){ ctx.translate(px+TS/2,0); ctx.scale(-1,1); ctx.translate(-(px+TS/2),0); }
    ctx.drawImage(ms.img, fr*cell, c.row*cell, cell, cell, dx, dy, cell*s, cell*s); ctx.restore();
    return;
  }
  /* No usable death clip: the standing sprite flashes and keels onto its side. */
  if(ms){
    var m=ms.m, cell2=m.cell, box2=m.box||[0,0,cell2,cell2], srow=m.static_row!==undefined ? m.static_row : (m.clips.idle ? m.clips.idle.row : 0);
    var t2=TS*(f.e.art||0.9), s2=t2/Math.max(box2[3], box2[2]*0.8);
    var fall=Math.min(1, p/0.45), ease=fall*fall, dir=f.e.flip ? -1 : 1;
    var fx0=px+TS/2, fy0=py+TS*0.95;
    ctx.save();
    ctx.globalAlpha = opacity*(f.remains?1:p<0.6?1:Math.max(0,(1-p)/0.4));
    ctx.translate(fx0, fy0); ctx.rotate(dir*ease*Math.PI*0.5); ctx.translate(-fx0, -fy0);
    ctx.imageSmoothingEnabled=spriteSheetSmoothing(ms,s2);
    ctx.drawImage(ms.img, 0, srow*cell2, cell2, cell2, px+TS/2-(box2[0]+box2[2]/2)*s2, py+TS*0.97-(box2[1]+box2[3])*s2, cell2*s2, cell2*s2);
    if(p<0.25 && typeof whiteCut==='function'){ ctx.globalAlpha*= (0.25-p)/0.25*0.8; ctx.drawImage(whiteCut(ms.img,0,srow*cell2,cell2,cell2), px+TS/2-(box2[0]+box2[2]/2)*s2, py+TS*0.97-(box2[1]+box2[3])*s2, cell2*s2, cell2*s2); }
    ctx.restore();
    if(!f.dust && p>0.4){ f.dust=true; if(typeof burst==='function') burst(f.e.x, f.e.y, 'earth', 10, 0.03); }
  }
}

/* Cosmetic remains are floor state, never actors or props. This keeps them
 * beneath creatures, nonblocking, and intact across saves and floor travel. */
function turnDeathRemains(clock){
  if(floorMeta&&floorMeta.deathRemains)floorMeta.deathRemains=floorMeta.deathRemains.filter(function(c){return clock<c.expiresAt;});
}
function drawDeathRemains(){
  var now=performance.now(),dying=fx.filter(function(f){return f.k==='d'&&now<f.t0+f.dur;}),animating=new Set();
  dying.forEach(function(f){if(f.remains)animating.add(f.remains);});
  if(floorMeta&&floorMeta.deathRemains)floorMeta.deathRemains.forEach(function(c){
    var e=c.e,i=idxOf(e.x,e.y);
    if(worldNow()>=c.expiresAt||!(revealAll||seen[i]))return;
    if(animating.has(c))return;
    drawCorpse({e:e,remains:c,dust:true},1,(revealAll||vis[i])?1:memA(.45));
  });
  /* 2026-09-27 (render plan C8): the death clip plays here, lit and under whoever stands nearby, like the remains it
     becomes. Drawn with the effects, over the lighting, the body was about twice as bright until the clip ended. */
  dying.forEach(function(f){drawCorpse(f,Math.max(0,(now-f.t0)/f.dur));});
}

/* 2026-10-05 (item art, C2): the arrow in flight is item-arrow, a picture of a lit torch flown flame first. An arrow can
   be drawn here in its place, tip up at the origin of a turned context: a plum-edged wooden shaft, a steel head and two
   dull red vanes, as long as the picture is (0.55 tile). 2026-10-06 (Justin picked the drawn arrow): it is
   the only arrow now; the picture is no longer flown. */
function drawArrowInFlight(){
  var L=TS*0.55, w=Math.max(1.5,TS*0.028), hl=L*0.26, hw=Math.max(2,TS*0.055), fl=L*0.3, fw=Math.max(2,TS*0.05), edge=Math.max(0.75,TS/90);
  function head(){ ctx.beginPath(); ctx.moveTo(0,-L/2); ctx.lineTo(hw,-L/2+hl); ctx.lineTo(0,-L/2+hl*0.72); ctx.lineTo(-hw,-L/2+hl); ctx.closePath(); }
  function vanes(){ ctx.beginPath(); [-1,1].forEach(function(d){ ctx.moveTo(0,L/2-fl); ctx.lineTo(d*fw,L/2-fl*0.55); ctx.lineTo(d*fw,L/2); ctx.lineTo(0,L/2-fl*0.3); ctx.closePath(); }); }
  ctx.lineJoin='round'; ctx.strokeStyle='#241A2B'; ctx.lineWidth=edge*2;
  vanes(); ctx.stroke(); head(); ctx.stroke();
  ctx.fillStyle='#241A2B'; ctx.fillRect(-w/2-edge, -L/2+hl*0.6, w+edge*2, L-hl*0.6);
  ctx.fillStyle='#B8936A'; ctx.fillRect(-w/2, -L/2+hl*0.6, w, L-hl*0.6-edge);
  vanes(); ctx.fillStyle='#A8483A'; ctx.fill();
  head(); ctx.fillStyle='#D6DCE2'; ctx.fill();
}

var FLOAT_TEXT_TILE=64;   /* the tile size past which floating text no longer grows (see the text branch of drawFX) */
function drawFX(){
  var now=performance.now(), dt=Math.min(64, now-FX_LAST); FX_LAST=now;
  var keep=[];
  for(var i=0;i<fx.length;i++){
    var f=fx[i], p=(now-f.t0)/f.dur;
    if(p>=1){
      if((f.k==='p'||f.k==='arc') && !f.hit){ f.hit=true;
        if(f.explosion)explosionFx(f.bx,f.by);else burst(f.bx,f.by, f.arrow?'phys':f.type, f.type==='phys'?6:18, 0.05);
        if(!f.silentHit && typeof sfx==='function') sfx(f.sfxHit || hitSfxFor(f.type), {from:{x:f.bx,y:f.by}}); }
      continue;
    }
    keep.push(f);
    if(f.k==='d') continue;   /* death clips play in the lit floor pass (drawDeathRemains) */
    if(p<0) continue;
    if(f.k==='l') continue;
    if(f.k==='t'){
      var px=(f.x-camX+0.5+f.jitter)*TS, py=(f.y-camY)*TS;
      var rise=TS*0.9*p;
      ctx.globalAlpha = p<0.75 ? 1 : (1-p)/0.25;
      /* 2026-10-06 (Justin: 'why is the text so large? we have to fix that'): a floating word was a third of a tile with no
         limit, so at the closest zoom (96 px tiles) it was half again as large as at the usual one. It stops growing at a 64 px tile. */
      var portraitText=typeof document!=='undefined'&&document.body&&document.body.classList.contains('study-touch')&&document.body.classList.contains('study-portrait');
      var textFloor=portraitText?(f.big?16:14):9;
      var fs=Math.max(textFloor,Math.round(Math.min(TS,FLOAT_TEXT_TILE)*(f.big?0.43:0.33)*(p<0.12 ? 0.7+p*2.5 : 1)));
      ctx.font='500 '+fs+'px "IBM Plex Mono",monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
      var width=ctx.measureText(String(f.text)).width;
      if(width>TS*1.8){
        fs=Math.max(textFloor,Math.floor(fs*TS*1.8/width));
        ctx.font='500 '+fs+'px "IBM Plex Mono",monospace';
      }
      var textY=py+TS*(0.45+(f.offsetY||0))-rise;
      ctx.lineWidth=Math.max(0.8,Math.min(1.5,TS*0.02));
      ctx.strokeStyle='rgba(0,0,0,.8)'; ctx.strokeText(f.text, px, textY);
      ctx.fillStyle=f.col; ctx.fillText(f.text, px, textY); ctx.lineWidth=1;
      ctx.globalAlpha=1;
    } else if(f.k==='p'){
      var ease = (f.arrow || f.type==='lightning') ? p : p*p*(3-2*p)*0.35 + p*0.65;
      var cx=f.ax+(f.bx-f.ax)*ease, cy=f.ay+(f.by-f.ay)*ease;
      var t=trailPalette(f.type);
      if(f.arrow){
        var ang=Math.atan2(f.by-f.ay, f.bx-f.ax), ao=null;
        var hx=(cx-camX+0.5)*TS, hy=(cy-camY+0.5)*TS;
        /* a light streak behind the point, fading back along the flight line */
        var tail=TS*1.25, txp=hx-Math.cos(ang)*tail, typ=hy-Math.sin(ang)*tail;
        var g=ctx.createLinearGradient(txp,typ,hx,hy);
        g.addColorStop(0,'rgba(255,240,200,0)');
        g.addColorStop(0.65,'rgba(255,238,190,0.28)');
        g.addColorStop(1,'rgba(255,250,225,0.85)');
        ctx.save(); ctx.globalCompositeOperation='lighter';
        ctx.strokeStyle=g; ctx.lineWidth=Math.max(1.5, TS*0.07); ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(txp,typ); ctx.lineTo(hx,hy); ctx.stroke();
        ctx.restore();
        /* the sprite is drawn pointing up, so +90 degrees aims it along the flight */
        ctx.save(); ctx.translate(hx,hy); ctx.rotate(ang + Math.PI/2);
        if(ao){ var s2=TS*0.55/Math.max(ao.sw,ao.sh); ctx.imageSmoothingEnabled=true; ctx.drawImage(ao.img,ao.sx,ao.sy,ao.sw,ao.sh,-ao.sw*s2/2,-ao.sh*s2/2,ao.sw*s2,ao.sh*s2); }
        else if(spriteOn) drawArrowInFlight();
        else { ctx.fillStyle='#D8CFC0'; ctx.fillRect(-1,-TS*0.25,2,TS*0.5); }
        ctx.restore();
        for(var sp=0; sp<2; sp++)
          particle(cx+0.5-Math.cos(ang)*0.25, cy+0.5-Math.sin(ang)*0.25,
            {vx:-Math.cos(ang)*0.01, vy:-Math.sin(ang)*0.01, life:150+Math.random()*90,
             col:'rgba(255,244,210,.65)', size:1.3, glow:true});
      } else if(f.type==='lightning'){
        drawLightningDischarge(f,p,ease);
        for(var z=0;z<2;z++) particle(cx+0.5,cy+0.5,{vx:(Math.random()-0.5)*0.03,vy:(Math.random()-0.5)*0.03,life:160,col:'#FFE45C',size:1.6,glow:true});
      } else {
        for(var e2=0;e2<t.rate*2;e2++){
          particle(cx+0.5+(Math.random()-0.5)*0.15, cy+0.5+(Math.random()-0.5)*0.15, {vx:(Math.random()-0.5)*0.006, vy:(Math.random()-0.5)*0.006+(t.drift||0),
            life:t.life*(0.5+Math.random()*0.6), col:t.col[Math.floor(Math.random()*t.col.length)], size:t.size*(0.6+Math.random()*0.7), glow:!!t.glow});
        }
        var hx=(cx-camX+0.5)*TS, hy=(cy-camY+0.5)*TS;
        ctx.save(); ctx.globalCompositeOperation='lighter';
        var g=ctx.createRadialGradient(hx,hy,0,hx,hy,TS*0.42); g.addColorStop(0, hexA(t.glow||t.col[0],0.9)); g.addColorStop(1, hexA(t.glow||t.col[0],0));
        ctx.fillStyle=g; ctx.fillRect(hx-TS*0.45,hy-TS*0.45,TS*0.9,TS*0.9);
        ctx.fillStyle=t.col[0]; ctx.beginPath(); ctx.arc(hx,hy,TS*0.09,0,7); ctx.fill(); ctx.restore();
      }
    } else if(f.k==='arc'){
      drawLightningDischarge(f,p,1);
    } else if(f.k==='beam'){
      /* Grid beams preserve gaps in their warning; they never bridge safe cells. */
      ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
      var beamPrior=null;
      f.tiles.forEach(function(tile,index){
        if(!inb(tile[0],tile[1])||!(revealAll||vis[idxOf(tile[0],tile[1])])){beamPrior=null;return;}
        var prior=beamPrior,x=(tile[0]-camX+.5)*TS,y=(tile[1]-camY+.5)*TS;beamPrior=tile;
        if(!prior||Math.max(Math.abs(prior[0]-tile[0]),Math.abs(prior[1]-tile[1]))>1){
          ctx.moveTo(x,y);
          // A single affected cell still has a visible beam core. A move-only
          // subpath paints nothing, including a segment isolated by fog.
          var next=f.tiles[index+1];
          if(!next||!inb(next[0],next[1])||!(revealAll||vis[idxOf(next[0],next[1])])||Math.max(Math.abs(next[0]-tile[0]),Math.abs(next[1]-tile[1]))>1)ctx.lineTo(x+.01,y);
        }
        else ctx.lineTo(x,y);
      });
      ctx.globalAlpha=(1-p)*.8;ctx.strokeStyle=f.col;ctx.lineWidth=TS*.18;ctx.stroke();
      ctx.globalAlpha=1-p;ctx.strokeStyle='#FFF9E9';ctx.lineWidth=Math.max(1,TS*.045);ctx.stroke();ctx.restore();
    } else if(f.k==='b'){
      /* legacy straight bolt, kept for anything still calling it with k:'b' */
      var x=(f.ax+(f.bx-f.ax)*p-camX+0.5)*TS, y=(f.ay+(f.by-f.ay)*p-camY+0.5)*TS;
      ctx.fillStyle=f.col; ctx.fillRect(x-TS*0.1, y-TS*0.1, TS*0.2, TS*0.2);
    } else if(f.k==='ring'){
      ctx.save(); ctx.globalAlpha=(1-p)*(f.a||0.8); ctx.strokeStyle=f.col; ctx.lineWidth=f.w||3;
      ctx.beginPath(); ctx.arc((f.x-camX+0.5)*TS,(f.y-camY+0.5)*TS, TS*f.r*p, 0, 7); ctx.stroke(); ctx.restore();
    }
  }
  fx=keep;
  /* particles */
  ctx.save();
  for(var j=PARTS.length-1;j>=0;j--){
    var pt=PARTS[j];
    pt.life-=dt; if(pt.life<=0){ PARTS.splice(j,1); continue; }
    pt.vy+=pt.grav*dt; pt.x+=pt.vx*dt*0.06; pt.y+=pt.vy*dt*0.06;
    var lf=pt.life/pt.max, sz=pt.size*(pt.shrink?(0.35+0.65*lf):1);
    ctx.globalCompositeOperation = pt.glow ? 'lighter' : 'source-over';
    ctx.globalAlpha=Math.min(1, lf*1.4);
    ctx.fillStyle=pt.col;
    ctx.fillRect((pt.x-camX)*TS - sz/2, (pt.y-camY)*TS - sz/2, sz, sz);
  }
  ctx.restore();
  ctx.globalAlpha=1;
}
function hitSfxFor(type){
  var sounds={phys:'arrow-hit', fire:'fire-hit', ice:'ice-hit', lightning:'lightning-hit', poison:'earth-hit', earth:'earth-hit', light:'light-hit', dark:'shadow-hit', magic:'magic-missile-hit'};
  return Object.prototype.hasOwnProperty.call(sounds,type) ? sounds[type] : 'hit-flesh';
}
function ringFx(x,y,col,r,o){ fx.push({k:'ring', x:x, y:y, col:col||'#FFF', r:r||2, t0:(o&&o.at)||performance.now(), dur:(o&&o.dur)||450, a:o&&o.a, w:o&&o.w}); }   /* o.at: a later start (2026-09-28) */

/* keep frames coming while particles live */
function fxTick(t){
  var live = fx.length>0 || PARTS.length>0 || !ANIM.reduce;
  /* 2026-09-22: 60 fps while the hero slides - a 170 ms step drawn at 30 fps was five positions, a visible
     stutter (Justin) - and 30 fps the rest of the time, for the phones' sake */
  var cap = (typeof motionActive==='function' && typeof player!=='undefined' && player && motionActive(player, t||performance.now())) ? 15 : 33;
  if(live){ if(!t || t-lastFrame>=cap){ lastFrame=t||0; draw(); MOTION_SHOWN=performance.now(); } fxIdleFrames=3; }
  else if(fxIdleFrames>0){ fxIdleFrames--; draw(); }
  requestAnimationFrame(fxTick);
}
