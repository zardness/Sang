"""명령줄 실행.

python -m kic_agent.cli doctor
python -m kic_agent.cli peer 005930 --mode guide --excel out/samsung_peer.xlsx
python -m kic_agent.cli risk 005930
python -m kic_agent.cli monitor --hours 24 --tts out/briefing.mp3
python -m kic_agent.cli ask "삼성전자와 SK하이닉스의 최근 4개 분기 영업이익률을 비교해줘"
python -m kic_agent.cli sql "SELECT ticker, name FROM core.company LIMIT 5"
"""
from __future__ import annotations

import argparse
import os
import sys

from .agent import CompanyNotFound, ResearchAgent
from .db import PostgresDB
from .evidence import EvidenceLedger
from .modes import Mode


def _save(report, args) -> None:
    md = report.to_markdown()
    print(md)
    if getattr(args, "out", None):
        os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(md)
        print(f"\n[저장] {args.out}", file=sys.stderr)
    if getattr(args, "excel", None):
        os.makedirs(os.path.dirname(args.excel) or ".", exist_ok=True)
        report.to_excel(args.excel)
        print(f"[저장] {args.excel}", file=sys.stderr)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="kic_agent", description="KIC AI Agent CLI")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("doctor", help="DB 구조 점검")
    for name, help_ in (("peer", "② Peer 비교 보고서"), ("risk", "③ 리스크 심사 의견서")):
        sp = sub.add_parser(name, help=help_)
        sp.add_argument("query", help="종목명 또는 티커")
        sp.add_argument("--mode", choices=[m.value for m in Mode], default="expert")
        sp.add_argument("--out", help="Markdown 저장 경로")
        sp.add_argument("--excel", help="Excel 저장 경로")
        sp.add_argument("--offline", action="store_true", help="LLM 없이 템플릿으로 작성")
    sm = sub.add_parser("monitor", help="① 신규 공시 모니터링")
    sm.add_argument("--hours", type=int, default=24)
    sm.add_argument("--mode", choices=[m.value for m in Mode], default="expert")
    sm.add_argument("--tts", help="브리핑 mp3 저장 경로")
    sm.add_argument("--offline", action="store_true")
    sa = sub.add_parser("ask", help="자유 질문 (LLM 필요)")
    sa.add_argument("question")
    sa.add_argument("--mode", choices=[m.value for m in Mode], default="expert")
    sq = sub.add_parser("sql", help="SQL 가드를 거쳐 조회")
    sq.add_argument("sql")

    args = p.parse_args(argv)
    db = PostgresDB()
    try:
        if args.cmd == "doctor":
            from .doctor import run_doctor

            print("\n".join(run_doctor(db)))
            return 0
        if args.cmd == "sql":
            from .tools.data import run_sql

            out = run_sql(db, EvidenceLedger(), args.sql, register=False)
            print(out["sql"])
            for r in out["rows"]:
                print(r)
            return 0

        agent = ResearchAgent(db, llm=None if getattr(args, "offline", False) else "auto")
        mode = Mode(args.mode)
        if args.cmd == "peer":
            _save(agent.peer_report(args.query, mode), args)
        elif args.cmd == "risk":
            _save(agent.risk_review(args.query, mode), args)
        elif args.cmd == "monitor":
            res = agent.monitor(args.hours, mode)
            print(res["briefing"])
            print(f"\n리스크 공시 종목: {res['flagged'] or '없음'}")
            for rep in res["reviews"]:
                print("\n" + rep.to_markdown())
            if args.tts:
                from .tts import synthesize

                print(f"[저장] {synthesize(res['briefing'], args.tts)}")
        elif args.cmd == "ask":
            _save(agent.ask(args.question, mode), args)
        return 0
    except CompanyNotFound as e:
        print(e, file=sys.stderr)
        return 2
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
