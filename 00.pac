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
var T_SESSION_IDLE  = 90000;
var T_SEARCH_MAX    = 90000;
var T_DNS_TTL       = 30000;
var T_CLASSIFY_TTL  = 20000;
var T_PROXY_DEAD    = 15000;

var THRESHOLD         = 12;
var MATCH_SCORE_FAST  = 18;
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
  return pool[idx];
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
    SESSION.proxyFails[proxy] = 0;
  }
}

function clearProxyFailure(proxy) {
  if (!proxy) return;
  SESSION.proxyFails[proxy] = 0;
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
  SESSION.failCount = 0;
  SESSION.backoffUntil = 0;
}

function isInBackoff(t) {
  return SESSION.backoffUntil > 0 && t < SESSION.backoffUntil;
}

// ─────────────────────────────────────────────
//  §7  TRAFFIC SCORING ENGINE
// ─────────────────────────────────────────────
var SCORE_MATCH = [
  ["udp",12],         ["tick",13],        ["sync",10],
  ["realtime",10],    ["battle",11],      ["combat",11],
  ["frame",12],       ["physics",13],     ["movement",12],
  ["shoot",13],       ["fire",11],        ["hit",11],
  ["damage",11],      ["relay",10],       ["dtls",14],
  ["rtp",14],         ["srtp",15],        ["stun",11],
  ["turn",9],         ["ice",8],
  ["gameserver",15],  ["gs.",14],         ["battleground",14],
  ["pubgmatch",16],   ["ingest",12],      ["dedicated",12],
  ["gamedata",13],    ["netgame",14],     ["livestate",13]
];

var SCORE_LOBBY = [
  ["lobby",16],       ["matchmak",16],    ["queue",13],
  ["dispatch",13],    ["gateway",11],     ["region",9],
  ["join",11],        ["recruit",12],     ["pair",12],
  ["assign",11],      ["roster",11],      ["rank",9],
  ["rating",9],       ["mmr",13],         ["elo",11],
  ["pool",10],        ["slot",10],        ["room",11],
  ["bracket",11],     ["wait",8],         ["search",10],
  ["find",9],         ["discover",12],    ["avail",9],
  ["jordan",14],      ["amman",12],       ["jo",10],
  ["matchserver",16], ["lobbyserver",16], ["playerlist",13],
  ["sessioncreate",15],["roommatch",14],  ["playerpool",14]
];

