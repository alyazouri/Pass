// ╔══════════════════════════════════════════════════════════════════╗
// ║  PUBG MOBILE — JORDAN ULTRA PRO PAC  v4.1                       ║
// ║  "ANT ARMY EDITION — DUAL-STACK LOBBY"                          ║
// ║  iPad Pro / iOS — زين الأردن                                    ║
// ║                                                                  ║
// ║  جديد v4.1:                                                     ║
// ║  ✦ State Machine موسّعة: LOBBY_IDLE + RECRUITING                ║
// ║  ✦ IPv4 + IPv6 dual-stack كاملة لمرحلة ما قبل المباراة          ║
// ║  ✦ Recruitment Broadcast Pin — طلبك يظهر للأردنيين دائماً       ║
// ║  ✦ Presence Heartbeat Affinity — بثّ ثابت لحضورك في اللوبي      ║
// ║  ✦ محرك تصنيف موسّع لحركة التجنيد والأصدقاء                    ║
// ╚══════════════════════════════════════════════════════════════════╝

// ═══════════════════════════════════════════════════════════════════
//  §1  PROXY TIERS
// ═══════════════════════════════════════════════════════════════════

// Tier-1 ▸ Match — أقل تأخير، ثبات كامل داخل المباراة
var T1_MATCH = [
  "PROXY 82.212.84.33:20005",
  "PROXY 176.29.153.95:20005",
  "PROXY 46.185.131.218:20005"
];

// Tier-2 ▸ Lobby General — تدفق حر قبل المباراة
var T2_LOBBY = [
  "PROXY 82.212.84.33:1080",
  "PROXY 176.29.153.95:443",
  "PROXY 46.185.131.218:443"
];

// Tier-2R ▸ Recruitment PIN — ثابت لا يتغير لبثّ الحضور
// يجب أن يكون نفس البروكسي دائماً حتى يراك الأردنيون الآخرون في القائمة ذاتها
var T2_RECRUIT_PIN = "PROXY 82.212.84.33:1080";  // زين — المُجمِّع الأكبر

// Tier-3 ▸ Arab Expansion — توسيع عند شُح اللاعبين (> 45 ث بحث)
var T3_ARAB = [
  "PROXY 82.212.84.33:1080",
  "PROXY 176.29.153.95:443",
  "PROXY 46.185.131.218:443"
];

var BLOCK  = "PROXY 127.0.0.1:9";
var DIRECT = "DIRECT";

// ═══════════════════════════════════════════════════════════════════
//  §2  STATE MACHINE  (موسّعة — 6 حالات)
//
//   IDLE
//     │  (أي حركة PUBG)
//     ▼
//   LOBBY_IDLE  ◀──────────────────────────────┐
//     │  (إرسال/استقبال طلب فريق أو صديق)       │
//     ▼                                         │
//   RECRUITING  ──── (انتهاء تجنيد / timeout) ──┘
//     │  (ضغط "ابحث عن مباراة")
//     ▼
//   SEARCHING
//     │  (وُجد سيرفر مباراة)
//     ▼
//   MATCHED
//     │  (حزم لعب فعلية واردة)
//     ▼
//   IN_GAME  ──── (timeout / انتهاء مباراة) ──▶ IDLE
//
//  لماذا LOBBY_IDLE و RECRUITING منفصلتان؟
//  → في LOBBY_IDLE: نستخدم Round-Robin بين T2_LOBBY لتوسيع الرؤية
//  → في RECRUITING: نقفل على T2_RECRUIT_PIN (زين أساسي) لثبات الحضور
//    بحيث يرى نفس مجموعة الأردنيين طلبك في كل مرة
// ═══════════════════════════════════════════════════════════════════
var STATE = {
  IDLE:        0,
  LOBBY_IDLE:  1,  // جديد — في القوائم، تصفح، لا يوجد تجنيد نشط
  RECRUITING:  2,  // جديد — إرسال/استقبال طلبات فريق أو أصدقاء
  SEARCHING:   3,  // بحث عن مباراة
  MATCHED:     4,  // وُجد سيرفر، ننتظر تأكيد
  IN_GAME:     5   // مباراة نشطة
};

