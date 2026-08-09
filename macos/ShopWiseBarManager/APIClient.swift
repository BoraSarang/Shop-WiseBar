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
    let durationMs: Int
    let trigger: String
    let runAt: String

    var id: String { runAt + mall }

    enum CodingKeys: String, CodingKey {
        case mall, success, count, attempted, failed, trigger
        case durationMs = "duration_ms"
        case runAt = "run_at"
    }

    /// 이전 배포(v0.16.0) 응답에는 attempted/failed 없음 → 0 기본값으로 호환 (v0.16.2, T-119)
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        mall = try c.decode(String.self, forKey: .mall)
        success = try c.decode(Bool.self, forKey: .success)
        count = try c.decode(Int.self, forKey: .count)
        attempted = try c.decodeIfPresent(Int.self, forKey: .attempted) ?? count
        failed = try c.decodeIfPresent(Int.self, forKey: .failed) ?? max(0, attempted - count)
        durationMs = try c.decode(Int.self, forKey: .durationMs)
        trigger = try c.decode(String.self, forKey: .trigger)
        runAt = try c.decode(String.self, forKey: .runAt)
    }
}

struct CrawlerLogsResponse: Decodable {
    let logs: [CrawlerLog]
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