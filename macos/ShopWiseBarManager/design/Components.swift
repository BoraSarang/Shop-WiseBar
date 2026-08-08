import SwiftUI

/// 공용 헤더 — 타이틀 + 서버 상태 + 새로고침
struct PageHeader: View {
    @Environment(AppModel.self) private var model
    let title: String
    var subtitle: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(title).font(DS.Font.xl.weight(.semibold))
                Spacer()
                statusDot
                Button {
                    Task { await model.refresh() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .help("새로고침")
            }
            if let subtitle {
                Text(subtitle).font(DS.Font.sm).foregroundStyle(.secondary)
            }
        }
        .padding(.bottom, DS.Space.s2)
    }

    private var statusDot: some View {
        HStack(spacing: DS.Space.s1) {
            Circle()
                .fill(model.hasLoaded ? DS.Color.success : DS.Color.danger)
                .frame(width: 8, height: 8)
            Text(model.hasLoaded ? "연결됨" : "확인 중")
                .font(DS.Font.xs)
                .foregroundStyle(.secondary)
        }
    }
}

/// 카드형 스테이트 카드
struct StatCard: View {
    let title: String
    let value: String
    var color: Color = DS.Color.primary
    var icon: String = "number"

    var body: some View {
        VStack(alignment: .leading, spacing: DS.Space.s2) {
            HStack {
                Image(systemName: icon).font(.system(size: 14)).foregroundStyle(color)
                Text(title).font(DS.Font.sm).foregroundStyle(.secondary)
            }
            Text(value)
                .font(.system(size: 28, weight: .semibold, design: .rounded))
                .foregroundStyle(color)
                .monospacedDigit()
        }
        .padding(DS.Space.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: DS.Radius.lg))
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