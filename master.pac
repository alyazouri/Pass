// ============================================================
// PUBG MOBILE — Jordan Master PAC v4.0
// ✦ Merged: Script-1 + Script-2 (Blackbox 7.1) + Script-3 ✦
// ✦ Proxies: Script-1 (82.212.84.33 / 176.29.153.95)      ✦
// ✦ Full JO IPv4/IPv6 | Smart Session | Failover Chain     ✦
// ============================================================

// ═══════════════════════════════════════════════════════════
// PROXIES — Source: Script-1 (unchanged)
// ═══════════════════════════════════════════════════════════

var MATCH_PRIMARY   = "PROXY 82.212.84.33:20005";
var MATCH_SECONDARY = "PROXY 176.29.153.95:20005";
var LOBBY_POOL = [
  "PROXY 82.212.84.33:1080",
  "PROXY 176.29.153.95:443",
  "PROXY 46.185.131.218:443"
];
var BLOCK  = "PROXY 127.0.0.1:9";
var DIRECT = "DIRECT";

// ═══════════════════════════════════════════════════════════
// TIMING CONSTANTS
// ═══════════════════════════════════════════════════════════

var CACHE_TTL       = 600000;  // 10 min — DNS cache lifetime
var SESSION_TIMEOUT = 60000;   // 60 sec — match session window
var REGION_LOCK_TTL = 3600000; // 1 hr  — region lock lifetime
var RATE_WINDOW     = 5000;    // 5 sec  — rate-limit window
var RATE_LIMIT      = 200;     // max requests per window

// ═══════════════════════════════════════════════════════════
// SESSION STATE
// ═══════════════════════════════════════════════════════════

var SESSION = {
  matchIP:        null,
  matchHost:      null,
  matchMode:      null,
  matchNet:       null,
  matchTimestamp: 0,
  matchFailCount: 0,
  stickyProxy:    null,
  stickyExpiry:   0,
  regionLocked:   false,
  regionProxy:    null,
  regionExpiry:   0,
  dnsCache:       {},
  rateTracker:    {},
  connPool:       {}
};

// ═══════════════════════════════════════════════════════════
// IP HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════

function now() {
  return (Date.now ? Date.now() : new Date().getTime());
}

function isValidIPv4(ip) {
  if (!ip || typeof ip !== "string") return false;
  var p = ip.split(".");
  if (p.length !== 4) return false;
  for (var i = 0; i < p.length; i++) {
    if (!/^\d{1,3}$/.test(p[i])) return false;
    var n = parseInt(p[i], 10);
    if (n < 0 || n > 255) return false;
  }
  return true;
}

function isIPv6(ip) {
  return !!(ip && ip.indexOf(":") !== -1);
}

function ipToLong(ip) {
  var p = ip.split(".");
  return (
    ((parseInt(p[0], 10) << 24) |
     (parseInt(p[1], 10) << 16) |
     (parseInt(p[2], 10) << 8)  |
      parseInt(p[3], 10)) >>> 0
  );
}

function cidrToMask(bits) {
  return (~0 << (32 - bits)) >>> 0;
}

function netPrefix(ip) {
  if (isIPv6(ip)) return ip.split(":").slice(0, 3).join(":");
  return ip.split(".").slice(0, 3).join(".");
}

function isPrivateIP(ip) {
  if (!ip || isIPv6(ip)) return false;
  return (
    /^127\./.test(ip) ||
    /^10\./.test(ip)  ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) ||
    /^169\.254\./.test(ip) ||
    /^0\./.test(ip)
  );
}

// ═══════════════════════════════════════════════════════════
// JORDAN IPv4 RANGES — Merged from all 3 scripts
// Umniah | Linkdotnet | Orange/JDC | Batelco | Zain
// VTEL | Al-Mouakhah | JT PSC | Data Centers + Extended
// Format: [network_address, cidr_prefix_length]
// ═══════════════════════════════════════════════════════════

