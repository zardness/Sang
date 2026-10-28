"""DB·LLM 없이 도는 테스트: python -m unittest discover -s tests -v"""
from __future__ import annotations

import os
import sys
import tempfile
import unittest
from types import SimpleNamespace

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from kic_agent import Mode, ResearchAgent  # noqa: E402
from kic_agent.evidence import EvidenceLedger, format_value  # noqa: E402
from kic_agent.tools.sql_guard import SQLGuardError, validate_sql  # noqa: E402
from kic_agent.verifier import verify_text  # noqa: E402
from tests.fakes import FakeDB  # noqa: E402


class SQLGuardTest(unittest.TestCase):
    def test_allows_select_and_adds_limit(self):
        out = validate_sql("SELECT ticker FROM core.company", 50)
        self.assertTrue(out.endswith("LIMIT 50"))

    def test_allows_cte_join_and_extract_alias(self):
        sql = "WITH t AS (SELECT * FROM core.disclosure d WHERE extract(year from d.rcept_dt) = 2026) SELECT * FROM t JOIN core.company c ON c.company_id = t.company_id LIMIT 10"
        self.assertEqual(validate_sql(sql), sql)

    def test_blocks_writes_and_other_schemas(self):
        for bad in [
            "DELETE FROM core.company",
            "SELECT 1; DROP TABLE core.company",
            "SELECT * FROM ops.job_state",
            "SELECT * FROM raw.api_payload",
            "SELECT * FROM pg_catalog.pg_tables",
            "SELECT * FROM information_schema.tables",
            "WITH x AS (UPDATE core.company SET name='a' RETURNING *) SELECT * FROM x",
        ]:
            with self.assertRaises(SQLGuardError, msg=bad):
                validate_sql(bad)

    def test_keyword_inside_string_is_fine(self):
        validate_sql("SELECT * FROM rag.document WHERE title ILIKE '%update%'")


class VerifierTest(unittest.TestCase):
    def setUp(self):
        self.l = EvidenceLedger()
        self.cap = self.l.add("삼성전자 시가총액", 4.2e14, "원", "core.v_valuation")
        self.per = self.l.add("삼성전자 PER", 14.3, "배", "core.v_valuation")
        self.roe = self.l.add("삼성전자 ROE", 0.091, "", "sql")

    def test_display_format(self):
        self.assertEqual(format_value(4.2e14, "원"), "420.0조 원")
        self.assertEqual(self.per.display, "14.3배")

    def test_pass_with_citations_and_unit_conversion(self):
        text = f"시가총액은 420조 원 [{self.cap.id}] 이고 PER은 14.3배 [{self.per.id}] 입니다. ROE는 9.1% [{self.roe.id}] 입니다. 2026년 3분기 기준 5개 기업을 비교했습니다."
        r = verify_text(text, self.l)
        self.assertTrue(r.ok, r.feedback())

    def test_fail_uncited_and_wrong_number(self):
        r = verify_text(f"PER은 15.9배 [{self.per.id}] 입니다. 영업이익은 12조 원입니다.", self.l)
        kinds = {i.kind for i in r.issues}
        self.assertIn("unmatched_number", kinds)
        self.assertIn("uncited_number", kinds)

    def test_unknown_citation(self):
        r = verify_text("PER은 14.3배 [E99] 입니다.", self.l)
        self.assertIn("unknown_citation", {i.kind for i in r.issues})


class AgentOfflineTest(unittest.TestCase):
    def setUp(self):
        self.agent = ResearchAgent(FakeDB(), llm=None)

    def test_peer_report_expert(self):
        rep = self.agent.peer_report("005930", Mode.EXPERT)
        self.assertTrue(rep.verified, rep.verification.feedback())
        self.assertEqual(len(rep.tables["Peer 비교표"]), 3)
        self.assertIn("[E", rep.narrative)
        self.assertEqual(rep.appendix, "")

    def test_peer_report_guide_has_explanations(self):
        rep = self.agent.peer_report("삼성전자", Mode.GUIDE)
        self.assertTrue(rep.verified)
        self.assertIn("지표 풀이", rep.appendix)
        self.assertIn("왜 이 기업들과 비교하나요", rep.appendix)

    def test_us_peer_uses_usd(self):
        rep = self.agent.peer_report("005930")
        micron_cap = next(e for e in rep.ledger.numbers() if e.label == "Micron 시가총액")
        self.assertEqual(micron_cap.unit, "USD")

    def test_risk_review(self):
        rep = self.agent.risk_review("005930", Mode.EXPERT)
        self.assertTrue(rep.verified, rep.verification.feedback())
        names = [r["항목"] for r in rep.tables["리스크 체크리스트"]]
        self.assertIn("이자보상배율", names)
        self.assertIn("보통", rep.narrative)  # 전환사채 공시 → 경고 → 보통
        icr = next(e for e in rep.ledger.numbers() if e.label.endswith("이자보상배율"))
        self.assertAlmostEqual(icr.value, 50.0)

    def test_monitor_triggers_risk_review(self):
        res = self.agent.monitor(24)
        self.assertEqual(res["flagged"], ["삼성전자"])
        self.assertEqual(len(res["reviews"]), 1)
        self.assertIn("삼성전자", res["briefing"])

    def test_excel_and_markdown_export(self):
        rep = self.agent.peer_report("005930", Mode.GUIDE)
        with tempfile.TemporaryDirectory() as d:
            path = rep.to_excel(os.path.join(d, "r.xlsx"))
            self.assertGreater(os.path.getsize(path), 1000)
        self.assertIn("## 근거", rep.to_markdown())


class FakeLLM:
    """첫 초안은 틀린 숫자를 쓰고, 피드백을 받으면 고치는 가짜 LLM."""

    def __init__(self):
        self.n = 0

    def complete(self, system, prompt):
        self.n += 1
        if self.n == 1:
            return "삼성전자 PER은 99.9배 [E2] 입니다."
        return "삼성전자 PER은 14.3배 [E2] 이고 Peer와 비교해 검토가 필요합니다."


class AgentRetryTest(unittest.TestCase):
    def test_verifier_retry_fixes_llm_draft(self):
        llm = FakeLLM()
        agent = ResearchAgent(FakeDB(), settings=SimpleNamespace(verify_retries=2), llm=llm)
        rep = agent.peer_report("005930")
        self.assertTrue(rep.verified)
        self.assertEqual(rep.attempts, 2)
        self.assertIn("14.3배", rep.narrative)


if __name__ == "__main__":
    unittest.main()
