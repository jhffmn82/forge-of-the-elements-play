/* Terrain, sight, and concealment rules. Rendering consumes these results. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FoteGeometry=api;})(globalThis,function(){
  'use strict';
  // Explicit collision size; legacy `big` sprites may still own proxy limbs.
  function bodySize(entity){return Math.max(1,Math.floor(entity&&entity.base&&entity.base.footprint||1));}
  function bodyContains(entity,x,y){var n=bodySize(entity);return !!entity&&x>=entity.x&&y>=entity.y&&x<entity.x+n&&y<entity.y+n;}
  function bodyPoint(entity,toward){var n=bodySize(entity);return {x:Math.max(entity.x,Math.min(entity.x+n-1,toward.x)),y:Math.max(entity.y,Math.min(entity.y+n-1,toward.y))};}
  function bodyDistance(a,b){var an=bodySize(a),bn=bodySize(b);return Math.max(0,a.x-b.x-bn+1,b.x-a.x-an+1,a.y-b.y-bn+1,b.y-a.y-an+1);}
  function bodyIntersects(entity,tiles){return tiles.some(function(p){return bodyContains(entity,Array.isArray(p)?p[0]:p.x,Array.isArray(p)?p[1]:p.y);});}
  // Tiny bodies can be aimed at, but do not intercept a shot aimed beyond them.
  function projectileBlocker(entity){var body=entity&&entity.parent||entity;return !!body&&!(body.base&&body.base.tiny);}
  function teleportAllowed(origin,destination,context){
    return Number.isInteger(destination.x)&&Number.isInteger(destination.y)&&context.inBounds&&context.visible&&context.walkable&&!context.occupied&&
      bodyDistance(origin,destination)>0&&bodyDistance(origin,destination)<=context.range;
  }
  function terrain(t){
    var floors=new Set([t.floor,t.open,t.stairs,t.rubble,t.water,t.bridge]);
    var walls=new Set([t.wall,t.door,t.locked,t.iceDoor,t.thorns,t.secret,t.sealed,t.toll]);
    function walkable(tile,blocked,exitOpen){if(tile===t.upstairs||tile===t.portal)return true;return!!(floors.has(tile)||tile===t.exit&&exitOpen)&&!blocked;}
    function passable(tile,blocked,exitOpen){return walkable(tile,blocked,exitOpen)||tile===t.door||tile===t.chest;}
    function opaque(tile,grass,cryptMushrooms,pillar){
      // Crypt mushrooms remain transparent even when a pillar shares the tile.
      if(cryptMushrooms&&grass&&!walls.has(tile))return false;
      return walls.has(tile)||!!grass||!!pillar;
    }
    return Object.freeze({walkable:walkable,passable:passable,opaque:opaque});
  }
  function radius(requested,view){
    var result=requested;
    if(view.shadowPlane)result=view.snuffed?2:view.moonlight?8:5;
    else if(view.snuffed)result=Math.min(result||9,2);
    if(view.darkTrapRoom)result=1;
    result=result||9;
    if(view.darkRoom&&!view.lightAffinity&&!view.fireAffinity)result=2;
    return result;
  }
  // Integer cell-center rays. At an exact half-cell tie either rasterization
  // is valid; prefer the one clear of terrain, instead of rounding toward the
  // shooter. Canonical endpoint order makes the choices reciprocal.
  function traceLine(from,to,blocked){
    var dx=Math.abs(to.x-from.x),dy=Math.abs(to.y-from.y),horizontal=dx>=dy,steps=Math.max(dx,dy);
    if(!steps)return {path:[],clear:true};
    var reverse=horizontal?from.x>to.x:from.y>to.y,a=reverse?to:from,b=reverse?from:to;
    var minor=horizontal?b.y-a.y:b.x-a.x,sign=minor<0?-1:1,span=Math.abs(minor),ties=false;
    function ray(upper){
      var cells=[];
      for(var i=0;i<=steps;i++){
        var twice=2*span*i,remainder=twice%(2*steps),offset=Math.floor(twice/(2*steps));
        if(remainder===steps){ties=true;if(upper)offset++;}else if(remainder>steps)offset++;
        cells.push(horizontal?{x:a.x+i,y:a.y+sign*offset}:{x:a.x+sign*offset,y:a.y+i});
      }
      if(reverse)cells.reverse();
      var path=[];
      for(var j=1;j<cells.length;j++){
        var p=cells[j],previous=cells[j-1];
        // Two touching blockers seal a diagonal, as they do for movement.
        if(p.x!==previous.x&&p.y!==previous.y&&blocked(p.x,previous.y)&&blocked(previous.x,p.y)){
          path.push({x:p.x,y:previous.y});return {path:path,clear:false};
        }
        path.push(p);if(blocked(p.x,p.y))return {path:path,clear:false};
      }
      return {path:path,clear:true};
    }
    var first=ray(false);if(first.clear||!ties)return first;
    var second=ray(true);
    return second.clear||second.path.length>first.path.length?second:first;
  }
  function cast(view,radius,options){
    var width=view.width,height=view.height,vis=view.vis,seen=view.seen,cx=view.x,cy=view.y,origin={x:cx,y:cy};
    var adjacent=!!(options&&options.adjacentOnly);if(adjacent)radius=1;
    vis.fill(0);vis[cy*width+cx]=1;seen[cy*width+cx]=1;
    // A turn casts only the local sight circle. Use the targeting ray for each
    // tile so a half-cell tie cannot disagree with detection or aiming.
    for(var y=Math.max(0,cy-radius);y<=Math.min(height-1,cy+radius);y++)for(var x=Math.max(0,cx-radius);x<=Math.min(width-1,cx+radius);x++){
      if(!adjacent&&(x-cx)*(x-cx)+(y-cy)*(y-cy)>radius*radius)continue;
      var destination={x:x,y:y};
      // The first wall is visible; opaque terrain beyond it is not.
      if(traceLine(origin,destination,function(bx,by){return (bx!==x||by!==y)&&view.opaque(bx,by);}).clear){
        vis[y*width+x]=1;seen[y*width+x]=1;
      }
    }
  }
  // A finite, centered strip through the chosen cell, clipped by the same
  // terrain rays used for sight. Preview, damage and ground effects share it.
  function beamTiles(from,to,context){
    var dx=to.x-from.x,dy=to.y-from.y,major=Math.max(Math.abs(dx),Math.abs(dy));
    if(!major)return [];
    var range=Math.max(0,Math.floor(context.range)),length=Math.hypot(dx,dy),halfWidth=(context.width-1)/2;
    var tiles=[],limit=range*length/major;
    for(var y=from.y-range;y<=from.y+range;y++)for(var x=from.x-range;x<=from.x+range;x++){
      if(!context.inBounds(x,y)||context.opaque(x,y))continue;
      var ox=x-from.x,oy=y-from.y,along=(ox*dx+oy*dy)/length,across=Math.abs(ox*dy-oy*dx)/length;
      if(along<=0||along>limit+1e-9||across>halfWidth+1e-9)continue;
      if(traceLine(from,{x:x,y:y},function(bx,by){return !context.inBounds(bx,by)||context.opaque(bx,by);}).clear)tiles.push([x,y]);
    }
    return tiles;
  }
  // A centered crosswise barrier. Rasterize its perpendicular direction,
  // retaining only legal cells; blocked cells never shift the chosen center.
  function barrierTiles(from,to,context){
    var dx=-(to.y-from.y),dy=to.x-from.x,major=Math.max(Math.abs(dx),Math.abs(dy));
    if(!major)return [];
    function nearest(n){return Math.sign(n)*Math.floor(Math.abs(n)+.5);}
    var tiles=[],half=Math.floor(context.length/2);
    for(var k=-half;k<=half;k++){
      var x=to.x+nearest(k*dx/major),y=to.y+nearest(k*dy/major);
      if(context.inBounds(x,y)&&context.canRaise(x,y))tiles.push([x,y]);
    }
    return tiles;
  }
  function mask(view,blocked){
    var inside=blocked[view.y*view.width+view.x];
    for(var i=0;i<view.vis.length;i++){
      if(!view.vis[i])continue;var x=i%view.width,y=(i/view.width)|0;
      if(Math.max(Math.abs(x-view.x),Math.abs(y-view.y))<=1)continue;
      if(inside||blocked[i])view.vis[i]=0;
    }
  }
  function revealRock(view){
    var add=[];
    for(var y=Math.max(0,view.y-12);y<=Math.min(view.height-1,view.y+12);y++)for(var x=Math.max(0,view.x-16);x<=Math.min(view.width-1,view.x+16);x++){
      var i=y*view.width+x;if(!view.vis[i]||view.wall(x,y))continue;
      for(var oy=-2;oy<=2;oy++)for(var ox=-2;ox<=2;ox++){var nx=x+ox,ny=y+oy;if(nx>=0&&ny>=0&&nx<view.width&&ny<view.height&&view.wall(nx,ny))add.push(ny*view.width+nx);}
    }
    add.forEach(function(i){view.vis[i]=1;view.seen[i]=1;});
  }
  function stealth(view){
    if(view.noisy||view.unsneaky)return 0;
    var value=.02*Math.max(0,view.agility-10);
    if(view.scoundrel)value+=.25;if(!view.moved)value+=.20;if(view.grass)value+=.25;if(view.darkRoom)value+=.25;
    if(view.weight==='medium')value-=.10;else if(view.weight==='heavy')value-=.25;
    value+=view.extra||0;return Math.max(0,Math.min(.9,value));
  }
  return Object.freeze({terrain:terrain,radius:radius,traceLine:traceLine,beamTiles:beamTiles,barrierTiles:barrierTiles,cast:cast,mask:mask,revealRock:revealRock,stealth:stealth,
    bodySize:bodySize,bodyContains:bodyContains,bodyPoint:bodyPoint,bodyDistance:bodyDistance,bodyIntersects:bodyIntersects,projectileBlocker:projectileBlocker,teleportAllowed:teleportAllowed});
});
