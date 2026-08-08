import SwiftUI

@main
struct ShopWiseBarManagerApp: App {
    @State private var model = AppModel.shared
    @State private var selection: AppModel.Section = .dashboard

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

/// 루트 레이아웃 — Music 앱 스타일 NavigationSplitView
struct ContentView: View {
    @Environment(AppModel.self) private var model
    @State private var selection: AppModel.Section? = .dashboard

    var body: some View {
        NavigationSplitView {
            SidebarView(selection: $selection)
        } detail: {
            detail
        }
    }

    @ViewBuilder
    private var detail: some View {
        switch selection {
        case .dashboard: DashboardView()
        case .insight: InsightView()
        case .stats: StatsView()
        case .deals: DealsView()
        case .collect: CollectView()
        default: DashboardView()
        }
    }
}

/// 사이드바 — Music 앱 느낌의 검은 배경 + 섹션 목록
struct SidebarView: View {
    @Environment(AppModel.self) private var model
    @Binding var selection: AppModel.Section?

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    DS.Color.primary.opacity(0.85),
                    Color.black.opacity(0.95),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(alignment: .leading, spacing: DS.Space.s1) {
                brand
                List(selection: $selection) {
                    ForEach(AppModel.Section.allCases) { section in
                        Label(section.rawValue, systemImage: section.systemImage)
                            .tag(Optional(section))
                    }
                }
                .listStyle(.sidebar)
                .scrollContentBackground(.hidden)
                .foregroundStyle(.white.opacity(0.85))

                Spacer(minLength: 0)

                VStack(alignment: .leading, spacing: DS.Space.s2) {
                    Text(model.dataDescription)
                        .font(DS.Font.xs)
                        .foregroundStyle(.white.opacity(0.6))
                    Text("똑바 매니저 · v0.15.0")
                        .font(DS.Font.xxs)
                        .foregroundStyle(.white.opacity(0.4))
                }
                .padding(.horizontal, DS.Space.s3)
                .padding(.bottom, DS.Space.s3)
            }
        }
        .frame(minWidth: 200, idealWidth: 240)
        .navigationTitle("똑바 매니저")
    }

    private var brand: some View {
        HStack(spacing: DS.Space.s2) {
            Circle()
                .fill(.white.opacity(0.18))
                .frame(width: 30, height: 30)
                .overlay(Text("⬤").font(.system(size: 14)).foregroundStyle(.white))
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