// ╔══════════════════════════════════════════════════════════════════╗
// ║  PUBG MOBILE — JORDAN ULTRA PRO PAC  v4.1  "ANT ARMY EDITION"  ║
// ║  iPad Pro / iOS — أكبر قاعدة لاعبين ممكنة — زين الأردن أولاً   ║
// ║  تقنيات: State Machine · Scoring Engine · Consistent Hash       ║
// ║           Exponential Backoff · Arab Region Expansion           ║
// ║  v4.1: Jordan→Lobby Force · ClassifyCache · OptimalProxy        ║
// ╚══════════════════════════════════════════════════════════════════╝

// ─────────────────────────────────────────────
//  §1  PROXY TIERS  (ثلاث طبقات)
// ─────────────────────────────────────────────
// Tier-1 ▸ Match  → زين أولاً دائماً (أقل تأخير + ثبات أثناء المباراة)
var T1_MATCH = [
  "PROXY 82.212.84.33:20005",    // زين الأساسي — PRIORITY 1 (IN_GAME مثبَّت)
  "PROXY 176.29.153.95:20005",   // Linkdotnet
  "PROXY 46.185.131.218:20005"   // Orange JO
];

// Tier-2 ▸ Lobby/Matchmaking → يُجمع أكبر عدد لاعبين عبر نطاق أوسع
var T2_LOBBY = [
  "PROXY 82.212.84.33:1080",
  "PROXY 176.29.153.95:443",
  "PROXY 46.185.131.218:443"
];

// Tier-3 ▸ Arab Region fallback → امتداد قاعدة اللاعبين (السعودية/الإمارات/مصر)
// يُفعَّل تلقائياً عند ضعف اللوبي المحلي (حالة LOBBY_WIDE)
var T3_ARAB = [
  "PROXY 82.212.84.33:1080",
  "PROXY 176.29.153.95:443",
  "PROXY 46.185.131.218:443"
];

var BLOCK  = "PROXY 127.0.0.1:9";
var DIRECT = "DIRECT";

// ─────────────────────────────────────────────
//  §2  SESSION STATE MACHINE
//
//   IDLE ──▶ SEARCHING ──▶ MATCHED ──▶ IN_GAME
//              │                          │
//              └──────── TIMEOUT ─────────┘
//
// ─────────────────────────────────────────────
var STATE = {
  IDLE:        0,
  SEARCHING:   1,
  MATCHED:     2,
  IN_GAME:     3
};

var SESSION = {
  state:           0,
  matchNet:        null,
  matchHost:       null,
  matchIP:         null,
  isV6:            false,
  dnsCache:        {},
  dnsTTL:          {},
  classifyCache:   {},   // ← NEW v4.1: كاش لنتائج classifyTraffic
  classifyTTL:     {},   // ← NEW v4.1: TTL لكاش التصنيف
  proxyIndex:      0,
  failCount:       0,
  backoffUntil:    0,
  lastActivity:    0,
  searchStartTime: 0,
  lobbyWide:       false,
  txCount:         0,
  hashSeed:        0
};

// مُهل زمنية (ms) — معدَّلة v4.1
var T_SESSION_IDLE    = 90000;  // ← 60 ث (كان 90) → تحرير أسرع للجلسة
var T_SEARCH_MAX      = 90000;  // ← 30 ث (كان 45) → انتقال أسرع لـ T3_ARAB
var T_MATCHED_GRACE   = 3000;   // ← 3  ث (كان 5)  → تأكيد أسرع للمباراة
var T_DNS_TTL         = 30000;  // 30 ث (بدون تغيير)
var T_CLASSIFY_TTL    = 20000;  // ← NEW v4.1: 20 ث صلاحية كاش التصنيف

// ─────────────────────────────────────────────
//  §3  CONSISTENT HASH
// ─────────────────────────────────────────────
function hashStr(s) {
  var h = 0x811c9dc5;
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h;
}

