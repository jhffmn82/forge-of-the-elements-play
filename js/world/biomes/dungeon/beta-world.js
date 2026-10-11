/* Beta 1.1 world interactions and precise area feedback. */
function puzzleAtDoor(x,y){return (floorMeta.puzzles||[]).find(function(r){return r.puzzle.door.x===x&&r.puzzle.door.y===y;});}


function addPuzzleSwitch(room){
 if(room.puzzle.switch)return;
 var cells=farFrom(pzCells(room).filter(function(c){return walkable(c.x,c.y)&&!propAt(c.x,c.y)&&!items.some(function(i){return i.x===c.x&&i.y===c.y;});}),room.puzzle.door);
 cells=cells.filter(function(c){return puzzlePropKeepsRewardsOpen(room,c);});
 if(!cells.length)return;var p=cells[0];addProp(p.x,p.y,'lever-up',{keep:true,lever:true,puzzleSwitch:true,roomDoor:room.puzzle.door});room.puzzle.switch={x:p.x,y:p.y};
}


function puzzleSpellTiles(A,tiles){
 (floorMeta.puzzles||[]).forEach(function(room){
  var touches=tiles.some(function(p){return roomAt(p[0],p[1])===room||(p[0]===room.puzzle.door.x&&p[1]===room.puzzle.door.y);});if(!touches)return;
  if((A.el==='fire'||A.type==='fire')&&room.puzzle.kind==='hoard'&&!room.puzzle.solved)solvePuzzle(room,'the frozen chamber thaws.');
  if((A.el==='fire'||A.type==='fire')&&room.puzzle.kind==='poisonvault'&&!room.puzzle.solved)solvePuzzle(room,'the fire burns away the poison gas.');
  if(A.el==='light'&&room.puzzle.kind==='darktraps'&&!room.puzzle.solved)solvePuzzle(room,'light reveals the hidden traps.');
  if(!room.puzzle.solved&&((room.burning&&(A.el==='water'||A.type==='ice'))||(room.puzzle.kind==='baths'&&(A.el==='poison'||A.type==='poison'))))solvePuzzle(room,room.burning?'the flames die away.':'the poison cools the scalding stone.');
 });
 if(A.el==='fire')tiles.forEach(function(p){burnWorld(p[0],p[1]);var prop=propAt(p[0],p[1]);if(prop&&prop.hoard){removeProp(prop);burst(p[0],p[1],'ice',16,.05);}});
 (floorMeta.puzzles||[]).forEach(function(room){if(room.puzzle.kind==='hoard'&&!room.puzzle.solved&&!props.some(function(p){return p.hoard&&roomAt(p.x,p.y)===room;}))solvePuzzle(room,'the last of the ice melts away.');});
}
/* Snapshot footprints before raising terrain so previews and damage agree. */
function glacialTombTiles(x,y){
 if(x===player.x&&y===player.y)return [[x,y]];
 var tiles=[];
 for(var ty=y-1;ty<=y+1;ty++)for(var tx=x-1;tx<=x+1;tx++)if(inb(tx,ty))tiles.push([tx,ty]);
 return tiles;
}
function upheavalWallTiles(x,y){
 return FoteGeometry.barrierTiles(player,{x:x,y:y},{length:7,inBounds:inb,canRaise:function(tx,ty){return at(tx,ty)===FLOOR&&!occupied(tx,ty)&&!itemAt(tx,ty)&&!propAt(tx,ty);}});
}
function upheavalImpactTiles(walls){
 var tiles=[],seenTiles=new Set();
 walls.forEach(function(w){for(var y=w[1]-2;y<=w[1]+2;y++)for(var x=w[0]-2;x<=w[0]+2;x++){
  if(!inb(x,y))continue;
  var key=idxOf(x,y);if(seenTiles.has(key))continue;seenTiles.add(key);tiles.push([x,y]);
 }});
 return tiles;
}
function effectFootprint(A,x,y,visibility){
 var out=[],r=A.radius||0,V=visibility||vis;
 if(A.kind==='tomb')return glacialTombTiles(x,y);
 if(A.kind==='upheaval')return upheavalImpactTiles(upheavalWallTiles(x,y));
 if(A.kind==='cone'){var ang=Math.atan2(y-player.y,x-player.x);for(var cy=player.y-6;cy<=player.y+6;cy++)for(var cx=player.x-6;cx<=player.x+6;cx++){if(!inb(cx,cy)||(cx===player.x&&cy===player.y)||!V[idxOf(cx,cy)])continue;var d=dist(player,{x:cx,y:cy});if(d>6)continue;var a=Math.atan2(cy-player.y,cx-player.x),diff=Math.abs(Math.atan2(Math.sin(a-ang),Math.cos(a-ang)));if(diff<=Math.PI/8+.12/d)out.push([cx,cy]);}return out;}
 if(A.kind==='beam'){var lance=typeof LANCE!=='undefined'&&A===LANCE,rules=lance?FoteActions.reginaldLance():null;return FoteGeometry.beamTiles(player,{x:x,y:y},{range:lance?rules.range:spellRange(A),width:lance?rules.width:3,inBounds:inb,opaque:opaque});}

 if(A.kind==='blast'||A.kind==='aoe'||A.kind==='quake'||A.kind==='lflame'){
  if(A.kind==='lflame')r=1;
  for(var yy=y-r;yy<=y+r;yy++)for(var xx=x-r;xx<=x+r;xx++)if(inb(xx,yy))out.push([xx,yy]);return out;
 }
 return [[x,y]];
}


