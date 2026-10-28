"""Neon 원자료 묶음 → 두 Agent 공통 입력(report/evidence 계약) 자동 변환.

숫자는 DB 값과 코드 계산만 쓴다. 사업모델 해석 주장은 원문 검수 전이므로 withheld로 만든다.
기술 Agent와 품질 게이트가 시세 근거를 'E03'으로 찾으므로 그 ID를 고정한다.
"""
import hashlib
import json
import math

from agent.data_inventory import REQUIRED_MATERIALS
from agent.research_contract import seal_report

PRICE_EVIDENCE_ID = 'E03'
ADJUSTMENTS = {'unadjusted', 'split_adjusted', 'total_return'}
METRIC_ALIASES = {
    'revenue': {'revenue', 'sales', '매출액', '매출', '영업수익', '수익(매출액)'},
    'operating_income': {'operating_income', 'operating_profit', 'op_income', '영업이익', '영업이익(손실)'},
    'net_income': {'net_income', 'profit', '당기순이익', '당기순이익(손실)', '분기순이익'},
}
LABELS = {'revenue': '매출', 'operating_income': '영업이익', 'net_income': '순이익'}


def _sha(obj):
    return hashlib.sha256(json.dumps(obj, ensure_ascii=False, sort_keys=True, allow_nan=False).encode()).hexdigest()


def _clean(value):
    """digest 계산이 NaN·numpy 값을 거부하므로 순수 JSON 값으로 바꾼다."""
    if value is None:
        return None
    if hasattr(value, 'item'):
        value = value.item()
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def _kst(day, end_of_day=False):
    return f'{str(day)[:10]}T{"23:59:59" if end_of_day else "00:00:00"}+09:00'


def _key(metric):
    m = str(metric).strip().lower().replace(' ', '')
    return next((k for k, names in METRIC_ALIASES.items() if m in {n.replace(' ', '') for n in names}), None)


def price_observations(prices, limit):
    rows = []
    if prices is None or prices.empty:
        return rows
    for r in prices.sort_values('_date').tail(limit).to_dict('records'):
        rows.append({'day': str(r['_date'])[:10],
                     **{k: _clean(r.get(k)) for k in ('open', 'high', 'low', 'close', 'volume')}})
    return rows


def financial_table(fin, quarters=8):
    """period_end × metric 표(중복은 첫 값 유지). 최근 quarters개 분기만."""
    if fin is None or fin.empty:
        return []
    df = fin.dropna(subset=['_date']).drop_duplicates(['_date', 'metric'], keep='first')
    periods = sorted(df['_date'].astype(str).unique())[-(quarters + 4):]  # 전년 동기용 4분기 여유
    df = df[df['_date'].astype(str).isin(periods)]
    unit = 'unit' if 'unit' in df.columns else None
    return [{'periodEnd': str(r['_date'])[:10], 'metric': str(r['metric']), 'amount': _clean(r['amount']),
             **({'unit': _clean(r[unit])} if unit else {})}
            for r in df.sort_values(['_date', 'metric']).to_dict('records')]


def financial_calculations(table, evidence_id):
    """최근 분기의 전년 동기 대비 증감률과 영업이익률. 입력이 없거나 0·음수 기준이면 계산하지 않는다."""
    calcs, notes = [], []
    if not table:
        return calcs, notes
    by = {(r['periodEnd'], r['metric']): r['amount'] for r in table}
    latest = max(r['periodEnd'] for r in table)
    prior = f'{int(latest[:4]) - 1}{latest[4:]}'
    metrics = list(dict.fromkeys(r['metric'] for r in table if r['periodEnd'] == latest))
    known = {}
    for metric in metrics:
        key = _key(metric)
        if key and key not in known:
            known[key] = metric
        cur, old = by.get((latest, metric)), by.get((prior, metric))
        if cur is None or old is None:
            notes.append(f'{metric}: 전년 동기({prior}) 값 없음 → 증감률 계산 보류')
            continue
        if old <= 0:
            notes.append(f'{metric}: 전년 동기 값이 0 이하 → 증감률 대신 원값만 사용')
            continue
        calcs.append({'calculationId': f'CAL_FIN_YOY_{len(calcs) + 1:02d}', 'method': 'yoy_change',
                      'methodVersion': 'neon-fin-1', 'formula': f'({metric}[{latest}] / {metric}[{prior}] - 1) * 100',
                      'inputEvidenceIds': [evidence_id], 'inputs': [old, cur], 'metric': metric,
                      'metricKey': key, 'unit': 'percent', 'result': round((cur / old - 1) * 100, 2)})
    rev, op = known.get('revenue'), known.get('operating_income')
    if rev and op and by.get((latest, rev)):
        r, o = by[(latest, rev)], by.get((latest, op))
        if o is not None and r > 0:
            calcs.append({'calculationId': 'CAL_FIN_OPM', 'method': 'operating_margin', 'methodVersion': 'neon-fin-1',
                          'formula': f'{op}[{latest}] / {rev}[{latest}] * 100', 'inputEvidenceIds': [evidence_id],
                          'inputs': [o, r], 'metric': 'operating_margin', 'metricKey': 'operating_margin',
                          'unit': 'percent', 'result': round(o / r * 100, 2)})
    if not known:
        notes.append('매출·영업이익 지표명을 인식하지 못함: METRIC_ALIASES에 DB의 metric 이름을 추가하세요.')
    return calcs, notes


