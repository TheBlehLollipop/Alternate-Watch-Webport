module.exports=function(ctx){
  const {g,H,malloc,getProc,log,guestCall}=ctx;
  const S_OK=0, E_NOINTERFACE=0x80004002;
  const objs=new Map(), VT={};
  const LEAD_MIN=0.15, LEAD_MAX=0.6; let frameGap=0.1, lastPump=0, cut=0; const ls={n:0,under:0,lost:0};
  const seen=new Set(); const note=(m)=>{ if(!seen.has(m)){ seen.add(m); log('[audio] '+m); } };
  const make=(kind,state)=>{ ensureVT(kind); const p=malloc(64); g.wr64(p,VT[kind]); objs.set(p,{kind,p,...state}); return p; };
  const out=(pp,p)=>{ if(pp) g.wr64(pp,p); };
  const ensureVT=(kind)=>{ if(VT[kind]) return; const n=32, vt=malloc(8*n);
    for(let i=0;i<n;i++){ const nm='com:xa-'+kind+':'+i; if(!H[nm]) H[nm]=(c)=>call(kind,i,c); g.wr64(vt+8*i,getProc(nm)); } VT[kind]=vt; };
  let rate=48000, chans=2, nsub=0;
  const voices=[];
  const call=(kind,i,c)=>{ const o=objs.get(c.a(0)); const m=(M[kind]||{})[i]; note(kind+' method '+i+(m?'':' (default S_OK)')+(ctx.stack?' stack: '+ctx.stack(8).join(' '):'')); return m?m(c,o):S_OK; };
  const unk={ 0:(c,o)=>{ out(c.a(2),0); return E_NOINTERFACE; }, 1:()=>1, 2:()=>1 };
  const voiceBase=(details)=>({ 0:(c,o)=>{ const p=c.a(1); if(p){ g.wr32(p,0); g.wr32(p+4,0); g.wr32(p+8,o.ch||chans); g.wr32(p+12,o.rate||rate); } return 0; },
    13:(c)=>{ if(c.a(1)) g.wr32(c.a(1),0x3f800000); return 0; },
    18:(c,o)=>{ const k=voices.indexOf(o); if(k>=0) voices.splice(k,1); return 0; } });
  const M={
    xa2:{ ...unk,
      5:(c)=>{ const fmt=c.a(2), cb=c.a(5); const tag=g.rd16(fmt), ch=g.rd16(fmt+2), sr=g.rd32(fmt+4), bits=g.rd16(fmt+14);
        const p=make('src',{ch,rate:sr,bits,tag,cb,queue:[],submitted:0,ended:0,started:false});
        if(cb&&tag===3&&bits===32) mixerCb=cb;
        log('[audio] CreateSourceVoice: format '+tag+' '+ch+' ch '+sr+' Hz '+bits+' bit, callback 0x'+cb.toString(16)); if(cb) voices.push(objs.get(p)); out(c.a(1),p); return 0; },
      6:(c)=>{ out(c.a(1),make('sub',{ch:c.a(2),rate:c.a(3)})); return 0; },
      7:(c)=>{ chans=c.a(2)||2; rate=c.a(3)||48000; if(chans>2) chans=2; log('[audio] CreateMasteringVoice: '+chans+' ch '+rate+' Hz (asked '+c.a(2)+' ch '+c.a(3)+' Hz)');
        out(c.a(1),make('mst',{ch:chans,rate})); return 0; },
      11:(c)=>{ if(c.a(1)) g.bytes(c.a(1),0x48).fill(0); return 0; } },
    mst:{ ...voiceBase(), 19:(c)=>{ if(c.a(1)) g.wr32(c.a(1),chans===1?4:3); return 0; } },
    sub:{ ...voiceBase() },
    src:{ ...voiceBase(),
      19:(c,o)=>{ o.started=true; return 0; }, 20:(c,o)=>{ o.started=false; return 0; },
      21:(c,o)=>{ const b=c.a(1), bytes=g.rd32(b+4), data=g.rd64(b+8), pctx=g.rd64(b+36);
        let frames=0;
        if(o.tag===3&&o.bits===32&&bytes){ const pcm=new Float32Array(g.bytes(data,bytes).slice().buffer); frames=pcm.length/o.ch; if(ctx.onPcm) ctx.onPcm(pcm,o.ch,o.rate); }
        else if(bytes) note('unsupported source format '+o.tag+'/'+o.bits);
        if(STARVE&&o.cb&&o.cb===mixerCb){ const ob=o.cb-0x228+0xa8, cb=g.rd64(ob); starveScan(cb?g.rd64(cb+0x410):0);
          if(frames>=4){ const pcm=new Float32Array(g.bytes(data,bytes).slice().buffer); let ms=0; for(let k=2;k<pcm.length;k+=2) ms+=Math.abs(pcm[k]-pcm[k-2]); ms/=pcm.length/2-1;
            if(o.lastL!==undefined){ const j=Math.abs(pcm[0]-o.lastL); if(j>0.03&&j>8*ms&&++subJumps<=40) log('[subjump] submit '+nsub+' step '+j.toFixed(3)+' mean '+ms.toFixed(4)+' in '+(inTick?'mixerTick':inEnd?'OnBufferEnd':'other')+' ring r/w/cap '+g.rd32(ob+0x1c)+'/'+g.rd32(ob+0x20)+'/'+g.rd32(ob+0x18)+' pump round '+round0+' queue '+o.queue.length); }
            o.lastL=pcm[pcm.length-2]; } }
        if(!t0&&frames) t0=Date.now(); o.submitted+=frames; o.queue.push({end:o.submitted,ctx:pctx}); if(++nsub%500===1) log('[audio] buffers submitted: '+nsub+' ('+frames+' frames each)'); return 0; },
      22:(c,o)=>{ o.queue.length=0; return 0; },
      25:(c,o)=>{ const p=c.a(1); if(p){ g.wr64(p,o.queue.length?o.queue[0].ctx:0); g.wr32(p+8,o.queue.length); g.wr64(p+12,o.ended);   } return 0; },
      27:(c)=>{ if(c.a(1)) g.wr32(c.a(1),0x3f800000); return 0; } },
  };
  const BASE=0x140000000, GET_FIRST=BASE+0x301d1e0, MIX_NEXT=BASE+0x301ceb0; let mixerCb=0;
  const mixerTick=v=>{ const mixer=v.cb-0x228, ob=mixer+0xa8;
    if(!v.primed){ v.primed=true; const tmp=malloc(32); guestCall(GET_FIRST,[ob,tmp,tmp+16]); const buf=g.rd64(tmp);
      log('[audio] render start: first buffer 0x'+buf.toString(16)); guestCall(g.rd64(g.rd64(mixer)+200),[mixer,buf]); }
    const sm=()=>{ const cb=g.rd64(ob); return cb?g.rd64(cb+0x410):0; };
    for(let n=0;n<16;n++){ const s=sm(); if(s) g.wr32(s+0x21c,1); guestCall(MIX_NEXT,[ob]); if(!(guestCall.lo32&0xff)) break; if(STARVE) starveScan(s); }
    scan(g.rd64(ob)); };
  const SCAN=typeof process!=='undefined'&&process.env.AUDIO_SCAN; let nscan=0;
  const STARVE=typeof process!=='undefined'&&process.env.AUDIO_STARVE; const stv=[]; let nmix=0, nstarve=0, jumpsTot=0, subJumps=0, inTick=false, inEnd=false, round0=0;
  const recWords=rec=>new Uint32Array(g.bytes(rec,0xb00).slice().buffer);
  const starveScan=sm=>{ nmix++; if(!sm) return; const n=g.rd32(sm+0x204), arr=g.rd64(sm+0x110);
    for(let i=0;i<Math.min(n,64);i++){ const rec=arr+i*0xb00, p=g.rd64(rec+0x30), cnt=g.rd32(rec+0x38); let pk=0;
      const st=stv[i]||(stv[i]={prev:0,zeroAt:0,good:null,zero:null});
      if(p&&cnt>=1024){ const sig=g.rd32(p)+','+g.rd32(p+4*7)+','+g.rd32(p+4*511)+','+g.rd32(p+4*1023)+','+cnt; if(sig===st.sig) continue; st.sig=sig; }
      if(p&&cnt>0&&cnt<=8192){ const f=new Float32Array(g.bytes(p,4*cnt).slice().buffer); for(let k=0;k<f.length;k++){ const a=Math.abs(f[k]); if(a>pk&&a<1e6) pk=a; } }
      if(st.prev>0.001&&pk===0){ st.zeroAt=nmix; st.zero=recWords(rec); }
      else if(st.zeroAt&&pk>0.001){ if(nmix-st.zeroAt<=3&&st.good&&++nstarve<=40){ const d=[]; for(let w=0;w<704&&d.length<24;w++){ const a=st.good[w], b=st.zero[w]; if(a!==b&&a<0x10000&&b<0x10000) d.push((w*4).toString(16)+':'+a+'>'+b); }
          log('[starve] mix '+nmix+' src '+i+' silent '+(nmix-st.zeroAt)+' block(s); fields good>silent: '+d.join(' ')); } st.zeroAt=0; }
      if(p&&cnt>=4&&cnt<=8192){ const f=new Float32Array(g.bytes(p,4*cnt).slice().buffer); let ms=0; for(let k=2;k<f.length;k+=2) ms+=Math.abs(f[k]-f[k-2]); ms/=Math.max(1,f.length/2-1);
        if(st.last!==undefined&&pk>0.01){ const j=Math.abs(f[0]-st.last); if(j>0.05&&j>8*ms){ st.jumps=(st.jumps||0)+1; jumpsTot++; if(jumpsTot<=30) log('[jump] mix '+nmix+' src '+i+' step '+j.toFixed(3)+' (block mean '+ms.toFixed(4)+')'); } }
        st.last=f[f.length-2]; }
      if(pk>0.001) st.good=recWords(rec); st.prev=pk; } if(nmix%2000===0) log('[jump] after '+nmix+' mixes: '+jumpsTot+' source-level jumps'); };
  const peaks=(rec,size)=>{ const r=[]; for(let o=0;o+16<=size;o+=8){ const p=g.rd64(rec+o), n=g.rd32(rec+o+8), mx=g.rd32(rec+o+12);
      if(p<BASE+0x6000000||p>=BASE+0x60000000||p%4||n<16||n>65536||mx<n) continue;
      let pk=0; const f=new Float32Array(g.bytes(p,4*n).slice().buffer); for(const v of f){ const a=Math.abs(v); if(a>pk&&a<1e6) pk=a; }
      r.push(o.toString(16)+':'+n+':'+(pk?pk.toPrecision(3):'0')); } return r; };
  const scan=(cb)=>{ const sm=cb?g.rd64(cb+0x410):0; if(!SCAN||!sm||++nscan%100!==1) return; const n=g.rd32(sm+0x204), arr=g.rd64(sm+0x110), full=nscan%500===1;
    log('[scan] mix '+nscan+' cmdq idx '+g.rd32(sm+0xa8)+' n0 '+g.rd32(sm+0x90)+' n1 '+g.rd32(sm+0xa0)+' pending '+(g.rd32(sm+0x214)|0));
    for(let i=0;i<Math.min(n,64);i++){ const rec=arr+i*0xb00, pk=peaks(rec,0xb00); if(full||pk.some(s=>!s.endsWith(':0'))) log('[scan] src '+i+' flags '+g.rd8(rec+0xae0).toString(16)+'/'+g.rd8(rec+0xae1).toString(16)+' obj 0x'+g.rd64(rec+0x10).toString(16)+' '+pk.join(' ')); }
    const sp=g.rd64(cb+0xe8), sub=sp?g.rd64(sp):0; if(sub) log('[scan] master submix 0x'+sub.toString(16)+' '+peaks(sub,0x1000).join(' ')); };
  let t0=0, pumping=false;
  const played=()=>ctx.played?ctx.played():t0?(Date.now()-t0)/1000*rate:0;
  const BURST=typeof process!=='undefined'&&+process.env.AUDIO_BURST||1; let npump=0;
  const pump=()=>{ if(pumping||(++npump%BURST)) return; pumping=true;
    try{ const t=Date.now(), dt=lastPump?Math.min(1,(t-lastPump)/1000):0; if(lastPump) frameGap=Math.max(dt,frameGap*0.97); lastPump=t;
      const pl=played(), lead=Math.min(LEAD_MAX,Math.max(LEAD_MIN,2.5*frameGap));
      cut=Math.max(pl+LEAD_MIN*rate,Math.min(pl+lead*rate,cut+1.5*dt*rate)); const now=cut;
      for(const v of voices) if(v.cb===mixerCb&&v.started){ const short=pl-v.submitted; if(short>0){ ls.under++; ls.lost+=short; } }
      if(++ls.n%50===0){ log('[audio] last 50 frames: '+ls.under+' underruns, '+(ls.lost/rate*1000).toFixed(0)+' ms of silence; lead now '+(lead*1000).toFixed(0)+' ms'); ls.under=0; ls.lost=0; }
      for(const v of voices){ if(!v.started||!v.cb) continue; const vt=g.rd64(v.cb), onEnd=g.rd64(vt+32);
        for(let round=0;round<64;round++){
          round0=round; if(v.cb===mixerCb){ inTick=true; try{ mixerTick(v); } finally{ inTick=false; } }
          const ob=v.cb===mixerCb?v.cb-0x228+0xa8:0, ringHas=()=>{ const cap=g.rd32(ob+0x18); return cap?((g.rd32(ob+0x20)-g.rd32(ob+0x1c)+cap)%cap)>=4*g.rd32(ob+0x30):true; };
          let n=0, guard=64; while(v.queue.length&&v.queue[0].end<=now&&guard--&&(!ob||ringHas())){ const b=v.queue.shift(); v.ended=b.end; n++;
            if(!v.dbg){ v.dbg=1; log('[audio] first OnBufferEnd: ctx 0x'+b.ctx.toString(16)+' mixer 0x'+(v.cb-0x228).toString(16)+' state '+g.rd32(v.cb-0x228+0x68)+' onEnd rva 0x'+(onEnd-0x140000000).toString(16)); }
            inEnd=true; try{ guestCall(onEnd,[v.cb,b.ctx]); } finally{ inEnd=false; } }
          if(!n||v.cb!==mixerCb) break; } } }
    finally{ pumping=false; } };
  const DEV_ID='{0.0.0.00000000}.{aw-web-audio}', DEV_NAME='Speakers (Web Audio)';
  const wstrAlloc=s=>{ const p=malloc(2*s.length+2); for(let i=0;i<s.length;i++) g.wr16(p+2*i,s.charCodeAt(i)); g.wr16(p+2*s.length,0); return p; };
  const gid=p=>[...g.bytes(p,16)].map(x=>x.toString(16).padStart(2,'0')).join('');
  const FRIENDLY='4e255ca41cdffd4e802067d146a850e0', DEVFMT='4d069ff12c08274ebc736882a1bb8e4c';
  let theDevice=0; const device=()=>theDevice||(theDevice=make('mmd',{}));
  const fmtBlob=()=>{ const p=malloc(40); g.wr16(p,0xfffe); g.wr16(p+2,2); g.wr32(p+4,48000); g.wr32(p+8,48000*8); g.wr16(p+12,8); g.wr16(p+14,32); g.wr16(p+16,22);
    g.wr16(p+18,32); g.wr32(p+20,3); const sub=[3,0,0,0,0,0,0x10,0,0x80,0,0,0xaa,0,0x38,0x9b,0x71]; sub.forEach((b,i)=>g.wr8(p+24+i,b)); return p; };
  Object.assign(M,{
    mme:{ ...unk, 0:(c,o)=>{ out(c.a(2),o.p); return 0; },
      3:(c)=>{ out(c.a(3),make('mmc',{})); return 0; }, 4:(c)=>{ out(c.a(3),device()); return 0; }, 5:(c)=>{ out(c.a(2),device()); return 0; } },
    mmc:{ ...unk, 3:(c)=>{ if(c.a(1)) g.wr32(c.a(1),1); return 0; }, 4:(c)=>{ if(c.a(1)!==0){ out(c.a(2),0); return 0x80070490; } out(c.a(2),device()); return 0; } },
    mmd:{ ...unk, 0:(c,o)=>{ const iid=gid(c.a(1)); if(iid===IID_ENDPOINT){ out(c.a(2),o.ep||(o.ep=make('mmep',{}))); return 0; } out(c.a(2),o.p); return 0; },
      3:(c)=>{ note('IMMDevice::Activate '+gid(c.a(1))+' (not provided)'); out(c.a(4),0); return E_NOINTERFACE; },
      4:(c)=>{ out(c.a(2),make('mmp',{})); return 0; }, 5:(c)=>{ out(c.a(1),wstrAlloc(DEV_ID)); return 0; }, 6:(c)=>{ if(c.a(1)) g.wr32(c.a(1),1); return 0; } },
    mmep:{ ...unk, 3:(c)=>{ if(c.a(1)) g.wr32(c.a(1),0); return 0; } },
    mmp:{ ...unk, 3:(c)=>{ if(c.a(1)) g.wr32(c.a(1),0); return 0; },
      5:(c)=>{ const k=gid(c.a(1)), pid=g.rd32(c.a(1)+16), pv=c.a(2); g.bytes(pv,24).fill(0);
        if(k===FRIENDLY&&pid===14){ g.wr16(pv,31); g.wr64(pv+8,wstrAlloc(DEV_NAME)); }
        else if(k===DEVFMT&&pid===0){ g.wr16(pv,65); g.wr32(pv+8,40); g.wr64(pv+16,fmtBlob()); }
        else note('IPropertyStore::GetValue '+k+'/'+pid+' -> empty');
        return 0; } },
  });
  const IID_ENDPOINT='8897e01b9468894085869a2a6c265ac5';
  const MMDEVICE_ENUMERATOR='9503debc2fe57c468e3dc4579291692e';
  const coCreate=(clsid,pp)=>{ if(clsid!==MMDEVICE_ENUMERATOR) return null; log('[audio] MMDeviceEnumerator created'); out(pp,make('mme',{})); return 0; };
  H.iplCreateContext=()=>{ note('Steam Audio iplCreateContext -> IPL_STATUS_FAILURE'); return 1; };
  H.XAudio2Create=(c)=>{ log('[audio] XAudio2Create'+(ctx.stack?' stack: '+ctx.stack(10).join(' '):'')); out(c.a(0),make('xa2',{})); return 0; };
  return { pump, objs, coCreate };
};
