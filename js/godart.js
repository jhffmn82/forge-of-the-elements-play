/* =====================================================================
   godart.js - the god statues (2026-09-17).
   Justin drew the eight shrines himself; tools/importgods.py cuts them out and writes them at 256px into the
   set group, where the Crypt set pieces live, instead of the 64px map cell the old shrine sprites used. That
   is why they read as carved stone now instead of mush.
   Everything that shows a god - the shrine tile on the map, the shrine panel, and the god cards on the
   character screen - asks objArt('structures', 'shrine-<god>'), so one redirect covers all three.
   ===================================================================== */
/* 2026-09-20: a shrine with no 256px set piece - Sylla's, whose art arrived as a plain map cell - hung the
   game. setArt() falls back to objArt('props', name) when the set group does not hold the name, and that
   fallback came straight back in here: objArt -> setArt -> objArt, forever. The redirect refuses to re-enter
   itself now, so a god without a set piece simply draws from the 64px structures sheet. */
(function(){
  if(typeof objArt!=='function') return;
  var _objArtGod = objArt, inSet=false;
  objArt = function(group, name){
    if(!inSet && name && typeof name==='string' && name.indexOf('shrine-')===0 && typeof setArt==='function'){
      var s;
      inSet=true;
      try{ s = setArt(name); } finally { inSet=false; }
      if(s) return s;
    }
    return _objArtGod(group, name);
  };
})();
