// DebugLogger.swift — 구조화 로거 8레벨 (AGENTS.md 19장 v1.9 확장)
// 포맷: [HH:mm:ss.SSS] [LEVEL] [PLATFORM] [CATEGORY] msg | meta={json}
// release: #if DEBUG 컴파일 타임 제거 + no-op 스텁
// PLATFORM: macos
#if DEBUG
import Combine
import Foundation

enum DebugLogLevel: String {
    case ACTION
    case API_REQ = "API→"
    case API_RES = "API←"
    case INFO
    case WARN
    case ERROR
    case SYSTEM
    case PERF
}

final class DebugLogger: ObservableObject {
    static let shared = DebugLogger()

    @Published private(set) var logs: [DebugLogEntry] = []
    private let maxLogs = 5000

    private let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss.SSS"
        return formatter
    }()

    struct DebugLogEntry: Identifiable {
        let id = UUID()
        let timestamp: String
        let level: DebugLogLevel
        let platform: String
        let category: String
        let message: String
        let meta: [String: Any]?

        var formatted: String {
            var metaText = ""
            if let meta, !meta.isEmpty {
                let parts = meta.sorted { $0.key < $1.key }.map { key, value -> String in
                    if key == "error_code" {
                        return "\"code\": \"\(value)\""
                    } else if let string = value as? String {
                        return "\"\(key)\": \"\(string)\""
                    } else {
                        return "\"\(key)\": \(value)"
                    }
                }
                metaText = " | meta={" + parts.joined(separator: ", ") + "}"
            }
            return "[\(timestamp)] [\(level.rawValue)] [\(platform)] [\(category)] \(message)\(metaText)"
        }
    }

    private init() {}

    func push(level: DebugLogLevel, category: String, message: String, meta: [String: Any]? = nil) {
        let entry = DebugLogEntry(
            timestamp: dateFormatter.string(from: Date()),
            level: level,
            platform: "macos",
            category: category,
            message: message,
            meta: meta
        )
        // print는 동기 출력 (종료 직전 로그 유실 방지), 배열 갱신만 main으로
        print(entry.formatted)
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            if self.logs.count >= self.maxLogs {
                self.logs.removeFirst(self.logs.count - self.maxLogs + 1)
            }
            self.logs.append(entry)
        }
    }

    func clear() {
        logs.removeAll()
    }
}

#else
import Combine
import Foundation

enum DebugLogLevel: String {
    case ACTION, API_REQ, API_RES, INFO, WARN, ERROR, SYSTEM, PERF
}

final class DebugLogger: ObservableObject {
    static let shared = DebugLogger()
    @Published private(set) var logs: [DebugLogEntry] = []

    struct DebugLogEntry: Identifiable {
        let id = UUID()
    }

    func push(level: DebugLogLevel, category: String, message: String, meta: [String: Any]? = nil) {}
    func clear() {}
}
#endif
