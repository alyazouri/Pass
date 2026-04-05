// ═══════════════════════════════════════════════════════════════
//  PUBG Mobile — Jordan-First Matchmaking PAC Script  v5.1
//
//  التحسين الجوهري في v5.1:
//   • IN_GAME → DIRECT (بدون بروكسي داخل المباراة = أقل ping)
//   • البروكسي يُستخدم فقط أثناء SEARCHING و MATCHED
//   • باقي التحسينات من v5.0 محتفظ بها كاملاً
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────
//  §1  PROXY POOLS
//
//  T1_MATCH  → MATCHED فقط — بورت 20005 (تأكيد بدء المباراة)
//  T2_LOBBY  → Matchmaking  — بورت 1080  (استقرار اللوبي)
//  T3_ARAB   → Arab fallback — بورت 443  (تجاوز الجدران النارية)
// ─────────────────────────────────────────────
var T1_MATCH = [
  "PROXY 82.212.84.33:20005",
  "PROXY 176.29.153.95:20005",
  "PROXY 46.185.131.218:20005"
];

var T2_LOBBY = [
  "PROXY 82.212.84.33:1080",
  "PROXY 176.29.153.95:1080",
  "PROXY 46.185.131.218:1080"
];

var T3_ARAB = [
  "PROXY 82.212.84.33:443",
  "PROXY 176.29.153.95:443",
  "PROXY 46.185.131.218:443"
];

var BLOCK  = "PROXY 127.0.0.1:9";
var DIRECT = "DIRECT";

// ─────────────────────────────────────────────
//  §2  STATE MACHINE
//
//   IDLE ──▶ SEARCHING ──▶ MATCHED ──▶ IN_GAME
//              │                          │
//              └──────── TIMEOUT ─────────┘
//
//  IDLE / SEARCHING → بروكسي اللوبي الأردني
//  MATCHED          → بروكسي T1_MATCH مؤقتاً
//  IN_GAME          → DIRECT مباشرةً (أقل ping)
// ─────────────────────────────────────────────
var STATE = {
  IDLE:      0,
  SEARCHING: 1,
  MATCHED:   2,
  IN_GAME:   3
};

var SESSION = {
  state:           0,
  matchNet:        null,
  matchHost:       null,
  matchIP:         null,
  isV6:            false,
  dnsCache:        {},
  dnsTTL:          {},
  classifyCache:   {},
  classifyTTL:     {},
  proxyIndex:      0,
  proxyFails:      {},
  proxyDeadUntil:  {},
  failCount:       0,
  backoffUntil:    0,
  lastActivity:    0,
  searchStartTime: 0,
  lobbyWide:       false,
  jordanIPSeen:    0,
  totalIPSeen:     0,
  txCount:         0,
  hashSeed:        0
};

// ─────────────────────────────────────────────
//  §3  TIMEOUTS & THRESHOLDS
// ─────────────────────────────────────────────
var T_SESSION_IDLE   = 90000;   // 90 ث بدون نشاط → إعادة تهيئة الجلسة
var T_SEARCH_MAX     = 90000;   // 90 ث حد البحث المحلي قبل توسيع الـ pool
var T_DNS_TTL        = 30000;   // 30 ث صلاحية كاش الـ DNS
var T_CLASSIFY_TTL   = 20000;   // 20 ث صلاحية كاش التصنيف
var T_PROXY_DEAD     = 15000;   // 15 ث تجميد البروكسي الفاشل

var THRESHOLD        = 12;      // حد أدنى للنقاط لاعتبار التصنيف صحيحاً

// نسبة الـ IPs الأردنية الدنيا للإبقاء على اللوبي المحلي
var JORDAN_DENSITY_MIN = 0.30;

// ─────────────────────────────────────────────
//  §4  CONSISTENT HASH + PROXY SELECTION
// ─────────────────────────────────────────────
function hashStr(s) {
  var h = 0x811c9dc5;
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h;
}

