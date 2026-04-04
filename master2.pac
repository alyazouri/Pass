// ╔══════════════════════════════════════════════════════════════════╗
// ║  PUBG MOBILE — JORDAN ULTRA PRO PAC  v4.0  "ANT ARMY EDITION"  ║
// ║  iPad Pro / iOS — أكبر قاعدة لاعبين ممكنة — زين الأردن أولاً   ║
// ║  تقنيات: State Machine · Scoring Engine · Consistent Hash       ║
// ║           Exponential Backoff · Arab Region Expansion           ║
// ╚══════════════════════════════════════════════════════════════════╝

// ─────────────────────────────────────────────
//  §1  PROXY TIERS  (ثلاث طبقات)
// ─────────────────────────────────────────────
// Tier-1 ▸ Match  → أقل تأخير + ثبات أثناء المباراة
var T1_MATCH = [
  "PROXY 82.212.84.33:20005",    // زين الأساسي
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
  "PROXY 82.212.84.33:1080",    // يبقى زين مرجعاً
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
//  الفائدة: لا نقفل البروكسي إلا بعد تأكيد المباراة
//           → أثناء SEARCHING نسمح بنطاق أوسع = المزيد من اللاعبين
// ─────────────────────────────────────────────
var STATE = {
  IDLE:        0,
  SEARCHING:   1,   // matchmaking / lobby جارٍ
  MATCHED:     2,   // وُجدت مجموعة — ننتظر تأكيد الخادم
  IN_GAME:     3    // مباراة نشطة — نقفل IP/Network
};

var SESSION = {
  state:           0,   // STATE.IDLE
  matchNet:        null,
  matchHost:       null,
  matchIP:         null,
  isV6:            false,
  dnsCache:        {},
  dnsTTL:          {},
  proxyIndex:      0,   // مؤشر Tier-1 الحالي (Consistent Hash)
  failCount:       0,   // عدد الفشل المتراكم
  backoffUntil:    0,   // لا نُحاول قبل هذا الوقت (Exponential Backoff)
  lastActivity:    0,
  searchStartTime: 0,
  lobbyWide:       false, // وضع التوسع العربي مُفعَّل؟
  txCount:         0,     // عداد الحزم (لإحصاء نشاط الجلسة)
  hashSeed:        0      // بذرة Consistent Hash لهذه الجلسة
};

// مُهل زمنية (ms)
var T_SESSION_IDLE    = 90000;  // 90 ث → نُعيد الجلسة إن لم يحدث نشاط
var T_SEARCH_MAX      = 45000;  // 45 ث → إن لم نجد مباراة نُوسّع للعرب
var T_MATCHED_GRACE   = 5000;   // 5 ث  → نافذة التأكيد
var T_DNS_TTL         = 30000;  // 30 ث → صلاحية كاش DNS

// ─────────────────────────────────────────────
//  §3  CONSISTENT HASH  (توزيع البروكسي بثبات)
//      نفس الـ host يُوجَّه دائماً لنفس البروكسي
//      طالما الجلسة حية — يمنع تشتت الـ state
// ─────────────────────────────────────────────
function hashStr(s) {
  var h = 0x811c9dc5; // FNV-1a offset basis
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0; // FNV prime, force uint32
  }
  return h;
}

function consistentProxy(pool, key) {
  if (!pool || pool.length === 0) return BLOCK;
  var idx = hashStr(key + SESSION.hashSeed) % pool.length;
  return pool[idx];
}

// دوري (Round-Robin) للـ Lobby — لتوزيع الحمل وتوسيع قاعدة اللاعبين
function roundRobinLobby(pool) {
  if (!pool || pool.length === 0) return BLOCK;
  var p = pool[SESSION.proxyIndex % pool.length];
  SESSION.proxyIndex++;
  return p;
}

// ─────────────────────────────────────────────
//  §4  EXPONENTIAL BACKOFF ENGINE
//      عند الفشل المتكرر: نُضاعف فترة الانتظار
//      حتى الحد الأقصى 16 ث، ثم نُعيد المحاولة
// ─────────────────────────────────────────────
var BACKOFF_BASE_MS = 500;
var BACKOFF_MAX_MS  = 16000;

