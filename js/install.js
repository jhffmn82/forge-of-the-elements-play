/* Installation uses the browser's native controls. Keep offline support available. */
if(location.protocol==='https:'&&'serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(function(e){console.warn('Offline registration failed',e);});