function pickAliveProxy(pool, key) {
  if (!pool || pool.length === 0) return BLOCK;
  var t   = now();
  var idx = hashStr(key + SESSION.hashSeed) % pool.length;
  for (var attempt = 0; attempt < pool.length; attempt++) {
    var p = pool[(idx + attempt) % pool.length];
    if (!SESSION.proxyDeadUntil[p] || SESSION.proxyDeadUntil[p] <= t) {
      return p;
    }
  }
  return pool[idx]; // كل البروكسيات مجمّدة → أعد الافتراضي
}

// ─────────────────────────────────────────────
//  §5  PER-PROXY FAILURE TRACKING
// ─────────────────────────────────────────────
var PROXY_FAIL_LIMIT = 3;

function recordProxyFailure(proxy) {
  if (!proxy || proxy === BLOCK || proxy === DIRECT) return;
  SESSION.proxyFails[proxy] = (SESSION.proxyFails[proxy] || 0) + 1;
  if (SESSION.proxyFails[proxy] >= PROXY_FAIL_LIMIT) {
    SESSION.proxyDeadUntil[proxy] = now() + T_PROXY_DEAD;
    SESSION.proxyFails[proxy]     = 0;
  }
}

function clearProxyFailure(proxy) {
  if (!proxy) return;
  SESSION.proxyFails[proxy]     = 0;
  SESSION.proxyDeadUntil[proxy] = 0;
}

// ─────────────────────────────────────────────
//  §6  GLOBAL BACKOFF ENGINE
// ─────────────────────────────────────────────
var BACKOFF_BASE_MS = 300;
var BACKOFF_MAX_MS  = 8000;

function recordFailure() {
  SESSION.failCount++;
  var delay = BACKOFF_BASE_MS;
  for (var i = 1; i < SESSION.failCount && i < 6; i++) delay *= 2;
  if (delay > BACKOFF_MAX_MS) delay = BACKOFF_MAX_MS;
  var jitter = hashStr("jit" + SESSION.failCount + SESSION.lastActivity) % 100;
  delay = delay + Math.floor(delay * (jitter - 50) / 500);
  SESSION.backoffUntil = SESSION.lastActivity + delay;
}

function clearFailures() {
  SESSION.failCount    = 0;
  SESSION.backoffUntil = 0;
}

function isInBackoff(t) {
  return SESSION.backoffUntil > 0 && t < SESSION.backoffUntil;
}

// ─────────────────────────────────────────────
//  §7  TRAFFIC SCORING ENGINE
// ─────────────────────────────────────────────
var SCORE_MATCH = [
  ["udp",12],       ["tick",13],      ["sync",10],
  ["realtime",10],  ["battle",11],    ["combat",11],
  ["frame",12],     ["physics",13],   ["movement",12],
  ["shoot",13],     ["fire",11],      ["hit",11],
  ["damage",11],    ["relay",10],     ["dtls",14],
  ["rtp",14],       ["srtp",15],      ["stun",11],
  ["turn",9],       ["ice",8],
  // PUBG Mobile محدد
  ["gameserver",15],["gs.",14],       ["battleground",14],
  ["pubgmatch",16], ["ingest",12],    ["dedicated",12],
  ["gamedata",13],  ["netgame",14],   ["livestate",13]
];

var SCORE_LOBBY = [
  ["lobby",16],     ["matchmak",16],  ["queue",13],
  ["dispatch",13],  ["gateway",11],   ["region",9],
  ["join",11],      ["recruit",12],   ["pair",12],
  ["assign",11],    ["roster",11],    ["rank",9],
  ["rating",9],     ["mmr",13],       ["elo",11],
  ["pool",10],      ["slot",10],      ["room",11],
  ["bracket",11],   ["wait",8],       ["search",10],
  ["find",9],       ["discover",12],  ["avail",9],
  // ISPs أردنية
  ["zain",15],      ["linkdotnet",13],["orange.jo",14],
  ["umniah",14],    ["jordan",11],    ["amman",10],
  // PUBG Lobby محدد
  ["matchserver",16],["lobbyserver",16],["playerlist",13],
  ["sessioncreate",15],["roommatch",14],["playerpool",14]
];

