// AppError.swift — 에러 코드 체계 (AGENTS.md 8.5: E-PLATFORM-CAT-NNNN)
// 사용자 메시지는 error_message_ko.json에서 로드, debug 메시지/원인은 로그 전용
// PLATFORM: macos
import Foundation

struct AppError: Error, LocalizedError {
    let code: String
    let debugMessage: String
    let cause: Error?

    init(code: String, debugMessage: String, cause: Error? = nil) {
        self.code = code
        self.debugMessage = debugMessage
        self.cause = cause
    }

    /// 사용자 노출 메시지 (error_message_ko.json 매핑, 미존재 시 폴백)
    var userMessage: String {
        ErrorMessageLoader.shared.message(for: code)
    }

    var errorDescription: String? { userMessage }
}

/// error_message_ko.json 로더 (번들 리소스)
final class ErrorMessageLoader {
    static let shared = ErrorMessageLoader()

    private var messages: [String: String] = [:]

    private init() {
        guard let url = Bundle.main.url(forResource: "error_message_ko", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: String] else {
            return
        }
        messages = json
    }

    func message(for code: String) -> String {
        messages[code] ?? "오류가 발생했습니다. (\(code))"
    }
}

// MARK: - 공통 에러 코드 (P1 시드)

extension AppError {
    static func network() -> AppError {
        AppError(code: "E-MAC-NET-1001", debugMessage: "네트워크 연결 실패")
    }

    static func fetchFailed(cause: Error? = nil) -> AppError {
        AppError(code: "E-MAC-NET-1002", debugMessage: "상품 정보 조회 실패", cause: cause)
    }

    static func unsupportedURL() -> AppError {
        AppError(code: "E-MAC-VALID-2001", debugMessage: "지원하지 않는 상품 주소")
    }

    static func invalidURL() -> AppError {
        AppError(code: "E-MAC-VALID-2002", debugMessage: "상품 주소 해석 실패")
    }

    static func db() -> AppError {
        AppError(code: "E-MAC-DB-4001", debugMessage: "저장소 초기화 실패")
    }

    static func browserUnavailable() -> AppError {
        AppError(code: "E-MAC-BROWSER-3001", debugMessage: "브라우저 자동화 권한 부족 또는 미실행")
    }

    // MARK: - 서버 연동 (P5-T53)

    static func serverUnreachable(cause: Error? = nil) -> AppError {
        AppError(code: "E-MAC-NET-2001", debugMessage: "중앙 서버 연결 실패", cause: cause)
    }

    static func serverParseFailed(cause: Error? = nil) -> AppError {
        AppError(code: "E-MAC-NET-2002", debugMessage: "서버 응답 해석 실패", cause: cause)
    }

    static func serverURLFailed() -> AppError {
        AppError(code: "E-MAC-NET-2003", debugMessage: "서버 URL 구성 실패")
    }

    /// cause 유지한 채 에러 재구성
    func with(cause: Error?) -> AppError {
        guard let cause else { return self }
        return AppError(code: code, debugMessage: debugMessage, cause: cause)
    }
}
