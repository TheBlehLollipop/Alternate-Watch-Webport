'use strict';
const { OPS, parseContainer } = require('./dxbc.js');

const STAGE_BASE = { vs: 0, ps: 128, cs: 0, gs: 256, hs: 384, ds: 512 };
const SW = 'xyzw';
const hex = v => '0x' + (v >>> 0).toString(16) + 'u';

function parseSig(b, stride) {
  if (!b) return [];
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength), n = dv.getUint32(0, true), base = dv.getUint32(4, true), out = [];
  const str = o => { let s = ''; while (b[o]) s += String.fromCharCode(b[o++]); return s; };
  for (let i = 0; i < n; i++) {
    const e = base + i * stride + (stride === 28 ? 4 : 0);
    out.push({ name: str(dv.getUint32(e, true)), index: dv.getUint32(e + 4, true), sv: dv.getUint32(e + 8, true), ctype: dv.getUint32(e + 12, true),
      reg: dv.getInt32(e + 16, true), mask: b[e + 20], rw: b[e + 21] });
  }
  return out;
}
const sigKey = e => e.name.toUpperCase() + e.index;
const ctypeChar = c => c === 1 ? 'u' : c === 2 ? 'i' : 'f';
const vecT = c => c === 'u' ? 'vec4u' : c === 'i' ? 'vec4i' : 'vec4f';
const sclT = c => c === 'u' ? 'u32' : c === 'i' ? 'i32' : 'f32';

function readOperand(t, p) {
  const tok = t[p++], nc = tok & 3, ncomp = [0, 1, 4, 4][nc], sel = (tok >> 2) & 3;
  let mask = 0xf, swz = [0, 1, 2, 3];
  if (nc === 2) {
    if (sel === 0) mask = (tok >> 4) & 15;
    else if (sel === 1) swz = [(tok >> 4) & 3, (tok >> 6) & 3, (tok >> 8) & 3, (tok >> 10) & 3];
    else { const s = (tok >> 4) & 3; swz = [s, s, s, s]; }
  } else if (nc === 1) { mask = 1; swz = [0, 0, 0, 0]; }
  const type = (tok >> 12) & 0xff, dim = (tok >> 20) & 3, reps = [(tok >> 22) & 7, (tok >> 25) & 7, (tok >> 28) & 7];
  let mod = 0, ext = tok >>> 31;
  while (ext) { const e = t[p++]; if ((e & 0x3f) === 1) mod = (e >> 6) & 0xff; ext = e >>> 31; }
  const op = { type, ncomp, sel: nc === 2 ? sel : -1, mask, swz, mod, idx: [] };
  if (type === 4) { op.imm = Array.from(t.subarray(p, p + ncomp)); p += ncomp; }
  else if (type === 5) { op.imm = []; for (let i = 0; i < ncomp; i++) op.imm.push(t[p + 2 * i]); p += 2 * ncomp; }
  for (let i = 0; i < dim; i++) {
    const r = reps[i]; let imm = 0, rel = null;
    if (r === 0) imm = t[p++];
    else if (r === 1) { imm = t[p]; p += 2; }
    else if (r === 2) [rel, p] = readOperand(t, p);
    else if (r === 3) { imm = t[p++]; [rel, p] = readOperand(t, p); }
    else if (r === 4) { imm = t[p]; p += 2; [rel, p] = readOperand(t, p); }
    op.idx.push({ imm, rel });
  }
  return [op, p];
}

const RDIM = { 1: 'buffer', 2: '2d', 3: '2d', 4: 'ms2d', 5: '3d', 6: 'cube', 7: '2darray', 8: '2darray', 9: 'ms2darray', 10: 'cubearray', 11: 'raw', 12: 'struct' };
const retChar = r => r === 4 ? 'u' : r === 3 ? 'i' : 'f';
const COORDS = { '2d': 2, '2darray': 3, '3d': 3, cube: 3, cubearray: 4, ms2d: 2, buffer: 1 };
const STORAGE_FMT = { 2: 'rgba32float', 3: 'rgba32uint', 4: 'rgba32sint', 10: 'rgba16float', 12: 'rgba16uint', 14: 'rgba16sint', 16: 'rg32float', 17: 'rg32uint',
  18: 'rg32sint', 24: 'rgb10a2unorm', 26: 'rg11b10ufloat', 28: 'rgba8unorm', 30: 'rgba8uint', 31: 'rgba8snorm', 32: 'rgba8sint', 34: 'rg16float', 41: 'r32float',
  42: 'r32uint', 43: 'r32sint', 49: 'rg8unorm', 54: 'r16float', 57: 'r16uint', 61: 'r8unorm', 87: 'bgra8unorm' };
const BUF_FMT = {
  41: [1, 'f', (b, w) => `vec4f(bitcast<f32>(${b}[${w}]), 0.0, 0.0, 1.0)`], 42: [1, 'u', (b, w) => `vec4u(${b}[${w}], 0u, 0u, 1u)`], 43: [1, 'i', (b, w) => `vec4i(bitcast<i32>(${b}[${w}]), 0, 0, 1)`],
  16: [2, 'f', (b, w) => `vec4f(bitcast<f32>(${b}[${w}]), bitcast<f32>(${b}[${w}+1u]), 0.0, 1.0)`], 17: [2, 'u', (b, w) => `vec4u(${b}[${w}], ${b}[${w}+1u], 0u, 1u)`],
  2: [4, 'f', (b, w) => `bitcast<vec4f>(vec4u(${b}[${w}], ${b}[${w}+1u], ${b}[${w}+2u], ${b}[${w}+3u]))`], 3: [4, 'u', (b, w) => `vec4u(${b}[${w}], ${b}[${w}+1u], ${b}[${w}+2u], ${b}[${w}+3u])`],
  6: [3, 'f', (b, w) => `vec4f(bitcast<f32>(${b}[${w}]), bitcast<f32>(${b}[${w}+1u]), bitcast<f32>(${b}[${w}+2u]), 1.0)`],
  10: [2, 'f', (b, w) => `vec4f(unpack2x16float(${b}[${w}]), unpack2x16float(${b}[${w}+1u]))`],
  28: [1, 'f', (b, w) => `unpack4x8unorm(${b}[${w}])`], 34: [1, 'f', (b, w) => `vec4f(unpack2x16float(${b}[${w}]), 0.0, 1.0)`],
  31: [1, 'f', (b, w) => `unpack4x8snorm(${b}[${w}])`], 87: [1, 'f', (b, w) => `unpack4x8unorm(${b}[${w}]).zyxw`],
  30: [1, 'u', (b, w) => `(vec4u(${b}[${w}]) >> vec4u(0u, 8u, 16u, 24u)) & vec4u(255u)`],
  32: [1, 'i', (b, w) => `(vec4i(bitcast<i32>(${b}[${w}])) << vec4u(24u, 16u, 8u, 0u)) >> vec4u(24u)`],
  24: [1, 'f', (b, w) => `vec4f((vec4u(${b}[${w}]) >> vec4u(0u, 10u, 20u, 30u)) & vec4u(1023u, 1023u, 1023u, 3u)) / vec4f(1023.0, 1023.0, 1023.0, 3.0)`],
  35: [1, 'f', (b, w) => `vec4f(unpack2x16unorm(${b}[${w}]), 0.0, 1.0)`], 37: [1, 'f', (b, w) => `vec4f(unpack2x16snorm(${b}[${w}]), 0.0, 1.0)`],
  11: [2, 'f', (b, w) => `vec4f(unpack2x16unorm(${b}[${w}]), unpack2x16unorm(${b}[${w}+1u]))`], 13: [2, 'f', (b, w) => `vec4f(unpack2x16snorm(${b}[${w}]), unpack2x16snorm(${b}[${w}+1u]))`],
  36: [1, 'u', (b, w) => `vec4u(${b}[${w}] & 0xffffu, ${b}[${w}] >> 16u, 0u, 1u)`],
  12: [2, 'u', (b, w) => `vec4u(${b}[${w}] & 0xffffu, ${b}[${w}] >> 16u, ${b}[${w}+1u] & 0xffffu, ${b}[${w}+1u] >> 16u)`],
  62: [0.5, 'u', (b, i) => `vec4u((${b}[(${i}) >> 1u] >> (((${i}) & 1u) * 16u)) & 0xffffu, 0u, 0u, 1u)`],
  54: [0.5, 'f', (b, i) => `vec4f(unpack2x16float(${b}[(${i}) >> 1u])[(${i}) & 1u], 0.0, 0.0, 1.0)`],
};

