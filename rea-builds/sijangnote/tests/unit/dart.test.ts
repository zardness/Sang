// OpenDART 연동 테스트: 실제 네트워크 대신 가짜 OpenDART 응답을 씁니다.
import { describe, expect, it } from "vitest";
import { deflateRawSync } from "node:zlib";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Dart, parseCorpCodes, unzipFirst } from "../../server/dart";
import { dartAnswer, dartIntent } from "../../server/dart-chat";
import { namedCompanies, UNIVERSE } from "../../server/universe";
import { agentCompanies } from "../../server/agents";
import { createApp } from "../../server/app";
import { openDb } from "../../server/db";
import { setDart } from "../../server/dart";

const KEY = "TESTKEY_0123456789abcdef0123456789abcdef";
const XML = `<?xml version="1.0" encoding="UTF-8"?><result>
<list><corp_code>00126380</corp_code><corp_name>삼성전자</corp_name><stock_code>005930</stock_code></list>
<list><corp_code>00164779</corp_code><corp_name>에스케이하이닉스</corp_name><stock_code>000660</stock_code></list>
<list><corp_code>00266961</corp_code><corp_name>NAVER</corp_name><stock_code>035420</stock_code></list>
<list><corp_code>99999999</corp_code><corp_name>비상장</corp_name><stock_code> </stock_code></list></result>`;

/** 파일 하나짜리 zip (deflate) 만들기 */
function zip(name: string, text: string) {
  const data = Buffer.from(text, "utf8");
  const comp = deflateRawSync(data);
  const nm = Buffer.from(name);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nm.length, 26);
  const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(8, 10); cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(data.length, 24); cd.writeUInt16LE(nm.length, 28); cd.writeUInt32LE(0, 42);
  const cdOff = 30 + nm.length + comp.length;
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(46 + nm.length, 12); eocd.writeUInt32LE(cdOff, 16);
  return Buffer.concat([local, nm, comp, cd, nm, eocd]);
}

const acc = (account_nm: string, sj_div: string, a: string, b: string, c: string, fs_div = "CFS", ord = "1") => ({ rcept_no: "20260314000123", account_nm, fs_div, sj_div, ord, thstrm_nm: "제 57 기", frmtrm_nm: "제 56 기", bfefrmtrm_nm: "제 55 기", thstrm_amount: a, frmtrm_amount: b, bfefrmtrm_amount: c });

