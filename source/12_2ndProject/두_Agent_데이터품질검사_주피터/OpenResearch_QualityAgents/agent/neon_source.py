"""Neon 읽기 전용 조회. 두 Agent 입력으로 바꿀 원자료 묶음(bundle)을 만든다. 접속정보는 출력하지 않는다."""
import os
import re
from datetime import date, datetime, timedelta
from decimal import Decimal

from agent.data_inventory import _date_expr, _ident, _table

TEXT_COLUMNS = ['content', 'chunk_text', 'text', 'body', 'page_content', 'summary']
ORDER_COLUMNS = ['chunk_index', 'chunk_no', 'seq', 'ord', 'position', 'page']
PUBLISHED_COLUMNS = ['rcept_dt', 'disclosed_at', 'published_at', 'filed_date', 'report_date']
SKIP_TYPES = {'USER-DEFINED', 'bytea', 'ARRAY', 'tsvector'}  # 임베딩·바이너리는 가져오지 않음
BUSINESS_KEYWORDS = ['사업보고서', '반기보고서', '분기보고서', '사업의 내용']


def direct_url(url):
    """Neon 풀러 주소(-pooler)는 시작 옵션을 거부하므로 직접 연결 주소로 바꾼다."""
    return url.strip().strip('\'"').replace('-pooler.', '.')


def _redact(message, url):
    from psycopg.conninfo import conninfo_to_dict
    try:
        info = conninfo_to_dict(url)
    except Exception:  # noqa: BLE001 - 주소 해석 실패 시 전체 숨김
        return '(메시지 숨김)'
    for secret in filter(None, [info.get('password'), info.get('host'), info.get('user')]):
        message = message.replace(secret, '***')
    return re.sub(r'\d{1,3}(\.\d{1,3}){3}', '*.*.*.*', message)[:300]


def connect(env_path=None, expected_role=None, statement_timeout_ms=15000):
    """.env를 다시 읽고(override) 직접 연결 주소로 접속한 뒤, 읽기 전용·쿼리 제한을 SET으로 건다.

    expected_role을 주면 접속 역할을 확인한다. None이면 확인 없이 역할만 기록한다.
    """
    import psycopg
    from dotenv import load_dotenv
    from psycopg.rows import dict_row

    load_dotenv(env_path, override=True)
    raw = os.environ.get('DATABASE_URL', '')
    if not raw.strip():
        raise RuntimeError('DATABASE_URL 미설정: 프로젝트 .env에 Neon 주소를 넣으세요.')
    url = direct_url(raw)
    try:
        conn = psycopg.connect(url, row_factory=dict_row, autocommit=True, connect_timeout=20)
    except Exception as exc:  # noqa: BLE001 - 주소·비밀번호를 가린 원인만 보여준다
        raise RuntimeError(f'DB 연결 실패 ({type(exc).__name__}): {_redact(str(exc), url)}') from None
    conn.execute('SET default_transaction_read_only = on')
    conn.execute(f'SET statement_timeout = {int(statement_timeout_ms)}')
    role = conn.execute('SELECT current_user AS role').fetchone()['role']
    if expected_role and role != expected_role:
        conn.close()
        raise RuntimeError(f'접속 역할이 {role}입니다. expected_role({expected_role})을 확인하세요.')
    return conn


def schema(conn, schemas=('core', 'rag')):
    rows = conn.execute("""SELECT table_schema || '.' || table_name AS t, column_name AS c, data_type AS d
        FROM information_schema.columns WHERE table_schema = ANY(%s)
        ORDER BY table_schema, table_name, ordinal_position""", (list(schemas),)).fetchall()
    out = {}
    for r in rows:
        out.setdefault(r['t'], {})[r['c']] = r['d']
    return out


