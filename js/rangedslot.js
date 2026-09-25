/* =====================================================================
   rangedslot.js - the second weapon slot is a bow slot, and swapping is gone (2026-09-17).

   The two-weapon-set system let you stow anything and swap for a turn, which created a pile of edge cases -
   including a bow in the off hand vanishing on the swap - and asked the player to spend a turn to shoot.
   Now:
     - the second slot is RANGED. A bow (or anything with range > 1) lives there.
     - you shoot with it automatically whenever you attack something further than a tile away. No swapping,
       no turn spent changing weapons. Up close you swing your main hand as normal.
     - the off hand refuses ranged weapons, so that bug cannot happen at all.
   player.sets stays in the save for old characters; set 1 is migrated into player.ranged on load.
   ===================================================================== */

function isRangedWeapon(it){ return !!(it && it.kind!=='off' && (it.range||0) > 1); }

/* ---------------------------------------------------------------- migration: set 1 becomes the bow slot */


/* ---------------------------------------------------------------- shooting: the bow answers for the shot
   The whole attack pipeline reads player.weapon, so the bow steps into that slot for the duration of a
   ranged attack and steps out again - the same trick the off-hand swing uses. That means a bow's tier,
   upgrades and enchantment all apply to the shot, for free. */


/* ---------------------------------------------------------------- equipping goes to the right slot */


/* ---------------------------------------------------------------- swapping is retired */


/* the hotbar's swap entry has nothing to do any more */
  function hideRetiredSwapSlots(){
    if(player && player.hotbar){
      for(var i=0;i<player.hotbar.length;i++){ var s=player.hotbar[i]; if(s && s.type==='swap') player.hotbar[i]=null; }
    }
  }
/* Click and shot routing is owned by travel.js and systems.js. */

/* ---------------------------------------------------------------- the bow on the hotbar (2026-09-20)
   Justin: "it still isn't possible to drag an EQUIPED item to the hotbar... If you click on an inventory item in
   the hotbar, it just equips it. So there is no way to shoot a bow from a hotbar."
   The ranged slot on the Gear sheet is a drag source now (js/sheets.js, js/touchui.js) and the hotbar holds a
   'ranged' entry (js/ui.js). Pressing it draws on the nearest enemy it can actually reach and marks it the way a
   spell's auto-aim does (js/autoaim.js); pressing it again looses the arrow. Aiming costs no turn, so a wrong
   press costs nothing. Clicking an enemy on the map still shoots exactly as before. */
var BOWAIM = null;
function bowReady(){ return !!(player && isRangedWeapon(player.ranged)); }
function bowCanHit(e){
  return !!(e&&e.foe&&e.hp>0&&actorVisible(e)&&dist(player,e)>1&&dist(player,e)<=player.range&&projectileLine(player,e,{visible:true,range:player.range}));
}
function bowLive(){ return (BOWAIM && ents.indexOf(BOWAIM)>=0 && bowCanHit(BOWAIM)) ? BOWAIM : null; }
function bowNextTarget(){
  var list=ents.filter(bowCanHit);
  if(!list.length) return null;
  /* nearest first, and among equals the most hurt - a second volley finishes what the first started */
  list.sort(function(a,b){ return (dist(player,a)-dist(player,b)) || (a.hp/a.maxhp - b.hp/b.maxhp); });
  var i=list.indexOf(BOWAIM);
  return list[(i+1) % list.length];
}
function bowSlotPress(){
  if(gameTurns.busy()||playerFearAction())return false;
  if(!bowReady()){ log('Nothing is slung across your back. Put a bow in your ranged slot first.','c-info'); return; }
  if(typeof aiming!=='undefined' && aiming && typeof cancelAim==='function') cancelAim();
  var live=bowLive();
  if(live){ BOWAIM=null; shootAt(live); return; }
  var e=bowNextTarget();
  if(!e){ BOWAIM=null; log('Nothing in sight is within the <b>'+gearName(player.ranged)+'</b>’s reach.','c-info'); return; }
  BOWAIM=e;
  log('You draw the <b>'+gearName(player.ranged)+'</b> on the <b>'+e.name+'</b>. Press again to loose.','c-info');
  if(typeof draw==='function') draw();
}
/* the mark: the same four thin corner brackets the spell aim uses, in the bow's own colour */

function drawBowAimOverlay(){
  var e=bowLive(); if(!e || typeof ctx==='undefined' || !ctx) return;
  var ox=typeof camOX!=='undefined' ? camOX : 0, oy=typeof camOY!=='undefined' ? camOY : 0;
  var x0=(e.x-camX)*TS-ox+2,y0=(e.y-camY)*TS-oy+2,S=TS*entitySize(e)-4,c=Math.max(3,TS*.13);
  ctx.save(); ctx.globalAlpha=0.7; ctx.strokeStyle='#9FD8FF'; ctx.lineWidth=1; ctx.beginPath();
  ctx.moveTo(x0, y0+c); ctx.lineTo(x0, y0); ctx.lineTo(x0+c, y0);
  ctx.moveTo(x0+S-c, y0); ctx.lineTo(x0+S, y0); ctx.lineTo(x0+S, y0+c);
  ctx.moveTo(x0, y0+S-c); ctx.lineTo(x0, y0+S); ctx.lineTo(x0+c, y0+S);
  ctx.moveTo(x0+S-c, y0+S); ctx.lineTo(x0+S, y0+S); ctx.lineTo(x0+S, y0+S-c);
  ctx.stroke(); ctx.restore();
  return;

}
/* a turn passing makes the mark stale: monsters have moved. Aiming itself costs no turn. */


/* a bow sitting in the bag keeps its hotbar slot when you equip it from there: the slot becomes the bow slot
   instead of going empty, so the press that equipped it is the last press that ever equips it. */


/* Named floor-generation stages; ordered by generation-adapter.js. */
function migrateGeneratedRangedGear(seed){  if(typeof player!=='undefined' && player && player.sets && player.sets[1]){ migrateRangedSlot(); derive(player); } return; }
