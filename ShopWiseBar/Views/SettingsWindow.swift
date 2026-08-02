// SettingsWindow.swift + SettingsView.swift — 설정 창 (P1~P2에서 실제 항목 채움)
// PLATFORM: macos
import AppKit
import SwiftUI

final class SettingsWindow: NSWindow {
    static let shared = SettingsWindow()

    private init() {
        super.init(
            contentRect: NSRect(x: 0, y: 0, width: 520, height: 400),
            styleMask: [.titled, .closable, .resizable],
            backing: .buffered,
            defer: false
        )
        title = "설정"
        isReleasedWhenClosed = false
        contentViewController = NSHostingController(rootView: SettingsView())
        center()
    }

    func show() {
        NSApp.activate(ignoringOtherApps: true)
        makeKeyAndOrderFront(nil)
    }
}

struct SettingsView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("설정")
                .font(.title2.bold())

            Text("브라우저 선택, 가격 갱신 주기, 알림 조건은 Phase 1~2에서 제공됩니다.")
                .font(.footnote)
                .foregroundStyle(.secondary)

            Divider()

            Label("브라우저 감시 (P2)", systemImage: "safari")
            Label("클립보드 감지 (P3)", systemImage: "doc.on.clipboard")
            Label("가격 갱신 주기 (P1)", systemImage: "clock")
            Label("알림 조건 (P1)", systemImage: "bell")
                .font(.callout)
                .foregroundStyle(.secondary)

            Spacer()
        }
        .padding(24)
        .frame(width: 480, height: 360, alignment: .topLeading)
    }
}
