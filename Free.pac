// ╔══════════════════════════════════════════════════════════════════╗
// ║  PUBG MOBILE — JORDAN ULTRA PRO PAC  v4.1  "FIXED FOR iOS"      ║
// ║  المعدل ليعمل في أي متصفح/تطبيق يدعم PAC (بدون دوال غير قياسية) ║
// ╚══════════════════════════════════════════════════════════════════╝

// ─────────────────────────────────────────────
//  §1  PROXY TIERS  (ثلاث طبقات)
// ─────────────────────────────────────────────
var T1_MATCH = [
  "PROXY 82.212.84.33:20005",    // زين الأساسي
  "PROXY 46.185.131.218:20005"   // Orange JO
];

var T2_LOBBY = [
  "PROXY 82.212.84.33:1080",
  "PROXY 176.29.153.95:443",
  "PROXY 46.185.131.218:443"
];

var T3_ARAB = [
  "PROXY 82.212.84.33:1080",
  "PROXY 176.29.153.95:443",
  "PROXY 46.185.131.218:443"
];

var BLOCK  = "PROXY 127.0.0.1:9";
var DIRECT = "DIRECT";

// ─────────────────────────────────────────────
//  §2  حذف الـ SESSION STATE MACHINE (لا يعمل في PAC)
//      وبدلاً منه نستخدم فحص الـ URL فقط.
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
//  §3  CONSISTENT HASH (بدون حالة، نستخدم بذرة ثابتة)
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
  var idx = hashStr(key) % pool.length;
  return pool[idx];
}

// ─────────────────────────────────────────────
//  §4  EXPONENTIAL BACKOFF (لا يمكن الاحتفاظ به، نستبدله ببساطة: نعيد المحاولة مباشرة)
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
//  §5  TRAFFIC SCORING ENGINE (نفس الأوزان)
// ─────────────────────────────────────────────
var SCORE_MATCH = [
  ["udp",10],["tick",12],["sync",9],["realtime",9],["battle",10],
  ["combat",10],["frame",11],["physics",12],["movement",11],["shoot",12],
  ["fire",10],["hit",10],["damage",10],["relay",9],["dtls",13],
  ["rtp",13],["srtp",14],["stun",10],["turn",8],["ice",7]
];
var SCORE_LOBBY = [
  ["lobby",15],["matchmak",15],["queue",12],["dispatch",12],["gateway",10],
  ["region",8],["join",10],["recruit",11],["pair",11],["assign",10],
  ["roster",10],["rank",8],["rating",8],["mmr",12],["elo",10],
  ["pool",9],["slot",9],["room",10],["bracket",10],["wait",7],
  ["search",9],["find",8],["discover",11],["avail",8]
];
var SCORE_SOCIAL = [
  ["friend",8],["invite",8],["squad",9],["party",9],["clan",8],
  ["presence",8],["voice",7],["chat",6],["notify",6],["push",5],["broadcast",6]
];
var SCORE_CDN = [
  ["cdn",10],["asset",10],["resource",9],["static",10],["media",9],
  ["patch",11],["update",10],["download",11],["bundle",10],["pak",12],
  ["obb",12],["manifest",12],["version",10],["config",9]
];

function computeScore(haystack, weights) {
  var score = 0;
  var h = haystack.toLowerCase();
  for (var i = 0; i < weights.length; i++) {
    if (h.indexOf(weights[i][0]) !== -1) score += weights[i][1];
  }
  return score;
}
var THRESHOLD = 9;

function classifyTraffic(url, host) {
  var corpus = url + " " + host;
  var sMatch  = computeScore(corpus, SCORE_MATCH);
  var sLobby  = computeScore(corpus, SCORE_LOBBY);
  var sSocial = computeScore(corpus, SCORE_SOCIAL);
  var sCDN    = computeScore(corpus, SCORE_CDN);

  var max = sMatch;
  var type = "MATCH";
  if (sLobby  > max) { max = sLobby;  type = "LOBBY";  }
  if (sSocial > max) { max = sSocial; type = "SOCIAL"; }
  if (sCDN    > max) { max = sCDN;    type = "CDN";    }
  return (max >= THRESHOLD) ? type : "UNKNOWN";
}

// ─────────────────────────────────────────────
//  §6  IP RANGES (بدون isInNet، نستخدم مقارنة البادئة)
// ─────────────────────────────────────────────
// دوال مساعدة للبادئات:
function ipToInt(ip) {
  var parts = ip.split('.');
  if (parts.length !== 4) return 0;
  return ((parseInt(parts[0]) << 24) >>> 0) +
         ((parseInt(parts[1]) << 16) >>> 0) +
         ((parseInt(parts[2]) << 8) >>> 0) +
         parseInt(parts[3]);
}
function inNet(ip, netAddr, netMask) {
  var ipInt = ipToInt(ip);
  var netInt = ipToInt(netAddr);
  var maskInt = ipToInt(netMask);
  return (ipInt & maskInt) === (netInt & maskInt);
}