var SESSION = {
  state:            0,    // STATE.IDLE
  matchNet:         null,
  matchHost:        null,
  matchIP:          null,
  isV6:             false,

  // dual-stack presence
  v4LobbyPin:       null, // IPv4 الأردني المُختار للـ lobby
  v6LobbyPin:       null, // IPv6 الأردني المُختار للـ lobby (جديد)
  preferV6Lobby:    false, // هل نُفضّل IPv6 للـ lobby؟

  // recruit broadcast
  recruitProxy:     null, // البروكسي المثبّت لجلسة التجنيد
  recruitHost:      null, // أول host تجنيد رأيناه
  recruitStartTime: 0,

  // dns cache
  dnsCache:         {},
  dnsTTL:           {},

  // session control
  proxyIndex:       0,
  failCount:        0,
  backoffUntil:     0,
  lastActivity:     0,
  searchStartTime:  0,
  lobbyWide:        false,
  txCount:          0,
  hashSeed:         0
};

// مُهل زمنية (ms)
var T_SESSION_IDLE    = 120000;  // 120 ث — أطول لاستيعاب فترات اللوبي
var T_SEARCH_MAX      =  45000;  //  45 ث — توسيع عربي بعدها
var T_RECRUIT_PERSIST =  60000;  //  60 ث — نُبقي RECRUIT_PIN نشطاً
var T_DNS_TTL         =  30000;  //  30 ث — صلاحية DNS Cache
var T_LOBBY_HEARTBEAT =   8000;  //   8 ث — نافذة الـ presence heartbeat

// ═══════════════════════════════════════════════════════════════════
//  §3  CONSISTENT HASH  (FNV-1a 32-bit)
// ═══════════════════════════════════════════════════════════════════
function hashStr(s) {
  var h = 0x811c9dc5;
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h  = (h * 0x01000193) >>> 0;
  }
  return h;
}

function consistentProxy(pool, key) {
  if (!pool || pool.length === 0) return BLOCK;
  return pool[hashStr(key + SESSION.hashSeed) % pool.length];
}

function roundRobin(pool) {
  if (!pool || pool.length === 0) return BLOCK;
  var p = pool[SESSION.proxyIndex % pool.length];
  SESSION.proxyIndex++;
  return p;
}

// ═══════════════════════════════════════════════════════════════════
//  §4  EXPONENTIAL BACKOFF  (بـ jitter)
// ═══════════════════════════════════════════════════════════════════
var BACKOFF_BASE = 500;
var BACKOFF_MAX  = 16000;

function recordFailure(t) {
  SESSION.failCount++;
  var d = BACKOFF_BASE;
  for (var i = 1; i < SESSION.failCount && i < 6; i++) d *= 2;
  if (d > BACKOFF_MAX) d = BACKOFF_MAX;
  var j = hashStr("j" + SESSION.failCount + t) % 100;
  d += Math.floor(d * (j - 50) / 500);
  SESSION.backoffUntil = t + d;
}

function clearFailures() {
  SESSION.failCount    = 0;
  SESSION.backoffUntil = 0;
}

function inBackoff(t) {
  return SESSION.backoffUntil > 0 && t < SESSION.backoffUntil;
}

// ═══════════════════════════════════════════════════════════════════
//  §5  TRAFFIC SCORING ENGINE  (موسّع — نوع جديد: RECRUIT)
//
//  الأنواع الآن: MATCH · LOBBY · RECRUIT · SOCIAL · PRESENCE · CDN
//  RECRUIT مُعطى أعلى الأولويات لأنه جوهر الطلب الجديد
// ═══════════════════════════════════════════════════════════════════

var SCORE_MATCH = [
  ["udp",8],["tick",12],["sync",9],["realtime",9],
  ["battle",10],["combat",10],["frame",11],["physics",12],
  ["movement",11],["shoot",12],["fire",10],["hit",10],
  ["damage",10],["relay",9],["dtls",13],["rtp",13],
  ["srtp",14],["stun",10],["turn",8],["ice",7],
  ["gamestate",12],["snapshot",11],["input",9]
];

// التجنيد وطلبات الفريق — أعلى أولوية (جديد)
var SCORE_RECRUIT = [
  ["recruit",    18], ["recruitment", 18], ["squad",      15],
  ["teammate",   15], ["teamma",      15], ["lookingfor",  16],
  ["lft",        16], ["lfg",         16], ["lfm",        16],
  ["findteam",   16], ["jointeam",    15], ["teamup",     15],
  ["openslot",   15], ["vacancy",     14], ["openroom",   14],
  ["invite",     13], ["sendinvite",  15], ["invitereq",  15],
  ["reqteam",    16], ["reqsquad",    16], ["reqparty",   15],
  ["broadcast",  12], ["announce",   12], ["advertise",  13],
  ["roster",     11], ["apply",       11], ["applicant",  12],
  ["group",      10], ["formation",  11], ["enlist",     13]
];

