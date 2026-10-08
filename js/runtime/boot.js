/* ============================================================================
   boot.js - wire the sandbox, add screen shake, and start at the title screen.
   ========================================================================== */

var GAME_STARTED=false,GAME_START_READY=null,BOOT_AUDIO_REPORT=null;
/* Tutorial preferences are explicit; topic progress belongs to the saved run. */
var FoteGettingStarted=(function(){
  var preferenceKey='fote-tutorial-enabled-v1',preference=null,queue=[],active=null,timer=null,task=null,waiting=null;
  var highlights=[];
  var topics={basics:true,faith:true,gods:true,character:true,inventory:true,sigils:true,forge:true};
  function escape(value){return String(value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function key(id,fallback){
    var value=typeof bindKey==='function'?bindKey(id):fallback;
    if(typeof value!=='string'||!value)value=fallback;
    return escape(typeof keyLabel==='function'?keyLabel(value):value);
  }
  function keys(ids,defaults){return ids.map(function(id,i){return key(id,defaults[i]);}).join(', ');}
  function keyboard(){
    return '<details class="guide-keys"><summary>Keyboard shortcuts</summary><div class="kv">'+
      '<span>Move</span><b>Arrows / '+keys(['up','left','down','right'],['w','a','s','d'])+'</b>'+
      '<span>Diagonals</span><b>'+keys(['ul','ur','dl','dr'],['q','e','z','c'])+'</b>'+
      '<span>Explore / Wait</span><b>'+key('explore','o')+' / '+key('wait','.')+'</b>'+
      '<span>Pick up</span><b>'+key('grab','g')+'</b>'+
      '<span>Bag / Character</span><b>'+key('gear','i')+' / '+key('char','Tab')+'</b>'+
      '<span>Hotbar</span><b>'+keys(['h1','h2','h3','h4','h5','h6','h7','h8'],['1','2','3','4','5','6','7','8'])+'</b></div></details>';
  }
  function enabled(){
    if(preference!==null)return preference;
    try{return localStorage.getItem(preferenceKey)!=='off';}catch(error){return true;}
  }
  function setEnabled(value){
    if(typeof value!=='boolean')return false;
    preference=value;try{localStorage.setItem(preferenceKey,value?'on':'off');}catch(error){}
    if(!value){queue=[];waiting=null;if(timer!==null)clearTimeout(timer);if(task!==null)clearTimeout(task);timer=null;task=null;}
    return true;
  }
  function live(run,hero){
    return !!run&&run===RUN&&hero===player&&hero.hp>0&&!run.over&&!run.victory&&!run.sandbox&&!(typeof SANDBOX!=='undefined'&&SANDBOX.building);
  }
  function seen(run,topic){return !!(run.tutorial&&run.tutorial.version===1&&run.tutorial.seen&&run.tutorial.seen[topic]===true);}
  function mark(run,hero,topic){
    if(!live(run,hero))return;
    if(!run.tutorial||run.tutorial.version!==1||!run.tutorial.seen||typeof run.tutorial.seen!=='object'||Array.isArray(run.tutorial.seen))run.tutorial={version:1,seen:{}};
    run.tutorial.seen[topic]=true;
  }
  function style(){
    if($('gettingStartedCSS'))return;
    var el=document.createElement('style');el.id='gettingStartedCSS';
    el.textContent='#modal.tutorial-coach{align-items:flex-end;justify-content:flex-end;background:transparent;padding:12px}#modal.tutorial-coach .mbox{width:min(400px,100%);max-height:min(90dvh,440px)}#modal.tutorial-coach.tutorial-hotbar{align-items:flex-start}#modal.tutorial-coach header{padding:8px 10px}#modal.tutorial-coach header h2{font-size:calc(15px + var(--ui-mobile-text-add,0px))}#modal.tutorial-coach .mbody p{margin:0 0 8px}#modal.tutorial-coach .mbody{font-size:calc(12px + var(--ui-mobile-text-add,0px));line-height:1.35;padding:8px}#modal.tutorial-coach footer{padding:5px 8px;gap:6px;flex-wrap:nowrap;align-items:center}#modal.tutorial-coach footer button{min-height:36px;padding:5px 9px;font-size:calc(12px + var(--ui-mobile-text-add,0px));white-space:nowrap}.tutorial-preference{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:calc(13px + var(--ui-mobile-text-add,0px))}.tutorial-preference input{width:18px;height:18px}#modal.tutorial-coach footer>.tutorial-preference{flex:1 1 auto;margin:0;min-height:36px;gap:5px;font-size:calc(11px + var(--ui-mobile-text-add,0px));white-space:nowrap}#modal.tutorial-coach footer>.tutorial-preference input{width:16px;height:16px;margin:0}#modal.tutorial-coach footer button:first-of-type{padding:5px 6px}.tutorial-inline{border:1px solid var(--edge);border-radius:6px;padding:10px;margin-bottom:12px;font-size:calc(12px + var(--ui-mobile-text-add,0px));line-height:1.35}.tutorial-inline p{margin:4px 0 8px}.tutorial-inline>button{min-height:44px}body:has([data-tutorial-topic="character"]) #studySheetTabs{outline:2px solid var(--gold);outline-offset:-2px}.guide-keys{margin-top:10px}.guide-keys summary{cursor:pointer;color:var(--gold)}.guide-keys .kv{margin-top:8px;font-size:calc(12px + var(--ui-mobile-text-add,0px));overflow-wrap:anywhere}@media(max-width:600px){#modal.tutorial-coach{justify-content:center;padding:8px}#modal.tutorial-coach .mbox{width:100%;max-height:90dvh}}';
    el.textContent+='.tutorial-focus{outline:2px solid var(--gold)!important;outline-offset:3px!important;box-shadow:0 0 12px #e8b44a66!important}#modal.tutorial-control-tour .mbox{position:fixed;width:min(270px,calc(100vw - 16px));max-height:calc(100dvh - 16px)}body:has(#modal.on.tutorial-control-tour) #app #map #dpad.unavailable,body:has(#modal.on.tutorial-control-tour) #app #map #dpad.unavailable button{opacity:1!important;pointer-events:none!important}.tutorial-inline.tutorial-item-tip{position:fixed;z-index:85;width:min(260px,calc(100vw - 16px));box-sizing:border-box;background:var(--panel,#191511);padding:8px;font-size:calc(12px + var(--ui-mobile-text-add,0px));line-height:1.35;box-shadow:0 5px 18px #0009;margin:0}body:has(#modal.on) .tutorial-item-tip{display:none}.tutorial-item-tip>button{min-height:28px;padding:3px 7px;font-size:calc(11px + var(--ui-mobile-text-add,0px))}.tutorial-item-tip .tutorial-preference{font-size:calc(10px + var(--ui-mobile-text-add,0px));margin-top:6px}.tutorial-item-tip .tutorial-preference input{width:14px;height:14px}';
    el.textContent+='.tutorial-inline{padding:6px 8px;margin-bottom:8px;font-size:calc(11px + var(--ui-mobile-text-add,0px));line-height:1.3}.tutorial-inline p{margin:3px 0 5px}.tutorial-inline>button{min-height:26px;padding:3px 7px;font-size:calc(11px + var(--ui-mobile-text-add,0px))}.tutorial-inline .tutorial-preference{display:inline-flex;margin:0 0 0 8px;gap:4px;font-size:calc(10px + var(--ui-mobile-text-add,0px))}.tutorial-inline .tutorial-preference input{width:13px;height:13px;margin:0}#modal.tutorial-invitation .mbox{width:min(300px,calc(100vw - 16px));height:auto;min-height:0}#modal.tutorial-invitation header{padding:5px 8px}#modal.tutorial-invitation header h2{font-size:calc(13px + var(--ui-mobile-text-add,0px))}#modal.tutorial-invitation .mbody{min-height:0;padding:6px 8px;font-size:calc(11px + var(--ui-mobile-text-add,0px));line-height:1.3}#modal.tutorial-invitation .mbody p{margin:0}#modal.tutorial-invitation footer{padding:4px 8px}#modal.tutorial-invitation footer button{min-height:28px;font-size:calc(11px + var(--ui-mobile-text-add,0px));padding:3px 8px}';
    el.textContent+='.tutorial-inline[data-tutorial-topic=faith],.tutorial-inline[data-tutorial-topic=forge],.tutorial-inline[data-tutorial-invitation]{max-width:340px;box-sizing:border-box}';
    document.head.appendChild(el);
    if(typeof window.addEventListener==='function'){
      var reposition=function(){var target=highlights[0];if(!target)return;var card=document.querySelector('.tutorial-item-tip');var box=$('modal')&&$('modal').classList.contains('tutorial-control-tour')?$('modal').querySelector('.mbox'):null;placeTip(card||box,target);};
      window.addEventListener('resize',reposition);window.addEventListener('scroll',reposition,true);
    }
  }
  function preferenceHTML(id){return '<label class="tutorial-preference"><input type="checkbox" id="'+id+'"> Don’t show again</label>';}
  function wirePreference(id){var checkbox=$(id);if(!checkbox)return;checkbox.checked=!enabled();checkbox.onchange=function(){setEnabled(!this.checked);};}
  function coachPreference(){
    var label=document.createElement('label');label.className='tutorial-preference';
    label.innerHTML='<input type="checkbox" id="tutorialDontShow"> Don’t show again';
    $('mFoot').insertBefore(label,$('mFoot').firstChild);wirePreference('tutorialDontShow');
  }
  function clearHighlights(){highlights.forEach(function(el){el.classList.remove('tutorial-focus');});highlights=[];}
  function highlight(el){clearHighlights();if(el){el.classList.add('tutorial-focus');highlights.push(el);}return el;}
  function placeTip(tip,target){
    if(!tip||!target||!window.innerWidth)return;
    var r=target.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight,gap=10,pad=8,vw=window.innerWidth,vh=window.innerHeight;
    var y=Math.max(pad,Math.min(r.top,vh-h-pad)),x=Math.max(pad,Math.min(r.left,vw-w-pad));
    var spots=[[r.right+gap,y],[r.left-w-gap,y],[x,r.top-h-gap],[x,r.bottom+gap]];
    var chosen=spots.find(function(p){return p[0]>=pad&&p[1]>=pad&&p[0]+w<=vw-pad&&p[1]+h<=vh-pad;});
    if(!chosen){var corners=[[pad,pad],[vw-w-pad,pad],[pad,vh-h-pad],[vw-w-pad,vh-h-pad]];
      corners.sort(function(a,b){function overlap(p){return Math.max(0,Math.min(p[0]+w,r.right)-Math.max(p[0],r.left))*Math.max(0,Math.min(p[1]+h,r.bottom)-Math.max(p[1],r.top));}return overlap(a)-overlap(b);});chosen=corners[0];}
    tip.style.left=Math.max(pad,chosen[0])+'px';tip.style.top=Math.max(pad,chosen[1])+'px';
  }
  function basicsPage(index){
    var pages=[
      ['Welcome to the Dungeon','<p>Take your time. This is turn-based: enemies respond when you move or attack. Standing still costs no turns.</p>',null],
      ['Your status bars','<p>HP is your health. Mana fuels spells. Hunger falls as you act; eat food before it runs out.</p>','bars'],
      ['Movement','<p>One direction press = one tile. Hold to repeat after a delay. Use this pad on touch, or arrows / '+keys(['up','left','down','right'],['w','a','s','d'])+' on a keyboard.</p>','dpad'],
      ['Inventory','<p>Open your bag here to inspect items and equipment. Opening Inventory costs no turn.</p>','studyInventoryIcon'],
      ['Map','<p>Toggle the map here to review explored rooms and plan your route.</p>','bMap'],
      ['Options','<p>Open Options from this menu to adjust controls, sound and tutorial settings.</p>','studyOptions'],
      ['Explore and interact','<p>Tap a destination to walk. Walk into enemies to attack and toward objects to interact. The compass auto-explores until danger; tap again to stop.</p>','studyExplore'],
      ['Abilities and loot','<p>Select an ability here, then its target. Menus and aiming are free. Tap loot to collect; the touch hand picks up items underfoot. Search is separate; Hearts/Mana globes collect automatically.</p>'+keyboard(),'hotbar']
    ],last=index===pages.length-1,tour=active;
    if(typeof FoteResponsiveHUD!=='undefined'&&typeof FoteResponsiveHUD.setMenu==='function')FoteResponsiveHUD.setMenu(pages[index][2]==='studyOptions');
    openModal(pages[index][0],pages[index][1],
      [{label:'Skip',fn:closeModal},{label:last?'Play':index===0?'Show controls':'Next',cls:'primary',fn:last?closeModal:function(){if(active===tour&&(!tour.record||live(tour.record.run,tour.record.hero)))basicsPage(index+1);}}],'getting-started');
    $('modal').classList.add('tutorial-coach');$('modal').classList.toggle('tutorial-control-tour',index>0);$('modal').classList.toggle('tutorial-hotbar',last);coachPreference();
    var target=highlight(pages[index][2]?$(pages[index][2]):null),box=$('modal').querySelector('.mbox');
    if(pages[index][2]==='bars'&&$('studyHunger')){$('studyHunger').classList.add('tutorial-focus');highlights.push($('studyHunger'));}
    if(target)placeTip(box,target);else{box.style.left='';box.style.top='';}
  }

  function beginBasics(onClose,record){
    if(typeof openModal!=='function'||typeof closeModal!=='function')return false;
    if(typeof stopTravel==='function')stopTravel();if(typeof stopRest==='function')stopRest();
    style();active={record:record||null,sheet:null};
    modalOnClose=function(){
      var closing=active;active=null;if(typeof FoteResponsiveHUD!=='undefined'&&typeof FoteResponsiveHUD.setMenu==='function')FoteResponsiveHUD.setMenu(false);$('modal').classList.remove('tutorial-coach','tutorial-hotbar','tutorial-control-tour');clearHighlights();
      if(closing&&closing.record)mark(closing.record.run,closing.record.hero,'basics');
      if(typeof onClose==='function')onClose();schedule();
    };
    basicsPage(0);return true;
  }
  function show(onClose){return beginBasics(onClose,null);}
  function lesson(topic){
    if(topic==='gods')topic='faith';
    return {faith:[['Gods and Faith','Piety unlocks boons; Favor pays for divine abilities. Check your god’s rules in Faith.']],
      character:[['Stats','Your new stat points are here. Use <b>+</b> beside an attribute to spend them. Read each stat before choosing. Opening Character is free; reopen it by tapping your portrait.'],
        ['Abilities and passives','Scroll to <b>Abilities</b> to read targeting, costs and cooldowns. Drag an available ability onto the hotbar. <b>Passives</b> describe benefits from your class, race, attributes and gear; they work without pressing an ability.'],
        ['Your panel tabs','The tabs above switch between <b>Character</b>, <b>Inventory</b>, <b>Faith</b> and <b>Options</b>. Select Inventory to inspect your bag and equipment. Switching panels costs no turn.']],
      inventory:[['Food','Select highlighted food to see its effects and eating action. Food restores hunger. Read its effects before eating.'],
        ['Motes and Essence','These pouch resources do not fill bag slots. Motes grant permanent affinity; Essence pays for Forge work.'],
        ['Identifying gear','Unidentified gear hides its properties. Its card explains how to identify it by use or wearing.'],
        ['Cursed items','Unknown gear may be cursed. Equipped cursed gear can bind and prevent removal. A Forge upgrade can cleanse it; identification alone cannot.']],
      sigils:[['Sigils','Sigils are single-use magic. Select the highlighted sigil, then choose its target if asked. Using an unknown kind identifies it but risks its effect. Check your god’s rules first. A Sigil of Knowledge can identify gear.']],
      forge:[['The Forge','Motes increase elemental affinity. Essence pays for crafting, upgrades and enchantments. Read the available choices before spending: infusions are permanent.']]}[topic];
  }
  function inlineHost(topic){
    if(!modalOpen)return null;
    var body=$('mBody'),anchor=topic==='forge'?$('forgeBody'):topic==='faith'&&body?body.querySelector('.shrine'):null;
    return body&&anchor&&body.contains(anchor)?body:null;
  }
  function inlineLesson(record,host){
    style();var pages=lesson(record.topic),card=document.createElement('div'),id='tutorialDontShow-'+record.topic,currentIndex=0,observer=null;
    function dismiss(){if(observer)observer.disconnect();clearHighlights();card.remove();}
    card.className='tutorial-inline'+((record.topic==='inventory'||record.topic==='sigils')?' tutorial-item-tip':'');card.setAttribute('data-tutorial-topic',record.topic);
    host.insertBefore(card,host.firstChild);
    function available(){return live(record.run,record.hero)&&host.contains(card);}
    function page(index){
      currentIndex=index;var text=pages[index],last=index===pages.length-1;
      card.innerHTML='<b>'+text[0]+(pages.length>1?' · '+(index+1)+' of '+pages.length:'')+'</b><p>'+text[1]+'</p>'+
        (index?'<button type="button" data-tutorial-back>Back</button> ':'')+
        (!last?'<button type="button" data-tutorial-next>Next</button> ':'')+
        (last&&record.topic==='character'?'<button type="button" data-tutorial-inventory>Open Inventory</button> ':'')+
        '<button type="button" data-tutorial-done>'+(last?'Got it':'Skip tip')+'</button>'+preferenceHTML(id);
      wirePreference(id);
      if((record.topic==='inventory'||record.topic==='sigils')){
        var kind=record.topic==='sigils'?'sigil':index===0?'food':null,bagIndex=record.hero.bag.findIndex(function(item){return kind?item.kind===kind:!!(item.data&&item.data.unid);});
        if(!kind&&bagIndex<0)bagIndex=record.hero.bag.findIndex(function(item){return ['weapon','armor','off','ring','amulet'].indexOf(item.kind)>=0;});
        var target=record.topic==='inventory'&&index===1?host.querySelector('[data-mote]'):bagIndex>=0?host.querySelector('[data-b="'+bagIndex+'"]'):null;
        if(record.topic==='inventory'&&index===1&&target)target=target.closest('.mote')||target;
        if(kind&&bagIndex<0){card.querySelector('p').innerHTML=(kind==='sigil'?'No sigil in your bag yet. ':'No food in your bag right now. ')+text[1];target=host.querySelector('.invgrid');}
        target=target||host.querySelector('[data-slot]')||host.querySelector('.invgrid');
        if(target&&typeof target.scrollIntoView==='function')target.scrollIntoView({block:'nearest',inline:'nearest'});
        highlight(target);placeTip(card,target);
      }
      card.querySelector('[data-tutorial-done]').onclick=dismiss;
      var next=card.querySelector('[data-tutorial-next]'),back=card.querySelector('[data-tutorial-back]'),bag=card.querySelector('[data-tutorial-inventory]');
      if(next)next.onclick=function(){if(available())page(index+1);};
      if(back)back.onclick=function(){if(available())page(index-1);};
      if(bag)bag.onclick=function(){if(!available())return;card.remove();showSheet('Equip');};
    }
    page(0);
    if((record.topic==='inventory'||record.topic==='sigils')&&typeof window.MutationObserver==='function'){
      observer=new window.MutationObserver(function(){
        if(!live(record.run,record.hero)||openSheet!=='Equip'){dismiss();return;}
        // Native item cards/redraws may replace panel contents. Resume the same
        // UI step after inspection, without changing saved topic rules.
        if(!modalOpen&&!host.contains(card)){host.insertBefore(card,host.firstChild);page(currentIndex);}
      });
      observer.observe(host,{childList:true,subtree:true});
      if($('modal'))observer.observe($('modal'),{attributes:true,attributeFilter:['class']});
      if($('shade'))observer.observe($('shade'),{attributes:true,attributeFilter:['class']});
    }
    mark(record.run,record.hero,record.topic);
  }
  function contextLesson(record){
    if(record.topic==='gods'){godHudLesson(record);return true;}
    var sheet={faith:'Faith',gods:'Faith',character:'Char',inventory:'Equip',sigils:'Equip'}[record.topic];
    if(!sheet)return false; // A Forge is taught only inside its real modal.
    style();if(openSheet!==sheet)showSheet(sheet);
    // Keep instruction in the real panel's scroll flow, never over its items,
    // stat controls or god rules. Showing a tip itself performs no game action.
    var host=$('m'+sheet);if(!host)return false;
    inlineLesson(record,host);return true;
  }

  function poll(){if(timer===null&&queue.length)timer=setTimeout(function(){timer=null;afterAction();},200);}
  function godHudLesson(record){
    style();active={record:record,sheet:null};
    modalOnClose=function(){active=null;$('modal').classList.remove('tutorial-coach','tutorial-invitation','tutorial-control-tour');clearHighlights();schedule();};
    openModal('Piety and Favor','<p><b>Piety</b> tracks progress toward your next god rank. <b>Favor</b> pays for divine abilities.</p><p>Open <b>Faith</b> to review your deity’s benefits, restrictions and granted prayers.</p>',[{label:'Got it',cls:'primary',fn:closeModal}],'getting-started');
    $('modal').classList.add('tutorial-coach','tutorial-invitation','tutorial-control-tour');
    var hud=$('hud2'),piety=hud&&hud.querySelector('.study-piety'),favor=hud&&hud.querySelector('.study-favor');
    if(piety&&piety.getBoundingClientRect().width===0)piety=null;
    var target=highlight(piety||$('studyPietyBar'));
    [favor,$('studyPietyBar'),$('studyRank')].forEach(function(el){if(el&&highlights.indexOf(el)<0){el.classList.add('tutorial-focus');highlights.push(el);}});
    placeTip($('modal').querySelector('.mbox'),target);mark(record.run,record.hero,'gods');
  }
  function invitation(topic){return {character:['Level up!','You have new stat points. Open Character to learn about stats, abilities and passives.','Open Character'],inventory:['Item picked up','Learn more about your inventory?','Learn more'],sigils:['Sigil picked up','Learn more about sigils?','Learn more'],faith:['Gods and Faith','Learn more about gods and Faith?','Learn more'],forge:['The Forge','Learn more about using the Forge?','Learn more']}[topic];}
  function inviteInline(record,host){
    style();var text=invitation(record.topic),card=document.createElement('div');card.className='tutorial-inline';card.setAttribute('data-tutorial-invitation',record.topic);
    card.innerHTML='<b>'+text[0]+'</b><p>'+text[1]+'</p><button data-tutorial-learn>Learn more</button> <button data-tutorial-later>Later</button>';
    host.insertBefore(card,host.firstChild);mark(record.run,record.hero,record.topic);
    card.querySelector('[data-tutorial-later]').onclick=function(){card.remove();};
    card.querySelector('[data-tutorial-learn]').onclick=function(){if(!live(record.run,record.hero)||!host.contains(card))return;card.remove();inlineLesson(record,host);};
  }
  function inviteTopic(record){
    style();active={record:record,sheet:null};var accepted=false;
    modalOnClose=function(){
      active=null;$('modal').classList.remove('tutorial-coach','tutorial-invitation','tutorial-control-tour');clearHighlights();
      if(!accepted)mark(record.run,record.hero,record.topic);
      setTimeout(function(){if(accepted&&live(record.run,record.hero)&&!modalOpen&&!openSheet)contextLesson(record);schedule();},0);
    };
    var text=record.topic==='gods'?['Gods and Faith','Learn more about gods?','Learn more']:invitation(record.topic);
    openModal(text[0],'<p>'+text[1]+'</p>',[
      {label:'Later',fn:closeModal},
      {label:text[2],cls:'primary',fn:function(){if(live(record.run,record.hero)){accepted=true;closeModal();}}}
    ],'getting-started');
    $('modal').classList.add('tutorial-coach','tutorial-invitation');
  }
  function drain(){
    queue=queue.filter(function(record){return live(record.run,record.hero)&&!seen(record.run,record.topic);});
    if(!enabled()){queue=[];return;}if(!queue.length||active)return;
    if(typeof gameTurns!=='undefined'&&gameTurns.busy()){afterAction();return;}
    var inlineIndex=queue.findIndex(function(record){return !!inlineHost(record.topic);});
    if(inlineIndex>=0){var inline=queue.splice(inlineIndex,1)[0];inviteInline(inline,inlineHost(inline.topic));drain();return;}
    if(modalOpen||openSheet||['title','create'].some(function(id){var el=$(id);return el&&el.classList.contains('on');})){poll();return;}
    var record=queue.shift();if(record.topic==='basics')beginBasics(null,record);
    else if(record.topic==='forge')drain(); // A departed Forge cannot teach its screen.
    else inviteTopic(record);
  }
  function afterAction(){
    if(!queue.length||active)return;
    if(waiting&&live(waiting.run,waiting.hero))return;
    if(typeof afterTurn==='function'){
      var token={run:RUN,hero:player};waiting=token;
      afterTurn(function(){if(waiting!==token)return;waiting=null;drain();});
    }else drain();
  }
  function schedule(){
    // Native pickup/XP hooks can fire before their caller starts the enemy phase.
    // Let that command finish dispatching before joining the real turn boundary.
    if(task===null)task=setTimeout(function(){task=null;afterAction();},0);
  }
  function offer(topic){
    if(!topics[topic]||!enabled()||!live(RUN,player)||seen(RUN,topic))return false;
    if(topic==='gods'&&!player.god)return false;
    if(active&&active.record&&active.record.run===RUN&&active.record.topic===topic||queue.some(function(record){return record.run===RUN&&record.hero===player&&record.topic===topic;}))return false;
    queue.push({topic:topic,run:RUN,hero:player});schedule();return true;
  }
  function onRunStarted(){
    if(!live(RUN,player)||!enabled()||modalOpen||['title','create'].some(function(id){var el=$(id);return el&&el.classList.contains('on');}))return false;
    var offered=offer('basics');if(player.cls==='cleric')offer('gods');
    if(offered)log('Time waits for you. Replay the tutorial from Options.','c-info');return offered;
  }
  return Object.freeze({show:show,onRunStarted:onRunStarted,offer:offer,enabled:enabled,setEnabled:setEnabled});
})();
function startGame(){
  if(GAME_STARTED)return GAME_START_READY;
  GAME_STARTED=true;
  /* sandbox: replace the old preset picker with a new-character button and testing tools */
  var pre=$('preset'); if(pre && pre.parentNode) pre.parentNode.style.display='none';
  var sb=document.querySelector('#mSand .sandbox');
  if(sb){
    var extra=document.createElement('div'); extra.style.display='contents';
    extra.innerHTML='<div class="field"><label>Character</label><button id="bCreate">New character</button></div>'+
      '<div class="field"><label for="jump">Jump to floor</label><select id="jump"><option value="">&mdash;</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></div>'+
      '<div class="field"><label>Motes</label><button id="bMotes">One of each</button></div>'+
      '<div class="field"><label>Essence</label><button id="bEss">+100</button></div>'+
      '<div class="field"><label>Heal</label><button id="bHeal">Full HP and mana</button></div>';
    sb.insertBefore(extra, sb.firstChild);
  }
  $('bCreate').onclick=function(){ showSheet(openSheet); openCreate(); };
  $('jump').onchange=function(){ var n=+this.value; if(!n) return; floorNo=n-1; if(n===1){ floorNo=1; generate(worldSeed+7); player._lx=undefined; floorIntro(); resize(); updateUI(); } else descend(); showSheet(openSheet); this.value=''; };
  $('bMotes').onclick=function(){ ELEMENTS.forEach(function(e){ player.motes[e]=(player.motes[e]||0)+1; }); log('A mote of every element appears in your pouch.','c-good'); updateUI(); refreshSheet(); };
  $('bEss').onclick=function(){ player.essence+=100; updateUI(); refreshSheet(); };
  $('bHeal').onclick=function(){ player.hp=player.maxhp; player.mp=player.maxmp; player.hunger=HUNGER_MAX; updateUI(); };
  $('bNew').onclick=function(){ worldSeed=(worldSeed*48271+11)>>>0; generate(worldSeed); player._lx=undefined; floorIntro(); resize(); updateUI(); };
  $('bSpawn').onclick=function(){
    var c=nearFree(player.x,player.y,4); if(!c) return;
    var m=spawn(rollMonster(), c.x, c.y); m.state='hunt'; log('A '+m.name+' arrives.','c-info'); draw(); updateUI();
  };
  $('bGive').onclick=function(){
    var g=randomGear(), e=bagEntryFor(g);
    if(e && addBag(e[0],e[1],e[2])) log('A <b>'+e[1]+'</b> appears in your bag.','c-good');
    updateUI(); refreshSheet();
  };
  $('bLevel').onclick=function(){ gainXP(player.xpNext-player.xp,{earned:false}); updateUI(); };
  $('bAgain').onclick=function(){ $('over').style.display='none'; openCreate(); };

  /* left-click an open door right next to you to shut it; clicking past it still walks through */
  window.addEventListener('click', function(ev){
    if(ev.target!==cv || uiOpen() || aiming || !player || (RUN && (RUN.over||RUN.victory))) return;
    var r=cv.getBoundingClientRect();
    var mx=camX+Math.floor((ev.clientX-r.left+camOX)/TS), my=camY+Math.floor((ev.clientY-r.top+camOY)/TS);
    /* something standing in the doorway (an enemy to attack, an ally, an item): let the click act normally */
    if(at(mx,my)===OPEN && Math.max(Math.abs(mx-player.x),Math.abs(my-player.y))===1 && doorClosable(mx,my)){ ev.stopImmediatePropagation(); ev.preventDefault(); closeDoorAt(mx,my); updateUI(); }
  }, true);

  /* right-click an open door beside you to shut it (right-click still cancels aiming first) */
  cv.addEventListener('contextmenu', function(ev){
    if(document.body.classList.contains('touch'))return;
    if(uiOpen() || aiming || !player || (RUN && (RUN.over||RUN.victory))) return;
    var r=cv.getBoundingClientRect();
    var mx=camX+Math.floor((ev.clientX-r.left+camOX)/TS), my=camY+Math.floor((ev.clientY-r.top+camOY)/TS);
    if(at(mx,my)===OPEN && doorClosable(mx,my)){ ev.preventDefault(); closeDoorAt(mx,my); updateUI(); }
  });

  var bl=$('bLight');
  if(bl){
    bl.textContent='Lighting: '+(lightingOn()?'on':'off');
    bl.onclick=function(){ try{ localStorage.setItem('astra-temple-light', lightingOn()?'off':'on'); }catch(e){} bl.textContent='Lighting: '+(lightingOn()?'on':'off'); draw(); };
  }

  /* The world behind the title is a preview. Only an explicit Begin or
     successful Continue offers the first-play guide. */
  newRun(Date.now()%1000000, CHOICE);
  setMotion(ANIM.mode);
  requestAnimationFrame(resize);
  requestAnimationFrame(fxTick);
  setTimeout(resize, 150);
  /* Required artwork for this scene settles before ready/title. */
  GAME_START_READY=preloadArt(function(){FoteLifecycle.ready();openTitle();});
  return GAME_START_READY;
}

/* Request native appearance selectors for the current residents, including
 * sleeping/concealed actors. Existing draw/UI requests cover current objects.
 * This is a startup set, not a list of every floor visited during a run. */
function startupSceneAtlasFiles(){
  if(typeof statusIconFiles==='function')statusIconFiles().forEach(function(file){atl(file);});
  var look=typeof playerCastLook==='function'?playerCastLook():player&&player.look;
  if(look){castSheet(look);var spec=AS.cast&&AS.cast[look];if(spec&&spec.doll)atl('cast-'+look+'-doll.webp');}
  var residents=(typeof ents!=='undefined'?ents:[]).concat(floorMeta&&floorMeta.buriedGhouls||[],floorMeta&&floorMeta.maw&&floorMeta.maw.ent||[],floorMeta&&floorMeta.pendingLich&&floorMeta.pendingLich.entity||[]);
  residents.forEach(function(actor){
    if(!actor||actor===player||actor.hp<=0&&!(floorMeta&&floorMeta.pendingLich&&actor===floorMeta.pendingLich.entity))return;
    if(actor.shadowClone){castSheet(actor.cloneLook);return;}
    if(actor.livingFlame){atl('living-flame.webp');return;}
    if(typeof isShadeSummon==='function'&&isShadeSummon(actor)){shadeSummonSheet();return;}
    if(actor.base&&actor.base.sprite)mobSheet(actor.base.sprite);
  });
  return Object.keys(ATL);
}
/* Await only the starting view. Once ready, the render owner continues warming
 * current-floor artwork in the bounded atlas queue; visible requests retain
 * priority and failed assets retain the explicit retry path. */
function preloadArt(done){
  var veil=document.createElement('div'); veil.id='loadVeil';
  veil.setAttribute('data-fote-startup','');
  veil.style.cssText='position:fixed;inset:0;z-index:99;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#0B0A09;color:#A79C93;font:calc(14px + var(--ui-mobile-text-add,0px)) sans-serif';
  var title=document.createElement('h1'); title.textContent='Forge of the Elements'; veil.appendChild(title);
  var status=document.createElement('p'); status.setAttribute('role','status'); veil.appendChild(status);
  var retry=document.createElement('button'); retry.textContent='Retry loading'; retry.hidden=true; veil.appendChild(retry);
  document.body.appendChild(veil);
  var scriptsReady=new Promise(function(resolve){
    if(document.readyState==='complete') resolve();
    else window.addEventListener('load',resolve,{once:true});
  });
  var resolveReady,rejectReady,finished=false,loading=false,completion=new Promise(function(resolve,reject){resolveReady=resolve;rejectReady=reject;});
  async function awaitFiles(files){
    if(typeof setAtlasProtectedFiles==='function')setAtlasProtectedFiles(files);
    var loaded=0;await Promise.all(files.map(function(file){return atlReady(file,{retry:true}).then(function(){loaded++;status.textContent='Loading this scene '+loaded+' / '+files.length;});}));
  }
  async function attempt(){
    if(loading||finished)return;loading=true;
    retry.hidden=true; status.textContent='Lighting the torches…';
    try{
      if(!window.ASSETS||!Array.isArray(ASSETS.files)||!ASSETS.files.length)throw Error('The artwork manifest could not be loaded.');
      await scriptsReady;await awaitFiles(startupSceneAtlasFiles());
      // Environment sources have their own caches. Prepare them in order and
      // request only current terrain, instead of decoding all biomes and Chaos.
      await FoteEnvironmentProps.ensureAssets();await FoteEnvironmentDeco.ensureAssets();await FoteEnvironmentVegetation.ensureAssets();await FoteEnvironmentTerrain.ensureAssets();
      if(typeof FoteChaosCampaign!=='undefined'&&floorMeta&&(floorMeta.chaosCampaign||floorMeta.chaosPreview||floorMeta.chaosEntryPreview)){status.textContent='Preparing this part of the Realm of Chaos…';await FoteChaosCampaign.prepare();}
      if(typeof FotePortraitAnimation!=='undefined'&&typeof FotePortraitAnimation.retry==='function')await FotePortraitAnimation.retry(player.look);
      if(document.fonts)await document.fonts.ready;
      var previous=null,stable=false;
      for(var pass=0;pass<6;pass++){
        var files=startupSceneAtlasFiles().sort();await awaitFiles(files);
        await new Promise(function(resolve){requestAnimationFrame(function(){resize();draw();requestAnimationFrame(resolve);});});
        var discovered=startupSceneAtlasFiles().sort().join('|');
        if(discovered===files.join('|')&&discovered===previous){stable=true;break;}previous=discovered;
      }
      if(!stable)throw Error('This scene is still requesting artwork. Retry loading.');
      finished=true;
      try{done();if(typeof setAtlasProtectedFiles==='function')setAtlasProtectedFiles([]);veil.remove();resolveReady();}catch(error){veil.remove();rejectReady(error);}
    }catch(error){status.textContent='Could not prepare this scene: '+String(error.message||error)+' Retry loading.';retry.hidden=false;}
    finally{loading=false;}
  }
  retry.onclick=attempt; attempt();
  return completion;
}
