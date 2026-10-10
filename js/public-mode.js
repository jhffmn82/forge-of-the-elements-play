FoteLifecycle.whenReady(function(){
  document.querySelectorAll('#tabs [data-p="Sand"], #mSand').forEach(function(e){e.remove();});
  MAPVIEW.on=false;
});
