
var Port = (() => {
  var _scriptName = globalThis.document?.currentScript?.src;
  return async function(moduleArg = {}) {
    var Module = moduleArg;
var ENVIRONMENT_IS_WEB = !!globalThis.window;

var ENVIRONMENT_IS_WORKER = !!globalThis.WorkerGlobalScope;

var ENVIRONMENT_IS_NODE = globalThis.process?.versions?.node && globalThis.process?.type != "renderer";

var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

var programArgs = [];

var thisProgram = "./this.program";

var quit_ = (status, toThrow) => {
  throw toThrow;
};

if (ENVIRONMENT_IS_WORKER) {
  _scriptName = self.location.href;
}

var scriptDirectory = "";

function locateFile(path) {
  if (Module["locateFile"]) {
    return Module["locateFile"](path, scriptDirectory);
  }
  return scriptDirectory + path;
}

var readAsync, readBinary;

if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  try {
    scriptDirectory = new URL(".", _scriptName).href;
  } catch {}
  {
    if (ENVIRONMENT_IS_WORKER) {
      readBinary = url => {
        var xhr = new XMLHttpRequest;
        xhr.open("GET", url, false);
        xhr.responseType = "arraybuffer";
        xhr.send(null);
        return new Uint8Array(  (xhr.response));
      };
    }
    readAsync = async url => {
      var response = await fetch(url, {
        credentials: "same-origin"
      });
      if (response.ok) {
        return response.arrayBuffer();
      }
      throw new Error(response.status + " : " + response.url);
    };
  }
} else {}

var out = console.log.bind(console);

var err = console.error.bind(console);

var wasmBinary;

var ABORT = false;

var EXITSTATUS;

function assert(condition, text) {
  if (!condition) {
    abort(text);
  }
}

var isFileURI = filename => filename.startsWith("file://");

class EmscriptenEH {}

var runtimeInitialized = false;

function getMemoryBuffer() {
  return wasmMemory.buffer;
}

function updateMemoryViews() {
  if (HEAP8?.buffer?.resizable) return;
  var b = getMemoryBuffer();
  HEAP8 = new Int8Array(b);
  Module["HEAPU8"] = HEAPU8 = new Uint8Array(b);
  HEAPU32 = new Uint32Array(b);
}

function preRun() {
  var preRun = Module["preRun"];
  if (preRun) {
    if (typeof preRun === "function") preRun = [ preRun ];
    onPreRuns.push(...preRun);
  }
  callRuntimeCallbacks(onPreRuns);
}

function initRuntime() {
  runtimeInitialized = true;
  wasmExports["__wasm_call_ctors"]();
}

function postRun() {
  var postRun = Module["postRun"];
  if (postRun) {
    if (typeof postRun === "function") postRun = [ postRun ];
    onPostRuns.push(...postRun);
  }
  callRuntimeCallbacks(onPostRuns);
}

function abort(what) {
  Module["onAbort"]?.(what);
  what = `Aborted(${what})`;
  err(what);
  ABORT = true;
  what += ". Build with -sASSERTIONS for more info.";
  throw new WebAssembly.RuntimeError(what);
}

var wasmBinaryFile;

function findWasmBinary() {
  return locateFile("port.wasm");
}

function getBinarySync(file) {
  if (readBinary) {
    return readBinary(file);
  }
  throw "both async and sync fetching of the wasm failed";
}

async function getWasmBinary(binaryFile) {
  if (!wasmBinary) {
    try {
      var response = await readAsync(binaryFile);
      return new Uint8Array(response);
    } catch {}
  }
  return getBinarySync(binaryFile);
}

async function instantiateArrayBuffer(binaryFile, imports) {
  try {
    var binary = await getWasmBinary(binaryFile);
    var instance = await WebAssembly.instantiate(binary, imports);
    return instance;
  } catch (reason) {
    err(`failed to asynchronously prepare wasm: ${reason}`);
    abort(reason);
  }
}

async function instantiateAsync(binary, binaryFile, imports) {
  if (!binary) {
    try {
      var response = fetch(binaryFile, {
        credentials: "same-origin"
      });
      var instantiationResult = await WebAssembly.instantiateStreaming(response, imports);
      return instantiationResult;
    } catch (reason) {
      err(`wasm streaming compile failed: ${reason}`);
      err("falling back to ArrayBuffer instantiation");
    }
  }
  return instantiateArrayBuffer(binaryFile, imports);
}

function getWasmImports() {
  var imports = {
    "env": wasmImports,
    "wasi_snapshot_preview1": wasmImports
  };
  return imports;
}

async function createWasm() {
  function receiveInstance(instance) {
    wasmExports = instance.exports;
    wasmExports = applySignatureConversions(wasmExports);
    assignWasmExports(wasmExports);
    updateMemoryViews();
    return wasmExports;
  }
  function receiveInstantiationResult(result) {
    return receiveInstance(result["instance"]);
  }
  var info = getWasmImports();
  var instantiateWasm = Module["instantiateWasm"];
  if (instantiateWasm) {
    return new Promise(resolve => {
      instantiateWasm(info, inst => resolve(receiveInstance(inst)));
    });
  }
  wasmBinaryFile ??= findWasmBinary();
  var result = await instantiateAsync(wasmBinary, wasmBinaryFile, info);
  var exports = receiveInstantiationResult(result);
  return exports;
}

class ExitStatus {
  name="ExitStatus";
  constructor(status) {
    this.message = `Program terminated with exit(${status})`;
    this.status = status;
  }
}

var HEAP8;

var callRuntimeCallbacks = callbacks => {
  while (callbacks.length > 0) {
    callbacks.shift()(Module);
  }
};

var onPostRuns = [];

var addOnPostRun = cb => onPostRuns.push(cb);

var onPreRuns = [];

var addOnPreRun = cb => onPreRuns.push(cb);

var noExitRuntime = true;

var _emscripten_get_now = () => performance.now();

var getHeapMax = () =>
4294901760;

var alignMemory = (size, alignment) => Math.ceil(size / alignment) * alignment;

var growMemory = size => {
  var oldHeapSize = wasmMemory.buffer.byteLength;
  var pages = ((size - oldHeapSize + 65535) / 65536) | 0;
  try {
    wasmMemory.grow(pages);
    updateMemoryViews();
    return 1;
  } catch (e) {}
};

var INT53_MAX = 9007199254740992;

var INT53_MIN = -9007199254740992;

var bigintToI53Checked = num => (num < INT53_MIN || num > INT53_MAX) ? NaN : Number(num);

var HEAPU8;

function _emscripten_resize_heap(requestedSize) {
  requestedSize >>>= 0;
  var oldSize = HEAPU8.length;
  var maxHeapSize = getHeapMax();
  if (requestedSize > maxHeapSize) {
    return false;
  }
  for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
    var overGrownHeapSize = oldSize * (1 + .2 / cutDown);
    overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
    var newSize = Math.min(maxHeapSize, alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536));
    var replacement = growMemory(newSize);
    if (replacement) {
      return true;
    }
  }
  return false;
}

