// BrowserSessionFetcher.swift — AppleScript 브라우저 세션 실행 유틸 (P2)
// 방식: 새 탭 → URL 로드 → execute javascript (base64 전달) → 탭 닫기
//   다단계 처리(옵션 클릭 후 재추출 등)를 위해 openTab/exec/closeTab 분리
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

    /// 브라우저 탭 세션 직렬 큐 — 몰 간 병렬 갱신 시 탭 동시 생성 경합 방지
    private let sessionQueue = DispatchQueue(label: "com.borasarang.browser-session")

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
        let output = try await runSession(url: url, steps: [(js, 0)])
        return try parse(output)
    }

    /// 쿠팡 상품 페이지 가격 추출
    /// 1) 첫 옵션(.select-item) 클릭 → 옵션 기본값에 따른 가격 변동 방지 (실측: 게임용11번→27%→1,339,000원)
    /// 2) 2.5초 후 "N%" 다음 줄 금액 추출 (폴백: body 첫 금액)
    /// 쿠팡 첫 로드는 느림(6초 이상) — loadDelay 확장
    func fetchCoupangProduct(url: URL) async throws -> BrowserSessionResult {
        let clickJS = """
        (function(){
          var items = document.querySelectorAll('.select-item');
          if (items.length === 0) return 'no-option';
          items[0].click();
          return 'clicked';
        })()
        """
        let extractJS = """
        (function(){
          var b = document.body.innerText;
          if (b.indexOf('쿠팡') < 0) return JSON.stringify({price: null, title: null, image: null});
          var m = b.match(/([0-9]{1,2})%\\s*\\n\\s*([0-9][0-9,]*)\\s*원/);
          var fallback = b.match(/[0-9][0-9,]*\\s*원/);
          var ogt = document.querySelector('meta[property="og:title"]');
          var ogi = document.querySelector('meta[property="og:image"]');
          return JSON.stringify({price: m ? m[2] : (fallback ? fallback[0] : null), title: ogt ? ogt.content : null, image: ogi ? ogi.content : null});
        })()
        """
        let output = try await runSession(url: url, loadDelay: 6, steps: [(clickJS, 2.5), (extractJS, 0)])
        return try parse(output)
    }

    // MARK: - 실행

    /// 단일 osascript로 탭 세션 실행: 탭 생성 → URL 로드 → JS 스텝 실행 → 탭 닫기
    /// (탭 참조를 한 스크립트 내에서 유지 — 별도 osascript의 tab id 접근 불가 문제 해결, 몰 간 병렬 안전)
    private func runSession(url: URL, loadDelay: Double = 4, steps: [(js: String, delayBefore: TimeInterval)]) async throws -> String {
        let safeURL = url.absoluteString.replacingOccurrences(of: "\"", with: "\\\"")
        let encodedSteps = steps.map { Data($0.js.utf8).base64EncodedString() }

        var lines: [String] = [
            "tell application \"\(browserName)\"",
            "    set newTab to make new tab at end of tabs of front window",
            "    set URL of newTab to \"\(safeURL)\"",
            "    delay \(loadDelay)",
        ]
        for (i, b64) in encodedSteps.enumerated() {
            if steps[i].delayBefore > 0 {
                lines.append("    delay \(steps[i].delayBefore)")
            }
            lines.append("    set js\(i) to do shell script \"echo '\(b64)' | base64 -d\"")
            lines.append("    execute newTab javascript js\(i)")
        }
        let last = encodedSteps.count - 1
        lines.append("    set resultText to execute newTab javascript js\(last)")
        lines.append("    close newTab")
        lines.append("    return resultText")
        lines.append("end tell")

        DebugLogger.shared.push(
            level: .API_REQ,
            category: "BROWSER",
            message: "브라우저 세션 시작",
            meta: ["browser": browserName, "url": url.absoluteString, "steps": steps.count]
        )

        let (output, error) = try await runAppleScript(lines.joined(separator: "\n"))
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

    /// osascript 실행 (직렬 큐 — 브라우저 탭 동시 생성 경합 방지)
    private func runAppleScript(_ script: String) async throws -> (output: String, error: String) {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<(String, String), Error>) in
            sessionQueue.async {
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
