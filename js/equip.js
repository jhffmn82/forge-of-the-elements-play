/* =====================================================================
   equip.js - worn gear drawn on the character: the weapon in the hand,
   the off-hand item in the other, and the armor as a material tint over
   the torso and arms. Hand, elbow, shoulder and hip positions come from
   PixelLab skeleton estimates for every animation frame (packed as
   ASSETS.cast[look].poses), so gear follows the animation.
   Loaded after render.js; render.js calls drawCastLayers when present.
   ===================================================================== */

/* len: item length as a share of the drawn sprite height. hand: which hand holds it.
   follow: how much the item turns with the forearm. tilt: resting lean from vertical (radians, outward). */
var HELD = {
  sword:    {len:0.46, hand:'r', follow:1.0, tilt:-0.45, grip:0.86},
  longsword:{len:0.64, hand:'r', follow:1.0, tilt:-0.40, grip:0.80, two:true},
  axe:      {len:0.58, hand:'r', follow:1.0, tilt:-0.40, grip:0.84, two:true},
  mace:     {len:0.40, hand:'r', follow:1.0, tilt:-0.45, grip:0.86},
  dagger:   {len:0.28, hand:'r', follow:1.0, tilt:-0.55, grip:0.82},
  spear:    {len:0.86, hand:'r', follow:0.5, tilt:-0.12, grip:0.62, two:true},
  staff:    {len:0.80, hand:'r', follow:0.4, tilt:-0.10, grip:0.62, two:true},
  wand:     {len:0.30, hand:'r', follow:1.0, tilt:-0.50, grip:0.85},
  censer:   {len:0.34, hand:'r', follow:0.7, tilt:-0.30, grip:0.85},
  bow:      {len:0.58, hand:'l', follow:0.3, tilt:0.08,  grip:0.50, two:true},
  buckler:  {len:0.30, hand:'l', shield:true},
  kite:     {len:0.42, hand:'l', shield:true},
  orb:      {len:0.17, hand:'l', float:true},
  tome:     {len:0.22, hand:'l', shield:true},
  holy:     {len:0.26, hand:'l', follow:0.3, tilt:0.25, grip:0.9}
};
function heldKeyOf(it){
  if(!it || it.unarmed || it===EMPTY_OFF || it.joke) return null;
  var ic=(it.icon||'').replace(/^item-/,'');
  /* 2026-09-20: Justin - dual wield drew wrong. An off-hand weapon was sent to the dagger sprite whatever it was,
     and (worse) HELD.dagger says hand 'r', so it was drawn into the same fist as the main weapon - the two sat on
     top of each other and read as one two-handed pose. It keeps its own art when the pack has it; a two-hander,
     shield or focus shape can never be a dual-wielded weapon, so those still fall back to the dagger. */
  if(it.kind==='off' && it.weapon) return (HELD[ic] && !HELD[ic].two && !HELD[ic].shield && !HELD[ic].float) ? ic : 'dagger';
  return HELD[ic] ? ic : null;
}

/* ---------------------------------------------------------------- pose lookup */
function castClipAt(m, row){
  if(m.static_row!==undefined && row===m.static_row) return 'static';
  for(var k in m.clips) if(m.clips[k].row===row) return k;
  return null;
}
function poseFor(m, row, col){
  if(!m.poses) return null;
  var clip=castClipAt(m,row), list=clip && m.poses[clip];
  var p = list && (list[col] || list[0]);
  return p || (m.poses.idle && m.poses.idle[0]) || (m.poses.static && m.poses.static[0]) || null;
}
function restPose(m){ return (m.poses && ((m.poses.idle && m.poses.idle[0]) || (m.poses.static && m.poses.static[0]))) || null; }
function angDiff(a,b){ var d=a-b; while(d>Math.PI) d-=2*Math.PI; while(d<-Math.PI) d+=2*Math.PI; return d; }

