/* Responsive HUD composition. Layout and appearance use the existing game UI
   owners; no save loading, demo state or review controls belong in this module.
   The approved study* selectors remain stable for skins and screenshot tooling. */
var FoteResponsiveHUD=(function(){
  'use strict';
  var mounted=false,frame=0,menuOpen=false,portraitRetry=0;
  const node=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=n=>Math.round(n||0).toLocaleString('en-US');
  const audioSymbol='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="study-sound-waves" d="M16 8c2 2 2 6 0 8m3-11c4 4 4 10 0 14"/><path class="study-sound-off" d="m16 9 6 6m0-6-6 6"/></svg>';
  const lineIcon=path=>'<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+path+'</svg>';
  function syncNavigation(){
    const explore=node('studyExplore'),map=node('bMap');
    explore.dataset.iconOnly=document.body.classList.contains('study-classic')?'false':'true';
    syncExploreButton(explore);
    bindHudResourceCard(explore,'explore');
    map.innerHTML=lineIcon('<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15"/>');
    map.setAttribute('aria-label','Map');
    bindHudResourceCard(map,'map');
    node('studyOptions').innerHTML=lineIcon('<path d="M4 6h3m4 0h9M4 12h9m4 0h3M4 18h3m4 0h9"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/>')+'<span>Options</span>';
    node('studyHistory').innerHTML=lineIcon('<path d="M5 5h14v14H5zM8 9h8m-8 3h8m-8 3h5"/>')+'<span>Combat log</span>';
  }
  const portraitImages=new Map();
  function paintPortrait(){
    if(!mounted||!player)return;
    const art=node('studyPortraitArt');if(!art)return;
    if(typeof FotePortraitAnimation!=='undefined'){FotePortraitAnimation.paint(art,player);return;}
    const look=String(player.look||'');
    if(!/^(human|elf|dwarf|gloomling|fae-(air|fire|water|earth))-[fm]$/.test(look))return;
    let image=portraitImages.get(look);
    if(!image){image=new Image();image.src='art/portraits/'+look+'.webp';image.alt='';image.setAttribute('aria-hidden','true');image.style.cssText='width:100%;height:100%;object-fit:contain;image-rendering:pixelated';portraitImages.set(look,image);}
    if(art.firstChild!==image||art.childNodes.length!==1)art.replaceChildren(image);
  }
  function roundedSectorPath(angle,outer,inner,spread){
    const start=(angle-spread)*Math.PI/180,end=(angle+spread)*Math.PI/180;
    const corner=Math.min(7,(outer-inner)/2,inner*spread*Math.PI/180*.85);
    const point=(radius,a)=>(50+radius*Math.cos(a)).toFixed(3)+' '+(50+radius*Math.sin(a)).toFixed(3);
    const outerStart=point(outer,start+corner/outer);
    return 'M '+outerStart+' A '+outer+' '+outer+' 0 0 1 '+point(outer,end-corner/outer)+
      ' Q '+point(outer,end)+' '+point(outer-corner,end)+' L '+point(inner+corner,end)+
      ' Q '+point(inner,end)+' '+point(inner,end-corner/inner)+' A '+inner+' '+inner+' 0 0 0 '+point(inner,start+corner/inner)+
      ' Q '+point(inner,start)+' '+point(inner+corner,start)+' L '+point(outer-corner,start)+
      ' Q '+point(outer,start)+' '+outerStart+' Z';
  }
  function styleDirectionButtons(){
    const directions={'7':['northwest',-45],'8':['north',0],'9':['northeast',45],'4':['west',-90],'6':['east',90],'1':['southwest',-135],'2':['south',180],'3':['southeast',135]};
    node('dpad').querySelectorAll('button[data-d]').forEach(button=>{
      const direction=directions[button.dataset.d];
      button.setAttribute('aria-label',direction?'Move '+direction[0]:'Wait and search');
      bindHudResourceCard(button,direction?'move:'+direction[0]:'search');
      button.classList.toggle('pad-diagonal',!!direction&&Math.abs(direction[1])%90===45);
      let sector='';
      if(direction){
        const angle=direction[1]-90,points=[];
        for(const [radius,start,end] of [[49,-21,21],[20,21,-21]])for(let i=0;i<=8;i++){
          const a=(angle+start+(end-start)*i/8)*Math.PI/180;points.push([(50+radius*Math.cos(a)).toFixed(3),(50+radius*Math.sin(a)).toFixed(3)]);
        }
        button.style.setProperty('--pad-sector','polygon('+points.map(p=>p[0]+'% '+p[1]+'%').join(',')+')');
        button.style.setProperty('--pad-symbol-x',(50+34*Math.cos(angle*Math.PI/180))+'%');
        button.style.setProperty('--pad-symbol-y',(50+34*Math.sin(angle*Math.PI/180))+'%');
        const diagonal=button.classList.contains('pad-diagonal');
        sector='<svg class="pad-sector" aria-hidden="true" viewBox="0 0 100 100"><path d="'+roundedSectorPath(angle,diagonal?46:49,diagonal?25:21,diagonal?16:21)+'"/></svg>';
      }
      button.innerHTML=sector+'<svg class="pad-symbol" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(direction?'2.7':'2')+'" stroke-linecap="round" stroke-linejoin="round">'+(direction?'<path transform="rotate('+direction[1]+' 12 12)" d="m7 14 5-5 5 5"/>':'<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/>')+'</svg>';
    });
  }
  function syncAudioButton(){
    if(!mounted)return;
    const button=node('bMute');if(!button)return;
    button.innerHTML=audioSymbol+'<span>Sound</span><small>'+(AUDIO.muted?'Off':'On')+'</small>';button.classList.toggle('study-muted',AUDIO.muted);
    button.title=AUDIO.muted?'Audio off. Click to unmute.':'Audio on. Click to mute.';
    button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed',String(AUDIO.muted));
    bindHudResourceCard(button,'sound');
  }
  function syncSheet(){
    if(!mounted)return;
    if(openSheet){setMenu(false);if(typeof FoteCombatLog!=='undefined')FoteCombatLog.hideHistory();}
    document.querySelectorAll('#studyNav [data-p],#studySheetTabs [data-p]').forEach(b=>{
      const on=b.dataset.p===openSheet;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));
    });
    node('shade').classList.toggle('study-character-panel',['Char','Equip','Faith','Help'].includes(openSheet));
    document.body.classList.toggle('study-sheet-open',!!openSheet);
    positionSheet();syncTouchControls();
  }
  function positionSheet(){
    if(!mounted)return;
    const map=node('map').getBoundingClientRect();
    const right=document.body.classList.contains('study-pad-right');
    const inset=8,hotbar=node('hotbar').getBoundingClientRect();
    let x=map.left+inset,y=map.top+inset,width=map.width-inset*2,height=map.height-inset*2;
    // Keep the same live hotbar usable beside an open sheet.
    if(document.body.classList.contains('study-hotbar-vertical')){
      if(right){x=Math.max(x,hotbar.right+inset);width=map.right-inset-x;}
      else width=Math.min(width,hotbar.left-inset-x);
    }else height=Math.min(height,hotbar.top-inset-y);
    const inventory=node('studyInventoryIcon');
    if(inventory&&inventory.parentElement===node('studyActionBar')){
      inventory.style.left='';inventory.style.top='';
    }else if(inventory){
      const bar=node('hotbar').getBoundingClientRect(),size=node('hotbar').querySelector('.slot')?.getBoundingClientRect().width||44;
      const vertical=document.body.classList.contains('study-hotbar-vertical');
      const gap=parseFloat(getComputedStyle(node('hotbar')).rowGap)||4;
      const ix=vertical?bar.left:bar.right+8;
      inventory.style.left=Math.max(8,Math.min(innerWidth-size-8,ix))+'px';
      inventory.style.top=Math.max(8,Math.min(innerHeight-size-8,vertical?bar.top-size-gap:bar.top))+'px';
    }
    const sheet=node('shade');
    sheet.style.setProperty('--sheet-x',x+'px');sheet.style.setProperty('--sheet-y',y+'px');
    sheet.style.setProperty('--sheet-w',Math.max(0,width)+'px');sheet.style.setProperty('--sheet-h',Math.max(0,height)+'px');
    positionRecentLog();
  }
  function positionRecentLog(){
    const recent=node('studyRecentLog');if(!recent)return;
    recent.style.width='';recent.style.maxHeight='';
    const style=getComputedStyle(recent),right=document.body.classList.contains('study-control-pad-left');
    const inset=parseFloat(style.getPropertyValue('--minimal-inset'))||8;
    const edge=parseFloat(right?style.right:style.left)||inset;
    const pad=node('dpad').getBoundingClientRect();
    let width=parseFloat(style.width)||Math.min(340,innerWidth-inset*2);
    if(document.body.classList.contains('study-overlay-pad')){
      const available=right?innerWidth-edge-pad.right-8:pad.left-edge-8;
      width=Math.min(width,Math.max(80,available));recent.style.width=width+'px';
    }
    const left=right?innerWidth-edge-width:edge,hud=node('studyHud').getBoundingClientRect();
    if(left<hud.right&&left+width>hud.left){
      recent.style.maxHeight=Math.max(40,innerHeight-(parseFloat(style.bottom)||inset)-hud.bottom-10)+'px';
    }
    recent.scrollTop=recent.scrollHeight;
  }
  function hasOverlay(){return menuOpen||document.body.classList.contains('study-log-history');}
  function setMenu(on,restoreFocus){
    hideCard();
    on=!!on;
    if(on){
      if(typeof stopTravel==='function')stopTravel();
      if(typeof stopRest==='function')stopRest();
      if(typeof FoteCombatLog!=='undefined')FoteCombatLog.hideHistory();
    }
    menuOpen=on;document.body.classList.toggle('study-menu-open',on);
    const button=node('studyMenuToggle'),top=node('top');
    if(button)button.setAttribute('aria-expanded',String(on));
    if(top){top.inert=!on&&!document.body.classList.contains('study-classic');top.setAttribute('aria-hidden',String(top.inert));}
    if(mounted)syncTouchControls();
    if(on)node('studyNav').querySelector('button').focus();else if(restoreFocus&&button)button.focus();
  }
  function bindMinimalControls(){
    node('studyMenuToggle').onclick=()=>{
      if(typeof openSheet!=='undefined'&&openSheet)showSheet(openSheet);
      setMenu(!menuOpen,true);
    };
    node('studyHistory').onclick=()=>{setMenu(false);FoteCombatLog.showHistory();node('studyLogClose').focus();};
    node('studyLogClose').onclick=()=>{FoteCombatLog.hideHistory();node('studyMenuToggle').focus();};
    node('studyPortrait').onclick=()=>showSheet('Char');
    node('studyStatPoints').onclick=()=>{showSheet('Char');node('studyChar').focus();};
    node('studyStatPoints').onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();node('studyStatPoints').click();}};
    node('studyInventoryIcon').onclick=()=>showSheet('Equip');
    node('studyPietyBar').onclick=()=>showSheet('Faith');
    window.addEventListener('keydown',event=>{
      if(!hasOverlay())return;
      if(event.key==='Escape'){
        event.preventDefault();event.stopImmediatePropagation();setMenu(false,true);FoteCombatLog.hideHistory();
      }else if(event.key==='Tab'&&menuOpen){
        const buttons=Array.from(node('studyNav').querySelectorAll('button')).filter(b=>!b.disabled);
        const first=buttons[0],last=buttons[buttons.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    },true);
    window.addEventListener('click',event=>{
      if(!hasOverlay())return;
      const target=event.target;
      if(target.closest('#studyMenuToggle')||menuOpen&&target.closest('#top')||!menuOpen&&target.closest('#log,#studyLogClose'))return;
      // The dismissing map/control tap must not also issue a game command.
      event.preventDefault();event.stopImmediatePropagation();setMenu(false,true);FoteCombatLog.hideHistory();
    },true);
  }
  function classify(){
    if(!mounted)return;
    const w=innerWidth,h=innerHeight,inputOverride=new URLSearchParams(location.search).get('touch');
    const finger=inputOverride==='1'||(inputOverride!=='0'&&(window.MOBILE||navigator.maxTouchPoints>0||matchMedia('(pointer:coarse)').matches));
    const wide=w>h,large=wide&&h>=600&&w>=960;
    // Fit smaller controls to short phone viewports, then grow with available room.
    // Use CSS pixels; DPR belongs to the painters rather than HUD sizing.
    const scale=finger&&!large
      ?Math.max(.8,Math.min(1.1,wide?w/800:w/430,wide?h/440:h/780))
      :Math.max(1,Math.min(1.5,w/960,h/600));
    document.body.style.setProperty('--study-interface-scale',String(Math.round(scale*1000)/1000));
    const classic=typeof uiHudMode==='function'&&uiHudMode()==='classic';
    document.body.dataset.uiHudMode=classic?'classic':'minimal';
    document.body.classList.toggle('study-minimal',!classic);
    document.body.classList.toggle('study-classic',classic);
    document.body.classList.toggle('study-finger',finger);
    document.body.classList.remove('study-desktop','study-unified','study-wide');
    document.body.classList.toggle('study-touch',finger);
    document.body.classList.toggle('study-small-touch',finger&&!large);
    document.body.classList.toggle('study-short',wide&&h<360);
    document.body.classList.toggle('study-large-landscape',large);
    document.body.classList.toggle('study-portrait',w<600&&!wide);
    document.body.classList.toggle('study-tablet',w>=600&&!wide);
    document.body.classList.toggle('study-pad-right',UI_SIDE==='right');
    const padSide=typeof UI_PAD_SIDE==='string'?UI_PAD_SIDE:'left';
    document.body.classList.toggle('study-control-pad-left',padSide==='left');
    const hotbarLayout=typeof uiHotbarLayout==='function'?uiHotbarLayout():(typeof UI_HOTBAR_LAYOUT==='string'?UI_HOTBAR_LAYOUT:'horizontal');
    const vertical=hotbarLayout==='vertical';
    document.body.classList.toggle('study-hotbar-vertical',vertical);
    document.body.classList.toggle('study-overlay-pad',classic?UI_DESKTOP_PAD:finger?UI_TOUCH_PAD:UI_DESKTOP_PAD);
    composeColumns();
    syncNavigation();
    renderReadouts();
    if(typeof FoteCombatLog!=='undefined')FoteCombatLog.setTransient(!classic);
    setMenu(false);syncAudioButton();syncSheet();
    syncTouchControls();
    document.documentElement.style.setProperty('--study-top',classic?node('top').getBoundingClientRect().bottom+'px':'0px');
    resize();positionSheet();
  }
  function composeColumns(){
    const hotbar=node('hotbar'),pad=node('dpad'),explore=node('studyExplore');
    const app=node('app'),hud=node('studyHud'),status=node('statusbar'),recent=node('studyRecentLog');
    const panels=node('studySheetTabs');
    const panelButtons=['studyChar','studyGear','studyFaith','studySheetOptions'].map(node);
    const nav=node('studyNav');
    if(document.body.classList.contains('study-classic')){
      nav.append(node('studyChar'),node('studyGear'),node('studyFaith'),node('studyOptions'),node('bMap'),node('bMute'));
      if(hud.parentElement!==app)app.append(hud);
      if(status&&status.parentElement!==hud)hud.append(status);
      if(node('log').parentElement!==hud)hud.append(node('log'));
      const actions=node('studyActionBar');actions.append(explore);hud.insertBefore(actions,status);
      if(hotbar.parentElement!==app)app.append(hotbar);
      return;
    }
    if(node('log').parentElement!==node('studyRight'))node('studyRight').prepend(node('log'));
    if(node('studyActionBar').parentElement!==app)app.append(node('studyActionBar'));
    if(panelButtons.some((button,index)=>panels.children[index]!==button))panels.append(...panelButtons);
    const actions=node('studyActionBar');
    const actionButtons=[node('studyMenuToggle'),node('bMap'),explore];
    const inventory=node('studyInventoryIcon');
    const phoneVertical=document.body.classList.contains('study-small-touch')&&document.body.classList.contains('study-hotbar-vertical');
    if(phoneVertical)actionButtons.push(inventory);
    else if(inventory.parentElement!==app)app.append(inventory);
    if(actionButtons.some((button,index)=>actions.children[index]!==button))actions.append(...actionButtons);
    if(hud.parentElement!==app)app.append(hud);
    if(status&&status.parentElement!==hud)hud.append(status);
    if(recent&&recent.parentElement!==app)app.append(recent);
    if(hotbar.parentElement!==app)app.append(hotbar);
    if(pad.parentElement!==node('map'))node('map').append(pad);
  }
  function relayout(){
    if(!mounted||frame)return;
    frame=requestAnimationFrame(()=>{frame=0;classify();if(typeof player!=='undefined'&&player){abilityBar();drawTerrainNow();}});
  }
  function syncTouchControls(){
    const controls=node('dpad');if(!controls)return;
    const overlay=document.body.classList.contains('study-overlay-pad');
    const blocked=overlay&&(!!aiming||(typeof BOWAIM!=='undefined'&&!!BOWAIM)||uiOpen()||!player||player.hp<=0);
    controls.classList.toggle('unavailable',blocked);
    controls.setAttribute('aria-hidden',String(blocked));
    controls.querySelectorAll('button').forEach(button=>{button.disabled=blocked;button.tabIndex=blocked?-1:0;});
  }
  function mount(){
    if(mounted)return;
    const app=node('app');if(!app)return;
    document.body.classList.add('fote-study');
    // All legacy component styles have loaded. Geometry precedes the material skin.
    document.head.append(node('responsiveHudStyles'),node('forgeSkin'));
    const hud=document.createElement('div');hud.id='studyHud';app.append(hud);
    const readouts=document.createElement('div');readouts.id='studyReadouts';hud.append(node('bars'),readouts);readouts.append(node('hud2'));
    const depth=document.createElement('span');depth.id='studyDepth';hud.prepend(depth);
    const portrait=document.createElement('button');portrait.id='studyPortrait';portrait.type='button';portrait.title='Character';
    portrait.innerHTML='<span id="studyPortraitArt"></span><span id="studyPortraitStats"><span id="studyLevel"></span><span id="studyRank"></span></span>';hud.prepend(portrait);
    const statPoints=document.createElement('button');statPoints.id='studyStatPoints';statPoints.type='button';statPoints.hidden=true;statPoints.setAttribute('aria-controls','shade');hud.append(statPoints);
    const piety=document.createElement('button');piety.id='studyPietyBar';piety.type='button';piety.className='bar study-piety-bar';
    piety.innerHTML='<i id="studyPietyFill"></i>';node('bars').append(piety);
    const inventory=document.createElement('button');inventory.id='studyInventoryIcon';inventory.type='button';inventory.title='Inventory';inventory.setAttribute('aria-label','Inventory');
    inventory.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 7a3 3 0 0 1 3-2h6a3 3 0 0 1 3 2l2 12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M8 13h8v5H8zM7 9h10"/></svg>';app.append(inventory);
    const sheetTabs=document.createElement('nav');sheetTabs.id='studySheetTabs';sheetTabs.setAttribute('aria-label','Character panels');node('shade').querySelector('header').prepend(sheetTabs);
    const left=document.createElement('aside');left.id='studyLeft';left.setAttribute('aria-label','Player information and movement');
    const right=document.createElement('aside');right.id='studyRight';right.setAttribute('aria-label','Combat log and abilities');
    app.append(left,right);left.append(hud,node('dpad'));right.append(node('log'),node('hotbar'));styleDirectionButtons();
    const footer=document.createElement('footer');footer.id='studyFooter';
    app.append(footer);
    const menu=document.createElement('button');menu.id='studyMenuToggle';menu.type='button';
    menu.setAttribute('aria-label','Menu');menu.setAttribute('aria-controls','top');menu.setAttribute('aria-expanded','false');
    menu.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 7h12M6 12h12M6 17h12"/></svg>';app.append(menu);
    const actions=document.createElement('nav');actions.id='studyActionBar';actions.setAttribute('aria-label','Game actions');app.append(actions);
    const logClose=document.createElement('button');logClose.id='studyLogClose';logClose.type='button';logClose.textContent='Close history';app.append(logClose);
    const position=document.createElement('span');position.className='study-position';
    const floor=document.createElement('span');floor.className='study-floor';floor.append('Floor ',node('hFloor'));
    const clock=document.createElement('span');clock.className='study-turn';clock.append('Turn ',node('hTurn'));
    position.append(floor,clock);const biome=node('hBiome');node('depth').replaceChildren(position,biome);
    const nav=document.createElement('nav');nav.id='studyNav';nav.setAttribute('aria-label','Game panels');
    for(const [label,panel,id] of [['Char','Char','studyChar'],['Gear','Equip','studyGear'],['Faith','Faith','studyFaith'],['Options','Help','studyOptions']]){
      const button=node('tabs').querySelector('[data-p="'+panel+'"]');
      button.type='button';button.id=id;button.textContent=label;nav.append(button);
    }
    const sheetOptions=document.createElement('button');sheetOptions.id='studySheetOptions';sheetOptions.type='button';sheetOptions.dataset.p='Help';sheetOptions.textContent='Options';sheetTabs.append(sheetOptions);
    const panelClick=event=>{
      const button=event.target.closest('[data-p]');
      if(!button||event.currentTarget===sheetTabs&&button.dataset.p===openSheet)return;
      const fromMenu=menuOpen;showSheet(button.dataset.p);
      if(fromMenu){const tab=sheetTabs.querySelector('[data-p="'+openSheet+'"]');(tab||node('close')).focus();}
    };
    nav.addEventListener('click',panelClick);sheetTabs.addEventListener('click',panelClick);
    node('top').append(nav);nav.append(node('bMap'),node('bMute'));
    for(const [label,panel,id,path] of [
      ['Character','Char','studyMenuChar','<circle cx="12" cy="7" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/>'],
      ['Inventory','Equip','studyMenuGear','<path d="M8 6V4h8v2M6 7a3 3 0 0 1 3-2h6a3 3 0 0 1 3 2l2 12H4zM8 13h8v5H8z"/>'],
      ['Faith','Faith','studyMenuFaith','<path d="m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3z"/>']
    ]){
      const button=document.createElement('button');button.id=id;button.type='button';button.className='study-menu-panel';button.dataset.p=panel;
      button.innerHTML=lineIcon(path)+'<span>'+label+'</span>';nav.insertBefore(button,node('studyOptions'));
    }
    const history=document.createElement('button');history.id='studyHistory';history.type='button';history.textContent='Log history';nav.append(history);
    for(const [id,kind]of [['studyPortrait','character'],['studyInventoryIcon','inventory']])bindHudResourceCard(node(id),kind);
    const explore=document.createElement('button');explore.id='studyExplore';explore.type='button';explore.textContent='Explore';
    left.insertBefore(explore,node('dpad'));bindExploreButton(explore);
    const hunger=document.createElement('button');hunger.id='studyHunger';hunger.type='button';hunger.className='study-hunger';
    hunger.innerHTML='<b id="studyHungerText"></b><span class="study-hunger-track"><i id="studyHungerFill"></i></span>';readouts.prepend(hunger);
    hunger.onclick=()=>showSheet('Equip');bindHudResourceCard(hunger,'hunger');
    const xp=node('xpBar');xp.setAttribute('role','button');xp.tabIndex=0;xp.onclick=()=>showSheet('Char');
    xp.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showSheet('Char');}};
    if(typeof FoteCombatLog!=='undefined'){const recent=FoteCombatLog.mount();hud.append(recent);}
    mounted=true;bindMinimalControls();classify();syncAudioButtons();updateUI();
    window.addEventListener('resize',relayout);
    if(window.visualViewport)visualViewport.addEventListener('resize',relayout);
    new ResizeObserver(positionSheet).observe(node('map'));
    new ResizeObserver(positionSheet).observe(node('hotbar'));
    new ResizeObserver(positionRecentLog).observe(node('studyHud'));
    node('responsiveHudStyles').addEventListener('load',relayout);
    const firstVisibleLog=new ResizeObserver(()=>{if(node('log').clientHeight>0){node('log').scrollTop=node('log').scrollHeight;firstVisibleLog.disconnect();}});
    firstVisibleLog.observe(node('log'));
  }
  function renderReadouts(){
    if(!mounted||!player)return;
    syncExploreButton(node('studyExplore'));
    node('studyDepth').textContent=node('hBiome').textContent+' · Floor '+node('hFloor').textContent;
    bindHudResourceCard(node('studyExplore'),'explore');
    const hungry=player.hunger<=0?'Starving':player.hunger<300?'Hungry':'Full';
    node('studyHungerText').textContent=hungry;
    node('studyHungerFill').style.width=clamp(player.hunger/HUNGER_MAX*100,0,100)+'%';
    node('studyHungerFill').style.background=hungry==='Full'?'#687b3e':hungry==='Starving'?'#b8503d':'#b87a32';
    node('studyHunger').setAttribute('aria-label',hungry+'. Hunger '+num(player.hunger)+' / '+num(HUNGER_MAX));
    node('studyHunger').classList.toggle('study-starving',player.hunger<=0);
    node('studyHunger').classList.toggle('study-fed',hungry==='Full');
    node('xpBar').setAttribute('aria-label','Level '+player.level+'. XP '+num(player.xp)+' / '+num(player.xpNext));
    bindHudResourceCard(node('bars').querySelector('.hp'),'hp');
    bindHudResourceCard(node('bars').querySelector('.mp'),'mp');
    bindHudResourceCard(node('xpBar'),'xp');
    node('studyLevel').innerHTML='<small>LV</small><b>'+num(player.level)+'</b>';
    node('studyRank').hidden=!player.god;node('studyPietyBar').hidden=!player.god;
    paintPortrait();
    node('studyPortrait').setAttribute('aria-label','Character, level '+player.level+(player.god?', '+GODS[player.god].name+', rank '+godRank():''));
    let faith='';
    if(player.god){
      const g=GODS[player.god],rank=godRank(),next=PIETY_RANKS[rank]||null,prev=PIETY_RANKS[rank-1]||0;
      const pct=next?clamp((player.piety-prev)/(next-prev),0,1)*100:100;
      const detail=g.name+', rank '+rank+'. Piety '+num(player.piety)+(next?' / '+num(next)+' for rank '+(rank+1):', maximum rank');
      node('studyRank').innerHTML='<small>R</small><b>'+rank+'</b>';node('studyRank').style.color=g.color;
      node('studyPietyFill').style.width=pct+'%';node('studyPietyFill').style.background=g.color;
      node('studyPietyBar').title=detail;node('studyPietyBar').setAttribute('aria-label',detail);bindHudResourceCard(node('studyPietyBar'),'piety');
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
    node('xpBar').classList.toggle('study-points-pending',points>0);
    node('studyChar').innerHTML='<span>Character</span>'+(points?'<span class="study-points" aria-hidden="true">'+points+'</span>':'');
    node('studyChar').removeAttribute('title');
    node('studyChar').setAttribute('aria-label',points?'Character: '+points+' unspent stat point'+(points===1?'':'s'):'Character');
    const statPoints=node('studyStatPoints');statPoints.hidden=!points;statPoints.textContent='+'+points;
    statPoints.title=points+' unspent stat point'+(points===1?'':'s')+'. Open Character.';statPoints.setAttribute('aria-label',statPoints.title);
    statPoints.classList.toggle('study-still',typeof ANIM!=='undefined'&&ANIM.reduce);
    bindHudResourceCard(statPoints,'points');
    node('studyMenuChar').setAttribute('aria-label',node('studyChar').getAttribute('aria-label'));
    node('studyGear').textContent='Inventory';
    const amusement=node('studyAmusement');if(amusement)paintAmusement(amusement);
  }
  function paintAmusement(effect){
    const pct=clamp(Math.round(player.amusement||0),0,100);
    effect.style.setProperty('--amusement',pct+'%');effect.querySelector('.n').textContent=pct+'%';
    effect.setAttribute('aria-label','Amusement '+pct+' percent. Combat raises it; quiet drains it.');
  }
  function renderStatusMeter(){
    if(!mounted||!player)return;
    const bar=node('statusbar');if(!bar)return;
    const parent=node('studyHud');
    if(bar.parentElement!==parent)parent.append(bar);
    if(player.god!=='wobbles')return;
    const existing=node('studyAmusement');if(existing){paintAmusement(existing);return;}
    const effect=document.createElement('button');effect.id='studyAmusement';effect.className='sico study-amusement-icon';effect.type='button';
    effect.innerHTML='<i class="study-amusement-fill"></i><img class="study-amusement-art" src="'+statusIconURL('pr-rolldice2')+'" alt="" aria-hidden="true"><span class="n"></span>';
    paintAmusement(effect);bar.prepend(effect);bindHudResourceCard(effect,'amusement');effect.onclick=()=>showSheet('Faith');
  }
  return Object.freeze({mount,renderReadouts,renderStatusMeter,syncAudioButton,syncSheet,syncTouchControls,relayout,hasOverlay,isMounted:()=>mounted});
})();
FoteLifecycle.whenReady(FoteResponsiveHUD.mount);
