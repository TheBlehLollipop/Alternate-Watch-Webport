'use strict';

const bcTarget = f => /^bc4-r-snorm/.test(f) ? 'r8snorm' : /^bc4/.test(f) ? 'r8unorm' : /^bc5-rg-snorm/.test(f) ? 'rg8snorm' : /^bc5/.test(f) ? 'rg8unorm'
  : /^bc6h/.test(f) ? 'rgba16float' : /-srgb$/.test(f) ? 'rgba8unorm-srgb' : 'rgba8unorm';
const bcChannels = f => /^bc4/.test(f) ? 1 : /^bc5/.test(f) ? 2 : 4;

const pal = new Uint8Array(16);
function colorBlock(s, o, out, ox, stride, fourColor) {
  const c0 = s[o] | s[o + 1] << 8, c1 = s[o + 2] | s[o + 3] << 8;
  const r0 = (c0 >> 11) & 31, g0 = (c0 >> 5) & 63, b0 = c0 & 31, r1 = (c1 >> 11) & 31, g1 = (c1 >> 5) & 63, b1 = c1 & 31;
  pal[0] = r0 << 3 | r0 >> 2; pal[1] = g0 << 2 | g0 >> 4; pal[2] = b0 << 3 | b0 >> 2; pal[3] = 255;
  pal[4] = r1 << 3 | r1 >> 2; pal[5] = g1 << 2 | g1 >> 4; pal[6] = b1 << 3 | b1 >> 2; pal[7] = 255;
  if (fourColor || c0 > c1) {
    for (let k = 0; k < 3; k++) { pal[8 + k] = ((2 * pal[k] + pal[4 + k]) / 3 + 0.5) | 0; pal[12 + k] = ((pal[k] + 2 * pal[4 + k]) / 3 + 0.5) | 0; }
    pal[11] = pal[15] = 255;
  } else {
    for (let k = 0; k < 3; k++) { pal[8 + k] = ((pal[k] + pal[4 + k]) / 2 + 0.5) | 0; pal[12 + k] = 0; }
    pal[11] = 255; pal[15] = 0;
  }
  const bits = (s[o + 4] | s[o + 5] << 8 | s[o + 6] << 16 | s[o + 7] << 24) >>> 0;
  for (let i = 0; i < 16; i++) { const p = ((bits >>> (2 * i)) & 3) * 4, d = ox + ((i >> 2) * stride + (i & 3)) * 4;
    out[d] = pal[p]; out[d + 1] = pal[p + 1]; out[d + 2] = pal[p + 2]; out[d + 3] = pal[p + 3]; }
}
const ch8 = new Float64Array(8);
function channelBlock(s, o, out, ox, stride, nch, ch, signed) {
  let a = s[o], b = s[o + 1];
  if (signed) { a = a << 24 >> 24; b = b << 24 >> 24; if (a === -128) a = -127; if (b === -128) b = -127; }
  ch8[0] = a; ch8[1] = b;
  if (a > b) for (let k = 1; k < 7; k++) ch8[k + 1] = ((7 - k) * a + k * b) / 7;
  else { for (let k = 1; k < 5; k++) ch8[k + 1] = ((5 - k) * a + k * b) / 5; ch8[6] = signed ? -127 : 0; ch8[7] = signed ? 127 : 255; }
  const lo = (s[o + 2] | s[o + 3] << 8 | s[o + 4] << 16) >>> 0, hi = (s[o + 5] | s[o + 6] << 8 | s[o + 7] << 16) >>> 0;
  for (let i = 0; i < 16; i++) { const idx = i < 8 ? (lo >>> (3 * i)) & 7 : (hi >>> (3 * (i - 8))) & 7;
    const v = Math.round(ch8[idx]);
    out[ox + ((i >> 2) * stride + (i & 3)) * nch + ch] = signed ? v & 255 : v; }
}

