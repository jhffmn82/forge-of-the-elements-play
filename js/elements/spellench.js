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
  var values=enchantValues('weapon',ench),extra=0,note='',luck=context.hit&&context.hit.view&&context.hit.view.procLuck;
  var raw=context.rawDamage===undefined?d:context.rawDamage;
  var hit=FoteEnchantments.weaponHit(ench,values,raw,!!f.st.corrupt,function(chance){return pRoll(chance,luck);});
  extra=hit.damage;
  if(hit.status){
    if(hit.status.key==='chill'){var chill=addChill(f,{hit:context.hit});if(chill.applied)note=chill.key==='frozen'?'Frozen':'Chilled';}
    else if(applyStatus(f,hit.status.key,hit.status.duration,hit.status.key==='burn'?burnDmg():undefined).applied)
      note={burn:'Burning',root:'Rooted',corrupt:'Corrupted'}[hit.status.key];
  }
  if(hit.repeat){
    var type=FoteDamage.type(context.type||A&&A.type||'magic');
    applyDamage(f,raw,type,player,{tags:['proc','gust','enchant'],actionId:context.actionId,procLuck:luck,procAffinity:context.hit&&context.hit.view&&context.hit.view.aff});
  }
  if(hit.heal>0)hallowedEdge(values);
  if(extra>0){
    var type=ench==='fire'?'fire':'dark';
    var dealt=dealDirectDamage(f,Math.round(extra*resistMult(f,type)),type,player,{tags:['proc','enchant'],actionId:context.actionId,resistanceApplied:true});
    if(dealt>0&&type==='dark'&&aff('shadow')>=6)addHollow(f,1);
  }
  if(note&&f.hp>0)combatActionNote(f,note);
}
