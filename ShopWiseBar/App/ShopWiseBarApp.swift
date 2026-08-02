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
        DebugLogger.shared.push(
            level: .SYSTEM,
            category: "APP",
            message: "Shop WiseBar (똑바) 시작",
            meta: ["version": "0.1.0", "platform": "macos"]
        )
    }

    func applicationWillTerminate(_ notification: Notification) {
        DebugLogger.shared.push(level: .SYSTEM, category: "APP", message: "Shop WiseBar 종료")
    }

    func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool {
        true
    }
}
