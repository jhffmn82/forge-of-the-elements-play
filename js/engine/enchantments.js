/* Canonical enchant magnitudes and descriptions. Pure: no player, DOM or RNG.
 * Forge formulas and resolved item text read the same curves as combat/stats.
 * Multipliers apply once regardless of whether an eligible hit is a spell,
 * weapon attack or inherited summon proc. */
(function(root){
  'use strict';
  var elements=['fire','water','air','earth','light','shadow'];
  var damageTypes={fire:'fire',water:'ice',air:'lightning',earth:'poison',light:'light',shadow:'shadow'};
  function curve(base,per,extra){return Object.assign({base:base,per:per||0},extra);}
  function fixed(value){return curve(value,0,{amplify:false});}
  var rules={
    weapon:{
      fire:{extraDamage:curve(.10,.03),burnChance:curve(0,.05),burnDuration:fixed(3)},
      water:{chillChance:curve(.15,.05)},
      air:{repeatChance:curve(0,.05,{minimum:.05})},
      earth:{rootChance:curve(.15,.045),rootDuration:fixed(2)},
      light:{accuracy:curve(10,3,{round:true}),extraDamage:curve(.25)},
      shadow:{procChance:curve(0,.05,{minimum:.05}),extraDamage:curve(.25),hollowDamage:fixed(1),corruptDuration:fixed(3)}
    },
    armor:{
      fire:{maxhp:curve(.05,.03)},water:{evasion:curve(8,2.4,{round:true})},
      air:{deflect:curve(.05,.03)},earth:{armor:curve(1,.3,{round:true})},
      light:{hpRegen:curve(.5,.15)},shadow:{stealth:curve(0,.05,{minimum:.05})}
    },
    shield:{
      fire:{fire:curve(.25,.08),burn:curve(.15,.05),burnDuration:fixed(2)},
      water:{water:curve(.25,.10,{maximum:1})},
      air:{air:curve(.10,.05,{maximum:1}),knockback:fixed(1),stunDuration:fixed(1)},
      earth:{block:curve(.05,.03),blockCap:fixed(.75)},
      light:{light:curve(1,1,{round:true})},shadow:{shadow:curve(.15,.05,{maximum:1}),corruptDuration:fixed(3)}
    },
    orb:{
      fire:{burnDuration:fixed(2),fireDuration:fixed(2)},
      water:{iceArmor:curve(1,1,{round:true})},air:{stunDuration:fixed(1)},
      earth:{critChance:curve(.05,.03)},light:{mana:curve(3,.9,{round:true})},
      shadow:{critMultiplier:curve(.10,.05)}
    },
    tome:{
      fire:{spellPower:curve(.05,.03)},water:{evasion:curve(2,1,{round:true})},
      air:{castTimeReduction:curve(.02,.01)},earth:{resistance:curve(.02,.01)},
      light:{manaShield:curve(.10,.05),shieldCap:fixed(.30)},
      shadow:{killHeal:curve(0,.01,{minimum:.01})}
    },
    holy:{
      fire:{damageBonus:curve(.08,.024)},water:{manaRegen:curve(.15,.045)},
      air:{actionTimeReduction:curve(.05,.015)},earth:{damageReduction:curve(.05,.015,{maximum:.5})},
      light:{buffHeal:curve(.03,.009)},shadow:{critChance:curve(.03,.009)}
    }
  };
  elements.forEach(function(el){rules.armor[el].resistance=curve(.10,.05);});
  function finite(v){return Number.isFinite(v)?v:0;}
  function gearBonus(rank){return 1+.05*Math.max(0,finite(rank));}
  function godBonus(context){context=context||{};return gearBonus(context.vellumRank)*(1+.10*Math.max(0,finite(context.anvilRank)));}
  function scale(mastery,context){return (1+.3*Math.max(0,finite(mastery)))*godBonus(context);}
  function values(slot,element,mastery,context){
    var rule=rules[slot]&&rules[slot][element],out={};
    if(!rule)return out;
    var n=Math.max(0,finite(mastery)),g=godBonus(context);
    Object.keys(rule).forEach(function(key){
      var c=rule[key],value=c.base+c.per*n;
      if(c.minimum!==undefined)value=Math.max(c.minimum,value);
      if(c.amplify!==false)value*=g;
      if(c.maximum!==undefined)value=Math.min(c.maximum,value);
      if(c.round)value=Math.round(value);
      out[key]=value;
    });
    return out;
  }
  function cap(s){return s[0].toUpperCase()+s.slice(1);}
  function number(v){return String(Number(v.toFixed(6)));}
  function percent(v){return Math.round(v*100)+'%';}
  function formulaField(slot,el,key,isPercent){
    var c=rules[slot][el][key],unit=isPercent?'%':'',factor=isPercent?100:1;
    var text=c.base?number(c.base*factor)+unit:'';
    if(c.per)text+=(text?' +':'')+number(c.per*factor)+unit+' per '+cap(el)+' mastery';
    if(!text)text='0'+unit;
    if(c.minimum!==undefined)text+=' (minimum '+number(c.minimum*factor)+unit+')';
    return text;
  }
  function describe(slot,el,mastery,context,formula){
    if(!rules[slot]||!rules[slot][el])return '';
    context=context||{};
    var v=values(slot,el,mastery,context);
    function f(key,isPercent){return formula?formulaField(slot,el,key,isPercent):(isPercent?percent(v[key]):String(v[key]));}
    function pct(key){return f(key,true);}
    if(slot==='weapon'){
      if(el==='fire')return '+'+pct('extraDamage')+' of each hit as fire; '+pct('burnChance')+' chance to inflict Burning for '+v.burnDuration+' turns.';
      if(el==='water')return pct('chillChance')+' chance to Chill.';
      if(el==='air')return pct('repeatChance')+' chance of an instant extra attack, or an eligible spell landing twice.';
      if(el==='earth')return pct('rootChance')+' chance to Root for '+v.rootDuration+' turns.';
      if(el==='light')return '+'+f('accuracy')+' accuracy; +'+pct('extraDamage')+' damage to undead and shadow.';
      if(el==='shadow')return pct('procChance')+' chance of +'+pct('extraDamage')+' dark damage and Corrupt; +'+v.hollowDamage+' damage to Hollowed targets.';
    }
    if(slot==='armor'){
      var prefix='+'+pct('resistance')+' '+damageTypes[el]+' resistance; ';
      var bonus={fire:function(){return '+'+pct('maxhp')+' maximum HP.';},water:function(){return '+'+f('evasion')+' evasion.';},
        air:function(){return pct('deflect')+' ranged projectile deflection (excludes area effects).';},earth:function(){return '+'+f('armor')+' armor.';},
        light:function(){return '+'+pct('hpRegen')+' HP regeneration.';},shadow:function(){return '+'+pct('stealth')+' stealth.';}};
      return prefix+bonus[el]();
    }
    if(slot==='shield'){
      if(el==='fire')return 'Blocking burns the attacker for '+pct('fire')+' of the blow; '+pct('burn')+' chance to inflict Burning for '+v.burnDuration+' turns.';
      if(el==='water')return pct('water')+' chance to Chill a blocked attacker.';
      if(el==='air')return pct('air')+' chance to knock a blocked attacker back '+v.knockback+' tile and stun for '+v.stunDuration+' turn.';
      if(el==='earth')return '+'+pct('block')+' block chance ('+percent(v.blockCap)+' total cap).';
      if(el==='light')return 'Each block mends '+f('light')+' HP.';
      if(el==='shadow')return pct('shadow')+' chance to Corrupt a blocked attacker.';
    }
    if(slot==='orb'){
      if(el==='fire')return 'Critical hits ignite the target tile and inflict Burning for '+v.burnDuration+' turns'+(!formula&&Number.isFinite(context.burnDamage)?' ('+context.burnDamage+' damage per turn)':' (damage scales with Fire mastery)')+'.';
      if(el==='water')return 'Critical hits restore '+f('iceArmor')+' Ice Armor, up to your existing capacity.';
      if(el==='air')return 'Critical hits stun for '+v.stunDuration+' turn.';
      if(el==='earth')return '+'+pct('critChance')+' crit chance against Rooted targets.';
      if(el==='light')return 'Critical hits restore '+f('mana')+' mana.';
      if(el==='shadow')return '+'+pct('critMultiplier')+' crit damage multiplier.';
    }
    if(slot==='tome'){
      if(el==='fire')return '+'+pct('spellPower')+' spell power.';
      if(el==='water')return '+'+f('evasion')+' evasion.';
      if(el==='air')return pct('castTimeReduction')+' less casting time.';
      if(el==='earth')return '+'+pct('resistance')+' all elemental resistances.';
      if(el==='light')return pct('manaShield')+' of mana spent becomes a shield (up to '+(!formula&&Number.isFinite(context.maxhp)?Math.round(context.maxhp*v.shieldCap)+' HP':percent(v.shieldCap)+' of maximum HP')+').';
      if(el==='shadow')return 'Spell kills heal '+pct('killHeal')+' of maximum HP.';
    }
    if(slot==='holy'){
      if(el==='fire')return '+'+pct('damageBonus')+' damage while buffed.';
      if(el==='water')return '+'+pct('manaRegen')+' mana regeneration while buffed.';
      if(el==='air')return pct('actionTimeReduction')+' less action time while buffed.';
      if(el==='earth')return pct('damageReduction')+' less damage taken while buffed'+(formula?' (50% cap)':'')+'.';
      if(el==='light')return 'Gaining a buff heals '+pct('buffHeal')+' of maximum HP.';
      if(el==='shadow')return '+'+pct('critChance')+' crit chance while buffed.';
    }
    return '';
  }
  function formulaTable(){
    var table={};Object.keys(rules).forEach(function(slot){table[slot]={};elements.forEach(function(el){table[slot][el]=describe(slot,el,0,{},true);});});return table;
  }
  Object.keys(rules).forEach(function(slot){Object.keys(rules[slot]).forEach(function(el){Object.keys(rules[slot][el]).forEach(function(k){Object.freeze(rules[slot][el][k]);});Object.freeze(rules[slot][el]);});Object.freeze(rules[slot]);});Object.freeze(rules);
  var api=Object.freeze({rules:rules,values:values,describe:function(slot,el,mastery,context){return describe(slot,el,mastery,context,false);},
    formula:function(slot,el){return describe(slot,el,0,{},true);},formulaTable:formulaTable,gearBonus:gearBonus,godBonus:godBonus,scale:scale});
  root.FoteEnchantments=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
