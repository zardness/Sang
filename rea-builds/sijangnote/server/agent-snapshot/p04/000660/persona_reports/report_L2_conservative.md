# SK하이닉스(000660) — 기술적 분석 L2 초급 설명



- 보고서: P04-000660-2026-11-03-f11fa9d7 / 분석 기준일: 2026-11-03 / 자료 모드: LIVE / 상태: observation_only

- 기준일은 자료의 관측 범위입니다. 실시간 갱신이나 최신성 보증으로 읽지 않습니다.

- 설명 규칙: p04-persona-2.0 / 성향: 보수형(안정형) 검토 순서



관측 지표와 예측 범위·확률을 함께 봅니다. 기간 변동성과 연율 변동성, 범위와 한 점을 구분하세요.

보류·하락 위험부터 읽은 뒤, 같은 관측 결과를 확인합니다. 추가 위험 수치를 만들지 않습니다.



## 이 결과가 다루는 범위

- 대상: SK하이닉스(000660) · 실제 시세 · 기준일 2026-11-03
- 항목 8칸: 확보 2칸, 보류 6칸
- 값이 없는 칸은 비워 두지 않고 상태(보류·미실행)와 사유를 범위 표에 남겼습니다.
- 값을 내지 않은 항목: RV5 과거 평가, RV5 최신 예측, RV20 과거 평가, RV20 최신 예측, D5_5 확률, D20_10 확률

<!-- LOCKED:CRITICAL:BEGIN -->
## 꼭 알아야 할 보류

1. **문제**: 과거 평가 조건 미충족(계약·이력)(과거 평가)
   - **제한되는 해석**: 모델 과거 평가와 예측을 모두 내지 않습니다. 관측 지표(과거 사실)만 "미확인" 표시와 함께 보여 줍니다.
   - **해결 방법**: 2단계 계약 감사의 평가 차단 항목 해결
   - 보류 ID: H-000660-a5e6b39e
<!-- LOCKED:CRITICAL:END -->

<!-- SUMMARY:BEGIN -->
## 요약

**핵심 지표 4가지**
- 최근 1년 최대낙폭은 -58.1%였습니다.
- 지난 20거래일 실현변동성은 25.27%입니다.
- 최근 60거래일 동안 기준(점수 절댓값 4.0 이상)을 넘은 이상징후 후보는 없습니다.
- 이동평균 배열 규칙으로 보면 현재 하락추세(종가 &lt; MA20 &lt; MA60)이며, 종가는 20일선 대비 -1.5%입니다.

**보류·미확인 안내(항상 표시)**
- 위 관측 지표는 계산했지만 자료 계약 중 미확인 항목이 있습니다: 시세 조정 기준·근거 미확인, 거래 상태 미확인, 공식 거래일 달력 미확인, 이용 가능 시각·수정 버전 결측 등. 확인 전에는 예측값을 내지 않습니다.
- 5거래일 변동성은 과거 평가와 예측 모두 보류했습니다 (시세 조정 기준·근거 미확인, 거래 상태 미확인, 공식 거래일 달력 미확인).
- 20거래일 변동성은 과거 평가와 예측 모두 보류했습니다 (시세 조정 기준·근거 미확인, 거래 상태 미확인, 공식 거래일 달력 미확인).
- D5_5 하락 사건 추정은 보류했습니다(시세 조정 기준·근거 미확인, 거래 상태 미확인, 공식 거래일 달력 미확인).
- D20_10 하락 사건 추정은 보류했습니다(시세 조정 기준·근거 미확인, 거래 상태 미확인, 공식 거래일 달력 미확인).

**처음 나오는 용어**
- 실현변동성(RV): 정해진 기간 동안 하루하루 수익률(로그)을 제곱해 더한 값입니다.
- 이상징후 점수: 최근 120거래일의 중앙값·중앙절대편차(MAD)에 비해 오늘 값이 얼마나 드문지입니다.
<!-- SUMMARY:END -->

## 읽는 순서

- 관측 지표 4가지 확인

- 예측은 범위로 읽기

- 과거 평가 포함률과 보류 확인





## 확인할 질문

- 예측 범위가 과거 평가에서 실제로 얼마나 맞았나요?

- 이 숫자가 관측(과거)인지 예측(범위·확률)인지 구분했나요?

- 보류된 내용을 결론에 넣지 않았나요?



<details>

<summary>상세: 전체 주장·전체 보류·근거·산식 펼치기</summary>



<!-- LOCKED:HOLDS:BEGIN -->
## 모든 보류·제한 — 모든 수준에서 동일하게 제공

