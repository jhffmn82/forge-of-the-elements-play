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
  /* 2026-09-27 (Justin, D2a): the Ceremonial Knife in the hand is the 64px bone-knife pixel art (held-censer), not the
     1254px painting shrunk 80 times; the painting stays the item icon (render.js) */
  censer:   {len:0.28, hand:'r', follow:0.7, tilt:-0.30, grip:0.85},
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
/* 2026-09-27 (Justin, equip plan D4): PixelLab misreads a hand or elbow for a single frame (under a spell flash, in fast
   motion), and the item jumped off the hand for that frame: a shield at the hip mid-cast, a sword across the body mid-walk.
   A point that leaps more than 8% of the cell and comes back (its two neighbours lie closer to each other than to it), or
   flips its layer for one frame, takes the mean of its neighbours; idle and walk loop, so their ends are neighbours.
   Worked out once per sheet and clip. The skeleton data is untouched, and a run of several bad frames is left as it is. */
var POSE_STABLE=new WeakMap();
function stablePoses(m, clip){
  var list=m.poses[clip]; if(!list || list.length<3) return list;
  var memo=POSE_STABLE.get(m); if(!memo) POSE_STABLE.set(m, memo={});
  if(memo[clip]) return memo[clip];
  var n=list.length, loop=clip==='idle'||clip==='walk', lim=m.cell*0.08, out=list.slice();
  for(var i=loop?0:1; i<(loop?n:n-1); i++){
    var a=list[(i+n-1)%n], p=list[i], b=list[(i+1)%n];
    if(a && p && b) ['rh','lh','re','le'].forEach(function(k){
      var u=a[k], v=p[k], w=b[k]; if(!u || !v || !w) return;
      var out1=Math.hypot(v[0]-u[0],v[1]-u[1]), back=Math.hypot(v[0]-w[0],v[1]-w[1]);
      var spike=out1>lim && back>lim && Math.hypot(u[0]-w[0],u[1]-w[1])<Math.min(out1,back);
      var flip=(u[2]<0)===(w[2]<0) && (v[2]<0)!==(u[2]<0);
      if(!spike && !flip) return;
      if(out[i]===p) out[i]=Object.assign({}, p);
      out[i][k]=[spike?(u[0]+w[0])/2:v[0], spike?(u[1]+w[1])/2:v[1], (u[2]+w[2])/2];
    });
  }
  return (memo[clip]=out);
}
function poseFor(m, row, col){
  if(!m.poses) return null;
  var clip=castClipAt(m,row), list=clip && m.poses[clip] && stablePoses(m,clip);
  var p = list && (list[col] || list[0]);
  return p || restPose(m);
}
function restPose(m){ return (m.poses && ((m.poses.idle && stablePoses(m,'idle')[0]) || (m.poses.static && m.poses.static[0]))) || null; }
function angDiff(a,b){ var d=a-b; while(d>Math.PI) d-=2*Math.PI; while(d<-Math.PI) d+=2*Math.PI; return d; }

/* ---------------------------------------------------------------- armor tint (cached per frame) */
/* 2026-09-27 (Justin, equip plan D7b, D8): cloth shows as a light tint of its own colour (the purple robe, the coral
   Hawaiian shirt), and every body armor shows its tier, plus and curse as a hue over the area it covers, as held gear
   does: T0 worn and a little darker, T1 as the material, T2 a blue sheen, T3 gold, each +1 a brighter polish, a curse a
   dark red cast. */
