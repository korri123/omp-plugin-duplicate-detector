// @bun
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toESMCache_node;
var __toESMCache_esm;
var __toESM = (mod, isNodeMode, target) => {
  var canCache = mod != null && typeof mod === "object";
  if (canCache) {
    var cache = isNodeMode ? __toESMCache_node ??= new WeakMap : __toESMCache_esm ??= new WeakMap;
    var cached = cache.get(mod);
    if (cached)
      return cached;
  }
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  if (mod && typeof mod === "object" || typeof mod === "function") {
    for (let key of __getOwnPropNames(mod))
      if (!__hasOwnProp.call(to, key))
        __defProp(to, key, {
          get: __accessProp.bind(mod, key),
          enumerable: true
        });
  }
  if (canCache)
    cache.set(mod, to);
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);

// node_modules/eventemitter3/index.js
var require_eventemitter3 = __commonJS(function(exports, module) {
  var has = Object.prototype.hasOwnProperty;
  var prefix = "~";
  function Events() {}
  if (Object.create) {
    Events.prototype = Object.create(null);
    if (!new Events().__proto__)
      prefix = false;
  }
  function EE(fn, context, once) {
    this.fn = fn;
    this.context = context;
    this.once = once || false;
  }
  function addListener(emitter, event, fn, context, once) {
    if (typeof fn !== "function") {
      throw new TypeError("The listener must be a function");
    }
    var listener = new EE(fn, context || emitter, once), evt = prefix ? prefix + event : event;
    if (!emitter._events[evt])
      emitter._events[evt] = listener, emitter._eventsCount++;
    else if (!emitter._events[evt].fn)
      emitter._events[evt].push(listener);
    else
      emitter._events[evt] = [emitter._events[evt], listener];
    return emitter;
  }
  function clearEvent(emitter, evt) {
    if (--emitter._eventsCount === 0)
      emitter._events = new Events;
    else
      delete emitter._events[evt];
  }
  function EventEmitter() {
    this._events = new Events;
    this._eventsCount = 0;
  }
  EventEmitter.prototype.eventNames = function eventNames() {
    var names = [], events, name;
    if (this._eventsCount === 0)
      return names;
    for (name in events = this._events) {
      if (has.call(events, name))
        names.push(prefix ? name.slice(1) : name);
    }
    if (Object.getOwnPropertySymbols) {
      return names.concat(Object.getOwnPropertySymbols(events));
    }
    return names;
  };
  EventEmitter.prototype.listeners = function listeners(event) {
    var evt = prefix ? prefix + event : event, handlers = this._events[evt];
    if (!handlers)
      return [];
    if (handlers.fn)
      return [handlers.fn];
    for (var i = 0, l = handlers.length, ee = new Array(l);i < l; i++) {
      ee[i] = handlers[i].fn;
    }
    return ee;
  };
  EventEmitter.prototype.listenerCount = function listenerCount(event) {
    var evt = prefix ? prefix + event : event, listeners = this._events[evt];
    if (!listeners)
      return 0;
    if (listeners.fn)
      return 1;
    return listeners.length;
  };
  EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
    var evt = prefix ? prefix + event : event;
    if (!this._events[evt])
      return false;
    var listeners = this._events[evt], len = arguments.length, args, i;
    if (listeners.fn) {
      if (listeners.once)
        this.removeListener(event, listeners.fn, undefined, true);
      switch (len) {
        case 1:
          return listeners.fn.call(listeners.context), true;
        case 2:
          return listeners.fn.call(listeners.context, a1), true;
        case 3:
          return listeners.fn.call(listeners.context, a1, a2), true;
        case 4:
          return listeners.fn.call(listeners.context, a1, a2, a3), true;
        case 5:
          return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
        case 6:
          return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
      }
      for (i = 1, args = new Array(len - 1);i < len; i++) {
        args[i - 1] = arguments[i];
      }
      listeners.fn.apply(listeners.context, args);
    } else {
      var length = listeners.length, j;
      for (i = 0;i < length; i++) {
        if (listeners[i].once)
          this.removeListener(event, listeners[i].fn, undefined, true);
        switch (len) {
          case 1:
            listeners[i].fn.call(listeners[i].context);
            break;
          case 2:
            listeners[i].fn.call(listeners[i].context, a1);
            break;
          case 3:
            listeners[i].fn.call(listeners[i].context, a1, a2);
            break;
          case 4:
            listeners[i].fn.call(listeners[i].context, a1, a2, a3);
            break;
          default:
            if (!args)
              for (j = 1, args = new Array(len - 1);j < len; j++) {
                args[j - 1] = arguments[j];
              }
            listeners[i].fn.apply(listeners[i].context, args);
        }
      }
    }
    return true;
  };
  EventEmitter.prototype.on = function on(event, fn, context) {
    return addListener(this, event, fn, context, false);
  };
  EventEmitter.prototype.once = function once(event, fn, context) {
    return addListener(this, event, fn, context, true);
  };
  EventEmitter.prototype.removeListener = function removeListener(event, fn, context, once) {
    var evt = prefix ? prefix + event : event;
    if (!this._events[evt])
      return this;
    if (!fn) {
      clearEvent(this, evt);
      return this;
    }
    var listeners = this._events[evt];
    if (listeners.fn) {
      if (listeners.fn === fn && (!once || listeners.once) && (!context || listeners.context === context)) {
        clearEvent(this, evt);
      }
    } else {
      for (var i = 0, events = [], length = listeners.length;i < length; i++) {
        if (listeners[i].fn !== fn || once && !listeners[i].once || context && listeners[i].context !== context) {
          events.push(listeners[i]);
        }
      }
      if (events.length)
        this._events[evt] = events.length === 1 ? events[0] : events;
      else
        clearEvent(this, evt);
    }
    return this;
  };
  EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
    var evt;
    if (event) {
      evt = prefix ? prefix + event : event;
      if (this._events[evt])
        clearEvent(this, evt);
    } else {
      this._events = new Events;
      this._eventsCount = 0;
    }
    return this;
  };
  EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
  EventEmitter.prototype.addListener = EventEmitter.prototype.on;
  EventEmitter.prefixed = prefix;
  EventEmitter.EventEmitter = EventEmitter;
  if (typeof module !== "undefined") {
    module.exports = EventEmitter;
  }
});

// node_modules/spark-md5/spark-md5.js
var require_spark_md5 = __commonJS(function(exports, module) {
  (function(factory) {
    if (typeof exports === "object") {
      module.exports = factory();
    } else if (typeof define === "function" && define.amd) {
      define(factory);
    } else {
      var glob;
      try {
        glob = window;
      } catch (e) {
        glob = self;
      }
      glob.SparkMD5 = factory();
    }
  })(function(undefined2) {
    var add32 = function(a, b) {
      return a + b & 4294967295;
    }, hex_chr = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"];
    function cmn(q, a, b, x, s, t) {
      a = add32(add32(a, q), add32(x, t));
      return add32(a << s | a >>> 32 - s, b);
    }
    function md5cycle(x, k) {
      var a = x[0], b = x[1], c = x[2], d = x[3];
      a += (b & c | ~b & d) + k[0] - 680876936 | 0;
      a = (a << 7 | a >>> 25) + b | 0;
      d += (a & b | ~a & c) + k[1] - 389564586 | 0;
      d = (d << 12 | d >>> 20) + a | 0;
      c += (d & a | ~d & b) + k[2] + 606105819 | 0;
      c = (c << 17 | c >>> 15) + d | 0;
      b += (c & d | ~c & a) + k[3] - 1044525330 | 0;
      b = (b << 22 | b >>> 10) + c | 0;
      a += (b & c | ~b & d) + k[4] - 176418897 | 0;
      a = (a << 7 | a >>> 25) + b | 0;
      d += (a & b | ~a & c) + k[5] + 1200080426 | 0;
      d = (d << 12 | d >>> 20) + a | 0;
      c += (d & a | ~d & b) + k[6] - 1473231341 | 0;
      c = (c << 17 | c >>> 15) + d | 0;
      b += (c & d | ~c & a) + k[7] - 45705983 | 0;
      b = (b << 22 | b >>> 10) + c | 0;
      a += (b & c | ~b & d) + k[8] + 1770035416 | 0;
      a = (a << 7 | a >>> 25) + b | 0;
      d += (a & b | ~a & c) + k[9] - 1958414417 | 0;
      d = (d << 12 | d >>> 20) + a | 0;
      c += (d & a | ~d & b) + k[10] - 42063 | 0;
      c = (c << 17 | c >>> 15) + d | 0;
      b += (c & d | ~c & a) + k[11] - 1990404162 | 0;
      b = (b << 22 | b >>> 10) + c | 0;
      a += (b & c | ~b & d) + k[12] + 1804603682 | 0;
      a = (a << 7 | a >>> 25) + b | 0;
      d += (a & b | ~a & c) + k[13] - 40341101 | 0;
      d = (d << 12 | d >>> 20) + a | 0;
      c += (d & a | ~d & b) + k[14] - 1502002290 | 0;
      c = (c << 17 | c >>> 15) + d | 0;
      b += (c & d | ~c & a) + k[15] + 1236535329 | 0;
      b = (b << 22 | b >>> 10) + c | 0;
      a += (b & d | c & ~d) + k[1] - 165796510 | 0;
      a = (a << 5 | a >>> 27) + b | 0;
      d += (a & c | b & ~c) + k[6] - 1069501632 | 0;
      d = (d << 9 | d >>> 23) + a | 0;
      c += (d & b | a & ~b) + k[11] + 643717713 | 0;
      c = (c << 14 | c >>> 18) + d | 0;
      b += (c & a | d & ~a) + k[0] - 373897302 | 0;
      b = (b << 20 | b >>> 12) + c | 0;
      a += (b & d | c & ~d) + k[5] - 701558691 | 0;
      a = (a << 5 | a >>> 27) + b | 0;
      d += (a & c | b & ~c) + k[10] + 38016083 | 0;
      d = (d << 9 | d >>> 23) + a | 0;
      c += (d & b | a & ~b) + k[15] - 660478335 | 0;
      c = (c << 14 | c >>> 18) + d | 0;
      b += (c & a | d & ~a) + k[4] - 405537848 | 0;
      b = (b << 20 | b >>> 12) + c | 0;
      a += (b & d | c & ~d) + k[9] + 568446438 | 0;
      a = (a << 5 | a >>> 27) + b | 0;
      d += (a & c | b & ~c) + k[14] - 1019803690 | 0;
      d = (d << 9 | d >>> 23) + a | 0;
      c += (d & b | a & ~b) + k[3] - 187363961 | 0;
      c = (c << 14 | c >>> 18) + d | 0;
      b += (c & a | d & ~a) + k[8] + 1163531501 | 0;
      b = (b << 20 | b >>> 12) + c | 0;
      a += (b & d | c & ~d) + k[13] - 1444681467 | 0;
      a = (a << 5 | a >>> 27) + b | 0;
      d += (a & c | b & ~c) + k[2] - 51403784 | 0;
      d = (d << 9 | d >>> 23) + a | 0;
      c += (d & b | a & ~b) + k[7] + 1735328473 | 0;
      c = (c << 14 | c >>> 18) + d | 0;
      b += (c & a | d & ~a) + k[12] - 1926607734 | 0;
      b = (b << 20 | b >>> 12) + c | 0;
      a += (b ^ c ^ d) + k[5] - 378558 | 0;
      a = (a << 4 | a >>> 28) + b | 0;
      d += (a ^ b ^ c) + k[8] - 2022574463 | 0;
      d = (d << 11 | d >>> 21) + a | 0;
      c += (d ^ a ^ b) + k[11] + 1839030562 | 0;
      c = (c << 16 | c >>> 16) + d | 0;
      b += (c ^ d ^ a) + k[14] - 35309556 | 0;
      b = (b << 23 | b >>> 9) + c | 0;
      a += (b ^ c ^ d) + k[1] - 1530992060 | 0;
      a = (a << 4 | a >>> 28) + b | 0;
      d += (a ^ b ^ c) + k[4] + 1272893353 | 0;
      d = (d << 11 | d >>> 21) + a | 0;
      c += (d ^ a ^ b) + k[7] - 155497632 | 0;
      c = (c << 16 | c >>> 16) + d | 0;
      b += (c ^ d ^ a) + k[10] - 1094730640 | 0;
      b = (b << 23 | b >>> 9) + c | 0;
      a += (b ^ c ^ d) + k[13] + 681279174 | 0;
      a = (a << 4 | a >>> 28) + b | 0;
      d += (a ^ b ^ c) + k[0] - 358537222 | 0;
      d = (d << 11 | d >>> 21) + a | 0;
      c += (d ^ a ^ b) + k[3] - 722521979 | 0;
      c = (c << 16 | c >>> 16) + d | 0;
      b += (c ^ d ^ a) + k[6] + 76029189 | 0;
      b = (b << 23 | b >>> 9) + c | 0;
      a += (b ^ c ^ d) + k[9] - 640364487 | 0;
      a = (a << 4 | a >>> 28) + b | 0;
      d += (a ^ b ^ c) + k[12] - 421815835 | 0;
      d = (d << 11 | d >>> 21) + a | 0;
      c += (d ^ a ^ b) + k[15] + 530742520 | 0;
      c = (c << 16 | c >>> 16) + d | 0;
      b += (c ^ d ^ a) + k[2] - 995338651 | 0;
      b = (b << 23 | b >>> 9) + c | 0;
      a += (c ^ (b | ~d)) + k[0] - 198630844 | 0;
      a = (a << 6 | a >>> 26) + b | 0;
      d += (b ^ (a | ~c)) + k[7] + 1126891415 | 0;
      d = (d << 10 | d >>> 22) + a | 0;
      c += (a ^ (d | ~b)) + k[14] - 1416354905 | 0;
      c = (c << 15 | c >>> 17) + d | 0;
      b += (d ^ (c | ~a)) + k[5] - 57434055 | 0;
      b = (b << 21 | b >>> 11) + c | 0;
      a += (c ^ (b | ~d)) + k[12] + 1700485571 | 0;
      a = (a << 6 | a >>> 26) + b | 0;
      d += (b ^ (a | ~c)) + k[3] - 1894986606 | 0;
      d = (d << 10 | d >>> 22) + a | 0;
      c += (a ^ (d | ~b)) + k[10] - 1051523 | 0;
      c = (c << 15 | c >>> 17) + d | 0;
      b += (d ^ (c | ~a)) + k[1] - 2054922799 | 0;
      b = (b << 21 | b >>> 11) + c | 0;
      a += (c ^ (b | ~d)) + k[8] + 1873313359 | 0;
      a = (a << 6 | a >>> 26) + b | 0;
      d += (b ^ (a | ~c)) + k[15] - 30611744 | 0;
      d = (d << 10 | d >>> 22) + a | 0;
      c += (a ^ (d | ~b)) + k[6] - 1560198380 | 0;
      c = (c << 15 | c >>> 17) + d | 0;
      b += (d ^ (c | ~a)) + k[13] + 1309151649 | 0;
      b = (b << 21 | b >>> 11) + c | 0;
      a += (c ^ (b | ~d)) + k[4] - 145523070 | 0;
      a = (a << 6 | a >>> 26) + b | 0;
      d += (b ^ (a | ~c)) + k[11] - 1120210379 | 0;
      d = (d << 10 | d >>> 22) + a | 0;
      c += (a ^ (d | ~b)) + k[2] + 718787259 | 0;
      c = (c << 15 | c >>> 17) + d | 0;
      b += (d ^ (c | ~a)) + k[9] - 343485551 | 0;
      b = (b << 21 | b >>> 11) + c | 0;
      x[0] = a + x[0] | 0;
      x[1] = b + x[1] | 0;
      x[2] = c + x[2] | 0;
      x[3] = d + x[3] | 0;
    }
    function md5blk(s) {
      var md5blks = [], i;
      for (i = 0;i < 64; i += 4) {
        md5blks[i >> 2] = s.charCodeAt(i) + (s.charCodeAt(i + 1) << 8) + (s.charCodeAt(i + 2) << 16) + (s.charCodeAt(i + 3) << 24);
      }
      return md5blks;
    }
    function md5blk_array(a) {
      var md5blks = [], i;
      for (i = 0;i < 64; i += 4) {
        md5blks[i >> 2] = a[i] + (a[i + 1] << 8) + (a[i + 2] << 16) + (a[i + 3] << 24);
      }
      return md5blks;
    }
    function md51(s) {
      var n = s.length, state = [1732584193, -271733879, -1732584194, 271733878], i, length, tail, tmp, lo, hi;
      for (i = 64;i <= n; i += 64) {
        md5cycle(state, md5blk(s.substring(i - 64, i)));
      }
      s = s.substring(i - 64);
      length = s.length;
      tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      for (i = 0;i < length; i += 1) {
        tail[i >> 2] |= s.charCodeAt(i) << (i % 4 << 3);
      }
      tail[i >> 2] |= 128 << (i % 4 << 3);
      if (i > 55) {
        md5cycle(state, tail);
        for (i = 0;i < 16; i += 1) {
          tail[i] = 0;
        }
      }
      tmp = n * 8;
      tmp = tmp.toString(16).match(/(.*?)(.{0,8})$/);
      lo = parseInt(tmp[2], 16);
      hi = parseInt(tmp[1], 16) || 0;
      tail[14] = lo;
      tail[15] = hi;
      md5cycle(state, tail);
      return state;
    }
    function md51_array(a) {
      var n = a.length, state = [1732584193, -271733879, -1732584194, 271733878], i, length, tail, tmp, lo, hi;
      for (i = 64;i <= n; i += 64) {
        md5cycle(state, md5blk_array(a.subarray(i - 64, i)));
      }
      a = i - 64 < n ? a.subarray(i - 64) : new Uint8Array(0);
      length = a.length;
      tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      for (i = 0;i < length; i += 1) {
        tail[i >> 2] |= a[i] << (i % 4 << 3);
      }
      tail[i >> 2] |= 128 << (i % 4 << 3);
      if (i > 55) {
        md5cycle(state, tail);
        for (i = 0;i < 16; i += 1) {
          tail[i] = 0;
        }
      }
      tmp = n * 8;
      tmp = tmp.toString(16).match(/(.*?)(.{0,8})$/);
      lo = parseInt(tmp[2], 16);
      hi = parseInt(tmp[1], 16) || 0;
      tail[14] = lo;
      tail[15] = hi;
      md5cycle(state, tail);
      return state;
    }
    function rhex(n) {
      var s = "", j;
      for (j = 0;j < 4; j += 1) {
        s += hex_chr[n >> j * 8 + 4 & 15] + hex_chr[n >> j * 8 & 15];
      }
      return s;
    }
    function hex(x) {
      var i;
      for (i = 0;i < x.length; i += 1) {
        x[i] = rhex(x[i]);
      }
      return x.join("");
    }
    if (hex(md51("hello")) !== "5d41402abc4b2a76b9719d911017c592") {
      add32 = function(x, y) {
        var lsw = (x & 65535) + (y & 65535), msw = (x >> 16) + (y >> 16) + (lsw >> 16);
        return msw << 16 | lsw & 65535;
      };
    }
    if (typeof ArrayBuffer !== "undefined" && !ArrayBuffer.prototype.slice) {
      (function() {
        function clamp(val, length) {
          val = val | 0 || 0;
          if (val < 0) {
            return Math.max(val + length, 0);
          }
          return Math.min(val, length);
        }
        ArrayBuffer.prototype.slice = function(from, to) {
          var length = this.byteLength, begin = clamp(from, length), end = length, num, target, targetArray, sourceArray;
          if (to !== undefined2) {
            end = clamp(to, length);
          }
          if (begin > end) {
            return new ArrayBuffer(0);
          }
          num = end - begin;
          target = new ArrayBuffer(num);
          targetArray = new Uint8Array(target);
          sourceArray = new Uint8Array(this, begin, num);
          targetArray.set(sourceArray);
          return target;
        };
      })();
    }
    function toUtf8(str) {
      if (/[\u0080-\uFFFF]/.test(str)) {
        str = unescape(encodeURIComponent(str));
      }
      return str;
    }
    function utf8Str2ArrayBuffer(str, returnUInt8Array) {
      var length = str.length, buff = new ArrayBuffer(length), arr = new Uint8Array(buff), i;
      for (i = 0;i < length; i += 1) {
        arr[i] = str.charCodeAt(i);
      }
      return returnUInt8Array ? arr : buff;
    }
    function arrayBuffer2Utf8Str(buff) {
      return String.fromCharCode.apply(null, new Uint8Array(buff));
    }
    function concatenateArrayBuffers(first, second, returnUInt8Array) {
      var result = new Uint8Array(first.byteLength + second.byteLength);
      result.set(new Uint8Array(first));
      result.set(new Uint8Array(second), first.byteLength);
      return returnUInt8Array ? result : result.buffer;
    }
    function hexToBinaryString(hex2) {
      var bytes = [], length = hex2.length, x;
      for (x = 0;x < length - 1; x += 2) {
        bytes.push(parseInt(hex2.substr(x, 2), 16));
      }
      return String.fromCharCode.apply(String, bytes);
    }
    function SparkMD5() {
      this.reset();
    }
    SparkMD5.prototype.append = function(str) {
      this.appendBinary(toUtf8(str));
      return this;
    };
    SparkMD5.prototype.appendBinary = function(contents) {
      this._buff += contents;
      this._length += contents.length;
      var length = this._buff.length, i;
      for (i = 64;i <= length; i += 64) {
        md5cycle(this._hash, md5blk(this._buff.substring(i - 64, i)));
      }
      this._buff = this._buff.substring(i - 64);
      return this;
    };
    SparkMD5.prototype.end = function(raw) {
      var buff = this._buff, length = buff.length, i, tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], ret;
      for (i = 0;i < length; i += 1) {
        tail[i >> 2] |= buff.charCodeAt(i) << (i % 4 << 3);
      }
      this._finish(tail, length);
      ret = hex(this._hash);
      if (raw) {
        ret = hexToBinaryString(ret);
      }
      this.reset();
      return ret;
    };
    SparkMD5.prototype.reset = function() {
      this._buff = "";
      this._length = 0;
      this._hash = [1732584193, -271733879, -1732584194, 271733878];
      return this;
    };
    SparkMD5.prototype.getState = function() {
      return {
        buff: this._buff,
        length: this._length,
        hash: this._hash.slice()
      };
    };
    SparkMD5.prototype.setState = function(state) {
      this._buff = state.buff;
      this._length = state.length;
      this._hash = state.hash;
      return this;
    };
    SparkMD5.prototype.destroy = function() {
      delete this._hash;
      delete this._buff;
      delete this._length;
    };
    SparkMD5.prototype._finish = function(tail, length) {
      var i = length, tmp, lo, hi;
      tail[i >> 2] |= 128 << (i % 4 << 3);
      if (i > 55) {
        md5cycle(this._hash, tail);
        for (i = 0;i < 16; i += 1) {
          tail[i] = 0;
        }
      }
      tmp = this._length * 8;
      tmp = tmp.toString(16).match(/(.*?)(.{0,8})$/);
      lo = parseInt(tmp[2], 16);
      hi = parseInt(tmp[1], 16) || 0;
      tail[14] = lo;
      tail[15] = hi;
      md5cycle(this._hash, tail);
    };
    SparkMD5.hash = function(str, raw) {
      return SparkMD5.hashBinary(toUtf8(str), raw);
    };
    SparkMD5.hashBinary = function(content, raw) {
      var hash = md51(content), ret = hex(hash);
      return raw ? hexToBinaryString(ret) : ret;
    };
    SparkMD5.ArrayBuffer = function() {
      this.reset();
    };
    SparkMD5.ArrayBuffer.prototype.append = function(arr) {
      var buff = concatenateArrayBuffers(this._buff.buffer, arr, true), length = buff.length, i;
      this._length += arr.byteLength;
      for (i = 64;i <= length; i += 64) {
        md5cycle(this._hash, md5blk_array(buff.subarray(i - 64, i)));
      }
      this._buff = i - 64 < length ? new Uint8Array(buff.buffer.slice(i - 64)) : new Uint8Array(0);
      return this;
    };
    SparkMD5.ArrayBuffer.prototype.end = function(raw) {
      var buff = this._buff, length = buff.length, tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], i, ret;
      for (i = 0;i < length; i += 1) {
        tail[i >> 2] |= buff[i] << (i % 4 << 3);
      }
      this._finish(tail, length);
      ret = hex(this._hash);
      if (raw) {
        ret = hexToBinaryString(ret);
      }
      this.reset();
      return ret;
    };
    SparkMD5.ArrayBuffer.prototype.reset = function() {
      this._buff = new Uint8Array(0);
      this._length = 0;
      this._hash = [1732584193, -271733879, -1732584194, 271733878];
      return this;
    };
    SparkMD5.ArrayBuffer.prototype.getState = function() {
      var state = SparkMD5.prototype.getState.call(this);
      state.buff = arrayBuffer2Utf8Str(state.buff);
      return state;
    };
    SparkMD5.ArrayBuffer.prototype.setState = function(state) {
      state.buff = utf8Str2ArrayBuffer(state.buff, true);
      return SparkMD5.prototype.setState.call(this, state);
    };
    SparkMD5.ArrayBuffer.prototype.destroy = SparkMD5.prototype.destroy;
    SparkMD5.ArrayBuffer.prototype._finish = SparkMD5.prototype._finish;
    SparkMD5.ArrayBuffer.hash = function(arr, raw) {
      var hash = md51_array(new Uint8Array(arr)), ret = hex(hash);
      return raw ? hexToBinaryString(ret) : ret;
    };
    return SparkMD5;
  });
});

// node_modules/ignore/index.js
var require_ignore = __commonJS(function(exports, module) {
  function makeArray(subject) {
    return Array.isArray(subject) ? subject : [subject];
  }
  var UNDEFINED = undefined;
  var EMPTY = "";
  var SPACE = " ";
  var ESCAPE = "\\";
  var REGEX_TEST_BLANK_LINE = /^\s+$/;
  var REGEX_INVALID_TRAILING_BACKSLASH = /(?:[^\\]|^)\\$/;
  var REGEX_REPLACE_LEADING_EXCAPED_EXCLAMATION = /^\\!/;
  var REGEX_REPLACE_LEADING_EXCAPED_HASH = /^\\#/;
  var REGEX_SPLITALL_CRLF = /\r?\n/g;
  var REGEX_TEST_INVALID_PATH = /^\.{0,2}\/|^\.{1,2}$/;
  var REGEX_TEST_TRAILING_SLASH = /\/$/;
  var SLASH = "/";
  var TMP_KEY_IGNORE = "node-ignore";
  if (typeof Symbol !== "undefined") {
    TMP_KEY_IGNORE = Symbol.for("node-ignore");
  }
  var KEY_IGNORE = TMP_KEY_IGNORE;
  var define2 = (object, key, value) => {
    Object.defineProperty(object, key, { value });
    return value;
  };
  var REGEX_REGEXP_RANGE = /([0-z])-([0-z])/g;
  var RETURN_FALSE = () => false;
  var sanitizeRange = (range) => range.replace(REGEX_REGEXP_RANGE, (match, from, to) => from.charCodeAt(0) <= to.charCodeAt(0) ? match : EMPTY);
  var negateRange = (range) => range.startsWith("!") || range.startsWith("\\^") ? `^${range.slice(range[0] === "!" ? 1 : 2)}` : range;
  var cleanRangeBackSlash = (slashes) => {
    const { length } = slashes;
    return slashes.slice(0, length - length % 2);
  };
  var REPLACERS = [
    [
      /^\uFEFF/,
      () => EMPTY
    ],
    [
      /((?:\\\\)*?)(\\?\s+)$/,
      (_, m1, m2) => m1 + (m2.indexOf("\\") === 0 ? SPACE : EMPTY)
    ],
    [
      /(\\+?)\s/g,
      (_, m1) => {
        const { length } = m1;
        return m1.slice(0, length - length % 2) + SPACE;
      }
    ],
    [
      /[\\$.|*+(){^]/g,
      (match) => `\\${match}`
    ],
    [
      /(?!\\)\?/g,
      () => "[^/]"
    ],
    [
      /^\//,
      () => "^"
    ],
    [
      /\//g,
      () => "\\/"
    ],
    [
      /^\^*(?:\\\*\\\*\\\/)+/,
      () => "^(?:.*\\/)?"
    ],
    [
      /^(?=[^^])/,
      function startingReplacer() {
        return !/\/(?!$)/.test(this) ? "(?:^|\\/)" : "^";
      }
    ],
    [
      /\\\/\\\*\\\*(?=\\\/|$)/g,
      (_, index, str) => index + 6 < str.length ? "(?:\\/[^\\/]+)*" : "\\/.+"
    ],
    [
      /(^|[^\\]+)(\\\*)+(?=.+)/g,
      (_, p1, p2) => {
        const unescaped = p2.replace(/\\\*/g, "[^\\/]*");
        return p1 + unescaped;
      }
    ],
    [
      /\\\\\\(?=[$.|*+(){^])/g,
      () => ESCAPE
    ],
    [
      /\\\\/g,
      () => ESCAPE
    ],
    [
      /(\\)?\[([^\]/]*?)(\\*)($|\])/g,
      (match, leadEscape, range, endEscape, close) => leadEscape === ESCAPE ? `\\[${range}${cleanRangeBackSlash(endEscape)}${close}` : close === "]" ? endEscape.length % 2 === 0 ? `[${negateRange(sanitizeRange(range))}${endEscape}]` : "[]" : "[]"
    ],
    [
      /(?:[^*])$/,
      (match) => /\/$/.test(match) ? `${match}$` : `${match}(?=$|\\/$)`
    ]
  ];
  var REGEX_REPLACE_TRAILING_WILDCARD = /(^|\\\/)?\\\*$/;
  var MODE_IGNORE = "regex";
  var MODE_CHECK_IGNORE = "checkRegex";
  var UNDERSCORE = "_";
  var TRAILING_WILD_CARD_REPLACERS = {
    [MODE_IGNORE](_, p1) {
      const prefix = p1 ? `${p1}[^/]+` : "[^/]*";
      return `${prefix}(?=$|\\/$)`;
    },
    [MODE_CHECK_IGNORE](_, p1) {
      const prefix = p1 ? `${p1}[^/]*` : "[^/]*";
      return `${prefix}(?=$|\\/$)`;
    }
  };
  var makeRegexPrefix = (pattern) => REPLACERS.reduce((prev, [matcher, replacer]) => prev.replace(matcher, replacer.bind(pattern)), pattern);
  var isString = (subject) => typeof subject === "string";
  var checkPattern = (pattern) => pattern && isString(pattern) && !REGEX_TEST_BLANK_LINE.test(pattern) && !REGEX_INVALID_TRAILING_BACKSLASH.test(pattern) && pattern.indexOf("#") !== 0;
  var splitPattern = (pattern) => pattern.split(REGEX_SPLITALL_CRLF).filter(Boolean);

  class IgnoreRule {
    constructor(pattern, mark, body, ignoreCase, negative, prefix) {
      this.pattern = pattern;
      this.mark = mark;
      this.negative = negative;
      define2(this, "body", body);
      define2(this, "ignoreCase", ignoreCase);
      define2(this, "regexPrefix", prefix);
    }
    get regex() {
      const key = UNDERSCORE + MODE_IGNORE;
      if (this[key]) {
        return this[key];
      }
      return this._make(MODE_IGNORE, key);
    }
    get checkRegex() {
      const key = UNDERSCORE + MODE_CHECK_IGNORE;
      if (this[key]) {
        return this[key];
      }
      return this._make(MODE_CHECK_IGNORE, key);
    }
    _make(mode, key) {
      const str = this.regexPrefix.replace(REGEX_REPLACE_TRAILING_WILDCARD, TRAILING_WILD_CARD_REPLACERS[mode]);
      const regex = this.ignoreCase ? new RegExp(str, "i") : new RegExp(str);
      return define2(this, key, regex);
    }
  }
  var createRule = ({
    pattern,
    mark
  }, ignoreCase) => {
    let negative = false;
    let body = pattern;
    if (body.indexOf("!") === 0) {
      negative = true;
      body = body.substr(1);
    }
    body = body.replace(REGEX_REPLACE_LEADING_EXCAPED_EXCLAMATION, "!").replace(REGEX_REPLACE_LEADING_EXCAPED_HASH, "#");
    const regexPrefix = makeRegexPrefix(body);
    return new IgnoreRule(pattern, mark, body, ignoreCase, negative, regexPrefix);
  };

  class RuleManager {
    constructor(ignoreCase) {
      this._ignoreCase = ignoreCase;
      this._rules = [];
    }
    _add(pattern) {
      if (pattern && pattern[KEY_IGNORE]) {
        this._rules = this._rules.concat(pattern._rules._rules);
        this._added = true;
        return;
      }
      if (isString(pattern)) {
        pattern = {
          pattern
        };
      }
      if (checkPattern(pattern.pattern)) {
        const rule = createRule(pattern, this._ignoreCase);
        this._added = true;
        this._rules.push(rule);
      }
    }
    add(pattern) {
      this._added = false;
      makeArray(isString(pattern) ? splitPattern(pattern) : pattern).forEach(this._add, this);
      return this._added;
    }
    test(path, checkUnignored, mode) {
      let ignored = false;
      let unignored = false;
      let matchedRule;
      this._rules.forEach((rule) => {
        const { negative } = rule;
        if (unignored === negative && ignored !== unignored || negative && !ignored && !unignored && !checkUnignored) {
          return;
        }
        const matched = rule[mode].test(path);
        if (!matched) {
          return;
        }
        ignored = !negative;
        unignored = negative;
        matchedRule = negative ? UNDEFINED : rule;
      });
      const ret = {
        ignored,
        unignored
      };
      if (matchedRule) {
        ret.rule = matchedRule;
      }
      return ret;
    }
  }
  var throwError = (message, Ctor) => {
    throw new Ctor(message);
  };
  var checkPath = (path, originalPath, doThrow) => {
    if (!isString(path)) {
      return doThrow(`path must be a string, but got \`${originalPath}\``, TypeError);
    }
    if (!path) {
      return doThrow(`path must not be empty`, TypeError);
    }
    if (checkPath.isNotRelative(path)) {
      const r = "`path.relative()`d";
      return doThrow(`path should be a ${r} string, but got "${originalPath}"`, RangeError);
    }
    return true;
  };
  var isNotRelative = (path) => REGEX_TEST_INVALID_PATH.test(path);
  checkPath.isNotRelative = isNotRelative;
  checkPath.convert = (p) => p;

  class Ignore {
    constructor({
      ignorecase = true,
      ignoreCase = ignorecase,
      allowRelativePaths = false
    } = {}) {
      define2(this, KEY_IGNORE, true);
      this._rules = new RuleManager(ignoreCase);
      this._strictPathCheck = !allowRelativePaths;
      this._initCache();
    }
    _initCache() {
      this._ignoreCache = Object.create(null);
      this._testCache = Object.create(null);
    }
    add(pattern) {
      if (this._rules.add(pattern)) {
        this._initCache();
      }
      return this;
    }
    addPattern(pattern) {
      return this.add(pattern);
    }
    _test(originalPath, cache, checkUnignored, slices) {
      const path = originalPath && checkPath.convert(originalPath);
      checkPath(path, originalPath, this._strictPathCheck ? throwError : RETURN_FALSE);
      return this._t(path, cache, checkUnignored, slices);
    }
    checkIgnore(path) {
      if (!REGEX_TEST_TRAILING_SLASH.test(path)) {
        return this.test(path);
      }
      const slices = path.split(SLASH).filter(Boolean);
      slices.pop();
      if (slices.length) {
        const parent = this._t(slices.join(SLASH) + SLASH, this._testCache, true, slices);
        if (parent.ignored) {
          return parent;
        }
      }
      return this._rules.test(path, false, MODE_CHECK_IGNORE);
    }
    _t(path, cache, checkUnignored, slices) {
      if (path in cache) {
        return cache[path];
      }
      if (!slices) {
        slices = path.split(SLASH).filter(Boolean);
      }
      slices.pop();
      if (!slices.length) {
        return cache[path] = this._rules.test(path, checkUnignored, MODE_IGNORE);
      }
      const parent = this._t(slices.join(SLASH) + SLASH, cache, checkUnignored, slices);
      return cache[path] = parent.ignored ? parent : this._rules.test(path, checkUnignored, MODE_IGNORE);
    }
    ignores(path) {
      return this._test(path, this._ignoreCache, false).ignored;
    }
    createFilter() {
      return (path) => !this.ignores(path);
    }
    filter(paths) {
      return makeArray(paths).filter(this.createFilter());
    }
    test(path) {
      return this._test(path, this._testCache, true);
    }
  }
  var factory = (options) => new Ignore(options);
  var isPathValid = (path) => checkPath(path && checkPath.convert(path), path, RETURN_FALSE);
  var setupWindows = () => {
    const makePosix = (str) => /^\\\\\?\\/.test(str) || /["<>|\u0000-\u001F]+/u.test(str) ? str : str.replace(/\\/g, "/");
    checkPath.convert = makePosix;
    const REGEX_TEST_WINDOWS_PATH_ABSOLUTE = /^[a-z]:\//i;
    checkPath.isNotRelative = (path) => REGEX_TEST_WINDOWS_PATH_ABSOLUTE.test(path) || isNotRelative(path);
  };
  if (typeof process !== "undefined" && process.platform === "win32") {
    setupWindows();
  }
  module.exports = factory;
  factory.default = factory;
  module.exports.isPathValid = isPathValid;
  define2(module.exports, Symbol.for("setupWindows"), setupWindows);
});

// src/detector-worker.ts
import * as crypto2 from "crypto";
import * as fs2 from "fs/promises";
import * as path3 from "path";

// src/disk-cache.ts
import { Database } from "bun:sqlite";
import * as crypto from "crypto";
import * as fsSync from "fs";
import * as fs from "fs/promises";
import * as os from "os";
import * as path2 from "path";
import * as zlib from "zlib";

// node_modules/eventemitter3/index.mjs
var import__ = __toESM(require_eventemitter3(), 1);

// node_modules/@jscpd/core/dist/index.mjs
function strict(token) {
  return token.type !== "ignore";
}
function mild(token) {
  return strict(token) && token.type !== "empty" && token.type !== "new_line";
}
function weak(token) {
  return mild(token) && token.format !== "comment" && token.type !== "comment" && token.type !== "block-comment";
}
var MODES = {
  mild,
  strict,
  weak
};
function getModeByName(name) {
  if (name in MODES) {
    return MODES[name];
  }
  throw new Error(`Mode ${name} does not supported yet.`);
}
function getModeHandler(mode) {
  return typeof mode === "string" ? getModeByName(mode) : mode;
}
function getDefaultOptions() {
  return {
    executionId: (/* @__PURE__ */ new Date()).toISOString(),
    path: [process.cwd()],
    mode: getModeHandler("mild"),
    minLines: 5,
    maxLines: 1000,
    maxSize: "100kb",
    minTokens: 50,
    output: "./report",
    reporters: ["console"],
    ignore: [],
    threshold: undefined,
    formatsExts: {},
    formatsNames: {},
    debug: false,
    silent: false,
    blame: false,
    cache: true,
    absolute: false,
    noSymlinks: false,
    skipLocal: false,
    ignoreCase: false,
    gitignore: true,
    reportersOptions: {},
    exitCode: 0,
    noTips: !!process.env["CI"]
  };
}

// node_modules/@jscpd/tokenizer/dist/index.mjs
var import_spark_md5 = __toESM(require_spark_md5(), 1);
import { extname, basename } from "path";
var uniqueID = 0;
var Token = class {
  type;
  content;
  alias;
  length;
  greedy;
  constructor(type, content, alias, matchedStr, greedy) {
    this.type = type;
    this.content = content;
    this.alias = alias;
    this.length = (matchedStr || "").length | 0;
    this.greedy = !!greedy;
  }
};
function getType(o) {
  return Object.prototype.toString.call(o).match(/\[object (\w+)\]/)[1];
}
function objId(obj) {
  if (!("__id" in obj)) {
    uniqueID += 1;
    Object.defineProperty(obj, "__id", { value: uniqueID });
  }
  return obj.__id;
}
function clone(o, visited = {}) {
  if (getType(o) === "Array") {
    const arr = o;
    const id = objId(arr);
    if (visited[id])
      return visited[id];
    const c = [];
    visited[id] = c;
    arr.forEach((v, i) => {
      c[i] = clone(v, visited);
    });
    return c;
  }
  if (getType(o) === "Object") {
    const obj = o;
    const id = objId(obj);
    if (visited[id])
      return visited[id];
    const c = {};
    visited[id] = c;
    Object.keys(obj).forEach((key) => {
      c[key] = clone(obj[key], visited);
    });
    return c;
  }
  return o;
}
function extend(id, redef) {
  const lang = clone(languages[id]);
  Object.keys(redef).forEach((key) => {
    lang[key] = redef[key];
  });
  return lang;
}
function DFS(o, callback, type, visited = {}) {
  Object.keys(o).forEach((i) => {
    callback.call(o, i, o[i], type || i);
    if (getType(o[i]) === "Object" && !visited[objId(o[i])]) {
      visited[objId(o[i])] = true;
      DFS(o[i], callback, i, visited);
    } else if (getType(o[i]) === "Array" && !visited[objId(o[i])]) {
      visited[objId(o[i])] = true;
      DFS(o[i], callback, undefined, visited);
    }
  });
}
function insertBefore(inside, before, insert, base = languages) {
  const grammar = base[inside];
  if (arguments.length === 2) {
    const resolvedInsert = before;
    Object.keys(resolvedInsert).forEach((key) => {
      grammar[key] = resolvedInsert[key];
    });
    return grammar;
  }
  const ret = {};
  Object.keys(grammar).forEach((key) => {
    if (key === before) {
      Object.keys(insert).forEach((newKey) => {
        ret[newKey] = insert[newKey];
      });
    }
    ret[key] = grammar[key];
  });
  DFS(languages, function callback(key, value) {
    if (value === base[inside] && key !== inside) {
      this[key] = ret;
    }
  });
  base[inside] = ret;
  return base[inside];
}
var languages = {
  extend,
  insertBefore,
  DFS
};
var hooks = {
  all: {},
  add(name, callback) {
    this.all[name] = this.all[name] || [];
    this.all[name].push(callback);
  },
  run(name, env) {
    const callbacks = this.all[name];
    if (!callbacks || !callbacks.length)
      return;
    callbacks.forEach((cb) => cb(env));
  }
};
function matchGrammar(text, strarr, grammar, index, startPos, oneshot, target) {
  Object.keys(grammar).forEach((token) => {
    if (!grammar[token])
      return;
    if (token === target)
      return;
    let patterns = grammar[token];
    patterns = Array.isArray(patterns) ? patterns : [patterns];
    patterns.forEach((pattern) => {
      if (pattern == null)
        return;
      const inside = pattern.inside;
      const lookbehind = !!pattern.lookbehind;
      const greedy = !!pattern.greedy;
      let lookbehindLength = 0;
      const alias = pattern.alias;
      if (greedy && pattern.pattern && !pattern.pattern.global) {
        const flags = pattern.pattern.toString().match(/[imuy]*$/)[0];
        pattern.pattern = RegExp(pattern.pattern.source, `${flags}g`);
      }
      const pat = pattern.pattern || pattern;
      for (let i = index, pos = startPos;i < strarr.length; pos += strarr[i].length, i++) {
        let str = strarr[i];
        if (strarr.length > text.length)
          return;
        if (str instanceof Token)
          continue;
        let delNum = 0;
        let match;
        if (greedy && i !== strarr.length - 1) {
          pat.lastIndex = pos;
          match = pat.exec(text);
          if (!match)
            break;
          const from = match.index + (lookbehind ? match[1] ? match[1].length : 0 : 0);
          const to = match.index + match[0].length;
          let k = i;
          let p = pos;
          for (let len = strarr.length;k < len && (p < to || !strarr[k].type && !strarr[k - 1]?.greedy); ++k) {
            p += strarr[k].length;
            if (from >= p) {
              i++;
              pos = p;
            }
          }
          if (strarr[i] instanceof Token)
            continue;
          delNum = k - i;
          str = text.slice(pos, p);
          match.index -= pos;
        } else {
          pat.lastIndex = 0;
          match = pat.exec(str);
          delNum = 1;
        }
        if (!match) {
          if (oneshot)
            break;
          continue;
        }
        if (lookbehind) {
          lookbehindLength = match[1] ? match[1].length : 0;
        }
        const matchFrom = match.index + lookbehindLength;
        const matchStr = match[0].slice(lookbehindLength);
        const matchTo = matchFrom + matchStr.length;
        const before = str.slice(0, matchFrom);
        const after = str.slice(matchTo);
        const args = [i, delNum];
        if (before) {
          i++;
          pos += before.length;
          args.push(before);
        }
        const wrapped = new Token(token, inside ? tokenize(matchStr, inside) : matchStr, alias, matchStr, greedy);
        args.push(wrapped);
        if (after)
          args.push(after);
        Array.prototype.splice.apply(strarr, args);
        if (delNum !== 1)
          matchGrammar(text, strarr, grammar, i, pos, true, token);
        if (oneshot)
          break;
      }
    });
  });
}
function tokenize(text, grammar) {
  const strarr = [text];
  const rest = grammar.rest;
  if (rest) {
    Object.keys(rest).forEach((token) => {
      grammar[token] = rest[token];
    });
    delete grammar.rest;
  }
  matchGrammar(text, strarr, grammar, 0, 0, false);
  return strarr;
}
var Prism = {
  languages,
  tokenize,
  hooks,
  util: { type: getType, objId, clone },
  Token
};
var prism_core_default = Prism;
var markup_default = {
  language: "markup",
  init: (Prism2) => {
    Prism2.languages.markup = {
      comment: /<!--[\s\S]*?-->/,
      prolog: /<\?[\s\S]+?\?>/,
      doctype: /<!DOCTYPE[\s\S]+?>/i,
      cdata: /<!\[CDATA\[[\s\S]*?]]>/i,
      tag: {
        pattern: /<\/?(?!\d)[^\s>\/=$<%]+(?:\s+[^\s>\/=]+(?:=(?:("|')(?:\\[\s\S]|(?!\1)[^\\])*\1|[^\s'">=]+))?)*\s*\/?>/i,
        greedy: true,
        inside: {
          tag: {
            pattern: /^<\/?[^\s>\/]+/i,
            inside: {
              punctuation: /^<\/?/,
              namespace: /^[^\s>\/:]+:/
            }
          },
          "attr-value": {
            pattern: /=(?:("|')(?:\\[\s\S]|(?!\1)[^\\])*\1|[^\s'">=]+)/i,
            inside: {
              punctuation: [
                /^=/,
                {
                  pattern: /(^|[^\\])["']/,
                  lookbehind: true
                }
              ]
            }
          },
          punctuation: /\/?>/,
          "attr-name": {
            pattern: /[^\s>\/]+/,
            inside: {
              namespace: /^[^\s>\/:]+:/
            }
          }
        }
      },
      entity: /&#?[\da-z]{1,8};/i
    };
    Prism2.languages.markup.tag.inside["attr-value"].inside.entity = Prism2.languages.markup.entity;
    Prism2.hooks.add("wrap", (env) => {
      if (env.type === "entity") {
        env.attributes.title = env.content.replace(/&amp;/, "&");
      }
    });
    Prism2.languages.xml = Prism2.languages.markup;
    Prism2.languages.html = Prism2.languages.markup;
    Prism2.languages.mathml = Prism2.languages.markup;
    Prism2.languages.svg = Prism2.languages.markup;
  }
};
var clike_default = {
  language: "clike",
  init: (Prism2) => {
    Prism2.languages.clike = {
      comment: [
        {
          pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
          lookbehind: true
        },
        {
          pattern: /(^|[^\\:])\/\/.*/,
          lookbehind: true,
          greedy: true
        }
      ],
      string: {
        pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
        greedy: true
      },
      "class-name": {
        pattern: /((?:\b(?:class|interface|extends|implements|trait|instanceof|new)\s+)|(?:catch\s+\())[\w.\\]+/i,
        lookbehind: true,
        inside: {
          punctuation: /[.\\]/
        }
      },
      keyword: /\b(?:if|else|while|do|for|return|in|instanceof|function|new|try|throw|catch|finally|null|break|continue)\b/,
      boolean: /\b(?:true|false)\b/,
      function: /[a-z0-9_]+(?=\()/i,
      number: /\b0x[\da-f]+\b|(?:\b\d+\.?\d*|\B\.\d+)(?:e[+-]?\d+)?/i,
      operator: /--?|\+\+?|!=?=?|<=?|>=?|==?=?|&&?|\|\|?|\?|\*|\/|~|\^|%/,
      punctuation: /[{}[\];(),.:]/
    };
  }
};
var css_default = {
  language: "css",
  init: (Prism2) => {
    Prism2.languages.css = {
      comment: /\/\*[\s\S]*?\*\//,
      atrule: {
        pattern: /@[\w-]+?.*?(?:;|(?=\s*\{))/i,
        inside: {
          rule: /@[\w-]+/
        }
      },
      url: /url\((?:(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1|.*?)\)/i,
      selector: /[^{}\s][^{};]*?(?=\s*\{)/,
      string: {
        pattern: /("|')(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
        greedy: true
      },
      property: /[-_a-z\xA0-\uFFFF][-\w\xA0-\uFFFF]*(?=\s*:)/i,
      important: /\B!important\b/i,
      function: /[-a-z0-9]+(?=\()/i,
      punctuation: /[(){};:]/
    };
    Prism2.languages.css.atrule.inside.rest = Prism2.languages.css;
    if (Prism2.languages.markup) {
      Prism2.languages.insertBefore("markup", "tag", {
        style: {
          pattern: /(<style[\s\S]*?>)[\s\S]*?(?=<\/style>)/i,
          lookbehind: true,
          inside: Prism2.languages.css,
          alias: "language-css",
          greedy: true
        }
      });
      Prism2.languages.insertBefore("inside", "attr-value", {
        "style-attr": {
          pattern: /\s*style=("|')(?:\\[\s\S]|(?!\1)[^\\])*\1/i,
          inside: {
            "attr-name": {
              pattern: /^\s*style/i,
              inside: Prism2.languages.markup.tag.inside
            },
            punctuation: /^\s*=\s*['"]|['"]\s*$/,
            "attr-value": {
              pattern: /.+/i,
              inside: Prism2.languages.css
            }
          },
          alias: "language-css"
        }
      }, Prism2.languages.markup.tag);
    }
  }
};
var c_default = {
  language: "c",
  init: (Prism2) => {
    Prism2.languages.c = Prism2.languages.extend("clike", {
      keyword: /\b(?:_Alignas|_Alignof|_Atomic|_Bool|_Complex|_Generic|_Imaginary|_Noreturn|_Static_assert|_Thread_local|asm|typeof|inline|auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|int|long|register|return|short|signed|sizeof|static|struct|switch|typedef|union|unsigned|void|volatile|while)\b/,
      operator: /-[>-]?|\+\+?|!=?|<<?=?|>>?=?|==?|&&?|\|\|?|[~^%?*\/]/,
      number: /(?:\b0x[\da-f]+|(?:\b\d+\.?\d*|\B\.\d+)(?:e[+-]?\d+)?)[ful]*/i
    });
    Prism2.languages.insertBefore("c", "string", {
      macro: {
        pattern: /(^\s*)#\s*[a-z]+(?:[^\r\n\\]|\\(?:\r\n|[\s\S]))*/im,
        lookbehind: true,
        alias: "property",
        inside: {
          string: {
            pattern: /(#\s*include\s*)(?:<.+?>|("|')(?:\\?.)+?\2)/,
            lookbehind: true
          },
          directive: {
            pattern: /(#\s*)\b(?:define|defined|elif|else|endif|error|ifdef|ifndef|if|import|include|line|pragma|undef|using)\b/,
            lookbehind: true,
            alias: "keyword"
          }
        }
      },
      constant: /\b(?:__FILE__|__LINE__|__DATE__|__TIME__|__TIMESTAMP__|__func__|EOF|NULL|SEEK_CUR|SEEK_END|SEEK_SET|stdin|stdout|stderr)\b/
    });
    delete Prism2.languages.c["class-name"];
    delete Prism2.languages.c.boolean;
  }
};
var javascript_default = {
  language: "javascript",
  init: (Prism2) => {
    Prism2.languages.javascript = Prism2.languages.extend("clike", {
      keyword: /\b(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|var|void|while|with|yield)\b/,
      number: /\b(?:0[xX][\dA-Fa-f]+|0[bB][01]+|0[oO][0-7]+|NaN|Infinity)\b|(?:\b\d+\.?\d*|\B\.\d+)(?:[Ee][+-]?\d+)?/,
      function: /[_$a-z\xA0-\uFFFF][$\w\xA0-\uFFFF]*(?=\s*\()/i,
      operator: /-[-=]?|\+[+=]?|!=?=?|<<?=?|>>?>?=?|=(?:==?|>)?|&[&=]?|\|[|=]?|\*\*?=?|\/=?|~|\^=?|%=?|\?|\.{3}/
    });
    Prism2.languages.insertBefore("javascript", "keyword", {
      regex: {
        pattern: /((?:^|[^$\w\xA0-\uFFFF."'\])\s])\s*)\/(\[[^\]\r\n]+]|\\.|[^/\\\[\r\n])+\/[gimyu]{0,5}(?=\s*($|[\r\n,.;})]))/,
        lookbehind: true,
        greedy: true
      },
      "function-variable": {
        pattern: /[_$a-z\xA0-\uFFFF][$\w\xA0-\uFFFF]*(?=\s*=\s*(?:function\b|(?:\([^()]*\)|[_$a-z\xA0-\uFFFF][$\w\xA0-\uFFFF]*)\s*=>))/i,
        alias: "function"
      },
      constant: /\b[A-Z][A-Z\d_]*\b/
    });
    Prism2.languages.insertBefore("javascript", "string", {
      "template-string": {
        pattern: /`(?:\\[\s\S]|[^\\`])*`/,
        greedy: true,
        inside: {
          interpolation: {
            pattern: /\$\{[^}]+\}/,
            inside: {
              "interpolation-punctuation": {
                pattern: /^\$\{|\}$/,
                alias: "punctuation"
              },
              rest: Prism2.languages.javascript
            }
          },
          string: /[\s\S]+/
        }
      }
    });
    if (Prism2.languages.markup) {
      Prism2.languages.insertBefore("markup", "tag", {
        script: {
          pattern: /(<script[\s\S]*?>)[\s\S]*?(?=<\/script>)/i,
          lookbehind: true,
          inside: Prism2.languages.javascript,
          alias: "language-javascript",
          greedy: true
        }
      });
    }
    Prism2.languages.js = Prism2.languages.javascript;
  }
};
var java_default = {
  language: "java",
  init: (Prism2) => {
    Prism2.languages.java = Prism2.languages.extend("clike", {
      keyword: /\b(?:abstract|continue|for|new|switch|assert|default|goto|package|synchronized|boolean|do|if|private|this|break|double|implements|protected|throw|byte|else|import|public|throws|case|enum|instanceof|return|transient|catch|extends|int|short|try|char|final|interface|static|void|class|finally|long|strictfp|volatile|const|float|native|super|while)\b/,
      number: /\b0b[01]+\b|\b0x[\da-f]*\.?[\da-fp-]+\b|(?:\b\d+\.?\d*|\B\.\d+)(?:e[+-]?\d+)?[df]?/i,
      operator: {
        pattern: /(^|[^.])(?:\+[+=]?|-[-=]?|!=?|<<?=?|>>?>?=?|==?|&[&=]?|\|[|=]?|\*=?|\/=?|%=?|\^=?|[?:~])/m,
        lookbehind: true
      }
    });
    Prism2.languages.insertBefore("java", "function", {
      annotation: {
        alias: "punctuation",
        pattern: /(^|[^.])@\w+/,
        lookbehind: true
      }
    });
    Prism2.languages.insertBefore("java", "class-name", {
      generics: {
        pattern: /<\s*\w+(?:\.\w+)?(?:\s*,\s*\w+(?:\.\w+)?)*>/i,
        alias: "function",
        inside: {
          keyword: Prism2.languages.java.keyword,
          punctuation: /[<>(),.:]/
        }
      }
    });
  }
};
var ruby_default = {
  language: "ruby",
  init: (Prism2) => {
    (function(Prism3) {
      Prism3.languages.ruby = Prism3.languages.extend("clike", {
        comment: [
          /#.*/,
          {
            pattern: /^=begin(?:\r?\n|\r)(?:.*(?:\r?\n|\r))*?=end/m,
            greedy: true
          }
        ],
        keyword: /\b(?:alias|and|BEGIN|begin|break|case|class|def|define_method|defined|do|each|else|elsif|END|end|ensure|false|for|if|in|module|new|next|nil|not|or|protected|private|public|raise|redo|require|rescue|retry|return|self|super|then|throw|true|undef|unless|until|when|while|yield)\b/
      });
      const interpolation = {
        pattern: /#\{[^}]+\}/,
        inside: {
          delimiter: {
            pattern: /^#\{|\}$/,
            alias: "tag"
          },
          rest: Prism3.languages.ruby
        }
      };
      Prism3.languages.insertBefore("ruby", "keyword", {
        regex: [
          {
            pattern: /%r([^a-zA-Z0-9\s{(\[<])(?:(?!\1)[^\\]|\\[\s\S])*\1[gim]{0,3}/,
            greedy: true,
            inside: {
              interpolation
            }
          },
          {
            pattern: /%r\((?:[^()\\]|\\[\s\S])*\)[gim]{0,3}/,
            greedy: true,
            inside: {
              interpolation
            }
          },
          {
            pattern: /%r\{(?:[^#{}\\]|#(?:\{[^}]+\})?|\\[\s\S])*\}[gim]{0,3}/,
            greedy: true,
            inside: {
              interpolation
            }
          },
          {
            pattern: /%r\[(?:[^\[\]\\]|\\[\s\S])*\][gim]{0,3}/,
            greedy: true,
            inside: {
              interpolation
            }
          },
          {
            pattern: /%r<(?:[^<>\\]|\\[\s\S])*>[gim]{0,3}/,
            greedy: true,
            inside: {
              interpolation
            }
          },
          {
            pattern: /(^|[^/])\/(?!\/)(\[.+?]|\\.|[^/\\\r\n])+\/[gim]{0,3}(?=\s*($|[\r\n,.;})]))/,
            lookbehind: true,
            greedy: true
          }
        ],
        variable: /[@$]+[a-zA-Z_]\w*(?:[?!]|\b)/,
        symbol: {
          pattern: /(^|[^:]):[a-zA-Z_]\w*(?:[?!]|\b)/,
          lookbehind: true
        }
      });
      Prism3.languages.insertBefore("ruby", "number", {
        builtin: /\b(?:Array|Bignum|Binding|Class|Continuation|Dir|Exception|FalseClass|File|Stat|Fixnum|Float|Hash|Integer|IO|MatchData|Method|Module|NilClass|Numeric|Object|Proc|Range|Regexp|String|Struct|TMS|Symbol|ThreadGroup|Thread|Time|TrueClass)\b/,
        constant: /\b[A-Z]\w*(?:[?!]|\b)/
      });
      Prism3.languages.ruby.string = [
        {
          pattern: /%[qQiIwWxs]?([^a-zA-Z0-9\s{(\[<])(?:(?!\1)[^\\]|\\[\s\S])*\1/,
          greedy: true,
          inside: {
            interpolation
          }
        },
        {
          pattern: /%[qQiIwWxs]?\((?:[^()\\]|\\[\s\S])*\)/,
          greedy: true,
          inside: {
            interpolation
          }
        },
        {
          pattern: /%[qQiIwWxs]?\{(?:[^#{}\\]|#(?:\{[^}]+\})?|\\[\s\S])*\}/,
          greedy: true,
          inside: {
            interpolation
          }
        },
        {
          pattern: /%[qQiIwWxs]?\[(?:[^\[\]\\]|\\[\s\S])*\]/,
          greedy: true,
          inside: {
            interpolation
          }
        },
        {
          pattern: /%[qQiIwWxs]?<(?:[^<>\\]|\\[\s\S])*>/,
          greedy: true,
          inside: {
            interpolation
          }
        },
        {
          pattern: /("|')(?:#\{[^}]+\}|\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
          greedy: true,
          inside: {
            interpolation
          }
        }
      ];
    })(Prism2);
  }
};
var php_default = {
  language: "php",
  init: (Prism2) => {
    (function(Prism3) {
      Prism3.languages.php = Prism3.languages.extend("clike", {
        keyword: /\b(?:and|or|xor|array|as|break|case|cfunction|class|const|continue|declare|default|die|do|else|elseif|enddeclare|endfor|endforeach|endif|endswitch|endwhile|extends|for|foreach|function|include|include_once|global|if|new|return|static|switch|use|require|require_once|var|while|abstract|interface|public|implements|private|protected|parent|throw|null|echo|print|trait|namespace|final|yield|goto|instanceof|finally|try|catch)\b/i,
        constant: /\b[A-Z0-9_]{2,}\b/,
        comment: {
          pattern: /(^|[^\\])(?:\/\*[\s\S]*?\*\/|\/\/.*)/,
          lookbehind: true
        }
      });
      Prism3.languages.insertBefore("php", "string", {
        "shell-comment": {
          pattern: /(^|[^\\])#.*/,
          lookbehind: true,
          alias: "comment"
        }
      });
      Prism3.languages.insertBefore("php", "keyword", {
        delimiter: {
          pattern: /\?>|<\?(?:php|=)?/i,
          alias: "important"
        },
        variable: /\$+(?:\w+\b|(?={))/i,
        package: {
          pattern: /(\\|namespace\s+|use\s+)[\w\\]+/,
          lookbehind: true,
          inside: {
            punctuation: /\\/
          }
        }
      });
      Prism3.languages.insertBefore("php", "operator", {
        property: {
          pattern: /(->)[\w]+/,
          lookbehind: true
        }
      });
      Prism3.languages.insertBefore("php", "string", {
        "nowdoc-string": {
          pattern: /<<<'([^']+)'(?:\r\n?|\n)(?:.*(?:\r\n?|\n))*?\1;/,
          greedy: true,
          alias: "string",
          inside: {
            delimiter: {
              pattern: /^<<<'[^']+'|[a-z_]\w*;$/i,
              alias: "symbol",
              inside: {
                punctuation: /^<<<'?|[';]$/
              }
            }
          }
        },
        "heredoc-string": {
          pattern: /<<<(?:"([^"]+)"(?:\r\n?|\n)(?:.*(?:\r\n?|\n))*?\1;|([a-z_]\w*)(?:\r\n?|\n)(?:.*(?:\r\n?|\n))*?\2;)/i,
          greedy: true,
          alias: "string",
          inside: {
            delimiter: {
              pattern: /^<<<(?:"[^"]+"|[a-z_]\w*)|[a-z_]\w*;$/i,
              alias: "symbol",
              inside: {
                punctuation: /^<<<"?|[";]$/
              }
            },
            interpolation: null
          }
        },
        "single-quoted-string": {
          pattern: /'(?:\\[\s\S]|[^\\'])*'/,
          greedy: true,
          alias: "string"
        },
        "double-quoted-string": {
          pattern: /"(?:\\[\s\S]|[^\\"])*"/,
          greedy: true,
          alias: "string",
          inside: {
            interpolation: null
          }
        }
      });
      delete Prism3.languages.php.string;
      const string_interpolation = {
        pattern: /{\$(?:{(?:{[^{}]+}|[^{}]+)}|[^{}])+}|(^|[^\\{])\$+(?:\w+(?:\[.+?]|->\w+)*)/,
        lookbehind: true,
        inside: {
          rest: Prism3.languages.php
        }
      };
      Prism3.languages.php["heredoc-string"].inside.interpolation = string_interpolation;
      Prism3.languages.php["double-quoted-string"].inside.interpolation = string_interpolation;
      Prism3.hooks.add("before-tokenize", (env) => {
        if (!/(?:<\?php|<\?)/gi.test(env.code)) {
          return;
        }
        const phpPattern = /(?:<\?php|<\?)[\s\S]*?(?:\?>|$)/gi;
        Prism3.languages["markup-templating"].buildPlaceholders(env, "php", phpPattern);
      });
      Prism3.hooks.add("after-tokenize", (env) => {
        Prism3.languages["markup-templating"].tokenizePlaceholders(env, "php");
      });
    })(Prism2);
  }
};
var markup_templating_default = {
  language: "markup-templating",
  init: (Prism2) => {
    Prism2.languages["markup-templating"] = {};
    Object.defineProperties(Prism2.languages["markup-templating"], {
      buildPlaceholders: {
        value(env, language, placeholderPattern, replaceFilter) {
          if (env.language !== language) {
            return;
          }
          env.tokenStack = [];
          env.code = env.code.replace(placeholderPattern, (match) => {
            if (typeof replaceFilter === "function" && !replaceFilter(match)) {
              return match;
            }
            let i = env.tokenStack.length;
            while (env.code.indexOf(`___${language.toUpperCase()}${i}___`) !== -1) {
              ++i;
            }
            env.tokenStack[i] = match;
            return `___${language.toUpperCase()}${i}___`;
          });
          env.grammar = Prism2.languages.markup;
        }
      },
      tokenizePlaceholders: {
        value(env, language) {
          if (env.language !== language || !env.tokenStack) {
            return;
          }
          env.grammar = Prism2.languages[language];
          let j = 0;
          const keys = Object.keys(env.tokenStack);
          var walkTokens = function(tokens) {
            if (j >= keys.length) {
              return;
            }
            for (let i = 0;i < tokens.length; i++) {
              const token = tokens[i];
              if (typeof token === "string" || token.content && typeof token.content === "string") {
                const k = keys[j];
                const t = env.tokenStack[k];
                const s = typeof token === "string" ? token : token.content;
                const index = s.indexOf(`___${language.toUpperCase()}${k}___`);
                if (index > -1) {
                  ++j;
                  const before = s.substring(0, index);
                  const middle = new Prism2.Token(language, Prism2.tokenize(t, env.grammar, language), `language-${language}`, t);
                  const after = s.substring(index + `___${language.toUpperCase()}${k}___`.length);
                  var replacement;
                  if (before || after) {
                    replacement = [before, middle, after].filter((v) => !!v);
                    walkTokens(replacement);
                  } else {
                    replacement = middle;
                  }
                  if (typeof token === "string") {
                    Array.prototype.splice.apply(tokens, [i, 1].concat(replacement));
                  } else {
                    token.content = replacement;
                  }
                  if (j >= keys.length) {
                    break;
                  }
                }
              } else if (token.content && typeof token.content !== "string") {
                walkTokens(token.content);
              }
            }
          };
          walkTokens(env.tokens);
        }
      }
    });
  }
};
var css_extras_default = {
  language: "css-extras",
  init: (Prism2) => {
    Prism2.languages.css.selector = {
      pattern: /[^{}\s][^{}]*(?=\s*\{)/,
      inside: {
        "pseudo-element": /:(?:after|before|first-letter|first-line|selection)|::[-\w]+/,
        "pseudo-class": /:[-\w]+(?:\(.*\))?/,
        class: /\.[-:.\w]+/,
        id: /#[-:.\w]+/,
        attribute: /\[[^\]]+\]/
      }
    };
    Prism2.languages.insertBefore("css", "function", {
      hexcode: /#[\da-f]{3,8}/i,
      entity: /\\[\da-f]{1,8}/i,
      number: /[\d%.]+/
    });
  }
};
var scss_default = {
  language: "scss",
  init: (Prism2) => {
    Prism2.languages.scss = Prism2.languages.extend("css", {
      comment: {
        pattern: /(^|[^\\])(?:\/\*[\s\S]*?\*\/|\/\/.*)/,
        lookbehind: true
      },
      atrule: {
        pattern: /@[\w-]+(?:\([^()]+\)|[^(])*?(?=\s+[{;])/,
        inside: {
          rule: /@[\w-]+/
        }
      },
      url: /(?:[-a-z]+-)*url(?=\()/i,
      selector: {
        pattern: /(?=\S)[^@;{}()]?(?:[^@;{}()]|&|#\{\$[-\w]+\})+(?=\s*\{(?:\}|\s|[^}]+[:{][^}]+))/m,
        inside: {
          parent: {
            pattern: /&/,
            alias: "important"
          },
          placeholder: /%[-\w]+/,
          variable: /\$[-\w]+|#\{\$[-\w]+\}/
        }
      }
    });
    Prism2.languages.insertBefore("scss", "atrule", {
      keyword: [
        /@(?:if|else(?: if)?|for|each|while|import|extend|debug|warn|mixin|include|function|return|content)/i,
        {
          pattern: /( +)(?:from|through)(?= )/,
          lookbehind: true
        }
      ]
    });
    Prism2.languages.scss.property = {
      pattern: /(?:[\w-]|\$[-\w]+|#\{\$[-\w]+\})+(?=\s*:)/i,
      inside: {
        variable: /\$[-\w]+|#\{\$[-\w]+\}/
      }
    };
    Prism2.languages.insertBefore("scss", "important", {
      variable: /\$[-\w]+|#\{\$[-\w]+\}/
    });
    Prism2.languages.insertBefore("scss", "function", {
      placeholder: {
        pattern: /%[-\w]+/,
        alias: "selector"
      },
      statement: {
        pattern: /\B!(?:default|optional)\b/i,
        alias: "keyword"
      },
      boolean: /\b(?:true|false)\b/,
      null: /\bnull\b/,
      operator: {
        pattern: /(\s)(?:[-+*\/%]|[=!]=|<=?|>=?|and|or|not)(?=\s)/,
        lookbehind: true
      }
    });
    Prism2.languages.scss.atrule.inside.rest = Prism2.languages.scss;
  }
};
var sass_default = {
  language: "sass",
  init: (Prism2) => {
    (function(Prism3) {
      Prism3.languages.sass = Prism3.languages.extend("css", {
        comment: {
          pattern: /^([ \t]*)\/[\/*].*(?:(?:\r?\n|\r)\1[ \t]+.+)*/m,
          lookbehind: true
        }
      });
      Prism3.languages.insertBefore("sass", "atrule", {
        "atrule-line": {
          pattern: /^(?:[ \t]*)[@+=].+/m,
          inside: {
            atrule: /(?:@[\w-]+|[+=])/m
          }
        }
      });
      delete Prism3.languages.sass.atrule;
      const variable = /\$[-\w]+|#\{\$[-\w]+\}/;
      const operator = [
        /[+*\/%]|[=!]=|<=?|>=?|\b(?:and|or|not)\b/,
        {
          pattern: /(\s+)-(?=\s)/,
          lookbehind: true
        }
      ];
      Prism3.languages.insertBefore("sass", "property", {
        "variable-line": {
          pattern: /^[ \t]*\$.+/m,
          inside: {
            punctuation: /:/,
            variable,
            operator
          }
        },
        "property-line": {
          pattern: /^[ \t]*(?:[^:\s]+ *:.*|:[^:\s]+.*)/m,
          inside: {
            property: [
              /[^:\s]+(?=\s*:)/,
              {
                pattern: /(:)[^:\s]+/,
                lookbehind: true
              }
            ],
            punctuation: /:/,
            variable,
            operator,
            important: Prism3.languages.sass.important
          }
        }
      });
      delete Prism3.languages.sass.property;
      delete Prism3.languages.sass.important;
      delete Prism3.languages.sass.selector;
      Prism3.languages.insertBefore("sass", "punctuation", {
        selector: {
          pattern: /([ \t]*)\S(?:,?[^,\r\n]+)*(?:,(?:\r?\n|\r)\1[ \t]+\S(?:,?[^,\r\n]+)*)*/,
          lookbehind: true
        }
      });
    })(Prism2);
  }
};
var less_default = {
  language: "less",
  init: (Prism2) => {
    Prism2.languages.less = Prism2.languages.extend("css", {
      comment: [
        /\/\*[\s\S]*?\*\//,
        {
          pattern: /(^|[^\\])\/\/.*/,
          lookbehind: true
        }
      ],
      atrule: {
        pattern: /@[\w-]+?(?:\([^{}]+\)|[^(){};])*?(?=\s*\{)/i,
        inside: {
          punctuation: /[:()]/
        }
      },
      selector: {
        pattern: /(?:@\{[\w-]+\}|[^{};\s@])(?:@\{[\w-]+\}|\([^{}]*\)|[^{};@])*?(?=\s*\{)/,
        inside: {
          variable: /@+[\w-]+/
        }
      },
      property: /(?:@\{[\w-]+\}|[\w-])+(?:\+_?)?(?=\s*:)/i,
      punctuation: /[{}();:,]/,
      operator: /[+\-*\/]/
    });
    Prism2.languages.insertBefore("less", "punctuation", {
      function: Prism2.languages.less.function
    });
    Prism2.languages.insertBefore("less", "property", {
      variable: [
        {
          pattern: /@[\w-]+\s*:/,
          inside: {
            punctuation: /:/
          }
        },
        /@@?[\w-]+/
      ],
      "mixin-usage": {
        pattern: /([{;]\s*)[.#](?!\d)[\w-]+.*?(?=[(;])/,
        lookbehind: true,
        alias: "function"
      }
    });
  }
};
var cpp_default = {
  language: "cpp",
  init: (Prism2) => {
    Prism2.languages.cpp = Prism2.languages.extend("c", {
      keyword: /\b(?:alignas|alignof|asm|auto|bool|break|case|catch|char|char16_t|char32_t|class|compl|const|constexpr|const_cast|continue|decltype|default|delete|do|double|dynamic_cast|else|enum|explicit|export|extern|float|for|friend|goto|if|inline|int|int8_t|int16_t|int32_t|int64_t|uint8_t|uint16_t|uint32_t|uint64_t|long|mutable|namespace|new|noexcept|nullptr|operator|private|protected|public|register|reinterpret_cast|return|short|signed|sizeof|static|static_assert|static_cast|struct|switch|template|this|thread_local|throw|try|typedef|typeid|typename|union|unsigned|using|virtual|void|volatile|wchar_t|while)\b/,
      boolean: /\b(?:true|false)\b/,
      operator: /--?|\+\+?|!=?|<{1,2}=?|>{1,2}=?|->|:{1,2}|={1,2}|\^|~|%|&{1,2}|\|\|?|\?|\*|\/|\b(?:and|and_eq|bitand|bitor|not|not_eq|or|or_eq|xor|xor_eq)\b/
    });
    Prism2.languages.insertBefore("cpp", "keyword", {
      "class-name": {
        pattern: /(class\s+)\w+/i,
        lookbehind: true
      }
    });
    Prism2.languages.insertBefore("cpp", "string", {
      "raw-string": {
        pattern: /R"([^()\\ ]{0,16})\([\s\S]*?\)\1"/,
        alias: "string",
        greedy: true
      }
    });
  }
};
var bison_default = {
  language: "bison",
  init: (Prism2) => {
    Prism2.languages.bison = Prism2.languages.extend("c", {});
    Prism2.languages.insertBefore("bison", "comment", {
      bison: {
        pattern: /^[\s\S]*?%%[\s\S]*?%%/,
        inside: {
          c: {
            pattern: /%\{[\s\S]*?%\}|\{(?:\{[^}]*\}|[^{}])*\}/,
            inside: {
              delimiter: {
                pattern: /^%?\{|%?\}$/,
                alias: "punctuation"
              },
              "bison-variable": {
                pattern: /[$@](?:<[^\s>]+>)?[\w$]+/,
                alias: "variable",
                inside: {
                  punctuation: /<|>/
                }
              },
              rest: Prism2.languages.c
            }
          },
          comment: Prism2.languages.c.comment,
          string: Prism2.languages.c.string,
          property: /\S+(?=:)/,
          keyword: /%\w+/,
          number: {
            pattern: /(^|[^@])\b(?:0x[\da-f]+|\d+)/i,
            lookbehind: true
          },
          punctuation: /%[%?]|[|:;\[\]<>]/
        }
      }
    });
  }
};
var objectivec_default = {
  language: "objectivec",
  init: (Prism2) => {
    Prism2.languages.objectivec = Prism2.languages.extend("c", {
      keyword: /\b(?:asm|typeof|inline|auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|int|long|register|return|short|signed|sizeof|static|struct|switch|typedef|union|unsigned|void|volatile|while|in|self|super)\b|(?:@interface|@end|@implementation|@protocol|@class|@public|@protected|@private|@property|@try|@catch|@finally|@throw|@synthesize|@dynamic|@selector)\b/,
      string: /("|')(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1|@"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"/,
      operator: /-[->]?|\+\+?|!=?|<<?=?|>>?=?|==?|&&?|\|\|?|[~^%?*\/@]/
    });
  }
};
var scala_default = {
  language: "scala",
  init: (Prism2) => {
    Prism2.languages.scala = Prism2.languages.extend("java", {
      keyword: /<-|=>|\b(?:abstract|case|catch|class|def|do|else|extends|final|finally|for|forSome|if|implicit|import|lazy|match|new|null|object|override|package|private|protected|return|sealed|self|super|this|throw|trait|try|type|val|var|while|with|yield)\b/,
      string: [
        {
          pattern: /"""[\s\S]*?"""/,
          greedy: true
        },
        {
          pattern: /("|')(?:\\.|(?!\1)[^\\\r\n])*\1/,
          greedy: true
        }
      ],
      builtin: /\b(?:String|Int|Long|Short|Byte|Boolean|Double|Float|Char|Any|AnyRef|AnyVal|Unit|Nothing)\b/,
      number: /\b0x[\da-f]*\.?[\da-f]+|(?:\b\d+\.?\d*|\B\.\d+)(?:e\d+)?[dfl]?/i,
      symbol: /'[^\d\s\\]\w*/
    });
    delete Prism2.languages.scala["class-name"];
    delete Prism2.languages.scala.function;
  }
};
var csharp_default = {
  language: "csharp",
  init: (Prism2) => {
    Prism2.languages.csharp = Prism2.languages.extend("clike", {
      keyword: /\b(?:abstract|add|alias|as|ascending|async|await|base|bool|break|byte|case|catch|char|checked|class|const|continue|decimal|default|delegate|descending|do|double|dynamic|else|enum|event|explicit|extern|false|finally|fixed|float|for|foreach|from|get|global|goto|group|if|implicit|in|int|interface|internal|into|is|join|let|lock|long|namespace|new|null|object|operator|orderby|out|override|params|partial|private|protected|public|readonly|ref|remove|return|sbyte|sealed|select|set|short|sizeof|stackalloc|static|string|struct|switch|this|throw|true|try|typeof|uint|ulong|unchecked|unsafe|ushort|using|value|var|virtual|void|volatile|where|while|yield)\b/,
      string: [
        {
          pattern: /@("|')(?:\1\1|\\[\s\S]|(?!\1)[^\\])*\1/,
          greedy: true
        },
        {
          pattern: /("|')(?:\\.|(?!\1)[^\\\r\n])*?\1/,
          greedy: true
        }
      ],
      "class-name": [
        {
          pattern: /\b[A-Z]\w*(?:\.\w+)*\b(?=\s+\w+)/,
          inside: {
            punctuation: /\./
          }
        },
        {
          pattern: /(\[)[A-Z]\w*(?:\.\w+)*\b/,
          lookbehind: true,
          inside: {
            punctuation: /\./
          }
        },
        {
          pattern: /(\b(?:class|interface)\s+[A-Z]\w*(?:\.\w+)*\s*:\s*)[A-Z]\w*(?:\.\w+)*\b/,
          lookbehind: true,
          inside: {
            punctuation: /\./
          }
        },
        {
          pattern: /((?:\b(?:class|interface|new)\s+)|(?:catch\s+\())[A-Z]\w*(?:\.\w+)*\b/,
          lookbehind: true,
          inside: {
            punctuation: /\./
          }
        }
      ],
      number: /\b0x[\da-f]+\b|(?:\b\d+\.?\d*|\B\.\d+)f?/i
    });
    Prism2.languages.insertBefore("csharp", "class-name", {
      "generic-method": {
        pattern: /\w+\s*<[^>\r\n]+?>\s*(?=\()/,
        inside: {
          function: /^\w+/,
          "class-name": {
            pattern: /\b[A-Z]\w*(?:\.\w+)*\b/,
            inside: {
              punctuation: /\./
            }
          },
          keyword: Prism2.languages.csharp.keyword,
          punctuation: /[<>(),.:]/
        }
      },
      preprocessor: {
        pattern: /(^\s*)#.*/m,
        lookbehind: true,
        alias: "property",
        inside: {
          directive: {
            pattern: /(\s*#)\b(?:define|elif|else|endif|endregion|error|if|line|pragma|region|undef|warning)\b/,
            lookbehind: true,
            alias: "keyword"
          }
        }
      }
    });
    Prism2.languages.dotnet = Prism2.languages.csharp;
  }
};
var dart_default = {
  language: "dart",
  init: (Prism2) => {
    Prism2.languages.dart = Prism2.languages.extend("clike", {
      string: [
        {
          pattern: /r?("""|''')[\s\S]*?\1/,
          greedy: true
        },
        {
          pattern: /r?("|')(?:\\.|(?!\1)[^\\\r\n])*\1/,
          greedy: true
        }
      ],
      keyword: [
        /\b(?:async|sync|yield)\*/,
        /\b(?:abstract|assert|async|await|break|case|catch|class|const|continue|default|deferred|do|dynamic|else|enum|export|external|extends|factory|final|finally|for|get|if|implements|import|in|library|new|null|operator|part|rethrow|return|set|static|super|switch|this|throw|try|typedef|var|void|while|with|yield)\b/
      ],
      operator: /\bis!|\b(?:as|is)\b|\+\+|--|&&|\|\||<<=?|>>=?|~(?:\/=?)?|[+\-*\/%&^|=!<>]=?|\?/
    });
    Prism2.languages.insertBefore("dart", "function", {
      metadata: {
        pattern: /@\w+/,
        alias: "symbol"
      }
    });
  }
};
var d_default = {
  language: "d",
  init: (Prism2) => {
    Prism2.languages.d = Prism2.languages.extend("clike", {
      string: [
        /\b[rx]"(?:\\[\s\S]|[^\\"])*"[cwd]?/,
        /\bq"(?:\[[\s\S]*?\]|\([\s\S]*?\)|<[\s\S]*?>|\{[\s\S]*?\})"/,
        /\bq"([_a-zA-Z][_a-zA-Z\d]*)(?:\r?\n|\r)[\s\S]*?(?:\r?\n|\r)\1"/,
        /\bq"(.)[\s\S]*?\1"/,
        /'(?:\\'|\\?[^']+)'/,
        /(["`])(?:\\[\s\S]|(?!\1)[^\\])*\1[cwd]?/
      ],
      number: [
        /\b0x\.?[a-f\d_]+(?:(?!\.\.)\.[a-f\d_]*)?(?:p[+-]?[a-f\d_]+)?[ulfi]*/i,
        {
          pattern: /((?:\.\.)?)(?:\b0b\.?|\b|\.)\d[\d_]*(?:(?!\.\.)\.[\d_]*)?(?:e[+-]?\d[\d_]*)?[ulfi]*/i,
          lookbehind: true
        }
      ],
      keyword: /\$|\b(?:abstract|alias|align|asm|assert|auto|body|bool|break|byte|case|cast|catch|cdouble|cent|cfloat|char|class|const|continue|creal|dchar|debug|default|delegate|delete|deprecated|do|double|else|enum|export|extern|false|final|finally|float|for|foreach|foreach_reverse|function|goto|idouble|if|ifloat|immutable|import|inout|int|interface|invariant|ireal|lazy|long|macro|mixin|module|new|nothrow|null|out|override|package|pragma|private|protected|public|pure|real|ref|return|scope|shared|short|static|struct|super|switch|synchronized|template|this|throw|true|try|typedef|typeid|typeof|ubyte|ucent|uint|ulong|union|unittest|ushort|version|void|volatile|wchar|while|with|__(?:(?:FILE|MODULE|LINE|FUNCTION|PRETTY_FUNCTION|DATE|EOF|TIME|TIMESTAMP|VENDOR|VERSION)__|gshared|traits|vector|parameters)|string|wstring|dstring|size_t|ptrdiff_t)\b/,
      operator: /\|[|=]?|&[&=]?|\+[+=]?|-[-=]?|\.?\.\.|=[>=]?|!(?:i[ns]\b|<>?=?|>=?|=)?|\bi[ns]\b|(?:<[<>]?|>>?>?|\^\^|[*\/%^~])=?/
    });
    Prism2.languages.d.comment = [
      /^\s*#!.+/,
      {
        pattern: /(^|[^\\])\/\+(?:\/\+[\s\S]*?\+\/|[\s\S])*?\+\//,
        lookbehind: true
      }
    ].concat(Prism2.languages.d.comment);
    Prism2.languages.insertBefore("d", "comment", {
      "token-string": {
        pattern: /\bq\{(?:\{[^}]*\}|[^}])*\}/,
        alias: "string"
      }
    });
    Prism2.languages.insertBefore("d", "keyword", {
      property: /\B@\w*/
    });
    Prism2.languages.insertBefore("d", "function", {
      register: {
        pattern: /\b(?:[ABCD][LHX]|E[ABCD]X|E?(?:BP|SP|DI|SI)|[ECSDGF]S|CR[0234]|DR[012367]|TR[3-7]|X?MM[0-7]|R[ABCD]X|[BS]PL|R[BS]P|[DS]IL|R[DS]I|R(?:[89]|1[0-5])[BWD]?|XMM(?:[89]|1[0-5])|YMM(?:1[0-5]|\d))\b|\bST(?:\([0-7]\)|\b)/,
        alias: "variable"
      }
    });
  }
};
var fsharp_default = {
  language: "fsharp",
  init: (Prism2) => {
    Prism2.languages.fsharp = Prism2.languages.extend("clike", {
      comment: [
        {
          pattern: /(^|[^\\])\(\*[\s\S]*?\*\)/,
          lookbehind: true
        },
        {
          pattern: /(^|[^\\:])\/\/.*/,
          lookbehind: true
        }
      ],
      keyword: /\b(?:let|return|use|yield)(?:!\B|\b)|\b(abstract|and|as|assert|base|begin|class|default|delegate|do|done|downcast|downto|elif|else|end|exception|extern|false|finally|for|fun|function|global|if|in|inherit|inline|interface|internal|lazy|match|member|module|mutable|namespace|new|not|null|of|open|or|override|private|public|rec|select|static|struct|then|to|true|try|type|upcast|val|void|when|while|with|asr|land|lor|lsl|lsr|lxor|mod|sig|atomic|break|checked|component|const|constraint|constructor|continue|eager|event|external|fixed|functor|include|method|mixin|object|parallel|process|protected|pure|sealed|tailcall|trait|virtual|volatile)\b/,
      string: {
        pattern: /(?:"""[\s\S]*?"""|@"(?:""|[^"])*"|("|')(?:\\[\s\S]|(?!\1)[^\\])*\1)B?/,
        greedy: true
      },
      number: [
        /\b0x[\da-fA-F]+(?:un|lf|LF)?\b/,
        /\b0b[01]+(?:y|uy)?\b/,
        /(?:\b\d+\.?\d*|\B\.\d+)(?:[fm]|e[+-]?\d+)?\b/i,
        /\b\d+(?:[IlLsy]|u[lsy]?|UL)?\b/
      ]
    });
    Prism2.languages.insertBefore("fsharp", "keyword", {
      preprocessor: {
        pattern: /^[^\r\n\S]*#.*/m,
        alias: "property",
        inside: {
          directive: {
            pattern: /(\s*#)\b(?:else|endif|if|light|line|nowarn)\b/,
            lookbehind: true,
            alias: "keyword"
          }
        }
      }
    });
  }
};
var glsl_default = {
  language: "glsl",
  init: (Prism2) => {
    Prism2.languages.glsl = Prism2.languages.extend("clike", {
      comment: [/\/\*[\s\S]*?\*\//, /\/\/(?:\\(?:\r\n|[\s\S])|[^\\\r\n])*/],
      number: /(?:\b0x[\da-f]+|(?:\b\d+\.?\d*|\B\.\d+)(?:e[+-]?\d+)?)[ulf]*/i,
      keyword: /\b(?:attribute|const|uniform|varying|buffer|shared|coherent|volatile|restrict|readonly|writeonly|atomic_uint|layout|centroid|flat|smooth|noperspective|patch|sample|break|continue|do|for|while|switch|case|default|if|else|subroutine|in|out|inout|float|double|int|void|bool|true|false|invariant|precise|discard|return|d?mat[234](?:x[234])?|[ibdu]?vec[234]|uint|lowp|mediump|highp|precision|[iu]?sampler[123]D|[iu]?samplerCube|sampler[12]DShadow|samplerCubeShadow|[iu]?sampler[12]DArray|sampler[12]DArrayShadow|[iu]?sampler2DRect|sampler2DRectShadow|[iu]?samplerBuffer|[iu]?sampler2DMS(?:Array)?|[iu]?samplerCubeArray|samplerCubeArrayShadow|[iu]?image[123]D|[iu]?image2DRect|[iu]?imageCube|[iu]?imageBuffer|[iu]?image[12]DArray|[iu]?imageCubeArray|[iu]?image2DMS(?:Array)?|struct|common|partition|active|asm|class|union|enum|typedef|template|this|resource|goto|inline|noinline|public|static|extern|external|interface|long|short|half|fixed|unsigned|superp|input|output|hvec[234]|fvec[234]|sampler3DRect|filter|sizeof|cast|namespace|using)\b/
    });
    Prism2.languages.insertBefore("glsl", "comment", {
      preprocessor: {
        pattern: /(^[ \t]*)#(?:(?:define|undef|if|ifdef|ifndef|else|elif|endif|error|pragma|extension|version|line)\b)?/m,
        lookbehind: true,
        alias: "builtin"
      }
    });
  }
};
var go_default = {
  language: "go",
  init: (Prism2) => {
    Prism2.languages.go = Prism2.languages.extend("clike", {
      keyword: /\b(?:break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go(?:to)?|if|import|interface|map|package|range|return|select|struct|switch|type|var)\b/,
      builtin: /\b(?:bool|byte|complex(?:64|128)|error|float(?:32|64)|rune|string|u?int(?:8|16|32|64)?|uintptr|append|cap|close|complex|copy|delete|imag|len|make|new|panic|print(?:ln)?|real|recover)\b/,
      boolean: /\b(?:_|iota|nil|true|false)\b/,
      operator: /[*\/%^!=]=?|\+[=+]?|-[=-]?|\|[=|]?|&(?:=|&|\^=?)?|>(?:>=?|=)?|<(?:<=?|=|-)?|:=|\.\.\./,
      number: /(?:\b0x[a-f\d]+|(?:\b\d+\.?\d*|\B\.\d+)(?:e[-+]?\d+)?)i?/i,
      string: {
        pattern: /(["'`])(\\[\s\S]|(?!\1)[^\\])*\1/,
        greedy: true
      }
    });
    delete Prism2.languages.go["class-name"];
  }
};
var groovy_default = {
  language: "groovy",
  init: (Prism2) => {
    Prism2.languages.groovy = Prism2.languages.extend("clike", {
      keyword: /\b(?:as|def|in|abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|native|new|package|private|protected|public|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|trait|transient|try|void|volatile|while)\b/,
      string: [
        {
          pattern: /("""|''')[\s\S]*?\1|(?:\$\/)(?:\$\/\$|[\s\S])*?\/\$/,
          greedy: true
        },
        {
          pattern: /(["'\/])(?:\\.|(?!\1)[^\\\r\n])*\1/,
          greedy: true
        }
      ],
      number: /\b(?:0b[01_]+|0x[\da-f_]+(?:\.[\da-f_p\-]+)?|[\d_]+(?:\.[\d_]+)?(?:e[+-]?[\d]+)?)[glidf]?\b/i,
      operator: {
        pattern: /(^|[^.])(?:~|==?~?|\?[.:]?|\*(?:[.=]|\*=?)?|\.[@&]|\.\.<|\.{1,2}(?!\.)|-[-=>]?|\+[+=]?|!=?|<(?:<=?|=>?)?|>(?:>>?=?|=)?|&[&=]?|\|[|=]?|\/=?|\^=?|%=?)/,
        lookbehind: true
      },
      punctuation: /\.+|[{}[\];(),:$]/
    });
    Prism2.languages.insertBefore("groovy", "string", {
      shebang: {
        pattern: /#!.+/,
        alias: "comment"
      }
    });
    Prism2.languages.insertBefore("groovy", "punctuation", {
      "spock-block": /\b(?:setup|given|when|then|and|cleanup|expect|where):/
    });
    Prism2.languages.insertBefore("groovy", "function", {
      annotation: {
        alias: "punctuation",
        pattern: /(^|[^.])@\w+/,
        lookbehind: true
      }
    });
    Prism2.hooks.add("wrap", (env) => {
      if (env.language === "groovy" && env.type === "string") {
        const delimiter = env.content[0];
        if (delimiter != "'") {
          let pattern = /([^\\])(?:\$(?:\{.*?\}|[\w.]+))/;
          if (delimiter === "$") {
            pattern = /([^\$])(?:\$(?:\{.*?\}|[\w.]+))/;
          }
          env.content = env.content.replace(/&lt;/g, "<").replace(/&amp;/g, "&");
          env.content = Prism2.highlight(env.content, {
            expression: {
              pattern,
              lookbehind: true,
              inside: Prism2.languages.groovy
            }
          });
          env.classes.push(delimiter === "/" ? "regex" : "gstring");
        }
      }
    });
  }
};
var haxe_default = {
  language: "haxe",
  init: (Prism2) => {
    Prism2.languages.haxe = Prism2.languages.extend("clike", {
      string: {
        pattern: /(["'])(?:(?!\1)[^\\]|\\[\s\S])*\1/,
        greedy: true,
        inside: {
          interpolation: {
            pattern: /(^|[^\\])\$(?:\w+|\{[^}]+\})/,
            lookbehind: true,
            inside: {
              interpolation: {
                pattern: /^\$\w*/,
                alias: "variable"
              }
            }
          }
        }
      },
      keyword: /\bthis\b|\b(?:abstract|as|break|case|cast|catch|class|continue|default|do|dynamic|else|enum|extends|extern|from|for|function|if|implements|import|in|inline|interface|macro|new|null|override|public|private|return|static|super|switch|throw|to|try|typedef|using|var|while)(?!\.)\b/,
      operator: /\.{3}|\+\+?|-[->]?|[=!]=?|&&?|\|\|?|<[<=]?|>[>=]?|[*\/%~^]/
    });
    Prism2.languages.insertBefore("haxe", "class-name", {
      regex: {
        pattern: /~\/(?:[^\/\\\r\n]|\\.)+\/[igmsu]*/,
        greedy: true
      }
    });
    Prism2.languages.insertBefore("haxe", "keyword", {
      preprocessor: {
        pattern: /#\w+/,
        alias: "builtin"
      },
      metadata: {
        pattern: /@:?\w+/,
        alias: "symbol"
      },
      reification: {
        pattern: /\$(?:\w+|(?=\{))/,
        alias: "variable"
      }
    });
    Prism2.languages.haxe.string.inside.interpolation.inside.rest = Prism2.languages.haxe;
    delete Prism2.languages.haxe["class-name"];
  }
};
var jolie_default = {
  language: "jolie",
  init: (Prism2) => {
    Prism2.languages.jolie = Prism2.languages.extend("clike", {
      keyword: /\b(?:include|define|is_defined|undef|main|init|outputPort|inputPort|Location|Protocol|Interfaces|RequestResponse|OneWay|type|interface|extender|throws|cset|csets|forward|Aggregates|Redirects|embedded|courier|execution|sequential|concurrent|single|scope|install|throw|comp|cH|default|global|linkIn|linkOut|synchronized|this|new|for|if|else|while|in|Jolie|Java|Javascript|nullProcess|spawn|constants|with|provide|until|exit|foreach|instanceof|over|service)\b/,
      builtin: /\b(?:undefined|string|int|void|long|Byte|bool|double|float|char|any)\b/,
      number: /(?:\b\d+\.?\d*|\B\.\d+)(?:e[+-]?\d+)?l?/i,
      operator: /-[-=>]?|\+[+=]?|<[<=]?|[>=*!]=?|&&|\|\||[:?\/%^]/,
      symbol: /[|;@]/,
      punctuation: /[,.]/,
      string: {
        pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
        greedy: true
      }
    });
    delete Prism2.languages.jolie["class-name"];
    delete Prism2.languages.jolie.function;
    Prism2.languages.insertBefore("jolie", "keyword", {
      function: {
        pattern: /((?:\b(?:outputPort|inputPort|in|service|courier)\b|@)\s*)\w+/,
        lookbehind: true
      },
      aggregates: {
        pattern: /(\bAggregates\s*:\s*)(?:\w+(?:\s+with\s+\w+)?\s*,\s*)*\w+(?:\s+with\s+\w+)?/,
        lookbehind: true,
        inside: {
          withExtension: {
            pattern: /\bwith\s+\w+/,
            inside: {
              keyword: /\bwith\b/
            }
          },
          function: {
            pattern: /\w+/
          },
          punctuation: {
            pattern: /,/
          }
        }
      },
      redirects: {
        pattern: /(\bRedirects\s*:\s*)(?:\w+\s*=>\s*\w+\s*,\s*)*(?:\w+\s*=>\s*\w+)/,
        lookbehind: true,
        inside: {
          punctuation: {
            pattern: /,/
          },
          function: {
            pattern: /\w+/
          },
          symbol: {
            pattern: /=>/
          }
        }
      }
    });
  }
};
var kotlin_default = {
  language: "kotlin",
  init: (Prism2) => {
    (function(Prism3) {
      Prism3.languages.kotlin = Prism3.languages.extend("clike", {
        keyword: {
          pattern: /(^|[^.])\b(?:abstract|annotation|as|break|by|catch|class|companion|const|constructor|continue|crossinline|data|do|else|enum|final|finally|for|fun|get|if|import|in|init|inline|inner|interface|internal|is|lateinit|noinline|null|object|open|out|override|package|private|protected|public|reified|return|sealed|set|super|tailrec|this|throw|to|try|val|var|when|where|while)\b/,
          lookbehind: true
        },
        function: [
          /\w+(?=\s*\()/,
          {
            pattern: /(\.)\w+(?=\s*\{)/,
            lookbehind: true
          }
        ],
        number: /\b(?:0[bx][\da-fA-F]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?[fFL]?)\b/,
        operator: /\+[+=]?|-[-=>]?|==?=?|!(?:!|==?)?|[\/*%<>]=?|[?:]:?|\.\.|&&|\|\||\b(?:and|inv|or|shl|shr|ushr|xor)\b/
      });
      delete Prism3.languages.kotlin["class-name"];
      Prism3.languages.insertBefore("kotlin", "string", {
        "raw-string": {
          pattern: /("""|''')[\s\S]*?\1/,
          alias: "string"
        }
      });
      Prism3.languages.insertBefore("kotlin", "keyword", {
        annotation: {
          pattern: /\B@(?:\w+:)?(?:[A-Z]\w*|\[[^\]]+\])/,
          alias: "builtin"
        }
      });
      Prism3.languages.insertBefore("kotlin", "function", {
        label: {
          pattern: /\w+@|@\w+/,
          alias: "symbol"
        }
      });
      const interpolation = [
        {
          pattern: /\$\{[^}]+\}/,
          inside: {
            delimiter: {
              pattern: /^\$\{|\}$/,
              alias: "variable"
            },
            rest: Prism3.languages.kotlin
          }
        },
        {
          pattern: /\$\w+/,
          alias: "variable"
        }
      ];
      Prism3.languages.kotlin.string.inside = Prism3.languages.kotlin["raw-string"].inside = {
        interpolation
      };
    })(Prism2);
  }
};
var reason_default = {
  language: "reason",
  init: (Prism2) => {
    Prism2.languages.reason = Prism2.languages.extend("clike", {
      comment: {
        pattern: /(^|[^\\])\/\*[\s\S]*?\*\//,
        lookbehind: true
      },
      string: {
        pattern: /"(?:\\(?:\r\n|[\s\S])|[^\\\r\n"])*"/,
        greedy: true
      },
      "class-name": /\b[A-Z]\w*/,
      keyword: /\b(?:and|as|assert|begin|class|constraint|do|done|downto|else|end|exception|external|for|fun|function|functor|if|in|include|inherit|initializer|lazy|let|method|module|mutable|new|nonrec|object|of|open|or|private|rec|sig|struct|switch|then|to|try|type|val|virtual|when|while|with)\b/,
      operator: /\.{3}|:[:=]|=(?:==?|>)?|<=?|>=?|[|^?'#!~`]|[+\-*\/]\.?|\b(?:mod|land|lor|lxor|lsl|lsr|asr)\b/
    });
    Prism2.languages.insertBefore("reason", "class-name", {
      character: {
        pattern: /'(?:\\x[\da-f]{2}|\\o[0-3][0-7][0-7]|\\\d{3}|\\.|[^'\\\r\n])'/,
        alias: "string"
      },
      constructor: {
        pattern: /\b[A-Z]\w*\b(?!\s*\.)/,
        alias: "variable"
      },
      label: {
        pattern: /\b[a-z]\w*(?=::)/,
        alias: "symbol"
      }
    });
    delete Prism2.languages.reason.function;
  }
};
var swift_default = {
  language: "swift",
  init: (Prism2) => {
    Prism2.languages.swift = Prism2.languages.extend("clike", {
      string: {
        pattern: /("|')(\\(?:\((?:[^()]|\([^)]+\))+\)|\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
        greedy: true,
        inside: {
          interpolation: {
            pattern: /\\\((?:[^()]|\([^)]+\))+\)/,
            inside: {
              delimiter: {
                pattern: /^\\\(|\)$/,
                alias: "variable"
              }
            }
          }
        }
      },
      keyword: /\b(?:as|associativity|break|case|catch|class|continue|convenience|default|defer|deinit|didSet|do|dynamic(?:Type)?|else|enum|extension|fallthrough|final|for|func|get|guard|if|import|in|infix|init|inout|internal|is|lazy|left|let|mutating|new|none|nonmutating|operator|optional|override|postfix|precedence|prefix|private|Protocol|public|repeat|required|rethrows|return|right|safe|self|Self|set|static|struct|subscript|super|switch|throws?|try|Type|typealias|unowned|unsafe|var|weak|where|while|willSet|__(?:COLUMN__|FILE__|FUNCTION__|LINE__))\b/,
      number: /\b(?:[\d_]+(?:\.[\de_]+)?|0x[a-f0-9_]+(?:\.[a-f0-9p_]+)?|0b[01_]+|0o[0-7_]+)\b/i,
      constant: /\b(?:nil|[A-Z_]{2,}|k[A-Z][A-Za-z_]+)\b/,
      atrule: /@\b(?:IB(?:Outlet|Designable|Action|Inspectable)|class_protocol|exported|noreturn|NS(?:Copying|Managed)|objc|UIApplicationMain|auto_closure)\b/,
      builtin: /\b(?:[A-Z]\S+|abs|advance|alignof(?:Value)?|assert|contains|count(?:Elements)?|debugPrint(?:ln)?|distance|drop(?:First|Last)|dump|enumerate|equal|filter|find|first|getVaList|indices|isEmpty|join|last|lexicographicalCompare|map|max(?:Element)?|min(?:Element)?|numericCast|overlaps|partition|print(?:ln)?|reduce|reflect|reverse|sizeof(?:Value)?|sort(?:ed)?|split|startsWith|stride(?:of(?:Value)?)?|suffix|swap|toDebugString|toString|transcode|underestimateCount|unsafeBitCast|with(?:ExtendedLifetime|Unsafe(?:MutablePointers?|Pointers?)|VaList))\b/
    });
    Prism2.languages.swift.string.inside.interpolation.inside.rest = Prism2.languages.swift;
  }
};
var crystal_default = {
  language: "crystal",
  init: (Prism2) => {
    (function(Prism3) {
      Prism3.languages.crystal = Prism3.languages.extend("ruby", {
        keyword: [
          /\b(?:abstract|alias|as|asm|begin|break|case|class|def|do|else|elsif|end|ensure|enum|extend|for|fun|if|include|instance_sizeof|lib|macro|module|next|of|out|pointerof|private|protected|rescue|return|require|select|self|sizeof|struct|super|then|type|typeof|uninitialized|union|unless|until|when|while|with|yield|__DIR__|__END_LINE__|__FILE__|__LINE__)\b/,
          {
            pattern: /(\.\s*)(?:is_a|responds_to)\?/,
            lookbehind: true
          }
        ],
        number: /\b(?:0b[01_]*[01]|0o[0-7_]*[0-7]|0x[\da-fA-F_]*[\da-fA-F]|(?:\d(?:[\d_]*\d)?)(?:\.[\d_]*\d)?(?:[eE][+-]?[\d_]*\d)?)(?:_(?:[uif](?:8|16|32|64))?)?\b/
      });
      Prism3.languages.insertBefore("crystal", "string", {
        attribute: {
          pattern: /@\[.+?\]/,
          alias: "attr-name",
          inside: {
            delimiter: {
              pattern: /^@\[|\]$/,
              alias: "tag"
            },
            rest: Prism3.languages.crystal
          }
        },
        expansion: [
          {
            pattern: /\{\{.+?\}\}/,
            inside: {
              delimiter: {
                pattern: /^\{\{|\}\}$/,
                alias: "tag"
              },
              rest: Prism3.languages.crystal
            }
          },
          {
            pattern: /\{%.+?%\}/,
            inside: {
              delimiter: {
                pattern: /^\{%|%\}$/,
                alias: "tag"
              },
              rest: Prism3.languages.crystal
            }
          }
        ]
      });
    })(Prism2);
  }
};
var erb_default = {
  language: "erb",
  init: (Prism2) => {
    (function(Prism3) {
      Prism3.languages.erb = Prism3.languages.extend("ruby", {});
      Prism3.languages.insertBefore("erb", "comment", {
        delimiter: {
          pattern: /^<%=?|%>$/,
          alias: "punctuation"
        }
      });
      Prism3.hooks.add("before-tokenize", (env) => {
        const erbPattern = /<%=?[\s\S]+?%>/g;
        Prism3.languages["markup-templating"].buildPlaceholders(env, "erb", erbPattern);
      });
      Prism3.hooks.add("after-tokenize", (env) => {
        Prism3.languages["markup-templating"].tokenizePlaceholders(env, "erb");
      });
    })(Prism2);
  }
};
var actionscript_default = {
  language: "actionscript",
  init: (Prism2) => {
    Prism2.languages.actionscript = Prism2.languages.extend("javascript", {
      keyword: /\b(?:as|break|case|catch|class|const|default|delete|do|else|extends|finally|for|function|if|implements|import|in|instanceof|interface|internal|is|native|new|null|package|private|protected|public|return|super|switch|this|throw|try|typeof|use|var|void|while|with|dynamic|each|final|get|include|namespace|native|override|set|static)\b/,
      operator: /\+\+|--|(?:[+\-*\/%^]|&&?|\|\|?|<<?|>>?>?|[!=]=?)=?|[~?@]/
    });
    Prism2.languages.actionscript["class-name"].alias = "function";
    if (Prism2.languages.markup) {
      Prism2.languages.insertBefore("actionscript", "string", {
        xml: {
          pattern: /(^|[^.])<\/?\w+(?:\s+[^\s>\/=]+=("|')(?:\\[\s\S]|(?!\2)[^\\])*\2)*\s*\/?>/,
          lookbehind: true,
          inside: {
            rest: Prism2.languages.markup
          }
        }
      });
    }
  }
};
var coffeescript_default = {
  language: "coffeescript",
  init: (Prism2) => {
    (function(Prism3) {
      let comment = /#(?!\{).+/, interpolation = {
        pattern: /#\{[^}]+\}/,
        alias: "variable"
      };
      Prism3.languages.coffeescript = Prism3.languages.extend("javascript", {
        comment,
        string: [
          {
            pattern: /'(?:\\[\s\S]|[^\\'])*'/,
            greedy: true
          },
          {
            pattern: /"(?:\\[\s\S]|[^\\"])*"/,
            greedy: true,
            inside: {
              interpolation
            }
          }
        ],
        keyword: /\b(?:and|break|by|catch|class|continue|debugger|delete|do|each|else|extend|extends|false|finally|for|if|in|instanceof|is|isnt|let|loop|namespace|new|no|not|null|of|off|on|or|own|return|super|switch|then|this|throw|true|try|typeof|undefined|unless|until|when|while|window|with|yes|yield)\b/,
        "class-member": {
          pattern: /@(?!\d)\w+/,
          alias: "variable"
        }
      });
      Prism3.languages.insertBefore("coffeescript", "comment", {
        "multiline-comment": {
          pattern: /###[\s\S]+?###/,
          alias: "comment"
        },
        "block-regex": {
          pattern: /\/{3}[\s\S]*?\/{3}/,
          alias: "regex",
          inside: {
            comment,
            interpolation
          }
        }
      });
      Prism3.languages.insertBefore("coffeescript", "string", {
        "inline-javascript": {
          pattern: /`(?:\\[\s\S]|[^\\`])*`/,
          inside: {
            delimiter: {
              pattern: /^`|`$/,
              alias: "punctuation"
            },
            rest: Prism3.languages.javascript
          }
        },
        "multiline-string": [
          {
            pattern: /'''[\s\S]*?'''/,
            greedy: true,
            alias: "string"
          },
          {
            pattern: /"""[\s\S]*?"""/,
            greedy: true,
            alias: "string",
            inside: {
              interpolation
            }
          }
        ]
      });
      Prism3.languages.insertBefore("coffeescript", "keyword", {
        property: /(?!\d)\w+(?=\s*:(?!:))/
      });
      delete Prism3.languages.coffeescript["template-string"];
    })(Prism2);
  }
};
var flow_default = {
  language: "flow",
  init: (Prism2) => {
    (function(Prism3) {
      Prism3.languages.flow = Prism3.languages.extend("javascript", {});
      Prism3.languages.insertBefore("flow", "keyword", {
        type: [
          {
            pattern: /\b(?:[Nn]umber|[Ss]tring|[Bb]oolean|Function|any|mixed|null|void)\b/,
            alias: "tag"
          }
        ]
      });
      Prism3.languages.flow["function-variable"].pattern = /[_$a-z\xA0-\uFFFF][$\w\xA0-\uFFFF]*(?=\s*=\s*(?:function\b|(?:\([^()]*\)(?:\s*:\s*\w+)?|[_$a-z\xA0-\uFFFF][$\w\xA0-\uFFFF]*)\s*=>))/i;
      Prism3.languages.insertBefore("flow", "operator", {
        "flow-punctuation": {
          pattern: /\{\||\|\}/,
          alias: "punctuation"
        }
      });
      if (Prism3.util.type(Prism3.languages.flow.keyword) !== "Array") {
        Prism3.languages.flow.keyword = [Prism3.languages.flow.keyword];
      }
      Prism3.languages.flow.keyword.unshift({
        pattern: /(^|[^$]\b)(?:type|opaque|declare|Class)\b(?!\$)/,
        lookbehind: true
      }, {
        pattern: /(^|[^$]\B)\$(?:await|Diff|Exact|Keys|ObjMap|PropertyType|Shape|Record|Supertype|Subtype|Enum)\b(?!\$)/,
        lookbehind: true
      });
    })(Prism2);
  }
};
var n4js_default = {
  language: "n4js",
  init: (Prism2) => {
    Prism2.languages.n4js = Prism2.languages.extend("javascript", {
      keyword: /\b(?:any|Array|boolean|break|case|catch|class|const|constructor|continue|debugger|declare|default|delete|do|else|enum|export|extends|false|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|module|new|null|number|package|private|protected|public|return|set|static|string|super|switch|this|throw|true|try|typeof|var|void|while|with|yield)\b/
    });
    Prism2.languages.insertBefore("n4js", "constant", {
      annotation: {
        pattern: /@+\w+/,
        alias: "operator"
      }
    });
    Prism2.languages.n4jsd = Prism2.languages.n4js;
  }
};
var typescript_default = {
  language: "typescript",
  init: (Prism2) => {
    Prism2.languages.typescript = Prism2.languages.extend("javascript", {
      keyword: /\b(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|var|void|while|with|yield|module|declare|constructor|namespace|abstract|require|type)\b/,
      builtin: /\b(?:string|Function|any|number|boolean|Array|symbol|console)\b/
    });
    Prism2.languages.ts = Prism2.languages.typescript;
  }
};
var jsx_default = {
  language: "jsx",
  init: (Prism2) => {
    const javascript = Prism2.util.clone(Prism2.languages.javascript);
    Prism2.languages.jsx = Prism2.languages.extend("markup", javascript);
    Prism2.languages.jsx.tag.pattern = /<\/?[\w.:-]+\s*(?:\s+(?:[\w.:-]+(?:=(?:("|')(?:\\[\s\S]|(?!\1)[^\\])*\1|[^\s{'">=]+|\{(?:\{[^}]*\}|[^{}])+\}))?|\{\.{3}[a-z_$][\w$]*(?:\.[a-z_$][\w$]*)*\}))*\s*\/?>/i;
    Prism2.languages.jsx.tag.inside["attr-value"].pattern = /=(?!\{)(?:("|')(?:\\[\s\S]|(?!\1)[^\\])*\1|[^\s'">]+)/i;
    Prism2.languages.insertBefore("inside", "attr-name", {
      spread: {
        pattern: /\{\.{3}[a-z_$][\w$]*(?:\.[a-z_$][\w$]*)*\}/,
        inside: {
          punctuation: /\.{3}|[{}.]/,
          "attr-value": /\w+/
        }
      }
    }, Prism2.languages.jsx.tag);
    Prism2.languages.insertBefore("inside", "attr-value", {
      script: {
        pattern: /=(\{(?:\{[^}]*\}|[^}])+\})/i,
        inside: {
          "script-punctuation": {
            pattern: /^=(?={)/,
            alias: "punctuation"
          },
          rest: Prism2.languages.jsx
        },
        alias: "language-javascript"
      }
    }, Prism2.languages.jsx.tag);
    var stringifyToken = function(token) {
      if (typeof token === "string") {
        return token;
      }
      if (typeof token.content === "string") {
        return token.content;
      }
      return token.content.map(stringifyToken).join("");
    };
    var walkTokens = function(tokens) {
      const openedTags = [];
      for (let i = 0;i < tokens.length; i++) {
        const token = tokens[i];
        let notTagNorBrace = false;
        if (typeof token !== "string") {
          if (token.type === "tag" && token.content[0] && token.content[0].type === "tag") {
            if (token.content[0].content[0].content === "</") {
              if (openedTags.length > 0 && openedTags[openedTags.length - 1].tagName === stringifyToken(token.content[0].content[1])) {
                openedTags.pop();
              }
            } else if (token.content[token.content.length - 1].content === "/>") {} else {
              openedTags.push({
                tagName: stringifyToken(token.content[0].content[1]),
                openedBraces: 0
              });
            }
          } else if (openedTags.length > 0 && token.type === "punctuation" && token.content === "{") {
            openedTags[openedTags.length - 1].openedBraces++;
          } else if (openedTags.length > 0 && openedTags[openedTags.length - 1].openedBraces > 0 && token.type === "punctuation" && token.content === "}") {
            openedTags[openedTags.length - 1].openedBraces--;
          } else {
            notTagNorBrace = true;
          }
        }
        if (notTagNorBrace || typeof token === "string") {
          if (openedTags.length > 0 && openedTags[openedTags.length - 1].openedBraces === 0) {
            let plainText = stringifyToken(token);
            if (i < tokens.length - 1 && (typeof tokens[i + 1] === "string" || tokens[i + 1].type === "plain-text")) {
              plainText += stringifyToken(tokens[i + 1]);
              tokens.splice(i + 1, 1);
            }
            if (i > 0 && (typeof tokens[i - 1] === "string" || tokens[i - 1].type === "plain-text")) {
              plainText = stringifyToken(tokens[i - 1]) + plainText;
              tokens.splice(i - 1, 1);
              i--;
            }
            tokens[i] = new Prism2.Token("plain-text", plainText, null, plainText);
          }
        }
        if (token.content && typeof token.content !== "string") {
          walkTokens(token.content);
        }
      }
    };
    Prism2.hooks.add("after-tokenize", (env) => {
      if (env.language !== "jsx" && env.language !== "tsx") {
        return;
      }
      walkTokens(env.tokens);
    });
  }
};
var tsx_default = {
  language: "tsx",
  init: (Prism2) => {
    const typescript = Prism2.util.clone(Prism2.languages.typescript);
    Prism2.languages.tsx = Prism2.languages.extend("jsx", typescript);
  }
};
var arduino_default = {
  language: "arduino",
  init: (Prism2) => {
    Prism2.languages.arduino = Prism2.languages.extend("cpp", {
      keyword: /\b(?:setup|if|else|while|do|for|return|in|instanceof|default|function|loop|goto|switch|case|new|try|throw|catch|finally|null|break|continue|boolean|bool|void|byte|word|string|String|array|int|long|integer|double)\b/,
      builtin: /\b(?:KeyboardController|MouseController|SoftwareSerial|EthernetServer|EthernetClient|LiquidCrystal|LiquidCrystal_I2C|RobotControl|GSMVoiceCall|EthernetUDP|EsploraTFT|HttpClient|RobotMotor|WiFiClient|GSMScanner|FileSystem|Scheduler|GSMServer|YunClient|YunServer|IPAddress|GSMClient|GSMModem|Keyboard|Ethernet|Console|GSMBand|Esplora|Stepper|Process|WiFiUDP|GSM_SMS|Mailbox|USBHost|Firmata|PImage|Client|Server|GSMPIN|FileIO|Bridge|Serial|EEPROM|Stream|Mouse|Audio|Servo|File|Task|GPRS|WiFi|Wire|TFT|GSM|SPI|SD|runShellCommandAsynchronously|analogWriteResolution|retrieveCallingNumber|printFirmwareVersion|analogReadResolution|sendDigitalPortPair|noListenOnLocalhost|readJoystickButton|setFirmwareVersion|readJoystickSwitch|scrollDisplayRight|getVoiceCallStatus|scrollDisplayLeft|writeMicroseconds|delayMicroseconds|beginTransmission|getSignalStrength|runAsynchronously|getAsynchronously|listenOnLocalhost|getCurrentCarrier|readAccelerometer|messageAvailable|sendDigitalPorts|lineFollowConfig|countryNameWrite|runShellCommand|readStringUntil|rewindDirectory|readTemperature|setClockDivider|readLightSensor|endTransmission|analogReference|detachInterrupt|countryNameRead|attachInterrupt|encryptionType|readBytesUntil|robotNameWrite|readMicrophone|robotNameRead|cityNameWrite|userNameWrite|readJoystickY|readJoystickX|mouseReleased|openNextFile|scanNetworks|noInterrupts|digitalWrite|beginSpeaker|mousePressed|isActionDone|mouseDragged|displayLogos|noAutoscroll|addParameter|remoteNumber|getModifiers|keyboardRead|userNameRead|waitContinue|processInput|parseCommand|printVersion|readNetworks|writeMessage|blinkVersion|cityNameRead|readMessage|setDataMode|parsePacket|isListening|setBitOrder|beginPacket|isDirectory|motorsWrite|drawCompass|digitalRead|clearScreen|serialEvent|rightToLeft|setTextSize|leftToRight|requestFrom|keyReleased|compassRead|analogWrite|interrupts|WiFiServer|disconnect|playMelody|parseFloat|autoscroll|getPINUsed|setPINUsed|setTimeout|sendAnalog|readSlider|analogRead|beginWrite|createChar|motorsStop|keyPressed|tempoWrite|readButton|subnetMask|debugPrint|macAddress|writeGreen|randomSeed|attachGPRS|readString|sendString|remotePort|releaseAll|mouseMoved|background|getXChange|getYChange|answerCall|getResult|voiceCall|endPacket|constrain|getSocket|writeJSON|getButton|available|connected|findUntil|readBytes|exitValue|readGreen|writeBlue|startLoop|IPAddress|isPressed|sendSysex|pauseMode|gatewayIP|setCursor|getOemKey|tuneWrite|noDisplay|loadImage|switchPIN|onRequest|onReceive|changePIN|playFile|noBuffer|parseInt|overflow|checkPIN|knobRead|beginTFT|bitClear|updateIR|bitWrite|position|writeRGB|highByte|writeRed|setSpeed|readBlue|noStroke|remoteIP|transfer|shutdown|hangCall|beginSMS|endWrite|attached|maintain|noCursor|checkReg|checkPUK|shiftOut|isValid|shiftIn|pulseIn|connect|println|localIP|pinMode|getIMEI|display|noBlink|process|getBand|running|beginSD|drawBMP|lowByte|setBand|release|bitRead|prepare|pointTo|readRed|setMode|noFill|remove|listen|stroke|detach|attach|noTone|exists|buffer|height|bitSet|circle|config|cursor|random|IRread|setDNS|endSMS|getKey|micros|millis|begin|print|write|ready|flush|width|isPIN|blink|clear|press|mkdir|rmdir|close|point|yield|image|BSSID|click|delay|read|text|move|peek|beep|rect|line|open|seek|fill|size|turn|stop|home|find|step|tone|sqrt|RSSI|SSID|end|bit|tan|cos|sin|pow|map|abs|max|min|get|run|put)\b/,
      constant: /\b(?:DIGITAL_MESSAGE|FIRMATA_STRING|ANALOG_MESSAGE|REPORT_DIGITAL|REPORT_ANALOG|INPUT_PULLUP|SET_PIN_MODE|INTERNAL2V56|SYSTEM_RESET|LED_BUILTIN|INTERNAL1V1|SYSEX_START|INTERNAL|EXTERNAL|DEFAULT|OUTPUT|INPUT|HIGH|LOW)\b/
    });
  }
};
var django_default = {
  language: "django",
  init: (Prism2) => {
    const _django_template = {
      property: {
        pattern: /(?:{{|{%)[\s\S]*?(?:%}|}})/g,
        greedy: true,
        inside: {
          string: {
            pattern: /("|')(?:\\.|(?!\1)[^\\\r\n])*\1/,
            greedy: true
          },
          keyword: /\b(?:\||load|verbatim|widthratio|ssi|firstof|for|url|ifchanged|csrf_token|lorem|ifnotequal|autoescape|now|templatetag|debug|cycle|ifequal|regroup|comment|filter|endfilter|if|spaceless|with|extends|block|include|else|empty|endif|endfor|as|endblock|endautoescape|endverbatim|trans|endtrans|[Tt]rue|[Ff]alse|[Nn]one|in|is|static|macro|endmacro|call|endcall|set|endset|raw|endraw)\b/,
          operator: /[-+=]=?|!=|\*\*?=?|\/\/?=?|<[<=>]?|>[=>]?|[&|^~]|\b(?:or|and|not)\b/,
          function: /\b(?:_|abs|add|addslashes|attr|batch|callable|capfirst|capitalize|center|count|cut|d|date|default|default_if_none|defined|dictsort|dictsortreversed|divisibleby|e|equalto|escape|escaped|escapejs|even|filesizeformat|first|float|floatformat|force_escape|forceescape|format|get_digit|groupby|indent|int|iriencode|iterable|join|last|length|length_is|linebreaks|linebreaksbr|linenumbers|list|ljust|lower|make_list|map|mapping|number|odd|phone2numeric|pluralize|pprint|random|reject|rejectattr|removetags|replace|reverse|rjust|round|safe|safeseq|sameas|select|selectattr|sequence|slice|slugify|sort|string|stringformat|striptags|sum|time|timesince|timeuntil|title|trim|truncate|truncatechars|truncatechars_html|truncatewords|truncatewords_html|undefined|unordered_list|upper|urlencode|urlize|urlizetrunc|wordcount|wordwrap|xmlattr|yesno)\b/,
          important: /\b-?\d+(?:\.\d+)?\b/,
          variable: /\b\w+?\b/,
          punctuation: /[[\];(),.:]/
        }
      }
    };
    Prism2.languages.django = Prism2.languages.extend("markup", {
      comment: /(?:<!--|{#)[\s\S]*?(?:#}|-->)/
    });
    Prism2.languages.django.tag.pattern = /<\/?(?!\d)[^\s>\/=$<]+(?:\s+[^\s>\/=]+(?:=(?:("|')(?:\\[\s\S]|(?!\1)[^\\])*\1|[^>=]+))?)*\s*\/?>/i;
    Prism2.languages.insertBefore("django", "entity", _django_template);
    Prism2.languages.insertBefore("inside", "tag", _django_template, Prism2.languages.django.tag);
    if (Prism2.languages.javascript) {
      Prism2.languages.insertBefore("inside", "string", _django_template, Prism2.languages.django.script);
      Prism2.languages.django.script.inside.string.inside = _django_template;
    }
    if (Prism2.languages.css) {
      Prism2.languages.insertBefore("inside", "atrule", { tag: _django_template.property }, Prism2.languages.django.style);
      Prism2.languages.django.style.inside.string.inside = _django_template;
    }
    Prism2.languages.jinja2 = Prism2.languages.django;
  }
};
var aspnet_default = {
  language: "aspnet",
  init: (Prism2) => {
    Prism2.languages.aspnet = Prism2.languages.extend("markup", {
      "page-directive tag": {
        pattern: /<%\s*@.*%>/i,
        inside: {
          "page-directive tag": /<%\s*@\s*(?:Assembly|Control|Implements|Import|Master(?:Type)?|OutputCache|Page|PreviousPageType|Reference|Register)?|%>/i,
          rest: Prism2.languages.markup.tag.inside
        }
      },
      "directive tag": {
        pattern: /<%.*%>/i,
        inside: {
          "directive tag": /<%\s*?[$=%#:]{0,2}|%>/i,
          rest: Prism2.languages.csharp
        }
      }
    });
    Prism2.languages.aspnet.tag.pattern = /<(?!%)\/?[^\s>\/]+(?:\s+[^\s>\/=]+(?:=(?:("|')(?:\\[\s\S]|(?!\1)[^\\])*\1|[^\s'">=]+))?)*\s*\/?>/i;
    Prism2.languages.insertBefore("inside", "punctuation", {
      "directive tag": Prism2.languages.aspnet["directive tag"]
    }, Prism2.languages.aspnet.tag.inside["attr-value"]);
    Prism2.languages.insertBefore("aspnet", "comment", {
      "asp comment": /<%--[\s\S]*?--%>/
    });
    Prism2.languages.insertBefore("aspnet", Prism2.languages.javascript ? "script" : "tag", {
      "asp script": {
        pattern: /(<script(?=.*runat=['"]?server['"]?)[\s\S]*?>)[\s\S]*?(?=<\/script>)/i,
        lookbehind: true,
        inside: Prism2.languages.csharp || {}
      }
    });
  }
};
var velocity_default = {
  language: "velocity",
  init: (Prism2) => {
    (function(Prism3) {
      Prism3.languages.velocity = Prism3.languages.extend("markup", {});
      const velocity = {
        variable: {
          pattern: /(^|[^\\](?:\\\\)*)\$!?(?:[a-z][\w-]*(?:\([^)]*\))?(?:\.[a-z][\w-]*(?:\([^)]*\))?|\[[^\]]+])*|{[^}]+})/i,
          lookbehind: true,
          inside: {}
        },
        string: {
          pattern: /"[^"]*"|'[^']*'/,
          greedy: true
        },
        number: /\b\d+\b/,
        boolean: /\b(?:true|false)\b/,
        operator: /[=!<>]=?|[+*/%-]|&&|\|\||\.\.|\b(?:eq|g[et]|l[et]|n(?:e|ot))\b/,
        punctuation: /[(){}[\]:,.]/
      };
      velocity.variable.inside = {
        string: velocity.string,
        function: {
          pattern: /([^\w-])[a-z][\w-]*(?=\()/,
          lookbehind: true
        },
        number: velocity.number,
        boolean: velocity.boolean,
        punctuation: velocity.punctuation
      };
      Prism3.languages.insertBefore("velocity", "comment", {
        unparsed: {
          pattern: /(^|[^\\])#\[\[[\s\S]*?]]#/,
          lookbehind: true,
          greedy: true,
          inside: {
            punctuation: /^#\[\[|]]#$/
          }
        },
        "velocity-comment": [
          {
            pattern: /(^|[^\\])#\*[\s\S]*?\*#/,
            lookbehind: true,
            greedy: true,
            alias: "comment"
          },
          {
            pattern: /(^|[^\\])##.*/,
            lookbehind: true,
            greedy: true,
            alias: "comment"
          }
        ],
        directive: {
          pattern: /(^|[^\\](?:\\\\)*)#@?(?:[a-z][\w-]*|{[a-z][\w-]*})(?:\s*\((?:[^()]|\([^()]*\))*\))?/i,
          lookbehind: true,
          inside: {
            keyword: {
              pattern: /^#@?(?:[a-z][\w-]*|{[a-z][\w-]*})|\bin\b/,
              inside: {
                punctuation: /[{}]/
              }
            },
            rest: velocity
          }
        },
        variable: velocity.variable
      });
      Prism3.languages.velocity.tag.inside["attr-value"].inside.rest = Prism3.languages.velocity;
    })(Prism2);
  }
};
var parser_default = {
  language: "parser",
  init: (Prism2) => {
    Prism2.languages.parser = Prism2.languages.extend("markup", {
      keyword: {
        pattern: /(^|[^^])(?:\^(?:case|eval|for|if|switch|throw)\b|@(?:BASE|CLASS|GET(?:_DEFAULT)?|OPTIONS|SET_DEFAULT|USE)\b)/,
        lookbehind: true
      },
      variable: {
        pattern: /(^|[^^])\B\$(?:\w+|(?=[.{]))(?:(?:\.|::?)\w+)*(?:\.|::?)?/,
        lookbehind: true,
        inside: {
          punctuation: /\.|:+/
        }
      },
      function: {
        pattern: /(^|[^^])\B[@^]\w+(?:(?:\.|::?)\w+)*(?:\.|::?)?/,
        lookbehind: true,
        inside: {
          keyword: {
            pattern: /(^@)(?:GET_|SET_)/,
            lookbehind: true
          },
          punctuation: /\.|:+/
        }
      },
      escape: {
        pattern: /\^(?:[$^;@()\[\]{}"':]|#[a-f\d]*)/i,
        alias: "builtin"
      },
      punctuation: /[\[\](){};]/
    });
    Prism2.languages.insertBefore("parser", "keyword", {
      "parser-comment": {
        pattern: /(\s)#.*/,
        lookbehind: true,
        alias: "comment"
      },
      expression: {
        pattern: /(^|[^^])\((?:[^()]|\((?:[^()]|\((?:[^()])*\))*\))*\)/,
        greedy: true,
        lookbehind: true,
        inside: {
          string: {
            pattern: /(^|[^^])(["'])(?:(?!\2)[^^]|\^[\s\S])*\2/,
            lookbehind: true
          },
          keyword: Prism2.languages.parser.keyword,
          variable: Prism2.languages.parser.variable,
          function: Prism2.languages.parser.function,
          boolean: /\b(?:true|false)\b/,
          number: /\b(?:0x[a-f\d]+|\d+\.?\d*(?:e[+-]?\d+)?)\b/i,
          escape: Prism2.languages.parser.escape,
          operator: /[~+*\/\\%]|!(?:\|\|?|=)?|&&?|\|\|?|==|<[<=]?|>[>=]?|-[fd]?|\b(?:def|eq|ge|gt|in|is|le|lt|ne)\b/,
          punctuation: Prism2.languages.parser.punctuation
        }
      }
    });
    Prism2.languages.insertBefore("inside", "punctuation", {
      expression: Prism2.languages.parser.expression,
      keyword: Prism2.languages.parser.keyword,
      variable: Prism2.languages.parser.variable,
      function: Prism2.languages.parser.function,
      escape: Prism2.languages.parser.escape,
      "parser-punctuation": {
        pattern: Prism2.languages.parser.punctuation,
        alias: "punctuation"
      }
    }, Prism2.languages.parser.tag.inside["attr-value"]);
  }
};
var php_extras_default = {
  language: "php-extras",
  init: (Prism2) => {
    Prism2.languages.insertBefore("php", "variable", {
      this: /\$this\b/,
      global: /\$(?:_(?:SERVER|GET|POST|FILES|REQUEST|SESSION|ENV|COOKIE)|GLOBALS|HTTP_RAW_POST_DATA|argc|argv|php_errormsg|http_response_header)\b/,
      scope: {
        pattern: /\b[\w\\]+::/,
        inside: {
          keyword: /static|self|parent/,
          punctuation: /::|\\/
        }
      }
    });
  }
};
var abap_default = {
  language: "abap",
  init: (Prism2) => {
    Prism2.languages.abap = {
      comment: /^\*.*/m,
      string: /(`|')(?:\\.|(?!\1)[^\\\r\n])*\1/m,
      "string-template": {
        pattern: /([|}])(?:\\.|[^\\|{\r\n])*(?=[|{])/,
        lookbehind: true,
        alias: "string"
      },
      "eol-comment": {
        pattern: /(^|\s)".*/m,
        lookbehind: true,
        alias: "comment"
      },
      keyword: {
        pattern: /(\s|\.|^)(?:SCIENTIFIC_WITH_LEADING_ZERO|SCALE_PRESERVING_SCIENTIFIC|RMC_COMMUNICATION_FAILURE|END-ENHANCEMENT-SECTION|MULTIPLY-CORRESPONDING|SUBTRACT-CORRESPONDING|VERIFICATION-MESSAGE|DIVIDE-CORRESPONDING|ENHANCEMENT-SECTION|CURRENCY_CONVERSION|RMC_SYSTEM_FAILURE|START-OF-SELECTION|MOVE-CORRESPONDING|RMC_INVALID_STATUS|CUSTOMER-FUNCTION|END-OF-DEFINITION|ENHANCEMENT-POINT|SYSTEM-EXCEPTIONS|ADD-CORRESPONDING|SCALE_PRESERVING|SELECTION-SCREEN|CURSOR-SELECTION|END-OF-SELECTION|LOAD-OF-PROGRAM|SCROLL-BOUNDARY|SELECTION-TABLE|EXCEPTION-TABLE|IMPLEMENTATIONS|PARAMETER-TABLE|RIGHT-JUSTIFIED|UNIT_CONVERSION|AUTHORITY-CHECK|LIST-PROCESSING|SIGN_AS_POSTFIX|COL_BACKGROUND|IMPLEMENTATION|INTERFACE-POOL|TRANSFORMATION|IDENTIFICATION|ENDENHANCEMENT|LINE-SELECTION|INITIALIZATION|LEFT-JUSTIFIED|SELECT-OPTIONS|SELECTION-SETS|COMMUNICATION|CORRESPONDING|DECIMAL_SHIFT|PRINT-CONTROL|VALUE-REQUEST|CHAIN-REQUEST|FUNCTION-POOL|FIELD-SYMBOLS|FUNCTIONALITY|INVERTED-DATE|SELECTION-SET|CLASS-METHODS|OUTPUT-LENGTH|CLASS-CODING|COL_NEGATIVE|ERRORMESSAGE|FIELD-GROUPS|HELP-REQUEST|NO-EXTENSION|NO-TOPOFPAGE|REDEFINITION|DISPLAY-MODE|ENDINTERFACE|EXIT-COMMAND|FIELD-SYMBOL|NO-SCROLLING|SHORTDUMP-ID|ACCESSPOLICY|CLASS-EVENTS|COL_POSITIVE|DECLARATIONS|ENHANCEMENTS|FILTER-TABLE|SWITCHSTATES|SYNTAX-CHECK|TRANSPORTING|ASYNCHRONOUS|SYNTAX-TRACE|TOKENIZATION|USER-COMMAND|WITH-HEADING|ABAP-SOURCE|BREAK-POINT|CHAIN-INPUT|COMPRESSION|FIXED-POINT|NEW-SECTION|NON-UNICODE|OCCURRENCES|RESPONSIBLE|SYSTEM-CALL|TRACE-TABLE|ABBREVIATED|CHAR-TO-HEX|END-OF-FILE|ENDFUNCTION|ENVIRONMENT|ASSOCIATION|COL_HEADING|EDITOR-CALL|END-OF-PAGE|ENGINEERING|IMPLEMENTED|INTENSIFIED|RADIOBUTTON|SYSTEM-EXIT|TOP-OF-PAGE|TRANSACTION|APPLICATION|CONCATENATE|DESTINATION|ENHANCEMENT|IMMEDIATELY|NO-GROUPING|PRECOMPILED|REPLACEMENT|TITLE-LINES|ACTIVATION|BYTE-ORDER|CLASS-POOL|CONNECTION|CONVERSION|DEFINITION|DEPARTMENT|EXPIRATION|INHERITING|MESSAGE-ID|NO-HEADING|PERFORMING|QUEUE-ONLY|RIGHTSPACE|SCIENTIFIC|STATUSINFO|STRUCTURES|SYNCPOINTS|WITH-TITLE|ATTRIBUTES|BOUNDARIES|CLASS-DATA|COL_NORMAL|DD\/MM\/YYYY|DESCENDING|INTERFACES|LINE-COUNT|MM\/DD\/YYYY|NON-UNIQUE|PRESERVING|SELECTIONS|STATEMENTS|SUBROUTINE|TRUNCATION|TYPE-POOLS|ARITHMETIC|BACKGROUND|ENDPROVIDE|EXCEPTIONS|IDENTIFIER|INDEX-LINE|OBLIGATORY|PARAMETERS|PERCENTAGE|PUSHBUTTON|RESOLUTION|COMPONENTS|DEALLOCATE|DISCONNECT|DUPLICATES|FIRST-LINE|HEAD-LINES|NO-DISPLAY|OCCURRENCE|RESPECTING|RETURNCODE|SUBMATCHES|TRACE-FILE|ASCENDING|BYPASSING|ENDMODULE|EXCEPTION|EXCLUDING|EXPORTING|INCREMENT|MATCHCODE|PARAMETER|PARTIALLY|PREFERRED|REFERENCE|REPLACING|RETURNING|SELECTION|SEPARATED|SPECIFIED|STATEMENT|TIMESTAMP|TYPE-POOL|ACCEPTING|APPENDAGE|ASSIGNING|COL_GROUP|COMPARING|CONSTANTS|DANGEROUS|IMPORTING|INSTANCES|LEFTSPACE|LOG-POINT|QUICKINFO|READ-ONLY|SCROLLING|SQLSCRIPT|STEP-LOOP|TOP-LINES|TRANSLATE|APPENDING|AUTHORITY|CHARACTER|COMPONENT|CONDITION|DIRECTORY|DUPLICATE|MESSAGING|RECEIVING|SUBSCREEN|ACCORDING|COL_TOTAL|END-LINES|ENDMETHOD|ENDSELECT|EXPANDING|EXTENSION|INCLUDING|INFOTYPES|INTERFACE|INTERVALS|LINE-SIZE|PF-STATUS|PROCEDURE|PROTECTED|REQUESTED|RESUMABLE|RIGHTPLUS|SAP-SPOOL|SECONDARY|STRUCTURE|SUBSTRING|TABLEVIEW|NUMOFCHAR|ADJACENT|ANALYSIS|ASSIGNED|BACKWARD|CHANNELS|CHECKBOX|CONTINUE|CRITICAL|DATAINFO|DD\/MM\/YY|DURATION|ENCODING|ENDCLASS|FUNCTION|LEFTPLUS|LINEFEED|MM\/DD\/YY|OVERFLOW|RECEIVED|SKIPPING|SORTABLE|STANDARD|SUBTRACT|SUPPRESS|TABSTRIP|TITLEBAR|TRUNCATE|UNASSIGN|WHENEVER|ANALYZER|COALESCE|COMMENTS|CONDENSE|DECIMALS|DEFERRED|ENDWHILE|EXPLICIT|KEYWORDS|MESSAGES|POSITION|PRIORITY|RECEIVER|RENAMING|TIMEZONE|TRAILING|ALLOCATE|CENTERED|CIRCULAR|CONTROLS|CURRENCY|DELETING|DESCRIBE|DISTANCE|ENDCATCH|EXPONENT|EXTENDED|GENERATE|IGNORING|INCLUDES|INTERNAL|MAJOR-ID|MODIFIER|NEW-LINE|OPTIONAL|PROPERTY|ROLLBACK|STARTING|SUPPLIED|ABSTRACT|CHANGING|CONTEXTS|CREATING|CUSTOMER|DATABASE|DAYLIGHT|DEFINING|DISTINCT|DIVISION|ENABLING|ENDCHAIN|ESCAPING|HARMLESS|IMPLICIT|INACTIVE|LANGUAGE|MINOR-ID|MULTIPLY|NEW-PAGE|NO-TITLE|POS_HIGH|SEPARATE|TEXTPOOL|TRANSFER|SELECTOR|DBMAXLEN|ITERATOR|SELECTOR|ARCHIVE|BIT-XOR|BYTE-CO|COLLECT|COMMENT|CURRENT|DEFAULT|DISPLAY|ENDFORM|EXTRACT|LEADING|LISTBOX|LOCATOR|MEMBERS|METHODS|NESTING|POS_LOW|PROCESS|PROVIDE|RAISING|RESERVE|SECONDS|SUMMARY|VISIBLE|BETWEEN|BIT-AND|BYTE-CS|CLEANUP|COMPUTE|CONTROL|CONVERT|DATASET|ENDCASE|FORWARD|HEADERS|HOTSPOT|INCLUDE|INVERSE|KEEPING|NO-ZERO|OBJECTS|OVERLAY|PADDING|PATTERN|PROGRAM|REFRESH|SECTION|SUMMING|TESTING|VERSION|WINDOWS|WITHOUT|BIT-NOT|BYTE-CA|BYTE-NA|CASTING|CONTEXT|COUNTRY|DYNAMIC|ENABLED|ENDLOOP|EXECUTE|FRIENDS|HANDLER|HEADING|INITIAL|\*-INPUT|LOGFILE|MAXIMUM|MINIMUM|NO-GAPS|NO-SIGN|PRAGMAS|PRIMARY|PRIVATE|REDUCED|REPLACE|REQUEST|RESULTS|UNICODE|WARNING|ALIASES|BYTE-CN|BYTE-NS|CALLING|COL_KEY|COLUMNS|CONNECT|ENDEXEC|ENTRIES|EXCLUDE|FILTERS|FURTHER|HELP-ID|LOGICAL|MAPPING|MESSAGE|NAMETAB|OPTIONS|PACKAGE|PERFORM|RECEIVE|STATICS|VARYING|BINDING|CHARLEN|GREATER|XSTRLEN|ACCEPT|APPEND|DETAIL|ELSEIF|ENDING|ENDTRY|FORMAT|FRAMES|GIVING|HASHED|HEADER|IMPORT|INSERT|MARGIN|MODULE|NATIVE|OBJECT|OFFSET|REMOTE|RESUME|SAVING|SIMPLE|SUBMIT|TABBED|TOKENS|UNIQUE|UNPACK|UPDATE|WINDOW|YELLOW|ACTUAL|ASPECT|CENTER|CURSOR|DELETE|DIALOG|DIVIDE|DURING|ERRORS|EVENTS|EXTEND|FILTER|HANDLE|HAVING|IGNORE|LITTLE|MEMORY|NO-GAP|OCCURS|OPTION|PERSON|PLACES|PUBLIC|REDUCE|REPORT|RESULT|SINGLE|SORTED|SWITCH|SYNTAX|TARGET|VALUES|WRITER|ASSERT|BLOCKS|BOUNDS|BUFFER|CHANGE|COLUMN|COMMIT|CONCAT|COPIES|CREATE|DDMMYY|DEFINE|ENDIAN|ESCAPE|EXPAND|KERNEL|LAYOUT|LEGACY|LEVELS|MMDDYY|NUMBER|OUTPUT|RANGES|READER|RETURN|SCREEN|SEARCH|SELECT|SHARED|SOURCE|STABLE|STATIC|SUBKEY|SUFFIX|TABLES|UNWIND|YYMMDD|ASSIGN|BACKUP|BEFORE|BINARY|BIT-OR|BLANKS|CLIENT|CODING|COMMON|DEMAND|DYNPRO|EXCEPT|EXISTS|EXPORT|FIELDS|GLOBAL|GROUPS|LENGTH|LOCALE|MEDIUM|METHOD|MODIFY|NESTED|OTHERS|REJECT|SCROLL|SUPPLY|SYMBOL|ENDFOR|STRLEN|ALIGN|BEGIN|BOUND|ENDAT|ENTRY|EVENT|FINAL|FLUSH|GRANT|INNER|SHORT|USING|WRITE|AFTER|BLACK|BLOCK|CLOCK|COLOR|COUNT|DUMMY|EMPTY|ENDDO|ENDON|GREEN|INDEX|INOUT|LEAVE|LEVEL|LINES|MODIF|ORDER|OUTER|RANGE|RESET|RETRY|RIGHT|SMART|SPLIT|STYLE|TABLE|THROW|UNDER|UNTIL|UPPER|UTF-8|WHERE|ALIAS|BLANK|CLEAR|CLOSE|EXACT|FETCH|FIRST|FOUND|GROUP|LLANG|LOCAL|OTHER|REGEX|SPOOL|TITLE|TYPES|VALID|WHILE|ALPHA|BOXED|CATCH|CHAIN|CHECK|CLASS|COVER|ENDIF|EQUIV|FIELD|FLOOR|FRAME|INPUT|LOWER|MATCH|NODES|PAGES|PRINT|RAISE|ROUND|SHIFT|SPACE|SPOTS|STAMP|STATE|TASKS|TIMES|TRMAC|ULINE|UNION|VALUE|WIDTH|EQUAL|LOG10|TRUNC|BLOB|CASE|CEIL|CLOB|COND|EXIT|FILE|GAPS|HOLD|INCL|INTO|KEEP|KEYS|LAST|LINE|LONG|LPAD|MAIL|MODE|OPEN|PINK|READ|ROWS|TEST|THEN|ZERO|AREA|BACK|BADI|BYTE|CAST|EDIT|EXEC|FAIL|FIND|FKEQ|FONT|FREE|GKEQ|HIDE|INIT|ITNO|LATE|LOOP|MAIN|MARK|MOVE|NEXT|NULL|RISK|ROLE|UNIT|WAIT|ZONE|BASE|CALL|CODE|DATA|DATE|FKGE|GKGE|HIGH|KIND|LEFT|LIST|MASK|MESH|NAME|NODE|PACK|PAGE|POOL|SEND|SIGN|SIZE|SOME|STOP|TASK|TEXT|TIME|USER|VARY|WITH|WORD|BLUE|CONV|COPY|DEEP|ELSE|FORM|FROM|HINT|ICON|JOIN|LIKE|LOAD|ONLY|PART|SCAN|SKIP|SORT|TYPE|UNIX|VIEW|WHEN|WORK|ACOS|ASIN|ATAN|COSH|EACH|FRAC|LESS|RTTI|SINH|SQRT|TANH|AVG|BIT|DIV|ISO|LET|OUT|PAD|SQL|ALL|CI_|CPI|END|LOB|LPI|MAX|MIN|NEW|OLE|RUN|SET|\?TO|YES|ABS|ADD|AND|BIG|FOR|HDB|JOB|LOW|NOT|SAP|TRY|VIA|XML|ANY|GET|IDS|KEY|MOD|OFF|PUT|RAW|RED|REF|SUM|TAB|XSD|CNT|COS|EXP|LOG|SIN|TAN|XOR|AT|CO|CP|DO|GT|ID|IF|NS|OR|BT|CA|CS|GE|NA|NB|EQ|IN|LT|NE|NO|OF|ON|PF|TO|AS|BY|CN|IS|LE|NP|UP|E|I|M|O|Z|C|X)\b/i,
        lookbehind: true
      },
      number: /\b\d+\b/,
      operator: {
        pattern: /(\s)(?:\*\*?|<[=>]?|>=?|\?=|[-+\/=])(?=\s)/,
        lookbehind: true
      },
      "string-operator": {
        pattern: /(\s)&&?(?=\s)/,
        lookbehind: true,
        alias: "keyword"
      },
      "token-operator": [
        {
          pattern: /(\w)(?:->?|=>|[~|{}])(?=\w)/,
          lookbehind: true,
          alias: "punctuation"
        },
        {
          pattern: /[|{}]/,
          alias: "punctuation"
        }
      ],
      punctuation: /[,.:()]/
    };
  }
};
var ada_default = {
  language: "ada",
  init: (Prism2) => {
    Prism2.languages.ada = {
      comment: /--.*/,
      string: /"(?:""|[^"\r\f\n])*"/i,
      number: [
        {
          pattern: /\b\d(?:_?\d)*#[\dA-F](?:_?[\dA-F])*(?:\.[\dA-F](?:_?[\dA-F])*)?#(?:E[+-]?\d(?:_?\d)*)?/i
        },
        {
          pattern: /\b\d(?:_?\d)*(?:\.\d(?:_?\d)*)?(?:E[+-]?\d(?:_?\d)*)?\b/i
        }
      ],
      "attr-name": /\b'\w+/i,
      keyword: /\b(?:abort|abs|abstract|accept|access|aliased|all|and|array|at|begin|body|case|constant|declare|delay|delta|digits|do|else|new|return|elsif|end|entry|exception|exit|for|function|generic|goto|if|in|interface|is|limited|loop|mod|not|null|of|others|out|overriding|package|pragma|private|procedure|protected|raise|range|record|rem|renames|requeue|reverse|select|separate|some|subtype|synchronized|tagged|task|terminate|then|type|until|use|when|while|with|xor)\b/i,
      boolean: /\b(?:true|false)\b/i,
      operator: /<[=>]?|>=?|=>?|:=|\/=?|\*\*?|[&+-]/,
      punctuation: /\.\.?|[,;():]/,
      char: /'.'/,
      variable: /\b[a-z](?:[_a-z\d])*\b/i
    };
  }
};
var apacheconf_default = {
  language: "apacheconf",
  init: (Prism2) => {
    Prism2.languages.apacheconf = {
      comment: /#.*/,
      "directive-inline": {
        pattern: /^(\s*)\b(?:AcceptFilter|AcceptPathInfo|AccessFileName|Action|AddAlt|AddAltByEncoding|AddAltByType|AddCharset|AddDefaultCharset|AddDescription|AddEncoding|AddHandler|AddIcon|AddIconByEncoding|AddIconByType|AddInputFilter|AddLanguage|AddModuleInfo|AddOutputFilter|AddOutputFilterByType|AddType|Alias|AliasMatch|Allow|AllowCONNECT|AllowEncodedSlashes|AllowMethods|AllowOverride|AllowOverrideList|Anonymous|Anonymous_LogEmail|Anonymous_MustGiveEmail|Anonymous_NoUserID|Anonymous_VerifyEmail|AsyncRequestWorkerFactor|AuthBasicAuthoritative|AuthBasicFake|AuthBasicProvider|AuthBasicUseDigestAlgorithm|AuthDBDUserPWQuery|AuthDBDUserRealmQuery|AuthDBMGroupFile|AuthDBMType|AuthDBMUserFile|AuthDigestAlgorithm|AuthDigestDomain|AuthDigestNonceLifetime|AuthDigestProvider|AuthDigestQop|AuthDigestShmemSize|AuthFormAuthoritative|AuthFormBody|AuthFormDisableNoStore|AuthFormFakeBasicAuth|AuthFormLocation|AuthFormLoginRequiredLocation|AuthFormLoginSuccessLocation|AuthFormLogoutLocation|AuthFormMethod|AuthFormMimetype|AuthFormPassword|AuthFormProvider|AuthFormSitePassphrase|AuthFormSize|AuthFormUsername|AuthGroupFile|AuthLDAPAuthorizePrefix|AuthLDAPBindAuthoritative|AuthLDAPBindDN|AuthLDAPBindPassword|AuthLDAPCharsetConfig|AuthLDAPCompareAsUser|AuthLDAPCompareDNOnServer|AuthLDAPDereferenceAliases|AuthLDAPGroupAttribute|AuthLDAPGroupAttributeIsDN|AuthLDAPInitialBindAsUser|AuthLDAPInitialBindPattern|AuthLDAPMaxSubGroupDepth|AuthLDAPRemoteUserAttribute|AuthLDAPRemoteUserIsDN|AuthLDAPSearchAsUser|AuthLDAPSubGroupAttribute|AuthLDAPSubGroupClass|AuthLDAPUrl|AuthMerging|AuthName|AuthnCacheContext|AuthnCacheEnable|AuthnCacheProvideFor|AuthnCacheSOCache|AuthnCacheTimeout|AuthnzFcgiCheckAuthnProvider|AuthnzFcgiDefineProvider|AuthType|AuthUserFile|AuthzDBDLoginToReferer|AuthzDBDQuery|AuthzDBDRedirectQuery|AuthzDBMType|AuthzSendForbiddenOnFailure|BalancerGrowth|BalancerInherit|BalancerMember|BalancerPersist|BrowserMatch|BrowserMatchNoCase|BufferedLogs|BufferSize|CacheDefaultExpire|CacheDetailHeader|CacheDirLength|CacheDirLevels|CacheDisable|CacheEnable|CacheFile|CacheHeader|CacheIgnoreCacheControl|CacheIgnoreHeaders|CacheIgnoreNoLastMod|CacheIgnoreQueryString|CacheIgnoreURLSessionIdentifiers|CacheKeyBaseURL|CacheLastModifiedFactor|CacheLock|CacheLockMaxAge|CacheLockPath|CacheMaxExpire|CacheMaxFileSize|CacheMinExpire|CacheMinFileSize|CacheNegotiatedDocs|CacheQuickHandler|CacheReadSize|CacheReadTime|CacheRoot|CacheSocache|CacheSocacheMaxSize|CacheSocacheMaxTime|CacheSocacheMinTime|CacheSocacheReadSize|CacheSocacheReadTime|CacheStaleOnError|CacheStoreExpired|CacheStoreNoStore|CacheStorePrivate|CGIDScriptTimeout|CGIMapExtension|CharsetDefault|CharsetOptions|CharsetSourceEnc|CheckCaseOnly|CheckSpelling|ChrootDir|ContentDigest|CookieDomain|CookieExpires|CookieName|CookieStyle|CookieTracking|CoreDumpDirectory|CustomLog|Dav|DavDepthInfinity|DavGenericLockDB|DavLockDB|DavMinTimeout|DBDExptime|DBDInitSQL|DBDKeep|DBDMax|DBDMin|DBDParams|DBDPersist|DBDPrepareSQL|DBDriver|DefaultIcon|DefaultLanguage|DefaultRuntimeDir|DefaultType|Define|DeflateBufferSize|DeflateCompressionLevel|DeflateFilterNote|DeflateInflateLimitRequestBody|DeflateInflateRatioBurst|DeflateInflateRatioLimit|DeflateMemLevel|DeflateWindowSize|Deny|DirectoryCheckHandler|DirectoryIndex|DirectoryIndexRedirect|DirectorySlash|DocumentRoot|DTracePrivileges|DumpIOInput|DumpIOOutput|EnableExceptionHook|EnableMMAP|EnableSendfile|Error|ErrorDocument|ErrorLog|ErrorLogFormat|Example|ExpiresActive|ExpiresByType|ExpiresDefault|ExtendedStatus|ExtFilterDefine|ExtFilterOptions|FallbackResource|FileETag|FilterChain|FilterDeclare|FilterProtocol|FilterProvider|FilterTrace|ForceLanguagePriority|ForceType|ForensicLog|GprofDir|GracefulShutdownTimeout|Group|Header|HeaderName|HeartbeatAddress|HeartbeatListen|HeartbeatMaxServers|HeartbeatStorage|HeartbeatStorage|HostnameLookups|IdentityCheck|IdentityCheckTimeout|ImapBase|ImapDefault|ImapMenu|Include|IncludeOptional|IndexHeadInsert|IndexIgnore|IndexIgnoreReset|IndexOptions|IndexOrderDefault|IndexStyleSheet|InputSed|ISAPIAppendLogToErrors|ISAPIAppendLogToQuery|ISAPICacheFile|ISAPIFakeAsync|ISAPILogNotSupported|ISAPIReadAheadBuffer|KeepAlive|KeepAliveTimeout|KeptBodySize|LanguagePriority|LDAPCacheEntries|LDAPCacheTTL|LDAPConnectionPoolTTL|LDAPConnectionTimeout|LDAPLibraryDebug|LDAPOpCacheEntries|LDAPOpCacheTTL|LDAPReferralHopLimit|LDAPReferrals|LDAPRetries|LDAPRetryDelay|LDAPSharedCacheFile|LDAPSharedCacheSize|LDAPTimeout|LDAPTrustedClientCert|LDAPTrustedGlobalCert|LDAPTrustedMode|LDAPVerifyServerCert|LimitInternalRecursion|LimitRequestBody|LimitRequestFields|LimitRequestFieldSize|LimitRequestLine|LimitXMLRequestBody|Listen|ListenBackLog|LoadFile|LoadModule|LogFormat|LogLevel|LogMessage|LuaAuthzProvider|LuaCodeCache|LuaHookAccessChecker|LuaHookAuthChecker|LuaHookCheckUserID|LuaHookFixups|LuaHookInsertFilter|LuaHookLog|LuaHookMapToStorage|LuaHookTranslateName|LuaHookTypeChecker|LuaInherit|LuaInputFilter|LuaMapHandler|LuaOutputFilter|LuaPackageCPath|LuaPackagePath|LuaQuickHandler|LuaRoot|LuaScope|MaxConnectionsPerChild|MaxKeepAliveRequests|MaxMemFree|MaxRangeOverlaps|MaxRangeReversals|MaxRanges|MaxRequestWorkers|MaxSpareServers|MaxSpareThreads|MaxThreads|MergeTrailers|MetaDir|MetaFiles|MetaSuffix|MimeMagicFile|MinSpareServers|MinSpareThreads|MMapFile|ModemStandard|ModMimeUsePathInfo|MultiviewsMatch|Mutex|NameVirtualHost|NoProxy|NWSSLTrustedCerts|NWSSLUpgradeable|Options|Order|OutputSed|PassEnv|PidFile|PrivilegesMode|Protocol|ProtocolEcho|ProxyAddHeaders|ProxyBadHeader|ProxyBlock|ProxyDomain|ProxyErrorOverride|ProxyExpressDBMFile|ProxyExpressDBMType|ProxyExpressEnable|ProxyFtpDirCharset|ProxyFtpEscapeWildcards|ProxyFtpListOnWildcard|ProxyHTMLBufSize|ProxyHTMLCharsetOut|ProxyHTMLDocType|ProxyHTMLEnable|ProxyHTMLEvents|ProxyHTMLExtended|ProxyHTMLFixups|ProxyHTMLInterp|ProxyHTMLLinks|ProxyHTMLMeta|ProxyHTMLStripComments|ProxyHTMLURLMap|ProxyIOBufferSize|ProxyMaxForwards|ProxyPass|ProxyPassInherit|ProxyPassInterpolateEnv|ProxyPassMatch|ProxyPassReverse|ProxyPassReverseCookieDomain|ProxyPassReverseCookiePath|ProxyPreserveHost|ProxyReceiveBufferSize|ProxyRemote|ProxyRemoteMatch|ProxyRequests|ProxySCGIInternalRedirect|ProxySCGISendfile|ProxySet|ProxySourceAddress|ProxyStatus|ProxyTimeout|ProxyVia|ReadmeName|ReceiveBufferSize|Redirect|RedirectMatch|RedirectPermanent|RedirectTemp|ReflectorHeader|RemoteIPHeader|RemoteIPInternalProxy|RemoteIPInternalProxyList|RemoteIPProxiesHeader|RemoteIPTrustedProxy|RemoteIPTrustedProxyList|RemoveCharset|RemoveEncoding|RemoveHandler|RemoveInputFilter|RemoveLanguage|RemoveOutputFilter|RemoveType|RequestHeader|RequestReadTimeout|Require|RewriteBase|RewriteCond|RewriteEngine|RewriteMap|RewriteOptions|RewriteRule|RLimitCPU|RLimitMEM|RLimitNPROC|Satisfy|ScoreBoardFile|Script|ScriptAlias|ScriptAliasMatch|ScriptInterpreterSource|ScriptLog|ScriptLogBuffer|ScriptLogLength|ScriptSock|SecureListen|SeeRequestTail|SendBufferSize|ServerAdmin|ServerAlias|ServerLimit|ServerName|ServerPath|ServerRoot|ServerSignature|ServerTokens|Session|SessionCookieName|SessionCookieName2|SessionCookieRemove|SessionCryptoCipher|SessionCryptoDriver|SessionCryptoPassphrase|SessionCryptoPassphraseFile|SessionDBDCookieName|SessionDBDCookieName2|SessionDBDCookieRemove|SessionDBDDeleteLabel|SessionDBDInsertLabel|SessionDBDPerUser|SessionDBDSelectLabel|SessionDBDUpdateLabel|SessionEnv|SessionExclude|SessionHeader|SessionInclude|SessionMaxAge|SetEnv|SetEnvIf|SetEnvIfExpr|SetEnvIfNoCase|SetHandler|SetInputFilter|SetOutputFilter|SSIEndTag|SSIErrorMsg|SSIETag|SSILastModified|SSILegacyExprParser|SSIStartTag|SSITimeFormat|SSIUndefinedEcho|SSLCACertificateFile|SSLCACertificatePath|SSLCADNRequestFile|SSLCADNRequestPath|SSLCARevocationCheck|SSLCARevocationFile|SSLCARevocationPath|SSLCertificateChainFile|SSLCertificateFile|SSLCertificateKeyFile|SSLCipherSuite|SSLCompression|SSLCryptoDevice|SSLEngine|SSLFIPS|SSLHonorCipherOrder|SSLInsecureRenegotiation|SSLOCSPDefaultResponder|SSLOCSPEnable|SSLOCSPOverrideResponder|SSLOCSPResponderTimeout|SSLOCSPResponseMaxAge|SSLOCSPResponseTimeSkew|SSLOCSPUseRequestNonce|SSLOpenSSLConfCmd|SSLOptions|SSLPassPhraseDialog|SSLProtocol|SSLProxyCACertificateFile|SSLProxyCACertificatePath|SSLProxyCARevocationCheck|SSLProxyCARevocationFile|SSLProxyCARevocationPath|SSLProxyCheckPeerCN|SSLProxyCheckPeerExpire|SSLProxyCheckPeerName|SSLProxyCipherSuite|SSLProxyEngine|SSLProxyMachineCertificateChainFile|SSLProxyMachineCertificateFile|SSLProxyMachineCertificatePath|SSLProxyProtocol|SSLProxyVerify|SSLProxyVerifyDepth|SSLRandomSeed|SSLRenegBufferSize|SSLRequire|SSLRequireSSL|SSLSessionCache|SSLSessionCacheTimeout|SSLSessionTicketKeyFile|SSLSRPUnknownUserSeed|SSLSRPVerifierFile|SSLStaplingCache|SSLStaplingErrorCacheTimeout|SSLStaplingFakeTryLater|SSLStaplingForceURL|SSLStaplingResponderTimeout|SSLStaplingResponseMaxAge|SSLStaplingResponseTimeSkew|SSLStaplingReturnResponderErrors|SSLStaplingStandardCacheTimeout|SSLStrictSNIVHostCheck|SSLUserName|SSLUseStapling|SSLVerifyClient|SSLVerifyDepth|StartServers|StartThreads|Substitute|Suexec|SuexecUserGroup|ThreadLimit|ThreadsPerChild|ThreadStackSize|TimeOut|TraceEnable|TransferLog|TypesConfig|UnDefine|UndefMacro|UnsetEnv|Use|UseCanonicalName|UseCanonicalPhysicalPort|User|UserDir|VHostCGIMode|VHostCGIPrivs|VHostGroup|VHostPrivs|VHostSecure|VHostUser|VirtualDocumentRoot|VirtualDocumentRootIP|VirtualScriptAlias|VirtualScriptAliasIP|WatchdogInterval|XBitHack|xml2EncAlias|xml2EncDefault|xml2StartParse)\b/im,
        lookbehind: true,
        alias: "property"
      },
      "directive-block": {
        pattern: /<\/?\b(?:AuthnProviderAlias|AuthzProviderAlias|Directory|DirectoryMatch|Else|ElseIf|Files|FilesMatch|If|IfDefine|IfModule|IfVersion|Limit|LimitExcept|Location|LocationMatch|Macro|Proxy|RequireAll|RequireAny|RequireNone|VirtualHost)\b *.*>/i,
        inside: {
          "directive-block": {
            pattern: /^<\/?\w+/,
            inside: {
              punctuation: /^<\/?/
            },
            alias: "tag"
          },
          "directive-block-parameter": {
            pattern: /.*[^>]/,
            inside: {
              punctuation: /:/,
              string: {
                pattern: /("|').*\1/,
                inside: {
                  variable: /[$%]\{?(?:\w\.?[-+:]?)+\}?/
                }
              }
            },
            alias: "attr-value"
          },
          punctuation: />/
        },
        alias: "tag"
      },
      "directive-flags": {
        pattern: /\[(?:\w,?)+\]/,
        alias: "keyword"
      },
      string: {
        pattern: /("|').*\1/,
        inside: {
          variable: /[$%]\{?(?:\w\.?[-+:]?)+\}?/
        }
      },
      variable: /[$%]\{?(?:\w\.?[-+:]?)+\}?/,
      regex: /\^?.*\$|\^.*\$?/
    };
  }
};
var apl_default = {
  language: "apl",
  init: (Prism2) => {
    Prism2.languages.apl = {
      comment: /(?:\u235D|#[! ]).*$/m,
      string: {
        pattern: /'(?:[^'\r\n]|'')*'/,
        greedy: true
      },
      number: /\u00AF?(?:\d*\.?\d+(?:e[+\u00AF]?\d+)?|\u00AF|\u221E)(?:j\u00AF?(?:\d*\.?\d+(?:e[+\u00AF]?\d+)?|\u00AF|\u221E))?/i,
      statement: /:[A-Z][a-z][A-Za-z]*\b/,
      "system-function": {
        pattern: /\u2395[A-Z]+/i,
        alias: "function"
      },
      constant: /[\u236C\u233E#\u2395\u235E]/,
      function: /[-+\u00D7\u00F7\u2308\u230A\u2223|\u2373\u2378?*\u235F\u25CB!\u2339<\u2264=>\u2265\u2260\u2261\u2262\u220A\u2377\u222A\u2229~\u2228\u2227\u2371\u2372\u2374,\u236A\u233D\u2296\u2349\u2191\u2193\u2282\u2283\u2286\u2287\u2337\u234B\u2352\u22A4\u22A5\u2355\u234E\u22A3\u22A2\u2341\u2342\u2248\u236F\u2197\u00A4\u2192]/,
      "monadic-operator": {
        pattern: /[\\\/\u233F\u2340\u00A8\u2368\u2336&\u2225]/,
        alias: "operator"
      },
      "dyadic-operator": {
        pattern: /[.\u2363\u2360\u2364\u2218\u2338@\u233A]/,
        alias: "operator"
      },
      assignment: {
        pattern: /\u2190/,
        alias: "keyword"
      },
      punctuation: /[\[;\]()\u25C7\u22C4]/,
      dfn: {
        pattern: /[{}\u237A\u2375\u2376\u2379\u2207\u236B:]/,
        alias: "builtin"
      }
    };
  }
};
var applescript_default = {
  language: "applescript",
  init: (Prism2) => {
    Prism2.languages.applescript = {
      comment: [
        /\(\*(?:\(\*[\s\S]*?\*\)|[\s\S])*?\*\)/,
        /--.+/,
        /#.+/
      ],
      string: /"(?:\\.|[^"\\\r\n])*"/,
      number: /(?:\b\d+\.?\d*|\B\.\d+)(?:e-?\d+)?\b/i,
      operator: [
        /[&=\u2260\u2264\u2265*+\-\/\u00F7^]|[<>]=?/,
        /\b(?:(?:start|begin|end)s? with|(?:(?:does not|doesn't) contain|contains?)|(?:is|isn't|is not) (?:in|contained by)|(?:(?:is|isn't|is not) )?(?:greater|less) than(?: or equal)?(?: to)?|(?:(?:does not|doesn't) come|comes) (?:before|after)|(?:is|isn't|is not) equal(?: to)?|(?:(?:does not|doesn't) equal|equals|equal to|isn't|is not)|(?:a )?(?:ref(?: to)?|reference to)|(?:and|or|div|mod|as|not))\b/
      ],
      keyword: /\b(?:about|above|after|against|apart from|around|aside from|at|back|before|beginning|behind|below|beneath|beside|between|but|by|considering|continue|copy|does|eighth|else|end|equal|error|every|exit|false|fifth|first|for|fourth|from|front|get|given|global|if|ignoring|in|instead of|into|is|it|its|last|local|me|middle|my|ninth|of|on|onto|out of|over|prop|property|put|repeat|return|returning|second|set|seventh|since|sixth|some|tell|tenth|that|the|then|third|through|thru|timeout|times|to|transaction|true|try|until|where|while|whose|with|without)\b/,
      class: {
        pattern: /\b(?:alias|application|boolean|class|constant|date|file|integer|list|number|POSIX file|real|record|reference|RGB color|script|text|centimetres|centimeters|feet|inches|kilometres|kilometers|metres|meters|miles|yards|square feet|square kilometres|square kilometers|square metres|square meters|square miles|square yards|cubic centimetres|cubic centimeters|cubic feet|cubic inches|cubic metres|cubic meters|cubic yards|gallons|litres|liters|quarts|grams|kilograms|ounces|pounds|degrees Celsius|degrees Fahrenheit|degrees Kelvin)\b/,
        alias: "builtin"
      },
      punctuation: /[{}():,\u00AC\u00AB\u00BB\u300A\u300B]/
    };
  }
};
var arff_default = {
  language: "arff",
  init: (Prism2) => {
    Prism2.languages.arff = {
      comment: /%.*/,
      string: {
        pattern: /(["'])(?:\\.|(?!\1)[^\\\r\n])*\1/,
        greedy: true
      },
      keyword: /@(?:attribute|data|end|relation)\b/i,
      number: /\b\d+(?:\.\d+)?\b/,
      punctuation: /[{},]/
    };
  }
};
var asciidoc_default = {
  language: "asciidoc",
  init: (Prism2) => {
    (function(Prism3) {
      const attributes = {
        pattern: /(^[ \t]*)\[(?!\[)(?:(["'$`])(?:(?!\2)[^\\]|\\.)*\2|\[(?:[^\]\\]|\\.)*\]|[^\]\\]|\\.)*\]/m,
        lookbehind: true,
        inside: {
          quoted: {
            pattern: /([$`])(?:(?!\1)[^\\]|\\.)*\1/,
            inside: {
              punctuation: /^[$`]|[$`]$/
            }
          },
          interpreted: {
            pattern: /'(?:[^'\\]|\\.)*'/,
            inside: {
              punctuation: /^'|'$/
            }
          },
          string: /"(?:[^"\\]|\\.)*"/,
          variable: /\w+(?==)/,
          punctuation: /^\[|\]$|,/,
          operator: /=/,
          "attr-value": /(?!^\s+$).+/
        }
      };
      Prism3.languages.asciidoc = {
        "comment-block": {
          pattern: /^(\/{4,})(?:\r?\n|\r)(?:[\s\S]*(?:\r?\n|\r))??\1/m,
          alias: "comment"
        },
        table: {
          pattern: /^\|={3,}(?:(?:\r?\n|\r).*)*?(?:\r?\n|\r)\|={3,}$/m,
          inside: {
            specifiers: {
              pattern: /(?!\|)(?:(?:(?:\d+(?:\.\d+)?|\.\d+)[+*])?(?:[<^>](?:\.[<^>])?|\.[<^>])?[a-z]*)(?=\|)/,
              alias: "attr-value"
            },
            punctuation: {
              pattern: /(^|[^\\])[|!]=*/,
              lookbehind: true
            }
          }
        },
        "passthrough-block": {
          pattern: /^(\+{4,})(?:\r?\n|\r)(?:[\s\S]*(?:\r?\n|\r))??\1$/m,
          inside: {
            punctuation: /^\++|\++$/
          }
        },
        "literal-block": {
          pattern: /^(-{4,}|\.{4,})(?:\r?\n|\r)(?:[\s\S]*(?:\r?\n|\r))??\1$/m,
          inside: {
            punctuation: /^(?:-+|\.+)|(?:-+|\.+)$/
          }
        },
        "other-block": {
          pattern: /^(--|\*{4,}|_{4,}|={4,})(?:\r?\n|\r)(?:[\s\S]*(?:\r?\n|\r))??\1$/m,
          inside: {
            punctuation: /^(?:-+|\*+|_+|=+)|(?:-+|\*+|_+|=+)$/
          }
        },
        "list-punctuation": {
          pattern: /(^[ \t]*)(?:-|\*{1,5}|\.{1,5}|(?:[a-z]|\d+)\.|[xvi]+\))(?= )/im,
          lookbehind: true,
          alias: "punctuation"
        },
        "list-label": {
          pattern: /(^[ \t]*)[a-z\d].+(?::{2,4}|;;)(?=\s)/im,
          lookbehind: true,
          alias: "symbol"
        },
        "indented-block": {
          pattern: /((\r?\n|\r)\2)([ \t]+)\S.*(?:(?:\r?\n|\r)\3.+)*(?=\2{2}|$)/,
          lookbehind: true
        },
        comment: /^\/\/.*/m,
        title: {
          pattern: /^.+(?:\r?\n|\r)(?:={3,}|-{3,}|~{3,}|\^{3,}|\+{3,})$|^={1,5} +.+|^\.(?![\s.]).*/m,
          alias: "important",
          inside: {
            punctuation: /^(?:\.|=+)|(?:=+|-+|~+|\^+|\++)$/
          }
        },
        "attribute-entry": {
          pattern: /^:[^:\r\n]+:(?: .*?(?: \+(?:\r?\n|\r).*?)*)?$/m,
          alias: "tag"
        },
        attributes,
        hr: {
          pattern: /^'{3,}$/m,
          alias: "punctuation"
        },
        "page-break": {
          pattern: /^<{3,}$/m,
          alias: "punctuation"
        },
        admonition: {
          pattern: /^(?:TIP|NOTE|IMPORTANT|WARNING|CAUTION):/m,
          alias: "keyword"
        },
        callout: [
          {
            pattern: /(^[ \t]*)<?\d*>/m,
            lookbehind: true,
            alias: "symbol"
          },
          {
            pattern: /<\d+>/,
            alias: "symbol"
          }
        ],
        macro: {
          pattern: /\b[a-z\d][a-z\d-]*::?(?:(?:\S+)??\[(?:[^\]\\"]|(["'])(?:(?!\1)[^\\]|\\.)*\1|\\.)*\])/,
          inside: {
            function: /^[a-z\d-]+(?=:)/,
            punctuation: /^::?/,
            attributes: {
              pattern: /(?:\[(?:[^\]\\"]|(["'])(?:(?!\1)[^\\]|\\.)*\1|\\.)*\])/,
              inside: attributes.inside
            }
          }
        },
        inline: {
          pattern: /(^|[^\\])(?:(?:\B\[(?:[^\]\\"]|(["'])(?:(?!\2)[^\\]|\\.)*\2|\\.)*\])?(?:\b_(?!\s)(?: _|[^_\\\r\n]|\\.)+(?:(?:\r?\n|\r)(?: _|[^_\\\r\n]|\\.)+)*_\b|\B``(?!\s).+?(?:(?:\r?\n|\r).+?)*''\B|\B`(?!\s)(?: ['`]|.)+?(?:(?:\r?\n|\r)(?: ['`]|.)+?)*['`]\B|\B(['*+#])(?!\s)(?: \3|(?!\3)[^\\\r\n]|\\.)+(?:(?:\r?\n|\r)(?: \3|(?!\3)[^\\\r\n]|\\.)+)*\3\B)|(?:\[(?:[^\]\\"]|(["'])(?:(?!\4)[^\\]|\\.)*\4|\\.)*\])?(?:(__|\*\*|\+\+\+?|##|\$\$|[~^]).+?(?:(?:\r?\n|\r).+?)*\5|\{[^}\r\n]+\}|\[\[\[?.+?(?:(?:\r?\n|\r).+?)*\]?\]\]|<<.+?(?:(?:\r?\n|\r).+?)*>>|\(\(\(?.+?(?:(?:\r?\n|\r).+?)*\)?\)\)))/m,
          lookbehind: true,
          inside: {
            attributes,
            url: {
              pattern: /^(?:\[\[\[?.+?\]?\]\]|<<.+?>>)$/,
              inside: {
                punctuation: /^(?:\[\[\[?|<<)|(?:\]\]\]?|>>)$/
              }
            },
            "attribute-ref": {
              pattern: /^\{.+\}$/,
              inside: {
                variable: {
                  pattern: /(^\{)[a-z\d,+_-]+/,
                  lookbehind: true
                },
                operator: /^[=?!#%@$]|!(?=[:}])/,
                punctuation: /^\{|\}$|::?/
              }
            },
            italic: {
              pattern: /^(['_])[\s\S]+\1$/,
              inside: {
                punctuation: /^(?:''?|__?)|(?:''?|__?)$/
              }
            },
            bold: {
              pattern: /^\*[\s\S]+\*$/,
              inside: {
                punctuation: /^\*\*?|\*\*?$/
              }
            },
            punctuation: /^(?:``?|\+{1,3}|##?|\$\$|[~^]|\(\(\(?)|(?:''?|\+{1,3}|##?|\$\$|[~^`]|\)?\)\))$/
          }
        },
        replacement: {
          pattern: /\((?:C|TM|R)\)/,
          alias: "builtin"
        },
        entity: /&#?[\da-z]{1,8};/i,
        "line-continuation": {
          pattern: /(^| )\+$/m,
          lookbehind: true,
          alias: "punctuation"
        }
      };
      attributes.inside.interpreted.inside.rest = {
        macro: Prism3.languages.asciidoc.macro,
        inline: Prism3.languages.asciidoc.inline,
        replacement: Prism3.languages.asciidoc.replacement,
        entity: Prism3.languages.asciidoc.entity
      };
      Prism3.languages.asciidoc["passthrough-block"].inside.rest = {
        macro: Prism3.languages.asciidoc.macro
      };
      Prism3.languages.asciidoc["literal-block"].inside.rest = {
        callout: Prism3.languages.asciidoc.callout
      };
      Prism3.languages.asciidoc.table.inside.rest = {
        "comment-block": Prism3.languages.asciidoc["comment-block"],
        "passthrough-block": Prism3.languages.asciidoc["passthrough-block"],
        "literal-block": Prism3.languages.asciidoc["literal-block"],
        "other-block": Prism3.languages.asciidoc["other-block"],
        "list-punctuation": Prism3.languages.asciidoc["list-punctuation"],
        "indented-block": Prism3.languages.asciidoc["indented-block"],
        comment: Prism3.languages.asciidoc.comment,
        title: Prism3.languages.asciidoc.title,
        "attribute-entry": Prism3.languages.asciidoc["attribute-entry"],
        attributes: Prism3.languages.asciidoc.attributes,
        hr: Prism3.languages.asciidoc.hr,
        "page-break": Prism3.languages.asciidoc["page-break"],
        admonition: Prism3.languages.asciidoc.admonition,
        "list-label": Prism3.languages.asciidoc["list-label"],
        callout: Prism3.languages.asciidoc.callout,
        macro: Prism3.languages.asciidoc.macro,
        inline: Prism3.languages.asciidoc.inline,
        replacement: Prism3.languages.asciidoc.replacement,
        entity: Prism3.languages.asciidoc.entity,
        "line-continuation": Prism3.languages.asciidoc["line-continuation"]
      };
      Prism3.languages.asciidoc["other-block"].inside.rest = {
        table: Prism3.languages.asciidoc.table,
        "list-punctuation": Prism3.languages.asciidoc["list-punctuation"],
        "indented-block": Prism3.languages.asciidoc["indented-block"],
        comment: Prism3.languages.asciidoc.comment,
        "attribute-entry": Prism3.languages.asciidoc["attribute-entry"],
        attributes: Prism3.languages.asciidoc.attributes,
        hr: Prism3.languages.asciidoc.hr,
        "page-break": Prism3.languages.asciidoc["page-break"],
        admonition: Prism3.languages.asciidoc.admonition,
        "list-label": Prism3.languages.asciidoc["list-label"],
        macro: Prism3.languages.asciidoc.macro,
        inline: Prism3.languages.asciidoc.inline,
        replacement: Prism3.languages.asciidoc.replacement,
        entity: Prism3.languages.asciidoc.entity,
        "line-continuation": Prism3.languages.asciidoc["line-continuation"]
      };
      Prism3.languages.asciidoc.title.inside.rest = {
        macro: Prism3.languages.asciidoc.macro,
        inline: Prism3.languages.asciidoc.inline,
        replacement: Prism3.languages.asciidoc.replacement,
        entity: Prism3.languages.asciidoc.entity
      };
      Prism3.hooks.add("wrap", (env) => {
        if (env.type === "entity") {
          env.attributes.title = env.content.replace(/&amp;/, "&");
        }
      });
    })(Prism2);
  }
};
var asm6502_default = {
  language: "asm6502",
  init: (Prism2) => {
    Prism2.languages.asm6502 = {
      comment: /;.*/,
      directive: {
        pattern: /\.\w+(?= )/,
        alias: "keyword"
      },
      string: /(["'`])(?:\\.|(?!\1)[^\\\r\n])*\1/,
      opcode: {
        pattern: /\b(?:adc|and|asl|bcc|bcs|beq|bit|bmi|bne|bpl|brk|bvc|bvs|clc|cld|cli|clv|cmp|cpx|cpy|dec|dex|dey|eor|inc|inx|iny|jmp|jsr|lda|ldx|ldy|lsr|nop|ora|pha|php|pla|plp|rol|ror|rti|rts|sbc|sec|sed|sei|sta|stx|sty|tax|tay|tsx|txa|txs|tya|ADC|AND|ASL|BCC|BCS|BEQ|BIT|BMI|BNE|BPL|BRK|BVC|BVS|CLC|CLD|CLI|CLV|CMP|CPX|CPY|DEC|DEX|DEY|EOR|INC|INX|INY|JMP|JSR|LDA|LDX|LDY|LSR|NOP|ORA|PHA|PHP|PLA|PLP|ROL|ROR|RTI|RTS|SBC|SEC|SED|SEI|STA|STX|STY|TAX|TAY|TSX|TXA|TXS|TYA)\b/,
        alias: "property"
      },
      hexnumber: {
        pattern: /#?\$[\da-f]{2,4}/i,
        alias: "string"
      },
      binarynumber: {
        pattern: /#?%[01]+/,
        alias: "string"
      },
      decimalnumber: {
        pattern: /#?\d+/,
        alias: "string"
      },
      register: {
        pattern: /\b[xya]\b/i,
        alias: "variable"
      }
    };
  }
};
var autohotkey_default = {
  language: "autohotkey",
  init: (Prism2) => {
    Prism2.languages.autohotkey = {
      comment: {
        pattern: /(^[^";\n]*("[^"\n]*?"[^"\n]*?)*)(?:;.*$|^\s*\/\*[\s\S]*\n\*\/)/m,
        lookbehind: true
      },
      string: /"(?:[^"\n\r]|"")*"/m,
      function: /[^(); \t,\n+*\-=?>:\\\/<&%\[\]]+?(?=\()/m,
      tag: /^[ \t]*[^\s:]+?(?=:(?:[^:]|$))/m,
      variable: /%\w+%/,
      number: /\b0x[\dA-Fa-f]+\b|(?:\b\d+\.?\d*|\B\.\d+)(?:[Ee]-?\d+)?/,
      operator: /\?|\/\/?=?|:=|\|[=|]?|&[=&]?|\+[=+]?|-[=-]?|\*[=*]?|<(?:<=?|>|=)?|>>?=?|[.^!=~]=?|\b(?:AND|NOT|OR)\b/,
      punctuation: /[{}[\]():,]/,
      boolean: /\b(?:true|false)\b/,
      selector: /\b(?:AutoTrim|BlockInput|Break|Click|ClipWait|Continue|Control|ControlClick|ControlFocus|ControlGet|ControlGetFocus|ControlGetPos|ControlGetText|ControlMove|ControlSend|ControlSendRaw|ControlSetText|CoordMode|Critical|DetectHiddenText|DetectHiddenWindows|Drive|DriveGet|DriveSpaceFree|EnvAdd|EnvDiv|EnvGet|EnvMult|EnvSet|EnvSub|EnvUpdate|Exit|ExitApp|FileAppend|FileCopy|FileCopyDir|FileCreateDir|FileCreateShortcut|FileDelete|FileEncoding|FileGetAttrib|FileGetShortcut|FileGetSize|FileGetTime|FileGetVersion|FileInstall|FileMove|FileMoveDir|FileRead|FileReadLine|FileRecycle|FileRecycleEmpty|FileRemoveDir|FileSelectFile|FileSelectFolder|FileSetAttrib|FileSetTime|FormatTime|GetKeyState|Gosub|Goto|GroupActivate|GroupAdd|GroupClose|GroupDeactivate|Gui|GuiControl|GuiControlGet|Hotkey|ImageSearch|IniDelete|IniRead|IniWrite|Input|InputBox|KeyWait|ListHotkeys|ListLines|ListVars|Loop|Menu|MouseClick|MouseClickDrag|MouseGetPos|MouseMove|MsgBox|OnExit|OutputDebug|Pause|PixelGetColor|PixelSearch|PostMessage|Process|Progress|Random|RegDelete|RegRead|RegWrite|Reload|Repeat|Return|Run|RunAs|RunWait|Send|SendEvent|SendInput|SendMessage|SendMode|SendPlay|SendRaw|SetBatchLines|SetCapslockState|SetControlDelay|SetDefaultMouseSpeed|SetEnv|SetFormat|SetKeyDelay|SetMouseDelay|SetNumlockState|SetScrollLockState|SetStoreCapslockMode|SetTimer|SetTitleMatchMode|SetWinDelay|SetWorkingDir|Shutdown|Sleep|Sort|SoundBeep|SoundGet|SoundGetWaveVolume|SoundPlay|SoundSet|SoundSetWaveVolume|SplashImage|SplashTextOff|SplashTextOn|SplitPath|StatusBarGetText|StatusBarWait|StringCaseSense|StringGetPos|StringLeft|StringLen|StringLower|StringMid|StringReplace|StringRight|StringSplit|StringTrimLeft|StringTrimRight|StringUpper|Suspend|SysGet|Thread|ToolTip|Transform|TrayTip|URLDownloadToFile|WinActivate|WinActivateBottom|WinClose|WinGet|WinGetActiveStats|WinGetActiveTitle|WinGetClass|WinGetPos|WinGetText|WinGetTitle|WinHide|WinKill|WinMaximize|WinMenuSelectItem|WinMinimize|WinMinimizeAll|WinMinimizeAllUndo|WinMove|WinRestore|WinSet|WinSetTitle|WinShow|WinWait|WinWaitActive|WinWaitClose|WinWaitNotActive)\b/i,
      constant: /\b(?:a_ahkpath|a_ahkversion|a_appdata|a_appdatacommon|a_autotrim|a_batchlines|a_caretx|a_carety|a_computername|a_controldelay|a_cursor|a_dd|a_ddd|a_dddd|a_defaultmousespeed|a_desktop|a_desktopcommon|a_detecthiddentext|a_detecthiddenwindows|a_endchar|a_eventinfo|a_exitreason|a_formatfloat|a_formatinteger|a_gui|a_guievent|a_guicontrol|a_guicontrolevent|a_guiheight|a_guiwidth|a_guix|a_guiy|a_hour|a_iconfile|a_iconhidden|a_iconnumber|a_icontip|a_index|a_ipaddress1|a_ipaddress2|a_ipaddress3|a_ipaddress4|a_isadmin|a_iscompiled|a_iscritical|a_ispaused|a_issuspended|a_isunicode|a_keydelay|a_language|a_lasterror|a_linefile|a_linenumber|a_loopfield|a_loopfileattrib|a_loopfiledir|a_loopfileext|a_loopfilefullpath|a_loopfilelongpath|a_loopfilename|a_loopfileshortname|a_loopfileshortpath|a_loopfilesize|a_loopfilesizekb|a_loopfilesizemb|a_loopfiletimeaccessed|a_loopfiletimecreated|a_loopfiletimemodified|a_loopreadline|a_loopregkey|a_loopregname|a_loopregsubkey|a_loopregtimemodified|a_loopregtype|a_mday|a_min|a_mm|a_mmm|a_mmmm|a_mon|a_mousedelay|a_msec|a_mydocuments|a_now|a_nowutc|a_numbatchlines|a_ostype|a_osversion|a_priorhotkey|programfiles|a_programfiles|a_programs|a_programscommon|a_screenheight|a_screenwidth|a_scriptdir|a_scriptfullpath|a_scriptname|a_sec|a_space|a_startmenu|a_startmenucommon|a_startup|a_startupcommon|a_stringcasesense|a_tab|a_temp|a_thisfunc|a_thishotkey|a_thislabel|a_thismenu|a_thismenuitem|a_thismenuitempos|a_tickcount|a_timeidle|a_timeidlephysical|a_timesincepriorhotkey|a_timesincethishotkey|a_titlematchmode|a_titlematchmodespeed|a_username|a_wday|a_windelay|a_windir|a_workingdir|a_yday|a_year|a_yweek|a_yyyy|clipboard|clipboardall|comspec|errorlevel)\b/i,
      builtin: /\b(?:abs|acos|asc|asin|atan|ceil|chr|class|cos|dllcall|exp|fileexist|Fileopen|floor|il_add|il_create|il_destroy|instr|substr|isfunc|islabel|IsObject|ln|log|lv_add|lv_delete|lv_deletecol|lv_getcount|lv_getnext|lv_gettext|lv_insert|lv_insertcol|lv_modify|lv_modifycol|lv_setimagelist|mod|onmessage|numget|numput|registercallback|regexmatch|regexreplace|round|sin|tan|sqrt|strlen|sb_seticon|sb_setparts|sb_settext|strsplit|tv_add|tv_delete|tv_getchild|tv_getcount|tv_getnext|tv_get|tv_getparent|tv_getprev|tv_getselection|tv_gettext|tv_modify|varsetcapacity|winactive|winexist|__New|__Call|__Get|__Set)\b/i,
      symbol: /\b(?:alt|altdown|altup|appskey|backspace|browser_back|browser_favorites|browser_forward|browser_home|browser_refresh|browser_search|browser_stop|bs|capslock|ctrl|ctrlbreak|ctrldown|ctrlup|del|delete|down|end|enter|esc|escape|f1|f10|f11|f12|f13|f14|f15|f16|f17|f18|f19|f2|f20|f21|f22|f23|f24|f3|f4|f5|f6|f7|f8|f9|home|ins|insert|joy1|joy10|joy11|joy12|joy13|joy14|joy15|joy16|joy17|joy18|joy19|joy2|joy20|joy21|joy22|joy23|joy24|joy25|joy26|joy27|joy28|joy29|joy3|joy30|joy31|joy32|joy4|joy5|joy6|joy7|joy8|joy9|joyaxes|joybuttons|joyinfo|joyname|joypov|joyr|joyu|joyv|joyx|joyy|joyz|lalt|launch_app1|launch_app2|launch_mail|launch_media|lbutton|lcontrol|lctrl|left|lshift|lwin|lwindown|lwinup|mbutton|media_next|media_play_pause|media_prev|media_stop|numlock|numpad0|numpad1|numpad2|numpad3|numpad4|numpad5|numpad6|numpad7|numpad8|numpad9|numpadadd|numpadclear|numpaddel|numpaddiv|numpaddot|numpaddown|numpadend|numpadenter|numpadhome|numpadins|numpadleft|numpadmult|numpadpgdn|numpadpgup|numpadright|numpadsub|numpadup|pgdn|pgup|printscreen|ralt|rbutton|rcontrol|rctrl|right|rshift|rwin|rwindown|rwinup|scrolllock|shift|shiftdown|shiftup|space|tab|up|volume_down|volume_mute|volume_up|wheeldown|wheelleft|wheelright|wheelup|xbutton1|xbutton2)\b/i,
      important: /#\b(?:AllowSameLineComments|ClipboardTimeout|CommentFlag|ErrorStdOut|EscapeChar|HotkeyInterval|HotkeyModifierTimeout|Hotstring|IfWinActive|IfWinExist|IfWinNotActive|IfWinNotExist|Include|IncludeAgain|InstallKeybdHook|InstallMouseHook|KeyHistory|LTrim|MaxHotkeysPerInterval|MaxMem|MaxThreads|MaxThreadsBuffer|MaxThreadsPerHotkey|NoEnv|NoTrayIcon|Persistent|SingleInstance|UseHook|WinActivateForce)\b/i,
      keyword: /\b(?:Abort|AboveNormal|Add|ahk_class|ahk_group|ahk_id|ahk_pid|All|Alnum|Alpha|AltSubmit|AltTab|AltTabAndMenu|AltTabMenu|AltTabMenuDismiss|AlwaysOnTop|AutoSize|Background|BackgroundTrans|BelowNormal|between|BitAnd|BitNot|BitOr|BitShiftLeft|BitShiftRight|BitXOr|Bold|Border|Button|ByRef|Checkbox|Checked|CheckedGray|Choose|ChooseString|Close|Color|ComboBox|Contains|ControlList|Count|Date|DateTime|Days|DDL|Default|DeleteAll|Delimiter|Deref|Destroy|Digit|Disable|Disabled|DropDownList|Edit|Eject|Else|Enable|Enabled|Error|Exist|Expand|ExStyle|FileSystem|First|Flash|Float|FloatFast|Focus|Font|for|global|Grid|Group|GroupBox|GuiClose|GuiContextMenu|GuiDropFiles|GuiEscape|GuiSize|Hdr|Hidden|Hide|High|HKCC|HKCR|HKCU|HKEY_CLASSES_ROOT|HKEY_CURRENT_CONFIG|HKEY_CURRENT_USER|HKEY_LOCAL_MACHINE|HKEY_USERS|HKLM|HKU|Hours|HScroll|Icon|IconSmall|ID|IDLast|If|IfEqual|IfExist|IfGreater|IfGreaterOrEqual|IfInString|IfLess|IfLessOrEqual|IfMsgBox|IfNotEqual|IfNotExist|IfNotInString|IfWinActive|IfWinExist|IfWinNotActive|IfWinNotExist|Ignore|ImageList|in|Integer|IntegerFast|Interrupt|is|italic|Join|Label|LastFound|LastFoundExist|Limit|Lines|List|ListBox|ListView|local|Lock|Logoff|Low|Lower|Lowercase|MainWindow|Margin|Maximize|MaximizeBox|MaxSize|Minimize|MinimizeBox|MinMax|MinSize|Minutes|MonthCal|Mouse|Move|Multi|NA|No|NoActivate|NoDefault|NoHide|NoIcon|NoMainWindow|norm|Normal|NoSort|NoSortHdr|NoStandard|Not|NoTab|NoTimers|Number|Off|Ok|On|OwnDialogs|Owner|Parse|Password|Picture|Pixel|Pos|Pow|Priority|ProcessName|Radio|Range|Read|ReadOnly|Realtime|Redraw|REG_BINARY|REG_DWORD|REG_EXPAND_SZ|REG_MULTI_SZ|REG_SZ|Region|Relative|Rename|Report|Resize|Restore|Retry|RGB|Screen|Seconds|Section|Serial|SetLabel|ShiftAltTab|Show|Single|Slider|SortDesc|Standard|static|Status|StatusBar|StatusCD|strike|Style|Submit|SysMenu|Tab2|TabStop|Text|Theme|Tile|ToggleCheck|ToggleEnable|ToolWindow|Top|Topmost|TransColor|Transparent|Tray|TreeView|TryAgain|Type|UnCheck|underline|Unicode|Unlock|UpDown|Upper|Uppercase|UseErrorLevel|Vis|VisFirst|Visible|VScroll|Wait|WaitClose|WantCtrlA|WantF2|WantReturn|While|Wrap|Xdigit|xm|xp|xs|Yes|ym|yp|ys)\b/i
    };
  }
};
var autoit_default = {
  language: "autoit",
  init: (Prism2) => {
    Prism2.languages.autoit = {
      comment: [
        /;.*/,
        {
          pattern: /(^\s*)#(?:comments-start|cs)[\s\S]*?^\s*#(?:comments-end|ce)/m,
          lookbehind: true
        }
      ],
      url: {
        pattern: /(^\s*#include\s+)(?:<[^\r\n>]+>|"[^\r\n"]+")/m,
        lookbehind: true
      },
      string: {
        pattern: /(["'])(?:\1\1|(?!\1)[^\r\n])*\1/,
        greedy: true,
        inside: {
          variable: /([%$@])\w+\1/
        }
      },
      directive: {
        pattern: /(^\s*)#\w+/m,
        lookbehind: true,
        alias: "keyword"
      },
      function: /\b\w+(?=\()/,
      variable: /[$@]\w+/,
      keyword: /\b(?:Case|Const|Continue(?:Case|Loop)|Default|Dim|Do|Else(?:If)?|End(?:Func|If|Select|Switch|With)|Enum|Exit(?:Loop)?|For|Func|Global|If|In|Local|Next|Null|ReDim|Select|Static|Step|Switch|Then|To|Until|Volatile|WEnd|While|With)\b/i,
      number: /\b(?:0x[\da-f]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b/i,
      boolean: /\b(?:True|False)\b/i,
      operator: /<[=>]?|[-+*\/=&>]=?|[?^]|\b(?:And|Or|Not)\b/i,
      punctuation: /[\[\]().,:]/
    };
  }
};
var bash_default = {
  language: "bash",
  init: (Prism2) => {
    (function(Prism3) {
      const insideString = {
        variable: [
          {
            pattern: /\$?\(\([\s\S]+?\)\)/,
            inside: {
              variable: [
                {
                  pattern: /(^\$\(\([\s\S]+)\)\)/,
                  lookbehind: true
                },
                /^\$\(\(/
              ],
              number: /\b0x[\dA-Fa-f]+\b|(?:\b\d+\.?\d*|\B\.\d+)(?:[Ee]-?\d+)?/,
              operator: /--?|-=|\+\+?|\+=|!=?|~|\*\*?|\*=|\/=?|%=?|<<=?|>>=?|<=?|>=?|==?|&&?|&=|\^=?|\|\|?|\|=|\?|:/,
              punctuation: /\(\(?|\)\)?|,|;/
            }
          },
          {
            pattern: /\$\([^)]+\)|`[^`]+`/,
            greedy: true,
            inside: {
              variable: /^\$\(|^`|\)$|`$/
            }
          },
          /\$(?:[\w#?*!@]+|\{[^}]+\})/i
        ]
      };
      Prism3.languages.bash = {
        shebang: {
          pattern: /^#!\s*\/bin\/bash|^#!\s*\/bin\/sh/,
          alias: "important"
        },
        comment: {
          pattern: /(^|[^"{\$])#.*/,
          lookbehind: true
        },
        string: [
          {
            pattern: /((?:^|[^<])<<\s*)["']?(\w+?)["']?\s*\r?\n(?:[\s\S])*?\r?\n\2/,
            lookbehind: true,
            greedy: true,
            inside: insideString
          },
          {
            pattern: /(^|[^\\](?:\\\\)*)"(?:\\[\s\S]|\$\([^)]+\)|\$(?!\()|`[^`]+`|[^"\\`$])*"/,
            lookbehind: true,
            greedy: true,
            inside: insideString
          },
          {
            pattern: /(^|[^$\\])'[^']*'/,
            lookbehind: true,
            greedy: true
          }
        ],
        variable: insideString.variable,
        function: {
          pattern: /(^|[\s;|&])(?:alias|apropos|apt-get|aptitude|aspell|awk|basename|bash|bc|bg|builtin|bzip2|cal|cat|cd|cfdisk|chgrp|chmod|chown|chroot|chkconfig|cksum|clear|cmp|comm|command|cp|cron|crontab|csplit|curl|cut|date|dc|dd|ddrescue|df|diff|diff3|dig|dir|dircolors|dirname|dirs|dmesg|du|egrep|eject|enable|env|ethtool|eval|exec|expand|expect|export|expr|fdformat|fdisk|fg|fgrep|file|find|fmt|fold|format|free|fsck|ftp|fuser|gawk|getopts|git|grep|groupadd|groupdel|groupmod|groups|gzip|hash|head|help|hg|history|hostname|htop|iconv|id|ifconfig|ifdown|ifup|import|install|jobs|join|kill|killall|less|link|ln|locate|logname|logout|look|lpc|lpr|lprint|lprintd|lprintq|lprm|ls|lsof|make|man|mkdir|mkfifo|mkisofs|mknod|more|most|mount|mtools|mtr|mv|mmv|nano|netstat|nice|nl|nohup|notify-send|npm|nslookup|open|op|passwd|paste|pathchk|ping|pkill|popd|pr|printcap|printenv|printf|ps|pushd|pv|pwd|quota|quotacheck|quotactl|ram|rar|rcp|read|readarray|readonly|reboot|rename|renice|remsync|rev|rm|rmdir|rsync|screen|scp|sdiff|sed|seq|service|sftp|shift|shopt|shutdown|sleep|slocate|sort|source|split|ssh|stat|strace|su|sudo|sum|suspend|sync|tail|tar|tee|test|time|timeout|times|touch|top|traceroute|trap|tr|tsort|tty|type|ulimit|umask|umount|unalias|uname|unexpand|uniq|units|unrar|unshar|uptime|useradd|userdel|usermod|users|uuencode|uudecode|v|vdir|vi|vmstat|wait|watch|wc|wget|whereis|which|who|whoami|write|xargs|xdg-open|yes|zip)(?=$|[\s;|&])/,
          lookbehind: true
        },
        keyword: {
          pattern: /(^|[\s;|&])(?:let|:|\.|if|then|else|elif|fi|for|break|continue|while|in|case|function|select|do|done|until|echo|exit|return|set|declare)(?=$|[\s;|&])/,
          lookbehind: true
        },
        boolean: {
          pattern: /(^|[\s;|&])(?:true|false)(?=$|[\s;|&])/,
          lookbehind: true
        },
        operator: /&&?|\|\|?|==?|!=?|<<<?|>>|<=?|>=?|=~/,
        punctuation: /\$?\(\(?|\)\)?|\.\.|[{}[\];]/
      };
      const inside = insideString.variable[1].inside;
      inside.string = Prism3.languages.bash.string;
      inside.function = Prism3.languages.bash.function;
      inside.keyword = Prism3.languages.bash.keyword;
      inside.boolean = Prism3.languages.bash.boolean;
      inside.operator = Prism3.languages.bash.operator;
      inside.punctuation = Prism3.languages.bash.punctuation;
      Prism3.languages.shell = Prism3.languages.bash;
    })(Prism2);
  }
};
var basic_default = {
  language: "basic",
  init: (Prism2) => {
    Prism2.languages.basic = {
      comment: {
        pattern: /(?:!|REM\b).+/i,
        inside: {
          keyword: /^REM/i
        }
      },
      string: {
        pattern: /"(?:""|[!#$%&'()*,\/:;<=>?^_ +\-.A-Z\d])*"/i,
        greedy: true
      },
      number: /(?:\b\d+\.?\d*|\B\.\d+)(?:E[+-]?\d+)?/i,
      keyword: /\b(?:AS|BEEP|BLOAD|BSAVE|CALL(?: ABSOLUTE)?|CASE|CHAIN|CHDIR|CLEAR|CLOSE|CLS|COM|COMMON|CONST|DATA|DECLARE|DEF(?: FN| SEG|DBL|INT|LNG|SNG|STR)|DIM|DO|DOUBLE|ELSE|ELSEIF|END|ENVIRON|ERASE|ERROR|EXIT|FIELD|FILES|FOR|FUNCTION|GET|GOSUB|GOTO|IF|INPUT|INTEGER|IOCTL|KEY|KILL|LINE INPUT|LOCATE|LOCK|LONG|LOOP|LSET|MKDIR|NAME|NEXT|OFF|ON(?: COM| ERROR| KEY| TIMER)?|OPEN|OPTION BASE|OUT|POKE|PUT|READ|REDIM|REM|RESTORE|RESUME|RETURN|RMDIR|RSET|RUN|SHARED|SINGLE|SELECT CASE|SHELL|SLEEP|STATIC|STEP|STOP|STRING|SUB|SWAP|SYSTEM|THEN|TIMER|TO|TROFF|TRON|TYPE|UNLOCK|UNTIL|USING|VIEW PRINT|WAIT|WEND|WHILE|WRITE)(?:\$|\b)/i,
      function: /\b(?:ABS|ACCESS|ACOS|ANGLE|AREA|ARITHMETIC|ARRAY|ASIN|ASK|AT|ATN|BASE|BEGIN|BREAK|CAUSE|CEIL|CHR|CLIP|COLLATE|COLOR|CON|COS|COSH|COT|CSC|DATE|DATUM|DEBUG|DECIMAL|DEF|DEG|DEGREES|DELETE|DET|DEVICE|DISPLAY|DOT|ELAPSED|EPS|ERASABLE|EXLINE|EXP|EXTERNAL|EXTYPE|FILETYPE|FIXED|FP|GO|GRAPH|HANDLER|IDN|IMAGE|IN|INT|INTERNAL|IP|IS|KEYED|LBOUND|LCASE|LEFT|LEN|LENGTH|LET|LINE|LINES|LOG|LOG10|LOG2|LTRIM|MARGIN|MAT|MAX|MAXNUM|MID|MIN|MISSING|MOD|NATIVE|NUL|NUMERIC|OF|OPTION|ORD|ORGANIZATION|OUTIN|OUTPUT|PI|POINT|POINTER|POINTS|POS|PRINT|PROGRAM|PROMPT|RAD|RADIANS|RANDOMIZE|RECORD|RECSIZE|RECTYPE|RELATIVE|REMAINDER|REPEAT|REST|RETRY|REWRITE|RIGHT|RND|ROUND|RTRIM|SAME|SEC|SELECT|SEQUENTIAL|SET|SETTER|SGN|SIN|SINH|SIZE|SKIP|SQR|STANDARD|STATUS|STR|STREAM|STYLE|TAB|TAN|TANH|TEMPLATE|TEXT|THERE|TIME|TIMEOUT|TRACE|TRANSFORM|TRUNCATE|UBOUND|UCASE|USE|VAL|VARIABLE|VIEWPORT|WHEN|WINDOW|WITH|ZER|ZONEWIDTH)(?:\$|\b)/i,
      operator: /<[=>]?|>=?|[+\-*\/^=&]|\b(?:AND|EQV|IMP|NOT|OR|XOR)\b/i,
      punctuation: /[,;:()]/
    };
  }
};
var batch_default = {
  language: "batch",
  init: (Prism2) => {
    (function(Prism3) {
      const variable = /%%?[~:\w]+%?|!\S+!/;
      const parameter = {
        pattern: /\/[a-z?]+(?=[ :]|$):?|-[a-z]\b|--[a-z-]+\b/im,
        alias: "attr-name",
        inside: {
          punctuation: /:/
        }
      };
      const string = /"[^"]*"/;
      const number = /(?:\b|-)\d+\b/;
      Prism3.languages.batch = {
        comment: [
          /^::.*/m,
          {
            pattern: /((?:^|[&(])[ \t]*)rem\b(?:[^^&)\r\n]|\^(?:\r\n|[\s\S]))*/im,
            lookbehind: true
          }
        ],
        label: {
          pattern: /^:.*/m,
          alias: "property"
        },
        command: [
          {
            pattern: /((?:^|[&(])[ \t]*)for(?: ?\/[a-z?](?:[ :](?:"[^"]*"|\S+))?)* \S+ in \([^)]+\) do/im,
            lookbehind: true,
            inside: {
              keyword: /^for\b|\b(?:in|do)\b/i,
              string,
              parameter,
              variable,
              number,
              punctuation: /[()',]/
            }
          },
          {
            pattern: /((?:^|[&(])[ \t]*)if(?: ?\/[a-z?](?:[ :](?:"[^"]*"|\S+))?)* (?:not )?(?:cmdextversion \d+|defined \w+|errorlevel \d+|exist \S+|(?:"[^"]*"|\S+)?(?:==| (?:equ|neq|lss|leq|gtr|geq) )(?:"[^"]*"|\S+))/im,
            lookbehind: true,
            inside: {
              keyword: /^if\b|\b(?:not|cmdextversion|defined|errorlevel|exist)\b/i,
              string,
              parameter,
              variable,
              number,
              operator: /\^|==|\b(?:equ|neq|lss|leq|gtr|geq)\b/i
            }
          },
          {
            pattern: /((?:^|[&()])[ \t]*)else\b/im,
            lookbehind: true,
            inside: {
              keyword: /^else\b/i
            }
          },
          {
            pattern: /((?:^|[&(])[ \t]*)set(?: ?\/[a-z](?:[ :](?:"[^"]*"|\S+))?)* (?:[^^&)\r\n]|\^(?:\r\n|[\s\S]))*/im,
            lookbehind: true,
            inside: {
              keyword: /^set\b/i,
              string,
              parameter,
              variable: [variable, /\w+(?=(?:[*\/%+\-&^|]|<<|>>)?=)/],
              number,
              operator: /[*\/%+\-&^|]=?|<<=?|>>=?|[!~_=]/,
              punctuation: /[()',]/
            }
          },
          {
            pattern: /((?:^|[&(])[ \t]*@?)\w+\b(?:[^^&)\r\n]|\^(?:\r\n|[\s\S]))*/im,
            lookbehind: true,
            inside: {
              keyword: /^\w+\b/i,
              string,
              parameter,
              label: {
                pattern: /(^\s*):\S+/m,
                lookbehind: true,
                alias: "property"
              },
              variable,
              number,
              operator: /\^/
            }
          }
        ],
        operator: /[&@]/,
        punctuation: /[()']/
      };
    })(Prism2);
  }
};
var brainfuck_default = {
  language: "brainfuck",
  init: (Prism2) => {
    Prism2.languages.brainfuck = {
      pointer: {
        pattern: /<|>/,
        alias: "keyword"
      },
      increment: {
        pattern: /\+/,
        alias: "inserted"
      },
      decrement: {
        pattern: /-/,
        alias: "deleted"
      },
      branching: {
        pattern: /\[|\]/,
        alias: "important"
      },
      operator: /[.,]/,
      comment: /\S+/
    };
  }
};
var bro_default = {
  language: "bro",
  init: (Prism2) => {
    Prism2.languages.bro = {
      comment: {
        pattern: /(^|[^\\$])#.*/,
        lookbehind: true,
        inside: {
          italic: /\b(?:TODO|FIXME|XXX)\b/
        }
      },
      string: {
        pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
        greedy: true
      },
      boolean: /\b[TF]\b/,
      function: {
        pattern: /(?:function|hook|event) \w+(?:::\w+)?/,
        inside: {
          keyword: /^(?:function|hook|event)/
        }
      },
      variable: {
        pattern: /(?:global|local) \w+/i,
        inside: {
          keyword: /(?:global|local)/
        }
      },
      builtin: /(?:@(?:load(?:-(?:sigs|plugin))?|unload|prefixes|ifn?def|else|(?:end)?if|DIR|FILENAME))|(?:&?(?:redef|priority|log|optional|default|add_func|delete_func|expire_func|read_expire|write_expire|create_expire|synchronized|persistent|rotate_interval|rotate_size|encrypt|raw_output|mergeable|group|error_handler|type_column))/,
      constant: {
        pattern: /const \w+/i,
        inside: {
          keyword: /const/
        }
      },
      keyword: /\b(?:break|next|continue|alarm|using|of|add|delete|export|print|return|schedule|when|timeout|addr|any|bool|count|double|enum|file|int|interval|pattern|opaque|port|record|set|string|subnet|table|time|vector|for|if|else|in|module|function)\b/,
      operator: /--?|\+\+?|!=?=?|<=?|>=?|==?=?|&&|\|\|?|\?|\*|\/|~|\^|%/,
      number: /\b0x[\da-f]+\b|(?:\b\d+\.?\d*|\B\.\d+)(?:e[+-]?\d+)?/i,
      punctuation: /[{}[\];(),.:]/
    };
  }
};
var clojure_default = {
  language: "clojure",
  init: (Prism2) => {
    Prism2.languages.clojure = {
      comment: /;+.*/,
      string: /"(?:\\.|[^\\"\r\n])*"/,
      operator: /(?:::|[:|'])\b[a-z][\w*+!?-]*\b/i,
      keyword: {
        pattern: /([^\w+*'?-])(?:def|if|do|let|\.\.|quote|var|->>|->|fn|loop|recur|throw|try|monitor-enter|\.|new|set!|def\-|defn|defn\-|defmacro|defmulti|defmethod|defstruct|defonce|declare|definline|definterface|defprotocol|==|defrecord|>=|deftype|<=|defproject|ns|\*|\+|\-|\/|<|=|>|accessor|agent|agent-errors|aget|alength|all-ns|alter|and|append-child|apply|array-map|aset|aset-boolean|aset-byte|aset-char|aset-double|aset-float|aset-int|aset-long|aset-short|assert|assoc|await|await-for|bean|binding|bit-and|bit-not|bit-or|bit-shift-left|bit-shift-right|bit-xor|boolean|branch\?|butlast|byte|cast|char|children|class|clear-agent-errors|comment|commute|comp|comparator|complement|concat|conj|cons|constantly|cond|if-not|construct-proxy|contains\?|count|create-ns|create-struct|cycle|dec|deref|difference|disj|dissoc|distinct|doall|doc|dorun|doseq|dosync|dotimes|doto|double|down|drop|drop-while|edit|end\?|ensure|eval|every\?|false\?|ffirst|file-seq|filter|find|find-doc|find-ns|find-var|first|float|flush|for|fnseq|frest|gensym|get-proxy-class|get|hash-map|hash-set|identical\?|identity|if-let|import|in-ns|inc|index|insert-child|insert-left|insert-right|inspect-table|inspect-tree|instance\?|int|interleave|intersection|into|into-array|iterate|join|key|keys|keyword|keyword\?|last|lazy-cat|lazy-cons|left|lefts|line-seq|list\*|list|load|load-file|locking|long|loop|macroexpand|macroexpand-1|make-array|make-node|map|map-invert|map\?|mapcat|max|max-key|memfn|merge|merge-with|meta|min|min-key|name|namespace|neg\?|new|newline|next|nil\?|node|not|not-any\?|not-every\?|not=|ns-imports|ns-interns|ns-map|ns-name|ns-publics|ns-refers|ns-resolve|ns-unmap|nth|nthrest|or|parse|partial|path|peek|pop|pos\?|pr|pr-str|print|print-str|println|println-str|prn|prn-str|project|proxy|proxy-mappings|quot|rand|rand-int|range|re-find|re-groups|re-matcher|re-matches|re-pattern|re-seq|read|read-line|reduce|ref|ref-set|refer|rem|remove|remove-method|remove-ns|rename|rename-keys|repeat|replace|replicate|resolve|rest|resultset-seq|reverse|rfirst|right|rights|root|rrest|rseq|second|select|select-keys|send|send-off|seq|seq-zip|seq\?|set|short|slurp|some|sort|sort-by|sorted-map|sorted-map-by|sorted-set|special-symbol\?|split-at|split-with|str|string\?|struct|struct-map|subs|subvec|symbol|symbol\?|sync|take|take-nth|take-while|test|time|to-array|to-array-2d|tree-seq|true\?|union|up|update-proxy|val|vals|var-get|var-set|var\?|vector|vector-zip|vector\?|when|when-first|when-let|when-not|with-local-vars|with-meta|with-open|with-out-str|xml-seq|xml-zip|zero\?|zipmap|zipper)(?=[^\w+*'?-])/,
        lookbehind: true
      },
      boolean: /\b(?:true|false|nil)\b/,
      number: /\b[0-9A-Fa-f]+\b/,
      punctuation: /[{}\[\](),]/
    };
  }
};
var csp_default = {
  language: "csp",
  init: (Prism2) => {
    Prism2.languages.csp = {
      directive: {
        pattern: /\b(?:(?:base-uri|form-action|frame-ancestors|plugin-types|referrer|reflected-xss|report-to|report-uri|require-sri-for|sandbox) |(?:block-all-mixed-content|disown-opener|upgrade-insecure-requests)(?: |;)|(?:child|connect|default|font|frame|img|manifest|media|object|script|style|worker)-src )/i,
        alias: "keyword"
      },
      safe: {
        pattern: /'(?:self|none|strict-dynamic|(?:nonce-|sha(?:256|384|512)-)[a-zA-Z\d+=/]+)'/,
        alias: "selector"
      },
      unsafe: {
        pattern: /(?:'unsafe-inline'|'unsafe-eval'|'unsafe-hashed-attributes'|\*)/,
        alias: "function"
      }
    };
  }
};
var diff_default = {
  language: "diff",
  init: (Prism2) => {
    Prism2.languages.diff = {
      coord: [
        /^(?:\*{3}|-{3}|\+{3}).*$/m,
        /^@@.*@@$/m,
        /^\d+.*$/m
      ],
      deleted: /^[-<].*$/m,
      inserted: /^[+>].*$/m,
      diff: {
        pattern: /^!(?!!).+$/m,
        alias: "important"
      }
    };
  }
};
var docker_default = {
  language: "docker",
  init: (Prism2) => {
    Prism2.languages.docker = {
      keyword: {
        pattern: /(^\s*)(?:ADD|ARG|CMD|COPY|ENTRYPOINT|ENV|EXPOSE|FROM|HEALTHCHECK|LABEL|MAINTAINER|ONBUILD|RUN|SHELL|STOPSIGNAL|USER|VOLUME|WORKDIR)(?=\s)/im,
        lookbehind: true
      },
      string: /("|')(?:(?!\1)[^\\\r\n]|\\(?:\r\n|[\s\S]))*\1/,
      comment: /#.*/,
      punctuation: /---|\.\.\.|[:[\]{}\-,|>?]/
    };
    Prism2.languages.dockerfile = Prism2.languages.docker;
  }
};
var eiffel_default = {
  language: "eiffel",
  init: (Prism2) => {
    Prism2.languages.eiffel = {
      comment: /--.*/,
      string: [
        {
          pattern: /"([^[]*)\[[\s\S]*?\]\1"/,
          greedy: true
        },
        {
          pattern: /"([^{]*)\{[\s\S]*?\}\1"/,
          greedy: true
        },
        {
          pattern: /"(?:%\s+%|%.|[^%"\r\n])*"/,
          greedy: true
        }
      ],
      char: /'(?:%.|[^%'\r\n])+'/,
      keyword: /\b(?:across|agent|alias|all|and|attached|as|assign|attribute|check|class|convert|create|Current|debug|deferred|detachable|do|else|elseif|end|ensure|expanded|export|external|feature|from|frozen|if|implies|inherit|inspect|invariant|like|local|loop|not|note|obsolete|old|once|or|Precursor|redefine|rename|require|rescue|Result|retry|select|separate|some|then|undefine|until|variant|Void|when|xor)\b/i,
      boolean: /\b(?:True|False)\b/i,
      "class-name": {
        pattern: /\b[A-Z][\dA-Z_]*\b/,
        alias: "builtin"
      },
      number: [
        /\b0[xcb][\da-f](?:_*[\da-f])*\b/i,
        /(?:\d(?:_*\d)*)?\.(?:(?:\d(?:_*\d)*)?e[+-]?)?\d(?:_*\d)*|\d(?:_*\d)*\.?/i
      ],
      punctuation: /:=|<<|>>|\(\||\|\)|->|\.(?=\w)|[{}[\];(),:?]/,
      operator: /\\\\|\|\.\.\||\.\.|\/[~\/=]?|[><]=?|[-+*^=~]/
    };
  }
};
var elixir_default = {
  language: "elixir",
  init: (Prism2) => {
    Prism2.languages.elixir = {
      comment: {
        pattern: /#.*/m,
        lookbehind: true
      },
      regex: {
        pattern: /~[rR](?:("""|''')(?:\\[\s\S]|(?!\1)[^\\])+\1|([\/|"'])(?:\\.|(?!\2)[^\\\r\n])+\2|\((?:\\.|[^\\)\r\n])+\)|\[(?:\\.|[^\\\]\r\n])+\]|\{(?:\\.|[^\\}\r\n])+\}|<(?:\\.|[^\\>\r\n])+>)[uismxfr]*/,
        greedy: true
      },
      string: [
        {
          pattern: /~[cCsSwW](?:("""|''')(?:\\[\s\S]|(?!\1)[^\\])+\1|([\/|"'])(?:\\.|(?!\2)[^\\\r\n])+\2|\((?:\\.|[^\\)\r\n])+\)|\[(?:\\.|[^\\\]\r\n])+\]|\{(?:\\.|#\{[^}]+\}|[^\\}\r\n])+\}|<(?:\\.|[^\\>\r\n])+>)[csa]?/,
          greedy: true,
          inside: {}
        },
        {
          pattern: /("""|''')[\s\S]*?\1/,
          greedy: true,
          inside: {}
        },
        {
          pattern: /("|')(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
          greedy: true,
          inside: {}
        }
      ],
      atom: {
        pattern: /(^|[^:]):\w+/,
        lookbehind: true,
        alias: "symbol"
      },
      "attr-name": /\w+:(?!:)/,
      capture: {
        pattern: /(^|[^&])&(?:[^&\s\d()][^\s()]*|(?=\())/,
        lookbehind: true,
        alias: "function"
      },
      argument: {
        pattern: /(^|[^&])&\d+/,
        lookbehind: true,
        alias: "variable"
      },
      attribute: {
        pattern: /@[\S]+/,
        alias: "variable"
      },
      number: /\b(?:0[box][a-f\d_]+|\d[\d_]*)(?:\.[\d_]+)?(?:e[+-]?[\d_]+)?\b/i,
      keyword: /\b(?:after|alias|and|case|catch|cond|def(?:callback|exception|impl|module|p|protocol|struct)?|do|else|end|fn|for|if|import|not|or|require|rescue|try|unless|use|when)\b/,
      boolean: /\b(?:true|false|nil)\b/,
      operator: [
        /\bin\b|&&?|\|[|>]?|\\\\|::|\.\.\.?|\+\+?|-[->]?|<[-=>]|>=|!==?|\B!|=(?:==?|[>~])?|[*\/^]/,
        {
          pattern: /([^<])<(?!<)/,
          lookbehind: true
        },
        {
          pattern: /([^>])>(?!>)/,
          lookbehind: true
        }
      ],
      punctuation: /<<|>>|[.,%\[\]{}()]/
    };
    Prism2.languages.elixir.string.forEach((o) => {
      o.inside = {
        interpolation: {
          pattern: /#\{[^}]+\}/,
          inside: {
            delimiter: {
              pattern: /^#\{|\}$/,
              alias: "punctuation"
            },
            rest: Prism2.languages.elixir
          }
        }
      };
    });
  }
};
var erlang_default = {
  language: "erlang",
  init: (Prism2) => {
    Prism2.languages.erlang = {
      comment: /%.+/,
      string: {
        pattern: /"(?:\\.|[^\\"\r\n])*"/,
        greedy: true
      },
      "quoted-function": {
        pattern: /'(?:\\.|[^\\'\r\n])+'(?=\()/,
        alias: "function"
      },
      "quoted-atom": {
        pattern: /'(?:\\.|[^\\'\r\n])+'/,
        alias: "atom"
      },
      boolean: /\b(?:true|false)\b/,
      keyword: /\b(?:fun|when|case|of|end|if|receive|after|try|catch)\b/,
      number: [
        /\$\\?./,
        /\d+#[a-z0-9]+/i,
        /(?:\b\d+\.?\d*|\B\.\d+)(?:e[+-]?\d+)?/i
      ],
      function: /\b[a-z][\w@]*(?=\()/,
      variable: {
        pattern: /(^|[^@])(?:\b|\?)[A-Z_][\w@]*/,
        lookbehind: true
      },
      operator: [
        /[=\/<>:]=|=[:\/]=|\+\+?|--?|[=*\/!]|\b(?:bnot|div|rem|band|bor|bxor|bsl|bsr|not|and|or|xor|orelse|andalso)\b/,
        {
          pattern: /(^|[^<])<(?!<)/,
          lookbehind: true
        },
        {
          pattern: /(^|[^>])>(?!>)/,
          lookbehind: true
        }
      ],
      atom: /\b[a-z][\w@]*/,
      punctuation: /[()[\]{}:;,.#|]|<<|>>/
    };
  }
};
var fortran_default = {
  language: "fortran",
  init: (Prism2) => {
    Prism2.languages.fortran = {
      "quoted-number": {
        pattern: /[BOZ](['"])[A-F0-9]+\1/i,
        alias: "number"
      },
      string: {
        pattern: /(?:\w+_)?(['"])(?:\1\1|&(?:\r\n?|\n)(?:\s*!.+(?:\r\n?|\n))?|(?!\1).)*(?:\1|&)/,
        inside: {
          comment: {
            pattern: /(&(?:\r\n?|\n)\s*)!.*/,
            lookbehind: true
          }
        }
      },
      comment: {
        pattern: /!.*/,
        greedy: true
      },
      boolean: /\.(?:TRUE|FALSE)\.(?:_\w+)?/i,
      number: /(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:[ED][+-]?\d+)?(?:_\w+)?/i,
      keyword: [
        /\b(?:INTEGER|REAL|DOUBLE ?PRECISION|COMPLEX|CHARACTER|LOGICAL)\b/i,
        /\b(?:END ?)?(?:BLOCK ?DATA|DO|FILE|FORALL|FUNCTION|IF|INTERFACE|MODULE(?! PROCEDURE)|PROGRAM|SELECT|SUBROUTINE|TYPE|WHERE)\b/i,
        /\b(?:ALLOCATABLE|ALLOCATE|BACKSPACE|CALL|CASE|CLOSE|COMMON|CONTAINS|CONTINUE|CYCLE|DATA|DEALLOCATE|DIMENSION|DO|END|EQUIVALENCE|EXIT|EXTERNAL|FORMAT|GO ?TO|IMPLICIT(?: NONE)?|INQUIRE|INTENT|INTRINSIC|MODULE PROCEDURE|NAMELIST|NULLIFY|OPEN|OPTIONAL|PARAMETER|POINTER|PRINT|PRIVATE|PUBLIC|READ|RETURN|REWIND|SAVE|SELECT|STOP|TARGET|WHILE|WRITE)\b/i,
        /\b(?:ASSIGNMENT|DEFAULT|ELEMENTAL|ELSE|ELSEWHERE|ELSEIF|ENTRY|IN|INCLUDE|INOUT|KIND|NULL|ONLY|OPERATOR|OUT|PURE|RECURSIVE|RESULT|SEQUENCE|STAT|THEN|USE)\b/i
      ],
      operator: [
        /\*\*|\/\/|=>|[=\/]=|[<>]=?|::|[+\-*=%]|\.(?:EQ|NE|LT|LE|GT|GE|NOT|AND|OR|EQV|NEQV)\.|\.[A-Z]+\./i,
        {
          pattern: /(^|(?!\().)\/(?!\))/,
          lookbehind: true
        }
      ],
      punctuation: /\(\/|\/\)|[(),;:&]/
    };
  }
};
var gedcom_default = {
  language: "gedcom",
  init: (Prism2) => {
    Prism2.languages.gedcom = {
      "line-value": {
        pattern: /(^\s*\d+ +(?:@\w[\w!"$%&'()*+,\-./:;<=>?[\\\]^`{|}~\x80-\xfe #]*@ +)?\w+ +).+/m,
        lookbehind: true,
        inside: {
          pointer: {
            pattern: /^@\w[\w!"$%&'()*+,\-./:;<=>?[\\\]^`{|}~\x80-\xfe #]*@$/,
            alias: "variable"
          }
        }
      },
      tag: {
        pattern: /(^\s*\d+ +(?:@\w[\w!"$%&'()*+,\-./:;<=>?[\\\]^`{|}~\x80-\xfe #]*@ +)?)\w+/m,
        lookbehind: true,
        alias: "string"
      },
      level: {
        pattern: /(^\s*)\d+/m,
        lookbehind: true,
        alias: "number"
      },
      pointer: {
        pattern: /@\w[\w!"$%&'()*+,\-./:;<=>?[\\\]^`{|}~\x80-\xfe #]*@/,
        alias: "variable"
      }
    };
  }
};
var gherkin_default = {
  language: "gherkin",
  init: (Prism2) => {
    Prism2.languages.gherkin = {
      pystring: {
        pattern: /("""|''')[\s\S]+?\1/,
        alias: "string"
      },
      comment: {
        pattern: /((?:^|\r?\n|\r)[ \t]*)#.*/,
        lookbehind: true
      },
      tag: {
        pattern: /((?:^|\r?\n|\r)[ \t]*)@\S*/,
        lookbehind: true
      },
      feature: {
        pattern: /((?:^|\r?\n|\r)[ \t]*)(?:Ability|Ahoy matey!|Arwedd|Aspekt|Besigheid Behoefte|Business Need|Caracteristica|Caracter\u00EDstica|Egenskab|Egenskap|Eiginleiki|Feature|F\u012B\u010Da|Fitur|Fonctionnalit\u00E9|Fonksyonalite|Funcionalidade|Funcionalitat|Functionalitate|Func\u0163ionalitate|Func\u021Bionalitate|Functionaliteit|Fungsi|Funkcia|Funkcija|Funkcionalit\u0101te|Funkcionalnost|Funkcja|Funksie|Funktionalit\u00E4t|Funktionalit\u00E9it|Funzionalit\u00E0|Hwaet|Hw\u00E6t|Jellemz\u0151|Karakteristik|laH|Lastnost|Mak|Mogucnost|Mogu\u0107nost|Moznosti|Mo\u017Enosti|OH HAI|Omadus|Ominaisuus|Osobina|\u00D6zellik|perbogh|poQbogh malja'|Potrzeba biznesowa|Po\u017Eadavek|Po\u017Eiadavka|Pretty much|Qap|Qu'meH 'ut|Savyb\u0117|T\u00EDnh n\u0103ng|Trajto|Vermo\u00EB|Vlastnos\u0165|W\u0142a\u015Bciwo\u015B\u0107|Zna\u010Dilnost|\u0394\u03C5\u03BD\u03B1\u03C4\u03CC\u03C4\u03B7\u03C4\u03B1|\u039B\u03B5\u03B9\u03C4\u03BF\u03C5\u03C1\u03B3\u03AF\u03B1|\u041C\u043E\u0433\u0443\u045B\u043D\u043E\u0441\u0442|\u041C\u04E9\u043C\u043A\u0438\u043D\u043B\u0435\u043A|\u041E\u0441\u043E\u0431\u0438\u043D\u0430|\u0421\u0432\u043E\u0439\u0441\u0442\u0432\u043E|\u04AE\u0437\u0435\u043D\u0447\u04D9\u043B\u0435\u043A\u043B\u0435\u043B\u0435\u043A|\u0424\u0443\u043D\u043A\u0446\u0438\u043E\u043D\u0430\u043B|\u0424\u0443\u043D\u043A\u0446\u0438\u043E\u043D\u0430\u043B\u043D\u043E\u0441\u0442|\u0424\u0443\u043D\u043A\u0446\u0438\u044F|\u0424\u0443\u043D\u043A\u0446\u0456\u043E\u043D\u0430\u043B|\u05EA\u05DB\u05D5\u05E0\u05D4|\u062E\u0627\u0635\u064A\u0629|\u062E\u0635\u0648\u0635\u06CC\u062A|\u0635\u0644\u0627\u062D\u06CC\u062A|\u06A9\u0627\u0631\u0648\u0628\u0627\u0631 \u06A9\u06CC \u0636\u0631\u0648\u0631\u062A|\u0648\u0650\u06CC\u0698\u06AF\u06CC|\u0930\u0942\u092A \u0932\u0947\u0916|\u0A16\u0A3E\u0A38\u0A40\u0A05\u0A24|\u0A28\u0A15\u0A36 \u0A28\u0A41\u0A39\u0A3E\u0A30|\u0A2E\u0A41\u0A39\u0A3E\u0A02\u0A26\u0A30\u0A3E|\u0C17\u0C41\u0C23\u0C2E\u0C41|\u0CB9\u0CC6\u0C9A\u0CCD\u0C9A\u0CB3|\u0E04\u0E27\u0E32\u0E21\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E17\u0E32\u0E07\u0E18\u0E38\u0E23\u0E01\u0E34\u0E08|\u0E04\u0E27\u0E32\u0E21\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16|\u0E42\u0E04\u0E23\u0E07\u0E2B\u0E25\u0E31\u0E01|\uAE30\uB2A5|\u30D5\u30A3\u30FC\u30C1\u30E3|\u529F\u80FD|\u6A5F\u80FD):(?:[^:]+(?:\r?\n|\r|$))*/,
        lookbehind: true,
        inside: {
          important: {
            pattern: /(:)[^\r\n]+/,
            lookbehind: true
          },
          keyword: /[^:\r\n]+:/
        }
      },
      scenario: {
        pattern: /((?:^|\r?\n|\r)[ \t]*)(?:Abstract Scenario|Abstrakt Scenario|Achtergrond|Aer|\u00C6r|Agtergrond|All y'all|Antecedentes|Antecedents|Atbur\u00F0ar\u00E1s|Atbur\u00F0ar\u00E1sir|Awww, look mate|B4|Background|Baggrund|Bakgrund|Bakgrunn|Bakgrunnur|Beispiele|Beispiller|B\u1ED1i c\u1EA3nh|Cefndir|Cenario|Cen\u00E1rio|Cenario de Fundo|Cen\u00E1rio de Fundo|Cenarios|Cen\u00E1rios|Contesto|Context|Contexte|Contexto|Conto|Contoh|Contone|D\u00E6mi|Dasar|Dead men tell no tales|Delineacao do Cenario|Delinea\u00E7\u00E3o do Cen\u00E1rio|Dis is what went down|D\u1EEF li\u1EC7u|Dyagram senaryo|Dyagram Senaryo|Egzanp|Ejemplos|Eksempler|Ekzemploj|Enghreifftiau|Esbozo do escenario|Escenari|Escenario|Esempi|Esquema de l'escenari|Esquema del escenario|Esquema do Cenario|Esquema do Cen\u00E1rio|Examples|EXAMPLZ|Exempel|Exemple|Exemples|Exemplos|First off|Fono|Forgat\u00F3k\u00F6nyv|Forgat\u00F3k\u00F6nyv v\u00E1zlat|Fundo|Ge\u00E7mi\u015F|ghantoH|Grundlage|Hannergrond|H\u00E1tt\u00E9r|Heave to|Istorik|Juhtumid|Keadaan|Khung k\u1ECBch b\u1EA3n|Khung t\u00ECnh hu\u1ED1ng|K\u1ECBch b\u1EA3n|Koncept|Konsep skenario|Kont\u00E8ks|Kontekst|Kontekstas|Konteksts|Kontext|Konturo de la scenaro|Latar Belakang|lut|lut chovnatlh|lutmey|L\u00FDsing Atbur\u00F0ar\u00E1sar|L\u00FDsing D\u00E6ma|Menggariskan Senario|MISHUN|MISHUN SRSLY|mo'|N\u00E1\u010Drt Scen\u00E1ra|N\u00E1\u010Drt Sc\u00E9n\u00E1\u0159e|N\u00E1\u010Drt Scen\u00E1ru|Oris scenarija|\u00D6rnekler|Osnova|Osnova Scen\u00E1ra|Osnova sc\u00E9n\u00E1\u0159e|Osnutek|Ozadje|Paraugs|Pavyzd\u017Eiai|P\u00E9ld\u00E1k|Piem\u0113ri|Plan du sc\u00E9nario|Plan du Sc\u00E9nario|Plan senaryo|Plan Senaryo|Plang vum Szenario|Pozad\u00ED|Pozadie|Pozadina|Pr\u00EDklady|P\u0159\u00EDklady|Primer|Primeri|Primjeri|Przyk\u0142ady|Raamstsenaarium|Reckon it's like|Rerefons|Scen\u00E1r|Sc\u00E9n\u00E1\u0159|Scenarie|Scenarij|Scenarijai|Scenarijaus \u0161ablonas|Scenariji|Scen\u0101rijs|Scen\u0101rijs p\u0113c parauga|Scenarijus|Scenario|Sc\u00E9nario|Scenario Amlinellol|Scenario Outline|Scenario Template|Scenariomal|Scenariomall|Scenarios|Scenariu|Scenariusz|Scenaro|Schema dello scenario|Se \u00F0e|Se the|Se \u00FEe|Senario|Senaryo|Senaryo deskripsyon|Senaryo Deskripsyon|Senaryo tasla\u011F\u0131|Shiver me timbers|Situ\u0101cija|Situai|Situasie|Situasie Uiteensetting|Skenario|Skenario konsep|Skica|Structura scenariu|Structur\u0103 scenariu|Struktura scenarija|Stsenaarium|Swa|Swa hwaer swa|Swa hw\u00E6r swa|Szablon scenariusza|Szenario|Szenariogrundriss|Tapaukset|Tapaus|Tapausaihio|Taust|Tausta|Template Keadaan|Template Senario|Template Situai|The thing of it is|T\u00ECnh hu\u1ED1ng|Variantai|Voorbeelde|Voorbeelden|Wharrimean is|Yo\-ho\-ho|You'll wanna|Za\u0142o\u017Cenia|\u03A0\u03B1\u03C1\u03B1\u03B4\u03B5\u03AF\u03B3\u03BC\u03B1\u03C4\u03B1|\u03A0\u03B5\u03C1\u03B9\u03B3\u03C1\u03B1\u03C6\u03AE \u03A3\u03B5\u03BD\u03B1\u03C1\u03AF\u03BF\u03C5|\u03A3\u03B5\u03BD\u03AC\u03C1\u03B9\u03B1|\u03A3\u03B5\u03BD\u03AC\u03C1\u03B9\u03BF|\u03A5\u03C0\u03CC\u03B2\u03B1\u03B8\u03C1\u03BF|\u041A\u0435\u0440\u0435\u0448|\u041A\u043E\u043D\u0442\u0435\u043A\u0441\u0442|\u041A\u043E\u043D\u0446\u0435\u043F\u0442|\u041C\u0438\u0441\u0430\u043B\u043B\u0430\u0440|\u041C\u0438\u0441\u043E\u043B\u043B\u0430\u0440|\u041E\u0441\u043D\u043E\u0432\u0430|\u041F\u0435\u0440\u0435\u0434\u0443\u043C\u043E\u0432\u0430|\u041F\u043E\u0437\u0430\u0434\u0438\u043D\u0430|\u041F\u0440\u0435\u0434\u0438\u0441\u0442\u043E\u0440\u0438\u044F|\u041F\u0440\u0435\u0434\u044B\u0441\u0442\u043E\u0440\u0438\u044F|\u041F\u0440\u0438\u043A\u043B\u0430\u0434\u0438|\u041F\u0440\u0438\u043C\u0435\u0440|\u041F\u0440\u0438\u043C\u0435\u0440\u0438|\u041F\u0440\u0438\u043C\u0435\u0440\u044B|\u0420\u0430\u043C\u043A\u0430 \u043D\u0430 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439|\u0421\u043A\u0438\u0446\u0430|\u0421\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0458\u0430|\u0421\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u044F|\u0421\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430 \u0441\u0446\u0435\u043D\u0430\u0440\u0456\u044E|\u0421\u0446\u0435\u043D\u0430\u0440\u0438\u0439|\u0421\u0446\u0435\u043D\u0430\u0440\u0438\u0439 \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430\u0441\u0438|\u0421\u0446\u0435\u043D\u0430\u0440\u0438\u0439\u043D\u044B\u04A3 \u0442\u04E9\u0437\u0435\u043B\u0435\u0448\u0435|\u0421\u0446\u0435\u043D\u0430\u0440\u0438\u0458\u0438|\u0421\u0446\u0435\u043D\u0430\u0440\u0438\u043E|\u0421\u0446\u0435\u043D\u0430\u0440\u0456\u0439|\u0422\u0430\u0440\u0438\u0445|\u04AE\u0440\u043D\u04D9\u043A\u043B\u04D9\u0440|\u05D3\u05D5\u05D2\u05DE\u05D0\u05D5\u05EA|\u05E8\u05E7\u05E2|\u05EA\u05D1\u05E0\u05D9\u05EA \u05EA\u05E8\u05D7\u05D9\u05E9|\u05EA\u05E8\u05D7\u05D9\u05E9|\u0627\u0644\u062E\u0644\u0641\u064A\u0629|\u0627\u0644\u06AF\u0648\u06CC \u0633\u0646\u0627\u0631\u06CC\u0648|\u0627\u0645\u062B\u0644\u0629|\u067E\u0633 \u0645\u0646\u0638\u0631|\u0632\u0645\u06CC\u0646\u0647|\u0633\u0646\u0627\u0631\u06CC\u0648|\u0633\u064A\u0646\u0627\u0631\u064A\u0648|\u0633\u064A\u0646\u0627\u0631\u064A\u0648 \u0645\u062E\u0637\u0637|\u0645\u062B\u0627\u0644\u06CC\u06BA|\u0645\u0646\u0638\u0631 \u0646\u0627\u0645\u06D2 \u06A9\u0627 \u062E\u0627\u06A9\u06C1|\u0645\u0646\u0638\u0631\u0646\u0627\u0645\u06C1|\u0646\u0645\u0648\u0646\u0647 \u0647\u0627|\u0909\u0926\u093E\u0939\u0930\u0923|\u092A\u0930\u093F\u0926\u0943\u0936\u094D\u092F|\u092A\u0930\u093F\u0926\u0943\u0936\u094D\u092F \u0930\u0942\u092A\u0930\u0947\u0916\u093E|\u092A\u0943\u0937\u094D\u0920\u092D\u0942\u092E\u093F|\u0A09\u0A26\u0A3E\u0A39\u0A30\u0A28\u0A3E\u0A02|\u0A2A\u0A1F\u0A15\u0A25\u0A3E|\u0A2A\u0A1F\u0A15\u0A25\u0A3E \u0A22\u0A3E\u0A02\u0A1A\u0A3E|\u0A2A\u0A1F\u0A15\u0A25\u0A3E \u0A30\u0A42\u0A2A \u0A30\u0A47\u0A16\u0A3E|\u0A2A\u0A3F\u0A1B\u0A4B\u0A15\u0A5C|\u0C09\u0C26\u0C3E\u0C39\u0C30\u0C23\u0C32\u0C41|\u0C15\u0C25\u0C28\u0C02|\u0C28\u0C47\u0C2A\u0C25\u0C4D\u0C2F\u0C02|\u0C38\u0C28\u0C4D\u0C28\u0C3F\u0C35\u0C47\u0C36\u0C02|\u0C89\u0CA6\u0CBE\u0CB9\u0CB0\u0CA3\u0CC6\u0C97\u0CB3\u0CC1|\u0C95\u0CA5\u0CBE\u0CB8\u0CBE\u0CB0\u0CBE\u0C82\u0CB6|\u0CB5\u0CBF\u0CB5\u0CB0\u0CA3\u0CC6|\u0CB9\u0CBF\u0CA8\u0CCD\u0CA8\u0CC6\u0CB2\u0CC6|\u0E42\u0E04\u0E23\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E02\u0E2D\u0E07\u0E40\u0E2B\u0E15\u0E38\u0E01\u0E32\u0E23\u0E13\u0E4C|\u0E0A\u0E38\u0E14\u0E02\u0E2D\u0E07\u0E15\u0E31\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07|\u0E0A\u0E38\u0E14\u0E02\u0E2D\u0E07\u0E40\u0E2B\u0E15\u0E38\u0E01\u0E32\u0E23\u0E13\u0E4C|\u0E41\u0E19\u0E27\u0E04\u0E34\u0E14|\u0E2A\u0E23\u0E38\u0E1B\u0E40\u0E2B\u0E15\u0E38\u0E01\u0E32\u0E23\u0E13\u0E4C|\u0E40\u0E2B\u0E15\u0E38\u0E01\u0E32\u0E23\u0E13\u0E4C|\uBC30\uACBD|\uC2DC\uB098\uB9AC\uC624|\uC2DC\uB098\uB9AC\uC624 \uAC1C\uC694|\uC608|\u30B5\u30F3\u30D7\u30EB|\u30B7\u30CA\u30EA\u30AA|\u30B7\u30CA\u30EA\u30AA\u30A2\u30A6\u30C8\u30E9\u30A4\u30F3|\u30B7\u30CA\u30EA\u30AA\u30C6\u30F3\u30D7\u30EC|\u30B7\u30CA\u30EA\u30AA\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8|\u30C6\u30F3\u30D7\u30EC|\u4F8B|\u4F8B\u5B50|\u5267\u672C|\u5267\u672C\u5927\u7EB2|\u5287\u672C|\u5287\u672C\u5927\u7DB1|\u573A\u666F|\u573A\u666F\u5927\u7EB2|\u5834\u666F|\u5834\u666F\u5927\u7DB1|\u80CC\u666F):[^:\r\n]*/,
        lookbehind: true,
        inside: {
          important: {
            pattern: /(:)[^\r\n]*/,
            lookbehind: true
          },
          keyword: /[^:\r\n]+:/
        }
      },
      "table-body": {
        pattern: /((?:\r?\n|\r)[ \t]*\|.+\|[^\r\n]*)+/,
        lookbehind: true,
        inside: {
          outline: {
            pattern: /<[^>]+?>/,
            alias: "variable"
          },
          td: {
            pattern: /\s*[^\s|][^|]*/,
            alias: "string"
          },
          punctuation: /\|/
        }
      },
      "table-head": {
        pattern: /(?:\r?\n|\r)[ \t]*\|.+\|[^\r\n]*/,
        inside: {
          th: {
            pattern: /\s*[^\s|][^|]*/,
            alias: "variable"
          },
          punctuation: /\|/
        }
      },
      atrule: {
        pattern: /((?:\r?\n|\r)[ \t]+)(?:'ach|'a|'ej|7|a|A tak\u00E9|A taktie\u017E|A tie\u017E|A z\u00E1rove\u0148|Aber|Ac|Adott|Akkor|Ak|Aleshores|Ale|Ali|Allora|Alors|Als|Ama|Amennyiben|Amikor|Ampak|an|AN|Ananging|And y'all|And|Angenommen|Anrhegedig a|An|Apabila|At\u00E8s|Atesa|Atunci|Avast!|Aye|A|awer|Bagi|Banjur|Bet|Bi\u1EBFt|Blimey!|Buh|But at the end of the day I reckon|But y'all|But|BUT|Cal|C\u00E2nd|Cando|Cand|Ce|Cuando|\u010Ce|\u00D0a \u00F0e|\u00D0a|Dadas|Dada|Dados|Dado|DaH ghu' bejlu'|dann|Dann|Dano|Dan|Dar|Dat fiind|Data|Date fiind|Date|Dati fiind|Dati|Da\u0163i fiind|Da\u021Bi fiind|Dato|DEN|Den youse gotta|Dengan|De|Diberi|Diyelim ki|Donada|Donat|Donita\u0135o|Do|Dun|Duota|\u00D0urh|Eeldades|Ef|E\u011Fer ki|Entao|Ent\u00E3o|Ent\u00F3n|Entonces|En|Epi|E|\u00C9s|Etant donn\u00E9e|Etant donn\u00E9|Et|\u00C9tant donn\u00E9es|\u00C9tant donn\u00E9e|\u00C9tant donn\u00E9|Etant donn\u00E9es|Etant donn\u00E9s|\u00C9tant donn\u00E9s|Fakat|Gangway!|Gdy|Gegeben seien|Gegeben sei|Gegeven|Gegewe|ghu' noblu'|Gitt|Given y'all|Given|Givet|Givun|Ha|Cho|I CAN HAZ|In|Ir|It's just unbelievable|I|Ja|Je\u015Bli|Je\u017Celi|Kadar|Kada|Kad|Kai|Kaj|Kdy\u017E|Ke\u010F|Kemudian|Ketika|Khi|Kiedy|Ko|Kuid|Kui|Kun|Lan|latlh|Le sa a|Let go and haul|Le|L\u00E8 sa a|L\u00E8|Logo|Lorsqu'<|Lorsque|m\u00E4|Maar|Mais|Maj\u0105c|Majd|Maka|Manawa|Mas|Ma|Menawa|Men|Mutta|Nalikaning|Nalika|Nanging|N\u00E5r|N\u00E4r|Nato|Nh\u01B0ng|Niin|Njuk|O zaman|Og|Och|Oletetaan|Onda|Ond|Oraz|Pak|Pero|Per\u00F2|Podano|Pokia\u013E|Pokud|Potem|Potom|Privzeto|Pryd|qaSDI'|Quando|Quand|Quan|S\u00E5|Sed|Se|Siis|Sipoze ke|Sipoze Ke|Sipoze|Si|\u015Ei|\u0218i|Soit|Stel|Tada|Tad|Takrat|Tak|Tapi|Ter|Tetapi|Tha the|Tha|Then y'all|Then|Th\u00EC|Thurh|Toda|Too right|ugeholl|Und|Un|V\u00E0|vaj|Vendar|Ve|wann|Wanneer|WEN|Wenn|When y'all|When|Wtedy|Wun|Y'know|Yeah nah|Yna|Youse know like when|Youse know when youse got|Y|Za predpokladu|Za p\u0159edpokladu|Zadani|Zadano|Zadan|Zadate|Zadato|Zak\u0142adaj\u0105c|Zaradi|Zatati|\u00DEa \u00FEe|\u00DEa|\u00DE\u00E1|\u00DEegar|\u00DEurh|\u0391\u03BB\u03BB\u03AC|\u0394\u03B5\u03B4\u03BF\u03BC\u03AD\u03BD\u03BF\u03C5|\u039A\u03B1\u03B9|\u038C\u03C4\u03B1\u03BD|\u03A4\u03CC\u03C4\u03B5|\u0410 \u0442\u0430\u043A\u043E\u0436|\u0410\u0433\u0430\u0440|\u0410\u043B\u0435|\u0410\u043B\u0438|\u0410\u043C\u043C\u043E|\u0410|\u04D8\u0433\u04D9\u0440|\u04D8\u0439\u0442\u0438\u043A|\u04D8\u043C\u043C\u0430|\u0411\u0438\u0440\u043E\u043A|\u0412\u0430|\u0412\u04D9|\u0414\u0430\u0434\u0435\u043D\u043E|\u0414\u0430\u043D\u043E|\u0414\u043E\u043F\u0443\u0441\u0442\u0438\u043C|\u0415\u0441\u043B\u0438|\u0417\u0430\u0434\u0430\u0442\u0435|\u0417\u0430\u0434\u0430\u0442\u0438|\u0417\u0430\u0434\u0430\u0442\u043E|\u0418|\u0406|\u041A \u0442\u043E\u043C\u0443 \u0436\u0435|\u041A\u0430\u0434\u0430|\u041A\u0430\u0434|\u041A\u043E\u0433\u0430\u0442\u043E|\u041A\u043E\u0433\u0434\u0430|\u041A\u043E\u043B\u0438|\u041B\u04D9\u043A\u0438\u043D|\u041B\u0435\u043A\u0438\u043D|\u041D\u04D9\u0442\u0438\u0497\u04D9\u0434\u04D9|\u041D\u0435\u0445\u0430\u0439|\u041D\u043E|\u041E\u043D\u0434\u0430|\u041F\u0440\u0438\u043F\u0443\u0441\u0442\u0438\u043C\u043E, \u0449\u043E|\u041F\u0440\u0438\u043F\u0443\u0441\u0442\u0438\u043C\u043E|\u041F\u0443\u0441\u0442\u044C|\u0422\u0430\u043A\u0436\u0435|\u0422\u0430|\u0422\u043E\u0433\u0434\u0430|\u0422\u043E\u0434\u0456|\u0422\u043E|\u0423\u043D\u0434\u0430|\u04BA\u04D9\u043C|\u042F\u043A\u0449\u043E|\u05D0\u05D1\u05DC|\u05D0\u05D6\u05D9|\u05D0\u05D6|\u05D1\u05D4\u05D9\u05E0\u05EA\u05DF|\u05D5\u05D2\u05DD|\u05DB\u05D0\u05E9\u05E8|\u0622\u0646\u06AF\u0627\u0647|\u0627\u0630\u0627\u064B|\u0627\u06AF\u0631|\u0627\u0645\u0627|\u0627\u0648\u0631|\u0628\u0627 \u0641\u0631\u0636|\u0628\u0627\u0644\u0641\u0631\u0636|\u0628\u0641\u0631\u0636|\u067E\u06BE\u0631|\u062A\u0628|\u062B\u0645|\u062C\u0628|\u0639\u0646\u062F\u0645\u0627|\u0641\u0631\u0636 \u06A9\u06CC\u0627|\u0644\u0643\u0646|\u0644\u06CC\u06A9\u0646|\u0645\u062A\u0649|\u0647\u0646\u06AF\u0627\u0645\u06CC|\u0648|\u0905\u0917\u0930|\u0914\u0930|\u0915\u0926\u093E|\u0915\u093F\u0928\u094D\u0924\u0941|\u091A\u0942\u0902\u0915\u093F|\u091C\u092C|\u0924\u0925\u093E|\u0924\u0926\u093E|\u0924\u092C|\u092A\u0930\u0928\u094D\u0924\u0941|\u092A\u0930|\u092F\u0926\u093F|\u0A05\u0A24\u0A47|\u0A1C\u0A26\u0A4B\u0A02|\u0A1C\u0A3F\u0A35\u0A47\u0A02 \u0A15\u0A3F|\u0A1C\u0A47\u0A15\u0A30|\u0A24\u0A26|\u0A2A\u0A30|\u0C05\u0C2A\u0C4D\u0C2A\u0C41\u0C21\u0C41|\u0C08 \u0C2A\u0C30\u0C3F\u0C38\u0C4D\u0C25\u0C3F\u0C24\u0C3F\u0C32\u0C4B|\u0C15\u0C3E\u0C28\u0C3F|\u0C1A\u0C46\u0C2A\u0C4D\u0C2A\u0C2C\u0C21\u0C3F\u0C28\u0C26\u0C3F|\u0C2E\u0C30\u0C3F\u0C2F\u0C41|\u0C86\u0CA6\u0CB0\u0CC6|\u0CA8\u0C82\u0CA4\u0CB0|\u0CA8\u0CBF\u0CD5\u0CA1\u0CBF\u0CA6|\u0CAE\u0CA4\u0CCD\u0CA4\u0CC1|\u0CB8\u0CCD\u0CA5\u0CBF\u0CA4\u0CBF\u0CAF\u0CA8\u0CCD\u0CA8\u0CC1|\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E43\u0E2B\u0E49|\u0E14\u0E31\u0E07\u0E19\u0E31\u0E49\u0E19|\u0E41\u0E15\u0E48|\u0E40\u0E21\u0E37\u0E48\u0E2D|\u0E41\u0E25\u0E30|\uADF8\uB7EC\uBA74<|\uADF8\uB9AC\uACE0<|\uB2E8<|\uB9CC\uC57D<|\uB9CC\uC77C<|\uBA3C\uC800<|\uC870\uAC74<|\uD558\uC9C0\uB9CC<|\u304B\u3064<|\u3057\u304B\u3057<|\u305F\u3060\u3057<|\u306A\u3089\u3070<|\u3082\u3057<|\u4E26\u4E14<|\u4F46\u3057<|\u4F46\u662F<|\u5047\u5982<|\u5047\u5B9A<|\u5047\u8A2D<|\u5047\u8BBE<|\u524D\u63D0<|\u540C\u65F6<|\u540C\u6642<|\u5E76\u4E14<|\u5F53<|\u7576<|\u800C\u4E14<|\u90A3\u4E48<|\u90A3\u9EBC<)(?=[ \t]+)/,
        lookbehind: true
      },
      string: {
        pattern: /"(?:\\.|[^"\\\r\n])*"|'(?:\\.|[^'\\\r\n])*'/,
        inside: {
          outline: {
            pattern: /<[^>]+?>/,
            alias: "variable"
          }
        }
      },
      outline: {
        pattern: /<[^>]+?>/,
        alias: "variable"
      }
    };
  }
};
var git_default = {
  language: "git",
  init: (Prism2) => {
    Prism2.languages.git = {
      comment: /^#.*/m,
      deleted: /^[-\u2013].*/m,
      inserted: /^\+.*/m,
      string: /("|')(?:\\.|(?!\1)[^\\\r\n])*\1/m,
      command: {
        pattern: /^.*\$ git .*$/m,
        inside: {
          parameter: /\s--?\w+/m
        }
      },
      coord: /^@@.*@@$/m,
      commit_sha1: /^commit \w{40}$/m
    };
  }
};
var graphql_default = {
  language: "graphql",
  init: (Prism2) => {
    Prism2.languages.graphql = {
      comment: /#.*/,
      string: {
        pattern: /"(?:\\.|[^\\"\r\n])*"/,
        greedy: true
      },
      number: /(?:\B-|\b)\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/i,
      boolean: /\b(?:true|false)\b/,
      variable: /\$[a-z_]\w*/i,
      directive: {
        pattern: /@[a-z_]\w*/i,
        alias: "function"
      },
      "attr-name": /[a-z_]\w*(?=\s*:)/i,
      keyword: [
        {
          pattern: /(fragment\s+(?!on)[a-z_]\w*\s+|\.{3}\s*)on\b/,
          lookbehind: true
        },
        /\b(?:query|fragment|mutation)\b/
      ],
      operator: /!|=|\.{3}/,
      punctuation: /[!(){}\[\]:=,]/
    };
  }
};
var haml_default = {
  language: "haml",
  init: (Prism2) => {
    (function(Prism3) {
      Prism3.languages.haml = {
        "multiline-comment": {
          pattern: /((?:^|\r?\n|\r)([\t ]*))(?:\/|-#).*(?:(?:\r?\n|\r)\2[\t ]+.+)*/,
          lookbehind: true,
          alias: "comment"
        },
        "multiline-code": [
          {
            pattern: /((?:^|\r?\n|\r)([\t ]*)(?:[~-]|[&!]?=)).*,[\t ]*(?:(?:\r?\n|\r)\2[\t ]+.*,[\t ]*)*(?:(?:\r?\n|\r)\2[\t ]+.+)/,
            lookbehind: true,
            inside: {
              rest: Prism3.languages.ruby
            }
          },
          {
            pattern: /((?:^|\r?\n|\r)([\t ]*)(?:[~-]|[&!]?=)).*\|[\t ]*(?:(?:\r?\n|\r)\2[\t ]+.*\|[\t ]*)*/,
            lookbehind: true,
            inside: {
              rest: Prism3.languages.ruby
            }
          }
        ],
        filter: {
          pattern: /((?:^|\r?\n|\r)([\t ]*)):[\w-]+(?:(?:\r?\n|\r)(?:\2[\t ]+.+|\s*?(?=\r?\n|\r)))+/,
          lookbehind: true,
          inside: {
            "filter-name": {
              pattern: /^:[\w-]+/,
              alias: "variable"
            }
          }
        },
        markup: {
          pattern: /((?:^|\r?\n|\r)[\t ]*)<.+/,
          lookbehind: true,
          inside: {
            rest: Prism3.languages.markup
          }
        },
        doctype: {
          pattern: /((?:^|\r?\n|\r)[\t ]*)!!!(?: .+)?/,
          lookbehind: true
        },
        tag: {
          pattern: /((?:^|\r?\n|\r)[\t ]*)[%.#][\w\-#.]*[\w\-](?:\([^)]+\)|\{(?:\{[^}]+\}|[^}])+\}|\[[^\]]+\])*[\/<>]*/,
          lookbehind: true,
          inside: {
            attributes: [
              {
                pattern: /(^|[^#])\{(?:\{[^}]+\}|[^}])+\}/,
                lookbehind: true,
                inside: {
                  rest: Prism3.languages.ruby
                }
              },
              {
                pattern: /\([^)]+\)/,
                inside: {
                  "attr-value": {
                    pattern: /(=\s*)(?:"(?:\\.|[^\\"\r\n])*"|[^)\s]+)/,
                    lookbehind: true
                  },
                  "attr-name": /[\w:-]+(?=\s*!?=|\s*[,)])/,
                  punctuation: /[=(),]/
                }
              },
              {
                pattern: /\[[^\]]+\]/,
                inside: {
                  rest: Prism3.languages.ruby
                }
              }
            ],
            punctuation: /[<>]/
          }
        },
        code: {
          pattern: /((?:^|\r?\n|\r)[\t ]*(?:[~-]|[&!]?=)).+/,
          lookbehind: true,
          inside: {
            rest: Prism3.languages.ruby
          }
        },
        interpolation: {
          pattern: /#\{[^}]+\}/,
          inside: {
            delimiter: {
              pattern: /^#\{|\}$/,
              alias: "punctuation"
            },
            rest: Prism3.languages.ruby
          }
        },
        punctuation: {
          pattern: /((?:^|\r?\n|\r)[\t ]*)[~=\-&!]+/,
          lookbehind: true
        }
      };
      const filter_pattern = "((?:^|\\r?\\n|\\r)([\\t ]*)):{{filter_name}}(?:(?:\\r?\\n|\\r)(?:\\2[\\t ]+.+|\\s*?(?=\\r?\\n|\\r)))+";
      const filters = [
        "css",
        { filter: "coffee", language: "coffeescript" },
        "erb",
        "javascript",
        "less",
        "markdown",
        "ruby",
        "scss",
        "textile"
      ];
      const all_filters = {};
      for (let i = 0, l = filters.length;i < l; i++) {
        let filter = filters[i];
        filter = typeof filter === "string" ? { filter, language: filter } : filter;
        if (Prism3.languages[filter.language]) {
          all_filters[`filter-${filter.filter}`] = {
            pattern: RegExp(filter_pattern.replace("{{filter_name}}", filter.filter)),
            lookbehind: true,
            inside: {
              "filter-name": {
                pattern: /^:[\w-]+/,
                alias: "variable"
              },
              rest: Prism3.languages[filter.language]
            }
          };
        }
      }
      Prism3.languages.insertBefore("haml", "filter", all_filters);
    })(Prism2);
  }
};
var handlebars_default = {
  language: "handlebars",
  init: (Prism2) => {
    (function(Prism3) {
      Prism3.languages.handlebars = {
        comment: /\{\{![\s\S]*?\}\}/,
        delimiter: {
          pattern: /^\{\{\{?|\}\}\}?$/i,
          alias: "punctuation"
        },
        string: /(["'])(?:\\.|(?!\1)[^\\\r\n])*\1/,
        number: /\b0x[\dA-Fa-f]+\b|(?:\b\d+\.?\d*|\B\.\d+)(?:[Ee][+-]?\d+)?/,
        boolean: /\b(?:true|false)\b/,
        block: {
          pattern: /^(\s*~?\s*)[#\/]\S+?(?=\s*~?\s*$|\s)/i,
          lookbehind: true,
          alias: "keyword"
        },
        brackets: {
          pattern: /\[[^\]]+\]/,
          inside: {
            punctuation: /\[|\]/,
            variable: /[\s\S]+/
          }
        },
        punctuation: /[!"#%&'()*+,.\/;<=>@\[\\\]^`{|}~]/,
        variable: /[^!"#%&'()*+,.\/;<=>@\[\\\]^`{|}~\s]+/
      };
      Prism3.hooks.add("before-tokenize", (env) => {
        const handlebarsPattern = /\{\{\{[\s\S]+?\}\}\}|\{\{[\s\S]+?\}\}/g;
        Prism3.languages["markup-templating"].buildPlaceholders(env, "handlebars", handlebarsPattern);
      });
      Prism3.hooks.add("after-tokenize", (env) => {
        Prism3.languages["markup-templating"].tokenizePlaceholders(env, "handlebars");
      });
    })(Prism2);
  }
};
var haskell_default = {
  language: "haskell",
  init: (Prism2) => {
    Prism2.languages.haskell = {
      comment: {
        pattern: /(^|[^-!#$%*+=?&@|~.:<>^\\\/])(?:--[^-!#$%*+=?&@|~.:<>^\\\/].*|{-[\s\S]*?-})/m,
        lookbehind: true
      },
      char: /'(?:[^\\']|\\(?:[abfnrtv\\"'&]|\^[A-Z@[\]^_]|NUL|SOH|STX|ETX|EOT|ENQ|ACK|BEL|BS|HT|LF|VT|FF|CR|SO|SI|DLE|DC1|DC2|DC3|DC4|NAK|SYN|ETB|CAN|EM|SUB|ESC|FS|GS|RS|US|SP|DEL|\d+|o[0-7]+|x[0-9a-fA-F]+))'/,
      string: {
        pattern: /"(?:[^\\"]|\\(?:[abfnrtv\\"'&]|\^[A-Z@[\]^_]|NUL|SOH|STX|ETX|EOT|ENQ|ACK|BEL|BS|HT|LF|VT|FF|CR|SO|SI|DLE|DC1|DC2|DC3|DC4|NAK|SYN|ETB|CAN|EM|SUB|ESC|FS|GS|RS|US|SP|DEL|\d+|o[0-7]+|x[0-9a-fA-F]+)|\\\s+\\)*"/,
        greedy: true
      },
      keyword: /\b(?:case|class|data|deriving|do|else|if|in|infixl|infixr|instance|let|module|newtype|of|primitive|then|type|where)\b/,
      import_statement: {
        pattern: /((?:\r?\n|\r|^)\s*)import\s+(?:qualified\s+)?(?:[A-Z][\w']*)(?:\.[A-Z][\w']*)*(?:\s+as\s+(?:[A-Z][_a-zA-Z0-9']*)(?:\.[A-Z][\w']*)*)?(?:\s+hiding\b)?/m,
        lookbehind: true,
        inside: {
          keyword: /\b(?:import|qualified|as|hiding)\b/
        }
      },
      builtin: /\b(?:abs|acos|acosh|all|and|any|appendFile|approxRational|asTypeOf|asin|asinh|atan|atan2|atanh|basicIORun|break|catch|ceiling|chr|compare|concat|concatMap|const|cos|cosh|curry|cycle|decodeFloat|denominator|digitToInt|div|divMod|drop|dropWhile|either|elem|encodeFloat|enumFrom|enumFromThen|enumFromThenTo|enumFromTo|error|even|exp|exponent|fail|filter|flip|floatDigits|floatRadix|floatRange|floor|fmap|foldl|foldl1|foldr|foldr1|fromDouble|fromEnum|fromInt|fromInteger|fromIntegral|fromRational|fst|gcd|getChar|getContents|getLine|group|head|id|inRange|index|init|intToDigit|interact|ioError|isAlpha|isAlphaNum|isAscii|isControl|isDenormalized|isDigit|isHexDigit|isIEEE|isInfinite|isLower|isNaN|isNegativeZero|isOctDigit|isPrint|isSpace|isUpper|iterate|last|lcm|length|lex|lexDigits|lexLitChar|lines|log|logBase|lookup|map|mapM|mapM_|max|maxBound|maximum|maybe|min|minBound|minimum|mod|negate|not|notElem|null|numerator|odd|or|ord|otherwise|pack|pi|pred|primExitWith|print|product|properFraction|putChar|putStr|putStrLn|quot|quotRem|range|rangeSize|read|readDec|readFile|readFloat|readHex|readIO|readInt|readList|readLitChar|readLn|readOct|readParen|readSigned|reads|readsPrec|realToFrac|recip|rem|repeat|replicate|return|reverse|round|scaleFloat|scanl|scanl1|scanr|scanr1|seq|sequence|sequence_|show|showChar|showInt|showList|showLitChar|showParen|showSigned|showString|shows|showsPrec|significand|signum|sin|sinh|snd|sort|span|splitAt|sqrt|subtract|succ|sum|tail|take|takeWhile|tan|tanh|threadToIOResult|toEnum|toInt|toInteger|toLower|toRational|toUpper|truncate|uncurry|undefined|unlines|until|unwords|unzip|unzip3|userError|words|writeFile|zip|zip3|zipWith|zipWith3)\b/,
      number: /\b(?:\d+(?:\.\d+)?(?:e[+-]?\d+)?|0o[0-7]+|0x[0-9a-f]+)\b/i,
      operator: /\s\.\s|[-!#$%*+=?&@|~.:<>^\\\/]*\.[-!#$%*+=?&@|~.:<>^\\\/]+|[-!#$%*+=?&@|~.:<>^\\\/]+\.[-!#$%*+=?&@|~.:<>^\\\/]*|[-!#$%*+=?&@|~:<>^\\\/]+|`([A-Z][\w']*\.)*[_a-z][\w']*`/,
      hvariable: /\b(?:[A-Z][\w']*\.)*[_a-z][\w']*\b/,
      constant: /\b(?:[A-Z][\w']*\.)*[A-Z][\w']*\b/,
      punctuation: /[{}[\];(),.:]/
    };
  }
};
var hpkp_default = {
  language: "hpkp",
  init: (Prism2) => {
    Prism2.languages.hpkp = {
      directive: {
        pattern: /\b(?:(?:includeSubDomains|preload|strict)(?: |;)|pin-sha256="[a-zA-Z\d+=/]+"|(?:max-age|report-uri)=|report-to )/,
        alias: "keyword"
      },
      safe: {
        pattern: /\d{7,}/,
        alias: "selector"
      },
      unsafe: {
        pattern: /\d{0,6}/,
        alias: "function"
      }
    };
  }
};
var hsts_default = {
  language: "hsts",
  init: (Prism2) => {
    Prism2.languages.hsts = {
      directive: {
        pattern: /\b(?:max-age=|includeSubDomains|preload)/,
        alias: "keyword"
      },
      safe: {
        pattern: /\d{8,}/,
        alias: "selector"
      },
      unsafe: {
        pattern: /\d{0,7}/,
        alias: "function"
      }
    };
  }
};
var http_default = {
  language: "http",
  init: (Prism2) => {
    Prism2.languages.http = {
      "request-line": {
        pattern: /^(?:POST|GET|PUT|DELETE|OPTIONS|PATCH|TRACE|CONNECT)\shttps?:\/\/\S+\sHTTP\/[0-9.]+/m,
        inside: {
          property: /^(?:POST|GET|PUT|DELETE|OPTIONS|PATCH|TRACE|CONNECT)\b/,
          "attr-name": /:\w+/
        }
      },
      "response-status": {
        pattern: /^HTTP\/1.[01] \d+.*/m,
        inside: {
          property: {
            pattern: /(^HTTP\/1.[01] )\d+.*/i,
            lookbehind: true
          }
        }
      },
      "header-name": {
        pattern: /^[\w-]+:(?=.)/m,
        alias: "keyword"
      }
    };
    const httpLanguages = {
      "application/json": Prism2.languages.javascript,
      "application/xml": Prism2.languages.markup,
      "text/xml": Prism2.languages.markup,
      "text/html": Prism2.languages.markup
    };
    for (const contentType in httpLanguages) {
      if (httpLanguages[contentType]) {
        const options = {};
        options[contentType] = {
          pattern: new RegExp(`(content-type:\\s*${contentType}[\\w\\W]*?)(?:\\r?\\n|\\r){2}[\\w\\W]*`, "i"),
          lookbehind: true,
          inside: {
            rest: httpLanguages[contentType]
          }
        };
        Prism2.languages.insertBefore("http", "header-name", options);
      }
    }
  }
};
var ichigojam_default = {
  language: "ichigojam",
  init: (Prism2) => {
    Prism2.languages.ichigojam = {
      comment: /(?:\B'|REM)(?:[^\n\r]*)/i,
      string: {
        pattern: /"(?:""|[!#$%&'()*,\/:;<=>?^_ +\-.A-Z\d])*"/i,
        greedy: true
      },
      number: /\B#[0-9A-F]+|\B`[01]+|(?:\b\d+\.?\d*|\B\.\d+)(?:E[+-]?\d+)?/i,
      keyword: /\b(?:BEEP|BPS|CASE|CLEAR|CLK|CLO|CLP|CLS|CLT|CLV|CONT|COPY|ELSE|END|FILE|FILES|FOR|GOSUB|GSB|GOTO|IF|INPUT|KBD|LED|LET|LIST|LOAD|LOCATE|LRUN|NEW|NEXT|OUT|RIGHT|PLAY|POKE|PRINT|PWM|REM|RENUM|RESET|RETURN|RTN|RUN|SAVE|SCROLL|SLEEP|SRND|STEP|STOP|SUB|TEMPO|THEN|TO|UART|VIDEO|WAIT)(?:\$|\b)/i,
      function: /\b(?:ABS|ANA|ASC|BIN|BTN|DEC|END|FREE|HELP|HEX|I2CR|I2CW|IN|INKEY|LEN|LINE|PEEK|RND|SCR|SOUND|STR|TICK|USR|VER|VPEEK|ZER)(?:\$|\b)/i,
      label: /(?:\B@[^\s]+)/i,
      operator: /<[=>]?|>=?|\|\||&&|[+\-*\/=|&^~!]|\b(?:AND|NOT|OR)\b/i,
      punctuation: /[\[,;:()\]]/
    };
  }
};
var icon_default = {
  language: "icon",
  init: (Prism2) => {
    Prism2.languages.icon = {
      comment: /#.*/,
      string: {
        pattern: /(["'])(?:(?!\1)[^\\\r\n_]|\\.|_(?!\1)(?:\r\n|[\s\S]))*\1/,
        greedy: true
      },
      number: /\b(?:\d+r[a-z\d]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b|\.\d+\b/i,
      "builtin-keyword": {
        pattern: /&(?:allocated|ascii|clock|collections|cset|current|date|dateline|digits|dump|e|error(?:number|text|value)?|errout|fail|features|file|host|input|lcase|letters|level|line|main|null|output|phi|pi|pos|progname|random|regions|source|storage|subject|time|trace|ucase|version)\b/,
        alias: "variable"
      },
      directive: {
        pattern: /\$\w+/,
        alias: "builtin"
      },
      keyword: /\b(?:break|by|case|create|default|do|else|end|every|fail|global|if|initial|invocable|link|local|next|not|of|procedure|record|repeat|return|static|suspend|then|to|until|while)\b/,
      function: /(?!\d)\w+(?=\s*[({]|\s*!\s*\[)/,
      operator: /[+-]:(?!=)|(?:[\/?@^%&]|\+\+?|--?|==?=?|~==?=?|\*\*?|\|\|\|?|<(?:->?|<?=?)|>>?=?)(?::=)?|:(?:=:?)?|[!.\\|~]/,
      punctuation: /[\[\](){},;]/
    };
  }
};
var inform7_default = {
  language: "inform7",
  init: (Prism2) => {
    Prism2.languages.inform7 = {
      string: {
        pattern: /"[^"]*"/,
        inside: {
          substitution: {
            pattern: /\[[^\]]+\]/,
            inside: {
              delimiter: {
                pattern: /\[|\]/,
                alias: "punctuation"
              }
            }
          }
        }
      },
      comment: {
        pattern: /\[[^\]]+\]/,
        greedy: true
      },
      title: {
        pattern: /^[ \t]*(?:volume|book|part(?! of)|chapter|section|table)\b.+/im,
        alias: "important"
      },
      number: {
        pattern: /(^|[^-])(?:\b\d+(?:\.\d+)?(?:\^\d+)?\w*|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve))\b(?!-)/i,
        lookbehind: true
      },
      verb: {
        pattern: /(^|[^-])\b(?:applying to|are|attacking|answering|asking|be(?:ing)?|burning|buying|called|carries|carry(?! out)|carrying|climbing|closing|conceal(?:s|ing)?|consulting|contain(?:s|ing)?|cutting|drinking|dropping|eating|enclos(?:es?|ing)|entering|examining|exiting|getting|giving|going|ha(?:ve|s|ving)|hold(?:s|ing)?|impl(?:y|ies)|incorporat(?:es?|ing)|inserting|is|jumping|kissing|listening|locking|looking|mean(?:s|ing)?|opening|provid(?:es?|ing)|pulling|pushing|putting|relat(?:es?|ing)|removing|searching|see(?:s|ing)?|setting|showing|singing|sleeping|smelling|squeezing|switching|support(?:s|ing)?|swearing|taking|tasting|telling|thinking|throwing|touching|turning|tying|unlock(?:s|ing)?|var(?:y|ies|ying)|waiting|waking|waving|wear(?:s|ing)?)\b(?!-)/i,
        lookbehind: true,
        alias: "operator"
      },
      keyword: {
        pattern: /(^|[^-])\b(?:after|before|carry out|check|continue the action|definition(?= *:)|do nothing|else|end (?:if|unless|the story)|every turn|if|include|instead(?: of)?|let|move|no|now|otherwise|repeat|report|resume the story|rule for|running through|say(?:ing)?|stop the action|test|try(?:ing)?|understand|unless|use|when|while|yes)\b(?!-)/i,
        lookbehind: true
      },
      property: {
        pattern: /(^|[^-])\b(?:adjacent(?! to)|carried|closed|concealed|contained|dark|described|edible|empty|enclosed|enterable|even|female|fixed in place|full|handled|held|improper-named|incorporated|inedible|invisible|lighted|lit|lock(?:able|ed)|male|marked for listing|mentioned|negative|neuter|non-(?:empty|full|recurring)|odd|opaque|open(?:able)?|plural-named|portable|positive|privately-named|proper-named|provided|publically-named|pushable between rooms|recurring|related|rubbing|scenery|seen|singular-named|supported|swinging|switch(?:able|ed(?: on| off)?)|touch(?:able|ed)|transparent|unconcealed|undescribed|unlit|unlocked|unmarked for listing|unmentioned|unopenable|untouchable|unvisited|variable|visible|visited|wearable|worn)\b(?!-)/i,
        lookbehind: true,
        alias: "symbol"
      },
      position: {
        pattern: /(^|[^-])\b(?:above|adjacent to|back side of|below|between|down|east|everywhere|front side|here|in|inside(?: from)?|north(?:east|west)?|nowhere|on(?: top of)?|other side|outside(?: from)?|parts? of|regionally in|south(?:east|west)?|through|up|west|within)\b(?!-)/i,
        lookbehind: true,
        alias: "keyword"
      },
      type: {
        pattern: /(^|[^-])\b(?:actions?|activit(?:y|ies)|actors?|animals?|backdrops?|containers?|devices?|directions?|doors?|holders?|kinds?|lists?|m[ae]n|nobody|nothing|nouns?|numbers?|objects?|people|persons?|player(?:'s holdall)?|regions?|relations?|rooms?|rule(?:book)?s?|scenes?|someone|something|supporters?|tables?|texts?|things?|time|vehicles?|wom[ae]n)\b(?!-)/i,
        lookbehind: true,
        alias: "variable"
      },
      punctuation: /[.,:;(){}]/
    };
    Prism2.languages.inform7.string.inside.substitution.inside.rest = Prism2.languages.inform7;
    Prism2.languages.inform7.string.inside.substitution.inside.rest.text = {
      pattern: /\S(?:\s*\S)*/,
      alias: "comment"
    };
  }
};
var ini_default = {
  language: "ini",
  init: (Prism2) => {
    Prism2.languages.ini = {
      comment: /^[ \t]*;.*$/m,
      selector: /^[ \t]*\[.*?\]/m,
      constant: /^[ \t]*[^\s=]+?(?=[ \t]*=)/m,
      "attr-value": {
        pattern: /=.*/,
        inside: {
          punctuation: /^[=]/
        }
      }
    };
  }
};
var io_default = {
  language: "io",
  init: (Prism2) => {
    Prism2.languages.io = {
      comment: [
        {
          pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
          lookbehind: true
        },
        {
          pattern: /(^|[^\\])\/\/.*/,
          lookbehind: true
        },
        {
          pattern: /(^|[^\\])#.*/,
          lookbehind: true
        }
      ],
      "triple-quoted-string": {
        pattern: /"""(?:\\[\s\S]|(?!""")[^\\])*"""/,
        greedy: true,
        alias: "string"
      },
      string: {
        pattern: /"(?:\\.|[^\\\r\n"])*"/,
        greedy: true
      },
      keyword: /\b(?:activate|activeCoroCount|asString|block|break|catch|clone|collectGarbage|compileString|continue|do|doFile|doMessage|doString|else|elseif|exit|for|foreach|forward|getSlot|getEnvironmentVariable|hasSlot|if|ifFalse|ifNil|ifNilEval|ifTrue|isActive|isNil|isResumable|list|message|method|parent|pass|pause|perform|performWithArgList|print|println|proto|raise|raiseResumable|removeSlot|resend|resume|schedulerSleepSeconds|self|sender|setSchedulerSleepSeconds|setSlot|shallowCopy|slotNames|super|system|then|thisBlock|thisContext|call|try|type|uniqueId|updateSlot|wait|while|write|yield)\b/,
      builtin: /\b(?:Array|AudioDevice|AudioMixer|Block|Box|Buffer|CFunction|CGI|Color|Curses|DBM|DNSResolver|DOConnection|DOProxy|DOServer|Date|Directory|Duration|DynLib|Error|Exception|FFT|File|Fnmatch|Font|Future|GL|GLE|GLScissor|GLU|GLUCylinder|GLUQuadric|GLUSphere|GLUT|Host|Image|Importer|LinkList|List|Lobby|Locals|MD5|MP3Decoder|MP3Encoder|Map|Message|Movie|Notification|Number|Object|OpenGL|Point|Protos|Regex|SGML|SGMLElement|SGMLParser|SQLite|Server|Sequence|ShowMessage|SleepyCat|SleepyCatCursor|Socket|SocketManager|Sound|Soup|Store|String|Tree|UDPSender|UPDReceiver|URL|User|Warning|WeakLink|Random|BigNum|Sequence)\b/,
      boolean: /\b(?:true|false|nil)\b/,
      number: /\b0x[\da-f]+\b|(?:\b\d+\.?\d*|\B\.\d+)(?:e-?\d+)?/i,
      operator: /[=!*/%+-^&|]=|>>?=?|<<?=?|:?:?=|\+\+?|--?|\*\*?|\/\/?|%|\|\|?|&&?|(\b(?:return|and|or|not)\b)|@@?|\?\??|\.\./,
      punctuation: /[{}[\];(),.:]/
    };
  }
};
var j_default = {
  language: "j",
  init: (Prism2) => {
    Prism2.languages.j = {
      comment: /\bNB\..*/,
      string: {
        pattern: /'(?:''|[^'\r\n])*'/,
        greedy: true
      },
      keyword: /\b(?:(?:adverb|conjunction|CR|def|define|dyad|LF|monad|noun|verb)\b|(?:assert|break|case|catch[dt]?|continue|do|else|elseif|end|fcase|for|for_\w+|goto_\w+|if|label_\w+|return|select|throw|try|while|whilst)\.)/,
      verb: {
        pattern: /(?!\^:|;\.|[=!][.:])(?:\{(?:\.|::?)?|p(?:\.\.?|:)|[=!\]]|[<>+*\-%$|,#][.:]?|[?^]\.?|[;\[]:?|[~}"i][.:]|[ACeEIjLor]\.|(?:[_\/\\qsux]|_?\d):)/,
        alias: "keyword"
      },
      number: /\b_?(?:(?!\d:)\d+(?:\.\d+)?(?:(?:[ejpx]|ad|ar)_?\d+(?:\.\d+)?)*(?:b_?[\da-z]+(?:\.[\da-z]+)?)?|_(?!\.))/,
      adverb: {
        pattern: /[~}]|[\/\\]\.?|[bfM]\.|t[.:]/,
        alias: "builtin"
      },
      operator: /[=a][.:]|_\./,
      conjunction: {
        pattern: /&(?:\.:?|:)?|[.:@][.:]?|[!D][.:]|[;dHT]\.|`:?|[\^LS]:|"/,
        alias: "variable"
      },
      punctuation: /[()]/
    };
  }
};
var json_default = {
  language: "json",
  init: (Prism2) => {
    Prism2.languages.json = {
      property: /"(?:\\.|[^\\"\r\n])*"(?=\s*:)/i,
      string: {
        pattern: /"(?:\\.|[^\\"\r\n])*"(?!\s*:)/,
        greedy: true
      },
      number: /\b0x[\dA-Fa-f]+\b|(?:\b\d+\.?\d*|\B\.\d+)(?:[Ee][+-]?\d+)?/,
      punctuation: /[{}[\]);,]/,
      operator: /:/g,
      boolean: /\b(?:true|false)\b/i,
      null: /\bnull\b/i
    };
    Prism2.languages.jsonp = Prism2.languages.json;
  }
};
var julia_default = {
  language: "julia",
  init: (Prism2) => {
    Prism2.languages.julia = {
      comment: {
        pattern: /(^|[^\\])#.*/,
        lookbehind: true
      },
      string: /("""|''')[\s\S]+?\1|("|')(?:\\.|(?!\2)[^\\\r\n])*\2/,
      keyword: /\b(?:abstract|baremodule|begin|bitstype|break|catch|ccall|const|continue|do|else|elseif|end|export|finally|for|function|global|if|immutable|import|importall|let|local|macro|module|print|println|quote|return|try|type|typealias|using|while)\b/,
      boolean: /\b(?:true|false)\b/,
      number: /(?:\b(?=\d)|\B(?=\.))(?:0[box])?(?:[\da-f]+\.?\d*|\.\d+)(?:[efp][+-]?\d+)?j?/i,
      operator: /[-+*^%\u00F7&$\\]=?|\/[\/=]?|!=?=?|\|[=>]?|<(?:<=?|[=:])?|>(?:=|>>?=?)?|==?=?|[~\u2260\u2264\u2265]/,
      punctuation: /[{}[\];(),.:]/
    };
  }
};
var keyman_default = {
  language: "keyman",
  init: (Prism2) => {
    Prism2.languages.keyman = {
      comment: /\bc\s.*/i,
      function: /\[\s*(?:(?:CTRL|SHIFT|ALT|LCTRL|RCTRL|LALT|RALT|CAPS|NCAPS)\s+)*(?:[TKU]_[\w?]+|".+?"|'.+?')\s*\]/i,
      string: /("|').*?\1/,
      bold: [
        /&(?:baselayout|bitmap|capsononly|capsalwaysoff|shiftfreescaps|copyright|ethnologuecode|hotkey|includecodes|keyboardversion|kmw_embedcss|kmw_embedjs|kmw_helpfile|kmw_helptext|kmw_rtl|language|layer|layoutfile|message|mnemoniclayout|name|oldcharposmatching|platform|targets|version|visualkeyboard|windowslanguages)\b/i,
        /\b(?:bitmap|bitmaps|caps on only|caps always off|shift frees caps|copyright|hotkey|language|layout|message|name|version)\b/i
      ],
      keyword: /\b(?:any|baselayout|beep|call|context|deadkey|dk|if|index|layer|notany|nul|outs|platform|return|reset|save|set|store|use)\b/i,
      atrule: /\b(?:ansi|begin|unicode|group|using keys|match|nomatch)\b/i,
      number: /\b(?:U\+[\dA-F]+|d\d+|x[\da-f]+|\d+)\b/i,
      operator: /[+>\\,()]/,
      tag: /\$(?:keyman|kmfl|weaver|keymanweb|keymanonly):/i
    };
  }
};
var latex_default = {
  language: "latex",
  init: (Prism2) => {
    (function(Prism3) {
      let funcPattern = /\\(?:[^a-z()[\]]|[a-z*]+)/i, insideEqu = {
        "equation-command": {
          pattern: funcPattern,
          alias: "regex"
        }
      };
      Prism3.languages.latex = {
        comment: /%.*/m,
        cdata: {
          pattern: /(\\begin\{((?:verbatim|lstlisting)\*?)\})[\s\S]*?(?=\\end\{\2\})/,
          lookbehind: true
        },
        equation: [
          {
            pattern: /\$(?:\\[\s\S]|[^\\$])*\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/,
            inside: insideEqu,
            alias: "string"
          },
          {
            pattern: /(\\begin\{((?:equation|math|eqnarray|align|multline|gather)\*?)\})[\s\S]*?(?=\\end\{\2\})/,
            lookbehind: true,
            inside: insideEqu,
            alias: "string"
          }
        ],
        keyword: {
          pattern: /(\\(?:begin|end|ref|cite|label|usepackage|documentclass)(?:\[[^\]]+\])?\{)[^}]+(?=\})/,
          lookbehind: true
        },
        url: {
          pattern: /(\\url\{)[^}]+(?=\})/,
          lookbehind: true
        },
        headline: {
          pattern: /(\\(?:part|chapter|section|subsection|frametitle|subsubsection|paragraph|subparagraph|subsubparagraph|subsubsubparagraph)\*?(?:\[[^\]]+\])?\{)[^}]+(?=\}(?:\[[^\]]+\])?)/,
          lookbehind: true,
          alias: "class-name"
        },
        function: {
          pattern: funcPattern,
          alias: "selector"
        },
        punctuation: /[[\]{}&]/
      };
    })(Prism2);
  }
};
var liquid_default = {
  language: "liquid",
  init: (Prism2) => {
    Prism2.languages.liquid = {
      keyword: /\b(?:comment|endcomment|if|elsif|else|endif|unless|endunless|for|endfor|case|endcase|when|in|break|assign|continue|limit|offset|range|reversed|raw|endraw|capture|endcapture|tablerow|endtablerow)\b/,
      number: /\b0b[01]+\b|\b0x[\da-f]*\.?[\da-fp-]+\b|(?:\b\d+\.?\d*|\B\.\d+)(?:e[+-]?\d+)?[df]?/i,
      operator: {
        pattern: /(^|[^.])(?:\+[+=]?|-[-=]?|!=?|<<?=?|>>?>?=?|==?|&[&=]?|\|[|=]?|\*=?|\/=?|%=?|\^=?|[?:~])/m,
        lookbehind: true
      },
      function: {
        pattern: /(^|[\s;|&])(?:append|prepend|capitalize|cycle|cols|increment|decrement|abs|at_least|at_most|ceil|compact|concat|date|default|divided_by|downcase|escape|escape_once|first|floor|join|last|lstrip|map|minus|modulo|newline_to_br|plus|remove|remove_first|replace|replace_first|reverse|round|rstrip|size|slice|sort|sort_natural|split|strip|strip_html|strip_newlines|times|truncate|truncatewords|uniq|upcase|url_decode|url_encode|include|paginate)(?=$|[\s;|&])/,
        lookbehind: true
      }
    };
  }
};
var lisp_default = {
  language: "lisp",
  init: (Prism2) => {
    (function(Prism3) {
      function simple_form(name) {
        return new RegExp(`(\\()${name}(?=[\\s\\)])`);
      }
      function primitive(pattern) {
        return new RegExp(`([\\s([])${pattern}(?=[\\s)])`);
      }
      const symbol = "[-+*/_~!@$%^=<>{}\\w]+";
      const marker = `&${symbol}`;
      const par = "(\\()";
      const endpar = "(?=\\))";
      const space = "(?=\\s)";
      const language = {
        heading: {
          pattern: /;;;.*/,
          alias: ["comment", "title"]
        },
        comment: /;.*/,
        string: {
          pattern: /"(?:[^"\\]|\\[\s\S])*"/,
          greedy: true,
          inside: {
            argument: /[-A-Z]+(?=[.,\s])/,
            symbol: new RegExp(`\`${symbol}'`)
          }
        },
        "quoted-symbol": {
          pattern: new RegExp(`#?'${symbol}`),
          alias: ["variable", "symbol"]
        },
        "lisp-property": {
          pattern: new RegExp(`:${symbol}`),
          alias: "property"
        },
        splice: {
          pattern: new RegExp(`,@?${symbol}`),
          alias: ["symbol", "variable"]
        },
        keyword: [
          {
            pattern: new RegExp(`${par}(?:(?:lexical-)?let\\*?|(?:cl-)?letf|if|when|while|unless|cons|cl-loop|and|or|not|cond|setq|error|message|null|require|provide|use-package)${space}`),
            lookbehind: true
          },
          {
            pattern: new RegExp(`${par}(?:for|do|collect|return|finally|append|concat|in|by)${space}`),
            lookbehind: true
          }
        ],
        declare: {
          pattern: simple_form("declare"),
          lookbehind: true,
          alias: "keyword"
        },
        interactive: {
          pattern: simple_form("interactive"),
          lookbehind: true,
          alias: "keyword"
        },
        boolean: {
          pattern: primitive("(?:t|nil)"),
          lookbehind: true
        },
        number: {
          pattern: primitive("[-+]?\\d+(?:\\.\\d*)?"),
          lookbehind: true
        },
        defvar: {
          pattern: new RegExp(`${par}def(?:var|const|custom|group)\\s+${symbol}`),
          lookbehind: true,
          inside: {
            keyword: /^def[a-z]+/,
            variable: new RegExp(symbol)
          }
        },
        defun: {
          pattern: new RegExp(`${par}(?:cl-)?(?:defun\\*?|defmacro)\\s+${symbol}\\s+\\([\\s\\S]*?\\)`),
          lookbehind: true,
          inside: {
            keyword: /^(?:cl-)?def\S+/,
            arguments: null,
            function: {
              pattern: new RegExp(`(^\\s)${symbol}`),
              lookbehind: true
            },
            punctuation: /[()]/
          }
        },
        lambda: {
          pattern: new RegExp(`${par}lambda\\s+\\((?:&?${symbol}\\s*)*\\)`),
          lookbehind: true,
          inside: {
            keyword: /^lambda/,
            arguments: null,
            punctuation: /[()]/
          }
        },
        car: {
          pattern: new RegExp(par + symbol),
          lookbehind: true
        },
        punctuation: [
          /(['`,]?\(|[)\[\]])/,
          {
            pattern: /(\s)\.(?=\s)/,
            lookbehind: true
          }
        ]
      };
      const arg = {
        "lisp-marker": new RegExp(marker),
        rest: {
          argument: {
            pattern: new RegExp(symbol),
            alias: "variable"
          },
          varform: {
            pattern: new RegExp(`${par + symbol}\\s+\\S[\\s\\S]*${endpar}`),
            lookbehind: true,
            inside: {
              string: language.string,
              boolean: language.boolean,
              number: language.number,
              symbol: language.symbol,
              punctuation: /[()]/
            }
          }
        }
      };
      const forms = "\\S+(?:\\s+\\S+)*";
      const arglist = {
        pattern: new RegExp(`${par}[\\s\\S]*${endpar}`),
        lookbehind: true,
        inside: {
          "rest-vars": {
            pattern: new RegExp(`&(?:rest|body)\\s+${forms}`),
            inside: arg
          },
          "other-marker-vars": {
            pattern: new RegExp(`&(?:optional|aux)\\s+${forms}`),
            inside: arg
          },
          keys: {
            pattern: new RegExp(`&key\\s+${forms}(?:\\s+&allow-other-keys)?`),
            inside: arg
          },
          argument: {
            pattern: new RegExp(symbol),
            alias: "variable"
          },
          punctuation: /[()]/
        }
      };
      language.lambda.inside.arguments = arglist;
      language.defun.inside.arguments = Prism3.util.clone(arglist);
      language.defun.inside.arguments.inside.sublist = arglist;
      Prism3.languages.lisp = language;
      Prism3.languages.elisp = language;
      Prism3.languages.emacs = language;
      Prism3.languages["emacs-lisp"] = language;
    })(Prism2);
  }
};
var livescript_default = {
  language: "livescript",
  init: (Prism2) => {
    Prism2.languages.livescript = {
      comment: [
        {
          pattern: /(^|[^\\])\/\*[\s\S]*?\*\//,
          lookbehind: true
        },
        {
          pattern: /(^|[^\\])#.*/,
          lookbehind: true
        }
      ],
      "interpolated-string": {
        pattern: /(^|[^"])("""|")(?:\\[\s\S]|(?!\2)[^\\])*\2(?!")/,
        lookbehind: true,
        greedy: true,
        inside: {
          variable: {
            pattern: /(^|[^\\])#[a-z_](?:-?[a-z]|[\d_])*/m,
            lookbehind: true
          },
          interpolation: {
            pattern: /(^|[^\\])#\{[^}]+\}/m,
            lookbehind: true,
            inside: {
              "interpolation-punctuation": {
                pattern: /^#\{|\}$/,
                alias: "variable"
              }
            }
          },
          string: /[\s\S]+/
        }
      },
      string: [
        {
          pattern: /('''|')(?:\\[\s\S]|(?!\1)[^\\])*\1/,
          greedy: true
        },
        {
          pattern: /<\[[\s\S]*?\]>/,
          greedy: true
        },
        /\\[^\s,;\])}]+/
      ],
      regex: [
        {
          pattern: /\/\/(\[.+?]|\\.|(?!\/\/)[^\\])+\/\/[gimyu]{0,5}/,
          greedy: true,
          inside: {
            comment: {
              pattern: /(^|[^\\])#.*/,
              lookbehind: true
            }
          }
        },
        {
          pattern: /\/(\[.+?]|\\.|[^/\\\r\n])+\/[gimyu]{0,5}/,
          greedy: true
        }
      ],
      keyword: {
        pattern: /(^|(?!-).)\b(?:break|case|catch|class|const|continue|default|do|else|extends|fallthrough|finally|for(?: ever)?|function|if|implements|it|let|loop|new|null|otherwise|own|return|super|switch|that|then|this|throw|try|unless|until|var|void|when|while|yield)(?!-)\b/m,
        lookbehind: true
      },
      "keyword-operator": {
        pattern: /(^|[^-])\b(?:(?:delete|require|typeof)!|(?:and|by|delete|export|from|import(?: all)?|in|instanceof|is(?:nt| not)?|not|of|or|til|to|typeof|with|xor)(?!-)\b)/m,
        lookbehind: true,
        alias: "operator"
      },
      boolean: {
        pattern: /(^|[^-])\b(?:false|no|off|on|true|yes)(?!-)\b/m,
        lookbehind: true
      },
      argument: {
        pattern: /(^|(?!\.&\.)[^&])&(?!&)\d*/m,
        lookbehind: true,
        alias: "variable"
      },
      number: /\b(?:\d+~[\da-z]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[a-z]\w*)?)/i,
      identifier: /[a-z_](?:-?[a-z]|[\d_])*/i,
      operator: [
        {
          pattern: /( )\.(?= )/,
          lookbehind: true
        },
        /\.(?:[=~]|\.\.?)|\.(?:[&|^]|<<|>>>?)\.|:(?:=|:=?)|&&|\|[|>]|<(?:<<?<?|--?!?|~~?!?|[|=?])?|>[>=?]?|-(?:->?|>)?|\+\+?|@@?|%%?|\*\*?|!(?:~?=|--?>|~?~>)?|~(?:~?>|=)?|==?|\^\^?|[\/?]/
      ],
      punctuation: /[(){}\[\]|.,:;`]/
    };
    Prism2.languages.livescript["interpolated-string"].inside.interpolation.inside.rest = Prism2.languages.livescript;
  }
};
var lolcode_default = {
  language: "lolcode",
  init: (Prism2) => {
    Prism2.languages.lolcode = {
      comment: [/\bOBTW\s+[\s\S]*?\s+TLDR\b/, /\bBTW.+/],
      string: {
        pattern: /"(?::.|[^"])*"/,
        inside: {
          variable: /:\{[^}]+\}/,
          symbol: [/:\([a-f\d]+\)/i, /:\[[^\]]+\]/, /:[)>o":]/]
        },
        greedy: true
      },
      number: /(?:\B-)?(?:\b\d+\.?\d*|\B\.\d+)/,
      symbol: {
        pattern: /(^|\s)(?:A )?(?:YARN|NUMBR|NUMBAR|TROOF|BUKKIT|NOOB)(?=\s|,|$)/,
        lookbehind: true,
        inside: {
          keyword: /A(?=\s)/
        }
      },
      label: {
        pattern: /((?:^|\s)(?:IM IN YR|IM OUTTA YR) )[a-zA-Z]\w*/,
        lookbehind: true,
        alias: "string"
      },
      function: {
        pattern: /((?:^|\s)(?:I IZ|HOW IZ I|IZ) )[a-zA-Z]\w*/,
        lookbehind: true
      },
      keyword: [
        {
          pattern: /(^|\s)(?:O HAI IM|KTHX|HAI|KTHXBYE|I HAS A|ITZ(?: A)?|R|AN|MKAY|SMOOSH|MAEK|IS NOW(?: A)?|VISIBLE|GIMMEH|O RLY\?|YA RLY|NO WAI|OIC|MEBBE|WTF\?|OMG|OMGWTF|GTFO|IM IN YR|IM OUTTA YR|FOUND YR|YR|TIL|WILE|UPPIN|NERFIN|I IZ|HOW IZ I|IF U SAY SO|SRS|HAS A|LIEK(?: A)?|IZ)(?=\s|,|$)/,
          lookbehind: true
        },
        /'Z(?=\s|,|$)/
      ],
      boolean: {
        pattern: /(^|\s)(?:WIN|FAIL)(?=\s|,|$)/,
        lookbehind: true
      },
      variable: {
        pattern: /(^|\s)IT(?=\s|,|$)/,
        lookbehind: true
      },
      operator: {
        pattern: /(^|\s)(?:NOT|BOTH SAEM|DIFFRINT|(?:SUM|DIFF|PRODUKT|QUOSHUNT|MOD|BIGGR|SMALLR|BOTH|EITHER|WON|ALL|ANY) OF)(?=\s|,|$)/,
        lookbehind: true
      },
      punctuation: /\.{3}|\u2026|,|!/
    };
  }
};
var lua_default = {
  language: "lua",
  init: (Prism2) => {
    Prism2.languages.lua = {
      comment: /^#!.+|--(?:\[(=*)\[[\s\S]*?\]\1\]|.*)/m,
      string: {
        pattern: /(["'])(?:(?!\1)[^\\\r\n]|\\z(?:\r\n|\s)|\\(?:\r\n|[\s\S]))*\1|\[(=*)\[[\s\S]*?\]\2\]/,
        greedy: true
      },
      number: /\b0x[a-f\d]+\.?[a-f\d]*(?:p[+-]?\d+)?\b|\b\d+(?:\.\B|\.?\d*(?:e[+-]?\d+)?\b)|\B\.\d+(?:e[+-]?\d+)?\b/i,
      keyword: /\b(?:and|break|do|else|elseif|end|false|for|function|goto|if|in|local|nil|not|or|repeat|return|then|true|until|while)\b/,
      function: /(?!\d)\w+(?=\s*(?:[({]))/,
      operator: [
        /[-+*%^&|#]|\/\/?|<[<=]?|>[>=]?|[=~]=?/,
        {
          pattern: /(^|[^.])\.\.(?!\.)/,
          lookbehind: true
        }
      ],
      punctuation: /[\[\](){},;]|\.+|:+/
    };
  }
};
var makefile_default = {
  language: "makefile",
  init: (Prism2) => {
    Prism2.languages.makefile = {
      comment: {
        pattern: /(^|[^\\])#(?:\\(?:\r\n|[\s\S])|[^\\\r\n])*/,
        lookbehind: true
      },
      string: {
        pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
        greedy: true
      },
      builtin: /\.[A-Z][^:#=\s]+(?=\s*:(?!=))/,
      symbol: {
        pattern: /^[^:=\r\n]+(?=\s*:(?!=))/m,
        inside: {
          variable: /\$+(?:[^(){}:#=\s]+|(?=[({]))/
        }
      },
      variable: /\$+(?:[^(){}:#=\s]+|\([@*%<^+?][DF]\)|(?=[({]))/,
      keyword: [
        /-include\b|\b(?:define|else|endef|endif|export|ifn?def|ifn?eq|include|override|private|sinclude|undefine|unexport|vpath)\b/,
        {
          pattern: /(\()(?:addsuffix|abspath|and|basename|call|dir|error|eval|file|filter(?:-out)?|findstring|firstword|flavor|foreach|guile|if|info|join|lastword|load|notdir|or|origin|patsubst|realpath|shell|sort|strip|subst|suffix|value|warning|wildcard|word(?:s|list)?)(?=[ \t])/,
          lookbehind: true
        }
      ],
      operator: /(?:::|[?:+!])?=|[|@]/,
      punctuation: /[:;(){}]/
    };
  }
};
var markdown_format_default = {
  language: "markdown",
  init: (Prism2) => {
    Prism2.languages.markdown = Prism2.languages.extend("markup", {});
    Prism2.languages.insertBefore("markdown", "prolog", {
      blockquote: {
        pattern: /^>(?:[\t ]*>)*/m,
        alias: "punctuation"
      },
      code: [
        {
          pattern: /^(?: {4}|\t).+/m,
          alias: "keyword"
        },
        {
          pattern: /``.+?``|`[^`\n]+`/,
          alias: "keyword"
        }
      ],
      title: [
        {
          pattern: /\w+.*(?:\r?\n|\r)(?:==+|--+)/,
          alias: "important",
          inside: {
            punctuation: /==+$|--+$/
          }
        },
        {
          pattern: /(^\s*)#+.+/m,
          lookbehind: true,
          alias: "important",
          inside: {
            punctuation: /^#+|#+$/
          }
        }
      ],
      hr: {
        pattern: /(^\s*)([*-])(?:[\t ]*\2){2,}(?=\s*$)/m,
        lookbehind: true,
        alias: "punctuation"
      },
      list: {
        pattern: /(^\s*)(?:[*+-]|\d+\.)(?=[\t ].)/m,
        lookbehind: true,
        alias: "punctuation"
      },
      "url-reference": {
        pattern: /!?\[[^\]]+\]:[\t ]+(?:\S+|<(?:\\.|[^>\\])+>)(?:[\t ]+(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\)))?/,
        inside: {
          variable: {
            pattern: /^(!?\[)[^\]]+/,
            lookbehind: true
          },
          string: /(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\))$/,
          punctuation: /^[\[\]!:]|[<>]/
        },
        alias: "url"
      },
      bold: {
        pattern: /(^|[^\\])(\*\*|__)(?:(?:\r?\n|\r)(?!\r?\n|\r)|.)+?\2/,
        lookbehind: true,
        inside: {
          punctuation: /^\*\*|^__|\*\*$|__$/
        }
      },
      italic: {
        pattern: /(^|[^\\])([*_])(?:(?:\r?\n|\r)(?!\r?\n|\r)|.)+?\2/,
        lookbehind: true,
        inside: {
          punctuation: /^[*_]|[*_]$/
        }
      },
      url: {
        pattern: /!?\[[^\]]+\](?:\([^\s)]+(?:[\t ]+"(?:\\.|[^"\\])*")?\)| ?\[[^\]\n]*\])/,
        inside: {
          variable: {
            pattern: /(!?\[)[^\]]+(?=\]$)/,
            lookbehind: true
          },
          string: {
            pattern: /"(?:\\.|[^"\\])*"(?=\)$)/
          }
        }
      }
    });
    Prism2.languages.markdown.bold.inside.url = Prism2.languages.markdown.url;
    Prism2.languages.markdown.italic.inside.url = Prism2.languages.markdown.url;
    Prism2.languages.markdown.bold.inside.italic = Prism2.languages.markdown.italic;
    Prism2.languages.markdown.italic.inside.bold = Prism2.languages.markdown.bold;
  }
};
var matlab_default = {
  language: "matlab",
  init: (Prism2) => {
    Prism2.languages.matlab = {
      comment: [/%\{[\s\S]*?\}%/, /%.+/],
      string: {
        pattern: /\B'(?:''|[^'\r\n])*'/,
        greedy: true
      },
      number: /(?:\b\d+\.?\d*|\B\.\d+)(?:[eE][+-]?\d+)?(?:[ij])?|\b[ij]\b/,
      keyword: /\b(?:break|case|catch|continue|else|elseif|end|for|function|if|inf|NaN|otherwise|parfor|pause|pi|return|switch|try|while)\b/,
      function: /(?!\d)\w+(?=\s*\()/,
      operator: /\.?[*^\/\\']|[+\-:@]|[<>=~]=?|&&?|\|\|?/,
      punctuation: /\.{3}|[.,;\[\](){}!]/
    };
  }
};
var mel_default = {
  language: "mel",
  init: (Prism2) => {
    Prism2.languages.mel = {
      comment: /\/\/.*/,
      code: {
        pattern: /`(?:\\.|[^\\`\r\n])*`/,
        greedy: true,
        alias: "italic",
        inside: {
          delimiter: {
            pattern: /^`|`$/,
            alias: "punctuation"
          }
        }
      },
      string: {
        pattern: /"(?:\\.|[^\\"\r\n])*"/,
        greedy: true
      },
      variable: /\$\w+/,
      number: /\b0x[\da-fA-F]+\b|\b\d+\.?\d*|\B\.\d+/,
      flag: {
        pattern: /-[^\d\W]\w*/,
        alias: "operator"
      },
      keyword: /\b(?:break|case|continue|default|do|else|float|for|global|if|in|int|matrix|proc|return|string|switch|vector|while)\b/,
      function: /\w+(?=\()|\b(?:about|abs|addAttr|addAttributeEditorNodeHelp|addDynamic|addNewShelfTab|addPP|addPanelCategory|addPrefixToName|advanceToNextDrivenKey|affectedNet|affects|aimConstraint|air|alias|aliasAttr|align|alignCtx|alignCurve|alignSurface|allViewFit|ambientLight|angle|angleBetween|animCone|animCurveEditor|animDisplay|animView|annotate|appendStringArray|applicationName|applyAttrPreset|applyTake|arcLenDimContext|arcLengthDimension|arclen|arrayMapper|art3dPaintCtx|artAttrCtx|artAttrPaintVertexCtx|artAttrSkinPaintCtx|artAttrTool|artBuildPaintMenu|artFluidAttrCtx|artPuttyCtx|artSelectCtx|artSetPaintCtx|artUserPaintCtx|assignCommand|assignInputDevice|assignViewportFactories|attachCurve|attachDeviceAttr|attachSurface|attrColorSliderGrp|attrCompatibility|attrControlGrp|attrEnumOptionMenu|attrEnumOptionMenuGrp|attrFieldGrp|attrFieldSliderGrp|attrNavigationControlGrp|attrPresetEditWin|attributeExists|attributeInfo|attributeMenu|attributeQuery|autoKeyframe|autoPlace|bakeClip|bakeFluidShading|bakePartialHistory|bakeResults|bakeSimulation|basename|basenameEx|batchRender|bessel|bevel|bevelPlus|binMembership|bindSkin|blend2|blendShape|blendShapeEditor|blendShapePanel|blendTwoAttr|blindDataType|boneLattice|boundary|boxDollyCtx|boxZoomCtx|bufferCurve|buildBookmarkMenu|buildKeyframeMenu|button|buttonManip|CBG|cacheFile|cacheFileCombine|cacheFileMerge|cacheFileTrack|camera|cameraView|canCreateManip|canvas|capitalizeString|catch|catchQuiet|ceil|changeSubdivComponentDisplayLevel|changeSubdivRegion|channelBox|character|characterMap|characterOutlineEditor|characterize|chdir|checkBox|checkBoxGrp|checkDefaultRenderGlobals|choice|circle|circularFillet|clamp|clear|clearCache|clip|clipEditor|clipEditorCurrentTimeCtx|clipSchedule|clipSchedulerOutliner|clipTrimBefore|closeCurve|closeSurface|cluster|cmdFileOutput|cmdScrollFieldExecuter|cmdScrollFieldReporter|cmdShell|coarsenSubdivSelectionList|collision|color|colorAtPoint|colorEditor|colorIndex|colorIndexSliderGrp|colorSliderButtonGrp|colorSliderGrp|columnLayout|commandEcho|commandLine|commandPort|compactHairSystem|componentEditor|compositingInterop|computePolysetVolume|condition|cone|confirmDialog|connectAttr|connectControl|connectDynamic|connectJoint|connectionInfo|constrain|constrainValue|constructionHistory|container|containsMultibyte|contextInfo|control|convertFromOldLayers|convertIffToPsd|convertLightmap|convertSolidTx|convertTessellation|convertUnit|copyArray|copyFlexor|copyKey|copySkinWeights|cos|cpButton|cpCache|cpClothSet|cpCollision|cpConstraint|cpConvClothToMesh|cpForces|cpGetSolverAttr|cpPanel|cpProperty|cpRigidCollisionFilter|cpSeam|cpSetEdit|cpSetSolverAttr|cpSolver|cpSolverTypes|cpTool|cpUpdateClothUVs|createDisplayLayer|createDrawCtx|createEditor|createLayeredPsdFile|createMotionField|createNewShelf|createNode|createRenderLayer|createSubdivRegion|cross|crossProduct|ctxAbort|ctxCompletion|ctxEditMode|ctxTraverse|currentCtx|currentTime|currentTimeCtx|currentUnit|curve|curveAddPtCtx|curveCVCtx|curveEPCtx|curveEditorCtx|curveIntersect|curveMoveEPCtx|curveOnSurface|curveSketchCtx|cutKey|cycleCheck|cylinder|dagPose|date|defaultLightListCheckBox|defaultNavigation|defineDataServer|defineVirtualDevice|deformer|deg_to_rad|delete|deleteAttr|deleteShadingGroupsAndMaterials|deleteShelfTab|deleteUI|deleteUnusedBrushes|delrandstr|detachCurve|detachDeviceAttr|detachSurface|deviceEditor|devicePanel|dgInfo|dgdirty|dgeval|dgtimer|dimWhen|directKeyCtx|directionalLight|dirmap|dirname|disable|disconnectAttr|disconnectJoint|diskCache|displacementToPoly|displayAffected|displayColor|displayCull|displayLevelOfDetail|displayPref|displayRGBColor|displaySmoothness|displayStats|displayString|displaySurface|distanceDimContext|distanceDimension|doBlur|dolly|dollyCtx|dopeSheetEditor|dot|dotProduct|doubleProfileBirailSurface|drag|dragAttrContext|draggerContext|dropoffLocator|duplicate|duplicateCurve|duplicateSurface|dynCache|dynControl|dynExport|dynExpression|dynGlobals|dynPaintEditor|dynParticleCtx|dynPref|dynRelEdPanel|dynRelEditor|dynamicLoad|editAttrLimits|editDisplayLayerGlobals|editDisplayLayerMembers|editRenderLayerAdjustment|editRenderLayerGlobals|editRenderLayerMembers|editor|editorTemplate|effector|emit|emitter|enableDevice|encodeString|endString|endsWith|env|equivalent|equivalentTol|erf|error|eval|evalDeferred|evalEcho|event|exactWorldBoundingBox|exclusiveLightCheckBox|exec|executeForEachObject|exists|exp|expression|expressionEditorListen|extendCurve|extendSurface|extrude|fcheck|fclose|feof|fflush|fgetline|fgetword|file|fileBrowserDialog|fileDialog|fileExtension|fileInfo|filetest|filletCurve|filter|filterCurve|filterExpand|filterStudioImport|findAllIntersections|findAnimCurves|findKeyframe|findMenuItem|findRelatedSkinCluster|finder|firstParentOf|fitBspline|flexor|floatEq|floatField|floatFieldGrp|floatScrollBar|floatSlider|floatSlider2|floatSliderButtonGrp|floatSliderGrp|floor|flow|fluidCacheInfo|fluidEmitter|fluidVoxelInfo|flushUndo|fmod|fontDialog|fopen|formLayout|format|fprint|frameLayout|fread|freeFormFillet|frewind|fromNativePath|fwrite|gamma|gauss|geometryConstraint|getApplicationVersionAsFloat|getAttr|getClassification|getDefaultBrush|getFileList|getFluidAttr|getInputDeviceRange|getMayaPanelTypes|getModifiers|getPanel|getParticleAttr|getPluginResource|getenv|getpid|glRender|glRenderEditor|globalStitch|gmatch|goal|gotoBindPose|grabColor|gradientControl|gradientControlNoAttr|graphDollyCtx|graphSelectContext|graphTrackCtx|gravity|grid|gridLayout|group|groupObjectsByName|HfAddAttractorToAS|HfAssignAS|HfBuildEqualMap|HfBuildFurFiles|HfBuildFurImages|HfCancelAFR|HfConnectASToHF|HfCreateAttractor|HfDeleteAS|HfEditAS|HfPerformCreateAS|HfRemoveAttractorFromAS|HfSelectAttached|HfSelectAttractors|HfUnAssignAS|hardenPointCurve|hardware|hardwareRenderPanel|headsUpDisplay|headsUpMessage|help|helpLine|hermite|hide|hilite|hitTest|hotBox|hotkey|hotkeyCheck|hsv_to_rgb|hudButton|hudSlider|hudSliderButton|hwReflectionMap|hwRender|hwRenderLoad|hyperGraph|hyperPanel|hyperShade|hypot|iconTextButton|iconTextCheckBox|iconTextRadioButton|iconTextRadioCollection|iconTextScrollList|iconTextStaticLabel|ikHandle|ikHandleCtx|ikHandleDisplayScale|ikSolver|ikSplineHandleCtx|ikSystem|ikSystemInfo|ikfkDisplayMethod|illustratorCurves|image|imfPlugins|inheritTransform|insertJoint|insertJointCtx|insertKeyCtx|insertKnotCurve|insertKnotSurface|instance|instanceable|instancer|intField|intFieldGrp|intScrollBar|intSlider|intSliderGrp|interToUI|internalVar|intersect|iprEngine|isAnimCurve|isConnected|isDirty|isParentOf|isSameObject|isTrue|isValidObjectName|isValidString|isValidUiName|isolateSelect|itemFilter|itemFilterAttr|itemFilterRender|itemFilterType|joint|jointCluster|jointCtx|jointDisplayScale|jointLattice|keyTangent|keyframe|keyframeOutliner|keyframeRegionCurrentTimeCtx|keyframeRegionDirectKeyCtx|keyframeRegionDollyCtx|keyframeRegionInsertKeyCtx|keyframeRegionMoveKeyCtx|keyframeRegionScaleKeyCtx|keyframeRegionSelectKeyCtx|keyframeRegionSetKeyCtx|keyframeRegionTrackCtx|keyframeStats|lassoContext|lattice|latticeDeformKeyCtx|launch|launchImageEditor|layerButton|layeredShaderPort|layeredTexturePort|layout|layoutDialog|lightList|lightListEditor|lightListPanel|lightlink|lineIntersection|linearPrecision|linstep|listAnimatable|listAttr|listCameras|listConnections|listDeviceAttachments|listHistory|listInputDeviceAxes|listInputDeviceButtons|listInputDevices|listMenuAnnotation|listNodeTypes|listPanelCategories|listRelatives|listSets|listTransforms|listUnselected|listerEditor|loadFluid|loadNewShelf|loadPlugin|loadPluginLanguageResources|loadPrefObjects|localizedPanelLabel|lockNode|loft|log|longNameOf|lookThru|ls|lsThroughFilter|lsType|lsUI|Mayatomr|mag|makeIdentity|makeLive|makePaintable|makeRoll|makeSingleSurface|makeTubeOn|makebot|manipMoveContext|manipMoveLimitsCtx|manipOptions|manipRotateContext|manipRotateLimitsCtx|manipScaleContext|manipScaleLimitsCtx|marker|match|max|memory|menu|menuBarLayout|menuEditor|menuItem|menuItemToShelf|menuSet|menuSetPref|messageLine|min|minimizeApp|mirrorJoint|modelCurrentTimeCtx|modelEditor|modelPanel|mouse|movIn|movOut|move|moveIKtoFK|moveKeyCtx|moveVertexAlongDirection|multiProfileBirailSurface|mute|nParticle|nameCommand|nameField|namespace|namespaceInfo|newPanelItems|newton|nodeCast|nodeIconButton|nodeOutliner|nodePreset|nodeType|noise|nonLinear|normalConstraint|normalize|nurbsBoolean|nurbsCopyUVSet|nurbsCube|nurbsEditUV|nurbsPlane|nurbsSelect|nurbsSquare|nurbsToPoly|nurbsToPolygonsPref|nurbsToSubdiv|nurbsToSubdivPref|nurbsUVSet|nurbsViewDirectionVector|objExists|objectCenter|objectLayer|objectType|objectTypeUI|obsoleteProc|oceanNurbsPreviewPlane|offsetCurve|offsetCurveOnSurface|offsetSurface|openGLExtension|openMayaPref|optionMenu|optionMenuGrp|optionVar|orbit|orbitCtx|orientConstraint|outlinerEditor|outlinerPanel|overrideModifier|paintEffectsDisplay|pairBlend|palettePort|paneLayout|panel|panelConfiguration|panelHistory|paramDimContext|paramDimension|paramLocator|parent|parentConstraint|particle|particleExists|particleInstancer|particleRenderInfo|partition|pasteKey|pathAnimation|pause|pclose|percent|performanceOptions|pfxstrokes|pickWalk|picture|pixelMove|planarSrf|plane|play|playbackOptions|playblast|plugAttr|plugNode|pluginInfo|pluginResourceUtil|pointConstraint|pointCurveConstraint|pointLight|pointMatrixMult|pointOnCurve|pointOnSurface|pointPosition|poleVectorConstraint|polyAppend|polyAppendFacetCtx|polyAppendVertex|polyAutoProjection|polyAverageNormal|polyAverageVertex|polyBevel|polyBlendColor|polyBlindData|polyBoolOp|polyBridgeEdge|polyCacheMonitor|polyCheck|polyChipOff|polyClipboard|polyCloseBorder|polyCollapseEdge|polyCollapseFacet|polyColorBlindData|polyColorDel|polyColorPerVertex|polyColorSet|polyCompare|polyCone|polyCopyUV|polyCrease|polyCreaseCtx|polyCreateFacet|polyCreateFacetCtx|polyCube|polyCut|polyCutCtx|polyCylinder|polyCylindricalProjection|polyDelEdge|polyDelFacet|polyDelVertex|polyDuplicateAndConnect|polyDuplicateEdge|polyEditUV|polyEditUVShell|polyEvaluate|polyExtrudeEdge|polyExtrudeFacet|polyExtrudeVertex|polyFlipEdge|polyFlipUV|polyForceUV|polyGeoSampler|polyHelix|polyInfo|polyInstallAction|polyLayoutUV|polyListComponentConversion|polyMapCut|polyMapDel|polyMapSew|polyMapSewMove|polyMergeEdge|polyMergeEdgeCtx|polyMergeFacet|polyMergeFacetCtx|polyMergeUV|polyMergeVertex|polyMirrorFace|polyMoveEdge|polyMoveFacet|polyMoveFacetUV|polyMoveUV|polyMoveVertex|polyNormal|polyNormalPerVertex|polyNormalizeUV|polyOptUvs|polyOptions|polyOutput|polyPipe|polyPlanarProjection|polyPlane|polyPlatonicSolid|polyPoke|polyPrimitive|polyPrism|polyProjection|polyPyramid|polyQuad|polyQueryBlindData|polyReduce|polySelect|polySelectConstraint|polySelectConstraintMonitor|polySelectCtx|polySelectEditCtx|polySeparate|polySetToFaceNormal|polySewEdge|polyShortestPathCtx|polySmooth|polySoftEdge|polySphere|polySphericalProjection|polySplit|polySplitCtx|polySplitEdge|polySplitRing|polySplitVertex|polyStraightenUVBorder|polySubdivideEdge|polySubdivideFacet|polyToSubdiv|polyTorus|polyTransfer|polyTriangulate|polyUVSet|polyUnite|polyWedgeFace|popen|popupMenu|pose|pow|preloadRefEd|print|progressBar|progressWindow|projFileViewer|projectCurve|projectTangent|projectionContext|projectionManip|promptDialog|propModCtx|propMove|psdChannelOutliner|psdEditTextureFile|psdExport|psdTextureFile|putenv|pwd|python|querySubdiv|quit|rad_to_deg|radial|radioButton|radioButtonGrp|radioCollection|radioMenuItemCollection|rampColorPort|rand|randomizeFollicles|randstate|rangeControl|readTake|rebuildCurve|rebuildSurface|recordAttr|recordDevice|redo|reference|referenceEdit|referenceQuery|refineSubdivSelectionList|refresh|refreshAE|registerPluginResource|rehash|reloadImage|removeJoint|removeMultiInstance|removePanelCategory|rename|renameAttr|renameSelectionList|renameUI|render|renderGlobalsNode|renderInfo|renderLayerButton|renderLayerParent|renderLayerPostProcess|renderLayerUnparent|renderManip|renderPartition|renderQualityNode|renderSettings|renderThumbnailUpdate|renderWindowEditor|renderWindowSelectContext|renderer|reorder|reorderDeformers|requires|reroot|resampleFluid|resetAE|resetPfxToPolyCamera|resetTool|resolutionNode|retarget|reverseCurve|reverseSurface|revolve|rgb_to_hsv|rigidBody|rigidSolver|roll|rollCtx|rootOf|rot|rotate|rotationInterpolation|roundConstantRadius|rowColumnLayout|rowLayout|runTimeCommand|runup|sampleImage|saveAllShelves|saveAttrPreset|saveFluid|saveImage|saveInitialState|saveMenu|savePrefObjects|savePrefs|saveShelf|saveToolSettings|scale|scaleBrushBrightness|scaleComponents|scaleConstraint|scaleKey|scaleKeyCtx|sceneEditor|sceneUIReplacement|scmh|scriptCtx|scriptEditorInfo|scriptJob|scriptNode|scriptTable|scriptToShelf|scriptedPanel|scriptedPanelType|scrollField|scrollLayout|sculpt|searchPathArray|seed|selLoadSettings|select|selectContext|selectCurveCV|selectKey|selectKeyCtx|selectKeyframeRegionCtx|selectMode|selectPref|selectPriority|selectType|selectedNodes|selectionConnection|separator|setAttr|setAttrEnumResource|setAttrMapping|setAttrNiceNameResource|setConstraintRestPosition|setDefaultShadingGroup|setDrivenKeyframe|setDynamic|setEditCtx|setEditor|setFluidAttr|setFocus|setInfinity|setInputDeviceMapping|setKeyCtx|setKeyPath|setKeyframe|setKeyframeBlendshapeTargetWts|setMenuMode|setNodeNiceNameResource|setNodeTypeFlag|setParent|setParticleAttr|setPfxToPolyCamera|setPluginResource|setProject|setStampDensity|setStartupMessage|setState|setToolTo|setUITemplate|setXformManip|sets|shadingConnection|shadingGeometryRelCtx|shadingLightRelCtx|shadingNetworkCompare|shadingNode|shapeCompare|shelfButton|shelfLayout|shelfTabLayout|shellField|shortNameOf|showHelp|showHidden|showManipCtx|showSelectionInTitle|showShadingGroupAttrEditor|showWindow|sign|simplify|sin|singleProfileBirailSurface|size|sizeBytes|skinCluster|skinPercent|smoothCurve|smoothTangentSurface|smoothstep|snap2to2|snapKey|snapMode|snapTogetherCtx|snapshot|soft|softMod|softModCtx|sort|sound|soundControl|source|spaceLocator|sphere|sphrand|spotLight|spotLightPreviewPort|spreadSheetEditor|spring|sqrt|squareSurface|srtContext|stackTrace|startString|startsWith|stitchAndExplodeShell|stitchSurface|stitchSurfacePoints|strcmp|stringArrayCatenate|stringArrayContains|stringArrayCount|stringArrayInsertAtIndex|stringArrayIntersector|stringArrayRemove|stringArrayRemoveAtIndex|stringArrayRemoveDuplicates|stringArrayRemoveExact|stringArrayToString|stringToStringArray|strip|stripPrefixFromName|stroke|subdAutoProjection|subdCleanTopology|subdCollapse|subdDuplicateAndConnect|subdEditUV|subdListComponentConversion|subdMapCut|subdMapSewMove|subdMatchTopology|subdMirror|subdToBlind|subdToPoly|subdTransferUVsToCache|subdiv|subdivCrease|subdivDisplaySmoothness|substitute|substituteAllString|substituteGeometry|substring|surface|surfaceSampler|surfaceShaderList|swatchDisplayPort|switchTable|symbolButton|symbolCheckBox|sysFile|system|tabLayout|tan|tangentConstraint|texLatticeDeformContext|texManipContext|texMoveContext|texMoveUVShellContext|texRotateContext|texScaleContext|texSelectContext|texSelectShortestPathCtx|texSmudgeUVContext|texWinToolCtx|text|textCurves|textField|textFieldButtonGrp|textFieldGrp|textManip|textScrollList|textToShelf|textureDisplacePlane|textureHairColor|texturePlacementContext|textureWindow|threadCount|threePointArcCtx|timeControl|timePort|timerX|toNativePath|toggle|toggleAxis|toggleWindowVisibility|tokenize|tokenizeList|tolerance|tolower|toolButton|toolCollection|toolDropped|toolHasOptions|toolPropertyWindow|torus|toupper|trace|track|trackCtx|transferAttributes|transformCompare|transformLimits|translator|trim|trunc|truncateFluidCache|truncateHairCache|tumble|tumbleCtx|turbulence|twoPointArcCtx|uiRes|uiTemplate|unassignInputDevice|undo|undoInfo|ungroup|uniform|unit|unloadPlugin|untangleUV|untitledFileName|untrim|upAxis|updateAE|userCtx|uvLink|uvSnapshot|validateShelfName|vectorize|view2dToolCtx|viewCamera|viewClipPlane|viewFit|viewHeadOn|viewLookAt|viewManip|viewPlace|viewSet|visor|volumeAxis|vortex|waitCursor|warning|webBrowser|webBrowserPrefs|whatIs|window|windowPref|wire|wireContext|workspace|wrinkle|wrinkleContext|writeTake|xbmLangPathList|xform)\b/,
      operator: [
        /\+[+=]?|-[-=]?|&&|\|\||[<>]=|[*\/!=]=?|[%^]/,
        {
          pattern: /(^|[^<])<(?!<)/,
          lookbehind: true
        },
        {
          pattern: /(^|[^>])>(?!>)/,
          lookbehind: true
        }
      ],
      punctuation: /<<|>>|[.,:;?\[\](){}]/
    };
    Prism2.languages.mel.code.inside.rest = Prism2.languages.mel;
  }
};
var mizar_default = {
  language: "mizar",
  init: (Prism2) => {
    Prism2.languages.mizar = {
      comment: /::.+/,
      keyword: /@proof\b|\b(?:according|aggregate|all|and|antonym|are|as|associativity|assume|asymmetry|attr|be|begin|being|by|canceled|case|cases|clusters?|coherence|commutativity|compatibility|connectedness|consider|consistency|constructors|contradiction|correctness|def|deffunc|define|definitions?|defpred|do|does|equals|end|environ|ex|exactly|existence|for|from|func|given|hence|hereby|holds|idempotence|identity|iff?|implies|involutiveness|irreflexivity|is|it|let|means|mode|non|not|notations?|now|of|or|otherwise|over|per|pred|prefix|projectivity|proof|provided|qua|reconsider|redefine|reduce|reducibility|reflexivity|registrations?|requirements|reserve|sch|schemes?|section|selector|set|sethood|st|struct|such|suppose|symmetry|synonym|take|that|the|then|theorems?|thesis|thus|to|transitivity|uniqueness|vocabular(?:y|ies)|when|where|with|wrt)\b/,
      parameter: {
        pattern: /\$(?:10|\d)/,
        alias: "variable"
      },
      variable: /\w+(?=:)/,
      number: /(?:\b|-)\d+\b/,
      operator: /\.\.\.|->|&|\.?=/,
      punctuation: /\(#|#\)|[,:;\[\](){}]/
    };
  }
};
var monkey_default = {
  language: "monkey",
  init: (Prism2) => {
    Prism2.languages.monkey = {
      string: /"[^"\r\n]*"/,
      comment: [
        {
          pattern: /^#Rem\s+[\s\S]*?^#End/im,
          greedy: true
        },
        {
          pattern: /'.+/,
          greedy: true
        }
      ],
      preprocessor: {
        pattern: /(^[ \t]*)#.+/m,
        lookbehind: true,
        alias: "comment"
      },
      function: /\w+(?=\()/,
      "type-char": {
        pattern: /(\w)[?%#$]/,
        lookbehind: true,
        alias: "variable"
      },
      number: {
        pattern: /((?:\.\.)?)(?:(?:\b|\B-\.?|\B\.)\d+(?:(?!\.\.)\.\d*)?|\$[\da-f]+)/i,
        lookbehind: true
      },
      keyword: /\b(?:Void|Strict|Public|Private|Property|Bool|Int|Float|String|Array|Object|Continue|Exit|Import|Extern|New|Self|Super|Try|Catch|Eachin|True|False|Extends|Abstract|Final|Select|Case|Default|Const|Local|Global|Field|Method|Function|Class|End|If|Then|Else|ElseIf|EndIf|While|Wend|Repeat|Until|Forever|For|To|Step|Next|Return|Module|Interface|Implements|Inline|Throw|Null)\b/i,
      operator: /\.\.|<[=>]?|>=?|:?=|(?:[+\-*\/&~|]|\b(?:Mod|Shl|Shr)\b)=?|\b(?:And|Not|Or)\b/i,
      punctuation: /[.,:;()\[\]]/
    };
  }
};
var nasm_default = {
  language: "nasm",
  init: (Prism2) => {
    Prism2.languages.nasm = {
      comment: /;.*$/m,
      string: /(["'`])(?:\\.|(?!\1)[^\\\r\n])*\1/,
      label: {
        pattern: /(^\s*)[A-Za-z._?$][\w.?$@~#]*:/m,
        lookbehind: true,
        alias: "function"
      },
      keyword: [
        /\[?BITS (?:16|32|64)\]?/,
        {
          pattern: /(^\s*)section\s*[a-zA-Z.]+:?/im,
          lookbehind: true
        },
        /(?:extern|global)[^;\r\n]*/i,
        /(?:CPU|FLOAT|DEFAULT).*$/m
      ],
      register: {
        pattern: /\b(?:st\d|[xyz]mm\d\d?|[cdt]r\d|r\d\d?[bwd]?|[er]?[abcd]x|[abcd][hl]|[er]?(?:bp|sp|si|di)|[cdefgs]s)\b/i,
        alias: "variable"
      },
      number: /(?:\b|(?=\$))(?:0[hx][\da-f]*\.?[\da-f]+(?:p[+-]?\d+)?|\d[\da-f]+[hx]|\$\d[\da-f]*|0[oq][0-7]+|[0-7]+[oq]|0[by][01]+|[01]+[by]|0[dt]\d+|\d*\.?\d+(?:\.?e[+-]?\d+)?[dt]?)\b/i,
      operator: /[\[\]*+\-\/%<>=&|$!]/
    };
  }
};
var nginx_default = {
  language: "nginx",
  init: (Prism2) => {
    Prism2.languages.nginx = Prism2.languages.extend("clike", {
      comment: {
        pattern: /(^|[^"{\\])#.*/,
        lookbehind: true
      },
      keyword: /\b(?:CONTENT_|DOCUMENT_|GATEWAY_|HTTP_|HTTPS|if_not_empty|PATH_|QUERY_|REDIRECT_|REMOTE_|REQUEST_|SCGI|SCRIPT_|SERVER_|http|events|accept_mutex|accept_mutex_delay|access_log|add_after_body|add_before_body|add_header|addition_types|aio|alias|allow|ancient_browser|ancient_browser_value|auth|auth_basic|auth_basic_user_file|auth_http|auth_http_header|auth_http_timeout|autoindex|autoindex_exact_size|autoindex_localtime|break|charset|charset_map|charset_types|chunked_transfer_encoding|client_body_buffer_size|client_body_in_file_only|client_body_in_single_buffer|client_body_temp_path|client_body_timeout|client_header_buffer_size|client_header_timeout|client_max_body_size|connection_pool_size|create_full_put_path|daemon|dav_access|dav_methods|debug_connection|debug_points|default_type|deny|devpoll_changes|devpoll_events|directio|directio_alignment|disable_symlinks|empty_gif|env|epoll_events|error_log|error_page|expires|fastcgi_buffer_size|fastcgi_buffers|fastcgi_busy_buffers_size|fastcgi_cache|fastcgi_cache_bypass|fastcgi_cache_key|fastcgi_cache_lock|fastcgi_cache_lock_timeout|fastcgi_cache_methods|fastcgi_cache_min_uses|fastcgi_cache_path|fastcgi_cache_purge|fastcgi_cache_use_stale|fastcgi_cache_valid|fastcgi_connect_timeout|fastcgi_hide_header|fastcgi_ignore_client_abort|fastcgi_ignore_headers|fastcgi_index|fastcgi_intercept_errors|fastcgi_keep_conn|fastcgi_max_temp_file_size|fastcgi_next_upstream|fastcgi_no_cache|fastcgi_param|fastcgi_pass|fastcgi_pass_header|fastcgi_read_timeout|fastcgi_redirect_errors|fastcgi_send_timeout|fastcgi_split_path_info|fastcgi_store|fastcgi_store_access|fastcgi_temp_file_write_size|fastcgi_temp_path|flv|geo|geoip_city|geoip_country|google_perftools_profiles|gzip|gzip_buffers|gzip_comp_level|gzip_disable|gzip_http_version|gzip_min_length|gzip_proxied|gzip_static|gzip_types|gzip_vary|if|if_modified_since|ignore_invalid_headers|image_filter|image_filter_buffer|image_filter_jpeg_quality|image_filter_sharpen|image_filter_transparency|imap_capabilities|imap_client_buffer|include|index|internal|ip_hash|keepalive|keepalive_disable|keepalive_requests|keepalive_timeout|kqueue_changes|kqueue_events|large_client_header_buffers|limit_conn|limit_conn_log_level|limit_conn_zone|limit_except|limit_rate|limit_rate_after|limit_req|limit_req_log_level|limit_req_zone|limit_zone|lingering_close|lingering_time|lingering_timeout|listen|location|lock_file|log_format|log_format_combined|log_not_found|log_subrequest|map|map_hash_bucket_size|map_hash_max_size|master_process|max_ranges|memcached_buffer_size|memcached_connect_timeout|memcached_next_upstream|memcached_pass|memcached_read_timeout|memcached_send_timeout|merge_slashes|min_delete_depth|modern_browser|modern_browser_value|mp4|mp4_buffer_size|mp4_max_buffer_size|msie_padding|msie_refresh|multi_accept|open_file_cache|open_file_cache_errors|open_file_cache_min_uses|open_file_cache_valid|open_log_file_cache|optimize_server_names|override_charset|pcre_jit|perl|perl_modules|perl_require|perl_set|pid|pop3_auth|pop3_capabilities|port_in_redirect|post_action|postpone_output|protocol|proxy|proxy_buffer|proxy_buffer_size|proxy_buffering|proxy_buffers|proxy_busy_buffers_size|proxy_cache|proxy_cache_bypass|proxy_cache_key|proxy_cache_lock|proxy_cache_lock_timeout|proxy_cache_methods|proxy_cache_min_uses|proxy_cache_path|proxy_cache_use_stale|proxy_cache_valid|proxy_connect_timeout|proxy_cookie_domain|proxy_cookie_path|proxy_headers_hash_bucket_size|proxy_headers_hash_max_size|proxy_hide_header|proxy_http_version|proxy_ignore_client_abort|proxy_ignore_headers|proxy_intercept_errors|proxy_max_temp_file_size|proxy_method|proxy_next_upstream|proxy_no_cache|proxy_pass|proxy_pass_error_message|proxy_pass_header|proxy_pass_request_body|proxy_pass_request_headers|proxy_read_timeout|proxy_redirect|proxy_redirect_errors|proxy_send_lowat|proxy_send_timeout|proxy_set_body|proxy_set_header|proxy_ssl_session_reuse|proxy_store|proxy_store_access|proxy_temp_file_write_size|proxy_temp_path|proxy_timeout|proxy_upstream_fail_timeout|proxy_upstream_max_fails|random_index|read_ahead|real_ip_header|recursive_error_pages|request_pool_size|reset_timedout_connection|resolver|resolver_timeout|return|rewrite|root|rtsig_overflow_events|rtsig_overflow_test|rtsig_overflow_threshold|rtsig_signo|satisfy|satisfy_any|secure_link_secret|send_lowat|send_timeout|sendfile|sendfile_max_chunk|server|server_name|server_name_in_redirect|server_names_hash_bucket_size|server_names_hash_max_size|server_tokens|set|set_real_ip_from|smtp_auth|smtp_capabilities|so_keepalive|source_charset|split_clients|ssi|ssi_silent_errors|ssi_types|ssi_value_length|ssl|ssl_certificate|ssl_certificate_key|ssl_ciphers|ssl_client_certificate|ssl_crl|ssl_dhparam|ssl_engine|ssl_prefer_server_ciphers|ssl_protocols|ssl_session_cache|ssl_session_timeout|ssl_verify_client|ssl_verify_depth|starttls|stub_status|sub_filter|sub_filter_once|sub_filter_types|tcp_nodelay|tcp_nopush|timeout|timer_resolution|try_files|types|types_hash_bucket_size|types_hash_max_size|underscores_in_headers|uninitialized_variable_warn|upstream|use|user|userid|userid_domain|userid_expires|userid_name|userid_p3p|userid_path|userid_service|valid_referers|variables_hash_bucket_size|variables_hash_max_size|worker_connections|worker_cpu_affinity|worker_priority|worker_processes|worker_rlimit_core|worker_rlimit_nofile|worker_rlimit_sigpending|working_directory|xclient|xml_entities|xslt_entities|xslt_stylesheet|xslt_types)\b/i
    });
    Prism2.languages.insertBefore("nginx", "keyword", {
      variable: /\$[a-z_]+/i
    });
  }
};
var nim_default = {
  language: "nim",
  init: (Prism2) => {
    Prism2.languages.nim = {
      comment: /#.*/,
      string: {
        pattern: /(?:(?:\b(?!\d)(?:\w|\\x[8-9a-fA-F][0-9a-fA-F])+)?(?:"""[\s\S]*?"""(?!")|"(?:\\[\s\S]|""|[^"\\])*")|'(?:\\(?:\d+|x[\da-fA-F]{2}|.)|[^'])')/,
        greedy: true
      },
      number: /\b(?:0[xXoObB][\da-fA-F_]+|\d[\d_]*(?:(?!\.\.)\.[\d_]*)?(?:[eE][+-]?\d[\d_]*)?)(?:'?[iuf]\d*)?/,
      keyword: /\b(?:addr|as|asm|atomic|bind|block|break|case|cast|concept|const|continue|converter|defer|discard|distinct|do|elif|else|end|enum|except|export|finally|for|from|func|generic|if|import|include|interface|iterator|let|macro|method|mixin|nil|object|out|proc|ptr|raise|ref|return|static|template|try|tuple|type|using|var|when|while|with|without|yield)\b/,
      function: {
        pattern: /(?:(?!\d)(?:\w|\\x[8-9a-fA-F][0-9a-fA-F])+|`[^`\r\n]+`)\*?(?:\[[^\]]+\])?(?=\s*\()/,
        inside: {
          operator: /\*$/
        }
      },
      ignore: {
        pattern: /`[^`\r\n]+`/,
        inside: {
          punctuation: /`/
        }
      },
      operator: {
        pattern: /(^|[({\[](?=\.\.)|(?![({\[]\.).)(?:(?:[=+\-*\/<>@$~&%|!?^:\\]|\.\.|\.(?![)}\]]))+|\b(?:and|div|of|or|in|is|isnot|mod|not|notin|shl|shr|xor)\b)/m,
        lookbehind: true
      },
      punctuation: /[({\[]\.|\.[)}\]]|[`(){}\[\],:]/
    };
  }
};
var nix_default = {
  language: "nix",
  init: (Prism2) => {
    Prism2.languages.nix = {
      comment: /\/\*[\s\S]*?\*\/|#.*/,
      string: {
        pattern: /"(?:[^"\\]|\\[\s\S])*"|''(?:(?!'')[\s\S]|''(?:'|\\|\$\{))*''/,
        greedy: true,
        inside: {
          interpolation: {
            pattern: /(^|(?:^|(?!'').)[^\\])\$\{(?:[^}]|\{[^}]*\})*}/,
            lookbehind: true,
            inside: {
              antiquotation: {
                pattern: /^\$(?=\{)/,
                alias: "variable"
              }
            }
          }
        }
      },
      url: [
        /\b(?:[a-z]{3,7}:\/\/)[\w\-+%~\/.:#=?&]+/,
        {
          pattern: /([^\/])(?:[\w\-+%~.:#=?&]*(?!\/\/)[\w\-+%~\/.:#=?&])?(?!\/\/)\/[\w\-+%~\/.:#=?&]*/,
          lookbehind: true
        }
      ],
      antiquotation: {
        pattern: /\$(?=\{)/,
        alias: "variable"
      },
      number: /\b\d+\b/,
      keyword: /\b(?:assert|builtins|else|if|in|inherit|let|null|or|then|with)\b/,
      function: /\b(?:abort|add|all|any|attrNames|attrValues|baseNameOf|compareVersions|concatLists|currentSystem|deepSeq|derivation|dirOf|div|elem(?:At)?|fetch(?:url|Tarball)|filter(?:Source)?|fromJSON|genList|getAttr|getEnv|hasAttr|hashString|head|import|intersectAttrs|is(?:Attrs|Bool|Function|Int|List|Null|String)|length|lessThan|listToAttrs|map|mul|parseDrvName|pathExists|read(?:Dir|File)|removeAttrs|replaceStrings|seq|sort|stringLength|sub(?:string)?|tail|throw|to(?:File|JSON|Path|String|XML)|trace|typeOf)\b|\bfoldl'\B/,
      boolean: /\b(?:true|false)\b/,
      operator: /[=!<>]=?|\+\+?|\|\||&&|\/\/|->?|[?@]/,
      punctuation: /[{}()[\].,:;]/
    };
    Prism2.languages.nix.string.inside.interpolation.inside.rest = Prism2.languages.nix;
  }
};
var nsis_default = {
  language: "nsis",
  init: (Prism2) => {
    Prism2.languages.nsis = {
      comment: {
        pattern: /(^|[^\\])(\/\*[\s\S]*?\*\/|[#;].*)/,
        lookbehind: true
      },
      string: {
        pattern: /("|')(?:\\.|(?!\1)[^\\\r\n])*\1/,
        greedy: true
      },
      keyword: {
        pattern: /(^\s*)(?:Abort|Add(?:BrandingImage|Size)|AdvSplash|Allow(?:RootDirInstall|SkipFiles)|AutoCloseWindow|Banner|BG(?:Font|Gradient|Image)|BrandingText|BringToFront|Call(?:InstDLL)?|Caption|ChangeUI|CheckBitmap|ClearErrors|CompletedText|ComponentText|CopyFiles|CRCCheck|Create(?:Directory|Font|ShortCut)|Delete(?:INISec|INIStr|RegKey|RegValue)?|Detail(?:Print|sButtonText)|Dialer|Dir(?:Text|Var|Verify)|EnableWindow|Enum(?:RegKey|RegValue)|Exch|Exec(?:Shell(?:Wait)?|Wait)?|ExpandEnvStrings|File(?:BufSize|Close|ErrorText|Open|Read|ReadByte|ReadUTF16LE|ReadWord|WriteUTF16LE|Seek|Write|WriteByte|WriteWord)?|Find(?:Close|First|Next|Window)|FlushINI|Get(?:CurInstType|CurrentAddress|DlgItem|DLLVersion(?:Local)?|ErrorLevel|FileTime(?:Local)?|FullPathName|Function(?:Address|End)?|InstDirError|LabelAddress|TempFileName)|Goto|HideWindow|Icon|If(?:Abort|Errors|FileExists|RebootFlag|Silent)|InitPluginsDir|Install(?:ButtonText|Colors|Dir(?:RegKey)?)|InstProgressFlags|Inst(?:Type(?:GetText|SetText)?)|Int(?:64|Ptr)?CmpU?|Int(?:64)?Fmt|Int(?:Ptr)?Op|IsWindow|Lang(?:DLL|String)|License(?:BkColor|Data|ForceSelection|LangString|Text)|LoadLanguageFile|LockWindow|Log(?:Set|Text)|Manifest(?:DPIAware|SupportedOS)|Math|MessageBox|MiscButtonText|Name|Nop|ns(?:Dialogs|Exec)|NSISdl|OutFile|Page(?:Callbacks)?|PE(?:DllCharacteristics|SubsysVer)|Pop|Push|Quit|Read(?:EnvStr|INIStr|RegDWORD|RegStr)|Reboot|RegDLL|Rename|RequestExecutionLevel|ReserveFile|Return|RMDir|SearchPath|Section(?:End|GetFlags|GetInstTypes|GetSize|GetText|Group|In|SetFlags|SetInstTypes|SetSize|SetText)?|SendMessage|Set(?:AutoClose|BrandingImage|Compress|Compressor(?:DictSize)?|CtlColors|CurInstType|DatablockOptimize|DateSave|Details(?:Print|View)|ErrorLevel|Errors|FileAttributes|Font|OutPath|Overwrite|PluginUnload|RebootFlag|RegView|ShellVarContext|Silent)|Show(?:InstDetails|UninstDetails|Window)|Silent(?:Install|UnInstall)|Sleep|SpaceTexts|Splash|StartMenu|Str(?:CmpS?|Cpy|Len)|SubCaption|System|Unicode|Uninstall(?:ButtonText|Caption|Icon|SubCaption|Text)|UninstPage|UnRegDLL|UserInfo|Var|VI(?:AddVersionKey|FileVersion|ProductVersion)|VPatch|WindowIcon|Write(?:INIStr|Reg(?:Bin|DWORD|ExpandStr|MultiStr|None|Str)|Uninstaller)|XPStyle)\b/m,
        lookbehind: true
      },
      property: /\b(?:admin|all|auto|both|colored|false|force|hide|highest|lastused|leave|listonly|none|normal|notset|off|on|open|print|show|silent|silentlog|smooth|textonly|true|user|ARCHIVE|FILE_(ATTRIBUTE_ARCHIVE|ATTRIBUTE_NORMAL|ATTRIBUTE_OFFLINE|ATTRIBUTE_READONLY|ATTRIBUTE_SYSTEM|ATTRIBUTE_TEMPORARY)|HK((CR|CU|LM)(32|64)?|DD|PD|U)|HKEY_(CLASSES_ROOT|CURRENT_CONFIG|CURRENT_USER|DYN_DATA|LOCAL_MACHINE|PERFORMANCE_DATA|USERS)|ID(ABORT|CANCEL|IGNORE|NO|OK|RETRY|YES)|MB_(ABORTRETRYIGNORE|DEFBUTTON1|DEFBUTTON2|DEFBUTTON3|DEFBUTTON4|ICONEXCLAMATION|ICONINFORMATION|ICONQUESTION|ICONSTOP|OK|OKCANCEL|RETRYCANCEL|RIGHT|RTLREADING|SETFOREGROUND|TOPMOST|USERICON|YESNO)|NORMAL|OFFLINE|READONLY|SHCTX|SHELL_CONTEXT|SYSTEM|TEMPORARY)\b/,
      constant: /\${[\w\.:\^-]+}|\$\([\w\.:\^-]+\)/i,
      variable: /\$\w+/i,
      number: /\b0x[\dA-Fa-f]+\b|(?:\b\d+\.?\d*|\B\.\d+)(?:[Ee]-?\d+)?/,
      operator: /--?|\+\+?|<=?|>=?|==?=?|&&?|\|\|?|[?*\/~^%]/,
      punctuation: /[{}[\];(),.:]/,
      important: {
        pattern: /(^\s*)!(?:addincludedir|addplugindir|appendfile|cd|define|delfile|echo|else|endif|error|execute|finalize|getdllversion|gettlbversion|ifdef|ifmacrodef|ifmacrondef|ifndef|if|include|insertmacro|macroend|macro|makensis|packhdr|pragma|searchparse|searchreplace|system|tempfile|undef|verbose|warning)\b/im,
        lookbehind: true
      }
    };
  }
};
var ocaml_default = {
  language: "ocaml",
  init: (Prism2) => {
    Prism2.languages.ocaml = {
      comment: /\(\*[\s\S]*?\*\)/,
      string: [
        {
          pattern: /"(?:\\.|[^\\\r\n"])*"/,
          greedy: true
        },
        {
          pattern: /(['`])(?:\\(?:\d+|x[\da-f]+|.)|(?!\1)[^\\\r\n])\1/i,
          greedy: true
        }
      ],
      number: /\b(?:0x[\da-f][\da-f_]+|(?:0[bo])?\d[\d_]*\.?[\d_]*(?:e[+-]?[\d_]+)?)/i,
      type: {
        pattern: /\B['`]\w*/,
        alias: "variable"
      },
      directive: {
        pattern: /\B#\w+/,
        alias: "function"
      },
      keyword: /\b(?:as|assert|begin|class|constraint|do|done|downto|else|end|exception|external|for|fun|function|functor|if|in|include|inherit|initializer|lazy|let|match|method|module|mutable|new|object|of|open|prefix|private|rec|then|sig|struct|to|try|type|val|value|virtual|where|while|with)\b/,
      boolean: /\b(?:false|true)\b/,
      operator: /:=|[=<>@^|&+\-*\/$%!?~][!$%&*+\-.\/:<=>?@^|~]*|\b(?:and|asr|land|lor|lxor|lsl|lsr|mod|nor|or)\b/,
      punctuation: /[(){}\[\]|_.,:;]/
    };
  }
};
var opencl_default = {
  language: "opencl",
  init: (Prism2) => {
    (function(Prism3) {
      Prism3.languages.opencl = Prism3.languages.extend("c", {
        keyword: /\b(?:__attribute__|(?:__)?(?:constant|global|kernel|local|private|read_only|read_write|write_only)|_cl_(?:command_queue|context|device_id|event|kernel|mem|platform_id|program|sampler)|auto|break|case|cl_(?:image_format|mem_fence_flags)|clk_event_t|complex|const|continue|default|do|(?:float|double)(?:16(?:x(?:1|16|2|4|8))?|1x(?:1|16|2|4|8)|2(?:x(?:1|16|2|4|8))?|3|4(?:x(?:1|16|2|4|8))?|8(?:x(?:1|16|2|4|8))?)?|else|enum|event_t|extern|for|goto|(?:u?(?:char|short|int|long)|half|quad|bool)(?:2|3|4|8|16)?|if|image(?:1d_(?:array_|buffer_)?t|2d_(?:array_(?:depth_|msaa_depth_|msaa_)?|depth_|msaa_depth_|msaa_)?t|3d_t)|imaginary|inline|intptr_t|ndrange_t|packed|pipe|ptrdiff_t|queue_t|register|reserve_id_t|restrict|return|sampler_t|signed|size_t|sizeof|static|struct|switch|typedef|uintptr_t|uniform|union|unsigned|void|volatile|while)\b/,
        "function-opencl-kernel": {
          pattern: /\b(?:abs(?:_diff)?|a?(?:cos|sin)(?:h|pi)?|add_sat|aligned|all|and|any|async(?:_work_group_copy|_work_group_strided_copy)?|atan(?:2?(?:pi)?|h)?|atom_(?:add|and|cmpxchg|dec|inc|max|min|or|sub|xchg|xor)|barrier|bitselect|cbrt|ceil|clamp|clz|copies|copysign|cross|degrees|distance|dot|endian|erf|erfc|exp(?:2|10)?|expm1|fabs|fast_(?:distance|length|normalize)|fdim|floor|fma|fmax|fmin|fract|frexp|fro|from|get_(?:global_(?:id|offset|size)|group_id|image_(?:channel_data_type|channel_order|depth|dim|height|width)|local(?:_id|_size)|num_groups|work_dim)|hadd|(?:half|native)_(?:cos|divide|exp(?:2|10)?|log(?:2|10)?|powr|recip|r?sqrt|sin|tan)|hypot|ilogb|is(?:equal|finite|greater(?:equal)?|inf|less(?:equal|greater)?|nan|normal|notequal|(?:un)?ordered)|ldexp|length|lgamma|lgamma_r|log(?:b|1p|2|10)?|mad(?:24|_hi|_sat)?|max|mem(?:_fence)?|min|mix|modf|mul24|mul_hi|nan|nextafter|normalize|pow[nr]?|prefetch|radians|read_(?:image)(?:f|h|u?i)|read_mem_fence|remainder|remquo|reqd_work_group_size|rhadd|rint|rootn|rotate|round|rsqrt|select|shuffle2?|sign|signbit|sincos|smoothstep|sqrt|step|sub_sat|tan|tanh|tanpi|tgamma|to|trunc|upsample|vec_(?:step|type_hint)|v(?:load|store)(?:_half)?(?:2|3|4|8|16)?|v(?:loada_half|storea?(?:_half)?)(?:2|3|4|8|16)?(?:_(?:rte|rtn|rtp|rtz))?|wait_group_events|work_group_size_hint|write_image(?:f|h|u?i)|write_mem_fence)\b/,
          alias: "function"
        },
        "constant-opencl-kernel": {
          pattern: /\b(?:CHAR_(?:BIT|MAX|MIN)|CLK_(?:ADDRESS_(?:CLAMP(?:_TO_EDGE)?|NONE|REPEAT)|FILTER_(?:LINEAR|NEAREST)|(?:LOCAL|GLOBAL)_MEM_FENCE|NORMALIZED_COORDS_(?:FALSE|TRUE))|CL_(?:BGRA|(?:HALF_)?FLOAT|INTENSITY|LUMINANCE|A?R?G?B?[Ax]?|(?:(?:UN)?SIGNED|[US]NORM)_(?:INT(?:8|16|32))|UNORM_(?:INT_101010|SHORT_(?:555|565)))|(?:DBL|FLT)_(?:DIG|EPSILON|MANT_DIG|(?:MIN|MAX)(?:(?:_10)?_EXP)?)|FLT_RADIX|HUGE_VALF|INFINITY|(?:INT|LONG|SCHAR|SHRT|UCHAR|UINT|ULONG)_(?:MAX|MIN)|MAXFLOAT|M_(?:[12]_PI|2_SQRTPI|E|LN(?:2|10)|LOG(?:10|2)E?|PI[24]?|SQRT(?:1_2|2))|NAN)\b/,
          alias: "constant"
        }
      });
      const attributes = {
        "type-opencl-host": {
          pattern: /\b(?:cl_(?:GLenum|GLint|GLuin|addressing_mode|bitfield|bool|buffer_create_type|build_status|channel_(?:order|type)|(?:u?(?:char|short|int|long)|float|double)(?:2|3|4|8|16)?|command_(?:queue(?:_info|_properties)?|type)|context(?:_info|_properties)?|device_(?:exec_capabilities|fp_config|id|info|local_mem_type|mem_cache_type|type)|(?:event|sampler)(?:_info)?|filter_mode|half|image_info|kernel(?:_info|_work_group_info)?|map_flags|mem(?:_flags|_info|_object_type)?|platform_(?:id|info)|profiling_info|program(?:_build_info|_info)?))\b/,
          alias: "keyword"
        },
        "boolean-opencl-host": {
          pattern: /\bCL_(?:TRUE|FALSE)\b/,
          alias: "boolean"
        },
        "constant-opencl-host": {
          pattern: /\bCL_(?:A|ABGR|ADDRESS_(?:CLAMP(?:_TO_EDGE)?|MIRRORED_REPEAT|NONE|REPEAT)|ARGB|BGRA|BLOCKING|BUFFER_CREATE_TYPE_REGION|BUILD_(?:ERROR|IN_PROGRESS|NONE|PROGRAM_FAILURE|SUCCESS)|COMMAND_(?:ACQUIRE_GL_OBJECTS|BARRIER|COPY_(?:BUFFER(?:_RECT|_TO_IMAGE)?|IMAGE(?:_TO_BUFFER)?)|FILL_(?:BUFFER|IMAGE)|MAP(?:_BUFFER|_IMAGE)|MARKER|MIGRATE(?:_SVM)?_MEM_OBJECTS|NATIVE_KERNEL|NDRANGE_KERNEL|READ_(?:BUFFER(?:_RECT)?|IMAGE)|RELEASE_GL_OBJECTS|SVM_(?:FREE|MAP|MEMCPY|MEMFILL|UNMAP)|TASK|UNMAP_MEM_OBJECT|USER|WRITE_(?:BUFFER(?:_RECT)?|IMAGE))|COMPILER_NOT_AVAILABLE|COMPILE_PROGRAM_FAILURE|COMPLETE|CONTEXT_(?:DEVICES|INTEROP_USER_SYNC|NUM_DEVICES|PLATFORM|PROPERTIES|REFERENCE_COUNT)|DEPTH(?:_STENCIL)?|DEVICE_(?:ADDRESS_BITS|AFFINITY_DOMAIN_(?:L[1-4]_CACHE|NEXT_PARTITIONABLE|NUMA)|AVAILABLE|BUILT_IN_KERNELS|COMPILER_AVAILABLE|DOUBLE_FP_CONFIG|ENDIAN_LITTLE|ERROR_CORRECTION_SUPPORT|EXECUTION_CAPABILITIES|EXTENSIONS|GLOBAL_(?:MEM_(?:CACHELINE_SIZE|CACHE_SIZE|CACHE_TYPE|SIZE)|VARIABLE_PREFERRED_TOTAL_SIZE)|HOST_UNIFIED_MEMORY|IL_VERSION|IMAGE(?:2D_MAX_(?:HEIGHT|WIDTH)|3D_MAX_(?:DEPTH|HEIGHT|WIDTH)|_BASE_ADDRESS_ALIGNMENT|_MAX_ARRAY_SIZE|_MAX_BUFFER_SIZE|_PITCH_ALIGNMENT|_SUPPORT)|LINKER_AVAILABLE|LOCAL_MEM_SIZE|LOCAL_MEM_TYPE|MAX_(?:CLOCK_FREQUENCY|COMPUTE_UNITS|CONSTANT_ARGS|CONSTANT_BUFFER_SIZE|GLOBAL_VARIABLE_SIZE|MEM_ALLOC_SIZE|NUM_SUB_GROUPS|ON_DEVICE_(?:EVENTS|QUEUES)|PARAMETER_SIZE|PIPE_ARGS|READ_IMAGE_ARGS|READ_WRITE_IMAGE_ARGS|SAMPLERS|WORK_GROUP_SIZE|WORK_ITEM_DIMENSIONS|WORK_ITEM_SIZES|WRITE_IMAGE_ARGS)|MEM_BASE_ADDR_ALIGN|MIN_DATA_TYPE_ALIGN_SIZE|NAME|NATIVE_VECTOR_WIDTH_(?:CHAR|DOUBLE|FLOAT|HALF|INT|LONG|SHORT)|NOT_(?:AVAILABLE|FOUND)|OPENCL_C_VERSION|PARENT_DEVICE|PARTITION_(?:AFFINITY_DOMAIN|BY_AFFINITY_DOMAIN|BY_COUNTS|BY_COUNTS_LIST_END|EQUALLY|FAILED|MAX_SUB_DEVICES|PROPERTIES|TYPE)|PIPE_MAX_(?:ACTIVE_RESERVATIONS|PACKET_SIZE)|PLATFORM|PREFERRED_(?:GLOBAL_ATOMIC_ALIGNMENT|INTEROP_USER_SYNC|LOCAL_ATOMIC_ALIGNMENT|PLATFORM_ATOMIC_ALIGNMENT|VECTOR_WIDTH_(?:CHAR|DOUBLE|FLOAT|HALF|INT|LONG|SHORT))|PRINTF_BUFFER_SIZE|PROFILE|PROFILING_TIMER_RESOLUTION|QUEUE_(?:ON_(?:DEVICE_(?:MAX_SIZE|PREFERRED_SIZE|PROPERTIES)|HOST_PROPERTIES)|PROPERTIES)|REFERENCE_COUNT|SINGLE_FP_CONFIG|SUB_GROUP_INDEPENDENT_FORWARD_PROGRESS|SVM_(?:ATOMICS|CAPABILITIES|COARSE_GRAIN_BUFFER|FINE_GRAIN_BUFFER|FINE_GRAIN_SYSTEM)|TYPE(?:_ACCELERATOR|_ALL|_CPU|_CUSTOM|_DEFAULT|_GPU)?|VENDOR(?:_ID)?|VERSION)|DRIVER_VERSION|EVENT_(?:COMMAND_(?:EXECUTION_STATUS|QUEUE|TYPE)|CONTEXT|REFERENCE_COUNT)|EXEC_(?:KERNEL|NATIVE_KERNEL|STATUS_ERROR_FOR_EVENTS_IN_WAIT_LIST)|FILTER_(?:LINEAR|NEAREST)|FLOAT|FP_(?:CORRECTLY_ROUNDED_DIVIDE_SQRT|DENORM|FMA|INF_NAN|ROUND_TO_INF|ROUND_TO_NEAREST|ROUND_TO_ZERO|SOFT_FLOAT)|GLOBAL|HALF_FLOAT|IMAGE_(?:ARRAY_SIZE|BUFFER|DEPTH|ELEMENT_SIZE|FORMAT|FORMAT_MISMATCH|FORMAT_NOT_SUPPORTED|HEIGHT|NUM_MIP_LEVELS|NUM_SAMPLES|ROW_PITCH|SLICE_PITCH|WIDTH)|INTENSITY|INVALID_(?:ARG_INDEX|ARG_SIZE|ARG_VALUE|BINARY|BUFFER_SIZE|BUILD_OPTIONS|COMMAND_QUEUE|COMPILER_OPTIONS|CONTEXT|DEVICE|DEVICE_PARTITION_COUNT|DEVICE_QUEUE|DEVICE_TYPE|EVENT|EVENT_WAIT_LIST|GLOBAL_OFFSET|GLOBAL_WORK_SIZE|GL_OBJECT|HOST_PTR|IMAGE_DESCRIPTOR|IMAGE_FORMAT_DESCRIPTOR|IMAGE_SIZE|KERNEL|KERNEL_ARGS|KERNEL_DEFINITION|KERNEL_NAME|LINKER_OPTIONS|MEM_OBJECT|MIP_LEVEL|OPERATION|PIPE_SIZE|PLATFORM|PROGRAM|PROGRAM_EXECUTABLE|PROPERTY|QUEUE_PROPERTIES|SAMPLER|VALUE|WORK_DIMENSION|WORK_GROUP_SIZE|WORK_ITEM_SIZE)|KERNEL_(?:ARG_(?:ACCESS_(?:NONE|QUALIFIER|READ_ONLY|READ_WRITE|WRITE_ONLY)|ADDRESS_(?:CONSTANT|GLOBAL|LOCAL|PRIVATE|QUALIFIER)|INFO_NOT_AVAILABLE|NAME|TYPE_(?:CONST|NAME|NONE|PIPE|QUALIFIER|RESTRICT|VOLATILE))|ATTRIBUTES|COMPILE_NUM_SUB_GROUPS|COMPILE_WORK_GROUP_SIZE|CONTEXT|EXEC_INFO_SVM_FINE_GRAIN_SYSTEM|EXEC_INFO_SVM_PTRS|FUNCTION_NAME|GLOBAL_WORK_SIZE|LOCAL_MEM_SIZE|LOCAL_SIZE_FOR_SUB_GROUP_COUNT|MAX_NUM_SUB_GROUPS|MAX_SUB_GROUP_SIZE_FOR_NDRANGE|NUM_ARGS|PREFERRED_WORK_GROUP_SIZE_MULTIPLE|PRIVATE_MEM_SIZE|PROGRAM|REFERENCE_COUNT|SUB_GROUP_COUNT_FOR_NDRANGE|WORK_GROUP_SIZE)|LINKER_NOT_AVAILABLE|LINK_PROGRAM_FAILURE|LOCAL|LUMINANCE|MAP_(?:FAILURE|READ|WRITE|WRITE_INVALIDATE_REGION)|MEM_(?:ALLOC_HOST_PTR|ASSOCIATED_MEMOBJECT|CONTEXT|COPY_HOST_PTR|COPY_OVERLAP|FLAGS|HOST_NO_ACCESS|HOST_PTR|HOST_READ_ONLY|HOST_WRITE_ONLY|KERNEL_READ_AND_WRITE|MAP_COUNT|OBJECT_(?:ALLOCATION_FAILURE|BUFFER|IMAGE1D|IMAGE1D_ARRAY|IMAGE1D_BUFFER|IMAGE2D|IMAGE2D_ARRAY|IMAGE3D|PIPE)|OFFSET|READ_ONLY|READ_WRITE|REFERENCE_COUNT|SIZE|SVM_ATOMICS|SVM_FINE_GRAIN_BUFFER|TYPE|USES_SVM_POINTER|USE_HOST_PTR|WRITE_ONLY)|MIGRATE_MEM_OBJECT_(?:CONTENT_UNDEFINED|HOST)|MISALIGNED_SUB_BUFFER_OFFSET|NONE|NON_BLOCKING|OUT_OF_(?:HOST_MEMORY|RESOURCES)|PIPE_(?:MAX_PACKETS|PACKET_SIZE)|PLATFORM_(?:EXTENSIONS|HOST_TIMER_RESOLUTION|NAME|PROFILE|VENDOR|VERSION)|PROFILING_(?:COMMAND_(?:COMPLETE|END|QUEUED|START|SUBMIT)|INFO_NOT_AVAILABLE)|PROGRAM_(?:BINARIES|BINARY_SIZES|BINARY_TYPE(?:_COMPILED_OBJECT|_EXECUTABLE|_LIBRARY|_NONE)?|BUILD_(?:GLOBAL_VARIABLE_TOTAL_SIZE|LOG|OPTIONS|STATUS)|CONTEXT|DEVICES|IL|KERNEL_NAMES|NUM_DEVICES|NUM_KERNELS|REFERENCE_COUNT|SOURCE)|QUEUED|QUEUE_(?:CONTEXT|DEVICE|DEVICE_DEFAULT|ON_DEVICE|ON_DEVICE_DEFAULT|OUT_OF_ORDER_EXEC_MODE_ENABLE|PROFILING_ENABLE|PROPERTIES|REFERENCE_COUNT|SIZE)|R|RA|READ_(?:ONLY|WRITE)_CACHE|RG|RGB|RGBA|RGBx|RGx|RUNNING|Rx|SAMPLER_(?:ADDRESSING_MODE|CONTEXT|FILTER_MODE|LOD_MAX|LOD_MIN|MIP_FILTER_MODE|NORMALIZED_COORDS|REFERENCE_COUNT)|(?:UN)?SIGNED_INT(?:8|16|32)|SNORM_INT(?:8|16)|SUBMITTED|SUCCESS|UNORM_INT(?:16|24|8|_101010|_101010_2)|UNORM_SHORT_(?:555|565)|VERSION_(?:1_0|1_1|1_2|2_0|2_1)|sBGRA|sRGB|sRGBA|sRGBx)\b/,
          alias: "constant"
        },
        "function-opencl-host": {
          pattern: /\bcl(?:BuildProgram|CloneKernel|CompileProgram|Create(?:Buffer|CommandQueue(?:WithProperties)?|Context|ContextFromType|Image|Image2D|Image3D|Kernel|KernelsInProgram|Pipe|ProgramWith(?:Binary|BuiltInKernels|IL|Source)|Sampler|SamplerWithProperties|SubBuffer|SubDevices|UserEvent)|Enqueue(?:(?:Barrier|Marker)(?:WithWaitList)?|Copy(?:Buffer(?:Rect|ToImage)?|Image(?:ToBuffer)?)|(?:Fill|Map)(?:Buffer|Image)|MigrateMemObjects|NDRangeKernel|NativeKernel|(?:Read|Write)(?:Buffer(?:Rect)?|Image)|SVM(?:Free|Map|MemFill|Memcpy|MigrateMem|Unmap)|Task|UnmapMemObject|WaitForEvents)|Finish|Flush|Get(?:CommandQueueInfo|ContextInfo|Device(?:AndHostTimer|IDs|Info)|Event(?:Profiling)?Info|ExtensionFunctionAddress(?:ForPlatform)?|HostTimer|ImageInfo|Kernel(?:ArgInfo|Info|SubGroupInfo|WorkGroupInfo)|MemObjectInfo|PipeInfo|Platform(?:IDs|Info)|Program(?:Build)?Info|SamplerInfo|SupportedImageFormats)|LinkProgram|(?:Release|Retain)(?:CommandQueue|Context|Device|Event|Kernel|MemObject|Program|Sampler)|SVM(?:Alloc|Free)|Set(?:CommandQueueProperty|DefaultDeviceCommandQueue|EventCallback|Kernel(?:Arg(?:SVMPointer)?|ExecInfo)|Kernel|MemObjectDestructorCallback|UserEventStatus)|Unload(?:Platform)?Compiler|WaitForEvents)\b/,
          alias: "function"
        }
      };
      Prism3.languages.insertBefore("c", "keyword", attributes);
      attributes["type-opencl-host-c++"] = {
        pattern: /\b(?:Buffer|BufferGL|BufferRenderGL|CommandQueue|Context|Device|DeviceCommandQueue|EnqueueArgs|Event|Image|Image1D|Image1DArray|Image1DBuffer|Image2D|Image2DArray|Image2DGL|Image3D|Image3DGL|ImageFormat|ImageGL|Kernel|KernelFunctor|LocalSpaceArg|Memory|NDRange|Pipe|Platform|Program|Sampler|SVMAllocator|SVMTraitAtomic|SVMTraitCoarse|SVMTraitFine|SVMTraitReadOnly|SVMTraitReadWrite|SVMTraitWriteOnly|UserEvent)\b/,
        alias: "keyword"
      };
      Prism3.languages.insertBefore("cpp", "keyword", attributes);
    })(Prism2);
  }
};
var oz_default = {
  language: "oz",
  init: (Prism2) => {
    Prism2.languages.oz = {
      comment: /\/\*[\s\S]*?\*\/|%.*/,
      string: {
        pattern: /"(?:[^"\\]|\\[\s\S])*"/,
        greedy: true
      },
      atom: {
        pattern: /'(?:[^'\\]|\\[\s\S])*'/,
        greedy: true,
        alias: "builtin"
      },
      keyword: /[$_]|\[\]|\b(?:at|attr|case|catch|choice|class|cond|declare|define|dis|else(?:case|if)?|end|export|fail|false|feat|finally|from|fun|functor|if|import|in|local|lock|meth|nil|not|of|or|prepare|proc|prop|raise|require|self|skip|then|thread|true|try|unit)\b/,
      function: [
        /[a-z][A-Za-z\d]*(?=\()/,
        {
          pattern: /(\{)[A-Z][A-Za-z\d]*/,
          lookbehind: true
        }
      ],
      number: /\b(?:0[bx][\da-f]+|\d+\.?\d*(?:e~?\d+)?\b)|&(?:[^\\]|\\(?:\d{3}|.))/i,
      variable: /\b[A-Z][A-Za-z\d]*|`(?:[^`\\]|\\.)+`/,
      "attr-name": /\w+(?=:)/,
      operator: /:(?:=|::?)|<[-:=]?|=(?:=|<?:?)|>=?:?|\\=:?|!!?|[|#+\-*\/,~^@]|\b(?:andthen|div|mod|orelse)\b/,
      punctuation: /[\[\](){}.:;?]/
    };
  }
};
var parigp_default = {
  language: "parigp",
  init: (Prism2) => {
    Prism2.languages.parigp = {
      comment: /\/\*[\s\S]*?\*\/|\\\\.*/,
      string: {
        pattern: /"(?:[^"\\\r\n]|\\.)*"/,
        greedy: true
      },
      keyword: function() {
        let keywords = [
          "breakpoint",
          "break",
          "dbg_down",
          "dbg_err",
          "dbg_up",
          "dbg_x",
          "forcomposite",
          "fordiv",
          "forell",
          "forpart",
          "forprime",
          "forstep",
          "forsubgroup",
          "forvec",
          "for",
          "iferr",
          "if",
          "local",
          "my",
          "next",
          "return",
          "until",
          "while"
        ];
        keywords = keywords.map((keyword) => keyword.split("").join(" *")).join("|");
        return RegExp(`\\b(?:${keywords})\\b`);
      }(),
      function: /\w[\w ]*?(?= *\()/,
      number: {
        pattern: /((?:\. *\. *)?)(?:\d(?: *\d)*(?: *(?!\. *\.)\.(?: *\d)*)?|\. *\d(?: *\d)*)(?: *e *[+-]? *\d(?: *\d)*)?/i,
        lookbehind: true
      },
      operator: /\. *\.|[*\/!](?: *=)?|%(?: *=|(?: *#)?(?: *')*)?|\+(?: *[+=])?|-(?: *[-=>])?|<(?:(?: *<)?(?: *=)?| *>)?|>(?: *>)?(?: *=)?|=(?: *=){0,2}|\\(?: *\/)?(?: *=)?|&(?: *&)?|\| *\||['#~^]/,
      punctuation: /[\[\]{}().,:;|]/
    };
  }
};
var pascal_default = {
  language: "pascal",
  init: (Prism2) => {
    Prism2.languages.pascal = {
      comment: [/\(\*[\s\S]+?\*\)/, /\{[\s\S]+?\}/, /\/\/.*/],
      string: {
        pattern: /(?:'(?:''|[^'\r\n])*'|#[&$%]?[a-f\d]+)+|\^[a-z]/i,
        greedy: true
      },
      keyword: [
        {
          pattern: /(^|[^&])\b(?:absolute|array|asm|begin|case|const|constructor|destructor|do|downto|else|end|file|for|function|goto|if|implementation|inherited|inline|interface|label|nil|object|of|operator|packed|procedure|program|record|reintroduce|repeat|self|set|string|then|to|type|unit|until|uses|var|while|with)\b/i,
          lookbehind: true
        },
        {
          pattern: /(^|[^&])\b(?:dispose|exit|false|new|true)\b/i,
          lookbehind: true
        },
        {
          pattern: /(^|[^&])\b(?:class|dispinterface|except|exports|finalization|finally|initialization|inline|library|on|out|packed|property|raise|resourcestring|threadvar|try)\b/i,
          lookbehind: true
        },
        {
          pattern: /(^|[^&])\b(?:absolute|abstract|alias|assembler|bitpacked|break|cdecl|continue|cppdecl|cvar|default|deprecated|dynamic|enumerator|experimental|export|external|far|far16|forward|generic|helper|implements|index|interrupt|iochecks|local|message|name|near|nodefault|noreturn|nostackframe|oldfpccall|otherwise|overload|override|pascal|platform|private|protected|public|published|read|register|reintroduce|result|safecall|saveregisters|softfloat|specialize|static|stdcall|stored|strict|unaligned|unimplemented|varargs|virtual|write)\b/i,
          lookbehind: true
        }
      ],
      number: [
        /(?:[&%]\d+|\$[a-f\d]+)/i,
        /\b\d+(?:\.\d+)?(?:e[+-]?\d+)?/i
      ],
      operator: [
        /\.\.|\*\*|:=|<[<=>]?|>[>=]?|[+\-*\/]=?|[@^=]/i,
        {
          pattern: /(^|[^&])\b(?:and|as|div|exclude|in|include|is|mod|not|or|shl|shr|xor)\b/,
          lookbehind: true
        }
      ],
      punctuation: /\(\.|\.\)|[()\[\]:;,.]/
    };
  }
};
var perl_default = {
  language: "perl",
  init: (Prism2) => {
    Prism2.languages.perl = {
      comment: [
        {
          pattern: /(^\s*)=\w+[\s\S]*?=cut.*/m,
          lookbehind: true
        },
        {
          pattern: /(^|[^\\$])#.*/,
          lookbehind: true
        }
      ],
      string: [
        {
          pattern: /\b(?:q|qq|qx|qw)\s*([^a-zA-Z0-9\s{(\[<])(?:(?!\1)[^\\]|\\[\s\S])*\1/,
          greedy: true
        },
        {
          pattern: /\b(?:q|qq|qx|qw)\s+([a-zA-Z0-9])(?:(?!\1)[^\\]|\\[\s\S])*\1/,
          greedy: true
        },
        {
          pattern: /\b(?:q|qq|qx|qw)\s*\((?:[^()\\]|\\[\s\S])*\)/,
          greedy: true
        },
        {
          pattern: /\b(?:q|qq|qx|qw)\s*\{(?:[^{}\\]|\\[\s\S])*\}/,
          greedy: true
        },
        {
          pattern: /\b(?:q|qq|qx|qw)\s*\[(?:[^[\]\\]|\\[\s\S])*\]/,
          greedy: true
        },
        {
          pattern: /\b(?:q|qq|qx|qw)\s*<(?:[^<>\\]|\\[\s\S])*>/,
          greedy: true
        },
        {
          pattern: /("|`)(?:(?!\1)[^\\]|\\[\s\S])*\1/,
          greedy: true
        },
        {
          pattern: /'(?:[^'\\\r\n]|\\.)*'/,
          greedy: true
        }
      ],
      regex: [
        {
          pattern: /\b(?:m|qr)\s*([^a-zA-Z0-9\s{(\[<])(?:(?!\1)[^\\]|\\[\s\S])*\1[msixpodualngc]*/,
          greedy: true
        },
        {
          pattern: /\b(?:m|qr)\s+([a-zA-Z0-9])(?:(?!\1)[^\\]|\\[\s\S])*\1[msixpodualngc]*/,
          greedy: true
        },
        {
          pattern: /\b(?:m|qr)\s*\((?:[^()\\]|\\[\s\S])*\)[msixpodualngc]*/,
          greedy: true
        },
        {
          pattern: /\b(?:m|qr)\s*\{(?:[^{}\\]|\\[\s\S])*\}[msixpodualngc]*/,
          greedy: true
        },
        {
          pattern: /\b(?:m|qr)\s*\[(?:[^[\]\\]|\\[\s\S])*\][msixpodualngc]*/,
          greedy: true
        },
        {
          pattern: /\b(?:m|qr)\s*<(?:[^<>\\]|\\[\s\S])*>[msixpodualngc]*/,
          greedy: true
        },
        {
          pattern: /(^|[^-]\b)(?:s|tr|y)\s*([^a-zA-Z0-9\s{(\[<])(?:(?!\2)[^\\]|\\[\s\S])*\2(?:(?!\2)[^\\]|\\[\s\S])*\2[msixpodualngcer]*/,
          lookbehind: true,
          greedy: true
        },
        {
          pattern: /(^|[^-]\b)(?:s|tr|y)\s+([a-zA-Z0-9])(?:(?!\2)[^\\]|\\[\s\S])*\2(?:(?!\2)[^\\]|\\[\s\S])*\2[msixpodualngcer]*/,
          lookbehind: true,
          greedy: true
        },
        {
          pattern: /(^|[^-]\b)(?:s|tr|y)\s*\((?:[^()\\]|\\[\s\S])*\)\s*\((?:[^()\\]|\\[\s\S])*\)[msixpodualngcer]*/,
          lookbehind: true,
          greedy: true
        },
        {
          pattern: /(^|[^-]\b)(?:s|tr|y)\s*\{(?:[^{}\\]|\\[\s\S])*\}\s*\{(?:[^{}\\]|\\[\s\S])*\}[msixpodualngcer]*/,
          lookbehind: true,
          greedy: true
        },
        {
          pattern: /(^|[^-]\b)(?:s|tr|y)\s*\[(?:[^[\]\\]|\\[\s\S])*\]\s*\[(?:[^[\]\\]|\\[\s\S])*\][msixpodualngcer]*/,
          lookbehind: true,
          greedy: true
        },
        {
          pattern: /(^|[^-]\b)(?:s|tr|y)\s*<(?:[^<>\\]|\\[\s\S])*>\s*<(?:[^<>\\]|\\[\s\S])*>[msixpodualngcer]*/,
          lookbehind: true,
          greedy: true
        },
        {
          pattern: /\/(?:[^\/\\\r\n]|\\.)*\/[msixpodualngc]*(?=\s*(?:$|[\r\n,.;})&|\-+*~<>!?^]|(lt|gt|le|ge|eq|ne|cmp|not|and|or|xor|x)\b))/,
          greedy: true
        }
      ],
      variable: [
        /[&*$@%]\{\^[A-Z]+\}/,
        /[&*$@%]\^[A-Z_]/,
        /[&*$@%]#?(?=\{)/,
        /[&*$@%]#?(?:(?:::)*'?(?!\d)[\w$]+)+(?:::)*/i,
        /[&*$@%]\d+/,
        /(?!%=)[$@%][!"#$%&'()*+,\-.\/:;<=>?@[\\\]^_`{|}~]/
      ],
      filehandle: {
        pattern: /<(?![<=])\S*>|\b_\b/,
        alias: "symbol"
      },
      vstring: {
        pattern: /v\d+(?:\.\d+)*|\d+(?:\.\d+){2,}/,
        alias: "string"
      },
      function: {
        pattern: /sub [a-z0-9_]+/i,
        inside: {
          keyword: /sub/
        }
      },
      keyword: /\b(?:any|break|continue|default|delete|die|do|else|elsif|eval|for|foreach|given|goto|if|last|local|my|next|our|package|print|redo|require|say|state|sub|switch|undef|unless|until|use|when|while)\b/,
      number: /\b(?:0x[\dA-Fa-f](?:_?[\dA-Fa-f])*|0b[01](?:_?[01])*|(?:\d(?:_?\d)*)?\.?\d(?:_?\d)*(?:[Ee][+-]?\d+)?)\b/,
      operator: /-[rwxoRWXOezsfdlpSbctugkTBMAC]\b|\+[+=]?|-[-=>]?|\*\*?=?|\/\/?=?|=[=~>]?|~[~=]?|\|\|?=?|&&?=?|<(?:=>?|<=?)?|>>?=?|![~=]?|[%^]=?|\.(?:=|\.\.?)?|[\\?]|\bx(?:=|\b)|\b(?:lt|gt|le|ge|eq|ne|cmp|not|and|or|xor)\b/,
      punctuation: /[{}[\];(),:]/
    };
  }
};
var plsql_default = {
  language: "plsql",
  init: (Prism2) => {
    Prism2.languages.plsql = Prism2.languages.extend("sql", {
      comment: [/\/\*[\s\S]*?\*\//, /--.*/]
    });
    if (Prism2.util.type(Prism2.languages.plsql.keyword) !== "Array") {
      Prism2.languages.plsql.keyword = [Prism2.languages.plsql.keyword];
    }
    Prism2.languages.plsql.keyword.unshift(/\b(?:ACCESS|AGENT|AGGREGATE|ARRAY|ARROW|AT|ATTRIBUTE|AUDIT|AUTHID|BFILE_BASE|BLOB_BASE|BLOCK|BODY|BOTH|BOUND|BYTE|CALLING|CHAR_BASE|CHARSET(?:FORM|ID)|CLOB_BASE|COLAUTH|COLLECT|CLUSTERS?|COMPILED|COMPRESS|CONSTANT|CONSTRUCTOR|CONTEXT|CRASH|CUSTOMDATUM|DANGLING|DATE_BASE|DEFINE|DETERMINISTIC|DURATION|ELEMENT|EMPTY|EXCEPTIONS?|EXCLUSIVE|EXTERNAL|FINAL|FORALL|FORM|FOUND|GENERAL|HEAP|HIDDEN|IDENTIFIED|IMMEDIATE|INCLUDING|INCREMENT|INDICATOR|INDEXES|INDICES|INFINITE|INITIAL|ISOPEN|INSTANTIABLE|INTERFACE|INVALIDATE|JAVA|LARGE|LEADING|LENGTH|LIBRARY|LIKE[24C]|LIMITED|LONG|LOOP|MAP|MAXEXTENTS|MAXLEN|MEMBER|MINUS|MLSLABEL|MULTISET|NAME|NAN|NATIVE|NEW|NOAUDIT|NOCOMPRESS|NOCOPY|NOTFOUND|NOWAIT|NUMBER(?:_BASE)?|OBJECT|OCI(?:COLL|DATE|DATETIME|DURATION|INTERVAL|LOBLOCATOR|NUMBER|RAW|REF|REFCURSOR|ROWID|STRING|TYPE)|OFFLINE|ONLINE|ONLY|OPAQUE|OPERATOR|ORACLE|ORADATA|ORGANIZATION|ORL(?:ANY|VARY)|OTHERS|OVERLAPS|OVERRIDING|PACKAGE|PARALLEL_ENABLE|PARAMETERS?|PASCAL|PCTFREE|PIPE(?:LINED)?|PRAGMA|PRIOR|PRIVATE|RAISE|RANGE|RAW|RECORD|REF|REFERENCE|REM|REMAINDER|RESULT|RESOURCE|RETURNING|REVERSE|ROW(?:ID|NUM|TYPE)|SAMPLE|SB[124]|SEGMENT|SELF|SEPARATE|SEQUENCE|SHORT|SIZE(?:_T)?|SPARSE|SQL(?:CODE|DATA|NAME|STATE)|STANDARD|STATIC|STDDEV|STORED|STRING|STRUCT|STYLE|SUBMULTISET|SUBPARTITION|SUBSTITUTABLE|SUBTYPE|SUCCESSFUL|SYNONYM|SYSDATE|TABAUTH|TDO|THE|TIMEZONE_(?:ABBR|HOUR|MINUTE|REGION)|TRAILING|TRANSAC(?:TIONAL)?|TRUSTED|UB[124]|UID|UNDER|UNTRUSTED|VALIDATE|VALIST|VARCHAR2|VARIABLE|VARIANCE|VARRAY|VIEWS|VOID|WHENEVER|WRAPPED|ZONE)\b/i);
    if (Prism2.util.type(Prism2.languages.plsql.operator) !== "Array") {
      Prism2.languages.plsql.operator = [Prism2.languages.plsql.operator];
    }
    Prism2.languages.plsql.operator.unshift(/:=/);
  }
};
var powershell_default = {
  language: "powershell",
  init: (Prism2) => {
    Prism2.languages.powershell = {
      comment: [
        {
          pattern: /(^|[^`])<#[\s\S]*?#>/,
          lookbehind: true
        },
        {
          pattern: /(^|[^`])#.*/,
          lookbehind: true
        }
      ],
      string: [
        {
          pattern: /"(?:`[\s\S]|[^`"])*"/,
          greedy: true,
          inside: {
            function: {
              pattern: /(^|[^`])\$\(.*?\)/,
              lookbehind: true,
              inside: {}
            }
          }
        },
        {
          pattern: /'(?:[^']|'')*'/,
          greedy: true
        }
      ],
      namespace: /\[[a-z](?:\[(?:\[[^\]]*]|[^\[\]])*]|[^\[\]])*]/i,
      boolean: /\$(?:true|false)\b/i,
      variable: /\$\w+\b/i,
      function: [
        /\b(?:Add-(?:Computer|Content|History|Member|PSSnapin|Type)|Checkpoint-Computer|Clear-(?:Content|EventLog|History|Item|ItemProperty|Variable)|Compare-Object|Complete-Transaction|Connect-PSSession|ConvertFrom-(?:Csv|Json|StringData)|Convert-Path|ConvertTo-(?:Csv|Html|Json|Xml)|Copy-(?:Item|ItemProperty)|Debug-Process|Disable-(?:ComputerRestore|PSBreakpoint|PSRemoting|PSSessionConfiguration)|Disconnect-PSSession|Enable-(?:ComputerRestore|PSBreakpoint|PSRemoting|PSSessionConfiguration)|Enter-PSSession|Exit-PSSession|Export-(?:Alias|Clixml|Console|Csv|FormatData|ModuleMember|PSSession)|ForEach-Object|Format-(?:Custom|List|Table|Wide)|Get-(?:Alias|ChildItem|Command|ComputerRestorePoint|Content|ControlPanelItem|Culture|Date|Event|EventLog|EventSubscriber|FormatData|Help|History|Host|HotFix|Item|ItemProperty|Job|Location|Member|Module|Process|PSBreakpoint|PSCallStack|PSDrive|PSProvider|PSSession|PSSessionConfiguration|PSSnapin|Random|Service|TraceSource|Transaction|TypeData|UICulture|Unique|Variable|WmiObject)|Group-Object|Import-(?:Alias|Clixml|Csv|LocalizedData|Module|PSSession)|Invoke-(?:Command|Expression|History|Item|RestMethod|WebRequest|WmiMethod)|Join-Path|Limit-EventLog|Measure-(?:Command|Object)|Move-(?:Item|ItemProperty)|New-(?:Alias|Event|EventLog|Item|ItemProperty|Module|ModuleManifest|Object|PSDrive|PSSession|PSSessionConfigurationFile|PSSessionOption|PSTransportOption|Service|TimeSpan|Variable|WebServiceProxy)|Out-(?:Default|File|GridView|Host|Null|Printer|String)|Pop-Location|Push-Location|Read-Host|Receive-(?:Job|PSSession)|Register-(?:EngineEvent|ObjectEvent|PSSessionConfiguration|WmiEvent)|Remove-(?:Computer|Event|EventLog|Item|ItemProperty|Job|Module|PSBreakpoint|PSDrive|PSSession|PSSnapin|TypeData|Variable|WmiObject)|Rename-(?:Computer|Item|ItemProperty)|Reset-ComputerMachinePassword|Resolve-Path|Restart-(?:Computer|Service)|Restore-Computer|Resume-(?:Job|Service)|Save-Help|Select-(?:Object|String|Xml)|Send-MailMessage|Set-(?:Alias|Content|Date|Item|ItemProperty|Location|PSBreakpoint|PSDebug|PSSessionConfiguration|Service|StrictMode|TraceSource|Variable|WmiInstance)|Show-(?:Command|ControlPanelItem|EventLog)|Sort-Object|Split-Path|Start-(?:Job|Process|Service|Sleep|Transaction)|Stop-(?:Computer|Job|Process|Service)|Suspend-(?:Job|Service)|Tee-Object|Test-(?:ComputerSecureChannel|Connection|ModuleManifest|Path|PSSessionConfigurationFile)|Trace-Command|Unblock-File|Undo-Transaction|Unregister-(?:Event|PSSessionConfiguration)|Update-(?:FormatData|Help|List|TypeData)|Use-Transaction|Wait-(?:Event|Job|Process)|Where-Object|Write-(?:Debug|Error|EventLog|Host|Output|Progress|Verbose|Warning))\b/i,
        /\b(?:ac|cat|chdir|clc|cli|clp|clv|compare|copy|cp|cpi|cpp|cvpa|dbp|del|diff|dir|ebp|echo|epal|epcsv|epsn|erase|fc|fl|ft|fw|gal|gbp|gc|gci|gcs|gdr|gi|gl|gm|gp|gps|group|gsv|gu|gv|gwmi|iex|ii|ipal|ipcsv|ipsn|irm|iwmi|iwr|kill|lp|ls|measure|mi|mount|move|mp|mv|nal|ndr|ni|nv|ogv|popd|ps|pushd|pwd|rbp|rd|rdr|ren|ri|rm|rmdir|rni|rnp|rp|rv|rvpa|rwmi|sal|saps|sasv|sbp|sc|select|set|shcm|si|sl|sleep|sls|sort|sp|spps|spsv|start|sv|swmi|tee|trcm|type|write)\b/i
      ],
      keyword: /\b(?:Begin|Break|Catch|Class|Continue|Data|Define|Do|DynamicParam|Else|ElseIf|End|Exit|Filter|Finally|For|ForEach|From|Function|If|InlineScript|Parallel|Param|Process|Return|Sequence|Switch|Throw|Trap|Try|Until|Using|Var|While|Workflow)\b/i,
      operator: {
        pattern: /(\W?)(?:!|-(eq|ne|gt|ge|lt|le|sh[lr]|not|b?(?:and|x?or)|(?:Not)?(?:Like|Match|Contains|In)|Replace|Join|is(?:Not)?|as)\b|-[-=]?|\+[+=]?|[*\/%]=?)/i,
        lookbehind: true
      },
      punctuation: /[|{}[\];(),.]/
    };
    Prism2.languages.powershell.string[0].inside.boolean = Prism2.languages.powershell.boolean;
    Prism2.languages.powershell.string[0].inside.variable = Prism2.languages.powershell.variable;
    Prism2.languages.powershell.string[0].inside.function.inside = Prism2.languages.powershell;
  }
};
var processing_default = {
  language: "processing",
  init: (Prism2) => {
    Prism2.languages.processing = Prism2.languages.extend("clike", {
      keyword: /\b(?:break|catch|case|class|continue|default|else|extends|final|for|if|implements|import|new|null|private|public|return|static|super|switch|this|try|void|while)\b/,
      operator: /<[<=]?|>[>=]?|&&?|\|\|?|[%?]|[!=+\-*\/]=?/
    });
    Prism2.languages.insertBefore("processing", "number", {
      constant: /\b(?!XML\b)[A-Z][A-Z\d_]+\b/,
      type: {
        pattern: /\b(?:boolean|byte|char|color|double|float|int|XML|[A-Z]\w*)\b/,
        alias: "variable"
      }
    });
    Prism2.languages.processing.function.pattern = /\w+(?=\s*\()/;
    Prism2.languages.processing["class-name"].alias = "variable";
  }
};
var prolog_default = {
  language: "prolog",
  init: (Prism2) => {
    Prism2.languages.prolog = {
      comment: [/%.+/, /\/\*[\s\S]*?\*\//],
      string: {
        pattern: /(["'])(?:\1\1|\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
        greedy: true
      },
      builtin: /\b(?:fx|fy|xf[xy]?|yfx?)\b/,
      variable: /\b[A-Z_]\w*/,
      function: /\b[a-z]\w*(?:(?=\()|\/\d+)/,
      number: /\b\d+\.?\d*/,
      operator: /[:\\=><\-?*@\/;+^|!$.]+|\b(?:is|mod|not|xor)\b/,
      punctuation: /[(){}\[\],]/
    };
  }
};
var properties_default = {
  language: "properties",
  init: (Prism2) => {
    Prism2.languages.properties = {
      comment: /^[ \t]*[#!].*$/m,
      "attr-value": {
        pattern: /(^[ \t]*(?:\\(?:\r\n|[\s\S])|[^\\\s:=])+?(?: *[=:] *| ))(?:\\(?:\r\n|[\s\S])|[^\\\r\n])+/m,
        lookbehind: true
      },
      "attr-name": /^[ \t]*(?:\\(?:\r\n|[\s\S])|[^\\\s:=])+?(?= *[=:] *| )/m,
      punctuation: /[=:]/
    };
  }
};
var protobuf_default = {
  language: "protobuf",
  init: (Prism2) => {
    Prism2.languages.protobuf = Prism2.languages.extend("clike", {
      keyword: /\b(?:package|import|message|enum)\b/,
      builtin: /\b(?:required|repeated|optional|reserved)\b/,
      primitive: {
        pattern: /\b(?:double|float|int32|int64|uint32|uint64|sint32|sint64|fixed32|fixed64|sfixed32|sfixed64|bool|string|bytes)\b/,
        alias: "symbol"
      }
    });
  }
};
var pug_default = {
  language: "pug",
  init: (Prism2) => {
    (function(Prism3) {
      Prism3.languages.pug = {
        comment: {
          pattern: /(^([\t ]*))\/\/.*(?:(?:\r?\n|\r)\2[\t ]+.+)*/m,
          lookbehind: true
        },
        "multiline-script": {
          pattern: /(^([\t ]*)script\b.*\.[\t ]*)(?:(?:\r?\n|\r(?!\n))(?:\2[\t ]+.+|\s*?(?=\r?\n|\r)))+/m,
          lookbehind: true,
          inside: {
            rest: Prism3.languages.javascript
          }
        },
        filter: {
          pattern: /(^([\t ]*)):.+(?:(?:\r?\n|\r(?!\n))(?:\2[\t ]+.+|\s*?(?=\r?\n|\r)))+/m,
          lookbehind: true,
          inside: {
            "filter-name": {
              pattern: /^:[\w-]+/,
              alias: "variable"
            }
          }
        },
        "multiline-plain-text": {
          pattern: /(^([\t ]*)[\w\-#.]+\.[\t ]*)(?:(?:\r?\n|\r(?!\n))(?:\2[\t ]+.+|\s*?(?=\r?\n|\r)))+/m,
          lookbehind: true
        },
        markup: {
          pattern: /(^[\t ]*)<.+/m,
          lookbehind: true,
          inside: {
            rest: Prism3.languages.markup
          }
        },
        doctype: {
          pattern: /((?:^|\n)[\t ]*)doctype(?: .+)?/,
          lookbehind: true
        },
        "flow-control": {
          pattern: /(^[\t ]*)(?:if|unless|else|case|when|default|each|while)\b(?: .+)?/m,
          lookbehind: true,
          inside: {
            each: {
              pattern: /^each .+? in\b/,
              inside: {
                keyword: /\b(?:each|in)\b/,
                punctuation: /,/
              }
            },
            branch: {
              pattern: /^(?:if|unless|else|case|when|default|while)\b/,
              alias: "keyword"
            },
            rest: Prism3.languages.javascript
          }
        },
        keyword: {
          pattern: /(^[\t ]*)(?:block|extends|include|append|prepend)\b.+/m,
          lookbehind: true
        },
        mixin: [
          {
            pattern: /(^[\t ]*)mixin .+/m,
            lookbehind: true,
            inside: {
              keyword: /^mixin/,
              function: /\w+(?=\s*\(|\s*$)/,
              punctuation: /[(),.]/
            }
          },
          {
            pattern: /(^[\t ]*)\+.+/m,
            lookbehind: true,
            inside: {
              name: {
                pattern: /^\+\w+/,
                alias: "function"
              },
              rest: Prism3.languages.javascript
            }
          }
        ],
        script: {
          pattern: /(^[\t ]*script(?:(?:&[^(]+)?\([^)]+\))*[\t ]+).+/m,
          lookbehind: true,
          inside: {
            rest: Prism3.languages.javascript
          }
        },
        "plain-text": {
          pattern: /(^[\t ]*(?!-)[\w\-#.]*[\w\-](?:(?:&[^(]+)?\([^)]+\))*\/?[\t ]+).+/m,
          lookbehind: true
        },
        tag: {
          pattern: /(^[\t ]*)(?!-)[\w\-#.]*[\w\-](?:(?:&[^(]+)?\([^)]+\))*\/?:?/m,
          lookbehind: true,
          inside: {
            attributes: [
              {
                pattern: /&[^(]+\([^)]+\)/,
                inside: {
                  rest: Prism3.languages.javascript
                }
              },
              {
                pattern: /\([^)]+\)/,
                inside: {
                  "attr-value": {
                    pattern: /(=\s*)(?:\{[^}]*\}|[^,)\r\n]+)/,
                    lookbehind: true,
                    inside: {
                      rest: Prism3.languages.javascript
                    }
                  },
                  "attr-name": /[\w-]+(?=\s*!?=|\s*[,)])/,
                  punctuation: /[!=(),]+/
                }
              }
            ],
            punctuation: /:/
          }
        },
        code: [
          {
            pattern: /(^[\t ]*(?:-|!?=)).+/m,
            lookbehind: true,
            inside: {
              rest: Prism3.languages.javascript
            }
          }
        ],
        punctuation: /[.\-!=|]+/
      };
      const filter_pattern = "(^([\\t ]*)):{{filter_name}}(?:(?:\\r?\\n|\\r(?!\\n))(?:\\2[\\t ]+.+|\\s*?(?=\\r?\\n|\\r)))+";
      const filters = [
        { filter: "atpl", language: "twig" },
        { filter: "coffee", language: "coffeescript" },
        "ejs",
        "handlebars",
        "hogan",
        "less",
        "livescript",
        "markdown",
        "mustache",
        "plates",
        { filter: "sass", language: "scss" },
        "stylus",
        "swig"
      ];
      const all_filters = {};
      for (let i = 0, l = filters.length;i < l; i++) {
        let filter = filters[i];
        filter = typeof filter === "string" ? { filter, language: filter } : filter;
        if (Prism3.languages[filter.language]) {
          all_filters[`filter-${filter.filter}`] = {
            pattern: RegExp(filter_pattern.replace("{{filter_name}}", filter.filter), "m"),
            lookbehind: true,
            inside: {
              "filter-name": {
                pattern: /^:[\w-]+/,
                alias: "variable"
              },
              rest: Prism3.languages[filter.language]
            }
          };
        }
      }
      Prism3.languages.insertBefore("pug", "filter", all_filters);
    })(Prism2);
  }
};
var puppet_default = {
  language: "puppet",
  init: (Prism2) => {
    (function(Prism3) {
      Prism3.languages.puppet = {
        heredoc: [
          {
            pattern: /(@\("([^"\r\n\/):]+)"(?:\/[nrts$uL]*)?\).*(?:\r?\n|\r))(?:.*(?:\r?\n|\r))*?[ \t]*\|?[ \t]*-?[ \t]*\2/,
            lookbehind: true,
            alias: "string",
            inside: {
              punctuation: /(?=\S).*\S(?= *$)/
            }
          },
          {
            pattern: /(@\(([^"\r\n\/):]+)(?:\/[nrts$uL]*)?\).*(?:\r?\n|\r))(?:.*(?:\r?\n|\r))*?[ \t]*\|?[ \t]*-?[ \t]*\2/,
            lookbehind: true,
            greedy: true,
            alias: "string",
            inside: {
              punctuation: /(?=\S).*\S(?= *$)/
            }
          },
          {
            pattern: /@\("?(?:[^"\r\n\/):]+)"?(?:\/[nrts$uL]*)?\)/,
            alias: "string",
            inside: {
              punctuation: {
                pattern: /(\().+?(?=\))/,
                lookbehind: true
              }
            }
          }
        ],
        "multiline-comment": {
          pattern: /(^|[^\\])\/\*[\s\S]*?\*\//,
          lookbehind: true,
          greedy: true,
          alias: "comment"
        },
        regex: {
          pattern: /((?:\bnode\s+|[~=\(\[\{,]\s*|[=+]>\s*|^\s*))\/(?:[^\/\\]|\\[\s\S])+\/(?:[imx]+\b|\B)/,
          lookbehind: true,
          greedy: true,
          inside: {
            "extended-regex": {
              pattern: /^\/(?:[^\/\\]|\\[\s\S])+\/[im]*x[im]*$/,
              inside: {
                comment: /#.*/
              }
            }
          }
        },
        comment: {
          pattern: /(^|[^\\])#.*/,
          lookbehind: true,
          greedy: true
        },
        string: {
          pattern: /(["'])(?:\$\{(?:[^'"}]|(["'])(?:(?!\2)[^\\]|\\[\s\S])*\2)+\}|(?!\1)[^\\]|\\[\s\S])*\1/,
          greedy: true,
          inside: {
            "double-quoted": {
              pattern: /^"[\s\S]*"$/,
              inside: {}
            }
          }
        },
        variable: {
          pattern: /\$(?:::)?\w+(?:::\w+)*/,
          inside: {
            punctuation: /::/
          }
        },
        "attr-name": /(?:\w+|\*)(?=\s*=>)/,
        function: [
          {
            pattern: /(\.)(?!\d)\w+/,
            lookbehind: true
          },
          /\b(?:contain|debug|err|fail|include|info|notice|realize|require|tag|warning)\b|\b(?!\d)\w+(?=\()/
        ],
        number: /\b(?:0x[a-f\d]+|\d+(?:\.\d+)?(?:e-?\d+)?)\b/i,
        boolean: /\b(?:true|false)\b/,
        keyword: /\b(?:application|attr|case|class|consumes|default|define|else|elsif|function|if|import|inherits|node|private|produces|type|undef|unless)\b/,
        datatype: {
          pattern: /\b(?:Any|Array|Boolean|Callable|Catalogentry|Class|Collection|Data|Default|Enum|Float|Hash|Integer|NotUndef|Numeric|Optional|Pattern|Regexp|Resource|Runtime|Scalar|String|Struct|Tuple|Type|Undef|Variant)\b/,
          alias: "symbol"
        },
        operator: /=[=~>]?|![=~]?|<(?:<\|?|[=~|-])?|>[>=]?|->?|~>|\|>?>?|[*\/%+?]|\b(?:and|in|or)\b/,
        punctuation: /[\[\]{}().,;]|:+/
      };
      const interpolation = [
        {
          pattern: /(^|[^\\])\$\{(?:[^'"{}]|\{[^}]*\}|(["'])(?:(?!\2)[^\\]|\\[\s\S])*\2)+\}/,
          lookbehind: true,
          inside: {
            "short-variable": {
              pattern: /(^\$\{)(?!\w+\()(?:::)?\w+(?:::\w+)*/,
              lookbehind: true,
              alias: "variable",
              inside: {
                punctuation: /::/
              }
            },
            delimiter: {
              pattern: /^\$/,
              alias: "variable"
            },
            rest: Prism3.languages.puppet
          }
        },
        {
          pattern: /(^|[^\\])\$(?:::)?\w+(?:::\w+)*/,
          lookbehind: true,
          alias: "variable",
          inside: {
            punctuation: /::/
          }
        }
      ];
      Prism3.languages.puppet.heredoc[0].inside.interpolation = interpolation;
      Prism3.languages.puppet.string.inside["double-quoted"].inside.interpolation = interpolation;
    })(Prism2);
  }
};
var pure_default = {
  language: "pure",
  init: (Prism2) => {
    (function(Prism3) {
      Prism3.languages.pure = {
        comment: [
          {
            pattern: /(^|[^\\])\/\*[\s\S]*?\*\//,
            lookbehind: true
          },
          {
            pattern: /(^|[^\\:])\/\/.*/,
            lookbehind: true
          },
          /#!.+/
        ],
        "inline-lang": {
          pattern: /%<[\s\S]+?%>/,
          greedy: true,
          inside: {
            lang: {
              pattern: /(^%< *)-\*-.+?-\*-/,
              lookbehind: true,
              alias: "comment"
            },
            delimiter: {
              pattern: /^%<.*|%>$/,
              alias: "punctuation"
            }
          }
        },
        string: {
          pattern: /"(?:\\.|[^"\\\r\n])*"/,
          greedy: true
        },
        number: {
          pattern: /((?:\.\.)?)(?:\b(?:inf|nan)\b|\b0x[\da-f]+|(?:\b(?:0b)?\d+(?:\.\d)?|\B\.\d)\d*(?:e[+-]?\d+)?L?)/i,
          lookbehind: true
        },
        keyword: /\b(?:ans|break|bt|case|catch|cd|clear|const|def|del|dump|else|end|exit|extern|false|force|help|if|infix[lr]?|interface|let|ls|mem|namespace|nonfix|NULL|of|otherwise|outfix|override|postfix|prefix|private|public|pwd|quit|run|save|show|stats|then|throw|trace|true|type|underride|using|when|with)\b/,
        function: /\b(?:abs|add_(?:(?:fundef|interface|macdef|typedef)(?:_at)?|addr|constdef|vardef)|all|any|applp?|arity|bigintp?|blob(?:_crc|_size|p)?|boolp?|byte_(?:matrix|pointer)|byte_c?string(?:_pointer)?|calloc|cat|catmap|ceil|char[ps]?|check_ptrtag|chr|clear_sentry|clearsym|closurep?|cmatrixp?|cols?|colcat(?:map)?|colmap|colrev|colvector(?:p|seq)?|complex(?:_float_(?:matrix|pointer)|_matrix(?:_view)?|_pointer|p)?|conj|cookedp?|cst|cstring(?:_(?:dup|list|vector))?|curry3?|cyclen?|del_(?:constdef|fundef|interface|macdef|typedef|vardef)|delete|diag(?:mat)?|dim|dmatrixp?|do|double(?:_matrix(?:_view)?|_pointer|p)?|dowith3?|drop|dropwhile|eval(?:cmd)?|exactp|filter|fix|fixity|flip|float(?:_matrix|_pointer)|floor|fold[lr]1?|frac|free|funp?|functionp?|gcd|get(?:_(?:byte|constdef|double|float|fundef|int(?:64)?|interface(?:_typedef)?|long|macdef|pointer|ptrtag|short|sentry|string|typedef|vardef))?|globsym|hash|head|id|im|imatrixp?|index|inexactp|infp|init|insert|int(?:_matrix(?:_view)?|_pointer|p)?|int64_(?:matrix|pointer)|integerp?|iteraten?|iterwhile|join|keys?|lambdap?|last(?:err(?:pos)?)?|lcd|list[2p]?|listmap|make_ptrtag|malloc|map|matcat|matrixp?|max|member|min|nanp|nargs|nmatrixp?|null|numberp?|ord|pack(?:ed)?|pointer(?:_cast|_tag|_type|p)?|pow|pred|ptrtag|put(?:_(?:byte|double|float|int(?:64)?|long|pointer|short|string))?|rationalp?|re|realp?|realloc|recordp?|redim|reduce(?:_with)?|refp?|repeatn?|reverse|rlistp?|round|rows?|rowcat(?:map)?|rowmap|rowrev|rowvector(?:p|seq)?|same|scan[lr]1?|sentry|sgn|short_(?:matrix|pointer)|slice|smatrixp?|sort|split|str|strcat|stream|stride|string(?:_(?:dup|list|vector)|p)?|subdiag(?:mat)?|submat|subseq2?|substr|succ|supdiag(?:mat)?|symbolp?|tail|take|takewhile|thunkp?|transpose|trunc|tuplep?|typep|ubyte|uint(?:64)?|ulong|uncurry3?|unref|unzip3?|update|ushort|vals?|varp?|vector(?:p|seq)?|void|zip3?|zipwith3?)\b/,
        special: {
          pattern: /\b__[a-z]+__\b/i,
          alias: "builtin"
        },
        operator: /(?=\b_|[^_])[!"#$%&'*+,\-.\/:<=>?@\\^_`|~\u00a1-\u00bf\u00d7-\u00f7\u20d0-\u2bff]+|\b(?:and|div|mod|not|or)\b/,
        punctuation: /[(){}\[\];,|]/
      };
      const inlineLanguages = [
        "c",
        { lang: "c++", alias: "cpp" },
        "fortran",
        "ats",
        "dsp"
      ];
      const inlineLanguageRe = "%< *-\\*- *{lang}\\d* *-\\*-[\\s\\S]+?%>";
      inlineLanguages.forEach((lang) => {
        let alias = lang;
        if (typeof lang !== "string") {
          alias = lang.alias;
          lang = lang.lang;
        }
        if (Prism3.languages[alias]) {
          const o = {};
          o[`inline-lang-${alias}`] = {
            pattern: RegExp(inlineLanguageRe.replace("{lang}", lang.replace(/([.+*?\/\\(){}\[\]])/g, "\\$1")), "i"),
            inside: Prism3.util.clone(Prism3.languages.pure["inline-lang"].inside)
          };
          o[`inline-lang-${alias}`].inside.rest = Prism3.util.clone(Prism3.languages[alias]);
          Prism3.languages.insertBefore("pure", "inline-lang", o);
        }
      });
      if (Prism3.languages.c) {
        Prism3.languages.pure["inline-lang"].inside.rest = Prism3.util.clone(Prism3.languages.c);
      }
    })(Prism2);
  }
};
var python_default = {
  language: "python",
  init: (Prism2) => {
    Prism2.languages.python = {
      comment: {
        pattern: /(^|[^\\])#.*/,
        lookbehind: true
      },
      "triple-quoted-string": {
        pattern: /("""|''')[\s\S]+?\1/,
        greedy: true,
        alias: "string"
      },
      string: {
        pattern: /("|')(?:\\.|(?!\1)[^\\\r\n])*\1/,
        greedy: true
      },
      function: {
        pattern: /((?:^|\s)def[ \t]+)[a-zA-Z_]\w*(?=\s*\()/g,
        lookbehind: true
      },
      "class-name": {
        pattern: /(\bclass\s+)\w+/i,
        lookbehind: true
      },
      keyword: /\b(?:as|assert|async|await|break|class|continue|def|del|elif|else|except|exec|finally|for|from|global|if|import|in|is|lambda|nonlocal|pass|print|raise|return|try|while|with|yield)\b/,
      builtin: /\b(?:__import__|abs|all|any|apply|ascii|basestring|bin|bool|buffer|bytearray|bytes|callable|chr|classmethod|cmp|coerce|compile|complex|delattr|dict|dir|divmod|enumerate|eval|execfile|file|filter|float|format|frozenset|getattr|globals|hasattr|hash|help|hex|id|input|int|intern|isinstance|issubclass|iter|len|list|locals|long|map|max|memoryview|min|next|object|oct|open|ord|pow|property|range|raw_input|reduce|reload|repr|reversed|round|set|setattr|slice|sorted|staticmethod|str|sum|super|tuple|type|unichr|unicode|vars|xrange|zip)\b/,
      boolean: /\b(?:True|False|None)\b/,
      number: /(?:\b(?=\d)|\B(?=\.))(?:0[bo])?(?:(?:\d|0x[\da-f])[\da-f]*\.?\d*|\.\d+)(?:e[+-]?\d+)?j?\b/i,
      operator: /[-+%=]=?|!=|\*\*?=?|\/\/?=?|<[<=>]?|>[=>]?|[&|^~]|\b(?:or|and|not)\b/,
      punctuation: /[{}[\];(),.:]/
    };
  }
};
var q_default = {
  language: "q",
  init: (Prism2) => {
    Prism2.languages.q = {
      string: /"(?:\\.|[^"\\\r\n])*"/,
      comment: [
        {
          pattern: /([\t )\]}])\/.*/,
          lookbehind: true,
          greedy: true
        },
        {
          pattern: /(^|\r?\n|\r)\/[\t ]*(?:(?:\r?\n|\r)(?:.*(?:\r?\n|\r))*?(?:\\(?=[\t ]*(?:\r?\n|\r))|$)|\S.*)/,
          lookbehind: true,
          greedy: true
        },
        {
          pattern: /^\\[\t ]*(?:\r?\n|\r)[\s\S]+/m,
          greedy: true
        },
        {
          pattern: /^#!.+/m,
          greedy: true
        }
      ],
      symbol: /`(?::\S+|[\w.]*)/,
      datetime: {
        pattern: /0N[mdzuvt]|0W[dtz]|\d{4}\.\d\d(?:m|\.\d\d(?:T(?:\d\d(?::\d\d(?::\d\d(?:[.:]\d\d\d)?)?)?)?)?[dz]?)|\d\d:\d\d(?::\d\d(?:[.:]\d\d\d)?)?[uvt]?/,
        alias: "number"
      },
      number: /\b(?![01]:)(?:0[wn]|0W[hj]?|0N[hje]?|0x[\da-fA-F]+|\d+\.?\d*(?:e[+-]?\d+)?[hjfeb]?)/,
      keyword: /\\\w+\b|\b(?:abs|acos|aj0?|all|and|any|asc|asin|asof|atan|attr|avgs?|binr?|by|ceiling|cols|cor|cos|count|cov|cross|csv|cut|delete|deltas|desc|dev|differ|distinct|div|do|dsave|ej|enlist|eval|except|exec|exit|exp|fby|fills|first|fkeys|flip|floor|from|get|getenv|group|gtime|hclose|hcount|hdel|hopen|hsym|iasc|identity|idesc|if|ij|in|insert|inter|inv|keys?|last|like|list|ljf?|load|log|lower|lsq|ltime|ltrim|mavg|maxs?|mcount|md5|mdev|med|meta|mins?|mmax|mmin|mmu|mod|msum|neg|next|not|null|or|over|parse|peach|pj|plist|prds?|prev|prior|rand|rank|ratios|raze|read0|read1|reciprocal|reval|reverse|rload|rotate|rsave|rtrim|save|scan|scov|sdev|select|set|setenv|show|signum|sin|sqrt|ssr?|string|sublist|sums?|sv|svar|system|tables|tan|til|trim|txf|type|uj|ungroup|union|update|upper|upsert|value|var|views?|vs|wavg|where|while|within|wj1?|wsum|ww|xasc|xbar|xcols?|xdesc|xexp|xgroup|xkey|xlog|xprev|xrank)\b/,
      adverb: {
        pattern: /['\/\\]:?|\beach\b/,
        alias: "function"
      },
      verb: {
        pattern: /(?:\B\.\B|\b[01]:|<[=>]?|>=?|[:+\-*%,!?_~=|$&#@^]):?/,
        alias: "operator"
      },
      punctuation: /[(){}\[\];.]/
    };
  }
};
var qore_default = {
  language: "qore",
  init: (Prism2) => {
    Prism2.languages.qore = Prism2.languages.extend("clike", {
      comment: {
        pattern: /(^|[^\\])(?:\/\*[\s\S]*?\*\/|(?:\/\/|#).*)/,
        lookbehind: true
      },
      string: {
        pattern: /("|')(\\[\s\S]|(?!\1)[^\\])*\1/,
        greedy: true
      },
      variable: /\$(?!\d)\w+\b/,
      keyword: /\b(?:abstract|any|assert|binary|bool|boolean|break|byte|case|catch|char|class|code|const|continue|data|default|do|double|else|enum|extends|final|finally|float|for|goto|hash|if|implements|import|inherits|instanceof|int|interface|long|my|native|new|nothing|null|object|our|own|private|reference|rethrow|return|short|soft(?:int|float|number|bool|string|date|list)|static|strictfp|string|sub|super|switch|synchronized|this|throw|throws|transient|try|void|volatile|while)\b/,
      number: /\b(?:0b[01]+|0x[\da-f]*\.?[\da-fp\-]+|\d*\.?\d+e?\d*[df]|\d*\.?\d+)\b/i,
      boolean: /\b(?:true|false)\b/i,
      operator: {
        pattern: /(^|[^.])(?:\+[+=]?|-[-=]?|[!=](?:==?|~)?|>>?=?|<(?:=>?|<=?)?|&[&=]?|\|[|=]?|[*\/%^]=?|[~?])/,
        lookbehind: true
      },
      function: /\$?\b(?!\d)\w+(?=\()/
    });
  }
};
var r_default = {
  language: "r",
  init: (Prism2) => {
    Prism2.languages.r = {
      comment: /#.*/,
      string: {
        pattern: /(['"])(?:\\.|(?!\1)[^\\\r\n])*\1/,
        greedy: true
      },
      "percent-operator": {
        pattern: /%[^%\s]*%/,
        alias: "operator"
      },
      boolean: /\b(?:TRUE|FALSE)\b/,
      ellipsis: /\.\.(?:\.|\d+)/,
      number: [
        /\b(?:NaN|Inf)\b/,
        /(?:\b0x[\dA-Fa-f]+(?:\.\d*)?|\b\d+\.?\d*|\B\.\d+)(?:[EePp][+-]?\d+)?[iL]?/
      ],
      keyword: /\b(?:if|else|repeat|while|function|for|in|next|break|NULL|NA|NA_integer_|NA_real_|NA_complex_|NA_character_)\b/,
      operator: /->?>?|<(?:=|<?-)?|[>=!]=?|::?|&&?|\|\|?|[+*\/^$@~]/,
      punctuation: /[(){}\[\],;]/
    };
  }
};
var renpy_default = {
  language: "renpy",
  init: (Prism2) => {
    Prism2.languages.renpy = {
      comment: {
        pattern: /(^|[^\\])#.+/,
        lookbehind: true
      },
      string: {
        pattern: /("""|''')[\s\S]+?\1|("|')(?:\\.|(?!\2)[^\\\r\n])*\2|(?:^#?(?:(?:[0-9a-fA-F]{2}){3}|(?:[0-9a-fA-F]){3})$)/m,
        greedy: true
      },
      function: /[a-z_]\w*(?=\()/i,
      property: /\b(?:insensitive|idle|hover|selected_idle|selected_hover|background|position|alt|xpos|ypos|pos|xanchor|yanchor|anchor|xalign|yalign|align|xcenter|ycenter|xofsset|yoffset|ymaximum|maximum|xmaximum|xminimum|yminimum|minimum|xsize|ysizexysize|xfill|yfill|area|antialias|black_color|bold|caret|color|first_indent|font|size|italic|justify|kerning|language|layout|line_leading|line_overlap_split|line_spacing|min_width|newline_indent|outlines|rest_indent|ruby_style|slow_cps|slow_cps_multiplier|strikethrough|text_align|underline|hyperlink_functions|vertical|hinting|foreground|left_margin|xmargin|top_margin|bottom_margin|ymargin|left_padding|right_padding|xpadding|top_padding|bottom_padding|ypadding|size_group|child|hover_sound|activate_sound|mouse|focus_mask|keyboard_focus|bar_vertical|bar_invert|bar_resizing|left_gutter|right_gutter|top_gutter|bottom_gutter|left_bar|right_bar|top_bar|bottom_bar|thumb|thumb_shadow|thumb_offset|unscrollable|spacing|first_spacing|box_reverse|box_wrap|order_reverse|fit_first|ysize|thumbnail_width|thumbnail_height|help|text_ypos|text_xpos|idle_color|hover_color|selected_idle_color|selected_hover_color|insensitive_color|alpha|insensitive_background|hover_background|zorder|value|width|xadjustment|xanchoraround|xaround|xinitial|xoffset|xzoom|yadjustment|yanchoraround|yaround|yinitial|yzoom|zoom|ground|height|text_style|text_y_fudge|selected_insensitive|has_sound|has_music|has_voice|focus|hovered|image_style|length|minwidth|mousewheel|offset|prefix|radius|range|right_margin|rotate|rotate_pad|developer|screen_width|screen_height|window_title|name|version|windows_icon|default_fullscreen|default_text_cps|default_afm_time|main_menu_music|sample_sound|enter_sound|exit_sound|save_directory|enter_transition|exit_transition|intra_transition|main_game_transition|game_main_transition|end_splash_transition|end_game_transition|after_load_transition|window_show_transition|window_hide_transition|adv_nvl_transition|nvl_adv_transition|enter_yesno_transition|exit_yesno_transition|enter_replay_transition|exit_replay_transition|say_attribute_transition|directory_name|executable_name|include_update|window_icon|modal|google_play_key|google_play_salt|drag_name|drag_handle|draggable|dragged|droppable|dropped|narrator_menu|action|default_afm_enable|version_name|version_tuple|inside|fadeout|fadein|layers|layer_clipping|linear|scrollbars|side_xpos|side_ypos|side_spacing|edgescroll|drag_joined|drag_raise|drop_shadow|drop_shadow_color|subpixel|easein|easeout|time|crop|auto|update|get_installed_packages|can_update|UpdateVersion|Update|overlay_functions|translations|window_left_padding|show_side_image|show_two_window)\b/,
      tag: /\b(?:label|image|menu|[hv]box|frame|text|imagemap|imagebutton|bar|vbar|screen|textbutton|buttoscreenn|fixed|grid|input|key|mousearea|side|timer|viewport|window|hotspot|hotbar|self|button|drag|draggroup|tag|mm_menu_frame|nvl|block|parallel)\b|\$/,
      keyword: /\b(?:as|assert|break|class|continue|def|del|elif|else|except|exec|finally|for|from|global|if|import|in|is|lambda|pass|print|raise|return|try|while|yield|adjustment|alignaround|allow|angle|around|box_layout|cache|changed|child_size|clicked|clipping|corner1|corner2|default|delay|exclude|scope|slow|slow_abortable|slow_done|sound|style_group|substitute|suffix|transform_anchor|transpose|unhovered|config|theme|mm_root|gm_root|rounded_window|build|disabled_text|disabled|widget_selected|widget_text|widget_hover|widget|updater|behind|call|expression|hide|init|jump|onlayer|python|renpy|scene|set|show|transform|play|queue|stop|pause|define|window|repeat|contains|choice|on|function|event|animation|clockwise|counterclockwise|circles|knot|null|None|random|has|add|use|fade|dissolve|style|store|id|voice|center|left|right|less_rounded|music|movie|clear|persistent|ui)\b/,
      boolean: /\b(?:[Tt]rue|[Ff]alse)\b/,
      number: /(?:\b(?:0[bo])?(?:(?:\d|0x[\da-f])[\da-f]*\.?\d*)|\B\.\d+)(?:e[+-]?\d+)?j?/i,
      operator: /[-+%=]=?|!=|\*\*?=?|\/\/?=?|<[<=>]?|>[=>]?|[&|^~]|\b(?:or|and|not|with|at)\b/,
      punctuation: /[{}[\];(),.:]/
    };
  }
};
var rest_default = {
  language: "rest",
  init: (Prism2) => {
    Prism2.languages.rest = {
      table: [
        {
          pattern: /(\s*)(?:\+[=-]+)+\+(?:\r?\n|\r)(?:\1(?:[+|].+)+[+|](?:\r?\n|\r))+\1(?:\+[=-]+)+\+/,
          lookbehind: true,
          inside: {
            punctuation: /\||(?:\+[=-]+)+\+/
          }
        },
        {
          pattern: /(\s*)(?:=+ +)+=+(?:(?:\r?\n|\r)\1.+)+(?:\r?\n|\r)\1(?:=+ +)+=+(?=(?:\r?\n|\r){2}|\s*$)/,
          lookbehind: true,
          inside: {
            punctuation: /[=-]+/
          }
        }
      ],
      "substitution-def": {
        pattern: /(^\s*\.\. )\|(?:[^|\s](?:[^|]*[^|\s])?)\| [^:]+::/m,
        lookbehind: true,
        inside: {
          substitution: {
            pattern: /^\|(?:[^|\s]|[^|\s][^|]*[^|\s])\|/,
            alias: "attr-value",
            inside: {
              punctuation: /^\||\|$/
            }
          },
          directive: {
            pattern: /( +)[^:]+::/,
            lookbehind: true,
            alias: "function",
            inside: {
              punctuation: /::$/
            }
          }
        }
      },
      "link-target": [
        {
          pattern: /(^\s*\.\. )\[[^\]]+\]/m,
          lookbehind: true,
          alias: "string",
          inside: {
            punctuation: /^\[|\]$/
          }
        },
        {
          pattern: /(^\s*\.\. )_(?:`[^`]+`|(?:[^:\\]|\\.)+):/m,
          lookbehind: true,
          alias: "string",
          inside: {
            punctuation: /^_|:$/
          }
        }
      ],
      directive: {
        pattern: /(^\s*\.\. )[^:]+::/m,
        lookbehind: true,
        alias: "function",
        inside: {
          punctuation: /::$/
        }
      },
      comment: {
        pattern: /(^\s*\.\.)(?:(?: .+)?(?:(?:\r?\n|\r).+)+| .+)(?=(?:\r?\n|\r){2}|$)/m,
        lookbehind: true
      },
      title: [
        {
          pattern: /^(([!"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~])\2+)(?:\r?\n|\r).+(?:\r?\n|\r)\1$/m,
          inside: {
            punctuation: /^[!"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~]+|[!"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~]+$/,
            important: /.+/
          }
        },
        {
          pattern: /(^|(?:\r?\n|\r){2}).+(?:\r?\n|\r)([!"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~])\2+(?=\r?\n|\r|$)/,
          lookbehind: true,
          inside: {
            punctuation: /[!"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~]+$/,
            important: /.+/
          }
        }
      ],
      hr: {
        pattern: /((?:\r?\n|\r){2})([!"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~])\2{3,}(?=(?:\r?\n|\r){2})/,
        lookbehind: true,
        alias: "punctuation"
      },
      field: {
        pattern: /(^\s*):[^:\r\n]+:(?= )/m,
        lookbehind: true,
        alias: "attr-name"
      },
      "command-line-option": {
        pattern: /(^\s*)(?:[+-][a-z\d]|(?:--|\/)[a-z\d-]+)(?:[ =](?:[a-z][\w-]*|<[^<>]+>))?(?:, (?:[+-][a-z\d]|(?:--|\/)[a-z\d-]+)(?:[ =](?:[a-z][\w-]*|<[^<>]+>))?)*(?=(?:\r?\n|\r)? {2,}\S)/im,
        lookbehind: true,
        alias: "symbol"
      },
      "literal-block": {
        pattern: /::(?:\r?\n|\r){2}([ \t]+).+(?:(?:\r?\n|\r)\1.+)*/,
        inside: {
          "literal-block-punctuation": {
            pattern: /^::/,
            alias: "punctuation"
          }
        }
      },
      "quoted-literal-block": {
        pattern: /::(?:\r?\n|\r){2}([!"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~]).*(?:(?:\r?\n|\r)\1.*)*/,
        inside: {
          "literal-block-punctuation": {
            pattern: /^(?:::|([!"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~])\1*)/m,
            alias: "punctuation"
          }
        }
      },
      "list-bullet": {
        pattern: /(^\s*)(?:[*+\-\u2022\u2023\u2043]|\(?(?:\d+|[a-z]|[ivxdclm]+)\)|(?:\d+|[a-z]|[ivxdclm]+)\.)(?= )/im,
        lookbehind: true,
        alias: "punctuation"
      },
      "doctest-block": {
        pattern: /(^\s*)>>> .+(?:(?:\r?\n|\r).+)*/m,
        lookbehind: true,
        inside: {
          punctuation: /^>>>/
        }
      },
      inline: [
        {
          pattern: /(^|[\s\-:\/'"<(\[{])(?::[^:]+:`.*?`|`.*?`:[^:]+:|(\*\*?|``?|\|)(?!\s).*?[^\s]\2(?=[\s\-.,:;!?\\\/'")\]}]|$))/m,
          lookbehind: true,
          inside: {
            bold: {
              pattern: /(^\*\*).+(?=\*\*$)/,
              lookbehind: true
            },
            italic: {
              pattern: /(^\*).+(?=\*$)/,
              lookbehind: true
            },
            "inline-literal": {
              pattern: /(^``).+(?=``$)/,
              lookbehind: true,
              alias: "symbol"
            },
            role: {
              pattern: /^:[^:]+:|:[^:]+:$/,
              alias: "function",
              inside: {
                punctuation: /^:|:$/
              }
            },
            "interpreted-text": {
              pattern: /(^`).+(?=`$)/,
              lookbehind: true,
              alias: "attr-value"
            },
            substitution: {
              pattern: /(^\|).+(?=\|$)/,
              lookbehind: true,
              alias: "attr-value"
            },
            punctuation: /\*\*?|``?|\|/
          }
        }
      ],
      link: [
        {
          pattern: /\[[^\]]+\]_(?=[\s\-.,:;!?\\\/'")\]}]|$)/,
          alias: "string",
          inside: {
            punctuation: /^\[|\]_$/
          }
        },
        {
          pattern: /(?:\b[a-z\d](?:[_.:+]?[a-z\d]+)*_?_|`[^`]+`_?_|_`[^`]+`)(?=[\s\-.,:;!?\\\/'")\]}]|$)/i,
          alias: "string",
          inside: {
            punctuation: /^_?`|`$|`?_?_$/
          }
        }
      ],
      punctuation: {
        pattern: /(^\s*)(?:\|(?= |$)|(?:---?|\u2014|\.\.|__)(?= )|\.\.$)/m,
        lookbehind: true
      }
    };
  }
};
var rip_default = {
  language: "rip",
  init: (Prism2) => {
    Prism2.languages.rip = {
      comment: /#.*/,
      keyword: /(?:=>|->)|\b(?:class|if|else|switch|case|return|exit|try|catch|finally|raise)\b/,
      builtin: /@|\bSystem\b/,
      boolean: /\b(?:true|false)\b/,
      date: /\b\d{4}-\d{2}-\d{2}\b/,
      time: /\b\d{2}:\d{2}:\d{2}\b/,
      datetime: /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\b/,
      character: /\B`[^\s`'",.:;#\/\\()<>\[\]{}]\b/,
      regex: {
        pattern: /(^|[^/])\/(?!\/)(\[.+?]|\\.|[^/\\\r\n])+\/(?=\s*($|[\r\n,.;})]))/,
        lookbehind: true,
        greedy: true
      },
      symbol: /:[^\d\s`'",.:;#\/\\()<>\[\]{}][^\s`'",.:;#\/\\()<>\[\]{}]*/,
      string: {
        pattern: /("|')(?:\\.|(?!\1)[^\\\r\n])*\1/,
        greedy: true
      },
      number: /[+-]?(?:(?:\d+\.\d+)|(?:\d+))/,
      punctuation: /(?:\.{2,3})|[`,.:;=\/\\()<>\[\]{}]/,
      reference: /[^\d\s`'",.:;#\/\\()<>\[\]{}][^\s`'",.:;#\/\\()<>\[\]{}]*/
    };
  }
};
var roboconf_default = {
  language: "roboconf",
  init: (Prism2) => {
    Prism2.languages.roboconf = {
      comment: /#.*/,
      keyword: {
        pattern: /(^|\s)(?:(?:facet|instance of)(?=[ \t]+[\w-]+[ \t]*\{)|(?:external|import)\b)/,
        lookbehind: true
      },
      component: {
        pattern: /[\w-]+(?=[ \t]*\{)/,
        alias: "variable"
      },
      property: /[\w.-]+(?=[ \t]*:)/,
      value: {
        pattern: /(=[ \t]*)[^,;]+/,
        lookbehind: true,
        alias: "attr-value"
      },
      optional: {
        pattern: /\(optional\)/,
        alias: "builtin"
      },
      wildcard: {
        pattern: /(\.)\*/,
        lookbehind: true,
        alias: "operator"
      },
      punctuation: /[{},.;:=]/
    };
  }
};
var rust_default = {
  language: "rust",
  init: (Prism2) => {
    Prism2.languages.rust = {
      comment: [
        {
          pattern: /(^|[^\\])\/\*[\s\S]*?\*\//,
          lookbehind: true
        },
        {
          pattern: /(^|[^\\:])\/\/.*/,
          lookbehind: true
        }
      ],
      string: [
        {
          pattern: /b?r(#*)"(?:\\.|(?!"\1)[^\\\r\n])*"\1/,
          greedy: true
        },
        {
          pattern: /b?"(?:\\.|[^\\\r\n"])*"/,
          greedy: true
        }
      ],
      char: {
        pattern: /b?'(?:\\(?:x[0-7][\da-fA-F]|u{(?:[\da-fA-F]_*){1,6}|.)|[^\\\r\n\t'])'/,
        alias: "string"
      },
      "lifetime-annotation": {
        pattern: /'[^\s>']+/,
        alias: "symbol"
      },
      keyword: /\b(?:abstract|alignof|as|be|box|break|const|continue|crate|do|else|enum|extern|false|final|fn|for|if|impl|in|let|loop|match|mod|move|mut|offsetof|once|override|priv|pub|pure|ref|return|sizeof|static|self|struct|super|true|trait|type|typeof|unsafe|unsized|use|virtual|where|while|yield)\b/,
      attribute: {
        pattern: /#!?\[.+?\]/,
        greedy: true,
        alias: "attr-name"
      },
      function: [
        /\w+(?=\s*\()/,
        /\w+!(?=\s*\(|\[)/
      ],
      "macro-rules": {
        pattern: /\w+!/,
        alias: "function"
      },
      number: /\b(?:0x[\dA-Fa-f](?:_?[\dA-Fa-f])*|0o[0-7](?:_?[0-7])*|0b[01](?:_?[01])*|(\d(?:_?\d)*)?\.?\d(?:_?\d)*(?:[Ee][+-]?\d+)?)(?:_?(?:[iu](?:8|16|32|64)?|f32|f64))?\b/,
      "closure-params": {
        pattern: /\|[^|]*\|(?=\s*[{-])/,
        inside: {
          punctuation: /[|:,]/,
          operator: /[&*]/
        }
      },
      punctuation: /[{}[\];(),:]|\.+|->/,
      operator: /[-+*\/%!^]=?|=[=>]?|@|&[&=]?|\|[|=]?|<<?=?|>>?=?/
    };
  }
};
var sas_default = {
  language: "sas",
  init: (Prism2) => {
    Prism2.languages.sas = {
      datalines: {
        pattern: /^\s*(?:(?:data)?lines|cards);[\s\S]+?(?:\r?\n|\r);/im,
        alias: "string",
        inside: {
          keyword: {
            pattern: /^(\s*)(?:(?:data)?lines|cards)/i,
            lookbehind: true
          },
          punctuation: /;/
        }
      },
      comment: [
        {
          pattern: /(^\s*|;\s*)\*.*;/m,
          lookbehind: true
        },
        /\/\*[\s\S]+?\*\//
      ],
      datetime: {
        pattern: /'[^']+'(?:dt?|t)\b/i,
        alias: "number"
      },
      string: {
        pattern: /(["'])(?:\1\1|(?!\1)[\s\S])*\1/,
        greedy: true
      },
      keyword: /\b(?:data|else|format|if|input|proc\s\w+|quit|run|then)\b/i,
      number: /\b(?:[\da-f]+x|\d+(?:\.\d+)?(?:e[+-]?\d+)?)/i,
      operator: /\*\*?|\|\|?|!!?|\u00A6\u00A6?|<[>=]?|>[<=]?|[-+\/=&]|[~\u00AC^]=?|\b(?:eq|ne|gt|lt|ge|le|in|not)\b/i,
      punctuation: /[$%@.(){}\[\];,\\]/
    };
  }
};
var scheme_default = {
  language: "scheme",
  init: (Prism2) => {
    Prism2.languages.scheme = {
      comment: /;.*/,
      string: {
        pattern: /"(?:[^"\\\r\n]|\\.)*"|'[^('\s]*/,
        greedy: true
      },
      keyword: {
        pattern: /(\()(?:define(?:-syntax|-library|-values)?|(?:case-)?lambda|let(?:\*|rec)?(?:-values)?|else|if|cond|begin|delay(?:-force)?|parameterize|guard|set!|(?:quasi-)?quote|syntax-rules)/,
        lookbehind: true
      },
      builtin: {
        pattern: /(\()(?:(?:cons|car|cdr|list|call-with-current-continuation|call\/cc|append|abs|apply|eval)\b|null\?|pair\?|boolean\?|eof-object\?|char\?|procedure\?|number\?|port\?|string\?|vector\?|symbol\?|bytevector\?)/,
        lookbehind: true
      },
      number: {
        pattern: /(\s|[()])[-+]?\d*\.?\d+(?:\s*[-+]\s*\d*\.?\d+i)?\b/,
        lookbehind: true
      },
      boolean: /#[tf]/,
      operator: {
        pattern: /(\()(?:[-+*%\/]|[<>]=?|=>?)/,
        lookbehind: true
      },
      function: {
        pattern: /(\()[^\s()]*(?=\s)/,
        lookbehind: true
      },
      punctuation: /[()]/
    };
  }
};
var smalltalk_default = {
  language: "smalltalk",
  init: (Prism2) => {
    Prism2.languages.smalltalk = {
      comment: /"(?:""|[^"])+"/,
      string: /'(?:''|[^'])+'/,
      symbol: /#[\da-z]+|#(?:-|([+\/\\*~<>=@%|&?!])\1?)|#(?=\()/i,
      "block-arguments": {
        pattern: /(\[\s*):[^\[|]*\|/,
        lookbehind: true,
        inside: {
          variable: /:[\da-z]+/i,
          punctuation: /\|/
        }
      },
      "temporary-variables": {
        pattern: /\|[^|]+\|/,
        inside: {
          variable: /[\da-z]+/i,
          punctuation: /\|/
        }
      },
      keyword: /\b(?:nil|true|false|self|super|new)\b/,
      character: {
        pattern: /\$./,
        alias: "string"
      },
      number: [
        /\d+r-?[\dA-Z]+(?:\.[\dA-Z]+)?(?:e-?\d+)?/,
        /\b\d+(?:\.\d+)?(?:e-?\d+)?/
      ],
      operator: /[<=]=?|:=|~[~=]|\/\/?|\\\\|>[>=]?|[!^+\-*&|,@]/,
      punctuation: /[.;:?\[\](){}]/
    };
  }
};
var smarty_default = {
  language: "smarty",
  init: (Prism2) => {
    (function(Prism3) {
      Prism3.languages.smarty = {
        comment: /\{\*[\s\S]*?\*\}/,
        delimiter: {
          pattern: /^\{|\}$/i,
          alias: "punctuation"
        },
        string: /(["'])(?:\\.|(?!\1)[^\\\r\n])*\1/,
        number: /\b0x[\dA-Fa-f]+|(?:\b\d+\.?\d*|\B\.\d+)(?:[Ee][-+]?\d+)?/,
        variable: [
          /\$(?!\d)\w+/,
          /#(?!\d)\w+#/,
          {
            pattern: /(\.|->)(?!\d)\w+/,
            lookbehind: true
          },
          {
            pattern: /(\[)(?!\d)\w+(?=\])/,
            lookbehind: true
          }
        ],
        function: [
          {
            pattern: /(\|\s*)@?(?!\d)\w+/,
            lookbehind: true
          },
          /^\/?(?!\d)\w+/,
          /(?!\d)\w+(?=\()/
        ],
        "attr-name": {
          pattern: /\w+\s*=\s*(?:(?!\d)\w+)?/,
          inside: {
            variable: {
              pattern: /(=\s*)(?!\d)\w+/,
              lookbehind: true
            },
            operator: /=/
          }
        },
        punctuation: [/[\[\]().,:`]|->/],
        operator: [
          /[+\-*\/%]|==?=?|[!<>]=?|&&|\|\|?/,
          /\bis\s+(?:not\s+)?(?:div|even|odd)(?:\s+by)?\b/,
          /\b(?:eq|neq?|gt|lt|gt?e|lt?e|not|mod|or|and)\b/
        ],
        keyword: /\b(?:false|off|on|no|true|yes)\b/
      };
      Prism3.languages.insertBefore("smarty", "tag", {
        "smarty-comment": {
          pattern: /\{\*[\s\S]*?\*\}/,
          alias: ["smarty", "comment"]
        }
      });
      Prism3.hooks.add("before-tokenize", (env) => {
        const smartyPattern = /\{\*[\s\S]*?\*\}|\{[\s\S]+?\}/g;
        const smartyLitteralStart = "{literal}";
        const smartyLitteralEnd = "{/literal}";
        let smartyLitteralMode = false;
        Prism3.languages["markup-templating"].buildPlaceholders(env, "smarty", smartyPattern, (match) => {
          if (match === smartyLitteralEnd) {
            smartyLitteralMode = false;
          }
          if (!smartyLitteralMode) {
            if (match === smartyLitteralStart) {
              smartyLitteralMode = true;
            }
            return true;
          }
          return false;
        });
      });
      Prism3.hooks.add("after-tokenize", (env) => {
        Prism3.languages["markup-templating"].tokenizePlaceholders(env, "smarty");
      });
    })(Prism2);
  }
};
var soy_default = {
  language: "soy",
  init: (Prism2) => {
    (function(Prism3) {
      const stringPattern = /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/;
      const numberPattern = /\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\b0x[\dA-F]+\b/;
      Prism3.languages.soy = {
        comment: [
          /\/\*[\s\S]*?\*\//,
          {
            pattern: /(\s)\/\/.*/,
            lookbehind: true,
            greedy: true
          }
        ],
        "command-arg": {
          pattern: /({+\/?\s*(?:alias|call|delcall|delpackage|deltemplate|namespace|template)\s+)\.?[\w.]+/,
          lookbehind: true,
          alias: "string",
          inside: {
            punctuation: /\./
          }
        },
        parameter: {
          pattern: /({+\/?\s*@?param\??\s+)\.?[\w.]+/,
          lookbehind: true,
          alias: "variable"
        },
        keyword: [
          {
            pattern: /({+\/?[^\S\r\n]*)(?:\\[nrt]|alias|call|case|css|default|delcall|delpackage|deltemplate|else(?:if)?|fallbackmsg|for(?:each)?|if(?:empty)?|lb|let|literal|msg|namespace|nil|@?param\??|rb|sp|switch|template|xid)/,
            lookbehind: true
          },
          /\b(?:any|as|attributes|bool|css|float|in|int|js|html|list|map|null|number|string|uri)\b/
        ],
        delimiter: {
          pattern: /^{+\/?|\/?}+$/,
          alias: "punctuation"
        },
        property: /\w+(?==)/,
        variable: {
          pattern: /\$[^\W\d]\w*(?:\??(?:\.\w+|\[[^\]]+]))*/,
          inside: {
            string: {
              pattern: stringPattern,
              greedy: true
            },
            number: numberPattern,
            punctuation: /[\[\].?]/
          }
        },
        string: {
          pattern: stringPattern,
          greedy: true
        },
        function: [
          /\w+(?=\()/,
          {
            pattern: /(\|[^\S\r\n]*)\w+/,
            lookbehind: true
          }
        ],
        boolean: /\b(?:true|false)\b/,
        number: numberPattern,
        operator: /\?:?|<=?|>=?|==?|!=|[+*/%-]|\b(?:and|not|or)\b/,
        punctuation: /[{}()\[\]|.,:]/
      };
      Prism3.hooks.add("before-tokenize", (env) => {
        const soyPattern = /{{.+?}}|{.+?}|\s\/\/.*|\/\*[\s\S]*?\*\//g;
        const soyLitteralStart = "{literal}";
        const soyLitteralEnd = "{/literal}";
        let soyLitteralMode = false;
        Prism3.languages["markup-templating"].buildPlaceholders(env, "soy", soyPattern, (match) => {
          if (match === soyLitteralEnd) {
            soyLitteralMode = false;
          }
          if (!soyLitteralMode) {
            if (match === soyLitteralStart) {
              soyLitteralMode = true;
            }
            return true;
          }
          return false;
        });
      });
      Prism3.hooks.add("after-tokenize", (env) => {
        Prism3.languages["markup-templating"].tokenizePlaceholders(env, "soy");
      });
    })(Prism2);
  }
};
var stylus_default = {
  language: "stylus",
  init: (Prism2) => {
    (function(Prism3) {
      const inside = {
        url: /url\((["']?).*?\1\)/i,
        string: {
          pattern: /("|')(?:(?!\1)[^\\\r\n]|\\(?:\r\n|[\s\S]))*\1/,
          greedy: true
        },
        interpolation: null,
        func: null,
        important: /\B!(?:important|optional)\b/i,
        keyword: {
          pattern: /(^|\s+)(?:(?:if|else|for|return|unless)(?=\s+|$)|@[\w-]+)/,
          lookbehind: true
        },
        hexcode: /#[\da-f]{3,6}/i,
        number: /\b\d+(?:\.\d+)?%?/,
        boolean: /\b(?:true|false)\b/,
        operator: [
          /~|[+!\/%<>?=]=?|[-:]=|\*[*=]?|\.+|&&|\|\||\B-\B|\b(?:and|in|is(?: a| defined| not|nt)?|not|or)\b/
        ],
        punctuation: /[{}()\[\];:,]/
      };
      inside.interpolation = {
        pattern: /\{[^\r\n}:]+\}/,
        alias: "variable",
        inside: {
          delimiter: {
            pattern: /^{|}$/,
            alias: "punctuation"
          },
          rest: inside
        }
      };
      inside.func = {
        pattern: /[\w-]+\([^)]*\).*/,
        inside: {
          function: /^[^(]+/,
          rest: inside
        }
      };
      Prism3.languages.stylus = {
        comment: {
          pattern: /(^|[^\\])(\/\*[\s\S]*?\*\/|\/\/.*)/,
          lookbehind: true
        },
        "atrule-declaration": {
          pattern: /(^\s*)@.+/m,
          lookbehind: true,
          inside: {
            atrule: /^@[\w-]+/,
            rest: inside
          }
        },
        "variable-declaration": {
          pattern: /(^[ \t]*)[\w$-]+\s*.?=[ \t]*(?:(?:\{[^}]*\}|.+)|$)/m,
          lookbehind: true,
          inside: {
            variable: /^\S+/,
            rest: inside
          }
        },
        statement: {
          pattern: /(^[ \t]*)(?:if|else|for|return|unless)[ \t]+.+/m,
          lookbehind: true,
          inside: {
            keyword: /^\S+/,
            rest: inside
          }
        },
        "property-declaration": {
          pattern: /((?:^|\{)([ \t]*))(?:[\w-]|\{[^}\r\n]+\})+(?:\s*:\s*|[ \t]+)[^{\r\n]*(?:;|[^{\r\n,](?=$)(?!(\r?\n|\r)(?:\{|\2[ \t]+)))/m,
          lookbehind: true,
          inside: {
            property: {
              pattern: /^[^\s:]+/,
              inside: {
                interpolation: inside.interpolation
              }
            },
            rest: inside
          }
        },
        selector: {
          pattern: /(^[ \t]*)(?:(?=\S)(?:[^{}\r\n:()]|::?[\w-]+(?:\([^)\r\n]*\))?|\{[^}\r\n]+\})+)(?:(?:\r?\n|\r)(?:\1(?:(?=\S)(?:[^{}\r\n:()]|::?[\w-]+(?:\([^)\r\n]*\))?|\{[^}\r\n]+\})+)))*(?:,$|\{|(?=(?:\r?\n|\r)(?:\{|\1[ \t]+)))/m,
          lookbehind: true,
          inside: {
            interpolation: inside.interpolation,
            punctuation: /[{},]/
          }
        },
        func: inside.func,
        string: inside.string,
        interpolation: inside.interpolation,
        punctuation: /[{}()\[\];:.]/
      };
    })(Prism2);
  }
};
var tcl_default = {
  language: "tcl",
  init: (Prism2) => {
    Prism2.languages.tcl = {
      comment: {
        pattern: /(^|[^\\])#.*/,
        lookbehind: true
      },
      string: {
        pattern: /"(?:[^"\\\r\n]|\\(?:\r\n|[\s\S]))*"/,
        greedy: true
      },
      variable: [
        {
          pattern: /(\$)(?:::)?(?:[a-zA-Z0-9]+::)*\w+/,
          lookbehind: true
        },
        {
          pattern: /(\$){[^}]+}/,
          lookbehind: true
        },
        {
          pattern: /(^\s*set[ \t]+)(?:::)?(?:[a-zA-Z0-9]+::)*\w+/m,
          lookbehind: true
        }
      ],
      function: {
        pattern: /(^\s*proc[ \t]+)[^\s]+/m,
        lookbehind: true
      },
      builtin: [
        {
          pattern: /(^\s*)(?:proc|return|class|error|eval|exit|for|foreach|if|switch|while|break|continue)\b/m,
          lookbehind: true
        },
        /\b(?:elseif|else)\b/
      ],
      scope: {
        pattern: /(^\s*)(?:global|upvar|variable)\b/m,
        lookbehind: true,
        alias: "constant"
      },
      keyword: {
        pattern: /(^\s*|\[)(?:after|append|apply|array|auto_(?:execok|import|load|mkindex|qualify|reset)|automkindex_old|bgerror|binary|catch|cd|chan|clock|close|concat|dde|dict|encoding|eof|exec|expr|fblocked|fconfigure|fcopy|file(?:event|name)?|flush|gets|glob|history|http|incr|info|interp|join|lappend|lassign|lindex|linsert|list|llength|load|lrange|lrepeat|lreplace|lreverse|lsearch|lset|lsort|math(?:func|op)|memory|msgcat|namespace|open|package|parray|pid|pkg_mkIndex|platform|puts|pwd|re_syntax|read|refchan|regexp|registry|regsub|rename|Safe_Base|scan|seek|set|socket|source|split|string|subst|Tcl|tcl(?:_endOfWord|_findLibrary|startOf(?:Next|Previous)Word|wordBreak(?:After|Before)|test|vars)|tell|time|tm|trace|unknown|unload|unset|update|uplevel|vwait)\b/m,
        lookbehind: true
      },
      operator: /!=?|\*\*?|==|&&?|\|\|?|<[=<]?|>[=>]?|[-+~\/%?^]|\b(?:eq|ne|in|ni)\b/,
      punctuation: /[{}()\[\]]/
    };
  }
};
var textile_default = {
  language: "textile",
  init: (Prism2) => {
    (function(Prism3) {
      const modifierRegex = "(?:\\([^|)]+\\)|\\[[^\\]]+\\]|\\{[^}]+\\})+";
      const modifierTokens = {
        css: {
          pattern: /\{[^}]+\}/,
          inside: {
            rest: Prism3.languages.css
          }
        },
        "class-id": {
          pattern: /(\()[^)]+(?=\))/,
          lookbehind: true,
          alias: "attr-value"
        },
        lang: {
          pattern: /(\[)[^\]]+(?=\])/,
          lookbehind: true,
          alias: "attr-value"
        },
        punctuation: /[\\\/]\d+|\S/
      };
      Prism3.languages.textile = Prism3.languages.extend("markup", {
        phrase: {
          pattern: /(^|\r|\n)\S[\s\S]*?(?=$|\r?\n\r?\n|\r\r)/,
          lookbehind: true,
          inside: {
            "block-tag": {
              pattern: RegExp(`^[a-z]\\w*(?:${modifierRegex}|[<>=()])*\\.`),
              inside: {
                modifier: {
                  pattern: RegExp(`(^[a-z]\\w*)(?:${modifierRegex}|[<>=()])+(?=\\.)`),
                  lookbehind: true,
                  inside: modifierTokens
                },
                tag: /^[a-z]\w*/,
                punctuation: /\.$/
              }
            },
            list: {
              pattern: RegExp(`^[*#]+(?:${modifierRegex})?\\s+.+`, "m"),
              inside: {
                modifier: {
                  pattern: RegExp(`(^[*#]+)${modifierRegex}`),
                  lookbehind: true,
                  inside: modifierTokens
                },
                punctuation: /^[*#]+/
              }
            },
            table: {
              pattern: RegExp(`^(?:(?:${modifierRegex}|[<>=()^~])+\\.\\s*)?(?:\\|(?:(?:${modifierRegex}|[<>=()^~_]|[\\\\/]\\d+)+\\.)?[^|]*)+\\|`, "m"),
              inside: {
                modifier: {
                  pattern: RegExp(`(^|\\|(?:\\r?\\n|\\r)?)(?:${modifierRegex}|[<>=()^~_]|[\\\\/]\\d+)+(?=\\.)`),
                  lookbehind: true,
                  inside: modifierTokens
                },
                punctuation: /\||^\./
              }
            },
            inline: {
              pattern: RegExp(`(\\*\\*|__|\\?\\?|[*_%@+\\-^~])(?:${modifierRegex})?.+?\\1`),
              inside: {
                bold: {
                  pattern: RegExp(`(^(\\*\\*?)(?:${modifierRegex})?).+?(?=\\2)`),
                  lookbehind: true
                },
                italic: {
                  pattern: RegExp(`(^(__?)(?:${modifierRegex})?).+?(?=\\2)`),
                  lookbehind: true
                },
                cite: {
                  pattern: RegExp(`(^\\?\\?(?:${modifierRegex})?).+?(?=\\?\\?)`),
                  lookbehind: true,
                  alias: "string"
                },
                code: {
                  pattern: RegExp(`(^@(?:${modifierRegex})?).+?(?=@)`),
                  lookbehind: true,
                  alias: "keyword"
                },
                inserted: {
                  pattern: RegExp(`(^\\+(?:${modifierRegex})?).+?(?=\\+)`),
                  lookbehind: true
                },
                deleted: {
                  pattern: RegExp(`(^-(?:${modifierRegex})?).+?(?=-)`),
                  lookbehind: true
                },
                span: {
                  pattern: RegExp(`(^%(?:${modifierRegex})?).+?(?=%)`),
                  lookbehind: true
                },
                modifier: {
                  pattern: RegExp(`(^\\*\\*|__|\\?\\?|[*_%@+\\-^~])${modifierRegex}`),
                  lookbehind: true,
                  inside: modifierTokens
                },
                punctuation: /[*_%?@+\-^~]+/
              }
            },
            "link-ref": {
              pattern: /^\[[^\]]+\]\S+$/m,
              inside: {
                string: {
                  pattern: /(\[)[^\]]+(?=\])/,
                  lookbehind: true
                },
                url: {
                  pattern: /(\])\S+$/,
                  lookbehind: true
                },
                punctuation: /[\[\]]/
              }
            },
            link: {
              pattern: RegExp(`"(?:${modifierRegex})?[^"]+":.+?(?=[^\\w/]?(?:\\s|$))`),
              inside: {
                text: {
                  pattern: RegExp(`(^"(?:${modifierRegex})?)[^"]+(?=")`),
                  lookbehind: true
                },
                modifier: {
                  pattern: RegExp(`(^")${modifierRegex}`),
                  lookbehind: true,
                  inside: modifierTokens
                },
                url: {
                  pattern: /(:).+/,
                  lookbehind: true
                },
                punctuation: /[":]/
              }
            },
            image: {
              pattern: RegExp(`!(?:${modifierRegex}|[<>=()])*[^!\\s()]+(?:\\([^)]+\\))?!(?::.+?(?=[^\\w/]?(?:\\s|$)))?`),
              inside: {
                source: {
                  pattern: RegExp(`(^!(?:${modifierRegex}|[<>=()])*)[^!\\s()]+(?:\\([^)]+\\))?(?=!)`),
                  lookbehind: true,
                  alias: "url"
                },
                modifier: {
                  pattern: RegExp(`(^!)(?:${modifierRegex}|[<>=()])+`),
                  lookbehind: true,
                  inside: modifierTokens
                },
                url: {
                  pattern: /(:).+/,
                  lookbehind: true
                },
                punctuation: /[!:]/
              }
            },
            footnote: {
              pattern: /\b\[\d+\]/,
              alias: "comment",
              inside: {
                punctuation: /\[|\]/
              }
            },
            acronym: {
              pattern: /\b[A-Z\d]+\([^)]+\)/,
              inside: {
                comment: {
                  pattern: /(\()[^)]+(?=\))/,
                  lookbehind: true
                },
                punctuation: /[()]/
              }
            },
            mark: {
              pattern: /\b\((?:TM|R|C)\)/,
              alias: "comment",
              inside: {
                punctuation: /[()]/
              }
            }
          }
        }
      });
      const nestedPatterns = {
        inline: Prism3.languages.textile.phrase.inside.inline,
        link: Prism3.languages.textile.phrase.inside.link,
        image: Prism3.languages.textile.phrase.inside.image,
        footnote: Prism3.languages.textile.phrase.inside.footnote,
        acronym: Prism3.languages.textile.phrase.inside.acronym,
        mark: Prism3.languages.textile.phrase.inside.mark
      };
      Prism3.languages.textile.tag.pattern = /<\/?(?!\d)[a-z0-9]+(?:\s+[^\s>\/=]+(?:=(?:("|')(?:\\[\s\S]|(?!\1)[^\\])*\1|[^\s'">=]+))?)*\s*\/?>/i;
      Prism3.languages.textile.phrase.inside.inline.inside.bold.inside = nestedPatterns;
      Prism3.languages.textile.phrase.inside.inline.inside.italic.inside = nestedPatterns;
      Prism3.languages.textile.phrase.inside.inline.inside.inserted.inside = nestedPatterns;
      Prism3.languages.textile.phrase.inside.inline.inside.deleted.inside = nestedPatterns;
      Prism3.languages.textile.phrase.inside.inline.inside.span.inside = nestedPatterns;
      Prism3.languages.textile.phrase.inside.table.inside.inline = nestedPatterns.inline;
      Prism3.languages.textile.phrase.inside.table.inside.link = nestedPatterns.link;
      Prism3.languages.textile.phrase.inside.table.inside.image = nestedPatterns.image;
      Prism3.languages.textile.phrase.inside.table.inside.footnote = nestedPatterns.footnote;
      Prism3.languages.textile.phrase.inside.table.inside.acronym = nestedPatterns.acronym;
      Prism3.languages.textile.phrase.inside.table.inside.mark = nestedPatterns.mark;
    })(Prism2);
  }
};
var twig_default = {
  language: "twig",
  init: (Prism2) => {
    Prism2.languages.twig = {
      comment: /\{#[\s\S]*?#\}/,
      tag: {
        pattern: /\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}/,
        inside: {
          ld: {
            pattern: /^(?:\{\{-?|\{%-?\s*\w+)/,
            inside: {
              punctuation: /^(?:\{\{|\{%)-?/,
              keyword: /\w+/
            }
          },
          rd: {
            pattern: /-?(?:%\}|\}\})$/,
            inside: {
              punctuation: /.*/
            }
          },
          string: {
            pattern: /("|')(?:\\.|(?!\1)[^\\\r\n])*\1/,
            inside: {
              punctuation: /^['"]|['"]$/
            }
          },
          keyword: /\b(?:even|if|odd)\b/,
          boolean: /\b(?:true|false|null)\b/,
          number: /\b0x[\dA-Fa-f]+|(?:\b\d+\.?\d*|\B\.\d+)(?:[Ee][-+]?\d+)?/,
          operator: [
            {
              pattern: /(\s)(?:and|b-and|b-xor|b-or|ends with|in|is|matches|not|or|same as|starts with)(?=\s)/,
              lookbehind: true
            },
            /[=<>]=?|!=|\*\*?|\/\/?|\?:?|[-+~%|]/
          ],
          property: /\b[a-zA-Z_]\w*\b/,
          punctuation: /[()\[\]{}:.,]/
        }
      },
      other: {
        pattern: /\S(?:[\s\S]*\S)?/,
        inside: Prism2.languages.markup
      }
    };
  }
};
var vbnet_default = {
  language: "vbnet",
  init: (Prism2) => {
    Prism2.languages.vbnet = Prism2.languages.extend("basic", {
      keyword: /(?:\b(?:ADDHANDLER|ADDRESSOF|ALIAS|AND|ANDALSO|AS|BEEP|BLOAD|BOOLEAN|BSAVE|BYREF|BYTE|BYVAL|CALL(?: ABSOLUTE)?|CASE|CATCH|CBOOL|CBYTE|CCHAR|CDATE|CDEC|CDBL|CHAIN|CHAR|CHDIR|CINT|CLASS|CLEAR|CLNG|CLOSE|CLS|COBJ|COM|COMMON|CONST|CONTINUE|CSBYTE|CSHORT|CSNG|CSTR|CTYPE|CUINT|CULNG|CUSHORT|DATA|DATE|DECIMAL|DECLARE|DEFAULT|DEF(?: FN| SEG|DBL|INT|LNG|SNG|STR)|DELEGATE|DIM|DIRECTCAST|DO|DOUBLE|ELSE|ELSEIF|END|ENUM|ENVIRON|ERASE|ERROR|EVENT|EXIT|FALSE|FIELD|FILES|FINALLY|FOR(?: EACH)?|FRIEND|FUNCTION|GET|GETTYPE|GETXMLNAMESPACE|GLOBAL|GOSUB|GOTO|HANDLES|IF|IMPLEMENTS|IMPORTS|IN|INHERITS|INPUT|INTEGER|INTERFACE|IOCTL|IS|ISNOT|KEY|KILL|LINE INPUT|LET|LIB|LIKE|LOCATE|LOCK|LONG|LOOP|LSET|ME|MKDIR|MOD|MODULE|MUSTINHERIT|MUSTOVERRIDE|MYBASE|MYCLASS|NAME|NAMESPACE|NARROWING|NEW|NEXT|NOT|NOTHING|NOTINHERITABLE|NOTOVERRIDABLE|OBJECT|OF|OFF|ON(?: COM| ERROR| KEY| TIMER)?|OPERATOR|OPEN|OPTION(?: BASE)?|OPTIONAL|OR|ORELSE|OUT|OVERLOADS|OVERRIDABLE|OVERRIDES|PARAMARRAY|PARTIAL|POKE|PRIVATE|PROPERTY|PROTECTED|PUBLIC|PUT|RAISEEVENT|READ|READONLY|REDIM|REM|REMOVEHANDLER|RESTORE|RESUME|RETURN|RMDIR|RSET|RUN|SBYTE|SELECT(?: CASE)?|SET|SHADOWS|SHARED|SHORT|SINGLE|SHELL|SLEEP|STATIC|STEP|STOP|STRING|STRUCTURE|SUB|SYNCLOCK|SWAP|SYSTEM|THEN|THROW|TIMER|TO|TROFF|TRON|TRUE|TRY|TRYCAST|TYPE|TYPEOF|UINTEGER|ULONG|UNLOCK|UNTIL|USHORT|USING|VIEW PRINT|WAIT|WEND|WHEN|WHILE|WIDENING|WITH|WITHEVENTS|WRITE|WRITEONLY|XOR)|\B(?:#CONST|#ELSE|#ELSEIF|#END|#IF))(?:\$|\b)/i,
      comment: [
        {
          pattern: /(?:!|REM\b).+/i,
          inside: {
            keyword: /^REM/i
          }
        },
        {
          pattern: /(^|[^\\:])'.*/,
          lookbehind: true
        }
      ]
    });
  }
};
var verilog_default = {
  language: "verilog",
  init: (Prism2) => {
    Prism2.languages.verilog = {
      comment: /\/\/.*|\/\*[\s\S]*?\*\//,
      string: {
        pattern: /"(?:\\(?:\r\n|[\s\S])|[^"\\\r\n])*"/,
        greedy: true
      },
      property: /\B\$\w+\b/,
      constant: /\B`\w+\b/,
      function: /\w+(?=\()/,
      keyword: /\b(?:alias|and|assert|assign|assume|automatic|before|begin|bind|bins|binsof|bit|break|buf|bufif0|bufif1|byte|class|case|casex|casez|cell|chandle|clocking|cmos|config|const|constraint|context|continue|cover|covergroup|coverpoint|cross|deassign|default|defparam|design|disable|dist|do|edge|else|end|endcase|endclass|endclocking|endconfig|endfunction|endgenerate|endgroup|endinterface|endmodule|endpackage|endprimitive|endprogram|endproperty|endspecify|endsequence|endtable|endtask|enum|event|expect|export|extends|extern|final|first_match|for|force|foreach|forever|fork|forkjoin|function|generate|genvar|highz0|highz1|if|iff|ifnone|ignore_bins|illegal_bins|import|incdir|include|initial|inout|input|inside|instance|int|integer|interface|intersect|join|join_any|join_none|large|liblist|library|local|localparam|logic|longint|macromodule|matches|medium|modport|module|nand|negedge|new|nmos|nor|noshowcancelled|not|notif0|notif1|null|or|output|package|packed|parameter|pmos|posedge|primitive|priority|program|property|protected|pull0|pull1|pulldown|pullup|pulsestyle_onevent|pulsestyle_ondetect|pure|rand|randc|randcase|randsequence|rcmos|real|realtime|ref|reg|release|repeat|return|rnmos|rpmos|rtran|rtranif0|rtranif1|scalared|sequence|shortint|shortreal|showcancelled|signed|small|solve|specify|specparam|static|string|strong0|strong1|struct|super|supply0|supply1|table|tagged|task|this|throughout|time|timeprecision|timeunit|tran|tranif0|tranif1|tri|tri0|tri1|triand|trior|trireg|type|typedef|union|unique|unsigned|use|uwire|var|vectored|virtual|void|wait|wait_order|wand|weak0|weak1|while|wildcard|wire|with|within|wor|xnor|xor)\b/,
      important: /\b(?:always_latch|always_comb|always_ff|always)\b ?@?/,
      number: /\B##?\d+|(?:\b\d+)?'[odbh] ?[\da-fzx_?]+|\b\d*[._]?\d+(?:e[-+]?\d+)?/i,
      operator: /[-+{}^~%*\/?=!<>&|]+/,
      punctuation: /[[\];(),.:]/
    };
  }
};
var vhdl_default = {
  language: "vhdl",
  init: (Prism2) => {
    Prism2.languages.vhdl = {
      comment: /--.+/,
      "vhdl-vectors": {
        pattern: /\b[oxb]"[\da-f_]+"|"[01uxzwlh-]+"/i,
        alias: "number"
      },
      "quoted-function": {
        pattern: /"\S+?"(?=\()/,
        alias: "function"
      },
      string: /"(?:[^\\"\r\n]|\\(?:\r\n|[\s\S]))*"/,
      constant: /\b(?:use|library)\b/i,
      keyword: /\b(?:'active|'ascending|'base|'delayed|'driving|'driving_value|'event|'high|'image|'instance_name|'last_active|'last_event|'last_value|'left|'leftof|'length|'low|'path_name|'pos|'pred|'quiet|'range|'reverse_range|'right|'rightof|'simple_name|'stable|'succ|'transaction|'val|'value|access|after|alias|all|architecture|array|assert|attribute|begin|block|body|buffer|bus|case|component|configuration|constant|disconnect|downto|else|elsif|end|entity|exit|file|for|function|generate|generic|group|guarded|if|impure|in|inertial|inout|is|label|library|linkage|literal|loop|map|new|next|null|of|on|open|others|out|package|port|postponed|procedure|process|pure|range|record|register|reject|report|return|select|severity|shared|signal|subtype|then|to|transport|type|unaffected|units|until|use|variable|wait|when|while|with)\b/i,
      boolean: /\b(?:true|false)\b/i,
      function: /\w+(?=\()/,
      number: /'[01uxzwlh-]'|\b(?:\d+#[\da-f_.]+#|\d[\d_.]*)(?:e[-+]?\d+)?/i,
      operator: /[<>]=?|:=|[-+*/&=]|\b(?:abs|not|mod|rem|sll|srl|sla|sra|rol|ror|and|or|nand|xnor|xor|nor)\b/i,
      punctuation: /[{}[\];(),.:]/
    };
  }
};
var vim_default = {
  language: "vim",
  init: (Prism2) => {
    Prism2.languages.vim = {
      string: /"(?:[^"\\\r\n]|\\.)*"|'(?:[^'\r\n]|'')*'/,
      comment: /".*/,
      function: /\w+(?=\()/,
      keyword: /\b(?:ab|abbreviate|abc|abclear|abo|aboveleft|al|all|arga|argadd|argd|argdelete|argdo|arge|argedit|argg|argglobal|argl|arglocal|ar|args|argu|argument|as|ascii|bad|badd|ba|ball|bd|bdelete|be|bel|belowright|bf|bfirst|bl|blast|bm|bmodified|bn|bnext|bN|bNext|bo|botright|bp|bprevious|brea|break|breaka|breakadd|breakd|breakdel|breakl|breaklist|br|brewind|bro|browse|bufdo|b|buffer|buffers|bun|bunload|bw|bwipeout|ca|cabbrev|cabc|cabclear|caddb|caddbuffer|cad|caddexpr|caddf|caddfile|cal|call|cat|catch|cb|cbuffer|cc|ccl|cclose|cd|ce|center|cex|cexpr|cf|cfile|cfir|cfirst|cgetb|cgetbuffer|cgete|cgetexpr|cg|cgetfile|c|change|changes|chd|chdir|che|checkpath|checkt|checktime|cla|clast|cl|clist|clo|close|cmapc|cmapclear|cnew|cnewer|cn|cnext|cN|cNext|cnf|cnfile|cNfcNfile|cnorea|cnoreabbrev|col|colder|colo|colorscheme|comc|comclear|comp|compiler|conf|confirm|con|continue|cope|copen|co|copy|cpf|cpfile|cp|cprevious|cq|cquit|cr|crewind|cuna|cunabbrev|cu|cunmap|cw|cwindow|debugg|debuggreedy|delc|delcommand|d|delete|delf|delfunction|delm|delmarks|diffg|diffget|diffoff|diffpatch|diffpu|diffput|diffsplit|diffthis|diffu|diffupdate|dig|digraphs|di|display|dj|djump|dl|dlist|dr|drop|ds|dsearch|dsp|dsplit|earlier|echoe|echoerr|echom|echomsg|echon|e|edit|el|else|elsei|elseif|em|emenu|endfo|endfor|endf|endfunction|endfun|en|endif|endt|endtry|endw|endwhile|ene|enew|ex|exi|exit|exu|exusage|f|file|files|filetype|fina|finally|fin|find|fini|finish|fir|first|fix|fixdel|fo|fold|foldc|foldclose|folddoc|folddoclosed|foldd|folddoopen|foldo|foldopen|for|fu|fun|function|go|goto|gr|grep|grepa|grepadd|ha|hardcopy|h|help|helpf|helpfind|helpg|helpgrep|helpt|helptags|hid|hide|his|history|ia|iabbrev|iabc|iabclear|if|ij|ijump|il|ilist|imapc|imapclear|in|inorea|inoreabbrev|isearch|isp|isplit|iuna|iunabbrev|iu|iunmap|j|join|ju|jumps|k|keepalt|keepj|keepjumps|kee|keepmarks|laddb|laddbuffer|lad|laddexpr|laddf|laddfile|lan|language|la|last|later|lb|lbuffer|lc|lcd|lch|lchdir|lcl|lclose|let|left|lefta|leftabove|lex|lexpr|lf|lfile|lfir|lfirst|lgetb|lgetbuffer|lgete|lgetexpr|lg|lgetfile|lgr|lgrep|lgrepa|lgrepadd|lh|lhelpgrep|l|list|ll|lla|llast|lli|llist|lmak|lmake|lm|lmap|lmapc|lmapclear|lnew|lnewer|lne|lnext|lN|lNext|lnf|lnfile|lNf|lNfile|ln|lnoremap|lo|loadview|loc|lockmarks|lockv|lockvar|lol|lolder|lop|lopen|lpf|lpfile|lp|lprevious|lr|lrewind|ls|lt|ltag|lu|lunmap|lv|lvimgrep|lvimgrepa|lvimgrepadd|lw|lwindow|mak|make|ma|mark|marks|mat|match|menut|menutranslate|mk|mkexrc|mks|mksession|mksp|mkspell|mkvie|mkview|mkv|mkvimrc|mod|mode|m|move|mzf|mzfile|mz|mzscheme|nbkey|new|n|next|N|Next|nmapc|nmapclear|noh|nohlsearch|norea|noreabbrev|nu|number|nun|nunmap|omapc|omapclear|on|only|o|open|opt|options|ou|ounmap|pc|pclose|ped|pedit|pe|perl|perld|perldo|po|pop|popu|popup|pp|ppop|pre|preserve|prev|previous|p|print|P|Print|profd|profdel|prof|profile|promptf|promptfind|promptr|promptrepl|ps|psearch|pta|ptag|ptf|ptfirst|ptj|ptjump|ptl|ptlast|ptn|ptnext|ptN|ptNext|ptp|ptprevious|ptr|ptrewind|pts|ptselect|pu|put|pw|pwd|pyf|pyfile|py|python|qa|qall|q|quit|quita|quitall|r|read|rec|recover|redi|redir|red|redo|redr|redraw|redraws|redrawstatus|reg|registers|res|resize|ret|retab|retu|return|rew|rewind|ri|right|rightb|rightbelow|rub|ruby|rubyd|rubydo|rubyf|rubyfile|ru|runtime|rv|rviminfo|sal|sall|san|sandbox|sa|sargument|sav|saveas|sba|sball|sbf|sbfirst|sbl|sblast|sbm|sbmodified|sbn|sbnext|sbN|sbNext|sbp|sbprevious|sbr|sbrewind|sb|sbuffer|scripte|scriptencoding|scrip|scriptnames|se|set|setf|setfiletype|setg|setglobal|setl|setlocal|sf|sfind|sfir|sfirst|sh|shell|sign|sil|silent|sim|simalt|sla|slast|sl|sleep|sm|smagic|sm|smap|smapc|smapclear|sme|smenu|sn|snext|sN|sNext|sni|sniff|sno|snomagic|snor|snoremap|snoreme|snoremenu|sor|sort|so|source|spelld|spelldump|spe|spellgood|spelli|spellinfo|spellr|spellrepall|spellu|spellundo|spellw|spellwrong|sp|split|spr|sprevious|sre|srewind|sta|stag|startg|startgreplace|star|startinsert|startr|startreplace|stj|stjump|st|stop|stopi|stopinsert|sts|stselect|sun|sunhide|sunm|sunmap|sus|suspend|sv|sview|syncbind|t|tab|tabc|tabclose|tabd|tabdo|tabe|tabedit|tabf|tabfind|tabfir|tabfirst|tabl|tablast|tabm|tabmove|tabnew|tabn|tabnext|tabN|tabNext|tabo|tabonly|tabp|tabprevious|tabr|tabrewind|tabs|ta|tag|tags|tc|tcl|tcld|tcldo|tclf|tclfile|te|tearoff|tf|tfirst|th|throw|tj|tjump|tl|tlast|tm|tm|tmenu|tn|tnext|tN|tNext|to|topleft|tp|tprevious|tr|trewind|try|ts|tselect|tu|tu|tunmenu|una|unabbreviate|u|undo|undoj|undojoin|undol|undolist|unh|unhide|unlet|unlo|unlockvar|unm|unmap|up|update|verb|verbose|ve|version|vert|vertical|vie|view|vim|vimgrep|vimgrepa|vimgrepadd|vi|visual|viu|viusage|vmapc|vmapclear|vne|vnew|vs|vsplit|vu|vunmap|wa|wall|wh|while|winc|wincmd|windo|winp|winpos|win|winsize|wn|wnext|wN|wNext|wp|wprevious|wq|wqa|wqall|w|write|ws|wsverb|wv|wviminfo|X|xa|xall|x|xit|xm|xmap|xmapc|xmapclear|xme|xmenu|XMLent|XMLns|xn|xnoremap|xnoreme|xnoremenu|xu|xunmap|y|yank)\b/,
      builtin: /\b(?:autocmd|acd|ai|akm|aleph|allowrevins|altkeymap|ambiwidth|ambw|anti|antialias|arab|arabic|arabicshape|ari|arshape|autochdir|autoindent|autoread|autowrite|autowriteall|aw|awa|background|backspace|backup|backupcopy|backupdir|backupext|backupskip|balloondelay|ballooneval|balloonexpr|bdir|bdlay|beval|bex|bexpr|bg|bh|bin|binary|biosk|bioskey|bk|bkc|bomb|breakat|brk|browsedir|bs|bsdir|bsk|bt|bufhidden|buflisted|buftype|casemap|ccv|cdpath|cedit|cfu|ch|charconvert|ci|cin|cindent|cink|cinkeys|cino|cinoptions|cinw|cinwords|clipboard|cmdheight|cmdwinheight|cmp|cms|columns|com|comments|commentstring|compatible|complete|completefunc|completeopt|consk|conskey|copyindent|cot|cpo|cpoptions|cpt|cscopepathcomp|cscopeprg|cscopequickfix|cscopetag|cscopetagorder|cscopeverbose|cspc|csprg|csqf|cst|csto|csverb|cuc|cul|cursorcolumn|cursorline|cwh|debug|deco|def|define|delcombine|dex|dg|dict|dictionary|diff|diffexpr|diffopt|digraph|dip|dir|directory|dy|ea|ead|eadirection|eb|ed|edcompatible|ef|efm|ei|ek|enc|encoding|endofline|eol|ep|equalalways|equalprg|errorbells|errorfile|errorformat|esckeys|et|eventignore|expandtab|exrc|fcl|fcs|fdc|fde|fdi|fdl|fdls|fdm|fdn|fdo|fdt|fen|fenc|fencs|fex|ff|ffs|fileencoding|fileencodings|fileformat|fileformats|fillchars|fk|fkmap|flp|fml|fmr|foldcolumn|foldenable|foldexpr|foldignore|foldlevel|foldlevelstart|foldmarker|foldmethod|foldminlines|foldnestmax|foldtext|formatexpr|formatlistpat|formatoptions|formatprg|fp|fs|fsync|ft|gcr|gd|gdefault|gfm|gfn|gfs|gfw|ghr|gp|grepformat|grepprg|gtl|gtt|guicursor|guifont|guifontset|guifontwide|guiheadroom|guioptions|guipty|guitablabel|guitabtooltip|helpfile|helpheight|helplang|hf|hh|hi|hidden|highlight|hk|hkmap|hkmapp|hkp|hl|hlg|hls|hlsearch|ic|icon|iconstring|ignorecase|im|imactivatekey|imak|imc|imcmdline|imd|imdisable|imi|iminsert|ims|imsearch|inc|include|includeexpr|incsearch|inde|indentexpr|indentkeys|indk|inex|inf|infercase|insertmode|isf|isfname|isi|isident|isk|iskeyword|isprint|joinspaces|js|key|keymap|keymodel|keywordprg|km|kmp|kp|langmap|langmenu|laststatus|lazyredraw|lbr|lcs|linebreak|lines|linespace|lisp|lispwords|listchars|loadplugins|lpl|lsp|lz|macatsui|magic|makeef|makeprg|matchpairs|matchtime|maxcombine|maxfuncdepth|maxmapdepth|maxmem|maxmempattern|maxmemtot|mco|mef|menuitems|mfd|mh|mis|mkspellmem|ml|mls|mm|mmd|mmp|mmt|modeline|modelines|modifiable|modified|more|mouse|mousef|mousefocus|mousehide|mousem|mousemodel|mouses|mouseshape|mouset|mousetime|mp|mps|msm|mzq|mzquantum|nf|nrformats|numberwidth|nuw|odev|oft|ofu|omnifunc|opendevice|operatorfunc|opfunc|osfiletype|pa|para|paragraphs|paste|pastetoggle|patchexpr|patchmode|path|pdev|penc|pex|pexpr|pfn|ph|pheader|pi|pm|pmbcs|pmbfn|popt|preserveindent|previewheight|previewwindow|printdevice|printencoding|printexpr|printfont|printheader|printmbcharset|printmbfont|printoptions|prompt|pt|pumheight|pvh|pvw|qe|quoteescape|readonly|remap|report|restorescreen|revins|rightleft|rightleftcmd|rl|rlc|ro|rs|rtp|ruf|ruler|rulerformat|runtimepath|sbo|sc|scb|scr|scroll|scrollbind|scrolljump|scrolloff|scrollopt|scs|sect|sections|secure|sel|selection|selectmode|sessionoptions|sft|shcf|shellcmdflag|shellpipe|shellquote|shellredir|shellslash|shelltemp|shelltype|shellxquote|shiftround|shiftwidth|shm|shortmess|shortname|showbreak|showcmd|showfulltag|showmatch|showmode|showtabline|shq|si|sidescroll|sidescrolloff|siso|sj|slm|smartcase|smartindent|smarttab|smc|smd|softtabstop|sol|spc|spell|spellcapcheck|spellfile|spelllang|spellsuggest|spf|spl|splitbelow|splitright|sps|sr|srr|ss|ssl|ssop|stal|startofline|statusline|stl|stmp|su|sua|suffixes|suffixesadd|sw|swapfile|swapsync|swb|swf|switchbuf|sws|sxq|syn|synmaxcol|syntax|tabline|tabpagemax|tabstop|tagbsearch|taglength|tagrelative|tagstack|tal|tb|tbi|tbidi|tbis|tbs|tenc|term|termbidi|termencoding|terse|textauto|textmode|textwidth|tgst|thesaurus|tildeop|timeout|timeoutlen|title|titlelen|titleold|titlestring|toolbar|toolbariconsize|top|tpm|tsl|tsr|ttimeout|ttimeoutlen|ttm|tty|ttybuiltin|ttyfast|ttym|ttymouse|ttyscroll|ttytype|tw|tx|uc|ul|undolevels|updatecount|updatetime|ut|vb|vbs|vdir|verbosefile|vfile|viewdir|viewoptions|viminfo|virtualedit|visualbell|vop|wak|warn|wb|wc|wcm|wd|weirdinvert|wfh|wfw|whichwrap|wi|wig|wildchar|wildcharm|wildignore|wildmenu|wildmode|wildoptions|wim|winaltkeys|window|winfixheight|winfixwidth|winheight|winminheight|winminwidth|winwidth|wiv|wiw|wm|wmh|wmnu|wmw|wop|wrap|wrapmargin|wrapscan|writeany|writebackup|writedelay|ww|noacd|noai|noakm|noallowrevins|noaltkeymap|noanti|noantialias|noar|noarab|noarabic|noarabicshape|noari|noarshape|noautochdir|noautoindent|noautoread|noautowrite|noautowriteall|noaw|noawa|nobackup|noballooneval|nobeval|nobin|nobinary|nobiosk|nobioskey|nobk|nobl|nobomb|nobuflisted|nocf|noci|nocin|nocindent|nocompatible|noconfirm|noconsk|noconskey|nocopyindent|nocp|nocscopetag|nocscopeverbose|nocst|nocsverb|nocuc|nocul|nocursorcolumn|nocursorline|nodeco|nodelcombine|nodg|nodiff|nodigraph|nodisable|noea|noeb|noed|noedcompatible|noek|noendofline|noeol|noequalalways|noerrorbells|noesckeys|noet|noex|noexpandtab|noexrc|nofen|nofk|nofkmap|nofoldenable|nogd|nogdefault|noguipty|nohid|nohidden|nohk|nohkmap|nohkmapp|nohkp|nohls|noic|noicon|noignorecase|noim|noimc|noimcmdline|noimd|noincsearch|noinf|noinfercase|noinsertmode|nois|nojoinspaces|nojs|nolazyredraw|nolbr|nolinebreak|nolisp|nolist|noloadplugins|nolpl|nolz|noma|nomacatsui|nomagic|nomh|noml|nomod|nomodeline|nomodifiable|nomodified|nomore|nomousef|nomousefocus|nomousehide|nonu|nonumber|noodev|noopendevice|nopaste|nopi|nopreserveindent|nopreviewwindow|noprompt|nopvw|noreadonly|noremap|norestorescreen|norevins|nori|norightleft|norightleftcmd|norl|norlc|noro|nors|noru|noruler|nosb|nosc|noscb|noscrollbind|noscs|nosecure|nosft|noshellslash|noshelltemp|noshiftround|noshortname|noshowcmd|noshowfulltag|noshowmatch|noshowmode|nosi|nosm|nosmartcase|nosmartindent|nosmarttab|nosmd|nosn|nosol|nospell|nosplitbelow|nosplitright|nospr|nosr|nossl|nosta|nostartofline|nostmp|noswapfile|noswf|nota|notagbsearch|notagrelative|notagstack|notbi|notbidi|notbs|notermbidi|noterse|notextauto|notextmode|notf|notgst|notildeop|notimeout|notitle|noto|notop|notr|nottimeout|nottybuiltin|nottyfast|notx|novb|novisualbell|nowa|nowarn|nowb|noweirdinvert|nowfh|nowfw|nowildmenu|nowinfixheight|nowinfixwidth|nowiv|nowmnu|nowrap|nowrapscan|nowrite|nowriteany|nowritebackup|nows|invacd|invai|invakm|invallowrevins|invaltkeymap|invanti|invantialias|invar|invarab|invarabic|invarabicshape|invari|invarshape|invautochdir|invautoindent|invautoread|invautowrite|invautowriteall|invaw|invawa|invbackup|invballooneval|invbeval|invbin|invbinary|invbiosk|invbioskey|invbk|invbl|invbomb|invbuflisted|invcf|invci|invcin|invcindent|invcompatible|invconfirm|invconsk|invconskey|invcopyindent|invcp|invcscopetag|invcscopeverbose|invcst|invcsverb|invcuc|invcul|invcursorcolumn|invcursorline|invdeco|invdelcombine|invdg|invdiff|invdigraph|invdisable|invea|inveb|inved|invedcompatible|invek|invendofline|inveol|invequalalways|inverrorbells|invesckeys|invet|invex|invexpandtab|invexrc|invfen|invfk|invfkmap|invfoldenable|invgd|invgdefault|invguipty|invhid|invhidden|invhk|invhkmap|invhkmapp|invhkp|invhls|invhlsearch|invic|invicon|invignorecase|invim|invimc|invimcmdline|invimd|invincsearch|invinf|invinfercase|invinsertmode|invis|invjoinspaces|invjs|invlazyredraw|invlbr|invlinebreak|invlisp|invlist|invloadplugins|invlpl|invlz|invma|invmacatsui|invmagic|invmh|invml|invmod|invmodeline|invmodifiable|invmodified|invmore|invmousef|invmousefocus|invmousehide|invnu|invnumber|invodev|invopendevice|invpaste|invpi|invpreserveindent|invpreviewwindow|invprompt|invpvw|invreadonly|invremap|invrestorescreen|invrevins|invri|invrightleft|invrightleftcmd|invrl|invrlc|invro|invrs|invru|invruler|invsb|invsc|invscb|invscrollbind|invscs|invsecure|invsft|invshellslash|invshelltemp|invshiftround|invshortname|invshowcmd|invshowfulltag|invshowmatch|invshowmode|invsi|invsm|invsmartcase|invsmartindent|invsmarttab|invsmd|invsn|invsol|invspell|invsplitbelow|invsplitright|invspr|invsr|invssl|invsta|invstartofline|invstmp|invswapfile|invswf|invta|invtagbsearch|invtagrelative|invtagstack|invtbi|invtbidi|invtbs|invtermbidi|invterse|invtextauto|invtextmode|invtf|invtgst|invtildeop|invtimeout|invtitle|invto|invtop|invtr|invttimeout|invttybuiltin|invttyfast|invtx|invvb|invvisualbell|invwa|invwarn|invwb|invweirdinvert|invwfh|invwfw|invwildmenu|invwinfixheight|invwinfixwidth|invwiv|invwmnu|invwrap|invwrapscan|invwrite|invwriteany|invwritebackup|invws|t_AB|t_AF|t_al|t_AL|t_bc|t_cd|t_ce|t_Ce|t_cl|t_cm|t_Co|t_cs|t_Cs|t_CS|t_CV|t_da|t_db|t_dl|t_DL|t_EI|t_F1|t_F2|t_F3|t_F4|t_F5|t_F6|t_F7|t_F8|t_F9|t_fs|t_IE|t_IS|t_k1|t_K1|t_k2|t_k3|t_K3|t_k4|t_K4|t_k5|t_K5|t_k6|t_K6|t_k7|t_K7|t_k8|t_K8|t_k9|t_K9|t_KA|t_kb|t_kB|t_KB|t_KC|t_kd|t_kD|t_KD|t_ke|t_KE|t_KF|t_KG|t_kh|t_KH|t_kI|t_KI|t_KJ|t_KK|t_kl|t_KL|t_kN|t_kP|t_kr|t_ks|t_ku|t_le|t_mb|t_md|t_me|t_mr|t_ms|t_nd|t_op|t_RI|t_RV|t_Sb|t_se|t_Sf|t_SI|t_so|t_sr|t_te|t_ti|t_ts|t_ue|t_us|t_ut|t_vb|t_ve|t_vi|t_vs|t_WP|t_WS|t_xs|t_ZH|t_ZR)\b/,
      number: /\b(?:0x[\da-f]+|\d+(?:\.\d+)?)\b/i,
      operator: /\|\||&&|[-+.]=?|[=!](?:[=~][#?]?)?|[<>]=?[#?]?|[*\/%?]|\b(?:is(?:not)?)\b/,
      punctuation: /[{}[\](),;:]/
    };
  }
};
var visual_basic_default = {
  language: "visual-basic",
  init: (Prism2) => {
    Prism2.languages["visual-basic"] = {
      comment: {
        pattern: /(?:['\u2018\u2019]|REM\b).*/i,
        inside: {
          keyword: /^REM/i
        }
      },
      directive: {
        pattern: /#(?:Const|Else|ElseIf|End|ExternalChecksum|ExternalSource|If|Region)(?:[^\S\r\n]_[^\S\r\n]*(?:\r\n?|\n)|.)+/i,
        alias: "comment",
        greedy: true
      },
      string: {
        pattern: /["\u201C\u201D](?:["\u201C\u201D]{2}|[^"\u201C\u201D])*["\u201C\u201D]C?/i,
        greedy: true
      },
      date: {
        pattern: /#[^\S\r\n]*(?:\d+([/-])\d+\1\d+(?:[^\S\r\n]+(?:\d+[^\S\r\n]*(?:AM|PM)|\d+:\d+(?::\d+)?(?:[^\S\r\n]*(?:AM|PM))?))?|(?:\d+[^\S\r\n]*(?:AM|PM)|\d+:\d+(?::\d+)?(?:[^\S\r\n]*(?:AM|PM))?))[^\S\r\n]*#/i,
        alias: "builtin"
      },
      number: /(?:(?:\b\d+(?:\.\d+)?|\.\d+)(?:E[+-]?\d+)?|&[HO][\dA-F]+)(?:U?[ILS]|[FRD])?/i,
      boolean: /\b(?:True|False|Nothing)\b/i,
      keyword: /\b(?:AddHandler|AddressOf|Alias|And(?:Also)?|As|Boolean|ByRef|Byte|ByVal|Call|Case|Catch|C(?:Bool|Byte|Char|Date|Dbl|Dec|Int|Lng|Obj|SByte|Short|Sng|Str|Type|UInt|ULng|UShort)|Char|Class|Const|Continue|Date|Decimal|Declare|Default|Delegate|Dim|DirectCast|Do|Double|Each|Else(?:If)?|End(?:If)?|Enum|Erase|Error|Event|Exit|Finally|For|Friend|Function|Get(?:Type|XMLNamespace)?|Global|GoSub|GoTo|Handles|If|Implements|Imports|In|Inherits|Integer|Interface|Is|IsNot|Let|Lib|Like|Long|Loop|Me|Mod|Module|Must(?:Inherit|Override)|My(?:Base|Class)|Namespace|Narrowing|New|Next|Not(?:Inheritable|Overridable)?|Object|Of|On|Operator|Option(?:al)?|Or(?:Else)?|Out|Overloads|Overridable|Overrides|ParamArray|Partial|Private|Property|Protected|Public|RaiseEvent|ReadOnly|ReDim|RemoveHandler|Resume|Return|SByte|Select|Set|Shadows|Shared|short|Single|Static|Step|Stop|String|Structure|Sub|SyncLock|Then|Throw|To|Try|TryCast|TypeOf|U(?:Integer|Long|Short)|Using|Variant|Wend|When|While|Widening|With(?:Events)?|WriteOnly|Xor)\b/i,
      operator: [
        /[+\-*/\\^<=>&#@$%!]/,
        {
          pattern: /([^\S\r\n])_(?=[^\S\r\n]*[\r\n])/,
          lookbehind: true
        }
      ],
      punctuation: /[{}().,:?]/
    };
    Prism2.languages.vb = Prism2.languages["visual-basic"];
  }
};
var wasm_default = {
  language: "wasm",
  init: (Prism2) => {
    Prism2.languages.wasm = {
      comment: [
        /\(;[\s\S]*?;\)/,
        {
          pattern: /;;.*/,
          greedy: true
        }
      ],
      string: {
        pattern: /"(?:\\[\s\S]|[^"\\])*"/,
        greedy: true
      },
      keyword: [
        {
          pattern: /\b(?:align|offset)=/,
          inside: {
            operator: /=/
          }
        },
        {
          pattern: /\b(?:(?:f32|f64|i32|i64)(?:\.(?:abs|add|and|ceil|clz|const|convert_[su]\/i(?:32|64)|copysign|ctz|demote\/f64|div(?:_[su])?|eqz?|extend_[su]\/i32|floor|ge(?:_[su])?|gt(?:_[su])?|le(?:_[su])?|load(?:(?:8|16|32)_[su])?|lt(?:_[su])?|max|min|mul|nearest|neg?|or|popcnt|promote\/f32|reinterpret\/[fi](?:32|64)|rem_[su]|rot[lr]|shl|shr_[su]|store(?:8|16|32)?|sqrt|sub|trunc(?:_[su]\/f(?:32|64))?|wrap\/i64|xor))?|memory\.(?:grow|size))\b/,
          inside: {
            punctuation: /\./
          }
        },
        /\b(?:anyfunc|block|br(?:_if|_table)?|call(?:_indirect)?|data|drop|elem|else|end|export|func|get_(?:global|local)|global|if|import|local|loop|memory|module|mut|nop|offset|param|result|return|select|set_(?:global|local)|start|table|tee_local|then|type|unreachable)\b/
      ],
      variable: /\$[\w!#$%&'*+\-./:<=>?@\\^_`|~]+/i,
      number: /[+-]?\b(?:\d(?:_?\d)*(?:\.\d(?:_?\d)*)?(?:[eE][+-]?\d(?:_?\d)*)?|0x[\da-fA-F](?:_?[\da-fA-F])*(?:\.[\da-fA-F](?:_?[\da-fA-D])*)?(?:[pP][+-]?\d(?:_?\d)*)?)\b|\binf\b|\bnan(?::0x[\da-fA-F](?:_?[\da-fA-D])*)?\b/,
      punctuation: /[()]/
    };
  }
};
var wiki_default = {
  language: "wiki",
  init: (Prism2) => {
    Prism2.languages.wiki = Prism2.languages.extend("markup", {
      "block-comment": {
        pattern: /(^|[^\\])\/\*[\s\S]*?\*\//,
        lookbehind: true,
        alias: "comment"
      },
      heading: {
        pattern: /^(=+).+?\1/m,
        inside: {
          punctuation: /^=+|=+$/,
          important: /.+/
        }
      },
      emphasis: {
        pattern: /('{2,5}).+?\1/,
        inside: {
          "bold italic": {
            pattern: /(''''').+?(?=\1)/,
            lookbehind: true
          },
          bold: {
            pattern: /(''')[^'](?:.*?[^'])?(?=\1)/,
            lookbehind: true
          },
          italic: {
            pattern: /('')[^'](?:.*?[^'])?(?=\1)/,
            lookbehind: true
          },
          punctuation: /^''+|''+$/
        }
      },
      hr: {
        pattern: /^-{4,}/m,
        alias: "punctuation"
      },
      url: [
        /ISBN +(?:97[89][ -]?)?(?:\d[ -]?){9}[\dx]\b|(?:RFC|PMID) +\d+/i,
        /\[\[.+?\]\]|\[.+?\]/
      ],
      variable: [
        /__[A-Z]+__/,
        /\{{3}.+?\}{3}/,
        /\{\{.+?\}\}/
      ],
      symbol: [/^#redirect/im, /~{3,5}/],
      "table-tag": {
        pattern: /((?:^|[|!])[|!])[^|\r\n]+\|(?!\|)/m,
        lookbehind: true,
        inside: {
          "table-bar": {
            pattern: /\|$/,
            alias: "punctuation"
          },
          rest: Prism2.languages.markup.tag.inside
        }
      },
      punctuation: /^(?:\{\||\|\}|\|-|[*#:;!|])|\|\||!!/m
    });
    Prism2.languages.insertBefore("wiki", "tag", {
      nowiki: {
        pattern: /<(nowiki|pre|source)\b[\s\S]*?>[\s\S]*?<\/\1>/i,
        inside: {
          tag: {
            pattern: /<(?:nowiki|pre|source)\b[\s\S]*?>|<\/(?:nowiki|pre|source)>/i,
            inside: Prism2.languages.markup.tag.inside
          }
        }
      }
    });
  }
};
var xeora_default = {
  language: "xeora",
  init: (Prism2) => {
    (function(Prism3) {
      Prism3.languages.xeora = Prism3.languages.extend("markup", {
        constant: {
          pattern: /\$(?:DomainContents|PageRenderDuration)\$/,
          inside: {
            punctuation: {
              pattern: /\$/
            }
          }
        },
        variable: {
          pattern: /\$@?(?:#+|[-+*~=^])?[\w.]+\$/,
          inside: {
            punctuation: {
              pattern: /[$.]/
            },
            operator: {
              pattern: /#+|[-+*~=^@]/
            }
          }
        },
        "function-inline": {
          pattern: /\$F:[-\w.]+\?[-\w.]+(?:,(?:\|?(?:[-#.^+*~]*(?:[\w+][^$]*)|=(?:[\S+][^$]*)|@[-#]*(?:\w+.)[\w+.]+)?)*)?\$/,
          inside: {
            variable: {
              pattern: /(?:[,|])@?(?:#+|[-+*~=^])?[\w.]+/,
              inside: {
                punctuation: {
                  pattern: /[,.|]/
                },
                operator: {
                  pattern: /#+|[-+*~=^@]/
                }
              }
            },
            punctuation: {
              pattern: /\$\w:|[$:?.,|]/
            }
          },
          alias: "function"
        },
        "function-block": {
          pattern: /\$XF:{[-\w.]+\?[-\w.]+(?:,(?:\|?(?:[-#.^+*~]*(?:[\w+][^$]*)|=(?:[\S+][^$]*)|@[-#]*(?:\w+.)[\w+.]+)?)*)?}:XF\$/,
          inside: {
            punctuation: {
              pattern: /[$:{}?.,|]/
            }
          },
          alias: "function"
        },
        "directive-inline": {
          pattern: /\$\w(?:#\d+\+?)?(?:\[[-\w.]+])?:[-\/\w.]+\$/,
          inside: {
            punctuation: {
              pattern: /\$(?:\w:|C(?:\[|#\d))?|[:{[\]]/,
              inside: {
                tag: {
                  pattern: /#\d/
                }
              }
            }
          },
          alias: "function"
        },
        "directive-block-open": {
          pattern: /\$\w+:{|\$\w(?:#\d+\+?)?(?:\[[-\w.]+])?:[-\w.]+:{(![A-Z]+)?/,
          inside: {
            punctuation: {
              pattern: /\$(?:\w:|C(?:\[|#\d))?|[:{[\]]/,
              inside: {
                tag: {
                  pattern: /#\d/
                }
              }
            },
            attribute: {
              pattern: /![A-Z]+$/,
              inside: {
                punctuation: {
                  pattern: /!/
                }
              },
              alias: "keyword"
            }
          },
          alias: "function"
        },
        "directive-block-separator": {
          pattern: /}:[-\w.]+:{/,
          inside: {
            punctuation: {
              pattern: /[:{}]/
            }
          },
          alias: "function"
        },
        "directive-block-close": {
          pattern: /}:[-\w.]+\$/,
          inside: {
            punctuation: {
              pattern: /[:{}$]/
            }
          },
          alias: "function"
        }
      });
      Prism3.languages.insertBefore("inside", "punctuation", {
        variable: Prism3.languages.xeora["function-inline"].inside.variable
      }, Prism3.languages.xeora["function-block"]);
      Prism3.languages.xeoracube = Prism3.languages.xeora;
    })(Prism2);
  }
};
var xojo_default = {
  language: "xojo",
  init: (Prism2) => {
    Prism2.languages.xojo = {
      comment: {
        pattern: /(?:'|\/\/|Rem\b).+/i,
        inside: {
          keyword: /^Rem/i
        }
      },
      string: {
        pattern: /"(?:""|[^"])*"/,
        greedy: true
      },
      number: [/(?:\b\d+\.?\d*|\B\.\d+)(?:E[+-]?\d+)?/i, /&[bchou][a-z\d]+/i],
      symbol: /#(?:If|Else|ElseIf|Endif|Pragma)\b/i,
      keyword: /\b(?:AddHandler|App|Array|As(?:signs)?|By(?:Ref|Val)|Break|Call|Case|Catch|Const|Continue|CurrentMethodName|Declare|Dim|Do(?:wnTo)?|Each|Else(?:If)?|End|Exit|Extends|False|Finally|For|Global|If|In|Lib|Loop|Me|Next|Nil|Optional|ParamArray|Raise(?:Event)?|ReDim|Rem|RemoveHandler|Return|Select|Self|Soft|Static|Step|Super|Then|To|True|Try|Ubound|Until|Using|Wend|While)\b/i,
      operator: /<[=>]?|>=?|[+\-*\/\\^=]|\b(?:AddressOf|And|Ctype|IsA?|Mod|New|Not|Or|Xor|WeakAddressOf)\b/i,
      punctuation: /[.,;:()]/
    };
  }
};
var yaml_default = {
  language: "yaml",
  init: (Prism2) => {
    Prism2.languages.yaml = {
      scalar: {
        pattern: /([\-:]\s*(?:![^\s]+)?[ \t]*[|>])[ \t]*(?:((?:\r?\n|\r)[ \t]+)[^\r\n]+(?:\2[^\r\n]+)*)/,
        lookbehind: true,
        alias: "string"
      },
      comment: /#.*/,
      key: {
        pattern: /(\s*(?:^|[:\-,[{\r\n?])[ \t]*(?:![^\s]+)?[ \t]*)[^\r\n{[\]},#\s]+?(?=\s*:\s)/,
        lookbehind: true,
        alias: "atrule"
      },
      directive: {
        pattern: /(^[ \t]*)%.+/m,
        lookbehind: true,
        alias: "important"
      },
      datetime: {
        pattern: /([:\-,[{]\s*(?:![^\s]+)?[ \t]*)(?:\d{4}-\d\d?-\d\d?(?:[tT]|[ \t]+)\d\d?:\d{2}:\d{2}(?:\.\d*)?[ \t]*(?:Z|[-+]\d\d?(?::\d{2})?)?|\d{4}-\d{2}-\d{2}|\d\d?:\d{2}(?::\d{2}(?:\.\d*)?)?)(?=[ \t]*(?:$|,|]|}))/m,
        lookbehind: true,
        alias: "number"
      },
      boolean: {
        pattern: /([:\-,[{]\s*(?:![^\s]+)?[ \t]*)(?:true|false)[ \t]*(?=$|,|]|})/im,
        lookbehind: true,
        alias: "important"
      },
      null: {
        pattern: /([:\-,[{]\s*(?:![^\s]+)?[ \t]*)(?:null|~)[ \t]*(?=$|,|]|})/im,
        lookbehind: true,
        alias: "important"
      },
      string: {
        pattern: /([:\-,[{]\s*(?:![^\s]+)?[ \t]*)("|')(?:(?!\2)[^\\\r\n]|\\.)*\2(?=[ \t]*(?:$|,|]|}))/m,
        lookbehind: true,
        greedy: true
      },
      number: {
        pattern: /([:\-,[{]\s*(?:![^\s]+)?[ \t]*)[+-]?(?:0x[\da-f]+|0o[0-7]+|(?:\d+\.?\d*|\.?\d+)(?:e[+-]?\d+)?|\.inf|\.nan)[ \t]*(?=$|,|]|})/im,
        lookbehind: true
      },
      tag: /![^\s]+/,
      important: /[&*][\w]+/,
      punctuation: /---|[:[\]{}\-,|>?]|\.\.\./
    };
  }
};
var sql_default = {
  language: "sql",
  init: (Prism2) => {
    Prism2.languages.sql = {
      comment: [
        { pattern: /(^|[^\\])\/\*[\s\S]*?\*\//, lookbehind: true },
        { pattern: /(^|[^\\:])--.*/, lookbehind: true }
      ],
      string: {
        pattern: /(^|[^@\\])("|')(?:\\[\s\S]|(?!\2)[^\\]|\2\2)*\2/,
        greedy: true,
        lookbehind: true
      },
      variable: /@[\w.$]+|@(?:'[^']*'|"[^"]*"|`[^`]*`)/,
      function: /\b(?:AVG|COUNT|FIRST|FORMAT|LAST|LCASE|LEN|MAX|MID|MIN|MOD|NOW|ROUND|SUM|UCASE)(?=\s*\()/i,
      keyword: /\b(?:ACTION|ADD|AFTER|ALGORITHM|ALL|ALTER|ANALYZE|ANY|APPLY|AS|ASC|AUTHORIZATION|AUTO_INCREMENT|BACKUP|BDB|BEGIN|BERKELEYDB|BIGINT|BINARY|BIT|BLOB|BOOL|BOOLEAN|BREAK|BROWSE|BTREE|BULK|BY|CALL|CASCADED?|CASE|CHAIN|CHAR(?:ACTER|SET)?|CHECK(?:POINT)?|CLOSE|CLUSTERED|COALESCE|COLLATE|COLUMNS?|COMMENT|COMMIT(?:TED)?|COMPUTE|CONNECT|CONSISTENT|CONSTRAINT|CONTAINS(?:TABLE)?|CONTINUE|CONVERT|CREATE|CROSS|CURRENT(?:_DATE|_TIME|_TIMESTAMP|_USER)?|CURSOR|CYCLE|DATA(?:BASES?)?|DATE(?:TIME)?|DAY|DBCC|DEALLOCATE|DEC|DECIMAL|DECLARE|DEFAULT|DEFINER|DELAYED|DELETE|DELIMITERS?|DENY|DESC|DESCRIBE|DETERMINISTIC|DISABLE|DISCARD|DISK|DISTINCT|DISTINCTROW|DISTRIBUTED|DO|DOUBLE|DROP|DUMMY|DUMP(?:FILE)?|DUPLICATE|ELSE(?:IF)?|ENABLE|ENCLOSED|END|ENGINE|ENUM|ERRLVL|ERRORS|ESCAPED?|EXCEPT|EXEC(?:UTE)?|EXISTS|EXIT|EXPLAIN|EXTENDED|FETCH|FIELDS|FILE|FILLFACTOR|FIRST|FIXED|FLOAT|FOLLOWING|FOR(?:EACH ROW)?|FORCE|FOREIGN|FREETEXT(?:TABLE)?|FROM|FULL|FUNCTION|GEOMETRY(?:COLLECTION)?|GLOBAL|GOTO|GRANT|GROUP|HANDLER|HASH|HAVING|HOLDLOCK|HOUR|IDENTITY(?:_INSERT|COL)?|IF|IGNORE|IMPORT|INDEX|INFILE|INNER|INNODB|INOUT|INSERT|INT(?:EGER)?|INTERSECT|INTERVAL|INTO|INVOKER|ISOLATION|ITERATE|JOIN|KEYS?|KILL|LANGUAGE|LAST|LEAVE|LEFT|LEVEL|LIMIT|LINETERMINATED|LINES|LINESTRING(?:COLLECTION)?|LOAD|LOCAL|LOCK|LONG(?:BLOB|TEXT)|LOOP|MATCH(?:ED)?|MEDIUM(?:BLOB|INT|TEXT)|MERGE|MINUTE|MODE|MODIFIES|MODIFY|MONTH|MULTILINESTRING|MULTIPOINT|MULTIPOLYGON|NATIONAL|NATURAL|NCHAR|NEXT|NO|NONCLUSTERED|NULLIF|NUMERIC|OFF?|OFFSETS?|ON|OPEN(?:DATASOURCE|QUERY|ROWSET)?|OPTIMIZE|OPTION(?:ALLY)?|ORDER|OUT(?:ER|FILE)?|OVER|PARTIAL|PARTITION|PERCENT|PIVOT|PLAN|POINT|POLYGON|PRECEDING|PRIMARY|PRINT|PRIVILEGES|PROC(?:EDURE)?|PUBLIC|PURGE|QUICK|RAISERROR|READS?|REAL|RECONFIGURE|REFERENCES|RELEASE|RENAME|REPEAT(?:ABLE)?|REPLACE|REPLICATION|REQUIRE|RESTORE|RESTRICT|RETURNS?|REVOKE|RIGHT|ROLLBACK|ROUTINE|ROW(?:COUNT|GUIDCOL|S)?|RTREE|RULE|SAVE(?:POINT)?|SECOND|SELECT|SERIAL(?:IZABLE)?|SESSION(?:_USER)?|SET(?:USER)?|SHARE|SHOW|SHUTDOWN|SIMPLE|SMALLINT|SNAPSHOT|SOME|SONAME|SQL|START(?:ING)?|STATISTICS|STATUS|STRIPED|SYSTEM_USER|TABLES?|TABLESPACE|TEMP(?:ORARY|TABLE)?|TERMINATED|TEXT(?:SIZE)?|THEN|TIME(?:STAMP)?|TINY(?:BLOB|INT|TEXT)|TOP?|TRAN(?:SACTIONS?)?|TRIGGER|TRUNCATE|TSEQUAL|TYPES?|UNBOUNDED|UNCOMMITTED|UNDEFINED|UNION|UNIQUE|UNPIVOT|UPDATE(?:TEXT)?|USAGE|USE|USER|USING|VALUES?|VARBINARY|VARCHAR|VARYING|VIEW|WAITFOR|WHEN|WHERE|WHILE|WITH(?:NOCHECK|OWNERSHIPCHAIN)?|WORK|WRITE(?:TEXT)?|YEAR)\b/i,
      boolean: /\b(?:TRUE|FALSE|NULL)\b/i,
      number: /\b0x[\da-f]+\b|\b\d+\.?\d*(?:e[+-]?\d+)?\b/i,
      operator: /[-+*\/=%^~]|&&?|\|\|?|!=?|<(?:=>?|<)?|>[>=]?|\b(?:AND|BETWEEN|IN|LIKE|NOT|OR|IS|DIV|REGEXP|RLIKE|SOUNDS LIKE|XOR)\b/i,
      punctuation: /[;[\]()`,.]/
    };
  }
};
var antlr4_default = {
  language: "antlr4",
  init: (Prism2) => {
    Prism2.languages.antlr4 = {
      comment: /\/\/.*|\/\*[\s\S]*?(?:\*\/|$)/,
      string: {
        pattern: /'(?:\\.|[^\\'\r\n])*'/,
        greedy: true
      },
      "character-class": {
        pattern: /\[(?:\\.|[^\\\]\r\n])*\]/,
        greedy: true,
        alias: "regex",
        inside: {
          range: {
            pattern: /([^[]|(?:^|[^\\])(?:\\\\)*\\\[)-(?!\])/,
            lookbehind: true,
            alias: "punctuation"
          },
          escape: /\\(?:u(?:[a-fA-F\d]{4}|\{[a-fA-F\d]+\})|[pP]\{[=\w-]+\}|[^\r\nupP])/,
          punctuation: /[\[\]]/
        }
      },
      action: {
        pattern: /\{(?:[^{}]|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})*\}/,
        greedy: true,
        inside: {
          content: {
            pattern: /(\{)[\s\S]+(?=\})/,
            lookbehind: true
          },
          punctuation: /[{}]/
        }
      },
      command: {
        pattern: /(->\s*(?!\s))(?:\s*(?:,\s*)?\b[a-z]\w*(?:\s*\([^()\r\n]*\))?)+(?=\s*;)/i,
        lookbehind: true,
        inside: {
          function: /\b\w+(?=\s*(?:[,(]|$))/,
          punctuation: /[,()]/
        }
      },
      annotation: {
        pattern: /@\w+(?:::\w+)*/,
        alias: "keyword"
      },
      label: {
        pattern: /#[ \t]*\w+/,
        alias: "punctuation"
      },
      keyword: /\b(?:catch|channels|finally|fragment|grammar|import|lexer|locals|mode|options|parser|returns|throws|tokens)\b/,
      definition: [
        {
          pattern: /\b[a-z]\w*(?=\s*:)/,
          alias: ["rule", "class-name"]
        },
        {
          pattern: /\b[A-Z]\w*(?=\s*:)/,
          alias: ["token", "constant"]
        }
      ],
      constant: /\b[A-Z][A-Z_]*\b/,
      operator: /\.\.|->|[|~]|[*+?]\??/,
      punctuation: /[;:()=]/
    };
    Prism2.languages.g4 = Prism2.languages.antlr4;
  }
};
var apex_default = {
  language: "apex",
  init: (Prism2) => {
    var keywords = /\b(?:(?:after|before)(?=\s+[a-z])|abstract|activate|and|any|array|as|asc|autonomous|begin|bigdecimal|blob|boolean|break|bulk|by|byte|case|cast|catch|char|class|collect|commit|const|continue|currency|date|datetime|decimal|default|delete|desc|do|double|else|end|enum|exception|exit|export|extends|final|finally|float|for|from|get(?=\s*[{};])|global|goto|group|having|hint|if|implements|import|in|inner|insert|instanceof|int|integer|interface|into|join|like|limit|list|long|loop|map|merge|new|not|null|nulls|number|object|of|on|or|outer|override|package|parallel|pragma|private|protected|public|retrieve|return|rollback|select|set|short|sObject|sort|static|string|super|switch|synchronized|system|testmethod|then|this|throw|time|transaction|transient|trigger|try|undelete|update|upsert|using|virtual|void|webservice|when|where|while|(?:inherited|with|without)\s+sharing)\b/i;
    var className = /\b(?:(?=[a-z_]\w*\s*[<\[])|(?!<keyword>))[A-Z_]\w*(?:\s*\.\s*[A-Z_]\w*)*\b(?:\s*(?:\[\s*\]|<(?:[^<>]|<(?:[^<>]|<[^<>]*>)*>)*>))*/.source.replace(/<keyword>/g, function() {
      return keywords.source;
    });
    function insertClassName(pattern) {
      return RegExp(pattern.replace(/<CLASS-NAME>/g, function() {
        return className;
      }), "i");
    }
    var classNameInside = {
      keyword: keywords,
      punctuation: /[()\[\]{};,:.<>]/
    };
    Prism2.languages.apex = {
      comment: Prism2.languages.clike.comment,
      string: Prism2.languages.clike.string,
      sql: {
        pattern: /((?:[=,({:]|\breturn)\s*)\[[^\[\]]*\]/i,
        lookbehind: true,
        greedy: true,
        alias: "language-sql",
        inside: Prism2.languages.sql
      },
      annotation: {
        pattern: /@\w+\b/,
        alias: "punctuation"
      },
      "class-name": [
        {
          pattern: insertClassName(/(\b(?:class|enum|extends|implements|instanceof|interface|new|trigger\s+\w+\s+on)\s+)<CLASS-NAME>/.source),
          lookbehind: true,
          inside: classNameInside
        },
        {
          pattern: insertClassName(/(\(\s*)<CLASS-NAME>(?=\s*\)\s*[\w(])/.source),
          lookbehind: true,
          inside: classNameInside
        },
        {
          pattern: insertClassName(/<CLASS-NAME>(?=\s*\w+\s*[;=,(){:])/.source),
          inside: classNameInside
        }
      ],
      trigger: {
        pattern: /(\btrigger\s+)\w+\b/i,
        lookbehind: true,
        alias: "class-name"
      },
      keyword: keywords,
      function: /\b[a-z_]\w*(?=\s*\()/i,
      boolean: /\b(?:false|true)\b/i,
      number: /(?:\B\.\d+|\b\d+(?:\.\d+|L)?)\b/i,
      operator: /[!=](?:==?)?|\?\.?|&&|\|\||--|\+\+|[-+*/^&|]=?|:|<<?=?|>{1,3}=?/,
      punctuation: /[()\[\]{};,.]/
    };
  }
};
var awk_default = {
  language: "awk",
  init: (Prism2) => {
    Prism2.languages.awk = {
      hashbang: {
        pattern: /^#!.*/,
        greedy: true,
        alias: "comment"
      },
      comment: {
        pattern: /#.*/,
        greedy: true
      },
      string: {
        pattern: /(^|[^\\])"(?:[^\\"\r\n]|\\.)*"/,
        lookbehind: true,
        greedy: true
      },
      regex: {
        pattern: /((?:^|[^\w\s)])\s*)\/(?:[^\/\\\r\n]|\\.)*\//,
        lookbehind: true,
        greedy: true
      },
      variable: /\$\w+/,
      keyword: /\b(?:BEGIN|BEGINFILE|END|ENDFILE|break|case|continue|default|delete|do|else|exit|for|function|getline|if|in|next|nextfile|printf?|return|switch|while)\b|@(?:include|load)\b/,
      function: /\b[a-z_]\w*(?=\s*\()/i,
      number: /\b(?:\d+(?:\.\d+)?(?:e[+-]?\d+)?|0x[a-fA-F0-9]+)\b/,
      operator: /--|\+\+|!?~|>&|>>|<<|(?:\*\*|[<>!=+\-*/%^])=?|&&|\|[|&]|[?:]/,
      punctuation: /[()[\]{},;]/
    };
    Prism2.languages.gawk = Prism2.languages.awk;
  }
};
var bicep_default = {
  language: "bicep",
  init: (Prism2) => {
    Prism2.languages.bicep = {
      comment: [
        {
          pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
          lookbehind: true,
          greedy: true
        },
        {
          pattern: /(^|[^\\:])\/\/.*/,
          lookbehind: true,
          greedy: true
        }
      ],
      property: [
        {
          pattern: /([\r\n][ \t]*)[a-z_]\w*(?=[ \t]*:)/i,
          lookbehind: true
        },
        {
          pattern: /([\r\n][ \t]*)'(?:\\.|\$(?!\{)|[^'\\\r\n$])*'(?=[ \t]*:)/,
          lookbehind: true,
          greedy: true
        }
      ],
      string: [
        {
          pattern: /'''[^'][\s\S]*?'''/,
          greedy: true
        },
        {
          pattern: /(^|[^\\'])'(?:\\.|\$(?!\{)|[^'\\\r\n$])*'/,
          lookbehind: true,
          greedy: true
        }
      ],
      "interpolated-string": {
        pattern: /(^|[^\\'])'(?:\\.|\$(?:(?!\{)|\{[^{}\r\n]*\})|[^'\\\r\n$])*'/,
        lookbehind: true,
        greedy: true,
        inside: {
          interpolation: {
            pattern: /\$\{[^{}\r\n]*\}/,
            inside: {
              expression: {
                pattern: /(^\$\{)[\s\S]+(?=\}$)/,
                lookbehind: true
              },
              punctuation: /^\$\{|\}$/
            }
          },
          string: /[\s\S]+/
        }
      },
      datatype: {
        pattern: /(\b(?:output|param)\b[ \t]+\w+[ \t]+)\w+\b/,
        lookbehind: true,
        alias: "class-name"
      },
      boolean: /\b(?:false|true)\b/,
      keyword: /\b(?:existing|for|if|in|module|null|output|param|resource|targetScope|var)\b/,
      decorator: /@\w+\b/,
      function: /\b[a-z_]\w*(?=[ \t]*\()/i,
      number: /(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:E[+-]?\d+)?/i,
      operator: /--|\+\+|\*\*=?|=>|&&=?|\|\|=?|[!=]==|<<=?|>>>?=?|[-+*/%&|^!=<>]=?|\.{3}|\?\?=?|\?\.?|[~:]/,
      punctuation: /[{}[\];(),.:]/
    };
    Prism2.languages.bicep["interpolated-string"].inside["interpolation"].inside["expression"].inside = Prism2.languages.bicep;
  }
};
var cfscript_default = {
  language: "cfscript",
  init: (Prism2) => {
    Prism2.languages.cfscript = Prism2.languages.extend("clike", {
      comment: [
        {
          pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
          lookbehind: true,
          inside: {
            annotation: {
              pattern: /(?:^|[^.])@[\w\.]+/,
              alias: "punctuation"
            }
          }
        },
        {
          pattern: /(^|[^\\:])\/\/.*/,
          lookbehind: true,
          greedy: true
        }
      ],
      keyword: /\b(?:abstract|break|catch|component|continue|default|do|else|extends|final|finally|for|function|if|in|include|package|private|property|public|remote|required|rethrow|return|static|switch|throw|try|var|while|xml)\b(?!\s*=)/,
      operator: [
        /\+\+|--|&&|\|\||::|=>|[!=]==|[-+*/%&|^!=<>]=?|\?(?:\.|:)?|:/,
        /\b(?:and|contains|eq|equal|eqv|gt|gte|imp|is|lt|lte|mod|not|or|xor)\b/
      ],
      scope: {
        pattern: /\b(?:application|arguments|cgi|client|cookie|local|session|super|this|variables)\b/,
        alias: "global"
      },
      type: {
        pattern: /\b(?:any|array|binary|boolean|date|guid|numeric|query|string|struct|uuid|void|xml)\b/,
        alias: "builtin"
      }
    });
    Prism2.languages.insertBefore("cfscript", "keyword", {
      "function-variable": {
        pattern: /[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*[=:]\s*(?:\bfunction\b|(?:\((?:[^()]|\([^()]*\))*\)|(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)\s*=>))/,
        alias: "function"
      }
    });
    delete Prism2.languages.cfscript["class-name"];
    Prism2.languages.cfc = Prism2.languages["cfscript"];
  }
};
var cmake_default = {
  language: "cmake",
  init: (Prism2) => {
    Prism2.languages.cmake = {
      comment: /#.*/,
      string: {
        pattern: /"(?:[^\\"]|\\.)*"/,
        greedy: true,
        inside: {
          interpolation: {
            pattern: /\$\{(?:[^{}$]|\$\{[^{}$]*\})*\}/,
            inside: {
              punctuation: /\$\{|\}/,
              variable: /\w+/
            }
          }
        }
      },
      variable: /\b(?:CMAKE_\w+|\w+_(?:(?:BINARY|SOURCE)_DIR|DESCRIPTION|HOMEPAGE_URL|ROOT|VERSION(?:_MAJOR|_MINOR|_PATCH|_TWEAK)?)|(?:ANDROID|APPLE|BORLAND|BUILD_SHARED_LIBS|CACHE|CPACK_(?:ABSOLUTE_DESTINATION_FILES|COMPONENT_INCLUDE_TOPLEVEL_DIRECTORY|ERROR_ON_ABSOLUTE_INSTALL_DESTINATION|INCLUDE_TOPLEVEL_DIRECTORY|INSTALL_DEFAULT_DIRECTORY_PERMISSIONS|INSTALL_SCRIPT|PACKAGING_INSTALL_PREFIX|SET_DESTDIR|WARN_ON_ABSOLUTE_INSTALL_DESTINATION)|CTEST_(?:BINARY_DIRECTORY|BUILD_COMMAND|BUILD_NAME|BZR_COMMAND|BZR_UPDATE_OPTIONS|CHANGE_ID|CHECKOUT_COMMAND|CONFIGURATION_TYPE|CONFIGURE_COMMAND|COVERAGE_COMMAND|COVERAGE_EXTRA_FLAGS|CURL_OPTIONS|CUSTOM_(?:COVERAGE_EXCLUDE|ERROR_EXCEPTION|ERROR_MATCH|ERROR_POST_CONTEXT|ERROR_PRE_CONTEXT|MAXIMUM_FAILED_TEST_OUTPUT_SIZE|MAXIMUM_NUMBER_OF_(?:ERRORS|WARNINGS)|MAXIMUM_PASSED_TEST_OUTPUT_SIZE|MEMCHECK_IGNORE|POST_MEMCHECK|POST_TEST|PRE_MEMCHECK|PRE_TEST|TESTS_IGNORE|WARNING_EXCEPTION|WARNING_MATCH)|CVS_CHECKOUT|CVS_COMMAND|CVS_UPDATE_OPTIONS|DROP_LOCATION|DROP_METHOD|DROP_SITE|DROP_SITE_CDASH|DROP_SITE_PASSWORD|DROP_SITE_USER|EXTRA_COVERAGE_GLOB|GIT_COMMAND|GIT_INIT_SUBMODULES|GIT_UPDATE_CUSTOM|GIT_UPDATE_OPTIONS|HG_COMMAND|HG_UPDATE_OPTIONS|LABELS_FOR_SUBPROJECTS|MEMORYCHECK_(?:COMMAND|COMMAND_OPTIONS|SANITIZER_OPTIONS|SUPPRESSIONS_FILE|TYPE)|NIGHTLY_START_TIME|P4_CLIENT|P4_COMMAND|P4_OPTIONS|P4_UPDATE_OPTIONS|RUN_CURRENT_SCRIPT|SCP_COMMAND|SITE|SOURCE_DIRECTORY|SUBMIT_URL|SVN_COMMAND|SVN_OPTIONS|SVN_UPDATE_OPTIONS|TEST_LOAD|TEST_TIMEOUT|TRIGGER_SITE|UPDATE_COMMAND|UPDATE_OPTIONS|UPDATE_VERSION_ONLY|USE_LAUNCHERS)|CYGWIN|ENV|EXECUTABLE_OUTPUT_PATH|GHS-MULTI|IOS|LIBRARY_OUTPUT_PATH|MINGW|MSVC(?:10|11|12|14|60|70|71|80|90|_IDE|_TOOLSET_VERSION|_VERSION)?|MSYS|PROJECT_NAME|UNIX|WIN32|WINCE|WINDOWS_PHONE|WINDOWS_STORE|XCODE))\b/,
      property: /\b(?:cxx_\w+|(?:ARCHIVE_OUTPUT_(?:DIRECTORY|NAME)|COMPILE_DEFINITIONS|COMPILE_PDB_NAME|COMPILE_PDB_OUTPUT_DIRECTORY|EXCLUDE_FROM_DEFAULT_BUILD|IMPORTED_(?:IMPLIB|LIBNAME|LINK_DEPENDENT_LIBRARIES|LINK_INTERFACE_LANGUAGES|LINK_INTERFACE_LIBRARIES|LINK_INTERFACE_MULTIPLICITY|LOCATION|NO_SONAME|OBJECTS|SONAME)|INTERPROCEDURAL_OPTIMIZATION|LIBRARY_OUTPUT_DIRECTORY|LIBRARY_OUTPUT_NAME|LINK_FLAGS|LINK_INTERFACE_LIBRARIES|LINK_INTERFACE_MULTIPLICITY|LOCATION|MAP_IMPORTED_CONFIG|OSX_ARCHITECTURES|OUTPUT_NAME|PDB_NAME|PDB_OUTPUT_DIRECTORY|RUNTIME_OUTPUT_DIRECTORY|RUNTIME_OUTPUT_NAME|STATIC_LIBRARY_FLAGS|VS_CSHARP|VS_DOTNET_REFERENCEPROP|VS_DOTNET_REFERENCE|VS_GLOBAL_SECTION_POST|VS_GLOBAL_SECTION_PRE|VS_GLOBAL|XCODE_ATTRIBUTE)_\w+|\w+_(?:CLANG_TIDY|COMPILER_LAUNCHER|CPPCHECK|CPPLINT|INCLUDE_WHAT_YOU_USE|OUTPUT_NAME|POSTFIX|VISIBILITY_PRESET)|ABSTRACT|ADDITIONAL_MAKE_CLEAN_FILES|ADVANCED|ALIASED_TARGET|ALLOW_DUPLICATE_CUSTOM_TARGETS|ANDROID_(?:ANT_ADDITIONAL_OPTIONS|API|API_MIN|ARCH|ASSETS_DIRECTORIES|GUI|JAR_DEPENDENCIES|NATIVE_LIB_DEPENDENCIES|NATIVE_LIB_DIRECTORIES|PROCESS_MAX|PROGUARD|PROGUARD_CONFIG_PATH|SECURE_PROPS_PATH|SKIP_ANT_STEP|STL_TYPE)|ARCHIVE_OUTPUT_DIRECTORY|ATTACHED_FILES|ATTACHED_FILES_ON_FAIL|AUTOGEN_(?:BUILD_DIR|ORIGIN_DEPENDS|PARALLEL|SOURCE_GROUP|TARGETS_FOLDER|TARGET_DEPENDS)|AUTOMOC|AUTOMOC_(?:COMPILER_PREDEFINES|DEPEND_FILTERS|EXECUTABLE|MACRO_NAMES|MOC_OPTIONS|SOURCE_GROUP|TARGETS_FOLDER)|AUTORCC|AUTORCC_EXECUTABLE|AUTORCC_OPTIONS|AUTORCC_SOURCE_GROUP|AUTOUIC|AUTOUIC_EXECUTABLE|AUTOUIC_OPTIONS|AUTOUIC_SEARCH_PATHS|BINARY_DIR|BUILDSYSTEM_TARGETS|BUILD_RPATH|BUILD_RPATH_USE_ORIGIN|BUILD_WITH_INSTALL_NAME_DIR|BUILD_WITH_INSTALL_RPATH|BUNDLE|BUNDLE_EXTENSION|CACHE_VARIABLES|CLEAN_NO_CUSTOM|COMMON_LANGUAGE_RUNTIME|COMPATIBLE_INTERFACE_(?:BOOL|NUMBER_MAX|NUMBER_MIN|STRING)|COMPILE_(?:DEFINITIONS|FEATURES|FLAGS|OPTIONS|PDB_NAME|PDB_OUTPUT_DIRECTORY)|COST|CPACK_DESKTOP_SHORTCUTS|CPACK_NEVER_OVERWRITE|CPACK_PERMANENT|CPACK_STARTUP_SHORTCUTS|CPACK_START_MENU_SHORTCUTS|CPACK_WIX_ACL|CROSSCOMPILING_EMULATOR|CUDA_EXTENSIONS|CUDA_PTX_COMPILATION|CUDA_RESOLVE_DEVICE_SYMBOLS|CUDA_SEPARABLE_COMPILATION|CUDA_STANDARD|CUDA_STANDARD_REQUIRED|CXX_EXTENSIONS|CXX_STANDARD|CXX_STANDARD_REQUIRED|C_EXTENSIONS|C_STANDARD|C_STANDARD_REQUIRED|DEBUG_CONFIGURATIONS|DEFINE_SYMBOL|DEFINITIONS|DEPENDS|DEPLOYMENT_ADDITIONAL_FILES|DEPLOYMENT_REMOTE_DIRECTORY|DISABLED|DISABLED_FEATURES|ECLIPSE_EXTRA_CPROJECT_CONTENTS|ECLIPSE_EXTRA_NATURES|ENABLED_FEATURES|ENABLED_LANGUAGES|ENABLE_EXPORTS|ENVIRONMENT|EXCLUDE_FROM_ALL|EXCLUDE_FROM_DEFAULT_BUILD|EXPORT_NAME|EXPORT_PROPERTIES|EXTERNAL_OBJECT|EchoString|FAIL_REGULAR_EXPRESSION|FIND_LIBRARY_USE_LIB32_PATHS|FIND_LIBRARY_USE_LIB64_PATHS|FIND_LIBRARY_USE_LIBX32_PATHS|FIND_LIBRARY_USE_OPENBSD_VERSIONING|FIXTURES_CLEANUP|FIXTURES_REQUIRED|FIXTURES_SETUP|FOLDER|FRAMEWORK|Fortran_FORMAT|Fortran_MODULE_DIRECTORY|GENERATED|GENERATOR_FILE_NAME|GENERATOR_IS_MULTI_CONFIG|GHS_INTEGRITY_APP|GHS_NO_SOURCE_GROUP_FILE|GLOBAL_DEPENDS_DEBUG_MODE|GLOBAL_DEPENDS_NO_CYCLES|GNUtoMS|HAS_CXX|HEADER_FILE_ONLY|HELPSTRING|IMPLICIT_DEPENDS_INCLUDE_TRANSFORM|IMPORTED|IMPORTED_(?:COMMON_LANGUAGE_RUNTIME|CONFIGURATIONS|GLOBAL|IMPLIB|LIBNAME|LINK_DEPENDENT_LIBRARIES|LINK_INTERFACE_(?:LANGUAGES|LIBRARIES|MULTIPLICITY)|LOCATION|NO_SONAME|OBJECTS|SONAME)|IMPORT_PREFIX|IMPORT_SUFFIX|INCLUDE_DIRECTORIES|INCLUDE_REGULAR_EXPRESSION|INSTALL_NAME_DIR|INSTALL_RPATH|INSTALL_RPATH_USE_LINK_PATH|INTERFACE_(?:AUTOUIC_OPTIONS|COMPILE_DEFINITIONS|COMPILE_FEATURES|COMPILE_OPTIONS|INCLUDE_DIRECTORIES|LINK_DEPENDS|LINK_DIRECTORIES|LINK_LIBRARIES|LINK_OPTIONS|POSITION_INDEPENDENT_CODE|SOURCES|SYSTEM_INCLUDE_DIRECTORIES)|INTERPROCEDURAL_OPTIMIZATION|IN_TRY_COMPILE|IOS_INSTALL_COMBINED|JOB_POOLS|JOB_POOL_COMPILE|JOB_POOL_LINK|KEEP_EXTENSION|LABELS|LANGUAGE|LIBRARY_OUTPUT_DIRECTORY|LINKER_LANGUAGE|LINK_(?:DEPENDS|DEPENDS_NO_SHARED|DIRECTORIES|FLAGS|INTERFACE_LIBRARIES|INTERFACE_MULTIPLICITY|LIBRARIES|OPTIONS|SEARCH_END_STATIC|SEARCH_START_STATIC|WHAT_YOU_USE)|LISTFILE_STACK|LOCATION|MACOSX_BUNDLE|MACOSX_BUNDLE_INFO_PLIST|MACOSX_FRAMEWORK_INFO_PLIST|MACOSX_PACKAGE_LOCATION|MACOSX_RPATH|MACROS|MANUALLY_ADDED_DEPENDENCIES|MEASUREMENT|MODIFIED|NAME|NO_SONAME|NO_SYSTEM_FROM_IMPORTED|OBJECT_DEPENDS|OBJECT_OUTPUTS|OSX_ARCHITECTURES|OUTPUT_NAME|PACKAGES_FOUND|PACKAGES_NOT_FOUND|PARENT_DIRECTORY|PASS_REGULAR_EXPRESSION|PDB_NAME|PDB_OUTPUT_DIRECTORY|POSITION_INDEPENDENT_CODE|POST_INSTALL_SCRIPT|PREDEFINED_TARGETS_FOLDER|PREFIX|PRE_INSTALL_SCRIPT|PRIVATE_HEADER|PROCESSORS|PROCESSOR_AFFINITY|PROJECT_LABEL|PUBLIC_HEADER|REPORT_UNDEFINED_PROPERTIES|REQUIRED_FILES|RESOURCE|RESOURCE_LOCK|RULE_LAUNCH_COMPILE|RULE_LAUNCH_CUSTOM|RULE_LAUNCH_LINK|RULE_MESSAGES|RUNTIME_OUTPUT_DIRECTORY|RUN_SERIAL|SKIP_AUTOGEN|SKIP_AUTOMOC|SKIP_AUTORCC|SKIP_AUTOUIC|SKIP_BUILD_RPATH|SKIP_RETURN_CODE|SOURCES|SOURCE_DIR|SOVERSION|STATIC_LIBRARY_FLAGS|STATIC_LIBRARY_OPTIONS|STRINGS|SUBDIRECTORIES|SUFFIX|SYMBOLIC|TARGET_ARCHIVES_MAY_BE_SHARED_LIBS|TARGET_MESSAGES|TARGET_SUPPORTS_SHARED_LIBS|TESTS|TEST_INCLUDE_FILE|TEST_INCLUDE_FILES|TIMEOUT|TIMEOUT_AFTER_MATCH|TYPE|USE_FOLDERS|VALUE|VARIABLES|VERSION|VISIBILITY_INLINES_HIDDEN|VS_(?:CONFIGURATION_TYPE|COPY_TO_OUT_DIR|DEBUGGER_(?:COMMAND|COMMAND_ARGUMENTS|ENVIRONMENT|WORKING_DIRECTORY)|DEPLOYMENT_CONTENT|DEPLOYMENT_LOCATION|DOTNET_REFERENCES|DOTNET_REFERENCES_COPY_LOCAL|INCLUDE_IN_VSIX|IOT_STARTUP_TASK|KEYWORD|RESOURCE_GENERATOR|SCC_AUXPATH|SCC_LOCALPATH|SCC_PROJECTNAME|SCC_PROVIDER|SDK_REFERENCES|SHADER_(?:DISABLE_OPTIMIZATIONS|ENABLE_DEBUG|ENTRYPOINT|FLAGS|MODEL|OBJECT_FILE_NAME|OUTPUT_HEADER_FILE|TYPE|VARIABLE_NAME)|STARTUP_PROJECT|TOOL_OVERRIDE|USER_PROPS|WINRT_COMPONENT|WINRT_EXTENSIONS|WINRT_REFERENCES|XAML_TYPE)|WILL_FAIL|WIN32_EXECUTABLE|WINDOWS_EXPORT_ALL_SYMBOLS|WORKING_DIRECTORY|WRAP_EXCLUDE|XCODE_(?:EMIT_EFFECTIVE_PLATFORM_NAME|EXPLICIT_FILE_TYPE|FILE_ATTRIBUTES|LAST_KNOWN_FILE_TYPE|PRODUCT_TYPE|SCHEME_(?:ADDRESS_SANITIZER|ADDRESS_SANITIZER_USE_AFTER_RETURN|ARGUMENTS|DISABLE_MAIN_THREAD_CHECKER|DYNAMIC_LIBRARY_LOADS|DYNAMIC_LINKER_API_USAGE|ENVIRONMENT|EXECUTABLE|GUARD_MALLOC|MAIN_THREAD_CHECKER_STOP|MALLOC_GUARD_EDGES|MALLOC_SCRIBBLE|MALLOC_STACK|THREAD_SANITIZER(?:_STOP)?|UNDEFINED_BEHAVIOUR_SANITIZER(?:_STOP)?|ZOMBIE_OBJECTS))|XCTEST)\b/,
      keyword: /\b(?:add_compile_definitions|add_compile_options|add_custom_command|add_custom_target|add_definitions|add_dependencies|add_executable|add_library|add_link_options|add_subdirectory|add_test|aux_source_directory|break|build_command|build_name|cmake_host_system_information|cmake_minimum_required|cmake_parse_arguments|cmake_policy|configure_file|continue|create_test_sourcelist|ctest_build|ctest_configure|ctest_coverage|ctest_empty_binary_directory|ctest_memcheck|ctest_read_custom_files|ctest_run_script|ctest_sleep|ctest_start|ctest_submit|ctest_test|ctest_update|ctest_upload|define_property|else|elseif|enable_language|enable_testing|endforeach|endfunction|endif|endmacro|endwhile|exec_program|execute_process|export|export_library_dependencies|file|find_file|find_library|find_package|find_path|find_program|fltk_wrap_ui|foreach|function|get_cmake_property|get_directory_property|get_filename_component|get_property|get_source_file_property|get_target_property|get_test_property|if|include|include_directories|include_external_msproject|include_guard|include_regular_expression|install|install_files|install_programs|install_targets|link_directories|link_libraries|list|load_cache|load_command|macro|make_directory|mark_as_advanced|math|message|option|output_required_files|project|qt_wrap_cpp|qt_wrap_ui|remove|remove_definitions|return|separate_arguments|set|set_directory_properties|set_property|set_source_files_properties|set_target_properties|set_tests_properties|site_name|source_group|string|subdir_depends|subdirs|target_compile_definitions|target_compile_features|target_compile_options|target_include_directories|target_link_directories|target_link_libraries|target_link_options|target_sources|try_compile|try_run|unset|use_mangled_mesa|utility_source|variable_requires|variable_watch|while|write_file)(?=\s*\()\b/,
      boolean: /\b(?:FALSE|OFF|ON|TRUE)\b/,
      namespace: /\b(?:INTERFACE|PRIVATE|PROPERTIES|PUBLIC|SHARED|STATIC|TARGET_OBJECTS)\b/,
      operator: /\b(?:AND|DEFINED|EQUAL|GREATER|LESS|MATCHES|NOT|OR|STREQUAL|STRGREATER|STRLESS|VERSION_EQUAL|VERSION_GREATER|VERSION_LESS)\b/,
      inserted: {
        pattern: /\b\w+::\w+\b/,
        alias: "class-name"
      },
      number: /\b\d+(?:\.\d+)*\b/,
      function: /\b[a-z_]\w*(?=\s*\()\b/i,
      punctuation: /[()>}]|\$[<{]/
    };
  }
};
var csv_default = {
  language: "csv",
  init: (Prism2) => {
    Prism2.languages.csv = {
      value: /[^\r\n,"]+|"(?:[^"]|"")*"(?!")/,
      punctuation: /,/
    };
  }
};
var dot_default = {
  language: "dot",
  init: (Prism2) => {
    (function(Prism3) {
      var ID = "(?:" + [
        /[a-zA-Z_\x80-\uFFFF][\w\x80-\uFFFF]*/.source,
        /-?(?:\.\d+|\d+(?:\.\d*)?)/.source,
        /"[^"\\]*(?:\\[\s\S][^"\\]*)*"/.source,
        /<(?:[^<>]|(?!<!--)<(?:[^<>"']|"[^"]*"|'[^']*')+>|<!--(?:[^-]|-(?!->))*-->)*>/.source
      ].join("|") + ")";
      var IDInside = {
        markup: {
          pattern: /(^<)[\s\S]+(?=>$)/,
          lookbehind: true,
          alias: ["language-markup", "language-html", "language-xml"],
          inside: Prism3.languages.markup
        }
      };
      function withID(source, flags) {
        return RegExp(source.replace(/<ID>/g, function() {
          return ID;
        }), flags);
      }
      Prism3.languages.dot = {
        comment: {
          pattern: /\/\/.*|\/\*[\s\S]*?\*\/|^#.*/m,
          greedy: true
        },
        "graph-name": {
          pattern: withID(/(\b(?:digraph|graph|subgraph)[ \t\r\n]+)<ID>/.source, "i"),
          lookbehind: true,
          greedy: true,
          alias: "class-name",
          inside: IDInside
        },
        "attr-value": {
          pattern: withID(/(=[ \t\r\n]*)<ID>/.source),
          lookbehind: true,
          greedy: true,
          inside: IDInside
        },
        "attr-name": {
          pattern: withID(/([\[;, \t\r\n])<ID>(?=[ \t\r\n]*=)/.source),
          lookbehind: true,
          greedy: true,
          inside: IDInside
        },
        keyword: /\b(?:digraph|edge|graph|node|strict|subgraph)\b/i,
        "compass-point": {
          pattern: /(:[ \t\r\n]*)(?:[ewc_]|[ns][ew]?)(?![\w\x80-\uFFFF])/,
          lookbehind: true,
          alias: "builtin"
        },
        node: {
          pattern: withID(/(^|[^-.\w\x80-\uFFFF\\])<ID>/.source),
          lookbehind: true,
          greedy: true,
          inside: IDInside
        },
        operator: /[=:]|-[->]/,
        punctuation: /[\[\]{};,]/
      };
      Prism3.languages.gv = Prism3.languages.dot;
    })(Prism2);
  }
};
var elm_default = {
  language: "elm",
  init: (Prism2) => {
    Prism2.languages.elm = {
      comment: /--.*|\{-[\s\S]*?-\}/,
      char: {
        pattern: /'(?:[^\\'\r\n]|\\(?:[abfnrtv\\']|\d+|x[0-9a-fA-F]+|u\{[0-9a-fA-F]+\}))'/,
        greedy: true
      },
      string: [
        {
          pattern: /"""[\s\S]*?"""/,
          greedy: true
        },
        {
          pattern: /"(?:[^\\"\r\n]|\\.)*"/,
          greedy: true
        }
      ],
      "import-statement": {
        pattern: /(^[\t ]*)import\s+[A-Z]\w*(?:\.[A-Z]\w*)*(?:\s+as\s+(?:[A-Z]\w*)(?:\.[A-Z]\w*)*)?(?:\s+exposing\s+)?/m,
        lookbehind: true,
        inside: {
          keyword: /\b(?:as|exposing|import)\b/
        }
      },
      keyword: /\b(?:alias|as|case|else|exposing|if|in|infixl|infixr|let|module|of|then|type)\b/,
      builtin: /\b(?:abs|acos|always|asin|atan|atan2|ceiling|clamp|compare|cos|curry|degrees|e|flip|floor|fromPolar|identity|isInfinite|isNaN|logBase|max|min|negate|never|not|pi|radians|rem|round|sin|sqrt|tan|toFloat|toPolar|toString|truncate|turns|uncurry|xor)\b/,
      number: /\b(?:\d+(?:\.\d+)?(?:e[+-]?\d+)?|0x[0-9a-f]+)\b/i,
      operator: /\s\.\s|[+\-/*=.$<>:&|^?%#@~!]{2,}|[+\-/*=$<>:&|^?%#@~!]/,
      hvariable: /\b(?:[A-Z]\w*\.)*[a-z]\w*\b/,
      constant: /\b(?:[A-Z]\w*\.)*[A-Z]\w*\b/,
      punctuation: /[{}[\]|(),.:]/
    };
  }
};
var gdscript_default = {
  language: "gdscript",
  init: (Prism2) => {
    Prism2.languages.gdscript = {
      comment: /#.*/,
      string: {
        pattern: /@?(?:("|')(?:(?!\1)[^\n\\]|\\[\s\S])*\1(?!"|')|"""(?:[^\\]|\\[\s\S])*?""")/,
        greedy: true
      },
      "class-name": {
        pattern: /(^(?:class|class_name|extends)[ \t]+|^export\([ \t]*|\bas[ \t]+|(?:\b(?:const|var)[ \t]|[,(])[ \t]*\w+[ \t]*:[ \t]*|->[ \t]*)[a-zA-Z_]\w*/m,
        lookbehind: true
      },
      keyword: /\b(?:and|as|assert|break|breakpoint|class|class_name|const|continue|elif|else|enum|export|extends|for|func|if|in|is|master|mastersync|match|not|null|onready|or|pass|preload|puppet|puppetsync|remote|remotesync|return|self|setget|signal|static|tool|var|while|yield)\b/,
      function: /\b[a-z_]\w*(?=[ \t]*\()/i,
      variable: /\$\w+/,
      number: [
        /\b0b[01_]+\b|\b0x[\da-fA-F_]+\b|(?:\b\d[\d_]*(?:\.[\d_]*)?|\B\.[\d_]+)(?:e[+-]?[\d_]+)?\b/,
        /\b(?:INF|NAN|PI|TAU)\b/
      ],
      constant: /\b[A-Z][A-Z_\d]*\b/,
      boolean: /\b(?:false|true)\b/,
      operator: /->|:=|&&|\|\||<<|>>|[-+*/%&|!<>=]=?|[~^]/,
      punctuation: /[.:,;()[\]{}]/
    };
  }
};
var gettext_default = {
  language: "gettext",
  init: (Prism2) => {
    Prism2.languages.gettext = {
      comment: [
        {
          pattern: /# .*/,
          greedy: true,
          alias: "translator-comment"
        },
        {
          pattern: /#\..*/,
          greedy: true,
          alias: "extracted-comment"
        },
        {
          pattern: /#:.*/,
          greedy: true,
          alias: "reference-comment"
        },
        {
          pattern: /#,.*/,
          greedy: true,
          alias: "flag-comment"
        },
        {
          pattern: /#\|.*/,
          greedy: true,
          alias: "previously-untranslated-comment"
        },
        {
          pattern: /#.*/,
          greedy: true
        }
      ],
      string: {
        pattern: /(^|[^\\])"(?:[^"\\]|\\.)*"/,
        lookbehind: true,
        greedy: true
      },
      keyword: /^msg(?:ctxt|id|id_plural|str)\b/m,
      number: /\b\d+\b/,
      punctuation: /[\[\]]/
    };
    Prism2.languages.po = Prism2.languages.gettext;
  }
};
var hcl_default = {
  language: "hcl",
  init: (Prism2) => {
    Prism2.languages.hcl = {
      comment: /(?:\/\/|#).*|\/\*[\s\S]*?(?:\*\/|$)/,
      heredoc: {
        pattern: /<<-?(\w+\b)[\s\S]*?^[ \t]*\1/m,
        greedy: true,
        alias: "string"
      },
      keyword: [
        {
          pattern: /(?:data|resource)\s+(?:"(?:\\[\s\S]|[^\\"])*")(?=\s+"[\w-]+"\s+\{)/i,
          inside: {
            type: {
              pattern: /(resource|data|\s+)(?:"(?:\\[\s\S]|[^\\"])*")/i,
              lookbehind: true,
              alias: "variable"
            }
          }
        },
        {
          pattern: /(?:backend|module|output|provider|provisioner|variable)\s+(?:[\w-]+|"(?:\\[\s\S]|[^\\"])*")\s+(?=\{)/i,
          inside: {
            type: {
              pattern: /(backend|module|output|provider|provisioner|variable)\s+(?:[\w-]+|"(?:\\[\s\S]|[^\\"])*")\s+/i,
              lookbehind: true,
              alias: "variable"
            }
          }
        },
        /[\w-]+(?=\s+\{)/
      ],
      property: [
        /[-\w\.]+(?=\s*=(?!=))/,
        /"(?:\\[\s\S]|[^\\"])+"(?=\s*[:=])/
      ],
      string: {
        pattern: /"(?:[^\\$"]|\\[\s\S]|\$(?:(?=")|\$+(?!\$)|[^"${])|\$\{(?:[^{}"]|"(?:[^\\"]|\\[\s\S])*")*\})*"/,
        greedy: true,
        inside: {
          interpolation: {
            pattern: /(^|[^$])\$\{(?:[^{}"]|"(?:[^\\"]|\\[\s\S])*")*\}/,
            lookbehind: true,
            inside: {
              type: {
                pattern: /(\b(?:count|data|local|module|path|self|terraform|var)\b\.)[\w\*]+/i,
                lookbehind: true,
                alias: "variable"
              },
              keyword: /\b(?:count|data|local|module|path|self|terraform|var)\b/i,
              function: /\w+(?=\()/,
              string: {
                pattern: /"(?:\\[\s\S]|[^\\"])*"/,
                greedy: true
              },
              number: /\b0x[\da-f]+\b|\b\d+(?:\.\d*)?(?:e[+-]?\d+)?/i,
              punctuation: /[!\$#%&'()*+,.\/;<=>@\[\\\]^`{|}~?:]/
            }
          }
        }
      },
      number: /\b0x[\da-f]+\b|\b\d+(?:\.\d*)?(?:e[+-]?\d+)?/i,
      boolean: /\b(?:false|true)\b/i,
      punctuation: /[=\[\]{}]/
    };
  }
};
var idris_default = {
  language: "idris",
  init: (Prism2) => {
    Prism2.languages.idris = Prism2.languages.extend("haskell", {
      comment: {
        pattern: /(?:(?:--|\|\|\|).*$|\{-[\s\S]*?-\})/m
      },
      keyword: /\b(?:Type|case|class|codata|constructor|corecord|data|do|dsl|else|export|if|implementation|implicit|import|impossible|in|infix|infixl|infixr|instance|interface|let|module|mutual|namespace|of|parameters|partial|postulate|private|proof|public|quoteGoal|record|rewrite|syntax|then|total|using|where|with)\b/,
      builtin: undefined
    });
    Prism2.languages.insertBefore("idris", "keyword", {
      "import-statement": {
        pattern: /(^\s*import\s+)(?:[A-Z][\w']*)(?:\.[A-Z][\w']*)*/m,
        lookbehind: true,
        inside: {
          punctuation: /\./
        }
      }
    });
    Prism2.languages.idr = Prism2.languages.idris;
  }
};
var ignore_default = {
  language: "ignore",
  init: (Prism2) => {
    Prism2.languages.ignore = {
      comment: /^#.*/m,
      entry: {
        pattern: /\S(?:.*(?:(?:\\ )|\S))?/,
        alias: "string",
        inside: {
          operator: /^!|\*\*?|\?/,
          regex: {
            pattern: /(^|[^\\])\[[^\[\]]*\]/,
            lookbehind: true
          },
          punctuation: /\//
        }
      }
    };
    Prism2.languages.gitignore = Prism2.languages.ignore;
    Prism2.languages.hgignore = Prism2.languages.ignore;
    Prism2.languages.npmignore = Prism2.languages.ignore;
  }
};
var json5_default = {
  language: "json5",
  init: (Prism2) => {
    var string = /("|')(?:\\(?:\r\n?|\n|.)|(?!\1)[^\\\r\n])*\1/;
    Prism2.languages.json5 = Prism2.languages.extend("json", {
      property: [
        {
          pattern: RegExp(string.source + "(?=\\s*:)"),
          greedy: true
        },
        {
          pattern: /(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*:)/,
          alias: "unquoted"
        }
      ],
      string: {
        pattern: string,
        greedy: true
      },
      number: /[+-]?\b(?:NaN|Infinity|0x[a-fA-F\d]+)\b|[+-]?(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:[eE][+-]?\d+\b)?/
    });
  }
};
var lilypond_default = {
  language: "lilypond",
  init: (Prism2) => {
    var schemeExpression = /\((?:[^();"#\\]|\\[\s\S]|;.*(?!.)|"(?:[^"\\]|\\.)*"|#(?:\{(?:(?!#\})[\s\S])*#\}|[^{])|<expr>)*\)/.source;
    var recursivenessLog2 = 5;
    for (var i = 0;i < recursivenessLog2; i++) {
      schemeExpression = schemeExpression.replace(/<expr>/g, function() {
        return schemeExpression;
      });
    }
    schemeExpression = schemeExpression.replace(/<expr>/g, /[^\s\S]/.source);
    var lilypond = Prism2.languages.lilypond = {
      comment: /%(?:(?!\{).*|\{[\s\S]*?%\})/,
      "embedded-scheme": {
        pattern: RegExp(/(^|[=\s])#(?:"(?:[^"\\]|\\.)*"|[^\s()"]*(?:[^\s()]|<expr>))/.source.replace(/<expr>/g, function() {
          return schemeExpression;
        }), "m"),
        lookbehind: true,
        greedy: true,
        inside: {
          scheme: {
            pattern: /^(#)[\s\S]+$/,
            lookbehind: true,
            alias: "language-scheme",
            inside: {
              "embedded-lilypond": {
                pattern: /#\{[\s\S]*?#\}/,
                greedy: true,
                inside: {
                  punctuation: /^#\{|#\}$/,
                  lilypond: {
                    pattern: /[\s\S]+/,
                    alias: "language-lilypond",
                    inside: null
                  }
                }
              },
              rest: Prism2.languages.scheme
            }
          },
          punctuation: /#/
        }
      },
      string: {
        pattern: /"(?:[^"\\]|\\.)*"/,
        greedy: true
      },
      "class-name": {
        pattern: /(\\new\s+)[\w-]+/,
        lookbehind: true
      },
      keyword: {
        pattern: /\\[a-z][-\w]*/i,
        inside: {
          punctuation: /^\\/
        }
      },
      operator: /[=|]|<<|>>/,
      punctuation: {
        pattern: /(^|[a-z\d])(?:'+|,+|[_^]?-[_^]?(?:[-+^!>._]|(?=\d))|[_^]\.?|[.!])|[{}()[\]<>^~]|\\[()[\]<>\\!]|--|__/,
        lookbehind: true
      },
      number: /\b\d+(?:\/\d+)?\b/
    };
    lilypond["embedded-scheme"].inside["scheme"].inside["embedded-lilypond"].inside["lilypond"].inside = lilypond;
    Prism2.languages.ly = lilypond;
  }
};
var linker_script_default = {
  language: "linker-script",
  init: (Prism2) => {
    Prism2.languages["linker-script"] = {
      comment: {
        pattern: /(^|\s)\/\*[\s\S]*?(?:$|\*\/)/,
        lookbehind: true,
        greedy: true
      },
      identifier: {
        pattern: /"[^"\r\n]*"/,
        greedy: true
      },
      "location-counter": {
        pattern: /\B\.\B/,
        alias: "important"
      },
      section: {
        pattern: /(^|[^\w*])\.\w+\b/,
        lookbehind: true,
        alias: "keyword"
      },
      function: /\b[A-Z][A-Z_]*(?=\s*\()/,
      number: /\b(?:0[xX][a-fA-F0-9]+|\d+)[KM]?\b/,
      operator: />>=?|<<=?|->|\+\+|--|&&|\|\||::|[?:~]|[-+*/%&|^!=<>]=?/,
      punctuation: /[(){},;]/
    };
    Prism2.languages["ld"] = Prism2.languages["linker-script"];
  }
};
var llvm_default = {
  language: "llvm",
  init: (Prism2) => {
    Prism2.languages.llvm = {
      comment: /;.*/,
      string: {
        pattern: /"[^"]*"/,
        greedy: true
      },
      boolean: /\b(?:false|true)\b/,
      variable: /[%@!#](?:(?!\d)(?:[-$.\w]|\\[a-f\d]{2})+|\d+)/i,
      label: /(?!\d)(?:[-$.\w]|\\[a-f\d]{2})+:/i,
      type: {
        pattern: /\b(?:double|float|fp128|half|i[1-9]\d*|label|metadata|ppc_fp128|token|void|x86_fp80|x86_mmx)\b/,
        alias: "class-name"
      },
      keyword: /\b[a-z_][a-z_0-9]*\b/,
      number: /[+-]?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\b0x[\dA-Fa-f]+\b|\b0xK[\dA-Fa-f]{20}\b|\b0x[ML][\dA-Fa-f]{32}\b|\b0xH[\dA-Fa-f]{4}\b/,
      punctuation: /[{}[\];(),.!*=<>]/
    };
  }
};
var log_default = {
  language: "log",
  init: (Prism2) => {
    Prism2.languages.log = {
      string: {
        pattern: /"(?:[^"\\\r\n]|\\.)*"|'(?![st] | \w)(?:[^'\\\r\n]|\\.)*'/,
        greedy: true
      },
      exception: {
        pattern: /(^|[^\w.])[a-z][\w.]*(?:Error|Exception):.*(?:(?:\r\n?|\n)[ \t]*(?:at[ \t].+|\.{3}.*|Caused by:.*))+(?:(?:\r\n?|\n)[ \t]*\.\.\. .*)?/,
        lookbehind: true,
        greedy: true,
        alias: ["javastacktrace", "language-javastacktrace"],
        inside: Prism2.languages["javastacktrace"] || {
          keyword: /\bat\b/,
          function: /[a-z_][\w$]*(?=\()/,
          punctuation: /[.:()]/
        }
      },
      level: [
        {
          pattern: /\b(?:ALERT|CRIT|CRITICAL|EMERG|EMERGENCY|ERR|ERROR|FAILURE|FATAL|SEVERE)\b/,
          alias: ["error", "important"]
        },
        {
          pattern: /\b(?:WARN|WARNING|WRN)\b/,
          alias: ["warning", "important"]
        },
        {
          pattern: /\b(?:DISPLAY|INF|INFO|NOTICE|STATUS)\b/,
          alias: ["info", "keyword"]
        },
        {
          pattern: /\b(?:DBG|DEBUG|FINE)\b/,
          alias: ["debug", "keyword"]
        },
        {
          pattern: /\b(?:FINER|FINEST|TRACE|TRC|VERBOSE|VRB)\b/,
          alias: ["trace", "comment"]
        }
      ],
      property: {
        pattern: /((?:^|[\]|])[ \t]*)[a-z_](?:[\w-]|\b\/\b)*(?:[. ]\(?\w(?:[\w-]|\b\/\b)*\)?)*:(?=\s)/im,
        lookbehind: true
      },
      separator: {
        pattern: /(^|[^-+])-{3,}|={3,}|\*{3,}|- - /m,
        lookbehind: true,
        alias: "comment"
      },
      url: /\b(?:file|ftp|https?):\/\/[^\s|,;'"]*[^\s|,;'">.]/,
      email: {
        pattern: /(^|\s)[-\w+.]+@[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+(?=\s)/,
        lookbehind: true,
        alias: "url"
      },
      "ip-address": {
        pattern: /\b(?:\d{1,3}(?:\.\d{1,3}){3})\b/,
        alias: "constant"
      },
      "mac-address": {
        pattern: /\b[a-f0-9]{2}(?::[a-f0-9]{2}){5}\b/i,
        alias: "constant"
      },
      domain: {
        pattern: /(^|\s)[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*\.[a-z][a-z0-9-]+(?=\s)/,
        lookbehind: true,
        alias: "constant"
      },
      uuid: {
        pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
        alias: "constant"
      },
      hash: {
        pattern: /\b(?:[a-f0-9]{32}){1,2}\b/i,
        alias: "constant"
      },
      "file-path": {
        pattern: /\b[a-z]:[\\/][^\s|,;:(){}\[\]"']+|(^|[\s:\[\](>|])\.{0,2}\/\w[^\s|,;:(){}\[\]"']*/i,
        lookbehind: true,
        greedy: true,
        alias: "string"
      },
      date: {
        pattern: RegExp(/\b\d{4}[-/]\d{2}[-/]\d{2}(?:T(?=\d{1,2}:)|(?=\s\d{1,2}:))/.source + "|" + /\b\d{1,4}[-/ ](?:\d{1,2}|Apr|Aug|Dec|Feb|Jan|Jul|Jun|Mar|May|Nov|Oct|Sep)[-/ ]\d{2,4}T?\b/.source + "|" + /\b(?:(?:Fri|Mon|Sat|Sun|Thu|Tue|Wed)(?:\s{1,2}(?:Apr|Aug|Dec|Feb|Jan|Jul|Jun|Mar|May|Nov|Oct|Sep))?|Apr|Aug|Dec|Feb|Jan|Jul|Jun|Mar|May|Nov|Oct|Sep)\s{1,2}\d{1,2}\b/.source, "i"),
        alias: "number"
      },
      time: {
        pattern: /\b\d{1,2}:\d{1,2}:\d{1,2}(?:[.,:]\d+)?(?:\s?[+-]\d{2}:?\d{2}|Z)?\b/,
        alias: "number"
      },
      boolean: /\b(?:false|null|true)\b/i,
      number: {
        pattern: /(^|[^.\w])(?:0x[a-f0-9]+|0o[0-7]+|0b[01]+|v?\d[\da-f]*(?:\.\d+)*(?:e[+-]?\d+)?[a-z]{0,3}\b)\b(?!\.\w)/i,
        lookbehind: true
      },
      operator: /[;:?<=>~/@!$%&+\-|^(){}*#]/,
      punctuation: /[\[\].,]/
    };
  }
};
var openqasm_default = {
  language: "openqasm",
  init: (Prism2) => {
    Prism2.languages.openqasm = {
      comment: /\/\*[\s\S]*?\*\/|\/\/.*/,
      string: {
        pattern: /"[^"\r\n\t]*"|'[^'\r\n\t]*'/,
        greedy: true
      },
      keyword: /\b(?:CX|OPENQASM|U|barrier|boxas|boxto|break|const|continue|ctrl|def|defcal|defcalgrammar|delay|else|end|for|gate|gphase|if|in|include|inv|kernel|lengthof|let|measure|pow|reset|return|rotary|stretchinf|while)\b|#pragma\b/,
      "class-name": /\b(?:angle|bit|bool|creg|fixed|float|int|length|qreg|qubit|stretch|uint)\b/,
      function: /\b(?:cos|exp|ln|popcount|rotl|rotr|sin|sqrt|tan)\b(?=\s*\()/,
      constant: /\b(?:euler|pi|tau)\b|\u03C0|\uD835\uDF0F|\u2107/,
      number: {
        pattern: /(^|[^.\w$])(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?(?:dt|ns|us|\u00B5s|ms|s)?/i,
        lookbehind: true
      },
      operator: /->|>>=?|<<=?|&&|\|\||\+\+|--|[!=<>&|~^+\-*/%]=?|@/,
      punctuation: /[(){}\[\];,:.]/
    };
    Prism2.languages.qasm = Prism2.languages.openqasm;
  }
};
var plant_uml_default = {
  language: "plant-uml",
  init: (Prism2) => {
    var variable = /\$\w+|%[a-z]+%/;
    var arrowAttr = /\[[^[\]]*\]/.source;
    var arrowDirection = /(?:[drlu]|do|down|le|left|ri|right|up)/.source;
    var arrowBody = "(?:-+" + arrowDirection + "-+|\\.+" + arrowDirection + "\\.+|-+(?:" + arrowAttr + "-*)?|" + arrowAttr + "-+|\\.+(?:" + arrowAttr + "\\.*)?|" + arrowAttr + "\\.+)";
    var arrowLeft = /(?:<{1,2}|\/{1,2}|\\{1,2}|<\||[#*^+}xo])/.source;
    var arrowRight = /(?:>{1,2}|\/{1,2}|\\{1,2}|\|>|[#*^+{xo])/.source;
    var arrowPrefix = /[[?]?[ox]?/.source;
    var arrowSuffix = /[ox]?[\]?]?/.source;
    var arrow = arrowPrefix + "(?:" + arrowBody + arrowRight + "|" + arrowLeft + arrowBody + "(?:" + arrowRight + ")?)" + arrowSuffix;
    Prism2.languages["plant-uml"] = {
      comment: {
        pattern: /(^[ \t]*)(?:'.*|\/'[\s\S]*?'\/)/m,
        lookbehind: true,
        greedy: true
      },
      preprocessor: {
        pattern: /(^[ \t]*)!.*/m,
        lookbehind: true,
        greedy: true,
        alias: "property",
        inside: {
          variable
        }
      },
      delimiter: {
        pattern: /(^[ \t]*)@(?:end|start)uml\b/m,
        lookbehind: true,
        greedy: true,
        alias: "punctuation"
      },
      arrow: {
        pattern: RegExp(/(^|[^-.<>?|\\[\]ox])/.source + arrow + /(?![-.<>?|\\\]ox])/.source),
        lookbehind: true,
        greedy: true,
        alias: "operator",
        inside: {
          expression: {
            pattern: /(\[)[^[\]]+(?=\])/,
            lookbehind: true,
            inside: null
          },
          punctuation: /\[(?=$|\])|^\]/
        }
      },
      string: {
        pattern: /"[^"]*"/,
        greedy: true
      },
      text: {
        pattern: /(\[[ \t]*[\r\n]+(?![\r\n]))[^\]]*(?=\])/,
        lookbehind: true,
        greedy: true,
        alias: "string"
      },
      keyword: [
        {
          pattern: /^([ \t]*)(?:abstract\s+class|end\s+(?:box|fork|group|merge|note|ref|split|title)|(?:fork|split)(?:\s+again)?|activate|actor|agent|alt|annotation|artifact|autoactivate|autonumber|backward|binary|boundary|box|break|caption|card|case|circle|class|clock|cloud|collections|component|concise|control|create|critical|database|deactivate|destroy|detach|diamond|else|elseif|end|end[hr]note|endif|endswitch|endwhile|entity|enum|file|folder|footer|frame|group|[hr]?note|header|hexagon|hide|if|interface|label|legend|loop|map|namespace|network|newpage|node|nwdiag|object|opt|package|page|par|participant|person|queue|rectangle|ref|remove|repeat|restore|return|robust|scale|set|show|skinparam|stack|start|state|stop|storage|switch|title|together|usecase|usecase\/|while)(?=\s|$)/m,
          lookbehind: true,
          greedy: true
        },
        /\b(?:elseif|equals|not|while)(?=\s*\()/,
        /\b(?:as|is|then)\b/
      ],
      divider: {
        pattern: /^==.+==$/m,
        greedy: true,
        alias: "important"
      },
      time: {
        pattern: /@(?:\d+(?:[:/]\d+){2}|[+-]?\d+|:[a-z]\w*(?:[+-]\d+)?)\b/i,
        greedy: true,
        alias: "number"
      },
      color: {
        pattern: /#(?:[a-z_]+|[a-fA-F0-9]+)\b/,
        alias: "symbol"
      },
      variable,
      punctuation: /[:,;()[\]{}]|\.{3}/
    };
    Prism2.languages["plant-uml"].arrow.inside.expression.inside = Prism2.languages["plant-uml"];
    Prism2.languages["plantuml"] = Prism2.languages["plant-uml"];
  }
};
var powerquery_default = {
  language: "powerquery",
  init: (Prism2) => {
    Prism2.languages.powerquery = {
      comment: {
        pattern: /(^|[^\\])(?:\/\*[\s\S]*?\*\/|\/\/.*)/,
        lookbehind: true,
        greedy: true
      },
      "quoted-identifier": {
        pattern: /#"(?:[^"\r\n]|"")*"(?!")/,
        greedy: true
      },
      string: {
        pattern: /(?:#!)?"(?:[^"\r\n]|"")*"(?!")/,
        greedy: true
      },
      constant: [
        /\bDay\.(?:Friday|Monday|Saturday|Sunday|Thursday|Tuesday|Wednesday)\b/,
        /\bTraceLevel\.(?:Critical|Error|Information|Verbose|Warning)\b/,
        /\bOccurrence\.(?:All|First|Last)\b/,
        /\bOrder\.(?:Ascending|Descending)\b/,
        /\bRoundingMode\.(?:AwayFromZero|Down|ToEven|TowardZero|Up)\b/,
        /\bMissingField\.(?:Error|Ignore|UseNull)\b/,
        /\bQuoteStyle\.(?:Csv|None)\b/,
        /\bJoinKind\.(?:FullOuter|Inner|LeftAnti|LeftOuter|RightAnti|RightOuter)\b/,
        /\bGroupKind\.(?:Global|Local)\b/,
        /\bExtraValues\.(?:Error|Ignore|List)\b/,
        /\bJoinAlgorithm\.(?:Dynamic|LeftHash|LeftIndex|PairwiseHash|RightHash|RightIndex|SortMerge)\b/,
        /\bJoinSide\.(?:Left|Right)\b/,
        /\bPrecision\.(?:Decimal|Double)\b/,
        /\bRelativePosition\.From(?:End|Start)\b/,
        /\bTextEncoding\.(?:Ascii|BigEndianUnicode|Unicode|Utf16|Utf8|Windows)\b/,
        /\b(?:Any|Binary|Date|DateTime|DateTimeZone|Duration|Function|Int16|Int32|Int64|Int8|List|Logical|None|Number|Record|Table|Text|Time)\.Type\b/,
        /\bnull\b/
      ],
      boolean: /\b(?:false|true)\b/,
      keyword: /\b(?:and|as|each|else|error|if|in|is|let|meta|not|nullable|optional|or|otherwise|section|shared|then|try|type)\b|#(?:binary|date|datetime|datetimezone|duration|infinity|nan|sections|shared|table|time)\b/,
      function: {
        pattern: /(^|[^#\w.])[a-z_][\w.]*(?=\s*\()/i,
        lookbehind: true
      },
      "data-type": {
        pattern: /\b(?:any|anynonnull|binary|date|datetime|datetimezone|duration|function|list|logical|none|number|record|table|text|time)\b/,
        alias: "class-name"
      },
      number: {
        pattern: /\b0x[\da-f]+\b|(?:[+-]?(?:\b\d+\.)?\b\d+|[+-]\.\d+|(^|[^.])\B\.\d+)(?:e[+-]?\d+)?\b/i,
        lookbehind: true
      },
      operator: /[-+*\/&?@^]|<(?:=>?|>)?|>=?|=>?|\.\.\.?/,
      punctuation: /[,;\[\](){}]/
    };
    Prism2.languages.pq = Prism2.languages["powerquery"];
    Prism2.languages.mscript = Prism2.languages["powerquery"];
  }
};
var purescript_default = {
  language: "purescript",
  init: (Prism2) => {
    Prism2.languages.purescript = Prism2.languages.extend("haskell", {
      keyword: /\b(?:ado|case|class|data|derive|do|else|forall|if|in|infixl|infixr|instance|let|module|newtype|of|primitive|then|type|where)\b|\u2200/,
      "import-statement": {
        pattern: /(^[\t ]*)import\s+[A-Z][\w']*(?:\.[A-Z][\w']*)*(?:\s+as\s+[A-Z][\w']*(?:\.[A-Z][\w']*)*)?(?:\s+hiding\b)?/m,
        lookbehind: true,
        inside: {
          keyword: /\b(?:as|hiding|import)\b/,
          punctuation: /\./
        }
      },
      builtin: /\b(?:absurd|add|ap|append|apply|between|bind|bottom|clamp|compare|comparing|compose|conj|const|degree|discard|disj|div|eq|flap|flip|gcd|identity|ifM|join|lcm|liftA1|liftM1|map|max|mempty|min|mod|mul|negate|not|notEq|one|otherwise|recip|show|sub|top|unit|unless|unlessM|void|when|whenM|zero)\b/,
      operator: [
        { pattern: /`(?:[A-Z][\w']*\.)*[_a-z][\w']*`/, greedy: true },
        /[-!#$%*+=?&@|~:<>^\\\/][-!#$%*+=?&@|~.:<>^\\\/]*|\.[-!#$%*+=?&@|~.:<>^\\\/]+/,
        /[\xa2-\xa6\xa8\xa9\xac\xae-\xb1\xb4\xb8\xd7\xf7\u02c2-\u02c5\u02d2-\u02df\u02e5-\u02eb\u02ed\u02ef-\u02ff\u0375\u0384\u0385\u03f6\u0482\u058d-\u058f\u0606-\u0608\u060b\u060e\u060f\u06de\u06e9\u06fd\u06fe\u07f6\u07fe\u07ff\u09f2\u09f3\u09fa\u09fb\u0af1\u0b70\u0bf3-\u0bfa\u0c7f\u0d4f\u0d79\u0e3f\u0f01-\u0f03\u0f13\u0f15-\u0f17\u0f1a-\u0f1f\u0f34\u0f36\u0f38\u0fbe-\u0fc5\u0fc7-\u0fcc\u0fce\u0fcf\u0fd5-\u0fd8\u109e\u109f\u1390-\u1399\u166d\u17db\u1940\u19de-\u19ff\u1b61-\u1b6a\u1b74-\u1b7c\u1fbd\u1fbf-\u1fc1\u1fcd-\u1fcf\u1fdd-\u1fdf\u1fed-\u1fef\u1ffd\u1ffe\u2044\u2052\u207a-\u207c\u208a-\u208c\u20a0-\u20bf\u2100\u2101\u2103-\u2106\u2108\u2109\u2114\u2116-\u2118\u211e-\u2123\u2125\u2127\u2129\u212e\u213a\u213b\u2140-\u2144\u214a-\u214d\u214f\u218a\u218b\u2190-\u2307\u230c-\u2328\u232b-\u2426\u2440-\u244a\u249c-\u24e9\u2500-\u2767\u2794-\u27c4\u27c7-\u27e5\u27f0-\u2982\u2999-\u29d7\u29dc-\u29fb\u29fe-\u2b73\u2b76-\u2b95\u2b97-\u2bff\u2ce5-\u2cea\u2e50\u2e51\u2e80-\u2e99\u2e9b-\u2ef3\u2f00-\u2fd5\u2ff0-\u2ffb\u3004\u3012\u3013\u3020\u3036\u3037\u303e\u303f\u309b\u309c\u3190\u3191\u3196-\u319f\u31c0-\u31e3\u3200-\u321e\u322a-\u3247\u3250\u3260-\u327f\u328a-\u32b0\u32c0-\u33ff\u4dc0-\u4dff\ua490-\ua4c6\ua700-\ua716\ua720\ua721\ua789\ua78a\ua828-\ua82b\ua836-\ua839\uaa77-\uaa79\uab5b\uab6a\uab6b\ufb29\ufbb2-\ufbc1\ufdfc\ufdfd\ufe62\ufe64-\ufe66\ufe69\uff04\uff0b\uff1c-\uff1e\uff3e\uff40\uff5c\uff5e\uffe0-\uffe6\uffe8-\uffee\ufffc\ufffd]/
      ]
    });
    Prism2.languages.purs = Prism2.languages.purescript;
  }
};
var qsharp_default = {
  language: "qsharp",
  init: (Prism2) => {
    (function(Prism3) {
      function replace(pattern, replacements) {
        return pattern.replace(/<<(\d+)>>/g, function(m, index) {
          return "(?:" + replacements[+index] + ")";
        });
      }
      function re(pattern, replacements, flags) {
        return RegExp(replace(pattern, replacements), flags || "");
      }
      function nested(pattern, depthLog2) {
        for (var i = 0;i < depthLog2; i++) {
          pattern = pattern.replace(/<<self>>/g, function() {
            return "(?:" + pattern + ")";
          });
        }
        return pattern.replace(/<<self>>/g, "[^\\s\\S]");
      }
      var keywordKinds = {
        type: "Adj BigInt Bool Ctl Double false Int One Pauli PauliI PauliX PauliY PauliZ Qubit Range Result String true Unit Zero",
        other: "Adjoint adjoint apply as auto body borrow borrowing Controlled controlled distribute elif else fail fixup for function if in internal intrinsic invert is let mutable namespace new newtype open operation repeat return self set until use using while within"
      };
      function keywordsToPattern(words) {
        return "\\b(?:" + words.trim().replace(/ /g, "|") + ")\\b";
      }
      var keywords = RegExp(keywordsToPattern(keywordKinds.type + " " + keywordKinds.other));
      var identifier = /\b[A-Za-z_]\w*\b/.source;
      var qualifiedName = replace(/<<0>>(?:\s*\.\s*<<0>>)*/.source, [identifier]);
      var typeInside = {
        keyword: keywords,
        punctuation: /[<>()?,.:[\]]/
      };
      var regularString = /"(?:\\.|[^\\"])*"/.source;
      Prism3.languages.qsharp = Prism3.languages.extend("clike", {
        comment: /\/\/.*/,
        string: [
          {
            pattern: re(/(^|[^$\\])<<0>>/.source, [regularString]),
            lookbehind: true,
            greedy: true
          }
        ],
        "class-name": [
          {
            pattern: re(/(\b(?:as|open)\s+)<<0>>(?=\s*(?:;|as\b))/.source, [qualifiedName]),
            lookbehind: true,
            inside: typeInside
          },
          {
            pattern: re(/(\bnamespace\s+)<<0>>(?=\s*\{)/.source, [qualifiedName]),
            lookbehind: true,
            inside: typeInside
          }
        ],
        keyword: keywords,
        number: /(?:\b0(?:x[\da-f]+|b[01]+|o[0-7]+)|(?:\B\.\d+|\b\d+(?:\.\d*)?)(?:e[-+]?\d+)?)l?\b/i,
        operator: /\band=|\bor=|\band\b|\bnot\b|\bor\b|<[-=]|[-=]>|>>>=?|<<<=?|\^\^\^=?|\|\|\|=?|&&&=?|w\/=?|~~~|[*\/+\-^=!%]=?/,
        punctuation: /::|[{}[\];(),.:]/
      });
      Prism3.languages.insertBefore("qsharp", "number", {
        range: {
          pattern: /\.\./,
          alias: "operator"
        }
      });
      var interpolationExpr = nested(replace(/\{(?:[^"{}]|<<0>>|<<self>>)*\}/.source, [regularString]), 2);
      Prism3.languages.insertBefore("qsharp", "string", {
        "interpolation-string": {
          pattern: re(/\$"(?:\\.|<<0>>|[^\\"{])*"/.source, [interpolationExpr]),
          greedy: true,
          inside: {
            interpolation: {
              pattern: re(/((?:^|[^\\])(?:\\\\)*)<<0>>/.source, [interpolationExpr]),
              lookbehind: true,
              inside: {
                punctuation: /^\{|\}$/,
                expression: {
                  pattern: /[\s\S]+/,
                  alias: "language-qsharp",
                  inside: Prism3.languages.qsharp
                }
              }
            },
            string: /[\s\S]+/
          }
        }
      });
    })(Prism2);
    Prism2.languages.qs = Prism2.languages.qsharp;
  }
};
var racket_default = {
  language: "racket",
  init: (Prism2) => {
    Prism2.languages.racket = Prism2.languages.extend("scheme", {
      "lambda-parameter": {
        pattern: /([(\[]lambda\s+[(\[])[^()\[\]'\s]+/,
        lookbehind: true
      }
    });
    Prism2.languages.insertBefore("racket", "string", {
      lang: {
        pattern: /^#lang.+/m,
        greedy: true,
        alias: "keyword"
      }
    });
    Prism2.languages.rkt = Prism2.languages.racket;
  }
};
var regex_default = {
  language: "regex",
  init: (Prism2) => {
    var specialEscape = {
      pattern: /\\[\\(){}[\]^$+*?|.]/,
      alias: "escape"
    };
    var escape = /\\(?:x[\da-fA-F]{2}|u[\da-fA-F]{4}|u\{[\da-fA-F]+\}|0[0-7]{0,2}|[123][0-7]{2}|c[a-zA-Z]|.)/;
    var charSet = {
      pattern: /\.|\\[wsd]|\\p\{[^{}]+\}/i,
      alias: "class-name"
    };
    var charSetWithoutDot = {
      pattern: /\\[wsd]|\\p\{[^{}]+\}/i,
      alias: "class-name"
    };
    var rangeChar = "(?:[^\\\\-]|" + escape.source + ")";
    var range = RegExp(rangeChar + "-" + rangeChar);
    var groupName = {
      pattern: /(<|')[^<>']+(?=[>']$)/,
      lookbehind: true,
      alias: "variable"
    };
    Prism2.languages.regex = {
      "char-class": {
        pattern: /((?:^|[^\\])(?:\\\\)*)\[(?:[^\\\]]|\\[\s\S])*\]/,
        lookbehind: true,
        inside: {
          "char-class-negation": {
            pattern: /(^\[)\^/,
            lookbehind: true,
            alias: "operator"
          },
          "char-class-punctuation": {
            pattern: /^\[|\]$/,
            alias: "punctuation"
          },
          range: {
            pattern: range,
            inside: {
              escape,
              "range-punctuation": {
                pattern: /-/,
                alias: "operator"
              }
            }
          },
          "special-escape": specialEscape,
          "char-set": charSetWithoutDot,
          escape
        }
      },
      "special-escape": specialEscape,
      "char-set": charSet,
      backreference: [
        {
          pattern: /\\(?![123][0-7]{2})[1-9]/,
          alias: "keyword"
        },
        {
          pattern: /\\k<[^<>']+>/,
          alias: "keyword",
          inside: {
            "group-name": groupName
          }
        }
      ],
      anchor: {
        pattern: /[$^]|\\[ABbGZz]/,
        alias: "function"
      },
      escape,
      group: [
        {
          pattern: /\((?:\?(?:<[^<>']+>|'[^<>']+'|[>:]|<?[=!]|[idmnsuxU]+(?:-[idmnsuxU]+)?:?))?/,
          alias: "punctuation",
          inside: {
            "group-name": groupName
          }
        },
        {
          pattern: /\)/,
          alias: "punctuation"
        }
      ],
      quantifier: {
        pattern: /(?:[+*?]|\{\d+(?:,\d*)?\})[?+]?/,
        alias: "number"
      },
      alternation: {
        pattern: /\|/,
        alias: "keyword"
      }
    };
  }
};
var rescript_default = {
  language: "rescript",
  init: (Prism2) => {
    Prism2.languages.rescript = {
      comment: {
        pattern: /\/\/.*|\/\*[\s\S]*?(?:\*\/|$)/,
        greedy: true
      },
      char: { pattern: /'(?:[^\r\n\\]|\\(?:.|\w+))'/, greedy: true },
      string: {
        pattern: /"(?:\\(?:\r\n|[\s\S])|[^\\\r\n"])*"/,
        greedy: true
      },
      "class-name": /\b[A-Z]\w*|@[a-z.]*|#[A-Za-z]\w*|#\d/,
      function: {
        pattern: /[a-zA-Z]\w*(?=\()|(\.)[a-z]\w*/,
        lookbehind: true
      },
      number: /(?:\b0x(?:[\da-f]+(?:\.[\da-f]*)?|\.[\da-f]+)(?:p[+-]?\d+)?|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?)[ful]{0,4}/i,
      boolean: /\b(?:false|true)\b/,
      "attr-value": /[A-Za-z]\w*(?==)/,
      constant: {
        pattern: /(\btype\s+)[a-z]\w*/,
        lookbehind: true
      },
      tag: {
        pattern: /(<)[a-z]\w*|(?:<\/)[a-z]\w*/,
        lookbehind: true,
        inside: {
          operator: /<|>|\//
        }
      },
      keyword: /\b(?:and|as|assert|begin|bool|class|constraint|do|done|downto|else|end|exception|external|float|for|fun|function|if|in|include|inherit|initializer|int|lazy|let|method|module|mutable|new|nonrec|object|of|open|or|private|rec|string|switch|then|to|try|type|when|while|with)\b/,
      operator: /\.{3}|:[:=]?|\|>|->|=(?:==?|>)?|<=?|>=?|[|^?'#!~`]|[+\-*\/]\.?|\b(?:asr|land|lor|lsl|lsr|lxor|mod)\b/,
      punctuation: /[(){}[\],;.]/
    };
    Prism2.languages.insertBefore("rescript", "string", {
      "template-string": {
        pattern: /`(?:\\[\s\S]|\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}|(?!\$\{)[^\\`])*`/,
        greedy: true,
        inside: {
          "template-punctuation": {
            pattern: /^`|`$/,
            alias: "string"
          },
          interpolation: {
            pattern: /((?:^|[^\\])(?:\\{2})*)\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}/,
            lookbehind: true,
            inside: {
              "interpolation-punctuation": {
                pattern: /^\$\{|\}$/,
                alias: "tag"
              },
              rest: Prism2.languages.rescript
            }
          },
          string: /[\s\S]+/
        }
      }
    });
    Prism2.languages.res = Prism2.languages.rescript;
  }
};
var robotframework_default = {
  language: "robotframework",
  init: (Prism2) => {
    var comment = {
      pattern: /(^[ \t]*| {2}|\t)#.*/m,
      lookbehind: true,
      greedy: true
    };
    var variable = {
      pattern: /((?:^|[^\\])(?:\\{2})*)[$@&%]\{(?:[^{}\r\n]|\{[^{}\r\n]*\})*\}/,
      lookbehind: true,
      inside: {
        punctuation: /^[$@&%]\{|\}$/
      }
    };
    function createSection(name, inside) {
      var extendecInside = {};
      extendecInside["section-header"] = {
        pattern: /^ ?\*{3}.+?\*{3}/,
        alias: "keyword"
      };
      for (var token in inside) {
        extendecInside[token] = inside[token];
      }
      extendecInside["tag"] = {
        pattern: /([\r\n](?: {2}|\t)[ \t]*)\[[-\w]+\]/,
        lookbehind: true,
        inside: {
          punctuation: /\[|\]/
        }
      };
      extendecInside["variable"] = variable;
      extendecInside["comment"] = comment;
      return {
        pattern: RegExp(/^ ?\*{3}[ \t]*<name>[ \t]*\*{3}(?:.|[\r\n](?!\*{3}))*/.source.replace(/<name>/g, function() {
          return name;
        }), "im"),
        alias: "section",
        inside: extendecInside
      };
    }
    var docTag = {
      pattern: /(\[Documentation\](?: {2}|\t)[ \t]*)(?![ \t]|#)(?:.|(?:\r\n?|\n)[ \t]*\.{3})+/,
      lookbehind: true,
      alias: "string"
    };
    var testNameLike = {
      pattern: /([\r\n] ?)(?!#)(?:\S(?:[ \t]\S)*)+/,
      lookbehind: true,
      alias: "function",
      inside: {
        variable
      }
    };
    var testPropertyLike = {
      pattern: /([\r\n](?: {2}|\t)[ \t]*)(?!\[|\.{3}|#)(?:\S(?:[ \t]\S)*)+/,
      lookbehind: true,
      inside: {
        variable
      }
    };
    Prism2.languages["robotframework"] = {
      settings: createSection("Settings", {
        documentation: {
          pattern: /([\r\n] ?Documentation(?: {2}|\t)[ \t]*)(?![ \t]|#)(?:.|(?:\r\n?|\n)[ \t]*\.{3})+/,
          lookbehind: true,
          alias: "string"
        },
        property: {
          pattern: /([\r\n] ?)(?!\.{3}|#)(?:\S(?:[ \t]\S)*)+/,
          lookbehind: true
        }
      }),
      variables: createSection("Variables"),
      "test-cases": createSection("Test Cases", {
        "test-name": testNameLike,
        documentation: docTag,
        property: testPropertyLike
      }),
      keywords: createSection("Keywords", {
        "keyword-name": testNameLike,
        documentation: docTag,
        property: testPropertyLike
      }),
      tasks: createSection("Tasks", {
        "task-name": testNameLike,
        documentation: docTag,
        property: testPropertyLike
      }),
      comment
    };
    Prism2.languages.robot = Prism2.languages["robotframework"];
  }
};
var solidity_default = {
  language: "solidity",
  init: (Prism2) => {
    Prism2.languages.solidity = Prism2.languages.extend("clike", {
      "class-name": {
        pattern: /(\b(?:contract|enum|interface|library|new|struct|using)\s+)(?!\d)[\w$]+/,
        lookbehind: true
      },
      keyword: /\b(?:_|anonymous|as|assembly|assert|break|calldata|case|constant|constructor|continue|contract|default|delete|do|else|emit|enum|event|external|for|from|function|if|import|indexed|inherited|interface|internal|is|let|library|mapping|memory|modifier|new|payable|pragma|private|public|pure|require|returns?|revert|selfdestruct|solidity|storage|struct|suicide|switch|this|throw|using|var|view|while)\b/,
      operator: /=>|->|:=|=:|\*\*|\+\+|--|\|\||&&|<<=?|>>=?|[-+*/%^&|<>!=]=?|[~?]/
    });
    Prism2.languages.insertBefore("solidity", "keyword", {
      builtin: /\b(?:address|bool|byte|u?int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?|string|bytes(?:[1-9]|[12]\d|3[0-2])?)\b/
    });
    Prism2.languages.insertBefore("solidity", "number", {
      version: {
        pattern: /([<>]=?|\^)\d+\.\d+\.\d+\b/,
        lookbehind: true,
        alias: "number"
      }
    });
    Prism2.languages.sol = Prism2.languages.solidity;
  }
};
var sparql_default = {
  language: "sparql",
  init: (Prism2) => {
    Prism2.languages.sparql = Prism2.languages.extend("turtle", {
      boolean: /\b(?:false|true)\b/i,
      variable: {
        pattern: /[?$]\w+/,
        greedy: true
      }
    });
    Prism2.languages.insertBefore("sparql", "punctuation", {
      keyword: [
        /\b(?:A|ADD|ALL|AS|ASC|ASK|BNODE|BY|CLEAR|CONSTRUCT|COPY|CREATE|DATA|DEFAULT|DELETE|DESC|DESCRIBE|DISTINCT|DROP|EXISTS|FILTER|FROM|GROUP|HAVING|INSERT|INTO|LIMIT|LOAD|MINUS|MOVE|NAMED|NOT|NOW|OFFSET|OPTIONAL|ORDER|RAND|REDUCED|SELECT|SEPARATOR|SERVICE|SILENT|STRUUID|UNION|USING|UUID|VALUES|WHERE)\b/i,
        /\b(?:ABS|AVG|BIND|BOUND|CEIL|COALESCE|CONCAT|CONTAINS|COUNT|DATATYPE|DAY|ENCODE_FOR_URI|FLOOR|GROUP_CONCAT|HOURS|IF|IRI|isBLANK|isIRI|isLITERAL|isNUMERIC|isURI|LANG|LANGMATCHES|LCASE|MAX|MD5|MIN|MINUTES|MONTH|REGEX|REPLACE|ROUND|sameTerm|SAMPLE|SECONDS|SHA1|SHA256|SHA384|SHA512|STR|STRAFTER|STRBEFORE|STRDT|STRENDS|STRLANG|STRLEN|STRSTARTS|SUBSTR|SUM|TIMEZONE|TZ|UCASE|URI|YEAR)\b(?=\s*\()/i,
        /\b(?:BASE|GRAPH|PREFIX)\b/i
      ]
    });
    Prism2.languages.rq = Prism2.languages.sparql;
  }
};
var tap_default = {
  language: "tap",
  init: (Prism2) => {
    Prism2.languages.tap = {
      fail: /not ok[^#{\n\r]*/,
      pass: /ok[^#{\n\r]*/,
      pragma: /pragma [+-][a-z]+/,
      bailout: /bail out!.*/i,
      version: /TAP version \d+/i,
      plan: /\b\d+\.\.\d+(?: +#.*)?/,
      subtest: {
        pattern: /# Subtest(?:: .*)?/,
        greedy: true
      },
      punctuation: /[{}]/,
      directive: /#.*/,
      yamlish: {
        pattern: /(^[ \t]*)---[\s\S]*?[\r\n][ \t]*\.\.\.$/m,
        lookbehind: true,
        inside: Prism2.languages.yaml,
        alias: "language-yaml"
      }
    };
  }
};
var toml_default = {
  language: "toml",
  init: (Prism2) => {
    var key = /(?:[\w-]+|'[^'\n\r]*'|"(?:\\.|[^\\"\r\n])*")/.source;
    function insertKey(pattern) {
      return pattern.replace(/__/g, function() {
        return key;
      });
    }
    Prism2.languages.toml = {
      comment: {
        pattern: /#.*/,
        greedy: true
      },
      table: {
        pattern: RegExp(insertKey(/(^[\t ]*\[\s*(?:\[\s*)?)__(?:\s*\.\s*__)*(?=\s*\])/.source), "m"),
        lookbehind: true,
        greedy: true,
        alias: "class-name"
      },
      key: {
        pattern: RegExp(insertKey(/(^[\t ]*|[{,]\s*)__(?:\s*\.\s*__)*(?=\s*=)/.source), "m"),
        lookbehind: true,
        greedy: true,
        alias: "property"
      },
      string: {
        pattern: /"""(?:\\[\s\S]|[^\\])*?"""|'''[\s\S]*?'''|'[^'\n\r]*'|"(?:\\.|[^\\"\r\n])*"/,
        greedy: true
      },
      date: [
        {
          pattern: /\b\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?\b/i,
          alias: "number"
        },
        {
          pattern: /\b\d{2}:\d{2}:\d{2}(?:\.\d+)?\b/,
          alias: "number"
        }
      ],
      number: /(?:\b0(?:x[\da-zA-Z]+(?:_[\da-zA-Z]+)*|o[0-7]+(?:_[0-7]+)*|b[10]+(?:_[10]+)*))\b|[-+]?\b\d+(?:_\d+)*(?:\.\d+(?:_\d+)*)?(?:[eE][+-]?\d+(?:_\d+)*)?\b|[-+]?\b(?:inf|nan)\b/,
      boolean: /\b(?:false|true)\b/,
      punctuation: /[.,=[\]{}]/
    };
  }
};
var tt2_default = {
  language: "tt2",
  init: (Prism2) => {
    Prism2.languages.tt2 = Prism2.languages.extend("clike", {
      comment: /#.*|\[%#[\s\S]*?%\]/,
      keyword: /\b(?:BLOCK|CALL|CASE|CATCH|CLEAR|DEBUG|DEFAULT|ELSE|ELSIF|END|FILTER|FINAL|FOREACH|GET|IF|IN|INCLUDE|INSERT|LAST|MACRO|META|NEXT|PERL|PROCESS|RAWPERL|RETURN|SET|STOP|SWITCH|TAGS|THROW|TRY|UNLESS|USE|WHILE|WRAPPER)\b/,
      punctuation: /[[\]{},()]/
    });
    Prism2.languages.insertBefore("tt2", "number", {
      operator: /=[>=]?|!=?|<=?|>=?|&&|\|\|?|\b(?:and|not|or)\b/,
      variable: {
        pattern: /\b[a-z]\w*(?:\s*\.\s*(?:\d+|\$?[a-z]\w*))*\b/i
      }
    });
    Prism2.languages.insertBefore("tt2", "keyword", {
      delimiter: {
        pattern: /^(?:\[%|%%)-?|-?%\]$/,
        alias: "punctuation"
      }
    });
    Prism2.languages.insertBefore("tt2", "string", {
      "single-quoted-string": {
        pattern: /'[^\\']*(?:\\[\s\S][^\\']*)*'/,
        greedy: true,
        alias: "string"
      },
      "double-quoted-string": {
        pattern: /"[^\\"]*(?:\\[\s\S][^\\"]*)*"/,
        greedy: true,
        alias: "string",
        inside: {
          variable: {
            pattern: /\$(?:[a-z]\w*(?:\.(?:\d+|\$?[a-z]\w*))*)/i
          }
        }
      }
    });
    delete Prism2.languages.tt2.string;
    Prism2.hooks.add("before-tokenize", function(env) {
      var tt2Pattern = /\[%[\s\S]+?%\]/g;
      Prism2.languages["markup-templating"].buildPlaceholders(env, "tt2", tt2Pattern);
    });
    Prism2.hooks.add("after-tokenize", function(env) {
      Prism2.languages["markup-templating"].tokenizePlaceholders(env, "tt2");
    });
  }
};
var turtle_default = {
  language: "turtle",
  init: (Prism2) => {
    Prism2.languages.turtle = {
      comment: {
        pattern: /#.*/,
        greedy: true
      },
      "multiline-string": {
        pattern: /"""(?:(?:""?)?(?:[^"\\]|\\.))*"""|'''(?:(?:''?)?(?:[^'\\]|\\.))*'''/,
        greedy: true,
        alias: "string",
        inside: {
          comment: /#.*/
        }
      },
      string: {
        pattern: /"(?:[^\\"\r\n]|\\.)*"|'(?:[^\\'\r\n]|\\.)*'/,
        greedy: true
      },
      url: {
        pattern: /<(?:[^\x00-\x20<>"{}|^`\\]|\\(?:u[\da-fA-F]{4}|U[\da-fA-F]{8}))*>/,
        greedy: true,
        inside: {
          punctuation: /[<>]/
        }
      },
      function: {
        pattern: /(?:(?![-.\d\xB7])[-.\w\xB7\xC0-\uFFFD]+)?:(?:(?![-.])(?:[-.:\w\xC0-\uFFFD]|%[\da-f]{2}|\\.)+)?/i,
        inside: {
          "local-name": {
            pattern: /([^:]*:)[\s\S]+/,
            lookbehind: true
          },
          prefix: {
            pattern: /[\s\S]+/,
            inside: {
              punctuation: /:/
            }
          }
        }
      },
      number: /[+-]?\b\d+(?:\.\d*)?(?:e[+-]?\d+)?/i,
      punctuation: /[{}.,;()[\]]|\^\^/,
      boolean: /\b(?:false|true)\b/,
      keyword: [
        /(?:\ba|@prefix|@base)\b|=/,
        /\b(?:base|graph|prefix)\b/i
      ],
      tag: {
        pattern: /@[a-z]+(?:-[a-z\d]+)*/i,
        inside: {
          punctuation: /@/
        }
      }
    };
    Prism2.languages.trig = Prism2.languages["turtle"];
  }
};
var unrealscript_default = {
  language: "unrealscript",
  init: (Prism2) => {
    Prism2.languages.unrealscript = {
      comment: /\/\/.*|\/\*[\s\S]*?\*\//,
      string: {
        pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
        greedy: true
      },
      category: {
        pattern: /(\b(?:(?:autoexpand|hide|show)categories|var)\s*\()[^()]+(?=\))/,
        lookbehind: true,
        greedy: true,
        alias: "property"
      },
      metadata: {
        pattern: /(\w\s*)<\s*\w+\s*=[^<>|=\r\n]+(?:\|\s*\w+\s*=[^<>|=\r\n]+)*>/,
        lookbehind: true,
        greedy: true,
        inside: {
          property: /\b\w+(?=\s*=)/,
          operator: /=/,
          punctuation: /[<>|]/
        }
      },
      macro: {
        pattern: /`\w+/,
        alias: "property"
      },
      "class-name": {
        pattern: /(\b(?:class|enum|extends|interface|state(?:\(\))?|struct|within)\s+)\w+/,
        lookbehind: true
      },
      keyword: /\b(?:abstract|actor|array|auto|autoexpandcategories|bool|break|byte|case|class|classgroup|client|coerce|collapsecategories|config|const|continue|default|defaultproperties|delegate|dependson|deprecated|do|dontcollapsecategories|editconst|editinlinenew|else|enum|event|exec|export|extends|final|float|for|forcescriptorder|foreach|function|goto|guid|hidecategories|hidedropdown|if|ignores|implements|inherits|input|int|interface|iterator|latent|local|material|name|native|nativereplication|noexport|nontransient|noteditinlinenew|notplaceable|operator|optional|out|pawn|perobjectconfig|perobjectlocalized|placeable|postoperator|preoperator|private|protected|reliable|replication|return|server|showcategories|simulated|singular|state|static|string|struct|structdefault|structdefaultproperties|switch|texture|transient|travel|unreliable|until|var|vector|while|within)\b/,
      function: /\b[a-z_]\w*(?=\s*\()/i,
      boolean: /\b(?:false|true)\b/,
      number: /\b0x[\da-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?/i,
      operator: />>|<<|--|\+\+|\*\*|[-+*/~!=<>$@]=?|&&?|\|\|?|\^\^?|[?:%]|\b(?:ClockwiseFrom|Cross|Dot)\b/,
      punctuation: /[()[\]{};,.]/
    };
    Prism2.languages.uc = Prism2.languages.uscript = Prism2.languages.unrealscript;
  }
};
var wgsl_default = {
  language: "wgsl",
  init: (Prism2) => {
    Prism2.languages.wgsl = {
      comment: {
        pattern: /\/\/.*|\/\*[\s\S]*?(?:\*\/|$)/,
        greedy: true
      },
      "builtin-attribute": {
        pattern: /(@)builtin\(.*?\)/,
        lookbehind: true,
        inside: {
          attribute: {
            pattern: /^builtin/,
            alias: "attr-name"
          },
          punctuation: /[(),]/,
          "built-in-values": {
            pattern: /\b(?:frag_depth|front_facing|global_invocation_id|instance_index|local_invocation_id|local_invocation_index|num_workgroups|position|sample_index|sample_mask|vertex_index|workgroup_id)\b/,
            alias: "attr-value"
          }
        }
      },
      attributes: {
        pattern: /(@)(?:align|binding|compute|const|fragment|group|id|interpolate|invariant|location|size|vertex|workgroup_size)/i,
        lookbehind: true,
        alias: "attr-name"
      },
      functions: {
        pattern: /\b(fn\s+)[_a-zA-Z]\w*(?=[(<])/,
        lookbehind: true,
        alias: "function"
      },
      keyword: /\b(?:bitcast|break|case|const|continue|continuing|default|discard|else|enable|fallthrough|fn|for|function|if|let|loop|private|return|storage|struct|switch|type|uniform|var|while|workgroup)\b/,
      builtin: /\b(?:abs|acos|acosh|all|any|array|asin|asinh|atan|atan2|atanh|atomic|atomicAdd|atomicAnd|atomicCompareExchangeWeak|atomicExchange|atomicLoad|atomicMax|atomicMin|atomicOr|atomicStore|atomicSub|atomicXor|bool|ceil|clamp|cos|cosh|countLeadingZeros|countOneBits|countTrailingZeros|cross|degrees|determinant|distance|dot|dpdx|dpdxCoarse|dpdxFine|dpdy|dpdyCoarse|dpdyFine|exp|exp2|extractBits|f32|f64|faceForward|firstLeadingBit|floor|fma|fract|frexp|fwidth|fwidthCoarse|fwidthFine|i32|i64|insertBits|inverseSqrt|ldexp|length|log|log2|mat[2-4]x[2-4]|max|min|mix|modf|normalize|override|pack2x16float|pack2x16snorm|pack2x16unorm|pack4x8snorm|pack4x8unorm|pow|ptr|quantizeToF16|radians|reflect|refract|reverseBits|round|sampler|sampler_comparison|select|shiftLeft|shiftRight|sign|sin|sinh|smoothstep|sqrt|staticAssert|step|storageBarrier|tan|tanh|textureDimensions|textureGather|textureGatherCompare|textureLoad|textureNumLayers|textureNumLevels|textureNumSamples|textureSample|textureSampleBias|textureSampleCompare|textureSampleCompareLevel|textureSampleGrad|textureSampleLevel|textureStore|texture_1d|texture_2d|texture_2d_array|texture_3d|texture_cube|texture_cube_array|texture_depth_2d|texture_depth_2d_array|texture_depth_cube|texture_depth_cube_array|texture_depth_multisampled_2d|texture_multisampled_2d|texture_storage_1d|texture_storage_2d|texture_storage_2d_array|texture_storage_3d|transpose|trunc|u32|u64|unpack2x16float|unpack2x16snorm|unpack2x16unorm|unpack4x8snorm|unpack4x8unorm|vec[2-4]|workgroupBarrier)\b/,
      "function-calls": {
        pattern: /\b[_a-z]\w*(?=\()/i,
        alias: "function"
      },
      "class-name": /\b(?:[A-Z][A-Za-z0-9]*)\b/,
      "bool-literal": {
        pattern: /\b(?:false|true)\b/,
        alias: "boolean"
      },
      "hex-int-literal": {
        pattern: /\b0[xX][0-9a-fA-F]+[iu]?\b(?![.pP])/,
        alias: "number"
      },
      "hex-float-literal": {
        pattern: /\b0[xX][0-9a-fA-F]*(?:\.[0-9a-fA-F]*)?(?:[pP][+-]?\d+[fh]?)?/,
        alias: "number"
      },
      "decimal-float-literal": [
        { pattern: /\d*\.\d+(?:[eE](?:\+|-)?\d+)?[fh]?/, alias: "number" },
        { pattern: /\d+\.\d*(?:[eE](?:\+|-)?\d+)?[fh]?/, alias: "number" },
        { pattern: /\d+[eE](?:\+|-)?\d+[fh]?/, alias: "number" },
        { pattern: /\b\d+[fh]\b/, alias: "number" }
      ],
      "int-literal": {
        pattern: /\b\d+[iu]?\b/,
        alias: "number"
      },
      operator: [
        { pattern: /(?:\^|~|\|(?!\|)|\|\||&&|<<|>>|!)(?!=)/ },
        { pattern: /&(?![&=])/ },
        { pattern: /(?:\+=|-=|\*=|\/=|%=|\^=|&=|\|=|<<=|>>=)/ },
        { pattern: /(^|[^<>=!])=(?![=>])/, lookbehind: true },
        { pattern: /(?:==|!=|<=|\+\+|--|(^|[^=])>=)/, lookbehind: true },
        { pattern: /(?:(?:[+%]|(?:\*(?!\w)))(?!=))|(?:-(?!>))|(?:\/(?!\/))/ },
        { pattern: /->/ }
      ],
      punctuation: /[@(){}[\],;<>:.]/
    };
  }
};
var wolfram_default = {
  language: "wolfram",
  init: (Prism2) => {
    Prism2.languages.wolfram = {
      comment: /\(\*(?:\(\*(?:[^*]|\*(?!\)))*\*\)|(?!\(\*)[\s\S])*?\*\)/,
      string: {
        pattern: /"(?:\\.|[^"\\\r\n])*"/,
        greedy: true
      },
      keyword: /\b(?:Abs|AbsArg|Accuracy|Block|Do|For|Function|If|Manipulate|Module|Nest|NestList|None|Return|Switch|Table|Which|While)\b/,
      context: {
        pattern: /\b\w+`+\w*/,
        alias: "class-name"
      },
      blank: {
        pattern: /\b\w+_\b/,
        alias: "regex"
      },
      "global-variable": {
        pattern: /\$\w+/,
        alias: "variable"
      },
      boolean: /\b(?:False|True)\b/,
      number: /(?:\b(?=\d)|\B(?=\.))(?:0[bo])?(?:(?:\d|0x[\da-f])[\da-f]*(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?j?\b/i,
      operator: /\/\.|;|=\.|\^=|\^:=|:=|<<|>>|<\||\|>|:>|\|->|->|<-|@@@|@@|@|\/@|=!=|===|==|=|\+|-|\[\/-+%=\]=?|!=|\*\*?=?|\/\/?=?|<[<=>]?|>[=>]?|[&|^~]/,
      punctuation: /[{}[\];(),.:]/
    };
    Prism2.languages.mathematica = Prism2.languages.wolfram;
    Prism2.languages.wl = Prism2.languages.wolfram;
    Prism2.languages.nb = Prism2.languages.wolfram;
  }
};
var xquery_default = {
  language: "xquery",
  init: (Prism2) => {
    Prism2.languages.xquery = Prism2.languages.extend("markup", {
      "xquery-comment": {
        pattern: /\(:[\s\S]*?:\)/,
        greedy: true,
        alias: "comment"
      },
      string: {
        pattern: /(["'])(?:\1\1|(?!\1)[\s\S])*\1/,
        greedy: true
      },
      extension: {
        pattern: /\(#.+?#\)/,
        alias: "symbol"
      },
      variable: /\$[-\w:]+/,
      axis: {
        pattern: /(^|[^-])(?:ancestor(?:-or-self)?|attribute|child|descendant(?:-or-self)?|following(?:-sibling)?|parent|preceding(?:-sibling)?|self)(?=::)/,
        lookbehind: true,
        alias: "operator"
      },
      "keyword-operator": {
        pattern: /(^|[^:-])\b(?:and|castable as|div|eq|except|ge|gt|idiv|instance of|intersect|is|le|lt|mod|ne|or|union)\b(?=$|[^:-])/,
        lookbehind: true,
        alias: "operator"
      },
      keyword: {
        pattern: /(^|[^:-])\b(?:as|ascending|at|base-uri|boundary-space|case|cast as|collation|construction|copy-namespaces|declare|default|descending|else|empty (?:greatest|least)|encoding|every|external|for|function|if|import|in|inherit|lax|let|map|module|namespace|no-inherit|no-preserve|option|order(?: by|ed|ing)?|preserve|return|satisfies|schema|some|stable|strict|strip|then|to|treat as|typeswitch|unordered|validate|variable|version|where|xquery)\b(?=$|[^:-])/,
        lookbehind: true
      },
      function: /[\w-]+(?::[\w-]+)*(?=\s*\()/,
      "xquery-element": {
        pattern: /(element\s+)[\w-]+(?::[\w-]+)*/,
        lookbehind: true,
        alias: "tag"
      },
      "xquery-attribute": {
        pattern: /(attribute\s+)[\w-]+(?::[\w-]+)*/,
        lookbehind: true,
        alias: "attr-name"
      },
      builtin: {
        pattern: /(^|[^:-])\b(?:attribute|comment|document|element|processing-instruction|text|xs:(?:ENTITIES|ENTITY|ID|IDREFS?|NCName|NMTOKENS?|NOTATION|Name|QName|anyAtomicType|anyType|anyURI|base64Binary|boolean|byte|date|dateTime|dayTimeDuration|decimal|double|duration|float|gDay|gMonth|gMonthDay|gYear|gYearMonth|hexBinary|int|integer|language|long|negativeInteger|nonNegativeInteger|nonPositiveInteger|normalizedString|positiveInteger|short|string|time|token|unsigned(?:Byte|Int|Long|Short)|untyped(?:Atomic)?|yearMonthDuration))\b(?=$|[^:-])/,
        lookbehind: true
      },
      number: /\b\d+(?:\.\d+)?(?:E[+-]?\d+)?/,
      operator: [
        /[+*=?|@]|\.\.?|:=|!=|<[=<]?|>[=>]?/,
        {
          pattern: /(\s)-(?=\s)/,
          lookbehind: true
        }
      ],
      punctuation: /[[\](){},;:/]/
    });
    Prism2.languages.xquery.tag.pattern = /<\/?(?!\d)[^\s>\/=$<%]+(?:\s+[^\s>\/=]+(?:=(?:("|')(?:\\[\s\S]|\{(?!\{)(?:\{(?:\{[^{}]*\}|[^{}])*\}|[^{}])+\}|(?!\1)[^\\])*\1|[^\s'">=]+))?)*\s*\/?>/;
    Prism2.languages.xquery["tag"].inside["attr-value"].pattern = /=(?:("|')(?:\\[\s\S]|\{(?!\{)(?:\{(?:\{[^{}]*\}|[^{}])*\}|[^{}])+\}|(?!\1)[^\\])*\1|[^\s'">=]+)/;
    Prism2.languages.xquery["tag"].inside["attr-value"].inside["punctuation"] = /^="|"$/;
    Prism2.languages.xquery["tag"].inside["attr-value"].inside["expression"] = {
      pattern: /\{(?!\{)(?:\{(?:\{[^{}]*\}|[^{}])*\}|[^{}])+\}/,
      inside: Prism2.languages.xquery,
      alias: "language-xquery"
    };
    var stringifyToken = function(token) {
      if (typeof token === "string") {
        return token;
      }
      if (typeof token.content === "string") {
        return token.content;
      }
      return token.content.map(stringifyToken).join("");
    };
    var walkTokens = function(tokens) {
      var openedTags = [];
      for (var i = 0;i < tokens.length; i++) {
        var token = tokens[i];
        var notTagNorBrace = false;
        if (typeof token !== "string") {
          if (token.type === "tag" && token.content[0] && token.content[0].type === "tag") {
            if (token.content[0].content[0].content === "</") {
              if (openedTags.length > 0 && openedTags[openedTags.length - 1].tagName === stringifyToken(token.content[0].content[1])) {
                openedTags.pop();
              }
            } else {
              if (token.content[token.content.length - 1].content === "/>") {} else {
                openedTags.push({
                  tagName: stringifyToken(token.content[0].content[1]),
                  openedBraces: 0
                });
              }
            }
          } else if (openedTags.length > 0 && token.type === "punctuation" && token.content === "{" && (!tokens[i + 1] || tokens[i + 1].type !== "punctuation" || tokens[i + 1].content !== "{") && (!tokens[i - 1] || tokens[i - 1].type !== "plain-text" || tokens[i - 1].content !== "{")) {
            openedTags[openedTags.length - 1].openedBraces++;
          } else if (openedTags.length > 0 && openedTags[openedTags.length - 1].openedBraces > 0 && token.type === "punctuation" && token.content === "}") {
            openedTags[openedTags.length - 1].openedBraces--;
          } else if (token.type !== "comment") {
            notTagNorBrace = true;
          }
        }
        if (notTagNorBrace || typeof token === "string") {
          if (openedTags.length > 0 && openedTags[openedTags.length - 1].openedBraces === 0) {
            var plainText = stringifyToken(token);
            if (i < tokens.length - 1 && (typeof tokens[i + 1] === "string" || tokens[i + 1].type === "plain-text")) {
              plainText += stringifyToken(tokens[i + 1]);
              tokens.splice(i + 1, 1);
            }
            if (i > 0 && (typeof tokens[i - 1] === "string" || tokens[i - 1].type === "plain-text")) {
              plainText = stringifyToken(tokens[i - 1]) + plainText;
              tokens.splice(i - 1, 1);
              i--;
            }
            if (/^\s+$/.test(plainText)) {
              tokens[i] = plainText;
            } else {
              tokens[i] = new Prism2.Token("plain-text", plainText, null, plainText);
            }
          }
        }
        if (token.content && typeof token.content !== "string") {
          walkTokens(token.content);
        }
      }
    };
    Prism2.hooks.add("after-tokenize", function(env) {
      if (env.language !== "xquery") {
        return;
      }
      walkTokens(env.tokens);
    });
  }
};
var zig_default = {
  language: "zig",
  init: (Prism2) => {
    function literal(str) {
      return function() {
        return str;
      };
    }
    var keyword = /\b(?:align|allowzero|and|anyframe|anytype|asm|async|await|break|cancel|catch|comptime|const|continue|defer|else|enum|errdefer|error|export|extern|fn|for|if|inline|linksection|nakedcc|noalias|nosuspend|null|or|orelse|packed|promise|pub|resume|return|stdcallcc|struct|suspend|switch|test|threadlocal|try|undefined|union|unreachable|usingnamespace|var|volatile|while)\b/;
    var IDENTIFIER = "\\b(?!" + keyword.source + ")(?!\\d)\\w+\\b";
    var ALIGN = /align\s*\((?:[^()]|\([^()]*\))*\)/.source;
    var PREFIX_TYPE_OP = /(?:\?|\bpromise->|(?:\[[^[\]]*\]|\*(?!\*)|\*\*)(?:\s*<ALIGN>|\s*const\b|\s*volatile\b|\s*allowzero\b)*)/.source.replace(/<ALIGN>/g, literal(ALIGN));
    var SUFFIX_EXPR = /(?:\bpromise\b|(?:\berror\.)?<ID>(?:\.<ID>)*(?!\s+<ID>))/.source.replace(/<ID>/g, literal(IDENTIFIER));
    var TYPE = "(?!\\s)(?:!?\\s*(?:" + PREFIX_TYPE_OP + "\\s*)*" + SUFFIX_EXPR + ")+";
    Prism2.languages.zig = {
      comment: [
        {
          pattern: /\/\/[/!].*/,
          alias: "doc-comment"
        },
        /\/{2}.*/
      ],
      string: [
        {
          pattern: /(^|[^\\@])c?"(?:[^"\\\r\n]|\\.)*"/,
          lookbehind: true,
          greedy: true
        },
        {
          pattern: /([\r\n])([ \t]+c?\\{2}).*(?:(?:\r\n?|\n)\2.*)*/,
          lookbehind: true,
          greedy: true
        }
      ],
      char: {
        pattern: /(^|[^\\])'(?:[^'\\\r\n]|[\uD800-\uDFFF]{2}|\\(?:.|x[a-fA-F\d]{2}|u\{[a-fA-F\d]{1,6}\}))'/,
        lookbehind: true,
        greedy: true
      },
      builtin: /\B@(?!\d)\w+(?=\s*\()/,
      label: {
        pattern: /(\b(?:break|continue)\s*:\s*)\w+\b|\b(?!\d)\w+\b(?=\s*:\s*(?:\{|while\b))/,
        lookbehind: true
      },
      "class-name": [
        /\b(?!\d)\w+(?=\s*=\s*(?:(?:extern|packed)\s+)?(?:enum|struct|union)\s*[({])/,
        {
          pattern: RegExp(/(:\s*)<TYPE>(?=\s*(?:<ALIGN>\s*)?[=;,)])|<TYPE>(?=\s*(?:<ALIGN>\s*)?\{)/.source.replace(/<TYPE>/g, literal(TYPE)).replace(/<ALIGN>/g, literal(ALIGN))),
          lookbehind: true,
          inside: null
        },
        {
          pattern: RegExp(/(\)\s*)<TYPE>(?=\s*(?:<ALIGN>\s*)?;)/.source.replace(/<TYPE>/g, literal(TYPE)).replace(/<ALIGN>/g, literal(ALIGN))),
          lookbehind: true,
          inside: null
        }
      ],
      "builtin-type": {
        pattern: /\b(?:anyerror|bool|c_u?(?:int|long|longlong|short)|c_longdouble|c_void|comptime_(?:float|int)|f(?:16|32|64|128)|[iu](?:8|16|32|64|128|size)|noreturn|type|void)\b/,
        alias: "keyword"
      },
      keyword,
      function: /\b(?!\d)\w+(?=\s*\()/,
      number: /\b(?:0b[01]+|0o[0-7]+|0x[a-fA-F\d]+(?:\.[a-fA-F\d]*)?(?:[pP][+-]?[a-fA-F\d]+)?|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)\b/,
      boolean: /\b(?:false|true)\b/,
      operator: /\.[*?]|\.{2,3}|[-=]>|\*\*|\+\+|\|\||(?:<<|>>|[-+*]%|[-+*/%^&|<>!=])=?|[?~]/,
      punctuation: /[.:,;(){}[\]]/
    };
    Prism2.languages.zig["class-name"].forEach(function(obj) {
      if (obj.inside === null) {
        obj.inside = Prism2.languages.zig;
      }
    });
  }
};
var txt_default = {
  language: "txt",
  init: (Prism2) => {
    Prism2.languages.txt = {
      word: /\S+/
    };
  }
};
var LANGUAGE_DEFINITIONS = [
  markup_default,
  clike_default,
  css_default,
  c_default,
  javascript_default,
  java_default,
  ruby_default,
  php_default,
  markup_templating_default,
  css_extras_default,
  scss_default,
  sass_default,
  less_default,
  cpp_default,
  bison_default,
  objectivec_default,
  scala_default,
  csharp_default,
  dart_default,
  d_default,
  fsharp_default,
  glsl_default,
  go_default,
  groovy_default,
  haxe_default,
  jolie_default,
  kotlin_default,
  reason_default,
  swift_default,
  crystal_default,
  erb_default,
  actionscript_default,
  coffeescript_default,
  flow_default,
  n4js_default,
  typescript_default,
  jsx_default,
  tsx_default,
  arduino_default,
  django_default,
  aspnet_default,
  velocity_default,
  parser_default,
  php_extras_default,
  abap_default,
  ada_default,
  apacheconf_default,
  apl_default,
  applescript_default,
  arff_default,
  asciidoc_default,
  asm6502_default,
  autohotkey_default,
  autoit_default,
  bash_default,
  basic_default,
  batch_default,
  brainfuck_default,
  bro_default,
  clojure_default,
  csp_default,
  diff_default,
  docker_default,
  eiffel_default,
  elixir_default,
  erlang_default,
  fortran_default,
  gedcom_default,
  gherkin_default,
  git_default,
  graphql_default,
  haml_default,
  handlebars_default,
  haskell_default,
  hpkp_default,
  hsts_default,
  http_default,
  ichigojam_default,
  icon_default,
  inform7_default,
  ini_default,
  io_default,
  j_default,
  json_default,
  julia_default,
  keyman_default,
  latex_default,
  liquid_default,
  lisp_default,
  livescript_default,
  lolcode_default,
  lua_default,
  makefile_default,
  markdown_format_default,
  matlab_default,
  mel_default,
  mizar_default,
  monkey_default,
  nasm_default,
  nginx_default,
  nim_default,
  nix_default,
  nsis_default,
  ocaml_default,
  opencl_default,
  oz_default,
  parigp_default,
  pascal_default,
  perl_default,
  sql_default,
  plsql_default,
  powershell_default,
  processing_default,
  prolog_default,
  properties_default,
  protobuf_default,
  pug_default,
  puppet_default,
  pure_default,
  python_default,
  q_default,
  qore_default,
  r_default,
  renpy_default,
  rest_default,
  rip_default,
  roboconf_default,
  rust_default,
  sas_default,
  scheme_default,
  smalltalk_default,
  smarty_default,
  soy_default,
  stylus_default,
  tcl_default,
  textile_default,
  twig_default,
  vbnet_default,
  verilog_default,
  vhdl_default,
  vim_default,
  visual_basic_default,
  wasm_default,
  wiki_default,
  xeora_default,
  xojo_default,
  yaml_default,
  antlr4_default,
  apex_default,
  awk_default,
  bicep_default,
  cmake_default,
  csv_default,
  dot_default,
  elm_default,
  gdscript_default,
  gettext_default,
  hcl_default,
  ignore_default,
  lilypond_default,
  linker_script_default,
  llvm_default,
  log_default,
  openqasm_default,
  plant_uml_default,
  powerquery_default,
  regex_default,
  robotframework_default,
  tap_default,
  toml_default,
  turtle_default,
  unrealscript_default,
  wgsl_default,
  wolfram_default,
  zig_default,
  cfscript_default,
  idris_default,
  json5_default,
  purescript_default,
  qsharp_default,
  racket_default,
  rescript_default,
  solidity_default,
  tt2_default,
  xquery_default,
  sparql_default,
  txt_default
];
var LANGUAGE_NAMES = LANGUAGE_DEFINITIONS.map((d) => d.language);
var _initialized = false;
function initializeAll() {
  if (_initialized)
    return;
  _initialized = true;
  for (const def of LANGUAGE_DEFINITIONS) {
    try {
      def.init(prism_core_default);
    } catch {}
  }
}
initializeAll();
var punctuation = {
  new_line: /\n/,
  empty: /[ \t\r\n\f\v]+/
};
var patchedLanguages = /* @__PURE__ */ new Set;
function ensureLanguageLoaded(lang) {
  if (patchedLanguages.has(lang))
    return;
  const grammar = prism_core_default.languages[lang];
  if (typeof grammar === "object" && grammar !== null) {
    prism_core_default.languages[lang] = { ...grammar, ...punctuation };
  }
  patchedLanguages.add(lang);
}
var FORMATS = {
  abap: {
    exts: []
  },
  actionscript: {
    exts: ["as"]
  },
  ada: {
    exts: ["ada"]
  },
  apacheconf: {
    exts: []
  },
  apl: {
    exts: ["apl"]
  },
  applescript: {
    exts: []
  },
  arduino: {
    exts: []
  },
  arff: {
    exts: []
  },
  asciidoc: {
    exts: []
  },
  asm6502: {
    exts: []
  },
  aspnet: {
    exts: ["asp", "aspx"]
  },
  autohotkey: {
    exts: []
  },
  autoit: {
    exts: []
  },
  bash: {
    exts: ["sh", "ksh", "bash"]
  },
  basic: {
    exts: ["bas"]
  },
  batch: {
    exts: []
  },
  bison: {
    exts: []
  },
  brainfuck: {
    exts: ["b", "bf"]
  },
  bro: {
    exts: []
  },
  c: {
    exts: ["c", "z80"]
  },
  "c-header": {
    exts: ["h"],
    parent: "c"
  },
  clike: {
    exts: []
  },
  clojure: {
    exts: ["cljs", "clj", "cljc", "cljx", "edn"]
  },
  coffeescript: {
    exts: ["coffee"]
  },
  comments: {
    exts: []
  },
  cpp: {
    exts: ["cpp", "c++", "cc", "cxx"]
  },
  "cpp-header": {
    exts: ["hpp", "h++", "hh", "hxx"],
    parent: "cpp"
  },
  crystal: {
    exts: ["cr"]
  },
  csharp: {
    exts: ["cs"]
  },
  csp: {
    exts: []
  },
  "css-extras": {
    exts: []
  },
  css: {
    exts: ["css", "gss"]
  },
  d: {
    exts: ["d"]
  },
  dart: {
    exts: ["dart"]
  },
  diff: {
    exts: ["diff", "patch"]
  },
  django: {
    exts: []
  },
  docker: {
    exts: []
  },
  eiffel: {
    exts: ["e"]
  },
  elixir: {
    exts: []
  },
  elm: {
    exts: ["elm"]
  },
  erb: {
    exts: []
  },
  erlang: {
    exts: ["erl", "erlang"]
  },
  flow: {
    exts: []
  },
  fortran: {
    exts: ["f", "for", "f77", "f90"]
  },
  fsharp: {
    exts: ["fs"]
  },
  gdscript: {
    exts: ["gd"]
  },
  gedcom: {
    exts: []
  },
  gherkin: {
    exts: ["feature"]
  },
  git: {
    exts: []
  },
  glsl: {
    exts: []
  },
  go: {
    exts: ["go"]
  },
  graphql: {
    exts: ["graphql"]
  },
  groovy: {
    exts: ["groovy", "gradle"]
  },
  haml: {
    exts: ["haml"]
  },
  handlebars: {
    exts: ["hb", "hbs", "handlebars"]
  },
  haskell: {
    exts: ["hs", "lhs"]
  },
  haxe: {
    exts: ["hx", "hxml"]
  },
  hpkp: {
    exts: []
  },
  hsts: {
    exts: []
  },
  http: {
    exts: []
  },
  ichigojam: {
    exts: []
  },
  icon: {
    exts: []
  },
  inform7: {
    exts: []
  },
  ini: {
    exts: ["ini"]
  },
  io: {
    exts: []
  },
  j: {
    exts: []
  },
  java: {
    exts: ["java"]
  },
  javascript: {
    exts: ["js", "es", "es6", "mjs", "cjs"]
  },
  jolie: {
    exts: []
  },
  json: {
    exts: ["json", "map", "jsonld"]
  },
  jsx: {
    exts: ["jsx"]
  },
  julia: {
    exts: ["jl"]
  },
  keymap: {
    exts: []
  },
  kotlin: {
    exts: ["kt", "kts"]
  },
  latex: {
    exts: ["tex"]
  },
  less: {
    exts: ["less"]
  },
  liquid: {
    exts: []
  },
  lisp: {
    exts: ["cl", "lisp", "el"]
  },
  livescript: {
    exts: ["ls"]
  },
  lolcode: {
    exts: []
  },
  lua: {
    exts: ["lua"]
  },
  makefile: {
    exts: []
  },
  markdown: {
    exts: ["md", "markdown", "mkd"]
  },
  markup: {
    exts: ["html", "htm", "xml", "xsl", "xslt", "svg", "ejs", "jsp"]
  },
  matlab: {
    exts: []
  },
  mel: {
    exts: []
  },
  mizar: {
    exts: []
  },
  monkey: {
    exts: []
  },
  n4js: {
    exts: []
  },
  nasm: {
    exts: []
  },
  nginx: {
    exts: []
  },
  nim: {
    exts: []
  },
  nix: {
    exts: []
  },
  nsis: {
    exts: ["nsh", "nsi"]
  },
  objectivec: {
    exts: ["m", "mm"]
  },
  ocaml: {
    exts: ["ocaml", "ml", "mli", "mll", "mly"]
  },
  opencl: {
    exts: []
  },
  oz: {
    exts: ["oz"]
  },
  parigp: {
    exts: []
  },
  pascal: {
    exts: ["pas", "p"]
  },
  perl: {
    exts: ["pl", "pm"]
  },
  php: {
    exts: ["php", "phtml"]
  },
  plsql: {
    exts: ["plsql"]
  },
  powershell: {
    exts: ["ps1", "psd1", "psm1"]
  },
  processing: {
    exts: []
  },
  prolog: {
    exts: ["pro"]
  },
  properties: {
    exts: ["properties"]
  },
  protobuf: {
    exts: ["proto"]
  },
  pug: {
    exts: ["pug", "jade"]
  },
  puppet: {
    exts: ["pp", "puppet"]
  },
  pure: {
    exts: []
  },
  python: {
    exts: ["py", "pyx", "pxd", "pxi"]
  },
  q: {
    exts: ["q"]
  },
  qore: {
    exts: []
  },
  r: {
    exts: ["r", "R"]
  },
  reason: {
    exts: []
  },
  renpy: {
    exts: []
  },
  rest: {
    exts: []
  },
  rip: {
    exts: []
  },
  roboconf: {
    exts: []
  },
  ruby: {
    exts: ["rb"]
  },
  rust: {
    exts: ["rs"]
  },
  sas: {
    exts: ["sas"]
  },
  sass: {
    exts: ["sass"]
  },
  scala: {
    exts: ["scala"]
  },
  scheme: {
    exts: ["scm", "ss"]
  },
  scss: {
    exts: ["scss"]
  },
  svelte: {
    exts: ["svelte"]
  },
  smalltalk: {
    exts: ["st"]
  },
  smarty: {
    exts: ["smarty", "tpl"]
  },
  soy: {
    exts: ["soy"]
  },
  sql: {
    exts: ["sql", "cql"]
  },
  stylus: {
    exts: ["styl", "stylus"]
  },
  swift: {
    exts: ["swift"]
  },
  tap: {
    exts: ["tap"]
  },
  tcl: {
    exts: ["tcl"]
  },
  textile: {
    exts: ["textile"]
  },
  tsx: {
    exts: ["tsx"]
  },
  tt2: {
    exts: ["tt2"]
  },
  twig: {
    exts: ["twig"]
  },
  typescript: {
    exts: ["ts", "mts", "cts"]
  },
  txt: {
    exts: ["txt"]
  },
  vbnet: {
    exts: ["vb"]
  },
  velocity: {
    exts: ["vtl"]
  },
  verilog: {
    exts: ["v"]
  },
  vhdl: {
    exts: ["vhd", "vhdl"]
  },
  vim: {
    exts: []
  },
  "visual-basic": {
    exts: ["vb"]
  },
  astro: {
    exts: ["astro"]
  },
  vue: {
    exts: ["vue"]
  },
  wasm: {
    exts: []
  },
  url: {
    exts: []
  },
  wiki: {
    exts: []
  },
  xeora: {
    exts: []
  },
  xojo: {
    exts: []
  },
  xquery: {
    exts: ["xy", "xquery"]
  },
  yaml: {
    exts: ["yaml", "yml"]
  },
  abnf: {
    exts: []
  },
  agda: {
    exts: []
  },
  antlr4: {
    exts: ["g4"]
  },
  apex: {
    exts: ["cls", "trigger", "apex"]
  },
  aql: {
    exts: []
  },
  armasm: {
    exts: []
  },
  awk: {
    exts: ["awk"]
  },
  bicep: {
    exts: ["bicep"]
  },
  bnf: {
    exts: []
  },
  cfscript: {
    exts: ["cfc"]
  },
  cfml: {
    exts: ["cfm"],
    parent: "markup"
  },
  cmake: {
    exts: ["cmake"]
  },
  cobol: {
    exts: []
  },
  csv: {
    exts: ["csv"]
  },
  cypher: {
    exts: []
  },
  dhall: {
    exts: []
  },
  "dns-zone-file": {
    exts: []
  },
  dot: {
    exts: ["dot", "gv"]
  },
  ebnf: {
    exts: []
  },
  editorconfig: {
    exts: []
  },
  "excel-formula": {
    exts: ["xlsx", "xls"]
  },
  factor: {
    exts: []
  },
  ftl: {
    exts: []
  },
  gcode: {
    exts: []
  },
  gettext: {
    exts: ["po"]
  },
  gml: {
    exts: []
  },
  "go-module": {
    exts: []
  },
  hcl: {
    exts: ["tf", "hcl"]
  },
  hlsl: {
    exts: []
  },
  idris: {
    exts: ["idr"]
  },
  ignore: {
    exts: ["gitignore"]
  },
  jq: {
    exts: []
  },
  json5: {
    exts: ["json5"]
  },
  kusto: {
    exts: []
  },
  lilypond: {
    exts: ["ly"]
  },
  "linker-script": {
    exts: ["ld"]
  },
  llvm: {
    exts: ["ll"]
  },
  log: {
    exts: ["log"]
  },
  mermaid: {
    exts: []
  },
  mongodb: {
    exts: []
  },
  n1ql: {
    exts: []
  },
  odin: {
    exts: []
  },
  openqasm: {
    exts: ["qasm"]
  },
  "plant-uml": {
    exts: ["puml", "plantuml"]
  },
  powerquery: {
    exts: ["pq"]
  },
  promql: {
    exts: []
  },
  purescript: {
    exts: ["purs"]
  },
  qsharp: {
    exts: ["qs"]
  },
  racket: {
    exts: ["rkt"]
  },
  regex: {
    exts: []
  },
  rego: {
    exts: []
  },
  rescript: {
    exts: ["res"]
  },
  robotframework: {
    exts: ["robot"]
  },
  "shell-session": {
    exts: []
  },
  smali: {
    exts: []
  },
  solidity: {
    exts: ["sol"]
  },
  sparql: {
    exts: ["rq"]
  },
  stata: {
    exts: []
  },
  toml: {
    exts: ["toml"]
  },
  turtle: {
    exts: ["ttl"]
  },
  typoscript: {
    exts: []
  },
  unrealscript: {
    exts: ["uc"]
  },
  uri: {
    exts: []
  },
  vala: {
    exts: []
  },
  wgsl: {
    exts: ["wgsl"]
  },
  wolfram: {
    exts: ["wl", "nb"]
  },
  zig: {
    exts: ["zig"]
  }
};
var EXT_TO_FORMAT = /* @__PURE__ */ new Map;
for (const [fmt, meta] of Object.entries(FORMATS)) {
  for (const ext of meta.exts) {
    if (!EXT_TO_FORMAT.has(ext)) {
      EXT_TO_FORMAT.set(ext, fmt);
    }
  }
}
function getFormatByFile(path, formatsExts, formatsNames) {
  const ext = extname(path).slice(1);
  const name = basename(path);
  if (formatsNames && Object.keys(formatsNames).length) {
    const byName = Object.keys(formatsNames).find((format) => formatsNames[format]?.includes(name));
    if (byName)
      return byName;
  }
  if (formatsExts && Object.keys(formatsExts).length) {
    return Object.keys(formatsExts).find((format) => formatsExts[format]?.includes(ext));
  }
  return EXT_TO_FORMAT.get(ext);
}
function hash(value) {
  return import_spark_md5.default.hash(value);
}
var TOKEN_HASH_LENGTH = 20;
function createTokenHash(token, hashFn) {
  return hashFn(token.type + token.value).substring(0, TOKEN_HASH_LENGTH);
}
function groupByFormat(tokens) {
  const result = {};
  for (const token of tokens) {
    if (result[token.format]) {
      result[token.format].push(token);
    } else {
      result[token.format] = [token];
    }
  }
  return result;
}
var TokensMap = class {
  constructor(id, data, tokens, format, options) {
    this.id = id;
    this.data = data;
    this.tokens = tokens;
    this.format = format;
    this.options = options;
    this.hashFn = options.hashFunction ?? hash;
    this.hashMap = this.tokens.map((token) => {
      if (options.ignoreCase) {
        token.value = token.value.toLocaleLowerCase();
      }
      return createTokenHash(token, this.hashFn);
    }).join("");
  }
  id;
  data;
  tokens;
  format;
  options;
  position = 0;
  hashMap;
  hashFn;
  getTokensCount() {
    return this.tokens[this.tokens.length - 1].loc.end.position - this.tokens[0].loc.start.position;
  }
  getId() {
    return this.id;
  }
  getLinesCount() {
    return this.tokens[this.tokens.length - 1].loc.end.line - this.tokens[0].loc.start.line + 1;
  }
  getFormat() {
    return this.format;
  }
  [Symbol.iterator]() {
    return this;
  }
  next() {
    const mapFrame = this.hashFn(this.hashMap.substring(this.position * TOKEN_HASH_LENGTH, this.position * TOKEN_HASH_LENGTH + this.options.minTokens * TOKEN_HASH_LENGTH)).substring(0, TOKEN_HASH_LENGTH);
    if (this.position < this.tokens.length - this.options.minTokens) {
      this.position++;
      return {
        done: false,
        value: {
          id: mapFrame,
          sourceId: this.getId(),
          start: this.tokens[this.position - 1],
          end: this.tokens[this.position + this.options.minTokens - 1]
        }
      };
    } else {
      return {
        done: true,
        value: false
      };
    }
  }
};
function generateMapsForFormats(id, data, tokens, options) {
  return Object.values(groupByFormat(tokens)).map((formatTokens) => new TokensMap(id, data, formatTokens, formatTokens[0].format, options));
}
function createTokensMaps(id, data, tokens, options) {
  return generateMapsForFormats(id, data, tokens, options);
}
function extractLang(attrs) {
  const m = /\blang\s*=\s*["']([^"']+)["']/.exec(attrs);
  return m ? (m[1] ?? "").toLowerCase() : "";
}
function resolveBlockFormat(tagName, lang) {
  switch (tagName) {
    case "template":
      return lang && lang in FORMATS ? lang : "markup";
    case "script":
      return lang === "ts" || lang === "typescript" ? "typescript" : "javascript";
    case "style":
      if (lang === "scss")
        return "scss";
      if (lang === "less")
        return "less";
      return "css";
    default:
      return "markup";
  }
}
function countNewlines(s) {
  let count = 0;
  for (let i = 0;i < s.length; i++) {
    if (s[i] === `
`)
      count++;
  }
  return count;
}
function tokenizeVue(source, id, options) {
  const { ignoreCase } = options;
  const allTokens = [];
  const blockRegex = /<(template|script|style)(\s[^>]*)?>[\s\S]*?<\/\1>/gi;
  let match;
  while ((match = blockRegex.exec(source)) !== null) {
    try {
      const [fullMatch, tagName, attrsRaw] = match;
      if (!tagName)
        continue;
      const attrs = attrsRaw ? attrsRaw.replace(/\bsetup\b/g, "") : "";
      const lang = extractLang(attrs);
      const resolvedFormat = resolveBlockFormat(tagName.toLowerCase(), lang);
      const openTagEnd = fullMatch.indexOf(">") + 1;
      const closeTagStart = fullMatch.lastIndexOf("</");
      if (closeTagStart <= openTagEnd)
        continue;
      const innerContent = fullMatch.substring(openTagEnd, closeTagStart);
      const lineOffset = countNewlines(source.substring(0, match.index));
      const contentAbsStart = match.index + openTagEnd;
      const lastNlBeforeContent = source.lastIndexOf(`
`, contentAbsStart - 1);
      const colOffset = contentAbsStart - lastNlBeforeContent - 1;
      const blockTokens = tokenize2(innerContent, resolvedFormat);
      for (const token of blockTokens) {
        if (token.loc) {
          if (token.loc.start.line === 1) {
            token.loc.start.column = (token.loc.start.column ?? 1) + colOffset;
          }
          if (token.loc.end.line === 1) {
            token.loc.end.column = (token.loc.end.column ?? 1) + colOffset;
          }
          token.loc.start.line += lineOffset;
          token.loc.end.line += lineOffset;
        }
        allTokens.push(token);
      }
    } catch (_e) {}
  }
  allTokens.forEach((token, idx) => {
    if (token.loc) {
      token.loc.start.position = idx;
      token.loc.end.position = idx;
    }
  });
  let processedTokens = options.mode ? allTokens.filter((token) => options.mode(token, options)) : allTokens;
  if (ignoreCase) {
    processedTokens = processedTokens.map((token) => {
      token.value = token.value.toLocaleLowerCase();
      return token;
    });
  }
  return createTokensMaps(id, source, processedTokens, options);
}
var MAX_SOURCE_LENGTH = 5000000;
function extractLang2(attrs) {
  const m = /\blang\s*=\s*["']([^"']+)["']/.exec(attrs);
  return m ? (m[1] ?? "").toLowerCase() : "";
}
function countNewlines2(s) {
  let count = 0;
  for (let i = 0;i < s.length; i++) {
    if (s[i] === `
`)
      count++;
  }
  return count;
}
function resolveScriptFormat(lang) {
  return lang === "ts" || lang === "typescript" ? "typescript" : "javascript";
}
function resolveStyleFormat(lang) {
  if (lang === "scss")
    return "scss";
  if (lang === "less")
    return "less";
  return "css";
}
function tokenizeAstro(source, id, options) {
  if (source.length > MAX_SOURCE_LENGTH) {
    throw new Error(`Astro source exceeds the maximum tokenizable length of ${MAX_SOURCE_LENGTH.toLocaleString()} characters (got ${source.length.toLocaleString()}). Refusing to process to prevent potential regex performance issues on malformed input.`);
  }
  const normalized = source.replace(/\r\n/g, `
`);
  const { ignoreCase } = options;
  const allTokens = [];
  let templateSource = normalized;
  const frontmatterRegex = /^---\n([\s\S]*?)\n?---(?:\n|$)/;
  const frontmatterMatch = frontmatterRegex.exec(normalized);
  if (frontmatterMatch) {
    const innerContent = frontmatterMatch[1] ?? "";
    if (innerContent.trim().length > 0) {
      const lineOffset = countNewlines2(normalized.substring(0, frontmatterMatch.index + `---
`.length));
      const blockTokens = tokenize2(innerContent, "typescript");
      for (const token of blockTokens) {
        if (token.loc) {
          token.loc.start.line += lineOffset;
          token.loc.end.line += lineOffset;
        }
        allTokens.push(token);
      }
    }
    const frontmatterFull = frontmatterMatch[0];
    const frontmatterNewlines = countNewlines2(frontmatterFull);
    templateSource = `
`.repeat(frontmatterNewlines) + normalized.slice(frontmatterFull.length);
  }
  const blockRegex = /<(script|style)(\s[^>]*)?>[\s\S]*?<\/\1>/gi;
  let match;
  while ((match = blockRegex.exec(normalized)) !== null) {
    const [fullMatch, tagName, attrsRaw] = match;
    if (!tagName)
      continue;
    const attrs = attrsRaw ?? "";
    const lang = extractLang2(attrs);
    const tag = tagName.toLowerCase();
    const resolvedFormat = tag === "script" ? resolveScriptFormat(lang) : resolveStyleFormat(lang);
    const openTagEnd = fullMatch.indexOf(">") + 1;
    const closeTagStart = fullMatch.lastIndexOf("</");
    if (closeTagStart <= openTagEnd)
      continue;
    const innerContent = fullMatch.substring(openTagEnd, closeTagStart);
    const lineOffset = countNewlines2(normalized.substring(0, match.index));
    const contentAbsStart = match.index + openTagEnd;
    const lastNlBeforeContent = normalized.lastIndexOf(`
`, contentAbsStart - 1);
    const colOffset = contentAbsStart - lastNlBeforeContent - 1;
    const blockTokens = tokenize2(innerContent, resolvedFormat);
    for (const token of blockTokens) {
      if (token.loc) {
        if (token.loc.start.line === 1) {
          token.loc.start.column = (token.loc.start.column ?? 1) + colOffset;
        }
        if (token.loc.end.line === 1) {
          token.loc.end.column = (token.loc.end.column ?? 1) + colOffset;
        }
        token.loc.start.line += lineOffset;
        token.loc.end.line += lineOffset;
      }
      allTokens.push(token);
    }
  }
  const templateSanitized = templateSource.replace(/<(script|style)(\s[^>]*)?>[\s\S]*?<\/\1>/gi, (fullMatch) => {
    const openTagEnd = fullMatch.indexOf(">") + 1;
    const closeTagStart = fullMatch.lastIndexOf("</");
    if (closeTagStart <= openTagEnd)
      return fullMatch;
    const innerContent = fullMatch.substring(openTagEnd, closeTagStart);
    const openTag = fullMatch.substring(0, openTagEnd);
    const closeTag = fullMatch.substring(closeTagStart);
    return openTag + `
`.repeat(countNewlines2(innerContent)) + closeTag;
  });
  const templateTokens = tokenize2(templateSanitized, "markup").filter((token) => token.format === "markup" && token.length > 0);
  for (const token of templateTokens) {
    allTokens.push(token);
  }
  allTokens.forEach((token, idx) => {
    if (token.loc) {
      token.loc.start.position = idx;
      token.loc.end.position = idx;
    }
  });
  let processedTokens = options.mode ? allTokens.filter((token) => options.mode(token, options)) : allTokens;
  if (ignoreCase) {
    processedTokens = processedTokens.map((token) => {
      token.value = token.value.toLocaleLowerCase();
      return token;
    });
  }
  return createTokensMaps(id, normalized, processedTokens, options);
}
var MAX_SOURCE_LENGTH2 = 5000000;
function countNewlines3(s) {
  let count = 0;
  for (let i = 0;i < s.length; i++) {
    if (s[i] === `
`)
      count++;
  }
  return count;
}
function extractLang3(attrs) {
  const m = /\blang\s*=\s*["']([^"']+)["']/.exec(attrs);
  return m ? (m[1] ?? "").toLowerCase() : "";
}
function extractContext(attrs) {
  const m = /\bcontext\s*=\s*["']([^"']+)["']/.exec(attrs);
  return m ? (m[1] ?? "").toLowerCase() : "";
}
function resolveBlockFormat2(tagType, lang) {
  if (tagType === "script") {
    if (lang === "ts" || lang === "typescript")
      return "typescript";
    if (lang === "js" || lang === "javascript")
      return "javascript";
    if (lang === "")
      return "javascript";
    return "markup";
  }
  if (lang === "scss" || lang === "sass")
    return "scss";
  if (lang === "less")
    return "less";
  if (lang === "css" || lang === "postcss" || lang === "stylus")
    return "css";
  if (lang === "")
    return "css";
  return "markup";
}
function tokenizeSvelte(source, id, options) {
  if (source.length > MAX_SOURCE_LENGTH2) {
    return [];
  }
  const normalized = source.replace(/\r\n/g, `
`);
  if (normalized.length === 0) {
    return [];
  }
  const { ignoreCase } = options;
  const allTokens = [];
  const blockRegex = /<(script|style)(\s[^>]*)?>[\s\S]*?<\/\1>/gi;
  const blocks = [];
  let match;
  const blockPositions = [];
  while ((match = blockRegex.exec(normalized)) !== null) {
    const [fullMatch, tagName, attrsRaw] = match;
    if (!tagName)
      continue;
    const tag = tagName.toLowerCase();
    const attrs = attrsRaw ?? "";
    const lang = extractLang3(attrs);
    const context = extractContext(attrs);
    const tagEndInFull = fullMatch.indexOf(">");
    const closeTagStartInFull = fullMatch.lastIndexOf("</");
    if (closeTagStartInFull <= tagEndInFull + 1)
      continue;
    const contentStartInFull = tagEndInFull + 1;
    const blockContent = fullMatch.substring(contentStartInFull, closeTagStartInFull);
    const contentStart = match.index + contentStartInFull;
    const contentEnd = match.index + closeTagStartInFull;
    const record = {
      tagType: tag,
      lang,
      context,
      contentStart,
      contentEnd,
      blockContent
    };
    blocks.push(record);
    blockPositions.push({
      start: match.index,
      end: match.index + fullMatch.length,
      record
    });
  }
  let sanitizedSource = normalized;
  for (let i = blockPositions.length - 1;i >= 0; i--) {
    const bp = blockPositions[i];
    const inner = normalized.slice(bp.record.contentStart, bp.record.contentEnd);
    const blanked = inner.replace(/[^\n]/g, " ");
    sanitizedSource = sanitizedSource.slice(0, bp.record.contentStart) + blanked + sanitizedSource.slice(bp.record.contentEnd);
  }
  const templateTokens = tokenize2(sanitizedSource, "markup").filter((token) => token.format === "markup" && token.length > 0);
  for (const token of templateTokens) {
    allTokens.push(token);
  }
  for (const block of blocks) {
    const resolvedFormat = resolveBlockFormat2(block.tagType, block.lang);
    const blockStartLine = countNewlines3(normalized.slice(0, block.contentStart)) + 1;
    const lineOffset = blockStartLine - 1;
    const lastNlBefore = normalized.lastIndexOf(`
`, block.contentStart - 1);
    const colOffset = block.contentStart - (lastNlBefore + 1);
    const blockTokens = tokenize2(block.blockContent, resolvedFormat).filter((token) => token.length > 0);
    for (const token of blockTokens) {
      if (token.loc) {
        if (token.loc.start.line === 1) {
          token.loc.start.column = (token.loc.start.column ?? 1) + colOffset;
        }
        if (token.loc.end.line === 1) {
          token.loc.end.column = (token.loc.end.column ?? 1) + colOffset;
        }
        token.loc.start.line += lineOffset;
        token.loc.end.line += lineOffset;
      }
      allTokens.push(token);
    }
  }
  allTokens.forEach((token, idx) => {
    if (token.loc) {
      token.loc.start.position = idx;
      token.loc.end.position = idx;
    }
  });
  let processedTokens = options.mode ? allTokens.filter((token) => options.mode(token, options)) : allTokens;
  if (ignoreCase) {
    processedTokens = processedTokens.map((token) => {
      token.value = token.value.toLocaleLowerCase();
      return token;
    });
  }
  return createTokensMaps(id, normalized, processedTokens, options);
}
function tokenizeWithPrism(code, language) {
  const prismLang = language in FORMATS && FORMATS[language]?.parent ? FORMATS[language]?.parent : language;
  ensureLanguageLoaded(prismLang);
  const grammar = prism_core_default.languages[prismLang];
  if (!grammar || typeof grammar !== "object") {
    return [];
  }
  let length = 0;
  let line = 1;
  let column = 1;
  function createTokenFromString(token, lang) {
    return [{ format: lang, type: "default", value: token, length: token.length }];
  }
  function createTokenFromFlatToken(token, lang) {
    return [{ format: lang, type: token.type, value: token.content, length: token.length }];
  }
  function createTokens(token, lang) {
    if (typeof token === "string")
      return createTokenFromString(token, lang);
    if (token.content && typeof token.content === "string")
      return createTokenFromFlatToken(token, lang);
    if (token.content && Array.isArray(token.content)) {
      const res = [];
      const rawAlias = token.alias ? token.alias.replace("language-", "") : null;
      const childLang = rawAlias && rawAlias in FORMATS ? rawAlias : lang;
      for (const t of token.content)
        for (const s of createTokens(t, childLang))
          res.push(s);
      return res;
    }
    return [];
  }
  function calcLoc(token) {
    const val = token.value;
    let newLines = 0;
    let lastLineLen = 0;
    if (typeof val === "string") {
      for (let i = 0;i < val.length; i++) {
        if (val[i] === `
`) {
          newLines++;
          lastLineLen = 0;
        } else {
          lastLineLen++;
        }
      }
    }
    const start = { line, column, position: length };
    column = newLines > 0 ? lastLineLen + 1 : column + (typeof val === "string" ? val.length : 0);
    token.loc = { start, end: { line: line + newLines, column, position: length } };
    token.range = [length, length + token.length];
    length += token.length;
    line += newLines;
    return token;
  }
  const tokens = [];
  for (const t of prism_core_default.tokenize(code, grammar)) {
    for (const s of createTokens(t, language))
      tokens.push(s);
  }
  return tokens.filter((t) => (t.format in FORMATS)).map((token, index) => calcLoc(token));
}
var SYNONYM_MAP = /* @__PURE__ */ new Map([
  ["node", "javascript"],
  ["shell", "bash"],
  ["zsh", "bash"],
  ["golang", "go"]
]);
function resolveFormat(lang) {
  const normalized = lang.toLowerCase();
  const tier1 = EXT_TO_FORMAT.get(normalized);
  if (tier1)
    return tier1;
  const synonym = SYNONYM_MAP.get(normalized);
  if (synonym)
    return synonym;
  if (normalized in FORMATS)
    return normalized;
  return null;
}
function blankRanges(source, ranges) {
  if (ranges.length === 0)
    return source;
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  for (let i = 1;i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (curr.start < prev.end) {
      throw new Error(`jscpd markdown tokenizer: overlapping ranges [${prev.start},${prev.end}] and [${curr.start},${curr.end}]`);
    }
  }
  let result = source;
  for (let i = sorted.length - 1;i >= 0; i--) {
    const { start, end } = sorted[i];
    const segment = source.slice(start, end);
    result = result.slice(0, start) + segment.replace(/[^\n\r]/g, " ") + result.slice(end);
  }
  return result;
}
function countNewlines4(s) {
  let count = 0;
  for (let i = 0;i < s.length; i++)
    if (s[i] === `
`)
      count++;
  return count;
}
function tokenizeMarkdown(source, id, options) {
  const normalized = source.replace(/\r\n/g, `
`);
  const { ignoreCase } = options;
  const allTokens = [];
  const ranges = [];
  const frontMatterRegex = /^---[ \t]*\n([\s\S]*?)\n(---|\.\.\.)[ \t]*(?:\n|$)/;
  const frontMatterMatch = frontMatterRegex.exec(normalized);
  if (frontMatterMatch) {
    const innerContent = frontMatterMatch[1] ?? "";
    if (innerContent.trim().length > 0) {
      const lineOffset = countNewlines4(normalized.substring(0, frontMatterMatch.index + `---
`.length));
      for (const token of tokenizeWithPrism(innerContent, "yaml")) {
        if (token.length > 0) {
          if (token.loc) {
            token.loc.start.line += lineOffset;
            token.loc.end.line += lineOffset;
          }
          allTokens.push(token);
        }
      }
    }
    ranges.push({ start: frontMatterMatch.index, end: frontMatterMatch.index + frontMatterMatch[0].length });
  }
  const lines = normalized.split(`
`);
  const lineStartPositions = [];
  let pos = 0;
  for (const line of lines) {
    lineStartPositions.push(pos);
    pos += line.length + 1;
  }
  const openingFenceRegex = /^(`{3,}|~{3,})(.*)$/;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fenceMatch = openingFenceRegex.exec(line);
    if (!fenceMatch) {
      i++;
      continue;
    }
    const openFenceStr = fenceMatch[1];
    const openFenceChar = openFenceStr[0];
    const openFenceLen = openFenceStr.length;
    const infoString = (fenceMatch[2] ?? "").trim();
    const langTag = infoString.split(/\s+/)[0] ?? "";
    const closingFenceRegex = new RegExp(`^${openFenceChar === "`" ? "`" : "~"}{${openFenceLen},}[ \\t]*$`);
    let closeLineIndex = -1;
    for (let j = i + 1;j < lines.length; j++) {
      if (closingFenceRegex.test(lines[j])) {
        closeLineIndex = j;
        break;
      }
    }
    if (closeLineIndex === -1) {
      i++;
      continue;
    }
    const resolvedFmt = langTag ? resolveFormat(langTag) : null;
    if (resolvedFmt) {
      const innerContent = lines.slice(i + 1, closeLineIndex).join(`
`);
      const lineOffset = i + 1;
      for (const token of tokenizeWithPrism(innerContent, resolvedFmt)) {
        if (token.length > 0) {
          if (token.loc) {
            token.loc.start.line += lineOffset;
            token.loc.end.line += lineOffset;
          }
          allTokens.push(token);
        }
      }
    }
    const rangeStart = lineStartPositions[i];
    const closingLineEnd = lineStartPositions[closeLineIndex] + lines[closeLineIndex].length + 1;
    ranges.push({ start: rangeStart, end: Math.min(closingLineEnd, normalized.length) });
    i = closeLineIndex + 1;
  }
  const sanitized = blankRanges(normalized, ranges);
  for (const token of tokenizeWithPrism(sanitized, "markdown")) {
    if (token.format === "markdown" && token.length > 0)
      allTokens.push(token);
  }
  allTokens.forEach((token, idx) => {
    if (token.loc) {
      token.loc.start.position = idx;
      token.loc.end.position = idx;
    }
  });
  let processedTokens = options.mode ? allTokens.filter((token) => options.mode(token, options)) : allTokens;
  if (ignoreCase) {
    processedTokens = processedTokens.map((token) => {
      token.value = token.value.toLocaleLowerCase();
      return token;
    });
  }
  return createTokensMaps(id, normalized, processedTokens, options);
}
var punctuation2 = {
  new_line: /\n/,
  empty: /[ \t\r\n\f\v]+/
};
var patchedLanguages2 = /* @__PURE__ */ new Set;
function ensureGrammarReady(prismName) {
  if (patchedLanguages2.has(prismName))
    return;
  ensureLanguageLoaded(prismName);
  const grammar = prism_core_default.languages[prismName];
  if (typeof grammar === "object" && grammar !== null) {
    prism_core_default.languages[prismName] = { ...grammar, ...punctuation2 };
  }
  patchedLanguages2.add(prismName);
}
function findIgnoreRegions(code) {
  const regions = [];
  const startMarker = "jscpd:ignore-start";
  const endMarker = "jscpd:ignore-end";
  let searchFrom = 0;
  while (true) {
    const startIdx = code.indexOf(startMarker, searchFrom);
    if (startIdx === -1)
      break;
    const lineStart = code.lastIndexOf(`
`, startIdx - 1) + 1;
    const endIdx = code.indexOf(endMarker, startIdx + startMarker.length);
    if (endIdx === -1)
      break;
    const nlAfterEnd = code.indexOf(`
`, endIdx + endMarker.length);
    const lineEnd = nlAfterEnd === -1 ? code.length : nlAfterEnd;
    regions.push([lineStart, lineEnd]);
    searchFrom = lineEnd;
  }
  return regions;
}
function getLanguagePrismName(lang) {
  if (lang in FORMATS && FORMATS[lang]?.parent) {
    return FORMATS[lang]?.parent;
  }
  return lang;
}
function tokenize2(code, language) {
  let length = 0;
  let line = 1;
  let column = 1;
  const ignoreRegions = findIgnoreRegions(code);
  function sanitizeLangName(name) {
    return name && name.replace ? name.replace("language-", "") : "unknown";
  }
  function createTokenFromString(token, lang) {
    return [
      {
        format: lang,
        type: "default",
        value: token,
        length: token.length
      }
    ];
  }
  function calculateLocation(token, position) {
    const result = token;
    const val = result.value;
    let newLines = 0;
    let lastLineLen = 0;
    if (typeof val === "string") {
      for (let i = 0;i < val.length; i++) {
        if (val[i] === `
`) {
          newLines++;
          lastLineLen = 0;
        } else {
          lastLineLen++;
        }
      }
    }
    const start = {
      line,
      column,
      position
    };
    column = newLines > 0 ? lastLineLen + 1 : column + (typeof val === "string" ? val.length : 0);
    const end = {
      line: line + newLines,
      column,
      position
    };
    result.loc = { start, end };
    result.range = [length, length + result.length];
    if (ignoreRegions.length > 0) {
      const tokenStart = result.range[0];
      const tokenEnd = result.range[1];
      for (const [rs, re] of ignoreRegions) {
        if (tokenStart < re && tokenEnd > rs) {
          result.type = "ignore";
          break;
        }
      }
    }
    length += result.length;
    line += newLines;
    return result;
  }
  function createTokenFromFlatToken(token, lang) {
    return [
      {
        format: lang,
        type: token.type,
        value: token.content,
        length: token.length
      }
    ];
  }
  function createTokens(token, lang) {
    if (typeof token === "string") {
      return createTokenFromString(token, lang);
    }
    if (token.content && typeof token.content === "string") {
      return createTokenFromFlatToken(token, lang);
    }
    if (token.content && Array.isArray(token.content)) {
      const res = [];
      const rawAlias = token.alias ? sanitizeLangName(token.alias) : null;
      const childLang = rawAlias && rawAlias in FORMATS ? rawAlias : lang;
      for (const t of token.content) {
        const sub = createTokens(t, childLang);
        for (const s of sub)
          res.push(s);
      }
      return res;
    }
    return [];
  }
  const tokens = [];
  const prismName = getLanguagePrismName(language);
  ensureGrammarReady(prismName);
  const grammar = prism_core_default.languages[prismName];
  if (!grammar || typeof grammar !== "object") {
    console.warn('Warn: jscpd has issue with support of "' + prismName + '"');
    return [];
  }
  for (const t of prism_core_default.tokenize(code, grammar)) {
    const sub = createTokens(t, language);
    for (const s of sub)
      tokens.push(s);
  }
  return tokens.filter((t) => (t.format in FORMATS)).map((token, index) => calculateLocation(token, index));
}
function setupIgnorePatterns(format, ignorePattern) {
  const language = getLanguagePrismName(format);
  const extraTokens = {};
  ignorePattern.forEach((pattern, i) => {
    extraTokens[`ignore_pattern_${i}`] = { pattern: new RegExp(pattern), greedy: false };
  });
  prism_core_default.languages[language] = {
    ...extraTokens,
    ...prism_core_default.languages[language]
  };
}
function createTokenMapBasedOnCode(id, data, format, options = {}) {
  if (format === "vue") {
    return tokenizeVue(data, id, options);
  }
  if (format === "astro") {
    return tokenizeAstro(data, id, options);
  }
  if (format === "svelte") {
    return tokenizeSvelte(data, id, options);
  }
  if (format === "markdown") {
    return tokenizeMarkdown(data, id, options);
  }
  const { mode, ignoreCase, ignorePattern } = options;
  const tokens = tokenize2(data, format).filter((token) => mode(token, options));
  if (ignorePattern)
    setupIgnorePatterns(format, options.ignorePattern || []);
  if (ignoreCase) {
    return createTokensMaps(id, data, tokens.map((token) => {
      token.value = token.value.toLocaleLowerCase();
      return token;
    }), options);
  }
  return createTokensMaps(id, data, tokens, options);
}
var Tokenizer = class {
  generateMaps(id, data, format, options) {
    return createTokenMapBasedOnCode(id, data, format, options);
  }
};

// src/jscpd-engine.ts
import { execFile } from "child_process";
import * as path from "path";
var import_ignore = __toESM(require_ignore(), 1);
var MAX_FILE_SIZE_BYTES = 100 * 1024;
var MAX_INDEXED_FILES = 1e4;
var MAX_TOTAL_SOURCE_BYTES = 64 * 1024 * 1024;
var MAX_GIT_PATHS = 1e4;
var DEFAULT_NOISE_PATTERNS = [
  "*.lock",
  "*.lockb",
  "*-lock.json",
  "*-lock.yaml",
  "*-lock.yml",
  "*.lock.json",
  "*.min.js",
  "*.min.css",
  "*.min.*",
  "*.bundle.js",
  "*.map",
  "*.generated.*",
  "*.designer.cs",
  "*.designer.vb",
  ".DS_Store",
  "node_modules"
];
var DEFAULT_NON_CODE_FORMATS = new Set([
  "abnf",
  "apacheconf",
  "arff",
  "asciidoc",
  "bnf",
  "comments",
  "csp",
  "csv",
  "diff",
  "dns-zone-file",
  "dot",
  "ebnf",
  "editorconfig",
  "excel-formula",
  "gedcom",
  "gettext",
  "git",
  "hpkp",
  "hsts",
  "http",
  "ignore",
  "ini",
  "json",
  "json5",
  "keymap",
  "latex",
  "log",
  "markdown",
  "mermaid",
  "nginx",
  "plant-uml",
  "properties",
  "regex",
  "rest",
  "roboconf",
  "shell-session",
  "sparql",
  "tap",
  "textile",
  "toml",
  "turtle",
  "txt",
  "uri",
  "url",
  "wiki",
  "yaml"
]);
function getSupportedCodeFormat(filePath, formatsExts) {
  const format = getFormatByFile(filePath, formatsExts);
  if (!format) {
    return;
  }
  if (formatsExts && format in formatsExts) {
    return format;
  }
  if (DEFAULT_NON_CODE_FORMATS.has(format)) {
    return;
  }
  if (format === "markup") {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".svg" || ext === ".xml" || ext === ".xsl" || ext === ".xslt") {
      return;
    }
  }
  return format;
}
var GENERATED_HEADER_MARKERS = [
  /@generated\b/i,
  /\bauto-generated\b/i,
  /\bautomatically generated\b/i,
  /\bGENERATED BY\b/i,
  /\bDO NOT EDIT\b/i,
  /\bDO NOT MODIFY\b/i,
  /<auto-generated\b/i,
  /<autogenerated\b/i
];
function execGit(args, cwd, options = {}) {
  const { promise, resolve: resolve2, reject } = Promise.withResolvers();
  execFile("git", args, {
    cwd,
    signal: options.signal,
    maxBuffer: options.maxBuffer,
    windowsHide: true
  }, (err, stdout, stderr) => {
    if (err)
      return reject(err);
    resolve2({ stdout: String(stdout), stderr: String(stderr) });
  });
  return promise;
}
function isGeneratedContent(content) {
  const head = content.slice(0, 2048);
  return GENERATED_HEADER_MARKERS.some((pattern) => pattern.test(head));
}
function createIgnoreFilter(userIgnorePatterns = []) {
  const ig = import_ignore.default().add(DEFAULT_NOISE_PATTERNS).add(userIgnorePatterns);
  return (relPath) => {
    if (!relPath || typeof relPath !== "string")
      return false;
    const normalized = relPath.trim().replace(/\\/g, "/").replace(/^\.\//, "");
    if (!normalized || normalized === ".")
      return false;
    if (normalized.startsWith("../") || normalized === ".." || normalized.startsWith("/") || path.isAbsolute(normalized)) {
      return false;
    }
    try {
      return ig.ignores(normalized);
    } catch {
      return false;
    }
  };
}
async function isInsideGitWorkTree(dir, signal) {
  try {
    const { stdout } = await execGit(["rev-parse", "--is-inside-work-tree"], dir, { signal });
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}
async function getTrackedGitFiles(rootDir, options = {}) {
  if (!await isInsideGitWorkTree(rootDir, options.signal)) {
    return [];
  }
  const maxPaths = options.maxPaths ?? MAX_GIT_PATHS;
  const baseIgnore = import_ignore.default().add(DEFAULT_NOISE_PATTERNS).add(options.userIgnorePatterns ?? []);
  try {
    const { stdout } = await execGit(["ls-files", "--cached", "-z", "--", "."], rootDir, {
      signal: options.signal,
      maxBuffer: 16 * 1024 * 1024
    });
    const entries = stdout.split("\x00");
    const results = [];
    for (const entry of entries) {
      if (options.signal?.aborted)
        break;
      const trimmed = entry.trim();
      if (!trimmed)
        continue;
      if (results.length >= maxPaths)
        break;
      const relPath = trimmed.replace(/\\/g, "/").replace(/^\.\//, "");
      if (!relPath || relPath === ".." || relPath.startsWith("../") || relPath.startsWith("/") || path.isAbsolute(relPath)) {
        continue;
      }
      try {
        if (baseIgnore.ignores(relPath))
          continue;
      } catch {}
      results.push(path.resolve(rootDir, trimmed));
    }
    return results;
  } catch {
    return [];
  }
}
var DEFAULT_MAX_INLINE_BYTES = 50 * 1024;

// src/source-aware-index.ts
var fastTokenHash = (val) => Bun.hash(val).toString(16).padStart(20, "0");
function reconstructFramesFromTokens(tokens, sourceId, minTokens, hashFunction = fastTokenHash) {
  const tokenCount = tokens.length;
  const frameCount = Math.max(0, tokenCount - minTokens);
  const hashMap = tokens.map((t) => t.hash).join("");
  const TOKEN_HASH_LEN = 20;
  const frames = new Array(frameCount);
  for (let i = 0;i < frameCount; i++) {
    const windowSub = hashMap.substring(i * TOKEN_HASH_LEN, (i + minTokens) * TOKEN_HASH_LEN);
    const windowHash = hashFunction(windowSub).substring(0, TOKEN_HASH_LEN);
    const startTok = tokens[i];
    const endTok = tokens[i + minTokens];
    const startLine = startTok.line;
    const startCol = startTok.column;
    const startPos = startTok.position;
    const startRange0 = startTok.range[0];
    const endLine = endTok.line;
    const endCol = endTok.column;
    const endPos = endTok.position;
    const endRange1 = endTok.range[1];
    frames[i] = {
      id: windowHash,
      sourceId,
      start: {
        line: startLine,
        column: startCol,
        position: startPos,
        range: [startRange0, startRange0],
        loc: {
          start: { line: startLine, column: startCol, position: startPos },
          end: { line: startLine, column: startCol, position: startPos }
        }
      },
      end: {
        line: endLine,
        column: endCol,
        position: endPos,
        range: [endRange1, endRange1],
        loc: {
          start: { line: endLine, column: endCol, position: endPos },
          end: { line: endLine, column: endCol, position: endPos }
        }
      }
    };
  }
  return frames;
}
class SourceAwareCloneIndex {
  framesByHash = new Map;
  hashesBySource = new Map;
  sources = new Map;
  #framesBySource = new Map;
  #tokensBySource = new Map;
  clones = [];
  #tokenizer;
  #options;
  #minTokens;
  #minLines;
  #maxLines;
  #formatsExts;
  #hashFunction;
  constructor(options = {}) {
    this.#tokenizer = new Tokenizer;
    this.#minTokens = options.minTokens ?? 40;
    this.#minLines = options.minLines ?? 5;
    this.#maxLines = options.maxLines ?? 500;
    this.#formatsExts = options.formatsExts ?? {};
    this.#hashFunction = options.hashFunction ?? fastTokenHash;
    const baseDefaults = getDefaultOptions();
    this.#options = {
      ...baseDefaults,
      mode: baseDefaults.mode || mild,
      minTokens: this.#minTokens,
      minLines: this.#minLines,
      maxLines: this.#maxLines,
      formatsExts: this.#formatsExts,
      hashFunction: this.#hashFunction
    };
  }
  get minTokens() {
    return this.#minTokens;
  }
  get minLines() {
    return this.#minLines;
  }
  get maxLines() {
    return this.#maxLines;
  }
  get hashFunction() {
    return this.#hashFunction;
  }
  get discoveredClones() {
    return this.clones.slice();
  }
  hasSource(sourceId) {
    return this.sources.has(sourceId);
  }
  getSource(sourceId) {
    return this.sources.get(sourceId);
  }
  getClones() {
    return this.clones.slice();
  }
  stats() {
    let totalTokens = 0;
    for (const meta of this.sources.values()) {
      totalTokens += meta.tokenCount;
    }
    return {
      sourceCount: this.sources.size,
      hashCount: this.framesByHash.size,
      totalTokens
    };
  }
  reset() {
    this.framesByHash.clear();
    this.hashesBySource.clear();
    this.sources.clear();
    this.#framesBySource.clear();
    this.#tokensBySource.clear();
    this.clones = [];
  }
  addSource(sourceId, content, format) {
    if (this.sources.has(sourceId)) {
      this.removeSource(sourceId);
    }
    const tokenData = this.#generateTokenMaps(sourceId, content, format);
    if (!tokenData) {
      return [];
    }
    const hashes = new Set;
    const sourceFrames = [];
    const sourceTokens = [];
    const TOKEN_HASH_LEN = 20;
    for (const tokenMap of tokenData.maps) {
      const mapTokens = tokenMap.tokens;
      const hashMap = tokenMap.hashMap;
      if (Array.isArray(mapTokens) && typeof hashMap === "string") {
        for (let i = 0;i < mapTokens.length; i++) {
          const t = mapTokens[i];
          const hash2 = hashMap.substring(i * TOKEN_HASH_LEN, (i + 1) * TOKEN_HASH_LEN);
          sourceTokens.push({
            hash: hash2,
            line: t.loc?.start.line ?? t.line ?? 1,
            column: t.loc?.start.column ?? t.column ?? 1,
            position: t.loc?.start.position ?? t.position ?? i,
            range: t.range ? [t.range[0], t.range[1]] : [0, 0]
          });
        }
      }
      while (true) {
        const nextResult = tokenMap.next();
        if (nextResult.done || !nextResult.value || typeof nextResult.value === "boolean") {
          break;
        }
        sourceFrames.push(nextResult.value);
      }
    }
    const newClones = this.#detectClonesFromFrames(sourceFrames, sourceId, tokenData.format, {
      insertFrames: true,
      hashes
    });
    let totalTokens = 0;
    let totalLines = 0;
    for (const map of tokenData.maps) {
      totalTokens += map.getTokensCount();
      totalLines += map.getLinesCount();
    }
    this.hashesBySource.set(sourceId, hashes);
    this.#framesBySource.set(sourceId, sourceFrames);
    if (sourceTokens.length > 0) {
      this.#tokensBySource.set(sourceId, sourceTokens);
    }
    this.sources.set(sourceId, {
      sourceId,
      format: tokenData.format,
      size: content.length,
      lines: totalLines || content.split(/\r?\n/).length,
      tokenCount: totalTokens,
      updatedAt: Date.now()
    });
    this.clones.push(...newClones);
    return newClones;
  }
  exportSourceShard(sourceId, contentHash) {
    const meta = this.sources.get(sourceId);
    const tokens = this.#tokensBySource.get(sourceId);
    const frames = this.#framesBySource.get(sourceId);
    if (!meta || !tokens && !frames) {
      return null;
    }
    const minTokens = this.#minTokens;
    const exportedTokens = tokens ? tokens.slice() : undefined;
    const fallbackFrames = frames ? frames.slice() : [];
    const hashFn = this.#hashFunction;
    let memoizedFrames = fallbackFrames.length > 0 ? fallbackFrames : null;
    return {
      version: 1,
      sourceId: meta.sourceId,
      contentHash,
      format: meta.format,
      size: meta.size,
      lines: meta.lines,
      tokenCount: meta.tokenCount,
      minTokens,
      updatedAt: meta.updatedAt,
      tokens: exportedTokens,
      get frames() {
        if (!memoizedFrames) {
          if (exportedTokens && exportedTokens.length > 0) {
            memoizedFrames = reconstructFramesFromTokens(exportedTokens, meta.sourceId, minTokens, hashFn);
          } else {
            memoizedFrames = [];
          }
        }
        return memoizedFrames;
      }
    };
  }
  tokenizeSource(sourceId, content, contentHash = "", format) {
    const resolvedFormat = format ?? getSupportedCodeFormat(sourceId, this.#formatsExts);
    if (!resolvedFormat) {
      return null;
    }
    let maps;
    try {
      maps = this.#tokenizer.generateMaps(sourceId, content, resolvedFormat, this.#options);
    } catch {
      return null;
    }
    if (!maps || maps.length === 0) {
      return null;
    }
    const sourceFrames = [];
    const sourceTokens = [];
    const TOKEN_HASH_LEN = 20;
    for (const tokenMap of maps) {
      const mapTokens = tokenMap.tokens;
      const hashMap = tokenMap.hashMap;
      if (Array.isArray(mapTokens) && typeof hashMap === "string") {
        for (let i = 0;i < mapTokens.length; i++) {
          const t = mapTokens[i];
          const hash2 = hashMap.substring(i * TOKEN_HASH_LEN, (i + 1) * TOKEN_HASH_LEN);
          sourceTokens.push({
            hash: hash2,
            line: t.loc?.start.line ?? t.line ?? 1,
            column: t.loc?.start.column ?? t.column ?? 1,
            position: t.loc?.start.position ?? t.position ?? i,
            range: t.range ? [t.range[0], t.range[1]] : [0, 0]
          });
        }
      }
      while (true) {
        const nextResult = tokenMap.next();
        if (nextResult.done || !nextResult.value || typeof nextResult.value === "boolean") {
          break;
        }
        sourceFrames.push(nextResult.value);
      }
    }
    let totalTokens = 0;
    let totalLines = 0;
    for (const map of maps) {
      totalTokens += map.getTokensCount();
      totalLines += map.getLinesCount();
    }
    return {
      version: 1,
      sourceId,
      contentHash,
      format: resolvedFormat,
      size: content.length,
      lines: totalLines || content.split(/\r?\n/).length,
      tokenCount: totalTokens,
      minTokens: this.#minTokens,
      updatedAt: Date.now(),
      tokens: sourceTokens,
      frames: sourceFrames
    };
  }
  hydrateSourceShard(shard) {
    const { sourceId, format, size, lines, tokenCount } = shard;
    if (this.sources.has(sourceId)) {
      this.removeSource(sourceId);
    }
    let normalizedFrames;
    const shardTokens = shard.tokens;
    if (shard.frames && shard.frames.length > 0) {
      normalizedFrames = shard.frames[0]?.sourceId === sourceId ? shard.frames : shard.frames.map((f) => f.sourceId === sourceId ? f : { ...f, sourceId });
    } else if (shardTokens && shardTokens.length > 0) {
      normalizedFrames = reconstructFramesFromTokens(shardTokens, sourceId, this.#minTokens, this.#hashFunction);
    } else {
      normalizedFrames = [];
    }
    const hashes = new Set;
    const newClones = this.#detectClonesFromFrames(normalizedFrames, sourceId, format, {
      insertFrames: true,
      hashes
    });
    this.hashesBySource.set(sourceId, hashes);
    if (shardTokens && shardTokens.length > 0) {
      this.#tokensBySource.set(sourceId, shardTokens);
    }
    this.#framesBySource.set(sourceId, normalizedFrames);
    this.sources.set(sourceId, {
      sourceId,
      format,
      size,
      lines,
      tokenCount,
      updatedAt: shard.updatedAt ?? Date.now()
    });
    this.clones.push(...newClones);
    return newClones;
  }
  removeSource(sourceId) {
    if (!this.sources.has(sourceId)) {
      return;
    }
    const hashes = this.hashesBySource.get(sourceId);
    if (hashes) {
      for (const hash2 of hashes) {
        const entry = this.framesByHash.get(hash2);
        if (!entry) {
          continue;
        }
        if (Array.isArray(entry)) {
          const remaining = entry.filter((f) => f.sourceId !== sourceId);
          if (remaining.length === 0) {
            this.framesByHash.delete(hash2);
          } else if (remaining.length === 1) {
            this.framesByHash.set(hash2, remaining[0]);
          } else {
            this.framesByHash.set(hash2, remaining);
          }
        } else if (entry.sourceId === sourceId) {
          this.framesByHash.delete(hash2);
        }
      }
      this.hashesBySource.delete(sourceId);
    }
    this.#framesBySource.delete(sourceId);
    this.#tokensBySource.delete(sourceId);
    this.sources.delete(sourceId);
    this.clones = this.clones.filter((c) => c.duplicationA.sourceId !== sourceId && c.duplicationB.sourceId !== sourceId);
  }
  updateSource(sourceId, content, format) {
    this.removeSource(sourceId);
    return this.addSource(sourceId, content, format);
  }
  checkSnippet(sourceId, content, format) {
    const tokenData = this.#generateTokenMaps(sourceId, content, format);
    if (!tokenData) {
      return [];
    }
    const sourceFrames = [];
    for (const tokenMap of tokenData.maps) {
      while (true) {
        const nextResult = tokenMap.next();
        if (nextResult.done || !nextResult.value || typeof nextResult.value === "boolean") {
          break;
        }
        sourceFrames.push(nextResult.value);
      }
    }
    return this.#detectClonesFromFrames(sourceFrames, sourceId, tokenData.format, {
      insertFrames: false
    });
  }
  #generateTokenMaps(sourceId, content, format) {
    const resolvedFormat = format ?? getSupportedCodeFormat(sourceId, this.#formatsExts);
    if (!resolvedFormat) {
      return null;
    }
    try {
      const maps = this.#tokenizer.generateMaps(sourceId, content, resolvedFormat, this.#options);
      return maps && maps.length > 0 ? { format: resolvedFormat, maps } : null;
    } catch {
      return null;
    }
  }
  #detectClonesFromFrames(frames, sourceId, format, options = {}) {
    const detectedClones = [];
    const { insertFrames = false, hashes } = options;
    let activeClones = new Map;
    for (const frame of frames) {
      const normalizedFrame = frame.sourceId === sourceId ? frame : {
        ...frame,
        sourceId
      };
      const frameHash = normalizedFrame.id;
      if (hashes) {
        hashes.add(frameHash);
      }
      const candidates = this.framesByHash.get(frameHash);
      if (!candidates && activeClones.size === 0) {
        if (insertFrames) {
          this.#insertFrame(frameHash, normalizedFrame);
        }
        continue;
      }
      const matchedFrames = candidates ? Array.isArray(candidates) ? candidates : [candidates] : [];
      if (matchedFrames.length === 0 && activeClones.size === 0) {
        if (insertFrames) {
          this.#insertFrame(frameHash, normalizedFrame);
        }
        continue;
      }
      if (matchedFrames.length === 0) {
        for (const active of activeClones.values()) {
          if (this.#validateClone(active.clone)) {
            detectedClones.push(active.clone);
          }
        }
        activeClones.clear();
        if (insertFrames) {
          this.#insertFrame(frameHash, normalizedFrame);
        }
        continue;
      }
      const nextActiveClones = new Map;
      const frameStartLine = normalizedFrame.start.loc?.start.line ?? normalizedFrame.start.line ?? 1;
      const frameStartCol = normalizedFrame.start.loc?.start.column ?? normalizedFrame.start.column ?? 1;
      const frameStartPos = normalizedFrame.start.loc?.start.position ?? normalizedFrame.start.position;
      const frameEndLine = normalizedFrame.end.loc?.end.line ?? normalizedFrame.end.line ?? frameStartLine;
      const frameEndCol = normalizedFrame.end.loc?.end.column ?? normalizedFrame.end.column ?? frameStartCol;
      const frameEndPos = normalizedFrame.end.loc?.end.position ?? normalizedFrame.end.position;
      for (const targetFrame of matchedFrames) {
        const targetStartLine = targetFrame.start.loc?.start.line ?? targetFrame.start.line ?? 1;
        const targetStartCol = targetFrame.start.loc?.start.column ?? targetFrame.start.column ?? 1;
        const targetStartPos = targetFrame.start.loc?.start.position ?? targetFrame.start.position;
        const targetEndLine = targetFrame.end.loc?.end.line ?? targetFrame.end.line ?? targetStartLine;
        const targetEndCol = targetFrame.end.loc?.end.column ?? targetFrame.end.column ?? targetStartCol;
        const targetEndPos = targetFrame.end.loc?.end.position ?? targetFrame.end.position;
        if (targetFrame.sourceId === sourceId && targetStartLine === frameStartLine && targetStartCol === frameStartCol) {
          continue;
        }
        const offsetKey = `${targetFrame.sourceId}:${targetFrame.start.range[0] - normalizedFrame.start.range[0]}`;
        if (activeClones.has(offsetKey)) {
          const candidate = activeClones.get(offsetKey);
          if (candidate.clone.duplicationA.range) {
            candidate.clone.duplicationA.range[1] = normalizedFrame.end.range[1];
          }
          candidate.clone.duplicationA.end = {
            line: frameEndLine,
            column: frameEndCol,
            position: frameEndPos
          };
          if (candidate.clone.duplicationB.range) {
            candidate.clone.duplicationB.range[1] = targetFrame.end.range[1];
          }
          candidate.clone.duplicationB.end = {
            line: targetEndLine,
            column: targetEndCol,
            position: targetEndPos
          };
          candidate.lastSourceEndRange = normalizedFrame.end.range[1];
          candidate.lastTargetEndRange = targetFrame.end.range[1];
          nextActiveClones.set(offsetKey, candidate);
        } else {
          const clone2 = {
            format,
            foundDate: Date.now(),
            duplicationA: {
              sourceId,
              start: {
                line: frameStartLine,
                column: frameStartCol,
                position: frameStartPos
              },
              end: {
                line: frameEndLine,
                column: frameEndCol,
                position: frameEndPos
              },
              range: [
                normalizedFrame.start.range[0],
                normalizedFrame.end.range[1]
              ]
            },
            duplicationB: {
              sourceId: targetFrame.sourceId,
              start: {
                line: targetStartLine,
                column: targetStartCol,
                position: targetStartPos
              },
              end: {
                line: targetEndLine,
                column: targetEndCol,
                position: targetEndPos
              },
              range: [targetFrame.start.range[0], targetFrame.end.range[1]]
            }
          };
          nextActiveClones.set(offsetKey, {
            clone: clone2,
            targetFrame,
            lastSourceEndRange: normalizedFrame.end.range[1],
            lastTargetEndRange: targetFrame.end.range[1]
          });
        }
      }
      if (activeClones.size > 0) {
        for (const [key, active] of activeClones.entries()) {
          if (!nextActiveClones.has(key)) {
            if (this.#validateClone(active.clone)) {
              detectedClones.push(active.clone);
            }
          }
        }
      }
      activeClones = nextActiveClones;
      if (insertFrames) {
        this.#insertFrame(frameHash, normalizedFrame);
      }
    }
    for (const active of activeClones.values()) {
      if (this.#validateClone(active.clone)) {
        detectedClones.push(active.clone);
      }
    }
    return detectedClones;
  }
  #insertFrame(hash2, frame) {
    const existing = this.framesByHash.get(hash2);
    if (!existing) {
      this.framesByHash.set(hash2, frame);
      return;
    }
    if (Array.isArray(existing)) {
      const alreadyPresent = existing.some((f) => f.sourceId === frame.sourceId && f.start.range[0] === frame.start.range[0]);
      if (!alreadyPresent) {
        existing.push(frame);
      }
    } else {
      if (existing.sourceId !== frame.sourceId || existing.start.range[0] !== frame.start.range[0]) {
        this.framesByHash.set(hash2, [existing, frame]);
      }
    }
  }
  #validateClone(clone2) {
    const lines = clone2.duplicationA.end.line - clone2.duplicationA.start.line + 1;
    if (lines < this.#minLines) {
      return false;
    }
    if (this.#maxLines && lines > this.#maxLines) {
      return false;
    }
    return true;
  }
}

// src/disk-cache.ts
var DEFAULT_MAX_CACHE_BYTES = 250 * 1024 * 1024;
function getDefaultCacheDir() {
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      return path2.join(localAppData, "omp", "duplicate-detector");
    }
    return path2.join(os.homedir(), "AppData", "Local", "omp", "duplicate-detector");
  }
  const xdgCacheHome = process.env.XDG_CACHE_HOME;
  if (xdgCacheHome) {
    return path2.join(xdgCacheHome, "omp", "duplicate-detector");
  }
  return path2.join(os.homedir(), ".cache", "omp", "duplicate-detector");
}
function computeConfigFingerprint(config) {
  if (!config)
    return "default";
  let sortedFormats;
  if (config.formatsExts) {
    sortedFormats = {};
    for (const key of Object.keys(config.formatsExts).sort()) {
      sortedFormats[key] = (config.formatsExts[key] ?? []).slice().sort();
    }
  }
  const canonical = {
    minTokens: config.minTokens ?? 40,
    minLines: config.minLines ?? 5,
    maxLines: config.maxLines ?? 500,
    crossFormats: config.crossFormats ?? false,
    formatsExts: sortedFormats
  };
  return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex").slice(0, 16);
}
function computeWorkspaceCachePath(baseDir, rootDir, configFingerprint) {
  const canonicalPath = path2.resolve(rootDir);
  const workspaceHash = crypto.createHash("sha256").update(canonicalPath).digest("hex").slice(0, 16);
  return path2.join(baseDir, `${workspaceHash}_${configFingerprint}.sqlite`);
}
var CACHE_FORMAT_MAGIC = "DUP3";
var CACHE_FORMAT_VERSION = 3;
function packBinaryShard(shard) {
  return packBinaryShardV3(shard, shard.tokens ?? []);
}
function packBinaryShardV3(shard, tokens) {
  const srcIdBuf = Buffer.from(shard.sourceId, "utf8");
  const formatBuf = Buffer.from(shard.format, "utf8");
  const hashBuf = Buffer.from(shard.contentHash, "utf8");
  const tokenCount = tokens.length;
  const minTokens = shard.minTokens ?? 40;
  const dict = new Map;
  const tokenIndices = new Uint16Array(tokenCount);
  for (let i = 0;i < tokenCount; i++) {
    const h = tokens[i].hash;
    let idx = dict.get(h);
    if (idx === undefined) {
      idx = dict.size;
      dict.set(h, idx);
    }
    tokenIndices[i] = idx;
  }
  const dictCount = dict.size;
  const dictPayloadLen = dictCount * 10;
  const columnsPayloadLen = tokenCount * (2 + 2 + 2 + 4 + 2);
  const headerLen = 4 + 2 + 2 + formatBuf.length + 2 + hashBuf.length + 4 + 4 + 4 + 8 + 2 + 2 + srcIdBuf.length + 2 + 4;
  const buf = Buffer.allocUnsafe(headerLen + dictPayloadLen + columnsPayloadLen);
  let pos = 0;
  buf.write("DUP3", pos, 4, "ascii");
  pos += 4;
  buf.writeUInt16LE(3, pos);
  pos += 2;
  buf.writeUInt16LE(formatBuf.length, pos);
  pos += 2;
  formatBuf.copy(buf, pos);
  pos += formatBuf.length;
  buf.writeUInt16LE(hashBuf.length, pos);
  pos += 2;
  hashBuf.copy(buf, pos);
  pos += hashBuf.length;
  buf.writeUInt32LE(shard.size, pos);
  pos += 4;
  buf.writeUInt32LE(shard.lines, pos);
  pos += 4;
  buf.writeUInt32LE(shard.tokenCount, pos);
  pos += 4;
  buf.writeDoubleLE(shard.updatedAt ?? Date.now(), pos);
  pos += 8;
  buf.writeUInt16LE(minTokens, pos);
  pos += 2;
  buf.writeUInt16LE(srcIdBuf.length, pos);
  pos += 2;
  srcIdBuf.copy(buf, pos);
  pos += srcIdBuf.length;
  buf.writeUInt16LE(dictCount, pos);
  pos += 2;
  buf.writeUInt32LE(tokenCount, pos);
  pos += 4;
  for (const h of dict.keys()) {
    const hexHash = h.length === 20 ? h : h.padEnd(20, "0");
    buf.write(hexHash, pos, 10, "hex");
    pos += 10;
  }
  const dictIdxOffset = pos;
  const deltaLineOffset = dictIdxOffset + tokenCount * 2;
  const colOffset = deltaLineOffset + tokenCount * 2;
  const deltaRangeOffset = colOffset + tokenCount * 2;
  const lenOffset = deltaRangeOffset + tokenCount * 4;
  let prevLine = 1;
  let prevRangeStart = 0;
  for (let i = 0;i < tokenCount; i++) {
    const t = tokens[i];
    const curLine = t.line;
    const curCol = t.column;
    const curRange0 = t.range[0];
    const curRange1 = t.range[1];
    const tokLen = Math.max(0, curRange1 - curRange0);
    buf.writeUInt16LE(tokenIndices[i], dictIdxOffset + i * 2);
    buf.writeUInt16LE(Math.min(65535, Math.max(0, curLine - prevLine)), deltaLineOffset + i * 2);
    buf.writeUInt16LE(Math.min(65535, Math.max(0, curCol)), colOffset + i * 2);
    buf.writeUInt32LE(Math.max(0, curRange0 - prevRangeStart), deltaRangeOffset + i * 4);
    buf.writeUInt16LE(Math.min(65535, tokLen), lenOffset + i * 2);
    prevLine = curLine;
    prevRangeStart = curRange0;
  }
  pos = lenOffset + tokenCount * 2;
  return zlib.deflateRawSync(buf.subarray(0, pos));
}
function unpackBinaryShard(compressed) {
  try {
    const buf = zlib.inflateRawSync(compressed);
    if (buf.length < 6)
      return null;
    const magic = buf.toString("ascii", 0, 4);
    if (magic !== CACHE_FORMAT_MAGIC) {
      return null;
    }
    return unpackBinaryShardV3(buf);
  } catch {
    return null;
  }
}
function unpackBinaryShardV3(buf) {
  let pos = 4;
  const version = buf.readUInt16LE(pos);
  pos += 2;
  if (version !== 3)
    return null;
  const formatLen = buf.readUInt16LE(pos);
  pos += 2;
  const format = buf.toString("utf8", pos, pos + formatLen);
  pos += formatLen;
  const hashLen = buf.readUInt16LE(pos);
  pos += 2;
  const contentHash = buf.toString("utf8", pos, pos + hashLen);
  pos += hashLen;
  const size = buf.readUInt32LE(pos);
  pos += 4;
  const lines = buf.readUInt32LE(pos);
  pos += 4;
  const tokenCount = buf.readUInt32LE(pos);
  pos += 4;
  const updatedAt = buf.readDoubleLE(pos);
  pos += 8;
  const minTokens = buf.readUInt16LE(pos);
  pos += 2;
  const srcLen = buf.readUInt16LE(pos);
  pos += 2;
  const sourceId = buf.toString("utf8", pos, pos + srcLen);
  pos += srcLen;
  const dictCount = buf.readUInt16LE(pos);
  pos += 2;
  const tokensPayloadCount = buf.readUInt32LE(pos);
  pos += 4;
  const dict = new Array(dictCount);
  for (let i = 0;i < dictCount; i++) {
    dict[i] = buf.toString("hex", pos, pos + 10);
    pos += 10;
  }
  const dictIdxOffset = pos;
  const deltaLineOffset = dictIdxOffset + tokensPayloadCount * 2;
  const colOffset = deltaLineOffset + tokensPayloadCount * 2;
  const deltaRangeOffset = colOffset + tokensPayloadCount * 2;
  const lenOffset = deltaRangeOffset + tokensPayloadCount * 4;
  const tokens = new Array(tokensPayloadCount);
  let prevLine = 1;
  let prevRangeStart = 0;
  for (let i = 0;i < tokensPayloadCount; i++) {
    const dictIdx = buf.readUInt16LE(dictIdxOffset + i * 2);
    const hash2 = dict[dictIdx] || "";
    const deltaLine = buf.readUInt16LE(deltaLineOffset + i * 2);
    const col = buf.readUInt16LE(colOffset + i * 2);
    const deltaRange = buf.readUInt32LE(deltaRangeOffset + i * 4);
    const tokLen = buf.readUInt16LE(lenOffset + i * 2);
    const line = prevLine + deltaLine;
    const rangeStart = prevRangeStart + deltaRange;
    const rangeEnd = rangeStart + tokLen;
    tokens[i] = {
      hash: hash2,
      line,
      column: col,
      position: i,
      range: [rangeStart, rangeEnd]
    };
    prevLine = line;
    prevRangeStart = rangeStart;
  }
  let memoizedFrames = null;
  return {
    version: 1,
    sourceId,
    contentHash,
    format,
    size,
    lines,
    tokenCount,
    minTokens,
    updatedAt,
    tokens,
    get frames() {
      if (!memoizedFrames) {
        memoizedFrames = reconstructFramesFromTokens(tokens, sourceId, minTokens || 40);
      }
      return memoizedFrames;
    }
  };
}

class DiskCacheManager {
  rootDir;
  baseCacheDir;
  dbPath;
  workspaceCacheDir;
  configFingerprint;
  maxBytes;
  #db = null;
  #getStmt = null;
  #saveStmt = null;
  #updateMtimeStmt = null;
  #deleteStmt = null;
  #totalSizeStmt = null;
  #oldestShardsStmt = null;
  #deleteAllStmt = null;
  #closed = false;
  constructor(options) {
    this.rootDir = path2.resolve(options.rootDir);
    this.baseCacheDir = options.cacheDir ? path2.resolve(options.cacheDir) : getDefaultCacheDir();
    this.configFingerprint = computeConfigFingerprint(options.config);
    this.dbPath = computeWorkspaceCachePath(this.baseCacheDir, this.rootDir, this.configFingerprint);
    this.workspaceCacheDir = this.baseCacheDir;
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_CACHE_BYTES;
  }
  #getDb() {
    if (this.#closed)
      return null;
    if (this.#db)
      return this.#db;
    try {
      const dir = path2.dirname(this.dbPath);
      if (!fsSync.existsSync(dir)) {
        fsSync.mkdirSync(dir, { recursive: true });
      }
      const db = new Database(this.dbPath, { create: true });
      db.exec("PRAGMA journal_mode = WAL;");
      db.exec("PRAGMA synchronous = NORMAL;");
      db.exec("PRAGMA temp_store = MEMORY;");
      const versionRow = db.query("PRAGMA user_version;").get();
      const schemaVersion = versionRow?.user_version ?? 0;
      if (schemaVersion !== CACHE_FORMAT_VERSION) {
        db.exec("DROP TABLE IF EXISTS shards;");
        db.exec(`PRAGMA user_version = ${CACHE_FORMAT_VERSION};`);
      }
      db.exec(`
				CREATE TABLE IF NOT EXISTS shards (
					rel_path TEXT NOT NULL PRIMARY KEY,
					content_hash TEXT NOT NULL,
					payload BLOB NOT NULL,
					mtime REAL NOT NULL
				);
				CREATE INDEX IF NOT EXISTS idx_shards_content_hash ON shards(content_hash);
				CREATE INDEX IF NOT EXISTS idx_shards_mtime ON shards(mtime);
			`);
      this.#getStmt = db.prepare("SELECT payload, content_hash FROM shards WHERE rel_path = ?1");
      this.#saveStmt = db.prepare(`
				INSERT INTO shards (rel_path, content_hash, payload, mtime)
				VALUES (?1, ?2, ?3, ?4)
				ON CONFLICT(rel_path) DO UPDATE SET
					content_hash = excluded.content_hash,
					payload = excluded.payload,
					mtime = excluded.mtime
			`);
      this.#updateMtimeStmt = db.prepare("UPDATE shards SET mtime = ?1 WHERE rel_path = ?2");
      this.#deleteStmt = db.prepare("DELETE FROM shards WHERE rel_path = ?1");
      this.#totalSizeStmt = db.prepare("SELECT COALESCE(SUM(LENGTH(payload)), 0) as total FROM shards");
      this.#oldestShardsStmt = db.prepare("SELECT rel_path, LENGTH(payload) as size FROM shards ORDER BY mtime ASC");
      this.#deleteAllStmt = db.prepare("DELETE FROM shards");
      this.#db = db;
      return db;
    } catch {
      return null;
    }
  }
  async getShard(relPath, contentHash) {
    try {
      const db = this.#getDb();
      if (!db || !this.#getStmt)
        return null;
      const normalizedRelPath = relPath.replace(/\\/g, "/");
      const row = this.#getStmt.get(normalizedRelPath);
      if (!row || row.content_hash !== contentHash) {
        return null;
      }
      const payloadBuf = Buffer.isBuffer(row.payload) ? row.payload : Buffer.from(row.payload.buffer, row.payload.byteOffset, row.payload.byteLength);
      const shard = unpackBinaryShard(payloadBuf);
      if (shard && shard.contentHash === contentHash && typeof shard.sourceId === "string" && Array.isArray(shard.frames)) {
        try {
          this.#updateMtimeStmt?.run(Date.now(), normalizedRelPath);
        } catch {}
        return shard;
      }
      try {
        this.#deleteStmt?.run(normalizedRelPath);
      } catch {}
      return null;
    } catch {
      return null;
    }
  }
  async saveShard(shard, relPath) {
    try {
      const db = this.#getDb();
      if (!db || !this.#saveStmt)
        return;
      const targetRelPath = relPath ?? (path2.isAbsolute(shard.sourceId) ? path2.relative(this.rootDir, shard.sourceId) : shard.sourceId);
      const normalizedRelPath = targetRelPath.replace(/\\/g, "/");
      const payload = packBinaryShard(shard);
      this.#saveStmt.run(normalizedRelPath, shard.contentHash, payload, Date.now());
    } catch {}
  }
  async prune(maxBytes) {
    const budget = maxBytes !== undefined ? maxBytes : this.maxBytes;
    try {
      const db = this.#getDb();
      if (!db)
        return;
      if (budget <= 0) {
        this.#deleteAllStmt?.run();
        try {
          db.exec("VACUUM;");
        } catch {}
        return;
      }
      const totalRow = this.#totalSizeStmt?.get();
      let totalSize = totalRow?.total ?? 0;
      if (totalSize <= budget) {
        return;
      }
      const oldestShards = this.#oldestShardsStmt?.all() ?? [];
      let deletedAny = false;
      for (const entry of oldestShards) {
        if (totalSize <= budget) {
          break;
        }
        try {
          this.#deleteStmt?.run(entry.rel_path);
          totalSize -= entry.size;
          deletedAny = true;
        } catch {}
      }
      if (deletedAny) {
        try {
          db.exec("VACUUM;");
        } catch {}
      }
    } catch {}
  }
  async clear() {
    try {
      if (this.#db) {
        try {
          this.#db.close();
        } catch {}
        this.#db = null;
        this.#getStmt = null;
        this.#saveStmt = null;
        this.#updateMtimeStmt = null;
        this.#deleteStmt = null;
        this.#totalSizeStmt = null;
        this.#oldestShardsStmt = null;
        this.#deleteAllStmt = null;
      }
      await fs.unlink(this.dbPath).catch(() => {});
      await fs.unlink(`${this.dbPath}-wal`).catch(() => {});
      await fs.unlink(`${this.dbPath}-shm`).catch(() => {});
    } catch {}
  }
  close() {
    this.#closed = true;
    if (this.#db) {
      try {
        this.#db.close();
      } catch {}
      this.#db = null;
      this.#getStmt = null;
      this.#saveStmt = null;
      this.#updateMtimeStmt = null;
      this.#deleteStmt = null;
      this.#totalSizeStmt = null;
      this.#oldestShardsStmt = null;
      this.#deleteAllStmt = null;
    }
  }
}

// src/worker-protocol.ts
var REQUEST_TYPES = {
  openWorkspace: true,
  checkSnippet: true,
  checkAndUpdate: true,
  updateFile: true,
  removeFile: true,
  reconcile: true,
  scan: true,
  close: true
};
function isWorkerRequest(msg) {
  if (!msg || typeof msg !== "object")
    return false;
  const m = msg;
  return typeof m.id === "string" && typeof m.type === "string" && Boolean(REQUEST_TYPES[m.type]);
}
function createSuccessResponse(id, data) {
  return {
    id,
    success: true,
    data
  };
}
function createErrorResponse(id, error) {
  return {
    id,
    success: false,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  };
}
function createProgressEvent(payload) {
  return {
    type: "progress",
    payload
  };
}
function createCompleteEvent(payload) {
  return {
    type: "complete",
    payload
  };
}
function createLateFindingEvent(clone2) {
  return {
    type: "lateFinding",
    payload: { clone: clone2 }
  };
}
function createStatusEvent(status, message) {
  return {
    type: "status",
    payload: { status, message }
  };
}

// src/detector-worker.ts
var currentIndex = new SourceAwareCloneIndex;
var currentDiskCache = null;
var currentRootDir = "";
var currentOptions;
var activeAbortController = null;
var isBaselineIndexing = false;
var isBaselineComplete = false;
var watchedRevisions = new Map;
var BATCH_SIZE = 32;
function areOptionsEqual(a, b) {
  if (a === b)
    return true;
  if (!a && !b)
    return true;
  if (!a || !b)
    return false;
  if (a.minTokens !== b.minTokens)
    return false;
  if (a.minLines !== b.minLines)
    return false;
  if (a.maxLines !== b.maxLines)
    return false;
  if (a.maxIndexedFiles !== b.maxIndexedFiles)
    return false;
  const aIgnores = (a.ignorePatterns ?? []).slice().sort().join(",");
  const bIgnores = (b.ignorePatterns ?? []).slice().sort().join(",");
  if (aIgnores !== bIgnores)
    return false;
  if (a.cacheDir !== b.cacheDir)
    return false;
  if (a.maxCacheBytes !== b.maxCacheBytes)
    return false;
  const aFormats = a.formatsExts ? JSON.stringify(a.formatsExts) : "";
  const bFormats = b.formatsExts ? JSON.stringify(b.formatsExts) : "";
  return aFormats === bFormats;
}
function notifyLateFindings(clones) {
  for (const clone2 of clones) {
    const srcA = clone2.duplicationA.sourceId;
    const srcB = clone2.duplicationB.sourceId;
    const resA = path3.resolve(srcA);
    const resB = path3.resolve(srcB);
    const isWatchedA = watchedRevisions.has(srcA) || watchedRevisions.has(resA);
    const isWatchedB = watchedRevisions.has(srcB) || watchedRevisions.has(resB);
    if (isWatchedA || isWatchedB) {
      if (isWatchedA) {
        const entry = watchedRevisions.get(srcA) ?? watchedRevisions.get(resA);
        if (entry)
          entry.lastKnownCloneCount++;
      }
      if (isWatchedB) {
        const entry = watchedRevisions.get(srcB) ?? watchedRevisions.get(resB);
        if (entry)
          entry.lastKnownCloneCount++;
      }
      self.postMessage(createLateFindingEvent(clone2));
    }
  }
}
function cacheSourceShard(filePath, content) {
  if (!currentDiskCache)
    return;
  const contentHash = crypto2.createHash("sha256").update(content).digest("hex");
  const relPath = path3.relative(currentRootDir, filePath).replace(/\\/g, "/");
  const shard = currentIndex.exportSourceShard(filePath, contentHash);
  if (shard) {
    currentDiskCache.saveShard(shard, relPath).catch(() => {});
  }
}
function yieldTask() {
  const { promise, resolve: resolve4 } = Promise.withResolvers();
  setTimeout(resolve4, 0);
  return promise;
}
async function runBaselineIndexing(rootDir, options, signal) {
  const startTime = Date.now();
  let indexedCount = 0;
  let cachedCount = 0;
  let totalSourceBytes = 0;
  try {
    const isGit = await isInsideGitWorkTree(rootDir, signal);
    if (signal.aborted)
      return { indexedCount: 0, status: "cancelled" };
    if (!isGit) {
      isBaselineIndexing = false;
      isBaselineComplete = true;
      self.postMessage(createStatusEvent("idle", "Workspace is not inside a Git repository"));
      self.postMessage(createCompleteEvent({
        indexedCount: 0,
        cachedCount: 0,
        totalSourceBytes: 0,
        cloneCount: 0,
        durationMs: Date.now() - startTime,
        status: "skipped_not_git"
      }));
      return { indexedCount: 0, status: "skipped_not_git" };
    }
    self.postMessage(createStatusEvent("indexing", "Enumerating tracked Git files..."));
    const maxIndexedFiles = options?.maxIndexedFiles ?? MAX_INDEXED_FILES;
    const trackedFiles = await getTrackedGitFiles(rootDir, {
      userIgnorePatterns: options?.ignorePatterns,
      signal,
      maxPaths: Math.max(MAX_GIT_PATHS, maxIndexedFiles)
    });
    if (signal.aborted)
      return { indexedCount: 0, status: "cancelled" };
    const totalFiles = trackedFiles.length;
    self.postMessage(createProgressEvent({
      phase: "indexing",
      indexedCount: 0,
      totalFiles,
      percentage: 0
    }));
    let baselineStatus = "complete";
    for (let i = 0;i < trackedFiles.length; i += BATCH_SIZE) {
      if (signal.aborted)
        return { indexedCount, status: "cancelled" };
      if (indexedCount >= maxIndexedFiles) {
        baselineStatus = "capped_file_count";
        self.postMessage(createStatusEvent("ready", "Indexed file limit reached"));
        break;
      }
      if (totalSourceBytes >= MAX_TOTAL_SOURCE_BYTES) {
        baselineStatus = "capped_source_bytes";
        self.postMessage(createStatusEvent("ready", "Source byte limit reached"));
        break;
      }
      const batch = trackedFiles.slice(i, i + BATCH_SIZE);
      const fileItems = await Promise.all(batch.map(async (filePath) => {
        if (signal.aborted)
          return null;
        if (!getSupportedCodeFormat(filePath, options?.formatsExts)) {
          return null;
        }
        try {
          const stat2 = await fs2.stat(filePath);
          if (stat2.size > MAX_FILE_SIZE_BYTES || stat2.size <= 0) {
            return null;
          }
          const resolved = path3.resolve(filePath);
          if (currentIndex.hasSource(filePath) || currentIndex.hasSource(resolved)) {
            return {
              filePath,
              content: null,
              contentHash: null,
              relPath: null,
              size: stat2.size,
              cachedShard: null,
              isNewlyTokenized: false,
              alreadyIndexed: true
            };
          }
          const content = await fs2.readFile(filePath, "utf8");
          if (signal.aborted || isGeneratedContent(content)) {
            return null;
          }
          const contentHash = crypto2.createHash("sha256").update(content).digest("hex");
          const relPath = path3.relative(rootDir, filePath).replace(/\\/g, "/");
          const cachedShard = currentDiskCache ? await currentDiskCache.getShard(relPath, contentHash) : null;
          let isNewlyTokenized = false;
          let shard = cachedShard;
          if (!shard) {
            shard = currentIndex.tokenizeSource(filePath, content, contentHash);
            isNewlyTokenized = true;
          }
          return {
            filePath,
            content,
            contentHash,
            relPath,
            size: stat2.size,
            cachedShard: shard,
            isNewlyTokenized,
            alreadyIndexed: false
          };
        } catch {
          return null;
        }
      }));
      if (signal.aborted)
        return { indexedCount, status: "cancelled" };
      for (const item of fileItems) {
        if (!item)
          continue;
        if (item.alreadyIndexed) {
          indexedCount++;
          totalSourceBytes += item.size;
          continue;
        }
        let newClones = [];
        if (item.cachedShard) {
          item.cachedShard.sourceId = item.filePath;
          newClones = currentIndex.hydrateSourceShard(item.cachedShard);
          if (item.isNewlyTokenized) {
            if (currentDiskCache && item.contentHash && item.relPath) {
              currentDiskCache.saveShard(item.cachedShard, item.relPath).catch(() => {});
            }
          } else {
            cachedCount++;
          }
        } else if (item.content) {
          newClones = currentIndex.addSource(item.filePath, item.content);
          if (currentDiskCache && item.contentHash && item.relPath) {
            const shard = currentIndex.exportSourceShard(item.filePath, item.contentHash);
            if (shard) {
              currentDiskCache.saveShard(shard, item.relPath).catch(() => {});
            }
          }
        }
        indexedCount++;
        totalSourceBytes += item.size;
        if (newClones.length > 0) {
          notifyLateFindings(newClones);
        }
      }
      const processedCount = Math.min(i + batch.length, totalFiles);
      const percentage = totalFiles > 0 ? Math.round(processedCount / totalFiles * 100) : 100;
      self.postMessage(createProgressEvent({
        phase: "indexing",
        indexedCount,
        totalFiles,
        currentFile: batch[batch.length - 1],
        percentage
      }));
      await yieldTask();
    }
    if (!signal.aborted) {
      isBaselineIndexing = false;
      isBaselineComplete = true;
      currentDiskCache?.prune().catch(() => {});
      self.postMessage(createCompleteEvent({
        indexedCount,
        cachedCount,
        totalSourceBytes,
        cloneCount: currentIndex.clones.length,
        durationMs: Date.now() - startTime,
        status: baselineStatus
      }));
      self.postMessage(createStatusEvent("ready", "Baseline indexing complete"));
      return { indexedCount, status: baselineStatus };
    }
    return { indexedCount, status: "cancelled" };
  } catch (err) {
    if (signal.aborted)
      return { indexedCount, status: "cancelled" };
    isBaselineIndexing = false;
    isBaselineComplete = false;
    const error = err instanceof Error ? err.message : String(err);
    self.postMessage(createStatusEvent("error", error));
    self.postMessage(createCompleteEvent({
      indexedCount,
      cachedCount,
      totalSourceBytes,
      cloneCount: currentIndex.clones.length,
      durationMs: Date.now() - startTime,
      status: "failed",
      error
    }));
    return { indexedCount, status: "failed" };
  }
}
async function runIncrementalGitReconciliation(rootDir, options, signal) {
  try {
    const isGit = await isInsideGitWorkTree(rootDir, signal);
    if (!isGit || signal.aborted) {
      return {
        indexedCount: currentIndex.stats().sourceCount,
        status: !isGit ? "skipped_not_git" : "complete"
      };
    }
    const ignoreFilter = createIgnoreFilter(options?.ignorePatterns);
    const { stdout } = await execGit(["status", "--porcelain", "-z", "--", "."], rootDir, { signal });
    if (signal.aborted)
      return {
        indexedCount: currentIndex.stats().sourceCount,
        status: "cancelled"
      };
    const entries = stdout.split("\x00");
    let i = 0;
    while (i < entries.length) {
      if (signal.aborted)
        return {
          indexedCount: currentIndex.stats().sourceCount,
          status: "cancelled"
        };
      const entry = entries[i];
      i++;
      if (!entry || entry.length < 4)
        continue;
      const statusCode = entry.slice(0, 2);
      const relPath = entry.slice(3).trim();
      if (!relPath)
        continue;
      if (statusCode.includes("R") && i < entries.length) {
        const oldRelPath = entries[i]?.trim();
        i++;
        if (oldRelPath) {
          const oldFullPath = path3.resolve(rootDir, oldRelPath);
          currentIndex.removeSource(oldFullPath);
          currentIndex.removeSource(oldRelPath);
        }
      }
      const fullPath = path3.resolve(rootDir, relPath);
      if (ignoreFilter(relPath)) {
        currentIndex.removeSource(fullPath);
        currentIndex.removeSource(relPath);
        continue;
      }
      if (statusCode.includes("D")) {
        currentIndex.removeSource(fullPath);
        currentIndex.removeSource(relPath);
      } else {
        try {
          if (!getSupportedCodeFormat(fullPath, options?.formatsExts)) {
            currentIndex.removeSource(fullPath);
            continue;
          }
          const stat2 = await fs2.stat(fullPath);
          if (stat2.size > MAX_FILE_SIZE_BYTES || stat2.size <= 0) {
            currentIndex.removeSource(fullPath);
            continue;
          }
          const content = await fs2.readFile(fullPath, "utf8");
          if (signal.aborted)
            return {
              indexedCount: currentIndex.stats().sourceCount,
              status: "cancelled"
            };
          if (isGeneratedContent(content)) {
            currentIndex.removeSource(fullPath);
            continue;
          }
          const newClones = currentIndex.updateSource(fullPath, content);
          cacheSourceShard(fullPath, content);
          if (newClones.length > 0) {
            notifyLateFindings(newClones);
          }
        } catch {
          currentIndex.removeSource(fullPath);
        }
      }
      await yieldTask();
    }
    if (!signal.aborted) {
      self.postMessage(createCompleteEvent({
        indexedCount: currentIndex.stats().sourceCount,
        totalSourceBytes: 0,
        cloneCount: currentIndex.clones.length,
        durationMs: 0,
        status: "complete"
      }));
    }
    return {
      indexedCount: currentIndex.stats().sourceCount,
      status: "complete"
    };
  } catch {
    return {
      indexedCount: currentIndex.stats().sourceCount,
      status: "complete"
    };
  }
}
async function handleWorkerRequest(msg) {
  switch (msg.type) {
    case "openWorkspace": {
      const { rootDir, options } = msg.payload;
      if (currentRootDir === rootDir && areOptionsEqual(currentOptions, options) && (isBaselineComplete || isBaselineIndexing)) {
        if (isBaselineComplete) {
          if (activeAbortController) {
            activeAbortController.abort();
          }
          activeAbortController = new AbortController;
          const recResult = await runIncrementalGitReconciliation(rootDir, options, activeAbortController.signal);
          self.postMessage(createSuccessResponse(msg.id, {
            started: true,
            rootDir,
            reused: true,
            indexedCount: recResult.indexedCount,
            status: recResult.status
          }));
        } else {
          self.postMessage(createSuccessResponse(msg.id, {
            started: true,
            rootDir,
            reused: true,
            indexedCount: currentIndex.stats().sourceCount,
            status: "complete"
          }));
        }
        break;
      }
      if (activeAbortController) {
        activeAbortController.abort();
      }
      activeAbortController = new AbortController;
      if (currentDiskCache) {
        currentDiskCache.close();
        currentDiskCache = null;
      }
      currentRootDir = rootDir;
      currentOptions = options;
      currentIndex = new SourceAwareCloneIndex(options);
      currentDiskCache = new DiskCacheManager({
        rootDir,
        cacheDir: options?.cacheDir,
        config: options,
        maxBytes: options?.maxCacheBytes
      });
      watchedRevisions.clear();
      isBaselineIndexing = true;
      isBaselineComplete = false;
      self.postMessage(createSuccessResponse(msg.id, {
        started: true,
        rootDir,
        reused: false
      }));
      runBaselineIndexing(rootDir, options, activeAbortController.signal).catch(() => {});
      break;
    }
    case "checkSnippet": {
      const { filePath, content, format } = msg.payload;
      const clones = currentIndex.checkSnippet(filePath, content, format);
      self.postMessage(createSuccessResponse(msg.id, clones));
      break;
    }
    case "checkAndUpdate": {
      const { filePath, content, format, revision = 1 } = msg.payload;
      const clones = currentIndex.updateSource(filePath, content, format);
      const resolvedPath = path3.resolve(filePath);
      cacheSourceShard(filePath, content);
      const fileClones = clones.filter((c) => c.duplicationA.sourceId === filePath || c.duplicationB.sourceId === filePath || path3.resolve(c.duplicationA.sourceId) === resolvedPath || path3.resolve(c.duplicationB.sourceId) === resolvedPath);
      const watchEntry = {
        revision,
        lastKnownCloneCount: fileClones.length
      };
      watchedRevisions.set(filePath, watchEntry);
      watchedRevisions.set(resolvedPath, watchEntry);
      self.postMessage(createSuccessResponse(msg.id, {
        clones,
        isComplete: isBaselineComplete
      }));
      break;
    }
    case "updateFile": {
      const { filePath, content, format } = msg.payload;
      const clones = currentIndex.updateSource(filePath, content, format);
      cacheSourceShard(filePath, content);
      self.postMessage(createSuccessResponse(msg.id, { clones }));
      break;
    }
    case "removeFile": {
      const { filePath } = msg.payload;
      currentIndex.removeSource(filePath);
      self.postMessage(createSuccessResponse(msg.id, { removed: true }));
      break;
    }
    case "reconcile": {
      const { files } = msg.payload;
      let reconciledCount = 0;
      for (const fileEntry of files) {
        try {
          if (fileEntry.content !== undefined) {
            currentIndex.updateSource(fileEntry.filePath, fileEntry.content);
            cacheSourceShard(fileEntry.filePath, fileEntry.content);
            reconciledCount++;
          } else {
            if (!getSupportedCodeFormat(fileEntry.filePath, currentOptions?.formatsExts)) {
              currentIndex.removeSource(fileEntry.filePath);
              continue;
            }
            const stat2 = await fs2.stat(fileEntry.filePath);
            if (stat2.size <= MAX_FILE_SIZE_BYTES && stat2.size > 0) {
              const content = await fs2.readFile(fileEntry.filePath, "utf8");
              if (!isGeneratedContent(content)) {
                currentIndex.updateSource(fileEntry.filePath, content);
                cacheSourceShard(fileEntry.filePath, content);
                reconciledCount++;
              }
            }
          }
        } catch {
          currentIndex.removeSource(fileEntry.filePath);
        }
      }
      self.postMessage(createSuccessResponse(msg.id, { reconciledCount }));
      break;
    }
    case "scan": {
      const targetPath = msg.payload?.targetPath;
      const scanOptions = msg.payload?.options;
      let clones = [];
      if (scanOptions || targetPath && targetPath !== currentRootDir) {
        try {
          const pathToScan = targetPath || currentRootDir;
          const isGit = await isInsideGitWorkTree(pathToScan);
          const filesToScan = [];
          const optionsToUse = scanOptions || currentOptions;
          const indexToUse = new SourceAwareCloneIndex({
            minTokens: optionsToUse?.minTokens,
            minLines: optionsToUse?.minLines,
            maxLines: optionsToUse?.maxLines,
            formatsExts: optionsToUse?.formatsExts
          });
          if (isGit) {
            const gitFiles = await getTrackedGitFiles(pathToScan, {
              userIgnorePatterns: optionsToUse?.ignorePatterns
            });
            filesToScan.push(...gitFiles);
          }
          for (const file of filesToScan) {
            try {
              if (!getSupportedCodeFormat(file, optionsToUse?.formatsExts))
                continue;
              const stat2 = await fs2.stat(file);
              if (stat2.size <= MAX_FILE_SIZE_BYTES && stat2.size > 0) {
                const content = await fs2.readFile(file, "utf8");
                if (!isGeneratedContent(content)) {
                  indexToUse.addSource(file, content);
                }
              }
            } catch {}
          }
          clones = indexToUse.getClones();
        } catch {
          clones = currentIndex.getClones();
        }
      } else {
        clones = currentIndex.getClones();
      }
      self.postMessage(createSuccessResponse(msg.id, clones));
      break;
    }
    case "close": {
      if (activeAbortController) {
        activeAbortController.abort();
        activeAbortController = null;
      }
      currentIndex.reset();
      if (currentDiskCache) {
        currentDiskCache.close();
        currentDiskCache = null;
      }
      watchedRevisions.clear();
      isBaselineIndexing = false;
      isBaselineComplete = false;
      self.postMessage(createSuccessResponse(msg.id, { closed: true }));
      self.postMessage(createStatusEvent("closed"));
      break;
    }
    default: {
      const unknownMsg = msg;
      const reqId = typeof unknownMsg.id === "string" ? unknownMsg.id : "unknown";
      const reqType = typeof unknownMsg.type === "string" ? unknownMsg.type : "unknown";
      self.postMessage(createErrorResponse(reqId, `Unsupported request type: ${reqType}`));
      break;
    }
  }
}
self.onmessage = async (event) => {
  const rawData = event.data;
  if (!isWorkerRequest(rawData)) {
    return;
  }
  try {
    await handleWorkerRequest(rawData);
  } catch (err) {
    self.postMessage(createErrorResponse(rawData.id, err instanceof Error ? err : new Error(String(err))));
  }
};
