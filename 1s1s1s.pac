// =================================================================
//  PUBG Mobile — Jordan PAC  |  v3.0
//  المحرك: shExpMatch + dnsDomainIs (أسرع من regex بشكل ملحوظ)
//  الفلسفة: كل ترافيك الـ matchmaking يصل بـ IP أردني → أكبر pool
// =================================================================

// ================= PROXIES =================
var MATCH_A = "PROXY 82.212.84.33:20005";    // مباشر للمباراة
var MATCH_B = "PROXY 176.29.153.95:20005";   // احتياطي
var LOBBY   = "PROXY 82.212.84.33:1080";     // matchmaking + lobby + social
var DIRECT  = "DIRECT";

// ================= CORE DECISION =================
function FindProxyForURL(url, host) {

  // ── حذف البورت من الـ host
  host = host.toLowerCase();
  var b = host.lastIndexOf("]");
  var c = host.lastIndexOf(":");
  if (c > b) host = host.slice(0, c);

  // ── 1. سيرفرات المباراة الأردنية المؤكدة — أسرع مسار ممكن
  if (isJoMatchServer(host)) return pickMatch();

  // ── 2. نطاقات PUBG Mobile وناشريها — فحص بـ dnsDomainIs (أسرع من regex)
  if (!isPUBGDomain(host)) return DIRECT;

  // ── 3. CDN والتحديثات — مباشر، لا تستهلك الباندويدث للبروكسي
  if (isCDN(url, host)) return DIRECT;

  // ── 4. كل ما تبقى: lobby / matchmaking / social / friends / API
  //    البروكسي الأردني يُقدّم نفسه كـ IP أردني لسيرفرات PUBG
  //    → أكبر pool من اللاعبين الأردنيين
  return LOBBY;
}

// =================================================================
//  MATCH SERVER DETECTION
//  prefix سريع بدون DNS lookup أو IP range check
// =================================================================
var _jo = [
  "46.185.131.", "46.185.130.", "46.185.129.", "46.185.128.",
  "176.29.153.", "176.29.152.", "176.29.",
  "82.212.84.",  "82.212.85.",  "82.212.",
  "86.108.",     "92.253.",     "94.249.",
  "212.35.64.",  "212.35.65.",  "212.35.66.",
  "149.200.",    "178.77.",     "94.142.",
  "217.23.",     "193.188."
];

function isJoMatchServer(h) {
  for (var i = 0; i < _jo.length; i++) {
    if (h.indexOf(_jo[i]) === 0) return true;
  }
  return false;
}

// =================================================================
//  PUBG DOMAIN LIST — شامل لكل البنية التحتية
//  dnsDomainIs: مُحسَّن على مستوى المحرك، أسرع من indexOf أو regex
// =================================================================
function isPUBGDomain(h) {
  return (
    // PUBG / Krafton
    dnsDomainIs(h, "pubg.com")              ||
    dnsDomainIs(h, "pubgmobile.com")        ||
    dnsDomainIs(h, "krafton.com")           ||
    dnsDomainIs(h, "pubg.net")              ||

    // Level Infinite / Tencent Publishing
    dnsDomainIs(h, "levelinfinite.com")     ||
    dnsDomainIs(h, "lightspeedstudios.com") ||
    dnsDomainIs(h, "proxima-beta.com")      ||
    dnsDomainIs(h, "proximabeta.com")       ||
    dnsDomainIs(h, "igamecj.com")           ||

    // Tencent Infrastructure
    dnsDomainIs(h, "tencent.com")           ||
    dnsDomainIs(h, "tencentgames.com")      ||
    dnsDomainIs(h, "tencent-cloud.net")     ||
    dnsDomainIs(h, "tencentcs.com")         ||
    dnsDomainIs(h, "myqcloud.com")          ||
    dnsDomainIs(h, "qcloud.com")            ||
    dnsDomainIs(h, "qq.com")                ||

    // Southeast Asia Publishers
    dnsDomainIs(h, "garena.com")            ||
    dnsDomainIs(h, "garena.io")             ||
    dnsDomainIs(h, "vnggames.com")          ||

    // Relay / Game Infrastructure
    dnsDomainIs(h, "gmobiads.com")          ||
    dnsDomainIs(h, "sgamemo.com")           ||
    dnsDomainIs(h, "cubemaster.net")        ||
    dnsDomainIs(h, "pubgmstatic.com")
  );
}

// =================================================================
//  CDN DETECTION — على الـ URL وليس الـ host فقط
//  هذا يضمن دقة أعلى لأن بعض سيرفرات CDN تشارك نطاقات اللعبة
// =================================================================
function isCDN(url, h) {
  return (
    shExpMatch(url, "*/cdn/*")        ||
    shExpMatch(url, "*/asset*")       ||
    shExpMatch(url, "*/patch/*")      ||
    shExpMatch(url, "*/update/*")     ||
    shExpMatch(url, "*/download/*")   ||
    shExpMatch(url, "*/bundle/*")     ||
    shExpMatch(url, "*/manifest*")    ||
    shExpMatch(url, "*/obb/*")        ||
    shExpMatch(url, "*/pak/*")        ||
    shExpMatch(url, "*/resource*")    ||
    shExpMatch(url, "*/static/*")     ||
    shExpMatch(url, "*/texture*")     ||
    shExpMatch(h,   "*.dl.*")         ||
    shExpMatch(h,   "cdn.*")          ||
    shExpMatch(h,   "dl.*")           ||
    shExpMatch(h,   "*.cdn.*")        ||
    shExpMatch(h,   "download.*")     ||
    shExpMatch(h,   "patch.*")
  );
}

// =================================================================
//  MATCH PROXY FAILOVER — بسيط وسريع
// =================================================================
var _mf = 0, _mt = 0;

function pickMatch() {
  var now = Date.now ? Date.now() : 0;
  if (now - _mt > 20000) _mf = 0;   // reset بعد 20 ثانية
  _mt = now;
  return (_mf >= 2) ? MATCH_B : MATCH_A;
}
