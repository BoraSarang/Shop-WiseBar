import SwiftUI

/// 상태 — 서버 상태 + 크롤러 요약 + 수집 분포 + 수집 상품 랭킹 (라이트 미니멀, v0.16.17)
struct HealthView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DS.Space.s5) {
                PageHeader(title: "상태", subtitle: "서버 · 크롤러 · 수집 현황")

                if model.healthState == .loading {
                    ProgressView("데이터 로딩 중…")
                        .frame(maxWidth: .infinity, maxHeight: 200)
                } else if let err = model.healthError {
                    Text(err).font(DS.Font.body).foregroundStyle(DS.Color.danger)
                } else {
                    statusSection
                    crawlerSection
                    collectSection
                    productsSection
                }
            }
            .padding(DS.Space.s5)
        }
        .task { if model.healthState != .loaded { await model.refreshHealth() } }
    }

    // MARK: 서버 상태

    private var statusSection: some View {
        VStack(alignment: .leading, spacing: DS.Space.s3) {
            Text("서버 상태").font(DS.Font.section)
            if let h = model.serverHealth {
                let ok = h.status == "ok" && h.dbOk
                HStack(spacing: DS.Space.s4) {
                    statePill("서버", ok, h.status)
                    statePill("DB", h.dbOk, h.dbOk ? "정상" : "오류")
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("버전 v\(h.version) · 시작 " + h.startedAt.timeOrDate)
                            .font(DS.Font.caption).foregroundStyle(.secondary)
                        Text("최근 수집 \(h.lastCaptureAt?.timeOrDate ?? "-")" +
                             " · 크롤러 \(h.lastCrawlerRunAt?.timeOrDate ?? "-")")
                            .font(DS.Font.caption).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .padding(DS.Space.s4)
        .cardStyle
    }

    private func statePill(_ label: String, _ ok: Bool, _ value: String) -> some View {
        HStack(spacing: DS.Space.s1) {
            Circle().fill(ok ? DS.Color.success : DS.Color.danger).frame(width: 8, height: 8)
            Text("\(label) \(value)").font(DS.Font.body.weight(.semibold))
        }
    }

    // MARK: 크롤러 요약

    private var crawlerSection: some View {
        VStack(alignment: .leading, spacing: DS.Space.s3) {
            Text("크롤러 요약").font(DS.Font.section)
            if let cs = model.crawlerSummary {
                let l = cs.last24h
                if l.runs == 0 {
                    Text("최근 \(cs.hours)시간 실행 이력 없음")
                        .font(DS.Font.caption).foregroundStyle(.secondary)
                } else {
                    HStack(spacing: DS.Space.s3) {
                        StatCard(title: "배치 실행", value: "\(l.runs)회", icon: "play.circle")
                        StatCard(title: "성공", value: "\(l.success)회", color: DS.Color.success, icon: "checkmark.circle")
                        StatCard(title: "실패", value: "\(l.failed)회", color: l.failed == 0 ? DS.Color.success : DS.Color.danger, icon: "xmark.circle")
                        StatCard(title: "수집 건수", value: "\(l.count)건", color: DS.Color.primary, icon: "tray.down")
                    }
                    HStack(spacing: DS.Space.s4) {
                        miniStat("상품 없음", "\(l.gone)건")
                        miniStat("평균 소요", "\(l.avgDurationMs)ms")
                        miniStat("스테일 상품", "\(cs.staleProducts)건")
                        Spacer()
                    }
                    .padding(.top, 2)
                    if !cs.lastRuns.isEmpty {
                        Text("최근 실행").font(DS.Font.body.weight(.semibold)).padding(.top, DS.Space.s2)
                        ForEach(cs.lastRuns.prefix(6)) { r in
                            HStack(spacing: DS.Space.s2) {
                                Circle().fill(r.success ? DS.Color.success : DS.Color.danger).frame(width: 8, height: 8)
                                Text(r.mall).font(DS.Font.caption).frame(width: 80, alignment: .leading)
                                Text("성공 \(r.count)건\(r.gone > 0 ? " · 없음 \(r.gone)" : "")")
                                    .font(DS.Font.caption).foregroundStyle(.secondary)
                                if let err = r.error, !err.isEmpty {
                                    Text(err).font(DS.Font.caption2).foregroundStyle(DS.Color.danger).lineLimit(1).truncationMode(.tail)
                                }
                                Spacer()
                                Text(r.runAt.timeOrDate).font(DS.Font.caption2).foregroundStyle(.tertiary)
                            }
                            .padding(.vertical, 1)
                        }
                    }
                }
            }
        }
        .padding(DS.Space.s4)
        .cardStyle
    }

    private func miniStat(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(value).font(DS.Font.body.weight(.semibold)).monospacedDigit()
            Text(label).font(DS.Font.caption2).foregroundStyle(.secondary)
        }
    }

    // MARK: 수집 분포 (기존 CollectView 통합)

    private var collectSection: some View {
        VStack(alignment: .leading, spacing: DS.Space.s3) {
            Text("수집 분포").font(DS.Font.section)
            if let c = model.collect {
                HStack(spacing: DS.Space.s2) {
                    Image(systemName: "arrow.down.circle.fill")
                        .foregroundStyle(DS.Color.primary)
                    Text("전체 \(c.total)건")
                        .font(DS.Font.body.weight(.semibold))
                    Spacer()
                    if let last = c.lastCaptureAt {
                        Text("최근 \(last)").font(DS.Font.caption).foregroundStyle(.secondary)
                    }
                }
                .padding(.bottom, DS.Space.s1)
                let maxCount = c.sources.map(\.count).max() ?? 1
                ForEach(c.sources, id: \.source) { s in
                    HStack(spacing: DS.Space.s2) {
                        Text("\(s.source)").font(DS.Font.body.weight(.medium)).frame(width: 90, alignment: .leading)
                        GeometryReader { geo in
                            RoundedRectangle(cornerRadius: DS.Radius.sm)
                                .fill(DS.Color.primary.opacity(0.15))
                                .overlay(alignment: .leading) {
                                    RoundedRectangle(cornerRadius: DS.Radius.sm)
                                        .fill(DS.Color.primary.opacity(0.85))
                                        .frame(width: geo.size.width * CGFloat(s.count) / CGFloat(maxCount))
                                }
                        }
                        .frame(height: 8)
                        Text("\(s.count)건").font(DS.Font.caption).monospacedDigit().frame(width: 70, alignment: .trailing)
                        Text("\(s.count * 100 / max(maxCount, 1))%")
                            .font(DS.Font.caption2).foregroundStyle(.secondary).frame(width: 36, alignment: .trailing)
                    }
                }
            }
        }
        .padding(DS.Space.s4)
        .cardStyle
    }

    // MARK: 수집 상품 랭킹

    private var productsSection: some View {
        VStack(alignment: .leading, spacing: DS.Space.s3) {
            Text("수집 상품 인사이트").font(DS.Font.section)
            if let pt = model.productsTop {
                HStack(alignment: .top, spacing: DS.Space.s4) {
                    rankList("많이 수집된 상품", pt.mostCollected)
                    rankList("최근 수집", pt.recent)
                }
                HStack(alignment: .top, spacing: DS.Space.s4) {
                    rankList("품절 중", pt.soldOut)
                    rankList("품절→복귀", pt.restocked)
                }
            }
        }
        .padding(DS.Space.s4)
        .cardStyle
    }

    private func rankList(_ title: String, _ items: [ProductTopItem]) -> some View {
        VStack(alignment: .leading, spacing: DS.Space.s2) {
            Text(title).font(DS.Font.body.weight(.semibold))
            if items.isEmpty {
                Text("없음").font(DS.Font.caption).foregroundStyle(.secondary)
            } else {
                ForEach(Array(items.prefix(10).enumerated()), id: \.element.id) { idx, it in
                    HStack(spacing: DS.Space.s2) {
                        Text("\(idx + 1)").font(DS.Font.caption).foregroundStyle(.tertiary).frame(width: 16)
                        Text(it.name?.shortProduct ?? it.productId)
                            .font(DS.Font.caption).lineLimit(1).frame(maxWidth: .infinity, alignment: .leading)
                        if it.watchCount > 0 {
                            Text("★\(it.watchCount)").font(DS.Font.caption2).foregroundStyle(.orange)
                        }
                        Text("\(it.priceCount)회").font(DS.Font.caption).foregroundStyle(.secondary).monospacedDigit()
                    }
                    .padding(.vertical, 1)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

extension String {
    /// ISO UTC 시각 → "8/12 14:30" 형태 (KST) 축약
    var timeOrDate: String {
        guard let iso = ISO8601DateFormatter().date(from: self + "Z") ?? Self.kstFormatter(self) else { return self }
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.dateFormat = "M/d HH:mm"
        return f.string(from: iso)
    }

    private static func kstFormatter(_ s: String) -> Date? {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        f.timeZone = TimeZone(identifier: "Asia/Seoul")
        return f.date(from: String(s.prefix(19)))
    }
}

extension String {
    /// 상품명 20자 축약
    var shortProduct: String {
        count <= 20 ? self : String(prefix(18)) + "…"
    }
}

/// 공용 카드 스타일 — 라이트 미니멀 (controlBackground + 가벼운 경계선)
extension View {
    var cardStyle: some View {
        self
            .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: DS.Radius.lg))
            .overlay(
                RoundedRectangle(cornerRadius: DS.Radius.lg)
                    .stroke(Color.primary.opacity(0.08), lineWidth: 1)
            )
    }
}
