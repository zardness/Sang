# 시장노트 (레아 재구현)

레퍼런스 화면 6장(`analysis/reference/`)을 분석해서, 같은 디자인과 기능으로 **실제 동작하는 풀스택 앱**으로 다시 만든 프로젝트입니다. 화면만으로 알 수 없는 서버 로직은 추론해 구현했고, 추론한 부분은 모두 표시해 두었습니다([docs/INFERENCE.md](docs/INFERENCE.md)).

> 모든 정보는 학습용이며 투자 권유가 아닙니다. ETF·지수 화면의 종목과 시세는 가상 예시 데이터입니다. **기업 분석** 화면만 P02·P04 Agent가 실제 공시·시세로 만든 결과(검증 전)를 보여 줍니다.

## 실행

Node.js 22.13 이상이 필요합니다. 설치는 이 폴더 안(`node_modules`)에만 되고, 전역 설치나 시스템 설정 변경은 없습니다.

```bash
npm install
npm run dev          # 웹 http://localhost:4317  ·  API http://127.0.0.1:4318
```

다른 앱과 포트가 겹치지 않도록 3000/5173/8080 대신 **4317(웹)·4318(API)** 을 쓰고, API는 127.0.0.1 에만 엽니다. 포트를 바꾸려면 `WEB_PORT=5000 API_PORT=5001 npm run dev`.

**서버 없이 HTML 한 파일로 보기:** `npm run build:html` → `dist-html/sijangnote.html`. 서버 로직(Hono 앱), P02·P04 Agent 결과, 글꼴까지 한 파일에 들어 있어 더블클릭으로 열립니다. 기록은 그 브라우저의 localStorage에만 남습니다.

