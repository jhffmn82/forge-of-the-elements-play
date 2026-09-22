/* Scene preparation for the original renderer. Caches are presentation-only.
 * Bake the first visible natural-terrain frame before returning control to the
 * browser, so a floor transition never exposes the progressive flat placeholders.
 */
(function(){
  var baseGenerate=generate;
  generate=function(){var result=baseGenerate.apply(this,arguments);repairWallMemorials();return result;};
  var previousMap=null, previousMeta=null, baseDraw=draw;
  draw=function(){
    var changed=previousMap!==map || previousMeta!==floorMeta;
    var result=baseDraw.apply(this,arguments);
    if(!changed)return result;
    var ptBudget=PT_BUDGET, deepBudget=DEEP_BUDGET;
    try{
      PT_BUDGET=1000000; DEEP_BUDGET=1000000;
      PT_CACHE.built=0; DC.built=0;
      for(var y=camY;y<=camY+viewH;y++)for(var x=camX;x<=camX+viewW;x++){
        if(!inb(x,y) || !(revealAll||seen[idxOf(x,y)]||vis[idxOf(x,y)]))continue;
        if(isWallLike(at(x,y)))wallTile(x,y);else floorTile(x,y);
      }
      DEEP_RC=false;DEEP_AT=-1;
      previousMap=map;previousMeta=floorMeta;
      return baseDraw.apply(this,arguments);
    }finally{PT_BUDGET=ptBudget;DEEP_BUDGET=deepBudget;}
  };
})();