function recordFailure() {
  SESSION.failCount++;
  var delay = BACKOFF_BASE_MS;
  // 2^n backoff مع jitter بسيط
  for (var i = 1; i < SESSION.failCount && i < 6; i++) {
    delay = delay * 2;
  }
  if (delay > BACKOFF_MAX_MS) delay = BACKOFF_MAX_MS;
  // jitter: ±10% عشوائي باستخدام hashStr كمولّد شبه عشوائي
  var jitter = (hashStr("jit" + SESSION.failCount + SESSION.lastActivity) % 100);
  delay = delay + Math.floor(delay * (jitter - 50) / 500);
  SESSION.backoffUntil = SESSION.lastActivity + delay;
}

function clearFailures() {
  SESSION.failCount   = 0;
  SESSION.backoffUntil = 0;
}

function isInBackoff(now) {
  return SESSION.backoffUntil > 0 && now < SESSION.backoffUntil;
}

// ─────────────────────────────────────────────
//  §5  TRAFFIC SCORING ENGINE
//      بدلاً من regex واحد: نُعطي نقاطاً لكل كلمة
//      مجموع النقاط يُحدد نوع الحركة
// ─────────────────────────────────────────────

// أوزان الكلمات (كلما زاد الوزن كلما تأكدنا أكثر)
var SCORE_MATCH = [
  // حركة مباراة حيّة — وزن عالٍ
  ["udp",       10], ["tick",      12], ["sync",       9],
  ["realtime",   9], ["battle",    10], ["combat",     10],
  ["frame",     11], ["physics",   12], ["movement",   11],
  ["shoot",     12], ["fire",      10], ["hit",        10],
  ["damage",    10], ["relay",      9], ["dtls",       13],
  ["rtp",       13], ["srtp",      14], ["stun",       10],
  ["turn",       8], ["ice",        7]
];

var SCORE_LOBBY = [
  // matchmaking وإيجاد اللاعبين — نريد هذا يمر عبر T2/T3
  ["lobby",     15], ["matchmak",  15], ["queue",      12],
  ["dispatch",  12], ["gateway",   10], ["region",      8],
  ["join",      10], ["recruit",   11], ["pair",       11],
  ["assign",    10], ["roster",    10], ["rank",        8],
  ["rating",     8], ["mmr",       12], ["elo",        10],
  ["pool",       9], ["slot",       9], ["room",       10],
  ["bracket",   10], ["wait",       7], ["search",      9],
  ["find",       8], ["discover",  11], ["avail",       8]
];

var SCORE_SOCIAL = [
  ["friend",     8], ["invite",     8], ["squad",      9],
  ["party",      9], ["clan",       8], ["presence",   8],
  ["voice",      7], ["chat",       6], ["notify",     6],
  ["push",       5], ["broadcast",  6]
];

var SCORE_CDN = [
  ["cdn",       10], ["asset",     10], ["resource",   9],
  ["static",    10], ["media",      9], ["patch",      11],
  ["update",    10], ["download",  11], ["bundle",     10],
  ["pak",       12], ["obb",       12], ["manifest",   12],
  ["version",   10], ["config",     9]
];

function computeScore(haystack, weights) {
  var score = 0;
  var h = haystack.toLowerCase();
  for (var i = 0; i < weights.length; i++) {
    if (h.indexOf(weights[i][0]) !== -1) score += weights[i][1];
  }
  return score;
}

var THRESHOLD = 9; // الحد الأدنى للاعتبار "إيجابي"

function classifyTraffic(url, host) {
  var corpus = url + " " + host;
  var sMatch  = computeScore(corpus, SCORE_MATCH);
  var sLobby  = computeScore(corpus, SCORE_LOBBY);
  var sSocial = computeScore(corpus, SCORE_SOCIAL);
  var sCDN    = computeScore(corpus, SCORE_CDN);

  // إعادة نوع مع الثقة (confidence)
  var max = sMatch;
  var type = "MATCH";
  if (sLobby  > max) { max = sLobby;  type = "LOBBY";  }
  if (sSocial > max) { max = sSocial; type = "SOCIAL"; }
  if (sCDN    > max) { max = sCDN;    type = "CDN";    }

  return (max >= THRESHOLD) ? type : "UNKNOWN";
}

