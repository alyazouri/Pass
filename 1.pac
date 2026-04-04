// ================= PROXIES =================
var MATCH_JO_PRIMARY   = "PROXY 82.212.84.33:20005";
var MATCH_JO_SECONDARY = "PROXY 176.29.153.95:20005";
var LOBBY_POOL = [
  "PROXY 82.212.84.33:1080",
  "PROXY 176.29.153.95:443",
  "PROXY 46.185.131.218:443"
];
var BLOCK  = "PROXY 127.0.0.1:9";
var DIRECT = "DIRECT";

// ================= JORDAN IPv4 RANGES — محدَّثة من RIPE/Nirsoft 2025 =================
// المصدر: nirsoft.net/countryip/jo.csv + RIPE NCC allocations
var JORDAN_IPV4 = [
  // --- Umniah ---
  ["5.45.128.0",    "255.255.240.0"],   // /20
  ["46.23.112.0",   "255.255.240.0"],   // /20
  ["46.248.192.0",  "255.255.224.0"],   // /19
  ["92.241.32.0",   "255.255.224.0"],   // /19
  ["95.172.192.0",  "255.255.224.0"],   // /19
  ["109.107.224.0", "255.255.224.0"],   // /19
  ["149.200.128.0", "255.255.128.0"],   // /17
  ["178.238.176.0", "255.255.240.0"],   // /20

  // --- Linkdotnet-Jordan ---
  ["46.32.96.0",    "255.255.224.0"],   // /19
  ["77.245.0.0",    "255.255.240.0"],   // /20
  ["80.90.160.0",   "255.255.240.0"],   // /20
  ["94.142.32.0",   "255.255.224.0"],   // /19
  ["176.28.128.0",  "255.255.128.0"],   // /17
  ["176.29.0.0",    "255.255.0.0"],     // /16 ← جديد كبير
  ["188.247.64.0",  "255.255.224.0"],   // /19

  // --- Jordan Data Communications (JDC/Orange) ---
  ["37.202.64.0",   "255.255.192.0"],   // /18
  ["46.185.128.0",  "255.255.128.0"],   // /17
  ["79.173.192.0",  "255.255.192.0"],   // /18
  ["86.108.0.0",    "255.255.128.0"],   // /17 ← جديد كبير
  ["92.253.0.0",    "255.255.128.0"],   // /17
  ["94.249.0.0",    "255.255.128.0"],   // /17
  ["149.200.128.0", "255.255.128.0"],   // /17
  ["193.188.64.0",  "255.255.224.0"],   // /19
  ["194.165.128.0", "255.255.224.0"],   // /19
  ["213.186.160.0", "255.255.224.0"],   // /19
  ["217.23.32.0",   "255.255.240.0"],   // /20

  // --- Batelco Jordan ---
  ["91.106.96.0",   "255.255.240.0"],   // /20
  ["91.186.224.0",  "255.255.224.0"],   // /19 ← جديد
  ["212.118.0.0",   "255.255.224.0"],   // /19 ← جديد
  ["37.220.112.0",  "255.255.240.0"],   // /20

  // --- AL-HADATHEH (Zain JO سابقاً) ---
  ["81.28.112.0",   "255.255.240.0"],   // /20 ← جديد
  ["82.212.64.0",   "255.255.192.0"],   // /18
  ["188.123.160.0", "255.255.224.0"],   // /19 ← جديد

  // --- VTEL Jordan ---
  ["62.72.160.0",   "255.255.224.0"],   // /19 ← جديد
  ["81.21.0.0",     "255.255.240.0"],   // /20 ← جديد
  ["109.237.192.0", "255.255.240.0"],   // /20 ← جديد
  ["176.57.0.0",    "255.255.224.0"],   // /19 ← جديد
  ["176.57.48.0",   "255.255.240.0"],   // /20 ← جديد

  // --- Al Mouakhah (شركة مواخاة) ---
  ["37.17.192.0",   "255.255.240.0"],   // /20 ← جديد
  ["37.123.64.0",   "255.255.224.0"],   // /19 ← جديد
  ["95.141.208.0",  "255.255.240.0"],   // /20 ← جديد
  ["178.77.128.0",  "255.255.192.0"],   // /18
  ["176.57.0.0",    "255.255.224.0"],   // /19

  // --- Jordan Telecom PSC ---
  ["212.34.0.0",    "255.255.224.0"],   // /19 ← جديد
  ["212.35.64.0",   "255.255.192.0"],   // /18
  ["213.139.32.0",  "255.255.224.0"],   // /19 ← جديد
  ["217.144.0.0",   "255.255.240.0"],   // /20 ← جديد

  // --- Network Exchange / مراكز بيانات ---
  ["84.18.32.0",    "255.255.224.0"],   // /19 ← جديد (Royal Hashemite Court)
  ["84.18.64.0",    "255.255.224.0"],   // /19 ← جديد
  ["37.152.0.0",    "255.255.248.0"],   // /21
  ["178.77.128.0",  "255.255.192.0"],   // /18
  ["79.134.128.0",  "255.255.224.0"],   // /19 ← جديد (Jordan TV Cable)
  ["217.29.240.0",  "255.255.240.0"],   // /20 ← جديد (Applied Science Univ.)
  ["95.172.192.0",  "255.255.224.0"],   // /19
  ["188.247.64.0",  "255.255.224.0"]    // /19
];

