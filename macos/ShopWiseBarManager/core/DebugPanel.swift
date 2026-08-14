import SwiftUI
import AppKit

/// 디버그 패널 — Cmd+Shift+D 토글 (AGENTS.md 19장: macOS NSWindow .floating)
@MainActor
final class DebugPanelController {
    static let shared = DebugPanelController()
    private var panel: NSPanel?
    private lazy var hosting = NSHostingController(rootView: DebugPanelView())

    var isVisible: Bool { panel?.isVisible ?? false }

    func toggle() {
        if isVisible {
            panel?.close()
        } else {
            show()
        }
    }

    func show() {
        if panel == nil {
            let p = NSPanel(
                contentRect: NSRect(x: 0, y: 0, width: 720, height: 520),
                styleMask: [.titled, .closable, .resizable],
                backing: .buffered,
                defer: false
            )
            p.title = "디버그 로그"
            p.level = .floating
            p.isReleasedWhenClosed = false
            p.minSize = NSSize(width: 560, height: 360)
            p.contentView = hosting.view
            panel = p
        }
        panel?.center()
        panel?.makeKeyAndOrderFront(nil)
    }
}

/// 디버그 로그 패널 뷰 — 레벨/텍스트 필터 + 자동 스크롤 + 전체 복사 + 지우기
struct DebugPanelView: View {
    @State private var logger: DebugLogger = .shared
    @State private var selectedLevel: DebugLevel? = nil
    @State private var filterText = ""
    @State private var autoScroll = true

    private var filtered: [DebugEntry] {
        logger.entries.filter { entry in
            if let l = selectedLevel, entry.level != l { return false }
            if !filterText.isEmpty, !entry.message.localizedCaseInsensitiveContains(filterText) { return false }
            return true
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            toolbar
            Divider()
            list
            Divider()
            footer
        }
        .frame(minWidth: 560, minHeight: 360)
    }

    private var toolbar: some View {
        HStack(spacing: DS.Space.s2) {
            Picker("레벨", selection: $selectedLevel) {
                Text("전체").tag(DebugLevel?.none)
                ForEach(DebugLevel.allCases, id: \.self) { lv in
                    Text(lv.displayName).tag(DebugLevel?.some(lv))
                }
            }
            .pickerStyle(.menu)
            .frame(width: 110)

            TextField("텍스트 필터", text: $filterText)
                .textFieldStyle(.roundedBorder)
                .frame(width: 160)

            Toggle("자동 스크롤", isOn: $autoScroll)
                .toggleStyle(.checkbox)
                .controlSize(.small)

            Spacer()

            Button {
                logger.clear()
            } label: {
                Label("지우기", systemImage: "trash")
            }
            .help("로그를 비우기")

            Button {
                let text = filtered.map { logger.formatted($0) }.joined(separator: "\n")
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(text, forType: .string)
            } label: {
                Label("전체 복사", systemImage: "doc.on.doc")
            }
            .help("필터된 로그를 클립보드에 복사")
        }
        .padding(DS.Space.s2)
    }

    private var list: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 2) {
                    ForEach(filtered) { entry in
                        row(entry)
                            .id(entry.id)
                    }
                }
                .padding(6)
            }
            .onChange(of: logger.entries.count) {
                if autoScroll, let last = filtered.last {
                    proxy.scrollTo(last.id, anchor: .bottom)
                }
            }
        }
        .background(Color(nsColor: .textBackgroundColor))
    }

    private func row(_ entry: DebugEntry) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(entry.level.displayName)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(levelColor(entry.level))
                .frame(width: 44, alignment: .leading)
            Text(logger.formatted(entry))
                .font(.system(size: 11, design: .monospaced))
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func levelColor(_ level: DebugLevel) -> Color {
        switch level {
        case .debug: .secondary
        case .info: .blue
        case .warn: .orange
        case .error: .red
        }
    }

    private var footer: some View {
        Text("총 \(logger.entries.count)건 · 표시 \(filtered.count)건")
            .font(.caption2)
            .foregroundStyle(.tertiary)
            .padding(.horizontal, DS.Space.s2)
            .padding(.vertical, 4)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}