// ─────────────────────────────────────────────
//  §6  IP RANGES  (زين → أردن → عرب)
// ─────────────────────────────────────────────

// --- زين الأردن (فحص سريع أولاً) ---
var ZAIN_IPV4 = [
  ["81.28.112.0",   "255.255.240.0"],
  ["82.212.64.0",   "255.255.192.0"],
  ["188.123.160.0", "255.255.224.0"]
];
var ZAIN_IPV6_PFX = ["2a00:18d0", "2a00:18d8"];

// --- الأردن الكاملة ---
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
//  §7  ARAB REGION — قاعدة لاعبين موسّعة 🐜
//      PUBG ME server يجمع: الأردن + السعودية + الإمارات
//      + مصر + الكويت + البحرين → ملايين لاعبين
// ─────────────────────────────────────────────
var ARAB_IPV4 = [
  // Saudi Arabia — STC, Mobily, Zain SA
  ["212.118.96.0",  "255.255.224.0"],
  ["37.184.0.0",    "255.255.128.0"],
  ["188.135.0.0",   "255.255.128.0"],
  ["80.249.128.0",  "255.255.128.0"],
  ["109.224.0.0",   "255.255.128.0"],
  ["185.161.48.0",  "255.255.252.0"],

  // UAE — Etisalat, Du
  ["195.229.0.0",   "255.255.128.0"],
  ["94.204.0.0",    "255.255.128.0"],
  ["213.42.0.0",    "255.255.128.0"],
  ["185.50.12.0",   "255.255.252.0"],

  // Egypt — TE Data, Nile Online, Vodafone EG
  ["196.205.0.0",   "255.255.0.0"],
  ["197.0.0.0",     "255.0.0.0"],
  ["41.32.0.0",     "255.224.0.0"],
  ["197.32.0.0",    "255.224.0.0"],

  // Kuwait — MOC, Zain KW
  ["82.212.0.0",    "255.255.192.0"], // مشترك مع زين الأردن
  ["88.82.0.0",     "255.255.0.0"],
  ["37.36.0.0",     "255.252.0.0"],

  // Bahrain — Batelco
  ["91.74.0.0",     "255.255.0.0"],
  ["78.26.0.0",     "255.254.0.0"],

  // Iraq — اللاعبون العراقيون على نفس السيرفر ME
  ["37.236.0.0",    "255.252.0.0"],
  ["95.111.0.0",    "255.255.128.0"],
  ["78.39.0.0",     "255.255.128.0"]
];

var ARAB_IPV6_PFX = [
  "2a01:c500",  // STC SA
  "2a04:b200",  // UAE
  "2a02:c680",  // Egypt
  "2a05:6480"   // Kuwait
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

function isIPv6(ip)     { return ip.indexOf(":") > -1; }
function isIP(h)        { return /^(\d{1,3}\.){3}\d{1,3}$/.test(h) || h.indexOf(":") > -1; }

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

function isZainIP(ip)   { return isIPv6(ip) ? inV6(ip, ZAIN_IPV6_PFX) : inV4(ip, ZAIN_IPV4); }
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

// ─────────────────────────────────────────────
//  §10  DNS CACHE (مع TTL)
// ─────────────────────────────────────────────
function cachedResolve(host, now) {
  if (SESSION.dnsCache[host] && SESSION.dnsTTL[host] > now)
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
    SESSION.dnsTTL[host]   = now + T_DNS_TTL;
  }
  return ips;
}

// يُفضّل: زين > أردن > عرب > أول IP
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

