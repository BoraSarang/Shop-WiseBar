// CoupangFetcher.swift — 쿠팡 수집기 (P1: 미지원, P2에서 브라우저 세션 활성화)
// Akamai 방어로 인한 직접 HTTP 금지 (AGENTS.md/PRD 결정) — E-MAC-BROWSER-3001 반환
// PLATFORM: macos
import Foundation

final class CoupangFetcher: PriceFetching {
    let mall: Mall = .coupang

    func fetch(productID: String) async throws -> ProductInfo {
        DebugLogger.shared.push(
            level: .WARN,
            category: "COLLECT",
            message: "쿠팡 수집은 P2(브라우저 세션)에서 지원",
            meta: ["code": "E-MAC-BROWSER-3001", "productID": productID]
        )
        throw AppError.browserUnavailable()
    }
}
