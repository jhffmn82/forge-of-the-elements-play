/* ============================================================================
   audio.js - sound effects and music.
   Every effect first tries audio/<name>.ogg (see art/SOUNDS.md). Until that file
   exists, a small synthesized stand-in plays instead, so nothing is silent.
   ========================================================================== */

var AUDIO = { ctx:null, master:null, sfxBus:null, musicBus:null, verb:null, muted:false, musicOn:true,
              files:{}, missing:{}, music:null, musicKind:null, vol:{sfx:0.5, music:0.5} };   /* 2026-09-23 (Justin): both sliders start at 50% */
/* Justin, 2026-09-22: music softer by default, slider at 50%. Every music loop now sits at -24 LUFS (tools/level-music.py)
   instead of -14..-22 with a hidden -3 dB on some kinds. A saved 0.45 is the old default nobody touched: it becomes 0.5 once. */
try { var _m=localStorage.getItem('astra-temple-audio'); if(_m){ var o=JSON.parse(_m); AUDIO.muted=!!o.muted; AUDIO.musicOn=o.musicOn!==false; AUDIO.vol=o.vol||AUDIO.vol;
  if(!o.levelled && AUDIO.vol && Math.abs(AUDIO.vol.music-0.45)<1e-6){ AUDIO.vol.music=0.5; } AUDIO.levelled=true;
  /* 2026-09-23: a saved 0.8 is the old effects default nobody touched: it becomes 0.5 once */
  if(!o.effects && AUDIO.vol && Math.abs(AUDIO.vol.sfx-0.8)<1e-6){ AUDIO.vol.sfx=0.5; } } } catch(e){}

function audioInit(){
  if(AUDIO.ctx) { if(AUDIO.ctx.state==='suspended') AUDIO.ctx.resume(); return; }
  var AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
  var c=new AC(); AUDIO.ctx=c;
  AUDIO.master=c.createGain(); AUDIO.master.gain.value=AUDIO.muted?0:1;
  var limiter=c.createDynamicsCompressor();limiter.threshold.value=-3;limiter.knee.value=3;limiter.ratio.value=12;limiter.attack.value=.003;limiter.release.value=.15;
  AUDIO.master.connect(limiter);limiter.connect(c.destination);AUDIO.limiter=limiter;
  AUDIO.sfxBus=c.createGain(); AUDIO.sfxBus.gain.value=AUDIO.vol.sfx; AUDIO.sfxBus.connect(AUDIO.master);
  AUDIO.musicBus=c.createGain(); AUDIO.musicBus.gain.value=AUDIO.musicOn?AUDIO.vol.music:0; AUDIO.musicBus.connect(AUDIO.master);
  /* a generated impulse response gives everything a stone-room echo */
  var len=Math.floor(c.sampleRate*0.65), ir=c.createBuffer(2,len,c.sampleRate);
  for(var ch=0;ch<2;ch++){ var d=ir.getChannelData(ch); for(var i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.2); }
  AUDIO.verb=c.createConvolver(); AUDIO.verb.buffer=ir;
  var vg=c.createGain(); vg.gain.value=0.08; AUDIO.verb.connect(vg); vg.connect(AUDIO.sfxBus);
  if(AUDIO.pendingMusic){ var requested=AUDIO.pendingMusic; AUDIO.pendingMusic=null; playMusic(requested); }
}
['pointerdown','keydown'].forEach(function(ev){ window.addEventListener(ev, audioInit, {passive:true}); });
function audioSave(){ try{ localStorage.setItem('astra-temple-audio', JSON.stringify({muted:AUDIO.muted, musicOn:AUDIO.musicOn, vol:AUDIO.vol, levelled:true, effects:true})); }catch(e){} }
function toggleMute(){ AUDIO.muted=!AUDIO.muted; if(AUDIO.master) AUDIO.master.gain.value=AUDIO.muted?0:1; audioSave(); return AUDIO.muted; }
function toggleMusic(){ AUDIO.musicOn=!AUDIO.musicOn; if(AUDIO.musicBus) AUDIO.musicBus.gain.setTargetAtTime(AUDIO.musicOn?AUDIO.vol.music:0, AUDIO.ctx.currentTime, 0.3); audioSave(); return AUDIO.musicOn; }

