const fs=require('fs'), path=require('path');
module.exports=function makeVfs(g,opts){
  const HOSTROOT=opts.hostRoot, WRITEROOT=opts.writeRoot; fs.mkdirSync(WRITEROOT,{recursive:true});
  const EXE='C:\\Game\\AlternateWatch\\Binaries\\Win64\\AlternateWatch-Win64-Shipping.exe', CWD0='C:\\Game\\AlternateWatch\\Binaries\\Win64';
  let cwd=CWD0, lastErr=0;
  const setErr=(e)=>{lastErr=e;};
  const norm=(p)=>{ p=p.replace(/^\\\\\?\\/,'').replace(/\//g,'\\'); if(!/^[A-Za-z]:/.test(p)){ p=cwd.replace(/\\$/,'')+'\\'+p; }
    const m=p.match(/^([A-Za-z]:)\\?(.*)$/); const parts=[]; for(const s of m[2].split('\\')){ if(!s||s==='.')continue; if(s==='..'){parts.pop();continue;} parts.push(s); } return m[1].toUpperCase()+'\\'+parts.join('\\'); };
  const resolveRead=(gp)=>{ const n=norm(gp); const rel=n.slice(3).replace(/\\/g,'/'); 
    const ov=path.join(WRITEROOT,n[0],rel); if(fs.existsSync(ov)) return ov;
    if(/^C:\\Game(\\|$)/i.test(n)) return path.join(HOSTROOT,n.slice(8).replace(/\\/g,'/')); return null; };
  const resolveWrite=(gp)=>{ const n=norm(gp); return path.join(WRITEROOT,n[0],n.slice(3).replace(/\\/g,'/')); };
  const FT=(ms)=>Math.floor(ms*10000)+116444736000000000;
  const attrOf=(st)=>(st.isDirectory()?0x10:0x80)|(st.isFile()&&!(st.mode&0o200)?1:0);
  const handles=new Map(); let nextH=0x5000; const finds=new Map();
  const newH=(o)=>{const h=nextH; nextH+=4; handles.set(h,o); return h;};
  const putFT=(a,ms)=>g.wr64(a,FT(ms));
  const fill=(a,st,name)=>{
    for(let i=0;i<592;i++)g.wr8(a+i,0); g.wr32(a,attrOf(st)); putFT(a+4,st.birthtimeMs); putFT(a+12,st.atimeMs); putFT(a+20,st.mtimeMs);
    g.wr32(a+28,Math.floor(st.size/4294967296)); g.wr32(a+32,st.size%4294967296>>>0); const nm=name.slice(0,259); for(let i=0;i<nm.length;i++)g.wr16(a+44+2*i,nm.charCodeAt(i)); };
  const copyOut=(buf,addr,n)=>{ g.bytes(addr,n).set(buf.subarray(0,n)); };
  const H={
    GetLastError:()=>lastErr, SetLastError:c=>{lastErr=c.a(0)>>>0;},
    GetModuleFileNameW:c=>{ const s=EXE; const cap=c.a(2); const n=Math.min(s.length,cap-1); for(let i=0;i<n;i++)g.wr16(c.a(1)+2*i,s.charCodeAt(i)); g.wr16(c.a(1)+2*n,0); return n; },
    GetCurrentDirectoryW:c=>{ const s=cwd; if(c.a(0)<=s.length) return s.length+1; g.putw(c.a(1),s); return s.length; },
    SetCurrentDirectoryW:c=>{ cwd=norm(g.wstr(c.a(0))); return 1; },
    GetFullPathNameW:c=>{ const s=norm(g.wstr(c.a(0))); if(c.a(1)<=s.length) return s.length+1; g.putw(c.a(2),s); if(c.a(3)){ const i=s.lastIndexOf('\\'); g.wr64(c.a(3),c.a(2)+2*(i+1)); } return s.length; },
    GetLongPathNameW:c=>{ const s=g.wstr(c.a(0)); if(c.a(2)<=s.length) return s.length+1; g.putw(c.a(1),s); return s.length; },
    GetTempPathW:c=>{ const s='C:\\Users\\Player\\AppData\\Local\\Temp\\'; if(c.a(0)<=s.length) return s.length+1; g.putw(c.a(1),s); return s.length; },
    GetFileAttributesW:c=>{ const p=resolveRead(g.wstr(c.a(0))); if(!p){setErr(3);return 0xffffffff;} try{ const st=fs.statSync(p); setErr(0); return attrOf(st);}catch(e){setErr(2);return 0xffffffff;} },
    GetFileAttributesExW:c=>{ const p=resolveRead(g.wstr(c.a(0))); if(!p){setErr(3);return 0;} try{ const st=fs.statSync(p); const a=c.a(2);
        g.wr32(a,attrOf(st)); putFT(a+4,st.birthtimeMs); putFT(a+12,st.atimeMs); putFT(a+20,st.mtimeMs); g.wr32(a+28,Math.floor(st.size/4294967296)); g.wr32(a+32,st.size%4294967296>>>0); setErr(0); return 1;}catch(e){setErr(2);return 0;} },
    CreateFileW:c=>{ const gp=g.wstr(c.a(0)), acc=c.a(1)>>>0, disp=c.a(4)>>>0; const wantW=!!(acc&0x40000000); 
      let p; if(wantW||disp===1||disp===2||disp===4||disp===5){ const wp=resolveWrite(gp); const rp=resolveRead(gp);
        if(disp===3&&!wantW&&rp){p=rp;} else { fs.mkdirSync(path.dirname(wp),{recursive:true});
          if(rp&&rp!==wp&&fs.existsSync(rp)&&fs.statSync(rp).isFile()&&disp!==2&&disp!==1&&!fs.existsSync(wp)){ opts.log('[vfs] copy-on-write '+gp+' acc=0x'+acc.toString(16)+' disp='+disp); fs.copyFileSync(rp,wp); } p=wp; } }
      else p=resolveRead(gp);
      if(!p){setErr(3);return -1;}
      const exists=fs.existsSync(p);
      if(disp===3&&!exists){setErr(2);return -1;} if(disp===5&&!exists){setErr(2);return -1;}
      if(disp===1&&exists){setErr(80);return -1;}
      if(exists&&fs.statSync(p).isDirectory()){ setErr(0); return newH({dir:p,pos:0}); }
      let flag='r'; if(wantW){ flag=(disp===2||disp===5)?'w+':(exists?'r+':'w+'); }
      try{ const fd=fs.openSync(p,flag); setErr((disp===4||disp===2)&&exists?183:0); return newH({fd,pos:0,path:p}); }catch(e){ setErr(e.code==='ENOENT'?2:5); return -1; } },
    CloseHandle:c=>{ const h=handles.get(c.a(0)); if(h&&h.fd!==undefined){try{fs.closeSync(h.fd);}catch(e){}} handles.delete(c.a(0)); return 1; },
    ReadFile:c=>{ const h=handles.get(c.a(0)); if(!h||h.fd===undefined){setErr(6);return 0;} const n=c.a(2), buf=c.a(1), ov=c.a(4);
      let pos=h.pos; if(ov){ pos=g.rd32(ov+16)+g.rd32(ov+20)*4294967296; }
      const tmp=Buffer.allocUnsafe(n); const got=fs.readSync(h.fd,tmp,0,n,pos); copyOut(tmp,buf,got);
      if(ov){ g.wr64(ov,0); g.wr64(ov+8,got); } else h.pos=pos+got; if(c.a(3))g.wr32(c.a(3),got); setErr(0); return 1; },
    WriteFile:c=>{ const hh=c.a(0); const h=handles.get(hh); const n=c.a(2); 
      if(!h||h.fd===undefined){ const s=Buffer.from(g.bytes(c.a(1),n)).toString(); opts.log('[stdout] '+s.trimEnd()); if(c.a(3))g.wr32(c.a(3),n); return 1; }
      const ov=c.a(4); let pos=h.pos; if(ov) pos=g.rd32(ov+16)+g.rd32(ov+20)*4294967296;
      const w=fs.writeSync(h.fd,Buffer.from(g.bytes(c.a(1),n)),0,n,pos); if(!ov)h.pos=pos+w; if(c.a(3))g.wr32(c.a(3),w); return 1; },
    SetFilePointer:c=>{ const h=handles.get(c.a(0)); if(!h)return -1; const lo=c.a(1)|0, m=c.a(3); let base=m===0?0:m===1?h.pos:fs.fstatSync(h.fd).size; h.pos=base+lo; return h.pos>>>0; },
    SetFilePointerEx:c=>{ const h=handles.get(c.a(0)); if(!h)return 0; const lo=Number(BigInt.asIntN(64,BigInt(c.a(1)))); const m=c.a(3); let base=m===0?0:m===1?h.pos:fs.fstatSync(h.fd).size; h.pos=base+lo; if(c.a(2))g.wr64(c.a(2),h.pos); return 1; },
    GetFileSizeEx:c=>{ const h=handles.get(c.a(0)); if(!h||h.fd===undefined)return 0; g.wr64(c.a(1),fs.fstatSync(h.fd).size); return 1; },
    GetFileSize:c=>{ const h=handles.get(c.a(0)); if(!h||h.fd===undefined)return 0xffffffff; const z=fs.fstatSync(h.fd).size; if(c.a(1))g.wr32(c.a(1),Math.floor(z/4294967296)); return z>>>0; },
    FlushFileBuffers:()=>1, SetEndOfFile:c=>{ const h=handles.get(c.a(0)); if(h&&h.fd!==undefined)fs.ftruncateSync(h.fd,h.pos); return 1; },
    GetFileInformationByHandle:c=>{ const h=handles.get(c.a(0)); if(!h)return 0; const st=h.fd!==undefined?fs.fstatSync(h.fd):fs.statSync(h.dir); const a=c.a(1); for(let i=0;i<52;i++)g.wr8(a+i,0);
      g.wr32(a,attrOf(st)); putFT(a+4,st.birthtimeMs); putFT(a+12,st.atimeMs); putFT(a+20,st.mtimeMs); g.wr32(a+36,Math.floor(st.size/4294967296)); g.wr32(a+40,st.size%4294967296>>>0); g.wr32(a+44,1); return 1; },
    GetFinalPathNameByHandleW:c=>{ const s='C:\\Game\\unknown'; if(c.a(2)<=s.length)return s.length+1; g.putw(c.a(1),s); return s.length; },
    SetFileTime:()=>1, SetFileAttributesW:()=>1,
    CreateDirectoryW:c=>{ try{ const p=resolveWrite(g.wstr(c.a(0))); if(fs.existsSync(p)){setErr(183);return 0;} fs.mkdirSync(p,{recursive:true}); setErr(0); return 1;}catch(e){setErr(3);return 0;} },
    RemoveDirectoryW:c=>{ try{ fs.rmdirSync(resolveWrite(g.wstr(c.a(0)))); return 1;}catch(e){setErr(2);return 0;} },
    DeleteFileW:c=>{ try{ fs.unlinkSync(resolveWrite(g.wstr(c.a(0)))); return 1;}catch(e){setErr(2);return 0;} },
    MoveFileW:c=>{ try{ const a=resolveRead(g.wstr(c.a(0))), b=resolveWrite(g.wstr(c.a(1))); fs.mkdirSync(path.dirname(b),{recursive:true}); fs.copyFileSync(a,b); return 1;}catch(e){setErr(2);return 0;} },
    GetDiskFreeSpaceExW:c=>{ if(c.a(1))g.wr64(c.a(1),200*2**30); if(c.a(2))g.wr64(c.a(2),500*2**30); if(c.a(3))g.wr64(c.a(3),200*2**30); return 1; },
    FindFirstFileW:c=>{ const gp=g.wstr(c.a(0)); const dirG=gp.replace(/[\\/][^\\/]*$/,''); const pat=gp.replace(/^.*[\\/]/,'');
      const dp=resolveRead(dirG); if(!dp||!fs.existsSync(dp)){setErr(3);return -1;}
      const n=norm(dirG), hp=/^C:\\Game(\\|$)/i.test(n)?path.join(HOSTROOT,n.slice(8).replace(/\\/g,'/')):null;
      const dirs=[dp]; if(hp&&hp!==dp&&fs.existsSync(hp)&&fs.statSync(hp).isDirectory()) dirs.push(hp);
      const where=new Map(); for(const d of dirs) for(const nm of fs.readdirSync(d)) if(!where.has(nm)) where.set(nm,d);
      let names; if(!/[*?]/.test(pat)){ names=where.has(pat)?[pat]:[]; } else { const re=new RegExp('^'+pat.replace(/[.+^${}()|[\]\\]/g,'\\\\$&').replace(/\*/g,'.*').replace(/\?/g,'.')+'$','i'); names=['.','..',...where.keys()].filter(n=>re.test(n)||pat==='*.*'||pat==='*'); }
      if(!names.length){setErr(2);return -1;} const h=nextH; nextH+=4; finds.set(h,{dp,where,names,i:0});
      const nm=names[0]; const st=(nm==='.'||nm==='..')?fs.statSync(dp):fs.statSync(path.join(where.get(nm),nm)); fill(c.a(1),st,nm); finds.get(h).i=1; setErr(0); return h; },
    FindNextFileW:c=>{ const f=finds.get(c.a(0)); if(!f||f.i>=f.names.length){setErr(18);return 0;} const nm=f.names[f.i++]; const st=(nm==='.'||nm==='..')?fs.statSync(f.dp):fs.statSync(path.join(f.where.get(nm),nm)); fill(c.a(1),st,nm); return 1; },
    FindClose:c=>{ finds.delete(c.a(0)); return 1; },
  };
  if(opts.vfsLog) for(const k of ['CreateFileW','GetFileAttributesW','GetFileAttributesExW','FindFirstFileW']){ const f=H[k];
    H[k]=c=>{ const nm=g.wstr(c.a(0)); const r=f(c); opts.log('[vfs] '+k+' '+nm+' -> '+((r===-1||r===0xffffffff||(r===0&&k!=='GetFileAttributesW'))?'FAIL err='+lastErr:'ok')); return r; }; }
  if(opts.vfsLog){ const rf=H.ReadFile; let nlog=0;
    H.ReadFile=c=>{ const h=handles.get(c.a(0)), ov=c.a(4); const pos=h&&(ov?g.rd32(ov+16)+g.rd32(ov+20)*4294967296:h.pos); const r=rf(c);
      if(h&&h.path&&/\.(pak|utoc|ucas)$/i.test(h.path)&&nlog++<5000) opts.log('[vfs] ReadFile '+h.path.replace(/^.*[\\/]/,'')+' @'+pos+' n='+c.a(2)+(ov?' (overlapped)':''));
      return r; }; }
  return {H, handles};
};
