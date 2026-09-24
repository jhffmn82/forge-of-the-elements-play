/* Composition root: install definitions, create services, then start exactly once. */
(function(root){
  'use strict';
  const initializers=[];let ready=false;
  root.FoteLifecycle=Object.freeze({
    whenReady(fn){if(ready)fn();else initializers.push(fn);},
    ready(){if(ready)return;ready=true;for(const fn of initializers.splice(0))fn();}
  });
  const version=document.querySelector('meta[name="fote-build"]')?.content||'dev';
  function load(path){return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=path+'?v='+encodeURIComponent(version==='dev'?Date.now():version);
    function cleanup(){root.removeEventListener('error',onError);}
    function onError(event){if(event.filename===script.src){cleanup();reject(event.error||new Error('Could not initialize '+path));}}
    root.addEventListener('error',onError);
    script.onload=()=>{cleanup();resolve();};script.onerror=()=>{cleanup();reject(new Error('Could not load '+path));};
    document.head.appendChild(script);
  });}
  root.FoteReady=(async()=>{
    if(!root.FOTE_RUNTIME||!Array.isArray(FOTE_RUNTIME.modules))throw new Error('Runtime manifest is missing.');
    for(const path of FOTE_RUNTIME.modules){
      if(!FOTE_RUNTIME.development&&path==='js/sandbox-builds.js')continue;
      await load(path);
    }
    if(!FOTE_RUNTIME.development)await load('js/public-mode.js');
    startGame();
  })();
  root.FoteReady.catch(error=>{
    console.error(error);
    const panel=document.createElement('div');
    panel.style.cssText='position:fixed;inset:0;z-index:100;display:grid;place-content:center;gap:16px;background:#0B0A09;color:#F6E7B0;font:16px sans-serif;text-align:center';
    const text=document.createElement('p');text.textContent='The game could not finish loading. Please reload to try again.';
    const retry=document.createElement('button');retry.textContent='Reload';retry.onclick=()=>location.reload();
    panel.append(text,retry);document.body.append(panel);
  });
})(window);