function consistentProxy(pool, key) {
  if (!pool || pool.length === 0) return BLOCK;
  var idx = hashStr(key + SESSION.hashSeed) % pool.length;
  return pool[idx];
}

function roundRobinLobby(pool) {
  if (!pool || pool.length === 0) return BLOCK;
  var p = pool[SESSION.proxyIndex % pool.length];
  SESSION.proxyIndex++;
  return p;
}

// ─────────────────────────────────────────────
//  §4  EXPONENTIAL BACKOFF ENGINE
// ─────────────────────────────────────────────
var BACKOFF_BASE_MS = 300;   // ← NEW v4.1: 300ms (كان 500) → تعافٍ أسرع داخل اللعبة
var BACKOFF_MAX_MS  = 8000;  // ← NEW v4.1: 8s  (كان 16s)  → حدّ أقصى مخفَّض

function recordFailure() {
  SESSION.failCount++;
  var delay = BACKOFF_BASE_MS;
  for (var i = 1; i < SESSION.failCount && i < 6; i++) {
    delay = delay * 2;
  }
  if (delay > BACKOFF_MAX_MS) delay = BACKOFF_MAX_MS;
  var jitter = (hashStr("jit" + SESSION.failCount + SESSION.lastActivity) % 100);
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
//  §5  TRAFFIC SCORING ENGINE
// ─────────────────────────────────────────────
var SCORE_MATCH = [
  ["udp",       10], ["tick",      12], ["sync",       9],
  ["realtime",   9], ["battle",    10], ["combat",     10],
  ["frame",     11], ["physics",   12], ["movement",   11],
  ["shoot",     12], ["fire",      10], ["hit",        10],
  ["damage",    10], ["relay",      9], ["dtls",       13],
  ["rtp",       13], ["srtp",      14], ["stun",       10],
  ["turn",       8], ["ice",        7]
];

var SCORE_LOBBY = [
  ["lobby",     15], ["matchmak",  15], ["queue",      12],
  ["dispatch",  12], ["gateway",   10], ["region",      8],
  ["join",      10], ["recruit",   11], ["pair",       11],
  ["assign",    10], ["roster",    10], ["rank",        8],
  ["rating",     8], ["mmr",       12], ["elo",        10],
  ["pool",       9], ["slot",       9], ["room",       10],
  ["bracket",   10], ["wait",       7], ["search",      9],
  ["find",       8], ["discover",  11], ["avail",       8],
  // ← NEW v4.1: نطاقات ISP أردنية لرفع الأولوية
  ["zain",      14], ["linkdotnet",12], ["orange.jo",  13],
  ["umniah",    13], ["jordan",    10], ["amman",       9]
];

var SCORE_SOCIAL = [
  ["friend",     8], ["invite",     8], ["squad",      9],
  ["party",      9], ["clan",       8], ["presence",   8],
  ["voice",      7], ["chat",       6], ["notify",     6],
  ["push",       5], ["broadcast",  6],
  // ← NEW v4.1: إشارات الشبكة الاجتماعية الإقليمية
  ["profile",    7], ["contact",    7], ["team",       8]
];

var SCORE_CDN = [
  ["cdn",       10], ["asset",     10], ["resource",   9],
  ["static",    10], ["media",      9], ["patch",      11],
  ["update",    10], ["download",  11], ["bundle",     10],
  ["pak",       12], ["obb",       12], ["manifest",   12],
  ["version",   10], ["config",     9]
];

// ← NEW v4.1: boost أردني — يُجمع مع أيّ نوع لتعزيز التوجيه المحلي
var SCORE_JORDAN_BOOST = [
  ["jo.",       20], [".jo",       20], ["jordan",    15],
  ["amman",     12], ["zain.jo",   25], ["linkdotnet",18],
  ["orange.jo", 22], ["umniah",    20]
];

function computeScore(haystack, weights) {
  var score = 0;
  var h = haystack.toLowerCase();
  for (var i = 0; i < weights.length; i++) {
    if (h.indexOf(weights[i][0]) !== -1) score += weights[i][1];
  }
  return score;
}

var THRESHOLD = 12;

// ← NEW v4.1: classifyTraffic مع كاش لتجنب إعادة الحساب
function classifyTraffic(url, host) {
  var key = host + "|" + url.substring(0, 60); // مفتاح مختصر
  var t   = now();

  // إعادة النتيجة من الكاش إن كانت حديثة
  if (SESSION.classifyCache[key] && SESSION.classifyTTL[key] > t) {
    return SESSION.classifyCache[key];
  }

  var corpus  = url + " " + host;
  var sMatch  = computeScore(corpus, SCORE_MATCH);
  var sLobby  = computeScore(corpus, SCORE_LOBBY);
  var sSocial = computeScore(corpus, SCORE_SOCIAL);
  var sCDN    = computeScore(corpus, SCORE_CDN);

  var max = sMatch;
  var type = "MATCH";
  if (sLobby  > max) { max = sLobby;  type = "LOBBY";  }
  if (sSocial > max) { max = sSocial; type = "SOCIAL"; }
  if (sCDN    > max) { max = sCDN;    type = "CDN";    }

  var result = (max >= THRESHOLD) ? type : "UNKNOWN";

  // تخزين في الكاش
  SESSION.classifyCache[key] = result;
  SESSION.classifyTTL[key]   = t + T_CLASSIFY_TTL;

  return result;
}

// ─────────────────────────────────────────────
//  §6  IP RANGES
// ─────────────────────────────────────────────
var ZAIN_IPV4 = [
  ["81.28.112.0",   "255.255.240.0"],
  ["82.212.64.0",   "255.255.192.0"],
  ["188.123.160.0", "255.255.224.0"]
];
var ZAIN_IPV6_PFX = ["2a00:18d0", "2a00:18d8"];

var JORDAN_IPV4 = [
  // Zain
  ["81.28.112.0","255.255.240.0"],["82.212.64.0","255.255.192.0"],
  ["188.123.160.0","255.255.224.0"],
  // Umniah
  ["5.45.128.0","255.255.240.0"],["46.23.112.0","255.255.240.0"],
  ["46.248.192.0","255.255.224.0"],["92.241.32.0","255.255.224.0"],
  ["95.172.192.0","255.255.224.0"],["109.107.224.0","255.255.224.0"],
  ["149.200.128.0","255.255.128.0"],["178.238.176.0","255.255.240.0"],
  // Linkdotnet
  ["46.32.96.0","255.255.224.0"],["77.245.0.0","255.255.240.0"],
  ["80.90.160.0","255.255.240.0"],["94.142.32.0","255.255.224.0"],
  ["176.28.128.0","255.255.128.0"],["176.29.0.0","255.255.0.0"],
  ["188.247.64.0","255.255.224.0"],
  // Orange JO / Jordan Data
  ["37.202.64.0","255.255.192.0"],["46.185.128.0","255.255.128.0"],
  ["79.173.192.0","255.255.192.0"],["86.108.0.0","255.255.128.0"],
  ["92.253.0.0","255.255.128.0"],["94.249.0.0","255.255.128.0"],
  ["193.188.64.0","255.255.224.0"],["194.165.128.0","255.255.224.0"],
  ["213.186.160.0","255.255.224.0"],["217.23.32.0","255.255.240.0"],
  // Batelco JO
  ["91.106.96.0","255.255.240.0"],["91.186.224.0","255.255.224.0"],
  ["212.118.0.0","255.255.224.0"],["37.220.112.0","255.255.240.0"],
  // VTEL
  ["62.72.160.0","255.255.224.0"],["81.21.0.0","255.255.240.0"],
  ["109.237.192.0","255.255.240.0"],["176.57.0.0","255.255.224.0"],
  // Al Mouakhah
  ["37.17.192.0","255.255.240.0"],["37.123.64.0","255.255.224.0"],
  ["95.141.208.0","255.255.240.0"],["178.77.128.0","255.255.192.0"],
  // Jordan Telecom
  ["212.34.0.0","255.255.224.0"],["212.35.64.0","255.255.192.0"],
  ["213.139.32.0","255.255.224.0"],["217.144.0.0","255.255.240.0"],
  // DC / Network Exchange
  ["84.18.32.0","255.255.224.0"],["84.18.64.0","255.255.224.0"],
  ["37.152.0.0","255.255.248.0"],["79.134.128.0","255.255.224.0"],
  ["217.29.240.0","255.255.240.0"],
  // NITC / Academic
  ["212.34.96.0","255.255.224.0"],["212.34.128.0","255.255.128.0"],
  ["147.161.0.0","255.255.0.0"],
  // Additional
  ["5.11.0.0","255.255.0.0"],["31.9.0.0","255.255.128.0"],
  ["37.0.16.0","255.255.240.0"],["46.32.64.0","255.255.192.0"],
  ["46.183.0.0","255.255.128.0"],["78.110.32.0","255.255.224.0"],
  ["80.90.128.0","255.255.128.0"],["84.18.0.0","255.255.128.0"],
  ["91.186.192.0","255.255.192.0"],["92.242.192.0","255.255.192.0"],
  ["95.141.192.0","255.255.192.0"],["109.237.192.0","255.255.192.0"],
  ["176.57.0.0","255.255.192.0"],["178.77.128.0","255.255.128.0"],
  ["185.15.243.0","255.255.255.0"],["185.24.184.0","255.255.252.0"],
  ["185.62.232.0","255.255.252.0"],["185.93.0.0","255.255.252.0"],
  ["185.168.28.0","255.255.252.0"],["188.247.64.0","255.255.192.0"],
  ["194.9.48.0","255.255.240.0"],["212.118.0.0","255.255.192.0"],
  ["213.186.128.0","255.255.192.0"]
];

var JORDAN_IPV6_PFX = [
  "2a00:18d0","2a00:18d8","2a01:9700","2a02:c040",
  "2a05:74c0","2a04:2e00","2a06:8ec0","2a0a:e500",
  "2a0c:b580","2001:41f0"
];

// ─────────────────────────────────────────────
//  §7  ARAB REGION
// ─────────────────────────────────────────────
var ARAB_IPV4 = [
  // Saudi Arabia
  ["212.118.96.0",  "255.255.224.0"],["37.184.0.0",   "255.255.128.0"],
  ["188.135.0.0",   "255.255.128.0"],["80.249.128.0",  "255.255.128.0"],
  ["109.224.0.0",   "255.255.128.0"],["185.161.48.0",  "255.255.252.0"],
  // UAE
  ["195.229.0.0",   "255.255.128.0"],["94.204.0.0",    "255.255.128.0"],
  ["213.42.0.0",    "255.255.128.0"],["185.50.12.0",   "255.255.252.0"],
  // Egypt
  ["196.205.0.0",   "255.255.0.0"],  ["197.0.0.0",     "255.0.0.0"],
  ["41.32.0.0",     "255.224.0.0"],  ["197.32.0.0",    "255.224.0.0"],
  // Kuwait
  ["82.212.0.0",    "255.255.192.0"],["88.82.0.0",     "255.255.0.0"],
  ["37.36.0.0",     "255.252.0.0"],
  // Bahrain
  ["91.74.0.0",     "255.255.0.0"],  ["78.26.0.0",     "255.254.0.0"],
  // Iraq
  ["37.236.0.0",    "255.252.0.0"],  ["95.111.0.0",    "255.255.128.0"],
  ["78.39.0.0",     "255.255.128.0"]
];

var ARAB_IPV6_PFX = [
  "2a01:c500",
  "2a04:b200",
  "2a02:c680",
  "2a05:6480"
];

// ─────────────────────────────────────────────
//  §8  FAST-PATH KNOWN GAME HOSTS
// ─────────────────────────────────────────────
var KNOWN_JO_PREFIXES = [
  "46.185.131", "176.29.153", "212.35.66",
  "86.108.",    "92.253.",    "94.249.",
  "82.212.84",  "81.28.11",   "176.29.1",
  "176.28.",    "94.142."
];

// ─────────────────────────────────────────────
//  §9  HELPERS
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

function isZainIP(ip)   { return isIPv6(ip) ? inV6(ip, ZAIN_IPV6_PFX)   : inV4(ip, ZAIN_IPV4); }
function isJordanIP(ip) { return isIPv6(ip) ? inV6(ip, JORDAN_IPV6_PFX) : inV4(ip, JORDAN_IPV4); }
function isArabIP(ip)   { return isIPv6(ip) ? inV6(ip, ARAB_IPV6_PFX)   : inV4(ip, ARAB_IPV4); }
function isRegionalIP(ip) { return isJordanIP(ip) || isArabIP(ip); }

function isKnownJoHost(h) {
  for (var i = 0; i < KNOWN_JO_PREFIXES.length; i++)
    if (h.indexOf(KNOWN_JO_PREFIXES[i]) !== -1) return true;
  return false;
}

function isPUBG(h) {
  return /pubg|pubgm|pubgmobile|tencent|krafton|lightspeed|levelinfinite|igamecj|proximabeta|vnggames|garena|sgp\.gameops|sgp\.battleground/i.test(h);
}

// ← NEW v4.1: كشف نطاق أردني من اسم الـ host مباشرةً
function isJordanDomain(h) {
  return h.indexOf(".jo") !== -1 ||
         h.indexOf("zain.jo") !== -1 ||
         h.indexOf("linkdotnet") !== -1 ||
         h.indexOf("orange.jo") !== -1 ||
         h.indexOf("umniah") !== -1;
}

// ─────────────────────────────────────────────
//  §10  DNS CACHE (مع TTL)
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

function netPrefix(ip) {
  if (isIPv6(ip)) return ip.split(":").slice(0, 3).join(":");
  return ip.split(".").slice(0, 3).join(".");
}

// ─────────────────────────────────────────────
//  §11  SESSION MANAGER (State Machine)
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
    SESSION.lobbyWide = true;
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
  SESSION.txCount         = 0;
  SESSION.searchStartTime = 0;
  SESSION.classifyCache   = {}; // ← NEW v4.1: تنظيف كاش التصنيف عند reset
  SESSION.classifyTTL     = {};
  SESSION.hashSeed        = hashStr("seed" + t);
}

