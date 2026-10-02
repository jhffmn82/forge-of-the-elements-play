/* Authored rare discoveries use ordinary rooms, secret pockets and actors. */
var HIDDEN_SIGIL_ROOMS=[
 [{id:'cartographer',name:"Cartographer's Nook",sigil:'mapping',props:['bookshelf','table-candle','bookshelf'],ground:'moss'},
  {id:'slime-chamber',name:'Slime Chamber',sigil:'ascension',slimes:true}],
 [{id:'cleansing-shrine',name:'Cleansing Shrine',sigil:'purify',props:['fountain','candles','statue'],ground:'moss'},
  {id:'embalmer-cell',name:"Embalmer's Cell",sigil:'rot',props:['alchemy-table','urn','bones'],ground:'bones'}],
 [{id:'fungal-pantry',name:'Fungal Pantry',sigil:'naturesbounty',props:['glow-mushrooms','kobold-crate','mushrooms'],ground:'grass'},
  {id:'petrified-shrine',name:'Petrified Shrine',sigil:'stoneskin2',props:['mossy-boulder','statue-broken','rune-stone-earth'],ground:'moss'}],
 [{id:'smuggler-hideout',name:"Smuggler's Hideout",sigil:'vanish2',props:['kobold-crate','bed-straw','table-candle'],ground:'moss'},
  {id:'folded-study',name:'Folded Study',sigil:'blink',props:['bookshelf','table-candle','crystal-violet'],ground:'moss'}]
];
function rareRunSeed(){return RUN&&Number.isFinite(RUN.seed)?RUN.seed:worldSeed;}
function rareFloorRoll(biome,salt,chance){
 if(bidx()!==biome||floorMeta.plane||floorMeta.boss)return -1;
 var event=mulberry32((rareRunSeed()^salt)>>>0);if(event()>=chance)return -1;
 var first=biome===0?2:biome*5+1,count=biome===0?3:4;return first+Math.floor(event()*count);
}
function hiddenSigilTheme(){
 var biome=bidx();if(biome>3||rareFloorRoll(biome,0x48494445^biome*7919,.10)!==floorNo)return null;
 var event=mulberry32((rareRunSeed()^0x53494749^biome*104729)>>>0);return HIDDEN_SIGIL_ROOMS[biome][Math.floor(event()*2)];
}
function uniqueRareKind(){
 if(rareFloorRoll(1,0x53504944,.05)===floorNo)return 'hungry-spider';
 if(rareFloorRoll(2,0x4C414D50,.05)===floorNo)return 'sealed-lamp';
 if(rareFloorRoll(3,0x57495A44,.05)===floorNo)return 'dark-wizard-library';
 return null;
}
function dressHiddenSigil(pk,spec){
 var r=pk.room,plan=specialRoomPlan(r),cells=plan.cells.slice().sort(function(a,b){return dist(b,pk.door)-dist(a,pk.door);});
 var prize=cells[0];if(!prize)return;
 r.hiddenSigil={id:spec.id,name:spec.name,sigil:spec.sigil,door:pk.door,tell:pk.inside,reward:{x:prize.x,y:prize.y}};
 items.push({x:prize.x,y:prize.y,kind:'sigil',use:spec.sigil});plan.reserve(prize);
 if(spec.slimes){r.slimeChamber=true;floorMeta.ooze=floorMeta.ooze||{};cells.forEach(function(c){floorMeta.ooze[idxOf(c.x,c.y)]=1;plan.reserved.add(idxOf(c.x,c.y));});}
 else{
  cells.forEach(function(c){setG(c.x,c.y,spec.ground==='bones'?G_BONES:spec.ground==='grass'?G_GRASS:G_MOSS);});
  var corners=cells.filter(function(c){return !plan.reserved.has(idxOf(c.x,c.y))&&!nearDoor(c.x,c.y)&&c!==prize;});
  (spec.props||[]).forEach(function(name){var c=corners.shift();if(c)plan.furniture(c,name,{keep:true});});
 }
 // Preserve all open cells through later biome dressing, not just the reward route.
 cells.forEach(function(c){if(!propAt(c.x,c.y))plan.reserved.add(idxOf(c.x,c.y));});plan.publish();
}
function buildUniqueRareRoom(kind,r){
 var plan=specialRoomPlan(r),cells=plan.cells.filter(function(c){return freeCell(c.x,c.y);}).sort(function(a,b){return plan.depth(b)-plan.depth(a);});
 if(!cells.length)return;r.rareEvent=kind;
 if(kind==='hungry-spider'){
  r.hungrySpider={post:cells[0]};plan.reserve(cells[0]);cells.forEach(function(c){setG(c.x,c.y,G_WEB);});
 }else if(kind==='sealed-lamp'){
  var c=cells[0];r.sealedLamp={x:c.x,y:c.y,released:false};items.push({x:c.x,y:c.y,kind:'relic',name:'Sealed Magic Lamp',rareLamp:r.id});plan.reserve(c);
  if(typeof FoteChaosEnemyArt!=='undefined')FoteChaosEnemyArt.sheet('m-chaos-prism-seer');
 }else{
  r.barracks=true;r.residentKinds=['drowpriestess'];r.residentCount=3;r.residentState='asleep';
  ['transmutation','wisdom','ascension'].forEach(function(use){var c=cells.shift();if(c){items.push({x:c.x,y:c.y,kind:'sigil',use:use});plan.reserve(c);}});
  r.residentPosts=cells.slice().reverse().filter(function(c){return !nearDoor(c.x,c.y);}).slice(0,3);
  r.residentPosts.forEach(function(c){plan.reserve(c);});
  var shelfCells=cells.filter(function(c){return !plan.reserved.has(idxOf(c.x,c.y));});
  for(var n=0;n<Math.min(6,shelfCells.length);n++)plan.furniture(shelfCells[n],n%3===2?'pillar':'bookshelf',{keep:true,pillar:n%3===2});
 }
 cells.forEach(function(c){if(!propAt(c.x,c.y))plan.reserved.add(idxOf(c.x,c.y));});plan.publish();
}
function rareRoomResidents(r){
 if(r.slimeChamber){for(var y=r.y;y<r.y+r.h;y++)for(var x=r.x;x<r.x+r.w;x++)if(walkable(x,y)&&!occupied(x,y)){var slime=spawnRaw('greenslime',x,y);slime.state='asleep';slime.guard=true;}return;}
 if(r.hungrySpider){var p=r.hungrySpider.post;if(walkable(p.x,p.y)&&!occupied(p.x,p.y)){var e=deepSpawnRaw('webspitter',p.x,p.y);e.name='Hungry Web Spitter';e.foe=false;e.ally=false;e.state='idle';e.hungrySpiderRoom=r.id;e.noLoot=true;e.noXp=true;r.hungrySpider.id=e.id;}}
}
function hungrySpiderAct(e){return e.hungrySpiderRoom!==undefined&&!e.foe&&!e.ally;}
function speakHungrySpider(e){if(!e||e.hp<=0)return;log('The spider says: &quot;Hungry... everything dead.&quot;','c-info');e.spokeHungry=true;}
function interactHungrySpider(e){
 if(!e||e.hp<=0||e.foe||e.ally)return false;speakHungrySpider(e);
 confirmBox('Hungry Web Spitter','The spider watches you without attacking.','Attack',function(){e.foe=true;e.state='hunt';e.spiderProvoked=true;attack(player,e);endTurn();});return true;
}
function rareRoomFoodDropped(it){
 if(it.kind!=='food'||it.food!=='ration')return false;var r=roomAt(it.x,it.y);if(!r||!r.hungrySpider)return false;
 var e=ents.find(function(e){return e.id===r.hungrySpider.id&&e.hp>0&&!e.foe&&!e.ally&&!e.spiderProvoked;});if(!e)return false;
 removeItem(it);e.ally=true;e.foe=false;e.state='ally';e.rarePet=true;e.t=player.t;RUN.rareSpiderPet=e;r.hungrySpider.fed=true;
 log('The spider eats the ration. It will follow you.','c-good');sfx('pickup-food');return true;
}
function rareSpiderDamaged(event){var e=event.target,src=event.source==='player'?player:event.source;if(event.damage>0&&e.hungrySpiderRoom!==undefined&&!e.ally&&(src===player||src&&src.ally)){e.foe=true;e.state='hunt';e.spiderProvoked=true;}}
function rareRoomPulse(){
 var pet=ents.find(function(e){return e.rarePet&&e.hp>0;});if(pet&&RUN)RUN.rareSpiderPet=pet;
 ents.forEach(function(e){if(e.hungrySpiderRoom!==undefined&&!e.ally&&!e.foe&&!e.spokeHungry&&vis[idxOf(e.x,e.y)])speakHungrySpider(e);});
}
function arriveRarePet(){
 var e=RUN&&RUN.rareSpiderPet;if(!e||e.hp<=0)return;
 var live=ents.find(function(o){return o.id===e.id&&o.rarePet;});if(live){RUN.rareSpiderPet=live;return;}
 var p=allyArrivalSpot(e);if(!p)return;e.x=p.x;e.y=p.y;e.t=player.t;e._lx=undefined;e._ly=undefined;e.ally=true;e.foe=false;e.state='ally';ents.push(e);
}
function releaseSealedLamp(it){
 var r=rooms.find(function(r){return r.id===it.rareLamp;});if(!r||!r.sealedLamp||r.sealedLamp.released)return false;
 var cells=specialRoomPlan(r).cells.filter(function(c){if(!freeCell(c.x,c.y)||dist(c,player)<2||nearDoor(c.x,c.y))return false;
  for(var y=c.y-3;y<=c.y+3;y++)for(var x=c.x-3;x<=c.x+3;x++)if([STAIRS,UPSTAIRS,EXIT,PORTAL].includes(at(x,y)))return false;return true;
 }).sort(function(a,b){return dist(a,it)-dist(b,it);});if(!cells.length){log('The lamp trembles, but its seal holds.','c-info');return false;}
 floorMeta.chaosIncursion=true;var c=cells[0],e=FoteChaosEnemies.spawn('chaos-prism-seer',c.x,c.y,{state:'hunt'});if(!e)return false;
 e.lastSeen={x:player.x,y:player.y};removeItem(it);r.sealedLamp.released=true;r.sealedLamp.demonId=e.id;
 log('The lamp shatters. A hostile Prism Seer tears free!','c-you');sfx('dark-cast');return true;
}

function repairRareRoomHints(){rooms.forEach(function(r){if(r.secretTell)setG(r.secretTell.x,r.secretTell.y,G_TELL);});}