const P2 = [0xcccc, 0x8888, 0xeeee, 0xecc8, 0xc880, 0xfeec, 0xfec8, 0xec80, 0xc800, 0xffec, 0xfe80, 0xe800, 0xffe8, 0xff00, 0xfff0, 0xf000,
  0xf710, 0x008e, 0x7100, 0x08ce, 0x008c, 0x7310, 0x3100, 0x8cce, 0x088c, 0x3110, 0x6666, 0x366c, 0x17e8, 0x0ff0, 0x718e, 0x399c,
  0xaaaa, 0xf0f0, 0x5a5a, 0x33cc, 0x3c3c, 0x55aa, 0x9696, 0xa55a, 0x73ce, 0x13c8, 0x324c, 0x3bdc, 0x6996, 0xc33c, 0x9966, 0x0660,
  0x0272, 0x04e4, 0x4e40, 0x2720, 0xc936, 0x936c, 0x39c6, 0x639c, 0x9336, 0x9cc6, 0x817e, 0xe718, 0xccf0, 0x0fcc, 0x7744, 0xee22];
const P3S = ['0011001102212222', '0001001122112221', '0000200122112211', '0222002200110111', '0000000011221122', '0011001100220022', '0022002211111111', '0011001122112211',
  '0000000011112222', '0000111111112222', '0000111122222222', '0012001200120012', '0112011201120112', '0122012201220122', '0011011211221222', '0011200122002220',
  '0001001101121122', '0111001120012200', '0000112211221122', '0022002200221111', '0111011102220222', '0001000122212221', '0000001101220122', '0000110022102210',
  '0122012200110000', '0012001211222222', '0110122112210110', '0000011012211221', '0022110211020022', '0110011020022222', '0011012201220011', '0000200022112221',
  '0000000211221222', '0222002200120011', '0011001200220222', '0120012001200120', '0000111122220000', '0120120120120120', '0120201212010120', '0011220011220011',
  '0011112222000011', '0101010122222222', '0000000021212121', '0022112200221122', '0022001100220011', '0220122102201221', '0101222222220101', '0000212121212121',
  '0101010101012222', '0222011102220111', '0002111200021112', '0000211221122112', '0222011101110222', '0002111211120002', '0110011001102222', '0000000021122112',
  '0110011022222222', '0022001100110022', '0022112211220022', '0000000000002112', '0002000100020001', '0222122202221222', '0101222222222222', '0111201122012220'];
const P2T = P2.map(m => { const a = new Uint8Array(16); for (let i = 0; i < 16; i++) a[i] = (m >> i) & 1; return a; });
const P3T = P3S.map(s => Uint8Array.from(s, c => +c));
const A2 = [15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 2, 8, 2, 2, 8, 8, 15, 2, 8, 2, 2, 8, 8, 2, 2,
  15, 15, 6, 8, 2, 8, 15, 15, 2, 8, 2, 2, 2, 15, 15, 6, 6, 2, 6, 8, 15, 15, 2, 2, 15, 15, 15, 15, 15, 2, 2, 15];
const A3a = [3, 3, 15, 15, 8, 3, 15, 15, 8, 8, 6, 6, 6, 5, 3, 3, 3, 3, 8, 15, 3, 3, 6, 10, 5, 8, 8, 6, 8, 5, 15, 15,
  8, 15, 3, 5, 6, 10, 8, 15, 15, 3, 15, 5, 15, 15, 15, 15, 3, 15, 5, 5, 5, 8, 5, 10, 5, 10, 8, 13, 15, 12, 3, 3];
const A3b = [15, 8, 8, 3, 15, 15, 3, 8, 15, 15, 15, 15, 15, 15, 15, 8, 15, 8, 15, 3, 15, 8, 15, 8, 3, 15, 6, 10, 15, 15, 10, 8,
  15, 3, 15, 10, 10, 8, 9, 10, 6, 15, 8, 15, 3, 6, 6, 8, 15, 3, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 3, 15, 15, 8];