- 보류 등록부: 전체 7건 / 활성 7건 / 차단 7건 / 사람 검토 0건
- H-000660-cca6feb7 [ADJUSTMENT_UNVERIFIED] 시세 조정 기준·근거 미확인: metadata.json의 price_basis·adjustment_verified·근거 (범위 snapshot:evaluation, 차단=True, 검토=미검토)
- H-000660-f0292209 [TRADING_STATUS_UNVERIFIED] 거래 상태 미확인: trading_status 열(전부 normal) 또는 metadata.json trading_status_verified·근거(거래량 0일 없음) (범위 snapshot:evaluation, 차단=True, 검토=미검토)
- H-000660-b631dd50 [CALENDAR_UNVERIFIED] 공식 거래일 달력 미확인: 공식 세션(sessions.csv)·calendar_verified·근거와 시세 날짜 일치 (범위 snapshot:evaluation, 차단=True, 검토=미검토)
- H-000660-6c78e593 [AVAILABILITY_UNVERIFIED] 이용 가능 시각·수정 버전 결측: available_at·provider_revision 열 없음 (범위 snapshot:forecast, 차단=True, 검토=미검토)
- H-000660-38862b09 [POINT_IN_TIME_UNVERIFIED] 시점별 가격·행사 수정 계보 미검증: metadata.json point_in_time_verified·근거 (범위 snapshot:forecast, 차단=True, 검토=미검토)
- H-000660-24cc7601 [RESEARCH_USAGE_UNVERIFIED] 학습·연구 이용 범위 미확인: metadata.json research_use_verified·근거 (범위 snapshot:evaluation, 차단=True, 검토=미검토)
- H-000660-a5e6b39e [EVALUATION_BLOCKED] 과거 평가 조건 미충족(계약·이력): 과거 평가 조건 미충족(ADJUSTMENT_UNVERIFIED, TRADING_STATUS_UNVERIFIED, CALENDAR_UNVERIFIED, RESEARCH_USAGE_UNVERIFIED) (범위 evaluation, 차단=True, 검토=미검토)

**내보내지 않은 주장**
- P04_RV5: EVALUATION_BLOCKED — ADJUSTMENT_UNVERIFIED, TRADING_STATUS_UNVERIFIED, CALENDAR_UNVERIFIED, RESEARCH_USAGE_UNVERIFIED (원인 보류 H-000660-a5e6b39e)
- P04_RV20: EVALUATION_BLOCKED — ADJUSTMENT_UNVERIFIED, TRADING_STATUS_UNVERIFIED, CALENDAR_UNVERIFIED, RESEARCH_USAGE_UNVERIFIED (원인 보류 H-000660-a5e6b39e)
- P04_D5_5.prob: DOWNSIDE_PROBABILITY_HELD — ADJUSTMENT_UNVERIFIED; TRADING_STATUS_UNVERIFIED; CALENDAR_UNVERIFIED; RESEARCH_USAGE_UNVERIFIED (원인 보류 H-000660-a5e6b39e)
- P04_D20_10.prob: DOWNSIDE_PROBABILITY_HELD — ADJUSTMENT_UNVERIFIED; TRADING_STATUS_UNVERIFIED; CALENDAR_UNVERIFIED; RESEARCH_USAGE_UNVERIFIED (원인 보류 H-000660-a5e6b39e)

**가정과 한계**
- 하락 사건 정의(가정): 5거래일 안 종가 최저 −5% 이하, 20거래일 안 종가 최저 −10% 이하
- as-of 정책(가정): 날짜만 주면 그날 18:00 KST를 기준시각으로 본다(종가 확정 후). available_at이 있으면 그 시각으로 걸러낸다
- DL(D1) 제외: 통계 기준선 B0~B3와 가벼운 ML(M1 Elastic Net, M2 quantile boosting)까지만
- 판정 3단계(2026-11-02 결정): 계약 미확인이어도 관측 지표는 '미확인' 표시와 함께 보여 주고, 평가·예측은 metadata.json·sessions.csv 계약이 확인될 때만
- 페르소나(2026-11-02 결정): L1~L4 × 공격형/안정형 8종은 표시 층에만 적용(숫자·게이트·보류는 같음). persona_id가 없으면 L2-CON을 기본값으로 쓴다
- 생존편향: 현재 KOSPI 200 구성종목만 대상으로 할 때 과거 편출·상폐 종목이 빠진다
- 원 분석 발행 적격: False
- 공식 승인·발행 기능을 제공하지 않는 연구 도구
- 게이트 통과는 연구 평가일 뿐, 투자 판단·운영 승인이 아님
- 페르소나 설명은 원 분석의 승인·발행 상태를 바꾸지 않습니다.
<!-- LOCKED:HOLDS:END -->

