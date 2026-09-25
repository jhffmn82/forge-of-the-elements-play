/* Authoritative character derivation. This module is pure: it reads explicit
 * actor/content inputs, returns fresh values, and never touches gear or the DOM. */
(function(root){
  'use strict';
  function rankOf(actor,content){
    if(!actor.god)return 0;
    var rank=1,thresholds=content.pietyRanks;
    for(var i=1;i<thresholds.length;i++)if((actor.piety||0)>=thresholds[i])rank=i+1;
    return Math.min(5,rank);
  }
  function passivesFor(stats,table){
    var found={};
    Object.keys(table).forEach(function(key){table[key].forEach(function(p){if(stats[key]>=p.at)found[p.id]=true;});});
    return found;
  }
  function itemKey(item){return item&&item.key||null;}
  function tierOf(item){return item&&typeof item.tier==='number'?Math.max(0,Math.min(3,item.tier)):1;}
  function upgradeValue(item,actor){
    return (item&&item.plus||0)+(item&&item.tier==='Trusty'?1:0)+(actor.race==='dwarf'&&item&&item.dmg&&!item.unarmed?1:0);
  }
  function ringBonuses(actor,content,multiplier){
    var result={};
    (actor.rings||[]).forEach(function(r){
      if(!r||!content.rings[r.ring])return;
      var power=content.gear.ringPower(r);
      result[r.ring]=(result[r.ring]||0)+content.rings[r.ring].step*power*multiplier;
    });
    return result;
  }
  function abilityList(actor,content){
    var cls=content.classes[actor.cls]||content.classes.fighter;
    var first=cls.ability==='invoke'?(actor.god?content.invokes[actor.god]:null):cls.ability;
    var result=first?[first]:[];
    Object.keys(actor.aff||{}).forEach(function(el){
      var tiers=content.elementAbilities[el]||{};
      for(var rank=2;rank<=6;rank++)if(actor.aff[el]>=rank&&tiers[rank]&&result.indexOf(tiers[rank])<0)result.push(tiers[rank]);
    });
    var extra=actor.cls==='fighter'?'charge':actor.cls==='scoundrel'?'shadowstep':null;
    if(extra&&result.indexOf(extra)<0)result.splice(1,0,extra);
    return result;
  }
  function computationContext(actor,content,weapon){
    var rank=rankOf(actor,content),options={vellumRank:actor.god==='vellum'?rank:0,anvilRank:actor.god==='anvil'?rank:0};
    var gearBonus=content.enchantments.gearBonus(options.vellumRank);
    var enchantBonus=content.enchantments.godBonus(options);
    var mountain=actor.god==='grom'&&rank>=5;
    weapon=weapon||(actor.sets||[])[actor.activeSet||0]||content.fists;
    var off=weapon.hands===2?null:actor.off;
    return {rank:rank,gearBonus:gearBonus,enchantBonus:enchantBonus,mountain:mountain,
      weapon:weapon,off:off,armor:actor.armorItem||{},
      divine:1+((weapon.cursed?0:weapon.divine||0)+(off&&!off.cursed?off.divine||0:0))*gearBonus,
      passives:passivesFor(actor.stats,content.passives),aff:actor.aff||{},buffs:actor.buffs||{},
      enchant:function(slot,el){return content.enchantments.values(slot,el,(actor.aff||{})[el]||0,options);}};
  }
  function baseStats(actor,content,c){
    var s=actor.stats,p=c.passives,w=c.weapon,o=c.off,a=c.armor;
    var race=content.races[actor.race]||content.races.human,cls=content.classes[actor.cls]||content.classes.fighter;
    function hp(n){return Math.max(1,Math.round(n*content.numberScale));}
    function damage(n){return Math.max(1,Math.round(n*content.numberScale*content.lethality));}
    var maxhp=hp((10+s.vit*(1+actor.level/5))*(p.tough?1.15:1));
    if(a.enchant==='fire')maxhp=Math.round(maxhp*(1+c.enchant('armor','fire').maxhp));
    var mana=Math.ceil(s.foc*(1+actor.level/5));
    if(actor.cls==='mage')mana=Math.ceil(mana*1.3);
    if(p.archmage)mana=Math.ceil(mana*1.2);
    if(o&&o.manaPct)mana=Math.ceil(mana*(1+o.manaPct*c.gearBonus));
    var evaPenalty=a.eva||0;if(evaPenalty<0&&actor.race==='dwarf')evaPenalty=0;
    var orb=o&&(o.icon||'').replace(/^item-/,'')==='orb'&&!o.cursed;
    var orbCrit=orb?((content.orbCrit.base[tierOf(o)]||0)+content.orbCrit.per*(o.plus||0))*c.gearBonus:0;
    var plus=upgradeValue(w,actor)+(actor.god==='anvil'?c.rank:0)+(c.buffs.temper>0?Math.round(2*c.divine):0)+(w.unarmed&&actor.god==='grom'?c.rank:0);
    return {name:actor.name||'Adventurer',who:race.name+' '+cls.name+(actor.god?' of '+content.gods[actor.god].name:''),
      weapon:w,twoHanded:w.hands===2,passives:p,abilities:abilityList(actor,content),speed:race.speed,maxhp:maxhp,maxmp:hp(mana),
      acc:60+2*s.agi+(w.acc||0)+(actor.god==='reginald'?4*c.rank:0)+(w.enchant==='light'?Math.round(c.enchant('weapon','light').accuracy):0),
      eva:10+2*s.agi+evaPenalty+(o&&o.eva||0)*c.gearBonus+(p.lightFeet?8:0)+(a.enchant==='water'?Math.round(c.enchant('armor','water').evasion):0),
      armor:(a.armor||0)+(a.armor>0?upgradeValue(a,actor):0)+(a.enchant==='earth'?Math.round(c.enchant('armor','earth').armor):0)+(actor.god==='grom'?c.rank:0)+(c.buffs.ironbody>0?Math.round(4*c.divine):0)+(c.buffs.ironhide>0?Math.round(5*c.divine):0),
      block:0,parry:o&&o.weapon?.08+s.agi/300:0,rangeBonus:actor.race==='elf'?1:0,
      crit:.06+.02*(s.agi-10)+(p.deadeye?.08:0)+(w.critBonus||0)*c.gearBonus+orbCrit+(p.archmage?.05:0),
      dmg:[damage(w.dmg[0])+plus,damage(w.dmg[1])+plus],
      element:actor.primary||Object.keys(c.aff)[0]||null,
      iceArmorMax:(c.aff.water||0)*3+((c.aff.earth||0)>=3&&(c.aff.water||0)>=2?3*(c.aff.earth||0):0)};
  }
  function equipmentStats(out,actor,content,c){
    var r=out.ringFx=ringBonuses(actor,content,c.gearBonus),a=c.armor,o=c.off,w=c.weapon;
    if(r.protection)out.armor=Math.max(0,out.armor+Math.round(r.protection));
    if(r.evasion)out.eva+=Math.round(r.evasion);
    if(r.accuracy)out.acc+=Math.round(r.accuracy);
    if(r.vitality)out.maxhp=Math.max(1,Math.round(out.maxhp*(1+r.vitality)));
    if(r.wizardry)out.maxmp=Math.max(1,Math.round(out.maxmp*(1+r.wizardry)));
    if(r.striking)out.dmg=out.dmg.map(function(n){return Math.max(1,n+Math.round(r.striking));});
    out.dmg=out.dmg.map(function(n){return Math.max(1,n);});
    if(r.haste)out.speed=Math.round(out.speed*(1+r.haste));
    if(actor.race==='dwarf'&&!w.unarmed&&itemKey(w)){
      var per=[1,tierOf(w)+1];if(w.hands===2)per=per.map(function(n){return Math.round(n*1.5);});
      out.dmg=[out.dmg[0]+per[0]-1,out.dmg[1]+per[1]-1];
    }
    if(itemKey(a)&&a.armor===0)out.armor+=Math.max(0,upgradeValue(a,actor));
    if(itemKey(a)==='robe')out.maxmp=Math.round(out.maxmp*(1+content.robe.mana[tierOf(a)]*c.gearBonus));
    if(o&&o.block>0){
      out.block=Math.min(.75,o.block+content.blockPer*(o.plus||0)+.02*Math.max(0,actor.stats.mig-10));
      if(o.enchant==='earth'&&out.block){var shield=c.enchant('shield','earth');out.block=Math.min(shield.blockCap,out.block+shield.block);}
    }
    if(o&&(o.icon||'').replace(/^item-/,'')==='tome'&&o.enchant==='water')out.eva+=Math.round(c.enchant('tome','water').evasion);
  }
  function conditionalStats(out,actor,content,c){
    if(c.buffs.cinder>0)out.speed=Math.round(out.speed*1.5);else if(c.buffs.haste>0)out.speed=Math.round(out.speed*1.3);
    out.guardMax=actor.cls==='fighter'?Math.max(3,Math.round(out.maxhp*.12)):0;
    if(actor.forgeHeat&&actor.forgeHeat.n>0){var heat=2*actor.forgeHeat.n;out.armor+=heat;out.dmg=out.dmg.map(function(n){return n+heat;});}
    if(actor.god==='grom'){
      out.armor+=c.rank;
      if(c.rank>=1)out.eva=Math.round(out.eva*(1+.10*c.rank));
      if(out.weapon.unarmed){
        if(c.rank>=1)out.parry=.08+actor.stats.agi/300;
        var f=content.gromFists[Math.min(5,c.rank)];
        function damage(n){return Math.max(1,Math.round(n*content.numberScale*content.lethality));}
        out.dmg=[out.dmg[0]-c.rank-damage(1)+damage(f[0]),out.dmg[1]-c.rank-damage(3)+damage(f[1])];
      }
      var mountain=actor.st&&actor.st.livingmountain;
      var stacks=c.mountain&&mountain&&mountain.t>0?Math.max(0,Math.min(10,mountain.n||0)):0;
      if(stacks){
        out.acc=Math.round(out.acc*(1+.02*stacks));out.eva=Math.round(out.eva*(1+.02*stacks));
        out.crit+=.02*stacks;
        out.dmg=out.dmg.map(function(n){return n+2*stacks;});
      }
    }
    if(actor.god==='reginald')out.crit+=.02*c.rank;
    out.luck=actor.god==='wobbles'?.03*c.rank:0;
    if(out.luck){out.crit+=out.luck;if(out.parry)out.parry+=out.luck;if(out.block)out.block=Math.min(.75,out.block+out.luck);}
    if(c.buffs.might>0)out.dmg=out.dmg.map(function(n){return Math.round(n*1.2);});
    if(c.buffs.temper>0)out.armor+=Math.round(4*c.divine);
    if(actor.race==='dwarf')out.armor++;
    out.affLevel=out.element?c.aff[out.element]:0;
    out.range=out.weapon.range?out.weapon.range+out.rangeBonus:1;
  }
  function compute(actor,content,options){
    var c=computationContext(actor,content,options&&options.weapon),out=baseStats(actor,content,c);
    equipmentStats(out,actor,content,c);
    conditionalStats(out,actor,content,c);
    return out;
  }
  function computeWithRanged(actor,content){
    var out=compute(actor,content),bow=actor.ranged;
    out.rangedDmg=out.rangedAcc=out.rangedCrit=null;
    if(bow&&bow.kind!=='off'&&(bow.range||0)>1){
      var shot=compute(actor,content,{weapon:bow});
      out.rangedDmg=shot.dmg;out.rangedAcc=shot.acc;out.rangedCrit=shot.crit;
      out.range=(bow.range||1)+out.rangeBonus;
    }
    return out;
  }
  var api={compute:compute,computeWithRanged:computeWithRanged,passivesFor:passivesFor,rankOf:rankOf};
  root.FoteStats=Object.freeze(api);
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
