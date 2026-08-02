// PopoverRootView.swift — 메뉴바 팝오버 루트 (P0: 플레이스홀더, P1에서 상품 카드)
// PLATFORM: macos
import SwiftUI

struct PopoverRootView: View {
    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "chart.line.downtrend.xyaxis")
                .font(.system(size: 40, weight: .light))
                .foregroundStyle(.secondary)
            Text("추적 중인 상품이 없습니다")
                .font(.headline)
            Text("브라우저에서 쇼핑 상품 페이지를 열거나\n상품 공유 주소를 복사해 보세요")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Text("P1에서 상품 카드·가격 그래프 제공 예정")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(nsColor: .windowBackgroundColor))
    }
}
