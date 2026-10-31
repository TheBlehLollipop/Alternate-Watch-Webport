'use strict';
const FEATURES = ['texture-compression-bc', 'texture-compression-bc-sliced-3d', 'float32-filterable', 'float32-blendable', 'texture-formats-tier1', 'texture-formats-tier2',
  'bgra8unorm-storage', 'depth32float-stencil8', 'rg11b10ufloat-renderable', 'depth-clip-control', 'indirect-first-instance', 'dual-source-blending', 'clip-distances', 'timestamp-query'];
async function createDevice(gpu, log, sim) {
  sim = sim || {};
  const ad = await gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!ad) throw new Error('no WebGPU adapter');
  const requiredLimits = {};
  if (!sim.lowEnd) for (const k in ad.limits) if (typeof ad.limits[k] === 'number') requiredLimits[k] = ad.limits[k];
  for (const k in sim.limits || {}) requiredLimits[k] = Math.min(sim.limits[k], ad.limits[k]);
  const drop = new Set(sim.lowEnd ? FEATURES : sim.drop || []);
  const requiredFeatures = FEATURES.filter(f => ad.features.has(f) && !drop.has(f));
  const device = await ad.requestDevice({ requiredFeatures, requiredLimits });
  if (log && ad.info) log('[gpu] adapter: ' + [ad.info.vendor, ad.info.architecture, ad.info.device, ad.info.description].filter(Boolean).join(' / '));
  if (log) { const missing = FEATURES.filter(f => !device.features.has(f)), L = device.limits;
    log('[gpu] device ready' + (sim.lowEnd || drop.size ? ' (SIMULATED ' + (sim.lowEnd ? 'low-end device' : 'without ' + [...drop].join(', ')) + ')' : '') + (missing.length ? '; missing features: ' + missing.join(', ') : '') +
      '; limits: color bytes/sample ' + L.maxColorAttachmentBytesPerSample + ', textures/stage ' + L.maxSampledTexturesPerShaderStage + ', storage buffers/stage ' + L.maxStorageBuffersPerShaderStage +
      ', inter-stage vars ' + L.maxInterStageShaderVariables + ', workgroup storage ' + L.maxComputeWorkgroupStorageSize + ', invocations/workgroup ' + L.maxComputeInvocationsPerWorkgroup +
      ', 2D texture ' + L.maxTextureDimension2D + ', buffer ' + (L.maxBufferSize / 1048576 | 0) + ' MB'); }
  return device;
}
module.exports = { createDevice, FEATURES };
