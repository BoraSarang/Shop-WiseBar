import SwiftUI

/// 통계 — 쇼핑몰별 집계 테이블
struct StatsView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DS.Space.s4) {
                PageHeader(title: "통계", subtitle: "쇼핑몰별 상품 · 평균가 · 찜")

                if let malls = model.malls {
                    VStack(spacing: DS.Space.s2) {
                        headerRow
                        Divider()
                        ForEach(malls.malls, id: \.mall) { m in
                            MallRow(stat: m)
                            if m.mall != malls.malls.last?.mall { Divider() }
                        }
                    }
                    .padding(DS.Space.s4)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: DS.Radius.lg))
                } else {
                    ProgressView("데이터 로딩 중…")
                        .frame(maxWidth: .infinity, maxHeight: 300)
                }
            }
            .padding(DS.Space.s5)
        }
    }

    private var headerRow: some View {
        HStack {
            Text("몰").font(DS.Font.sm.weight(.semibold)).frame(width: 90, alignment: .leading)
            Text("상품 수").font(DS.Font.sm.weight(.semibold)).frame(width: 80, alignment: .trailing)
            Text("평균 최근가").font(DS.Font.sm.weight(.semibold)).frame(width: 120, alignment: .trailing)
            Text("찜").font(DS.Font.sm.weight(.semibold)).frame(width: 70, alignment: .trailing)
            Text("가격책정").font(DS.Font.sm.weight(.semibold)).frame(maxWidth: .infinity, alignment: .trailing)
        }
        .foregroundStyle(.secondary)
    }
}

struct MallRow: View {
    let stat: MallStat

    var body: some View {
        HStack {
            MallBadge(mall: stat.mall).frame(width: 90, alignment: .leading)
            Text("\(stat.products)").frame(width: 80, alignment: .trailing)
            Text(stat.avgPrice.map(Int.init)?.wonText ?? "—").frame(width: 120, alignment: .trailing)
            Text("\(stat.watchers)").frame(width: 70, alignment: .trailing)
            Text("\(stat.priced)").frame(maxWidth: .infinity, alignment: .trailing)
        }
        .font(DS.Font.md)
        .padding(.vertical, DS.Space.s1)
    }
}