const W2 = [0, 21, 43, 64], W3 = [0, 9, 18, 27, 37, 46, 55, 64], W4 = [0, 4, 9, 13, 17, 21, 26, 30, 34, 38, 43, 47, 51, 55, 60, 64];
const WT = [null, null, W2, W3, W4];

class Bits {
  set(s, o) { this.s = s; this.o = o; this.p = 0; return this; }
  get(n) { let v = 0; for (let i = 0; i < n; i++, this.p++) v |= ((this.s[this.o + (this.p >> 3)] >> (this.p & 7)) & 1) << i; return v >>> 0; }
}
const BR = new Bits();

const M7 = [[3, 4, 0, 0, 4, 0, 1, 0, 3, 0], [2, 6, 0, 0, 6, 0, 0, 1, 3, 0], [3, 6, 0, 0, 5, 0, 0, 0, 2, 0], [2, 6, 0, 0, 7, 0, 1, 0, 2, 0],
  [1, 0, 2, 1, 5, 6, 0, 0, 2, 3], [1, 0, 2, 0, 7, 8, 0, 0, 2, 2], [1, 0, 0, 0, 7, 7, 1, 0, 4, 0], [2, 6, 0, 0, 5, 5, 1, 0, 2, 0]];
const ep7 = new Int32Array(6 * 4), idx7 = new Uint8Array(16), idx7b = new Uint8Array(16);
function bc7Block(s, o, out, ox, stride) {
  let mode = 0; while (mode < 8 && !(s[o] & (1 << mode))) mode++;
  if (mode === 8) { for (let i = 0; i < 16; i++) { const d = ox + ((i >> 2) * stride + (i & 3)) * 4; out[d] = out[d + 1] = out[d + 2] = out[d + 3] = 0; } return; }
  const [ns, pb, rb, isb, cb, ab, epb, spb, ib, ib2] = M7[mode], r = BR.set(s, o); r.get(mode + 1);
  const part = r.get(pb), rot = r.get(rb), isel = r.get(isb), ne = ns * 2;
  for (let c = 0; c < 3; c++) for (let e = 0; e < ne; e++) ep7[e * 4 + c] = r.get(cb);
  for (let e = 0; e < ne; e++) ep7[e * 4 + 3] = ab ? r.get(ab) : 255;
  let cbits = cb, abits = ab;
  if (epb) { for (let e = 0; e < ne; e++) { const p = r.get(1); for (let c = 0; c < 4; c++) if (c < 3 || ab) ep7[e * 4 + c] = ep7[e * 4 + c] << 1 | p; } cbits++; if (ab) abits++; }
  if (spb) { for (let k = 0; k < ns; k++) { const p = r.get(1); for (const e of [2 * k, 2 * k + 1]) for (let c = 0; c < 4; c++) if (c < 3 || ab) ep7[e * 4 + c] = ep7[e * 4 + c] << 1 | p; } cbits++; if (ab) abits++; }
  for (let e = 0; e < ne; e++) for (let c = 0; c < 4; c++) { const b = c < 3 ? cbits : abits; if (c === 3 && !ab) continue; const v = ep7[e * 4 + c] << (8 - b); ep7[e * 4 + c] = v | v >> b; }
  const P = ns === 2 ? P2T[part] : ns === 3 ? P3T[part] : null;
  const anc1 = ns === 2 ? A2[part] : ns === 3 ? A3a[part] : -1, anc2 = ns === 3 ? A3b[part] : -1;
  for (let i = 0; i < 16; i++) idx7[i] = r.get(i === 0 || i === anc1 || i === anc2 ? ib - 1 : ib);
  if (ib2) for (let i = 0; i < 16; i++) idx7b[i] = r.get(i === 0 ? ib2 - 1 : ib2);
  const cw = WT[ib2 && isel ? ib2 : ib], aw = WT[ib2 ? (isel ? ib : ib2) : ib];
  for (let i = 0; i < 16; i++) {
    const sub = P ? P[i] : 0, e0 = sub * 8, e1 = e0 + 4;
    const ci = ib2 ? (isel ? idx7b[i] : idx7[i]) : idx7[i], ai = ib2 ? (isel ? idx7[i] : idx7b[i]) : idx7[i];
    const wc = cw[ci], wa = aw[ai], d = ox + ((i >> 2) * stride + (i & 3)) * 4;
    let R = (ep7[e0] * (64 - wc) + ep7[e1] * wc + 32) >> 6, G = (ep7[e0 + 1] * (64 - wc) + ep7[e1 + 1] * wc + 32) >> 6, B = (ep7[e0 + 2] * (64 - wc) + ep7[e1 + 2] * wc + 32) >> 6;
    let A = ab ? (ep7[e0 + 3] * (64 - wa) + ep7[e1 + 3] * wa + 32) >> 6 : 255, t;
    if (rot === 1) { t = A; A = R; R = t; } else if (rot === 2) { t = A; A = G; G = t; } else if (rot === 3) { t = A; A = B; B = t; }
    out[d] = R; out[d + 1] = G; out[d + 2] = B; out[d + 3] = A;
  }
}