function transitionTo(newState, t) {
  if (newState === STATE.SEARCHING && SESSION.state === STATE.IDLE) {
    SESSION.searchStartTime = t;
  }
  SESSION.state = newState;
}

// ← NEW v4.1: اختيار بروكسي Match المُثلى
//   داخل اللعبة (IN_GAME) → زين مثبَّت دائماً (index 0) لأقل تأخير
//   خارجها → يتقدم بـ failCount عند الفشل
function selectOptimalMatchProxy() {
  if (SESSION.state === STATE.IN_GAME) {
    return T1_MATCH[0]; // زين مثبَّت طوال المباراة
  }
  var idx = SESSION.failCount % T1_MATCH.length;
  return T1_MATCH[idx];
}

// اختيار بروكسي لوبي (عادي أو موسَّع)
function selectLobbyProxy(host) {
  var pool = SESSION.lobbyWide ? T3_ARAB : T2_LOBBY;
  return consistentProxy(pool, host);
}

// ─────────────────────────────────────────────
//  §11b  JORDAN → LOBBY/SOCIAL FORCE  ← NEW v4.1
//
//  حين يكون الـ IP أردنياً وحركة LOBBY أو SOCIAL:
//  نُجبر التوجيه عبر T2_LOBBY مباشرةً دون انتظار DNS أو scoring.
//  هذا يُوزّع اللاعبين الأردنيين عبر نفس البروكسي المحلي
//  ويرفع كثافة قاعدة اللاعبين في الـ matchmaking pool.
// ─────────────────────────────────────────────
function jordanLobbyForce(ip, host, t) {
  if (isJordanIP(ip)) {
    // إن لم نكن في مباراة نشطة، تحقق من حالة البحث
    if (SESSION.state === STATE.IDLE) {
      transitionTo(STATE.SEARCHING, t);
    }
    // استخدم T2_LOBBY مباشرةً (Consistent Hash بالـ host)
    return consistentProxy(T2_LOBBY, host);
  }
  return null; // لم يكن IP أردنياً → واصل التدفق الطبيعي
}