// انتهت الجلسة؟ → IDLE
function checkExpiry(t) {
  if (SESSION.state === STATE.IDLE) return;
  if (t - SESSION.lastActivity > T_SESSION_IDLE) {
    resetSession(t);
    return;
  }
  // SEARCHING طال أكثر من اللازم؟ → وسّع إلى العرب
  if (SESSION.state === STATE.SEARCHING &&
      t - SESSION.searchStartTime > T_SEARCH_MAX) {
    SESSION.lobbyWide = true; // تفعيل T3_ARAB
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
  SESSION.hashSeed        = hashStr("seed" + t);
}

// انتقال الحالة
function transitionTo(newState, t) {
  if (newState === STATE.SEARCHING && SESSION.state === STATE.IDLE) {
    SESSION.searchStartTime = t;
  }
  SESSION.state = newState;
}

// اختيار بروكسي Tier-1 بناءً على failCount (يتقدم عند الفشل)
function selectMatchProxy() {
  var idx = SESSION.failCount % T1_MATCH.length;
  return T1_MATCH[idx];
}

// اختيار بروكسي لوبي (عادي أو موسّع)
function selectLobbyProxy(host) {
  var pool = SESSION.lobbyWide ? T3_ARAB : T2_LOBBY;
  // Consistent Hash بالـ host لثبات التوجيه
  return consistentProxy(pool, host);
}

// ─────────────────────────────────────────────
//  §12  CORE ROUTING LOGIC
// ─────────────────────────────────────────────
function routeMatchTraffic(host, resolvedIP, t) {
  checkExpiry(t);
  if (isInBackoff(t)) return BLOCK; // Exponential Backoff نشط

  var ip  = resolvedIP || host;
  var net = netPrefix(ip);

  if (SESSION.state === STATE.IDLE || SESSION.state === STATE.SEARCHING) {
    // أول حزمة match → قفل الجلسة
    SESSION.matchNet  = net;
    SESSION.matchHost = host;
    SESSION.matchIP   = ip;
    SESSION.isV6      = isIPv6(ip);
    transitionTo(STATE.MATCHED, t);
    clearFailures();
    return selectMatchProxy();
  }

  if (SESSION.state === STATE.MATCHED || SESSION.state === STATE.IN_GAME) {
    // تحقق من الاتساق
    if (host !== SESSION.matchHost && net !== SESSION.matchNet) {
      // IP مختلف تماماً → فشل
      recordFailure();
      return BLOCK;
    }
    // نفس الشبكة → في المباراة
    if (SESSION.state === STATE.MATCHED) transitionTo(STATE.IN_GAME, t);
    clearFailures();
    return selectMatchProxy();
  }

  return selectMatchProxy();
}

function routeLobbyTraffic(host, t) {
  checkExpiry(t);

  if (SESSION.state === STATE.IDLE) {
    transitionTo(STATE.SEARCHING, t);
  }
  // الجلسة في IN_GAME → lobby traffic = ربما نهاية مباراة، لا نُغيّر الحالة
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
    // خارج المنطقة → تجاهل
    if (!isRegionalIP(host)) return DIRECT;

    var ttype = classifyTraffic(url, host);

    if (ttype === "MATCH") {
      return routeMatchTraffic(host, host, t);
    }
    if (ttype === "CDN") return DIRECT;
    if (ttype === "LOBBY" || ttype === "SOCIAL" || ttype === "UNKNOWN") {
      return routeLobbyTraffic(host, t);
    }
    return routeLobbyTraffic(host, t);
  }

  // ═══════════════════════════════════════════
  // مسار B: Domain name
  // ═══════════════════════════════════════════

  // غير PUBG → مرور مباشر
  if (!isPUBG(host)) return DIRECT;

  var ttype = classifyTraffic(url, host);

  // CDN → مباشر دائماً
  if (ttype === "CDN") return DIRECT;

  // Fast path: سيرفرات أردنية معروفة بدون DNS
  if (isKnownJoHost(host)) {
    if (ttype === "MATCH") return routeMatchTraffic(host, null, t);
    return routeLobbyTraffic(host, t);
  }

  // DNS resolution مع TTL cache
  var ips = cachedResolve(host, t);
  if (!ips || ips.length === 0) {
    // DNS فشل → SEARCHING → أعد المحاولة عبر lobby
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
    // حتى لو لم يكن IP أردنياً في هذه المرحلة، جرّب عبر T2
    if (!hasRegionalIP(ips) && !SESSION.lobbyWide) {
      // لا يوجد IP إقليمي → وسّع لـ T3 فوراً لإيجاد المزيد من اللاعبين
      SESSION.lobbyWide = true;
    }
    return routeLobbyTraffic(host, t);
  }

  // UNKNOWN و PUBG domain → مرور عبر lobby احتياطاً
  if (bestIP) return routeLobbyTraffic(host, t);

  return BLOCK;
}