var SCORE_SOCIAL = [
  ["friend",9],     ["invite",9],     ["squad",10],
  ["party",10],     ["clan",9],       ["presence",9],
  ["voice",8],      ["chat",7],       ["notify",7],
  ["push",6],       ["broadcast",7],
  ["profile",8],    ["contact",8],    ["team",9]
];

var SCORE_CDN = [
  ["cdn",11],       ["asset",11],     ["resource",10],
  ["static",11],    ["media",10],     ["patch",12],
  ["update",11],    ["download",12],  ["bundle",11],
  ["pak",13],       ["obb",13],       ["manifest",13],
  ["version",11],   ["config",10],
  ["akamai",15],    ["fastly",15],    ["cloudfront",15],
  ["edgenode",14],  ["s3.amazon",14], ["storage.",13]
];

function computeScore(haystack, weights) {
  var score = 0;
  var h = haystack.toLowerCase();
  for (var i = 0; i < weights.length; i++) {
    if (h.indexOf(weights[i][0]) !== -1) score += weights[i][1];
  }
  return score;
}

function classifyTraffic(url, host) {
  var key = host + "|" + url.substring(0, 60);
  var t   = now();
  if (SESSION.classifyCache[key] && SESSION.classifyTTL[key] > t)
    return SESSION.classifyCache[key];

  var corpus  = url + " " + host;
  var sMatch  = computeScore(corpus, SCORE_MATCH);
  var sLobby  = computeScore(corpus, SCORE_LOBBY);
  var sSocial = computeScore(corpus, SCORE_SOCIAL);
  var sCDN    = computeScore(corpus, SCORE_CDN);

  // CDN له أولوية مطلقة
  if (sCDN >= 15 && sCDN > sMatch && sCDN > sLobby) {
    SESSION.classifyCache[key] = "CDN";
    SESSION.classifyTTL[key]   = t + T_CLASSIFY_TTL;
    return "CDN";
  }

  var max  = sMatch;
  var type = "MATCH";
  if (sLobby  > max) { max = sLobby;  type = "LOBBY";  }
  if (sSocial > max) { max = sSocial; type = "SOCIAL"; }
  if (sCDN    > max) { max = sCDN;    type = "CDN";    }

  var result = (max >= THRESHOLD) ? type : "UNKNOWN";
  SESSION.classifyCache[key] = result;
  SESSION.classifyTTL[key]   = t + T_CLASSIFY_TTL;
  return result;
}

// ─────────────────────────────────────────────
//  §8  IP RANGES — JORDAN
// ─────────────────────────────────────────────
var ZAIN_IPV4 = [
  ["81.28.112.0",   "255.255.240.0"],
  ["82.212.64.0",   "255.255.192.0"],
  ["188.123.160.0", "255.255.224.0"]
];
var ZAIN_IPV6_PFX = ["2a00:18d0","2a00:18d8"];

