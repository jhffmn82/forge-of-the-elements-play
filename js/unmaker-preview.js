/* The Unmaker's Crucible: a fixed, explorable final-floor composition.
 * Existing Chaos authoring owns installation, fog, props and motion.
 * The two linked gates share save-backed encounter state. Boss combat remains
 * a separate installation; the sandbox walkthrough never reports a victory. */
(function(root){
  'use strict';
  var encounterStarter=null,startingEncounter=false;
  function details(){return typeof floorMeta!=='undefined'&&floorMeta&&floorMeta.unmakerPreview||null;}
  function gateAt(x,y){
    var d=details();if(!d)return null;
    if(x>=d.entryGate.x&&x<d.entryGate.x+d.entryGate.w&&y===d.entryGate.y)return d.entryGate;
    if(x>=d.rearSeal.x&&x<d.rearSeal.x+d.rearSeal.w&&y===d.rearSeal.y)return d.rearSeal;
    return null;
  }
  function syncGates(){
    var d=details();if(!d||!d.gates)return;
    var state=d.gates;
    d.entryGate.open=state.walkthrough||state.phase==='preview'||state.phase==='defeated';
    d.rearSeal.open=state.walkthrough||state.phase==='defeated';
    floorMeta.ironDoors=floorMeta.ironDoors||{};
    [d.entryGate,d.rearSeal].forEach(function(gate){for(var x=gate.x;x<gate.x+gate.w;x++){
      map[idxOf(x,gate.y)]=gate.open?OPEN:gate===d.entryGate&&state.phase==='ready'?DOOR:SEALED;
      floorMeta.ironDoors[idxOf(x,gate.y)]=1;
    }});
  }
  function repairGates(){
    var d=details();if(!d)return false;
    // An older environment save may already stand beyond either threshold.
    // Preserve its position and access, with an explicitly marked walkthrough.
    if(!d.gates){
      var beyond=typeof player!=='undefined'&&player&&player.y<=d.entryGate.y;
      d.gates={phase:'ready',walkthrough:!!beyond,legacyWalkthrough:!!beyond};
    }
    d.version=2;syncGates();return true;
  }
  function refresh(){if(typeof computeFOV==='function')computeFOV();if(typeof updateUI==='function')updateUI();}
  function setWalkthrough(enabled){
    var d=details();if(!d||!d.gates||!d.layoutOnly||!RUN||!RUN.sandbox||d.gates.phase==='active')return false;
    if(typeof gameTurns!=='undefined'&&gameTurns.busy())return false;
    enabled=!!enabled;
    // Do not lower a gate onto an actor, or strand a visitor at the true Forge.
    var living=typeof ents!=='undefined'?ents.filter(function(actor){return actor.hp>0;}):[player];
    if(!enabled&&living.some(function(actor){return actor.y<=d.rearSeal.y;})&&d.gates.phase!=='defeated'){
      log('You and your companions must return south of the rear gate before restoring the gate locks.','c-info');return false;
    }
    if(!enabled&&d.gates.phase==='ready'&&living.some(function(actor){return actor.y<=d.entryGate.y;}))d.gates.phase='preview';
    d.gates.walkthrough=enabled;syncGates();refresh();
    log(enabled?'Layout walkthrough: both gates are raised. This does not count as defeating the Unmaker.':'Gate locks restored. The rear gate awaits the Unmaker\'s defeat.','c-info');
    return true;
  }
  function registerEncounter(start){
    if(start!==null&&typeof start!=='function')throw new Error('The Unmaker encounter needs a start handler.');
    encounterStarter=start;
    var d=details();if(d&&d.gates.phase!=='active'){d.encounterImplemented=!!start;d.layoutOnly=!start;}
  }
  function startEncounter(){
    var d=details();if(!d||!d.gates||d.gates.phase!=='ready'||d.gates.walkthrough||!encounterStarter)return false;
    var started;startingEncounter=true;
    try{started=encounterStarter(d)===true;}finally{startingEncounter=false;}
    // The encounter installer owns the boss and safe party placement. Never
    // seal the entrance with the player or a living companion still outside.
    var party=ents.filter(function(actor){return actor.hp>0&&(actor===player||actor.ally);});
    if(!started||!party.length||party.some(function(actor){return actor.y>=d.entryGate.y||actor.y<=d.rearSeal.y;}))return false;
    d.gates.phase='active';d.encounterImplemented=true;d.layoutOnly=false;syncGates();refresh();return true;
  }
  function completeEncounter(){
    var d=details();if(!d||!d.gates||d.gates.phase!=='active')return false;
    d.gates.phase='defeated';syncGates();refresh();
    log('The rear gate rises. The Forge of the Elements awaits.','c-kill');sfx('door-unlock');return true;
  }
  function bumpGate(x,y){
    var d=details(),gate=gateAt(x,y);if(!gate||gate.open)return false;
    if(gate===d.rearSeal){
      log('The rear gate is sealed until the Unmaker is defeated.'+(d.layoutOnly?' Combat is disabled in this environment review; Sandbox has a gate walkthrough control.':''),'c-info');
      sfx('door-locked');return true;
    }
    if(d.gates.phase==='active'){log('The entrance gate is sealed for the Unmaker encounter.','c-info');sfx('door-locked');return true;}
    if(encounterStarter){
      if(!startEncounter()){log('The encounter is not ready. The gate remains closed.','c-info');return true;}
      log('You pass the entrance gate, which seals behind your party. The Unmaker awakens.','c-kill');
    }else{
      d.gates.phase='preview';syncGates();refresh();
      log('The entrance gate rises. Combat is disabled in this environment walkthrough.','c-info');
    }
    sfx('door-open');endTurn();return true;
  }
  function destinationAllowed(x,y){
    var d=details();if(!d||!d.gates||d.gates.walkthrough)return true;
    // Movement, blink, forced movement and random teleport all use walkable.
    // Guard destinations too, so a revealed landing tile cannot skip a gate.
    if(d.gates.phase==='active'&&y>=d.entryGate.y)return false;
    return !(d.gates.phase==='ready'&&!startingEncounter&&y<d.entryGate.y||!d.rearSeal.open&&y<d.rearSeal.y);
  }
  function gateInfo(x,y){
    var d=details(),gate=gateAt(x,y);if(!gate)return null;
    var rear=gate===d.rearSeal,state=d.gates||{};
    return {name:rear?'Gate of the Elements':'The Unmaker\'s entrance gate',hint:
      state.walkthrough?'Raised for the sandbox layout walkthrough; no victory has been recorded.':
      rear?(gate.open?'The Unmaker is defeated. The way to the Forge of the Elements is open.':'Sealed until the Unmaker is defeated.'):
      state.phase==='active'?'Sealed during the Unmaker encounter.':
      gate.open?(state.phase==='preview'?'Open for the environment walkthrough. Combat is disabled.':'The entrance gate is raised.'):
      'Open this gate to begin the Unmaker encounter.'+(d.layoutOnly?' This environment preview opens the gate only; boss combat comes next.':'')};
  }
  function drawGate(x,y,px,py,alpha){
    var gate=gateAt(x,y);if(!gate)return false;
    var rear=gate===details().rearSeal,section=x-gate.x,last=section===gate.w-1,s=TS;
    var iron='#303540',edge='#929DAA',trim=rear?'#B4DAE6':'#DEB87D',seal=rear?'#91DFFF':'#FFBE78';
    ctx.save();ctx.globalAlpha=alpha;
    function box(color,xx,yy,w,h){ctx.fillStyle=color;ctx.fillRect(px+xx*s,py+yy*s,w*s,h*s);}
    // Each visible tile paints one seamless section of a single broad gate.
    // The normal object pass retains fog, remembered opacity and depth sorting.
    if(!gate.open){
      for(var i=0;i<3;i++){
        var bx=(i+.5)/3;
        box('#1C2430',bx-.038,.15,.095,.78);box(edge,bx-.026,.17,.025,.73);
        ctx.fillStyle=iron;ctx.beginPath();ctx.moveTo(px+(bx-.05)*s,py+.88*s);ctx.lineTo(px+(bx+.057)*s,py+.88*s);ctx.lineTo(px+bx*s,py+.995*s);ctx.closePath();ctx.fill();
      }
      box(iron,0,.40,1.01,.10);box(edge,0,.40,1.01,.022);
      box(iron,0,.77,1.01,.075);box(trim,0,.77,1.01,.019);
    }
    box('#242833',0,.075,1.01,.16);box(trim,0,.075,1.01,.027);box('#626C77',0,.205,1.01,.02);
    if(section===0||last){
      var post=section===0?0:.84;
      box('#32343D',post,.04,.16,.94);box(trim,post+.018,.04,.033,.94);box('#717986',post+.063,.05,.058,.91);
      box(trim,post-.005,.055,.175,.10);box(trim,post-.005,.84,.175,.085);
    }
    if(section===Math.floor(gate.w/2)){
      box('#232B38',.36,gate.open?.045:.32,.28,gate.open?.20:.30);
      ctx.strokeStyle=seal;ctx.lineWidth=Math.max(1,s*.026);ctx.beginPath();
      var cy=gate.open?.14:.46;ctx.moveTo(px+.5*s,py+(cy-.095)*s);ctx.lineTo(px+.58*s,py+cy*s);ctx.lineTo(px+.5*s,py+(cy+.095)*s);ctx.lineTo(px+.42*s,py+cy*s);ctx.closePath();ctx.stroke();
    }
    ctx.restore();return true;
  }
  function build(seed){
    var api=root.FoteChaosPreview,author=api&&api.authoring;
    if(!author)throw new Error('Load shared Chaos authoring before the Unmaker preview.');
    var preview=author.begin({biome:'unmaker-crucible',name:"The Unmaker's Crucible",width:96,height:72,
      spawn:{x:46,y:62},regionId:'preparation'},seed);
    var gameplayRng=root.rng;
    // Some ordinary prop factories sample RNG for decoration. This authored
    // composition must never advance the live combat and loot stream.
    root.rng=mulberry32(preview.seed^0x556e6d61);
    try{
      floorNo=25;floorMeta.floor=25;floorMeta.forge=true;floorMeta.forgeAt={x:50,y:60};
      floorMeta.portal=null;
      floorMeta.notes=["The Unmaker's Crucible: a fixed final floor with a safe preparation forge, an irregular arena, and the Forge of the Elements.",
        encounterStarter?'Open the entrance gate when you are ready. Your party enters and the gate seals for the fight. Defeat all three forms of the Unmaker to open the way to the Forge of the Elements.':
        'Combat is disabled in this environment review. Open the entrance gate to explore; Sandbox can raise both gates for a walkthrough.','The void is impassable.'];
      preview.cosmeticPools=[];preview.chains=[];
      var arenaOutline=[[43,24],[50,23],[56,24],[60,24],[64,27],[65,31],[62,34],[66,38],[64,43],
        [59,46],[55,47],[52,45],[51,49],[44,49],[40,47],[37,44],[32,45],[29,41],[29,37],
        [32,33],[29,30],[32,26],[37,25],[40,27]];
      var preparationOutline=[[44,56],[51,56],[55,60],[53,65],[43,66],[40,62],[41,59]];
      var forgeOutline=[[43,9],[51,9],[55,13],[53,18],[49,20],[44,19],[40,15],[40,12]];
      var cover=[{x:37,y:31,w:3,h:2},{x:55,y:29,w:2,h:3},{x:40,y:39,w:2,h:3},{x:54,y:38,w:3,h:2}];
      var details={version:2,layoutOnly:!encounterStarter,encounterImplemented:!!encounterStarter,arrival:{x:46,y:62},ordinaryForge:{x:50,y:60},
        bossStart:{x:48,y:35},arena:{outline:arenaOutline,bounds:{x:29,y:23,w:38,h:27}},cover:cover,
        entryGate:{x:45,y:52,w:5,h:1,open:false},rearSeal:{x:46,y:22,w:5,h:1,open:false},gates:{phase:'ready',walkthrough:false},
        trueForge:{x:46,y:12,w:3,h:3,center:{x:47,y:13},arrival:{x:47,y:16},artName:'cinder-furnace'},floorInlays:[]};
      floorMeta.unmakerPreview=details;
      function rect(x,y,w,h,visit){for(var yy=y;yy<y+h;yy++)for(var xx=x;xx<x+w;xx++)visit(xx,yy);}
      function inside(x,y,points){
        var hit=false;
        for(var i=0,j=points.length-1;i<points.length;j=i++){
          var a=points[i],b=points[j];
          if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;
        }
        return hit;
      }
      function region(id,name,biome,palette,outline,spawn,height){
        var entry={id:id,name:name,biome:biome,palette:palette,outline:outline,spawn:spawn,height:height,
          bounds:{x:MW,y:MH,w:0,h:0}};
        preview.regions.push(entry);
        for(var y=0;y<MH;y++)for(var x=0;x<MW;x++)if(inside(x+.5,y+.5,outline))land(entry,x,y);
        return entry;
      }
      function land(entry,x,y){
        if(!inb(x,y))throw new Error('Unmaker land leaves the map.');
        var i=idxOf(x,y),old=preview.regionByCell[i];
        if(old&&old!==entry.id)throw new Error('Unmaker themed regions overlap at '+x+','+y+'.');
        map[i]=FLOOR;preview.landMask[i]=1;preview.regionByCell[i]=entry.id;
      }
      function extend(entry,x,y,w,h){rect(x,y,w,h,function(xx,yy){land(entry,xx,yy);});}
      var prep=region('preparation','The Last Hearth','cinder-bastion','cinder',preparationOutline,preview.spawn,3);
      var arena=region('crucible',"The Unmaker's Crucible",'cinder-bastion','cinder',arenaOutline,{x:47,y:47},4);
      var forge=region('true-forge','Forge of the Elements','prism-archives','prism',forgeOutline,{x:48,y:19},5);
      // Boundaries between contiguous regions meet between rows. Every bridge
      // cell belongs to a region, so terrain, fog and light use the right theme.
      extend(prep,45,54,5,5);extend(prep,44,54,7,1);
      extend(arena,45,48,5,6);extend(arena,44,50,7,4);
      extend(arena,46,23,5,3);
      extend(forge,46,18,5,5);extend(forge,45,19,7,4);
      preview.regions.forEach(function(entry){
        var minX=MW,minY=MH,maxX=0,maxY=0;
        for(var y=0;y<MH;y++)for(var x=0;x<MW;x++)if(preview.regionByCell[idxOf(x,y)]===entry.id){
          minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
        }
        entry.bounds={x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
      });
      function landmark(id,kind,label,regionId,x,y,w,h){
        preview.landmarks.push({id:id,kind:kind,label:label,regionId:regionId,x:x,y:y,w:w||1,h:h||1});
      }
      function prop(x,y,name,label,extra,w,h){
        rect(x,y,w||1,h||1,function(xx,yy){
          if(!api.onLand(xx,yy)||at(xx,yy)!==FLOOR||propAt(xx,yy))throw new Error('Invalid Unmaker scenery: '+name+' at '+xx+','+yy+'.');
        });
        var regionId=api.regionAt(x,y),entry=preview.regions.find(function(value){return value.id===regionId;});
        return author.scenery(preview,x,y,name,Object.assign({b:0,flat:1,light:null,previewLabel:label,
          regionId:regionId,biome:entry.biome},extra||{}),w,h);
      }
      function focal(x,y,name,label,w,h){
        prop(x,y,name,label,{artName:name,b:1,flat:0,noShadow:true,previewFocal:true},w,h);
        preview.focals.push({x:x,y:y,w:w,h:h,regionId:api.regionAt(x,y),artName:name,label:label});
      }
      function light(x,y,col,r,strength){floorMeta.planeLights.push({x:x,y:y,col:col,r:r,s:strength||.6});}
      function wall(x,y,w,h){rect(x,y,w,h,function(xx,yy){
        if(!api.onLand(xx,yy)||at(xx,yy)!==FLOOR||propAt(xx,yy))throw new Error('Invalid Unmaker cover.');
        map[idxOf(xx,yy)]=WALL;
      });}
      function inlay(kind,regionId,values){details.floorInlays.push(Object.assign({kind:kind,regionId:regionId},values));}

      // A quiet forge corner leaves the entrance, threshold and five-wide
      // approach unobstructed. Its actual tile keeps existing craft services.
      map[idxOf(50,60)]=FORGE;
      prop(42,61,'weapon-rack','Last Hearth tool rack',{b:1,flat:0});
      prop(51,63,'table-candle','Last Hearth workbench',{b:1,flat:0,light:'#FFCB83'});
      prop(43,64,'rubble','Old forge fragments');
      prop(52,59,'chains','Forge anchor links');
      prop(42,60,'brazier-lit','Last Hearth brazier',{flat:0,light:'#FFD09A'});
      light(48,60,'#FFD5A0',4.3,.72);
      landmark('arrival','arrival','Arrival from the Realm of Chaos','preparation',46,62);
      landmark('preparation-forge','forge','Last Hearth crafting forge','preparation',50,60);
      inlay('disc','preparation',{x:46.5,y:62.5,r:1.35,color:'#D4B984'});

      // Stone gate cheeks frame a linked five-tile iron gate.
      wall(44,51,1,3);wall(50,51,1,3);
      prop(44,50,'brazier-lit','Western threshold flame',{flat:0,light:'#FFB06E'});
      prop(50,50,'brazier-lit','Eastern threshold flame',{flat:0,light:'#FFB06E'});
      light(44,50,'#FFB066',4,.68);light(50,50,'#FFB066',4,.68);
      landmark('boss-threshold','threshold','The Unmaker entrance gate','crucible',45,52,5,1);
      inlay('threshold','crucible',{x:45,y:52,w:5,h:1,color:'#EEBF79'});

      // Solid staggered cover gives both melee and ranged builds several
      // broad approaches. Decorative edge objects are walkable, not new cover.
      cover.forEach(function(block,index){
        wall(block.x,block.y,block.w,block.h);
        landmark('cover-'+(index+1),'cover','Crucible stone pillar '+(index+1),'crucible',block.x,block.y,block.w,block.h);
      });
      prop(38,33,'chains','Fallen western anchor');
      prop(57,30,'chains','Fallen eastern anchor');
      prop(39,41,'rubble','Weathered pillar chips');
      prop(56,40,'rubble','Broken pillar stone');
      // Keep the staggered cover legible from the fighting court. These low
      // crystals are walkable accents, not extra collision around the pillars.
      [[40,32,'fire','#FFAD70'],[54,31,'water','#86D7FF'],[42,40,'violet','#BC9CFF'],[53,39,'gold','#FFE0A1']].forEach(function(anchor){
        prop(anchor[0],anchor[1],'crystal-'+anchor[2]+'-small','Crucible pillar crystal');
        light(anchor[0],anchor[1],anchor[3],4.5,.72);
      });
      prop(32,29,'crystal-fire-small','Ember crystal');light(32,29,'#FF8959',3.1,.65);
      prop(33,41,'crystal-violet-small','Discord crystal');light(33,41,'#BB89FF',3.1,.58);
      prop(60,28,'crystal-gold-small','Golden anchor crystal');light(60,28,'#FFD181',3.1,.6);
      prop(61,40,'crystal-water-small','Azure anchor crystal');light(61,40,'#76CFFF',3.1,.63);
      prop(43,27,'chains','Broken northern shackle');
      prop(58,44,'chains','Broken eastern shackle');
      prop(35,28,'rubble','Crucible rim fragments');
      prop(60,42,'rubble','Crucible rim fragments');
      preview.chains.push({x:31,y:38,toX:26,toY:43,regionId:'crucible',variant:0},
        {x:64,y:38,toX:70,toY:42,regionId:'crucible',variant:1});
      landmark('central-court','arena','The Unmaker — central combat court','crucible',43,31,11,10);
      landmark('western-wing','wing','Broken western wing','crucible',30,34,10,9);
      landmark('eastern-wing','wing','Eastern crucible wing','crucible',57,33,8,10);
      inlay('broken-ring','crucible',{x:48,y:35,r:9.1,color:'#EDD3A2',opacity:.82,lineWidth:2.2,arcs:[[.1,.85],[1.1,2.1],[2.45,3.05],[3.5,4.5],[4.95,5.85]]});
      inlay('broken-ring','crucible',{x:48,y:35,r:4.4,color:'#FFE1A7',opacity:.82,lineWidth:2.2,arcs:[[0,.9],[1.3,2.55],[3,4.15],[4.65,5.85]]});
      inlay('disc','crucible',{x:48,y:35,r:1.6,color:'#FFE8BE',opacity:.75,lineWidth:2.2});

      // The rear passage changes from ember stone to pale Prism masonry. Its
      // six elemental anchors surround one monumental furnace and azure lens.
      wall(45,20,1,3);wall(51,20,1,3);
      prop(45,19,'crystal-gold-small','Rear seal gold crystal');
      prop(51,19,'crystal-water-small','Rear seal blue crystal');
      light(45,19,'#FFCF78',3.4,.72);light(51,19,'#78CBFF',3.4,.72);
      landmark('rear-seal','threshold','Gate of the Elements — opens after the Unmaker falls','true-forge',46,22,5,1);
      inlay('threshold','true-forge',{x:46,y:22,w:5,h:1,color:'#BCEAFF'});
      focal(46,12,'cinder-furnace','Forge of the Elements',3,3);
      focal(46,9,'prism-lens','Elemental convergence lens',2,2);
      var anchors=[
        [42,12,'fire','#FF9265'],[51,11,'air','#D8F2FF'],[53,14,'water','#68C8FF'],
        [51,17,'violet','#BC8CFF'],[44,17,'amber','#D9BD77'],[41,14,'gold','#FFD581']
      ];
      anchors.forEach(function(anchor){
        prop(anchor[0],anchor[1],'crystal-'+anchor[2]+'-small','Elemental Forge anchor');
        light(anchor[0],anchor[1],anchor[3],3.5,.74);
      });
      light(47,13,'#FFE2A6',5.5,.9);light(47,10,'#96DFFF',4.6,.68);
      landmark('true-forge','destination','Forge of the Elements — final destination','true-forge',46,12,3,3);
      landmark('forge-dais','dais','The restoration dais','true-forge',46,15,3,3);
      inlay('broken-ring','true-forge',{x:47.5,y:14,r:5.1,color:'#D6B978',arcs:[[0,6.283185307179586]]});
      inlay('disc','true-forge',{x:47.5,y:16.5,r:1.35,color:'#DAF4FF'});
      preview.decor.forEach(function(value){value.biome=preview.regions.find(function(entry){return entry.id===value.regionId;}).biome;});
      syncGates();
      return author.finish(preview);
    }finally{root.rng=gameplayRng;}
  }
  root.FoteUnmakerPreview=Object.freeze({build:build,gateAt:gateAt,gateInfo:gateInfo,bumpGate:bumpGate,drawGate:drawGate,
    repairGates:repairGates,destinationAllowed:destinationAllowed,setWalkthrough:setWalkthrough,
    registerEncounter:registerEncounter,startEncounter:startEncounter,completeEncounter:completeEncounter});
})(typeof window!=='undefined'?window:globalThis);
