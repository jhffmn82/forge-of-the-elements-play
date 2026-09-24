/* Dungeon and Crypt chasms share the procedural Caverns raster, tinted to
   each biome's floor colour. The planes keep their own terrain. */
var CHASM_FLOOR_TINT = { 0:[88,89,88], 1:[93,88,102] };   /* average colour of each biome's floor surface art */
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
