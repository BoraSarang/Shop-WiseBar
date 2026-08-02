// BrowserMonitor.swift — 브라우저 상품 페이지 감지 (T-20/21)
// Chrome/Whale 활성 탭 URL을 주기 폴링 → 지원 상품 페이지면 추적 제안
// 로그는 상태 변경(감지/해제) 시에만 — AGENTS.md 11.2 준수 (폴링 로깅 금지)
// PLATFORM: macos
import Foundation

@MainActor
final class BrowserMonitor {
    static let shared = BrowserMonitor()

    private let pollInterval: TimeInterval = 3
    private var task: Task<Void, Never>?
    private var lastURL: String?

    private init() {}

    func start() {
        guard task == nil else { return }
        task = Task { [weak self] in
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

    // MARK: - 폴링

    private func pollOnce() async {
        let browser = SettingsStore.shared.browserName
        guard browser != "Safari" else { return } // Safari는 AppleScript JS 설정 필요 — 추후 지원

        let url = await activeTabURL(browser: browser)
        guard let url else { return }
        guard url != lastURL else { return }

        lastURL = url
        if MallParser.parse(url) != nil {
            PopoverState.shared.suggestedURL = url
            DebugLogger.shared.push(
                level: .INFO,
                category: "MONITOR",
                message: "상품 페이지 감지",
                meta: ["browser": browser, "url": url]
            )
        } else {
            PopoverState.shared.clearSuggestion()
        }
    }

    private func activeTabURL(browser: String) async -> String? {
        let script = """
        tell application "\(browser)"
            try
                set u to URL of active tab of front window
                return u
            on error
                return ""
            end try
        end tell
        """
        do {
            let (output, _) = try await runAppleScript(script)
            let trimmed = output.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? nil : trimmed
        } catch {
            return nil
        }
    }

    private func runAppleScript(_ script: String) async throws -> (String, String) {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<(String, String), Error>) in
            Task.detached {
                let process = Process()
                process.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
                process.arguments = ["-e", script]
                let outPipe = Pipe()
                let errPipe = Pipe()
                process.standardOutput = outPipe
                process.standardError = errPipe
                do {
                    try process.run()
                    process.waitUntilExit()
                    let outData = outPipe.fileHandleForReading.readDataToEndOfFile()
                    let errData = errPipe.fileHandleForReading.readDataToEndOfFile()
                    let out = String(data: outData, encoding: .utf8) ?? ""
                    let err = String(data: errData, encoding: .utf8) ?? ""
                    cont.resume(returning: (out, err))
                } catch {
                    cont.resume(throwing: error)
                }
            }
        }
    }
}