/* ---------------------------------------------------------------- armor tint (cached per frame) */
var ARMOR_TINT_CACHE={};
function armorLook(a){
  if(!a) return null;
  var w=a.weight||'cloth';
  if(w==='cloth' && !a.enchant && !a.cursed) return null;
  return {weight:w, enchant:a.enchant||null};
}
function tintedFrame(cs, row, col, look, pose){
  var m=cs.m, cell=m.cell;
  var key=(cs.img.src||'')+'|'+row+'|'+col+'|'+look.weight+'|'+(look.enchant||'');
  if(ARMOR_TINT_CACHE[key]) return ARMOR_TINT_CACHE[key];
  var c=document.createElement('canvas'); c.width=cell; c.height=cell;
  var g=c.getContext('2d');
  g.drawImage(cs.img, col*cell, row*cell, cell, cell, 0, 0, cell, cell);
  if(pose && pose.rs && pose.ls && pose.rp && pose.lp && look.weight!=='cloth'){
    var mat=document.createElement('canvas'); mat.width=cell; mat.height=cell;
    var h=mat.getContext('2d');
    /* the covered area: torso between shoulders and hips, and sleeves for chain and plate */
    var rs=pose.rs, ls=pose.ls, rp=pose.rp, lp=pose.lp, wid=Math.abs(ls[0]-rs[0]);
    h.fillStyle='#fff'; h.strokeStyle='#fff'; h.lineCap='round'; h.lineJoin='round';
    h.beginPath();
    h.moveTo(rs[0]-wid*0.16, rs[1]-cell*0.03); h.lineTo(ls[0]+wid*0.16, ls[1]-cell*0.03);
    h.lineTo(lp[0]+wid*0.22, lp[1]+cell*0.05); h.lineTo(rp[0]-wid*0.22, rp[1]+cell*0.05); h.closePath(); h.fill();
    if(look.weight!=='light'){
      h.lineWidth=cell*0.09;
      [['rs','re','rh'],['ls','le','lh']].forEach(function(arm){
        var s=pose[arm[0]], e=pose[arm[1]], hd=pose[arm[2]]; if(!s||!e) return;
        h.beginPath(); h.moveTo(s[0],s[1]); h.lineTo(e[0],e[1]); if(look.weight==='heavy' && hd) h.lineTo(e[0]+(hd[0]-e[0])*0.7, e[1]+(hd[1]-e[1])*0.7); h.stroke();
      });
    }
    /* the mask: covered area, limited to pixels the character actually has */
    h.globalCompositeOperation='source-in'; h.drawImage(c,0,0);
    var mask=mat;
    mat=document.createElement('canvas'); mat.width=cell; mat.height=cell;
    h=mat.getContext('2d');
    h.drawImage(mask,0,0);
    /* material */
    if(look.weight==='light'){
      h.globalCompositeOperation='color'; h.fillStyle='rgba(120,74,38,0.85)'; h.fillRect(0,0,cell,cell);
      h.globalCompositeOperation='multiply'; h.fillStyle='rgba(200,160,120,1)'; h.fillRect(0,0,cell,cell);
    } else if(look.weight==='medium'){
      h.globalCompositeOperation='saturation'; h.fillStyle='#808080'; h.fillRect(0,0,cell,cell);
      h.globalCompositeOperation='multiply'; h.fillStyle='#B8BEC8'; h.fillRect(0,0,cell,cell);
      h.globalCompositeOperation='source-atop'; h.fillStyle='rgba(0,0,0,0.22)';
      for(var yy=0; yy<cell; yy+=3) for(var xx=(yy/3)%2; xx<cell; xx+=3) h.fillRect(xx,yy,1,1);   /* mail rings */
    } else {
      h.globalCompositeOperation='saturation'; h.fillStyle='#808080'; h.fillRect(0,0,cell,cell);
      h.globalCompositeOperation='screen'; h.fillStyle='rgba(90,100,120,0.35)'; h.fillRect(0,0,cell,cell);
      var gr=h.createLinearGradient(0,rs[1],0,rp[1]+cell*0.05); gr.addColorStop(0,'rgba(255,255,255,0.35)'); gr.addColorStop(0.5,'rgba(255,255,255,0)'); gr.addColorStop(1,'rgba(0,0,0,0.25)');
      h.globalCompositeOperation='source-atop'; h.fillStyle=gr; h.fillRect(0,0,cell,cell);
    }
    /* blend modes painted the whole canvas: cut the result back to the mask */
    h.globalCompositeOperation='destination-in'; h.globalAlpha=1; h.drawImage(mask,0,0);
    g.drawImage(mat,0,0);
  }
  if(look.enchant){
    /* a soft rim of the element's colour around the whole figure */
    var glow=document.createElement('canvas'); glow.width=cell; glow.height=cell;
    var q=glow.getContext('2d');
    q.shadowColor=AFF_COL[look.enchant]||'#fff'; q.shadowBlur=cell*0.05; q.drawImage(c,0,0);
    q.globalCompositeOperation='destination-out'; q.shadowBlur=0; q.drawImage(c,0,0);
    g.globalCompositeOperation='destination-over'; g.globalAlpha=0.9; g.drawImage(glow,0,0); g.globalAlpha=1; g.globalCompositeOperation='source-over';
  }
  ARMOR_TINT_CACHE[key]=c;
  return c;
}