// ================= JORDAN IPv6 =================
var JORDAN_IPV6 = [
  "2a00:18d0",   // Zain JO
  "2a00:18d8",   // Zain JO
  "2a01:9700",   // Orange JO
  "2a02:c040",   // Umniah
  "2a05:74c0",
  "2a04:2e00",   // Jordan Telecom
  "2a06:8ec0",
  "2001:41f0"    // Academic/Gov
];

// ================= Fast Path — IP prefixes معروفة مباشرة =================
var KNOWN_JO_GAME_HOSTS = [
  "46.185.131",
  "176.29.153",
  "212.35.66",
  "86.108.",     // JDC block كبير
  "92.253.",     // JDC
  "94.249."      // JDC
];

// ================= SESSION =================
var SESSION = {
  matchNet:       null,
  matchHost:      null,
  matchIP:        null,
  isV6:           false,
  dnsCache:       {},
  lobbyIndex:     0,
  matchFailCount: 0,
  lastMatchTime:  0,
  warmupDone:     false
};

var SESSION_TIMEOUT_MS = 300000; // 5 دقائق

// ================= HELPERS =================
function norm(h) {
  var colons = 0, last = -1;
  for (var i = 0; i < h.length; i++) {
    if (h[i] === ":") { colons++; last = i; }
  }
  return (colons === 1) ? h.substring(0, last) : h;
}

function isIPv6(ip)        { return ip.indexOf(":") > -1; }

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

function isKnownJoHost(host) {
  for (var i = 0; i < KNOWN_JO_GAME_HOSTS.length; i++) {
    if (host.indexOf(KNOWN_JO_GAME_HOSTS[i]) !== -1) return true;
  }
  return false;
}

function resolveAll(host) {
  if (SESSION.dnsCache[host]) return SESSION.dnsCache[host];
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
  } catch (e) {}
  try {
    if (typeof dnsResolve === "function") {
      var v4 = dnsResolve(host);
      if (v4 && ips.indexOf(v4) === -1) ips.push(v4);
    }
  } catch (e) {}
  if (ips.length > 0) SESSION.dnsCache[host] = ips;
  return ips;
}

function findJordanIP(ips) {
  for (var i = 0; i < ips.length; i++) {
    var ip = ips[i];
    if (isIPv6(ip)) {
      if (inV6List(ip, JORDAN_IPV6)) return ip;
    } else {
      if (inV4List(ip, JORDAN_IPV4)) return ip;
    }
  }
  return null;
}

