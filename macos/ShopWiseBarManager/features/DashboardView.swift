import SwiftUI

/// 대시보드 — 전체 개요 카드 + 수집 트렌드 미니 차트
struct DashboardView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DS.Space.s4) {
                PageHeader(title: "대시보드", subtitle: "전체 데이터 현황 (운영 서버)")
                overviewGrid
                if let trend = model.trend {
                    TrendChartView(days: trend.days)
                }
            }
            .padding(DS.Space.s5)
        }
    }

    private var overviewGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: DS.Space.s3), count: 3), spacing: DS.Space.s3) {
            if let o = model.overview {
                StatCard(title: "상품", value: "\(o.products)", color: DS.Color.primary, icon: "cube.box")
                StatCard(title: "찜 (관심상품)", value: "\(o.watches)", color: DS.Color.mallNaver, icon: "star")
                StatCard(title: "가격포인트", value: "\(o.pricePoints)", color: DS.Color.mallCoupang, icon: "chart.line.downtrend.xyaxis")
                StatCard(title: "가격책정 상품", value: "\(o.priced)", color: DS.Color.success, icon: "checkmark.circle")
                StatCard(title: "품절 중", value: "\(o.soldOut)", color: DS.Color.danger, icon: "exclamationmark.triangle")
                StatCard(title: "알림 발생", value: "\(o.alerts)", color: .orange, icon: "bell")
                StatCard(title: "기기", value: "\(o.devices)", color: .gray, icon: "iphone")
                StatCard(title: "일별 통계", value: "\(o.dailyStats)", color: .indigo, icon: "calendar")
                StatCard(title: "연관 관계", value: "\(o.relations)", color: .teal, icon: "link")
            } else {
                ForEach(0..<9, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: DS.Radius.lg)
                        .fill(.quaternary.opacity(0.5))
                        .frame(height: 88)
                }
            }
        }
    }
}

/// 트렌드 차트 — 30일 수집량/가격변동/신규상품 (단순 바 차트)
struct TrendChartView: View {
    let days: [TrendDay]

    var body: some View {
        VStack(alignment: .leading, spacing: DS.Space.s3) {
            Text("수집 트렌드 (최근 \(days.count)일)")
                .font(DS.Font.lg.weight(.semibold))
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
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: DS.Radius.lg))
    }

    private var legend: some View {
        HStack(spacing: DS.Space.s4) {
            LegendItem(color: DS.Color.primary, label: "수집")
            LegendItem(color: DS.Color.danger, label: "가격 변동")
            LegendItem(color: DS.Color.success, label: "신규 상품")
        }
        .font(DS.Font.xs)
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