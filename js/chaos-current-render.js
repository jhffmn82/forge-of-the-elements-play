/* Floor currents and the material gateway share the scene clock. This is presentation only: the normal
 * floor transition owns travel, saves, companions and destination selection. */
(function(root){
  'use strict';
  var gateFile='map-material-gateway.png',gateReady=false,gateLoading=null;
  function materialGateAt(x,y){
    var entry=floorMeta&&floorMeta.chaosEntryPreview;
    if(entry&&entry.portal.x===x&&entry.portal.y===y)return true;
    return typeof FoteChaosCampaign!=='undefined'&&!!FoteChaosCampaign.materialPortalInfo(x,y);
  }
  function ensureAssets(){
    if(gateReady)return Promise.resolve();if(gateLoading)return gateLoading;
    var image=ATL[gateFile];if(image&&image.complete&&!image.naturalWidth)delete ATL[gateFile];atl(gateFile);image=ATL[gateFile];
    gateLoading=new Promise(function(resolve,reject){
      function cleanup(){image.removeEventListener('load',loaded);image.removeEventListener('error',failed);}
      function failed(){cleanup();reject(new Error('Could not load material gateway.'));}
      function loaded(){cleanup();if(!image.naturalWidth)return failed();Promise.resolve(image.decode?image.decode():undefined).then(function(){gateReady=true;resolve();},failed);}
      if(image.complete){if(image.naturalWidth)loaded();else failed();}else{image.addEventListener('load',loaded);image.addEventListener('error',failed);}
    }).finally(function(){gateLoading=null;});return gateLoading;
  }
  function drawGate(x,y,px,py,alpha){
    if(!materialGateAt(x,y))return false;
    var image=ATL[gateFile];if(!image||!image.naturalWidth)return true;
    var h=TS*2.5,w=h*image.naturalWidth/image.naturalHeight;
    ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(image,px+TS*.5-w*.5,py+TS*.96-h,w,h);ctx.restore();return true;
  }
  function gateShimmer(p,now){
    var i=idxOf(p.x,p.y);if(!(revealAll||seen[i]))return;
    var alpha=revealAll||vis[i]?1:memA(.4),t=ANIM.reduce||!vis[i]?0:(now||0)/1000,cx=(p.x-camX+.5)*TS,cy=(p.y-camY+.06)*TS;
    ctx.save();ctx.globalAlpha=alpha*.55;
    var glow=ctx.createRadialGradient(cx,cy,TS*.08,cx,cy,TS*.7);glow.addColorStop(0,'rgba(128,224,255,.35)');glow.addColorStop(1,'rgba(96,153,255,0)');
    ctx.fillStyle=glow;ctx.beginPath();ctx.ellipse(cx,cy,TS*.5,TS*.75,0,0,Math.PI*2);ctx.fill();
    for(var n=0;n<10;n++){var a=n*2.39+t*.6,r=.10+(n%4)*.09,q=(t*.21+n*.173)%1;ctx.globalAlpha=alpha*Math.sin(q*Math.PI)*.8;ctx.fillStyle=n%3?'#B5EEFF':'#EEE0FF';var xx=cx+Math.cos(a)*TS*r,yy=cy+Math.sin(a)*TS*r*1.6,size=TS*.022;ctx.fillRect(xx-size,yy-size,size*2,size*2);}
    ctx.restore();
  }
  function currentAt(x,y){return typeof FoteChaosCampaign!=='undefined'&&FoteChaosCampaign.currentInfo(x,y);}
  function draw(x,y,px,py,alpha,now){
    var c=currentAt(x,y);if(!c)return false;
    var visible=revealAll||vis[idxOf(x,y)],t=ANIM.reduce||!visible?0:(now||0)/1000;
    var dx=Number.isFinite(c.dx)?c.dx:1,dy=Number.isFinite(c.dy)?c.dy:0;
    var cx=px+TS*.5,cy=py+TS*.58;
    function point(q,strand){
      var sway=Math.sin(q*5.5-t*1.6+strand*.65)*(.07+q*.18),spread=(strand-3)*.055;
      return [cx+TS*(dx*q*3.7-dy*(sway+spread)),cy+TS*(dy*q*3.7+dx*(sway+spread)-q*q*.6)];
    }
    ctx.save();ctx.globalAlpha=alpha;
    // A shallow pool of light marks the boarding square, without a portal arch.
    var glow=ctx.createRadialGradient(cx,cy,TS*.04,cx,cy,TS*.8);
    glow.addColorStop(0,'rgba(207,255,255,.72)');glow.addColorStop(.4,'rgba(89,215,242,.26)');glow.addColorStop(1,'rgba(107,150,246,0)');
    ctx.fillStyle=glow;ctx.beginPath();ctx.ellipse(cx,cy,TS*.82,TS*.49,0,0,Math.PI*2);ctx.fill();
    ctx.lineCap='round';ctx.lineJoin='round';
    // Long open ribbons lead away through the void; there is no doorway/ring.
    for(var layer=0;layer<2;layer++)for(var strand=0;strand<7;strand++){
      var end=point(1,strand),gradient=ctx.createLinearGradient(cx,cy,end[0],end[1]);
      var rgb=strand%3===0?'188,154,255':strand%3===1?'97,223,248':'218,252,255';
      gradient.addColorStop(0,'rgba('+rgb+','+(layer?.95:.16)+')');gradient.addColorStop(.56,'rgba('+rgb+','+(layer?.72:.09)+')');gradient.addColorStop(1,'rgba('+rgb+',0)');
      ctx.strokeStyle=gradient;ctx.lineWidth=TS*(layer?.025:.11);ctx.beginPath();
      for(var n=0;n<=28;n++){var p=point(n/28,strand);if(n)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);}ctx.stroke();
    }
    // Shared-time sparks travel along the flow rather than spinning in place.
    for(var i=0;i<15;i++){
      var q=(i*.173+t*.30)%1,p=point(q,i%7),size=TS*(.025+.018*Math.sin(q*Math.PI));
      ctx.globalAlpha=alpha*Math.sin(q*Math.PI)*.9;ctx.fillStyle=i%3===0?'#D6BCFF':'#E5FFFF';
      ctx.beginPath();ctx.moveTo(p[0],p[1]-size*1.8);ctx.lineTo(p[0]+size,p[1]);ctx.lineTo(p[0],p[1]+size*1.8);ctx.lineTo(p[0]-size,p[1]);ctx.closePath();ctx.fill();
    }
    ctx.restore();return true;
  }
  function addLights(lights,now){
    var m=floorMeta&&floorMeta.chaosCampaign,entry=floorMeta&&floorMeta.chaosEntryPreview;
    (entry?[entry.portal]:m?[m.upAt,m.downAt]:[]).filter(Boolean).forEach(function(p){
      if(!(revealAll||seen[idxOf(p.x,p.y)]))return;
      lights.push({x:p.x,y:p.y,c:hexRGB('#9DEEFF'),r:3.2,s:.85,tx:p.x,ty:p.y});
    });return lights;
  }
  function drawAll(now){
    var m=floorMeta&&floorMeta.chaosCampaign,entry=floorMeta&&floorMeta.chaosEntryPreview;
    (entry?[entry.portal]:m?[m.upAt,m.downAt]:[]).filter(Boolean).forEach(function(p){
      var index=idxOf(p.x,p.y);if(!(revealAll||seen[index]))return;
      if(p.x<camX-4||p.x>camX+viewW+4||p.y<camY-4||p.y>camY+viewH+4)return;
      if(materialGateAt(p.x,p.y))gateShimmer(p,now);
      else draw(p.x,p.y,(p.x-camX)*TS,(p.y-camY)*TS,revealAll||vis[index]?1:memA(.4),now);
    });
  }
  root.FoteChaosCurrentRenderer=Object.freeze({draw:draw,drawGate:drawGate,drawAll:drawAll,addLights:addLights,ensureAssets:ensureAssets,materialGateAt:materialGateAt});
})(globalThis);
