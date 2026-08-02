// ProductCardView.swift — 상품 카드 (리스트/상세 펼침)
// PLATFORM: macos
import AppKit
import SwiftUI

struct ProductCardView: View {
    @ObservedObject var store: ProductStore
    let product: Product

    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
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
                        Text(lastCheckedText)
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

            if isExpanded {
                Divider()
                PriceHistoryChartView(points: product.sortedPricePoints)
                    .frame(height: 110)
                statsRow
            }
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(Color(nsColor: .controlBackgroundColor))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color.primary.opacity(0.06), lineWidth: 1)
        )
        .contentShape(Rectangle())
        .onTapGesture { isExpanded.toggle() }
        .contextMenu {
            Button("브라우저에서 열기") { openInBrowser() }
            Button(isExpanded ? "상세 닫기" : "가격 이력 보기") { isExpanded.toggle() }
            Divider()
            Button("목표가 설정…") { promptTargetPrice() }
            Button("삭제", role: .destructive) { deleteProduct() }
        }
    }

    // MARK: - 서브뷰

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

    @ViewBuilder
    private var priceRow: some View {
        if let stats = store.stats(for: product) {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(stats.current.formatted(.number))
                    .font(.title3.bold())
                    .monospacedDigit()
                Text("원")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                changeBadge(stats)
            }
        } else {
            Text("가격 정보 없음")
                .font(.callout)
                .foregroundStyle(.secondary)
        }
    }

    private func changeBadge(_ stats: PriceStats) -> some View {
        Group {
            if stats.isDrop {
                Label("\(abs(stats.changeAmount).formatted(.number))", systemImage: "arrow.down.right")
                    .foregroundStyle(.green)
            } else if stats.isRise {
                Label("\(stats.changeAmount.formatted(.number))", systemImage: "arrow.up.right")
                    .foregroundStyle(.red)
            } else {
                Text("변동 없음")
                    .foregroundStyle(.secondary)
            }
        }
        .font(.caption2.weight(.semibold))
    }

    private var statsRow: some View {
        HStack(spacing: 12) {
            if let stats = store.stats(for: product) {
                statItem("최고", stats.max.formatted(.number))
                statItem("최저", stats.min.formatted(.number))
                statItem("평균", stats.average.formatted(.number))
                if let target = product.targetPrice {
                    statItem("목표가", target.formatted(.number), highlight: true)
                }
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
        .font(.caption)
    }

    private func statItem(_ title: String, _ value: String, highlight: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(title).foregroundStyle(.secondary)
            Text(value)
                .font(.caption.weight(.semibold))
                .foregroundStyle(highlight ? Color.accentColor : .primary)
        }
    }

    private var lastCheckedText: String {
        guard let last = product.lastCheckedAt else { return "확인 전" }
        return "\(last.formatted(date: .omitted, time: .shortened)) 확인"
    }

    // MARK: - 액션

    private func openInBrowser() {
        guard let url = product.productURL else { return }
        NSWorkspace.shared.open(url)
        DebugLogger.shared.push(
            level: .ACTION,
            category: "OPEN",
            message: "브라우저에서 상품 열기",
            meta: ["productID": product.productID, "url": url.absoluteString]
        )
    }

    private func promptTargetPrice() {
        let alert = NSAlert()
        alert.messageText = "목표가 설정"
        alert.informativeText = "이 가격 이하로 떨어지면 알림을 보냅니다. (0 입력 시 해제)"
        alert.addButton(withTitle: "설정")
        alert.addButton(withTitle: "취소")

        let input = NSTextField(frame: NSRect(x: 0, y: 0, width: 220, height: 24))
        input.placeholderString = "예: 50000"
        if let current = product.currentPrice {
            input.stringValue = String(current)
        }
        alert.accessoryView = input

        NSApp.activate(ignoringOtherApps: true)
        guard alert.runModal() == .alertFirstButtonReturn else { return }

        let raw = input.stringValue.trimmingCharacters(in: .whitespaces)
        if raw.isEmpty || Int(raw) == 0 {
            store.updateTargetPrice(nil, for: product)
        } else if let value = Int(raw), value > 0 {
            store.updateTargetPrice(value, for: product)
        }
        DebugLogger.shared.push(
            level: .ACTION,
            category: "TARGET",
            message: "목표가 설정",
            meta: ["productID": product.productID, "target": Int(raw) ?? 0]
        )
    }

    private func deleteProduct() {
        let alert = NSAlert()
        alert.messageText = "상품 삭제"
        alert.informativeText = "'\(product.name)'를(을) 추적 목록에서 삭제할까요?"
        alert.addButton(withTitle: "삭제")
        alert.addButton(withTitle: "취소")
        guard alert.runModal() == .alertFirstButtonReturn else { return }
        store.delete(product)
        DebugLogger.shared.push(
            level: .ACTION,
            category: "DELETE",
            message: "상품 삭제",
            meta: ["productID": product.productID]
        )
    }
}
