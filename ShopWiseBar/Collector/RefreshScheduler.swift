// RefreshScheduler.swift — 백그라운드 가격 갱신 타이머 (T-13)
// 주기: SettingsStore.refreshIntervalMinutes, 실패 시 다음 주기 자동 재시도
// PLATFORM: macos
import Foundation

@MainActor
final class RefreshScheduler: ObservableObject {
    static let shared = RefreshScheduler()

    @Published private(set) var lastRefreshAt: Date?
    @Published private(set) var isRunning = false

    private var timer: Timer?
    private let coordinator = PriceFetchCoordinator.shared
    private let settings = SettingsStore.shared

    private init() {}

    func start() {
        guard timer == nil else { return }
        let timer = Timer(timeInterval: settings.refreshIntervalSeconds, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                await self?.run()
            }
        }
        RunLoop.main.add(timer, forMode: .common)
        self.timer = timer
        DebugLogger.shared.push(
            level: .SYSTEM,
            category: "SCHED",
            message: "갱신 스케줄러 시작",
            meta: ["interval_min": settings.refreshIntervalMinutes]
        )
        // 앱 시작 직후 첫 갱신
        Task { @MainActor [weak self] in
            await self?.run()
        }
    }

    func stop() {
        timer?.invalidate()
        timer = nil
        DebugLogger.shared.push(level: .SYSTEM, category: "SCHED", message: "갱신 스케줄러 중지")
    }

    /// 설정 변경 시 타이머 재설정
    func restartIfNeeded() {
        stop()
        start()
    }

    func runNow() async {
        await run()
    }

    private func run() async {
        guard !isRunning else { return }
        isRunning = true
        defer {
            isRunning = false
            lastRefreshAt = Date()
        }
        let start = DispatchTime.now()
        let result = await coordinator.refreshAll()
        let elapsedMs = Double(DispatchTime.now().uptimeNanoseconds - start.uptimeNanoseconds) / 1_000_000
        DebugLogger.shared.push(
            level: .PERF,
            category: "REFRESH",
            message: "refresh_all",
            meta: ["elapsed_ms": Int(elapsedMs), "updated": result.updated, "failed": result.failed]
        )
    }
}
