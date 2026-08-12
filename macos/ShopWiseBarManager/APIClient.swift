import Foundation

// MARK: - 공용 응답 모델 (서버 /api/v1 + /deals/public)

struct Overview: Decodable {
    let products: Int
    let devices: Int
    let watches: Int
    let pricePoints: Int
    let dailyStats: Int
    let alerts: Int
    let relations: Int
    let priced: Int
    let soldOut: Int

    enum CodingKeys: String, CodingKey {
        case products, devices, watches, alerts, relations, priced
        case pricePoints = "price_points"
        case dailyStats = "daily_stats"
        case soldOut = "sold_out"
    }
}

struct TrendDay: Decodable {
    let date: String
    let captures: Int
    let points: Int
    let new: Int
}

struct TrendResponse: Decodable {
    let days: [TrendDay]
}

struct MallStat: Decodable {
    let mall: String
    let products: Int
    let avgPrice: Double?
    let watchers: Int
    let priced: Int

    enum CodingKeys: String, CodingKey {
        case mall, products, watchers, priced
        case avgPrice = "avg_price"
    }
}

struct MallsResponse: Decodable {
    let malls: [MallStat]
}

struct CollectSource: Decodable {
    let source: String
    let count: Int
}

struct CollectResponse: Decodable {
    let sources: [CollectSource]
    let total: Int
    let lastCaptureAt: String?

    enum CodingKeys: String, CodingKey {
        case sources, total
        case lastCaptureAt = "last_capture_at"
    }
}

struct AlertItem: Decodable {
    let productId: String
    let alertType: String
    let price: Int
    let previousPrice: Int?
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case price
        case productId = "product_id"
        case alertType = "alert_type"
        case previousPrice = "previous_price"
        case createdAt = "created_at"
    }
}

struct AlertDistribution: Decodable {
    let type: String
    let count: Int
}

struct DropItem: Decodable {
    let productId: String
    let price: Int
    let previous: Int
    let dropPct: Double

    enum CodingKeys: String, CodingKey {
        case price, previous
        case productId = "product_id"
        case dropPct = "drop_pct"
    }
}

struct InsightResponse: Decodable {
    let alertDistribution: [AlertDistribution]
    let recentAlerts: [AlertItem]
    let topDrops: [DropItem]

    enum CodingKeys: String, CodingKey {
        case alertDistribution = "alert_distribution"
        case recentAlerts = "recent_alerts"
        case topDrops = "top_drops"
    }
}

// 핫딜 피드 (deals/public 재사용)
struct DealItem: Decodable, Identifiable {
    let productId: String
    let mall: String
    let name: String
    let price: Int
    let url: String?
    let lastPrice: Int?
    let dropRate: Double?

    var id: String { productId }

    enum CodingKeys: String, CodingKey {
        case mall, name, url
        case productId = "product_id"
        case price = "current_price"
        case lastPrice = "last_price"
        case dropRate = "drop_rate"
    }
}

struct DealsResponse: Decodable {
    let deals: [DealItem]
}

// MARK: - 크롤러 제어 (v0.16.0 서버 API)

struct CrawlerConfig: Decodable {
    let intervalSeconds: Int
    let enabled: Bool
    let runRequested: Bool
    let lastRunAt: String?

    enum CodingKeys: String, CodingKey {
        case intervalSeconds = "interval_seconds"
        case enabled
        case runRequested = "run_requested"
        case lastRunAt = "last_run_at"
    }
}

/// PUT /admin/crawler/config 요청 body (옵션 필드만 전송)
struct CrawlerConfigUpdate: Encodable {
    var intervalSeconds: Int?
    var enabled: Bool?

    enum CodingKeys: String, CodingKey {
        case intervalSeconds = "interval_seconds"
        case enabled
    }
}

struct CrawlerRunRequest: Decodable {
    let status: String
}

struct CrawlerLog: Decodable, Identifiable {
    let mall: String
    let success: Bool
    let count: Int
    let attempted: Int
    let failed: Int
    let gone: Int
    let error: String?
    let durationMs: Int
    let trigger: String
    let runAt: String

    var id: String { runAt + mall }

    enum CodingKeys: String, CodingKey {
        case mall, success, count, attempted, failed, gone, error, trigger
        case durationMs = "duration_ms"
        case runAt = "run_at"
    }

    /// 이전 배포(v0.16.0) 응답에는 attempted/failed 없음 → 0 기본값으로 호환 (v0.16.2, T-119)
    /// v0.16.8 (T-121) — gone/error 없으면 0/nil 기본값으로 호환
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        mall = try c.decode(String.self, forKey: .mall)
        success = try c.decode(Bool.self, forKey: .success)
        count = try c.decode(Int.self, forKey: .count)
        attempted = try c.decodeIfPresent(Int.self, forKey: .attempted) ?? count
        gone = try c.decodeIfPresent(Int.self, forKey: .gone) ?? 0
        error = try c.decodeIfPresent(String.self, forKey: .error)
        failed = try c.decodeIfPresent(Int.self, forKey: .failed) ?? max(0, attempted - count - gone)
        durationMs = try c.decode(Int.self, forKey: .durationMs)
        trigger = try c.decode(String.self, forKey: .trigger)
        runAt = try c.decode(String.self, forKey: .runAt)
    }
}

