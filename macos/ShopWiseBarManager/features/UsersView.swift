import SwiftUI

/// 사용자 — 기기별 활동 추적 + 몰 간 가격 동향 비교 (v0.16.15, P1/P2)
struct UsersView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DS.Space.s4) {
                PageHeader(title: "사용자", subtitle: "기기 활동 · 가격 동향 비교")

                if model.usersState == .loading {
                    ProgressView("데이터 로딩 중…")
                        .frame(maxWidth: .infinity, maxHeight: 200)
                } else if let err = model.usersError {
                    Text(err).font(DS.Font.sm).foregroundStyle(DS.Color.danger)
                } else {
                    usersSection
                    priceSection
                }
            }
            .padding(DS.Space.s5)
        }
        .task { if model.usersState != .loaded { await model.refreshUsers() } }
    }

    // MARK: 기기 활동

    private var usersSection: some View {
        VStack(alignment: .leading, spacing: DS.Space.s3) {
            Text("기기 활동").font(DS.Font.lg.weight(.semibold))
            if let u = model.users {
                HStack(spacing: DS.Space.s3) {
                    StatCard(title: "전체 기기", value: "\(u.total)", icon: "iphone")
                    StatCard(title: "24시간 내 활동", value: "\(u.active24h)", color: DS.Color.success, icon: "bolt.circle")
                }
                if u.users.isEmpty {
                    Text("등록 기기 없음").font(DS.Font.sm).foregroundStyle(.secondary)
                } else {
                    Text("최근 활동순").font(DS.Font.md.weight(.semibold)).padding(.top, DS.Space.s1)
                    ForEach(u.users.prefix(20)) { user in
                        HStack(spacing: DS.Space.s2) {
                            Circle()
                                .fill(user.active ? DS.Color.success : .gray)
                                .frame(width: 8, height: 8)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(user.deviceId.prefix(12))
                                    .font(DS.Font.sm).monospacedDigit()
                                Text(user.lastSeenAt?.timeOrDate ?? "활동 없음")
                                    .font(DS.Font.xxs).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text("찜 \(user.watches)").font(DS.Font.xs).foregroundStyle(.secondary)
                            Text("수집 \(user.captures)").font(DS.Font.xs).foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 2)
                    }
                }
            }
        }
        .padding(DS.Space.s4)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: DS.Radius.lg))
    }

    // MARK: 가격 동향 비교

    private var priceSection: some View {
        VStack(alignment: .leading, spacing: DS.Space.s3) {
            Text("가격 동향 비교 (몰 간)").font(DS.Font.lg.weight(.semibold))
            if let pc = model.priceCompare {
                if pc.groups.isEmpty {
                    Text("동일상품이 여러 몰에 존재하지 않음")
                        .font(DS.Font.sm).foregroundStyle(.secondary)
                } else {
                    Text("총 \(pc.totalGroups)개 그룹 — 최저가 몰 대비 차이 %")
                        .font(DS.Font.xs).foregroundStyle(.secondary)
                    ForEach(pc.groups.prefix(15)) { g in
                        VStack(alignment: .leading, spacing: DS.Space.s1) {
                            Text(g.name?.shortProduct ?? g.normalizedName)
                                .font(DS.Font.md.weight(.semibold))
                            ForEach(g.rows, id: \.productId) { row in
                                HStack(spacing: DS.Space.s2) {
                                    MallBadge(mall: row.mall)
                                    Text("\(row.price.wonText)")
                                        .font(DS.Font.sm)
                                        .foregroundStyle(row.isCheapest ? DS.Color.success : .primary)
                                    if !row.isCheapest {
                                        Text("+\(row.diffPct, specifier: "%.1f")%")
                                            .font(DS.Font.xs)
                                            .foregroundStyle(DS.Color.danger)
                                    } else {
                                        Text("최저").font(DS.Font.xs).foregroundStyle(DS.Color.success)
                                    }
                                    Spacer()
                                }
                            }
                        }
                        .padding(DS.Space.s3)
                        .background(.quaternary.opacity(0.3), in: RoundedRectangle(cornerRadius: DS.Radius.md))
                    }
                }
            }
        }
        .padding(DS.Space.s4)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: DS.Radius.lg))
    }
}
