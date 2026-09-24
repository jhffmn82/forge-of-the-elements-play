/* Biome rules prepare a prop once, then common creation owns grid registration. */
function propDeepTheme(c){
  if(inDeep()&&floorMeta.deepRegion&&!(c.extra&&(c.extra.keep||c.extra.tablet||c.extra.lever||c.extra.prisoner||c.extra.deep))){
    var table=DEEP_PROP[deepRegionAt(c.x,c.y)]||{};
    if(c.name in table){var mapped=table[c.name];if(mapped===null){c.done=true;return;}c.name=typeof mapped==='string'?mapped:mapped[Math.floor(rng()*mapped.length)];}
  }
}
function propCryptPack(c){
  if(!packCryptOn())return;
  var name=c.name,mapped=CRYPT_PROP[name]||name;
  if((mapped==='grave-pillar'||(mapped==='coffin'&&rng()<.5))&&packArt(mapped)&&!(c.extra&&c.extra.cp)){c.extra=Object.assign({},c.extra||{},{cp:true});return;}
  c.after.push(function(p){
    if(!p||p.name!=='pedestal')return;
    if(name==='grave-post'&&packArt('grave-post')){p.name='grave-post';p.set=true;p.w=1;p.h=1;p.b=1;}
    else if((mapped==='sarcophagus'||mapped==='sarcophagus-open'||mapped==='coffin')&&packArt(mapped)){p.name=mapped;p.b=1;}
  });
}
function propCavernTheme(c){if(inCaverns()&&CAVE_PROP[c.name]&&!(c.extra&&(c.extra.keep||c.extra.tablet||c.extra.lever||c.extra.prisoner)))c.name=pick(CAVE_PROP[c.name]);}
function propBeds(c){
  if(c.name!=='bed-straw'||c.extra&&c.extra.keep)return;
  function wallSide(x,y){return [[0,-1],[-1,0],[1,0],[0,1]].filter(function(d){return inb(x+d[0],y+d[1])&&isWallLike(at(x+d[0],y+d[1]));})[0];}
  var side=wallSide(c.x,c.y);
  if(!side){
    var best=null;
    for(var r=1;r<=3&&!best;r++)for(var oy=-r;oy<=r&&!best;oy++)for(var ox=-r;ox<=r;ox++){
      var nx=c.x+ox,ny=c.y+oy;if(!inb(nx,ny)||!freeCell(nx,ny)||nearDoor(nx,ny))continue;
      var found=wallSide(nx,ny);if(found){best={x:nx,y:ny,side:found};break;}
    }
    if(!best){c.done=true;return;}c.x=best.x;c.y=best.y;side=best.side;
  }
  var x=c.x,y=c.y,name=c.name;c.extra=Object.assign({bedSide:side},c.extra||{});
  c.after.push(function(p){
    if(!p||rng()>=.7)return;
    var along=side[1]!==0?[1,0]:[0,1],n=1+(rng()<.45?1:0);
    for(var k=1;k<=n;k++){
      var gx=x+along[0]*(k+(rng()<.35?1:0)),gy=y+along[1]*(k+(rng()<.35?1:0));
      if(!inb(gx,gy)||!freeCell(gx,gy)||nearDoor(gx,gy))break;
      if(!(inb(gx+side[0],gy+side[1])&&isWallLike(at(gx+side[0],gy+side[1]))))break;
      propCreation.place({x:gx,y:gy,name:name,extra:{bedSide:side}},'wall-chains');
    }
  });
}
function propChains(c){
  if(c.name!=='chains'||c.extra&&c.extra.keep)return;
  function wallDirs(x,y){return [[0,-1],[-1,0],[1,0]].filter(function(d){return inb(x+d[0],y+d[1])&&isWallLike(at(x+d[0],y+d[1]));});}
  var dirs=wallDirs(c.x,c.y);
  if(!dirs.length){
    var best=null;
    for(var r=1;r<=3&&!best;r++)for(var oy=-r;oy<=r&&!best;oy++)for(var ox=-r;ox<=r;ox++){
      var nx=c.x+ox,ny=c.y+oy;if(!inb(nx,ny)||!freeCell(nx,ny)||nearDoor(nx,ny))continue;
      var found=wallDirs(nx,ny);if(found.length){best={x:nx,y:ny,dirs:found};break;}
    }
    if(!best){c.done=true;return;}c.x=best.x;c.y=best.y;dirs=best.dirs;
  }
  var dir=dirs[Math.floor(rng()*dirs.length)];c.extra=Object.assign({chainDir:dir,chainSeed:Math.floor(rng()*89)},c.extra||{});
}
function propDungeonMushrooms(c){
  if(inCrypt()||floorMeta&&floorMeta.plane||c.name!=='mushrooms'||c.extra&&c.extra.keep)return;
  if(inb(c.x,c.y)&&at(c.x,c.y)===FLOOR){var kind=rng()<.6?G_GRASS:G_MOSS;blob(c.x,c.y,ri(3,8),function(x,y){if(at(x,y)===FLOOR&&!gAt(x,y)&&!propAt(x,y))setG(x,y,kind);});}
  c.done=true;
}
function propTightRooms(c){
  if(!cpOn()||c.extra&&c.extra.keep)return;
  var room=roomAt(c.x,c.y),tight=!room||room.w*room.h<=20;if(!tight)return;
  var big=c.name==='sarc'||/^tomb-/.test(c.name);
  if(!room&&big){c.done=true;return;}
  if(!room&&(c.name==='urn-group'||c.name==='stack-group')&&rng()<.55){c.done=true;return;}
  if(room&&rng()<.4&&(c.name==='urn-group'||c.name==='pedestal'||big)){c.done=true;return;}
  if(!room&&c.name==='pedestal'&&rng()<.35)c.done=true;
}
function propGravePosts(c){if(cpOn()&&c.name==='grave-post'){c.name='pedestal';c.extra=Object.assign({},c.extra||{},{cp:true,set:false,top:'none',seed:(c.x*13+c.y*7)%97});}}
function propCryptTombs(c){
  if(!cpOn()||c.extra&&c.extra.cp)return;
  var mapped=CRYPT_PROP[c.name]||c.name,x=c.x,y=c.y;
  if(mapped==='sarcophagus'||mapped==='sarcophagus-open'||mapped==='coffin'){
    var kind=mapped==='sarcophagus-open'?'open':rng()<.3?'cracked':'intact';
    var horiz=inb(x+1,y)&&freeCell(x+1,y)&&!nearDoor(x+1,y),vert=inb(x,y+1)&&freeCell(x,y+1)&&!nearDoor(x,y+1),piece;
    if(horiz&&(!vert||rng()<.5))piece=addSetPiece(x,y,'sarc',2,1,{cp:true,kind:kind,horiz:true,seed:Math.floor(rng()*97)});
    else if(vert)piece=addSetPiece(x,y,'sarc',1,2,{cp:true,kind:kind,horiz:false,seed:Math.floor(rng()*97)});
    if(piece){c.done=true;c.result=piece;return;}
    c.name='pedestal';c.extra={cp:true,top:rng()<.5?'skull':'none',seed:Math.floor(rng()*97)};
  }else if(mapped==='grave-pillar'){c.name='pedestal';c.extra=Object.assign({cp:true,top:rng()<.6?'skull':'none',seed:Math.floor(rng()*97)},c.extra||{});}
}
function propCrateStacks(c){
  if(inCrypt()||floorMeta&&floorMeta.plane||!['crate','barrel','pot'].includes(c.name)||c.extra&&c.extra.pattern!==undefined)return;
  var name=c.name;c.name='stack-group';c.extra=Object.assign(stackGroupExtra(name),c.extra||{});
  c.after.push(function(p){if(p&&name==='pot'){p.burn=0;p.sfx='pot-break';}});
}
function propUrnGroups(c){var mapped=CRYPT_PROP[c.name]||c.name;if(cryptRoomsOn()&&mapped==='urn'&&!(c.extra&&c.extra.pattern!==undefined)){c.name='urn-group';c.extra=Object.assign(urnGroupExtra(),c.extra||{});}}
function propCryptMushrooms(c){
  if(c.name!=='mushrooms'||!cryptShrooms()||c.extra&&c.extra.keep)return;
  if(inb(c.x,c.y)&&at(c.x,c.y)===FLOOR)blob(c.x,c.y,ri(4,9),function(x,y){if(at(x,y)===FLOOR&&!gAt(x,y)&&!propAt(x,y))setG(x,y,G_GRASS);});c.done=true;
}
function propWispPosts(c){
  if(inCrypt()&&!(floorMeta&&floorMeta.plane)&&(c.name==='torch-stand'||c.name==='candelabra')&&!(c.extra&&c.extra.set)&&rng()<.35&&setArt('grave-post')){
    c.name='grave-post';c.extra=Object.assign({set:true,w:1,h:1,b:1,wisps:true,light:'#7CFFA0',dim:1},c.extra||{});
  }
}
function propCryptTheme(c){
  if(inCrypt()&&CRYPT_PROP[c.name]&&objArt('props',CRYPT_PROP[c.name]))c.name=CRYPT_PROP[c.name];
  var x=c.x,y=c.y,extra=c.extra;c.after.push(function(p){if(p&&p.name==='candelabra'&&inCrypt()&&!(extra&&extra.light)){p.violet=hash2(x,y,91)<.6;p.light=p.violet?'#B07CFF':'#7CFFA0';}});
}
var propCreation=FoteContent.props([
  {name:'deep-theme',prepare:propDeepTheme},{name:'crypt-pack',prepare:propCryptPack},{name:'cavern-theme',prepare:propCavernTheme},
  {name:'wall-beds',prepare:propBeds},{name:'wall-chains',prepare:propChains},{name:'dungeon-mushrooms',prepare:propDungeonMushrooms},
  {name:'tight-rooms',prepare:propTightRooms},{name:'grave-posts',prepare:propGravePosts},{name:'crypt-tombs',prepare:propCryptTombs},
  {name:'crate-stacks',prepare:propCrateStacks},{name:'urn-groups',prepare:propUrnGroups},{name:'crypt-mushrooms',prepare:propCryptMushrooms},
  {name:'wisp-posts',prepare:propWispPosts},{name:'crypt-theme',prepare:propCryptTheme}
],function(c){return createProp(c.x,c.y,c.name,c.extra);});
function addProp(x,y,name,extra){return propCreation.place({x:x,y:y,name:name,extra:extra});}
function placePreparedUrn(x,y,extra){return propCreation.place({x:x,y:y,name:'urn-group',extra:extra},'crypt-mushrooms');}

