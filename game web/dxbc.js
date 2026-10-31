'use strict';

const OPS = ('add and break breakc call callc case continue continuec cut default deriv_rtx deriv_rty discard div dp2 dp3 dp4 ' +
  'else emit emitthencut endif endloop endswitch eq exp frc ftoi ftou ge iadd if ieq ige ilt imad imax imin imul ine ineg ' +
  'ishl ishr itof label ld ld_ms log loop lt mad min max customdata mov movc mul ne nop not or resinfo ret retc round_ne ' +
  'round_ni round_pi round_z rsq sample sample_c sample_c_lz sample_l sample_d sample_b sqrt switch sincos udiv ult uge umul ' +
  'umad umax umin ushr utof xor dcl_resource dcl_constant_buffer dcl_sampler dcl_index_range dcl_gs_output_primitive_topology ' +
  'dcl_gs_input_primitive dcl_max_output_vertex_count dcl_input dcl_input_sgv dcl_input_siv dcl_input_ps dcl_input_ps_sgv ' +
  'dcl_input_ps_siv dcl_output dcl_output_sgv dcl_output_siv dcl_temps dcl_indexable_temp dcl_global_flags reserved0 ' +
  'lod gather4 sample_pos sample_info reserved1 hs_decls hs_control_point_phase hs_fork_phase hs_join_phase emit_stream cut_stream ' +
  'emitthencut_stream interface_call bufinfo deriv_rtx_coarse deriv_rtx_fine deriv_rty_coarse deriv_rty_fine gather4_c gather4_po ' +
  'gather4_po_c rcp f32tof16 f16tof32 uaddc usubb countbits firstbit_hi firstbit_lo firstbit_shi ubfe ibfe bfi bfrev swapc ' +
  'dcl_stream dcl_function_body dcl_function_table dcl_interface dcl_input_control_point_count dcl_output_control_point_count ' +
  'dcl_tess_domain dcl_tess_partitioning dcl_tess_output_primitive dcl_hs_max_tessfactor dcl_hs_fork_phase_instance_count ' +
  'dcl_hs_join_phase_instance_count dcl_thread_group dcl_uav_typed dcl_uav_raw dcl_uav_structured dcl_tgsm_raw dcl_tgsm_structured ' +
  'dcl_resource_raw dcl_resource_structured ld_uav_typed store_uav_typed ld_raw store_raw ld_structured store_structured ' +
  'atomic_and atomic_or atomic_xor atomic_cmp_store atomic_iadd atomic_imax atomic_imin atomic_umax atomic_umin ' +
  'imm_atomic_alloc imm_atomic_consume imm_atomic_iadd imm_atomic_and imm_atomic_or imm_atomic_xor imm_atomic_exch ' +
  'imm_atomic_cmp_exch imm_atomic_imax imm_atomic_imin imm_atomic_umax imm_atomic_umin sync dadd dmax dmin dmul deq dge dlt dne ' +
  'dmov dmovc dtof ftod eval_snapped eval_sample_index eval_centroid dcl_gs_instance_count abort debug_break reserved2 ddiv dfma ' +
  'drcp msad dtoi dtou itod utod').split(' ');
const CUSTOMDATA = 0x35;

function parseContainer(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== 0x43425844) throw new Error('not DXBC');
  const n = dv.getUint32(28, true), chunks = {};
  for (let i = 0; i < n; i++) {
    const off = dv.getUint32(32 + 4 * i, true);
    const cc = String.fromCharCode(buf[off], buf[off + 1], buf[off + 2], buf[off + 3]);
    chunks[cc] = buf.subarray(off + 8, off + 8 + dv.getUint32(off + 4, true));
  }
  return chunks;
}

function parseProgram(code) {
  const t = new Uint32Array(code.buffer.slice(code.byteOffset, code.byteOffset + code.byteLength));
  const ver = t[0], len = t[1], ins = [];
  for (let p = 2; p < len;) {
    const op = t[p] & 0x7ff;
    const n = op === CUSTOMDATA ? t[p + 1] : (t[p] >>> 24) & 0x7f;
    if (!n) throw new Error('zero-length instruction at dword ' + p);
    ins.push({ op, name: OPS[op] || 'op' + op, tokens: t.subarray(p, p + n) });
    p += n;
  }
  return { type: 'ps vs gs hs ds cs'.split(' ')[ver >>> 16] || '?', major: (ver >> 4) & 15, minor: ver & 15, ins };
}

function parse(buf) {
  const chunks = parseContainer(buf);
  const shex = chunks.SHEX || chunks.SHDR;
  return { chunks, prog: shex ? parseProgram(shex) : null };
}

module.exports = { OPS, parseContainer, parseProgram, parse };

if (require.main === module) {
  const fs = require('fs'), path = require('path');
  const files = process.argv.slice(2).flatMap(a => fs.statSync(a).isDirectory() ? fs.readdirSync(a).map(f => path.join(a, f)) : [a]);
  const hist = {}, chunkSet = {}, models = {};
  for (const f of files) {
    const { chunks, prog } = parse(new Uint8Array(fs.readFileSync(f)));
    for (const c in chunks) chunkSet[c] = (chunkSet[c] || 0) + 1;
    if (!prog) continue;
    const m = prog.type + '_' + prog.major + '_' + prog.minor; models[m] = (models[m] || 0) + 1;
    const seen = new Set(prog.ins.map(i => i.name));
    for (const s of seen) hist[s] = (hist[s] || 0) + 1;
  }
  console.log('files', files.length, 'models', JSON.stringify(models));
  console.log('chunks', JSON.stringify(chunkSet));
  console.log('opcodes (number of shaders using each):');
  console.log(Object.entries(hist).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ':' + v).join('  '));
}
