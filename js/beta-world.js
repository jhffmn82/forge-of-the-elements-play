/* Beta 1.1 world interactions and precise area feedback. */
function puzzleAtDoor(x,y){return (floorMeta.puzzles||[]).find(function(r){return r.puzzle.door.x===x&&r.puzzle.door.y===y;});}
var _betaBuildPuzzle=buildSigilRoom;
buildSigilRoom=function(kind){
 _betaBuildPuzzle(kind);var room=(floorMeta.puzzles||[]).slice(-1)[0];if(!room||room.puzzle.kind!==kind)return;
 if(kind==='barricade')setT(room.puzzle.door.x,room.puzzle.door.y,SEALED);
 if(kind==='sentinels'||kind==='sentries')addPuzzleSwitch(room);
};
function addPuzzleSwitch(room){
 if(room.puzzle.switch)return;
 var cells=farFrom(pzCells(room).filter(function(c){return walkable(c.x,c.y)&&!propAt(c.x,c.y)&&!items.some(function(i){return i.x===c.x&&i.y===c.y;});}),room.puzzle.door);
 if(!cells.length)return;var p=cells[0];addProp(p.x,p.y,'lever-up',{keep:true,puzzleSwitch:true,roomDoor:room.puzzle.door});room.puzzle.switch={x:p.x,y:p.y};
}
var _betaBumpProp=bumpProp;
bumpProp=function(p){
 if(!p.puzzleSwitch)return _betaBumpProp(p);
 var room=puzzleAtDoor(p.roomDoor.x,p.roomDoor.y);if(!room||room.puzzle.disabled)return true;
 room.puzzle.disabled=true;room.puzzle.solved=true;p.name='lever-down';
 props.forEach(function(o){if(roomAt(o.x,o.y)===room&&(o.sentinel||o.sentry)){o.sentinel=false;o.sentry=false;o.light=null;o.dim=true;}});
 ents=ents.filter(function(e){if(!e.sentinelRoom||e.sentinelRoom.x!==p.roomDoor.x||e.sentinelRoom.y!==p.roomDoor.y)return true;addProp(e.x,e.y,'statue',{keep:true,dim:true});return false;});
 log('The guardians go still.','c-good');sfx('lever');computeFOV();endTurn();return true;
};
var _betaBumpSealed=bumpSealed;
bumpSealed=function(x,y){var r=puzzleAtDoor(x,y);if(r&&r.puzzle.kind==='barricade'&&!r.puzzle.solved){if(aff('fire')>=3){solvePuzzle(r,'the timber burns away.');endTurn();}else{sfx('door-locked');log('The barricade blocks the doorway.','c-info');}return;}return _betaBumpSealed(x,y);};
var _betaSolve=solvePuzzle;
solvePuzzle=function(room,how){if(room.puzzle.kind==='barricade'){setT(room.puzzle.door.x,room.puzzle.door.y,OPEN);burst(room.puzzle.door.x,room.puzzle.door.y,'fire',24,.06);}return _betaSolve(room,how);};
var _betaBurnWorld=burnWorld;
burnWorld=function(x,y){var r=puzzleAtDoor(x,y);if(r&&r.puzzle.kind==='barricade'&&!r.puzzle.solved)solvePuzzle(r,'the timber burns away.');return _betaBurnWorld.apply(this,arguments);};
function puzzleSpellTiles(A,tiles){
 (floorMeta.puzzles||[]).forEach(function(room){
  var touches=tiles.some(function(p){return roomAt(p[0],p[1])===room||(p[0]===room.puzzle.door.x&&p[1]===room.puzzle.door.y);});if(!touches)return;
  if(A.el==='light'&&room.puzzle.kind==='darktraps'&&!room.puzzle.solved)solvePuzzle(room,'light reveals the hidden traps.');
  if((A.el==='water'||A.type==='ice')&&room.puzzle.kind==='baths'){room.puzzle.solved=true;room.cooledUntil=Number.MAX_SAFE_INTEGER;pzCells(room).forEach(function(p){if(at(p.x,p.y)===FLOOR)setT(p.x,p.y,WATER);});log('The scalding stone cools.','c-good');sfx('ice-melt');}
 });
 if(A.el==='fire')tiles.forEach(function(p){burnWorld(p[0],p[1]);var prop=propAt(p[0],p[1]);if(prop&&prop.hoard){removeProp(prop);burst(p[0],p[1],'ice',16,.05);}});
}
function effectFootprint(A,x,y){
 var out=[],r=A.radius||0;
 if(A.kind==='cone'){var ang=Math.atan2(y-player.y,x-player.x);for(var cy=player.y-6;cy<=player.y+6;cy++)for(var cx=player.x-6;cx<=player.x+6;cx++){if(!inb(cx,cy)||(cx===player.x&&cy===player.y)||!vis[idxOf(cx,cy)])continue;var d=dist(player,{x:cx,y:cy});if(d>6)continue;var a=Math.atan2(cy-player.y,cx-player.x),diff=Math.abs(Math.atan2(Math.sin(a-ang),Math.cos(a-ang)));if(diff<=Math.PI/8+.12/d)out.push([cx,cy]);}return out;}
 if(A.kind==='beam'){var dx=Math.sign(x-player.x),dy=Math.sign(y-player.y);if(!dx&&!dy)return out;var perp=dx&&dy?[[0,0],[dx,0],[0,dy]]:[[0,0],[-dy,dx],[dy,-dx]];perp.forEach(function(o){var bx=player.x+o[0],by=player.y+o[1];for(var k=0;k<6;k++){bx+=dx;by+=dy;if(!inb(bx,by)||opaque(bx,by))break;if(!out.some(function(p){return p[0]===bx&&p[1]===by;}))out.push([bx,by]);}});return out;}

 if(A.kind==='blast'||A.kind==='aoe'||A.kind==='quake'||A.kind==='lflame'){
  if(A.kind==='lflame')r=1;
  for(var yy=y-r;yy<=y+r;yy++)for(var xx=x-r;xx<=x+r;xx++)if(inb(xx,yy))out.push([xx,yy]);return out;
 }
 return [[x,y]];
}
var _betaPreview=previewPath;
previewPath=function(ax,ay,x,y,A){_betaPreview.apply(this,arguments);if(!['blast','aoe','lflame','cone','beam'].includes(A.kind))return;ctx.save();ctx.fillStyle='rgba(240,175,70,.20)';ctx.strokeStyle='rgba(255,205,110,.8)';effectFootprint(A,x,y).forEach(function(p){if(!vis[idxOf(p[0],p[1])])return;var px=(p[0]-camX)*TS,py=(p[1]-camY)*TS;ctx.fillRect(px,py,TS,TS);ctx.strokeRect(px+1,py+1,TS-2,TS-2);});ctx.restore();};
var _betaWorldCast=castAt;
castAt=function(x,y){var A=aiming&&aiming.A,before=turn,foot=A?effectFootprint(A,x,y):[];var result=_betaWorldCast(x,y);if(A&&turn!==before){var tiles=foot;puzzleSpellTiles(A,tiles);if(tiles.length>1)floorMeta.lastCastTiles={tiles:tiles,until:performance.now()+650};}return result;};
var _betaWorldSurface=drawSurfaceDeco;
drawSurfaceDeco=function(){_betaWorldSurface();var f=floorMeta.lastCastTiles;if(!f||f.until<performance.now())return;ctx.save();ctx.fillStyle='rgba(255,200,100,.18)';ctx.strokeStyle='rgba(255,220,145,.8)';f.tiles.forEach(function(p){if(vis[idxOf(p[0],p[1])]){var x=(p[0]-camX)*TS,y=(p[1]-camY)*TS;ctx.fillRect(x,y,TS,TS);ctx.strokeRect(x+2,y+2,TS-4,TS-4);}});ctx.restore();};
/* Apply native biome tuning once per hostile, preserving damage already taken in saves. */
function betaEnemyBalance(e){
 if(!e.foe||e.ally||e.beta11Balanced||floorMeta.plane)return;e.beta11Balanced=true;
 var b=Math.floor((floorNo-1)/5),extra=[1,2,0,3,0][b]||0;e.dmg=(e.dmg||e.base.dmg).map(function(v){return v+extra;});
 if(b===3){var max=e.maxhp;e.maxhp=Math.round(max*1.2);e.hp=e.hp>0?Math.max(1,e.hp+e.maxhp-max):0;}
}
var _betaWorldActors=worldRunActors;
worldRunActors=function(from,to){ents.forEach(betaEnemyBalance);return _betaWorldActors(from,to);};
var _betaWorldGenerate=generate;
generate=function(){var r=_betaWorldGenerate.apply(this,arguments);ents.forEach(betaEnemyBalance);return r;};
var _betaWorldSave=saveApply;
saveApply=function(){var r=_betaWorldSave.apply(this,arguments);ents.forEach(betaEnemyBalance);(floorMeta.puzzles||[]).forEach(function(room){if(['sentinels','sentries'].includes(room.puzzle.kind))addPuzzleSwitch(room);if(room.puzzle.kind==='barricade'&&!room.puzzle.solved)setT(room.puzzle.door.x,room.puzzle.door.y,SEALED);});return r;};
PUZZLE_KINDS.barricade.note='A timber barricade seals the doorway.';
PUZZLE_KINDS.spikes.note='Spikes cover the floor. Stone skin can withstand them; levitation can carry you above.';
['sentinels','sentries','darktraps','library'].forEach(function(k){PUZZLE_KINDS[k].note='';});
