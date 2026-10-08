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
  dagger:   {len:0.28, hand:'r', follow:1.0, tilt:-0.55, grip:0.82, offIdle:'blade'},
  spear:    {len:0.86, hand:'r', follow:0.5, tilt:-0.12, grip:0.62, two:true},
  staff:    {len:0.80, hand:'r', follow:0.4, tilt:-0.10, grip:0.62, two:true},
  wand:     {len:0.30, hand:'r', follow:1.0, tilt:-0.50, grip:0.85},
  /* 2026-09-27 (Justin, D2a): the Ceremonial Knife in the hand is the 64px bone-knife pixel art (held-censer), not the
     1254px painting shrunk 80 times; the painting stays the item icon (render.js) */
  censer:   {len:0.28, hand:'r', follow:0.7, tilt:-0.30, grip:0.85, offIdle:'blade'},
  bow:      {len:0.58, hand:'l', follow:0.3, tilt:0.08,  grip:0.50, two:true},
  buckler:  {len:0.30, hand:'l', shield:true},
  kite:     {len:0.42, hand:'l', shield:true},
  orb:      {len:0.17, hand:'l', float:true},
  tome:     {len:0.22, hand:'l', shield:true},
  /* 2026-10-05 (Justin: 'the holy symbol is a metal disk of various designs that is held and can offer some blocking
     protection in combat'): a disc held face out on the off arm, drawn the buckler's way. It was a disc on a handle,
     stood up out of the fist. A little smaller than the buckler (0.30): 27px across at a 90px tile. Its sprite is 60px,
     0.28 of the 215px doll figure, so one sprite pixel is one pixel of the doll sheet. */
  holy:     {len:0.28, hand:'l', shield:true}
};
/* 1.4 (Justin 2026-09-28: 'a per frame, for each animation, position and orientation mapping of the held weapons ... they
   should match how the weapon is held during the animation'). Every look carries grips checked against its own frames
   (art/sprites/grips, packed as ASSETS.cast[look].grips[clip][frame]): for each hand the fist a handle passes through, the
   elbow, front (1) or behind (-1) the body, and an optional tip angle a (degrees). The item's angle comes from that
   frame's forearm by the way it is held (tools/art/grip-tools.py draws the review overlays by the same rules):
     blade   - (wand) the tip carries on along the forearm, bent a little outward: down and
               out from a hanging arm, up from a raised one, forward in a thrust;
     upright - (mace, staff, spear, bow at rest, and the two-handed longsword and axe, which hanging point-down
               would reach past the feet) stands up out of a hanging fist, follows a raised or thrusting forearm;
     guard   - one-handed swords and knives rest raised toward the face's direction, across the body from the rear hand;
     placed  - a shield or holy symbol sits on the forearm, a tome in the hand, an orb in the palm, all upright while the figure stands.
   2026-10-05 (Justin: 'this isn't his hand, he has the orb hovering on his forearm'; 'gear must read right in idle and
   walk as well as in attacks'). Measured on every clothed look and frame (boards/contact.cjs): the fist points are on the
   painted hands (mean under 2.5 cell px), and the orb was 14.6 px off its hand, on the map and on the doll alike.
     in the hand   - the orb was drawn its whole height plus a gap straight up the screen from the fist, which on a hanging
                     arm is the forearm; it also bobbed on a clock and let the arm show through. 2026-10-06 (the review:
                     set on the fist it covered the hand, 'you cannot see his hand at all'): a hanging hand grips it from
                     above, its centre GRIP_ORB_IN_HAND of its own half height past the middle of the hand (GRIP_HAND past
                     the fist) along the forearm; a forearm that is level or raised holds it up, its centre
                     GRIP_ORB_ON_HAND of its half height straight above the hand, as it sat over the open palm of a cast;
                     between the two it moves over by how far the forearm is raised. The painted hand is then drawn again
                     over the orb, and over a tome (handRuns: the hand's own pixels, not a disc of whatever is near it).
                     The orb's flag in HELD keeps its old name, float.
     carry         - in the idle and the walk an item keeps the angle and the layer of the loop's first frame (every look's
                     hands are in front of the body there). The walk art turns side-on part way through, which sent a
                     shield or sword behind the body for half the loop and swung a two-hander like a pendulum.
     outward       - is decided by the hand that holds the item, not by which half of the cell the fist is in (a sword
                     snapped 41 degrees as a walking hand crossed the middle).
     the floor     - a shield, tome or orb stops on the floor line (the cell less its foot strip). In the death clip a
                     handled item turns about its fist until its low end rests on the floor, and is raised through the
                     fist by what would still pass it. 2026-10-06: only there. In life that raise slid a hanging mace up to
                     2 px through the hand that carries it, and a weapon's grip point is not this kit's to move.
     death         - as the hand comes down to the floor (heldFall) an item with no angle written for the frame is laid
                     level, and a shield or tome turns with the forearm to lie along it.
     casting       - a wand whose casting hand is empty is held in that hand while the arm is up, and points where it
                     points. 2026-10-06 (the review, looked at on every look): a wand kept in the weapon hand beside an
                     orb or tome, and a staff, are not turned. That hand never rises in the cast art, so the levelled wand
                     lay across the belt and the leaning staff put its head over the caster's face. Both keep their carry.
   HELD_STYLE is the rest carry of each item, one value per item (the mace: 2026-10-06, Justin picked 'upright', which
   stands at the shoulder; 'blade' hung as it always had, 'guard' is raised like the sword). FOTE_HELD_CARRY, review boards only (the game never sets
   it), swaps that value so the other carries can be shown side by side. */
var HELD_STYLE={sword:'guard', longsword:'upright', axe:'upright', mace:'upright', dagger:'guard', wand:'blade', censer:'guard',
  spear:'upright', staff:'upright', bow:'upright'};
/* GRIP_PULL: the share of the way a hanging item is drawn toward straight down (a blade) or straight up (an upright item),
   weighted by how far the forearm hangs, so nothing snaps as an arm rises. GRIP_BLADE_BEND: a hanging blade's outward cant. */
var GRIP_PULL=0.5, GRIP_BLADE_BEND=6*Math.PI/180, GRIP_SHIELD_ON_FOREARM=0.30, GRIP_ORB_IN_HAND=0.55, GRIP_ORB_ON_HAND=0.8, GRIP_TOME_IN_HAND=0.3, GRIP_FINGERS=0.018, GRIP_FLAT=0.55, GRIP_THICK=0.3;
/* GRIP_HAND: how far the middle of the painted hand lies past the fist point, along the forearm, as a share of the cell
   (2.5 px of 128; boards/contact.cjs measures it). GRIP_HAND_REACH: how far from that middle a hand's own pixels are looked for. */
