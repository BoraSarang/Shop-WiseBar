import SwiftUI
import AppKit

/// 상품 — 최근 알림 / 하락 TOP / 공통 핫딜 / 몰별 통계 / 가격 동향 (라이트 미니멀, v0.16.17)
struct InsightView: View {
    @Environment(AppModel.self) private var model
    @State private var tab: Tab = .alerts

    enum Tab: String, CaseIterable, Identifiable {
        case alerts = "최근 알림"
        case drops = "하락 TOP"
        case deals = "공통 핫딜"
        case malls = "몰별 통계"
        case compare = "가격 동향"
        var id: String { rawValue }
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            switch tab {
            case .alerts: alertsView
            case .drops: dropsView
            case .deals: dealsView
            case .malls: mallsView
            case .compare: compareView
            }
        }
        .task {
            if model.insight == nil { await model.refresh() }
            if model.priceCompare == nil { await model.refreshUsers() }
        }
    }

    private var header: some View {
        HStack(spacing: DS.Space.s4) {
            Picker("", selection: $tab) {
                ForEach(Tab.allCases) { t in
                    Text(t.rawValue).tag(t)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .frame(maxWidth: 380)
            Spacer()
        }
        .padding(.horizontal, DS.Space.s5)
        .padding(.vertical, DS.Space.s3)
    }

    // MARK: 공용 스크롤 컨테이너

    private var scrollContainer: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DS.Space.s4) {
                contentByTab
            }
            .padding(DS.Space.s5)
        }
    }

    @ViewBuilder
    private var contentByTab: some View {
        switch tab {
        case .alerts: alertContent
        case .drops: dropContent
        case .deals: dealContent
        case .malls: mallContent
        case .compare: compareContent
        }
    }

    // MARK: 최근 알림

    private var alertsView: some View {
        scrollContainer
    }

    private var alertContent: some View {
        Group {
            if let insight = model.insight {
                alertDistributionSection(insight.alertDistribution)
                productSection(title: "최근 알림", emptyText: "알림이 없습니다",
                               items: alertCards(insight.recentAlerts))
            } else {
                ProgressView("데이터 로딩 중…")
                    .frame(maxWidth: .infinity, maxHeight: 200)
            }
        }
    }

    private func alertDistributionSection(_ dist: [AlertDistribution]) -> some View {
        VStack(alignment: .leading, spacing: DS.Space.s2) {
            Text("알림 타입 분포").font(DS.Font.section)
            if dist.isEmpty {
                Text("최근 30일 알림 없음").font(DS.Font.caption).foregroundStyle(.secondary)
            } else {
                HStack(spacing: DS.Space.s4) {
                    ForEach(dist, id: \.type) { a in
                        HStack(spacing: DS.Space.s1) {
                            AlertBadge(type: a.type)
                            Text("\(a.count)건").font(DS.Font.body.weight(.semibold))
                        }
                    }
                }
            }
        }
        .padding(DS.Space.s4)
        .cardStyle
    }

    // MARK: 하락 TOP

    private var dropsView: some View {
        scrollContainer
    }

    private var dropContent: some View {
        Group {
            if let insight = model.insight {
                productSection(title: "하락 TOP (5% 이상)", emptyText: "하락 감지 없음",
                               items: dropCards(insight.topDrops))
            } else {
                ProgressView("데이터 로딩 중…")
                    .frame(maxWidth: .infinity, maxHeight: 200)
            }
        }
    }

    // MARK: 공통 핫딜

    private var dealsView: some View {
        scrollContainer
    }

    private var dealContent: some View {
        Group {
            if model.deals.isEmpty {
                VStack(spacing: DS.Space.s3) {
                    Image(systemName: "tag.slash")
                        .font(.system(size: 36))
                        .foregroundStyle(.tertiary)
                    Text("공통 핫딜 데이터가 아직 없습니다")
                        .font(DS.Font.body)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, minHeight: 240)
            } else {
                VStack(spacing: 0) {
                    ForEach(model.deals) { deal in
                        DealRow(deal: deal)
                        if deal.id != model.deals.last?.id { Divider() }
                    }
                }
                .padding(DS.Space.s4)
                .cardStyle
            }
        }
    }

    // MARK: 몰별 통계

    private var mallsView: some View {
        scrollContainer
    }

    private var mallContent: some View {
        Group {
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
                .cardStyle
            } else {
                ProgressView("데이터 로딩 중…")
                    .frame(maxWidth: .infinity, maxHeight: 200)
            }
        }
    }

    private var headerRow: some View {
        HStack {
            Text("몰").font(DS.Font.caption.weight(.semibold)).frame(width: 90, alignment: .leading)
            Text("상품 수").font(DS.Font.caption.weight(.semibold)).frame(width: 80, alignment: .trailing)
            Text("평균 최근가").font(DS.Font.caption.weight(.semibold)).frame(width: 120, alignment: .trailing)
            Text("찜").font(DS.Font.caption.weight(.semibold)).frame(width: 70, alignment: .trailing)
            Text("가격책정").font(DS.Font.caption.weight(.semibold)).frame(maxWidth: .infinity, alignment: .trailing)
        }
        .foregroundStyle(.secondary)
    }

    // MARK: 가격 동향

    private var compareView: some View {
        scrollContainer
    }

    private var compareContent: some View {
        Group {
            if let pc = model.priceCompare {
                if pc.groups.isEmpty {
                    Text("동일상품이 여러 몰에 존재하지 않음")
                        .font(DS.Font.body).foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, minHeight: 200)
                } else {
                    Text("총 \(pc.totalGroups)개 그룹 — 최저가 몰 대비 차이 %")
                        .font(DS.Font.caption).foregroundStyle(.secondary)
                    ForEach(pc.groups.prefix(15)) { g in
                        VStack(alignment: .leading, spacing: DS.Space.s1) {
                            HStack(spacing: DS.Space.s1) {
                                Text(g.name?.shortProduct ?? g.normalizedName)
                                    .font(DS.Font.body.weight(.semibold))
                                if let u = g.rows.first?.url, let url = URL(string: u) {
                                    Link(destination: url) {
                                        Image(systemName: "arrow.up.right.square")
                                            .font(DS.Font.caption)
                                            .foregroundStyle(DS.Color.primary)
                                    }
                                }
                            }
                            ForEach(g.rows, id: \.productId) { row in
                                HStack(spacing: DS.Space.s2) {
                                    MallBadge(mall: row.mall)
                                    Text("\(row.price.wonText)")
                                        .font(DS.Font.caption)
                                        .foregroundStyle(row.isCheapest ? DS.Color.success : .primary)
                                    if !row.isCheapest {
                                        Text("+\(row.diffPct, specifier: "%.1f")%")
                                            .font(DS.Font.caption2)
                                            .foregroundStyle(DS.Color.danger)
                                    } else {
                                        Text("최저").font(DS.Font.caption2).foregroundStyle(DS.Color.success)
                                    }
                                    Spacer()
                                }
                            }
                        }
                        .padding(DS.Space.s3)
                        .background(.quaternary.opacity(0.3), in: RoundedRectangle(cornerRadius: DS.Radius.md))
                    }
                }
            } else {
                ProgressView("데이터 로딩 중…")
                    .frame(maxWidth: .infinity, maxHeight: 200)
            }
        }
    }

    // MARK: 카드 모델

    private struct InsightCard: Identifiable {
        let id: String
        let name: String?
        let productId: String
        let image: String?
        let url: String?
        let mall: String?
        let priceText: String
        let badgeType: String?
        let subText: String?
    }

    private func alertCards(_ alerts: [AlertItem]) -> [InsightCard] {
        alerts.enumerated().map { i, a in
            // product_id 중복(같은 상품 여러 알림) 대비 고유 id — ForEach 중복 방지 (v0.16.16)
            InsightCard(
                id: "\(a.productId)-\(i)",
                name: Self.displayName(a.name, mall: a.mall, productId: a.productId),
                productId: a.productId,
                image: a.image,
                url: a.url,
                mall: a.mall,
                priceText: a.alertType == "sold_out" ? "품절" : a.price.wonText,
                badgeType: a.alertType,
                subText: a.previousPrice.map { "이전 \($0.wonText)" } ?? a.createdAt.replacingOccurrences(of: "T", with: " ")
            )
        }
    }

    private func dropCards(_ drops: [DropItem]) -> [InsightCard] {
        drops.enumerated().map { i, d in
            // 상품별 최신 포인트만 포함하나 동일 상품 중복 방어 — 고유 id (v0.16.16)
            InsightCard(
                id: "\(d.productId)-\(i)",
                name: Self.displayName(d.name, mall: d.mall, productId: d.productId),
                productId: d.productId,
                image: d.image,
                url: d.url,
                mall: d.mall,
                priceText: String(format: "-%.1f%% · %@", d.dropPct, d.price.wonText),
                badgeType: nil,
                subText: "이전 \(d.previous.wonText)"
            )
        }
    }

    /// 쓰레기/빈 상품명은 몰+ID로 폴백 ("새 창에서 열림" 등 네이버 앵커 텍스트 방어)
    private static func displayName(_ name: String?, mall: String?, productId: String) -> String {
        if let name, !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
           name != "새 창에서 열림" {
            return name
        }
        if let mall, !mall.isEmpty {
            return "\(MallBadge.display(mall)) #\(productId)"
        }
        return productId
    }

    // MARK: 상품 카드 섹션 (그리드)

    private func productSection(title: String, emptyText: String,
                                items: [InsightCard]) -> some View {
        VStack(alignment: .leading, spacing: DS.Space.s2) {
            Text(title).font(DS.Font.section)
            if items.isEmpty {
                Text(emptyText).font(DS.Font.caption).foregroundStyle(.secondary)
            } else {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 200), spacing: DS.Space.s3)],
                          alignment: .leading, spacing: DS.Space.s3) {
                    ForEach(items) { item in
                        cardView(item)
                            .frame(maxWidth: .infinity, alignment: .top)
                    }
                }
            }
        }
    }

    // 그리드 카드 — 이미지 상단 + 이름/가격/하락률/링크 (라이트)
    @ViewBuilder
    private func cardView(_ item: InsightCard) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .bottomTrailing) {
                if let url = item.image, let u = URL(string: url) {
                    AsyncImage(url: u) { phase in
                        if case .success(let image) = phase {
                            image.resizable().scaledToFill()
                        } else {
                            placeholderImage
                        }
                    }
                } else {
                    placeholderImage
                }
                if item.url != nil {
                    Image(systemName: "arrow.up.right.square")
                        .font(DS.Font.caption2)
                        .foregroundStyle(.white)
                        .padding(4)
                        .background(.black.opacity(0.45), in: .circle)
                        .padding(DS.Space.s2)
                }
            }
            .frame(height: 100)
            .frame(maxWidth: .infinity)
            .clipped()
            .background(Color.gray.opacity(0.12))

            VStack(alignment: .leading, spacing: DS.Space.s1) {
                HStack(spacing: 4) {
                    if let mall = item.mall {
                        MallBadge(mall: mall)
                    }
                    if let badge = item.badgeType {
                        AlertBadge(type: badge)
                    }
                    Spacer(minLength: 0)
                }
                Text(item.name ?? item.productId)
                    .font(DS.Font.caption.weight(.medium))
                    .lineLimit(2)
                    .foregroundStyle(.primary)
                HStack(spacing: 4) {
                    Text(item.priceText)
                        .font(DS.Font.caption.weight(.semibold))
                        .foregroundStyle(item.badgeType == "sold_out" ? DS.Color.warning : DS.Color.danger)
                    if let sub = item.subText {
                        Text(sub)
                            .font(DS.Font.caption2)
                            .foregroundStyle(.tertiary)
                            .lineLimit(1)
                    }
                }
            }
            .padding(DS.Space.s2)
        }
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: DS.Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: DS.Radius.md)
                .stroke(Color.primary.opacity(0.08), lineWidth: 1)
        )
        .contentShape(Rectangle())
        .onTapGesture { openProduct(item) }
        .help(item.productId)
    }

    private var placeholderImage: some View {
        RoundedRectangle(cornerRadius: DS.Radius.sm)
            .fill(Color.gray.opacity(0.14))
            .overlay(Image(systemName: "photo").foregroundStyle(.tertiary))
    }

    private func openProduct(_ item: InsightCard) {
        guard let url = item.url, let u = URL(string: url) else { return }
        NSWorkspace.shared.open(u)
    }
}

/// 공통 핫딜 행
struct DealRow: View {
    let deal: DealItem

    var body: some View {
        HStack(spacing: DS.Space.s3) {
            MallBadge(mall: deal.mall)
            VStack(alignment: .leading, spacing: 2) {
                Text(deal.name)
                    .font(DS.Font.body)
                    .lineLimit(1)
                    .help(deal.name)
                if let url = deal.url {
                    Text(url)
                        .font(DS.Font.caption2)
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                }
            }
            Spacer()
            if let rate = deal.dropRate {
                Text("-\(rate, specifier: "%.0f")%")
                    .font(DS.Font.body.weight(.bold))
                    .foregroundStyle(DS.Color.danger)
            }
            Text(deal.price.wonText)
                .font(DS.Font.body.weight(.semibold))
            if let last = deal.lastPrice, last > 0 {
                Text(last.wonText)
                    .font(DS.Font.caption)
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

/// 몰별 통계 행
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
        .font(DS.Font.body)
        .padding(.vertical, DS.Space.s1)
    }
}