const L6 = s => s.split(',').flatMap(t => { t = t.trim(); const m = /^(\w\w|d)\[(\d+)(?::(\d+))?\]$/.exec(t); const f = m[1], a = +m[2], b = m[3] === undefined ? a : +m[3];
  const r = []; if (a >= b) for (let i = b; i <= a; i++) r.push([f, i]); else for (let i = b; i >= a; i--) r.push([f, i]); return r; });
const M6 = [
  [0x00, 2, 1, 10, [5, 5, 5], 2, 'gy[4],by[4],bz[4],rw[9:0],gw[9:0],bw[9:0],rx[4:0],gz[4],gy[3:0],gx[4:0],bz[0],gz[3:0],bx[4:0],bz[1],by[3:0],ry[4:0],bz[2],rz[4:0],bz[3],d[4:0]'],
  [0x01, 2, 1, 7, [6, 6, 6], 2, 'gy[5],gz[4],gz[5],rw[6:0],bz[0],bz[1],by[4],gw[6:0],by[5],bz[2],gy[4],bw[6:0],bz[3],bz[5],bz[4],rx[5:0],gy[3:0],gx[5:0],gz[3:0],bx[5:0],by[3:0],ry[5:0],rz[5:0],d[4:0]'],
  [0x02, 5, 1, 11, [5, 4, 4], 2, 'rw[9:0],gw[9:0],bw[9:0],rx[4:0],rw[10],gy[3:0],gx[3:0],gw[10],bz[0],gz[3:0],bx[3:0],bw[10],bz[1],by[3:0],ry[4:0],bz[2],rz[4:0],bz[3],d[4:0]'],
  [0x06, 5, 1, 11, [4, 5, 4], 2, 'rw[9:0],gw[9:0],bw[9:0],rx[3:0],rw[10],gz[4],gy[3:0],gx[4:0],gw[10],gz[3:0],bx[3:0],bw[10],bz[1],by[3:0],ry[3:0],bz[0],bz[2],rz[3:0],gy[4],bz[3],d[4:0]'],
  [0x0a, 5, 1, 11, [4, 4, 5], 2, 'rw[9:0],gw[9:0],bw[9:0],rx[3:0],rw[10],by[4],gy[3:0],gx[3:0],gw[10],bz[0],gz[3:0],bx[4:0],bw[10],by[3:0],ry[3:0],bz[1],bz[2],rz[3:0],bz[4],bz[3],d[4:0]'],
  [0x0e, 5, 1, 9, [5, 5, 5], 2, 'rw[8:0],by[4],gw[8:0],gy[4],bw[8:0],bz[4],rx[4:0],gz[4],gy[3:0],gx[4:0],bz[0],gz[3:0],bx[4:0],bz[1],by[3:0],ry[4:0],bz[2],rz[4:0],bz[3],d[4:0]'],
  [0x12, 5, 1, 8, [6, 5, 5], 2, 'rw[7:0],gz[4],by[4],gw[7:0],bz[2],gy[4],bw[7:0],bz[3],bz[4],rx[5:0],gy[3:0],gx[4:0],bz[0],gz[3:0],bx[4:0],bz[1],by[3:0],ry[5:0],rz[5:0],d[4:0]'],
  [0x16, 5, 1, 8, [5, 6, 5], 2, 'rw[7:0],bz[0],by[4],gw[7:0],gy[5],gy[4],bw[7:0],gz[5],bz[4],rx[4:0],gz[4],gy[3:0],gx[5:0],gz[3:0],bx[4:0],bz[1],by[3:0],ry[4:0],bz[2],rz[4:0],bz[3],d[4:0]'],
  [0x1a, 5, 1, 8, [5, 5, 6], 2, 'rw[7:0],bz[1],by[4],gw[7:0],by[5],gy[4],bw[7:0],bz[5],bz[4],rx[4:0],gz[4],gy[3:0],gx[4:0],bz[0],gz[3:0],bx[5:0],by[3:0],ry[4:0],bz[2],rz[4:0],bz[3],d[4:0]'],
  [0x1e, 5, 0, 6, [6, 6, 6], 2, 'rw[5:0],gz[4],bz[0],bz[1],by[4],gw[5:0],gy[5],by[5],bz[2],gy[4],bw[5:0],gz[5],bz[3],bz[5],bz[4],rx[5:0],gy[3:0],gx[5:0],gz[3:0],bx[5:0],by[3:0],ry[5:0],rz[5:0],d[4:0]'],
  [0x03, 5, 0, 10, [10, 10, 10], 1, 'rw[9:0],gw[9:0],bw[9:0],rx[9:0],gx[9:0],bx[9:0]'],
  [0x07, 5, 1, 11, [9, 9, 9], 1, 'rw[9:0],gw[9:0],bw[9:0],rx[8:0],rw[10],gx[8:0],gw[10],bx[8:0],bw[10]'],
  [0x0b, 5, 1, 12, [8, 8, 8], 1, 'rw[9:0],gw[9:0],bw[9:0],rx[7:0],rw[10:11],gx[7:0],gw[10:11],bx[7:0],bw[10:11]'],
  [0x0f, 5, 1, 16, [4, 4, 4], 1, 'rw[9:0],gw[9:0],bw[9:0],rx[3:0],rw[10:15],gx[3:0],gw[10:15],bx[3:0],bw[10:15]']].map(m => ({ mv: m[0], mb: m[1], tr: m[2], epb: m[3], db: m[4], ns: m[5], lay: L6(m[6]) }));