var JORDAN_IPV4 = [
  // ── Umniah ──
  ["5.45.128.0",    20], ["5.45.0.0",       16],
  ["46.23.112.0",   20], ["46.248.0.0",     16],
  ["46.248.192.0",  19], ["92.241.32.0",    19],
  ["95.172.192.0",  19], ["95.160.0.0",     15],
  ["109.107.224.0", 19], ["109.107.0.0",    16],
  ["149.200.128.0", 17], ["149.200.0.0",    16],
  ["149.255.0.0",   16], ["178.238.176.0",  20],

  // ── Linkdotnet-Jordan ──
  ["46.32.96.0",    19], ["46.32.0.0",      15],
  ["77.245.0.0",    20], ["77.245.0.0",     16],
  ["80.90.160.0",   19], ["94.142.32.0",    19],
  ["176.28.128.0",  17], ["176.29.0.0",     16],
  ["188.247.64.0",  19], ["188.247.0.0",    16],
  ["188.248.0.0",   14],

  // ── Orange Jordan / JDC ──
  ["37.202.64.0",   18], ["46.185.128.0",   17],
  ["46.185.0.0",    16], ["79.173.192.0",   18],
  ["79.173.0.0",    16], ["86.108.0.0",     17],
  ["86.108.0.0",    14], ["86.56.0.0",      16],
  ["92.253.0.0",    17], ["92.253.0.0",     16],
  ["94.249.0.0",    17], ["94.249.0.0",     16],
  ["193.188.64.0",  19], ["193.188.96.0",   19],
  ["194.165.128.0", 19], ["194.165.128.0",  17],
  ["213.186.160.0", 19], ["217.23.32.0",    20],
  ["212.34.0.0",    16], ["212.35.64.0",    18],
  ["212.35.128.0",  17], ["213.139.32.0",   19],
  ["213.139.64.0",  18], ["213.9.0.0",      16],

  // ── Batelco Jordan ──
  ["91.106.96.0",   20], ["91.186.224.0",   19],
  ["91.186.0.0",    16], ["212.118.0.0",    16],
  ["37.220.112.0",  20], ["37.220.0.0",     16],

  // ── Zain Jordan (AL-HADATHEH) ──
  ["81.28.112.0",   20], ["82.212.64.0",    18],
  ["82.212.128.0",  17], ["188.123.160.0",  19],
  ["82.205.0.0",    16],

  // ── VTEL Jordan ──
  ["62.72.160.0",   19], ["62.72.160.0",    19],
  ["81.21.0.0",     20], ["109.237.192.0",  20],
  ["176.57.0.0",    19], ["176.57.0.0",     16],
  ["176.57.48.0",   20], ["62.215.0.0",     16],

  // ── Al-Mouakhah ──
  ["37.17.192.0",   20], ["37.123.64.0",    19],
  ["37.123.0.0",    16], ["95.141.208.0",   20],
  ["178.77.128.0",  18], ["178.77.0.0",     16],

  // ── Jordan Telecom PSC ──
  ["217.144.0.0",   20], ["217.29.240.0",   20],
  ["193.227.0.0",   16], ["213.186.160.0",  19],

  // ── Network Exchange / Data Centers ──
  ["84.18.32.0",    19], ["84.18.64.0",     19],
  ["37.152.0.0",    21], ["79.134.128.0",   19],
  ["79.134.0.0",    16],

  // ── Extended JO Ranges (Script-2) ──
  ["37.44.0.0",     15], ["37.110.0.0",     16],
  ["37.252.0.0",    16], ["85.115.64.0",    18],
  ["85.115.128.0",  17], ["88.85.0.0",      17],
  ["88.85.128.0",   17], ["94.127.0.0",     16],
  ["78.139.0.0",    16], ["89.148.0.0",     16],
  ["178.253.0.0",   16], ["193.37.152.0",   22],
  ["212.37.0.0",    16], ["31.166.0.0",     15],
  ["31.222.0.0",    16], ["31.9.0.0",       16],
  ["46.34.0.0",     16], ["79.99.0.0",      16],
  ["79.142.0.0",    16], ["109.162.0.0",    15],
  ["178.16.0.0",    16], ["188.71.0.0",     16],
  ["5.0.0.0",       16], ["5.1.0.0",        16],
  ["5.62.0.0",      16], ["195.95.192.0",   19],
  ["195.74.128.0",  18], ["195.191.0.0",    16],
  ["141.164.0.0",   16], ["156.197.0.0",    16],
  ["160.177.0.0",   16], ["196.29.0.0",     16],
  ["196.205.0.0",   16], ["197.37.0.0",     16],

  // ── JO Hosting / Small ISPs (Script-2) ──
  ["185.117.68.0",  22], ["185.141.36.0",   22],
  ["185.181.112.0", 22], ["185.236.132.0",  22],
  ["185.40.4.0",    22], ["185.48.56.0",    22],
  ["185.56.108.0",  22], ["185.70.64.0",    22],
  ["185.82.148.0",  22], ["185.84.220.0",   22],
  ["185.98.78.0",   23], ["185.100.112.0",  22],
  ["185.105.0.0",   22], ["185.116.52.0",   22],
  ["185.124.144.0", 22], ["185.132.36.0",   22],
  ["185.136.192.0", 22], ["185.145.200.0",  22],
  ["185.155.20.0",  22], ["185.165.116.0",  22],
  ["185.168.172.0", 22], ["185.171.56.0",   22],
  ["185.175.124.0", 22], ["185.177.228.0",  22],
  ["185.179.8.0",   22], ["185.183.32.0",   22],
  ["185.188.48.0",  22], ["185.195.236.0",  22],
  ["185.199.72.0",  22], ["185.203.116.0",  22],
  ["185.217.172.0", 22], ["185.232.172.0",  22],
  ["185.244.20.0",  22], ["185.249.196.0",  22],
  ["193.109.56.0",  21], ["193.109.236.0",  22]
];

