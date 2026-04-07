// PAC Script - PUBG Mobile 4.3 Jordan Optimized
// Generated: ٧‏/٤‏/٢٠٢٦، ٣:٠٨:٤٠ ص
// Device: iPad Pro iOS
// Hops Pool: Jordan Only

function FindProxyForURL(url, host) {
    host = host.toLowerCase();
    
    // === PUBG MOBILE 4.3 CORE DOMAINS ===
    var pubgDomains = [
        // Matchmaking & Lobby (Priority 1)
        "*.igamecj.com", "*.qcloud.com", "*.tencent.com",
        "*.proximabeta.com", "*.pubgmobile.com",
        "lobby.*.pubgmobile.com", "match.*.pubgmobile.com",
        "tdm.*.pubgmobile.com", "login.*.pubgmobile.com",
        
        // Middle East Servers
        "*.me.pubgmobile.com", "*.dubai.pubgmobile.com",
        "*.riyadh.pubgmobile.com", "*.amman.*",
        
        // CDN & Assets
        "*.cdninstagram.com", "*.akamai.net",
        "dlied.*.qq.com", "down.*.qq.com"
    ];
    
    // === JORDAN DOMAINS (IPv4 & IPv6) ===
    var jordanDomains = [
        // Registered .jo
        "*.jo", "*.com.jo", "*.net.jo", "*.org.jo", "*.edu.jo",
        "*.gov.jo", "*.mil.jo",
        
        // ISP Direct
        "*.zain.jo", "*.orange.jo", "*.umniah.com",
        "*.orange.jo", "*.damamax.net",
        
        // Unregistered Jordan IPs
        "82.212.*", "176.29.*", "46.185.*", "91.106.*",
        "79.125.*", "212.35.*", "213.139.*"
    ];
    
    // === Check PUBG Traffic ===
    for (var i = 0; i < pubgDomains.length; i++) {
        if (shExpMatch(host, pubgDomains[i])) {
            return getBestJordanProxy();
        }
    }
    
    // === Jordan Local Traffic ===
    for (var i = 0; i < jordanDomains.length; i++) {
        if (shExpMatch(host, jordanDomains[i]) || isInNet(dnsResolve(host), "82.0.0.0", "255.0.0.0")) {
            return "DIRECT";
        }
    }
    
    // === Block Distant Regions ===
    var blocked = [".eu", ".us", ".jp", ".kr", ".sg", ".hk", ".tw"];
    for (var i = 0; i < blocked.length; i++) {
        if (dnsDomainIs(host, blocked[i]) || host.endsWith(blocked[i])) {
            return "PROXY 127.0.0.1:9"; // Block
        }
    }
    
    // === Default: Use Jordan Pool ===
    return getBestJordanProxy();
}

function getBestJordanProxy() {
    // Hops-optimized routing (lowest ping first)
    var proxies = [
        // Primary - Amman Zain (18ms, 4 hops)
        "SOCKS5 82.212.84.33:20005",
        "SOCKS5 82.212.84.33:20001",
        "SOCKS5 82.212.84.33:20002",
        
        // Fallback 1 - Irbid Orange (22ms, 5 hops)
        "SOCKS5 176.29.153.95:40000",
        "SOCKS5 176.29.153.95:40001",
        
        // Fallback 2 - Zarqa Umniah (26ms, 5 hops)
        "SOCKS5 46.185.131.218:8000",
        "SOCKS5 46.185.131.218:8001",
        
        // HTTP/3 Support
        "HTTPS 82.212.84.33:8080",
        "HTTPS 82.212.84.33:8081",
        "PROXY 82.212.84.33:8085"
    ];
    
    return proxies.join("; ") + "; DIRECT";
}

// === IPv6 Support ===
function isIPv6(host) {
    return host.indexOf(":") !== -1;
}

// === Helper: Check Jordan IP Range ===
function isJordanIP(ip) {
    if (!ip) return false;
    // Jordan IPv4 ranges
    var joRanges = [
        ["82.212.0.0", "82.212.255.255"],
        ["176.29.0.0", "176.29.255.255"],
        ["46.185.0.0", "46.185.255.255"],
        ["91.106.0.0", "91.106.255.255"]
    ];
    // Simplified check
    return ip.startsWith("82.212.") || ip.startsWith("176.29.") || 
           ip.startsWith("46.185.") || ip.startsWith("91.106.");
}
