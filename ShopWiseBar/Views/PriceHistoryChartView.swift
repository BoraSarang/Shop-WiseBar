// PriceHistoryChartView.swift — 가격 이력 Swift Charts (T-15)
// 포인트 2개 미만이면 플레이스홀더 표시
// PLATFORM: macos
import Charts
import SwiftUI

struct PriceHistoryChartView: View {
    let points: [PricePoint]

    var body: some View {
        Group {
            if points.count >= 2 {
                Chart {
                    ForEach(points, id: \.self) { point in
                        LineMark(
                            x: .value("시각", point.date),
                            y: .value("가격", point.price)
                        )
                        .foregroundStyle(Color.accentColor.gradient)
                        .interpolationMethod(.catmullRom)

                        AreaMark(
                            x: .value("시각", point.date),
                            y: .value("가격", point.price)
                        )
                        .foregroundStyle(
                            LinearGradient(
                                colors: [Color.accentColor.opacity(0.25), .clear],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                        .interpolationMethod(.catmullRom)
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .trailing, values: .automatic(desiredCount: 3)) { value in
                        AxisGridLine()
                        AxisValueLabel {
                            if let int = value.as(Int.self) {
                                Text(int.formatted(.number))
                            }
                        }
                    }
                }
                .chartXAxis {
                    AxisMarks(values: .automatic(desiredCount: 3)) { _ in
                        AxisValueLabel(format: .dateTime.month().day())
                    }
                }
            } else {
                Text("가격 이력이 아직 없습니다")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
}