/* ---- file-backed playback with synth fallback ---- */
var AUDIO_LOADING={},AUDIO_MUSIC_LRU=[],AUDIO_MUSIC_REQUEST=0;
function musicGain(kind){return 1;}   /* 2026-09-22: the files are levelled to -24 LUFS; the slider is the only music gain */
function loadFile(name, cb){
  if(AUDIO.files[name]) return cb(AUDIO.files[name]);
  if(AUDIO.missing[name]) return cb(null);
  if(!(window.AUDIO_FILES && window.AUDIO_FILES.indexOf(name)>=0)){ AUDIO.missing[name]=true; return cb(null); }
  if(AUDIO_LOADING[name]){AUDIO_LOADING[name].push(cb);return;}
  AUDIO_LOADING[name]=[cb];
  function finish(buf){var callbacks=AUDIO_LOADING[name]||[];delete AUDIO_LOADING[name];callbacks.forEach(function(f){f(buf);});}
  fetch('audio/'+name+'.ogg').then(function(r){ if(!r.ok) throw 0; return r.arrayBuffer(); })
    .then(function(b){ return AUDIO.ctx.decodeAudioData(b); })
    .then(function(buf){
      AUDIO.files[name]=buf;
      if(name.indexOf('music-')===0){AUDIO_MUSIC_LRU.push(name);while(AUDIO_MUSIC_LRU.length>3)delete AUDIO.files[AUDIO_MUSIC_LRU.shift()];}
      finish(buf);
    })
    .catch(function(){ finish(null); });
}
var SFX_ALIASES={
  'shaman-attack':'shaman-cast','shaman-alert':'goblin-alert',
  'skeleton-alert':'skeleton-rattle',
  'mimic-alert':'mimic-reveal',
  'warchief-attack':'brute-attack','warchief-alert':'warchief-roar',
  'elementaling-alert':'elementaling-appear',
  'rat-alert':'rat-attack','bat-alert':'bat-attack','brute-alert':'brute-attack','slime-alert':'slime-attack',
  /* gap pass 2026-09-22: boss voices. An alias is one level deep, so each points straight at a file. */
  'maw-alert':'maw-intro','matron-alert':'matron-intro',
  'emberlord-alert':'emberlord-intro','emberlord-attack':'brute-attack',
  'leviathan-alert':'leviathan-intro','leviathan-attack':'brute-attack',
  'djinn-alert':'djinn-intro','djinn-attack':'lightning-cast',
  'night-warden-alert':'night-warden-intro','night-warden-attack':'shadow-cast',
  'radiant-warden-attack':'light-cast',
  'morty-alert':'morty-intro','radiant-warden-alert':'radiant-warden-intro',
  'heart-alert':'heart-intro','heart-attack':'golem-attack'
};
var SFX_LAST={},SFX_LAST_GAIN={},SFX_VOICES=[],SFX_STEP=0,SFX_SYNTH_GAIN=1;
/* ---- per-sound levels: one table, on top of a call's own vol ----
   2026-09-29 (Justin): "sound effects overall are too loud." An algorithmic pass over docs/sfx-pass-measurements.json
   (after.rms_dbfs, the level of each shipped file). The reference is the median of the weapon combat sounds (swing,
   miss, hit-flesh, hit-crit, hit-armor, parry, block, bow-shot, arrow-hit, double-strike): -24.51 dBFS. Every other
   effect louder than that is brought down to it: gain = 10^((-24.51 - level)/20), never above 1, times the level it
   already had here (2026-09-28: level-up, victory, trap-spot and magic-missile-hit at half; pickup-mote at half,
   1.3.2 ruling 6). Left alone: every combat sound, the crate/barrel and pot breaks, the bag pickup, and anything
   at or below the reference; music and ambience are not effects and have their own levels.
   Extra halvings on top of the normalized value (Justin): goblin-death, magic-missile (the cast), pickup-essence
   (the gain chime), level-up and identify ("you now know your X"). Trampling grass is cut at its call instead
   (js/systems.js, vol 0.15). A name played through SFX_ALIASES takes its file's level unless it has its own. */
