// AlertPoller.swift — 서버 알림 폴링 (P5-T54)
// 수 분 주기로 서버 /alerts 조회 → 하락/목표가 도달 감지 시 로컬 알림
// 첫 폴링은 since=now (과거 이력 알림 방지), 이후엔 마지막 폴링 시각 저장
// AGENTS.md 11.2: 폴링 로깅 금지 — 상태 변화 시에만 로그
// PLATFORM: macos
import Foundation

@MainActor
final class AlertPoller {
    static let shared = AlertPoller()

    private let pollInterval: TimeInterval = 60
    private let lastPollKey = "lastAlertPollAt"
    private var task: Task<Void, Never>?

    private init() {}

    var lastPollAt: Date? {
        let interval = UserDefaults.standard.double(forKey: lastPollKey)
        return interval > 0 ? Date(timeIntervalSince1970: interval) : nil
    }

    func start() {
        guard task == nil else { return }
        task = Task { [weak self] in
            // 첫 폴링: 과거 가격 이력이 알림으로 쏟아지지 않도록 since=now로 시작
            if self?.lastPollAt == nil {
                UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: self?.lastPollKey ?? "")
            }
            try? await Task.sleep(nanoseconds: 10_000_000_000)
            while !Task.isCancelled {
                guard let self else { return }
                await self.pollOnce()
                try? await Task.sleep(nanoseconds: UInt64(self.pollInterval * 1_000_000_000))
            }
        }
    }

    func stop() {
        task?.cancel()
        task = nil
    }

    private func pollOnce() async {
        let since = lastPollAt
        do {
            let alerts = try await ServerClient.shared.getAlerts(since: since)
            for alert in alerts {
                await NotificationEngine.shared.notifyServerAlert(alert)
            }
            // 성공 시에만 폴링 시각 저장 (서버 오류 시 재시도 가능)
            UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: lastPollKey)
            if !alerts.isEmpty {
                DebugLogger.shared.push(
                    level: .INFO,
                    category: "ALERT",
                    message: "서버 알림 \(alerts.count)건",
                    meta: ["types": alerts.map(\.alert_type).joined(separator: ",")]
                )
            }
        } catch {
            DebugLogger.shared.push(
                level: .WARN,
                category: "ALERT",
                message: "알림 폴링 실패",
                meta: ["code": (error as? AppError)?.code ?? "unknown"]
            )
        }
    }
}
