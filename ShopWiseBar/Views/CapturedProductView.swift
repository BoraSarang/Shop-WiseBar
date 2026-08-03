// CapturedProductView.swift — 캐치 상품 상세 (T-57)
// 브라우저에서 상품 페이지를 보는 동안 표시: 상품 정보 + 기간별 가격 추이 + 통계 + 절약액
// 참고: pricearchive.org (최저/최고/평균 + 최저가 판정) / AliHelper (기간 탭, 절약액)
// PLATFORM: macos
import SwiftUI

struct CapturedProductView: View {
    let product: CapturedProduct
    @ObservedObject private var store = ProductStore.shared
    @ObservedObject private var popoverState = PopoverState.shared

    @State private var selectedPeriod: PricePeriod = .week

    enum PricePeriod: String, CaseIterable, Identifiable {
        case week = "7일"
        case month = "1개월"
        case all = "전체"

        var id: String { rawValue }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            productHeader
            actionRow
            Divider()
            priceSection
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(Color(nsColor: .controlBackgroundColor))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color.accentColor.opacity(0.35), lineWidth: 1.5)
        )
    }

    // MARK: - 상품 정보

    private var productHeader: some View {
        HStack(alignment: .top, spacing: 10) {
            productImage
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 4) {
                    Image(systemName: product.mall.iconName)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text(product.mall.displayName)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text("·")
                        .foregroundStyle(.tertiary)
                    Text("방금 본 상품")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                Text(product.name)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                priceRow
            }
            Spacer(minLength: 0)
        }
    }

    private var productImage: some View {
        Group {
            if let url = URL(string: product.imageURLString), !product.imageURLString.isEmpty {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFit()
                    default:
                        placeholderImage
                    }
                }
            } else {
                placeholderImage
            }
        }
        .frame(width: 52, height: 52)
        .background(Color(nsColor: .quaternaryLabelColor).opacity(0.15))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private var placeholderImage: some View {
        Image(systemName: product.mall.iconName)
            .font(.system(size: 20))
            .foregroundStyle(.secondary)
            .frame(width: 52, height: 52)
    }

    private var priceRow: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            if let price = displayPrice {
                Text(price.formatted(.number))
                    .font(.title3.bold())
                    .monospacedDigit()
                Text("원")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                changeBadge
            } else {
                Text("가격 정보 없음")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private var changeBadge: some View {
        if filteredPoints.count >= 2, let current = displayPrice {
            let prev = filteredPoints[filteredPoints.count - 2].price
            let diff = current - prev
            if diff < 0 {
                Label("\(abs(diff).formatted(.number))", systemImage: "arrow.down.right")
                    .foregroundStyle(.green)
            } else if diff > 0 {
                Label("\(diff.formatted(.number))", systemImage: "arrow.up.right")
                    .foregroundStyle(.red)
            } else {
                Text("변동 없음")
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - 액션 행

    private var actionRow: some View {
        HStack(spacing: 8) {
            if product.isWatched {
                Label("찜됨", systemImage: "checkmark.seal.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.accentColor)
            } else {
                Button {
                    Task { await addSuggested() }
                } label: {
                    if popoverState.isAddingSuggested {
                        ProgressView().controlSize(.mini)
                    } else {
                        Label("추적 시작", systemImage: "plus")
                    }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
                .disabled(popoverState.isAddingSuggested)
            }
            if let target = product.targetPrice {
                Text("목표가 \(target.formatted(.number))원")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button {
                openInBrowser()
            } label: {
                Label("열기", systemImage: "arrow.up.right.square")
                    .font(.caption)
            }
            .buttonStyle(.borderless)
        }
    }

    // MARK: - 가격 추이

    private var priceSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Text("가격 추이")
                    .font(.caption.bold())
                Spacer()
                Picker("기간", selection: $selectedPeriod) {
                    ForEach(PricePeriod.allCases) { period in
                        Text(period.rawValue).tag(period)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 170)
                .controlSize(.mini)
            }
            PriceHistoryChartView(points: filteredPoints)
                .frame(height: 100)
            statsRow
            savingsText
        }
    }

    private var statsRow: some View {
        HStack(spacing: 12) {
            if let stats {
                statItem("최저", stats.min.formatted(.number))
                statItem("최고", stats.max.formatted(.number))
                statItem("평균", stats.avg.formatted(.number))
                if isAtLowest {
                    Label("현재 최저가", systemImage: "checkmark.circle.fill")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.green)
                }
            }
            Spacer()
        }
        .font(.caption)
    }

    private var savingsText: some View {
        Group {
            if let stats, let current = displayPrice, current > stats.min {
                Text("이 기간 최저가보다 \(formatDiff(current - stats.min))원 비싸요 — 아껴보세요")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            } else if isAtLowest {
                Text("이 기간 중 최저가예요!")
                    .font(.caption2)
                    .foregroundStyle(.green)
            }
        }
    }

    private func statItem(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(title).foregroundStyle(.secondary)
            Text(value)
                .font(.caption.weight(.semibold))
                .monospacedDigit()
        }
    }

    private func formatDiff(_ value: Int) -> String {
        value.formatted(.number)
    }

    // MARK: - 계산

    private var filteredPoints: [PricePoint] {
        switch selectedPeriod {
        case .all:
            return product.pricePoints
        case .week, .month:
            let days = selectedPeriod == .week ? 7 : 30
            guard let cutoff = Calendar.current.date(byAdding: .day, value: -days, to: Date()) else {
                return product.pricePoints
            }
            return product.pricePoints.filter { $0.date >= cutoff }
        }
    }

    private var displayPrice: Int? {
        product.currentPrice ?? filteredPoints.last?.price
    }

    private var stats: (min: Int, max: Int, avg: Int)? {
        guard !filteredPoints.isEmpty else { return nil }
        let prices = filteredPoints.map(\.price)
        let min = prices.min() ?? 0
        let max = prices.max() ?? 0
        let avg = prices.reduce(0, +) / prices.count
        return (min, max, avg)
    }

    private var isAtLowest: Bool {
        guard let stats, let current = displayPrice, filteredPoints.count >= 2 else { return false }
        return current == stats.min
    }

    // MARK: - 액션

    private func addSuggested() async {
        popoverState.isAddingSuggested = true
        defer { popoverState.isAddingSuggested = false }
        let result = await PriceFetchCoordinator.shared.addFromURL(product.urlString)
        switch result {
        case .success:
            popoverState.capturedProduct = popoverState.capturedProduct?.with(isWatched: true)
            DebugLogger.shared.push(
                level: .ACTION,
                category: "ADD",
                message: "캐치 → 추적 등록 완료",
                meta: ["productID": product.id]
            )
        case .failure(let error):
            DebugLogger.shared.push(
                level: .WARN,
                category: "ADD",
                message: "캐치 추적 등록 실패",
                meta: ["code": error.code, "productID": product.id]
            )
        }
    }

    private func openInBrowser() {
        guard let url = product.productURL else { return }
        NSWorkspace.shared.open(url)
        DebugLogger.shared.push(
            level: .ACTION,
            category: "OPEN",
            message: "브라우저에서 상품 열기 (캐치)",
            meta: ["productID": product.id, "url": url.absoluteString]
        )
    }
}