function spawn(kind,x,y,options){
  options=options||{};
  if(!options.skipDeep&&deepMobsOn()){
    if(DEEP_SWAP[kind])kind=DEEP_SWAP[kind];
    else if(!DEEP_GEN&&MONSTERS[kind]&&MONSTERS[kind].region!==undefined){var region=deepRegionAt(x,y);if(region>=0&&MONSTERS[kind].region!==region){var regional=deepPool(region);if(regional.length)kind=weightedMonster(regional);}}
  }
  if(CAVE_SWAP[kind]&&inCaverns())kind=CAVE_SWAP[kind];
  if(inCaverns()&&/^(goblin|archer|brute|shaman)$/.test(kind)){
    var pool=caveRoster().filter(function(p){return !MONSTERS[p[0]].boss;});
    if(pool.length)kind=kind==='brute'?pool.slice().sort(function(a,b){return MONSTERS[b[0]].hp-MONSTERS[a[0]].hp;})[0][0]:pool[Math.floor(rng()*pool.length)][0];
  }
  if(inCrypt()&&CRYPT_SWAP[kind])kind=CRYPT_SWAP[kind];
  return spawnRaw(kind,x,y);
}
function deepSpawnRaw(kind,x,y){return spawn(kind,x,y,{skipDeep:true});}

