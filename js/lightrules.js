/* lightrules.js - one kind of light per room, and never two side by side (2026-09-19).
   Justin: a brazier, a candelabra and a candle cluster crowding one corner read as clutter. After the floor is
   built (every generator and pass before this one), each room keeps a single family of fire light - the one it has
   most of - and any light touching another light (8 neighbours) goes. The glow a removed piece cast goes with it.
   Natural glows (mushrooms, geodes, pylons, pools) are scenery, not fixtures, and are left alone; so are unlit
   braziers and anything a puzzle placed. */
var LIGHT_FAMILY = [
  [/^(brazier-lit|soul-brazier)$/, 'brazier'],
  [/^torch-stand$/,                'torch'],
  [/^(table-candle|candelabra|candles-\d)$/, 'candle'],
  [/^kobold-campfire$/,            'campfire']
];
function lightFamily(p){
  if(!p || p.puzzle) return null;
  for(var i=0;i<LIGHT_FAMILY.length;i++) if(LIGHT_FAMILY[i][0].test(p.name)) return LIGHT_FAMILY[i][1];
  return null;
}
function lightRulesPass(){
  if(typeof props==='undefined' || !props.length || (floorMeta && floorMeta.plane)) return;
  var gone=[];
  function drop(p){ var i=props.indexOf(p); if(i>=0){ props.splice(i,1); gone.push(p); } }
  /* 1. one family per room: the one it has most of (ties: whichever came first) */
  rooms.forEach(function(r){
    var inR=props.filter(function(p){ return lightFamily(p) && p.x>=r.x && p.x<r.x+r.w && p.y>=r.y && p.y<r.y+r.h; });
    if(inR.length<2) return;
    var n={}, order=[]; inR.forEach(function(p){ var f=lightFamily(p); if(!n[f]){ n[f]=0; order.push(f); } n[f]++; });
    var keep=order.reduce(function(a,f){ return n[f]>n[a] ? f : a; }, order[0]);
    inR.forEach(function(p){ if(lightFamily(p)!==keep) drop(p); });
  });
  /* 2. no two lights touching, anywhere (rooms and halls) */
  var lights=props.filter(lightFamily);
  lights.forEach(function(p){
    if(props.indexOf(p)<0) return;
    lights.forEach(function(q){ if(q!==p && props.indexOf(q)>=0 && Math.max(Math.abs(q.x-p.x),Math.abs(q.y-p.y))<=1) drop(q); });
  });
  if(!gone.length) return;
  /* the glow each removed piece cast (cryptpack's candle lights live in planeLights) */
  if(floorMeta && floorMeta.planeLights) floorMeta.planeLights=floorMeta.planeLights.filter(function(l){
    return !gone.some(function(p){ return Math.abs(l.x-p.x)<0.8 && Math.abs(l.y-(p.y+0.2))<0.8; });
  });
  if(typeof rebuildPropGrid==='function') rebuildPropGrid();
}
var _generateLightRules = generate;
generate = function(seed){ var r=_generateLightRules.apply(this, arguments); try{ lightRulesPass(); }catch(e){ if(window.console) console.warn('lightrules', e); } return r; };
