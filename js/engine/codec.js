/* Save graph codec: identity and cycles are preserved across objects, Maps and Sets. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FoteCodec=api;})(globalThis,function(){
  'use strict';
  const arrays={Int8Array,Uint8Array,Uint8ClampedArray,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array};
  function encode(root,ignore=()=>false){
    const ids=new Map();let next=0;
    function visit(value){
      if(value===null||typeof value!=='object'){
        if(typeof value==='function'||typeof value==='symbol'||typeof value==='undefined')return undefined;
        return typeof value==='number'&&!Number.isFinite(value)?{$num:String(value)}:value;
      }
      if(ignore(value))return undefined;
      if(ids.has(value))return {$ref:ids.get(value)};
      const id=++next;ids.set(value,id);
      if(ArrayBuffer.isView(value)){
        if(!arrays[value.constructor.name])throw new Error('Unsupported save array.');
        return {$id:id,$ta:value.constructor.name,d:Array.from(value)};
      }
      if(value instanceof Set)return {$id:id,$set:Array.from(value,visit)};
      if(value instanceof Map)return {$id:id,$map:Array.from(value,([k,v])=>[visit(k),visit(v)])};
      if(Array.isArray(value))return {$id:id,$arr:value.map(v=>visit(v)??null)};
      const out={$id:id};
      for(const key of Object.keys(value)){const v=visit(value[key]);if(v!==undefined)Object.defineProperty(out,key,{value:v,enumerable:true,writable:true,configurable:true});}
      return out;
    }
    return visit(root);
  }
  function decode(root){
    const ids=new Map(),allocated=new WeakMap();
    function allocate(value){
      if(!value||typeof value!=='object'||value.$ref!==undefined||value.$num!==undefined)return;
      if(allocated.has(value))return;
      let out;
      if(value.$ta){const Type=arrays[value.$ta];if(!Type||!Array.isArray(value.d))throw new Error('Invalid saved array.');out=new Type(value.d);}
      else if(value.$set)out=new Set();
      else if(value.$map)out=new Map();
      else if(value.$arr)out=[];
      else out={};
      allocated.set(value,out);
      if(value.$id!==undefined){if(ids.has(value.$id))throw new Error('Duplicate save reference.');ids.set(value.$id,out);}
      if(value.$ta)return;
      for(const [key,child] of Object.entries(value))if(key!=='$id'){
        if(Array.isArray(child))child.forEach(v=>Array.isArray(v)?v.forEach(allocate):allocate(v));
        else allocate(child);
      }
    }
    allocate(root);
    const populated=new WeakSet();
    function visit(value){
      if(!value||typeof value!=='object')return value;
      if(value.$num!==undefined){if(!['NaN','Infinity','-Infinity'].includes(value.$num))throw new Error('Invalid saved number.');return Number(value.$num);}
      if(value.$ref!==undefined){if(!ids.has(value.$ref))throw new Error('Missing save reference.');return ids.get(value.$ref);}
      const out=allocated.get(value);if(!out)throw new Error('Unallocated saved object.');
      if(populated.has(value))return out;populated.add(value);
      if(value.$ta)return out;
      if(value.$arr){for(const child of value.$arr)out.push(visit(child));}
      else if(value.$set){for(const child of value.$set)out.add(visit(child));}
      else if(value.$map){for(const [key,child] of value.$map)out.set(visit(key),visit(child));}
      else for(const key of Object.keys(value))if(key!=='$id')Object.defineProperty(out,key,{value:visit(value[key]),enumerable:true,writable:true,configurable:true});
      return out;
    }
    return visit(root);
  }
  return Object.freeze({encode,decode});
});
