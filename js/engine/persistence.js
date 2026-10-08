/* Decode and migrate a candidate run as one transaction. Storage and UI are adapters. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('../vendor/fflate-0.8.2.js'):root.fflate);if(typeof module==='object'&&module.exports)module.exports=api;else root.FotePersistence=api;})(globalThis,function(compression){
  'use strict';
  const storageFormat='fote-gzip-1',maxStorageBytes=128*1024*1024;
  const storageKeys=Object.freeze(['astra-temple-save-auto','astra-temple-save-1','astra-temple-save-2','astra-temple-save-3','astra-temple-rescue',
    'astra-temple-sandbox-save-auto','astra-temple-sandbox-save-1','astra-temple-sandbox-save-2','astra-temple-sandbox-save-3']);
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const crcTable=new Uint32Array(256);
  for(let i=0;i<256;i++){let c=i;for(let n=0;n<8;n++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);crcTable[i]=c;}
  function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
  function toBase64(bytes){
    const chunks=[];let chunk='';
    for(let i=0;i<bytes.length;i+=3){const a=bytes[i],b=bytes[i+1],c=bytes[i+2];chunk+=alphabet[a>>2]+alphabet[((a&3)<<4)|((b||0)>>4)]+(b===undefined?'=':alphabet[((b&15)<<2)|((c||0)>>6)])+(c===undefined?'=':alphabet[c&63]);if(chunk.length>=8192){chunks.push(chunk);chunk='';}}
    chunks.push(chunk);return chunks.join('');
  }
  function fromBase64(text){
    if(typeof text!=='string'||text.length%4||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text))throw new Error('Invalid compressed save.');
    const bytes=new Uint8Array(text.length/4*3-(text.endsWith('==')?2:text.endsWith('=')?1:0));let at=0;
    for(let i=0;i<text.length;i+=4){const n=(alphabet.indexOf(text[i])<<18)|(alphabet.indexOf(text[i+1])<<12)|((text[i+2]==='='?0:alphabet.indexOf(text[i+2]))<<6)|(text[i+3]==='='?0:alphabet.indexOf(text[i+3]));if(at<bytes.length)bytes[at++]=n>>16;if(at<bytes.length)bytes[at++]=n>>8;if(at<bytes.length)bytes[at++]=n;}
    return bytes;
  }
  function uint32(bytes,at){return (bytes[at]|bytes[at+1]<<8|bytes[at+2]<<16|bytes[at+3]<<24)>>>0;}
  function unpackStorage(raw){
    const envelope=JSON.parse(raw);if(!envelope||!envelope.storage)return raw;
    if(envelope.storage!==storageFormat||envelope.encoding!=='utf16le'||!Number.isInteger(envelope.bytes)||envelope.bytes<0||envelope.bytes>maxStorageBytes||envelope.bytes%2)throw new Error('Unsupported compressed save.');
    const packed=fromBase64(envelope.data);
    if(packed.length<18||uint32(packed,packed.length-4)!==envelope.bytes)throw new Error('Incomplete compressed save.');
    const bytes=compression.gunzipSync(packed,{out:new Uint8Array(envelope.bytes)});
    if(bytes.length!==envelope.bytes||crc32(bytes)!==uint32(packed,packed.length-8))throw new Error('Damaged compressed save.');
    const chunks=[];for(let at=0;at<bytes.length;at+=16384){const codes=[];for(let i=at;i<Math.min(bytes.length,at+16384);i+=2)codes.push(bytes[i]|bytes[i+1]<<8);chunks.push(String.fromCharCode.apply(null,codes));}
    const text=chunks.join('');JSON.parse(text);return text;
  }
  function packStorage(raw){
    if(typeof raw!=='string')throw new Error('Save storage requires JSON text.');
    // UTF-16 preserves every JS code unit, including unusual names in old saves.
    if(raw.length*2>maxStorageBytes)throw new Error('Save is too large for browser storage.');
    const bytes=new Uint8Array(raw.length*2);for(let i=0;i<raw.length;i++){const code=raw.charCodeAt(i);bytes[i*2]=code;bytes[i*2+1]=code>>>8;}
    const packed=JSON.stringify({storage:storageFormat,encoding:'utf16le',bytes:bytes.length,data:toBase64(compression.gzipSync(bytes,{level:1,mtime:0}))});
    if(packed.length>=raw.length)return raw;
    // Never replace a stored run with an encoding that has not round-tripped.
    if(unpackStorage(packed)!==raw)throw new Error('Save compression verification failed.');
    return packed;
  }
  function quotaError(error){return !!error&&(error.name==='QuotaExceededError'||error.name==='NS_ERROR_DOM_QUOTA_REACHED'||error.code===22||error.code===1014);}
  function compactStorage(storage){
    let compacted=0;
    for(const key of storageKeys){
      try{
        const raw=storage.getItem(key);if(!raw)continue;
        const document=JSON.parse(raw);if(document.storage||!((document.format==='fote-save-1'&&document.state)||(document.format==='fote-rescue-1'&&document.globals)))continue;
        const packed=packStorage(raw);if(packed.length>=raw.length)continue;
        // setItem is atomic: a denied replacement leaves the old bytes intact.
        storage.setItem(key,packed);compacted++;
      }catch(error){/* Corrupt/denied slots remain exactly as they were. */}
    }
    return compacted;
  }
  function writeStorage(storage,key,raw){
    const packed=packStorage(raw);
    try{storage.setItem(key,packed);}catch(error){if(!quotaError(error))throw error;compactStorage(storage);storage.setItem(key,packed);}
    return true;
  }
  function restore(document,services){
    if(!document)throw new Error('No save data.');
    if(document.storage)document=JSON.parse(unpackStorage(JSON.stringify(document)));
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
  return Object.freeze({restore,packStorage,unpackStorage,writeStorage,compactStorage,quotaError});
});
