// MenuBarController.swift — NSStatusItem 메뉴바 컨트롤러
// 좌클릭: 팝오버 / 우클릭: NSMenu (AGENTS.md 19.0: 메뉴 1순위)
// PLATFORM: macos
import AppKit
import SwiftUI

final class MenuBarController: NSObject {
    static let shared = MenuBarController()

    private var statusItem: NSStatusItem?
    private var popover: NSPopover?
    private var eventMonitor: Any?

    private override init() {
        super.init()
    }

    func start() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem = item

        if let button = item.button {
            button.image = NSImage(
                systemSymbolName: "chart.line.downtrend.xyaxis",
                accessibilityDescription: "Shop WiseBar (똑바)"
            )
            button.target = self
            button.action = #selector(statusItemClicked(_:))
            button.sendAction(on: [.leftMouseUp, .rightMouseUp])
        }

        configurePopover()
        installKeyMonitor()

        if let win = item.button?.window {
            DebugLogger.shared.push(
                level: .INFO,
                category: "MENU",
                message: "StatusItem 위치",
                meta: ["frame": NSStringFromRect(win.frame)]
            )
        }

        DebugLogger.shared.push(level: .ACTION, category: "MENU", message: "메뉴바 아이콘 활성화")

        // 디버그 자동화: 앱 시작 시 팝오버 자동 오픈 (외부 클릭 좌표 불필요)
        // 트리거: `defaults write com.borasarang.ShopWiseBar AutoOpenPopover -bool YES`
        #if DEBUG
        if UserDefaults.standard.bool(forKey: "AutoOpenPopover") {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
                self?.openPopover()
                DebugLogger.shared.push(level: .ACTION, category: "DEBUG", message: "자동화 모드: 팝오버 자동 오픈")
            }
        }
        #endif
    }

    // MARK: - Popover

    private func configurePopover() {
        let hosting = NSHostingController(rootView: PopoverRootView())
        let newPopover = NSPopover()
        newPopover.contentSize = NSSize(width: 380, height: 480)
        newPopover.contentViewController = hosting
        newPopover.behavior = .transient
        popover = newPopover
    }

    @objc private func statusItemClicked(_ sender: NSStatusBarButton) {
        if let win = sender.window {
            DebugLogger.shared.push(
                level: .INFO,
                category: "MENU",
                message: "StatusItem 클릭 위치",
                meta: ["frame": NSStringFromRect(win.frame)]
            )
        }
        // AXPress 등 합성 이벤트는 currentEvent가 nil일 수 있어 방어 처리
        if NSApp.currentEvent?.type == .rightMouseUp {
            showContextMenu(sender)
        } else {
            togglePopover()
        }
    }

    private func togglePopover() {
        guard let popover, let button = statusItem?.button else { return }
        if popover.isShown {
            popover.performClose(nil)
        } else {
            DebugLogger.shared.push(level: .ACTION, category: "MENU", message: "팝오버 열림")
            popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
            // LSUIElement 앱은 키보드 포커스가 다른 앱에 남아 있으므로 강제 활성화
            NSApp.activate(ignoringOtherApps: true)
            DispatchQueue.main.async {
                popover.contentViewController?.view.window?.makeKey()
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                DebugLogger.shared.push(
                    level: .INFO,
                    category: "MENU",
                    message: "팝오버 표시 상태 확인",
                    meta: ["isShown": popover.isShown, "buttonWindowVisible": button.window?.isVisible ?? false]
                )
            }
        }
    }

    // MARK: - Context Menu

    private func showContextMenu(_ sender: NSStatusBarButton) {
        popover?.performClose(nil)

        let menu = NSMenu()
        menu.addItem(makeItem("찜한 상품 관리", #selector(openWishlist(_:))))
        menu.addItem(makeItem("지금 상품 추가…", #selector(addProductNow(_:))))
        menu.addItem(makeItem("지금 갱신", #selector(refreshNow(_:))))
        menu.addItem(.separator())
        menu.addItem(makeItem("설정…", #selector(openSettings(_:))))
        menu.addItem(makeItem("Debug Panel", #selector(toggleDebugPanel)))
        menu.addItem(.separator())
        menu.addItem(makeItem("Shop WiseBar 정보…", #selector(showAbout(_:))))
        menu.addItem(makeItem("종료", #selector(terminateApp(_:))))

        DebugLogger.shared.push(level: .ACTION, category: "MENU", message: "컨텍스트 메뉴 열림")
        menu.popUp(positioning: nil, at: NSPoint(x: 0, y: sender.bounds.height + 4), in: sender)
    }

    private func makeItem(_ title: String, _ action: Selector, enabled: Bool = true) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: "")
        item.target = self
        item.isEnabled = enabled
        return item
    }

    /// 팝오버 열기 (우클릭 메뉴 → 찜한 상품 관리 등)
    @objc private func openPopover() {
        guard let popover, let button = statusItem?.button else { return }
        if popover.isShown { return }
        popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
        NSApp.activate(ignoringOtherApps: true)
        DispatchQueue.main.async {
            popover.contentViewController?.view.window?.makeKey()
        }
        DebugLogger.shared.push(level: .ACTION, category: "MENU", message: "팝오버 열림 (메뉴)")
    }

    // MARK: - Cmd+D 전역 키

    private func installKeyMonitor() {
        eventMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            let modifiers = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
            guard modifiers == .command, event.charactersIgnoringModifiers?.lowercased() == "d" else {
                return event
            }
            self?.toggleDebugPanel()
            return nil
        }
    }

    // MARK: - Actions

    @objc func toggleDebugPanel() {
        let willOpen = !DebugPanelWindow.shared.isVisible
        DebugLogger.shared.push(level: .ACTION, category: "DEBUG", message: willOpen ? "Debug Panel 열기" : "Debug Panel 닫기")
        DebugPanelWindow.shared.toggle()
    }

    @objc private func openWishlist(_ sender: Any?) {
        openPopover()
    }

    @objc private func addProductNow(_ sender: Any?) {
        Task { @MainActor in
            PopoverState.shared.requestAddFocus()
        }
        openPopover()
        DebugLogger.shared.push(level: .ACTION, category: "MENU", message: "상품 추가 모드 시작")
    }

    @objc private func refreshNow(_ sender: Any?) {
        DebugLogger.shared.push(level: .ACTION, category: "MENU", message: "메뉴에서 수동 갱신")
        Task { @MainActor in
            await RefreshScheduler.shared.runNow()
        }
    }

    @objc private func openSettings(_ sender: Any?) {
        DebugLogger.shared.push(level: .ACTION, category: "MENU", message: "설정 열기")
        SettingsWindow.shared.show()
    }

    @objc private func showAbout(_ sender: Any?) {
        NSApp.activate(ignoringOtherApps: true)
        NSApp.orderFrontStandardAboutPanel(nil)
    }

    @objc private func terminateApp(_ sender: Any?) {
        DebugLogger.shared.push(level: .SYSTEM, category: "APP", message: "메뉴에서 종료 요청")
        NSApp.terminate(nil)
    }
}