// ═══════════════════════════════════════════════════════════
// PUBG MIDDLE EAST SERVER RANGES (Script-2)
// ═══════════════════════════════════════════════════════════

var PUBG_ME_RANGES = [
  ["13.228.0.0",  14], ["18.136.0.0",  15],
  ["52.76.0.0",   15], ["47.252.0.0",  16],
  ["47.246.0.0",  16], ["149.130.0.0", 15],
  ["138.1.0.0",   16], ["20.174.0.0",  16],
  ["40.120.0.0",  15]
];

// ═══════════════════════════════════════════════════════════
// JORDAN IPv6 PREFIXES
// Script-1 (general) + Script-3 (Orange JO match servers)
// ═══════════════════════════════════════════════════════════

var JORDAN_IPV6_PREFIXES = [
  "2a00:18d0",  // Zain JO
  "2a00:18d8",  // Zain JO
  "2a01:9700",  // Orange JO (covers all sub-ranges below)
  "2a02:c040",  // Umniah
  "2a05:74c0",
  "2a04:2e00",  // Jordan Telecom
  "2a06:8ec0",
  "2001:41f0"   // Academic/Gov
];

// Orange JO /48 match server ranges (Script-3, most specific)
var MATCH_IPV6_PREFIXES = [
  "2a01:9700:4200:", "2a01:9700:4300:", "2a01:9700:3900:",
  "2a01:9700:4800:", "2a01:9700:4700:", "2a01:9700:4900:",
  "2a01:9700:4600:", "2a01:9700:4500:", "2a01:9700:4000:",
  "2a01:9700:4100:", "2a01:9700:4400:"
];

// Orange JO peer/infrastructure
var PEER_IPV6_PREFIXES = [
  "2a01:9700:1b05:", "2a01:9700:17e", "2a01:9700:1c"
];

// ═══════════════════════════════════════════════════════════
// KNOWN JO GAME HOST PREFIXES — Fast Path (Script-1)
// ═══════════════════════════════════════════════════════════

var KNOWN_JO_HOSTS = [
  "46.185.131", "176.29.153", "212.35.66",
  "176.28.128", "82.212.84",  "176.29.100",
  "86.108.",    "92.253.",    "94.249."
];

// ═══════════════════════════════════════════════════════════
// IP CLASSIFICATION FUNCTIONS
// ═══════════════════════════════════════════════════════════

function inIPv4Range(ip, ranges) {
  if (!isValidIPv4(ip)) return false;
  var target = ipToLong(ip);
  for (var i = 0; i < ranges.length; i++) {
    var network = ipToLong(ranges[i][0]);
    var mask    = cidrToMask(ranges[i][1]);
    if ((target & mask) === (network & mask)) return true;
  }
  return false;
}

function inIPv6Prefixes(ip, prefixes) {
  var low = ip.toLowerCase();
  for (var i = 0; i < prefixes.length; i++) {
    if (low.indexOf(prefixes[i]) === 0) return true;
  }
  return false;
}

function isJordanIP(ip) {
  if (!ip) return false;
  if (isIPv6(ip)) return inIPv6Prefixes(ip, JORDAN_IPV6_PREFIXES);
  return inIPv4Range(ip, JORDAN_IPV4);
}

function isMatchIPv6(ip) {
  return inIPv6Prefixes(ip, MATCH_IPV6_PREFIXES);
}

function isJordanPeerIPv6(ip) {
  return inIPv6Prefixes(ip, PEER_IPV6_PREFIXES);
}

function isMiddleEast(ip) {
  if (!isValidIPv4(ip)) return false;
  return inIPv4Range(ip, PUBG_ME_RANGES);
}

