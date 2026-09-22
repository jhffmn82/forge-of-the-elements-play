(function(){
  document.querySelectorAll('#tabs [data-p="Sand"], #mSand').forEach(function(e){e.remove();});
  var show=showSheet;
  showSheet=function(name){if(name==='Sand')return;return show.apply(this,arguments);};
  MAPVIEW.on=false;
  mapviewSetOn=function(){};
  mapviewGo=function(){};
})();
