/* Measured presentation corrections for approved authored cells. Atlas pixels,
 * skeletons and grips stay together: the renderer shifts the whole composition.
 * Male Elf underwear idle planted-foot means (cell128):
 * 61.24,62.30,62.48,62.92,64.95,67.95,67.33,65.56,70.79.
 * Keep frame zero's origin. Walk/action motion is not normalized.
 */
(function(root){
  'use strict';
  var elfIdle=Object.freeze([0,-1.06,-1.24,-1.68,-3.71,-6.71,-6.09,-4.32,-9.55]);
  root.FoteCastFrameAlignment=Object.freeze({
    offset:function(look,meta,frame){
      if(look!=='elf-m-unclad'||!meta||meta.cell!==128||!meta.clips||!meta.clips.idle)return 0;
      var idle=meta.clips.idle;
      if(idle.frames!==elfIdle.length||frame.sy!==idle.row*meta.cell)return 0;
      var col=frame.sx/meta.cell;
      return Number.isInteger(col)?elfIdle[col]||0:0;
    }
  });
})(globalThis);
