/* Realm of Chaos: five approved island templates, composed on one floor.
 * Biome order, the repeated type and source regions use an isolated stream.
 * Source builders retain their own geometry, focal variation and scenery. */
(function(root){
  'use strict';
  function build(seed,options){
    var api=root.FoteChaosPreview,author=api&&api.authoring;
    if(!author||!author.capture)throw new Error('Load the shared Chaos authoring API before composing the realm.');
    seed=Number.isFinite(seed)?seed>>>0:92421;
    var choose=mulberry32(seed^0x4d697865),types=[
      {biome:'prism-archives',portal:'prism-portal',build:api.build},
      {biome:'rot-hollows',portal:'rot-portal',build:root.FoteRotPreview&&root.FoteRotPreview.build},
      {biome:'cinder-bastion',portal:'cinder-portal',build:root.FoteCinderPreview&&root.FoteCinderPreview.build},
      {biome:'violet-warrens',portal:'violet-portal',build:root.FoteVioletPreview&&root.FoteVioletPreview.build}
    ];
    if(types.some(function(type){return typeof type.build!=='function';}))throw new Error('Load all four approved Chaos layouts before composing the realm.');
    var campaign=!!(options&&options.campaign),order=[];
    if(campaign){for(var pick=0;pick<5;pick++)order.push(types[Math.floor(choose()*types.length)]);}
    else{
      order=types.slice();order.push(types[Math.floor(choose()*types.length)]);
      for(var n=order.length-1;n>0;n--){var swap=Math.floor(choose()*(n+1)),held=order[n];order[n]=order[swap];order[swap]=held;}
    }
    // The upper row runs west to east; the lower row returns westward. The
    // 27-cell slots leave at least five cells of void between any land masks.
    var slots=[{x:3,y:4},{x:35,y:4},{x:67,y:4},{x:51,y:39},{x:19,y:39}],used={},usedFocals={};
    var selections=order.map(function(type,index){
      var sourceSeed=Math.floor(choose()*4294967296)>>>0,source=author.capture(type.build,sourceSeed);
      var available=source.preview.regions.filter(function(region){
        var focal=source.preview.focals.find(function(value){return value.regionId===region.id;});
        return !(used[type.biome]||[]).includes(region.id)&&focal&&!(usedFocals[type.biome]||[]).includes(focal.artName);
      });
      // A campaign floor can roll one realm five times. Prefer fresh templates,
      // then reuse an approved shape with that island's own scenery seed.
      if(!available.length&&campaign){
        used[type.biome]=[];usedFocals[type.biome]=[];
        available=source.preview.regions.filter(function(region){return source.preview.focals.some(function(value){return value.regionId===region.id;});});
      }
      if(!available.length)throw new Error('No distinct approved template and focal for the repeated biome.');
      var region=available[Math.floor(choose()*available.length)];
      (used[type.biome]||(used[type.biome]=[])).push(region.id);
      (usedFocals[type.biome]||(usedFocals[type.biome]=[])).push(source.preview.focals.find(function(value){return value.regionId===region.id;}).artName);
      if(region.bounds.w>27||region.bounds.h>27)throw new Error('Approved island exceeds its composition slot.');
      return {type:type,source:source,region:region,id:'island-'+(index+1),sourceSeed:sourceSeed,
        dx:slots[index].x+Math.floor((27-region.bounds.w)/2)-region.bounds.x,
        dy:slots[index].y+Math.floor((27-region.bounds.h)/2)-region.bounds.y};
    });
    var first=selections[0],preview=author.begin({biome:'chaos-mixed',name:'Realm of Chaos',width:96,height:72,islandCount:5,
      spawn:{x:first.region.spawn.x+first.dx,y:first.region.spawn.y+first.dy},regionId:first.id},seed);
    preview.mossMask=new Array(MW*MH).fill(0);preview.cosmeticPools=[];preview.tendrils=[];preview.chains=[];preview.filaments=[];
    preview.composition={width:MW,height:MH,order:order.map(function(type){return type.biome;}),links:[]};
    function translated(value,selection){
      var out=JSON.parse(JSON.stringify(value));
      if(Number.isFinite(out.x))out.x+=selection.dx;if(Number.isFinite(out.y))out.y+=selection.dy;
      if(Number.isFinite(out.cx))out.cx+=selection.dx;if(Number.isFinite(out.cy))out.cy+=selection.dy;
      if(Number.isFinite(out.toX))out.toX+=selection.dx;if(Number.isFinite(out.toY))out.toY+=selection.dy;
      out.regionId=selection.id;out.biome=selection.type.biome;return out;
    }
    selections.forEach(function(selection){
      var source=selection.source,original=selection.region,id=selection.id;
      var region={id:id,name:original.name,biome:selection.type.biome,sourceRegionId:original.id,sourceSeed:selection.sourceSeed,
        palette:original.palette,height:original.height,bounds:translated(original.bounds,selection),
        spawn:{x:original.spawn.x+selection.dx,y:original.spawn.y+selection.dy}};
      // Bounds are geometry, not independently themed objects.
      delete region.bounds.regionId;delete region.bounds.biome;preview.regions.push(region);
      for(var y=0;y<source.height;y++)for(var x=0;x<source.width;x++){
        var si=y*source.width+x;if(source.preview.regionByCell[si]!==original.id)continue;
        var xx=x+selection.dx,yy=y+selection.dy,di=idxOf(xx,yy);
        if(!inb(xx,yy)||preview.landMask[di])throw new Error('Composed Chaos islands overlap or leave the floor.');
        map[di]=source.map[si]===PORTAL?FLOOR:source.map[si];preview.landMask[di]=1;preview.regionByCell[di]=id;
        preview.mossMask[di]=source.preview.mossMask&&source.preview.mossMask[si]||0;
      }
      source.props.filter(function(p){return !p.previewPortal&&source.preview.regionByCell[p.y*source.width+p.x]===original.id;}).forEach(function(p){
        var copy=translated(p,selection),x=copy.x,y=copy.y,name=copy.name;
        delete copy.x;delete copy.y;delete copy.name;
        for(var yy=y;yy<y+(p.h||1);yy++)for(var xx=x;xx<x+(p.w||1);xx++){
          if(api.regionAt(xx,yy)!==id||at(xx,yy)!==FLOOR||propAt(xx,yy))throw new Error('Composed scenery leaves its approved footprint.');
        }
        author.scenery(preview,x,y,name,copy,p.set?p.w:undefined,p.set?p.h:undefined);
      });
      ['focals','landmarks','cosmeticPools','tendrils','chains','filaments'].forEach(function(key){
        (source.preview[key]||[]).filter(function(value){return value.regionId===original.id;}).forEach(function(value){
          var copy=translated(value,selection);if(copy.id)copy.id=id+'-'+copy.id;preview[key].push(copy);
        });
      });
      source.rooms.filter(function(room){return room.regionId===original.id;}).forEach(function(room){var copy=translated(room,selection);copy.id=rooms.length;copy.previewId=id+'-'+copy.previewId;rooms.push(copy);});
      (source.planeLights||[]).filter(function(light){return source.preview.regionByCell[light.y*source.width+light.x]===original.id;}).forEach(function(light){floorMeta.planeLights.push(translated(light,selection));});
      selection.originalGates=source.preview.portals.filter(function(gate){return gate.regionId===original.id;}).map(function(gate){
        return {x:gate.x+selection.dx,y:gate.y+selection.dy,arrival:{x:gate.arrival.x+selection.dx,y:gate.arrival.y+selection.dy}};
      });
    });
    // Reuse the approved landing patches first. A template with one original
    // gate receives a second clear 2x2 patch, far from the first, when internal
    // to the chain. No carved routes or removed furniture are needed.
    var reserved=new Set();
    function clearFloor(x,y,id){return inb(x,y)&&api.regionAt(x,y)===id&&at(x,y)===FLOOR&&!propAt(x,y)&&!reserved.has(idxOf(x,y));}
    function gateCandidate(x,y,region,preferred){
      for(var yy=y;yy<y+2;yy++)for(var xx=x;xx<x+2;xx++)if(!clearFloor(xx,yy,region.id)||xx===region.spawn.x&&yy===region.spawn.y)return null;
      var apron=[];
      for(var ay=y-1;ay<=y+2;ay++)for(var ax=x-1;ax<=x+2;ax++){
        if(ax>=x&&ax<x+2&&ay>=y&&ay<y+2)continue;
        if((ax<x||ax>=x+2)&&(ay<y||ay>=y+2))continue;
        if(clearFloor(ax,ay,region.id))apron.push({x:ax,y:ay});
      }
      if(!apron.length)return null;
      var arrival=preferred&&apron.find(function(p){return p.x===preferred.x&&p.y===preferred.y;})||apron[0];
      return {x:x,y:y,arrival:arrival};
    }
    selections.forEach(function(selection,index){
      var region=preview.regions[index],needed=index===0||index===4?1:2,gates=[];
      function keep(gate){gates.push(gate);for(var yy=gate.y;yy<gate.y+2;yy++)for(var xx=gate.x;xx<gate.x+2;xx++)reserved.add(idxOf(xx,yy));reserved.add(idxOf(gate.arrival.x,gate.arrival.y));}
      selection.originalGates.forEach(function(old){if(gates.length<needed){var gate=gateCandidate(old.x,old.y,region,old.arrival);if(gate)keep(gate);}});
      while(gates.length<needed){
        var choices=[],b=region.bounds;
        for(var y=b.y;y<b.y+b.h-1;y++)for(var x=b.x;x<b.x+b.w-1;x++){
          var candidate=gateCandidate(x,y,region);if(!candidate)continue;
          candidate.distance=gates.length?Math.min.apply(null,gates.map(function(g){return Math.abs(g.x-x)+Math.abs(g.y-y);})):Math.abs(region.spawn.x-x)+Math.abs(region.spawn.y-y);
          if(candidate.distance>=6)choices.push(candidate);
        }
        choices.sort(function(a,b){return b.distance-a.distance||a.y-b.y||a.x-b.x;});
        if(!choices.length)throw new Error('Approved island has no clear second portal landing.');
        var chosen=choices[0];delete chosen.distance;keep(chosen);
      }
      selection.gates=gates;
    });
    for(var link=0;link<4;link++){
      var left=selections[link],right=selections[link+1],a=left.gates[link===0?0:1],b=right.gates[0];
      var pair='chaos-link-'+(link+1),aId=pair+'-a',bId=pair+'-b';
      author.portal(preview,left.type.portal,aId,pair,left.id,a.x,a.y,a.arrival,bId,'To '+preview.regions[link+1].name);
      author.portal(preview,right.type.portal,bId,pair,right.id,b.x,b.y,b.arrival,aId,'To '+preview.regions[link].name);
      [a,b].forEach(function(g){var p=propAt(g.x,g.y);p.light=null;p.regionId=api.regionAt(g.x,g.y);p.biome=preview.regions.find(function(r){return r.id===p.regionId;}).biome;});
      preview.composition.links.push({pairId:pair,from:left.id,to:right.id});
    }
    preview.decor.forEach(function(value){value.biome=preview.regions.find(function(region){return region.id===value.regionId;}).biome;});
    return author.finish(preview);
  }
  root.FoteMixedChaosPreview=Object.freeze({build:build});
})(typeof window!=='undefined'?window:globalThis);
