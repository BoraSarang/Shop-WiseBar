import SwiftUI

@main
struct ShopWiseBarManagerApp: App {
    @State private var model = AppModel.shared

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
    @State private var selection: AppModel.Section = .dashboard

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
        case .dashboard: DashboardView()
        case .insight: InsightView()
        case .stats: StatsView()
        case .deals: DealsView()
        case .collect: CollectView()
        case .crawler: CrawlerView()
        }
    }
}

/// 사이드바 — 똑바 브랜드 헤더 + 메뉴 버튼 + 데이터 요약
struct SidebarView: View {
    @Environment(AppModel.self) private var model
    @Binding var selection: AppModel.Section

    var body: some View {
        ZStack(alignment: .leading) {
            LinearGradient(
                colors: [
                    DS.Color.primary.opacity(0.85),
                    Color.black.opacity(0.95),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

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
                        .font(DS.Font.xs)
                        .foregroundStyle(.white.opacity(0.6))
                    Text("똑바 매니저 · v\(Bundle.main.versionString)")
                        .font(DS.Font.xxs)
                        .foregroundStyle(.white.opacity(0.4))
                }
                .padding(.horizontal, DS.Space.s3)
                .padding(.bottom, DS.Space.s3)
            }
        }
        .frame(width: 240)
    }

    private var brand: some View {
        HStack(spacing: DS.Space.s2) {
            Image(systemName: "tag.circle.fill")
                .font(.system(size: 30))
                .foregroundStyle(.white)
            VStack(alignment: .leading, spacing: 1) {
                Text("똑바")
                    .font(DS.Font.sm.weight(.semibold))
                    .foregroundStyle(.white)
                Text("매니저")
                    .font(DS.Font.xxs)
                    .foregroundStyle(.white.opacity(0.65))
            }
            Spacer()
        }
        .padding(.horizontal, DS.Space.s3)
        .padding(.top, DS.Space.s3)
        .padding(.bottom, DS.Space.s2)
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
                    .font(DS.Font.base)
                    .lineLimit(1)
            }
            .foregroundStyle(isSelected ? Color.white : Color.white.opacity(0.75))
            .padding(.horizontal, DS.Space.s3)
            .padding(.vertical, DS.Space.s2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
            .background(
                    isSelected
                        ? Color.white.opacity(0.18)
                        : Color.clear,
                    in: RoundedRectangle(cornerRadius: DS.Radius.md)
                )
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity)
        .accessibilityLabel(section.rawValue)
    }
}