/* Reconciled owner decisions from docs/recovered/grom-balance-discussion.md.
 * Helpers here are shared by previews, descriptions and runtime resolution. */
function chillSlow(e){var r=e.st&&e.st.chill&&e.st.chill.waterRank||0;return Math.min(.50,.33+(r>=3?.03*r:0));}

function wobbleBias(r){return r>=3?.05*(r-1):0;}
function combatRoll(chance,eligible){
  var ch=Math.max(0,Math.min(1,chance||0));if(rng()<ch)return true;
  if(eligible && player.buffs && player.buffs.luckystreak>0 && player.luckyTurn!==turn){player.luckyTurn=turn;return rng()<ch;}
  return false;
}
function pRoll(chance){return combatRoll((chance||0)+luckBonus(),true);}

if(typeof STATUS_INFO!=='undefined')STATUS_INFO.luckystreak={name:'Lucky Streak',icon:'ic-roll-dice',d:'Once a turn, your first failed roll in combat is rolled again.'};


function safeWobbleSpots(){
  if(activeBossEncounter())return []; // Do not teleport through sealed encounter geometry.
  var out=[];for(var y=0;y<MH;y++)for(var x=0;x<MW;x++)if(walkable(x,y)&&!occupied(x,y)&&at(x,y)!==WATER&&!(fireT&&fireT[idxOf(x,y)])&&!feats.some(function(f){return f.x===x&&f.y===y;})&&!ents.some(function(e){return e.foe&&e.hp>0&&dist(e,{x:x,y:y})<=1;}))out.push({x:x,y:y});return out;
}

function lastLaugh(){
  if(!capstone('wobbles')||player.hp>0||!RUN)return false;
  var id=floorNo+':'+(floorMeta.plane||'main');RUN.lastLaugh=RUN.lastLaugh||{};
  if(RUN.lastLaugh[id]||floorMeta.wobblesSaved)return false;
  RUN.lastLaugh[id]=true;floorMeta.wobblesSaved=true;player.hp=1;
  var result=Math.floor(rng()*3),spots=result===1?safeWobbleSpots():[];
  if(result===1 && spots.length){var s=pick(spots);player.x=s.x;player.y=s.y;player.hidden=3;computeFOV();log('<b>Last Laugh: Vanishing Act.</b>','c-good');}
  else if(result===2){player.ward=Math.round(player.maxhp*.5);player.buffs.arcaneward=10;log('<b>Last Laugh: Lucky Ward.</b>','c-good');}
  else {healPlayer(player.maxhp*.4);clearBad();log('<b>Last Laugh: Second Wind.</b>','c-good');}
  sfx('wobbles-giggle');return true;
}




// The servant's existing rank scaling is applied in castRaiseDead before it acts.

/* 2026-09-23 (Justin): Reginald's ladder is groups and range; the texts live in js/religion.js */

/* Sanctuary and Light mastery create the same Holy Ground. Power is captured
 * when cast; overlapping sources use the stronger field, never two bonuses. */
function holyGroundAt(x,y){
  if(!inb(x,y))return null;
  var now=typeof worldNow==='function'?worldNow():player.t,s=floorMeta.sanctuary,field=floorMeta.consecratedGround&&floorMeta.consecratedGround[idxOf(x,y)]||null;
  if(s&&s.until>now&&dist({x:x,y:y},s)<=3&&walkable(x,y)&&(!field||(s.power||divineStrength())>field.power))field={power:s.power||divineStrength(),damage:s.damage};
  var i=idxOf(x,y),cell=floorMeta.holyGround&&floorMeta.holyGround[i];
  if(typeof holyG!=='undefined'&&holyG&&holyG[i]){
    var light={power:cell&&cell.power||spellPower(),damage:cell&&cell.damage};
    if(!field||light.power>field.power)field=light;
  }
  if(field&&!(field.damage>=0))field.damage=Math.max(1,Math.round(sDMG(3+aff('light'))*field.power));
  return field;
}
function holyGroundStrength(e){var f=e&&(e===player||e.ally)&&holyGroundAt(e.x,e.y);return f?f.power:0;}
function inSanctuary(e){return holyGroundStrength(e)>0;}
function markHolyGround(x,y,power){
  if(!inb(x,y)||!walkable(x,y))return;
  if(!holyG)groundReset();
  var i=idxOf(x,y);holyG[i]=3;floorMeta.holyGround=floorMeta.holyGround||{};
  floorMeta.holyGround[i]={power:power,damage:Math.max(1,Math.round(sDMG(3+aff('light'))*power))};
}
function holyGroundPulse(){
  [player].concat(ents.filter(function(e){return e!==player;})).forEach(function(e){
    if(!e||e.hp<=0)return;var field=holyGroundAt(e.x,e.y);if(!field)return;
    if(e===player)healPlayer(e.maxhp*.02*field.power,true,{holyGround:true});
    else if(e.ally){var before=e.hp;e.hp=Math.min(e.maxhp,e.hp+e.maxhp*.02*field.power);gameDamage.emit('healingApplied',{target:e,restored:e.hp-before,natural:true});}
    else if(e.foe){var d=applyDamage(e,field.damage*((e.base.undead||e.base.shadowy)?2:1),'light',player,{tags:['periodic','holy-ground']});if(d>0)floatText(e.x,e.y,String(d),'light');if(e.hp<=0)kill(e,player);}
  });
}


