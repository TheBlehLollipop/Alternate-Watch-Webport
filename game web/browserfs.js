(function(){
  const MAN=JSON.parse((()=>{const x=new XMLHttpRequest();x.open('GET','manifest.json',false);x.send();return x.responseText;})());
  const dirs=new Set(['']); for(const k of Object.keys(MAN)){ const p=k.split('/'); for(let i=1;i<p.length;i++)dirs.add(p.slice(0,i).join('/')); }
  const mem=new Map(), memDirs=new Set(['']);
  let CDN=null; if(!/[?&]nocdn/.test(self.location.search)) try{ const x=new XMLHttpRequest(); x.open('GET','cdn.json',false); x.send(); if(x.status===200){ const c=JSON.parse(x.responseText); if(c&&c.base) CDN=c; } }catch(e){}
  const encPath=p=>p.split('/').map(encodeURIComponent).join('/');
  const BLK=1<<20, cache=new Map(); let cacheBytes=0;
  const perf=self.__perf||(self.__perf={});
  const fetchRange=(rel,a,b)=>{ const t0=performance.now(); try{ return fetchRange0(rel,a,b); } finally{ perf.io=(perf.io||0)+performance.now()-t0; perf.ioN=(perf.ioN||0)+1; } };
  const httpGet=(url,a,b)=>{ let err;
    for(let t=0;t<6;t++){ const x=new XMLHttpRequest(); x.open('GET',url,false); x.responseType='arraybuffer'; if(a!==undefined) x.setRequestHeader('Range','bytes='+a+'-'+b);
      try{ x.send(); if(x.status===200||x.status===206) return new Uint8Array(x.response); err=new Error('http '+x.status+' '+url); }catch(e){ err=e; }
      if(t<5){ const until=Date.now()+400*(t+1); while(Date.now()<until){} } }
    throw Object.assign(err||new Error('http '+url),{code:'EIO'}); };
  const cdnMeta=(rel)=>{ const path='game/'+rel, c=CDN.chunked[path]; return {path,parts:c?c.parts:1}; };
  const getCdnChunk=(path,parts,ci)=>{ const key=path+'#'+ci; let b=cache.get(key); if(b){cache.delete(key);cache.set(key,b);return b;}
    const t0=performance.now(); b=httpGet(CDN.base+encPath(parts>1?path+'.c'+String(ci).padStart(3,'0'):path)); perf.io=(perf.io||0)+performance.now()-t0; perf.ioN=(perf.ioN||0)+1;
    cache.set(key,b); cacheBytes+=b.length; while(cacheBytes>512*1024*1024&&cache.size>1){ const k=cache.keys().next().value; cacheBytes-=cache.get(k).length; cache.delete(k); } return b; };
  const fetchRange0=(rel,a,b)=>{ if(CDN){ const {path,parts}=cdnMeta(rel), CH=CDN.chunkBytes, out=new Uint8Array(b-a+1); let pos=a;
      while(pos<=b){ const ci=Math.floor(pos/CH), ch=getCdnChunk(path,parts,ci), co=pos-ci*CH, n=Math.min(ch.length-co,b-pos+1); out.set(ch.subarray(co,co+n),pos-a); pos+=n; } return out; }
    return httpGet('game/'+encPath(rel),a,b); };
  const getBlock=(rel,i)=>{ const a=i*BLK, bend=Math.min((i+1)*BLK,MAN[rel]);
    if(CDN){ const {path,parts}=cdnMeta(rel), CH=CDN.chunkBytes, ci=Math.floor(a/CH), ch=getCdnChunk(path,parts,ci), co=a-ci*CH;
      if(co+(bend-a)<=ch.length) return ch.subarray(co,co+(bend-a));
      const out=new Uint8Array(bend-a), first=ch.length-co; out.set(ch.subarray(co),0); out.set(getCdnChunk(path,parts,ci+1).subarray(0,(bend-a)-first),first); return out; }
    const key=rel+'#'+i; let b=cache.get(key); if(b){cache.delete(key);cache.set(key,b);return b;}
    b=fetchRange(rel,a,bend-1); cache.set(key,b); cacheBytes+=b.length;
    while(cacheBytes>512*1024*1024){ const k=cache.keys().next().value; cacheBytes-=cache.get(k).length; cache.delete(k); } return b; };
  const split=(p)=>{ p=path.normalize(p); if(p.startsWith('/H/')||p==='/H') return ['H',p.slice(3)]; if(p.startsWith('/W/')||p==='/W') return ['W',p.slice(3)]; return [null,null]; };
  const stat=(sz,dir)=>({size:sz,mode:dir?0o755:0o644,birthtimeMs:1.7e12,atimeMs:1.7e12,mtimeMs:1.7e12,isDirectory:()=>dir,isFile:()=>!dir});
  const enoent=(p)=>Object.assign(new Error('ENOENT '+p),{code:'ENOENT'});
  const fds=new Map(); let nfd=3;
  const fsx={
    existsSync:(p)=>{ try{ fsx.statSync(p); return true; }catch(e){ return false; } },
    statSync:(p)=>{ const [w,r]=split(p); if(w==='H'){ if(r in MAN) return stat(MAN[r],false); if(dirs.has(r)) return stat(0,true); }
      else if(w==='W'){ if(mem.has(r)) return stat(mem.get(r).len,false); if(memDirs.has(r)) return stat(0,true); } throw enoent(p); },
    mkdirSync:(p)=>{ const [w,r]=split(p); if(w==='W'){ const q=r.split('/'); for(let i=1;i<=q.length;i++)memDirs.add(q.slice(0,i).join('/')); } },
    readdirSync:(p)=>{ const [w,r]=split(p); const pre=r?r+'/':''; const out=new Set();
      const add=(k)=>{ if(k.startsWith(pre)&&k.length>pre.length) out.add(k.slice(pre.length).split('/')[0]); };
      if(w==='H'){ Object.keys(MAN).forEach(add); } else if(w==='W'){ mem.forEach((_,k)=>add(k)); memDirs.forEach(add); } return [...out]; },
    openSync:(p,flag)=>{ const [w,r]=split(p); const fd=nfd++;
      if(w==='H'){ if(!(r in MAN)) throw enoent(p); fds.set(fd,{host:true,rel:r,size:MAN[r]}); }
      else if(w==='W'){ if(!mem.has(r)||/^w/.test(flag||'')){ if(!mem.has(r)&&/^r$/.test(flag||'r')) throw enoent(p); mem.set(r,{u8:new Uint8Array(0),len:0}); } fds.set(fd,{host:false,rel:r}); }
      else throw enoent(p); return fd; },
    closeSync:(fd)=>{ fds.delete(fd); },
    fstatSync:(fd)=>{ const f=fds.get(fd); return stat(f.host?f.size:mem.get(f.rel).len,false); },
    readSync:(fd,buf,off,n,pos)=>{ const f=fds.get(fd); pos=Number(pos);
      if(f.host){ const end=Math.min(pos+n,f.size); let got=0; while(pos+got<end){ const i=Math.floor((pos+got)/BLK), b=getBlock(f.rel,i), o=pos+got-i*BLK, c=Math.min(b.length-o,end-pos-got); buf.set(b.subarray(o,o+c),off+got); got+=c; } return got; }
      const m=mem.get(f.rel); const c=Math.max(0,Math.min(n,m.len-pos)); buf.set(m.u8.subarray(pos,pos+c),off); return c; },
    writeSync:(fd,buf,off,n,pos)=>{ const f=fds.get(fd); const m=mem.get(f.rel); pos=Number(pos); const need=pos+n;
      if(need>m.u8.length){ const u=new Uint8Array(Math.max(need,m.u8.length*2)); u.set(m.u8.subarray(0,m.len)); m.u8=u; }
      m.u8.set(buf.subarray(off,off+n),pos); m.len=Math.max(m.len,need); return n; },
    ftruncateSync:(fd,len)=>{ const f=fds.get(fd); if(!f.host){ const m=mem.get(f.rel); if(len<=m.len) m.len=len; else { const u=new Uint8Array(len); u.set(m.u8.subarray(0,m.len)); m.u8=u; m.len=len; } } },
    copyFileSync:(a,b)=>{ const [wa,ra]=split(a), [wb,rb]=split(b); let u8;
      if(wa==='H'){ u8=new Uint8Array(MAN[ra]); for(let o=0;o<u8.length;o+=BLK){ u8.set(fetchRange(ra,o,Math.min(o+BLK,u8.length)-1),o); } } else u8=mem.get(ra).u8.slice(0,mem.get(ra).len);
      mem.set(rb,{u8,len:u8.length}); },
    unlinkSync:(p)=>{ const [w,r]=split(p); if(!(w==='W'&&mem.delete(r))) throw enoent(p); },
    rmdirSync:(p)=>{ const [w,r]=split(p); if(w==='W') memDirs.delete(r); },
  };
  const path={
    normalize:(p)=>{ const abs=p.startsWith('/'); const o=[]; for(const s of p.split('/')){ if(!s||s==='.')continue; if(s==='..'){o.pop();continue;} o.push(s);} return (abs?'/':'')+o.join('/'); },
    join:(...a)=>path.normalize(a.join('/')),
    dirname:(p)=>{ p=path.normalize(p); const i=p.lastIndexOf('/'); return i<=0?'/':p.slice(0,i); },
  };
  self.Buffer={ allocUnsafe:(n)=>new Uint8Array(n), from:(u)=>{ const b=new Uint8Array(u); b.toString=()=>new TextDecoder().decode(b); return b; } };
  self.require=(n)=>{ if(n==='fs')return fsx; if(n==='path')return path; if(n==='./vfs.js')return self.__vfsFactory; if(n==='./d3dfake.js')return self.__d3dFactory; if(n==='./d3d11rec.js')return self.__d3d11recFactory; if(n==='./dxbc.js')return self.__dxbcFactory; throw new Error('require '+n); };
})();
