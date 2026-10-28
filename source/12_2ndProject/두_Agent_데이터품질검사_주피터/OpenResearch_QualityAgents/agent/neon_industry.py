"""산업·사업모델 Agent를 Neon 입력으로 실행. 품질 게이트가 보류면 계산·LLM을 부르지 않는다."""
import json

from agent.basic_agents import AgentSettings, IndustryBusinessAgent
from agent.quality_gate import run_checked

DOMAIN = 'industry_business_model'


def run(prepared, *, llm=None, settings=None, model_tool=None):
    settings = settings or AgentSettings(window=prepared.gates[DOMAIN]['window'])
    agent = IndustryBusinessAgent(llm, settings, model_tool)
    result = run_checked(agent, prepared.report, prepared.gates[DOMAIN])
    result['limitations'] = list(dict.fromkeys(result['limitations'] + prepared.report['limitations'][DOMAIN]))
    return result


def financial_frame(prepared):
    """E01(분기 재무)을 분기 × 지표 표로. 노트북 확인용."""
    import pandas as pd
    e = next((x for x in prepared.report['evidence'] if x['evidenceId'] == 'E01'), None)
    if e is None:
        return pd.DataFrame()
    rows = pd.DataFrame(json.loads(e['excerpt']))
    return rows.pivot_table(index='periodEnd', columns='metric', values='amount', aggfunc='first')


def source_frame(result):
    """결과 근거 목록(공시·문서 발췌 앞부분)."""
    import pandas as pd
    return pd.DataFrame([{'근거': e['evidenceId'], '종류': e['location'].get('type'),
                          '기간': e.get('observationPeriod'), '발췌': e['excerpt'][:120]}
                         for e in result['evidence']])