// Recovered description specifies a direct hit but no base. Match Bone Spear's
// 10–16 base as a balance choice, separate from percentage-based Poison.
var VENOM_BURST={name:'Venom Burst',base:[10,16],kind:'aoe',type:'poison',divine:true,cost:0};


function drawSanctuarySurface(){
  if(!floorMeta)return;
  var cells=[];
  for(var y=Math.max(0,camY-1);y<Math.min(MH,camY+viewH+2);y++)for(var x=Math.max(0,camX-1);x<Math.min(MW,camX+viewW+2);x++){
    if(!vis[idxOf(x,y)]||!holyGroundAt(x,y))continue;
    cells.push(idxOf(x,y));
  }
  if(!cells.length)return;
  // Holy Ground is light falling onto the existing stone. Both sources share
  // this radiance; each affected tile has two fine shafts behind the creatures.
  var now=performance.now(),t=ANIM.reduce?0:now/1000;
  ctx.save();ctx.globalCompositeOperation='screen';
  drawFieldMist(cells,'#fff5dc',now,.12);
  cells.forEach(function(i){
    var x=i%MW,y=Math.floor(i/MW),seed=hash2(x,y,911),phase=t*.8+seed*6.28;
    var cx=(x-camX+.5)*TS,cy=(y-camY+.6)*TS,breath=ANIM.reduce?.82:.8+.12*Math.sin(phase);
    ctx.globalAlpha=breath;
    ctx.save();ctx.translate(cx,cy);ctx.scale(1,.62);
    var pool=ctx.createRadialGradient(0,0,0,0,0,TS*.78);
    pool.addColorStop(0,'rgba(255,252,235,.3)');pool.addColorStop(.42,'rgba(255,243,203,.18)');pool.addColorStop(1,'rgba(255,235,180,0)');
    ctx.fillStyle=pool;ctx.fillRect(-TS*.78,-TS*.78,TS*1.56,TS*1.56);ctx.restore();
    for(var beam=0;beam<2;beam++){
    var salt=beam*31,sx=cx+((beam-.5)*.38+(hash2(x,y,919+salt)-.5)*.18)*TS;
    var sy=cy+TS*(.04+hash2(x,y,921+salt)*.1),h=TS*(.5+hash2(x,y,923+salt)*.4),w=TS*(.045+hash2(x,y,927+salt)*.04);
    ctx.globalAlpha=breath;
    // A soft column carries the light; its fine inner ray fades before the top.
    ctx.save();ctx.translate(sx,sy-h*.38);ctx.scale(w,h*.6);
    var halo=ctx.createRadialGradient(0,.25,0,0,0,1);
    halo.addColorStop(0,'rgba(255,252,235,.26)');halo.addColorStop(.4,'rgba(255,246,212,.13)');halo.addColorStop(1,'rgba(255,239,190,0)');
    ctx.fillStyle=halo;ctx.fillRect(-1,-1,2,2);ctx.restore();
    var ray=ctx.createLinearGradient(sx,sy-h,sx,sy);
    ray.addColorStop(0,'rgba(255,253,240,0)');ray.addColorStop(.65,'rgba(255,253,240,.23)');ray.addColorStop(1,'rgba(255,253,240,.65)');
    ctx.strokeStyle=ray;ctx.lineWidth=Math.max(.9,TS*.017);ctx.beginPath();ctx.moveTo(sx,sy-h);ctx.lineTo(sx,sy);ctx.stroke();
    var rise=ANIM.reduce?.35:(t*.18+hash2(x,y,929+salt))%1;
    ctx.globalAlpha=breath*(.45+.35*Math.sin(rise*Math.PI));ctx.fillStyle='#fffdf1';ctx.beginPath();ctx.arc(sx,sy-h*rise,Math.max(.65,TS*.014),0,7);ctx.fill();
    }
  });ctx.restore();
}