class Translator {
  constructor(bytes, opts) {
    this.opts = opts || {};
    const ch = parseContainer(bytes);
    const shex = ch.SHEX || ch.SHDR;
    this.isgn = parseSig(ch.ISGN, 24);
    this.osgn = ch.OSG5 ? parseSig(ch.OSG5, 28) : parseSig(ch.OSGN, 24);
    const code = new Uint32Array(shex.buffer.slice(shex.byteOffset, shex.byteOffset + shex.byteLength));
    this.t = code;
    this.stage = 'ps vs gs hs ds cs'.split(' ')[code[0] >>> 16];
    this.base = STAGE_BASE[this.stage];
    this.temps = 0; this.xtemps = {}; this.cbs = {}; this.srv = {}; this.uav = {}; this.samp = {}; this.tgsm = {}; this.icb = null;
    this.inputs = {}; this.outputs = {}; this.sysIn = {}; this.wg = [1, 1, 1]; this.atomicRes = new Set(); this.cmpTex = new Set(); this.cmpSamp = new Set(); this.uavLoad = new Set();
    this.pairs = new Set(); this.flow = []; this.uni = new Set(); this.nUni = 0; this.body = []; this.ind = 1; this.needs = new Set(); this.oDepth = false; this.oMask = false;
  }
  hint(k) { return (this.opts.hints || {})[k] || {}; }
  emit(s) { this.body.push('  '.repeat(this.ind) + s); }

  scan() {
    const t = this.t, len = t[1];
    for (let p = 2; p < len;) {
      const tok = t[p], op = tok & 0x7ff, n = op === 0x35 ? t[p + 1] : (tok >>> 24) & 0x7f, name = OPS[op];
      const end = p + n; let q = p + 1; while (t[q - 1] >>> 31 && q < end && name && !name.startsWith('dcl_')) q++;
      if (op === 0x35) { if (((tok >> 11) & 0x1fffff) === 3) { const d = t.subarray(p + 2, end); this.icb = []; for (let i = 0; i + 3 < d.length; i += 4) this.icb.push([d[i], d[i + 1], d[i + 2], d[i + 3]]); } }
      else if (name === 'dcl_temps') this.temps = t[p + 1];
      else if (name === 'dcl_indexable_temp') this.xtemps[t[p + 1]] = t[p + 2];
      else if (name === 'dcl_constant_buffer') { const [o] = readOperand(t, p + 1); this.cbs[o.idx[0].imm] = Math.max(1, o.idx[1] ? o.idx[1].imm : 4096); }
      else if (name === 'dcl_sampler') { const [o] = readOperand(t, p + 1); this.samp[o.idx[0].imm] = { cmp: ((tok >> 11) & 15) === 1 }; }
      else if (name === 'dcl_resource') { const [o, q2] = readOperand(t, p + 1); this.srv[o.idx[0].imm] = { dim: RDIM[(tok >> 11) & 31], ret: retChar(t[q2] & 15) }; }
      else if (name === 'dcl_resource_raw') { const [o] = readOperand(t, p + 1); this.srv[o.idx[0].imm] = { dim: 'raw' }; }
      else if (name === 'dcl_resource_structured') { const [o, q2] = readOperand(t, p + 1); this.srv[o.idx[0].imm] = { dim: 'struct', stride: t[q2] }; }
      else if (name === 'dcl_uav_typed') { const [o, q2] = readOperand(t, p + 1); this.uav[o.idx[0].imm] = { dim: RDIM[(tok >> 11) & 31], ret: retChar(t[q2] & 15) }; }
      else if (name === 'dcl_uav_raw') { const [o] = readOperand(t, p + 1); this.uav[o.idx[0].imm] = { dim: 'raw' }; }
      else if (name === 'dcl_uav_structured') { const [o, q2] = readOperand(t, p + 1); this.uav[o.idx[0].imm] = { dim: 'struct', stride: t[q2] }; }
      else if (name === 'dcl_tgsm_raw') { const [o, q2] = readOperand(t, p + 1); this.tgsm[o.idx[0].imm] = { words: t[q2] >> 2 }; }
      else if (name === 'dcl_tgsm_structured') { const [o, q2] = readOperand(t, p + 1); this.tgsm[o.idx[0].imm] = { words: (t[q2] * t[q2 + 1]) >> 2, stride: t[q2] }; }
      else if (name === 'dcl_thread_group') this.wg = [t[p + 1], t[p + 2], t[p + 3]];
      else if (name === 'dcl_input_ps' || name === 'dcl_input_ps_siv' || name === 'dcl_input_ps_sgv') { const [o] = readOperand(t, p + 1); if (o.type === 1) this.inputs[o.idx[0].imm] = { interp: (tok >> 11) & 15 }; }
      else if (name === 'dcl_input' || name === 'dcl_input_siv' || name === 'dcl_input_sgv') { const [o] = readOperand(t, p + 1); if (o.type === 1) this.inputs[o.idx[o.idx.length - 1].imm] = { interp: 0 }; else this.sysIn[o.type] = true; }
      else if (name === 'dcl_output' || name === 'dcl_output_siv' || name === 'dcl_output_sgv') { const [o] = readOperand(t, p + 1); if (o.type === 2) this.outputs[o.idx[0].imm] = true; else if (o.type === 12 || o.type === 38 || o.type === 39) this.oDepth = true; else if (o.type === 15) this.oMask = true; }
      else if (name && !name.startsWith('dcl_')) {
        this.flow.push({ p, name, threads: name === 'sync' && ((tok >> 11) & 1) });
        const ops = this.operands(p, q, end);
        if (/^(sample_c|sample_c_lz|gather4_c|gather4_po_c)$/.test(name)) { const r = ops.find(o => o.type === 7), s = ops.find(o => o.type === 6); if (r) this.cmpTex.add(r.idx[0].imm); if (s) this.cmpSamp.add(s.idx[0].imm); }
        if (/atomic/.test(name)) { const r = ops[name.startsWith('imm_') ? 1 : 0]; if (r) this.atomicRes.add((r.type === 31 ? 'g' : 'u') + r.idx[0].imm); }
        if (name === 'ld_uav_typed') { const r = ops[2]; if (r) this.uavLoad.add(r.idx[0].imm); }
      }
      p = end;
    }
  }
  markUniform() {
    const f = this.flow; if (!f.some(x => x.threads)) return;
    const match = (i, open, close) => { let d = 0; for (let j = i; j < f.length; j++) { if (open.includes(f[j].name)) d++; else if (close.includes(f[j].name) && --d === 0) return j; } return f.length; };
    const has = (a, b, pred) => { for (let j = a; j <= b; j++) if (pred(f[j])) return true; return false; };
    const loops = []; for (let i = 0; i < f.length; i++) if (f[i].name === 'loop') { const e = match(i, ['loop'], ['endloop']); if (has(i, e, x => x.threads)) loops.push([i, e]); }
    const inBarrierLoop = j => loops.some(([a, b]) => j > a && j < b);
    for (let i = 0; i < f.length; i++) {
      const n = f[i].name;
      if (n === 'if') { const e = match(i, ['if'], ['endif']);
        if (has(i, e, x => x.threads || x.name === 'ret' || x.name === 'retc') || (inBarrierLoop(i) && has(i, e, x => /^(break|breakc|continue|continuec)$/.test(x.name)))) this.uni.add(f[i].p); }
      else if (n === 'retc' || ((n === 'breakc' || n === 'continuec') && inBarrierLoop(i))) this.uni.add(f[i].p);
      else if (n === 'switch') { const e = match(i, ['switch'], ['endswitch']); if (has(i, e, x => x.threads)) this.uni.add(f[i].p); }
    }
  }
  uniCond(p, e) { if (!this.uni.has(p)) return e; const v = 'uc' + this.nUni++; this.emit(`${v} = select(0u, 1u, ${e});`); return `(workgroupUniformLoad(&${v}) != 0u)`; }
  operands(p, q, end) { const r = []; while (q < end) { const [o, q2] = readOperand(this.t, q); r.push(o); q = q2; } return r; }