<!-- LOCKED:FACTS:BEGIN -->
## 확인된 주장 — Verifier 통과 문장과 출처

### P04_OBS_TREND
- 유형: observation / 상태: verified
이동평균 배열 규칙으로 보면 현재 하락추세(종가 &lt; MA20 &lt; MA60)이며, 종가는 20일선 대비 -1.5%입니다.
[출처: Neon core.price_daily 2026-11-03 종가]
- 근거 ID: E-000660-SNAP, E-000660-T02
- 산식 ID: K-000660-OBS_CLOSE_VS_MA20

### P04_OBS_RSI
- 유형: observation / 상태: verified
RSI(14)는 44.8입니다.
[출처: Neon core.price_daily 2026-11-03 종가]
- 근거 ID: E-000660-SNAP, E-000660-T02
- 산식 ID: K-000660-OBS_RSI14

### P04_OBS_RV20
- 유형: observation / 상태: verified
지난 20거래일 실현변동성은 25.27%입니다. (RV20 = Σr² = 0.063861)
[출처: Neon core.price_daily 2026-11-03 종가]
- 쉬운 문장: 지난 20거래일 실현변동성은 25.27%입니다.
- 근거 ID: E-000660-SNAP, E-000660-T02
- 산식 ID: K-000660-OBS_RV20_PAST_PCT, K-000660-OBS_RV20_PAST

### P04_OBS_MDD
- 유형: observation / 상태: verified
최근 1년 최대낙폭은 -58.1%였습니다.
[출처: Neon core.price_daily 2026-11-03 종가]
- 근거 ID: E-000660-SNAP, E-000660-T02
- 산식 ID: K-000660-OBS_MDD_1Y

### P04_OBS_UNVERIFIED
- 유형: limitation / 상태: verified
위 관측 지표는 계산했지만 자료 계약 중 미확인 항목이 있습니다: 시세 조정 기준·근거 미확인, 거래 상태 미확인, 공식 거래일 달력 미확인, 이용 가능 시각·수정 버전 결측 등. 확인 전에는 예측값을 내지 않습니다.
[출처: Neon core.price_daily 2026-11-03 종가]
- 근거 ID: E-000660-SNAP
- 산식 ID: 수치 없음(보류 안내)

### P04_RV5_HELD
- 유형: hold / 상태: verified
5거래일 변동성은 과거 평가와 예측 모두 보류했습니다 (시세 조정 기준·근거 미확인, 거래 상태 미확인, 공식 거래일 달력 미확인).
[출처: Neon core.price_daily 2026-11-03 종가]
- 근거 ID: E-000660-SNAP
- 산식 ID: 수치 없음(보류 안내)

### P04_RV20_HELD
- 유형: hold / 상태: verified
20거래일 변동성은 과거 평가와 예측 모두 보류했습니다 (시세 조정 기준·근거 미확인, 거래 상태 미확인, 공식 거래일 달력 미확인).
[출처: Neon core.price_daily 2026-11-03 종가]
- 근거 ID: E-000660-SNAP
- 산식 ID: 수치 없음(보류 안내)

### P04_D5_5_HELD
- 유형: hold / 상태: verified
D5_5 하락 사건 추정은 보류했습니다(시세 조정 기준·근거 미확인, 거래 상태 미확인, 공식 거래일 달력 미확인).
[출처: Neon core.price_daily 2026-11-03 종가]
- 근거 ID: E-000660-SNAP
- 산식 ID: 수치 없음(보류 안내)

### P04_D20_10_HELD
- 유형: hold / 상태: verified
D20_10 하락 사건 추정은 보류했습니다(시세 조정 기준·근거 미확인, 거래 상태 미확인, 공식 거래일 달력 미확인).
[출처: Neon core.price_daily 2026-11-03 종가]
- 근거 ID: E-000660-SNAP
- 산식 ID: 수치 없음(보류 안내)

### P04_ANOMALY
- 유형: observation / 상태: verified
최근 60거래일 동안 기준(점수 절댓값 4.0 이상)을 넘은 이상징후 후보는 없습니다.
[출처: Neon core.price_daily 2026-11-03 종가] [모델: mad-z-1]
- 근거 ID: E-000660-SNAP, E-000660-T07
- 산식 ID: K-000660-anomaly.count

<!-- LOCKED:FACTS:END -->



<!-- LOCKED:EVIDENCE:BEGIN -->
## 주장별 근거·산식 상세

