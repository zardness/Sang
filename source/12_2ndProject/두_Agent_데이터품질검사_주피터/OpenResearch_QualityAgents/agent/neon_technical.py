"""기술적 분석 Agent를 Neon 입력으로 실행하고, 같은 시세(E03)로 추가 지표를 계산해 붙인다.

추가 지표도 코드 계산값이며 calculations에 함께 넣어 LLM 설명이 새 숫자를 만들지 않게 한다.
"""
import json
import math

from agent.basic_agents import AgentSettings, TechnicalAnalysisAgent
from agent.neon_report import PRICE_EVIDENCE_ID
from agent.quality_gate import run_checked

DOMAIN = 'technical_analysis'


def price_frame(report):
    import pandas as pd
    e = next((x for x in report['evidence'] if x['evidenceId'] == PRICE_EVIDENCE_ID), None)
    if e is None:
        return pd.DataFrame()
    df = pd.DataFrame(json.loads(e['excerpt']))
    df['day'] = pd.to_datetime(df['day'])
    return df.set_index('day').sort_index()


def _rsi(close, n=14):
    diff = close.diff()
    up = diff.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    down = (-diff.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    return 100 - 100 / (1 + up / down)


def indicators(df):
    """(이름, 값, 단위, 식, 필요 관측 수). 관측이 모자라면 그 지표는 빼고 사유를 남긴다."""
    close, n = df['close'].astype(float), len(df)
    rows, skipped = [], []

    def add(name, need, unit, formula, fn):
        if n < need:
            skipped.append(f'{name}: 관측 {n}개 < 필요 {need}개')
            return
        value = float(fn())
        if math.isfinite(value):
            rows.append((name, round(value, 4), unit, formula, need))

    for w in (5, 20, 60, 120):
        add(f'MA{w}', w, '원', f'mean(last {w} closes)', lambda w=w: close.tail(w).mean())
        add(f'CLOSE_VS_MA{w}', w, 'percent', f'(close / MA{w} - 1) * 100',
            lambda w=w: (close.iloc[-1] / close.tail(w).mean() - 1) * 100)
    add('RSI14', 15, 'index', 'Wilder RSI(14)', lambda: _rsi(close).iloc[-1])
    for w in (20, 60):
        add(f'RETURN_{w}D', w + 1, 'percent', f'(close / close[-{w}] - 1) * 100',
            lambda w=w: (close.iloc[-1] / close.iloc[-1 - w] - 1) * 100)
    add('VOLATILITY_20D_ANNUAL', 21, 'percent', 'std(20 daily returns) * sqrt(252) * 100',
        lambda: close.pct_change().tail(20).std() * math.sqrt(252) * 100)
    tail = close.tail(252)
    add('MDD_1Y', 2, 'percent', 'min(close / cummax(close) - 1) * 100 over last 252',
        lambda: (tail / tail.cummax() - 1).min() * 100)
    if 'volume' in df:
        vol = df['volume'].astype(float)
        add('VOLUME_VS_20D', 21, 'ratio', 'volume / mean(previous 20 volumes)',
            lambda: vol.iloc[-1] / vol.iloc[-21:-1].mean())
    if {'high', 'low'} <= set(df.columns):
        add('HIGH_20D', 20, '원', 'max(last 20 highs)', lambda: df['high'].tail(20).max())
        add('LOW_20D', 20, '원', 'min(last 20 lows)', lambda: df['low'].tail(20).min())
    return rows, skipped


def trend_phase(values):
    """MA 배열로 단순 국면 분류. 규칙 기반이며 예측이 아니다."""
    ma = {k: v for k, v, *_ in values}
    if not {'MA20', 'MA60', 'CLOSE_VS_MA20'} <= ma.keys():
        return None
    above20, up = ma['CLOSE_VS_MA20'] > 0, ma['MA20'] > ma['MA60']
    if above20 and up:
        return '상승추세(종가 > MA20 > MA60)'
    if not above20 and not up:
        return '하락추세(종가 < MA20 < MA60)'
    return '혼조(이동평균 배열과 종가 위치가 엇갈림)'


def run(prepared, *, llm=None, settings=None, model_tool=None, extra=True):
    gate = prepared.gates[DOMAIN]
    settings = settings or AgentSettings(window=gate['window'])
    agent = TechnicalAnalysisAgent(llm, settings, model_tool)
    if extra and gate['status'] != 'withheld':
        # 추가 지표를 먼저 계산해 Agent 결과 calculations에 넣은 뒤 LLM 설명이 함께 보도록 한다.
        values, skipped = indicators(price_frame(prepared.report))
        agent = _WithExtras(agent, values, skipped, trend_phase(values))
    result = run_checked(agent, prepared.report, gate)
    result['limitations'] = list(dict.fromkeys(result['limitations'] + prepared.report['limitations'][DOMAIN]))
    return result


class _WithExtras(TechnicalAnalysisAgent):
    """기본 Agent 계산 뒤, 설명(LLM) 전에 추가 지표를 끼워 넣는다."""

    def __init__(self, base, values, skipped, phase):
        super().__init__(base.llm, base.settings, base.model_tool)
        self._values, self._skipped, self._phase = values, skipped, phase

    def run(self, report, *, price_evidence_id=PRICE_EVIDENCE_ID, price_metadata=None):
        llm, self.llm = self.llm, None  # 1차: 계산만
        model_tool, self.model_tool = self.model_tool, None
        try:
            result = super().run(report, price_evidence_id=price_evidence_id, price_metadata=price_metadata)
        finally:
            self.llm, self.model_tool = llm, model_tool
        if result['status'] == 'withheld':
            return result
        result['limitations'] = [x for x in result['limitations'] if x != 'LLM 미설정: Python 분석만 반환합니다.']
        result['calculations'] += [
            {'calculationId': 'TECH_EXT_' + name, 'result': value, 'unit': unit, 'formula': formula,
             'inputs': None, 'methodVersion': 'neon-ext-1', 'inputEvidenceIds': [price_evidence_id], 'window': need}
            for name, value, unit, formula, need in self._values]
        if self._phase:
            result['trendPhase'] = self._phase
        result['limitations'] += self._skipped
        from agent.basic_agents import _finish
        return _finish(result, self.llm, self.settings, self.model_tool)


def indicator_frame(result):
    import pandas as pd
    return pd.DataFrame([{'지표': c['calculationId'].replace('TECH_EXT_', '').replace('TECH_', ''),
                          '값': c['result'], '단위': c['unit'], '식': c['formula']} for c in result['calculations']])