def _plain(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return value


def _frame(rows):
    import pandas as pd
    return pd.DataFrame([{k: _plain(v) for k, v in r.items()} for r in rows])


def _select_list(cols, exclude=()):
    return ', '.join(_ident(c) for c, d in cols.items() if d not in SKIP_TYPES and c not in exclude)


def _first(cols, names):
    return next((n for n in names if n in cols), None)


def _company(conn, ticker, market):
    rows = conn.execute('SELECT company_id, ticker, name, market FROM core.company '
                        'WHERE ticker = %s AND market = %s', (ticker, market)).fetchall()
    if not rows:
        raise LookupError(f'core.company에 {ticker}({market})가 없습니다.')
    return dict(rows[0])


def _dated(conn, cols, table, date_col, company_id, start, end, *, order='ASC', limit=None, extra_order=''):
    expr = _date_expr(date_col, cols[date_col])
    sql = (f'SELECT {_select_list(cols)}, {expr} AS _date FROM {_table(table)} '
           f'WHERE company_id = %s AND {expr} BETWEEN %s AND %s '
           f'ORDER BY {extra_order}{expr} {order}' + (f' LIMIT {int(limit)}' if limit else ''))
    return conn.execute(sql, (company_id, start, end)).fetchall()


def _documents(conn, sch, company_id, start, end, limit, chars):
    """rag.document 최신 문서. 본문 열이 없으면 rag 안의 청크 테이블에서 첫 조각을 붙인다."""
    cols = sch.get('rag.document', {})
    if not {'company_id', 'published_at'} <= cols.keys():
        return [], None
    text_col = _first(cols, TEXT_COLUMNS)
    expr = _date_expr('published_at', cols['published_at'])
    keys = [c for c in ('title',) if c in cols]
    prefer = ''
    params = [company_id, start, end]
    if keys:
        prefer = f"({_ident('title')} ILIKE ANY(%s)) DESC, "
        params.append(['%' + k + '%' for k in BUSINESS_KEYWORDS])
    extra = ''
    if text_col:
        t = _ident(text_col) + '::text'
        extra = (f", left({t}, {int(chars)}) AS _excerpt, "
                 f"encode(sha256(convert_to(coalesce({t}, ''), 'UTF8')), 'hex') AS _sha256, length({t}) AS _length")
    sql = (f'SELECT {_select_list(cols, exclude=TEXT_COLUMNS)}, {expr} AS _date{extra} FROM rag.document '
           f'WHERE company_id = %s AND {expr} BETWEEN %s AND %s '
           f'ORDER BY {prefer}{expr} DESC LIMIT {int(limit)}')
    rows = [dict(r) for r in conn.execute(sql, params).fetchall()]
    source = f'rag.document.{text_col}' if text_col else None
    if text_col or not rows:
        return rows, source
    # 본문이 별도 청크 테이블에 있는 경우: document_id + 본문 열을 가진 rag 테이블
    id_col = _first(cols, ['document_id', 'doc_id', 'id'])
    for table, ccols in sch.items():
        if not table.startswith('rag.') or table == 'rag.document':
            continue
        fk = _first(ccols, ['document_id', 'doc_id'])
        body = _first(ccols, TEXT_COLUMNS)
        if not (fk and body and id_col):
            continue
        order = _first(ccols, ORDER_COLUMNS)
        t = _ident(body) + '::text'
        chunk_sql = (f"SELECT left({t}, {int(chars)}) AS _excerpt, "
                     f"encode(sha256(convert_to(coalesce({t}, ''), 'UTF8')), 'hex') AS _sha256, length({t}) AS _length "
                     f"FROM {_table(table)} WHERE {_ident(fk)} = %s "
                     f"ORDER BY {_ident(order) if order else _ident(fk)} LIMIT 1")
        for r in rows:
            hit = conn.execute(chunk_sql, (r[id_col],)).fetchone()
            r.update(hit or {})
        return rows, f'{table}.{body}'
    return rows, None


def fetch_bundle(conn, ticker, *, start, end, market='KR', financial_years=3,
                 max_documents=15, max_disclosures=30, excerpt_chars=600):
    """한 종목의 시세·분기재무·공시·문서를 읽어 DataFrame 묶음으로 돌려준다. DB에는 쓰지 않는다."""
    start, end = date.fromisoformat(str(start)), date.fromisoformat(str(end))
    if start > end:
        raise ValueError('시작일은 종료일 이전이어야 합니다.')
    sch = schema(conn)
    company = _company(conn, ticker, market)
    cid = company['company_id']
    out = {'company': company, 'start': start.isoformat(), 'end': end.isoformat(),
           'queriedAt': datetime.now().astimezone().isoformat(timespec='seconds'),
           'role': conn.execute('SELECT current_user AS r').fetchone()['r'], 'notes': [], 'schema': {
               t: c for t, c in sch.items() if t in {'core.price_daily', 'core.financial_quarter',
                                                     'core.disclosure', 'rag.document'}}}

    cols = sch.get('core.price_daily', {})
    if {'company_id', 'trade_date'} <= cols.keys():
        out['prices'] = _frame(_dated(conn, cols, 'core.price_daily', 'trade_date', cid, start, end))
    else:
        out['prices'] = _frame([])
        out['notes'].append('core.price_daily 스키마/권한 확인 필요')

    cols = sch.get('core.financial_quarter', {})
    if {'company_id', 'period_end', 'metric', 'amount'} <= cols.keys():
        fstart = end - timedelta(days=366 * financial_years + 100)  # 전년 동기 비교용 여유
        out['financials'] = _frame(_dated(conn, cols, 'core.financial_quarter', 'period_end', cid, fstart, end))
        out['financialPublishedColumn'] = _first(cols, PUBLISHED_COLUMNS)
    else:
        out['financials'] = _frame([])
        out['notes'].append('core.financial_quarter 스키마/권한 확인 필요')

    cols = sch.get('core.disclosure', {})
    if {'company_id', 'rcept_dt'} <= cols.keys():
        out['disclosures'] = _frame(_dated(conn, cols, 'core.disclosure', 'rcept_dt', cid, start, end,
                                           order='DESC', limit=max_disclosures))
    else:
        out['disclosures'] = _frame([])
        out['notes'].append('core.disclosure 스키마/권한 확인 필요')

    docs, text_source = _documents(conn, sch, cid, start, end, max_documents, excerpt_chars)
    out['documents'] = _frame(docs)
    out['documentTextSource'] = text_source
    if docs and not text_source:
        out['notes'].append('rag 문서 본문 열을 찾지 못함: 제목·URL만 근거로 사용')
    return out
