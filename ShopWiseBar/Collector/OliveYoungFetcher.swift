// OliveYoungFetcher.swift — 올리브영 상품 상세 HTTP 수집
// 파싱: og 태그(이름/이미지) + tx_num 가격 패턴
// productID 규약: goodsNo 또는 "oyrun:{단축URL}"
// PLATFORM: macos
import Foundation

final class OliveYoungFetcher: PriceFetching {
    let mall: Mall = .oliveyoung

    private let session: URLSession

    init() {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 8
        config.timeoutIntervalForResource = 12
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.httpAdditionalHeaders = [
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
            "Accept-Language": "ko-KR,ko;q=0.9"
        ]
        session = URLSession(configuration: config)
    }

    func fetch(productID: String) async throws -> ProductInfo {
        if productID.hasPrefix("oyrun:") {
            let shortURL = String(productID.dropFirst("oyrun:".count))
            guard let url = URL(string: shortURL) else { throw AppError.invalidURL() }
            return try await fetchShortURL(url)
        }
        return try await fetch(goodsNo: productID)
    }

    /// 표준 상세 페이지 조회 (goodsNo)
    private func fetch(goodsNo: String) async throws -> ProductInfo {
        var components = URLComponents(string: "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do")!
        components.queryItems = [URLQueryItem(name: "goodsNo", value: goodsNo)]
        guard let url = components.url else { throw AppError.invalidURL() }

        let html = try await loadHTML(url)
        return try parseDetail(html, url: url, goodsNo: goodsNo)
    }

    /// oy.run 단축 URL: __SERVER_DATA__.targetUrl 해석 → goodsNo 표준 조회
    private func fetchShortURL(_ shortURL: URL) async throws -> ProductInfo {
        DebugLogger.shared.push(
            level: .API_REQ,
            category: "COLLECT",
            message: "oy.run 단축 URL 해석",
            meta: ["url": shortURL.absoluteString]
        )
        let html = try await loadHTML(shortURL)

        // window.__SERVER_DATA__ = {"targetUrl":"...goodsNo=...",...}
        if let data = HTMLParser.extractJSON(from: html, marker: "__SERVER_DATA__", keyPrefix: "{") {
            if let targetUrl: String = HTMLParser.value(in: data, keyPath: "targetUrl"),
               let url = URL(string: targetUrl),
               let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
               let goodsNo = components.queryItems?.first(where: { $0.name == "goodsNo" })?.value,
               !goodsNo.isEmpty {
                DebugLogger.shared.push(
                    level: .API_RES,
                    category: "COLLECT",
                    message: "oy.run → goodsNo 해석 완료",
                    meta: ["goodsNo": goodsNo]
                )
                return try await fetch(goodsNo: goodsNo)
            }
        }
        throw AppError.fetchFailed()
    }

    // MARK: - 파싱

    private func parseDetail(_ html: String, url: URL, goodsNo: String) throws -> ProductInfo {
        DebugLogger.shared.push(
            level: .API_RES,
            category: "COLLECT",
            message: "올리브영 HTML 수신",
            meta: ["url": url.absoluteString, "goodsNo": goodsNo, "bytes": html.count]
        )

        // 1) 이름/이미지: og 태그 (상품명이면 통과, 몰 셸 제목이면 실패)
        guard let title = HTMLParser.firstMatch(#"<meta property="og:title" content="([^"]+)""#, in: html) else {
            throw AppError.fetchFailed()
        }
        let image = HTMLParser.firstMatch(#"<meta property="og:image" content="([^"]+)""#, in: html) ?? ""

        // 2) 가격: ① Next.js JSON salePrice ② data-qa discount-price ③ tx_num 레거시
        let priceText = HTMLParser.firstMatch(#"salePrice\\":(\d+)"#, in: html)
            ?? HTMLParser.firstMatch(#"data-qa-name="text-product-discount-price"><span>([0-9,]+)</span>"#, in: html)
            ?? HTMLParser.firstMatch(#"판매가[\s\S]{0,300}?<em class="tx_num">([0-9,]+)</em>"#, in: html)
            ?? HTMLParser.firstMatch(#"<em class="tx_num">([0-9,]+)</em>"#, in: html)
        guard let price = priceText.flatMap({ HTMLParser.toInt($0) }) else {
            throw AppError.fetchFailed()
        }

        return ProductInfo(
            name: HTMLParser.unescape(title),
            price: price,
            imageURLString: image
        )
    }

    // MARK: - 네트워크

    private func loadHTML(_ url: URL) async throws -> String {
        do {
            let (data, response) = try await session.data(from: url)
            guard let http = response as? HTTPURLResponse else {
                throw AppError.fetchFailed()
            }
            guard (200..<300).contains(http.statusCode) else {
                throw AppError(code: "E-MAC-NET-1003", debugMessage: "HTTP \(http.statusCode) 응답")
            }
            return String(data: data, encoding: .utf8) ?? String(decoding: data, as: UTF8.self)
        } catch let error as AppError {
            throw error
        } catch {
            throw AppError.network().with(cause: error)
        }
    }
}
