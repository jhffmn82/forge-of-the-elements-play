/* Composition root: install definitions, create services, then start exactly once. */
(function(root){
  'use strict';
  const initializers=[];let ready=false;
  root.FoteLifecycle=Object.freeze({
    whenReady(fn){if(ready)fn();else initializers.push(fn);},
    ready(){if(ready)return;ready=true;for(const fn of initializers.splice(0))fn();}
  });
  const version=document.querySelector('meta[name="fote-build"]')?.content||'dev';
  const veil=document.createElement('div');veil.id='moduleLoadVeil';
  veil.style.cssText='position:fixed;inset:0;z-index:99;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#0B0A09;color:#A79C93;font:14px sans-serif';
  const heading=document.createElement('h1');heading.textContent='Forge of the Elements';
  const progress=document.createElement('p');progress.setAttribute('role','status');progress.textContent='Loading game…';
  veil.append(heading,progress);document.body.appendChild(veil);
  function moduleURL(path){return path+'?v='+encodeURIComponent(version==='dev'?Date.now():version);}
  function load(path,url){return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=url||moduleURL(path);
    function cleanup(){root.removeEventListener('error',onError);}
    function onError(event){if(event.filename===script.src){cleanup();reject(event.error||new Error('Could not initialize '+path));}}
    root.addEventListener('error',onError);
    script.onload=()=>{cleanup();resolve();};script.onerror=()=>{cleanup();reject(new Error('Could not load '+path));};
    document.head.appendChild(script);
  });}
  root.FoteReady=(async()=>{
    if(!root.FOTE_RUNTIME||!Array.isArray(FOTE_RUNTIME.modules))throw new Error('Runtime manifest is missing.');
    const paths=FOTE_RUNTIME.modules.filter(path=>FOTE_RUNTIME.development||!FOTE_RUNTIME.developmentOnly.includes(path));
    let urls=null;
    if(!FOTE_RUNTIME.development){
      paths.push('js/public-mode.js');
      urls=paths.map(moduleURL);
      // Warm the exact script URLs in parallel, while load() below retains the
      // existing execution order and stops initialization at the first failure.
      // Development keeps its per-request cache busting and normal load path.
      for(const url of urls){
        const hint=document.createElement('link');hint.rel='preload';hint.as='script';hint.href=url;
        document.head.appendChild(hint);
      }
    }
    // Stalled means 60 s with no file at all arriving: the scripts download in
    // parallel, so on a slow line one module can wait over a minute behind the
    // others while bytes keep coming in. A slow module is only reported, never
    // requested again: a second copy of a script that is still arriving could
    // execute twice. Reload restarts cleanly.
    let lastArrival=Date.now(),stalled=null,arrivals=null;
    const arrived=()=>{lastArrival=Date.now();if(stalled){stalled.remove();stalled=null;}};
    try{arrivals=new PerformanceObserver(arrived);arrivals.observe({type:'resource'});}catch(e){}
    const watch=setInterval(()=>{if(!stalled&&Date.now()-lastArrival>=60000)stalled=reloadPanel('Loading has stalled. Keep waiting, or reload to try again.');},1000);
    try{
      for(let i=0;i<paths.length;i++){
        const percent=Math.round(i/paths.length*100)+'%';
        const slow=setTimeout(()=>{progress.textContent='Loading game… '+percent+' (slow connection, still loading)';},10000);
        try{await load(paths[i],urls&&urls[i]);}
        finally{clearTimeout(slow);arrived();}
        progress.textContent='Loading game… '+Math.round((i+1)/paths.length*100)+'%';
      }
    }finally{clearInterval(watch);if(arrivals)arrivals.disconnect();}
    startGame();
    veil.remove();
  })();
  function reloadPanel(message){
    const panel=document.createElement('div');
    panel.style.cssText='position:fixed;inset:0;z-index:100;display:grid;place-content:center;gap:16px;background:#0B0A09;color:#F6E7B0;font:16px sans-serif;text-align:center';
    const text=document.createElement('p');text.textContent=message;
    const retry=document.createElement('button');retry.textContent='Reload';retry.onclick=()=>location.reload();
    panel.append(text,retry);document.body.append(panel);return panel;
  }
  root.FoteReady.catch(error=>{
    veil.remove();
    console.error(error);
    reloadPanel('The game could not finish loading. Please reload to try again.');
  });
})(window);
