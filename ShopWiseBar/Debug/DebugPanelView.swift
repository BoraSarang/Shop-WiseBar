// DebugPanelView.swift — 순수 SwiftUI 로그 뷰 (NSTextView 금지, 30% 성능)
// 줄 선택(클릭=1줄, Cmd=토글), 📌 자동 스크롤, 선택/전체 복사, 클리어
// PLATFORM: macos
#if DEBUG
import AppKit
import SwiftUI

struct DebugPanelView: View {
    @ObservedObject private var logger = DebugLogger.shared
    @State private var autoScroll = true
    @State private var selectedIDs: Set<UUID> = []

    var body: some View {
        VStack(spacing: 0) {
            toolbar
            Divider()
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(logger.logs) { entry in
                            row(for: entry)
                                .id(entry.id)
                        }
                    }
                    .padding(.vertical, 4)
                }
                .onChange(of: logger.logs.last?.id) { _, newID in
                    guard autoScroll, let id = newID else { return }
                    withAnimation(.linear(duration: 0.15)) {
                        proxy.scrollTo(id, anchor: .bottom)
                    }
                }
            }
        }
        .frame(minWidth: 400, minHeight: 240)
        .background(Color(nsColor: .windowBackgroundColor))
    }

    // MARK: - Row

    private func row(for entry: DebugLogger.DebugLogEntry) -> some View {
        Text(entry.formatted)
            .font(.system(size: 11, design: .monospaced))
            .foregroundStyle(levelColor(entry.level))
            .textSelection(.enabled)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 6)
            .padding(.vertical, 1)
            .background(selectedIDs.contains(entry.id) ? Color.accentColor.opacity(0.3) : Color.clear)
            .contentShape(Rectangle())
            .onTapGesture {
                toggleSelection(entry.id)
            }
    }

    // MARK: - Toolbar

    private var toolbar: some View {
        HStack(spacing: 8) {
            Button {
                autoScroll.toggle()
            } label: {
                Label("자동 스크롤", systemImage: autoScroll ? "pin.fill" : "pin")
            }
            .help("자동 스크롤 토글 (📌)")

            Spacer()

            Button {
                copySelection()
            } label: {
                Label("선택 복사", systemImage: "doc.on.doc")
            }
            .keyboardShortcut("c", modifiers: [.command, .shift])
            .help("선택된 줄 복사 (Cmd+Shift+C)")

            Button {
                copyAll()
            } label: {
                Label("전체 복사", systemImage: "doc.on.doc.fill")
            }
            .keyboardShortcut("a", modifiers: [.command, .shift])
            .help("전체 로그 복사 (Cmd+Shift+A) — 에이전트용")

            Button {
                logger.clear()
            } label: {
                Label("지우기", systemImage: "trash")
            }
            .keyboardShortcut("k", modifiers: .command)
            .help("로그 지우기 (Cmd+K)")

            Button {
                DebugPanelWindow.shared.hide()
            } label: {
                Label("닫기", systemImage: "xmark")
            }
        }
        .buttonStyle(.borderless)
        .padding(6)
    }

    // MARK: - Selection & Copy

    private func toggleSelection(_ id: UUID) {
        if NSEvent.modifierFlags.contains(.command) {
            if selectedIDs.contains(id) {
                selectedIDs.remove(id)
            } else {
                selectedIDs.insert(id)
            }
        } else {
            selectedIDs = [id]
        }
    }

    private func copySelection() {
        let selected = logger.logs.filter { selectedIDs.contains($0.id) }
        copyText(selected.map(\.formatted).joined(separator: "\n"))
    }

    private func copyAll() {
        copyText(logger.logs.map(\.formatted).joined(separator: "\n"))
    }

    private func copyText(_ text: String) {
        guard !text.isEmpty else { return }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        DebugLogger.shared.push(
            level: .ACTION,
            category: "DEBUG",
            message: "클립보드 복사 (줄 수: \(text.split(separator: "\n").count))"
        )
    }

    // MARK: - Colors (AGENTS.md 19.1 팔레트)

    private func levelColor(_ level: DebugLogLevel) -> Color {
        switch level {
        case .ACTION: return .white
        case .API_REQ: return Color(hex: 0x74C0FC)
        case .API_RES: return Color(hex: 0x8CE99A)
        case .INFO: return .gray
        case .WARN: return Color(hex: 0xFFD43B)
        case .ERROR: return Color(hex: 0xFF6B6B)
        case .SYSTEM: return Color(hex: 0xCC5DE8)
        case .PERF: return Color(hex: 0x20C997)
        }
    }
}

private extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255.0,
            green: Double((hex >> 8) & 0xFF) / 255.0,
            blue: Double(hex & 0xFF) / 255.0
        )
    }
}
#endif