var SCORE_SOCIAL = [
  ["friend",9],   ["invite",9],   ["squad",10],
  ["party",10],   ["clan",9],     ["presence",9],
  ["voice",8],    ["chat",7],     ["notify",7],
  ["push",6],     ["broadcast",7],
  ["profile",8],  ["contact",8],  ["team",9]
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

function classifyTrafficFull(url, host) {
  var key = host + "|" + url.substring(0, 60);
  var t   = now();

  if (SESSION.classifyCache[key] && SESSION.classifyTTL[key] > t)
    return SESSION.classifyCache[key];

  var corpus  = url + " " + host;
  var sMatch  = computeScore(corpus, SCORE_MATCH);
  var sLobby  = computeScore(corpus, SCORE_LOBBY);
  var sSocial = computeScore(corpus, SCORE_SOCIAL);
  var sCDN    = computeScore(corpus, SCORE_CDN);

  if (sCDN >= 15 && sCDN > sMatch && sCDN > sLobby) {
    var r = ["CDN", sCDN];
    SESSION.classifyCache[key] = r;
    SESSION.classifyTTL[key]   = t + T_CLASSIFY_TTL;
    return r;
  }

  var max  = sMatch;
  var type = "MATCH";
  if (sLobby  > max) { max = sLobby;  type = "LOBBY";  }
  if (sSocial > max) { max = sSocial; type = "SOCIAL"; }
  if (sCDN    > max) { max = sCDN;    type = "CDN";    }

  var result = (max >= THRESHOLD) ? [type, max] : ["UNKNOWN", max];
  SESSION.classifyCache[key] = result;
  SESSION.classifyTTL[key]   = t + T_CLASSIFY_TTL;
  return result;
}

function classifyTraffic(url, host) {
  return classifyTrafficFull(url, host)[0];
}

function classifyScore(url, host) {
  return classifyTrafficFull(url, host)[1];
}

// ─────────────────────────────────────────────
//  §8  JORDAN RANGES ONLY
//  القرار كله مبني على النطاقات الأردنية فقط
// ─────────────────────────────────────────────
var JORDAN_IPV4_CIDR = [
  "2.59.52.0/22",
  "5.45.128.0/20",
  "5.198.240.0/21",
  "5.199.184.0/22",
  "37.17.192.0/20",
  "37.44.32.0/21",
  "37.75.144.0/21",
  "37.123.64.0/19",
  "37.152.0.0/21",
  "37.202.64.0/18",
  "37.220.112.0/20",
  "37.252.222.0/24",
  "45.142.196.0/22",
  "46.23.112.0/20",
  "46.32.96.0/19",
  "46.185.128.0/17",
  "46.248.192.0/19",
  "62.72.160.0/19",
  "77.245.0.0/20",
  "79.134.128.0/19",
  "79.173.192.0/18",
  "80.90.160.0/20",
  "81.21.0.0/20",
  "81.28.112.0/20",
  "82.212.64.0/18",
  "84.18.32.0/19",
  "84.18.64.0/19",
  "84.252.106.0/24",
  "85.159.216.0/21",
  "86.108.0.0/17",
  "87.236.232.0/21",
  "87.238.128.0/21",
  "89.20.49.0/24",
  "89.28.216.0/21",
  "89.38.152.0/23",
  "91.106.96.0/20",
  "91.132.100.0/24",
  "91.186.224.0/19",
  "91.209.248.0/24",
  "91.212.0.0/24",
  "91.220.195.0/24",
  "91.223.202.0/24",
  "92.241.32.0/19",
  "92.253.0.0/17",
  "93.93.144.0/21",
  "93.95.200.0/21",
  "93.115.2.0/24",
  "93.115.3.0/24",
  "93.115.15.0/24",
  "93.191.176.0/21",
  "94.127.208.0/21",
  "94.142.32.0/19",
  "94.249.0.0/17",
  "95.141.208.0/20",
  "95.172.192.0/19",
  "109.107.224.0/19",
  "109.237.192.0/20",
  "141.0.0.0/21",
  "141.98.64.0/22",
  "141.105.56.0/21",
  "146.19.239.0/24",
  "146.19.246.0/24",
  "149.200.128.0/17",
  "176.28.128.0/17",
  "176.29.0.0/16",
  "176.57.0.0/19",
  "176.57.48.0/20",
  "176.118.39.0/24",
  "176.241.64.0/21",
  "178.20.184.0/21",
  "178.77.128.0/18",
  "178.238.176.0/20",
  "185.10.216.0/22",
  "185.12.244.0/22",
  "185.14.132.0/22",
  "185.19.112.0/22",
  "185.24.128.0/22",
  "185.30.248.0/22",
  "185.33.28.0/22",
  "185.40.19.0/24",
  "185.43.146.0/24",
  "185.51.212.0/22",
  "185.57.120.0/22",
  "185.80.24.0/22",
  "185.80.104.0/22",
  "185.98.220.0/22",
  "185.98.224.0/22",
  "185.109.120.0/22",
  "185.109.192.0/22",
  "185.135.200.0/22",
  "185.139.220.0/22",
  "185.159.180.0/22",
  "185.160.236.0/22",
  "185.163.205.0/24",
  "185.173.56.0/22",
  "185.175.248.0/22",
  "185.176.44.0/22",
  "185.180.80.0/22",
  "185.182.136.0/22",
  "185.193.176.0/22",
  "185.197.176.0/22",
  "185.200.128.0/22",
  "185.234.111.0/24",
  "185.241.62.0/24",
  "185.253.112.0/22",
  "188.123.160.0/19",
  "188.247.64.0/19",
  "193.17.53.0/24",
  "193.108.134.0/23",
  "193.111.29.0/24",
  "193.188.64.0/19",
  "193.189.148.0/24",
  "193.203.24.0/23",
  "193.203.110.0/23",
  "194.104.95.0/24",
  "194.110.236.0/24",
  "194.165.128.0/19",
  "195.18.9.0/24",
  "212.34.0.0/19",
  "212.35.64.0/19",
  "212.118.0.0/19",
  "213.139.32.0/19",
  "213.186.160.0/19",
  "217.23.32.0/20",
  "217.29.240.0/20",
  "217.144.0.0/20"
];

var JORDAN_IPV6_PFX = [
  "2001:32c0",
  "2001:67c:2124",
  "2a00:18d0",
  "2a00:18d8",
  "2a00:4620",
  "2a00:76e0",
  "2a00:b860",
  "2a00:caa0",
  "2a01:1d0",
  "2a01:9700",
  "2a01:e240",
  "2a01:ee40",
  "2a02:9c0",
  "2a02:2558",
  "2a02:25d8",
  "2a02:5b60",
  "2a02:c040",
  "2a02:e680",
  "2a02:f0c0",
  "2a03:6b00",
  "2a03:6d00",
  "2a03:b640",
  "2a04:6200",
  "2a05:74c0",
  "2a05:7500",
  "2a06:9bc0",
  "2a06:bd80",
  "2a07:140",
  "2a0a:2740",
  "2a0c:39c0",
  "2a0d:cf40",
  "2a10:1100",
  "2a10:9740",
  "2a10:d800",
  "2a11:d180",
  "2a13:1f00",
  "2a13:5c00",
  "2a13:8d40",
  "2a14:1a40",
  "2a14:2840"
];

// Fast-path فقط، وليس أساس القرار
var KNOWN_JO_PREFIXES = [
  "46.185.131",
  "176.29.153",
  "212.35.66",
  "86.108.",
  "92.253.",
  "94.249.",
  "82.212.84",
  "81.28.11",
  "176.29.1",
  "176.28.",
  "94.142.",
  "46.185.13",
  "213.139."
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

function isIPv6(ip) {
  return ip.indexOf(":") !== -1;
}

function isIP(h) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(h) || h.indexOf(":") > -1;
}

function isIPv4(ip) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);
}

