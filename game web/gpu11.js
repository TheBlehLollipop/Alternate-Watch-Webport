'use strict';
const GU = { MAP_READ: 1, COPY_SRC: 4, COPY_DST: 8, INDEX: 16, VERTEX: 32, UNIFORM: 64, STORAGE: 128, INDIRECT: 256, QUERY_RESOLVE: 512 };
const TU = { COPY_SRC: 1, COPY_DST: 2, TEXTURE_BINDING: 4, STORAGE_BINDING: 8, RENDER_ATTACHMENT: 16 };
const SS = { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 };

const TEXFMT = { 1: 'rgba32float', 2: 'rgba32float', 3: 'rgba32uint', 4: 'rgba32sint', 9: 'rgba16float', 10: 'rgba16float', 11: 'rgba16unorm', 12: 'rgba16uint', 13: 'rgba16snorm', 14: 'rgba16sint',
  15: 'rg32float', 16: 'rg32float', 17: 'rg32uint', 18: 'rg32sint', 19: 'depth32float-stencil8', 20: 'depth32float-stencil8', 21: 'depth32float-stencil8', 22: 'depth32float-stencil8',
  23: 'rgb10a2unorm', 24: 'rgb10a2unorm', 25: 'rgb10a2uint', 26: 'rg11b10ufloat', 27: 'rgba8unorm', 28: 'rgba8unorm', 29: 'rgba8unorm-srgb', 30: 'rgba8uint', 31: 'rgba8snorm', 32: 'rgba8sint',
  33: 'rg16float', 34: 'rg16float', 35: 'rg16unorm', 36: 'rg16uint', 37: 'rg16snorm', 38: 'rg16sint', 39: 'r32float', 40: 'depth32float', 41: 'r32float', 42: 'r32uint', 43: 'r32sint',
  44: 'depth24plus-stencil8', 45: 'depth24plus-stencil8', 46: 'depth24plus-stencil8', 47: 'depth24plus-stencil8', 48: 'rg8unorm', 49: 'rg8unorm', 50: 'rg8uint', 51: 'rg8snorm', 52: 'rg8sint',
  53: 'r16float', 54: 'r16float', 55: 'depth16unorm', 56: 'r16unorm', 57: 'r16uint', 58: 'r16snorm', 59: 'r16sint', 60: 'r8unorm', 61: 'r8unorm', 62: 'r8uint', 63: 'r8snorm', 64: 'r8sint', 65: 'rgba8unorm',
  67: 'rgb9e5ufloat', 70: 'bc1-rgba-unorm', 71: 'bc1-rgba-unorm', 72: 'bc1-rgba-unorm-srgb', 73: 'bc2-rgba-unorm', 74: 'bc2-rgba-unorm', 75: 'bc2-rgba-unorm-srgb', 76: 'bc3-rgba-unorm',
  77: 'bc3-rgba-unorm', 78: 'bc3-rgba-unorm-srgb', 79: 'bc4-r-unorm', 80: 'bc4-r-unorm', 81: 'bc4-r-snorm', 82: 'bc5-rg-unorm', 83: 'bc5-rg-unorm', 84: 'bc5-rg-snorm',
  87: 'bgra8unorm', 88: 'bgra8unorm', 90: 'bgra8unorm', 91: 'bgra8unorm-srgb', 92: 'bgra8unorm', 93: 'bgra8unorm-srgb', 94: 'bc6h-rgb-ufloat', 95: 'bc6h-rgb-ufloat', 96: 'bc6h-rgb-float',
  97: 'bc7-rgba-unorm', 98: 'bc7-rgba-unorm', 99: 'bc7-rgba-unorm-srgb' };
const TYPELESS = new Set([1, 5, 9, 15, 19, 23, 27, 33, 39, 44, 48, 53, 60, 70, 73, 76, 79, 82, 90, 92, 94, 97]);
const DEPTH_OF = { 39: 'depth32float', 40: 'depth32float', 41: 'depth32float', 53: 'depth16unorm', 55: 'depth16unorm', 19: 'depth32float-stencil8', 20: 'depth32float-stencil8', 44: 'depth24plus-stencil8', 45: 'depth24plus-stencil8' };
const isDepth = f => /^depth/.test(f);
const hasStencil = f => /stencil/.test(f);
const isBC = f => /^bc/.test(f);
const sampleTypeOf = f => isDepth(f) ? 'depth' : /uint$/.test(f) ? 'uint' : /sint$/.test(f) ? 'sint' : 'float';
const unfilterable = f => /16unorm|16snorm/.test(f);
const VTXFMT = { 2: 'float32x4', 6: 'float32x3', 16: 'float32x2', 41: 'float32', 10: 'float16x4', 34: 'float16x2', 54: 'float16', 28: 'unorm8x4', 87: 'unorm8x4-bgra', 30: 'uint8x4', 31: 'snorm8x4',
  32: 'sint8x4', 11: 'unorm16x4', 13: 'snorm16x4', 12: 'uint16x4', 14: 'sint16x4', 35: 'unorm16x2', 37: 'snorm16x2', 36: 'uint16x2', 38: 'sint16x2', 42: 'uint32', 43: 'sint32', 17: 'uint32x2',
  18: 'sint32x2', 3: 'uint32x4', 4: 'sint32x4', 7: 'uint32x3', 8: 'sint32x3', 24: 'unorm10-10-10-2', 49: 'unorm8x2', 50: 'uint8x2', 51: 'snorm8x2', 52: 'sint8x2', 57: 'uint16', 61: 'unorm8', 62: 'uint8' };
const VTXSIZE = { float32x4: 16, float32x3: 12, float32x2: 8, float32: 4, float16x4: 8, float16x2: 4, float16: 2, uint32x4: 16, sint32x4: 16, uint32x3: 12, sint32x3: 12, uint32x2: 8, sint32x2: 8, uint32: 4, sint32: 4,
  unorm16x4: 8, snorm16x4: 8, uint16x4: 8, sint16x4: 8, unorm16x2: 4, snorm16x2: 4, uint16x2: 4, sint16x2: 4, uint16: 2, unorm8: 1, uint8: 1 };
const BLEND = [null, 'zero', 'one', 'src', 'one-minus-src', 'src-alpha', 'one-minus-src-alpha', 'dst-alpha', 'one-minus-dst-alpha', 'dst', 'one-minus-dst', 'src-alpha-saturated', null, null,
  'constant', 'one-minus-constant', 'src1', 'one-minus-src1', 'src1-alpha', 'one-minus-src1-alpha'];
const BLENDOP = [null, 'add', 'subtract', 'reverse-subtract', 'min', 'max'];
const CMP = [null, 'never', 'less', 'equal', 'less-equal', 'greater', 'not-equal', 'greater-equal', 'always'];
const STENCILOP = [null, 'keep', 'zero', 'replace', 'increment-clamp', 'decrement-clamp', 'invert', 'increment-wrap', 'decrement-wrap'];
const ADDR = [null, 'repeat', 'mirror-repeat', 'clamp-to-edge', 'clamp-to-edge', 'mirror-repeat'];
const TOPO = [null, 'point-list', 'line-list', 'line-strip', 'triangle-list', 'triangle-strip'];
const ELEM = { 2: 16, 3: 16, 4: 16, 6: 12, 7: 12, 8: 12, 10: 8, 12: 8, 16: 8, 17: 8, 18: 8, 28: 4, 34: 4, 41: 4, 42: 4, 43: 4, 57: 2, 62: 1 };

const STORAGE_CORE = new Set(['rgba8unorm', 'rgba8snorm', 'rgba8uint', 'rgba8sint', 'rgba16uint', 'rgba16sint', 'rgba16float', 'r32uint', 'r32sint', 'r32float',
  'rg32uint', 'rg32sint', 'rg32float', 'rgba32uint', 'rgba32sint', 'rgba32float']);
const STORAGE_TIER1 = new Set(['r8unorm', 'r8snorm', 'r8uint', 'r8sint', 'rg8unorm', 'rg8snorm', 'rg8uint', 'rg8sint', 'r16uint', 'r16sint', 'r16float', 'rg16uint', 'rg16sint',
  'rg16float', 'rgb10a2uint', 'rgb10a2unorm', 'rg11b10ufloat', 'r16unorm', 'r16snorm', 'rg16unorm', 'rg16snorm', 'rgba16unorm', 'rgba16snorm']);
const WIDEN = { r8unorm: 'rgba8unorm', rg8unorm: 'rgba8unorm', r8snorm: 'rgba8snorm', rg8snorm: 'rgba8snorm', r8uint: 'rgba8uint', rg8uint: 'rgba8uint', r8sint: 'rgba8sint', rg8sint: 'rgba8sint',
  r16float: 'rgba16float', rg16float: 'rgba16float', r16uint: 'rgba16uint', rg16uint: 'rgba16uint', r16sint: 'rgba16sint', rg16sint: 'rgba16sint', rgb10a2unorm: 'rgba16float', rg11b10ufloat: 'rgba16float' };
const f32b = new Float32Array(1), u32b = new Uint32Array(f32b.buffer);
const toHalf = x => { f32b[0] = x; const u = u32b[0], s = (u >>> 16) & 0x8000, e = (u >>> 23) & 255, m = u & 0x7fffff;
  if (e === 255) return s | 0x7c00 | (m ? 0x200 : 0);
  const he = e - 112; if (he >= 31) return s | 0x7c00;
  if (he <= 0) { if (he < -10) return s; const mm = m | 0x800000, sh = 14 - he, h = mm >>> sh, r = mm & ((1 << sh) - 1), half = 1 << (sh - 1); return s | (h + (r > half || (r === half && (h & 1)) ? 1 : 0)); }
  let h = s | (he << 10) | (m >>> 13); const r = m & 0x1fff; if (r > 0x1000 || (r === 0x1000 && (h & 1))) h++; return h; };
const convertTexels = (sf, df, data, n) => {
  const nc = f => /^rgba/.test(f) ? 4 : /^rg\d/.test(f) ? 2 : 1;
  const src8 = data instanceof Uint8Array ? data : new Uint8Array(data.buffer, data.byteOffset, data.byteLength), dv = new DataView(src8.buffer, src8.byteOffset, src8.byteLength);
  if (/16[us]norm$/.test(sf) && df === sf.replace(/16[us]norm$/, '16float')) { const c = nc(sf), out = new Uint16Array(n * c), sn = /snorm$/.test(sf);
    for (let i = 0; i < n * c; i++) out[i] = toHalf(sn ? Math.max(-1, dv.getInt16(2 * i, true) / 32767) : dv.getUint16(2 * i, true) / 65535); return out; }
  if (df === 'rgba16float' && (sf === 'rg11b10ufloat' || sf === 'rgb10a2unorm')) { const out = new Uint16Array(n * 4);
    for (let i = 0; i < n; i++) { const u = dv.getUint32(4 * i, true);
      if (sf === 'rg11b10ufloat') { out[4 * i] = (u & 0x7ff) << 4; out[4 * i + 1] = ((u >>> 11) & 0x7ff) << 4; out[4 * i + 2] = ((u >>> 22) & 0x3ff) << 5; out[4 * i + 3] = 0x3c00; }
      else { out[4 * i] = toHalf((u & 1023) / 1023); out[4 * i + 1] = toHalf(((u >>> 10) & 1023) / 1023); out[4 * i + 2] = toHalf(((u >>> 20) & 1023) / 1023); out[4 * i + 3] = toHalf((u >>> 30) / 3); } }
    return out; }
  if (WIDEN[sf] === df) { const c = nc(sf), w16 = /16/.test(sf), out = w16 ? new Uint16Array(n * 4) : new Uint8Array(n * 4);
    const one = w16 ? (/float/.test(sf) ? 0x3c00 : 1) : /unorm/.test(sf) ? 255 : /snorm/.test(sf) ? 127 : 1;
    for (let i = 0; i < n; i++) { for (let k = 0; k < 4; k++) out[4 * i + k] = k < c ? (w16 ? dv.getUint16(2 * (i * c + k), true) : src8[i * c + k]) : k === 3 ? one : 0; }
    return out; }
  return null; };

