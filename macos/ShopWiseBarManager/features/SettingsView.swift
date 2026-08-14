import SwiftUI
import ServiceManagement

/// 설정 — 로그인 자동 실행 + 서버 오버라이드 (v0.16.16, T-127)
struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @State private var serverText: String = ""
    @State private var launchState: SMAppService.Status = .notRegistered

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DS.Space.s5) {
                PageHeader(title: "설정", subtitle: "앱 동작 · 서버 연결 · 기기 활동")

                launchCard
                serverCard
                devicesCard

                Spacer(minLength: DS.Space.s5)
            }
            .padding(DS.Space.s5)
        }
        .onAppear {
            serverText = model.serverOverride
            launchState = SMAppService.mainApp.status
        }
        .task { if model.usersState != .loaded { await model.refreshUsers() } }
    }

    // MARK: 기기 활동 (기존 사용자 탭 통합, v0.16.17)

    private var devicesCard: some View {
        VStack(alignment: .leading, spacing: DS.Space.s3) {
            HStack {
                Image(systemName: "iphone")
                    .foregroundStyle(DS.Color.primary)
                Text("기기 활동")
                    .font(DS.Font.section)
                Spacer()
                if let u = model.users {
                    Text("전체 \(u.total) · 24시간 내 \(u.active24h)")
                        .font(DS.Font.caption)
                        .foregroundStyle(.secondary)
                }
            }
            if let u = model.users {
                if u.users.isEmpty {
                    Text("등록 기기 없음").font(DS.Font.caption).foregroundStyle(.secondary)
                } else {
                    ForEach(u.users.prefix(20)) { user in
                        HStack(spacing: DS.Space.s2) {
                            Circle()
                                .fill(user.active ? DS.Color.success : .gray)
                                .frame(width: 8, height: 8)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(user.deviceId.prefix(12))
                                    .font(DS.Font.body).monospacedDigit()
                                Text(user.lastSeenAt?.timeOrDate ?? "활동 없음")
                                    .font(DS.Font.caption2).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text("찜 \(user.watches)").font(DS.Font.caption).foregroundStyle(.secondary)
                            Text("수집 \(user.captures)").font(DS.Font.caption).foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
        }
        .padding(DS.Space.s4)
        .cardStyle
    }

    // MARK: 로그인 자동 실행

    private var launchCard: some View {
        VStack(alignment: .leading, spacing: DS.Space.s3) {
            HStack {
                Image(systemName: "power")
                    .foregroundStyle(DS.Color.primary)
                Text("로그인 시 자동 실행")
                    .font(DS.Font.section)
                Spacer()
                statusBadge
            }

            Toggle(isOn: Binding(
                get: { launchState == .enabled },
                set: { newValue in toggleLaunchAtLogin(newValue) }
            )) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(launchState == .enabled ? "macOS 로그인 시 매니저가 자동으로 열립니다" : "로그인 시 자동 실행하지 않습니다")
                        .font(DS.Font.body)
                    Text("수집 배치는 항상 수동으로 시작/종료합니다")
                        .font(DS.Font.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .toggleStyle(.switch)
        }
        .padding(DS.Space.s4)
        .cardStyle
    }

    private var statusBadge: some View {
        Group {
            switch launchState {
            case .enabled: Text("자동 실행").font(DS.Font.caption).foregroundStyle(.green)
            case .notRegistered: Text("꺼짐").font(DS.Font.caption).foregroundStyle(.secondary)
            default: Text("확인 불가").font(DS.Font.caption).foregroundStyle(.orange)
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
                    .font(DS.Font.section)
                Spacer()
                if !model.serverOverride.isEmpty {
                    Text("오버라이드 중").font(DS.Font.caption).foregroundStyle(.orange)
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
                .font(DS.Font.caption)
                .foregroundStyle(.secondary)
        }
        .padding(DS.Space.s4)
        .cardStyle
    }
}