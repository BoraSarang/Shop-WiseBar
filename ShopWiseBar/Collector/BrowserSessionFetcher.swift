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

    /// 몰별 직렬 세마포어 — 같은 몰의 탭 세션은 순차, 몰 간은 병렬 (탭 동시 생성 경합은 몰 내에서만 방지)
    private let mallLock = NSLock()
    private var mallBusy: [String: Bool] = [:]

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
        // 간헐적 로드 지연 대비: 동일 추출 JS를 2초 간격 2회 (첫 실패 시 재시도 효과)
        let output = try await runSession(url: url, mall: "naver", loadDelay: 5, steps: [(js, 2), (js, 0)])
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
        let output = try await runSession(url: url, mall: "coupang", loadDelay: 6, steps: [(clickJS, 2.5), (extractJS, 0)])
        return try parse(output)
    }

    // MARK: - 실행

    /// 단일 osascript로 탭 세션 실행: 탭 생성 → URL 로드 → JS 스텝 실행 → 탭 닫기
    /// (탭 참조를 한 스크립트 내에서 유지 — 별도 osascript의 tab id 접근 불가 문제 해결, 몰 간 병렬 안전)
    private func runSession(url: URL, mall: String, loadDelay: Double = 4, steps: [(js: String, delayBefore: TimeInterval)]) async throws -> String {
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

        let (output, error) = try await runAppleScript(lines.joined(separator: "\n"), mall: mall)
        if !error.isEmpty {
            // 웨일(Whale)은 AppleScript JS 실행 미지원 (2026-08-02 실측: 설정 키 미지원)
            let isWhaleDisabled = error.contains("AppleScript를 통한 자바스크립트")
            let code = isWhaleDisabled ? "E-MAC-BROWSER-3002" : "E-MAC-BROWSER-3001"
            DebugLogger.shared.push(
                level: .WARN,
                category: "BROWSER",
                message: "AppleScript 오류",
                meta: ["code": code, "error": String(error.prefix(200))]
            )
            throw AppError(code: code, debugMessage: isWhaleDisabled ? "웨일은 AppleScript JS 실행 미지원 — Google Chrome 선택 필요" : "브라우저 자동화 실패")
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

    /// osascript 실행 (몰별 직렬 세마포어 — 몰 내 탭 경합 방지, 몰 간은 병렬)
    private func runAppleScript(_ script: String, mall: String) async throws -> (output: String, error: String) {
        await acquireMall(mall)
        defer { releaseMall(mall) }
        return try await withCheckedThrowingContinuation { (cont: CheckedContinuation<(String, String), Error>) in
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

    // MARK: - 몰별 직렬 세마포어

    private func acquireMall(_ mall: String) async {
        while true {
            mallLock.lock()
            let busy = mallBusy[mall] ?? false
            if !busy {
                mallBusy[mall] = true
                mallLock.unlock()
                return
            }
            mallLock.unlock()
            try? await Task.sleep(nanoseconds: 100_000_000)
        }
    }

    private func releaseMall(_ mall: String) {
        mallLock.lock()
        mallBusy[mall] = false
        mallLock.unlock()
    }
}
