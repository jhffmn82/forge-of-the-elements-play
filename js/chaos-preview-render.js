/* Local Chaos previews use the normal scene, terrain, props, fog and actor renderer.
 * These optional material/decor passes own no camera, simulation or RAF loop. */
(function(root){
  'use strict';
  var R=32,rotMaterial=null,violetMaterial=null,cache=null,surfaces=new Map(),builds=0,objectSources=new WeakMap(),objectCanvases=new WeakSet(),objectBuilds=0;
  var cellData=null,regionCache=new WeakMap();
  function rawData(){var d=typeof floorMeta!=='undefined'&&floorMeta&&floorMeta.chaosPreview&&/^(prism-archives|rot-hollows|cinder-bastion|violet-warrens|chaos-mixed|unmaker-crucible)$/.test(floorMeta.chaosPreview.biome)?floorMeta.chaosPreview:null;if(!d)cache=null;return d;}
  function data(){return cellData||rawData();}
  function composite(d){return !!(d&&(d.biome==='chaos-mixed'||d.biome==='unmaker-crucible'));}
  function mixed(){return composite(rawData());}
  function regionData(d){
    var entry=regionCache.get(d);if(entry&&entry.props===props)return entry.regions;
    var regions=d.regions.map(function(region){
      var view=Object.assign({},d,{biome:region.biome,regionId:region.id,landMask:new Uint8Array(MW*MH),bounds:{x:MW,y:MH,w:0,h:0}}),maxX=0,maxY=0;
      for(var i=0;i<d.landMask.length;i++)if(d.landMask[i]&&d.regionByCell[i]===region.id){var x=i%MW,y=Math.floor(i/MW);view.landMask[i]=1;view.bounds.x=Math.min(view.bounds.x,x);view.bounds.y=Math.min(view.bounds.y,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
      view.bounds.w=maxX-view.bounds.x+1;view.bounds.h=maxY-view.bounds.y+1;
      ['portals','focals','decor','cosmeticPools','tendrils','chains','filaments'].forEach(function(key){view[key]=(d[key]||[]).filter(function(p){return p.regionId===region.id||!p.regionId&&d.regionByCell[p.y*MW+p.x]===region.id;});});
      view.props=props.filter(function(p){return p.regionId===region.id||!p.regionId&&d.regionByCell[p.y*MW+p.x]===region.id;});return view;
    });
    regionCache.set(d,{props:props,regions:regions});return regions;
  }
  function dataAt(x,y){
    var d=data();if(!composite(d))return d;
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=MW||y>=MH)return null;
    var id=d.regionByCell[Math.floor(y)*MW+Math.floor(x)];return regionData(d).find(function(region){return region.regionId===id;})||null;
  }
  function themeAt(x,y){var d=dataAt(x,y);return d&&d.biome;}
  // A synchronous draw scope carries the prop's location through legacy art
  // helpers without changing the map, player, plane, camera or simulation.
  function withCell(x,y,draw){if(!mixed())return draw();var keep=cellData;cellData=dataAt(x,y);try{return draw();}finally{cellData=keep;}}
  function themedProps(d){return d.props||props;}
  function rot(d){return !!(d&&d.biome==='rot-hollows');}
  function cinder(d){return !!(d&&d.biome==='cinder-bastion');}
  function violet(d){return !!(d&&d.biome==='violet-warrens');}
  function terrainMaterial(x,y){
    var d=dataAt(x,y);if(violet(d))return violetTerrainMaterial();
    if(!rot(d)||typeof PT_MAT==='undefined'||!PT_MAT.cavern)return null;
    /* The ordinary Caverns raster owns contours, collision edges and caches.
     * Only this preview opts into porous warm rock and moss metadata. */
    if(!rotMaterial)rotMaterial=Object.assign({},PT_MAT.cavern,{
      floor:[159,137,99],floorLav:[128,103,67],jointCol:[86,65,40],joint:.3,grain:.03,occ:[74,58,34],
      mineralCool:[139,137,91],pearl:[197,176,128],band:[173,151,105],
      top:[217,198,155],topHi:[253,239,203],topLo:[158,135,94],topLav:[193,177,129],edge:[95,77,48],
      face:[214,186,134],faceLo:[130,105,67],faceH:.8,lip:[255,238,189],void:[116,98,66],voidEdge:[139,115,76],
      vein:[108,150,44],veinHot:[208,233,104],veinDark:[65,85,33],
      inlay:[158,132,82],inlayJoint:[91,72,46],polish:[190,168,115],
      pool:[33,103,76],poolEdge:[87,180,114],poolShallow:[148,210,91],poolRim:[214,238,140],
      poolShelf:[129,111,73],poolShelfDry:[158,135,86],poolWet:[84,87,51],poolLight:'#82EACB',
      moss:[[75,122,39],[112,151,59],[44,76,28],[145,170,81]],
      rockHi:'#F3DFB4',rockMid:'#C7AF7B',rockLo:'#947D53',rockEdge:'#5B482D',
      fill:'#E0D2A8',motif:'none',jag:.65,organicRock:true,faceCrystals:false,sourceLightsOnly:true
    });
    return rotMaterial;
  }
  function violetTerrainMaterial(){
    if(typeof PT_MAT==='undefined'||!PT_MAT.cavern)return null;
    // The shared Caverns raster keeps its collision contours and tile cache.
    // This material is a separate immutable choice from Rot's warm limestone.
    if(!violetMaterial)violetMaterial=Object.assign({},PT_MAT.cavern,{
      floor:[165,143,185],floorLav:[134,111,164],jointCol:[105,84,126],joint:.27,grain:.02,occ:[78,61,99],
      mineralCool:[142,132,174],pearl:[217,199,231],band:[182,158,198],
      top:[171,148,192],topHi:[231,216,244],topLo:[104,80,133],topLav:[184,164,212],edge:[77,57,103],
      face:[177,144,198],faceLo:[89,65,120],faceH:.8,lip:[239,226,247],void:[97,76,129],voidEdge:[124,98,148],
      vein:[181,144,213],veinHot:[241,222,254],veinDark:[89,64,119],
      inlay:[184,163,206],inlayJoint:[105,86,128],polish:[219,200,232],
      pool:[69,69,133],poolEdge:[136,144,207],poolShallow:[152,142,209],poolRim:[235,220,251],
      poolShelf:[139,120,164],poolShelfDry:[168,145,190],poolWet:[106,86,143],poolLight:'#D6C6FF',
      crystal:['#F6E8FF','#D7B2EF','#A679CE','#A8C8F2'],crystalGold:'#D7D4EA',crystalLight:'#E2BCFF',
      moss:[[105,74,137],[162,117,182],[68,53,96],[203,162,218]],
      rockHi:'#E7D9F2',rockMid:'#BCA0D0',rockLo:'#8B6BAA',rockEdge:'#4D386B',
      fill:'#E0D2F0',motif:'none',jag:.35,organicRock:true,faceCrystals:false,sourceLightsOnly:true
    });
    return violetMaterial;
  }
  function noise(x,y,s){var n=Math.imul(x+31,374761393)^Math.imul(y+17,668265263)^(s||0);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
  function polygon(g,points,fill){g.fillStyle=fill;g.beginPath();points.forEach(function(p,i){if(i)g.lineTo(p[0],p[1]);else g.moveTo(p[0],p[1]);});g.closePath();g.fill();}
  function surface(name,x,y){
    var d=dataAt(x,y);if(!d||rot(d)||violet(d)||!AS.surface||!AS.surface['light-'+name])return null;
    var img=atl('surface-light-'+name+'.png');if(!img||!img.complete||!img.naturalWidth)return null;
    var key=d.biome+':'+name,entry=surfaces.get(key);if(entry&&entry.source===img)return entry.canvas;
    var c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;var g=c.getContext('2d');g.drawImage(img,0,0);
    /* A palette map changes the material, rather than darkening yellow stone
     * with a transparent blue wash. Original joints, bevels and alpha remain. */
    var image=g.getImageData(0,0,c.width,c.height),pixels=image.data;
    for(var i=0;i<pixels.length;i+=4){
      if(!pixels[i+3])continue;
      var red=pixels[i],green=pixels[i+1],blue=pixels[i+2],lum=.24*red+.65*green+.11*blue;
      if(cinder(d)){
        var piece=Math.floor((i/4%c.width)/64),lo,hi,t=Math.pow(Math.max(0,Math.min(1,(lum-28)/212)),.86);
        if(name==='deco'&&piece===9)continue; // Preserve the ordinary orange sconce.
        if(name==='deco'&&(piece===10||piece===11)){lo=[68,20,25];hi=[191,62,45];}
        else if(name.indexOf('rim')===0||name==='deco'&&piece===12){lo=[76,51,37];hi=[226,180,111];}
        else if(name==='floor'){lo=[111,77,62];hi=[233,202,164];}
        else if(name==='top'){lo=[51,45,47];hi=[162,144,130];}
        else if(name==='face'){lo=[57,43,44];hi=[179,134,112];}
        else {lo=[56,47,45];hi=[176,147,112];}
        for(var channel=0;channel<3;channel++)pixels[i+channel]=Math.round(lo[channel]+(hi[channel]-lo[channel])*t);
        continue;
      }
      var tile=Math.floor((i/4%c.width)/64),kind=name==='deco'?(tile===12?'gold':tile===9?'original':tile>=10?'banner':'porcelain'):name.indexOf('rim')===0?'gold':name==='floor'?'porcelain':'cobalt';
      if(kind==='original')continue;
      var vein=kind==='porcelain'&&name==='floor'&&red-green>11&&green-blue>29&&green>blue*1.4;
      var lo,hi,t;
      if(kind==='gold'||vein){lo=[113,75,28];hi=[255,224,139];t=Math.max(0,Math.min(1,(lum-65)/175));}
      else if(kind==='porcelain'){lo=[142,163,190];hi=[246,250,255];t=Math.max(0,Math.min(1,(lum-100)/137));}
      else {lo=[13,36,77];hi=name==='top'?[48,116,179]:[55,132,182];t=Math.pow(Math.max(0,Math.min(1,(lum-40)/190)),.8);}
      for(var channel=0;channel<3;channel++)pixels[i+channel]=Math.round(lo[channel]+(hi[channel]-lo[channel])*t);
    }
    g.putImageData(image,0,0);
    surfaces.set(key,{source:img,canvas:c});return c;
  }
  var SUPPORTS={'grave-pillar':'pillar',statue:'statue','statue-broken':'statue','table-candle':'table','portal-arch':'arch',archway:'arch',
    'door-wood':'door','door-wood-side':'door','door-wood-open':'door','door-iron':'door','door-iron-side':'door'};
  function objectArt(art,group,name){
    var d=data();if(rot(d))return rotObjectArt(art,group,name);if(cinder(d))return cinderObjectArt(art,group,name);if(violet(d))return violetObjectArt(art,group,name);
    var kind=SUPPORTS[name];
    if(!d||composite(d)||!kind||!art||!art.img||objectCanvases.has(art.img))return art;
    var img=art.img;if(img.complete===false||!img.width||!img.height||!art.sw||!art.sh)return art;
    var entries=objectSources.get(img);if(!entries){entries=new Map();objectSources.set(img,entries);}
    var key=[d.biome,kind,art.sx,art.sy,art.sw,art.sh].join(':'),c=entries.get(key);
    if(!c){
      c=document.createElement('canvas');c.width=art.sw;c.height=art.sh;
      var g=c.getContext('2d');g.drawImage(img,art.sx,art.sy,art.sw,art.sh,0,0,c.width,c.height);
      var image=g.getImageData(0,0,c.width,c.height),pixels=image.data;
      for(var i=0;i<pixels.length;i+=4){
        if(!pixels[i+3])continue;
        var red=pixels[i],green=pixels[i+1],blue=pixels[i+2],lum=.24*red+.65*green+.11*blue,y=Math.floor(i/4/c.width)/c.height;
        var warm=red>blue*1.2&&red-green>7,neutral=Math.max(red,green,blue)-Math.min(red,green,blue)<34;
        /* Keep the candle's small flame/wax warm. Existing crystal props and
         * the new lens/bookcase are deliberately outside this small allowlist. */
        if(kind==='table'&&y<.31&&lum>90)continue;
        var material='cobalt';
        if(kind==='table'){if(y>=.3&&y<.49&&warm)material='gold';}
        else if(kind==='door'){material=warm?(lum>155?'gold':'cobalt'):'porcelain';}
        else if(kind==='arch'){material=warm?'gold':(lum>110?'porcelain':'cobalt');}
        else if(kind==='statue'){material=warm?'gold':y>.8?'cobalt':'porcelain';}
        else {material=warm?'gold':green>red*1.2?'teal':neutral&&lum>75?'porcelain':'cobalt';}
        var lo,hi,t=Math.pow(Math.max(0,Math.min(1,(lum-18)/210)),.78);
        if(material==='gold'){lo=[61,43,20];hi=[255,225,135];}
        else if(material==='porcelain'){lo=[30,55,93];hi=[236,247,255];}
        else if(material==='teal'){lo=[13,47,83];hi=[104,231,240];}
        else {lo=[8,25,67];hi=[55,143,230];}
        for(var ch=0;ch<3;ch++)pixels[i+ch]=Math.round(lo[ch]+(hi[ch]-lo[ch])*t);
      }
      g.putImageData(image,0,0);objectBuilds++;
      /* Existing silhouette caches identify art by source URL + crop. A
       * stable canvas identity keeps different support masks from colliding. */
      c.src='prism-support-'+objectBuilds;objectCanvases.add(c);entries.set(key,c);
    }
    return Object.assign({},art,{img:c,sx:0,sy:0});
  }
  function doorPalette(palette,crystal,iron){
    var d=data();if(!d||composite(d)||rot(d)||crystal)return palette;
    if(violet(d))return {leaf:iron?'#8C7FA3':'#83608F',hi:'#E9DDF2',lo:'#49395C',band:'#CFC5DE'};
    if(cinder(d))return {leaf:iron?'#655D58':'#803F30',hi:'#D4B487',lo:'#302C2E',band:'#CA985C'};
    return {leaf:iron?'#27618C':'#2459A2',hi:'#74B9E8',lo:'#112E60',band:'#DAB365'};
  }
  function rotObjectArt(art,group,name){
    var kind=/mushroom/.test(name)?'fungus':/root|vine/.test(name)?'root':/moss|fern/.test(name)?'moss':/boulder|rubble|stalagmit|stepping-stone/.test(name)?'rock':null;
    if(!kind||!art||!art.img||objectCanvases.has(art.img))return art;
    var img=art.img;if(img.complete===false||!img.width||!img.height||!art.sw||!art.sh)return art;
    var entries=objectSources.get(img);if(!entries){entries=new Map();objectSources.set(img,entries);}
    var key=['rot',kind,name,art.sx,art.sy,art.sw,art.sh].join(':'),c=entries.get(key);
    if(!c){
      c=document.createElement('canvas');c.width=art.sw;c.height=art.sh;
      var g=c.getContext('2d');g.drawImage(img,art.sx,art.sy,art.sw,art.sh,0,0,c.width,c.height);
      var im=g.getImageData(0,0,c.width,c.height),p=im.data,amber=/(?:small-mushrooms-3|giant-mushroom-3|mushroom-pair-1)$/.test(name);
      for(var i=0;i<p.length;i+=4){
        if(!p[i+3])continue;
        var red=p[i],green=p[i+1],blue=p[i+2],lum=.24*red+.65*green+.11*blue,t=Math.pow(Math.max(0,Math.min(1,(lum-14)/219)),.82),lo,hi;
        if(kind==='moss'||kind==='rock'&&green>red*1.07){lo=[37,58,21];hi=[184,212,87];}
        else if(kind==='root'){lo=[51,35,18];hi=[225,209,165];}
        else if(kind==='fungus'){
          var colored=Math.max(red,green,blue)-Math.min(red,green,blue)>25;
          lo=colored?(amber?[93,39,11]:[57,77,18]):[67,55,31];hi=colored?(amber?[255,198,75]:[207,236,112]):[246,231,183];
        }else{lo=[64,49,28];hi=[228,205,156];}
        for(var ch=0;ch<3;ch++)p[i+ch]=Math.round(lo[ch]+(hi[ch]-lo[ch])*t);
      }
      g.putImageData(im,0,0);objectBuilds++;c.src='rot-support-'+objectBuilds;objectCanvases.add(c);entries.set(key,c);
    }
    return Object.assign({},art,{img:c,sx:0,sy:0});
  }
  var CINDER_SUPPORTS={'grave-pillar':'stone','weapon-rack':'iron','banner-stand':'banner','brazier-unlit':'iron','table-candle':'table',chains:'iron',rubble:'stone',barrel:'wood',cage:'iron',
    'door-wood':'wood','door-wood-side':'wood','door-wood-open':'wood','door-iron':'iron','door-iron-side':'iron'};
  function cinderObjectArt(art,group,name){
    var kind=CINDER_SUPPORTS[name];if(!kind||!art||!art.img||objectCanvases.has(art.img))return art;
    var img=art.img;if(img.complete===false||!img.width||!img.height||!art.sw||!art.sh)return art;
    var entries=objectSources.get(img);if(!entries){entries=new Map();objectSources.set(img,entries);}
    var key=['cinder-bastion',kind,name,art.sx,art.sy,art.sw,art.sh].join(':'),c=entries.get(key);
    if(!c){
      c=document.createElement('canvas');c.width=art.sw;c.height=art.sh;var g=c.getContext('2d');g.drawImage(img,art.sx,art.sy,art.sw,art.sh,0,0,c.width,c.height);
      var im=g.getImageData(0,0,c.width,c.height),p=im.data;
      for(var i=0;i<p.length;i+=4){
        if(!p[i+3])continue;
        var red=p[i],green=p[i+1],blue=p[i+2],lum=.24*red+.65*green+.11*blue,y=Math.floor(i/4/c.width)/c.height;
        if(kind==='table'&&y<.31&&lum>90)continue;
        var warm=red>blue*1.2&&red-green>9,t=Math.pow(Math.max(0,Math.min(1,(lum-16)/220)),.82),lo,hi;
        if(kind==='banner'&&Math.max(red,green,blue)-Math.min(red,green,blue)>30){lo=[60,14,22];hi=[211,66,45];}
        else if(warm&&kind!=='stone'&&kind!=='wood'){lo=[66,42,24];hi=[239,185,96];}
        else if(kind==='stone'||kind==='wood'||kind==='table'){lo=[61,34,30];hi=[207,150,116];}
        else {lo=[31,32,35];hi=[173,167,155];}
        for(var ch=0;ch<3;ch++)p[i+ch]=Math.round(lo[ch]+(hi[ch]-lo[ch])*t);
      }
      g.putImageData(im,0,0);objectBuilds++;c.src='cinder-support-'+objectBuilds;objectCanvases.add(c);entries.set(key,c);
    }
    return Object.assign({},art,{img:c,sx:0,sy:0});
  }
  function violetObjectArt(art,group,name){
    // Explicit focal PNGs are already painted for this biome and stay intact.
    var kind=/^violet-/.test(name)?null:/crystal/.test(name)?'crystal':/mushroom|cave-pearls/.test(name)?'pearl':/web|silk|root|vine/.test(name)?'silk':/boulder|rubble|stalagmit|stepping-stone/.test(name)?'rock':/moss|fern/.test(name)?'foliage':/pillar|statue|door|table-candle/.test(name)?'silver':null;
    if(!kind||!art||!art.img||objectCanvases.has(art.img))return art;
    var img=art.img;if(img.complete===false||!img.width||!img.height||!art.sw||!art.sh)return art;
    var entries=objectSources.get(img);if(!entries){entries=new Map();objectSources.set(img,entries);}
    var key=['violet-warrens',kind,name,art.sx,art.sy,art.sw,art.sh].join(':'),c=entries.get(key);
    if(!c){
      c=document.createElement('canvas');c.width=art.sw;c.height=art.sh;var g=c.getContext('2d');g.drawImage(img,art.sx,art.sy,art.sw,art.sh,0,0,c.width,c.height);
      var im=g.getImageData(0,0,c.width,c.height),p=im.data;
      for(var i=0;i<p.length;i+=4){
        if(!p[i+3])continue;
        var red=p[i],green=p[i+1],blue=p[i+2],lum=.24*red+.65*green+.11*blue,t=Math.pow(Math.max(0,Math.min(1,(lum-14)/219)),.8),lo,hi;
        if(kind==='crystal'){lo=[59,31,101];hi=/water|blue/.test(name)?[174,219,250]:[224,175,254];}
        else if(kind==='pearl'){var colored=Math.max(red,green,blue)-Math.min(red,green,blue)>25;lo=colored?[71,37,91]:[89,72,103];hi=colored?[221,170,226]:[247,226,245];}
        else if(kind==='silk'||kind==='silver'){lo=[66,58,87];hi=[232,223,246];}
        else if(kind==='foliage'){lo=[54,38,74];hi=[177,133,189];}
        else {lo=[62,43,86];hi=[205,173,227];}
        for(var ch=0;ch<3;ch++)p[i+ch]=Math.round(lo[ch]+(hi[ch]-lo[ch])*t);
      }
      g.putImageData(im,0,0);objectBuilds++;c.src='violet-support-'+objectBuilds;objectCanvases.add(c);entries.set(key,c);
    }
    return Object.assign({},art,{img:c,sx:0,sy:0});
  }
  function ellipse(g,x,y,rx,ry,fill){g.fillStyle=fill;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill();}
  function rootStrand(g,x,y,drop,side,width,color){
    g.strokeStyle=color;g.lineWidth=width;g.lineCap='round';g.beginPath();g.moveTo(x,y);
    g.bezierCurveTo(x+side*10,y+drop*.25,x-side*9,y+drop*.61,x+side*3,y+drop);g.stroke();
  }
  function buildRot(d){
    var c=document.createElement('canvas');c.width=MW*R;c.height=MH*R;var g=c.getContext('2d'),mask=d.landMask,seed=d.seed||91;
    function land(x,y){return x>=0&&y>=0&&x<MW&&y<MH&&!!mask[y*MW+x];}
    if(!d.mixedForeground){
    var sky=g.createLinearGradient(0,0,c.width,c.height);sky.addColorStop(0,'#47B9C5');sky.addColorStop(.48,'#62D4BE');sky.addColorStop(1,'#529ACA');g.fillStyle=sky;g.fillRect(0,0,c.width,c.height);
    for(var n=0;n<29;n++){
      var cx=noise(n,4,seed)*c.width,cy=noise(n,8,seed)*c.height,rad=R*(2+noise(n,9,seed)*5);
      var mist=g.createRadialGradient(cx,cy,0,cx,cy,rad);mist.addColorStop(0,n%3?'rgba(118,235,217,.22)':'rgba(210,236,198,.17)');mist.addColorStop(1,'rgba(92,206,210,0)');g.fillStyle=mist;g.fillRect(cx-rad,cy-rad,rad*2,rad*2);
    }
    /* Rounded distant ledges, with no archive prisms or faceted blue shards. */
    for(var k=0;k<37;k++){
      var rx=Math.floor(noise(k,23,seed)*MW),ry=Math.floor(noise(k,24,seed)*MH),near=false;
      for(var oy=-2;oy<=2;oy++)for(var ox=-2;ox<=2;ox++)if(land(rx+ox,ry+oy))near=true;
      if(near)continue;
      var dx=rx*R,dy=ry*R,w=R*(.26+noise(k,25,seed)*.55),h=w*(1.2+noise(k,26,seed));
      g.fillStyle='#24555C';g.beginPath();g.moveTo(dx-w,dy);g.bezierCurveTo(dx-w*.8,dy+h*.55,dx-w*.5,dy+h,dx-w*.12,dy+h);g.bezierCurveTo(dx+w*.35,dy+h*.95,dx+w*.76,dy+h*.35,dx+w,dy);g.closePath();g.fill();
      ellipse(g,dx,dy,w,w*.23,'#56887B');ellipse(g,dx-w*.14,dy-1,w*.74,w*.15,'#73A784');
      rootStrand(g,dx+w*.2,dy+h*.2,h*.75,1,1,'rgba(119,164,133,.34)');
    }
    }
    /* Warm porous cliff columns share the exact land edge with the terrain.
     * Their roots and moss hang into the void; everything is cached once. */
    for(var y=0;y<MH;y++)for(var x=0;x<MW;x++){
      if(!land(x,y))continue;var px=x*R,py=(y+1)*R;
      if(!land(x,y+1)){
        var dep=R*(1.7+noise(x,y,seed)*1.9),tip=px+R*(.35+noise(x,y,seed+1)*.3),ledge=g.createLinearGradient(px,py,px+R*.5,py+dep);
        ledge.addColorStop(0,'#BAA379');ledge.addColorStop(.2,'#93764F');ledge.addColorStop(.66,'#655038');ledge.addColorStop(1,'#3C3B2C');
        g.fillStyle=ledge;g.beginPath();g.moveTo(px-1,py-1);g.lineTo(px+R+1,py-1);g.bezierCurveTo(px+R*1.02,py+dep*.3,px+R*.85,py+dep*.48,px+R*.76,py+dep*.7);g.bezierCurveTo(px+R*.65,py+dep*.82,tip+3,py+dep,tip,py+dep);g.bezierCurveTo(px+R*.28,py+dep*.91,px+R*.32,py+dep*.73,px+R*.2,py+dep*.64);g.bezierCurveTo(px-R*.04,py+dep*.5,px+R*.14,py+dep*.24,px-1,py-1);g.fill();
        for(var q=0;q<6;q++){
          var ux=px+R*(.19+noise(x*7+q,y,seed+7)*.62),uy=py+dep*(.12+noise(x*7+q,y,seed+8)*.54),pr=1+noise(x*7+q,y,seed+10)*2.2;
          ellipse(g,ux,uy+.8,pr+1,pr*1.15,'rgba(226,202,151,.15)');ellipse(g,ux,uy,pr,pr*1.3,'rgba(34,34,22,.35)');
        }
        var roots=1+Math.floor(noise(x,y,seed+11)*3);
        for(var rt=0;rt<roots;rt++){
          var rootx=px+R*(.15+.7*(rt+noise(x,rt+y,seed+12))/roots),drop=dep*(.5+noise(x,rt+y,seed+13)*.5),side=rt%2?1:-1;
          rootStrand(g,rootx+1,py+3,drop,side,2.8,'rgba(43,35,21,.45)');rootStrand(g,rootx,py+2,drop,side,1.6,'#B4A276');
        }
        for(var m=0;m<5;m++){
          var mx=px+(m+.4)*R/5,mh=R*(.07+noise(x*5+m,y,seed+15)*.34);
          ellipse(g,mx,py+2,5,3,m%2?'#7C9C38':'#54742C');rootStrand(g,mx,py+1,mh,.17,3,m%2?'#819D37':'#A8B94D');
        }
      }
      if(!land(x-1,y))ellipse(g,px+1,py-R*.35,R*.12,R*.63,'#95815B');
      if(!land(x+1,y))ellipse(g,px+R-1,py-R*.3,R*.13,R*.63,'#645638');
    }
    g.globalCompositeOperation='destination-out';for(var i=0;i<mask.length;i++)if(mask[i])g.fillRect(i%MW*R,Math.floor(i/MW)*R,R,R);g.globalCompositeOperation='source-over';
    var floorClip=new Path2D();for(var fi=0;fi<mask.length;fi++)if(mask[fi]&&!isWallLike(map[fi]))floorClip.rect(fi%MW*R,Math.floor(fi/MW)*R,R,R);
    g.save();g.clip(floorClip);
    (d.tendrils||[]).forEach(function(t){
      var ax=(t.x+.5)*R,ay=(t.y+.5)*R,bx=(t.toX+.5)*R,by=(t.toY+.5)*R,dx=bx-ax,dy=by-ay;
      if(!Number.isFinite(bx)||!Number.isFinite(by))return;
      g.lineCap='round';[['rgba(49,40,21,.30)',3,2],['#B5A775',1.4,0]].forEach(function(style){
        g.strokeStyle=style[0];g.lineWidth=style[1];g.beginPath();g.moveTo(ax,ay+style[2]);g.bezierCurveTo(ax+dx*.38+dy*.15,ay+dy*.28-dx*.15,bx-dx*.24-dy*.1,by-dy*.22+dx*.1,bx,by);g.stroke();
      });
    });
    g.restore();builds++;return {data:d,map:map,canvas:c};
  }
  function drawRotSpores(d,now){
    if(ANIM.reduce)return;var t=(now||0)/1000;
    for(var n=0;n<45;n++){
      var wx=noise(n,41,d.seed)*MW,wy=noise(n,42,d.seed)*MH,ix=Math.floor(wx),iy=Math.floor(wy);
      if(!inb(ix,iy)||d.landMask[idxOf(ix,iy)]||!(revealAll||vis[idxOf(ix,iy)])||wx<camX||wx>camX+viewW||wy<camY||wy>camY+viewH)continue;
      ctx.globalAlpha=.16+.1*Math.sin(t*.4+n);ellipse(ctx,(wx-camX)*TS+Math.sin(t*.15+n)*TS*.05,(wy-camY)*TS-Math.sin(t*.2+n)*TS*.12,Math.max(.65,TS*.019),Math.max(.65,TS*.023),n%3?'#C4E9A9':'#F3D98F');
    }
  }
  function drawRotPortals(d,now){
    var time=ANIM.reduce?0:(now||0)/1000;
    d.portals.forEach(function(p){
      if(!portalVisibility(p).visible||p.x+2<camX||p.x>camX+viewW+1||p.y+2<camY||p.y>camY+viewH+1)return;
      var w=p.w||1,h=p.h||1,x=(p.x-camX+w*.5)*TS,y=(p.y-camY+h*.42)*TS,col=pairColor(p,d),r=TS*w*.52;
      ctx.save();ctx.globalAlpha=.75;var glow=ctx.createRadialGradient(x,y,0,x,y,r);glow.addColorStop(0,'rgba(221,246,173,.22)');glow.addColorStop(.5,'rgba(187,226,121,.12)');glow.addColorStop(1,'rgba(187,226,121,0)');ctx.fillStyle=glow;ctx.fillRect(x-r,y-r,r*2,r*2);
      /* Floating spores belong to this living arch; the ordinary sprite owns
       * its footprint and depth. No archive floor rings or rune brackets. */
      for(var j=0;j<5;j++){
        var a=time*.3+j*Math.PI*2/5;ctx.globalAlpha=.35+.14*Math.sin(a+time);ellipse(ctx,x+Math.cos(a)*TS*w*.22,y+Math.sin(a)*TS*h*.3,Math.max(.8,TS*.021),Math.max(.8,TS*.025),j%2?col:'#F3E6B1');
      }
      ctx.restore();
    });
  }
  var ROT_LIGHTS={
    'rot-canopy':{color:'#FFD076',radius:5,strength:1.07},
    'rot-puffballs':{color:'#CBEE83',radius:4.2,strength:.98},
    'rot-pool':{color:'#80E4BE',radius:4.5,strength:.96}
  };
  function addRotLights(list,d,now,position,skipPlayer){
    /* Keep the normal source/occlusion pipeline. A gentle player fill reveals
     * nearby tan rock; every other pocket comes from a visible object. */
    if(!skipPlayer&&list[0]){list[0].s*=.8;list[0].c=hexRGB('#FFE2A5');}
    if(!skipPlayer)list.push({x:position.x,y:position.y,c:hexRGB('#DDE2BB'),r:7,s:.62,wall:true,wr:7,ws:.92,tx:player.x,ty:player.y});
    themedProps(d).forEach(function(p){
      var light=p.previewFocal?ROT_LIGHTS[p.artName]:null;
      if(!light&&p.previewDecor&&/mushroom|glow-moss/.test(p.name))light={color:/(?:small-mushrooms-3|giant-mushroom-3|mushroom-pair-1)$/.test(p.name)?'#EDC475':'#C5E777',radius:3,strength:.58};
      if(!light||!portalVisibility(p).visible)return;
      list.push({x:p.x+((p.w||1)-1)/2,y:p.y+((p.h||1)-1)/2,c:hexRGB(light.color),r:light.radius,s:light.strength,wall:true,wr:light.radius,ws:.78,tx:p.x,ty:p.y});
    });
    d.portals.forEach(function(p){if(portalVisibility(p).visible)list.push({x:p.x+((p.w||1)-1)/2,y:p.y+((p.h||1)-1)/2,c:hexRGB(pairColor(p,d)),r:4.2,s:.98,wall:true,wr:4.2,ws:.72,tx:p.x,ty:p.y});});
    return list;
  }
  function buildCinder(d){
    var c=document.createElement('canvas');c.width=MW*R;c.height=MH*R;var g=c.getContext('2d'),mask=d.landMask,seed=d.seed||91;
    function land(x,y){return x>=0&&y>=0&&x<MW&&y<MH&&!!mask[y*MW+x];}
    if(!d.mixedForeground){
    var sky=g.createLinearGradient(0,0,c.width,c.height);sky.addColorStop(0,'#548FC1');sky.addColorStop(.5,'#73BEDA');sky.addColorStop(1,'#417FAB');g.fillStyle=sky;g.fillRect(0,0,c.width,c.height);
    for(var n=0;n<23;n++){
      var cx=noise(n,4,seed)*c.width,cy=noise(n,8,seed)*c.height,rad=R*(3+noise(n,9,seed)*5),mist=g.createRadialGradient(cx,cy,0,cx,cy,rad);
      mist.addColorStop(0,n%3?'rgba(187,226,234,.24)':'rgba(228,207,169,.17)');mist.addColorStop(1,'rgba(147,206,230,0)');g.fillStyle=mist;g.fillRect(cx-rad,cy-rad,rad*2,rad*2);
    }
    // Distant fortress remnants have broad ledges and squared battlements.
    for(var k=0;k<32;k++){
      var rx=Math.floor(noise(k,23,seed)*MW),ry=Math.floor(noise(k,24,seed)*MH),near=false;
      for(var oy=-2;oy<=2;oy++)for(var ox=-2;ox<=2;ox++)if(land(rx+ox,ry+oy))near=true;
      if(near)continue;
      var dx=rx*R,dy=ry*R,w=R*(.35+noise(k,25,seed)*.7),h=w*(1.3+noise(k,26,seed));
      polygon(g,[[dx-w,dy],[dx+w,dy],[dx+w*.7,dy+h*.6],[dx+w*.15,dy+h],[dx-w*.65,dy+h*.65]],'#675C64');
      polygon(g,[[dx-w,dy],[dx+w,dy],[dx+w*.55,dy+h*.38],[dx-w*.5,dy+h*.72]],'#936E6A');
      g.fillStyle='#ABA49B';g.fillRect(dx-w,dy-3,w*2,4);g.fillStyle='#697378';
      for(var b=0;b<3;b++)g.fillRect(dx-w+w*b*.75,dy-w*.45,w*.5,w*.42);
    }
    }
    // Red fractured bedrock supports masonry ledges; no archive crystals.
    for(var y=0;y<MH;y++)for(var x=0;x<MW;x++){
      if(!land(x,y))continue;var px=x*R,py=(y+1)*R;
      if(!land(x,y+1)){
        var dep=R*(1.6+noise(x,y,seed)*1.6),tip=px+R*(.25+noise(x,y,seed+1)*.5),rock=g.createLinearGradient(px,py,px,py+dep);
        rock.addColorStop(0,'#B6765C');rock.addColorStop(.35,'#89534B');rock.addColorStop(1,'#4B4048');
        polygon(g,[[px-1,py-2],[px+R+1,py-2],[px+R*.91,py+dep*.42],[px+R*.69,py+dep*.55],[tip,py+dep],[px+R*.1,py+dep*.63]],rock);
        polygon(g,[[px+R*.1,py+4],[px+R*.36,py+2],[tip,py+dep],[px+R*.1,py+dep*.63]],'rgba(227,143,103,.18)');
        g.strokeStyle='rgba(47,34,38,.6)';g.lineWidth=1.4;g.beginPath();g.moveTo(px+R*.7,py+6);g.lineTo(px+R*.54,py+dep*.36);g.lineTo(px+R*.68,py+dep*.48);g.stroke();
        g.fillStyle='#514A49';g.fillRect(px,py-2,R,9);g.fillStyle='#B3A08B';g.fillRect(px,py-2,R,3);g.fillStyle='#312D30';g.fillRect(px+R-1,py+1,1,6);
        if(noise(x,y,seed+5)>.58){g.fillStyle='#83756A';g.fillRect(px+R*.33,py+4,R*.34,12);g.fillStyle='#D0AB73';g.fillRect(px+R*.37,py+6,2,2);}
      }
      if(!land(x-1,y)){g.fillStyle='#9B7B68';g.fillRect(px-2,y*R,3,R);}
      if(!land(x+1,y)){g.fillStyle='#55464A';g.fillRect(px+R-1,y*R,3,R);}
    }
    g.globalCompositeOperation='destination-out';for(var i=0;i<mask.length;i++)if(mask[i])g.fillRect(i%MW*R,Math.floor(i/MW)*R,R,R);g.globalCompositeOperation='source-over';
    (d.chains||[]).forEach(function(chain){
      var ax=(chain.x+.5)*R,ay=(chain.y+.5)*R,bx=(chain.toX+.5)*R,by=(chain.toY+.5)*R,len=Math.hypot(bx-ax,by-ay),steps=Math.max(2,Math.ceil(len/6));
      for(var j=0;j<=steps;j++){
        var t=j/steps,x=ax+(bx-ax)*t,y=ay+(by-ay)*t+Math.sin(t*Math.PI)*R*.45;
        g.save();g.translate(x,y);g.rotate(Math.atan2(by-ay,bx-ax));g.lineWidth=1.5;g.strokeStyle='#403B3D';g.beginPath();g.ellipse(0,1,4,j%2?1.5:2.7,0,0,Math.PI*2);g.stroke();g.strokeStyle=j%2?'#9C8A71':'#D0B481';g.lineWidth=.8;g.beginPath();g.ellipse(0,0,3.5,j%2?1:2.2,0,0,Math.PI*2);g.stroke();g.restore();
      }
    });
    var floorClip=new Path2D();for(var fi=0;fi<mask.length;fi++)if(mask[fi]&&!isWallLike(map[fi]))floorClip.rect(fi%MW*R,Math.floor(fi/MW)*R,R,R);
    g.save();g.clip(floorClip);
    (d.cosmeticPools||[]).forEach(function(pool){
      var x=(pool.x+pool.w*.5)*R,y=(pool.y+pool.h*.5)*R,rx=pool.w*R*.46,ry=pool.h*R*.42;
      ellipse(g,x,y+2,rx+3,ry+3,'rgba(49,39,34,.65)');ellipse(g,x,y,rx,ry,'#727B78');ellipse(g,x,y,rx-3,ry-3,'#385A60');ellipse(g,x-3,y-2,rx*.8,ry*.67,'#4B7780');
      g.strokeStyle='rgba(206,183,138,.5)';g.lineWidth=1.4;g.beginPath();g.ellipse(x,y,rx,ry,0,Math.PI*.05,Math.PI*.95);g.stroke();
    });
    g.restore();builds++;return {data:d,map:map,canvas:c};
  }
  function drawCinderEmbers(d,now){
    if(ANIM.reduce)return;var time=(now||0)/1000;
    themedProps(d).forEach(function(p){
      if(!p.previewFocal||!CINDER_LIGHTS[p.artName]||!portalVisibility(p).visible)return;
      for(var n=0;n<4;n++){
        var phase=(time*.18+n*.27+noise(p.x,n,d.seed))%1,x=(p.x+(p.w||1)*.5-camX)*TS+(noise(n,p.y,d.seed)-.5)*TS,y=(p.y-camY+.45-phase*.8)*TS;
        ctx.globalAlpha=Math.sin(phase*Math.PI)*.48;ellipse(ctx,x,y,Math.max(.7,TS*.016),Math.max(.9,TS*.023),n%2?'#FFE0A0':'#FF9B49');
      }
    });
  }
  function drawCinderPortals(d,now){
    var time=ANIM.reduce?0:(now||0)/1000;
    d.portals.forEach(function(p){
      if(!portalVisibility(p).visible||p.x+2<camX||p.x>camX+viewW+1||p.y+2<camY||p.y>camY+viewH+1)return;
      var x=(p.x-camX+1)*TS,y=(p.y-camY+.9)*TS,r=TS*.85;
      ctx.save();var glow=ctx.createRadialGradient(x,y,0,x,y,r);glow.addColorStop(0,'rgba(255,200,107,.2)');glow.addColorStop(.5,'rgba(255,121,49,.1)');glow.addColorStop(1,'rgba(255,121,49,0)');ctx.fillStyle=glow;ctx.fillRect(x-r,y-r,r*2,r*2);
      for(var j=0;j<4;j++){var phase=(time*.16+j*.25)%1;ctx.globalAlpha=.28*Math.sin(phase*Math.PI);ellipse(ctx,x+(j%2?1:-1)*TS*.66,y+TS*(.45-phase*.9),Math.max(.7,TS*.018),Math.max(.9,TS*.025),'#FFD188');}
      ctx.restore();
    });
  }
  var CINDER_LIGHTS={
    'cinder-furnace':{color:'#FFAD59',radius:5.5,strength:1.2},
    'cinder-anvil':{color:'#FFC16F',radius:4.5,strength:1.02},
    'cinder-shields':{color:'#FF9F4E',radius:4,strength:.94}
  };
  function addCinderLights(list,d,now,position,skipPlayer){
    // Ordinary wall sconces use this same light pipeline, but memory is not
    // an active source in the preview. Never light an unseen adjacent island.
    if(!mixed())for(var i=list.length-1;i>0;i--){var l=list[i];if(!revealAll&&(!inb(l.tx,l.ty)||!vis[idxOf(l.tx,l.ty)]))list.splice(i,1);}
    if(!skipPlayer&&list[0]){list[0].s*=.8;list[0].c=hexRGB('#FFD9A3');}
    if(!skipPlayer)list.push({x:position.x,y:position.y,c:hexRGB('#F4D8B0'),r:6.8,s:.6,wall:true,wr:6.5,ws:.7,tx:player.x,ty:player.y});
    var pulse=ANIM.reduce?1:1+.035*Math.sin((now||0)/630);
    themedProps(d).forEach(function(p){
      var light=p.previewFocal?CINDER_LIGHTS[p.artName]:p.previewDecor&&p.name==='table-candle'?{color:'#FFC680',radius:3,strength:.6}:null;
      if(!light||!portalVisibility(p).visible)return;
      list.push({x:p.x+((p.w||1)-1)/2,y:p.y+((p.h||1)-1)/2,c:hexRGB(light.color),r:light.radius,s:light.strength*pulse,wall:true,wr:light.radius,ws:.72,tx:p.x,ty:p.y});
    });
    d.portals.forEach(function(p){if(portalVisibility(p).visible)list.push({x:p.x+.5,y:p.y+.5,c:hexRGB(pairColor(p,d)),r:4.2,s:.98*pulse,wall:true,wr:4.2,ws:.65,tx:p.x,ty:p.y});});return list;
  }
  function buildViolet(d){
    var c=document.createElement('canvas');c.width=MW*R;c.height=MH*R;var g=c.getContext('2d'),mask=d.landMask,seed=d.seed||91;
    function land(x,y){return x>=0&&y>=0&&x<MW&&y<MH&&!!mask[y*MW+x];}
    if(!d.mixedForeground){
    var sky=g.createLinearGradient(0,0,c.width,c.height);sky.addColorStop(0,'#454886');sky.addColorStop(.46,'#708BCE');sky.addColorStop(1,'#3D5CA8');g.fillStyle=sky;g.fillRect(0,0,c.width,c.height);
    for(var n=0;n<25;n++){
      var cx=noise(n,4,seed)*c.width,cy=noise(n,8,seed)*c.height,rad=R*(2+noise(n,9,seed)*6),haze=g.createRadialGradient(cx,cy,0,cx,cy,rad);
      haze.addColorStop(0,n%3?'rgba(189,167,233,.22)':'rgba(138,198,249,.25)');haze.addColorStop(1,'rgba(138,154,221,0)');g.fillStyle=haze;g.fillRect(cx-rad,cy-rad,rad*2,rad*2);
    }
    // Flowstone ledges hang in the blue void with softened mineral folds.
    for(var k=0;k<34;k++){
      var rx=Math.floor(noise(k,23,seed)*MW),ry=Math.floor(noise(k,24,seed)*MH),near=false;
      for(var oy=-2;oy<=2;oy++)for(var ox=-2;ox<=2;ox++)if(land(rx+ox,ry+oy))near=true;
      if(near)continue;
      var dx=rx*R,dy=ry*R,w=R*(.24+noise(k,25,seed)*.7),h=w*(1.3+noise(k,26,seed));
      g.fillStyle='#61528C';g.beginPath();g.moveTo(dx-w,dy);g.bezierCurveTo(dx-w*.72,dy+h*.12,dx-w*.76,dy+h*.76,dx-w*.1,dy+h);g.bezierCurveTo(dx+w*.47,dy+h*.72,dx+w*.77,dy+h*.33,dx+w,dy);g.closePath();g.fill();
      ellipse(g,dx,dy,w,w*.23,'#9382AD');ellipse(g,dx-w*.18,dy-1,w*.7,w*.12,'#B7A6CD');
    }
    }
    for(var y=0;y<MH;y++)for(var x=0;x<MW;x++){
      if(!land(x,y))continue;var px=x*R,py=(y+1)*R;
      if(!land(x,y+1)){
        var dep=R*(1.9+noise(x,y,seed)*1.65),tip=px+R*(.25+noise(x,y,seed+1)*.5),rock=g.createLinearGradient(px,py,px,py+dep);
        rock.addColorStop(0,'#AF91C6');rock.addColorStop(.23,'#826199');rock.addColorStop(.68,'#5D487E');rock.addColorStop(1,'#3F416D');
        g.fillStyle=rock;g.beginPath();g.moveTo(px-1,py-1);g.lineTo(px+R+1,py-1);g.bezierCurveTo(px+R*.95,py+dep*.33,px+R*.9,py+dep*.72,tip,py+dep);g.bezierCurveTo(px+R*.2,py+dep*.7,px+R*.2,py+dep*.36,px-1,py-1);g.fill();
        for(var rib=0;rib<3;rib++){
          var ax=px+R*(.18+rib*.26),end=py+dep*(.58+noise(x*3+rib,y,seed+4)*.34);
          g.strokeStyle=rib%2?'rgba(224,193,236,.24)':'rgba(49,35,74,.35)';g.lineWidth=rib%2?1.3:2.1;g.beginPath();g.moveTo(ax,py+3);g.bezierCurveTo(ax-6,py+dep*.27,tip+(ax-px-R*.5)*.35,end-9,tip+(ax-px-R*.5)*.2,end);g.stroke();
        }
        g.strokeStyle='#C9B2DA';g.lineWidth=1.7;g.beginPath();g.moveTo(px,py+1);g.quadraticCurveTo(px+R*.5,py+3,px+R,py+1);g.stroke();
      }
      if(!land(x-1,y))ellipse(g,px+1,py-R*.4,R*.09,R*.58,'#AA8EC0');
      if(!land(x+1,y))ellipse(g,px+R-1,py-R*.35,R*.1,R*.61,'#69547F');
    }
    g.globalCompositeOperation='destination-out';for(var i=0;i<mask.length;i++)if(mask[i])g.fillRect(i%MW*R,Math.floor(i/MW)*R,R,R);g.globalCompositeOperation='source-over';
    (d.filaments||[]).forEach(function(t){
      var ax=(t.x+.5)*R,ay=(t.y+.5)*R,bx=(t.toX+.5)*R,by=(t.toY+.5)*R;
      if(!Number.isFinite(bx)||!Number.isFinite(by))return;
      g.strokeStyle='rgba(227,208,243,.58)';g.lineWidth=.9;g.beginPath();g.moveTo(ax,ay);g.quadraticCurveTo((ax+bx)/2,(ay+by)/2+R*.7,bx,by);g.stroke();
    });
    var floorClip=new Path2D();for(var fi=0;fi<mask.length;fi++)if(mask[fi]&&!isWallLike(map[fi]))floorClip.rect(fi%MW*R,Math.floor(fi/MW)*R,R,R);
    g.save();g.clip(floorClip);
    (d.cosmeticPools||[]).forEach(function(pool){
      var x=(pool.x+pool.w*.5)*R,y=(pool.y+pool.h*.5)*R,rx=pool.w*R*.43,ry=pool.h*R*.38;
      ellipse(g,x,y+1,rx+2,ry+2,'rgba(187,174,214,.55)');ellipse(g,x,y,rx,ry,'rgba(121,162,191,.68)');ellipse(g,x-2,y-2,rx*.75,ry*.62,'rgba(186,222,232,.38)');
      g.strokeStyle='rgba(233,222,251,.65)';g.lineWidth=.9;g.beginPath();g.ellipse(x,y,rx,ry,0,Math.PI*.06,Math.PI*.86);g.stroke();
    });
    g.restore();builds++;return {data:d,map:map,canvas:c};
  }
  var VIOLET_LIGHTS={
    'violet-pavilion':{color:'#E9CAF8',radius:5,strength:1.02},
    'violet-eggs':{color:'#F8DCEB',radius:4.3,strength:1.04},
    'violet-loom':{color:'#C7D7FF',radius:4.6,strength:.98}
  };
  function violetSupportLight(p){
    if(!p.previewDecor)return null;
    if(/crystal/.test(p.name))return {color:/water|blue/.test(p.name)?'#B9DDFF':'#DCABF5',radius:3.1,strength:.65};
    if(/mushroom|cave-pearls/.test(p.name))return {color:'#F1D6E9',radius:2.7,strength:.52};
    return null;
  }
  function addVioletLights(list,d,now,position,skipPlayer){
    if(!skipPlayer&&list[0]){list[0].s*=.72;list[0].c=hexRGB('#F1DFEF');}
    if(!skipPlayer)list.push({x:position.x,y:position.y,c:hexRGB('#E1D4F4'),r:7,s:.65,wall:true,wr:7,ws:.86,tx:player.x,ty:player.y});
    themedProps(d).forEach(function(p){
      var light=p.previewFocal?VIOLET_LIGHTS[p.artName]:violetSupportLight(p);if(!light||!portalVisibility(p).visible)return;
      list.push({x:p.x+((p.w||1)-1)/2,y:p.y+((p.h||1)-1)/2,c:hexRGB(light.color),r:light.radius,s:light.strength,wall:true,wr:light.radius,ws:.74,tx:p.x,ty:p.y});
    });
    (d.cosmeticPools||[]).forEach(function(p){if(portalVisibility(p).visible)list.push({x:p.x+(p.w-1)/2,y:p.y+(p.h-1)/2,c:hexRGB('#C9DEF5'),r:2.6,s:.54,wall:true,wr:2.6,ws:.34,tx:p.x,ty:p.y});});
    d.portals.forEach(function(p){if(portalVisibility(p).visible)list.push({x:p.x+((p.w||1)-1)/2,y:p.y+((p.h||1)-1)/2,c:hexRGB(pairColor(p,d)),r:4.3,s:.98,wall:true,wr:4.3,ws:.72,tx:p.x,ty:p.y});});return list;
  }
  function drawVioletPortals(d,now){
    var time=ANIM.reduce?0:(now||0)/1000;
    d.portals.forEach(function(p){
      if(!portalVisibility(p).visible||p.x+2<camX||p.x>camX+viewW+1||p.y+2<camY||p.y>camY+viewH+1)return;
      var x=(p.x-camX+1)*TS,y=(p.y-camY+.86)*TS,r=TS*.82;
      ctx.save();var glow=ctx.createRadialGradient(x,y,0,x,y,r);glow.addColorStop(0,'rgba(208,223,255,.19)');glow.addColorStop(.5,'rgba(206,161,237,.11)');glow.addColorStop(1,'rgba(187,157,234,0)');ctx.fillStyle=glow;ctx.fillRect(x-r,y-r,r*2,r*2);
      for(var n=0;n<4;n++){var a=n*Math.PI*.5+time*.22;ctx.globalAlpha=.27+.08*Math.sin(a+time);ellipse(ctx,x+Math.cos(a)*TS*.49,y+Math.sin(a)*TS*.57,Math.max(.65,TS*.014),Math.max(.7,TS*.02),n%2?'#F8E9FC':'#CBEAFF');}
      ctx.restore();
    });
  }
  function mixedBounds(d){var b=d.bounds;return {x:Math.max(0,b.x-4),y:Math.max(0,b.y-3),right:Math.min(MW,b.x+b.w+4),bottom:Math.min(MH,b.y+b.h+6)};}
  function mixedClip(d){
    var bounds=mixedBounds(d),path=new Path2D(),all=rawData();
    for(var y=bounds.y;y<bounds.bottom;y++)for(var x=bounds.x;x<bounds.right;x++)if(!all.landMask[y*MW+x]||d.landMask[y*MW+x])path.rect(x*R,y*R,R,R);
    return path;
  }
  function buildMixed(d){
    var c=document.createElement('canvas');c.width=MW*R;c.height=MH*R;var g=c.getContext('2d'),sky=g.createLinearGradient(0,0,c.width,c.height);
    sky.addColorStop(0,'#315F99');sky.addColorStop(1,'#487FAD');g.fillStyle=sky;g.fillRect(0,0,c.width,c.height);
    // A shared blue sky with broad radial tints has no rectangular region
    // boundaries. The existing foreground builders keep every cliff opaque.
    var regions=regionData(d),skyColors={'prism-archives':'#386DA7','rot-hollows':'#62D4BE','cinder-bastion':'#73BEDA','violet-warrens':'#708BCE'};
    regions.forEach(function(region){
      var b=region.bounds,cx=(b.x+b.w*.5)*R,cy=(b.y+b.h*.5)*R,rx=(b.w*.7+5)*R,ry=(b.h*.7+5)*R;
      g.save();g.translate(cx,cy);g.scale(rx,ry);var haze=g.createRadialGradient(0,0,0,0,0,1);haze.addColorStop(0,hexA(skyColors[region.biome],.92));haze.addColorStop(.4,hexA(skyColors[region.biome],.65));haze.addColorStop(1,hexA(skyColors[region.biome],0));g.fillStyle=haze;g.fillRect(-1,-1,2,2);g.restore();
    });
    // Only one full-size temporary exists, and is released immediately after
    // compositing. No other island's playable cells enter this region's layer.
    regions.forEach(function(region){
      var layer=build(Object.assign({},region,{mixedForeground:true})).canvas,b=mixedBounds(region),x=b.x*R,y=b.y*R,w=(b.right-b.x)*R,h=(b.bottom-b.y)*R;
      g.globalCompositeOperation='destination-out';for(var i=0;i<region.landMask.length;i++)if(region.landMask[i])g.fillRect(i%MW*R,Math.floor(i/MW)*R,R,R);g.globalCompositeOperation='source-over';
      g.save();g.clip(mixedClip(region));g.drawImage(layer,x,y,w,h,x,y,w,h);g.restore();layer.width=layer.height=0;
    });
    if(d.biome==='unmaker-crucible')buildCrucibleInlays(g,d);
    return {data:d,map:map,canvas:c};
  }
  // Authored ornament is cached with the floor. It has no collision, animation
  // timer or gameplay state, and drawVoid applies the ordinary discovery mask.
  function buildCrucibleInlays(g,d){
    var layout=floorMeta.unmakerPreview;if(!layout)return;
    var clip=new Path2D();
    for(var i=0;i<d.landMask.length;i++)if(d.landMask[i]&&!isWallLike(map[i]))clip.rect(i%MW*R,Math.floor(i/MW)*R,R,R);
    g.save();g.clip(clip);
    (layout.floorInlays||[]).forEach(function(mark){
      var x=(mark.x+.5)*R,y=(mark.y+.5)*R;
      g.strokeStyle=hexA(mark.color,mark.opacity===undefined?.55:mark.opacity);g.fillStyle=hexA(mark.color,.10);g.lineWidth=mark.lineWidth||1.6;
      if(mark.kind==='broken-ring'){
        (mark.arcs||[]).forEach(function(arc){g.beginPath();g.ellipse(x,y,mark.r*R,mark.r*R*.86,0,arc[0],arc[1]);g.stroke();});
      }else if(mark.kind==='disc'){
        g.beginPath();g.ellipse(x,y,mark.r*R,mark.r*R*.86,0,0,Math.PI*2);g.fill();g.stroke();
      }else if(mark.kind==='threshold'){
        g.fillRect(mark.x*R,mark.y*R,mark.w*R,mark.h*R);
        g.beginPath();g.moveTo(mark.x*R,mark.y*R);g.lineTo((mark.x+mark.w)*R,mark.y*R);
        g.moveTo(mark.x*R,(mark.y+mark.h)*R);g.lineTo((mark.x+mark.w)*R,(mark.y+mark.h)*R);g.stroke();
      }
    });g.restore();
  }
  function build(d){
    if(composite(d))return buildMixed(d);
    if(rot(d))return buildRot(d);
    if(cinder(d))return buildCinder(d);
    if(violet(d))return buildViolet(d);
    var c=document.createElement('canvas');c.width=MW*R;c.height=MH*R;var g=c.getContext('2d'),mask=d.landMask,seed=d.seed||91;
    function land(x,y){return x>=0&&y>=0&&x<MW&&y<MH&&!!mask[y*MW+x];}
    if(!d.mixedForeground){
    var sky=g.createLinearGradient(0,0,c.width,c.height);sky.addColorStop(0,'#254F89');sky.addColorStop(.48,'#386DA7');sky.addColorStop(1,'#235A8D');g.fillStyle=sky;g.fillRect(0,0,c.width,c.height);
    /* Soft cloud banks and scattered distant fragments establish height;
     * deterministic placement never consumes the gameplay random stream. */
    for(var n=0;n<19;n++){
      var cx=noise(n,4,seed)*c.width,cy=noise(n,8,seed)*c.height,rad=R*(3+noise(n,9,seed)*7);
      var cloud=g.createRadialGradient(cx,cy,0,cx,cy,rad);cloud.addColorStop(0,n%3?'rgba(117,201,235,.24)':'rgba(171,162,225,.20)');cloud.addColorStop(1,'rgba(85,157,216,0)');g.fillStyle=cloud;g.fillRect(cx-rad,cy-rad,rad*2,rad*2);
    }
    for(var s=0;s<520;s++){
      var sx=noise(s,11,seed)*c.width,sy=noise(s,12,seed)*c.height,size=noise(s,13,seed)>.965?1.8:.65;
      g.globalAlpha=.12+noise(s,14,seed)*.36;g.fillStyle=s%6?'#A3C7E9':'#E4C788';g.fillRect(sx,sy,size,size);
    }
    g.globalAlpha=1;
    for(var k=0;k<45;k++){
      var rx=Math.floor(noise(k,23,seed)*MW),ry=Math.floor(noise(k,24,seed)*MH),near=false;
      for(var oy=-2;oy<=2;oy++)for(var ox=-2;ox<=2;ox++)if(land(rx+ox,ry+oy))near=true;
      if(near)continue;
      var x=rx*R,y=ry*R,w=R*(.22+noise(k,25,seed)*.5),h=w*(1.5+noise(k,26,seed));
      polygon(g,[[x-w,y],[x+w*.7,y-3],[x+w,y+h*.3],[x+w*.15,y+h],[x-w*.65,y+h*.5]],'#163154');
      polygon(g,[[x-w,y],[x-w*.2,y-w*.25],[x+w*.7,y-3],[x+w*.1,y+w*.2]],'#547FA0');
      polygon(g,[[x+w*.1,y+w*.2],[x+w*.7,y-3],[x+w,y+h*.3],[x+w*.15,y+h]],'#25476B');
    }
    }
    /* Exposed southern edges form irregular, faceted floating foundations.
     * This is decoration beyond CHASM edges; the existing tile edge is exact. */
    for(var yy=0;yy<MH;yy++)for(var xx=0;xx<MW;xx++){
      if(!land(xx,yy))continue;
      var px=xx*R,py=(yy+1)*R;
      if(!land(xx,yy+1)){
        var dep=R*(1.65+noise(xx,yy,seed)*2.2),tip=px+R*(.2+noise(xx,yy,seed+1)*.6),ledge=g.createLinearGradient(0,py,0,py+dep);
        ledge.addColorStop(0,'#6B94B9');ledge.addColorStop(.25,'#3D648D');ledge.addColorStop(1,'#162F59');
        polygon(g,[[px-1,py-1],[px+R+1,py-1],[px+R*.9,py+dep*.52],[tip,py+dep],[px+R*.06,py+dep*.64]],ledge);
        polygon(g,[[px,py],[px+R*.32,py+2],[tip,py+dep],[px+R*.06,py+dep*.64]],'rgba(117,147,177,.16)');
        polygon(g,[[px+R*.64,py+1],[px+R,py],[px+R*.9,py+dep*.52],[tip,py+dep]],'rgba(10,24,55,.36)');
        g.strokeStyle='rgba(175,184,182,.7)';g.lineWidth=2;g.beginPath();g.moveTo(px,py+1);g.lineTo(px+R,py+1);g.stroke();
        if(noise(xx,yy,seed+9)>.68){g.strokeStyle='rgba(98,178,197,.35)';g.lineWidth=1;g.beginPath();g.moveTo(px+R*.4,py+4);g.lineTo(px+R*.48,py+dep*.4);g.lineTo(px+R*.35,py+dep*.65);g.stroke();}
      }
      if(!land(xx+1,yy)){polygon(g,[[px+R,py-R],[px+R+R*.22,py-R*.75],[px+R+R*.13,py+R*.5],[px+R,py+R*.85]],'#274768');}
      if(!land(xx-1,yy)){polygon(g,[[px,py-R],[px-R*.13,py-R*.62],[px-R*.1,py+R*.35],[px,py+R*.6]],'#446687');}
    }
    /* Leave every playable surface and blocker to the existing renderer. */
    g.globalCompositeOperation='destination-out';for(var i=0;i<mask.length;i++)if(mask[i])g.fillRect(i%MW*R,Math.floor(i/MW)*R,R,R);g.globalCompositeOperation='source-over';
    /* A floor inlay is an explicit placement choice, never an automatic
     * circle underneath every focal prop. It is cached with the terrain. */
    var floorClip=new Path2D();for(var fi=0;fi<mask.length;fi++)if(mask[fi]&&!isWallLike(map[fi]))floorClip.rect(fi%MW*R,Math.floor(fi/MW)*R,R,R);
    g.save();g.clip(floorClip);
    themedProps(d).filter(function(p){return !!p.previewInlay;}).forEach(function(p){
      var x=(p.x+(p.w||1)/2)*R,y=(p.y+(p.h||1)/2)*R,r=R*2.05;g.strokeStyle='rgba(165,126,58,.56)';g.lineWidth=1.2;
      [r,r*.87].forEach(function(a){g.beginPath();g.ellipse(x,y,a,a*.82,0,0,Math.PI*2);g.stroke();});
      for(var j=0;j<12;j++){var a=j*Math.PI/6;g.beginPath();g.moveTo(x+Math.cos(a)*r*.87,y+Math.sin(a)*r*.87*.82);g.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r*.82);g.stroke();}
    });g.restore();builds++;return {data:d,map:map,canvas:c};
  }
  function drawVoid(now){
    var d=data();if(!d||!d.landMask)return;if(!cache||cache.data!==d||cache.map!==map)cache=build(d);
    var clip=new Path2D(),any=false;
    for(var y=camY;y<=camY+viewH;y++)for(var x=camX;x<=camX+viewW;x++)if(inb(x,y)&&(revealAll||seen[idxOf(x,y)])){clip.rect((x-camX)*TS,(y-camY)*TS,TS+.1,TS+.1);any=true;}
    if(!any)return;
    ctx.save();ctx.clip(clip);ctx.globalAlpha=1;ctx.imageSmoothingEnabled=true;
    ctx.drawImage(cache.canvas,camX*R,camY*R,(viewW+1)*R,(viewH+1)*R,0,0,(viewW+1)*TS,(viewH+1)*TS);
    /* A few slow glints use the caller's shared time. No object owns a timer. */
    var phase=ANIM.reduce?0:(now||0)/7000;
    if(composite(d)){
      regionData(d).forEach(function(region){
        if(!rot(region)&&!cinder(region))return;
        var b=mixedBounds(region);ctx.save();ctx.beginPath();ctx.rect((b.x-camX)*TS,(b.y-camY)*TS,(b.right-b.x)*TS,(b.bottom-b.y)*TS);ctx.clip();
        if(rot(region))drawRotSpores(region,now);else drawCinderEmbers(region,now);ctx.restore();
      });ctx.restore();return;
    }
    if(rot(d)){drawRotSpores(d,now);ctx.restore();return;}
    if(cinder(d)){drawCinderEmbers(d,now);ctx.restore();return;}
    if(violet(d)){ctx.restore();return;}
    for(var n=0;n<20;n++){
      var wx=noise(n,41,d.seed)*MW,wy=noise(n,42,d.seed)*MH,ix=Math.floor(wx),iy=Math.floor(wy);
      if(!inb(ix,iy)||d.landMask[idxOf(ix,iy)]||wx<camX||wx>camX+viewW||wy<camY||wy>camY+viewH)continue;
      var alpha=.17+.16*Math.sin(phase+n*2.3),px=(wx-camX)*TS,py=(wy-camY)*TS;
      ctx.globalAlpha=alpha;ctx.strokeStyle='#B3E5F0';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px-2,py);ctx.lineTo(px+2,py);ctx.moveTo(px,py-2);ctx.lineTo(px,py+2);ctx.stroke();
    }
    ctx.restore();
  }
  function pairColor(p,d){if(rot(d))return '#D7EC88';if(cinder(d))return '#FFBC70';if(violet(d))return '#C7DFFF';var pairs=[];d.portals.forEach(function(q){if(pairs.indexOf(q.pairId)<0)pairs.push(q.pairId);});return pairs.indexOf(p.pairId)%2?'#E5BA68':'#78D5F1';}
  function portalVisibility(p){
    var known=false,visible=false;
    for(var y=p.y;y<p.y+(p.h||1);y++)for(var x=p.x;x<p.x+(p.w||1);x++)if(inb(x,y)){
      known=known||revealAll||seen[idxOf(x,y)];visible=visible||revealAll||vis[idxOf(x,y)];
    }
    return {known:known,visible:visible};
  }
  function drawPortals(now){
    var d=rawData();if(!d)return;if(composite(d)){regionData(d).forEach(function(region){drawThemePortals(region,now);});return;}drawThemePortals(d,now);
  }
  function drawThemePortals(d,now){
    if(rot(d)){drawRotPortals(d,now);return;}if(cinder(d)){drawCinderPortals(d,now);return;}if(violet(d)){drawVioletPortals(d,now);return;}var time=ANIM.reduce?0:(now||0)/1000;
    d.portals.forEach(function(p){
      var w=p.w||1,h=p.h||1,state=portalVisibility(p),motionTime=state.visible?time:0;
      if(!state.known||p.x+w<camX||p.x>camX+viewW+1||p.y+h<camY||p.y>camY+viewH+1)return;
      var x=(p.x-camX+w*.5)*TS,y=(p.y-camY+h*.43)*TS,col=pairColor(p,d),a=state.visible?1:memA(.45),scale=Math.min(w,h),radius=TS*scale*.6;
      ctx.save();ctx.globalAlpha=a;var glow=ctx.createRadialGradient(x,y,0,x,y,radius);glow.addColorStop(0,'rgba(219,248,255,.42)');glow.addColorStop(.4,hexA(col,.24));glow.addColorStop(1,hexA(col,0));ctx.fillStyle=glow;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
      ctx.fillStyle=hexA(col,.2);ctx.beginPath();ctx.ellipse(x,y,TS*w*.21,TS*h*.29,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle=col;ctx.lineWidth=Math.max(1,TS*.027);ctx.beginPath();ctx.ellipse(x,y,TS*w*.22,TS*h*.3,0,0,Math.PI*2);ctx.stroke();
      for(var j=0;j<7;j++){var angle=motionTime*.48+j*Math.PI*2/7;ctx.globalAlpha=a*(.5+.3*Math.sin(angle+motionTime));ctx.fillStyle=j%3?'#F4E4BE':col;ctx.beginPath();ctx.arc(x+Math.cos(angle)*TS*w*.19,y+Math.sin(angle)*TS*h*.26,Math.max(.7,TS*.023),0,Math.PI*2);ctx.fill();}
      ctx.globalAlpha=a*.86;ctx.strokeStyle=col;ctx.beginPath();ctx.ellipse(x,(p.y-camY+h*.93)*TS,TS*w*.49,TS*h*.085,0,0,Math.PI*2);ctx.stroke();
      /* The paired marks bracket the new footprint; the normal set renderer
       * still draws its sole arch and controls character depth/occlusion. */
      [-1,1].forEach(function(side){var rx=x+side*TS*w*.53,ry=(p.y-camY+h*.92)*TS;polygon(ctx,[[rx,ry-TS*.07],[rx+TS*.04,ry],[rx,ry+TS*.07],[rx-TS*.04,ry]],col);});ctx.restore();
    });
  }
  var FOCAL_LIGHTS={
    'prism-lens':{color:'#6CCEFF',radius:4.4,strength:1.02},
    'prism-astrolabe':{color:'#F5D69B',radius:3.8,strength:.88},
    'prism-lectern':{color:'#9FDFFF',radius:3.8,strength:.94},
    'prism-tree':{color:'#A58AFF',radius:4.5,strength:1.06}
  };
  var CRYSTAL_LIGHTS={
    'crystal-water-small':{color:'#40BAFF',radius:3.2,strength:1,wallRadius:2.2,wallStrength:.5},
    'crystal-gold-small':{color:'#FFC04D',radius:3.2,strength:1,wallRadius:2.2,wallStrength:.5}
  };
  function addLights(list,now,position){
    var d=rawData();if(!d)return list;position=position||renderPos(player);
    if(!composite(d))return addThemeLights(list,d,now,position,false);
    // The existing player lamp receives exactly one local fill. All other
    // sources are selected by their own region, never by the player's region.
    for(var i=list.length-1;i>0;i--){var l=list[i];if(!revealAll&&(!inb(l.tx,l.ty)||!vis[idxOf(l.tx,l.ty)]))list.splice(i,1);}
    var regions=regionData(d),local=dataAt(player.x,player.y)||regions[0];
    addThemeLights(list,local,now,position,false);
    regions.forEach(function(region){if(region!==local)addThemeLights(list,region,now,position,true);});return list;
  }
  function addThemeLights(list,d,now,position,skipPlayer){
    if(rot(d))return addRotLights(list,d,now,position,skipPlayer);if(cinder(d))return addCinderLights(list,d,now,position,skipPlayer);if(violet(d))return addVioletLights(list,d,now,position,skipPlayer);
    /* A small cool fill keeps the nearby route legible. Each discovered
     * instrument lights its own pocket; no source washes the whole island. */
    if(!skipPlayer&&list[0]){list[0].s*=.64;list[0].c=hexRGB('#FFF0D8');}
    if(!skipPlayer)list.push({x:position.x,y:position.y,c:hexRGB('#C6DEFF'),r:6.5,s:.5,wall:true,wr:5,ws:.42,tx:player.x,ty:player.y});
    themedProps(d).forEach(function(p){
      var light=p.previewFocal?FOCAL_LIGHTS[p.artName]:p.previewDecor&&CRYSTAL_LIGHTS[p.name];if(!light||!portalVisibility(p).visible)return;
      list.push({x:p.x+((p.w||1)-1)/2,y:p.y+((p.h||1)-1)/2,c:hexRGB(light.color),r:light.radius,s:light.strength,wall:true,wr:light.wallRadius||light.radius,ws:light.wallStrength||.58,tx:p.x,ty:p.y});
    });
    d.portals.forEach(function(p){if(portalVisibility(p).visible)list.push({x:p.x+((p.w||1)-1)/2,y:p.y+((p.h||1)-1)/2,c:hexRGB(pairColor(p,d)),r:4,s:.96,wall:true,wr:4,ws:.5,tx:p.x,ty:p.y});});return list;
  }
  root.FoteChaosPreviewRenderer=Object.freeze({active:function(){return !!rawData();},mixed:mixed,themeAt:themeAt,withCell:withCell,surface:surface,terrainMaterial:terrainMaterial,objectArt:objectArt,doorPalette:doorPalette,drawVoid:drawVoid,drawPortals:drawPortals,addLights:addLights,
    ensureAssets:function(){return Promise.resolve();},reset:function(){cache=null;},diagnostics:function(){return {active:!!data(),biome:data()&&data().biome,builds:builds,cachedPixels:cache?cache.canvas.width*cache.canvas.height:0,materialCaches:surfaces.size,objectCaches:objectBuilds};}});
})(globalThis);
