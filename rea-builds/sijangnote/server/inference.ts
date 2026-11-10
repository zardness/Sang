// 추론 원장 (docs/INFERENCE.md 와 같은 내용).
// 화면만으로는 알 수 없어 추론해서 구현한 서버 로직의 목록입니다.
// 코드에서는 `[추론 INF-xxx]` 주석으로, API 응답에서는 X-Rea-Inferred 헤더로 연결됩니다.

export type Confidence = "높음" | "중간" | "낮음";
export type Inference = {
  id: string;
  area: string;
  claim: string;
  evidence: string;
  confidence: Confidence;
  alternative: string;
  screens: string[]; // 영향을 주는 화면 경로 접두사
};

export const INFERENCES: Inference[] = [
  {
    id: "INF-001",
    area: "시세 데이터",
    claim: "시세는 실제 시장 데이터가 아니라 기준값(화면에 보인 종가·등락률)에 맞춘 가상 시계열이다. 시드 고정 기하 브라운 운동으로 생성하고 마지막 두 점을 화면 값에 고정한다.",
    evidence: "푸터 '수치는 예시 데이터입니다', 종목명 '가상 예시 종목'(화면 01, 03)",
    confidence: "높음",
    alternative: "실제 시세 API를 지연 호출하는 구조",
    screens: ["/", "/app/dashboard", "/app/etf"],
  },
  {
    id: "INF-002",
    area: "대시보드 헤드라인",
    claim: "헤드라인은 코스피와 코스닥 등락률 차이로 정한다. 코스피가 0.3%p 이상 앞서면 '대형주가 시장을 끌어올렸어요'.",
    evidence: "코스피 +1.16% > 코스닥 +0.54% 인 날의 문구(화면 02)",
    confidence: "중간",
    alternative: "LLM이 뉴스 요약으로 매일 작성",
    screens: ["/app/dashboard"],
  },
  {
    id: "INF-003",
    area: "가격 예측",
    claim: "'6개월 예측' 밴드는 5년 일간 로그수익률의 평균·표준편차로 만든 로그정규 분위수(10%~90%)이다. 화면의 'LSTM' 라벨은 원본이 신경망을 쓴다는 뜻으로 보이지만, 여기서는 설명 가능한 통계 모델로 대체했고 화면에도 그렇게 표시한다.",
    evidence: "점선 중앙값 + 시간이 갈수록 넓어지는 부채꼴 밴드(화면 03). 폭이 √t 에 비례해 보임",
    confidence: "중간",
    alternative: "LSTM 다중 샘플의 분위수, 몬테카를로 부트스트랩",
    screens: ["/app/etf"],
  },
  {
    id: "INF-004",
    area: "Agent 분석",
    claim: "Agent 요약과 비용·분산·변동성 등급은 규칙 기반이다. 비용: 총보수 <0.2% 낮음, <0.5% 중간. 분산: 구성 종목 ≥100 높음, ≥30 중간. 변동성: 연환산 변동성 <12% 낮음, <22% 중간.",
    evidence: "총보수 0.07% → 비용 낮음, S&P 500 → 분산 높음, 지수 ETF → 변동성 중간(화면 03)",
    confidence: "중간",
    alternative: "LLM이 지표를 읽고 등급을 매김",
    screens: ["/app/etf"],
  },
  {
    id: "INF-005",
    area: "AI 질문(RAG)",
    claim: "답변 근거 점수는 질문과 문서의 코사인 유사도이며, 한국어 문자 2-gram TF-IDF로 계산한다. 답변은 상위 문서에서 질문과 가장 닮은 문장을 골라 구성한다.",
    evidence: "'숫자는 질문과 문서의 유사도입니다. RAG 검색 결과를 그대로 보여줍니다'와 0~1 사이 점수(화면 06)",
    confidence: "중간",
    alternative: "임베딩 벡터 검색 + LLM 생성",
    screens: ["/app/ask"],
  },
  {
    id: "INF-006",
    area: "보고서 평가",
    claim: "100점은 근거 자료·용어 정확성·데이터 분석·위험 설명·기대 결과 5개 항목 × 20점이다. 각 항목은 문장 단위 신호(숫자·출처 표현, 용어 사전 단어, 비교 표현, 위험 단어, 결론 표현)를 세어 점수를 매기고, 가장 낮은 항목을 '꼭 수정'으로 띄운다.",
    evidence: "항목 점수 합 18+17+16+11+20=82, 최댓값 20(화면 05)",
    confidence: "높음",
    alternative: "LLM 채점 + 루브릭",
    screens: ["/app/reports"],
  },
  {
    id: "INF-007",
    area: "보고서 수정 제안",
    claim: "위험 설명 수정 제안은 해당 ETF의 5년 최대 낙폭과 환율 위험을 숫자로 채운 템플릿 문장이다.",
    evidence: "'과거 5년 최대 하락폭은 −24%였고, 원화 강세 시 환차손이 생길 수 있다'(화면 05)",
    confidence: "중간",
    alternative: "LLM이 문장을 다시 씀",
    screens: ["/app/reports"],
  },
  {
    id: "INF-008",
    area: "총보수 계산",
    claim: "'0.07%와 0.25%의 차이는 1,000만원을 10년 두면 약 33만원' 은 연 6.5% 수익을 가정한 복리 계산이다.",
    evidence: "1,000만 × 1.065¹⁰ × (0.9993¹⁰ − 0.9975¹⁰) ≈ 33.3만원(화면 04)",
    confidence: "중간",
    alternative: "다른 수익률 가정(6~7%)",
    screens: ["/app/learn"],
  },
  {
    id: "INF-009",
    area: "학습 진행률",
    claim: "'오늘 6분만 더 읽으면' 은 현재 장의 예상 읽기 시간에서 이미 읽은 시간을 뺀 값이다. 장 완료는 본문 끝까지 스크롤하거나 '다 읽었어요'를 누를 때 기록한다.",
    evidence: "3장 읽는 시간 6분 + 사이드바 'ETF 입문 3/7 · 6분'(화면 02, 04)",
    confidence: "중간",
    alternative: "남은 장 전체 시간 합",
    screens: ["/app"],
  },
  {
    id: "INF-010",
    area: "레이아웃",
    claim: "AI 패널을 열면 화면 폭이 1600px 미만일 때 왼쪽 메뉴를 아이콘 모드로 접는다.",
    evidence: "AI 패널이 열린 화면(03, 06)은 모두 메뉴가 접혀 있음",
    confidence: "낮음",
    alternative: "페이지별로 고정된 메뉴 상태",
    screens: ["/app"],
  },
  {
    id: "INF-011",
    area: "Agent 브리핑",
    claim: "'Agent 브리핑 4건' 은 지수 급등락, 환율 변동, 관심 종목 움직임, 학습 알림을 규칙으로 모은 목록이다.",
    evidence: "대시보드 우상단 배지 수(화면 02)",
    confidence: "낮음",
    alternative: "서버 배치 작업이 만든 알림 큐",
    screens: ["/app/dashboard"],
  },
  {
    id: "INF-012",
    area: "Agent 연동",
    claim: "P02·P04 Agent 결과는 앱이 다시 계산하지 않고, Agent가 저장한 가장 최근 실행 폴더(p02_out·p04_out/<시각>/<종목>)의 result.json·페르소나 보고서를 읽어 그대로 보여 준다. 사업부 분기표는 주장 문장(axis·businessId·horizon)의 숫자를 모아 다시 짠다. 폴더가 설정되지 않으면 노트북 출력에서 뽑은 스냅샷을 쓴다.",
    evidence: "노트북 [11-1]·[13-1] 저장 파일 목록, PC result.json 최상위 키, 보고서의 SUMMARY·LOCKED 구역 표시",
    confidence: "중간",
    alternative: "Agent를 Python 서버로 상시 띄우고 API로 호출",
    screens: ["/app/company"],
  },
  {
    id: "INF-013",
    area: "사업 질의",
    claim: "사업 질의는 P02 ask()처럼 공시 사업 단위 이름에서만 찾는다. 없으면(예: HBM) 상위 사업 매출로 대신 답하지 않고 TARGET_NOT_DISCLOSED 보류를 돌려준다.",
    evidence: "노트북 [10-5] 출력: 005930 \"HBM\" 없음 | TARGET_NOT_DISCLOSED",
    confidence: "중간",
    alternative: "Python Agent의 ask()를 직접 호출",
    screens: ["/app/company"],
  },
  {
    id: "INF-014",
    area: "기업 목록",
    claim: "기업 분석 대상 50개는 2026년 기준 코스피 시가총액 상위권을 추정해 고른 목록이다. 순위는 매일 바뀌므로 실제 순위와 다를 수 있다. 업종 이름도 앱이 붙였다.",
    evidence: "공개 시가총액 순위에 대한 일반 지식(실시간 확인 아님)",
    confidence: "중간",
    alternative: "KRX 시가총액 순위를 매일 받아 목록을 다시 만든다",
    screens: ["/app/company"],
  },
  {
    id: "INF-015",
    area: "OpenDART 연동",
    claim: "공시 목록·기업개황·주요 재무는 OpenDART API를 요청할 때 불러온다. 공시는 5분, 기업개황·재무는 6시간, 고유번호 목록은 7일 동안 캐시한다. 재무는 가장 최근 사업보고서(3개년)와 그 뒤 가장 최근 분·반기 보고서를 쓰고, 영업이익률·부채비율은 공시 숫자로 앱이 계산한다.",
    evidence: "OpenDART 개발가이드(list.json, company.json, fnlttSinglAcnt.json, corpCode.xml)와 하루 2만 건 요청 한도",
    confidence: "중간",
    alternative: "Agent(P02)가 DART를 대신 수집해 결과 파일로 저장",
    screens: ["/app/company", "/app/ask"],
  },
  {
    id: "INF-016",
    area: "챗봇 공시 답변",
    claim: "질문에 50개 기업 중 하나와 공시·재무 단어가 있으면 참고서 검색보다 OpenDART 조회를 먼저 한다. P02 사업 단위 질문(HBM·DS 등)은 INF-013 규칙이 먼저다.",
    evidence: "화면 05의 단계 표시(검색 → 조회 → 정리)를 기업 공시로 넓힘",
    confidence: "낮음",
    alternative: "LLM이 질문 의도를 분류",
    screens: ["/app/ask"],
  },
  {
    id: "INF-017",
    area: "챗봇 Agent 답변",
    claim: "질문에 기업 하나와 P02·P04·부문·사업부·보류 같은 말이 있으면 저장된 Agent 결과에서 바로 답하고, 출처(실행 폴더)·검증 전·보류 이유를 붙인다. 공시 표 항목이 이자수익·순이자손익인 기업은 매출이라고 부르지 않는다.",
    evidence: "P02 result.json 의 revenueItem, publication_eligible=false, publicationBlockers",
    confidence: "중간",
    alternative: "LLM이 Agent 결과를 읽고 자유롭게 답변",
    screens: ["/app/ask", "/app/company"],
  },
];

export const inferenceHeader = (...ids: string[]) => ({ "X-Rea-Inferred": ids.join(",") });