var JORDAN_IPV4 = [
  // Zain
  ["81.28.112.0","255.255.240.0"],  ["82.212.64.0","255.255.192.0"],
  ["188.123.160.0","255.255.224.0"],
  // Umniah
  ["5.45.128.0","255.255.240.0"],   ["46.23.112.0","255.255.240.0"],
  ["46.248.192.0","255.255.224.0"], ["92.241.32.0","255.255.224.0"],
  ["95.172.192.0","255.255.224.0"], ["109.107.224.0","255.255.224.0"],
  ["149.200.128.0","255.255.128.0"],["178.238.176.0","255.255.240.0"],
  // Linkdotnet
  ["46.32.96.0","255.255.224.0"],   ["77.245.0.0","255.255.240.0"],
  ["80.90.160.0","255.255.240.0"],  ["94.142.32.0","255.255.224.0"],
  ["176.28.128.0","255.255.128.0"], ["176.29.0.0","255.255.0.0"],
  ["188.247.64.0","255.255.224.0"],
  // Orange JO
  ["37.202.64.0","255.255.192.0"],  ["46.185.128.0","255.255.128.0"],
  ["79.173.192.0","255.255.192.0"], ["86.108.0.0","255.255.128.0"],
  ["92.253.0.0","255.255.128.0"],   ["94.249.0.0","255.255.128.0"],
  ["193.188.64.0","255.255.224.0"], ["194.165.128.0","255.255.224.0"],
  ["213.186.160.0","255.255.224.0"],["217.23.32.0","255.255.240.0"],
  // Batelco JO
  ["91.106.96.0","255.255.240.0"],  ["91.186.224.0","255.255.224.0"],
  ["212.118.0.0","255.255.224.0"],  ["37.220.112.0","255.255.240.0"],
  // VTEL
  ["62.72.160.0","255.255.224.0"],  ["81.21.0.0","255.255.240.0"],
  ["109.237.192.0","255.255.240.0"],["176.57.0.0","255.255.224.0"],
  // Al Mouakhah
  ["37.17.192.0","255.255.240.0"],  ["37.123.64.0","255.255.224.0"],
  ["95.141.208.0","255.255.240.0"], ["178.77.128.0","255.255.192.0"],
  // Jordan Telecom
  ["212.34.0.0","255.255.224.0"],   ["212.35.64.0","255.255.192.0"],
  ["213.139.32.0","255.255.224.0"], ["217.144.0.0","255.255.240.0"],
  // DC / Network Exchange
  ["84.18.32.0","255.255.224.0"],   ["84.18.64.0","255.255.224.0"],
  ["37.152.0.0","255.255.248.0"],   ["79.134.128.0","255.255.224.0"],
  ["217.29.240.0","255.255.240.0"],
  // NITC / Academic
  ["212.34.96.0","255.255.224.0"],  ["212.34.128.0","255.255.128.0"],
  ["147.161.0.0","255.255.0.0"],
  // Additional
  ["5.11.0.0","255.255.0.0"],       ["31.9.0.0","255.255.128.0"],
  ["37.0.16.0","255.255.240.0"],    ["46.32.64.0","255.255.192.0"],
  ["46.183.0.0","255.255.128.0"],   ["78.110.32.0","255.255.224.0"],
  ["80.90.128.0","255.255.128.0"],  ["84.18.0.0","255.255.128.0"],
  ["91.186.192.0","255.255.192.0"], ["92.242.192.0","255.255.192.0"],
  ["95.141.192.0","255.255.192.0"], ["109.237.192.0","255.255.192.0"],
  ["176.57.0.0","255.255.192.0"],   ["178.77.128.0","255.255.128.0"],
  ["185.15.243.0","255.255.255.0"], ["185.24.184.0","255.255.252.0"],
  ["185.62.232.0","255.255.252.0"], ["185.93.0.0","255.255.252.0"],
  ["185.168.28.0","255.255.252.0"], ["188.247.64.0","255.255.192.0"],
  ["194.9.48.0","255.255.240.0"],   ["212.118.0.0","255.255.192.0"],
  ["213.186.128.0","255.255.192.0"]
];

var JORDAN_IPV6_PFX = [
  "2a00:18d0","2a00:18d8","2a01:9700","2a02:c040",
  "2a05:74c0","2a04:2e00","2a06:8ec0","2a0a:e500",
  "2a0c:b580","2001:41f0"
];

