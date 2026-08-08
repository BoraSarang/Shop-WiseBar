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
}