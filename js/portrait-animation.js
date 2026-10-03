/* Approved portrait frames only. This presentation controller never writes actor
   state; paper dolls and the game's world-sprite animation keep their owners. */
(function(root){
  'use strict';
  var lookPattern=/^(human|elf|dwarf|gloomling|fae-(air|fire|water|earth))-[fm]$/;
  function validFrameDelays(clip){return Array.isArray(clip.frame_delays)&&clip.frame_delays.length===clip.frame_count&&clip.frame_delays.every(function(delay){return Number.isFinite(delay)&&delay>0;});}
  function validClip(clip){return !!clip&&Number.isInteger(clip.frame_count)&&clip.frame_count>0&&(validFrameDelays(clip)||Number.isFinite(clip.delay)&&clip.delay>0);}
  function clipTiming(clip){
    if(!validClip(clip))return null;
    var delays=validFrameDelays(clip)?clip.frame_delays:Array(clip.frame_count).fill(clip.delay),duration=0;
    return {ends:delays.map(function(delay){duration+=delay;return duration;}),duration:duration};
  }
  function clipDuration(clip){var timing=clipTiming(clip);return timing?timing.duration:0;}
  function createTimeline(entry,start){
    var clips=entry.clips,quiet=clipTiming(clips.quiet),turn=clipTiming(clips.turn),hurt=clipTiming(clips.hurt);
    if(!quiet)throw new Error('Portrait needs a timed quiet clip');
    var quietDuration=quiet.duration,cycle=quietDuration*2+(turn?turn.duration:0),idleStart=start,hurtStart=null;
    function frame(phase,timing,elapsed){
      var index=0;while(index<timing.ends.length-1&&elapsed>=timing.ends[index])index++;
      return {phase:phase,frame:index,nextIn:Math.max(1,timing.ends[index]-elapsed)};
    }
    return {
      hurt:function(now){if(hurt)hurtStart=now;},
      sample:function(now){
        if(hurtStart!==null){
          var hurtElapsed=Math.max(0,now-hurtStart),duration=hurt.duration;
          if(hurtElapsed<duration)return frame('hurt',hurt,hurtElapsed);
          idleStart=hurtStart+duration;hurtStart=null;
        }
        var elapsed=Math.max(0,now-idleStart)%cycle;
        if(elapsed<quietDuration*2)return frame('quiet',quiet,elapsed%quietDuration);
        return frame('turn',turn,elapsed-quietDuration*2);
      }
    };
  }
  function createController(ports){
    var actor=null,look='',host=null,lastHp=null,fallbackHp=null,assets=null,timeline=null,timer=null,version=0,paused=true,lastFrame='',seen=new Set(),damageBus=null,unsubscribe=null;
    function cancel(){if(timer!==null){ports.clearTimeout(timer);timer=null;}}
    function subscribe(){
      var bus=ports.damageBus&&ports.damageBus();
      if(bus===damageBus)return;
      if(unsubscribe)unsubscribe();damageBus=bus;unsubscribe=bus&&bus.on('damageApplied',damage);
    }
    function render(){
      cancel();
      if(!host||!actor)return;
      var stop=!!ports.reduced()||!!ports.hidden();
      if(stop||!assets){paused=true;lastFrame='';ports.still(host,look);return;}
      var now=ports.now();
      if(paused||!timeline){timeline=createTimeline(assets.entry,now);paused=false;lastFrame='';}
      var sample=timeline.sample(now),key=sample.phase+':'+sample.frame;
      if(key!==lastFrame){ports.draw(host,assets,sample);lastFrame=key;}
      else if(ports.attach)ports.attach(host,assets);
      timer=ports.setTimeout(render,sample.nextIn);
    }
    function flinch(){
      if(!timeline||paused||ports.reduced()||ports.hidden())return;
      timeline.hurt(ports.now());lastFrame='';render();
    }
    function damage(event){
      if(!event||event.target!==actor||!(event.damage>0))return;
      var key=event.id===undefined?event:event.id;
      if(seen.has(key))return;
      seen.add(key);if(seen.size>64)seen.delete(seen.values().next().value);
      // commitDamage can refresh the HUD before damageApplied is emitted. Consume
      // the HP fallback for that same committed hit instead of starting it twice.
      var hp=Number.isFinite(actor.hp)?actor.hp:null,alreadyShown=fallbackHp!==null&&fallbackHp===hp;
      fallbackHp=null;lastHp=hp;if(!alreadyShown)flinch();
    }
    function paint(nextHost,nextActor){
      if(!nextHost||!nextActor||!lookPattern.test(String(nextActor.look||'')))return;
      subscribe();host=nextHost;
      var nextLook=String(nextActor.look);
      if(nextActor!==actor||nextLook!==look){
        cancel();actor=nextActor;look=nextLook;lastHp=Number.isFinite(actor.hp)?actor.hp:null;fallbackHp=null;seen.clear();assets=null;timeline=null;paused=true;lastFrame='';
        var ticket=++version;
        ports.still(host,look);
        Promise.resolve().then(function(){return ports.load(nextLook);}).then(function(loaded){
          if(ticket!==version)return;
          assets=loaded;render();
        }).catch(function(){if(ticket===version){assets=null;render();}});
      }else{
        var hp=Number.isFinite(actor.hp)?actor.hp:null;
        if(hp!==lastHp){
          var lowered=hp!==null&&lastHp!==null&&hp<lastHp;lastHp=hp;fallbackHp=null;
          if(lowered){fallbackHp=hp;flinch();}
        }
      }
      render();
    }
    return {
      paint:paint,damage:damage,
      refresh:function(){if(host&&actor)paint(host,actor);},
      dispose:function(){cancel();version++;if(unsubscribe)unsubscribe();unsubscribe=null;damageBus=null;actor=null;host=null;assets=null;timeline=null;},
      state:function(){return timeline&&!paused?timeline.sample(ports.now()):null;}
    };
  }
  var browserController=null;
  function browserPorts(){
    var manifestUrl=new URL('art/portraits/animations/manifest.json',document.baseURI),manifest=null,loaded=new Map(),stills=new Map();
    function getManifest(){
      if(!manifest)manifest=fetch(manifestUrl.href).then(function(response){if(!response.ok)throw new Error('Portrait manifest unavailable');return response.json();}).then(function(entries){if(!Array.isArray(entries))throw new Error('Invalid portrait manifest');return entries;});
      return manifest;
    }
    function loadImage(url){return new Promise(function(resolve,reject){var image=new Image();image.onload=function(){resolve(image);};image.onerror=function(){reject(new Error('Portrait sheet unavailable'));};image.src=url;});}
    function attach(host,assets){if(host.firstChild!==assets.canvas||host.childNodes.length!==1)host.replaceChildren(assets.canvas);}
    return {
      now:function(){return performance.now();},setTimeout:function(fn,delay){return setTimeout(fn,delay);},clearTimeout:function(id){clearTimeout(id);},
      reduced:function(){return typeof ANIM!=='undefined'?ANIM.reduce:!!(root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches);},
      hidden:function(){return document.hidden;},damageBus:function(){return typeof gameDamage!=='undefined'?gameDamage:null;},
      still:function(host,look){
        var image=stills.get(look);
        if(!image){image=new Image();image.src='art/portraits/'+look+'.webp';image.alt='';image.setAttribute('aria-hidden','true');image.style.cssText='width:100%;height:100%;object-fit:contain;image-rendering:pixelated';stills.set(look,image);}
        if(host.firstChild!==image||host.childNodes.length!==1)host.replaceChildren(image);
      },
      load:function(look){
        if(!loaded.has(look))loaded.set(look,getManifest().then(function(entries){
          var entry=entries.find(function(item){return item.id===look;});
          if(!entry||!Number.isInteger(entry.width)||entry.width<1||!Number.isInteger(entry.height)||entry.height<1||!entry.clips||!validClip(entry.clips.quiet))throw new Error('Missing portrait animation');
          var sheets={};
          return Promise.all(['quiet','turn','hurt'].map(function(phase){
            var clip=entry.clips[phase];if(!validClip(clip)||typeof clip.sheet!=='string')throw new Error('Missing portrait clip');
            return loadImage(new URL(clip.sheet,manifestUrl).href).then(function(image){
              if(image.naturalWidth!==entry.width||image.naturalHeight!==entry.height*clip.frame_count)throw new Error('Invalid portrait sheet dimensions');sheets[phase]=image;
            });
          })).then(function(){
            var canvas=document.createElement('canvas');canvas.width=entry.width;canvas.height=entry.height;canvas.setAttribute('aria-hidden','true');canvas.style.cssText='width:100%;height:100%;object-fit:contain;image-rendering:pixelated';
            var context=canvas.getContext('2d');if(!context)throw new Error('Portrait canvas unavailable');context.imageSmoothingEnabled=false;
            return {entry:entry,sheets:sheets,canvas:canvas,context:context};
          });
        }));
        return loaded.get(look);
      },attach:attach,
      draw:function(host,assets,sample){
        var entry=assets.entry,context=assets.context;
        context.clearRect(0,0,entry.width,entry.height);context.drawImage(assets.sheets[sample.phase],0,sample.frame*entry.height,entry.width,entry.height,0,0,entry.width,entry.height);
        assets.canvas.dataset.look=entry.id;assets.canvas.dataset.phase=sample.phase;assets.canvas.dataset.frame=String(sample.frame);attach(host,assets);
      }
    };
  }
  var api={clipDuration:clipDuration,createTimeline:createTimeline,createController:createController,paint:function(host,actor){
    if(!browserController){browserController=createController(browserPorts());document.addEventListener('visibilitychange',function(){browserController.refresh();});}
    browserController.paint(host,actor);
  }};
  root.FotePortraitAnimation=Object.freeze(api);if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
