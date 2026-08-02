// BrowserMonitor.swift — 브라우저 상품 페이지 감지 (T-20/21)
// Chrome/Whale 활성 탭 URL을 주기 폴링 → 지원 상품 페이지면 추적 제안
// 로그는 상태 변경(감지/해제) 시에만 — AGENTS.md 11.2 준수 (폴링 로깅 금지)
// PLATFORM: macos
import AppKit
import Foundation

@MainActor
final class BrowserMonitor {
    static let shared = BrowserMonitor()

    private let pollInterval: TimeInterval = 3
    private var task: Task<Void, Never>?
    private var lastURL: String?
    private var lastClipboardURL: String?

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
        // 갱신 중 브라우저 세션이 Chrome 탭을 만들고 닫음 — 자기 탭 감지 방지
        if RefreshScheduler.shared.isRunning { return }

        let browser = SettingsStore.shared.browserName
        if browser != "Safari" {
            let url = await activeTabURL(browser: browser)
            if let url {
                if url != lastURL {
                    lastURL = url
                    await updateSuggestion(from: url, source: "browser")
                }
                if MallParser.parse(url) != nil {
                    return // 브라우저가 상품 페이지 중 — 클립보드 제안 무시
                }
            }
        }

        // 브라우저가 비상품 페이지/미지원일 때 클립보드 감지 (P3)
        let clipboard = NSPasteboard.general.string(forType: .string) ?? ""
        if !clipboard.isEmpty && clipboard != lastClipboardURL {
            lastClipboardURL = clipboard
            await updateSuggestion(from: clipboard, source: "clipboard")
        }
    }

    private func updateSuggestion(from text: String, source: String) async {
        guard let parsed = MallParser.parse(text) else {
            PopoverState.shared.clearSuggestion()
            return
        }
        // P5-T53: 서버 조회 — 관심 상품이면 메뉴바 자동 팝오버, 아니면 추적 제안
        do {
            if let serverProduct = try await ServerClient.shared.getProduct(productID: parsed.productID) {
                if serverProduct.is_watched {
                    DebugLogger.shared.push(
                        level: .INFO,
                        category: "MONITOR",
                        message: "관심 상품 감지 — 팝오버 자동 표시",
                        meta: ["source": source, "productID": parsed.productID, "price": serverProduct.last_price ?? 0]
                    )
                    PopoverState.shared.autoShowProductID = parsed.productID
                    MenuBarController.shared.autoShowPopover()
                    return
                }
            }
        } catch {
            // 서버 오류 시 기존 추적 제안 유지 (캐치 기능은 로컬에서 계속 동작)
            DebugLogger.shared.push(
                level: .WARN,
                category: "SERVER",
                message: "상품 서버 조회 실패 — 로컬 제안으로 폴백",
                meta: ["code": (error as? AppError)?.code ?? "unknown"]
            )
        }
        PopoverState.shared.suggestedURL = text
        DebugLogger.shared.push(
            level: .INFO,
            category: "MONITOR",
            message: "상품 페이지 감지",
            meta: ["source": source, "url": text]
        )
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