// قوائم IP (محولة إلى صيغة سهلة المقارنة)
var ZAIN_IPV4_NETS = [
  {addr:"81.28.112.0", mask:"255.255.240.0"},
  {addr:"82.212.64.0", mask:"255.255.192.0"},
  {addr:"188.123.160.0", mask:"255.255.224.0"}
];
var JORDAN_IPV4_NETS = [
  {addr:"81.28.112.0",mask:"255.255.240.0"},{addr:"82.212.64.0",mask:"255.255.192.0"},
  {addr:"188.123.160.0",mask:"255.255.224.0"},{addr:"5.45.128.0",mask:"255.255.240.0"},
  {addr:"46.23.112.0",mask:"255.255.240.0"},{addr:"46.248.192.0",mask:"255.255.224.0"},
  {addr:"92.241.32.0",mask:"255.255.224.0"},{addr:"95.172.192.0",mask:"255.255.224.0"},
  {addr:"109.107.224.0",mask:"255.255.224.0"},{addr:"149.200.128.0",mask:"255.255.128.0"},
  {addr:"178.238.176.0",mask:"255.255.240.0"},{addr:"46.32.96.0",mask:"255.255.224.0"},
  {addr:"77.245.0.0",mask:"255.255.240.0"},{addr:"80.90.160.0",mask:"255.255.240.0"},
  {addr:"94.142.32.0",mask:"255.255.224.0"},{addr:"176.28.128.0",mask:"255.255.128.0"},
  {addr:"176.29.0.0",mask:"255.255.0.0"},{addr:"188.247.64.0",mask:"255.255.224.0"},
  {addr:"37.202.64.0",mask:"255.255.192.0"},{addr:"46.185.128.0",mask:"255.255.128.0"},
  {addr:"79.173.192.0",mask:"255.255.192.0"},{addr:"86.108.0.0",mask:"255.255.128.0"},
  {addr:"92.253.0.0",mask:"255.255.128.0"},{addr:"94.249.0.0",mask:"255.255.128.0"},
  {addr:"193.188.64.0",mask:"255.255.224.0"},{addr:"194.165.128.0",mask:"255.255.224.0"},
  {addr:"213.186.160.0",mask:"255.255.224.0"},{addr:"217.23.32.0",mask:"255.255.240.0"},
  {addr:"91.106.96.0",mask:"255.255.240.0"},{addr:"91.186.224.0",mask:"255.255.224.0"},
  {addr:"212.118.0.0",mask:"255.255.224.0"},{addr:"37.220.112.0",mask:"255.255.240.0"},
  {addr:"62.72.160.0",mask:"255.255.224.0"},{addr:"81.21.0.0",mask:"255.255.240.0"},
  {addr:"109.237.192.0",mask:"255.255.240.0"},{addr:"176.57.0.0",mask:"255.255.224.0"},
  {addr:"37.17.192.0",mask:"255.255.240.0"},{addr:"37.123.64.0",mask:"255.255.224.0"},
  {addr:"95.141.208.0",mask:"255.255.240.0"},{addr:"178.77.128.0",mask:"255.255.192.0"},
  {addr:"212.34.0.0",mask:"255.255.224.0"},{addr:"212.35.64.0",mask:"255.255.192.0"},
  {addr:"213.139.32.0",mask:"255.255.224.0"},{addr:"217.144.0.0",mask:"255.255.240.0"},
  {addr:"84.18.32.0",mask:"255.255.224.0"},{addr:"84.18.64.0",mask:"255.255.224.0"},
  {addr:"37.152.0.0",mask:"255.255.248.0"},{addr:"79.134.128.0",mask:"255.255.224.0"},
  {addr:"217.29.240.0",mask:"255.255.240.0"},{addr:"212.34.96.0",mask:"255.255.224.0"},
  {addr:"212.34.128.0",mask:"255.255.128.0"},{addr:"147.161.0.0",mask:"255.255.0.0"},
  {addr:"5.11.0.0",mask:"255.255.0.0"},{addr:"31.9.0.0",mask:"255.255.128.0"},
  {addr:"37.0.16.0",mask:"255.255.240.0"},{addr:"46.32.64.0",mask:"255.255.192.0"},
  {addr:"46.183.0.0",mask:"255.255.128.0"},{addr:"78.110.32.0",mask:"255.255.224.0"},
  {addr:"80.90.128.0",mask:"255.255.128.0"},{addr:"84.18.0.0",mask:"255.255.128.0"},
  {addr:"91.186.192.0",mask:"255.255.192.0"},{addr:"92.242.192.0",mask:"255.255.192.0"},
  {addr:"95.141.192.0",mask:"255.255.192.0"},{addr:"109.237.192.0",mask:"255.255.192.0"},
  {addr:"176.57.0.0",mask:"255.255.192.0"},{addr:"178.77.128.0",mask:"255.255.128.0"},
  {addr:"185.15.243.0",mask:"255.255.255.0"},{addr:"185.24.184.0",mask:"255.255.252.0"},
  {addr:"185.62.232.0",mask:"255.255.252.0"},{addr:"185.93.0.0",mask:"255.255.252.0"},
  {addr:"185.168.28.0",mask:"255.255.252.0"},{addr:"188.247.64.0",mask:"255.255.192.0"},
  {addr:"194.9.48.0",mask:"255.255.240.0"},{addr:"212.118.0.0",mask:"255.255.192.0"},
  {addr:"213.186.128.0",mask:"255.255.192.0"}
];
var ARAB_IPV4_NETS = [
  {addr:"212.118.96.0",mask:"255.255.224.0"},{addr:"37.184.0.0",mask:"255.255.128.0"},
  {addr:"188.135.0.0",mask:"255.255.128.0"},{addr:"80.249.128.0",mask:"255.255.128.0"},
  {addr:"109.224.0.0",mask:"255.255.128.0"},{addr:"185.161.48.0",mask:"255.255.252.0"},
  {addr:"195.229.0.0",mask:"255.255.128.0"},{addr:"94.204.0.0",mask:"255.255.128.0"},
  {addr:"213.42.0.0",mask:"255.255.128.0"},{addr:"185.50.12.0",mask:"255.255.252.0"},
  {addr:"196.205.0.0",mask:"255.255.0.0"},{addr:"197.0.0.0",mask:"255.0.0.0"},
  {addr:"41.32.0.0",mask:"255.224.0.0"},{addr:"197.32.0.0",mask:"255.224.0.0"},
  {addr:"82.212.0.0",mask:"255.255.192.0"},{addr:"88.82.0.0",mask:"255.255.0.0"},
  {addr:"37.36.0.0",mask:"255.252.0.0"},{addr:"91.74.0.0",mask:"255.255.0.0"},
  {addr:"78.26.0.0",mask:"255.254.0.0"},{addr:"37.236.0.0",mask:"255.252.0.0"},
  {addr:"95.111.0.0",mask:"255.255.128.0"},{addr:"78.39.0.0",mask:"255.255.128.0"}
];