function isKnownJoHost(host) {
  for (var i = 0; i < KNOWN_JO_HOSTS.length; i++) {
    if (host.indexOf(KNOWN_JO_HOSTS[i]) !== -1) return true;
  }
  return false;
}

// Find best Jordanian IPv4 from an array of IPs
function findJordanIPv4(ips) {
  for (var i = 0; i < ips.length; i++) {
    if (!isIPv6(ips[i]) && inIPv4Range(ips[i], JORDAN_IPV4)) return ips[i];
  }
  return null;
}

// Find Jordanian IPv6
function findJordanIPv6(ips) {
  for (var i = 0; i < ips.length; i++) {
    if (isIPv6(ips[i]) && inIPv6Prefixes(ips[i], JORDAN_IPV6_PREFIXES)) return ips[i];
  }
  return null;
}

function findJordanIP(ips) {
  return findJordanIPv4(ips) || findJordanIPv6(ips);
}

function findMEIP(ips) {
  for (var i = 0; i < ips.length; i++) {
    if (!isIPv6(ips[i]) && isMiddleEast(ips[i])) return ips[i];
  }
  return null;
}

// ═══════════════════════════════════════════════════════════
// DNS RESOLUTION — Multi-method with TTL cache (Script-1)
// ═══════════════════════════════════════════════════════════

function resolveAll(host) {
  var t = now();
  var cached = SESSION.dnsCache[host];
  if (cached && (t - cached.time) < CACHE_TTL) return cached.ips;

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

  if (ips.length > 0) SESSION.dnsCache[host] = { ips: ips, time: t };
  return ips;
}

// ═══════════════════════════════════════════════════════════
// RATE LIMITER (Script-2)
// ═══════════════════════════════════════════════════════════

function checkRate(host) {
  var t   = now();
  var arr = SESSION.rateTracker[host] || [];
  var out = [];
  for (var i = 0; i < arr.length; i++) {
    if (t - arr[i] < RATE_WINDOW) out.push(arr[i]);
  }
  out.push(t);
  SESSION.rateTracker[host] = out;
  return out.length <= RATE_LIMIT;
}

// ═══════════════════════════════════════════════════════════
// TRAFFIC CLASSIFICATION — Detailed modes (Script-2 + Script-3)
// ═══════════════════════════════════════════════════════════

var MODES = {
  ANTICHEAT:
    /anticheat|security|verify|shield|ban|guard|protect|captcha|challenge|fair.?play|detection/i,

  MATCHMAKING:
    /matchmak|session.?create|session.?join|region.?select|player.?match|quickmatch|queue|ready|start.?match|spawn.?island|party.?join|roster|squad.?fill|pair|assign|recruit|dispatch/i,

  RANKED:
    /ranked|tier|points?|rating|mmr|conqueror|ace|crown|diamond|platinum|gold|silver|bronze|leaderboard|season.?rank|classic.?season|rank.?push/i,

  UNRANKED:
    /unranked|casual|normal|non.?ranked|fun.?match|event.?mode|arcade/i,

  COMBAT:
    /match|battle|classic|arena|war|payload|zombie|metro|tdm|fpp|tpp|domination|assault|gun.?game|infect|relay|gs\d|msdk|msf|msfp|sync|realtime|tick|frame|physics|movement|shoot|fire|hit|damage|dtls|rtp|srtp|ingame|gamesvr/i,

  LOBBY:
    /lobby|login|auth|region|gateway|session|profile|presence|voice|voip|turn|stun|signal/i,

  INVENTORY:
    /inventory|warehouse|vault|backpack|loadout|collection|showroom|outfit|wardrobe|gun.?skin|finish|material|item.?storage/i,

  STORE:
    /store|shop|\buc\b|\bag\b|crate|spin|draw|secret.?stash|mythic.?forge|royale.?pass|premium.?crate|redeem|bundle|coupon/i,

  EVENTS:
    /event|anniversary|card.?set|reward|mission|prize.?path|jujutsu|gojo|sukuna|ugc|world.?of.?wonder|\bwow\b|creator|map.?editor|wow.?dash|golden.?ticket/i,

  SOCIAL:
    /friend|invite|squad|party|clan|crew|social|chat|notify|push|broadcast|community|guild|looking.?for.?team|find.?teammate/i,

  CDN:
    /cdn|asset|patch|update|download|bundle|pak|obb|manifest|version|config|res|ota|static|media|content/i
};

