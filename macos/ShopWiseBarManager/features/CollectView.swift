import SwiftUI

/// 수집 — 소스별 가격이력 건수 + 마지막 수집 시각
struct CollectView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: DS.Space.s4) {
            PageHeader(title: "수집", subtitle: "가격이력 수집 소스 분포")

            if let c = model.collect {
                VStack(alignment: .leading, spacing: DS.Space.s3) {
                    totalBanner(c)
                    let maxCount = c.sources.map(\.count).max() ?? 1
                    ForEach(c.sources, id: \.source) { s in
                        sourceRow(s, total: c.total, maxCount: maxCount)
                    }
                }
                .padding(DS.Space.s4)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: DS.Radius.lg))
            } else {
                ProgressView("데이터 로딩 중…")
                    .frame(maxWidth: .infinity, maxHeight: 300)
            }
            Spacer()
        }
        .padding(DS.Space.s5)
    }

    private func totalBanner(_ c: CollectResponse) -> some View {
        HStack(spacing: DS.Space.s2) {
            Image(systemName: "arrow.down.circle.fill")
                .foregroundStyle(DS.Color.primary)
            Text("전체 \(c.total)건")
                .font(DS.Font.lg.weight(.semibold))
            Spacer()
            if let last = c.lastCaptureAt {
                Text("최근 \(last)")
                    .font(DS.Font.xs)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func sourceRow(_ src: CollectSource, total: Int, maxCount: Int) -> some View {
        HStack {
            Text("\(src.source)")
                .font(DS.Font.md.weight(.medium))
            Spacer()
            Text("\(src.count)건")
                .font(DS.Font.md.weight(.semibold))
                .monospacedDigit()
            Text("\(src.count * 100 / max(maxCount, 1))%")
                .font(DS.Font.xs)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, DS.Space.s2)
    }
}