// ─────────────────────────────────────────────
//  §9  IP RANGES — ARAB REGION
// ─────────────────────────────────────────────
var ARAB_IPV4 = [
  // Saudi Arabia
  ["212.118.96.0","255.255.224.0"], ["37.184.0.0","255.255.128.0"],
  ["188.135.0.0","255.255.128.0"],  ["80.249.128.0","255.255.128.0"],
  ["109.224.0.0","255.255.128.0"],  ["185.161.48.0","255.255.252.0"],
  // UAE
  ["195.229.0.0","255.255.128.0"],  ["94.204.0.0","255.255.128.0"],
  ["213.42.0.0","255.255.128.0"],   ["185.50.12.0","255.255.252.0"],
  // Egypt
  ["196.205.0.0","255.255.0.0"],    ["197.0.0.0","255.0.0.0"],
  ["41.32.0.0","255.224.0.0"],      ["197.32.0.0","255.224.0.0"],
  // Kuwait
  ["82.212.0.0","255.255.192.0"],   ["88.82.0.0","255.255.0.0"],
  ["37.36.0.0","255.252.0.0"],
  // Bahrain
  ["91.74.0.0","255.255.0.0"],      ["78.26.0.0","255.254.0.0"],
  // Iraq
  ["37.236.0.0","255.252.0.0"],     ["95.111.0.0","255.255.128.0"],
  ["78.39.0.0","255.255.128.0"]
];

var ARAB_IPV6_PFX = [
  "2a01:c500","2a04:b200","2a02:c680","2a05:6480"
];

// ─────────────────────────────────────────────
//  §10  FAST-PATH: KNOWN JORDAN GAME SERVERS
// ─────────────────────────────────────────────
var KNOWN_JO_PREFIXES = [
  "46.185.131","176.29.153","212.35.66",
  "86.108.",   "92.253.",   "94.249.",
  "82.212.84", "81.28.11",  "176.29.1",
  "176.28.",   "94.142.",   "46.185.13"
];

// ─────────────────────────────────────────────
//  §11  HELPERS
// ─────────────────────────────────────────────
function norm(h) {
  var colons = 0, last = -1;
  for (var i = 0; i < h.length; i++) {
    if (h[i] === ":") { colons++; last = i; }
  }
  return (colons === 1) ? h.substring(0, last) : h;
}

function isIPv6(ip)  { return ip.indexOf(":") > -1; }
function isIP(h)     { return /^(\d{1,3}\.){3}\d{1,3}$/.test(h) || h.indexOf(":") > -1; }

function inV4(ip, list) {
  for (var i = 0; i < list.length; i++)
    if (isInNet(ip, list[i][0], list[i][1])) return true;
  return false;
}
function inV6(ip, pfxs) {
  var l = ip.toLowerCase();
  for (var i = 0; i < pfxs.length; i++)
    if (l.indexOf(pfxs[i]) === 0) return true;
  return false;
}

function isZainIP(ip)     { return isIPv6(ip) ? inV6(ip, ZAIN_IPV6_PFX)   : inV4(ip, ZAIN_IPV4); }
function isJordanIP(ip)   { return isIPv6(ip) ? inV6(ip, JORDAN_IPV6_PFX) : inV4(ip, JORDAN_IPV4); }
function isArabIP(ip)     { return isIPv6(ip) ? inV6(ip, ARAB_IPV6_PFX)   : inV4(ip, ARAB_IPV4); }
function isRegionalIP(ip) { return isJordanIP(ip) || isArabIP(ip); }

function isKnownJoHost(h) {
  for (var i = 0; i < KNOWN_JO_PREFIXES.length; i++)
    if (h.indexOf(KNOWN_JO_PREFIXES[i]) !== -1) return true;
  return false;
}

function isPUBG(h) {
  return /pubg|pubgm|pubgmobile|tencent|krafton|lightspeed|levelinfinite|igamecj|proximabeta|vnggames|garena|sgp\.gameops|sgp\.battleground/i.test(h);
}

function isJordanDomain(h) {
  return h.indexOf(".jo")        !== -1 ||
         h.indexOf("zain.jo")    !== -1 ||
         h.indexOf("linkdotnet") !== -1 ||
         h.indexOf("orange.jo")  !== -1 ||
         h.indexOf("umniah")     !== -1;
}

