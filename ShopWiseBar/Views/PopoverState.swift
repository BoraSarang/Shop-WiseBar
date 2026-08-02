// PopoverState.swift — 팝오버 내부 공유 상태 (메뉴바 → 뷰 전달)
// PLATFORM: macos
import Foundation

@MainActor
final class PopoverState: ObservableObject {
    static let shared = PopoverState()

    /// "지금 상품 추가…" 메뉴 선택 시 추가 필드 포커스 요청
    @Published var focusAddField = false

    /// BrowserMonitor가 감지한 추적 제안 URL (상품 페이지 방문 중)
    @Published var suggestedURL: String?

    /// 제안 URL을 "추적" 버튼에 등록한 상품 — 등록 중 UI 표시용
    @Published var isAddingSuggested = false

    private init() {}

    func requestAddFocus() {
        focusAddField = true
    }

    func clearSuggestion() {
        suggestedURL = nil
    }
}
