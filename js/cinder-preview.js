/* Cinder Bastion: a local authored fortress on three floating islands.
 * Shared Chaos code owns movement, portal travel and the impassable void. */
(function(root){
  'use strict';
  function build(seed){
    var api=root.FoteChaosPreview,author=api&&api.authoring;
    if(!author)throw new Error('Load the shared Chaos preview before Cinder Bastion.');
    var preview=author.begin({biome:'cinder-bastion',name:'Cinder Bastion',spawn:{x:7,y:11},regionId:'mustering-hall'},seed);
    preview.cosmeticPools=[];preview.chains=[];
    // An independent stream varies a few focal positions without advancing
    // combat/loot RNG or changing the authored routes and portal arrivals.
    var choose=mulberry32(preview.seed^0x43696e64);
    function rect(x,y,w,h,visit){for(var yy=y;yy<y+h;yy++)for(var xx=x;xx<x+w;xx++)visit(xx,yy);}
    function region(id,name,footprints,spawn,height){
      var minX=MW,minY=MH,maxX=0,maxY=0;
      footprints.forEach(function(r){rect(r[0],r[1],r[2],r[3],function(x,y){
        var i=idxOf(x,y);
        if(!inb(x,y)||preview.landMask[i])throw new Error('Cinder Bastion island footprints overlap or leave the map.');
        map[i]=FLOOR;preview.landMask[i]=1;preview.regionByCell[i]=id;
        minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      });});
      preview.regions.push({id:id,name:name,bounds:{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1},spawn:spawn,height:height,palette:'cinder'});
    }
    function room(id,regionId,label,x,y,w,h,doors){
      rect(x,y,w,h,function(xx,yy){
        if(api.regionAt(xx,yy)!==regionId)throw new Error('Cinder Bastion room leaves its island at '+xx+','+yy+'.');
        if(xx===x||yy===y||xx===x+w-1||yy===y+h-1)map[idxOf(xx,yy)]=WALL;
      });
      doors.forEach(function(d){
        if(at(d[0],d[1])!==WALL)throw new Error('Cinder Bastion door requires a wall.');
        map[idxOf(d[0],d[1])]=DOOR;
      });
      rooms.push({id:rooms.length,x:x,y:y,w:w,h:h,cx:x+(w>>1),cy:y+(h>>1),special:'chaos-preview',previewId:id,regionId:regionId});
      preview.landmarks.push({id:id,kind:'room',regionId:regionId,x:x,y:y,w:w,h:h,label:label});
    }
    function prop(x,y,name,label,extra,w,h){
      for(var yy=y;yy<y+(h||1);yy++)for(var xx=x;xx<x+(w||1);xx++){
        if(!api.onLand(xx,yy)||at(xx,yy)!==FLOOR||propAt(xx,yy))throw new Error('Invalid Cinder Bastion scenery: '+name+' at '+xx+','+yy);
      }
      return author.scenery(preview,x,y,name,Object.assign({light:null,b:0,flat:1,previewLabel:label},extra||{}),w,h);
    }
    function standing(x,y,name,label){return prop(x,y,name,label,{b:1,flat:0});}
    function focal(positions,artName,label,w,h){
      var pos=positions[Math.floor(choose()*positions.length)],x=pos[0],y=pos[1];
      prop(x,y,artName,label,{artName:artName,previewFocal:true,noShadow:true,b:1,flat:0},w,h);
      preview.focals.push({regionId:api.regionAt(x,y),x:x,y:y,w:w,h:h,artName:artName,label:label});
    }
    function portal(id,pairId,regionId,x,y,arrival,destinationId,label){
      var gate=author.portal(preview,'cinder-portal',id,pairId,regionId,x,y,arrival,destinationId,label);
      propAt(x,y).light=null;return gate;
    }
    function pool(x,y,w,h,variant){
      rect(x,y,w,h,function(xx,yy){if(at(xx,yy)!==FLOOR||propAt(xx,yy)&&propAt(xx,yy).b)throw new Error('Cinder cooling pool must be cosmetic open floor.');});
      preview.cosmeticPools.push({x:x,y:y,w:w,h:h,regionId:api.regionAt(x,y),variant:variant});
    }
    function chain(x,y,toX,toY){preview.chains.push({x:x,y:y,toX:toX,toY:toY,regionId:api.regionAt(x,y),variant:preview.chains.length%3});}

    // A tall mustering hall and gatehouse share a wall. The small eastern
    // annex is reached on ordinary red-stone floor three cells wide.
    region('mustering-hall','Ember Mustering Hall',[
      [3,4,12,11],[5,2,8,2],[5,15,8,2],[15,9,4,3],[19,7,7,8]
    ],preview.spawn,3);
    room('ember-gatehouse','mustering-hall','Ember Gatehouse',6,2,6,4,[[9,5]]);
    room('mustering-chamber','mustering-hall','The Mustering Hall',5,5,9,9,[[9,5],[5,9],[13,9],[9,13]]);
    room('chain-annex','mustering-hall','The Chain Annex',19,7,7,8,[[19,10]]);
    preview.landmarks.push({id:'mustering-causeway',kind:'bridge',regionId:'mustering-hall',x:15,y:9,w:4,h:3,label:'Ironbound Causeway'});
    focal([[8,7],[8,8]],'cinder-furnace','Great horned furnace',3,3);
    standing(6,6,'weapon-rack','Muster weapons');standing(12,6,'weapon-rack','Muster weapons');
    standing(6,12,'banner-stand','Ironbound standard');standing(12,12,'brazier-unlit','Cooling brazier');
    standing(8,3,'table-candle','Gatehouse watch table');prop(10,4,'chains','Gatehouse chains');
    standing(3,5,'grave-pillar','Squat red-stone buttress');standing(14,14,'grave-pillar','Squat red-stone buttress');
    prop(4,12,'rubble','Broken battlement');prop(11,15,'chains','Cliff anchor links');
    standing(20,8,'weapon-rack','Annex weapons');standing(24,8,'brazier-unlit','Cooling brazier');
    prop(24,13,'chains','Annex chain anchor');chain(12,16,14,20);chain(25,13,28,17);

    // Two low chambers surround an open transverse yard. A clear exterior
    // circuit links the broad west landing to the gate on the eastern ledge.
    region('bastion-armory','Ironbound Armory',[
      [34,3,17,13],[38,1,9,2],[31,7,3,7],[51,6,3,9],[36,16,14,3]
    ],{x:33,y:10},4);
    room('anvil-hall','bastion-armory','The Anvil Hall',36,4,13,6,[[42,4],[40,9],[46,9]]);
    room('shield-store','bastion-armory','Shield Store',36,11,14,6,[[40,11],[46,11],[43,16]]);
    focal([[42,6],[40,6]],'cinder-anvil','Bastion anvil',3,2);
    standing(37,5,'weapon-rack','Forged weapon rack');standing(47,5,'weapon-rack','Forged weapon rack');
    standing(37,8,'barrel','Quenched iron stores');standing(47,8,'brazier-unlit','Cold brazier');
    standing(37,12,'weapon-rack','Armory weapon rack');standing(48,15,'weapon-rack','Armory weapon rack');
    standing(41,14,'cage','Empty iron cage');standing(45,14,'banner-stand','Bastion standard');
    standing(38,2,'grave-pillar','Battlement buttress');standing(46,2,'grave-pillar','Battlement buttress');
    prop(34,14,'rubble','Broken battlement');prop(48,17,'chains','Cliff anchor links');
    prop(52,7,'chains','Eastern anchor links');chain(47,18,48,21);chain(53,14,55,18);

    // The open forge court has four entrances and broad side terraces. Small
    // cooling stains are painted metadata: no liquid tile or damage source.
    region('cooling-forge-court','Cooling Forge Court',[
      [21,22,16,11],[17,25,4,5],[37,24,6,7],[24,21,9,1]
    ],{x:38,y:27},5);
    room('cooling-court','cooling-forge-court','The Cooling Court',23,23,12,9,[[29,23],[23,27],[34,27],[29,31]]);
    focal([[27,26],[29,27]],'cinder-shields','Cracked shield monument',2,2);
    standing(24,28,'brazier-unlit','Quenched brazier');standing(33,26,'brazier-unlit','Quenched brazier');
    standing(22,23,'grave-pillar','Forge buttress');standing(35,31,'grave-pillar','Forge buttress');
    standing(18,26,'weapon-rack','Cooling weapons');standing(18,28,'barrel','Forge stores');
    standing(41,25,'banner-stand','Forge standard');prop(41,29,'chains','Forge anchor links');
    prop(25,32,'rubble','Cooling slag fragments');prop(31,22,'rubble','Broken court stone');
    pool(24,24,3,2,0);pool(31,29,3,2,1);chain(21,30,18,33);chain(36,32,39,33);

    portal('mustering-gate','mustering-armory','mustering-hall',22,10,{x:21,y:11},'armory-west','To Ironbound Armory');
    portal('armory-west','mustering-armory','bastion-armory',31,9,{x:33,y:10},'mustering-gate','To Ember Mustering Hall');
    portal('armory-east','armory-forge','bastion-armory',51,11,{x:50,y:12},'forge-gate','To Cooling Forge Court');
    portal('forge-gate','armory-forge','cooling-forge-court',39,26,{x:38,y:27},'armory-east','To Ironbound Armory');
    return author.finish(preview);
  }
  root.FoteCinderPreview=Object.freeze({build:build});
})(typeof window!=='undefined'?window:globalThis);