  idx(i) { return i.rel ? `(${i.imm}u + ${this.relScalar(i.rel)})` : `${i.imm}u`; }
  relScalar(o) { return `${this.base0(o)}.${SW[o.swz[0]]}`; }
  base0(o) {
    const i0 = o.idx[0];
    switch (o.type) {
      case 0: return `r${i0.imm}`;
      case 1: return this.stage === 'gs' ? `v${o.idx[1].imm}` : `v${i0.imm}`;
      case 2: return `o${i0.imm}`;
      case 3: return `x${i0.imm}[${this.idx(o.idx[1])}]`;
      case 4: return o.ncomp === 1 ? `vec4u(${hex(o.imm[0])})` : `vec4u(${o.imm.map(hex).join(', ')})`;
      case 5: return `vec4u(${o.imm.map(hex).join(', ')})`;
      case 8: return `cb${i0.imm}[${this.idx(o.idx[1])}]`;
      case 9: return `icb[${this.idx(i0)}]`;
      case 11: return 'vec4u(0u)';
      case 32: this.needs.add('gid'); return 'vec4u(gid, 0u)';
      case 33: this.needs.add('wid'); return 'vec4u(wid, 0u)';
      case 34: this.needs.add('lid'); return 'vec4u(lid, 0u)';
      case 35: return 'vec4u(sampleMaskIn)';
      case 36: this.needs.add('lidx'); return 'vec4u(lidx)';
      case 37: return 'vec4u(0u)';
      case 12: return 'vec4u(bitcast<u32>(oDepth))';
      default: throw new Error('operand type ' + o.type + ' unsupported');
    }
  }
  src(o, ty) {
    let e = this.base0(o);
    if (o.ncomp === 4 && o.sel !== 0 && (o.type !== 4 && o.type !== 5)) { const s = o.swz.map(c => SW[c]).join(''); if (s !== 'xyzw') e = `${e}.${s}`; }
    else if ((o.type === 4 || o.type === 5) && o.ncomp === 4 && o.sel === 1) { const s = o.swz.map(c => SW[c]).join(''); if (s !== 'xyzw') e = `${e}.${s}`; }
    if (ty === 'f') e = `bitcast<vec4f>(${e})`; else if (ty === 'i') e = `bitcast<vec4i>(${e})`;
    if (o.mod & 2) e = `abs(${e})`;
    if (o.mod & 1) e = `(-${e})`;
    return e;
  }
  srcS(o, ty, c = 0) { return `${this.src(o, ty)}.${SW[c]}`; }
  dst(o, e, ty, sat) {
    if (o.type === 13) return;
    if (ty === 'f') e = `bitcast<vec4u>(${sat ? `saturate(${e})` : e})`; else if (ty === 'i') e = `bitcast<vec4u>(${e})`;
    if (o.type === 12 || o.type === 38 || o.type === 39) { this.emit(`oDepth = bitcast<f32>((${e}).x);`); return; }
    if (o.type === 15) { this.emit(`oMask = (${e}).x;`); return; }
    const b = o.type === 0 ? `r${o.idx[0].imm}` : o.type === 2 ? `o${o.idx[0].imm}` : o.type === 3 ? `x${o.idx[0].imm}[${this.idx(o.idx[1])}]` : null;
    if (!b) throw new Error('dest type ' + o.type);
    const comps = [0, 1, 2, 3].filter(c => o.mask & (1 << c));
    if (comps.length === 4) { this.emit(`${b} = ${e};`); return; }
    if (comps.length === 1) { this.emit(`${b}.${SW[comps[0]]} = (${e}).${SW[comps[0]]};`); return; }
    this.emit(`{ let t = ${e}; ${comps.map(c => `${b}.${SW[c]} = t.${SW[c]};`).join(' ')} }`);
  }

  texName(o) { return `t${o.idx[0].imm}`; }
  coord(dim, a, n) { return n === 1 ? `${a}.x` : `${a}.${'xyzw'.slice(0, n)}`; }
  sampleArgs(dim, a) {
    if (dim === '2darray') return `${a}.xy, i32(round(${a}.z))`;
    if (dim === 'cubearray') return `${a}.xyz, i32(round(${a}.w))`;
    if (dim === '3d' || dim === 'cube') return `${a}.xyz`;
    return `${a}.xy`;
  }
  offsetArg(ins, dim) {
    const o = ins.offs; if (!o || (!o[0] && !o[1] && !o[2])) return '';
    return dim === '3d' ? `, vec3i(${o[0]}, ${o[1]}, ${o[2]})` : `, vec2i(${o[0]}, ${o[1]})`;
  }
  resSwz(e, r) { const s = r.swz.map(c => SW[c]).join(''); return s === 'xyzw' ? e : `(${e}).${s}`; }

  gen() {
    const t = this.t, len = t[1];
    const caseOpen = [];
    for (let p = 2; p < len;) {
      const tok = t[p], op = tok & 0x7ff, n = op === 0x35 ? t[p + 1] : (tok >>> 24) & 0x7f, name = OPS[op], end = p + n;
      if (op === 0x35 || !name || name.startsWith('dcl_')) { p = end; continue; }
      let q = p + 1, offs = null, ext = tok >>> 31;
      while (ext) { const e = t[q++]; if ((e & 0x3f) === 1) { const sx = (v) => (v << 28) >> 28; offs = [sx((e >> 9) & 15), sx((e >> 13) & 15), sx((e >> 17) & 15)]; } ext = e >>> 31; }
      const o = this.operands(p, q, end), sat = !!(tok & 0x2000), nz = !!(tok & 0x40000);
      const ins = { name, o, sat, nz, offs, tok, p };
      const sw = caseOpen[caseOpen.length - 1];
      if (sw && (name === 'case' || name === 'default')) {
        if (sw.open && !sw.labels) { this.ind--; this.emit('}'); sw.open = false; }
        if (name === 'default') sw.hasDefault = true;
        sw.pending = (sw.pending || []).concat(name === 'case' ? [String(o[0].imm[0] | 0)] : ['default']);
        p = end; continue;
      }
      if (sw && sw.pending && name !== 'endswitch') { this.emit(`case ${sw.pending.join(', ')}: {`); this.ind++; sw.open = true; sw.pending = null; }
      if (name === 'switch') { const sel = this.uni.has(p) ? (() => { const v = 'us' + this.nUni++; this.emit(`${v} = ${this.srcS(o[0], 'i')};`); return `workgroupUniformLoad(&${v})`; })() : this.srcS(o[0], 'i'); this.emit(`switch (${sel}) {`); this.ind++; caseOpen.push({ open: false }); p = end; continue; }
      if (name === 'endswitch') {
        if (sw.pending) { this.emit(`case ${sw.pending.join(', ')}: {`); this.emit('}'); sw.pending = null; }
        else if (sw.open) { this.ind--; this.emit('}'); }
        if (!sw.hasDefault) this.emit('default: {}');
        caseOpen.pop(); this.ind--; this.emit('}'); p = end; continue;
      }
      if (name === 'break' && sw && sw.open && this.loopDepthAt === undefined) {   }
      this.ins(ins);
      p = end;
    }
  }

