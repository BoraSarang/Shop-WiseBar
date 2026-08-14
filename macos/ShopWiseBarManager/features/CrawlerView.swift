import SwiftUI

/// 크롤러 — 설정(주기/활성화/즉시수집) + 배치 실행 이력. v0.16.1 (서버 API v0.16.0)
struct CrawlerView: View {
    @Environment(AppModel.self) private var model

    /// 주기 선택지 (초) — 서버 `CRAWLER_INTERVAL_CHOICES`와 동일
    private static let intervalOptions: [(Int, String)] = [
        (3600, "1시간"),
        (10800, "3시간"),
        (21600, "6시간"),
        (43200, "12시간"),
        (86400, "24시간"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: DS.Space.s4) {
            PageHeader(title: "크롤러", subtitle: "올리브영·네이버 자동 수집 설정 및 실행 이력")

            if let e = model.crawlerError, !e.isEmpty {
                errorBanner(e)
            }

            if let cfg = model.crawlerConfig {
                settingsCard(cfg)
                localBatchCard
                logsCard
            } else {
                ProgressView("데이터 로딩 중…")
                    .frame(maxWidth: .infinity, maxHeight: 300)
            }
            Spacer()
        }
        .padding(DS.Space.s5)
        .task { await model.refreshCrawler() }
    }

    // MARK: 설정 카드