function netPrefix(ip) {
  if (isIPv6(ip)) return ip.split(":").slice(0, 3).join(":");
  return ip.split(".").slice(0, 3).join(".");
}

// ─────────────────────────────────────────────
//  §12  DNS CACHE (TTL + IPv4 أولاً للنطاقات الأردنية)
// ─────────────────────────────────────────────
function cachedResolve(host, t) {
  if (SESSION.dnsCache[host] && SESSION.dnsTTL[host] > t)
    return SESSION.dnsCache[host];

  var ips = [];
  try {
    if (typeof dnsResolveEx === "function") {
      var ex = dnsResolveEx(host);
      if (ex) {
        var parts = ex.split(";");
        for (var i = 0; i < parts.length; i++) {
          var p = parts[i].trim();
          if (p && ips.indexOf(p) === -1) ips.push(p);
        }
      }
    }
  } catch(e) {}
  try {
    if (typeof dnsResolve === "function") {
      var v4 = dnsResolve(host);
      if (v4 && ips.indexOf(v4) === -1) ips.push(v4);
    }
  } catch(e) {}

  if (ips.length > 0) {
    // قدِّم IPv4 للنطاقات الأردنية لتحسين التوافق
    if (isJordanDomain(host)) {
      ips.sort(function(a, b) { return isIPv6(a) ? 1 : -1; });
    }
    SESSION.dnsCache[host] = ips;
    SESSION.dnsTTL[host]   = t + T_DNS_TTL;
  }
  return ips;
}

function bestRegionalIP(ips) {
  for (var i = 0; i < ips.length; i++) if (!isIPv6(ips[i]) && isZainIP(ips[i]))   return ips[i];
  for (var i = 0; i < ips.length; i++) if (isIPv6(ips[i])  && isZainIP(ips[i]))   return ips[i];
  for (var i = 0; i < ips.length; i++) if (!isIPv6(ips[i]) && isJordanIP(ips[i])) return ips[i];
  for (var i = 0; i < ips.length; i++) if (isIPv6(ips[i])  && isJordanIP(ips[i])) return ips[i];
  for (var i = 0; i < ips.length; i++) if (isRegionalIP(ips[i]))                  return ips[i];
  return null;
}

function hasRegionalIP(ips) {
  for (var i = 0; i < ips.length; i++) if (isRegionalIP(ips[i])) return true;
  return false;
}

// ─────────────────────────────────────────────
//  §13  JORDAN DENSITY TRACKER
//
//  يتابع نسبة الـ IPs الأردنية أثناء البحث.
//  إذا تجاوزت JORDAN_DENSITY_MIN → الإبقاء على اللوبي المحلي.
// ─────────────────────────────────────────────
function trackDensity(ip) {
  if (!ip) return;
  SESSION.totalIPSeen++;
  if (isJordanIP(ip)) SESSION.jordanIPSeen++;
}

function jordanDensityHigh() {
  if (SESSION.totalIPSeen < 3) return true;
  return (SESSION.jordanIPSeen / SESSION.totalIPSeen) >= JORDAN_DENSITY_MIN;
}

// ─────────────────────────────────────────────
//  §14  SESSION MANAGER
// ─────────────────────────────────────────────
function now() { return (typeof Date !== "undefined" && Date.now) ? Date.now() : 0; }

function tick(t) {
  SESSION.lastActivity = t;
  SESSION.txCount++;
}

function checkExpiry(t) {
  if (SESSION.state === STATE.IDLE) return;
  if (t - SESSION.lastActivity > T_SESSION_IDLE) {
    resetSession(t);
    return;
  }
  if (SESSION.state === STATE.SEARCHING &&
      t - SESSION.searchStartTime > T_SEARCH_MAX) {
    if (!jordanDensityHigh()) {
      SESSION.lobbyWide = true;
    } else {
      // الكثافة الأردنية عالية → مدِّد البحث المحلي 30 ثانية إضافية
      SESSION.searchStartTime = t - (T_SEARCH_MAX - 30000);
    }
  }
}