// حضور / Presence Heartbeat (نبضات دورية تُعلم اللاعبين بوجودك)
var SCORE_PRESENCE = [
  ["presence",   16], ["heartbeat",  16], ["ping",       10],
  ["alive",      12], ["online",     11], ["status",     10],
  ["beacon",     14], ["signal",     13], ["keepalive",  14],
  ["pong",       10], ["activity",   10], ["seen",       10],
  ["lastseen",   12], ["active",     10], ["available",  11]
];

var SCORE_LOBBY = [
  ["lobby",15],["matchmak",15],["queue",12],["dispatch",12],
  ["gateway",10],["region",8],["join",10],["pair",11],
  ["assign",10],["rank",8],["rating",8],["mmr",12],
  ["elo",10],["pool",9],["slot",9],["room",10],
  ["bracket",10],["wait",7],["search",9],["find",8],
  ["discover",11],["avail",8],["session",8],["entry",9],
  ["zone",8],["server",7],["host",7]
];

var SCORE_SOCIAL = [
  ["friend",10],["friendreq",15],["friendlist",14],["addfriend",15],
  ["party",9],["clan",8],["guild",9],["presence",8],
  ["voice",7],["chat",6],["notify",7],["push",5],
  ["message",8],["dm",9],["whisper",9],["contact",9],
  ["follow",9],["follower",10],["block",7],["unblock",7],
  ["profile",8],["avatar",7]
];

var SCORE_CDN = [
  ["cdn",10],["asset",10],["resource",9],["static",10],
  ["media",9],["patch",11],["update",10],["download",11],
  ["bundle",10],["pak",12],["obb",12],["manifest",12],
  ["version",10],["config",9],["cache",9],["img",8],
  ["texture",10],["model",9],["sound",8],["music",7]
];

function computeScore(corpus, weights) {
  var score = 0;
  var h = corpus.toLowerCase();
  for (var i = 0; i < weights.length; i++) {
    if (h.indexOf(weights[i][0]) !== -1) score += weights[i][1];
  }
  return score;
}

// عتبات: RECRUIT و PRESENCE لهما عتبة أدنى لضمان الالتقاط
var THR_DEFAULT  = 9;
var THR_RECRUIT  = 7;  // حساسية أعلى للتجنيد
var THR_PRESENCE = 7;  // حساسية أعلى للـ heartbeat

function classifyTraffic(url, host) {
  var c       = url + " " + host;
  var sMatch   = computeScore(c, SCORE_MATCH);
  var sRecruit = computeScore(c, SCORE_RECRUIT);
  var sPres    = computeScore(c, SCORE_PRESENCE);
  var sLobby   = computeScore(c, SCORE_LOBBY);
  var sSocial  = computeScore(c, SCORE_SOCIAL);
  var sCDN     = computeScore(c, SCORE_CDN);

  // RECRUIT و PRESENCE يُتحققان أولاً بعتبتهما الخاصة
  if (sRecruit >= THR_RECRUIT && sRecruit >= sMatch)   return "RECRUIT";
  if (sPres    >= THR_PRESENCE && sPres >= sMatch && sPres >= sLobby) return "PRESENCE";

  // بقية الأنواع
  var max = sMatch; var type = "MATCH";
  if (sLobby  > max) { max = sLobby;  type = "LOBBY";  }
  if (sSocial > max) { max = sSocial; type = "SOCIAL"; }
  if (sCDN    > max) { max = sCDN;    type = "CDN";    }

  return (max >= THR_DEFAULT) ? type : "UNKNOWN";
}

// ═══════════════════════════════════════════════════════════════════
//  §6  IP RANGES — DUAL-STACK  (IPv4 + IPv6)
// ═══════════════════════════════════════════════════════════════════

//  ── زين الأردن ──────────────────────────────────────────────────
var ZAIN_IPV4 = [
  ["81.28.112.0",   "255.255.240.0"],
  ["82.212.64.0",   "255.255.192.0"],
  ["188.123.160.0", "255.255.224.0"]
];
// IPv6 زين — تشمل النطاق الموسّع لـ 5G Zain JO
var ZAIN_IPV6 = [
  "2a00:18d0",   // Zain JO block 1
  "2a00:18d8",   // Zain JO block 2
  "2a00:18e0",   // Zain JO block 3 (موسّع)
  "2a00:18c8"    // Zain JO block 4 (موسّع)
];

