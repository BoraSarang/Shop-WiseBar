// NaverFetcher.swift — 네이버 스마트스토어/쇼핑 카탈로그 HTTP 수집
// 수집 순서: __INITIAL_STATE__ JSON → og 태그 폴백
// PLATFORM: macos
import Foundation

final class NaverFetcher: PriceFetching {
    let mall: Mall = .naver

    private let session: URLSession
    private let userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"

    init() {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 8
        config.timeoutIntervalForResource = 12
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.httpAdditionalHeaders = [
            "User-Agent": userAgent,
            "Accept-Language": "ko-KR,ko;q=0.9",
            "Accept": "text/html,application/xhtml+xml"
        ]
        session = URLSession(configuration: config)
    }

    func fetch(productID: String) async throws -> ProductInfo {
        let parts = productID.split(separator: ":", maxSplits: 2).map(String.init)

        switch parts.first ?? "" {
        case "c":
            guard parts.count == 2, let url = URL(string: "https://search.shopping.naver.com/catalog/\(parts[1])") else {
                throw AppError.invalidURL()
            }
            return try await fetchCatalog(url)
        case "brand":
            guard parts.count == 3, let url = URL(string: "https://brand.naver.com/\(parts[1])/products/\(parts[2])") else {
                throw AppError(code: "E-MAC-VALID-2003", debugMessage: "네이버 브랜드 상품 ID 형식 오류")
            }
            return try await fetchProductPage(url, kind: "네이버 브랜드")
        case "store":
            guard parts.count == 3, let url = URL(string: "https://smartstore.naver.com/\(parts[1])/products/\(parts[2])") else {
                throw AppError(code: "E-MAC-VALID-2003", debugMessage: "네이버 스마트스토어 상품 ID 형식 오류")
            }
            return try await fetchProductPage(url, kind: "네이버 스마트스토어")
        default:
            throw AppError(code: "E-MAC-VALID-2003", debugMessage: "알 수 없는 네이버 상품 ID: \(productID)")
        }
    }

    // MARK: - 상품 페이지 (스마트스토어/브랜드 공용)

    private func fetchProductPage(_ url: URL, kind: String) async throws -> ProductInfo {
        let html = try await loadHTML(url)
        DebugLogger.shared.push(
            level: .API_RES,
            category: "COLLECT",
            message: "\(kind) HTML 수신",
            meta: ["url": url.absoluteString, "bytes": html.count]
        )

        // 1) __INITIAL_STATE__ JSON (레거시 SSR)
        if let state = HTMLParser.extractJSON(from: html, marker: "__INITIAL_STATE__", keyPrefix: "\"") {
            if let info = parseInitialState(state) {
                return info
            }
        }
        // 2) __NEXT_DATA__ JSON (최신 Next.js SSR)
        if let data = HTMLParser.extractJSON(from: html, marker: "__NEXT_DATA__", keyPrefix: "\"") {
            if let info = parseNextData(data) {
                return info
            }
        }
        // 3) og 태그 폴백
        if let info = parseOG(html) {
            return info
        }
        throw AppError.fetchFailed()
    }

    private func parseNextData(_ data: [String: Any]) -> ProductInfo? {
        let namePaths = [
            "props.pageProps.initialState.product.originProduct.name",
            "props.pageProps.initialState.product.name",
            "props.pageProps.initialState.goods.name"
        ]
        let pricePaths = [
            "props.pageProps.initialState.product.originProduct.salePrice",
            "props.pageProps.initialState.product.salePrice",
            "props.pageProps.initialState.product.purchasePrice",
            "props.pageProps.initialState.goods.salePrice"
        ]
        let imagePaths = [
            "props.pageProps.initialState.product.originProduct.representativeImageUrl",
            "props.pageProps.initialState.product.mainImageUrl",
            "props.pageProps.initialState.goods.representativeImage.url"
        ]
        var name: String?
        var price: Int?
        var image = ""
        for path in namePaths {
            if let value: String = HTMLParser.value(in: data, keyPath: path) { name = value; break }
        }
        for path in pricePaths {
            if let value: Int = HTMLParser.value(in: data, keyPath: path) { price = value; break }
        }
        for path in imagePaths {
            if let value: String = HTMLParser.value(in: data, keyPath: path) { image = value; break }
        }
        guard let name, let price else { return nil }
        return ProductInfo(name: HTMLParser.unescape(name), price: price, imageURLString: image)
    }

