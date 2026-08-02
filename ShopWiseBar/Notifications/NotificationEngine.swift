// NotificationEngine.swift — 가격 알림 (T-14, UNUserNotificationCenter)
// 트리거: ①가격 하락 ②목표가 도달 (targetPrice 설정 시)
// PLATFORM: macos
import Foundation
import UserNotifications

@MainActor
final class NotificationEngine {
    static let shared = NotificationEngine()

    private let center = UNUserNotificationCenter.current()
    private let settings = SettingsStore.shared

    private init() {}

    func requestAuthorization() {
        guard settings.notificationsEnabled else { return }
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            DebugLogger.shared.push(
                level: granted ? .SYSTEM : .WARN,
                category: "NOTIFY",
                message: granted ? "알림 권한 획득" : "알림 권한 거부",
                meta: ["error": error?.localizedDescription ?? ""]
            )
        }
    }

    /// 가격 변동 시 알림 (변동 없으면 생략, 목표가 도달/하락만 알림)
    func notifyPriceChangeIfNeeded(for product: Product, newPrice: Int) async {
        guard settings.notificationsEnabled else { return }

        let points = product.sortedPricePoints
        guard points.count >= 2 else { return }

        let previousPrice = points[points.count - 2].price
        let isDrop = newPrice < previousPrice
        let targetReached = product.targetPrice.map { newPrice <= $0 } ?? false

        guard isDrop || targetReached else { return }

        let title = isDrop ? "가격이 하락했어요" : "목표 가격에 도달했어요"
        let body = "\(product.name) — \(newPrice.formatted(.number))원"
        await send(title: title, body: body, product: product)
    }

    private func send(title: String, body: String, product: Product) async {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        if let url = product.productURL {
            content.userInfo = ["url": url.absoluteString]
        }
        let request = UNNotificationRequest(
            identifier: "price-\(product.id.uuidString)-\(Date().timeIntervalSince1970)",
            content: content,
            trigger: nil
        )
        do {
            try await center.add(request)
            DebugLogger.shared.push(
                level: .ACTION,
                category: "NOTIFY",
                message: "알림 전송",
                meta: ["productID": product.productID, "price": product.lastPrice ?? 0]
            )
        } catch {
            DebugLogger.shared.push(
                level: .WARN,
                category: "NOTIFY",
                message: "알림 전송 실패",
                meta: ["code": "E-MAC-NET-1001", "error": error.localizedDescription]
            )
        }
    }
}
