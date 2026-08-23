// ================= PROXIES =================
var MATCH_JO_PRIMARY   = "PROXY 82.212.84.33:1080";
var MATCH_JO_SECONDARY = "PROXY 176.29.153.95:443";
var LOBBY_POOL = [
  "PROXY 82.212.84.33:1080",
  "PROXY 176.29.153.95:443",
  "PROXY 46.185.131.218:443"
];
var BLOCK  = "PROXY 127.0.0.1:9";
var DIRECT = "DIRECT";

// ================= JORDAN IPv4 RANGES =============
// تم تحديث النطاقات لتشمل معظم مزودي الخدمة في الأردن (Zain, Orange, Umniah)
var JORDAN_IPV4 = [
  // Umniah
  ["5.45.128.0",    "255.255.240.0"],
  ["46.23.112.0",   "255.255.240.0"],
  ["109.107.224.0", "255.255.224.0"],
  ["46.248.192.0",  "255.255.224.0"],
  ["92.241.32.0",   "255.255.224.0"],
  ["95.172.192.0",  "255.255.224.0"],
  ["178.238.176.0", "255.255.240.0"],
  
  // Orange (Jordan Data Communications)
  ["37.202.64.0",   "255.255.192.0"],
  ["46.185.128.0",  "255.255.128.0"],
  ["79.173.192.0",  "255.255.192.0"],
  ["86.108.0.0",    "255.255.128.0"],
  ["92.253.0.0",    "255.255.128.0"],
  ["94.249.0.0",    "255.255.128.0"],
  ["193.188.64.0",  "255.255.224.0"],
  ["176.28.128.0",  "255.255.128.0"],
  ["176.29.0.0",    "255.255.0.0"],

  // Zain Jordan (Al-Hadatheh)
  ["37.220.112.0",  "255.255.240.0"],
  ["81.28.112.0",   "255.255.240.0"],
  ["82.212.64.0",   "255.255.192.0"],
  ["188.123.160.0", "255.255.224.0"],
  ["91.106.96.0",   "255.255.240.0"],
  
  // VTEL & Others
  ["62.72.160.0",   "255.255.224.0"],
  ["178.77.128.0",  "255.255.192.0"],
  ["212.34.0.0",    "255.255.224.0"]
];

// ================= JORDAN IPv6 RANGES =================
var JORDAN_IPV6 = [
  "2a00:18d0",   // Zain JO
  "2a00:18d8",   // Zain JO
  "2a01:9700",   // Orange JO
  "2a02:c040"    // Umniah
];

// ================= FAST PATH — Known JO Game Hosts =================
var KNOWN_JO_GAME_HOSTS = [
  "46.185.131", "176.29.153", "212.35.66", "86.108.", "92.253.", "94.249."
];

// ================= SESSION & HELPERS =================
var SESSION = {
  matchNet: null,
  matchFailCount: 0,
  lastMatchTime: 0,
  dnsCache: {}
};

function isIPv6(ip) { return ip.indexOf(":") > -1; }

function inV4List(ip, list) {
  for (var i = 0; i < list.length; i++) {
    if (isInNet(ip, list[i][0], list[i][1])) return true;
  }
  return false;
}

function inV6List(ip, prefixes) {
  var low = ip.toLowerCase();
  for (var i = 0; i < prefixes.length; i++) {
    if (low.indexOf(prefixes[i]) === 0) return true;
  }
  return false;
}

function resolveAll(host) {
  if (SESSION.dnsCache[host]) return SESSION.dnsCache[host];
  var ips = [];
  try {
    var v4 = dnsResolve(host);
    if (v4) ips.push(v4);
  } catch (e) {}
  if (ips.length > 0) SESSION.dnsCache[host] = ips;
  return ips;
}

// ================= TRAFFIC DETECTION =================
function isPUBG(h) {
  return /pubg|pubgm|pubgmobile|tencent|krafton|lightspeed|levelinfinite|igamecj|proximabeta|vnggames|garena/i.test(h);
}

function isMatchTraffic(u, h) {
  return /(udp|tick|sync|realtime|battle|combat|match|game|room|session|state|physics|shoot|fire|hit|damage|relay)/i.test(u + h);
}

function isCDN(u, h) {
  return /(cdn|asset|resource|static|media|content|patch|update|download|bundle|pak|obb)/i.test(u + h);
}

// ================= MAIN FUNCTION =================
function FindProxyForURL(url, host) {
  host = host.toLowerCase();
  
  // 1. إذا لم يكن الترافيك خاص ببجي، مرره مباشرة
  if (!isPUBG(host)) return DIRECT;

  // 2. ملفات التحديث والتحميل (CDN) تمر مباشرة لتوفير السرعة
  if (isCDN(url, host)) return DIRECT;

  // 3. فحص الـ IPs
  var ips = resolveAll(host);
  if (!ips || ips.length === 0) return DIRECT;

  var isJordan = false;
  for (var i = 0; i < ips.length; i++) {
    if (isIPv6(ips[i])) {
      if (inV6List(ips[i], JORDAN_IPV6)) { isJordan = true; break; }
    } else {
      if (inV4List(ips[i], JORDAN_IPV4)) { isJordan = true; break; }
    }
  }

  // 4. توجيه الترافيك بناءً على النوع
  if (isJordan) {
    if (isMatchTraffic(url, host)) {
      return (SESSION.matchFailCount >= 3) ? MATCH_JO_SECONDARY : MATCH_JO_PRIMARY;
    }
    return LOBBY_POOL[0]; // Lobby Proxy
  }

  // إذا كان ببجي ولكن ليس سيرفر أردني (اختياري: يمكنك عمل BLOCK أو DIRECT)
  return DIRECT; 
}
