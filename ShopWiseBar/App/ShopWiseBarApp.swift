// ShopWiseBarApp.swift — 앱 진입점 (LSUIElement 메뉴바 앱)
// PLATFORM: macos
import AppKit
import SwiftUI

@main
struct ShopWiseBarApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        Settings {
            SettingsView()
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        MenuBarController.shared.start()
        NotificationEngine.shared.requestAuthorization()
        RefreshScheduler.shared.start()
        BrowserMonitor.shared.start()
        Task {
            // P5-T53: 앱 시작 시 익명 기기ID 발급 (서버 연동 전제)
            do {
                _ = try await ServerClient.shared.ensureDeviceID()
            } catch {
                DebugLogger.shared.push(
                    level: .WARN,
                    category: "SERVER",
                    message: "기기ID 발급 실패 — 서버 오프라인일 수 있음",
                    meta: ["code": (error as? AppError)?.code ?? "unknown"]
                )
            }
        }
        DebugLogger.shared.push(
            level: .SYSTEM,
            category: "APP",
            message: "Shop WiseBar (똑바) 시작",
            meta: ["version": "0.2.0", "platform": "macos"]
        )
    }

    func applicationWillTerminate(_ notification: Notification) {
        DebugLogger.shared.push(level: .SYSTEM, category: "APP", message: "Shop WiseBar 종료")
    }

    func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool {
        true
    }
}