function classify(url, host) {
  var input = (url + " " + host).toLowerCase();
  if (MODES.ANTICHEAT.test(input))   return "ANTICHEAT";
  if (MODES.MATCHMAKING.test(input)) return "MATCHMAKING";
  if (MODES.RANKED.test(input))      return "RANKED";
  if (MODES.UNRANKED.test(input))    return "UNRANKED";
  if (MODES.COMBAT.test(input))      return "COMBAT";
  if (MODES.LOBBY.test(input))       return "LOBBY";
  if (MODES.INVENTORY.test(input))   return "INVENTORY";
  if (MODES.STORE.test(input))       return "STORE";
  if (MODES.EVENTS.test(input))      return "EVENTS";
  if (MODES.SOCIAL.test(input))      return "SOCIAL";
  if (MODES.CDN.test(input))         return "CDN";
  return "UNKNOWN";
}

function isCritical(mode) {
  return mode === "MATCHMAKING" || mode === "RANKED" ||
         mode === "UNRANKED"    || mode === "COMBAT";
}

function isLobbyLike(mode) {
  return mode === "LOBBY"     || mode === "INVENTORY" ||
         mode === "STORE"     || mode === "EVENTS"    ||
         mode === "SOCIAL";
}

// ═══════════════════════════════════════════════════════════
// PUBG HOST DETECTION — Comprehensive (Script-2 + Script-1)
// ═══════════════════════════════════════════════════════════

function isPUBG(host) {
  return /pubg|tencent|krafton|lightspeed|levelinfinite|proxima|tencentgames|battlegrounds|pubgmobile|igamecj|vnggames|garena|pubgpartner|pubgesports|pubgstudio/i.test(host);
}

// ═══════════════════════════════════════════════════════════
// PROXY SELECTION
// ═══════════════════════════════════════════════════════════

function matchProxy() {
  // After 3 consecutive fails, promote secondary
  return (SESSION.matchFailCount >= 3) ? MATCH_SECONDARY : MATCH_PRIMARY;
}

function matchChain() {
  return MATCH_PRIMARY + "; " + MATCH_SECONDARY + "; " + DIRECT;
}

// Hash-based sticky lobby selection — same host always hits same proxy
function lobbyProxy(host) {
  var hash = 0;
  for (var i = 0; i < host.length; i++) {
    hash = ((hash << 5) - hash) + host.charCodeAt(i);
    hash |= 0;
  }
  return LOBBY_POOL[Math.abs(hash) % LOBBY_POOL.length];
}

// ═══════════════════════════════════════════════════════════
// SESSION / REGION LOCK / CONNECTION POOL
// ═══════════════════════════════════════════════════════════

function expireSession(t) {
  if (SESSION.matchTimestamp > 0 && (t - SESSION.matchTimestamp) > SESSION_TIMEOUT) {
    SESSION.matchIP        = null;
    SESSION.matchHost      = null;
    SESSION.matchMode      = null;
    SESSION.matchNet       = null;
    SESSION.matchTimestamp = 0;
    SESSION.matchFailCount = 0;
    SESSION.regionLocked   = false;
    SESSION.regionProxy    = null;
  }
}

function lockRegion(chain) {
  SESSION.regionLocked = true;
  SESSION.regionProxy  = chain;
  SESSION.regionExpiry = now() + REGION_LOCK_TTL;
}

function getRegionLocked() {
  if (SESSION.regionLocked && now() < SESSION.regionExpiry) return SESSION.regionProxy;
  SESSION.regionLocked = false;
  SESSION.regionProxy  = null;
  return null;
}

function getPooled(host) {
  var e = SESSION.connPool[host];
  if (e && (now() - e.time) < SESSION_TIMEOUT) return e.proxy;
  return null;
}

function setPooled(host, proxy) {
  SESSION.connPool[host] = { proxy: proxy, time: now() };
}

// Normalize host: strip port if present (e.g. host:443 → host)
function norm(h) {
  var colons = 0, last = -1;
  for (var i = 0; i < h.length; i++) {
    if (h[i] === ":") { colons++; last = i; }
  }
  return (colons === 1) ? h.substring(0, last) : h;
}

// ═══════════════════════════════════════════════════════════
// MAIN PROXY FUNCTION
// ═══════════════════════════════════════════════════════════