  ins(I) {
    const { name, o, sat } = I, F = 'f', U = 'u', S = 'i';
    const bin = (opx, ty, rty) => this.dst(o[0], `(${this.src(o[1], ty)} ${opx} ${this.src(o[2], ty)})`, rty || ty, sat);
    const fn1 = (f, ty) => this.dst(o[0], `${f}(${this.src(o[1], ty)})`, ty, sat);
    const fn2 = (f, ty) => this.dst(o[0], `${f}(${this.src(o[1], ty)}, ${this.src(o[2], ty)})`, ty, sat);
    const cmp = (opx, ty) => this.dst(o[0], `select(vec4u(0u), vec4u(0xffffffffu), ${this.src(o[1], ty)} ${opx} ${this.src(o[2], ty)})`, U);
    const cond = (oo) => this.uniCond(I.p, `(${this.srcS(oo, U)} ${I.nz ? '!=' : '=='} 0u)`);
    const shiftAmt = (oo) => `(${this.src(oo, U)} & vec4u(31u))`;
    switch (name) {
      case 'add': return bin('+', F); case 'mul': return bin('*', F); case 'div': return bin('/', F);
      case 'mad': return this.dst(o[0], `(${this.src(o[1], F)} * ${this.src(o[2], F)} + ${this.src(o[3], F)})`, F, sat);
      case 'min': return fn2('min', F); case 'max': return fn2('max', F);
      case 'dp2': return this.dst(o[0], `vec4f(dot(${this.src(o[1], F)}.xy, ${this.src(o[2], F)}.xy))`, F, sat);
      case 'dp3': return this.dst(o[0], `vec4f(dot(${this.src(o[1], F)}.xyz, ${this.src(o[2], F)}.xyz))`, F, sat);
      case 'dp4': return this.dst(o[0], `vec4f(dot(${this.src(o[1], F)}, ${this.src(o[2], F)}))`, F, sat);
      case 'frc': return fn1('fract', F); case 'round_ne': return fn1('round', F); case 'round_ni': return fn1('floor', F);
      case 'round_pi': return fn1('ceil', F); case 'round_z': return fn1('trunc', F);
      case 'exp': return fn1('exp2', F); case 'log': return fn1('log2', F); case 'rsq': return fn1('inverseSqrt', F); case 'sqrt': return fn1('sqrt', F);
      case 'rcp': return this.dst(o[0], `(vec4f(1.0) / ${this.src(o[1], F)})`, F, sat);
      case 'sincos': this.emit(`{ let sx = ${this.src(o[2], F)};`); this.ind++;
        if (o[0].type !== 13) this.dst(o[0], 'sin(sx)', F, sat); if (o[1].type !== 13) this.dst(o[1], 'cos(sx)', F, sat); this.ind--; this.emit('}'); return;
      case 'deriv_rtx': case 'deriv_rtx_coarse': return fn1(name === 'deriv_rtx' ? 'dpdx' : 'dpdxCoarse', F);
      case 'deriv_rtx_fine': return fn1('dpdxFine', F);
      case 'deriv_rty': case 'deriv_rty_coarse': return fn1(name === 'deriv_rty' ? 'dpdy' : 'dpdyCoarse', F);
      case 'deriv_rty_fine': return fn1('dpdyFine', F);
      case 'eq': return cmp('==', F); case 'ne': return cmp('!=', F); case 'lt': return cmp('<', F); case 'ge': return cmp('>=', F);
      case 'mov': return o[1].mod || sat ? this.dst(o[0], this.src(o[1], F), F, sat) : this.dst(o[0], this.src(o[1], U), U);
      case 'movc': return o[2].mod || o[3].mod || sat
        ? this.dst(o[0], `select(${this.src(o[3], F)}, ${this.src(o[2], F)}, ${this.src(o[1], U)} != vec4u(0u))`, F, sat)
        : this.dst(o[0], `select(${this.src(o[3], U)}, ${this.src(o[2], U)}, ${this.src(o[1], U)} != vec4u(0u))`, U);
      case 'swapc': {
        const c = `(${this.src(o[2], U)} != vec4u(0u))`;
        this.emit(`{ let sa = ${this.src(o[3], U)}; let sb = ${this.src(o[4], U)}; let sc = ${c};`); this.ind++;
        this.dst(o[0], 'select(sa, sb, sc)', U); this.dst(o[1], 'select(sb, sa, sc)', U); this.ind--; this.emit('}'); return; }
      case 'iadd': return bin('+', S);
      case 'imul': case 'umul': { const T = name === 'imul' ? S : U;
        this.emit(`{ let ma = ${this.src(o[2], T)}; let mb = ${this.src(o[3], T)};`); this.ind++;
        if (o[0].type !== 13) { this.dst(o[0], `${name === 'imul' ? 'imulhi' : 'umulhi'}(ma, mb)`, T); this.needs.add('mulhi'); }
        if (o[1].type !== 13) this.dst(o[1], '(ma * mb)', T); this.ind--; this.emit('}'); return; }
      case 'imad': return this.dst(o[0], `(${this.src(o[1], S)} * ${this.src(o[2], S)} + ${this.src(o[3], S)})`, S);
      case 'umad': return this.dst(o[0], `(${this.src(o[1], U)} * ${this.src(o[2], U)} + ${this.src(o[3], U)})`, U);
      case 'udiv': { this.emit(`{ let da = ${this.src(o[2], U)}; let db = ${this.src(o[3], U)};`); this.ind++;
        if (o[0].type !== 13) this.dst(o[0], 'select(da / db, vec4u(0xffffffffu), db == vec4u(0u))', U);
        if (o[1].type !== 13) this.dst(o[1], 'select(da % db, vec4u(0xffffffffu), db == vec4u(0u))', U); this.ind--; this.emit('}'); return; }
      case 'imax': return fn2('max', S); case 'imin': return fn2('min', S); case 'umax': return fn2('max', U); case 'umin': return fn2('min', U);
      case 'ineg': return this.dst(o[0], `(-${this.src(o[1], S)})`, S);
      case 'ishl': return this.dst(o[0], `(${this.src(o[1], U)} << ${shiftAmt(o[2])})`, U);
      case 'ishr': return this.dst(o[0], `(${this.src(o[1], S)} >> ${shiftAmt(o[2])})`, S);
      case 'ushr': return this.dst(o[0], `(${this.src(o[1], U)} >> ${shiftAmt(o[2])})`, U);
      case 'and': return bin('&', U); case 'or': return bin('|', U); case 'xor': return bin('^', U);
      case 'not': return this.dst(o[0], `(~${this.src(o[1], U)})`, U);
      case 'ieq': return cmp('==', S); case 'ine': return cmp('!=', S); case 'ilt': return cmp('<', S); case 'ige': return cmp('>=', S);
      case 'ult': return cmp('<', U); case 'uge': return cmp('>=', U);
      case 'itof': return this.dst(o[0], `vec4f(${this.src(o[1], S)})`, F, sat);
      case 'utof': return this.dst(o[0], `vec4f(${this.src(o[1], U)})`, F, sat);
      case 'ftoi': return this.dst(o[0], `vec4i(${this.src(o[1], F)})`, S);
      case 'ftou': return this.dst(o[0], `vec4u(${this.src(o[1], F)})`, U);
      case 'countbits': return fn1('countOneBits', U); case 'bfrev': return fn1('reverseBits', U);
      case 'firstbit_lo': return fn1('firstTrailingBit', U);
      case 'firstbit_hi': return this.dst(o[0], `select(vec4u(31u) - firstLeadingBit(${this.src(o[1], U)}), vec4u(0xffffffffu), ${this.src(o[1], U)} == vec4u(0u))`, U);
      case 'firstbit_shi': return this.dst(o[0], `select(vec4u(31u) - bitcast<vec4u>(firstLeadingBit(${this.src(o[1], S)})), vec4u(0xffffffffu), firstLeadingBit(${this.src(o[1], S)}) == vec4i(-1))`, U);
      case 'ubfe': case 'ibfe': { const ty = name === 'ubfe' ? U : S, w = this.src(o[1], U), off = this.src(o[2], U), v = this.src(o[3], ty);
        this.emit(`{ let bw = ${w} & vec4u(31u); let bo = ${off} & vec4u(31u); let bv = ${v}; var br: ${vecT(ty)};`); this.ind++;
        for (let c = 0; c < 4; c++) this.emit(`br.${SW[c]} = extractBits(bv.${SW[c]}, bo.${SW[c]}, bw.${SW[c]});`);
        this.dst(o[0], 'br', ty); this.ind--; this.emit('}'); return; }
      case 'bfi': { const w = this.src(o[1], U), off = this.src(o[2], U), ins = this.src(o[3], U), b = this.src(o[4], U);
        this.emit(`{ let bw = ${w} & vec4u(31u); let bo = ${off} & vec4u(31u); let bi = ${ins}; let bb = ${b}; var br: vec4u;`); this.ind++;
        for (let c = 0; c < 4; c++) this.emit(`br.${SW[c]} = insertBits(bb.${SW[c]}, bi.${SW[c]}, bo.${SW[c]}, bw.${SW[c]});`);
        this.dst(o[0], 'br', U); this.ind--; this.emit('}'); return; }
      case 'f32tof16': return this.dst(o[0], `vec4u(pack2x16float(vec2f(${this.srcS(o[1], F, 0)}, 0.0)), pack2x16float(vec2f(${this.srcS(o[1], F, 1)}, 0.0)), pack2x16float(vec2f(${this.srcS(o[1], F, 2)}, 0.0)), pack2x16float(vec2f(${this.srcS(o[1], F, 3)}, 0.0)))`, U);
      case 'f16tof32': return this.dst(o[0], `vec4f(unpack2x16float(${this.srcS(o[1], U, 0)} & 0xffffu).x, unpack2x16float(${this.srcS(o[1], U, 1)} & 0xffffu).x, unpack2x16float(${this.srcS(o[1], U, 2)} & 0xffffu).x, unpack2x16float(${this.srcS(o[1], U, 3)} & 0xffffu).x)`, F, sat);
      case 'if': this.emit(`if ${cond(o[0])} {`); this.ind++; return;
      case 'else': this.ind--; this.emit('} else {'); this.ind++; return;
      case 'endif': this.ind--; this.emit('}'); return;
      case 'loop': this.emit('loop {'); this.ind++; return;
      case 'endloop': this.ind--; this.emit('}'); return;
      case 'break': this.emit('break;'); return;
      case 'breakc': this.emit(`if ${cond(o[0])} { break; }`); return;
      case 'continue': this.emit('continue;'); return;
      case 'continuec': this.emit(`if ${cond(o[0])} { continue; }`); return;
      case 'ret': this.emit('return;'); return;
      case 'retc': this.emit(`if ${cond(o[0])} { return; }`); return;
      case 'discard': this.emit(`if ${cond(o[0])} { discard; }`); return;
      case 'nop': return;
      case 'sync': { const f = (I.tok >> 11) & 15; if (f & 1) { if (f & 12) this.emit('storageBarrier();'); this.emit('workgroupBarrier();'); } return; }
      case 'sample': case 'sample_l': case 'sample_b': case 'sample_d': case 'sample_c': case 'sample_c_lz': return this.sample(I);
      case 'gather4': case 'gather4_c': case 'gather4_po': case 'gather4_po_c': return this.gather(I);
      case 'ld': case 'ld_ms': return this.ld(I);
      case 'resinfo': return this.resinfo(I);
      case 'bufinfo': return this.bufinfo(I);
      case 'lod': { const r = o[2], s = o[3]; this.dst(o[0], 'vec4f(0.0)', F); void r; void s; return; }
      case 'sample_info': return this.dst(o[0], 'vec4u(1u)', U);
      case 'sample_pos': return this.dst(o[0], 'vec4f(0.0)', F);
      case 'ld_raw': return this.ldMem(I, o[0], `(${this.srcS(o[1], U)} >> 2u)`, o[2]);
      case 'ld_structured': return this.ldMem(I, o[0], `((${this.srcS(o[1], U)} * ${this.strideOf(o[3])}u + ${this.srcS(o[2], U)}) >> 2u)`, o[3]);
      case 'store_raw': return this.stMem(o[0], `(${this.srcS(o[1], U)} >> 2u)`, o[2]);
      case 'store_structured': return this.stMem(o[0], `((${this.srcS(o[1], U)} * ${this.strideOf(o[0])}u + ${this.srcS(o[2], U)}) >> 2u)`, o[3]);
      case 'ld_uav_typed': return this.ldUav(I);
      case 'store_uav_typed': return this.stUav(I);
      default:
        if (/atomic/.test(name)) return this.atomic(I);
        throw new Error('unsupported instruction ' + name);
    }
  }
  strideOf(r) { const id = r.idx[0].imm; return r.type === 31 ? (this.tgsm[id].stride || 4) : r.type === 30 ? (this.uav[id].stride || 4) : (this.srv[id].stride || 4); }
  memName(r) { return r.type === 31 ? `g${r.idx[0].imm}` : r.type === 30 ? `u${r.idx[0].imm}` : `t${r.idx[0].imm}`; }
  isAtomic(r) { return this.atomicRes.has((r.type === 31 ? 'g' : 'u') + r.idx[0].imm); }
  word(r, w) { const nm = this.memName(r); return (r.type === 30 || r.type === 31) && this.isAtomic(r) ? `atomicLoad(&${nm}[${w}])` : `${nm}[${w}]`; }
  ldMem(I, d, a, r) {
    this.emit(`{ let ma = ${a};`); this.ind++;
    const comps = r.swz.map(c => this.word(r, `ma + ${c}u`));
    this.dst(d, `vec4u(${comps.join(', ')})`, 'u'); this.ind--; this.emit('}');
  }
  stMem(d, a, v) {
    const nm = this.memName(d), at = this.isAtomic(d);
    this.emit(`{ let ma = ${a}; let mv = ${this.src(v, 'u')};`); this.ind++;
    for (let c = 0; c < 4; c++) if (d.mask & (1 << c)) this.emit(at ? `atomicStore(&${nm}[ma + ${c}u], mv.${SW[c]});` : `${nm}[ma + ${c}u] = mv.${SW[c]};`);
    this.ind--; this.emit('}');
  }
  atomic(I) {
    const { name, o } = I, imm = name.startsWith('imm_'), d = imm ? o[0] : null, r = imm ? o[1] : o[0], ai = imm ? 2 : 1;
    const fnm = { and: 'atomicAnd', or: 'atomicOr', xor: 'atomicXor', iadd: 'atomicAdd', imax: 'atomicMax', imin: 'atomicMin', umax: 'atomicMax', umin: 'atomicMin', exch: 'atomicExchange' };
    const kind = name.replace(/^(imm_)?atomic_/, '');
    const id = r.idx[0].imm, info = r.type === 31 ? this.tgsm[id] : this.uav[id];
    const addr = r.type === 30 && info.dim === 'buffer' ? this.srcS(o[ai], 'u', 0) : r.type === 30 && info.asBuf ? this.bufAddr(info, this.src(o[ai], 'u')) : info.dim === 'struct' || (r.type === 31 && info.stride)
      ? `((${this.srcS(o[ai], 'u', 0)} * ${this.strideOf(r)}u + ${this.srcS(o[ai], 'u', 1)}) >> 2u)` : `(${this.srcS(o[ai], 'u', 0)} >> 2u)`;
    const nm = this.memName(r), v = this.srcS(o[ai + 1], 'u');
    let e;
    if (kind === 'cmp_store' || kind === 'cmp_exch') e = `atomicCompareExchangeWeak(&${nm}[${addr}], ${v}, ${this.srcS(o[ai + 2], 'u')}).old_value`;
    else if (kind === 'alloc' || kind === 'consume') throw new Error('append/consume unsupported');
    else e = `${fnm[kind]}(&${nm}[${addr}], ${v})`;
    if (d && d.type !== 13) this.dst(d, `vec4u(${e})`, 'u'); else this.emit(`${e};`);
  }
  texType(id) {
    const r = this.srv[id], T = sclT(r.ret || 'f');
    if (this.cmpTex.has(id)) return { '2d': 'texture_depth_2d', '2darray': 'texture_depth_2d_array', cube: 'texture_depth_cube', cubearray: 'texture_depth_cube_array' }[r.dim] || 'texture_depth_2d';
    return { '2d': `texture_2d<${T}>`, '2darray': `texture_2d_array<${T}>`, '3d': `texture_3d<${T}>`, cube: `texture_cube<${T}>`, cubearray: `texture_cube_array<${T}>`, ms2d: `texture_multisampled_2d<${T}>` }[r.dim];
  }
  sample(I) {
    const { name, o } = I, r = o[2], s = o[3], id = r.idx[0].imm, dim = this.srv[id].dim, a = this.src(o[1], 'f'), frag = this.stage === 'ps';
    const tn = `t${id}`, sn = `s${s.idx[0].imm}`, args = this.sampleArgs(dim, a), off = this.offsetArg(I, dim);
    this.pairs.add(id + ':' + s.idx[0].imm);
    let e;
    if (name === 'sample') e = frag ? `textureSample(${tn}, ${sn}, ${args}${off})` : `textureSampleLevel(${tn}, ${sn}, ${args}, 0.0${off})`;
    else if (name === 'sample_l') e = `textureSampleLevel(${tn}, ${sn}, ${args}, ${this.srcS(o[4], 'f')}${off})`;
    else if (name === 'sample_b') e = frag ? `textureSampleBias(${tn}, ${sn}, ${args}, ${this.srcS(o[4], 'f')}${off})` : `textureSampleLevel(${tn}, ${sn}, ${args}, 0.0${off})`;
    else if (name === 'sample_d') { const n = dim === '3d' || dim === 'cube' || dim === 'cubearray' ? 'xyz' : 'xy';
      e = `textureSampleGrad(${tn}, ${sn}, ${args}, ${this.src(o[4], 'f')}.${n}, ${this.src(o[5], 'f')}.${n}${off})`; }
    else if (name === 'sample_c') e = `vec4f(${frag ? 'textureSampleCompare' : 'textureSampleCompareLevel'}(${tn}, ${sn}, ${args}, ${this.srcS(o[4], 'f')}${off}))`;
    else e = `vec4f(textureSampleCompareLevel(${tn}, ${sn}, ${args}, ${this.srcS(o[4], 'f')}${off}))`;
    this.dst(o[0], this.resSwz(e, r), 'f', I.sat);
  }
  gather(I) {
    const { name, o } = I, po = name.includes('_po'), r = o[po ? 3 : 2], s = o[po ? 4 : 3], id = r.idx[0].imm, dim = this.srv[id].dim, a = this.src(o[1], 'f');
    const tn = `t${id}`, sn = `s${s.idx[0].imm}`, args = this.sampleArgs(dim, a), off = po ? '' : this.offsetArg(I, dim);
    this.pairs.add(id + ':' + s.idx[0].imm);
    const e = name.endsWith('_c') ? `textureGatherCompare(${tn}, ${sn}, ${args}, ${this.srcS(o[po ? 5 : 4], 'f')}${off})`
      : this.cmpTex.has(id) ? `textureGather(${tn}, ${sn}, ${args}${off})` : `textureGather(${s.swz[0]}, ${tn}, ${sn}, ${args}${off})`;
    this.dst(o[0], this.resSwz(e, r), retChar(0) === 'f' ? 'f' : 'f', I.sat);
  }
  ld(I) {
    const { name, o } = I, r = o[2], id = r.idx[0].imm, info = this.srv[id], a = this.src(o[1], 'i'), tn = `t${id}`, ty = info.ret || 'f';
    let e;
    if (info.dim === 'buffer') { e = this.bufLoad(`t${id}`, `t${id}`, `u32(${a}.x)`, 't' + id, ty); }
    else {
      const off = I.offs && (I.offs[0] || I.offs[1] || I.offs[2]) ? (info.dim === '3d' ? ` + vec3i(${I.offs.join(', ')})` : ` + vec2i(${I.offs[0]}, ${I.offs[1]})`) : '';
      if (info.dim === 'ms2d') e = `textureLoad(${tn}, ${a}.xy${off}, ${this.srcS(o[3], 'i')})`;
      else if (info.dim === '2darray') e = `textureLoad(${tn}, ${a}.xy${off}, ${a}.z, ${a}.w)`;
      else if (info.dim === '3d') e = `textureLoad(${tn}, ${a}.xyz${off}, ${a}.w)`;
      else e = `textureLoad(${tn}, ${a}.xy${off}, ${a}.w)`;
      if (this.cmpTex.has(id)) e = `vec4f(${e})`;
    }
    this.dst(o[0], this.resSwz(e, r), ty, I.sat);
  }
  bufLoad(arr, nm, idx, key, ty) {
    const f = BUF_FMT[this.hint(key).format] || (ty === 'u' ? BUF_FMT[42] : ty === 'i' ? BUF_FMT[43] : BUF_FMT[41]);
    const raw = f[0] === 0.5 ? f[2](arr, `(${idx})`) : f[2](arr, `(${idx}) * ${f[0]}u`);
    if (f[1] === ty) return raw;
    return ty === 'f' ? `vec4f(${raw})` : ty === 'u' ? `vec4u(${raw})` : `vec4i(${raw})`;
  }
  resinfo(I) {
    const { o } = I, r = o[2], id = r.idx[0].imm, info = r.type === 30 ? this.uav[id] : this.srv[id], tn = `${r.type === 30 ? 'u' : 't'}${id}`, mip = this.srcS(o[1], 'u');
    const rt = (I.tok >> 11) & 3, storage = r.type === 30;
    let e;
    const lv = storage ? '1u' : `textureNumLevels(${tn})`, ml = storage ? '' : `, ${mip}`;
    if (info.dim === '3d') e = `vec4u(textureDimensions(${tn}${ml}), ${lv})`;
    else if (info.dim === '2darray' || info.dim === 'cubearray') e = `vec4u(textureDimensions(${tn}${ml}), textureNumLayers(${tn}), ${lv})`;
    else if (info.dim === 'ms2d') e = `vec4u(textureDimensions(${tn}), 0u, 1u)`;
    else e = `vec4u(textureDimensions(${tn}${ml}), 0u, ${lv})`;
    if (rt === 2) this.dst(o[0], this.resSwz(e, r), 'u');
    else if (rt === 1) this.dst(o[0], this.resSwz(`(vec4f(1.0) / vec4f(${e}))`, r), 'f', I.sat);
    else this.dst(o[0], this.resSwz(`vec4f(${e})`, r), 'f', I.sat);
  }
  bufinfo(I) {
    const { o } = I, r = o[1], id = r.idx[0].imm, info = r.type === 30 ? this.uav[id] : this.srv[id], nm = this.memName(r);
    const words = `arrayLength(&${nm})`;
    let e;
    if (info.dim === 'raw') e = `${words} * 4u`;
    else if (info.dim === 'struct') e = `${words} * 4u / ${info.stride}u`;
    else { const f = BUF_FMT[this.hint((r.type === 30 ? 'u' : 't') + id).format]; e = f && f[0] === 0.5 ? `${words} * 2u` : `${words} / ${f ? f[0] : 1}u`; }
    this.dst(o[0], `vec4u(${e})`, 'u');
  }
  bufAddr(info, a) { return info.dim === '3d' || info.dim === '2darray' ? `((${a}.z * ${info.h}u + ${a}.y) * ${info.w}u + ${a}.x)` : `(${a}.y * ${info.w}u + ${a}.x)`; }
  uavCoord(info, a) { return info.dim === '2darray' ? `${a}.xy, ${a}.z` : info.dim === '3d' ? `${a}.xyz` : `${a}.xy`; }
  ldUav(I) {
    const { o } = I, r = o[2], id = r.idx[0].imm, info = this.uav[id], a = this.src(o[1], 'u'), ty = info.ret || 'f';
    const e = info.asBuf ? `vec4u(atomicLoad(&u${id}[${this.bufAddr(info, a)}]), 0u, 0u, 1u)` : info.dim === 'buffer' ? this.bufLoad(`u${id}`, `u${id}`, `${a}.x`, 'u' + id, ty) : `textureLoad(u${id}, ${this.uavCoord(info, a)})`;
    this.dst(o[0], this.resSwz(e, r), ty);
  }
  stUav(I) {
    const { o } = I, d = o[0], id = d.idx[0].imm, info = this.uav[id], a = this.src(o[1], 'u'), ty = info.ret || 'f', v = this.src(o[2], ty);
    if (info.asBuf) { this.emit(`atomicStore(&u${id}[${this.bufAddr(info, a)}], bitcast<vec4u>(${v}).x);`); return; }
    if (info.dim === 'buffer') {
      let f = BUF_FMT[this.hint('u' + id).format] || (ty === 'u' ? BUF_FMT[42] : ty === 'i' ? BUF_FMT[43] : BUF_FMT[41]);
      if (f[0] === 0.5) f = BUF_FMT[42];
      const n = f[0], words = n === 1 && (f === BUF_FMT[28] || f === BUF_FMT[34]) ? null : n;
      this.emit(`{ let ba = ${a}.x * ${n}u; let bv = bitcast<vec4u>(${v});`); this.ind++;
      if (f === BUF_FMT[28]) this.emit(`u${id}[ba] = pack4x8unorm(bitcast<vec4f>(bv));`);
      else if (f === BUF_FMT[31]) this.emit(`u${id}[ba] = pack4x8snorm(bitcast<vec4f>(bv));`);
      else if (f === BUF_FMT[87]) this.emit(`u${id}[ba] = pack4x8unorm(bitcast<vec4f>(bv).zyxw);`);
      else if (f === BUF_FMT[10]) { this.emit(`u${id}[ba] = pack2x16float(bitcast<vec4f>(bv).xy);`); this.emit(`u${id}[ba + 1u] = pack2x16float(bitcast<vec4f>(bv).zw);`); }
      else for (let c = 0; c < words; c++) this.emit(`u${id}[ba + ${c}u] = bv.${SW[c]};`);
      this.ind--; this.emit('}'); return;
    }
    this.emit(`textureStore(u${id}, ${this.uavCoord(info, a)}, ${this.storeVal(id, v, ty)});`);
  }
  storeVal(id, v, ty) { const f = this.uavFormat(id); const want = /uint/.test(f) ? 'u' : /sint/.test(f) ? 'i' : 'f';
    if (want === ty) return v; return want === 'f' ? `bitcast<vec4f>(bitcast<vec4u>(${v}))` : want === 'u' ? `bitcast<vec4u>(${v})` : `bitcast<vec4i>(${v})`; }
  uavFormat(id) { const hh = this.hint('u' + id), h = hh.format, ty = this.uav[id].ret || 'f';
    if (hh.wfmt) return hh.wfmt;
    return STORAGE_FMT[h] || (ty === 'u' ? 'r32uint' : ty === 'i' ? 'r32sint' : 'rgba16float'); }

