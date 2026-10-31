const BASE=0x140000000;
const e_iat=(imps,k)=>imps[k][2];
module.exports=function install(m,imps,opts){
  opts=opts||{};
  const log=opts.log||((s)=>process.stderr.write(s+"\n"));
  const CMDARGS=opts.cmdline!==undefined?opts.cmdline:((typeof process!=='undefined'&&process.env.CMDLINE!==undefined)?process.env.CMDLINE:'-nullrhi');
  const CMDLINE='"C:\\Game\\AlternateWatch\\Binaries\\Win64\\AlternateWatch-Win64-Shipping.exe"'+(CMDARGS?' '+CMDARGS:'');
  const splitArgs=(s)=>{ const out=[]; let i=0; const ws=ch=>ch===' '||ch==='\t';
    while(i<s.length){ while(i<s.length&&ws(s[i]))i++; if(i>=s.length)break; let a='',q=false;
      while(i<s.length&&(q||!ws(s[i]))){ if(s[i]==='\\'){ let n=0; while(s[i]==='\\'){n++;i++;} if(s[i]==='"'){ a+='\\'.repeat(n>>1); if(n&1){a+='"';i++;} } else a+='\\'.repeat(n); }
        else if(s[i]==='"'){ q=!q; i++; } else a+=s[i++]; }
      out.push(a); } return out; };
  const ARGV=splitArgs(CMDLINE);
  let M=0, Rp=0;
  const seen=new Set(), counts={}; let lastCounts={}; const ring=[]; const RING_ON=opts.ring!==false;
  const H8=()=>m.HEAPU8, H32=()=>{const b=m.HEAPU8.buffer;if(H32.b!==b){H32.b=b;H32.v=new Uint32Array(b);}return H32.v;}, DV=()=>new DataView(m.HEAPU8.buffer);
  const off=(a)=>{const o=Number(a)-BASE; if(o<0||o>=1536*1024*1024) throw new Error('guest addr out of range 0x'+Number(a).toString(16)); return M+o;};
  const g={
    rd8:a=>H8()[off(a)], rd16:a=>DV().getUint16(off(a),true), rd32:a=>DV().getUint32(off(a),true),
    rd64:a=>{const d=DV(),o=off(a);return d.getUint32(o,true)+d.getUint32(o+4,true)*4294967296;},
    wr8:(a,v)=>{H8()[off(a)]=v}, wr16:(a,v)=>DV().setUint16(off(a),v,true), wr32:(a,v)=>DV().setUint32(off(a),v>>>0,true),
    wr64:(a,v)=>{const d=DV(),o=off(a);v=Number(v);d.setUint32(o,v%4294967296>>>0,true);d.setUint32(o+4,Math.floor(v/4294967296)>>>0,true);},
    bytes:(a,n)=>H8().subarray(off(a),off(a)+n),
    cstr:a=>{let s='';for(let i=0;i<4096;i++){const c=g.rd8(a+i);if(!c)break;s+=String.fromCharCode(c);}return s;},
    wstr:a=>{let s='';for(let i=0;i<4096;i++){const c=g.rd16(a+2*i);if(!c)break;s+=String.fromCharCode(c);}return s;},
    putw:(a,s)=>{for(let i=0;i<s.length;i++)g.wr16(a+2*i,s.charCodeAt(i));g.wr16(a+2*s.length,0);},
    puta:(a,s)=>{for(let i=0;i<s.length;i++)g.wr8(a+i,s.charCodeAt(i)&255);g.wr8(a+s.length,0);},
    alloc:(n,al=16)=>BASE+m._galloc_js(n,al),
  };
  const sizes=new Map();
  const malloc=(n)=>{ if(m._gh_malloc_js) return BASE+m._gh_malloc_js(Math.max(n,1)); const p=g.alloc(Math.max(n,1)+16,16)+16; g.wr64(p-8,n); return p; };
  const gfree=(p)=>{ if(p&&m._gh_free_js) m._gh_free_js(p-BASE); };
  const argvBlock=(v,wide)=>{ const a=g.alloc(8*(v.length+1),16); v.forEach((s,i)=>{const p=g.alloc((s.length+1)*(wide?2:1),2); wide?g.putw(p,s):g.puta(p,s); g.wr64(a+8*i,p);}); g.wr64(a+8*v.length,0); return a; };
  const msize=(p)=>g.rd64(p-8);
  const regs={rax:0,rcx:1,rdx:2,rbx:3,rsp:4,rbp:5,rsi:6,rdi:7,r8:8,r9:9};
  const guestCall=(addr,args=[])=>{
    const h=H32(), b=(Rp>>2); const save=[]; for(const r of [1,2,8,9,4]){save.push([h[b+2*r],h[b+2*r+1]]);}
    [1,2,8,9].forEach((r,i)=>{const v=args[i]||0;h[b+2*r]=v%4294967296>>>0;h[b+2*r+1]=Math.floor(v/4294967296)>>>0;});
    const lo=addr%4294967296>>>0, hi=Math.floor(addr/4294967296)>>>0;
    guestDepth++; let rv; try { rv=Number(m._call_guest(Rp,lo,hi)); } finally { guestDepth--; }
    guestCall.lo32=h[b];
    [1,2,8,9,4].forEach((r,i)=>{h[b+2*r]=save[i][0];h[b+2*r+1]=save[i][1];});
    return rv;
  };

  const xf32=(i)=>{const h=H32(),b=(Rp>>2)+32+4*i;const dv=new DataView(new ArrayBuffer(4));dv.setUint32(0,h[b],true);return dv.getFloat32(0,true);};
  const setxf32=(i,v)=>{const h=H32(),b=(Rp>>2)+32+4*i;const dv=new DataView(new ArrayBuffer(4));dv.setFloat32(0,v,true);h[b]=dv.getUint32(0,true);};
  const xf64=(i)=>{const h=H32(),b=(Rp>>2)+32+4*i;const dv=new DataView(new ArrayBuffer(8));dv.setUint32(0,h[b],true);dv.setUint32(4,h[b+1],true);return dv.getFloat64(0,true);};
  const setxf64=(i,v)=>{const h=H32(),b=(Rp>>2)+32+4*i;const dv=new DataView(new ArrayBuffer(8));dv.setFloat64(0,v,true);h[b]=dv.getUint32(0,true);h[b+1]=dv.getUint32(4,true);};
  const M1={log:Math.log,exp:Math.exp,sin:Math.sin,cos:Math.cos,tan:Math.tan,asin:Math.asin,acos:Math.acos,atan:Math.atan,sqrt:Math.sqrt,floor:Math.floor,ceil:Math.ceil,fabs:Math.abs,log2:Math.log2,log10:Math.log10,exp2:x=>Math.pow(2,x),sinh:Math.sinh,cosh:Math.cosh,tanh:Math.tanh,round:x=>x<0?-Math.round(-x):Math.round(x),trunc:Math.trunc,cbrt:Math.cbrt,asinh:Math.asinh,acosh:Math.acosh,atanh:Math.atanh};
  const M2={pow:Math.pow,atan2:Math.atan2,fmod:(a,b)=>a%b,fmin:Math.min,fmax:Math.max,hypot:Math.hypot};
  const mathH={};
  for(const [n,f] of Object.entries(M1)){ mathH[n+'f']=()=>{setxf32(0,Math.fround(f(xf32(0))));}; mathH[n]=()=>{setxf64(0,f(xf64(0)));}; }
  mathH.ldexp=c=>{setxf64(0,xf64(0)*Math.pow(2,c.a(1)|0));}; mathH.ldexpf=c=>{setxf32(0,Math.fround(xf32(0)*Math.pow(2,c.a(1)|0)));};
  for(const [n,f] of Object.entries(M2)){ mathH[n+'f']=()=>{setxf32(0,Math.fround(f(xf32(0),xf32(1))));}; mathH[n]=()=>{setxf64(0,f(xf64(0),xf64(1)));}; }
  const rnd=()=>Math.floor(Math.random()*256);
  const knownFolder={}; 

  const rd64b=(a)=>{const d=DV(),o=off(a);return BigInt(d.getUint32(o,true))|(BigInt(d.getUint32(o+4,true))<<32n);};
  const slotF64=(a)=>{const d=DV(),o=off(a);return d.getFloat64(o,true);};
  const expFmt=(x,p,up)=>{let s=x.toExponential(p);s=s.replace(/e([+-])(\d)$/,'e$10$2');return up?s.toUpperCase():s;};
  const fmtG=(x,p,alt,up)=>{if(p===0)p=1;if(x===0)return alt?(0).toFixed(p-1):'0';const e=Math.floor(Math.log10(Math.abs(x)));let r;
    if(e<-4||e>=p){r=expFmt(x,p-1,false);if(!alt)r=r.replace(/\.?0+e/,'e');}else{r=x.toFixed(Math.max(p-1-e,0));if(!alt&&r.includes('.'))r=r.replace(/\.?0+$/,'');}
    return up?r.toUpperCase():r;};
  function cfmt(f,va,wide){
    let out='',ai=0;
    const slot=()=>{const a=va+8*ai;ai++;return a;};
    for(let i=0;i<f.length;i++){
      const ch=f[i]; if(ch!=='%'){out+=ch;continue;}
      i++; let flags={}; while('-+ #0'.includes(f[i])&&i<f.length){flags[f[i]]=1;i++;}
      let width=0,prec=-1;
      if(f[i]==='*'){width=Number(BigInt.asIntN(32,rd64b(slot())));if(width<0){flags['-']=1;width=-width;}i++;} else {let w='';while(f[i]>='0'&&f[i]<='9'){w+=f[i];i++;}width=w?parseInt(w):0;}
      if(f[i]==='.'){i++;if(f[i]==='*'){prec=Number(BigInt.asIntN(32,rd64b(slot())));i++;}else{let p='';while(f[i]>='0'&&f[i]<='9'){p+=f[i];i++;}prec=p?parseInt(p):0;}}
      let len=''; 
      if(f.startsWith('I64',i)){len='ll';i+=3;} else if(f.startsWith('I32',i)){len='';i+=3;} else if(f[i]==='I'){len='z';i++;}
      else if(f.startsWith('hh',i)){len='hh';i+=2;} else if(f.startsWith('ll',i)){len='ll';i+=2;}
      else if('hlzjtLw'.includes(f[i])){len=f[i];i++;}
      const t=f[i]; let body='', sign='', numeric=false;
      const big=(len==='ll'||len==='z'||len==='j'||len==='t');
      switch(t){
        case '%': body='%'; break;
        case 'd': case 'i': {let v=rd64b(slot());v=big?BigInt.asIntN(64,v):len==='h'?BigInt.asIntN(16,v):len==='hh'?BigInt.asIntN(8,v):BigInt.asIntN(32,v);
          if(v<0n){sign='-';v=-v;}else if(flags['+'])sign='+';else if(flags[' '])sign=' ';body=v.toString();if(prec>=0)body=body.padStart(prec,'0');numeric=true;break;}
        case 'u': case 'x': case 'X': case 'o': {let v=rd64b(slot());v=big?BigInt.asUintN(64,v):len==='h'?BigInt.asUintN(16,v):len==='hh'?BigInt.asUintN(8,v):BigInt.asUintN(32,v);
          body=v.toString(t==='o'?8:t==='u'?10:16);if(t==='X')body=body.toUpperCase();if(prec>=0)body=body.padStart(prec,'0');
          if(flags['#']&&v!==0n){if(t==='x')sign='0x';if(t==='X')sign='0X';if(t==='o')body='0'+body;}numeric=true;break;}
        case 'p': body=BigInt.asUintN(64,rd64b(slot())).toString(16).toUpperCase().padStart(16,'0');break;
        case 'c': case 'C': {const v=Number(rd64b(slot())&0xffffn);body=String.fromCharCode(t==='c'&&!wide?v&255:v);break;}
        case 's': case 'S': {const p=Number(rd64b(slot()));
          const isWide=(t==='s')?(wide&&len!=='h'):(!wide||len==='l'||len==='w'); const isW=(len==='l'||len==='w')?true:(len==='h'?false:isWide);
          body=!p?'(null)':(isW?g.wstr(p):g.cstr(p)); if(prec>=0)body=body.slice(0,prec);break;}
        case 'f': case 'F': case 'e': case 'E': case 'g': case 'G': case 'a': case 'A': {
          const x=slotF64(slot()); numeric=true;
          if(!isFinite(x)){body=isNaN(x)?'nan':'inf';numeric=false;if(x<0)sign='-';}
          else{ if(x<0||Object.is(x,-0)){sign='-';} else if(flags['+'])sign='+'; else if(flags[' '])sign=' '; const ax=Math.abs(x);
            const p=prec<0?6:prec;
            if(t==='f'||t==='F')body=ax.toFixed(Math.min(p,100)); else if(t==='e'||t==='E')body=expFmt(ax,p,t==='E'); else body=fmtG(ax,p,!!flags['#'],t==='G'); }
          break;}
        case 'n': slot(); break;
        default: body='%'+(t||'');
      }
      let full=sign+body;
      if(width>full.length){ if(flags['-'])full=full+' '.repeat(width-full.length); else if(flags['0']&&numeric&&!(prec>=0&&'diuxXo'.includes(t)))full=sign+'0'.repeat(width-full.length)+body; else full=' '.repeat(width-full.length)+full; }
      out+=full;
    }
    return out;
  }
  const doSprintf=(c,wide)=>{
    const buf=c.a(1),cnt=c.a(2),fm=c.a(3),va=c.a(5);
    const s=cfmt(wide?g.wstr(fm):g.cstr(fm),va,wide);
    if(buf&&cnt){const n=Math.min(s.length,cnt-1);for(let i=0;i<n;i++){wide?g.wr16(buf+2*i,s.charCodeAt(i)):g.wr8(buf+i,s.charCodeAt(i)&255);}wide?g.wr16(buf+2*n,0):g.wr8(buf+n,0);}
    return s.length;
  };
  const doFprintf=(c,wide)=>{
    const s=cfmt(wide?g.wstr(c.a(2)):g.cstr(c.a(2)),c.a(4),wide); log('[printf] '+s.replace(/\n$/,'')); return s.length; };
  const putST=(p,d,local)=>{const u=!local;const Y=u?d.getUTCFullYear():d.getFullYear(),Mo=u?d.getUTCMonth()+1:d.getMonth()+1,DW=u?d.getUTCDay():d.getDay(),D=u?d.getUTCDate():d.getDate(),h=u?d.getUTCHours():d.getHours(),mi=u?d.getUTCMinutes():d.getMinutes(),se=u?d.getUTCSeconds():d.getSeconds(),ms=u?d.getUTCMilliseconds():d.getMilliseconds();
    [Y,Mo,DW,D,h,mi,se,ms].forEach((v,i)=>g.wr16(p+2*i,v));};

  const rdS=(a,w)=>w?g.wstr(a):g.cstr(a);
  const wrS=(a,str,w)=>w?g.putw(a,str):g.puta(a,str);
  const chSz=(w)=>w?2:1;
  const cmpNum=(a,b)=>a<b?(-1>>>0):a>b?1:0;
  const parseNum=(str,base)=>{let i=0;while(i<str.length&&/[ \t\n\v\f\r]/.test(str[i]))i++;let neg=false;if(str[i]==='+'||str[i]==='-'){neg=str[i]==='-';i++;}
    if((base===0||base===16)&&str[i]==='0'&&/[xX]/.test(str[i+1]||'')&&/[0-9a-fA-F]/.test(str[i+2]||'')){i+=2;base=16;}else if(base===0)base=str[i]==='0'?8:10;
    let n=0n;const d0=i;for(;i<str.length;i++){const d=parseInt(str[i],36);if(isNaN(d)||d>=base)break;n=n*BigInt(base)+BigInt(d);}return i===d0?{n:0n,end:0}:{n:neg?-n:n,end:i};};
  const parseInt_=(str,base)=>parseNum(str,base).n;
  const clampN=(n,lo,hi)=>n<lo?lo:n>hi?hi:n;
  const mk=(w)=>{const P={};
    P.chr=c=>{const s=c.a(0),ch=c.a(1)&(w?0xffff:0xff);for(let i=0;;i++){const v=w?g.rd16(s+2*i):g.rd8(s+i);if(v===ch)return s+i*chSz(w);if(!v)return 0;}};
    P.rchr=c=>{const s=c.a(0),ch=c.a(1)&(w?0xffff:0xff);let r=0;for(let i=0;;i++){const v=w?g.rd16(s+2*i):g.rd8(s+i);if(v===ch)r=s+i*chSz(w);if(!v)return r;}};
    P.str=c=>{const h=rdS(c.a(0),w),n=rdS(c.a(1),w);const i=h.indexOf(n);return i<0?0:c.a(0)+i*chSz(w);};
    P.ncmp=c=>{const a=rdS(c.a(0),w).slice(0,c.a(2)),b=rdS(c.a(1),w).slice(0,c.a(2));return cmpNum(a,b);};
    P.icmp=c=>cmpNum(rdS(c.a(0),w).toLowerCase(),rdS(c.a(1),w).toLowerCase());
    P.nicmp=c=>cmpNum(rdS(c.a(0),w).slice(0,c.a(2)).toLowerCase(),rdS(c.a(1),w).slice(0,c.a(2)).toLowerCase());
    P.cpy=c=>{wrS(c.a(0),rdS(c.a(1),w),w);return c.a(0);};
    P.cat=c=>{const d=c.a(0);wrS(d+rdS(d,w).length*chSz(w),rdS(c.a(1),w),w);return d;};
    P.ncpy=c=>{const d=c.a(0),n=c.a(2),src=rdS(c.a(1),w);for(let i=0;i<n;i++){const v=i<src.length?src.charCodeAt(i):0;w?g.wr16(d+2*i,v):g.wr8(d+i,v);}return d;};
    P.ncat=c=>{const d=c.a(0),n=c.a(2),src=rdS(c.a(1),w).slice(0,n);const dl=rdS(d,w).length;wrS(d+dl*chSz(w),src,w);return d;};
    P.dup=c=>{const str=rdS(c.a(0),w);const p=malloc((str.length+1)*chSz(w));wrS(p,str,w);return p;};
    const sto=(c,f)=>{const s=c.a(0),r=parseNum(rdS(s,w),c.a(2));if(c.a(1))g.wr64(c.a(1),s+r.end*chSz(w));return f(r.n);};
    P.tol=c=>sto(c,n=>Number(BigInt.asUintN(32,clampN(n,-(1n<<31n),(1n<<31n)-1n))));
    P.toul=c=>sto(c,n=>Number(BigInt.asUintN(32,n)));
    P.toll=c=>sto(c,n=>Number(BigInt.asUintN(64,n)));
    P.atoi=c=>Number(BigInt.asUintN(32,parseInt_(rdS(c.a(0),w),10)));
    P.tod=c=>{const s=c.a(0),str=rdS(s,w),m=str.match(/^[ \t\n\v\f\r]*[+-]?(inf(inity)?|nan|(\d+\.?\d*|\.\d+)(e[+-]?\d+)?)/i);if(c.a(1))g.wr64(c.a(1),m?s+m[0].length*chSz(w):s);setxf64(0,m?parseFloat(m[0].replace(/nan/i,'NaN').replace(/inf(inity)?/i,'Infinity')):0);};
    return P;};
  const N=mk(false), W=mk(true);
  const ctype={alpha:x=>/[A-Za-z]/.test(String.fromCharCode(x)),digit:x=>x>=48&&x<=57,space:x=>x===32||(x>=9&&x<=13),alnum:x=>/[A-Za-z0-9]/.test(String.fromCharCode(x)),upper:x=>x>=65&&x<=90,lower:x=>x>=97&&x<=122,xdigit:x=>/[0-9a-fA-F]/.test(String.fromCharCode(x)),punct:x=>x>32&&x<127&&!/[A-Za-z0-9]/.test(String.fromCharCode(x)),print:x=>x>=32&&x<127,cntrl:x=>x<32||x===127,graph:x=>x>32&&x<127};
  const ctypeH={};
  for(const [n,f] of Object.entries(ctype)){ ctypeH['is'+n]=c=>f(c.a(0)&0xff)?1:0; ctypeH['isw'+n]=c=>f(c.a(0)&0xffff)?1:0; }
  ctypeH.tolower=c=>{const x=c.a(0)&0xff;return x>=65&&x<=90?x+32:x;}; ctypeH.toupper=c=>{const x=c.a(0)&0xff;return x>=97&&x<=122?x-32:x;};
  ctypeH.towlower=c=>{const x=c.a(0)&0xffff;return x>=65&&x<=90?x+32:x;}; ctypeH.towupper=c=>{const x=c.a(0)&0xffff;return x>=97&&x<=122?x-32:x;};
  const strH={strchr:N.chr,strrchr:N.rchr,strstr:N.str,strncmp:N.ncmp,_stricmp:N.icmp,_strnicmp:N.nicmp,strcpy:N.cpy,strcat:N.cat,strncpy:N.ncpy,strncat:N.ncat,_strdup:N.dup,strtol:N.tol,strtoul:N.toul,strtoll:N.toll,strtoull:N.toll,atoi:N.atoi,strtod:N.tod,atof:c=>N.tod({a:i=>i===1?0:c.a(i)}),
    wcschr:W.chr,wcsrchr:W.rchr,wcsstr:W.str,wcsncmp:W.ncmp,_wcsicmp:W.icmp,_wcsnicmp:W.nicmp,wcscpy:W.cpy,wcscat:W.cat,wcsncpy:W.ncpy,wcsncat:W.ncat,_wcsdup:W.dup,wcstol:W.tol,wcstoul:W.toul,wcstoll:W.toll,wcstoull:W.toll,_wtoi:W.atoi,wcstod:W.tod,
    SetCurrentDirectoryW:(()=>1), GetConsoleWindow:(()=>0), RtlAreLongPathsEnabled:(()=>1), ImageNtHeader:()=>0,
    DisableThreadLibraryCalls:()=>1, __std_type_info_destroy_list:()=>0, __telemetry_main_invoke_trigger:()=>0, __telemetry_main_return_trigger:()=>0, _crt_at_quick_exit:()=>0, _seh_filter_dll:()=>0,
    memchr:c=>{ const p=c.a(0), ch=c.a(1)&255, n=c.a(2), h=H8(), o=off(p); for(let i=0;i<n;i++) if(h[o+i]===ch) return p+i; return 0; }};
  const tls=new Map(); let nextTls=0; const fls=new Map(); let nextFls=0;
  const modBase=BASE; let cmdline=null, environ=null;
  const THUNK1=0x7FF100000000; const dyn=[]; const dynIdx=new Map();
  const sysdll=/^(kernel32|kernelbase|ntdll|ucrtbase|user32|advapi32|api-ms-win-.*|vcruntime140.*|msvcp140|combase|ole32|shell32|gdi32|bcrypt|dbghelp|version|winmm|ws2_32)(\.dll)?$/i;
  const modNames=new Map();
  const ORD={'xaudio2_9redist.dll':{1:'XAudio2Create'},'xaudio2_9.dll':{1:'XAudio2Create'}};
  const guestDlls=new Map(), guestByBase=new Map();
  const loaded=new Set(); const fakeMod=(name)=>{ if(!name) return modBase; { const n=name.replace(/^.*[\\/]/,'').toLowerCase(), gd=guestDlls.get(n.replace(/[.]dll$/,'')); if(gd){ if(!loaded.has(n)){loaded.add(n);log('[LoadLibrary] '+n+' -> guest dll at 0x'+gd.off.toString(16));} return BASE+gd.off; } } const n=name.replace(/^.*[\\/]/,''); if(/^(nvapi64|nvapi|amd_ags_x64|igdext64|vulkan-1|dxcompiler|dxil)(\.dll)?$/i.test(n)){ if(!loaded.has(n)){loaded.add(n);log('[LoadLibrary] '+n+' -> not found');} return 0; } if(!sysdll.test(n)&&opts.softStub){ if(!loaded.has(n)){loaded.add(n);log('[LoadLibrary] '+n+' -> fake module (soft)');} const h=0x7ff300000000+(n.toLowerCase().split('').reduce((a,ch)=>(a*31+ch.charCodeAt(0))>>>0,7)&0xfffff)*0x10000; modNames.set(h,n.toLowerCase()); return h; } return sysdll.test(n)?(0x7ff200000000+(n.toLowerCase().split('').reduce((a,ch)=>(a*31+ch.charCodeAt(0))>>>0,7)&0xfffff)*0x10000):0; };
  const getProc=(name)=>{ if(!name) return 0; if(!H[name]&&opts.softStub){ if(!dynIdx.has(name)){dynIdx.set(name,dyn.length);log('[dynidx] #'+dyn.length+' '+name);dyn.push(name);} return THUNK1+16*dynIdx.get(name); } if(!H[name]) { if(!getProc.warned) getProc.warned=new Set(); if(!getProc.warned.has(name)){getProc.warned.add(name);log('[GetProcAddress] no handler for '+name);} return 0; }
    if(!dynIdx.has(name)){dynIdx.set(name,dyn.length);log('[dynidx] #'+dyn.length+' '+name);dyn.push(name);} return THUNK1+16*dynIdx.get(name); };
  const hookTrace=+(opts.hookTrace||(typeof process!=='undefined'&&process.env.HOOK_TRACE)||0);
  const onexit=[]; const files={};
  const stub0=()=>0, stub1=()=>1;
  const events=new Map(); let nEvents=0;
  let randSeed=1;
  const stackRvas=n=>{ const h=H32(),b=(Rp>>2),rsp=h[b+8]+h[b+9]*4294967296,out=[]; for(let i=0;i<256&&out.length<n;i++){ const v=g.rd64(rsp+8*i); if(v>=BASE+0x1000&&v<BASE+0x4776000) out.push((v-BASE).toString(16)); } return out; };
  let nHost=0, guestDepth=0, pendingYield=null, resumeFrame=false; const YIELD={};
  const wins=new Map(); let nWin=0, mainWin=0; const rgns=new Map(); let nRgn=0;
  const classes=new Map();
  const regClass=(atom,p)=>{ const wp=g.rd64(p+8), nm=g.rd64(p+64); classes.set(atom,wp); if(nm>=0x10000) classes.set(g.wstr(nm).toLowerCase(),wp); };
  const msgq=[]; let capture=0, activated=false, inputSize=null; const keys=new Uint8Array(256), toggles=new Uint8Array(256), mouse={x:0,y:0,btn:0};
  const postMsg=(hwnd,msg,wp,lp)=>{ msgq.push({hwnd:hwnd||mainWin,msg,wp,lp,t:Date.now()>>>0,x:mouse.x,y:mouse.y}); };
  const msgMatch=(m,hw,lo,hi)=>(!hw||m.hwnd===hw)&&(!lo&&!hi||(m.msg>=lo&&m.msg<=hi));
  const writeMsg=(p,m)=>{ g.wr64(p,m.hwnd); g.wr32(p+8,m.msg); g.wr32(p+12,0); g.wr64(p+16,m.wp); g.wr64(p+24,m.lp); g.wr32(p+32,m.t||0); g.wr32(p+36,(m.x||0)>>>0); g.wr32(p+40,(m.y||0)>>>0); g.wr32(p+44,0); };
  const sendMsg=(hwnd,msg,wp,lp)=>{ const w=wins.get(hwnd); if(!w||!w.wndproc) return 0; return guestCall(w.wndproc,[hwnd,msg,wp,lp]); };
  const keyState=vk=>(keys[vk]?0x8000:0)|(toggles[vk]?1:0);
  const SCAN={8:14,9:15,13:28,16:42,17:29,18:56,20:58,27:1,32:57,33:73,34:81,35:79,36:71,37:75,38:72,39:77,40:80,45:82,46:83,160:42,161:54,162:29,163:29,164:56,165:56,186:39,187:13,188:51,189:12,190:52,191:53,192:41,219:26,220:43,221:27,222:40};
  '1234567890'.split('').forEach((ch,i)=>{ SCAN[ch.charCodeAt(0)]=2+i; }); 'QWERTYUIOP'.split('').forEach((ch,i)=>{ SCAN[ch.charCodeAt(0)]=16+i; });
  'ASDFGHJKL'.split('').forEach((ch,i)=>{ SCAN[ch.charCodeAt(0)]=30+i; }); 'ZXCVBNM'.split('').forEach((ch,i)=>{ SCAN[ch.charCodeAt(0)]=44+i; }); for(let i=0;i<12;i++) SCAN[112+i]=i<10?59+i:87+i-10;
  const mapVK=(code,type)=>{ if(type===0) return SCAN[code]||0; if(type===1||type===3){ for(const k in SCAN) if(SCAN[k]===code) return +k; return 0; }
    if(type===2){ if((code>=65&&code<=90)||(code>=48&&code<=57)||code===32) return code; return {8:8,9:9,13:13,27:27,186:59,187:61,188:44,189:45,190:46,191:47,192:96,219:91,220:92,221:93,222:39}[code]||0; } return 0; };
  const mkFlags=()=>(mouse.btn&1?1:0)|(mouse.btn&2?2:0)|(mouse.btn&4?0x10:0)|(keys[16]?4:0)|(keys[17]?8:0);
  const lpXY=(x,y)=>((y&0xffff)<<16|(x&0xffff))>>>0;
  const input=ev=>{
    const w=wins.get(mainWin); if(!w) return;
    if(!activated){ activated=true; postMsg(mainWin,0x06,0,0); postMsg(mainWin,0x1C,0,0); postMsg(mainWin,0x1C,1,0); postMsg(mainWin,0x21,mainWin,(0x201<<16)|1); postMsg(mainWin,0x06,2,0); postMsg(mainWin,0x07,0,0); }
    if(ev.x!==undefined){ mouse.x=Math.round(ev.x*(inputSize?inputSize[0]:w.w)); mouse.y=Math.round(ev.y*(inputSize?inputSize[1]:w.h)); }
    if(ev.t==='move'){ const last=msgq[msgq.length-1]; if(last&&last.msg===0x200) msgq.pop(); postMsg(mainWin,0x200,mkFlags(),lpXY(mouse.x,mouse.y)); }
    else if(ev.t==='down'||ev.t==='up'){ const bit=[1,2,4][ev.b]||1; if(ev.t==='down') mouse.btn|=bit; else mouse.btn&=~bit; keys[[1,2,4][ev.b]||1]=ev.t==='down'?1:0;
      const base=[0x201,0x204,0x207][ev.b]||0x201; postMsg(mainWin,ev.t==='down'?base:base+1,mkFlags(),lpXY(mouse.x,mouse.y)); }
    else if(ev.t==='wheel'){ postMsg(mainWin,0x20A,((((ev.d|0)&0xffff)<<16)|mkFlags())>>>0,lpXY(w.x+mouse.x,w.y+mouse.y)); }
    else if(ev.t==='key'){ const vk=ev.vk&255; if(ev.down&&!keys[vk]&&vk===20) toggles[20]^=1; keys[vk]=ev.down?1:0;
      if(vk===16||vk===17||vk===18){ const lr={16:[160,161],17:[162,163],18:[164,165]}[vk]; keys[lr[ev.right?1:0]]=ev.down?1:0; }
      const sys=keys[18]&&vk!==18, lp=(1|((SCAN[vk]||0)<<16)|(ev.ext?1<<24:0)|(ev.down?(ev.rep?1<<30:0):0xC0000000))>>>0;
      postMsg(mainWin,ev.down?(sys?0x104:0x100):(sys?0x105:0x101),vk,lp); }
    else if(ev.t==='char'){ postMsg(mainWin,0x102,ev.ch&0xffff,1); }
  };
  const putRect=(p,l,t,r,b)=>{ g.wr32(p,l>>>0); g.wr32(p+4,t>>>0); g.wr32(p+8,r>>>0); g.wr32(p+12,b>>>0); };
  const winLong=(hw,idx,v)=>{ const w=wins.get(hw); if(!w) return 0; const key=idx===-16?'style':idx===-20?'ex':null;
    const old=key?w[key]:(w.longs[idx]||0); if(v!==undefined){ if(key) w[key]=v; else w.longs[idx]=v; } return old; };
  const iw=new Map(); let lastInit=null; const lastErrSet=(v)=>{ if(H.SetLastError) H.SetLastError({a:()=>v}); }; let threadId=0, xallocN=0, localeIds=0;
  const H={
    IsProcessorFeaturePresent:c=>{
      const h=H32(), b=(Rp>>2), rsp=h[b+8]+h[b+9]*4294967296; const rv=[];
      for(let i=0;i<48;i++){const v=g.rd64(rsp+8*i); if(v>=BASE&&v<BASE+0x4a00000) rv.push('0x'+(v-BASE).toString(16));}
      log('[IsProcessorFeaturePresent('+c.a(0)+')] stack code ptrs (rva): '+rv.slice(0,10).join(' '));
      return c.a(0)===23?0:1; },
    _initterm:c=>{let n=0;for(let f=c.a(0);f<c.a(1);f+=8){const p=g.rd64(f);if(p){lastInit={rva:p-BASE,idx:n,slot:f-BASE};guestCall(p);}n++;}},
    _initterm_e:c=>{for(let f=c.a(0);f<c.a(1);f+=8){const p=g.rd64(f);if(p){const r=guestCall(p)&0xffffffff;if(r)return r;}}return 0;},
    _set_app_type:stub0, _set_new_mode:stub0, _configthreadlocale:stub0, _set_fmode:stub0, _controlfp_s:stub0, __setusermatherr:stub0,
    _configure_narrow_argv:stub0, _configure_wide_argv:stub0, _initialize_narrow_environment:stub0, _initialize_wide_environment:stub0,
    __p___argc:()=>{ if(!H._argc){H._argc=g.alloc(8);g.wr32(H._argc,ARGV.length);} return H._argc; },
    __p___argv:()=>{ if(!H._argv){H._argv=g.alloc(8);g.wr64(H._argv,argvBlock(ARGV,false));} return H._argv; },
    __p___wargv:()=>{ if(!H._wargv){H._wargv=g.alloc(8);g.wr64(H._wargv,argvBlock(ARGV,true));} return H._wargv; },
    _get_initial_narrow_environment:()=>{ if(!environ){environ=g.alloc(16);g.wr64(environ,0);} return environ; },
    _get_initial_wide_environment:()=>{ if(!environ){environ=g.alloc(16);g.wr64(environ,0);} return environ; },
    __p__commode:()=>{ if(!H._cm){H._cm=g.alloc(8);g.wr32(H._cm,0);} return H._cm; },
    __p__fmode:()=>{ if(!H._fm){H._fm=g.alloc(8);g.wr32(H._fm,0);} return H._fm; },
    _get_narrow_winmain_command_line:()=>{ if(!H._cl){H._cl=g.alloc(1024);g.puta(H._cl,CMDLINE);} return H._cl; },
    _get_wide_winmain_command_line:()=>{ if(!H._wcl){H._wcl=g.alloc(2048);g.putw(H._wcl,CMDLINE);} return H._wcl; },
    GetCommandLineW:c=>H._get_wide_winmain_command_line(c), GetCommandLineA:c=>H._get_narrow_winmain_command_line(c),
    _crt_atexit:c=>{onexit.push(c.a(0));return 0;},
    _initialize_onexit_table:c=>{g.wr64(c.a(0),0);g.wr64(c.a(0)+8,0);g.wr64(c.a(0)+16,0);return 0;},
    _register_onexit_function:c=>{onexit.push(c.a(1));return 0;},
    _execute_onexit_table:stub0,
    _seh_filter_exe:stub0, _invalid_parameter_noinfo_noreturn:c=>{throw new Error('_invalid_parameter_noinfo_noreturn');},
    abort:c=>{throw new Error('abort() called');}, terminate:c=>{throw new Error('terminate() called');},
    exit:c=>{log('[exit] code '+c.a(0));throw {exit:c.a(0)};}, _exit:c=>{log('[_exit] code '+c.a(0));throw {exit:c.a(0)};}, _cexit:stub0,
    __acrt_iob_func:c=>{ if(!H._iob){H._iob=g.alloc(0x60*3,16);} return H._iob+0x60*c.a(0); },
    setvbuf:stub0, __stdio_common_vfprintf:c=>doFprintf(c,false), __stdio_common_vfwprintf:c=>doFprintf(c,true), __stdio_common_vsprintf:c=>doSprintf(c,false), __stdio_common_vswprintf:c=>doSprintf(c,true),
    SetThreadPriority:stub1, CoTaskMemFree:stub0, CoTaskMemAlloc:c=>malloc(c.a(0)),
    memset:c=>{if(c.a(2))g.bytes(c.a(0),c.a(2)).fill(c.a(1)&255);return c.a(0);},
    memcpy:c=>{const n=c.a(2);if(!n)return c.a(0);H8().copyWithin(off(c.a(0)),off(c.a(1)),off(c.a(1))+n);return c.a(0);},
    memmove:c=>{const n=c.a(2);if(!n)return c.a(0);H8().copyWithin(off(c.a(0)),off(c.a(1)),off(c.a(1))+n);return c.a(0);},
    memcmp:c=>{if(!c.a(2))return 0;const a=g.bytes(c.a(0),c.a(2)),b=g.bytes(c.a(1),c.a(2));for(let i=0;i<a.length;i++)if(a[i]!==b[i])return (a[i]-b[i])>>>0;return 0;},
    __std_type_info_name:c=>{
      const d=c.a(0); const cached=g.rd64(d); if(cached) return cached;
      let n=g.cstr(d+8), pre='';
      if(n.startsWith('.?AV')){pre='class ';n=n.slice(4);} else if(n.startsWith('.?AU')){pre='struct ';n=n.slice(4);} else if(n.startsWith('.?AW4')){pre='enum ';n=n.slice(5);} else if(n.startsWith('.?AT')){pre='union ';n=n.slice(4);}
      n=n.replace(/@@$/,'').split('@').reverse().join('::');
      const full=pre+n; const p=malloc(full.length+1); g.puta(p,full); g.wr64(d,p); return p; },
    __std_type_info_compare:c=>{const a=g.cstr(c.a(0)+8),b=g.cstr(c.a(1)+8);return a===b?0:(a<b?-1:1)>>>0;},
    __RTtypeid:c=>{const o=c.a(0); if(!o) return 0; const vt=g.rd64(o), col=g.rd64(vt-8); return BASE+g.rd32(col+12);},
    _tzset:()=>0, getenv:()=>0, GetUserGeoID:()=>244, GetGeoInfoW:()=>0,
    __tzname:()=>{ if(!H.__tzn){const a=malloc(16),n=malloc(8);g.puta(n,'UTC');g.wr64(a,n);g.wr64(a+8,n);H.__tzn=a;} return H.__tzn; },
    GetUserDefaultLocaleName:c=>{g.putw(c.a(0),'en-US');return 6;}, GetLocaleInfoEx:()=>0, VerSetConditionMask:()=>0, VerifyVersionInfoW:()=>1,
    __timezone:()=>{ if(!H.__tz){H.__tz=malloc(8);g.wr64(H.__tz,0);} return H.__tz; },
    __daylight:()=>{ if(!H.__dl){H.__dl=malloc(8);g.wr64(H.__dl,0);} return H.__dl; },
    RegisterClassW:c=>{H._atom=(H._atom||0xC000)+1; regClass(H._atom,c.a(0));console.error('[RegisterClass]',JSON.stringify(g.wstr(g.rd64(c.a(0)+64))),'-> atom',H._atom.toString(16));return H._atom;},
    RegisterClassExW:c=>{H._atom=(H._atom||0xC000)+1; regClass(H._atom,c.a(0));console.error('[RegisterClassEx]',JSON.stringify(g.wstr(g.rd64(c.a(0)+64))),'-> atom',H._atom.toString(16));return H._atom;},
    MessageBoxW:c=>{console.error('[MessageBox]',JSON.stringify(g.wstr(c.a(2))),'|',JSON.stringify(g.wstr(c.a(1))));return 1;},
    GetSystemMetrics:c=>{const n=c.a(0)|0; return ({0:1920,1:1080,16:1920,17:1080,78:1920,79:1080,80:1,4:23,5:1,6:1,7:3,8:3,15:23,32:3,33:3,45:2,46:2,67:0,19:1,43:3,75:1})[n]||0;}  ,
    fflush:()=>0, srand:c=>{ randSeed=c.a(0)>>>0; }, rand:()=>{ randSeed=(Math.imul(randSeed,214013)+2531011)>>>0; return (randSeed>>>16)&0x7fff; },
     PostQuitMessage:()=>0, FindResourceW:()=>0, CreateFileMappingW:()=>0, _set_purecall_handler:()=>0,
    _wtoi64:c=>{const v=parseInt(g.wstr(c.a(0)).trim(),10);return Number.isFinite(v)?v:0;},
    _wcstoui64:c=>{const v=parseInt(g.wstr(c.a(0)).trim(),c.a(2)||10);return Number.isFinite(v)?v:0;},
    _errno:()=>{ if(!H.__en){H.__en=malloc(8);g.wr64(H.__en,0);} return H.__en; },
    _wfopen:()=>0,
    GetNativeSystemInfo:c=>H.GetSystemInfo(c),
    GetLogicalProcessorInformation:c=>{const buf=c.a(0),lenp=c.a(1),ents=[];
      for(let i=0;i<4;i++){ ents.push([1<<i,0,[1]]); ents.push([1<<i,2,[1,8,64,32768,2]]); ents.push([1<<i,2,[2,8,64,262144,0]]); }
      ents.push([0xf,2,[3,12,64,6291456,0]]); ents.push([0xf,3,[0]]); ents.push([0xf,1,[0]]);
      const need=32*ents.length; if(!buf||g.rd32(lenp)<need){g.wr32(lenp,need);lastErrSet(122);return 0;}
      ents.forEach(([mask,rel,u],k)=>{const e=buf+32*k; for(let j=0;j<32;j+=8)g.wr64(e+j,0); g.wr64(e,mask); g.wr32(e+8,rel);
        if(rel===2){g.wr8(e+16,u[0]);g.wr8(e+17,u[1]);g.wr16(e+18,u[2]);g.wr32(e+20,u[3]);g.wr32(e+24,u[4]);} else g.wr8(e+16,u[0]); });
      g.wr32(lenp,need); return 1;},
    GetVersionExW:c=>{const p=c.a(0);g.wr32(p+4,10);g.wr32(p+8,0);g.wr32(p+12,19045);g.wr32(p+16,2);return 1;},
    
    GetUserNameW:c=>{g.putw(c.a(0),'Player');g.wr32(c.a(1),7);return 1;},
    GetUserPreferredUILanguages:c=>{const n=c.a(1),b=c.a(2),l=c.a(3);if(n)g.wr32(n,1);if(!b){g.wr32(l,7);return 1;}g.putw(b,'en-US');g.wr16(b+12,0);g.wr32(l,7);return 1;},
    RegCreateKeyExW:()=>5, RegSetValueExW:()=>5,
    WinHttpGetDefaultProxyConfiguration:()=>0, WinHttpGetIEProxyConfigForCurrentUser:()=>0, CertOpenSystemStoreW:()=>0,
    modf:c=>{const x=xf64(0),ip=Math.trunc(x);const dv=new DataView(new ArrayBuffer(8));dv.setFloat64(0,ip,true);g.wr32(c.a(1),dv.getUint32(0,true));g.wr32(c.a(1)+4,dv.getUint32(4,true));setxf64(0,x-ip);},
    _finite:c=>Number.isFinite(xf64(0))?1:0, _isnan:c=>Number.isNaN(xf64(0))?1:0, _finitef:c=>Number.isFinite(xf32(0))?1:0, _isnanf:c=>Number.isNaN(xf32(0))?1:0,
    _wtof:c=>{setxf64(0,parseFloat(g.wstr(c.a(0)))||0);},
    WSAStartup:c=>{const p=c.a(1);g.wr16(p,0x0202);g.wr16(p+2,0x0202);return 0;}, WSACleanup:()=>0,
    socket:()=>-1, WSAGetLastError:()=>10050, closesocket:stub0, WSACreateEvent:()=>0x1000+Math.floor(Math.random()*1e6),
    WSACloseEvent:stub1, WSASetEvent:stub1, WSAResetEvent:stub1, WSAEventSelect:stub0,
    CM_Get_Device_ID_List_SizeW:c=>{ if(c.a(0))g.wr32(c.a(0),0); return 0x13; }, CM_Get_Device_ID_ListW:()=>0x13,
    CM_Locate_DevNodeW:()=>0xd, CM_MapCrToWin32Err:c=>c.a(1),
    CreateWindowExW:c=>{ const i32=x=>(x%4294967296)|0, CW=-0x80000000; let x=i32(c.a(4)),y=i32(c.a(5)),w=i32(c.a(6)),h=i32(c.a(7));
      if(x===CW){x=0;y=0;} if(w===CW||w<=0){w=1280;h=720;} const hw=0x20000+4*(++nWin);
      const cls=c.a(1), wndproc=classes.get(cls<0x10000?cls:g.wstr(cls).toLowerCase())||0;
      wins.set(hw,{x,y,w,h,style:c.a(3)%4294967296,ex:c.a(0)%4294967296,vis:false,longs:{},wndproc}); if(!mainWin) mainWin=hw;
      log('[window] create '+hw.toString(16)+' "'+(c.a(2)?g.wstr(c.a(2)):'')+'" '+x+','+y+' '+w+'x'+h); return hw; },
    DestroyWindow:c=>{ wins.delete(c.a(0)); return 1; }, IsWindow:c=>wins.has(c.a(0))?1:0, IsWindowVisible:c=>{ const w=wins.get(c.a(0)); return w&&w.vis?1:0; },
    IsWindowEnabled:stub1, EnableWindow:stub0, IsZoomed:stub0, IsIconic:stub0, UpdateWindow:stub1, InvalidateRect:stub1, ValidateRect:stub1,
    ShowWindow:c=>{ const w=wins.get(c.a(0)); if(!w) return 0; const was=w.vis; w.vis=(c.a(1)%4294967296)!==0; return was?1:0; },
    AdjustWindowRectEx:stub1, AdjustWindowRect:stub1, SetWindowTextW:stub1, SetWindowTextA:stub1, FlashWindowEx:stub0, BringWindowToTop:stub1,
    GetClientRect:c=>{ const w=wins.get(c.a(0)); if(!w) return 0; putRect(c.a(1),0,0,w.w,w.h); return 1; },
    GetWindowRect:c=>{ const w=wins.get(c.a(0)); if(!w) return 0; putRect(c.a(1),w.x,w.y,w.x+w.w,w.y+w.h); return 1; },
    SetWindowPos:c=>{ const w=wins.get(c.a(0)); if(!w) return 0; const i32=x=>(x%4294967296)|0, f=c.a(6)%4294967296;
      if(!(f&2)){w.x=i32(c.a(2));w.y=i32(c.a(3));} if(!(f&1)){w.w=i32(c.a(4));w.h=i32(c.a(5));} if(f&0x40)w.vis=true; if(f&0x80)w.vis=false; log('[window] SetWindowPos '+w.x+','+w.y+' '+w.w+'x'+w.h+' flags=0x'+f.toString(16)); return 1; },
    MoveWindow:c=>{ const w=wins.get(c.a(0)); if(!w) return 0; const i32=x=>(x%4294967296)|0; w.x=i32(c.a(1));w.y=i32(c.a(2));w.w=i32(c.a(3));w.h=i32(c.a(4)); return 1; },
    GetWindowLongW:c=>winLong(c.a(0),(c.a(1)%4294967296)|0), GetWindowLongPtrW:c=>winLong(c.a(0),(c.a(1)%4294967296)|0),
    SetWindowLongW:c=>winLong(c.a(0),(c.a(1)%4294967296)|0,c.a(2)%4294967296), SetWindowLongPtrW:c=>winLong(c.a(0),(c.a(1)%4294967296)|0,c.a(2)),
    GetWindowPlacement:c=>{ const w=wins.get(c.a(0)), p=c.a(1); if(!w) return 0; g.bytes(p+4,40).fill(0); g.wr32(p+8,1); putRect(p+28,w.x,w.y,w.x+w.w,w.y+w.h); return 1; },
    SetWindowPlacement:stub1,
    GetWindowInfo:c=>{ const w=wins.get(c.a(0)), p=c.a(1); if(!w) return 0; g.bytes(p+4,56).fill(0); putRect(p+4,w.x,w.y,w.x+w.w,w.y+w.h); putRect(p+20,w.x,w.y,w.x+w.w,w.y+w.h);
      g.wr32(p+36,w.style); g.wr32(p+40,w.ex); g.wr32(p+44,1); return 1; },
    ClientToScreen:c=>{ const w=wins.get(c.a(0)), p=c.a(1); if(!w) return 0; g.wr32(p,(g.rd32(p)+w.x)>>>0); g.wr32(p+4,(g.rd32(p+4)+w.y)>>>0); return 1; },
    ScreenToClient:c=>{ const w=wins.get(c.a(0)), p=c.a(1); if(!w) return 0; g.wr32(p,(g.rd32(p)-w.x)>>>0); g.wr32(p+4,(g.rd32(p+4)-w.y)>>>0); return 1; },
    GetForegroundWindow:()=>activated?mainWin:0, GetFocus:()=>activated?mainWin:0, GetActiveWindow:()=>activated?mainWin:0, SetFocus:()=>activated?mainWin:0, SetActiveWindow:()=>activated?mainWin:0, SetForegroundWindow:stub1,
    GetWindowThreadProcessId:c=>{ if(c.a(1)) g.wr32(c.a(1),1); return 1; },
    PostMessageW:c=>{ postMsg(c.a(0),c.a(1)%4294967296,c.a(2),c.a(3)); return 1; },
    PeekMessageW:c=>{ const i=msgq.findIndex(m=>msgMatch(m,c.a(1),c.a(2)%4294967296,c.a(3)%4294967296)); if(i<0) return 0; writeMsg(c.a(0),msgq[i]); if(c.a(4)&1) msgq.splice(i,1); return 1; },
    GetMessageW:c=>{ const i=msgq.findIndex(m=>msgMatch(m,c.a(1),c.a(2)%4294967296,c.a(3)%4294967296)); const m=i<0?{hwnd:mainWin,msg:0,wp:0,lp:0}:msgq.splice(i,1)[0]; writeMsg(c.a(0),m); return m.msg===0x12?0:1; },
    DispatchMessageW:c=>{ const p=c.a(0); return sendMsg(g.rd64(p),g.rd32(p+8),g.rd64(p+16),g.rd64(p+24)); }, TranslateMessage:stub0,
    SendMessageW:c=>sendMsg(c.a(0),c.a(1)%4294967296,c.a(2),c.a(3)),
    DefWindowProcW:c=>{ const m=c.a(1)%4294967296; return m===0x84?1:m===0x21?1:0; },
    GetMessageExtraInfo:stub0, GetMessageTime:()=>Date.now()>>>0, TrackMouseEvent:stub1, RegisterTouchWindow:stub1, GetClassLongPtrW:stub0, GetKeyboardLayout:()=>0x04090409,
    GetKeyState:c=>keyState(c.a(0)%256), GetAsyncKeyState:c=>keyState(c.a(0)%256)&0x8000,
    GetRawInputDeviceList:c=>{ const list=c.a(0), pn=c.a(1); if(!pn) return 0xffffffff; if(!list){ g.wr32(pn,2); return 0; } if(g.rd32(pn)<2){ g.wr32(pn,2); return 0xffffffff; }
      g.wr64(list,0x100); g.wr32(list+8,0); g.wr64(list+16,0x101); g.wr32(list+24,1); return 2; },
    GetRawInputDeviceInfoA:c=>{ const cmd=c.a(1)%4294967296, p=c.a(2), pn=c.a(3), name=c.a(0)===0x100?'\\?\HID#VID_046D&PID_C077#mouse':'\\?\HID#VID_046D&PID_C31C#kbd';
      if(cmd===0x20000007){ const n=name.length+1; if(!p){ if(pn) g.wr32(pn,n); return 0; } g.puta(p,name); return n; }
      if(cmd===0x2000000b){ if(!p){ if(pn) g.wr32(pn,32); return 0; } g.bytes(p,32).fill(0); g.wr32(p,32); g.wr32(p+4,c.a(0)===0x100?0:1); if(c.a(0)===0x100){ g.wr32(p+12,3); g.wr32(p+16,400); g.wr32(p+20,1); } return 32; }
      if(pn) g.wr32(pn,0); return 0; },
    MapVirtualKeyW:c=>mapVK(c.a(0)%4294967296,c.a(1)%4294967296), WindowFromPoint:()=>mainWin, ChildWindowFromPoint:c=>c.a(0),
    GetDC:()=>0x5000, ReleaseDC:stub1, GetDeviceCaps:c=>({8:1920,10:1080,12:32,88:96,90:96,117:1080,118:1920}[c.a(1)%4294967296]||0),
    LoadCursorW:c=>0x6000+(c.a(1)%0x10000), LoadCursorFromFileW:stub0, LoadIconW:()=>0x7000, SetCursor:()=>0x6000, DisableProcessWindowsGhosting:stub0,
    GetCursorPos:c=>{ const w=wins.get(mainWin)||{x:0,y:0}; if(c.a(0)){ g.wr32(c.a(0),(w.x+mouse.x)>>>0); g.wr32(c.a(0)+4,(w.y+mouse.y)>>>0); } return 1; },
    SetCursorPos:c=>{ const w=wins.get(mainWin)||{x:0,y:0}; mouse.x=((c.a(0)%4294967296)|0)-w.x; mouse.y=((c.a(1)%4294967296)|0)-w.y; return 1; },
    ClipCursor:c=>{ const p=c.a(0); log('[input] ClipCursor '+(p?JSON.stringify([0,4,8,12].map(o=>g.rd32(p+o)|0)):'NULL')); return 1; },
    SetCapture:c=>{ const p=capture; capture=c.a(0); log('[input] SetCapture '+c.a(0).toString(16)+' stack: '+stackRvas(24).join(' ')); return p; }, ReleaseCapture:()=>{ capture=0; log('[input] ReleaseCapture'); return 1; }, GetCapture:()=>capture, RegisterRawInputDevices:stub1, ShowCursor:stub0,
    CreateRectRgn:c=>{ const h=0x9000+4*(++nRgn); const i32=x=>(x%4294967296)|0; rgns.set(h,[i32(c.a(0)),i32(c.a(1)),i32(c.a(2)),i32(c.a(3))]); return h; },
    CreateRoundRectRgn:c=>{ const h=0x9000+4*(++nRgn); const i32=x=>(x%4294967296)|0; rgns.set(h,[i32(c.a(0)),i32(c.a(1)),i32(c.a(2)),i32(c.a(3))]); return h; },
    PtInRegion:c=>{ const r=rgns.get(c.a(0)), x=(c.a(1)%4294967296)|0, y=(c.a(2)%4294967296)|0; return r&&x>=r[0]&&x<r[2]&&y>=r[1]&&y<r[3]?1:0; },
    DeleteObject:c=>{ rgns.delete(c.a(0)); return 1; }, SetWindowRgn:stub1,
    '#2':()=>1167, XInputGetState:()=>1167, XInputGetCapabilities:()=>1167, XInputSetState:()=>1167,
    SystemParametersInfoW:c=>{ const a=c.a(0)%4294967296, p=c.a(2); if(a===0x30&&p){ putRect(p,0,0,1920,1040); return 1; } return 0; },
    StringFromGUID2:c=>{ const b=g.bytes(c.a(0),16), h=(i,j,rev)=>{ const s=[...b.subarray(i,j)].map(x=>x.toString(16).padStart(2,'0').toUpperCase()); return (rev?s.reverse():s).join(''); };
      const s='{'+h(0,4,1)+'-'+h(4,6,1)+'-'+h(6,8,1)+'-'+h(8,10)+'-'+h(10,16)+'}'; if(c.a(2)<39) return 0; g.putw(c.a(1),s); return 39; },
    IIDFromString:c=>{ const s=g.wstr(c.a(0)).replace(/[{}]/g,''), m=/^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/i.exec(s); if(!m) return 0x800401F3;
      const le=(hx,n)=>{ const v=[]; for(let i=0;i<n;i++) v.push(parseInt(hx.substr(2*(n-1-i),2),16)); return v; }, be=hx=>hx.match(/../g).map(x=>parseInt(x,16));
      const out=[...le(m[1],4),...le(m[2],2),...le(m[3],2),...be(m[4]),...be(m[5])]; g.bytes(c.a(1),16).set(out); return 0; },
    strerror_s:c=>{const b=c.a(0),n=c.a(1);const s='Error '+c.a(2);for(let i=0;i<Math.min(s.length,n-1);i++)g.wr8(b+i,s.charCodeAt(i));g.wr8(b+Math.min(s.length,n-1),0);return 0;},
    qsort:c=>{ const base=c.a(0),num=c.a(1),sz=c.a(2),cmp=c.a(3); if(num<2)return;
      const items=[];for(let i=0;i<num;i++)items.push(Uint8Array.from(g.bytes(base+i*sz,sz)));
      const A=g.alloc(sz,16),B=g.alloc(sz,16);
      items.sort((x,y)=>{g.bytes(A,sz).set(x);g.bytes(B,sz).set(y);return guestCall(cmp,[A,B])<<0;});
      items.forEach((it,i)=>g.bytes(base+i*sz,sz).set(it)); },
    CoInitializeEx:()=>0, CoInitialize:()=>0, CoUninitialize:()=>0, CoInitializeSecurity:()=>0, timeBeginPeriod:()=>0, timeEndPeriod:()=>0,
    CoCreateInstance:c=>{ const id=[...g.bytes(c.a(0),16)].map(x=>x.toString(16).padStart(2,'0')).join(''); { const r=audio&&audio.coCreate(id,c.a(4)); if(r!==null&&r!==undefined) return r; } if(!seen.has('clsid'+id)){ seen.add('clsid'+id); log('[com] CoCreateInstance '+id+' -> class not registered'); }
      if(c.a(4))g.wr64(c.a(4),0); return 0x80040154; }, CoCreateInstanceEx:()=>0x80040154, CoGetClassObject:()=>0x80040154,
    SysAllocString:c=>{ const s=c.a(0)?g.wstr(c.a(0)):''; const p=malloc(s.length*2+8); g.wr32(p,s.length*2); g.putw(p+4,s); return p+4; },
    SysAllocStringLen:c=>{ const n=c.a(1); const p=malloc(n*2+8); g.wr32(p,n*2); if(c.a(0)){ const s=g.wstr(c.a(0)).slice(0,n); g.putw(p+4,s);} else g.wr16(p+4,0); return p+4; },
    SysFreeString:()=>0, SysStringLen:c=>c.a(0)?g.rd32(c.a(0)-4)/2:0,
    EnumDisplayMonitors:c=>{ const r=malloc(16); g.wr32(r,0);g.wr32(r+4,0);g.wr32(r+8,1920);g.wr32(r+12,1080); guestCall(c.a(2),[0x10001,0,r,c.a(3)]); return 1; },
    GetMonitorInfoW:c=>{ const p=c.a(1); const ex=g.rd32(p)>=104; g.wr32(p+4,0);g.wr32(p+8,0);g.wr32(p+12,1920);g.wr32(p+16,1080);g.wr32(p+20,0);g.wr32(p+24,0);g.wr32(p+28,1920);g.wr32(p+32,1040);g.wr32(p+36,1); if(ex) g.putw(p+40,'\\\\.\\DISPLAY1'); return 1; },
    MonitorFromWindow:()=>0x10001, MonitorFromPoint:()=>0x10001, MonitorFromRect:()=>0x10001,
    SetupDiGetClassDevsW:()=>0xffffffffffffffff, SetupDiEnumDeviceInfo:()=>0, SetupDiDestroyDeviceInfoList:()=>1,
    EnumDisplayDevicesW:c=>{ if(c.a(0)||c.a(1)!==0) return 0; const p=c.a(2); for(let i=0;i<840;i++)g.wr8(p+i,0); g.wr32(p,840);
      g.putw(p+4,'\\\\.\\DISPLAY1'); g.putw(p+68,'Intel(R) Iris(R) Xe Graphics'); g.wr32(p+324,5);
      g.putw(p+328,'PCI\\VEN_8086&DEV_9A49&SUBSYS_00000000&REV_01'); g.putw(p+584,'\\Registry\\Machine\\System\\CurrentControlSet\\Control\\Video\\{A7AA6116-9C8D-4BBA-9083-B4D816B71B78}\\0000'); return 1; },
    RegOpenKeyExW:c=>{ const sub=c.a(1)?g.wstr(c.a(1)):''; if(/Video|DirectX|Display|GraphicsDrivers/i.test(sub)){ g.wr64(c.a(4),0x6000+sub.length); return 0; } return 2; },
    RegCloseKey:()=>0,
    RegQueryValueExW:c=>{ const n=c.a(1)?g.wstr(c.a(1)):''; const V={DriverVersion:'31.0.101.2111',ProviderName:'Intel Corporation',DriverDate:'6-5-2023','HardwareInformation.AdapterString':'Intel(R) Iris(R) Xe Graphics',UserModeDriverName:'igd10iumd64.dll',DriverDesc:'Intel(R) Iris(R) Xe Graphics',MatchingDeviceId:'PCI\\VEN_8086&DEV_9A49'};
      if(!(n in V)) return 2; const s=V[n], bytes=(s.length+1)*2; if(c.a(3))g.wr32(c.a(3),1); if(c.a(4)){ if(c.a(5)&&g.rd32(c.a(5))<bytes){ g.wr32(c.a(5),bytes); return 234; } g.putw(c.a(4),s); } if(c.a(5))g.wr32(c.a(5),bytes); return 0; },
    strlen:c=>g.cstr(c.a(0)).length, wcslen:c=>g.wstr(c.a(0)).length,
    malloc:c=>malloc(c.a(0)), calloc:c=>{const n=c.a(0)*c.a(1),p=malloc(n);g.bytes(p,n).fill(0);return p;},
    realloc:c=>{const o=c.a(0),n=c.a(1);const p=malloc(n);if(o){const s=Math.min(msize(o),n);H8().copyWithin(off(p),off(o),off(o)+s);}return p;},
    free:stub0, _msize:c=>msize(c.a(0)), _callnewh:stub0,
    _aligned_malloc:c=>{const al=Math.max(c.a(1),16);const p=g.alloc(c.a(0)+al+16,al)+0; const q=p+al; g.wr64(q-8,c.a(0)); return q;},
    _aligned_free:stub0, _aligned_msize:c=>g.rd64(c.a(0)-8),
    HeapCreate:()=>BASE+0x110000, HeapReAlloc:c=>{const o=c.a(2),n=c.a(3);const p=malloc(n);if(o){const s=Math.min(msize(o),n);H8().copyWithin(off(p),off(o),off(o)+s);}return p;},
    HeapSize:c=>msize(c.a(2)), HeapDestroy:stub1, HeapSetInformation:stub1,
    VirtualAlloc:c=>{const n=c.a(1);const a=c.a(0);if(a)return a;const p=g.alloc(Math.max(n,1),65536);return p;},
    VirtualFree:stub1, VirtualProtect:c=>{if(c.a(3))g.wr32(c.a(3),4);return 1;}, VirtualQuery:stub0,
    GlobalMemoryStatusEx:c=>{const p=c.a(0);g.wr32(p,64);g.wr32(p+4,50);g.wr64(p+8,4*2**30);g.wr64(p+16,3*2**30);g.wr64(p+24,8*2**30);g.wr64(p+32,6*2**30);g.wr64(p+40,2**47);g.wr64(p+48,2**47-2**30);return 1;},
    GetSystemInfo:c=>{const p=c.a(0);g.wr16(p,9);g.wr32(p+4,4096);g.wr64(p+8,0x10000);g.wr64(p+16,0x7ffffffeffff);g.wr64(p+24,0xff);g.wr32(p+32,4);g.wr32(p+36,8664);g.wr32(p+40,65536);},
    TlsAlloc:()=>nextTls++, TlsGetValue:c=>tls.get(c.a(0))||0, TlsSetValue:c=>{tls.set(c.a(0),c.a(1));return 1;}, TlsFree:stub1,
    FlsAlloc:()=>nextFls++, FlsGetValue:c=>fls.get(c.a(0))||0, FlsSetValue:c=>{fls.set(c.a(0),c.a(1));return 1;}, FlsFree:stub1,
    InitializeCriticalSection:stub0, InitializeCriticalSectionAndSpinCount:stub1, InitializeCriticalSectionEx:stub1,
    EnterCriticalSection:stub0, LeaveCriticalSection:stub0, TryEnterCriticalSection:stub1, DeleteCriticalSection:stub0,
    InitializeSListHead:c=>{g.wr64(c.a(0),0);g.wr64(c.a(0)+8,0);},
    InitializeSRWLock:stub0, AcquireSRWLockExclusive:stub0, ReleaseSRWLockExclusive:stub0, AcquireSRWLockShared:stub0, ReleaseSRWLockShared:stub0,
    InitOnceBeginInitialize:c=>{const o=c.a(0),fl=c.a(1),v=g.rd64(o);
      if((v&3)===2){if(c.a(2))g.wr32(c.a(2),0);if(c.a(3))g.wr64(c.a(3),v-2);return 1;}
      if(fl&1){lastErrSet(31);return 0;}
      g.wr64(o,1);if(c.a(2))g.wr32(c.a(2),1);return 1;},
    InitOnceComplete:c=>{const o=c.a(0),fl=c.a(1),ctx=c.a(2);
      if(fl&4){g.wr64(o,0);return 1;}
      g.wr64(o,(ctx-ctx%4)+2);return 1;},
    InitOnceExecuteOnce:c=>{const o=c.a(0),fn=c.a(1),v=g.rd64(o);
      if((v&3)!==2){const cp=g.alloc(8);g.wr64(cp,0);g.wr64(o,1);
        if(!(guestCall(fn,[o,c.a(2),cp])&0xffffffff)){g.wr64(o,0);return 0;}
        const ctx=g.rd64(cp);g.wr64(o,(ctx-ctx%4)+2);}
      if(c.a(3))g.wr64(c.a(3),g.rd64(o)-2);return 1;},
    InitOnceInitialize:c=>{g.wr64(c.a(0),0);return 0;},
    WakeAllConditionVariable:stub0, WakeConditionVariable:stub0, SleepConditionVariableSRW:stub1, SleepConditionVariableCS:stub1,
    CreateEventW:c=>{ const h=0x70000000+(++nEvents)*4; events.set(h,{manual:!!(c.a(1)&0xff),set:!!(c.a(2)&0xff)}); return h; },
    CreateEventA:c=>H.CreateEventW(c),
    CreateEventExW:c=>{ const h=0x70000000+(++nEvents)*4, fl=c.a(2); events.set(h,{manual:!!(fl&1),set:!!(fl&2)}); return h; },
    SetEvent:c=>{ const e=events.get(c.a(0)); if(e) e.set=true; return 1; }, ResetEvent:c=>{ const e=events.get(c.a(0)); if(e) e.set=false; return 1; },
    WaitForSingleObject:c=>{ const e=events.get(c.a(0)), ms=c.a(1)>>>0; if(!e) return 0;
      if(!e.set&&ms!==0xffffffff) return 0x102;
      if(!e.manual) e.set=false; return 0; },
    WaitForMultipleObjects:stub0,
    CreateMutexW:()=>0x2000, ReleaseMutex:stub1, CloseHandle:stub1, Sleep:stub0, SwitchToThread:stub0,
    __pctype_func:()=>{ if(!H._pct){ const b=g.alloc(2*258,16);
        for(let ch=0;ch<128;ch++){ let f=0; const s=String.fromCharCode(ch);
          if(/[A-Z]/.test(s))f|=0x101; if(/[a-z]/.test(s))f|=0x102; if(/[0-9]/.test(s))f|=0x4; if(/[0-9A-Fa-f]/.test(s))f|=0x80;
          if(ch===32||(ch>=9&&ch<=13))f|=0x8; if(ch===32||ch===9)f|=0x40; if(ch<32||ch===127)f|=0x20; if(ch>32&&ch<127&&!/[A-Za-z0-9]/.test(s))f|=0x10;
          g.wr16(b+2+2*ch,f); }
        H._pct=b+2; } return H._pct; },
    ___mb_cur_max_func:()=>1, ___lc_codepage_func:()=>0, ___lc_collate_cp_func:()=>0,
    ___lc_locale_name_func:()=>{ if(!H._lcn)H._lcn=g.alloc(6*8,8); return H._lcn; },
    setlocale:()=>{ if(!H._lcC){H._lcC=g.alloc(4,4);g.puta(H._lcC,'C');} return H._lcC; },
    _wsetlocale:()=>{ if(!H._lcW){H._lcW=g.alloc(4,4);g.putw(H._lcW,'C');} return H._lcW; },
    _lock_locales:stub0, _unlock_locales:stub0,
    localeconv:()=>{ if(!H._lconv){ const L=g.alloc(168,8), dot=g.alloc(2,2), emp=g.alloc(2,2), wdot=g.alloc(4,2), wemp=g.alloc(2,2);
        g.puta(dot,'.'); g.putw(wdot,'.');
        for(let i=0;i<10;i++){ g.wr64(L+8*i,i===0?dot:emp); g.wr64(L+88+8*i,i===0?wdot:wemp); }
        for(let i=0;i<8;i++) g.wr8(L+80+i,127);
        H._lconv=L; } return H._lconv; },
    _get_stream_buffer_pointers:c=>{ const f=c.a(0); H._sbp=H._sbp||new Map(); if(!H._sbp.has(f))H._sbp.set(f,g.alloc(24,8));
        const s=H._sbp.get(f); if(c.a(1))g.wr64(c.a(1),s); if(c.a(2))g.wr64(c.a(2),s+8); if(c.a(3))g.wr64(c.a(3),s+16); return 0; },
    '?xalloc@ios_base@std@@SAHXZ':()=>xallocN++,
    '?iword@ios_base@std@@QEAAAEAJH@Z':c=>{const key=c.a(0)+':'+c.a(1);if(!iw.has(key))iw.set(key,g.alloc(8,8));return iw.get(key);},
    '?pword@ios_base@std@@QEAAAEAPEAXH@Z':c=>{const key='p'+c.a(0)+':'+c.a(1);if(!iw.has(key))iw.set(key,g.alloc(8,8));return iw.get(key);},
    '?precision@ios_base@std@@QEAA_J_J@Z':c=>6,
    '??0_Lockit@std@@QEAA@H@Z':c=>c.a(0), '??1_Lockit@std@@QEAA@XZ':stub0,
    '?_Getgloballocale@locale@std@@CAPEAV_Locimp@12@XZ':()=>{if(!H._gl){H._gl=g.alloc(256,16);}return H._gl;},
    '?_Init@locale@std@@CAPEAV_Locimp@12@_N@Z':()=>{if(!H._gl){H._gl=g.alloc(256,16);}return H._gl;},
    '??Bid@locale@std@@QEAA_KXZ':c=>{const p=c.a(0);let v=g.rd64(p);if(!v){v=++localeIds;g.wr64(p,v);}return v;},
    '?_Getcat@?$ctype@D@std@@SA_KPEAPEBVfacet@locale@2@PEBV42@@Z':()=>2, '?_Getcat@?$codecvt@DDU_Mbstatet@@@std@@SA_KPEAPEBVfacet@locale@2@PEBV42@@Z':()=>2,
    '?uncaught_exception@std@@YA_NXZ':stub0, '?_Random_device@std@@YAIXZ':()=>(Math.random()*2**32)>>>0,
    _Thrd_id:()=>1, _Thrd_yield:stub0, _Thrd_join:stub0, _Cnd_init_in_situ:stub0, _Cnd_destroy_in_situ:stub0, _Cnd_broadcast:stub0, _Cnd_wait:stub0, _Cnd_do_broadcast_at_thread_exit:stub0,
    '?_Xbad_alloc@std@@YAXXZ':()=>{throw new Error('std::bad_alloc');}, '?_Xout_of_range@std@@YAXPEBD@Z':c=>{throw new Error('std::out_of_range: '+g.cstr(c.a(0)));}, '?_Xlength_error@std@@YAXPEBD@Z':c=>{throw new Error('std::length_error: '+g.cstr(c.a(0)));},
    '?_Xbad_function_call@std@@YAXXZ':()=>{throw new Error('std::bad_function_call');},
    LoadLibraryExA:c=>fakeMod(g.cstr(c.a(0))),
    InitializeSecurityDescriptor:stub1, SetSecurityDescriptorDacl:stub1, _set_invalid_parameter_handler:stub0, _register_thread_local_exe_atexit_callback:stub0, signal:stub0,
    CommandLineToArgvW:c=>{const v=splitArgs(g.wstr(c.a(0)));if(c.a(1))g.wr32(c.a(1),v.length);return argvBlock(v,true);},
    SHGetKnownFolderPath:c=>{const p='C:\\Users\\Player\\Documents';const a=g.alloc(2*p.length+2,2);g.putw(a,p);g.wr64(c.a(3),a);return 0;},
    CoCreateGuid:c=>{for(let i=0;i<16;i++)g.wr8(c.a(0)+i,rnd());return 0;},
    BCryptGenRandom:c=>{for(let i=0;i<c.a(2);i++)g.wr8(c.a(1)+i,rnd());return 0;},
    GetEnvironmentVariableA:stub0, K32GetProcessMemoryInfo:c=>{const p=c.a(1);g.wr32(p,72);g.wr64(p+8,0);g.wr64(p+16,300*2**20);g.wr64(p+24,300*2**20);g.wr64(p+72-8,300*2**20);return 1;},
    SetCriticalSectionSpinCount:stub0, _Mtx_init_in_situ:stub0, _Mtx_lock:stub0, _Mtx_unlock:stub0, _Mtx_destroy_in_situ:stub0,
    _get_heap_handle:()=>BASE+0x100000, _cputs:stub0,
    iswxdigit:c=>{const x=c.a(0);return (x>=48&&x<=57)||(x>=65&&x<=70)||(x>=97&&x<=102)?1:0;},
    strncpy:c=>{const d=c.a(0),s=c.a(1),n=c.a(2);let i=0;for(;i<n;i++){const b=g.rd8(s+i);g.wr8(d+i,b);if(!b){i++;break;}}for(;i<n;i++)g.wr8(d+i,0);return d;},
    strncat:c=>{const d=c.a(0),s=c.a(1),n=c.a(2);const dl=g.cstr(d).length;let i=0;for(;i<n;i++){const b=g.rd8(s+i);if(!b)break;g.wr8(d+dl+i,b);}g.wr8(d+dl+i,0);return d;},
    strcmp:c=>{const a=g.cstr(c.a(0)),b=g.cstr(c.a(1));return a<b?-1>>>0:a>b?1:0;},
    strcpy:c=>{g.puta(c.a(0),g.cstr(c.a(1)));return c.a(0);}, strcat:c=>{const d=c.a(0);g.puta(d+g.cstr(d).length,g.cstr(c.a(1)));return d;},
    wcscmp:c=>{const a=g.wstr(c.a(0)),b=g.wstr(c.a(1));return a<b?-1>>>0:a>b?1:0;},
    CreateThread:c=>{log('[CreateThread] start=0x'+(c.a(2)-BASE).toString(16)+' (not started; threads unimplemented)');return 0x3000+(++threadId);},
    GetModuleHandleW:c=>fakeMod(c.a(0)?g.wstr(c.a(0)):null), GetModuleHandleA:c=>fakeMod(c.a(0)?g.cstr(c.a(0)):null), GetModuleHandleExW:c=>{if(c.a(2))g.wr64(c.a(2),modBase);return 1;},
    GetModuleFileNameW:c=>{const s='C:\\Game\\AlternateWatch.exe';g.putw(c.a(1),s);return s.length;},
    GetProcAddress:c=>{const p=c.a(1); { const gd=guestByBase.get(c.a(0)); if(gd){ const nm=p<0x10000?'#'+p:g.cstr(p), r=gd.exports[nm]; if(r!==undefined) return BASE+r; log('[GetProcAddress] '+gd.name+' has no export '+nm); return 0; } } if(p<0x10000){ const m=ORD[modNames.get(c.a(0))]; if(m&&m[p]) return getProc(m[p]); } return getProc(p<0x10000?'#'+p:g.cstr(p));}, LoadLibraryW:c=>fakeMod(g.wstr(c.a(0))), LoadLibraryA:c=>fakeMod(g.cstr(c.a(0))), LoadLibraryExW:c=>fakeMod(g.wstr(c.a(0))), FreeLibrary:stub1,
    GetCurrentProcess:()=>-1, GetCurrentThread:()=>-2, GetCurrentProcessorNumber:stub0,
    SetUnhandledExceptionFilter:stub0, UnhandledExceptionFilter:()=>1, SetThreadErrorMode:stub1, SetErrorMode:stub0,
    RtlCaptureContext:stub0, RtlLookupFunctionEntry:stub0, RtlVirtualUnwind:stub0, RtlUnwindEx:stub0,
    RaiseException:c=>{ if(c.a(0)===0x406D1388) return; if(c.a(0)===0x4000){ { const h=H32(),b=(Rp>>2),rsp=h[b+8]+h[b+9]*4294967296,rv=[]; for(let i=0;i<1200&&rv.length<40;i++){const v=g.rd64(rsp+8*i); if(v>=BASE+0x1000&&v<BASE+0x4a00000)rv.push((v-BASE).toString(16));} log('[RaiseException 0x4000 ignored] stack: '+rv.join(' ')); } return; } throw new Error('RaiseException code=0x'+c.a(0).toString(16)); },
    SetThreadDescription:stub0,
    GetLogicalProcessorInformationEx:c=>{ if(c.a(0)!==0&&c.a(0)!==0xffff){ g.wr32(c.a(2),0); lastErrSet(122); return 0; } const per=48, n=4, need=per*n; const buf=c.a(1);
      if(!buf||g.rd32(c.a(2))<need){ g.wr32(c.a(2),need); lastErrSet(122); return 0; }
      for(let i=0;i<n;i++){ const a=buf+i*per; for(let k=0;k<per;k++)g.wr8(a+k,0); g.wr32(a,0); g.wr32(a+4,per); g.wr8(a+8,1); g.wr16(a+30,1); g.wr64(a+32,1<<i); g.wr16(a+40,0); } g.wr32(c.a(2),need); return 1; },
    TerminateProcess:c=>{throw {exit:c.a(1)};}, ExitProcess:c=>{throw {exit:c.a(0)};},
    OutputDebugStringW:c=>log('[dbg] '+g.wstr(c.a(0))), OutputDebugStringA:c=>log('[dbg] '+g.cstr(c.a(0))),
    GetTickCount:()=>Date.now()&0xffffffff, GetTickCount64:()=>Date.now(),
    GetEnvironmentVariableW:stub0, SetEnvironmentVariableW:stub1, GetCurrentDirectoryW:c=>{g.putw(c.a(1),'C:\\Game');return 7;},
    GetStdHandle:c=>c.a(0)===0xfffffff5?1:c.a(0)===0xfffffff4?2:3  , GetFileType:()=>2,
    WriteFile:c=>{const n=c.a(2);const s=new TextDecoder().decode(g.bytes(c.a(1),n));log('[stdout] '+s.trimEnd());if(c.a(3))g.wr32(c.a(3),n);return 1;},
    GetSystemTime:c=>{putST(c.a(0),new Date());}, GetLocalTime:c=>{putST(c.a(0),new Date(),true);},
    FileTimeToSystemTime:c=>{const ft=g.rd64(c.a(0));putST(c.a(1),new Date((ft-116444736000000000)/10000));return 1;},
    SystemTimeToFileTime:c=>{const p=c.a(0);const d=Date.UTC(g.rd16(p),g.rd16(p+2)-1,g.rd16(p+6),g.rd16(p+8),g.rd16(p+10),g.rd16(p+12),g.rd16(p+14));g.wr64(c.a(1),d*10000+116444736000000000);return 1;},
    GetTimeZoneInformation:c=>{for(let i=0;i<172;i++)g.wr8(c.a(0)+i,0);return 0;}, GetDynamicTimeZoneInformation:c=>{for(let i=0;i<432;i++)g.wr8(c.a(0)+i,0);return 0;},
    GetACP:()=>1252, GetOEMCP:()=>437, IsValidCodePage:stub1, GetCPInfo:stub0,
    MultiByteToWideChar:c=>{const src=c.a(2),n=c.a(3)%4294967296,dst=c.a(4),cap=c.a(5)%4294967296;let len=n===0xffffffff?g.cstr(src).length+1:n;if(!cap||!dst)return len;for(let i=0;i<len&&i<cap;i++)g.wr16(dst+2*i,g.rd8(src+i));return len;},
    WideCharToMultiByte:c=>{const src=c.a(2),n=c.a(3)%4294967296,dst=c.a(4),cap=c.a(5)%4294967296;let len=n===0xffffffff?g.wstr(src).length+1:n;if(!cap||!dst)return len;for(let i=0;i<len&&i<cap;i++)g.wr8(dst+i,g.rd16(src+2*i)&255);return len;},
    LCMapStringEx:stub0, GetStringTypeW:stub1, FormatMessageW:stub0, LocalFree:stub0,
    GetThreadTimes:stub0, GetProcessTimes:stub0, QueryPerformanceFrequency:undefined,
  };
  delete H.QueryPerformanceFrequency;
  if(opts.hostRoot){ const v=require('./vfs.js')({...g,wstr:g.wstr,putw:g.putw},{hostRoot:opts.hostRoot,writeRoot:opts.writeRoot,log,vfsLog:opts.vfsLog||(typeof process!=="undefined"&&!!process.env.VFSLOG)}); Object.assign(H,v.H);
    if(typeof process!=='undefined'&&process.env.VFSLOG){ let nlog=0; for(const nm of ['CreateFileW','GetFileAttributesW','GetFileAttributesExW','FindFirstFileW','ReadFile']){ const f=H[nm]; if(!f) continue; H[nm]=(c)=>{ const r=f(c); if(nlog<20000&&(nm==='CreateFileW'||(nm==='ReadFile'&&process.env.VFSLOG==='2')||(nm.startsWith('GetFileAttr')&&r&&r!==0xffffffff))){ nlog++; let p=''; try{ p=nm==='ReadFile'?('h='+c.a(0).toString(16)+' n='+c.a(2)):g.wstr(c.a(0)); }catch(e){} log('[vfs] '+nm+' '+p+' -> '+(typeof r==='number'?r.toString(16):r)); } return r; }; } } }
  const pokes=opts.pokes||[[0x636ac98,1]];
  { const pm=H.PeekMessageW||stub0, maxf=(typeof process!=='undefined'&&+process.env.MAX_FRAMES)||Infinity, t0=Date.now(); let nf=0;
    H.PeekMessageW=c=>{ if(resumeFrame){ resumeFrame=false; return pm(c); }
      if(msgq.length) return pm(c);
      if(++nf===1) for(const [rva,v] of pokes){ g.wr32(BASE+rva,v); log('[poke] 0x'+rva.toString(16)+'='+v); }
      if(nf%1000===0) log('[frame] '+nf+' at '+((Date.now()-t0)/1000).toFixed(0)+'s'); if(nf>=maxf) throw new Error('MAX_FRAMES reached ('+nf+')');
      if(audio&&guestDepth===0) audio.pump();
      if(opts.onFrame&&guestDepth===0){ const p=opts.onFrame(nf); if(p&&p.then){ pendingYield=p; resumeFrame=true; return YIELD; } } return pm(c); }; }
  Object.assign(H,mathH,ctypeH,strH);
  let d3d=null; { const mk=opts.d3d||require('./d3dfake.js'); d3d=mk({g,H,malloc,free:gfree,getProc,log,xf32}); }
  let audio=null; { const mk=opts.audio||require('./audiofake.js'); audio=mk({g,H,malloc,getProc,log,guestCall,stack:n=>stackRvas(n),onPcm:opts.onPcm,played:opts.audioPlayed}); }
  const impName=(k)=>k<imps.length?imps[k][1]:dyn[k-imps.length];
  return {
    d3d:()=>d3d,
    hookNative:(name,rva)=>{ const key='hook:'+name; let n=0; H[key]=c=>{ n++; if(n<=20) log('[hook] '+name+' #'+n+' self vtable 0x'+(c.a(0)?(g.rd64(c.a(0))-BASE).toString(16):'-')+' stack: '+stackRvas(10).join(' '));
      const tr=n<=hookTrace&&m._trr_idx?m._trr_idx():null; const r=guestCall(BASE+rva,[c.a(0),c.a(1),c.a(2)]);
      if(tr!==null){ const t1=m._trr_idx(), cnt=Math.min(t1-tr>>>0,4096), ring=new Uint32Array(m.HEAPU8.buffer,m._trr_ptr(),4096), seen=new Set();
        for(let k=t1-cnt;k!==t1;k=(k+1)>>>0) seen.add(ring[k&4095].toString(16));
        log('[hook] '+name+' #'+n+' entered '+(t1-tr>>>0)+(t1-tr>>>0>4096?' (only the last 4096 kept)':'')+': '+[...seen].join(' ')); }
      return r; }; return getProc(key); },
    addGuestDll:d=>{ guestDlls.set(d.name.toLowerCase(),d); guestByBase.set(BASE+d.off,d); },
    input, setInputSize:(w,h)=>{ inputSize=[w,h]; },
    takeYield:()=>{ const p=pendingYield; pendingYield=null; return p||Promise.resolve(0); },
    setMem(mptr,rptr){M=mptr;Rp=rptr;},
    guest:g,
    hook(k,rp){
      Rp=rp; const name=impName(k); counts[name]=(counts[name]||0)+1; if(++nHost%2000000===0) log('[progress] '+(nHost/1e6)+'M host calls');
      if(nHost%10000000===0){ const d=Object.entries(counts).map(([n,c])=>[n,c-(lastCounts[n]||0)]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,8);
        log('[busy] top host calls of the last 10M: '+d.map(([n,c])=>n+' '+c).join(', ')+'; guest stack: '+stackRvas(12).map(x=>x.toString(16)).join(' ')); lastCounts={...counts}; }
      if(RING_ON&&!/^(TlsGetValue|memcpy|memmove|memset|EnterCriticalSection|LeaveCriticalSection|AcquireSRWLockExclusive|ReleaseSRWLockExclusive|TlsSetValue|wcsncmp)$/.test(name)){ let a0=''; try{ const hb0=rp>>2,hh0=H32(); const v0=hh0[hb0+4]+hh0[hb0+5]*4294967296; if(v0>BASE&&v0<BASE+1.5e9){ a0=JSON.stringify(g.wstr(v0).slice(0,60)); if(!/^"[ -~]*"$/.test(a0)||a0==='""') a0=JSON.stringify(g.cstr(v0).slice(0,60)); } }catch(e){} ring.push(name+(a0&&a0!=='""'?' '+a0:'')); if(ring.length>60) ring.shift(); }
      if(name==='wcsncmp'&&counts[name]===2000000){ const h=H32(),b=(Rp>>2),rsp=h[b+8]+h[b+9]*4294967296,rv=[];for(let i=0;i<64;i++){const v=g.rd64(rsp+8*i);if(v>=BASE&&v<BASE+0x4a00000)rv.push('0x'+(v-BASE).toString(16));}
        log('[LOOP wcsncmp] a="'+g.wstr(h[b+2]+h[b+3]*4294967296).slice(0,80)+'" b="'+g.wstr(h[b+4]+h[b+5]*4294967296).slice(0,80)+'" n='+h[b+16]+' stack: '+rv.slice(0,8).join(' ')); }
      if(name==='wcsncmp'&&counts[name]>20000000){ throw new Error('wcsncmp loop aborted'); }
      const h=H[name];
      const hb=rp>>2, hh=H32();
      const argv=(i)=>{ if(i<4){const r=[1,2,8,9][i]; return hh[hb+2*r]+hh[hb+2*r+1]*4294967296;}
        const rsp=hh[hb+8]+hh[hb+9]*4294967296; return g.rd64(rsp+0x28+8*(i-4)); };
      if(!h){ if(opts.softStub){ if(!seen.has(name)){seen.add(name);log('[stub-unknown] '+(k<imps.length?imps[k][0]:'dyn')+'!'+name);} hh[hb]=0;hh[hb+1]=0; return 1;} return 0; }
      const c=Object.create(g); c.a=argv;
      const rv=h(c);
      if(rv===YIELD) return 2;
      if(rv!==undefined){ const v=Number(rv); hh[hb]=(v%4294967296)>>>0; hh[hb+1]=Math.floor(v/4294967296)>>>0; if(v<0){hh[hb]=(v>>>0);hh[hb+1]=0xffffffff;} }
      return 1;
    },
    dataImports(imps,m_data_import){
      const out=[];
      imps.forEach((e,k)=>{ const n=e[1];
        if(/^\?(cout|cerr|clog|wcout|wcerr)@std@@3/.test(n)){
          const A=g.alloc(0x400,16), vt=A+0x300; g.wr64(A,vt); g.wr32(vt+4,0x80); out.push([k,A]); }
        else if(/^\?id@.*@std@@2V0locale@2@A$/.test(n)){ out.push([k,g.alloc(16,16)]); }
        else if(/^\?_Raise_handler@std@@3/.test(n)){ out.push([k,g.alloc(16,16)]); }
      });
      out.forEach(([k,a])=>{ m_data_import(k); g.wr64(BASE+e_iat(imps,k),a); });
      return out.length; },
    native:()=>[...(m._gh_malloc_js?['malloc','free','calloc','realloc','_msize','_aligned_malloc','_aligned_free','_aligned_realloc','HeapAlloc','HeapFree','HeapReAlloc','HeapSize','VirtualAlloc','VirtualFree']:[]),'memcpy','memmove','memset','memcmp','strlen','wcslen','wcsncmp','TlsAlloc','TlsGetValue','TlsSetValue','TlsFree','EnterCriticalSection','LeaveCriticalSection','TryEnterCriticalSection',
      'AcquireSRWLockExclusive','ReleaseSRWLockExclusive','AcquireSRWLockShared','ReleaseSRWLockShared'],
    audio:()=>audio,
    recent:()=>ring.slice(),
    lastInit:()=>lastInit, counts, seen, handled:()=>Object.keys(H),
  };
};
