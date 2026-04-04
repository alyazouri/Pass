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

// ================= JORDAN IPv4 RANGES =================
var JORDAN_IPV4 = [
  // --- Umniah ---
  ["5.45.128.0",    "255.255.240.0"],
  ["46.23.112.0",   "255.255.240.0"],
  ["46.248.192.0",  "255.255.224.0"],
  ["92.241.32.0",   "255.255.224.0"],
  ["95.172.192.0",  "255.255.224.0"],
  ["109.107.224.0", "255.255.224.0"],
  ["149.200.128.0", "255.255.128.0"],
  ["178.238.176.0", "255.255.240.0"],

  // --- Linkdotnet-Jordan ---
  ["46.32.96.0",    "255.255.224.0"],
  ["77.245.0.0",    "255.255.240.0"],
  ["80.90.160.0",   "255.255.240.0"],
  ["94.142.32.0",   "255.255.224.0"],
  ["176.28.128.0",  "255.255.128.0"],
  ["176.29.0.0",    "255.255.0.0"],
  ["188.247.64.0",  "255.255.224.0"],

  // --- Jordan Data Communications (JDC/Orange) ---
  ["37.202.64.0",   "255.255.192.0"],
  ["46.185.128.0",  "255.255.128.0"],
  ["79.173.192.0",  "255.255.192.0"],
  ["86.108.0.0",    "255.255.128.0"],
  ["92.253.0.0",    "255.255.128.0"],
  ["94.249.0.0",    "255.255.128.0"],
  ["149.200.128.0", "255.255.128.0"],
  ["193.188.64.0",  "255.255.224.0"],
  ["194.165.128.0", "255.255.224.0"],
  ["213.186.160.0", "255.255.224.0"],
  ["217.23.32.0",   "255.255.240.0"],

  // --- Batelco Jordan ---
  ["91.106.96.0",   "255.255.240.0"],
  ["91.186.224.0",  "255.255.224.0"],
  ["212.118.0.0",   "255.255.224.0"],
  ["37.220.112.0",  "255.255.240.0"],

  // --- AL-HADATHEH (Zain JO) ---
  ["81.28.112.0",   "255.255.240.0"],
  ["82.212.64.0",   "255.255.192.0"],
  ["188.123.160.0", "255.255.224.0"],

  // --- VTEL Jordan ---
  ["62.72.160.0",   "255.255.224.0"],
  ["81.21.0.0",     "255.255.240.0"],
  ["109.237.192.0", "255.255.240.0"],
  ["176.57.0.0",    "255.255.224.0"],
  ["176.57.48.0",   "255.255.240.0"],

  // --- Al Mouakhah ---
  ["37.17.192.0",   "255.255.240.0"],
  ["37.123.64.0",   "255.255.224.0"],
  ["95.141.208.0",  "255.255.240.0"],
  ["178.77.128.0",  "255.255.192.0"],

  // --- Jordan Telecom PSC ---
  ["212.34.0.0",    "255.255.224.0"],
  ["212.35.64.0",   "255.255.192.0"],
  ["213.139.32.0",  "255.255.224.0"],
  ["217.144.0.0",   "255.255.240.0"],

  // --- Network Exchange / Data Centers ---
  ["84.18.32.0",    "255.255.224.0"],
  ["84.18.64.0",    "255.255.224.0"],
  ["37.152.0.0",    "255.255.248.0"],
  ["79.134.128.0",  "255.255.224.0"],
  ["217.29.240.0",  "255.255.240.0"],
  ["188.247.64.0",  "255.255.224.0"]
];

// ================= JORDAN IPv6 RANGES =================
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

// ================= FAST PATH — Known JO Game Hosts =================
var KNOWN_JO_GAME_HOSTS = [
  "46.185.131",
  "176.29.153",
  "212.35.66",
  "176.28.128",
  "86.108.",
  "92.253.",
  "94.249."
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

var SESSION_TIMEOUT_MS = 60000; // 60 ثانية — أسرع من 5 دقائق

// ================= HELPERS =================
function norm(h) {
  var colons = 0, last = -1;
  for (var i = 0; i < h.length; i++) {
    if (h[i] === ":") { colons++; last = i; }
  }
  return (colons === 1) ? h.substring(0, last) : h;
}

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

// ================= IP CLASSIFICATION — IPv4 & IPv6 =================

function findJordanIPv4(ips) {
  for (var i = 0; i < ips.length; i++) {
    if (!isIPv6(ips[i]) && inV4List(ips[i], JORDAN_IPV4)) return ips[i];
  }
  return null;
}

function findJordanIPv6(ips) {
  for (var i = 0; i < ips.length; i++) {
    if (isIPv6(ips[i]) && inV6List(ips[i], JORDAN_IPV6)) return ips[i];
  }
  return null;
}

// يُعطي الأولوية لـ IPv4 لأن isInNet أكثر دقة، ويسقط على IPv6 عند الحاجة
function findJordanIP(ips) {
  return findJordanIPv4(ips) || findJordanIPv6(ips);
}

// true إذا وُجد IP أردني من أي عائلة (IPv4 أو IPv6)
function hasJordanIP(ips) {
  return !!(findJordanIPv4(ips) || findJordanIPv6(ips));
}

function netPrefix(ip) {
  if (isIPv6(ip)) return ip.split(":").slice(0, 3).join(":");
  return ip.split(".").slice(0, 3).join(".");
}

// اللوبي يستخدم بروكسي ثابت لضمان استمرارية الـ session
function lobbyProxy() {
  return LOBBY_POOL[0];
}

// التناوب محفوظ للحالات التي قد يحتاجها المستخدم مستقبلاً
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

  // --- Fast Path: سيرفرات أردنية معروفة مباشرة ---
  if (isKnownJoHost(host)) {
    if (isMatchTraffic(url, host)) {
      SESSION.lastMatchTime = Date.now ? Date.now() : 0;
      return matchProxy();
    }
    return lobbyProxy();
  }

  var ips = resolveAll(host);
  if (!ips || ips.length === 0) return BLOCK;

  // --- ترافيك المباراة الفعلية (UDP/Match) ---
  if (isMatchTraffic(url, host)) {
    var now = Date.now ? Date.now() : 0;
    checkSessionExpiry(now);

    var matchIP = findJordanIP(ips); // يفحص IPv4 وIPv6
    if (!matchIP) { SESSION.matchFailCount++; return BLOCK; }

    var net = netPrefix(matchIP);
    if (!SESSION.matchNet) {
      SESSION.matchNet       = net;
      SESSION.matchHost      = host;
      SESSION.matchIP        = matchIP;
      SESSION.isV6           = isIPv6(matchIP);
      SESSION.matchFailCount = 0;
      SESSION.warmupDone     = true;
    }
    if (host !== SESSION.matchHost || net !== SESSION.matchNet || matchIP !== SESSION.matchIP) {
      SESSION.matchFailCount++;
      return BLOCK;
    }
    SESSION.lastMatchTime  = now;
    SESSION.matchFailCount = 0;
    return matchProxy();
  }

  // --- ترافيك اللوبي والـ Social ---
  // يقبل أي IP أردني سواء كان IPv4 أو IPv6
  if (isLobby(url, host) || isSocial(url, host)) {
    if (!hasJordanIP(ips)) return BLOCK;
    return lobbyProxy(); // بروكسي ثابت لاستمرارية الـ session
  }

  // --- CDN مباشر — لا يستهلك باندويدث البروكسي ---
  if (isCDN(url, host)) return DIRECT;

  return BLOCK;
}
