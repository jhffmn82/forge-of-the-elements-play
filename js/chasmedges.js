/* chasmedges.js - Dungeon and Crypt chasms use the Caverns lip art (2026-09-19).
   The biome-1 chasm was drawn from an old corner-based tileset whose ragged black border read as a black outline
   around every chasm edge. The Caverns pack delivered proper crumbling lips, corners and floating debris
   (js/cavernrender.js draws them, regraded onto the cave floor); here the same drawing runs on the Dungeon and
   Crypt floors, regraded onto each biome's own flagstone colour. The planes keep their own terrain. */
var CHASM_FLOOR_TINT = { 0:[88,89,88], 1:[93,88,102] };   /* average colour of each biome's floor surface art */
function biomeChasmsOn(){
  return typeof map!=='undefined' && map && !(floorMeta && floorMeta.plane) && typeof inCaverns==='function' && !inCaverns()
      && CHASM_FLOOR_TINT[bidx()] !== undefined && typeof drawCaveChasms==='function';
}
/* the Caverns regrade reads PT_MAT.cavern.floor: point it at this biome's floor while the chasms draw */
var BIOME_TINT_CACHE = {};
function withBiomeTint(fn){
  var key=bidx(), keep=CAVE_TINT, mat=PT_MAT.cavern, keepFloor=mat.floor;
  CAVE_TINT = BIOME_TINT_CACHE[key] = BIOME_TINT_CACHE[key] || {};
  mat.floor = CHASM_FLOOR_TINT[key];
  try { fn(); } finally { mat.floor=keepFloor; CAVE_TINT=keep; }
}
var _drawWangLayerChasm = drawWangLayer;
drawWangLayer = function(key, tileType){ if(key==='chasm' && biomeChasmsOn()) return; return _drawWangLayerChasm(key, tileType); };
var _drawSurfaceDecoChasm = drawSurfaceDeco;
drawSurfaceDeco = function(){
  var r=_drawSurfaceDecoChasm.apply(this, arguments);
  if(biomeChasmsOn()){ var now=performance.now(); withBiomeTint(function(){ drawCaveChasms(now); }); ctx.globalAlpha=1; }
  return r;
};
