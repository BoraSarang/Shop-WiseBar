// ProductInfo.swift — 가격 수집 결과 (HTTP 파싱 산출물)
// PLATFORM: macos
import Foundation

struct ProductInfo {
    let name: String
    let price: Int
    let imageURLString: String
}

/// 몰별 가격 수집기 프로토콜
protocol PriceFetching {
    var mall: Mall { get }
    /// 상품 1개 정보 조회. 실패 시 AppError 발생 (에러코드 필수)
    func fetch(productID: String) async throws -> ProductInfo
}
