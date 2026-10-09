/* Responsive HUD composition. Layout and appearance use the existing game UI
   owners; no save loading, demo state or review controls belong in this module.
   The approved study* selectors remain stable for skins and screenshot tooling. */
var FoteResponsiveHUD=(function(){
  'use strict';
  var mounted=false,frame=0,menuOpen=false,portraitRetry=0,pickupFrame=0,positionFrame=0;
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
    positionRecentLog();syncPickup();
    if(typeof syncEquipmentDoll==='function')syncEquipmentDoll(false);
  }
  function positionRecentLog(){
    const recent=node('studyRecentLog');if(!recent)return;
    recent.style.width='';recent.style.maxHeight='';recent.style.bottom='';recent.style.height='';
    const style=getComputedStyle(recent),right=document.body.classList.contains('study-control-pad-left');
    const inset=parseFloat(style.getPropertyValue('--minimal-inset'))||8;
    const edge=parseFloat(right?style.right:style.left)||inset;
    const pad=node('dpad').getBoundingClientRect();
    let width=parseFloat(style.width)||Math.min(340,innerWidth-inset*2);
    if(document.body.classList.contains('study-overlay-pad')){
      const available=right?innerWidth-edge-pad.right-8:pad.left-edge-8;
      width=Math.min(width,Math.max(80,available));recent.style.width=width+'px';
    }
    const left=right?innerWidth-edge-width:edge;
    // Keep wrapped messages below any HUD/control occupying the same corner.
    // Short landscape phones have room for fewer lines, never overlapping taps.
    const blockers=['studyHud','studyActionBar','statusbar'].map(id=>node(id)?.getBoundingClientRect())
      .filter(r=>r&&r.width&&r.height&&left<r.right&&left+width>r.left);
    if(blockers.length)recent.style.maxHeight=Math.max(0,innerHeight-(parseFloat(style.bottom)||inset)-Math.max(...blockers.map(r=>r.bottom))-10)+'px';
    recent.scrollTop=recent.scrollHeight;
  }
  function queuePositions(){
    if(!mounted||positionFrame)return;
    /* Layout writes can resize the observed map while the styles first settle.
     * Leave ResizeObserver delivery before positioning, and share one frame
     * across map, hotbar and resource-bar notifications. */
    positionFrame=requestAnimationFrame(()=>{positionFrame=0;positionSheet();positionStatuses();});
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
    const wide=w>h,large=wide&&h>=600&&w>=960,portrait=w<600&&!wide;
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
    document.body.classList.toggle('study-portrait',portrait);
    document.body.classList.toggle('study-tablet',w>=600&&!wide);
    document.body.classList.toggle('study-pad-right',UI_SIDE==='right');
    const padSide=typeof UI_PAD_SIDE==='string'?UI_PAD_SIDE:'left';
    document.body.classList.toggle('study-control-pad-left',padSide==='left');
    const hotbarLayout=typeof uiHotbarLayout==='function'?uiHotbarLayout():(typeof UI_HOTBAR_LAYOUT==='string'?UI_HOTBAR_LAYOUT:'horizontal');
    // A narrow upright phone needs two rows of full-size targets. Retain the
    // saved orientation for landscape; changing the viewport never writes it.
    const vertical=hotbarLayout==='vertical'&&!(finger&&portrait);
    document.body.classList.toggle('study-hotbar-vertical',vertical);
    document.body.classList.toggle('study-overlay-pad',finger?UI_TOUCH_PAD:UI_DESKTOP_PAD);
    composeColumns();
    syncNavigation();
    renderReadouts();
    if(typeof FoteCombatLog!=='undefined')FoteCombatLog.setTransient(!classic);
    setMenu(false);syncAudioButton();syncSheet();
    syncTouchControls();
    document.documentElement.style.setProperty('--study-top',classic?node('top').getBoundingClientRect().bottom+'px':'0px');
    resize();positionSheet();positionStatuses();
  }
  function composeColumns(){
    const hotbar=node('hotbar'),pad=node('dpad'),explore=node('studyExplore');
    const app=node('app'),hud=node('studyHud'),status=node('statusbar'),recent=node('studyRecentLog'),inventory=node('studyInventoryIcon');
    const panels=node('studySheetTabs');
    const panelButtons=['studyChar','studyGear','studyFaith','studySheetOptions'].map(node);
    const nav=node('studyNav');
    const pickup=node('studyPickup');if(pickup&&pickup.parentElement!==app)app.append(pickup);
    if(document.body.classList.contains('study-classic')){
      nav.append(node('studyChar'),node('studyGear'),node('studyFaith'),node('studyOptions'),node('bMap'),node('bMute'));
      if(hud.parentElement!==app)app.append(hud);
      if(status&&status.parentElement!==hud)hud.append(status);
      if(node('log').parentElement!==hud)hud.append(node('log'));
      const actions=node('studyActionBar');actions.append(explore);hud.insertBefore(actions,status);
      if(inventory.parentElement!==app)app.append(inventory);
      if(hotbar.parentElement!==app)app.append(hotbar);
      if(pad.parentElement!==node('map'))node('map').append(pad);
      return;
    }
    if(node('log').parentElement!==node('studyRight'))node('studyRight').prepend(node('log'));
    if(node('studyActionBar').parentElement!==app)app.append(node('studyActionBar'));
    if(panelButtons.some((button,index)=>panels.children[index]!==button))panels.append(...panelButtons);
    const actions=node('studyActionBar');
    const actionButtons=[node('studyMenuToggle'),node('bMap')];
    const phonePortrait=document.body.classList.contains('study-small-touch')&&document.body.classList.contains('study-portrait');
    if(phonePortrait)actionButtons.push(explore,inventory,node('studyCancelAim'));
    else actionButtons.push(explore);
    if(!phonePortrait&&inventory.parentElement!==app)app.append(inventory);

    if(actionButtons.some((button,index)=>actions.children[index]!==button))actions.append(...actionButtons);
    if(hud.parentElement!==app)app.append(hud);
    if(status&&status.parentElement!==app)app.append(status);
    if(recent&&recent.parentElement!==app)app.append(recent);
    if(hotbar.parentElement!==app)app.append(hotbar);
    if(pad.parentElement!==node('map'))node('map').append(pad);
  }
  function relayout(){
    if(!mounted||frame)return;
    frame=requestAnimationFrame(()=>{frame=0;classify();if(typeof player!=='undefined'&&player){abilityBar();drawTerrainNow();}});
  }
  function syncTouchControls(){
    syncPickup();
    const phone=document.body.classList.contains('study-minimal')&&document.body.classList.contains('study-portrait')&&document.body.classList.contains('study-touch');
    const search=node('studySearch');
    if(search){search.hidden=!phone||UI_TOUCH_PAD||!!aiming||(typeof BOWAIM!=='undefined'&&!!BOWAIM)||uiOpen()||!player||player.hp<=0;}
    const cancel=node('studyCancelAim');
    const showCancel=document.body.classList.contains('study-minimal')&&document.body.classList.contains('study-portrait')&&document.body.classList.contains('study-touch')&&(!!aiming||(typeof BOWAIM!=='undefined'&&!!BOWAIM))&&!uiOpen();
    if(cancel){cancel.hidden=!showCancel;cancel.tabIndex=showCancel?0:-1;}
    setHudClass(node('studyActionBar'),'study-targeting',showCancel);
    const controls=node('dpad');if(!controls)return;
    const overlay=document.body.classList.contains('study-overlay-pad');
    const blocked=overlay&&(!!aiming||(typeof BOWAIM!=='undefined'&&!!BOWAIM)||uiOpen()||!player||player.hp<=0);
    setHudClass(controls,'unavailable',blocked);
    setHudAttribute(controls,'aria-hidden',String(blocked));
    controls.querySelectorAll('button').forEach(button=>{if(button.disabled!==blocked)button.disabled=blocked;if(button.tabIndex!==(blocked?-1:0))button.tabIndex=blocked?-1:0;});
  }
  function pickupItems(){
    if(typeof player==='undefined'||!player||player.hp<=0||typeof RUN!=='undefined'&&RUN&&(RUN.over||RUN.victory)||typeof items==='undefined')return [];
    // The floor's current item list and native bag-entry policy own eligibility.
    // Floating over a chasm remains a valid standing tile; blocked scenery does not.
    if(!walkable(player.x,player.y)&&!(at(player.x,player.y)===CHASM&&(player.levitate>0||player.windCarry)))return [];
    return items.filter(it=>it.x===player.x&&it.y===player.y&&(it.rareLamp!==undefined||bagEntryFor(it)));
  }
  function syncPickup(){
    const button=node('studyPickup');if(!button)return;
    const loot=pickupItems(),busy=!!loot.length&&typeof animBusy==='function'&&animBusy();
    const shown=!!loot.length&&document.body.classList.contains('study-touch')&&(document.body.classList.contains('study-overlay-pad')||document.body.classList.contains('study-portrait'))&&!uiOpen()&&!aiming&&!(typeof BOWAIM!=='undefined'&&BOWAIM);
    if(button.hidden!==!shown)button.hidden=!shown;if(button.disabled!==(!shown||busy))button.disabled=!shown||busy;if(button.tabIndex!==(button.disabled?-1:0))button.tabIndex=button.disabled?-1:0;
    setHudAttribute(button,'aria-label',loot.length?'Pick up: '+loot.map(itemLabel).join(', '):'Pick up');
    if(shown){
      const pad=node('dpad').getBoundingClientRect(),bar=node('hotbar').getBoundingClientRect();
      const left=document.body.classList.contains('study-control-pad-left');
      const x=pad.width?(left?pad.right+8:pad.left-button.offsetWidth-8):8;
      button.style.left=Math.max(8,Math.min(innerWidth-button.offsetWidth-8,x))+'px';
      button.style.top=Math.max(8,Math.min(innerHeight-button.offsetHeight-8,pad.height?pad.bottom-button.offsetHeight:bar.top-button.offsetHeight-8))+'px';
    }
    // Observe readiness, never queue a pickup action.
    if(shown&&busy&&!pickupFrame)pickupFrame=requestAnimationFrame(()=>{pickupFrame=0;syncPickup();});
  }
  function pickUpHere(event){
    event.preventDefault();event.stopPropagation();
    if(typeof stopRest==='function')stopRest();
    if(typeof stopTravel==='function')stopTravel();
    syncPickup();
    if(node('studyPickup').disabled)return;
    if(grab())endTurn();
    syncPickup();
  }
  function mount(){
    if(mounted)return;
    const app=node('app');if(!app)return;
    document.body.classList.add('fote-study');
    // All legacy component styles have loaded. Geometry precedes the material skin.
    document.head.append(node('responsiveHudStyles'),node('forgeSkin'));
    // 2026-10-05 (item art, C4): moving a stylesheet reloads it, so the hotbar painted below is measured before this
    // geometry applies (a 44px icon box, then shown at 58 to 70px). Icons are measured again once each sheet is back.
    ['responsiveHudStyles','forgeSkin'].forEach(id=>node(id).addEventListener('load',()=>{if(typeof forgetIconSizes==='function')forgetIconSizes();if(mounted&&typeof player!=='undefined'&&player)abilityBar();},{once:true}));
    const hud=document.createElement('div');hud.id='studyHud';app.append(hud);
    const readouts=document.createElement('div');readouts.id='studyReadouts';hud.append(node('bars'),readouts);readouts.append(node('hud2'));
    const depth=document.createElement('span');depth.id='studyDepth';hud.prepend(depth);
    const portrait=document.createElement('button');portrait.id='studyPortrait';portrait.type='button';portrait.title='Character';
    portrait.innerHTML='<span id="studyPortraitArt"></span><span id="studyPortraitStats"><span id="studyLevel"></span><span id="studyRank"></span></span>';hud.prepend(portrait);
    const statPoints=document.createElement('button');statPoints.id='studyStatPoints';statPoints.type='button';statPoints.hidden=true;statPoints.setAttribute('aria-controls','shade');hud.append(statPoints);
    const pickup=document.createElement('button');pickup.id='studyPickup';pickup.type='button';pickup.hidden=true;
    pickup.innerHTML=lineIcon('<path d="M18.5 2.5Q20 2 20.5 3L22 7Q22.5 8 21.5 9L17 13.5Q15.5 14.5 14.5 13Q14 12.5 15 11L16.5 8.8Q17.5 7 16 6.8Q13.5 6.5 12.5 9L11 12.5Q10 14 9 13Q8.5 12.5 9 11L10.2 8.7Q8.7 10.2 8 12.8Q7.5 14.5 6 14Q5 13.8 5.4 12L6.8 8.8Q4.4 11.5 4 15.5Q3.8 17 2.4 16.6Q1.5 16.4 1.7 15Q2.2 8 8 4.5Q12 2.7 18.5 2.5Z"/><path d="m12 17 3 3-3 3-3-3z" fill="currentColor" stroke="none"/>');
    pickup.setAttribute('aria-label','Pick up items here');pickup.dataset.gameUi='true';app.append(pickup);bindHudResourceCard(pickup,'pickup');
    pickup.onclick=pickUpHere;
    const piety=document.createElement('button');piety.id='studyPietyBar';piety.type='button';piety.className='bar study-piety-bar';
    piety.innerHTML='<i id="studyPietyFill"></i><span id="studyPietyText"></span>';node('bars').append(piety);
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
    const search=document.createElement('button');search.id='studySearch';search.type='button';search.hidden=true;search.dataset.gameUi='true';search.setAttribute('aria-label','Wait and search');
    search.innerHTML=lineIcon('<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/>');
    search.onclick=function(event){event.preventDefault();event.stopPropagation();if(uiOpen()||aiming||(typeof BOWAIM!=='undefined'&&BOWAIM)||!player||player.hp<=0)return;node('dpad').querySelector('[data-d="5"]').click();};app.append(search);bindHudResourceCard(search,'search');
    const cancel=document.createElement('button');cancel.id='studyCancelAim';cancel.type='button';cancel.hidden=true;cancel.dataset.gameUi='true';cancel.setAttribute('aria-label','Cancel targeting');
    cancel.innerHTML=lineIcon('<path d="m6 6 12 12M18 6 6 18"/>');cancel.onclick=function(event){event.preventDefault();event.stopPropagation();cancelAim();syncTouchControls();};app.append(cancel);
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
    node('close').setAttribute('aria-label','Close panel');
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
    const layoutObserver=new ResizeObserver(queuePositions);
    ['map','hotbar','studyHud','bars'].forEach(id=>layoutObserver.observe(node(id)));
    node('responsiveHudStyles').addEventListener('load',relayout);
    const firstVisibleLog=new ResizeObserver(()=>{if(node('log').clientHeight>0){node('log').scrollTop=node('log').scrollHeight;firstVisibleLog.disconnect();}});
    firstVisibleLog.observe(node('log'));
  }
  function readoutControls(){
    const hud=node('hud2');
    if(hud._studyReadouts&&hud._studyReadouts.wallet.parentElement===hud)return hud._studyReadouts;
    const wallet=document.createElement('div');wallet.className='study-wallet';
    wallet.innerHTML='<button class="chip study-stock" data-study-panel="Equip"><span aria-hidden="true">◆</span><b class="study-essence-count"></b></button><button class="chip motechip study-motes" data-study-panel="Equip"></button>';
    hud.replaceChildren(wallet);
    const stock=wallet.querySelector('.study-stock'),motes=wallet.querySelector('.study-motes');
    for(const element of ['fire','water','earth','air','light','shadow']){
      const mote=document.createElement('span');mote.className='study-mote';mote.dataset.element=element;
      mote.innerHTML='<i class="dot" style="background:'+AFF_COL[element]+'"></i><b></b>';motes.append(mote);
    }
    for(const button of [stock,motes])button.onclick=()=>showSheet('Equip');
    bindHudResourceCard(stock,'stock');bindHudResourceCard(motes,'motes');
    return hud._studyReadouts={wallet,stock,motes,piety:null,favor:null};
  }
  function renderReadouts(){
    syncPickup();
    if(!mounted||!player)return;
    const classic=document.body.classList.contains('study-classic'),controls=readoutControls();
    const explore=node('studyExplore'),exploreState=[autoExploreActive(),!!floorMeta?.exploreComplete,explore.dataset.iconOnly].join('|');
    if(explore._studyExploreState!==exploreState){syncExploreButton(explore);explore._studyExploreState=exploreState;}
    setHudText(node('studyDepth'),node('hBiome').textContent+' · Floor '+node('hFloor').textContent);
    bindHudResourceCard(explore,'explore');
    const hungry=player.hunger<=0?'Starving':player.hunger<300?'Hungry':'Full';
    setHudText(node('studyHungerText'),hungry);
    setHudStyle(node('studyHungerFill'),'width',clamp(player.hunger/HUNGER_MAX*100,0,100)+'%');
    if(node('studyHungerFill')._hungerState!==hungry){node('studyHungerFill').style.background=hungry==='Full'?'#687b3e':hungry==='Starving'?'#b8503d':'#b87a32';node('studyHungerFill')._hungerState=hungry;}
    setHudAttribute(node('studyHunger'),'aria-label',hungry+'. Hunger '+num(player.hunger)+' / '+num(HUNGER_MAX));
    setHudClass(node('studyHunger'),'study-starving',player.hunger<=0);setHudClass(node('studyHunger'),'study-fed',hungry==='Full');
    setHudAttribute(node('xpBar'),'aria-label','Level '+player.level+'. XP '+num(player.xp)+' / '+num(player.xpNext));
    if(classic)setHudText(node('lvTxt'),'XP '+num(player.xp)+' / '+num(player.xpNext));
    bindHudResourceCard(node('bars').querySelector('.hp'),'hp');bindHudResourceCard(node('bars').querySelector('.mp'),'mp');bindHudResourceCard(node('xpBar'),'xp');
    const level=node('studyLevel'),rankNode=node('studyRank');
    if(!level.firstChild)level.innerHTML='<small>LV</small><b></b>';
    if(!rankNode.firstChild)rankNode.innerHTML='<small>R</small><b></b>';
    setHudText(level.querySelector('b'),num(player.level));
    if(rankNode.hidden!==!player.god)rankNode.hidden=!player.god;
    if(node('studyPietyBar').hidden!==!player.god)node('studyPietyBar').hidden=!player.god;
    paintPortrait();
    setHudAttribute(node('studyPortrait'),'aria-label','Character, level '+player.level+(player.god?', '+GODS[player.god].name+', rank '+godRank():''));
    if(player.god){
      if(!controls.piety){
        controls.piety=document.createElement('button');controls.piety.className='chip faithchip study-piety';controls.piety.dataset.studyPanel='Faith';
        controls.piety.innerHTML='<span class="gdot"></span><span class="rk"></span><span class="meter"><i></i></span>';
        controls.favor=document.createElement('button');controls.favor.className='chip faithchip study-favor';controls.favor.dataset.studyPanel='Faith';
        controls.favor.innerHTML='<span class="rk"></span><span class="meter sm"><i style="background:linear-gradient(90deg,#6B5A22,#E8D27A)"></i></span>';
        node('hud2').insertBefore(controls.piety,controls.wallet);node('hud2').insertBefore(controls.favor,controls.wallet);
        controls.piety.onclick=controls.favor.onclick=()=>showSheet('Faith');
        bindHudResourceCard(controls.piety,'piety');bindHudResourceCard(controls.favor,'favor');
      }
      const g=GODS[player.god],rank=godRank(),next=PIETY_RANKS[rank]||null,prev=PIETY_RANKS[rank-1]||0;
      const pct=next?clamp((player.piety-prev)/(next-prev),0,1)*100:100;
      const detail=g.name+', rank '+rank+'. Piety '+num(player.piety)+(next?' / '+num(next)+' for rank '+(rank+1):', maximum rank');
      setHudText(rankNode.querySelector('b'),rank);
      if(controls.color!==g.color){
        rankNode.style.color=g.color;node('studyPietyFill').style.background=g.color;
        controls.piety.style.color=g.color;controls.piety.querySelector('.meter i').style.background='linear-gradient(90deg,'+hexA(g.color,.55)+','+g.color+')';controls.color=g.color;
      }
      setHudStyle(node('studyPietyFill'),'width',pct+'%');
      setHudText(node('studyPietyText'),'Piety '+num(player.piety)+(next?' / '+num(next):' (max)'));
      setHudAttribute(node('studyPietyBar'),'aria-label',detail);bindHudResourceCard(node('studyPietyBar'),'piety');
      setHudAttribute(controls.piety,'aria-label',detail);setHudText(controls.piety.querySelector('.rk'),'R'+rank);setHudStyle(controls.piety.querySelector('.meter i'),'width',pct+'%');
      setHudAttribute(controls.favor,'aria-label','Favor '+num(player.favor)+' / 100');setHudText(controls.favor.querySelector('.rk'),'✦ '+(classic?'Favor ':'')+num(player.favor));setHudStyle(controls.favor.querySelector('.meter i'),'width',clamp(player.favor,0,100)+'%');
    }else if(controls.piety){controls.piety.remove();controls.favor.remove();controls.piety=controls.favor=null;controls.color=null;}
    const keys=(player.keys?.iron||0)+(player.keys?.crystal||0),stock=controls.stock;
    setHudAttribute(stock,'aria-label','Essence '+num(player.essence)+', keys '+keys);setHudText(stock.querySelector('.study-essence-count'),num(player.essence));
    let essenceLabel=stock.querySelector('.study-essence-label');
    if(classic&&!essenceLabel){essenceLabel=document.createElement('span');essenceLabel.className='study-essence-label';essenceLabel.textContent='Essence';stock.insertBefore(essenceLabel,stock.querySelector('b'));}
    else if(!classic&&essenceLabel)essenceLabel.remove();
    let keyIcon=stock.querySelector('.study-key-icon'),keyCount=stock.querySelector('.study-key-count');
    if(keys){
      if(!keyIcon){keyIcon=document.createElement('span');keyIcon.className='study-key-icon';keyIcon.setAttribute('aria-hidden','true');keyIcon.textContent='🗝';keyCount=document.createElement('b');keyCount.className='study-key-count';stock.append(keyIcon,keyCount);}
      setHudText(keyCount,keys);
    }else if(keyIcon){keyIcon.remove();keyCount.remove();}
    const elements=['fire','water','earth','air','light','shadow'];
    setHudAttribute(controls.motes,'aria-label','Motes: '+elements.map(k=>cap(k)+' '+num(player.motes[k])).join(', '));
    controls.motes.querySelectorAll('.study-mote').forEach(mote=>{const k=mote.dataset.element;setHudText(mote.querySelector('b'),num(player.motes[k]));});
    const points=Math.max(0,Math.round(player.points||0)),character=node('studyChar');
    setHudClass(node('xpBar'),'study-points-pending',points>0);
    if(!character.querySelector('span'))character.innerHTML='<span>Character</span>';
    let badge=character.querySelector('.study-points');
    if(points){if(!badge){badge=document.createElement('span');badge.className='study-points';badge.setAttribute('aria-hidden','true');character.append(badge);}setHudText(badge,points);}else if(badge)badge.remove();
    character.removeAttribute('title');setHudAttribute(character,'aria-label',points?'Character: '+points+' unspent stat point'+(points===1?'':'s'):'Character');
    const statPoints=node('studyStatPoints');if(statPoints.hidden!==!points)statPoints.hidden=!points;setHudText(statPoints,'+'+points);
    setHudAttribute(statPoints,'title',points+' unspent stat point'+(points===1?'':'s')+'. Open Character.');setHudAttribute(statPoints,'aria-label',statPoints.title);
    setHudClass(statPoints,'study-still',typeof ANIM!=='undefined'&&ANIM.reduce);bindHudResourceCard(statPoints,'points');
    setHudAttribute(node('studyMenuChar'),'aria-label',character.getAttribute('aria-label'));setHudText(node('studyGear'),'Inventory');
    const amusement=node('studyAmusement');if(amusement)paintAmusement(amusement);
  }

  function paintAmusement(effect){
    const pct=clamp(Math.round(player.amusement||0),0,100);
    const art=effect.querySelector('.study-amusement-art');
    if(art&&!art.getAttribute('src')){const url=statusIconURL('pr-rolldice2');if(url)art.src=url;}
    setHudStyle(effect,'--amusement',pct+'%');setHudText(effect.querySelector('.n'),pct+'%');
    setHudAttribute(effect,'aria-label','Amusement '+pct+' percent.');
  }
  function renderStatusMeter(){
    if(!mounted||!player)return;
    const bar=node('statusbar');if(!bar)return;
    const parent=document.body.classList.contains('study-classic')?node('studyHud'):node('app');
    if(bar.parentElement!==parent){parent.append(bar);positionStatuses();}
    if(player.god!=='wobbles'){const previous=node('studyAmusement');if(previous)previous.remove();return;}
    const existing=node('studyAmusement');if(existing){paintAmusement(existing);return;}
    const effect=document.createElement('button');effect.id='studyAmusement';effect.className='sico study-amusement-icon';effect.type='button';
    effect.innerHTML='<i class="study-amusement-fill"></i><img class="study-amusement-art" src="'+statusIconURL('pr-rolldice2')+'" alt="" aria-hidden="true"><span class="n"></span>';
    paintAmusement(effect);bar.prepend(effect);bindHudResourceCard(effect,'amusement');effect.onclick=()=>showSheet('Faith');
  }
  function positionStatuses(){
    if(!mounted)return;
    const hud=node('studyHud').getBoundingClientRect(),right=document.body.classList.contains('study-pad-right');
    setHudStyle(node('app'),'--study-status-offset',(right?innerWidth-hud.left:hud.right)+'px');
    setHudStyle(node('app'),'--study-status-top',(document.body.classList.contains('study-portrait')?hud.bottom+8:node('bars').querySelector('.hp').getBoundingClientRect().top)+'px');
  }
  return Object.freeze({mount,setMenu,renderReadouts,renderStatusMeter,syncAudioButton,syncSheet,syncTouchControls,relayout,hasOverlay,isMounted:()=>mounted});
})();
FoteLifecycle.whenReady(FoteResponsiveHUD.mount);
