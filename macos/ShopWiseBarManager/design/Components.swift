import SwiftUI

/// 공용 헤더 — 타이틀 + 서버 상태 + 새로고침 (라이트 미니멀, v0.16.17)
struct PageHeader: View {
    @Environment(AppModel.self) private var model
    let title: String
    var subtitle: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: DS.Space.s3) {
                Text(title).font(DS.Font.title)
                Spacer()
                statusDot
                Button {
                    Task { await model.refresh() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 13))
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
                .help("새로고침")
            }
            if let subtitle {
                Text(subtitle).font(DS.Font.caption).foregroundStyle(.secondary)
            }
        }
        .padding(.bottom, DS.Space.s3)
    }

    private var statusDot: some View {
        HStack(spacing: DS.Space.s1) {
            Circle()
                .fill(model.hasLoaded ? DS.Color.success : DS.Color.danger)
                .frame(width: 7, height: 7)
            Text(model.hasLoaded ? "연결됨" : "확인 중")
                .font(DS.Font.caption)
                .foregroundStyle(.secondary)
        }
    }
}

/// 카드형 스테이트 카드 (라이트 미니멀)
struct StatCard: View {
    let title: String
    let value: String
    var color: Color = DS.Color.primary
    var icon: String = "number"

    var body: some View {
        VStack(alignment: .leading, spacing: DS.Space.s2) {
            HStack(spacing: DS.Space.s1) {
                Image(systemName: icon).font(.system(size: 12)).foregroundStyle(color)
                Text(title).font(DS.Font.caption).foregroundStyle(.secondary)
            }
            Text(value)
                .font(.system(size: 24, weight: .semibold, design: .rounded))
                .foregroundStyle(.primary)
                .monospacedDigit()
        }
        .padding(DS.Space.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: DS.Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: DS.Radius.lg)
                .stroke(Color.primary.opacity(0.08), lineWidth: 1)
        )
    }
}

/// 가격 포맷 — 원 단위 콤마
extension Int {
    var wonText: String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        return (f.string(from: NSNumber(value: self)) ?? "0") + "원"
    }
}

/// 앱 버전 (Info.plist CFBundleShortVersionString)
extension Bundle {
    var versionString: String {
        (infoDictionary?["CFBundleShortVersionString"] as? String) ?? "0.0.0"
    }
}
