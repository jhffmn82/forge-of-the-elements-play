/* Install remains a user action; support browsers that offer a prompt and those that do not. */
(function(){
  var promptEvent=null;
  function installed(){return matchMedia('(display-mode:standalone)').matches||matchMedia('(display-mode:fullscreen)').matches||navigator.standalone===true;}
  window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();promptEvent=e;});
  window.addEventListener('appinstalled',function(){promptEvent=null;var b=$('installGame');if(b)b.remove();});
  async function install(){
    if(promptEvent){var e=promptEvent;promptEvent=null;await e.prompt();return;}
    openModal('Install Forge of the Elements', '<p>Open this game in Chrome on your Pixel, then use the browser menu → Add to Home screen → Install.</p><p>If this link opened inside another app, choose Open in Chrome first. On iPhone or iPad, open it in Safari and choose Share → Add to Home Screen.</p><p>Wait for “Offline copy ready” before playing without a connection. An already installed app can be opened from your home screen.</p>',[{label:'Close',fn:closeModal}]);
    $('modal').style.zIndex='70';
  }
  var title=renderTitleMenu;
  renderTitleMenu=function(){title();if(installed())return;var b=document.createElement('button');b.id='installGame';b.textContent='Install app';b.onclick=install;$('title').querySelector('.menu').appendChild(b);};
  if(location.protocol==='https:'&&'serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(function(e){console.warn('Offline registration failed',e);});
})();