var SFX_LEVEL={
  /* creatures */ 'bat-attack':.56, 'bat-death':.36, 'brute-attack':.47, 'brute-death':.4, 'goblin-alert':.31, 'goblin-death':.17, 'rat-attack':.7, 'rat-death':.58, 'slime-death':.52, 'warchief-death':.35, 'warchief-roar':.29,
  /* traps */ 'trap-alarm':.4, 'trap-frost':.49, 'trap-gas':.64, 'trap-pit':.28, 'trap-spark':.44, 'trap-spot':.5, 'trap-teleport':.63,
  /* status */ 'status-burn':.88, 'status-fear':.28, 'status-poison':.54,
  /* spells */ 'cast-generic':.63, 'explosion':.97, 'fire-hit':.97, 'ice-hit':.94, 'light-cast':.42, 'light-hit':.18, 'lightning-hit':.61, 'magic-missile':.28, 'magic-missile-hit':.36, 'shadow-cast':.45, 'vanish':.74,
  /* divine */ 'forge-enchant':.79, 'forge-fuse':.6, 'heal':.87, 'piety-rank':.39, 'pray':.26, 'shrine-convert':.69, 'shrine-open':.46, 'summon':.59, 'wobbles-giggle':.45, 'wrath':.38,
  /* cues */ 'elementaling-appear':.83, 'identify':.32, 'level-up':.14, 'new-ability':.94, 'pickup-essence':.37, 'pickup-mote':.42, 'puzzle-solved':.93, 'stat-point':.94, 'status-stun':.89, 'victory':.26,
  /* interface */ 'inventory-full':.47, 'no-mana':.77, 'ui-error':.67,
  /* inventory */ 'eat':.79, 'pickup-key':.59,
  /* movement */ 'step-grass':.64, 'step-stone':.66
};
function sfxGain(name,opts,file){var level=SFX_LEVEL[name]!==undefined?SFX_LEVEL[name]:file&&SFX_LEVEL[file]!==undefined?SFX_LEVEL[file]:1;return (opts&&opts.vol!==undefined?opts.vol:1)*level;}
/* 2026-09-28 (Justin): "sound effects soften by distance: near (within 5 spaces), 70% between 5-8, 30% between 8-12,
   and after that you don't hear it." A sound with a place in the world names it with opts.from: a tile {x,y} or a
   creature, or a list of them (the nearest counts). Distance is spaces as movement counts them (a diagonal step is
   one) from your tile to the source; walls and sight do not matter. No from (menus, your own actions, stairs,
   level-up, stingers) plays at full volume. */
var SFX_DISTANCE_BANDS=[{upTo:5,gain:1},{upTo:8,gain:.7},{upTo:12,gain:.3}];   /* farther than 12: not played */
function sfxDistanceGain(from){
  if(Array.isArray(from)) return from.length ? from.reduce(function(best,f){ return Math.max(best,sfxDistanceGain(f)); },0) : 1;
  var p=typeof player!=='undefined' ? player : null;   /* no player yet (the title screen): full volume */
  if(!from || !p || typeof from.x!=='number' || typeof from.y!=='number' || typeof p.x!=='number' || typeof p.y!=='number') return 1;
  var d=Math.max(Math.abs(from.x-p.x),Math.abs(from.y-p.y));
  for(var i=0;i<SFX_DISTANCE_BANDS.length;i++) if(d<=SFX_DISTANCE_BANDS[i].upTo) return SFX_DISTANCE_BANDS[i].gain;
  return 0;
}
function sfx(name, opts){
  if(!AUDIO.ctx || AUDIO.muted || !name) return;
  var now=performance.now();
  opts=opts||{};
  if(opts.vol===0)return;
  /* distance before de-duplication: a sound too far away to hear, or a softer copy, never swallows a nearer one */
  var near=opts.from ? sfxDistanceGain(opts.from) : 1;
  if(near<=0)return;
  /* game sounds follow the animation queue: a swing sounds when the swing plays, not when the key was pressed */
  var at = opts.at===undefined ? (name.indexOf('ui-')!==0 && typeof fxClock==='number' ? Math.max(now, fxClock) : now) : opts.at;
  var alert=/-alert$/.test(name),ui=/^ui-(click|open|close|hover)$/.test(name),group=alert?'creature-alert':ui?'ui-feedback':name;
  if(SFX_LAST[group]!==undefined && Math.abs(at-SFX_LAST[group])<(alert?350:ui?70:40) && SFX_LAST_GAIN[group]>=near)return;
  SFX_LAST[group]=at; SFX_LAST_GAIN[group]=near;
  var file=name==='step-stone' ? ['step-stone','step-stone-1','step-stone-3','step-stone-2'][SFX_STEP++%4] : (SFX_ALIASES[name]||name);
  loadFile(file, function(buf){
    if(AUDIO.muted || performance.now()>at+500)return; // Never replay stale impacts after slow decoding.
    var c=AUDIO.ctx, t=c.currentTime+Math.max(0,(at-performance.now())/1000);
    if(buf){
      var s=c.createBufferSource(); s.buffer=buf; s.playbackRate.value=opts.rate||1;
      while(SFX_VOICES.length>=24){var old=SFX_VOICES.shift();try{old.stop();}catch(e){}}
      var g=c.createGain(); g.gain.value=sfxGain(name,opts,file)*(alert?.55:1)*near; s.connect(g); g.connect(AUDIO.sfxBus);
      if(/^(fire|ice|lightning|earth|light|shadow|magic|cast|shrine|pray|summon|heal|forge|wrath)/.test(name))g.connect(AUDIO.verb);
      SFX_VOICES.push(s);s.onended=function(){var i=SFX_VOICES.indexOf(s);if(i>=0)SFX_VOICES.splice(i,1);s.disconnect();g.disconnect();};s.start(t);
    } else { SFX_SYNTH_GAIN=near; try{ synth(name, t, opts); } finally{ SFX_SYNTH_GAIN=1; } }   /* the stand-in softens with distance too */
  });
}