//  ── الأردن الكاملة — IPv4 ───────────────────────────────────────
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

//  ── الأردن الكاملة — IPv6  (موسّعة بشكل كبير في v4.1) ─────────
var JORDAN_IPV6 = [
  // Zain JO
  "2a00:18d0", "2a00:18d8", "2a00:18e0", "2a00:18c8",
  // Orange JO / Jordan Data Communications
  "2a01:9700",
  "2a01:9710",  // Orange JO موسّع
  "2a01:9720",  // Orange JO موسّع
  // Umniah
  "2a02:c040",
  "2a02:c050",  // Umniah موسّع
  // Jordan Telecom PSC
  "2a04:2e00",
  "2a04:2e10",
  // Linkdotnet JO
  "2a0a:e500",
  "2a0a:e510",
  // Batelco JO
  "2a0c:b580",
  "2a0c:b590",
  // VTEL / misc
  "2a05:74c0",
  "2a06:8ec0",
  // Academic / Gov
  "2001:41f0",
  "2001:41f8"
];

//  ── المنطقة العربية — لتوسيع قاعدة اللاعبين عند الحاجة ──────────
var ARAB_IPV4 = [
  // Saudi Arabia
  ["212.118.96.0","255.255.224.0"],["37.184.0.0","255.255.128.0"],
  ["188.135.0.0","255.255.128.0"],["80.249.128.0","255.255.128.0"],
  ["109.224.0.0","255.255.128.0"],
  // UAE
  ["195.229.0.0","255.255.128.0"],["94.204.0.0","255.255.128.0"],
  ["213.42.0.0","255.255.128.0"],
  // Egypt
  ["196.205.0.0","255.255.0.0"],["197.0.0.0","255.0.0.0"],
  ["41.32.0.0","255.224.0.0"],
  // Kuwait
  ["88.82.0.0","255.255.0.0"],["37.36.0.0","255.252.0.0"],
  // Bahrain
  ["91.74.0.0","255.255.0.0"],["78.26.0.0","255.254.0.0"],
  // Iraq
  ["37.236.0.0","255.252.0.0"],["95.111.0.0","255.255.128.0"]
];

var ARAB_IPV6 = [
  "2a01:c500",  // STC SA
  "2a04:b200",  // UAE
  "2a02:c680",  // Egypt
  "2a05:6480"   // Kuwait
];

// ═══════════════════════════════════════════════════════════════════
//  §7  KNOWN JO GAME SERVER PREFIXES  (Fast Path — بدون DNS)
// ═══════════════════════════════════════════════════════════════════
var KNOWN_JO_PREFIXES = [
  "46.185.131", "176.29.153", "212.35.66",
  "86.108.",    "92.253.",    "94.249.",
  "82.212.84",  "81.28.11",   "176.29.1",
  "176.28.",    "94.142.",    "46.185.13",
  "37.202.",    "213.186.",   "46.32.9",
  "77.245."
];

// ═══════════════════════════════════════════════════════════════════
//  §8  HELPERS
// ═══════════════════════════════════════════════════════════════════
function norm(h) {
  var col = 0, last = -1;
  for (var i = 0; i < h.length; i++) {
    if (h[i] === ":") { col++; last = i; }
  }
  return (col === 1) ? h.substring(0, last) : h;
}

function isIPv6(ip) { return ip.indexOf(":") > -1; }
function isIP(h)    { return /^(\d{1,3}\.){3}\d{1,3}$/.test(h) || h.indexOf(":") > -1; }

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

function isZainV4(ip)    { return inV4(ip, ZAIN_IPV4); }
function isZainV6(ip)    { return inV6(ip, ZAIN_IPV6); }
function isZainIP(ip)    { return isIPv6(ip) ? isZainV6(ip) : isZainV4(ip); }
function isJordanV4(ip)  { return inV4(ip, JORDAN_IPV4); }
function isJordanV6(ip)  { return inV6(ip, JORDAN_IPV6); }
function isJordanIP(ip)  { return isIPv6(ip) ? isJordanV6(ip) : isJordanV4(ip); }
function isArabIP(ip)    { return isIPv6(ip) ? inV6(ip, ARAB_IPV6) : inV4(ip, ARAB_IPV4); }
function isRegional(ip)  { return isJordanIP(ip) || isArabIP(ip); }