/* Geometry selects its biome implementation explicitly. */
function roomAt(x,y){var grid=floorMeta&&floorMeta.caveRoom;return grid&&grid.length===MW*MH?findCaveRoom(x,y):findRectangularRoom(x,y);}
function edgeCells(room){return room&&room.cave?caveEdgeCells(room):rectangularEdgeCells(room);}
function interiorCells(room){return room&&room.cave?caveInteriorCells(room):rectangularInteriorCells(room);}
function caveLayout(){return bidx()===3&&!(floorMeta&&floorMeta.plane)?deepLayout():generateCavernLayout();}
function carveDeadEnd(room){
  if(inDeep()&&room){var passage=carveDeepPassage(room);if(passage)return passage;}
  return room&&room.cave?null:carveRectangularPassage(room);
}
function buildBossRoom(room){
  if(inDeep()&&room&&room.hall)return buildDeepHall(room);
  if(inCaverns()&&room&&room.cave)return buildCaveArena(room);
  return buildDungeonBossRoom(room);
}
function buildSpecial(kind,room){
  var deep=inDeep(),region=room.region||0;
  if(deep&&/^(garden|library|nest|statues|storage|prison)$/.test(kind)&&(region!==0||/^(garden|nest)$/.test(kind))){room.special=kind==='nest'?'nest-deep':kind;deepThemeRoom(room,true);return;}
  buildDefaultSpecial(kind,room);
  if(kind==='storage'&&inCrypt()&&!(floorMeta&&floorMeta.plane))buildUrnChamber(room);
  if(deep&&kind==='sacrifice'){
    var altar=props.filter(function(p){return p.name==='altar-spikes'&&p.x===room.cx&&p.y===room.cy;})[0];
    if(altar&&at(room.cx+1,room.cy)===FLOOR&&!propAt(room.cx+1,room.cy)){removeProp(altar);addSetPiece(room.cx,room.cy,'drow-altar-blood',2,1,{keep:true,altar:1,deep:1});}
  }
}
function buildUrnChamber(room){placeUrnChamber(room);decorateUrnChamber(room);}
function buildSigilRoom(kind){placeSigilRoom(kind);finishSigilRoom(kind);}
function populateSpecialMonsters(){
  if(!floorMeta.boss||!(inCrypt()||inCaverns()||inDeep()))return populateRoomResidents();
  var halls=rooms.filter(function(room){return room.role==='boss';}),first=halls[0];
  if(inDeep()){
    halls.forEach(function(room){room.role='boss-deep';});
    try{populateRoomResidents();if(floorMeta.bossArena)spawnMatron(floorMeta.bossArena);}
    finally{halls.forEach(function(room){room.role='boss';});}
    if(!floorMeta.matron)spawnMatron(floorMeta.bossArena||null);
  }else if(inCaverns()){
    halls.forEach(function(room){room.role='boss-cave';});populateRoomResidents();
    if(first)first.role='boss';if(floorMeta.bossArena)spawnDeepMaw(floorMeta.bossArena);
  }else{
    halls.forEach(function(room){room.role='boss-crypt';});populateRoomResidents();populateCryptGuardian(first);
  }
}