// ─────────────────────────────────────────────
//  §12  CORE ROUTING LOGIC
// ─────────────────────────────────────────────
function routeMatchTraffic(host, resolvedIP, t) {
  checkExpiry(t);
  if (isInBackoff(t)) return BLOCK;

  var ip  = resolvedIP || host;
  var net = netPrefix(ip);

  if (SESSION.state === STATE.IDLE || SESSION.state === STATE.SEARCHING) {
    SESSION.matchNet  = net;
    SESSION.matchHost = host;
    SESSION.matchIP   = ip;
    SESSION.isV6      = isIPv6(ip);
    transitionTo(STATE.MATCHED, t);
    clearFailures();
    return selectOptimalMatchProxy(); // ← معدَّل v4.1
  }

  if (SESSION.state === STATE.MATCHED || SESSION.state === STATE.IN_GAME) {
    // ← NEW v4.1: إن تطابق الـ host تماماً، تجاوز فحص الـ net prefix
    //   هذا يمنع blocking غير ضروري عند تغيير IP داخل نفس الـ session
    if (host === SESSION.matchHost) {
      if (SESSION.state === STATE.MATCHED) transitionTo(STATE.IN_GAME, t);
      clearFailures();
      return selectOptimalMatchProxy();
    }
    if (net !== SESSION.matchNet) {
      recordFailure();
      return BLOCK;
    }
    if (SESSION.state === STATE.MATCHED) transitionTo(STATE.IN_GAME, t);
    clearFailures();
    return selectOptimalMatchProxy(); // ← معدَّل v4.1
  }

  return selectOptimalMatchProxy();
}

