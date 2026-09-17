/* ============================================================================
   fx.js - projectiles with particle trails, impact bursts, embers, explosions,
   death animations. Replaces game.js boltFx(), drawCorpse() and drawFX().
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

function particle(x,y,o){
  if(ANIM.reduce && !o.force) return;
  if(PARTS.length>900) PARTS.shift();
  PARTS.push({x:x,y:y,vx:o.vx||0,vy:o.vy||0,life:o.life||400,max:o.life||400,col:o.col||'#FFF',size:o.size||2,grav:o.grav||0,glow:!!o.glow,shrink:o.shrink!==false});
}
function burst(tx,ty,type,n,spread){
  var t=TRAIL[type]||TRAIL.phys; n=n||14; spread=spread||0.06;
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
  var dur=110+55*d;
  var el = type==='phys' && opts && opts.arrow ? 'arrow' : type;
  fx.push({k:'p', ax:ax, ay:ay, bx:bx, by:by, type:type, arrow: !!(opts&&opts.arrow), t0:fxAt(dur, dur*0.85), dur:dur, hit:false, sfxHit: opts&&opts.sfxHit});
}

function drawCorpse(f, p){
  var px=(f.e.x-camX)*TS, py=(f.e.y-camY)*TS;
  var ms = spriteOn && f.e.sprite ? mobSheet(f.e.sprite) : null;
  if(ms && ms.m.clips.death){
    var c=ms.m.clips.death, cell=ms.m.cell, fr=Math.min(c.frames-1, Math.floor(p*c.frames*1.05)), box=ms.m.box||[0,0,cell,cell];
    var target=TS*(f.e.art||0.9), s=target/Math.max(box[3], box[2]*0.8);
    var dx=px+TS/2-(box[0]+box[2]/2)*s, dy=py+TS*0.97-(box[1]+box[3])*s;
    ctx.save(); ctx.globalAlpha = p<0.75 ? 1 : (1-p)/0.25; ctx.imageSmoothingEnabled=true;
    if(f.e.flip){ ctx.translate(px+TS/2,0); ctx.scale(-1,1); ctx.translate(-(px+TS/2),0); }
    ctx.drawImage(ms.img, fr*cell, c.row*cell, cell, cell, dx, dy, cell*s, cell*s); ctx.restore();
    return;
  }
  /* no death clip yet: the standing sprite flashes, keels over onto its side and fades */
  if(ms){
    var m=ms.m, cell2=m.cell, box2=m.box||[0,0,cell2,cell2], srow=m.static_row!==undefined ? m.static_row : (m.clips.idle ? m.clips.idle.row : 0);
    var t2=TS*(f.e.art||0.9), s2=t2/Math.max(box2[3], box2[2]*0.8);
    var fall=Math.min(1, p/0.45), ease=fall*fall, dir=f.e.flip ? -1 : 1;
    var fx0=px+TS/2, fy0=py+TS*0.95;
    ctx.save();
    ctx.globalAlpha = p<0.6 ? 1 : Math.max(0,(1-p)/0.4);
    ctx.translate(fx0, fy0); ctx.rotate(dir*ease*Math.PI*0.5); ctx.translate(-fx0, -fy0);
    ctx.imageSmoothingEnabled=true;
    ctx.drawImage(ms.img, 0, srow*cell2, cell2, cell2, px+TS/2-(box2[0]+box2[2]/2)*s2, py+TS*0.97-(box2[1]+box2[3])*s2, cell2*s2, cell2*s2);
    if(p<0.25 && typeof whiteCut==='function'){ ctx.globalAlpha*= (0.25-p)/0.25*0.8; ctx.drawImage(whiteCut(ms.img,0,srow*cell2,cell2,cell2), px+TS/2-(box2[0]+box2[2]/2)*s2, py+TS*0.97-(box2[1]+box2[3])*s2, cell2*s2, cell2*s2); }
    ctx.restore();
    if(!f.dust && p>0.4){ f.dust=true; if(typeof burst==='function') burst(f.e.x, f.e.y, 'earth', 10, 0.03); }
  }
}