function FindProxyForURL(url, host) {
  try {
    host = norm(host.toLowerCase());

    // ── 1. Non-PUBG traffic → pass through ──
    if (!isPUBG(host)) return DIRECT;

    // ── 2. Rate guard ──
    if (!checkRate(host)) return DIRECT;

    // ── 3. CDN / patches → never proxy ──
    var mode = classify(url, host);
    if (mode === "CDN") return DIRECT;

    // ── 4. Anti-cheat → DIRECT (must reach Tencent directly) ──
    if (mode === "ANTICHEAT") return DIRECT;

    // ── 5. Active region lock (ongoing match) ──
    var locked = getRegionLocked();
    if (locked) return locked;

    // ── 6. Fast path: known Jordanian game servers ──
    if (isKnownJoHost(host)) {
      if (isCritical(mode)) {
        SESSION.matchTimestamp = now();
        SESSION.matchFailCount = 0;
        var fastChain = matchChain();
        lockRegion(fastChain);
        return fastChain;
      }
      return lobbyProxy(host);
    }

    // ── 7. DNS resolution ──
    var ips = resolveAll(host);
    var t   = now();
    expireSession(t);

    // ── 8. IPv6 Path ──
    var v6ip = null;
    for (var vi = 0; vi < ips.length; vi++) {
      if (isIPv6(ips[vi])) { v6ip = ips[vi]; break; }
    }

    if (v6ip) {
      if (isCritical(mode) && isMatchIPv6(v6ip)) {
        SESSION.matchIP        = v6ip;
        SESSION.matchHost      = host;
        SESSION.matchMode      = mode;
        SESSION.matchTimestamp = t;
        SESSION.matchFailCount = 0;
        var v6chain = matchChain();
        lockRegion(v6chain);
        return v6chain;
      }
      if (isLobbyLike(mode) && inIPv6Prefixes(v6ip, JORDAN_IPV6_PREFIXES)) {
        return lobbyProxy(host);
      }
      if (isJordanPeerIPv6(v6ip)) return lobbyProxy(host);
      if (inIPv6Prefixes(v6ip, JORDAN_IPV6_PREFIXES)) return lobbyProxy(host);
      return BLOCK;
    }

    // ── 9. No IPs resolved — pattern fallback ──
    if (!ips || ips.length === 0) {
      if (isCritical(mode)) {
        var fbChain = matchChain();
        lockRegion(fbChain);
        return fbChain;
      }
      if (isLobbyLike(mode)) return lobbyProxy(host);
      return BLOCK;
    }

    // ── 10. IPv4 Path ──
    var jordanIP = findJordanIPv4(ips);
    var meIP     = findMEIP(ips);
    var targetIP = jordanIP || meIP;

    // No Jordanian or ME IP → block
    if (!targetIP) {
      if (isCritical(mode) || isLobbyLike(mode)) {
        SESSION.matchFailCount++;
      }
      return BLOCK;
    }

    // Block private/loopback IPs
    if (isPrivateIP(targetIP)) return BLOCK;

    // ── 11. Critical / Combat mode ──
    if (isCritical(mode)) {
      var net = netPrefix(targetIP);

      if (!SESSION.matchNet) {
        // First match server — initialize session
        SESSION.matchNet       = net;
        SESSION.matchHost      = host;
        SESSION.matchIP        = targetIP;
        SESSION.matchMode      = mode;
        SESSION.matchTimestamp = t;
        SESSION.matchFailCount = 0;
      } else if (host !== SESSION.matchHost && net !== SESSION.matchNet) {
        // Different server network mid-session → suspicious, block
        SESSION.matchFailCount++;
        return BLOCK;
      }

      SESSION.matchTimestamp = t;
      SESSION.matchFailCount = 0;
      var critProxy = matchProxy();
      var critChain = critProxy + "; " + MATCH_SECONDARY + "; " + DIRECT;
      lockRegion(critChain);
      setPooled(host, critProxy);
      return critChain;
    }

    // ── 12. Matchmaking — full chain + region lock ──
    if (mode === "MATCHMAKING") {
      var mmChain = matchChain();
      setPooled(host, mmChain);
      lockRegion(mmChain);
      return mmChain;
    }

    // ── 13. Lobby-like traffic ──
    if (isLobbyLike(mode)) {
      var pl = getPooled(host);
      if (pl) return pl;
      var lp = lobbyProxy(host);
      setPooled(host, lp);
      return lp;
    }

    // ── 14. UNKNOWN with valid JO/ME IP — use lobby ──
    var pu = getPooled(host);
    if (pu) return pu;
    var up = lobbyProxy(host);
    setPooled(host, up);
    return up;

  } catch(e) {
    // Never crash the browser — silent fallback
    return DIRECT;
  }
}
