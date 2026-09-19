/* =====================================================================
   godart.js - the god statues (2026-09-17).
   Justin drew the eight shrines himself; tools/importgods.py cuts them out and writes them at 256px into the
   set group, where the Crypt set pieces live, instead of the 64px map cell the old shrine sprites used. That
   is why they read as carved stone now instead of mush.
   Everything that shows a god - the shrine tile on the map, the shrine panel, and the god cards on the
   character screen - asks objArt('structures', 'shrine-<god>'), so one redirect covers all three.
   ===================================================================== */
(function(){
  if(typeof objArt!=='function') return;
  var _objArtGod = objArt;
  objArt = function(group, name){
    if(name && typeof name==='string' && name.indexOf('shrine-')===0 && typeof setArt==='function'){
      var s = setArt(name);
      if(s) return s;
    }
    return _objArtGod(group, name);
  };
})();
