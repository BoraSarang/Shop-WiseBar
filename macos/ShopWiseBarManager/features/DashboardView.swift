import SwiftUI

/// 개요 — 핵심 지표 카드 + 수집 트렌드 미니 차트 (라이트 미니멀, v0.16.17)
struct DashboardView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DS.Space.s5) {
                PageHeader(title: "개요", subtitle: "전체 데이터 현황 (운영 서버)")

                if let o = model.overview {
                    keyMetrics(o)
                    if let trend = model.trend {
                        TrendChartView(days: trend.days)
                    }
                    extraLine(o)
                } else {
                    ProgressView("데이터 로딩 중…")
                        .frame(maxWidth: .infinity, maxHeight: 300)
                }
            }
            .padding(DS.Space.s5)
        }
    }

    /// 핵심 4개 지표 카드
    private func keyMetrics(_ o: Overview) -> some View {
        HStack(spacing: DS.Space.s3) {
            StatCard(title: "상품", value: "\(o.products)", color: DS.Color.primary, icon: "cube.box")
            StatCard(title: "찜 (관심상품)", value: "\(o.watches)", color: DS.Color.mallNaver, icon: "star")
            StatCard(title: "가격포인트", value: "\(o.pricePoints)", color: DS.Color.mallCoupang, icon: "chart.line.downtrend.xyaxis")
            StatCard(title: "알림 발생", value: "\(o.alerts)", color: .orange, icon: "bell")
        }
    }

    /// 나머지 지표 — 컴팩트 라인
    private func extraLine(_ o: Overview) -> some View {
        HStack(spacing: DS.Space.s4) {
            miniStat("가격책정", "\(o.priced)")
            miniStat("품절 중", "\(o.soldOut)")
            miniStat("기기", "\(o.devices)")
            miniStat("일별 통계", "\(o.dailyStats)")
            miniStat("연관 관계", "\(o.relations)")
            Spacer()
        }
        .padding(.horizontal, DS.Space.s4)
        .padding(.vertical, DS.Space.s3)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: DS.Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: DS.Radius.lg)
                .stroke(Color.primary.opacity(0.08), lineWidth: 1)
        )
    }

    private func miniStat(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(value).font(DS.Font.body.weight(.semibold)).monospacedDigit()
            Text(label).font(DS.Font.caption2).foregroundStyle(.secondary)
        }
    }
}

/// 트렌드 차트 — 30일 수집량/가격변동/신규상품 (단순 바 차트)
struct TrendChartView: View {
    let days: [TrendDay]

    var body: some View {
        VStack(alignment: .leading, spacing: DS.Space.s3) {
            Text("수집 트렌드 (최근 \(days.count)일)")
                .font(DS.Font.section)
            HStack(alignment: .bottom, spacing: 2) {
                ForEach(days, id: \.date) { d in
                    VStack {
                        BarStack(captures: d.captures, points: d.points, new: d.new)
                    }
                }
            }
            .frame(height: 160)
            legend
        }
        .padding(DS.Space.s4)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: DS.Radius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: DS.Radius.lg)
                .stroke(Color.primary.opacity(0.08), lineWidth: 1)
        )
    }

    private var legend: some View {
        HStack(spacing: DS.Space.s4) {
            LegendItem(color: DS.Color.primary, label: "수집")
            LegendItem(color: DS.Color.danger, label: "가격 변동")
            LegendItem(color: DS.Color.success, label: "신규 상품")
        }
        .font(DS.Font.caption)
    }
}

struct BarStack: View {
    let captures: Int
    let points: Int
    let new: Int

    var body: some View {
        HStack(alignment: .bottom, spacing: 1) {
            bar(captures, color: DS.Color.primary)
            bar(points, color: DS.Color.danger)
            bar(new, color: DS.Color.success)
        }
    }

    private func bar(_ v: Int, color: Color) -> some View {
        let maxV = max(captures, points, new, 1)
        return RoundedRectangle(cornerRadius: 2)
            .fill(color)
            .frame(width: 4, height: CGFloat(v) / CGFloat(maxV) * 130)
    }
}

struct LegendItem: View {
    let color: Color
    let label: String
    var body: some View {
        HStack(spacing: DS.Space.s1) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(label).foregroundStyle(.secondary)
        }
    }
}