const FI = { r: 0, g: 1, b: 2 }, EI = { w: 0, x: 1, y: 2, z: 3 };
const ep6 = new Int32Array(12), idx6 = new Uint8Array(16);
const sext = (v, n) => (v << (32 - n)) >> (32 - n);
const unq6 = (c, epb, signed) => {
  if (!signed) { if (epb >= 15) return c; if (c === 0) return 0; if (c === (1 << epb) - 1) return 0xffff; return ((c << 15) + 0x4000) >> (epb - 1); }
  if (epb >= 16) return c; let s = 0; if (c < 0) { s = 1; c = -c; }
  let u; if (c === 0) u = 0; else if (c >= (1 << (epb - 1)) - 1) u = 0x7fff; else u = ((c << 15) + 0x4000) >> (epb - 1);
  return s ? -u : u; };
const fin6 = (v, signed) => { if (!signed) return (v * 31) >> 6; if (v < 0) return 0x8000 | (((-v) * 31) >> 5); return (v * 31) >> 5; };
function bc6Block(s, o, out, ox, stride, signed) {
  const r = BR.set(s, o); let m = null;
  const m2 = r.get(2);
  if (m2 < 2) m = M6[m2]; else { const m5 = m2 | r.get(3) << 2; m = M6.find(x => x.mb === 5 && x.mv === m5) || null; }
  if (!m) { for (let i = 0; i < 16; i++) { const d = ox + ((i >> 2) * stride + (i & 3)) * 4; out[d] = out[d + 1] = out[d + 2] = 0; out[d + 3] = 0x3c00; } return; }
  ep6.fill(0); let part = 0;
  for (const [f, b] of m.lay) { const v = r.get(1); if (f === 'd') part |= v << b; else ep6[EI[f[1]] * 3 + FI[f[0]]] |= v << b; }
  const ne = m.ns * 2, mask = (1 << m.epb) - 1;
  for (let c = 0; c < 3; c++) {
    if (signed) ep6[c] = sext(ep6[c], m.epb);
    for (let e = 1; e < ne; e++) { let v = ep6[e * 3 + c];
      if (m.tr) { v = (ep6[c] + sext(v, m.db[c])) & mask; if (signed) v = sext(v, m.epb); }
      else if (signed) v = sext(v, m.epb);
      ep6[e * 3 + c] = v; } }
  for (let i = 0; i < ne * 3; i++) ep6[i] = unq6(ep6[i], m.epb, signed);
  const ib = m.ns === 2 ? 3 : 4, P = m.ns === 2 ? P2T[part] : null, anc = m.ns === 2 ? A2[part] : -1, W = WT[ib];
  for (let i = 0; i < 16; i++) idx6[i] = r.get(i === 0 || i === anc ? ib - 1 : ib);
  for (let i = 0; i < 16; i++) { const e0 = (P ? P[i] : 0) * 6, w = W[idx6[i]], d = ox + ((i >> 2) * stride + (i & 3)) * 4;
    for (let c = 0; c < 3; c++) out[d + c] = fin6((ep6[e0 + c] * (64 - w) + ep6[e0 + 3 + c] * w + 32) >> 6, signed);
    out[d + 3] = 0x3c00; }
}

