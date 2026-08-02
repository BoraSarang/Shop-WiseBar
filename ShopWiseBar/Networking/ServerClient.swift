// ServerClient.swift — 중앙 서버 API 클라이언트 (P5-T53)
// 익명 기기ID 발급/저장 + 상품 조회/등록 + 가격 업로드 + 관심 상품 조회
// baseURL: DEBUG에서 UserDefaults "ServerBaseURL"로 오버라이드 (기본 http://127.0.0.1:8000)
// PLATFORM: macos
import Foundation

// MARK: - 서버 모델 (snake_case — 서버 JSON 스키마와 동일)

struct ServerProduct: Codable {
    let product_id: String
    let mall: String
    let url: String
    let name: String?
    let image: String?
    let last_price: Int?
    let last_checked_at: String?
    let is_watched: Bool
    let target_price: Int?
}

struct ServerDevice: Codable {
    let device_id: String
}

struct ServerWatch: Codable {
    let product_id: String
    let target_price: Int?
    let created_at: String
}

struct ServerAlert: Codable {
    let product_id: String
    let alert_type: String
    let price: Int
    let previous_price: Int?
    let captured_at: String
}

final class ServerClient {
    static let shared = ServerClient()

    private let session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 10
        return URLSession(configuration: config)
    }()
    private let deviceIDKey = "serverDeviceID"
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    private init() {}

    var baseURLString: String {
        #if DEBUG
        if let override = UserDefaults.standard.string(forKey: "ServerBaseURL"), !override.isEmpty {
            return override
        }
        #endif
        return "http://127.0.0.1:8000"
    }

    var cachedDeviceID: String? {
        UserDefaults.standard.string(forKey: deviceIDKey)
    }

    // MARK: - 기기ID (익명 UUID, 서버 발급)

    @discardableResult
    func ensureDeviceID() async throws -> String {
        if let existing = cachedDeviceID { return existing }
        let data = try await send(path: "/api/v1/devices", method: "POST")
        let device: ServerDevice
        do {
            device = try decoder.decode(ServerDevice.self, from: data)
        } catch {
            throw AppError(code: "E-MAC-NET-2002", debugMessage: "기기ID 응답 해석 실패", cause: error)
        }
        UserDefaults.standard.set(device.device_id, forKey: deviceIDKey)
        DebugLogger.shared.push(
            level: .INFO,
            category: "SERVER",
            message: "기기ID 발급 완료",
            meta: ["device_id": device.device_id, "base_url": baseURLString]
        )
        return device.device_id
    }

    // MARK: - 상품

    /// 상품 조회 (관심 여부 포함). 서버에 없으면 nil (E-MAC-NET-2004 아님 — 404는 정상)
    func getProduct(productID: String) async throws -> ServerProduct? {
        let deviceID = try await ensureDeviceID()
        let path = "/api/v1/products/\(productID.percentEncodedForPath)?device_id=\(deviceID)"
        do {
            let data = try await send(path: path, method: "GET")
            return try decoder.decode(ServerProduct.self, from: data)
        } catch let error as ServerHTTPError where error.statusCode == 404 {
            return nil
        }
    }

    /// 상품 등록/정보 업데이트 (브라우저 캐치 시 name/image 최신화)
    @discardableResult
    func upsertProduct(
        productID: String,
        mall: String,
        url: String,
        name: String?,
        image: String?
    ) async throws -> ServerProduct {
        let body: [String: Any] = [
            "product_id": productID,
            "mall": mall,
            "url": url,
            "name": name ?? "",
            "image": image ?? "",
        ]
        let data = try await send(path: "/api/v1/products", method: "POST", body: body)
        do {
            return try decoder.decode(ServerProduct.self, from: data)
        } catch {
            throw AppError(code: "E-MAC-NET-2002", debugMessage: "상품 등록 응답 해석 실패", cause: error)
        }
    }

    /// 가격 수집 결과 업로드 (하이브리드 수집 — 클라이언트 브라우저 세션)
    func uploadPrice(productID: String, price: Int, source: String = "client") async throws {
        let path = "/api/v1/products/\(productID.percentEncodedForPath)/prices"
        _ = try await send(path: path, method: "POST", body: ["price": price, "source": source])
    }

    // MARK: - 관심 상품

    func addWatch(productID: String, targetPrice: Int?) async throws {
        let deviceID = try await ensureDeviceID()
        let path = "/api/v1/devices/\(deviceID)/watches/\(productID.percentEncodedForPath)"
        let body: [String: Any] = ["target_price": targetPrice as Any]
        _ = try await send(path: path, method: "PUT", body: body)
    }

    func removeWatch(productID: String) async throws {
        let deviceID = try await ensureDeviceID()
        let path = "/api/v1/devices/\(deviceID)/watches/\(productID.percentEncodedForPath)"
        _ = try await send(path: path, method: "DELETE")
    }

    // MARK: - 알림 폴링

    func getAlerts(since: Date? = nil) async throws -> [ServerAlert] {
        let deviceID = try await ensureDeviceID()
        var path = "/api/v1/devices/\(deviceID)/alerts"
        if let since {
            let iso = ISO8601DateFormatter().string(from: since)
            path += "?since=\(iso.percentEncodedForPath)"
        }
        let data = try await send(path: path, method: "GET")
        do {
            return try decoder.decode([ServerAlert].self, from: data)
        } catch {
            throw AppError(code: "E-MAC-NET-2002", debugMessage: "알림 응답 해석 실패", cause: error)
        }
    }

    // MARK: - 전송

    private struct ServerHTTPError: Error {
        let statusCode: Int
        let body: String
    }

    private func send(path: String, method: String, body: [String: Any]? = nil) async throws -> Data {
        guard let url = URL(string: baseURLString + path) else {
            throw AppError(code: "E-MAC-NET-2003", debugMessage: "서버 URL 구성 실패")
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 10
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        }
        DebugLogger.shared.push(
            level: .API_REQ,
            category: "SERVER",
            message: "\(method) \(path)",
            meta: ["base_url": baseURLString]
        )
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw AppError(code: "E-MAC-NET-2001", debugMessage: "서버 연결 실패", cause: error)
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        DebugLogger.shared.push(
            level: .API_RES,
            category: "SERVER",
            message: "\(method) \(path) → \(status)",
            meta: ["bytes": data.count]
        )
        guard (200...299).contains(status) else {
            let bodyText = String(data: data, encoding: .utf8) ?? ""
            throw ServerHTTPError(statusCode: status, body: bodyText)
        }
        return data
    }
}

private extension String {
    /// URL path 세그먼트 안전 인코딩 (productID에 ":" 등 포함 가능)
    var percentEncodedForPath: String {
        addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? self
    }
}