function isKnownJo(h) {
  for (var i = 0; i < KNOWN_JO_PREFIXES.length; i++)
    if (h.indexOf(KNOWN_JO_PREFIXES[i]) !== -1) return true;
  return false;
}

function isPUBG(h) {
  return /pubg|pubgm|pubgmobile|tencent|krafton|lightspeed|levelinfinite|igamecj|proximabeta|vnggames|garena|sgp\.gameops|sgp\.battleground/i.test(h);
}

function netPrefix(ip) {
  return isIPv6(ip)
    ? ip.split(":").slice(0, 3).join(":")
    : ip.split(".").slice(0, 3).join(".");
}

// ═══════════════════════════════════════════════════════════════════
//  §9  DNS CACHE DUAL-STACK  (مع TTL — يُميّز IPv4 عن IPv6)
// ═══════════════════════════════════════════════════════════════════
function cachedResolve(host, t) {
  if (SESSION.dnsCache[host] && SESSION.dnsTTL[host] > t)
    return SESSION.dnsCache[host];

  var ips = [];
  try {
    if (typeof dnsResolveEx === "function") {
      var ex = dnsResolveEx(host);
      if (ex) {
        var pts = ex.split(";");
        for (var i = 0; i < pts.length; i++) {
          var p = pts[i].trim();
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

// ─── اختيار أفضل IP من القائمة ────────────────────────────────────
// ترتيب الأفضلية: Zain-v4 > Zain-v6 > Jordan-v4 > Jordan-v6 > Arab > أول IP
function bestJordanIP(ips) {
  for (var i = 0; i < ips.length; i++) if (!isIPv6(ips[i]) && isZainV4(ips[i]))   return ips[i];
  for (var i = 0; i < ips.length; i++) if (isIPv6(ips[i])  && isZainV6(ips[i]))   return ips[i];
  for (var i = 0; i < ips.length; i++) if (!isIPv6(ips[i]) && isJordanV4(ips[i])) return ips[i];
  for (var i = 0; i < ips.length; i++) if (isIPv6(ips[i])  && isJordanV6(ips[i])) return ips[i];
  for (var i = 0; i < ips.length; i++) if (isArabIP(ips[i]))                       return ips[i];
  return null;
}

// أفضل IPv6 أردني تحديداً (للـ Lobby Dual-Stack)
function bestJordanV6(ips) {
  for (var i = 0; i < ips.length; i++) if (isIPv6(ips[i]) && isZainV6(ips[i]))   return ips[i];
  for (var i = 0; i < ips.length; i++) if (isIPv6(ips[i]) && isJordanV6(ips[i])) return ips[i];
  return null;
}

// أفضل IPv4 أردني تحديداً
function bestJordanV4(ips) {
  for (var i = 0; i < ips.length; i++) if (!isIPv6(ips[i]) && isZainV4(ips[i]))   return ips[i];
  for (var i = 0; i < ips.length; i++) if (!isIPv6(ips[i]) && isJordanV4(ips[i])) return ips[i];
  return null;
}

function hasJordanIP(ips) {
  for (var i = 0; i < ips.length; i++) if (isJordanIP(ips[i])) return true;
  return false;
}

// ═══════════════════════════════════════════════════════════════════
//  §10  SESSION MANAGER
// ═══════════════════════════════════════════════════════════════════
function now_ms() {
  return (typeof Date !== "undefined" && Date.now) ? Date.now() : 0;
}

function tick(t) {
  SESSION.lastActivity = t;
  SESSION.txCount++;
}

function resetSession(t) {
  SESSION.state            = STATE.IDLE;
  SESSION.matchNet         = null;
  SESSION.matchHost        = null;
  SESSION.matchIP          = null;
  SESSION.isV6             = false;
  SESSION.v4LobbyPin       = null;
  SESSION.v6LobbyPin       = null;
  SESSION.preferV6Lobby    = false;
  SESSION.recruitProxy     = null;
  SESSION.recruitHost      = null;
  SESSION.recruitStartTime = 0;
  SESSION.failCount        = 0;
  SESSION.backoffUntil     = 0;
  SESSION.lobbyWide        = false;
  SESSION.txCount          = 0;
  SESSION.searchStartTime  = 0;
  SESSION.hashSeed         = hashStr("seed" + t);
}

function checkExpiry(t) {
  if (SESSION.state === STATE.IDLE) return;

  if (t - SESSION.lastActivity > T_SESSION_IDLE) {
    resetSession(t); return;
  }

  // SEARCHING طال → وسّع لـ Arab
  if (SESSION.state === STATE.SEARCHING &&
      SESSION.searchStartTime > 0 &&
      t - SESSION.searchStartTime > T_SEARCH_MAX) {
    SESSION.lobbyWide = true;
  }

  // RECRUITING منتهية الصلاحية → ارجع لـ LOBBY_IDLE
  if (SESSION.state === STATE.RECRUITING &&
      SESSION.recruitStartTime > 0 &&
      t - SESSION.recruitStartTime > T_RECRUIT_PERSIST) {
    SESSION.state            = STATE.LOBBY_IDLE;
    SESSION.recruitProxy     = null;
    SESSION.recruitHost      = null;
    SESSION.recruitStartTime = 0;
  }
}

function transitionTo(s, t) {
  if (s === STATE.SEARCHING  && SESSION.state < STATE.SEARCHING)
    SESSION.searchStartTime = t;
  if (s === STATE.RECRUITING && SESSION.state !== STATE.RECRUITING)
    SESSION.recruitStartTime = t;
  SESSION.state = s;
}

// ─── اختيار البروكسي الأمثل ──────────────────────────────────────

// Match Proxy: يتقدم عند الفشل
function matchProxy() {
  return T1_MATCH[SESSION.failCount % T1_MATCH.length];
}

// Lobby Proxy: dual-stack aware + wide mode
function lobbyProxy(host) {
  if (SESSION.lobbyWide) return consistentProxy(T3_ARAB, host);
  return roundRobin(T2_LOBBY);
}

// ═══════════════════════════════════════════════════════════════════
//  §11  DUAL-STACK LOBBY ANCHORING
//       عند دخول اللوبي لأول مرة: نحفظ IPv4 + IPv6 الأردنيين
//       ونستخدمهما طوال الجلسة لضمان الاتساق
// ═══════════════════════════════════════════════════════════════════
function anchorLobbyDualStack(ips) {
  if (!ips || ips.length === 0) return;

  var v4 = bestJordanV4(ips);
  var v6 = bestJordanV6(ips);

  if (v4 && !SESSION.v4LobbyPin) SESSION.v4LobbyPin = v4;
  if (v6 && !SESSION.v6LobbyPin) {
    SESSION.v6LobbyPin    = v6;
    SESSION.preferV6Lobby = true; // IPv6 متاح → فضّله للـ lobby
  }
}

// ═══════════════════════════════════════════════════════════════════
//  §12  CORE ROUTING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

// ── A: Match Traffic ──────────────────────────────────────────────
function routeMatch(host, ip, t) {
  checkExpiry(t);
  if (inBackoff(t)) return BLOCK;

  var net = netPrefix(ip || host);
  var useIP = ip || host;

  if (SESSION.state < STATE.SEARCHING) {
    SESSION.matchNet  = net;
    SESSION.matchHost = host;
    SESSION.matchIP   = useIP;
    SESSION.isV6      = isIPv6(useIP);
    transitionTo(STATE.MATCHED, t);
    clearFailures();
    return matchProxy();
  }

  if (SESSION.state === STATE.MATCHED || SESSION.state === STATE.IN_GAME) {
    if (host !== SESSION.matchHost && net !== SESSION.matchNet) {
      recordFailure(t);
      return BLOCK;
    }
    if (SESSION.state === STATE.MATCHED) transitionTo(STATE.IN_GAME, t);
    clearFailures();
    return matchProxy();
  }

  return matchProxy();
}

// ── B: Lobby General Traffic ──────────────────────────────────────
function routeLobby(host, ips, t) {
  checkExpiry(t);

  // Anchor dual-stack pins
  if (ips && ips.length > 0) anchorLobbyDualStack(ips);

  if (SESSION.state === STATE.IDLE) transitionTo(STATE.LOBBY_IDLE, t);

  // لا نُغيّر الحالة أثناء المباراة
  if (SESSION.state === STATE.IN_GAME) return matchProxy();

  return lobbyProxy(host);
}

// ── C: Recruit / Presence Traffic ─────────────────────────────────
//    هذا هو قلب الإضافة الجديدة:
//    طلبات التجنيد والأصدقاء تُثبَّت دائماً على T2_RECRUIT_PIN (زين أساسي)
//    لأن اللاعبين الأردنيين الآخرين الموجودين على نفس البروكسي
//    يرون حضورك وبثّك في قائمتهم باستمرار
function routeRecruit(host, ips, t) {
  checkExpiry(t);

  // Anchor dual-stack للـ recruit أيضاً
  if (ips && ips.length > 0) anchorLobbyDualStack(ips);

  // لا تُعطّل المباراة الجارية
  if (SESSION.state === STATE.IN_GAME ||
      SESSION.state === STATE.MATCHED) return matchProxy();

  // أول طلب تجنيد → سجّل الـ host والبروكسي المثبّت
  if (SESSION.state !== STATE.RECRUITING) {
    transitionTo(STATE.RECRUITING, t);
    SESSION.recruitHost  = host;
    SESSION.recruitProxy = T2_RECRUIT_PIN;
  }

  // نفس الـ host أو لم يُسجَّل بعد → استخدم الـ PIN دائماً
  if (!SESSION.recruitProxy) SESSION.recruitProxy = T2_RECRUIT_PIN;

  return SESSION.recruitProxy;
}

// ═══════════════════════════════════════════════════════════════════
//  §13  FindProxyForURL  — نقطة الدخول الرئيسية
// ═══════════════════════════════════════════════════════════════════
function FindProxyForURL(url, host) {
  host = norm(host.toLowerCase());
  var t = now_ms();
  tick(t);

  var directIP = isIP(host);

  // ───────────────────────────────────────────────
  //  مسار A: IP مباشر
  // ───────────────────────────────────────────────
  if (directIP) {
    // خارج المنطقة → تجاهل
    if (!isRegional(host)) return DIRECT;

    var tt = classifyTraffic(url, host);

    if (tt === "MATCH")                              return routeMatch(host, host, t);
    if (tt === "CDN")                                return DIRECT;
    if (tt === "RECRUIT" || tt === "PRESENCE")       return routeRecruit(host, null, t);
    // LOBBY / SOCIAL / UNKNOWN
    return routeLobby(host, null, t);
  }

  // ───────────────────────────────────────────────
  //  مسار B: Domain name
  // ───────────────────────────────────────────────
  if (!isPUBG(host)) return DIRECT;

  var tt = classifyTraffic(url, host);

  // CDN → مباشر دائماً (لا فائدة من البروكسي للـ assets)
  if (tt === "CDN") return DIRECT;

  // Fast path: سيرفرات أردنية معروفة — بدون DNS
  if (isKnownJo(host)) {
    if (tt === "MATCH")                              return routeMatch(host, null, t);
    if (tt === "RECRUIT" || tt === "PRESENCE")       return routeRecruit(host, null, t);
    return routeLobby(host, null, t);
  }

  // DNS resolution مع TTL cache
  var ips = cachedResolve(host, t);

  if (!ips || ips.length === 0) {
    // DNS فشل — إذا كنّا نُجنّد نُبقي الـ PIN، وإلا نستخدم lobby
    if (tt === "RECRUIT" || tt === "PRESENCE") return routeRecruit(host, null, t);
    if (SESSION.state === STATE.IDLE) transitionTo(STATE.LOBBY_IDLE, t);
    return lobbyProxy(host);
  }

  // Anchor dual-stack pins من أول DNS ناجح
  anchorLobbyDualStack(ips);

  var bestIP = bestJordanIP(ips);

  if (tt === "MATCH") {
    if (!bestIP) { recordFailure(t); return BLOCK; }
    return routeMatch(host, bestIP, t);
  }

  if (tt === "RECRUIT" || tt === "PRESENCE") {
    // حتى لو لم يكن IP أردنياً في DNS → نمر عبر Recruit PIN على أي حال
    // (السيرفر الاجتماعي قد يكون خارج نطاقاتنا لكن يخدم المنطقة)
    return routeRecruit(host, ips, t);
  }

  if (tt === "LOBBY" || tt === "SOCIAL") {
    // لا يوجد IP إقليمي في DNS → وسّع فوراً
    if (!hasJordanIP(ips) && !SESSION.lobbyWide) SESSION.lobbyWide = true;
    return routeLobby(host, ips, t);
  }

  // UNKNOWN + PUBG domain + وُجد IP إقليمي → lobby
  if (bestIP) return routeLobby(host, ips, t);

  return BLOCK;
}