function fakeDart(calls: string[] = []) {
  const f = (async (input: string | URL) => {
    const u = new URL(String(input));
    const path = u.pathname.replace("/api/", "");
    calls.push(path + (u.searchParams.get("reprt_code") ? `:${u.searchParams.get("bsns_year")}:${u.searchParams.get("reprt_code")}` : ""));
    expect(u.searchParams.get("crtfc_key")).toBe(KEY);
    const json = (o: unknown) => new Response(JSON.stringify(o), { headers: { "content-type": "application/json" } });
    if (path === "corpCode.xml") return new Response(zip("CORPCODE.xml", XML));
    if (path === "list.json") {
      if (u.searchParams.get("corp_code") === "00266961") return json({ status: "013", message: "조회된 데이타가 없습니다." });
      if (u.searchParams.get("corp_cls") === "Y")
        return json({ status: "000", total_page: 1, list: [
          { corp_name: "삼성전자", stock_code: "005930", report_nm: "기업설명회(IR)개최", rcept_no: "20261104800001", flr_nm: "삼성전자", rcept_dt: "20261104", rm: "유" },
          { corp_name: "다른회사", stock_code: "123456", report_nm: "주요사항보고서", rcept_no: "20261104000002", flr_nm: "다른회사", rcept_dt: "20261104", rm: "" },
        ] });
      return json({ status: "000", total_page: 1, list: [
        { corp_name: "삼성전자", stock_code: "005930", report_nm: "분기보고서 (2026.09)", rcept_no: "20261103000501", flr_nm: "삼성전자", rcept_dt: "20261103", rm: "" },
        { corp_name: "삼성전자", stock_code: "005930", report_nm: "임원ㆍ주요주주특정증권등소유상황보고서", rcept_no: "20261101000400", flr_nm: "홍길동", rcept_dt: "20261101", rm: "" },
      ] });
    }
    if (path === "company.json") return json({ status: "000", corp_name: "삼성전자(주)", ceo_nm: "대표이사", est_dt: "19690113", hm_url: "www.samsung.com/sec", acc_mt: "12", adres: "경기도 수원시", induty_code: "264" });
    if (path === "fnlttSinglAcnt.json") {
      const y = u.searchParams.get("bsns_year"), r = u.searchParams.get("reprt_code");
      if (y === "2025" && r === "11011")
        return json({ status: "000", list: [
          acc("매출액", "IS", "3,000,000,000,000", "2,500,000,000,000", "2,000,000,000,000", "CFS", "21"),
          acc("영업이익", "IS", "300,000,000,000", "200,000,000,000", "100,000,000,000", "CFS", "23"),
          acc("당기순이익(손실)", "IS", "250,000,000,000", "150,000,000,000", "80,000,000,000", "CFS", "27"),
          acc("자산총계", "BS", "5,000,000,000,000", "4,000,000,000,000", "3,000,000,000,000", "CFS", "5"),
          acc("부채총계", "BS", "2,000,000,000,000", "1,800,000,000,000", "1,500,000,000,000", "CFS", "9"),
          acc("자본총계", "BS", "3,000,000,000,000", "2,200,000,000,000", "1,500,000,000,000", "CFS", "13"),
          acc("매출액", "IS", "1", "1", "1", "OFS", "21"),
        ] });
      if (y === "2026" && r === "11012")
        return json({ status: "000", list: [
          { ...acc("매출액", "IS", "1,600,000,000,000", "1,400,000,000,000", "", "CFS", "21"), thstrm_nm: "제 58 기 반기", frmtrm_nm: "제 57 기 반기", rcept_no: "20260814000900" },
          { ...acc("영업이익", "IS", "200,000,000,000", "120,000,000,000", "", "CFS", "23"), thstrm_nm: "제 58 기 반기", frmtrm_nm: "제 57 기 반기", rcept_no: "20260814000900" },
        ] });
      return json({ status: "013", message: "조회된 데이타가 없습니다." });
    }
    return json({ status: "100", message: "?" });
  }) as typeof fetch;
  return new Dart({ key: KEY, fetch: f, cacheDir: mkdtempSync(join(tmpdir(), "dart-")), now: () => new Date("2026-11-05T10:00:00+09:00") });
}

describe("[추론 INF-014] 50개 기업", () => {
  it("종목코드가 겹치지 않는 50개이고, Agent 기업은 삼성전자·SK하이닉스", () => {
    expect(UNIVERSE).toHaveLength(50);
    expect(new Set(UNIVERSE.map((c) => c.ticker)).size).toBe(50);
    expect(UNIVERSE.every((c) => /^\d{6}$/.test(c.ticker))).toBe(true);
    expect(agentCompanies().map((c) => c.name)).toEqual(["삼성전자", "SK하이닉스"]); // 스냅샷이 있는 기업만
  });
  it("질문 속 기업 이름: 겹치면 긴 이름 (SK하이닉스 > SK)", () => {
    expect(namedCompanies("SK하이닉스 최근 공시").map((c) => c.ticker)).toEqual(["000660"]);
    expect(namedCompanies("sk 공시 알려줘").map((c) => c.ticker)).toEqual(["034730"]);
  });
});