/* ---------------------------------------------------------------- held items */
/* gear tier shows on the held sprite: T0 dull gray, T1 as painted, T2 a blue sheen, T3 gold */
var HELD_TIER_CACHE={};
var HELD_TIER_TINT = {0:{col:'#8A8A8A', mode:'saturation', a:0.85, dim:0.18}, 2:{col:'#5A9CFF', mode:'overlay', a:0.55}, 3:{col:'#F2B83A', mode:'overlay', a:0.65}};
/* painted shields (red kite, brown buckler) swallow an overlay, so they take the tier's hue outright */
var HELD_TIER_TINT_SHIELD = {0:HELD_TIER_TINT[0], 2:{col:'#4F8FF0', mode:'color', a:0.7, lift:0.12}, 3:{col:'#E8B032', mode:'color', a:0.8, lift:0.22}};
function heldTierImage(o, key, tier){
  var T=(HELD[key] && HELD[key].shield ? HELD_TIER_TINT_SHIELD : HELD_TIER_TINT)[tier]; if(!T) return null;
  var id=key+':'+tier; if(HELD_TIER_CACHE[id]) return HELD_TIER_CACHE[id];
  var c=document.createElement('canvas'); c.width=o.sw; c.height=o.sh;
  var g=c.getContext('2d');
  g.drawImage(o.img, o.sx,o.sy,o.sw,o.sh, 0,0,o.sw,o.sh);
  g.globalCompositeOperation=T.mode; g.globalAlpha=T.a; g.fillStyle=T.col; g.fillRect(0,0,o.sw,o.sh);
  if(T.lift){ g.globalCompositeOperation='screen'; g.globalAlpha=T.lift; g.fillStyle=T.col; g.fillRect(0,0,o.sw,o.sh); }
  if(T.dim){ g.globalCompositeOperation='multiply'; g.globalAlpha=T.dim; g.fillStyle='#000'; g.fillRect(0,0,o.sw,o.sh); }
  g.globalCompositeOperation='destination-in'; g.globalAlpha=1; g.drawImage(o.img, o.sx,o.sy,o.sw,o.sh, 0,0,o.sw,o.sh);
  HELD_TIER_CACHE[id]=c;
  return c;
}
function heldTier(it){ return (it && typeof itemKey==='function' && itemKey(it) && typeof tierNum==='function') ? tierNum(it) : null; }
/* handOv: draw this item in the other hand (an off-hand weapon), mirrored so its own art faces outward */
function drawHeld(g, key, pose, rest, dx, dy, sc, drawH, enchant, now, tier, handOv){
  var H=HELD[key], o=objArt('held','held-'+key); if(!H || !o) return;
  var tinted=heldTierImage(o, key, tier);
  if(tinted) o={img:tinted, sx:0, sy:0, sw:o.sw, sh:o.sh};
  var hk = handOv || H.hand, mirror = !!handOv && handOv!==H.hand;
  var hand=pose[hk==='r'?'rh':'lh'], elbow=pose[hk==='r'?'re':'le'];
  if(!hand) return;
  var hx=dx+hand[0]*sc, hy=dy+hand[1]*sc;
  var len=H.len*drawH, s=len/o.sh;
  g.save();
  g.translate(hx, hy);
  var side = hk === 'r' ? 1 : -1;     /* the right hand is on the image's left: lean outward = negative angle */
  if(H.shield){
    g.drawImage(o.img, o.sx,o.sy,o.sw,o.sh, -o.sw*s/2, -o.sh*s*0.55, o.sw*s, o.sh*s);
  } else if(H.float){
    var bob=(ANIM.reduce?0:Math.sin(now/300))*drawH*0.02;
    g.globalAlpha*=0.95; g.drawImage(o.img, o.sx,o.sy,o.sw,o.sh, -o.sw*s/2, -o.sh*s - drawH*0.05 + bob, o.sw*s, o.sh*s);
  } else {
    var ang=-Math.PI/2 + H.tilt*side;
    if(elbow){
      var fa=Math.atan2(hand[1]-elbow[1], hand[0]-elbow[0]);
      var rh=rest && rest[hk==='r'?'rh':'lh'], re=rest && rest[hk==='r'?'re':'le'];
      var fr = (rh && re) ? Math.atan2(rh[1]-re[1], rh[0]-re[0]) : Math.PI/2;
      ang += angDiff(fa, fr)*H.follow;
    }
    g.rotate(ang + Math.PI/2);
    if(mirror) g.scale(-1, 1);
    if(enchant){ g.shadowColor=AFF_COL[enchant]||'#fff'; g.shadowBlur=Math.max(3, drawH*0.04); }
    g.drawImage(o.img, o.sx,o.sy,o.sw,o.sh, -o.sw*s/2, -o.sh*s*H.grip, o.sw*s, o.sh*s);
  }
  g.restore();
}

