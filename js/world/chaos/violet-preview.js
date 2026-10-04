/* Violet Warrens: three authored cavern islands, with cosmetic silk and pools.
 * Installation, movement, portals and impassable void use the shared engine. */
(function(root){
  'use strict';
  function build(seed){
    var api=root.FoteChaosPreview,author=api&&api.authoring;
    if(!author)throw new Error('Load the shared Chaos preview before Violet Warrens.');
    var preview=author.begin({biome:'violet-warrens',name:'Violet Warrens',spawn:{x:7,y:10},regionId:'silkveil-grotto'},seed);
    preview.cosmeticPools=[];preview.filaments=[];
    var choose=mulberry32(preview.seed^0x56696f6c);
    function region(id,name,rows,spawn,height){
      var minX=MW,minY=MH,maxX=0,maxY=0;
      rows.forEach(function(row){
        var y=row[0];for(var span=1;span<row.length;span+=2)for(var x=row[span];x<=row[span+1];x++){
          if(!inb(x,y)||preview.landMask[idxOf(x,y)])throw new Error('Violet Warrens footprints overlap or leave the map.');
          var i=idxOf(x,y);map[i]=FLOOR;preview.landMask[i]=1;preview.regionByCell[i]=id;
          minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
        }
      });
      var bounds={x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
      preview.regions.push({id:id,name:name,bounds:bounds,spawn:spawn,height:height,palette:'violet'});
      rooms.push({id:rooms.length,x:bounds.x,y:bounds.y,w:bounds.w,h:bounds.h,cx:spawn.x,cy:spawn.y,special:'chaos-preview',previewId:id,regionId:id});
    }
    function walls(cells){cells.forEach(function(cell){
      if(!api.onLand(cell[0],cell[1]))throw new Error('Violet rock leaves its island.');map[idxOf(cell[0],cell[1])]=WALL;
    });}
    function prop(x,y,name,label,extra,w,h){
      var regionId=api.regionAt(x,y);
      for(var yy=y;yy<y+(h||1);yy++)for(var xx=x;xx<x+(w||1);xx++){
        if(!regionId||api.regionAt(xx,yy)!==regionId||at(xx,yy)!==FLOOR||propAt(xx,yy))throw new Error('Invalid Violet scenery: '+name+' at '+xx+','+yy);
      }
      return author.scenery(preview,x,y,name,Object.assign({light:null,b:0,flat:1,previewLabel:label},extra||{}),w,h);
    }
    function focal(positions,artName,label,w,h){
      var pos=positions[Math.floor(choose()*positions.length)],x=pos[0],y=pos[1];
      // The pavilion's raised dais fills its base; it is not a walk-under roof.
      prop(x,y,artName,label,{artName:artName,previewFocal:true,noShadow:true,b:1,flat:0},w,h);
      preview.focals.push({regionId:api.regionAt(x,y),x:x,y:y,w:w,h:h,artName:artName,label:label});
    }
    function portal(id,pairId,regionId,x,y,arrival,destinationId,label){
      var gate=author.portal(preview,'violet-portal',id,pairId,regionId,x,y,arrival,destinationId,label);
      propAt(x,y).light=null;return gate;
    }
    function pool(x,y,w,h,variant){
      for(var yy=y;yy<y+h;yy++)for(var xx=x;xx<x+w;xx++)if(at(xx,yy)!==FLOOR||propAt(xx,yy)&&propAt(xx,yy).b)throw new Error('Violet pools require clear cosmetic floor.');
      preview.cosmeticPools.push({x:x,y:y,w:w,h:h,regionId:api.regionAt(x,y),variant:variant});
    }
    function filament(x,y,toX,toY,variant){
      if(!api.onLand(x,y))throw new Error('Violet silk requires a cliff anchor.');
      preview.filaments.push({x:x,y:y,toX:toX,toY:toY,regionId:api.regionAt(x,y),variant:variant});
    }

    // A wide silk-draped crescent narrows into a SOUTHERN annex. Its vertical
    // causeway is ordinary FLOOR, three tiles wide, with clear approaches.
    region('silkveil-grotto','Silkveil Grotto',[
      [2,8,14],[3,6,17],[4,4,19],[5,3,20],[6,3,22],[7,2,23],[8,2,23],
      [9,3,22],[10,3,21],[11,4,20],[12,4,19],[13,5,19],[14,6,18],
      [15,7,17],[16,9,15],[17,10,14],[18,11,13],[19,11,13],[20,11,13],
      [21,10,15],[22,8,17],[23,7,18],[24,7,19],[25,8,19],[26,9,18],[27,10,17],[28,12,15]
    ],preview.spawn,4);
    walls([[8,2],[9,2],[10,2],[11,2],[12,2],[13,2],[14,2],[6,3],[7,3],[16,3],[17,3],
      [4,4],[19,4],[3,5],[20,5],[2,7],[23,7],[2,8],[23,8],
      [16,6],[17,6],[18,6],[17,7],[18,7],[18,8],[9,12],[10,12],[10,13],[11,13],
      [4,12],[5,13],[6,14],[7,15],[17,15],[9,16],[15,16],
      [10,21],[15,21],[8,22],[17,22],[7,23],[18,23],[19,24],[8,25],[9,26],[10,27],[17,27],[12,28],[15,28]]);
    preview.landmarks.push({id:'silkveil-causeway',kind:'bridge',regionId:'silkveil-grotto',x:11,y:18,w:3,h:3,label:'The Silk Causeway'});
    preview.landmarks.push({id:'silkveil-annex',kind:'annex',regionId:'silkveil-grotto',x:7,y:21,w:13,h:8,label:'The Draped Alcove'});
    focal([[8,6],[9,6]],'violet-pavilion','Silk-draped pavilion',3,3);
    prop(5,6,'crystal-violet-small','Amethyst buds');prop(14,4,'cl-crystal-shards-3','Lavender crystal scatter');
    prop(20,7,'stalagmite-tall-2','Flowing plum rock',{b:1,flat:0});prop(6,12,'cl-cave-pearls-1','Silver cave pearls');
    prop(5,10,'cl-rubble-2','Smooth plum stone');prop(16,12,'cl-crystal-shards-1','Moonlit crystal scatter');
    prop(9,24,'cl-cave-pearls-2','Annex pearls');prop(17,23,'crystal-violet-small','Amethyst buds');
    prop(17,26,'stalagmite-tall-3','Silk anchor stone',{b:1,flat:0});
    pool(13,10,3,2,0);filament(3,9,0,12,0);filament(20,11,24,15,1);filament(15,28,18,31,2);

    // Pearlcoil spreads across a shallow crescent, with the nursery behind a
    // short curved spine and two separated landings on opposite shores.
    region('pearlcoil-nursery','Pearlcoil Nursery',[
      [2,39,45],[3,36,48],[4,34,50],[5,33,52],[6,32,53],[7,31,53],[8,31,52],
      [9,32,51],[10,33,50],[11,33,50],[12,34,49],[13,35,48],[14,36,47],[15,38,45],[16,40,43]
    ],{x:34,y:8},3);
    walls([[39,2],[40,2],[41,2],[42,2],[43,2],[44,2],[45,2],[36,3],[48,3],[34,4],[50,4],
      [33,5],[52,5],[31,7],[31,8],[53,6],[53,7],[50,10],
      [39,6],[40,6],[41,6],[41,7],[41,8],[40,8],[35,13],[36,14],[47,14],[38,15],[45,15],[40,16],[43,16]]);
    focal([[41,11],[42,11]],'violet-eggs','Pearl egg nest',2,2);
    prop(37,4,'cl-cave-pearls-3','Unlit pearl cluster');prop(45,5,'crystal-violet-small','Violet crystal buds');
    prop(50,7,'stalagmite-tall-1','Plum mineral column',{b:1,flat:0});prop(33,9,'cl-rubble-1','Polished cave rubble');
    prop(36,13,'cl-crystal-shards-3','Pearlcoil crystals');prop(44,14,'cl-cave-pearls-1','Small pearl nest');
    prop(44,8,'cl-crystal-shards-1','Nursery crystal scatter');
    pool(35,10,3,2,1);filament(46,3,49,1,0);filament(51,8,55,10,2);filament(39,15,36,18,1);

    // The diagonal gallery is a long, swept lobe with a wide southern loop.
    // Its loom and curved rock spine leave two routes back to the east gate.
    region('moonthread-gallery','Moonthread Gallery',[
      [20,41,46],[21,38,49],[22,34,51],[23,31,52],[24,28,52],[25,27,51],
      [26,26,50],[27,26,48],[28,27,47],[29,29,46],[30,31,45],[31,33,42],[32,35,39]
    ],{x:47,y:24},5);
    walls([[41,20],[42,20],[43,20],[44,20],[45,20],[46,20],[38,21],[49,21],[34,22],[51,22],
      [31,23],[52,23],[28,24],[52,24],[27,25],[26,26],[26,27],[27,28],[29,29],[31,30],
      [33,31],[42,31],[35,32],[39,32],[41,24],[42,24],[41,25],[40,25],[40,26],[41,26]]);
    focal([[35,25],[35,27]],'violet-loom','Moonthread silk loom',3,2);
    prop(39,22,'crystal-violet-small','Moonthread crystals');prop(46,22,'cl-cave-pearls-2','Silver pearl scatter');
    prop(29,25,'stalagmite-tall-3','Curved silk anchor',{b:1,flat:0});prop(32,29,'cl-rubble-2','Smooth gallery stone');
    prop(43,29,'stalagmite-tall-2','Plum mineral column',{b:1,flat:0});prop(37,31,'cl-crystal-shards-3','Lavender crystal scatter');
    prop(48,25,'cl-cave-pearls-3','Gallery pearls');
    pool(29,26,3,2,2);filament(32,23,28,20,0);filament(50,25,54,28,1);filament(38,32,41,33,2);

    portal('silkveil-gate','silkveil-pearlcoil','silkveil-grotto',13,24,{x:12,y:25},'pearlcoil-west','To Pearlcoil Nursery');
    portal('pearlcoil-west','silkveil-pearlcoil','pearlcoil-nursery',32,7,{x:34,y:8},'silkveil-gate','To Silkveil Grotto');
    portal('pearlcoil-east','pearlcoil-moonthread','pearlcoil-nursery',47,11,{x:46,y:12},'moonthread-gate','To Moonthread Gallery');
    portal('moonthread-gate','pearlcoil-moonthread','moonthread-gallery',48,23,{x:47,y:24},'pearlcoil-east','To Pearlcoil Nursery');
    return author.finish(preview);
  }
  root.FoteVioletPreview=Object.freeze({build:build});
})(typeof window!=='undefined'?window:globalThis);
