// Models.swift — SwiftData 상품/가격 이력 모델
// PLATFORM: macos
import Foundation
import SwiftData

@Model
final class Product {
    @Attribute(.unique) var id: UUID
    var mallRaw: String
    var productID: String
    var name: String
    var imageURLString: String
    var urlString: String
    var targetPrice: Int?
    var createdAt: Date
    var lastCheckedAt: Date?
    var lastPrice: Int?

    @Relationship(deleteRule: .cascade, inverse: \PricePoint.product)
    var pricePoints: [PricePoint] = []

    init(
        mall: Mall,
        productID: String,
        name: String,
        imageURLString: String = "",
        urlString: String,
        targetPrice: Int? = nil,
        createdAt: Date = Date()
    ) {
        self.id = UUID()
        self.mallRaw = mall.rawValue
        self.productID = productID
        self.name = name
        self.imageURLString = imageURLString
        self.urlString = urlString
        self.targetPrice = targetPrice
        self.createdAt = createdAt
    }

    var mall: Mall { Mall(rawValue: mallRaw) ?? .naver }

    var productURL: URL? { URL(string: urlString) }

    var sortedPricePoints: [PricePoint] {
        pricePoints.sorted { $0.date < $1.date }
    }

    var currentPrice: Int? {
        lastPrice ?? sortedPricePoints.last?.price
    }
}

@Model
final class PricePoint {
    var price: Int
    var date: Date
    var product: Product?

    init(price: Int, date: Date = Date()) {
        self.price = price
        self.date = date
    }
}
