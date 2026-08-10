# 세션 로그 2026-08-10 (extension)

## 1. 무엇을 (T-번호)
- v0.16.10 올리브영 15자 ID 오염 버그 수정 완료·배포 검증 (커밋 db3942b / 800c5d6)
- v0.16.11 B+12자리 goodsNo 누락 수정 (커밋 f236ceb)

## 2. 어떤 플랫폼
- extension (content.js / background.js / manifest), server(크롤러 확인만), db(판별)

## 3. 빌드 결과 + PERF + CACHE
- 서버 /health 200 OK (v0.16.9, 배치 2건·렌더러 1 제한 배포 후 OOM 루프 종료 확인)
- 운영 배치 19:00: **c=2 a=2 gone=0** — 정상 상품 실가격 수집 (정샘물 쿠션 43,000원 등)
- DB: oliveyoung 63건, 15자 오염 0건, **B 접두사 정상 상품 2건 발견** (B000000258149=바디핌 97,000원, B000000231506=넥세라 178,000원)

## 4. 판별 기준 확정 (15자 ID 정책)
- 올리브영 goodsNo = **A+12자리 또는 B+12자리(13자)** (서버 crawlers/oliveyoung.py docstring 명시)
- 15자=이미지 파일명 순번 오남용 → 차단 유지 | 확장 필터 `^[AB]\d{12}$`

## 5. 남은 TODO
- Chrome에서 dist/shop-wisebar-v0.16.11.zip 재로드 (사용자 액션)
- dist/shop-wisebar-v0.16.10.zip 로컬 백업 (/tmp/wb-v0.16.10-backup.zip)

## 6. 문서 업데이트
- docs/CHANGELOG.md v0.16.11 항목 추가

## 7. 오프라인 큐 상태
- 미사용 (오프라인 큐 없음 — 본 프로젝트)

## 8. E2E/k6
- 없음 (확장 코드 단순 정규식 수정)