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
    const paths=FOTE_RUNTIME.modules.filter(path=>FOTE_RUNTIME.development||!(FOTE_RUNTIME.developmentOnly||['js/sandbox-builds.js']).includes(path));
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
    for(let i=0;i<paths.length;i++){
      await load(paths[i],urls&&urls[i]);
      progress.textContent='Loading game… '+Math.round((i+1)/paths.length*100)+'%';
    }
    startGame();
    veil.remove();
  })();
  root.FoteReady.catch(error=>{
    veil.remove();
    console.error(error);
    const panel=document.createElement('div');
    panel.style.cssText='position:fixed;inset:0;z-index:100;display:grid;place-content:center;gap:16px;background:#0B0A09;color:#F6E7B0;font:16px sans-serif;text-align:center';
    const text=document.createElement('p');text.textContent='The game could not finish loading. Please reload to try again.';
    const retry=document.createElement('button');retry.textContent='Reload';retry.onclick=()=>location.reload();
    panel.append(text,retry);document.body.append(panel);
  });
})(window);