function resetSession(t) {
  SESSION.state           = STATE.IDLE;
  SESSION.matchNet        = null;
  SESSION.matchHost       = null;
  SESSION.matchIP         = null;
  SESSION.isV6            = false;
  SESSION.failCount       = 0;
  SESSION.backoffUntil    = 0;
  SESSION.lobbyWide       = false;
  SESSION.jordanIPSeen    = 0;
  SESSION.totalIPSeen     = 0;
  SESSION.txCount         = 0;
  SESSION.searchStartTime = 0;
  SESSION.classifyCache   = {};
  SESSION.classifyTTL     = {};
  SESSION.proxyFails      = {};
  SESSION.hashSeed        = hashStr("seed" + t);
  // proxyDeadUntil يبقى بين الجلسات لتجنب إعادة المحاولة على بروكسي فاشل
}

function transitionTo(newState, t) {
  if (newState === STATE.SEARCHING && SESSION.state === STATE.IDLE) {
    SESSION.searchStartTime = t;
  }
  SESSION.state = newState;
}

// ─────────────────────────────────────────────
//  §15  PROXY SELECTION
//
//  المنطق الجوهري لتخفيض البنق:
//
//  ┌─────────────┬────────────────────────────┐
//  │   الحالة    │       التوجيه              │
//  ├─────────────┼────────────────────────────┤
//  │ IDLE        │ T2_LOBBY (بروكسي أردني)    │
//  │ SEARCHING   │ T2_LOBBY أو T3_ARAB        │
//  │ MATCHED     │ T1_MATCH (تأكيد مؤقت)      │
//  │ IN_GAME     │ DIRECT ← أقل ping ممكن     │
//  └─────────────┴────────────────────────────┘
// ─────────────────────────────────────────────
function selectMatchProxy() {
  // ▶ داخل المباراة: اتصال مباشر بالسيرفر بدون أي وسيط
  if (SESSION.state === STATE.IN_GAME) {
    return DIRECT;
  }
  return pickAliveProxy(T1_MATCH, SESSION.matchHost || "match");
}

function selectLobbyProxy(host) {
  var pool = SESSION.lobbyWide ? T3_ARAB : T2_LOBBY;
  return pickAliveProxy(pool, host);
}

// ─────────────────────────────────────────────
//  §16  JORDAN LOBBY FORCE
// ─────────────────────────────────────────────
function jordanLobbyForce(ip, host, t) {
  if (isJordanIP(ip)) {
    trackDensity(ip);
    if (SESSION.state === STATE.IDLE) transitionTo(STATE.SEARCHING, t);
    return pickAliveProxy(T2_LOBBY, host);
  }
  trackDensity(ip);
  return null;
}

// ─────────────────────────────────────────────
//  §17  CORE ROUTING
// ─────────────────────────────────────────────
function routeMatchTraffic(host, resolvedIP, t) {
  checkExpiry(t);
  if (isInBackoff(t)) return BLOCK;

  var ip  = resolvedIP || host;
  var net = netPrefix(ip);
  trackDensity(ip);

  // أول مرة نرى هذا السيرفر → سجِّله وانتقل لـ MATCHED
  if (SESSION.state === STATE.IDLE || SESSION.state === STATE.SEARCHING) {
    SESSION.matchNet  = net;
    SESSION.matchHost = host;
    SESSION.matchIP   = ip;
    SESSION.isV6      = isIPv6(ip);
    transitionTo(STATE.MATCHED, t);
    clearFailures();
    return selectMatchProxy(); // → T1_MATCH مؤقتاً
  }

  if (SESSION.state === STATE.MATCHED || SESSION.state === STATE.IN_GAME) {
    // تطابق host مباشر → قبول فوري
    if (host === SESSION.matchHost) {
      if (SESSION.state === STATE.MATCHED) transitionTo(STATE.IN_GAME, t);
      clearFailures();
      return selectMatchProxy(); // → DIRECT بعد الانتقال لـ IN_GAME
    }
    // نفس الـ subnet → قبول
    if (net === SESSION.matchNet) {
      if (SESSION.state === STATE.MATCHED) transitionTo(STATE.IN_GAME, t);
      clearFailures();
      return selectMatchProxy(); // → DIRECT
    }
    // داخل المباراة: لا نحجب حتى لو تغيّر الـ subnet (سيرفرات موزّعة)
    if (SESSION.state === STATE.IN_GAME) {
      return DIRECT;
    }
    // MATCHED فقط: subnet مختلف → رفض
    recordFailure();
    recordProxyFailure(pickAliveProxy(T1_MATCH, host));
    return BLOCK;
  }

  return selectMatchProxy();
}

