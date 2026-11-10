// E2E 전용 가짜 OpenDART (127.0.0.1 에만). 실제 OpenDART와 같은 응답 모양을 흉내 냅니다.
import { createServer } from "node:http";
import { deflateRawSync } from "node:zlib";

const TICKERS = ["005930", "000660", "005380", "000270", "035420", "105560"];
const NAMES = { "005930": "삼성전자", "000660": "에스케이하이닉스", "005380": "현대자동차", "000270": "기아", "035420": "NAVER", "105560": "KB금융지주" };

function zip(name, text) {
  const data = Buffer.from(text, "utf8"), comp = deflateRawSync(data), nm = Buffer.from(name);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nm.length, 26);
  const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(8, 10); cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(data.length, 24); cd.writeUInt16LE(nm.length, 28);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(46 + nm.length, 12); eocd.writeUInt32LE(30 + nm.length + comp.length, 16);
  return Buffer.concat([local, nm, comp, cd, nm, eocd]);
}
const xml = `<result>${TICKERS.map((t, i) => `<list><corp_code>0010000${i}</corp_code><corp_name>${NAMES[t]}</corp_name><stock_code>${t}</stock_code></list>`).join("")}</result>`;
const corpOf = (c) => TICKERS[Number(c.slice(-1))];
const acc = (account_nm, a, b, c, ord) => ({ rcept_no: "20260310000777", account_nm, fs_div: "CFS", sj_div: "IS", ord, thstrm_nm: "제 59 기", frmtrm_nm: "제 58 기", bfefrmtrm_nm: "제 57 기", thstrm_amount: a, frmtrm_amount: b, bfefrmtrm_amount: c });

export function startFakeDart(port) {
  const srv = createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    const send = (o) => { res.setHeader("content-type", "application/json; charset=utf-8"); res.end(JSON.stringify(o)); };
    if (u.searchParams.get("crtfc_key") !== "E2E_FAKE_KEY") return send({ status: "010", message: "등록되지 않은 키" });
    const p = u.pathname.replace("/api/", "");
    if (p === "corpCode.xml") return res.end(zip("CORPCODE.xml", xml));
    if (p === "list.json") {
      if (u.searchParams.get("corp_cls") === "Y")
        return send({ status: "000", total_page: 1, list: [
          { corp_name: "현대자동차", stock_code: "005380", report_nm: "현금ㆍ현물배당결정", rcept_no: "20261104000111", flr_nm: "현대자동차", rcept_dt: "20261104", rm: "유" },
          { corp_name: "기아", stock_code: "000270", report_nm: "연결재무제표기준영업(잠정)실적(공정공시)", rcept_no: "20261103000222", flr_nm: "기아", rcept_dt: "20261103", rm: "유" },
        ] });
      const t = corpOf(u.searchParams.get("corp_code") ?? "0");
      return send({ status: "000", total_page: 1, list: [
        { corp_name: NAMES[t], stock_code: t, report_nm: "분기보고서 (2026.09)", rcept_no: "20261104000333", flr_nm: NAMES[t], rcept_dt: "20261104", rm: "" },
        { corp_name: NAMES[t], stock_code: t, report_nm: "현금ㆍ현물배당결정", rcept_no: "20261023000444", flr_nm: NAMES[t], rcept_dt: "20261023", rm: "유" },
      ] });
    }
    if (p === "company.json") return send({ status: "000", corp_name: NAMES[corpOf(u.searchParams.get("corp_code"))] + "(주)", ceo_nm: "대표이사", est_dt: "19671229", hm_url: "www.example.co.kr", acc_mt: "12", adres: "서울", induty_code: "30121" });
    if (p === "fnlttSinglAcnt.json") {
      const y = u.searchParams.get("bsns_year"), r = u.searchParams.get("reprt_code");
      if (y === "2025" && r === "11011")
        return send({ status: "000", list: [acc("매출액", "1,750,000,000,000,000", "1,620,000,000,000,000", "1,420,000,000,000,000", "1"), acc("영업이익", "142,000,000,000,000", "151,000,000,000,000", "98,000,000,000,000", "2"), acc("당기순이익", "130,000,000,000,000", "122,000,000,000,000", "79,000,000,000,000", "3"), { ...acc("부채총계", "160,000,000,000,000", "150,000,000,000,000", "140,000,000,000,000", "4"), sj_div: "BS" }, { ...acc("자본총계", "120,000,000,000,000", "110,000,000,000,000", "100,000,000,000,000", "5"), sj_div: "BS" }] });
      if (y === "2026" && r === "11012")
        return send({ status: "000", list: [{ ...acc("매출액", "910,000,000,000,000", "860,000,000,000,000", "", "1"), thstrm_nm: "제 60 기 반기", frmtrm_nm: "제 59 기 반기", rcept_no: "20260814000555" }, { ...acc("영업이익", "70,000,000,000,000", "75,000,000,000,000", "", "2"), thstrm_nm: "제 60 기 반기", frmtrm_nm: "제 59 기 반기", rcept_no: "20260814000555" }] });
      return send({ status: "013", message: "조회된 데이타가 없습니다." });
    }
    send({ status: "100", message: "?" });
  });
  return new Promise((ok) => srv.listen(port, "127.0.0.1", () => ok(srv)));
}
