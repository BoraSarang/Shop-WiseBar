import SwiftUI

/// ShopWiseBar Manager 디자인 토큰 — 확장(swb-tokens.css)과 동일 루트 사용. v0.15.0
enum DS {
    // MARK: 색상 (확장 토큰과 동일 구성)
    enum Color {
        static let primary = SwiftUI.Color(red: 0x2d / 255, green: 0x4a / 255, blue: 0xe0 / 255)
        static let primaryStrong = SwiftUI.Color(red: 0x3a / 255, green: 0x5a / 255, blue: 0xef / 255)
        static let primarySoft = SwiftUI.Color(red: 0xf2 / 255, green: 0xf4 / 255, blue: 0xff / 255)

        static let danger = SwiftUI.Color(red: 0xe5 / 255, green: 0x48 / 255, blue: 0x4d / 255)
        static let success = SwiftUI.Color(red: 0x2d / 255, green: 0xd4 / 255, blue: 0xbf / 255)

        static let mallNaver = SwiftUI.Color(red: 0x03 / 255, green: 0xc7 / 255, blue: 0x5a / 255)
        static let mallCoupang = SwiftUI.Color(red: 0x00 / 255, green: 0x74 / 255, blue: 0xe9 / 255)
        static let mallOliveyoung = SwiftUI.Color(red: 0x56 / 255, green: 0xa9 / 255, blue: 0x9c / 255)

        static func mall(_ name: String) -> SwiftUI.Color {
            switch name.lowercased() {
            case "naver": return mallNaver
            case "coupang": return mallCoupang
            case "oliveyoung": return mallOliveyoung
            default: return .secondary
            }
        }

        static func badge(alertType: String) -> SwiftUI.Color {
            switch alertType {
            case "price_dropped": return danger
            case "back_in_stock": return success
            case "target_price": return primary
            default: return .secondary
            }
        }
    }

    // MARK: 타이포 (SF Pro 권장 사이즈)
    enum Font {
        static let xxs = SwiftUI.Font.system(size: 10)
        static let xs = SwiftUI.Font.system(size: 11)
        static let sm = SwiftUI.Font.system(size: 12)
        static let base = SwiftUI.Font.system(size: 13)
        static let md = SwiftUI.Font.system(size: 15)
        static let lg = SwiftUI.Font.system(size: 17)
        static let xl = SwiftUI.Font.system(size: 20, weight: .semibold)

        static func title(_ size: CGFloat) -> SwiftUI.Font {
            SwiftUI.Font.system(size: size, weight: .semibold)
        }
    }

    // MARK: 간격 (4px 그리드)
    enum Space {
        static let s1: CGFloat = 4
        static let s2: CGFloat = 8
        static let s3: CGFloat = 12
        static let s4: CGFloat = 16
        static let s5: CGFloat = 20
        static let s6: CGFloat = 24
    }

    // MARK: 라운드
    enum Radius {
        static let sm: CGFloat = 6
        static let md: CGFloat = 8
        static let lg: CGFloat = 12
        static let pill: CGFloat = 999
    }
}

// MARK: - 공용 뷰 컴포넌트

/// 몰 배지 — 네이버/쿠팡/올리브영
struct MallBadge: View {
    let mall: String
    var body: some View {
        Text(Self.display(mall))
            .font(DS.Font.xs)
            .foregroundStyle(.white)
            .padding(.horizontal, DS.Space.s2)
            .padding(.vertical, 2)
            .background(DS.Color.mall(mall).opacity(0.9), in: .capsule)
    }

    static func display(_ mall: String) -> String {
        switch mall.lowercased() {
        case "naver": return "네이버"
        case "coupang": return "쿠팡"
        case "oliveyoung": return "올리브영"
        default: return mall
        }
    }
}

/// 알림 타입 배지
struct AlertBadge: View {
    let type: String
    var body: some View {
        Text(Self.label(type))
            .font(DS.Font.xs)
            .foregroundStyle(.white)
            .padding(.horizontal, DS.Space.s2)
            .padding(.vertical, 2)
            .background(DS.Color.badge(alertType: type), in: .capsule)
    }

    static func label(_ type: String) -> String {
        switch type {
        case "price_dropped": return "가격 하락"
        case "back_in_stock": return "재입고"
        case "target_price": return "목표가"
        default: return type
        }
    }
}