function netPrefix(ip) {
  if (isIPv6(ip)) return ip.split(":").slice(0, 3).join(":");
  return ip.split(".").slice(0, 3).join(".");
}

function nextLobbyProxy() {
  var proxy = LOBBY_POOL[SESSION.lobbyIndex % LOBBY_POOL.length];
  SESSION.lobbyIndex++;
  return proxy;
}

function matchProxy() {
  return (SESSION.matchFailCount >= 3) ? MATCH_JO_SECONDARY : MATCH_JO_PRIMARY;
}

function checkSessionExpiry(now) {
  if (SESSION.matchNet && SESSION.lastMatchTime > 0) {
    if ((now - SESSION.lastMatchTime) > SESSION_TIMEOUT_MS) {
      SESSION.matchNet       = null;
      SESSION.matchHost      = null;
      SESSION.matchIP        = null;
      SESSION.isV6           = false;
      SESSION.matchFailCount = 0;
      SESSION.warmupDone     = false;
    }
  }
}

// ================= TRAFFIC DETECTION =================
function isPUBG(h) {
  return /pubg|pubgm|pubgmobile|tencent|krafton|lightspeed|levelinfinite|igamecj|proximabeta|vnggames|garena/i.test(h);
}
function isMatchTraffic(u, h) {
  return /(udp|tick|ticks|sync|realtime|battle|combat|match|game|room|session|state|frame|physics|movement|shoot|fire|hit|damage|relay|turn|stun|dtls|rtp|srtp)/i.test(u + h);
}
function isLobby(u, h) {
  return /(lobby|matchmaking|queue|dispatch|gateway|region|zone|join|recruit|pair|assign|entry|roster|rank|rating|mmr|elo|pool|slot)/i.test(u + h);
}
function isSocial(u, h) {
  return /(friend|invite|squad|team|party|clan|presence|social|voice|chat|notify|push|broadcast)/i.test(u + h);
}
function isCDN(u, h) {
  return /(cdn|asset|resource|static|media|content|patch|update|download|bundle|pak|obb|manifest|version|config)/i.test(u + h);
}

// ================= MAIN =================
function FindProxyForURL(url, host) {
  host = norm(host.toLowerCase());
  if (!isPUBG(host)) return DIRECT;

  // Fast Path
  if (isKnownJoHost(host)) {
    if (isMatchTraffic(url, host)) {
      SESSION.lastMatchTime = Date.now ? Date.now() : 0;
      return matchProxy();
    }
    return nextLobbyProxy();
  }

  var ips = resolveAll(host);
  if (!ips || ips.length === 0) return BLOCK;

  // Match / UDP
  if (isMatchTraffic(url, host)) {
    var now = Date.now ? Date.now() : 0;
    checkSessionExpiry(now);
    var matchIP = findJordanIP(ips);
    if (!matchIP) { SESSION.matchFailCount++; return BLOCK; }
    var net = netPrefix(matchIP);
    if (!SESSION.matchNet) {
      SESSION.matchNet  = net; SESSION.matchHost = host;
      SESSION.matchIP   = matchIP; SESSION.isV6 = isIPv6(matchIP);
      SESSION.matchFailCount = 0; SESSION.warmupDone = true;
    }
    if (host !== SESSION.matchHost || net !== SESSION.matchNet || matchIP !== SESSION.matchIP) {
      SESSION.matchFailCount++; return BLOCK;
    }
    SESSION.lastMatchTime = now;
    SESSION.matchFailCount = 0;
    return matchProxy();
  }

  if (isLobby(url, host) || isSocial(url, host)) {
    if (!findJordanIP(ips)) return BLOCK;
    return nextLobbyProxy();
  }

  // CDN مباشر — لا يستهلك باندويدث البروكسي
  if (isCDN(url, host)) return DIRECT;

  return BLOCK;
}
