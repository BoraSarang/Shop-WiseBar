// CoupangFetcher.swift — 쿠팡 브라우저 세션 수집 (P2)
// Akamai 방어 → 직접 HTTP 금지, Chrome/Whale 브라우저 세션으로 수집
// 가격 패턴: body "N%" 다음 줄 금액 (실측: 27%→1,339,000원 / 23%→6,140원)
// PLATFORM: macos
import Foundation

final class CoupangFetcher: PriceFetching {
    let mall: Mall = .coupang

    private let browser = BrowserSessionFetcher.shared

    func fetch(productID: String) async throws -> ProductInfo {
        guard let url = pageURL(productID: productID) else {
            throw AppError(
                code: "E-MAC-VALID-2003",
                debugMessage: "쿠팡 상품 ID 형식 오류: \(productID)"
            )
        }
        let result = try await browser.fetchCoupangProduct(url: url)
        guard let price = result.priceInt, price > 0 else {
            DebugLogger.shared.push(
                level: .WARN,
                category: "COLLECT",
                message: "쿠팡 가격 미추출",
                meta: ["code": "E-MAC-VALID-2003", "url": url.absoluteString, "price": result.price ?? "nil"]
            )
            throw AppError.fetchFailed()
        }
        return ProductInfo(
            name: result.title ?? "쿠팡 상품",
            price: price,
            imageURLString: result.image ?? ""
        )
    }

    /// productID → 쿠팡 상품 페이지 URL
    private func pageURL(productID: String) -> URL? {
        guard let id = productID.split(separator: ":").last else { return nil }
        return URL(string: "https://www.coupang.com/vp/products/\(id)")
    }
}