function drawFX(){
  var now=performance.now(), dt=Math.min(64, now-FX_LAST); FX_LAST=now;
  var keep=[];
  for(var i=0;i<fx.length;i++){
    var f=fx[i], p=(now-f.t0)/f.dur;
    if(p>=1){
      if(f.k==='p' && !f.hit){ f.hit=true; burst(f.bx,f.by, f.arrow?'phys':f.type, f.type==='phys'?6:18, 0.05);
        if(typeof sfx==='function') sfx(f.sfxHit || hitSfxFor(f.type)); }
      continue;
    }
    keep.push(f);
    if(f.k==='d'){ drawCorpse(f, Math.max(0,p)); continue; }
    if(p<0) continue;
    if(f.k==='l') continue;
    if(f.k==='t'){
      var px=(f.x-camX+0.5+f.jitter)*TS, py=(f.y-camY)*TS;
      var rise=TS*0.9*p;
      ctx.globalAlpha = p<0.75 ? 1 : (1-p)/0.25;
      var fs=Math.round(TS*(f.big?0.62:0.46)*(p<0.12 ? 0.7+p*2.5 : 1));
      ctx.font='700 '+fs+'px "IBM Plex Mono",monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,.85)'; ctx.strokeText(f.text, px, py+TS*0.45-rise);
      ctx.fillStyle=f.col; ctx.fillText(f.text, px, py+TS*0.45-rise); ctx.lineWidth=1;
      ctx.globalAlpha=1;
    } else if(f.k==='p'){
      var ease = f.type==='lightning' ? p : p*p*(3-2*p)*0.35 + p*0.65;
      var cx=f.ax+(f.bx-f.ax)*ease, cy=f.ay+(f.by-f.ay)*ease;
      var t=TRAIL[f.type]||TRAIL.phys;
      if(f.arrow){
        var ang=Math.atan2(f.by-f.ay, f.bx-f.ax), ao=objArt('items','item-arrow');
        ctx.save(); ctx.translate((cx-camX+0.5)*TS,(cy-camY+0.5)*TS); ctx.rotate(ang - Math.PI/4);
        if(ao){ var s2=TS*0.55/Math.max(ao.sw,ao.sh); ctx.imageSmoothingEnabled=true; ctx.drawImage(ao.img,ao.sx,ao.sy,ao.sw,ao.sh,-ao.sw*s2/2,-ao.sh*s2/2,ao.sw*s2,ao.sh*s2); }
        else { ctx.fillStyle='#D8CFC0'; ctx.fillRect(-TS*0.25,-1,TS*0.5,2); }
        ctx.restore();
        if(Math.random()<0.5) particle(cx+0.5,cy+0.5,{life:180,col:'rgba(220,210,190,.5)',size:1.2});
      } else if(f.type==='lightning'){
        ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.strokeStyle='#FFF6B0'; ctx.lineWidth=2.2; ctx.beginPath();
        var sx=(f.ax-camX+0.5)*TS, sy=(f.ay-camY+0.5)*TS, ex=(cx-camX+0.5)*TS, ey=(cy-camY+0.5)*TS;
        ctx.moveTo(sx,sy); var segs=7;
        for(var k=1;k<=segs;k++){ var q=k/segs; ctx.lineTo(sx+(ex-sx)*q+(Math.random()-0.5)*TS*0.35*(k<segs?1:0), sy+(ey-sy)*q+(Math.random()-0.5)*TS*0.35*(k<segs?1:0)); }
        ctx.stroke(); ctx.lineWidth=1; ctx.restore();
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
    } else if(f.k==='b'){
      /* legacy straight bolt, kept for anything still calling it with k:'b' */
      var x=(f.ax+(f.bx-f.ax)*p-camX+0.5)*TS, y=(f.ay+(f.by-f.ay)*p-camY+0.5)*TS;
      ctx.fillStyle=f.col; ctx.fillRect(x-TS*0.1, y-TS*0.1, TS*0.2, TS*0.2);
    } else if(f.k==='ring'){
      ctx.save(); ctx.globalAlpha=(1-p)*0.8; ctx.strokeStyle=f.col; ctx.lineWidth=3;
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
  return {phys:'arrow-hit', fire:'fire-hit', ice:'ice-hit', lightning:'lightning-hit', poison:'earth-hit', earth:'earth-hit', light:'light-hit', dark:'shadow-hit', magic:'magic-missile-hit'}[type] || 'hit-flesh';
}
function ringFx(x,y,col,r){ fx.push({k:'ring', x:x, y:y, col:col||'#FFF', r:r||2, t0:performance.now(), dur:450}); }

/* keep frames coming while particles live */
function fxTick(t){
  var live = fx.length>0 || PARTS.length>0 || !ANIM.reduce;
  if(live){ if(!t || t-lastFrame>=33){ lastFrame=t||0; draw(); } fxIdleFrames=3; }
  else if(fxIdleFrames>0){ fxIdleFrames--; draw(); }
  requestAnimationFrame(fxTick);
}