function ipToInt(ip) {
  var p = ip.split(".");
  return (((parseInt(p[0],10) << 24) >>> 0) |
          ((parseInt(p[1],10) << 16) >>> 0) |
          ((parseInt(p[2],10) << 8)  >>> 0) |
          (parseInt(p[3],10) >>> 0)) >>> 0;
}

function cidrMask(bits) {
  if (bits <= 0) return 0;
  if (bits >= 32) return 0xFFFFFFFF >>> 0;
  return (0xFFFFFFFF << (32 - bits)) >>> 0;
}

function isInCIDRv4(ip, cidr) {
  var parts = cidr.split("/");
  var base  = parts[0];
  var bits  = parseInt(parts[1], 10);
  var mask  = cidrMask(bits);
  return (ipToInt(ip) & mask) === (ipToInt(base) & mask);
}

function isInIPv6Prefix(ip, prefixList) {
  var s = ip.toLowerCase();
  for (var i = 0; i < prefixList.length; i++) {
    var p = prefixList[i].toLowerCase();
    if (s.indexOf(p) === 0) return true;
  }
  return false;
}

function isJordanIP(ip) {
  if (!ip) return false;

  if (isIPv6(ip)) {
    return isInIPv6Prefix(ip, JORDAN_IPV6_PFX);
  }

  if (isIPv4(ip)) {
    for (var i = 0; i < JORDAN_IPV4_CIDR.length; i++) {
      if (isInCIDRv4(ip, JORDAN_IPV4_CIDR[i])) return true;
    }
  }

  return false;
}

function isKnownJoHost(h) {
  for (var i = 0; i < KNOWN_JO_PREFIXES.length; i++) {
    if (h.indexOf(KNOWN_JO_PREFIXES[i]) !== -1) return true;
  }
  return false;
}

function isPUBG(h) {
  return /pubg|pubgm|pubgmobile|tencent|krafton|lightspeed|levelinfinite|igamecj|proximabeta|vnggames|garena|sgp\.gameops|sgp\.battleground/i.test(h);
}

function netPrefix(ip) {
  if (isIPv6(ip)) return ip.split(":").slice(0, 3).join(":");
  return ip.split(".").slice(0, 3).join(".");
}

// ─────────────────────────────────────────────
//  §10  DNS CACHE
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
  } catch (e) {}

  try {
    if (typeof dnsResolve === "function") {
      var v4 = dnsResolve(host);
      if (v4 && ips.indexOf(v4) === -1) ips.push(v4);
    }
  } catch (e) {}

  if (ips.length > 0) {
    SESSION.dnsCache[host] = ips;
    SESSION.dnsTTL[host]   = t + T_DNS_TTL;
  }

  return ips;
}

function firstJordanIP(ips) {
  for (var i = 0; i < ips.length; i++) {
    if (isJordanIP(ips[i])) return ips[i];
  }
  return null;
}

function hasJordanIP(ips) {
  return firstJordanIP(ips) !== null;
}

