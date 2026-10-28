"""Neon 원자료 검사. 변환 전 DB 값 자체(중복·결측·OHLC 모순·급변·최신성)를 본다.

assess_report(보고서 계약 검사)와 합쳐 최종 게이트를 만든다. 보류가 하나라도 있으면 해당 Agent는 실행되지 않는다.
"""
from copy import deepcopy
from datetime import date

from agent.quality_gate import LABEL, LEVEL, NAMES

PRICE_LIMIT = 0.30  # 국내 가격제한폭. 넘으면 분할·병합 미조정 의심
TOLERANCE = 0.005


def _row(company, domain, rule, status, reason, observed=None):
    return {'기업': company, 'Agent': NAMES[domain], '규칙': 'raw:' + rule,
            '판정': LABEL[LEVEL[status]], '이유': reason, '관측값': observed}


def price_checks(bundle, *, window, reference_date, max_price_age_days=5):
    company, domain = bundle['company']['ticker'], 'technical_analysis'
    px = bundle.get('prices')
    out = []
    add = lambda *a: out.append(_row(company, domain, *a))  # noqa: E731
    if px is None or px.empty:
        add('price_rows', 'hold', 'Neon 시세 0건: 기간·종목·적재 여부 확인', 0)
        return out
    n = len(px)
    add('price_rows', 'pass' if n >= window else 'hold', f'지표 window {window}개 이상 필요', n)
    for col in ('close', 'volume'):
        miss = int(px[col].isna().sum()) if col in px else n
        add(f'null_{col}', 'hold' if miss else 'pass', f'{col} 결측(NULL·열 없음) 행 수', miss)
    if 'close' in px:
        bad = int((px['close'] <= 0).sum())
        add('close_positive', 'hold' if bad else 'pass', '종가 0 이하 행 수', bad)
    if 'volume' in px:
        neg, zero = int((px['volume'] < 0).sum()), int((px['volume'] == 0).sum())
        add('volume_negative', 'hold' if neg else 'pass', '거래량 음수 행 수', neg)
        add('volume_zero', 'partial' if zero else 'pass', '거래량 0(거래정지 가능) 행 수', zero)
    dup = int(px['_date'].duplicated().sum())
    add('duplicate_dates', 'hold' if dup else 'pass', '같은 날짜 중복 행 수', dup)
    if {'open', 'high', 'low', 'close'} <= set(px.columns):
        ohlc = px[['open', 'high', 'low', 'close']].dropna()
        incoherent = int(((ohlc['high'] < ohlc[['open', 'close', 'low']].max(axis=1))
                          | (ohlc['low'] > ohlc[['open', 'close']].min(axis=1))).sum())
        add('ohlc_coherent', 'partial' if incoherent else 'pass', '고가<시가·종가 또는 저가>시가·종가 행 수', incoherent)
        add('ohlc_null', 'partial' if len(ohlc) < n else 'pass', 'OHLC 일부 결측 행 수', n - len(ohlc))
    else:
        add('ohlc_null', 'partial', 'OHLC 열 일부 없음: 종가·거래량 분석만 가능')
    ret = px.sort_values('_date')['close'].pct_change().abs()
    jumps = px.loc[ret > PRICE_LIMIT + TOLERANCE, '_date'].astype(str).str[:10].tolist()
    add('price_limit', 'partial' if jumps else 'pass',
        f'하루 ±{PRICE_LIMIT:.0%} 초과 변동(분할·병합 미조정 의심) 날짜', jumps[:5] or 0)
    last = date.fromisoformat(str(px['_date'].max())[:10])
    age = (date.fromisoformat(str(reference_date)[:10]) - last).days
    add('price_age', 'hold' if age > max_price_age_days else 'pass',
        f'최근 시세 경과 달력일(허용 {max_price_age_days}일)', f'{last} ({age}일)')
    return out


def financial_checks(bundle, *, min_quarters=5):
    company, domain = bundle['company']['ticker'], 'industry_business_model'
    fin = bundle.get('financials')
    out = []
    add = lambda *a: out.append(_row(company, domain, *a))  # noqa: E731
    if fin is None or fin.empty:
        add('fin_rows', 'partial', 'core.financial_quarter 0건: 실적 수치 없이 문서 근거만 사용', 0)
        return out
    quarters = fin['_date'].dropna().astype(str).nunique()
    add('fin_quarters', 'pass' if quarters >= min_quarters else 'partial',
        f'분기 수 (전년 동기 비교에 {min_quarters}개 이상)', quarters)
    nulls = int(fin['amount'].isna().sum())
    add('fin_null', 'partial' if nulls else 'pass', 'amount 결측 행 수', nulls)
    dup = fin.groupby(['_date', 'metric'])['amount'].nunique()
    conflict = int((dup > 1).sum())
    add('fin_conflict', 'partial' if conflict else 'pass',
        '같은 분기·지표에 값이 여러 개(연결/별도 혼재 의심). 첫 값만 사용', conflict)
    return out


def document_checks(bundle, *, as_of):
    company, domain = bundle['company']['ticker'], 'industry_business_model'
    out = []
    add = lambda *a: out.append(_row(company, domain, *a))  # noqa: E731
    disc, docs = bundle.get('disclosures'), bundle.get('documents')
    n_disc = 0 if disc is None else len(disc)
    n_docs = 0 if docs is None else len(docs)
    add('doc_rows', 'pass' if n_disc + n_docs else 'hold', '공시 + 문서 근거 건수', f'공시 {n_disc} / 문서 {n_docs}')
    if n_docs:
        no_text = int(docs['_excerpt'].fillna('').str.strip().eq('').sum()) if '_excerpt' in docs else n_docs
        add('doc_text', 'partial' if no_text else 'pass', '본문 발췌가 없는 문서 수', no_text)
        no_url = int(docs['url'].isna().sum()) if 'url' in docs else n_docs
        add('doc_url', 'partial' if no_url else 'pass', '원문 URL 없는 문서 수', no_url)
    future = 0
    for frame in (disc, docs):
        if frame is not None and len(frame):
            future += int((frame['_date'].astype(str).str[:10] > str(as_of)[:10]).sum())
    add('doc_future', 'hold' if future else 'pass', '기준일 이후 공개된 공시·문서 수', future)
    return out


def raw_checks(bundle, *, window, reference_date, as_of=None, max_price_age_days=5):
    as_of = as_of or bundle['end']
    return (price_checks(bundle, window=window, reference_date=reference_date, max_price_age_days=max_price_age_days)
            + financial_checks(bundle) + document_checks(bundle, as_of=as_of))


def merge_gates(gates, raw_rows):
    """assess_report 게이트에 원자료 검사를 더한다. 가장 나쁜 판정이 Agent 상태가 된다."""
    merged = deepcopy(gates)
    rank_of = {v: k for k, v in LABEL.items()}
    for domain, gate in merged.items():
        own = [r for r in raw_rows if r['Agent'] == NAMES[domain]]
        gate['checks'] = gate['checks'] + own
        rank = max(rank_of[c['판정']] for c in gate['checks'])
        gate.update(status=['passed', 'partial', 'withheld'][rank], label=LABEL[rank],
                    reasons=list(dict.fromkeys(c['이유'] for c in gate['checks'] if c['판정'] != LABEL[0])),
                    ruleVersion=gate['ruleVersion'] + '+neon-raw-1')
    return merged
