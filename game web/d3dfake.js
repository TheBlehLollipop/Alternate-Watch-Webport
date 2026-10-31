module.exports=function(ctx){
  const {g,H,malloc,getProc,log}=ctx;
  const S_OK=0, E_NOINTERFACE=0x80004002, NOT_FOUND=0x887A0002;
  const objs=new Map(), byId=new Map(); let nObj=0;
  const NAMES={}, VT={};
  const guid=(p)=>{ const b=g.bytes(p,16); const h=(a,b2)=>[...b.subarray(a,b2)].map(x=>x.toString(16).padStart(2,'0')); return (h(0,4).reverse().join('')+'-'+h(4,6).reverse().join('')+'-'+h(6,8).reverse().join('')+'-'+h(8,10).join('')+'-'+h(10,16).join('')); };
  const IID={ '54ec77fa-1377-44e6-8c32-88fd5f44c84c':'dxgidev','77db970f-6276-48ba-ba28-070143b4392c':'dxgidev',
    '7b7166ec-21c7-44ae-b21a-c9ae321ae369':'fac','770aae78-f26f-4dba-a829-253c83d1b387':'fac','50c83a1c-e072-4c48-87b0-3630fa36a6d0':'fac',
    '2411e7e1-12ac-4ccf-bd14-9798e8534dc0':'adp','29038f61-3839-4626-91fd-086879011a05':'adp',
    'db6f6ddb-ac77-4e88-8253-819df9bbf140':'dev','310d36a0-d2e2-4a7b-b600-4e2bf6a85b24':null,
    '1bc6ea02-ef36-464f-bf0c-21ca39e5168a':'fac','7632e1f5-ee65-4dca-87fd-84cd75f8838d':'fac','c1b6694f-ff09-44a9-b03c-77900a0a1d17':'fac','645967a4-1392-4310-a798-8053ce3e93fd':'adp',
    '790a45f7-0d42-4876-983a-0a55cfe6f4aa':'sc','a8be2ac4-199f-4946-b331-79599fb98de7':'sc','94d99bdb-f1f8-4ab0-b236-7da0170edab1':'sc','3d585d5a-bd4a-489e-b1f4-3dbcb6452ffb':'sc','310d36a0-d2e2-4a7b-b600-4e2bf6a85b24x':null,
    '3d3e0379-f9de-4d58-bb6c-18d62992f1a6':'tex','dc8e63f3-d12b-4952-b47b-5e45026a862b':'tex' };
  const make=(kind,state)=>{ ensureVT(kind); const p=malloc(32); g.wr64(p,VT[kind]); const o={kind,p,id:++nObj,refs:1,...state}; objs.set(p,o); byId.set(o.id,o); return p; };
  const dying=new Set(), onFree=[];
  const freeable=o=>o.kind==='child'&&!(o.info&&o.info.backbuffer);
  const ref=p=>{ const o=p?objs.get(p):null; if(o) o.refs++; };
  const unref=p=>{ const o=p?objs.get(p):null; if(!o) return 0; o.refs--; if(o.refs<=0&&freeable(o)) dying.add(o); return Math.max(0,o.refs); };
  const reap=isBound=>{ let n=0;
    for(let pass=0;pass<4&&dying.size;pass++) for(const o of [...dying]){ if(o.refs>0){ dying.delete(o); continue; } if(isBound(o.p)) continue;
      dying.delete(o); objs.delete(o.p); byId.delete(o.id); n++; for(const f of onFree) f(o); if(o.res) unref(o.res); }
    return n; };
  const out=(pp,p)=>{ if(pp) g.wr64(pp,p); };
  const ensureVT=(kind)=>{ if(VT[kind]) return; const n=({fac:30,adp:18,out:24,dxgidev:16,dev:48,ctx:170,sc:48,child:40,d12:96}[kind]||40); const vt=malloc(8*n);
    for(let i=0;i<n;i++){ const nm='com:'+kind+':'+i; if(!H[nm]) H[nm]=(c)=>dispatchM(kind,i,c); g.wr64(vt+8*i,getProc(nm)); } VT[kind]=vt; };
  const dispatchM=(kind,i,c)=>{ if(kind==='d12') return d12disp(i,c); const o=objs.get(c.a(0)); const m=(METHODS[kind]||{})[i]; if(i===0) return qi(o,c); if(i===1){ if(o) o.refs++; return o?o.refs:1; } if(i===2) return o?unref(o.p):0; return m?m(c,o):S_OK; };
  const qi=(o,c)=>{ const id=guid(c.a(1)); let k=IID[id]; const pp=c.a(2);
    if(k===undefined){ log('[d3d] QueryInterface unknown IID '+id+' on '+(o&&o.kind)); if(pp)g.wr64(pp,0); return E_NOINTERFACE; }
    if(k===null){ if(pp)g.wr64(pp,0); return E_NOINTERFACE; }
    if(k==='tex'||k==='child') k=o.kind;
    if(k===o.kind||(o.kind==='dev'&&k==='dev')) { out(pp,o.p); o.refs++; return S_OK; }
    if(k==='dxgidev'||k==='fac'||k==='adp'||k==='dev'){ const key='_q_'+k; if(!o[key]) o[key]=make(k,{dev:o.dev||o,parent:o}); out(pp,o[key]); return S_OK; }
    out(pp,o.p); o.refs++; return S_OK; };
  const wstrTo=(p,s)=>{ for(let i=0;i<s.length;i++)g.wr16(p+2*i,s.charCodeAt(i)); g.wr16(p+2*s.length,0); };
  const zero=(p,n)=>{ g.bytes(p,n).fill(0); };
  let theFactory=0, theAdapter=0, theDevice=0, theCtx=0;
  const adapter=()=>theAdapter||(theAdapter=make('adp',{}));
  const device=()=>{ if(!theDevice){ theDevice=make('dev',{}); theCtx=make('ctx',{dev:objs.get(theDevice)}); } return theDevice; };
  const descAdapter=(p,ex)=>{ zero(p,ex?312:304); wstrTo(p,'Intel(R) Iris(R) Xe Graphics'); g.wr32(p+256,0x8086); g.wr32(p+260,0x9A49); g.wr32(p+264,0); g.wr32(p+268,1);
    g.wr64(p+272,0x80000000); g.wr64(p+280,0); g.wr64(p+288,0x100000000); g.wr32(p+296,1); if(ex)g.wr32(p+304,0); };
  const sizeOfDesc={buf:24,t1:32,t2:44,t3:36,srv:28,uav:20,rtv:20,dsv:24};
  const mkRes=(kind,descKey,pdesc,extra)=>{ const n=sizeOfDesc[descKey]||0; const o={desc:n&&pdesc?Uint8Array.from(g.bytes(pdesc,n)):null,descKey,...extra}; return make('child',o); };
  const createM={3:'buf',4:'t1',5:'t2',6:'t3',7:'srv',8:'uav',9:'rtv',10:'dsv'};
  const createOut={3:3,4:3,5:3,6:3,7:3,8:3,9:3,10:3,11:5,12:4,13:4,14:9,15:4,16:4,17:4,18:4,19:1,20:2,21:2,22:2,23:2,24:2,25:2,26:2,27:2};
  const METHODS={
    fac:{ 7:(c)=>{ if(c.a(1)!==0){out(c.a(2),0);return NOT_FOUND;} out(c.a(2),adapter()); return S_OK; },
          10:(c)=>{ out(c.a(3),make('sc',{dev:objs.get(c.a(1)),desc:Uint8Array.from(g.bytes(c.a(2),72))})); return S_OK; },
          12:(c)=>{ if(c.a(1)!==0){out(c.a(2),0);return NOT_FOUND;} out(c.a(2),adapter()); return S_OK; },
          13:()=>1, 6:(c)=>{ out(c.a(2),0); return E_NOINTERFACE; },
          15:(c)=>{ const d=new Uint8Array(72); const src=g.bytes(c.a(3),12); d.set(src.subarray(0,12)); const o=objs.get(c.a(1)); out(c.a(6),make('sc',{dev:o,d12:o&&o.kind==='d12',desc:d})); return S_OK; },
          24:(c)=>{ const d=new Uint8Array(72); d.set(g.bytes(c.a(2),12)); const o=objs.get(c.a(1)); out(c.a(4),make('sc',{dev:o,d12:o&&o.kind==='d12',desc:d})); return S_OK; },
          25:()=>0, 26:(c)=>{ out(c.a(3),adapter()); return S_OK; }, 27:(c)=>{ out(c.a(2),0); return NOT_FOUND; },
          28:()=>NOT_FOUND, 29:(c)=>{ if(c.a(1)!==0){out(c.a(4),0);return NOT_FOUND;} out(c.a(4),adapter()); return S_OK; } },
    adp:{ 7:(c)=>{ out(c.a(2),0); return NOT_FOUND; }, 8:(c)=>{ descAdapter(c.a(1),false); return S_OK; }, 9:(c)=>{ if(c.a(2))g.wr64(c.a(2),0x000A000000000001n); return S_OK; },
          10:(c)=>{ descAdapter(c.a(1),true); return S_OK; }, 14:(c)=>{ const p=c.a(3); if(p){ zero(p,32); g.wr64(p,0x80000000); g.wr64(p+16,0x40000000); } return S_OK; }, 6:(c)=>{ if(!theFactory)theFactory=make('fac',{}); out(c.a(2),theFactory); return S_OK; } },
    dxgidev:{ 7:(c)=>{ out(c.a(1),adapter()); return S_OK; }, 11:()=>0, 12:()=>0, 13:(c)=>{ if(c.a(1))g.wr32(c.a(1),3); return S_OK; }, 6:(c)=>{ out(c.a(2),adapter()); return S_OK; } },
    dev:{ 29:(c)=>{ if(c.a(2))g.wr32(c.a(2),0xFFFFFFFF); return S_OK; }, 30:(c)=>{ if(c.a(3))g.wr32(c.a(3),1); return S_OK; },
          33:(c)=>{ if(c.a(2)&&c.a(3))zero(c.a(2),c.a(3)); return S_OK; }, 37:()=>0xb100, 38:()=>0, 39:()=>0,
          40:(c)=>{ device(); out(c.a(1),theCtx); return 0; }, 42:()=>0, 6:(c)=>{ out(c.a(2),0); return E_NOINTERFACE; } },
    ctx:{ 14:(c)=>{ const r=objs.get(c.a(1)); if(!r) return 0x80070057; if(!r.store){ let n=1<<20; const d=r.desc; if(d){ const dv=new DataView(d.buffer,d.byteOffset,d.byteLength); if(r.descKey==='buf') n=dv.getUint32(0,true); else if(r.descKey==='t2') n=Math.min(1<<27,Math.ceil(dv.getUint32(0,true)*dv.getUint32(4,true)*Math.max(1,dv.getUint32(12,true))*8*1.4)); else if(r.descKey==='t1') n=dv.getUint32(0,true)*16*dv.getUint32(8,true); else if(r.descKey==='t3') n=Math.min(1<<27,dv.getUint32(0,true)*dv.getUint32(4,true)*dv.getUint32(8,true)*16);} r.store=malloc(Math.max(n,64)+64); r.pitch=(r.desc&&(r.descKey==='t2'||r.descKey==='t3'))?new DataView(r.desc.buffer,r.desc.byteOffset).getUint32(0,true)*8:0; }
            const m=c.a(5); if(m){ g.wr64(m,r.store); g.wr32(m+8,r.pitch||0); g.wr32(m+12,0); } return S_OK; },
          29:(c)=>{ const p=c.a(2),n=c.a(3)%4294967296; if(p&&n){ zero(p,n); if(n===4) g.wr32(p,1); else if(n===8) g.wr64(p,BigInt(Math.round(performance.now()*1e6))); else if(n===16) g.wr64(p,1000000000); } return S_OK; },
          12:()=>0 },
    sc:{ 8:()=>0, 9:(c)=>{ const o=objs.get(c.a(0)); if(o.d12){ if(!o.back12) o.back12=[0,1,2].map(()=>mkD12('res',{dev:o.dev,width:1<<20,desc:new Uint8Array(56)})); out(c.a(3),o.back12[c.a(1)%3]); return S_OK; } if(!o.back){ const d=o.desc?new DataView(o.desc.buffer,o.desc.byteOffset):null; const t=new Uint8Array(44); const dv=new DataView(t.buffer); dv.setUint32(0,d?d.getUint32(0,true)||1280:1280,true); dv.setUint32(4,d?d.getUint32(4,true)||720:720,true); dv.setUint32(8,1,true); dv.setUint32(12,1,true); dv.setUint32(16,d?d.getUint32(8,true)||28:28,true); dv.setUint32(20,1,true); dv.setUint32(32,0x20,true); o.back=make('child',{desc:t,descKey:'t2'}); } out(c.a(3),o.back); return S_OK; },
         12:(c)=>{ const o=objs.get(c.a(0)); zero(c.a(1),72); if(o.desc) g.bytes(c.a(1),72).set(o.desc); return S_OK; }, 10:()=>0, 11:(c)=>{ if(c.a(1))g.wr32(c.a(1),0); out(c.a(2),0); return S_OK; }, 7:(c)=>{ const o=objs.get(c.a(0)); out(c.a(2),o.dev?o.dev.p:0); return S_OK; } },
    child:{ 3:(c)=>{ const o=objs.get(c.a(0)); out(c.a(1),o&&o.dev?o.dev.p:device()); return 0; },
            8:(c)=>{ const o=objs.get(c.a(0)); const n=o&&o.desc&&({srv:1,uav:1,rtv:1,dsv:1}[o.descKey])?o.desc.length:0; if(n&&c.a(1)) g.bytes(c.a(1),n).set(o.desc); return 0; },
            10:(c)=>{ const o=objs.get(c.a(0)); if(o&&o.desc&&c.a(1)&&!({srv:1,uav:1,rtv:1,dsv:1}[o.descKey])) g.bytes(c.a(1),o.desc.length).set(o.desc); return 0; },
            7:(c)=>{ const o=objs.get(c.a(0)); if(o&&o.descKey&&({srv:1,uav:1,rtv:1,dsv:1}[o.descKey])){ out(c.a(1),o.res||0); ref(o.res); } return 0; } },
  };
  for(const [i,po] of Object.entries(createOut)){ METHODS.dev[i]=(c)=>{ const dk=createM[i]; const d=c.a(0); const o=objs.get(d); const view=i>=7&&i<=10;
    const pdesc=dk?c.a(view?2:1):0, res=view?c.a(1):0;
    let extra={dev:o};
    if(i>=12&&i<=18&&c.a(1)){ extra.stage='vs gs gs ps hs ds cs'.split(' ')[i-12]; extra.code=Uint8Array.from(g.bytes(c.a(1),c.a(2)%4294967296)); dumpShader(extra); }
    const pp=c.a(po); if(pp){ out(pp,dk?mkRes('child',dk,pdesc,{dev:o,res}) : make('child',extra)); if(view) ref(res); } return S_OK; }; }
  let nShader=0; const dumpShader=(x)=>{ nShader++; if(typeof process==='undefined'||!process.env.SHADER_DUMP) return; const fs=require('fs'), dir=process.env.SHADER_DUMP;
    fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(dir+'/'+String(nShader).padStart(5,'0')+'_'+x.stage+'.dxbc',x.code); };
  const _mk=mkRes;
  H.CreateDXGIFactory=(c)=>{ const pp=c.a(1); if(!theFactory)theFactory=make('fac',{}); out(pp,theFactory); return S_OK; };
  H.CreateDXGIFactory1=H.CreateDXGIFactory; H.CreateDXGIFactory2=(c)=>{ if(!theFactory)theFactory=make('fac',{}); out(c.a(2),theFactory); return S_OK; };
  H.D3D11CreateDevice=(c)=>{ device(); out(c.a(7),theDevice); if(c.a(8))g.wr32(c.a(8),0xb100); out(c.a(9),theCtx); return S_OK; };
  H.D3D11CreateDeviceAndSwapChain=(c)=>{ device(); const fac=theFactory||(theFactory=make('fac',{})); void fac; out(c.a(9),theDevice); if(c.a(10))g.wr32(c.a(10),0xb100); out(c.a(11),theCtx);
    if(c.a(7)) out(c.a(7),make('sc',{dev:objs.get(theDevice),desc:Uint8Array.from(g.bytes(c.a(6),72))})); return S_OK; };

  const rec=require('./d3d11rec.js')({g,log,objs,byId,METHODS,malloc,out,xf32:ctx.xf32,ref,reap,onFree,free:ctx.free});

  const mkD12=(t,state)=>make('d12',{t,...state});
  let gva=0x100000000n, hbase=0x200000000n;
  const D12LOG=new Set();
  const D12NEW={8:['queue',3],9:['alloc',3],10:['pso',3],11:['pso',3],12:['list',6],14:['dheap',3],16:['rootsig',5],27:['res',7],28:['heap',3],29:['res',7],30:['res',5],36:['fence',4],39:['qheap',3],41:['cmdsig',4],44:['plib',4],47:['pso',3],51:['list',5],53:['res',8],54:['heap',3],55:['res',5]};
  const featureSupport=(f,p,n)=>{ if(!p||!n) return; zero(p,n); const w=(o,v)=>{ if(o+4<=n) g.wr32(p+o,v); };
    if(f===0){ w(12,3); w(16,3); w(28,1); w(36,40); w(56,2); w(0,1); }
    else if(f===3){ w(4,0xFFFFFFFF); w(8,0xFFFFFFFF); }
    else if(f===2){ g.wr32(p+16,0xc100); }
    else if(f===7){ w(0,0x65); }
    else if(f===8){ w(0,1); w(4,32); w(8,32); w(12,32); }
    };
  const D12={
    dev:{ 7:()=>1, 8:null, 13:(c)=>{ if(c.a(1)!==3&&!D12LOG.has('f'+c.a(1))){ D12LOG.add('f'+c.a(1)); log('[d12] CheckFeatureSupport f='+c.a(1)+' size='+c.a(3)); } featureSupport(c.a(1),c.a(2),c.a(3)); return S_OK; }, 15:(c)=>[32,32,32,32][c.a(1)]||32, 37:()=>0,
          43:()=>0x1234, 56:()=>0,
          23:()=>0, 24:()=>0, 17:()=>0, 18:()=>0, 19:()=>0, 20:()=>0, 21:()=>0, 22:()=>0 },
    queue:{ 10:()=>0, 14:(c,o)=>{ const f=objs.get(c.a(1)); if(f) f.val=BigInt(c.a(2)); return S_OK; }, 16:(c)=>{ if(c.a(1))g.wr64(c.a(1),1000000000); return S_OK; },
            17:(c)=>{ if(c.a(1))g.wr64(c.a(1),1); if(c.a(2))g.wr64(c.a(2),1); return S_OK; } },
    dheap:{ 9:(c,o)=>{ if(!o.base){ const n=o.desc?new DataView(o.desc.buffer,o.desc.byteOffset).getUint32(4,true):1024; o.base=malloc(Math.max(n,1)*64+256); zero(o.base,Math.max(n,1)*64); } return o.base; }, 10:(c,o)=>{ if(!(o.desc&&(o.desc[8]&1))) return 0; if(!o.gbase){ o.gbase=malloc(4096); zero(o.gbase,4096); } return o.gbase; } },
    fence:{ 8:(c,o)=>o.val||0n, 10:(c,o)=>{ o.val=BigInt(c.a(1)); return S_OK; } },
    res:{ 8:(c,o)=>{ if(!o.store) o.store=malloc(Math.min(Math.max(o.width||64,64),1<<28)+256); if(c.a(3)) g.wr64(c.a(3),o.store); return S_OK; }, 11:(c,o)=>{ if(!o.gva){ o.gva=BigInt(malloc(4096)); } return Number(o.gva); } }
  };
  const D12H={ dev:{ 25:(c,o)=>{ zero(c.a(1),16); g.wr64(c.a(1),65536); g.wr64(c.a(1)+8,65536); return c.a(1); }, 26:(c,o)=>{ zero(c.a(1),20); return c.a(1); } },
    queue:{ 18:(c,o)=>{ zero(c.a(1),16); return c.a(1); } },
    res:{ 10:(c,o)=>{ g.bytes(c.a(1),56).set(o.desc||new Uint8Array(56)); return c.a(1); } },
    dheap:{ 8:(c,o)=>{ g.bytes(c.a(1),16).set(o.desc||new Uint8Array(16)); return c.a(1); } },
    heap:{ 8:(c,o)=>{ zero(c.a(1),32); return c.a(1); } } };
  const d12disp=(i,c)=>{ try{ return d12disp0(i,c); }catch(e){ log('[d12] EXCEPTION in slot '+i+': '+(e&&e.stack||e)); throw e; } };
  const d12disp0=(i,c)=>{ let o=objs.get(c.a(0)); let hid=false; if(typeof process!=='undefined'&&process.env&&process.env.D12TRACE) log('[d12t] '+((objs.get(c.a(0))||objs.get(c.a(1))||{}).t)+':'+i);
    if(!o) { log('[d12] call on unknown object slot '+i); return S_OK; }
    if(i===0){ const id=guid(c.a(1)); if(!D12LOG.has(id)){ D12LOG.add(id); log('[d12] QI '+id+' on '+o.t); } out(c.a(2),o.p); return S_OK; }
    if(i===1||i===2) return 1;
    if(i>=3&&i<=5){
      o.pd=o.pd||new Map(); const id=guid(c.a(1));
      if(i===4){ const n=c.a(2); if(!n) o.pd.delete(id); else o.pd.set(id,Uint8Array.from(g.bytes(c.a(3),n))); return S_OK; }
      if(i===5){ const b=new Uint8Array(8); if(c.a(2)){ new DataView(b.buffer).setBigUint64(0,BigInt(c.a(2)),true); o.pd.set(id,b); } else o.pd.delete(id); return S_OK; }
      const v=o.pd.get(id); const ps=c.a(2); const have=ps?g.rd32(ps):0;
      if(!v){ if(ps) g.wr32(ps,0); return NOT_FOUND; }
      if(ps) g.wr32(ps,v.length);
      if(!c.a(3)) return S_OK;
      if(have<v.length) return 0x887A0003;
      g.bytes(c.a(3),v.length).set(v); return S_OK; }
    const t=o.t; const hm=(D12H[t]||{})[i];
    if(hm) return hm(c,o);
    const key=t+':'+i; 
    if(t==='dev' && D12NEW[i]){ const [kt,pi]=D12NEW[i]; const st={dev:o}; if(kt==='res'){ const dp=(i===53)?c.a(3):c.a(3); if(dp){ st.desc=Uint8Array.from(g.bytes(dp,56)); st.width=Number(new DataView(st.desc.buffer).getBigUint64(16,true)); } }
      if(kt==='dheap'||kt==='heap'){ const dp=c.a(1); if(dp) st.desc=Uint8Array.from(g.bytes(dp,16)); }
      if(kt==='fence'){ st.val=BigInt(c.a(1)); }
      out(c.a(pi),mkD12(kt,st)); return S_OK; }
    const m=(D12[t]||{})[i]; if(m) return m(c,o);
    if(i===7 && t!=='dev'){ out(c.a(2),o.dev?o.dev.p:0); return S_OK; }
    if(!D12LOG.has(key)){ D12LOG.add(key); log('[d12] '+key+' (default S_OK)'); }
    return S_OK; };
  H.D3D12CreateDevice=(c)=>{ if(!theD12){ theD12=mkD12('dev',{}); objs.get(theD12).dev=objs.get(theD12); } if(c.a(3)) g.wr64(c.a(3),theD12); log('[d12] D3D12CreateDevice -> fake'); return S_OK; };
  let theD12=0;
  H['#101']=H.D3D12CreateDevice;
  const UNSUPPORTED=0x887A0004;
  H.D3D12GetDebugInterface=(c)=>{ if(c.a(1))g.wr64(c.a(1),0); return E_NOINTERFACE; };
  H.D3D12SerializeRootSignature=()=>UNSUPPORTED; H.D3D12SerializeVersionedRootSignature=()=>UNSUPPORTED; H.D3D12EnableExperimentalFeatures=()=>UNSUPPORTED;
  return {objs,byId,rec,dying};
};
