/* Scene score shares the HUD's encounter predicate. Floor changes call
   playSceneMusic() directly, so a later biome never inherits Dungeon music. */
var ASTRA_SCORE=['crypt','caverns','underdark','plane-fire','plane-water','plane-air','plane-earth','plane-light','plane-shadow','boss-morty','boss-maw','boss-matron'];
var BIOME_SCORE=['dungeon','crypt','caverns','underdark'];
window.AUDIO_FILES=(window.AUDIO_FILES||[]).concat(ASTRA_SCORE.map(function(k){return 'music-'+k;}));
['door-close','trap-gas','skeleton-death'].forEach(function(n){if(window.AUDIO_FILES.indexOf(n)<0)window.AUDIO_FILES.push(n);});
function floorScore(n){
  n=Number(n)||1;
  return BIOME_SCORE[Math.max(0,Math.min(BIOME_SCORE.length-1,Math.floor((n-1)/5)))];
}
function explorationScore(){
  if(floorMeta && floorMeta.plane)return 'plane-'+floorMeta.plane;
  /* A Forge is an object on a numbered floor, not a separate region.  Its
     interaction keeps the Forge SFX, while exploration keeps the biome score. */
  return floorScore(typeof floorNo==='number'?floorNo:1);
}
function sceneScore(){
  var boss=activeBossEncounter();
  if(!boss)return explorationScore();
  var name=((boss.base&&boss.base.name)||boss.name||boss.kind||'').toLowerCase();
  return /mort/.test(name)?'boss-morty':/maw/.test(name)?'boss-maw':/matron/.test(name)?'boss-matron':'boss';
}
function playSceneMusic(){
  var kind=sceneScore();
  /* Keep the resolved floor and score together.  Load, ascend and descend all
     call this after changing floorNo, so the audio unlock can only resume the
     score selected for that floor. */
  AUDIO.sceneFloor=typeof floorNo==='number'?floorNo:1;
  AUDIO.sceneScore=kind;
  if(typeof document!=='undefined' && document.body)document.body.setAttribute('data-scene-music',kind);
  return playMusic(kind);
}
(function(){
  var basePlay=playMusic,baseStop=stopMusic;
  function isScene(k){return ['boss','dungeon','forge'].concat(ASTRA_SCORE).includes(k);}
  playMusic=function(kind){
    if(isScene(kind))kind=sceneScore();
    var r=basePlay(kind);syncAmbience(isScene(kind)?ambienceForScene():null);return r;
  };
  stopMusic=function(){baseStop();syncAmbience(null);};
  var baseBars=bars;
  bars=function(){
    var r=baseBars.apply(this,arguments),kind=AUDIO.musicKind||AUDIO.pendingMusic;
    if(isScene(kind)){
      if(player.hp<=0 || (RUN && RUN.over)){stopMusic();AUDIO.pendingMusic=null;}
      else if(RUN && RUN.victory)playMusic('victory');else playSceneMusic();
    }
    return r;
  };
})();
function ambienceForScene(){
  if(activeBossEncounter())return null;
  if(floorMeta && (floorMeta.forge||floorMeta.plane==='fire'))return 'amb-fire';
  if(floorMeta && floorMeta.plane==='water')return 'amb-water';
  return 'amb-dungeon';
}
var AMBIENCE_REQUEST=0;
function syncAmbience(name){
  if(!AUDIO.ctx || AUDIO.ambienceKind===name)return;
  AUDIO.ambienceKind=name;var request=++AMBIENCE_REQUEST;
  if(AUDIO.ambience){AUDIO.ambience.stop();AUDIO.ambience=null;}
  if(!name)return;
  loadFile(name,function(buf){
    if(!buf || AUDIO.ambienceKind!==name || request!==AMBIENCE_REQUEST)return;
    var c=AUDIO.ctx,s=c.createBufferSource(),g=c.createGain();s.buffer=buf;s.loop=true;
    g.gain.setValueAtTime(0,c.currentTime);g.gain.linearRampToValueAtTime(.16,c.currentTime+2);
    s.connect(g);g.connect(AUDIO.musicBus);s.onended=function(){s.disconnect();g.disconnect();};s.start();
    AUDIO.ambience={stop:function(){g.gain.cancelScheduledValues(c.currentTime);g.gain.setTargetAtTime(0,c.currentTime,.2);s.stop(c.currentTime+1);}};
  });
}
