/* Dungeon and Crypt chasms share the procedural Caverns raster, tinted to
   each biome's floor colour. The planes keep their own terrain. */
/* average colour of each biome's floor art: environment-terrain-{dungeon,crypt}-floor.webp (2026-09-27; it was still the
   retired surface-floor.webp mean, so the Dungeon's lip was cold grey on the warm new stone) */
var CHASM_FLOOR_TINT = { 0:[135,119,103], 1:[97,91,107] };
function biomeChasmsOn(){
  return typeof map!=='undefined' && map && !(floorMeta && floorMeta.plane) && typeof inCaverns==='function' && !inCaverns()
      && CHASM_FLOOR_TINT[bidx()] !== undefined && typeof drawCaveChasms==='function';
}
/* The chasm raster reads PT_MAT.cavern.floor while drawing this biome. */
function withBiomeTint(fn){
  var key=bidx(), mat=PT_MAT.cavern, keepFloor=mat.floor;
  mat.floor = CHASM_FLOOR_TINT[key];
  try { fn(); } finally { mat.floor=keepFloor; }
}


function drawBiomeChasmSurface(){
  if(biomeChasmsOn()){ var now=performance.now(); withBiomeTint(function(){ drawCaveChasms(now); }); ctx.globalAlpha=1; }
  return;

}
