/* Silk Weaver offspring reuse every native Spiderling frame and placement.
 * The only new material is the purple recolor; gameplay lives in Chaos AI. */
(function(root){
  'use strict';
  var source=root.ASSETS.mobs['m-spiderling'];
  if(!source)throw new Error('Native Spiderling artwork is required for Chaos Spiderlings.');
  var variant=JSON.parse(JSON.stringify(source));
  variant.file='mob-m-chaos-spiderling.webp';
  variant.artLeft=true;
  root.CHAOS_ENEMY_ATLAS['m-chaos-spiderling']=variant;
})(globalThis);
