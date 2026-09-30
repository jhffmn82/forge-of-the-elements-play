/* Responsive HUD composition. Layout and appearance use the existing game UI
   owners; no save loading, demo state or review controls belong in this module.
   The approved study* selectors remain stable for skins and screenshot tooling. */
var FoteResponsiveHUD=(function(){
  'use strict';
  var mounted=false,frame=0;
  const node=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=n=>Math.round(n||0).toLocaleString('en-US');
  const audioSymbol='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="study-sound-waves" d="M16 8c2 2 2 6 0 8m3-11c4 4 4 10 0 14"/><path class="study-sound-off" d="m16 9 6 6m0-6-6 6"/></svg>';
  function syncAudioButton(){
    if(!mounted)return;
    const button=node('bMute');if(!button)return;
    button.innerHTML=audioSymbol;button.classList.toggle('study-muted',AUDIO.muted);
    button.title=AUDIO.muted?'Audio off. Click to unmute.':'Audio on. Click to mute.';
    button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed',String(AUDIO.muted));
  }
  function syncSheet(){
    if(!mounted)return;
    node('studyNav').querySelectorAll('[data-p]').forEach(b=>{
      const on=b.dataset.p===openSheet;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));
    });
    positionSheet();
  }
  function positionSheet(){
    if(!mounted)return;
    const map=node('map').getBoundingClientRect(),phone=document.body.classList.contains('study-finger')&&!document.body.classList.contains('study-large-landscape');
    const right=document.body.classList.contains('study-pad-right');
    // Phone sheets cover the map and movement/log column, leaving abilities reachable.
    const x=phone&&right?0:map.left,width=phone?(right?map.right:innerWidth-map.left):map.width;
    const sheet=node('shade');
    sheet.style.setProperty('--sheet-x',x+'px');sheet.style.setProperty('--sheet-y',map.top+'px');
    sheet.style.setProperty('--sheet-w',width+'px');sheet.style.setProperty('--sheet-h',map.height+'px');
  }
  function classify(){
    if(!mounted)return;
    const w=innerWidth,h=innerHeight,inputOverride=new URLSearchParams(location.search).get('touch');
    const finger=inputOverride==='1'||(inputOverride!=='0'&&(window.MOBILE||navigator.maxTouchPoints>0||matchMedia('(pointer:coarse)').matches));
    const wide=w>h,large=wide&&h>=600&&w>=960;
    document.body.classList.toggle('study-finger',finger);
    document.body.classList.toggle('study-desktop',!finger);
    document.body.classList.toggle('study-wide',wide);
    document.body.classList.toggle('study-short',wide&&h<360);
    document.body.classList.toggle('study-large-landscape',large);
    document.body.classList.toggle('study-portrait',w<600&&!wide);
    document.body.classList.toggle('study-tablet',w>=600&&!wide);
    document.body.classList.toggle('study-pad-right',UI_SIDE==='right');
    document.body.classList.toggle('study-desktop-pad',!finger&&UI_DESKTOP_PAD);
    composeColumns(finger&&wide&&!large);
    document.documentElement.style.setProperty('--study-top',node('top').getBoundingClientRect().bottom+'px');
    resize();positionSheet();
  }
  function composeColumns(phone){
    const left=node('studyLeft'),right=node('studyRight'),hotbar=node('hotbar'),pad=node('dpad'),explore=node('studyExplore');
    const abilities=phone?left:right,movement=phone?right:left;
    // Move the existing controls only at a device breakpoint; retain their handlers and state.
    if(hotbar.parentElement!==abilities)abilities.append(hotbar);
    if(pad.parentElement!==movement)movement.append(pad);
    if(phone){
      if(explore.parentElement!==node('top'))node('top').insertBefore(explore,node('studyNav'));
    }else if(explore.parentElement!==movement)movement.insertBefore(explore,pad);
    left.setAttribute('aria-label',phone?'Player information and abilities':'Player information and movement');
    right.setAttribute('aria-label',phone?'Combat log and movement':'Combat log and abilities');
  }
  function relayout(){
    if(!mounted||frame)return;
    frame=requestAnimationFrame(()=>{frame=0;classify();if(typeof player!=='undefined'&&player){abilityBar();drawTerrainNow();}});
  }
  function mount(){
    if(mounted)return;
    const app=node('app');if(!app)return;
    document.body.classList.add('fote-study');
    // All legacy component styles have loaded. Geometry precedes the material skin.
    document.head.append(node('responsiveHudStyles'),node('forgeSkin'));
    const hud=document.createElement('div');hud.id='studyHud';app.append(hud);
    const readouts=document.createElement('div');readouts.id='studyReadouts';hud.append(node('bars'),readouts);readouts.append(node('hud2'));
    const left=document.createElement('aside');left.id='studyLeft';left.setAttribute('aria-label','Player information and movement');
    const right=document.createElement('aside');right.id='studyRight';right.setAttribute('aria-label','Combat log and abilities');
    app.append(left,right);left.append(hud,node('dpad'));right.append(node('log'),node('hotbar'));
    const position=document.createElement('span');position.className='study-position';
    const floor=document.createElement('span');floor.className='study-floor';floor.append('Floor ',node('hFloor'));
    const clock=document.createElement('span');clock.className='study-turn';clock.append('Turn ',node('hTurn'));
    position.append(floor,clock);const biome=node('hBiome');node('depth').replaceChildren(position,biome);
    const nav=document.createElement('nav');nav.id='studyNav';nav.setAttribute('aria-label','Game panels');
    for(const [label,panel,id] of [['Char','Char','studyChar'],['Gear','Equip','studyGear'],['Faith','Faith','studyFaith'],['Options','Help','studyOptions']]){
      const button=node('tabs').querySelector('[data-p="'+panel+'"]');
      button.type='button';button.id=id;button.textContent=label;nav.append(button);
    }
    nav.addEventListener('click',event=>{const button=event.target.closest('[data-p]');if(button)showSheet(button.dataset.p);});
    node('top').append(nav);nav.append(node('bMap'),node('bMute'));
    const explore=document.createElement('button');explore.id='studyExplore';explore.type='button';explore.textContent='Explore';
    left.insertBefore(explore,node('dpad'));bindExploreButton(explore);
    const hunger=document.createElement('button');hunger.id='studyHunger';hunger.type='button';hunger.className='study-hunger';
    hunger.innerHTML='<b id="studyHungerText"></b><span class="study-hunger-track"><i id="studyHungerFill"></i></span>';readouts.prepend(hunger);
    hunger.onclick=()=>showSheet('Equip');bindHudResourceCard(hunger,'hunger');
    const xp=node('xpBar');xp.setAttribute('role','button');xp.tabIndex=0;xp.onclick=()=>showSheet('Char');
    xp.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showSheet('Char');}};
    mounted=true;classify();syncAudioButtons();updateUI();
    window.addEventListener('resize',relayout);
    if(window.visualViewport)visualViewport.addEventListener('resize',relayout);
    new ResizeObserver(positionSheet).observe(node('map'));
    node('responsiveHudStyles').addEventListener('load',relayout);
    const firstVisibleLog=new ResizeObserver(()=>{if(node('log').clientHeight>0){node('log').scrollTop=node('log').scrollHeight;firstVisibleLog.disconnect();}});
    firstVisibleLog.observe(node('log'));
  }
  function renderReadouts(){
    if(!mounted||!player)return;
    const hungry=player.hunger<=0?'Starving':player.hunger<300?'Hungry':'Fed';
    node('studyHungerText').textContent=hungry;
    node('studyHungerFill').style.width=clamp(player.hunger/HUNGER_MAX*100,0,100)+'%';
    node('studyHungerFill').style.background=hungry==='Fed'?'#687b3e':'#b87a32';
    node('studyHunger').setAttribute('aria-label',hungry+'. Hunger '+num(player.hunger)+' / '+num(HUNGER_MAX));
    node('studyHunger').classList.toggle('study-starving',player.hunger<=0);
    node('xpBar').setAttribute('aria-label','Level '+player.level+'. XP '+num(player.xp)+' / '+num(player.xpNext));
    bindHudResourceCard(node('bars').querySelector('.hp'),'hp');
    bindHudResourceCard(node('bars').querySelector('.mp'),'mp');
    bindHudResourceCard(node('xpBar'),'xp');
    let faith='';
    if(player.god){
      const g=GODS[player.god],rank=godRank(),next=PIETY_RANKS[rank]||null,prev=PIETY_RANKS[rank-1]||0;
      const pct=next?clamp((player.piety-prev)/(next-prev),0,1)*100:100;
      const detail=g.name+', rank '+rank+'. Piety '+num(player.piety)+(next?' / '+num(next)+' for rank '+(rank+1):', maximum rank');
      faith='<button class="chip faithchip study-piety" data-study-panel="Faith" style="color:'+g.color+'" title="'+esc(detail)+'" aria-label="'+esc(detail)+'"><span class="gdot"></span><span class="rk">R'+rank+'</span><span class="meter"><i style="width:'+pct+'%;background:linear-gradient(90deg,'+hexA(g.color,.55)+','+g.color+')"></i></span></button>'+
        '<button class="chip faithchip study-favor" data-study-panel="Faith" title="Favor '+num(player.favor)+' / 100. Spent on your god\'s abilities." aria-label="Favor '+num(player.favor)+' / 100"><span class="rk">✦ '+num(player.favor)+'</span><span class="meter sm"><i style="width:'+clamp(player.favor,0,100)+'%;background:linear-gradient(90deg,#6B5A22,#E8D27A)"></i></span></button>';
    }
    const keys=(player.keys?.iron||0)+(player.keys?.crystal||0);
    const economy='<button class="chip study-stock" data-study-panel="Equip" title="Essence '+num(player.essence)+', keys '+keys+'" aria-label="Essence '+num(player.essence)+', keys '+keys+'"><span aria-hidden="true">◆</span><b>'+num(player.essence)+'</b>'+(keys?'<span class="study-key-icon" aria-hidden="true">🗝</span><b>'+keys+'</b>':'')+'</button>';
    const elements=['fire','water','earth','air','light','shadow'];
    const moteDetail=elements.map(k=>cap(k)+' '+num(player.motes[k])).join(', ');
    const motes='<button class="chip motechip study-motes" data-study-panel="Equip" title="Motes: '+moteDetail+'" aria-label="Motes: '+moteDetail+'">'+elements.map(k=>'<span class="study-mote" title="'+cap(k)+' motes: '+num(player.motes[k])+'"><i class="dot" style="background:'+AFF_COL[k]+'"></i><b>'+num(player.motes[k])+'</b></span>').join('')+'</button>';
    node('hud2').innerHTML=faith+'<div class="study-wallet">'+economy+motes+'</div>';
    node('hud2').querySelectorAll('[data-study-panel]').forEach(b=>b.onclick=()=>showSheet(b.dataset.studyPanel));
    bindHudResourceCard(node('hud2').querySelector('.study-piety'),'piety');
    bindHudResourceCard(node('hud2').querySelector('.study-favor'),'favor');
    bindHudResourceCard(node('hud2').querySelector('.study-stock'),'stock');
    bindHudResourceCard(node('hud2').querySelector('.study-motes'),'motes');
    const points=Math.max(0,Math.round(player.points||0));
    node('studyChar').innerHTML='<span>Char</span>'+(points?'<span class="study-points" aria-hidden="true">'+points+'</span>':'');
    node('studyChar').title=points?'Character: '+points+' unspent stat point'+(points===1?'':'s'):'Character';
    node('studyChar').setAttribute('aria-label',node('studyChar').title);
    node('studyGear').textContent='Gear';
    const amusement=node('studyAmusement');if(amusement)paintAmusement(amusement);
  }
  function paintAmusement(effect){
    const pct=clamp(Math.round(player.amusement||0),0,100);
    effect.style.setProperty('--amusement',pct+'%');effect.querySelector('.n').textContent=pct+'%';
    effect.setAttribute('aria-label','Amusement '+pct+' percent. Combat raises it; quiet drains it.');
  }
  function renderStatusMeter(){
    if(!mounted||!player||player.god!=='wobbles')return;
    const bar=node('statusbar');if(!bar)return;
    const existing=node('studyAmusement');if(existing){paintAmusement(existing);return;}
    const effect=document.createElement('button');effect.id='studyAmusement';effect.className='sico study-amusement-icon';effect.type='button';
    effect.innerHTML='<i class="study-amusement-fill"></i><img class="study-amusement-art" src="'+statusIconURL('pr-rolldice2')+'" alt="" aria-hidden="true"><span class="n"></span>';
    paintAmusement(effect);bar.prepend(effect);bindHudResourceCard(effect,'amusement');effect.onclick=()=>showSheet('Faith');
  }
  return Object.freeze({mount,renderReadouts,renderStatusMeter,syncAudioButton,syncSheet,relayout,isMounted:()=>mounted});
})();
FoteLifecycle.whenReady(FoteResponsiveHUD.mount);
