// NaverFetcher.swift — 네이버 스마트스토어/브랜드/카탈로그 브라우저 세션 수집 (P2)
// 방식: Chrome/Whale/Edge에 m. 모바일 상품 페이지를 열고 JS로 가격 추출
//  - HTTP 직접 수집 불가(429 차단) → 브라우저 세션으로 전환 (실측 완료)
//  - 가격 패턴: body 텍스트 "상품 가격" 다음 금액 (데스크톱/모바일 공통 실측)
// PLATFORM: macos
import Foundation

final class NaverFetcher: PriceFetching {
    let mall: Mall = .naver

    private let browser = BrowserSessionFetcher.shared

    func fetch(productID: String) async throws -> ProductInfo {
        let parts = productID.split(separator: ":", maxSplits: 2).map(String.init)

        guard let url = pageURL(from: parts) else {
            throw AppError(
                code: "E-MAC-VALID-2003",
                debugMessage: "네이버 상품 ID 형식 오류: \(productID)"
            )
        }

        let result = try await browser.fetchNaverProduct(url: url)
        guard let price = result.priceInt, price > 0 else {
            DebugLogger.shared.push(
                level: .WARN,
                category: "COLLECT",
                message: "네이버 가격 미추출",
                meta: ["code": "E-MAC-VALID-2003", "url": url.absoluteString, "price": result.price ?? "nil"]
            )
            throw AppError.fetchFailed()
        }
        return ProductInfo(
            name: result.title ?? "네이버 상품",
            price: price,
            imageURLString: result.image ?? ""
        )
    }

    /// productID → m. 모바일 페이지 URL
    private func pageURL(from parts: [String]) -> URL? {
        switch parts.first ?? "" {
        case "c":
            guard parts.count == 2 else { return nil }
            return URL(string: "https://m.search.shopping.naver.com/catalog/\(parts[1])")
        case "brand":
            guard parts.count == 3 else { return nil }
            return URL(string: "https://m.brand.naver.com/\(parts[1])/products/\(parts[2])")
        case "store":
            guard parts.count == 3 else { return nil }
            return URL(string: "https://m.smartstore.naver.com/\(parts[1])/products/\(parts[2])")
        default:
            return nil
        }
    }
}
