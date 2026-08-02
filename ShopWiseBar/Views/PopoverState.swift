// PopoverState.swift — 팝오버 내부 공유 상태 (메뉴바 → 뷰 전달)
// PLATFORM: macos
import Foundation

@MainActor
final class PopoverState: ObservableObject {
    static let shared = PopoverState()

    /// "지금 상품 추가…" 메뉴 선택 시 추가 필드 포커스 요청
    @Published var focusAddField = false

    private init() {}

    func requestAddFocus() {
        focusAddField = true
    }
}
