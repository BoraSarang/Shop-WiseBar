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

    // 크롤러 화면 (v0.16.1)
    var crawlerConfig: CrawlerConfig?
    var crawlerLogs: [CrawlerLog] = []
    var crawlerState: LoadState = .idle
    var crawlerError: String?
    var crawlerBusy = false

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
        case crawler = "크롤러"

        var id: String { rawValue }

        var systemImage: String {
            switch self {
            case .dashboard: return "chart.bar"
            case .insight: return "lightbulb"
            case .stats: return "sum"
            case .deals: return "tag"
            case .collect: return "tray.and.arrow.down"
            case .crawler: return "gearshape.2"
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

    // MARK: 크롤러 (v0.16.1)

    /// 크롤러 설정 + 배치 이력 병렬 갱신
    func refreshCrawler() async {
        crawlerState = .loading
        crawlerError = nil
        async let c: CrawlerConfig? = try? api.crawlerConfig()
        async let l: CrawlerLogsResponse? = try? api.crawlerLogs()
        crawlerConfig = await c
        crawlerLogs = (await l)?.logs ?? []
        crawlerState = .loaded
    }

    /// 주기 변경 (초) — 서버 허용값 {3600,10800,21600,43200,86400}
    func setCrawlerInterval(_ seconds: Int) async {
        await applyCrawlerUpdate(CrawlerConfigUpdate(intervalSeconds: seconds))
    }

    /// 활성화 토글
    func toggleCrawlerEnabled(_ enabled: Bool) async {
        await applyCrawlerUpdate(CrawlerConfigUpdate(enabled: enabled))
    }

    private func applyCrawlerUpdate(_ patch: CrawlerConfigUpdate) async {
        crawlerError = nil
        do {
            crawlerConfig = try await api.updateCrawlerConfig(patch)
        } catch {
            crawlerError = error.localizedDescription
        }
        await refreshCrawler()
    }

    /// 즉시 수집 요청 → 이력 갱신
    func requestCrawl() async {
        guard !crawlerBusy else { return }
        crawlerBusy = true
        crawlerError = nil
        do {
            try await api.requestCrawl()
            await refreshCrawler()
        } catch {
            crawlerError = error.localizedDescription
        }
        crawlerBusy = false
    }
}