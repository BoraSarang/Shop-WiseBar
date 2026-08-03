// PopoverState.swift — 팝오버 내부 공유 상태 (메뉴바 → 뷰 전달)
// T-57: 캐치/홈/찜 목록 2모드 + 마지막 본 상품 영속
// PLATFORM: macos
import Foundation

/// 팝오버 화면 모드 (T-57)
enum PopoverViewMode {
    case home
    case watchlist
}

/// 캐치된 상품 (T-57) — 브라우저에서 보는 중인 상품의 스냅샷
struct CapturedProduct: Identifiable {
    let id: String // = productID
    let mall: Mall
    let name: String
    let imageURLString: String
    let urlString: String
    let currentPrice: Int?
    let isWatched: Bool
    let targetPrice: Int?
    let pricePoints: [PricePoint]

    var productURL: URL? { URL(string: urlString) }

    func with(isWatched: Bool = false, targetPrice: Int? = nil, pricePoints: [PricePoint]? = nil) -> CapturedProduct {
        CapturedProduct(
            id: id,
            mall: mall,
            name: name,
            imageURLString: imageURLString,
            urlString: urlString,
            currentPrice: currentPrice,
            isWatched: isWatched,
            targetPrice: targetPrice,
            pricePoints: pricePoints ?? self.pricePoints
        )
    }
}

@MainActor
final class PopoverState: ObservableObject {
    static let shared = PopoverState()

    /// "지금 상품 추가…" 메뉴 선택 시 추가 필드 포커스 요청
    @Published var focusAddField = false

    /// BrowserMonitor가 감지한 추적 제안 URL (상품 페이지 방문 중)
    @Published var suggestedURL: String?

    /// 제안 URL을 "추적" 버튼에 등록한 상품 — 등록 중 UI 표시용
    @Published var isAddingSuggested = false

    /// 서버에서 관심 상품으로 확인된 캐치 상품 — 팝오버 자동 오픈 시 해당 카드 하이라이트 (P5-T53)
    @Published var autoShowProductID: String?

    /// 캐치 중인 상품 (T-57) — 상품 페이지를 보고 있는 동안 유지, 이탈 시 nil
    @Published var capturedProduct: CapturedProduct?

    /// 현재 화면 모드 (T-57)
    @Published var viewMode: PopoverViewMode = .home

    /// 팝오버가 열린 시각 (T-57) — 홈 화면 "마지막 본 상품" 재조회 트리거
    @Published var lastOpenedAt = Date()

    private let lastViewedKey = "lastViewedProductID"

    private init() {}

    var lastViewedProductID: String? {
        UserDefaults.standard.string(forKey: lastViewedKey)
    }

    func setLastViewed(productID: String) {
        UserDefaults.standard.set(productID, forKey: lastViewedKey)
    }

    func requestAddFocus() {
        focusAddField = true
    }

    func clearSuggestion() {
        suggestedURL = nil
        capturedProduct = nil
    }

    func clearAutoShow() {
        autoShowProductID = nil
    }

    func showHome() {
        viewMode = .home
    }

    func showWatchlist() {
        viewMode = .watchlist
    }

    func notifyPopoverOpened() {
        lastOpenedAt = Date()
    }
}
