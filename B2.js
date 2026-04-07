هذا السكربت كامل بعد التعديل، جاهز للاستخدام (مع إضافة نطاقات ببجي موبايل وتصنيف البورتات حسب وظيفتها):

```js
// ═══════════════════════════════════════════════════════════════════════════════
// 🇯🇴 JORDAN PROXY AUTO-CONFIG (PAC) SCRIPT
// 📱 iOS iPad Pro Compatible | PUBG Mobile 4.3 Traffic Engine
// ═══════════════════════════════════════════════════════════════════════════════
// Version: 2.0 (PUBG Domains + Port Classification)
// Priority: Jordan IPv4/IPv6 → PUBG Match/Lobby → Jordan Hops → Lowest Latency
// ═══════════════════════════════════════════════════════════════════════════════

var JordanProxy = {
    // SOCKS5 Proxies - Priority ordered by latency
    socks5: [
        "SOCKS5 82.212.84.33:20005",
        "SOCKS5 46.185.131.218:8000", 
        "SOCKS5 176.29.153.95:40000",
        "SOCKS5 91.106.109.50:30000",
        "SOCKS5 82.212.84.33:20001",
        "SOCKS5 176.29.153.95:40001",
        "SOCKS5 46.185.131.218:8001",
        "SOCKS5 82.212.84.33:20002"
    ],
    
    // HTTP/HTTP3 Proxies
    http: [
        "PROXY 82.212.84.33:8080",
        "PROXY 176.29.153.95:8081", 
        "PROXY 46.185.131.218:8085",
        "PROXY 91.106.109.50:8087",
        "PROXY 82.212.84.33:8088",
        "PROXY 176.29.153.95:8880"
    ],
    
    // Fallback
    direct: "DIRECT",
    
    // Get primary proxy chain (for failover)
    getPrimaryChain: function() {
        return this.socks5.slice(0, 3).join(";") + ";DIRECT";
    },
    
    // Get gaming optimized chain (PUBG)
    getGamingChain: function() {
        return "SOCKS5 82.212.84.33:20005;SOCKS5 46.185.131.218:8000;SOCKS5 176.29.153.95:40000;DIRECT";
    },
    
    // Get Jordan optimized chain
    getJordanChain: function() {
        return "SOCKS5 82.212.84.33:20005;SOCKS5 46.185.131.218:8000;DIRECT";
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🇯🇴 JORDANIAN IP RANGES (IPv4) - Registered & Unregistered
// AS Numbers: 20956 (Umniah), 24856 (Zain), 47832 (Orange), 50292 (Batelco), 41804 (Fastlink)
// ═══════════════════════════════════════════════════════════════════════════════

var JordanIPs = {
    // Full Jordan IP ranges (compact pattern matching)
    ranges: [
        // AS20956 - Umniah
        /^77\.69\./,
        /^77\.69\.(0|1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42|43|44|45|46|47|48|49|50|51|52|53|54|55|56|57|58|59|60|61|62|63)\./,
        
        // AS24856 - Zain Jordan
        /^95\.80\./,
        
        // AS47832 - Orange Jordan  
        /^212\.118\./,
        
        // AS50292 - Batelco Jordan
        /^149\.200\./,
        
        // AS41804 - Fastlink
        /^83\.242\./,
        /^84\.235\./,
        
        // Additional Jordan ISPs
        /^91\.192\./,
        /^94\.249\./,
        
        // Jordan Mobile ISPs
        /^176\.29\./,
        /^46\.185\./,
        /^91\.106\./,
        
        // Data Centers
        /^185\.243\./,
        /^185\.8\./,
        
        // More Jordan ranges
        /^197\.231\./,
        /^213\.27\./,
        /^217\.17\./,
        /^79\.173\./,
        /^178\.161\./
    ],
    
    // Quick prefix check
    prefixes: [
        "77.69.", "95.80.", "212.118.", "149.200.", 
        "83.242.", "84.235.", "91.192.", "94.249.",
        "176.29.", "46.185.", "91.106.", 
        "185.243.", "185.8.", "197.231.", 
        "213.27.", "217.17.", "79.173.", "178.161."
    ],
    
    isJordanian: function(host) {
        // Check prefix first (fast)
        for (var i = 0; i < this.prefixes.length; i++) {
            if (host.indexOf(this.prefixes[i]) === 0) return true;
        }
        // Check regex patterns
        for (var j = 0; j < this.ranges.length; j++) {
            try {
                if (this.ranges[j].test(host)) return true;
            } catch(e) {}
        }
        return false;
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🌍 JORDANIAN DOMAINS - .jo TLD + Jordanian websites
// ═══════════════════════════════════════════════════════════════════════════════

var JordanDomains = {
    patterns: [
        // Jordan TLD
        /\.jo$/i,
        
        // Government
        /\.gov\.jo$/i,
        
        // Banks
        /bankofjordan/i, /cbj\.gov\.jo/i, /arabbank/i, /housingbank/i,
        
        // Telecom
        /zain\.com/i, /orange\.jo/i, /umniah/i, /jawwal/i, /batelco/i,
        
        // Universities
        /ju\.edu\.jo/i, /hu\.edu\.jo/i, /psut\.edu\.jo/i, /ukh\.edu\.jo/i, /bau\.edu\.jo/i, /zu\.edu\.jo/i,
        
        // News
        /alghad/i, /jordantimes/i, /petra\.gov\.jo/i, /addustour/i, /khaberni/i,
        
        // Shopping
        /souq\.com/i, /jumia/i,
        
        // Local
        /amman\.jo/i, /irbid\.jo/i, /dawli\.jo/i,
        
        // Jordan companies pattern
        /\.net\.jo/i, /\.org\.jo/i, /\.edu\.jo/i, /\.com\.jo/i,
        
        // Jordan IP-based services (direct)
        /^77\.69\./, /^95\.80\./, /^212\.118\./, /^149\.200\./,
        /^83\.242\./, /^84\.235\./, /^91\.192\./, /^94\.249\./,
        /^176\.29\./, /^46\.185\./, /^91\.106\./, /^197\.231\./,
        /^185\.243\./, /^185\.8\./, /^213\.27\./, /^217\.17\./, /^79\.173\./
    ],
    
    isJordanian: function(host) {
        // Check .jo TLD first
        if (host.indexOf('.jo') !== -1) return true;
        
        // Check patterns
        for (var i = 0; i < this.patterns.length; i++) {
            try {
                if (this.patterns[i].test(host)) return true;
            } catch(e) {}
        }
        return false;
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎮 PUBG MOBILE 4.3 - Match & Lobby Traffic Engine (UPDATED)
// ═══════════════════════════════════════════════════════════════════════════════

var PUBGEngine = {
    // دومينات ببجي موبايل و السيرفرات المرتبطة فيها (مقسّمة تقريبياً حسب الوظيفة)
    domainGroups: {
        // الدومين الرسمي + كل السب دومينات
        core: [
            /pubgmobile\.com$/i     // pubgmobile.com, esports.pubgmobile.com, api.pubgmobile.com ...
        ],
        
        // نسخ Garena
        garena: [
            /pubg\.mobile\.garena/i,
            /garena\.com/i,
            /garenanow\.com/i,
            /garena\.co/i
        ],
        
        // بنية Tencent العامة اللي ببجي تعتمد عليها
        tencent: [
            /tencent\.com/i,
            /tencentcloud\.com/i,
            /qcloud\.com/i,
            /game\.tencent\.com/i,
            /msdk\.qq\.com/i,      // SDK تسجيل الدخول (تقدر تشيله لو حاب يكون DIRECT)
            /pubg\.qq\.com/i,
            /pubgm\.qq\.com/i
        ],
        
        // لومي/لوبي و خدمات مسابقات
        lobby: [
            /lobby\.pubg/i,
            /clubopen\.pubgmobile\.com/i,
            /esports\.pubgmobile\.com/i
        ],
        
        // ماتش / جيم بلاي
        match: [
            /game\.pubg/i,
            /match\.pubg/i
        ],
        
        // CDN (تنزيل ريسورس، مابات، أبديت)
        cdn: [
            /cdn\.pubgmobile\.com/i,
            /cdn\.tencent\.com/i,
            /cdn2\.tencent\.com/i,
            /cdn3\.tencent\.com/i,
            /cdn\.battlegames\.io/i,
            /gepubg\.akamaized\.net/i
        ],
        
        // النسخة الصينية / نطاقات .cn
        china: [
            /君子游戏/i,
            /\.cn$/i
        ]
    },
    
    // رينجات IP تستخدم كثير لسيرفرات تينسنت/ببجي (تقريبية)
    ipRanges: [
        /^123\./, /^182\./, /^203\./, /^175\./
    ],
    
    // بورتات ببجي موبايل مقسّمة تقريبياً حسب الوظيفة
    // (مبنية على قوائم بورتات منشورة للـ QoS والـ Port Forward، مش من تينسنت نفسها)
    portGroups: {
        // تحكّم / تسجيل دخول / Handshake (TCP غالباً)
        control: [10012, 17500, 18081],
        
        // بورتات ماتش أساسية (TCP/UDP)
        match: [
            7889,
            17000,
            20000, 20001, 20002
        ],
        
        // ترافك Real‑time في الجيم (حركة، إطلاق، إلخ) – رينجات UDP واسعة
        realtimeRanges: [
            { from: 10010, to: 10650 },
            { from: 11000, to: 14000 }
        ],
        
        // صوت داخل اللعبة
        voice: [8011, 9030],
        
        // HTTP(S)/CDN (تحميل موارد، تحديثات)
        cdn: [80, 443, 8080]
    },
    
    // تصنيف البورت حسب النوع (cdn / voice / control / match / realtime)
    getPortCategory: function(port) {
        if (!port || port <= 0) return null;
        
        // CDN / HTTP(S)
        if (this.portGroups.cdn.indexOf(port) !== -1) return "cdn";
        
        // Voice
        if (this.portGroups.voice.indexOf(port) !== -1) return "voice";
        
        // Control / Login
        if (this.portGroups.control.indexOf(port) !== -1) return "control";
        
        // Match بورتات ثابتة
        if (this.portGroups.match.indexOf(port) !== -1) return "match";
        
        // Real‑time ranges
        for (var i = 0; i < this.portGroups.realtimeRanges.length; i++) {
            var r = this.portGroups.realtimeRanges[i];
            if (port >= r.from && port <= r.to) return "realtime";
        }
        
        return null;
    },
    
    // هل الدومين/الهوست تابع لببجي (بدون ما ننظر للبورت)
    isPUBGHost: function(host) {
        if (!host) return false;
        
        for (var groupName in this.domainGroups) {
            if (!this.domainGroups.hasOwnProperty(groupName)) continue;
            var arr = this.domainGroups[groupName];
            for (var i = 0; i < arr.length; i++) {
                try {
                    if (arr[i].test(host)) return true;
                } catch (e) {}
            }
        }
        return false;
    },
    
    // فحص كامل: هوست + بورت (يفيد مع الـ IPs المباشرة)
    isPUBG: function(host, port) {
        if (!host) return false;
        
        // لو دومين معروف لببجي → نعتبره ببجي بغض النظر عن البورت
        if (this.isPUBGHost(host)) return true;
        
        // لو اللي واصل IP مباشر
        var isIpLike = /^\d+\.\d+\.\d+\.\d+$/.test(host);
        if (!isIpLike) return false;
        
        // يتأكد إنه ضمن رينجات الـ IP المعروفة
        var inRange = false;
        for (var i = 0; i < this.ipRanges.length; i++) {
            try {
                if (this.ipRanges[i].test(host)) {
                    inRange = true;
                    break;
                }
            } catch (e) {}
        }
        if (!inRange) return false;
        
        // لازم يكون البورت من بورتات ببجي المعروفة
        return this.getPortCategory(port) !== null;
    },
    
    // اختيار البروكسي بناءً على نوع البورت (حالياً كله على سلسلة الجيم، بس مرتب حسب الوظيفة)
    getProxy: function(port) {
        var cat = this.getPortCategory(port);
        
        switch (cat) {
            case "cdn":
                // لو حاب تفصل CDN على HTTP Proxy:
                // return JordanProxy.http[0] + ";DIRECT";
                return JordanProxy.getGamingChain();
            
            case "voice":
            case "realtime":
            case "match":
            case "control":
            default:
                // كل الترافك الحساس (ماتش/صوت/تحكم) على سلسلة الجيمينغ
                return JordanProxy.getGamingChain();
        }
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 JORDAN HOPS - Routes with hops keyword
// ═══════════════════════════════════════════════════════════════════════════════

var JordanHops = {
    patterns: [
        /hops/i, /hop/i,
        /jordan.*route/i, /route.*jordan/i,
        /jo.*gateway/i, /gateway.*jo/i,
        /amman.*ix/i, /jordan.*ix/i,
        /as\d+.*jo/i, /jo.*as\d+/i
    ],
    
    isHops: function(host) {
        for (var i = 0; i < this.patterns.length; i++) {
            try {
                if (this.patterns[i].test(host)) return true;
            } catch(e) {}
        }
        return false;
    },
    
    getProxy: function() {
        return "SOCKS5 82.212.84.33:20005;SOCKS5 176.29.153.95:40001;SOCKS5 91.106.109.50:30000;DIRECT";
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ❌ EXCLUDED REGIONS - Far from Jordan (Europe, Americas, Asia, Africa)
// ═══════════════════════════════════════════════════════════════════════════════

var ExcludedRegions = {
    // Europe (not Middle East)
    ranges: [
        /^4\./, /^5\./, /^8\./, /^9\./,
        /^77\./, /^78\./, /^79\./, /^81\./, /^85\./, /^90\./, /^91\./,
        /^92\./, /^93\./, /^94\./,
        /^109\./, /^185\./,
        /^193\./, /^194\./, /^195\./,
        
        // US
        /^1\./, /^6\./, /^7\./, /^10\./, /^11\./, /^12\./, /^13\./, /^14\./,
        /^15\./, /^16\./, /^17\./, /^18\./, /^19\./, /^20\./,
        /^128\./, /^129\./, /^130\./, /^131\./, /^132\./, /^133\./, /^134\./, /^135\./,
        /^136\./, /^137\./, /^138\./, /^139\./, /^140\./, /^142\./, /^143\./, /^144\./, /^145\./,
        /^146\./, /^147\./, /^148\./, /^149\./,
        /^160\./, /^161\./, /^162\./, /^163\./, /^164\./, /^165\./, /^166\./,
        /^173\./, /^174\./, /^184\./,
        /^198\./, /^199\./,
        /^204\./, /^205\./, /^206\./, /^207\./, /^208\./, /^209\./,
        
        // South America
        /^179\./, /^180\./, /^181\./, /^187\./, /^189\./, /^190\./, /^200\./, /^201\./,
        
        // Asia (far from Jordan)
        /^1\./, /^14\./, /^27\./, /^36\./, /^37\./, /^42\./, /^43\./, /^44\./,
        /^49\./, /^58\./, /^59\./, /^60\./, /^61\./, /^101\./, /^103\./, /^104\./,
        /^106\./, /^110\./, /^111\./, /^112\./, /^113\./, /^114\./, /^115\./, /^116\./,
        /^117\./, /^118\./, /^119\./, /^120\./, /^121\./, /^122\./, /^123\./, /^124\./,
        /^125\./, /^175\./, /^182\./, /^183\./, /^202\./, /^203\./, /^210\./, /^218\./,
        /^219\./, /^220\./, /^221\./, /^222\./, /^223\./,
        
        // Africa
        /^41\./, /^154\./, /^196\./, /^197\./, /^41\./, /^154\./
    ],
    
    isExcluded: function(host) {
        for (var i = 0; i < this.ranges.length; i++) {
            try {
                if (this.ranges[i].test(host)) return true;
            } catch(e) {}
        }
        return false;
    },
    
    // For excluded regions, still route through Jordan proxy (closest to Jordan)
    getProxy: function() {
        return "SOCKS5 82.212.84.33:20005;SOCKS5 176.29.153.95:40001;SOCKS5 46.185.131.218:8001;DIRECT";
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 MIDDLE EAST PRIORITY (closer to Jordan than Europe/US)
// ═══════════════════════════════════════════════════════════════════════════════

var MiddleEast = {
    domains: [
        /\.sa$/i, /\.ae$/i, /\.kw$/i, /\.qa$/i, /\.bh$/i, /\.om$/i,
        /\.eg$/i, /\.iq$/i, /\.ly$/i, /\.sy$/i, /\.lb$/i, /\.ps$/i,
        /\.ye$/i, /\.sd$/i, /\.tn$/i, /\.dz$/i, /\.ma$/i,
        /google\.com\.sa/i, /google\.com\.ae/i, /etisalat\.ae/i, /stc\.com\.sa/i,
        /mobily\.com\.sa/i, /zain\.sa/i
    ],
    
    isMiddleEast: function(host) {
        for (var i = 0; i < this.domains.length; i++) {
            try {
                if (this.domains[i].test(host)) return true;
            } catch(e) {}
        }
        return false;
    },
    
    getProxy: function() {
        return "SOCKS5 82.212.84.33:20001;SOCKS5 46.185.131.218:8000;SOCKS5 176.29.153.95:40000;DIRECT";
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 UTILITY: EXTRACT PORT FROM URL
// ═══════════════════════════════════════════════════════════════════════════════

function getPortFromURL(url) {
    if (!url) return 0;
    
    var lower = url.toLowerCase();
    var defaultPort = 0;
    
    if (lower.indexOf("https:") === 0) defaultPort = 443;
    else if (lower.indexOf("http:") === 0) defaultPort = 80;
    
    // protocol://host:port/...
    var parts = url.split("/");
    if (parts.length < 3) return defaultPort;
    
    var hostPort = parts[2]; // host[:port]
    if (!hostPort) return defaultPort;
    
    var colonIndex = hostPort.lastIndexOf(":");
    if (colonIndex === -1) return defaultPort;
    
    var p = parseInt(hostPort.substring(colonIndex + 1), 10);
    if (isNaN(p)) return defaultPort;
    
    return p;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 MAIN FIND PROXY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

function FindProxyForURL(url, host) {
    var port = getPortFromURL(url);

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIORITY 1: PUBG MOBILE 4.3 - Match & Lobby (Lowest Latency Gaming)
    // ═══════════════════════════════════════════════════════════════════════════
    if (PUBGEngine.isPUBG(host, port)) {
        return PUBGEngine.getProxy(port);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // PRIORITY 2: Jordan Hops Routes (explicit hops keyword in URL/host)
    // ═══════════════════════════════════════════════════════════════════════════
    if (JordanHops.isHops(host)) {
        return JordanHops.getProxy();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // PRIORITY 3: Jordanian IPs (IPv4 ranges - registered & unregistered)
    // ═══════════════════════════════════════════════════════════════════════════
    if (JordanIPs.isJordanian(host)) {
        return JordanProxy.getJordanChain();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // PRIORITY 4: Jordanian Domains (.jo TLD + Jordanian websites)
    // ═══════════════════════════════════════════════════════════════════════════
    if (JordanDomains.isJordanian(host)) {
        return JordanProxy.getJordanChain();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // PRIORITY 5: Middle East (faster than Europe/Americas)
    // ═══════════════════════════════════════════════════════════════════════════
    if (MiddleEast.isMiddleEast(host)) {
        return MiddleEast.getProxy();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // PRIORITY 6: Excluded distant regions (still route through Jordan proxy)
    // ═══════════════════════════════════════════════════════════════════════════
    if (ExcludedRegions.isExcluded(host)) {
        return ExcludedRegions.getProxy();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // DEFAULT: All traffic through Jordan proxies (Jordan hops pool)
    // This ensures all routes go through Jordanian hops for lowest latency
    // ═══════════════════════════════════════════════════════════════════════════
    return JordanProxy.getPrimaryChain();
}

// ═══════════════════════════════════════════════════════════════════════════════
/* 🔧 EXTRA UTILITY FUNCTIONS (optional for debugging / checks) */
// ═══════════════════════════════════════════════════════════════════════════════

function isInJordan(host) {
    return JordanIPs.isJordanian(host) || JordanDomains.isJordanian(host);
}

function isPubgMobile(host, url) {
    var port = url ? getPortFromURL(url) : 0;
    return PUBGEngine.isPUBG(host, port);
}

function isExcludedRegion(host) {
    return ExcludedRegions.isExcluded(host);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🇯🇴 END OF JORDAN PAC SCRIPT
// Optimized for iOS iPad Pro | PUBG Mobile 4.3 | Jordan Hops Pool
// ═══════════════════════════════════════════════════════════════════════════════
```

لو حاب نخصص سلاسل بروكسي مختلفة لكل نوع ترافك (مثلاً CDN على HTTP Proxy، الصوت على بروكسي معيّن، الماتش على أسرع واحد) أضبط لك سويتش `getProxy` داخل `PUBGEngine` حسب ترتيبك المفضل للسيرفرات.