### 근거 E-000660-SNAP
{"adjustment":"split_adjusted","asOf":"2026-11-03","evaluationStatus":"held","evidenceId":"E-000660-SNAP","isSynthetic":false,"period":"2021-10-22~2026-11-03","rows":1231,"sha256":"48d970d88494533f901ef11b9c130122e947b9c75f8be8491d8e534df23b8b0d","snapshotId":"000660@2026-11-03#48d970d88494","source":"Neon core.price_daily","type":"snapshot"}

### 근거 E-000660-T02
{"args":{"indicators_version":"p04-agent-1.2","snapshot_id":"000660@2026-11-03#48d970d88494"},"callId":"T02","evidenceId":"E-000660-T02","status":"ok","summary":"지표 17개, 국면=하락추세(종가 &lt; MA20 &lt; MA60)","tool":"compute_technical_observations","type":"tool_call"}

### 근거 E-000660-T07
{"args":{"as_of":"2026-11-03","detector_version":"mad-z-1","snapshot_id":"000660@2026-11-03#48d970d88494"},"callId":"T07","evidenceId":"E-000660-T07","status":"ok","summary":"후보 0건","tool":"detect_market_anomaly","type":"tool_call"}

### 산식 K-000660-OBS_CLOSE_VS_MA20
{"calculationId":"K-000660-OBS_CLOSE_VS_MA20","callId":"T02","evidenceId":"E-000660-T02","fact":"OBS_CLOSE_VS_MA20","formula":"(close / MA20 - 1) * 100","inputRange":{"from":"2026-10-06","to":"2026-11-03"},"name":"종가의 20일선 대비","recheck":"(종가/MA20−1)×100","text":"-1.5","tool":"compute_technical_observations","unit":"%","value":-1.5}

### 산식 K-000660-OBS_RSI14
{"calculationId":"K-000660-OBS_RSI14","callId":"T02","evidenceId":"E-000660-T02","fact":"OBS_RSI14","formula":"Wilder RSI(14)","inputRange":{"from":"2026-10-14","to":"2026-11-03"},"name":"RSI(14)","recheck":"Wilder RSI(14) 재귀 재계산","text":"44.8","tool":"compute_technical_observations","unit":"index","value":44.8}

### 산식 K-000660-OBS_RV20_PAST
{"calculationId":"K-000660-OBS_RV20_PAST","callId":"T02","evidenceId":"E-000660-T02","fact":"OBS_RV20_PAST","formula":"sum(ln(P_t/P_t-1)^2, last 20)","inputRange":{"from":"2026-10-02","to":"2026-11-03"},"name":"지난 20거래일 실현분산","recheck":"Σ 최근 20일 r²","text":"0.063861","tool":"compute_technical_observations","unit":"sum r²","value":0.063861}

### 산식 K-000660-OBS_RV20_PAST_PCT
{"calculationId":"K-000660-OBS_RV20_PAST_PCT","callId":"T02","evidenceId":"E-000660-T02","fact":"OBS_RV20_PAST_PCT","formula":"sqrt(RV20) * 100","inputRange":{"from":"2026-10-02","to":"2026-11-03"},"name":"지난 20거래일 실현변동성","recheck":"sqrt(Σ 최근 20일 r²)×100","text":"25.27","tool":"compute_technical_observations","unit":"%","value":25.27}

### 산식 K-000660-OBS_MDD_1Y
{"calculationId":"K-000660-OBS_MDD_1Y","callId":"T02","evidenceId":"E-000660-T02","fact":"OBS_MDD_1Y","formula":"min(close / cummax(close) - 1) * 100 over last 252","inputRange":{"from":"2025-10-23","to":"2026-11-03"},"name":"최근 1년 최대낙폭","recheck":"최근 252일 최대낙폭","text":"-58.1","tool":"compute_technical_observations","unit":"%","value":-58.1}

### 산식 K-000660-anomaly.count
{"calculationId":"K-000660-anomaly.count","callId":"T07","evidenceId":"E-000660-T07","fact":"anomaly.count","formula":"count(|robust z| ≥ 기준) (최근 구간)","inputRange":null,"name":"최근 60거래일 후보 수","recheck":"재계산 규칙 없음(도구 로그 값과 표시값 일치만 확인)","text":"0","tool":"detect_market_anomaly","unit":"건","value":0}

<!-- LOCKED:EVIDENCE:END -->



</details>



이 보고서는 교육·연구용 기술적 분석 결과이며 투자 권유가 아닙니다. 예측은 정해 둔 조건 아래의 범위·확률 추정이고 결과를 약속하지 않습니다. 투자 판단과 책임은 이용자에게 있습니다.