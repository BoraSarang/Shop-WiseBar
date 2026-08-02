// PriceFetchCoordinator.swift — 가격 수집 오케스트레이션 (몰 디스패치 + 기록 + 알림 트리거)
// PLATFORM: macos
import Foundation

@MainActor
final class PriceFetchCoordinator {
    static let shared = PriceFetchCoordinator()

    private let store = ProductStore.shared
    private let notifications = NotificationEngine.shared

    private var fetchers: [Mall: PriceFetching] = [
        .naver: NaverFetcher(),
        .oliveyoung: OliveYoungFetcher(),
        .coupang: CoupangFetcher()
    ]

    private var isRefreshing = false

    private init() {}

    // MARK: - URL 등록 (T-16 팝오버 호출)

    @discardableResult
    func addFromURL(_ urlString: String) async -> Result<Product, AppError> {
        guard let parsed = MallParser.parse(urlString) else {
            return .failure(AppError.unsupportedURL())
        }
        if let existing = store.products.first(where: {
            $0.mall == parsed.mall && $0.productID == parsed.productID
        }) {
            DebugLogger.shared.push(
                level: .INFO,
                category: "ADD",
                message: "이미 등록된 상품",
                meta: ["mall": parsed.mall.rawValue, "productID": parsed.productID]
            )
            return .success(existing)
        }

        // 등록 전 초기 정보 수집
        switch await refreshInfo(mall: parsed.mall, productID: parsed.productID) {
        case .success(let info):
            let product = store.addProduct(
                mall: parsed.mall,
                productID: parsed.productID,
                name: info.name,
                imageURLString: info.imageURLString,
                urlString: parsed.url.absoluteString
            )
            store.recordPrice(info.price, for: product)
            DebugLogger.shared.push(
                level: .ACTION,
                category: "ADD",
                message: "상품 등록 완료",
                meta: ["mall": parsed.mall.rawValue, "productID": parsed.productID, "price": info.price]
            )
            return .success(product)
        case .failure(let error):
            // 수집 불가해도 등록 허용 (P2 브라우저 세션 대비): 이름만 몰 기준 저장
            let product = store.addProduct(
                mall: parsed.mall,
                productID: parsed.productID,
                name: "\(parsed.mall.displayName) 상품 (가격 수집 대기)",
                urlString: parsed.url.absoluteString
            )
            DebugLogger.shared.push(
                level: .WARN,
                category: "ADD",
                message: "초기 수집 실패 — 이름만 등록",
                meta: ["code": error.code, "mall": parsed.mall.rawValue]
            )
            return .success(product)
        }
    }

    // MARK: - 전체 갱신 (T-13 스케줄러 호출)

    @discardableResult
    func refreshAll() async -> (updated: Int, failed: Int) {
        guard !isRefreshing else { return (0, 0) }
        isRefreshing = true
        defer { isRefreshing = false }

        // 몰별로 그룹화 → 몰 간 병렬, 몰 내 순차 (네이버 다중 요청 시 차단 악화 방지)
        let grouped = Dictionary(grouping: store.products) { $0.mall.rawValue }

        let totals = await withTaskGroup(of: (updated: Int, failed: Int).self) { group -> (updated: Int, failed: Int) in
            for (_, products) in grouped {
                group.addTask { @MainActor [weak self] in
                    guard let self else { return (0, 0) }
                    var updated = 0
                    var failed = 0
                    for product in products {
                        switch await self.refreshInfo(mall: product.mall, productID: product.productID) {
                        case .success(let info):
                            let changed = self.store.recordPrice(info.price, for: product)
                            if changed {
                                updated += 1
                                await NotificationEngine.shared.notifyPriceChangeIfNeeded(for: product, newPrice: info.price)
                            }
                        case .failure(let error):
                            failed += 1
                            DebugLogger.shared.push(
                                level: .WARN,
                                category: "REFRESH",
                                message: "갱신 실패",
                                meta: ["code": error.code, "mall": product.mall.rawValue, "productID": product.productID]
                            )
                        }
                    }
                    return (updated, failed)
                }
            }
            var updatedTotal = 0
            var failedTotal = 0
            for await result in group {
                updatedTotal += result.updated
                failedTotal += result.failed
            }
            return (updatedTotal, failedTotal)
        }
        DebugLogger.shared.push(
            level: .ACTION,
            category: "REFRESH",
            message: "전체 갱신 완료",
            meta: ["updated": totals.updated, "failed": totals.failed, "total": store.products.count]
        )
        return totals
    }

    /// 단일 몰·상품 조회 (실패 시 에러코드 포함)
    private func refreshInfo(mall: Mall, productID: String) async -> Result<ProductInfo, AppError> {
        guard let fetcher = fetchers[mall] else {
            return .failure(AppError(code: "E-MAC-GLIST-5001", debugMessage: "미지원 몰: \(mall.rawValue)"))
        }
        DebugLogger.shared.push(
            level: .API_REQ,
            category: "COLLECT",
            message: "상품 조회 시작",
            meta: ["mall": mall.rawValue, "productID": productID]
        )
        do {
            let info = try await fetcher.fetch(productID: productID)
            DebugLogger.shared.push(
                level: .API_RES,
                category: "COLLECT",
                message: "상품 조회 성공",
                meta: ["mall": mall.rawValue, "productID": productID, "price": info.price]
            )
            return .success(info)
        } catch let error as AppError {
            return .failure(error)
        } catch {
            return .failure(AppError.fetchFailed(cause: error))
        }
    }
}
