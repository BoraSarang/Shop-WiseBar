// ProductStore.swift — SwiftData 저장소 + 가격 통계 (메인 액터)
// PLATFORM: macos
import Foundation
import SwiftData

struct PriceStats {
    let current: Int
    let min: Int
    let max: Int
    let average: Int
    let changeAmount: Int   // 마지막 포인트 vs 직전 포인트
    let changePercent: Double

    var isDrop: Bool { changeAmount < 0 }
    var isRise: Bool { changeAmount > 0 }
}

@MainActor
final class ProductStore: ObservableObject {
    static let shared = ProductStore()

    @Published private(set) var products: [Product] = []

    let container: ModelContainer
    private let context: ModelContext

    private init() {
        do {
            container = try ModelContainer(for: Product.self, PricePoint.self)
            context = container.mainContext
        } catch {
            fatalError("ModelContainer 생성 실패: \(error)")
        }
        reload()
    }

    // MARK: - 조회

    func reload() {
        let descriptor = FetchDescriptor<Product>(sortBy: [SortDescriptor(\.createdAt)])
        products = (try? context.fetch(descriptor)) ?? []
    }

    func product(id: UUID) -> Product? {
        products.first { $0.id == id }
    }

    /// 가격 이력 통계 (포인트 1개면 직전 변동 0)
    func stats(for product: Product) -> PriceStats? {
        let points = product.sortedPricePoints
        guard let current = product.currentPrice, !points.isEmpty else { return nil }

        let prices = points.map(\.price)
        let minPrice = prices.min() ?? current
        let maxPrice = prices.max() ?? current
        let average = prices.reduce(0, +) / max(prices.count, 1)

        var changeAmount = 0
        if points.count >= 2 {
            changeAmount = points[points.count - 1].price - points[points.count - 2].price
        }
        let changePercent = changeAmount == 0 ? 0 : Double(changeAmount) / Double(max(points[points.count - 2].price, 1)) * 100

        return PriceStats(
            current: current,
            min: minPrice,
            max: maxPrice,
            average: average,
            changeAmount: changeAmount,
            changePercent: changePercent
        )
    }

    // MARK: - 쓰기

    @discardableResult
    func addProduct(mall: Mall, productID: String, name: String, imageURLString: String = "", urlString: String, targetPrice: Int? = nil) -> Product {
        let product = Product(
            mall: mall,
            productID: productID,
            name: name,
            imageURLString: imageURLString,
            urlString: urlString,
            targetPrice: targetPrice
        )
        context.insert(product)
        save()
        reload()
        return product
    }

    func delete(_ product: Product) {
        context.delete(product)
        save()
        reload()
    }

    /// 가격 포인트 추가 + 상품 갱신 (중복 가격은 이력에 추가하지 않되 lastCheckedAt 갱신)
    @discardableResult
    func recordPrice(_ price: Int, for product: Product) -> Bool {
        let changed: Bool
        if let last = product.sortedPricePoints.last, last.price == price {
            changed = false
        } else {
            let point = PricePoint(price: price)
            point.product = product
            product.pricePoints.append(point)
            changed = true
        }
        product.lastPrice = price
        product.lastCheckedAt = Date()
        save()
        return changed
    }

    func updateTargetPrice(_ target: Int?, for product: Product) {
        product.targetPrice = target
        save()
    }

    func updateNameAndImage(_ product: Product, name: String, imageURLString: String) {
        product.name = name
        product.imageURLString = imageURLString
        save()
    }

    // MARK: - 기타

    func save() {
        do {
            try context.save()
        } catch {
            DebugLogger.shared.push(
                level: .ERROR,
                category: "DB",
                message: "저장 실패",
                meta: ["code": "E-MAC-DB-4001", "cause": String(describing: error)]
            )
        }
    }
}
