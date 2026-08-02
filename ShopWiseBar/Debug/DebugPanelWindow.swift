// DebugPanelWindow.swift — NSWindow 1회 생성·재사용 (AGENTS.md 19장)
// .floating+100, 600×320 중앙, 리사이즈 400~2000, 위치 기억은 P1에서
// release: no-op 스텁 (컴파일 타임 제거)
// PLATFORM: macos
#if DEBUG
import AppKit
import SwiftUI

final class DebugPanelWindow: NSWindow {
    static let shared = DebugPanelWindow()

    private init() {
        super.init(
            contentRect: NSRect(x: 0, y: 0, width: 600, height: 320),
            styleMask: [.titled, .closable, .resizable, .miniaturizable],
            backing: .buffered,
            defer: false
        )
        title = "Debug Panel"
        level = .floating + 100
        isReleasedWhenClosed = false
        minSize = NSSize(width: 400, height: 200)
        maxSize = NSSize(width: 2000, height: 2000)
        let hosting = NSHostingController(rootView: DebugPanelView())
        hosting.sizingOptions = []
        hosting.preferredContentSize = NSSize(width: 600, height: 320)
        contentViewController = hosting
        setContentSize(NSSize(width: 600, height: 320))
        center()
    }

    func show() {
        NSApp.activate(ignoringOtherApps: true)
        makeKeyAndOrderFront(nil)
    }

    func hide() {
        orderOut(nil)
    }

    func toggle() {
        isVisible ? hide() : show()
    }
}

#else
import AppKit

final class DebugPanelWindow: NSWindow {
    static let shared = DebugPanelWindow()

    private init() {
        super.init(contentRect: .zero, styleMask: [.borderless], backing: .buffered, defer: false)
    }

    func show() {}
    func hide() {}
    func toggle() {}
}
#endif
