// SettingsStore.swift — UserDefaults 기반 설정
// PLATFORM: macos
import Foundation

final class SettingsStore: ObservableObject {
    static let shared = SettingsStore()

    private enum Keys {
        static let refreshIntervalMinutes = "refreshIntervalMinutes"
        static let notificationsEnabled = "notificationsEnabled"
        static let browserName = "browserName"
    }

    private let defaults = UserDefaults.standard

    /// 가격 갱신 주기 (분). 기본 15분
    @Published var refreshIntervalMinutes: Int {
        didSet { defaults.set(refreshIntervalMinutes, forKey: Keys.refreshIntervalMinutes) }
    }

    /// 알림 활성화. 기본 true
    @Published var notificationsEnabled: Bool {
        didSet { defaults.set(notificationsEnabled, forKey: Keys.notificationsEnabled) }
    }

    /// 감시 브라우저 (P2 사용). 기본 Chrome
    @Published var browserName: String {
        didSet { defaults.set(browserName, forKey: Keys.browserName) }
    }

    private init() {
        refreshIntervalMinutes = defaults.object(forKey: Keys.refreshIntervalMinutes) as? Int ?? 15
        notificationsEnabled = defaults.object(forKey: Keys.notificationsEnabled) as? Bool ?? true
        browserName = defaults.string(forKey: Keys.browserName) ?? "Google Chrome"
    }

    var refreshIntervalSeconds: TimeInterval {
        TimeInterval(max(refreshIntervalMinutes, 1) * 60)
    }
}