function decode(fmt, src, bw, bh) {
  const nb = bw >> 2, nbh = bh >> 2, nch = bcChannels(fmt), b6 = /^bc6h/.test(fmt);
  const out = b6 ? new Uint16Array(bw * bh * 4) : new Uint8Array(bw * bh * nch);
  const bs = /^bc[14]/.test(fmt) ? 8 : 16, signed = /snorm|bc6h-rgb-float/.test(fmt), kind = fmt.slice(0, 3);
  for (let by = 0; by < nbh; by++) for (let bx = 0; bx < nb; bx++) {
    const o = (by * nb + bx) * bs, ox = by * 4 * bw + bx * 4;
    if (o + bs > src.length) continue;
    switch (kind) {
      case 'bc1': colorBlock(src, o, out, ox * 4, bw, false); break;
      case 'bc2': colorBlock(src, o + 8, out, ox * 4, bw, true);
        for (let i = 0; i < 16; i++) { const a = (src[o + (i >> 1)] >> ((i & 1) * 4)) & 15; out[(ox + (i >> 2) * bw + (i & 3)) * 4 + 3] = a * 17; } break;
      case 'bc3': colorBlock(src, o + 8, out, ox * 4, bw, true); channelBlock(src, o, out, ox * 4, bw, 4, 3, false); break;
      case 'bc4': channelBlock(src, o, out, ox, bw, 1, 0, signed); break;
      case 'bc5': channelBlock(src, o, out, ox * 2, bw, 2, 0, signed); channelBlock(src, o + 8, out, ox * 2, bw, 2, 1, signed); break;
      case 'bc6': bc6Block(src, o, out, ox * 4, bw, signed); break;
      case 'bc7': bc7Block(src, o, out, ox * 4, bw); break;
    }
  }
  return out;
}
module.exports = { decode, bcTarget };