var GRIP_HAND=0.02, GRIP_HAND_REACH=0.045;
function heldStyle(key){ return (typeof FOTE_HELD_CARRY!=='undefined' && FOTE_HELD_CARRY && FOTE_HELD_CARRY[key]) || HELD_STYLE[key] || 'blade'; }
/* how far this hand has come down from where it rests to the floor, 0 to 1 (the death clip lays gear down by it) */
function heldFall(m, grip, hn, floor){
  var rest=m.grips.idle && m.grips.idle[0] && m.grips.idle[0][hn], y0=rest ? rest.f[1] : floor*0.7;
  return Math.max(0, Math.min(1, (grip[hn].f[1]-y0)/Math.max(1, floor-m.cell*0.06-y0)));
}
/* 2026-10-05 (Justin: 'the attack animations don't make sense for 2h weapons or spears'). A swing that plays a list
   (render.js CLIP_PLAY) names its step, and the main-hand weapon is turned for that step, whatever its holding style.
   HELD_SWING: the tip angle on each of the nine steps, in degrees as a grip's a (0 at the target, -90 up); null keeps
     the holding rule. Steps 1 and 2 wind up and may point back; 3 to 6 run from launch to follow-through and lead with
     the edge or head, never across the face; the first and last step are the carry, so nothing jumps as the clip
     starts and ends. Written for the looks whose weapon hand travels (the only ones CLIP_PLAY lists an arm swing for).
   HELD_POLE: on steps 2 to 7 a spear or staff lies on the line through both fists while both are in front of the body
     and from GRIP_POLE_NEAR of the cell to GRIP_POLE_FAR of the shaft past the grip apart (the second hand has to be on
     it); otherwise it takes its HELD_SWING angle. Its grip point stays in the weapon fist. The second hand closes over
     the shaft too, unless it has come up under the head (GRIP_POLE_HEAD: the head's share of the length).
     On a look whose rear arm never comes forward (the list says lead) it is thrust level from the lead fist on steps
     3 to 6: interim, one hand.
   Variant B, review boards only (FOTE_ANIM_VARIANT 'B'; the game never sets it): the hand also slides down the shaft by
     GRIP_POLE_SLIDE (cell px a step; GRIP_LEAD_SLIDE in the one-hand thrust), so more of it leads. Art, length and grip
     point (HELD) are the same in both. */
var HELD_SWING={
  sword:    [null,-100,-130, -25, -5, 20, 50,-20,null],
  dagger:   [null, -75, -25, -12, -5,  0,  5,-30,null],
  censer:   [null, -75, -25, -12, -5,  0,  5,-30,null],
  mace:     [null, 160,-135, -20,  0, 25, 60, 80,null],
  longsword:[null,-100,-125, -28, -8, 30, 55,-15,null],
  axe:      [null,-100,-125, -28, -8, 30, 55,-15,null],
  spear:    [null,null,null,null,null,  0,null,null,null],
  staff:    [null,null,null,null,null,  0,null,null,null]
};
var HELD_POLE={spear:1, staff:1}, GRIP_POLE_NEAR=0.125, GRIP_POLE_FAR=0.8, GRIP_POLE_HEAD=0.25, GRIP_POLE_SLIDE=[0,0,12,14,16,18,16,12,0], GRIP_LEAD_SLIDE=[0,0,0,-14,-8,-2,-8,0,0];
/* 2026-10-06 (Justin: 'the attack animations don't make sense for 2h weapons or spears'). The added body rows (render.js
   CLIP_ROW) are drawn for the move, so on them the hands say where the weapon is. heldRowSwing is this step's turn of
   the main-hand weapon on such a row, as heldSwing is for a play list of an old row. No weapon's art, length or grip
   point (HELD) is touched.
   HELD_ROW: the tip angle on each of the nine steps, by row and item, in degrees as HELD_SWING (0 at the target, -90
     up); null keeps the holding rule (the carry, on the first and the last step).
   thrust - a spear or staff lies on the line through both fists on steps 1 to 7, where both hands are on the shaft: the
            rear fist holds the grip point (variant A), the lead fist is ahead of it. The list (level) is for a frame
            whose fists cannot say (GRIP_POLE_NEAR, GRIP_POLE_FAR).
   heavy  - a two-handed sword or axe lies on the line through both fists from wind-up to follow-through (steps 2 to
            6; 2026-10-06, the take 3 track: and on the guard, step 7, where both hands are still on the handle, and
            both fists close over it on all of those steps whether or not their line can be read; the lists are the
            track's own angles now, pilot/picks.json _weapon_deg, so every look of a row is on one track; a row's
            frame 1 is not played, render.js ROW_PLAY): the fist nearer the blade holds the grip point and the other
            is on the handle behind it, toward the
            pommel. That is the right fist, the hand HELD names, on every row drawn as asked. A row drawn with the left
            hand uppermost says so on its wind-up frame (the left fist is the higher one there): on its two-fist steps
            the grip point is in the left fist, and it has its own list (heavyl: its hands rise in front of the face,
            so the weapon leans forward on step 1). Held so while the fists are GRIP_TWO_NEAR to GRIP_TWO_FAR of the
            cell apart and their line is within GRIP_TWO_OFF degrees of the list's angle; otherwise, and on step 1
            where the second hand is on its way to the handle, the list's angle in the weapon fist.
   strike - a one-hand weapon is turned by the list: cocked back over the rear shoulder on the wind-up, the edge or
            head leading from launch to follow-through, never across the face.
   punch  - nothing is turned: a weapon in either fist rides it by its holding rule (the off-hand swing of a dual
            wield is the lead fist's jab, and the main weapon keeps its carry).
   The bow on the shoot row is in the bow hand, square to the line from the string fist to the bow fist, which is the
   arrow's line (heldBowAim): upright at full draw and at the release, leaning up to GRIP_BOW_LEAN degrees as the hands
   come up and go down. (The bow arm's forearm was tried first: its elbow hangs below the fist at full draw, and the
   bow leaned 16 to 27 degrees back over a level arrow.) */