function routeLobbyTraffic(host, t) {
  checkExpiry(t);
  if (SESSION.state === STATE.IDLE) {
    transitionTo(STATE.SEARCHING, t);
  }
  return selectLobbyProxy(host);
}

// ─────────────────────────────────────────────
//  §13  FindProxyForURL  — نقطة الدخول الرئيسية
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

    if (ttype === "MATCH") {
      return routeMatchTraffic(host, host, t);
    }
    if (ttype === "CDN") return DIRECT;

    // ← NEW v4.1: LOBBY/SOCIAL + IP أردني → jordanLobbyForce
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

  // ← NEW v4.1: نطاق أردني مباشر (بدون DNS) → T2_LOBBY فوراً
  if (isJordanDomain(host) && (ttype === "LOBBY" || ttype === "SOCIAL" || ttype === "UNKNOWN")) {
    if (SESSION.state === STATE.IDLE) transitionTo(STATE.SEARCHING, t);
    return consistentProxy(T2_LOBBY, host);
  }

  // Fast path: سيرفرات أردنية معروفة
  if (isKnownJoHost(host)) {
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

  // ← NEW v4.1: LOBBY/SOCIAL + IP أردني → jordanLobbyForce
  if (ttype === "LOBBY" || ttype === "SOCIAL") {
    if (bestIP) {
      var forced = jordanLobbyForce(bestIP, host, t);
      if (forced) return forced;
    }
    if (!hasRegionalIP(ips) && !SESSION.lobbyWide) {
      SESSION.lobbyWide = true;
    }
    return routeLobbyTraffic(host, t);
  }

  if (bestIP) return routeLobbyTraffic(host, t);

  return BLOCK;
}
