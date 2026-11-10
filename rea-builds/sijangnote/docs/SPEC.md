# 명세

## 입력
레퍼런스 이미지 6장 (1440px 데스크톱): 랜딩, 대시보드, ETF 상세(+AI 패널), 학습 3장, 보고서 평가, AI 질문(+답변 근거 패널). URL·동영상은 없어서 정적 분석(이미지 판독)으로 진행했고, 동적 분석은 재구현 앱을 직접 조작하며 원본 화면의 상태 전이와 맞는지 확인하는 방식으로 대신했습니다.

## 디자인 토큰
`analysis/design-tokens.json` (이미지 픽셀 샘플링). 네이비 #0e1330 / #1a2050, 보라 #5b4df5, 페이지 #f3f4fa, 상승 #e5384a, 하락 #3563e9, 앰버 #f5b544. 카드 반경 20px, 버튼 12px, 사이드바 248px(접힘 76px), AI 패널 372px, 상단바 72px, 글꼴 Pretendard.

## 기능 목록 (원본 대비)

| 기능 | 원본 | 재구현 |
| --- | --- | --- |
| 시장 카드·지수 KPI | 정적 값 | 같음 + 지수 카드 눌러 차트 전환 |
| 지수 차트 | 1주/1개월/1년/5년, 툴팁 | 같음 + 키보드(←/→)로 툴팁 이동 |
| ETF 예측 | "6개월 예측 (LSTM)" | 로그정규 분위수 모델로 대체, 화면에 그대로 밝힘 |
| Agent 분석 | 요약 + 비용/분산/변동성 | 같음 (규칙 기반, 근거 지표 툴팁) |
| 관심 종목 | 목록 | 추가·삭제(별 버튼) |
| 최종 정리 리포트 | 버튼 | 리포트를 만들어 바로 평가까지 |
| 학습 | 목차, 용어 링크, 용어 카드 | 같음 + 7장 전부, 진행률 자동 기록, 이전/다음 |
| 총보수 문장 | 고정 문장 | 원금·기간·수익률을 바꾸는 계산기 |
| 보고서 평가 | 점수 링, 5개 항목, 꼭 수정 | 같음 + 업로드/붙여 넣기, 제안 적용, 점수 기록, 평가 기준 공개 |
| AI 질문 | 답변, 단계, 근거 패널 | 같음 + 추천 질문, 질문 기록 저장, 시세 조회 |
| 검색 | 입력창 | 종목·학습·용어 통합 검색, 키보드 선택 |
| 알림 | 아이콘 | 브리핑 드롭다운 |
| 모바일 | 없음 | 390px 대응 (메뉴·AI 패널 서랍) |
| 투자 전략·설정 | 메뉴만 있음 | 적립식 시뮬레이터, 설정 화면 |

## 데이터 모델 (SQLite)
- `reports(id, title, kind, created, text, evaluation JSON, history JSON)`
- `progress(chapter_id, done, read_sec)`
- `watchlist(code, ord)`
- `chats(id, question, result JSON, created)`

시세·종목·학습 본문·용어는 코드 시드(`server/market.ts`, `server/content.ts`).

## API
`GET /api/market/summary`, `GET /api/market/:code/series?range=1w|1m|1y|5y|all`, `GET /api/dashboard`, `GET /api/etfs`, `GET /api/etfs/:code`, `GET /api/etfs/:code/forecast`, `GET /api/etfs/:code/agent`, `GET|POST|DELETE /api/watchlist[/:code]`, `GET /api/learn`, `GET /api/learn/:id`, `POST /api/learn/:id/progress`, `GET /api/glossary[/:term]`, `GET /api/calc/fee`, `GET /api/search?q=`, `GET|POST|DELETE /api/ask`, `GET|POST /api/reports`, `POST /api/reports/:id/rescore`, `DELETE /api/reports/:id`, `GET /api/inferences`.

## 일부러 하지 않은 것
- 실제 로그인·결제: 데모 계정 버튼만 둡니다.
- 실제 시세·외부 AI API 연결: 원본도 예시 데이터임을 밝히고 있어 가상 시세로 재현했습니다.
- PDF/Word 본문 추출: .txt/.md 와 붙여 넣기만 지원합니다.