describe("[추론 INF-015] OpenDART 연동 (가짜 응답)", () => {
  it("corpCode.xml zip 을 풀어 상장사 종목코드 → 고유번호", () => {
    const map = parseCorpCodes(unzipFirst(zip("CORPCODE.xml", XML)));
    expect(map["005930"].corp).toBe("00126380");
    expect(Object.keys(map)).toHaveLength(3);
  });
  it("인증키가 없으면 네트워크를 쓰지 않고 오프라인", async () => {
    let called = false;
    const d = new Dart({ key: undefined, fetch: (async () => { called = true; return new Response(""); }) as typeof fetch });
    expect(d.status()).toMatchObject({ configured: false, mode: "offline" });
    await expect(d.disclosures("005930")).rejects.toThrow("인증키");
    expect(called).toBe(false);
  });
  it("공시 목록·기업개황·피드", async () => {
    const calls: string[] = [];
    const d = fakeDart(calls);
    const list = await d.disclosures("005930");
    expect(list[0]).toMatchObject({ date: "2026-11-03", title: "분기보고서 (2026.09)", link: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261103000501" });
    await d.disclosures("005930");
    expect(calls.filter((c) => c === "list.json")).toHaveLength(1); // 5분 캐시
    expect(calls.filter((c) => c === "corpCode.xml")).toHaveLength(1);
    expect(await d.disclosures("035420")).toEqual([]); // 013 = 공시 없음
    const ov = await d.overview("005930");
    expect(ov).toMatchObject({ established: "1969-01-13", homepage: "https://www.samsung.com/sec", fiscalMonth: "12월" });
    const feed = await d.feed(3);
    expect(feed.map((x) => x.ticker)).toEqual(["005930"]); // 50개 밖 회사는 뺀다
  });
  it("주요 재무: 2025 사업보고서 3개년(연결) + 2026 반기, 비율 계산", async () => {
    const calls: string[] = [];
    const d = fakeDart(calls);
    const f = await d.financials("005930");
    expect(f.annual).toMatchObject({ year: "2025", fs: "연결", periods: ["제 55 기", "제 56 기", "제 57 기"] });
    expect(f.annual!.rows.find((r) => r.key === "revenue")!.values).toEqual([2e12, 2.5e12, 3e12]);
    expect(f.annual!.rows.find((r) => r.key === "net")!.values.at(-1)).toBe(2.5e11);
    expect(f.annual!.ratios).toEqual([{ label: "영업이익률", value: 10, unit: "%" }, { label: "부채비율", value: 66.7, unit: "%" }]);
    expect(f.interim).toMatchObject({ title: "2026년 반기보고서", periods: ["제 57 기 반기", "제 58 기 반기"] });
    expect(f.interim!.rows.find((r) => r.key === "assets")!.values).toEqual([null, null]);
    expect(calls.filter((c) => c.startsWith("fnltt"))).toEqual(["fnlttSinglAcnt.json:2025:11011", "fnlttSinglAcnt.json:2026:11014", "fnlttSinglAcnt.json:2026:11012"]);
  });
  it("오류 코드는 한국어로, 인증키는 오류 메시지에 남기지 않는다", async () => {
    const d = new Dart({ key: KEY, cacheDir: mkdtempSync(join(tmpdir(), "dart-")), fetch: (async () => new Response(JSON.stringify({ status: "020", message: "x" }))) as typeof fetch });
    (d as unknown as { codes: object }).codes = { "005930": { corp: "00126380", name: "삼성전자" } };
    await expect(d.disclosures("005930")).rejects.toThrow("요청 한도");
    expect(JSON.stringify(d.status())).not.toContain(KEY);
    const n = new Dart({ key: KEY, cacheDir: mkdtempSync(join(tmpdir(), "dart-")), fetch: (async () => { throw new TypeError(`fetch failed https://x?crtfc_key=${KEY}`); }) as typeof fetch });
    const err = await n.disclosures("005930").catch((e: Error) => e.message);
    expect(err).not.toContain(KEY);
  });
});

describe("[추론 INF-016] 챗봇 OpenDART 답변", () => {
  it("의도 판별: P02 사업 단위 질문은 기존 규칙에 양보", () => {
    expect(dartIntent("NAVER 최근 공시 알려줘")).toMatchObject({ want: "disclosures" });
    expect(dartIntent("현대차 영업이익 얼마야?")).toMatchObject({ want: "financials" });
    expect(dartIntent("삼성전자 HBM 매출")).toBeNull();
    expect(dartIntent("ETF 총보수가 뭐야")).toBeNull();
  });
  it("공시·재무 답변과 출처 링크", async () => {
    const d = fakeDart();
    const a = (await dartAnswer("삼성전자 최근 공시 알려줘", d))!;
    expect(a.steps).toContain("OpenDART 공시 검색");
    expect(a.answer).toContain("분기보고서 (2026.09)");
    expect(a.sources[0].link).toContain("rcpNo=20261103000501");
    const f = (await dartAnswer("삼성전자 영업이익 얼마야", d))!;
    expect(f.answer).toContain("2026년 반기보고서");
    expect(f.answer).toContain("2,000억원");
    expect(f.answer).toContain("영업이익률 12.5%");
  });
  it("키가 없으면 설정 방법을 안내", async () => {
    const a = (await dartAnswer("기아 공시", new Dart({ key: undefined })))!;
    expect(a.answer).toContain("dart.config.json");
  });
});

describe("API", () => {
  it("/api/companies 50개, /api/companies/:ticker/dart 실시간 응답", async () => {
    setDart(fakeDart());
    const app = createApp(openDb(":memory:"));
    const list = await (await app.request("/api/companies")).json();
    expect(list).toHaveLength(50);
    const r = await (await app.request("/api/companies/005930/dart")).json();
    expect(r.overview.corpName).toBe("삼성전자(주)");
    expect(r.disclosures).toHaveLength(2);
    expect(r.financials.annual.year).toBe("2025");
    expect(r.errors).toEqual([]);
    expect(JSON.stringify(r)).not.toContain(KEY);
    const p02 = await app.request("/api/companies/005930/p02");
    expect(p02.status).toBe(200);
    expect((await app.request("/api/companies/005380/p02")).status).toBe(404);
    expect((await app.request("/api/companies/999999/dart")).status).toBe(404);
    const ask = await (await app.request("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: "삼성전자 최근 공시" }) })).json();
    expect(ask.inferred).toBe("INF-016");
    setDart(new Dart({ key: undefined }));
    const off = await (await app.request("/api/companies/005380/dart")).json();
    expect(off.status.mode).toBe("offline");
    setDart(null);
  });
});

describe("인증키 읽기", () => {
  it(".env 에서 OpenDART 키 줄만 읽는다 (따옴표·export·주석 처리)", async () => {
    const { keyFromEnvText } = await import("../../server/dart");
    expect(keyFromEnvText("NEON_URL=postgres://secret\nDART_API_KEY=abc123\n")).toBe("abc123");
    expect(keyFromEnvText('export OPENDART_API_KEY="xyz789"  # 메모')).toBe("xyz789");
    expect(keyFromEnvText("NEON_URL=postgres://secret\n")).toBeUndefined();
  });
  it("dart.config.json 의 envFile 이 가리키는 .env 를 쓴다", async () => {
    const { writeFileSync } = await import("node:fs");
    const { dartKey } = await import("../../server/dart");
    const d = mkdtempSync(join(tmpdir(), "key-"));
    writeFileSync(join(d, "agent.env"), "OTHER=1\nDART_API_KEY='k-from-env'\n");
    writeFileSync(join(d, "dart.config.json"), JSON.stringify({ apiKey: "", envFile: join(d, "agent.env") }));
    const prev = process.env.DART_CONFIG, prevKey = process.env.DART_API_KEY;
    process.env.DART_CONFIG = join(d, "dart.config.json");
    delete process.env.DART_API_KEY;
    try {
      expect(dartKey()).toBe("k-from-env");
    } finally {
      if (prev === undefined) delete process.env.DART_CONFIG; else process.env.DART_CONFIG = prev;
      if (prevKey !== undefined) process.env.DART_API_KEY = prevKey;
    }
  });
});
