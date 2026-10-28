# kic-agent: KIC AI Agent 기본 소스

수집 파이프라인(`kic-agent-data`)이 채운 Neon DB를 읽어서 보고서를 만드는 Agent입니다. 보고서는 세 가지입니다.

- ② Peer 비교 보고서
- ③ 리스크 심사 의견서
- ① 신규 공시 브리핑

같은 결과를 **전문가 모드**(간결한 결과)나 **가이드 모드**(지표 풀이, "왜 이 Peer인가", 다음에 확인해 볼 것)로 출력합니다.

> 핵심 원칙: 숫자는 LLM이 만들지 않습니다.
> 1. 도구가 DB에서 읽은 값은 증거 장부에 `[E1]`, `[E2]` … ID로 등록됩니다.
> 2. 본문은 이 ID를 인용해야 합니다.
> 3. Verifier는 문장의 숫자가 인용한 값과 같은지 확인합니다. 틀리면 피드백을 붙여 다시 쓰게 하고, 끝까지 틀리면 검증된 템플릿 본문으로 대체합니다.

## 구조

```
kic-agent/
├── app.py                  Streamlit 데모 (대화 입력 + 보고서 + 근거 패널)
├── kic_agent/
│   ├── agent.py            Planner → Executor → Writer → Verifier, peer_report / risk_review / monitor / ask
│   ├── tools/
│   │   ├── data.py         DB 도구: 종목 찾기, Peer, 밸류에이션, 재무 TTM, 공시, 5개 관점 지표, RAG 검색, Text-to-SQL
│   │   ├── risk.py         건전성 등급(규칙 기준선 + 분류 모델 연결부) · 체크리스트
│   │   └── sql_guard.py    SELECT만, core·rag 스키마만, LIMIT 자동
│   ├── evidence.py         증거 장부와 단위 표기(조·억 원, USD, %, 배)
│   ├── verifier.py         수치·인용 검증
│   ├── modes.py            전문가 / 가이드 프롬프트와 가이드 부록
│   ├── glossary.py         용어 DB (data/glossary.csv 로 교체)
│   ├── report.py           Markdown · Excel 내보내기
│   ├── llm.py              Anthropic API 연결 (키 없으면 템플릿 모드)
│   ├── tts.py              음성 브리핑 (edge-tts)
│   ├── doctor.py           실제 DB 구조와 코드 기대값 비교
│   ├── config.py           컬럼·metric 매핑, 리스크 기준값
│   └── cli.py              명령줄 실행
└── tests/                  DB·LLM 없이 도는 테스트 (가짜 DB)
```

## 시작하기

```bash
pip install -r requirements.txt
cp .env.example .env        # DATABASE_URL 등 채우기

python -m unittest discover -s tests -t . -v     # 1) DB 없이 테스트 (15개)
python -m kic_agent.cli doctor                   # 2) 실제 DB와 컬럼 이름 맞추기
python -m kic_agent.cli peer 005930 --mode guide --excel out/peer.xlsx
python -m kic_agent.cli risk 삼성전자 --out out/risk.md
python -m kic_agent.cli monitor --hours 24
python -m kic_agent.cli ask "SK하이닉스 최근 4개 분기 영업이익률 추이는?"   # LLM 키 필요
streamlit run app.py
```

### 처음 연결할 때 꼭 할 일: `doctor`

이 코드는 DB 구조도(스키마 4개, 테이블 22개, 뷰 3개)를 보고 작성했습니다. 그런데 아래 두 가지는 실제 이름을 모르고 추정한 값입니다.

- 뷰 `core.v_valuation`의 컬럼명: `per`, `pbr`, `op_margin`, `roe`, `debt_ratio`, `market_cap`
- `core.financial_quarter.metric` 값: `revenue`, `operating_income`, `interest_expense`, `capital_stock` 등

`doctor`를 실행하면 맞지 않는 곳과 실제 이름을 보여 줍니다. `kic_agent/config.py`의 `VALUATION_COLUMNS`와 `FINANCIAL_METRICS`에서 **왼쪽 키(또는 `metric` 값)만** 실제 이름으로 고치면 됩니다.

### 읽기 전용 DB 계정 (권장)

Agent 연결은 세션 단위로 읽기 전용입니다. SQL 가드도 `ops`, `raw` 스키마를 막습니다. 다만 가장 확실한 방법은 권한 자체를 나누는 것입니다.

```sql
CREATE ROLE agent_reader LOGIN PASSWORD '...';
GRANT USAGE ON SCHEMA core, rag TO agent_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA core, rag TO agent_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA core, rag GRANT SELECT ON TABLES TO agent_reader;
```

## 다음 작업 (역할별)

| 역할 | 할 일 | 손댈 곳 |
|---|---|---|
| 데이터 | `rag.chunk` 임베딩 적재. 1024차원이므로 bge-m3 같은 다국어 모델이 맞습니다 | `tools/data.py` `search_documents(query_embedding=...)` |
| 데이터 | 감사의견 적재 (DART 정기보고서 주요정보) | `tools/risk.py`의 감사의견 항목 |
| 모델 | 건전성 3등급 분류 모델 학습 → `models/health_model.joblib` 저장. 형식은 `{"model", "features", "classes"}` | `tools/risk.py` `predict_with_model` |
| 모델 | 공시 리스크 유형 분류, 감성 FinBERT 교체 | `config.RISK_EVENT_TYPES`, 파생 테이블 |
| 모델 | 차기 영업이익·적정 멀티플 회귀 → 결과를 보고서 "실적 전망 참고치" 섹션에 증거로 등록 | `agent.peer_report`에 도구 추가 |
| Agent | 테스트 질문 30개 + 정답 수치로 Text-to-SQL 정확도와 검증 통과율 측정 | `tests/`에 평가 스크립트 |
| Agent | 보고서 PDF 출력, 브리핑 원고를 LLM으로 다듬기 | `report.py`, `agent.monitor` |
| 기획·화면 | 출처가 있는 용어 정의로 교체 (`term,definition,source`) | `data/glossary.csv` |
| 기획·화면 | 데모 화면 다듬기, 시나리오 4개 리허설 | `app.py` |

## 검증 규칙 요약

- 숫자가 있는 문장은 `[E#]`를 하나 이상 인용해야 합니다.
- 숫자는 인용한 값과 반올림 오차 안에서 같아야 합니다. 이때 단위 변환을 허용합니다: 원 → 조·억, 비율 → %, USD → B·M.
- 다음 숫자는 검사에서 제외합니다: 연도, 날짜, 분기, 개수(5개, 3건 등), 목록 번호, 인용한 문서 제목 속 숫자.
- 표(비교표, 체크리스트, 근거)는 LLM이 아니라 시스템이 증거에서 직접 만듭니다.

※ 이 프로그램의 결과는 투자 검토 참고 자료이며 매수·매도 추천이 아닙니다.
