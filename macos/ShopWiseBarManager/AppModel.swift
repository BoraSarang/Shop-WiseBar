import Foundation
import Observation

/// 앱 전역 상태 — 서버 데이터 로딩 + 탭 라우팅. v0.15.0
@MainActor
@Observable
final class AppModel {
    static let shared = AppModel()

    let api = APIClient()

    // 화면별 데이터
    var overview: Overview?
    var trend: TrendResponse?
    var malls: MallsResponse?
    var collect: CollectResponse?
    var insight: InsightResponse?
    var deals: [DealItem] = []

    // 서버 토글 (UserDefaults에 저장)
    var serverOverride: String {
        didSet {
            UserDefaults.standard.set(serverOverride, forKey: "admin.server.override")
            api.serverOverride = serverOverride.isEmpty ? nil : serverOverride
        }
    }

    enum LoadState: Equatable {
        case idle, loading, loaded, failed(String)
    }

    /// 탭 라우팅 섹션
    enum Section: String, CaseIterable, Identifiable {
        case dashboard = "대시보드"
        case insight = "인사이트"
        case stats = "통계"
        case deals = "공통 핫딜"
        case collect = "수집"

        var id: String { rawValue }

        var systemImage: String {
            switch self {
            case .dashboard: return "chart.bar"
            case .insight: return "lightbulb"
            case .stats: return "sum"
            case .deals: return "tag"
            case .collect: return "tray.and.arrow.down"
            }
        }
    }

    var state: LoadState = .idle
    var errorMessage: String?

    private(set) var lastUpdated: Date?

    init() {
        serverOverride = UserDefaults.standard.string(forKey: "admin.server.override") ?? ""
    }

    var dataDescription: String {
        guard let o = overview else { return "아직 데이터 없음" }
        return "상품 \(o.products) · 찜 \(o.watches) · 가격포인트 \(o.pricePoints)"
    }

    var hasLoaded: Bool { state == .loaded }

    /// 전체 새로고침 — 각 엔드포인트를 병렬 호출, 개별 실패는 무시
    func refresh() async {
        state = .loading
        errorMessage = nil
        async let o: Overview? = try? api.overview()
        async let t: TrendResponse? = try? api.trend()
        async let m: MallsResponse? = try? api.malls()
        async let c: CollectResponse? = try? api.collect()
        async let i: InsightResponse? = try? api.insight()
        async let d: DealsResponse? = try? api.deals()

        overview = await o
        trend = await t
        malls = await m
        collect = await c
        insight = await i
        deals = (await d)?.deals ?? []
        lastUpdated = Date()
        state = .loaded
    }
}