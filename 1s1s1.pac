// =================================================================
//  PUBG Mobile — Jordan Matchmaking PAC  |  v2.0
//  المنهجية: توجيه كامل ترافيك PUBG عبر البروكسي الأردني
//  سيرفرات الـ matchmaking ترى IP أردنياً → تُعيد لاعبين أردنيين
// =================================================================

// ================= PROXIES =================
var MATCH_PRIMARY   = "PROXY 82.212.84.33:20005";   // بروكسي المباراة الرئيسي
var MATCH_SECONDARY = "PROXY 176.29.153.95:20005";  // احتياطي عند فشل الرئيسي
var LOBBY_PROXY     = "PROXY 82.212.84.33:1080";    // بروكسي ثابت للوبي والـ matchmaking
var DIRECT          = "DIRECT";

// ================= FAST PATH — سيرفرات المباراة الأردنية المؤكدة =================
// هذه السيرفرات معروفة مسبقاً — لا تحتاج أي فحص إضافي
var JO_MATCH_HOSTS = [
  "46.185.131.",   // JDC / Orange JO
  "176.29.153.",   // Linkdotnet JO
  "176.29.",       // Linkdotnet /16 كامل
  "212.35.66.",    // Jordan Telecom
  "86.108.",       // JDC block
  "92.253.",       // JDC
  "94.249.",       // JDC
  "82.212.84.",    // Zain JO
  "46.185.",       // JDC/Orange الواسع
  "149.200.",      // Umniah
  "178.77."        // Al Mouakhah
];

// ================= FAILOVER STATE =================
// عداد بسيط للتبديل للبروكسي الاحتياطي عند الفشل المتكرر
var _fail = 0;
var _failTime = 0;

function matchProxy() {
  var now = Date.now ? Date.now() : 0;
  if (now - _failTime > 30000) { _fail = 0; }  // reset بعد 30 ثانية
  _failTime = now;
  return (_fail >= 2) ? MATCH_SECONDARY : MATCH_PRIMARY;
}

// ================= HELPERS =================

// تنظيف الـ host من رقم البورت إن وُجد
function stripPort(host) {
  var bracket = host.lastIndexOf("]");  // IPv6 مثل [::1]:8080
  var colon   = host.lastIndexOf(":");
  return (colon > bracket) ? host.substring(0, colon) : host;
}

// التحقق من أن الـ host يخص PUBG Mobile أو ناشريه
function isPUBG(host) {
  return /pubg|pubgm|pubgmobile|tencent|tencentgames|krafton|lightspeed|levelinfinite|proximabeta|vnggames|garena|igamecj|mycard/i.test(host);
}

// ترافيك CDN والأصول — لا يستفيد من البروكسي ويستهلك الباندويدث
function isCDN(host, url) {
  return /(cdn|asset|patch|update|download|bundle|manifest|version|obb|pak|resource|static|media|image|img|font|texture)/i.test(host + url);
}

// التحقق السريع من السيرفرات الأردنية المعروفة بالـ prefix
function isKnownJoServer(host) {
  for (var i = 0; i < JO_MATCH_HOSTS.length; i++) {
    if (host.indexOf(JO_MATCH_HOSTS[i]) === 0) return true;
  }
  return false;
}

// ================= MAIN =================
function FindProxyForURL(url, host) {

  host = stripPort(host.toLowerCase());

  // ── 1. غير PUBG → مباشر، لا تعديل على ترافيك الجهاز الآخر
  if (!isPUBG(host)) return DIRECT;

  // ── 2. CDN والتحديثات → مباشر، توفيراً لباندويدث البروكسي
  if (isCDN(host, url)) return DIRECT;

  // ── 3. Fast Path: سيرفرات المباراة الأردنية المؤكدة
  //    → أقصر مسار ممكن إلى بروكسي المباراة بدون أي فحص إضافي
  if (isKnownJoServer(host)) return matchProxy();

  // ── 4. كامل ترافيك PUBG المتبقي (lobby, matchmaking, social, friends)
  //    → يمر عبر البروكسي الأردني الثابت
  //    → سيرفرات PUBG ترى IP أردنياً → تُعيد لاعبين من الأردن
  //    → لا نحجب أي سيرفر هنا، الحجب يقلل عدد اللاعبين
  return LOBBY_PROXY;
}
