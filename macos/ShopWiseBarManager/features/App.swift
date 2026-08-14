import SwiftUI
import AppKit

@main
struct ShopWiseBarManagerApp: App {
    @State private var model = AppModel.shared

    /// 단일 인스턴스 가드 — 이미 실행 중이면 해당 창을 앞으로 가져오고 종료
    init() {
        guard let bundleID = Bundle.main.bundleIdentifier else { return }
        let running = NSRunningApplication.runningApplications(withBundleIdentifier: bundleID)
        if let existing = running.first(where: { $0.processIdentifier != ProcessInfo.processInfo.processIdentifier }) {
            existing.activate(options: [.activateAllWindows, .activateIgnoringOtherApps])
            exit(0)
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(model)
                .frame(minWidth: 980, minHeight: 620)
                .task { await model.refresh() }
        }
        .defaultSize(width: 1200, height: 760)
    }
}

/// 루트 레이아웃 — 좌측 메뉴 + 우측 컨텐츠 (Music 앱 스타일)
struct ContentView: View {
    @Environment(AppModel.self) private var model
    @State private var selection: AppModel.Section = .overview

    var body: some View {
        HStack(spacing: 0) {
            SidebarView(selection: $selection)
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .toolbar {
            ToolbarItem(placement: .navigation) {
                Button {
                    Task { await model.refresh() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .help("새로고침")
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch selection {
        case .overview: DashboardView()
        case .status: HealthView()
        case .products: InsightView()
        case .crawler: CrawlerView()
        case .settings: SettingsView()
        }
    }
}

/// 사이드바 — 똑바 브랜드 헤더 + 메뉴 버튼 + 데이터 요약 (라이트 미니멀, v0.16.17)
struct SidebarView: View {
    @Environment(AppModel.self) private var model
    @Binding var selection: AppModel.Section

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            brand

            ForEach(AppModel.Section.allCases) { section in
                SidebarButton(
                    section: section,
                    isSelected: selection == section
                ) {
                    selection = section
                }
            }

            Spacer(minLength: 0)

            VStack(alignment: .leading, spacing: DS.Space.s2) {
                Text(model.dataDescription)
                    .font(DS.Font.caption)
                    .foregroundStyle(.secondary)
                Text("똑바 매니저 · v\(Bundle.main.versionString)")
                    .font(DS.Font.caption2)
                    .foregroundStyle(.tertiary)
                links
            }
            .padding(.horizontal, DS.Space.s4)
            .padding(.bottom, DS.Space.s4)
        }
        .frame(width: 200)
        .background(Color(nsColor: .windowBackgroundColor))
        .overlay(alignment: .trailing) {
            Divider()
        }
    }

    private var links: some View {
        HStack(spacing: DS.Space.s3) {
            linkButton("GitHub Pages", url: "https://borasarang.github.io/Shop-WiseBar/")
            linkButton("GitHub 저장소", url: "https://github.com/BoraSarang/Shop-WiseBar")
        }
        .padding(.top, DS.Space.s1)
    }

    private func linkButton(_ label: String, url: String) -> some View {
        Button {
            guard let u = URL(string: url) else { return }
            NSWorkspace.shared.open(u)
        } label: {
            HStack(spacing: 3) {
                Text(label).font(DS.Font.caption2)
                Image(systemName: "arrow.up.right").font(.system(size: 8))
            }
            .foregroundStyle(.tertiary)
        }
        .buttonStyle(.plain)
        .help(url)
    }

    private var brand: some View {
        HStack(spacing: DS.Space.s2) {
            Image(systemName: "tag.circle.fill")
                .font(.system(size: 26))
                .foregroundStyle(DS.Color.primary)
            VStack(alignment: .leading, spacing: 1) {
                Text("똑바")
                    .font(DS.Font.body.weight(.semibold))
                    .foregroundStyle(.primary)
                Text("매니저")
                    .font(DS.Font.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(.horizontal, DS.Space.s4)
        .padding(.top, DS.Space.s4)
        .padding(.bottom, DS.Space.s3)
    }
}

/// 사이드바 메뉴 버튼
struct SidebarButton: View {
    let section: AppModel.Section
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: DS.Space.s2) {
                Image(systemName: section.systemImage)
                    .font(.system(size: 13))
                    .frame(width: 16, height: 16)
                Text(section.rawValue)
                    .font(DS.Font.body)
                    .lineLimit(1)
            }
            .foregroundStyle(isSelected ? Color.primary : Color.secondary)
            .padding(.horizontal, DS.Space.s4)
            .padding(.vertical, DS.Space.s2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
            .background(
                    isSelected
                        ? DS.Color.primary.opacity(0.12)
                        : Color.clear,
                    in: RoundedRectangle(cornerRadius: DS.Radius.md)
                )
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity)
        .accessibilityLabel(section.rawValue)
    }
}