// ─────────────────────────────────────────────
//  §11  JORDAN DENSITY TRACKER
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
//  §12  SESSION MANAGER
// ─────────────────────────────────────────────
function now() {
  return (typeof Date !== "undefined" && Date.now) ? Date.now() : 0;
}

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
    SESSION.searchStartTime = t - (T_SEARCH_MAX - 30000);
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
}

function transitionTo(newState, t) {
  if (newState === STATE.SEARCHING && SESSION.state === STATE.IDLE) {
    SESSION.searchStartTime = t;
  }
  SESSION.state = newState;
}

// ─────────────────────────────────────────────
//  §13  PROXY SELECTION
// ─────────────────────────────────────────────
function selectLobbyProxy(host) {
  return pickAliveProxy(T2_LOBBY, host);
}

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
//  §14  CORE ROUTING
// ─────────────────────────────────────────────
function routeMatchTraffic(host, resolvedIP, score, t) {
  checkExpiry(t);
  if (isInBackoff(t)) return BLOCK;

  var ip  = resolvedIP || host;
  var net = netPrefix(ip);
  trackDensity(ip);

  if (!isJordanIP(ip) && !isKnownJoHost(host)) {
    return DIRECT;
  }

  if (SESSION.state === STATE.IDLE || SESSION.state === STATE.SEARCHING) {
    SESSION.matchNet  = net;
    SESSION.matchHost = host;
    SESSION.matchIP   = ip;
    SESSION.isV6      = isIPv6(ip);
    clearFailures();

    if (score >= MATCH_SCORE_FAST) {
      transitionTo(STATE.IN_GAME, t);
      return DIRECT;
    }

    transitionTo(STATE.MATCHED, t);
    return pickAliveProxy(T1_MATCH, host);
  }

  if (SESSION.state === STATE.MATCHED) {
    if (host === SESSION.matchHost || net === SESSION.matchNet) {
      transitionTo(STATE.IN_GAME, t);
      clearFailures();
      return DIRECT;
    }
    recordFailure();
    return BLOCK;
  }

  if (SESSION.state === STATE.IN_GAME) {
    clearFailures();
    return DIRECT;
  }

  return DIRECT;
}

function routeLobbyTraffic(host, t) {
  checkExpiry(t);
  if (SESSION.state === STATE.IDLE) transitionTo(STATE.SEARCHING, t);
  return selectLobbyProxy(host);
}

// ─────────────────────────────────────────────
//  §15  FindProxyForURL
//  القرار النهائي قائم على:
//  1) النطاقات الأردنية IPv4/IPv6
//  2) KNOWN_JO_PREFIXES كاختصار فقط
// ─────────────────────────────────────────────
function FindProxyForURL(url, host) {
  host = norm(host.toLowerCase());
  var t = now();
  tick(t);

  var directIP = isIP(host);

  if (directIP) {
    if (!isJordanIP(host)) return DIRECT;

    var classified = classifyTrafficFull(url, host);
    var ttype      = classified[0];
    var tscore     = classified[1];

    if (ttype === "CDN") return DIRECT;

    if (ttype === "MATCH") {
      return routeMatchTraffic(host, host, tscore, t);
    }

    if (ttype === "LOBBY" || ttype === "SOCIAL" || ttype === "UNKNOWN") {
      var forced = jordanLobbyForce(host, host, t);
      if (forced) return forced;
    }

    return routeLobbyTraffic(host, t);
  }

  if (!isPUBG(host)) return DIRECT;

  var classified = classifyTrafficFull(url, host);
  var ttype      = classified[0];
  var tscore     = classified[1];

  if (ttype === "CDN") return DIRECT;

  if (isKnownJoHost(host)) {
    SESSION.jordanIPSeen++;
    SESSION.totalIPSeen++;
    if (ttype === "MATCH") return routeMatchTraffic(host, null, tscore, t);
    return routeLobbyTraffic(host, t);
  }

  var ips = cachedResolve(host, t);

  if (!ips || ips.length === 0) {
    return DIRECT;
  }

  var bestIP = firstJordanIP(ips);

  if (ttype === "MATCH") {
    if (!bestIP) return DIRECT;
    return routeMatchTraffic(host, bestIP, tscore, t);
  }

  if (ttype === "LOBBY" || ttype === "SOCIAL" || ttype === "UNKNOWN") {
    if (bestIP) {
      var forced2 = jordanLobbyForce(bestIP, host, t);
      if (forced2) return forced2;
    }
    return DIRECT;
  }

  if (bestIP) return routeLobbyTraffic(host, t);

  return DIRECT;
}
