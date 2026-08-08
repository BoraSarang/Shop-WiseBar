import SwiftUI

/// 공통 핫딜 — deals/public 피드 (다른 몰에서도 고려되는 공통 가격)
struct DealsView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DS.Space.s4) {
                PageHeader(title: "공통 핫딜", subtitle: "여러 쇼핑몰에서 수집된 공통 상품 피드")

                if model.deals.isEmpty {
                    VStack(spacing: DS.Space.s3) {
                        Image(systemName: "tag.slash")
                            .font(.system(size: 40))
                            .foregroundStyle(.tertiary)
                        Text("공통 핫딜 데이터가 아직 없습니다")
                            .font(DS.Font.md)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, minHeight: 300)
                } else {
                    VStack(spacing: DS.Space.s2) {
                        ForEach(model.deals) { deal in
                            DealRow(deal: deal)
                            if deal.id != model.deals.last?.id { Divider() }
                        }
                    }
                    .padding(DS.Space.s4)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: DS.Radius.lg))
                }
            }
            .padding(DS.Space.s5)
        }
    }
}

struct DealRow: View {
    let deal: DealItem

    var body: some View {
        HStack(spacing: DS.Space.s3) {
            MallBadge(mall: deal.mall)
            VStack(alignment: .leading, spacing: 2) {
                Text(deal.name)
                    .font(DS.Font.md)
                    .lineLimit(1)
                    .help(deal.name)
                if let url = deal.url {
                    Text(url)
                        .font(DS.Font.xxs)
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                }
            }
            Spacer()
            if let rate = deal.dropRate {
                Text("-\(rate, specifier: "%.0f")%")
                    .font(DS.Font.md.weight(.bold))
                    .foregroundStyle(DS.Color.danger)
            }
            Text(deal.price.wonText)
                .font(DS.Font.md.weight(.semibold))
            if let last = deal.lastPrice, last > 0 {
                Text(last.wonText)
                    .font(DS.Font.xs)
                    .foregroundStyle(.tertiary)
                    .strikethrough()
            }
            if let url = deal.url, let u = URL(string: url) {
                Link(destination: u) {
                    Image(systemName: "arrow.up.right.square")
                        .foregroundStyle(DS.Color.primary)
                }
            }
        }
        .padding(.vertical, DS.Space.s2)
    }
}