def _doc(doc_id, *, path, url, published, collected, payload_sha, version):
    return {'documentId': doc_id, 'version': version, 'sha256': payload_sha, 'path': path,
            'originalUrl': url, 'dataMode': 'actual', 'publishedAt': published, 'collectedAt': collected,
            'access': 'neon_read_only', 'redistribution': '팀 내부 분석용. 원문 재배포 권한 별도 확인'}


def build_report(bundle, *, window=20, price_rows=250, as_of=None, question=None,
                 price_adjustment=None, price_source_note=None, report_id=None):
    """bundle(neon_source.fetch_bundle) → sealed report. price_adjustment는 팀이 확인한 시세 조정 기준."""
    company = bundle['company']
    ticker, name = company['ticker'], company['name']
    as_of = as_of or bundle['end']
    asof_iso = _kst(as_of, end_of_day=True)
    collected = bundle['queriedAt']
    version = 'neon-' + collected[:10]
    documents, evidence, calculations, claims = [], [], [], []
    tech_limits = [n for n in bundle.get('notes', []) if 'price_daily' in n]
    limitations = [n for n in bundle.get('notes', []) if n not in tech_limits]  # 산업 Agent 쪽 한계

    # 1) 시세 → D03/E03 (기술 Agent 입력)
    obs = price_observations(bundle.get('prices'), price_rows)
    if obs:
        payload = {'observations': obs}
        documents.append(_doc('D03', path=f'neon://core.price_daily?company_id={company["company_id"]}',
                              url=None, published=_kst(obs[-1]['day']), collected=collected,
                              payload_sha=_sha(payload), version=version))
        evidence.append({'evidenceId': PRICE_EVIDENCE_ID, 'documentId': 'D03', 'documentVersion': version,
                         'location': {'type': 'db_table', 'table': 'core.price_daily',
                                      'filter': f'company_id={company["company_id"]}',
                                      'range': f'{obs[0]["day"]}~{obs[-1]["day"]}', 'rows': len(obs)},
                         'excerpt': json.dumps(obs, ensure_ascii=False, allow_nan=False),
                         'observationPeriod': f'{obs[0]["day"]} ~ {obs[-1]["day"]} ({len(obs)}거래일)',
                         'verificationStatus': 'location_checked'})
        closes = [o['close'] for o in obs[-window:] if isinstance(o['close'], (int, float))]
        if len(obs) >= window and len(closes) == window:
            sma = round(sum(closes) / window, 4)
            last = obs[-1]['close']
            calculations.append({'calculationId': 'CAL_SMA', 'method': 'simple_moving_average', 'methodVersion': '1',
                                 'formula': f'sum(last {window} closes) / {window}',
                                 'inputEvidenceIds': [PRICE_EVIDENCE_ID], 'inputs': closes,
                                 'parameters': {'window': window}, 'priceAdjustment': price_adjustment or '미확인',
                                 'missingPolicy': 'reject', 'unit': '원', 'result': sma})
            relation = '높다' if last > sma else '낮다' if last < sma else '같다'
            claims.append({'claimId': 'C10', 'claimVersion': 1, 'domain': 'technical_analysis', 'kind': 'fact',
                           'horizon': f'{obs[-1]["day"]} 종가 기준',
                           'text': f'{name} 마지막 종가 {last:,.0f}원은 {window}거래일 단순이동평균 {sma:,.0f}원보다 {relation}.',
                           'assessment': 'provisional',
                           'evidenceLinks': [{'evidenceId': PRICE_EVIDENCE_ID, 'relation': 'supports'}],
                           'calculationIds': ['CAL_SMA'], 'assumptions': [f'시세 조정 기준: {price_adjustment or "미확인"}'],
                           'missingInformation': ['공식 거래일 달력 대조', '분할·병합 등 기업행위 대조'],
                           'nextQuestions': ['같은 신호가 과거에 얼마나 자주 실패했는가?']})

    # 2) 분기 재무 → D01/E01 + 증감률 계산
    table = financial_table(bundle.get('financials'))
    if table:
        pub_col = bundle.get('financialPublishedColumn')
        fin = bundle['financials']
        published = (str(fin[pub_col].dropna().max())[:10] if pub_col and fin[pub_col].notna().any()
                     else max(r['periodEnd'] for r in table))
        if not pub_col:
            limitations.append('재무 공개일 열이 없어 period_end를 공개일로 사용(실제 공시는 그 이후)')
        documents.append(_doc('D01', path=f'neon://core.financial_quarter?company_id={company["company_id"]}',
                              url=None, published=_kst(published), collected=collected,
                              payload_sha=_sha(table), version=version))
        evidence.append({'evidenceId': 'E01', 'documentId': 'D01', 'documentVersion': version,
                         'location': {'type': 'db_table', 'table': 'core.financial_quarter',
                                      'filter': f'company_id={company["company_id"]}', 'rows': len(table)},
                         'excerpt': json.dumps(table, ensure_ascii=False, allow_nan=False),
                         'observationPeriod': f'{table[0]["periodEnd"]} ~ {table[-1]["periodEnd"]}',
                         'verificationStatus': 'location_checked'})
        fin_calcs, notes = financial_calculations(table, 'E01')
        calculations += fin_calcs
        limitations += notes
        latest = table[-1]['periodEnd']
        parts = []
        order = ['revenue', 'operating_income', 'operating_margin', 'net_income']
        for c in sorted(fin_calcs, key=lambda c: order.index(c['metricKey']) if c['metricKey'] in order else 9):
            label = LABELS.get(c['metricKey'], c['metric'])
            parts.append(f'영업이익률 {c["result"]:.1f}%' if c['method'] == 'operating_margin'
                         else f'{label} 전년 동기 대비 {c["result"]:+.1f}%')
        if parts:
            claims.append({'claimId': 'C01', 'claimVersion': 1, 'domain': 'industry_business_model', 'kind': 'fact',
                           'horizon': f'{latest} 분기', 'text': f'{name} {latest} 분기: ' + ', '.join(parts[:4]) + '.',
                           'assessment': 'provisional', 'evidenceLinks': [{'evidenceId': 'E01', 'relation': 'supports'}],
                           'calculationIds': [c['calculationId'] for c in fin_calcs],
                           'assumptions': ['DB 분기 재무 값(연결/별도 구분은 적재 기준을 따름)'],
                           'missingInformation': ['제품·지역별 매출', '부문별 이익'],
                           'nextQuestions': ['증감의 원인이 가격·물량·제품 구성 중 무엇인가?']})

    # 3) 공시·문서 → D2xx/E2xx, D1xx/E1xx (산업 Agent 원문 근거)
    context = []
    for i, r in enumerate(bundle['disclosures'].to_dict('records') if not bundle['disclosures'].empty else []):
        did, eid = f'D2{i:02d}', f'E2{i:02d}'
        title = str(r.get('report_nm') or '공시')
        documents.append(_doc(did, path=None if r.get('url') else f'neon://core.disclosure/{r.get("rcept_no", i)}',
                              url=_clean(r.get('url')), published=_kst(r['_date']) if r.get('_date') else None,
                              collected=collected, payload_sha=_sha({k: _clean(v) for k, v in r.items()}),
                              version=str(r.get('rcept_no') or version)))
        evidence.append({'evidenceId': eid, 'documentId': did, 'documentVersion': documents[-1]['version'],
                         'location': {'type': 'disclosure', 'table': 'core.disclosure', 'reportName': title,
                                      'rceptNo': _clean(r.get('rcept_no'))},
                         'excerpt': f'[{str(r.get("_date"))[:10]}] {title}', 'observationPeriod': str(r.get('_date'))[:10],
                         'verificationStatus': 'unverified'})
        context.append(eid)
    docs = bundle['documents']
    for i, r in enumerate(docs.to_dict('records') if not docs.empty else []):
        did, eid = f'D1{i:02d}', f'E1{i:02d}'
        text = _clean(r.get('_excerpt')) or ''
        doc_key = _clean(r.get('document_id', r.get('id', i)))
        documents.append(_doc(did, path=f'neon://rag.document/{doc_key}', url=_clean(r.get('url')),
                              published=_kst(r['_date']) if r.get('_date') else None, collected=collected,
                              payload_sha=_clean(r.get('_sha256')) or _sha({k: _clean(v) for k, v in r.items()}),
                              version=str(_clean(r.get('version')) or version)))
        evidence.append({'evidenceId': eid, 'documentId': did, 'documentVersion': documents[-1]['version'],
                         'location': {'type': 'rag_document', 'source': bundle.get('documentTextSource'),
                                      'documentKey': doc_key, 'title': _clean(r.get('title')),
                                      'chars': f'0~{len(text)}' if text else None},
                         'excerpt': text.strip() or f'(본문 없음) {_clean(r.get("title")) or doc_key}',
                         'observationPeriod': str(r.get('_date'))[:10], 'verificationStatus': 'unverified'})
        context.append(eid)
    if context:
        missing = [item for domain, item, _ in REQUIRED_MATERIALS if domain == '산업·사업모델']
        claims.append({'claimId': 'C02', 'claimVersion': 1, 'domain': 'industry_business_model', 'kind': 'interpretation',
                       'horizon': '향후 4개 분기 가설',
                       'text': f'{name}의 사업모델·경쟁 구도 해석은 연결된 공시·문서 원문을 검수한 뒤 확정한다.',
                       'assessment': 'withheld',
                       'evidenceLinks': [{'evidenceId': e, 'relation': 'context'} for e in context],
                       'calculationIds': [], 'assumptions': ['자동 수집 문서의 관련성은 미검수'],
                       'missingInformation': missing,
                       'nextQuestions': ['사업보고서 사업의 내용에서 제품별 매출 비중을 확인할 수 있는가?',
                                         '같은 기간 경쟁사의 증설·생산능력 자료가 있는가?']})

    ind = [c for c in claims if c['domain'] == 'industry_business_model']
    tech = [c for c in claims if c['domain'] == 'technical_analysis']
    ref = lambda c: {'claimId': c['claimId'], 'claimVersion': c['claimVersion']}  # noqa: E731
    edges = []
    if any(c['claimId'] == 'C01' for c in ind):
        edges.append({'edgeId': 'EDGE01', 'from': 'N3', 'to': 'N5', 'claimId': 'C01', 'claimVersion': 1,
                      'status': 'evidence_linked', 'meaning': '분기 수치 관계이며 인과관계 입증 아님'})
    if any(c['claimId'] == 'C02' for c in ind):
        edges.append({'edgeId': 'EDGE02', 'from': 'N2', 'to': 'N3', 'claimId': 'C02', 'claimVersion': 1,
                      'status': 'missing_evidence', 'meaning': '제품 구성 → 매출 관계 검수 필요'})
    report = {
        'schemaVersion': '1.0', 'reportId': report_id or f'NEON-{ticker}-{str(as_of)[:10]}',
        'contentRevision': 1, 'parentDigest': None, 'dataMode': 'actual', 'status': 'partial',
        'question': question or f'{name}({ticker})의 최근 실적·사업 근거와 가격 흐름을 Neon 실데이터로 점검한다.',
        'asOf': asof_iso,
        'subject': {'name': name, 'ticker': ticker, 'market': company['market'], 'companyId': _clean(company['company_id'])},
        'source': {'database': 'neon', 'role': bundle.get('role'), 'queriedAt': collected,
                   'range': f'{bundle["start"]} ~ {bundle["end"]}', 'documentTextSource': bundle.get('documentTextSource')},
        'documents': documents, 'evidence': evidence, 'calculations': calculations, 'claims': claims,
        'map': {'nodes': [{'nodeId': n, 'label': lb} for n, lb in
                          [('N1', '고객'), ('N2', '제품·서비스'), ('N3', '매출'), ('N4', '비용'), ('N5', '이익'), ('N6', '위험')]],
                'edges': edges},
        'agentResults': [{'domain': 'industry_business_model', 'status': 'not_run', 'claims': [ref(c) for c in ind],
                          'competition': {'status': 'insufficient_data', 'score': None}},
                         {'domain': 'technical_analysis', 'status': 'not_run', 'claims': [ref(c) for c in tech]}],
        'analysisRelations': ([{'relationId': 'REL01', 'type': 'different_horizons', 'claims': [ref(ind[0]), ref(tech[0])],
                                'explanation': '분기 실적과 일별 가격 위치는 관찰 기간이 다르며 함께 성립할 수 있다.'}]
                              if ind and tech else []),
        'objections': [], 'checks': [], 'approvals': [], 'history': [],
        'limitations': {'industry_business_model': list(dict.fromkeys(limitations)),
                        'technical_analysis': tech_limits},
        'priceMetadata': ({'adjustment': price_adjustment,
                           'sourceDescription': price_source_note or f'Neon core.price_daily ({len(obs)}행)'}
                          if price_adjustment in ADJUSTMENTS else None),
    }
    return seal_report(report)


def report_summary(report):
    """노트북 표시용: 변환된 입력의 문서·근거·주장 개수."""
    return {'reportId': report['reportId'], 'asOf': report['asOf'], 'dataMode': report['dataMode'],
            'documents': len(report['documents']), 'evidence': len(report['evidence']),
            'calculations': len(report['calculations']),
            'industryClaims': sum(c['domain'] == 'industry_business_model' for c in report['claims']),
            'technicalClaims': sum(c['domain'] == 'technical_analysis' for c in report['claims']),
            'priceAdjustment': (report.get('priceMetadata') or {}).get('adjustment'),
            'digest': report['digest'][:12]}


def today_kst():
    from datetime import datetime
    from zoneinfo import ZoneInfo
    return datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat()