  fitLimits() {
    const lim = this.opts.limits || {}, fit = { merged: [], dropped: new Set(), scalar: false };
    const isBuf = r => r.dim === 'raw' || r.dim === 'struct' || r.dim === 'buffer';
    let text = null; const body = () => text === null ? this.body.join('\n') : text;
    const srvB = Object.keys(this.srv).map(Number).filter(i => isBuf(this.srv[i])), uavB = Object.values(this.uav).filter(r => r.asBuf || isBuf(r)).length;
    const maxB = lim.maxStorageBuffersPerShaderStage;
    if (maxB && srvB.length + uavB > maxB && srvB.length > 1 && uavB < maxB) {
      let b = body();
      srvB.forEach((id, k) => { b = b.split(`arrayLength(&t${id})`).join(`tmo[${k}u].y`); b = rewriteIndex(b, 't' + id, ix => `tm[tmo[${k}u].x + (${ix})]`); });
      text = b; fit.merged = srvB;
    }
    const texIds = Object.keys(this.srv).map(Number).filter(i => !isBuf(this.srv[i])), maxT = lim.maxSampledTexturesPerShaderStage;
    if (maxT && texIds.length > maxT) {
      const rank = i => ({ cubearray: 0, cube: 1, '3d': 2 })[this.srv[i].dim] ?? 3;
      let b = body(), need = texIds.length - maxT;
      for (const id of texIds.filter(i => !this.cmpTex.has(i)).sort((a, c) => rank(a) - rank(c) || c - a)) {
        if (!need) break; const ret = this.srv[id].ret;
        const r = dropTexture(b, 't' + id, ret === 'u' ? 'vec4u(0u)' : ret === 'i' ? 'vec4i(0)' : 'vec4f(0.0)'); if (r === null) continue;
        b = r; fit.dropped.add(id); need--; }
      text = b;
    }
    if (this.stage === 'cs' && this.nUni && lim.maxComputeWorkgroupStorageSize) {
      let bytes = this.nUni * 16; for (const g of Object.values(this.tgsm)) bytes += Math.ceil(Math.max(1, g.words) / 4) * 16;
      if (bytes > lim.maxComputeWorkgroupStorageSize) fit.scalar = true;
    }
    if (text !== null) this.body = text.split('\n');
    return fit;
  }

