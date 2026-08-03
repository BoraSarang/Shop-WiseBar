// PopoverRootView.swift — 메뉴바 팝오버 루트 (T-57: 캐치/홈/찜 목록 2모드)
// 모드 1: 캐치 중 → CapturedProductView (상품 정보 + 가격 추이)
// 모드 2: 기본 → 마지막에 본 상품 + 찜 목록 진입 / 찜 목록 → 기존 전체 관리
// PLATFORM: macos
import SwiftUI

struct PopoverRootView: View {
    @ObservedObject private var store = ProductStore.shared
    @ObservedObject private var popoverState = PopoverState.shared
    @ObservedObject private var scheduler = RefreshScheduler.shared

    @State private var urlText = ""
    @State private var isAdding = false
    @State private var addMessage: String?
    @State private var lastViewed: CapturedProduct?
    @State private var isLoadingLastViewed = false
    @FocusState private var urlFieldFocused: Bool

    private let pasteboard = NSPasteboard.general

    var body: some View {
        VStack(spacing: 10) {
            header
            switch popoverState.viewMode {
            case .home:
                if let captured = popoverState.capturedProduct {
                    CapturedProductView(product: captured)
                    Spacer(minLength: 0)
                } else {
                    homeContent
                }
            case .watchlist:
                watchlistContent
            }
        }
        .padding(12)
        .frame(width: 380, height: 500)
        .background(Color(nsColor: .windowBackgroundColor))
        .onAppear {
            if pasteboard.string(forType: .string)?.isSupportedProductURL == true {
                urlText = pasteboard.string(forType: .string) ?? ""
            }
            Task { await refreshLastViewed() }
            // 디버그 자동화: AutoAddURL에 등록할 URL을 넣으면 자동 등록
            // 트리거: `defaults write com.borasarang.ShopWiseBar AutoAddURL -string "<url>"`
            #if DEBUG
            if let autoURL = UserDefaults.standard.string(forKey: "AutoAddURL"), !autoURL.isEmpty {
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    urlText = autoURL
                    addProduct()
                }
            }
            #endif
        }
        .onChange(of: popoverState.lastOpenedAt) { _ in
            Task { await refreshLastViewed() }
        }
        .onChange(of: popoverState.focusAddField) { focused in
            if focused {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    urlFieldFocused = true
                }
                popoverState.focusAddField = false
            }
        }
    }

    // MARK: - 헤더

    private var header: some View {
        HStack(spacing: 8) {
            Image(systemName: "chart.line.downtrend.xyaxis")
                .foregroundStyle(Color.accentColor)
            Text("똑바 — 가격 추적")
                .font(.headline)
            Spacer()
            Text("\(store.products.count)개")
                .font(.caption)
                .foregroundStyle(.secondary)
            if scheduler.isRunning {
                ProgressView()
                    .controlSize(.small)
            }
            Button {
                Task { await scheduler.runNow() }
            } label: {
                Image(systemName: "arrow.clockwise")
            }
            .buttonStyle(.borderless)
            .help("지금 갱신")
        }
    }

    // MARK: - 홈 모드 (캐치 없음 — 마지막에 본 상품)

    @ViewBuilder
    private var homeContent: some View {
        VStack(spacing: 10) {
            lastViewedSection
            Spacer()
            Button {
                popoverState.showWatchlist()
            } label: {
                Label("찜한 상품 보기", systemImage: "chevron.right")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
            .disabled(store.products.isEmpty && lastViewed == nil)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private var lastViewedSection: some View {
        if isLoadingLastViewed {
            ProgressView()
                .controlSize(.small)
                .padding(.top, 40)
        } else if let lastViewed {
            lastViewedCard(lastViewed)
        } else {
            VStack(spacing: 10) {
                Image(systemName: "eyes")
                    .font(.system(size: 36, weight: .light))
                    .foregroundStyle(.secondary)
                Text("마지막에 본 상품")
                    .font(.headline)
                Text("브라우저에서 쇼핑 상품 페이지를 열면\n여기에 가격 추이와 함께 표시됩니다")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func lastViewedCard(_ product: CapturedProduct) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 10) {
                capturedProductImage(product, size: 40)
                VStack(alignment: .leading, spacing: 3) {
                    Text("마지막에 본 상품")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text(product.name)
                        .font(.caption.weight(.medium))
                        .lineLimit(1)
                    HStack(alignment: .firstTextBaseline, spacing: 4) {
                        if let price = product.currentPrice {
                            Text(price.formatted(.number))
                                .font(.subheadline.bold())
                                .monospacedDigit()
                            Text("원")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        } else {
                            Text("가격 정보 없음")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                Spacer(minLength: 0)
                Button {
                    openCapturedInBrowser(product)
                } label: {
                    Image(systemName: "arrow.up.right.square")
                }
                .buttonStyle(.borderless)
                .help("브라우저에서 열기")
            }
            if product.pricePoints.count >= 2 {
                PriceHistoryChartView(points: product.pricePoints)
                    .frame(height: 60)
            }
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(Color(nsColor: .controlBackgroundColor))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color.primary.opacity(0.06), lineWidth: 1)
        )
        .contentShape(Rectangle())
        .onTapGesture { openCapturedInBrowser(product) }
    }

    private func capturedProductImage(_ product: CapturedProduct, size: CGFloat) -> some View {
        Group {
            if let url = URL(string: product.imageURLString), !product.imageURLString.isEmpty {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFit()
                    default:
                        placeholderImage(product, size: size)
                    }
                }
            } else {
                placeholderImage(product, size: size)
            }
        }
        .frame(width: size, height: size)
        .background(Color(nsColor: .quaternaryLabelColor).opacity(0.15))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func placeholderImage(_ product: CapturedProduct, size: CGFloat) -> some View {
        Image(systemName: product.mall.iconName)
            .font(.system(size: size * 0.38))
            .foregroundStyle(.secondary)
            .frame(width: size, height: size)
    }

    private func openCapturedInBrowser(_ product: CapturedProduct) {
        guard let url = product.productURL else { return }
        NSWorkspace.shared.open(url)
        DebugLogger.shared.push(
            level: .ACTION,
            category: "OPEN",
            message: "브라우저에서 상품 열기",
            meta: ["productID": product.id, "url": url.absoluteString]
        )
    }

    // MARK: - 찜 목록 모드 (기존 관리 화면)

    @ViewBuilder
    private var watchlistContent: some View {
        VStack(spacing: 8) {
            HStack {
                Button {
                    popoverState.showHome()
                } label: {
                    Label("뒤로", systemImage: "chevron.left")
                }
                .buttonStyle(.borderless)
                .controlSize(.small)
                Spacer()
            }
            if store.products.isEmpty {
                emptyState
            } else {
                addSection
                productList
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - 상품 추가

    private var addSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                TextField("상품 주소 붙여넣기 (쿠팡/네이버/올리브영)", text: $urlText)
                    .textFieldStyle(.roundedBorder)
                    .font(.caption)
                    .focused($urlFieldFocused)
                    .onSubmit { addProduct() }
                Button("추가") { addProduct() }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                    .disabled(urlText.trimmingCharacters(in: .whitespaces).isEmpty || isAdding)
            }
            if let message = addMessage {
                Text(message)
                    .font(.caption2)
                    .foregroundStyle(message.hasPrefix("등록") ? .green : .red)
            }
        }
    }

    // MARK: - 상품 리스트

    private var productList: some View {
        ScrollView {
            LazyVStack(spacing: 8) {
                ForEach(store.products) { product in
                    ProductCardView(store: store, product: product)
                        .overlay {
                            if popoverState.autoShowProductID == product.productID {
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color.accentColor, lineWidth: 2)
                            }
                        }
                }
            }
        }
        .scrollIndicators(.automatic)
        .onChange(of: popoverState.autoShowProductID) { productID in
            if productID != nil {
                DebugLogger.shared.push(
                    level: .ACTION,
                    category: "MONITOR",
                    message: "관심 상품 카드 강조 표시",
                    meta: ["productID": productID ?? ""]
                )
                // 6초 후 강조 해제
                DispatchQueue.main.asyncAfter(deadline: .now() + 6) {
                    popoverState.clearAutoShow()
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "chart.line.downtrend.xyaxis")
                .font(.system(size: 40, weight: .light))
                .foregroundStyle(.secondary)
            Text("추적 중인 상품이 없습니다")
                .font(.headline)
            Text("브라우저에서 쇼핑 상품 페이지를 열거나\n상품 공유 주소를 복사해 보세요")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            addSection
                .frame(maxWidth: 260)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - 마지막 본 상품 조회 (T-57)

    private func refreshLastViewed() async {
        guard popoverState.capturedProduct == nil else { return } // 캐치 중이면 캐치 뷰가 우선
        guard let productID = popoverState.lastViewedProductID else {
            lastViewed = nil
            isLoadingLastViewed = false
            return
        }
        isLoadingLastViewed = true
        defer { isLoadingLastViewed = false }
        do {
            if let server = try await ServerClient.shared.getProduct(productID: productID) {
                let points = (try? await ServerClient.shared.getPriceHistory(productID: productID)) ?? []
                lastViewed = CapturedProduct(
                    id: productID,
                    mall: Mall(rawValue: server.mall) ?? .naver,
                    name: server.name ?? "상품 정보 없음",
                    imageURLString: server.image ?? "",
                    urlString: server.url,
                    currentPrice: server.last_price,
                    isWatched: server.is_watched,
                    targetPrice: server.target_price,
                    pricePoints: points
                )
            } else {
                lastViewed = nil
            }
        } catch {
            lastViewed = nil
        }
    }

    // MARK: - 액션

    private func addProduct() {
        let urlString = urlText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !urlString.isEmpty else { return }
        isAdding = true
        addMessage = nil
        Task {
            let result = await PriceFetchCoordinator.shared.addFromURL(urlString)
            isAdding = false
            switch result {
            case .success(let product):
                urlText = ""
                addMessage = product.name.contains("가격 수집 대기")
                    ? "등록 완료 — 가격 수집은 P2(브라우저 세션)에서 지원 예정"
                    : "등록 완료: \(product.name.prefix(20))"
                DebugLogger.shared.push(
                    level: .ACTION,
                    category: "ADD",
                    message: "URL 등록 성공",
                    meta: ["productID": product.productID]
                )
            case .failure(let error):
                addMessage = error.userMessage
                DebugLogger.shared.push(
                    level: .WARN,
                    category: "ADD",
                    message: "URL 등록 실패",
                    meta: ["code": error.code]
                )
            }
        }
    }
}

private extension String {
    /// URL 문자열이 지원 몰 형식인지 (등록 가능 후보)
    var isSupportedProductURL: Bool {
        MallParser.parse(self) != nil
    }
}
