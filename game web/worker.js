var module={exports:{}};
const V='?v='+Date.now();
importScripts('browserfs.js'+V);
importScripts('shims.js'+V); const installShims=module.exports;
module={exports:{}}; importScripts('vfs.js'+V); self.__vfsFactory=module.exports;
module={exports:{}}; importScripts('d3d11rec.js'+V); self.__d3d11recFactory=module.exports;
module={exports:{}}; importScripts('d3dfake.js'+V); self.__d3dFactory=module.exports;
const loadModule=async f=>{ const src=await (await fetch(f+V)).text(), module={exports:{}};
  new Function('module','exports','require',src+'\n//# sourceURL='+f)(module,module.exports,self.require); return module.exports; };
let translate, createExecutor, jspiInstantiate, createDevice;
importScripts('port.js'+V);
let nImp=0,buf=[],last=0;
const flush=()=>{ if(buf.length){postMessage({t:'log',lines:buf});buf=[];} };
const out=t=>{ if(t.startsWith('[imp]')||t.startsWith('[dyn]')||t.startsWith('[dynidx]')){nImp++;return;} buf.push(t); const n=Date.now(); if(n-last>250||buf.length>200){last=n;flush();} };
const st=s=>{flush();postMessage({t:'status',s});};
const prog=(id,label,frac,text)=>postMessage({t:'progress',id,label,frac,text});
const fetchProgress=async(url,id,label,type)=>{ const r=await fetch(url); if(!r.ok) throw new Error(url+': http '+r.status);
  const total=+r.headers.get('Content-Length')||0, MB=x=>(x/1048576).toFixed(0); let got=0, last=0;
  const counter=new TransformStream({ transform(ch,ctl){ got+=ch.byteLength; const n=performance.now(); if(n-last>100){ last=n; prog(id,label,total?got/total:null,MB(got)+(total?' / '+MB(total):'')+' MB'); } ctl.enqueue(ch); },
    flush(){ prog(id,label,1,MB(got)+' MB'+(type==='application/wasm'?', compiling…':'')); } });
  return new Response(r.body.pipeThrough(counter),{headers:{'Content-Type':type||r.headers.get('Content-Type')||'application/octet-stream'}}); };