  module() {
    this.scan();
    this.markUniform();
    for (const [id, r] of Object.entries(this.uav)) if (this.atomicRes.has('u' + id) && /^(2d|2darray|3d)$/.test(r.dim)) { const h = this.hint('u' + id); r.asBuf = true; r.w = h.w || 1; r.h = h.h || 1; }
    this.gen();
    const fit = this.fitLimits();
    const L = ['diagnostic(off, derivative_uniformity);', ''];
    const bindings = [];
    const bind = (group, slot, kind, decl, extra) => { const b = this.base + slot; bindings.push({ group, binding: b, slot, kind, ...extra }); L.push(`@group(${group}) @binding(${b}) ${decl}`); };
    for (const [id, n] of Object.entries(this.cbs)) bind(0, +id, 'cb', `var<uniform> cb${id}: array<vec4u, ${n}>;`, { size: n * 16 });
    for (const [id, r] of Object.entries(this.srv)) {
      if (fit.merged.includes(+id) || fit.dropped.has(+id)) continue;
      if (r.dim === 'raw' || r.dim === 'struct' || r.dim === 'buffer') bind(1, +id, r.dim === 'buffer' ? 'srv_buffer' : 'srv_' + r.dim, `var<storage, read> t${id}: array<u32>;`, { stride: r.stride });
      else bind(1, +id, 'srv_tex', `var t${id}: ${this.texType(+id)};`, { dim: r.dim, ret: r.ret, depth: this.cmpTex.has(+id) });
    }
    for (const id of Object.keys(this.samp)) bind(2, +id, 'sampler', `var s${id}: ${this.cmpSamp.has(+id) || this.samp[id].cmp ? 'sampler_comparison' : 'sampler'};`, { cmp: this.cmpSamp.has(+id) || this.samp[id].cmp });
    for (const [id, r] of Object.entries(this.uav)) {
      if (r.asBuf) bind(3, +id, 'uav_tex_as_buffer', `var<storage, read_write> u${id}: array<atomic<u32>>;`, { dim: r.dim, w: r.w, h: r.h });
      else if (r.dim === 'raw' || r.dim === 'struct' || r.dim === 'buffer') bind(3, +id, r.dim === 'buffer' ? 'uav_buffer' : 'uav_' + r.dim,
        `var<storage, read_write> u${id}: array<${this.atomicRes.has('u' + id) ? 'atomic<u32>' : 'u32'}>;`, { stride: r.stride });
      else { const f = this.uavFormat(+id), acc = this.uavLoad.has(+id) ? 'read_write' : 'write';
        const tt = { '2d': 'texture_storage_2d', '2darray': 'texture_storage_2d_array', '3d': 'texture_storage_3d' }[r.dim] || 'texture_storage_2d';
        bind(3, +id, 'uav_tex', `var u${id}: ${tt}<${f}, ${acc}>;`, { dim: r.dim, format: f, access: acc }); }
    }
    if (fit.merged.length) { bind(1, fit.merged[0], 'srv_merged', 'var<storage, read> tm: array<u32>;', { slots: fit.merged });
      bind(0, 15, 'srv_merged_ofs', `var<uniform> tmo: array<vec4u, ${fit.merged.length}>;`, { slots: fit.merged }); }
    const uniVars = Array.from({ length: this.nUni }, (_, i) => this.body.some(l => l.includes('us' + i + ' =')) ? 'us' + i + ': i32' : 'uc' + i + ': u32');
    if (!fit.scalar) for (let i = 0; i < this.nUni; i++) L.push(`var<workgroup> ${this.body.some(l => l.includes('us' + i + ' =')) ? 'us' + i + ': i32' : 'uc' + i + ': u32'};`);
    for (const [id, g] of Object.entries(this.tgsm)) L.push(`var<workgroup> g${id}: array<${this.atomicRes.has('g' + id) ? 'atomic<u32>' : 'u32'}, ${Math.max(1, g.words)}>;`);
    if (this.icb) L.push(`var<private> icb: array<vec4u, ${this.icb.length}> = array<vec4u, ${this.icb.length}>(${this.icb.map(v => `vec4u(${v.map(hex).join(', ')})`).join(', ')});`);
    if (this.needs.has('mulhi')) L.push(
      'fn umulhi(a: vec4u, b: vec4u) -> vec4u { let al = a & vec4u(0xffffu); let ah = a >> vec4u(16u); let bl = b & vec4u(0xffffu); let bh = b >> vec4u(16u);',
      '  let lo = al * bl; let m1 = ah * bl + (lo >> vec4u(16u)); let m2 = al * bh + (m1 & vec4u(0xffffu)); return ah * bh + (m1 >> vec4u(16u)) + (m2 >> vec4u(16u)); }',
      'fn imulhi(a: vec4i, b: vec4i) -> vec4i { let u = umulhi(bitcast<vec4u>(a), bitcast<vec4u>(b));',
      '  return bitcast<vec4i>(u - select(vec4u(0u), bitcast<vec4u>(b), a < vec4i(0)) - select(vec4u(0u), bitcast<vec4u>(a), b < vec4i(0))); }');
    const locals = [];
    for (let i = 0; i < this.temps; i++) locals.push(`var r${i}: vec4u;`);
    for (const [id, n] of Object.entries(this.xtemps)) locals.push(`var x${id}: array<vec4u, ${n}>;`);
    const io = this.entry(L);
    L.push('');
    if (this.stage === 'cs') {
      L.push(`@compute @workgroup_size(${this.wg.join(', ')})`);
      L.push('fn main(@builtin(global_invocation_id) gid: vec3u, @builtin(local_invocation_id) lid: vec3u, @builtin(workgroup_id) wid: vec3u, @builtin(local_invocation_index) lidx: u32) {');
      if (fit.scalar) { L.push('  ' + uniVars.map(v => `var ${v};`).join(' ')); L.push(...[...locals.map(l => '  ' + l), ...this.body].map(scalarizeRegs), '}'); }
      else { for (const l of locals) L.push('  ' + l); L.push(...this.body, '}'); }
    } else {
      L.push('fn body() {'); for (const l of locals) L.push('  ' + l); L.push(...this.body, '}', ...io);
    }
    return { stage: this.stage, usesLayer: !!this.usesLayer, wgsl: L.join('\n'), bindings, inputs: this.ioIn, outputs: this.ioOut, workgroup: this.wg, fit: { merged: fit.merged, dropped: [...fit.dropped], scalar: fit.scalar }, pairs: [...this.pairs].map(x => x.split(':').map(Number)) };
  }

