/* Local Chaos encounters use the ordinary actor table and turn scheduler.
 * Planning owns a separate seeded stream and never changes authored terrain. */
(function(root){
  'use strict';
  var groups={
    'prism-archives':['prism-seer','folded-horror','lens-bearer','rift-skitter','rift-skitter','rift-skitter'],
    'rot-hollows':['brood-carrier','rotling','rotling','plague-bloat','bile-spitter','rotling'],
    'cinder-bastion':['ironbound','chain-reaver','horned-reaver','gorehound','horned-reaver','gorehound'],
    'violet-warrens':['lash-dancer','razor-dancer','hookfang','silk-weaver','hookfang','razor-dancer']
  };
  function distance(a,b){return Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));}
  function active(){var p=floorMeta&&floorMeta.chaosPreview;return p&&p.biome==='chaos-mixed'?p:null;}
  function plan(preview,options){
    preview=preview||active();options=options||{};if(!preview||preview.biome!=='chaos-mixed')return [];
    var random=mulberry32(((Number.isFinite(options.seed)?options.seed:preview.seed)>>>0)^0x4368616F),out=[];
    var start=preview.spawn;
    function open(x,y){var p=inb(x,y)&&propAt(x,y);return inb(x,y)&&at(x,y)===FLOOR&&!p&&!ents.some(function(e){return e.hp>0&&e.x===x&&e.y===y;});}
    preview.regions.forEach(function(region){
      var baseRoster=groups[region.biome];if(!baseRoster)throw new Error('Unknown Chaos encounter biome: '+region.biome);
      var roster=baseRoster.concat(baseRoster);
      var safety=[{x:region.spawn.x,y:region.spawn.y}],candidates=[],chosen=[];
      preview.portals.filter(function(p){return p.regionId===region.id;}).forEach(function(p){
        safety.push(p.arrival);for(var y=p.y;y<p.y+(p.h||1);y++)for(var x=p.x;x<p.x+(p.w||1);x++)safety.push({x:x,y:y});
      });
      var bounds=region.bounds;
      for(var y=bounds.y;y<bounds.y+bounds.h;y++)for(var x=bounds.x;x<bounds.x+bounds.w;x++){
        var i=idxOf(x,y),point={x:x,y:y};
        if(preview.regionByCell[i]!==region.id||!open(x,y)||distance(point,start)<6||safety.some(function(p){return distance(point,p)<4;}))continue;
        var neighbors=[[1,0],[-1,0],[0,1],[0,-1]].filter(function(v){return open(x+v[0],y+v[1]);});
        if(neighbors.length<2||neighbors.length===2&&neighbors[0][0]+neighbors[1][0]===0&&neighbors[0][1]+neighbors[1][1]===0)continue;
        point.openNeighbors=neighbors.length;point.jitter=random();candidates.push(point);
      }
      // Four loose groups double the encounter density while keeping each
      // regional role in the same proportion. Try a tile of spacing first;
      // compact islands may use adjacent tiles without weakening safe buffers.
      var bestGroup=[];
      for(var attempt=0;attempt<64&&bestGroup.length<roster.length;attempt++){
        var separation=attempt<32?2:1;
        chosen=[];if(attempt)candidates.forEach(function(point){point.jitter=random();});
        for(var n=0;n<roster.length;n++){
          var group=Math.floor(n/3),anchor=chosen[group*3],best=null,bestScore=-Infinity;
          candidates.forEach(function(point){
            if(roster[n]==='gorehound'&&point.openNeighbors<3||chosen.some(function(p){return distance(point,p)<separation;}))return;
            var clearance=Math.min.apply(null,safety.map(function(p){return distance(point,p);}));
            var score=point.jitter*2+Math.min(10,clearance)*.15;
            if(anchor)score-=Math.abs(distance(point,anchor)-3)*.7;
            else if(chosen.length)score+=Math.min(12,Math.min.apply(null,chosen.map(function(p){return distance(point,p);})))*.55;
            if(score>bestScore){bestScore=score;best=point;}
          });
          if(!best)break;
          chosen.push({kind:'chaos-'+roster[n],x:best.x,y:best.y,regionId:region.id,biome:region.biome,group:group});
        }
        if(chosen.length>bestGroup.length)bestGroup=chosen;
      }
      // Safety never relaxes to squeeze encounters beside starts or portals.
      if(bestGroup.length<roster.length)throw new Error('Chaos island has no safe encounter space: '+region.id);
      out.push.apply(out,bestGroup);

    });
    return out;
  }
  function populate(preview,options){
    preview=preview||active();if(!preview||preview!==active())return null;
    if(preview.encounters)return preview.encounters;
    if(!root.FoteChaosEnemies)throw new Error('Chaos enemy behavior is not loaded.');
    var placements=plan(preview,options),spawned=[];
    placements.forEach(function(p){var e=root.FoteChaosEnemies.spawn(p.kind,p.x,p.y,{regionId:p.regionId,offspring:false,castCd:1});e.chaosEncounterGroup=p.group;spawned.push(e.id);});
    preview.encounters={version:1,seed:(options&&Number.isFinite(options.seed)?options.seed:preview.seed)>>>0,count:placements.length,actorIds:spawned,placements:placements};
    return preview.encounters;
  }
  root.FoteChaosEncounters=Object.freeze({plan:plan,populate:populate});
})(globalThis);
