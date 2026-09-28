/* The held weapon's enchant carries into single-target spells. Spell focuses
 * also retain their existing area-spell procs. Secondary packets never call
 * the hit hooks again, and use the original spell type and pre-defense damage. */
function applySpellWeaponEnchant(f,d,crit,A,context){
  var w=player.weapon,ench=w&&w.enchant;
  if(!ench||!f||f.hp<=0||!(d>0))return;
  context=context||{};
  var singleTarget=context.singleTarget===undefined?!!(A&&A.kind==='bolt'&&!A.piercing):context.singleTarget;
  var k=itemKey(w);
  if(!singleTarget&&!(k==='staff'||k==='wand'||w.spell))return;
  var values=enchantValues('weapon',ench),extra=0,note='';
  var raw=context.rawDamage===undefined?d:context.rawDamage;
  if(ench==='fire'){
    extra+=Math.round(raw*values.extraDamage);
    if(pRoll(values.burnChance)){applyStatus(f,'burn',values.burnDuration,burnDmg());note=' burning';}
  }
  if(ench==='water'&&pRoll(values.chillChance)){addChill(f);note=' chilled';}
  if(ench==='earth'&&pRoll(values.rootChance)){applyStatus(f,'root',values.rootDuration);note=' rooted';}
  if(ench==='air'&&pRoll(values.repeatChance)){
    var type=FoteDamage.type(context.type||A&&A.type||'magic');
    var repeat=applyDamage(f,raw,type,player,{tags:['proc','enchant'],actionId:context.actionId});
    if(repeat>0){floatText(f.x,f.y,String(repeat),type,crit);log('<b>Gust.</b> The spell strikes again for <b>'+repeat+'</b> '+FoteDamage.label(type)+' damage.','c-good');}
    if(f.hp<=0){kill(f,player);return;}
  }
  if(ench==='shadow'){
    if(f.st.hollow)extra+=values.hollowDamage;
    if(pRoll(values.procChance)){extra+=Math.round(raw*values.extraDamage);applyStatus(f,'corrupt',values.corruptDuration);note=' corrupted';}
  }
  if(extra>0){
    var type=ench==='fire'?'fire':'dark';
    var dealt=dealDirectDamage(f,Math.round(extra*resistMult(f,type)),type,player,{tags:['proc','enchant'],actionId:context.actionId,resistanceApplied:true});
    if(dealt>0)floatText(f.x,f.y,String(dealt),type);
    if(dealt>0&&type==='dark'&&aff('shadow')>=6)addHollow(f,1);
    if(f.hp<=0)kill(f,player);
  }
  if(note&&f.hp>0)log('Your '+gearName(w)+' leaves it'+note+'.','c-good');
}
