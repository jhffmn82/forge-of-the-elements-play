/* Reconciled owner decisions from docs/recovered/grom-balance-discussion.md.
 * Helpers here are shared by previews, descriptions and runtime resolution. */
function chillSlow(e){var r=e.st&&e.st.chill&&e.st.chill.waterRank||0;return Math.min(.50,.33+(r>=3?.03*r:0));}
RANK_TEXT[3].water='Deep Chill: Chill slows movement and actions by 33%, plus 3% per Water rank from rank 3 (maximum 50%). Immune to Chill and Freeze.';
RANK_TEXT[3].fire='Searing: +5% damage per Fire rank against Burning enemies. Immune to Burning.';
RANK_TEXT[3].earth='Venom: Earth Root applies Poison for 1 / 2 / 3 turns at Earth ranks 3 / 4 / 5+. Poison deals 10% max HP per turn, or 5% to bosses.';
RANK_TEXT[3].shadow='Fade: become Hidden after 10 / 8 / 6 / 4 consecutive unseen turns at Shadow ranks 3–6. Immune to Fear.';

var ARCANE_LANCE={name:'Arcane Lance',kind:'bolt',type:'magic',range:6,base:[10,16],cost:0,prayerSpell:true,icon:'ic-magic-missile'};


function castArcaneLance(x,y){
 if(dist(player,{x:x,y:y})>6||!inb(x,y)||!vis[idxOf(x,y)]||!canPray('arcanelance'))return false;
 var path=boltPath(player.x,player.y,x,y),p=path[path.length-1],target=p&&foeAt(p.x,p.y);if(!target||target.tomb>0)return false;
 aiming=null;spendDivineSpell(5);player.castTurn=turn;setClip(player,'cast');sfx('magic-missile');boltFx(player.x,player.y,target.x,target.y,'magic');
 if(combatRoll(hitChance(player.acc+10,evaOf(target)),true)){spellHit(target,ARCANE_LANCE,Math.round(roll(5*godRank(),5*godRank()+6)*divineStrength()),'magic');finishHit(target);}else floatText(target.x,target.y,'miss','miss');endTurn();return true;
}

function wobbleBias(r){return r>=3?.05*(r-1):0;}
function combatRoll(chance,eligible){
  var ch=Math.max(0,Math.min(1,chance||0));if(rng()<ch)return true;
  if(eligible && player.buffs && player.buffs.luckystreak>0 && player.luckyTurn!==turn){player.luckyTurn=turn;return rng()<ch;}
  return false;
}
function pRoll(chance){return combatRoll((chance||0)+luckBonus(),true);}

if(typeof STATUS_INFO!=='undefined')STATUS_INFO.luckystreak={name:'Lucky Streak',icon:'ic-pray',d:'Reroll the first failed qualifying combat roll once per turn.'};


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


RACES.dwarf.blurb='Sturdy masters of the forge. Weapon damage counts as +1, heavy armor costs no evasion, innate Armor is +1, and Forge upgrades cost 25% less.';


// The servant's existing rank scaling is applied in castRaiseDead before it acts.

/* 2026-09-23 (Justin): Reginald's ladder is groups and range; the texts live in js/religion.js */

/* Sanctuary and Light mastery create the same Holy Ground. Power is captured
 * when cast; overlapping sources use the stronger field, never two bonuses. */
function holyGroundAt(x,y){
  if(!inb(x,y))return null;
  var now=typeof worldNow==='function'?worldNow():player.t,s=floorMeta.sanctuary,field=null;
  if(s&&s.until>now&&dist({x:x,y:y},s)<=3&&walkable(x,y))field={power:s.power||divineStrength(),damage:s.damage};
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
    else if(e.ally)e.hp=Math.min(e.maxhp,e.hp+e.maxhp*.02*field.power);
    else if(e.foe){var d=applyDamage(e,field.damage*((e.base.undead||e.base.shadowy)?2:1),'light',player,{tags:['periodic','holy-ground']});if(d>0)floatText(e.x,e.y,String(d),'light');if(e.hp<=0)kill(e,player);}
  });
}


// Recovered description specifies a direct hit but no base. Match Bone Spear's
// 10–16 base as a balance choice, separate from percentage-based Poison.
var VENOM_BURST={name:'Venom Burst',base:[10,16],kind:'aoe',type:'poison',divine:true,cost:0};


function drawSanctuarySurface(){
  if(!floorMeta)return;
  ctx.save();ctx.strokeStyle='rgba(245,219,142,.55)';ctx.fillStyle='rgba(245,219,142,.06)';ctx.lineWidth=1;
  for(var y=Math.max(0,camY-1);y<Math.min(MH,camY+viewH+2);y++)for(var x=Math.max(0,camX-1);x<Math.min(MW,camX+viewW+2);x++){
    if(!vis[idxOf(x,y)]||!holyGroundAt(x,y))continue;
    var px=(x-camX)*TS,py=(y-camY)*TS;ctx.fillRect(px,py,TS,TS);
    ctx.beginPath();ctx.moveTo(px+TS*.4,py+TS*.5);ctx.lineTo(px+TS*.6,py+TS*.5);ctx.moveTo(px+TS*.5,py+TS*.4);ctx.lineTo(px+TS*.5,py+TS*.6);ctx.stroke();
  }ctx.restore();

}

function castArcaneNova(x,y){
 if(aiming&&aiming.prayer==='arcanenova'){
  if(!inRange(x,y)||!canPray('arcanenova'))return false;
  var A=aiming.A;aiming=null;spendDivineSpell(20);player.castTurn=turn;setClip(player,'cast');sfx('cast-generic');
  var prior=AOE_HIT;AOE_HIT=true;try{ents.slice().forEach(function(e){if(e.foe&&e.hp>0&&dist(e,{x:x,y:y})<=1){spellHit(e,A,Math.round(roll(5*godRank(),5*godRank()+8)*divineStrength()),'magic');finishHit(e);}});}finally{AOE_HIT=prior;}
  ringFx(x,y,'#7FA8FF',1.5);endTurn();return true;
 }
 return false;
}