function drawLastCastSurface(){var f=floorMeta.lastCastTiles;if(!f||f.until<performance.now())return;ctx.save();ctx.fillStyle='rgba(255,200,100,.18)';ctx.strokeStyle='rgba(255,220,145,.8)';f.tiles.forEach(function(p){if(sceneVisibility()[idxOf(p[0],p[1])]){var x=(p[0]-camX)*TS,y=(p[1]-camY)*TS;ctx.fillRect(x,y,TS,TS);ctx.strokeRect(x+2,y+2,TS-4,TS-4);}});ctx.restore();
}
function restorePuzzleState(){repairCryptPuzzleGuardians();repairCrystalVaultClaims();(floorMeta.puzzles||[]).forEach(function(room){if(['sentinels','sentries'].includes(room.puzzle.kind))addPuzzleSwitch(room);if(room.puzzle.kind==='barricade'&&!room.burning&&!room.puzzle.solved)setT(room.puzzle.door.x,room.puzzle.door.y,SEALED);});}
PUZZLE_KINDS.barricade.note='';
PUZZLE_KINDS.spikes.note='Spikes cover the floor. Stone skin would shrug them off; floating would carry you over.';
['sentinels','sentries','darktraps','library'].forEach(function(k){PUZZLE_KINDS[k].note='';});


function activatePuzzleSwitch(p){
 var room=puzzleAtDoor(p.roomDoor.x,p.roomDoor.y);if(!room||room.puzzle.disabled)return true;
 room.puzzle.disabled=true;room.puzzle.solved=true;p.used=true;var appearanceChanged=p.name!=='lever-down';p.name='lever-down';if(appearanceChanged)FoteContent.appearanceChanged(floorMeta);
 if(room.puzzle.kind==='library'){
  room.dark=false;
  ents=ents.filter(function(e){if(!e.libraryRoom||e.libraryRoom.x!==p.roomDoor.x||e.libraryRoom.y!==p.roomDoor.y)return true;burst(e.x,e.y,'light',16,.05);return false;});
  p.light='#FFE0A0';
 }
 props.forEach(function(o){if(roomAt(o.x,o.y)===room&&(o.sentinel||o.sentry)){o.sentinel=false;o.sentry=false;o.light=null;o.dim=true;}});
 ents=ents.filter(function(e){if(!e.sentinelRoom||e.sentinelRoom.x!==p.roomDoor.x||e.sentinelRoom.y!==p.roomDoor.y)return true;addProp(e.x,e.y,'statue',{keep:true,dim:true,guardianStatue:true});return false;});
 log('The guardians go still.','c-good');sfx('lever');computeFOV();endTurn();return true;
}

/* Named floor-content helpers; selected by content-adapter.js. */
function finishSigilRoom(kind){var room=(floorMeta.puzzles||[]).slice(-1)[0];if(!room||room.puzzle.kind!==kind)return;
 if(kind==='barricade'&&!room.burning)setT(room.puzzle.door.x,room.puzzle.door.y,SEALED);
 if(kind==='sentinels'||kind==='sentries')addPuzzleSwitch(room);
}
