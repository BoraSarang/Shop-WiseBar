import SwiftUI

/// 인사이트 — 알림 분포 + 최근 알림 + 하락 TOP (상품 카드 그리드/리스트 토글)
struct InsightView: View {
    @Environment(AppModel.self) private var model
    @State private var layout: Layout = .grid

    enum Layout: String, CaseIterable, Identifiable {
        case grid = "그리드"
        case list = "리스트"
        var id: String { rawValue }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DS.Space.s4) {
                PageHeader(title: "인사이트", subtitle: "알림 분포 · 최근 알림 · 하락 TOP")

                if let insight = model.insight {
                    alertDistributionSection(insight.alertDistribution)

                    productSection(
                        title: "최근 알림",
                        icon: "bell",
                        emptyText: "알림이 없습니다",
                        items: alertCards(insight.recentAlerts)
                    )
                    productSection(
                        title: "하락 TOP",
                        icon: "arrow.down.right",
                        emptyText: "하락 감지 없음",
                        items: dropCards(insight.topDrops)
                    )
                } else {
                    ProgressView("데이터 로딩 중…")
                        .frame(maxWidth: .infinity, maxHeight: 300)
                }
            }
            .padding(DS.Space.s5)
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
        alerts.map { a in
            InsightCard(
                id: a.productId,
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
        drops.map { d in
            InsightCard(
                id: d.productId,
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

    // MARK: 알림 타입 분포

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

    // MARK: 상품 카드 섹션 (그리드/리스트 토글)

    private func productSection(title: String, icon: String, emptyText: String,
                                items: [InsightCard]) -> some View {
        VStack(alignment: .leading, spacing: DS.Space.s2) {
            HStack {
                Text(title).font(DS.Font.lg.weight(.semibold))
                Spacer()
                layoutPicker
            }
            if items.isEmpty {
                Text(emptyText).font(DS.Font.sm).foregroundStyle(.secondary)
            } else {
                switch layout {
                case .grid:
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 220), spacing: DS.Space.s3)], spacing: DS.Space.s3) {
                        ForEach(items) { item in
                            cardView(item)
                        }
                    }
                case .list:
                    VStack(spacing: DS.Space.s1) {
                        ForEach(items) { item in
                            cardRow(item)
                        }
                    }
                }
            }
        }
        .padding(DS.Space.s4)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: DS.Radius.lg))
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }

    private var layoutPicker: some View {
        Picker("보기", selection: $layout) {
            Label("그리드", systemImage: "square.grid.2x2").tag(Layout.grid)
            Label("리스트", systemImage: "list.bullet").tag(Layout.list)
        }
        .pickerStyle(.segmented)
        .labelsHidden()
        .frame(width: 140)
    }

    // 그리드 카드 — 이미지 상단 + 이름/가격/하락률/링크
    @ViewBuilder
    private func cardView(_ item: InsightCard) -> some View {
        VStack(alignment: .leading, spacing: DS.Space.s2) {
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
                        .font(DS.Font.xs)
                        .foregroundStyle(.white)
                        .padding(4)
                        .background(.black.opacity(0.45), in: .circle)
                        .padding(DS.Space.s2)
                }
            }
            .frame(height: 110)
            .frame(maxWidth: .infinity)
            .clipped()
            .background(Color.gray.opacity(0.15))

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
                    .font(DS.Font.sm.weight(.medium))
                    .lineLimit(2)
                    .foregroundStyle(.primary)
                HStack(spacing: 4) {
                    Text(item.priceText)
                        .font(DS.Font.sm.weight(.semibold))
                        .foregroundStyle(item.badgeType == "sold_out" ? DS.Color.warning : DS.Color.danger)
                    if let sub = item.subText {
                        Text(sub)
                            .font(DS.Font.xxs)
                            .foregroundStyle(.tertiary)
                            .lineLimit(1)
                    }
                }
            }
            .padding(.horizontal, DS.Space.s2)
            .padding(.bottom, DS.Space.s2)
        }
        .background(Color.black.opacity(0.2), in: RoundedRectangle(cornerRadius: DS.Radius.md))
        .overlay(
            RoundedRectangle(cornerRadius: DS.Radius.md)
                .stroke(Color.white.opacity(0.06), lineWidth: 1)
        )
        .contentShape(Rectangle())
        .onTapGesture { openProduct(item) }
        .help(item.productId)
    }

    // 리스트 행 — 썸네일 이미지 + 이름/가격 + 링크 아이콘
    private func cardRow(_ item: InsightCard) -> some View {
        HStack(spacing: DS.Space.s3) {
            if let url = item.image, let u = URL(string: url) {
                AsyncImage(url: u) { phase in
                    if case .success(let image) = phase {
                        image.resizable().scaledToFill()
                    } else {
                        placeholderImage
                    }
                }
                .frame(width: 48, height: 48)
                .clipShape(RoundedRectangle(cornerRadius: DS.Radius.sm))
            } else {
                placeholderImage.frame(width: 48, height: 48)
            }

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    if let mall = item.mall {
                        MallBadge(mall: mall)
                    }
                    if let badge = item.badgeType {
                        AlertBadge(type: badge)
                    }
                }
                Text(item.name ?? item.productId).font(DS.Font.sm.weight(.medium)).lineLimit(1)
                HStack(spacing: 4) {
                    Text(item.priceText)
                        .font(DS.Font.sm.weight(.semibold))
                        .foregroundStyle(item.badgeType == "sold_out" ? DS.Color.warning : DS.Color.danger)
                    if let sub = item.subText {
                        Text(sub).font(DS.Font.xxs).foregroundStyle(.tertiary).lineLimit(1)
                    }
                }
            }
            Spacer()
            if item.url != nil {
                Image(systemName: "arrow.up.right.square")
                    .foregroundStyle(DS.Color.primary)
            }
        }
        .padding(.vertical, DS.Space.s2)
        .padding(.horizontal, DS.Space.s2)
        .background(Color.black.opacity(0.12), in: RoundedRectangle(cornerRadius: DS.Radius.sm))
        .contentShape(Rectangle())
        .onTapGesture { openProduct(item) }
        .help(item.productId)
    }

    private var placeholderImage: some View {
        RoundedRectangle(cornerRadius: DS.Radius.sm)
            .fill(Color.gray.opacity(0.18))
            .overlay(Image(systemName: "photo").foregroundStyle(.secondary))
    }

    private func openProduct(_ item: InsightCard) {
        guard let url = item.url, let u = URL(string: url) else { return }
        NSWorkspace.shared.open(u)
    }
}