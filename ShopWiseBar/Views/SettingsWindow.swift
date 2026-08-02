// SettingsWindow.swift + SettingsView.swift — 설정 창 (P1: 갱신 주기/알림/브라우저)
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
    @ObservedObject private var settings = SettingsStore.shared
    @State private var intervalText = ""
    @State private var intervalApplied = false

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("설정")
                .font(.title2.bold())

            Group {
                intervalSection
                Divider()
                toggleSection
                Divider()
                browserSection
            }
            .font(.callout)

            Spacer()
        }
        .padding(24)
        .frame(width: 480, height: 360, alignment: .topLeading)
        .onAppear {
            intervalText = String(settings.refreshIntervalMinutes)
        }
        .onDisappear {
            settings.refreshIntervalMinutes = max(Int(intervalText) ?? 15, 1)
            RefreshScheduler.shared.restartIfNeeded()
        }
    }

    private var intervalSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("가격 갱신 주기", systemImage: "clock")
                .font(.headline)
            HStack(spacing: 6) {
                TextField("15", text: $intervalText)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 80)
                Text("분 (1~1440)")
                    .foregroundStyle(.secondary)
                Spacer()
                Text(intervalApplied ? "적용됨" : "변경 대기")
                    .font(.caption)
                    .foregroundStyle(intervalApplied ? Color.green : Color.secondary)
            }
        }
    }

    private var toggleSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("알림", systemImage: "bell")
                .font(.headline)
            Toggle("가격 하락 / 목표가 도달 시 알림", isOn: $settings.notificationsEnabled)
            Toggle("컬렉션 모드 (P2)", isOn: .constant(false))
                .disabled(true)
        }
    }

    private var browserSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("브라우저 감시 (P2)", systemImage: "safari")
                .font(.headline)
            Picker("사용 브라우저", selection: $settings.browserName) {
                Text("Google Chrome").tag("Google Chrome")
                Text("Safari").tag("Safari")
                Text("Whale (네이버 웨일)").tag("Whale")
            }
            .pickerStyle(.menu)
            .disabled(true)
            .help("P2에서 브라우저 탭 감시 기능이 활성화됩니다")
            Text("P1에서는 상품 주소를 복사해 팝오버에 붙여넣어 등록합니다.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }
}
