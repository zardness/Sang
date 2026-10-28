# Neon 실데이터 → 두 Agent 연결 안내

## 설치·실행

zip을 `OpenResearch_QualityAgents` 폴더에 그대로 풀면 새 파일만 추가됩니다(기존 파일은 바꾸지 않음).

    python -m pip install -r requirements-neon-agents.txt
    python -m jupyterlab

- `notebooks/Neon_산업사업모델_Agent.ipynb` : 산업·사업모델 Agent
- `notebooks/Neon_기술적분석_Agent.ipynb` : 기술적 분석 Agent

두 노트북은 따로 실행합니다. 위에서부터 차례로 실행하면 됩니다.

## 흐름

    Neon 조회(neon_source) → 입력 형식 자동 변환(neon_report) → 품질 검사(assess_report + neon_quality) → Agent 실행

| 파일 | 하는 일 |
|---|---|
| agent/neon_source.py | `.env` 다시 읽기(override=True), `-pooler` 주소를 직접 연결 주소로 변경, 접속 후 `SET`으로 읽기 전용·15초 제한. core/rag 열을 조회해 있는 열만 읽음 |
| agent/neon_report.py | 시세 → E03, 분기재무 → E01, 공시 → E2xx, rag 문서 → E1xx 근거로 변환. 전년 동기 증감률·영업이익률·SMA 계산. digest 봉인 |
| agent/neon_quality.py | DB 원자료 검사: 결측·중복·OHLC 모순·±30% 초과 급변·거래량 0·최신성·재무 중복값·문서 본문/URL/미래 공개 |
| agent/neon_pipeline.py | 위 세 단계를 `prepare()` 한 번으로 |
| agent/neon_industry.py | 산업·사업모델 Agent 실행 (`run_checked` 사용 → 보류면 실행 안 함) |
| agent/neon_technical.py | 기술적 분석 Agent 실행 + 추가 지표(MA5/20/60/120, RSI14, 20·60일 수익률, 연환산 변동성, 1년 MDD, 거래량 배수, 20일 고저) |
| tests/test_neon_agents.py | DB 없이 변환·검사·실행 확인 (`python -m pytest tests/test_neon_agents.py`) |

## 꼭 정할 값

- `PRICE_ADJUSTMENT` (기술 노트북): `core.price_daily`가 원주가면 `"unadjusted"`, 수정주가면 `"split_adjusted"`.
  기본값은 `"unadjusted"`입니다. 데이터 담당에게 확인하세요. `None`이면 기술 Agent는 보류됩니다.
  원자료 검사에서 `raw:price_limit`이 걸리면(하루 ±30% 초과) 분할·병합이 조정되지 않았을 가능성이 큽니다.
- `EXPECTED_ROLE`: 기본 `None`(역할 확인 생략). `agent_reader`를 만들면 그 이름으로 바꾸세요.
- `END`, `REF`: 기본은 오늘(KST). 과거 시점으로 다시 돌릴 때는 날짜로 고정하세요.

## 판정 의미

- 실행 가능: 현재 규칙 통과 (사실 검증·투자 판단 아님)
- 일부 가능: 한계를 결과에 남기고 실행
- 보류: Agent 계산·LLM 실행 없이 사유만 반환

## DB 열 이름이 다를 때

- 재무 지표 이름을 인식하지 못하면 `agent/neon_report.py`의 `METRIC_ALIASES`에 DB의 metric 값을 추가하세요.
- `rag.document`에 본문 열(content, chunk_text, text, body, page_content, summary)이 없으면,
  `document_id`와 본문 열을 가진 rag 안의 다른 테이블에서 첫 조각을 찾습니다. 그래도 없으면 제목만 씁니다.
- 노트북 1단계의 열 표를 보면 실제 이름을 확인할 수 있습니다.

## 검증 범위

로컬 PostgreSQL에 같은 이름의 core/rag 테이블을 만든 가짜 데이터로 두 노트북을 끝까지 실행했고,
오프라인 테스트 6개가 통과했습니다. 실제 Neon에는 접속하지 않았습니다(접속 정보를 받지 않음).
첫 실행에서 오류나 이상한 표가 나오면 1단계 열 표와 함께 알려 주세요.
