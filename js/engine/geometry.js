/* Terrain, sight, and concealment rules. Rendering consumes these results. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FoteGeometry=api;})(globalThis,function(){
  'use strict';
  var octants=[[1,0,0,1],[0,1,1,0],[0,-1,1,0],[-1,0,0,1],[-1,0,0,-1],[0,-1,-1,0],[0,1,-1,0],[1,0,0,-1]];
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
  function cast(view,radius){
    var width=view.width,height=view.height,vis=view.vis,seen=view.seen,cx=view.x,cy=view.y;
    function light(row,start,end,xx,xy,yx,yy){
      if(start<end)return;var newStart=start;
      for(var i=row;i<=radius;i++){
        var blocked=false;
        for(var dx=-i,dy=-i;dx<=0;dx++){
          var left=(dx-.5)/(dy+.5),right=(dx+.5)/(dy-.5);if(start<right)continue;else if(end>left)break;
          var x=cx+dx*xx+dy*xy,y=cy+dx*yx+dy*yy;if(x<0||y<0||x>=width||y>=height)continue;
          if(dx*dx+dy*dy<=radius*radius){vis[y*width+x]=1;seen[y*width+x]=1;}
          if(blocked){if(view.opaque(x,y)){newStart=right;continue;}blocked=false;start=newStart;}
          else if(view.opaque(x,y)&&i<radius){blocked=true;light(i+1,start,left,xx,xy,yx,yy);newStart=right;}
        }
        if(blocked)break;
      }
    }
    vis.fill(0);vis[cy*width+cx]=1;seen[cy*width+cx]=1;
    for(var i=0;i<octants.length;i++)light(1,1,0,octants[i][0],octants[i][1],octants[i][2],octants[i][3]);
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
  return Object.freeze({terrain:terrain,radius:radius,cast:cast,mask:mask,revealRock:revealRock,stealth:stealth});
});