/* the whole figure: items behind the body, the (tinted) body, items in front */
function drawCastLayers(e, cs, fr, dx, dy, w, h, g){
  g = g || ctx;
  var m=cs.m, cell=m.cell, row=Math.round(fr.sy/cell), col=Math.round(fr.sx/cell), sc=w/cell, now=performance.now();
  var who = e || player;
  var pose=poseFor(m,row,col), rest=restPose(m);
  var wpn=who.weapon, off=who.twoHanded ? null : who.off, arm=who.armorItem;
  var mainKey=heldKeyOf(wpn), offKey=heldKeyOf(off);
  if(mainKey && HELD[mainKey].hand==='l'){ offKey=null; }            /* a bow takes the left hand */
  var items=[];
  if(pose){
    if(mainKey) items.push({key:mainKey, ench:wpn.enchant, tier:heldTier(wpn), z:(pose[HELD[mainKey].hand==='r'?'rh':'lh']||[0,0,0])[2]});
    /* the off hand is the left one, whatever hand the item's own entry names (2026-09-20) */
    if(offKey) items.push({key:offKey, ench:off.enchant, tier:heldTier(off), hand:'l', z:(pose.lh||[0,0,0])[2]});
  }
  var drawH=m.stand*sc;
  items.forEach(function(it){ if(it.z<0) drawHeld(g, it.key, pose, rest, dx, dy, sc, drawH, it.ench, now, it.tier, it.hand); });
  var look=armorLook(arm);
  if(look){ g.drawImage(tintedFrame(cs,row,col,look,pose), 0,0,cell,cell, dx,dy,w,h); }
  else g.drawImage(cs.img, fr.sx, fr.sy, cell, cell, dx, dy, w, h);
  items.forEach(function(it){ if(it.z>=0) drawHeld(g, it.key, pose, rest, dx, dy, sc, drawH, it.ench, now, it.tier, it.hand); });
}

/* ---------------------------------------------------------------- the paper doll */
function paintDoll(el, size){
  var cs=castSheet(player.look);
  if(!cs || !AS.map || !AS.map.held){ paintArt(el,'cast',player.look,size); return; }
  var S=size||150, d=window.devicePixelRatio||1, c=document.createElement('canvas');
  c.width=S*d; c.height=S*d*1.25; c.style.width=S+'px'; c.style.height=(S*1.25)+'px';
  var g=c.getContext('2d'); g.setTransform(d,0,0,d,0,0); g.imageSmoothingEnabled=true;
  var m=cs.m, row = m.static_row!==undefined ? m.static_row : (m.clips.idle?m.clips.idle.row:0);
  var sc=(S*1.1)/m.stand, w=m.cell*sc;
  drawCastLayers(player, cs, {sx:0, sy:row*m.cell}, (S-w)/2, S*1.25-w+S*0.02, w, w, g);
  el.innerHTML=''; el.appendChild(c);
  /* redraw while the doll is open so an enchanted weapon glows and an orb bobs */
  if(!el._dollTimer){ el._dollTimer=setInterval(function(){ if(!el.isConnected){ clearInterval(el._dollTimer); return; } }, 1000); }
}