var runtimeKeepaliveCounter = 0;

var keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0;

var _proc_exit = code => {
  EXITSTATUS = code;
  if (!keepRuntimeAlive()) {
    Module["onExit"]?.(code);
    ABORT = true;
  }
  quit_(code, new ExitStatus(code));
};

var exitJS = (status, implicit) => {
  EXITSTATUS = status;
  _proc_exit(status);
};

var _exit = exitJS;

var _fd_close = fd => 52;

function _fd_seek(fd, offset, whence, newOffset) {
  offset = bigintToI53Checked(offset);
  newOffset >>>= 0;
  return 70;
}

var printCharBuffers = [ null, [], [] ];

var UTF8Decoder = globalThis.TextDecoder && new TextDecoder;

var findStringEnd = (heapOrArray, idx, maxBytesToRead, ignoreNul) => {
  var maxIdx = idx + maxBytesToRead;
  if (ignoreNul) return maxIdx;
  while (heapOrArray[idx] && !(idx >= maxIdx)) ++idx;
  return idx;
};

var UTF8ArrayToString = (heapOrArray, idx = 0, maxBytesToRead, ignoreNul) => {
  idx >>>= 0;
  var endPtr = findStringEnd(heapOrArray, idx, maxBytesToRead, ignoreNul);
  if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
    return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
  }
  var str = "";
  while (idx < endPtr) {
    var u0 = heapOrArray[idx++];
    if (!(u0 & 128)) {
      str += String.fromCharCode(u0);
      continue;
    }
    var u1 = heapOrArray[idx++] & 63;
    if ((u0 & 224) == 192) {
      str += String.fromCharCode(((u0 & 31) << 6) | u1);
      continue;
    }
    var u2 = heapOrArray[idx++] & 63;
    if ((u0 & 240) == 224) {
      u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
    } else {
      u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heapOrArray[idx++] & 63);
    }
    if (u0 < 65536) {
      str += String.fromCharCode(u0);
    } else {
      var ch = u0 - 65536;
      str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
    }
  }
  return str;
};

var printChar = (stream, curr) => {
  var buffer = printCharBuffers[stream];
  if (!curr || curr === 10) {
    (stream === 1 ? out : err)(UTF8ArrayToString(buffer));
    buffer.length = 0;
  } else {
    buffer.push(curr);
  }
};

var flush_NO_FILESYSTEM = () => {
  if (printCharBuffers[1].length) printChar(1, 10);
  if (printCharBuffers[2].length) printChar(2, 10);
};

var UTF8ToString = (ptr, maxBytesToRead, ignoreNul) => {
  ptr >>>= 0;
  return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead, ignoreNul) : "";
};

var SYSCALLS = {
  varargs: undefined,
  getStr(ptr) {
    var ret = UTF8ToString(ptr);
    return ret;
  }
};

var HEAPU32;