  entry(L) {
    if (this.stage === 'cs') { this.ioIn = []; this.ioOut = []; return []; }
    const inRegs = new Set(Object.keys(this.inputs).map(Number)), outRegs = new Set(Object.keys(this.outputs).map(Number));
    for (const e of this.isgn) if (e.reg >= 0) inRegs.add(e.reg);
    for (const e of this.osgn) if (e.reg >= 0 && e.sv !== 65 && e.sv !== 66) outRegs.add(e.reg);
    for (const r of inRegs) L.push(`var<private> v${r}: vec4u;`);
    for (const r of outRegs) L.push(`var<private> o${r}: vec4u;`);
    if (this.oDepth) L.push('var<private> oDepth: f32;');
    if (this.oMask) L.push('var<private> oMask: u32;');
    L.push('var<private> sampleMaskIn: u32;');
    const inF = [], pre = [], outF = [], post = [];
    this.ioIn = []; this.ioOut = [];
    const put = (reg, mask, e, ty) => { const c = [0, 1, 2, 3].filter(k => mask & (1 << k)); const v = ty === 'u' ? e : `bitcast<vec4u>(${e})`;
      pre.push(c.length === 4 ? `v${reg} = ${v};` : `{ let t = ${v}; ${c.map(k => `v${reg}.${SW[k]} = t.${SW[k]};`).join(' ')} }`); };
    if (this.stage === 'vs') {
      this.isgn.forEach((e, k) => {
        if (e.sv === 6) { inF.push(`@builtin(vertex_index) vid: u32`); put(e.reg, e.mask, 'vec4u(vid)', 'u'); return; }
        if (e.sv === 8) { inF.push(`@builtin(instance_index) iid: u32`); put(e.reg, e.mask, 'vec4u(iid)', 'u'); return; }
        const ty = ctypeChar(e.ctype); inF.push(`@location(${k}) a${k}: ${vecT(ty)}`); put(e.reg, e.mask, `a${k}`, ty);
        this.ioIn.push({ name: e.name, index: e.index, loc: k, reg: e.reg, mask: e.mask, type: ty });
      });
      this.osgn.forEach(e => {
        if (e.sv === 1) { outF.push(`@builtin(position) pos: vec4f`); post.push(`out.pos = bitcast<vec4f>(o${e.reg});`); return; }
        if (e.sv === 2 || e.sv === 3 || e.sv === 4 || e.sv === 5) return;
        const lm = this.opts.locMap, loc = lm ? lm[e.reg] : e.reg; if (loc === undefined) return;
        if (this.ioOut.some(x => x.loc === loc)) { this.ioOut.push({ name: e.name, index: e.index, loc, reg: e.reg, mask: e.mask, type: ctypeChar(e.ctype), shared: true }); return; }
        const ty = ctypeChar(e.ctype), pin = (this.opts.outInterp || {})[e.reg];
        outF.push(`@location(${loc})${ty !== 'f' ? ' @interpolate(flat)' : pin || ''} l${loc}: ${vecT(ty)}`);
        post.push(`out.l${loc} = ${ty === 'u' ? `o${e.reg}` : `bitcast<${vecT(ty)}>(o${e.reg})`};`);
        this.ioOut.push({ name: e.name, index: e.index, loc, reg: e.reg, mask: e.mask, type: ty });
      });
    } else {
      const vsOut = this.opts.vsOutputs;
      const used = new Set();
      this.isgn.forEach(e => {
        if (e.sv === 1) { inF.push(`@builtin(position) fpos: vec4f`); put(e.reg, e.mask, 'vec4f(fpos.xyz, 1.0 / fpos.w)', 'f'); return; }
        if (e.sv === 9) { inF.push(`@builtin(front_facing) ff: bool`); put(e.reg, e.mask, 'vec4u(select(0u, 0xffffffffu, ff))', 'u'); return; }
        if (e.sv === 10) { inF.push(`@builtin(sample_index) sidx: u32`); put(e.reg, e.mask, 'vec4u(sidx)', 'u'); return; }
        if (e.sv === 4) { if (!this.usesLayer) { this.usesLayer = true; L.push('override layerIdx: u32 = 0u;'); } put(e.reg, e.mask, 'vec4u(layerIdx)', 'u'); return; }
        if (e.sv === 7 || e.sv === 5) return;
        let loc = e.reg, srcMask = e.mask, vty = null;
        if (vsOut) { const m = vsOut.find(x => sigKey(x) === sigKey(e)); if (!m) return; loc = m.loc; srcMask = m.mask; vty = m.type; }
        const ty = vty || ctypeChar(e.ctype), mode = (this.inputs[e.reg] || {}).interp || 2;
        const interp = ty !== 'f' || mode === 1 ? ' @interpolate(flat)' : mode === 3 ? ' @interpolate(perspective, centroid)' : mode === 4 ? ' @interpolate(linear)' :
          mode === 5 ? ' @interpolate(linear, centroid)' : mode === 6 ? ' @interpolate(perspective, sample)' : mode === 7 ? ' @interpolate(linear, sample)' : '';
        const lmap = this.opts.locMap, syn = (this.opts.synth || {})[loc];
        if (syn && ty === 'f') { if (!used.has(loc)) { (this.synthLets = this.synthLets || []).push([loc, `let l${loc} = 2.0 * l${syn[0]} - l${syn[1]};`]); used.add(loc); } }
        else if (!used.has(loc)) { inF.push(`@location(${lmap && lmap[loc] !== undefined ? lmap[loc] : loc})${interp} l${loc}: ${vecT(ty)}`); used.add(loc); }
        const sc = [0, 1, 2, 3].filter(k => srcMask & (1 << k)), dc = [0, 1, 2, 3].filter(k => e.mask & (1 << k));
        const v = ty === 'u' ? `l${loc}` : `bitcast<vec4u>(l${loc})`;
        pre.push(dc.map((k, i) => `v${e.reg}.${SW[k]} = ${v}.${SW[sc[i] !== undefined ? sc[i] : k]};`).join(' '));
        this.ioIn.push({ name: e.name, index: e.index, loc, reg: e.reg, mask: e.mask, type: ty, interp });
      });
      this.osgn.forEach(e => {
        if (e.sv === 65 || e.sv === 67 || e.sv === 68 || e.reg < 0 && /DEPTH/i.test(e.name)) { outF.push('@builtin(frag_depth) depth: f32'); post.push('out.depth = oDepth;'); return; }
        if (e.sv === 66 || /COVERAGE/i.test(e.name)) { outF.push('@builtin(sample_mask) mask: u32'); post.push('out.mask = oMask;'); return; }
        const ty = ctypeChar(e.ctype);
        outF.push(`@location(${e.reg}) c${e.reg}: ${vecT(ty)}`); post.push(`out.c${e.reg} = ${ty === 'u' ? `o${e.reg}` : `bitcast<${vecT(ty)}>(o${e.reg})`};`);
        this.ioOut.push({ name: e.name, index: e.index, loc: e.reg, reg: e.reg, mask: e.mask, type: ty });
      });
    }
    const io = [];
    if (inF.length) io.push('struct In {', ...inF.map(f => '  ' + f + ','), '}');
    if (outF.length) io.push('struct Out {', ...outF.map(f => '  ' + f + ','), '}');
    io.push(`@${this.stage === 'vs' ? 'vertex' : 'fragment'}`);
    io.push(`fn main(${inF.length ? 'inp: In' : ''})${outF.length ? ' -> Out' : ''} {`);
    if (inF.length) for (const f of inF) { const nm = f.split(' ').find(x => x.endsWith(':')).slice(0, -1); io.push(`  let ${nm} = inp.${nm};`); }
    if (this.synthLets) for (const [, s] of this.synthLets.sort((a, b) => a[0] - b[0])) io.push('  ' + s);
    io.push(...pre.map(s => '  ' + s), '  body();');
    if (outF.length) io.push('  var out: Out;', ...post.map(s => '  ' + s), '  return out;');
    io.push('}');
    return io.filter(s => s !== '  ');
  }
}

