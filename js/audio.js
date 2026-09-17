/* ============================================================================
   audio.js - sound effects and music.
   Every effect first tries audio/<name>.ogg (see art/SOUNDS.md). Until that file
   exists, a small synthesized stand-in plays instead, so nothing is silent.
   ========================================================================== */

var AUDIO = { ctx:null, master:null, sfxBus:null, musicBus:null, verb:null, muted:false, musicOn:true,
              files:{}, missing:{}, music:null, musicKind:null, vol:{sfx:0.8, music:0.45} };
try { var _m=localStorage.getItem('fote-audio'); if(_m){ var o=JSON.parse(_m); AUDIO.muted=!!o.muted; AUDIO.musicOn=o.musicOn!==false; AUDIO.vol=o.vol||AUDIO.vol; } } catch(e){}

function audioInit(){
  if(AUDIO.ctx) { if(AUDIO.ctx.state==='suspended') AUDIO.ctx.resume(); return; }
  var AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
  var c=new AC(); AUDIO.ctx=c;
  AUDIO.master=c.createGain(); AUDIO.master.gain.value=AUDIO.muted?0:1; AUDIO.master.connect(c.destination);
  AUDIO.sfxBus=c.createGain(); AUDIO.sfxBus.gain.value=AUDIO.vol.sfx; AUDIO.sfxBus.connect(AUDIO.master);
  AUDIO.musicBus=c.createGain(); AUDIO.musicBus.gain.value=AUDIO.musicOn?AUDIO.vol.music:0; AUDIO.musicBus.connect(AUDIO.master);
  /* a generated impulse response gives everything a stone-room echo */
  var len=c.sampleRate*1.8, ir=c.createBuffer(2,len,c.sampleRate);
  for(var ch=0;ch<2;ch++){ var d=ir.getChannelData(ch); for(var i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.2); }
  AUDIO.verb=c.createConvolver(); AUDIO.verb.buffer=ir;
  var vg=c.createGain(); vg.gain.value=0.22; AUDIO.verb.connect(vg); vg.connect(AUDIO.master);
  if(AUDIO.pendingMusic) playMusic(AUDIO.pendingMusic);
}
['pointerdown','keydown'].forEach(function(ev){ window.addEventListener(ev, audioInit, {passive:true}); });
function audioSave(){ try{ localStorage.setItem('fote-audio', JSON.stringify({muted:AUDIO.muted, musicOn:AUDIO.musicOn, vol:AUDIO.vol})); }catch(e){} }
function toggleMute(){ AUDIO.muted=!AUDIO.muted; if(AUDIO.master) AUDIO.master.gain.value=AUDIO.muted?0:1; audioSave(); return AUDIO.muted; }
function toggleMusic(){ AUDIO.musicOn=!AUDIO.musicOn; if(AUDIO.musicBus) AUDIO.musicBus.gain.setTargetAtTime(AUDIO.musicOn?AUDIO.vol.music:0, AUDIO.ctx.currentTime, 0.3); audioSave(); return AUDIO.musicOn; }

/* ---- file-backed playback with synth fallback ---- */
function loadFile(name, cb){
  if(AUDIO.files[name]) return cb(AUDIO.files[name]);
  if(AUDIO.missing[name]) return cb(null);
  if(!(window.AUDIO_FILES && window.AUDIO_FILES.indexOf(name)>=0)){ AUDIO.missing[name]=true; return cb(null); }
  fetch('audio/'+name+'.ogg').then(function(r){ if(!r.ok) throw 0; return r.arrayBuffer(); })
    .then(function(b){ return AUDIO.ctx.decodeAudioData(b); })
    .then(function(buf){ AUDIO.files[name]=buf; cb(buf); })
    .catch(function(){ AUDIO.missing[name]=true; cb(null); });
}
var SFX_LAST={};
function sfx(name, opts){
  if(!AUDIO.ctx || AUDIO.muted || !name) return;
  var now=performance.now(); if(SFX_LAST[name] && now-SFX_LAST[name]<40) return; SFX_LAST[name]=now;
  opts=opts||{};
  /* game sounds follow the animation queue: a swing sounds when the swing plays, not when the key was pressed */
  var at = opts.at || (name.indexOf('ui-')!==0 && typeof fxClock==='number' ? Math.max(now, fxClock) : now);
  var delay=Math.max(0, (at-now)/1000);
  loadFile(name, function(buf){
    var c=AUDIO.ctx, t=c.currentTime+delay;
    if(buf){
      var s=c.createBufferSource(); s.buffer=buf; s.playbackRate.value=opts.rate||(0.94+Math.random()*0.12);
      var g=c.createGain(); g.gain.value=opts.vol||1; s.connect(g); g.connect(AUDIO.sfxBus); g.connect(AUDIO.verb); s.start(t);
    } else synth(name, t, opts);
  });
}