function routeLobbyTraffic(host, t) {
  checkExpiry(t);
  if (SESSION.state === STATE.IDLE) transitionTo(STATE.SEARCHING, t);
  return selectLobbyProxy(host);
}

// ─────────────────────────────────────────────
//  §18  FindProxyForURL — نقطة الدخول الرئيسية
// ─────────────────────────────────────────────
function FindProxyForURL(url, host) {
  host = norm(host.toLowerCase());
  var t = now();
  tick(t);

  var directIP = isIP(host);

  // ═══════════════════════════════════════════
  // مسار A: IP مباشر
  // ═══════════════════════════════════════════
  if (directIP) {
    if (!isRegionalIP(host)) return DIRECT;

    var ttype = classifyTraffic(url, host);

    if (ttype === "CDN") return DIRECT;

    if (ttype === "MATCH") {
      return routeMatchTraffic(host, host, t);
    }

    if (ttype === "LOBBY" || ttype === "SOCIAL") {
      var forced = jordanLobbyForce(host, host, t);
      if (forced) return forced;
    }

    return routeLobbyTraffic(host, t);
  }

  // ═══════════════════════════════════════════
  // مسار B: Domain name
  // ═══════════════════════════════════════════
  if (!isPUBG(host)) return DIRECT;

  var ttype = classifyTraffic(url, host);

  if (ttype === "CDN") return DIRECT;

  // نطاق أردني صريح → T2_LOBBY فوراً بدون DNS
  if (isJordanDomain(host) && (ttype === "LOBBY" || ttype === "SOCIAL" || ttype === "UNKNOWN")) {
    if (SESSION.state === STATE.IDLE) transitionTo(STATE.SEARCHING, t);
    SESSION.jordanIPSeen++;
    SESSION.totalIPSeen++;
    return pickAliveProxy(T2_LOBBY, host);
  }

  // Fast path: سيرفرات أردنية معروفة
  if (isKnownJoHost(host)) {
    SESSION.jordanIPSeen++;
    SESSION.totalIPSeen++;
    if (ttype === "MATCH") return routeMatchTraffic(host, null, t);
    return routeLobbyTraffic(host, t);
  }

  var ips = cachedResolve(host, t);
  if (!ips || ips.length === 0) {
    if (SESSION.state === STATE.IDLE) transitionTo(STATE.SEARCHING, t);
    return selectLobbyProxy(host);
  }

  var bestIP = bestRegionalIP(ips);

  if (ttype === "MATCH") {
    if (!bestIP) {
      recordFailure();
      return BLOCK;
    }
    return routeMatchTraffic(host, bestIP, t);
  }

  if (ttype === "LOBBY" || ttype === "SOCIAL") {
    if (bestIP) {
      var forced = jordanLobbyForce(bestIP, host, t);
      if (forced) return forced;
    }
    if (!hasRegionalIP(ips) && !SESSION.lobbyWide && !jordanDensityHigh()) {
      SESSION.lobbyWide = true;
    }
    return routeLobbyTraffic(host, t);
  }

  if (bestIP) return routeLobbyTraffic(host, t);

  return BLOCK;
}