struct CrawlerLogsResponse: Decodable {
    let logs: [CrawlerLog]
}

// MARK: - P0 관리 고도화 (v0.16.15 서버 API)

struct ServerHealth: Decodable {
    let status: String
    let version: String
    let startedAt: String
    let dbOk: Bool
    let dbError: String?
    let lastCaptureAt: String?
    let lastCrawlerRunAt: String?

    enum CodingKeys: String, CodingKey {
        case status, version
        case startedAt = "started_at"
        case dbOk = "db"
        case dbError = "error"
        case lastCaptureAt = "last_capture_at"
        case lastCrawlerRunAt = "last_crawler_run_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        status = try c.decode(String.self, forKey: .status)
        version = try c.decode(String.self, forKey: .version)
        startedAt = try c.decode(String.self, forKey: .startedAt)
        lastCaptureAt = try c.decodeIfPresent(String.self, forKey: .lastCaptureAt)
        lastCrawlerRunAt = try c.decodeIfPresent(String.self, forKey: .lastCrawlerRunAt)
        let db = try c.nestedContainer(keyedBy: CodingKeys.self, forKey: .dbOk)
        dbOk = try db.decodeIfPresent(Bool.self, forKey: .dbOk) ?? true
        dbError = try db.decodeIfPresent(String.self, forKey: .dbError)
    }
}

struct CrawlerSummaryLast24h: Decodable {
    let runs: Int
    let success: Int
    let failed: Int
    let gone: Int
    let count: Int
    let avgDurationMs: Int

    enum CodingKeys: String, CodingKey {
        case runs, success, failed, gone, count
        case avgDurationMs = "avg_duration_ms"
    }
}

struct CrawlerSummaryRun: Decodable, Identifiable {
    let mall: String
    let success: Bool
    let count: Int
    let gone: Int
    let error: String?
    let durationMs: Int
    let trigger: String
    let runAt: String

    var id: String { runAt + mall }

    enum CodingKeys: String, CodingKey {
        case mall, success, count, gone, error, trigger
        case durationMs = "duration_ms"
        case runAt = "run_at"
    }
}

struct CrawlerSummary: Decodable {
    let hours: Int
    let last24h: CrawlerSummaryLast24h
    let lastRuns: [CrawlerSummaryRun]
    let staleProducts: Int

    enum CodingKeys: String, CodingKey {
        case hours
        case last24h = "last_24h"
        case lastRuns = "last_runs"
        case staleProducts = "stale_products"
    }
}

struct ProductTopItem: Decodable, Identifiable {
    let productId: String
    let mall: String
    let name: String?
    let url: String?
    let image: String?
    let lastPrice: Int?
    let soldOutAt: String?
    let backOnSaleAt: String?
    let lastCheckedAt: String?
    let priceCount: Int
    let watchCount: Int

    var id: String { productId }

    enum CodingKeys: String, CodingKey {
        case mall, name, url, image
        case productId = "product_id"
        case lastPrice = "last_price"
        case soldOutAt = "sold_out_at"
        case backOnSaleAt = "back_on_sale_at"
        case lastCheckedAt = "last_checked_at"
        case priceCount = "price_count"
        case watchCount = "watch_count"
    }
}

struct ProductsTopResponse: Decodable {
    let mostCollected: [ProductTopItem]
    let recent: [ProductTopItem]
    let soldOut: [ProductTopItem]
    let restocked: [ProductTopItem]

    enum CodingKeys: String, CodingKey {
        case mostCollected = "most_collected"
        case recent, soldOut, restocked
    }
}

// MARK: - P1 사용자 활동 (v0.16.15 서버 API)

struct AdminUser: Decodable, Identifiable {
    let deviceId: String
    let createdAt: String?
    let lastSeenAt: String?
    let active: Bool
    let watches: Int
    let captures: Int

    var id: String { deviceId }

    enum CodingKeys: String, CodingKey {
        case active, watches, captures
        case deviceId = "device_id"
        case createdAt = "created_at"
        case lastSeenAt = "last_seen_at"
    }
}

struct AdminUsersResponse: Decodable {
    let total: Int
    let active24h: Int
    let users: [AdminUser]

    enum CodingKeys: String, CodingKey {
        case total, users
        case active24h = "active_24h"
    }
}

// MARK: - P2 가격 동향 비교 (v0.16.15 서버 API)

struct PriceCompareRow: Decodable {
    let productId: String
    let mall: String
    let name: String?
    let price: Int
    let url: String?
    let diffPct: Double
    let isCheapest: Bool

    enum CodingKeys: String, CodingKey {
        case mall, name, price, url
        case productId = "product_id"
        case diffPct = "diff_pct"
        case isCheapest = "is_cheapest"
    }
}

struct PriceCompareGroup: Decodable, Identifiable {
    let normalizedName: String
    let name: String?
    let cheapestMall: String
    let cheapestPrice: Int
    let rows: [PriceCompareRow]

    var id: String { normalizedName }

