function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var urlToolkit = {exports: {}};

(function (module, exports) {
	// see https://tools.ietf.org/html/rfc1808

	(function (root) {
	  var URL_REGEX =
	    /^(?=((?:[a-zA-Z0-9+\-.]+:)?))\1(?=((?:\/\/[^\/?#]*)?))\2(?=((?:(?:[^?#\/]*\/)*[^;?#\/]*)?))\3((?:;[^?#]*)?)(\?[^#]*)?(#[^]*)?$/;
	  var FIRST_SEGMENT_REGEX = /^(?=([^\/?#]*))\1([^]*)$/;
	  var SLASH_DOT_REGEX = /(?:\/|^)\.(?=\/)/g;
	  var SLASH_DOT_DOT_REGEX = /(?:\/|^)\.\.\/(?!\.\.\/)[^\/]*(?=\/)/g;

	  var URLToolkit = {
	    // If opts.alwaysNormalize is true then the path will always be normalized even when it starts with / or //
	    // E.g
	    // With opts.alwaysNormalize = false (default, spec compliant)
	    // http://a.com/b/cd + /e/f/../g => http://a.com/e/f/../g
	    // With opts.alwaysNormalize = true (not spec compliant)
	    // http://a.com/b/cd + /e/f/../g => http://a.com/e/g
	    buildAbsoluteURL: function (baseURL, relativeURL, opts) {
	      opts = opts || {};
	      // remove any remaining space and CRLF
	      baseURL = baseURL.trim();
	      relativeURL = relativeURL.trim();
	      if (!relativeURL) {
	        // 2a) If the embedded URL is entirely empty, it inherits the
	        // entire base URL (i.e., is set equal to the base URL)
	        // and we are done.
	        if (!opts.alwaysNormalize) {
	          return baseURL;
	        }
	        var basePartsForNormalise = URLToolkit.parseURL(baseURL);
	        if (!basePartsForNormalise) {
	          throw new Error('Error trying to parse base URL.');
	        }
	        basePartsForNormalise.path = URLToolkit.normalizePath(
	          basePartsForNormalise.path
	        );
	        return URLToolkit.buildURLFromParts(basePartsForNormalise);
	      }
	      var relativeParts = URLToolkit.parseURL(relativeURL);
	      if (!relativeParts) {
	        throw new Error('Error trying to parse relative URL.');
	      }
	      if (relativeParts.scheme) {
	        // 2b) If the embedded URL starts with a scheme name, it is
	        // interpreted as an absolute URL and we are done.
	        if (!opts.alwaysNormalize) {
	          return relativeURL;
	        }
	        relativeParts.path = URLToolkit.normalizePath(relativeParts.path);
	        return URLToolkit.buildURLFromParts(relativeParts);
	      }
	      var baseParts = URLToolkit.parseURL(baseURL);
	      if (!baseParts) {
	        throw new Error('Error trying to parse base URL.');
	      }
	      if (!baseParts.netLoc && baseParts.path && baseParts.path[0] !== '/') {
	        // If netLoc missing and path doesn't start with '/', assume everthing before the first '/' is the netLoc
	        // This causes 'example.com/a' to be handled as '//example.com/a' instead of '/example.com/a'
	        var pathParts = FIRST_SEGMENT_REGEX.exec(baseParts.path);
	        baseParts.netLoc = pathParts[1];
	        baseParts.path = pathParts[2];
	      }
	      if (baseParts.netLoc && !baseParts.path) {
	        baseParts.path = '/';
	      }
	      var builtParts = {
	        // 2c) Otherwise, the embedded URL inherits the scheme of
	        // the base URL.
	        scheme: baseParts.scheme,
	        netLoc: relativeParts.netLoc,
	        path: null,
	        params: relativeParts.params,
	        query: relativeParts.query,
	        fragment: relativeParts.fragment,
	      };
	      if (!relativeParts.netLoc) {
	        // 3) If the embedded URL's <net_loc> is non-empty, we skip to
	        // Step 7.  Otherwise, the embedded URL inherits the <net_loc>
	        // (if any) of the base URL.
	        builtParts.netLoc = baseParts.netLoc;
	        // 4) If the embedded URL path is preceded by a slash "/", the
	        // path is not relative and we skip to Step 7.
	        if (relativeParts.path[0] !== '/') {
	          if (!relativeParts.path) {
	            // 5) If the embedded URL path is empty (and not preceded by a
	            // slash), then the embedded URL inherits the base URL path
	            builtParts.path = baseParts.path;
	            // 5a) if the embedded URL's <params> is non-empty, we skip to
	            // step 7; otherwise, it inherits the <params> of the base
	            // URL (if any) and
	            if (!relativeParts.params) {
	              builtParts.params = baseParts.params;
	              // 5b) if the embedded URL's <query> is non-empty, we skip to
	              // step 7; otherwise, it inherits the <query> of the base
	              // URL (if any) and we skip to step 7.
	              if (!relativeParts.query) {
	                builtParts.query = baseParts.query;
	              }
	            }
	          } else {
	            // 6) The last segment of the base URL's path (anything
	            // following the rightmost slash "/", or the entire path if no
	            // slash is present) is removed and the embedded URL's path is
	            // appended in its place.
	            var baseURLPath = baseParts.path;
	            var newPath =
	              baseURLPath.substring(0, baseURLPath.lastIndexOf('/') + 1) +
	              relativeParts.path;
	            builtParts.path = URLToolkit.normalizePath(newPath);
	          }
	        }
	      }
	      if (builtParts.path === null) {
	        builtParts.path = opts.alwaysNormalize
	          ? URLToolkit.normalizePath(relativeParts.path)
	          : relativeParts.path;
	      }
	      return URLToolkit.buildURLFromParts(builtParts);
	    },
	    parseURL: function (url) {
	      var parts = URL_REGEX.exec(url);
	      if (!parts) {
	        return null;
	      }
	      return {
	        scheme: parts[1] || '',
	        netLoc: parts[2] || '',
	        path: parts[3] || '',
	        params: parts[4] || '',
	        query: parts[5] || '',
	        fragment: parts[6] || '',
	      };
	    },
	    normalizePath: function (path) {
	      // The following operations are
	      // then applied, in order, to the new path:
	      // 6a) All occurrences of "./", where "." is a complete path
	      // segment, are removed.
	      // 6b) If the path ends with "." as a complete path segment,
	      // that "." is removed.
	      path = path.split('').reverse().join('').replace(SLASH_DOT_REGEX, '');
	      // 6c) All occurrences of "<segment>/../", where <segment> is a
	      // complete path segment not equal to "..", are removed.
	      // Removal of these path segments is performed iteratively,
	      // removing the leftmost matching pattern on each iteration,
	      // until no matching pattern remains.
	      // 6d) If the path ends with "<segment>/..", where <segment> is a
	      // complete path segment not equal to "..", that
	      // "<segment>/.." is removed.
	      while (
	        path.length !== (path = path.replace(SLASH_DOT_DOT_REGEX, '')).length
	      ) {}
	      return path.split('').reverse().join('');
	    },
	    buildURLFromParts: function (parts) {
	      return (
	        parts.scheme +
	        parts.netLoc +
	        parts.path +
	        parts.params +
	        parts.query +
	        parts.fragment
	      );
	    },
	  };

	  module.exports = URLToolkit;
	})(); 
} (urlToolkit));

var urlToolkitExports = urlToolkit.exports;

function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);
  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    enumerableOnly && (symbols = symbols.filter(function (sym) {
      return Object.getOwnPropertyDescriptor(object, sym).enumerable;
    })), keys.push.apply(keys, symbols);
  }
  return keys;
}
function _objectSpread2(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = null != arguments[i] ? arguments[i] : {};
    i % 2 ? ownKeys(Object(source), !0).forEach(function (key) {
      _defineProperty(target, key, source[key]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) {
      Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
    });
  }
  return target;
}
function _defineProperty(obj, key, value) {
  key = _toPropertyKey(key);
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }
  return obj;
}
function _extends() {
  _extends = Object.assign ? Object.assign.bind() : function (target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];
      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }
    return target;
  };
  return _extends.apply(this, arguments);
}
function _toPrimitive(input, hint) {
  if (typeof input !== "object" || input === null) return input;
  var prim = input[Symbol.toPrimitive];
  if (prim !== undefined) {
    var res = prim.call(input, hint || "default");
    if (typeof res !== "object") return res;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (hint === "string" ? String : Number)(input);
}
function _toPropertyKey(arg) {
  var key = _toPrimitive(arg, "string");
  return typeof key === "symbol" ? key : String(key);
}

const isFiniteNumber = Number.isFinite || function (value) {
  return typeof value === 'number' && isFinite(value);
};

let Events = /*#__PURE__*/function (Events) {
  Events["MEDIA_ATTACHING"] = "hlsMediaAttaching";
  Events["MEDIA_ATTACHED"] = "hlsMediaAttached";
  Events["MEDIA_DETACHING"] = "hlsMediaDetaching";
  Events["MEDIA_DETACHED"] = "hlsMediaDetached";
  Events["BUFFER_RESET"] = "hlsBufferReset";
  Events["BUFFER_CODECS"] = "hlsBufferCodecs";
  Events["BUFFER_CREATED"] = "hlsBufferCreated";
  Events["BUFFER_APPENDING"] = "hlsBufferAppending";
  Events["BUFFER_APPENDED"] = "hlsBufferAppended";
  Events["BUFFER_EOS"] = "hlsBufferEos";
  Events["BUFFER_FLUSHING"] = "hlsBufferFlushing";
  Events["BUFFER_FLUSHED"] = "hlsBufferFlushed";
  Events["MANIFEST_LOADING"] = "hlsManifestLoading";
  Events["MANIFEST_LOADED"] = "hlsManifestLoaded";
  Events["MANIFEST_PARSED"] = "hlsManifestParsed";
  Events["LEVEL_SWITCHING"] = "hlsLevelSwitching";
  Events["LEVEL_SWITCHED"] = "hlsLevelSwitched";
  Events["LEVEL_LOADING"] = "hlsLevelLoading";
  Events["LEVEL_LOADED"] = "hlsLevelLoaded";
  Events["LEVEL_UPDATED"] = "hlsLevelUpdated";
  Events["LEVEL_PTS_UPDATED"] = "hlsLevelPtsUpdated";
  Events["LEVELS_UPDATED"] = "hlsLevelsUpdated";
  Events["AUDIO_TRACKS_UPDATED"] = "hlsAudioTracksUpdated";
  Events["AUDIO_TRACK_SWITCHING"] = "hlsAudioTrackSwitching";
  Events["AUDIO_TRACK_SWITCHED"] = "hlsAudioTrackSwitched";
  Events["AUDIO_TRACK_LOADING"] = "hlsAudioTrackLoading";
  Events["AUDIO_TRACK_LOADED"] = "hlsAudioTrackLoaded";
  Events["SUBTITLE_TRACKS_UPDATED"] = "hlsSubtitleTracksUpdated";
  Events["SUBTITLE_TRACKS_CLEARED"] = "hlsSubtitleTracksCleared";
  Events["SUBTITLE_TRACK_SWITCH"] = "hlsSubtitleTrackSwitch";
  Events["SUBTITLE_TRACK_LOADING"] = "hlsSubtitleTrackLoading";
  Events["SUBTITLE_TRACK_LOADED"] = "hlsSubtitleTrackLoaded";
  Events["SUBTITLE_FRAG_PROCESSED"] = "hlsSubtitleFragProcessed";
  Events["CUES_PARSED"] = "hlsCuesParsed";
  Events["NON_NATIVE_TEXT_TRACKS_FOUND"] = "hlsNonNativeTextTracksFound";
  Events["INIT_PTS_FOUND"] = "hlsInitPtsFound";
  Events["FRAG_LOADING"] = "hlsFragLoading";
  Events["FRAG_LOAD_EMERGENCY_ABORTED"] = "hlsFragLoadEmergencyAborted";
  Events["FRAG_LOADED"] = "hlsFragLoaded";
  Events["FRAG_DECRYPTED"] = "hlsFragDecrypted";
  Events["FRAG_PARSING_INIT_SEGMENT"] = "hlsFragParsingInitSegment";
  Events["FRAG_PARSING_USERDATA"] = "hlsFragParsingUserdata";
  Events["FRAG_PARSING_METADATA"] = "hlsFragParsingMetadata";
  Events["FRAG_PARSED"] = "hlsFragParsed";
  Events["FRAG_BUFFERED"] = "hlsFragBuffered";
  Events["FRAG_CHANGED"] = "hlsFragChanged";
  Events["FPS_DROP"] = "hlsFpsDrop";
  Events["FPS_DROP_LEVEL_CAPPING"] = "hlsFpsDropLevelCapping";
  Events["ERROR"] = "hlsError";
  Events["DESTROYING"] = "hlsDestroying";
  Events["KEY_LOADING"] = "hlsKeyLoading";
  Events["KEY_LOADED"] = "hlsKeyLoaded";
  Events["LIVE_BACK_BUFFER_REACHED"] = "hlsLiveBackBufferReached";
  Events["BACK_BUFFER_REACHED"] = "hlsBackBufferReached";
  return Events;
}({});

/**
 * Defines each Event type and payload by Event name. Used in {@link hls.js#HlsEventEmitter} to strongly type the event listener API.
 */

let ErrorTypes = /*#__PURE__*/function (ErrorTypes) {
  ErrorTypes["NETWORK_ERROR"] = "networkError";
  ErrorTypes["MEDIA_ERROR"] = "mediaError";
  ErrorTypes["KEY_SYSTEM_ERROR"] = "keySystemError";
  ErrorTypes["MUX_ERROR"] = "muxError";
  ErrorTypes["OTHER_ERROR"] = "otherError";
  return ErrorTypes;
}({});
let ErrorDetails = /*#__PURE__*/function (ErrorDetails) {
  ErrorDetails["KEY_SYSTEM_NO_KEYS"] = "keySystemNoKeys";
  ErrorDetails["KEY_SYSTEM_NO_ACCESS"] = "keySystemNoAccess";
  ErrorDetails["KEY_SYSTEM_NO_SESSION"] = "keySystemNoSession";
  ErrorDetails["KEY_SYSTEM_NO_CONFIGURED_LICENSE"] = "keySystemNoConfiguredLicense";
  ErrorDetails["KEY_SYSTEM_LICENSE_REQUEST_FAILED"] = "keySystemLicenseRequestFailed";
  ErrorDetails["KEY_SYSTEM_SERVER_CERTIFICATE_REQUEST_FAILED"] = "keySystemServerCertificateRequestFailed";
  ErrorDetails["KEY_SYSTEM_SERVER_CERTIFICATE_UPDATE_FAILED"] = "keySystemServerCertificateUpdateFailed";
  ErrorDetails["KEY_SYSTEM_SESSION_UPDATE_FAILED"] = "keySystemSessionUpdateFailed";
  ErrorDetails["KEY_SYSTEM_STATUS_OUTPUT_RESTRICTED"] = "keySystemStatusOutputRestricted";
  ErrorDetails["KEY_SYSTEM_STATUS_INTERNAL_ERROR"] = "keySystemStatusInternalError";
  ErrorDetails["MANIFEST_LOAD_ERROR"] = "manifestLoadError";
  ErrorDetails["MANIFEST_LOAD_TIMEOUT"] = "manifestLoadTimeOut";
  ErrorDetails["MANIFEST_PARSING_ERROR"] = "manifestParsingError";
  ErrorDetails["MANIFEST_INCOMPATIBLE_CODECS_ERROR"] = "manifestIncompatibleCodecsError";
  ErrorDetails["LEVEL_EMPTY_ERROR"] = "levelEmptyError";
  ErrorDetails["LEVEL_LOAD_ERROR"] = "levelLoadError";
  ErrorDetails["LEVEL_LOAD_TIMEOUT"] = "levelLoadTimeOut";
  ErrorDetails["LEVEL_PARSING_ERROR"] = "levelParsingError";
  ErrorDetails["LEVEL_SWITCH_ERROR"] = "levelSwitchError";
  ErrorDetails["AUDIO_TRACK_LOAD_ERROR"] = "audioTrackLoadError";
  ErrorDetails["AUDIO_TRACK_LOAD_TIMEOUT"] = "audioTrackLoadTimeOut";
  ErrorDetails["SUBTITLE_LOAD_ERROR"] = "subtitleTrackLoadError";
  ErrorDetails["SUBTITLE_TRACK_LOAD_TIMEOUT"] = "subtitleTrackLoadTimeOut";
  ErrorDetails["FRAG_LOAD_ERROR"] = "fragLoadError";
  ErrorDetails["FRAG_LOAD_TIMEOUT"] = "fragLoadTimeOut";
  ErrorDetails["FRAG_DECRYPT_ERROR"] = "fragDecryptError";
  ErrorDetails["FRAG_PARSING_ERROR"] = "fragParsingError";
  ErrorDetails["FRAG_GAP"] = "fragGap";
  ErrorDetails["REMUX_ALLOC_ERROR"] = "remuxAllocError";
  ErrorDetails["KEY_LOAD_ERROR"] = "keyLoadError";
  ErrorDetails["KEY_LOAD_TIMEOUT"] = "keyLoadTimeOut";
  ErrorDetails["BUFFER_ADD_CODEC_ERROR"] = "bufferAddCodecError";
  ErrorDetails["BUFFER_INCOMPATIBLE_CODECS_ERROR"] = "bufferIncompatibleCodecsError";
  ErrorDetails["BUFFER_APPEND_ERROR"] = "bufferAppendError";
  ErrorDetails["BUFFER_APPENDING_ERROR"] = "bufferAppendingError";
  ErrorDetails["BUFFER_STALLED_ERROR"] = "bufferStalledError";
  ErrorDetails["BUFFER_FULL_ERROR"] = "bufferFullError";
  ErrorDetails["BUFFER_SEEK_OVER_HOLE"] = "bufferSeekOverHole";
  ErrorDetails["BUFFER_NUDGE_ON_STALL"] = "bufferNudgeOnStall";
  ErrorDetails["INTERNAL_EXCEPTION"] = "internalException";
  ErrorDetails["INTERNAL_ABORTED"] = "aborted";
  ErrorDetails["UNKNOWN"] = "unknown";
  return ErrorDetails;
}({});

const noop = function noop() {};
const fakeLogger = {
  trace: noop,
  debug: noop,
  log: noop,
  warn: noop,
  info: noop,
  error: noop
};
let exportedLogger = fakeLogger;

// let lastCallTime;
// function formatMsgWithTimeInfo(type, msg) {
//   const now = Date.now();
//   const diff = lastCallTime ? '+' + (now - lastCallTime) : '0';
//   lastCallTime = now;
//   msg = (new Date(now)).toISOString() + ' | [' +  type + '] > ' + msg + ' ( ' + diff + ' ms )';
//   return msg;
// }

function consolePrintFn(type) {
  const func = self.console[type];
  if (func) {
    return func.bind(self.console, `[${type}] >`);
  }
  return noop;
}
function exportLoggerFunctions(debugConfig, ...functions) {
  functions.forEach(function (type) {
    exportedLogger[type] = debugConfig[type] ? debugConfig[type].bind(debugConfig) : consolePrintFn(type);
  });
}
function enableLogs(debugConfig, id) {
  // check that console is available
  if (self.console && debugConfig === true || typeof debugConfig === 'object') {
    exportLoggerFunctions(debugConfig,
    // Remove out from list here to hard-disable a log-level
    // 'trace',
    'debug', 'log', 'info', 'warn', 'error');
    // Some browsers don't allow to use bind on console object anyway
    // fallback to default if needed
    try {
      exportedLogger.log(`Debug logs enabled for "${id}" in hls.js version ${undefined}`);
    } catch (e) {
      exportedLogger = fakeLogger;
    }
  } else {
    exportedLogger = fakeLogger;
  }
}
const logger = exportedLogger;

const DECIMAL_RESOLUTION_REGEX = /^(\d+)x(\d+)$/;
const ATTR_LIST_REGEX = /(.+?)=(".*?"|.*?)(?:,|$)/g;

// adapted from https://github.com/kanongil/node-m3u8parse/blob/master/attrlist.js
class AttrList {
  constructor(attrs) {
    if (typeof attrs === 'string') {
      attrs = AttrList.parseAttrList(attrs);
    }
    for (const attr in attrs) {
      if (attrs.hasOwnProperty(attr)) {
        if (attr.substring(0, 2) === 'X-') {
          this.clientAttrs = this.clientAttrs || [];
          this.clientAttrs.push(attr);
        }
        this[attr] = attrs[attr];
      }
    }
  }
  decimalInteger(attrName) {
    const intValue = parseInt(this[attrName], 10);
    if (intValue > Number.MAX_SAFE_INTEGER) {
      return Infinity;
    }
    return intValue;
  }
  hexadecimalInteger(attrName) {
    if (this[attrName]) {
      let stringValue = (this[attrName] || '0x').slice(2);
      stringValue = (stringValue.length & 1 ? '0' : '') + stringValue;
      const value = new Uint8Array(stringValue.length / 2);
      for (let i = 0; i < stringValue.length / 2; i++) {
        value[i] = parseInt(stringValue.slice(i * 2, i * 2 + 2), 16);
      }
      return value;
    } else {
      return null;
    }
  }
  hexadecimalIntegerAsNumber(attrName) {
    const intValue = parseInt(this[attrName], 16);
    if (intValue > Number.MAX_SAFE_INTEGER) {
      return Infinity;
    }
    return intValue;
  }
  decimalFloatingPoint(attrName) {
    return parseFloat(this[attrName]);
  }
  optionalFloat(attrName, defaultValue) {
    const value = this[attrName];
    return value ? parseFloat(value) : defaultValue;
  }
  enumeratedString(attrName) {
    return this[attrName];
  }
  bool(attrName) {
    return this[attrName] === 'YES';
  }
  decimalResolution(attrName) {
    const res = DECIMAL_RESOLUTION_REGEX.exec(this[attrName]);
    if (res === null) {
      return undefined;
    }
    return {
      width: parseInt(res[1], 10),
      height: parseInt(res[2], 10)
    };
  }
  static parseAttrList(input) {
    let match;
    const attrs = {};
    const quote = '"';
    ATTR_LIST_REGEX.lastIndex = 0;
    while ((match = ATTR_LIST_REGEX.exec(input)) !== null) {
      let value = match[2];
      if (value.indexOf(quote) === 0 && value.lastIndexOf(quote) === value.length - 1) {
        value = value.slice(1, -1);
      }
      const name = match[1].trim();
      attrs[name] = value;
    }
    return attrs;
  }
}

// Avoid exporting const enum so that these values can be inlined

function isDateRangeCueAttribute(attrName) {
  return attrName !== "ID" && attrName !== "CLASS" && attrName !== "START-DATE" && attrName !== "DURATION" && attrName !== "END-DATE" && attrName !== "END-ON-NEXT";
}
function isSCTE35Attribute(attrName) {
  return attrName === "SCTE35-OUT" || attrName === "SCTE35-IN";
}
class DateRange {
  constructor(dateRangeAttr, dateRangeWithSameId) {
    this.attr = void 0;
    this._startDate = void 0;
    this._endDate = void 0;
    this._badValueForSameId = void 0;
    if (dateRangeWithSameId) {
      const previousAttr = dateRangeWithSameId.attr;
      for (const key in previousAttr) {
        if (Object.prototype.hasOwnProperty.call(dateRangeAttr, key) && dateRangeAttr[key] !== previousAttr[key]) {
          logger.warn(`DATERANGE tag attribute: "${key}" does not match for tags with ID: "${dateRangeAttr.ID}"`);
          this._badValueForSameId = key;
          break;
        }
      }
      // Merge DateRange tags with the same ID
      dateRangeAttr = _extends(new AttrList({}), previousAttr, dateRangeAttr);
    }
    this.attr = dateRangeAttr;
    this._startDate = new Date(dateRangeAttr["START-DATE"]);
    if ("END-DATE" in this.attr) {
      const endDate = new Date(this.attr["END-DATE"]);
      if (isFiniteNumber(endDate.getTime())) {
        this._endDate = endDate;
      }
    }
  }
  get id() {
    return this.attr.ID;
  }
  get class() {
    return this.attr.CLASS;
  }
  get startDate() {
    return this._startDate;
  }
  get endDate() {
    if (this._endDate) {
      return this._endDate;
    }
    const duration = this.duration;
    if (duration !== null) {
      return new Date(this._startDate.getTime() + duration * 1000);
    }
    return null;
  }
  get duration() {
    if ("DURATION" in this.attr) {
      const duration = this.attr.decimalFloatingPoint("DURATION");
      if (isFiniteNumber(duration)) {
        return duration;
      }
    } else if (this._endDate) {
      return (this._endDate.getTime() - this._startDate.getTime()) / 1000;
    }
    return null;
  }
  get plannedDuration() {
    if ("PLANNED-DURATION" in this.attr) {
      return this.attr.decimalFloatingPoint("PLANNED-DURATION");
    }
    return null;
  }
  get endOnNext() {
    return this.attr.bool("END-ON-NEXT");
  }
  get isValid() {
    return !!this.id && !this._badValueForSameId && isFiniteNumber(this.startDate.getTime()) && (this.duration === null || this.duration >= 0) && (!this.endOnNext || !!this.class);
  }
}

class LoadStats {
  constructor() {
    this.aborted = false;
    this.loaded = 0;
    this.retry = 0;
    this.total = 0;
    this.chunkCount = 0;
    this.bwEstimate = 0;
    this.loading = {
      start: 0,
      first: 0,
      end: 0
    };
    this.parsing = {
      start: 0,
      end: 0
    };
    this.buffering = {
      start: 0,
      first: 0,
      end: 0
    };
  }
}

var ElementaryStreamTypes = {
  AUDIO: "audio",
  VIDEO: "video",
  AUDIOVIDEO: "audiovideo"
};
class BaseSegment {
  // baseurl is the URL to the playlist

  // relurl is the portion of the URL that comes from inside the playlist.

  // Holds the types of data this fragment supports

  constructor(baseurl) {
    this._byteRange = null;
    this._url = null;
    this.baseurl = void 0;
    this.relurl = void 0;
    this.elementaryStreams = {
      [ElementaryStreamTypes.AUDIO]: null,
      [ElementaryStreamTypes.VIDEO]: null,
      [ElementaryStreamTypes.AUDIOVIDEO]: null
    };
    this.baseurl = baseurl;
  }

  // setByteRange converts a EXT-X-BYTERANGE attribute into a two element array
  setByteRange(value, previous) {
    const params = value.split('@', 2);
    const byteRange = [];
    if (params.length === 1) {
      byteRange[0] = previous ? previous.byteRangeEndOffset : 0;
    } else {
      byteRange[0] = parseInt(params[1]);
    }
    byteRange[1] = parseInt(params[0]) + byteRange[0];
    this._byteRange = byteRange;
  }
  get byteRange() {
    if (!this._byteRange) {
      return [];
    }
    return this._byteRange;
  }
  get byteRangeStartOffset() {
    return this.byteRange[0];
  }
  get byteRangeEndOffset() {
    return this.byteRange[1];
  }
  get url() {
    if (!this._url && this.baseurl && this.relurl) {
      this._url = urlToolkitExports.buildAbsoluteURL(this.baseurl, this.relurl, {
        alwaysNormalize: true
      });
    }
    return this._url || '';
  }
  set url(value) {
    this._url = value;
  }
}

/**
 * Object representing parsed data from an HLS Segment. Found in {@link hls.js#LevelDetails.fragments}.
 */
class Fragment extends BaseSegment {
  // EXTINF has to be present for a m3u8 to be considered valid

  // sn notates the sequence number for a segment, and if set to a string can be 'initSegment'

  // levelkeys are the EXT-X-KEY tags that apply to this segment for decryption
  // core difference from the private field _decryptdata is the lack of the initialized IV
  // _decryptdata will set the IV for this segment based on the segment number in the fragment
  // A string representing the fragment type
  // A reference to the loader. Set while the fragment is loading, and removed afterwards. Used to abort fragment loading
  // A reference to the key loader. Set while the key is loading, and removed afterwards. Used to abort key loading
  // The level/track index to which the fragment belongs
  // The continuity counter of the fragment
  // The starting Presentation Time Stamp (PTS) of the fragment. Set after transmux complete.
  // The ending Presentation Time Stamp (PTS) of the fragment. Set after transmux complete.
  // The starting Decode Time Stamp (DTS) of the fragment. Set after transmux complete.
  // The ending Decode Time Stamp (DTS) of the fragment. Set after transmux complete.
  // The start time of the fragment, as listed in the manifest. Updated after transmux complete.
  // Set by `updateFragPTSDTS` in level-helper
  // The maximum starting Presentation Time Stamp (audio/video PTS) of the fragment. Set after transmux complete.
  // The minimum ending Presentation Time Stamp (audio/video PTS) of the fragment. Set after transmux complete.
  // Load/parse timing information
  // A flag indicating whether the segment was downloaded in order to test bitrate, and was not buffered
  // #EXTINF  segment title
  // The Media Initialization Section for this segment
  // Fragment is the last fragment in the media playlist
  // Fragment is marked by an EXT-X-GAP tag indicating that it does not contain media data and should not be loaded
  constructor(type, baseurl) {
    super(baseurl);
    this._decryptdata = null;
    this.rawProgramDateTime = null;
    this.programDateTime = null;
    this.tagList = [];
    this.duration = 0;
    this.sn = 0;
    this.levelkeys = void 0;
    this.type = void 0;
    this.loader = null;
    this.keyLoader = null;
    this.level = -1;
    this.cc = 0;
    this.startPTS = void 0;
    this.endPTS = void 0;
    this.startDTS = void 0;
    this.endDTS = void 0;
    this.start = 0;
    this.deltaPTS = void 0;
    this.maxStartPTS = void 0;
    this.minEndPTS = void 0;
    this.stats = new LoadStats();
    this.urlId = 0;
    this.data = void 0;
    this.bitrateTest = false;
    this.title = null;
    this.initSegment = null;
    this.endList = void 0;
    this.gap = void 0;
    this.type = type;
  }
  get decryptdata() {
    const {
      levelkeys
    } = this;
    if (!levelkeys && !this._decryptdata) {
      return null;
    }
    if (!this._decryptdata && this.levelkeys && !this.levelkeys.NONE) {
      const key = this.levelkeys.identity;
      if (key) {
        this._decryptdata = key.getDecryptData(this.sn);
      } else {
        const keyFormats = Object.keys(this.levelkeys);
        if (keyFormats.length === 1) {
          return this._decryptdata = this.levelkeys[keyFormats[0]].getDecryptData(this.sn);
        }
      }
    }
    return this._decryptdata;
  }
  get end() {
    return this.start + this.duration;
  }
  get endProgramDateTime() {
    if (this.programDateTime === null) {
      return null;
    }
    if (!isFiniteNumber(this.programDateTime)) {
      return null;
    }
    const duration = !isFiniteNumber(this.duration) ? 0 : this.duration;
    return this.programDateTime + duration * 1000;
  }
  get encrypted() {
    var _this$_decryptdata;
    // At the m3u8-parser level we need to add support for manifest signalled keyformats
    // when we want the fragment to start reporting that it is encrypted.
    // Currently, keyFormat will only be set for identity keys
    if ((_this$_decryptdata = this._decryptdata) != null && _this$_decryptdata.encrypted) {
      return true;
    } else if (this.levelkeys) {
      const keyFormats = Object.keys(this.levelkeys);
      const len = keyFormats.length;
      if (len > 1 || len === 1 && this.levelkeys[keyFormats[0]].encrypted) {
        return true;
      }
    }
    return false;
  }
  setKeyFormat(keyFormat) {
    if (this.levelkeys) {
      const key = this.levelkeys[keyFormat];
      if (key && !this._decryptdata) {
        this._decryptdata = key.getDecryptData(this.sn);
      }
    }
  }
  abortRequests() {
    var _this$loader, _this$keyLoader;
    (_this$loader = this.loader) == null ? void 0 : _this$loader.abort();
    (_this$keyLoader = this.keyLoader) == null ? void 0 : _this$keyLoader.abort();
  }
  setElementaryStreamInfo(type, startPTS, endPTS, startDTS, endDTS, partial = false) {
    const {
      elementaryStreams
    } = this;
    const info = elementaryStreams[type];
    if (!info) {
      elementaryStreams[type] = {
        startPTS,
        endPTS,
        startDTS,
        endDTS,
        partial
      };
      return;
    }
    info.startPTS = Math.min(info.startPTS, startPTS);
    info.endPTS = Math.max(info.endPTS, endPTS);
    info.startDTS = Math.min(info.startDTS, startDTS);
    info.endDTS = Math.max(info.endDTS, endDTS);
  }
  clearElementaryStreamInfo() {
    const {
      elementaryStreams
    } = this;
    elementaryStreams[ElementaryStreamTypes.AUDIO] = null;
    elementaryStreams[ElementaryStreamTypes.VIDEO] = null;
    elementaryStreams[ElementaryStreamTypes.AUDIOVIDEO] = null;
  }
}

/**
 * Object representing parsed data from an HLS Partial Segment. Found in {@link hls.js#LevelDetails.partList}.
 */
class Part extends BaseSegment {
  constructor(partAttrs, frag, baseurl, index, previous) {
    super(baseurl);
    this.fragOffset = 0;
    this.duration = 0;
    this.gap = false;
    this.independent = false;
    this.relurl = void 0;
    this.fragment = void 0;
    this.index = void 0;
    this.stats = new LoadStats();
    this.duration = partAttrs.decimalFloatingPoint('DURATION');
    this.gap = partAttrs.bool('GAP');
    this.independent = partAttrs.bool('INDEPENDENT');
    this.relurl = partAttrs.enumeratedString('URI');
    this.fragment = frag;
    this.index = index;
    const byteRange = partAttrs.enumeratedString('BYTERANGE');
    if (byteRange) {
      this.setByteRange(byteRange, previous);
    }
    if (previous) {
      this.fragOffset = previous.fragOffset + previous.duration;
    }
  }
  get start() {
    return this.fragment.start + this.fragOffset;
  }
  get end() {
    return this.start + this.duration;
  }
  get loaded() {
    const {
      elementaryStreams
    } = this;
    return !!(elementaryStreams.audio || elementaryStreams.video || elementaryStreams.audiovideo);
  }
}

const DEFAULT_TARGET_DURATION = 10;

/**
 * Object representing parsed data from an HLS Media Playlist. Found in {@link hls.js#Level.details}.
 */
class LevelDetails {
  // Manifest reload synchronization

  constructor(baseUrl) {
    this.PTSKnown = false;
    this.alignedSliding = false;
    this.averagetargetduration = void 0;
    this.endCC = 0;
    this.endSN = 0;
    this.fragments = void 0;
    this.fragmentHint = void 0;
    this.partList = null;
    this.dateRanges = void 0;
    this.live = true;
    this.ageHeader = 0;
    this.advancedDateTime = void 0;
    this.updated = true;
    this.advanced = true;
    this.availabilityDelay = void 0;
    this.misses = 0;
    this.startCC = 0;
    this.startSN = 0;
    this.startTimeOffset = null;
    this.targetduration = 0;
    this.totalduration = 0;
    this.type = null;
    this.url = void 0;
    this.m3u8 = '';
    this.version = null;
    this.canBlockReload = false;
    this.canSkipUntil = 0;
    this.canSkipDateRanges = false;
    this.skippedSegments = 0;
    this.recentlyRemovedDateranges = void 0;
    this.partHoldBack = 0;
    this.holdBack = 0;
    this.partTarget = 0;
    this.preloadHint = void 0;
    this.renditionReports = void 0;
    this.tuneInGoal = 0;
    this.deltaUpdateFailed = void 0;
    this.driftStartTime = 0;
    this.driftEndTime = 0;
    this.driftStart = 0;
    this.driftEnd = 0;
    this.encryptedFragments = void 0;
    this.playlistParsingError = null;
    this.variableList = null;
    this.hasVariableRefs = false;
    this.fragments = [];
    this.encryptedFragments = [];
    this.dateRanges = {};
    this.url = baseUrl;
  }
  reloaded(previous) {
    if (!previous) {
      this.advanced = true;
      this.updated = true;
      return;
    }
    const partSnDiff = this.lastPartSn - previous.lastPartSn;
    const partIndexDiff = this.lastPartIndex - previous.lastPartIndex;
    this.updated = this.endSN !== previous.endSN || !!partIndexDiff || !!partSnDiff || !this.live;
    this.advanced = this.endSN > previous.endSN || partSnDiff > 0 || partSnDiff === 0 && partIndexDiff > 0;
    if (this.updated || this.advanced) {
      this.misses = Math.floor(previous.misses * 0.6);
    } else {
      this.misses = previous.misses + 1;
    }
    this.availabilityDelay = previous.availabilityDelay;
  }
  get hasProgramDateTime() {
    if (this.fragments.length) {
      return isFiniteNumber(this.fragments[this.fragments.length - 1].programDateTime);
    }
    return false;
  }
  get levelTargetDuration() {
    return this.averagetargetduration || this.targetduration || DEFAULT_TARGET_DURATION;
  }
  get drift() {
    const runTime = this.driftEndTime - this.driftStartTime;
    if (runTime > 0) {
      const runDuration = this.driftEnd - this.driftStart;
      return runDuration * 1000 / runTime;
    }
    return 1;
  }
  get edge() {
    return this.partEnd || this.fragmentEnd;
  }
  get partEnd() {
    var _this$partList;
    if ((_this$partList = this.partList) != null && _this$partList.length) {
      return this.partList[this.partList.length - 1].end;
    }
    return this.fragmentEnd;
  }
  get fragmentEnd() {
    var _this$fragments;
    if ((_this$fragments = this.fragments) != null && _this$fragments.length) {
      return this.fragments[this.fragments.length - 1].end;
    }
    return 0;
  }
  get age() {
    if (this.advancedDateTime) {
      return Math.max(Date.now() - this.advancedDateTime, 0) / 1000;
    }
    return 0;
  }
  get lastPartIndex() {
    var _this$partList2;
    if ((_this$partList2 = this.partList) != null && _this$partList2.length) {
      return this.partList[this.partList.length - 1].index;
    }
    return -1;
  }
  get lastPartSn() {
    var _this$partList3;
    if ((_this$partList3 = this.partList) != null && _this$partList3.length) {
      return this.partList[this.partList.length - 1].fragment.sn;
    }
    return this.endSN;
  }
}

// This file is inserted as a shim for modules which we do not want to include into the distro.
// This replacement is done in the "alias" plugin of the rollup config.
var empty = undefined;
var Cues = /*@__PURE__*/getDefaultExportFromCjs(empty);

function sliceUint8(array, start, end) {
  // @ts-expect-error This polyfills IE11 usage of Uint8Array slice.
  // It always exists in the TypeScript definition so fails, but it fails at runtime on IE11.
  return Uint8Array.prototype.slice ? array.slice(start, end) : new Uint8Array(Array.prototype.slice.call(array, start, end));
}

// breaking up those two types in order to clarify what is happening in the decoding path.

/**
 * Returns true if an ID3 header can be found at offset in data
 * @param data - The data to search
 * @param offset - The offset at which to start searching
 */
const isHeader$1 = (data, offset) => {
  /*
   * http://id3.org/id3v2.3.0
   * [0]     = 'I'
   * [1]     = 'D'
   * [2]     = '3'
   * [3,4]   = {Version}
   * [5]     = {Flags}
   * [6-9]   = {ID3 Size}
   *
   * An ID3v2 tag can be detected with the following pattern:
   *  $49 44 33 yy yy xx zz zz zz zz
   * Where yy is less than $FF, xx is the 'flags' byte and zz is less than $80
   */
  if (offset + 10 <= data.length) {
    // look for 'ID3' identifier
    if (data[offset] === 0x49 && data[offset + 1] === 0x44 && data[offset + 2] === 0x33) {
      // check version is within range
      if (data[offset + 3] < 0xff && data[offset + 4] < 0xff) {
        // check size is within range
        if (data[offset + 6] < 0x80 && data[offset + 7] < 0x80 && data[offset + 8] < 0x80 && data[offset + 9] < 0x80) {
          return true;
        }
      }
    }
  }
  return false;
};

/**
 * Returns true if an ID3 footer can be found at offset in data
 * @param data - The data to search
 * @param offset - The offset at which to start searching
 */
const isFooter = (data, offset) => {
  /*
   * The footer is a copy of the header, but with a different identifier
   */
  if (offset + 10 <= data.length) {
    // look for '3DI' identifier
    if (data[offset] === 0x33 && data[offset + 1] === 0x44 && data[offset + 2] === 0x49) {
      // check version is within range
      if (data[offset + 3] < 0xff && data[offset + 4] < 0xff) {
        // check size is within range
        if (data[offset + 6] < 0x80 && data[offset + 7] < 0x80 && data[offset + 8] < 0x80 && data[offset + 9] < 0x80) {
          return true;
        }
      }
    }
  }
  return false;
};

/**
 * Returns any adjacent ID3 tags found in data starting at offset, as one block of data
 * @param data - The data to search in
 * @param offset - The offset at which to start searching
 * @returns the block of data containing any ID3 tags found
 * or *undefined* if no header is found at the starting offset
 */
const getID3Data = (data, offset) => {
  const front = offset;
  let length = 0;
  while (isHeader$1(data, offset)) {
    // ID3 header is 10 bytes
    length += 10;
    const size = readSize(data, offset + 6);
    length += size;
    if (isFooter(data, offset + 10)) {
      // ID3 footer is 10 bytes
      length += 10;
    }
    offset += length;
  }
  if (length > 0) {
    return data.subarray(front, front + length);
  }
  return undefined;
};
const readSize = (data, offset) => {
  let size = 0;
  size = (data[offset] & 0x7f) << 21;
  size |= (data[offset + 1] & 0x7f) << 14;
  size |= (data[offset + 2] & 0x7f) << 7;
  size |= data[offset + 3] & 0x7f;
  return size;
};
const canParse$1 = (data, offset) => {
  return isHeader$1(data, offset) && readSize(data, offset + 6) + 10 <= data.length - offset;
};

/**
 * Searches for the Elementary Stream timestamp found in the ID3 data chunk
 * @param data - Block of data containing one or more ID3 tags
 */
const getTimeStamp = data => {
  const frames = getID3Frames(data);
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    if (isTimeStampFrame(frame)) {
      return readTimeStamp(frame);
    }
  }
  return undefined;
};

/**
 * Returns true if the ID3 frame is an Elementary Stream timestamp frame
 */
const isTimeStampFrame = frame => {
  return frame && frame.key === 'PRIV' && frame.info === 'com.apple.streaming.transportStreamTimestamp';
};
const getFrameData = data => {
  /*
  Frame ID       $xx xx xx xx (four characters)
  Size           $xx xx xx xx
  Flags          $xx xx
  */
  const type = String.fromCharCode(data[0], data[1], data[2], data[3]);
  const size = readSize(data, 4);

  // skip frame id, size, and flags
  const offset = 10;
  return {
    type,
    size,
    data: data.subarray(offset, offset + size)
  };
};

/**
 * Returns an array of ID3 frames found in all the ID3 tags in the id3Data
 * @param id3Data - The ID3 data containing one or more ID3 tags
 */
const getID3Frames = id3Data => {
  let offset = 0;
  const frames = [];
  while (isHeader$1(id3Data, offset)) {
    const size = readSize(id3Data, offset + 6);
    // skip past ID3 header
    offset += 10;
    const end = offset + size;
    // loop through frames in the ID3 tag
    while (offset + 8 < end) {
      const frameData = getFrameData(id3Data.subarray(offset));
      const frame = decodeFrame(frameData);
      if (frame) {
        frames.push(frame);
      }

      // skip frame header and frame data
      offset += frameData.size + 10;
    }
    if (isFooter(id3Data, offset)) {
      offset += 10;
    }
  }
  return frames;
};
const decodeFrame = frame => {
  if (frame.type === 'PRIV') {
    return decodePrivFrame(frame);
  } else if (frame.type[0] === 'W') {
    return decodeURLFrame(frame);
  }
  return decodeTextFrame(frame);
};
const decodePrivFrame = frame => {
  /*
  Format: <text string>\0<binary data>
  */
  if (frame.size < 2) {
    return undefined;
  }
  const owner = utf8ArrayToStr(frame.data, true);
  const privateData = new Uint8Array(frame.data.subarray(owner.length + 1));
  return {
    key: frame.type,
    info: owner,
    data: privateData.buffer
  };
};
const decodeTextFrame = frame => {
  if (frame.size < 2) {
    return undefined;
  }
  if (frame.type === 'TXXX') {
    /*
    Format:
    [0]   = {Text Encoding}
    [1-?] = {Description}\0{Value}
    */
    let index = 1;
    const description = utf8ArrayToStr(frame.data.subarray(index), true);
    index += description.length + 1;
    const value = utf8ArrayToStr(frame.data.subarray(index));
    return {
      key: frame.type,
      info: description,
      data: value
    };
  }
  /*
  Format:
  [0]   = {Text Encoding}
  [1-?] = {Value}
  */
  const text = utf8ArrayToStr(frame.data.subarray(1));
  return {
    key: frame.type,
    data: text
  };
};
const decodeURLFrame = frame => {
  if (frame.type === 'WXXX') {
    /*
    Format:
    [0]   = {Text Encoding}
    [1-?] = {Description}\0{URL}
    */
    if (frame.size < 2) {
      return undefined;
    }
    let index = 1;
    const description = utf8ArrayToStr(frame.data.subarray(index), true);
    index += description.length + 1;
    const value = utf8ArrayToStr(frame.data.subarray(index));
    return {
      key: frame.type,
      info: description,
      data: value
    };
  }
  /*
  Format:
  [0-?] = {URL}
  */
  const url = utf8ArrayToStr(frame.data);
  return {
    key: frame.type,
    data: url
  };
};
const readTimeStamp = timeStampFrame => {
  if (timeStampFrame.data.byteLength === 8) {
    const data = new Uint8Array(timeStampFrame.data);
    // timestamp is 33 bit expressed as a big-endian eight-octet number,
    // with the upper 31 bits set to zero.
    const pts33Bit = data[3] & 0x1;
    let timestamp = (data[4] << 23) + (data[5] << 15) + (data[6] << 7) + data[7];
    timestamp /= 45;
    if (pts33Bit) {
      timestamp += 47721858.84;
    } // 2^32 / 90

    return Math.round(timestamp);
  }
  return undefined;
};

// http://stackoverflow.com/questions/8936984/uint8array-to-string-in-javascript/22373197
// http://www.onicos.com/staff/iz/amuse/javascript/expert/utf.txt
/* utf.js - UTF-8 <=> UTF-16 convertion
 *
 * Copyright (C) 1999 Masanao Izumo <iz@onicos.co.jp>
 * Version: 1.0
 * LastModified: Dec 25 1999
 * This library is free.  You can redistribute it and/or modify it.
 */
const utf8ArrayToStr = (array, exitOnNull = false) => {
  const decoder = getTextDecoder();
  if (decoder) {
    const decoded = decoder.decode(array);
    if (exitOnNull) {
      // grab up to the first null
      const idx = decoded.indexOf('\0');
      return idx !== -1 ? decoded.substring(0, idx) : decoded;
    }

    // remove any null characters
    return decoded.replace(/\0/g, '');
  }
  const len = array.length;
  let c;
  let char2;
  let char3;
  let out = '';
  let i = 0;
  while (i < len) {
    c = array[i++];
    if (c === 0x00 && exitOnNull) {
      return out;
    } else if (c === 0x00 || c === 0x03) {
      // If the character is 3 (END_OF_TEXT) or 0 (NULL) then skip it
      continue;
    }
    switch (c >> 4) {
      case 0:
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
      case 6:
      case 7:
        // 0xxxxxxx
        out += String.fromCharCode(c);
        break;
      case 12:
      case 13:
        // 110x xxxx   10xx xxxx
        char2 = array[i++];
        out += String.fromCharCode((c & 0x1f) << 6 | char2 & 0x3f);
        break;
      case 14:
        // 1110 xxxx  10xx xxxx  10xx xxxx
        char2 = array[i++];
        char3 = array[i++];
        out += String.fromCharCode((c & 0x0f) << 12 | (char2 & 0x3f) << 6 | (char3 & 0x3f) << 0);
        break;
    }
  }
  return out;
};
let decoder;
function getTextDecoder() {
  if (!decoder && typeof self.TextDecoder !== 'undefined') {
    decoder = new self.TextDecoder('utf-8');
  }
  return decoder;
}

function appendUint8Array(data1, data2) {
  const temp = new Uint8Array(data1.length + data2.length);
  temp.set(data1);
  temp.set(data2, data1.length);
  return temp;
}

class LevelKey {
  static clearKeyUriToKeyIdMap() {
  }
  constructor(method, uri, format, formatversions = [1], iv = null) {
    this.uri = void 0;
    this.method = void 0;
    this.keyFormat = void 0;
    this.keyFormatVersions = void 0;
    this.encrypted = void 0;
    this.isCommonEncryption = void 0;
    this.iv = null;
    this.key = null;
    this.keyId = null;
    this.pssh = null;
    this.method = method;
    this.uri = uri;
    this.keyFormat = format;
    this.keyFormatVersions = formatversions;
    this.iv = iv;
    this.encrypted = method ? method !== 'NONE' : false;
    this.isCommonEncryption = this.encrypted && method !== 'AES-128';
  }
  isSupported() {
    // If it's Segment encryption or No encryption, just select that key system
    if (this.method) {
      if (this.method === 'AES-128' || this.method === 'NONE') {
        return true;
      }
      if (this.keyFormat === 'identity') {
        // Maintain support for clear SAMPLE-AES with MPEG-3 TS
        return this.method === 'SAMPLE-AES';
      }
    }
    return false;
  }
  getDecryptData(sn) {
    if (!this.encrypted || !this.uri) {
      return null;
    }
    if (this.method === 'AES-128' && this.uri && !this.iv) {
      if (typeof sn !== 'number') {
        // We are fetching decryption data for a initialization segment
        // If the segment was encrypted with AES-128
        // It must have an IV defined. We cannot substitute the Segment Number in.
        if (this.method === 'AES-128' && !this.iv) {
          logger.warn(`missing IV for initialization segment with method="${this.method}" - compliance issue`);
        }
        // Explicitly set sn to resulting value from implicit conversions 'initSegment' values for IV generation.
        sn = 0;
      }
      const iv = createInitializationVector(sn);
      const decryptdata = new LevelKey(this.method, this.uri, 'identity', this.keyFormatVersions, iv);
      return decryptdata;
    }
    {
      return this;
    }
  }
}
function createInitializationVector(segmentNumber) {
  const uint8View = new Uint8Array(16);
  for (let i = 12; i < 16; i++) {
    uint8View[i] = segmentNumber >> 8 * (15 - i) & 0xff;
  }
  return uint8View;
}

/**
 * MediaSource helper
 */

function getMediaSource() {
  if (typeof self === 'undefined') return undefined;
  return self.MediaSource || self.WebKitMediaSource;
}

// from http://mp4ra.org/codecs.html
const sampleEntryCodesISO = {
  audio: {
    a3ds: true,
    'ac-3': true,
    'ac-4': true,
    alac: true,
    alaw: true,
    dra1: true,
    'dts+': true,
    'dts-': true,
    dtsc: true,
    dtse: true,
    dtsh: true,
    'ec-3': true,
    enca: true,
    g719: true,
    g726: true,
    m4ae: true,
    mha1: true,
    mha2: true,
    mhm1: true,
    mhm2: true,
    mlpa: true,
    mp4a: true,
    'raw ': true,
    Opus: true,
    opus: true,
    // browsers expect this to be lowercase despite MP4RA says 'Opus'
    samr: true,
    sawb: true,
    sawp: true,
    sevc: true,
    sqcp: true,
    ssmv: true,
    twos: true,
    ulaw: true
  },
  video: {
    avc1: true,
    avc2: true,
    avc3: true,
    avc4: true,
    avcp: true,
    av01: true,
    drac: true,
    dva1: true,
    dvav: true,
    dvh1: true,
    dvhe: true,
    encv: true,
    hev1: true,
    hvc1: true,
    mjp2: true,
    mp4v: true,
    mvc1: true,
    mvc2: true,
    mvc3: true,
    mvc4: true,
    resv: true,
    rv60: true,
    s263: true,
    svc1: true,
    svc2: true,
    'vc-1': true,
    vp08: true,
    vp09: true
  },
  text: {
    stpp: true,
    wvtt: true
  }
};
const MediaSource$2 = getMediaSource();
function isCodecType(codec, type) {
  const typeCodes = sampleEntryCodesISO[type];
  return !!typeCodes && typeCodes[codec.slice(0, 4)] === true;
}
function isCodecSupportedInMp4(codec, type) {
  var _MediaSource$isTypeSu;
  return (_MediaSource$isTypeSu = MediaSource$2 == null ? void 0 : MediaSource$2.isTypeSupported(`${type || 'video'}/mp4;codecs="${codec}"`)) != null ? _MediaSource$isTypeSu : false;
}

const MASTER_PLAYLIST_REGEX = /#EXT-X-STREAM-INF:([^\r\n]*)(?:[\r\n](?:#[^\r\n]*)?)*([^\r\n]+)|#EXT-X-(SESSION-DATA|SESSION-KEY|DEFINE|CONTENT-STEERING|START):([^\r\n]*)[\r\n]+/g;
const MASTER_PLAYLIST_MEDIA_REGEX = /#EXT-X-MEDIA:(.*)/g;
const IS_MEDIA_PLAYLIST = /^#EXT(?:INF|-X-TARGETDURATION):/m; // Handle empty Media Playlist (first EXTINF not signaled, but TARGETDURATION present)

const LEVEL_PLAYLIST_REGEX_FAST = new RegExp([/#EXTINF:\s*(\d*(?:\.\d+)?)(?:,(.*)\s+)?/.source,
// duration (#EXTINF:<duration>,<title>), group 1 => duration, group 2 => title
/(?!#) *(\S[\S ]*)/.source,
// segment URI, group 3 => the URI (note newline is not eaten)
/#EXT-X-BYTERANGE:*(.+)/.source,
// next segment's byterange, group 4 => range spec (x@y)
/#EXT-X-PROGRAM-DATE-TIME:(.+)/.source,
// next segment's program date/time group 5 => the datetime spec
/#.*/.source // All other non-segment oriented tags will match with all groups empty
].join('|'), 'g');
const LEVEL_PLAYLIST_REGEX_SLOW = new RegExp([/#(EXTM3U)/.source, /#EXT-X-(DATERANGE|DEFINE|KEY|MAP|PART|PART-INF|PLAYLIST-TYPE|PRELOAD-HINT|RENDITION-REPORT|SERVER-CONTROL|SKIP|START):(.+)/.source, /#EXT-X-(BITRATE|DISCONTINUITY-SEQUENCE|MEDIA-SEQUENCE|TARGETDURATION|VERSION): *(\d+)/.source, /#EXT-X-(DISCONTINUITY|ENDLIST|GAP)/.source, /(#)([^:]*):(.*)/.source, /(#)(.*)(?:.*)\r?\n?/.source].join('|'));
class M3U8Parser {
  static findGroup(groups, mediaGroupId) {
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      if (group.id === mediaGroupId) {
        return group;
      }
    }
  }
  static convertAVC1ToAVCOTI(codec) {
    // Convert avc1 codec string from RFC-4281 to RFC-6381 for MediaSource.isTypeSupported
    const avcdata = codec.split('.');
    if (avcdata.length > 2) {
      let result = avcdata.shift() + '.';
      result += parseInt(avcdata.shift()).toString(16);
      result += ('000' + parseInt(avcdata.shift()).toString(16)).slice(-4);
      return result;
    }
    return codec;
  }
  static resolve(url, baseUrl) {
    return urlToolkitExports.buildAbsoluteURL(baseUrl, url, {
      alwaysNormalize: true
    });
  }
  static isMediaPlaylist(str) {
    return IS_MEDIA_PLAYLIST.test(str);
  }
  static parseMasterPlaylist(string, baseurl) {
    const hasVariableRefs = false;
    const parsed = {
      contentSteering: null,
      levels: [],
      playlistParsingError: null,
      sessionData: null,
      sessionKeys: null,
      startTimeOffset: null,
      variableList: null,
      hasVariableRefs
    };
    const levelsWithKnownCodecs = [];
    MASTER_PLAYLIST_REGEX.lastIndex = 0;
    let result;
    while ((result = MASTER_PLAYLIST_REGEX.exec(string)) != null) {
      if (result[1]) {
        var _level$unknownCodecs;
        // '#EXT-X-STREAM-INF' is found, parse level tag  in group 1
        const attrs = new AttrList(result[1]);
        const uri = result[2];
        const level = {
          attrs,
          bitrate: attrs.decimalInteger('AVERAGE-BANDWIDTH') || attrs.decimalInteger('BANDWIDTH'),
          name: attrs.NAME,
          url: M3U8Parser.resolve(uri, baseurl)
        };
        const resolution = attrs.decimalResolution('RESOLUTION');
        if (resolution) {
          level.width = resolution.width;
          level.height = resolution.height;
        }
        setCodecs((attrs.CODECS || '').split(/[ ,]+/).filter(c => c), level);
        if (level.videoCodec && level.videoCodec.indexOf('avc1') !== -1) {
          level.videoCodec = M3U8Parser.convertAVC1ToAVCOTI(level.videoCodec);
        }
        if (!((_level$unknownCodecs = level.unknownCodecs) != null && _level$unknownCodecs.length)) {
          levelsWithKnownCodecs.push(level);
        }
        parsed.levels.push(level);
      } else if (result[3]) {
        const tag = result[3];
        const attributes = result[4];
        switch (tag) {
          case 'SESSION-DATA':
            {
              // #EXT-X-SESSION-DATA
              const sessionAttrs = new AttrList(attributes);
              const dataId = sessionAttrs['DATA-ID'];
              if (dataId) {
                if (parsed.sessionData === null) {
                  parsed.sessionData = {};
                }
                parsed.sessionData[dataId] = sessionAttrs;
              }
              break;
            }
          case 'SESSION-KEY':
            {
              // #EXT-X-SESSION-KEY
              const sessionKey = parseKey(attributes, baseurl);
              if (sessionKey.encrypted && sessionKey.isSupported()) {
                if (parsed.sessionKeys === null) {
                  parsed.sessionKeys = [];
                }
                parsed.sessionKeys.push(sessionKey);
              } else {
                logger.warn(`[Keys] Ignoring invalid EXT-X-SESSION-KEY tag: "${attributes}"`);
              }
              break;
            }
          case 'DEFINE':
            {
              break;
            }
          case 'CONTENT-STEERING':
            {
              // #EXT-X-CONTENT-STEERING
              const contentSteeringAttributes = new AttrList(attributes);
              parsed.contentSteering = {
                uri: M3U8Parser.resolve(contentSteeringAttributes['SERVER-URI'], baseurl),
                pathwayId: contentSteeringAttributes['PATHWAY-ID'] || '.'
              };
              break;
            }
          case 'START':
            {
              // #EXT-X-START
              parsed.startTimeOffset = parseStartTimeOffset(attributes);
              break;
            }
        }
      }
    }
    // Filter out levels with unknown codecs if it does not remove all levels
    const stripUnknownCodecLevels = levelsWithKnownCodecs.length > 0 && levelsWithKnownCodecs.length < parsed.levels.length;
    parsed.levels = stripUnknownCodecLevels ? levelsWithKnownCodecs : parsed.levels;
    if (parsed.levels.length === 0) {
      parsed.playlistParsingError = new Error('no levels found in manifest');
    }
    return parsed;
  }
  static parseMasterPlaylistMedia(string, baseurl, parsed) {
    let result;
    const results = {};
    const levels = parsed.levels;
    const groupsByType = {
      AUDIO: levels.map(level => ({
        id: level.attrs.AUDIO,
        audioCodec: level.audioCodec
      })),
      SUBTITLES: levels.map(level => ({
        id: level.attrs.SUBTITLES,
        textCodec: level.textCodec
      })),
      'CLOSED-CAPTIONS': []
    };
    let id = 0;
    MASTER_PLAYLIST_MEDIA_REGEX.lastIndex = 0;
    while ((result = MASTER_PLAYLIST_MEDIA_REGEX.exec(string)) !== null) {
      const attrs = new AttrList(result[1]);
      const type = attrs.TYPE;
      if (type) {
        const groups = groupsByType[type];
        const medias = results[type] || [];
        results[type] = medias;
        const media = {
          attrs,
          bitrate: 0,
          id: id++,
          groupId: attrs['GROUP-ID'] || '',
          instreamId: attrs['INSTREAM-ID'],
          name: attrs.NAME || attrs.LANGUAGE || '',
          type,
          default: attrs.bool('DEFAULT'),
          autoselect: attrs.bool('AUTOSELECT'),
          forced: attrs.bool('FORCED'),
          lang: attrs.LANGUAGE,
          url: attrs.URI ? M3U8Parser.resolve(attrs.URI, baseurl) : ''
        };
        if (groups != null && groups.length) {
          // If there are audio or text groups signalled in the manifest, let's look for a matching codec string for this track
          // If we don't find the track signalled, lets use the first audio groups codec we have
          // Acting as a best guess
          const groupCodec = M3U8Parser.findGroup(groups, media.groupId) || groups[0];
          assignCodec(media, groupCodec, 'audioCodec');
          assignCodec(media, groupCodec, 'textCodec');
        }
        medias.push(media);
      }
    }
    return results;
  }
  static parseLevelPlaylist(string, baseurl, id, type, levelUrlId, multivariantVariableList) {
    const level = new LevelDetails(baseurl);
    const fragments = level.fragments;
    // The most recent init segment seen (applies to all subsequent segments)
    let currentInitSegment = null;
    let currentSN = 0;
    let currentPart = 0;
    let totalduration = 0;
    let discontinuityCounter = 0;
    let prevFrag = null;
    let frag = new Fragment(type, baseurl);
    let result;
    let i;
    let levelkeys;
    let firstPdtIndex = -1;
    let createNextFrag = false;
    LEVEL_PLAYLIST_REGEX_FAST.lastIndex = 0;
    level.m3u8 = string;
    level.hasVariableRefs = false;
    while ((result = LEVEL_PLAYLIST_REGEX_FAST.exec(string)) !== null) {
      if (createNextFrag) {
        createNextFrag = false;
        frag = new Fragment(type, baseurl);
        // setup the next fragment for part loading
        frag.start = totalduration;
        frag.sn = currentSN;
        frag.cc = discontinuityCounter;
        frag.level = id;
        if (currentInitSegment) {
          frag.initSegment = currentInitSegment;
          frag.rawProgramDateTime = currentInitSegment.rawProgramDateTime;
          currentInitSegment.rawProgramDateTime = null;
        }
      }
      const duration = result[1];
      if (duration) {
        // INF
        frag.duration = parseFloat(duration);
        // avoid sliced strings    https://github.com/video-dev/hls.js/issues/939
        const title = (' ' + result[2]).slice(1);
        frag.title = title || null;
        frag.tagList.push(title ? ['INF', duration, title] : ['INF', duration]);
      } else if (result[3]) {
        // url
        if (isFiniteNumber(frag.duration)) {
          frag.start = totalduration;
          if (levelkeys) {
            setFragLevelKeys(frag, levelkeys, level);
          }
          frag.sn = currentSN;
          frag.level = id;
          frag.cc = discontinuityCounter;
          frag.urlId = levelUrlId;
          fragments.push(frag);
          // avoid sliced strings    https://github.com/video-dev/hls.js/issues/939
          const uri = (' ' + result[3]).slice(1);
          frag.relurl = uri;
          assignProgramDateTime(frag, prevFrag);
          prevFrag = frag;
          totalduration += frag.duration;
          currentSN++;
          currentPart = 0;
          createNextFrag = true;
        }
      } else if (result[4]) {
        // X-BYTERANGE
        const data = (' ' + result[4]).slice(1);
        if (prevFrag) {
          frag.setByteRange(data, prevFrag);
        } else {
          frag.setByteRange(data);
        }
      } else if (result[5]) {
        // PROGRAM-DATE-TIME
        // avoid sliced strings    https://github.com/video-dev/hls.js/issues/939
        frag.rawProgramDateTime = (' ' + result[5]).slice(1);
        frag.tagList.push(['PROGRAM-DATE-TIME', frag.rawProgramDateTime]);
        if (firstPdtIndex === -1) {
          firstPdtIndex = fragments.length;
        }
      } else {
        result = result[0].match(LEVEL_PLAYLIST_REGEX_SLOW);
        if (!result) {
          logger.warn('No matches on slow regex match for level playlist!');
          continue;
        }
        for (i = 1; i < result.length; i++) {
          if (typeof result[i] !== 'undefined') {
            break;
          }
        }

        // avoid sliced strings    https://github.com/video-dev/hls.js/issues/939
        const tag = (' ' + result[i]).slice(1);
        const value1 = (' ' + result[i + 1]).slice(1);
        const value2 = result[i + 2] ? (' ' + result[i + 2]).slice(1) : '';
        switch (tag) {
          case 'PLAYLIST-TYPE':
            level.type = value1.toUpperCase();
            break;
          case 'MEDIA-SEQUENCE':
            currentSN = level.startSN = parseInt(value1);
            break;
          case 'SKIP':
            {
              const skipAttrs = new AttrList(value1);
              const skippedSegments = skipAttrs.decimalInteger('SKIPPED-SEGMENTS');
              if (isFiniteNumber(skippedSegments)) {
                level.skippedSegments = skippedSegments;
                // This will result in fragments[] containing undefined values, which we will fill in with `mergeDetails`
                for (let _i = skippedSegments; _i--;) {
                  fragments.unshift(null);
                }
                currentSN += skippedSegments;
              }
              const recentlyRemovedDateranges = skipAttrs.enumeratedString('RECENTLY-REMOVED-DATERANGES');
              if (recentlyRemovedDateranges) {
                level.recentlyRemovedDateranges = recentlyRemovedDateranges.split('\t');
              }
              break;
            }
          case 'TARGETDURATION':
            level.targetduration = Math.max(parseInt(value1), 1);
            break;
          case 'VERSION':
            level.version = parseInt(value1);
            break;
          case 'EXTM3U':
            break;
          case 'ENDLIST':
            level.live = false;
            break;
          case '#':
            if (value1 || value2) {
              frag.tagList.push(value2 ? [value1, value2] : [value1]);
            }
            break;
          case 'DISCONTINUITY':
            discontinuityCounter++;
            frag.tagList.push(['DIS']);
            break;
          case 'GAP':
            frag.gap = true;
            frag.tagList.push([tag]);
            break;
          case 'BITRATE':
            frag.tagList.push([tag, value1]);
            break;
          case 'DATERANGE':
            {
              const dateRangeAttr = new AttrList(value1);
              const dateRange = new DateRange(dateRangeAttr, level.dateRanges[dateRangeAttr.ID]);
              if (dateRange.isValid || level.skippedSegments) {
                level.dateRanges[dateRange.id] = dateRange;
              } else {
                logger.warn(`Ignoring invalid DATERANGE tag: "${value1}"`);
              }
              // Add to fragment tag list for backwards compatibility (< v1.2.0)
              frag.tagList.push(['EXT-X-DATERANGE', value1]);
              break;
            }
          case 'DEFINE':
            {
              break;
            }
          case 'DISCONTINUITY-SEQUENCE':
            discontinuityCounter = parseInt(value1);
            break;
          case 'KEY':
            {
              const levelKey = parseKey(value1, baseurl);
              if (levelKey.isSupported()) {
                if (levelKey.method === 'NONE') {
                  levelkeys = undefined;
                  break;
                }
                if (!levelkeys) {
                  levelkeys = {};
                }
                if (levelkeys[levelKey.keyFormat]) {
                  levelkeys = _extends({}, levelkeys);
                }
                levelkeys[levelKey.keyFormat] = levelKey;
              } else {
                logger.warn(`[Keys] Ignoring invalid EXT-X-KEY tag: "${value1}"`);
              }
              break;
            }
          case 'START':
            level.startTimeOffset = parseStartTimeOffset(value1);
            break;
          case 'MAP':
            {
              const mapAttrs = new AttrList(value1);
              if (frag.duration) {
                // Initial segment tag is after segment duration tag.
                //   #EXTINF: 6.0
                //   #EXT-X-MAP:URI="init.mp4
                const init = new Fragment(type, baseurl);
                setInitSegment(init, mapAttrs, id, levelkeys);
                currentInitSegment = init;
                frag.initSegment = currentInitSegment;
                if (currentInitSegment.rawProgramDateTime && !frag.rawProgramDateTime) {
                  frag.rawProgramDateTime = currentInitSegment.rawProgramDateTime;
                }
              } else {
                // Initial segment tag is before segment duration tag
                setInitSegment(frag, mapAttrs, id, levelkeys);
                currentInitSegment = frag;
                createNextFrag = true;
              }
              break;
            }
          case 'SERVER-CONTROL':
            {
              const serverControlAttrs = new AttrList(value1);
              level.canBlockReload = serverControlAttrs.bool('CAN-BLOCK-RELOAD');
              level.canSkipUntil = serverControlAttrs.optionalFloat('CAN-SKIP-UNTIL', 0);
              level.canSkipDateRanges = level.canSkipUntil > 0 && serverControlAttrs.bool('CAN-SKIP-DATERANGES');
              level.partHoldBack = serverControlAttrs.optionalFloat('PART-HOLD-BACK', 0);
              level.holdBack = serverControlAttrs.optionalFloat('HOLD-BACK', 0);
              break;
            }
          case 'PART-INF':
            {
              const partInfAttrs = new AttrList(value1);
              level.partTarget = partInfAttrs.decimalFloatingPoint('PART-TARGET');
              break;
            }
          case 'PART':
            {
              let partList = level.partList;
              if (!partList) {
                partList = level.partList = [];
              }
              const previousFragmentPart = currentPart > 0 ? partList[partList.length - 1] : undefined;
              const index = currentPart++;
              const partAttrs = new AttrList(value1);
              const part = new Part(partAttrs, frag, baseurl, index, previousFragmentPart);
              partList.push(part);
              frag.duration += part.duration;
              break;
            }
          case 'PRELOAD-HINT':
            {
              const preloadHintAttrs = new AttrList(value1);
              level.preloadHint = preloadHintAttrs;
              break;
            }
          case 'RENDITION-REPORT':
            {
              const renditionReportAttrs = new AttrList(value1);
              level.renditionReports = level.renditionReports || [];
              level.renditionReports.push(renditionReportAttrs);
              break;
            }
          default:
            logger.warn(`line parsed but not handled: ${result}`);
            break;
        }
      }
    }
    if (prevFrag && !prevFrag.relurl) {
      fragments.pop();
      totalduration -= prevFrag.duration;
      if (level.partList) {
        level.fragmentHint = prevFrag;
      }
    } else if (level.partList) {
      assignProgramDateTime(frag, prevFrag);
      frag.cc = discontinuityCounter;
      level.fragmentHint = frag;
      if (levelkeys) {
        setFragLevelKeys(frag, levelkeys, level);
      }
    }
    const fragmentLength = fragments.length;
    const firstFragment = fragments[0];
    const lastFragment = fragments[fragmentLength - 1];
    totalduration += level.skippedSegments * level.targetduration;
    if (totalduration > 0 && fragmentLength && lastFragment) {
      level.averagetargetduration = totalduration / fragmentLength;
      const lastSn = lastFragment.sn;
      level.endSN = lastSn !== 'initSegment' ? lastSn : 0;
      if (!level.live) {
        lastFragment.endList = true;
      }
      if (firstFragment) {
        level.startCC = firstFragment.cc;
      }
    } else {
      level.endSN = 0;
      level.startCC = 0;
    }
    if (level.fragmentHint) {
      totalduration += level.fragmentHint.duration;
    }
    level.totalduration = totalduration;
    level.endCC = discontinuityCounter;

    /**
     * Backfill any missing PDT values
     * "If the first EXT-X-PROGRAM-DATE-TIME tag in a Playlist appears after
     * one or more Media Segment URIs, the client SHOULD extrapolate
     * backward from that tag (using EXTINF durations and/or media
     * timestamps) to associate dates with those segments."
     * We have already extrapolated forward, but all fragments up to the first instance of PDT do not have their PDTs
     * computed.
     */
    if (firstPdtIndex > 0) {
      backfillProgramDateTimes(fragments, firstPdtIndex);
    }
    return level;
  }
}
function parseKey(keyTagAttributes, baseurl, parsed) {
  var _keyAttrs$METHOD, _keyAttrs$KEYFORMAT;
  // https://tools.ietf.org/html/rfc8216#section-4.3.2.4
  const keyAttrs = new AttrList(keyTagAttributes);
  const decryptmethod = (_keyAttrs$METHOD = keyAttrs.METHOD) != null ? _keyAttrs$METHOD : '';
  const decrypturi = keyAttrs.URI;
  const decryptiv = keyAttrs.hexadecimalInteger('IV');
  const decryptkeyformatversions = keyAttrs.KEYFORMATVERSIONS;
  // From RFC: This attribute is OPTIONAL; its absence indicates an implicit value of "identity".
  const decryptkeyformat = (_keyAttrs$KEYFORMAT = keyAttrs.KEYFORMAT) != null ? _keyAttrs$KEYFORMAT : 'identity';
  if (decrypturi && keyAttrs.IV && !decryptiv) {
    logger.error(`Invalid IV: ${keyAttrs.IV}`);
  }
  // If decrypturi is a URI with a scheme, then baseurl will be ignored
  // No uri is allowed when METHOD is NONE
  const resolvedUri = decrypturi ? M3U8Parser.resolve(decrypturi, baseurl) : '';
  const keyFormatVersions = (decryptkeyformatversions ? decryptkeyformatversions : '1').split('/').map(Number).filter(Number.isFinite);
  return new LevelKey(decryptmethod, resolvedUri, decryptkeyformat, keyFormatVersions, decryptiv);
}
function parseStartTimeOffset(startAttributes) {
  const startAttrs = new AttrList(startAttributes);
  const startTimeOffset = startAttrs.decimalFloatingPoint('TIME-OFFSET');
  if (isFiniteNumber(startTimeOffset)) {
    return startTimeOffset;
  }
  return null;
}
function setCodecs(codecs, level) {
  ['video', 'audio', 'text'].forEach(type => {
    const filtered = codecs.filter(codec => isCodecType(codec, type));
    if (filtered.length) {
      const preferred = filtered.filter(codec => {
        return codec.lastIndexOf('avc1', 0) === 0 || codec.lastIndexOf('mp4a', 0) === 0;
      });
      level[`${type}Codec`] = preferred.length > 0 ? preferred[0] : filtered[0];

      // remove from list
      codecs = codecs.filter(codec => filtered.indexOf(codec) === -1);
    }
  });
  level.unknownCodecs = codecs;
}
function assignCodec(media, groupItem, codecProperty) {
  const codecValue = groupItem[codecProperty];
  if (codecValue) {
    media[codecProperty] = codecValue;
  }
}
function backfillProgramDateTimes(fragments, firstPdtIndex) {
  let fragPrev = fragments[firstPdtIndex];
  for (let i = firstPdtIndex; i--;) {
    const frag = fragments[i];
    // Exit on delta-playlist skipped segments
    if (!frag) {
      return;
    }
    frag.programDateTime = fragPrev.programDateTime - frag.duration * 1000;
    fragPrev = frag;
  }
}
function assignProgramDateTime(frag, prevFrag) {
  if (frag.rawProgramDateTime) {
    frag.programDateTime = Date.parse(frag.rawProgramDateTime);
  } else if (prevFrag != null && prevFrag.programDateTime) {
    frag.programDateTime = prevFrag.endProgramDateTime;
  }
  if (!isFiniteNumber(frag.programDateTime)) {
    frag.programDateTime = null;
    frag.rawProgramDateTime = null;
  }
}
function setInitSegment(frag, mapAttrs, id, levelkeys) {
  frag.relurl = mapAttrs.URI;
  if (mapAttrs.BYTERANGE) {
    frag.setByteRange(mapAttrs.BYTERANGE);
  }
  frag.level = id;
  frag.sn = 'initSegment';
  if (levelkeys) {
    frag.levelkeys = levelkeys;
  }
  frag.initSegment = null;
}
function setFragLevelKeys(frag, levelkeys, level) {
  frag.levelkeys = levelkeys;
  const {
    encryptedFragments
  } = level;
  if ((!encryptedFragments.length || encryptedFragments[encryptedFragments.length - 1].levelkeys !== levelkeys) && Object.keys(levelkeys).some(format => levelkeys[format].isCommonEncryption)) {
    encryptedFragments.push(frag);
  }
}

var PlaylistContextType = {
  MANIFEST: "manifest",
  LEVEL: "level",
  AUDIO_TRACK: "audioTrack",
  SUBTITLE_TRACK: "subtitleTrack"
};
var PlaylistLevelType = {
  MAIN: "main",
  AUDIO: "audio",
  SUBTITLE: "subtitle"
};

function mapContextToLevelType(context) {
  const {
    type
  } = context;
  switch (type) {
    case PlaylistContextType.AUDIO_TRACK:
      return PlaylistLevelType.AUDIO;
    case PlaylistContextType.SUBTITLE_TRACK:
      return PlaylistLevelType.SUBTITLE;
    default:
      return PlaylistLevelType.MAIN;
  }
}
function getResponseUrl(response, context) {
  let url = response.url;
  // responseURL not supported on some browsers (it is used to detect URL redirection)
  // data-uri mode also not supported (but no need to detect redirection)
  if (url === undefined || url.indexOf('data:') === 0) {
    // fallback to initial URL
    url = context.url;
  }
  return url;
}
class PlaylistLoader {
  constructor(hls) {
    this.hls = void 0;
    this.loaders = Object.create(null);
    this.variableList = null;
    this.hls = hls;
    this.registerListeners();
  }
  startLoad(startPosition) {}
  stopLoad() {
    this.destroyInternalLoaders();
  }
  registerListeners() {
    const {
      hls
    } = this;
    hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.on(Events.LEVEL_LOADING, this.onLevelLoading, this);
    hls.on(Events.AUDIO_TRACK_LOADING, this.onAudioTrackLoading, this);
    hls.on(Events.SUBTITLE_TRACK_LOADING, this.onSubtitleTrackLoading, this);
  }
  unregisterListeners() {
    const {
      hls
    } = this;
    hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.off(Events.LEVEL_LOADING, this.onLevelLoading, this);
    hls.off(Events.AUDIO_TRACK_LOADING, this.onAudioTrackLoading, this);
    hls.off(Events.SUBTITLE_TRACK_LOADING, this.onSubtitleTrackLoading, this);
  }

  /**
   * Returns defaults or configured loader-type overloads (pLoader and loader config params)
   */
  createInternalLoader(context) {
    const config = this.hls.config;
    const PLoader = config.pLoader;
    const Loader = config.loader;
    const InternalLoader = PLoader || Loader;
    const loader = new InternalLoader(config);
    this.loaders[context.type] = loader;
    return loader;
  }
  getInternalLoader(context) {
    return this.loaders[context.type];
  }
  resetInternalLoader(contextType) {
    if (this.loaders[contextType]) {
      delete this.loaders[contextType];
    }
  }

  /**
   * Call `destroy` on all internal loader instances mapped (one per context type)
   */
  destroyInternalLoaders() {
    for (const contextType in this.loaders) {
      const loader = this.loaders[contextType];
      if (loader) {
        loader.destroy();
      }
      this.resetInternalLoader(contextType);
    }
  }
  destroy() {
    this.variableList = null;
    this.unregisterListeners();
    this.destroyInternalLoaders();
  }
  onManifestLoading(event, data) {
    const {
      url
    } = data;
    this.variableList = null;
    this.load({
      id: null,
      level: 0,
      responseType: 'text',
      type: PlaylistContextType.MANIFEST,
      url,
      deliveryDirectives: null
    });
  }
  onLevelLoading(event, data) {
    const {
      id,
      level,
      url,
      deliveryDirectives
    } = data;
    this.load({
      id,
      level,
      responseType: 'text',
      type: PlaylistContextType.LEVEL,
      url,
      deliveryDirectives
    });
  }
  onAudioTrackLoading(event, data) {
    const {
      id,
      groupId,
      url,
      deliveryDirectives
    } = data;
    this.load({
      id,
      groupId,
      level: null,
      responseType: 'text',
      type: PlaylistContextType.AUDIO_TRACK,
      url,
      deliveryDirectives
    });
  }
  onSubtitleTrackLoading(event, data) {
    const {
      id,
      groupId,
      url,
      deliveryDirectives
    } = data;
    this.load({
      id,
      groupId,
      level: null,
      responseType: 'text',
      type: PlaylistContextType.SUBTITLE_TRACK,
      url,
      deliveryDirectives
    });
  }
  load(context) {
    var _context$deliveryDire;
    const config = this.hls.config;

    // logger.debug(`[playlist-loader]: Loading playlist of type ${context.type}, level: ${context.level}, id: ${context.id}`);

    // Check if a loader for this context already exists
    let loader = this.getInternalLoader(context);
    if (loader) {
      const loaderContext = loader.context;
      if (loaderContext && loaderContext.url === context.url) {
        // same URL can't overlap
        logger.trace('[playlist-loader]: playlist request ongoing');
        return;
      }
      logger.log(`[playlist-loader]: aborting previous loader for type: ${context.type}`);
      loader.abort();
    }

    // apply different configs for retries depending on
    // context (manifest, level, audio/subs playlist)
    let loadPolicy;
    if (context.type === PlaylistContextType.MANIFEST) {
      loadPolicy = config.manifestLoadPolicy.default;
    } else {
      loadPolicy = _extends({}, config.playlistLoadPolicy.default, {
        timeoutRetry: null,
        errorRetry: null
      });
    }
    loader = this.createInternalLoader(context);

    // Override level/track timeout for LL-HLS requests
    // (the default of 10000ms is counter productive to blocking playlist reload requests)
    if ((_context$deliveryDire = context.deliveryDirectives) != null && _context$deliveryDire.part) {
      let levelDetails;
      if (context.type === PlaylistContextType.LEVEL && context.level !== null) {
        levelDetails = this.hls.levels[context.level].details;
      } else if (context.type === PlaylistContextType.AUDIO_TRACK && context.id !== null) {
        levelDetails = this.hls.audioTracks[context.id].details;
      } else if (context.type === PlaylistContextType.SUBTITLE_TRACK && context.id !== null) {
        levelDetails = this.hls.subtitleTracks[context.id].details;
      }
      if (levelDetails) {
        const partTarget = levelDetails.partTarget;
        const targetDuration = levelDetails.targetduration;
        if (partTarget && targetDuration) {
          const maxLowLatencyPlaylistRefresh = Math.max(partTarget * 3, targetDuration * 0.8) * 1000;
          loadPolicy = _extends({}, loadPolicy, {
            maxTimeToFirstByteMs: Math.min(maxLowLatencyPlaylistRefresh, loadPolicy.maxTimeToFirstByteMs),
            maxLoadTimeMs: Math.min(maxLowLatencyPlaylistRefresh, loadPolicy.maxTimeToFirstByteMs)
          });
        }
      }
    }
    const legacyRetryCompatibility = loadPolicy.errorRetry || loadPolicy.timeoutRetry || {};
    const loaderConfig = {
      loadPolicy,
      timeout: loadPolicy.maxLoadTimeMs,
      maxRetry: legacyRetryCompatibility.maxNumRetry || 0,
      retryDelay: legacyRetryCompatibility.retryDelayMs || 0,
      maxRetryDelay: legacyRetryCompatibility.maxRetryDelayMs || 0
    };
    const loaderCallbacks = {
      onSuccess: (response, stats, context, networkDetails) => {
        const loader = this.getInternalLoader(context);
        this.resetInternalLoader(context.type);
        const string = response.data;

        // Validate if it is an M3U8 at all
        if (string.indexOf('#EXTM3U') !== 0) {
          this.handleManifestParsingError(response, context, new Error('no EXTM3U delimiter'), networkDetails || null, stats);
          return;
        }
        stats.parsing.start = performance.now();
        if (M3U8Parser.isMediaPlaylist(string)) {
          this.handleTrackOrLevelPlaylist(response, stats, context, networkDetails || null, loader);
        } else {
          this.handleMasterPlaylist(response, stats, context, networkDetails);
        }
      },
      onError: (response, context, networkDetails, stats) => {
        this.handleNetworkError(context, networkDetails, false, response, stats);
      },
      onTimeout: (stats, context, networkDetails) => {
        this.handleNetworkError(context, networkDetails, true, undefined, stats);
      }
    };

    // logger.debug(`[playlist-loader]: Calling internal loader delegate for URL: ${context.url}`);

    loader.load(context, loaderConfig, loaderCallbacks);
  }
  handleMasterPlaylist(response, stats, context, networkDetails) {
    const hls = this.hls;
    const string = response.data;
    const url = getResponseUrl(response, context);
    const parsedResult = M3U8Parser.parseMasterPlaylist(string, url);
    if (parsedResult.playlistParsingError) {
      this.handleManifestParsingError(response, context, parsedResult.playlistParsingError, networkDetails, stats);
      return;
    }
    const {
      contentSteering,
      levels,
      sessionData,
      sessionKeys,
      startTimeOffset,
      variableList
    } = parsedResult;
    this.variableList = variableList;
    const {
      AUDIO: audioTracks = [],
      SUBTITLES: subtitles,
      'CLOSED-CAPTIONS': captions
    } = M3U8Parser.parseMasterPlaylistMedia(string, url, parsedResult);
    if (audioTracks.length) {
      // check if we have found an audio track embedded in main playlist (audio track without URI attribute)
      const embeddedAudioFound = audioTracks.some(audioTrack => !audioTrack.url);

      // if no embedded audio track defined, but audio codec signaled in quality level,
      // we need to signal this main audio track this could happen with playlists with
      // alt audio rendition in which quality levels (main)
      // contains both audio+video. but with mixed audio track not signaled
      if (!embeddedAudioFound && levels[0].audioCodec && !levels[0].attrs.AUDIO) {
        logger.log('[playlist-loader]: audio codec signaled in quality level, but no embedded audio track signaled, create one');
        audioTracks.unshift({
          type: 'main',
          name: 'main',
          groupId: 'main',
          default: false,
          autoselect: false,
          forced: false,
          id: -1,
          attrs: new AttrList({}),
          bitrate: 0,
          url: ''
        });
      }
    }
    hls.trigger(Events.MANIFEST_LOADED, {
      levels,
      audioTracks,
      subtitles,
      captions,
      contentSteering,
      url,
      stats,
      networkDetails,
      sessionData,
      sessionKeys,
      startTimeOffset,
      variableList
    });
  }
  handleTrackOrLevelPlaylist(response, stats, context, networkDetails, loader) {
    const hls = this.hls;
    const {
      id,
      level,
      type
    } = context;
    const url = getResponseUrl(response, context);
    const levelUrlId = isFiniteNumber(id) ? id : 0;
    const levelId = isFiniteNumber(level) ? level : levelUrlId;
    const levelType = mapContextToLevelType(context);
    const levelDetails = M3U8Parser.parseLevelPlaylist(response.data, url, levelId, levelType, levelUrlId, this.variableList);

    // We have done our first request (Manifest-type) and receive
    // not a master playlist but a chunk-list (track/level)
    // We fire the manifest-loaded event anyway with the parsed level-details
    // by creating a single-level structure for it.
    if (type === PlaylistContextType.MANIFEST) {
      const singleLevel = {
        attrs: new AttrList({}),
        bitrate: 0,
        details: levelDetails,
        name: '',
        url
      };
      hls.trigger(Events.MANIFEST_LOADED, {
        levels: [singleLevel],
        audioTracks: [],
        url,
        stats,
        networkDetails,
        sessionData: null,
        sessionKeys: null,
        contentSteering: null,
        startTimeOffset: null,
        variableList: null
      });
    }

    // save parsing time
    stats.parsing.end = performance.now();

    // extend the context with the new levelDetails property
    context.levelDetails = levelDetails;
    this.handlePlaylistLoaded(levelDetails, response, stats, context, networkDetails, loader);
  }
  handleManifestParsingError(response, context, error, networkDetails, stats) {
    this.hls.trigger(Events.ERROR, {
      type: ErrorTypes.NETWORK_ERROR,
      details: ErrorDetails.MANIFEST_PARSING_ERROR,
      fatal: context.type === PlaylistContextType.MANIFEST,
      url: response.url,
      err: error,
      error,
      reason: error.message,
      response,
      context,
      networkDetails,
      stats
    });
  }
  handleNetworkError(context, networkDetails, timeout = false, response, stats) {
    let message = `A network ${timeout ? 'timeout' : 'error' + (response ? ' (status ' + response.code + ')' : '')} occurred while loading ${context.type}`;
    if (context.type === PlaylistContextType.LEVEL) {
      message += `: ${context.level} id: ${context.id}`;
    } else if (context.type === PlaylistContextType.AUDIO_TRACK || context.type === PlaylistContextType.SUBTITLE_TRACK) {
      message += ` id: ${context.id} group-id: "${context.groupId}"`;
    }
    const error = new Error(message);
    logger.warn(`[playlist-loader]: ${message}`);
    let details = ErrorDetails.UNKNOWN;
    let fatal = false;
    const loader = this.getInternalLoader(context);
    switch (context.type) {
      case PlaylistContextType.MANIFEST:
        details = timeout ? ErrorDetails.MANIFEST_LOAD_TIMEOUT : ErrorDetails.MANIFEST_LOAD_ERROR;
        fatal = true;
        break;
      case PlaylistContextType.LEVEL:
        details = timeout ? ErrorDetails.LEVEL_LOAD_TIMEOUT : ErrorDetails.LEVEL_LOAD_ERROR;
        fatal = false;
        break;
      case PlaylistContextType.AUDIO_TRACK:
        details = timeout ? ErrorDetails.AUDIO_TRACK_LOAD_TIMEOUT : ErrorDetails.AUDIO_TRACK_LOAD_ERROR;
        fatal = false;
        break;
      case PlaylistContextType.SUBTITLE_TRACK:
        details = timeout ? ErrorDetails.SUBTITLE_TRACK_LOAD_TIMEOUT : ErrorDetails.SUBTITLE_LOAD_ERROR;
        fatal = false;
        break;
    }
    if (loader) {
      this.resetInternalLoader(context.type);
    }
    const errorData = {
      type: ErrorTypes.NETWORK_ERROR,
      details,
      fatal,
      url: context.url,
      loader,
      context,
      error,
      networkDetails,
      stats
    };
    if (response) {
      const url = (networkDetails == null ? void 0 : networkDetails.url) || context.url;
      errorData.response = _objectSpread2({
        url,
        data: undefined
      }, response);
    }
    this.hls.trigger(Events.ERROR, errorData);
  }
  handlePlaylistLoaded(levelDetails, response, stats, context, networkDetails, loader) {
    const hls = this.hls;
    const {
      type,
      level,
      id,
      groupId,
      deliveryDirectives
    } = context;
    const url = getResponseUrl(response, context);
    const parent = mapContextToLevelType(context);
    const levelIndex = typeof context.level === 'number' && parent === PlaylistLevelType.MAIN ? level : undefined;
    if (!levelDetails.fragments.length) {
      const _error = new Error('No Segments found in Playlist');
      hls.trigger(Events.ERROR, {
        type: ErrorTypes.NETWORK_ERROR,
        details: ErrorDetails.LEVEL_EMPTY_ERROR,
        fatal: false,
        url,
        error: _error,
        reason: _error.message,
        response,
        context,
        level: levelIndex,
        parent,
        networkDetails,
        stats
      });
      return;
    }
    if (!levelDetails.targetduration) {
      levelDetails.playlistParsingError = new Error('Missing Target Duration');
    }
    const error = levelDetails.playlistParsingError;
    if (error) {
      hls.trigger(Events.ERROR, {
        type: ErrorTypes.NETWORK_ERROR,
        details: ErrorDetails.LEVEL_PARSING_ERROR,
        fatal: false,
        url,
        error,
        reason: error.message,
        response,
        context,
        level: levelIndex,
        parent,
        networkDetails,
        stats
      });
      return;
    }
    if (levelDetails.live && loader) {
      if (loader.getCacheAge) {
        levelDetails.ageHeader = loader.getCacheAge() || 0;
      }
      if (!loader.getCacheAge || isNaN(levelDetails.ageHeader)) {
        levelDetails.ageHeader = 0;
      }
    }
    switch (type) {
      case PlaylistContextType.MANIFEST:
      case PlaylistContextType.LEVEL:
        hls.trigger(Events.LEVEL_LOADED, {
          details: levelDetails,
          level: levelIndex || 0,
          id: id || 0,
          stats,
          networkDetails,
          deliveryDirectives
        });
        break;
      case PlaylistContextType.AUDIO_TRACK:
        hls.trigger(Events.AUDIO_TRACK_LOADED, {
          details: levelDetails,
          id: id || 0,
          groupId: groupId || '',
          stats,
          networkDetails,
          deliveryDirectives
        });
        break;
      case PlaylistContextType.SUBTITLE_TRACK:
        hls.trigger(Events.SUBTITLE_TRACK_LOADED, {
          details: levelDetails,
          id: id || 0,
          groupId: groupId || '',
          stats,
          networkDetails,
          deliveryDirectives
        });
        break;
    }
  }
}

function sendAddTrackEvent(track, videoEl) {
  let event;
  try {
    event = new Event('addtrack');
  } catch (err) {
    // for IE11
    event = document.createEvent('Event');
    event.initEvent('addtrack', false, false);
  }
  event.track = track;
  videoEl.dispatchEvent(event);
}
function clearCurrentCues(track) {
  // When track.mode is disabled, track.cues will be null.
  // To guarantee the removal of cues, we need to temporarily
  // change the mode to hidden
  const mode = track.mode;
  if (mode === 'disabled') {
    track.mode = 'hidden';
  }
  if (track.cues) {
    for (let i = track.cues.length; i--;) {
      track.removeCue(track.cues[i]);
    }
  }
  if (mode === 'disabled') {
    track.mode = mode;
  }
}
function removeCuesInRange(track, start, end, predicate) {
  const mode = track.mode;
  if (mode === 'disabled') {
    track.mode = 'hidden';
  }
  if (track.cues && track.cues.length > 0) {
    const cues = getCuesInRange(track.cues, start, end);
    for (let i = 0; i < cues.length; i++) {
      if (!predicate || predicate(cues[i])) {
        track.removeCue(cues[i]);
      }
    }
  }
  if (mode === 'disabled') {
    track.mode = mode;
  }
}

// Find first cue starting after given time.
// Modified version of binary search O(log(n)).
function getFirstCueIndexAfterTime(cues, time) {
  // If first cue starts after time, start there
  if (time < cues[0].startTime) {
    return 0;
  }
  // If the last cue ends before time there is no overlap
  const len = cues.length - 1;
  if (time > cues[len].endTime) {
    return -1;
  }
  let left = 0;
  let right = len;
  while (left <= right) {
    const mid = Math.floor((right + left) / 2);
    if (time < cues[mid].startTime) {
      right = mid - 1;
    } else if (time > cues[mid].startTime && left < len) {
      left = mid + 1;
    } else {
      // If it's not lower or higher, it must be equal.
      return mid;
    }
  }
  // At this point, left and right have swapped.
  // No direct match was found, left or right element must be the closest. Check which one has the smallest diff.
  return cues[left].startTime - time < time - cues[right].startTime ? left : right;
}
function getCuesInRange(cues, start, end) {
  const cuesFound = [];
  const firstCueInRange = getFirstCueIndexAfterTime(cues, start);
  if (firstCueInRange > -1) {
    for (let i = firstCueInRange, len = cues.length; i < len; i++) {
      const cue = cues[i];
      if (cue.startTime >= start && cue.endTime <= end) {
        cuesFound.push(cue);
      } else if (cue.startTime > end) {
        return cuesFound;
      }
    }
  }
  return cuesFound;
}

var MetadataSchema = {
  audioId3: "org.id3",
  dateRange: "com.apple.quicktime.HLS",
  emsg: "https://aomedia.org/emsg/ID3"
};

const MIN_CUE_DURATION = 0.25;
function getCueClass() {
  if (typeof self === 'undefined') return undefined;

  // Attempt to recreate Safari functionality by creating
  // WebKitDataCue objects when available and store the decoded
  // ID3 data in the value property of the cue
  return self.WebKitDataCue || self.VTTCue || self.TextTrackCue;
}

// VTTCue latest draft allows an infinite duration, fallback
// to MAX_VALUE if necessary
const MAX_CUE_ENDTIME = (() => {
  const Cue = getCueClass();
  try {
    new Cue(0, Number.POSITIVE_INFINITY, '');
  } catch (e) {
    return Number.MAX_VALUE;
  }
  return Number.POSITIVE_INFINITY;
})();
function dateRangeDateToTimelineSeconds(date, offset) {
  return date.getTime() / 1000 - offset;
}
function hexToArrayBuffer(str) {
  return Uint8Array.from(str.replace(/^0x/, '').replace(/([\da-fA-F]{2}) ?/g, '0x$1 ').replace(/ +$/, '').split(' ')).buffer;
}
class ID3TrackController {
  constructor(hls) {
    this.hls = void 0;
    this.id3Track = null;
    this.media = null;
    this.dateRangeCuesAppended = {};
    this.hls = hls;
    this._registerListeners();
  }
  destroy() {
    this._unregisterListeners();
    this.id3Track = null;
    this.media = null;
    this.dateRangeCuesAppended = {};
    // @ts-ignore
    this.hls = null;
  }
  _registerListeners() {
    const {
      hls
    } = this;
    hls.on(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    hls.on(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.on(Events.FRAG_PARSING_METADATA, this.onFragParsingMetadata, this);
    hls.on(Events.BUFFER_FLUSHING, this.onBufferFlushing, this);
    hls.on(Events.LEVEL_UPDATED, this.onLevelUpdated, this);
  }
  _unregisterListeners() {
    const {
      hls
    } = this;
    hls.off(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    hls.off(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.off(Events.FRAG_PARSING_METADATA, this.onFragParsingMetadata, this);
    hls.off(Events.BUFFER_FLUSHING, this.onBufferFlushing, this);
    hls.off(Events.LEVEL_UPDATED, this.onLevelUpdated, this);
  }

  // Add ID3 metatadata text track.
  onMediaAttached(event, data) {
    this.media = data.media;
  }
  onMediaDetaching() {
    if (!this.id3Track) {
      return;
    }
    clearCurrentCues(this.id3Track);
    this.id3Track = null;
    this.media = null;
    this.dateRangeCuesAppended = {};
  }
  onManifestLoading() {
    this.dateRangeCuesAppended = {};
  }
  createTrack(media) {
    const track = this.getID3Track(media.textTracks);
    track.mode = 'hidden';
    return track;
  }
  getID3Track(textTracks) {
    if (!this.media) {
      return;
    }
    for (let i = 0; i < textTracks.length; i++) {
      const textTrack = textTracks[i];
      if (textTrack.kind === 'metadata' && textTrack.label === 'id3') {
        // send 'addtrack' when reusing the textTrack for metadata,
        // same as what we do for captions
        sendAddTrackEvent(textTrack, this.media);
        return textTrack;
      }
    }
    return this.media.addTextTrack('metadata', 'id3');
  }
  onFragParsingMetadata(event, data) {
    if (!this.media) {
      return;
    }
    const {
      hls: {
        config: {
          enableEmsgMetadataCues,
          enableID3MetadataCues
        }
      }
    } = this;
    if (!enableEmsgMetadataCues && !enableID3MetadataCues) {
      return;
    }
    const {
      samples
    } = data;

    // create track dynamically
    if (!this.id3Track) {
      this.id3Track = this.createTrack(this.media);
    }
    const Cue = getCueClass();
    for (let i = 0; i < samples.length; i++) {
      const type = samples[i].type;
      if (type === MetadataSchema.emsg && !enableEmsgMetadataCues || !enableID3MetadataCues) {
        continue;
      }
      const frames = getID3Frames(samples[i].data);
      if (frames) {
        const startTime = samples[i].pts;
        let endTime = startTime + samples[i].duration;
        if (endTime > MAX_CUE_ENDTIME) {
          endTime = MAX_CUE_ENDTIME;
        }
        const timeDiff = endTime - startTime;
        if (timeDiff <= 0) {
          endTime = startTime + MIN_CUE_DURATION;
        }
        for (let j = 0; j < frames.length; j++) {
          const frame = frames[j];
          // Safari doesn't put the timestamp frame in the TextTrack
          if (!isTimeStampFrame(frame)) {
            // add a bounds to any unbounded cues
            this.updateId3CueEnds(startTime, type);
            const cue = new Cue(startTime, endTime, '');
            cue.value = frame;
            if (type) {
              cue.type = type;
            }
            this.id3Track.addCue(cue);
          }
        }
      }
    }
  }
  updateId3CueEnds(startTime, type) {
    var _this$id3Track;
    const cues = (_this$id3Track = this.id3Track) == null ? void 0 : _this$id3Track.cues;
    if (cues) {
      for (let i = cues.length; i--;) {
        const cue = cues[i];
        if (cue.type === type && cue.startTime < startTime && cue.endTime === MAX_CUE_ENDTIME) {
          cue.endTime = startTime;
        }
      }
    }
  }
  onBufferFlushing(event, {
    startOffset,
    endOffset,
    type
  }) {
    const {
      id3Track,
      hls
    } = this;
    if (!hls) {
      return;
    }
    const {
      config: {
        enableEmsgMetadataCues,
        enableID3MetadataCues
      }
    } = hls;
    if (id3Track && (enableEmsgMetadataCues || enableID3MetadataCues)) {
      let predicate;
      if (type === 'audio') {
        predicate = cue => cue.type === MetadataSchema.audioId3 && enableID3MetadataCues;
      } else if (type === 'video') {
        predicate = cue => cue.type === MetadataSchema.emsg && enableEmsgMetadataCues;
      } else {
        predicate = cue => cue.type === MetadataSchema.audioId3 && enableID3MetadataCues || cue.type === MetadataSchema.emsg && enableEmsgMetadataCues;
      }
      removeCuesInRange(id3Track, startOffset, endOffset, predicate);
    }
  }
  onLevelUpdated(event, {
    details
  }) {
    if (!this.media || !details.hasProgramDateTime || !this.hls.config.enableDateRangeMetadataCues) {
      return;
    }
    const {
      dateRangeCuesAppended,
      id3Track
    } = this;
    const {
      dateRanges
    } = details;
    const ids = Object.keys(dateRanges);
    // Remove cues from track not found in details.dateRanges
    if (id3Track) {
      const idsToRemove = Object.keys(dateRangeCuesAppended).filter(id => !ids.includes(id));
      for (let i = idsToRemove.length; i--;) {
        const id = idsToRemove[i];
        Object.keys(dateRangeCuesAppended[id].cues).forEach(key => {
          id3Track.removeCue(dateRangeCuesAppended[id].cues[key]);
        });
        delete dateRangeCuesAppended[id];
      }
    }
    // Exit if the playlist does not have Date Ranges or does not have Program Date Time
    const lastFragment = details.fragments[details.fragments.length - 1];
    if (ids.length === 0 || !isFiniteNumber(lastFragment == null ? void 0 : lastFragment.programDateTime)) {
      return;
    }
    if (!this.id3Track) {
      this.id3Track = this.createTrack(this.media);
    }
    const dateTimeOffset = lastFragment.programDateTime / 1000 - lastFragment.start;
    const Cue = getCueClass();
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const dateRange = dateRanges[id];
      const appendedDateRangeCues = dateRangeCuesAppended[id];
      const cues = (appendedDateRangeCues == null ? void 0 : appendedDateRangeCues.cues) || {};
      let durationKnown = (appendedDateRangeCues == null ? void 0 : appendedDateRangeCues.durationKnown) || false;
      const startTime = dateRangeDateToTimelineSeconds(dateRange.startDate, dateTimeOffset);
      let endTime = MAX_CUE_ENDTIME;
      const endDate = dateRange.endDate;
      if (endDate) {
        endTime = dateRangeDateToTimelineSeconds(endDate, dateTimeOffset);
        durationKnown = true;
      } else if (dateRange.endOnNext && !durationKnown) {
        const nextDateRangeWithSameClass = ids.reduce((filterMapArray, id) => {
          const candidate = dateRanges[id];
          if (candidate.class === dateRange.class && candidate.id !== id && candidate.startDate > dateRange.startDate) {
            filterMapArray.push(candidate);
          }
          return filterMapArray;
        }, []).sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0];
        if (nextDateRangeWithSameClass) {
          endTime = dateRangeDateToTimelineSeconds(nextDateRangeWithSameClass.startDate, dateTimeOffset);
          durationKnown = true;
        }
      }
      const attributes = Object.keys(dateRange.attr);
      for (let j = 0; j < attributes.length; j++) {
        const key = attributes[j];
        if (!isDateRangeCueAttribute(key)) {
          continue;
        }
        let cue = cues[key];
        if (cue) {
          if (durationKnown && !appendedDateRangeCues.durationKnown) {
            cue.endTime = endTime;
          }
        } else {
          let data = dateRange.attr[key];
          cue = new Cue(startTime, endTime, '');
          if (isSCTE35Attribute(key)) {
            data = hexToArrayBuffer(data);
          }
          cue.value = {
            key,
            data
          };
          cue.type = MetadataSchema.dateRange;
          cue.id = id;
          this.id3Track.addCue(cue);
          cues[key] = cue;
        }
      }
      dateRangeCuesAppended[id] = {
        cues,
        dateRange,
        durationKnown
      };
    }
  }
}

class LatencyController {
  constructor(hls) {
    this.hls = void 0;
    this.config = void 0;
    this.media = null;
    this.levelDetails = null;
    this.currentTime = 0;
    this.stallCount = 0;
    this._latency = null;
    this.timeupdateHandler = () => this.timeupdate();
    this.hls = hls;
    this.config = hls.config;
    this.registerListeners();
  }
  get latency() {
    return this._latency || 0;
  }
  get maxLatency() {
    const {
      config,
      levelDetails
    } = this;
    if (config.liveMaxLatencyDuration !== undefined) {
      return config.liveMaxLatencyDuration;
    }
    return levelDetails ? config.liveMaxLatencyDurationCount * levelDetails.targetduration : 0;
  }
  get targetLatency() {
    const {
      levelDetails
    } = this;
    if (levelDetails === null) {
      return null;
    }
    const {
      holdBack,
      partHoldBack,
      targetduration
    } = levelDetails;
    const {
      liveSyncDuration,
      liveSyncDurationCount,
      lowLatencyMode
    } = this.config;
    const userConfig = this.hls.userConfig;
    let targetLatency = lowLatencyMode ? partHoldBack || holdBack : holdBack;
    if (userConfig.liveSyncDuration || userConfig.liveSyncDurationCount || targetLatency === 0) {
      targetLatency = liveSyncDuration !== undefined ? liveSyncDuration : liveSyncDurationCount * targetduration;
    }
    const maxLiveSyncOnStallIncrease = targetduration;
    const liveSyncOnStallIncrease = 1.0;
    return targetLatency + Math.min(this.stallCount * liveSyncOnStallIncrease, maxLiveSyncOnStallIncrease);
  }
  get liveSyncPosition() {
    const liveEdge = this.estimateLiveEdge();
    const targetLatency = this.targetLatency;
    const levelDetails = this.levelDetails;
    if (liveEdge === null || targetLatency === null || levelDetails === null) {
      return null;
    }
    const edge = levelDetails.edge;
    const syncPosition = liveEdge - targetLatency - this.edgeStalled;
    const min = edge - levelDetails.totalduration;
    const max = edge - (this.config.lowLatencyMode && levelDetails.partTarget || levelDetails.targetduration);
    return Math.min(Math.max(min, syncPosition), max);
  }
  get drift() {
    const {
      levelDetails
    } = this;
    if (levelDetails === null) {
      return 1;
    }
    return levelDetails.drift;
  }
  get edgeStalled() {
    const {
      levelDetails
    } = this;
    if (levelDetails === null) {
      return 0;
    }
    const maxLevelUpdateAge = (this.config.lowLatencyMode && levelDetails.partTarget || levelDetails.targetduration) * 3;
    return Math.max(levelDetails.age - maxLevelUpdateAge, 0);
  }
  get forwardBufferLength() {
    const {
      media,
      levelDetails
    } = this;
    if (!media || !levelDetails) {
      return 0;
    }
    const bufferedRanges = media.buffered.length;
    return (bufferedRanges ? media.buffered.end(bufferedRanges - 1) : levelDetails.edge) - this.currentTime;
  }
  destroy() {
    this.unregisterListeners();
    this.onMediaDetaching();
    this.levelDetails = null;
    // @ts-ignore
    this.hls = this.timeupdateHandler = null;
  }
  registerListeners() {
    this.hls.on(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    this.hls.on(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    this.hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    this.hls.on(Events.LEVEL_UPDATED, this.onLevelUpdated, this);
    this.hls.on(Events.ERROR, this.onError, this);
  }
  unregisterListeners() {
    this.hls.off(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    this.hls.off(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    this.hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    this.hls.off(Events.LEVEL_UPDATED, this.onLevelUpdated, this);
    this.hls.off(Events.ERROR, this.onError, this);
  }
  onMediaAttached(event, data) {
    this.media = data.media;
    this.media.addEventListener('timeupdate', this.timeupdateHandler);
  }
  onMediaDetaching() {
    if (this.media) {
      this.media.removeEventListener('timeupdate', this.timeupdateHandler);
      this.media = null;
    }
  }
  onManifestLoading() {
    this.levelDetails = null;
    this._latency = null;
    this.stallCount = 0;
  }
  onLevelUpdated(event, {
    details
  }) {
    this.levelDetails = details;
    if (details.advanced) {
      this.timeupdate();
    }
    if (!details.live && this.media) {
      this.media.removeEventListener('timeupdate', this.timeupdateHandler);
    }
  }
  onError(event, data) {
    var _this$levelDetails;
    if (data.details !== ErrorDetails.BUFFER_STALLED_ERROR) {
      return;
    }
    this.stallCount++;
    if ((_this$levelDetails = this.levelDetails) != null && _this$levelDetails.live) {
      logger.warn('[playback-rate-controller]: Stall detected, adjusting target latency');
    }
  }
  timeupdate() {
    const {
      media,
      levelDetails
    } = this;
    if (!media || !levelDetails) {
      return;
    }
    this.currentTime = media.currentTime;
    const latency = this.computeLatency();
    if (latency === null) {
      return;
    }
    this._latency = latency;

    // Adapt playbackRate to meet target latency in low-latency mode
    const {
      lowLatencyMode,
      maxLiveSyncPlaybackRate
    } = this.config;
    if (!lowLatencyMode || maxLiveSyncPlaybackRate === 1) {
      return;
    }
    const targetLatency = this.targetLatency;
    if (targetLatency === null) {
      return;
    }
    const distanceFromTarget = latency - targetLatency;
    // Only adjust playbackRate when within one target duration of targetLatency
    // and more than one second from under-buffering.
    // Playback further than one target duration from target can be considered DVR playback.
    const liveMinLatencyDuration = Math.min(this.maxLatency, targetLatency + levelDetails.targetduration);
    const inLiveRange = distanceFromTarget < liveMinLatencyDuration;
    if (levelDetails.live && inLiveRange && distanceFromTarget > 0.05 && this.forwardBufferLength > 1) {
      const max = Math.min(2, Math.max(1.0, maxLiveSyncPlaybackRate));
      const rate = Math.round(2 / (1 + Math.exp(-0.75 * distanceFromTarget - this.edgeStalled)) * 20) / 20;
      media.playbackRate = Math.min(max, Math.max(1, rate));
    } else if (media.playbackRate !== 1 && media.playbackRate !== 0) {
      media.playbackRate = 1;
    }
  }
  estimateLiveEdge() {
    const {
      levelDetails
    } = this;
    if (levelDetails === null) {
      return null;
    }
    return levelDetails.edge + levelDetails.age;
  }
  computeLatency() {
    const liveEdge = this.estimateLiveEdge();
    if (liveEdge === null) {
      return null;
    }
    return liveEdge - this.currentTime;
  }
}

const HdcpLevels = ['NONE', 'TYPE-0', 'TYPE-1', null];
var HlsSkip = {
  No: "",
  Yes: "YES",
  v2: "v2"
};
function getSkipValue(details, msn) {
  const {
    canSkipUntil,
    canSkipDateRanges,
    endSN
  } = details;
  const snChangeGoal = msn !== undefined ? msn - endSN : 0;
  if (canSkipUntil && snChangeGoal < canSkipUntil) {
    if (canSkipDateRanges) {
      return HlsSkip.v2;
    }
    return HlsSkip.Yes;
  }
  return HlsSkip.No;
}
class HlsUrlParameters {
  constructor(msn, part, skip) {
    this.msn = void 0;
    this.part = void 0;
    this.skip = void 0;
    this.msn = msn;
    this.part = part;
    this.skip = skip;
  }
  addDirectives(uri) {
    const url = new self.URL(uri);
    if (this.msn !== undefined) {
      url.searchParams.set('_HLS_msn', this.msn.toString());
    }
    if (this.part !== undefined) {
      url.searchParams.set('_HLS_part', this.part.toString());
    }
    if (this.skip) {
      url.searchParams.set('_HLS_skip', this.skip);
    }
    return url.href;
  }
}
class Level {
  constructor(data) {
    this._attrs = void 0;
    this.audioCodec = void 0;
    this.bitrate = void 0;
    this.codecSet = void 0;
    this.height = void 0;
    this.id = void 0;
    this.name = void 0;
    this.videoCodec = void 0;
    this.width = void 0;
    this.unknownCodecs = void 0;
    this.audioGroupIds = void 0;
    this.details = void 0;
    this.fragmentError = 0;
    this.loadError = 0;
    this.loaded = void 0;
    this.realBitrate = 0;
    this.textGroupIds = void 0;
    this.url = void 0;
    this._urlId = 0;
    this.url = [data.url];
    this._attrs = [data.attrs];
    this.bitrate = data.bitrate;
    if (data.details) {
      this.details = data.details;
    }
    this.id = data.id || 0;
    this.name = data.name;
    this.width = data.width || 0;
    this.height = data.height || 0;
    this.audioCodec = data.audioCodec;
    this.videoCodec = data.videoCodec;
    this.unknownCodecs = data.unknownCodecs;
    this.codecSet = [data.videoCodec, data.audioCodec].filter(c => c).join(',').replace(/\.[^.,]+/g, '');
  }
  get maxBitrate() {
    return Math.max(this.realBitrate, this.bitrate);
  }
  get attrs() {
    return this._attrs[this._urlId];
  }
  get pathwayId() {
    return this.attrs['PATHWAY-ID'] || '.';
  }
  get uri() {
    return this.url[this._urlId] || '';
  }
  get urlId() {
    return this._urlId;
  }
  set urlId(value) {
    const newValue = value % this.url.length;
    if (this._urlId !== newValue) {
      this.fragmentError = 0;
      this.loadError = 0;
      this.details = undefined;
      this._urlId = newValue;
    }
  }
  get audioGroupId() {
    var _this$audioGroupIds;
    return (_this$audioGroupIds = this.audioGroupIds) == null ? void 0 : _this$audioGroupIds[this.urlId];
  }
  get textGroupId() {
    var _this$textGroupIds;
    return (_this$textGroupIds = this.textGroupIds) == null ? void 0 : _this$textGroupIds[this.urlId];
  }
  addFallback(data) {
    this.url.push(data.url);
    this._attrs.push(data.attrs);
  }
}

function updateFromToPTS(fragFrom, fragTo) {
  const fragToPTS = fragTo.startPTS;
  // if we know startPTS[toIdx]
  if (isFiniteNumber(fragToPTS)) {
    // update fragment duration.
    // it helps to fix drifts between playlist reported duration and fragment real duration
    let duration = 0;
    let frag;
    if (fragTo.sn > fragFrom.sn) {
      duration = fragToPTS - fragFrom.start;
      frag = fragFrom;
    } else {
      duration = fragFrom.start - fragToPTS;
      frag = fragTo;
    }
    if (frag.duration !== duration) {
      frag.duration = duration;
    }
    // we dont know startPTS[toIdx]
  } else if (fragTo.sn > fragFrom.sn) {
    const contiguous = fragFrom.cc === fragTo.cc;
    // TODO: With part-loading end/durations we need to confirm the whole fragment is loaded before using (or setting) minEndPTS
    if (contiguous && fragFrom.minEndPTS) {
      fragTo.start = fragFrom.start + (fragFrom.minEndPTS - fragFrom.start);
    } else {
      fragTo.start = fragFrom.start + fragFrom.duration;
    }
  } else {
    fragTo.start = Math.max(fragFrom.start - fragTo.duration, 0);
  }
}
function updateFragPTSDTS(details, frag, startPTS, endPTS, startDTS, endDTS) {
  const parsedMediaDuration = endPTS - startPTS;
  if (parsedMediaDuration <= 0) {
    logger.warn('Fragment should have a positive duration', frag);
    endPTS = startPTS + frag.duration;
    endDTS = startDTS + frag.duration;
  }
  let maxStartPTS = startPTS;
  let minEndPTS = endPTS;
  const fragStartPts = frag.startPTS;
  const fragEndPts = frag.endPTS;
  if (isFiniteNumber(fragStartPts)) {
    // delta PTS between audio and video
    const deltaPTS = Math.abs(fragStartPts - startPTS);
    if (!isFiniteNumber(frag.deltaPTS)) {
      frag.deltaPTS = deltaPTS;
    } else {
      frag.deltaPTS = Math.max(deltaPTS, frag.deltaPTS);
    }
    maxStartPTS = Math.max(startPTS, fragStartPts);
    startPTS = Math.min(startPTS, fragStartPts);
    startDTS = Math.min(startDTS, frag.startDTS);
    minEndPTS = Math.min(endPTS, fragEndPts);
    endPTS = Math.max(endPTS, fragEndPts);
    endDTS = Math.max(endDTS, frag.endDTS);
  }
  const drift = startPTS - frag.start;
  if (frag.start !== 0) {
    frag.start = startPTS;
  }
  frag.duration = endPTS - frag.start;
  frag.startPTS = startPTS;
  frag.maxStartPTS = maxStartPTS;
  frag.startDTS = startDTS;
  frag.endPTS = endPTS;
  frag.minEndPTS = minEndPTS;
  frag.endDTS = endDTS;
  const sn = frag.sn; // 'initSegment'
  // exit if sn out of range
  if (!details || sn < details.startSN || sn > details.endSN) {
    return 0;
  }
  let i;
  const fragIdx = sn - details.startSN;
  const fragments = details.fragments;
  // update frag reference in fragments array
  // rationale is that fragments array might not contain this frag object.
  // this will happen if playlist has been refreshed between frag loading and call to updateFragPTSDTS()
  // if we don't update frag, we won't be able to propagate PTS info on the playlist
  // resulting in invalid sliding computation
  fragments[fragIdx] = frag;
  // adjust fragment PTS/duration from seqnum-1 to frag 0
  for (i = fragIdx; i > 0; i--) {
    updateFromToPTS(fragments[i], fragments[i - 1]);
  }

  // adjust fragment PTS/duration from seqnum to last frag
  for (i = fragIdx; i < fragments.length - 1; i++) {
    updateFromToPTS(fragments[i], fragments[i + 1]);
  }
  if (details.fragmentHint) {
    updateFromToPTS(fragments[fragments.length - 1], details.fragmentHint);
  }
  details.PTSKnown = details.alignedSliding = true;
  return drift;
}
function mergeDetails(oldDetails, newDetails) {
  // Track the last initSegment processed. Initialize it to the last one on the timeline.
  let currentInitSegment = null;
  const oldFragments = oldDetails.fragments;
  for (let i = oldFragments.length - 1; i >= 0; i--) {
    const oldInit = oldFragments[i].initSegment;
    if (oldInit) {
      currentInitSegment = oldInit;
      break;
    }
  }
  if (oldDetails.fragmentHint) {
    // prevent PTS and duration from being adjusted on the next hint
    delete oldDetails.fragmentHint.endPTS;
  }
  // check if old/new playlists have fragments in common
  // loop through overlapping SN and update startPTS , cc, and duration if any found
  let ccOffset = 0;
  let PTSFrag;
  mapFragmentIntersection(oldDetails, newDetails, (oldFrag, newFrag) => {
    if (oldFrag.relurl) {
      // Do not compare CC if the old fragment has no url. This is a level.fragmentHint used by LL-HLS parts.
      // It maybe be off by 1 if it was created before any parts or discontinuity tags were appended to the end
      // of the playlist.
      ccOffset = oldFrag.cc - newFrag.cc;
    }
    if (isFiniteNumber(oldFrag.startPTS) && isFiniteNumber(oldFrag.endPTS)) {
      newFrag.start = newFrag.startPTS = oldFrag.startPTS;
      newFrag.startDTS = oldFrag.startDTS;
      newFrag.maxStartPTS = oldFrag.maxStartPTS;
      newFrag.endPTS = oldFrag.endPTS;
      newFrag.endDTS = oldFrag.endDTS;
      newFrag.minEndPTS = oldFrag.minEndPTS;
      newFrag.duration = oldFrag.endPTS - oldFrag.startPTS;
      if (newFrag.duration) {
        PTSFrag = newFrag;
      }

      // PTS is known when any segment has startPTS and endPTS
      newDetails.PTSKnown = newDetails.alignedSliding = true;
    }
    newFrag.elementaryStreams = oldFrag.elementaryStreams;
    newFrag.loader = oldFrag.loader;
    newFrag.stats = oldFrag.stats;
    newFrag.urlId = oldFrag.urlId;
    if (oldFrag.initSegment) {
      newFrag.initSegment = oldFrag.initSegment;
      currentInitSegment = oldFrag.initSegment;
    }
  });
  if (currentInitSegment) {
    const fragmentsToCheck = newDetails.fragmentHint ? newDetails.fragments.concat(newDetails.fragmentHint) : newDetails.fragments;
    fragmentsToCheck.forEach(frag => {
      var _currentInitSegment;
      if (!frag.initSegment || frag.initSegment.relurl === ((_currentInitSegment = currentInitSegment) == null ? void 0 : _currentInitSegment.relurl)) {
        frag.initSegment = currentInitSegment;
      }
    });
  }
  if (newDetails.skippedSegments) {
    newDetails.deltaUpdateFailed = newDetails.fragments.some(frag => !frag);
    if (newDetails.deltaUpdateFailed) {
      logger.warn('[level-helper] Previous playlist missing segments skipped in delta playlist');
      for (let i = newDetails.skippedSegments; i--;) {
        newDetails.fragments.shift();
      }
      newDetails.startSN = newDetails.fragments[0].sn;
      newDetails.startCC = newDetails.fragments[0].cc;
    } else if (newDetails.canSkipDateRanges) {
      newDetails.dateRanges = mergeDateRanges(oldDetails.dateRanges, newDetails.dateRanges, newDetails.recentlyRemovedDateranges);
    }
  }
  const newFragments = newDetails.fragments;
  if (ccOffset) {
    logger.warn('discontinuity sliding from playlist, take drift into account');
    for (let i = 0; i < newFragments.length; i++) {
      newFragments[i].cc += ccOffset;
    }
  }
  if (newDetails.skippedSegments) {
    newDetails.startCC = newDetails.fragments[0].cc;
  }

  // Merge parts
  mapPartIntersection(oldDetails.partList, newDetails.partList, (oldPart, newPart) => {
    newPart.elementaryStreams = oldPart.elementaryStreams;
    newPart.stats = oldPart.stats;
  });

  // if at least one fragment contains PTS info, recompute PTS information for all fragments
  if (PTSFrag) {
    updateFragPTSDTS(newDetails, PTSFrag, PTSFrag.startPTS, PTSFrag.endPTS, PTSFrag.startDTS, PTSFrag.endDTS);
  } else {
    // ensure that delta is within oldFragments range
    // also adjust sliding in case delta is 0 (we could have old=[50-60] and new=old=[50-61])
    // in that case we also need to adjust start offset of all fragments
    adjustSliding(oldDetails, newDetails);
  }
  if (newFragments.length) {
    newDetails.totalduration = newDetails.edge - newFragments[0].start;
  }
  newDetails.driftStartTime = oldDetails.driftStartTime;
  newDetails.driftStart = oldDetails.driftStart;
  const advancedDateTime = newDetails.advancedDateTime;
  if (newDetails.advanced && advancedDateTime) {
    const edge = newDetails.edge;
    if (!newDetails.driftStart) {
      newDetails.driftStartTime = advancedDateTime;
      newDetails.driftStart = edge;
    }
    newDetails.driftEndTime = advancedDateTime;
    newDetails.driftEnd = edge;
  } else {
    newDetails.driftEndTime = oldDetails.driftEndTime;
    newDetails.driftEnd = oldDetails.driftEnd;
    newDetails.advancedDateTime = oldDetails.advancedDateTime;
  }
}
function mergeDateRanges(oldDateRanges, deltaDateRanges, recentlyRemovedDateranges) {
  const dateRanges = _extends({}, oldDateRanges);
  if (recentlyRemovedDateranges) {
    recentlyRemovedDateranges.forEach(id => {
      delete dateRanges[id];
    });
  }
  Object.keys(deltaDateRanges).forEach(id => {
    const dateRange = new DateRange(deltaDateRanges[id].attr, dateRanges[id]);
    if (dateRange.isValid) {
      dateRanges[id] = dateRange;
    } else {
      logger.warn(`Ignoring invalid Playlist Delta Update DATERANGE tag: "${JSON.stringify(deltaDateRanges[id].attr)}"`);
    }
  });
  return dateRanges;
}
function mapPartIntersection(oldParts, newParts, intersectionFn) {
  if (oldParts && newParts) {
    let delta = 0;
    for (let i = 0, len = oldParts.length; i <= len; i++) {
      const oldPart = oldParts[i];
      const newPart = newParts[i + delta];
      if (oldPart && newPart && oldPart.index === newPart.index && oldPart.fragment.sn === newPart.fragment.sn) {
        intersectionFn(oldPart, newPart);
      } else {
        delta--;
      }
    }
  }
}
function mapFragmentIntersection(oldDetails, newDetails, intersectionFn) {
  const skippedSegments = newDetails.skippedSegments;
  const start = Math.max(oldDetails.startSN, newDetails.startSN) - newDetails.startSN;
  const end = (oldDetails.fragmentHint ? 1 : 0) + (skippedSegments ? newDetails.endSN : Math.min(oldDetails.endSN, newDetails.endSN)) - newDetails.startSN;
  const delta = newDetails.startSN - oldDetails.startSN;
  const newFrags = newDetails.fragmentHint ? newDetails.fragments.concat(newDetails.fragmentHint) : newDetails.fragments;
  const oldFrags = oldDetails.fragmentHint ? oldDetails.fragments.concat(oldDetails.fragmentHint) : oldDetails.fragments;
  for (let i = start; i <= end; i++) {
    const oldFrag = oldFrags[delta + i];
    let newFrag = newFrags[i];
    if (skippedSegments && !newFrag && i < skippedSegments) {
      // Fill in skipped segments in delta playlist
      newFrag = newDetails.fragments[i] = oldFrag;
    }
    if (oldFrag && newFrag) {
      intersectionFn(oldFrag, newFrag);
    }
  }
}
function adjustSliding(oldDetails, newDetails) {
  const delta = newDetails.startSN + newDetails.skippedSegments - oldDetails.startSN;
  const oldFragments = oldDetails.fragments;
  if (delta < 0 || delta >= oldFragments.length) {
    return;
  }
  addSliding(newDetails, oldFragments[delta].start);
}
function addSliding(details, start) {
  if (start) {
    const fragments = details.fragments;
    for (let i = details.skippedSegments; i < fragments.length; i++) {
      fragments[i].start += start;
    }
    if (details.fragmentHint) {
      details.fragmentHint.start += start;
    }
  }
}
function computeReloadInterval(newDetails, distanceToLiveEdgeMs = Infinity) {
  let reloadInterval = 1000 * newDetails.targetduration;
  if (newDetails.updated) {
    // Use last segment duration when shorter than target duration and near live edge
    const fragments = newDetails.fragments;
    const liveEdgeMaxTargetDurations = 4;
    if (fragments.length && reloadInterval * liveEdgeMaxTargetDurations > distanceToLiveEdgeMs) {
      const lastSegmentDuration = fragments[fragments.length - 1].duration * 1000;
      if (lastSegmentDuration < reloadInterval) {
        reloadInterval = lastSegmentDuration;
      }
    }
  } else {
    // estimate = 'miss half average';
    // follow HLS Spec, If the client reloads a Playlist file and finds that it has not
    // changed then it MUST wait for a period of one-half the target
    // duration before retrying.
    reloadInterval /= 2;
  }
  return Math.round(reloadInterval);
}
function getFragmentWithSN(level, sn, fragCurrent) {
  if (!(level != null && level.details)) {
    return null;
  }
  const levelDetails = level.details;
  let fragment = levelDetails.fragments[sn - levelDetails.startSN];
  if (fragment) {
    return fragment;
  }
  fragment = levelDetails.fragmentHint;
  if (fragment && fragment.sn === sn) {
    return fragment;
  }
  if (sn < levelDetails.startSN && fragCurrent && fragCurrent.sn === sn) {
    return fragCurrent;
  }
  return null;
}
function getPartWith(level, sn, partIndex) {
  var _level$details;
  if (!(level != null && level.details)) {
    return null;
  }
  return findPart((_level$details = level.details) == null ? void 0 : _level$details.partList, sn, partIndex);
}
function findPart(partList, sn, partIndex) {
  if (partList) {
    for (let i = partList.length; i--;) {
      const part = partList[i];
      if (part.index === partIndex && part.fragment.sn === sn) {
        return part;
      }
    }
  }
  return null;
}

function isTimeoutError(error) {
  switch (error.details) {
    case ErrorDetails.FRAG_LOAD_TIMEOUT:
    case ErrorDetails.KEY_LOAD_TIMEOUT:
    case ErrorDetails.LEVEL_LOAD_TIMEOUT:
    case ErrorDetails.MANIFEST_LOAD_TIMEOUT:
      return true;
  }
  return false;
}
function getRetryConfig(loadPolicy, error) {
  const isTimeout = isTimeoutError(error);
  return loadPolicy.default[`${isTimeout ? 'timeout' : 'error'}Retry`];
}
function getRetryDelay(retryConfig, retryCount) {
  // exponential backoff capped to max retry delay
  const backoffFactor = retryConfig.backoff === 'linear' ? 1 : Math.pow(2, retryCount);
  return Math.min(backoffFactor * retryConfig.retryDelayMs, retryConfig.maxRetryDelayMs);
}
function getLoaderConfigWithoutReties(loderConfig) {
  return _objectSpread2(_objectSpread2({}, loderConfig), {
    errorRetry: null,
    timeoutRetry: null
  });
}
function shouldRetry(retryConfig, retryCount, isTimeout, httpStatus) {
  return !!retryConfig && retryCount < retryConfig.maxNumRetry && (retryForHttpStatus(httpStatus) || !!isTimeout);
}
function retryForHttpStatus(httpStatus) {
  // Do not retry on status 4xx, status 0 (CORS error), or undefined (decrypt/gap/parse error)
  return httpStatus === 0 && navigator.onLine === false || !!httpStatus && (httpStatus < 400 || httpStatus > 499);
}

const BinarySearch = {
  /**
   * Searches for an item in an array which matches a certain condition.
   * This requires the condition to only match one item in the array,
   * and for the array to be ordered.
   *
   * @param list The array to search.
   * @param comparisonFn
   *      Called and provided a candidate item as the first argument.
   *      Should return:
   *          > -1 if the item should be located at a lower index than the provided item.
   *          > 1 if the item should be located at a higher index than the provided item.
   *          > 0 if the item is the item you're looking for.
   *
   * @returns the object if found, otherwise returns null
   */
  search: function (list, comparisonFn) {
    let minIndex = 0;
    let maxIndex = list.length - 1;
    let currentIndex = null;
    let currentElement = null;
    while (minIndex <= maxIndex) {
      currentIndex = (minIndex + maxIndex) / 2 | 0;
      currentElement = list[currentIndex];
      const comparisonResult = comparisonFn(currentElement);
      if (comparisonResult > 0) {
        minIndex = currentIndex + 1;
      } else if (comparisonResult < 0) {
        maxIndex = currentIndex - 1;
      } else {
        return currentElement;
      }
    }
    return null;
  }
};

/**
 * Returns first fragment whose endPdt value exceeds the given PDT, or null.
 * @param fragments - The array of candidate fragments
 * @param PDTValue - The PDT value which must be exceeded
 * @param maxFragLookUpTolerance - The amount of time that a fragment's start/end can be within in order to be considered contiguous
 */
function findFragmentByPDT(fragments, PDTValue, maxFragLookUpTolerance) {
  if (PDTValue === null || !Array.isArray(fragments) || !fragments.length || !isFiniteNumber(PDTValue)) {
    return null;
  }

  // if less than start
  const startPDT = fragments[0].programDateTime;
  if (PDTValue < (startPDT || 0)) {
    return null;
  }
  const endPDT = fragments[fragments.length - 1].endProgramDateTime;
  if (PDTValue >= (endPDT || 0)) {
    return null;
  }
  maxFragLookUpTolerance = maxFragLookUpTolerance || 0;
  for (let seg = 0; seg < fragments.length; ++seg) {
    const frag = fragments[seg];
    if (pdtWithinToleranceTest(PDTValue, maxFragLookUpTolerance, frag)) {
      return frag;
    }
  }
  return null;
}

/**
 * Finds a fragment based on the SN of the previous fragment; or based on the needs of the current buffer.
 * This method compensates for small buffer gaps by applying a tolerance to the start of any candidate fragment, thus
 * breaking any traps which would cause the same fragment to be continuously selected within a small range.
 * @param fragPrevious - The last frag successfully appended
 * @param fragments - The array of candidate fragments
 * @param bufferEnd - The end of the contiguous buffered range the playhead is currently within
 * @param maxFragLookUpTolerance - The amount of time that a fragment's start/end can be within in order to be considered contiguous
 * @returns a matching fragment or null
 */
function findFragmentByPTS(fragPrevious, fragments, bufferEnd = 0, maxFragLookUpTolerance = 0) {
  let fragNext = null;
  if (fragPrevious) {
    fragNext = fragments[fragPrevious.sn - fragments[0].sn + 1] || null;
  } else if (bufferEnd === 0 && fragments[0].start === 0) {
    fragNext = fragments[0];
  }
  // Prefer the next fragment if it's within tolerance
  if (fragNext && fragmentWithinToleranceTest(bufferEnd, maxFragLookUpTolerance, fragNext) === 0) {
    return fragNext;
  }
  // We might be seeking past the tolerance so find the best match
  const foundFragment = BinarySearch.search(fragments, fragmentWithinToleranceTest.bind(null, bufferEnd, maxFragLookUpTolerance));
  if (foundFragment && (foundFragment !== fragPrevious || !fragNext)) {
    return foundFragment;
  }
  // If no match was found return the next fragment after fragPrevious, or null
  return fragNext;
}

/**
 * The test function used by the findFragmentBySn's BinarySearch to look for the best match to the current buffer conditions.
 * @param candidate - The fragment to test
 * @param bufferEnd - The end of the current buffered range the playhead is currently within
 * @param maxFragLookUpTolerance - The amount of time that a fragment's start can be within in order to be considered contiguous
 * @returns 0 if it matches, 1 if too low, -1 if too high
 */
function fragmentWithinToleranceTest(bufferEnd = 0, maxFragLookUpTolerance = 0, candidate) {
  // eagerly accept an accurate match (no tolerance)
  if (candidate.start <= bufferEnd && candidate.start + candidate.duration > bufferEnd) {
    return 0;
  }
  // offset should be within fragment boundary - config.maxFragLookUpTolerance
  // this is to cope with situations like
  // bufferEnd = 9.991
  // frag[Ø] : [0,10]
  // frag[1] : [10,20]
  // bufferEnd is within frag[0] range ... although what we are expecting is to return frag[1] here
  //              frag start               frag start+duration
  //                  |-----------------------------|
  //              <--->                         <--->
  //  ...--------><-----------------------------><---------....
  // previous frag         matching fragment         next frag
  //  return -1             return 0                 return 1
  // logger.log(`level/sn/start/end/bufEnd:${level}/${candidate.sn}/${candidate.start}/${(candidate.start+candidate.duration)}/${bufferEnd}`);
  // Set the lookup tolerance to be small enough to detect the current segment - ensures we don't skip over very small segments
  const candidateLookupTolerance = Math.min(maxFragLookUpTolerance, candidate.duration + (candidate.deltaPTS ? candidate.deltaPTS : 0));
  if (candidate.start + candidate.duration - candidateLookupTolerance <= bufferEnd) {
    return 1;
  } else if (candidate.start - candidateLookupTolerance > bufferEnd && candidate.start) {
    // if maxFragLookUpTolerance will have negative value then don't return -1 for first element
    return -1;
  }
  return 0;
}

/**
 * The test function used by the findFragmentByPdt's BinarySearch to look for the best match to the current buffer conditions.
 * This function tests the candidate's program date time values, as represented in Unix time
 * @param candidate - The fragment to test
 * @param pdtBufferEnd - The Unix time representing the end of the current buffered range
 * @param maxFragLookUpTolerance - The amount of time that a fragment's start can be within in order to be considered contiguous
 * @returns true if contiguous, false otherwise
 */
function pdtWithinToleranceTest(pdtBufferEnd, maxFragLookUpTolerance, candidate) {
  const candidateLookupTolerance = Math.min(maxFragLookUpTolerance, candidate.duration + (candidate.deltaPTS ? candidate.deltaPTS : 0)) * 1000;

  // endProgramDateTime can be null, default to zero
  const endProgramDateTime = candidate.endProgramDateTime || 0;
  return endProgramDateTime - candidateLookupTolerance > pdtBufferEnd;
}
function findFragWithCC(fragments, cc) {
  return BinarySearch.search(fragments, candidate => {
    if (candidate.cc < cc) {
      return 1;
    } else if (candidate.cc > cc) {
      return -1;
    } else {
      return 0;
    }
  });
}

const RENDITION_PENALTY_DURATION_MS = 300000;
var NetworkErrorAction = {
  DoNothing: 0,
  SendEndCallback: 1,
  SendAlternateToPenaltyBox: 2,
  RemoveAlternatePermanently: 3,
  InsertDiscontinuity: 4,
  RetryRequest: 5
};
var ErrorActionFlags = {
  None: 0,
  MoveAllAlternatesMatchingHost: 1,
  MoveAllAlternatesMatchingHDCP: 2,
  SwitchToSDR: 4
}; // Reserved for future use
class ErrorController {
  constructor(hls) {
    this.hls = void 0;
    this.playlistError = 0;
    this.penalizedRenditions = {};
    this.log = void 0;
    this.warn = void 0;
    this.error = void 0;
    this.hls = hls;
    this.log = logger.log.bind(logger, `[info]:`);
    this.warn = logger.warn.bind(logger, `[warning]:`);
    this.error = logger.error.bind(logger, `[error]:`);
    this.registerListeners();
  }
  registerListeners() {
    const hls = this.hls;
    hls.on(Events.ERROR, this.onError, this);
    hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.on(Events.LEVEL_UPDATED, this.onLevelUpdated, this);
  }
  unregisterListeners() {
    const hls = this.hls;
    if (!hls) {
      return;
    }
    hls.off(Events.ERROR, this.onError, this);
    hls.off(Events.ERROR, this.onErrorOut, this);
    hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.off(Events.LEVEL_UPDATED, this.onLevelUpdated, this);
  }
  destroy() {
    this.unregisterListeners();
    // @ts-ignore
    this.hls = null;
    this.penalizedRenditions = {};
  }
  startLoad(startPosition) {
    this.playlistError = 0;
  }
  stopLoad() {}
  getVariantLevelIndex(frag) {
    return (frag == null ? void 0 : frag.type) === PlaylistLevelType.MAIN ? frag.level : this.hls.loadLevel;
  }
  onManifestLoading() {
    this.playlistError = 0;
    this.penalizedRenditions = {};
  }
  onLevelUpdated() {
    this.playlistError = 0;
  }
  onError(event, data) {
    var _data$frag, _data$level;
    if (data.fatal) {
      return;
    }
    const hls = this.hls;
    const context = data.context;
    switch (data.details) {
      case ErrorDetails.FRAG_LOAD_ERROR:
      case ErrorDetails.FRAG_LOAD_TIMEOUT:
      case ErrorDetails.KEY_LOAD_ERROR:
      case ErrorDetails.KEY_LOAD_TIMEOUT:
        data.errorAction = this.getFragRetryOrSwitchAction(data);
        return;
      case ErrorDetails.FRAG_PARSING_ERROR:
        // ignore empty segment errors marked as gap
        if ((_data$frag = data.frag) != null && _data$frag.gap) {
          data.errorAction = {
            action: NetworkErrorAction.DoNothing,
            flags: ErrorActionFlags.None
          };
          return;
        }
      // falls through
      case ErrorDetails.FRAG_GAP:
      case ErrorDetails.FRAG_DECRYPT_ERROR:
        {
          // Switch level if possible, otherwise allow retry count to reach max error retries
          data.errorAction = this.getFragRetryOrSwitchAction(data);
          data.errorAction.action = NetworkErrorAction.SendAlternateToPenaltyBox;
          return;
        }
      case ErrorDetails.LEVEL_EMPTY_ERROR:
      case ErrorDetails.LEVEL_PARSING_ERROR:
        {
          var _data$context, _data$context$levelDe;
          // Only retry when empty and live
          const levelIndex = data.parent === PlaylistLevelType.MAIN ? data.level : hls.loadLevel;
          if (data.details === ErrorDetails.LEVEL_EMPTY_ERROR && !!((_data$context = data.context) != null && (_data$context$levelDe = _data$context.levelDetails) != null && _data$context$levelDe.live)) {
            data.errorAction = this.getPlaylistRetryOrSwitchAction(data, levelIndex);
          } else {
            // Escalate to fatal if not retrying or switching
            data.levelRetry = false;
            data.errorAction = this.getLevelSwitchAction(data, levelIndex);
          }
        }
        return;
      case ErrorDetails.LEVEL_LOAD_ERROR:
      case ErrorDetails.LEVEL_LOAD_TIMEOUT:
        if (typeof (context == null ? void 0 : context.level) === 'number') {
          data.errorAction = this.getPlaylistRetryOrSwitchAction(data, context.level);
        }
        return;
      case ErrorDetails.AUDIO_TRACK_LOAD_ERROR:
      case ErrorDetails.AUDIO_TRACK_LOAD_TIMEOUT:
      case ErrorDetails.SUBTITLE_LOAD_ERROR:
      case ErrorDetails.SUBTITLE_TRACK_LOAD_TIMEOUT:
        if (context) {
          const level = hls.levels[hls.loadLevel];
          if (level && (context.type === PlaylistContextType.AUDIO_TRACK && context.groupId === level.audioGroupId || context.type === PlaylistContextType.SUBTITLE_TRACK && context.groupId === level.textGroupId)) {
            // Perform Pathway switch or Redundant failover if possible for fastest recovery
            // otherwise allow playlist retry count to reach max error retries
            data.errorAction = this.getPlaylistRetryOrSwitchAction(data, hls.loadLevel);
            data.errorAction.action = NetworkErrorAction.SendAlternateToPenaltyBox;
            data.errorAction.flags = ErrorActionFlags.MoveAllAlternatesMatchingHost;
            return;
          }
        }
        return;
      case ErrorDetails.KEY_SYSTEM_STATUS_OUTPUT_RESTRICTED:
        {
          const level = hls.levels[hls.loadLevel];
          const restrictedHdcpLevel = level == null ? void 0 : level.attrs['HDCP-LEVEL'];
          if (restrictedHdcpLevel) {
            data.errorAction = {
              action: NetworkErrorAction.SendAlternateToPenaltyBox,
              flags: ErrorActionFlags.MoveAllAlternatesMatchingHDCP,
              hdcpLevel: restrictedHdcpLevel
            };
          }
        }
        return;
      case ErrorDetails.BUFFER_ADD_CODEC_ERROR:
      case ErrorDetails.REMUX_ALLOC_ERROR:
        data.errorAction = this.getLevelSwitchAction(data, (_data$level = data.level) != null ? _data$level : hls.loadLevel);
        return;
      case ErrorDetails.INTERNAL_EXCEPTION:
      case ErrorDetails.BUFFER_APPENDING_ERROR:
      case ErrorDetails.BUFFER_APPEND_ERROR:
      case ErrorDetails.BUFFER_FULL_ERROR:
      case ErrorDetails.LEVEL_SWITCH_ERROR:
      case ErrorDetails.BUFFER_STALLED_ERROR:
      case ErrorDetails.BUFFER_SEEK_OVER_HOLE:
      case ErrorDetails.BUFFER_NUDGE_ON_STALL:
        data.errorAction = {
          action: NetworkErrorAction.DoNothing,
          flags: ErrorActionFlags.None
        };
        return;
    }
    if (data.type === ErrorTypes.KEY_SYSTEM_ERROR) {
      const levelIndex = this.getVariantLevelIndex(data.frag);
      // Do not retry level. Escalate to fatal if switching levels fails.
      data.levelRetry = false;
      data.errorAction = this.getLevelSwitchAction(data, levelIndex);
      return;
    }
  }
  getPlaylistRetryOrSwitchAction(data, levelIndex) {
    var _data$response;
    const hls = this.hls;
    const retryConfig = getRetryConfig(hls.config.playlistLoadPolicy, data);
    const retryCount = this.playlistError++;
    const httpStatus = (_data$response = data.response) == null ? void 0 : _data$response.code;
    const retry = shouldRetry(retryConfig, retryCount, isTimeoutError(data), httpStatus);
    if (retry) {
      return {
        action: NetworkErrorAction.RetryRequest,
        flags: ErrorActionFlags.None,
        retryConfig,
        retryCount
      };
    }
    const errorAction = this.getLevelSwitchAction(data, levelIndex);
    if (retryConfig) {
      errorAction.retryConfig = retryConfig;
      errorAction.retryCount = retryCount;
    }
    return errorAction;
  }
  getFragRetryOrSwitchAction(data) {
    const hls = this.hls;
    // Share fragment error count accross media options (main, audio, subs)
    // This allows for level based rendition switching when media option assets fail
    const variantLevelIndex = this.getVariantLevelIndex(data.frag);
    const level = hls.levels[variantLevelIndex];
    const {
      fragLoadPolicy,
      keyLoadPolicy
    } = hls.config;
    const retryConfig = getRetryConfig(data.details.startsWith('key') ? keyLoadPolicy : fragLoadPolicy, data);
    const fragmentErrors = hls.levels.reduce((acc, level) => acc + level.fragmentError, 0);
    // Switch levels when out of retried or level index out of bounds
    if (level) {
      var _data$response2;
      if (data.details !== ErrorDetails.FRAG_GAP) {
        level.fragmentError++;
      }
      const httpStatus = (_data$response2 = data.response) == null ? void 0 : _data$response2.code;
      const retry = shouldRetry(retryConfig, fragmentErrors, isTimeoutError(data), httpStatus);
      if (retry) {
        return {
          action: NetworkErrorAction.RetryRequest,
          flags: ErrorActionFlags.None,
          retryConfig,
          retryCount: fragmentErrors
        };
      }
    }
    // Reach max retry count, or Missing level reference
    // Switch to valid index
    const errorAction = this.getLevelSwitchAction(data, variantLevelIndex);
    // Add retry details to allow skipping of FRAG_PARSING_ERROR
    if (retryConfig) {
      errorAction.retryConfig = retryConfig;
      errorAction.retryCount = fragmentErrors;
    }
    return errorAction;
  }
  getLevelSwitchAction(data, levelIndex) {
    const hls = this.hls;
    if (levelIndex === null || levelIndex === undefined) {
      levelIndex = hls.loadLevel;
    }
    const level = this.hls.levels[levelIndex];
    if (level) {
      level.loadError++;
      if (hls.autoLevelEnabled) {
        var _data$frag2, _data$context2;
        // Search for next level to retry
        let nextLevel = -1;
        const {
          levels,
          loadLevel,
          minAutoLevel,
          maxAutoLevel
        } = hls;
        const fragErrorType = (_data$frag2 = data.frag) == null ? void 0 : _data$frag2.type;
        const {
          type: playlistErrorType,
          groupId: playlistErrorGroupId
        } = (_data$context2 = data.context) != null ? _data$context2 : {};
        for (let i = levels.length; i--;) {
          const candidate = (i + loadLevel) % levels.length;
          if (candidate !== loadLevel && candidate >= minAutoLevel && candidate <= maxAutoLevel && levels[candidate].loadError === 0) {
            const levelCandidate = levels[candidate];
            // Skip level switch if GAP tag is found in next level at same position
            if (data.details === ErrorDetails.FRAG_GAP && data.frag) {
              const levelDetails = levels[candidate].details;
              if (levelDetails) {
                const fragCandidate = findFragmentByPTS(data.frag, levelDetails.fragments, data.frag.start);
                if (fragCandidate != null && fragCandidate.gap) {
                  continue;
                }
              }
            } else if (playlistErrorType === PlaylistContextType.AUDIO_TRACK && playlistErrorGroupId === levelCandidate.audioGroupId || playlistErrorType === PlaylistContextType.SUBTITLE_TRACK && playlistErrorGroupId === levelCandidate.textGroupId) {
              // For audio/subs playlist errors find another group ID or fallthrough to redundant fail-over
              continue;
            } else if (fragErrorType === PlaylistLevelType.AUDIO && level.audioGroupId === levelCandidate.audioGroupId || fragErrorType === PlaylistLevelType.SUBTITLE && level.textGroupId === levelCandidate.textGroupId) {
              // For audio/subs frag errors find another group ID or fallthrough to redundant fail-over
              continue;
            }
            nextLevel = candidate;
            break;
          }
        }
        if (nextLevel > -1 && hls.loadLevel !== nextLevel) {
          data.levelRetry = true;
          this.playlistError = 0;
          return {
            action: NetworkErrorAction.SendAlternateToPenaltyBox,
            flags: ErrorActionFlags.None,
            nextAutoLevel: nextLevel
          };
        }
      }
    }
    // No levels to switch / Manual level selection / Level not found
    // Resolve with Pathway switch, Redundant fail-over, or stay on lowest Level
    return {
      action: NetworkErrorAction.SendAlternateToPenaltyBox,
      flags: ErrorActionFlags.MoveAllAlternatesMatchingHost
    };
  }
  onErrorOut(event, data) {
    var _data$errorAction;
    switch ((_data$errorAction = data.errorAction) == null ? void 0 : _data$errorAction.action) {
      case NetworkErrorAction.DoNothing:
        break;
      case NetworkErrorAction.SendAlternateToPenaltyBox:
        this.sendAlternateToPenaltyBox(data);
        if (!data.errorAction.resolved && data.details !== ErrorDetails.FRAG_GAP) {
          data.fatal = true;
        }
        break;
    }
    if (data.fatal) {
      this.hls.stopLoad();
      return;
    }
  }
  sendAlternateToPenaltyBox(data) {
    const hls = this.hls;
    const errorAction = data.errorAction;
    if (!errorAction) {
      return;
    }
    const {
      flags,
      hdcpLevel,
      nextAutoLevel
    } = errorAction;
    switch (flags) {
      case ErrorActionFlags.None:
        this.switchLevel(data, nextAutoLevel);
        break;
      case ErrorActionFlags.MoveAllAlternatesMatchingHost:
        {
          // Handle Redundant Levels here. Pathway switching is handled by content-steering-controller
          if (!errorAction.resolved) {
            errorAction.resolved = this.redundantFailover(data);
          }
        }
        break;
      case ErrorActionFlags.MoveAllAlternatesMatchingHDCP:
        if (hdcpLevel) {
          hls.maxHdcpLevel = HdcpLevels[HdcpLevels.indexOf(hdcpLevel) - 1];
          errorAction.resolved = true;
        }
        this.warn(`Restricting playback to HDCP-LEVEL of "${hls.maxHdcpLevel}" or lower`);
        break;
    }
    // If not resolved by previous actions try to switch to next level
    if (!errorAction.resolved) {
      this.switchLevel(data, nextAutoLevel);
    }
  }
  switchLevel(data, levelIndex) {
    if (levelIndex !== undefined && data.errorAction) {
      this.warn(`switching to level ${levelIndex} after ${data.details}`);
      this.hls.nextAutoLevel = levelIndex;
      data.errorAction.resolved = true;
      // Stream controller is responsible for this but won't switch on false start
      this.hls.nextLoadLevel = this.hls.nextAutoLevel;
    }
  }
  redundantFailover(data) {
    const {
      hls,
      penalizedRenditions
    } = this;
    const levelIndex = data.parent === PlaylistLevelType.MAIN ? data.level : hls.loadLevel;
    const level = hls.levels[levelIndex];
    const redundantLevels = level.url.length;
    const errorUrlId = data.frag ? data.frag.urlId : level.urlId;
    if (level.urlId === errorUrlId && (!data.frag || level.details)) {
      this.penalizeRendition(level, data);
    }
    for (let i = 1; i < redundantLevels; i++) {
      const newUrlId = (errorUrlId + i) % redundantLevels;
      const penalizedRendition = penalizedRenditions[newUrlId];
      // Check if rendition is penalized and skip if it is a bad fit for failover
      if (!penalizedRendition || checkExpired(penalizedRendition, data, penalizedRenditions[errorUrlId])) {
        // delete penalizedRenditions[newUrlId];
        // Update the url id of all levels so that we stay on the same set of variants when level switching
        this.warn(`Switching to Redundant Stream ${newUrlId + 1}/${redundantLevels}: "${level.url[newUrlId]}" after ${data.details}`);
        this.playlistError = 0;
        hls.levels.forEach(lv => {
          lv.urlId = newUrlId;
        });
        hls.nextLoadLevel = levelIndex;
        return true;
      }
    }
    return false;
  }
  penalizeRendition(level, data) {
    const {
      penalizedRenditions
    } = this;
    const penalizedRendition = penalizedRenditions[level.urlId] || {
      lastErrorPerfMs: 0,
      errors: [],
      details: undefined
    };
    penalizedRendition.lastErrorPerfMs = performance.now();
    penalizedRendition.errors.push(data);
    penalizedRendition.details = level.details;
    penalizedRenditions[level.urlId] = penalizedRendition;
  }
}
function checkExpired(penalizedRendition, data, currentPenaltyState) {
  // Expire penalty for switching back to rendition after RENDITION_PENALTY_DURATION_MS
  if (performance.now() - penalizedRendition.lastErrorPerfMs > RENDITION_PENALTY_DURATION_MS) {
    return true;
  }
  // Expire penalty on GAP tag error if rendition has no GAP at position (does not cover media tracks)
  const lastErrorDetails = penalizedRendition.details;
  if (data.details === ErrorDetails.FRAG_GAP && lastErrorDetails && data.frag) {
    const position = data.frag.start;
    const candidateFrag = findFragmentByPTS(null, lastErrorDetails.fragments, position);
    if (candidateFrag && !candidateFrag.gap) {
      return true;
    }
  }
  // Expire penalty if there are more errors in currentLevel than in penalizedRendition
  if (currentPenaltyState && penalizedRendition.errors.length < currentPenaltyState.errors.length) {
    const lastCandidateError = penalizedRendition.errors[penalizedRendition.errors.length - 1];
    if (lastErrorDetails && lastCandidateError.frag && data.frag && Math.abs(lastCandidateError.frag.start - data.frag.start) > lastErrorDetails.targetduration * 3) {
      return true;
    }
  }
  return false;
}

class BasePlaylistController {
  constructor(hls, logPrefix) {
    this.hls = void 0;
    this.timer = -1;
    this.requestScheduled = -1;
    this.canLoad = false;
    this.log = void 0;
    this.warn = void 0;
    this.log = logger.log.bind(logger, `${logPrefix}:`);
    this.warn = logger.warn.bind(logger, `${logPrefix}:`);
    this.hls = hls;
  }
  destroy() {
    this.clearTimer();
    // @ts-ignore
    this.hls = this.log = this.warn = null;
  }
  clearTimer() {
    clearTimeout(this.timer);
    this.timer = -1;
  }
  startLoad() {
    this.canLoad = true;
    this.requestScheduled = -1;
    this.loadPlaylist();
  }
  stopLoad() {
    this.canLoad = false;
    this.clearTimer();
  }
  switchParams(playlistUri, previous) {
    const renditionReports = previous == null ? void 0 : previous.renditionReports;
    if (renditionReports) {
      let foundIndex = -1;
      for (let i = 0; i < renditionReports.length; i++) {
        const attr = renditionReports[i];
        let uri;
        try {
          uri = new self.URL(attr.URI, previous.url).href;
        } catch (error) {
          logger.warn(`Could not construct new URL for Rendition Report: ${error}`);
          uri = attr.URI || '';
        }
        // Use exact match. Otherwise, the last partial match, if any, will be used
        // (Playlist URI includes a query string that the Rendition Report does not)
        if (uri === playlistUri) {
          foundIndex = i;
          break;
        } else if (uri === playlistUri.substring(0, uri.length)) {
          foundIndex = i;
        }
      }
      if (foundIndex !== -1) {
        const attr = renditionReports[foundIndex];
        const msn = parseInt(attr['LAST-MSN']) || (previous == null ? void 0 : previous.lastPartSn);
        let part = parseInt(attr['LAST-PART']) || (previous == null ? void 0 : previous.lastPartIndex);
        if (this.hls.config.lowLatencyMode) {
          const currentGoal = Math.min(previous.age - previous.partTarget, previous.targetduration);
          if (part >= 0 && currentGoal > previous.partTarget) {
            part += 1;
          }
        }
        return new HlsUrlParameters(msn, part >= 0 ? part : undefined, HlsSkip.No);
      }
    }
  }
  loadPlaylist(hlsUrlParameters) {
    if (this.requestScheduled === -1) {
      this.requestScheduled = self.performance.now();
    }
    // Loading is handled by the subclasses
  }

  shouldLoadPlaylist(playlist) {
    return this.canLoad && !!playlist && !!playlist.url && (!playlist.details || playlist.details.live);
  }
  shouldReloadPlaylist(playlist) {
    return this.timer === -1 && this.requestScheduled === -1 && this.shouldLoadPlaylist(playlist);
  }
  playlistLoaded(index, data, previousDetails) {
    const {
      details,
      stats
    } = data;

    // Set last updated date-time
    const now = self.performance.now();
    const elapsed = stats.loading.first ? Math.max(0, now - stats.loading.first) : 0;
    details.advancedDateTime = Date.now() - elapsed;

    // if current playlist is a live playlist, arm a timer to reload it
    if (details.live || previousDetails != null && previousDetails.live) {
      details.reloaded(previousDetails);
      if (previousDetails) {
        this.log(`live playlist ${index} ${details.advanced ? 'REFRESHED ' + details.lastPartSn + '-' + details.lastPartIndex : details.updated ? 'UPDATED' : 'MISSED'}`);
      }
      // Merge live playlists to adjust fragment starts and fill in delta playlist skipped segments
      if (previousDetails && details.fragments.length > 0) {
        mergeDetails(previousDetails, details);
      }
      if (!this.canLoad || !details.live) {
        return;
      }
      let deliveryDirectives;
      let msn = undefined;
      let part = undefined;
      if (details.canBlockReload && details.endSN && details.advanced) {
        // Load level with LL-HLS delivery directives
        const lowLatencyMode = this.hls.config.lowLatencyMode;
        const lastPartSn = details.lastPartSn;
        const endSn = details.endSN;
        const lastPartIndex = details.lastPartIndex;
        const hasParts = lastPartIndex !== -1;
        const lastPart = lastPartSn === endSn;
        // When low latency mode is disabled, we'll skip part requests once the last part index is found
        const nextSnStartIndex = lowLatencyMode ? 0 : lastPartIndex;
        if (hasParts) {
          msn = lastPart ? endSn + 1 : lastPartSn;
          part = lastPart ? nextSnStartIndex : lastPartIndex + 1;
        } else {
          msn = endSn + 1;
        }
        // Low-Latency CDN Tune-in: "age" header and time since load indicates we're behind by more than one part
        // Update directives to obtain the Playlist that has the estimated additional duration of media
        const lastAdvanced = details.age;
        const cdnAge = lastAdvanced + details.ageHeader;
        let currentGoal = Math.min(cdnAge - details.partTarget, details.targetduration * 1.5);
        if (currentGoal > 0) {
          if (previousDetails && currentGoal > previousDetails.tuneInGoal) {
            // If we attempted to get the next or latest playlist update, but currentGoal increased,
            // then we either can't catchup, or the "age" header cannot be trusted.
            this.warn(`CDN Tune-in goal increased from: ${previousDetails.tuneInGoal} to: ${currentGoal} with playlist age: ${details.age}`);
            currentGoal = 0;
          } else {
            const segments = Math.floor(currentGoal / details.targetduration);
            msn += segments;
            if (part !== undefined) {
              const parts = Math.round(currentGoal % details.targetduration / details.partTarget);
              part += parts;
            }
            this.log(`CDN Tune-in age: ${details.ageHeader}s last advanced ${lastAdvanced.toFixed(2)}s goal: ${currentGoal} skip sn ${segments} to part ${part}`);
          }
          details.tuneInGoal = currentGoal;
        }
        deliveryDirectives = this.getDeliveryDirectives(details, data.deliveryDirectives, msn, part);
        if (lowLatencyMode || !lastPart) {
          this.loadPlaylist(deliveryDirectives);
          return;
        }
      } else if (details.canBlockReload || details.canSkipUntil) {
        deliveryDirectives = this.getDeliveryDirectives(details, data.deliveryDirectives, msn, part);
      }
      const bufferInfo = this.hls.mainForwardBufferInfo;
      const position = bufferInfo ? bufferInfo.end - bufferInfo.len : 0;
      const distanceToLiveEdgeMs = (details.edge - position) * 1000;
      const reloadInterval = computeReloadInterval(details, distanceToLiveEdgeMs);
      if (details.updated && now > this.requestScheduled + reloadInterval) {
        this.requestScheduled = stats.loading.start;
      }
      if (msn !== undefined && details.canBlockReload) {
        this.requestScheduled = stats.loading.first + reloadInterval - (details.partTarget * 1000 || 1000);
      } else if (this.requestScheduled === -1 || this.requestScheduled + reloadInterval < now) {
        this.requestScheduled = now;
      } else if (this.requestScheduled - now <= 0) {
        this.requestScheduled += reloadInterval;
      }
      let estimatedTimeUntilUpdate = this.requestScheduled - now;
      estimatedTimeUntilUpdate = Math.max(0, estimatedTimeUntilUpdate);
      this.log(`reload live playlist ${index} in ${Math.round(estimatedTimeUntilUpdate)} ms`);
      // this.log(
      //   `live reload ${details.updated ? 'REFRESHED' : 'MISSED'}
      // reload in ${estimatedTimeUntilUpdate / 1000}
      // round trip ${(stats.loading.end - stats.loading.start) / 1000}
      // diff ${
      //   (reloadInterval -
      //     (estimatedTimeUntilUpdate +
      //       stats.loading.end -
      //       stats.loading.start)) /
      //   1000
      // }
      // reload interval ${reloadInterval / 1000}
      // target duration ${details.targetduration}
      // distance to edge ${distanceToLiveEdgeMs / 1000}`
      // );

      this.timer = self.setTimeout(() => this.loadPlaylist(deliveryDirectives), estimatedTimeUntilUpdate);
    } else {
      this.clearTimer();
    }
  }
  getDeliveryDirectives(details, previousDeliveryDirectives, msn, part) {
    let skip = getSkipValue(details, msn);
    if (previousDeliveryDirectives != null && previousDeliveryDirectives.skip && details.deltaUpdateFailed) {
      msn = previousDeliveryDirectives.msn;
      part = previousDeliveryDirectives.part;
      skip = HlsSkip.No;
    }
    return new HlsUrlParameters(msn, part, skip);
  }
  checkRetry(errorEvent) {
    const errorDetails = errorEvent.details;
    const isTimeout = isTimeoutError(errorEvent);
    const errorAction = errorEvent.errorAction;
    const {
      action,
      retryCount = 0,
      retryConfig
    } = errorAction || {};
    const retry = !!errorAction && !!retryConfig && (action === NetworkErrorAction.RetryRequest || !errorAction.resolved && action === NetworkErrorAction.SendAlternateToPenaltyBox);
    if (retry) {
      var _errorEvent$context;
      this.requestScheduled = -1;
      if (retryCount >= retryConfig.maxNumRetry) {
        return false;
      }
      if (isTimeout && (_errorEvent$context = errorEvent.context) != null && _errorEvent$context.deliveryDirectives) {
        // The LL-HLS request already timed out so retry immediately
        this.warn(`Retrying playlist loading ${retryCount + 1}/${retryConfig.maxNumRetry} after "${errorDetails}" without delivery-directives`);
        this.loadPlaylist();
      } else {
        const delay = getRetryDelay(retryConfig, retryCount);
        // Schedule level/track reload
        this.timer = self.setTimeout(() => this.loadPlaylist(), delay);
        this.warn(`Retrying playlist loading ${retryCount + 1}/${retryConfig.maxNumRetry} after "${errorDetails}" in ${delay}ms`);
      }
      // `levelRetry = true` used to inform other controllers that a retry is happening
      errorEvent.levelRetry = true;
      errorAction.resolved = true;
    }
    return retry;
  }
}

let chromeOrFirefox;
class LevelController extends BasePlaylistController {
  constructor(hls, contentSteeringController) {
    super(hls, '[level-controller]');
    this._levels = [];
    this._firstLevel = -1;
    this._startLevel = void 0;
    this.currentLevel = null;
    this.currentLevelIndex = -1;
    this.manualLevelIndex = -1;
    this.steering = void 0;
    this.onParsedComplete = void 0;
    this.steering = contentSteeringController;
    this._registerListeners();
  }
  _registerListeners() {
    const {
      hls
    } = this;
    hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.on(Events.MANIFEST_LOADED, this.onManifestLoaded, this);
    hls.on(Events.LEVEL_LOADED, this.onLevelLoaded, this);
    hls.on(Events.LEVELS_UPDATED, this.onLevelsUpdated, this);
    hls.on(Events.AUDIO_TRACK_SWITCHED, this.onAudioTrackSwitched, this);
    hls.on(Events.FRAG_LOADED, this.onFragLoaded, this);
    hls.on(Events.ERROR, this.onError, this);
  }
  _unregisterListeners() {
    const {
      hls
    } = this;
    hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.off(Events.MANIFEST_LOADED, this.onManifestLoaded, this);
    hls.off(Events.LEVEL_LOADED, this.onLevelLoaded, this);
    hls.off(Events.LEVELS_UPDATED, this.onLevelsUpdated, this);
    hls.off(Events.AUDIO_TRACK_SWITCHED, this.onAudioTrackSwitched, this);
    hls.off(Events.FRAG_LOADED, this.onFragLoaded, this);
    hls.off(Events.ERROR, this.onError, this);
  }
  destroy() {
    this._unregisterListeners();
    this.steering = null;
    this.resetLevels();
    super.destroy();
  }
  startLoad() {
    const levels = this._levels;

    // clean up live level details to force reload them, and reset load errors
    levels.forEach(level => {
      level.loadError = 0;
      level.fragmentError = 0;
    });
    super.startLoad();
  }
  resetLevels() {
    this._startLevel = undefined;
    this.manualLevelIndex = -1;
    this.currentLevelIndex = -1;
    this.currentLevel = null;
    this._levels = [];
  }
  onManifestLoading(event, data) {
    this.resetLevels();
  }
  onManifestLoaded(event, data) {
    const levels = [];
    const levelSet = {};
    let levelFromSet;

    // regroup redundant levels together
    data.levels.forEach(levelParsed => {
      var _levelParsed$audioCod;
      const attributes = levelParsed.attrs;

      // erase audio codec info if browser does not support mp4a.40.34.
      // demuxer will autodetect codec and fallback to mpeg/audio
      if (((_levelParsed$audioCod = levelParsed.audioCodec) == null ? void 0 : _levelParsed$audioCod.indexOf('mp4a.40.34')) !== -1) {
        chromeOrFirefox || (chromeOrFirefox = /chrome|firefox/i.test(navigator.userAgent));
        if (chromeOrFirefox) {
          levelParsed.audioCodec = undefined;
        }
      }
      const {
        AUDIO,
        CODECS,
        'FRAME-RATE': FRAMERATE,
        'PATHWAY-ID': PATHWAY,
        RESOLUTION,
        SUBTITLES
      } = attributes;
      const contentSteeringPrefix = '';
      const levelKey = `${contentSteeringPrefix}${levelParsed.bitrate}-${RESOLUTION}-${FRAMERATE}-${CODECS}`;
      levelFromSet = levelSet[levelKey];
      if (!levelFromSet) {
        levelFromSet = new Level(levelParsed);
        levelSet[levelKey] = levelFromSet;
        levels.push(levelFromSet);
      } else {
        levelFromSet.addFallback(levelParsed);
      }
      addGroupId(levelFromSet, 'audio', AUDIO);
      addGroupId(levelFromSet, 'text', SUBTITLES);
    });
    this.filterAndSortMediaOptions(levels, data);
  }
  filterAndSortMediaOptions(unfilteredLevels, data) {
    let audioTracks = [];
    let subtitleTracks = [];
    let resolutionFound = false;
    let videoCodecFound = false;
    let audioCodecFound = false;

    // only keep levels with supported audio/video codecs
    let levels = unfilteredLevels.filter(({
      audioCodec,
      videoCodec,
      width,
      height,
      unknownCodecs
    }) => {
      resolutionFound || (resolutionFound = !!(width && height));
      videoCodecFound || (videoCodecFound = !!videoCodec);
      audioCodecFound || (audioCodecFound = !!audioCodec);
      return !(unknownCodecs != null && unknownCodecs.length) && (!audioCodec || isCodecSupportedInMp4(audioCodec, 'audio')) && (!videoCodec || isCodecSupportedInMp4(videoCodec, 'video'));
    });

    // remove audio-only level if we also have levels with video codecs or RESOLUTION signalled
    if ((resolutionFound || videoCodecFound) && audioCodecFound) {
      levels = levels.filter(({
        videoCodec,
        width,
        height
      }) => !!videoCodec || !!(width && height));
    }
    if (levels.length === 0) {
      // Dispatch error after MANIFEST_LOADED is done propagating
      Promise.resolve().then(() => {
        if (this.hls) {
          const error = new Error('no level with compatible codecs found in manifest');
          this.hls.trigger(Events.ERROR, {
            type: ErrorTypes.MEDIA_ERROR,
            details: ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR,
            fatal: true,
            url: data.url,
            error,
            reason: error.message
          });
        }
      });
      return;
    }
    if (data.audioTracks) {
      audioTracks = data.audioTracks.filter(track => !track.audioCodec || isCodecSupportedInMp4(track.audioCodec, 'audio'));
      // Assign ids after filtering as array indices by group-id
      assignTrackIdsByGroup(audioTracks);
    }
    if (data.subtitles) {
      subtitleTracks = data.subtitles;
      assignTrackIdsByGroup(subtitleTracks);
    }
    // start bitrate is the first bitrate of the manifest
    const unsortedLevels = levels.slice(0);
    // sort levels from lowest to highest
    levels.sort((a, b) => {
      if (a.attrs['HDCP-LEVEL'] !== b.attrs['HDCP-LEVEL']) {
        return (a.attrs['HDCP-LEVEL'] || '') > (b.attrs['HDCP-LEVEL'] || '') ? 1 : -1;
      }
      if (a.bitrate !== b.bitrate) {
        return a.bitrate - b.bitrate;
      }
      if (a.attrs['FRAME-RATE'] !== b.attrs['FRAME-RATE']) {
        return a.attrs.decimalFloatingPoint('FRAME-RATE') - b.attrs.decimalFloatingPoint('FRAME-RATE');
      }
      if (a.attrs.SCORE !== b.attrs.SCORE) {
        return a.attrs.decimalFloatingPoint('SCORE') - b.attrs.decimalFloatingPoint('SCORE');
      }
      if (resolutionFound && a.height !== b.height) {
        return a.height - b.height;
      }
      return 0;
    });
    let firstLevelInPlaylist = unsortedLevels[0];
    if (this.steering) {
      levels = this.steering.filterParsedLevels(levels);
      if (levels.length !== unsortedLevels.length) {
        for (let i = 0; i < unsortedLevels.length; i++) {
          if (unsortedLevels[i].pathwayId === levels[0].pathwayId) {
            firstLevelInPlaylist = unsortedLevels[i];
            break;
          }
        }
      }
    }
    this._levels = levels;

    // find index of first level in sorted levels
    for (let i = 0; i < levels.length; i++) {
      if (levels[i] === firstLevelInPlaylist) {
        this._firstLevel = i;
        this.log(`manifest loaded, ${levels.length} level(s) found, first bitrate: ${firstLevelInPlaylist.bitrate}`);
        break;
      }
    }

    // Audio is only alternate if manifest include a URI along with the audio group tag,
    // and this is not an audio-only stream where levels contain audio-only
    const audioOnly = audioCodecFound && !videoCodecFound;
    const edata = {
      levels,
      audioTracks,
      subtitleTracks,
      sessionData: data.sessionData,
      sessionKeys: data.sessionKeys,
      firstLevel: this._firstLevel,
      stats: data.stats,
      audio: audioCodecFound,
      video: videoCodecFound,
      altAudio: !audioOnly && audioTracks.some(t => !!t.url)
    };
    this.hls.trigger(Events.MANIFEST_PARSED, edata);

    // Initiate loading after all controllers have received MANIFEST_PARSED
    if (this.hls.config.autoStartLoad || this.hls.forceStartLoad) {
      this.hls.startLoad(this.hls.config.startPosition);
    }
  }
  get levels() {
    if (this._levels.length === 0) {
      return null;
    }
    return this._levels;
  }
  get level() {
    return this.currentLevelIndex;
  }
  set level(newLevel) {
    const levels = this._levels;
    if (levels.length === 0) {
      return;
    }
    // check if level idx is valid
    if (newLevel < 0 || newLevel >= levels.length) {
      // invalid level id given, trigger error
      const error = new Error('invalid level idx');
      const fatal = newLevel < 0;
      this.hls.trigger(Events.ERROR, {
        type: ErrorTypes.OTHER_ERROR,
        details: ErrorDetails.LEVEL_SWITCH_ERROR,
        level: newLevel,
        fatal,
        error,
        reason: error.message
      });
      if (fatal) {
        return;
      }
      newLevel = Math.min(newLevel, levels.length - 1);
    }
    const lastLevelIndex = this.currentLevelIndex;
    const lastLevel = this.currentLevel;
    const lastPathwayId = lastLevel ? lastLevel.attrs['PATHWAY-ID'] : undefined;
    const level = levels[newLevel];
    const pathwayId = level.attrs['PATHWAY-ID'];
    this.currentLevelIndex = newLevel;
    this.currentLevel = level;
    if (lastLevelIndex === newLevel && level.details && lastLevel && lastPathwayId === pathwayId) {
      return;
    }
    this.log(`Switching to level ${newLevel}${pathwayId ? ' with Pathway ' + pathwayId : ''} from level ${lastLevelIndex}${lastPathwayId ? ' with Pathway ' + lastPathwayId : ''}`);
    const levelSwitchingData = _extends({}, level, {
      level: newLevel,
      maxBitrate: level.maxBitrate,
      attrs: level.attrs,
      uri: level.uri,
      urlId: level.urlId
    });
    // @ts-ignore
    delete levelSwitchingData._attrs;
    // @ts-ignore
    delete levelSwitchingData._urlId;
    this.hls.trigger(Events.LEVEL_SWITCHING, levelSwitchingData);
    // check if we need to load playlist for this level
    const levelDetails = level.details;
    if (!levelDetails || levelDetails.live) {
      // level not retrieved yet, or live playlist we need to (re)load it
      const hlsUrlParameters = this.switchParams(level.uri, lastLevel == null ? void 0 : lastLevel.details);
      this.loadPlaylist(hlsUrlParameters);
    }
  }
  get manualLevel() {
    return this.manualLevelIndex;
  }
  set manualLevel(newLevel) {
    this.manualLevelIndex = newLevel;
    if (this._startLevel === undefined) {
      this._startLevel = newLevel;
    }
    if (newLevel !== -1) {
      this.level = newLevel;
    }
  }
  get firstLevel() {
    return this._firstLevel;
  }
  set firstLevel(newLevel) {
    this._firstLevel = newLevel;
  }
  get startLevel() {
    // hls.startLevel takes precedence over config.startLevel
    // if none of these values are defined, fallback on this._firstLevel (first quality level appearing in variant manifest)
    if (this._startLevel === undefined) {
      const configStartLevel = this.hls.config.startLevel;
      if (configStartLevel !== undefined) {
        return configStartLevel;
      } else {
        return this._firstLevel;
      }
    } else {
      return this._startLevel;
    }
  }
  set startLevel(newLevel) {
    this._startLevel = newLevel;
  }
  onError(event, data) {
    if (data.fatal || !data.context) {
      return;
    }
    if (data.context.type === PlaylistContextType.LEVEL && data.context.level === this.level) {
      this.checkRetry(data);
    }
  }

  // reset errors on the successful load of a fragment
  onFragLoaded(event, {
    frag
  }) {
    if (frag !== undefined && frag.type === PlaylistLevelType.MAIN) {
      const level = this._levels[frag.level];
      if (level !== undefined) {
        level.loadError = 0;
      }
    }
  }
  onLevelLoaded(event, data) {
    var _data$deliveryDirecti2;
    const {
      level,
      details
    } = data;
    const curLevel = this._levels[level];
    if (!curLevel) {
      var _data$deliveryDirecti;
      this.warn(`Invalid level index ${level}`);
      if ((_data$deliveryDirecti = data.deliveryDirectives) != null && _data$deliveryDirecti.skip) {
        details.deltaUpdateFailed = true;
      }
      return;
    }

    // only process level loaded events matching with expected level
    if (level === this.currentLevelIndex) {
      // reset level load error counter on successful level loaded only if there is no issues with fragments
      if (curLevel.fragmentError === 0) {
        curLevel.loadError = 0;
      }
      this.playlistLoaded(level, data, curLevel.details);
    } else if ((_data$deliveryDirecti2 = data.deliveryDirectives) != null && _data$deliveryDirecti2.skip) {
      // received a delta playlist update that cannot be merged
      details.deltaUpdateFailed = true;
    }
  }
  onAudioTrackSwitched(event, data) {
    const currentLevel = this.currentLevel;
    if (!currentLevel) {
      return;
    }
    const audioGroupId = this.hls.audioTracks[data.id].groupId;
    if (currentLevel.audioGroupIds && currentLevel.audioGroupId !== audioGroupId) {
      let urlId = -1;
      for (let i = 0; i < currentLevel.audioGroupIds.length; i++) {
        if (currentLevel.audioGroupIds[i] === audioGroupId) {
          urlId = i;
          break;
        }
      }
      if (urlId !== -1 && urlId !== currentLevel.urlId) {
        currentLevel.urlId = urlId;
        if (this.canLoad) {
          this.startLoad();
        }
      }
    }
  }
  loadPlaylist(hlsUrlParameters) {
    super.loadPlaylist();
    const currentLevelIndex = this.currentLevelIndex;
    const currentLevel = this.currentLevel;
    if (currentLevel && this.shouldLoadPlaylist(currentLevel)) {
      const id = currentLevel.urlId;
      let url = currentLevel.uri;
      if (hlsUrlParameters) {
        try {
          url = hlsUrlParameters.addDirectives(url);
        } catch (error) {
          this.warn(`Could not construct new URL with HLS Delivery Directives: ${error}`);
        }
      }
      const pathwayId = currentLevel.attrs['PATHWAY-ID'];
      this.log(`Loading level index ${currentLevelIndex}${(hlsUrlParameters == null ? void 0 : hlsUrlParameters.msn) !== undefined ? ' at sn ' + hlsUrlParameters.msn + ' part ' + hlsUrlParameters.part : ''} with${pathwayId ? ' Pathway ' + pathwayId : ''} URI ${id + 1}/${currentLevel.url.length} ${url}`);

      // console.log('Current audio track group ID:', this.hls.audioTracks[this.hls.audioTrack].groupId);
      // console.log('New video quality level audio group id:', levelObject.attrs.AUDIO, level);
      this.clearTimer();
      this.hls.trigger(Events.LEVEL_LOADING, {
        url,
        level: currentLevelIndex,
        id,
        deliveryDirectives: hlsUrlParameters || null
      });
    }
  }
  get nextLoadLevel() {
    if (this.manualLevelIndex !== -1) {
      return this.manualLevelIndex;
    } else {
      return this.hls.nextAutoLevel;
    }
  }
  set nextLoadLevel(nextLevel) {
    this.level = nextLevel;
    if (this.manualLevelIndex === -1) {
      this.hls.nextAutoLevel = nextLevel;
    }
  }
  removeLevel(levelIndex, urlId) {
    const filterLevelAndGroupByIdIndex = (url, id) => id !== urlId;
    const levels = this._levels.filter((level, index) => {
      if (index !== levelIndex) {
        return true;
      }
      if (level.url.length > 1 && urlId !== undefined) {
        level.url = level.url.filter(filterLevelAndGroupByIdIndex);
        if (level.audioGroupIds) {
          level.audioGroupIds = level.audioGroupIds.filter(filterLevelAndGroupByIdIndex);
        }
        if (level.textGroupIds) {
          level.textGroupIds = level.textGroupIds.filter(filterLevelAndGroupByIdIndex);
        }
        level.urlId = 0;
        return true;
      }
      if (this.steering) {
        this.steering.removeLevel(level);
      }
      return false;
    });
    this.hls.trigger(Events.LEVELS_UPDATED, {
      levels
    });
  }
  onLevelsUpdated(event, {
    levels
  }) {
    levels.forEach((level, index) => {
      const {
        details
      } = level;
      if (details != null && details.fragments) {
        details.fragments.forEach(fragment => {
          fragment.level = index;
        });
      }
    });
    this._levels = levels;
  }
}
function addGroupId(level, type, id) {
  if (!id) {
    return;
  }
  if (type === 'audio') {
    if (!level.audioGroupIds) {
      level.audioGroupIds = [];
    }
    level.audioGroupIds[level.url.length - 1] = id;
  } else if (type === 'text') {
    if (!level.textGroupIds) {
      level.textGroupIds = [];
    }
    level.textGroupIds[level.url.length - 1] = id;
  }
}
function assignTrackIdsByGroup(tracks) {
  const groups = {};
  tracks.forEach(track => {
    const groupId = track.groupId || '';
    track.id = groups[groupId] = groups[groupId] || 0;
    groups[groupId]++;
  });
}

var FragmentState = {
  NOT_LOADED: "NOT_LOADED",
  APPENDING: "APPENDING",
  PARTIAL: "PARTIAL",
  OK: "OK"
};
class FragmentTracker {
  constructor(hls) {
    this.activePartLists = Object.create(null);
    this.endListFragments = Object.create(null);
    this.fragments = Object.create(null);
    this.timeRanges = Object.create(null);
    this.bufferPadding = 0.2;
    this.hls = void 0;
    this.hasGaps = false;
    this.hls = hls;
    this._registerListeners();
  }
  _registerListeners() {
    const {
      hls
    } = this;
    hls.on(Events.BUFFER_APPENDED, this.onBufferAppended, this);
    hls.on(Events.FRAG_BUFFERED, this.onFragBuffered, this);
    hls.on(Events.FRAG_LOADED, this.onFragLoaded, this);
  }
  _unregisterListeners() {
    const {
      hls
    } = this;
    hls.off(Events.BUFFER_APPENDED, this.onBufferAppended, this);
    hls.off(Events.FRAG_BUFFERED, this.onFragBuffered, this);
    hls.off(Events.FRAG_LOADED, this.onFragLoaded, this);
  }
  destroy() {
    this._unregisterListeners();
    // @ts-ignore
    this.fragments =
    // @ts-ignore
    this.activePartLists =
    // @ts-ignore
    this.endListFragments = this.timeRanges = null;
  }

  /**
   * Return a Fragment or Part with an appended range that matches the position and levelType
   * Otherwise, return null
   */
  getAppendedFrag(position, levelType) {
    const activeParts = this.activePartLists[levelType];
    if (activeParts) {
      for (let i = activeParts.length; i--;) {
        const activePart = activeParts[i];
        if (!activePart) {
          break;
        }
        const appendedPTS = activePart.end;
        if (activePart.start <= position && appendedPTS !== null && position <= appendedPTS) {
          return activePart;
        }
      }
    }
    return this.getBufferedFrag(position, levelType);
  }

  /**
   * Return a buffered Fragment that matches the position and levelType.
   * A buffered Fragment is one whose loading, parsing and appending is done (completed or "partial" meaning aborted).
   * If not found any Fragment, return null
   */
  getBufferedFrag(position, levelType) {
    const {
      fragments
    } = this;
    const keys = Object.keys(fragments);
    for (let i = keys.length; i--;) {
      const fragmentEntity = fragments[keys[i]];
      if ((fragmentEntity == null ? void 0 : fragmentEntity.body.type) === levelType && fragmentEntity.buffered) {
        const frag = fragmentEntity.body;
        if (frag.start <= position && position <= frag.end) {
          return frag;
        }
      }
    }
    return null;
  }

  /**
   * Partial fragments effected by coded frame eviction will be removed
   * The browser will unload parts of the buffer to free up memory for new buffer data
   * Fragments will need to be reloaded when the buffer is freed up, removing partial fragments will allow them to reload(since there might be parts that are still playable)
   */
  detectEvictedFragments(elementaryStream, timeRange, playlistType, appendedPart) {
    if (this.timeRanges) {
      this.timeRanges[elementaryStream] = timeRange;
    }
    // Check if any flagged fragments have been unloaded
    // excluding anything newer than appendedPartSn
    const appendedPartSn = (appendedPart == null ? void 0 : appendedPart.fragment.sn) || -1;
    Object.keys(this.fragments).forEach(key => {
      const fragmentEntity = this.fragments[key];
      if (!fragmentEntity) {
        return;
      }
      if (appendedPartSn >= fragmentEntity.body.sn) {
        return;
      }
      if (!fragmentEntity.buffered && !fragmentEntity.loaded) {
        if (fragmentEntity.body.type === playlistType) {
          this.removeFragment(fragmentEntity.body);
        }
        return;
      }
      const esData = fragmentEntity.range[elementaryStream];
      if (!esData) {
        return;
      }
      esData.time.some(time => {
        const isNotBuffered = !this.isTimeBuffered(time.startPTS, time.endPTS, timeRange);
        if (isNotBuffered) {
          // Unregister partial fragment as it needs to load again to be reused
          this.removeFragment(fragmentEntity.body);
        }
        return isNotBuffered;
      });
    });
  }

  /**
   * Checks if the fragment passed in is loaded in the buffer properly
   * Partially loaded fragments will be registered as a partial fragment
   */
  detectPartialFragments(data) {
    const timeRanges = this.timeRanges;
    const {
      frag,
      part
    } = data;
    if (!timeRanges || frag.sn === 'initSegment') {
      return;
    }
    const fragKey = getFragmentKey(frag);
    const fragmentEntity = this.fragments[fragKey];
    if (!fragmentEntity || fragmentEntity.buffered && frag.gap) {
      return;
    }
    const isFragHint = !frag.relurl;
    Object.keys(timeRanges).forEach(elementaryStream => {
      const streamInfo = frag.elementaryStreams[elementaryStream];
      if (!streamInfo) {
        return;
      }
      const timeRange = timeRanges[elementaryStream];
      const partial = isFragHint || streamInfo.partial === true;
      fragmentEntity.range[elementaryStream] = this.getBufferedTimes(frag, part, partial, timeRange);
    });
    fragmentEntity.loaded = null;
    if (Object.keys(fragmentEntity.range).length) {
      fragmentEntity.buffered = true;
      const endList = fragmentEntity.body.endList = frag.endList || fragmentEntity.body.endList;
      if (endList) {
        this.endListFragments[fragmentEntity.body.type] = fragmentEntity;
      }
      if (!isPartial(fragmentEntity)) {
        // Remove older fragment parts from lookup after frag is tracked as buffered
        this.removeParts(frag.sn - 1, frag.type);
      }
    } else {
      // remove fragment if nothing was appended
      this.removeFragment(fragmentEntity.body);
    }
  }
  removeParts(snToKeep, levelType) {
    const activeParts = this.activePartLists[levelType];
    if (!activeParts) {
      return;
    }
    this.activePartLists[levelType] = activeParts.filter(part => part.fragment.sn >= snToKeep);
  }
  fragBuffered(frag, force) {
    const fragKey = getFragmentKey(frag);
    let fragmentEntity = this.fragments[fragKey];
    if (!fragmentEntity && force) {
      fragmentEntity = this.fragments[fragKey] = {
        body: frag,
        appendedPTS: null,
        loaded: null,
        buffered: false,
        range: Object.create(null)
      };
      if (frag.gap) {
        this.hasGaps = true;
      }
    }
    if (fragmentEntity) {
      fragmentEntity.loaded = null;
      fragmentEntity.buffered = true;
    }
  }
  getBufferedTimes(fragment, part, partial, timeRange) {
    const buffered = {
      time: [],
      partial
    };
    const startPTS = fragment.start;
    const endPTS = fragment.end;
    const minEndPTS = fragment.minEndPTS || endPTS;
    const maxStartPTS = fragment.maxStartPTS || startPTS;
    for (let i = 0; i < timeRange.length; i++) {
      const startTime = timeRange.start(i) - this.bufferPadding;
      const endTime = timeRange.end(i) + this.bufferPadding;
      if (maxStartPTS >= startTime && minEndPTS <= endTime) {
        // Fragment is entirely contained in buffer
        // No need to check the other timeRange times since it's completely playable
        buffered.time.push({
          startPTS: Math.max(startPTS, timeRange.start(i)),
          endPTS: Math.min(endPTS, timeRange.end(i))
        });
        break;
      } else if (startPTS < endTime && endPTS > startTime) {
        buffered.partial = true;
        // Check for intersection with buffer
        // Get playable sections of the fragment
        buffered.time.push({
          startPTS: Math.max(startPTS, timeRange.start(i)),
          endPTS: Math.min(endPTS, timeRange.end(i))
        });
      } else if (endPTS <= startTime) {
        // No need to check the rest of the timeRange as it is in order
        break;
      }
    }
    return buffered;
  }

  /**
   * Gets the partial fragment for a certain time
   */
  getPartialFragment(time) {
    let bestFragment = null;
    let timePadding;
    let startTime;
    let endTime;
    let bestOverlap = 0;
    const {
      bufferPadding,
      fragments
    } = this;
    Object.keys(fragments).forEach(key => {
      const fragmentEntity = fragments[key];
      if (!fragmentEntity) {
        return;
      }
      if (isPartial(fragmentEntity)) {
        startTime = fragmentEntity.body.start - bufferPadding;
        endTime = fragmentEntity.body.end + bufferPadding;
        if (time >= startTime && time <= endTime) {
          // Use the fragment that has the most padding from start and end time
          timePadding = Math.min(time - startTime, endTime - time);
          if (bestOverlap <= timePadding) {
            bestFragment = fragmentEntity.body;
            bestOverlap = timePadding;
          }
        }
      }
    });
    return bestFragment;
  }
  isEndListAppended(type) {
    const lastFragmentEntity = this.endListFragments[type];
    return lastFragmentEntity !== undefined && (lastFragmentEntity.buffered || isPartial(lastFragmentEntity));
  }
  getState(fragment) {
    const fragKey = getFragmentKey(fragment);
    const fragmentEntity = this.fragments[fragKey];
    if (fragmentEntity) {
      if (!fragmentEntity.buffered) {
        return FragmentState.APPENDING;
      } else if (isPartial(fragmentEntity)) {
        return FragmentState.PARTIAL;
      } else {
        return FragmentState.OK;
      }
    }
    return FragmentState.NOT_LOADED;
  }
  isTimeBuffered(startPTS, endPTS, timeRange) {
    let startTime;
    let endTime;
    for (let i = 0; i < timeRange.length; i++) {
      startTime = timeRange.start(i) - this.bufferPadding;
      endTime = timeRange.end(i) + this.bufferPadding;
      if (startPTS >= startTime && endPTS <= endTime) {
        return true;
      }
      if (endPTS <= startTime) {
        // No need to check the rest of the timeRange as it is in order
        return false;
      }
    }
    return false;
  }
  onFragLoaded(event, data) {
    const {
      frag,
      part
    } = data;
    // don't track initsegment (for which sn is not a number)
    // don't track frags used for bitrateTest, they're irrelevant.
    if (frag.sn === 'initSegment' || frag.bitrateTest) {
      return;
    }

    // Fragment entity `loaded` FragLoadedData is null when loading parts
    const loaded = part ? null : data;
    const fragKey = getFragmentKey(frag);
    this.fragments[fragKey] = {
      body: frag,
      appendedPTS: null,
      loaded,
      buffered: false,
      range: Object.create(null)
    };
  }
  onBufferAppended(event, data) {
    const {
      frag,
      part,
      timeRanges
    } = data;
    if (frag.sn === 'initSegment') {
      return;
    }
    const playlistType = frag.type;
    if (part) {
      let activeParts = this.activePartLists[playlistType];
      if (!activeParts) {
        this.activePartLists[playlistType] = activeParts = [];
      }
      activeParts.push(part);
    }
    // Store the latest timeRanges loaded in the buffer
    this.timeRanges = timeRanges;
    Object.keys(timeRanges).forEach(elementaryStream => {
      const timeRange = timeRanges[elementaryStream];
      this.detectEvictedFragments(elementaryStream, timeRange, playlistType, part);
    });
  }
  onFragBuffered(event, data) {
    this.detectPartialFragments(data);
  }
  hasFragment(fragment) {
    const fragKey = getFragmentKey(fragment);
    return !!this.fragments[fragKey];
  }
  hasParts(type) {
    var _this$activePartLists;
    return !!((_this$activePartLists = this.activePartLists[type]) != null && _this$activePartLists.length);
  }
  removeFragmentsInRange(start, end, playlistType, withGapOnly, unbufferedOnly) {
    if (withGapOnly && !this.hasGaps) {
      return;
    }
    Object.keys(this.fragments).forEach(key => {
      const fragmentEntity = this.fragments[key];
      if (!fragmentEntity) {
        return;
      }
      const frag = fragmentEntity.body;
      if (frag.type !== playlistType || withGapOnly && !frag.gap) {
        return;
      }
      if (frag.start < end && frag.end > start && (fragmentEntity.buffered || unbufferedOnly)) {
        this.removeFragment(frag);
      }
    });
  }
  removeFragment(fragment) {
    const fragKey = getFragmentKey(fragment);
    fragment.stats.loaded = 0;
    fragment.clearElementaryStreamInfo();
    const activeParts = this.activePartLists[fragment.type];
    if (activeParts) {
      const snToRemove = fragment.sn;
      this.activePartLists[fragment.type] = activeParts.filter(part => part.fragment.sn !== snToRemove);
    }
    delete this.fragments[fragKey];
    if (fragment.endList) {
      delete this.endListFragments[fragment.type];
    }
  }
  removeAllFragments() {
    this.fragments = Object.create(null);
    this.endListFragments = Object.create(null);
    this.activePartLists = Object.create(null);
    this.hasGaps = false;
  }
}
function isPartial(fragmentEntity) {
  var _fragmentEntity$range, _fragmentEntity$range2, _fragmentEntity$range3;
  return fragmentEntity.buffered && (fragmentEntity.body.gap || ((_fragmentEntity$range = fragmentEntity.range.video) == null ? void 0 : _fragmentEntity$range.partial) || ((_fragmentEntity$range2 = fragmentEntity.range.audio) == null ? void 0 : _fragmentEntity$range2.partial) || ((_fragmentEntity$range3 = fragmentEntity.range.audiovideo) == null ? void 0 : _fragmentEntity$range3.partial));
}
function getFragmentKey(fragment) {
  return `${fragment.type}_${fragment.level}_${fragment.urlId}_${fragment.sn}`;
}

const MIN_CHUNK_SIZE = Math.pow(2, 17); // 128kb

class FragmentLoader {
  constructor(config) {
    this.config = void 0;
    this.loader = null;
    this.partLoadTimeout = -1;
    this.config = config;
  }
  destroy() {
    if (this.loader) {
      this.loader.destroy();
      this.loader = null;
    }
  }
  abort() {
    if (this.loader) {
      // Abort the loader for current fragment. Only one may load at any given time
      this.loader.abort();
    }
  }
  load(frag, onProgress) {
    const url = frag.url;
    if (!url) {
      return Promise.reject(new LoadError({
        type: ErrorTypes.NETWORK_ERROR,
        details: ErrorDetails.FRAG_LOAD_ERROR,
        fatal: false,
        frag,
        error: new Error(`Fragment does not have a ${url ? 'part list' : 'url'}`),
        networkDetails: null
      }));
    }
    this.abort();
    const config = this.config;
    const FragmentILoader = config.fLoader;
    const DefaultILoader = config.loader;
    return new Promise((resolve, reject) => {
      if (this.loader) {
        this.loader.destroy();
      }
      if (frag.gap) {
        if (frag.tagList.some(tags => tags[0] === 'GAP')) {
          reject(createGapLoadError(frag));
          return;
        } else {
          // Reset temporary treatment as GAP tag
          frag.gap = false;
        }
      }
      const loader = this.loader = frag.loader = FragmentILoader ? new FragmentILoader(config) : new DefaultILoader(config);
      const loaderContext = createLoaderContext(frag);
      const loadPolicy = getLoaderConfigWithoutReties(config.fragLoadPolicy.default);
      const loaderConfig = {
        loadPolicy,
        timeout: loadPolicy.maxLoadTimeMs,
        maxRetry: 0,
        retryDelay: 0,
        maxRetryDelay: 0,
        highWaterMark: frag.sn === 'initSegment' ? Infinity : MIN_CHUNK_SIZE
      };
      // Assign frag stats to the loader's stats reference
      frag.stats = loader.stats;
      loader.load(loaderContext, loaderConfig, {
        onSuccess: (response, stats, context, networkDetails) => {
          this.resetLoader(frag, loader);
          let payload = response.data;
          if (context.resetIV && frag.decryptdata) {
            frag.decryptdata.iv = new Uint8Array(payload.slice(0, 16));
            payload = payload.slice(16);
          }
          resolve({
            frag,
            part: null,
            payload,
            networkDetails
          });
        },
        onError: (response, context, networkDetails, stats) => {
          this.resetLoader(frag, loader);
          reject(new LoadError({
            type: ErrorTypes.NETWORK_ERROR,
            details: ErrorDetails.FRAG_LOAD_ERROR,
            fatal: false,
            frag,
            response: _objectSpread2({
              url,
              data: undefined
            }, response),
            error: new Error(`HTTP Error ${response.code} ${response.text}`),
            networkDetails,
            stats
          }));
        },
        onAbort: (stats, context, networkDetails) => {
          this.resetLoader(frag, loader);
          reject(new LoadError({
            type: ErrorTypes.NETWORK_ERROR,
            details: ErrorDetails.INTERNAL_ABORTED,
            fatal: false,
            frag,
            error: new Error('Aborted'),
            networkDetails,
            stats
          }));
        },
        onTimeout: (stats, context, networkDetails) => {
          this.resetLoader(frag, loader);
          reject(new LoadError({
            type: ErrorTypes.NETWORK_ERROR,
            details: ErrorDetails.FRAG_LOAD_TIMEOUT,
            fatal: false,
            frag,
            error: new Error(`Timeout after ${loaderConfig.timeout}ms`),
            networkDetails,
            stats
          }));
        },
        onProgress: (stats, context, data, networkDetails) => {
          if (onProgress) {
            onProgress({
              frag,
              part: null,
              payload: data,
              networkDetails
            });
          }
        }
      });
    });
  }
  loadPart(frag, part, onProgress) {
    this.abort();
    const config = this.config;
    const FragmentILoader = config.fLoader;
    const DefaultILoader = config.loader;
    return new Promise((resolve, reject) => {
      if (this.loader) {
        this.loader.destroy();
      }
      if (frag.gap || part.gap) {
        reject(createGapLoadError(frag, part));
        return;
      }
      const loader = this.loader = frag.loader = FragmentILoader ? new FragmentILoader(config) : new DefaultILoader(config);
      const loaderContext = createLoaderContext(frag, part);
      // Should we define another load policy for parts?
      const loadPolicy = getLoaderConfigWithoutReties(config.fragLoadPolicy.default);
      const loaderConfig = {
        loadPolicy,
        timeout: loadPolicy.maxLoadTimeMs,
        maxRetry: 0,
        retryDelay: 0,
        maxRetryDelay: 0,
        highWaterMark: MIN_CHUNK_SIZE
      };
      // Assign part stats to the loader's stats reference
      part.stats = loader.stats;
      loader.load(loaderContext, loaderConfig, {
        onSuccess: (response, stats, context, networkDetails) => {
          this.resetLoader(frag, loader);
          this.updateStatsFromPart(frag, part);
          const partLoadedData = {
            frag,
            part,
            payload: response.data,
            networkDetails
          };
          onProgress(partLoadedData);
          resolve(partLoadedData);
        },
        onError: (response, context, networkDetails, stats) => {
          this.resetLoader(frag, loader);
          reject(new LoadError({
            type: ErrorTypes.NETWORK_ERROR,
            details: ErrorDetails.FRAG_LOAD_ERROR,
            fatal: false,
            frag,
            part,
            response: _objectSpread2({
              url: loaderContext.url,
              data: undefined
            }, response),
            error: new Error(`HTTP Error ${response.code} ${response.text}`),
            networkDetails,
            stats
          }));
        },
        onAbort: (stats, context, networkDetails) => {
          frag.stats.aborted = part.stats.aborted;
          this.resetLoader(frag, loader);
          reject(new LoadError({
            type: ErrorTypes.NETWORK_ERROR,
            details: ErrorDetails.INTERNAL_ABORTED,
            fatal: false,
            frag,
            part,
            error: new Error('Aborted'),
            networkDetails,
            stats
          }));
        },
        onTimeout: (stats, context, networkDetails) => {
          this.resetLoader(frag, loader);
          reject(new LoadError({
            type: ErrorTypes.NETWORK_ERROR,
            details: ErrorDetails.FRAG_LOAD_TIMEOUT,
            fatal: false,
            frag,
            part,
            error: new Error(`Timeout after ${loaderConfig.timeout}ms`),
            networkDetails,
            stats
          }));
        }
      });
    });
  }
  updateStatsFromPart(frag, part) {
    const fragStats = frag.stats;
    const partStats = part.stats;
    const partTotal = partStats.total;
    fragStats.loaded += partStats.loaded;
    if (partTotal) {
      const estTotalParts = Math.round(frag.duration / part.duration);
      const estLoadedParts = Math.min(Math.round(fragStats.loaded / partTotal), estTotalParts);
      const estRemainingParts = estTotalParts - estLoadedParts;
      const estRemainingBytes = estRemainingParts * Math.round(fragStats.loaded / estLoadedParts);
      fragStats.total = fragStats.loaded + estRemainingBytes;
    } else {
      fragStats.total = Math.max(fragStats.loaded, fragStats.total);
    }
    const fragLoading = fragStats.loading;
    const partLoading = partStats.loading;
    if (fragLoading.start) {
      // add to fragment loader latency
      fragLoading.first += partLoading.first - partLoading.start;
    } else {
      fragLoading.start = partLoading.start;
      fragLoading.first = partLoading.first;
    }
    fragLoading.end = partLoading.end;
  }
  resetLoader(frag, loader) {
    frag.loader = null;
    if (this.loader === loader) {
      self.clearTimeout(this.partLoadTimeout);
      this.loader = null;
    }
    loader.destroy();
  }
}
function createLoaderContext(frag, part = null) {
  const segment = part || frag;
  const loaderContext = {
    frag,
    part,
    responseType: 'arraybuffer',
    url: segment.url,
    headers: {},
    rangeStart: 0,
    rangeEnd: 0
  };
  const start = segment.byteRangeStartOffset;
  const end = segment.byteRangeEndOffset;
  if (isFiniteNumber(start) && isFiniteNumber(end)) {
    var _frag$decryptdata;
    let byteRangeStart = start;
    let byteRangeEnd = end;
    if (frag.sn === 'initSegment' && ((_frag$decryptdata = frag.decryptdata) == null ? void 0 : _frag$decryptdata.method) === 'AES-128') {
      // MAP segment encrypted with method 'AES-128', when served with HTTP Range,
      // has the unencrypted size specified in the range.
      // Ref: https://tools.ietf.org/html/draft-pantos-hls-rfc8216bis-08#section-6.3.6
      const fragmentLen = end - start;
      if (fragmentLen % 16) {
        byteRangeEnd = end + (16 - fragmentLen % 16);
      }
      if (start !== 0) {
        loaderContext.resetIV = true;
        byteRangeStart = start - 16;
      }
    }
    loaderContext.rangeStart = byteRangeStart;
    loaderContext.rangeEnd = byteRangeEnd;
  }
  return loaderContext;
}
function createGapLoadError(frag, part) {
  const error = new Error(`GAP ${frag.gap ? 'tag' : 'attribute'} found`);
  const errorData = {
    type: ErrorTypes.MEDIA_ERROR,
    details: ErrorDetails.FRAG_GAP,
    fatal: false,
    frag,
    error,
    networkDetails: null
  };
  if (part) {
    errorData.part = part;
  }
  (part ? part : frag).stats.aborted = true;
  return new LoadError(errorData);
}
class LoadError extends Error {
  constructor(data) {
    super(data.error.message);
    this.data = void 0;
    this.data = data;
  }
}

class KeyLoader {
  constructor(config) {
    this.config = void 0;
    this.keyUriToKeyInfo = {};
    this.emeController = null;
    this.config = config;
  }
  abort(type) {
    for (const uri in this.keyUriToKeyInfo) {
      const loader = this.keyUriToKeyInfo[uri].loader;
      if (loader) {
        if (type && type !== loader.context.frag.type) {
          return;
        }
        loader.abort();
      }
    }
  }
  detach() {
    for (const uri in this.keyUriToKeyInfo) {
      const keyInfo = this.keyUriToKeyInfo[uri];
      // Remove cached EME keys on detach
      if (keyInfo.mediaKeySessionContext || keyInfo.decryptdata.isCommonEncryption) {
        delete this.keyUriToKeyInfo[uri];
      }
    }
  }
  destroy() {
    this.detach();
    for (const uri in this.keyUriToKeyInfo) {
      const loader = this.keyUriToKeyInfo[uri].loader;
      if (loader) {
        loader.destroy();
      }
    }
    this.keyUriToKeyInfo = {};
  }
  createKeyLoadError(frag, details = ErrorDetails.KEY_LOAD_ERROR, error, networkDetails, response) {
    return new LoadError({
      type: ErrorTypes.NETWORK_ERROR,
      details,
      fatal: false,
      frag,
      response,
      error,
      networkDetails
    });
  }
  loadClear(loadingFrag, encryptedFragments) {
    if (this.emeController && this.config.emeEnabled) {
      // access key-system with nearest key on start (loaidng frag is unencrypted)
      const {
        sn,
        cc
      } = loadingFrag;
      for (let i = 0; i < encryptedFragments.length; i++) {
        const frag = encryptedFragments[i];
        if (cc <= frag.cc && (sn === 'initSegment' || frag.sn === 'initSegment' || sn < frag.sn)) {
          this.emeController.selectKeySystemFormat(frag).then(keySystemFormat => {
            frag.setKeyFormat(keySystemFormat);
          });
          break;
        }
      }
    }
  }
  load(frag) {
    if (!frag.decryptdata && frag.encrypted && this.emeController) {
      // Multiple keys, but none selected, resolve in eme-controller
      return this.emeController.selectKeySystemFormat(frag).then(keySystemFormat => {
        return this.loadInternal(frag, keySystemFormat);
      });
    }
    return this.loadInternal(frag);
  }
  loadInternal(frag, keySystemFormat) {
    var _keyInfo, _keyInfo2;
    if (keySystemFormat) {
      frag.setKeyFormat(keySystemFormat);
    }
    const decryptdata = frag.decryptdata;
    if (!decryptdata) {
      const error = new Error(keySystemFormat ? `Expected frag.decryptdata to be defined after setting format ${keySystemFormat}` : 'Missing decryption data on fragment in onKeyLoading');
      return Promise.reject(this.createKeyLoadError(frag, ErrorDetails.KEY_LOAD_ERROR, error));
    }
    const uri = decryptdata.uri;
    if (!uri) {
      return Promise.reject(this.createKeyLoadError(frag, ErrorDetails.KEY_LOAD_ERROR, new Error(`Invalid key URI: "${uri}"`)));
    }
    let keyInfo = this.keyUriToKeyInfo[uri];
    if ((_keyInfo = keyInfo) != null && _keyInfo.decryptdata.key) {
      decryptdata.key = keyInfo.decryptdata.key;
      return Promise.resolve({
        frag,
        keyInfo
      });
    }
    // Return key load promise as long as it does not have a mediakey session with an unusable key status
    if ((_keyInfo2 = keyInfo) != null && _keyInfo2.keyLoadPromise) {
      var _keyInfo$mediaKeySess;
      switch ((_keyInfo$mediaKeySess = keyInfo.mediaKeySessionContext) == null ? void 0 : _keyInfo$mediaKeySess.keyStatus) {
        case undefined:
        case 'status-pending':
        case 'usable':
        case 'usable-in-future':
          return keyInfo.keyLoadPromise.then(keyLoadedData => {
            // Return the correct fragment with updated decryptdata key and loaded keyInfo
            decryptdata.key = keyLoadedData.keyInfo.decryptdata.key;
            return {
              frag,
              keyInfo
            };
          });
      }
      // If we have a key session and status and it is not pending or usable, continue
      // This will go back to the eme-controller for expired keys to get a new keyLoadPromise
    }

    // Load the key or return the loading promise
    keyInfo = this.keyUriToKeyInfo[uri] = {
      decryptdata,
      keyLoadPromise: null,
      loader: null,
      mediaKeySessionContext: null
    };
    switch (decryptdata.method) {
      case 'ISO-23001-7':
      case 'SAMPLE-AES':
      case 'SAMPLE-AES-CENC':
      case 'SAMPLE-AES-CTR':
        if (decryptdata.keyFormat === 'identity') {
          // loadKeyHTTP handles http(s) and data URLs
          return this.loadKeyHTTP(keyInfo, frag);
        }
        return this.loadKeyEME(keyInfo, frag);
      case 'AES-128':
        return this.loadKeyHTTP(keyInfo, frag);
      default:
        return Promise.reject(this.createKeyLoadError(frag, ErrorDetails.KEY_LOAD_ERROR, new Error(`Key supplied with unsupported METHOD: "${decryptdata.method}"`)));
    }
  }
  loadKeyEME(keyInfo, frag) {
    const keyLoadedData = {
      frag,
      keyInfo
    };
    if (this.emeController && this.config.emeEnabled) {
      const keySessionContextPromise = this.emeController.loadKey(keyLoadedData);
      if (keySessionContextPromise) {
        return (keyInfo.keyLoadPromise = keySessionContextPromise.then(keySessionContext => {
          keyInfo.mediaKeySessionContext = keySessionContext;
          return keyLoadedData;
        })).catch(error => {
          // Remove promise for license renewal or retry
          keyInfo.keyLoadPromise = null;
          throw error;
        });
      }
    }
    return Promise.resolve(keyLoadedData);
  }
  loadKeyHTTP(keyInfo, frag) {
    const config = this.config;
    const Loader = config.loader;
    const keyLoader = new Loader(config);
    frag.keyLoader = keyInfo.loader = keyLoader;
    return keyInfo.keyLoadPromise = new Promise((resolve, reject) => {
      const loaderContext = {
        keyInfo,
        frag,
        responseType: 'arraybuffer',
        url: keyInfo.decryptdata.uri
      };

      // maxRetry is 0 so that instead of retrying the same key on the same variant multiple times,
      // key-loader will trigger an error and rely on stream-controller to handle retry logic.
      // this will also align retry logic with fragment-loader
      const loadPolicy = config.keyLoadPolicy.default;
      const loaderConfig = {
        loadPolicy,
        timeout: loadPolicy.maxLoadTimeMs,
        maxRetry: 0,
        retryDelay: 0,
        maxRetryDelay: 0
      };
      const loaderCallbacks = {
        onSuccess: (response, stats, context, networkDetails) => {
          const {
            frag,
            keyInfo,
            url: uri
          } = context;
          if (!frag.decryptdata || keyInfo !== this.keyUriToKeyInfo[uri]) {
            return reject(this.createKeyLoadError(frag, ErrorDetails.KEY_LOAD_ERROR, new Error('after key load, decryptdata unset or changed'), networkDetails));
          }
          keyInfo.decryptdata.key = frag.decryptdata.key = new Uint8Array(response.data);

          // detach fragment key loader on load success
          frag.keyLoader = null;
          keyInfo.loader = null;
          resolve({
            frag,
            keyInfo
          });
        },
        onError: (response, context, networkDetails, stats) => {
          this.resetLoader(context);
          reject(this.createKeyLoadError(frag, ErrorDetails.KEY_LOAD_ERROR, new Error(`HTTP Error ${response.code} loading key ${response.text}`), networkDetails, _objectSpread2({
            url: loaderContext.url,
            data: undefined
          }, response)));
        },
        onTimeout: (stats, context, networkDetails) => {
          this.resetLoader(context);
          reject(this.createKeyLoadError(frag, ErrorDetails.KEY_LOAD_TIMEOUT, new Error('key loading timed out'), networkDetails));
        },
        onAbort: (stats, context, networkDetails) => {
          this.resetLoader(context);
          reject(this.createKeyLoadError(frag, ErrorDetails.INTERNAL_ABORTED, new Error('key loading aborted'), networkDetails));
        }
      };
      keyLoader.load(loaderContext, loaderConfig, loaderCallbacks);
    });
  }
  resetLoader(context) {
    const {
      frag,
      keyInfo,
      url: uri
    } = context;
    const loader = keyInfo.loader;
    if (frag.keyLoader === loader) {
      frag.keyLoader = null;
      keyInfo.loader = null;
    }
    delete this.keyUriToKeyInfo[uri];
    if (loader) {
      loader.destroy();
    }
  }
}

/**
 * @ignore
 * Sub-class specialization of EventHandler base class.
 *
 * TaskLoop allows to schedule a task function being called (optionnaly repeatedly) on the main loop,
 * scheduled asynchroneously, avoiding recursive calls in the same tick.
 *
 * The task itself is implemented in `doTick`. It can be requested and called for single execution
 * using the `tick` method.
 *
 * It will be assured that the task execution method (`tick`) only gets called once per main loop "tick",
 * no matter how often it gets requested for execution. Execution in further ticks will be scheduled accordingly.
 *
 * If further execution requests have already been scheduled on the next tick, it can be checked with `hasNextTick`,
 * and cancelled with `clearNextTick`.
 *
 * The task can be scheduled as an interval repeatedly with a period as parameter (see `setInterval`, `clearInterval`).
 *
 * Sub-classes need to implement the `doTick` method which will effectively have the task execution routine.
 *
 * Further explanations:
 *
 * The baseclass has a `tick` method that will schedule the doTick call. It may be called synchroneously
 * only for a stack-depth of one. On re-entrant calls, sub-sequent calls are scheduled for next main loop ticks.
 *
 * When the task execution (`tick` method) is called in re-entrant way this is detected and
 * we are limiting the task execution per call stack to exactly one, but scheduling/post-poning further
 * task processing on the next main loop iteration (also known as "next tick" in the Node/JS runtime lingo).
 */
class TaskLoop {
  constructor() {
    this._boundTick = void 0;
    this._tickTimer = null;
    this._tickInterval = null;
    this._tickCallCount = 0;
    this._boundTick = this.tick.bind(this);
  }
  destroy() {
    this.onHandlerDestroying();
    this.onHandlerDestroyed();
  }
  onHandlerDestroying() {
    // clear all timers before unregistering from event bus
    this.clearNextTick();
    this.clearInterval();
  }
  onHandlerDestroyed() {}
  hasInterval() {
    return !!this._tickInterval;
  }
  hasNextTick() {
    return !!this._tickTimer;
  }

  /**
   * @param millis - Interval time (ms)
   * @eturns True when interval has been scheduled, false when already scheduled (no effect)
   */
  setInterval(millis) {
    if (!this._tickInterval) {
      this._tickCallCount = 0;
      this._tickInterval = self.setInterval(this._boundTick, millis);
      return true;
    }
    return false;
  }

  /**
   * @returns True when interval was cleared, false when none was set (no effect)
   */
  clearInterval() {
    if (this._tickInterval) {
      self.clearInterval(this._tickInterval);
      this._tickInterval = null;
      return true;
    }
    return false;
  }

  /**
   * @returns True when timeout was cleared, false when none was set (no effect)
   */
  clearNextTick() {
    if (this._tickTimer) {
      self.clearTimeout(this._tickTimer);
      this._tickTimer = null;
      return true;
    }
    return false;
  }

  /**
   * Will call the subclass doTick implementation in this main loop tick
   * or in the next one (via setTimeout(,0)) in case it has already been called
   * in this tick (in case this is a re-entrant call).
   */
  tick() {
    this._tickCallCount++;
    if (this._tickCallCount === 1) {
      this.doTick();
      // re-entrant call to tick from previous doTick call stack
      // -> schedule a call on the next main loop iteration to process this task processing request
      if (this._tickCallCount > 1) {
        // make sure only one timer exists at any time at max
        this.tickImmediate();
      }
      this._tickCallCount = 0;
    }
  }
  tickImmediate() {
    this.clearNextTick();
    this._tickTimer = self.setTimeout(this._boundTick, 0);
  }

  /**
   * For subclass to implement task logic
   * @abstract
   */
  doTick() {}
}

/**
 * Provides methods dealing with buffer length retrieval for example.
 *
 * In general, a helper around HTML5 MediaElement TimeRanges gathered from `buffered` property.
 *
 * Also @see https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/buffered
 */

const noopBuffered = {
  length: 0,
  start: () => 0,
  end: () => 0
};
class BufferHelper {
  /**
   * Return true if `media`'s buffered include `position`
   */
  static isBuffered(media, position) {
    try {
      if (media) {
        const buffered = BufferHelper.getBuffered(media);
        for (let i = 0; i < buffered.length; i++) {
          if (position >= buffered.start(i) && position <= buffered.end(i)) {
            return true;
          }
        }
      }
    } catch (error) {
      // this is to catch
      // InvalidStateError: Failed to read the 'buffered' property from 'SourceBuffer':
      // This SourceBuffer has been removed from the parent media source
    }
    return false;
  }
  static bufferInfo(media, pos, maxHoleDuration) {
    try {
      if (media) {
        const vbuffered = BufferHelper.getBuffered(media);
        const buffered = [];
        let i;
        for (i = 0; i < vbuffered.length; i++) {
          buffered.push({
            start: vbuffered.start(i),
            end: vbuffered.end(i)
          });
        }
        return this.bufferedInfo(buffered, pos, maxHoleDuration);
      }
    } catch (error) {
      // this is to catch
      // InvalidStateError: Failed to read the 'buffered' property from 'SourceBuffer':
      // This SourceBuffer has been removed from the parent media source
    }
    return {
      len: 0,
      start: pos,
      end: pos,
      nextStart: undefined
    };
  }
  static bufferedInfo(buffered, pos, maxHoleDuration) {
    pos = Math.max(0, pos);
    // sort on buffer.start/smaller end (IE does not always return sorted buffered range)
    buffered.sort(function (a, b) {
      const diff = a.start - b.start;
      if (diff) {
        return diff;
      } else {
        return b.end - a.end;
      }
    });
    let buffered2 = [];
    if (maxHoleDuration) {
      // there might be some small holes between buffer time range
      // consider that holes smaller than maxHoleDuration are irrelevant and build another
      // buffer time range representations that discards those holes
      for (let i = 0; i < buffered.length; i++) {
        const buf2len = buffered2.length;
        if (buf2len) {
          const buf2end = buffered2[buf2len - 1].end;
          // if small hole (value between 0 or maxHoleDuration ) or overlapping (negative)
          if (buffered[i].start - buf2end < maxHoleDuration) {
            // merge overlapping time ranges
            // update lastRange.end only if smaller than item.end
            // e.g.  [ 1, 15] with  [ 2,8] => [ 1,15] (no need to modify lastRange.end)
            // whereas [ 1, 8] with  [ 2,15] => [ 1,15] ( lastRange should switch from [1,8] to [1,15])
            if (buffered[i].end > buf2end) {
              buffered2[buf2len - 1].end = buffered[i].end;
            }
          } else {
            // big hole
            buffered2.push(buffered[i]);
          }
        } else {
          // first value
          buffered2.push(buffered[i]);
        }
      }
    } else {
      buffered2 = buffered;
    }
    let bufferLen = 0;

    // bufferStartNext can possibly be undefined based on the conditional logic below
    let bufferStartNext;

    // bufferStart and bufferEnd are buffer boundaries around current video position
    let bufferStart = pos;
    let bufferEnd = pos;
    for (let i = 0; i < buffered2.length; i++) {
      const start = buffered2[i].start;
      const end = buffered2[i].end;
      // logger.log('buf start/end:' + buffered.start(i) + '/' + buffered.end(i));
      if (pos + maxHoleDuration >= start && pos < end) {
        // play position is inside this buffer TimeRange, retrieve end of buffer position and buffer length
        bufferStart = start;
        bufferEnd = end;
        bufferLen = bufferEnd - pos;
      } else if (pos + maxHoleDuration < start) {
        bufferStartNext = start;
        break;
      }
    }
    return {
      len: bufferLen,
      start: bufferStart || 0,
      end: bufferEnd || 0,
      nextStart: bufferStartNext
    };
  }

  /**
   * Safe method to get buffered property.
   * SourceBuffer.buffered may throw if SourceBuffer is removed from it's MediaSource
   */
  static getBuffered(media) {
    try {
      return media.buffered;
    } catch (e) {
      logger.log('failed to get media.buffered', e);
      return noopBuffered;
    }
  }
}

class ChunkMetadata {
  constructor(level, sn, id, size = 0, part = -1, partial = false) {
    this.level = void 0;
    this.sn = void 0;
    this.part = void 0;
    this.id = void 0;
    this.size = void 0;
    this.partial = void 0;
    this.transmuxing = getNewPerformanceTiming();
    this.buffering = {
      audio: getNewPerformanceTiming(),
      video: getNewPerformanceTiming(),
      audiovideo: getNewPerformanceTiming()
    };
    this.level = level;
    this.sn = sn;
    this.id = id;
    this.size = size;
    this.part = part;
    this.partial = partial;
  }
}
function getNewPerformanceTiming() {
  return {
    start: 0,
    executeStart: 0,
    executeEnd: 0,
    end: 0
  };
}

function findFirstFragWithCC(fragments, cc) {
  let firstFrag = null;
  for (let i = 0, len = fragments.length; i < len; i++) {
    const currentFrag = fragments[i];
    if (currentFrag && currentFrag.cc === cc) {
      firstFrag = currentFrag;
      break;
    }
  }
  return firstFrag;
}
function shouldAlignOnDiscontinuities(lastFrag, lastLevel, details) {
  if (lastLevel.details) {
    if (details.endCC > details.startCC || lastFrag && lastFrag.cc < details.startCC) {
      return true;
    }
  }
  return false;
}

// Find the first frag in the previous level which matches the CC of the first frag of the new level
function findDiscontinuousReferenceFrag(prevDetails, curDetails, referenceIndex = 0) {
  const prevFrags = prevDetails.fragments;
  const curFrags = curDetails.fragments;
  if (!curFrags.length || !prevFrags.length) {
    logger.log('No fragments to align');
    return;
  }
  const prevStartFrag = findFirstFragWithCC(prevFrags, curFrags[0].cc);
  if (!prevStartFrag || prevStartFrag && !prevStartFrag.startPTS) {
    logger.log('No frag in previous level to align on');
    return;
  }
  return prevStartFrag;
}
function adjustFragmentStart(frag, sliding) {
  if (frag) {
    const start = frag.start + sliding;
    frag.start = frag.startPTS = start;
    frag.endPTS = start + frag.duration;
  }
}
function adjustSlidingStart(sliding, details) {
  // Update segments
  const fragments = details.fragments;
  for (let i = 0, len = fragments.length; i < len; i++) {
    adjustFragmentStart(fragments[i], sliding);
  }
  // Update LL-HLS parts at the end of the playlist
  if (details.fragmentHint) {
    adjustFragmentStart(details.fragmentHint, sliding);
  }
  details.alignedSliding = true;
}

/**
 * Using the parameters of the last level, this function computes PTS' of the new fragments so that they form a
 * contiguous stream with the last fragments.
 * The PTS of a fragment lets Hls.js know where it fits into a stream - by knowing every PTS, we know which fragment to
 * download at any given time. PTS is normally computed when the fragment is demuxed, so taking this step saves us time
 * and an extra download.
 * @param lastFrag
 * @param lastLevel
 * @param details
 */
function alignStream(lastFrag, lastLevel, details) {
  if (!lastLevel) {
    return;
  }
  alignDiscontinuities(lastFrag, details, lastLevel);
  if (!details.alignedSliding && lastLevel.details) {
    // If the PTS wasn't figured out via discontinuity sequence that means there was no CC increase within the level.
    // Aligning via Program Date Time should therefore be reliable, since PDT should be the same within the same
    // discontinuity sequence.
    alignPDT(details, lastLevel.details);
  }
  if (!details.alignedSliding && lastLevel.details && !details.skippedSegments) {
    // Try to align on sn so that we pick a better start fragment.
    // Do not perform this on playlists with delta updates as this is only to align levels on switch
    // and adjustSliding only adjusts fragments after skippedSegments.
    adjustSliding(lastLevel.details, details);
  }
}

/**
 * Computes the PTS if a new level's fragments using the PTS of a fragment in the last level which shares the same
 * discontinuity sequence.
 * @param lastFrag - The last Fragment which shares the same discontinuity sequence
 * @param lastLevel - The details of the last loaded level
 * @param details - The details of the new level
 */
function alignDiscontinuities(lastFrag, details, lastLevel) {
  if (shouldAlignOnDiscontinuities(lastFrag, lastLevel, details)) {
    const referenceFrag = findDiscontinuousReferenceFrag(lastLevel.details, details);
    if (referenceFrag && isFiniteNumber(referenceFrag.start)) {
      logger.log(`Adjusting PTS using last level due to CC increase within current level ${details.url}`);
      adjustSlidingStart(referenceFrag.start, details);
    }
  }
}

/**
 * Computes the PTS of a new level's fragments using the difference in Program Date Time from the last level.
 * @param details - The details of the new level
 * @param lastDetails - The details of the last loaded level
 */
function alignPDT(details, lastDetails) {
  // This check protects the unsafe "!" usage below for null program date time access.
  if (!lastDetails.fragments.length || !details.hasProgramDateTime || !lastDetails.hasProgramDateTime) {
    return;
  }
  // if last level sliding is 1000 and its first frag PROGRAM-DATE-TIME is 2017-08-20 1:10:00 AM
  // and if new details first frag PROGRAM DATE-TIME is 2017-08-20 1:10:08 AM
  // then we can deduce that playlist B sliding is 1000+8 = 1008s
  const lastPDT = lastDetails.fragments[0].programDateTime; // hasProgramDateTime check above makes this safe.
  const newPDT = details.fragments[0].programDateTime;
  // date diff is in ms. frag.start is in seconds
  const sliding = (newPDT - lastPDT) / 1000 + lastDetails.fragments[0].start;
  if (sliding && isFiniteNumber(sliding)) {
    logger.log(`Adjusting PTS using programDateTime delta ${newPDT - lastPDT}ms, sliding:${sliding.toFixed(3)} ${details.url} `);
    adjustSlidingStart(sliding, details);
  }
}

class AESCrypto {
  constructor(subtle, iv) {
    this.subtle = void 0;
    this.aesIV = void 0;
    this.subtle = subtle;
    this.aesIV = iv;
  }
  decrypt(data, key) {
    return this.subtle.decrypt({
      name: 'AES-CBC',
      iv: this.aesIV
    }, key, data);
  }
}

class FastAESKey {
  constructor(subtle, key) {
    this.subtle = void 0;
    this.key = void 0;
    this.subtle = subtle;
    this.key = key;
  }
  expandKey() {
    return this.subtle.importKey('raw', this.key, {
      name: 'AES-CBC'
    }, false, ['encrypt', 'decrypt']);
  }
}

// PKCS7
function removePadding(array) {
  const outputBytes = array.byteLength;
  const paddingBytes = outputBytes && new DataView(array.buffer).getUint8(outputBytes - 1);
  if (paddingBytes) {
    return sliceUint8(array, 0, outputBytes - paddingBytes);
  }
  return array;
}
class AESDecryptor {
  constructor() {
    this.rcon = [0x0, 0x1, 0x2, 0x4, 0x8, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];
    this.subMix = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
    this.invSubMix = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
    this.sBox = new Uint32Array(256);
    this.invSBox = new Uint32Array(256);
    this.key = new Uint32Array(0);
    this.ksRows = 0;
    this.keySize = 0;
    this.keySchedule = void 0;
    this.invKeySchedule = void 0;
    this.initTable();
  }

  // Using view.getUint32() also swaps the byte order.
  uint8ArrayToUint32Array_(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const newArray = new Uint32Array(4);
    for (let i = 0; i < 4; i++) {
      newArray[i] = view.getUint32(i * 4);
    }
    return newArray;
  }
  initTable() {
    const sBox = this.sBox;
    const invSBox = this.invSBox;
    const subMix = this.subMix;
    const subMix0 = subMix[0];
    const subMix1 = subMix[1];
    const subMix2 = subMix[2];
    const subMix3 = subMix[3];
    const invSubMix = this.invSubMix;
    const invSubMix0 = invSubMix[0];
    const invSubMix1 = invSubMix[1];
    const invSubMix2 = invSubMix[2];
    const invSubMix3 = invSubMix[3];
    const d = new Uint32Array(256);
    let x = 0;
    let xi = 0;
    let i = 0;
    for (i = 0; i < 256; i++) {
      if (i < 128) {
        d[i] = i << 1;
      } else {
        d[i] = i << 1 ^ 0x11b;
      }
    }
    for (i = 0; i < 256; i++) {
      let sx = xi ^ xi << 1 ^ xi << 2 ^ xi << 3 ^ xi << 4;
      sx = sx >>> 8 ^ sx & 0xff ^ 0x63;
      sBox[x] = sx;
      invSBox[sx] = x;

      // Compute multiplication
      const x2 = d[x];
      const x4 = d[x2];
      const x8 = d[x4];

      // Compute sub/invSub bytes, mix columns tables
      let t = d[sx] * 0x101 ^ sx * 0x1010100;
      subMix0[x] = t << 24 | t >>> 8;
      subMix1[x] = t << 16 | t >>> 16;
      subMix2[x] = t << 8 | t >>> 24;
      subMix3[x] = t;

      // Compute inv sub bytes, inv mix columns tables
      t = x8 * 0x1010101 ^ x4 * 0x10001 ^ x2 * 0x101 ^ x * 0x1010100;
      invSubMix0[sx] = t << 24 | t >>> 8;
      invSubMix1[sx] = t << 16 | t >>> 16;
      invSubMix2[sx] = t << 8 | t >>> 24;
      invSubMix3[sx] = t;

      // Compute next counter
      if (!x) {
        x = xi = 1;
      } else {
        x = x2 ^ d[d[d[x8 ^ x2]]];
        xi ^= d[d[xi]];
      }
    }
  }
  expandKey(keyBuffer) {
    // convert keyBuffer to Uint32Array
    const key = this.uint8ArrayToUint32Array_(keyBuffer);
    let sameKey = true;
    let offset = 0;
    while (offset < key.length && sameKey) {
      sameKey = key[offset] === this.key[offset];
      offset++;
    }
    if (sameKey) {
      return;
    }
    this.key = key;
    const keySize = this.keySize = key.length;
    if (keySize !== 4 && keySize !== 6 && keySize !== 8) {
      throw new Error('Invalid aes key size=' + keySize);
    }
    const ksRows = this.ksRows = (keySize + 6 + 1) * 4;
    let ksRow;
    let invKsRow;
    const keySchedule = this.keySchedule = new Uint32Array(ksRows);
    const invKeySchedule = this.invKeySchedule = new Uint32Array(ksRows);
    const sbox = this.sBox;
    const rcon = this.rcon;
    const invSubMix = this.invSubMix;
    const invSubMix0 = invSubMix[0];
    const invSubMix1 = invSubMix[1];
    const invSubMix2 = invSubMix[2];
    const invSubMix3 = invSubMix[3];
    let prev;
    let t;
    for (ksRow = 0; ksRow < ksRows; ksRow++) {
      if (ksRow < keySize) {
        prev = keySchedule[ksRow] = key[ksRow];
        continue;
      }
      t = prev;
      if (ksRow % keySize === 0) {
        // Rot word
        t = t << 8 | t >>> 24;

        // Sub word
        t = sbox[t >>> 24] << 24 | sbox[t >>> 16 & 0xff] << 16 | sbox[t >>> 8 & 0xff] << 8 | sbox[t & 0xff];

        // Mix Rcon
        t ^= rcon[ksRow / keySize | 0] << 24;
      } else if (keySize > 6 && ksRow % keySize === 4) {
        // Sub word
        t = sbox[t >>> 24] << 24 | sbox[t >>> 16 & 0xff] << 16 | sbox[t >>> 8 & 0xff] << 8 | sbox[t & 0xff];
      }
      keySchedule[ksRow] = prev = (keySchedule[ksRow - keySize] ^ t) >>> 0;
    }
    for (invKsRow = 0; invKsRow < ksRows; invKsRow++) {
      ksRow = ksRows - invKsRow;
      if (invKsRow & 3) {
        t = keySchedule[ksRow];
      } else {
        t = keySchedule[ksRow - 4];
      }
      if (invKsRow < 4 || ksRow <= 4) {
        invKeySchedule[invKsRow] = t;
      } else {
        invKeySchedule[invKsRow] = invSubMix0[sbox[t >>> 24]] ^ invSubMix1[sbox[t >>> 16 & 0xff]] ^ invSubMix2[sbox[t >>> 8 & 0xff]] ^ invSubMix3[sbox[t & 0xff]];
      }
      invKeySchedule[invKsRow] = invKeySchedule[invKsRow] >>> 0;
    }
  }

  // Adding this as a method greatly improves performance.
  networkToHostOrderSwap(word) {
    return word << 24 | (word & 0xff00) << 8 | (word & 0xff0000) >> 8 | word >>> 24;
  }
  decrypt(inputArrayBuffer, offset, aesIV) {
    const nRounds = this.keySize + 6;
    const invKeySchedule = this.invKeySchedule;
    const invSBOX = this.invSBox;
    const invSubMix = this.invSubMix;
    const invSubMix0 = invSubMix[0];
    const invSubMix1 = invSubMix[1];
    const invSubMix2 = invSubMix[2];
    const invSubMix3 = invSubMix[3];
    const initVector = this.uint8ArrayToUint32Array_(aesIV);
    let initVector0 = initVector[0];
    let initVector1 = initVector[1];
    let initVector2 = initVector[2];
    let initVector3 = initVector[3];
    const inputInt32 = new Int32Array(inputArrayBuffer);
    const outputInt32 = new Int32Array(inputInt32.length);
    let t0, t1, t2, t3;
    let s0, s1, s2, s3;
    let inputWords0, inputWords1, inputWords2, inputWords3;
    let ksRow, i;
    const swapWord = this.networkToHostOrderSwap;
    while (offset < inputInt32.length) {
      inputWords0 = swapWord(inputInt32[offset]);
      inputWords1 = swapWord(inputInt32[offset + 1]);
      inputWords2 = swapWord(inputInt32[offset + 2]);
      inputWords3 = swapWord(inputInt32[offset + 3]);
      s0 = inputWords0 ^ invKeySchedule[0];
      s1 = inputWords3 ^ invKeySchedule[1];
      s2 = inputWords2 ^ invKeySchedule[2];
      s3 = inputWords1 ^ invKeySchedule[3];
      ksRow = 4;

      // Iterate through the rounds of decryption
      for (i = 1; i < nRounds; i++) {
        t0 = invSubMix0[s0 >>> 24] ^ invSubMix1[s1 >> 16 & 0xff] ^ invSubMix2[s2 >> 8 & 0xff] ^ invSubMix3[s3 & 0xff] ^ invKeySchedule[ksRow];
        t1 = invSubMix0[s1 >>> 24] ^ invSubMix1[s2 >> 16 & 0xff] ^ invSubMix2[s3 >> 8 & 0xff] ^ invSubMix3[s0 & 0xff] ^ invKeySchedule[ksRow + 1];
        t2 = invSubMix0[s2 >>> 24] ^ invSubMix1[s3 >> 16 & 0xff] ^ invSubMix2[s0 >> 8 & 0xff] ^ invSubMix3[s1 & 0xff] ^ invKeySchedule[ksRow + 2];
        t3 = invSubMix0[s3 >>> 24] ^ invSubMix1[s0 >> 16 & 0xff] ^ invSubMix2[s1 >> 8 & 0xff] ^ invSubMix3[s2 & 0xff] ^ invKeySchedule[ksRow + 3];
        // Update state
        s0 = t0;
        s1 = t1;
        s2 = t2;
        s3 = t3;
        ksRow = ksRow + 4;
      }

      // Shift rows, sub bytes, add round key
      t0 = invSBOX[s0 >>> 24] << 24 ^ invSBOX[s1 >> 16 & 0xff] << 16 ^ invSBOX[s2 >> 8 & 0xff] << 8 ^ invSBOX[s3 & 0xff] ^ invKeySchedule[ksRow];
      t1 = invSBOX[s1 >>> 24] << 24 ^ invSBOX[s2 >> 16 & 0xff] << 16 ^ invSBOX[s3 >> 8 & 0xff] << 8 ^ invSBOX[s0 & 0xff] ^ invKeySchedule[ksRow + 1];
      t2 = invSBOX[s2 >>> 24] << 24 ^ invSBOX[s3 >> 16 & 0xff] << 16 ^ invSBOX[s0 >> 8 & 0xff] << 8 ^ invSBOX[s1 & 0xff] ^ invKeySchedule[ksRow + 2];
      t3 = invSBOX[s3 >>> 24] << 24 ^ invSBOX[s0 >> 16 & 0xff] << 16 ^ invSBOX[s1 >> 8 & 0xff] << 8 ^ invSBOX[s2 & 0xff] ^ invKeySchedule[ksRow + 3];

      // Write
      outputInt32[offset] = swapWord(t0 ^ initVector0);
      outputInt32[offset + 1] = swapWord(t3 ^ initVector1);
      outputInt32[offset + 2] = swapWord(t2 ^ initVector2);
      outputInt32[offset + 3] = swapWord(t1 ^ initVector3);

      // reset initVector to last 4 unsigned int
      initVector0 = inputWords0;
      initVector1 = inputWords1;
      initVector2 = inputWords2;
      initVector3 = inputWords3;
      offset = offset + 4;
    }
    return outputInt32.buffer;
  }
}

const CHUNK_SIZE = 16; // 16 bytes, 128 bits

class Decrypter {
  constructor(config, {
    removePKCS7Padding = true
  } = {}) {
    this.logEnabled = true;
    this.removePKCS7Padding = void 0;
    this.subtle = null;
    this.softwareDecrypter = null;
    this.key = null;
    this.fastAesKey = null;
    this.remainderData = null;
    this.currentIV = null;
    this.currentResult = null;
    this.useSoftware = void 0;
    this.useSoftware = config.enableSoftwareAES;
    this.removePKCS7Padding = removePKCS7Padding;
    // built in decryptor expects PKCS7 padding
    if (removePKCS7Padding) {
      try {
        const browserCrypto = self.crypto;
        if (browserCrypto) {
          this.subtle = browserCrypto.subtle || browserCrypto.webkitSubtle;
        }
      } catch (e) {
        /* no-op */
      }
    }
    if (this.subtle === null) {
      this.useSoftware = true;
    }
  }
  destroy() {
    this.subtle = null;
    this.softwareDecrypter = null;
    this.key = null;
    this.fastAesKey = null;
    this.remainderData = null;
    this.currentIV = null;
    this.currentResult = null;
  }
  isSync() {
    return this.useSoftware;
  }
  flush() {
    const {
      currentResult,
      remainderData
    } = this;
    if (!currentResult || remainderData) {
      this.reset();
      return null;
    }
    const data = new Uint8Array(currentResult);
    this.reset();
    if (this.removePKCS7Padding) {
      return removePadding(data);
    }
    return data;
  }
  reset() {
    this.currentResult = null;
    this.currentIV = null;
    this.remainderData = null;
    if (this.softwareDecrypter) {
      this.softwareDecrypter = null;
    }
  }
  decrypt(data, key, iv) {
    if (this.useSoftware) {
      return new Promise((resolve, reject) => {
        this.softwareDecrypt(new Uint8Array(data), key, iv);
        const decryptResult = this.flush();
        if (decryptResult) {
          resolve(decryptResult.buffer);
        } else {
          reject(new Error('[softwareDecrypt] Failed to decrypt data'));
        }
      });
    }
    return this.webCryptoDecrypt(new Uint8Array(data), key, iv);
  }

  // Software decryption is progressive. Progressive decryption may not return a result on each call. Any cached
  // data is handled in the flush() call
  softwareDecrypt(data, key, iv) {
    const {
      currentIV,
      currentResult,
      remainderData
    } = this;
    this.logOnce('JS AES decrypt');
    // The output is staggered during progressive parsing - the current result is cached, and emitted on the next call
    // This is done in order to strip PKCS7 padding, which is found at the end of each segment. We only know we've reached
    // the end on flush(), but by that time we have already received all bytes for the segment.
    // Progressive decryption does not work with WebCrypto

    if (remainderData) {
      data = appendUint8Array(remainderData, data);
      this.remainderData = null;
    }

    // Byte length must be a multiple of 16 (AES-128 = 128 bit blocks = 16 bytes)
    const currentChunk = this.getValidChunk(data);
    if (!currentChunk.length) {
      return null;
    }
    if (currentIV) {
      iv = currentIV;
    }
    let softwareDecrypter = this.softwareDecrypter;
    if (!softwareDecrypter) {
      softwareDecrypter = this.softwareDecrypter = new AESDecryptor();
    }
    softwareDecrypter.expandKey(key);
    const result = currentResult;
    this.currentResult = softwareDecrypter.decrypt(currentChunk.buffer, 0, iv);
    this.currentIV = sliceUint8(currentChunk, -16).buffer;
    if (!result) {
      return null;
    }
    return result;
  }
  webCryptoDecrypt(data, key, iv) {
    const subtle = this.subtle;
    if (this.key !== key || !this.fastAesKey) {
      this.key = key;
      this.fastAesKey = new FastAESKey(subtle, key);
    }
    return this.fastAesKey.expandKey().then(aesKey => {
      // decrypt using web crypto
      if (!subtle) {
        return Promise.reject(new Error('web crypto not initialized'));
      }
      this.logOnce('WebCrypto AES decrypt');
      const crypto = new AESCrypto(subtle, new Uint8Array(iv));
      return crypto.decrypt(data.buffer, aesKey);
    }).catch(err => {
      logger.warn(`[decrypter]: WebCrypto Error, disable WebCrypto API, ${err.name}: ${err.message}`);
      return this.onWebCryptoError(data, key, iv);
    });
  }
  onWebCryptoError(data, key, iv) {
    this.useSoftware = true;
    this.logEnabled = true;
    this.softwareDecrypt(data, key, iv);
    const decryptResult = this.flush();
    if (decryptResult) {
      return decryptResult.buffer;
    }
    throw new Error('WebCrypto and softwareDecrypt: failed to decrypt data');
  }
  getValidChunk(data) {
    let currentChunk = data;
    const splitPoint = data.length - data.length % CHUNK_SIZE;
    if (splitPoint !== data.length) {
      currentChunk = sliceUint8(data, 0, splitPoint);
      this.remainderData = sliceUint8(data, splitPoint);
    }
    return currentChunk;
  }
  logOnce(msg) {
    if (!this.logEnabled) {
      return;
    }
    logger.log(`[decrypter]: ${msg}`);
    this.logEnabled = false;
  }
}

/**
 *  TimeRanges to string helper
 */

const TimeRanges = {
  toString: function (r) {
    let log = '';
    const len = r.length;
    for (let i = 0; i < len; i++) {
      log += `[${r.start(i).toFixed(3)}-${r.end(i).toFixed(3)}]`;
    }
    return log;
  }
};

const State = {
  STOPPED: 'STOPPED',
  IDLE: 'IDLE',
  KEY_LOADING: 'KEY_LOADING',
  FRAG_LOADING: 'FRAG_LOADING',
  FRAG_LOADING_WAITING_RETRY: 'FRAG_LOADING_WAITING_RETRY',
  WAITING_TRACK: 'WAITING_TRACK',
  PARSING: 'PARSING',
  PARSED: 'PARSED',
  ENDED: 'ENDED',
  ERROR: 'ERROR',
  WAITING_INIT_PTS: 'WAITING_INIT_PTS',
  WAITING_LEVEL: 'WAITING_LEVEL'
};
class BaseStreamController extends TaskLoop {
  constructor(hls, fragmentTracker, keyLoader, logPrefix, playlistType) {
    super();
    this.hls = void 0;
    this.fragPrevious = null;
    this.fragCurrent = null;
    this.fragmentTracker = void 0;
    this.transmuxer = null;
    this._state = State.STOPPED;
    this.playlistType = void 0;
    this.media = null;
    this.mediaBuffer = null;
    this.config = void 0;
    this.bitrateTest = false;
    this.lastCurrentTime = 0;
    this.nextLoadPosition = 0;
    this.startPosition = 0;
    this.startTimeOffset = null;
    this.loadedmetadata = false;
    this.retryDate = 0;
    this.levels = null;
    this.fragmentLoader = void 0;
    this.keyLoader = void 0;
    this.levelLastLoaded = null;
    this.startFragRequested = false;
    this.decrypter = void 0;
    this.initPTS = [];
    this.onvseeking = null;
    this.onvended = null;
    this.logPrefix = '';
    this.log = void 0;
    this.warn = void 0;
    this.playlistType = playlistType;
    this.logPrefix = logPrefix;
    this.log = logger.log.bind(logger, `${logPrefix}:`);
    this.warn = logger.warn.bind(logger, `${logPrefix}:`);
    this.hls = hls;
    this.fragmentLoader = new FragmentLoader(hls.config);
    this.keyLoader = keyLoader;
    this.fragmentTracker = fragmentTracker;
    this.config = hls.config;
    this.decrypter = new Decrypter(hls.config);
    hls.on(Events.MANIFEST_LOADED, this.onManifestLoaded, this);
  }
  doTick() {
    this.onTickEnd();
  }
  onTickEnd() {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  startLoad(startPosition) {}
  stopLoad() {
    this.fragmentLoader.abort();
    this.keyLoader.abort(this.playlistType);
    const frag = this.fragCurrent;
    if (frag != null && frag.loader) {
      frag.abortRequests();
      this.fragmentTracker.removeFragment(frag);
    }
    this.resetTransmuxer();
    this.fragCurrent = null;
    this.fragPrevious = null;
    this.clearInterval();
    this.clearNextTick();
    this.state = State.STOPPED;
  }
  _streamEnded(bufferInfo, levelDetails) {
    // If playlist is live, there is another buffered range after the current range, nothing buffered, media is detached,
    // of nothing loading/loaded return false
    if (levelDetails.live || bufferInfo.nextStart || !bufferInfo.end || !this.media) {
      return false;
    }
    const partList = levelDetails.partList;
    // Since the last part isn't guaranteed to correspond to the last playlist segment for Low-Latency HLS,
    // check instead if the last part is buffered.
    if (partList != null && partList.length) {
      const lastPart = partList[partList.length - 1];

      // Checking the midpoint of the part for potential margin of error and related issues.
      // NOTE: Technically I believe parts could yield content that is < the computed duration (including potential a duration of 0)
      // and still be spec-compliant, so there may still be edge cases here. Likewise, there could be issues in end of stream
      // part mismatches for independent audio and video playlists/segments.
      const lastPartBuffered = BufferHelper.isBuffered(this.media, lastPart.start + lastPart.duration / 2);
      return lastPartBuffered;
    }
    const playlistType = levelDetails.fragments[levelDetails.fragments.length - 1].type;
    return this.fragmentTracker.isEndListAppended(playlistType);
  }
  getLevelDetails() {
    if (this.levels && this.levelLastLoaded !== null) {
      var _this$levels$this$lev;
      return (_this$levels$this$lev = this.levels[this.levelLastLoaded]) == null ? void 0 : _this$levels$this$lev.details;
    }
  }
  onMediaAttached(event, data) {
    const media = this.media = this.mediaBuffer = data.media;
    this.onvseeking = this.onMediaSeeking.bind(this);
    this.onvended = this.onMediaEnded.bind(this);
    media.addEventListener('seeking', this.onvseeking);
    media.addEventListener('ended', this.onvended);
    const config = this.config;
    if (this.levels && config.autoStartLoad && this.state === State.STOPPED) {
      this.startLoad(config.startPosition);
    }
  }
  onMediaDetaching() {
    const media = this.media;
    if (media != null && media.ended) {
      this.log('MSE detaching and video ended, reset startPosition');
      this.startPosition = this.lastCurrentTime = 0;
    }

    // remove video listeners
    if (media && this.onvseeking && this.onvended) {
      media.removeEventListener('seeking', this.onvseeking);
      media.removeEventListener('ended', this.onvended);
      this.onvseeking = this.onvended = null;
    }
    if (this.keyLoader) {
      this.keyLoader.detach();
    }
    this.media = this.mediaBuffer = null;
    this.loadedmetadata = false;
    this.fragmentTracker.removeAllFragments();
    this.stopLoad();
  }
  onMediaSeeking() {
    const {
      config,
      fragCurrent,
      media,
      mediaBuffer,
      state
    } = this;
    const currentTime = media ? media.currentTime : 0;
    const bufferInfo = BufferHelper.bufferInfo(mediaBuffer ? mediaBuffer : media, currentTime, config.maxBufferHole);
    this.log(`media seeking to ${isFiniteNumber(currentTime) ? currentTime.toFixed(3) : currentTime}, state: ${state}`);
    if (this.state === State.ENDED) {
      this.resetLoadingState();
    } else if (fragCurrent) {
      // Seeking while frag load is in progress
      const tolerance = config.maxFragLookUpTolerance;
      const fragStartOffset = fragCurrent.start - tolerance;
      const fragEndOffset = fragCurrent.start + fragCurrent.duration + tolerance;
      // if seeking out of buffered range or into new one
      if (!bufferInfo.len || fragEndOffset < bufferInfo.start || fragStartOffset > bufferInfo.end) {
        const pastFragment = currentTime > fragEndOffset;
        // if the seek position is outside the current fragment range
        if (currentTime < fragStartOffset || pastFragment) {
          if (pastFragment && fragCurrent.loader) {
            this.log('seeking outside of buffer while fragment load in progress, cancel fragment load');
            fragCurrent.abortRequests();
            this.resetLoadingState();
          }
          this.fragPrevious = null;
        }
      }
    }
    if (media) {
      // Remove gap fragments
      this.fragmentTracker.removeFragmentsInRange(currentTime, Infinity, this.playlistType, true);
      this.lastCurrentTime = currentTime;
    }

    // in case seeking occurs although no media buffered, adjust startPosition and nextLoadPosition to seek target
    if (!this.loadedmetadata && !bufferInfo.len) {
      this.nextLoadPosition = this.startPosition = currentTime;
    }

    // Async tick to speed up processing
    this.tickImmediate();
  }
  onMediaEnded() {
    // reset startPosition and lastCurrentTime to restart playback @ stream beginning
    this.startPosition = this.lastCurrentTime = 0;
  }
  onManifestLoaded(event, data) {
    this.startTimeOffset = data.startTimeOffset;
    this.initPTS = [];
  }
  onHandlerDestroying() {
    this.stopLoad();
    super.onHandlerDestroying();
  }
  onHandlerDestroyed() {
    this.state = State.STOPPED;
    if (this.fragmentLoader) {
      this.fragmentLoader.destroy();
    }
    if (this.keyLoader) {
      this.keyLoader.destroy();
    }
    if (this.decrypter) {
      this.decrypter.destroy();
    }
    this.hls = this.log = this.warn = this.decrypter = this.keyLoader = this.fragmentLoader = this.fragmentTracker = null;
    super.onHandlerDestroyed();
  }
  loadFragment(frag, level, targetBufferTime) {
    this._loadFragForPlayback(frag, level, targetBufferTime);
  }
  _loadFragForPlayback(frag, level, targetBufferTime) {
    const progressCallback = data => {
      if (this.fragContextChanged(frag)) {
        this.warn(`Fragment ${frag.sn}${data.part ? ' p: ' + data.part.index : ''} of level ${frag.level} was dropped during download.`);
        this.fragmentTracker.removeFragment(frag);
        return;
      }
      frag.stats.chunkCount++;
      this._handleFragmentLoadProgress(data);
    };
    this._doFragLoad(frag, level, targetBufferTime, progressCallback).then(data => {
      if (!data) {
        // if we're here we probably needed to backtrack or are waiting for more parts
        return;
      }
      const state = this.state;
      if (this.fragContextChanged(frag)) {
        if (state === State.FRAG_LOADING || !this.fragCurrent && state === State.PARSING) {
          this.fragmentTracker.removeFragment(frag);
          this.state = State.IDLE;
        }
        return;
      }
      if ('payload' in data) {
        this.log(`Loaded fragment ${frag.sn} of level ${frag.level}`);
        this.hls.trigger(Events.FRAG_LOADED, data);
      }

      // Pass through the whole payload; controllers not implementing progressive loading receive data from this callback
      this._handleFragmentLoadComplete(data);
    }).catch(reason => {
      if (this.state === State.STOPPED || this.state === State.ERROR) {
        return;
      }
      this.warn(reason);
      this.resetFragmentLoading(frag);
    });
  }
  clearTrackerIfNeeded(frag) {
    var _this$mediaBuffer;
    const {
      fragmentTracker
    } = this;
    const fragState = fragmentTracker.getState(frag);
    if (fragState === FragmentState.APPENDING) {
      // Lower the buffer size and try again
      const playlistType = frag.type;
      const bufferedInfo = this.getFwdBufferInfo(this.mediaBuffer, playlistType);
      const minForwardBufferLength = Math.max(frag.duration, bufferedInfo ? bufferedInfo.len : this.config.maxBufferLength);
      if (this.reduceMaxBufferLength(minForwardBufferLength)) {
        fragmentTracker.removeFragment(frag);
      }
    } else if (((_this$mediaBuffer = this.mediaBuffer) == null ? void 0 : _this$mediaBuffer.buffered.length) === 0) {
      // Stop gap for bad tracker / buffer flush behavior
      fragmentTracker.removeAllFragments();
    } else if (fragmentTracker.hasParts(frag.type)) {
      // In low latency mode, remove fragments for which only some parts were buffered
      fragmentTracker.detectPartialFragments({
        frag,
        part: null,
        stats: frag.stats,
        id: frag.type
      });
      if (fragmentTracker.getState(frag) === FragmentState.PARTIAL) {
        fragmentTracker.removeFragment(frag);
      }
    }
  }
  checkLiveUpdate(details) {
    if (details.updated && !details.live) {
      // Live stream ended, update fragment tracker
      const lastFragment = details.fragments[details.fragments.length - 1];
      this.fragmentTracker.detectPartialFragments({
        frag: lastFragment,
        part: null,
        stats: lastFragment.stats,
        id: lastFragment.type
      });
    }
    if (!details.fragments[0]) {
      details.deltaUpdateFailed = true;
    }
  }
  flushMainBuffer(startOffset, endOffset, type = null) {
    if (!(startOffset - endOffset)) {
      return;
    }
    // When alternate audio is playing, the audio-stream-controller is responsible for the audio buffer. Otherwise,
    // passing a null type flushes both buffers
    const flushScope = {
      startOffset,
      endOffset,
      type
    };
    this.hls.trigger(Events.BUFFER_FLUSHING, flushScope);
  }
  _loadInitSegment(frag, level) {
    this._doFragLoad(frag, level).then(data => {
      if (!data || this.fragContextChanged(frag) || !this.levels) {
        throw new Error('init load aborted');
      }
      return data;
    }).then(data => {
      const {
        hls
      } = this;
      const {
        payload
      } = data;
      const decryptData = frag.decryptdata;

      // check to see if the payload needs to be decrypted
      if (payload && payload.byteLength > 0 && decryptData && decryptData.key && decryptData.iv && decryptData.method === 'AES-128') {
        const startTime = self.performance.now();
        // decrypt init segment data
        return this.decrypter.decrypt(new Uint8Array(payload), decryptData.key.buffer, decryptData.iv.buffer).catch(err => {
          hls.trigger(Events.ERROR, {
            type: ErrorTypes.MEDIA_ERROR,
            details: ErrorDetails.FRAG_DECRYPT_ERROR,
            fatal: false,
            error: err,
            reason: err.message,
            frag
          });
          throw err;
        }).then(decryptedData => {
          const endTime = self.performance.now();
          hls.trigger(Events.FRAG_DECRYPTED, {
            frag,
            payload: decryptedData,
            stats: {
              tstart: startTime,
              tdecrypt: endTime
            }
          });
          data.payload = decryptedData;
          return data;
        });
      }
      return data;
    }).then(data => {
      const {
        fragCurrent,
        hls,
        levels
      } = this;
      if (!levels) {
        throw new Error('init load aborted, missing levels');
      }
      const stats = frag.stats;
      this.state = State.IDLE;
      level.fragmentError = 0;
      frag.data = new Uint8Array(data.payload);
      stats.parsing.start = stats.buffering.start = self.performance.now();
      stats.parsing.end = stats.buffering.end = self.performance.now();

      // Silence FRAG_BUFFERED event if fragCurrent is null
      if (data.frag === fragCurrent) {
        hls.trigger(Events.FRAG_BUFFERED, {
          stats,
          frag: fragCurrent,
          part: null,
          id: frag.type
        });
      }
      this.tick();
    }).catch(reason => {
      if (this.state === State.STOPPED || this.state === State.ERROR) {
        return;
      }
      this.warn(reason);
      this.resetFragmentLoading(frag);
    });
  }
  fragContextChanged(frag) {
    const {
      fragCurrent
    } = this;
    return !frag || !fragCurrent || frag.level !== fragCurrent.level || frag.sn !== fragCurrent.sn || frag.urlId !== fragCurrent.urlId;
  }
  fragBufferedComplete(frag, part) {
    var _frag$startPTS, _frag$endPTS, _this$fragCurrent, _this$fragPrevious;
    const media = this.mediaBuffer ? this.mediaBuffer : this.media;
    this.log(`Buffered ${frag.type} sn: ${frag.sn}${part ? ' part: ' + part.index : ''} of ${this.playlistType === PlaylistLevelType.MAIN ? 'level' : 'track'} ${frag.level} (frag:[${((_frag$startPTS = frag.startPTS) != null ? _frag$startPTS : NaN).toFixed(3)}-${((_frag$endPTS = frag.endPTS) != null ? _frag$endPTS : NaN).toFixed(3)}] > buffer:${media ? TimeRanges.toString(BufferHelper.getBuffered(media)) : '(detached)'})`);
    this.state = State.IDLE;
    if (!media) {
      return;
    }
    if (!this.loadedmetadata && frag.type == PlaylistLevelType.MAIN && media.buffered.length && ((_this$fragCurrent = this.fragCurrent) == null ? void 0 : _this$fragCurrent.sn) === ((_this$fragPrevious = this.fragPrevious) == null ? void 0 : _this$fragPrevious.sn)) {
      this.loadedmetadata = true;
      this.seekToStartPos();
    }
    this.tick();
  }
  seekToStartPos() {}
  _handleFragmentLoadComplete(fragLoadedEndData) {
    const {
      transmuxer
    } = this;
    if (!transmuxer) {
      return;
    }
    const {
      frag,
      part,
      partsLoaded
    } = fragLoadedEndData;
    // If we did not load parts, or loaded all parts, we have complete (not partial) fragment data
    const complete = !partsLoaded || partsLoaded.length === 0 || partsLoaded.some(fragLoaded => !fragLoaded);
    const chunkMeta = new ChunkMetadata(frag.level, frag.sn, frag.stats.chunkCount + 1, 0, part ? part.index : -1, !complete);
    transmuxer.flush(chunkMeta);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _handleFragmentLoadProgress(frag) {}
  _doFragLoad(frag, level, targetBufferTime = null, progressCallback) {
    var _frag$decryptdata;
    const details = level == null ? void 0 : level.details;
    if (!this.levels || !details) {
      throw new Error(`frag load aborted, missing level${details ? '' : ' detail'}s`);
    }
    let keyLoadingPromise = null;
    if (frag.encrypted && !((_frag$decryptdata = frag.decryptdata) != null && _frag$decryptdata.key)) {
      this.log(`Loading key for ${frag.sn} of [${details.startSN}-${details.endSN}], ${this.logPrefix === '[stream-controller]' ? 'level' : 'track'} ${frag.level}`);
      this.state = State.KEY_LOADING;
      this.fragCurrent = frag;
      keyLoadingPromise = this.keyLoader.load(frag).then(keyLoadedData => {
        if (!this.fragContextChanged(keyLoadedData.frag)) {
          this.hls.trigger(Events.KEY_LOADED, keyLoadedData);
          if (this.state === State.KEY_LOADING) {
            this.state = State.IDLE;
          }
          return keyLoadedData;
        }
      });
      this.hls.trigger(Events.KEY_LOADING, {
        frag
      });
      if (this.fragCurrent === null) {
        keyLoadingPromise = Promise.reject(new Error(`frag load aborted, context changed in KEY_LOADING`));
      }
    } else if (!frag.encrypted && details.encryptedFragments.length) {
      this.keyLoader.loadClear(frag, details.encryptedFragments);
    }
    targetBufferTime = Math.max(frag.start, targetBufferTime || 0);
    if (this.config.lowLatencyMode && frag.sn !== 'initSegment') {
      const partList = details.partList;
      if (partList && progressCallback) {
        if (targetBufferTime > frag.end && details.fragmentHint) {
          frag = details.fragmentHint;
        }
        const partIndex = this.getNextPart(partList, frag, targetBufferTime);
        if (partIndex > -1) {
          const part = partList[partIndex];
          this.log(`Loading part sn: ${frag.sn} p: ${part.index} cc: ${frag.cc} of playlist [${details.startSN}-${details.endSN}] parts [0-${partIndex}-${partList.length - 1}] ${this.logPrefix === '[stream-controller]' ? 'level' : 'track'}: ${frag.level}, target: ${parseFloat(targetBufferTime.toFixed(3))}`);
          this.nextLoadPosition = part.start + part.duration;
          this.state = State.FRAG_LOADING;
          let _result;
          if (keyLoadingPromise) {
            _result = keyLoadingPromise.then(keyLoadedData => {
              if (!keyLoadedData || this.fragContextChanged(keyLoadedData.frag)) {
                return null;
              }
              return this.doFragPartsLoad(frag, part, level, progressCallback);
            }).catch(error => this.handleFragLoadError(error));
          } else {
            _result = this.doFragPartsLoad(frag, part, level, progressCallback).catch(error => this.handleFragLoadError(error));
          }
          this.hls.trigger(Events.FRAG_LOADING, {
            frag,
            part,
            targetBufferTime
          });
          if (this.fragCurrent === null) {
            return Promise.reject(new Error(`frag load aborted, context changed in FRAG_LOADING parts`));
          }
          return _result;
        } else if (!frag.url || this.loadedEndOfParts(partList, targetBufferTime)) {
          // Fragment hint has no parts
          return Promise.resolve(null);
        }
      }
    }
    this.log(`Loading fragment ${frag.sn} cc: ${frag.cc} ${details ? 'of [' + details.startSN + '-' + details.endSN + '] ' : ''}${this.logPrefix === '[stream-controller]' ? 'level' : 'track'}: ${frag.level}, target: ${parseFloat(targetBufferTime.toFixed(3))}`);
    // Don't update nextLoadPosition for fragments which are not buffered
    if (isFiniteNumber(frag.sn) && !this.bitrateTest) {
      this.nextLoadPosition = frag.start + frag.duration;
    }
    this.state = State.FRAG_LOADING;

    // Load key before streaming fragment data
    const dataOnProgress = this.config.progressive;
    let result;
    if (dataOnProgress && keyLoadingPromise) {
      result = keyLoadingPromise.then(keyLoadedData => {
        if (!keyLoadedData || this.fragContextChanged(keyLoadedData == null ? void 0 : keyLoadedData.frag)) {
          return null;
        }
        return this.fragmentLoader.load(frag, progressCallback);
      }).catch(error => this.handleFragLoadError(error));
    } else {
      // load unencrypted fragment data with progress event,
      // or handle fragment result after key and fragment are finished loading
      result = Promise.all([this.fragmentLoader.load(frag, dataOnProgress ? progressCallback : undefined), keyLoadingPromise]).then(([fragLoadedData]) => {
        if (!dataOnProgress && fragLoadedData && progressCallback) {
          progressCallback(fragLoadedData);
        }
        return fragLoadedData;
      }).catch(error => this.handleFragLoadError(error));
    }
    this.hls.trigger(Events.FRAG_LOADING, {
      frag,
      targetBufferTime
    });
    if (this.fragCurrent === null) {
      return Promise.reject(new Error(`frag load aborted, context changed in FRAG_LOADING`));
    }
    return result;
  }
  doFragPartsLoad(frag, fromPart, level, progressCallback) {
    return new Promise((resolve, reject) => {
      var _level$details;
      const partsLoaded = [];
      const initialPartList = (_level$details = level.details) == null ? void 0 : _level$details.partList;
      const loadPart = part => {
        this.fragmentLoader.loadPart(frag, part, progressCallback).then(partLoadedData => {
          partsLoaded[part.index] = partLoadedData;
          const loadedPart = partLoadedData.part;
          this.hls.trigger(Events.FRAG_LOADED, partLoadedData);
          const nextPart = getPartWith(level, frag.sn, part.index + 1) || findPart(initialPartList, frag.sn, part.index + 1);
          if (nextPart) {
            loadPart(nextPart);
          } else {
            return resolve({
              frag,
              part: loadedPart,
              partsLoaded
            });
          }
        }).catch(reject);
      };
      loadPart(fromPart);
    });
  }
  handleFragLoadError(error) {
    if ('data' in error) {
      const data = error.data;
      if (error.data && data.details === ErrorDetails.INTERNAL_ABORTED) {
        this.handleFragLoadAborted(data.frag, data.part);
      } else {
        this.hls.trigger(Events.ERROR, data);
      }
    } else {
      this.hls.trigger(Events.ERROR, {
        type: ErrorTypes.OTHER_ERROR,
        details: ErrorDetails.INTERNAL_EXCEPTION,
        err: error,
        error,
        fatal: true
      });
    }
    return null;
  }
  _handleTransmuxerFlush(chunkMeta) {
    const context = this.getCurrentContext(chunkMeta);
    if (!context || this.state !== State.PARSING) {
      if (!this.fragCurrent && this.state !== State.STOPPED && this.state !== State.ERROR) {
        this.state = State.IDLE;
      }
      return;
    }
    const {
      frag,
      part,
      level
    } = context;
    const now = self.performance.now();
    frag.stats.parsing.end = now;
    if (part) {
      part.stats.parsing.end = now;
    }
    this.updateLevelTiming(frag, part, level, chunkMeta.partial);
  }
  getCurrentContext(chunkMeta) {
    const {
      levels,
      fragCurrent
    } = this;
    const {
      level: levelIndex,
      sn,
      part: partIndex
    } = chunkMeta;
    if (!(levels != null && levels[levelIndex])) {
      this.warn(`Levels object was unset while buffering fragment ${sn} of level ${levelIndex}. The current chunk will not be buffered.`);
      return null;
    }
    const level = levels[levelIndex];
    const part = partIndex > -1 ? getPartWith(level, sn, partIndex) : null;
    const frag = part ? part.fragment : getFragmentWithSN(level, sn, fragCurrent);
    if (!frag) {
      return null;
    }
    if (fragCurrent && fragCurrent !== frag) {
      frag.stats = fragCurrent.stats;
    }
    return {
      frag,
      part,
      level
    };
  }
  bufferFragmentData(data, frag, part, chunkMeta, noBacktracking) {
    var _buffer;
    if (!data || this.state !== State.PARSING) {
      return;
    }
    const {
      data1,
      data2
    } = data;
    let buffer = data1;
    if (data1 && data2) {
      // Combine the moof + mdat so that we buffer with a single append
      buffer = appendUint8Array(data1, data2);
    }
    if (!((_buffer = buffer) != null && _buffer.length)) {
      return;
    }
    const segment = {
      type: data.type,
      frag,
      part,
      chunkMeta,
      parent: frag.type,
      data: buffer
    };
    this.hls.trigger(Events.BUFFER_APPENDING, segment);
    if (data.dropped && data.independent && !part) {
      if (noBacktracking) {
        return;
      }
      // Clear buffer so that we reload previous segments sequentially if required
      this.flushBufferGap(frag);
    }
  }
  flushBufferGap(frag) {
    const media = this.media;
    if (!media) {
      return;
    }
    // If currentTime is not buffered, clear the back buffer so that we can backtrack as much as needed
    if (!BufferHelper.isBuffered(media, media.currentTime)) {
      this.flushMainBuffer(0, frag.start);
      return;
    }
    // Remove back-buffer without interrupting playback to allow back tracking
    const currentTime = media.currentTime;
    const bufferInfo = BufferHelper.bufferInfo(media, currentTime, 0);
    const fragDuration = frag.duration;
    const segmentFraction = Math.min(this.config.maxFragLookUpTolerance * 2, fragDuration * 0.25);
    const start = Math.max(Math.min(frag.start - segmentFraction, bufferInfo.end - segmentFraction), currentTime + segmentFraction);
    if (frag.start - start > segmentFraction) {
      this.flushMainBuffer(start, frag.start);
    }
  }
  getFwdBufferInfo(bufferable, type) {
    const pos = this.getLoadPosition();
    if (!isFiniteNumber(pos)) {
      return null;
    }
    return this.getFwdBufferInfoAtPos(bufferable, pos, type);
  }
  getFwdBufferInfoAtPos(bufferable, pos, type) {
    const {
      config: {
        maxBufferHole
      }
    } = this;
    const bufferInfo = BufferHelper.bufferInfo(bufferable, pos, maxBufferHole);
    // Workaround flaw in getting forward buffer when maxBufferHole is smaller than gap at current pos
    if (bufferInfo.len === 0 && bufferInfo.nextStart !== undefined) {
      const bufferedFragAtPos = this.fragmentTracker.getBufferedFrag(pos, type);
      if (bufferedFragAtPos && bufferInfo.nextStart < bufferedFragAtPos.end) {
        return BufferHelper.bufferInfo(bufferable, pos, Math.max(bufferInfo.nextStart, maxBufferHole));
      }
    }
    return bufferInfo;
  }
  getMaxBufferLength(levelBitrate) {
    const {
      config
    } = this;
    let maxBufLen;
    if (levelBitrate) {
      maxBufLen = Math.max(8 * config.maxBufferSize / levelBitrate, config.maxBufferLength);
    } else {
      maxBufLen = config.maxBufferLength;
    }
    return Math.min(maxBufLen, config.maxMaxBufferLength);
  }
  reduceMaxBufferLength(threshold) {
    const config = this.config;
    const minLength = threshold || config.maxBufferLength;
    if (config.maxMaxBufferLength >= minLength) {
      // reduce max buffer length as it might be too high. we do this to avoid loop flushing ...
      config.maxMaxBufferLength /= 2;
      this.warn(`Reduce max buffer length to ${config.maxMaxBufferLength}s`);
      return true;
    }
    return false;
  }
  getAppendedFrag(position, playlistType = PlaylistLevelType.MAIN) {
    const fragOrPart = this.fragmentTracker.getAppendedFrag(position, PlaylistLevelType.MAIN);
    if (fragOrPart && 'fragment' in fragOrPart) {
      return fragOrPart.fragment;
    }
    return fragOrPart;
  }
  getNextFragment(pos, levelDetails) {
    const fragments = levelDetails.fragments;
    const fragLen = fragments.length;
    if (!fragLen) {
      return null;
    }

    // find fragment index, contiguous with end of buffer position
    const {
      config
    } = this;
    const start = fragments[0].start;
    let frag;
    if (levelDetails.live) {
      const initialLiveManifestSize = config.initialLiveManifestSize;
      if (fragLen < initialLiveManifestSize) {
        this.warn(`Not enough fragments to start playback (have: ${fragLen}, need: ${initialLiveManifestSize})`);
        return null;
      }
      // The real fragment start times for a live stream are only known after the PTS range for that level is known.
      // In order to discover the range, we load the best matching fragment for that level and demux it.
      // Do not load using live logic if the starting frag is requested - we want to use getFragmentAtPosition() so that
      // we get the fragment matching that start time
      if (!levelDetails.PTSKnown && !this.startFragRequested && this.startPosition === -1) {
        frag = this.getInitialLiveFragment(levelDetails, fragments);
        this.startPosition = frag ? this.hls.liveSyncPosition || frag.start : pos;
      }
    } else if (pos <= start) {
      // VoD playlist: if loadPosition before start of playlist, load first fragment
      frag = fragments[0];
    }

    // If we haven't run into any special cases already, just load the fragment most closely matching the requested position
    if (!frag) {
      const end = config.lowLatencyMode ? levelDetails.partEnd : levelDetails.fragmentEnd;
      frag = this.getFragmentAtPosition(pos, end, levelDetails);
    }
    return this.mapToInitFragWhenRequired(frag);
  }
  isLoopLoading(frag, targetBufferTime) {
    const trackerState = this.fragmentTracker.getState(frag);
    return (trackerState === FragmentState.OK || trackerState === FragmentState.PARTIAL && !!frag.gap) && this.nextLoadPosition > targetBufferTime;
  }
  getNextFragmentLoopLoading(frag, levelDetails, bufferInfo, playlistType, maxBufLen) {
    const gapStart = frag.gap;
    const nextFragment = this.getNextFragment(this.nextLoadPosition, levelDetails);
    if (nextFragment === null) {
      return nextFragment;
    }
    frag = nextFragment;
    if (gapStart && frag && !frag.gap && bufferInfo.nextStart) {
      // Media buffered after GAP tags should not make the next buffer timerange exceed forward buffer length
      const nextbufferInfo = this.getFwdBufferInfoAtPos(this.mediaBuffer ? this.mediaBuffer : this.media, bufferInfo.nextStart, playlistType);
      if (nextbufferInfo !== null && bufferInfo.len + nextbufferInfo.len >= maxBufLen) {
        // Returning here might result in not finding an audio and video candiate to skip to
        this.log(`buffer full after gaps in "${playlistType}" playlist starting at sn: ${frag.sn}`);
        return null;
      }
    }
    return frag;
  }
  mapToInitFragWhenRequired(frag) {
    // If an initSegment is present, it must be buffered first
    if (frag != null && frag.initSegment && !(frag != null && frag.initSegment.data) && !this.bitrateTest) {
      return frag.initSegment;
    }
    return frag;
  }
  getNextPart(partList, frag, targetBufferTime) {
    let nextPart = -1;
    let contiguous = false;
    let independentAttrOmitted = true;
    for (let i = 0, len = partList.length; i < len; i++) {
      const part = partList[i];
      independentAttrOmitted = independentAttrOmitted && !part.independent;
      if (nextPart > -1 && targetBufferTime < part.start) {
        break;
      }
      const loaded = part.loaded;
      if (loaded) {
        nextPart = -1;
      } else if ((contiguous || part.independent || independentAttrOmitted) && part.fragment === frag) {
        nextPart = i;
      }
      contiguous = loaded;
    }
    return nextPart;
  }
  loadedEndOfParts(partList, targetBufferTime) {
    const lastPart = partList[partList.length - 1];
    return lastPart && targetBufferTime > lastPart.start && lastPart.loaded;
  }

  /*
   This method is used find the best matching first fragment for a live playlist. This fragment is used to calculate the
   "sliding" of the playlist, which is its offset from the start of playback. After sliding we can compute the real
   start and end times for each fragment in the playlist (after which this method will not need to be called).
  */
  getInitialLiveFragment(levelDetails, fragments) {
    const fragPrevious = this.fragPrevious;
    let frag = null;
    if (fragPrevious) {
      if (levelDetails.hasProgramDateTime) {
        // Prefer using PDT, because it can be accurate enough to choose the correct fragment without knowing the level sliding
        this.log(`Live playlist, switching playlist, load frag with same PDT: ${fragPrevious.programDateTime}`);
        frag = findFragmentByPDT(fragments, fragPrevious.endProgramDateTime, this.config.maxFragLookUpTolerance);
      }
      if (!frag) {
        // SN does not need to be accurate between renditions, but depending on the packaging it may be so.
        const targetSN = fragPrevious.sn + 1;
        if (targetSN >= levelDetails.startSN && targetSN <= levelDetails.endSN) {
          const fragNext = fragments[targetSN - levelDetails.startSN];
          // Ensure that we're staying within the continuity range, since PTS resets upon a new range
          if (fragPrevious.cc === fragNext.cc) {
            frag = fragNext;
            this.log(`Live playlist, switching playlist, load frag with next SN: ${frag.sn}`);
          }
        }
        // It's important to stay within the continuity range if available; otherwise the fragments in the playlist
        // will have the wrong start times
        if (!frag) {
          frag = findFragWithCC(fragments, fragPrevious.cc);
          if (frag) {
            this.log(`Live playlist, switching playlist, load frag with same CC: ${frag.sn}`);
          }
        }
      }
    } else {
      // Find a new start fragment when fragPrevious is null
      const liveStart = this.hls.liveSyncPosition;
      if (liveStart !== null) {
        frag = this.getFragmentAtPosition(liveStart, this.bitrateTest ? levelDetails.fragmentEnd : levelDetails.edge, levelDetails);
      }
    }
    return frag;
  }

  /*
  This method finds the best matching fragment given the provided position.
   */
  getFragmentAtPosition(bufferEnd, end, levelDetails) {
    const {
      config
    } = this;
    let {
      fragPrevious
    } = this;
    let {
      fragments,
      endSN
    } = levelDetails;
    const {
      fragmentHint
    } = levelDetails;
    const tolerance = config.maxFragLookUpTolerance;
    const partList = levelDetails.partList;
    const loadingParts = !!(config.lowLatencyMode && partList != null && partList.length && fragmentHint);
    if (loadingParts && fragmentHint && !this.bitrateTest) {
      // Include incomplete fragment with parts at end
      fragments = fragments.concat(fragmentHint);
      endSN = fragmentHint.sn;
    }
    let frag;
    if (bufferEnd < end) {
      const lookupTolerance = bufferEnd > end - tolerance ? 0 : tolerance;
      // Remove the tolerance if it would put the bufferEnd past the actual end of stream
      // Uses buffer and sequence number to calculate switch segment (required if using EXT-X-DISCONTINUITY-SEQUENCE)
      frag = findFragmentByPTS(fragPrevious, fragments, bufferEnd, lookupTolerance);
    } else {
      // reach end of playlist
      frag = fragments[fragments.length - 1];
    }
    if (frag) {
      const curSNIdx = frag.sn - levelDetails.startSN;
      // Move fragPrevious forward to support forcing the next fragment to load
      // when the buffer catches up to a previously buffered range.
      const fragState = this.fragmentTracker.getState(frag);
      if (fragState === FragmentState.OK || fragState === FragmentState.PARTIAL && frag.gap) {
        fragPrevious = frag;
      }
      if (fragPrevious && frag.sn === fragPrevious.sn && (!loadingParts || partList[0].fragment.sn > frag.sn)) {
        // Force the next fragment to load if the previous one was already selected. This can occasionally happen with
        // non-uniform fragment durations
        const sameLevel = fragPrevious && frag.level === fragPrevious.level;
        if (sameLevel) {
          const nextFrag = fragments[curSNIdx + 1];
          if (frag.sn < endSN && this.fragmentTracker.getState(nextFrag) !== FragmentState.OK) {
            frag = nextFrag;
          } else {
            frag = null;
          }
        }
      }
    }
    return frag;
  }
  synchronizeToLiveEdge(levelDetails) {
    const {
      config,
      media
    } = this;
    if (!media) {
      return;
    }
    const liveSyncPosition = this.hls.liveSyncPosition;
    const currentTime = media.currentTime;
    const start = levelDetails.fragments[0].start;
    const end = levelDetails.edge;
    const withinSlidingWindow = currentTime >= start - config.maxFragLookUpTolerance && currentTime <= end;
    // Continue if we can seek forward to sync position or if current time is outside of sliding window
    if (liveSyncPosition !== null && media.duration > liveSyncPosition && (currentTime < liveSyncPosition || !withinSlidingWindow)) {
      // Continue if buffer is starving or if current time is behind max latency
      const maxLatency = config.liveMaxLatencyDuration !== undefined ? config.liveMaxLatencyDuration : config.liveMaxLatencyDurationCount * levelDetails.targetduration;
      if (!withinSlidingWindow && media.readyState < 4 || currentTime < end - maxLatency) {
        if (!this.loadedmetadata) {
          this.nextLoadPosition = liveSyncPosition;
        }
        // Only seek if ready and there is not a significant forward buffer available for playback
        if (media.readyState) {
          this.warn(`Playback: ${currentTime.toFixed(3)} is located too far from the end of live sliding playlist: ${end}, reset currentTime to : ${liveSyncPosition.toFixed(3)}`);
          media.currentTime = liveSyncPosition;
        }
      }
    }
  }
  alignPlaylists(details, previousDetails) {
    const {
      levels,
      levelLastLoaded,
      fragPrevious
    } = this;
    const lastLevel = levelLastLoaded !== null ? levels[levelLastLoaded] : null;

    // FIXME: If not for `shouldAlignOnDiscontinuities` requiring fragPrevious.cc,
    //  this could all go in level-helper mergeDetails()
    const length = details.fragments.length;
    if (!length) {
      this.warn(`No fragments in live playlist`);
      return 0;
    }
    const slidingStart = details.fragments[0].start;
    const firstLevelLoad = !previousDetails;
    const aligned = details.alignedSliding && isFiniteNumber(slidingStart);
    if (firstLevelLoad || !aligned && !slidingStart) {
      alignStream(fragPrevious, lastLevel, details);
      const alignedSlidingStart = details.fragments[0].start;
      this.log(`Live playlist sliding: ${alignedSlidingStart.toFixed(2)} start-sn: ${previousDetails ? previousDetails.startSN : 'na'}->${details.startSN} prev-sn: ${fragPrevious ? fragPrevious.sn : 'na'} fragments: ${length}`);
      return alignedSlidingStart;
    }
    return slidingStart;
  }
  waitForCdnTuneIn(details) {
    // Wait for Low-Latency CDN Tune-in to get an updated playlist
    const advancePartLimit = 3;
    return details.live && details.canBlockReload && details.partTarget && details.tuneInGoal > Math.max(details.partHoldBack, details.partTarget * advancePartLimit);
  }
  setStartPosition(details, sliding) {
    // compute start position if set to -1. use it straight away if value is defined
    let startPosition = this.startPosition;
    if (startPosition < sliding) {
      startPosition = -1;
    }
    if (startPosition === -1 || this.lastCurrentTime === -1) {
      // Use Playlist EXT-X-START:TIME-OFFSET when set
      // Prioritize Multivariant Playlist offset so that main, audio, and subtitle stream-controller start times match
      const offsetInMultivariantPlaylist = this.startTimeOffset !== null;
      const startTimeOffset = offsetInMultivariantPlaylist ? this.startTimeOffset : details.startTimeOffset;
      if (startTimeOffset !== null && isFiniteNumber(startTimeOffset)) {
        startPosition = sliding + startTimeOffset;
        if (startTimeOffset < 0) {
          startPosition += details.totalduration;
        }
        startPosition = Math.min(Math.max(sliding, startPosition), sliding + details.totalduration);
        this.log(`Start time offset ${startTimeOffset} found in ${offsetInMultivariantPlaylist ? 'multivariant' : 'media'} playlist, adjust startPosition to ${startPosition}`);
        this.startPosition = startPosition;
      } else if (details.live) {
        // Leave this.startPosition at -1, so that we can use `getInitialLiveFragment` logic when startPosition has
        // not been specified via the config or an as an argument to startLoad (#3736).
        startPosition = this.hls.liveSyncPosition || sliding;
      } else {
        this.startPosition = startPosition = 0;
      }
      this.lastCurrentTime = startPosition;
    }
    this.nextLoadPosition = startPosition;
  }
  getLoadPosition() {
    const {
      media
    } = this;
    // if we have not yet loaded any fragment, start loading from start position
    let pos = 0;
    if (this.loadedmetadata && media) {
      pos = media.currentTime;
    } else if (this.nextLoadPosition) {
      pos = this.nextLoadPosition;
    }
    return pos;
  }
  handleFragLoadAborted(frag, part) {
    if (this.transmuxer && frag.sn !== 'initSegment' && frag.stats.aborted) {
      this.warn(`Fragment ${frag.sn}${part ? ' part ' + part.index : ''} of level ${frag.level} was aborted`);
      this.resetFragmentLoading(frag);
    }
  }
  resetFragmentLoading(frag) {
    if (!this.fragCurrent || !this.fragContextChanged(frag) && this.state !== State.FRAG_LOADING_WAITING_RETRY) {
      this.state = State.IDLE;
    }
  }
  onFragmentOrKeyLoadError(filterType, data) {
    if (data.chunkMeta && !data.frag) {
      const context = this.getCurrentContext(data.chunkMeta);
      if (context) {
        data.frag = context.frag;
      }
    }
    const frag = data.frag;
    // Handle frag error related to caller's filterType
    if (!frag || frag.type !== filterType || !this.levels) {
      return;
    }
    if (this.fragContextChanged(frag)) {
      var _this$fragCurrent2;
      this.warn(`Frag load error must match current frag to retry ${frag.url} > ${(_this$fragCurrent2 = this.fragCurrent) == null ? void 0 : _this$fragCurrent2.url}`);
      return;
    }
    const gapTagEncountered = data.details === ErrorDetails.FRAG_GAP;
    if (gapTagEncountered) {
      this.fragmentTracker.fragBuffered(frag, true);
    }
    // keep retrying until the limit will be reached
    const errorAction = data.errorAction;
    const {
      action,
      retryCount = 0,
      retryConfig
    } = errorAction || {};
    if (errorAction && action === NetworkErrorAction.RetryRequest && retryConfig) {
      var _this$levelLastLoaded;
      this.resetStartWhenNotLoaded((_this$levelLastLoaded = this.levelLastLoaded) != null ? _this$levelLastLoaded : frag.level);
      const delay = getRetryDelay(retryConfig, retryCount);
      this.warn(`Fragment ${frag.sn} of ${filterType} ${frag.level} errored with ${data.details}, retrying loading ${retryCount + 1}/${retryConfig.maxNumRetry} in ${delay}ms`);
      errorAction.resolved = true;
      this.retryDate = self.performance.now() + delay;
      this.state = State.FRAG_LOADING_WAITING_RETRY;
    } else if (retryConfig && errorAction) {
      this.resetFragmentErrors(filterType);
      if (retryCount < retryConfig.maxNumRetry) {
        // Network retry is skipped when level switch is preferred
        if (!gapTagEncountered) {
          errorAction.resolved = true;
        }
      } else {
        logger.warn(`${data.details} reached or exceeded max retry (${retryCount})`);
      }
    } else if ((errorAction == null ? void 0 : errorAction.action) === NetworkErrorAction.SendAlternateToPenaltyBox) {
      this.state = State.WAITING_LEVEL;
    } else {
      this.state = State.ERROR;
    }
    // Perform next async tick sooner to speed up error action resolution
    this.tickImmediate();
  }
  reduceLengthAndFlushBuffer(data) {
    // if in appending state
    if (this.state === State.PARSING || this.state === State.PARSED) {
      const playlistType = data.parent;
      const bufferedInfo = this.getFwdBufferInfo(this.mediaBuffer, playlistType);
      // 0.5 : tolerance needed as some browsers stalls playback before reaching buffered end
      // reduce max buf len if current position is buffered
      const buffered = bufferedInfo && bufferedInfo.len > 0.5;
      if (buffered) {
        this.reduceMaxBufferLength(bufferedInfo.len);
      }
      const flushBuffer = !buffered;
      if (flushBuffer) {
        // current position is not buffered, but browser is still complaining about buffer full error
        // this happens on IE/Edge, refer to https://github.com/video-dev/hls.js/pull/708
        // in that case flush the whole audio buffer to recover
        this.warn(`Buffer full error while media.currentTime is not buffered, flush ${playlistType} buffer`);
      }
      if (data.frag) {
        this.fragmentTracker.removeFragment(data.frag);
        this.nextLoadPosition = data.frag.start;
      }
      this.resetLoadingState();
      return flushBuffer;
    }
    return false;
  }
  resetFragmentErrors(filterType) {
    if (filterType === PlaylistLevelType.AUDIO) {
      // Reset current fragment since audio track audio is essential and may not have a fail-over track
      this.fragCurrent = null;
    }
    // Fragment errors that result in a level switch or redundant fail-over
    // should reset the stream controller state to idle
    if (!this.loadedmetadata) {
      this.startFragRequested = false;
    }
    if (this.state !== State.STOPPED) {
      this.state = State.IDLE;
    }
  }
  afterBufferFlushed(media, bufferType, playlistType) {
    if (!media) {
      return;
    }
    // After successful buffer flushing, filter flushed fragments from bufferedFrags use mediaBuffered instead of media
    // (so that we will check against video.buffered ranges in case of alt audio track)
    const bufferedTimeRanges = BufferHelper.getBuffered(media);
    this.fragmentTracker.detectEvictedFragments(bufferType, bufferedTimeRanges, playlistType);
    if (this.state === State.ENDED) {
      this.resetLoadingState();
    }
  }
  resetLoadingState() {
    this.log('Reset loading state');
    this.fragCurrent = null;
    this.fragPrevious = null;
    this.state = State.IDLE;
  }
  resetStartWhenNotLoaded(level) {
    // if loadedmetadata is not set, it means that first frag request failed
    // in that case, reset startFragRequested flag
    if (!this.loadedmetadata) {
      this.startFragRequested = false;
      const details = this.levels ? this.levels[level].details : null;
      if (details != null && details.live) {
        // Update the start position and return to IDLE to recover live start
        this.startPosition = -1;
        this.setStartPosition(details, 0);
        this.resetLoadingState();
      } else {
        this.nextLoadPosition = this.startPosition;
      }
    }
  }
  resetWhenMissingContext(chunkMeta) {
    var _this$levelLastLoaded2;
    this.warn(`The loading context changed while buffering fragment ${chunkMeta.sn} of level ${chunkMeta.level}. This chunk will not be buffered.`);
    this.removeUnbufferedFrags();
    this.resetStartWhenNotLoaded((_this$levelLastLoaded2 = this.levelLastLoaded) != null ? _this$levelLastLoaded2 : chunkMeta.level);
    this.resetLoadingState();
  }
  removeUnbufferedFrags(start = 0) {
    this.fragmentTracker.removeFragmentsInRange(start, Infinity, this.playlistType, false, true);
  }
  updateLevelTiming(frag, part, level, partial) {
    var _this$transmuxer;
    const details = level.details;
    if (!details) {
      this.warn('level.details undefined');
      return;
    }
    const parsed = Object.keys(frag.elementaryStreams).reduce((result, type) => {
      const info = frag.elementaryStreams[type];
      if (info) {
        const parsedDuration = info.endPTS - info.startPTS;
        if (parsedDuration <= 0) {
          // Destroy the transmuxer after it's next time offset failed to advance because duration was <= 0.
          // The new transmuxer will be configured with a time offset matching the next fragment start,
          // preventing the timeline from shifting.
          this.warn(`Could not parse fragment ${frag.sn} ${type} duration reliably (${parsedDuration})`);
          return result || false;
        }
        const drift = partial ? 0 : updateFragPTSDTS(details, frag, info.startPTS, info.endPTS, info.startDTS, info.endDTS);
        this.hls.trigger(Events.LEVEL_PTS_UPDATED, {
          details,
          level,
          drift,
          type,
          frag,
          start: info.startPTS,
          end: info.endPTS
        });
        return true;
      }
      return result;
    }, false);
    if (parsed) {
      level.fragmentError = 0;
    } else if (((_this$transmuxer = this.transmuxer) == null ? void 0 : _this$transmuxer.error) === null) {
      const error = new Error(`Found no media in fragment ${frag.sn} of level ${frag.level} resetting transmuxer to fallback to playlist timing`);
      if (level.fragmentError === 0) {
        // Mark and track the odd empty segment as a gap to avoid reloading
        level.fragmentError++;
        frag.gap = true;
        this.fragmentTracker.removeFragment(frag);
        this.fragmentTracker.fragBuffered(frag, true);
      }
      this.warn(error.message);
      this.hls.trigger(Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.FRAG_PARSING_ERROR,
        fatal: false,
        error,
        frag,
        reason: `Found no media in msn ${frag.sn} of level "${level.url}"`
      });
      if (!this.hls) {
        return;
      }
      this.resetTransmuxer();
      // For this error fallthrough. Marking parsed will allow advancing to next fragment.
    }

    this.state = State.PARSED;
    this.hls.trigger(Events.FRAG_PARSED, {
      frag,
      part
    });
  }
  resetTransmuxer() {
    if (this.transmuxer) {
      this.transmuxer.destroy();
      this.transmuxer = null;
    }
  }
  recoverWorkerError(data) {
    if (data.event === 'demuxerWorker') {
      var _ref, _this$levelLastLoaded3, _this$fragCurrent3;
      this.fragmentTracker.removeAllFragments();
      this.resetTransmuxer();
      this.resetStartWhenNotLoaded((_ref = (_this$levelLastLoaded3 = this.levelLastLoaded) != null ? _this$levelLastLoaded3 : (_this$fragCurrent3 = this.fragCurrent) == null ? void 0 : _this$fragCurrent3.level) != null ? _ref : 0);
      this.resetLoadingState();
    }
  }
  set state(nextState) {
    const previousState = this._state;
    if (previousState !== nextState) {
      this._state = nextState;
      this.log(`${previousState}->${nextState}`);
    }
  }
  get state() {
    return this._state;
  }
}

function getSourceBuffer() {
  return self.SourceBuffer || self.WebKitSourceBuffer;
}

/**
 * @ignore
 */
function isSupported() {
  const mediaSource = getMediaSource();
  if (!mediaSource) {
    return false;
  }
  const sourceBuffer = getSourceBuffer();
  const isTypeSupported = mediaSource && typeof mediaSource.isTypeSupported === 'function' && mediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"');

  // if SourceBuffer is exposed ensure its API is valid
  // Older browsers do not expose SourceBuffer globally so checking SourceBuffer.prototype is impossible
  const sourceBufferValidAPI = !sourceBuffer || sourceBuffer.prototype && typeof sourceBuffer.prototype.appendBuffer === 'function' && typeof sourceBuffer.prototype.remove === 'function';
  return !!isTypeSupported && !!sourceBufferValidAPI;
}

/**
 * @ignore
 */
function changeTypeSupported() {
  var _sourceBuffer$prototy;
  const sourceBuffer = getSourceBuffer();
  return typeof (sourceBuffer == null ? void 0 : (_sourceBuffer$prototy = sourceBuffer.prototype) == null ? void 0 : _sourceBuffer$prototy.changeType) === 'function';
}

// ensure the worker ends up in the bundle
// If the worker should not be included this gets aliased to empty.js
function hasUMDWorker() {
  return typeof __HLS_WORKER_BUNDLE__ === 'function';
}
function injectWorker() {
  const blob = new self.Blob([`var exports={};var module={exports:exports};function define(f){f()};define.amd=true;(${__HLS_WORKER_BUNDLE__.toString()})(true);`], {
    type: 'text/javascript'
  });
  const objectURL = self.URL.createObjectURL(blob);
  const worker = new self.Worker(objectURL);
  return {
    worker,
    objectURL
  };
}
function loadWorker(path) {
  const scriptURL = new self.URL(path, self.location.href).href;
  const worker = new self.Worker(scriptURL);
  return {
    worker,
    scriptURL
  };
}

function dummyTrack(type = '', inputTimeScale = 90000) {
  return {
    type,
    id: -1,
    pid: -1,
    inputTimeScale,
    sequenceNumber: -1,
    samples: [],
    dropped: 0
  };
}

class BaseAudioDemuxer {
  constructor() {
    this._audioTrack = void 0;
    this._id3Track = void 0;
    this.frameIndex = 0;
    this.cachedData = null;
    this.basePTS = null;
    this.initPTS = null;
    this.lastPTS = null;
  }
  resetInitSegment(initSegment, audioCodec, videoCodec, trackDuration) {
    this._id3Track = {
      type: 'id3',
      id: 3,
      pid: -1,
      inputTimeScale: 90000,
      sequenceNumber: 0,
      samples: [],
      dropped: 0
    };
  }
  resetTimeStamp(deaultTimestamp) {
    this.initPTS = deaultTimestamp;
    this.resetContiguity();
  }
  resetContiguity() {
    this.basePTS = null;
    this.lastPTS = null;
    this.frameIndex = 0;
  }
  canParse(data, offset) {
    return false;
  }
  appendFrame(track, data, offset) {}

  // feed incoming data to the front of the parsing pipeline
  demux(data, timeOffset) {
    if (this.cachedData) {
      data = appendUint8Array(this.cachedData, data);
      this.cachedData = null;
    }
    let id3Data = getID3Data(data, 0);
    let offset = id3Data ? id3Data.length : 0;
    let lastDataIndex;
    const track = this._audioTrack;
    const id3Track = this._id3Track;
    const timestamp = id3Data ? getTimeStamp(id3Data) : undefined;
    const length = data.length;
    if (this.basePTS === null || this.frameIndex === 0 && isFiniteNumber(timestamp)) {
      this.basePTS = initPTSFn(timestamp, timeOffset, this.initPTS);
      this.lastPTS = this.basePTS;
    }
    if (this.lastPTS === null) {
      this.lastPTS = this.basePTS;
    }

    // more expressive than alternative: id3Data?.length
    if (id3Data && id3Data.length > 0) {
      id3Track.samples.push({
        pts: this.lastPTS,
        dts: this.lastPTS,
        data: id3Data,
        type: MetadataSchema.audioId3,
        duration: Number.POSITIVE_INFINITY
      });
    }
    while (offset < length) {
      if (this.canParse(data, offset)) {
        const frame = this.appendFrame(track, data, offset);
        if (frame) {
          this.frameIndex++;
          this.lastPTS = frame.sample.pts;
          offset += frame.length;
          lastDataIndex = offset;
        } else {
          offset = length;
        }
      } else if (canParse$1(data, offset)) {
        // after a ID3.canParse, a call to ID3.getID3Data *should* always returns some data
        id3Data = getID3Data(data, offset);
        id3Track.samples.push({
          pts: this.lastPTS,
          dts: this.lastPTS,
          data: id3Data,
          type: MetadataSchema.audioId3,
          duration: Number.POSITIVE_INFINITY
        });
        offset += id3Data.length;
        lastDataIndex = offset;
      } else {
        offset++;
      }
      if (offset === length && lastDataIndex !== length) {
        const partialData = sliceUint8(data, lastDataIndex);
        if (this.cachedData) {
          this.cachedData = appendUint8Array(this.cachedData, partialData);
        } else {
          this.cachedData = partialData;
        }
      }
    }
    return {
      audioTrack: track,
      videoTrack: dummyTrack(),
      id3Track,
      textTrack: dummyTrack()
    };
  }
  demuxSampleAes(data, keyData, timeOffset) {
    return Promise.reject(new Error(`[${this}] This demuxer does not support Sample-AES decryption`));
  }
  flush(timeOffset) {
    // Parse cache in case of remaining frames.
    const cachedData = this.cachedData;
    if (cachedData) {
      this.cachedData = null;
      this.demux(cachedData, 0);
    }
    return {
      audioTrack: this._audioTrack,
      videoTrack: dummyTrack(),
      id3Track: this._id3Track,
      textTrack: dummyTrack()
    };
  }
  destroy() {}
}

/**
 * Initialize PTS
 * <p>
 *    use timestamp unless it is undefined, NaN or Infinity
 * </p>
 */
const initPTSFn = (timestamp, timeOffset, initPTS) => {
  if (isFiniteNumber(timestamp)) {
    return timestamp * 90;
  }
  const init90kHz = initPTS ? initPTS.baseTime * 90000 / initPTS.timescale : 0;
  return timeOffset * 90000 + init90kHz;
};

/**
 *  MPEG parser helper
 */

let chromeVersion$1 = null;
const BitratesMap = [32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const SamplingRateMap = [44100, 48000, 32000, 22050, 24000, 16000, 11025, 12000, 8000];
const SamplesCoefficients = [
// MPEG 2.5
[0,
// Reserved
72,
// Layer3
144,
// Layer2
12 // Layer1
],
// Reserved
[0,
// Reserved
0,
// Layer3
0,
// Layer2
0 // Layer1
],
// MPEG 2
[0,
// Reserved
72,
// Layer3
144,
// Layer2
12 // Layer1
],
// MPEG 1
[0,
// Reserved
144,
// Layer3
144,
// Layer2
12 // Layer1
]];

const BytesInSlot = [0,
// Reserved
1,
// Layer3
1,
// Layer2
4 // Layer1
];

function appendFrame(track, data, offset, pts, frameIndex) {
  // Using http://www.datavoyage.com/mpgscript/mpeghdr.htm as a reference
  if (offset + 24 > data.length) {
    return;
  }
  const header = parseHeader(data, offset);
  if (header && offset + header.frameLength <= data.length) {
    const frameDuration = header.samplesPerFrame * 90000 / header.sampleRate;
    const stamp = pts + frameIndex * frameDuration;
    const sample = {
      unit: data.subarray(offset, offset + header.frameLength),
      pts: stamp,
      dts: stamp
    };
    track.config = [];
    track.channelCount = header.channelCount;
    track.samplerate = header.sampleRate;
    track.samples.push(sample);
    return {
      sample,
      length: header.frameLength,
      missing: 0
    };
  }
}
function parseHeader(data, offset) {
  const mpegVersion = data[offset + 1] >> 3 & 3;
  const mpegLayer = data[offset + 1] >> 1 & 3;
  const bitRateIndex = data[offset + 2] >> 4 & 15;
  const sampleRateIndex = data[offset + 2] >> 2 & 3;
  if (mpegVersion !== 1 && bitRateIndex !== 0 && bitRateIndex !== 15 && sampleRateIndex !== 3) {
    const paddingBit = data[offset + 2] >> 1 & 1;
    const channelMode = data[offset + 3] >> 6;
    const columnInBitrates = mpegVersion === 3 ? 3 - mpegLayer : mpegLayer === 3 ? 3 : 4;
    const bitRate = BitratesMap[columnInBitrates * 14 + bitRateIndex - 1] * 1000;
    const columnInSampleRates = mpegVersion === 3 ? 0 : mpegVersion === 2 ? 1 : 2;
    const sampleRate = SamplingRateMap[columnInSampleRates * 3 + sampleRateIndex];
    const channelCount = channelMode === 3 ? 1 : 2; // If bits of channel mode are `11` then it is a single channel (Mono)
    const sampleCoefficient = SamplesCoefficients[mpegVersion][mpegLayer];
    const bytesInSlot = BytesInSlot[mpegLayer];
    const samplesPerFrame = sampleCoefficient * 8 * bytesInSlot;
    const frameLength = Math.floor(sampleCoefficient * bitRate / sampleRate + paddingBit) * bytesInSlot;
    if (chromeVersion$1 === null) {
      const userAgent = navigator.userAgent || '';
      const result = userAgent.match(/Chrome\/(\d+)/i);
      chromeVersion$1 = result ? parseInt(result[1]) : 0;
    }
    const needChromeFix = !!chromeVersion$1 && chromeVersion$1 <= 87;
    if (needChromeFix && mpegLayer === 2 && bitRate >= 224000 && channelMode === 0) {
      // Work around bug in Chromium by setting channelMode to dual-channel (01) instead of stereo (00)
      data[offset + 3] = data[offset + 3] | 0x80;
    }
    return {
      sampleRate,
      channelCount,
      frameLength,
      samplesPerFrame
    };
  }
}
function isHeaderPattern(data, offset) {
  return data[offset] === 0xff && (data[offset + 1] & 0xe0) === 0xe0 && (data[offset + 1] & 0x06) !== 0x00;
}
function isHeader(data, offset) {
  // Look for MPEG header | 1111 1111 | 111X XYZX | where X can be either 0 or 1 and Y or Z should be 1
  // Layer bits (position 14 and 15) in header should be always different from 0 (Layer I or Layer II or Layer III)
  // More info http://www.mp3-tech.org/programmer/frame_header.html
  return offset + 1 < data.length && isHeaderPattern(data, offset);
}
function canParse(data, offset) {
  const headerSize = 4;
  return isHeaderPattern(data, offset) && headerSize <= data.length - offset;
}
function probe(data, offset) {
  // same as isHeader but we also check that MPEG frame follows last MPEG frame
  // or end of data is reached
  if (offset + 1 < data.length && isHeaderPattern(data, offset)) {
    // MPEG header Length
    const headerLength = 4;
    // MPEG frame Length
    const header = parseHeader(data, offset);
    let frameLength = headerLength;
    if (header != null && header.frameLength) {
      frameLength = header.frameLength;
    }
    const newOffset = offset + frameLength;
    return newOffset === data.length || isHeader(data, newOffset);
  }
  return false;
}

/**
 * MP3 demuxer
 */
class MP3Demuxer extends BaseAudioDemuxer {
  resetInitSegment(initSegment, audioCodec, videoCodec, trackDuration) {
    super.resetInitSegment(initSegment, audioCodec, videoCodec, trackDuration);
    this._audioTrack = {
      container: 'audio/mpeg',
      type: 'audio',
      id: 2,
      pid: -1,
      sequenceNumber: 0,
      segmentCodec: 'mp3',
      samples: [],
      manifestCodec: audioCodec,
      duration: trackDuration,
      inputTimeScale: 90000,
      dropped: 0
    };
  }
  static probe(data) {
    if (!data) {
      return false;
    }

    // check if data contains ID3 timestamp and MPEG sync word
    // Look for MPEG header | 1111 1111 | 111X XYZX | where X can be either 0 or 1 and Y or Z should be 1
    // Layer bits (position 14 and 15) in header should be always different from 0 (Layer I or Layer II or Layer III)
    // More info http://www.mp3-tech.org/programmer/frame_header.html
    const id3Data = getID3Data(data, 0) || [];
    let offset = id3Data.length;
    for (let length = data.length; offset < length; offset++) {
      if (probe(data, offset)) {
        logger.log('MPEG Audio sync word found !');
        return true;
      }
    }
    return false;
  }
  canParse(data, offset) {
    return canParse(data, offset);
  }
  appendFrame(track, data, offset) {
    if (this.basePTS === null) {
      return;
    }
    return appendFrame(track, data, offset, this.basePTS, this.frameIndex);
  }
}

/**
 *  AAC helper
 */

class AAC {
  static getSilentFrame(codec, channelCount) {
    switch (codec) {
      case 'mp4a.40.2':
        if (channelCount === 1) {
          return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x23, 0x80]);
        } else if (channelCount === 2) {
          return new Uint8Array([0x21, 0x00, 0x49, 0x90, 0x02, 0x19, 0x00, 0x23, 0x80]);
        } else if (channelCount === 3) {
          return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x8e]);
        } else if (channelCount === 4) {
          return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x80, 0x2c, 0x80, 0x08, 0x02, 0x38]);
        } else if (channelCount === 5) {
          return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x82, 0x30, 0x04, 0x99, 0x00, 0x21, 0x90, 0x02, 0x38]);
        } else if (channelCount === 6) {
          return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x82, 0x30, 0x04, 0x99, 0x00, 0x21, 0x90, 0x02, 0x00, 0xb2, 0x00, 0x20, 0x08, 0xe0]);
        }
        break;
      // handle HE-AAC below (mp4a.40.5 / mp4a.40.29)
      default:
        if (channelCount === 1) {
          // ffmpeg -y -f lavfi -i "aevalsrc=0:d=0.05" -c:a libfdk_aac -profile:a aac_he -b:a 4k output.aac && hexdump -v -e '16/1 "0x%x," "\n"' -v output.aac
          return new Uint8Array([0x1, 0x40, 0x22, 0x80, 0xa3, 0x4e, 0xe6, 0x80, 0xba, 0x8, 0x0, 0x0, 0x0, 0x1c, 0x6, 0xf1, 0xc1, 0xa, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5e]);
        } else if (channelCount === 2) {
          // ffmpeg -y -f lavfi -i "aevalsrc=0|0:d=0.05" -c:a libfdk_aac -profile:a aac_he_v2 -b:a 4k output.aac && hexdump -v -e '16/1 "0x%x," "\n"' -v output.aac
          return new Uint8Array([0x1, 0x40, 0x22, 0x80, 0xa3, 0x5e, 0xe6, 0x80, 0xba, 0x8, 0x0, 0x0, 0x0, 0x0, 0x95, 0x0, 0x6, 0xf1, 0xa1, 0xa, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5e]);
        } else if (channelCount === 3) {
          // ffmpeg -y -f lavfi -i "aevalsrc=0|0|0:d=0.05" -c:a libfdk_aac -profile:a aac_he_v2 -b:a 4k output.aac && hexdump -v -e '16/1 "0x%x," "\n"' -v output.aac
          return new Uint8Array([0x1, 0x40, 0x22, 0x80, 0xa3, 0x5e, 0xe6, 0x80, 0xba, 0x8, 0x0, 0x0, 0x0, 0x0, 0x95, 0x0, 0x6, 0xf1, 0xa1, 0xa, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5e]);
        }
        break;
    }
    return undefined;
  }
}

/**
 * Generate MP4 Box
 */

const UINT32_MAX = Math.pow(2, 32) - 1;
class MP4 {
  static init() {
    MP4.types = {
      avc1: [],
      // codingname
      avcC: [],
      btrt: [],
      dinf: [],
      dref: [],
      esds: [],
      ftyp: [],
      hdlr: [],
      mdat: [],
      mdhd: [],
      mdia: [],
      mfhd: [],
      minf: [],
      moof: [],
      moov: [],
      mp4a: [],
      '.mp3': [],
      mvex: [],
      mvhd: [],
      pasp: [],
      sdtp: [],
      stbl: [],
      stco: [],
      stsc: [],
      stsd: [],
      stsz: [],
      stts: [],
      tfdt: [],
      tfhd: [],
      traf: [],
      trak: [],
      trun: [],
      trex: [],
      tkhd: [],
      vmhd: [],
      smhd: []
    };
    let i;
    for (i in MP4.types) {
      if (MP4.types.hasOwnProperty(i)) {
        MP4.types[i] = [i.charCodeAt(0), i.charCodeAt(1), i.charCodeAt(2), i.charCodeAt(3)];
      }
    }
    const videoHdlr = new Uint8Array([0x00,
    // version 0
    0x00, 0x00, 0x00,
    // flags
    0x00, 0x00, 0x00, 0x00,
    // pre_defined
    0x76, 0x69, 0x64, 0x65,
    // handler_type: 'vide'
    0x00, 0x00, 0x00, 0x00,
    // reserved
    0x00, 0x00, 0x00, 0x00,
    // reserved
    0x00, 0x00, 0x00, 0x00,
    // reserved
    0x56, 0x69, 0x64, 0x65, 0x6f, 0x48, 0x61, 0x6e, 0x64, 0x6c, 0x65, 0x72, 0x00 // name: 'VideoHandler'
    ]);

    const audioHdlr = new Uint8Array([0x00,
    // version 0
    0x00, 0x00, 0x00,
    // flags
    0x00, 0x00, 0x00, 0x00,
    // pre_defined
    0x73, 0x6f, 0x75, 0x6e,
    // handler_type: 'soun'
    0x00, 0x00, 0x00, 0x00,
    // reserved
    0x00, 0x00, 0x00, 0x00,
    // reserved
    0x00, 0x00, 0x00, 0x00,
    // reserved
    0x53, 0x6f, 0x75, 0x6e, 0x64, 0x48, 0x61, 0x6e, 0x64, 0x6c, 0x65, 0x72, 0x00 // name: 'SoundHandler'
    ]);

    MP4.HDLR_TYPES = {
      video: videoHdlr,
      audio: audioHdlr
    };
    const dref = new Uint8Array([0x00,
    // version 0
    0x00, 0x00, 0x00,
    // flags
    0x00, 0x00, 0x00, 0x01,
    // entry_count
    0x00, 0x00, 0x00, 0x0c,
    // entry_size
    0x75, 0x72, 0x6c, 0x20,
    // 'url' type
    0x00,
    // version 0
    0x00, 0x00, 0x01 // entry_flags
    ]);

    const stco = new Uint8Array([0x00,
    // version
    0x00, 0x00, 0x00,
    // flags
    0x00, 0x00, 0x00, 0x00 // entry_count
    ]);

    MP4.STTS = MP4.STSC = MP4.STCO = stco;
    MP4.STSZ = new Uint8Array([0x00,
    // version
    0x00, 0x00, 0x00,
    // flags
    0x00, 0x00, 0x00, 0x00,
    // sample_size
    0x00, 0x00, 0x00, 0x00 // sample_count
    ]);

    MP4.VMHD = new Uint8Array([0x00,
    // version
    0x00, 0x00, 0x01,
    // flags
    0x00, 0x00,
    // graphicsmode
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00 // opcolor
    ]);

    MP4.SMHD = new Uint8Array([0x00,
    // version
    0x00, 0x00, 0x00,
    // flags
    0x00, 0x00,
    // balance
    0x00, 0x00 // reserved
    ]);

    MP4.STSD = new Uint8Array([0x00,
    // version 0
    0x00, 0x00, 0x00,
    // flags
    0x00, 0x00, 0x00, 0x01]); // entry_count

    const majorBrand = new Uint8Array([105, 115, 111, 109]); // isom
    const avc1Brand = new Uint8Array([97, 118, 99, 49]); // avc1
    const minorVersion = new Uint8Array([0, 0, 0, 1]);
    MP4.FTYP = MP4.box(MP4.types.ftyp, majorBrand, minorVersion, majorBrand, avc1Brand);
    MP4.DINF = MP4.box(MP4.types.dinf, MP4.box(MP4.types.dref, dref));
  }
  static box(type, ...payload) {
    let size = 8;
    let i = payload.length;
    const len = i;
    // calculate the total size we need to allocate
    while (i--) {
      size += payload[i].byteLength;
    }
    const result = new Uint8Array(size);
    result[0] = size >> 24 & 0xff;
    result[1] = size >> 16 & 0xff;
    result[2] = size >> 8 & 0xff;
    result[3] = size & 0xff;
    result.set(type, 4);
    // copy the payload into the result
    for (i = 0, size = 8; i < len; i++) {
      // copy payload[i] array @ offset size
      result.set(payload[i], size);
      size += payload[i].byteLength;
    }
    return result;
  }
  static hdlr(type) {
    return MP4.box(MP4.types.hdlr, MP4.HDLR_TYPES[type]);
  }
  static mdat(data) {
    return MP4.box(MP4.types.mdat, data);
  }
  static mdhd(timescale, duration) {
    duration *= timescale;
    const upperWordDuration = Math.floor(duration / (UINT32_MAX + 1));
    const lowerWordDuration = Math.floor(duration % (UINT32_MAX + 1));
    return MP4.box(MP4.types.mdhd, new Uint8Array([0x01,
    // version 1
    0x00, 0x00, 0x00,
    // flags
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02,
    // creation_time
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03,
    // modification_time
    timescale >> 24 & 0xff, timescale >> 16 & 0xff, timescale >> 8 & 0xff, timescale & 0xff,
    // timescale
    upperWordDuration >> 24, upperWordDuration >> 16 & 0xff, upperWordDuration >> 8 & 0xff, upperWordDuration & 0xff, lowerWordDuration >> 24, lowerWordDuration >> 16 & 0xff, lowerWordDuration >> 8 & 0xff, lowerWordDuration & 0xff, 0x55, 0xc4,
    // 'und' language (undetermined)
    0x00, 0x00]));
  }
  static mdia(track) {
    return MP4.box(MP4.types.mdia, MP4.mdhd(track.timescale, track.duration), MP4.hdlr(track.type), MP4.minf(track));
  }
  static mfhd(sequenceNumber) {
    return MP4.box(MP4.types.mfhd, new Uint8Array([0x00, 0x00, 0x00, 0x00,
    // flags
    sequenceNumber >> 24, sequenceNumber >> 16 & 0xff, sequenceNumber >> 8 & 0xff, sequenceNumber & 0xff // sequence_number
    ]));
  }

  static minf(track) {
    if (track.type === 'audio') {
      return MP4.box(MP4.types.minf, MP4.box(MP4.types.smhd, MP4.SMHD), MP4.DINF, MP4.stbl(track));
    } else {
      return MP4.box(MP4.types.minf, MP4.box(MP4.types.vmhd, MP4.VMHD), MP4.DINF, MP4.stbl(track));
    }
  }
  static moof(sn, baseMediaDecodeTime, track) {
    return MP4.box(MP4.types.moof, MP4.mfhd(sn), MP4.traf(track, baseMediaDecodeTime));
  }
  static moov(tracks) {
    let i = tracks.length;
    const boxes = [];
    while (i--) {
      boxes[i] = MP4.trak(tracks[i]);
    }
    return MP4.box.apply(null, [MP4.types.moov, MP4.mvhd(tracks[0].timescale, tracks[0].duration)].concat(boxes).concat(MP4.mvex(tracks)));
  }
  static mvex(tracks) {
    let i = tracks.length;
    const boxes = [];
    while (i--) {
      boxes[i] = MP4.trex(tracks[i]);
    }
    return MP4.box.apply(null, [MP4.types.mvex, ...boxes]);
  }
  static mvhd(timescale, duration) {
    duration *= timescale;
    const upperWordDuration = Math.floor(duration / (UINT32_MAX + 1));
    const lowerWordDuration = Math.floor(duration % (UINT32_MAX + 1));
    const bytes = new Uint8Array([0x01,
    // version 1
    0x00, 0x00, 0x00,
    // flags
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02,
    // creation_time
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03,
    // modification_time
    timescale >> 24 & 0xff, timescale >> 16 & 0xff, timescale >> 8 & 0xff, timescale & 0xff,
    // timescale
    upperWordDuration >> 24, upperWordDuration >> 16 & 0xff, upperWordDuration >> 8 & 0xff, upperWordDuration & 0xff, lowerWordDuration >> 24, lowerWordDuration >> 16 & 0xff, lowerWordDuration >> 8 & 0xff, lowerWordDuration & 0xff, 0x00, 0x01, 0x00, 0x00,
    // 1.0 rate
    0x01, 0x00,
    // 1.0 volume
    0x00, 0x00,
    // reserved
    0x00, 0x00, 0x00, 0x00,
    // reserved
    0x00, 0x00, 0x00, 0x00,
    // reserved
    0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x00, 0x00, 0x00,
    // transformation: unity matrix
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    // pre_defined
    0xff, 0xff, 0xff, 0xff // next_track_ID
    ]);

    return MP4.box(MP4.types.mvhd, bytes);
  }
  static sdtp(track) {
    const samples = track.samples || [];
    const bytes = new Uint8Array(4 + samples.length);
    let i;
    let flags;
    // leave the full box header (4 bytes) all zero
    // write the sample table
    for (i = 0; i < samples.length; i++) {
      flags = samples[i].flags;
      bytes[i + 4] = flags.dependsOn << 4 | flags.isDependedOn << 2 | flags.hasRedundancy;
    }
    return MP4.box(MP4.types.sdtp, bytes);
  }
  static stbl(track) {
    return MP4.box(MP4.types.stbl, MP4.stsd(track), MP4.box(MP4.types.stts, MP4.STTS), MP4.box(MP4.types.stsc, MP4.STSC), MP4.box(MP4.types.stsz, MP4.STSZ), MP4.box(MP4.types.stco, MP4.STCO));
  }
  static avc1(track) {
    let sps = [];
    let pps = [];
    let i;
    let data;
    let len;
    // assemble the SPSs

    for (i = 0; i < track.sps.length; i++) {
      data = track.sps[i];
      len = data.byteLength;
      sps.push(len >>> 8 & 0xff);
      sps.push(len & 0xff);

      // SPS
      sps = sps.concat(Array.prototype.slice.call(data));
    }

    // assemble the PPSs
    for (i = 0; i < track.pps.length; i++) {
      data = track.pps[i];
      len = data.byteLength;
      pps.push(len >>> 8 & 0xff);
      pps.push(len & 0xff);
      pps = pps.concat(Array.prototype.slice.call(data));
    }
    const avcc = MP4.box(MP4.types.avcC, new Uint8Array([0x01,
    // version
    sps[3],
    // profile
    sps[4],
    // profile compat
    sps[5],
    // level
    0xfc | 3,
    // lengthSizeMinusOne, hard-coded to 4 bytes
    0xe0 | track.sps.length // 3bit reserved (111) + numOfSequenceParameterSets
    ].concat(sps).concat([track.pps.length // numOfPictureParameterSets
    ]).concat(pps))); // "PPS"
    const width = track.width;
    const height = track.height;
    const hSpacing = track.pixelRatio[0];
    const vSpacing = track.pixelRatio[1];
    return MP4.box(MP4.types.avc1, new Uint8Array([0x00, 0x00, 0x00,
    // reserved
    0x00, 0x00, 0x00,
    // reserved
    0x00, 0x01,
    // data_reference_index
    0x00, 0x00,
    // pre_defined
    0x00, 0x00,
    // reserved
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    // pre_defined
    width >> 8 & 0xff, width & 0xff,
    // width
    height >> 8 & 0xff, height & 0xff,
    // height
    0x00, 0x48, 0x00, 0x00,
    // horizresolution
    0x00, 0x48, 0x00, 0x00,
    // vertresolution
    0x00, 0x00, 0x00, 0x00,
    // reserved
    0x00, 0x01,
    // frame_count
    0x12, 0x64, 0x61, 0x69, 0x6c,
    // dailymotion/hls.js
    0x79, 0x6d, 0x6f, 0x74, 0x69, 0x6f, 0x6e, 0x2f, 0x68, 0x6c, 0x73, 0x2e, 0x6a, 0x73, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    // compressorname
    0x00, 0x18,
    // depth = 24
    0x11, 0x11]),
    // pre_defined = -1
    avcc, MP4.box(MP4.types.btrt, new Uint8Array([0x00, 0x1c, 0x9c, 0x80,
    // bufferSizeDB
    0x00, 0x2d, 0xc6, 0xc0,
    // maxBitrate
    0x00, 0x2d, 0xc6, 0xc0])),
    // avgBitrate
    MP4.box(MP4.types.pasp, new Uint8Array([hSpacing >> 24,
    // hSpacing
    hSpacing >> 16 & 0xff, hSpacing >> 8 & 0xff, hSpacing & 0xff, vSpacing >> 24,
    // vSpacing
    vSpacing >> 16 & 0xff, vSpacing >> 8 & 0xff, vSpacing & 0xff])));
  }
  static esds(track) {
    const configlen = track.config.length;
    return new Uint8Array([0x00,
    // version 0
    0x00, 0x00, 0x00,
    // flags

    0x03,
    // descriptor_type
    0x17 + configlen,
    // length
    0x00, 0x01,
    // es_id
    0x00,
    // stream_priority

    0x04,
    // descriptor_type
    0x0f + configlen,
    // length
    0x40,
    // codec : mpeg4_audio
    0x15,
    // stream_type
    0x00, 0x00, 0x00,
    // buffer_size
    0x00, 0x00, 0x00, 0x00,
    // maxBitrate
    0x00, 0x00, 0x00, 0x00,
    // avgBitrate

    0x05 // descriptor_type
    ].concat([configlen]).concat(track.config).concat([0x06, 0x01, 0x02])); // GASpecificConfig)); // length + audio config descriptor
  }

  static mp4a(track) {
    const samplerate = track.samplerate;
    return MP4.box(MP4.types.mp4a, new Uint8Array([0x00, 0x00, 0x00,
    // reserved
    0x00, 0x00, 0x00,
    // reserved
    0x00, 0x01,
    // data_reference_index
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    // reserved
    0x00, track.channelCount,
    // channelcount
    0x00, 0x10,
    // sampleSize:16bits
    0x00, 0x00, 0x00, 0x00,
    // reserved2
    samplerate >> 8 & 0xff, samplerate & 0xff,
    //
    0x00, 0x00]), MP4.box(MP4.types.esds, MP4.esds(track)));
  }
  static mp3(track) {
    const samplerate = track.samplerate;
    return MP4.box(MP4.types['.mp3'], new Uint8Array([0x00, 0x00, 0x00,
    // reserved
    0x00, 0x00, 0x00,
    // reserved
    0x00, 0x01,
    // data_reference_index
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    // reserved
    0x00, track.channelCount,
    // channelcount
    0x00, 0x10,
    // sampleSize:16bits
    0x00, 0x00, 0x00, 0x00,
    // reserved2
    samplerate >> 8 & 0xff, samplerate & 0xff,
    //
    0x00, 0x00]));
  }
  static stsd(track) {
    if (track.type === 'audio') {
      if (track.segmentCodec === 'mp3' && track.codec === 'mp3') {
        return MP4.box(MP4.types.stsd, MP4.STSD, MP4.mp3(track));
      }
      return MP4.box(MP4.types.stsd, MP4.STSD, MP4.mp4a(track));
    } else {
      return MP4.box(MP4.types.stsd, MP4.STSD, MP4.avc1(track));
    }
  }
  static tkhd(track) {
    const id = track.id;
    const duration = track.duration * track.timescale;
    const width = track.width;
    const height = track.height;
    const upperWordDuration = Math.floor(duration / (UINT32_MAX + 1));
    const lowerWordDuration = Math.floor(duration % (UINT32_MAX + 1));
    return MP4.box(MP4.types.tkhd, new Uint8Array([0x01,
    // version 1
    0x00, 0x00, 0x07,
    // flags
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02,
    // creation_time
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03,
    // modification_time
    id >> 24 & 0xff, id >> 16 & 0xff, id >> 8 & 0xff, id & 0xff,
    // track_ID
    0x00, 0x00, 0x00, 0x00,
    // reserved
    upperWordDuration >> 24, upperWordDuration >> 16 & 0xff, upperWordDuration >> 8 & 0xff, upperWordDuration & 0xff, lowerWordDuration >> 24, lowerWordDuration >> 16 & 0xff, lowerWordDuration >> 8 & 0xff, lowerWordDuration & 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    // reserved
    0x00, 0x00,
    // layer
    0x00, 0x00,
    // alternate_group
    0x00, 0x00,
    // non-audio track volume
    0x00, 0x00,
    // reserved
    0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x00, 0x00, 0x00,
    // transformation: unity matrix
    width >> 8 & 0xff, width & 0xff, 0x00, 0x00,
    // width
    height >> 8 & 0xff, height & 0xff, 0x00, 0x00 // height
    ]));
  }

  static traf(track, baseMediaDecodeTime) {
    const sampleDependencyTable = MP4.sdtp(track);
    const id = track.id;
    const upperWordBaseMediaDecodeTime = Math.floor(baseMediaDecodeTime / (UINT32_MAX + 1));
    const lowerWordBaseMediaDecodeTime = Math.floor(baseMediaDecodeTime % (UINT32_MAX + 1));
    return MP4.box(MP4.types.traf, MP4.box(MP4.types.tfhd, new Uint8Array([0x00,
    // version 0
    0x00, 0x00, 0x00,
    // flags
    id >> 24, id >> 16 & 0xff, id >> 8 & 0xff, id & 0xff // track_ID
    ])), MP4.box(MP4.types.tfdt, new Uint8Array([0x01,
    // version 1
    0x00, 0x00, 0x00,
    // flags
    upperWordBaseMediaDecodeTime >> 24, upperWordBaseMediaDecodeTime >> 16 & 0xff, upperWordBaseMediaDecodeTime >> 8 & 0xff, upperWordBaseMediaDecodeTime & 0xff, lowerWordBaseMediaDecodeTime >> 24, lowerWordBaseMediaDecodeTime >> 16 & 0xff, lowerWordBaseMediaDecodeTime >> 8 & 0xff, lowerWordBaseMediaDecodeTime & 0xff])), MP4.trun(track, sampleDependencyTable.length + 16 +
    // tfhd
    20 +
    // tfdt
    8 +
    // traf header
    16 +
    // mfhd
    8 +
    // moof header
    8),
    // mdat header
    sampleDependencyTable);
  }

  /**
   * Generate a track box.
   * @param track a track definition
   */
  static trak(track) {
    track.duration = track.duration || 0xffffffff;
    return MP4.box(MP4.types.trak, MP4.tkhd(track), MP4.mdia(track));
  }
  static trex(track) {
    const id = track.id;
    return MP4.box(MP4.types.trex, new Uint8Array([0x00,
    // version 0
    0x00, 0x00, 0x00,
    // flags
    id >> 24, id >> 16 & 0xff, id >> 8 & 0xff, id & 0xff,
    // track_ID
    0x00, 0x00, 0x00, 0x01,
    // default_sample_description_index
    0x00, 0x00, 0x00, 0x00,
    // default_sample_duration
    0x00, 0x00, 0x00, 0x00,
    // default_sample_size
    0x00, 0x01, 0x00, 0x01 // default_sample_flags
    ]));
  }

  static trun(track, offset) {
    const samples = track.samples || [];
    const len = samples.length;
    const arraylen = 12 + 16 * len;
    const array = new Uint8Array(arraylen);
    let i;
    let sample;
    let duration;
    let size;
    let flags;
    let cts;
    offset += 8 + arraylen;
    array.set([track.type === 'video' ? 0x01 : 0x00,
    // version 1 for video with signed-int sample_composition_time_offset
    0x00, 0x0f, 0x01,
    // flags
    len >>> 24 & 0xff, len >>> 16 & 0xff, len >>> 8 & 0xff, len & 0xff,
    // sample_count
    offset >>> 24 & 0xff, offset >>> 16 & 0xff, offset >>> 8 & 0xff, offset & 0xff // data_offset
    ], 0);
    for (i = 0; i < len; i++) {
      sample = samples[i];
      duration = sample.duration;
      size = sample.size;
      flags = sample.flags;
      cts = sample.cts;
      array.set([duration >>> 24 & 0xff, duration >>> 16 & 0xff, duration >>> 8 & 0xff, duration & 0xff,
      // sample_duration
      size >>> 24 & 0xff, size >>> 16 & 0xff, size >>> 8 & 0xff, size & 0xff,
      // sample_size
      flags.isLeading << 2 | flags.dependsOn, flags.isDependedOn << 6 | flags.hasRedundancy << 4 | flags.paddingValue << 1 | flags.isNonSync, flags.degradPrio & 0xf0 << 8, flags.degradPrio & 0x0f,
      // sample_flags
      cts >>> 24 & 0xff, cts >>> 16 & 0xff, cts >>> 8 & 0xff, cts & 0xff // sample_composition_time_offset
      ], 12 + 16 * i);
    }
    return MP4.box(MP4.types.trun, array);
  }
  static initSegment(tracks) {
    if (!MP4.types) {
      MP4.init();
    }
    const movie = MP4.moov(tracks);
    const result = new Uint8Array(MP4.FTYP.byteLength + movie.byteLength);
    result.set(MP4.FTYP);
    result.set(movie, MP4.FTYP.byteLength);
    return result;
  }
}
MP4.types = void 0;
MP4.HDLR_TYPES = void 0;
MP4.STTS = void 0;
MP4.STSC = void 0;
MP4.STCO = void 0;
MP4.STSZ = void 0;
MP4.VMHD = void 0;
MP4.SMHD = void 0;
MP4.STSD = void 0;
MP4.FTYP = void 0;
MP4.DINF = void 0;

const MPEG_TS_CLOCK_FREQ_HZ = 90000;
function toTimescaleFromBase(baseTime, destScale, srcBase = 1, round = false) {
  const result = baseTime * destScale * srcBase; // equivalent to `(value * scale) / (1 / base)`
  return round ? Math.round(result) : result;
}
function toMsFromMpegTsClock(baseTime, round = false) {
  return toTimescaleFromBase(baseTime, 1000, 1 / MPEG_TS_CLOCK_FREQ_HZ, round);
}

const MAX_SILENT_FRAME_DURATION = 10 * 1000; // 10 seconds
const AAC_SAMPLES_PER_FRAME = 1024;
const MPEG_AUDIO_SAMPLE_PER_FRAME = 1152;
let chromeVersion = null;
let safariWebkitVersion = null;
class MP4Remuxer {
  constructor(observer, config, typeSupported, vendor = '') {
    this.observer = void 0;
    this.config = void 0;
    this.typeSupported = void 0;
    this.ISGenerated = false;
    this._initPTS = null;
    this._initDTS = null;
    this.nextAvcDts = null;
    this.nextAudioPts = null;
    this.videoSampleDuration = null;
    this.isAudioContiguous = false;
    this.isVideoContiguous = false;
    this.observer = observer;
    this.config = config;
    this.typeSupported = typeSupported;
    this.ISGenerated = false;
    if (chromeVersion === null) {
      const userAgent = navigator.userAgent || '';
      const result = userAgent.match(/Chrome\/(\d+)/i);
      chromeVersion = result ? parseInt(result[1]) : 0;
    }
    if (safariWebkitVersion === null) {
      const result = navigator.userAgent.match(/Safari\/(\d+)/i);
      safariWebkitVersion = result ? parseInt(result[1]) : 0;
    }
  }
  destroy() {}
  resetTimeStamp(defaultTimeStamp) {
    logger.log('[mp4-remuxer]: initPTS & initDTS reset');
    this._initPTS = this._initDTS = defaultTimeStamp;
  }
  resetNextTimestamp() {
    logger.log('[mp4-remuxer]: reset next timestamp');
    this.isVideoContiguous = false;
    this.isAudioContiguous = false;
  }
  resetInitSegment() {
    logger.log('[mp4-remuxer]: ISGenerated flag reset');
    this.ISGenerated = false;
  }
  getVideoStartPts(videoSamples) {
    let rolloverDetected = false;
    const startPTS = videoSamples.reduce((minPTS, sample) => {
      const delta = sample.pts - minPTS;
      if (delta < -4294967296) {
        // 2^32, see PTSNormalize for reasoning, but we're hitting a rollover here, and we don't want that to impact the timeOffset calculation
        rolloverDetected = true;
        return normalizePts(minPTS, sample.pts);
      } else if (delta > 0) {
        return minPTS;
      } else {
        return sample.pts;
      }
    }, videoSamples[0].pts);
    if (rolloverDetected) {
      logger.debug('PTS rollover detected');
    }
    return startPTS;
  }
  remux(audioTrack, videoTrack, id3Track, textTrack, timeOffset, accurateTimeOffset, flush, playlistType) {
    let video;
    let audio;
    let initSegment;
    let text;
    let id3;
    let independent;
    let audioTimeOffset = timeOffset;
    let videoTimeOffset = timeOffset;

    // If we're remuxing audio and video progressively, wait until we've received enough samples for each track before proceeding.
    // This is done to synchronize the audio and video streams. We know if the current segment will have samples if the "pid"
    // parameter is greater than -1. The pid is set when the PMT is parsed, which contains the tracks list.
    // However, if the initSegment has already been generated, or we've reached the end of a segment (flush),
    // then we can remux one track without waiting for the other.
    const hasAudio = audioTrack.pid > -1;
    const hasVideo = videoTrack.pid > -1;
    const length = videoTrack.samples.length;
    const enoughAudioSamples = audioTrack.samples.length > 0;
    const enoughVideoSamples = flush && length > 0 || length > 1;
    const canRemuxAvc = (!hasAudio || enoughAudioSamples) && (!hasVideo || enoughVideoSamples) || this.ISGenerated || flush;
    if (canRemuxAvc) {
      if (!this.ISGenerated) {
        initSegment = this.generateIS(audioTrack, videoTrack, timeOffset, accurateTimeOffset);
      }
      const isVideoContiguous = this.isVideoContiguous;
      let firstKeyFrameIndex = -1;
      let firstKeyFramePTS;
      if (enoughVideoSamples) {
        firstKeyFrameIndex = findKeyframeIndex(videoTrack.samples);
        if (!isVideoContiguous && this.config.forceKeyFrameOnDiscontinuity) {
          independent = true;
          if (firstKeyFrameIndex > 0) {
            logger.warn(`[mp4-remuxer]: Dropped ${firstKeyFrameIndex} out of ${length} video samples due to a missing keyframe`);
            const startPTS = this.getVideoStartPts(videoTrack.samples);
            videoTrack.samples = videoTrack.samples.slice(firstKeyFrameIndex);
            videoTrack.dropped += firstKeyFrameIndex;
            videoTimeOffset += (videoTrack.samples[0].pts - startPTS) / videoTrack.inputTimeScale;
            firstKeyFramePTS = videoTimeOffset;
          } else if (firstKeyFrameIndex === -1) {
            logger.warn(`[mp4-remuxer]: No keyframe found out of ${length} video samples`);
            independent = false;
          }
        }
      }
      if (this.ISGenerated) {
        if (enoughAudioSamples && enoughVideoSamples) {
          // timeOffset is expected to be the offset of the first timestamp of this fragment (first DTS)
          // if first audio DTS is not aligned with first video DTS then we need to take that into account
          // when providing timeOffset to remuxAudio / remuxVideo. if we don't do that, there might be a permanent / small
          // drift between audio and video streams
          const startPTS = this.getVideoStartPts(videoTrack.samples);
          const tsDelta = normalizePts(audioTrack.samples[0].pts, startPTS) - startPTS;
          const audiovideoTimestampDelta = tsDelta / videoTrack.inputTimeScale;
          audioTimeOffset += Math.max(0, audiovideoTimestampDelta);
          videoTimeOffset += Math.max(0, -audiovideoTimestampDelta);
        }

        // Purposefully remuxing audio before video, so that remuxVideo can use nextAudioPts, which is calculated in remuxAudio.
        if (enoughAudioSamples) {
          // if initSegment was generated without audio samples, regenerate it again
          if (!audioTrack.samplerate) {
            logger.warn('[mp4-remuxer]: regenerate InitSegment as audio detected');
            initSegment = this.generateIS(audioTrack, videoTrack, timeOffset, accurateTimeOffset);
          }
          audio = this.remuxAudio(audioTrack, audioTimeOffset, this.isAudioContiguous, accurateTimeOffset, hasVideo || enoughVideoSamples || playlistType === PlaylistLevelType.AUDIO ? videoTimeOffset : undefined);
          if (enoughVideoSamples) {
            const audioTrackLength = audio ? audio.endPTS - audio.startPTS : 0;
            // if initSegment was generated without video samples, regenerate it again
            if (!videoTrack.inputTimeScale) {
              logger.warn('[mp4-remuxer]: regenerate InitSegment as video detected');
              initSegment = this.generateIS(audioTrack, videoTrack, timeOffset, accurateTimeOffset);
            }
            video = this.remuxVideo(videoTrack, videoTimeOffset, isVideoContiguous, audioTrackLength);
          }
        } else if (enoughVideoSamples) {
          video = this.remuxVideo(videoTrack, videoTimeOffset, isVideoContiguous, 0);
        }
        if (video) {
          video.firstKeyFrame = firstKeyFrameIndex;
          video.independent = firstKeyFrameIndex !== -1;
          video.firstKeyFramePTS = firstKeyFramePTS;
        }
      }
    }

    // Allow ID3 and text to remux, even if more audio/video samples are required
    if (this.ISGenerated && this._initPTS && this._initDTS) {
      if (id3Track.samples.length) {
        id3 = flushTextTrackMetadataCueSamples(id3Track, timeOffset, this._initPTS, this._initDTS);
      }
      if (textTrack.samples.length) {
        text = flushTextTrackUserdataCueSamples(textTrack, timeOffset, this._initPTS);
      }
    }
    return {
      audio,
      video,
      initSegment,
      independent,
      text,
      id3
    };
  }
  generateIS(audioTrack, videoTrack, timeOffset, accurateTimeOffset) {
    const audioSamples = audioTrack.samples;
    const videoSamples = videoTrack.samples;
    const typeSupported = this.typeSupported;
    const tracks = {};
    const _initPTS = this._initPTS;
    let computePTSDTS = !_initPTS || accurateTimeOffset;
    let container = 'audio/mp4';
    let initPTS;
    let initDTS;
    let timescale;
    if (computePTSDTS) {
      initPTS = initDTS = Infinity;
    }
    if (audioTrack.config && audioSamples.length) {
      // let's use audio sampling rate as MP4 time scale.
      // rationale is that there is a integer nb of audio frames per audio sample (1024 for AAC)
      // using audio sampling rate here helps having an integer MP4 frame duration
      // this avoids potential rounding issue and AV sync issue
      audioTrack.timescale = audioTrack.samplerate;
      switch (audioTrack.segmentCodec) {
        case 'mp3':
          if (typeSupported.mpeg) {
            // Chrome and Safari
            container = 'audio/mpeg';
            audioTrack.codec = '';
          } else if (typeSupported.mp3) {
            // Firefox
            audioTrack.codec = 'mp3';
          }
          break;
      }
      tracks.audio = {
        id: 'audio',
        container: container,
        codec: audioTrack.codec,
        initSegment: audioTrack.segmentCodec === 'mp3' && typeSupported.mpeg ? new Uint8Array(0) : MP4.initSegment([audioTrack]),
        metadata: {
          channelCount: audioTrack.channelCount
        }
      };
      if (computePTSDTS) {
        timescale = audioTrack.inputTimeScale;
        if (!_initPTS || timescale !== _initPTS.timescale) {
          // remember first PTS of this demuxing context. for audio, PTS = DTS
          initPTS = initDTS = audioSamples[0].pts - Math.round(timescale * timeOffset);
        } else {
          computePTSDTS = false;
        }
      }
    }
    if (videoTrack.sps && videoTrack.pps && videoSamples.length) {
      // let's use input time scale as MP4 video timescale
      // we use input time scale straight away to avoid rounding issues on frame duration / cts computation
      videoTrack.timescale = videoTrack.inputTimeScale;
      tracks.video = {
        id: 'main',
        container: 'video/mp4',
        codec: videoTrack.codec,
        initSegment: MP4.initSegment([videoTrack]),
        metadata: {
          width: videoTrack.width,
          height: videoTrack.height
        }
      };
      if (computePTSDTS) {
        timescale = videoTrack.inputTimeScale;
        if (!_initPTS || timescale !== _initPTS.timescale) {
          const startPTS = this.getVideoStartPts(videoSamples);
          const startOffset = Math.round(timescale * timeOffset);
          initDTS = Math.min(initDTS, normalizePts(videoSamples[0].dts, startPTS) - startOffset);
          initPTS = Math.min(initPTS, startPTS - startOffset);
        } else {
          computePTSDTS = false;
        }
      }
    }
    if (Object.keys(tracks).length) {
      this.ISGenerated = true;
      if (computePTSDTS) {
        this._initPTS = {
          baseTime: initPTS,
          timescale: timescale
        };
        this._initDTS = {
          baseTime: initDTS,
          timescale: timescale
        };
      } else {
        initPTS = timescale = undefined;
      }
      return {
        tracks,
        initPTS,
        timescale
      };
    }
  }
  remuxVideo(track, timeOffset, contiguous, audioTrackLength) {
    const timeScale = track.inputTimeScale;
    const inputSamples = track.samples;
    const outputSamples = [];
    const nbSamples = inputSamples.length;
    const initPTS = this._initPTS;
    let nextAvcDts = this.nextAvcDts;
    let offset = 8;
    let mp4SampleDuration = this.videoSampleDuration;
    let firstDTS;
    let lastDTS;
    let minPTS = Number.POSITIVE_INFINITY;
    let maxPTS = Number.NEGATIVE_INFINITY;
    let sortSamples = false;

    // if parsed fragment is contiguous with last one, let's use last DTS value as reference
    if (!contiguous || nextAvcDts === null) {
      const pts = timeOffset * timeScale;
      const cts = inputSamples[0].pts - normalizePts(inputSamples[0].dts, inputSamples[0].pts);
      // if not contiguous, let's use target timeOffset
      nextAvcDts = pts - cts;
    }

    // PTS is coded on 33bits, and can loop from -2^32 to 2^32
    // PTSNormalize will make PTS/DTS value monotonic, we use last known DTS value as reference value
    const initTime = initPTS.baseTime * timeScale / initPTS.timescale;
    for (let i = 0; i < nbSamples; i++) {
      const sample = inputSamples[i];
      sample.pts = normalizePts(sample.pts - initTime, nextAvcDts);
      sample.dts = normalizePts(sample.dts - initTime, nextAvcDts);
      if (sample.dts < inputSamples[i > 0 ? i - 1 : i].dts) {
        sortSamples = true;
      }
    }

    // sort video samples by DTS then PTS then demux id order
    if (sortSamples) {
      inputSamples.sort(function (a, b) {
        const deltadts = a.dts - b.dts;
        const deltapts = a.pts - b.pts;
        return deltadts || deltapts;
      });
    }

    // Get first/last DTS
    firstDTS = inputSamples[0].dts;
    lastDTS = inputSamples[inputSamples.length - 1].dts;

    // Sample duration (as expected by trun MP4 boxes), should be the delta between sample DTS
    // set this constant duration as being the avg delta between consecutive DTS.
    const inputDuration = lastDTS - firstDTS;
    const averageSampleDuration = inputDuration ? Math.round(inputDuration / (nbSamples - 1)) : mp4SampleDuration || track.inputTimeScale / 30;

    // if fragment are contiguous, detect hole/overlapping between fragments
    if (contiguous) {
      // check timestamp continuity across consecutive fragments (this is to remove inter-fragment gap/hole)
      const delta = firstDTS - nextAvcDts;
      const foundHole = delta > averageSampleDuration;
      const foundOverlap = delta < -1;
      if (foundHole || foundOverlap) {
        if (foundHole) {
          logger.warn(`AVC: ${toMsFromMpegTsClock(delta, true)} ms (${delta}dts) hole between fragments detected, filling it`);
        } else {
          logger.warn(`AVC: ${toMsFromMpegTsClock(-delta, true)} ms (${delta}dts) overlapping between fragments detected`);
        }
        if (!foundOverlap || nextAvcDts >= inputSamples[0].pts) {
          firstDTS = nextAvcDts;
          const firstPTS = inputSamples[0].pts - delta;
          inputSamples[0].dts = firstDTS;
          inputSamples[0].pts = firstPTS;
          logger.log(`Video: First PTS/DTS adjusted: ${toMsFromMpegTsClock(firstPTS, true)}/${toMsFromMpegTsClock(firstDTS, true)}, delta: ${toMsFromMpegTsClock(delta, true)} ms`);
        }
      }
    }
    firstDTS = Math.max(0, firstDTS);
    let nbNalu = 0;
    let naluLen = 0;
    for (let i = 0; i < nbSamples; i++) {
      // compute total/avc sample length and nb of NAL units
      const sample = inputSamples[i];
      const units = sample.units;
      const nbUnits = units.length;
      let sampleLen = 0;
      for (let j = 0; j < nbUnits; j++) {
        sampleLen += units[j].data.length;
      }
      naluLen += sampleLen;
      nbNalu += nbUnits;
      sample.length = sampleLen;

      // ensure sample monotonic DTS
      sample.dts = Math.max(sample.dts, firstDTS);
      minPTS = Math.min(sample.pts, minPTS);
      maxPTS = Math.max(sample.pts, maxPTS);
    }
    lastDTS = inputSamples[nbSamples - 1].dts;

    /* concatenate the video data and construct the mdat in place
      (need 8 more bytes to fill length and mpdat type) */
    const mdatSize = naluLen + 4 * nbNalu + 8;
    let mdat;
    try {
      mdat = new Uint8Array(mdatSize);
    } catch (err) {
      this.observer.emit(Events.ERROR, Events.ERROR, {
        type: ErrorTypes.MUX_ERROR,
        details: ErrorDetails.REMUX_ALLOC_ERROR,
        fatal: false,
        error: err,
        bytes: mdatSize,
        reason: `fail allocating video mdat ${mdatSize}`
      });
      return;
    }
    const view = new DataView(mdat.buffer);
    view.setUint32(0, mdatSize);
    mdat.set(MP4.types.mdat, 4);
    let stretchedLastFrame = false;
    let minDtsDelta = Number.POSITIVE_INFINITY;
    let minPtsDelta = Number.POSITIVE_INFINITY;
    let maxDtsDelta = Number.NEGATIVE_INFINITY;
    let maxPtsDelta = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < nbSamples; i++) {
      const avcSample = inputSamples[i];
      const avcSampleUnits = avcSample.units;
      let mp4SampleLength = 0;
      // convert NALU bitstream to MP4 format (prepend NALU with size field)
      for (let j = 0, nbUnits = avcSampleUnits.length; j < nbUnits; j++) {
        const unit = avcSampleUnits[j];
        const unitData = unit.data;
        const unitDataLen = unit.data.byteLength;
        view.setUint32(offset, unitDataLen);
        offset += 4;
        mdat.set(unitData, offset);
        offset += unitDataLen;
        mp4SampleLength += 4 + unitDataLen;
      }

      // expected sample duration is the Decoding Timestamp diff of consecutive samples
      let ptsDelta;
      if (i < nbSamples - 1) {
        mp4SampleDuration = inputSamples[i + 1].dts - avcSample.dts;
        ptsDelta = inputSamples[i + 1].pts - avcSample.pts;
      } else {
        const config = this.config;
        const lastFrameDuration = i > 0 ? avcSample.dts - inputSamples[i - 1].dts : averageSampleDuration;
        ptsDelta = i > 0 ? avcSample.pts - inputSamples[i - 1].pts : averageSampleDuration;
        if (config.stretchShortVideoTrack && this.nextAudioPts !== null) {
          // In some cases, a segment's audio track duration may exceed the video track duration.
          // Since we've already remuxed audio, and we know how long the audio track is, we look to
          // see if the delta to the next segment is longer than maxBufferHole.
          // If so, playback would potentially get stuck, so we artificially inflate
          // the duration of the last frame to minimize any potential gap between segments.
          const gapTolerance = Math.floor(config.maxBufferHole * timeScale);
          const deltaToFrameEnd = (audioTrackLength ? minPTS + audioTrackLength * timeScale : this.nextAudioPts) - avcSample.pts;
          if (deltaToFrameEnd > gapTolerance) {
            // We subtract lastFrameDuration from deltaToFrameEnd to try to prevent any video
            // frame overlap. maxBufferHole should be >> lastFrameDuration anyway.
            mp4SampleDuration = deltaToFrameEnd - lastFrameDuration;
            if (mp4SampleDuration < 0) {
              mp4SampleDuration = lastFrameDuration;
            } else {
              stretchedLastFrame = true;
            }
            logger.log(`[mp4-remuxer]: It is approximately ${deltaToFrameEnd / 90} ms to the next segment; using duration ${mp4SampleDuration / 90} ms for the last video frame.`);
          } else {
            mp4SampleDuration = lastFrameDuration;
          }
        } else {
          mp4SampleDuration = lastFrameDuration;
        }
      }
      const compositionTimeOffset = Math.round(avcSample.pts - avcSample.dts);
      minDtsDelta = Math.min(minDtsDelta, mp4SampleDuration);
      maxDtsDelta = Math.max(maxDtsDelta, mp4SampleDuration);
      minPtsDelta = Math.min(minPtsDelta, ptsDelta);
      maxPtsDelta = Math.max(maxPtsDelta, ptsDelta);
      outputSamples.push(new Mp4Sample(avcSample.key, mp4SampleDuration, mp4SampleLength, compositionTimeOffset));
    }
    if (outputSamples.length) {
      if (chromeVersion) {
        if (chromeVersion < 70) {
          // Chrome workaround, mark first sample as being a Random Access Point (keyframe) to avoid sourcebuffer append issue
          // https://code.google.com/p/chromium/issues/detail?id=229412
          const flags = outputSamples[0].flags;
          flags.dependsOn = 2;
          flags.isNonSync = 0;
        }
      } else if (safariWebkitVersion) {
        // Fix for "CNN special report, with CC" in test-streams (Safari browser only)
        // Ignore DTS when frame durations are irregular. Safari MSE does not handle this leading to gaps.
        if (maxPtsDelta - minPtsDelta < maxDtsDelta - minDtsDelta && averageSampleDuration / maxDtsDelta < 0.025 && outputSamples[0].cts === 0) {
          logger.warn('Found irregular gaps in sample duration. Using PTS instead of DTS to determine MP4 sample duration.');
          let dts = firstDTS;
          for (let i = 0, len = outputSamples.length; i < len; i++) {
            const nextDts = dts + outputSamples[i].duration;
            const pts = dts + outputSamples[i].cts;
            if (i < len - 1) {
              const nextPts = nextDts + outputSamples[i + 1].cts;
              outputSamples[i].duration = nextPts - pts;
            } else {
              outputSamples[i].duration = i ? outputSamples[i - 1].duration : averageSampleDuration;
            }
            outputSamples[i].cts = 0;
            dts = nextDts;
          }
        }
      }
    }
    // next AVC sample DTS should be equal to last sample DTS + last sample duration (in PES timescale)
    mp4SampleDuration = stretchedLastFrame || !mp4SampleDuration ? averageSampleDuration : mp4SampleDuration;
    this.nextAvcDts = nextAvcDts = lastDTS + mp4SampleDuration;
    this.videoSampleDuration = mp4SampleDuration;
    this.isVideoContiguous = true;
    const moof = MP4.moof(track.sequenceNumber++, firstDTS, _extends({}, track, {
      samples: outputSamples
    }));
    const type = 'video';
    const data = {
      data1: moof,
      data2: mdat,
      startPTS: minPTS / timeScale,
      endPTS: (maxPTS + mp4SampleDuration) / timeScale,
      startDTS: firstDTS / timeScale,
      endDTS: nextAvcDts / timeScale,
      type,
      hasAudio: false,
      hasVideo: true,
      nb: outputSamples.length,
      dropped: track.dropped
    };
    track.samples = [];
    track.dropped = 0;
    return data;
  }
  remuxAudio(track, timeOffset, contiguous, accurateTimeOffset, videoTimeOffset) {
    const inputTimeScale = track.inputTimeScale;
    const mp4timeScale = track.samplerate ? track.samplerate : inputTimeScale;
    const scaleFactor = inputTimeScale / mp4timeScale;
    const mp4SampleDuration = track.segmentCodec === 'aac' ? AAC_SAMPLES_PER_FRAME : MPEG_AUDIO_SAMPLE_PER_FRAME;
    const inputSampleDuration = mp4SampleDuration * scaleFactor;
    const initPTS = this._initPTS;
    const rawMPEG = track.segmentCodec === 'mp3' && this.typeSupported.mpeg;
    const outputSamples = [];
    const alignedWithVideo = videoTimeOffset !== undefined;
    let inputSamples = track.samples;
    let offset = rawMPEG ? 0 : 8;
    let nextAudioPts = this.nextAudioPts || -1;

    // window.audioSamples ? window.audioSamples.push(inputSamples.map(s => s.pts)) : (window.audioSamples = [inputSamples.map(s => s.pts)]);

    // for audio samples, also consider consecutive fragments as being contiguous (even if a level switch occurs),
    // for sake of clarity:
    // consecutive fragments are frags with
    //  - less than 100ms gaps between new time offset (if accurate) and next expected PTS OR
    //  - less than 20 audio frames distance
    // contiguous fragments are consecutive fragments from same quality level (same level, new SN = old SN + 1)
    // this helps ensuring audio continuity
    // and this also avoids audio glitches/cut when switching quality, or reporting wrong duration on first audio frame
    const timeOffsetMpegTS = timeOffset * inputTimeScale;
    const initTime = initPTS.baseTime * inputTimeScale / initPTS.timescale;
    this.isAudioContiguous = contiguous = contiguous || inputSamples.length && nextAudioPts > 0 && (accurateTimeOffset && Math.abs(timeOffsetMpegTS - nextAudioPts) < 9000 || Math.abs(normalizePts(inputSamples[0].pts - initTime, timeOffsetMpegTS) - nextAudioPts) < 20 * inputSampleDuration);

    // compute normalized PTS
    inputSamples.forEach(function (sample) {
      sample.pts = normalizePts(sample.pts - initTime, timeOffsetMpegTS);
    });
    if (!contiguous || nextAudioPts < 0) {
      // filter out sample with negative PTS that are not playable anyway
      // if we don't remove these negative samples, they will shift all audio samples forward.
      // leading to audio overlap between current / next fragment
      inputSamples = inputSamples.filter(sample => sample.pts >= 0);

      // in case all samples have negative PTS, and have been filtered out, return now
      if (!inputSamples.length) {
        return;
      }
      if (videoTimeOffset === 0) {
        // Set the start to 0 to match video so that start gaps larger than inputSampleDuration are filled with silence
        nextAudioPts = 0;
      } else if (accurateTimeOffset && !alignedWithVideo) {
        // When not seeking, not live, and LevelDetails.PTSKnown, use fragment start as predicted next audio PTS
        nextAudioPts = Math.max(0, timeOffsetMpegTS);
      } else {
        // if frags are not contiguous and if we cant trust time offset, let's use first sample PTS as next audio PTS
        nextAudioPts = inputSamples[0].pts;
      }
    }

    // If the audio track is missing samples, the frames seem to get "left-shifted" within the
    // resulting mp4 segment, causing sync issues and leaving gaps at the end of the audio segment.
    // In an effort to prevent this from happening, we inject frames here where there are gaps.
    // When possible, we inject a silent frame; when that's not possible, we duplicate the last
    // frame.

    if (track.segmentCodec === 'aac') {
      const maxAudioFramesDrift = this.config.maxAudioFramesDrift;
      for (let i = 0, nextPts = nextAudioPts; i < inputSamples.length; i++) {
        // First, let's see how far off this frame is from where we expect it to be
        const sample = inputSamples[i];
        const pts = sample.pts;
        const delta = pts - nextPts;
        const duration = Math.abs(1000 * delta / inputTimeScale);

        // When remuxing with video, if we're overlapping by more than a duration, drop this sample to stay in sync
        if (delta <= -maxAudioFramesDrift * inputSampleDuration && alignedWithVideo) {
          if (i === 0) {
            logger.warn(`Audio frame @ ${(pts / inputTimeScale).toFixed(3)}s overlaps nextAudioPts by ${Math.round(1000 * delta / inputTimeScale)} ms.`);
            this.nextAudioPts = nextAudioPts = nextPts = pts;
          }
        } // eslint-disable-line brace-style

        // Insert missing frames if:
        // 1: We're more than maxAudioFramesDrift frame away
        // 2: Not more than MAX_SILENT_FRAME_DURATION away
        // 3: currentTime (aka nextPtsNorm) is not 0
        // 4: remuxing with video (videoTimeOffset !== undefined)
        else if (delta >= maxAudioFramesDrift * inputSampleDuration && duration < MAX_SILENT_FRAME_DURATION && alignedWithVideo) {
          let missing = Math.round(delta / inputSampleDuration);
          // Adjust nextPts so that silent samples are aligned with media pts. This will prevent media samples from
          // later being shifted if nextPts is based on timeOffset and delta is not a multiple of inputSampleDuration.
          nextPts = pts - missing * inputSampleDuration;
          if (nextPts < 0) {
            missing--;
            nextPts += inputSampleDuration;
          }
          if (i === 0) {
            this.nextAudioPts = nextAudioPts = nextPts;
          }
          logger.warn(`[mp4-remuxer]: Injecting ${missing} audio frame @ ${(nextPts / inputTimeScale).toFixed(3)}s due to ${Math.round(1000 * delta / inputTimeScale)} ms gap.`);
          for (let j = 0; j < missing; j++) {
            const newStamp = Math.max(nextPts, 0);
            let fillFrame = AAC.getSilentFrame(track.manifestCodec || track.codec, track.channelCount);
            if (!fillFrame) {
              logger.log('[mp4-remuxer]: Unable to get silent frame for given audio codec; duplicating last frame instead.');
              fillFrame = sample.unit.subarray();
            }
            inputSamples.splice(i, 0, {
              unit: fillFrame,
              pts: newStamp
            });
            nextPts += inputSampleDuration;
            i++;
          }
        }
        sample.pts = nextPts;
        nextPts += inputSampleDuration;
      }
    }
    let firstPTS = null;
    let lastPTS = null;
    let mdat;
    let mdatSize = 0;
    let sampleLength = inputSamples.length;
    while (sampleLength--) {
      mdatSize += inputSamples[sampleLength].unit.byteLength;
    }
    for (let j = 0, _nbSamples = inputSamples.length; j < _nbSamples; j++) {
      const audioSample = inputSamples[j];
      const unit = audioSample.unit;
      let pts = audioSample.pts;
      if (lastPTS !== null) {
        // If we have more than one sample, set the duration of the sample to the "real" duration; the PTS diff with
        // the previous sample
        const prevSample = outputSamples[j - 1];
        prevSample.duration = Math.round((pts - lastPTS) / scaleFactor);
      } else {
        if (contiguous && track.segmentCodec === 'aac') {
          // set PTS/DTS to expected PTS/DTS
          pts = nextAudioPts;
        }
        // remember first PTS of our audioSamples
        firstPTS = pts;
        if (mdatSize > 0) {
          /* concatenate the audio data and construct the mdat in place
            (need 8 more bytes to fill length and mdat type) */
          mdatSize += offset;
          try {
            mdat = new Uint8Array(mdatSize);
          } catch (err) {
            this.observer.emit(Events.ERROR, Events.ERROR, {
              type: ErrorTypes.MUX_ERROR,
              details: ErrorDetails.REMUX_ALLOC_ERROR,
              fatal: false,
              error: err,
              bytes: mdatSize,
              reason: `fail allocating audio mdat ${mdatSize}`
            });
            return;
          }
          if (!rawMPEG) {
            const view = new DataView(mdat.buffer);
            view.setUint32(0, mdatSize);
            mdat.set(MP4.types.mdat, 4);
          }
        } else {
          // no audio samples
          return;
        }
      }
      mdat.set(unit, offset);
      const unitLen = unit.byteLength;
      offset += unitLen;
      // Default the sample's duration to the computed mp4SampleDuration, which will either be 1024 for AAC or 1152 for MPEG
      // In the case that we have 1 sample, this will be the duration. If we have more than one sample, the duration
      // becomes the PTS diff with the previous sample
      outputSamples.push(new Mp4Sample(true, mp4SampleDuration, unitLen, 0));
      lastPTS = pts;
    }

    // We could end up with no audio samples if all input samples were overlapping with the previously remuxed ones
    const nbSamples = outputSamples.length;
    if (!nbSamples) {
      return;
    }

    // The next audio sample PTS should be equal to last sample PTS + duration
    const lastSample = outputSamples[outputSamples.length - 1];
    this.nextAudioPts = nextAudioPts = lastPTS + scaleFactor * lastSample.duration;

    // Set the track samples from inputSamples to outputSamples before remuxing
    const moof = rawMPEG ? new Uint8Array(0) : MP4.moof(track.sequenceNumber++, firstPTS / scaleFactor, _extends({}, track, {
      samples: outputSamples
    }));

    // Clear the track samples. This also clears the samples array in the demuxer, since the reference is shared
    track.samples = [];
    const start = firstPTS / inputTimeScale;
    const end = nextAudioPts / inputTimeScale;
    const type = 'audio';
    const audioData = {
      data1: moof,
      data2: mdat,
      startPTS: start,
      endPTS: end,
      startDTS: start,
      endDTS: end,
      type,
      hasAudio: true,
      hasVideo: false,
      nb: nbSamples
    };
    this.isAudioContiguous = true;
    return audioData;
  }
  remuxEmptyAudio(track, timeOffset, contiguous, videoData) {
    const inputTimeScale = track.inputTimeScale;
    const mp4timeScale = track.samplerate ? track.samplerate : inputTimeScale;
    const scaleFactor = inputTimeScale / mp4timeScale;
    const nextAudioPts = this.nextAudioPts;
    // sync with video's timestamp
    const initDTS = this._initDTS;
    const init90kHz = initDTS.baseTime * 90000 / initDTS.timescale;
    const startDTS = (nextAudioPts !== null ? nextAudioPts : videoData.startDTS * inputTimeScale) + init90kHz;
    const endDTS = videoData.endDTS * inputTimeScale + init90kHz;
    // one sample's duration value
    const frameDuration = scaleFactor * AAC_SAMPLES_PER_FRAME;
    // samples count of this segment's duration
    const nbSamples = Math.ceil((endDTS - startDTS) / frameDuration);
    // silent frame
    const silentFrame = AAC.getSilentFrame(track.manifestCodec || track.codec, track.channelCount);
    logger.warn('[mp4-remuxer]: remux empty Audio');
    // Can't remux if we can't generate a silent frame...
    if (!silentFrame) {
      logger.trace('[mp4-remuxer]: Unable to remuxEmptyAudio since we were unable to get a silent frame for given audio codec');
      return;
    }
    const samples = [];
    for (let i = 0; i < nbSamples; i++) {
      const stamp = startDTS + i * frameDuration;
      samples.push({
        unit: silentFrame,
        pts: stamp,
        dts: stamp
      });
    }
    track.samples = samples;
    return this.remuxAudio(track, timeOffset, contiguous, false);
  }
}
function normalizePts(value, reference) {
  let offset;
  if (reference === null) {
    return value;
  }
  if (reference < value) {
    // - 2^33
    offset = -8589934592;
  } else {
    // + 2^33
    offset = 8589934592;
  }
  /* PTS is 33bit (from 0 to 2^33 -1)
    if diff between value and reference is bigger than half of the amplitude (2^32) then it means that
    PTS looping occured. fill the gap */
  while (Math.abs(value - reference) > 4294967296) {
    value += offset;
  }
  return value;
}
function findKeyframeIndex(samples) {
  for (let i = 0; i < samples.length; i++) {
    if (samples[i].key) {
      return i;
    }
  }
  return -1;
}
function flushTextTrackMetadataCueSamples(track, timeOffset, initPTS, initDTS) {
  const length = track.samples.length;
  if (!length) {
    return;
  }
  const inputTimeScale = track.inputTimeScale;
  for (let index = 0; index < length; index++) {
    const sample = track.samples[index];
    // setting id3 pts, dts to relative time
    // using this._initPTS and this._initDTS to calculate relative time
    sample.pts = normalizePts(sample.pts - initPTS.baseTime * inputTimeScale / initPTS.timescale, timeOffset * inputTimeScale) / inputTimeScale;
    sample.dts = normalizePts(sample.dts - initDTS.baseTime * inputTimeScale / initDTS.timescale, timeOffset * inputTimeScale) / inputTimeScale;
  }
  const samples = track.samples;
  track.samples = [];
  return {
    samples
  };
}
function flushTextTrackUserdataCueSamples(track, timeOffset, initPTS) {
  const length = track.samples.length;
  if (!length) {
    return;
  }
  const inputTimeScale = track.inputTimeScale;
  for (let index = 0; index < length; index++) {
    const sample = track.samples[index];
    // setting text pts, dts to relative time
    // using this._initPTS and this._initDTS to calculate relative time
    sample.pts = normalizePts(sample.pts - initPTS.baseTime * inputTimeScale / initPTS.timescale, timeOffset * inputTimeScale) / inputTimeScale;
  }
  track.samples.sort((a, b) => a.pts - b.pts);
  const samples = track.samples;
  track.samples = [];
  return {
    samples
  };
}
class Mp4Sample {
  constructor(isKeyframe, duration, size, cts) {
    this.size = void 0;
    this.duration = void 0;
    this.cts = void 0;
    this.flags = void 0;
    this.duration = duration;
    this.size = size;
    this.cts = cts;
    this.flags = new Mp4SampleFlags(isKeyframe);
  }
}
class Mp4SampleFlags {
  constructor(isKeyframe) {
    this.isLeading = 0;
    this.isDependedOn = 0;
    this.hasRedundancy = 0;
    this.degradPrio = 0;
    this.dependsOn = 1;
    this.isNonSync = 1;
    this.dependsOn = isKeyframe ? 2 : 1;
    this.isNonSync = isKeyframe ? 0 : 1;
  }
}

let now;
// performance.now() not available on WebWorker, at least on Safari Desktop
try {
  now = self.performance.now.bind(self.performance);
} catch (err) {
  logger.debug('Unable to use Performance API on this environment');
  now = typeof self !== 'undefined' && self.Date.now;
}
const muxConfig = [
// { demux: MP4Demuxer, remux: PassThroughRemuxer },
// { demux: TSDemuxer, remux: MP4Remuxer },
// { demux: AACDemuxer, remux: MP4Remuxer },
{
  demux: MP3Demuxer,
  remux: MP4Remuxer
}];
class Transmuxer {
  constructor(observer, typeSupported, config, vendor, id) {
    this.async = false;
    this.observer = void 0;
    this.typeSupported = void 0;
    this.config = void 0;
    this.vendor = void 0;
    this.id = void 0;
    this.demuxer = void 0;
    this.remuxer = void 0;
    this.decrypter = void 0;
    this.probe = void 0;
    this.decryptionPromise = null;
    this.transmuxConfig = void 0;
    this.currentTransmuxState = void 0;
    this.observer = observer;
    this.typeSupported = typeSupported;
    this.config = config;
    this.vendor = vendor;
    this.id = id;
  }
  configure(transmuxConfig) {
    this.transmuxConfig = transmuxConfig;
    if (this.decrypter) {
      this.decrypter.reset();
    }
  }
  push(data, decryptdata, chunkMeta, state) {
    const stats = chunkMeta.transmuxing;
    stats.executeStart = now();
    let uintData = new Uint8Array(data);
    const {
      currentTransmuxState,
      transmuxConfig
    } = this;
    if (state) {
      this.currentTransmuxState = state;
    }
    const {
      contiguous,
      discontinuity,
      trackSwitch,
      accurateTimeOffset,
      timeOffset,
      initSegmentChange
    } = state || currentTransmuxState;
    const {
      audioCodec,
      videoCodec,
      defaultInitPts,
      duration,
      initSegmentData
    } = transmuxConfig;
    const keyData = getEncryptionType(uintData, decryptdata);
    if (keyData && keyData.method === 'AES-128') {
      const decrypter = this.getDecrypter();
      // Software decryption is synchronous; webCrypto is not
      if (decrypter.isSync()) {
        // Software decryption is progressive. Progressive decryption may not return a result on each call. Any cached
        // data is handled in the flush() call
        let decryptedData = decrypter.softwareDecrypt(uintData, keyData.key.buffer, keyData.iv.buffer);
        // For Low-Latency HLS Parts, decrypt in place, since part parsing is expected on push progress
        const loadingParts = chunkMeta.part > -1;
        if (loadingParts) {
          decryptedData = decrypter.flush();
        }
        if (!decryptedData) {
          stats.executeEnd = now();
          return emptyResult(chunkMeta);
        }
        uintData = new Uint8Array(decryptedData);
      } else {
        this.decryptionPromise = decrypter.webCryptoDecrypt(uintData, keyData.key.buffer, keyData.iv.buffer).then(decryptedData => {
          // Calling push here is important; if flush() is called while this is still resolving, this ensures that
          // the decrypted data has been transmuxed
          const result = this.push(decryptedData, null, chunkMeta);
          this.decryptionPromise = null;
          return result;
        });
        return this.decryptionPromise;
      }
    }
    const resetMuxers = this.needsProbing(discontinuity, trackSwitch);
    if (resetMuxers) {
      const error = this.configureTransmuxer(uintData);
      if (error) {
        logger.warn(`[transmuxer] ${error.message}`);
        this.observer.emit(Events.ERROR, Events.ERROR, {
          type: ErrorTypes.MEDIA_ERROR,
          details: ErrorDetails.FRAG_PARSING_ERROR,
          fatal: false,
          error,
          reason: error.message
        });
        stats.executeEnd = now();
        return emptyResult(chunkMeta);
      }
    }
    if (discontinuity || trackSwitch || initSegmentChange || resetMuxers) {
      this.resetInitSegment(initSegmentData, audioCodec, videoCodec, duration, decryptdata);
    }
    if (discontinuity || initSegmentChange || resetMuxers) {
      this.resetInitialTimestamp(defaultInitPts);
    }
    if (!contiguous) {
      this.resetContiguity();
    }
    const result = this.transmux(uintData, keyData, timeOffset, accurateTimeOffset, chunkMeta);
    const currentState = this.currentTransmuxState;
    currentState.contiguous = true;
    currentState.discontinuity = false;
    currentState.trackSwitch = false;
    stats.executeEnd = now();
    return result;
  }

  // Due to data caching, flush calls can produce more than one TransmuxerResult (hence the Array type)
  flush(chunkMeta) {
    const stats = chunkMeta.transmuxing;
    stats.executeStart = now();
    const {
      decrypter,
      currentTransmuxState,
      decryptionPromise
    } = this;
    if (decryptionPromise) {
      // Upon resolution, the decryption promise calls push() and returns its TransmuxerResult up the stack. Therefore
      // only flushing is required for async decryption
      return decryptionPromise.then(() => {
        return this.flush(chunkMeta);
      });
    }
    const transmuxResults = [];
    const {
      timeOffset
    } = currentTransmuxState;
    if (decrypter) {
      // The decrypter may have data cached, which needs to be demuxed. In this case we'll have two TransmuxResults
      // This happens in the case that we receive only 1 push call for a segment (either for non-progressive downloads,
      // or for progressive downloads with small segments)
      const decryptedData = decrypter.flush();
      if (decryptedData) {
        // Push always returns a TransmuxerResult if decryptdata is null
        transmuxResults.push(this.push(decryptedData, null, chunkMeta));
      }
    }
    const {
      demuxer,
      remuxer
    } = this;
    if (!demuxer || !remuxer) {
      // If probing failed, then Hls.js has been given content its not able to handle
      stats.executeEnd = now();
      return [emptyResult(chunkMeta)];
    }
    const demuxResultOrPromise = demuxer.flush(timeOffset);
    if (isPromise(demuxResultOrPromise)) {
      // Decrypt final SAMPLE-AES samples
      return demuxResultOrPromise.then(demuxResult => {
        this.flushRemux(transmuxResults, demuxResult, chunkMeta);
        return transmuxResults;
      });
    }
    this.flushRemux(transmuxResults, demuxResultOrPromise, chunkMeta);
    return transmuxResults;
  }
  flushRemux(transmuxResults, demuxResult, chunkMeta) {
    const {
      audioTrack,
      videoTrack,
      id3Track,
      textTrack
    } = demuxResult;
    const {
      accurateTimeOffset,
      timeOffset
    } = this.currentTransmuxState;
    logger.log(`[transmuxer.ts]: Flushed fragment ${chunkMeta.sn}${chunkMeta.part > -1 ? ' p: ' + chunkMeta.part : ''} of level ${chunkMeta.level}`);
    const remuxResult = this.remuxer.remux(audioTrack, videoTrack, id3Track, textTrack, timeOffset, accurateTimeOffset, true, this.id);
    transmuxResults.push({
      remuxResult,
      chunkMeta
    });
    chunkMeta.transmuxing.executeEnd = now();
  }
  resetInitialTimestamp(defaultInitPts) {
    const {
      demuxer,
      remuxer
    } = this;
    if (!demuxer || !remuxer) {
      return;
    }
    demuxer.resetTimeStamp(defaultInitPts);
    remuxer.resetTimeStamp(defaultInitPts);
  }
  resetContiguity() {
    const {
      demuxer,
      remuxer
    } = this;
    if (!demuxer || !remuxer) {
      return;
    }
    demuxer.resetContiguity();
    remuxer.resetNextTimestamp();
  }
  resetInitSegment(initSegmentData, audioCodec, videoCodec, trackDuration, decryptdata) {
    const {
      demuxer,
      remuxer
    } = this;
    if (!demuxer || !remuxer) {
      return;
    }
    demuxer.resetInitSegment(initSegmentData, audioCodec, videoCodec, trackDuration);
    remuxer.resetInitSegment(initSegmentData, audioCodec, videoCodec, decryptdata);
  }
  destroy() {
    if (this.demuxer) {
      this.demuxer.destroy();
      this.demuxer = undefined;
    }
    if (this.remuxer) {
      this.remuxer.destroy();
      this.remuxer = undefined;
    }
  }
  transmux(data, keyData, timeOffset, accurateTimeOffset, chunkMeta) {
    let result;
    if (keyData && keyData.method === 'SAMPLE-AES') {
      result = this.transmuxSampleAes(data, keyData, timeOffset, accurateTimeOffset, chunkMeta);
    } else {
      result = this.transmuxUnencrypted(data, timeOffset, accurateTimeOffset, chunkMeta);
    }
    return result;
  }
  transmuxUnencrypted(data, timeOffset, accurateTimeOffset, chunkMeta) {
    const {
      audioTrack,
      videoTrack,
      id3Track,
      textTrack
    } = this.demuxer.demux(data, timeOffset, false, !this.config.progressive);
    const remuxResult = this.remuxer.remux(audioTrack, videoTrack, id3Track, textTrack, timeOffset, accurateTimeOffset, false, this.id);
    return {
      remuxResult,
      chunkMeta
    };
  }
  transmuxSampleAes(data, decryptData, timeOffset, accurateTimeOffset, chunkMeta) {
    return this.demuxer.demuxSampleAes(data, decryptData, timeOffset).then(demuxResult => {
      const remuxResult = this.remuxer.remux(demuxResult.audioTrack, demuxResult.videoTrack, demuxResult.id3Track, demuxResult.textTrack, timeOffset, accurateTimeOffset, false, this.id);
      return {
        remuxResult,
        chunkMeta
      };
    });
  }
  configureTransmuxer(data) {
    const {
      config,
      observer,
      typeSupported,
      vendor
    } = this;
    // probe for content type
    let mux = null;
    for (let i = 0, len = muxConfig.length; i < len; i++) {
      if (muxConfig[i].demux.probe(data)) {
        mux = muxConfig[i];
        break;
      }
    }
    if (!mux) {
      return new Error('Failed to find demuxer by probing fragment data');
    }
    // so let's check that current remuxer and demuxer are still valid
    const demuxer = this.demuxer;
    const remuxer = this.remuxer;
    const Remuxer = mux.remux;
    const Demuxer = mux.demux;
    if (!remuxer || !(remuxer instanceof Remuxer)) {
      this.remuxer = new Remuxer(observer, config, typeSupported, vendor);
    }
    if (!demuxer || !(demuxer instanceof Demuxer)) {
      this.demuxer = new Demuxer(observer, config, typeSupported);
      this.probe = Demuxer.probe;
    }
  }
  needsProbing(discontinuity, trackSwitch) {
    // in case of continuity change, or track switch
    // we might switch from content type (AAC container to TS container, or TS to fmp4 for example)
    return !this.demuxer || !this.remuxer || discontinuity || trackSwitch;
  }
  getDecrypter() {
    let decrypter = this.decrypter;
    if (!decrypter) {
      decrypter = this.decrypter = new Decrypter(this.config);
    }
    return decrypter;
  }
}
function getEncryptionType(data, decryptData) {
  let encryptionType = null;
  if (data.byteLength > 0 && decryptData != null && decryptData.key != null && decryptData.iv !== null && decryptData.method != null) {
    encryptionType = decryptData;
  }
  return encryptionType;
}
const emptyResult = chunkMeta => ({
  remuxResult: {},
  chunkMeta
});
function isPromise(p) {
  return 'then' in p && p.then instanceof Function;
}
class TransmuxConfig {
  constructor(audioCodec, videoCodec, initSegmentData, duration, defaultInitPts) {
    this.audioCodec = void 0;
    this.videoCodec = void 0;
    this.initSegmentData = void 0;
    this.duration = void 0;
    this.defaultInitPts = void 0;
    this.audioCodec = audioCodec;
    this.videoCodec = videoCodec;
    this.initSegmentData = initSegmentData;
    this.duration = duration;
    this.defaultInitPts = defaultInitPts || null;
  }
}
class TransmuxState {
  constructor(discontinuity, contiguous, accurateTimeOffset, trackSwitch, timeOffset, initSegmentChange) {
    this.discontinuity = void 0;
    this.contiguous = void 0;
    this.accurateTimeOffset = void 0;
    this.trackSwitch = void 0;
    this.timeOffset = void 0;
    this.initSegmentChange = void 0;
    this.discontinuity = discontinuity;
    this.contiguous = contiguous;
    this.accurateTimeOffset = accurateTimeOffset;
    this.trackSwitch = trackSwitch;
    this.timeOffset = timeOffset;
    this.initSegmentChange = initSegmentChange;
  }
}

var eventemitter3 = {exports: {}};

(function (module) {

	var has = Object.prototype.hasOwnProperty
	  , prefix = '~';

	/**
	 * Constructor to create a storage for our `EE` objects.
	 * An `Events` instance is a plain object whose properties are event names.
	 *
	 * @constructor
	 * @private
	 */
	function Events() {}

	//
	// We try to not inherit from `Object.prototype`. In some engines creating an
	// instance in this way is faster than calling `Object.create(null)` directly.
	// If `Object.create(null)` is not supported we prefix the event names with a
	// character to make sure that the built-in object properties are not
	// overridden or used as an attack vector.
	//
	if (Object.create) {
	  Events.prototype = Object.create(null);

	  //
	  // This hack is needed because the `__proto__` property is still inherited in
	  // some old browsers like Android 4, iPhone 5.1, Opera 11 and Safari 5.
	  //
	  if (!new Events().__proto__) prefix = false;
	}

	/**
	 * Representation of a single event listener.
	 *
	 * @param {Function} fn The listener function.
	 * @param {*} context The context to invoke the listener with.
	 * @param {Boolean} [once=false] Specify if the listener is a one-time listener.
	 * @constructor
	 * @private
	 */
	function EE(fn, context, once) {
	  this.fn = fn;
	  this.context = context;
	  this.once = once || false;
	}

	/**
	 * Add a listener for a given event.
	 *
	 * @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
	 * @param {(String|Symbol)} event The event name.
	 * @param {Function} fn The listener function.
	 * @param {*} context The context to invoke the listener with.
	 * @param {Boolean} once Specify if the listener is a one-time listener.
	 * @returns {EventEmitter}
	 * @private
	 */
	function addListener(emitter, event, fn, context, once) {
	  if (typeof fn !== 'function') {
	    throw new TypeError('The listener must be a function');
	  }

	  var listener = new EE(fn, context || emitter, once)
	    , evt = prefix ? prefix + event : event;

	  if (!emitter._events[evt]) emitter._events[evt] = listener, emitter._eventsCount++;
	  else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
	  else emitter._events[evt] = [emitter._events[evt], listener];

	  return emitter;
	}

	/**
	 * Clear event by name.
	 *
	 * @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
	 * @param {(String|Symbol)} evt The Event name.
	 * @private
	 */
	function clearEvent(emitter, evt) {
	  if (--emitter._eventsCount === 0) emitter._events = new Events();
	  else delete emitter._events[evt];
	}

	/**
	 * Minimal `EventEmitter` interface that is molded against the Node.js
	 * `EventEmitter` interface.
	 *
	 * @constructor
	 * @public
	 */
	function EventEmitter() {
	  this._events = new Events();
	  this._eventsCount = 0;
	}

	/**
	 * Return an array listing the events for which the emitter has registered
	 * listeners.
	 *
	 * @returns {Array}
	 * @public
	 */
	EventEmitter.prototype.eventNames = function eventNames() {
	  var names = []
	    , events
	    , name;

	  if (this._eventsCount === 0) return names;

	  for (name in (events = this._events)) {
	    if (has.call(events, name)) names.push(prefix ? name.slice(1) : name);
	  }

	  if (Object.getOwnPropertySymbols) {
	    return names.concat(Object.getOwnPropertySymbols(events));
	  }

	  return names;
	};

	/**
	 * Return the listeners registered for a given event.
	 *
	 * @param {(String|Symbol)} event The event name.
	 * @returns {Array} The registered listeners.
	 * @public
	 */
	EventEmitter.prototype.listeners = function listeners(event) {
	  var evt = prefix ? prefix + event : event
	    , handlers = this._events[evt];

	  if (!handlers) return [];
	  if (handlers.fn) return [handlers.fn];

	  for (var i = 0, l = handlers.length, ee = new Array(l); i < l; i++) {
	    ee[i] = handlers[i].fn;
	  }

	  return ee;
	};

	/**
	 * Return the number of listeners listening to a given event.
	 *
	 * @param {(String|Symbol)} event The event name.
	 * @returns {Number} The number of listeners.
	 * @public
	 */
	EventEmitter.prototype.listenerCount = function listenerCount(event) {
	  var evt = prefix ? prefix + event : event
	    , listeners = this._events[evt];

	  if (!listeners) return 0;
	  if (listeners.fn) return 1;
	  return listeners.length;
	};

	/**
	 * Calls each of the listeners registered for a given event.
	 *
	 * @param {(String|Symbol)} event The event name.
	 * @returns {Boolean} `true` if the event had listeners, else `false`.
	 * @public
	 */
	EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
	  var evt = prefix ? prefix + event : event;

	  if (!this._events[evt]) return false;

	  var listeners = this._events[evt]
	    , len = arguments.length
	    , args
	    , i;

	  if (listeners.fn) {
	    if (listeners.once) this.removeListener(event, listeners.fn, undefined, true);

	    switch (len) {
	      case 1: return listeners.fn.call(listeners.context), true;
	      case 2: return listeners.fn.call(listeners.context, a1), true;
	      case 3: return listeners.fn.call(listeners.context, a1, a2), true;
	      case 4: return listeners.fn.call(listeners.context, a1, a2, a3), true;
	      case 5: return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
	      case 6: return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
	    }

	    for (i = 1, args = new Array(len -1); i < len; i++) {
	      args[i - 1] = arguments[i];
	    }

	    listeners.fn.apply(listeners.context, args);
	  } else {
	    var length = listeners.length
	      , j;

	    for (i = 0; i < length; i++) {
	      if (listeners[i].once) this.removeListener(event, listeners[i].fn, undefined, true);

	      switch (len) {
	        case 1: listeners[i].fn.call(listeners[i].context); break;
	        case 2: listeners[i].fn.call(listeners[i].context, a1); break;
	        case 3: listeners[i].fn.call(listeners[i].context, a1, a2); break;
	        case 4: listeners[i].fn.call(listeners[i].context, a1, a2, a3); break;
	        default:
	          if (!args) for (j = 1, args = new Array(len -1); j < len; j++) {
	            args[j - 1] = arguments[j];
	          }

	          listeners[i].fn.apply(listeners[i].context, args);
	      }
	    }
	  }

	  return true;
	};

	/**
	 * Add a listener for a given event.
	 *
	 * @param {(String|Symbol)} event The event name.
	 * @param {Function} fn The listener function.
	 * @param {*} [context=this] The context to invoke the listener with.
	 * @returns {EventEmitter} `this`.
	 * @public
	 */
	EventEmitter.prototype.on = function on(event, fn, context) {
	  return addListener(this, event, fn, context, false);
	};

	/**
	 * Add a one-time listener for a given event.
	 *
	 * @param {(String|Symbol)} event The event name.
	 * @param {Function} fn The listener function.
	 * @param {*} [context=this] The context to invoke the listener with.
	 * @returns {EventEmitter} `this`.
	 * @public
	 */
	EventEmitter.prototype.once = function once(event, fn, context) {
	  return addListener(this, event, fn, context, true);
	};

	/**
	 * Remove the listeners of a given event.
	 *
	 * @param {(String|Symbol)} event The event name.
	 * @param {Function} fn Only remove the listeners that match this function.
	 * @param {*} context Only remove the listeners that have this context.
	 * @param {Boolean} once Only remove one-time listeners.
	 * @returns {EventEmitter} `this`.
	 * @public
	 */
	EventEmitter.prototype.removeListener = function removeListener(event, fn, context, once) {
	  var evt = prefix ? prefix + event : event;

	  if (!this._events[evt]) return this;
	  if (!fn) {
	    clearEvent(this, evt);
	    return this;
	  }

	  var listeners = this._events[evt];

	  if (listeners.fn) {
	    if (
	      listeners.fn === fn &&
	      (!once || listeners.once) &&
	      (!context || listeners.context === context)
	    ) {
	      clearEvent(this, evt);
	    }
	  } else {
	    for (var i = 0, events = [], length = listeners.length; i < length; i++) {
	      if (
	        listeners[i].fn !== fn ||
	        (once && !listeners[i].once) ||
	        (context && listeners[i].context !== context)
	      ) {
	        events.push(listeners[i]);
	      }
	    }

	    //
	    // Reset the array, or remove it completely if we have no more listeners.
	    //
	    if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
	    else clearEvent(this, evt);
	  }

	  return this;
	};

	/**
	 * Remove all listeners, or those of the specified event.
	 *
	 * @param {(String|Symbol)} [event] The event name.
	 * @returns {EventEmitter} `this`.
	 * @public
	 */
	EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
	  var evt;

	  if (event) {
	    evt = prefix ? prefix + event : event;
	    if (this._events[evt]) clearEvent(this, evt);
	  } else {
	    this._events = new Events();
	    this._eventsCount = 0;
	  }

	  return this;
	};

	//
	// Alias methods names because people roll like that.
	//
	EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
	EventEmitter.prototype.addListener = EventEmitter.prototype.on;

	//
	// Expose the prefix.
	//
	EventEmitter.prefixed = prefix;

	//
	// Allow `EventEmitter` to be imported as module namespace.
	//
	EventEmitter.EventEmitter = EventEmitter;

	//
	// Expose the module.
	//
	{
	  module.exports = EventEmitter;
	} 
} (eventemitter3));

var eventemitter3Exports = eventemitter3.exports;
var EventEmitter = /*@__PURE__*/getDefaultExportFromCjs(eventemitter3Exports);

const MediaSource$1 = getMediaSource() || {
  isTypeSupported: () => false
};
class TransmuxerInterface {
  constructor(hls, id, onTransmuxComplete, onFlush) {
    this.error = null;
    this.hls = void 0;
    this.id = void 0;
    this.observer = void 0;
    this.frag = null;
    this.part = null;
    this.useWorker = void 0;
    this.workerContext = null;
    this.onwmsg = void 0;
    this.transmuxer = null;
    this.onTransmuxComplete = void 0;
    this.onFlush = void 0;
    const config = hls.config;
    this.hls = hls;
    this.id = id;
    this.useWorker = !!config.enableWorker;
    this.onTransmuxComplete = onTransmuxComplete;
    this.onFlush = onFlush;
    const forwardMessage = (ev, data) => {
      data = data || {};
      data.frag = this.frag;
      data.id = this.id;
      if (ev === Events.ERROR) {
        this.error = data.error;
      }
      this.hls.trigger(ev, data);
    };

    // forward events to main thread
    this.observer = new EventEmitter();
    this.observer.on(Events.FRAG_DECRYPTED, forwardMessage);
    this.observer.on(Events.ERROR, forwardMessage);
    const typeSupported = {
      mp4: MediaSource$1.isTypeSupported('video/mp4'),
      mpeg: MediaSource$1.isTypeSupported('audio/mpeg'),
      mp3: MediaSource$1.isTypeSupported('audio/mp4; codecs="mp3"')
    };
    // navigator.vendor is not always available in Web Worker
    // refer to https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/navigator
    const vendor = navigator.vendor;
    if (this.useWorker && typeof Worker !== 'undefined') {
      const canCreateWorker = config.workerPath || hasUMDWorker();
      if (canCreateWorker) {
        try {
          if (config.workerPath) {
            logger.log(`loading Web Worker ${config.workerPath} for "${id}"`);
            this.workerContext = loadWorker(config.workerPath);
          } else {
            logger.log(`injecting Web Worker for "${id}"`);
            this.workerContext = injectWorker();
          }
          this.onwmsg = ev => this.onWorkerMessage(ev);
          const {
            worker
          } = this.workerContext;
          worker.addEventListener('message', this.onwmsg);
          worker.onerror = event => {
            const error = new Error(`${event.message}  (${event.filename}:${event.lineno})`);
            config.enableWorker = false;
            logger.warn(`Error in "${id}" Web Worker, fallback to inline`);
            this.hls.trigger(Events.ERROR, {
              type: ErrorTypes.OTHER_ERROR,
              details: ErrorDetails.INTERNAL_EXCEPTION,
              fatal: false,
              event: 'demuxerWorker',
              error
            });
          };
          worker.postMessage({
            cmd: 'init',
            typeSupported: typeSupported,
            vendor: vendor,
            id: id,
            config: JSON.stringify(config)
          });
        } catch (err) {
          logger.warn(`Error setting up "${id}" Web Worker, fallback to inline`, err);
          this.resetWorker();
          this.error = null;
          this.transmuxer = new Transmuxer(this.observer, typeSupported, config, vendor, id);
        }
        return;
      }
    }
    this.transmuxer = new Transmuxer(this.observer, typeSupported, config, vendor, id);
  }
  resetWorker() {
    if (this.workerContext) {
      const {
        worker,
        objectURL
      } = this.workerContext;
      if (objectURL) {
        // revoke the Object URL that was used to create transmuxer worker, so as not to leak it
        self.URL.revokeObjectURL(objectURL);
      }
      worker.removeEventListener('message', this.onwmsg);
      worker.onerror = null;
      worker.terminate();
      this.workerContext = null;
    }
  }
  destroy() {
    if (this.workerContext) {
      this.resetWorker();
      this.onwmsg = undefined;
    } else {
      const transmuxer = this.transmuxer;
      if (transmuxer) {
        transmuxer.destroy();
        this.transmuxer = null;
      }
    }
    const observer = this.observer;
    if (observer) {
      observer.removeAllListeners();
    }
    this.frag = null;
    // @ts-ignore
    this.observer = null;
    // @ts-ignore
    this.hls = null;
  }
  push(data, initSegmentData, audioCodec, videoCodec, frag, part, duration, accurateTimeOffset, chunkMeta, defaultInitPTS) {
    var _frag$initSegment, _lastFrag$initSegment;
    chunkMeta.transmuxing.start = self.performance.now();
    const {
      transmuxer
    } = this;
    const timeOffset = part ? part.start : frag.start;
    // TODO: push "clear-lead" decrypt data for unencrypted fragments in streams with encrypted ones
    const decryptdata = frag.decryptdata;
    const lastFrag = this.frag;
    const discontinuity = !(lastFrag && frag.cc === lastFrag.cc);
    const trackSwitch = !(lastFrag && chunkMeta.level === lastFrag.level);
    const snDiff = lastFrag ? chunkMeta.sn - lastFrag.sn : -1;
    const partDiff = this.part ? chunkMeta.part - this.part.index : -1;
    const progressive = snDiff === 0 && chunkMeta.id > 1 && chunkMeta.id === (lastFrag == null ? void 0 : lastFrag.stats.chunkCount);
    const contiguous = !trackSwitch && (snDiff === 1 || snDiff === 0 && (partDiff === 1 || progressive && partDiff <= 0));
    const now = self.performance.now();
    if (trackSwitch || snDiff || frag.stats.parsing.start === 0) {
      frag.stats.parsing.start = now;
    }
    if (part && (partDiff || !contiguous)) {
      part.stats.parsing.start = now;
    }
    const initSegmentChange = !(lastFrag && ((_frag$initSegment = frag.initSegment) == null ? void 0 : _frag$initSegment.url) === ((_lastFrag$initSegment = lastFrag.initSegment) == null ? void 0 : _lastFrag$initSegment.url));
    const state = new TransmuxState(discontinuity, contiguous, accurateTimeOffset, trackSwitch, timeOffset, initSegmentChange);
    if (!contiguous || discontinuity || initSegmentChange) {
      logger.log(`[transmuxer-interface, ${frag.type}]: Starting new transmux session for sn: ${chunkMeta.sn} p: ${chunkMeta.part} level: ${chunkMeta.level} id: ${chunkMeta.id}
        discontinuity: ${discontinuity}
        trackSwitch: ${trackSwitch}
        contiguous: ${contiguous}
        accurateTimeOffset: ${accurateTimeOffset}
        timeOffset: ${timeOffset}
        initSegmentChange: ${initSegmentChange}`);
      const config = new TransmuxConfig(audioCodec, videoCodec, initSegmentData, duration, defaultInitPTS);
      this.configureTransmuxer(config);
    }
    this.frag = frag;
    this.part = part;

    // Frags with sn of 'initSegment' are not transmuxed
    if (this.workerContext) {
      // post fragment payload as transferable objects for ArrayBuffer (no copy)
      this.workerContext.worker.postMessage({
        cmd: 'demux',
        data,
        decryptdata,
        chunkMeta,
        state
      }, data instanceof ArrayBuffer ? [data] : []);
    } else if (transmuxer) {
      const transmuxResult = transmuxer.push(data, decryptdata, chunkMeta, state);
      if (isPromise(transmuxResult)) {
        transmuxer.async = true;
        transmuxResult.then(data => {
          this.handleTransmuxComplete(data);
        }).catch(error => {
          this.transmuxerError(error, chunkMeta, 'transmuxer-interface push error');
        });
      } else {
        transmuxer.async = false;
        this.handleTransmuxComplete(transmuxResult);
      }
    }
  }
  flush(chunkMeta) {
    chunkMeta.transmuxing.start = self.performance.now();
    const {
      transmuxer
    } = this;
    if (this.workerContext) {
      this.workerContext.worker.postMessage({
        cmd: 'flush',
        chunkMeta
      });
    } else if (transmuxer) {
      let transmuxResult = transmuxer.flush(chunkMeta);
      const asyncFlush = isPromise(transmuxResult);
      if (asyncFlush || transmuxer.async) {
        if (!isPromise(transmuxResult)) {
          transmuxResult = Promise.resolve(transmuxResult);
        }
        transmuxResult.then(data => {
          this.handleFlushResult(data, chunkMeta);
        }).catch(error => {
          this.transmuxerError(error, chunkMeta, 'transmuxer-interface flush error');
        });
      } else {
        this.handleFlushResult(transmuxResult, chunkMeta);
      }
    }
  }
  transmuxerError(error, chunkMeta, reason) {
    if (!this.hls) {
      return;
    }
    this.error = error;
    this.hls.trigger(Events.ERROR, {
      type: ErrorTypes.MEDIA_ERROR,
      details: ErrorDetails.FRAG_PARSING_ERROR,
      chunkMeta,
      fatal: false,
      error,
      err: error,
      reason
    });
  }
  handleFlushResult(results, chunkMeta) {
    results.forEach(result => {
      this.handleTransmuxComplete(result);
    });
    this.onFlush(chunkMeta);
  }
  onWorkerMessage(ev) {
    const data = ev.data;
    const hls = this.hls;
    switch (data.event) {
      case 'init':
        {
          var _this$workerContext;
          const objectURL = (_this$workerContext = this.workerContext) == null ? void 0 : _this$workerContext.objectURL;
          if (objectURL) {
            // revoke the Object URL that was used to create transmuxer worker, so as not to leak it
            self.URL.revokeObjectURL(objectURL);
          }
          break;
        }
      case 'transmuxComplete':
        {
          this.handleTransmuxComplete(data.data);
          break;
        }
      case 'flush':
        {
          this.onFlush(data.data);
          break;
        }

      // pass logs from the worker thread to the main logger
      case 'workerLog':
        if (logger[data.data.logType]) {
          logger[data.data.logType](data.data.message);
        }
        break;
      default:
        {
          data.data = data.data || {};
          data.data.frag = this.frag;
          data.data.id = this.id;
          hls.trigger(data.event, data.data);
          break;
        }
    }
  }
  configureTransmuxer(config) {
    const {
      transmuxer
    } = this;
    if (this.workerContext) {
      this.workerContext.worker.postMessage({
        cmd: 'configure',
        config
      });
    } else if (transmuxer) {
      transmuxer.configure(config);
    }
  }
  handleTransmuxComplete(result) {
    result.chunkMeta.transmuxing.end = self.performance.now();
    this.onTransmuxComplete(result);
  }
}

const STALL_MINIMUM_DURATION_MS = 250;
const MAX_START_GAP_JUMP = 2.0;
const SKIP_BUFFER_HOLE_STEP_SECONDS = 0.1;
const SKIP_BUFFER_RANGE_START = 0.05;
class GapController {
  constructor(config, media, fragmentTracker, hls) {
    this.config = void 0;
    this.media = null;
    this.fragmentTracker = void 0;
    this.hls = void 0;
    this.nudgeRetry = 0;
    this.stallReported = false;
    this.stalled = null;
    this.moved = false;
    this.seeking = false;
    this.config = config;
    this.media = media;
    this.fragmentTracker = fragmentTracker;
    this.hls = hls;
  }
  destroy() {
    this.media = null;
    // @ts-ignore
    this.hls = this.fragmentTracker = null;
  }

  /**
   * Checks if the playhead is stuck within a gap, and if so, attempts to free it.
   * A gap is an unbuffered range between two buffered ranges (or the start and the first buffered range).
   *
   * @param lastCurrentTime - Previously read playhead position
   */
  poll(lastCurrentTime, activeFrag) {
    const {
      config,
      media,
      stalled
    } = this;
    if (media === null) {
      return;
    }
    const {
      currentTime,
      seeking
    } = media;
    const seeked = this.seeking && !seeking;
    const beginSeek = !this.seeking && seeking;
    this.seeking = seeking;

    // The playhead is moving, no-op
    if (currentTime !== lastCurrentTime) {
      this.moved = true;
      if (stalled !== null) {
        // The playhead is now moving, but was previously stalled
        if (this.stallReported) {
          const _stalledDuration = self.performance.now() - stalled;
          logger.warn(`playback not stuck anymore @${currentTime}, after ${Math.round(_stalledDuration)}ms`);
          this.stallReported = false;
        }
        this.stalled = null;
        this.nudgeRetry = 0;
      }
      return;
    }

    // Clear stalled state when beginning or finishing seeking so that we don't report stalls coming out of a seek
    if (beginSeek || seeked) {
      this.stalled = null;
      return;
    }

    // The playhead should not be moving
    if (media.paused && !seeking || media.ended || media.playbackRate === 0 || !BufferHelper.getBuffered(media).length) {
      return;
    }
    const bufferInfo = BufferHelper.bufferInfo(media, currentTime, 0);
    const isBuffered = bufferInfo.len > 0;
    const nextStart = bufferInfo.nextStart || 0;

    // There is no playable buffer (seeked, waiting for buffer)
    if (!isBuffered && !nextStart) {
      return;
    }
    if (seeking) {
      // Waiting for seeking in a buffered range to complete
      const hasEnoughBuffer = bufferInfo.len > MAX_START_GAP_JUMP;
      // Next buffered range is too far ahead to jump to while still seeking
      const noBufferGap = !nextStart || activeFrag && activeFrag.start <= currentTime || nextStart - currentTime > MAX_START_GAP_JUMP && !this.fragmentTracker.getPartialFragment(currentTime);
      if (hasEnoughBuffer || noBufferGap) {
        return;
      }
      // Reset moved state when seeking to a point in or before a gap
      this.moved = false;
    }

    // Skip start gaps if we haven't played, but the last poll detected the start of a stall
    // The addition poll gives the browser a chance to jump the gap for us
    if (!this.moved && this.stalled !== null) {
      var _level$details;
      // Jump start gaps within jump threshold
      const startJump = Math.max(nextStart, bufferInfo.start || 0) - currentTime;

      // When joining a live stream with audio tracks, account for live playlist window sliding by allowing
      // a larger jump over start gaps caused by the audio-stream-controller buffering a start fragment
      // that begins over 1 target duration after the video start position.
      const level = this.hls.levels ? this.hls.levels[this.hls.currentLevel] : null;
      const isLive = level == null ? void 0 : (_level$details = level.details) == null ? void 0 : _level$details.live;
      const maxStartGapJump = isLive ? level.details.targetduration * 2 : MAX_START_GAP_JUMP;
      const partialOrGap = this.fragmentTracker.getPartialFragment(currentTime);
      if (startJump > 0 && (startJump <= maxStartGapJump || partialOrGap)) {
        this._trySkipBufferHole(partialOrGap);
        return;
      }
    }

    // Start tracking stall time
    const tnow = self.performance.now();
    if (stalled === null) {
      this.stalled = tnow;
      return;
    }
    const stalledDuration = tnow - stalled;
    if (!seeking && stalledDuration >= STALL_MINIMUM_DURATION_MS) {
      // Report stalling after trying to fix
      this._reportStall(bufferInfo);
      if (!this.media) {
        return;
      }
    }
    const bufferedWithHoles = BufferHelper.bufferInfo(media, currentTime, config.maxBufferHole);
    this._tryFixBufferStall(bufferedWithHoles, stalledDuration);
  }

  /**
   * Detects and attempts to fix known buffer stalling issues.
   * @param bufferInfo - The properties of the current buffer.
   * @param stalledDurationMs - The amount of time Hls.js has been stalling for.
   * @private
   */
  _tryFixBufferStall(bufferInfo, stalledDurationMs) {
    const {
      config,
      fragmentTracker,
      media
    } = this;
    if (media === null) {
      return;
    }
    const currentTime = media.currentTime;
    const partial = fragmentTracker.getPartialFragment(currentTime);
    if (partial) {
      // Try to skip over the buffer hole caused by a partial fragment
      // This method isn't limited by the size of the gap between buffered ranges
      const targetTime = this._trySkipBufferHole(partial);
      // we return here in this case, meaning
      // the branch below only executes when we haven't seeked to a new position
      if (targetTime || !this.media) {
        return;
      }
    }

    // if we haven't had to skip over a buffer hole of a partial fragment
    // we may just have to "nudge" the playlist as the browser decoding/rendering engine
    // needs to cross some sort of threshold covering all source-buffers content
    // to start playing properly.
    if ((bufferInfo.len > config.maxBufferHole || bufferInfo.nextStart && bufferInfo.nextStart - currentTime < config.maxBufferHole) && stalledDurationMs > config.highBufferWatchdogPeriod * 1000) {
      logger.warn('Trying to nudge playhead over buffer-hole');
      // Try to nudge currentTime over a buffer hole if we've been stalling for the configured amount of seconds
      // We only try to jump the hole if it's under the configured size
      // Reset stalled so to rearm watchdog timer
      this.stalled = null;
      this._tryNudgeBuffer();
    }
  }

  /**
   * Triggers a BUFFER_STALLED_ERROR event, but only once per stall period.
   * @param bufferLen - The playhead distance from the end of the current buffer segment.
   * @private
   */
  _reportStall(bufferInfo) {
    const {
      hls,
      media,
      stallReported
    } = this;
    if (!stallReported && media) {
      // Report stalled error once
      this.stallReported = true;
      const error = new Error(`Playback stalling at @${media.currentTime} due to low buffer (${JSON.stringify(bufferInfo)})`);
      logger.warn(error.message);
      hls.trigger(Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_STALLED_ERROR,
        fatal: false,
        error,
        buffer: bufferInfo.len
      });
    }
  }

  /**
   * Attempts to fix buffer stalls by jumping over known gaps caused by partial fragments
   * @param partial - The partial fragment found at the current time (where playback is stalling).
   * @private
   */
  _trySkipBufferHole(partial) {
    const {
      config,
      hls,
      media
    } = this;
    if (media === null) {
      return 0;
    }

    // Check if currentTime is between unbuffered regions of partial fragments
    const currentTime = media.currentTime;
    const bufferInfo = BufferHelper.bufferInfo(media, currentTime, 0);
    const startTime = currentTime < bufferInfo.start ? bufferInfo.start : bufferInfo.nextStart;
    if (startTime) {
      const bufferStarved = bufferInfo.len <= config.maxBufferHole;
      const waiting = bufferInfo.len > 0 && bufferInfo.len < 1 && media.readyState < 3;
      const gapLength = startTime - currentTime;
      if (gapLength > 0 && (bufferStarved || waiting)) {
        // Only allow large gaps to be skipped if it is a start gap, or all fragments in skip range are partial
        if (gapLength > config.maxBufferHole) {
          const {
            fragmentTracker
          } = this;
          let startGap = false;
          if (currentTime === 0) {
            const startFrag = fragmentTracker.getAppendedFrag(0, PlaylistLevelType.MAIN);
            if (startFrag && startTime < startFrag.end) {
              startGap = true;
            }
          }
          if (!startGap) {
            const startProvisioned = partial || fragmentTracker.getAppendedFrag(currentTime, PlaylistLevelType.MAIN);
            if (startProvisioned) {
              let moreToLoad = false;
              let pos = startProvisioned.end;
              while (pos < startTime) {
                const provisioned = fragmentTracker.getPartialFragment(pos);
                if (provisioned) {
                  pos += provisioned.duration;
                } else {
                  moreToLoad = true;
                  break;
                }
              }
              if (moreToLoad) {
                return 0;
              }
            }
          }
        }
        const targetTime = Math.max(startTime + SKIP_BUFFER_RANGE_START, currentTime + SKIP_BUFFER_HOLE_STEP_SECONDS);
        logger.warn(`skipping hole, adjusting currentTime from ${currentTime} to ${targetTime}`);
        this.moved = true;
        this.stalled = null;
        media.currentTime = targetTime;
        if (partial && !partial.gap) {
          const error = new Error(`fragment loaded with buffer holes, seeking from ${currentTime} to ${targetTime}`);
          hls.trigger(Events.ERROR, {
            type: ErrorTypes.MEDIA_ERROR,
            details: ErrorDetails.BUFFER_SEEK_OVER_HOLE,
            fatal: false,
            error,
            reason: error.message,
            frag: partial
          });
        }
        return targetTime;
      }
    }
    return 0;
  }

  /**
   * Attempts to fix buffer stalls by advancing the mediaElement's current time by a small amount.
   * @private
   */
  _tryNudgeBuffer() {
    const {
      config,
      hls,
      media,
      nudgeRetry
    } = this;
    if (media === null) {
      return;
    }
    const currentTime = media.currentTime;
    this.nudgeRetry++;
    if (nudgeRetry < config.nudgeMaxRetry) {
      const targetTime = currentTime + (nudgeRetry + 1) * config.nudgeOffset;
      // playback stalled in buffered area ... let's nudge currentTime to try to overcome this
      const error = new Error(`Nudging 'currentTime' from ${currentTime} to ${targetTime}`);
      logger.warn(error.message);
      media.currentTime = targetTime;
      hls.trigger(Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_NUDGE_ON_STALL,
        error,
        fatal: false
      });
    } else {
      const error = new Error(`Playhead still not moving while enough data buffered @${currentTime} after ${config.nudgeMaxRetry} nudges`);
      logger.error(error.message);
      hls.trigger(Events.ERROR, {
        type: ErrorTypes.MEDIA_ERROR,
        details: ErrorDetails.BUFFER_STALLED_ERROR,
        error,
        fatal: true
      });
    }
  }
}

const TICK_INTERVAL = 100; // how often to tick in ms

class StreamController extends BaseStreamController {
  constructor(hls, fragmentTracker, keyLoader) {
    super(hls, fragmentTracker, keyLoader, '[stream-controller]', PlaylistLevelType.MAIN);
    this.audioCodecSwap = false;
    this.gapController = null;
    this.level = -1;
    this._forceStartLoad = false;
    this.altAudio = false;
    this.audioOnly = false;
    this.fragPlaying = null;
    this.onvplaying = null;
    this.onvseeked = null;
    this.fragLastKbps = 0;
    this.couldBacktrack = false;
    this.backtrackFragment = null;
    this.audioCodecSwitch = false;
    this.videoBuffer = null;
    this._registerListeners();
  }
  _registerListeners() {
    const {
      hls
    } = this;
    hls.on(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    hls.on(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.on(Events.MANIFEST_PARSED, this.onManifestParsed, this);
    hls.on(Events.LEVEL_LOADING, this.onLevelLoading, this);
    hls.on(Events.LEVEL_LOADED, this.onLevelLoaded, this);
    hls.on(Events.FRAG_LOAD_EMERGENCY_ABORTED, this.onFragLoadEmergencyAborted, this);
    hls.on(Events.ERROR, this.onError, this);
    hls.on(Events.AUDIO_TRACK_SWITCHING, this.onAudioTrackSwitching, this);
    hls.on(Events.AUDIO_TRACK_SWITCHED, this.onAudioTrackSwitched, this);
    hls.on(Events.BUFFER_CREATED, this.onBufferCreated, this);
    hls.on(Events.BUFFER_FLUSHED, this.onBufferFlushed, this);
    hls.on(Events.LEVELS_UPDATED, this.onLevelsUpdated, this);
    hls.on(Events.FRAG_BUFFERED, this.onFragBuffered, this);
  }
  _unregisterListeners() {
    const {
      hls
    } = this;
    hls.off(Events.MEDIA_ATTACHED, this.onMediaAttached, this);
    hls.off(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.off(Events.MANIFEST_PARSED, this.onManifestParsed, this);
    hls.off(Events.LEVEL_LOADED, this.onLevelLoaded, this);
    hls.off(Events.FRAG_LOAD_EMERGENCY_ABORTED, this.onFragLoadEmergencyAborted, this);
    hls.off(Events.ERROR, this.onError, this);
    hls.off(Events.AUDIO_TRACK_SWITCHING, this.onAudioTrackSwitching, this);
    hls.off(Events.AUDIO_TRACK_SWITCHED, this.onAudioTrackSwitched, this);
    hls.off(Events.BUFFER_CREATED, this.onBufferCreated, this);
    hls.off(Events.BUFFER_FLUSHED, this.onBufferFlushed, this);
    hls.off(Events.LEVELS_UPDATED, this.onLevelsUpdated, this);
    hls.off(Events.FRAG_BUFFERED, this.onFragBuffered, this);
  }
  onHandlerDestroying() {
    this._unregisterListeners();
    this.onMediaDetaching();
  }
  startLoad(startPosition) {
    if (this.levels) {
      const {
        lastCurrentTime,
        hls
      } = this;
      this.stopLoad();
      this.setInterval(TICK_INTERVAL);
      this.level = -1;
      if (!this.startFragRequested) {
        // determine load level
        let startLevel = hls.startLevel;
        if (startLevel === -1) {
          if (hls.config.testBandwidth && this.levels.length > 1) {
            // -1 : guess start Level by doing a bitrate test by loading first fragment of lowest quality level
            startLevel = 0;
            this.bitrateTest = true;
          } else {
            startLevel = hls.nextAutoLevel;
          }
        }
        // set new level to playlist loader : this will trigger start level load
        // hls.nextLoadLevel remains until it is set to a new value or until a new frag is successfully loaded
        this.level = hls.nextLoadLevel = startLevel;
        this.loadedmetadata = false;
      }
      // if startPosition undefined but lastCurrentTime set, set startPosition to last currentTime
      if (lastCurrentTime > 0 && startPosition === -1) {
        this.log(`Override startPosition with lastCurrentTime @${lastCurrentTime.toFixed(3)}`);
        startPosition = lastCurrentTime;
      }
      this.state = State.IDLE;
      this.nextLoadPosition = this.startPosition = this.lastCurrentTime = startPosition;
      this.tick();
    } else {
      this._forceStartLoad = true;
      this.state = State.STOPPED;
    }
  }
  stopLoad() {
    this._forceStartLoad = false;
    super.stopLoad();
  }
  doTick() {
    switch (this.state) {
      case State.WAITING_LEVEL:
        {
          var _levels$level;
          const {
            levels,
            level
          } = this;
          const details = levels == null ? void 0 : (_levels$level = levels[level]) == null ? void 0 : _levels$level.details;
          if (details && (!details.live || this.levelLastLoaded === this.level)) {
            if (this.waitForCdnTuneIn(details)) {
              break;
            }
            this.state = State.IDLE;
            break;
          } else if (this.hls.nextLoadLevel !== this.level) {
            this.state = State.IDLE;
            break;
          }
          break;
        }
      case State.FRAG_LOADING_WAITING_RETRY:
        {
          var _this$media;
          const now = self.performance.now();
          const retryDate = this.retryDate;
          // if current time is gt than retryDate, or if media seeking let's switch to IDLE state to retry loading
          if (!retryDate || now >= retryDate || (_this$media = this.media) != null && _this$media.seeking) {
            this.resetStartWhenNotLoaded(this.level);
            this.state = State.IDLE;
          }
        }
        break;
    }
    if (this.state === State.IDLE) {
      this.doTickIdle();
    }
    this.onTickEnd();
  }
  onTickEnd() {
    super.onTickEnd();
    this.checkBuffer();
    this.checkFragmentChanged();
  }
  doTickIdle() {
    const {
      hls,
      levelLastLoaded,
      levels,
      media
    } = this;
    const {
      config,
      nextLoadLevel: level
    } = hls;

    // if start level not parsed yet OR
    // if video not attached AND start fragment already requested OR start frag prefetch not enabled
    // exit loop, as we either need more info (level not parsed) or we need media to be attached to load new fragment
    if (levelLastLoaded === null || !media && (this.startFragRequested || !config.startFragPrefetch)) {
      return;
    }

    // If the "main" level is audio-only but we are loading an alternate track in the same group, do not load anything
    if (this.altAudio && this.audioOnly) {
      return;
    }
    if (!(levels != null && levels[level])) {
      return;
    }
    const levelInfo = levels[level];

    // if buffer length is less than maxBufLen try to load a new fragment

    const bufferInfo = this.getMainFwdBufferInfo();
    if (bufferInfo === null) {
      return;
    }
    const lastDetails = this.getLevelDetails();
    if (lastDetails && this._streamEnded(bufferInfo, lastDetails)) {
      const data = {};
      if (this.altAudio) {
        data.type = 'video';
      }
      this.hls.trigger(Events.BUFFER_EOS, data);
      this.state = State.ENDED;
      return;
    }

    // set next load level : this will trigger a playlist load if needed
    if (hls.loadLevel !== level && hls.manualLevel === -1) {
      this.log(`Adapting to level ${level} from level ${this.level}`);
    }
    this.level = hls.nextLoadLevel = level;
    const levelDetails = levelInfo.details;
    // if level info not retrieved yet, switch state and wait for level retrieval
    // if live playlist, ensure that new playlist has been refreshed to avoid loading/try to load
    // a useless and outdated fragment (that might even introduce load error if it is already out of the live playlist)
    if (!levelDetails || this.state === State.WAITING_LEVEL || levelDetails.live && this.levelLastLoaded !== level) {
      this.level = level;
      this.state = State.WAITING_LEVEL;
      return;
    }
    const bufferLen = bufferInfo.len;

    // compute max Buffer Length that we could get from this load level, based on level bitrate. don't buffer more than 60 MB and more than 30s
    const maxBufLen = this.getMaxBufferLength(levelInfo.maxBitrate);

    // Stay idle if we are still with buffer margins
    if (bufferLen >= maxBufLen) {
      return;
    }
    if (this.backtrackFragment && this.backtrackFragment.start > bufferInfo.end) {
      this.backtrackFragment = null;
    }
    const targetBufferTime = this.backtrackFragment ? this.backtrackFragment.start : bufferInfo.end;
    let frag = this.getNextFragment(targetBufferTime, levelDetails);
    // Avoid backtracking by loading an earlier segment in streams with segments that do not start with a key frame (flagged by `couldBacktrack`)
    if (this.couldBacktrack && !this.fragPrevious && frag && frag.sn !== 'initSegment' && this.fragmentTracker.getState(frag) !== FragmentState.OK) {
      var _this$backtrackFragme;
      const backtrackSn = ((_this$backtrackFragme = this.backtrackFragment) != null ? _this$backtrackFragme : frag).sn;
      const fragIdx = backtrackSn - levelDetails.startSN;
      const backtrackFrag = levelDetails.fragments[fragIdx - 1];
      if (backtrackFrag && frag.cc === backtrackFrag.cc) {
        frag = backtrackFrag;
        this.fragmentTracker.removeFragment(backtrackFrag);
      }
    } else if (this.backtrackFragment && bufferInfo.len) {
      this.backtrackFragment = null;
    }
    // Avoid loop loading by using nextLoadPosition set for backtracking and skipping consecutive GAP tags
    if (frag && this.isLoopLoading(frag, targetBufferTime)) {
      const gapStart = frag.gap;
      if (!gapStart) {
        // Cleanup the fragment tracker before trying to find the next unbuffered fragment
        const type = this.audioOnly && !this.altAudio ? ElementaryStreamTypes.AUDIO : ElementaryStreamTypes.VIDEO;
        const mediaBuffer = (type === ElementaryStreamTypes.VIDEO ? this.videoBuffer : this.mediaBuffer) || this.media;
        if (mediaBuffer) {
          this.afterBufferFlushed(mediaBuffer, type, PlaylistLevelType.MAIN);
        }
      }
      frag = this.getNextFragmentLoopLoading(frag, levelDetails, bufferInfo, PlaylistLevelType.MAIN, maxBufLen);
    }
    if (!frag) {
      return;
    }
    if (frag.initSegment && !frag.initSegment.data && !this.bitrateTest) {
      frag = frag.initSegment;
    }
    this.loadFragment(frag, levelInfo, targetBufferTime);
  }
  loadFragment(frag, level, targetBufferTime) {
    // Check if fragment is not loaded
    const fragState = this.fragmentTracker.getState(frag);
    this.fragCurrent = frag;
    if (fragState === FragmentState.NOT_LOADED || fragState === FragmentState.PARTIAL) {
      if (frag.sn === 'initSegment') {
        this._loadInitSegment(frag, level);
      } else if (this.bitrateTest) {
        this.log(`Fragment ${frag.sn} of level ${frag.level} is being downloaded to test bitrate and will not be buffered`);
        this._loadBitrateTestFrag(frag, level);
      } else {
        this.startFragRequested = true;
        super.loadFragment(frag, level, targetBufferTime);
      }
    } else {
      this.clearTrackerIfNeeded(frag);
    }
  }
  getBufferedFrag(position) {
    return this.fragmentTracker.getBufferedFrag(position, PlaylistLevelType.MAIN);
  }
  followingBufferedFrag(frag) {
    if (frag) {
      // try to get range of next fragment (500ms after this range)
      return this.getBufferedFrag(frag.end + 0.5);
    }
    return null;
  }

  /*
    on immediate level switch :
     - pause playback if playing
     - cancel any pending load request
     - and trigger a buffer flush
  */
  immediateLevelSwitch() {
    this.abortCurrentFrag();
    this.flushMainBuffer(0, Number.POSITIVE_INFINITY);
  }

  /**
   * try to switch ASAP without breaking video playback:
   * in order to ensure smooth but quick level switching,
   * we need to find the next flushable buffer range
   * we should take into account new segment fetch time
   */
  nextLevelSwitch() {
    const {
      levels,
      media
    } = this;
    // ensure that media is defined and that metadata are available (to retrieve currentTime)
    if (media != null && media.readyState) {
      let fetchdelay;
      const fragPlayingCurrent = this.getAppendedFrag(media.currentTime);
      if (fragPlayingCurrent && fragPlayingCurrent.start > 1) {
        // flush buffer preceding current fragment (flush until current fragment start offset)
        // minus 1s to avoid video freezing, that could happen if we flush keyframe of current video ...
        this.flushMainBuffer(0, fragPlayingCurrent.start - 1);
      }
      const levelDetails = this.getLevelDetails();
      if (levelDetails != null && levelDetails.live) {
        const bufferInfo = this.getMainFwdBufferInfo();
        // Do not flush in live stream with low buffer
        if (!bufferInfo || bufferInfo.len < levelDetails.targetduration * 2) {
          return;
        }
      }
      if (!media.paused && levels) {
        // add a safety delay of 1s
        const nextLevelId = this.hls.nextLoadLevel;
        const nextLevel = levels[nextLevelId];
        const fragLastKbps = this.fragLastKbps;
        if (fragLastKbps && this.fragCurrent) {
          fetchdelay = this.fragCurrent.duration * nextLevel.maxBitrate / (1000 * fragLastKbps) + 1;
        } else {
          fetchdelay = 0;
        }
      } else {
        fetchdelay = 0;
      }
      // this.log('fetchdelay:'+fetchdelay);
      // find buffer range that will be reached once new fragment will be fetched
      const bufferedFrag = this.getBufferedFrag(media.currentTime + fetchdelay);
      if (bufferedFrag) {
        // we can flush buffer range following this one without stalling playback
        const nextBufferedFrag = this.followingBufferedFrag(bufferedFrag);
        if (nextBufferedFrag) {
          // if we are here, we can also cancel any loading/demuxing in progress, as they are useless
          this.abortCurrentFrag();
          // start flush position is in next buffered frag. Leave some padding for non-independent segments and smoother playback.
          const maxStart = nextBufferedFrag.maxStartPTS ? nextBufferedFrag.maxStartPTS : nextBufferedFrag.start;
          const fragDuration = nextBufferedFrag.duration;
          const startPts = Math.max(bufferedFrag.end, maxStart + Math.min(Math.max(fragDuration - this.config.maxFragLookUpTolerance, fragDuration * 0.5), fragDuration * 0.75));
          this.flushMainBuffer(startPts, Number.POSITIVE_INFINITY);
        }
      }
    }
  }
  abortCurrentFrag() {
    const fragCurrent = this.fragCurrent;
    this.fragCurrent = null;
    this.backtrackFragment = null;
    if (fragCurrent) {
      fragCurrent.abortRequests();
      this.fragmentTracker.removeFragment(fragCurrent);
    }
    switch (this.state) {
      case State.KEY_LOADING:
      case State.FRAG_LOADING:
      case State.FRAG_LOADING_WAITING_RETRY:
      case State.PARSING:
      case State.PARSED:
        this.state = State.IDLE;
        break;
    }
    this.nextLoadPosition = this.getLoadPosition();
  }
  flushMainBuffer(startOffset, endOffset) {
    super.flushMainBuffer(startOffset, endOffset, this.altAudio ? 'video' : null);
  }
  onMediaAttached(event, data) {
    super.onMediaAttached(event, data);
    const media = data.media;
    this.onvplaying = this.onMediaPlaying.bind(this);
    this.onvseeked = this.onMediaSeeked.bind(this);
    media.addEventListener('playing', this.onvplaying);
    media.addEventListener('seeked', this.onvseeked);
    this.gapController = new GapController(this.config, media, this.fragmentTracker, this.hls);
  }
  onMediaDetaching() {
    const {
      media
    } = this;
    if (media && this.onvplaying && this.onvseeked) {
      media.removeEventListener('playing', this.onvplaying);
      media.removeEventListener('seeked', this.onvseeked);
      this.onvplaying = this.onvseeked = null;
      this.videoBuffer = null;
    }
    this.fragPlaying = null;
    if (this.gapController) {
      this.gapController.destroy();
      this.gapController = null;
    }
    super.onMediaDetaching();
  }
  onMediaPlaying() {
    // tick to speed up FRAG_CHANGED triggering
    this.tick();
  }
  onMediaSeeked() {
    const media = this.media;
    const currentTime = media ? media.currentTime : null;
    if (isFiniteNumber(currentTime)) {
      this.log(`Media seeked to ${currentTime.toFixed(3)}`);
    }

    // If seeked was issued before buffer was appended do not tick immediately
    const bufferInfo = this.getMainFwdBufferInfo();
    if (bufferInfo === null || bufferInfo.len === 0) {
      this.warn(`Main forward buffer length on "seeked" event ${bufferInfo ? bufferInfo.len : 'empty'})`);
      return;
    }

    // tick to speed up FRAG_CHANGED triggering
    this.tick();
  }
  onManifestLoading() {
    // reset buffer on manifest loading
    this.log('Trigger BUFFER_RESET');
    this.hls.trigger(Events.BUFFER_RESET, undefined);
    this.fragmentTracker.removeAllFragments();
    this.couldBacktrack = false;
    this.startPosition = this.lastCurrentTime = 0;
    this.levels = this.fragPlaying = this.backtrackFragment = null;
    this.altAudio = this.audioOnly = false;
  }
  onManifestParsed(event, data) {
    let aac = false;
    let heaac = false;
    let codec;
    data.levels.forEach(level => {
      // detect if we have different kind of audio codecs used amongst playlists
      codec = level.audioCodec;
      if (codec) {
        if (codec.indexOf('mp4a.40.2') !== -1) {
          aac = true;
        }
        if (codec.indexOf('mp4a.40.5') !== -1) {
          heaac = true;
        }
      }
    });
    this.audioCodecSwitch = aac && heaac && !changeTypeSupported();
    if (this.audioCodecSwitch) {
      this.log('Both AAC/HE-AAC audio found in levels; declaring level codec as HE-AAC');
    }
    this.levels = data.levels;
    this.startFragRequested = false;
  }
  onLevelLoading(event, data) {
    const {
      levels
    } = this;
    if (!levels || this.state !== State.IDLE) {
      return;
    }
    const level = levels[data.level];
    if (!level.details || level.details.live && this.levelLastLoaded !== data.level || this.waitForCdnTuneIn(level.details)) {
      this.state = State.WAITING_LEVEL;
    }
  }
  onLevelLoaded(event, data) {
    var _curLevel$details;
    const {
      levels
    } = this;
    const newLevelId = data.level;
    const newDetails = data.details;
    const duration = newDetails.totalduration;
    if (!levels) {
      this.warn(`Levels were reset while loading level ${newLevelId}`);
      return;
    }
    this.log(`Level ${newLevelId} loaded [${newDetails.startSN},${newDetails.endSN}]${newDetails.lastPartSn ? `[part-${newDetails.lastPartSn}-${newDetails.lastPartIndex}]` : ''}, cc [${newDetails.startCC}, ${newDetails.endCC}] duration:${duration}`);
    const curLevel = levels[newLevelId];
    const fragCurrent = this.fragCurrent;
    if (fragCurrent && (this.state === State.FRAG_LOADING || this.state === State.FRAG_LOADING_WAITING_RETRY)) {
      if ((fragCurrent.level !== data.level || fragCurrent.urlId !== curLevel.urlId) && fragCurrent.loader) {
        this.abortCurrentFrag();
      }
    }
    let sliding = 0;
    if (newDetails.live || (_curLevel$details = curLevel.details) != null && _curLevel$details.live) {
      this.checkLiveUpdate(newDetails);
      if (newDetails.deltaUpdateFailed) {
        return;
      }
      sliding = this.alignPlaylists(newDetails, curLevel.details);
    }
    // override level info
    curLevel.details = newDetails;
    this.levelLastLoaded = newLevelId;
    this.hls.trigger(Events.LEVEL_UPDATED, {
      details: newDetails,
      level: newLevelId
    });

    // only switch back to IDLE state if we were waiting for level to start downloading a new fragment
    if (this.state === State.WAITING_LEVEL) {
      if (this.waitForCdnTuneIn(newDetails)) {
        // Wait for Low-Latency CDN Tune-in
        return;
      }
      this.state = State.IDLE;
    }
    if (!this.startFragRequested) {
      this.setStartPosition(newDetails, sliding);
    } else if (newDetails.live) {
      this.synchronizeToLiveEdge(newDetails);
    }

    // trigger handler right now
    this.tick();
  }
  _handleFragmentLoadProgress(data) {
    var _frag$initSegment;
    const {
      frag,
      part,
      payload
    } = data;
    const {
      levels
    } = this;
    if (!levels) {
      this.warn(`Levels were reset while fragment load was in progress. Fragment ${frag.sn} of level ${frag.level} will not be buffered`);
      return;
    }
    const currentLevel = levels[frag.level];
    const details = currentLevel.details;
    if (!details) {
      this.warn(`Dropping fragment ${frag.sn} of level ${frag.level} after level details were reset`);
      this.fragmentTracker.removeFragment(frag);
      return;
    }
    const videoCodec = currentLevel.videoCodec;

    // time Offset is accurate if level PTS is known, or if playlist is not sliding (not live)
    const accurateTimeOffset = details.PTSKnown || !details.live;
    const initSegmentData = (_frag$initSegment = frag.initSegment) == null ? void 0 : _frag$initSegment.data;
    const audioCodec = this._getAudioCodec(currentLevel);

    // transmux the MPEG-TS data to ISO-BMFF segments
    // this.log(`Transmuxing ${frag.sn} of [${details.startSN} ,${details.endSN}],level ${frag.level}, cc ${frag.cc}`);
    const transmuxer = this.transmuxer = this.transmuxer || new TransmuxerInterface(this.hls, PlaylistLevelType.MAIN, this._handleTransmuxComplete.bind(this), this._handleTransmuxerFlush.bind(this));
    const partIndex = part ? part.index : -1;
    const partial = partIndex !== -1;
    const chunkMeta = new ChunkMetadata(frag.level, frag.sn, frag.stats.chunkCount, payload.byteLength, partIndex, partial);
    const initPTS = this.initPTS[frag.cc];
    transmuxer.push(payload, initSegmentData, audioCodec, videoCodec, frag, part, details.totalduration, accurateTimeOffset, chunkMeta, initPTS);
  }
  onAudioTrackSwitching(event, data) {
    // if any URL found on new audio track, it is an alternate audio track
    const fromAltAudio = this.altAudio;
    const altAudio = !!data.url;
    // if we switch on main audio, ensure that main fragment scheduling is synced with media.buffered
    // don't do anything if we switch to alt audio: audio stream controller is handling it.
    // we will just have to change buffer scheduling on audioTrackSwitched
    if (!altAudio) {
      if (this.mediaBuffer !== this.media) {
        this.log('Switching on main audio, use media.buffered to schedule main fragment loading');
        this.mediaBuffer = this.media;
        const fragCurrent = this.fragCurrent;
        // we need to refill audio buffer from main: cancel any frag loading to speed up audio switch
        if (fragCurrent) {
          this.log('Switching to main audio track, cancel main fragment load');
          fragCurrent.abortRequests();
          this.fragmentTracker.removeFragment(fragCurrent);
        }
        // destroy transmuxer to force init segment generation (following audio switch)
        this.resetTransmuxer();
        // switch to IDLE state to load new fragment
        this.resetLoadingState();
      } else if (this.audioOnly) {
        // Reset audio transmuxer so when switching back to main audio we're not still appending where we left off
        this.resetTransmuxer();
      }
      const hls = this.hls;
      // If switching from alt to main audio, flush all audio and trigger track switched
      if (fromAltAudio) {
        hls.trigger(Events.BUFFER_FLUSHING, {
          startOffset: 0,
          endOffset: Number.POSITIVE_INFINITY,
          type: null
        });
        this.fragmentTracker.removeAllFragments();
      }
      hls.trigger(Events.AUDIO_TRACK_SWITCHED, data);
    }
  }
  onAudioTrackSwitched(event, data) {
    const trackId = data.id;
    const altAudio = !!this.hls.audioTracks[trackId].url;
    if (altAudio) {
      const videoBuffer = this.videoBuffer;
      // if we switched on alternate audio, ensure that main fragment scheduling is synced with video sourcebuffer buffered
      if (videoBuffer && this.mediaBuffer !== videoBuffer) {
        this.log('Switching on alternate audio, use video.buffered to schedule main fragment loading');
        this.mediaBuffer = videoBuffer;
      }
    }
    this.altAudio = altAudio;
    this.tick();
  }
  onBufferCreated(event, data) {
    const tracks = data.tracks;
    let mediaTrack;
    let name;
    let alternate = false;
    for (const type in tracks) {
      const track = tracks[type];
      if (track.id === 'main') {
        name = type;
        mediaTrack = track;
        // keep video source buffer reference
        if (type === 'video') {
          const videoTrack = tracks[type];
          if (videoTrack) {
            this.videoBuffer = videoTrack.buffer;
          }
        }
      } else {
        alternate = true;
      }
    }
    if (alternate && mediaTrack) {
      this.log(`Alternate track found, use ${name}.buffered to schedule main fragment loading`);
      this.mediaBuffer = mediaTrack.buffer;
    } else {
      this.mediaBuffer = this.media;
    }
  }
  onFragBuffered(event, data) {
    const {
      frag,
      part
    } = data;
    if (frag && frag.type !== PlaylistLevelType.MAIN) {
      return;
    }
    if (this.fragContextChanged(frag)) {
      // If a level switch was requested while a fragment was buffering, it will emit the FRAG_BUFFERED event upon completion
      // Avoid setting state back to IDLE, since that will interfere with a level switch
      this.warn(`Fragment ${frag.sn}${part ? ' p: ' + part.index : ''} of level ${frag.level} finished buffering, but was aborted. state: ${this.state}`);
      if (this.state === State.PARSED) {
        this.state = State.IDLE;
      }
      return;
    }
    const stats = part ? part.stats : frag.stats;
    this.fragLastKbps = Math.round(8 * stats.total / (stats.buffering.end - stats.loading.first));
    if (frag.sn !== 'initSegment') {
      this.fragPrevious = frag;
    }
    this.fragBufferedComplete(frag, part);
  }
  onError(event, data) {
    var _data$context;
    if (data.fatal) {
      this.state = State.ERROR;
      return;
    }
    switch (data.details) {
      case ErrorDetails.FRAG_GAP:
      case ErrorDetails.FRAG_PARSING_ERROR:
      case ErrorDetails.FRAG_DECRYPT_ERROR:
      case ErrorDetails.FRAG_LOAD_ERROR:
      case ErrorDetails.FRAG_LOAD_TIMEOUT:
      case ErrorDetails.KEY_LOAD_ERROR:
      case ErrorDetails.KEY_LOAD_TIMEOUT:
        this.onFragmentOrKeyLoadError(PlaylistLevelType.MAIN, data);
        break;
      case ErrorDetails.LEVEL_LOAD_ERROR:
      case ErrorDetails.LEVEL_LOAD_TIMEOUT:
      case ErrorDetails.LEVEL_PARSING_ERROR:
        // in case of non fatal error while loading level, if level controller is not retrying to load level, switch back to IDLE
        if (!data.levelRetry && this.state === State.WAITING_LEVEL && ((_data$context = data.context) == null ? void 0 : _data$context.type) === PlaylistContextType.LEVEL) {
          this.state = State.IDLE;
        }
        break;
      case ErrorDetails.BUFFER_FULL_ERROR:
        if (!data.parent || data.parent !== 'main') {
          return;
        }
        if (this.reduceLengthAndFlushBuffer(data)) {
          this.flushMainBuffer(0, Number.POSITIVE_INFINITY);
        }
        break;
      case ErrorDetails.INTERNAL_EXCEPTION:
        this.recoverWorkerError(data);
        break;
    }
  }

  // Checks the health of the buffer and attempts to resolve playback stalls.
  checkBuffer() {
    const {
      media,
      gapController
    } = this;
    if (!media || !gapController || !media.readyState) {
      // Exit early if we don't have media or if the media hasn't buffered anything yet (readyState 0)
      return;
    }
    if (this.loadedmetadata || !BufferHelper.getBuffered(media).length) {
      // Resolve gaps using the main buffer, whose ranges are the intersections of the A/V sourcebuffers
      const activeFrag = this.state !== State.IDLE ? this.fragCurrent : null;
      gapController.poll(this.lastCurrentTime, activeFrag);
    }
    this.lastCurrentTime = media.currentTime;
  }
  onFragLoadEmergencyAborted() {
    this.state = State.IDLE;
    // if loadedmetadata is not set, it means that we are emergency switch down on first frag
    // in that case, reset startFragRequested flag
    if (!this.loadedmetadata) {
      this.startFragRequested = false;
      this.nextLoadPosition = this.startPosition;
    }
    this.tickImmediate();
  }
  onBufferFlushed(event, {
    type
  }) {
    if (type !== ElementaryStreamTypes.AUDIO || this.audioOnly && !this.altAudio) {
      const mediaBuffer = (type === ElementaryStreamTypes.VIDEO ? this.videoBuffer : this.mediaBuffer) || this.media;
      this.afterBufferFlushed(mediaBuffer, type, PlaylistLevelType.MAIN);
    }
  }
  onLevelsUpdated(event, data) {
    this.levels = data.levels;
  }
  swapAudioCodec() {
    this.audioCodecSwap = !this.audioCodecSwap;
  }

  /**
   * Seeks to the set startPosition if not equal to the mediaElement's current time.
   */
  seekToStartPos() {
    const {
      media
    } = this;
    if (!media) {
      return;
    }
    const currentTime = media.currentTime;
    let startPosition = this.startPosition;
    // only adjust currentTime if different from startPosition or if startPosition not buffered
    // at that stage, there should be only one buffered range, as we reach that code after first fragment has been buffered
    if (startPosition >= 0 && currentTime < startPosition) {
      if (media.seeking) {
        this.log(`could not seek to ${startPosition}, already seeking at ${currentTime}`);
        return;
      }
      const buffered = BufferHelper.getBuffered(media);
      const bufferStart = buffered.length ? buffered.start(0) : 0;
      const delta = bufferStart - startPosition;
      if (delta > 0 && (delta < this.config.maxBufferHole || delta < this.config.maxFragLookUpTolerance)) {
        this.log(`adjusting start position by ${delta} to match buffer start`);
        startPosition += delta;
        this.startPosition = startPosition;
      }
      this.log(`seek to target start position ${startPosition} from current time ${currentTime}`);
      media.currentTime = startPosition;
    }
  }
  _getAudioCodec(currentLevel) {
    let audioCodec = this.config.defaultAudioCodec || currentLevel.audioCodec;
    if (this.audioCodecSwap && audioCodec) {
      this.log('Swapping audio codec');
      if (audioCodec.indexOf('mp4a.40.5') !== -1) {
        audioCodec = 'mp4a.40.2';
      } else {
        audioCodec = 'mp4a.40.5';
      }
    }
    return audioCodec;
  }
  _loadBitrateTestFrag(frag, level) {
    frag.bitrateTest = true;
    this._doFragLoad(frag, level).then(data => {
      const {
        hls
      } = this;
      if (!data || this.fragContextChanged(frag)) {
        return;
      }
      level.fragmentError = 0;
      this.state = State.IDLE;
      this.startFragRequested = false;
      this.bitrateTest = false;
      const stats = frag.stats;
      // Bitrate tests fragments are neither parsed nor buffered
      stats.parsing.start = stats.parsing.end = stats.buffering.start = stats.buffering.end = self.performance.now();
      hls.trigger(Events.FRAG_LOADED, data);
      frag.bitrateTest = false;
    });
  }
  _handleTransmuxComplete(transmuxResult) {
    var _id3$samples;
    const id = 'main';
    const {
      hls
    } = this;
    const {
      remuxResult,
      chunkMeta
    } = transmuxResult;
    const context = this.getCurrentContext(chunkMeta);
    if (!context) {
      this.resetWhenMissingContext(chunkMeta);
      return;
    }
    const {
      frag,
      part,
      level
    } = context;
    const {
      video,
      text,
      id3,
      initSegment
    } = remuxResult;
    const {
      details
    } = level;
    // The audio-stream-controller handles audio buffering if Hls.js is playing an alternate audio track
    const audio = this.altAudio ? undefined : remuxResult.audio;

    // Check if the current fragment has been aborted. We check this by first seeing if we're still playing the current level.
    // If we are, subsequently check if the currently loading fragment (fragCurrent) has changed.
    if (this.fragContextChanged(frag)) {
      this.fragmentTracker.removeFragment(frag);
      return;
    }
    this.state = State.PARSING;
    if (initSegment) {
      if (initSegment != null && initSegment.tracks) {
        const mapFragment = frag.initSegment || frag;
        this._bufferInitSegment(level, initSegment.tracks, mapFragment, chunkMeta);
        hls.trigger(Events.FRAG_PARSING_INIT_SEGMENT, {
          frag: mapFragment,
          id,
          tracks: initSegment.tracks
        });
      }

      // This would be nice if Number.isFinite acted as a typeguard, but it doesn't. See: https://github.com/Microsoft/TypeScript/issues/10038
      const initPTS = initSegment.initPTS;
      const timescale = initSegment.timescale;
      if (isFiniteNumber(initPTS)) {
        this.initPTS[frag.cc] = {
          baseTime: initPTS,
          timescale
        };
        hls.trigger(Events.INIT_PTS_FOUND, {
          frag,
          id,
          initPTS,
          timescale
        });
      }
    }

    // Avoid buffering if backtracking this fragment
    if (video && details && frag.sn !== 'initSegment') {
      const prevFrag = details.fragments[frag.sn - 1 - details.startSN];
      const isFirstFragment = frag.sn === details.startSN;
      const isFirstInDiscontinuity = !prevFrag || frag.cc > prevFrag.cc;
      if (remuxResult.independent !== false) {
        const {
          startPTS,
          endPTS,
          startDTS,
          endDTS
        } = video;
        if (part) {
          part.elementaryStreams[video.type] = {
            startPTS,
            endPTS,
            startDTS,
            endDTS
          };
        } else {
          if (video.firstKeyFrame && video.independent && chunkMeta.id === 1 && !isFirstInDiscontinuity) {
            this.couldBacktrack = true;
          }
          if (video.dropped && video.independent) {
            // Backtrack if dropped frames create a gap after currentTime

            const bufferInfo = this.getMainFwdBufferInfo();
            const targetBufferTime = (bufferInfo ? bufferInfo.end : this.getLoadPosition()) + this.config.maxBufferHole;
            const startTime = video.firstKeyFramePTS ? video.firstKeyFramePTS : startPTS;
            if (!isFirstFragment && targetBufferTime < startTime - this.config.maxBufferHole && !isFirstInDiscontinuity) {
              this.backtrack(frag);
              return;
            } else if (isFirstInDiscontinuity) {
              // Mark segment with a gap to avoid loop loading
              frag.gap = true;
            }
            // Set video stream start to fragment start so that truncated samples do not distort the timeline, and mark it partial
            frag.setElementaryStreamInfo(video.type, frag.start, endPTS, frag.start, endDTS, true);
          }
        }
        frag.setElementaryStreamInfo(video.type, startPTS, endPTS, startDTS, endDTS);
        if (this.backtrackFragment) {
          this.backtrackFragment = frag;
        }
        this.bufferFragmentData(video, frag, part, chunkMeta, isFirstFragment || isFirstInDiscontinuity);
      } else if (isFirstFragment || isFirstInDiscontinuity) {
        // Mark segment with a gap to avoid loop loading
        frag.gap = true;
      } else {
        this.backtrack(frag);
        return;
      }
    }
    if (audio) {
      const {
        startPTS,
        endPTS,
        startDTS,
        endDTS
      } = audio;
      if (part) {
        part.elementaryStreams[ElementaryStreamTypes.AUDIO] = {
          startPTS,
          endPTS,
          startDTS,
          endDTS
        };
      }
      frag.setElementaryStreamInfo(ElementaryStreamTypes.AUDIO, startPTS, endPTS, startDTS, endDTS);
      this.bufferFragmentData(audio, frag, part, chunkMeta);
    }
    if (details && id3 != null && (_id3$samples = id3.samples) != null && _id3$samples.length) {
      const emittedID3 = {
        id,
        frag,
        details,
        samples: id3.samples
      };
      hls.trigger(Events.FRAG_PARSING_METADATA, emittedID3);
    }
    if (details && text) {
      const emittedText = {
        id,
        frag,
        details,
        samples: text.samples
      };
      hls.trigger(Events.FRAG_PARSING_USERDATA, emittedText);
    }
  }
  _bufferInitSegment(currentLevel, tracks, frag, chunkMeta) {
    if (this.state !== State.PARSING) {
      return;
    }
    this.audioOnly = !!tracks.audio && !tracks.video;

    // if audio track is expected to come from audio stream controller, discard any coming from main
    if (this.altAudio && !this.audioOnly) {
      delete tracks.audio;
    }
    // include levelCodec in audio and video tracks
    const {
      audio,
      video,
      audiovideo
    } = tracks;
    if (audio) {
      let audioCodec = currentLevel.audioCodec;
      const ua = navigator.userAgent.toLowerCase();
      if (this.audioCodecSwitch) {
        if (audioCodec) {
          if (audioCodec.indexOf('mp4a.40.5') !== -1) {
            audioCodec = 'mp4a.40.2';
          } else {
            audioCodec = 'mp4a.40.5';
          }
        }
        // In the case that AAC and HE-AAC audio codecs are signalled in manifest,
        // force HE-AAC, as it seems that most browsers prefers it.
        // don't force HE-AAC if mono stream, or in Firefox
        if (audio.metadata.channelCount !== 1 && ua.indexOf('firefox') === -1) {
          audioCodec = 'mp4a.40.5';
        }
      }
      // HE-AAC is broken on Android, always signal audio codec as AAC even if variant manifest states otherwise
      if (ua.indexOf('android') !== -1 && audio.container !== 'audio/mpeg') {
        // Exclude mpeg audio
        audioCodec = 'mp4a.40.2';
        this.log(`Android: force audio codec to ${audioCodec}`);
      }
      if (currentLevel.audioCodec && currentLevel.audioCodec !== audioCodec) {
        this.log(`Swapping manifest audio codec "${currentLevel.audioCodec}" for "${audioCodec}"`);
      }
      audio.levelCodec = audioCodec;
      audio.id = 'main';
      this.log(`Init audio buffer, container:${audio.container}, codecs[selected/level/parsed]=[${audioCodec || ''}/${currentLevel.audioCodec || ''}/${audio.codec}]`);
    }
    if (video) {
      video.levelCodec = currentLevel.videoCodec;
      video.id = 'main';
      this.log(`Init video buffer, container:${video.container}, codecs[level/parsed]=[${currentLevel.videoCodec || ''}/${video.codec}]`);
    }
    if (audiovideo) {
      this.log(`Init audiovideo buffer, container:${audiovideo.container}, codecs[level/parsed]=[${currentLevel.attrs.CODECS || ''}/${audiovideo.codec}]`);
    }
    this.hls.trigger(Events.BUFFER_CODECS, tracks);
    // loop through tracks that are going to be provided to bufferController
    Object.keys(tracks).forEach(trackName => {
      const track = tracks[trackName];
      const initSegment = track.initSegment;
      if (initSegment != null && initSegment.byteLength) {
        this.hls.trigger(Events.BUFFER_APPENDING, {
          type: trackName,
          data: initSegment,
          frag,
          part: null,
          chunkMeta,
          parent: frag.type
        });
      }
    });
    // trigger handler right now
    this.tick();
  }
  getMainFwdBufferInfo() {
    return this.getFwdBufferInfo(this.mediaBuffer ? this.mediaBuffer : this.media, PlaylistLevelType.MAIN);
  }
  backtrack(frag) {
    this.couldBacktrack = true;
    // Causes findFragments to backtrack through fragments to find the keyframe
    this.backtrackFragment = frag;
    this.resetTransmuxer();
    this.flushBufferGap(frag);
    this.fragmentTracker.removeFragment(frag);
    this.fragPrevious = null;
    this.nextLoadPosition = frag.start;
    this.state = State.IDLE;
  }
  checkFragmentChanged() {
    const video = this.media;
    let fragPlayingCurrent = null;
    if (video && video.readyState > 1 && video.seeking === false) {
      const currentTime = video.currentTime;
      /* if video element is in seeked state, currentTime can only increase.
        (assuming that playback rate is positive ...)
        As sometimes currentTime jumps back to zero after a
        media decode error, check this, to avoid seeking back to
        wrong position after a media decode error
      */

      if (BufferHelper.isBuffered(video, currentTime)) {
        fragPlayingCurrent = this.getAppendedFrag(currentTime);
      } else if (BufferHelper.isBuffered(video, currentTime + 0.1)) {
        /* ensure that FRAG_CHANGED event is triggered at startup,
          when first video frame is displayed and playback is paused.
          add a tolerance of 100ms, in case current position is not buffered,
          check if current pos+100ms is buffered and use that buffer range
          for FRAG_CHANGED event reporting */
        fragPlayingCurrent = this.getAppendedFrag(currentTime + 0.1);
      }
      if (fragPlayingCurrent) {
        this.backtrackFragment = null;
        const fragPlaying = this.fragPlaying;
        const fragCurrentLevel = fragPlayingCurrent.level;
        if (!fragPlaying || fragPlayingCurrent.sn !== fragPlaying.sn || fragPlaying.level !== fragCurrentLevel || fragPlayingCurrent.urlId !== fragPlaying.urlId) {
          this.fragPlaying = fragPlayingCurrent;
          this.hls.trigger(Events.FRAG_CHANGED, {
            frag: fragPlayingCurrent
          });
          if (!fragPlaying || fragPlaying.level !== fragCurrentLevel) {
            this.hls.trigger(Events.LEVEL_SWITCHED, {
              level: fragCurrentLevel
            });
          }
        }
      }
    }
  }
  get nextLevel() {
    const frag = this.nextBufferedFrag;
    if (frag) {
      return frag.level;
    }
    return -1;
  }
  get currentFrag() {
    const media = this.media;
    if (media) {
      return this.fragPlaying || this.getAppendedFrag(media.currentTime);
    }
    return null;
  }
  get currentProgramDateTime() {
    const media = this.media;
    if (media) {
      const currentTime = media.currentTime;
      const frag = this.currentFrag;
      if (frag && isFiniteNumber(currentTime) && isFiniteNumber(frag.programDateTime)) {
        const epocMs = frag.programDateTime + (currentTime - frag.start) * 1000;
        return new Date(epocMs);
      }
    }
    return null;
  }
  get currentLevel() {
    const frag = this.currentFrag;
    if (frag) {
      return frag.level;
    }
    return -1;
  }
  get nextBufferedFrag() {
    const frag = this.currentFrag;
    if (frag) {
      return this.followingBufferedFrag(frag);
    }
    return null;
  }
  get forceStartLoad() {
    return this._forceStartLoad;
  }
}

/*
 * compute an Exponential Weighted moving average
 * - https://en.wikipedia.org/wiki/Moving_average#Exponential_moving_average
 *  - heavily inspired from shaka-player
 */

class EWMA {
  //  About half of the estimated value will be from the last |halfLife| samples by weight.
  constructor(halfLife, estimate = 0, weight = 0) {
    this.halfLife = void 0;
    this.alpha_ = void 0;
    this.estimate_ = void 0;
    this.totalWeight_ = void 0;
    this.halfLife = halfLife;
    // Larger values of alpha expire historical data more slowly.
    this.alpha_ = halfLife ? Math.exp(Math.log(0.5) / halfLife) : 0;
    this.estimate_ = estimate;
    this.totalWeight_ = weight;
  }
  sample(weight, value) {
    const adjAlpha = Math.pow(this.alpha_, weight);
    this.estimate_ = value * (1 - adjAlpha) + adjAlpha * this.estimate_;
    this.totalWeight_ += weight;
  }
  getTotalWeight() {
    return this.totalWeight_;
  }
  getEstimate() {
    if (this.alpha_) {
      const zeroFactor = 1 - Math.pow(this.alpha_, this.totalWeight_);
      if (zeroFactor) {
        return this.estimate_ / zeroFactor;
      }
    }
    return this.estimate_;
  }
}

/*
 * EWMA Bandwidth Estimator
 *  - heavily inspired from shaka-player
 * Tracks bandwidth samples and estimates available bandwidth.
 * Based on the minimum of two exponentially-weighted moving averages with
 * different half-lives.
 */

class EwmaBandWidthEstimator {
  constructor(slow, fast, defaultEstimate, defaultTTFB = 100) {
    this.defaultEstimate_ = void 0;
    this.minWeight_ = void 0;
    this.minDelayMs_ = void 0;
    this.slow_ = void 0;
    this.fast_ = void 0;
    this.defaultTTFB_ = void 0;
    this.ttfb_ = void 0;
    this.defaultEstimate_ = defaultEstimate;
    this.minWeight_ = 0.001;
    this.minDelayMs_ = 50;
    this.slow_ = new EWMA(slow);
    this.fast_ = new EWMA(fast);
    this.defaultTTFB_ = defaultTTFB;
    this.ttfb_ = new EWMA(slow);
  }
  update(slow, fast) {
    const {
      slow_,
      fast_,
      ttfb_
    } = this;
    if (slow_.halfLife !== slow) {
      this.slow_ = new EWMA(slow, slow_.getEstimate(), slow_.getTotalWeight());
    }
    if (fast_.halfLife !== fast) {
      this.fast_ = new EWMA(fast, fast_.getEstimate(), fast_.getTotalWeight());
    }
    if (ttfb_.halfLife !== slow) {
      this.ttfb_ = new EWMA(slow, ttfb_.getEstimate(), ttfb_.getTotalWeight());
    }
  }
  sample(durationMs, numBytes) {
    durationMs = Math.max(durationMs, this.minDelayMs_);
    const numBits = 8 * numBytes;
    // weight is duration in seconds
    const durationS = durationMs / 1000;
    // value is bandwidth in bits/s
    const bandwidthInBps = numBits / durationS;
    this.fast_.sample(durationS, bandwidthInBps);
    this.slow_.sample(durationS, bandwidthInBps);
  }
  sampleTTFB(ttfb) {
    // weight is frequency curve applied to TTFB in seconds
    // (longer times have less weight with expected input under 1 second)
    const seconds = ttfb / 1000;
    const weight = Math.sqrt(2) * Math.exp(-Math.pow(seconds, 2) / 2);
    this.ttfb_.sample(weight, Math.max(ttfb, 5));
  }
  canEstimate() {
    return this.fast_.getTotalWeight() >= this.minWeight_;
  }
  getEstimate() {
    if (this.canEstimate()) {
      // console.log('slow estimate:'+ Math.round(this.slow_.getEstimate()));
      // console.log('fast estimate:'+ Math.round(this.fast_.getEstimate()));
      // Take the minimum of these two estimates.  This should have the effect of
      // adapting down quickly, but up more slowly.
      return Math.min(this.fast_.getEstimate(), this.slow_.getEstimate());
    } else {
      return this.defaultEstimate_;
    }
  }
  getEstimateTTFB() {
    if (this.ttfb_.getTotalWeight() >= this.minWeight_) {
      return this.ttfb_.getEstimate();
    } else {
      return this.defaultTTFB_;
    }
  }
  destroy() {}
}

class AbrController {
  constructor(hls) {
    this.hls = void 0;
    this.lastLevelLoadSec = 0;
    this.lastLoadedFragLevel = 0;
    this._nextAutoLevel = -1;
    this.timer = -1;
    this.onCheck = this._abandonRulesCheck.bind(this);
    this.fragCurrent = null;
    this.partCurrent = null;
    this.bitrateTestDelay = 0;
    this.bwEstimator = void 0;
    this.hls = hls;
    const config = hls.config;
    this.bwEstimator = new EwmaBandWidthEstimator(config.abrEwmaSlowVoD, config.abrEwmaFastVoD, config.abrEwmaDefaultEstimate);
    this.registerListeners();
  }
  registerListeners() {
    const {
      hls
    } = this;
    hls.on(Events.FRAG_LOADING, this.onFragLoading, this);
    hls.on(Events.FRAG_LOADED, this.onFragLoaded, this);
    hls.on(Events.FRAG_BUFFERED, this.onFragBuffered, this);
    hls.on(Events.LEVEL_SWITCHING, this.onLevelSwitching, this);
    hls.on(Events.LEVEL_LOADED, this.onLevelLoaded, this);
  }
  unregisterListeners() {
    const {
      hls
    } = this;
    hls.off(Events.FRAG_LOADING, this.onFragLoading, this);
    hls.off(Events.FRAG_LOADED, this.onFragLoaded, this);
    hls.off(Events.FRAG_BUFFERED, this.onFragBuffered, this);
    hls.off(Events.LEVEL_SWITCHING, this.onLevelSwitching, this);
    hls.off(Events.LEVEL_LOADED, this.onLevelLoaded, this);
  }
  destroy() {
    this.unregisterListeners();
    this.clearTimer();
    // @ts-ignore
    this.hls = this.onCheck = null;
    this.fragCurrent = this.partCurrent = null;
  }
  onFragLoading(event, data) {
    var _data$part;
    const frag = data.frag;
    if (this.ignoreFragment(frag)) {
      return;
    }
    this.fragCurrent = frag;
    this.partCurrent = (_data$part = data.part) != null ? _data$part : null;
    this.clearTimer();
    this.timer = self.setInterval(this.onCheck, 100);
  }
  onLevelSwitching(event, data) {
    this.clearTimer();
  }
  getTimeToLoadFrag(timeToFirstByteSec, bandwidth, fragSizeBits, isSwitch) {
    const fragLoadSec = timeToFirstByteSec + fragSizeBits / bandwidth;
    const playlistLoadSec = isSwitch ? this.lastLevelLoadSec : 0;
    return fragLoadSec + playlistLoadSec;
  }
  onLevelLoaded(event, data) {
    const config = this.hls.config;
    const {
      total,
      bwEstimate
    } = data.stats;
    // Total is the bytelength and bwEstimate in bits/sec
    if (isFiniteNumber(total) && isFiniteNumber(bwEstimate)) {
      this.lastLevelLoadSec = 8 * total / bwEstimate;
    }
    if (data.details.live) {
      this.bwEstimator.update(config.abrEwmaSlowLive, config.abrEwmaFastLive);
    } else {
      this.bwEstimator.update(config.abrEwmaSlowVoD, config.abrEwmaFastVoD);
    }
  }

  /*
      This method monitors the download rate of the current fragment, and will downswitch if that fragment will not load
      quickly enough to prevent underbuffering
    */
  _abandonRulesCheck() {
    const {
      fragCurrent: frag,
      partCurrent: part,
      hls
    } = this;
    const {
      autoLevelEnabled,
      media
    } = hls;
    if (!frag || !media) {
      return;
    }
    const now = performance.now();
    const stats = part ? part.stats : frag.stats;
    const duration = part ? part.duration : frag.duration;
    const timeLoading = now - stats.loading.start;
    // If frag loading is aborted, complete, or from lowest level, stop timer and return
    if (stats.aborted || stats.loaded && stats.loaded === stats.total || frag.level === 0) {
      this.clearTimer();
      // reset forced auto level value so that next level will be selected
      this._nextAutoLevel = -1;
      return;
    }

    // This check only runs if we're in ABR mode and actually playing
    if (!autoLevelEnabled || media.paused || !media.playbackRate || !media.readyState) {
      return;
    }
    const bufferInfo = hls.mainForwardBufferInfo;
    if (bufferInfo === null) {
      return;
    }
    const ttfbEstimate = this.bwEstimator.getEstimateTTFB();
    const playbackRate = Math.abs(media.playbackRate);
    // To maintain stable adaptive playback, only begin monitoring frag loading after half or more of its playback duration has passed
    if (timeLoading <= Math.max(ttfbEstimate, 1000 * (duration / (playbackRate * 2)))) {
      return;
    }

    // bufferStarvationDelay is an estimate of the amount time (in seconds) it will take to exhaust the buffer
    const bufferStarvationDelay = bufferInfo.len / playbackRate;
    // Only downswitch if less than 2 fragment lengths are buffered
    if (bufferStarvationDelay >= 2 * duration / playbackRate) {
      return;
    }
    const ttfb = stats.loading.first ? stats.loading.first - stats.loading.start : -1;
    const loadedFirstByte = stats.loaded && ttfb > -1;
    const bwEstimate = this.bwEstimator.getEstimate();
    const {
      levels,
      minAutoLevel
    } = hls;
    const level = levels[frag.level];
    const expectedLen = stats.total || Math.max(stats.loaded, Math.round(duration * level.maxBitrate / 8));
    let timeStreaming = timeLoading - ttfb;
    if (timeStreaming < 1 && loadedFirstByte) {
      timeStreaming = Math.min(timeLoading, stats.loaded * 8 / bwEstimate);
    }
    const loadRate = loadedFirstByte ? stats.loaded * 1000 / timeStreaming : 0;
    // fragLoadDelay is an estimate of the time (in seconds) it will take to buffer the remainder of the fragment
    const fragLoadedDelay = loadRate ? (expectedLen - stats.loaded) / loadRate : expectedLen * 8 / bwEstimate + ttfbEstimate / 1000;
    // Only downswitch if the time to finish loading the current fragment is greater than the amount of buffer left
    if (fragLoadedDelay <= bufferStarvationDelay) {
      return;
    }
    const bwe = loadRate ? loadRate * 8 : bwEstimate;
    let fragLevelNextLoadedDelay = Number.POSITIVE_INFINITY;
    let nextLoadLevel;
    // Iterate through lower level and try to find the largest one that avoids rebuffering
    for (nextLoadLevel = frag.level - 1; nextLoadLevel > minAutoLevel; nextLoadLevel--) {
      // compute time to load next fragment at lower level
      // 8 = bits per byte (bps/Bps)
      const levelNextBitrate = levels[nextLoadLevel].maxBitrate;
      fragLevelNextLoadedDelay = this.getTimeToLoadFrag(ttfbEstimate / 1000, bwe, duration * levelNextBitrate, !levels[nextLoadLevel].details);
      if (fragLevelNextLoadedDelay < bufferStarvationDelay) {
        break;
      }
    }
    // Only emergency switch down if it takes less time to load a new fragment at lowest level instead of continuing
    // to load the current one
    if (fragLevelNextLoadedDelay >= fragLoadedDelay) {
      return;
    }

    // if estimated load time of new segment is completely unreasonable, ignore and do not emergency switch down
    if (fragLevelNextLoadedDelay > duration * 10) {
      return;
    }
    hls.nextLoadLevel = nextLoadLevel;
    if (loadedFirstByte) {
      // If there has been loading progress, sample bandwidth using loading time offset by minimum TTFB time
      this.bwEstimator.sample(timeLoading - Math.min(ttfbEstimate, ttfb), stats.loaded);
    } else {
      // If there has been no loading progress, sample TTFB
      this.bwEstimator.sampleTTFB(timeLoading);
    }
    this.clearTimer();
    logger.warn(`[abr] Fragment ${frag.sn}${part ? ' part ' + part.index : ''} of level ${frag.level} is loading too slowly;
      Time to underbuffer: ${bufferStarvationDelay.toFixed(3)} s
      Estimated load time for current fragment: ${fragLoadedDelay.toFixed(3)} s
      Estimated load time for down switch fragment: ${fragLevelNextLoadedDelay.toFixed(3)} s
      TTFB estimate: ${ttfb}
      Current BW estimate: ${isFiniteNumber(bwEstimate) ? (bwEstimate / 1024).toFixed(3) : 'Unknown'} Kb/s
      New BW estimate: ${(this.bwEstimator.getEstimate() / 1024).toFixed(3)} Kb/s
      Aborting and switching to level ${nextLoadLevel}`);
    if (frag.loader) {
      this.fragCurrent = this.partCurrent = null;
      frag.abortRequests();
    }
    hls.trigger(Events.FRAG_LOAD_EMERGENCY_ABORTED, {
      frag,
      part,
      stats
    });
  }
  onFragLoaded(event, {
    frag,
    part
  }) {
    const stats = part ? part.stats : frag.stats;
    if (frag.type === PlaylistLevelType.MAIN) {
      this.bwEstimator.sampleTTFB(stats.loading.first - stats.loading.start);
    }
    if (this.ignoreFragment(frag)) {
      return;
    }
    // stop monitoring bw once frag loaded
    this.clearTimer();
    // store level id after successful fragment load
    this.lastLoadedFragLevel = frag.level;
    // reset forced auto level value so that next level will be selected
    this._nextAutoLevel = -1;

    // compute level average bitrate
    if (this.hls.config.abrMaxWithRealBitrate) {
      const duration = part ? part.duration : frag.duration;
      const level = this.hls.levels[frag.level];
      const loadedBytes = (level.loaded ? level.loaded.bytes : 0) + stats.loaded;
      const loadedDuration = (level.loaded ? level.loaded.duration : 0) + duration;
      level.loaded = {
        bytes: loadedBytes,
        duration: loadedDuration
      };
      level.realBitrate = Math.round(8 * loadedBytes / loadedDuration);
    }
    if (frag.bitrateTest) {
      const fragBufferedData = {
        stats,
        frag,
        part,
        id: frag.type
      };
      this.onFragBuffered(Events.FRAG_BUFFERED, fragBufferedData);
      frag.bitrateTest = false;
    }
  }
  onFragBuffered(event, data) {
    const {
      frag,
      part
    } = data;
    const stats = part != null && part.stats.loaded ? part.stats : frag.stats;
    if (stats.aborted) {
      return;
    }
    if (this.ignoreFragment(frag)) {
      return;
    }
    // Use the difference between parsing and request instead of buffering and request to compute fragLoadingProcessing;
    // rationale is that buffer appending only happens once media is attached. This can happen when config.startFragPrefetch
    // is used. If we used buffering in that case, our BW estimate sample will be very large.
    const processingMs = stats.parsing.end - stats.loading.start - Math.min(stats.loading.first - stats.loading.start, this.bwEstimator.getEstimateTTFB());
    this.bwEstimator.sample(processingMs, stats.loaded);
    stats.bwEstimate = this.bwEstimator.getEstimate();
    if (frag.bitrateTest) {
      this.bitrateTestDelay = processingMs / 1000;
    } else {
      this.bitrateTestDelay = 0;
    }
  }
  ignoreFragment(frag) {
    // Only count non-alt-audio frags which were actually buffered in our BW calculations
    return frag.type !== PlaylistLevelType.MAIN || frag.sn === 'initSegment';
  }
  clearTimer() {
    self.clearInterval(this.timer);
  }

  // return next auto level
  get nextAutoLevel() {
    const forcedAutoLevel = this._nextAutoLevel;
    const bwEstimator = this.bwEstimator;
    // in case next auto level has been forced, and bw not available or not reliable, return forced value
    if (forcedAutoLevel !== -1 && !bwEstimator.canEstimate()) {
      return forcedAutoLevel;
    }

    // compute next level using ABR logic
    let nextABRAutoLevel = this.getNextABRAutoLevel();
    // use forced auto level when ABR selected level has errored
    if (forcedAutoLevel !== -1) {
      const levels = this.hls.levels;
      if (levels.length > Math.max(forcedAutoLevel, nextABRAutoLevel) && levels[forcedAutoLevel].loadError <= levels[nextABRAutoLevel].loadError) {
        return forcedAutoLevel;
      }
    }
    // if forced auto level has been defined, use it to cap ABR computed quality level
    if (forcedAutoLevel !== -1) {
      nextABRAutoLevel = Math.min(forcedAutoLevel, nextABRAutoLevel);
    }
    return nextABRAutoLevel;
  }
  getNextABRAutoLevel() {
    const {
      fragCurrent,
      partCurrent,
      hls
    } = this;
    const {
      maxAutoLevel,
      config,
      minAutoLevel,
      media
    } = hls;
    const currentFragDuration = partCurrent ? partCurrent.duration : fragCurrent ? fragCurrent.duration : 0;

    // playbackRate is the absolute value of the playback rate; if media.playbackRate is 0, we use 1 to load as
    // if we're playing back at the normal rate.
    const playbackRate = media && media.playbackRate !== 0 ? Math.abs(media.playbackRate) : 1.0;
    const avgbw = this.bwEstimator ? this.bwEstimator.getEstimate() : config.abrEwmaDefaultEstimate;
    // bufferStarvationDelay is the wall-clock time left until the playback buffer is exhausted.
    const bufferInfo = hls.mainForwardBufferInfo;
    const bufferStarvationDelay = (bufferInfo ? bufferInfo.len : 0) / playbackRate;

    // First, look to see if we can find a level matching with our avg bandwidth AND that could also guarantee no rebuffering at all
    let bestLevel = this.findBestLevel(avgbw, minAutoLevel, maxAutoLevel, bufferStarvationDelay, config.abrBandWidthFactor, config.abrBandWidthUpFactor);
    if (bestLevel >= 0) {
      return bestLevel;
    }
    logger.trace(`[abr] ${bufferStarvationDelay ? 'rebuffering expected' : 'buffer is empty'}, finding optimal quality level`);
    // not possible to get rid of rebuffering ... let's try to find level that will guarantee less than maxStarvationDelay of rebuffering
    // if no matching level found, logic will return 0
    let maxStarvationDelay = currentFragDuration ? Math.min(currentFragDuration, config.maxStarvationDelay) : config.maxStarvationDelay;
    let bwFactor = config.abrBandWidthFactor;
    let bwUpFactor = config.abrBandWidthUpFactor;
    if (!bufferStarvationDelay) {
      // in case buffer is empty, let's check if previous fragment was loaded to perform a bitrate test
      const bitrateTestDelay = this.bitrateTestDelay;
      if (bitrateTestDelay) {
        // if it is the case, then we need to adjust our max starvation delay using maxLoadingDelay config value
        // max video loading delay used in  automatic start level selection :
        // in that mode ABR controller will ensure that video loading time (ie the time to fetch the first fragment at lowest quality level +
        // the time to fetch the fragment at the appropriate quality level is less than ```maxLoadingDelay``` )
        // cap maxLoadingDelay and ensure it is not bigger 'than bitrate test' frag duration
        const maxLoadingDelay = currentFragDuration ? Math.min(currentFragDuration, config.maxLoadingDelay) : config.maxLoadingDelay;
        maxStarvationDelay = maxLoadingDelay - bitrateTestDelay;
        logger.trace(`[abr] bitrate test took ${Math.round(1000 * bitrateTestDelay)}ms, set first fragment max fetchDuration to ${Math.round(1000 * maxStarvationDelay)} ms`);
        // don't use conservative factor on bitrate test
        bwFactor = bwUpFactor = 1;
      }
    }
    bestLevel = this.findBestLevel(avgbw, minAutoLevel, maxAutoLevel, bufferStarvationDelay + maxStarvationDelay, bwFactor, bwUpFactor);
    return Math.max(bestLevel, 0);
  }
  findBestLevel(currentBw, minAutoLevel, maxAutoLevel, maxFetchDuration, bwFactor, bwUpFactor) {
    var _level$details;
    const {
      fragCurrent,
      partCurrent,
      lastLoadedFragLevel: currentLevel
    } = this;
    const {
      levels
    } = this.hls;
    const level = levels[currentLevel];
    const live = !!(level != null && (_level$details = level.details) != null && _level$details.live);
    const currentCodecSet = level == null ? void 0 : level.codecSet;
    const currentFragDuration = partCurrent ? partCurrent.duration : fragCurrent ? fragCurrent.duration : 0;
    const ttfbEstimateSec = this.bwEstimator.getEstimateTTFB() / 1000;
    let levelSkippedMin = minAutoLevel;
    let levelSkippedMax = -1;
    for (let i = maxAutoLevel; i >= minAutoLevel; i--) {
      const levelInfo = levels[i];
      if (!levelInfo || currentCodecSet && levelInfo.codecSet !== currentCodecSet) {
        if (levelInfo) {
          levelSkippedMin = Math.min(i, levelSkippedMin);
          levelSkippedMax = Math.max(i, levelSkippedMax);
        }
        continue;
      }
      if (levelSkippedMax !== -1) {
        logger.trace(`[abr] Skipped level(s) ${levelSkippedMin}-${levelSkippedMax} with CODECS:"${levels[levelSkippedMax].attrs.CODECS}"; not compatible with "${level.attrs.CODECS}"`);
      }
      const levelDetails = levelInfo.details;
      const avgDuration = (partCurrent ? levelDetails == null ? void 0 : levelDetails.partTarget : levelDetails == null ? void 0 : levelDetails.averagetargetduration) || currentFragDuration;
      let adjustedbw;
      // follow algorithm captured from stagefright :
      // https://android.googlesource.com/platform/frameworks/av/+/master/media/libstagefright/httplive/LiveSession.cpp
      // Pick the highest bandwidth stream below or equal to estimated bandwidth.
      // consider only 80% of the available bandwidth, but if we are switching up,
      // be even more conservative (70%) to avoid overestimating and immediately
      // switching back.
      if (i <= currentLevel) {
        adjustedbw = bwFactor * currentBw;
      } else {
        adjustedbw = bwUpFactor * currentBw;
      }
      const bitrate = levels[i].maxBitrate;
      const fetchDuration = this.getTimeToLoadFrag(ttfbEstimateSec, adjustedbw, bitrate * avgDuration, levelDetails === undefined);
      logger.trace(`[abr] level:${i} adjustedbw-bitrate:${Math.round(adjustedbw - bitrate)} avgDuration:${avgDuration.toFixed(1)} maxFetchDuration:${maxFetchDuration.toFixed(1)} fetchDuration:${fetchDuration.toFixed(1)}`);
      // if adjusted bw is greater than level bitrate AND
      if (adjustedbw > bitrate && (
      // fragment fetchDuration unknown OR live stream OR fragment fetchDuration less than max allowed fetch duration, then this level matches
      // we don't account for max Fetch Duration for live streams, this is to avoid switching down when near the edge of live sliding window ...
      // special case to support startLevel = -1 (bitrateTest) on live streams : in that case we should not exit loop so that findBestLevel will return -1
      fetchDuration === 0 || !isFiniteNumber(fetchDuration) || live && !this.bitrateTestDelay || fetchDuration < maxFetchDuration)) {
        // as we are looping from highest to lowest, this will return the best achievable quality level
        return i;
      }
    }
    // not enough time budget even with quality level 0 ... rebuffering might happen
    return -1;
  }
  set nextAutoLevel(nextLevel) {
    this._nextAutoLevel = nextLevel;
  }
}

class BufferOperationQueue {
  constructor(sourceBufferReference) {
    this.buffers = void 0;
    this.queues = {
      video: [],
      audio: [],
      audiovideo: []
    };
    this.buffers = sourceBufferReference;
  }
  append(operation, type) {
    const queue = this.queues[type];
    queue.push(operation);
    if (queue.length === 1 && this.buffers[type]) {
      this.executeNext(type);
    }
  }
  insertAbort(operation, type) {
    const queue = this.queues[type];
    queue.unshift(operation);
    this.executeNext(type);
  }
  appendBlocker(type) {
    let execute;
    const promise = new Promise(resolve => {
      execute = resolve;
    });
    const operation = {
      execute,
      onStart: () => {},
      onComplete: () => {},
      onError: () => {}
    };
    this.append(operation, type);
    return promise;
  }
  executeNext(type) {
    const {
      buffers,
      queues
    } = this;
    const sb = buffers[type];
    const queue = queues[type];
    if (queue.length) {
      const operation = queue[0];
      try {
        // Operations are expected to result in an 'updateend' event being fired. If not, the queue will lock. Operations
        // which do not end with this event must call _onSBUpdateEnd manually
        operation.execute();
      } catch (e) {
        logger.warn('[buffer-operation-queue]: Unhandled exception executing the current operation');
        operation.onError(e);

        // Only shift the current operation off, otherwise the updateend handler will do this for us
        if (!(sb != null && sb.updating)) {
          queue.shift();
          this.executeNext(type);
        }
      }
    }
  }
  shiftAndExecuteNext(type) {
    this.queues[type].shift();
    this.executeNext(type);
  }
  current(type) {
    return this.queues[type][0];
  }
}

const MediaSource = getMediaSource();
const VIDEO_CODEC_PROFILE_REPACE = /([ha]vc.)(?:\.[^.,]+)+/;
class BufferController {
  // The level details used to determine duration, target-duration and live

  // cache the self generated object url to detect hijack of video tag

  // A queue of buffer operations which require the SourceBuffer to not be updating upon execution

  // References to event listeners for each SourceBuffer, so that they can be referenced for event removal

  // The number of BUFFER_CODEC events received before any sourceBuffers are created

  // The total number of BUFFER_CODEC events received

  // A reference to the attached media element

  // A reference to the active media source

  // Last MP3 audio chunk appended

  // counters

  constructor(hls) {
    this.details = null;
    this._objectUrl = null;
    this.operationQueue = void 0;
    this.listeners = void 0;
    this.hls = void 0;
    this.bufferCodecEventsExpected = 0;
    this._bufferCodecEventsTotal = 0;
    this.media = null;
    this.mediaSource = null;
    this.lastMpegAudioChunk = null;
    this.appendError = 0;
    this.tracks = {};
    this.pendingTracks = {};
    this.sourceBuffer = void 0;
    // Keep as arrow functions so that we can directly reference these functions directly as event listeners
    this._onMediaSourceOpen = () => {
      const {
        media,
        mediaSource
      } = this;
      logger.log('[buffer-controller]: Media source opened');
      if (media) {
        media.removeEventListener('emptied', this._onMediaEmptied);
        this.updateMediaElementDuration();
        this.hls.trigger(Events.MEDIA_ATTACHED, {
          media
        });
      }
      if (mediaSource) {
        // once received, don't listen anymore to sourceopen event
        mediaSource.removeEventListener('sourceopen', this._onMediaSourceOpen);
      }
      this.checkPendingTracks();
    };
    this._onMediaSourceClose = () => {
      logger.log('[buffer-controller]: Media source closed');
    };
    this._onMediaSourceEnded = () => {
      logger.log('[buffer-controller]: Media source ended');
    };
    this._onMediaEmptied = () => {
      const {
        media,
        _objectUrl
      } = this;
      if (media && media.src !== _objectUrl) {
        logger.error(`Media element src was set while attaching MediaSource (${_objectUrl} > ${media.src})`);
      }
    };
    this.hls = hls;
    this._initSourceBuffer();
    this.registerListeners();
  }
  hasSourceTypes() {
    return this.getSourceBufferTypes().length > 0 || Object.keys(this.pendingTracks).length > 0;
  }
  destroy() {
    this.unregisterListeners();
    this.details = null;
    this.lastMpegAudioChunk = null;
  }
  registerListeners() {
    const {
      hls
    } = this;
    hls.on(Events.MEDIA_ATTACHING, this.onMediaAttaching, this);
    hls.on(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    hls.on(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.on(Events.MANIFEST_PARSED, this.onManifestParsed, this);
    hls.on(Events.BUFFER_RESET, this.onBufferReset, this);
    hls.on(Events.BUFFER_APPENDING, this.onBufferAppending, this);
    hls.on(Events.BUFFER_CODECS, this.onBufferCodecs, this);
    hls.on(Events.BUFFER_EOS, this.onBufferEos, this);
    hls.on(Events.BUFFER_FLUSHING, this.onBufferFlushing, this);
    hls.on(Events.LEVEL_UPDATED, this.onLevelUpdated, this);
    hls.on(Events.FRAG_PARSED, this.onFragParsed, this);
    hls.on(Events.FRAG_CHANGED, this.onFragChanged, this);
  }
  unregisterListeners() {
    const {
      hls
    } = this;
    hls.off(Events.MEDIA_ATTACHING, this.onMediaAttaching, this);
    hls.off(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
    hls.off(Events.MANIFEST_LOADING, this.onManifestLoading, this);
    hls.off(Events.MANIFEST_PARSED, this.onManifestParsed, this);
    hls.off(Events.BUFFER_RESET, this.onBufferReset, this);
    hls.off(Events.BUFFER_APPENDING, this.onBufferAppending, this);
    hls.off(Events.BUFFER_CODECS, this.onBufferCodecs, this);
    hls.off(Events.BUFFER_EOS, this.onBufferEos, this);
    hls.off(Events.BUFFER_FLUSHING, this.onBufferFlushing, this);
    hls.off(Events.LEVEL_UPDATED, this.onLevelUpdated, this);
    hls.off(Events.FRAG_PARSED, this.onFragParsed, this);
    hls.off(Events.FRAG_CHANGED, this.onFragChanged, this);
  }
  _initSourceBuffer() {
    this.sourceBuffer = {};
    this.operationQueue = new BufferOperationQueue(this.sourceBuffer);
    this.listeners = {
      audio: [],
      video: [],
      audiovideo: []
    };
    this.lastMpegAudioChunk = null;
  }
  onManifestLoading() {
    this.bufferCodecEventsExpected = this._bufferCodecEventsTotal = 0;
    this.details = null;
  }
  onManifestParsed(event, data) {
    // in case of alt audio 2 BUFFER_CODECS events will be triggered, one per stream controller
    // sourcebuffers will be created all at once when the expected nb of tracks will be reached
    // in case alt audio is not used, only one BUFFER_CODEC event will be fired from main stream controller
    // it will contain the expected nb of source buffers, no need to compute it
    let codecEvents = 2;
    if (data.audio && !data.video || !data.altAudio || !false) {
      codecEvents = 1;
    }
    this.bufferCodecEventsExpected = this._bufferCodecEventsTotal = codecEvents;
    logger.log(`${this.bufferCodecEventsExpected} bufferCodec event(s) expected`);
  }
  onMediaAttaching(event, data) {
    const media = this.media = data.media;
    if (media && MediaSource) {
      const ms = this.mediaSource = new MediaSource();
      // MediaSource listeners are arrow functions with a lexical scope, and do not need to be bound
      ms.addEventListener('sourceopen', this._onMediaSourceOpen);
      ms.addEventListener('sourceended', this._onMediaSourceEnded);
      ms.addEventListener('sourceclose', this._onMediaSourceClose);
      // link video and media Source
      media.src = self.URL.createObjectURL(ms);
      // cache the locally generated object url
      this._objectUrl = media.src;
      media.addEventListener('emptied', this._onMediaEmptied);
    }
  }
  onMediaDetaching() {
    const {
      media,
      mediaSource,
      _objectUrl
    } = this;
    if (mediaSource) {
      logger.log('[buffer-controller]: media source detaching');
      if (mediaSource.readyState === 'open') {
        try {
          // endOfStream could trigger exception if any sourcebuffer is in updating state
          // we don't really care about checking sourcebuffer state here,
          // as we are anyway detaching the MediaSource
          // let's just avoid this exception to propagate
          mediaSource.endOfStream();
        } catch (err) {
          logger.warn(`[buffer-controller]: onMediaDetaching: ${err.message} while calling endOfStream`);
        }
      }
      // Clean up the SourceBuffers by invoking onBufferReset
      this.onBufferReset();
      mediaSource.removeEventListener('sourceopen', this._onMediaSourceOpen);
      mediaSource.removeEventListener('sourceended', this._onMediaSourceEnded);
      mediaSource.removeEventListener('sourceclose', this._onMediaSourceClose);

      // Detach properly the MediaSource from the HTMLMediaElement as
      // suggested in https://github.com/w3c/media-source/issues/53.
      if (media) {
        media.removeEventListener('emptied', this._onMediaEmptied);
        if (_objectUrl) {
          self.URL.revokeObjectURL(_objectUrl);
        }

        // clean up video tag src only if it's our own url. some external libraries might
        // hijack the video tag and change its 'src' without destroying the Hls instance first
        if (media.src === _objectUrl) {
          media.removeAttribute('src');
          media.load();
        } else {
          logger.warn('[buffer-controller]: media.src was changed by a third party - skip cleanup');
        }
      }
      this.mediaSource = null;
      this.media = null;
      this._objectUrl = null;
      this.bufferCodecEventsExpected = this._bufferCodecEventsTotal;
      this.pendingTracks = {};
      this.tracks = {};
    }
    this.hls.trigger(Events.MEDIA_DETACHED, undefined);
  }
  onBufferReset() {
    this.getSourceBufferTypes().forEach(type => {
      const sb = this.sourceBuffer[type];
      try {
        if (sb) {
          this.removeBufferListeners(type);
          if (this.mediaSource) {
            this.mediaSource.removeSourceBuffer(sb);
          }
          // Synchronously remove the SB from the map before the next call in order to prevent an async function from
          // accessing it
          this.sourceBuffer[type] = undefined;
        }
      } catch (err) {
        logger.warn(`[buffer-controller]: Failed to reset the ${type} buffer`, err);
      }
    });
    this._initSourceBuffer();
  }
  onBufferCodecs(event, data) {
    const sourceBufferCount = this.getSourceBufferTypes().length;
    Object.keys(data).forEach(trackName => {
      if (sourceBufferCount) {
        // check if SourceBuffer codec needs to change
        const track = this.tracks[trackName];
        if (track && typeof track.buffer.changeType === 'function') {
          const {
            id,
            codec,
            levelCodec,
            container,
            metadata
          } = data[trackName];
          const currentCodec = (track.levelCodec || track.codec).replace(VIDEO_CODEC_PROFILE_REPACE, '$1');
          const nextCodec = (levelCodec || codec).replace(VIDEO_CODEC_PROFILE_REPACE, '$1');
          if (currentCodec !== nextCodec) {
            const mimeType = `${container};codecs=${levelCodec || codec}`;
            this.appendChangeType(trackName, mimeType);
            logger.log(`[buffer-controller]: switching codec ${currentCodec} to ${nextCodec}`);
            this.tracks[trackName] = {
              buffer: track.buffer,
              codec,
              container,
              levelCodec,
              metadata,
              id
            };
          }
        }
      } else {
        // if source buffer(s) not created yet, appended buffer tracks in this.pendingTracks
        this.pendingTracks[trackName] = data[trackName];
      }
    });

    // if sourcebuffers already created, do nothing ...
    if (sourceBufferCount) {
      return;
    }
    this.bufferCodecEventsExpected = Math.max(this.bufferCodecEventsExpected - 1, 0);
    if (this.mediaSource && this.mediaSource.readyState === 'open') {
      this.checkPendingTracks();
    }
  }
  appendChangeType(type, mimeType) {
    const {
      operationQueue
    } = this;
    const operation = {
      execute: () => {
        const sb = this.sourceBuffer[type];
        if (sb) {
          logger.log(`[buffer-controller]: changing ${type} sourceBuffer type to ${mimeType}`);
          sb.changeType(mimeType);
        }
        operationQueue.shiftAndExecuteNext(type);
      },
      onStart: () => {},
      onComplete: () => {},
      onError: e => {
        logger.warn(`[buffer-controller]: Failed to change ${type} SourceBuffer type`, e);
      }
    };
    operationQueue.append(operation, type);
  }
  onBufferAppending(event, eventData) {
    const {
      hls,
      operationQueue,
      tracks
    } = this;
    const {
      data,
      type,
      frag,
      part,
      chunkMeta
    } = eventData;
    const chunkStats = chunkMeta.buffering[type];
    const bufferAppendingStart = self.performance.now();
    chunkStats.start = bufferAppendingStart;
    const fragBuffering = frag.stats.buffering;
    const partBuffering = part ? part.stats.buffering : null;
    if (fragBuffering.start === 0) {
      fragBuffering.start = bufferAppendingStart;
    }
    if (partBuffering && partBuffering.start === 0) {
      partBuffering.start = bufferAppendingStart;
    }

    // TODO: Only update timestampOffset when audio/mpeg fragment or part is not contiguous with previously appended
    // Adjusting `SourceBuffer.timestampOffset` (desired point in the timeline where the next frames should be appended)
    // in Chrome browser when we detect MPEG audio container and time delta between level PTS and `SourceBuffer.timestampOffset`
    // is greater than 100ms (this is enough to handle seek for VOD or level change for LIVE videos).
    // More info here: https://github.com/video-dev/hls.js/issues/332#issuecomment-257986486
    const audioTrack = tracks.audio;
    let checkTimestampOffset = false;
    if (type === 'audio' && (audioTrack == null ? void 0 : audioTrack.container) === 'audio/mpeg') {
      checkTimestampOffset = !this.lastMpegAudioChunk || chunkMeta.id === 1 || this.lastMpegAudioChunk.sn !== chunkMeta.sn;
      this.lastMpegAudioChunk = chunkMeta;
    }
    const fragStart = frag.start;
    const operation = {
      execute: () => {
        chunkStats.executeStart = self.performance.now();
        if (checkTimestampOffset) {
          const sb = this.sourceBuffer[type];
          if (sb) {
            const delta = fragStart - sb.timestampOffset;
            if (Math.abs(delta) >= 0.1) {
              logger.log(`[buffer-controller]: Updating audio SourceBuffer timestampOffset to ${fragStart} (delta: ${delta}) sn: ${frag.sn})`);
              sb.timestampOffset = fragStart;
            }
          }
        }
        this.appendExecutor(data, type);
      },
      onStart: () => {
        // logger.debug(`[buffer-controller]: ${type} SourceBuffer updatestart`);
      },
      onComplete: () => {
        // logger.debug(`[buffer-controller]: ${type} SourceBuffer updateend`);
        const end = self.performance.now();
        chunkStats.executeEnd = chunkStats.end = end;
        if (fragBuffering.first === 0) {
          fragBuffering.first = end;
        }
        if (partBuffering && partBuffering.first === 0) {
          partBuffering.first = end;
        }
        const {
          sourceBuffer
        } = this;
        const timeRanges = {};
        for (const type in sourceBuffer) {
          timeRanges[type] = BufferHelper.getBuffered(sourceBuffer[type]);
        }
        this.appendError = 0;
        this.hls.trigger(Events.BUFFER_APPENDED, {
          type,
          frag,
          part,
          chunkMeta,
          parent: frag.type,
          timeRanges
        });
      },
      onError: err => {
        // in case any error occured while appending, put back segment in segments table
        logger.error(`[buffer-controller]: Error encountered while trying to append to the ${type} SourceBuffer`, err);
        const event = {
          type: ErrorTypes.MEDIA_ERROR,
          parent: frag.type,
          details: ErrorDetails.BUFFER_APPEND_ERROR,
          frag,
          part,
          chunkMeta,
          error: err,
          err,
          fatal: false
        };
        if (err.code === DOMException.QUOTA_EXCEEDED_ERR) {
          // QuotaExceededError: http://www.w3.org/TR/html5/infrastructure.html#quotaexceedederror
          // let's stop appending any segments, and report BUFFER_FULL_ERROR error
          event.details = ErrorDetails.BUFFER_FULL_ERROR;
        } else {
          this.appendError++;
          event.details = ErrorDetails.BUFFER_APPEND_ERROR;
          /* with UHD content, we could get loop of quota exceeded error until
            browser is able to evict some data from sourcebuffer. Retrying can help recover.
          */
          if (this.appendError > hls.config.appendErrorMaxRetry) {
            logger.error(`[buffer-controller]: Failed ${hls.config.appendErrorMaxRetry} times to append segment in sourceBuffer`);
            event.fatal = true;
          }
        }
        hls.trigger(Events.ERROR, event);
      }
    };
    operationQueue.append(operation, type);
  }
  onBufferFlushing(event, data) {
    const {
      operationQueue
    } = this;
    const flushOperation = type => ({
      execute: this.removeExecutor.bind(this, type, data.startOffset, data.endOffset),
      onStart: () => {
        // logger.debug(`[buffer-controller]: Started flushing ${data.startOffset} -> ${data.endOffset} for ${type} Source Buffer`);
      },
      onComplete: () => {
        // logger.debug(`[buffer-controller]: Finished flushing ${data.startOffset} -> ${data.endOffset} for ${type} Source Buffer`);
        this.hls.trigger(Events.BUFFER_FLUSHED, {
          type
        });
      },
      onError: e => {
        logger.warn(`[buffer-controller]: Failed to remove from ${type} SourceBuffer`, e);
      }
    });
    if (data.type) {
      operationQueue.append(flushOperation(data.type), data.type);
    } else {
      this.getSourceBufferTypes().forEach(type => {
        operationQueue.append(flushOperation(type), type);
      });
    }
  }
  onFragParsed(event, data) {
    const {
      frag,
      part
    } = data;
    const buffersAppendedTo = [];
    const elementaryStreams = part ? part.elementaryStreams : frag.elementaryStreams;
    if (elementaryStreams[ElementaryStreamTypes.AUDIOVIDEO]) {
      buffersAppendedTo.push('audiovideo');
    } else {
      if (elementaryStreams[ElementaryStreamTypes.AUDIO]) {
        buffersAppendedTo.push('audio');
      }
      if (elementaryStreams[ElementaryStreamTypes.VIDEO]) {
        buffersAppendedTo.push('video');
      }
    }
    const onUnblocked = () => {
      const now = self.performance.now();
      frag.stats.buffering.end = now;
      if (part) {
        part.stats.buffering.end = now;
      }
      const stats = part ? part.stats : frag.stats;
      this.hls.trigger(Events.FRAG_BUFFERED, {
        frag,
        part,
        stats,
        id: frag.type
      });
    };
    if (buffersAppendedTo.length === 0) {
      logger.warn(`Fragments must have at least one ElementaryStreamType set. type: ${frag.type} level: ${frag.level} sn: ${frag.sn}`);
    }
    this.blockBuffers(onUnblocked, buffersAppendedTo);
  }
  onFragChanged(event, data) {
    this.flushBackBuffer();
  }

  // on BUFFER_EOS mark matching sourcebuffer(s) as ended and trigger checkEos()
  // an undefined data.type will mark all buffers as EOS.
  onBufferEos(event, data) {
    const ended = this.getSourceBufferTypes().reduce((acc, type) => {
      const sb = this.sourceBuffer[type];
      if (sb && (!data.type || data.type === type)) {
        sb.ending = true;
        if (!sb.ended) {
          sb.ended = true;
          logger.log(`[buffer-controller]: ${type} sourceBuffer now EOS`);
        }
      }
      return acc && !!(!sb || sb.ended);
    }, true);
    if (ended) {
      logger.log(`[buffer-controller]: Queueing mediaSource.endOfStream()`);
      this.blockBuffers(() => {
        this.getSourceBufferTypes().forEach(type => {
          const sb = this.sourceBuffer[type];
          if (sb) {
            sb.ending = false;
          }
        });
        const {
          mediaSource
        } = this;
        if (!mediaSource || mediaSource.readyState !== 'open') {
          if (mediaSource) {
            logger.info(`[buffer-controller]: Could not call mediaSource.endOfStream(). mediaSource.readyState: ${mediaSource.readyState}`);
          }
          return;
        }
        logger.log(`[buffer-controller]: Calling mediaSource.endOfStream()`);
        // Allow this to throw and be caught by the enqueueing function
        mediaSource.endOfStream();
      });
    }
  }
  onLevelUpdated(event, {
    details
  }) {
    if (!details.fragments.length) {
      return;
    }
    this.details = details;
    if (this.getSourceBufferTypes().length) {
      this.blockBuffers(this.updateMediaElementDuration.bind(this));
    } else {
      this.updateMediaElementDuration();
    }
  }
  flushBackBuffer() {
    const {
      hls,
      details,
      media,
      sourceBuffer
    } = this;
    if (!media || details === null) {
      return;
    }
    const sourceBufferTypes = this.getSourceBufferTypes();
    if (!sourceBufferTypes.length) {
      return;
    }

    // Support for deprecated liveBackBufferLength
    const backBufferLength = details.live && hls.config.liveBackBufferLength !== null ? hls.config.liveBackBufferLength : hls.config.backBufferLength;
    if (!isFiniteNumber(backBufferLength) || backBufferLength < 0) {
      return;
    }
    const currentTime = media.currentTime;
    const targetDuration = details.levelTargetDuration;
    const maxBackBufferLength = Math.max(backBufferLength, targetDuration);
    const targetBackBufferPosition = Math.floor(currentTime / targetDuration) * targetDuration - maxBackBufferLength;
    sourceBufferTypes.forEach(type => {
      const sb = sourceBuffer[type];
      if (sb) {
        const buffered = BufferHelper.getBuffered(sb);
        // when target buffer start exceeds actual buffer start
        if (buffered.length > 0 && targetBackBufferPosition > buffered.start(0)) {
          hls.trigger(Events.BACK_BUFFER_REACHED, {
            bufferEnd: targetBackBufferPosition
          });

          // Support for deprecated event:
          if (details.live) {
            hls.trigger(Events.LIVE_BACK_BUFFER_REACHED, {
              bufferEnd: targetBackBufferPosition
            });
          } else if (sb.ended && buffered.end(buffered.length - 1) - currentTime < targetDuration * 2) {
            logger.info(`[buffer-controller]: Cannot flush ${type} back buffer while SourceBuffer is in ended state`);
            return;
          }
          hls.trigger(Events.BUFFER_FLUSHING, {
            startOffset: 0,
            endOffset: targetBackBufferPosition,
            type
          });
        }
      }
    });
  }

  /**
   * Update Media Source duration to current level duration or override to Infinity if configuration parameter
   * 'liveDurationInfinity` is set to `true`
   * More details: https://github.com/video-dev/hls.js/issues/355
   */
  updateMediaElementDuration() {
    if (!this.details || !this.media || !this.mediaSource || this.mediaSource.readyState !== 'open') {
      return;
    }
    const {
      details,
      hls,
      media,
      mediaSource
    } = this;
    const levelDuration = details.fragments[0].start + details.totalduration;
    const mediaDuration = media.duration;
    const msDuration = isFiniteNumber(mediaSource.duration) ? mediaSource.duration : 0;
    if (details.live && hls.config.liveDurationInfinity) {
      // Override duration to Infinity
      logger.log('[buffer-controller]: Media Source duration is set to Infinity');
      mediaSource.duration = Infinity;
      this.updateSeekableRange(details);
    } else if (levelDuration > msDuration && levelDuration > mediaDuration || !isFiniteNumber(mediaDuration)) {
      // levelDuration was the last value we set.
      // not using mediaSource.duration as the browser may tweak this value
      // only update Media Source duration if its value increase, this is to avoid
      // flushing already buffered portion when switching between quality level
      logger.log(`[buffer-controller]: Updating Media Source duration to ${levelDuration.toFixed(3)}`);
      mediaSource.duration = levelDuration;
    }
  }
  updateSeekableRange(levelDetails) {
    const mediaSource = this.mediaSource;
    const fragments = levelDetails.fragments;
    const len = fragments.length;
    if (len && levelDetails.live && mediaSource != null && mediaSource.setLiveSeekableRange) {
      const start = Math.max(0, fragments[0].start);
      const end = Math.max(start, start + levelDetails.totalduration);
      mediaSource.setLiveSeekableRange(start, end);
    }
  }
  checkPendingTracks() {
    const {
      bufferCodecEventsExpected,
      operationQueue,
      pendingTracks
    } = this;

    // Check if we've received all of the expected bufferCodec events. When none remain, create all the sourceBuffers at once.
    // This is important because the MSE spec allows implementations to throw QuotaExceededErrors if creating new sourceBuffers after
    // data has been appended to existing ones.
    // 2 tracks is the max (one for audio, one for video). If we've reach this max go ahead and create the buffers.
    const pendingTracksCount = Object.keys(pendingTracks).length;
    if (pendingTracksCount && !bufferCodecEventsExpected || pendingTracksCount === 2) {
      // ok, let's create them now !
      this.createSourceBuffers(pendingTracks);
      this.pendingTracks = {};
      // append any pending segments now !
      const buffers = this.getSourceBufferTypes();
      if (buffers.length) {
        this.hls.trigger(Events.BUFFER_CREATED, {
          tracks: this.tracks
        });
        buffers.forEach(type => {
          operationQueue.executeNext(type);
        });
      } else {
        const error = new Error('could not create source buffer for media codec(s)');
        this.hls.trigger(Events.ERROR, {
          type: ErrorTypes.MEDIA_ERROR,
          details: ErrorDetails.BUFFER_INCOMPATIBLE_CODECS_ERROR,
          fatal: true,
          error,
          reason: error.message
        });
      }
    }
  }
  createSourceBuffers(tracks) {
    const {
      sourceBuffer,
      mediaSource
    } = this;
    if (!mediaSource) {
      throw Error('createSourceBuffers called when mediaSource was null');
    }
    for (const trackName in tracks) {
      if (!sourceBuffer[trackName]) {
        const track = tracks[trackName];
        if (!track) {
          throw Error(`source buffer exists for track ${trackName}, however track does not`);
        }
        // use levelCodec as first priority
        const codec = track.levelCodec || track.codec;
        const mimeType = `${track.container};codecs=${codec}`;
        logger.log(`[buffer-controller]: creating sourceBuffer(${mimeType})`);
        try {
          const sb = sourceBuffer[trackName] = mediaSource.addSourceBuffer(mimeType);
          const sbName = trackName;
          this.addBufferListener(sbName, 'updatestart', this._onSBUpdateStart);
          this.addBufferListener(sbName, 'updateend', this._onSBUpdateEnd);
          this.addBufferListener(sbName, 'error', this._onSBUpdateError);
          this.tracks[trackName] = {
            buffer: sb,
            codec: codec,
            container: track.container,
            levelCodec: track.levelCodec,
            metadata: track.metadata,
            id: track.id
          };
        } catch (err) {
          logger.error(`[buffer-controller]: error while trying to add sourceBuffer: ${err.message}`);
          this.hls.trigger(Events.ERROR, {
            type: ErrorTypes.MEDIA_ERROR,
            details: ErrorDetails.BUFFER_ADD_CODEC_ERROR,
            fatal: false,
            error: err,
            mimeType: mimeType
          });
        }
      }
    }
  }
  _onSBUpdateStart(type) {
    const {
      operationQueue
    } = this;
    const operation = operationQueue.current(type);
    operation.onStart();
  }
  _onSBUpdateEnd(type) {
    const {
      operationQueue
    } = this;
    const operation = operationQueue.current(type);
    operation.onComplete();
    operationQueue.shiftAndExecuteNext(type);
  }
  _onSBUpdateError(type, event) {
    const error = new Error(`${type} SourceBuffer error`);
    logger.error(`[buffer-controller]: ${error}`, event);
    // according to http://www.w3.org/TR/media-source/#sourcebuffer-append-error
    // SourceBuffer errors are not necessarily fatal; if so, the HTMLMediaElement will fire an error event
    this.hls.trigger(Events.ERROR, {
      type: ErrorTypes.MEDIA_ERROR,
      details: ErrorDetails.BUFFER_APPENDING_ERROR,
      error,
      fatal: false
    });
    // updateend is always fired after error, so we'll allow that to shift the current operation off of the queue
    const operation = this.operationQueue.current(type);
    if (operation) {
      operation.onError(event);
    }
  }

  // This method must result in an updateend event; if remove is not called, _onSBUpdateEnd must be called manually
  removeExecutor(type, startOffset, endOffset) {
    const {
      media,
      mediaSource,
      operationQueue,
      sourceBuffer
    } = this;
    const sb = sourceBuffer[type];
    if (!media || !mediaSource || !sb) {
      logger.warn(`[buffer-controller]: Attempting to remove from the ${type} SourceBuffer, but it does not exist`);
      operationQueue.shiftAndExecuteNext(type);
      return;
    }
    const mediaDuration = isFiniteNumber(media.duration) ? media.duration : Infinity;
    const msDuration = isFiniteNumber(mediaSource.duration) ? mediaSource.duration : Infinity;
    const removeStart = Math.max(0, startOffset);
    const removeEnd = Math.min(endOffset, mediaDuration, msDuration);
    if (removeEnd > removeStart && !sb.ending) {
      sb.ended = false;
      logger.log(`[buffer-controller]: Removing [${removeStart},${removeEnd}] from the ${type} SourceBuffer`);
      sb.remove(removeStart, removeEnd);
    } else {
      // Cycle the queue
      operationQueue.shiftAndExecuteNext(type);
    }
  }

  // This method must result in an updateend event; if append is not called, _onSBUpdateEnd must be called manually
  appendExecutor(data, type) {
    const {
      operationQueue,
      sourceBuffer
    } = this;
    const sb = sourceBuffer[type];
    if (!sb) {
      logger.warn(`[buffer-controller]: Attempting to append to the ${type} SourceBuffer, but it does not exist`);
      operationQueue.shiftAndExecuteNext(type);
      return;
    }
    sb.ended = false;
    sb.appendBuffer(data);
  }

  // Enqueues an operation to each SourceBuffer queue which, upon execution, resolves a promise. When all promises
  // resolve, the onUnblocked function is executed. Functions calling this method do not need to unblock the queue
  // upon completion, since we already do it here
  blockBuffers(onUnblocked, buffers = this.getSourceBufferTypes()) {
    if (!buffers.length) {
      logger.log('[buffer-controller]: Blocking operation requested, but no SourceBuffers exist');
      Promise.resolve().then(onUnblocked);
      return;
    }
    const {
      operationQueue
    } = this;

    // logger.debug(`[buffer-controller]: Blocking ${buffers} SourceBuffer`);
    const blockingOperations = buffers.map(type => operationQueue.appendBlocker(type));
    Promise.all(blockingOperations).then(() => {
      // logger.debug(`[buffer-controller]: Blocking operation resolved; unblocking ${buffers} SourceBuffer`);
      onUnblocked();
      buffers.forEach(type => {
        const sb = this.sourceBuffer[type];
        // Only cycle the queue if the SB is not updating. There's a bug in Chrome which sets the SB updating flag to
        // true when changing the MediaSource duration (https://bugs.chromium.org/p/chromium/issues/detail?id=959359&can=2&q=mediasource%20duration)
        // While this is a workaround, it's probably useful to have around
        if (!(sb != null && sb.updating)) {
          operationQueue.shiftAndExecuteNext(type);
        }
      });
    });
  }
  getSourceBufferTypes() {
    return Object.keys(this.sourceBuffer);
  }
  addBufferListener(type, event, fn) {
    const buffer = this.sourceBuffer[type];
    if (!buffer) {
      return;
    }
    const listener = fn.bind(this, type);
    this.listeners[type].push({
      event,
      listener
    });
    buffer.addEventListener(event, listener);
  }
  removeBufferListeners(type) {
    const buffer = this.sourceBuffer[type];
    if (!buffer) {
      return;
    }
    this.listeners[type].forEach(l => {
      buffer.removeEventListener(l.event, l.listener);
    });
  }
}

/*
 * cap stream level to media size dimension controller
 */

class CapLevelController {
  constructor(hls) {
    this.hls = void 0;
    this.autoLevelCapping = void 0;
    this.firstLevel = void 0;
    this.media = void 0;
    this.restrictedLevels = void 0;
    this.timer = void 0;
    this.clientRect = void 0;
    this.streamController = void 0;
    this.hls = hls;
    this.autoLevelCapping = Number.POSITIVE_INFINITY;
    this.firstLevel = -1;
    this.media = null;
    this.restrictedLevels = [];
    this.timer = undefined;
    this.clientRect = null;
    this.registerListeners();
  }
  setStreamController(streamController) {
    this.streamController = streamController;
  }
  destroy() {
    this.unregisterListener();
    if (this.hls.config.capLevelToPlayerSize) {
      this.stopCapping();
    }
    this.media = null;
    this.clientRect = null;
    // @ts-ignore
    this.hls = this.streamController = null;
  }
  registerListeners() {
    const {
      hls
    } = this;
    hls.on(Events.FPS_DROP_LEVEL_CAPPING, this.onFpsDropLevelCapping, this);
    hls.on(Events.MEDIA_ATTACHING, this.onMediaAttaching, this);
    hls.on(Events.MANIFEST_PARSED, this.onManifestParsed, this);
    hls.on(Events.BUFFER_CODECS, this.onBufferCodecs, this);
    hls.on(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
  }
  unregisterListener() {
    const {
      hls
    } = this;
    hls.off(Events.FPS_DROP_LEVEL_CAPPING, this.onFpsDropLevelCapping, this);
    hls.off(Events.MEDIA_ATTACHING, this.onMediaAttaching, this);
    hls.off(Events.MANIFEST_PARSED, this.onManifestParsed, this);
    hls.off(Events.BUFFER_CODECS, this.onBufferCodecs, this);
    hls.off(Events.MEDIA_DETACHING, this.onMediaDetaching, this);
  }
  onFpsDropLevelCapping(event, data) {
    // Don't add a restricted level more than once
    const level = this.hls.levels[data.droppedLevel];
    if (this.isLevelAllowed(level)) {
      this.restrictedLevels.push({
        bitrate: level.bitrate,
        height: level.height,
        width: level.width
      });
    }
  }
  onMediaAttaching(event, data) {
    this.media = data.media instanceof HTMLVideoElement ? data.media : null;
    this.clientRect = null;
  }
  onManifestParsed(event, data) {
    const hls = this.hls;
    this.restrictedLevels = [];
    this.firstLevel = data.firstLevel;
    if (hls.config.capLevelToPlayerSize && data.video) {
      // Start capping immediately if the manifest has signaled video codecs
      this.startCapping();
    }
  }

  // Only activate capping when playing a video stream; otherwise, multi-bitrate audio-only streams will be restricted
  // to the first level
  onBufferCodecs(event, data) {
    const hls = this.hls;
    if (hls.config.capLevelToPlayerSize && data.video) {
      // If the manifest did not signal a video codec capping has been deferred until we're certain video is present
      this.startCapping();
    }
  }
  onMediaDetaching() {
    this.stopCapping();
  }
  detectPlayerSize() {
    if (this.media && this.mediaHeight > 0 && this.mediaWidth > 0) {
      const levels = this.hls.levels;
      if (levels.length) {
        const hls = this.hls;
        hls.autoLevelCapping = this.getMaxLevel(levels.length - 1);
        if (hls.autoLevelCapping > this.autoLevelCapping && this.streamController) {
          // if auto level capping has a higher value for the previous one, flush the buffer using nextLevelSwitch
          // usually happen when the user go to the fullscreen mode.
          this.streamController.nextLevelSwitch();
        }
        this.autoLevelCapping = hls.autoLevelCapping;
      }
    }
  }

  /*
   * returns level should be the one with the dimensions equal or greater than the media (player) dimensions (so the video will be downscaled)
   */
  getMaxLevel(capLevelIndex) {
    const levels = this.hls.levels;
    if (!levels.length) {
      return -1;
    }
    const validLevels = levels.filter((level, index) => this.isLevelAllowed(level) && index <= capLevelIndex);
    this.clientRect = null;
    return CapLevelController.getMaxLevelByMediaSize(validLevels, this.mediaWidth, this.mediaHeight);
  }
  startCapping() {
    if (this.timer) {
      // Don't reset capping if started twice; this can happen if the manifest signals a video codec
      return;
    }
    this.autoLevelCapping = Number.POSITIVE_INFINITY;
    this.hls.firstLevel = this.getMaxLevel(this.firstLevel);
    self.clearInterval(this.timer);
    this.timer = self.setInterval(this.detectPlayerSize.bind(this), 1000);
    this.detectPlayerSize();
  }
  stopCapping() {
    this.restrictedLevels = [];
    this.firstLevel = -1;
    this.autoLevelCapping = Number.POSITIVE_INFINITY;
    if (this.timer) {
      self.clearInterval(this.timer);
      this.timer = undefined;
    }
  }
  getDimensions() {
    if (this.clientRect) {
      return this.clientRect;
    }
    const media = this.media;
    const boundsRect = {
      width: 0,
      height: 0
    };
    if (media) {
      const clientRect = media.getBoundingClientRect();
      boundsRect.width = clientRect.width;
      boundsRect.height = clientRect.height;
      if (!boundsRect.width && !boundsRect.height) {
        // When the media element has no width or height (equivalent to not being in the DOM),
        // then use its width and height attributes (media.width, media.height)
        boundsRect.width = clientRect.right - clientRect.left || media.width || 0;
        boundsRect.height = clientRect.bottom - clientRect.top || media.height || 0;
      }
    }
    this.clientRect = boundsRect;
    return boundsRect;
  }
  get mediaWidth() {
    return this.getDimensions().width * this.contentScaleFactor;
  }
  get mediaHeight() {
    return this.getDimensions().height * this.contentScaleFactor;
  }
  get contentScaleFactor() {
    let pixelRatio = 1;
    if (!this.hls.config.ignoreDevicePixelRatio) {
      try {
        pixelRatio = self.devicePixelRatio;
      } catch (e) {
        /* no-op */
      }
    }
    return pixelRatio;
  }
  isLevelAllowed(level) {
    const restrictedLevels = this.restrictedLevels;
    return !restrictedLevels.some(restrictedLevel => {
      return level.bitrate === restrictedLevel.bitrate && level.width === restrictedLevel.width && level.height === restrictedLevel.height;
    });
  }
  static getMaxLevelByMediaSize(levels, width, height) {
    if (!(levels != null && levels.length)) {
      return -1;
    }

    // Levels can have the same dimensions but differing bandwidths - since levels are ordered, we can look to the next
    // to determine whether we've chosen the greatest bandwidth for the media's dimensions
    const atGreatestBandwidth = (curLevel, nextLevel) => {
      if (!nextLevel) {
        return true;
      }
      return curLevel.width !== nextLevel.width || curLevel.height !== nextLevel.height;
    };

    // If we run through the loop without breaking, the media's dimensions are greater than every level, so default to
    // the max level
    let maxLevelIndex = levels.length - 1;
    for (let i = 0; i < levels.length; i += 1) {
      const level = levels[i];
      if ((level.width >= width || level.height >= height) && atGreatestBandwidth(level, levels[i + 1])) {
        maxLevelIndex = i;
        break;
      }
    }
    return maxLevelIndex;
  }
}

class FPSController {
  // stream controller must be provided as a dependency!

  constructor(hls) {
    this.hls = void 0;
    this.isVideoPlaybackQualityAvailable = false;
    this.timer = void 0;
    this.media = null;
    this.lastTime = void 0;
    this.lastDroppedFrames = 0;
    this.lastDecodedFrames = 0;
    this.streamController = void 0;
    this.hls = hls;
    this.registerListeners();
  }
  setStreamController(streamController) {
    this.streamController = streamController;
  }
  registerListeners() {
    this.hls.on(Events.MEDIA_ATTACHING, this.onMediaAttaching, this);
  }
  unregisterListeners() {
    this.hls.off(Events.MEDIA_ATTACHING, this.onMediaAttaching, this);
  }
  destroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.unregisterListeners();
    this.isVideoPlaybackQualityAvailable = false;
    this.media = null;
  }
  onMediaAttaching(event, data) {
    const config = this.hls.config;
    if (config.capLevelOnFPSDrop) {
      const media = data.media instanceof self.HTMLVideoElement ? data.media : null;
      this.media = media;
      if (media && typeof media.getVideoPlaybackQuality === 'function') {
        this.isVideoPlaybackQualityAvailable = true;
      }
      self.clearInterval(this.timer);
      this.timer = self.setInterval(this.checkFPSInterval.bind(this), config.fpsDroppedMonitoringPeriod);
    }
  }
  checkFPS(video, decodedFrames, droppedFrames) {
    const currentTime = performance.now();
    if (decodedFrames) {
      if (this.lastTime) {
        const currentPeriod = currentTime - this.lastTime;
        const currentDropped = droppedFrames - this.lastDroppedFrames;
        const currentDecoded = decodedFrames - this.lastDecodedFrames;
        const droppedFPS = 1000 * currentDropped / currentPeriod;
        const hls = this.hls;
        hls.trigger(Events.FPS_DROP, {
          currentDropped: currentDropped,
          currentDecoded: currentDecoded,
          totalDroppedFrames: droppedFrames
        });
        if (droppedFPS > 0) {
          // logger.log('checkFPS : droppedFPS/decodedFPS:' + droppedFPS/(1000 * currentDecoded / currentPeriod));
          if (currentDropped > hls.config.fpsDroppedMonitoringThreshold * currentDecoded) {
            let currentLevel = hls.currentLevel;
            logger.warn('drop FPS ratio greater than max allowed value for currentLevel: ' + currentLevel);
            if (currentLevel > 0 && (hls.autoLevelCapping === -1 || hls.autoLevelCapping >= currentLevel)) {
              currentLevel = currentLevel - 1;
              hls.trigger(Events.FPS_DROP_LEVEL_CAPPING, {
                level: currentLevel,
                droppedLevel: hls.currentLevel
              });
              hls.autoLevelCapping = currentLevel;
              this.streamController.nextLevelSwitch();
            }
          }
        }
      }
      this.lastTime = currentTime;
      this.lastDroppedFrames = droppedFrames;
      this.lastDecodedFrames = decodedFrames;
    }
  }
  checkFPSInterval() {
    const video = this.media;
    if (video) {
      if (this.isVideoPlaybackQualityAvailable) {
        const videoPlaybackQuality = video.getVideoPlaybackQuality();
        this.checkFPS(video, videoPlaybackQuality.totalVideoFrames, videoPlaybackQuality.droppedVideoFrames);
      } else {
        // HTMLVideoElement doesn't include the webkit types
        this.checkFPS(video, video.webkitDecodedFrameCount, video.webkitDroppedFrameCount);
      }
    }
  }
}

const AGE_HEADER_LINE_REGEX = /^age:\s*[\d.]+\s*$/im;
class XhrLoader {
  constructor(config) {
    this.xhrSetup = void 0;
    this.requestTimeout = void 0;
    this.retryTimeout = void 0;
    this.retryDelay = void 0;
    this.config = null;
    this.callbacks = null;
    this.context = void 0;
    this.loader = null;
    this.stats = void 0;
    this.xhrSetup = config ? config.xhrSetup || null : null;
    this.stats = new LoadStats();
    this.retryDelay = 0;
  }
  destroy() {
    this.callbacks = null;
    this.abortInternal();
    this.loader = null;
    this.config = null;
  }
  abortInternal() {
    const loader = this.loader;
    self.clearTimeout(this.requestTimeout);
    self.clearTimeout(this.retryTimeout);
    if (loader) {
      loader.onreadystatechange = null;
      loader.onprogress = null;
      if (loader.readyState !== 4) {
        this.stats.aborted = true;
        loader.abort();
      }
    }
  }
  abort() {
    var _this$callbacks;
    this.abortInternal();
    if ((_this$callbacks = this.callbacks) != null && _this$callbacks.onAbort) {
      this.callbacks.onAbort(this.stats, this.context, this.loader);
    }
  }
  load(context, config, callbacks) {
    if (this.stats.loading.start) {
      throw new Error('Loader can only be used once.');
    }
    this.stats.loading.start = self.performance.now();
    this.context = context;
    this.config = config;
    this.callbacks = callbacks;
    this.loadInternal();
  }
  loadInternal() {
    const {
      config,
      context
    } = this;
    if (!config) {
      return;
    }
    const xhr = this.loader = new self.XMLHttpRequest();
    const stats = this.stats;
    stats.loading.first = 0;
    stats.loaded = 0;
    stats.aborted = false;
    const xhrSetup = this.xhrSetup;
    if (xhrSetup) {
      Promise.resolve().then(() => {
        if (this.stats.aborted) return;
        return xhrSetup(xhr, context.url);
      }).catch(error => {
        xhr.open('GET', context.url, true);
        return xhrSetup(xhr, context.url);
      }).then(() => {
        if (this.stats.aborted) return;
        this.openAndSendXhr(xhr, context, config);
      }).catch(error => {
        // IE11 throws an exception on xhr.open if attempting to access an HTTP resource over HTTPS
        this.callbacks.onError({
          code: xhr.status,
          text: error.message
        }, context, xhr, stats);
        return;
      });
    } else {
      this.openAndSendXhr(xhr, context, config);
    }
  }
  openAndSendXhr(xhr, context, config) {
    if (!xhr.readyState) {
      xhr.open('GET', context.url, true);
    }
    const headers = this.context.headers;
    const {
      maxTimeToFirstByteMs,
      maxLoadTimeMs
    } = config.loadPolicy;
    if (headers) {
      for (const header in headers) {
        xhr.setRequestHeader(header, headers[header]);
      }
    }
    if (context.rangeEnd) {
      xhr.setRequestHeader('Range', 'bytes=' + context.rangeStart + '-' + (context.rangeEnd - 1));
    }
    xhr.onreadystatechange = this.readystatechange.bind(this);
    xhr.onprogress = this.loadprogress.bind(this);
    xhr.responseType = context.responseType;
    // setup timeout before we perform request
    self.clearTimeout(this.requestTimeout);
    config.timeout = maxTimeToFirstByteMs && isFiniteNumber(maxTimeToFirstByteMs) ? maxTimeToFirstByteMs : maxLoadTimeMs;
    this.requestTimeout = self.setTimeout(this.loadtimeout.bind(this), config.timeout);
    xhr.send();
  }
  readystatechange() {
    const {
      context,
      loader: xhr,
      stats
    } = this;
    if (!context || !xhr) {
      return;
    }
    const readyState = xhr.readyState;
    const config = this.config;

    // don't proceed if xhr has been aborted
    if (stats.aborted) {
      return;
    }

    // >= HEADERS_RECEIVED
    if (readyState >= 2) {
      if (stats.loading.first === 0) {
        stats.loading.first = Math.max(self.performance.now(), stats.loading.start);
        // readyState >= 2 AND readyState !==4 (readyState = HEADERS_RECEIVED || LOADING) rearm timeout as xhr not finished yet
        if (config.timeout !== config.loadPolicy.maxLoadTimeMs) {
          self.clearTimeout(this.requestTimeout);
          config.timeout = config.loadPolicy.maxLoadTimeMs;
          this.requestTimeout = self.setTimeout(this.loadtimeout.bind(this), config.loadPolicy.maxLoadTimeMs - (stats.loading.first - stats.loading.start));
        }
      }
      if (readyState === 4) {
        self.clearTimeout(this.requestTimeout);
        xhr.onreadystatechange = null;
        xhr.onprogress = null;
        const status = xhr.status;
        // http status between 200 to 299 are all successful
        const useResponse = xhr.responseType !== 'text';
        if (status >= 200 && status < 300 && (useResponse && xhr.response || xhr.responseText !== null)) {
          stats.loading.end = Math.max(self.performance.now(), stats.loading.first);
          const data = useResponse ? xhr.response : xhr.responseText;
          const len = xhr.responseType === 'arraybuffer' ? data.byteLength : data.length;
          stats.loaded = stats.total = len;
          stats.bwEstimate = stats.total * 8000 / (stats.loading.end - stats.loading.first);
          if (!this.callbacks) {
            return;
          }
          const onProgress = this.callbacks.onProgress;
          if (onProgress) {
            onProgress(stats, context, data, xhr);
          }
          if (!this.callbacks) {
            return;
          }
          const response = {
            url: xhr.responseURL,
            data: data,
            code: status
          };
          this.callbacks.onSuccess(response, stats, context, xhr);
        } else {
          const retryConfig = config.loadPolicy.errorRetry;
          const retryCount = stats.retry;
          // if max nb of retries reached or if http status between 400 and 499 (such error cannot be recovered, retrying is useless), return error
          if (shouldRetry(retryConfig, retryCount, false, status)) {
            this.retry(retryConfig);
          } else {
            logger.error(`${status} while loading ${context.url}`);
            this.callbacks.onError({
              code: status,
              text: xhr.statusText
            }, context, xhr, stats);
          }
        }
      }
    }
  }
  loadtimeout() {
    var _this$config;
    const retryConfig = (_this$config = this.config) == null ? void 0 : _this$config.loadPolicy.timeoutRetry;
    const retryCount = this.stats.retry;
    if (shouldRetry(retryConfig, retryCount, true)) {
      this.retry(retryConfig);
    } else {
      logger.warn(`timeout while loading ${this.context.url}`);
      const callbacks = this.callbacks;
      if (callbacks) {
        this.abortInternal();
        callbacks.onTimeout(this.stats, this.context, this.loader);
      }
    }
  }
  retry(retryConfig) {
    const {
      context,
      stats
    } = this;
    this.retryDelay = getRetryDelay(retryConfig, stats.retry);
    stats.retry++;
    logger.warn(`${status ? 'HTTP Status ' + status : 'Timeout'} while loading ${context.url}, retrying ${stats.retry}/${retryConfig.maxNumRetry} in ${this.retryDelay}ms`);
    // abort and reset internal state
    this.abortInternal();
    this.loader = null;
    // schedule retry
    self.clearTimeout(this.retryTimeout);
    this.retryTimeout = self.setTimeout(this.loadInternal.bind(this), this.retryDelay);
  }
  loadprogress(event) {
    const stats = this.stats;
    stats.loaded = event.loaded;
    if (event.lengthComputable) {
      stats.total = event.total;
    }
  }
  getCacheAge() {
    let result = null;
    if (this.loader && AGE_HEADER_LINE_REGEX.test(this.loader.getAllResponseHeaders())) {
      const ageHeader = this.loader.getResponseHeader('age');
      result = ageHeader ? parseFloat(ageHeader) : null;
    }
    return result;
  }
  getResponseHeader(name) {
    if (this.loader && new RegExp(`^${name}:\\s*[\\d.]+\\s*$`, 'im').test(this.loader.getAllResponseHeaders())) {
      return this.loader.getResponseHeader(name);
    }
    return null;
  }
}

class ChunkCache {
  constructor() {
    this.chunks = [];
    this.dataLength = 0;
  }
  push(chunk) {
    this.chunks.push(chunk);
    this.dataLength += chunk.length;
  }
  flush() {
    const {
      chunks,
      dataLength
    } = this;
    let result;
    if (!chunks.length) {
      return new Uint8Array(0);
    } else if (chunks.length === 1) {
      result = chunks[0];
    } else {
      result = concatUint8Arrays(chunks, dataLength);
    }
    this.reset();
    return result;
  }
  reset() {
    this.chunks.length = 0;
    this.dataLength = 0;
  }
}
function concatUint8Arrays(chunks, dataLength) {
  const result = new Uint8Array(dataLength);
  let offset = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function fetchSupported() {
  if (
  // @ts-ignore
  self.fetch && self.AbortController && self.ReadableStream && self.Request) {
    try {
      new self.ReadableStream({}); // eslint-disable-line no-new
      return true;
    } catch (e) {
      /* noop */
    }
  }
  return false;
}
const BYTERANGE = /(\d+)-(\d+)\/(\d+)/;
class FetchLoader {
  constructor(config /* HlsConfig */) {
    this.fetchSetup = void 0;
    this.requestTimeout = void 0;
    this.request = void 0;
    this.response = void 0;
    this.controller = void 0;
    this.context = void 0;
    this.config = null;
    this.callbacks = null;
    this.stats = void 0;
    this.loader = null;
    this.fetchSetup = config.fetchSetup || getRequest;
    this.controller = new self.AbortController();
    this.stats = new LoadStats();
  }
  destroy() {
    this.loader = this.callbacks = null;
    this.abortInternal();
  }
  abortInternal() {
    const response = this.response;
    if (!(response != null && response.ok)) {
      this.stats.aborted = true;
      this.controller.abort();
    }
  }
  abort() {
    var _this$callbacks;
    this.abortInternal();
    if ((_this$callbacks = this.callbacks) != null && _this$callbacks.onAbort) {
      this.callbacks.onAbort(this.stats, this.context, this.response);
    }
  }
  load(context, config, callbacks) {
    const stats = this.stats;
    if (stats.loading.start) {
      throw new Error('Loader can only be used once.');
    }
    stats.loading.start = self.performance.now();
    const initParams = getRequestParameters(context, this.controller.signal);
    const onProgress = callbacks.onProgress;
    const isArrayBuffer = context.responseType === 'arraybuffer';
    const LENGTH = isArrayBuffer ? 'byteLength' : 'length';
    const {
      maxTimeToFirstByteMs,
      maxLoadTimeMs
    } = config.loadPolicy;
    this.context = context;
    this.config = config;
    this.callbacks = callbacks;
    this.request = this.fetchSetup(context, initParams);
    self.clearTimeout(this.requestTimeout);
    config.timeout = maxTimeToFirstByteMs && isFiniteNumber(maxTimeToFirstByteMs) ? maxTimeToFirstByteMs : maxLoadTimeMs;
    this.requestTimeout = self.setTimeout(() => {
      this.abortInternal();
      callbacks.onTimeout(stats, context, this.response);
    }, config.timeout);
    self.fetch(this.request).then(response => {
      this.response = this.loader = response;
      const first = Math.max(self.performance.now(), stats.loading.start);
      self.clearTimeout(this.requestTimeout);
      config.timeout = maxLoadTimeMs;
      this.requestTimeout = self.setTimeout(() => {
        this.abortInternal();
        callbacks.onTimeout(stats, context, this.response);
      }, maxLoadTimeMs - (first - stats.loading.start));
      if (!response.ok) {
        const {
          status,
          statusText
        } = response;
        throw new FetchError(statusText || 'fetch, bad network response', status, response);
      }
      stats.loading.first = first;
      stats.total = getContentLength(response.headers) || stats.total;
      if (onProgress && isFiniteNumber(config.highWaterMark)) {
        return this.loadProgressively(response, stats, context, config.highWaterMark, onProgress);
      }
      if (isArrayBuffer) {
        return response.arrayBuffer();
      }
      if (context.responseType === 'json') {
        return response.json();
      }
      return response.text();
    }).then(responseData => {
      const {
        response
      } = this;
      self.clearTimeout(this.requestTimeout);
      stats.loading.end = Math.max(self.performance.now(), stats.loading.first);
      const total = responseData[LENGTH];
      if (total) {
        stats.loaded = stats.total = total;
      }
      const loaderResponse = {
        url: response.url,
        data: responseData,
        code: response.status
      };
      if (onProgress && !isFiniteNumber(config.highWaterMark)) {
        onProgress(stats, context, responseData, response);
      }
      callbacks.onSuccess(loaderResponse, stats, context, response);
    }).catch(error => {
      self.clearTimeout(this.requestTimeout);
      if (stats.aborted) {
        return;
      }
      // CORS errors result in an undefined code. Set it to 0 here to align with XHR's behavior
      // when destroying, 'error' itself can be undefined
      const code = !error ? 0 : error.code || 0;
      const text = !error ? null : error.message;
      callbacks.onError({
        code,
        text
      }, context, error ? error.details : null, stats);
    });
  }
  getCacheAge() {
    let result = null;
    if (this.response) {
      const ageHeader = this.response.headers.get('age');
      result = ageHeader ? parseFloat(ageHeader) : null;
    }
    return result;
  }
  getResponseHeader(name) {
    return this.response ? this.response.headers.get(name) : null;
  }
  loadProgressively(response, stats, context, highWaterMark = 0, onProgress) {
    const chunkCache = new ChunkCache();
    const reader = response.body.getReader();
    const pump = () => {
      return reader.read().then(data => {
        if (data.done) {
          if (chunkCache.dataLength) {
            onProgress(stats, context, chunkCache.flush(), response);
          }
          return Promise.resolve(new ArrayBuffer(0));
        }
        const chunk = data.value;
        const len = chunk.length;
        stats.loaded += len;
        if (len < highWaterMark || chunkCache.dataLength) {
          // The current chunk is too small to to be emitted or the cache already has data
          // Push it to the cache
          chunkCache.push(chunk);
          if (chunkCache.dataLength >= highWaterMark) {
            // flush in order to join the typed arrays
            onProgress(stats, context, chunkCache.flush(), response);
          }
        } else {
          // If there's nothing cached already, and the chache is large enough
          // just emit the progress event
          onProgress(stats, context, chunk, response);
        }
        return pump();
      }).catch(() => {
        /* aborted */
        return Promise.reject();
      });
    };
    return pump();
  }
}
function getRequestParameters(context, signal) {
  const initParams = {
    method: 'GET',
    mode: 'cors',
    credentials: 'same-origin',
    signal,
    headers: new self.Headers(_extends({}, context.headers))
  };
  if (context.rangeEnd) {
    initParams.headers.set('Range', 'bytes=' + context.rangeStart + '-' + String(context.rangeEnd - 1));
  }
  return initParams;
}
function getByteRangeLength(byteRangeHeader) {
  const result = BYTERANGE.exec(byteRangeHeader);
  if (result) {
    return parseInt(result[2]) - parseInt(result[1]) + 1;
  }
}
function getContentLength(headers) {
  const contentRange = headers.get('Content-Range');
  if (contentRange) {
    const byteRangeLength = getByteRangeLength(contentRange);
    if (isFiniteNumber(byteRangeLength)) {
      return byteRangeLength;
    }
  }
  const contentLength = headers.get('Content-Length');
  if (contentLength) {
    return parseInt(contentLength);
  }
}
function getRequest(context, initParams) {
  return new self.Request(context.url, initParams);
}
class FetchError extends Error {
  constructor(message, code, details) {
    super(message);
    this.code = void 0;
    this.details = void 0;
    this.code = code;
    this.details = details;
  }
}

/**
 * @deprecated use fragLoadPolicy.default
 */

/**
 * @deprecated use manifestLoadPolicy.default and playlistLoadPolicy.default
 */

const defaultLoadPolicy = {
  maxTimeToFirstByteMs: 8000,
  maxLoadTimeMs: 20000,
  timeoutRetry: null,
  errorRetry: null
};

/**
 * @ignore
 * If possible, keep hlsDefaultConfig shallow
 * It is cloned whenever a new Hls instance is created, by keeping the config
 * shallow the properties are cloned, and we don't end up manipulating the default
 */
const hlsDefaultConfig = _objectSpread2(_objectSpread2({
  autoStartLoad: true,
  // used by stream-controller
  startPosition: -1,
  // used by stream-controller
  defaultAudioCodec: undefined,
  // used by stream-controller
  debug: false,
  // used by logger
  capLevelOnFPSDrop: false,
  // used by fps-controller
  capLevelToPlayerSize: false,
  // used by cap-level-controller
  ignoreDevicePixelRatio: false,
  // used by cap-level-controller
  initialLiveManifestSize: 1,
  // used by stream-controller
  maxBufferLength: 30,
  // used by stream-controller
  backBufferLength: Infinity,
  // used by buffer-controller
  maxBufferSize: 60 * 1000 * 1000,
  // used by stream-controller
  maxBufferHole: 0.1,
  // used by stream-controller
  highBufferWatchdogPeriod: 2,
  // used by stream-controller
  nudgeOffset: 0.1,
  // used by stream-controller
  nudgeMaxRetry: 3,
  // used by stream-controller
  maxFragLookUpTolerance: 0.25,
  // used by stream-controller
  liveSyncDurationCount: 3,
  // used by latency-controller
  liveMaxLatencyDurationCount: Infinity,
  // used by latency-controller
  liveSyncDuration: undefined,
  // used by latency-controller
  liveMaxLatencyDuration: undefined,
  // used by latency-controller
  maxLiveSyncPlaybackRate: 1,
  // used by latency-controller
  liveDurationInfinity: false,
  // used by buffer-controller
  /**
   * @deprecated use backBufferLength
   */
  liveBackBufferLength: null,
  // used by buffer-controller
  maxMaxBufferLength: 600,
  // used by stream-controller
  enableWorker: true,
  // used by transmuxer
  workerPath: null,
  // used by transmuxer
  enableSoftwareAES: true,
  // used by decrypter
  startLevel: undefined,
  // used by level-controller
  startFragPrefetch: false,
  // used by stream-controller
  fpsDroppedMonitoringPeriod: 5000,
  // used by fps-controller
  fpsDroppedMonitoringThreshold: 0.2,
  // used by fps-controller
  appendErrorMaxRetry: 3,
  // used by buffer-controller
  loader: XhrLoader,
  // loader: FetchLoader,
  fLoader: undefined,
  // used by fragment-loader
  pLoader: undefined,
  // used by playlist-loader
  xhrSetup: undefined,
  // used by xhr-loader
  licenseXhrSetup: undefined,
  // used by eme-controller
  licenseResponseCallback: undefined,
  // used by eme-controller
  abrController: AbrController,
  bufferController: BufferController,
  capLevelController: CapLevelController,
  errorController: ErrorController,
  fpsController: FPSController,
  stretchShortVideoTrack: false,
  // used by mp4-remuxer
  maxAudioFramesDrift: 1,
  // used by mp4-remuxer
  forceKeyFrameOnDiscontinuity: true,
  // used by ts-demuxer
  abrEwmaFastLive: 3,
  // used by abr-controller
  abrEwmaSlowLive: 9,
  // used by abr-controller
  abrEwmaFastVoD: 3,
  // used by abr-controller
  abrEwmaSlowVoD: 9,
  // used by abr-controller
  abrEwmaDefaultEstimate: 5e5,
  // 500 kbps  // used by abr-controller
  abrBandWidthFactor: 0.95,
  // used by abr-controller
  abrBandWidthUpFactor: 0.7,
  // used by abr-controller
  abrMaxWithRealBitrate: false,
  // used by abr-controller
  maxStarvationDelay: 4,
  // used by abr-controller
  maxLoadingDelay: 4,
  // used by abr-controller
  minAutoBitrate: 0,
  // used by hls
  emeEnabled: false,
  // used by eme-controller
  widevineLicenseUrl: undefined,
  // used by eme-controller
  drmSystems: {},
  // used by eme-controller
  drmSystemOptions: {},
  // used by eme-controller
  requestMediaKeySystemAccessFunc: null,
  // used by eme-controller
  testBandwidth: true,
  progressive: false,
  lowLatencyMode: true,
  cmcd: undefined,
  enableDateRangeMetadataCues: true,
  enableEmsgMetadataCues: true,
  enableID3MetadataCues: true,
  certLoadPolicy: {
    default: defaultLoadPolicy
  },
  keyLoadPolicy: {
    default: {
      maxTimeToFirstByteMs: 8000,
      maxLoadTimeMs: 20000,
      timeoutRetry: {
        maxNumRetry: 1,
        retryDelayMs: 1000,
        maxRetryDelayMs: 20000,
        backoff: 'linear'
      },
      errorRetry: {
        maxNumRetry: 8,
        retryDelayMs: 1000,
        maxRetryDelayMs: 20000,
        backoff: 'linear'
      }
    }
  },
  manifestLoadPolicy: {
    default: {
      maxTimeToFirstByteMs: Infinity,
      maxLoadTimeMs: 20000,
      timeoutRetry: {
        maxNumRetry: 2,
        retryDelayMs: 0,
        maxRetryDelayMs: 0
      },
      errorRetry: {
        maxNumRetry: 1,
        retryDelayMs: 1000,
        maxRetryDelayMs: 8000
      }
    }
  },
  playlistLoadPolicy: {
    default: {
      maxTimeToFirstByteMs: 10000,
      maxLoadTimeMs: 20000,
      timeoutRetry: {
        maxNumRetry: 2,
        retryDelayMs: 0,
        maxRetryDelayMs: 0
      },
      errorRetry: {
        maxNumRetry: 2,
        retryDelayMs: 1000,
        maxRetryDelayMs: 8000
      }
    }
  },
  fragLoadPolicy: {
    default: {
      maxTimeToFirstByteMs: 10000,
      maxLoadTimeMs: 120000,
      timeoutRetry: {
        maxNumRetry: 4,
        retryDelayMs: 0,
        maxRetryDelayMs: 0
      },
      errorRetry: {
        maxNumRetry: 6,
        retryDelayMs: 1000,
        maxRetryDelayMs: 8000
      }
    }
  },
  steeringManifestLoadPolicy: {
    default: defaultLoadPolicy
  },
  // These default settings are deprecated in favor of the above policies
  // and are maintained for backwards compatibility
  manifestLoadingTimeOut: 10000,
  manifestLoadingMaxRetry: 1,
  manifestLoadingRetryDelay: 1000,
  manifestLoadingMaxRetryTimeout: 64000,
  levelLoadingTimeOut: 10000,
  levelLoadingMaxRetry: 4,
  levelLoadingRetryDelay: 1000,
  levelLoadingMaxRetryTimeout: 64000,
  fragLoadingTimeOut: 20000,
  fragLoadingMaxRetry: 6,
  fragLoadingRetryDelay: 1000,
  fragLoadingMaxRetryTimeout: 64000
}, timelineConfig()), {}, {
  subtitleStreamController: undefined,
  subtitleTrackController: undefined,
  timelineController: undefined,
  audioStreamController: undefined,
  audioTrackController: undefined,
  emeController: undefined,
  cmcdController: undefined,
  contentSteeringController: undefined
});
function timelineConfig() {
  return {
    cueHandler: Cues,
    // used by timeline-controller
    enableWebVTT: false,
    // used by timeline-controller
    enableIMSC1: false,
    // used by timeline-controller
    enableCEA708Captions: false,
    // used by timeline-controller
    captionsTextTrack1Label: 'English',
    // used by timeline-controller
    captionsTextTrack1LanguageCode: 'en',
    // used by timeline-controller
    captionsTextTrack2Label: 'Spanish',
    // used by timeline-controller
    captionsTextTrack2LanguageCode: 'es',
    // used by timeline-controller
    captionsTextTrack3Label: 'Unknown CC',
    // used by timeline-controller
    captionsTextTrack3LanguageCode: '',
    // used by timeline-controller
    captionsTextTrack4Label: 'Unknown CC',
    // used by timeline-controller
    captionsTextTrack4LanguageCode: '',
    // used by timeline-controller
    renderTextTracksNatively: true
  };
}

/**
 * @ignore
 */
function mergeConfig(defaultConfig, userConfig) {
  if ((userConfig.liveSyncDurationCount || userConfig.liveMaxLatencyDurationCount) && (userConfig.liveSyncDuration || userConfig.liveMaxLatencyDuration)) {
    throw new Error("Illegal hls.js config: don't mix up liveSyncDurationCount/liveMaxLatencyDurationCount and liveSyncDuration/liveMaxLatencyDuration");
  }
  if (userConfig.liveMaxLatencyDurationCount !== undefined && (userConfig.liveSyncDurationCount === undefined || userConfig.liveMaxLatencyDurationCount <= userConfig.liveSyncDurationCount)) {
    throw new Error('Illegal hls.js config: "liveMaxLatencyDurationCount" must be greater than "liveSyncDurationCount"');
  }
  if (userConfig.liveMaxLatencyDuration !== undefined && (userConfig.liveSyncDuration === undefined || userConfig.liveMaxLatencyDuration <= userConfig.liveSyncDuration)) {
    throw new Error('Illegal hls.js config: "liveMaxLatencyDuration" must be greater than "liveSyncDuration"');
  }
  const defaultsCopy = deepCpy(defaultConfig);

  // Backwards compatibility with deprecated config values
  const deprecatedSettingTypes = ['manifest', 'level', 'frag'];
  const deprecatedSettings = ['TimeOut', 'MaxRetry', 'RetryDelay', 'MaxRetryTimeout'];
  deprecatedSettingTypes.forEach(type => {
    const policyName = `${type === 'level' ? 'playlist' : type}LoadPolicy`;
    const policyNotSet = userConfig[policyName] === undefined;
    const report = [];
    deprecatedSettings.forEach(setting => {
      const deprecatedSetting = `${type}Loading${setting}`;
      const value = userConfig[deprecatedSetting];
      if (value !== undefined && policyNotSet) {
        report.push(deprecatedSetting);
        const settings = defaultsCopy[policyName].default;
        userConfig[policyName] = {
          default: settings
        };
        switch (setting) {
          case 'TimeOut':
            settings.maxLoadTimeMs = value;
            settings.maxTimeToFirstByteMs = value;
            break;
          case 'MaxRetry':
            settings.errorRetry.maxNumRetry = value;
            settings.timeoutRetry.maxNumRetry = value;
            break;
          case 'RetryDelay':
            settings.errorRetry.retryDelayMs = value;
            settings.timeoutRetry.retryDelayMs = value;
            break;
          case 'MaxRetryTimeout':
            settings.errorRetry.maxRetryDelayMs = value;
            settings.timeoutRetry.maxRetryDelayMs = value;
            break;
        }
      }
    });
    if (report.length) {
      logger.warn(`hls.js config: "${report.join('", "')}" setting(s) are deprecated, use "${policyName}": ${JSON.stringify(userConfig[policyName])}`);
    }
  });
  return _objectSpread2(_objectSpread2({}, defaultsCopy), userConfig);
}
function deepCpy(obj) {
  if (obj && typeof obj === 'object') {
    if (Array.isArray(obj)) {
      return obj.map(deepCpy);
    }
    return Object.keys(obj).reduce((result, key) => {
      result[key] = deepCpy(obj[key]);
      return result;
    }, {});
  }
  return obj;
}

/**
 * @ignore
 */
function enableStreamingMode(config) {
  const currentLoader = config.loader;
  if (currentLoader !== FetchLoader && currentLoader !== XhrLoader) {
    // If a developer has configured their own loader, respect that choice
    logger.log('[config]: Custom loader detected, cannot enable progressive streaming');
    config.progressive = false;
  } else {
    const canStreamProgressively = fetchSupported();
    if (canStreamProgressively) {
      config.loader = FetchLoader;
      config.progressive = true;
      config.enableSoftwareAES = true;
      logger.log('[config]: Progressive streaming enabled, using FetchLoader');
    }
  }
}

/**
 * The `Hls` class is the core of the HLS.js library used to instantiate player instances.
 * @public
 */
class Hls {
  /**
   * The runtime configuration used by the player. At instantiation this is combination of `hls.userConfig` merged over `Hls.DefaultConfig`.
   */

  /**
   * The configuration object provided on player instantiation.
   */

  /**
   * Get the video-dev/hls.js package version.
   */
  static get version() {
    return undefined;
  }

  /**
   * Check if the required MediaSource Extensions are available.
   */
  static isSupported() {
    return isSupported();
  }
  static get Events() {
    return Events;
  }
  static get ErrorTypes() {
    return ErrorTypes;
  }
  static get ErrorDetails() {
    return ErrorDetails;
  }

  /**
   * Get the default configuration applied to new instances.
   */
  static get DefaultConfig() {
    if (!Hls.defaultConfig) {
      return hlsDefaultConfig;
    }
    return Hls.defaultConfig;
  }

  /**
   * Replace the default configuration applied to new instances.
   */
  static set DefaultConfig(defaultConfig) {
    Hls.defaultConfig = defaultConfig;
  }

  /**
   * Creates an instance of an HLS client that can attach to exactly one `HTMLMediaElement`.
   * @param userConfig - Configuration options applied over `Hls.DefaultConfig`
   */
  constructor(userConfig = {}) {
    this.config = void 0;
    this.userConfig = void 0;
    this.coreComponents = void 0;
    this.networkControllers = void 0;
    this._emitter = new EventEmitter();
    this._autoLevelCapping = void 0;
    this._maxHdcpLevel = null;
    this.abrController = void 0;
    this.bufferController = void 0;
    this.capLevelController = void 0;
    this.latencyController = void 0;
    this.levelController = void 0;
    this.streamController = void 0;
    this.audioTrackController = void 0;
    this.subtitleTrackController = void 0;
    this.emeController = void 0;
    this.cmcdController = void 0;
    this._media = null;
    this.url = null;
    enableLogs(userConfig.debug || false, 'Hls instance');
    const config = this.config = mergeConfig(Hls.DefaultConfig, userConfig);
    this.userConfig = userConfig;
    this._autoLevelCapping = -1;
    if (config.progressive) {
      enableStreamingMode(config);
    }

    // core controllers and network loaders
    const {
      abrController: ConfigAbrController,
      bufferController: ConfigBufferController,
      capLevelController: ConfigCapLevelController,
      errorController: ConfigErrorController,
      fpsController: ConfigFpsController
    } = config;
    const errorController = new ConfigErrorController(this);
    const abrController = this.abrController = new ConfigAbrController(this);
    const bufferController = this.bufferController = new ConfigBufferController(this);
    const capLevelController = this.capLevelController = new ConfigCapLevelController(this);
    const fpsController = new ConfigFpsController(this);
    const playListLoader = new PlaylistLoader(this);
    const id3TrackController = new ID3TrackController(this);
    const ConfigContentSteeringController = config.contentSteeringController;
    // ConentSteeringController is defined before LevelController to receive Multivariant Playlist events first
    const contentSteering = ConfigContentSteeringController ? new ConfigContentSteeringController(this) : null;
    const levelController = this.levelController = new LevelController(this, contentSteering);
    // FragmentTracker must be defined before StreamController because the order of event handling is important
    const fragmentTracker = new FragmentTracker(this);
    const keyLoader = new KeyLoader(this.config);
    const streamController = this.streamController = new StreamController(this, fragmentTracker, keyLoader);

    // Cap level controller uses streamController to flush the buffer
    capLevelController.setStreamController(streamController);
    // fpsController uses streamController to switch when frames are being dropped
    fpsController.setStreamController(streamController);
    const networkControllers = [playListLoader, levelController, streamController];
    if (contentSteering) {
      networkControllers.splice(1, 0, contentSteering);
    }
    this.networkControllers = networkControllers;
    const coreComponents = [abrController, bufferController, capLevelController, fpsController, id3TrackController, fragmentTracker];
    this.audioTrackController = this.createController(config.audioTrackController, networkControllers);
    const AudioStreamControllerClass = config.audioStreamController;
    if (AudioStreamControllerClass) {
      networkControllers.push(new AudioStreamControllerClass(this, fragmentTracker, keyLoader));
    }
    // subtitleTrackController must be defined before subtitleStreamController because the order of event handling is important
    this.subtitleTrackController = this.createController(config.subtitleTrackController, networkControllers);
    const SubtitleStreamControllerClass = config.subtitleStreamController;
    if (SubtitleStreamControllerClass) {
      networkControllers.push(new SubtitleStreamControllerClass(this, fragmentTracker, keyLoader));
    }
    this.createController(config.timelineController, coreComponents);
    keyLoader.emeController = this.emeController = this.createController(config.emeController, coreComponents);
    this.cmcdController = this.createController(config.cmcdController, coreComponents);
    this.latencyController = this.createController(LatencyController, coreComponents);
    this.coreComponents = coreComponents;

    // Error controller handles errors before and after all other controllers
    // This listener will be invoked after all other controllers error listeners
    networkControllers.push(errorController);
    const onErrorOut = errorController.onErrorOut;
    if (typeof onErrorOut === 'function') {
      this.on(Events.ERROR, onErrorOut, errorController);
    }
  }
  createController(ControllerClass, components) {
    if (ControllerClass) {
      const controllerInstance = new ControllerClass(this);
      if (components) {
        components.push(controllerInstance);
      }
      return controllerInstance;
    }
    return null;
  }

  // Delegate the EventEmitter through the public API of Hls.js
  on(event, listener, context = this) {
    this._emitter.on(event, listener, context);
  }
  once(event, listener, context = this) {
    this._emitter.once(event, listener, context);
  }
  removeAllListeners(event) {
    this._emitter.removeAllListeners(event);
  }
  off(event, listener, context = this, once) {
    this._emitter.off(event, listener, context, once);
  }
  listeners(event) {
    return this._emitter.listeners(event);
  }
  emit(event, name, eventObject) {
    return this._emitter.emit(event, name, eventObject);
  }
  trigger(event, eventObject) {
    if (this.config.debug) {
      return this.emit(event, event, eventObject);
    } else {
      try {
        return this.emit(event, event, eventObject);
      } catch (e) {
        logger.error('An internal error happened while handling event ' + event + '. Error message: "' + e.message + '". Here is a stacktrace:', e);
        this.trigger(Events.ERROR, {
          type: ErrorTypes.OTHER_ERROR,
          details: ErrorDetails.INTERNAL_EXCEPTION,
          fatal: false,
          event: event,
          error: e
        });
      }
    }
    return false;
  }
  listenerCount(event) {
    return this._emitter.listenerCount(event);
  }

  /**
   * Dispose of the instance
   */
  destroy() {
    logger.log('destroy');
    this.trigger(Events.DESTROYING, undefined);
    this.detachMedia();
    this.removeAllListeners();
    this._autoLevelCapping = -1;
    this.url = null;
    this.networkControllers.forEach(component => component.destroy());
    this.networkControllers.length = 0;
    this.coreComponents.forEach(component => component.destroy());
    this.coreComponents.length = 0;
    // Remove any references that could be held in config options or callbacks
    const config = this.config;
    config.xhrSetup = config.fetchSetup = undefined;
    // @ts-ignore
    this.userConfig = null;
  }

  /**
   * Attaches Hls.js to a media element
   */
  attachMedia(media) {
    logger.log('attachMedia');
    this._media = media;
    this.trigger(Events.MEDIA_ATTACHING, {
      media: media
    });
  }

  /**
   * Detach Hls.js from the media
   */
  detachMedia() {
    logger.log('detachMedia');
    this.trigger(Events.MEDIA_DETACHING, undefined);
    this._media = null;
  }

  /**
   * Set the source URL. Can be relative or absolute.
   */
  loadSource(url) {
    this.stopLoad();
    const media = this.media;
    const loadedSource = this.url;
    const loadingSource = this.url = urlToolkitExports.buildAbsoluteURL(self.location.href, url, {
      alwaysNormalize: true
    });
    logger.log(`loadSource:${loadingSource}`);
    if (media && loadedSource && (loadedSource !== loadingSource || this.bufferController.hasSourceTypes())) {
      this.detachMedia();
      this.attachMedia(media);
    }
    // when attaching to a source URL, trigger a playlist load
    this.trigger(Events.MANIFEST_LOADING, {
      url: url
    });
  }

  /**
   * Start loading data from the stream source.
   * Depending on default config, client starts loading automatically when a source is set.
   *
   * @param startPosition - Set the start position to stream from.
   * Defaults to -1 (None: starts from earliest point)
   */
  startLoad(startPosition = -1) {
    logger.log(`startLoad(${startPosition})`);
    this.networkControllers.forEach(controller => {
      controller.startLoad(startPosition);
    });
  }

  /**
   * Stop loading of any stream data.
   */
  stopLoad() {
    logger.log('stopLoad');
    this.networkControllers.forEach(controller => {
      controller.stopLoad();
    });
  }

  /**
   * Swap through possible audio codecs in the stream (for example to switch from stereo to 5.1)
   */
  swapAudioCodec() {
    logger.log('swapAudioCodec');
    this.streamController.swapAudioCodec();
  }

  /**
   * When the media-element fails, this allows to detach and then re-attach it
   * as one call (convenience method).
   *
   * Automatic recovery of media-errors by this process is configurable.
   */
  recoverMediaError() {
    logger.log('recoverMediaError');
    const media = this._media;
    this.detachMedia();
    if (media) {
      this.attachMedia(media);
    }
  }
  removeLevel(levelIndex, urlId = 0) {
    this.levelController.removeLevel(levelIndex, urlId);
  }

  /**
   * @returns an array of levels (variants) sorted by HDCP-LEVEL, BANDWIDTH, SCORE, and RESOLUTION (height)
   */
  get levels() {
    const levels = this.levelController.levels;
    return levels ? levels : [];
  }

  /**
   * Index of quality level (variant) currently played
   */
  get currentLevel() {
    return this.streamController.currentLevel;
  }

  /**
   * Set quality level index immediately. This will flush the current buffer to replace the quality asap. That means playback will interrupt at least shortly to re-buffer and re-sync eventually. Set to -1 for automatic level selection.
   */
  set currentLevel(newLevel) {
    logger.log(`set currentLevel:${newLevel}`);
    this.loadLevel = newLevel;
    this.abrController.clearTimer();
    this.streamController.immediateLevelSwitch();
  }

  /**
   * Index of next quality level loaded as scheduled by stream controller.
   */
  get nextLevel() {
    return this.streamController.nextLevel;
  }

  /**
   * Set quality level index for next loaded data.
   * This will switch the video quality asap, without interrupting playback.
   * May abort current loading of data, and flush parts of buffer (outside currently played fragment region).
   * @param newLevel - Pass -1 for automatic level selection
   */
  set nextLevel(newLevel) {
    logger.log(`set nextLevel:${newLevel}`);
    this.levelController.manualLevel = newLevel;
    this.streamController.nextLevelSwitch();
  }

  /**
   * Return the quality level of the currently or last (of none is loaded currently) segment
   */
  get loadLevel() {
    return this.levelController.level;
  }

  /**
   * Set quality level index for next loaded data in a conservative way.
   * This will switch the quality without flushing, but interrupt current loading.
   * Thus the moment when the quality switch will appear in effect will only be after the already existing buffer.
   * @param newLevel - Pass -1 for automatic level selection
   */
  set loadLevel(newLevel) {
    logger.log(`set loadLevel:${newLevel}`);
    this.levelController.manualLevel = newLevel;
  }

  /**
   * get next quality level loaded
   */
  get nextLoadLevel() {
    return this.levelController.nextLoadLevel;
  }

  /**
   * Set quality level of next loaded segment in a fully "non-destructive" way.
   * Same as `loadLevel` but will wait for next switch (until current loading is done).
   */
  set nextLoadLevel(level) {
    this.levelController.nextLoadLevel = level;
  }

  /**
   * Return "first level": like a default level, if not set,
   * falls back to index of first level referenced in manifest
   */
  get firstLevel() {
    return Math.max(this.levelController.firstLevel, this.minAutoLevel);
  }

  /**
   * Sets "first-level", see getter.
   */
  set firstLevel(newLevel) {
    logger.log(`set firstLevel:${newLevel}`);
    this.levelController.firstLevel = newLevel;
  }

  /**
   * Return start level (level of first fragment that will be played back)
   * if not overrided by user, first level appearing in manifest will be used as start level
   * if -1 : automatic start level selection, playback will start from level matching download bandwidth
   * (determined from download of first segment)
   */
  get startLevel() {
    return this.levelController.startLevel;
  }

  /**
   * set  start level (level of first fragment that will be played back)
   * if not overrided by user, first level appearing in manifest will be used as start level
   * if -1 : automatic start level selection, playback will start from level matching download bandwidth
   * (determined from download of first segment)
   */
  set startLevel(newLevel) {
    logger.log(`set startLevel:${newLevel}`);
    // if not in automatic start level detection, ensure startLevel is greater than minAutoLevel
    if (newLevel !== -1) {
      newLevel = Math.max(newLevel, this.minAutoLevel);
    }
    this.levelController.startLevel = newLevel;
  }

  /**
   * Whether level capping is enabled.
   * Default value is set via `config.capLevelToPlayerSize`.
   */
  get capLevelToPlayerSize() {
    return this.config.capLevelToPlayerSize;
  }

  /**
   * Enables or disables level capping. If disabled after previously enabled, `nextLevelSwitch` will be immediately called.
   */
  set capLevelToPlayerSize(shouldStartCapping) {
    const newCapLevelToPlayerSize = !!shouldStartCapping;
    if (newCapLevelToPlayerSize !== this.config.capLevelToPlayerSize) {
      if (newCapLevelToPlayerSize) {
        this.capLevelController.startCapping(); // If capping occurs, nextLevelSwitch will happen based on size.
      } else {
        this.capLevelController.stopCapping();
        this.autoLevelCapping = -1;
        this.streamController.nextLevelSwitch(); // Now we're uncapped, get the next level asap.
      }

      this.config.capLevelToPlayerSize = newCapLevelToPlayerSize;
    }
  }

  /**
   * Capping/max level value that should be used by automatic level selection algorithm (`ABRController`)
   */
  get autoLevelCapping() {
    return this._autoLevelCapping;
  }

  /**
   * Returns the current bandwidth estimate in bits per second, when available. Otherwise, `NaN` is returned.
   */
  get bandwidthEstimate() {
    const {
      bwEstimator
    } = this.abrController;
    if (!bwEstimator) {
      return NaN;
    }
    return bwEstimator.getEstimate();
  }

  /**
   * get time to first byte estimate
   * @type {number}
   */
  get ttfbEstimate() {
    const {
      bwEstimator
    } = this.abrController;
    if (!bwEstimator) {
      return NaN;
    }
    return bwEstimator.getEstimateTTFB();
  }

  /**
   * Capping/max level value that should be used by automatic level selection algorithm (`ABRController`)
   */
  set autoLevelCapping(newLevel) {
    if (this._autoLevelCapping !== newLevel) {
      logger.log(`set autoLevelCapping:${newLevel}`);
      this._autoLevelCapping = newLevel;
    }
  }
  get maxHdcpLevel() {
    return this._maxHdcpLevel;
  }
  set maxHdcpLevel(value) {
    if (HdcpLevels.indexOf(value) > -1) {
      this._maxHdcpLevel = value;
    }
  }

  /**
   * True when automatic level selection enabled
   */
  get autoLevelEnabled() {
    return this.levelController.manualLevel === -1;
  }

  /**
   * Level set manually (if any)
   */
  get manualLevel() {
    return this.levelController.manualLevel;
  }

  /**
   * min level selectable in auto mode according to config.minAutoBitrate
   */
  get minAutoLevel() {
    const {
      levels,
      config: {
        minAutoBitrate
      }
    } = this;
    if (!levels) return 0;
    const len = levels.length;
    for (let i = 0; i < len; i++) {
      if (levels[i].maxBitrate >= minAutoBitrate) {
        return i;
      }
    }
    return 0;
  }

  /**
   * max level selectable in auto mode according to autoLevelCapping
   */
  get maxAutoLevel() {
    const {
      levels,
      autoLevelCapping,
      maxHdcpLevel
    } = this;
    let maxAutoLevel;
    if (autoLevelCapping === -1 && levels && levels.length) {
      maxAutoLevel = levels.length - 1;
    } else {
      maxAutoLevel = autoLevelCapping;
    }
    if (maxHdcpLevel) {
      for (let i = maxAutoLevel; i--;) {
        const hdcpLevel = levels[i].attrs['HDCP-LEVEL'];
        if (hdcpLevel && hdcpLevel <= maxHdcpLevel) {
          return i;
        }
      }
    }
    return maxAutoLevel;
  }

  /**
   * next automatically selected quality level
   */
  get nextAutoLevel() {
    // ensure next auto level is between  min and max auto level
    return Math.min(Math.max(this.abrController.nextAutoLevel, this.minAutoLevel), this.maxAutoLevel);
  }

  /**
   * this setter is used to force next auto level.
   * this is useful to force a switch down in auto mode:
   * in case of load error on level N, hls.js can set nextAutoLevel to N-1 for example)
   * forced value is valid for one fragment. upon successful frag loading at forced level,
   * this value will be resetted to -1 by ABR controller.
   */
  set nextAutoLevel(nextLevel) {
    this.abrController.nextAutoLevel = Math.max(this.minAutoLevel, nextLevel);
  }

  /**
   * get the datetime value relative to media.currentTime for the active level Program Date Time if present
   */
  get playingDate() {
    return this.streamController.currentProgramDateTime;
  }
  get mainForwardBufferInfo() {
    return this.streamController.getMainFwdBufferInfo();
  }

  /**
   * Get the list of selectable audio tracks
   */
  get audioTracks() {
    const audioTrackController = this.audioTrackController;
    return audioTrackController ? audioTrackController.audioTracks : [];
  }

  /**
   * index of the selected audio track (index in audio track lists)
   */
  get audioTrack() {
    const audioTrackController = this.audioTrackController;
    return audioTrackController ? audioTrackController.audioTrack : -1;
  }

  /**
   * selects an audio track, based on its index in audio track lists
   */
  set audioTrack(audioTrackId) {
    const audioTrackController = this.audioTrackController;
    if (audioTrackController) {
      audioTrackController.audioTrack = audioTrackId;
    }
  }

  /**
   * get alternate subtitle tracks list from playlist
   */
  get subtitleTracks() {
    const subtitleTrackController = this.subtitleTrackController;
    return subtitleTrackController ? subtitleTrackController.subtitleTracks : [];
  }

  /**
   * index of the selected subtitle track (index in subtitle track lists)
   */
  get subtitleTrack() {
    const subtitleTrackController = this.subtitleTrackController;
    return subtitleTrackController ? subtitleTrackController.subtitleTrack : -1;
  }
  get media() {
    return this._media;
  }

  /**
   * select an subtitle track, based on its index in subtitle track lists
   */
  set subtitleTrack(subtitleTrackId) {
    const subtitleTrackController = this.subtitleTrackController;
    if (subtitleTrackController) {
      subtitleTrackController.subtitleTrack = subtitleTrackId;
    }
  }

  /**
   * Whether subtitle display is enabled or not
   */
  get subtitleDisplay() {
    const subtitleTrackController = this.subtitleTrackController;
    return subtitleTrackController ? subtitleTrackController.subtitleDisplay : false;
  }

  /**
   * Enable/disable subtitle display rendering
   */
  set subtitleDisplay(value) {
    const subtitleTrackController = this.subtitleTrackController;
    if (subtitleTrackController) {
      subtitleTrackController.subtitleDisplay = value;
    }
  }

  /**
   * get mode for Low-Latency HLS loading
   */
  get lowLatencyMode() {
    return this.config.lowLatencyMode;
  }

  /**
   * Enable/disable Low-Latency HLS part playlist and segment loading, and start live streams at playlist PART-HOLD-BACK rather than HOLD-BACK.
   */
  set lowLatencyMode(mode) {
    this.config.lowLatencyMode = mode;
  }

  /**
   * Position (in seconds) of live sync point (ie edge of live position minus safety delay defined by ```hls.config.liveSyncDuration```)
   * @returns null prior to loading live Playlist
   */
  get liveSyncPosition() {
    return this.latencyController.liveSyncPosition;
  }

  /**
   * Estimated position (in seconds) of live edge (ie edge of live playlist plus time sync playlist advanced)
   * @returns 0 before first playlist is loaded
   */
  get latency() {
    return this.latencyController.latency;
  }

  /**
   * maximum distance from the edge before the player seeks forward to ```hls.liveSyncPosition```
   * configured using ```liveMaxLatencyDurationCount``` (multiple of target duration) or ```liveMaxLatencyDuration```
   * @returns 0 before first playlist is loaded
   */
  get maxLatency() {
    return this.latencyController.maxLatency;
  }

  /**
   * target distance from the edge as calculated by the latency controller
   */
  get targetLatency() {
    return this.latencyController.targetLatency;
  }

  /**
   * the rate at which the edge of the current live playlist is advancing or 1 if there is none
   */
  get drift() {
    return this.latencyController.drift;
  }

  /**
   * set to true when startLoad is called before MANIFEST_PARSED event
   */
  get forceStartLoad() {
    return this.streamController.forceStartLoad;
  }
}
Hls.defaultConfig = void 0;

export { Hls as default };
//# sourceMappingURL=hls.light.mjs.map