function inNetList(ip, netList) {
  for (var i = 0; i < netList.length; i++) {
    if (inNet(ip, netList[i].addr, netList[i].mask)) return true;
  }
  return false;
}
function isZainIP(ip)   { return inNetList(ip, ZAIN_IPV4_NETS); }
function isJordanIP(ip) { return inNetList(ip, JORDAN_IPV4_NETS); }
function isArabIP(ip)   { return inNetList(ip, ARAB_IPV4_NETS); }
function isRegionalIP(ip) { return isJordanIP(ip) || isArabIP(ip); }

// نطاقات معروفة (بدون DNS)
var KNOWN_JO_PREFIXES = [
  "46.185.131", "176.29.153", "212.35.66",
  "86.108.", "92.253.", "94.249.",
  "82.212.84", "81.28.11", "176.29.1",
  "176.28.", "94.142."
];
function isKnownJoHost(h) {
  for (var i = 0; i < KNOWN_JO_PREFIXES.length; i++)
    if (h.indexOf(KNOWN_JO_PREFIXES[i]) === 0) return true;
  return false;
}

function isPUBG(host) {
  return /pubg|pubgm|pubgmobile|tencent|krafton|lightspeed|levelinfinite|igamecj|proximabeta|vnggames|garena|sgp\.gameops|sgp\.battleground/i.test(host);
}

// ─────────────────────────────────────────────
//  §7  CORE ROUTING (بدون حالة، مباشر)
// ─────────────────────────────────────────────
function routeMatchTraffic(host) {
  // نختار أول بروكسي من T1_MATCH بشكل ثابت (أو نستخدم hash بسيط)
  return T1_MATCH[0];
}

function routeLobbyTraffic(host) {
  // نستخدم T2_LOBBY مع إمكانية توسيع عربي (نُفعّل عربي تلقائياً)
  // نستخدم consistentProxy لثبات التوجيه
  return consistentProxy(T2_LOBBY, host);
}

// ─────────────────────────────────────────────
//  §8  FindProxyForURL  — نقطة الدخول الرئيسية (معدلة)
// ─────────────────────────────────────────────
function FindProxyForURL(url, host) {
  // إزالة المنفذ إن وجد
  var colon = host.indexOf(":");
  if (colon !== -1) host = host.substring(0, colon);
  host = host.toLowerCase();

  // فحص إذا كان host هو عنوان IP
  var isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
  if (isIP) {
    if (!isRegionalIP(host)) return DIRECT;
    var ttype = classifyTraffic(url, host);
    if (ttype === "MATCH") return routeMatchTraffic(host);
    if (ttype === "CDN") return DIRECT;
    return routeLobbyTraffic(host);
  }

  // ليس PUBG → مباشر
  if (!isPUBG(host)) return DIRECT;

  var ttype = classifyTraffic(url, host);
  if (ttype === "CDN") return DIRECT;

  // نطاقات معروفة أردنية
  if (isKnownJoHost(host)) {
    if (ttype === "MATCH") return routeMatchTraffic(host);
    return routeLobbyTraffic(host);
  }

  // باقي نطاقات PUBG
  if (ttype === "MATCH") {
    return routeMatchTraffic(host);
  } else {
    // لوبي أو اجتماعي → توسيع عربي
    return routeLobbyTraffic(host);
  }
}
