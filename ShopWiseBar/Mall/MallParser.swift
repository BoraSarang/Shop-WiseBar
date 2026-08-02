// MallParser.swift — 상품 URL 파싱 → 몰 판별 + 상품 ID 추출
// 지원 형식 (P1):
//   네이버 브랜드  https://brand.naver.com/{store}/products/{id}
//   쿠팡          https://www.coupang.com/vp/products/{id}
//   네이버         https://smartstore.naver.com/{store}/products/{id}
//                  https://search.shopping.naver.com/catalog/{id}?cat_id=...
//   올리브영       https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo={no}
//                  https://oy.run/{short} (리다이렉트, 페처가 해석)
// productID 규약: "store:{store}:{id}" / "brand:{store}:{id}" / "c:{id}" / "oyrun:{url}"
// PLATFORM: macos
import Foundation

struct ParsedProduct {
    let mall: Mall
    let productID: String
    let url: URL
}

enum MallParser {
    /// URL 문자열 → ParsedProduct. 실패 시 nil (E-MAC-VALID-2001/2002 매핑은 호출부)
    static func parse(_ urlString: String) -> ParsedProduct? {
        let trimmed = urlString.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: trimmed), let host = url.host?.lowercased() else {
            return nil
        }

        // --- 쿠팡 ---
        if host.contains("coupang.com") {
            if let id = extractProductID(fromPath: url.path, pattern: #"/vp/products/(\d+)"#) {
                return ParsedProduct(mall: .coupang, productID: id, url: url)
            }
            return nil
        }

        // --- 네이버 브랜드 ---
        if host.contains("brand.naver.com") {
            let match = matchGroups(pattern: #"/([a-zA-Z0-9_-]+)/products/(\d+)"#, in: url.path)
            if match.count >= 2 {
                return ParsedProduct(mall: .naver, productID: "brand:\(match[0]):\(match[1])", url: url)
            }
            return nil
        }

        // --- 네이버 스마트스토어 / 쇼핑 카탈로그 ---
        if host.contains("smartstore.naver.com") {
            let match = matchGroups(pattern: #"/products/(\d+)"#, in: url.path)
            let store = matchGroups(pattern: #"/([a-zA-Z0-9_-]+)/products/"#, in: url.path).first
            if let match = match.first, let store {
                return ParsedProduct(mall: .naver, productID: "store:\(store):\(match)", url: url)
            }
            return nil
        }
        if host.contains("search.shopping.naver.com") {
            if let id = extractProductID(fromPath: url.path, pattern: #"/catalog/(\d+)"#) {
                return ParsedProduct(mall: .naver, productID: "c:\(id)", url: url)
            }
            return nil
        }

        // --- 올리브영 ---
        if host.contains("oliveyoung.co.kr") {
            let queryItems = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
            if let goodsNo = queryItems.first(where: { $0.name == "goodsNo" })?.value, !goodsNo.isEmpty {
                return ParsedProduct(mall: .oliveyoung, productID: goodsNo, url: url)
            }
            return nil
        }

        // --- 올리브영 단축 URL (oy.run) ---
        if host.contains("oy.run") {
            return ParsedProduct(mall: .oliveyoung, productID: "oyrun:\(url.absoluteString)", url: url)
        }

        return nil
    }

    /// 정규식 전체 매치 그룹 반환
    private static func matchGroups(pattern: String, in string: String) -> [String] {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }
        let range = NSRange(string.startIndex..., in: string)
        guard let match = regex.firstMatch(in: string, range: range) else { return [] }
        return (1..<match.numberOfRanges).compactMap { idx -> String? in
            let r = match.range(at: idx)
            guard r.location != NSNotFound, let swiftRange = Range(r, in: string) else { return nil }
            return String(string[swiftRange])
        }
    }

    private static func extractProductID(fromPath path: String, pattern: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        let range = NSRange(path.startIndex..., in: path)
        guard let match = regex.firstMatch(in: path, range: range),
              match.numberOfRanges > 1,
              let idRange = Range(match.range(at: 1), in: path) else {
            return nil
        }
        return String(path[idRange])
    }
}
