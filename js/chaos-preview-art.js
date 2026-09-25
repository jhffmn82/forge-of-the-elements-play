/* Local Chaos sprites use the ordinary image cache and prop placement.
 * Source pixels stay untouched; crop rectangles remove transparent margins. */
(function(root){
  'use strict';
  var definitions={
    'prism-lens':{file:'map-prism-lens.png',sx:126,sy:17,sw:1000,sh:1217},
    'prism-bookcase':{file:'map-prism-bookcase.png',sx:157,sy:54,sw:710,sh:1400},
    'prism-portal':{file:'map-prism-portal.png',sx:47,sy:10,sw:1160,sh:1212},
    'prism-astrolabe':{file:'map-prism-astrolabe.png',sx:47,sy:15,sw:1172,sh:1209},
    'prism-lectern':{file:'map-prism-lectern.png',sx:33,sy:31,sw:1189,sh:1185},
    'prism-tree':{file:'map-prism-tree.png',sx:74,sy:33,sw:1107,sh:1190},
    'rot-portal':{file:'map-rot-portal.png',sx:42,sy:54,sw:1179,sh:1153},
    'rot-canopy':{file:'map-rot-canopy.png',sx:87,sy:54,sw:1101,sh:1152},
    'rot-puffballs':{file:'map-rot-puffballs.png',sx:30,sy:71,sw:1192,sh:1141},
    'rot-pool':{file:'map-rot-pool.png',sx:52,sy:163,sw:1426,sh:708},
    'cinder-portal':{file:'map-cinder-portal.png',sx:39,sy:62,sw:1140,sh:1170},
    'cinder-furnace':{file:'map-cinder-furnace.png',sx:60,sy:80,sw:1134,sh:1088},
    'cinder-anvil':{file:'map-cinder-anvil.png',sx:161,sy:122,sw:1178,sh:810},
    'cinder-shields':{file:'map-cinder-shields.png',sx:34,sy:41,sw:1186,sh:1144},
    'violet-portal':{file:'map-violet-portal.png',sx:51,sy:17,sw:1154,sh:1203},
    'violet-pavilion':{file:'map-violet-pavilion.png',sx:35,sy:16,sw:1184,sh:1227},
    'violet-eggs':{file:'map-violet-eggs.png',sx:67,sy:148,sw:1148,sh:1029},
    'violet-loom':{file:'map-violet-loom.png',sx:25,sy:78,sw:1487,sh:857}
  },pending=Object.create(null),decoded=Object.create(null);
  var themePrefixes={'prism-archives':'prism-','rot-hollows':'rot-','cinder-bastion':'cinder-','violet-warrens':'violet-'};
  var themeGroups={'chaos-mixed':Object.keys(themePrefixes),'unmaker-crucible':['cinder-bastion','prism-archives']};
  // Activate only completed local strips. Each crop is the same union bounds
  // within every cell, so playback never changes a set piece's size or feet.
  // {file:'map-prism-lens-idle.png',cell:192,frames:8,fps:8,sx:0,sy:0,sw:192,sh:192}
  var animations={
  "violet-portal": {"file":"map-violet-portal-idle.png","cell":192,"frames":9,"fps":4,"sx":11,"sy":8,"sw":169,"sh":176},
  "violet-pavilion": {"file":"map-violet-pavilion-idle.png","cell":192,"frames":9,"fps":4.5,"sx":11,"sy":8,"sw":170,"sh":176},
  "violet-eggs": {"file":"map-violet-eggs-idle.png","cell":192,"frames":9,"fps":4.5,"sx":8,"sy":23,"sw":176,"sh":161},
  "violet-loom": {"file":"map-violet-loom-idle.png","cell":192,"frames":9,"fps":5.5,"sx":8,"sy":81,"sw":176,"sh":103},
  "cinder-portal": {"file":"map-cinder-portal-idle.png","cell":192,"frames":9,"fps":5.5,"sx":10,"sy":8,"sw":171,"sh":176},
  "cinder-furnace": {"file":"map-cinder-furnace-idle.png","cell":192,"frames":9,"fps":5.5,"sx":8,"sy":15,"sw":176,"sh":169},
  "cinder-shields": {"file":"map-cinder-shields-idle.png","cell":192,"frames":9,"fps":5.5,"sx":8,"sy":9,"sw":176,"sh":175},
  "rot-puffballs": {"file":"map-rot-puffballs-idle.png","cell":192,"frames":9,"fps":5.5,"sx":8,"sy":15,"sw":176,"sh":169},
  "rot-pool": {"file":"map-rot-pool-idle.png","cell":192,"frames":9,"fps":5.5,"sx":8,"sy":93,"sw":176,"sh":91},
  "prism-portal": {
    "file": "map-prism-portal-idle.png",
    "cell": 192,
    "frames": 9,
    "fps": 5.5,
    "sx": 12,
    "sy": 9,
    "sw": 168,
    "sh": 175
  },
  "prism-lens": {
    "file": "map-prism-lens-idle.png",
    "cell": 192,
    "frames": 9,
    "fps": 5.5,
    "sx": 23,
    "sy": 8,
    "sw": 145,
    "sh": 176
  },
  "prism-astrolabe": {
    "file": "map-prism-astrolabe-idle.png",
    "cell": 192,
    "frames": 9,
    "fps": 5.5,
    "sx": 7,
    "sy": 8,
    "sw": 177,
    "sh": 176
  },
  "prism-lectern": {
    "file": "map-prism-lectern-idle.png",
    "cell": 192,
    "frames": 9,
    "fps": 5.5,
    "sx": 8,
    "sy": 9,
    "sw": 176,
    "sh": 175
  },
  "prism-tree": {
    "file": "map-prism-tree-idle.png",
    "cell": 192,
    "frames": 9,
    "fps": 5.5,
    "sx": 13,
    "sy": 5,
    "sw": 166,
    "sh": 179
  },
  "rot-portal": {
    "file": "map-rot-portal-idle.png",
    "cell": 192,
    "frames": 9,
    "fps": 5.5,
    "sx": 8,
    "sy": 12,
    "sw": 176,
    "sh": 172
  },
  "rot-canopy": {
    "file": "map-rot-canopy-idle.png",
    "cell": 192,
    "frames": 9,
    "fps": 5.5,
    "sx": 12,
    "sy": 7,
    "sw": 169,
    "sh": 177
  }
};
  var animationLoads=Object.create(null);
  function activeTheme(){return typeof floorMeta!=='undefined'&&floorMeta&&floorMeta.chaosPreview&&floorMeta.chaosPreview.biome;}
  function themeKey(theme){return theme||activeTheme()||'prism-archives';}
  function belongs(name,theme){if(themeGroups[theme])return themeGroups[theme].some(function(key){return belongs(name,key);});var prefix=themePrefixes[theme];return typeof name==='string'&&!!prefix&&name.indexOf(prefix)===0;}
  function ready(theme){theme=themeKey(theme);return themeGroups[theme]?themeGroups[theme].every(function(key){return !!decoded[key];}):!!decoded[theme];}
  function imageReady(file){
    // Failed loads can be retried without poisoning the shared atlas cache.
    if(ATL[file]&&ATL[file].complete&&!ATL[file].naturalWidth)delete ATL[file];
    atl(file);var img=ATL[file];
    return new Promise(function(resolve,reject){
      function clean(){img.removeEventListener('load',loaded);img.removeEventListener('error',failed);}
      function failed(){clean();if(ATL[file]===img)delete ATL[file];reject(new Error('Could not load Chaos preview artwork: '+file));}
      function loaded(){
        clean();if(!img.naturalWidth){failed();return;}
        Promise.resolve(typeof img.decode==='function'?img.decode():undefined).then(resolve,failed);
      }
      if(img.complete){if(img.naturalWidth)loaded();else failed();}
      else{img.addEventListener('load',loaded);img.addEventListener('error',failed);}
    });
  }
  function ensureAssets(theme){
    theme=themeKey(theme);
    if(themeGroups[theme])return Promise.all(themeGroups[theme].map(ensureAssets));
    if(!themePrefixes[theme])return Promise.reject(new Error('Unknown Chaos preview theme.'));
    if(pending[theme])return pending[theme];
    var required=Object.keys(definitions).filter(function(name){return belongs(name,theme);}).map(function(name){return imageReady(definitions[name].file);});
    var optional=Object.keys(animations).filter(function(name){return belongs(name,theme);}).map(loadAnimation);
    pending[theme]=Promise.all(required.concat(optional)).then(function(){decoded[theme]=true;},function(error){delete pending[theme];decoded[theme]=false;throw error;});
    return pending[theme];
  }
  function lookup(group,name){
    if(group!=='props'||!belongs(name,activeTheme()))return null;
    if(!Object.prototype.hasOwnProperty.call(definitions,name))return null;
    var definition=definitions[name];
    var img=atl(definition.file);if(!img)return null;
    return {img:img,sx:definition.sx,sy:definition.sy,sw:definition.sw,sh:definition.sh,nm:name};
  }
  function validAnimation(spec){
    return spec&&typeof spec.file==='string'&&Number.isInteger(spec.cell)&&spec.cell>0&&Number.isInteger(spec.frames)&&spec.frames>0&&
      Number.isFinite(spec.fps)&&spec.fps>0&&Number.isInteger(spec.sx)&&spec.sx>=0&&Number.isInteger(spec.sy)&&spec.sy>=0&&
      Number.isInteger(spec.sw)&&spec.sw>0&&Number.isInteger(spec.sh)&&spec.sh>0&&spec.sx+spec.sw<=spec.cell&&spec.sy+spec.sh<=spec.cell;
  }
  function loadAnimation(name){
    if(animationLoads[name])return animationLoads[name].promise;
    var spec=animations[name],entry={img:null,promise:null};animationLoads[name]=entry;
    // An optional failure keeps the original artwork and is remembered, rather
    // than retrying a missing strip on every shared animation frame.
    entry.promise=validAnimation(spec)?imageReady(spec.file).then(function(){
      var img=ATL[spec.file];
      if(img&&img.naturalWidth>=spec.cell*spec.frames&&img.naturalHeight>=spec.cell)entry.img=img;
    },function(){}):Promise.resolve();
    return entry.promise;
  }
  function visibleSet(p,alpha){
    if(Number.isFinite(alpha)&&alpha<1)return false;
    if(typeof revealAll!=='undefined'&&revealAll)return true;
    if(typeof vis==='undefined'||typeof inb!=='function'||typeof idxOf!=='function')return false;
    for(var y=p.y;y<p.y+(p.h||1);y++)for(var x=p.x;x<p.x+(p.w||1);x++)if(inb(x,y)&&vis[idxOf(x,y)])return true;
    return false;
  }
  function artForSet(p,alpha,now){
    if(!p)return null;
    var name=p.artName||p.name;
    if(!belongs(name,activeTheme()))return null;
    if(!Object.prototype.hasOwnProperty.call(animations,name))return null;
    loadAnimation(name);
    var spec=animations[name],img=animationLoads[name].img;
    if(!img)return lookup('props',name);
    if(!Number.isFinite(now))now=typeof performance!=='undefined'?performance.now():0;
    // Remember the same artwork and union crop, held on its first frame.
    // Returning the original differently shaped crop here would resize the
    // piece whenever it crosses the fog boundary.
    var still=!visibleSet(p,alpha)||(typeof ANIM!=='undefined'&&ANIM.reduce);
    var frame=still?0:Math.floor(Math.max(0,now)*spec.fps/1000)%spec.frames;
    return {img:img,sx:frame*spec.cell+spec.sx,sy:spec.sy,sw:spec.sw,sh:spec.sh,nm:name};
  }
  root.FoteChaosPreviewArt=Object.freeze({ready:ready,ensureAssets:ensureAssets,lookup:lookup,artForSet:artForSet});
})(typeof window!=='undefined'?window:globalThis);