/* ---- the synth ---- */
function envGain(t, a, d, peak){ var g=AUDIO.ctx.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(peak||0.5,t+a); g.gain.exponentialRampToValueAtTime(0.0001,t+a+d); return g; }
function tone(t, type, f1, f2, dur, vol, dest){
  var c=AUDIO.ctx, o=c.createOscillator(); o.type=type; o.frequency.setValueAtTime(f1,t); if(f2) o.frequency.exponentialRampToValueAtTime(Math.max(20,f2), t+dur);
  var g=envGain(t, Math.min(0.01,dur*0.2), dur, vol||0.3); o.connect(g); g.connect(dest||AUDIO.sfxBus); g.connect(AUDIO.verb); o.start(t); o.stop(t+dur+0.05);
}
var NOISE=null;
function noise(t, dur, vol, fType, f1, f2, q){
  var c=AUDIO.ctx;
  if(!NOISE){ NOISE=c.createBuffer(1,c.sampleRate*2,c.sampleRate); var d=NOISE.getChannelData(0); for(var i=0;i<d.length;i++) d[i]=Math.random()*2-1; }
  var s=c.createBufferSource(); s.buffer=NOISE; var f=c.createBiquadFilter(); f.type=fType||'lowpass'; f.frequency.setValueAtTime(f1||1200,t);
  if(f2) f.frequency.exponentialRampToValueAtTime(Math.max(30,f2), t+dur); f.Q.value=q||0.8;
  var g=envGain(t, Math.min(0.008,dur*0.15), dur, vol||0.3); s.connect(f); f.connect(g); g.connect(AUDIO.sfxBus); g.connect(AUDIO.verb);
  s.start(t, Math.random()); s.stop(t+dur+0.05);
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
  if(n==='level-up') return arp(t,[523,659,784,1046,1318],0.09,'triangle',0.16);
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
  if(n==='victory') return arp(t,[523,659,784,1046,784,1046,1318,1568],0.14,'triangle',0.16);
  tone(t,'sine',660,0,0.08,0.05);
}

/* ---- music: file first, generative score otherwise ---- */
function playMusic(kind){
  if(!AUDIO.ctx){ AUDIO.pendingMusic=kind; return; }
  if(AUDIO.musicKind===kind) return;
  stopMusic(); AUDIO.musicKind=kind;
  loadFile('music-'+kind, function(buf){
    if(AUDIO.musicKind!==kind) return;
    var c=AUDIO.ctx;
    if(buf){
      var s=c.createBufferSource(); s.buffer=buf; s.loop=true; var g=c.createGain(); g.gain.setValueAtTime(0,c.currentTime); g.gain.linearRampToValueAtTime(1,c.currentTime+2);
      s.connect(g); g.connect(AUDIO.musicBus); s.start(); AUDIO.music={stop:function(){ g.gain.linearRampToValueAtTime(0,c.currentTime+1); s.stop(c.currentTime+1.1); }};
    } else AUDIO.music=generativeMusic(kind);
  });
}
function stopMusic(){ if(AUDIO.music){ try{ AUDIO.music.stop(); }catch(e){} AUDIO.music=null; } AUDIO.musicKind=null; }
function generativeMusic(kind){
  var c=AUDIO.ctx, out=c.createGain(); out.gain.value=0; out.gain.linearRampToValueAtTime(1, c.currentTime+3); out.connect(AUDIO.musicBus);
  var wet=c.createGain(); wet.gain.value=0.6; out.connect(AUDIO.verb);
  var boss = kind==='boss', title = kind==='title', vict = kind==='victory';
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
