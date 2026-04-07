// ═══════════════════════════════════════════════════════════════════════════════
// 🇯🇴 JORDAN PROXY AUTO-CONFIG (PAC) SCRIPT
// 📱 iOS iPad Pro Compatible | PUBG Mobile 4.3 Traffic Engine
// ═══════════════════════════════════════════════════════════════════════════════
// Version: 2.0
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
// 🎮 PUBG MOBILE 4.3 - Match & Lobby Traffic Engine
// ═══════════════════════════════════════════════════════════════════════════════

var PUBGEngine = {
    // PUBG Mobile servers
    domains: [
        // Official PUBG Mobile
        /pubg\.mobile\.garena/i, /garena\.com/i, /garena\.co/i,
        
        // Tencent/Game servers
        /tencent\.com/i, /tencentcloud\.com/i, /qcloud\.com/i,
        /game\.pubg/i, /match\.pubg/i, /lobby\.pubg/i,
        
        // CDN
        /cdn\.tencent\.com/i, /cdn2\.tencent\.com/i, /cdn3\.tencent\.com/i,
        /cdn\.battlegames\.io/i, /game\.tencent\.com/i,
        
        // China Mobile (PUBG CN)
        /君子游戏/i, /\.cn/i,
        
        // Server IPs
        /^123\./, /^182\./, /^203\./, /^175\./
    ],
    
    // Game ports (for direct IP matching)
    ports: [8080, 843, 8001, 8002, 8003, 8004, 8005, 8006, 8007, 8008, 8009, 14000],
    
    isPUBG: function(host) {
        for (var i = 0; i < this.domains.length; i++) {
            try {
                if (this.domains[i].test(host)) return true;
            } catch(e) {}
        }
        return false;
    },
    
    getProxy: function() {
        return JordanProxy.getGamingChain();
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
// 🚀 MAIN FIND PROXY FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

function FindProxyForURL(url, host) {
    // ═══════════════════════════════════════════════════════════════════════════════
    // PRIORITY 1: PUBG MOBILE 4.3 - Match & Lobby (Lowest Latency Gaming)
    // ═══════════════════════════════════════════════════════════════════════════════
    if (PUBGEngine.isPUBG(host)) {
        return PUBGEngine.getProxy();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // PRIORITY 2: Jordan Hops Routes (explicit hops keyword in URL/host)
    // ═══════════════════════════════════════════════════════════════════════════════
    if (JordanHops.isHops(host)) {
        return JordanHops.getProxy();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // PRIORITY 3: Jordanian IPs (IPv4 ranges - registered & unregistered)
    // ═══════════════════════════════════════════════════════════════════════════════
    if (JordanIPs.isJordanian(host)) {
        return JordanProxy.getJordanChain();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // PRIORITY 4: Jordanian Domains (.jo TLD + Jordanian websites)
    // ═══════════════════════════════════════════════════════════════════════════════
    if (JordanDomains.isJordanian(host)) {
        return JordanProxy.getJordanChain();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // PRIORITY 5: Middle East (faster than Europe/Americas)
    // ═══════════════════════════════════════════════════════════════════════════════
    if (MiddleEast.isMiddleEast(host)) {
        return MiddleEast.getProxy();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // PRIORITY 6: Excluded distant regions (still route through Jordan proxy)
    // ═══════════════════════════════════════════════════════════════════════════════
    if (ExcludedRegions.isExcluded(host)) {
        return ExcludedRegions.getProxy();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════════
    // DEFAULT: All traffic through Jordan proxies (Jordan hops pool)
    // This ensures all routes go through Jordanian hops for lowest latency
    // ═══════════════════════════════════════════════════════════════════════════════
    return JordanProxy.getPrimaryChain();
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 UTILITY FUNCTIONS (iOS Compatible)
// ═══════════════════════════════════════════════════════════════════════════════

function isInJordan(host) {
    return JordanIPs.isJordanian(host) || JordanDomains.isJordanian(host);
}

function isPubgMobile(host) {
    return PUBGEngine.isPUBG(host);
}

function isExcludedRegion(host) {
    return ExcludedRegions.isExcluded(host);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🇯🇴 END OF JORDAN PAC SCRIPT
// Optimized for iOS iPad Pro | PUBG Mobile 4.3 | Jordan Hops Pool
// ═══════════════════════════════════════════════════════════════════════════════
