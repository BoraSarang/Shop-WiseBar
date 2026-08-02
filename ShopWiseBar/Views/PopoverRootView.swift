// PopoverRootView.swift — 메뉴바 팝오버 루트 (P1: 상품 카드 + URL 추가 + 갱신)
// PLATFORM: macos
import SwiftUI

struct PopoverRootView: View {
    @ObservedObject private var store = ProductStore.shared
    @ObservedObject private var popoverState = PopoverState.shared
    @ObservedObject private var scheduler = RefreshScheduler.shared

    @State private var urlText = ""
    @State private var isAdding = false
    @State private var addMessage: String?
    @FocusState private var urlFieldFocused: Bool

    private let pasteboard = NSPasteboard.general

    var body: some View {
        VStack(spacing: 10) {
            header
            if let suggested = popoverState.suggestedURL {
                suggestionBanner(url: suggested)
            }
            if store.products.isEmpty {
                emptyState
            } else {
                addSection
                productList
            }
        }
        .padding(12)
        .frame(width: 380, height: 500)
        .background(Color(nsColor: .windowBackgroundColor))
        .onAppear {
            if pasteboard.string(forType: .string)?.isSupportedProductURL == true {
                urlText = pasteboard.string(forType: .string) ?? ""
            }
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

    // MARK: - 브라우저 감지 제안 (T-21)

    @ViewBuilder
    private func suggestionBanner(url: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "sparkles")
                    .foregroundStyle(Color.accentColor)
                Text("브라우저에서 상품 페이지를 보고 있어요")
                    .font(.caption).bold()
                Spacer()
            }
            if let parsed = MallParser.parse(url) {
                Text("\(parsed.mall.displayName) 상품을 추적할까요?")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                HStack(spacing: 8) {
                    Button {
                        Task { await addSuggested(url: url) }
                    } label: {
                        if popoverState.isAddingSuggested {
                            ProgressView().controlSize(.mini)
                        } else {
                            Text("추적 시작")
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                    .disabled(popoverState.isAddingSuggested)
                    Button("닫기") { popoverState.clearSuggestion() }
                        .buttonStyle(.borderless)
                        .controlSize(.small)
                }
            } else {
                Text("지원하는 상품 페이지가 아닙니다")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.accentColor.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
    }

    private func addSuggested(url: String) async {
        popoverState.isAddingSuggested = true
        defer { popoverState.isAddingSuggested = false }
        let result = await PriceFetchCoordinator.shared.addFromURL(url)
        switch result {
        case .success(let product):
            popoverState.clearSuggestion()
            DebugLogger.shared.push(
                level: .ACTION,
                category: "ADD",
                message: "추적 제안 → 등록 완료",
                meta: ["productID": product.productID]
            )
        case .failure(let error):
            DebugLogger.shared.push(
                level: .WARN,
                category: "ADD",
                message: "추적 제안 등록 실패",
                meta: ["code": error.code]
            )
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
