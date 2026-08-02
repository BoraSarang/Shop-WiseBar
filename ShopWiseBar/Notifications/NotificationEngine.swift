// NotificationEngine.swift — 가격 알림 (T-14, UNUserNotificationCenter)
// 트리거: ①가격 하락 ②목표가 도달 (targetPrice 설정 시) ③서버 폴링 알림 (P5-T54)
// 알림 클릭 시: 해당 상품 정보 메뉴바 팝오버 자동 표시
// PLATFORM: macos
import Foundation
import UserNotifications

@MainActor
final class NotificationEngine: NSObject {
    static let shared = NotificationEngine()

    private let center = UNUserNotificationCenter.current()
    private let settings = SettingsStore.shared

    private override init() {
        super.init()
        center.delegate = self
    }

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

    /// 가격 변동 시 알림 (변동 없으면 생략, 목표가 도달/하락만 알림) — P1 로컬 수집 기준
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
        await send(title: title, body: body, productID: product.productID)
    }

    /// 서버 폴링 감지 알림 (P5-T54) — AlertPoller에서 호출
    func notifyServerAlert(_ alert: ServerAlert) async {
        guard settings.notificationsEnabled else { return }
        let title = alert.alert_type == "target_reached" ? "목표 가격에 도달했어요" : "가격이 하락했어요"
        let body = alert.price.formatted(.number) + "원 (이전 \(alert.previous_price?.formatted(.number) ?? "-")원)"
        await send(title: title, body: body, productID: alert.product_id)
    }

    private func send(title: String, body: String, productID: String) async {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.userInfo = ["product_id": productID]
        let request = UNNotificationRequest(
            identifier: "alert-\(productID)-\(Date().timeIntervalSince1970)",
            content: content,
            trigger: nil
        )
        do {
            try await center.add(request)
            DebugLogger.shared.push(
                level: .ACTION,
                category: "NOTIFY",
                message: "알림 전송",
                meta: ["productID": productID, "title": title]
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

// MARK: - 알림 클릭 처리 (P5-T54)

extension NotificationEngine: UNUserNotificationCenterDelegate {
    /// 포그라운드에서도 알림 배너 표시
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }

    /// 알림 클릭 → 해당 상품 메뉴바 팝오버 자동 표시
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let userInfo = response.notification.request.content.userInfo
        guard let productID = userInfo["product_id"] as? String else { return }
        await MainActor.run {
            DebugLogger.shared.push(
                level: .ACTION,
                category: "NOTIFY",
                message: "알림 클릭 — 상품 표시",
                meta: ["productID": productID]
            )
            PopoverState.shared.autoShowProductID = productID
            MenuBarController.shared.autoShowPopover()
        }
    }
}
