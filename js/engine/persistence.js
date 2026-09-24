/* Decode and migrate a candidate run as one transaction. Storage and UI are adapters. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FotePersistence=api;})(globalThis,function(){
  'use strict';
  function restore(document,services){
    if(!document)throw new Error('No save data.');
    const encoded=document.format==='fote-save-1'?document.state:document.format==='fote-rescue-1'?document.globals:null;
    if(!encoded)throw new Error('Not a Forge of the Elements save.');
    const candidate=services.decode(encoded);services.validate(candidate);
    const previous=services.state.snapshot(),random=services.getRandom();
    services.state.replace(candidate);
    try{
      services.restoreRandom(document,candidate);
      for(const migrate of services.migrations)migrate();
      services.recompute();
      services.validate(services.state.snapshot());
    }catch(error){services.state.replace(previous);services.setRandom(random);throw error;}
    return services.state.snapshot();
  }
  return Object.freeze({restore});
});
