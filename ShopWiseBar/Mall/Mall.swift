// Mall.swift — 몰 레지스트리 (쿠팡/네이버/올리브영 — MVP 3개)
// PLATFORM: macos
import Foundation

enum Mall: String, CaseIterable, Identifiable {
    case coupang
    case naver
    case oliveyoung

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .coupang: return "쿠팡"
        case .naver: return "네이버"
        case .oliveyoung: return "올리브영"
        }
    }

    var iconName: String {
        switch self {
        case .coupang: return "cart.fill"
        case .naver: return "n.square.fill"
        case .oliveyoung: return "sparkles"
        }
    }

    /// 가격 수집 방식
    var fetchMode: FetchMode {
        switch self {
        case .coupang: return .browserSession // P2에서 활성화 (Akamai 우회)
        case .naver, .oliveyoung: return .http
        }
    }
}

enum FetchMode {
    case http        // URLSession + HTML 파싱
    case browserSession // Chrome execute javascript (P2)
}