var HELD_ROW={
  thrust:{spear:[null,0,0,0,0,0,0,0,null], staff:[null,0,0,0,0,0,0,0,null]},
  heavy:{longsword:[null,-100,-120,-88,-70,-38,-22,-72,null], axe:[null,-100,-120,-88,-70,-38,-22,-72,null]},
  heavyl:{longsword:[null,-60,-106,-87,-34,31,44,-15,null], axe:[null,-60,-106,-87,-34,31,44,-15,null]},
  strike:{sword:[null,-95,-125,-140,-50,18,55,-40,null], dagger:[null,-75,-110,-130,-40,5,35,-30,null], censer:[null,-75,-110,-130,-40,5,35,-30,null],
    mace:[null,160,-130,-140,-45,22,60,80,null], wand:[null,160,-130,-140,-45,22,60,80,null]}
};
var GRIP_TWO_NEAR=0.04, GRIP_TWO_FAR=0.18, GRIP_TWO_OFF=60, GRIP_BOW_LEAN=25;
function heldRowSwing(key, grip, fr, m){
  var i=fr.step, up=fr.add==='heavy' && m.grips.heavy[2], left=!!up && up.l.f[1]<up.r.f[1];
  var a=((HELD_ROW[left ? 'heavyl' : fr.add]||{})[key]||[])[i], o={a:a, row:1};
  if(a==null || fr.off) return {};
  var r=grip.r.f, l=grip.l.f, d=Math.hypot(l[0]-r[0], l[1]-r[1]), H=HELD[key], L=H.len*m.stand;
  if(fr.add==='thrust'){
    if(typeof FOTE_ANIM_VARIANT!=='undefined' && FOTE_ANIM_VARIANT==='B') o.slide=GRIP_POLE_SLIDE[i];
    var s=o.slide||0;
    if(d>=m.cell*GRIP_POLE_NEAR && d<=(L*H.grip+s)*GRIP_POLE_FAR){ o.a=Math.atan2(l[1]-r[1], l[0]-r[0])*180/Math.PI; o.fists=d<=L*(H.grip-GRIP_POLE_HEAD)+s ? ['r','l'] : ['r']; }
  }
  else if(fr.add==='heavy' && i>1 && i<8){
    o.fists=['r','l'];   /* 2026-10-06: both hands are on the handle from the wind-up to the guard */
    if(d<m.cell*GRIP_TWO_NEAR || d>m.cell*GRIP_TWO_FAR) return o;
    var u=left ? l : r, v=left ? r : l, off=angDiff(Math.atan2(u[1]-v[1], u[0]-v[0]), a*Math.PI/180)*180/Math.PI;
    if(Math.abs(off)<=GRIP_TWO_OFF){ o.a=a+off; if(left) o.hand='l'; }
  }
  return o;
}
function heldBowAim(grip){
  var x=grip.l.f[0]-grip.r.f[0], y=grip.l.f[1]-grip.r.f[1], t=x>0 ? Math.atan2(y,x)*180/Math.PI : 0;
  return {a:-90+Math.max(-GRIP_BOW_LEAN, Math.min(GRIP_BOW_LEAN, t)), row:1};
}
/* this step's turn for the main-hand weapon: a (tip angle, degrees), hand (the fist that carries it, when not its own),
   fists (the hands that close over it), slide (variant B) */
function heldSwing(key, grip, fr, m){
  if(fr.add) return heldRowSwing(key, grip, fr, m);   /* 2026-10-06: an added body row has its own rules */
  var i=fr.step, a=(HELD_SWING[key]||[])[i], o=a==null ? {} : {a:a};
  if(!HELD_POLE[key] || i<2 || i>7 || (fr.lead && (i<3 || i>6))) return o;
  if(typeof FOTE_ANIM_VARIANT!=='undefined' && FOTE_ANIM_VARIANT==='B') o.slide=(fr.lead ? GRIP_LEAD_SLIDE : GRIP_POLE_SLIDE)[i];
  if(fr.lead){ o.a=0; o.hand='l'; o.fists=['l']; return o; }
  var r=grip.r, l=grip.l, x=l.f[0]-r.f[0], y=l.f[1]-r.f[1], d=Math.hypot(x,y), H=HELD[key], L=H.len*m.stand, s=o.slide||0;
  if(r.z>=0 && l.z>=0 && d>=m.cell*GRIP_POLE_NEAR && d<=(L*H.grip+s)*GRIP_POLE_FAR){ o.a=Math.atan2(y,x)*180/Math.PI; o.fists=d<=L*(H.grip-GRIP_POLE_HEAD)+s ? ['r','l'] : ['r']; }
  return o;
}
function gripFor(m, row, col){
  if(!m.grips) return null;
  var clip=castClipAt(m,row), list=clip && m.grips[clip];
  return (list && (list[col] || list[0])) || null;
}
/* side: 1 when the fist is on the image's left of the figure (outward is toward smaller x), -1 on its right */
function heldTipAngle(style, hand, side){
  var phi=Math.atan2(hand.f[1]-hand.e[1], hand.f[0]-hand.e[0]), s=Math.sin(phi);
  if(style==='guard'&&hand.a!==undefined)return hand.a*Math.PI/180;
  if(style==='blade'){
    if(hand.a!==undefined) return hand.a*Math.PI/180;
    var w=Math.max(0,s);
    return phi + w*(GRIP_PULL*angDiff(Math.PI/2,phi) + GRIP_BLADE_BEND*side);
  }
  /* upright: a hanging forearm's direction mirrored upward (continuous at the horizontal), then drawn toward vertical */
  var t = s>0 ? -phi : phi, u=Math.max(0,-Math.sin(t));
  var tip=t + u*GRIP_PULL*angDiff(-Math.PI/2,t) - (style==='guard'?u*side*.45:0);
  /* Cast art faces right; the world renderer mirrors body and gear together when facing left. */
  return style==='guard'&&Math.cos(tip)<0 ? Math.PI-tip : tip;
}
/* 2026-10-05 (Justin: 'coming up with a different holy symbol for each god ... on the ground and inventory it's generic
   but once equiped it changes to your god's'). An equipped Holy Symbol shows its holder's god's disc. This names that
   picture, 'holy-<god>': held-holy-<god> in the hand (heldKeyOf), item-holy-<god> in the worn slot (sheets.js
   wornIconName). It is worked out from the holder's god each time it is drawn, so a change of faith shows at once, an
   old save needs nothing and nothing is stored on the item. A Shadow Clone keeps the god it was cast under. Null: no
   god (the plain disc), or not a Holy Symbol (joke gear never adopts a god's symbol). */