var ARMOR_CLOTH={robe:{col:'#8A55B8', a:0.5}, 'hawaiian-shirt':{col:'#E2603F', a:0.55}};
var ARMOR_TIER_TINT={0:{col:'#000', mode:'multiply', a:0.15}, 2:{col:'#4F8FF0', mode:'color', a:0.45, lift:0.1}, 3:{col:'#E8B032', mode:'color', a:0.8, lift:0.3}};   /* T3 at a .5/.18 read khaki; .8/.3 reads gold */
var ARMOR_TINT_CACHE={}, ARMOR_TINT_N=0;   /* bounded: cleared past 400 frames (every swap or upgrade adds a set) */
function armorLook(a){
  /* 2026-09-27 (Justin, after seeing robes, leather and chain on the new Fae): body armor is no longer painted onto the
     figure. The torso tint could not follow each look's own clothes and read as a flat patch over them. Only an armor
     enchantment still shows, as a coloured rim around the whole figure. The material and tier tint code below is kept
     unused in case the owner wants it back for particular looks. */
  if(!a || !a.enchant) return null;
  return {weight:'cloth', cloth:null, tier:null, plus:0, cursed:false, enchant:a.enchant, id:'rim,'+a.enchant};
}
function tintedFrame(cs, row, col, look, pose){
  var m=cs.m, cell=m.cell;
  var key=(cs.img.src||'')+'|'+row+'|'+col+'|'+look.id;
  if(ARMOR_TINT_CACHE[key]) return ARMOR_TINT_CACHE[key];
  if(++ARMOR_TINT_N>400){ ARMOR_TINT_CACHE={}; ARMOR_TINT_N=1; }
  var c=document.createElement('canvas'); c.width=cell; c.height=cell;
  var g=c.getContext('2d');
  g.drawImage(cs.img, col*cell, row*cell, cell, cell, 0, 0, cell, cell);
  if(pose && pose.rs && pose.ls && pose.rp && pose.lp){
    var mat=document.createElement('canvas'); mat.width=cell; mat.height=cell;
    var h=mat.getContext('2d');
    /* the covered area: the torso from shoulders to hips, and sleeves for chain and plate. 2026-09-27 (Justin, D9a): the
       torso is laid along the shoulder-to-hip axis, at least 0.6 of its length wide and at least 0.17 of the cell long (a
       real one is 0.17-0.2; a misread skeleton squeezed some death frames to half that). It was a box between the shoulder
       and hip x positions, which a side-on lunge or a body lying dead squeezed to a sliver, so the armor vanished. */
    var rs=pose.rs, ls=pose.ls, rp=pose.rp, lp=pose.lp;
    var sx=(rs[0]+ls[0])/2, sy=(rs[1]+ls[1])/2, px=(rp[0]+lp[0])/2, py=(rp[1]+lp[1])/2, L=Math.hypot(px-sx, py-sy)||1;
    var ux=(px-sx)/L, uy=(py-sy)/L, nx=-uy, ny=ux, grow=Math.max(0, cell*0.17-L)/2, top=cell*0.03+grow, bot=cell*0.05+grow;
    L+=grow*2;
    var W=Math.max(Math.abs((ls[0]-rs[0])*nx+(ls[1]-rs[1])*ny), L*0.6), hs=W*0.66, hp=Math.max(Math.abs((lp[0]-rp[0])*nx+(lp[1]-rp[1])*ny), L*0.3)/2+W*0.22;
    h.fillStyle='#fff'; h.strokeStyle='#fff'; h.lineCap='round'; h.lineJoin='round';
    h.beginPath();
    h.moveTo(sx-ux*top+nx*hs, sy-uy*top+ny*hs); h.lineTo(sx-ux*top-nx*hs, sy-uy*top-ny*hs);
    h.lineTo(px+ux*bot-nx*hp, py+uy*bot-ny*hp); h.lineTo(px+ux*bot+nx*hp, py+uy*bot+ny*hp); h.closePath(); h.fill();
    if(look.weight==='medium' || look.weight==='heavy'){
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
    if(look.weight==='cloth'){
      if(look.cloth){ h.globalCompositeOperation='color'; h.globalAlpha=look.cloth.a; h.fillStyle=look.cloth.col; h.fillRect(0,0,cell,cell); h.globalAlpha=1; }
    } else if(look.weight==='light'){
      h.globalCompositeOperation='color'; h.fillStyle='rgba(120,74,38,0.85)'; h.fillRect(0,0,cell,cell);
      h.globalCompositeOperation='multiply'; h.fillStyle='rgba(200,160,120,1)'; h.fillRect(0,0,cell,cell);
    } else if(look.weight==='medium'){
      h.globalCompositeOperation='saturation'; h.fillStyle='#808080'; h.fillRect(0,0,cell,cell);
      h.globalCompositeOperation='multiply'; h.fillStyle='#B8BEC8'; h.fillRect(0,0,cell,cell);
      h.globalCompositeOperation='source-atop'; h.fillStyle='rgba(0,0,0,0.22)';
      /* mail rings, pitched to the figure (2026-09-27): 3px on the 128px map cell and 6px on the 256px doll, where a fixed
         3px made the doll's mail twice as fine as the map's */
      var pitch=Math.max(2, Math.round(cell/43)), dot=Math.max(1, Math.round(pitch/3));
      for(var yy=0, r=0; yy<cell; yy+=pitch, r++) for(var xx=(r%2)*dot; xx<cell; xx+=pitch) h.fillRect(xx,yy,dot,dot);
    } else {
      h.globalCompositeOperation='saturation'; h.fillStyle='#808080'; h.fillRect(0,0,cell,cell);
      h.globalCompositeOperation='screen'; h.fillStyle='rgba(90,100,120,0.35)'; h.fillRect(0,0,cell,cell);
      var gr=h.createLinearGradient(sx-ux*top, sy-uy*top, px+ux*bot, py+uy*bot); gr.addColorStop(0,'rgba(255,255,255,0.35)'); gr.addColorStop(0.5,'rgba(255,255,255,0)'); gr.addColorStop(1,'rgba(0,0,0,0.25)');
      h.globalCompositeOperation='source-atop'; h.fillStyle=gr; h.fillRect(0,0,cell,cell);
    }
    /* tier, plus and curse (D8) */
    var T=ARMOR_TIER_TINT[look.tier];
    if(T){ h.globalCompositeOperation=T.mode; h.globalAlpha=T.a; h.fillStyle=T.col; h.fillRect(0,0,cell,cell);
      if(T.lift){ h.globalCompositeOperation='screen'; h.globalAlpha=T.lift; h.fillRect(0,0,cell,cell); } }
    if(look.plus){ h.globalCompositeOperation='soft-light'; h.globalAlpha=Math.min(0.5, look.plus*0.1); h.fillStyle='#fff'; h.fillRect(0,0,cell,cell); }
    if(look.cursed){ h.globalCompositeOperation='color'; h.globalAlpha=0.45; h.fillStyle='#8C2440'; h.fillRect(0,0,cell,cell);
      h.globalCompositeOperation='multiply'; h.globalAlpha=0.2; h.fillStyle='#000'; h.fillRect(0,0,cell,cell); }
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
/* gear tier shows on the held sprite: T0 dull gray, T1 as painted, T2 a blue sheen, T3 gold. k: the copy is also scaled up
   k times, nearest neighbour (drawHeld), so it is cached per item, tier and k. */
var HELD_TIER_CACHE={};
/* 2026-09-28 (Justin: 'drop the glowing from masterwork and fine, it's too much'): Fine and Masterwork gear is drawn as
   painted; only Worn gear is dulled. The blue (T2) and gold (T3) sheens are gone from weapons and shields. */
var HELD_TIER_TINT = {0:{col:'#8A8A8A', mode:'saturation', a:0.85, dim:0.18}};
/* painted shields (red kite, brown buckler) swallow an overlay, so they take the tier's hue outright */
var HELD_TIER_TINT_SHIELD = {0:HELD_TIER_TINT[0]};
/* 2026-09-27 (Justin, D11c): foci and staves keep their painted colours at T0. Grey, a starting tome, holy symbol or orb no
   longer matched its coloured icon. */
var HELD_T0_KEEP={tome:1, holy:1, orb:1, staff:1, wand:1};
function heldTierImage(o, key, tier, k){
  var T=tier===0 && HELD_T0_KEEP[key] ? null : (HELD[key] && HELD[key].shield ? HELD_TIER_TINT_SHIELD : HELD_TIER_TINT)[tier]; k=k||1; if(!T && k===1) return null;
  var id=key+':'+tier+':'+k; if(HELD_TIER_CACHE[id]) return HELD_TIER_CACHE[id];
  var w=o.sw*k, h=o.sh*k, c=document.createElement('canvas'); c.width=w; c.height=h;
  var g=c.getContext('2d'); g.imageSmoothingEnabled=false;
  g.drawImage(o.img, o.sx,o.sy,o.sw,o.sh, 0,0,w,h);
  if(T){
    g.globalCompositeOperation=T.mode; g.globalAlpha=T.a; g.fillStyle=T.col; g.fillRect(0,0,w,h);
    if(T.lift){ g.globalCompositeOperation='screen'; g.globalAlpha=T.lift; g.fillStyle=T.col; g.fillRect(0,0,w,h); }
    if(T.dim){ g.globalCompositeOperation='multiply'; g.globalAlpha=T.dim; g.fillStyle='#000'; g.fillRect(0,0,w,h); }
    g.globalCompositeOperation='destination-in'; g.globalAlpha=1; g.drawImage(o.img, o.sx,o.sy,o.sw,o.sh, 0,0,w,h);
  }
  HELD_TIER_CACHE[id]=c;
  return c;
}
function heldTier(it){ return (it && typeof itemKey==='function' && itemKey(it) && typeof tierNum==='function') ? tierNum(it) : null; }
/* handOv: draw this item in the other hand (an off-hand weapon), mirrored so its own art faces outward. cell: the sheet's
   cell size, for the short-forearm rule */
function drawHeld(g, key, pose, rest, dx, dy, sc, drawH, enchant, now, tier, handOv, cell, aim){
  var H=HELD[key], o=objArt('held','held-'+key); if(!H || !o) return;
  /* aim: a bow being shot is held upright with its belly toward the target; the held art has its string on the
     outer side, so it is mirrored (2026-09-27, Justin: the bow was backwards in the new empty-handed shots) */
  var hk = handOv || H.hand, mirror = (!!handOv && handOv!==H.hand) !== !!aim;
  var hand=pose[hk==='r'?'rh':'lh'], elbow=pose[hk==='r'?'re':'le'];
  if(!hand) return;
  var hx=dx+hand[0]*sc, hy=dy+hand[1]*sc;
  var len=H.len*drawH, s=len/o.sh;
  /* 2026-09-27 (Justin, equip plan step 3): the 64px held art was blown up to x4 through a smoothing filter (x10 on a
     phone's paper doll) and shrunk with the cheap 'low' filter, so gear smeared up close and shimmered at map zoom.
     Above 1 device pixel per source pixel it now draws from a whole-number nearest-neighbour copy, so the one filtered
     step only ever shrinks, and that step uses the 'high' filter. */
  var t=g.getTransform ? g.getTransform() : null, dev=t ? Math.max(Math.hypot(t.a,t.b), Math.hypot(t.c,t.d)) : 1, k=Math.max(1, Math.ceil(s*dev-1e-6));
  var copy=heldTierImage(o, key, tier, k);
  if(copy){ o={img:copy, sx:0, sy:0, sw:o.sw*k, sh:o.sh*k}; s/=k; }
  g.save();
  g.imageSmoothingEnabled=true; g.imageSmoothingQuality='high';
  g.translate(hx, hy);
  var side = hk === 'r' ? 1 : -1;     /* the right hand is on the image's left: lean outward = negative angle */
  if(H.shield){
    g.drawImage(o.img, o.sx,o.sy,o.sw,o.sh, -o.sw*s/2, -o.sh*s*0.55, o.sw*s, o.sh*s);
  } else if(H.float){
    var bob=(ANIM.reduce?0:Math.sin(now/300))*drawH*0.02;
    g.globalAlpha*=0.95; g.drawImage(o.img, o.sx,o.sy,o.sw,o.sh, -o.sw*s/2, -o.sh*s - drawH*0.05 + bob, o.sw*s, o.sh*s);
  } else {
    var ang=-Math.PI/2 + (aim ? 0 : H.tilt*side);
    /* a forearm under 6% of the cell gives no real angle (a misread elbow), so the item keeps its resting lean */
    if(!aim && elbow && Math.hypot(hand[0]-elbow[0], hand[1]-elbow[1])>=cell*0.06){
      var fa=Math.atan2(hand[1]-elbow[1], hand[0]-elbow[0]);
      var rh=rest && rest[hk==='r'?'rh':'lh'], re=rest && rest[hk==='r'?'re':'le'];
      var fr = (rh && re) ? Math.atan2(rh[1]-re[1], rh[0]-re[0]) : Math.PI/2;
      ang += angDiff(fa, fr)*H.follow;
    }
    g.rotate(ang + Math.PI/2);
    if(mirror) g.scale(-1, 1);
    /* shadowBlur ignores the canvas transform, so it is scaled by it (2026-09-27, equip plan step 10): measured on the doll,
       the glow covered 870 CSS px^2 at DPR 1 and 317 at DPR 3, a phone */
    if(enchant){ g.shadowColor=AFF_COL[enchant]||'#fff'; g.shadowBlur=Math.max(3, drawH*0.04)*dev; }
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
  if(who===player && who.god==='grom' && typeof equipmentForbidden==='function'){
    /* The conduct helper may normalize legacy item keys; rendering checks a
     * copy so merely drawing an old save cannot mutate its equipment. */
    if(equipmentForbidden('weapon',wpn && Object.assign({},wpn)))wpn=null;
    if(equipmentForbidden('off',off && Object.assign({},off)))off=null;
    if(equipmentForbidden('armor',arm && Object.assign({},arm)))arm=null;
  }
  var mainKey=heldKeyOf(wpn), offKey=heldKeyOf(off), clip=castClipAt(m,row);
  if(mainKey && HELD[mainKey].hand==='l'){ offKey=null; }            /* a bow takes the left hand */
  /* 2026-09-27 (Justin, equip plan D3a): the bow-shot clip has the bow painted into its frames, and the sword, axe or
     shield in the hands was drawn over it. Both hands' gear is put away while the shot plays. */
  if(clip==='ranged'){
    mainKey=offKey=null;
    /* 2026-09-27: the approved Fae and Gloomling rows play the shot empty-handed (clips.ranged.bow false), as every
       melee row swings empty-handed, so the bow being shot is drawn in the left hand instead. */
    var shot=m.clips && m.clips.ranged, aimBow=false;
    if(shot && shot.bow===false){
      var bow=[who.ranged, wpn].filter(function(it){ return heldKeyOf(it)==='bow'; })[0];
      if(bow && !(who===player && who.god==='grom' && typeof equipmentForbidden==='function' && equipmentForbidden('ranged',Object.assign({},bow)))){ wpn=bow; mainKey='bow'; aimBow=true; }
    }
  }
  var items=[];
  if(pose){
    if(mainKey) items.push({key:mainKey, ench:wpn.enchant, tier:heldTier(wpn), aim:clip==='ranged' && aimBow, z:(pose[HELD[mainKey].hand==='r'?'rh':'lh']||[0,0,0])[2]});
    /* the off hand is the left one, whatever hand the item's own entry names (2026-09-20) */
    if(offKey) items.push({key:offKey, ench:off.enchant, tier:heldTier(off), hand:'l', z:(pose.lh||[0,0,0])[2]});
    /* 2026-09-27 (Justin, D5): the left hand's item (shield, focus, off-hand weapon, bow) goes behind the body only in melee
       and death. Elsewhere the skeleton's layer guess hid it at rest (gloomling-f) or popped it back and forth mid-walk. */
    items.forEach(function(it){ if((it.hand||HELD[it.key].hand)==='l' && clip!=='melee' && clip!=='death') it.z=Math.max(0, it.z); });
  }
  var drawH=m.stand*sc;
  items.forEach(function(it){ if(it.z<0) drawHeld(g, it.key, pose, rest, dx, dy, sc, drawH, it.ench, now, it.tier, it.hand, cell, it.aim); });
  var look=armorLook(arm);
  if(look){ g.drawImage(tintedFrame(cs,row,col,look,pose), 0,0,cell,cell, dx,dy,w,h); }
  else g.drawImage(cs.img, fr.sx, fr.sy, cell, cell, dx, dy, w, h);
  items.forEach(function(it){ if(it.z>=0) drawHeld(g, it.key, pose, rest, dx, dy, sc, drawH, it.ench, now, it.tier, it.hand, cell, it.aim); });
  /* Fingers close over the grip rather than the handle covering the whole fist. */
  items.forEach(function(it){
    var held=HELD[it.key];if(it.z<0||held.shield||held.float)return;
    var hand=pose[(it.hand||held.hand)==='r'?'rh':'lh'];if(!hand)return;
    g.save();g.beginPath();g.arc(dx+hand[0]*sc,dy+hand[1]*sc,cell*.018*sc,0,Math.PI*2);g.clip();
    if(look)g.drawImage(tintedFrame(cs,row,col,look,pose),0,0,cell,cell,dx,dy,w,h);
    else g.drawImage(cs.img,fr.sx,fr.sy,cell,cell,dx,dy,w,h);
    g.restore();
  });
}

/* ---------------------------------------------------------------- the paper doll */
/* who: the character to draw, the player by default. 2026-09-27 (Justin, equip plan D12): the creation screen passes the
   starting kit's character, so its preview shows the kit through this same path. */
function paintDoll(el, size, who){
  var look=who ? castLookFor(who.look, who.god) : playerCastLook(), cs=castSheet(look);
  who=who||player;
  if(!cs || !AS.map || !AS.map.held){ paintArt(el,'cast',look,size); return; }
  /* 2026-09-22 (Justin): the doll drew the map sheet's 107px figure at 231 CSS px, a x2.2 blow-up. tools/pack.py
     packs each native cut-out alone at 256 (cast-<look>-doll.webp, ASSETS.cast[look].doll); it is used here when it
     has loaded, and the map sheet stays the fallback. */
  var dm=cs.m.doll, di=dm && atl('cast-'+(cs.look||look)+'-doll.webp'), hi=!!(di && di.complete && di.naturalWidth);
  if(hi) cs={img:di, m:dm};
  var m=cs.m, row = m.static_row!==undefined ? m.static_row : (m.clips.idle?m.clips.idle.row:0);
  /* 2026-09-27 (Justin, equip plan step 5): the figure went through a 256px canvas and was then scaled again, a second
     smoothing pass (held items reached x4, x10 on a phone), and the 210px canvas cut the axe blade off the 275px figure.
     It is drawn once now, straight into a canvas as wide as the figure whose backing store is exactly its CSS size times
     the pixel ratio. It is never shrunk to fit (D1): the phone Gear tab gives the doll room of its own, and a desktop
     box narrower than the figure crops its sides, centred, as before. The doll is still: its dead repaint timer is gone
     (D13). */
  var S=size||150, d=window.devicePixelRatio||1;
  var sc=(S*1.1)/m.stand, w=m.cell*sc, c=document.createElement('canvas');
  c.width=Math.round(w*d); c.height=Math.round(S*1.25*d); c.style.width=(c.width/d)+'px'; c.style.height=(c.height/d)+'px';
  var g=c.getContext('2d'); g.setTransform(d,0,0,d,0,0); g.imageSmoothingEnabled=hi;
  drawCastLayers(who, cs, {sx:0, sy:row*m.cell}, (c.width/d-w)/2, c.height/d-w+S*.02, w, w, g);
  el.innerHTML=''; el.appendChild(c);
}
