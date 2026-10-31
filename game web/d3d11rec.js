'use strict';
module.exports = function (ctx) {
  const { g, log, objs, METHODS, malloc, out } = ctx;
  const ref = ctx.ref || (() => {}), outR = (pp, p) => { out(pp, p); ref(p); };
  const u32 = x => x % 4294967296 >>> 0;
  const rd = (p, n) => Uint8Array.from(g.bytes(p, n));
  const dvOf = b => new DataView(b.buffer, b.byteOffset, b.byteLength);
  const get = p => p ? objs.get(p) : null;

  const FMT = {};
  const def = (lo, hi, bpp) => { for (let f = lo; f <= hi; f++) FMT[f] = { bpp }; };
  def(1, 4, 16); def(5, 8, 12); def(9, 22, 8); def(23, 47, 4); def(48, 59, 2); def(60, 65, 1); def(67, 69, 4);
  def(85, 86, 2); def(87, 93, 4); def(115, 115, 2);
  for (const [lo, hi, b] of [[70, 72, 8], [73, 78, 16], [79, 81, 8], [82, 84, 16], [94, 99, 16]]) for (let f = lo; f <= hi; f++) FMT[f] = { block: b };
  const rowBytes = (fmt, w) => { const f = FMT[fmt] || { bpp: 4 }; return f.block ? Math.max(1, (w + 3) >> 2) * f.block : w * f.bpp; };
  const rowsOf = (fmt, h) => (FMT[fmt] || {}).block ? Math.max(1, (h + 3) >> 2) : h;

  const parseBuf = b => { const d = dvOf(b); return { type: 'buf', size: d.getUint32(0, true), usage: d.getUint32(4, true), bind: d.getUint32(8, true), cpu: d.getUint32(12, true), misc: d.getUint32(16, true), stride: d.getUint32(20, true) }; };
  const parseTex = (dim, b) => { const d = dvOf(b), r = i => d.getUint32(4 * i, true);
    if (dim === 1) return { type: 'tex', dim, w: r(0), h: 1, depth: 1, mips: r(1), array: r(2), format: r(3), samples: 1, usage: r(4), bind: r(5), cpu: r(6), misc: r(7) };
    if (dim === 2) return { type: 'tex', dim, w: r(0), h: r(1), depth: 1, mips: r(2), array: r(3), format: r(4), samples: r(5), usage: r(7), bind: r(8), cpu: r(9), misc: r(10) };
    return { type: 'tex', dim, w: r(0), h: r(1), depth: r(2), mips: r(3), array: 1, format: r(4), samples: 1, usage: r(5), bind: r(6), cpu: r(7), misc: r(8) }; };
  const fullMips = t => { let n = 1, m = Math.max(t.w, t.h, t.depth); while (m > 1) { m >>= 1; n++; } return n; };
  const subInfo = (t, s) => { const mip = s % t.mips, w = Math.max(1, t.w >> mip), h = Math.max(1, t.h >> mip), dep = Math.max(1, t.depth >> mip);
    const pitch = rowBytes(t.format, w), rows = rowsOf(t.format, h); return { mip, w, h, dep, pitch, rows, slice: pitch * rows, size: pitch * rows * dep }; };
  const parseView = (kind, b, res) => { const d = dvOf(b), n = b.length >> 2, u = []; for (let i = 0; i < n; i++) u.push(d.getUint32(4 * i, true));
    return { type: kind, format: u[0], vdim: u[1], args: u.slice(kind === 'dsv' ? 3 : 2), flags: kind === 'dsv' ? u[2] : 0, res: res ? (get(res) || {}).id : 0 }; };
  const STATE_SIZE = { 20: 264, 21: 52, 22: 40, 23: 52, 24: 8 }, STATE_NAME = { 20: 'blend', 21: 'depth', 22: 'raster', 23: 'sampler', 24: 'query' };

  const bufBytes = o => o.gptr ? g.bytes(o.gptr, o.info.size) : o.data;
  const subBytes = (o, s) => { if (!o.subs[s]) o.subs[s] = new Uint8Array(subInfo(o.info, s).size); return o.subs[s]; };
  const initRes = (o, pInit) => {
    const t = o.info;
    if (t.type === 'buf') {
      if (t.cpu & 0x10000) { o.gptr = malloc(t.size + 16); g.bytes(o.gptr, t.size).fill(0); } else o.data = new Uint8Array(t.size);
      if (pInit) bufBytes(o).set(g.bytes(g.rd64(pInit), t.size));
      return;
    }
    if (!t.mips) t.mips = fullMips(t);
    o.subs = new Array(t.mips * t.array).fill(null);
    if (pInit) for (let s = 0; s < o.subs.length; s++) {
      const e = pInit + 16 * s, src = g.rd64(e), sp = g.rd32(e + 8), ssp = g.rd32(e + 12), si = subInfo(t, s), dst = subBytes(o, s);
      for (let z = 0; z < si.dep; z++) for (let y = 0; y < si.rows; y++) dst.set(g.bytes(src + z * ssp + y * sp, si.pitch), z * si.slice + y * si.pitch);
    }
  };

  const STAGES = ['vs', 'hs', 'ds', 'gs', 'ps', 'cs'];
  const fresh = () => { const st = { sh: {}, cb: {}, srv: {}, samp: {}, cbOff: {}, uav: new Array(8).fill(0), rtv: new Array(8).fill(0), dsv: 0, omUav: new Array(8).fill(0),
    layout: 0, vb: [], ib: { buf: 0, fmt: 0, off: 0 }, topo: 0, vp: [], sc: [], blend: { s: 0, f: [1, 1, 1, 1], mask: 0xffffffff }, depth: { s: 0, ref: 0 }, raster: 0 };
    for (const s of STAGES) { st.sh[s] = 0; st.cb[s] = new Array(14).fill(0); st.srv[s] = new Array(128).fill(0); st.samp[s] = new Array(16).fill(0); } return st; };
  let S = fresh();

  const sinks = [];
  const traceN = typeof process !== 'undefined' && process.env.TRACE_FRAME ? +process.env.TRACE_FRAME : -1;
  let frame = 0, cap = null;
  const idOf = p => { const o = get(p); return o ? o.id : 0; };
  const emit = c => { for (const s of sinks) s.cmd(c); if (cap) { cap.cmds.push(c); } };
  const touch = p => { if (!cap || !p) return; const o = get(p); if (!o || cap.objs.has(o.id)) return; cap.objs.set(o.id, snapObj(o)); if (o.info && o.info.res) { for (const [k, v] of objs) if (v.id === o.info.res) { touch(k); break; } } };
  const blob = data => { const off = cap.size; cap.chunks.push(Uint8Array.from(data)); cap.size += data.length; return [off, data.length]; };
  const snapObj = o => { const r = { id: o.id, info: o.info || { type: o.descKey || o.kind } };
    if (o.code) r.code = blob(o.code), r.stage = o.stage;
    if (o.info && o.info.type === 'buf') r.data = blob(bufBytes(o));
    if (o.info && o.info.type === 'tex') r.subs = o.subs.map(b => b ? blob(b) : null);
    return r; };
  const touchState = () => { for (const s of STAGES) { touch(S.sh[s]); S.cb[s].forEach(touch); S.srv[s].forEach(touch); S.samp[s].forEach(touch); }
    S.uav.forEach(touch); S.rtv.forEach(touch); touch(S.dsv); S.omUav.forEach(touch); touch(S.layout); S.vb.forEach(v => v && touch(v.buf)); touch(S.ib.buf);
    touch(S.blend.s); touch(S.depth.s); touch(S.raster); };
  const stateIds = () => { const m = a => a.map(idOf), r = { sh: {}, cb: {}, srv: {}, samp: {}, cbOff: S.cbOff, uav: m(S.uav), rtv: m(S.rtv), dsv: idOf(S.dsv), omUav: m(S.omUav), layout: idOf(S.layout),
    vb: S.vb.map(v => v && { buf: idOf(v.buf), stride: v.stride, off: v.off }), ib: { buf: idOf(S.ib.buf), fmt: S.ib.fmt, off: S.ib.off }, topo: S.topo, vp: S.vp, sc: S.sc,
    blend: { s: idOf(S.blend.s), f: S.blend.f, mask: S.blend.mask }, depth: { s: idOf(S.depth.s), ref: S.depth.ref }, raster: idOf(S.raster) };
    for (const s of STAGES) { r.sh[s] = idOf(S.sh[s]); r.cb[s] = m(S.cb[s]); r.srv[s] = m(S.srv[s]); r.samp[s] = m(S.samp[s]); } return r; };
  const endFrame = () => {
    if (cap) { writeTrace(cap); cap = null; }
    frame++;
    if (frame === traceN) { cap = { frame, cmds: [], objs: new Map(), chunks: [], size: 0 }; touchState(); cap.start = stateIds(); log('[d3d11rec] capturing frame ' + frame); }
  };
  const writeTrace = c => {
    const fs = require('fs'); fs.mkdirSync('trace', { recursive: true });
    const base = 'trace/frame' + c.frame, bin = new Uint8Array(c.size); let o = 0; for (const ch of c.chunks) { bin.set(ch, o); o += ch.length; }
    fs.writeFileSync(base + '.bin', bin);
    fs.writeFileSync(base + '.json', JSON.stringify({ frame: c.frame, start: c.start, objs: [...c.objs.values()], cmds: c.cmds }));
    log('[d3d11rec] wrote ' + base + '.json/.bin: ' + c.cmds.length + ' commands, ' + c.objs.size + ' objects, ' + (c.size / 1048576).toFixed(1) + ' MB');
  };

  const D = METHODS.dev;
  const stateCache = new Map();
  const wrapCreate = (slot, ppArg, f) => { const orig = D[slot]; D[slot] = c => { const r = orig(c); const pp = c.a(ppArg); const p = pp ? g.rd64(pp) : 0; const o = get(p); if (o) f(c, o); return r; }; };
  wrapCreate(3, 3, (c, o) => { o.info = parseBuf(o.desc); initRes(o, c.a(2)); });
  for (const [slot, dim] of [[4, 1], [5, 2], [6, 3]]) wrapCreate(slot, 3, (c, o) => { o.info = parseTex(dim, o.desc); initRes(o, c.a(2)); });
  for (const [slot, kind] of [[7, 'srv'], [8, 'uav'], [9, 'rtv'], [10, 'dsv']]) wrapCreate(slot, 3, (c, o) => {
    const r = get(c.a(1));
    if (!o.desc && r && r.info) {
      const t = r.info, b = new Uint8Array(32), d = dvOf(b);
      d.setUint32(0, t.format || 0, true);
      d.setUint32(4, t.type === 'buf' ? 1 : t.dim === 1 ? (t.array > 1 ? 3 : 2) : t.dim === 2 ? (t.samples > 1 ? (t.array > 1 ? 7 : 6) : (t.array > 1 ? 5 : 4)) : 8, true);
      o.desc = b; o.nullDesc = true;
    }
    o.info = o.desc ? parseView(kind, o.desc, c.a(1)) : { type: kind, res: r ? r.id : 0 };
  });
  wrapCreate(11, 5, (c, o) => { const n = u32(c.a(2)), els = [];
    for (let i = 0; i < n; i++) { const e = c.a(1) + 32 * i; els.push({ name: g.cstr(g.rd64(e)), index: g.rd32(e + 8), format: g.rd32(e + 12), slot: g.rd32(e + 16), offset: g.rd32(e + 20), cls: g.rd32(e + 24), step: g.rd32(e + 28) }); }
    o.info = { type: 'layout', els }; });
  for (let slot = 12; slot <= 18; slot++) wrapCreate(slot, slot === 14 ? 9 : 4, (c, o) => { o.info = { type: 'shader', stage: o.stage }; });
  for (const slot of [20, 21, 22, 23, 24]) wrapCreate(slot, 2, (c, o) => { o.raw = rd(c.a(1), STATE_SIZE[slot]); o.info = { type: STATE_NAME[slot], raw: [...o.raw] };
    if (slot === 24) return;
    const key = slot + ':' + o.raw.join(','), have = stateCache.get(key), pp = c.a(2);
    if (have && objs.has(have)) { g.wr64(pp, have); ref(have); objs.delete(o.p); ctx.byId && ctx.byId.delete(o.id); return; }
    stateCache.set(key, o.p); o.stateKey = key; });

  const CH = METHODS.child, ch7 = CH[7];
  CH[7] = c => { const o = get(c.a(0));
    if (o && o.info && (o.info.type === 'buf' || o.info.type === 'tex')) { if (c.a(1)) g.wr32(c.a(1), o.info.type === 'buf' ? 1 : 1 + o.info.dim); return 0; }
    if (o && o.raw && o.info.type !== 'query') { if (c.a(1)) g.bytes(c.a(1), o.raw.length).set(o.raw); return 0; }
    if (o && o.info && o.info.type === 'query') return 0;
    return ch7(c); };
  const ch8 = CH[8];
  CH[8] = c => { const o = get(c.a(0)); if (o && o.info && o.info.type === 'query') { if (c.a(1)) g.bytes(c.a(1), 8).set(o.raw); return 0; } return ch8(c); };

  const C = METHODS.ctx;
  const ptrs = (pp, n) => { const r = []; for (let i = 0; i < n; i++) r.push(pp ? g.rd64(pp + 8 * i) : 0); return r; };
  const setArr = (arr, start, list) => { list.forEach((p, i) => { if (start + i < arr.length) arr[start + i] = p; }); };
  const putPtrs = (pp, arr, start, n) => { if (!pp) return; for (let i = 0; i < n; i++) ref(arr[start + i]); for (let i = 0; i < n; i++) g.wr64(pp + 8 * i, arr[start + i] || 0); };
  const STAGE_SLOTS = { vs: { cb: 7, srv: 25, samp: 26, sh: 11, gcb: 72, gsrv: 84, gsamp: 85, gsh: 76 }, ps: { cb: 16, srv: 8, samp: 10, sh: 9, gcb: 77, gsrv: 73, gsamp: 75, gsh: 74 },
    gs: { cb: 22, srv: 31, samp: 32, sh: 23, gcb: 81, gsrv: 87, gsamp: 88, gsh: 82 }, hs: { cb: 62, srv: 59, samp: 61, sh: 60, gcb: 100, gsrv: 97, gsamp: 99, gsh: 98 },
    ds: { cb: 66, srv: 63, samp: 65, sh: 64, gcb: 104, gsrv: 101, gsamp: 103, gsh: 102 }, cs: { cb: 71, srv: 67, samp: 70, sh: 69, gcb: 109, gsrv: 105, gsamp: 108, gsh: 107 } };
  for (const [st, sl] of Object.entries(STAGE_SLOTS)) {
    for (const k of ['cb', 'srv', 'samp']) {
      C[sl[k]] = c => { const start = u32(c.a(1)), n = u32(c.a(2)), list = ptrs(c.a(3), n); setArr(S[k][st], start, list); list.forEach(touch);
        emit({ op: 'set_' + k, stage: st, start, ids: list.map(idOf) }); return 0; };
      C[sl['g' + k]] = c => { putPtrs(c.a(3), S[k][st], u32(c.a(1)), u32(c.a(2))); return 0; };
    }
    C[sl.sh] = c => { S.sh[st] = c.a(1); touch(c.a(1)); emit({ op: 'set_shader', stage: st, id: idOf(c.a(1)) }); return 0; };
    C[sl.gsh] = c => { outR(c.a(1), S.sh[st]); if (c.a(3)) g.wr32(c.a(3), 0); return 0; };
  }
  C[17] = c => { S.layout = c.a(1); touch(c.a(1)); emit({ op: 'set_layout', id: idOf(c.a(1)) }); return 0; };
  C[78] = c => { outR(c.a(1), S.layout); return 0; };
  C[18] = c => { const start = u32(c.a(1)), n = u32(c.a(2)), bufs = ptrs(c.a(3), n), list = [];
    for (let i = 0; i < n; i++) { const v = { buf: bufs[i], stride: c.a(4) ? g.rd32(c.a(4) + 4 * i) : 0, off: c.a(5) ? g.rd32(c.a(5) + 4 * i) : 0 }; S.vb[start + i] = v; touch(v.buf); list.push({ buf: idOf(v.buf), stride: v.stride, off: v.off }); }
    emit({ op: 'set_vb', start, list }); return 0; };
  C[79] = c => { const start = u32(c.a(1)), n = u32(c.a(2)); for (let i = 0; i < n; i++) { const v = S.vb[start + i] || { buf: 0, stride: 0, off: 0 };
    if (c.a(3)) { g.wr64(c.a(3) + 8 * i, v.buf); ref(v.buf); } if (c.a(4)) g.wr32(c.a(4) + 4 * i, v.stride); if (c.a(5)) g.wr32(c.a(5) + 4 * i, v.off); } return 0; };
  C[19] = c => { S.ib = { buf: c.a(1), fmt: u32(c.a(2)), off: u32(c.a(3)) }; touch(c.a(1)); emit({ op: 'set_ib', id: idOf(c.a(1)), fmt: S.ib.fmt, off: S.ib.off }); return 0; };
  C[80] = c => { outR(c.a(1), S.ib.buf); if (c.a(2)) g.wr32(c.a(2), S.ib.fmt); if (c.a(3)) g.wr32(c.a(3), S.ib.off); return 0; };
  C[24] = c => { S.topo = u32(c.a(1)); emit({ op: 'set_topo', topo: S.topo }); return 0; };
  C[83] = c => { if (c.a(1)) g.wr32(c.a(1), S.topo); return 0; };
  C[13] = c => { emit({ op: 'draw', count: u32(c.a(1)), first: u32(c.a(2)) }); return 0; };
  C[12] = c => { emit({ op: 'draw_indexed', count: u32(c.a(1)), first: u32(c.a(2)), base: u32(c.a(3)) | 0 }); return 0; };
  C[21] = c => { emit({ op: 'draw', count: u32(c.a(1)), inst: u32(c.a(2)), first: u32(c.a(3)), firstInst: u32(c.a(4)) }); return 0; };
  C[20] = c => { emit({ op: 'draw_indexed', count: u32(c.a(1)), inst: u32(c.a(2)), first: u32(c.a(3)), base: u32(c.a(4)) | 0, firstInst: u32(c.a(5)) }); return 0; };
  C[39] = c => { touch(c.a(1)); emit({ op: 'draw_indexed_indirect', id: idOf(c.a(1)), off: u32(c.a(2)) }); return 0; };
  C[40] = c => { touch(c.a(1)); emit({ op: 'draw_indirect', id: idOf(c.a(1)), off: u32(c.a(2)) }); return 0; };
  C[41] = c => { emit({ op: 'dispatch', x: u32(c.a(1)), y: u32(c.a(2)), z: u32(c.a(3)) }); return 0; };
  C[42] = c => { touch(c.a(1)); emit({ op: 'dispatch_indirect', id: idOf(c.a(1)), off: u32(c.a(2)) }); return 0; };
  C[33] = c => { const n = u32(c.a(1)), list = ptrs(c.a(2), n); S.rtv.fill(0); setArr(S.rtv, 0, list); S.dsv = c.a(3); list.forEach(touch); touch(S.dsv);
    emit({ op: 'set_rt', rtv: list.map(idOf), dsv: idOf(S.dsv) }); return 0; };
  C[34] = c => { const n = u32(c.a(1)); if (n !== 0xffffffff) { const list = ptrs(c.a(2), n); S.rtv.fill(0); setArr(S.rtv, 0, list); S.dsv = c.a(3); list.forEach(touch); touch(S.dsv); }
    const us = u32(c.a(4)), un = u32(c.a(5)); if (un !== 0xffffffff) { const ul = ptrs(c.a(6), un); setArr(S.omUav, us, ul); ul.forEach(touch); }
    emit({ op: 'set_rt_uav', rtv: S.rtv.map(idOf), dsv: idOf(S.dsv), uav: S.omUav.map(idOf) }); return 0; };
  C[89] = c => { putPtrs(c.a(2), S.rtv, 0, u32(c.a(1))); outR(c.a(3), S.dsv); return 0; };
  C[90] = c => { putPtrs(c.a(2), S.rtv, 0, u32(c.a(1))); outR(c.a(3), S.dsv); putPtrs(c.a(6), S.omUav, u32(c.a(4)), u32(c.a(5))); return 0; };
  C[35] = c => { const f = c.a(2) ? [0, 1, 2, 3].map(i => dvOf(g.bytes(c.a(2) + 4 * i, 4)).getFloat32(0, true)) : [1, 1, 1, 1];
    S.blend = { s: c.a(1), f, mask: u32(c.a(3)) }; touch(c.a(1)); emit({ op: 'set_blend', id: idOf(c.a(1)), f, mask: S.blend.mask }); return 0; };
  C[91] = c => { outR(c.a(1), S.blend.s); if (c.a(2)) S.blend.f.forEach((v, i) => dvOf(g.bytes(c.a(2) + 4 * i, 4)).setFloat32(0, v, true)); if (c.a(3)) g.wr32(c.a(3), S.blend.mask); return 0; };
  C[36] = c => { S.depth = { s: c.a(1), ref: u32(c.a(2)) }; touch(c.a(1)); emit({ op: 'set_depth', id: idOf(c.a(1)), ref: S.depth.ref }); return 0; };
  C[92] = c => { outR(c.a(1), S.depth.s); if (c.a(2)) g.wr32(c.a(2), S.depth.ref); return 0; };
  C[43] = c => { S.raster = c.a(1); touch(c.a(1)); emit({ op: 'set_raster', id: idOf(c.a(1)) }); return 0; };
  C[94] = c => { outR(c.a(1), S.raster); return 0; };
  C[44] = c => { const n = u32(c.a(1)), vp = []; for (let i = 0; i < n; i++) { const d = dvOf(g.bytes(c.a(2) + 24 * i, 24)); vp.push([0, 1, 2, 3, 4, 5].map(k => d.getFloat32(4 * k, true))); }
    S.vp = vp; emit({ op: 'set_viewports', vp }); return 0; };
  C[95] = c => { const pn = c.a(1); if (!pn) return 0; if (c.a(2)) S.vp.forEach((v, i) => { const d = dvOf(g.bytes(c.a(2) + 24 * i, 24)); v.forEach((x, k) => d.setFloat32(4 * k, x, true)); }); g.wr32(pn, S.vp.length); return 0; };
  C[45] = c => { const n = u32(c.a(1)), sc = []; for (let i = 0; i < n; i++) { const p = c.a(2) + 16 * i; sc.push([0, 1, 2, 3].map(k => g.rd32(p + 4 * k) | 0)); } S.sc = sc; emit({ op: 'set_scissors', sc }); return 0; };
  C[96] = c => { const pn = c.a(1); if (!pn) return 0; if (c.a(2)) S.sc.forEach((r, i) => r.forEach((x, k) => g.wr32(c.a(2) + 16 * i + 4 * k, x >>> 0))); g.wr32(pn, S.sc.length); return 0; };
  C[68] = c => { const start = u32(c.a(1)), n = u32(c.a(2)), list = ptrs(c.a(3), n); setArr(S.uav, start, list); list.forEach(touch);
    emit({ op: 'set_cs_uav', start, ids: list.map(idOf), counts: c.a(4) ? list.map((_, i) => g.rd32(c.a(4) + 4 * i)) : null }); return 0; };
  C[106] = c => { putPtrs(c.a(3), S.uav, u32(c.a(1)), u32(c.a(2))); return 0; };
  const f4 = p => [0, 1, 2, 3].map(i => dvOf(g.bytes(p + 4 * i, 4)).getFloat32(0, true));
  C[50] = c => { touch(c.a(1)); emit({ op: 'clear_rtv', id: idOf(c.a(1)), rgba: f4(c.a(2)) }); return 0; };
  C[51] = c => { touch(c.a(1)); emit({ op: 'clear_uav_uint', id: idOf(c.a(1)), v: [0, 1, 2, 3].map(i => g.rd32(c.a(2) + 4 * i)) }); return 0; };
  C[52] = c => { touch(c.a(1)); emit({ op: 'clear_uav_float', id: idOf(c.a(1)), v: f4(c.a(2)) }); return 0; };
  C[53] = c => { touch(c.a(1)); emit({ op: 'clear_dsv', id: idOf(c.a(1)), flags: u32(c.a(2)), depth: ctx.xf32(3), stencil: u32(c.a(4)) & 255 }); return 0; };
  C[47] = c => { touch(c.a(1)); touch(c.a(2)); const d = get(c.a(1)), s = get(c.a(2));
    if (d && s && d.info && s.info) { if (d.info.type === 'buf' && s.info.type === 'buf') bufBytes(d).set(bufBytes(s).subarray(0, Math.min(d.info.size, s.info.size)));
      else if (d.subs && s.subs) s.subs.forEach((b, i) => { if (b && i < d.subs.length) d.subs[i] = Uint8Array.from(b); }); }
    emit({ op: 'copy', dst: idOf(c.a(1)), src: idOf(c.a(2)) }); return 0; };
  C[46] = c => { touch(c.a(1)); touch(c.a(6)); const box = c.a(8) ? [0, 1, 2, 3, 4, 5].map(i => g.rd32(c.a(8) + 4 * i)) : null;
    const d = get(c.a(1)), s = get(c.a(6));
    if (d && s && d.info && s.info && d.info.type === 'buf' && s.info.type === 'buf') { const lo = box ? box[0] : 0, hi = box ? box[3] : s.info.size, x = u32(c.a(3)); bufBytes(d).set(bufBytes(s).subarray(lo, hi), x); }
    emit({ op: 'copy_region', dst: idOf(c.a(1)), dsub: u32(c.a(2)), x: u32(c.a(3)), y: u32(c.a(4)), z: u32(c.a(5)), src: idOf(c.a(6)), ssub: u32(c.a(7)), box }); return 0; };
  C[48] = c => { const o = get(c.a(1)); touch(c.a(1)); if (!o || !o.info) return 0; const sub = u32(c.a(2)), pb = c.a(3), src = c.a(4), sp = u32(c.a(5)), ssp = u32(c.a(6));
    const box = pb ? [0, 1, 2, 3, 4, 5].map(i => g.rd32(pb + 4 * i)) : null; let data;
    if (o.info.type === 'buf') { const lo = box ? box[0] : 0, hi = box ? box[3] : o.info.size; data = g.bytes(src, hi - lo); bufBytes(o).set(data, lo); }
    else { const t = o.info, si = subInfo(t, sub), b = box || [0, 0, 0, si.w, si.h, si.dep], dst = subBytes(o, sub);
      const fi = FMT[t.format] || { bpp: 4 }, x0 = fi.block ? (b[0] >> 2) * fi.block : b[0] * fi.bpp, rowLen = rowBytes(t.format, b[3] - b[0]), rows = rowsOf(t.format, b[4] - b[1]), y0 = (FMT[t.format] || {}).block ? b[1] >> 2 : b[1];
      const tmp = new Uint8Array(rowLen * rows * (b[5] - b[2]));
      for (let z = 0; z < b[5] - b[2]; z++) for (let y = 0; y < rows; y++) { const row = g.bytes(src + z * ssp + y * sp, rowLen); dst.set(row, (b[2] + z) * si.slice + (y0 + y) * si.pitch + x0); tmp.set(row, (z * rows + y) * rowLen); }
      data = tmp; }
    emit({ op: 'update', id: o.id, sub, box, data: cap ? blob(data) : null, bytes: sinks.length ? data : null }); return 0; };
  C[54] = c => { touch(c.a(1)); emit({ op: 'gen_mips', id: idOf(c.a(1)) }); return 0; };
  C[57] = c => { touch(c.a(1)); touch(c.a(3)); emit({ op: 'resolve', dst: idOf(c.a(1)), dsub: u32(c.a(2)), src: idOf(c.a(3)), ssub: u32(c.a(4)), fmt: u32(c.a(5)) }); return 0; };
  C[110] = () => { S = fresh(); emit({ op: 'clear_state' }); return 0; };
  C[14] = c => { const o = get(c.a(1)); if (!o || !o.info) return 0x80070057; const sub = u32(c.a(2)), type = u32(c.a(3)), m = c.a(5); touch(c.a(1));
    let ptr, pitch = 0, dpitch = 0;
    if (o.info.type === 'buf') { if (!o.gptr) { o.gptr = malloc(o.info.size + 16); g.bytes(o.gptr, o.info.size).set(o.data); o.data = null; } ptr = o.gptr; pitch = dpitch = o.info.size; }
    else { const si = subInfo(o.info, sub); if (!o.staging) o.staging = {}; if (!o.staging[sub]) o.staging[sub] = malloc(si.size + 16); ptr = o.staging[sub]; pitch = si.pitch; dpitch = si.slice;
      if (type !== 4) g.bytes(ptr, si.size).set(subBytes(o, sub)); }
    o.mapped = { sub, type, ptr };
    if (m) { g.wr64(m, ptr); g.wr32(m + 8, pitch); g.wr32(m + 12, dpitch); } return 0; };
  C[15] = c => { const o = get(c.a(1)); if (!o || !o.mapped) return 0; const { sub, type, ptr } = o.mapped; o.mapped = null; if (type === 1) return 0;
    let data;
    if (o.info.type === 'buf') data = cap || sinks.length ? g.bytes(ptr, o.info.size) : null;
    else { const si = subInfo(o.info, sub); o.subs[sub] = Uint8Array.from(g.bytes(ptr, si.size)); data = o.subs[sub]; }
    emit({ op: 'update', id: o.id, sub, box: null, data: cap && data ? blob(data) : null, bytes: sinks.length ? data : null, map: true }); return 0; };

  const SC = METHODS.sc, present = SC[8];
  SC[8] = c => { emit({ op: 'present', sync: u32(c.a(1)) }); endFrame(); if (ctx.reap) { boundSet = null; ctx.reap(isBound); } return present(c); };
  const isBound = p => { const B = boundSet || (boundSet = new Set()); if (!B.size) { const add = x => { if (x) B.add(x); };
      for (const st of STAGES) { add(S.sh[st]); S.cb[st].forEach(add); S.srv[st].forEach(add); S.samp[st].forEach(add); }
      S.uav.forEach(add); S.rtv.forEach(add); add(S.dsv); S.omUav.forEach(add); add(S.layout); S.vb.forEach(v => v && add(v.buf)); add(S.ib.buf); add(S.blend.s); add(S.depth.s); add(S.raster); }
    return B.has(p); };
  let boundSet = null;
  if (ctx.onFree) ctx.onFree.push(o => { boundSet = null;
    if (o.stateKey && stateCache.get(o.stateKey) === o.p) stateCache.delete(o.stateKey);
    if (o.gptr && ctx.free) ctx.free(o.gptr); if (o.store && ctx.free) ctx.free(o.store);
    o.data = null; o.subs = null; o.gptr = 0; o.store = 0; emit({ op: 'free', id: o.id }); });
  const getBuf = SC[9];
  SC[9] = c => { const r = getBuf(c); const sc = get(c.a(0)), o = sc && sc.back && get(sc.back); if (o && !o.info) { o.info = parseTex(2, o.desc); o.info.backbuffer = true; initRes(o, 0); } return r; };

  const liveObj = id => { const o = ctx.byId.get(id); if (!o) return null; return { id, info: o.info || { type: o.descKey || o.kind }, code: o.code || null, stage: o.stage, subs: o.subs || null,
    get data() { return o.info && o.info.type === 'buf' ? bufBytes(o) : null; } }; };
  return { addSink: s => sinks.push(s), liveObj, state: () => S, frame: () => frame, subInfo, FMT, rowBytes };
};