function holySymbolOf(it, who){
  var god=who && (who.god || (who.cloneStats && who.cloneStats.statModel && who.cloneStats.statModel.god));
  return god && it && !it.joke && it.icon==='item-holy' ? 'holy-'+god : null;
}
function heldKeyOf(it, who){
  if(!it || it.unarmed || it===EMPTY_OFF || it.joke) return null;
  var ic=(it.icon||'').replace(/^item-/,'');
  /* 2026-09-20: Justin - dual wield drew wrong. An off-hand weapon was sent to the dagger sprite whatever it was,
     and (worse) HELD.dagger says hand 'r', so it was drawn into the same fist as the main weapon - the two sat on
     top of each other and read as one two-handed pose. It keeps its own art when the pack has it; a two-hander,
     shield or focus shape can never be a dual-wielded weapon, so those still fall back to the dagger. */
  if(it.kind==='off' && it.weapon) return (HELD[ic] && !HELD[ic].two && !HELD[ic].shield && !HELD[ic].float) ? ic : 'dagger';
  var own=holySymbolOf(it, who);     /* the god's disc when the pack has one, else the plain disc */
  if(own && HELD[own] && AS.map && AS.map.held && AS.map.held.items['held-'+own]) return own;
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
  /* 2026-09-28 (Justin: 'the glow on the character sprite from armor is still there, it is way too much especially in a dark
     area like biome 4'): the enchantment's rim is gone too, so body armor draws nothing on the figure; its enchantment shows
     on the item's card. */
  return null;
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
/* 2026-10-05: each god's disc (held-holy-<god>, holySymbolOf above) is held by the one holy rule and, like the plain
   disc, keeps its colours when Worn. The nine entries are the one HELD.holy object, and Object.keys(HELD) lists them. */
if(typeof GODS!=='undefined') Object.keys(GODS).forEach(function(god){ HELD['holy-'+god]=HELD.holy; HELD_T0_KEEP['holy-'+god]=1; });
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
function heldTier(it){
  // itemKey repairs legacy item identities. A renderer must only repair a copy.
  var appearance=it && it!==EMPTY_OFF && Object.assign({},it);
  return (appearance && typeof itemKey==='function' && itemKey(appearance) && typeof tierNum==='function') ? tierNum(appearance) : null;
}
/* handOv: draw this item in the other hand (an off-hand weapon), mirrored so its own art faces outward. cell: the sheet's
   cell size, for the short-forearm rule. swing: this step's turn in a melee play list (heldSwing), or the hand a cast
   gives the wand. at (2026-10-05): floor, the floor line in cell px; fall, how far the hand has dropped to it
   in the death clip (heldFall); carry, the grip whose forearm sets the angle (the first frame of an idle or walk loop) */
function drawHeld(g, key, pose, rest, dx, dy, sc, drawH, enchant, now, tier, handOv, cell, aim, grip, strike, swing, at){
  var H=HELD[key], o=objArt('held','held-'+key); if(!H || !o) return;
  /* aim: a bow being shot is held upright with its belly toward the target; the held art has its string on the
     outer side, so it is mirrored (2026-09-27, Justin: the bow was backwards in the new empty-handed shots) */
  var hk = (swing && swing.hand) || handOv || H.hand, mirror = (!!handOv && handOv!==H.hand) !== !!aim;
  var gh = grip && grip[hk];
  var hand=gh ? gh.f : pose && pose[hk==='r'?'rh':'lh'], elbow=gh ? gh.e : pose && pose[hk==='r'?'re':'le'];
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
  if(gh){
    /* a grip: the item goes where this frame's fist is, turned the way it is held (heldTipAngle) */
    var floorY=at && at.floor!==undefined ? dy+at.floor*sc : Infinity, dying=!!at && at.fall!==undefined, fall=dying ? at.fall : 0;
    var fore=Math.atan2(hand[1]-elbow[1], hand[0]-elbow[0]);
    if(H.shield){
      /* a tome is held in the hand, a shield strapped to the forearm. 2026-10-05: the tome covered the whole hand; it sits
         GRIP_TOME_IN_HAND of its height past the fist now, so a hanging hand carries it by its top edge and a raised one
         holds it up, and the fingers close over it (drawCastLayers) */
      var onArm = key==='tome' ? -o.sh*s*GRIP_TOME_IN_HAND/sc/(Math.hypot(hand[0]-elbow[0], hand[1]-elbow[1])||1) : GRIP_SHIELD_ON_FOREARM;
      var sx=hand[0]+(elbow[0]-hand[0])*onArm, sy=hand[1]+(elbow[1]-hand[1])*onArm;
      /* 2026-10-05: it stood upright beside a fallen body, its lower half under the floor. In the death clip it turns with
         the forearm as the hand comes down and is seen more and more from its edge (GRIP_FLAT: its height on the floor),
         and it never passes the floor line */
      var lie=fall*angDiff(fore, Math.PI/2), flat=1-fall*(1-GRIP_FLAT), up=o.sh*s*(key==='tome'?0.45:0.5), halfW=o.sw*s/2;
      var low=(Math.abs(Math.cos(lie))*(o.sh*s-up)+Math.abs(Math.sin(lie))*halfW)*flat;
      g.translate(dx+sx*sc, Math.min(dy+sy*sc, floorY-low));
      if(lie){ g.scale(1, flat); g.rotate(lie); }
      g.drawImage(o.img, o.sx,o.sy,o.sw,o.sh, -halfW, -up, o.sw*s, o.sh*s);
    } else if(H.float){
      /* 2026-10-05 (Justin): in the hand; no bob, no see-through. 2026-10-06: under a hanging hand, over a raised one
         (the head of this file); raised: how far the forearm is up, 0 hanging to 1 level or higher */
      var oh=o.sh*s, raised=Math.max(0, Math.min(1, 1-Math.sin(fore))), past=cell*GRIP_HAND*sc+(1-raised)*oh/2*GRIP_ORB_IN_HAND;
      g.translate(hx+Math.cos(fore)*past, Math.min(hy+Math.sin(fore)*past-raised*oh/2*GRIP_ORB_ON_HAND, floorY-oh/2));
      g.drawImage(o.img, o.sx,o.sy,o.sw,o.sh, -o.sw*s/2, -oh/2, o.sw*s, oh);
    } else {
      g.translate(hx, hy);
      var gside = hk==='r' ? 1 : -1;     /* 2026-10-05: outward by the hand, not by the half of the cell the fist is in */
      var tip = aim ? -Math.PI/2 : swing && swing.a!==undefined ? swing.a*Math.PI/180 : heldTipAngle(at && at.style || heldStyle(key), at && at.carry ? at.carry[hk] : gh, gside);
      /* 2026-09-28 (Justin): in the attack the main-hand weapon points right, toward the target (the sprite is mirrored to face left) */
      if(strike && Math.cos(tip)<0) tip = Math.PI - tip;
      /* 2026-10-06: an added body row gives the angle itself (heldRowSwing, heldBowAim): nothing is mirrored after it, and its
         bow is not held dead upright */
      if(swing && swing.row && swing.a!==undefined) tip=swing.a*Math.PI/180;
      /* 2026-10-05: death lays an item level as its hand comes down, unless the frame's grip gives it an angle (an
         upright item never reads that angle, so it is always laid down: a two-handed sword stood on end in front of a
         falling Elf whose sword hand has one) */
      /* 2026-10-06: toward the side it will lie on when the fall is over (the clip's last frame), not the side its tip
         leans to on this frame: a long weapon lay pointing behind a falling figure, then ahead of it one frame later */
      if(fall && (gh.a===undefined || heldStyle(key)==='upright')) tip += fall*angDiff(Math.cos(at.end ? heldTipAngle(heldStyle(key), at.end[hk], gside) : tip)<0 ? Math.PI : 0, tip);
      /* the floor. Dying, the item turns about its fist until neither end is under the line: the head end keeps
         GRIP_THICK of the art's width clear (an axe or mace head rests on the floor and the handle runs down to the
         hand), the butt end may just touch. Whatever is still under after that, or in life (a pole's butt or a hanging
         mace under a low hand), is cleared by raising the item through the fist */
      var sn=Math.sin(tip), thick=o.sw*s*GRIP_THICK, hi=(floorY-hy-thick)/(len*H.grip), lo=-(floorY-hy)/(len*(1-H.grip));
      if(dying && (sn>hi || sn<lo)){ sn=Math.max(-1, Math.min(1, Math.max(Math.min(sn, hi), Math.min(lo, hi)))); tip = Math.cos(tip)<0 ? Math.PI-Math.asin(sn) : Math.asin(sn); }
      var under=hy+Math.max(sn*len*H.grip+Math.abs(Math.cos(tip))*thick, -sn*len*(1-H.grip))-floorY;
      if(dying && under>0) g.translate(0, -under);   /* 2026-10-06: in the death clip only (the head of this file) */
      g.rotate(tip + Math.PI/2);
      if(mirror) g.scale(-1, 1);
      if(enchant){ g.shadowColor=AFF_COL[enchant]||'#fff'; g.shadowBlur=Math.max(3, drawH*0.04)*dev; }
      g.drawImage(o.img, o.sx,o.sy,o.sw,o.sh, -o.sw*s/2, -o.sh*s*H.grip-(swing && swing.slide || 0)*sc, o.sw*s, o.sh*s);
    }
    g.restore();
    return;
  }
  g.translate(hx, hy);
  var side = hk === 'r' ? 1 : -1;     /* the right hand is on the image's left: lean outward = negative angle */
  if(H.shield){
    g.drawImage(o.img, o.sx,o.sy,o.sw,o.sh, -o.sw*s/2, -o.sh*s*0.55, o.sw*s, o.sh*s);
  } else if(H.float){
    g.drawImage(o.img, o.sx,o.sy,o.sw,o.sh, -o.sw*s/2, -o.sh*s/2, o.sw*s, o.sh*s);
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

/* 2026-10-06 (Justin: 'this isn't his hand'). The painted hand at a grip, as rows of its own pixels [x, y, width] in
   cell px, worked out once per sheet frame and hand (as openDoorAperture in render.js scans a door once). The look's
   hand colour is read off its standing hands: the median of the brightest pixels at the middle of each hand on the
   still, or the first idle frame. A frame's hand is every pixel of that colour within GRIP_HAND_REACH of the hand's
   middle, joined to it, with the dark line around them. Where no hand is painted at the fist (it is behind the body or
   under a sleeve) there are no rows, and nothing is drawn over the item; the same where a page may not read its own
   canvas (the sheet's pixels cannot be had, so the item is drawn whole, as it was before this). */
var HAND_RUNS=new WeakMap();
function handRuns(cs, sx, sy, gh){
  var memo=HAND_RUNS.get(cs.img), m=cs.m, cell=m.cell, key=sx+':'+sy+':'+gh.f[0]+':'+gh.f[1];
  if(!memo) HAND_RUNS.set(cs.img, memo={});
  if(memo[key]) return memo[key];
  var runs=memo[key]=[];
  try{
  var R=Math.ceil(cell*GRIP_HAND_REACH)+2, n=2*R+1, c=document.createElement('canvas'); c.width=c.height=n;
  var q=c.getContext('2d',{willReadFrequently:true}), luma=function(d,i){ return .299*d[i]+.587*d[i+1]+.114*d[i+2]; };
  /* the pixels around the middle of a hand: d (rgba), and the middle's own place in them (mx, my) */
  var patch=function(px, py, hand){
    var L=Math.hypot(hand.f[0]-hand.e[0], hand.f[1]-hand.e[1])||1, cx=hand.f[0]+(hand.f[0]-hand.e[0])/L*cell*GRIP_HAND, cy=hand.f[1]+(hand.f[1]-hand.e[1])/L*cell*GRIP_HAND;
    var x0=Math.floor(cx)-R, y0=Math.floor(cy)-R;
    q.clearRect(0,0,n,n); q.drawImage(cs.img, px+x0, py+y0, n, n, 0, 0, n, n);
    /* a patch that reaches past the cell would read the next frame of the sheet: those pixels are not this figure's */
    var d=q.getImageData(0,0,n,n).data;
    for(var y=0;y<n;y++) for(var x=0;x<n;x++) if(x0+x<0 || y0+y<0 || x0+x>=cell || y0+y>=cell) d[(y*n+x)*4+3]=0;
    return {d:d, x0:x0, y0:y0, mx:cx-x0, my:cy-y0};
  };
  if(memo.skin===undefined){
    var still=m.grips && ((m.static_row!==undefined && m.grips.static && [m.grips.static[0], m.static_row]) || (m.clips && m.clips.idle && m.grips.idle && [m.grips.idle[0], m.clips.idle.row]));
    var rs=[], gs=[], bs=[], mid=function(a){ a.sort(function(u,v){ return u-v; }); return a[a.length>>1]; };
    if(still && still[0]) ['r','l'].forEach(function(hn){
      var P=patch(0, still[1]*cell, still[0][hn]), near=cell*0.025, list=[], top=0;
      for(var y=0;y<n;y++) for(var x=0;x<n;x++){ var i=(y*n+x)*4; if(P.d[i+3]<200 || Math.hypot(x+.5-P.mx, y+.5-P.my)>near) continue; var l=luma(P.d,i); list.push([i,l]); if(l>top) top=l; }
      list.forEach(function(p){ if(p[1]>=top*.62){ rs.push(P.d[p[0]]); gs.push(P.d[p[0]+1]); bs.push(P.d[p[0]+2]); } });
    });
    memo.skin=rs.length ? [mid(rs), mid(gs), mid(bs)] : null;
  }
  var skin=memo.skin; if(!skin) return runs;
  var P2=patch(sx, sy, gh), d2=P2.d, reach=cell*GRIP_HAND_REACH, light=luma(skin,0), mark=new Uint8Array(n*n), todo=[];
  var is=function(x,y){ var i=(y*n+x)*4; return d2[i+3]>=200 && Math.hypot(d2[i]-skin[0], d2[i+1]-skin[1], d2[i+2]-skin[2])<=70 && luma(d2,i)>=light*.5 && Math.hypot(x+.5-P2.mx, y+.5-P2.my)<=reach; };
  /* joined to the middle: start from the hand's pixels within a third of the reach of it */
  for(var y=0;y<n;y++) for(var x=0;x<n;x++) if(Math.hypot(x+.5-P2.mx, y+.5-P2.my)<=reach/3+1 && is(x,y)){ mark[y*n+x]=1; todo.push(x,y); }
  while(todo.length){
    var ty=todo.pop(), tx=todo.pop();
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(s){
      var X=tx+s[0], Y=ty+s[1]; if(X<0 || Y<0 || X>=n || Y>=n || mark[Y*n+X]) return;
      if(is(X,Y)){ mark[Y*n+X]=1; todo.push(X,Y); }
      else if(d2[(Y*n+X)*4+3]>=200 && luma(d2,(Y*n+X)*4)<light*.5) mark[Y*n+X]=2;   /* the dark line around the hand */
    });
  }
  for(y=0;y<n;y++) for(x=0;x<n;x++) if(mark[y*n+x]){ var x1=x; while(x1<n && mark[y*n+x1]) x1++; runs.push([P2.x0+x, P2.y0+y, x1-x]); x=x1; }
  }catch(unread){ if(memo.skin===undefined) memo.skin=null; runs.length=0; }
  return runs;
}
function castEquipmentFor(who){
  var wpn=who.weapon, off=who.twoHanded ? null : who.off, arm=who.armorItem;
  if(who===player && who.god==='grom' && typeof equipmentForbidden==='function'){
    /* The conduct helper may normalize legacy item keys; rendering checks a
     * copy so merely drawing an old save cannot mutate its equipment. */
    if(equipmentForbidden('weapon',wpn && Object.assign({},wpn)))wpn=null;
    if(equipmentForbidden('off',off && Object.assign({},off)))off=null;
    if(equipmentForbidden('armor',arm && Object.assign({},arm)))arm=null;
  }
  return {weapon:wpn,off:off,armorItem:arm};
}
/* the whole figure: items behind the body, the (tinted) body, items in front.
 * time is no longer read (2026-10-05: the orb is held and does not bob); callers still pass it. */
function drawCastLayers(e, cs, fr, dx, dy, w, h, g, time){
  g = g || ctx;
  var m=cs.m, cell=m.cell, row=Math.round(fr.sy/cell), col=Math.round(fr.sx/cell), sc=w/cell, now=time===undefined?performance.now():time;
  var who = e || player;
  var pose=poseFor(m,row,col), rest=restPose(m), gear=castEquipmentFor(who);
  var wpn=gear.weapon,off=gear.off,arm=gear.armorItem;
  var mainKey=heldKeyOf(wpn), offKey=heldKeyOf(off, who), clip=castClipAt(m,row);
  /* 2026-10-06: an added body row (render.js CLIP_ROW) is drawn by the rules of the row it stands in for; add is its own name */
  var add=m.clips && m.clips[clip] && m.clips[clip].old ? clip : null;
  if(add) clip=m.clips[add].old;
  if(mainKey && HELD[mainKey].hand==='l'){ offKey=null; }            /* a bow takes the left hand */
  /* 2026-09-27 (Justin, equip plan D3a): the bow-shot clip has the bow painted into its frames, and the sword, axe or
     shield in the hands was drawn over it. Both hands' gear is put away while the shot plays. */
  if(clip==='ranged'){
    mainKey=offKey=null;
    /* 2026-09-27: the approved Fae and Gloomling rows play the shot empty-handed (clips.ranged.bow false), as every
       melee row swings empty-handed, so the bow being shot is drawn in the left hand instead. */
    var shot=m.clips && m.clips[add||'ranged'], aimBow=false;   /* 2026-10-06: the shoot row is empty-handed on every look */
    if(shot && shot.bow===false){
      var bow=[who.ranged, wpn].filter(function(it){ return heldKeyOf(it)==='bow'; })[0];
      if(bow && !(who===player && who.god==='grom' && typeof equipmentForbidden==='function' && equipmentForbidden('ranged',Object.assign({},bow)))){ wpn=bow; mainKey='bow'; aimBow=true; }
    }
  }
  var items=[], grip=gripFor(m,row,col), floor=cell-(m.foot||0);
  if(grip){
    /* the grips say for every frame whether each hand is in front of the body or behind it */
    /* 2026-10-05: a swing that plays a list points the weapon at the target from launch to follow-through only (steps 3
       to 6 of the nine), so its wind-up may point back and nothing jumps at either end. A row played straight has no
       strike frame to time that by and keeps it pointed for the whole clip, as before */
    /* 2026-10-05 (slice 1c): the off-hand swing of a dual wield (fr.off) is a jab of the lead hand. The main weapon keeps
       its carry through it; the off-hand weapon rides that fist, and its own carry already points at the target */
    var sw=mainKey && clip==='melee' && fr.step!==undefined && !fr.off ? heldSwing(mainKey, grip, fr, m) : null;
    /* 2026-10-05 (Justin: 'all casters can cast'): every look casts with the off hand, so the wand hung at the floor
       through the whole cast. up: how far the casting forearm is raised, 0 hanging to 1 level or higher. A wand whose
       casting hand is empty goes to that hand once it is half way up and points where it points. 2026-10-06: with an
       orb, tome or shield there the wand keeps its carry, and so does a staff (the head of this file) */
    if(mainKey==='wand' && clip==='cast' && !offKey){
      var up=Math.max(0, Math.min(1, 1-Math.sin(Math.atan2(grip.l.f[1]-grip.l.e[1], grip.l.f[0]-grip.l.e[0]))));
      if(up>0.5) sw={hand:'l', fists:['l']};
    }
    /* 2026-10-05: the idle and the walk keep the angle and the layer of their first frame (see the head of this file) */
    /* 2026-10-06 (the merge): on an added row (run, idle2) the carry is that row's own first frame */
    var keep=(clip==='idle' || clip==='walk') && m.grips[add||clip] && m.grips[add||clip][0] || null, lay=keep || grip;
    /* 2026-10-06 (Justin: 'during cast the spear in the dwarfs hand was wobbling'): the weapon hand does not cast, and its
       forearm turns a few degrees from frame to frame in the cast art, which rocked a spear or staff about the fist. In a
       cast the main-hand weapon keeps the angle and the layer of the cast's first frame, as an idle or walk loop does. A
       wand moved to the casting hand is that hand's item and still points with it */
    var keepMain=keep || (clip==='cast' && !(sw && sw.hand) && m.grips[add||clip] && m.grips[add||clip][0]) || null;
    var at=function(hn, carry){ return {floor:floor, fall:clip==='death' ? heldFall(m, grip, hn, floor) : undefined, carry:carry===undefined ? keep : carry, end:clip==='death' && m.grips[add||'death'][m.grips[add||'death'].length-1]}; };   /* 2026-10-06: an added fall (death2) ends on its own last frame */
    if(mainKey){ var mh=(sw && sw.hand) || HELD[mainKey].hand; items.push({key:mainKey, ench:wpn.enchant, tier:heldTier(wpn), aim:clip==='ranged' && aimBow, strike:clip==='melee' && !fr.off && (fr.step===undefined || (fr.step>2 && fr.step<7)), swing:sw, z:(keepMain||grip)[mh].z, at:at(mh, keepMain)}); }
    /* 2026-10-06: the holy symbol is a disc held like a buckler now (Justin), each god's too, so it takes the shield's
       rules: the carry, the floor, the death rule, and the striking weapon drawn in front of it */
    if(offKey){
      var offAt=at('l');
      /* Short off-hand blades rest point-down like wands, including the paper doll.
         The main hand and the walking, casting and attack rows keep their existing poses. */
      if(clip==='idle' || clip==='static') offAt.style=HELD[offKey].offIdle;
      items.push({key:offKey, ench:off.enchant, tier:heldTier(off), hand:'l', z:lay.l.z, at:offAt});
    }
    /* 2026-10-06: an added row turns the weapon itself (heldRowSwing) or leaves it at its carry, so it is never mirrored
       to the target; its bow stands square to the arrow's line */
    if(add && mainKey){ if(add==='shoot' && aimBow) items[0].swing=heldBowAim(grip); else if(!sw || sw.a===undefined) items[0].strike=false; }
  } else if(pose){
    if(mainKey) items.push({key:mainKey, ench:wpn.enchant, tier:heldTier(wpn), aim:clip==='ranged' && aimBow, z:(pose[HELD[mainKey].hand==='r'?'rh':'lh']||[0,0,0])[2]});
    /* the off hand is the left one, whatever hand the item's own entry names (2026-09-20) */
    if(offKey) items.push({key:offKey, ench:off.enchant, tier:heldTier(off), hand:'l', z:(pose.lh||[0,0,0])[2]});
    /* 2026-09-27 (Justin, D5): the left hand's item (shield, focus, off-hand weapon, bow) goes behind the body only in melee
       and death. Elsewhere the skeleton's layer guess hid it at rest (gloomling-f) or popped it back and forth mid-walk. */
    items.forEach(function(it){ if((it.hand||HELD[it.key].hand)==='l' && clip!=='melee' && clip!=='death') it.z=Math.max(0, it.z); });
  }
  var drawH=m.stand*sc;
  /* 2026-10-05 (Justin: 'the sword disappears under the shield'): the off-hand item was always drawn after the main
     weapon. While the weapon strikes it is drawn last, in front of the shield. 2026-10-06: and on the step after the
     follow-through, where the blade still crosses the shield (it dropped under it for that one step); and on a frame of
     the idle or the walk whose own grip puts the shield hand behind the body and the weapon hand in front: the carry
     keeps the shield in front there, and it hid the sword for half of every stride on the looks that turn side-on */
  if(items.length>1 && (items[0].strike || (clip==='melee' && fr.step===7 && !fr.off) || (keep && grip.l.z<0 && grip.r.z>=0))) items.reverse();
  var put=function(it){ drawHeld(g, it.key, pose, rest, dx, dy, sc, drawH, it.ench, now, it.tier, it.hand, cell, it.aim, grip, it.strike, it.swing, it.at); };
  items.forEach(function(it){ if(it.z<0) put(it); });
  var look=armorLook(arm);
  if(look){ g.drawImage(tintedFrame(cs,row,col,look,pose), 0,0,cell,cell, dx,dy,w,h); }
  else g.drawImage(cs.img, fr.sx, fr.sy, cell, cell, dx, dy, w, h);
  /* Fingers close over the grip rather than the handle covering the whole fist. 2026-10-05: item by item, straight after
     each is drawn, so a fist never shows through an item drawn over it afterwards (it showed as a dot on the shield); and
     over the orb and the tome too, which are held now */
  items.forEach(function(it){
    var held=HELD[it.key];if(it.z<0)return;
    put(it);
    if(held.shield && it.key!=='tome')return;
    (it.swing && it.swing.fists || [it.hand||held.hand]).forEach(function(hn){   /* 2026-10-05: each hand on a pole */
      var hand=grip ? grip[hn].f : pose && pose[hn==='r'?'rh':'lh'];if(!hand)return;
      /* 2026-10-06: a hand this frame's own grip puts behind the body has no fingers to show (an item kept in front
         through a walk had a disc of clothing painted on it there) */
      if(grip && grip[hn].z<0)return;
      g.save();g.beginPath();
      /* 2026-10-06: an orb or a tome is held in the hand, not on a handle through the fist: the whole painted hand is
         drawn over it (handRuns), in the cell's own pixels */
      if(grip && (held.float || held.shield)){
        g.translate(dx,dy);g.scale(sc,h/cell);
        handRuns(cs,fr.sx,fr.sy,grip[hn]).forEach(function(run){g.rect(run[0],run[1],run[2],1);});
        g.clip();g.scale(1/sc,cell/h);g.translate(-dx,-dy);
      }
      else{g.arc(dx+hand[0]*sc,dy+hand[1]*sc,cell*GRIP_FINGERS*sc,0,Math.PI*2);g.clip();}
      if(look)g.drawImage(tintedFrame(cs,row,col,look,pose),0,0,cell,cell,dx,dy,w,h);
      else g.drawImage(cs.img,fr.sx,fr.sy,cell,cell,dx,dy,w,h);
      g.restore();
    });
  });
}

/* ---------------------------------------------------------------- the paper doll */
/* who: the character to draw, the player by default. 2026-09-27 (Justin, equip plan D12): the creation screen passes the
   starting kit's character, so its preview shows the kit through this same path. */
/* Static previews wait for their small native doll. A missing registration or a
 * settled native load failure permits only this exact look's animation fallback. */
function dollImageReady(img){return !!(img && img.complete!==false && (img.naturalWidth===undefined || img.naturalWidth>0));}
function dollCastFallback(look){
  var m=AS.cast && AS.cast[look],job=m && m.doll && ATLAS_JOBS.get('cast-'+look+'-doll.webp');
  return !!(m && (!m.doll || job && job.phase==='failed'));
}
function dollSheetFor(look){
  var m=AS.cast && AS.cast[look],dm=m && m.doll,di=dm && atl('cast-'+look+'-doll.webp');
  if(dollImageReady(di))return {img:di,m:dm,look:look};
  if(!dollCastFallback(look))return null;
  var image=m && atl('cast-'+look+'.webp');
  return dollImageReady(image)?{img:image,m:m,look:look}:null;
}
function dollStillRow(sheet){
  var m=sheet.m,idle=m.clips && m.clips.idle2;
  /* The approved underwear drawing lives on idle2; the old row-7 still has clothing leftovers. */
  if(/-unclad$/.test(sheet.look) && idle && idle.old==='idle')return idle.row;
  return m.static_row!==undefined?m.static_row:(m.clips.idle?m.clips.idle.row:0);
}
function watchDollArt(el,size,who,portrait,currentPlayer){
  if(typeof watchStaticArt!=='function')return;
  var look=castLookFor(who.look,who.god),m=AS.cast&&AS.cast[look],files=[];
  var sheet=dollSheetFor(look);
  if(m && m.doll && (!sheet || sheet.m!==m.doll))files.push('cast-'+look+'-doll.webp');
  if(m && !sheet && dollCastFallback(look))files.push('cast-'+look+'.webp');
  var gear=castEquipmentFor(who);
  if(AS.map&&AS.map.held&&(heldKeyOf(gear.weapon)||heldKeyOf(gear.off))&&!atl('map-held.webp'))files.push('map-held.webp');
  var repaint=function(){
    if(portrait)paintDollPortrait(el,size,who);else paintDoll(el,size,who);
  };
  watchStaticArt(el,files,repaint,function(){return (!currentPlayer||who===player) && castLookFor(who.look,who.god)===look;},null,null,repaint);
}
function paintDoll(el, size, who){
  if(!el)return;
  var currentPlayer=!who||who===player;
  if(typeof cancelStaticArtPaint==='function')cancelStaticArtPaint(el);
  who=who||player;if(!who)return;
  var look=castLookFor(who.look,who.god),cs=dollSheetFor(look),preferred=AS.cast&&AS.cast[look];
  var hi=!!(cs && preferred && cs.m===preferred.doll);
  if(!cs){el.replaceChildren();watchDollArt(el,size,who,false,currentPlayer);return;}
  if((!AS.map || !AS.map.held) && !/-unclad$/.test(look)){paintArt(el,'cast',look,size);watchDollArt(el,size,who,false,currentPlayer);return;}
  /* 2026-09-22 (Justin): the doll drew the map sheet's 107px figure at 231 CSS px, a x2.2 blow-up. tools/art/pack.py
     packs each native cut-out alone at 256 (cast-<look>-doll.webp, ASSETS.cast[look].doll); it is used here when it
     has loaded, and the map sheet stays the fallback. */
  var m=cs.m, row=dollStillRow(cs);
  /* 2026-09-27 (Justin, equip plan step 5): the figure went through a 256px canvas and was then scaled again, a second
     smoothing pass (held items reached x4, x10 on a phone), and the 210px canvas cut the axe blade off the 275px figure.
     It is drawn once now, straight into a canvas as wide as the figure whose backing store is exactly its CSS size times
     the pixel ratio. The allotted creation or Gear box bounds the whole canvas, so a shorter box cannot clip the
     crown or held equipment. The doll is still: its dead repaint timer is gone
     (D13). */
  var S=size||150, d=window.devicePixelRatio||1;
  /* Fit before painting, preserving aspect and drawing at the final device
   * resolution. A CSS shrink after painting would filter the figure twice. */
  var fitW=el.clientWidth,fitH=el.clientHeight;
  if(fitW>0)S=Math.min(S,fitW/(m.cell*1.1/m.stand));
  if(fitH>0)S=Math.min(S,fitH/1.31);
  /* 1.4 (grips): a sword hanging from a short figure's hand reaches past its feet, so the doll keeps a strip of room below
     the figure (pad); the figure itself sits where it always did */
  var sc=(S*1.1)/m.stand, w=m.cell*sc, pad=S*0.06, c=document.createElement('canvas');
  c.width=Math.round(w*d); c.height=Math.round((S*1.25+pad)*d); c.style.width=(c.width/d)+'px'; c.style.height=(c.height/d)+'px';
  var g=c.getContext('2d'); g.setTransform(d,0,0,d,0,0); g.imageSmoothingEnabled=hi;
  drawCastLayers(who, cs, {sx:0, sy:row*m.cell}, (c.width/d-w)/2, c.height/d-pad-w+S*.02, w, w, g);
  el.innerHTML=''; el.appendChild(c);
  watchDollArt(el,size,who,false,currentPlayer);
}

/* The HUD uses the upper third of the same equipped, still paper doll. Draw
 * directly into its device-pixel canvas; do not resample a full-size doll. */
var DOLL_PORTRAITS=new WeakMap();
function paintDollPortrait(el,size,who){
  if(!el)return false;
  var currentPlayer=!who||who===player;
  if(typeof cancelStaticArtPaint==='function')cancelStaticArtPaint(el);
  who=who||player;if(!who)return false;
  var look=castLookFor(who.look,who.god),sheet=dollSheetFor(look);
  var full=AS.cast && AS.cast[look],dm=full && full.doll,native=!!(sheet && sheet.m===dm);
  if(!sheet){el.replaceChildren();watchDollArt(el,size,who,true,currentPlayer);return false;}
  var m=sheet.m,row=dollStillRow(sheet);
  if(!(m.cell>0 && m.stand>0))return false;
  var S=Number(size);if(!Number.isFinite(S)||S<=0)S=68;
  var d=Number(window.devicePixelRatio);if(!Number.isFinite(d)||d<=0)d=1;
  var pixels=Math.max(1,Math.round(S*d)),gear=castEquipmentFor(who);
  var mainKey=heldKeyOf(gear.weapon),offKey=heldKeyOf(gear.off,who);
  if(mainKey && HELD[mainKey].hand==='l')offKey=null;
  var held=[mainKey,offKey].filter(Boolean).map(function(key){return objArt('held','held-'+key);});
  var complete=(!dm||native) && (!sheet.look||sheet.look===look) && held.every(function(o){return o&&dollImageReady(o.img);});
  function itemView(it){return it?[heldKeyOf(it),it.icon,it.weight,heldTier(it),it.enchant||null,it.plus||0,!!it.cursed]:null;}
  var key=JSON.stringify([look,who.god||null,S,d,pixels,row,m.cell,m.stand,m.foot||0,complete,
    itemView(gear.weapon),offKey?itemView(gear.off):null,itemView(gear.armorItem),
    sheet.img.src||'',sheet.img.naturalWidth||sheet.img.width||0,
    held.map(function(o){return o?[o.img.src||'',o.img.naturalWidth||o.img.width||0,o.sx,o.sy,o.sw,o.sh]:null;})]);
  var memo=DOLL_PORTRAITS.get(el);
  if(memo && memo.key===key && memo.image===sheet.img && memo.metadata===m && held.every(function(o,i){return (o&&o.img)===memo.held[i];})){
    if(el.firstChild!==memo.canvas || el.childNodes.length!==1)el.replaceChildren(memo.canvas);
    if(!complete)watchDollArt(el,size,who,true,currentPlayer);
    return complete;
  }
  var canvas=document.createElement('canvas');canvas.width=canvas.height=pixels;
  canvas.style.width=canvas.style.height=S+'px';canvas.setAttribute('aria-hidden','true');
  var g=canvas.getContext('2d');if(!g)return false;
  g.setTransform(pixels/S,0,0,pixels/S,0,0);g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  g.beginPath();g.arc(S/2,S/2,S/2,0,Math.PI*2);g.clip();
  // foot is the transparent strip below the soles, not the sole's y position.
  // Six percent breathing room keeps the crown inside the circular crop.
  var top=m.cell-(m.foot||0)-m.stand,sc=S*.88/(m.stand/3),width=m.cell*sc;
  drawCastLayers(who,sheet,{sx:0,sy:row*m.cell},(S-width)/2,S*.06-top*sc,width,width,g,0);
  el.replaceChildren(canvas);
  DOLL_PORTRAITS.set(el,{key:key,image:sheet.img,metadata:m,held:held.map(function(o){return o&&o.img;}),canvas:canvas});
  if(!complete)watchDollArt(el,size,who,true,currentPlayer);
  return complete;
}