let sh=null;
let audioPlayed=0;
const canvasReady=new Promise(r=>{ self.onmessage=e=>{ const d=e.data||{}; if(d.t==='canvas') r(d.canvas); else if(d.t==='input'&&sh&&sh.input){ sh.input(d.ev); inputN++; } else if(d.t==='audio-played') audioPlayed=d.frames; else if(d.t==='prof'&&self.__profNow) self.__profNow(); }; });
let inputN=0;
const nextFrame=()=>new Promise(r=>self.requestAnimationFrame?self.requestAnimationFrame(()=>r()):setTimeout(r,0));
(async()=>{
 try{
  const t0=Date.now(); const el=()=>((Date.now()-t0)/1000).toFixed(1)+'s';
  const qs=new URLSearchParams(self.location.search); let cmd=qs.get('cmd');
  if(cmd===null) cmd='-d3d11 -nothreading';
  const CDN=qs.has('nocdn')?null:await fetch('cdn.json'+V).then(r=>r.ok?r.json():null).then(c=>c&&c.base?c:null).catch(()=>null);
  if(CDN) out('[cdn] big files from '+CDN.base);
  const cdnUrl=p=>CDN.base+p.split('/').map(encodeURIComponent).join('/');
  const fetchRetry=async(url,tries=6)=>{ let e; for(let i=0;i<tries;i++){ try{ const r=await fetch(url); if(r.ok) return r; e=new Error('http '+r.status); }catch(err){ e=err; } if(i<tries-1) await new Promise(r=>setTimeout(r,400*(i+1))); } throw e; };
  const cdnWhole=async(path,id,label)=>{ const meta=CDN.chunked[path];
    if(!meta) return new Uint8Array(await (await fetchRetry(cdnUrl(path))).arrayBuffer());
    const out=new Uint8Array(meta.size); let off=0, lastT=0; const MB=x=>(x/1048576).toFixed(0);
    for(let i=0;i<meta.parts;i++){ const r=await fetchRetry(cdnUrl(path+'.c'+String(i).padStart(3,'0'))).catch(err=>{ throw new Error(path+' c'+i+': '+err.message); });
      const u=new Uint8Array(await r.arrayBuffer()); out.set(u,off); off+=u.length; const n=performance.now(); if(n-lastT>100||i===meta.parts-1){ lastT=n; prog(id,label,off/meta.size,MB(off)+' / '+MB(meta.size)+' MB'); } }
    return out; };
  self.__dxbcFactory=await loadModule('dxbc.js');
  ({translate}=await loadModule('dxbc2wgsl.js')); ({createExecutor}=await loadModule('gpu11.js'));
  ({jspiInstantiate}=await loadModule('jspi.js')); const audioFactory=await loadModule('audiofake.js'); ({createDevice}=await loadModule('gpudevice.js')); const bcdec=await loadModule('bcdec.js');
  const canvas=await canvasReady;
  let device=null, gctx=null;
  const useGpu=!qs.has('nogpu')&&self.navigator&&navigator.gpu&&typeof WebAssembly.Suspending==='function'&&canvas;
  if(useGpu){ try{ device=await createDevice(navigator.gpu,out,{lowEnd:qs.has('lowgpu'),drop:(qs.get('dropgpu')||'').split(',').filter(Boolean)});
      let nErr=0; device.onuncapturederror=e=>{ if(nErr++<30) out('[webgpu] '+e.error.message.split('\n')[0]); }; gctx=canvas.getContext('webgpu'); }
    catch(e){ out('[gpu] unavailable: '+e.message); device=null; } }
  else out('[gpu] rendering off ('+(!canvas?'no OffscreenCanvas':!(self.navigator&&navigator.gpu)?'no WebGPU':typeof WebAssembly.Suspending!=='function'?'no JSPI':'?nogpu')+')');
  st('fetching imports and image.bin (108 MB)…');
  const imps=await (await fetch('imports.json'+V)).json();
  const img=CDN?await cdnWhole('image.bin','img','Game data (image.bin)'):new Uint8Array(await (await fetchProgress('image.bin','img','Game data (image.bin)')).arrayBuffer());
  st('compiling port.wasm (large; can take minutes)… ['+el()+']');
  const miss=new Set();
  const wasmSrc=CDN?(()=>cdnWhole('port.wasm','wasm','Engine code (port.wasm)')):(()=>fetchProgress('port.wasm'+V,'wasm','Engine code (port.wasm)','application/wasm'));
  const m=await Port({print:out,printErr:out,locateFile:f=>f+V,...(device?{instantiateWasm:jspiInstantiate(wasmSrc)}:{}),jsYield:()=>sh.takeYield(),
    jsShim:(k,Rp)=>{ if(boot.on&&((++boot.calls&4095)===0)){ const n=performance.now(); if(n-boot.last>200){ boot.last=n; postMessage({t:'progress',id:'boot',label:'Loading the game',calls:boot.calls}); } }
    const t0=performance.now(); try{ return sh.hook(k,Rp); } finally{ const d=performance.now()-t0; T.host+=d; TK[k]+=d; } },jsMissing:(lo,hi)=>{miss.add(lo+hi*4294967296);return 1;}});
  st('wasm ready ['+el()+']; installing shims…');
  if(m._set_trace) m._set_trace(qs.has('trace')?1:0);
  if(cmd!==null) out('[cmdline] '+cmd);
  const T={host:0,gpu:0,wait:0}, hf={t:0,n:0,ring:[],worst:0,tk:null}, TK=new Float64Array(imps.length+8);
  let presN=0, yieldPres=0, yieldT=0;
  const boot={on:false,calls:0,last:0};
  const prof={on:qs.has('prof'),done:false,p:null,slow:0,t:0};
  self.__profNow=()=>{ if(prof.p&&!prof.done){ out('[prof] already sampling'); return; } prof.on=true; prof.done=false; prof.p=null; prof.slow=3; prof.now=true; out('[prof] will sample 5 s from the next second'); };
  let frames=0, fpsT=0, fpsN=0, ex=null, prev={sh:0,nsh:0,pi:0,npi:0,io:0,ion:0,hit:0,part:0,miss:0};
  sh=installShims(m,imps,{audio:audioFactory,onPcm:(d,ch,rate)=>postMessage({t:'pcm',d,ch,rate},[d.buffer]),audioPlayed:()=>audioPlayed,softStub:true,ring:qs.has('trace'),log:out,hostRoot:'/H',writeRoot:'/W',cmdline:cmd===null?undefined:cmd,vfsLog:qs.get('vfslog')==='1',
    onFrame:device?(n=>{
      if(presN===yieldPres&&performance.now()-yieldT<50) return;
      yieldPres=presN; n=++hf.n; frames=n; const t=performance.now(); if(!fpsT){ fpsT=t; fpsN=n; }
      if(hf.t){ const dt=t-hf.t; hf.ring.push(dt); if(hf.ring.length>31) hf.ring.shift(); hf.worst=Math.max(hf.worst,dt);
        const med=[...hf.ring].sort((a,b)=>a-b)[hf.ring.length>>1];
        if(ex&&hf.ring.length>=10&&dt>Math.max(120,2*med)){ const s=ex.stats(), P=self.__perf||{}, host=T.host-hf.host, gpu=T.gpu-hf.gpu, wait=T.wait-hf.wait,
            shd=s.tShader-hf.sh, pip=s.tPipe-hf.pi, io=(P.io||0)-hf.io;
          out('[hitch] frame '+n+': '+dt.toFixed(0)+' ms (typical '+med.toFixed(0)+'): game code '+(dt-host-wait).toFixed(0)+', d3d/webgpu layer '+(gpu-shd-pip).toFixed(0)+
            ', shaders '+shd.toFixed(0)+' ('+(s.nShader-hf.nsh)+'), pipelines '+pip.toFixed(0)+' ('+(s.nPipe-hf.npi)+'), file reads '+io.toFixed(0)+', other host calls '+(host-gpu-io).toFixed(0)+
            ', waiting for display/GPU '+wait.toFixed(0)+'; draws '+(s.draws-hf.dr)+', input events '+(inputN-hf.inp)+
            '; slowest host calls: '+[...TK.keys()].map(k=>[k,TK[k]-(hf.tk?hf.tk[k]:0)]).sort((a,b)=>b[1]-a[1]).slice(0,6).filter(x=>x[1]>=1).map(([k,v])=>(imps[k]?imps[k][1]:'#'+k)+' '+v.toFixed(0)).join(', ')); } }
      const report=(dt,nf)=>{ const s=ex.stats(), P=self.__perf||{}, sh=s.tShader-prev.sh, pi=s.tPipe-prev.pi, io=(P.io||0)-prev.io;
        if(nf*1000/dt<30) out('[slow] frames '+(n-nf)+'-'+n+': '+(nf*1000/dt).toFixed(1)+' fps; per second: shaders '+(sh*1000/dt).toFixed(0)+' ms ('+(s.nShader-prev.nsh)+'), pipelines '+(pi*1000/dt).toFixed(0)+' ms ('+(s.nPipe-prev.npi)+')'+(s.warmHit||s.warmMiss?' [prewarmed so far: '+(s.warmHit||0)+' used, '+(s.warmMiss||0)+' missed]':'')+', file reads '+(io*1000/dt).toFixed(0)+' ms ('+((P.ioN||0)-prev.ion)+' MB), other '+((dt-sh-pi-io)*1000/dt).toFixed(0)+' ms = game code '+((dt-T.host-T.wait)*1000/dt).toFixed(0)+', d3d/webgpu layer '+((T.gpu-sh-pi)*1000/dt).toFixed(0)+', other host calls '+((T.host-T.gpu-io)*1000/dt).toFixed(0)+', waiting for display/GPU '+(T.wait*1000/dt).toFixed(0)+' ms; draw state reused '+(100*(s.hit-prev.hit)/Math.max(1,s.hit-prev.hit+s.part-prev.part+s.miss-prev.miss)).toFixed(0)+'%, rebound '+(100*(s.part-prev.part)/Math.max(1,s.hit-prev.hit+s.part-prev.part+s.miss-prev.miss)).toFixed(0)+'% (misses so far by cause: '+Object.entries(s.missBy||{}).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v])=>k+' '+v).join(', ')+')');
        prev={sh:s.tShader,nsh:s.nShader,pi:s.tPipe,npi:s.nPipe,io:P.io||0,ion:P.ioN||0,hit:s.hit,part:s.part,miss:s.miss}; };
      if(t-fpsT>=1000&&prof.on&&!prof.done){ const fps=(n-fpsN)*1000/(t-fpsT); if(!prof.p){ prof.slow=prof.now?3:(fps<15?prof.slow+1:0); prof.now=false;
          if(prof.slow>=3){ try{ prof.p=new Profiler({sampleInterval:1,maxBufferSize:200000}); prof.t=t; out('[prof] sampling 5 s at frame '+n); }catch(e){ out('[prof] unavailable: '+e.message); prof.done=true; } } }
        else if(t-prof.t>=5000){ prof.done=true; prof.p.stop().then(tr=>{ const self={}, incl={}, fname=f=>{ const fr=tr.frames[f]; return (fr.name||'(anon)')+' '+((tr.resources[fr.resourceId]||'').split('/').pop().split('?')[0])+':'+(fr.line||''); };
            for(const sm of tr.samples){ if(sm.stackId===undefined){ self['(idle/native)']=(self['(idle/native)']||0)+1; continue; } let st=tr.stacks[sm.stackId], top=true; const seen=new Set();
              while(st){ const nm=fname(st.frameId); if(top){ self[nm]=(self[nm]||0)+1; top=false; } if(!seen.has(nm)){ seen.add(nm); incl[nm]=(incl[nm]||0)+1; } st=st.parentId===undefined?null:tr.stacks[st.parentId]; } }
            const NL=String.fromCharCode(10), N=tr.samples.length, top=(o,k)=>Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,k).map(([nm,c])=>(100*c/N).toFixed(1).padStart(5)+'%  '+nm).join(NL+'  ');
            out('[prof] '+N+' samples; self time:'+NL+'  '+top(self,30)); out('[prof] inclusive (JS):'+NL+'  '+top(incl,30)); }); } }
      if(t-fpsT>=1000){ if(ex) report(t-fpsT,n-fpsN); T.host=T.gpu=T.wait=0; st('running: '+((n-fpsN)*1000/(t-fpsT)).toFixed(1)+' fps, worst frame '+hf.worst.toFixed(0)+' ms (frame '+n+') ['+el()+']'); hf.worst=0; fpsT=t; fpsN=n; }
      if(ex){ const s=ex.stats(), P=self.__perf||{}; hf.tk=TK.slice(); Object.assign(hf,{t:performance.now(),host:T.host,gpu:T.gpu,wait:T.wait,sh:s.tShader,nsh:s.nShader,pi:s.tPipe,npi:s.nPipe,io:P.io||0,dr:s.draws,inp:inputN}); } else hf.t=performance.now(); yieldT=performance.now();
      const w0=performance.now(); return nextFrame().then(()=>{ T.wait+=performance.now()-w0; }); }):undefined});
  if(device){ const rec=sh.d3d().rec, byId=sh.d3d().byId; let bb=null, configured=null;
    ex=createExecutor(device,{bcdec,recordPipes:true,noDrawCache:qs.has('nocache'),translate,resolve:id=>rec.liveObj(id),scopes:false,log:out,onPresent:()=>{ presN++;
      if(!bb){ for(const o of byId.values()) if(o.info&&o.info.backbuffer){ bb=o.id; sh.setInputSize(o.info.w,o.info.h); break; } if(!bb) return; }
      const o=ex.objs.get(bb); if(!o) return; const tex=ex.getTex(o), fmt=ex.texFormat(o).replace('-srgb','');
      if(configured===null){ boot.on=false; postMessage({t:'progress',done:true,calls:boot.calls}); }
      if(configured!==fmt){ canvas.width=o.info.w; canvas.height=o.info.h; gctx.configure({device,format:fmt,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_DST,alphaMode:'opaque'}); configured=fmt; out('[gpu] presenting '+o.info.w+'x'+o.info.h+' '+fmt); }
      const enc=device.createCommandEncoder(); enc.copyTextureToTexture({texture:tex},{texture:gctx.getCurrentTexture()},[o.info.w,o.info.h]); device.queue.submit([enc.finish()]); }});
    rec.addSink({cmd:c=>{ const t0=performance.now(); try{ ex.exec(c); } finally{ T.gpu+=performance.now()-t0; } }});
    const idb=(mode,fn)=>new Promise((res,rej)=>{ const rq=indexedDB.open('aw',1); rq.onupgradeneeded=()=>rq.result.createObjectStore('kv');
      rq.onerror=()=>rej(rq.error); rq.onsuccess=()=>{ const db=rq.result, tx=db.transaction('kv',mode), r=fn(tx.objectStore('kv')); tx.oncomplete=()=>{ db.close(); res(r&&r.result); }; tx.onerror=()=>rej(tx.error); }; });
    const sortKeys=v=>{ if(!v||typeof v!=='object'||Array.isArray(v)) return v; const o={}; for(const k of Object.keys(v).sort()) o[k]=v[k]; return o; };
    const ck=p=>(p.c?'c':'r')+JSON.stringify(JSON.parse(p.d),(k,v)=>sortKeys(v));
    const merge=(a,b)=>{ if(!a) return b; if(!b) return a; const seen=new Set(a.pipes.map(ck)), out={v:1,shaders:{...b.shaders,...a.shaders},pipes:[...a.pipes]};
      for(const p of b.pipes) if(!seen.has(ck(p))) out.pipes.push(p); return out; };
    let savedN=0; setInterval(()=>{ const man=ex.exportPipes(); if(man.pipes.length>savedN){ savedN=man.pipes.length; idb('readwrite',st=>st.put(man,'pipes')).catch(e=>out('[warm] saving the pipeline list failed: '+e.message)); } },30000);
    if(!qs.has('nowarm')) self.__warmReady=(async()=>{
      if(qs.has('forgetpipes')) await idb('readwrite',st=>st.delete('pipes')).catch(()=>{});
      const mine=await idb('readonly',st=>st.get('pipes')).catch(()=>null);
      const shipped=await fetch('pipes.json'+V).then(r=>r.ok?r.json():null).catch(()=>null);
      const man=merge(mine,shipped); if(!man){ out('[warm] no pipeline list'); return; }
      const nf=man.pipes.length;
      out('[warm] compiling '+man.pipes.length+' pipelines in the background ('+(mine?mine.pipes.length:0)+' recorded in this browser, rest from pipes.json)');
      ex.prewarm(man,{inFlight:nf,onDone:r=>out('[warm] '+r.ok+'/'+r.n+' pipelines compiled in '+(r.ms/1000).toFixed(1)+' s')});
    })().catch(e=>out('[warm] failed: '+e.message)); }
  const names=new Set(sh.handled()), nat=new Set(sh.native?sh.native():[]); imps.forEach((e,k)=>{ if(names.has(e[1])&&!nat.has(e[1])) m._override_import(k); });
  const p=m._guest_init(); if(!p){st('guest alloc failed (browser refused the memory)');return;}
  m.HEAPU8.set(img,p);
  const Rp=m._new_regs(); sh.setMem(p,Rp);
  out('data imports faked: '+sh.dataImports(imps,k=>m._data_import(k)));
  for(const dn of ['msvcp140','libogg_64','libvorbis_64','libvorbisfile_64']){
    const jr=await fetch('dll/'+dn+'.json'+V); if(!jr.ok){out('[dll] '+dn+' not staged');continue;}
    const d=await jr.json(); sh.addGuestDll(d); m.HEAPU8.set(new Uint8Array(await (await fetch('dll/'+dn+'.img'+V)).arrayBuffer()),p+d.off);
    let nf=0; imps.forEach((e,k)=>{ if(e[0].toLowerCase()===d.name+'.dll'&&d.exports[e[1]]!==undefined){ m._forward_import(k,d.exports[e[1]]); nf++; } });
    m._set_dll(d.entry,d.off); out('[dll] '+d.name+' at 0x'+d.off.toString(16)+': '+nf+' imports forwarded');
  }
  postMessage({t:'progress',clear:['img','wasm']}); boot.on=true; postMessage({t:'progress',id:'boot',label:'Loading the game',calls:0});
  st('booting entry point… ['+el()+']');
  const b0=Date.now();
  if(self.__warmReady){ let ready=false; await Promise.race([self.__warmReady.then(()=>{ ready=true; }),new Promise(r=>setTimeout(()=>{ if(!ready) out('[warm] pipeline list not ready after 5 s; booting anyway'); r(); },5000))]); }
  const rc=await m._boot(0x4776f70,0x5B634F0,0x5B639E0,0x63F4DC8,0);
  out('missing call targets: '+[...miss].map(a=>(a-0x140000000).toString(16)).join(' '));
  out('import calls: '+nImp+'; frames: '+frames+'; boot took '+((Date.now()-b0)/1000).toFixed(1)+'s');
  st('boot returned '+rc+' ['+el()+' total]');
 }catch(e){ st('stopped: '+(e&&e.status!==undefined?'exit '+e.status:(e&&e.stack)||e)); }
 flush(); postMessage({t:'done'});
})();
