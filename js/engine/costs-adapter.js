/* One timing owner for scheduled actors, actions, movement and character sheets. */
function actorTiming(actor){
  var isPlayer=actor===player,slow=actor.st&&actor.st.slow;
  return {player:isPlayer,speed:isPlayer?actor.speed:actor.base.speed,
    chill:actor.st&&actor.st.chill?chillSlow(actor):0,slow:slow?(slow.mult||SYLLA.slowMult):0};
}
function playerTiming(){
  var c=actorTiming(player),weapon=player.weapon||{},holy=infusion('holy')==='air'&&isBuffed();
  c.agility=player.stats.agi;c.divine=divineStrength();c.rank=godRank();c.grom=player.god==='grom';
  c.attacking=player.lastAttack;c.unarmed=weapon.unarmed;c.dagger=/Dagger/.test(weapon.name||'');
  c.rampage=buff('rampage')&&player.lastAttackMelee;c.hunter=player.wizardHunterUntil>player.t;
  c.casting=player.castingSpell;c.tomeReduction=infusion('tome')==='air'?enchantValues('tome','air').castTimeReduction:0;
  c.storm=player.stormUntil>player.t;c.holyAir=holy;c.holyReduction=holy?enchantValues('holy','air').actionTimeReduction:0;
  c.free=FREE_ACTION;c.freeStep=player.freeStep;c.fleet=hasP('fleet');c.air=player.aff.air||0;
  c.water=at(player.x,player.y)===WATER;c.levitate=player.levitate;
  return c;
}
function actCost(actor){return actor.shadowClone&&typeof FoteShadowClone!=='undefined'?FoteShadowClone.cost(actor):FoteCosts.action(actor===player?playerTiming():actorTiming(actor));}
function moveCost(){return FoteCosts.movement(playerTiming());}
/* Stable sheet values describe the next ordinary move/attack, not the last
 * command or a one-use free-action receipt. 100 time units = one global turn. */
function playerSpeedPercent(kind){
  var c=playerTiming();c.free=false;c.freeStep=false;c.casting=false;
  c.attacking=kind==='attack';c.rampage=!!buff('rampage')&&!((player.weapon||{}).range>1);
  var cost=kind==='move'?FoteCosts.movement(c):FoteCosts.action(c);
  return Math.round(10000/Math.max(1,cost))+'%';
}
function playerShield(){return FoteCosts.shields(player).reduce(function(sum,pool){return sum+pool.amount;},0);}
function shieldParts(){
  return FoteCosts.shields(player).filter(function(pool){return pool.amount>0;}).map(function(pool){
    if(pool.key==='guard')return 'Guard '+pool.amount+' of '+(player.guardMax||pool.amount)+', the Fighter footing that rebuilds out of combat';
    if(pool.key==='iceArmor')return 'Ice Armor '+pool.amount+' from Water affinity';
    return pool.name+' '+pool.amount;
  });
}

/* Receipts are transient command state, never inferred from a previous saved cost. */
var SPELL_PAYMENTS=new WeakMap();
function spendSpellMana(A){
  var cost=costOf(A);if(freeInvocation(A))cost=0;
  player.mp-=cost;player._actualSpellCost=cost;
  SPELL_PAYMENTS.set(player,{ability:A,cost:cost,eligible:!A.tech&&!A.divine,conducted:false});
  if(!A.tech)player.castingSpell=true;
  return cost;
}
function spellConduct(A){
  var receipt=SPELL_PAYMENTS.get(player);
  if(!receipt||receipt.ability!==A||!receipt.eligible||receipt.conducted)return false;
  receipt.conducted=true;player.castingSpell=true;player._lastSpellCost=receipt.cost;
  if(player.god==='vellum'){
    player.castTurn=turn;player.manaSpent=(player.manaSpent||0)+receipt.cost;
    while(player.manaSpent>=20){player.manaSpent-=20;gainPiety(1);}
  }
  if(infusion('tome')==='light'&&receipt.cost>0){
    var values=enchantValues('tome','light'),cap=Math.round(player.maxhp*values.shieldCap);
    player.mward=Math.min(cap,(player.mward||0)+receipt.cost*values.manaShield);
  }
  return true;
}