    private func parseInitialState(_ state: [String: Any]) -> ProductInfo? {
        let keyPaths = [
            "product.name", "productName", "content.product.name", "goods.name"
        ]
        let pricePaths = [
            "product.purchasePrice", "product.salePrice", "product.price",
            "content.product.purchasePrice", "goods.purchasePrice"
        ]
        let imagePaths = [
            "product.mainImageUrl", "product.representativeImageUrl",
            "content.product.mainImageUrl", "goods.representativeImage.url"
        ]

        var name: String?
        for path in keyPaths {
            if let value: String = HTMLParser.value(in: state, keyPath: path) {
                name = value
                break
            }
        }
        var price: Int?
        for path in pricePaths {
            if let value: Int = HTMLParser.value(in: state, keyPath: path) {
                price = value
                break
            }
        }
        var image: String = ""
        for path in imagePaths {
            if let value: String = HTMLParser.value(in: state, keyPath: path) {
                image = value
                break
            }
        }
        guard let name, let price else { return nil }
        return ProductInfo(name: HTMLParser.unescape(name), price: price, imageURLString: image)
    }

    // MARK: - 쇼핑 카탈로그 (c_ 접두)

    private func fetchCatalog(_ url: URL) async throws -> ProductInfo {
        let html = try await loadHTML(url)
        DebugLogger.shared.push(
            level: .API_RES,
            category: "COLLECT",
            message: "네이버 카탈로그 HTML 수신",
            meta: ["url": url.absoluteString, "bytes": html.count]
        )

        // __NEXT_DATA__: props.pageProps.initialState.product.salePrice 등
        if let data = HTMLParser.extractJSON(from: html, marker: "__NEXT_DATA__", keyPrefix: "\"") {
            let pricePaths = [
                "props.pageProps.initialState.product.salePrice",
                "props.pageProps.initialState.productItem.product.price",
                "props.pageProps.initialState.product.price"
            ]
            let namePaths = [
                "props.pageProps.initialState.product.name",
                "props.pageProps.initialState.productItem.product.name"
            ]
            let imagePaths = [
                "props.pageProps.initialState.product.mainImage",
                "props.pageProps.initialState.productItem.product.image"
            ]
            var name: String?
            var price: Int?
            var image = ""
            for path in namePaths {
                if let value: String = HTMLParser.value(in: data, keyPath: path) { name = value; break }
            }
            for path in pricePaths {
                if let value: Int = HTMLParser.value(in: data, keyPath: path) { price = value; break }
            }
            for path in imagePaths {
                if let value: String = HTMLParser.value(in: data, keyPath: path) { image = value; break }
            }
            if let name, let price {
                return ProductInfo(name: HTMLParser.unescape(name), price: price, imageURLString: image)
            }
        }
        if let info = parseOG(html) {
            return info
        }
        throw AppError.fetchFailed()
    }

    // MARK: - 공용

    private func parseOG(_ html: String) -> ProductInfo? {
        guard let title = HTMLParser.firstMatch(#"<meta property="og:title" content="([^"]+)""#, in: html) else {
            return nil
        }
        let image = HTMLParser.firstMatch(#"<meta property="og:image" content="([^"]+)""#, in: html) ?? ""
        let priceText = HTMLParser.firstMatch(#"<meta property="product:price:amount" content="([0-9,]+)""#, in: html)
        guard let price = priceText.flatMap({ HTMLParser.toInt($0) }) else { return nil }
        return ProductInfo(
            name: HTMLParser.unescape(title),
            price: price,
            imageURLString: image
        )
    }

    private func loadHTML(_ url: URL) async throws -> String {
        do {
            let (data, response) = try await session.data(from: url)
            guard let http = response as? HTTPURLResponse else {
                throw AppError.fetchFailed()
            }
            guard (200..<300).contains(http.statusCode) else {
                throw AppError(
                    code: "E-MAC-NET-1003",
                    debugMessage: "HTTP \(http.statusCode) 응답",
                    cause: AppError.fetchFailed()
                )
            }
            return String(data: data, encoding: .utf8) ?? String(decoding: data, as: UTF8.self)
        } catch let error as AppError {
            throw error
        } catch {
            throw AppError.network().with(cause: error)
        }
    }
}