    @ViewBuilder
    private func settingsCard(_ cfg: CrawlerConfig) -> some View {
        VStack(alignment: .leading, spacing: DS.Space.s3) {
            HStack {
                Image(systemName: "gearshape.2.fill")
                    .foregroundStyle(DS.Color.primary)
                Text("수집 설정")
                    .font(DS.Font.md.weight(.semibold))
                Spacer()
                statusPill(cfg)
            }

            HStack(spacing: DS.Space.s4) {
                // 주기 선택
                VStack(alignment: .leading, spacing: DS.Space.s1) {
                    Text("수집 주기")
                        .font(DS.Font.sm)
                        .foregroundStyle(.secondary)
                    Picker("수집 주기", selection: intervalBinding(interval: cfg.intervalSeconds)) {
                        ForEach(Self.intervalOptions, id: \.0) { option in
                            Text(option.1).tag(option.0)
                        }
                    }
                    .pickerStyle(.segmented)
                    .labelsHidden()
                    .frame(width: 420)
                }

                // 활성화 토글
                Toggle(isOn: enabledBinding(cfg.enabled)) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("활성화")
                            .font(DS.Font.sm)
                        Text(cfg.enabled ? "주기에 따라 자동 수집" : "자동 수집 중지")
                            .font(DS.Font.xs)
                            .foregroundStyle(.secondary)
                    }
                }
                .toggleStyle(.switch)

                Spacer()

                // 즉시 수집
                Button {
                    Task { await model.requestCrawl() }
                } label: {
                    if model.crawlerBusy {
                        ProgressView().controlSize(.small)
                    } else {
                        Label("지금 수집", systemImage: "bolt.fill")
                    }
                }
                .disabled(model.crawlerBusy)
                .buttonStyle(.borderedProminent)
                .tint(DS.Color.primary)
                .help("다음 틱(30초) 내 올리브영+네이버 1배치 실행")
            }
        }
        .padding(DS.Space.s4)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: DS.Radius.lg))
    }

    // MARK: 로컬 배치 (v0.16.16, T-127)

    private var localBatchCard: some View {
        VStack(alignment: .leading, spacing: DS.Space.s3) {
            HStack {
                Image(systemName: "terminal")
                    .foregroundStyle(DS.Color.primary)
                Text("로컬 배치")
                    .font(DS.Font.md.weight(.semibold))
                Spacer()
                statusDot
            }
            Text("이 맥에서 run-local-crawler.sh로 수집합니다. 수동으로 시작/종료하며, 수집 대상 목록 페이지도 함께 파싱합니다.")
                .font(DS.Font.xs)
                .foregroundStyle(.secondary)

            HStack(spacing: DS.Space.s3) {
                Button {
                    model.startLocalBatch()
                } label: {
                    Label("시작", systemImage: "play.fill")
                }
                .buttonStyle(.borderedProminent)
                .tint(DS.Color.success)
                .disabled(model.localBatchRunning)

                Button {
                    model.stopLocalBatch()
                } label: {
                    Label("중지", systemImage: "stop.fill")
                }
                .buttonStyle(.bordered)
                .disabled(!model.localBatchRunning)

                Button {
                    Task { await model.runLocalBatchOnce() }
                } label: {
                    Label("1회 실행", systemImage: "bolt")
                }
                .buttonStyle(.bordered)
                .disabled(model.localBatchRunning)

                Spacer()
            }

            // 로그 뷰어
            ScrollView {
                Text(model.localBatchLog)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
            }
            .frame(maxHeight: 160)
            .padding(DS.Space.s2)
            .background(Color.black.opacity(0.35), in: RoundedRectangle(cornerRadius: DS.Radius.md))
        }
        .padding(DS.Space.s4)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: DS.Radius.lg))
    }

    private var statusDot: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(model.localBatchRunning ? DS.Color.success : DS.Color.danger)
                .frame(width: 8, height: 8)
            Text(model.localBatchRunning ? "실행 중" : "중지")
                .font(DS.Font.xs)
                .foregroundStyle(.secondary)
        }
    }

    private func intervalBinding(interval: Int) -> Binding<Int> {
        Binding(
            get: { Self.intervalOptions.contains(where: { $0.0 == interval }) ? interval : 3600 },
            set: { newValue in
                Task { await model.setCrawlerInterval(newValue) }
            }
        )
    }

    private func enabledBinding(_ enabled: Bool) -> Binding<Bool> {
        Binding(
            get: { enabled },
            set: { newValue in
                Task { await model.toggleCrawlerEnabled(newValue) }
            }
        )
    }

    private func statusPill(_ cfg: CrawlerConfig) -> some View {
        HStack(spacing: 4) {
            Circle()
                .fill(cfg.enabled ? DS.Color.success : DS.Color.danger)
                .frame(width: 8, height: 8)
            Text(cfg.enabled ? "자동 수집 중" : "중지")
                .font(DS.Font.xs)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: 실행 이력

    private var logsCard: some View {
        VStack(alignment: .leading, spacing: DS.Space.s2) {
            HStack {
                Image(systemName: "clock.arrow.circlepath")
                    .foregroundStyle(DS.Color.primary)
                Text("실행 이력")
                    .font(DS.Font.md.weight(.semibold))
                Text("최근 \(model.crawlerLogs.count)건")
                    .font(DS.Font.xs)
                    .foregroundStyle(.secondary)
                Spacer()
                Button {
                    Task { await model.refreshCrawler() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .buttonStyle(.borderless)
                .help("이력 새로고침")
            }

            if model.crawlerLogs.isEmpty {
                Text("아직 실행 이력이 없습니다.")
                    .font(DS.Font.sm)
                    .foregroundStyle(.secondary)
                    .padding(.vertical, DS.Space.s3)
            } else {
                ScrollView {
                    LazyVStack(spacing: DS.Space.s1) {
                        ForEach(model.crawlerLogs) { log in
                            logRow(log)
                        }
                    }
                }
                .frame(maxHeight: 240)
            }
        }
        .padding(DS.Space.s4)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: DS.Radius.lg))
    }

    private func logRow(_ log: CrawlerLog) -> some View {
        HStack(spacing: DS.Space.s3) {
            Text(log.mall)
                .font(DS.Font.xs)
                .foregroundStyle(.white)
                .padding(.horizontal, DS.Space.s2)
                .padding(.vertical, 2)
                .background(DS.Color.mall(log.mall), in: .capsule)

            statusIcon(log)

            // v0.16.2 (T-119) — "대상 N건 중 성공 M · 실패 K"
            // v0.16.8 (T-121) — 상품 없음(gone) 별도 표시 — 실패로 퉁치지 않음
            HStack(spacing: 6) {
                Text("대상 \(log.attempted)건 중")
                    .foregroundStyle(.secondary)
                Text("성공 \(log.count)")
                    .foregroundStyle(DS.Color.success)
                if log.gone > 0 {
                    Text("·")
                        .foregroundStyle(.secondary)
                    Text("상품없음 \(log.gone)")
                        .foregroundStyle(.secondary)
                }
                if log.failed > 0 {
                    Text("·")
                        .foregroundStyle(.secondary)
                    Text("실패 \(log.failed)")
                        .foregroundStyle(DS.Color.danger)
                }
            }
            .font(DS.Font.sm.weight(.medium))
            .monospacedDigit()

            Spacer()

            // v0.16.8 (T-121) — 실패 사유 (있을 때만)
            if let error = log.error, !error.isEmpty {
                Text(error)
                    .font(DS.Font.xs)
                    .foregroundStyle(DS.Color.danger)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .help(error)
                    .frame(maxWidth: 140, alignment: .trailing)
            }

            Text(triggerLabel(log.trigger))
                .font(DS.Font.xs)
                .foregroundStyle(.secondary)

            Text(durationText(log.durationMs))
                .font(DS.Font.xs)
                .monospacedDigit()
                .foregroundStyle(.secondary)

            Text(log.runAt)
                .font(DS.Font.xs)
                .monospacedDigit()
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, DS.Space.s2)
        .padding(.horizontal, DS.Space.s2)
        .background(rowBackground(log), in: RoundedRectangle(cornerRadius: DS.Radius.sm))
    }

    /// v0.16.8 (T-121) — 3상태 아이콘: 성공 ✓ / 상품없음 ∘ / 실패 ✕
    @ViewBuilder
    private func statusIcon(_ log: CrawlerLog) -> some View {
        if log.count > 0 {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(DS.Color.success)
        } else if log.gone > 0 && log.failed == 0 {
            Image(systemName: "circle.lefthalf.filled")
                .foregroundStyle(.secondary)
        } else {
            Image(systemName: "xmark.circle.fill")
                .foregroundStyle(DS.Color.danger)
        }
    }

    private func rowBackground(_ log: CrawlerLog) -> Color {
        if log.count > 0 { return .clear }            // 성공 — 무배경
        if log.gone > 0 && log.failed == 0 { return Color.clear }  // 상품없음 — 무배경
        return DS.Color.danger.opacity(0.08)          // 실패 — 연분홍
    }

    private func triggerLabel(_ trigger: String) -> String {
        switch trigger {
        case "manual": return "수동"
        case "schedule": return "예약"
        default: return trigger
        }
    }

    private func durationText(_ ms: Int) -> String {
        let s = Double(ms) / 1000
        return String(format: "%.1fs", s)
    }

    // MARK: 오류 배너

    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: DS.Space.s2) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(DS.Color.danger)
            Text(message)
                .font(DS.Font.sm)
                .foregroundStyle(DS.Color.danger)
            Spacer()
        }
        .padding(DS.Space.s3)
        .background(DS.Color.danger.opacity(0.08), in: RoundedRectangle(cornerRadius: DS.Radius.md))
    }
}