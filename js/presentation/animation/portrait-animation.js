/* Approved portrait frames only. This presentation controller never writes actor
   state; paper dolls and the game's world-sprite animation keep their owners. */
(function(root){
  'use strict';
  var supportedLooks=new Set(['human','elf','dwarf','gloomling','fae-air','fae-fire','fae-water','fae-earth'].flatMap(function(base){return [base+'-f',base+'-m'];}));
  var approvedLooks=['human','elf','dwarf','gloomling','fae-air','fae-fire','fae-water','fae-earth'].reduce(function(looks,base){return looks.concat([base+'-f',base+'-m']);},[]);
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
    var actor=null,look='',host=null,lastHp=null,fallbackHp=null,assets=null,timeline=null,timer=null,version=0,paused=true,lastFrame='',seen=new Set(),damageBus=null,unsubscribe=null,loading=null,loadError=null,retryAt=0;
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
    function loadCurrent(){
      if(loading&&loading.version===version)return loading.promise;
      var ticket=version,nextLook=look,request={version:ticket,promise:null};loading=request;
      request.promise=Promise.resolve().then(function(){return ports.load(nextLook);}).then(function(loaded){
        if(ticket!==version)return;
        assets=loaded;loadError=null;retryAt=0;render();
      }).catch(function(error){if(ticket===version){assets=null;loadError=error;retryAt=ports.now()+5000;render();}}).then(function(){if(loading===request)loading=null;});
      return request.promise;
    }
    function retry(){
      if(!host||!actor)return Promise.resolve();
      if(ports.retryStill)ports.retryStill(look);
      if(assets){render();return Promise.resolve();}
      return loadCurrent();
    }
    function paint(nextHost,nextActor){
      if(!nextHost||!nextActor||!supportedLooks.has(String(nextActor.look||'')))return;
      subscribe();host=nextHost;
      var nextLook=String(nextActor.look);
      if(nextActor!==actor||nextLook!==look){
        cancel();actor=nextActor;look=nextLook;lastHp=Number.isFinite(actor.hp)?actor.hp:null;fallbackHp=null;seen.clear();assets=null;timeline=null;paused=true;lastFrame='';
        version++;loading=null;loadError=null;retryAt=0;
        ports.still(host,look);
        loadCurrent();
      }else{
        if(loadError&&ports.now()>=retryAt)loadCurrent();
        var hp=Number.isFinite(actor.hp)?actor.hp:null;
        if(hp!==lastHp){
          var lowered=hp!==null&&lastHp!==null&&hp<lastHp;lastHp=hp;fallbackHp=null;
          if(lowered){fallbackHp=hp;flinch();}
        }
      }
      render();
    }
    return {
      paint:paint,damage:damage,retry:retry,error:function(){return loadError;},
      refresh:function(){if(host&&actor)paint(host,actor);},
      dispose:function(){cancel();version++;loading=null;if(unsubscribe)unsubscribe();unsubscribe=null;damageBus=null;actor=null;host=null;assets=null;timeline=null;},
      state:function(){return timeline&&!paused?timeline.sample(ports.now()):null;}
    };
  }
  var browserController=null,browserAssetPorts=null;
  function browserPorts(){
    var manifestUrl=new URL('art/portraits/animations/manifest.json',document.baseURI),manifest=null,loaded=new Map(),images=new Map();
    function validateManifest(entries){
      if(!Array.isArray(entries))throw new Error('Portrait manifest is invalid');
      var ids=new Set();
      entries.forEach(function(entry){
        if(!entry||!supportedLooks.has(entry.id)||ids.has(entry.id))throw new Error('Portrait manifest has an invalid or duplicate look: '+(entry&&entry.id));
        ids.add(entry.id);
        if(!Number.isInteger(entry.width)||entry.width<1||!Number.isInteger(entry.height)||entry.height<1||typeof entry.portrait!=='string'||!entry.portrait)
          throw new Error('Portrait '+entry.id+' has invalid dimensions or still artwork');
        ['quiet','turn','hurt'].forEach(function(phase){
          var clip=entry.clips&&entry.clips[phase];
          if(!validClip(clip)||typeof clip.sheet!=='string'||!clip.sheet)throw new Error('Portrait '+entry.id+' '+phase+' clip is missing or invalid');
        });
      });
      approvedLooks.forEach(function(look){if(!ids.has(look))throw new Error('Portrait manifest is missing approved look '+look);});
      return entries;
    }
    function deadline(promise,ms,label,cancel){
      return new Promise(function(resolve,reject){
        var settled=false,timer=setTimeout(function(){if(settled)return;settled=true;if(cancel)cancel();reject(new Error(label+' timed out'));},ms);
        Promise.resolve(promise).then(function(value){if(settled)return;settled=true;clearTimeout(timer);resolve(value);},function(error){if(settled)return;settled=true;clearTimeout(timer);reject(error);});
      });
    }
    function getManifest(){
      if(!manifest){
        var controller=typeof AbortController==='function'?new AbortController():null;
        var fetchManifest=Promise.resolve().then(function(){return fetch(manifestUrl.href,controller?{signal:controller.signal}:undefined);}).then(function(response){if(!response.ok)throw new Error('Portrait manifest could not load (HTTP '+response.status+')');return response.json();}).then(validateManifest).catch(function(error){
          if(error&&/^Portrait /.test(error.message))throw error;
          throw new Error('Portrait manifest could not load: '+(error&&error.message||error));
        });
        var request=deadline(fetchManifest,15000,'Portrait manifest',function(){if(controller)controller.abort();});
        manifest=request;
        request.catch(function(){if(manifest===request)manifest=null;});
      }
      return manifest;
    }
    /* Rendering may show a pending still, but only an explicit load/preparation
       request replaces a failed record. Successful image decodes stay shared. */
    function imageRecord(url,label,retryFailed){
      var prior=images.get(url);if(prior&&(!prior.failed||!retryFailed))return prior;
      var image=new Image(),record={image:image,failed:false,promise:null};images.set(url,record);
      var arrival=new Promise(function(resolve,reject){image.onload=function(){resolve(image);};image.onerror=function(){reject(new Error(label+' could not load'));};image.src=url;});
      record.promise=deadline(arrival,15000,label+' load',function(){image.onload=image.onerror=null;image.src='';}).then(function(){
        image.onload=image.onerror=null;
        return deadline(Promise.resolve().then(function(){if(typeof image.decode==='function')return image.decode();}),10000,label+' decode').catch(function(error){throw new Error(label+' could not decode: '+String(error&&error.message||error));});
      }).then(function(){return image;});
      record.promise.catch(function(){record.failed=true;image.onload=image.onerror=null;});
      return record;
    }
    function stillImage(look,retryFailed){
      var record=imageRecord(new URL('../'+look+'.webp',manifestUrl).href,'Portrait '+look+' still',retryFailed),image=record.image;
      image.alt='';image.setAttribute('aria-hidden','true');image.style.cssText='width:100%;height:100%;object-fit:contain;image-rendering:pixelated';
      return record;
    }
    function load(look){
      if(!loaded.has(look)){
        var request=getManifest().then(function(entries){
          var entry=entries.find(function(item){return item.id===look;});if(!entry)throw new Error('Missing approved portrait '+look);
          var sheets={},still=stillImage(look,true);
          function dimensions(record,width,height,label){
            return record.promise.then(function(image){
              if(image.naturalWidth!==width||image.naturalHeight!==height){record.failed=true;throw new Error(label+' has invalid dimensions: '+image.naturalWidth+'x'+image.naturalHeight);}
              return image;
            });
          }
          return Promise.all([dimensions(still,entry.width,entry.height,'Portrait '+look+' still')].concat(['quiet','turn','hurt'].map(function(phase){
            var clip=entry.clips[phase],label='Portrait '+look+' '+phase+' sheet';
            return dimensions(imageRecord(new URL(clip.sheet,manifestUrl).href,label,true),entry.width,entry.height*clip.frame_count,label).then(function(image){
              sheets[phase]=image;
            });
          }))).then(function(){
            var canvas=document.createElement('canvas');canvas.width=entry.width;canvas.height=entry.height;canvas.setAttribute('aria-hidden','true');canvas.style.cssText='width:100%;height:100%;object-fit:contain;image-rendering:pixelated';
            var context=canvas.getContext('2d');if(!context)throw new Error('Portrait '+look+' canvas unavailable');context.imageSmoothingEnabled=false;
            return {entry:entry,sheets:sheets,canvas:canvas,context:context};
          });
        });
        loaded.set(look,request);request.catch(function(){if(loaded.get(look)===request)loaded.delete(look);});
      }
      return loaded.get(look);
    }
    function attach(host,assets){if(host.firstChild!==assets.canvas||host.childNodes.length!==1)host.replaceChildren(assets.canvas);}
    return {
      now:function(){return performance.now();},setTimeout:function(fn,delay){return setTimeout(fn,delay);},clearTimeout:function(id){clearTimeout(id);},
      reduced:function(){return typeof ANIM!=='undefined'?ANIM.reduce:!!(root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches);},
      hidden:function(){
        var title=document.getElementById&&document.getElementById('title'),create=document.getElementById&&document.getElementById('create');
        return document.hidden||!!(title&&title.classList.contains('on'))||!!(create&&create.classList.contains('on'));
      },damageBus:function(){return typeof gameDamage!=='undefined'?gameDamage:null;},
      still:function(host,look){
        var image=stillImage(look,false).image;
        if(host.firstChild!==image||host.childNodes.length!==1)host.replaceChildren(image);
      },
      retryStill:function(look){stillImage(look,true);},
      load:load,ensureAssets:function(look){
        if(!supportedLooks.has(String(look||'')))return Promise.reject(new Error('An approved current portrait look is required'));
        return load(look);
      },attach:attach,
      draw:function(host,assets,sample){
        var entry=assets.entry,context=assets.context;
        context.clearRect(0,0,entry.width,entry.height);context.drawImage(assets.sheets[sample.phase],0,sample.frame*entry.height,entry.width,entry.height,0,0,entry.width,entry.height);
        assets.canvas.dataset.look=entry.id;assets.canvas.dataset.phase=sample.phase;assets.canvas.dataset.frame=String(sample.frame);attach(host,assets);
      }
    };
  }
  function sharedBrowserPorts(){if(!browserAssetPorts)browserAssetPorts=browserPorts();return browserAssetPorts;}
  var api={clipDuration:clipDuration,createTimeline:createTimeline,createController:createController,
  ensureAssets:function(look){return sharedBrowserPorts().ensureAssets(look).then(function(){if(browserController)return browserController.retry();});},
  retry:function(look){
    if(look)return sharedBrowserPorts().ensureAssets(look).then(function(){if(browserController)return browserController.retry();});
    return browserController?browserController.retry():Promise.resolve();
  },error:function(){return browserController&&browserController.error();},refresh:function(){if(browserController)browserController.refresh();},paint:function(host,actor){
    if(!browserController){browserController=createController(sharedBrowserPorts());document.addEventListener('visibilitychange',function(){browserController.refresh();if(!document.hidden)browserController.retry();});root.addEventListener&&root.addEventListener('online',function(){browserController.retry();});}
    browserController.paint(host,actor);
  }};
  root.FotePortraitAnimation=Object.freeze(api);if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