function createExecutor(device, opts) {
  const { translate } = opts, log = opts.log || console.log;
  const has = f => device.features.has(f);
  const caps = { bc: has('texture-compression-bc'), bc3d: has('texture-compression-bc-sliced-3d'), tier1: has('texture-formats-tier1'),
    norm16: has('texture-formats-tier1'), rg11b10rt: has('rg11b10ufloat-renderable') || has('texture-formats-tier1'), d32s8: has('depth32float-stencil8'),
    f32filt: has('float32-filterable'), clipCtl: has('depth-clip-control'), bgraSt: has('bgra8unorm-storage') };
  const bcdec = opts.bcdec || (typeof require === 'function' ? require('./bcdec.js') : null);
  const storageOK = f => (STORAGE_CORE.has(f) || (caps.tier1 && STORAGE_TIER1.has(f)) || (caps.bgraSt && f === 'bgra8unorm')) && !/snorm|16unorm/.test(f);
  const unfilterable = f => /16unorm|16snorm/.test(f) || (!caps.f32filt && /32float/.test(f));
  const fallbackFmt = (f, t) => {
    if (isBC(f) && (!caps.bc || (t.dim === 3 && !caps.bc3d))) return bcdec ? bcdec.bcTarget(f) : f;
    if (/16[us]norm$/.test(f) && !isDepth(f) && !caps.norm16) return f.replace(/16[us]norm$/, '16float');
    if (f === 'depth32float-stencil8' && !caps.d32s8) return 'depth24plus-stencil8';
    if (f === 'rg11b10ufloat' && (t.bind & 0x20) && !caps.rg11b10rt) return 'rgba16float';
    if ((t.bind & 0x80) && t.samples <= 1 && !isDepth(f) && !storageOK(f) && WIDEN[f]) return WIDEN[f];
    return f; };
  { const fb = [];
    if (!caps.bc) fb.push(bcdec ? 'BC textures decoded on the CPU' : 'BC textures UNSUPPORTED (no decoder)'); else if (!caps.bc3d) fb.push('3D BC textures decoded on the CPU');
    if (!caps.norm16) fb.push('16-bit norm formats -> 16-bit float'); if (!caps.rg11b10rt) fb.push('rg11b10ufloat targets -> rgba16float');
    if (!caps.tier1) fb.push('UAV textures widened to core storage formats'); if (!caps.d32s8) fb.push('depth32float-stencil8 -> depth24plus-stencil8');
    if (!caps.f32filt) fb.push('32-bit float textures point sampled'); if (!caps.clipCtl) fb.push('depth clamp off (no depth-clip-control)');
    const L = device.limits; if (L.maxColorAttachmentBytesPerSample < 48) fb.push('maxColorAttachmentBytesPerSample ' + L.maxColorAttachmentBytesPerSample + ' (GBuffer needs 48: base pass split)');
    log('[gpu11] ' + (fb.length ? 'compatibility fallbacks: ' + fb.join('; ') : 'device has every feature this game uses')); }
  const objs = new Map();
  if (opts.resolve) { const get = objs.get.bind(objs); objs.get = id => { if (!id) return undefined; let o = get(id); if (!o) { o = opts.resolve(id); if (o) objs.set(id, o); } return o || undefined; }; }
  const shaderCache = new Map(), pipeCache = new Map(), samplerCache = new Map();
  const moduleSrc = new WeakMap(), plSrc = new WeakMap();
  const srcByHash = new Map(), moduleSrcByHash = h => srcByHash.get(h) || '';
  const mkModule = code => { const m = device.createShaderModule({ code }); moduleSrc.set(m, code); return m; };
  const hashOf = w => { let a = 0x811c9dc5, b = 0x1000193 ^ w.length; for (let i = 0; i < w.length; i++) { const c = w.charCodeAt(i); a = Math.imul(a ^ c, 0x1000193); b = Math.imul(b ^ c, 0x5bd1e995); }
    return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0'); };
  const modHash = new WeakMap(), recShaders = {}, recPipes = [], recKeys = new Set(), warm = [], warmKeys = new Set();
  const shaderSet = s2 => s2.match(/"wgsl":"[0-9a-f]+"/g).sort().join(',');
  let warmByShaders = null, missLogged = 0;
  const serDesc = desc => JSON.stringify(desc, (k, v) => {
    if (!v || typeof v !== 'object') return v;
    const w = moduleSrc.get(v); if (w !== undefined) { let h = modHash.get(v); if (!h) { h = hashOf(w); modHash.set(v, h); if (warmByShaders) srcByHash.set(h, w); } if (opts.recordPipes) recShaders[h] = w; return { wgsl: h }; }
    const L = plSrc.get(v); return L ? { bgl: L } : sortKeys(v); });
  const sortKeys = v => { if (Array.isArray(v)) return v; const o = {}; for (const k of Object.keys(v).sort()) o[k] = v[k]; return o; };
  const canonKey = (c, d) => (c ? 'c' : 'r') + JSON.stringify(JSON.parse(d), (k, v) => v && typeof v === 'object' ? sortKeys(v) : v);
  const notePipe = (desc, compute) => {
    if (!opts.recordPipes && !warmKeys.size) return;
    const d = serDesc(desc), key = (compute ? 'c' : 'r') + d;
    if (warmKeys.has(key)) stats.warmHit = (stats.warmHit || 0) + 1;
    else if (warmKeys.size) { stats.warmMiss = (stats.warmMiss || 0) + 1;
      if (warmByShaders && missLogged < 12) try { missLogged++; const cand = warmByShaders.get((compute ? 'c' : 'r') + shaderSet(d));
        if (!cand) { const hs = d.match(/"wgsl":"([0-9a-f]+)"/g).map(x => x.slice(8, -1)), known = hs.map(h => warmByShaders.has('h' + h));
          log('[warm] miss: shader combination not in the list (' + hs.map((h, i) => h + (known[i] ? '' : ' NEW')).join(', ') + ')');
          for (let i = 0; i < hs.length && missLogged <= 3; i++) if (!known[i]) log('[warm] new shader ' + hs[i] + ' starts: ' + JSON.stringify(moduleSrcByHash(hs[i]).slice(0, 300))); }
        else { const a = JSON.parse(d), b = JSON.parse(cand), diffs = [];
          const walk = (x, y, path) => { if (diffs.length > 6) return; if (JSON.stringify(x) === JSON.stringify(y)) return;
            if (x && y && typeof x === 'object' && typeof y === 'object') { for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) walk(x[k], y[k], path + '.' + k); return; }
            diffs.push(path + ': ' + JSON.stringify(x) + ' vs manifest ' + JSON.stringify(y)); };
          walk(a, b, ''); log(diffs.length ? '[warm] miss: same shaders, different state: ' + diffs.join('; ').slice(0, 600) : '[warm] miss: in the list, but needed before its background compile finished'); } } catch (e) { log('[warm] miss diagnostic failed: ' + e.message); } }
    if (opts.recordPipes && !recKeys.has(key)) { recKeys.add(key); recPipes.push({ c: compute ? 1 : 0, d }); } };
  const exportPipes = () => { const shaders = {}; for (const p of recPipes) for (const m of p.d.matchAll(/"wgsl":"([0-9a-f]+)"/g)) shaders[m[1]] = recShaders[m[1]];
    return { v: 1, shaders, pipes: recPipes }; };
  const prewarm = (man, { inFlight = 2, onDone } = {}) => {
    const bad = [!caps.norm16 && '16unorm"', !caps.norm16 && '16snorm"', !caps.d32s8 && 'depth32float-stencil8', !caps.rg11b10rt && '"rg11b10ufloat"', !caps.clipCtl && 'unclippedDepth'].filter(Boolean);
    const badStorage = d => { for (const m of d.matchAll(/"storageTexture":\{[^}]*"format":"([\w-]+)"/g)) if (!storageOK(m[1])) return true; return false; };
    if (bad.length || !caps.tier1) { const n0 = man.pipes.length; man = { ...man, pipes: man.pipes.filter(p => !bad.some(s => p.d.includes(s)) && !badStorage(p.d)) };
      if (man.pipes.length < n0) log('[warm] ' + (n0 - man.pipes.length) + ' of ' + n0 + ' listed pipelines need features this device lacks: not prewarmed'); }
    const mods = new Map(), bgls = new Map(), pls = new Map();
    const mod = h => { let m = mods.get(h); if (!m) { m = mkModule(man.shaders[h]); mods.set(h, m); } return m; };
    const bgl = L => { const k = JSON.stringify(L); let b = bgls.get(k); if (!b) { b = device.createBindGroupLayout({ entries: L }); bgls.set(k, b); } return b; };
    const pl = Ls => { const k = JSON.stringify(Ls); let p = pls.get(k); if (!p) { p = device.createPipelineLayout({ bindGroupLayouts: Ls.map(bgl) }); plSrc.set(p, Ls); pls.set(k, p); } return p; };
    const revive = v => Array.isArray(v) ? v.map(revive) : v && typeof v === 'object' ? (v.wgsl ? mod(v.wgsl) : v.bgl ? pl(v.bgl) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, revive(x)]))) : v;
    warmByShaders = new Map(); for (const p of man.pipes) { const k = (p.c ? 'c' : 'r') + shaderSet(p.d); if (!warmByShaders.has(k)) warmByShaders.set(k, p.d); p.key = canonKey(p.c, p.d); }
    for (const h in man.shaders) warmByShaders.set('h' + h, 1);
    const t0 = now(); let i = 0, done = 0, ok = 0;
    const next = () => {
      if (i >= man.pipes.length) { if (done === man.pipes.length && onDone) { onDone({ n: done, ok, ms: now() - t0 }); onDone = null; } return; }
      const p = man.pipes[i++], key = p.key; let desc;
      try { desc = revive(JSON.parse(p.d)); } catch (e) { done++; next(); return; }
      (p.c ? device.createComputePipelineAsync(desc) : device.createRenderPipelineAsync(desc))
        .then(q => { warm.push(q); warmKeys.add(key); ok++; }, e => warn('prewarm: pipeline failed: ' + String(e && e.message || e).split(String.fromCharCode(10))[0]))
        .then(() => { done++; next(); }); };
    if (!man.pipes.length && onDone) onDone({ n: 0, ok: 0, ms: 0 });
    for (let k = 0; k < inFlight; k++) next(); };
  const badPipes = new WeakSet();
  const pipeWait = new Set();
  const getPipe = (key, mk) => {
    const p = pipeCache.get(key); if (p) return p;
    if (pipeWait.has(key)) return null;
    const { desc, compute } = mk(); stats.nPipe++;
    if (!opts.asyncPipelines || !device.createRenderPipelineAsync) { const t0 = now(); device.pushErrorScope('validation'); const q = compute ? device.createComputePipeline(desc) : device.createRenderPipeline(desc);
      device.popErrorScope().then(e => { if (e) { badPipes.add(q); warn('pipeline rejected by this device, its draws are skipped: ' + e.message.split(String.fromCharCode(10))[0]); } }); pipeCache.set(key, q); const dt = now() - t0; stats.tPipe += dt; notePipe(desc, compute); if (opts.onPipe) opts.onPipe({ key, desc, dt, compute, src: m => moduleSrc.get(m) }); return q; }
    pipeWait.add(key); const t0 = now();
    (compute ? device.createComputePipelineAsync(desc) : device.createRenderPipelineAsync(desc))
      .then(q => { pipeCache.set(key, q); pipeWait.delete(key); stats.tPipeAsync = (stats.tPipeAsync || 0) + now() - t0; },
        e => warn('pipeline compile failed: ' + String(e && e.message || e).split(String.fromCharCode(10))[0]));
    return null; };
  const errors = []; let cmdIndex = -1;
  const warned = new Set(); const warn = m => { if (!warned.has(m)) { warned.add(m); log('[gpu11] ' + m); } };

  let stateVer = 0, bindVer = 0, pipeVer = 0, drawCache = null, lastBump = '';
  const defineObj = o => { if (objs.has(o.id)) { stateVer++; lastBump = 'redefine'; prepMap.clear(); } objs.set(o.id, o); };
  const prepMap = new Map();
  const drawSig = c => { let k = c.op + '|' + S.sh.vs + ',' + S.sh.ps + ',' + S.sh.gs + ',' + S.sh.hs + ',' + S.sh.ds + '|' + S.layout + '|' + S.topo + '|' + S.ib.fmt + '|' + S.rtv.join(',') + '|' + S.dsv + '|' + S.omUav.join(',') + '|';
    for (let i = 0; i < S.vb.length; i++) { const v = S.vb[i]; k += (v ? v.stride : '-') + ','; } return k; };
  const align = (n, a) => Math.ceil(n / a) * a;
  const getBuf = o => {
    if (o.gbuf) return o.gbuf;
    const size = align(Math.max(o.info.size, 16), 16), alloc = o.info.bind & 4 ? Math.max(size, 65536) : size;
    o.gbuf = device.createBuffer({ size: alloc, usage: GU.COPY_SRC | GU.COPY_DST | GU.INDEX | GU.VERTEX | GU.UNIFORM | GU.STORAGE | GU.INDIRECT });
    if (o.data) writeBuf(o, 0, o.data);
    return o.gbuf;
  };
  const writeBuf = (o, off, data) => { const n = align(data.length, 4); let d = data; if (n !== data.length) { d = new Uint8Array(n); d.set(data); }
    qWriteBuffer(o.gbuf, off & ~3, d.buffer, d.byteOffset, d.byteLength); };
  const texFormat = o => {
    if (o.gfmt) return o.gfmt;
    const t = o.info; let f = t.format;
    let want;
    if (t.bind & 0x40) want = DEPTH_OF[f] || TEXFMT[f] || 'depth32float';
    else { if (TYPELESS.has(f)) { for (const v of objs.values()) if (v.info && v.info.res === o.id && v.info.format && !TYPELESS.has(v.info.format)) { f = v.info.format; break; } }
      want = TEXFMT[f] || 'rgba8unorm'; }
    o.gfmt = fallbackFmt(want, t); if (o.gfmt !== want) o.srcFmt = want;
    return o.gfmt;
  };
  const srgbPair = f => f.endsWith('-srgb') ? f.slice(0, -5) : (/^(rgba8unorm|bgra8unorm|bc[1237]-rgba-unorm)$/.test(f) ? f + '-srgb' : null);
  const getTex = o => {
    if (o.gtex) return o.gtex;
    const t = o.info, fmt = texFormat(o), cube = t.misc & 4;
    let usage = TU.COPY_SRC | TU.COPY_DST | TU.TEXTURE_BINDING;
    if ((t.bind & 0x60) && !isBC(fmt)) usage |= TU.RENDER_ATTACHMENT;
    if ((t.bind & 0x80) && !isDepth(fmt) && t.samples <= 1 && storageOK(fmt)) usage |= TU.STORAGE_BINDING;
    if (t.backbuffer) usage |= TU.RENDER_ATTACHMENT;
    const pair = srgbPair(fmt);
    o.gtex = device.createTexture({ size: [t.w, t.h, t.dim === 3 ? t.depth : t.array], mipLevelCount: t.mips, sampleCount: t.samples > 1 ? 4 : 1,
      dimension: t.dim === 3 ? '3d' : '2d', format: fmt, usage, viewFormats: pair ? [pair] : [] });
    o.cube = !!cube;
    if (o.subs) o.subs.forEach((b, s) => { if (b) writeSub(o, s, b, null); });
    return o.gtex;
  };
  const blockOf = f => isBC(f) ? (/bc[14]/.test(f) ? 8 : 16) : 0;
  const bppOf = f => ({ rgba32float: 16, rgba32uint: 16, rgba32sint: 16, rgba16float: 8, rgba16unorm: 8, rgba16uint: 8, rgba16snorm: 8, rgba16sint: 8, rg32float: 8, rg32uint: 8, rg32sint: 8,
    r8unorm: 1, r8uint: 1, r8snorm: 1, r8sint: 1, rg8unorm: 2, rg8uint: 2, rg8snorm: 2, rg8sint: 2, r16float: 2, r16unorm: 2, r16uint: 2, r16snorm: 2, r16sint: 2, depth16unorm: 2 })[f] || 4;
  const writeSub = (o, s, data, box) => {
    const t = o.info, mip = s % t.mips, layer = Math.floor(s / t.mips), f = texFormat(o), sf = o.srcFmt || f;
    if (isDepth(f)) { warn('skip upload to depth texture ' + o.id); return; }
    const w = Math.max(1, t.w >> mip), h = Math.max(1, t.h >> mip), d = t.dim === 3 ? Math.max(1, t.depth >> mip) : 1, blk = blockOf(sf);
    const b = box || [0, 0, 0, w, h, d], bw = b[3] - b[0], bh = b[4] - b[1], bd = b[5] - b[2];
    if (t.format === 65) { const x = new Uint8Array(data.length * 4); for (let i = 0; i < data.length; i++) x[4 * i + 3] = data[i]; data = x; }
    if (sf !== f) {
      const t0 = now(); let out, ow = bw, oh = bh;
      if (blk) { const aw = align(bw, 4), ah = align(bh, 4), slice = (aw / 4) * (ah / 4) * blk; ow = Math.min(aw, w - b[0]); oh = Math.min(ah, h - b[1]);
        const bpp = bppOf(f), parts = [];
        for (let z = 0; z < bd; z++) { const px = bcdec.decode(sf, data.subarray(z * slice, (z + 1) * slice), aw, ah), p8 = new Uint8Array(px.buffer, px.byteOffset, px.byteLength);
          if (ow === aw && oh === ah) parts.push(p8); else { const c = new Uint8Array(ow * oh * bpp); for (let y = 0; y < oh; y++) c.set(p8.subarray(y * aw * bpp, (y * aw + ow) * bpp), y * ow * bpp); parts.push(c); } }
        if (parts.length === 1) out = parts[0]; else { out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let at = 0; for (const p of parts) { out.set(p, at); at += p.length; } } }
      else { const px = convertTexels(sf, f, data, bw * bh * bd); if (!px) { warn('no upload conversion ' + sf + ' -> ' + f + ' (texture ' + o.id + ')'); return; } out = new Uint8Array(px.buffer, px.byteOffset, px.byteLength); }
      stats.tConvert = (stats.tConvert || 0) + now() - t0; stats.nConvert = (stats.nConvert || 0) + 1;
      qWriteTexture({ texture: o.gtex, mipLevel: mip, origin: [b[0], b[1], t.dim === 3 ? b[2] : layer] }, out, { bytesPerRow: ow * bppOf(f), rowsPerImage: oh }, [ow, oh, bd]);
      return; }
    const rowBytes = blk ? Math.ceil(bw / 4) * blk : bw * bppOf(f), rows = blk ? Math.ceil(bh / 4) : bh;
    const cw = blk ? align(bw, 4) : bw, chh = blk ? align(bh, 4) : bh;
    qWriteTexture({ texture: o.gtex, mipLevel: mip, origin: [b[0], b[1], t.dim === 3 ? b[2] : layer] }, data, { bytesPerRow: rowBytes, rowsPerImage: rows }, [cw, chh, bd]);
  };

  const resOf = v => objs.get(v.info.res);
  const viewFmt = (v, r) => { const f = v.info.format, base = texFormat(r);
    if (!f || TYPELESS.has(f) || isDepth(base)) return base;
    const m0 = TEXFMT[f], m = m0 && fallbackFmt(m0, r.info);
    return m && (m === base || m === srgbPair(base)) ? m : base; };
  const srvView = (v, dim) => {
    const key = 'sv_' + dim; if (v[key]) return v[key];
    const r = resOf(v); if (!r || !r.info || r.info.type !== 'tex') return null;
    const tex = getTex(r), a = v.info.args || [], vd = v.info.vdim, t = r.info, f = viewFmt(v, r);
    let baseMip = a[0] || 0, mips = a[1], baseLayer = 0, layers;
    if (vd === 5 || vd === 3) { baseLayer = a[2] || 0; layers = a[3]; }
    if (vd === 10) { baseLayer = a[2] || 0; layers = (a[3] || 1) * 6; }
    if (!mips || mips === 0xffffffff) mips = t.mips - baseMip;
    const total = t.dim === 3 ? 1 : t.array;
    if (!layers || layers === 0xffffffff) layers = total - baseLayer;
    if (dim === '2d') layers = 1; if (dim === 'cube') layers = 6; if (dim === '3d') { baseLayer = 0; layers = 1; }
    const desc = { dimension: dim === 'ms2d' ? '2d' : dim === '2darray' ? '2d-array' : dim === 'cubearray' ? 'cube-array' : dim, format: f, baseMipLevel: baseMip, mipLevelCount: Math.max(1, Math.min(mips, t.mips - baseMip)) };
    if (dim !== '3d') { desc.baseArrayLayer = baseLayer; desc.arrayLayerCount = Math.max(1, layers); }
    if (isDepth(f)) { desc.aspect = (v.info.format === 47 || v.info.format === 22) ? 'stencil-only' : 'depth-only';
      desc.format = desc.aspect === 'stencil-only' ? 'stencil8' : f === 'depth24plus-stencil8' ? 'depth24plus' : f === 'depth32float-stencil8' ? 'depth32float' : f; }
    if (dim === 'ms2d') delete desc.mipLevelCount;
    v[key] = tex.createView(desc); v.sampleType = isDepth(f) ? (desc.aspect === 'stencil-only' ? 'uint' : 'depth') : sampleTypeOf(f); v.fmt = f;
    return v[key];
  };
  const attView = v => {
    if (v.att) return v.att;
    const r = resOf(v); if (!r) return null; const tex = getTex(r), a = v.info.args || [], vd = v.info.vdim, isDsv = v.info.type === 'dsv', t = r.info;
    let mip = a[0] || 0, layer = 0, slice;
    if (!isDsv && (vd === 5 || vd === 3)) layer = a[1] || 0;
    if (isDsv && (vd === 4 || vd === 2)) layer = a[1] || 0;
    if (!isDsv && vd === 8) slice = a[1] || 0;
    const f = isDsv ? texFormat(r) : viewFmt(v, r);
    const desc = { format: f, dimension: t.dim === 3 ? '3d' : '2d', baseMipLevel: mip, mipLevelCount: 1 };
    if (t.dim !== 3) { desc.baseArrayLayer = layer; desc.arrayLayerCount = 1; }
    v.att = tex.createView(desc); v.fmt = f; v.slice = slice; v.samples = t.samples > 1 ? 4 : 1; v.w = Math.max(1, t.w >> mip); v.h = Math.max(1, t.h >> mip);
    return v.att;
  };
  const uavTexView = v => {
    if (v.uv) return v.uv;
    const r = resOf(v); const tex = getTex(r), a = v.info.args || [], vd = v.info.vdim, t = r.info;
    const desc = { format: viewFmt(v, r), baseMipLevel: a[0] || 0, mipLevelCount: 1, dimension: t.dim === 3 ? '3d' : vd === 5 ? '2d-array' : '2d' };
    if (t.dim !== 3) { desc.baseArrayLayer = vd === 5 ? a[1] || 0 : 0; desc.arrayLayerCount = vd === 5 ? Math.max(1, a[2] || 1) : 1; }
    v.uv = tex.createView(desc); return v.uv;
  };
  let nCopiedViews = 0;
  const bufRange = (v, stride) => {
    const r = resOf(v); if (!r || r.info.type !== 'buf') return null; const buf = getBuf(r), a = v.info.args || [];
    const raw = v.info.vdim === 11 ? (a[2] & 1) : (v.info.type === 'uav' && (a[2] & 1));
    const es = raw ? 4 : (r.info.misc & 0x40) ? r.info.stride : (ELEM[v.info.format] || stride || 4);
    const off = (a[0] || 0) * es; let size = (a[1] || 0) * es; if (!size || off + size > buf.size) size = buf.size - off;
    size = Math.max(4, size & ~3);
    if (off % 256 === 0) return { buffer: buf, offset: off, size };
    warn('unaligned buffer view offset ' + off + ' (copying)'); nCopiedViews++;
    const tmp = device.createBuffer({ size: align(size, 4), usage: GU.STORAGE | GU.COPY_DST | GU.COPY_SRC });
    encoder().copyBufferToBuffer(buf, off, tmp, 0, align(size, 4));
    return { buffer: tmp, offset: 0, size };
  };
  const sampler = (o, cmp, filtering) => {
    const key = (o ? o.id : 0) + ':' + cmp + ':' + filtering; if (samplerCache.has(key)) return samplerCache.get(key);
    let desc = { addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge', addressModeW: 'clamp-to-edge', magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear' };
    if (o && o.info.raw) {
      const dv = new DataView(new Uint8Array(o.info.raw).buffer), F = dv.getUint32(0, true);
      desc = { addressModeU: ADDR[dv.getUint32(4, true)] || 'repeat', addressModeV: ADDR[dv.getUint32(8, true)] || 'repeat', addressModeW: ADDR[dv.getUint32(12, true)] || 'repeat',
        mipmapFilter: F & 1 ? 'linear' : 'nearest', magFilter: F & 4 ? 'linear' : 'nearest', minFilter: F & 0x10 ? 'linear' : 'nearest',
        lodMinClamp: Math.max(0, dv.getFloat32(44, true)), lodMaxClamp: Math.min(32, Math.max(0, dv.getFloat32(48, true))) };
      if ((F & 0x40) && dv.getUint32(20, true) > 1) { desc.maxAnisotropy = Math.min(16, dv.getUint32(20, true)); desc.magFilter = desc.minFilter = desc.mipmapFilter = 'linear'; }
      if (cmp) desc.compare = CMP[dv.getUint32(24, true)] || 'less';
    } else if (cmp) desc.compare = 'less';
    if (!filtering) { desc.magFilter = desc.minFilter = desc.mipmapFilter = 'nearest'; delete desc.maxAnisotropy; }
    if (desc.lodMaxClamp < desc.lodMinClamp) desc.lodMaxClamp = desc.lodMinClamp;
    const s = device.createSampler(desc); samplerCache.set(key, s); return s;
  };

  const dummies = {};
  const dummyTex = (dim, st) => {
    const key = dim + st; if (dummies[key]) return dummies[key];
    const fmt = st === 'uint' ? 'r32uint' : st === 'sint' ? 'r32sint' : st === 'depth' ? 'depth32float' : 'rgba8unorm';
    const t = device.createTexture({ size: [1, 1, dim === 'cube' || dim === 'cubearray' ? 6 : 1], format: fmt, dimension: dim === '3d' ? '3d' : '2d', usage: TU.TEXTURE_BINDING | TU.COPY_DST,
      sampleCount: dim === 'ms2d' ? 4 : 1, ...(dim === 'ms2d' ? { usage: TU.TEXTURE_BINDING | TU.RENDER_ATTACHMENT } : {}) });
    return (dummies[key] = t.createView({ dimension: dim === 'ms2d' ? '2d' : dim === '2darray' ? '2d-array' : dim === 'cubearray' ? 'cube-array' : dim }));
  };
  const emptyFS = () => dummies.fs || (dummies.fs = mkModule('@fragment fn main() {}'));
  const dummyBuf = () => dummies.buf || (dummies.buf = device.createBuffer({ size: 65536, usage: GU.UNIFORM | GU.STORAGE | GU.COPY_DST }));
  const dummyStorageTex = (fmt, dim) => { const key = 'st' + fmt + dim; if (dummies[key]) return dummies[key];
    const t = device.createTexture({ size: [1, 1, 1], format: fmt, dimension: dim === '3d' ? '3d' : '2d', usage: TU.STORAGE_BINDING });
    return (dummies[key] = t.createView({ dimension: dim === '3d' ? '3d' : dim === '2darray' ? '2d-array' : '2d' })); };

  const STAGES = ['vs', 'hs', 'ds', 'gs', 'ps', 'cs'];
  const fresh = () => { const s = { sh: {}, cb: {}, srv: {}, samp: {}, uav: new Array(8).fill(0), rtv: new Array(8).fill(0), dsv: 0, omUav: new Array(8).fill(0), layout: 0, vb: [], ib: { buf: 0, fmt: 0, off: 0 },
    topo: 4, vp: [], sc: [], blend: { s: 0, f: [1, 1, 1, 1], mask: 0xffffffff }, depth: { s: 0, ref: 0 }, raster: 0 };
    for (const st of STAGES) { s.sh[st] = 0; s.cb[st] = new Array(14).fill(0); s.srv[st] = new Array(128).fill(0); s.samp[st] = new Array(16).fill(0); } return s; };
  let S = fresh();
  const setState = st => { stateVer++; prepMap.clear(); S = fresh(); for (const k of Object.keys(st)) if (k !== 'cbOff') S[k] = JSON.parse(JSON.stringify(st[k])); };

  const hintsFor = (stage, sh, slots) => {
    const h = {}; const srvs = S.srv[stage], uavs = stage === 'cs' ? S.uav : S.omUav;
    const srvHint = i => { const v = objs.get(srvs[i]); if (v && v.info && v.info.format) h['t' + i] = { format: v.info.format }; };
    const uavHint = i => { const v = objs.get(uavs[i]); if (!v || !v.info) return; const r = resOf(v); const f = v.info.format && !TYPELESS.has(v.info.format) ? v.info.format : (r && r.info.format);
      h['u' + i] = { format: f }; if (r && r.info.type === 'tex') { h['u' + i].w = align(Math.max(1, r.info.w >> ((v.info.args || [])[0] || 0)), 64);
       h['u' + i].h = Math.max(1, r.info.h >> ((v.info.args || [])[0] || 0));
       if (texFormat(r) && r.srcFmt) h['u' + i].wfmt = texFormat(r); } };
    if (slots) { for (const k of slots) if (k[0] === 't') srvHint(+k.slice(1)); else uavHint(+k.slice(1)); }
    else { for (let i = 0; i < srvs.length; i++) srvHint(i); for (let i = 0; i < uavs.length; i++) uavHint(i); }
    return h;
  };
  const hintKey = hints => { let hk = ''; for (const k in hints) { const h = hints[k]; hk += k + ':' + h.format + (h.w ? 'x' + h.w + 'x' + h.h : '') + (h.wfmt ? '>' + h.wfmt : '') + ','; } return hk; };
  const getShader = (id, stage, link, outInterp, io) => {
    const o = objs.get(id); if (!o || !o.code) return null;
    const hints = hintsFor(stage, o, o.hintSlots);
    let ik = ''; if (outInterp) for (const k in outInterp) ik += k + ':' + outInterp[k] + ','; if (io) ik += 'io' + JSON.stringify(io);
    const tail = '|' + (link ? gid(link) : '') + '|' + ik + '|' + stage, key = id + '|' + hintKey(hints) + tail;
    if (shaderCache.has(key)) return shaderCache.get(key);
    let r;
    const t0 = now();
    try { r = translate(o.code, { hints, vsOutputs: link, outInterp, limits: device.limits, ...(io || {}) }); }
    catch (e) { warn('translate failed for shader ' + id + ' (' + stage + '): ' + e.message); shaderCache.set(key, null); return null; }
    if (r.fit && (r.fit.merged.length || r.fit.dropped.length || r.fit.scalar)) warn('shader ' + id + ' (' + stage + ') over the device limits: ' + [r.fit.merged.length && r.fit.merged.length + ' read-only buffers merged into one', r.fit.dropped.length && r.fit.dropped.length + ' texture(s) dropped (t' + r.fit.dropped.join(', t') + ')', r.fit.scalar && 'registers scalarized (no room for uniform-load scratch)'].filter(Boolean).join('; '));
    r.module = mkModule(r.wgsl); r.id = id; stats.tShader += now() - t0; stats.nShader++;
    shaderCache.set(key, r);
    if (!o.hintSlots) {
      o.hintSlots = r.bindings.filter(b => b.kind.startsWith('srv_') || b.kind.startsWith('uav_')).map(b => (b.kind[0] === 's' ? 't' : 'u') + b.slot);
      shaderCache.set(id + '|' + hintKey(hintsFor(stage, o, o.hintSlots)) + tail, r); }
    return r;
  };

  const stageBindings = (sh, stage, vis, acc, ctx) => {
    const srvs = S.srv[stage], samps = S.samp[stage], cbs = S.cb[stage], uavs = stage === 'cs' ? S.uav : S.omUav;
    const unfilt = new Set();
    for (const b of sh.bindings) if (b.kind === 'srv_tex') { const v = objs.get(srvs[b.slot]); if (v) srvView(v, b.dim); const st = v && v.sampleType;
      if (st && st !== 'float' || (v && unfilterable(v.fmt || ''))) for (const [t, s] of sh.pairs) if (t === b.slot) unfilt.add(s); }
    for (const b of sh.bindings) {
      const L = { binding: b.binding, visibility: vis }; let res;
      if (b.kind === 'cb') { const o = objs.get(cbs[b.slot]), sz = Math.max(b.size, 16);
        if (o && o.info.bind & 4 && (ctx.nDyn = (ctx.nDyn || 0) + 1) <= maxDyn) { const off = cbSlice(o, sz); L.buffer = { type: 'uniform', hasDynamicOffset: true }; res = { buffer: cbRing, offset: 0, size: sz };
          (acc.dyn[b.group] = acc.dyn[b.group] || []).push([b.binding, off, stage, b.slot, sz]); }
        else { L.buffer = { type: 'uniform' }; if (o && o.info.bind & 4) (acc.fb = acc.fb || []).push([stage, b.slot, o]); if (o && o.cbShadow && o.gbufVer !== o.cbVer) { getBuf(o); writeBuf(o, 0, o.cbShadow); o.gbufVer = o.cbVer; }
          res = { buffer: o ? getBuf(o) : dummyBuf(), offset: 0, size: sz }; if (res.size > res.buffer.size) res.size = res.buffer.size; } }
      else if (b.kind === 'srv_tex') {
        const v = objs.get(srvs[b.slot]); let view = v ? srvView(v, b.dim) : null, st = v && v.sampleType;
        if (v && ctx.attached.has(v.info.res)) { view = null; warn('SRV of a bound render target replaced by dummy'); }
        if (b.depth && st !== 'depth') view = null;
        if (b.depth) st = 'depth';
        else if (st === 'depth') st = 'unfilterable-float';
        else if (st === 'float' && v && unfilterable(v.fmt)) st = 'unfilterable-float';
        if (st === 'float' && [...unfilt].length && sh.pairs.every(([t]) => t !== b.slot)) {}
        const want = b.ret === 'u' ? 'uint' : b.ret === 'i' ? 'sint' : null;
        if (want && st !== want) { view = null; st = want; }
        if (ctx.tr) ctx.tr.push(stage + 't' + b.slot + '=' + (v ? v.info.res : '-') + (view ? '' : '(DUMMY)'));
        if (!view) { st = b.depth ? 'depth' : want || 'float'; view = dummyTex(b.dim, st === 'float' ? 'float' : st); }
        if (st === 'float' && sh.pairs.some(([t, s]) => t === b.slot && unfilt.has(s))) st = 'unfilterable-float';
        L.texture = { sampleType: st, viewDimension: b.dim === 'ms2d' ? '2d' : b.dim === '2darray' ? '2d-array' : b.dim === 'cubearray' ? 'cube-array' : b.dim, multisampled: b.dim === 'ms2d' };
        res = view;
      }
      else if (b.kind === 'srv_merged' || b.kind === 'srv_merged_ofs') { const m = mergedSrv(b.slots, srvs, ctx);
        if (b.kind === 'srv_merged') { L.buffer = { type: 'read-only-storage' }; res = { buffer: m.buf, offset: 0, size: m.size }; } else { L.buffer = { type: 'uniform' }; res = { buffer: m.ofs, offset: 0, size: b.slots.length * 16 }; } }
      else if (b.kind.startsWith('srv_')) { const v = objs.get(srvs[b.slot]); L.buffer = { type: 'read-only-storage' };
        res = (v && bufRange(v, b.stride)) || { buffer: dummyBuf(), offset: 0, size: 65536 }; }
      else if (b.kind === 'sampler') { const o = objs.get(samps[b.slot]), filt = !unfilt.has(b.slot);
        L.sampler = { type: b.cmp ? 'comparison' : filt ? 'filtering' : 'non-filtering' }; res = sampler(o, b.cmp, b.cmp ? true : filt); }
      else if (b.kind === 'uav_tex') { const v = objs.get(uavs[b.slot]);
        L.storageTexture = { access: b.access === 'read_write' ? 'read-write' : 'write-only', format: b.format, viewDimension: b.dim === '3d' ? '3d' : b.dim === '2darray' ? '2d-array' : '2d' };
        let view = null; if (v) { const r = resOf(v); if (r && r.info.type === 'tex' && texFormat(r) === b.format && (getTex(r).usage & TU.STORAGE_BINDING)) view = uavTexView(v); else warn('UAV ' + (v.id) + ' format/usage mismatch (' + (r && texFormat(r)) + ' vs ' + b.format + ')'); }
        res = view || dummyStorageTex(b.format, b.dim); if (ctx.tr) ctx.tr.push(stage + 'u' + b.slot + '=' + (v ? resOf(v) && resOf(v).id : '-') + (view ? '' : '(DUMMY)')); if (view && tracing) frameTargets.set(resOf(v).id, (frameTargets.get(resOf(v).id) || 0) + 1); }
      else { const v = objs.get(uavs[b.slot]); L.buffer = { type: 'storage' };
        if (b.kind === 'uav_tex_as_buffer') { warn('typed UAV texture used with atomics: bound as a scratch buffer'); res = { buffer: scratchFor(v, b), offset: 0 }; if (ctx.scratch && v) ctx.scratch.push({ v, buf: res.buffer }); if (ctx.tr) ctx.tr.push(stage + 'u' + b.slot + '=' + (v ? resOf(v) && resOf(v).id : '-') + '(SCRATCH)'); }
        else res = (v && bufRange(v, b.stride)) || { buffer: dummyBuf(), offset: 0, size: 65536 }; }
      (acc.layout[b.group] = acc.layout[b.group] || []).push(L);
      (acc.entries[b.group] = acc.entries[b.group] || []).push({ binding: b.binding, resource: res.createView === undefined && res.buffer ? res : res });
    }
  };
  const mergeBufs = new Map(), mergeOfs = new Map();
  const mergedSrv = (slots, srvs, ctx) => {
    if (ctx.merge) return ctx.merge;
    const parts = slots.map(sl => { const v = objs.get(srvs[sl]); return (v && bufRange(v, 4)) || null; });
    let size = 0; const words = []; for (const p of parts) { const n = p ? p.size : 65536; words.push([size / 4, n / 4]); size += align(n, 256); }
    size = Math.max(size, 256); const mk = slots.join(',');
    let buf = mergeBufs.get(mk); if (!buf || buf.size < size) { buf = device.createBuffer({ size: align(Math.ceil(size * 1.25), 256), usage: GU.STORAGE | GU.COPY_DST }); mergeBufs.set(mk, buf); }
    const ok = words.map(w => w.join(':')).join(','); let ofs = mergeOfs.get(ok);
    if (!ofs) { ofs = device.createBuffer({ size: slots.length * 16, usage: GU.UNIFORM | GU.COPY_DST }); const a = new Uint32Array(slots.length * 4); words.forEach((w, i) => { a[i * 4] = w[0]; a[i * 4 + 1] = w[1]; });
      device.queue.writeBuffer(ofs, 0, a); if (mergeOfs.size > 4096) mergeOfs.clear(); mergeOfs.set(ok, ofs); }
    ctx.copies = parts.map((p, i) => ({ p, dst: words[i][0] * 4, n: words[i][1] * 4 }));
    return (ctx.merge = { buf, ofs, size: buf.size }); };
  const scratch = new Map();
  const scratchFor = (v, b) => { const k = v ? v.id : 0; if (!scratch.has(k)) scratch.set(k, device.createBuffer({ size: align(Math.max(16, (b.w || 1) * (b.h || 1) * 4), 16), usage: GU.STORAGE | GU.COPY_DST | GU.COPY_SRC })); return scratch.get(k); };
  const bglCache = new Map(), plCache = new Map(), bgCache = new Map(), gpuIds = new WeakMap(); let nextGpuId = 1;
  const gid = o => { let i = gpuIds.get(o); if (!i) { i = nextGpuId++; gpuIds.set(o, i); } return i; };
  const layoutKey = L => { let k = ''; for (const e of L) { k += e.binding + '/' + e.visibility;
      if (e.buffer) k += 'b' + e.buffer.type + (e.buffer.hasDynamicOffset ? 'd' : ''); else if (e.texture) k += 't' + e.texture.sampleType + e.texture.viewDimension + (e.texture.multisampled ? 'm' : '');
      else if (e.sampler) k += 's' + e.sampler.type; else if (e.storageTexture) k += 'S' + e.storageTexture.access + e.storageTexture.format + e.storageTexture.viewDimension; k += ';'; } return k; };
  const makeGroups = acc => {
    const layouts = [], groups = [], lkeys = [];
    if (bgCache.size > 50000) bgCache.clear();
    for (let g = 0; g < 4; g++) {
      const L = (acc.layout[g] || []).sort((a, b) => a.binding - b.binding), E = (acc.entries[g] || []).sort((a, b) => a.binding - b.binding);
      const lk = layoutKey(L); let bgl = bglCache.get(lk); if (!bgl) { bgl = device.createBindGroupLayout({ entries: L }); bglCache.set(lk, bgl); }
      layouts.push(bgl); lkeys.push(lk);
      const ek = lk + '|' + E.map(e => { const r = e.resource; return e.binding + ':' + (r.buffer ? 'b' + gid(r.buffer) + '+' + (r.offset || 0) + '/' + (r.size === undefined ? '' : r.size) : gid(r)); }).join(',');
      let bg = bgCache.get(ek); if (!bg) { bg = device.createBindGroup({ layout: bgl, entries: E }); bgCache.set(ek, bg); }
      groups.push(bg);
    }
    const pk = lkeys.join('#'); let pl = plCache.get(pk); if (!pl) { pl = device.createPipelineLayout({ bindGroupLayouts: layouts }); plSrc.set(pl, lkeys.map((_, g) => acc.layout[g] || [])); plCache.set(pk, pl); }
    const srt = groups.map((g, i) => (acc.dyn[i] || []).sort((a, b) => a[0] - b[0]));
    return { layouts, groups, pipelineLayout: pl, dyn: srt.map(l => l.map(x => x[1])), dynSrc: srt.map(l => l.map(x => [x[2], x[3], x[4]])), fb: acc.fb || [] };
  };

  const blendTargets = (formats, psOut) => {
    const o = objs.get(S.blend.s), raw = o && o.info.raw ? new DataView(new Uint8Array(o.info.raw).buffer) : null;
    const indep = raw ? raw.getUint32(4, true) : 0;
    return formats.map((f, i) => {
      if (!f) return null;
      const written = psOut && psOut.some(x => x.loc === i);
      const tgt = { format: f, writeMask: written ? 0xf : 0 };
      if (raw) { const b = 8 + 32 * (indep ? i : 0), en = raw.getUint32(b, true), mask = raw.getUint8(b + 28);
        if (written) tgt.writeMask = mask & 0xf;
        const blendable = !/uint|sint|32float/.test(f) || (/32float/.test(f) && false);
        if (en && blendable) {
          const fac = k => BLEND[raw.getUint32(b + k, true)] || 'one', op = k => BLENDOP[raw.getUint32(b + k, true)] || 'add';
          const c = { srcFactor: fac(4), dstFactor: fac(8), operation: op(12) }, a = { srcFactor: fac(16), dstFactor: fac(20), operation: op(24) };
          for (const x of [c, a]) if (x.operation === 'min' || x.operation === 'max') x.srcFactor = x.dstFactor = 'one';
          tgt.blend = { color: c, alpha: a };
        } }
      return tgt;
    });
  };
  const rasterState = () => { const o = objs.get(S.raster); if (o && o._rs) return o._rs; const r = { fill: 3, cull: 3, ccw: 0, bias: 0, biasClamp: 0, slope: 0, clip: 1, scissor: 0 };
    if (o && o.info.raw) { const d = new DataView(new Uint8Array(o.info.raw).buffer); Object.assign(r, { fill: d.getUint32(0, true), cull: d.getUint32(4, true), ccw: d.getUint32(8, true),
      bias: d.getInt32(12, true), biasClamp: d.getFloat32(16, true), slope: d.getFloat32(20, true), clip: d.getUint32(24, true), scissor: d.getUint32(28, true) }); }
    if (o) o._rs = r;
    return r; };
  const depthState = (fmt, rs) => {
    if (!fmt) return undefined;
    const o = objs.get(S.depth.s); let st = { depthWriteEnabled: true, depthCompare: 'less' };
    if (o && o.info.raw) { const d = new DataView(new Uint8Array(o.info.raw).buffer), en = d.getUint32(0, true);
      st = { depthWriteEnabled: !!(en && d.getUint32(4, true)), depthCompare: en ? (CMP[d.getUint32(8, true)] || 'less') : 'always' };
      if (d.getUint32(12, true) && hasStencil(fmt)) { const face = k => ({ failOp: STENCILOP[d.getUint32(k, true)] || 'keep', depthFailOp: STENCILOP[d.getUint32(k + 4, true)] || 'keep',
        passOp: STENCILOP[d.getUint32(k + 8, true)] || 'keep', compare: CMP[d.getUint32(k + 12, true)] || 'always' });
        st.stencilFront = face(20); st.stencilBack = face(36); st.stencilReadMask = d.getUint8(16); st.stencilWriteMask = d.getUint8(17); } }
    st.format = fmt;
    if (rs.bias || rs.slope) { st.depthBias = rs.bias; st.depthBiasSlopeScale = rs.slope; st.depthBiasClamp = rs.biasClamp; }
    return st;
  };
  const vertexBuffers = vs => {
    const lay = objs.get(S.layout), out = [];
    if (!lay || !lay.info.els) return out;
    const running = {};
    for (const e of lay.info.els) {
      const off = e.offset === 0xffffffff ? (running[e.slot] || 0) : e.offset; const fmt = VTXFMT[e.format];
      running[e.slot] = off + (VTXSIZE[fmt] || 4);
      const inp = vs.inputs.find(x => x.name.toUpperCase() === e.name.toUpperCase() && x.index === e.index);
      if (!inp) continue;
      if (!fmt) { warn('vertex format ' + e.format + ' unsupported'); continue; }
      let slot = out.find(b => b.slot === e.slot);
      if (!slot) { const vb = S.vb[e.slot] || { stride: 0 }; slot = { slot: e.slot, arrayStride: vb.stride, stepMode: e.cls === 1 ? 'instance' : 'vertex', attributes: [] }; out.push(slot); }
      slot.attributes.push({ shaderLocation: inp.loc, offset: off, format: fmt });
    }
    for (const inp of vs.inputs) if (!out.some(b => b.attributes.some(a => a.shaderLocation === inp.loc))) {
      out.push({ slot: -1, arrayStride: 0, stepMode: 'vertex', attributes: [{ shaderLocation: inp.loc, offset: 0, format: inp.type === 'u' ? 'uint32x4' : inp.type === 'i' ? 'sint32x4' : 'float32x4' }] }); }
    return out;
  };

  const TS_MAX = 4096, tsOn = !!opts.gpuTiming && device.features.has('timestamp-query');
  const ts = tsOn ? { set: device.createQuerySet({ type: 'timestamp', count: TS_MAX }), res: device.createBuffer({ size: TS_MAX * 8, usage: GU.QUERY_RESOLVE | GU.COPY_SRC }),
    rd: device.createBuffer({ size: TS_MAX * 8, usage: GU.MAP_READ | GU.COPY_DST }), n: 0, labels: [], busy: false, active: false, agg: new Map(), frames: 0, presents: 0, tot: 0, pend: null } : null;
  const tsWrites = label => { if (!ts || !ts.active || ts.n + 2 > TS_MAX) return undefined; const i = ts.n; ts.n += 2; ts.labels.push(label);
    return { querySet: ts.set, beginningOfPassWriteIndex: i, endOfPassWriteIndex: i + 1 }; };
  const tsBeforePresent = () => { if (!ts) return; ts.presents++;
    if (ts.active && ts.n) { const enc = encoder(); enc.resolveQuerySet(ts.set, 0, ts.n, ts.res, 0); enc.copyBufferToBuffer(ts.res, 0, ts.rd, 0, ts.n * 8); ts.busy = true; ts.pend = { labels: ts.labels, n: ts.n }; }
    ts.active = false; ts.n = 0; ts.labels = []; };
  const tsAfterPresent = () => { if (!ts) return;
    if (ts.pend) { const { labels, n } = ts.pend; ts.pend = null;
      ts.rd.mapAsync(1, 0, n * 8).then(() => { const t = new BigUint64Array(ts.rd.getMappedRange(0, n * 8).slice(0)); ts.rd.unmap();
        for (let k = 0; k < labels.length; k++) { const d = Number(t[2 * k + 1] - t[2 * k]) / 1e6; if (d > 0 && d < 1000) { ts.tot += d; ts.agg.set(labels[k], (ts.agg.get(labels[k]) || 0) + d); } }
        ts.busy = false; if (++ts.frames % 10 === 0) { const f = 10, top = [...ts.agg].sort((a, b) => b[1] - a[1]).slice(0, 15);
          log('[gputime] ' + (ts.tot / f).toFixed(1) + ' ms GPU per frame (' + labels.length + ' passes); top: ' + top.map(([k, v]) => (v / f).toFixed(2) + 'ms ' + k).join(' | ')); ts.agg = new Map(); ts.tot = 0; } },
        e => { ts.busy = false; log('[gputime] read failed: ' + e.message); }); }
    if (!ts.busy && ts.presents % 5 === 0) ts.active = true; };

  let shared = null;
  const UP_SIZE = 32 << 20; let upRing = null, upOff = 0;
  const CB_RING = 32 << 20; let cbRingGen = 0, cbOff = 0; const maxDyn = device.limits.maxDynamicUniformBuffersPerPipelineLayout || 8;
  const cbRing = device.createBuffer({ size: CB_RING, usage: GU.UNIFORM | GU.COPY_DST });
  const cbCpu = new Uint8Array(CB_RING);
  const cbShadow = o => { if (!o.cbShadow) { o.cbShadow = new Uint8Array(align(Math.max(o.info.size, 16), 16)); if (o.data) o.cbShadow.set(o.data.subarray(0, o.cbShadow.length)); } return o.cbShadow; };
  const cbSlice = (o, bindSize) => {
    const sh = cbShadow(o), need = align(Math.max(sh.length, bindSize), 256);
    if (o.cbGen === cbRingGen && o.cbRes >= need) return o.cbOff;
    if (cbOff + need > CB_RING) flush();
    o.cbOff = cbOff; o.cbRes = need; o.cbGen = cbRingGen; cbOff += need;
    cbCpu.set(sh, o.cbOff);
    return o.cbOff; };
  const qWriteBuffer = (buf, off, data, dOff, size) => {
    const n = size !== undefined ? size : data.byteLength;
    if (!shared || n % 4 || off % 4) { flush(); device.queue.writeBuffer(buf, off, data, dOff, size); return; }
    if (!upRing) upRing = device.createBuffer({ size: UP_SIZE, usage: GU.COPY_SRC | GU.COPY_DST });
    if (upOff + n > UP_SIZE) { flush(); device.queue.writeBuffer(buf, off, data, dOff, size); return; }
    device.queue.writeBuffer(upRing, upOff, data, dOff, size); encoder().copyBufferToBuffer(upRing, upOff, buf, off, n); upOff += n;
  };
  const qWriteTexture = (...a) => { flush(); device.queue.writeTexture(...a); };
  const prep = o => o.info.type === 'buf' ? getBuf(o) : getTex(o);
  let open = null;
  const endPass = () => { if (!open) return; const P = open; open = null; P.pass.end(); if (P.deferred) replaySplit(P); };
  const RT_COST = f => /^r8/.test(f) ? [1, 1] : /^rg8/.test(f) ? [2, 1] : /^(rgba8|bgra8)(unorm|snorm)/.test(f) ? [8, 1] : /^rgba8/.test(f) ? [4, 1] : /^r16/.test(f) ? [2, 2]
    : /^rg16/.test(f) ? [4, 2] : /^rgba16/.test(f) ? [8, 2] : /^r32/.test(f) ? [4, 4] : /^rg32/.test(f) ? [8, 4] : /^rgba32/.test(f) ? [16, 4] : f === 'rgb10a2uint' ? [4, 4] : [8, 4];
  const splitTargets = formats => {
    const lim = device.limits.maxColorAttachmentBytesPerSample, idx = formats.map((f, i) => f ? i : -1).filter(i => i >= 0);
    const bytes = L => { let n = 0; for (const i of L) { const [c, a] = RT_COST(formats[i]); n = align(n, a) + c; } return n; };
    if (bytes(idx) <= lim) return null;
    const groups = []; let cur = [];
    for (const i of idx) { if (cur.length && bytes([...cur, i]) > lim) { groups.push(cur); cur = []; } cur.push(i); }
    groups.push(cur); return groups; };
  const pickIdx = (arr, g) => { const r = arr.map((x, i) => g.includes(i) ? x : null); let l = -1; r.forEach((x, i) => { if (x) l = i; }); return { arr: r, last: l }; };
  const followDepth = d => { const keep = { compare: 'always', failOp: 'keep', depthFailOp: 'keep', passOp: 'keep' };
    return { ...d, depthWriteEnabled: false, depthCompare: d.depthWriteEnabled ? 'equal' : d.depthCompare, ...(hasStencil(d.format) ? { stencilFront: keep, stencilBack: keep, stencilWriteMask: 0 } : {}) }; };
  const replaySplit = P => {
    const n = Math.max(...P.deferred.map(r => r.subs.length)), dsv = P.dsv;
    for (let k = 0; k < n; k++) {
      const s0 = P.deferred.find(r => r.subs[k]).subs[k];
      const pass = P.enc.beginRenderPass({ colorAttachments: s0.rtvs.slice(0, s0.last + 1).map(v => v ? { view: v.att, loadOp: 'load', storeOp: 'store' } : null),
        ...(dsv ? { depthStencilAttachment: { view: dsv.att, depthReadOnly: true, ...(hasStencil(dsv.fmt) ? { stencilReadOnly: true } : {}) } } : {}) });
      for (const r of P.deferred) { const s = r.subs[k]; if (!s || !s.pipe || badPipes.has(s.pipe)) continue;
        pass.setPipeline(s.pipe); for (let i = 0; i < r.groups.length; i++) pass.setBindGroup(i, r.groups[i], r.dyn[i]);
        for (let i = 0; i < r.vb.length; i++) pass.setVertexBuffer(i, r.vb[i][0], r.vb[i][1]);
        if (r.ib) pass.setIndexBuffer(r.ib[0], r.ib[1], r.ib[2]);
        pass.setViewport(...r.vp); pass.setScissorRect(...r.sc); pass.setBlendConstant(r.bf); if (dsv) pass.setStencilReference(r.ref);
        const c = r.c;
        if (c.op === 'draw') pass.draw(c.count, c.inst || 1, c.first, c.firstInst || 0);
        else if (c.op === 'draw_indexed') pass.drawIndexed(c.count, c.inst || 1, c.first, c.base, c.firstInst || 0);
        else if (c.op === 'draw_indirect') pass.drawIndirect(r.indBuf, c.off);
        else pass.drawIndexedIndirect(r.indBuf, c.off);
        stats.splitDraws = (stats.splitDraws || 0) + 1; }
      pass.end(); } };
  const encoder = () => { endPass(); return shared || (shared = device.createCommandEncoder()); };
  const flush = () => { endPass(); if (cbOff) device.queue.writeBuffer(cbRing, 0, cbCpu.buffer, 0, align(cbOff, 4)); if (shared) { const e = shared; shared = null; device.queue.submit([e.finish()]); } upOff = 0; cbOff = 0; cbRingGen++; };
  const submit = enc => { if (enc === shared) return; flush(); device.queue.submit([enc.finish()]); };
  const scoped = (fn) => { if (opts.scopes === false) { try { fn(); } catch (e) { warn('exception in command ' + cmdIndex + ': ' + e.message); } return; }
    device.pushErrorScope('validation'); const idx = cmdIndex; try { fn(); } catch (e) { errors.push({ idx, msg: 'exception: ' + e.message }); }
    const p = device.popErrorScope().then(e => { if (e) errors.push({ idx, msg: e.message }); }); pending.push(p); };
  const pending = [];
  let stats = { draws: 0, skipped: 0, dispatches: 0, tShader: 0, nShader: 0, tPipe: 0, nPipe: 0, hit: 0, part: 0, miss: 0, missBy: {} };
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  let traceN = 0, snaps = [];
  let tracing = false;
  let frameTargets = new Map(), lastFrameTargets = new Map();

  const draw = c => {
    if (cbOff > CB_RING - (4 << 20)) flush();
    let st;
    const cbOk = st0 => { for (const l of st0.dynSrc) for (const [stg, slot] of l) { const o = objs.get(S.cb[stg][slot]); if (!o || !(o.info.bind & 4)) return false; }
      for (const [stg, slot, o] of st0.fb) if (S.cb[stg][slot] !== o.id) return false; return true; };
    const reuse = st1 => {
      let rebound = false;
      if (st1.bindVer !== bindVer) { st1 = rebind(st1); rebound = true; }
      else if (!cbOk(st1)) st1 = null;
      if (st1 && st1.pipeVer !== pipeVer) st1 = { ...st1, ...st1.repipe(), pipeVer };
      if (!st1) return null;
      if (!rebound) {
        st1.dyn = st1.dynSrc.map(l => l.map(([stg, slot, sz]) => cbSlice(objs.get(S.cb[stg][slot]), sz)));
        for (const [, , o] of st1.fb) if (o.cbShadow && o.gbufVer !== o.cbVer) { getBuf(o); writeBuf(o, 0, o.cbShadow); o.gbufVer = o.cbVer; }
      }
      st1.diag = false; if (rebound) stats.part++; else stats.hit++; return st1; };
    const cacheable = c._layer === undefined && !tracing && !opts.noDrawCache;
    const dc = drawCache;
    if (dc && dc.ver === stateVer && dc.op === c.op && cacheable) st = reuse(dc.st);
    let sig = null;
    if (!st && cacheable) { sig = drawSig(c); const e = prepMap.get(sig); if (e) { st = reuse(e); if (st) stats.mapHit = (stats.mapHit || 0) + 1; } }
    if (st) { drawCache = { ver: stateVer, op: c.op, st }; if (sig) prepMap.set(sig, st); }
    if (!st) {
      const why = !drawCache ? 'none' : drawCache.ver !== stateVer ? lastBump : drawCache.st.bindVer !== bindVer ? 'srv-layout' : drawCache.op !== c.op ? 'op' : c._layer !== undefined ? 'layer' : tracing ? 'trace' : 'cb';
      stats.missBy[why] = (stats.missBy[why] || 0) + 1;
      st = prepareDraw(c); stats.miss++; if (!st) { drawCache = null; return; }
      drawCache = c._layer === undefined ? { ver: stateVer, op: c.op, st } : null;
      if (sig) { if (prepMap.size > 20000) prepMap.clear(); prepMap.set(sig, st); }
    }
    recordDraw(c, st);
  };
  const rebind = st0 => {
    const { vsS, psS } = linkVsPs(); if (!vsS) return null;
    if (vsS !== st0.vsS || psS !== st0.psS) return null;
    const bk = gid(st0.attached) + '|' + gid(vsS) + '|' + (psS ? gid(psS) : '') + '|' + slotIds(vsS, 'vs') + '|' + (psS ? slotIds(psS, 'ps') : '');
    let b = bindCache.get(bk);
    if (b) {
      for (const [stg, slot, o] of b.fb) if (o.cbShadow && o.gbufVer !== o.cbVer) { getBuf(o); writeBuf(o, 0, o.cbShadow); o.gbufVer = o.cbVer; }
      b = { ...b, dyn: b.dynSrc.map(l => l.map(([stg, slot, sz]) => cbSlice(objs.get(S.cb[stg][slot]), sz))) };
    } else {
      const acc = { layout: [], entries: [], dyn: [] }, ctx = { attached: st0.attached, f32filter: true, tr: null }, n0 = nCopiedViews;
      stageBindings(vsS, 'vs', SS.VERTEX, acc, ctx); if (psS) stageBindings(psS, 'ps', SS.FRAGMENT, acc, ctx);
      b = makeGroups(acc);
      if (nCopiedViews === n0) { if (bindCache.size > 50000) bindCache.clear(); bindCache.set(bk, b); }
    }
    if (b.pipelineLayout !== st0.pipelineLayout) return null;
    return { ...st0, groups: b.groups, dyn: b.dyn, dynSrc: b.dynSrc, fb: b.fb, diag: false, bindVer };
  };
  const bindCache = new Map();
  const linkVsPs = () => {
    const vs0 = S.sh.vs ? getShader(S.sh.vs, 'vs') : null; if (!vs0) return {};
    let psS = S.sh.ps ? getShader(S.sh.ps, 'ps', vs0.outputs) : null; if (S.sh.ps && !psS) return { vsS: vs0 };
    const lim = device.limits.maxInterStageShaderVariables || 16, oi = {}; let lm = null, synth = null;
    if (psS) for (const i of psS.inputs) if (i.interp && i.type === 'f') oi[i.loc] = i.interp;
    if (vs0.outputs.some(o => o.loc >= lim)) {
      let locs = [...new Set(psS ? psS.inputs.map(i => i.loc) : [])].sort((a, b) => a - b);
      if (locs.length > lim) { synth = {}; for (let i = lim; i < locs.length; i++) synth[locs[i]] = [locs[i - 1], locs[i - 2]];
        warn('pixel shader ' + S.sh.ps + ' reads ' + locs.length + ' interpolants (device limit ' + lim + '): the last ' + (locs.length - lim) + ' extrapolated'); locs = locs.slice(0, lim); }
      lm = {}; locs.forEach((l, k) => { lm[l] = k; }); }
    let vsS = vs0;
    if (Object.keys(oi).length || lm) vsS = getShader(S.sh.vs, 'vs', null, Object.keys(oi).length ? oi : null, lm ? { locMap: lm } : null) || vs0;
    if (lm && psS) psS = getShader(S.sh.ps, 'ps', vs0.outputs, null, { locMap: lm, synth }) || psS;
    return { vsS, psS }; };
  const slotIds = (sh, stage) => { const srvs = S.srv[stage], samps = S.samp[stage], cbs = S.cb[stage], uavs = stage === 'cs' ? S.uav : S.omUav; let k = '';
    for (const b of sh.bindings) { const kd = b.kind; k += (kd === 'cb' ? cbs[b.slot] : kd === 'sampler' ? samps[b.slot] : kd.startsWith('srv') ? srvs[b.slot] : uavs[b.slot]) + ','; } return k; };
  const prepareDraw = c => {
    let vsS = S.sh.vs ? getShader(S.sh.vs, 'vs') : null;
    if (!vsS) { stats.skipped++; warn('draw without usable vertex shader'); return; }
    if (S.sh.gs && c._layer === undefined) {
      const v0 = S.rtv.map(id => objs.get(id)).find(Boolean), r0 = v0 && resOf(v0);
      if (r0 && r0.info.dim === 3) { warn('geometry shader draw into a volume texture: emulated as one draw per slice');
        const st0 = prepareDraw({ ...c, inst: 1, _layer: 0 }); if (!st0) return;
        stats.gs = (stats.gs || 0) + 1; stats.gsSlices = (stats.gsSlices || 0) + (c.inst || 1);
        for (let i = 0; i < (c.inst || 1); i++) recordDraw({ ...c, inst: 1, firstInst: (c.firstInst || 0) + i, _layer: i }, i ? { ...st0, ...st0.pipeFor(i), diag: false } : st0);
        return; }
      stats.skipped++; warn('draw with geometry shader skipped (no GS in WebGPU)'); return; }
    const lk = linkVsPs(); vsS = lk.vsS || vsS; const psS = lk.psS;
    if (S.sh.ps && !psS) { stats.skipped++; return; }
    let rtvs = S.rtv.map(id => objs.get(id)).map(v => v && attView(v) ? v : null);
    const dsv = objs.get(S.dsv); if (dsv) attView(dsv);
    let last = -1; rtvs.forEach((v, i) => { if (v) last = i; });
    let formats = rtvs.slice(0, last + 1).map(v => v ? v.fmt : null);
    if (last < 0 && !dsv) { stats.skipped++; warn('draw with no render target skipped'); return; }
    const attached = new Set([...rtvs.filter(Boolean).map(v => v.info.res), ...(dsv && !(dsv.info.flags & 1) ? [dsv.info.res] : [])]);
    const tgroups = c._layer === undefined && !rtvs.some(v => v && v.slice !== undefined) ? splitTargets(formats) : null;
    let allRtvs = null, allFormats = null, splitKey = '';
    if (tgroups) { allRtvs = rtvs; allFormats = formats; splitKey = '|split ' + allRtvs.map(v => v ? gid(v.att) : '-').join(',');
      const r = pickIdx(allRtvs, tgroups[0]); rtvs = r.arr; last = r.last; formats = pickIdx(allFormats, tgroups[0]).arr.slice(0, last + 1);
      warn('render targets ' + allFormats.join('+') + ' exceed ' + device.limits.maxColorAttachmentBytesPerSample + ' color bytes/sample: drawn in ' + tgroups.length + ' groups'); }
    let rs = rasterState(); const dfmt = dsv ? dsv.fmt : null, samples = (rtvs.find(Boolean) || dsv).samples;
    const acc = { layout: [], entries: [], dyn: [] }, ctx = { attached, f32filter: true, tr: tracing ? [] : null };
    stageBindings(vsS, 'vs', SS.VERTEX, acc, ctx); if (psS) stageBindings(psS, 'ps', SS.FRAGMENT, acc, ctx);
    if (ctx.copies) { stats.skipped++; warn('draw whose shader needs merged storage buffers skipped'); return; }
    const { layouts, groups, pipelineLayout, dyn, dynSrc, fb } = makeGroups(acc);
    const vbs = vertexBuffers(vsS), topo = TOPO[S.topo] || 'triangle-list', strip = /strip/.test(topo);
    const ibFmt = S.ib.fmt === 57 ? 'uint16' : 'uint32';
    let vk = ''; for (const b of vbs) { vk += b.arrayStride + b.stepMode; for (const a of b.attributes) vk += ',' + a.shaderLocation + a.format + a.offset; vk += ';'; }
    const keyFor = l => gid(vsS) + '|' + (psS ? gid(psS) : '-') + '|' + (psS && psS.usesLayer ? l : -1) + '|' + vk + '|' + topo + (strip && c.op === 'draw_indexed' ? ibFmt : '') + '|' +
      S.raster + '|' + S.depth.s + '|' + S.blend.s + '|' + formats.join(',') + '|' + dfmt + '|' + samples + '|' + gid(pipelineLayout);
    const key = keyFor(c._layer || 0);
    let desc = null, ds;
    const buildDesc = (layer = c._layer || 0, fmts = formats, k = 0) => {
      const formats = fmts;
      desc = {
        layout: pipelineLayout,
        vertex: { module: vsS.module, entryPoint: 'main', buffers: vbs.map(b => ({ arrayStride: b.arrayStride, stepMode: b.stepMode, attributes: b.attributes })) },
        primitive: { topology: topo, cullMode: rs.cull === 2 ? 'front' : rs.cull === 3 ? 'back' : 'none', frontFace: rs.ccw ? 'ccw' : 'cw', ...(strip && c.op === 'draw_indexed' ? { stripIndexFormat: ibFmt } : {}), ...(rs.clip || !caps.clipCtl ? {} : { unclippedDepth: true }) },
        multisample: { count: samples },
      };
      if (psS) desc.fragment = { module: psS.module, entryPoint: 'main', targets: blendTargets(formats, psS.outputs), ...(psS.usesLayer ? { constants: { layerIdx: layer } } : {}) };
      else if (formats.some(Boolean)) desc.fragment = { module: emptyFS(), entryPoint: 'main', targets: formats.map(f => f ? { format: f, writeMask: 0 } : null) };
      ds = depthState(dfmt, rs); if (ds && k) ds = followDepth(ds); if (ds) desc.depthStencil = ds;
    };
    if (tracing) buildDesc();
    if (tracing && opts.dumpShader) { opts.dumpShader(vsS.id, 'vs', vsS.wgsl); if (psS) opts.dumpShader(psS.id, 'ps', psS.wgsl); }
    const diag = !pipeCache.has(key) && opts.scopes === false && !opts.asyncPipelines;
    const pipe = getPipe(key, () => { if (!desc) buildDesc(); return { desc }; });
    const pipeFor = l => { if (!psS || !psS.usesLayer) return { pipe, pkey: key }; const k = keyFor(l);
      return { pipe: getPipe(k, () => { buildDesc(l); return { desc }; }), pkey: k }; };
    const repipe = () => { rs = rasterState(); const k = keyFor(c._layer || 0);
      return { pipe: getPipe(k, () => { buildDesc(); return { desc }; }), pkey: k, rs }; };
    const subs = tgroups ? () => tgroups.slice(1).map((g, j) => { const r = pickIdx(allRtvs, g), f = pickIdx(allFormats, g).arr.slice(0, r.last + 1), sk = keyFor(c._layer || 0) + '|g' + (j + 1) + ':' + f.join(',');
      return { rtvs: r.arr, last: r.last, pipe: getPipe(sk, () => { buildDesc(c._layer || 0, f, j + 1); return { desc }; }) }; }) : null;
    return { vsS, psS, rtvs, dsv, last, formats, rs, dfmt, samples, groups, dyn, dynSrc, fb, vbs, ibFmt, pipe, pkey: key, desc, ds, diag, pipeFor, attached, pipelineLayout, bindVer, pipeVer, repipe, subs, splitKey };
  };
  const sameNums = (a, b) => { if (a === b) return true; if (!a || !b || a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
  const recordDraw = (c, st) => {
    if (!st.pipe) { st.pipe = pipeCache.get(st.pkey) || null; if (!st.pipe) { stats.skipped++; stats.pipeSkips = (stats.pipeSkips || 0) + 1; return; } }
    const { vsS, psS, rtvs, dsv, last, formats, rs, dfmt, samples, groups, dyn, vbs, ibFmt, pipe, desc, ds, diag } = st;
    if (badPipes.has(pipe)) { stats.skipped++; return; }
    const vbBufs = vbs.map(b => { if (b.slot < 0) return null; const vb = S.vb[b.slot], o = vb && objs.get(vb.buf); return o ? getBuf(o) : null; });
    const ibObj = objs.get(S.ib.buf), ibBuf = ibObj ? getBuf(ibObj) : null;
    const indBuf = /indirect/.test(c.op) && objs.get(c.id) ? getBuf(objs.get(c.id)) : null;
    if (diag) { flush(); device.pushErrorScope('validation'); }
    const enc = shared || (shared = device.createCommandEncoder());
    const done = () => { submit(enc); if (diag) flush(); if (diag) device.popErrorScope().then(e => { if (e) warn('[draw] ' + e.message.split(String.fromCharCode(10))[0] + ' | rt ' + JSON.stringify(formats) + ' ds ' + dfmt + ' samples ' + samples + ' rtSamples ' + JSON.stringify(rtvs.map(v => v && v.samples)) + ' dsSamples ' + (dsv && dsv.samples) + ' ps ' + !!psS + ' dsRO ' + !!(dsv && dsv.info.flags & 1) + ' depthWrite ' + !!(ds && ds.depthWriteEnabled)); }); };
    const akey = rtvs.slice(0, last + 1).map(v => v ? gid(v.att) + ':' + (v.slice !== undefined ? v.slice + (c._layer || 0) : '') : '-').join(',') + '|' + (dsv ? gid(dsv.att) + ':' + (dsv.info.flags & 3) : '-') + (st.splitKey || '');
    if (!open || open.key !== akey || open.enc !== enc) {
      endPass();
      const tw0 = tsOn ? tsWrites('R ' + formats.map(f => f || '-').join('+') + (dfmt ? '/' + dfmt : '') + ' ' + (rtvs.find(Boolean) || dsv).w + 'x' + (rtvs.find(Boolean) || dsv).h + (rtvs.some(v => v && v.slice !== undefined) ? ' slice' : '') + ' vs' + vsS.id + ' ps' + (psS ? psS.id : '-')) : undefined;
      const p = enc.beginRenderPass({
        ...(tw0 ? { timestampWrites: tw0 } : {}),
        colorAttachments: rtvs.slice(0, last + 1).map(v => v ? { view: v.att, loadOp: 'load', storeOp: 'store', ...(v.slice !== undefined ? { depthSlice: v.slice + (c._layer || 0) } : {}) } : null),
        ...(dsv ? { depthStencilAttachment: { view: dsv.att, ...(dsv.info.flags & 1 ? { depthReadOnly: true } : { depthLoadOp: 'load', depthStoreOp: 'store' }),
          ...(hasStencil(dsv.fmt) ? (dsv.info.flags & 2 ? { stencilReadOnly: true } : { stencilLoadOp: 'load', stencilStoreOp: 'store' }) : {}) } } : {}),
      });
      open = { pass: p, key: akey, enc, pipe: null, groupsG: [], groupsD: [], vbBuf: [], vbOff: [], ref: null };
    }
    const pass = open.pass, P = open;
    if (P.pipe !== pipe) { pass.setPipeline(pipe); P.pipe = pipe; }
    for (let i = 0; i < groups.length; i++) { const g = groups[i], d = dyn[i];
      if (P.groupsG[i] !== g || !sameNums(P.groupsD[i], d)) { pass.setBindGroup(i, g, d); P.groupsG[i] = g; P.groupsD[i] = d; } }
    for (let i = 0; i < vbs.length; i++) { const vb = vbBufs[i], buf = vb || dummyBuf(), off = vb ? S.vb[vbs[i].slot].off : 0;
      if (P.vbBuf[i] !== buf || P.vbOff[i] !== off) { pass.setVertexBuffer(i, buf, off); P.vbBuf[i] = buf; P.vbOff[i] = off; } }
    const tw = (rtvs.find(Boolean) || dsv).w, th = (rtvs.find(Boolean) || dsv).h;
    const vp = S.vp[0] || [0, 0, tw, th, 0, 1];
    const vx = Math.max(0, vp[0]), vy = Math.max(0, vp[1]), vw = Math.min(vp[2], tw - vx), vh = Math.min(vp[3], th - vy);
    if (vw <= 0 || vh <= 0) { done(); stats.skipped++; return; }
    const vzn = Math.max(0, Math.min(1, vp[4])), vzf = Math.max(0, Math.min(1, vp[5]));
    if (P.vpx !== vx || P.vpy !== vy || P.vpw !== vw || P.vph !== vh || P.vpzn !== vzn || P.vpzf !== vzf) {
      pass.setViewport(vx, vy, vw, vh, vzn, vzf); P.vpx = vx; P.vpy = vy; P.vpw = vw; P.vph = vh; P.vpzn = vzn; P.vpzf = vzf; }
    let sx = 0, sy = 0, sw = tw, sh = th;
    if (rs.scissor && S.sc[0]) { const r = S.sc[0]; sx = Math.max(0, Math.min(r[0], tw)); sy = Math.max(0, Math.min(r[1], th)); sw = Math.max(0, Math.min(r[2], tw) - sx); sh = Math.max(0, Math.min(r[3], th) - sy); }
    if (P.scx !== sx || P.scy !== sy || P.scw !== sw || P.sch !== sh) { pass.setScissorRect(sx, sy, sw, sh); P.scx = sx; P.scy = sy; P.scw = sw; P.sch = sh; }
    const bf = S.blend.f; if (P.bc0 !== bf[0] || P.bc1 !== bf[1] || P.bc2 !== bf[2] || P.bc3 !== bf[3]) { pass.setBlendConstant(bf); P.bc0 = bf[0]; P.bc1 = bf[1]; P.bc2 = bf[2]; P.bc3 = bf[3]; }
    if (dsv && P.ref !== S.depth.ref) { pass.setStencilReference(S.depth.ref); P.ref = S.depth.ref; }
    if (c.op === 'draw_indexed' || c.op === 'draw_indexed_indirect') { if (!ibBuf) { done(); stats.skipped++; return; }
      if (P.ibBuf !== ibBuf || P.ibFmt !== ibFmt || P.ibOff !== S.ib.off) { pass.setIndexBuffer(ibBuf, ibFmt, S.ib.off); P.ibBuf = ibBuf; P.ibFmt = ibFmt; P.ibOff = S.ib.off; } }
    if (c.op === 'draw') pass.draw(c.count, c.inst || 1, c.first, c.firstInst || 0);
    else if (c.op === 'draw_indexed') pass.drawIndexed(c.count, c.inst || 1, c.first, c.base, c.firstInst || 0);
    else if (c.op === 'draw_indirect') pass.drawIndirect(indBuf, c.off);
    else pass.drawIndexedIndirect(indBuf, c.off);
    if (st.subs) { (P.deferred || (P.deferred = [])).push({ c, groups, dyn, indBuf, subs: st.subs(), bf: [bf[0], bf[1], bf[2], bf[3]], ref: S.depth.ref,
      vb: vbs.map((b, i) => vbBufs[i] ? [vbBufs[i], S.vb[b.slot].off] : [dummyBuf(), 0]), ib: ibBuf && /indexed/.test(c.op) ? [ibBuf, ibFmt, S.ib.off] : null,
      vp: [vx, vy, vw, vh, vzn, vzf], sc: [sx, sy, sw, sh] }); P.dsv = dsv; }
    done(); stats.draws++;
    if (tracing) log('[trace] draw #' + (++traceN) + ' state cull=' + desc.primitive.cullMode + '/' + desc.primitive.frontFace + ' depth=' + (ds ? ds.depthCompare + (ds.depthWriteEnabled ? '+w' : '') : '-') + ' blend=' + JSON.stringify(desc.fragment && desc.fragment.targets && desc.fragment.targets[0] && desc.fragment.targets[0].blend || null) + ' base=' + (c.base || 0) + ' first=' + (c.first || 0) + ' inst=' + (c.inst || 1) + ' sc=' + (rs.scissor ? JSON.stringify(S.sc[0]) : '-') + ' vp=' + JSON.stringify(S.vp[0]) + ' | ' + c.op + ' n=' + (c.count || '') + ' vs ' + (vsS.id) + ' ps ' + (psS ? psS.id : '-') + ' rt ' + JSON.stringify(rtvs.map(v => v && v.info.res)) + ' ds ' + (dsv ? dsv.info.res + (dsv.info.flags & 1 ? 'ro' : '') : '-') + ' ' + ctx.tr.join(' '));
    if (tracing && rtvs.filter(Boolean).length === 1 && formats[0] === 'rgba16float' && snaps.length < 40) { const v = rtvs[0], r = resOf(v), src = getTex(r);
      const t = device.createTexture({ size: [v.w, v.h, 1], format: src.format, usage: TU.COPY_DST | TU.COPY_SRC | TU.TEXTURE_BINDING });
      const e2 = device.createCommandEncoder(); e2.copyTextureToTexture({ texture: src }, { texture: t }, [v.w, v.h, 1]); submit(e2); snaps.push({ n: traceN, res: r.id, tex: t, w: v.w, h: v.h }); }
    for (const v of rtvs) if (v) frameTargets.set(v.info.res, (frameTargets.get(v.info.res) || 0) + 1);
    if (dsv) frameTargets.set(dsv.info.res, (frameTargets.get(dsv.info.res) || 0) + 1);
  };
  const dispatch = c => {
    const cs = S.sh.cs ? getShader(S.sh.cs, 'cs') : null; if (!cs) { stats.skipped++; return; }
    const acc = { layout: [], entries: [], dyn: [] }, cctx = { attached: new Set(), f32filter: true, tr: tracing ? [] : null, scratch: [] }; stageBindings(cs, 'cs', SS.COMPUTE, acc, cctx);
    const { layouts, groups, pipelineLayout, dyn } = makeGroups(acc);
    const key = JSON.stringify([cs.id, cs.wgsl.length, acc.layout]);
    const pipe = getPipe(key, () => ({ desc: { layout: pipelineLayout, compute: { module: cs.module, entryPoint: 'main' } }, compute: true }));
    if (!pipe) { stats.skipped++; stats.pipeSkips = (stats.pipeSkips || 0) + 1; return; }
    if (badPipes.has(pipe)) { stats.skipped++; return; }
    const indBuf = c.op !== 'dispatch' && objs.get(c.id) ? getBuf(objs.get(c.id)) : null;
    const enc = encoder(), sc = [];
    if (cctx.copies) for (const { p, dst, n } of cctx.copies) { if (p && (p.buffer.usage & GU.COPY_SRC)) enc.copyBufferToBuffer(p.buffer, p.offset, cctx.merge.buf, dst, n); else enc.clearBuffer(cctx.merge.buf, dst, n); }
    for (const { v, buf } of cctx.scratch) { const r = resOf(v); if (!r || r.info.type !== 'tex' || r.info.dim === 3 || bppOf(texFormat(r)) !== 4) continue;
      const mip = (v.info.args || [])[0] || 0, w = Math.max(1, r.info.w >> mip), h = Math.max(1, r.info.h >> mip), tex = getTex(r);
      const pw = align(w, 64);
      if (buf.size < pw * h * 4) continue; sc.push({ tex, mip, w, h, pw, buf });
      enc.copyTextureToBuffer({ texture: tex, mipLevel: mip }, { buffer: buf, bytesPerRow: pw * 4, rowsPerImage: h }, [w, h, 1]); }
    const tw0 = tsOn ? tsWrites('C cs' + cs.id + ' ' + (c.op === 'dispatch' ? [c.x, c.y, c.z].join('x') : 'indirect')) : undefined;
    const pass = enc.beginComputePass(tw0 ? { timestampWrites: tw0 } : undefined);
    pass.setPipeline(pipe); groups.forEach((g, i) => pass.setBindGroup(i, g, dyn[i]));
    if (c.op === 'dispatch') { if (c.x && c.y && c.z) pass.dispatchWorkgroups(c.x, c.y, c.z); } else if (indBuf) pass.dispatchWorkgroupsIndirect(indBuf, c.off);
    pass.end();
    for (const { tex, mip, w, h, pw, buf } of sc) enc.copyBufferToTexture({ buffer: buf, bytesPerRow: pw * 4, rowsPerImage: h }, { texture: tex, mipLevel: mip }, [w, h, 1]);
    if (sc.length) stats.scratchPx = (stats.scratchPx || 0) + sc.reduce((n, x) => n + x.w * x.h, 0);
    submit(enc); stats.dispatches++;
    if (tracing) log('[trace] dispatch cs ' + cs.id + ' ' + JSON.stringify([c.x, c.y, c.z]) + ' ' + cctx.tr.join(' '));
  };
  const clearRtv = c => { const v = objs.get(c.id); if (!v || !attView(v)) return; const enc = encoder();
    enc.beginRenderPass({ colorAttachments: [{ view: v.att, loadOp: 'clear', storeOp: 'store', clearValue: { r: c.rgba[0], g: c.rgba[1], b: c.rgba[2], a: c.rgba[3] }, ...(v.slice !== undefined ? { depthSlice: v.slice } : {}) }] }).end(); submit(enc); };
  const clearDsv = c => { const v = objs.get(c.id); if (!v || !attView(v)) return; const enc = encoder(), st = hasStencil(v.fmt);
    enc.beginRenderPass({ colorAttachments: [], depthStencilAttachment: { view: v.att, depthLoadOp: c.flags & 1 ? 'clear' : 'load', depthStoreOp: 'store', depthClearValue: c.depth,
      ...(st ? { stencilLoadOp: c.flags & 2 ? 'clear' : 'load', stencilStoreOp: 'store', stencilClearValue: c.stencil } : {}) } }).end(); submit(enc); };
  const clearUav = c => { const v = objs.get(c.id); if (!v) return; const r = resOf(v); if (!r) return;
    const zero = c.v.every(x => x === 0);
    if (r.info.type === 'buf') { const b = getBuf(r); if (zero) { const enc = encoder(); enc.clearBuffer(b); submit(enc); }
      else { const n = b.size / 4, d = new Uint32Array(n); const w = c.op === 'clear_uav_uint' ? c.v[0] >>> 0 : new Uint32Array(new Float32Array([c.v[0]]).buffer)[0]; d.fill(w); qWriteBuffer(b, 0, d); } return; }
    const tex = getTex(r), f = texFormat(r), mip = (v.info.args || [])[0] || 0, w = Math.max(1, r.info.w >> mip), h = Math.max(1, r.info.h >> mip), dd = r.info.dim === 3 ? Math.max(1, r.info.depth >> mip) : 1;
    const bpp = bppOf(f), px = new Uint8Array(bpp), dv = new DataView(px.buffer);
    if (!zero) { if (f === 'rgba16float') {   const h16 = x => { const fv = new Float32Array([x]), u = new Uint32Array(fv.buffer)[0]; const s = (u >> 16) & 0x8000, e = ((u >> 23) & 255) - 112, m = (u >> 13) & 0x3ff; return e <= 0 ? s : e >= 31 ? s | 0x7c00 : s | (e << 10) | m; };
        for (let i = 0; i < 4; i++) dv.setUint16(2 * i, h16(c.v[i]), true); }
      else if (/32float/.test(f)) for (let i = 0; i < bpp / 4; i++) dv.setFloat32(4 * i, c.v[i], true);
      else if (/32u|32s/.test(f)) for (let i = 0; i < bpp / 4; i++) dv.setUint32(4 * i, c.v[i] >>> 0, true);
      else if (bpp === 4 && /8unorm/.test(f)) for (let i = 0; i < 4; i++) px[i] = Math.round(Math.max(0, Math.min(1, c.v[i])) * 255); }
    const all = new Uint8Array(w * h * dd * bpp); for (let i = 0; i < all.length; i += bpp) all.set(px, i);
    qWriteTexture({ texture: tex, mipLevel: mip }, all, { bytesPerRow: w * bpp, rowsPerImage: h }, [w, h, dd]); };
  const copy = c => { const d = objs.get(c.dst), s = objs.get(c.src); if (!d || !s) return; prep(s); prep(d); const enc = encoder();
    if (d.info.type === 'buf') enc.copyBufferToBuffer(getBuf(s), 0, getBuf(d), 0, Math.min(getBuf(s).size, getBuf(d).size) & ~3);
    else { const dt = getTex(d), st = getTex(s);
      if (texFormat(d) !== texFormat(s) && srgbPair(texFormat(d)) !== texFormat(s)) { warn('copy between formats ' + texFormat(s) + ' -> ' + texFormat(d) + ' skipped'); return; }
      const bc = isBC(texFormat(d)) ? x => align(x, 4) : x => x;
      for (let m = 0; m < Math.min(d.info.mips, s.info.mips); m++) enc.copyTextureToTexture({ texture: st, mipLevel: m }, { texture: dt, mipLevel: m },
        [bc(Math.max(1, d.info.w >> m)), bc(Math.max(1, d.info.h >> m)), d.info.dim === 3 ? Math.max(1, d.info.depth >> m) : d.info.array]); }
    submit(enc); };
  const copyRegion = c => { const d = objs.get(c.dst), s = objs.get(c.src); if (!d || !s) return; prep(s); prep(d); const enc = encoder();
    if (d.info.type === 'buf') { const lo = c.box ? c.box[0] : 0, hi = c.box ? c.box[3] : s.info.size; enc.copyBufferToBuffer(getBuf(s), lo & ~3, getBuf(d), c.x & ~3, align(hi - lo, 4)); }
    else { const sm = c.ssub % s.info.mips, sl = Math.floor(c.ssub / s.info.mips), dm = c.dsub % d.info.mips, dl = Math.floor(c.dsub / d.info.mips);
      const b = c.box || [0, 0, 0, Math.max(1, s.info.w >> sm), Math.max(1, s.info.h >> sm), s.info.dim === 3 ? Math.max(1, s.info.depth >> sm) : 1];
      if (texFormat(d) !== texFormat(s) && srgbPair(texFormat(d)) !== texFormat(s)) { warn('copy_region between formats ' + texFormat(s) + ' -> ' + texFormat(d) + ' skipped'); return; }
      const cw = isBC(texFormat(d)) ? align(b[3] - b[0], 4) : Math.min(b[3] - b[0], Math.max(1, s.info.w >> sm) - b[0], Math.max(1, d.info.w >> dm) - c.x),
        ch = isBC(texFormat(d)) ? align(b[4] - b[1], 4) : Math.min(b[4] - b[1], Math.max(1, s.info.h >> sm) - b[1], Math.max(1, d.info.h >> dm) - c.y);
      if (cw > 0 && ch > 0) enc.copyTextureToTexture({ texture: getTex(s), mipLevel: sm, origin: [b[0], b[1], s.info.dim === 3 ? b[2] : sl] }, { texture: getTex(d), mipLevel: dm, origin: [c.x, c.y, d.info.dim === 3 ? c.z : dl] },
        [cw, ch, b[5] - b[2]]); }
    submit(enc); };
  const update = c => { const o = objs.get(c.id); if (!o || !c.bytes) return;
    if (o.info.type === 'buf' && o.info.bind & 4) { const sh = cbShadow(o), at = c.box ? c.box[0] : 0;
      sh.set(c.bytes.subarray(0, Math.max(0, Math.min(c.bytes.length, sh.length - at))), at); o.cbGen = -1; o.cbVer = (o.cbVer || 0) + 1; return; }
    if (o.info.type === 'buf') { getBuf(o); writeBuf(o, c.box ? c.box[0] : 0, c.bytes); }
    else { getTex(o); writeSub(o, c.sub, c.bytes, c.box); } };

  const same = (arr, start, ids) => { for (let i = 0; i < ids.length; i++) if (arr[start + i] !== ids[i]) return false; return true; };
  const exec = c => {
    cmdIndex++;
    switch (c.op) {
      case 'set_shader': if (S.sh[c.stage] !== c.id) { S.sh[c.stage] = c.id; stateVer++; lastBump = c.op; } return;
      case 'set_cb': { const arr = S.cb[c.stage]; c.ids.forEach((id, i) => { arr[c.start + i] = id; }); return; }
      case 'set_srv': case 'set_samp': { const k = c.op.slice(4), arr = S[k][c.stage]; if (!same(arr, c.start, c.ids)) { c.ids.forEach((id, i) => { arr[c.start + i] = id; }); bindVer++; } return; }
      case 'set_layout': if (S.layout !== c.id) { S.layout = c.id; stateVer++; lastBump = c.op; } return;
      case 'set_vb': c.list.forEach((v, i) => { const o = S.vb[c.start + i]; if (!o !== !v || (o && v && o.stride !== v.stride)) { stateVer++; lastBump = c.op; } S.vb[c.start + i] = v; }); return;
      case 'set_ib': if (S.ib.fmt !== c.fmt) { stateVer++; lastBump = c.op; } S.ib = { buf: c.id, fmt: c.fmt, off: c.off }; return;
      case 'set_topo': if (S.topo !== c.topo) { S.topo = c.topo; stateVer++; lastBump = c.op; } return;
      case 'set_blend': if (S.blend.s !== c.id) pipeVer++; S.blend = { s: c.id, f: c.f, mask: c.mask }; return;
      case 'set_depth': if (S.depth.s !== c.id) pipeVer++; S.depth = { s: c.id, ref: c.ref }; return;
      case 'set_raster': if (S.raster !== c.id) { S.raster = c.id; pipeVer++; } return;
      case 'set_rt': stateVer++; lastBump = c.op; S.rtv.fill(0); c.rtv.forEach((id, i) => { S.rtv[i] = id; }); S.dsv = c.dsv; return;
      case 'set_rt_uav': stateVer++; lastBump = c.op; S.rtv = c.rtv.slice(); S.dsv = c.dsv; S.omUav = c.uav.slice(); return;
      case 'set_viewports': S.vp = c.vp; return;
      case 'set_scissors': S.sc = c.sc; return;
      case 'set_cs_uav': stateVer++; lastBump = c.op; c.ids.forEach((id, i) => { S.uav[c.start + i] = id; }); return;
      case 'clear_state': S = fresh(); stateVer++; lastBump = c.op; return;
      case 'draw': case 'draw_indexed': case 'draw_indirect': case 'draw_indexed_indirect': return scoped(() => draw(c));
      case 'dispatch': case 'dispatch_indirect': return scoped(() => dispatch(c));
      case 'clear_rtv': return scoped(() => clearRtv(c));
      case 'clear_dsv': return scoped(() => clearDsv(c));
      case 'clear_uav_uint': case 'clear_uav_float': return scoped(() => clearUav(c));
      case 'copy': return scoped(() => copy(c));
      case 'copy_region': return scoped(() => copyRegion(c));
      case 'update': return scoped(() => update(c));
      case 'free': { const o = objs.has(c.id) ? objs.get(c.id) : null;
        if (o) { if (o.gbuf) o.gbuf.destroy(); if (o.gtex) o.gtex.destroy(); o.gbuf = o.gtex = null; o.cbShadow = null; objs.delete(c.id); stats.freed = (stats.freed || 0) + 1; } return; }
      case 'gen_mips': warn('GenerateMips not implemented'); return;
      case 'resolve': warn('ResolveSubresource not implemented'); return;
      case 'present': tsBeforePresent(); flush(); tsAfterPresent(); lastFrameTargets = frameTargets; frameTargets = new Map(); if (opts.onPresent) opts.onPresent(c); return;
      default: warn('unknown command ' + c.op);
    }
  };

  const readGpuTex = async (tex, w, h) => { const bpp = bppOf(tex.format), bpr = align(w * bpp, 256), buf = device.createBuffer({ size: bpr * h, usage: GU.COPY_DST | GU.MAP_READ });
    const enc = device.createCommandEncoder(); enc.copyTextureToBuffer({ texture: tex }, { buffer: buf, bytesPerRow: bpr }, [w, h, 1]); submit(enc);
    await buf.mapAsync(1); const src = new Uint8Array(buf.getMappedRange()), out = new Uint8Array(w * h * bpp);
    for (let y = 0; y < h; y++) out.set(src.subarray(y * bpr, y * bpr + w * bpp), y * w * bpp);
    buf.unmap(); buf.destroy(); tex.destroy(); return { w, h, fmt: tex.format, data: out }; };
  const readTexture = async (id, mip = 0, layer = 0) => {
    const o = objs.get(id); const tex = getTex(o), f = texFormat(o), w = Math.max(1, o.info.w >> mip), h = Math.max(1, o.info.h >> mip), bpp = bppOf(f);
    if (isBC(f) || isDepth(f)) return null;
    const bpr = align(w * bpp, 256), buf = device.createBuffer({ size: bpr * h, usage: GU.COPY_DST | GU.MAP_READ });
    const enc = device.createCommandEncoder(); enc.copyTextureToBuffer({ texture: tex, mipLevel: mip, origin: [0, 0, layer] }, { buffer: buf, bytesPerRow: bpr }, [w, h, 1]); submit(enc);
    await buf.mapAsync(1); const src = new Uint8Array(buf.getMappedRange()), out = new Uint8Array(w * h * bpp);
    for (let y = 0; y < h; y++) out.set(src.subarray(y * bpr, y * bpr + w * bpp), y * w * bpp);
    buf.unmap(); buf.destroy(); return { w, h, fmt: f, data: out };
  };
  const finish = async () => { flush(); await Promise.all(pending); await device.queue.onSubmittedWorkDone(); return errors; };
  return { prewarm, exportPipes, defineObj, setState, exec, finish, readTexture, objs, stats: () => stats, texFormat, getTex, lastFrameTargets: () => lastFrameTargets, setTrace: t => { tracing = t; if (t) { traceN = 0; snaps = []; } }, takeSnaps: () => { const x = snaps; snaps = []; return x; }, readTex: async (tex, w, h) => readGpuTex(tex, w, h) };
}

module.exports = { createExecutor, TEXFMT };
