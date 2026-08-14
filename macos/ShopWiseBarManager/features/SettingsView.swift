import SwiftUI
import ServiceManagement

/// 설정 — 로그인 자동 실행 + 서버 오버라이드 (v0.16.16, T-127)
struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @State private var serverText: String = ""
    @State private var launchState: SMAppService.Status = .notRegistered

    var body: some View {
        VStack(alignment: .leading, spacing: DS.Space.s4) {
            PageHeader(title: "설정", subtitle: "앱 동작 · 서버 연결")

            launchCard
            serverCard

            Spacer()
        }
        .padding(DS.Space.s5)
        .onAppear {
            serverText = model.serverOverride
            launchState = SMAppService.mainApp.status
        }
    }

    // MARK: 로그인 자동 실행

    private var launchCard: some View {
        VStack(alignment: .leading, spacing: DS.Space.s3) {
            HStack {
                Image(systemName: "power")
                    .foregroundStyle(DS.Color.primary)
                Text("로그인 시 자동 실행")
                    .font(DS.Font.md.weight(.semibold))
                Spacer()
                statusBadge
            }

            Toggle(isOn: Binding(
                get: { launchState == .enabled },
                set: { newValue in toggleLaunchAtLogin(newValue) }
            )) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(launchState == .enabled ? "macOS 로그인 시 매니저가 자동으로 열립니다" : "로그인 시 자동 실행하지 않습니다")
                        .font(DS.Font.sm)
                    Text("수집 배치는 항상 수동으로 시작/종료합니다")
                        .font(DS.Font.xs)
                        .foregroundStyle(.secondary)
                }
            }
            .toggleStyle(.switch)
        }
        .padding(DS.Space.s4)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: DS.Radius.lg))
    }

    private var statusBadge: some View {
        Group {
            switch launchState {
            case .enabled: Text("자동 실행").font(DS.Font.xs).foregroundStyle(.green)
            case .notRegistered: Text("꺼짐").font(DS.Font.xs).foregroundStyle(.secondary)
            default: Text("확인 불가").font(DS.Font.xs).foregroundStyle(.orange)
            }
        }
    }

    private func toggleLaunchAtLogin(_ enable: Bool) {
        do {
            if enable {
                try SMAppService.mainApp.register()
            } else {
                try SMAppService.mainApp.unregister()
            }
            launchState = SMAppService.mainApp.status
            model.launchAtLogin = enable
        } catch {
            launchState = SMAppService.mainApp.status
        }
    }

    // MARK: 서버 오버라이드

    private var serverCard: some View {
        VStack(alignment: .leading, spacing: DS.Space.s3) {
            HStack {
                Image(systemName: "server.rack")
                    .foregroundStyle(DS.Color.primary)
                Text("서버 주소 (오버라이드)")
                    .font(DS.Font.md.weight(.semibold))
                Spacer()
                if !model.serverOverride.isEmpty {
                    Text("오버라이드 중").font(DS.Font.xs).foregroundStyle(.orange)
                }
            }

            TextField("기본: https://shop-wisebar.onrender.com", text: $serverText)
                .textFieldStyle(.roundedBorder)
                .onSubmit { model.serverOverride = serverText.trimmingCharacters(in: .whitespaces) }

            HStack {
                Button("적용") {
                    model.serverOverride = serverText.trimmingCharacters(in: .whitespaces)
                }
                .buttonStyle(.borderedProminent)
                .tint(DS.Color.primary)

                if !model.serverOverride.isEmpty {
                    Button("기본값으로") {
                        serverText = ""
                        model.serverOverride = ""
                    }
                    .buttonStyle(.bordered)
                }
                Spacer()
            }
            Text("비워 두면 운영 서버(https://shop-wisebar.onrender.com)를 사용합니다.")
                .font(DS.Font.xs)
                .foregroundStyle(.secondary)
        }
        .padding(DS.Space.s4)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: DS.Radius.lg))
    }
}