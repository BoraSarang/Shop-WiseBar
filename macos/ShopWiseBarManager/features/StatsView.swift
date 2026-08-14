import SwiftUI

/// 통계 — 일별 수집(몰별)·가격 동향·TOP 변동·사용자 증가율 (v0.16.19, T-129)
struct StatsView: View {
    @Environment(AppModel.self) private var model
    @State private var period: Period = .days30

    enum Period: Int, CaseIterable, Identifiable {
        case days7 = 7
        case days30 = 30
        case all = 180

        var id: Int { rawValue }
        var label: String {
            switch self {
            case .days7: return "7일"
            case .days30: return "30일"
            case .all: return "전체"
            }
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DS.Space.s5) {
                PageHeader(title: "통계", subtitle: "일별 수집 · 가격 동향 · 사용자 증가율")
                periodPicker

                if let error = model.statsError {
                    Text(error).font(DS.Font.caption).foregroundStyle(DS.Color.danger)
                }
                if model.statsState == .loading && model.collectByMall == nil {
                    ProgressView("통계 로딩 중…")
                        .frame(maxWidth: .infinity, maxHeight: 200)
                } else {
                    if let cb = model.collectByMall {
                        collectSection(cb.days)
                    }
                    if let tm = model.topMovers {
                        moversSection(tm)
                    }
                    if let pm = model.priceMovement {
                        movementSection(pm.days)
                    }
                    if let us = model.userStats {
                        usersSection(us)
                    }
                }
            }
            .padding(DS.Space.s5)
        }
        .task {
            DebugLogger.log("통계 화면 표시됨 (기간: \(period.label))", level: .info, tag: "FEATURE")
            if model.collectByMall == nil {
                await model.refreshStats()
            }
        }
    }

    private var periodPicker: some View {
        Picker("기간", selection: $period) {
            ForEach(Period.allCases) { p in
                Text(p.label).tag(p)
            }
        }
        .pickerStyle(.segmented)
        .frame(width: 240)
        .labelsHidden()
        .onChange(of: period) { _, newValue in
            DebugLogger.log("통계 기간 \(newValue.label) 선택", level: .info, tag: "FEATURE")
            Task { await model.refreshStats(days: newValue.rawValue) }
        }
    }

    // ── ① 수집 현황 (몰별) ───────────────────────────────

    private func collectSection(_ days: [MallDay]) -> some View {
        VStack(alignment: .leading, spacing: DS.Space.s3) {
            Text("일별 수집 현황 (몰별)")
                .font(DS.Font.section)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .bottom, spacing: 2) {
                    ForEach(days, id: \.date) { d in
                        let maxV = max(d.coupang, d.naver, d.oliveyoung, 1)
                        HStack(alignment: .bottom, spacing: 1) {
                            coloredBar(d.coupang, maxV, DS.Color.mallCoupang)
                            coloredBar(d.naver, maxV, DS.Color.mallNaver)
                            coloredBar(d.oliveyoung, maxV, DS.Color.mallOliveyoung)
                        }
                    }
                }
                .frame(height: 150)
            }
            HStack(spacing: DS.Space.s4) {
                LegendItem(color: DS.Color.mallCoupang, label: "쿠팡")
                LegendItem(color: DS.Color.mallNaver, label: "네이버")
                LegendItem(color: DS.Color.mallOliveyoung, label: "올리브영")
            }
            .font(DS.Font.caption)
        }
        .card()
    }

    private func coloredBar(_ v: Int, _ maxV: Int, _ color: Color) -> some View {
        RoundedRectangle(cornerRadius: 2)
            .fill(color)
            .frame(width: 4, height: CGFloat(v) / CGFloat(maxV) * 125)
    }

    // ── ② 가격 TOP 변동 (하락/상승) ───────────────────────

    private func moversSection(_ tm: TopMoversResponse) -> some View {
        VStack(alignment: .leading, spacing: DS.Space.s3) {
            Text("가격 변동 TOP 10")
                .font(DS.Font.section)
            HStack(alignment: .top, spacing: DS.Space.s4) {
                moverColumn(title: "하락 (5%+)", items: tm.drops, color: DS.Color.danger, symbol: "arrow.down.right")
                moverColumn(title: "상승 (5%+)", items: tm.risers, color: DS.Color.success, symbol: "arrow.up.right")
            }
        }
        .card()
    }

    private func moverColumn(title: String, items: [MoverItem], color: Color, symbol: String) -> some View {
        VStack(alignment: .leading, spacing: DS.Space.s2) {
            HStack(spacing: DS.Space.s1) {
                Image(systemName: symbol).font(.system(size: 11)).foregroundStyle(color)
                Text(title).font(DS.Font.caption.weight(.semibold)).foregroundStyle(.secondary)
            }
            if items.isEmpty {
                Text("없음").font(DS.Font.caption).foregroundStyle(.tertiary)
            } else {
                ForEach(items) { it in
                    HStack(spacing: DS.Space.s2) {
                        VStack(alignment: .leading, spacing: 0) {
                            Text(it.name ?? "이름 없음")
                                .font(DS.Font.caption)
                                .lineLimit(1)
                            Text("\(it.price.wonText) ← \(it.previous.wonText) (\(it.mall ?? "-"))")
                                .font(DS.Font.caption2)
                                .foregroundStyle(.tertiary)
                        }
                        Spacer()
                        Text(String(format: "%.1f%%", it.changePct))
                            .font(DS.Font.caption.weight(.semibold))
                            .foregroundStyle(color)
                            .monospacedDigit()
                    }
                    Divider()
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // ── ③ 가격 동향 (하락/상승/무변동) ────────────────────

    private func movementSection(_ days: [MovementDay]) -> some View {
        VStack(alignment: .leading, spacing: DS.Space.s3) {
            Text("일별 가격 하락/상승")
                .font(DS.Font.section)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .bottom, spacing: 2) {
                    ForEach(days, id: \.date) { d in
                        let maxV = max(d.up, d.down, d.flat, 1)
                        VStack(alignment: .center, spacing: 1) {
                            HStack(alignment: .bottom, spacing: 1) {
                                coloredBar(d.down, maxV, DS.Color.danger)
                                coloredBar(d.up, maxV, DS.Color.success)
                                coloredBar(d.flat, maxV, DS.Color.primary.opacity(0.35))
                            }
                            .frame(height: 120)
                            Text(d.date.suffix(5))
                                .font(.system(size: 8))
                                .foregroundStyle(.tertiary)
                        }
                    }
                }
            }
            HStack(spacing: DS.Space.s4) {
                LegendItem(color: DS.Color.danger, label: "하락")
                LegendItem(color: DS.Color.success, label: "상승")
                LegendItem(color: DS.Color.primary.opacity(0.35), label: "무변동")
            }
            .font(DS.Font.caption)
        }
        .card()
    }

    // ── ④ 사용자 증가율 ─────────────────────────────────

    private func usersSection(_ us: UserStatsResponse) -> some View {
        VStack(alignment: .leading, spacing: DS.Space.s3) {
            Text("사용자 증가율")
                .font(DS.Font.section)
            HStack(spacing: DS.Space.s3) {
                StatCard(title: "기기 (누적)", value: "\(us.totals.devices)", color: DS.Color.primary, icon: "ipad.and.iphone")
                StatCard(title: "활성 24시간", value: "\(us.totals.active24h)", color: DS.Color.mallNaver, icon: "bolt")
                StatCard(title: "활성 7일", value: "\(us.totals.active7d)", color: DS.Color.success, icon: "calendar")
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .bottom, spacing: 2) {
                    ForEach(us.days, id: \.date) { d in
                        let maxV = max(d.newDevices, d.active7d, d.newWatches, 1)
                        HStack(alignment: .bottom, spacing: 1) {
                            coloredBar(d.newDevices, maxV, DS.Color.primary)
                            coloredBar(d.active7d, maxV, DS.Color.mallNaver)
                            coloredBar(d.newWatches, maxV, DS.Color.warning)
                        }
                    }
                }
                .frame(height: 120)
            }
            HStack(spacing: DS.Space.s4) {
                LegendItem(color: DS.Color.primary, label: "신규 기기")
                LegendItem(color: DS.Color.mallNaver, label: "활성(7일)")
                LegendItem(color: DS.Color.warning, label: "신규 찜")
            }
            .font(DS.Font.caption)
        }
        .card()
    }
}

/// 카드형 컨테이너 (라이트 미니멀 공통)
private extension View {
    func card() -> some View {
        padding(DS.Space.s4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: DS.Radius.lg))
            .overlay(
                RoundedRectangle(cornerRadius: DS.Radius.lg)
                    .stroke(Color.primary.opacity(0.08), lineWidth: 1)
            )
    }
}
