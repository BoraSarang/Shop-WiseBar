import SwiftUI

/// 인사이트 — 알림 분포 + 최근 알림 + 하락 TOP
struct InsightView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DS.Space.s4) {
                PageHeader(title: "인사이트", subtitle: "알림 분포 · 최근 알림 · 하락 TOP")

                if let insight = model.insight {
                    alertDistributionSection(insight.alertDistribution)

                    HStack(alignment: .top, spacing: DS.Space.s4) {
                        recentAlertsSection(insight.recentAlerts)
                        topDropsSection(insight.topDrops)
                    }
                } else {
                    ProgressView("데이터 로딩 중…")
                        .frame(maxWidth: .infinity, maxHeight: 300)
                }
            }
            .padding(DS.Space.s5)
        }
    }

    private func alertDistributionSection(_ dist: [AlertDistribution]) -> some View {
        VStack(alignment: .leading, spacing: DS.Space.s2) {
            Text("알림 타입 분포").font(DS.Font.lg.weight(.semibold))
            if dist.isEmpty {
                Text("최근 30일 알림 없음").font(DS.Font.sm).foregroundStyle(.secondary)
            } else {
                HStack(spacing: DS.Space.s3) {
                    ForEach(dist, id: \.type) { a in
                        HStack(spacing: DS.Space.s1) {
                            AlertBadge(type: a.type)
                            Text("\(a.count)건").font(DS.Font.md.weight(.semibold))
                        }
                    }
                }
            }
        }
        .padding(DS.Space.s4)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: DS.Radius.lg))
    }

    private func recentAlertsSection(_ alerts: [AlertItem]) -> some View {
        VStack(alignment: .leading, spacing: DS.Space.s2) {
            Text("최근 알림").font(DS.Font.lg.weight(.semibold))
            if alerts.isEmpty {
                Text("없음").font(DS.Font.sm).foregroundStyle(.secondary)
            } else {
                ForEach(alerts, id: \.productId) { a in
                    HStack(spacing: DS.Space.s2) {
                        AlertBadge(type: a.alertType)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(a.productId).font(DS.Font.sm).lineLimit(1)
                            Text("\(a.price.wonText)\(a.previousPrice.map { " (이전 \($0.wonText))" } ?? "")")
                                .font(DS.Font.xs).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(a.createdAt.replacingOccurrences(of: "T", with: " "))
                            .font(DS.Font.xxs).foregroundStyle(.tertiary)
                    }
                    .padding(.vertical, 2)
                }
            }
        }
        .padding(DS.Space.s4)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: DS.Radius.lg))
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func topDropsSection(_ drops: [DropItem]) -> some View {
        VStack(alignment: .leading, spacing: DS.Space.s2) {
            Text("최근 하락 TOP").font(DS.Font.lg.weight(.semibold))
            if drops.isEmpty {
                Text("하락 감지 없음").font(DS.Font.sm).foregroundStyle(.secondary)
            } else {
                ForEach(drops, id: \.productId) { d in
                    HStack(spacing: DS.Space.s2) {
                        Text(d.productId).font(DS.Font.sm).lineLimit(1)
                        Spacer()
                        Text("-\(d.dropPct, specifier: "%.1f")%")
                            .font(DS.Font.md.weight(.bold))
                            .foregroundStyle(DS.Color.danger)
                        Text("\(d.price.wonText)").font(DS.Font.sm)
                    }
                    .padding(.vertical, 2)
                }
            }
        }
        .padding(DS.Space.s4)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: DS.Radius.lg))
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}