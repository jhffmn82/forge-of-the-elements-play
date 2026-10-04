/* Rot Hollows: an authored Chaos island layout using the shared preview
 * installer and portal runtime. Pools, moss and hanging roots are cosmetic. */
(function(root){
  'use strict';
  function build(seed){
    var api=root.FoteChaosPreview,author=api&&api.authoring;
    if(!author)throw new Error('Load the shared Chaos preview before Rot Hollows.');
    var preview=author.begin({biome:'rot-hollows',name:'Rot Hollows',spawn:{x:7,y:11},regionId:'rootmouth-grotto'},seed);
    preview.mossMask=new Array(MW*MH).fill(0);preview.cosmeticPools=[];preview.tendrils=[];

    function region(id,name,rows,spawn,height){
      var minX=MW,minY=MH,maxX=0,maxY=0;
      rows.forEach(function(row){
        var y=row[0];
        for(var r=1;r<row.length;r+=2)for(var x=row[r];x<=row[r+1];x++){
          if(!inb(x,y)||preview.landMask[idxOf(x,y)])throw new Error('Invalid Rot Hollows island footprint.');
          var i=idxOf(x,y);map[i]=FLOOR;preview.landMask[i]=1;preview.regionByCell[i]=id;
          minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
        }
      });
      var bounds={x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
      preview.regions.push({id:id,name:name,bounds:bounds,height:height,spawn:spawn,palette:'rot'});
      rooms.push({id:rooms.length,x:bounds.x,y:bounds.y,w:bounds.w,h:bounds.h,cx:spawn.x,cy:spawn.y,special:'chaos-preview',previewId:id,regionId:id});
    }
    function walls(cells){cells.forEach(function(cell){
      if(!api.onLand(cell[0],cell[1]))throw new Error('Rot Hollows rock must remain on its island.');
      map[idxOf(cell[0],cell[1])]=WALL;
    });}
    function prop(x,y,name,extra,w,h){
      // Check the complete footprint, including flat walkable set pieces.
      for(var yy=y;yy<y+(h||1);yy++)for(var xx=x;xx<x+(w||1);xx++){
        if(!api.onLand(xx,yy)||at(xx,yy)!==FLOOR||propAt(xx,yy))throw new Error('Invalid Rot Hollows scenery: '+name+' at '+xx+','+yy);
      }
      return author.scenery(preview,x,y,name,Object.assign({light:null,b:0,flat:1},extra||{}),w,h);
    }
    function focal(x,y,artName,label,w,h,flat){
      prop(x,y,artName,{artName:artName,previewFocal:true,previewLabel:label,noShadow:true,b:flat?0:1,flat:flat?1:0},w,h);
      preview.focals.push({regionId:api.regionAt(x,y),x:x,y:y,w:w,h:h,artName:artName,label:label});
    }
    function pool(x,y,w,h,variant){preview.cosmeticPools.push({x:x,y:y,w:w,h:h,regionId:api.regionAt(x,y),variant:variant});}
    function tendril(x,y,toX,toY,variant){preview.tendrils.push({x:x,y:y,toX:toX,toY:toY,regionId:api.regionAt(x,y),variant:variant});}
    function portal(id,pairId,regionId,x,y,arrival,destinationId,label){
      var endpoint=author.portal(preview,'rot-portal',id,pairId,regionId,x,y,arrival,destinationId,label);
      propAt(x,y).light=null;return endpoint;
    }

    // Rootmouth's curved main grotto opens into a little spore annex. Its
    // exposed causeway is ordinary FLOOR, three cells wide throughout.
    region('rootmouth-grotto','Rootmouth Grotto',[
      [2,8,12],[3,5,14],[4,4,15],[5,3,16],[6,3,16],[7,2,16,22,24],
      [8,2,15,20,25],[9,3,25],[10,3,26],[11,3,26],[12,4,16,20,25],
      [13,4,15,21,24],[14,5,14],[15,6,13],[16,8,11]
    ],preview.spawn,3);
    walls([[8,2],[9,2],[10,2],[11,2],[12,2],[5,3],[6,3],[13,3],[14,3],
      [4,4],[15,4],[3,5],[16,5],[2,7],[2,8],[12,6],[13,6],[13,7],[14,7],
      [4,13],[5,14],[6,15],[13,15],[22,7],[24,7],[25,8]]);
    preview.landmarks.push({id:'rootmouth-annex',kind:'annex',regionId:'rootmouth-grotto',x:20,y:7,w:7,h:7,label:'The Spore Nook'});
    preview.landmarks.push({id:'rootmouth-bridge',kind:'bridge',regionId:'rootmouth-grotto',x:17,y:9,w:3,h:3,label:'Rootbound Causeway'});
    focal(7,6,'rot-canopy','Ancient shelfcap canopy',3,3,false);
    prop(4,6,'stalagmite-tall-3',{b:1,flat:0,previewLabel:'Ivory cave rock'});
    prop(11,4,'cl-small-mushrooms-3',{previewLabel:'Amber shelfcaps'});
    prop(5,9,'cl-small-mushrooms-4',{previewLabel:'Lime mushrooms'});
    prop(12,9,'vines',{previewLabel:'Exposed roots'});
    prop(5,12,'cl-rubble-2',{previewLabel:'Porous cave rubble'});
    prop(9,14,'cl-glow-moss-1',{previewLabel:'Luminous moss'});
    prop(14,11,'cl-small-mushrooms-2',{previewLabel:'Pale mushroom cluster'});
    prop(23,12,'cl-small-mushrooms-3',{previewLabel:'Amber shelfcaps'});
    prop(21,8,'vines',{previewLabel:'Annex roots'});
    pool(11,12,3,2,0);tendril(10,16,11,20,0);tendril(26,11,28,16,1);

    // Offset lobes leave a wide loop around the central rock crescent and
    // the walkable turquoise pool; both gates have clear approach aprons.
    region('shelfcap-hollow','Shelfcap Hollow',[
      [2,41,46],[3,38,49],[4,36,51],[5,35,52],[6,34,52],[7,33,53],
      [8,33,54],[9,34,54],[10,34,53],[11,35,53],[12,36,52],
      [13,36,51],[14,37,50],[15,39,49],[16,42,47]
    ],{x:36,y:8},4);
    walls([[41,2],[42,2],[43,2],[44,2],[45,2],[46,2],[38,3],[39,3],[48,3],[49,3],
      [36,4],[37,4],[51,4],[35,5],[52,5],[53,7],[54,8],[54,9],
      [41,6],[42,6],[42,7],[42,8],[41,8],[36,13],[37,14],[50,14],[49,15]]);
    focal(44,9,'rot-pool','Glowing spore pool',3,2,true);
    prop(39,5,'giant-mushroom-3',{b:1,flat:0,previewLabel:'Amber shelfcap'});
    prop(48,5,'cl-small-mushrooms-3',{previewLabel:'Shelfcap cluster'});
    prop(50,7,'stalagmite-tall-2',{b:1,flat:0,previewLabel:'Ivory cave rock'});
    prop(38,10,'vines',{previewLabel:'Creeping roots'});
    prop(39,13,'cl-small-mushrooms-4',{previewLabel:'Lime mushrooms'});
    prop(43,14,'cl-glow-moss-2',{previewLabel:'Luminous moss'});
    prop(50,13,'cl-rubble-1',{previewLabel:'Porous cave rubble'});
    prop(45,4,'vines',{previewLabel:'Shelf roots'});
    pool(44,9,3,2,1);tendril(46,16,45,20,2);tendril(51,13,54,18,0);

    // Puffball Basin spreads into broad scalloped shelves. The bent ivory
    // spine divides two winding routes that rejoin around the focal cluster.
    region('puffball-basin','Puffball Basin',[
      [21,25,32],[22,22,35],[23,20,37],[24,19,39],[25,17,40],[26,17,41],
      [27,18,41],[28,18,40],[29,19,39],[30,21,38],[31,23,36],[32,26,32]
    ],{x:37,y:27},5);
    walls([[25,21],[26,21],[27,21],[28,21],[29,21],[30,21],[31,21],[32,21],
      [22,22],[23,22],[34,22],[35,22],[20,23],[37,23],[19,24],[39,24],
      [17,25],[17,26],[18,28],[19,29],[21,30],[36,31],
      [25,25],[25,26],[26,26],[26,27],[27,27]]);
    focal(29,25,'rot-puffballs','Giant luminous puffballs',2,2,false);
    prop(23,24,'cl-small-mushrooms-4',{previewLabel:'Young puffballs'});
    prop(31,23,'cl-rubble-3',{previewLabel:'Porous cave rubble'});
    prop(20,26,'giant-mushroom-1',{b:1,flat:0,previewLabel:'Lime shelfcap'});
    prop(22,28,'vines',{previewLabel:'Basin roots'});
    prop(28,30,'cl-small-mushrooms-4',{previewLabel:'Young puffballs'});
    prop(35,30,'cl-glow-moss-3',{previewLabel:'Luminous moss'});
    prop(36,24,'stalagmite-tall-1',{b:1,flat:0,previewLabel:'Ivory cave rock'});
    pool(33,28,3,2,2);tendril(23,31,21,33,1);tendril(32,32,34,33,2);

    portal('rootmouth-gate','rootmouth-shelfcap','rootmouth-grotto',22,9,{x:21,y:10},'shelfcap-west','To Shelfcap Hollow');
    portal('shelfcap-west','rootmouth-shelfcap','shelfcap-hollow',34,7,{x:36,y:8},'rootmouth-gate','To Rootmouth Grotto');
    portal('shelfcap-east','shelfcap-puffball','shelfcap-hollow',48,11,{x:47,y:12},'puffball-gate','To Puffball Basin');
    portal('puffball-gate','shelfcap-puffball','puffball-basin',38,26,{x:37,y:27},'shelfcap-east','To Shelfcap Hollow');
    for(var y=0;y<MH;y++)for(var x=0;x<MW;x++)if(at(x,y)===FLOOR){
      preview.mossMask[idxOf(x,y)]=((Math.floor(x/3)*7+Math.floor(y/3)*11+preview.seed%17)%9)<3?1:0;
    }
    return author.finish(preview);
  }
  root.FoteRotPreview=Object.freeze({build:build});
})(typeof window!=='undefined'?window:globalThis);