function _fd_write(fd, iov, iovcnt, pnum) {
  iov >>>= 0;
  iovcnt >>>= 0;
  pnum >>>= 0;
  var num = 0;
  for (var i = 0; i < iovcnt; i++) {
    var ptr = HEAPU32[((iov) >>> 2) >>> 0];
    var len = HEAPU32[(((iov) + (4)) >>> 2) >>> 0];
    iov += 8;
    for (var j = 0; j < len; j++) {
      printChar(fd, HEAPU8[ptr + j >>> 0]);
    }
    num += len;
  }
  HEAPU32[((pnum) >>> 2) >>> 0] = num;
  return 0;
}

{
  if (Module["noExitRuntime"]) noExitRuntime = Module["noExitRuntime"];
  if (Module["print"]) out = Module["print"];
  if (Module["printErr"]) err = Module["printErr"];
  if (Module["arguments"]) programArgs = Module["arguments"];
  if (Module["thisProgram"]) thisProgram = Module["thisProgram"];
  var preInit = Module["preInit"];
  if (preInit) {
    if (typeof preInit === "function") Module["preInit"] = preInit = [ preInit ];
    while (preInit.length > 0) {
      preInit.shift()();
    }
  }
}

function js_missing(lo, hi) {
  return Module.jsMissing ? Module.jsMissing(lo, hi) : 0;
}

function js_shim(k, R) {
  return Module.jsShim ? Module.jsShim(k, R) : 0;
}

function js_yield() {
  return Module.jsYield ? Module.jsYield() : 0;
}

var _gh_malloc_js, _gh_free_js, _gh_stats, _override_import, _data_import, _forward_import, _set_dll, _set_trace, _get_M, _new_regs, _galloc_js, _cover_start, _watch_add, _watch_hits, _trr_ptr, _trr_idx, _callsite_add, _call_guest, _guest_init, _boot, __emscripten_stack_alloc, memory, __indirect_function_table, wasmMemory;

function assignWasmExports(wasmExports) {
  _gh_malloc_js = Module["_gh_malloc_js"] = wasmExports["gh_malloc_js"];
  _gh_free_js = Module["_gh_free_js"] = wasmExports["gh_free_js"];
  _gh_stats = Module["_gh_stats"] = wasmExports["gh_stats"];
  _override_import = Module["_override_import"] = wasmExports["override_import"];
  _data_import = Module["_data_import"] = wasmExports["data_import"];
  _forward_import = Module["_forward_import"] = wasmExports["forward_import"];
  _set_dll = Module["_set_dll"] = wasmExports["set_dll"];
  _set_trace = Module["_set_trace"] = wasmExports["set_trace"];
  _get_M = Module["_get_M"] = wasmExports["get_M"];
  _new_regs = Module["_new_regs"] = wasmExports["new_regs"];
  _galloc_js = Module["_galloc_js"] = wasmExports["galloc_js"];
  _cover_start = Module["_cover_start"] = wasmExports["cover_start"];
  _watch_add = Module["_watch_add"] = wasmExports["watch_add"];
  _watch_hits = Module["_watch_hits"] = wasmExports["watch_hits"];
  _trr_ptr = Module["_trr_ptr"] = wasmExports["trr_ptr"];
  _trr_idx = Module["_trr_idx"] = wasmExports["trr_idx"];
  _callsite_add = Module["_callsite_add"] = wasmExports["callsite_add"];
  _call_guest = Module["_call_guest"] = wasmExports["call_guest"];
  _guest_init = Module["_guest_init"] = wasmExports["guest_init"];
  _boot = Module["_boot"] = wasmExports["boot"];
  __emscripten_stack_alloc = wasmExports["_emscripten_stack_alloc"];
  memory = wasmMemory = wasmExports["memory"];
  __indirect_function_table = wasmExports["__indirect_function_table"];
}

var wasmImports = {
  emscripten_get_now: _emscripten_get_now,
  emscripten_resize_heap: _emscripten_resize_heap,
  exit: _exit,
  fd_close: _fd_close,
  fd_seek: _fd_seek,
  fd_write: _fd_write,
  js_missing,
  js_shim,
  js_yield
};

function applySignatureConversions(wasmExports) {
  wasmExports = Object.assign({}, wasmExports);
  var makeWrapper_pp = f => a0 => f(a0) >>> 0;
  wasmExports["_emscripten_stack_alloc"] = makeWrapper_pp(wasmExports["_emscripten_stack_alloc"]);
  return wasmExports;
}

async function run() {
  preRun();
  var setStatus = Module["setStatus"];
  if (setStatus) {
    setStatus("Running...");
    await new Promise(resolve => setTimeout(resolve, 1));
    setTimeout(setStatus, 1, "");
  }
  if (ABORT) return;
  initRuntime();
  Module["onRuntimeInitialized"]?.();
  postRun();
}

var wasmExports;

wasmExports = await createWasm();

await run();


    return Module;
  };
})();

if (typeof exports === 'object' && typeof module === 'object') {
  module.exports = Port;
  module.exports.default = Port;
} else if (typeof define === 'function' && define['amd'])
  define([], () => Port);

