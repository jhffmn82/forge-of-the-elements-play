/* The held weapon's enchant carries into single-target spells. Spell focuses
 * also retain their existing area-spell procs. Secondary packets never call
 * the hit hooks again, and use the original spell type and pre-defense damage. */
/* 2026-09-29 (Justin): Hallowed Edge. A Light weapon heals you 1 HP per Light point (at least 1) for every hit it
   makes, and for every spell it carries (above). It is an ordinary heal, so Rot halves it (rotHealing). */
function hallowedEdge(values){
  if(!player||player.hp<=0||player.hp>=player.maxhp||!(values.healPerHit>0))return;
  healPlayer(values.healPerHit);
}
function applySpellWeaponEnchant(f,d,crit,A,context){
  var w=player.weapon,ench=w&&w.enchant;
  if(!ench||!f||!(d>0))return;
  context=context||{};
  var singleTarget=context.singleTarget===undefined?!!(A&&A.kind==='bolt'&&!A.piercing):context.singleTarget;
  var k=itemKey(w);
  if(!singleTarget&&!(k==='staff'||k==='wand'||w.spell))return;
  var values=enchantValues('weapon',ench),extra=0,note='';
  var raw=context.rawDamage===undefined?d:context.rawDamage;
  if(ench==='fire'){
    extra+=Math.round(raw*values.extraDamage);
    if(pRoll(values.burnChance)&&applyStatus(f,'burn',values.burnDuration,burnDmg()).applied)note='Burning';
  }
  if(ench==='water'&&pRoll(values.chillChance)){var chill=addChill(f);if(chill.applied)note=chill.key==='frozen'?'Frozen':'Chilled';}
  if(ench==='earth'&&pRoll(values.rootChance)&&applyStatus(f,'root',values.rootDuration).applied)note='Rooted';
  if(ench==='air'&&pRoll(values.repeatChance)){
    var type=FoteDamage.type(context.type||A&&A.type||'magic');
    applyDamage(f,raw,type,player,{tags:['proc','gust','enchant'],actionId:context.actionId});
  }
  if(ench==='light')hallowedEdge(values);
  if(ench==='shadow'){
    if(f.st.corrupt)extra+=values.corruptDamage;   /* 2026-09-29 (Justin): Corrupted, was Hollowed */
    if(pRoll(values.procChance)){extra+=Math.round(raw*values.extraDamage);if(applyStatus(f,'corrupt',values.corruptDuration).applied)note='Corrupted';}
  }
  if(extra>0){
    var type=ench==='fire'?'fire':'dark';
    var dealt=dealDirectDamage(f,Math.round(extra*resistMult(f,type)),type,player,{tags:['proc','enchant'],actionId:context.actionId,resistanceApplied:true});
    if(dealt>0&&type==='dark'&&aff('shadow')>=6)addHollow(f,1);
  }
  if(note&&f.hp>0)log(f.name+': '+note+'.','c-good');
}
