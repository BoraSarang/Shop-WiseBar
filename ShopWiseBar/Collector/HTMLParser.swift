// HTMLParser.swift — HTML/임베디드 JSON 파싱 공용 유틸
// PLATFORM: macos
import Foundation

enum HTMLParser {

    /// HTML 전체 문자열에서 JSON 블록 추출 (window.__INITIAL_STATE__, __NEXT_DATA__ 등)
    static func extractJSON(from html: String, marker: String, keyPrefix: String) -> [String: Any]? {
        guard let markerRange = html.range(of: marker) else { return nil }
        guard let open = html[markerRange.upperBound...].range(of: keyPrefix) else { return nil }

        var depth = 0
        var inString = false
        var escaped = false
        var jsonStart: String.Index? = nil
        var jsonEnd: String.Index? = nil

        for index in html[open.lowerBound...].indices {
            let char = html[index]
            if inString {
                if escaped {
                    escaped = false
                } else if char == "\\" {
                    escaped = true
                } else if char == "\"" {
                    inString = false
                }
                continue
            }
            switch char {
            case "\"":
                inString = true
            case "{":
                if depth == 0 { jsonStart = index }
                depth += 1
            case "}":
                depth -= 1
                if depth == 0 {
                    jsonEnd = index
                    break
                }
            default:
                continue
            }
            if jsonEnd != nil { break }
        }
        guard let jsonStart, let jsonEnd else { return nil }
        let jsonText = String(html[jsonStart...jsonEnd])
        guard let data = jsonText.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        return json
    }

    /// 임의 키 경로로 JSON에서 값 탐색 (점 구분: "product.purchasePrice")
    static func value<T>(in json: [String: Any], keyPath: String) -> T? {
        let keys = keyPath.split(separator: ".").map(String.init)
        var current: Any = json
        for key in keys {
            if let dict = current as? [String: Any] {
                guard let next = dict[key] else { return nil }
                current = next
            } else if let array = current as? [[String: Any]] {
                // 배열이면 첫 원소에서 탐색 (멀티셀 대응)
                guard let next = array.first?[key] else { return nil }
                current = next
            } else {
                return nil
            }
        }
        return current as? T
    }

    /// 원시 형태 → Int (문자열 콤마, "원" 표기 포함)
    static func toInt(_ value: Any?) -> Int? {
        guard let value else { return nil }
        if let int = value as? Int { return int }
        if let double = value as? Double { return Int(double) }
        if let string = value as? String {
            let digits = string.filter { $0.isNumber }
            return Int(digits).flatMap { $0 == 0 && !digits.isEmpty ? 0 : $0 }
        }
        return nil
    }

    /// HTML 이스케이프 해제
    static func unescape(_ string: String) -> String {
        let result = string.replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&quot;", with: "\"")
            .replacingOccurrences(of: "&#39;", with: "'")
        return replaceAll(#"&#(\d+);"#, in: result) { groups in
            guard let code = groups.first, let scalar = UnicodeScalar(code) else { return "" }
            return String(scalar)
        }
    }

    /// 정규식 첫 매치 (group 1 또는 전체)
    static func firstMatch(_ pattern: String, in string: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.dotMatchesLineSeparators]) else {
            return nil
        }
        let range = NSRange(string.startIndex..., in: string)
        guard let match = regex.firstMatch(in: string, range: range) else { return nil }
        let group = match.numberOfRanges > 1 ? match.range(at: 1) : match.range(at: 0)
        guard let groupRange = Range(group, in: string) else { return nil }
        return String(string[groupRange])
    }
}

extension HTMLParser {
    /// NSRegularExpression 결과 치환 헬퍼 (블록 클로저)
    static func replaceAll(
        _ pattern: String,
        in string: String,
        using transform: ([Int]) -> String
    ) -> String {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return string }
        let range = NSRange(string.startIndex..., in: string)
        var result = string
        for match in regex.matches(in: string, range: range).reversed() {
            let groups = (0..<match.numberOfRanges).map { idx -> Int in
                let r = match.range(at: idx)
                guard r.location != NSNotFound, let swiftRange = Range(r, in: result) else { return 0 }
                return Int(result[swiftRange]) ?? 0
            }
            let replacement = transform(groups)
            if let swiftRange = Range(match.range(at: 0), in: result) {
                result.replaceSubrange(swiftRange, with: replacement)
            }
        }
        return result
    }
}
