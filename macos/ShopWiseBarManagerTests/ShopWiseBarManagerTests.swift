import XCTest
@testable import ShopWiseBarManager

final class ShopWiseBarManagerTests: XCTestCase {
    func testWonTextFormatting() {
        XCTAssertEqual(12000.wonText, "12,000원")
        XCTAssertEqual(0.wonText, "0원")
        XCTAssertEqual(1234567.wonText, "1,234,567원")
    }

    func testMallBadgeDisplay() {
        XCTAssertEqual(MallBadge.display("naver"), "네이버")
        XCTAssertEqual(MallBadge.display("coupang"), "쿠팡")
        XCTAssertEqual(MallBadge.display("oliveyoung"), "올리브영")
        XCTAssertEqual(MallBadge.display("unknown"), "unknown")
    }
}