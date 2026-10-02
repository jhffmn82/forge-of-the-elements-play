/* A bounded, transient projection of log entries. The original log owns history
 * and saves; this view owns only presentation time, never world/action time. */
(function(root,factory){
  var create=factory();
  if(typeof module==='object'&&module.exports)module.exports={create:create};
  else root.FoteCombatLog=create({document:root.document,
    onOpenHistory:function(){if(typeof root.stopTravel==='function')root.stopTravel();if(typeof root.stopRest==='function')root.stopRest();},
    onHistoryChange:function(){if(root.FoteResponsiveHUD)root.FoteResponsiveHUD.syncTouchControls();}});
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  return function create(options){
    options=options||{};
    var doc=options.document||null,now=options.now||function(){return Date.now();};
    var later=options.setTimer||function(fn,ms){return setTimeout(fn,ms);};
    var cancel=options.clearTimer||function(id){clearTimeout(id);};
    var recent=null,enabled=false,history=false,entries=[],sequence=0,batch=0,pending=false,inTurn=false,turnEnded=false;
    var timer=null,closeTimer=null,ordinaryAge=14000,warningAge=18000,fadeAge=3000;
    function clearTimer(){if(timer!==null){cancel(timer);timer=null;}}
    function clearClose(){if(closeTimer!==null){cancel(closeTimer);closeTimer=null;}}
    function trim(){
      var time=now();entries=entries.filter(function(e){return e.expiresAt>time||inTurn&&e.batch===batch;});
      // The turn window and reading timer bound this view. A busy turn must
      // retain every result rather than silently discard its first attacks.
    }
    function state(){
      var time=now(),live=entries.filter(function(e){return e.expiresAt>time||inTurn&&e.batch===batch;});
      return {enabled:enabled,history:history,visible:enabled&&!history&&live.length>0,
        entries:live.map(function(e){return {id:e.id,html:e.html,cls:e.cls,warning:e.warning,expiresAt:e.expiresAt,fading:!(inTurn&&e.batch===batch)&&time>=e.expiresAt-fadeAge};})};
    }
    function mount(target){
      if(!doc)return null;
      recent=typeof target==='string'?doc.getElementById(target):target||doc.getElementById('studyRecentLog');
      if(!recent){recent=doc.createElement('div');recent.id='studyRecentLog';doc.body.appendChild(recent);}
      recent.setAttribute('role','log');recent.setAttribute('aria-live','polite');recent.setAttribute('aria-atomic','false');
      recent.style.pointerEvents='none';render();return recent;
    }
    function render(){
      if(doc&&doc.body)doc.body.classList.toggle('study-log-history',history);
      if(!recent)return;
      var view=state();recent.hidden=!view.visible;recent.dataset.visible=String(view.visible);recent.dataset.history=String(history);
      // Reuse unchanged lines so aging/turn refreshes do not reannounce a log.
      var children=Array.from(recent.children),wanted=view.entries.map(function(e){return String(e.id);});
      children.forEach(function(child){if(wanted.indexOf(child.dataset.entry)<0)recent.removeChild(child);});
      view.entries.forEach(function(entry){
        var child=Array.from(recent.children).find(function(n){return n.dataset.entry===String(entry.id);});
        if(!child){child=doc.createElement('div');child.dataset.entry=String(entry.id);child.className='study-recent-line '+entry.cls;child.innerHTML=entry.html;child.style.transition='opacity '+fadeAge+'ms ease';recent.appendChild(child);}
        child.dataset.priority=entry.warning?'warning':'normal';child.style.opacity=entry.fading?'0':'1';
      });
      recent.scrollTop=recent.scrollHeight;
    }
    function refresh(){
      clearTimer();trim();render();
      var time=now(),next=Infinity;
      entries.forEach(function(e){if(!(inTurn&&e.batch===batch))next=Math.min(next,time<e.expiresAt-fadeAge?e.expiresAt-fadeAge:e.expiresAt);});
      if(Number.isFinite(next))timer=later(function(){timer=null;refresh();},Math.max(1,next-time));
    }
    function beginBatch(){
      clearClose();batch++;pending=true;turnEnded=false;
      // Keep this command and the preceding two, including quiet turns.
      // Warnings receive more reading time, but never outlive this turn window.
      entries=entries.filter(function(e){return e.batch>=batch-2&&e.expiresAt>now();});refresh();
    }
    function settle(){
      clearClose();
      // All synchronous weapon hands and cast results belong to one command,
      // including an area result emitted after a synchronous enemy phase.
      closeTimer=later(function(){closeTimer=null;if(!inTurn)pending=false;},0);
    }
    function beginAction(){if(!inTurn&&(!pending||turnEnded))beginBatch();}
    function beginTurn(){if(!pending||turnEnded)beginBatch();clearClose();inTurn=true;refresh();}
    function finishTurn(){
      inTurn=false;turnEnded=true;
      entries.forEach(function(e){if(e.batch===batch)e.expiresAt=now()+(e.warning?warningAge:ordinaryAge);});
      refresh();settle();
    }
    function onEntry(html,cls,meta){
      meta=meta||{};if(meta.transient===false)return;
      if(!pending&&!inTurn)beginBatch();
      var warning=meta.priority==='warning'||cls==='c-danger'||cls==='c-warning';
      entries.push({id:++sequence,batch:batch,html:String(html),cls:cls||'c-info',warning:warning,expiresAt:now()+(warning?warningAge:ordinaryAge)});
      entries.forEach(function(e){if(e.batch===batch)e.expiresAt=now()+(e.warning?warningAge:ordinaryAge);});
      refresh();if(!inTurn)settle();
    }
    function historyChanged(){if(options.onHistoryChange)options.onHistoryChange(history);}
    function setTransient(value){var wasHistory=history;enabled=!!value;if(!enabled)history=false;if(enabled&&!recent)mount();refresh();if(wasHistory!==history)historyChanged();}
    function showHistory(){var changed=!history;if(changed&&options.onOpenHistory)options.onOpenHistory();history=true;render();var log=doc&&doc.getElementById('log');if(log)log.scrollTop=log.scrollHeight;if(changed)historyChanged();}
    function hideHistory(){var changed=history;history=false;refresh();if(changed)historyChanged();}
    function toggleHistory(){if(history)hideHistory();else showHistory();return history;}
    function reset(){var wasHistory=history;clearTimer();clearClose();entries=[];pending=false;inTurn=false;turnEnded=false;history=false;batch++;render();if(wasHistory)historyChanged();}
    return Object.freeze({mount:mount,setTransient:setTransient,onEntry:onEntry,beginAction:beginAction,finishAction:settle,
      beginTurn:beginTurn,finishTurn:finishTurn,showHistory:showHistory,hideHistory:hideHistory,toggleHistory:toggleHistory,reset:reset,state:state});
  };
});