/* One quiet click for mouse, touch and keyboard activation, including new HUD controls. */
if(typeof document!=='undefined')document.addEventListener('click',function(ev){
  var el=ev.target&&ev.target.closest&&ev.target.closest('#top,#bars,#hud2,#studyReadouts,#studyExplore,#log,#hotbar,#dpad,#shade,#modal,#statusbar,#title .menu,#create button,#create .card');
  if(!el||ev.defaultPrevented||ev.target.closest('[disabled],[aria-disabled="true"]'))return;
  audioInit();sfx('ui-click');
},true);

/* ---- the synth ---- */
function envGain(t, a, d, peak){ var g=AUDIO.ctx.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime((peak||0.5)*SFX_SYNTH_GAIN,t+a); g.gain.exponentialRampToValueAtTime(0.0001,t+a+d); return g; }
function tone(t, type, f1, f2, dur, vol, dest){
  var c=AUDIO.ctx, o=c.createOscillator(); o.type=type; o.frequency.setValueAtTime(f1,t); if(f2) o.frequency.exponentialRampToValueAtTime(Math.max(20,f2), t+dur);
  var g=envGain(t, Math.min(0.01,dur*0.2), dur, vol||0.3); o.connect(g); g.connect(dest||AUDIO.sfxBus); g.connect(AUDIO.verb); trackSynth(o,[g]); o.start(t); o.stop(t+dur+0.05);
}
var NOISE=null;
function noise(t, dur, vol, fType, f1, f2, q){
  var c=AUDIO.ctx;
  if(!NOISE){ NOISE=c.createBuffer(1,c.sampleRate*2,c.sampleRate); var d=NOISE.getChannelData(0); for(var i=0;i<d.length;i++) d[i]=Math.random()*2-1; }
  var s=c.createBufferSource(); s.buffer=NOISE; var f=c.createBiquadFilter(); f.type=fType||'lowpass'; f.frequency.setValueAtTime(f1||1200,t);
  if(f2) f.frequency.exponentialRampToValueAtTime(Math.max(30,f2), t+dur); f.Q.value=q||0.8;
  var g=envGain(t, Math.min(0.008,dur*0.15), dur, vol||0.3); s.connect(f); f.connect(g); g.connect(AUDIO.sfxBus); g.connect(AUDIO.verb);
  trackSynth(s,[f,g]);s.start(t, Math.random()); s.stop(t+dur+0.05);
}
function trackSynth(s,nodes){
  while(SFX_VOICES.length>=24){var old=SFX_VOICES.shift();try{old.stop();}catch(e){}}
  SFX_VOICES.push(s);s.onended=function(){var i=SFX_VOICES.indexOf(s);if(i>=0)SFX_VOICES.splice(i,1);s.disconnect();nodes.forEach(function(n){n.disconnect();});};
}
function arp(t, notes, step, type, vol){ notes.forEach(function(n,i){ tone(t+i*step, type||'triangle', n, 0, step*2.2, vol||0.18); }); }
var ELEM_SYNTH = {
  fire:function(t,h){ noise(t,h?0.45:0.35,0.35,'bandpass',h?1800:600,h?300:2400,1.2); if(h) tone(t,'sawtooth',120,50,0.3,0.12); },
  ice:function(t,h){ tone(t,'sine',h?1800:1400,h?900:2400,0.25,0.15); tone(t+0.03,'triangle',h?2600:2100,0,0.2,0.08); if(h) noise(t,0.25,0.2,'highpass',4000,6000); },
  lightning:function(t,h){ noise(t,h?0.3:0.2,0.4,'highpass',2500,8000,2); tone(t,'square',h?90:220,40,0.15,0.1); },
  earth:function(t,h){ noise(t,0.4,0.45,'lowpass',400,80); tone(t,'sine',80,40,0.3,0.25); },
  light:function(t,h){ tone(t,'sine',h?1320:880,0,0.6,0.14); tone(t,'sine',h?1980:1320,0,0.5,0.08); },
  dark:function(t,h){ tone(t,'sawtooth',h?110:160,h?55:90,0.5,0.1); noise(t,0.5,0.18,'bandpass',300,150,4); },
  magic:function(t,h){ tone(t,'square',h?660:900,h?330:1800,0.18,0.1); tone(t+0.02,'sine',h?990:1350,0,0.15,0.08); }
};
function synth(name, t, opts){
  var n=name;
  if(/^step-grass/.test(n)) return noise(t,0.18,0.12,'highpass',2500,5000);
  if(/^step-water/.test(n)) return noise(t,0.22,0.18,'bandpass',900,400,2);
  if(/^step/.test(n)) return noise(t,0.06,0.06,'lowpass',700,200);
  if(n==='swing') return noise(t,0.16,0.18,'bandpass',900,2500,1.5);
  if(n==='miss') return noise(t,0.14,0.12,'bandpass',1500,3000,1.2);
  if(n==='hit-flesh'||n==='sap') { noise(t,0.12,0.4,'lowpass',900,150); return tone(t,'sine',140,60,0.12,0.25); }
  if(n==='hit-armor'||n==='parry'||n==='block') { tone(t,'triangle',1200,900,0.18,0.15); return noise(t,0.1,0.25,'highpass',2000,4000); }
  if(n==='hit-crit') { noise(t,0.2,0.5,'lowpass',1400,120); return tone(t,'sawtooth',180,50,0.2,0.2); }
  if(n==='double-strike') { noise(t,0.12,0.2,'bandpass',1200,2800); return noise(t+0.12,0.12,0.2,'bandpass',1200,2800); }
  if(n==='bow-shot') return tone(t,'triangle',420,180,0.14,0.2);
  if(n==='arrow-hit') return noise(t,0.08,0.3,'lowpass',1500,300);
  if(n==='player-hurt') { tone(t,'sawtooth',220,140,0.18,0.12); return noise(t,0.12,0.25,'lowpass',800,200); }
  if(n==='player-death') { tone(t,'sawtooth',220,55,1.2,0.18); return tone(t+0.2,'sine',110,40,1.2,0.2); }
  if(n==='level-up') return arp(t,[523,659,784,1046,1318],0.09,'triangle',0.16*sfxGain(name,opts));
  if(n==='new-ability'||n==='puzzle-solved'||n==='identify') return arp(t,[784,988,1175,1568],0.08,'sine',0.14);
  if(/^pickup-mote/.test(n)) return arp(t,[440,660,880,1320],0.06,'sine',0.12);
  if(/^pickup-essence/.test(n)) return arp(t,[1320,1760],0.05,'sine',0.08);
  if(/^pickup-key/.test(n)) { tone(t,'triangle',2400,0,0.08,0.08); return tone(t+0.06,'triangle',2900,0,0.08,0.08); }
  if(/^pickup|equip/.test(n)) { noise(t,0.08,0.15,'bandpass',2000,1200,2); return tone(t+0.03,'triangle',1100,0,0.08,0.08); }
  if(n==='eat') { for(var i=0;i<3;i++) noise(t+i*0.11,0.07,0.15,'bandpass',1400,900,3); return; }
  if(n==='door-close') return tone(t,'sawtooth',140,60,0.25,0.05) || noise(t,0.18,0.14,'lowpass',400,120);
  if(n==='door-open') return tone(t,'sawtooth',180,90,0.5,0.05) || noise(t,0.3,0.1,'lowpass',500,200);
  if(n==='door-locked'||n==='chest-locked'||n==='ui-error'||n==='no-mana'||n==='inventory-full') return tone(t,'square',140,90,0.15,0.08);
  if(n==='door-unlock') { noise(t,0.12,0.2,'bandpass',2200,1800,4); return tone(t+0.12,'square',300,200,0.1,0.1); }
  if(n==='door-secret'||n==='bridge') return noise(t,0.8,0.3,'lowpass',300,90);
  if(n==='stairs') { for(var s=0;s<5;s++) noise(t+s*0.16,0.07,0.12,'lowpass',600,200); return; }
  if(n==='chest-open') { tone(t,'sawtooth',160,260,0.3,0.05); return arp(t+0.25,[660,880],0.07,'sine',0.08); }
  if(n==='crate-break'||n==='pot-break') { noise(t,0.3,0.4,'bandpass',n==='pot-break'?2400:900,300,1); return; }
  if(n==='explosion') { noise(t,1.0,0.8,'lowpass',1600,40); return tone(t,'sine',70,30,0.8,0.5); }
  if(n==='fire-ignite') return noise(t,0.5,0.3,'bandpass',500,2500,0.8);
  if(n==='lever'||n==='plate-press') { tone(t,'square',220,180,0.08,0.08); return noise(t+0.05,0.2,0.2,'lowpass',500,200); }
  if(n==='ice-melt') { noise(t,0.6,0.25,'highpass',3000,1200); return tone(t,'sine',1800,600,0.5,0.06); }
  if(n==='thorns-burn') return noise(t,0.7,0.3,'bandpass',1200,400,1);
  if(/cast|missile|fire|ice|lightning|earth|light|shadow/.test(n)){
    var el = /fire/.test(n)?'fire':/ice/.test(n)?'ice':/lightning/.test(n)?'lightning':/earth/.test(n)?'earth':/light/.test(n)?'light':/shadow/.test(n)?'dark':'magic';
    return ELEM_SYNTH[el](t, /hit/.test(n));
  }
  if(n==='heal'||n==='pray') return arp(t,[523,659,784],0.12,'sine',0.1);
  if(n==='summon') { noise(t,0.8,0.25,'bandpass',300,120,3); return tone(t,'sawtooth',90,60,0.8,0.08); }
  if(n==='vanish') return tone(t,'sine',600,120,0.5,0.1);
  if(/^forge/.test(n)) { tone(t,'triangle',880,860,0.8,0.18); tone(t,'sine',1760,0,0.6,0.08); return noise(t,0.3,0.2,'bandpass',3000,1500,3); }
  if(/^shrine|piety|convert/.test(n)) return arp(t,[392,494,587,784],0.18,'sine',0.12);
  if(n==='wrath') return noise(t,1.2,0.5,'lowpass',400,40);
  if(n==='wobbles-giggle') return arp(t,[880,1175,988,1320,1046],0.07,'square',0.06);
  if(/^trap-spot/.test(n)) return tone(t,'sine',1200,1600,0.12,0.08);
  if(/^trap-alarm/.test(n)) { for(var b=0;b<6;b++) tone(t+b*0.12,'square',1600,0,0.08,0.08); return; }
  if(/^trap-teleport/.test(n)) return tone(t,'sine',300,1800,0.5,0.12);
  if(/^trap-pit/.test(n)) return tone(t,'sine',600,80,1.0,0.12);
  if(/^trap/.test(n)) return noise(t,0.25,0.3,'bandpass',1400,500,1.5);
  if(/status-burn/.test(n)) return noise(t,0.3,0.15,'highpass',3000,5000);
  if(/status/.test(n)) return tone(t,'sine',500,300,0.3,0.06);
  if(/^rat/.test(n)) return tone(t,'square',1800,2400,0.1,0.05);
  if(/^bat/.test(n)) return tone(t,'sine',3200,2600,0.15,0.05);
  if(/^goblin|^shaman/.test(n)) return tone(t,'sawtooth',320,200,0.18,0.08);
  if(/^brute|^warchief/.test(n)) { tone(t,'sawtooth',110,60,0.5,0.15); return noise(t,0.4,0.3,'lowpass',500,80); }
  if(/^slime/.test(n)) return tone(t,'sine',200,90,0.25,0.15);
  if(/^elementaling/.test(n)) return arp(t,[1320,1760,2093],0.05,'sine',0.07);
  if(/^mimic|^skeleton/.test(n)) return noise(t,0.3,0.25,'bandpass',800,400,4);
  if(n==='ui-click'||n==='ui-hover') return tone(t,'sine',900,0,0.04,0.05);
  if(n==='ui-open') return noise(t,0.18,0.08,'bandpass',2500,1200,2);
  if(n==='ui-close') return noise(t,0.14,0.07,'bandpass',1200,2500,2);
  if(n==='stat-point') return tone(t,'sine',1320,0,0.2,0.1);
  if(n==='victory') return arp(t,[523,659,784,1046,784,1046,1318,1568],0.14,'triangle',0.16*sfxGain(name,opts));
  tone(t,'sine',660,0,0.08,0.05);
}

