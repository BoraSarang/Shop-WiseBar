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

    // P0 관리 고도화 (v0.16.15)
    var serverHealth: ServerHealth?
    var crawlerSummary: CrawlerSummary?
    var productsTop: ProductsTopResponse?
    var healthState: LoadState = .idle
    var healthError: String?

    // P1 사용자 활동 (v0.16.15)
    var users: AdminUsersResponse?
    var priceCompare: PriceCompareResponse?
    var usersState: LoadState = .idle
    var usersError: String?

    // 서버 토글 (UserDefaults에 저장)
    var serverOverride: String {
        didSet {
            UserDefaults.standard.set(serverOverride, forKey: "admin.server.override")
            api.serverOverride = serverOverride.isEmpty ? nil : serverOverride
        }
    }

    // 로그인 시 자동 실행 (UserDefaults — SMAppService로 등록)
    var launchAtLogin: Bool {
        didSet {
            UserDefaults.standard.set(launchAtLogin, forKey: "admin.launch.at.login")
        }
    }

    // 로컬 배치 프로세스 (v0.16.16, T-127)
    private(set) var localBatchRunning = false
    private(set) var localBatchLog = "로컬 크롤러를 실행하면 로그가 여기에 표시됩니다."
    private var localBatchProcess: Process?

    enum LoadState: Equatable {
        case idle, loading, loaded, failed(String)
    }

    /// 탭 라우팅 섹션 — 디자인 리뉴얼: 9개 → 5개 통합 (v0.16.17)
    enum Section: String, CaseIterable, Identifiable {
        case overview = "개요"
        case status = "상태"
        case products = "상품"
        case crawler = "크롤러"
        case settings = "설정"

        var id: String { rawValue }

        var systemImage: String {
            switch self {
            case .overview: return "chart.bar"
            case .status: return "gauge"
            case .products: return "tag"
            case .crawler: return "gearshape.2"
            case .settings: return "gearshape"
            }
        }
    }

    var state: LoadState = .idle
    var errorMessage: String?

    private(set) var lastUpdated: Date?

    init() {
        serverOverride = UserDefaults.standard.string(forKey: "admin.server.override") ?? ""
        launchAtLogin = UserDefaults.standard.bool(forKey: "admin.launch.at.login")
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
        async let d: [DealItem]? = try? api.deals()

        overview = await o
        trend = await t
        malls = await m
        collect = await c
        insight = await i
        deals = await d ?? []
        lastUpdated = Date()
        state = .loaded
    }

    // MARK: P0 관리 고도화 (v0.16.15)

    /// 헬스 탭 — 서버 상태 + 크롤러 요약 + 수집 상품 TOP 병렬 로딩 (개별 실패 무시)
    func refreshHealth() async {
        healthState = .loading
        healthError = nil
        async let h: ServerHealth? = try? api.serverHealth()
        async let cs: CrawlerSummary? = try? api.crawlerSummary()
        async let pt: ProductsTopResponse? = try? api.productsTop()
        serverHealth = await h
        crawlerSummary = await cs
        productsTop = await pt
        if serverHealth == nil && crawlerSummary == nil && productsTop == nil {
            healthError = "서버 응답을 불러오지 못했습니다."
        }
        healthState = .loaded
    }

    // MARK: P1/P2 (v0.16.15)

    /// 사용자 탭 — 기기별 활동 + 가격 동향 비교 병렬 로딩
    func refreshUsers() async {
        usersState = .loading
        usersError = nil
        async let u: AdminUsersResponse? = try? api.adminUsers()
        async let pc: PriceCompareResponse? = try? api.priceCompare()
        users = await u
        priceCompare = await pc
        if users == nil && priceCompare == nil {
            usersError = "서버 응답을 불러오지 못했습니다."
        }
        usersState = .loaded
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

    // MARK: 로컬 배치 (v0.16.16, T-127)

    /// 로컬 크롤러 시작 (상시 루프) — Process로 run-local-crawler.sh 실행, stdout/stderr를 실시간 스트리밍
    func startLocalBatch() {
        guard !localBatchRunning else { return }
        do {
            let process = try Self.makeLocalCrawlerProcess { [weak self] text in
                Task { @MainActor in
                    self?.appendLocalLog(text)
                }
            }
            try process.run()
            localBatchProcess = process
            localBatchRunning = true
            localBatchLog = "로컬 크롤러 실행 중 (30초 틱 루프)\n"
        } catch {
            localBatchLog = "실행 실패: \(error.localizedDescription)\n"
        }
    }

    /// 로컬 크롤러 1회 실행 — run-local-crawler.sh --once (stdout 실시간 표시)
    func runLocalBatchOnce() async {
        guard !localBatchRunning else { return }
        localBatchLog = "1회 수집 시작…\n"
        do {
            let process = try Self.makeLocalCrawlerProcess(once: true) { [weak self] text in
                Task { @MainActor in
                    self?.appendLocalLog(text)
                }
            }
            try process.run()
            await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
                process.terminationHandler = { [weak self] _ in
                    Task { @MainActor in
                        self?.appendLocalLog("\n1회 수집 완료\n")
                    }
                    cont.resume()
                }
            }
        } catch {
            appendLocalLog("1회 수집 실패: \(error.localizedDescription)\n")
        }
    }

    /// 로컬 크롤러 중지 — terminate 후 SIGKILL 폴백
    func stopLocalBatch() {
        guard localBatchRunning, let process = localBatchProcess else { return }
        process.terminate()
        DispatchQueue.global().asyncAfter(deadline: .now() + 3) { [weak self] in
            let isStillRunning = self?.localBatchProcess?.isRunning ?? false
            if isStillRunning {
                kill(self?.localBatchProcess?.processIdentifier ?? -1, SIGKILL)
            }
            Task { @MainActor in
                self?.localBatchRunning = false
                self?.localBatchProcess = nil
                self?.appendLocalLog("\n로컬 크롤러 종료\n")
            }
        }
    }

    private func appendLocalLog(_ text: String) {
        if localBatchLog.count > 40_000 {  // 로그 뷰어 메모리 가드
            localBatchLog = String(localBatchLog.suffix(20_000))
        }
        localBatchLog += text
    }

    func clearLocalBatchLog() {
        localBatchLog = "로컬 크롤러 로그를 비웠습니다."
    }

    /// 로컬 크롤러 Process 생성 — stdout/stderr를 파이프로 연결해 실시간 로그 콜백
    private static func makeLocalCrawlerProcess(once: Bool = false,
                                                onOutput: @escaping @Sendable (String) -> Void) throws -> Process {
        let script = try Self.localCrawlerScriptURL()
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/bash")
        process.arguments = once ? [script.path, "--once"] : [script.path]

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe
        pipe.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            guard !data.isEmpty, let text = String(data: data, encoding: .utf8) else { return }
            onOutput(text)
        }
        return process
    }

    /// 프로젝트 루트의 scripts/run-local-crawler.sh 경로 탐색 (개발/배포 위치 모두 대응)
    private static func localCrawlerScriptURL() throws -> URL {
        let candidates = [
            URL(fileURLWithPath: NSHomeDirectory())
                .appendingPathComponent("Documents/Apps/Shop WiseBar/scripts/run-local-crawler.sh"),
            URL(fileURLWithPath: NSHomeDirectory())
                .appendingPathComponent("Applications/ShopWiseBarManager.app")
                .appendingPathComponent("Contents/Resources/scripts/run-local-crawler.sh"),
        ]
        for url in candidates {
            if FileManager.default.fileExists(atPath: url.path) {
                return url
            }
        }
        throw NSError(domain: "LocalBatch", code: 1,
                      userInfo: [NSLocalizedDescriptionKey: "run-local-crawler.sh를 찾지 못했습니다."])
    }
}