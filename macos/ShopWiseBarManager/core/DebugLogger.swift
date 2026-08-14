import Foundation
import Observation

/// 디버그 로그 레벨 (AGENTS.md 19장)
enum DebugLevel: String, CaseIterable {
    case debug
    case info
    case warn
    case error

    var displayName: String { rawValue.uppercased() }
}

/// 로그 항목
struct DebugEntry: Identifiable {
    let id = UUID()
    let timestamp: Date
    let level: DebugLevel
    let tag: String
    let message: String
}

/// 매니저 디버그 로거 — 메모리 링버퍼 + Cmd+Shift+D 패널 (AGENTS.md 19장 macOS 규격)
@MainActor
@Observable
final class DebugLogger {
    static let shared = DebugLogger()
    private(set) var entries: [DebugEntry] = []
    let maxEntries = 2000

    private let timeFormatter: DateFormatter

    private init() {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss.SSS"
        timeFormatter = f
    }

    func log(_ message: String, level: DebugLevel = .info, tag: String = "APP") {
        entries.append(DebugEntry(timestamp: Date(), level: level, tag: tag, message: message))
        if entries.count > maxEntries {
            entries.removeFirst(entries.count - maxEntries)
        }
    }

    /// 임의 스레드(APIClient 등)에서 호출 — 메인 액터로 전달
    nonisolated static func log(_ message: String, level: DebugLevel = .info, tag: String = "APP") {
        Task { @MainActor in
            DebugLogger.shared.log(message, level: level, tag: tag)
        }
    }

    func clear() {
        entries.removeAll()
    }

    func formatted(_ entry: DebugEntry) -> String {
        "\(timeFormatter.string(from: entry.timestamp)) [\(entry.level.displayName)] [\(entry.tag)] \(entry.message)"
    }
}