배포용 실행: `npm run build && npm start` (API 서버가 빌드된 화면까지 함께 제공, http://127.0.0.1:4318).

데이터는 `data/sijangnote.db`(SQLite 파일 하나)에 저장됩니다. 처음 상태로 되돌리려면 이 파일을 지우면 됩니다. 앱을 지우려면 폴더를 통째로 지우면 끝입니다.

## 화면

| 경로 | 화면 | 동작 |
| --- | --- | --- |
| `/` | 랜딩 | 시장 카드, 통합 검색(종목·학습·용어), 기능 카드 |
| `/app/dashboard` | 대시보드 | 헤드라인 규칙, 기간 전환 차트와 툴팁, 지수 카드 눌러 전환, Agent 브리핑 |
| `/app/etf`, `/app/etf/:code` | 종목·ETF | 5개 탭, 6개월 예측 밴드, Agent 분석·등급, 관심 종목, 정리 리포트 자동 작성 |
| `/app/company`, `/app/company/:ticker` | 기업 분석 | P02 사업 분석(사업부 분기 매출·회사 매출·사업 질의·꼭 알아야 할 보류), P04 기술적 분석(관측 지표 17개·최근 시세·보류된 예측·해제 방법), Agent 보고서(L1~L4 × 성향, 주장·보류 등록부) |
| `/app/learn/:id` | 학습 | 7장 시리즈, 용어 풀이 카드, 총보수 계산기, 읽은 시간·완료 기록 |
| `/app/reports` | 보고서 평가 | .txt/.md 업로드 또는 붙여 넣기, 5개 항목 채점, '꼭 수정' 제안 적용, 다시 평가와 점수 기록 |
| `/app/ask` | AI에게 질문 | 근거 문서 검색(RAG), 단계 표시, 유사도 점수, 시세 조회 |
| `/app/strategy` | 투자 전략 | 적립식 시뮬레이터 (원본에 없던 화면) |
| `/app/settings` | 설정 | 기록 지우기 |

오른쪽 아래 **AI 챗봇** 버튼은 모든 화면에 있습니다. 참고서·용어 사전·P02·P04 Agent 주장에서 근거를 찾아 답하고 근거 문서와 유사도를 보여 줍니다. "삼성전자 HBM 매출" 같은 질문에는 P02 규칙대로 공시 사업 단위에 없다고 답합니다.

AI 패널(오른쪽)은 화면마다 내용이 바뀝니다: 대시보드는 브리핑, ETF는 Agent 분석, 질문은 답변 근거.

## Agent 연동 (P02·P04)

앱은 Agent를 다시 계산하지 않고, Agent가 저장한 결과 폴더를 **읽기만** 합니다(Python을 띄워 둘 필요 없음). `.env`와 캐시 폴더는 열지 않습니다.

1. `agents.config.example.json`을 `agents.config.json`으로 복사하고 두 Agent 폴더 경로를 적습니다(환경변수 `P02_DIR`·`P04_DIR`도 됨).
2. 앱은 각 폴더의 `p02_out/`·`p04_out/` 아래 **가장 최근 실행**의 `<종목>/result.json`, `company_revenue.csv`, `obs_table.csv`, `persona_reports/report_L?_<성향>.md`를 읽습니다. Agent를 다시 실행해 새 결과를 저장하면 새로고침만으로 반영됩니다.
3. 설정이 없거나 폴더를 못 찾으면 노트북 출력에서 뽑아 둔 `server/agent-snapshot/`(P02 v5.1 REPLAY_RAW, P04 v1.2 LIVE)을 씁니다. 화면 위쪽 배지가 "PC 결과 파일"인지 "노트북 스냅샷"인지 알려 줍니다.

두 Agent 모두 `publication_eligible=false`이고 P04 예측은 자료 계약 확인 전이라 보류 상태라서, 화면에 "검증 전"과 보류 사유를 항상 함께 보여 줍니다. AI 질문은 두 Agent의 확인된 주장도 근거 문서로 씁니다.

### 단일 HTML에 50개 결과 넣기

```bash
npm run agent:bundle   # 종목별 최신 결과를 standalone/agent-results/ 로 묶고 원본과 앱 결과를 비교
npm run build:html     # dist-html/sijangnote.html
npm run test:html      # file:// 로 열어 50개 표시·챗봇 답을 확인 (스크린샷: data/html-final-screens/)
npm run html:release   # sijangnote.html, sijangnote_Final_V1106.html 로 복사 (15MB 넘으면 실패)
```

`agent:bundle`은 `agents.ts`의 `latestRun` 규칙 그대로 종목별 최신 결과(주장 있는 것)를 고르고, 앱이 읽는 파일만 복사합니다. `.env`·캐시·원문 ZIP은 포함하지 않습니다. 크기를 줄이려고 앱이 쓰지 않는 필드·구역만 빼는데(`standalone/agent-bundle.ts`), 요약·보고서·챗봇 문서가 원본과 하나라도 다르면 실패합니다. 어떤 실행 폴더를 썼는지는 `standalone/agent-results/manifest.json`에 남고 기업 분석 목록 위에 표시됩니다.

챗봇은 질문에 기업 하나와 P02·P04·부문·사업부·보류 같은 말이 있으면 저장된 Agent 결과에서 바로 답하고, 출처(실행 폴더)·검증 전·보류 이유를 붙입니다(추론 INF-017). 공시 표 항목이 이자수익·순이자손익인 기업은 매출이라고 부르지 않습니다.

## OpenDART 실시간 공시 (50개 기업)

기업 분석은 코스피 주요 **50개 기업**을 다룹니다. 각 기업의 최근 90일 공시, 기업개황, 주요 재무(가장 최근 사업보고서 3개년과 그 뒤 분·반기 보고서)를 금융감독원 OpenDART에서 실시간으로 불러옵니다. 목록 위에는 50개 기업의 최근 3일 공시 피드가 나오고, AI 챗봇에 "현대차 최근 공시", "기아 영업이익 얼마야?"처럼 물으면 OpenDART에서 찾아 원문 링크와 함께 답합니다. 삼성전자·SK하이닉스는 여기에 P02·P04 Agent 탭이 더 붙습니다.

1. https://opendart.fss.or.kr 에서 인증키를 받습니다(무료, 하루 2만 건).
2. 키를 넣는 방법은 넷 중 하나입니다. 앞에 있는 것이 먼저입니다.
   - 환경변수 `DART_API_KEY`
   - `dart.config.json`의 `apiKey`
   - `dart.config.json`의 `envFile`에 이미 있는 `.env` 경로(예: P02 Agent 폴더의 `.env`)
   - 앱 폴더의 `.env`
   `.env`에서는 `DART_API_KEY`, `OPENDART_API_KEY`, `DART_KEY`, `CRTFC_KEY` 같은 이름의 줄만 읽고 나머지 줄은 쓰지 않습니다. `dart.config.json`과 `.env`는 `.gitignore`에 들어 있습니다.
3. 서버를 다시 켭니다. 키가 없으면 화면이 설정 방법을 안내하고, 나머지 기능은 그대로 동작합니다.

키는 서버 안에서만 쓰고 응답·화면·오류 메시지에 내보내지 않습니다. 공시는 5분, 기업개황·재무는 6시간, 고유번호 목록(`data/dart-cache/corpcode.json`)은 7일 동안 다시 부르지 않습니다. 서버 없이 여는 단일 HTML(`sijangnote.html`)은 키를 둘 곳이 없어서 실시간 공시 대신 안내만 보여 줍니다. 50개 목록과 캐시·재무 선택 규칙은 추론(INF-014~016)입니다.

### 50개 기업을 P02·P04 Agent로 분석하기

앱은 Agent 결과 폴더(`p02_out`·`p04_out`)에 새 종목이 생기면 그 기업에 Agent 탭을 자동으로 붙입니다. 노트북에 넣을 종목 설정은 다음 명령으로 만듭니다(앱을 인증키와 함께 한 번 켜 둔 뒤).

```
npm run agent:targets -- --top 10            # 50개 목록 앞 10개
npm run agent:targets -- --skip 10 --top 10  # 11~20번째
npm run agent:targets -- --all               # 50개 전부
```

`agent-targets\p02_targets_*.py`, `p04_targets_*.py`가 생깁니다. P02 노트북 [1-1]의 `TARGETS`·`EXTRA_COMPANIES`, P04 노트북 [1-1]의 `TARGETS`를 그 내용으로 바꾸고 실행하면 됩니다. P04는 Neon `price_daily`에 시세가 있는 종목만 분석됩니다.

## 테스트

```bash
npm test             # 단위·API 테스트 (vitest)
npm run test:e2e     # 브라우저 시나리오 12개 (Playwright, 전용 포트 4417/4418/4419, 임시 DB, 가짜 OpenDART)
```

## 폴더

```
analysis/   레퍼런스 이미지, 디자인 토큰, 재구현 스크린샷과 비교 이미지
docs/       SPEC.md(명세), INFERENCE.md(추론 원장), REPORT.md(결과 보고)
server/     Hono API, SQLite, 시세·예측·RAG·채점 로직, agents.ts(Agent 결과 읽기), agent-snapshot/
src/        React 화면
tests/      unit, e2e
```

## 외부 서비스

OpenDART(인증키를 넣었을 때만)를 빼면 없습니다. AI 기능(예측, Agent 분석, 질문 답변, 보고서 채점)은 모두 설명 가능한 규칙과 통계로 로컬에서 동작합니다. 글꼴(Pretendard)도 npm 패키지로 들어 있어 인터넷 없이 실행됩니다.
