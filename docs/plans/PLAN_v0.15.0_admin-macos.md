# PLAN_v0.15.0 — 똑바 매니저 (macOS 관리 앱)

> 작성: 2026-08-08 · 플랫폼: server + macos · 상태: 진행
> 사용자 요구: DB에 쌓인 정보를 똑바 관리 프로그램(Mac 네이티브 앱)으로 조회. 인사이트/대시보드/전체/쇼핑몰별/수집 통계 + 익스텐션 공통 핫딜.
> 디자인: Mac 음악 앱 스타일 + 네이티브 디자인 시스템.

## 1. 결정 사항

| 항목 | 결정 |
|------|------|
| 데이터 | 운영 서버 `https://shop-wisebar.onrender.com` 조회 (DB 직접 접근 없음) |
| 인증 | 없음 (읽기 전용 공개 API + 신규 /admin/* 집계) |
| 관리 범위 | 조회 전용 (read-only) |
| 개발 | SwiftUI 네이티브 + xcodegen 2.45.4 (Xcode 26.6, Swift 6.3, macOS 14+ 타깃) |
| 디자인 | Music 앱 스타일 NavigationSplitView + Swift DesignSystem 토큰 |

## 2. 아키텍처

### 서버 (server/app/routers/admin.py)
| endpoint | 응답 |
|----------|------|
| GET /admin/overview | 상품/기기/찜/가격포인트/일별통계/알림/관계 수 + 품절 중 상품 |
| GET /admin/trend?days=30 | 일별 수집량·가격포인트·신규상품 시리즈 |
| GET /admin/malls | 몰별 상품수·평균가·하락·최저가갱신·찜수 |
| GET /admin/collect | 소스별 수집 수 + 최근 수집 시각 |
| GET /admin/insight | 알림 타입 분포 + 하락/최저가 TOP |
| (기존) GET /deals/public | 공통 핫딜 피드 재사용 |

### macOS (macos/ — 똑바 매니저)
```
macos/
├── project.yml                     # xcodegen
├── ShopWiseBarManager/
│   ├── App.swift                   # NavigationSplitView
│   ├── SidebarView.swift
│   ├── APIClient.swift             # URLSession async/await, 서버 토글
│   ├── AppModel.swift              # @Observable 전역 상태
│   ├── design/ (DesignSystem.swift, Components.swift)
│   └── features/ (dashboard/insight/stats/collect/deals)
```

## 3. 테스트

- 서버: tests/test_admin.py 5건 (빈 DB/시딩 카운트)
- macOS: swiftc 빌드 + xcodegen 프로젝트 생성 확인, 운영서버 실데이터 렌더

## 4. 롤백

- 서버 admin 라우터는 별도 커밋 → revert로 제거
- macOS 폴더 신규 (기존 코드 영향 없음)