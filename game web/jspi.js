'use strict';
function jspiInstantiate(source) {
  return (info, done) => {
    const env = Object.assign({}, info.env, { js_yield: new WebAssembly.Suspending(info.env.js_yield) });
    const imports = { env, wasi_snapshot_preview1: env };
    (async () => {
      const src = await source();
      const res = typeof Response !== 'undefined' && src instanceof Response ? await WebAssembly.instantiateStreaming(src, imports) : await WebAssembly.instantiate(src, imports);
      const exp = Object.assign({}, res.instance.exports, { boot: WebAssembly.promising(res.instance.exports.boot) });
      done({ exports: exp });
    })().catch(e => { (typeof console !== 'undefined' ? console : { error() {} }).error('JSPI instantiate failed:', e); throw e; });
    return {};
  };
}
module.exports = { jspiInstantiate };