const matchClose = (s, i) => { const o = s[i], c = o === '[' ? ']' : ')'; let d = 0; for (let j = i; j < s.length; j++) { if (s[j] === o) d++; else if (s[j] === c && --d === 0) return j; } return -1; };
function rewriteIndex(s, name, fn) {
  const re = new RegExp('\\b' + name + '\\['); let m;
  while ((m = re.exec(s))) { const a = m.index + name.length, e = matchClose(s, a); if (e < 0) break; s = s.slice(0, m.index) + fn(s.slice(a + 1, e)) + s.slice(e + 1); }
  return s; }
function dropTexture(s, name, zero) {
  const re = new RegExp('\\b' + name + '\\b', 'g'), calls = []; let m;
  while ((m = re.exec(s))) { const pre = /(texture(?:Sample|SampleLevel|SampleGrad|SampleBias|Load|Gather))\(\s*$/.exec(s.slice(Math.max(0, m.index - 40), m.index)); if (!pre) return null;
    const st = m.index - pre[0].length, e = matchClose(s, st + pre[1].length); if (e < 0) return null; calls.push([st, e]); }
  for (const [st, e] of calls.reverse()) s = s.slice(0, st) + zero + s.slice(e + 1);
  return s; }
function scalarizeRegs(l) {
  const C = ['x', 'y', 'z', 'w'];
  return l.replace(/var (r\d+): vec4u;/g, (_, r) => C.map(c => `var ${r}_${c}: u32;`).join(' '))
    .replace(/\b(r\d+) = ([^;]*);/g, (_, r, e) => `{ let t_ = ${e}; ${C.map(c => `${r}_${c} = t_.${c};`).join(' ')} }`)
    .replace(/\b(r\d+)\.([xyzw]) = /g, '$1_$2 = ')
    .replace(/\b(r\d+)\.([xyzw]{1,4})\b/g, (_, r, s) => s.length === 1 ? `${r}_${s}` : `vec${s.length}u(${s.split('').map(c => `${r}_${c}`).join(', ')})`)
    .replace(/\b(r\d+)\b(?!_)/g, r => `vec4u(${C.map(c => `${r}_${c}`).join(', ')})`)
    .replace(/workgroupUniformLoad\(&(u[cs]\d+)\)/g, '$1'); }
function translate(bytes, opts) { return new Translator(bytes, opts).module(); }
module.exports = { translate, parseSig, STAGE_BASE, STORAGE_FMT, BUF_FMT };

if (require.main === module) {
  const fs = require('fs');
  const r = translate(new Uint8Array(fs.readFileSync(process.argv[2])));
  console.log(r.wgsl);
  console.error(JSON.stringify({ stage: r.stage, bindings: r.bindings, inputs: r.inputs, outputs: r.outputs }));
}