/* ---- music: file first, generative score otherwise ---- */
function musicEnds(buf){ /* a song with an ending rather than a loop: its last half second is silent */
  if(!buf || typeof buf.getChannelData!=='function' || !buf.sampleRate) return false;
  var d=buf.getChannelData(0), n=Math.floor(buf.sampleRate*0.5), peak=0;
  for(var i=Math.max(0,d.length-n);i<d.length;i++){ var a=Math.abs(d[i]); if(a>peak) peak=a; }
  return peak<0.01;
}
function playMusic(kind){
  /* pendingMusic is the request waiting for the first user gesture, not a
     historical track.  Leaving the old request here allowed a load or a
     downstairs transition to fall back to the earlier biome later. */
  if(!AUDIO.ctx){ AUDIO.pendingMusic=kind; return; }
  AUDIO.pendingMusic=null;
  if(AUDIO.musicKind===kind) return;
  stopMusic(); AUDIO.musicKind=kind;var request=++AUDIO_MUSIC_REQUEST;
  loadFile('music-'+kind, function(buf){
    if(AUDIO.musicKind!==kind || request!==AUDIO_MUSIC_REQUEST) return;
    var c=AUDIO.ctx;
    if(buf){
      /* Justin, 2026-09-22: the menu song fades in softly. A track that ends (its last half second is silent,
         a song rather than a loop) plays once and comes back after a rest instead of looping mid-phrase. */
      var fade=(kind==='menu'||kind==='title')?6:2, once=musicEnds(buf), s, g, timer=null, stopped=false;
      function start(){
        s=c.createBufferSource(); s.buffer=buf; s.loop=!once; g=c.createGain(); g.gain.setValueAtTime(0,c.currentTime); g.gain.linearRampToValueAtTime(musicGain(kind),c.currentTime+fade);
        s.connect(g); g.connect(AUDIO.musicBus);
        s.onended=function(){ s.disconnect(); g.disconnect();
          if(once && !stopped && AUDIO.musicKind===kind && request===AUDIO_MUSIC_REQUEST)
            timer=setTimeout(function(){ timer=null; if(!stopped && AUDIO.musicKind===kind && request===AUDIO_MUSIC_REQUEST) start(); }, AUDIO.musicRestMs||5000); };
        s.start();
      }
      start();
      AUDIO.music={stop:function(){ stopped=true; if(timer){clearTimeout(timer);timer=null;} g.gain.cancelScheduledValues(c.currentTime);g.gain.setTargetAtTime(0,c.currentTime,.25); s.stop(c.currentTime+1.1); }};
    } else AUDIO.music=generativeMusic(kind);
  });
}
function stopMusic(){ AUDIO_MUSIC_REQUEST++;if(AUDIO.music){ try{ AUDIO.music.stop(); }catch(e){} AUDIO.music=null; } AUDIO.musicKind=null; }
function generativeMusic(kind){
  var c=AUDIO.ctx, out=c.createGain(); out.gain.value=0; out.gain.linearRampToValueAtTime(1, c.currentTime+3); out.connect(AUDIO.musicBus);
  var wet=c.createGain(); wet.gain.value=0.6; out.connect(AUDIO.verb);
  var boss = kind==='boss', title = kind==='title'||kind==='menu', vict = kind==='victory';
  var root = boss ? 55 : title ? 65.4 : 58.3;               /* A1, C2, Bb1 */
  var scale = boss ? [0,1,3,5,7,8,10] : [0,2,3,5,7,8,10];  /* phrygian for the boss, aeolian otherwise */
  var drones=[];
  [1, 1.5, 2].forEach(function(mult, i){
    var o=c.createOscillator(); o.type= i===0 ? 'sawtooth' : 'triangle'; o.frequency.value=root*mult;
    var f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.value= boss ? 500 : 320; f.Q.value=0.5;
    var g=c.createGain(); g.gain.value= i===0 ? 0.05 : 0.035;
    var lfo=c.createOscillator(); lfo.frequency.value=0.05+i*0.03; var lg=c.createGain(); lg.gain.value=90; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    o.connect(f); f.connect(g); g.connect(out); o.start(); drones.push(o, lfo);
  });
  var alive=true, step=0;
  function note(){
    if(!alive) return;
    var t=c.currentTime+0.05;
    var deg=scale[Math.floor(Math.random()*scale.length)], oct= Math.random()<0.3 ? 4 : 8;
    var f=root*oct*Math.pow(2,deg/12);
    if(boss){
      if(step%2===0){ var k=c.createOscillator(); k.type='sine'; k.frequency.setValueAtTime(90,t); k.frequency.exponentialRampToValueAtTime(40,t+0.18);
        var kg=envGain(t,0.005,0.25,0.35); k.connect(kg); kg.connect(out); k.start(t); k.stop(t+0.3); }
      if(step%4===3) { var s=c.createBufferSource(); if(!NOISE){ noise(t,0.01,0.0001); } s.buffer=NOISE; var hf=c.createBiquadFilter(); hf.type='highpass'; hf.frequency.value=5000; var hg=envGain(t,0.003,0.06,0.08); s.connect(hf); hf.connect(hg); hg.connect(out); s.start(t,Math.random()); s.stop(t+0.1); }
      if(Math.random()<0.45){ var o2=c.createOscillator(); o2.type='sawtooth'; o2.frequency.value=f/2; var g2=envGain(t,0.02,0.35,0.05); var lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1400; o2.connect(lp); lp.connect(g2); g2.connect(out); o2.start(t); o2.stop(t+0.5); }
    } else if(Math.random()< (title?0.8:0.55)){
      var o3=c.createOscillator(); o3.type= title ? 'triangle' : 'sine'; o3.frequency.value=f;
      var g3=envGain(t,0.01, title?1.6:2.4, title?0.09:0.06); o3.connect(g3); g3.connect(out); o3.start(t); o3.stop(t+3);
      if(Math.random()<0.3){ var o4=c.createOscillator(); o4.type='sine'; o4.frequency.value=f*1.5; var g4=envGain(t+0.4,0.01,1.8,0.03); o4.connect(g4); g4.connect(out); o4.start(t+0.4); o4.stop(t+2.5); }
    }
    if(!boss && Math.random()<0.08){ /* a distant water drip */
      var d=c.createOscillator(); d.type='sine'; d.frequency.setValueAtTime(1800+Math.random()*900,t); d.frequency.exponentialRampToValueAtTime(700,t+0.08);
      var dg=envGain(t,0.002,0.12,0.05); d.connect(dg); dg.connect(out); d.start(t); d.stop(t+0.2);
    }
    step++;
    setTimeout(note, boss ? 240 : title ? 520 : 900 + Math.random()*900);
  }
  note();
  return {stop:function(){ alive=false; out.gain.linearRampToValueAtTime(0, c.currentTime+1.5); setTimeout(function(){ drones.forEach(function(o){ try{o.stop();}catch(e){} }); }, 1700); }};
}