    enum CodingKeys: String, CodingKey {
        case name, rows
        case normalizedName = "normalized_name"
        case cheapestMall = "cheapest_mall"
        case cheapestPrice = "cheapest_price"
    }
}

struct PriceCompareResponse: Decodable {
    let groups: [PriceCompareGroup]
    let totalGroups: Int

    enum CodingKeys: String, CodingKey {
        case groups
        case totalGroups = "total_groups"
    }
}

enum APIError: LocalizedError {
    case invalidURL
    case bad(String)
    case http(Int)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "잘못된 URL입니다."
        case let .bad(m): return m
        case let .http(code): return "서버 오류 (\(code))"
        }
    }
}

// MARK: - API 클라이언트

final class APIClient: @unchecked Sendable {
    /// 운영: https://shop-wisebar.onrender.com / 로컬: http://127.0.0.1:8000
    var serverOverride: String? {
        didSet { UserDefaults.standard.set(serverOverride, forKey: "admin.server.override") }
    }

    init() {
        serverOverride = UserDefaults.standard.string(forKey: "admin.server.override")
    }

    var baseURL: URL {
        if let o = serverOverride, !o.isEmpty, let u = URL(string: o) { return u }
        return URL(string: "https://shop-wisebar.onrender.com")!
    }

private func get<T: Decodable>(_ path: String, query: [URLQueryItem] = []) async throws -> T {
        var comps = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        comps.path += path
        if !query.isEmpty { comps.queryItems = query }
        guard let url = comps.url else { throw APIError.invalidURL }
        var req = URLRequest(url: url)
        req.timeoutInterval = 15
        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse else { throw APIError.invalidURL }
        guard (200 ..< 300).contains(http.statusCode) else {
            throw APIError.http(http.statusCode)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func put<T: Decodable>(_ path: String, body: (some Encodable)? = nil) async throws -> T {
        var comps = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        comps.path += path
        guard let url = comps.url else { throw APIError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = "PUT"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let body {
            req.httpBody = try JSONEncoder().encode(body)
        }
        req.timeoutInterval = 15
        let (data, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse else { throw APIError.invalidURL }
        guard (200 ..< 300).contains(http.statusCode) else {
            throw APIError.http(http.statusCode)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func post(_ path: String) async throws {
        var comps = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        comps.path += path
        guard let url = comps.url else { throw APIError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.timeoutInterval = 15
        let (_, resp) = try await URLSession.shared.data(for: req)
        guard let http = resp as? HTTPURLResponse, http.statusCode == 200 else {
            throw APIError.http((resp as? HTTPURLResponse)?.statusCode ?? -1)
        }
    }

    func overview() async throws -> Overview { try await get("/api/v1/admin/overview") }
    func trend(days: Int = 30) async throws -> TrendResponse {
        try await get("/api/v1/admin/trend", query: [URLQueryItem(name: "days", value: String(days))])
    }
    func malls() async throws -> MallsResponse { try await get("/api/v1/admin/malls") }
    func collect() async throws -> CollectResponse { try await get("/api/v1/admin/collect") }
    func insight(days: Int = 30) async throws -> InsightResponse {
        try await get("/api/v1/admin/insight", query: [URLQueryItem(name: "days", value: String(days))])
    }
    func deals() async throws -> DealsResponse { try await get("/api/v1/deals/public") }

    // MARK: P0 관리 고도화 (v0.16.15)

    func serverHealth() async throws -> ServerHealth {
        try await get("/api/v1/admin/health")
    }

    func crawlerSummary(hours: Int = 24) async throws -> CrawlerSummary {
        try await get("/api/v1/admin/crawler/summary",
                      query: [URLQueryItem(name: "hours", value: String(hours))])
    }

    func productsTop(limit: Int = 20) async throws -> ProductsTopResponse {
        try await get("/api/v1/admin/products/top",
                      query: [URLQueryItem(name: "limit", value: String(limit))])
    }

    // MARK: P1 사용자 활동 (v0.16.15)

    func adminUsers() async throws -> AdminUsersResponse {
        try await get("/api/v1/admin/users")
    }

    // MARK: P2 가격 동향 비교 (v0.16.15)

    func priceCompare(limit: Int = 30) async throws -> PriceCompareResponse {
        try await get("/api/v1/admin/price-compare",
                      query: [URLQueryItem(name: "limit", value: String(limit))])
    }

    // MARK: 크롤러 (v0.16.0)

    func crawlerConfig() async throws -> CrawlerConfig {
        try await get("/api/v1/admin/crawler/config")
    }

    func updateCrawlerConfig(_ body: CrawlerConfigUpdate) async throws -> CrawlerConfig {
        try await put("/api/v1/admin/crawler/config", body: body)
    }

    /// 즉시 수집 요청 — worker가 다음 틱(30초) 내 1배치 소비
    func requestCrawl() async throws {
        try await post("/api/v1/admin/crawler/run")
    }

    func crawlerLogs(limit: Int = 50) async throws -> CrawlerLogsResponse {
        try await get("/api/v1/admin/crawler/logs", query: [URLQueryItem(name: "limit", value: String(limit))])
    }
}