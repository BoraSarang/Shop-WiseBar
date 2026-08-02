// BrowserSessionFetcher.swift — AppleScript 브라우저 세션 실행 유틸 (P2)
// 방식: 새 탭 → URL 로드 → execute javascript (base64 전달) → 탭 닫기
// 브라우저: SettingsStore.browserName (Chrome/Whale/Edge 공통 AppleScript)
// PLATFORM: macos
import Foundation

struct BrowserSessionResult: Decodable {
    let price: String?
    let title: String?
    let image: String?

    var priceInt: Int? {
        guard let price else { return nil }
        return Int(price.filter { $0.isNumber })
    }
}

final class BrowserSessionFetcher {
    static let shared = BrowserSessionFetcher()

    private init() {}

    /// 네이버 상품 페이지 가격 추출 (m. 모바일 페이지 권장)
    /// JS: body 텍스트에서 "상품 가격\nN,NNN원" 패턴 + og 태그
    func fetchNaverProduct(url: URL) async throws -> BrowserSessionResult {
        let js = """
        (function(){
          var b = document.body.innerText;
          var m1 = b.match(/상품 가격[\\s\\S]{0,30}?([0-9,]+)원/);
          var ogt = document.querySelector('meta[property="og:title"]');
          var ogi = document.querySelector('meta[property="og:image"]');
          return JSON.stringify({price: m1 ? m1[1] : null, title: ogt ? ogt.content : null, image: ogi ? ogi.content : null});
        })()
        """
        let output = try await executeJavaScript(js, url: url)
        return try parse(output)
    }

    /// 쿠팡 상품 페이지 가격 추출
    /// 패턴: "N%" 다음 줄 첫 금액이 현재가 (2개 상품 실측: 게이밍PC 27%→1,339,000원, 숟가락 23%→6,140원)
    /// 폴백: body 첫 금액
    func fetchCoupangProduct(url: URL) async throws -> BrowserSessionResult {
        let js = """
        (function(){
          var b = document.body.innerText;
          var m = b.match(/([0-9]{1,2})%\\s*\\n\\s*([0-9][0-9,]*)\\s*원/);
          var fallback = b.match(/[0-9][0-9,]*\\s*원/);
          var ogt = document.querySelector('meta[property="og:title"]');
          var ogi = document.querySelector('meta[property="og:image"]');
          return JSON.stringify({price: m ? m[2] : (fallback ? fallback[0] : null), title: ogt ? ogt.content : null, image: ogi ? ogi.content : null});
        })()
        """
        let output = try await executeJavaScript(js, url: url)
        return try parse(output)
    }

    // MARK: - 실행

    private func executeJavaScript(_ js: String, url: URL) async throws -> String {
        let b64 = Data(js.utf8).base64EncodedString()
        let safeURL = url.absoluteString.replacingOccurrences(of: "\"", with: "\\\"")
        let script = """
        tell application "\(browserName)"
            set newTab to make new tab at end of tabs of front window
            set URL of newTab to "\(safeURL)"
            delay 4
            set jsText to do shell script "echo '\(b64)' | base64 -d"
            set resultText to execute newTab javascript jsText
            close newTab
            return resultText
        end tell
        """

        DebugLogger.shared.push(
            level: .API_REQ,
            category: "BROWSER",
            message: "브라우저 세션 시작",
            meta: ["browser": browserName, "url": url.absoluteString]
        )

        let (output, error) = try await runAppleScript(script)
        if !error.isEmpty {
            DebugLogger.shared.push(
                level: .WARN,
                category: "BROWSER",
                message: "AppleScript 오류",
                meta: ["code": "E-MAC-BROWSER-3001", "error": String(error.prefix(200))]
            )
            throw AppError.browserUnavailable()
        }
        return output.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var browserName: String {
        let name = SettingsStore.shared.browserName
        return name == "Safari" ? "Safari" : name // Whale/Edge도 Chrome AppleScript 호환
    }

    private func parse(_ output: String) throws -> BrowserSessionResult {
        guard let data = output.data(using: .utf8),
              let result = try? JSONDecoder().decode(BrowserSessionResult.self, from: data) else {
            throw AppError(
                code: "E-MAC-BROWSER-3001",
                debugMessage: "브라우저 응답 해석 실패: \(String(output.prefix(120)))"
            )
        }
        DebugLogger.shared.push(
            level: .API_RES,
            category: "BROWSER",
            message: "브라우저 세션 결과",
            meta: ["price": result.price ?? "nil", "hasTitle": result.title != nil]
        )
        return result
    }

    /// osascript 실행 (비동기)
    private func runAppleScript(_ script: String) async throws -> (output: String, error: String) {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<(String, String), Error>) in
            Task.detached {
                let process = Process()
                process.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
                process.arguments = ["-e", script]
                let outPipe = Pipe()
                let errPipe = Pipe()
                process.standardOutput = outPipe
                process.standardError = errPipe
                do {
                    try process.run()
                    process.waitUntilExit()
                    let outData = outPipe.fileHandleForReading.readDataToEndOfFile()
                    let errData = errPipe.fileHandleForReading.readDataToEndOfFile()
                    let out = String(data: outData, encoding: .utf8) ?? ""
                    let err = String(data: errData, encoding: .utf8) ?? ""
                    cont.resume(returning: (out, err))
                } catch {
                    cont.resume(throwing: error)
                }
            }
        }
    }
}
